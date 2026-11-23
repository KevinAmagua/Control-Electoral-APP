import type { Result } from '../../core/result/result';
import type { Acta, ActaDraft } from '../acta/acta';
import { validateActaDraft } from '../validation/acta';
import type { ActaContextDependencies } from './acta-context';
import { handleVersionConflict, loadActaContext } from './acta-context';

export type RegisterActaInput = ActaDraft & {
  actorId: string;
};

export function createRegisterActaUseCase(dependencies: ActaContextDependencies) {
  return async (input: RegisterActaInput): Promise<Result<Acta>> => {
    const validated = validateActaDraft(input);
    if (!validated.ok) {
      return validated;
    }
    const draft = validated.value;

    const contextResult = await loadActaContext(dependencies, input.actorId, draft.mesaId);
    if (!contextResult.ok) {
      return contextResult;
    }

    const existingResult = await dependencies.actas.getByMesaAndDignidad(draft.mesaId, draft.dignidad);
    if (!existingResult.ok) {
      return existingResult;
    }
    const existing = existingResult.value;
    if (existing && existing.version !== draft.expectedVersion) {
      return handleVersionConflict(dependencies.actas, existing, draft, input.actorId);
    }

    return dependencies.actas.save(draft, input.actorId);
  };
}
