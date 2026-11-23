import { createAssignVeedorUseCase } from '@/domain/usecases/assign-veedor';
import { createChangePasswordUseCase } from '@/domain/usecases/change-password';
import { createCorrectActaUseCase } from '@/domain/usecases/correct-acta';
import { createAccountUseCase } from '@/domain/usecases/create-account';
import { createGetProgressUseCase } from '@/domain/usecases/get-progress';
import { createLoginUseCase } from '@/domain/usecases/login';
import {
  createAssignRecintoCoordinatorUseCase,
  createListRecintosUseCase,
  createRecintoUseCase,
} from '@/domain/usecases/manage-recintos';
import { createRecoverPasswordUseCase } from '@/domain/usecases/recover-password';
import { createRegisterActaUseCase } from '@/domain/usecases/register-acta';
import { createResetPasswordUseCase } from '@/domain/usecases/reset-password';
import { createReplaceVeedorUseCase } from '@/domain/usecases/replace-veedor';
import { createResolveConflictUseCase } from '@/domain/usecases/resolve-conflict';

import { createSupabaseActaRepository } from './remote/supabase/acta-repository';
import { createSupabaseAssignmentRepository } from './remote/supabase/assignment-repository';
import { createSupabaseAuthRepository } from './remote/supabase/auth-repository';
import { createSupabaseProgressRepository } from './remote/supabase/progress-repository';
import { createSupabaseTerritoryRepository } from './remote/supabase/territory-repository';
import { createSupabaseUserRepository } from './remote/supabase/user-repository';
import { createOutboxManager } from './sync/outbox-manager';

export function createDataContainer() {
  const auth = createSupabaseAuthRepository();
  const users = createSupabaseUserRepository();
  const territory = createSupabaseTerritoryRepository();
  const assignments = createSupabaseAssignmentRepository();
  const actas = createSupabaseActaRepository();
  const progress = createSupabaseProgressRepository();
  const outbox = createOutboxManager(actas);

  const actaDependencies = { users, territory, assignments, actas };
  const assignmentDependencies = { users, territory, assignments };
  const territoryDependencies = { users, territory, assignments };

  return {
    repositories: { auth, users, territory, assignments, actas, progress },
    outbox,
    useCases: {
      login: createLoginUseCase(auth),
      changePassword: createChangePasswordUseCase(auth),
      resetPassword: createResetPasswordUseCase(auth),
      recoverPassword: createRecoverPasswordUseCase(auth, users),
      createAccount: createAccountUseCase(users),
      createRecinto: createRecintoUseCase(territoryDependencies),
      listRecintos: createListRecintosUseCase(territoryDependencies),
      assignRecintoCoordinator: createAssignRecintoCoordinatorUseCase(territoryDependencies),
      assignVeedor: createAssignVeedorUseCase(assignmentDependencies),
      replaceVeedor: createReplaceVeedorUseCase(assignmentDependencies),
      registerActa: createRegisterActaUseCase(actaDependencies),
      correctActa: createCorrectActaUseCase(actaDependencies),
      resolveConflict: createResolveConflictUseCase(actaDependencies),
      getProgress: createGetProgressUseCase(progress, users),
    },
  };
}

export type DataContainer = ReturnType<typeof createDataContainer>;

export const dataContainer = createDataContainer();
