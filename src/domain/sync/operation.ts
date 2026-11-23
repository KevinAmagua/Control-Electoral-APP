import type { Dignity } from '../election/dignity';

export const OPERATION_STATUSES = ['pendiente', 'en_proceso', 'guardado', 'fallado'] as const;

export type OperationStatus = (typeof OPERATION_STATUSES)[number];

export type OutboxOperation = {
  id: string;
  operationId: string;
  actaId: string;
  status: OperationStatus;
  attemptCount: number;
  payload: string;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  nextAttemptAt: string | null;
};

export const CONFLICT_STATUSES = ['detectado', 'en_revision', 'resuelto', 'descartado'] as const;

export type ConflictStatus = (typeof CONFLICT_STATUSES)[number];

export type SyncConflict = {
  id: string;
  actaId: string | null;
  mesaId: string;
  dignidad: Dignity;
  baseVersion: number;
  localVersion: number;
  remoteVersion: number;
  detectedBy: string | null;
  payload: unknown;
  status: ConflictStatus;
  reviewedBy: string | null;
  resolution: unknown;
  resolvedAt: string | null;
  createdAt: string;
};
