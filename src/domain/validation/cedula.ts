import { z } from 'zod';

const COEFFICIENTS = [2, 1, 2, 1, 2, 1, 2, 1, 2] as const;

export function normalizeCedula(value: string): string {
  return value.replace(/\D/g, '').slice(0, 10);
}

export function isValidEcuadorianCedula(value: string): boolean {
  if (!/^\d{10}$/.test(value)) {
    return false;
  }

  const province = Number(value.slice(0, 2));
  const isValidProvince = (province >= 1 && province <= 24) || province === 30;
  if (!isValidProvince || Number(value[2]) > 5) {
    return false;
  }

  const sum = COEFFICIENTS.reduce((total, coefficient, index) => {
    const product = Number(value[index]) * coefficient;
    return total + (product >= 10 ? product - 9 : product);
  }, 0);
  const remainder = sum % 10;
  const verificationDigit = remainder === 0 ? 0 : 10 - remainder;

  return verificationDigit === Number(value[9]);
}

export const cedulaSchema = z
  .string()
  .trim()
  .transform(normalizeCedula)
  .refine(isValidEcuadorianCedula, 'Cédula ecuatoriana inválida');
