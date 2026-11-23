import type { ActaStatus } from './acta-status';
import type { Dignity } from '../election/dignity';

export type VoteDetail = {
  organizationId: string;
  candidateId: string;
  votos: number;
};

export type Acta = {
  id: string;
  mesaId: string;
  dignidad: Dignity;
  version: number;
  estado: ActaStatus;
  registradoPor: string | null;
  corregidoPor: string | null;
  gpsLat: number;
  gpsLng: number;
  gpsPrecision: number;
  fotoPath: string;
  totalSufragantes: number;
  votosValidos: number;
  votosBlancos: number;
  votosNulos: number;
  observaciones: string | null;
  operacionClienteId: string;
  createdAt: string;
  updatedAt: string;
  votos: VoteDetail[];
};

export type ActaDraft = {
  mesaId: string;
  dignidad: Dignity;
  expectedVersion: number;
  totalSufragantes: number;
  votosValidos: number;
  votosBlancos: number;
  votosNulos: number;
  gpsLat: number;
  gpsLng: number;
  gpsPrecision: number;
  fotoPath: string;
  observaciones?: string;
  operacionClienteId: string;
  votos: VoteDetail[];
};
