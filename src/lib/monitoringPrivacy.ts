export type MonitoringEnvironment = 'development' | 'preview' | 'production' | 'test';

const REDACTED = '[REDACTED]';
const REDACTED_URL = '[REDACTED_URL]';

const sensitiveKeyPattern =
  /(^|_)(authorization|cookie|password|passcode|secret|token|jwt|email|e_mail|phone|mobile|mobile_number|chat_body|message_body|body|media_url|media_uri|private_url|signed_url|avatar_url|cover_url|object_name|storage_path)($|_)/i;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const bearerPattern = /\bBearer\s+[A-Za-z0-9._~+/=-]+\b/gi;
const jwtPattern = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const phonePattern = /(?<![\w-])(?:\+?\d[\d ()-]{7,}\d)(?![\w-])/g;
const urlPattern = /\bhttps?:\/\/[^\s"'<>]+/gi;

export interface MonitoringRuntimeConfig {
  environment: MonitoringEnvironment;
  dsn?: string;
  enableDevelopmentMonitoring?: boolean;
}

export function resolveMonitoringEnvironment(value?: string): MonitoringEnvironment {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'production' || normalized === 'preview' || normalized === 'test') {
    return normalized;
  }
  return 'development';
}

export function isMonitoringEnabled(config: MonitoringRuntimeConfig): boolean {
  if (!config.dsn?.trim() || config.environment === 'test') return false;
  if (config.environment === 'development') return Boolean(config.enableDevelopmentMonitoring);
  return true;
}

export function redactSensitiveString(value: string): string {
  return value
    .replace(bearerPattern, `Bearer ${REDACTED}`)
    .replace(jwtPattern, REDACTED)
    .replace(emailPattern, REDACTED)
    .replace(phonePattern, REDACTED)
    .replace(urlPattern, REDACTED_URL);
}

export function redactSensitiveData(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') return redactSensitiveString(value);
  if (value === null || value === undefined || typeof value !== 'object') return value;

  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item, seen));
  }

  const source = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(source)) {
    output[key] = sensitiveKeyPattern.test(key) ? REDACTED : redactSensitiveData(item, seen);
  }
  return output;
}

export function isExpectedError(error: unknown): boolean {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : '';

  return [
    /invalid (login|credentials|email|password|input|details)/i,
    /must be signed in/i,
    /permission is required/i,
    /file is too large/i,
    /video is too long/i,
    /not an allowed (file|media|mime)/i,
    /already (joined|booked|exists|registered)/i,
    /event is full/i,
    /slot is (already )?(booked|unavailable)/i,
    /request was cancelled/i
  ].some((pattern) => pattern.test(message));
}
