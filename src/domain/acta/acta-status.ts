export const ACTA_STATUSES = ['en_proceso', 'guardado', 'fallado'] as const;

export type ActaStatus = (typeof ACTA_STATUSES)[number];

export const ACTA_STATUS_LABELS: Record<ActaStatus, string> = {
  en_proceso: 'En proceso',
  guardado: 'Guardado',
  fallado: 'Falló',
};
