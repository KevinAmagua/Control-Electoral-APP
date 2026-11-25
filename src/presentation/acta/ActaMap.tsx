import { StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing, typography } from '@/core/theme';

export type ActaMapProps = {
  actaLat: number;
  actaLng: number;
};

export function ActaMap({ actaLat, actaLng }: ActaMapProps) {
  return (
    <View style={styles.fallback}>
      <Text style={styles.message}>El mapa integrado está disponible en la aplicación móvil.</Text>
      <Text style={styles.message}>
        Acta: {actaLat.toFixed(6)}, {actaLng.toFixed(6)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.background,
  },
  message: {
    color: palette.textMuted,
    fontSize: typography.caption,
  },
});
