import { failure, ok, type Result } from '@/core/result/result';
import {
  initializeLocalDatabase,
  type LocalOutboxStatus,
} from '@/data/local/sqliteClient';
import type { Dignity } from '@/domain/election/dignity';

export type LocalActaOperation = {
  operationId: string;
  actaId: string;
  mesaId: string;
  dignity: Dignity;
  status: LocalOutboxStatus;
  version: number;
  attemptCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  nextAttemptAt: string | null;
  totalSufragantes: number;
  fotoPath: string;
  gpsLat: number;
  gpsLng: number;
  gpsPrecision: number;
};

type OutboxRow = {
  operation_id: string;
  acta_id: string;
  mesa_id: string;
  dignity: Dignity;
  status: LocalOutboxStatus;
  version: number;
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  next_attempt_at: string | null;
  total_sufragantes: number;
  foto_path: string;
  gps_lat: number;
  gps_lng: number;
  gps_precision: number;
};

export async function listLocalActaOperations(): Promise<Result<LocalActaOperation[]>> {
  try {
    const database = await initializeLocalDatabase();
    const rows = await database.getAllAsync<OutboxRow>(
      `SELECT
        outbox.operation_id,
        outbox.acta_id,
        actas_local.mesa_id,
        actas_local.dignidad,
        outbox.status,
        actas_local.version,
        outbox.attempt_count,
        outbox.last_error,
        outbox.created_at,
        outbox.updated_at,
        outbox.next_attempt_at,
        actas_local.total_sufragantes,
        actas_local.foto_path,
        actas_local.gps_lat,
        actas_local.gps_lng,
        actas_local.gps_precision
      FROM outbox
      INNER JOIN actas_local ON actas_local.operation_id = outbox.operation_id
      ORDER BY outbox.created_at DESC`,
    );

    return ok(
      rows.map((row) => ({
        operationId: row.operation_id,
        actaId: row.acta_id,
        mesaId: row.mesa_id,
        dignity: row.dignity,
        status: row.status,
        version: row.version,
        attemptCount: row.attempt_count,
        lastError: row.last_error,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        nextAttemptAt: row.next_attempt_at,
        totalSufragantes: row.total_sufragantes,
        fotoPath: row.foto_path,
        gpsLat: row.gps_lat,
        gpsLng: row.gps_lng,
        gpsPrecision: row.gps_precision,
      })),
    );
  } catch (error) {
    return failure(
      'ERROR_LEER_COLA_LOCAL',
      error instanceof Error ? error.message : 'No fue posible leer la cola local',
    );
  }
}
