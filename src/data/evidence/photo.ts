import { CameraView } from 'expo-camera';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
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

const SHARPNESS_SAMPLE_WIDTH = 640;
const SHARPNESS_DENSITY_FLOOR = 0.04;
const SHARPNESS_DENSITY_CEILING = 0.34;

export function assessSharpness(bytes: number, width: number, height: number): {
  blurScore: number;
  sharpness: SharpnessLevel;
} {
  const pixels = Math.max(1, width * height);
  const density = bytes / pixels;
  const normalized =
    (density - SHARPNESS_DENSITY_FLOOR) / (SHARPNESS_DENSITY_CEILING - SHARPNESS_DENSITY_FLOOR);
  const score = Math.round(Math.max(0, Math.min(100, normalized * 100)));

  if (score >= 75) {
    return { blurScore: score, sharpness: 'buena' };
  }
  if (score >= 50) {
    return { blurScore: score, sharpness: 'advertencia' };
  }
  return { blurScore: score, sharpness: 'baja' };
}

async function measureSharpness(uri: string): Promise<{
  blurScore: number;
  sharpness: SharpnessLevel;
}> {
  const context = ImageManipulator.manipulate(uri, { maxWidth: 1280, maxHeight: 1280 }).resize({
    width: SHARPNESS_SAMPLE_WIDTH,
  });
  const rendered = await context.renderAsync();
  const sample = await rendered.saveAsync({ compress: 0.6, format: SaveFormat.JPEG });
  const sampleFile = new File(sample.uri);
  const bytes = sampleFile.exists ? sampleFile.size : 0;
  return assessSharpness(bytes, sample.width, sample.height);
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
    const assessment = await measureSharpness(picture.uri);

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
