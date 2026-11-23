import type { z } from 'zod';

export function formatValidationError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'valor'}: ${issue.message}`)
    .join('; ');
}
