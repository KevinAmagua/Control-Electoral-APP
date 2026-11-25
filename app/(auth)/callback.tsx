import { Link, router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { palette, spacing, typography } from '@/core/theme';
import { dataContainer } from '@/data/container';
import { LargeTextInput, PrimaryButton, Screen, StatusFeedback } from '@/presentation/components';
import type { FeedbackStatus } from '@/presentation/components/feedback/StatusFeedback';
import { useSession } from '@/presentation/session/SessionProvider';

export default function AuthCallbackScreen() {
  const linkingUrl = Linking.useLinkingURL();
  const { refresh } = useSession();
  const processedUrls = useRef<Set<string>>(new Set());
  const isProcessingRef = useRef(false);
  const [pastedUrl, setPastedUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ status: FeedbackStatus; message: string } | null>(null);

  const processCallback = useCallback(
    async (url: string) => {
      if (!url || processedUrls.current.has(url) || isProcessingRef.current) {
        return;
      }
      processedUrls.current.add(url);
      isProcessingRef.current = true;
      setIsProcessing(true);
      setFeedback(null);

      const result = await dataContainer.repositories.auth.consumeAuthCallback(url);
      await refresh();

      isProcessingRef.current = false;
      setIsProcessing(false);

      if (!result.ok) {
        processedUrls.current.delete(url);
        setFeedback({
          status: 'fallado',
          message: `No se pudo confirmar el correo: ${result.error.message}`,
        });
        return;
      }

      setFeedback({ status: 'guardado', message: 'Correo confirmado correctamente' });
      router.replace({
        pathname: '/restablecer-clave',
        params: { recovery: '1', confirmed: '1' },
      });
    },
    [refresh],
  );

  useEffect(() => {
    if (linkingUrl) {
      void Promise.resolve().then(() => processCallback(linkingUrl));
    }
  }, [linkingUrl, processCallback]);

  const handleManualSubmit = () => {
    const url = pastedUrl.trim();
    if (!url) {
      setFeedback({ status: 'validacion', message: 'Pegue el enlace enviado a su correo' });
      return;
    }
    void processCallback(url);
  };

  return (
    <Screen
      title="Verificación de correo"
      subtitle="Abra el enlace del correo o péguelo aquí para continuar">
      <View style={styles.content}>
        {isProcessing ? (
          <StatusFeedback status="en_proceso" message="Validando su enlace seguro..." />
        ) : null}
        {feedback ? <StatusFeedback status={feedback.status} message={feedback.message} /> : null}
        {!linkingUrl && !feedback ? (
          <StatusFeedback
            status="validacion"
            message="Si el enlace abre una página en blanco, copie el enlace completo de Gmail, incluido lo que empieza con https://www.google.com/url, y péguelo aquí. Cada enlace solo se usa una vez; si ya lo usó, solicite uno nuevo."
          />
        ) : null}
        <LargeTextInput
          label="Enlace del correo"
          value={pastedUrl}
          onChangeText={setPastedUrl}
          placeholder="https://www.google.com/url?q=https://.../auth/v1/verify?token=... o el token de 40 caracteres"
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          numberOfLines={3}
        />
        <PrimaryButton
          label="Procesar enlace"
          onPress={handleManualSubmit}
          isLoading={isProcessing}
          disabled={isProcessing}
        />
        <PrimaryButton label="Ir al inicio de sesión" onPress={() => router.replace('/login')} />
        <Link href="/confirmar-correo" style={styles.link}>
          Verificar con el código enviado por correo
        </Link>
        <Link href="/login" style={styles.link}>
          Iniciar sesión con mi contraseña
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  link: {
    color: palette.accent,
    fontSize: typography.caption,
    fontWeight: '700',
    textAlign: 'center',
  },
});
