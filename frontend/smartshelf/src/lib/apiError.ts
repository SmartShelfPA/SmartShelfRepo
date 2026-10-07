function firstMessage(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const msg = firstMessage(item);
      if (msg) return msg;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) {
      const msg = firstMessage(item);
      if (msg) return msg;
    }
  }
  return null;
}

/** Turns DRF error bodies ({error}, {detail}, {field: [msg]}, {non_field_errors: [msg]}) into one message. */
export async function readApiError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  if (!body || typeof body !== 'object') return fallback;
  const obj = body as Record<string, unknown>;
  const preferred = obj.message ?? obj.error ?? obj.detail ?? obj.non_field_errors;
  return firstMessage(preferred) ?? firstMessage(obj) ?? fallback;
}
