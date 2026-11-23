import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { failure, ok, type Result } from '@/core/result/result';

import { supabase } from './client';
import { errorMessage } from './errors';

export const ACTA_PHOTO_BUCKET = 'actas';

export type UploadActaPhotoInput = {
  userId: string;
  actaId: string;
  operationId: string;
  localPath: string;
};

export async function getActaPhotoUri(path: string): Promise<Result<string>> {
  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('file://') ||
    path.startsWith('data:')
  ) {
    return ok(path);
  }

  try {
    const { data, error } = await supabase.storage
      .from(ACTA_PHOTO_BUCKET)
      .createSignedUrl(path, 60 * 60);
    if (error) {
      return failure('ERROR_FOTO_ACTA', errorMessage(error));
    }
    return ok(data?.signedUrl ?? '');
  } catch (error) {
    return failure('ERROR_FOTO_ACTA', errorMessage(error));
  }
}

export async function uploadActaPhoto(input: UploadActaPhotoInput): Promise<Result<string>> {
  if (Platform.OS === 'web') {
    return failure('SUBIDA_NO_SOPORTADA', 'La subida requiere un dispositivo móvil');
  }

  try {
    const file = new File(input.localPath);
    if (!file.exists) {
      return failure('FOTO_NO_ENCONTRADA', 'La foto capturada ya no está disponible');
    }

    const storagePath = `${input.userId}/${input.actaId}-${input.operationId}.jpg`;
    const body = await file.arrayBuffer();
    const { data, error } = await supabase.storage
      .from(ACTA_PHOTO_BUCKET)
      .upload(storagePath, body, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      return failure('ERROR_SUBIR_FOTO', errorMessage(error));
    }

    return ok(data?.path ?? storagePath);
  } catch (error) {
    return failure('ERROR_SUBIR_FOTO', errorMessage(error));
  }
}
