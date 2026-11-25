import { z } from 'zod';

export const RECINTO_CODE_PREFIX = 'QTO-';

export function normalizeRecintoCode(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 3);
  return `${RECINTO_CODE_PREFIX}${digits}`;
}

export function isValidRecintoCode(value: string): boolean {
  return /^QTO-\d{3}$/.test(value);
}

export function normalizeMesaNumber(value: string): string {
  return value.replace(/\D/g, '').slice(0, 3).padStart(3, '0');
}

export function isValidMesaNumber(value: string): boolean {
  return /^\d{3}$/.test(value);
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

export const createMesaSchema = z.object({
  number: z
    .string()
    .trim()
    .refine(isValidMesaNumber, 'El número debe tener 3 dígitos'),
  registeredVoters: z
    .string()
    .trim()
    .regex(/^\d+$/, 'Ingrese un número válido')
    .transform(Number)
    .refine((value) => Number.isInteger(value) && value >= 0, 'Los electores no pueden ser negativos'),
  location: z.string().trim().min(2, 'La ubicación es obligatoria'),
  veedorId: z.string().uuid().nullable(),
});
