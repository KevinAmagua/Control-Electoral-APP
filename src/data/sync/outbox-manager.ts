import NetInfo from '@react-native-community/netinfo';

import { failure, ok, type Result } from '@/core/result/result';
import type { ActaDraft } from '@/domain/acta/acta';
import type { ActaRepository } from '@/domain/repositories/acta-repository';

import {
  claimPendingOperations,
  getOutboxSnapshot,
  initializeLocalDatabase,
  listUnsyncedLocalConflicts,
  markLocalConflictSynced,
  markOutboxOperation,
  recordActaConflict,
  saveActaOffline,
  updateOutboxPayload,
  type ActaConflictInput,
  type OutboxSnapshot,
  type SaveActaOfflineInput,
} from '../local/sqliteClient';
import { captureError } from '../monitoring/sentry';
import { getCurrentAuthUserId } from '../remote/supabase/client';
import { uploadActaPhoto } from '../remote/supabase/storage-repository';

export type QueueActaInput = Omit<SaveActaOfflineInput, 'operationId'> & {
  operationId?: string;
};

const OUTBOX_RETRY_INTERVAL_MS = 15000;
const outboxListeners = new Set<() => void>();

function notifyOutboxListeners(): void {
  outboxListeners.forEach((listener) => listener());
}

function isLocalPhotoPath(path: string): boolean {
  return path.startsWith('file://');
}

function remotePhotoPath(payload: SaveActaOfflineInput): string | null {
  const storagePath = payload.storagePath;
  return storagePath && !isLocalPhotoPath(storagePath) ? storagePath : null;
}

function conflictFromPayload(
  payload: SaveActaOfflineInput,
  remoteVersion: number,
): ActaConflictInput {
  return {
    actaId: payload.actaId,
    mesaId: payload.mesaId,
    dignity: payload.dignity,
    baseVersion: payload.expectedVersion,
    localVersion: payload.expectedVersion + 1,
    remoteVersion,
    payload,
  };
}

function toDraft(payload: SaveActaOfflineInput): ActaDraft {
  return {
    mesaId: payload.mesaId,
    dignidad: payload.dignity,
    expectedVersion: payload.expectedVersion,
    totalSufragantes: payload.totalSufragantes,
    votosValidos: payload.votosValidos,
    votosBlancos: payload.votosBlancos,
    votosNulos: payload.votosNulos,
    gpsLat: payload.gpsLat,
    gpsLng: payload.gpsLng,
    gpsPrecision: payload.gpsPrecision,
    fotoPath: remotePhotoPath(payload) ?? payload.fotoPath,
    observaciones: payload.observaciones,
    operacionClienteId: payload.operationId ?? payload.actaId,
    votos: payload.votes,
  };
}

export async function queueActaForSync(input: QueueActaInput): Promise<Result<string>> {
  try {
    const operationId = await saveActaOffline(input);
    notifyOutboxListeners();
    return ok(operationId);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'ERROR_COLA_OFFLINE';
    return failure(code, code === 'CONFLICTO_EDICION_OFFLINE'
      ? 'El acta tiene una versión más reciente'
      : 'No fue posible guardar el acta');
  }
}

