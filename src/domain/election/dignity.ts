export const DIGNITIES = ['alcaldia', 'prefectura'] as const;

export type Dignity = (typeof DIGNITIES)[number];

export const DIGNITY_LABELS: Record<Dignity, string> = {
  alcaldia: 'Alcaldía',
  prefectura: 'Prefectura',
};
