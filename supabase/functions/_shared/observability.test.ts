import {
  redactEdgeData,
  resolveCorrelationId
} from './observability.ts';

Deno.test('preserves a valid inbound correlation id', () => {
  const headers = new Headers({ 'x-correlation-id': 'mobile-abc12345' });
  if (resolveCorrelationId(headers, 'fallback-id') !== 'mobile-abc12345') {
    throw new Error('Expected the supplied correlation id.');
  }
});

Deno.test('rejects malformed correlation ids', () => {
  const headers = new Headers({ 'x-correlation-id': 'bad id with spaces' });
  if (resolveCorrelationId(headers, 'fallback-id') !== 'fallback-id') {
    throw new Error('Expected a generated fallback correlation id.');
  }
});

Deno.test('redacts edge payload PII', () => {
  const redacted = redactEdgeData({
    email: 'person@example.com',
    body: 'private chat body',
    nested: {
      detail: 'Call +91 98765 43210 or open https://private.example/media?token=abc'
    }
  }) as Record<string, unknown>;
  const serialized = JSON.stringify(redacted);
  for (const privateValue of ['person@example.com', 'private chat body', '98765', 'private.example']) {
    if (serialized.includes(privateValue)) {
      throw new Error(`PII was not redacted: ${privateValue}`);
    }
  }
});