export function createOutboxManager(actas: ActaRepository) {
  let unsubscribe: (() => void) | null = null;
  let retryTimer: ReturnType<typeof setInterval> | null = null;
  let startCount = 0;
  let isFlushing = false;

  function notify(): void {
    notifyOutboxListeners();
  }

  function subscribe(listener: () => void): () => void {
    outboxListeners.add(listener);
    return () => {
      outboxListeners.delete(listener);
    };
  }

  async function refreshSnapshot(): Promise<OutboxSnapshot | null> {
    try {
      return await getOutboxSnapshot();
    } catch {
      return null;
    }
  }

  async function syncConflicts(actorId: string): Promise<void> {
    const conflicts = await listUnsyncedLocalConflicts();
    for (const conflict of conflicts) {
      const result = await actas.recordConflict({
        id: conflict.id,
        actaId: conflict.actaId,
        mesaId: conflict.mesaId,
        dignidad: conflict.dignity,
        baseVersion: conflict.baseVersion,
        localVersion: conflict.localVersion,
        remoteVersion: conflict.remoteVersion,
        detectedBy: actorId,
        payload: conflict.payload,
        status: conflict.status,
        reviewedBy: null,
        resolution: null,
        resolvedAt: conflict.resolvedAt,
        createdAt: conflict.createdAt,
      });
      if (!result.ok) {
        captureError(new Error(result.error.code), {
          scope: 'outbox.syncConflict',
          conflictId: conflict.id,
        });
        continue;
      }
      await markLocalConflictSynced(conflict.id);
    }
  }

  async function flushPending(): Promise<Result<number>> {
    if (isFlushing) {
      return ok(0);
    }

    isFlushing = true;

    try {
      await initializeLocalDatabase();
      const network = await NetInfo.fetch();
      if (!network.isConnected) {
        return ok(0);
      }

      const actorId = await getCurrentAuthUserId();
      if (!actorId) {
        return failure('USUARIO_NO_AUTENTICADO', 'Inicie sesión para sincronizar las actas');
      }

      await syncConflicts(actorId);
      const operations = await claimPendingOperations(5);
      let synced = 0;

      for (const operation of operations) {
        let payload: SaveActaOfflineInput;
        try {
          payload = JSON.parse(operation.payload) as SaveActaOfflineInput;
          payload.operationId = operation.operationId;
        } catch {
          await markOutboxOperation(operation.operationId, 'fallado', {
            error: 'PAYLOAD_INVALIDO',
            retryDelayMs: 60000,
          });
          continue;
        }

        try {
          if (isLocalPhotoPath(payload.fotoPath) && !remotePhotoPath(payload)) {
            const uploaded = await uploadActaPhoto({
              userId: actorId,
              actaId: operation.actaId,
              operationId: operation.operationId,
              localPath: payload.fotoPath,
            });
            if (!uploaded.ok) {
              captureError(new Error(uploaded.error.code), {
                scope: 'outbox.upload',
                operationId: operation.operationId,
                actaId: operation.actaId,
              });
              await markOutboxOperation(operation.operationId, 'fallado', {
                error: 'No fue posible subir la fotografía del acta.',
                retryDelayMs: 30000,
              });
              continue;
            }
            payload.storagePath = uploaded.value;
            await updateOutboxPayload(operation.operationId, payload);
          }

          const result = await actas.save(toDraft(payload), actorId);
          if (!result.ok) {
            if (result.error.code === 'CONFLICTO_EDICION_OFFLINE') {
              const remote = await actas.getByMesaAndDignidad(payload.mesaId, payload.dignity);
              const remoteVersion = remote.ok ? (remote.value?.version ?? payload.expectedVersion + 1) : payload.expectedVersion + 1;
              await recordActaConflict({
                id: operation.operationId,
                ...conflictFromPayload(payload, remoteVersion),
              });
              const remoteConflict = await actas.recordConflict({
                id: operation.operationId,
                actaId: remote.ok ? (remote.value?.id ?? null) : null,
                mesaId: payload.mesaId,
                dignidad: payload.dignity,
                baseVersion: payload.expectedVersion,
                localVersion: payload.expectedVersion + 1,
                remoteVersion,
                detectedBy: actorId,
                payload,
                status: 'detectado',
                reviewedBy: null,
                resolution: null,
                resolvedAt: null,
                createdAt: new Date().toISOString(),
              });
              if (!remoteConflict.ok) {
                captureError(new Error(remoteConflict.error.code), {
                  scope: 'outbox.recordConflict',
                  operationId: operation.operationId,
                  actaId: operation.actaId,
                });
              } else {
                await markLocalConflictSynced(operation.operationId);
              }
              await markOutboxOperation(operation.operationId, 'fallado', {
                error: result.error.message,
                terminal: true,
              });
            } else {
              await markOutboxOperation(operation.operationId, 'fallado', {
                error: result.error.message,
                retryDelayMs: 30000,
              });
            }
            continue;
          }

          await markOutboxOperation(operation.operationId, 'guardado', {
            remoteId: result.value.id,
          });
          synced += 1;
        } catch (error) {
          captureError(new Error('ERROR_PROCESAR_OUTBOX'), {
            scope: 'outbox.flushOperation',
            operationId: operation.operationId,
            actaId: operation.actaId,
          });
          await markOutboxOperation(operation.operationId, 'fallado', {
            error: error instanceof Error ? error.message : 'ERROR_SINCRONIZACION',
            retryDelayMs: 30000,
          });
        }
      }

      return ok(synced);
    } catch (error) {
      captureError(error, { scope: 'outbox.flush' });
      return failure('ERROR_SINCRONIZACION', 'No fue posible completar la sincronización');
    } finally {
      isFlushing = false;
      notify();
    }
  }

  return {
    async start(): Promise<void> {
      startCount += 1;
      if (startCount > 1) {
        return;
      }

      try {
        await initializeLocalDatabase();
        await flushPending();
        if (startCount === 0) {
          return;
        }
        unsubscribe = NetInfo.addEventListener((state) => {
          if (state.isConnected) {
            void flushPending();
          }
        });
        retryTimer = setInterval(() => {
          void flushPending();
        }, OUTBOX_RETRY_INTERVAL_MS);
      } catch (error) {
        captureError(error, { scope: 'outbox.start' });
        notify();
      }
    },

    stop(): void {
      if (startCount === 0) {
        return;
      }
      startCount -= 1;
      if (startCount > 0) {
        return;
      }

      unsubscribe?.();
      unsubscribe = null;
      if (retryTimer) {
        clearInterval(retryTimer);
        retryTimer = null;
      }
    },

    flushPending,
    refreshSnapshot,
    subscribe,
  };
}

export type OutboxManager = ReturnType<typeof createOutboxManager>;
