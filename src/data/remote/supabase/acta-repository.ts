import { failure, ok, type Result } from '@/core/result/result';
import type { Acta, ActaDraft, VoteDetail } from '@/domain/acta/acta';
import type { Dignity } from '@/domain/election/dignity';
import type { ActaRepository } from '@/domain/repositories/acta-repository';
import type { SyncConflict } from '@/domain/sync/operation';
import { actaDraftSchema } from '@/domain/validation/acta';

import { supabase } from './client';
import { errorMessage, toFailure } from './errors';
import {
  mapActa,
  mapConflict,
  mapVoteDetail,
  type ActaRow,
  type ConflictRow,
  type VoteDetailRow,
} from './mappers';

function votesToJson(votes: VoteDetail[]): Record<string, number> {
  return votes.reduce<Record<string, number>>((acc, vote) => {
    acc[vote.candidateId] = vote.votos;
    return acc;
  }, {});
}

type ConflictPayload = Partial<{
  expectedVersion: number;
  totalSufragantes: number;
  votosValidos: number;
  votosBlancos: number;
  votosNulos: number;
  gpsLat: number;
  gpsLng: number;
  gpsPrecision: number;
  fotoPath: string;
  storagePath: string;
  observaciones: string;
  votes: VoteDetail[];
  votos: VoteDetail[];
}>;

function draftFromConflict(conflict: SyncConflict): ActaDraft {
  const payload = (conflict.payload ?? {}) as ConflictPayload;
  const photoPath =
    typeof payload.storagePath === 'string' &&
    payload.storagePath.length > 0 &&
    !payload.storagePath.startsWith('file://')
      ? payload.storagePath
      : (payload.fotoPath ?? '');

  return {
    mesaId: conflict.mesaId,
    dignidad: conflict.dignidad,
    expectedVersion: conflict.remoteVersion,
    totalSufragantes: payload.totalSufragantes ?? 0,
    votosValidos: payload.votosValidos ?? 0,
    votosBlancos: payload.votosBlancos ?? 0,
    votosNulos: payload.votosNulos ?? 0,
    gpsLat: payload.gpsLat ?? 0,
    gpsLng: payload.gpsLng ?? 0,
    gpsPrecision: payload.gpsPrecision ?? 0,
    fotoPath: photoPath,
    observaciones: payload.observaciones,
    operacionClienteId: conflict.id,
    votos: payload.votes ?? payload.votos ?? [],
  };
}

async function fetchVotesMap(actaIds: string[]): Promise<Map<string, VoteDetail[]>> {
  const result = new Map<string, VoteDetail[]>();
  if (actaIds.length === 0) {
    return result;
  }

  const { data, error } = await supabase
    .from('vote_details')
    .select('acta_id, organization_id, candidate_id, votos')
    .in('acta_id', actaIds);
  if (error) {
    throw error;
  }

  for (const row of data ?? []) {
    const typed = row as VoteDetailRow;
    const votes = result.get(typed.acta_id) ?? [];
    votes.push(mapVoteDetail(typed));
    result.set(typed.acta_id, votes);
  }
  return result;
}

async function mapActas(rows: ActaRow[]): Promise<Acta[]> {
  const votesMap = await fetchVotesMap(rows.map((row) => row.id));
  return rows.map((row) => mapActa(row, votesMap.get(row.id) ?? []));
}

async function registerViaRpc(draft: ActaDraft): Promise<Acta> {
  const { data, error } = await supabase.rpc('registrar_acta', {
    p_operacion_cliente_id: draft.operacionClienteId,
    p_mesa_id: draft.mesaId,
    p_dignidad: draft.dignidad,
    p_version_esperada: draft.expectedVersion,
    p_total_sufragantes: draft.totalSufragantes,
    p_votos_validos: draft.votosValidos,
    p_votos_blancos: draft.votosBlancos,
    p_votos_nulos: draft.votosNulos,
    p_gps_lat: draft.gpsLat,
    p_gps_lng: draft.gpsLng,
    p_gps_precision: draft.gpsPrecision,
    p_foto_path: draft.fotoPath,
    p_observaciones: draft.observaciones ?? null,
    p_votos: votesToJson(draft.votos),
  });

  if (error || !data) {
    throw error ?? new Error('No fue posible registrar el acta');
  }

  const row = data as ActaRow;
  const votes = await fetchVotesMap([row.id]);
  return mapActa(row, votes.get(row.id) ?? []);
}

