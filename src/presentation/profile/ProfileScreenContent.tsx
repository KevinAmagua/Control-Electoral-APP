import { router } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing, typography } from '@/core/theme';
import { useActorProfile } from '@/presentation/acta/session-actor';
import { InfoRow, SectionTitle } from '@/presentation/acta/ui';
import { PrimaryButton, Screen, StatusFeedback } from '@/presentation/components';
import { useSession } from '@/presentation/session/SessionProvider';
import { fullName } from '@/domain/user/profile';
import { ROLE_LABELS } from '@/domain/user/role';

export function ProfileScreenContent() {
  const { profile, isLoading, error } = useActorProfile();
  const { email, signOut } = useSession();

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.replace('/login');
  }, [signOut]);

  const initials = profile
    ? `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase() || '?'
    : '?';

  return (
    <Screen title="Mi perfil" subtitle={profile ? ROLE_LABELS[profile.role] : 'Datos de la cuenta'}>
      {error ? <StatusFeedback status="fallado" message={error} /> : null}
      {isLoading ? (
        <StatusFeedback status="en_proceso" message="Cargando datos del perfil..." />
      ) : profile ? (
        <>
          <View style={styles.identity}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.identityText}>
              <Text style={styles.name}>{fullName(profile)}</Text>
              <Text style={styles.role}>{ROLE_LABELS[profile.role]}</Text>
            </View>
          </View>

          <SectionTitle title="Datos personales" />
          <View style={styles.card}>
            <InfoRow
              label="Correo"
              value={<Text style={styles.value}>{profile.email || email || '—'}</Text>}
            />
            <InfoRow label="Cédula" value={<Text style={styles.value}>{profile.cedula || '—'}</Text>} />
            <InfoRow
              label="Teléfono"
              value={<Text style={styles.value}>{profile.phone || '—'}</Text>}
            />
            <InfoRow
              label="Provincia"
              value={<Text style={styles.value}>{profile.province || '—'}</Text>}
            />
            <InfoRow
              label="Cantón"
              value={<Text style={styles.value}>{profile.canton || '—'}</Text>}
            />
            <InfoRow
              label="Recinto"
              value={
                <Text style={styles.value}>{profile.recintoId ? 'Asignado' : 'Sin asignar'}</Text>
              }
            />
            <InfoRow
              label="Correo verificado"
              value={<Text style={styles.value}>{profile.emailVerified ? 'Sí' : 'No'}</Text>}
            />
            <InfoRow
              label="Estado"
              value={<Text style={styles.value}>{profile.active ? 'Activo' : 'Inactivo'}</Text>}
            />
          </View>

          <PrimaryButton
            label="Cerrar sesión"
            onPress={() => {
              void handleSignOut();
            }}
            tone="secondary"
          />
        </>
      ) : (
        <StatusFeedback status="validacion" message="No se encontraron datos del perfil." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  avatar: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: palette.primary,
  },
  avatarText: {
    color: palette.onPrimary,
    fontSize: typography.heading,
    fontWeight: '700',
  },
  identityText: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    color: palette.text,
    fontSize: typography.heading,
    fontWeight: '700',
  },
  role: {
    color: palette.accent,
    fontSize: typography.caption,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  value: {
    color: palette.text,
    fontSize: typography.caption,
    textAlign: 'right',
    flexShrink: 1,
  },
});
