import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { ActaStatus } from '@/domain/acta/acta-status';
import type { Dignity } from '@/domain/election/dignity';

export const LOCAL_DATABASE_NAME = 'control-electoral-adn.db';

const DATABASE_VERSION = 1;
const STALE_OPERATION_TIMEOUT_MS = 120000;

export type LocalOutboxStatus = 'pendiente' | 'en_proceso' | 'guardado' | 'fallado';

export type OfflineVote = {
  organizationId: string;
  candidateId: string;
  votos: number;
};

export type SaveActaOfflineInput = {
  operationId?: string;
  actaId: string;
  mesaId: string;
  dignity: Dignity;
  expectedVersion: number;
  totalSufragantes: number;
  votosValidos: number;
  votosBlancos: number;
  votosNulos: number;
  gpsLat: number;
  gpsLng: number;
  gpsPrecision: number;
  fotoPath: string;
  storagePath?: string;
  observaciones?: string;
  deviceId?: string;
  votes: OfflineVote[];
};

export type OutboxOperation = {
  id: string;
  operationId: string;
  actaId: string;
  attemptCount: number;
  payload: string;
};

export type ActaConflictInput = {
  actaId: string;
  mesaId: string;
  dignity: Dignity;
  baseVersion: number;
  localVersion: number;
  remoteVersion: number;
  payload: unknown;
};

