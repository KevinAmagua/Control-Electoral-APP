import type { LocalOutboxStatus } from '@/data/local/sqliteClient';

export type SyncStatus = 'en_proceso' | 'guardado_local' | 'enviado' | 'fallado';

export const SYNC_STATUS_LABELS: Record<SyncStatus, string> = {
  en_proceso: 'En proceso',
  guardado_local: 'Guardado local',
  enviado: 'Enviado',
  fallado: 'Fallado',
};

const LOCAL_TO_SYNC_STATUS: Record<LocalOutboxStatus, SyncStatus> = {
  pendiente: 'guardado_local',
  en_proceso: 'en_proceso',
  guardado: 'enviado',
  fallado: 'fallado',
};

export function localOutboxStatusToSyncStatus(status: LocalOutboxStatus): SyncStatus {
  return LOCAL_TO_SYNC_STATUS[status];
}

export function describeSyncStatus(status: LocalOutboxStatus): string {
  return SYNC_STATUS_LABELS[LOCAL_TO_SYNC_STATUS[status]];
}
