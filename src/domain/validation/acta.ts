import { z } from 'zod';

import { failure, ok, type Result } from '../../core/result/result';
import type { ActaDraft } from '../acta/acta';

export function parseActaCount(value: string): number {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return Number.NaN;
  }
  return Number(trimmed);
}

const countTextSchema = z.string().refine(
  (value) => Number.isSafeInteger(parseActaCount(value)),
  'Ingrese un número entero no negativo',
);

export const voteDetailSchema = z.object({
  organizationId: z.string().min(1, 'La organización es obligatoria'),
  candidateId: z.string().min(1, 'El candidato es obligatorio'),
  votos: z.number().int().nonnegative('Los votos no pueden ser negativos'),
});

export const actaFormSchema = z
  .object({
    totalSufragantes: countTextSchema,
    votosBlancos: countTextSchema,
    votosNulos: countTextSchema,
    votos: z.record(z.string(), countTextSchema),
    observaciones: z.string().optional(),
  })
  .superRefine((values, context) => {
    const total = parseActaCount(values.totalSufragantes);
    const blancos = parseActaCount(values.votosBlancos);
    const nulos = parseActaCount(values.votosNulos);

    if (!Number.isSafeInteger(total) || total <= 0) {
      context.addIssue({
        code: 'custom',
        path: ['totalSufragantes'],
        message: 'El total de sufragantes debe ser mayor a cero',
      });
      return;
    }

    let votosPorListas = 0;
    for (const [candidateId, raw] of Object.entries(values.votos)) {
      const votos = parseActaCount(raw);
      if (!Number.isSafeInteger(votos)) {
        continue;
      }
      votosPorListas += votos;
      if (votos > total) {
        context.addIssue({
          code: 'custom',
          path: ['votos', candidateId],
          message: 'Un candidato no puede superar el total de sufragantes',
        });
      }
    }

    if (!Number.isSafeInteger(blancos) || !Number.isSafeInteger(nulos)) {
      return;
    }

    if (votosPorListas + blancos + nulos !== total) {
      context.addIssue({
        code: 'custom',
        path: ['totalSufragantes'],
        message: 'El acta no cuadra con el total de sufragantes',
      });
    }
  });

export type ActaFormValues = z.infer<typeof actaFormSchema>;

export const actaDraftSchema = z
  .object({
    mesaId: z.string().uuid('La mesa es inválida'),
    dignidad: z.enum(['alcaldia', 'prefectura']),
    expectedVersion: z.number().int().nonnegative('La versión esperada es inválida'),
    totalSufragantes: z
      .number()
      .int()
      .positive('El total de sufragantes debe ser mayor a cero'),
    votosValidos: z.number().int().nonnegative('Los votos válidos no pueden ser negativos'),
    votosBlancos: z.number().int().nonnegative('Los votos blancos no pueden ser negativos'),
    votosNulos: z.number().int().nonnegative('Los votos nulos no pueden ser negativos'),
    gpsLat: z.number().finite('La latitud es obligatoria'),
    gpsLng: z.number().finite('La longitud es obligatoria'),
    gpsPrecision: z.number().nonnegative('La precisión GPS es inválida'),
    fotoPath: z.string().min(1, 'La fotografía del acta es obligatoria'),
    observaciones: z.string().optional(),
    operacionClienteId: z.string().uuid('El identificador de operación es inválido'),
    votos: z.array(voteDetailSchema),
  })
  .superRefine((value, context) => {
    const addIssue = (path: (string | number)[], message: string) => {
      context.addIssue({ code: 'custom', path, message });
    };

    if (value.votosValidos > value.totalSufragantes) {
      addIssue(['votosValidos'], 'Los votos válidos superan el total de sufragantes');
    }
    if (value.votosBlancos > value.totalSufragantes) {
      addIssue(['votosBlancos'], 'Los votos blancos superan el total de sufragantes');
    }
    if (value.votosNulos > value.totalSufragantes) {
      addIssue(['votosNulos'], 'Los votos nulos superan el total de sufragantes');
    }

    value.votos.forEach((detalle, index) => {
      if (detalle.votos > value.totalSufragantes) {
        addIssue(['votos', index, 'votos'], 'Un candidato no puede superar el total de sufragantes');
      }
    });

    const totalVotosCandidatos = value.votos.reduce((total, detalle) => total + detalle.votos, 0);
    if (totalVotosCandidatos !== value.votosValidos) {
      addIssue(['votos'], 'La suma de votos por lista debe coincidir con los votos válidos');
    }
    if (totalVotosCandidatos + value.votosBlancos + value.votosNulos !== value.totalSufragantes) {
      addIssue(['totalSufragantes'], 'El acta no cuadra con el total de sufragantes');
    }
  });

export function validateActaDraft(input: unknown): Result<ActaDraft> {
  const parsed = actaDraftSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'acta'}: ${issue.message}`)
      .join('; ');
    return failure('VALIDACION_ACTA', message);
  }
  return ok(parsed.data);
}
