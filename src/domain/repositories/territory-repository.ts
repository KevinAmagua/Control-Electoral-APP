import type { Result } from '../../core/result/result';
import type { Mesa } from '../election/mesa';
import type { CreateRecintoInput, Recinto } from '../election/recinto';

export interface TerritoryRepository {
  listRecintos(): Promise<Result<Recinto[]>>;
  getRecinto(recintoId: string): Promise<Result<Recinto | null>>;
  createRecinto(input: CreateRecintoInput): Promise<Result<Recinto>>;
  setRecintoCoordinator(recintoId: string, coordinadorId: string): Promise<Result<Recinto>>;
  listMesas(recintoId?: string): Promise<Result<Mesa[]>>;
  getMesa(mesaId: string): Promise<Result<Mesa | null>>;
}
