import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { StyleSheet, View } from 'react-native';

import { palette, spacing, typography } from '@/core/theme';
import { dataContainer } from '@/data/container';
import { confirmEmailSchema, isRecoveryCallbackUrl } from '@/domain/validation/auth';
import { LargeTextInput, PrimaryButton, Screen, StatusFeedback } from '@/presentation/components';
import type { FeedbackStatus } from '@/presentation/components/feedback/StatusFeedback';
import { getHomeRoute } from '@/presentation/navigation/role-routes';
import { useSession } from '@/presentation/session/SessionProvider';

type ConfirmEmailValues = z.input<typeof confirmEmailSchema>;
type ConfirmEmailResult = z.output<typeof confirmEmailSchema>;
type Feedback = { status: FeedbackStatus; message: string } | null;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function ConfirmarCorreoScreen() {
  const params = useLocalSearchParams<{ email?: string | string[]; token?: string | string[] }>();
  const linkingUrl = Linking.useLinkingURL();
  const processedLinkRef = useRef<string | null>(null);
  const { email, refresh, resendConfirmation } = useSession();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const {
    control,
    handleSubmit,
    getValues,
    setError,
    setValue,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<ConfirmEmailValues, unknown, ConfirmEmailResult>({
    resolver: zodResolver(confirmEmailSchema),
    mode: 'onChange',
    defaultValues: {
      email: firstParam(params.email) ?? email ?? '',
      token: firstParam(params.token) ?? '',
    },
  });

  useEffect(() => {
    if (!linkingUrl || processedLinkRef.current === linkingUrl) {
      return;
    }
    const queryParams = Linking.parse(linkingUrl).queryParams ?? {};
    const hasCallbackPayload =
      ['access_token', 'refresh_token', 'token_hash', 'code'].some(
        (key) => typeof queryParams[key] === 'string',
      ) ||
      typeof queryParams.error === 'string' ||
      typeof queryParams.error_code === 'string';
    if (!hasCallbackPayload) {
      return;
    }

    processedLinkRef.current = linkingUrl;
    void (async () => {
      setIsVerifying(true);
      setFeedback(null);
      const result = await dataContainer.repositories.auth.consumeAuthCallback(linkingUrl);
      await refresh();
      setIsVerifying(false);
      if (!result.ok) {
        setFeedback({ status: 'fallado', message: result.error.message });
        return;
      }
      if (isRecoveryCallbackUrl(linkingUrl) || result.value.mustChangePassword) {
        router.replace({ pathname: '/restablecer-clave', params: { recovery: '1' } });
        return;
      }
      router.replace(getHomeRoute(result.value));
    })();
  }, [linkingUrl, refresh]);

  const onSubmit = async (values: ConfirmEmailResult) => {
    const result = await resendConfirmation(values.email);
    if (!result.ok) {
      setFeedback({ status: 'fallado', message: result.error.message });
      return;
    }

    setValue('token', '');
    setFeedback({
      status: 'guardado',
      message: 'Enviamos un nuevo código y enlace de confirmación a su correo',
    });
  };

  const onVerify = async () => {
    setFeedback(null);
    const isValid = await trigger();
    if (!isValid) {
      return;
    }

    const values = getValues();
    if (!values.token) {
      setError('token', { type: 'manual', message: 'Ingrese el código de 6 dígitos' });
      return;
    }

    setIsVerifying(true);
    const result = await dataContainer.repositories.auth.verifyEmailOtp(values.email, values.token);
    await refresh();
    setIsVerifying(false);

    if (!result.ok) {
      setFeedback({ status: 'fallado', message: result.error.message });
      return;
    }

    setFeedback({ status: 'guardado', message: 'Correo verificado correctamente' });
    router.replace(
      result.value.mustChangePassword ? '/restablecer-clave' : getHomeRoute(result.value),
    );
  };

  return (
    <Screen title="Confirmar correo" subtitle="Use el código enviado por correo o reenvíe el enlace">
      <View style={styles.form}>
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
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="nombre@organizacion.gob.ec"
              error={errors.email?.message ?? null}
            />
          )}
        />
        <Controller
          control={control}
          name="token"
          render={({ field }) => (
            <LargeTextInput
              label="Código de verificación"
              value={field.value}
              onChangeText={(value) => field.onChange(value.replace(/\D/g, '').slice(0, 6))}
              onBlur={field.onBlur}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="123456"
              hint="Ingrese el código de 6 dígitos enviado en el correo"
              error={errors.token?.message ?? null}
            />
          )}
        />
        {feedback ? <StatusFeedback status={feedback.status} message={feedback.message} /> : null}
        <PrimaryButton
          label="Verificar código"
          onPress={() => void onVerify()}
          isLoading={isVerifying}
          disabled={isVerifying || isSubmitting}
        />
        <PrimaryButton
          label="Reenviar código"
          onPress={handleSubmit(onSubmit, () => setFeedback(null))}
          isLoading={isSubmitting}
          disabled={isSubmitting || isVerifying}
          tone="secondary"
        />
        <Link href="/callback" style={styles.link}>
          Pegar aquí el enlace del correo
        </Link>
        <Link href="/login" style={styles.link}>
          Volver al inicio de sesión
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
  },
  link: {
    color: palette.accent,
    fontSize: typography.caption,
    fontWeight: '700',
    textAlign: 'center',
  },
});
