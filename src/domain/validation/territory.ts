import { z } from 'zod';

export const RECINTO_CODE_PREFIX = 'QTO-';

export function normalizeRecintoCode(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 3);
  return `${RECINTO_CODE_PREFIX}${digits}`;
}

export function isValidRecintoCode(value: string): boolean {
  return /^QTO-\d{3}$/.test(value);
}

export const createRecintoSchema = z.object({
  code: z
    .string()
    .trim()
    .refine(isValidRecintoCode, 'El código debe tener el formato QTO-XXX'),
  name: z.string().trim().min(2, 'El nombre del recinto es obligatorio'),
  address: z.string().trim().min(2, 'La dirección es obligatoria'),
  parish: z.string().trim().min(1).nullable(),
  province: z.string().trim().min(1),
  canton: z.string().trim().min(1),
  gpsLat: z.number().finite().min(-90).max(90),
  gpsLng: z.number().finite().min(-180).max(180),
  radiusMeters: z.number().int().positive().default(300),
});
