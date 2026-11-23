import { Link, router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { palette, spacing, typography } from '@/core/theme';
import { dataContainer } from '@/data/container';
import { PrimaryButton, Screen, StatusFeedback } from '@/presentation/components';
import type { FeedbackStatus } from '@/presentation/components/feedback/StatusFeedback';
import { getHomeRoute } from '@/presentation/navigation/role-routes';
import { useSession } from '@/presentation/session/SessionProvider';

export default function AuthCallbackScreen() {
  const linkingUrl = Linking.useLinkingURL();
  const { refresh } = useSession();
  const processedUrl = useRef<string | null>(null);
  const isProcessingRef = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ status: FeedbackStatus; message: string } | null>(null);

  useEffect(() => {
    if (!linkingUrl || processedUrl.current === linkingUrl || isProcessingRef.current) {
      return;
    }
    processedUrl.current = linkingUrl;
    isProcessingRef.current = true;

    let cancelled = false;
    setIsProcessing(true);

    void (async () => {
      const result = await dataContainer.repositories.auth.consumeAuthCallback(linkingUrl);
      await refresh();
      if (cancelled) {
        return;
      }
      isProcessingRef.current = false;
      setIsProcessing(false);

      if (!result.ok) {
        setFeedback({ status: 'fallado', message: result.error.message });
        return;
      }

      setFeedback({ status: 'guardado', message: 'Correo verificado correctamente' });
      router.replace(
        result.value.mustChangePassword ? '/restablecer-clave' : getHomeRoute(result.value),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [linkingUrl, refresh]);

  return (
    <Screen title="Verificación de correo" subtitle="Procesando el enlace de acceso">
      <View style={styles.content}>
        {isProcessing ? (
          <StatusFeedback status="en_proceso" message="Validando su enlace seguro..." />
        ) : null}
        {feedback ? <StatusFeedback status={feedback.status} message={feedback.message} /> : null}
        {!linkingUrl ? (
          <StatusFeedback
            status="validacion"
            message="Abra el enlace enviado a su correo desde este dispositivo"
          />
        ) : null}
        <PrimaryButton label="Ir al inicio de sesión" onPress={() => router.replace('/login')} />
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
