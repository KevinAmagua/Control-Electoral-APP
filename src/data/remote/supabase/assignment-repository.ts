import { ok, type Result } from '@/core/result/result';
import type { Assignment } from '@/domain/election/assignment';
import type {
  AssignmentRepository,
  AssignMesaInput,
  AssignMesasInput,
  ReplaceVeedorRecord,
} from '@/domain/repositories/assignment-repository';

import { supabase } from './client';
import { toFailure } from './errors';
import { mapAssignment, type AssignmentRow } from './mappers';

export function createSupabaseAssignmentRepository(): AssignmentRepository {
  return {
    async listByMesa(mesaId): Promise<Result<Assignment[]>> {
      try {
        const { data, error } = await supabase
          .from('assignments')
          .select('*')
          .eq('mesa_id', mesaId)
          .order('assigned_at', { ascending: false });
        if (error) {
          throw error;
        }
        return ok((data ?? []).map((row) => mapAssignment(row as AssignmentRow)));
      } catch (error) {
        return toFailure(error, 'ERROR_LISTAR_ASIGNACIONES');
      }
    },

    async listByVeedor(veedorId): Promise<Result<Assignment[]>> {
      try {
        const { data, error } = await supabase
          .from('assignments')
          .select('*')
          .eq('veedor_id', veedorId)
          .order('assigned_at', { ascending: false });
        if (error) {
          throw error;
        }
        return ok((data ?? []).map((row) => mapAssignment(row as AssignmentRow)));
      } catch (error) {
        return toFailure(error, 'ERROR_LISTAR_ASIGNACIONES');
      }
    },

    async getActiveByMesa(mesaId): Promise<Result<Assignment | null>> {
      try {
        const { data, error } = await supabase
          .from('assignments')
          .select('*')
          .eq('mesa_id', mesaId)
          .eq('active', true)
          .maybeSingle();
        if (error) {
          throw error;
        }
        return ok(data ? mapAssignment(data as AssignmentRow) : null);
      } catch (error) {
        return toFailure(error, 'ERROR_CONSULTAR_ASIGNACION');
      }
    },

    async assign(input: AssignMesaInput): Promise<Result<Assignment>> {
      const result = await this.assignMany({
        mesaIds: [input.mesaId],
        veedorId: input.veedorId,
        assignedBy: input.assignedBy,
        reason: input.reason,
      });
      if (!result.ok) {
        return result;
      }
      const assignment = result.value[0];
      if (!assignment) {
        return toFailure(new Error('No fue posible asignar el veedor'), 'ERROR_ASIGNAR_VEEDOR');
      }
      return ok(assignment);
    },

    async assignMany(input: AssignMesasInput): Promise<Result<Assignment[]>> {
      try {
        const { data, error } = await supabase.rpc('asignar_veedor', {
          p_mesa_ids: input.mesaIds,
          p_veedor_id: input.veedorId,
          p_reason: input.reason,
        });
        if (error) {
          throw error;
        }
        const rows = (Array.isArray(data) ? data : []) as AssignmentRow[];
        if (rows.length !== input.mesaIds.length) {
          throw new Error('No fue posible asignar todas las mesas');
        }
        return ok(rows.map((row) => mapAssignment(row)));
      } catch (error) {
        return toFailure(error, 'ERROR_ASIGNAR_VEEDOR');
      }
    },

    async replace(input: ReplaceVeedorRecord): Promise<Result<Assignment[]>> {
      try {
        const { data, error } = await supabase.rpc('reemplazar_veedor', {
          p_mesa_ids: input.mesaIds,
          p_previous_veedor_id: input.previousVeedorId,
          p_next_veedor_id: input.nextVeedorId,
          p_reason: input.reason,
        });
        if (error) {
          throw error;
        }
        const rows = (Array.isArray(data) ? data : []) as AssignmentRow[];
        return ok(rows.map((row) => mapAssignment(row)));
      } catch (error) {
        return toFailure(error, 'ERROR_REEMPLAZAR_VEEDOR');
      }
    },
  };
}
