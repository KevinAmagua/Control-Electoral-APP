import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing, typography } from '@/core/theme';
import { ACTA_STATUS_LABELS, type ActaStatus } from '@/domain/acta/acta-status';

export type DisplayStatus = ActaStatus | 'pendiente' | null;

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.infoValue}>{value}</View>
    </View>
  );
}

export function StatusChip({ status }: { status: DisplayStatus }) {
  const label =
    status === null
      ? 'Sin acta'
      : status === 'pendiente'
        ? 'En cola'
        : ACTA_STATUS_LABELS[status];
  const color =
    status === 'guardado'
      ? palette.success
      : status === 'fallado'
        ? palette.danger
        : status === null
          ? palette.textMuted
          : palette.warning;

  return (
    <View style={[styles.chip, { borderColor: color }]}>
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

export function OptionButton({
  label,
  selected,
  onPress,
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.option,
        selected && styles.optionSelected,
        disabled && styles.optionDisabled,
      ]}>
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.xs,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: typography.heading,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: palette.textMuted,
    fontSize: typography.caption,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  infoLabel: {
    color: palette.textMuted,
    fontSize: typography.caption,
  },
  infoValue: {
    flex: 1,
    alignItems: 'flex-end',
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: {
    fontSize: typography.caption,
    fontWeight: '700',
  },
  option: {
    minHeight: 48,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  optionSelected: {
    borderColor: palette.primary,
    backgroundColor: palette.primaryLight,
  },
  optionDisabled: {
    opacity: 0.5,
  },
  optionText: {
    color: palette.text,
    fontSize: typography.caption,
    fontWeight: '700',
    textAlign: 'center',
  },
  optionTextSelected: {
    color: palette.primary,
  },
});
