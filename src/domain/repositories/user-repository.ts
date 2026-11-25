import type { Result } from '../../core/result/result';
import type { CreateUserInput, UserProfile } from '../user/profile';

export type CreateUserRecord = CreateUserInput & {
  createdBy: string;
};

export type CreatedUserResult = {
  profile: UserProfile;
  temporaryPassword: string | null;
};

export interface UserRepository {
  getById(id: string): Promise<Result<UserProfile | null>>;
  getByEmail(email: string): Promise<Result<UserProfile | null>>;
  getByCedula(cedula: string): Promise<Result<UserProfile | null>>;
  listByRecinto(recintoId: string): Promise<Result<UserProfile[]>>;
  create(input: CreateUserRecord): Promise<Result<UserProfile>>;
  createWithTemporaryPassword(input: CreateUserRecord): Promise<Result<CreatedUserResult>>;
  deactivate(id: string): Promise<Result<void>>;
}
