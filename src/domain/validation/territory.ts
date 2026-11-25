import { z } from 'zod';

export const RECINTO_CODE_PREFIX = 'QTO-';

const RECINTO_CODE_PREFIXES = [
  { pattern: /guayaquil|guayas/i, prefix: 'GYE' },
  { pattern: /quito|pichincha/i, prefix: 'QTO' },
] as const;

export function recintoCodePrefixForLocation(
  province?: string | null,
  canton?: string | null,
): string {
  const location = `${canton ?? ''} ${province ?? ''}`;
  for (const entry of RECINTO_CODE_PREFIXES) {
    if (entry.pattern.test(location)) {
      return `${entry.prefix}-`;
    }
  }
  const letters = location.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  return letters ? `${letters}-` : RECINTO_CODE_PREFIX;
}

export function normalizeRecintoCode(value: string, prefix = RECINTO_CODE_PREFIX): string {
  const digits = value.replace(/\D/g, '').slice(0, 3);
  return digits ? `${prefix}${digits}` : prefix;
}

export function isValidRecintoCode(value: string): boolean {
  return /^[A-Z]{3}-\d{3}$/.test(value);
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
    .refine(isValidRecintoCode, 'El código debe tener el formato ABC-XXX'),
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
