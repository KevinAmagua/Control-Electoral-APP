import { failure, type Result } from '../../core/result/result';
import type { Acta, ActaDraft } from '../acta/acta';
import { validateActaDraft } from '../validation/acta';
import type { ActaContextDependencies } from './acta-context';
import { handleVersionConflict, loadActaContext } from './acta-context';

export type CorrectActaInput = ActaDraft & {
  actorId: string;
  actaId: string;
};

export function createCorrectActaUseCase(dependencies: ActaContextDependencies) {
  return async (input: CorrectActaInput): Promise<Result<Acta>> => {
    const validated = validateActaDraft(input);
    if (!validated.ok) {
      return validated;
    }
    const draft = validated.value;

    const contextResult = await loadActaContext(dependencies, input.actorId, draft.mesaId);
    if (!contextResult.ok) {
      return contextResult;
    }

    const actaResult = await dependencies.actas.getById(input.actaId);
    if (!actaResult.ok) {
      return actaResult;
    }
    const acta = actaResult.value;
    if (!acta) {
      return failure('ACTA_NO_EXISTE', 'El acta que desea corregir no existe');
    }
    if (acta.mesaId !== draft.mesaId || acta.dignidad !== draft.dignidad) {
      return failure('ACTA_NO_COINCIDE', 'El acta no coincide con la mesa y dignidad indicadas');
    }
    if (acta.version !== draft.expectedVersion) {
      return handleVersionConflict(dependencies.actas, acta, draft, input.actorId);
    }

    return dependencies.actas.correct(acta.id, draft, input.actorId);
  };
}
