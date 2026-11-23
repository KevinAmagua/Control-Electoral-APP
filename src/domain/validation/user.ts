import { z } from 'zod';

import { cedulaSchema } from './cedula';
import { emailSchema, phoneSchema } from './contact';
import type { CreateUserInput } from '../user/profile';

const optionalPhoneSchema = z
  .union([z.literal(''), phoneSchema])
  .transform((value) => (value === '' ? null : value))
  .nullable();

export const createUserSchema = z
  .object({
    role: z.enum(['coordinador_provincial', 'coordinador_recinto', 'veedor']),
    cedula: cedulaSchema,
    firstName: z.string().trim().min(2, 'El nombre es obligatorio'),
    lastName: z.string().trim().min(2, 'El apellido es obligatorio'),
    phone: optionalPhoneSchema,
    email: emailSchema,
    recintoId: z.string().uuid('Seleccione un recinto válido').nullable(),
    jurisdiction: z
      .object({
        province: z.string().trim().min(1, 'Indique la provincia'),
        canton: z.string().trim().min(1, 'Indique el cantón'),
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.role === 'coordinador_recinto') {
      if (!value.jurisdiction) {
        ctx.addIssue({
          code: 'custom',
          path: ['jurisdiction'],
          message: 'Indique la provincia y el cantón del coordinador',
        });
      }
      if (!value.recintoId) {
        ctx.addIssue({
          code: 'custom',
          path: ['recintoId'],
          message: 'Seleccione el recinto que asignará al coordinador',
        });
      }
    }
    if (value.role === 'veedor' && !value.recintoId) {
      ctx.addIssue({
        code: 'custom',
        path: ['recintoId'],
        message: 'Indique el recinto del veedor',
      });
    }
  }) satisfies z.ZodType<CreateUserInput>;

const assignmentSelectionSchema = z.object({
  mesaIds: z.array(z.string().uuid('Mesa inválida')).min(1, 'Seleccione al menos una mesa'),
  veedorId: z
    .string()
    .uuid('Seleccione un veedor válido')
    .nullable()
    .refine((value): value is string => value !== null, 'Seleccione un veedor'),
});

export const assignVeedorFormSchema = assignmentSelectionSchema.extend({
  reason: z.string().trim(),
});
