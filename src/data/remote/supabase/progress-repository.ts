import { ok, type Result } from '@/core/result/result';
import type {
  ProgressRepository,
  ProgressSnapshot,
} from '@/domain/repositories/progress-repository';

import { createSupabaseActaRepository } from './acta-repository';
import { supabase } from './client';
import { toFailure } from './errors';
import { mapMesa, mapRecinto, type MesaRow, type RecintoRow } from './mappers';

export function createSupabaseProgressRepository(): ProgressRepository {
  const actas = createSupabaseActaRepository();

  return {
    async getSnapshot(filter: { recintoId?: string }): Promise<Result<ProgressSnapshot>> {
      try {
        let recintosQuery = supabase
          .from('recintos')
          .select('*')
          .eq('active', true)
          .order('name', { ascending: true });
        if (filter.recintoId) {
          recintosQuery = recintosQuery.eq('id', filter.recintoId);
        }

        let mesasQuery = supabase
          .from('mesas')
          .select('*')
          .eq('active', true)
          .order('number', { ascending: true });
        if (filter.recintoId) {
          mesasQuery = mesasQuery.eq('recinto_id', filter.recintoId);
        }

        const [recintosResult, mesasResult, actasResult] = await Promise.all([
          recintosQuery,
          mesasQuery,
          actas.listAll(),
        ]);
        if (recintosResult.error) {
          throw recintosResult.error;
        }
        if (mesasResult.error) {
          throw mesasResult.error;
        }
        if (!actasResult.ok) {
          return actasResult;
        }

        const filteredActas = filter.recintoId
          ? actasResult.value.filter((acta) =>
              (mesasResult.data ?? []).some((mesa) => (mesa as MesaRow).id === acta.mesaId),
            )
          : actasResult.value;

        return ok({
          recintos: (recintosResult.data ?? []).map((row) => mapRecinto(row as RecintoRow)),
          mesas: (mesasResult.data ?? []).map((row) => mapMesa(row as MesaRow)),
          actas: filteredActas,
        });
      } catch (error) {
        return toFailure(error, 'ERROR_CONSULTAR_PROGRESO');
      }
    },
  };
}
