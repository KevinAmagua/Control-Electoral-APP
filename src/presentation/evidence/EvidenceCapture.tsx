import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing, typography } from '@/core/theme';
import {
  captureEvidencePhoto,
  persistEvidencePhoto,
  type CapturedEvidencePhoto,
} from '@/data/evidence/photo';
import { captureRecintoLocation, type VerifiedLocation } from '@/data/evidence/location';
import type { Recinto } from '@/domain/election/recinto';

export type ConfirmedEvidence = {
  fotoPath: string;
  gpsLat: number;
  gpsLng: number;
  gpsPrecision: number;
  distanceMeters: number;
  outsideRadius: boolean;
  blurScore: number;
};

type EvidenceCaptureProps = {
  recinto: Recinto;
  onConfirm: (evidence: ConfirmedEvidence) => void | Promise<void>;
};

export function EvidenceCapture({ recinto, onConfirm }: EvidenceCaptureProps) {
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [photo, setPhoto] = useState<CapturedEvidencePhoto | null>(null);
  const [location, setLocation] = useState<VerifiedLocation | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  async function handleLocate() {
    setIsLocating(true);
    setMessage(null);
    const result = await captureRecintoLocation(recinto);
    setIsLocating(false);
    if (result.ok) {
      setLocation(result.value);
    } else {
      setMessage(result.error.message);
    }
  }

  async function handleCapture() {
    setIsCapturing(true);
    setMessage(null);
    const result = await captureEvidencePhoto(cameraRef.current);
    setIsCapturing(false);
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }
    setPhoto(result.value);
  }

  async function handleConfirm() {
    if (!photo || !location) {
      setMessage('Capture la foto y obtenga la ubicación antes de continuar');
      return;
    }

    setIsConfirming(true);
    setMessage(null);
    const persisted = await persistEvidencePhoto(photo.uri);
    if (!persisted.ok) {
      setIsConfirming(false);
      setMessage(persisted.error.message);
      return;
    }

    await onConfirm({
      fotoPath: persisted.value,
      gpsLat: location.latitude,
      gpsLng: location.longitude,
      gpsPrecision: location.accuracy,
      distanceMeters: location.distanceMeters,
      outsideRadius: location.outsideRadius,
      blurScore: photo.blurScore,
    });
    setIsConfirming(false);
  }

  if (!permission) {
    return <View style={styles.placeholder} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionCard}>
        <Text style={styles.permissionText}>
          Permita el acceso a la cámara para fotografiar el acta de escrutinio.
        </Text>
        <Pressable style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Habilitar cámara</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.locationCard}>
        {location ? (
          <Text style={location.outsideRadius ? styles.dangerText : styles.successText}>
            {location.outsideRadius
              ? `Ubicación fuera del recinto: ${location.distanceMeters} m / ${location.radiusMeters} m permitidos`
              : `Ubicación verificada: ${location.distanceMeters} m del recinto`}
          </Text>
        ) : (
          <Text style={styles.locationHint}>Obtenga la ubicación para verificar el recinto.</Text>
        )}
        <Pressable
          style={[styles.secondaryButton, isLocating && styles.buttonDisabled]}
          onPress={() => void handleLocate()}
          disabled={isLocating}>
          {isLocating ? (
            <ActivityIndicator color={palette.primary} />
          ) : (
            <Text style={styles.secondaryButtonText}>
              {location ? 'Actualizar ubicación' : 'Obtener ubicación'}
            </Text>
          )}
        </Pressable>
      </View>
      {photo ? (
        <View style={styles.previewCard}>
          <Image source={{ uri: photo.uri }} style={styles.preview} resizeMode="cover" />
          <Text style={styles.previewTitle}>Vista previa del acta</Text>
          <Text style={styles.previewMeta}>
            Nitidez: {photo.sharpness} · {photo.blurScore}/100 · {photo.width}×{photo.height}
          </Text>
          {photo.sharpness !== 'buena' ? (
            <Text style={styles.warningText}>
              La foto podría quedar borrosa. Verifique que el texto sea legible antes de continuar.
            </Text>
          ) : null}
          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.secondaryButton, isConfirming && styles.buttonDisabled]}
              onPress={() => setPhoto(null)}
              disabled={isConfirming}>
              <Text style={styles.secondaryButtonText}>Repetir</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryButton, styles.flexButton, isConfirming && styles.buttonDisabled]}
              onPress={handleConfirm}
              disabled={isConfirming || !location}>
              {isConfirming ? (
                <ActivityIndicator color={palette.onPrimary} />
              ) : (
                <Text style={styles.primaryButtonText}>Usar foto</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.cameraCard}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
            mode="picture"
            onCameraReady={() => setCameraReady(true)}
          />
          <Pressable
            style={[
              styles.captureButton,
              (!cameraReady || isCapturing) && styles.buttonDisabled,
            ]}
            onPress={handleCapture}
            disabled={!cameraReady || isCapturing}>
            {isCapturing ? (
              <ActivityIndicator color={palette.onPrimary} />
            ) : (
              <Text style={styles.primaryButtonText}>Capturar acta</Text>
            )}
          </Pressable>
        </View>
      )}

      {message ? <Text style={styles.messageText}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  placeholder: {
    minHeight: 320,
  },
  locationCard: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
  },
  locationHint: {
    color: palette.textMuted,
    fontSize: typography.caption,
  },
  permissionCard: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
  },
  permissionText: {
    color: palette.text,
    fontSize: typography.label,
  },
  cameraCard: {
    gap: spacing.md,
  },
  camera: {
    height: 360,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: palette.background,
  },
  captureButton: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: palette.primary,
  },
  previewCard: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
  },
  preview: {
    height: 280,
    borderRadius: radius.md,
    backgroundColor: palette.border,
  },
  previewTitle: {
    color: palette.text,
    fontSize: typography.label,
    fontWeight: '700',
  },
  previewMeta: {
    color: palette.textMuted,
    fontSize: typography.caption,
  },
  warningText: {
    color: palette.warning,
    fontSize: typography.caption,
  },
  dangerText: {
    color: palette.danger,
    fontSize: typography.label,
    fontWeight: '700',
  },
  successText: {
    color: palette.success,
    fontSize: typography.label,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryButton: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: palette.primary,
  },
  secondaryButton: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: palette.primary,
  },
  flexButton: {
    flex: 1,
  },
  primaryButtonText: {
    color: palette.onPrimary,
    fontSize: typography.label,
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: palette.primary,
    fontSize: typography.label,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  messageText: {
    color: palette.danger,
    fontSize: typography.caption,
  },
});
