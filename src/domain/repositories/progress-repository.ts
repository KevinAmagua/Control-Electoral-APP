import type { Result } from '../../core/result/result';
import type { Acta } from '../acta/acta';
import type { Mesa } from '../election/mesa';
import type { Recinto } from '../election/recinto';

export type ProgressSnapshot = {
  mesas: Mesa[];
  actas: Acta[];
  recintos: Recinto[];
};

export interface ProgressRepository {
  getSnapshot(filter: { recintoId?: string }): Promise<Result<ProgressSnapshot>>;
}
