import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { palette, radius, spacing, typography } from '@/core/theme';
import { PrimaryButton } from '@/presentation/components';

import type { ActaMapProps } from './ActaMap';

const OSM_EMBED_URL = 'https://www.openstreetmap.org/export/embed.html';
const MAP_SPAN_DEGREES = 0.002;

function createMapUrl({ actaLat, actaLng }: ActaMapProps): string {
  const halfSpan = MAP_SPAN_DEGREES / 2;
  const bounds = [
    actaLng - halfSpan,
    actaLat - halfSpan,
    actaLng + halfSpan,
    actaLat + halfSpan,
  ]
    .map((coordinate) => coordinate.toFixed(6))
    .join(',');
  const marker = `${actaLat.toFixed(6)},${actaLng.toFixed(6)}`;

  return `${OSM_EMBED_URL}?bbox=${encodeURIComponent(bounds)}&layer=mapnik&marker=${encodeURIComponent(marker)}`;
}

export function ActaMap(props: ActaMapProps) {
  const [loadError, setLoadError] = useState(false);

  if (loadError) {
    return (
      <View style={styles.messageContainer}>
        <Text style={styles.message}>
          No se pudo cargar OpenStreetMap. Revise la conexión a internet e inténtelo de nuevo.
        </Text>
        <PrimaryButton
          compact
          tone="secondary"
          label="Reintentar"
          onPress={() => setLoadError(false)}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['https://*']}
        source={{ uri: createMapUrl(props) }}
        style={styles.map}
        javaScriptEnabled
        domStorageEnabled
        userAgent="ControlElectoralADN/1.0"
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color={palette.primary} />
          </View>
        )}
        onError={() => setLoadError(true)}
        onHttpError={() => setLoadError(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  map: {
    height: 240,
    overflow: 'hidden',
    borderRadius: radius.md,
  },
  loading: {
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
  },
  messageContainer: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.background,
  },
  message: {
    color: palette.textMuted,
    fontSize: typography.caption,
  },
});
