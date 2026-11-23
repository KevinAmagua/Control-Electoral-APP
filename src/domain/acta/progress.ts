import type { Acta } from './acta';
import type { Dignity } from '../election/dignity';
import type { Mesa } from '../election/mesa';
import type { Recinto } from '../election/recinto';

export type MesaProgressStatus = 'sin_reportar' | 'parcial' | 'completa';

export type MesaProgress = {
  mesaId: string;
  recintoId: string | null;
  number: string;
  registeredVoters: number;
  hasAlcaldia: boolean;
  hasPrefectura: boolean;
  status: MesaProgressStatus;
};

export type RecintoProgress = {
  recintoId: string;
  code: string;
  name: string;
  totalMesas: number;
  mesasCompletas: number;
  mesasParciales: number;
  mesasFaltantes: number;
};

export type ScrutinyProgress = {
  totalMesas: number;
  mesasReportadas: number;
  mesasCompletas: number;
  mesasParciales: number;
  mesasFaltantes: number;
  porRecinto: RecintoProgress[];
};

export type VoteCount = {
  organizationId: string;
  candidateId: string;
  dignidad: Dignity;
  votos: number;
};

const REPORTED_STATUS = 'guardado';

export function getMesaProgress(mesa: Mesa, actas: readonly Acta[]): MesaProgress {
  const actasGuardadas = actas.filter((acta) => acta.mesaId === mesa.id && acta.estado === REPORTED_STATUS);
  const hasAlcaldia = actasGuardadas.some((acta) => acta.dignidad === 'alcaldia');
  const hasPrefectura = actasGuardadas.some((acta) => acta.dignidad === 'prefectura');

  const status: MesaProgressStatus =
    hasAlcaldia && hasPrefectura ? 'completa' : hasAlcaldia || hasPrefectura ? 'parcial' : 'sin_reportar';

  return {
    mesaId: mesa.id,
    recintoId: mesa.recintoId ?? null,
    number: mesa.number,
    registeredVoters: mesa.registeredVoters,
    hasAlcaldia,
    hasPrefectura,
    status,
  };
}

export function computeScrutinyProgress(
  mesas: readonly Mesa[],
  actas: readonly Acta[],
  recintos: readonly Recinto[],
): ScrutinyProgress {
  const avances = mesas.filter((mesa) => mesa.active !== false).map((mesa) => getMesaProgress(mesa, actas));
  const mesasCompletas = avances.filter((avance) => avance.status === 'completa').length;
  const mesasParciales = avances.filter((avance) => avance.status === 'parcial').length;
  const mesasFaltantes = avances.filter((avance) => avance.status === 'sin_reportar').length;

  const porRecinto = recintos.map((recinto) => {
    const avancesRecinto = avances.filter((avance) => avance.recintoId === recinto.id);
    return {
      recintoId: recinto.id,
      code: recinto.code,
      name: recinto.name,
      totalMesas: avancesRecinto.length,
      mesasCompletas: avancesRecinto.filter((avance) => avance.status === 'completa').length,
      mesasParciales: avancesRecinto.filter((avance) => avance.status === 'parcial').length,
      mesasFaltantes: avancesRecinto.filter((avance) => avance.status === 'sin_reportar').length,
    };
  });

  return {
    totalMesas: avances.length,
    mesasReportadas: mesasCompletas + mesasParciales,
    mesasCompletas,
    mesasParciales,
    mesasFaltantes,
    porRecinto,
  };
}

export function computeVoteCounts(actas: readonly Acta[]): VoteCount[] {
  const totals = new Map<string, VoteCount>();

  for (const acta of actas) {
    if (acta.estado !== REPORTED_STATUS) {
      continue;
    }

    for (const detalle of acta.votos) {
      const key = `${acta.dignidad}:${detalle.organizationId}:${detalle.candidateId}`;
      const actual = totals.get(key) ?? {
        organizationId: detalle.organizationId,
        candidateId: detalle.candidateId,
        dignidad: acta.dignidad,
        votos: 0,
      };
      actual.votos += detalle.votos;
      totals.set(key, actual);
    }
  }

  return [...totals.values()].sort((a, b) =>
    a.dignidad.localeCompare(b.dignidad) || b.votos - a.votos,
  );
}
