export type EdgeLogLevel = 'debug' | 'info' | 'warn' | 'error';

const sensitiveKeyPattern =
  /(^|_)(authorization|cookie|password|secret|token|jwt|email|phone|mobile|body|message|media_url|private_url|signed_url|object_name|storage_path|user_id|actor_id|recipient_id)($|_)/i;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const bearerPattern = /\bBearer\s+[A-Za-z0-9._~+/=-]+\b/gi;
const jwtPattern = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const phonePattern = /(?:\+?\d[\d ()-]{7,}\d)/g;
const urlPattern = /\bhttps?:\/\/[^\s"'<>]+/gi;
const correlationPattern = /^[A-Za-z0-9._:-]{8,128}$/;

export interface EdgeObservabilityContext {
  correlationId: string;
  environment: string;
  functionName: string;
  startedAt: number;
  log: (level: EdgeLogLevel, event: string, data?: Record<string, unknown>) => void;
}

export function redactEdgeString(value: string): string {
  return value
    .replace(bearerPattern, 'Bearer [REDACTED]')
    .replace(jwtPattern, '[REDACTED]')
    .replace(emailPattern, '[REDACTED]')
    .replace(phonePattern, '[REDACTED]')
    .replace(urlPattern, '[REDACTED_URL]');
}

export function redactEdgeData(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') return redactEdgeString(value);
  if (value === null || value === undefined || typeof value !== 'object') return value;
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redactEdgeData(item, seen));

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      sensitiveKeyPattern.test(key) ? '[REDACTED]' : redactEdgeData(item, seen)
    ])
  );
}

export function resolveCorrelationId(
  headers: Headers,
  fallback: string = crypto.randomUUID()
): string {
  const supplied = headers.get('x-correlation-id') ?? headers.get('x-request-id');
  return supplied && correlationPattern.test(supplied) ? supplied : fallback;
}

export function createEdgeObservability(
  request: Request,
  functionName: string
): EdgeObservabilityContext {
  const context: EdgeObservabilityContext = {
    correlationId: resolveCorrelationId(request.headers),
    environment: Deno.env.get('APP_ENV') ?? Deno.env.get('SUPABASE_ENV') ?? 'production',
    functionName,
    startedAt: Date.now(),
    log(level, event, data = {}) {
      const entry = redactEdgeData({
        timestamp: new Date().toISOString(),
        level,
        event,
        function_name: functionName,
        environment: context.environment,
        correlation_id: context.correlationId,
        elapsed_ms: Date.now() - context.startedAt,
        ...data
      });
      const serialized = JSON.stringify(entry);
      if (level === 'error') console.error(serialized);
      else if (level === 'warn') console.warn(serialized);
      else console.log(serialized);
    }
  };
  return context;
}

export function edgeJsonResponse(
  context: EdgeObservabilityContext,
  body: Record<string, unknown>,
  init: ResponseInit = {}
): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  headers.set('x-correlation-id', context.correlationId);
  return new Response(JSON.stringify(body), { ...init, headers });
}
