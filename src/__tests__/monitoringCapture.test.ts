const mockCaptureException = jest.fn(() => 'event-id');
const mockInit = jest.fn();

jest.mock('@sentry/react-native', () => ({
  init: (...args: unknown[]) => mockInit(...args),
  captureException: (...args: unknown[]) => mockCaptureException(...args),
  reactNavigationIntegration: () => ({
    registerNavigationContainer: jest.fn()
  }),
  addBreadcrumb: jest.fn(),
  setContext: jest.fn(),
  setTag: jest.fn()
}));

jest.mock('expo-updates', () => ({
  updateId: 'preview-update'
}));

jest.mock('@/lib/env', () => ({
  env: {
    appEnvironment: 'preview',
    sentryDsn: 'https://public@example.invalid/1',
    enableDevelopmentMonitoring: false
  }
}));

import {
  captureUnexpectedError,
  initializeMonitoring
} from '@/lib/monitoring';

describe('controlled monitoring capture', () => {
  beforeAll(() => {
    initializeMonitoring();
  });

  beforeEach(() => {
    mockCaptureException.mockClear();
  });

  it('captures a controlled unexpected exception with redacted context', () => {
    captureUnexpectedError(new Error('Controlled failure'), {
      operation: 'observability.test',
      correlationId: 'test-correlation-123',
      extra: {
        email: 'person@example.com',
        body: 'private chat text',
        safeCount: 2
      }
    });

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const [, context] = mockCaptureException.mock.calls[0] as [
      Error,
      { tags: Record<string, unknown>; extra: Record<string, unknown> }
    ];
    expect(context.tags.operation).toBe('observability.test');
    expect(context.tags.correlation_id).toBe('test-correlation-123');
    expect(context.extra.email).toBe('[REDACTED]');
    expect(context.extra.body).toBe('[REDACTED]');
    expect(context.extra.safeCount).toBe(2);
  });

  it('does not capture expected validation errors', () => {
    captureUnexpectedError(new Error('Invalid login credentials'), {
      operation: 'auth.sign_in_password'
    });
    expect(mockCaptureException).not.toHaveBeenCalled();
  });
});
