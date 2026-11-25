import type { Result } from '../../core/result/result';
import type { Acta, ActaDraft } from '../acta/acta';
import type { Dignity } from '../election/dignity';
import type { SyncConflict } from '../sync/operation';

export interface ActaRepository {
  getById(actaId: string): Promise<Result<Acta | null>>;
  getByMesaAndDignidad(mesaId: string, dignidad: Dignity): Promise<Result<Acta | null>>;
  listByMesa(mesaId: string): Promise<Result<Acta[]>>;
  listByRecinto(recintoId: string): Promise<Result<Acta[]>>;
  listAll(): Promise<Result<Acta[]>>;
  save(draft: ActaDraft, registeredBy: string): Promise<Result<Acta>>;
  correct(actaId: string, draft: ActaDraft, correctedBy: string): Promise<Result<Acta>>;
  recordConflict(conflict: SyncConflict): Promise<Result<void>>;
  listConflicts(recintoId?: string): Promise<Result<SyncConflict[]>>;
  resolveConflict(
    conflictId: string,
    resolution: unknown,
    reviewedBy: string,
  ): Promise<Result<SyncConflict>>;
  subscribeToActas(listener: () => void): () => void;
  subscribeToConflicts(listener: () => void): () => void;
}
