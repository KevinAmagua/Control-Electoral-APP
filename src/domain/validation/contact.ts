import { z } from 'zod';

export const emailSchema = z
  .email('Correo electrónico inválido')
  .transform((value) => value.trim().toLowerCase());

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^(?:0\d{9}|\+593\d{9})$/, 'Teléfono ecuatoriano inválido');

export const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .regex(/[A-Za-z]/, 'La contraseña debe contener letras')
  .regex(/\d/, 'La contraseña debe contener números');
