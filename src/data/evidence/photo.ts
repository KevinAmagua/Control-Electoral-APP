import { CameraView } from 'expo-camera';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { failure, ok, type Result } from '@/core/result/result';

export type SharpnessLevel = 'buena' | 'advertencia' | 'baja';

export type CapturedEvidencePhoto = {
  uri: string;
  width: number;
  height: number;
  bytes: number;
  blurScore: number;
  sharpness: SharpnessLevel;
};

function createId(): string {
  const cryptoRef = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (cryptoRef?.randomUUID) {
    return cryptoRef.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function assessSharpness(width: number, height: number, bytes: number): {
  blurScore: number;
  sharpness: SharpnessLevel;
} {
  const minSide = Math.min(width, height);
  const score = Math.round(
    Math.min(100, (Math.min(bytes, 240000) / 240000) * 60 + (Math.min(minSide, 1280) / 1280) * 40),
  );

  if (score >= 75) {
    return { blurScore: score, sharpness: 'buena' };
  }
  if (score >= 50) {
    return { blurScore: score, sharpness: 'advertencia' };
  }
  return { blurScore: score, sharpness: 'baja' };
}

export async function captureEvidencePhoto(
  camera: CameraView | null,
): Promise<Result<CapturedEvidencePhoto>> {
  if (!camera) {
    return failure('CAMARA_NO_LISTA', 'La cámara aún no está lista');
  }
  if (Platform.OS === 'web') {
    return failure('CAPTURA_NO_SOPORTADA', 'La captura requiere un dispositivo móvil');
  }

  try {
    const picture = await camera.takePictureAsync({ quality: 0.9, exif: false, base64: false });
    const file = new File(picture.uri);
    const bytes = file.exists ? file.size : 0;
    const assessment = assessSharpness(picture.width, picture.height, bytes);

    return ok({
      uri: picture.uri,
      width: picture.width,
      height: picture.height,
      bytes,
      ...assessment,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No fue posible capturar la foto';
    return failure('ERROR_CAPTURA_FOTO', message);
  }
}

export async function persistEvidencePhoto(uri: string): Promise<Result<string>> {
  if (Platform.OS === 'web') {
    return failure('ALMACENAMIENTO_NO_SOPORTADO', 'La captura requiere un dispositivo móvil');
  }

  try {
    const source = new File(uri);
    if (!source.exists) {
      return failure('FOTO_NO_ENCONTRADA', 'La foto capturada ya no está disponible');
    }

    const directory = new Directory(Paths.document, 'evidencias');
    if (!directory.exists) {
      directory.create();
    }
    const extension = source.extension || '.jpg';
    const destination = new File(directory, `acta-${createId()}${extension}`);
    await source.copy(destination);
    return ok(destination.uri);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No fue posible guardar la foto';
    return failure('ERROR_GUARDAR_FOTO', message);
  }
}
