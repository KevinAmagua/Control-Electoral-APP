import type { Result } from '../../core/result/result';
import type { Assignment, ReplaceVeedorInput } from '../election/assignment';

export type AssignMesaInput = {
  mesaId: string;
  veedorId: string;
  assignedBy: string;
  reason: string | null;
};

export type AssignMesasInput = Omit<AssignMesaInput, 'mesaId'> & {
  mesaIds: string[];
};

export type ReplaceVeedorRecord = ReplaceVeedorInput & {
  assignedBy: string;
};

export interface AssignmentRepository {
  listByMesa(mesaId: string): Promise<Result<Assignment[]>>;
  listByVeedor(veedorId: string): Promise<Result<Assignment[]>>;
  getActiveByMesa(mesaId: string): Promise<Result<Assignment | null>>;
  assign(input: AssignMesaInput): Promise<Result<Assignment>>;
  assignMany(input: AssignMesasInput): Promise<Result<Assignment[]>>;
  replace(input: ReplaceVeedorRecord): Promise<Result<Assignment[]>>;
}
