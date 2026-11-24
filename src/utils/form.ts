import { z } from 'zod';

/** First error message per field, ready to show under each input. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const { fieldErrors: byField } = z.flattenError(error);
  const result: Record<string, string> = {};
  for (const [field, messages] of Object.entries(byField)) {
    const first = Array.isArray(messages) ? messages[0] : undefined;
    if (first) result[field] = first;
  }
  return result;
}
