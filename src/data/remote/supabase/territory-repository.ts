import { ok, type Result } from '@/core/result/result';
import type { Mesa } from '@/domain/election/mesa';
import type { CreateRecintoInput, Recinto } from '@/domain/election/recinto';
import type { TerritoryRepository } from '@/domain/repositories/territory-repository';

import { supabase } from './client';
import { toFailure } from './errors';
import { mapMesa, mapRecinto, type MesaRow, type RecintoRow } from './mappers';

export function createSupabaseTerritoryRepository(): TerritoryRepository {
  return {
    async listRecintos(): Promise<Result<Recinto[]>> {
      try {
        const { data, error } = await supabase
          .from('recintos')
          .select('*')
          .eq('active', true)
          .order('name', { ascending: true });
        if (error) {
          throw error;
        }
        return ok((data ?? []).map((row) => mapRecinto(row as RecintoRow)));
      } catch (error) {
        return toFailure(error, 'ERROR_LISTAR_RECINTOS');
      }
    },

    async getRecinto(recintoId): Promise<Result<Recinto | null>> {
      try {
        const { data, error } = await supabase
          .from('recintos')
          .select('*')
          .eq('id', recintoId)
          .maybeSingle();
        if (error) {
          throw error;
        }
        return ok(data ? mapRecinto(data as RecintoRow) : null);
      } catch (error) {
        return toFailure(error, 'ERROR_CONSULTAR_RECANTO');
      }
    },

    async createRecinto(input: CreateRecintoInput): Promise<Result<Recinto>> {
      try {
        const { data, error } = await supabase
          .from('recintos')
          .insert({
            code: input.code,
            name: input.name,
            address: input.address,
            province: input.province,
            canton: input.canton,
            parish: input.parish,
            gps_lat: input.gpsLat,
            gps_lng: input.gpsLng,
            radius_meters: input.radiusMeters,
            active: true,
          })
          .select('*')
          .single();
        if (error || !data) {
          throw error ?? new Error('No fue posible registrar el recinto');
        }
        return ok(mapRecinto(data as RecintoRow));
      } catch (error) {
        return toFailure(error, 'ERROR_CREAR_RECINTO');
      }
    },

    async setRecintoCoordinator(recintoId, coordinadorId): Promise<Result<Recinto>> {
      try {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ recinto_id: recintoId, updated_at: new Date().toISOString() })
          .eq('id', coordinadorId);
        if (profileError) {
          throw profileError;
        }

        const { data, error: recintoError } = await supabase
          .from('recintos')
          .select('*')
          .eq('id', recintoId)
          .single();
        if (recintoError || !data) {
          throw recintoError ?? new Error('No fue posible consultar el recinto');
        }
        return ok(mapRecinto(data as RecintoRow));
      } catch (error) {
        return toFailure(error, 'ERROR_ASIGNAR_COORDINADOR');
      }
    },

    async listMesas(recintoId): Promise<Result<Mesa[]>> {
      try {
        let query = supabase
          .from('mesas')
          .select('*')
          .eq('active', true)
          .order('number', { ascending: true });
        if (recintoId) {
          query = query.eq('recinto_id', recintoId);
        }
        const { data, error } = await query;
        if (error) {
          throw error;
        }
        return ok((data ?? []).map((row) => mapMesa(row as MesaRow)));
      } catch (error) {
        return toFailure(error, 'ERROR_LISTAR_MESAS');
      }
    },

    async getMesa(mesaId): Promise<Result<Mesa | null>> {
      try {
        const { data, error } = await supabase
          .from('mesas')
          .select('*')
          .eq('id', mesaId)
          .maybeSingle();
        if (error) {
          throw error;
        }
        return ok(data ? mapMesa(data as MesaRow) : null);
      } catch (error) {
        return toFailure(error, 'ERROR_CONSULTAR_MESA');
      }
    },
  };
}