export function createSupabaseActaRepository(): ActaRepository {
  return {
    async getById(actaId): Promise<Result<Acta | null>> {
      try {
        const { data, error } = await supabase
          .from('actas')
          .select('*')
          .eq('id', actaId)
          .maybeSingle();
        if (error) {
          throw error;
        }
        if (!data) {
          return ok(null);
        }
        const votes = await fetchVotesMap([actaId]);
        return ok(mapActa(data as ActaRow, votes.get(actaId) ?? []));
      } catch (error) {
        return toFailure(error, 'ERROR_CONSULTAR_ACTA');
      }
    },

    async getByMesaAndDignidad(mesaId, dignidad: Dignity): Promise<Result<Acta | null>> {
      try {
        const { data, error } = await supabase
          .from('actas')
          .select('*')
          .eq('mesa_id', mesaId)
          .eq('dignidad', dignidad)
          .maybeSingle();
        if (error) {
          throw error;
        }
        if (!data) {
          return ok(null);
        }
        const row = data as ActaRow;
        const votes = await fetchVotesMap([row.id]);
        return ok(mapActa(row, votes.get(row.id) ?? []));
      } catch (error) {
        return toFailure(error, 'ERROR_CONSULTAR_ACTA');
      }
    },

    async listByMesa(mesaId): Promise<Result<Acta[]>> {
      try {
        const { data, error } = await supabase
          .from('actas')
          .select('*')
          .eq('mesa_id', mesaId);
        if (error) {
          throw error;
        }
        return ok(await mapActas((data ?? []) as ActaRow[]));
      } catch (error) {
        return toFailure(error, 'ERROR_LISTAR_ACTAS');
      }
    },

    async listByRecinto(recintoId): Promise<Result<Acta[]>> {
      try {
        const { data: mesas, error: mesasError } = await supabase
          .from('mesas')
          .select('id')
          .eq('recinto_id', recintoId);
        if (mesasError) {
          throw mesasError;
        }
        const mesaIds = (mesas ?? []).map((row) => row.id as string);
        if (mesaIds.length === 0) {
          return ok([]);
        }
        const { data, error } = await supabase
          .from('actas')
          .select('*')
          .in('mesa_id', mesaIds);
        if (error) {
          throw error;
        }
        return ok(await mapActas((data ?? []) as ActaRow[]));
      } catch (error) {
        return toFailure(error, 'ERROR_LISTAR_ACTAS');
      }
    },

    async listAll(): Promise<Result<Acta[]>> {
      try {
        const { data, error } = await supabase.from('actas').select('*');
        if (error) {
          throw error;
        }
        return ok(await mapActas((data ?? []) as ActaRow[]));
      } catch (error) {
        return toFailure(error, 'ERROR_LISTAR_ACTAS');
      }
    },

    async save(draft, registeredBy): Promise<Result<Acta>> {
      try {
        if (!registeredBy) {
          throw new Error('USUARIO_NO_AUTENTICADO');
        }
        return ok(await registerViaRpc(draft));
      } catch (error) {
        return {
          ok: false,
          error: {
            code: errorMessage(error).includes('CONFLICTO_EDICION_OFFLINE')
              ? 'CONFLICTO_EDICION_OFFLINE'
              : 'ERROR_GUARDAR_ACTA',
            message: errorMessage(error),
          },
        };
      }
    },

    async correct(actaId, draft, correctedBy): Promise<Result<Acta>> {
      try {
        if (!correctedBy) {
          throw new Error('USUARIO_NO_AUTENTICADO');
        }
        const current = await this.getById(actaId);
        if (!current.ok) {
          return current;
        }
        if (!current.value) {
          return { ok: false, error: { code: 'ACTA_NO_EXISTE', message: 'El acta no existe' } };
        }
        return ok(await registerViaRpc(draft));
      } catch (error) {
        return toFailure(error, 'ERROR_CORREGIR_ACTA');
      }
    },

    async recordConflict(conflict: SyncConflict): Promise<Result<void>> {
      try {
        const { error } = await supabase.from('acta_edit_conflicts').upsert(
          {
            id: conflict.id,
            acta_id: conflict.actaId,
            mesa_id: conflict.mesaId,
            dignidad: conflict.dignidad,
            base_version: conflict.baseVersion,
            local_version: conflict.localVersion,
            remote_version: conflict.remoteVersion,
            detected_by: conflict.detectedBy,
            payload: conflict.payload ?? {},
            status: conflict.status,
            reviewed_by: conflict.reviewedBy,
            resolution: conflict.resolution,
            resolved_at: conflict.resolvedAt,
            created_at: conflict.createdAt,
          },
          { onConflict: 'id', ignoreDuplicates: true },
        );
        if (error) {
          throw error;
        }
        return ok(undefined);
      } catch (error) {
        return toFailure(error, 'ERROR_REGISTRAR_CONFLICTO');
      }
    },

    async listConflicts(recintoId): Promise<Result<SyncConflict[]>> {
      try {
        let query = supabase
          .from('acta_edit_conflicts')
          .select('*')
          .order('created_at', { ascending: false });
        if (recintoId) {
          const { data: mesas, error: mesasError } = await supabase
            .from('mesas')
            .select('id')
            .eq('recinto_id', recintoId);
          if (mesasError) {
            throw mesasError;
          }
          const mesaIds = (mesas ?? []).map((row) => row.id as string);
          if (mesaIds.length === 0) {
            return ok([]);
          }
          query = query.in('mesa_id', mesaIds);
        }
        const { data, error } = await query;
        if (error) {
          throw error;
        }
        return ok((data ?? []).map((row) => mapConflict(row as ConflictRow)));
      } catch (error) {
        return toFailure(error, 'ERROR_LISTAR_CONFLICTOS');
      }
    },

    async resolveConflict(
      conflictId,
      resolution,
      reviewedBy,
    ): Promise<Result<SyncConflict>> {
      try {
        const { data: existing, error: existingError } = await supabase
          .from('acta_edit_conflicts')
          .select('*')
          .eq('id', conflictId)
          .maybeSingle();
        if (existingError) {
          throw existingError;
        }
        if (!existing) {
          return failure('CONFLICTO_NO_EXISTE', 'El conflicto no existe');
        }

        const conflict = mapConflict(existing as ConflictRow);
        const source =
          typeof resolution === 'object' && resolution !== null
            ? (resolution as { fuente?: unknown }).fuente
            : undefined;
        if (source === 'local') {
          const parsed = actaDraftSchema.safeParse(draftFromConflict(conflict));
          if (!parsed.success) {
            return failure('RESOLUCION_PAYLOAD_INVALIDO', 'No fue posible reaplicar la versión local del acta');
          }
          await registerViaRpc(parsed.data);
        }

        const { data, error } = await supabase
          .from('acta_edit_conflicts')
          .update({
            status: 'resuelto',
            resolution,
            reviewed_by: reviewedBy,
            resolved_at: new Date().toISOString(),
          })
          .eq('id', conflictId)
          .select('*')
          .single();
        if (error || !data) {
          throw error ?? new Error('No fue posible resolver el conflicto');
        }
        return ok(mapConflict(data as ConflictRow));
      } catch (error) {
        return toFailure(error, 'ERROR_RESOLVER_CONFLICTO');
      }
    },
  };
}
