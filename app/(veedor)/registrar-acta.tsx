import { router, useLocalSearchParams } from 'expo-router';

import { DIGNITIES, type Dignity } from '@/domain/election/dignity';
import { ActaEditor } from '@/presentation/acta/ActaEditor';
import { Screen, StatusFeedback } from '@/presentation/components';

function parseDignidad(value: string | string[] | undefined): Dignity {
  if (typeof value === 'string' && (DIGNITIES as readonly string[]).includes(value)) {
    return value as Dignity;
  }
  return 'alcaldia';
}

export default function RegistrarActaScreen() {
  const params = useLocalSearchParams();
  const mesaId = typeof params.mesaId === 'string' ? params.mesaId : '';
  const dignidad = parseDignidad(params.dignidad);

  if (!mesaId) {
    return (
      <Screen title="Registrar acta">
        <StatusFeedback status="validacion" message="No se indicó una mesa válida." />
      </Screen>
    );
  }

  return (
    <ActaEditor
      mesaId={mesaId}
      initialDignidad={dignidad}
      onDone={() => router.back()}
      onViewStatus={() => router.push('/estados-acta')}
    />
  );
}
