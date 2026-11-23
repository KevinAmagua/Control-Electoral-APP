import { z } from 'zod';

import { emailSchema, passwordSchema } from './contact';

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Ingrese su contraseña'),
});

export const recoverySchema = z.object({
  email: emailSchema,
});

export const confirmEmailSchema = z.object({
  email: emailSchema,
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Ingrese su contraseña actual'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirme su contraseña'),
  })
  .superRefine((values, ctx) => {
    if (values.newPassword !== values.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'Las contraseñas no coinciden',
      });
    }
    if (values.newPassword === values.currentPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['newPassword'],
        message: 'La nueva contraseña debe ser diferente',
      });
    }
  });

export const passwordResetSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirme su contraseña'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden',
  });
