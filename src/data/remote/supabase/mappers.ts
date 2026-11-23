import type { Acta, VoteDetail } from '@/domain/acta/acta';
import type { ActaStatus } from '@/domain/acta/acta-status';
import type { Assignment } from '@/domain/election/assignment';
import type { Dignity } from '@/domain/election/dignity';
import type { Mesa } from '@/domain/election/mesa';
import type { Recinto } from '@/domain/election/recinto';
import type { SyncConflict } from '@/domain/sync/operation';
import type { UserProfile } from '@/domain/user/profile';
import { isRole } from '@/domain/user/role';

export type ProfileRow = {
  id: string;
  role: string;
  cedula: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string;
  email_verified: boolean;
  must_change_password: boolean;
  recinto_id: string | null;
  province: string | null;
  canton: string | null;
  active: boolean;
};

export type RecintoRow = {
  id: string;
  code: string;
  name: string;
  address: string;
  province: string;
  canton: string;
  parish: string | null;
  gps_lat: number;
  gps_lng: number;
  radius_meters: number;
  active: boolean;
};

export type MesaRow = {
  id: string;
  recinto_id: string;
  number: string;
  registered_voters: number;
  location: string | null;
  active: boolean;
};

export type AssignmentRow = {
  id: string;
  mesa_id: string;
  veedor_id: string;
  assigned_by: string | null;
  assigned_at: string;
  unassigned_at: string | null;
  active: boolean;
  replaces_assignment_id: string | null;
  reason: string | null;
};

export type ActaRow = {
  id: string;
  mesa_id: string;
  dignidad: Dignity;
  version: number;
  estado: ActaStatus;
  registrado_por: string | null;
  corregido_por: string | null;
  gps_lat: number;
  gps_lng: number;
  gps_precision: number;
  foto_path: string;
  total_sufragantes: number;
  votos_validos: number;
  votos_blancos: number;
  votos_nulos: number;
  observaciones: string | null;
  operacion_cliente_id: string;
  created_at: string;
  updated_at: string;
};

export type VoteDetailRow = {
  acta_id: string;
  organization_id: string;
  candidate_id: string;
  votos: number;
};

export type ConflictRow = {
  id: string;
  acta_id: string | null;
  mesa_id: string;
  dignidad: Dignity;
  base_version: number;
  local_version: number;
  remote_version: number;
  detected_by: string | null;
  payload: unknown;
  status: SyncConflict['status'];
  reviewed_by: string | null;
  resolution: unknown;
  resolved_at: string | null;
  created_at: string;
};

export function mapProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    role: isRole(row.role) ? row.role : 'veedor',
    cedula: row.cedula,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    email: row.email,
    emailVerified: row.email_verified,
    mustChangePassword: row.must_change_password,
    recintoId: row.recinto_id,
    province: row.province,
    canton: row.canton,
    active: row.active,
  };
}

export function mapRecinto(row: RecintoRow): Recinto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    address: row.address,
    province: row.province,
    canton: row.canton,
    parish: row.parish,
    gpsLat: row.gps_lat,
    gpsLng: row.gps_lng,
    radiusMeters: row.radius_meters,
    active: row.active,
  };
}

export function mapMesa(row: MesaRow): Mesa {
  return {
    id: row.id,
    recintoId: row.recinto_id,
    number: row.number,
    location: row.location ?? 'Sin ubicación registrada',
    registeredVoters: row.registered_voters,
    status: row.location ? 'verificada' : 'pendiente',
    active: row.active,
  };
}

export function mapAssignment(row: AssignmentRow): Assignment {
  return {
    id: row.id,
    mesaId: row.mesa_id,
    veedorId: row.veedor_id,
    assignedBy: row.assigned_by,
    assignedAt: row.assigned_at,
    unassignedAt: row.unassigned_at,
    active: row.active,
    replacesAssignmentId: row.replaces_assignment_id,
    reason: row.reason,
  };
}

export function mapVoteDetail(row: VoteDetailRow): VoteDetail {
  return {
    organizationId: row.organization_id,
    candidateId: row.candidate_id,
    votos: row.votos,
  };
}

export function mapActa(row: ActaRow, votes: VoteDetail[] = []): Acta {
  return {
    id: row.id,
    mesaId: row.mesa_id,
    dignidad: row.dignidad,
    version: row.version,
    estado: row.estado,
    registradoPor: row.registrado_por,
    corregidoPor: row.corregido_por,
    gpsLat: row.gps_lat,
    gpsLng: row.gps_lng,
    gpsPrecision: row.gps_precision,
    fotoPath: row.foto_path,
    totalSufragantes: row.total_sufragantes,
    votosValidos: row.votos_validos,
    votosBlancos: row.votos_blancos,
    votosNulos: row.votos_nulos,
    observaciones: row.observaciones,
    operacionClienteId: row.operacion_cliente_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    votos: votes,
  };
}

export function mapConflict(row: ConflictRow): SyncConflict {
  return {
    id: row.id,
    actaId: row.acta_id,
    mesaId: row.mesa_id,
    dignidad: row.dignidad,
    baseVersion: row.base_version,
    localVersion: row.local_version,
    remoteVersion: row.remote_version,
    detectedBy: row.detected_by,
    payload: row.payload,
    status: row.status,
    reviewedBy: row.reviewed_by,
    resolution: row.resolution,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
  };
}
