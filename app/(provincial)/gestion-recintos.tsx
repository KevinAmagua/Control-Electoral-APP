import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing, typography } from '@/core/theme';
import { dataContainer } from '@/data/container';
import { getCurrentPlace } from '@/data/evidence/location';
import type { Recinto } from '@/domain/election/recinto';
import type { UserProfile } from '@/domain/user/profile';
import { fullName } from '@/domain/user/profile';
import {
  isValidRecintoCode,
  normalizeRecintoCode,
  RECINTO_CODE_PREFIX,
} from '@/domain/validation/territory';
import { normalizeCedula } from '@/domain/validation/cedula';
import { createUserSchema } from '@/domain/validation/user';
import { useActorProfile } from '@/presentation/acta/session-actor';
import { SectionTitle } from '@/presentation/acta/ui';
import {
  LargeTextInput,
  PrimaryButton,
  Screen,
  StatusFeedback,
  type FeedbackStatus,
} from '@/presentation/components';

type RecintoView = Recinto & { coordinator: UserProfile | null };
type Feedback = { status: FeedbackStatus; message: string };
type CoordinatorValues = z.input<typeof createUserSchema>;
type CoordinatorResult = z.output<typeof createUserSchema>;

export default function GestionRecintosScreen() {
  const { actorId, profile, isLoading: isActorLoading, error: actorError } = useActorProfile();
  const [recintos, setRecintos] = useState<RecintoView[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [code, setCode] = useState(RECINTO_CODE_PREFIX);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [parish, setParish] = useState('');
  const [gpsLat, setGpsLat] = useState('');
  const [gpsLng, setGpsLng] = useState('');
  const [radiusMeters, setRadiusMeters] = useState('300');
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const {
    control,
    handleSubmit,
    setValue,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CoordinatorValues, unknown, CoordinatorResult>({
    resolver: zodResolver(createUserSchema),
    mode: 'onChange',
    defaultValues: {
      role: 'coordinador_recinto',
      cedula: '',
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      recintoId: null,
      jurisdiction: {
        province: profile?.province ?? '',
        canton: profile?.canton ?? '',
      },
    },
  });
  const selectedRecintoId = useWatch({ control, name: 'recintoId' });

  const startLoading = useCallback(() => {
    void Promise.resolve().then(() => setLoading(true));
  }, []);

  const finishLoading = useCallback(() => {
    void Promise.resolve().then(() => setLoading(false));
  }, []);

  useEffect(() => {
    let active = true;

    if (!actorId) {
      finishLoading();
      return;
    }

    startLoading();

    void (async () => {
      try {
        const listed = await dataContainer.useCases.listRecintos(actorId);
        if (!listed.ok) {
          throw new Error(listed.error.message);
        }
        const coordinatorResults = await Promise.all(
          listed.value.map((recinto) => dataContainer.repositories.users.listByRecinto(recinto.id)),
        );
        if (!active) {
          return;
        }
        setRecintos(
          listed.value.map((recinto, index) => {
            const result = coordinatorResults[index];
            const coordinator = result.ok
              ? result.value.find(
                  (user) => user.role === 'coordinador_recinto' && user.active,
                ) ?? null
              : null;
            return { ...recinto, coordinator };
          }),
        );
      } catch (error) {
        if (active) {
          setFeedback({
            status: 'fallado',
            message: error instanceof Error ? error.message : 'No fue posible cargar los recintos',
          });
        }
      } finally {
        if (active) {
          finishLoading();
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [actorId, finishLoading, reloadToken, startLoading]);

  useEffect(() => {
    if (!profile) {
      return;
    }
    setValue('jurisdiction.province', profile.province ?? '');
    setValue('jurisdiction.canton', profile.canton ?? '');
  }, [profile, setValue]);

  const parsedGpsLat = Number(gpsLat);
  const parsedGpsLng = Number(gpsLng);
  const parsedRadiusMeters = Number(radiusMeters);
  const validCoordinates =
    gpsLat.trim().length > 0 &&
    gpsLng.trim().length > 0 &&
    Number.isFinite(parsedGpsLat) &&
    Number.isFinite(parsedGpsLng) &&
    parsedGpsLat >= -90 &&
    parsedGpsLat <= 90 &&
    parsedGpsLng >= -180 &&
    parsedGpsLng <= 180;
  const canCreateRecinto =
    Boolean(actorId) &&
    isValidRecintoCode(code) &&
    Boolean(name.trim()) &&
    Boolean(address.trim()) &&
    validCoordinates &&
    Number.isFinite(parsedRadiusMeters) &&
    Number.isInteger(parsedRadiusMeters) &&
    parsedRadiusMeters > 0;

  const handleCreateRecinto = async () => {
    if (!actorId || !canCreateRecinto) {
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    const result = await dataContainer.useCases.createRecinto({
      actorId,
      data: {
        code: code.trim(),
        name: name.trim(),
        address: address.trim(),
        parish: parish.trim() || null,
        province: profile?.province ?? '',
        canton: profile?.canton ?? '',
        gpsLat: parsedGpsLat,
        gpsLng: parsedGpsLng,
        radiusMeters: parsedRadiusMeters,
      },
    });
    setSubmitting(false);

    if (!result.ok) {
      setFeedback({ status: 'fallado', message: result.error.message });
      return;
    }

    setFeedback({ status: 'guardado', message: `Recinto ${result.value.code} creado correctamente` });
    setCode(RECINTO_CODE_PREFIX);
    setName('');
    setAddress('');
    setParish('');
    setGpsLat('');
    setGpsLng('');
    setReloadToken((value) => value + 1);
  };

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    setFeedback(null);
    const result = await getCurrentPlace();
    setLocating(false);

    if (!result.ok) {
      setFeedback({ status: 'fallado', message: result.error.message });
      return;
    }

    const place = result.value;
    setGpsLat(place.latitude.toFixed(6));
    setGpsLng(place.longitude.toFixed(6));
    if (place.address) {
      setAddress(place.address);
    }
    if (place.parish && !parish.trim()) {
      setParish(place.parish);
    }
    const accuracy = Math.round(place.accuracy);
    setFeedback({
      status: 'validacion',
      message:
        place.warning ??
        `Ubicación obtenida (±${accuracy} m). Verifique la dirección antes de guardar.`,
    });
  };

  const handleCreateCoordinator = async (values: CoordinatorResult) => {
    if (!actorId || !values.recintoId) {
      setError('recintoId', {
        type: 'server',
        message: 'Seleccione el recinto que asignará al coordinador',
      });
      return;
    }
    if (
      values.jurisdiction?.province !== profile?.province ||
      values.jurisdiction?.canton !== profile?.canton
    ) {
      setError('jurisdiction.province', {
        type: 'server',
        message: 'El coordinador debe pertenecer a su provincia y cantón',
      });
      return;
    }

    setFeedback(null);
    const created = await dataContainer.useCases.createAccount({
      ...values,
      createdBy: actorId,
    });

    if (!created.ok) {
      if (created.error.code === 'CEDULA_YA_REGISTRADA' || created.error.code === 'REGISTRO_DUPLICADO') {
        setError('cedula', { type: 'server', message: created.error.message });
      } else if (created.error.code === 'CORREO_YA_REGISTRADO') {
        setError('email', { type: 'server', message: created.error.message });
      } else if (
        created.error.code === 'JURISDICCION_REQUERIDA' ||
        created.error.code === 'FUERA_DE_JURISDICCION' ||
        created.error.code === 'RECINTO_FUERA_DE_JURISDICCION'
      ) {
        setError('jurisdiction.province', { type: 'server', message: created.error.message });
      } else {
        setFeedback({ status: 'fallado', message: created.error.message });
      }
      return;
    }

    const assigned = await dataContainer.useCases.assignRecintoCoordinator({
      actorId,
      recintoId: values.recintoId,
      coordinadorId: created.value.id,
    });

    if (!assigned.ok) {
      setFeedback({
        status: 'fallado',
        message: `La cuenta se creó pero no se pudo asignar: ${assigned.error.message}`,
      });
      return;
    }

    setFeedback({ status: 'guardado', message: 'Coordinador creado y asignado correctamente' });
    reset({
      role: 'coordinador_recinto',
      cedula: '',
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      recintoId: null,
      jurisdiction: {
        province: profile?.province ?? '',
        canton: profile?.canton ?? '',
      },
    });
    setReloadToken((value) => value + 1);
  };

  const jurisdictionError = errors.jurisdiction?.message
    ?? errors.jurisdiction?.province?.message
    ?? errors.jurisdiction?.canton?.message;

  return (
    <Screen
      title="Gestión de recintos"
      subtitle={`Jurisdicción: ${profile?.province ?? '-'} / ${profile?.canton ?? '-'}`}>
      {actorError ? <StatusFeedback status="fallado" message={actorError} /> : null}
      {feedback ? <StatusFeedback status={feedback.status} message={feedback.message} /> : null}
      {loading || isActorLoading ? (
        <StatusFeedback status="en_proceso" message="Cargando recintos..." />
      ) : null}

      <SectionTitle title="Recintos registrados" subtitle="Coordinador responsable de cada recinto" />
      {recintos.map((recinto) => (
        <View key={recinto.id} style={styles.card}>
          <Text style={styles.cardTitle}>
            {recinto.code} · {recinto.name}
          </Text>
          <Text style={styles.cardDetail}>{recinto.address}</Text>
          <Text style={styles.cardDetail}>
            Coordinador: {recinto.coordinator ? fullName(recinto.coordinator) : 'Sin asignar'}
          </Text>
        </View>
      ))}

      <SectionTitle title="Nuevo recinto" subtitle="Dentro de su provincia y cantón" />
      <PrimaryButton
        label="Usar mi ubicación"
        onPress={() => void handleUseCurrentLocation()}
        isLoading={locating}
        disabled={locating || submitting}
        tone="secondary"
      />
      <LargeTextInput
        label="Código"
        value={code}
        onChangeText={(value) => setCode(normalizeRecintoCode(value))}
        keyboardType="number-pad"
        maxLength={RECINTO_CODE_PREFIX.length + 3}
        placeholder="QTO-001"
      />
      <LargeTextInput label="Nombre" value={name} onChangeText={setName} />
      <LargeTextInput
        label="Dirección"
        value={address}
        onChangeText={setAddress}
        hint="Se llena con «Usar mi ubicación»; puede corregirla"
      />
      <LargeTextInput label="Parroquia" value={parish} onChangeText={setParish} />
      <LargeTextInput
        label="Latitud"
        value={gpsLat}
        onChangeText={setGpsLat}
        keyboardType="numeric"
        placeholder="-0.180653"
      />
      <LargeTextInput
        label="Longitud"
        value={gpsLng}
        onChangeText={setGpsLng}
        keyboardType="numeric"
        placeholder="-78.467834"
      />
      <LargeTextInput
        label="Radio de alerta (m)"
        value={radiusMeters}
        onChangeText={setRadiusMeters}
        keyboardType="number-pad"
      />
      <PrimaryButton
        label="Crear recinto"
        onPress={() => void handleCreateRecinto()}
        isLoading={submitting}
        disabled={submitting || locating || isSubmitting || !canCreateRecinto}
      />

      <SectionTitle title="Coordinador de recinto" subtitle="Crear cuenta y asignarla de inmediato" />
      {jurisdictionError ? (
        <StatusFeedback status="validacion" message={jurisdictionError} />
      ) : null}
      {errors.recintoId?.message ? (
        <StatusFeedback status="validacion" message={errors.recintoId.message} />
      ) : null}
      <Controller
        control={control}
        name="cedula"
        render={({ field }) => (
          <LargeTextInput
            label="Cédula"
            value={field.value}
            onChangeText={(value) => field.onChange(normalizeCedula(value))}
            onBlur={field.onBlur}
            keyboardType="number-pad"
            maxLength={10}
            error={errors.cedula?.message ?? null}
          />
        )}
      />
      <Controller
        control={control}
        name="firstName"
        render={({ field }) => (
          <LargeTextInput
            label="Nombres"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.firstName?.message ?? null}
          />
        )}
      />
      <Controller
        control={control}
        name="lastName"
        render={({ field }) => (
          <LargeTextInput
            label="Apellidos"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.lastName?.message ?? null}
          />
        )}
      />
      <Controller
        control={control}
        name="phone"
        render={({ field }) => (
          <LargeTextInput
            label="Teléfono"
            value={field.value ?? ''}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            keyboardType="phone-pad"
            placeholder="09XXXXXXXX"
            error={errors.phone?.message ?? null}
          />
        )}
      />
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <LargeTextInput
            label="Correo electrónico"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            autoCapitalize="none"
            keyboardType="email-address"
            error={errors.email?.message ?? null}
          />
        )}
      />
      <View style={styles.optionGrid}>
        {recintos.map((recinto) => (
          <PrimaryButton
            key={recinto.id}
            label={recinto.code}
            onPress={() => setValue('recintoId', recinto.id, { shouldValidate: true })}
            tone={selectedRecintoId === recinto.id ? 'accent' : 'primary'}
          />
        ))}
      </View>
      <PrimaryButton
        label="Crear y asignar coordinador"
        onPress={handleSubmit(handleCreateCoordinator, () => setFeedback(null))}
        isLoading={isSubmitting}
        disabled={isSubmitting || submitting || !selectedRecintoId || !actorId}
      />
      <PrimaryButton label="Volver al panel" onPress={() => router.back()} tone="secondary" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  cardTitle: {
    color: palette.text,
    fontSize: typography.label,
    fontWeight: '700',
  },
  cardDetail: {
    color: palette.textMuted,
    fontSize: typography.caption,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