const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE IF NOT EXISTS organizations_local (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    list_number INTEGER NOT NULL UNIQUE,
    primary_color TEXT NOT NULL,
    secondary_color TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS recintos_local (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    province TEXT NOT NULL,
    canton TEXT NOT NULL,
    gps_lat REAL NOT NULL,
    gps_lng REAL NOT NULL,
    radius_meters INTEGER NOT NULL DEFAULT 300
  );

  CREATE TABLE IF NOT EXISTS mesas_local (
    id TEXT PRIMARY KEY,
    recinto_id TEXT NOT NULL REFERENCES recintos_local(id) ON DELETE CASCADE,
    number TEXT NOT NULL,
    registered_voters INTEGER NOT NULL CHECK (registered_voters >= 0),
    location TEXT,
    UNIQUE (recinto_id, number)
  );

  CREATE TABLE IF NOT EXISTS actas_local (
    operation_id TEXT PRIMARY KEY,
    acta_id TEXT NOT NULL,
    mesa_id TEXT NOT NULL,
    dignidad TEXT NOT NULL CHECK (dignidad IN ('alcaldia', 'prefectura')),
    version INTEGER NOT NULL CHECK (version > 0),
    estado TEXT NOT NULL CHECK (estado IN ('en_proceso', 'guardado', 'fallado')),
    remote_id TEXT,
    total_sufragantes INTEGER NOT NULL CHECK (total_sufragantes >= 0),
    votos_validos INTEGER NOT NULL CHECK (votos_validos >= 0),
    votos_blancos INTEGER NOT NULL CHECK (votos_blancos >= 0),
    votos_nulos INTEGER NOT NULL CHECK (votos_nulos >= 0),
    gps_lat REAL NOT NULL,
    gps_lng REAL NOT NULL,
    gps_precision REAL NOT NULL CHECK (gps_precision >= 0),
    foto_path TEXT NOT NULL,
    observaciones TEXT,
    creado_en TEXT NOT NULL,
    actualizado_en TEXT NOT NULL,
    UNIQUE (acta_id, version),
    UNIQUE (acta_id, operation_id),
    UNIQUE (mesa_id, dignidad, version),
    CHECK (votos_validos + votos_blancos + votos_nulos = total_sufragantes)
  );

  CREATE TABLE IF NOT EXISTS votos_detalle_local (
    operation_id TEXT NOT NULL REFERENCES actas_local(operation_id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL,
    candidate_id TEXT NOT NULL,
    votos INTEGER NOT NULL CHECK (votos >= 0),
    PRIMARY KEY (operation_id, candidate_id)
  );

  CREATE TABLE IF NOT EXISTS acta_versiones_local (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    acta_id TEXT NOT NULL,
    mesa_id TEXT NOT NULL,
    dignidad TEXT NOT NULL,
    version INTEGER NOT NULL,
    payload TEXT NOT NULL,
    device_id TEXT,
    creado_en TEXT NOT NULL,
    conflict_status TEXT NOT NULL DEFAULT 'sin_conflicto'
      CHECK (conflict_status IN ('sin_conflicto', 'detectado', 'en_revision', 'resuelto')),
    UNIQUE (acta_id, version)
  );

  CREATE TABLE IF NOT EXISTS conflictos_edicion_local (
    id TEXT PRIMARY KEY,
    acta_id TEXT NOT NULL,
    mesa_id TEXT NOT NULL,
    dignidad TEXT NOT NULL,
    base_version INTEGER NOT NULL,
    local_version INTEGER NOT NULL,
    remote_version INTEGER NOT NULL,
    payload TEXT NOT NULL,
    estado TEXT NOT NULL CHECK (estado IN ('detectado', 'en_revision', 'resuelto')),
    creado_en TEXT NOT NULL,
    resuelto_en TEXT
  );

  CREATE TABLE IF NOT EXISTS outbox (
    id TEXT PRIMARY KEY,
    operation_id TEXT NOT NULL UNIQUE REFERENCES actas_local(operation_id) ON DELETE CASCADE,
    acta_id TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'ACTA',
    status TEXT NOT NULL CHECK (status IN ('pendiente', 'en_proceso', 'guardado', 'fallado')),
    idempotency_key TEXT NOT NULL UNIQUE,
    payload TEXT NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    next_attempt_at TEXT,
    UNIQUE (acta_id, operation_id)
  );

  CREATE TABLE IF NOT EXISTS outbox_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    outbox_id TEXT NOT NULL REFERENCES outbox(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    error TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sync_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_actas_local_mesa_dignidad
    ON actas_local (mesa_id, dignidad);
  CREATE INDEX IF NOT EXISTS idx_actas_local_estado
    ON actas_local (estado);
  CREATE INDEX IF NOT EXISTS idx_versiones_acta
    ON acta_versiones_local (acta_id, version);
  CREATE INDEX IF NOT EXISTS idx_outbox_status_attempt
    ON outbox (status, next_attempt_at, created_at);
  CREATE INDEX IF NOT EXISTS idx_conflictos_estado
    ON conflictos_edicion_local (estado);
  `
];

let databasePromise: Promise<SQLiteDatabase> | null = null;

function createId(): string {
  const cryptoRef = globalThis.crypto as
    | { randomUUID?: () => string; getRandomValues?: (array: Uint8Array) => Uint8Array }
    | undefined;

  if (cryptoRef?.randomUUID) {
    return cryptoRef.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (cryptoRef?.getRandomValues) {
    cryptoRef.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function openLocalDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(LOCAL_DATABASE_NAME)
      .then(async (database) => {
        await database.execAsync(`
          PRAGMA journal_mode = WAL;
          PRAGMA foreign_keys = ON;
          PRAGMA busy_timeout = 5000;
          PRAGMA synchronous = NORMAL;
        `);
        return database;
      })
      .catch((error: unknown) => {
        databasePromise = null;
        throw error;
      });
  }

  return databasePromise;
}

export function getLocalDatabase(): Promise<SQLiteDatabase> {
  return openLocalDatabase();
}

export async function closeLocalDatabase(): Promise<void> {
  if (!databasePromise) {
    return;
  }

  const database = await databasePromise;
  await database.closeAsync();
  databasePromise = null;
}

async function requeueStaleOperationsInDatabase(database: SQLiteDatabase): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_OPERATION_TIMEOUT_MS).toISOString();
  const now = nowIso();
  const stale = await database.getAllAsync<{ operation_id: string }>(
    `SELECT operation_id FROM outbox WHERE status = 'en_proceso' AND updated_at < ?`,
    cutoff,
  );

  if (stale.length === 0) {
    return;
  }

  const placeholders = stale.map(() => '?').join(', ');
  const operationIds = stale.map((row) => row.operation_id);

  await database.runAsync(
    `UPDATE outbox
     SET status = 'pendiente', updated_at = ?, last_error = COALESCE(last_error, 'Reanudado tras reinicio')
     WHERE status = 'en_proceso' AND updated_at < ?`,
    now,
    cutoff,
  );
  await database.runAsync(
    `UPDATE actas_local SET estado = 'en_proceso', actualizado_en = ?
     WHERE operation_id IN (${placeholders})`,
    now,
    ...operationIds,
  );
}

export async function requeueStaleOperations(): Promise<void> {
  const database = await initializeLocalDatabase();
  await requeueStaleOperationsInDatabase(database);
}

export async function initializeLocalDatabase(): Promise<SQLiteDatabase> {
  const database = await openLocalDatabase();
  const versionRow = await database.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  const currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion < DATABASE_VERSION) {
    await database.withTransactionAsync(async () => {
      for (let index = currentVersion; index < MIGRATIONS.length; index += 1) {
        await database.execAsync(MIGRATIONS[index]);
      }
      await database.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
    });
  }

  await requeueStaleOperationsInDatabase(database);
  return database;
}

function validateActaInput(input: SaveActaOfflineInput): void {
  const votesSum = input.votes.reduce((total, vote) => total + vote.votos, 0);

  if (
    input.totalSufragantes < 0 ||
    input.votosValidos < 0 ||
    input.votosBlancos < 0 ||
    input.votosNulos < 0 ||
    input.votes.some((vote) => vote.votos < 0)
  ) {
    throw new Error('VALORES_NEGATIVOS_NO_PERMITIDOS');
  }

  if (input.votosValidos + input.votosBlancos + input.votosNulos !== input.totalSufragantes) {
    throw new Error('CUADRE_MATEMATICO_INVALIDO');
  }

  if (votesSum !== input.votosValidos) {
    throw new Error('SUMA_DE_LISTAS_NO_COINCIDE_CON_VOTOS_VALIDOS');
  }

  if (input.expectedVersion < 0) {
    throw new Error('VERSION_ESPERADA_INVALIDA');
  }
}

async function insertConflictInTransaction(
  database: SQLiteDatabase,
  input: ActaConflictInput,
): Promise<void> {
  await database.runAsync(
    `INSERT INTO conflictos_edicion_local (
      id, acta_id, mesa_id, dignidad, base_version, local_version,
      remote_version, payload, estado, creado_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'detectado', ?)`,
    createId(),
    input.actaId,
    input.mesaId,
    input.dignity,
    input.baseVersion,
    input.localVersion,
    input.remoteVersion,
    JSON.stringify(input.payload),
    nowIso(),
  );

  await database.runAsync(
    `UPDATE acta_versiones_local
     SET conflict_status = 'detectado'
     WHERE acta_id = ? AND version IN (?, ?)`,
    input.actaId,
    input.baseVersion,
    input.localVersion,
  );
}

export async function recordActaConflict(input: ActaConflictInput): Promise<void> {
  const database = await initializeLocalDatabase();
  await database.withTransactionAsync(async () => {
    await insertConflictInTransaction(database, input);
  });
}

export async function saveActaOffline(input: SaveActaOfflineInput): Promise<string> {
  const database = await initializeLocalDatabase();
  validateActaInput(input);

  const operationId = input.operationId ?? createId();
  const now = nowIso();
  const payload = JSON.stringify(input);
  let savedOperationId = operationId;
  const state: { conflict: ActaConflictInput | null } = { conflict: null };

  await database.withTransactionAsync(async () => {
    const existing = await database.getFirstAsync<{ operation_id: string }>(
      'SELECT operation_id FROM outbox WHERE operation_id = ?',
      operationId,
    );

    if (existing) {
      savedOperationId = existing.operation_id;
      return;
    }

    const latest = await database.getFirstAsync<{ version: number | null }>(
      'SELECT MAX(version) AS version FROM actas_local WHERE acta_id = ?',
      input.actaId,
    );
    const latestVersion = latest?.version ?? null;

    if (latestVersion !== null && latestVersion > input.expectedVersion) {
      state.conflict = {
        actaId: input.actaId,
        mesaId: input.mesaId,
        dignity: input.dignity,
        baseVersion: input.expectedVersion,
        localVersion: input.expectedVersion + 1,
        remoteVersion: latestVersion,
        payload: input,
      };
      return;
    }

    const nextVersion = input.expectedVersion + 1;

    const duplicate = await database.getFirstAsync<{ operation_id: string }>(
      'SELECT operation_id FROM actas_local WHERE acta_id = ? AND version = ?',
      input.actaId,
      nextVersion,
    );

    if (duplicate) {
      state.conflict = {
        actaId: input.actaId,
        mesaId: input.mesaId,
        dignity: input.dignity,
        baseVersion: input.expectedVersion,
        localVersion: nextVersion,
        remoteVersion: latestVersion ?? nextVersion,
        payload: input,
      };
      return;
    }

    await database.runAsync(
      `INSERT INTO actas_local (
        operation_id, acta_id, mesa_id, dignidad, version, estado,
        total_sufragantes, votos_validos, votos_blancos, votos_nulos,
        gps_lat, gps_lng, gps_precision, foto_path, observaciones,
        creado_en, actualizado_en
      ) VALUES (?, ?, ?, ?, ?, 'en_proceso', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      operationId,
      input.actaId,
      input.mesaId,
      input.dignity,
      nextVersion,
      input.totalSufragantes,
      input.votosValidos,
      input.votosBlancos,
      input.votosNulos,
      input.gpsLat,
      input.gpsLng,
      input.gpsPrecision,
      input.fotoPath,
      input.observaciones ?? null,
      now,
      now,
    );

    await database.runAsync(
      `INSERT INTO acta_versiones_local (
        acta_id, mesa_id, dignidad, version, payload, device_id, creado_en
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      input.actaId,
      input.mesaId,
      input.dignity,
      nextVersion,
      payload,
      input.deviceId ?? 'dispositivo-local',
      now,
    );

    for (const vote of input.votes) {
      await database.runAsync(
        `INSERT INTO votos_detalle_local (operation_id, organization_id, candidate_id, votos)
         VALUES (?, ?, ?, ?)`,
        operationId,
        vote.organizationId,
        vote.candidateId,
        vote.votos,
      );
    }

    await database.runAsync(
      `INSERT INTO outbox (
        id, operation_id, acta_id, kind, status, idempotency_key,
        payload, attempt_count, created_at, updated_at
      ) VALUES (?, ?, ?, 'ACTA', 'pendiente', ?, ?, 0, ?, ?)`,
      createId(),
      operationId,
      input.actaId,
      operationId,
      payload,
      now,
      now,
    );
  });

  if (state.conflict) {
    await recordActaConflict(state.conflict);
    throw new Error('CONFLICTO_EDICION_OFFLINE');
  }

  return savedOperationId;
}

export async function updateOutboxPayload(
  operationId: string,
  payload: SaveActaOfflineInput,
): Promise<void> {
  const database = await initializeLocalDatabase();
  await database.runAsync(
    'UPDATE outbox SET payload = ?, updated_at = ? WHERE operation_id = ?',
    JSON.stringify(payload),
    nowIso(),
    operationId,
  );
}

export async function claimPendingOperations(limit = 5): Promise<OutboxOperation[]> {
  const database = await initializeLocalDatabase();
  const now = nowIso();
  let operations: OutboxOperation[] = [];

  await database.withTransactionAsync(async () => {
    const rows = await database.getAllAsync<{
      id: string;
      operation_id: string;
      acta_id: string;
      attempt_count: number;
      payload: string;
    }>(
        `SELECT id, operation_id, acta_id, attempt_count, payload
         FROM outbox
         WHERE status = 'pendiente'
            OR (status = 'fallado' AND next_attempt_at IS NOT NULL AND next_attempt_at <= ?)
         ORDER BY created_at ASC
         LIMIT ?`,
      now,
      limit,
    );

    for (const row of rows) {
      await database.runAsync(
        `UPDATE outbox
         SET status = 'en_proceso', attempt_count = attempt_count + 1, updated_at = ?
         WHERE id = ?`,
         now,
         row.id,
       );
       await database.runAsync(
         `UPDATE actas_local
          SET estado = 'en_proceso', actualizado_en = ?
          WHERE operation_id = ?`,
         now,
         row.operation_id,
       );
       await database.runAsync(
         `INSERT INTO outbox_attempts (outbox_id, status, created_at)
          VALUES (?, 'en_proceso', ?)`,
        row.id,
        now,
      );
    }

    operations = rows.map((row) => ({
      id: row.id,
      operationId: row.operation_id,
      actaId: row.acta_id,
      attemptCount: row.attempt_count + 1,
      payload: row.payload,
    }));
  });

  return operations;
}

type MarkOutboxOptions = {
  error?: string | null;
  remoteId?: string | null;
  retryDelayMs?: number;
  terminal?: boolean;
};

export async function markOutboxOperation(
  operationId: string,
  status: LocalOutboxStatus,
  options: MarkOutboxOptions = {},
): Promise<void> {
  const database = await initializeLocalDatabase();
  const now = nowIso();
  const nextAttemptAt =
    status === 'fallado' && !options.terminal
      ? new Date(Date.now() + (options.retryDelayMs ?? 30000)).toISOString()
      : null;
  const actaStatus: ActaStatus =
    status === 'guardado' ? 'guardado' : status === 'fallado' ? 'fallado' : 'en_proceso';

  await database.withTransactionAsync(async () => {
    const outbox = await database.getFirstAsync<{ id: string }>(
      'SELECT id FROM outbox WHERE operation_id = ?',
      operationId,
    );

    if (!outbox) {
      throw new Error('OPERACION_OUTBOX_NO_EXISTE');
    }

    await database.runAsync(
      `UPDATE outbox
       SET status = ?, last_error = ?, updated_at = ?, next_attempt_at = ?
       WHERE operation_id = ?`,
      status,
      options.error ?? null,
      now,
      nextAttemptAt,
      operationId,
    );

    await database.runAsync(
      `INSERT INTO outbox_attempts (outbox_id, status, error, created_at)
       VALUES (?, ?, ?, ?)`,
      outbox.id,
      status,
      options.error ?? null,
      now,
    );

    await database.runAsync(
      `UPDATE actas_local
       SET estado = ?, remote_id = COALESCE(?, remote_id), actualizado_en = ?
       WHERE operation_id = ?`,
      actaStatus,
      options.remoteId ?? null,
      now,
      operationId,
    );
  });
}
