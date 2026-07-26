import {
  isExpectedError,
  isMonitoringEnabled,
  redactSensitiveData,
  resolveMonitoringEnvironment
} from '@/lib/monitoringPrivacy';

describe('monitoring privacy and environment isolation', () => {
  it('redacts credentials, contact details, chat bodies, and URLs recursively', () => {
    const redacted = redactSensitiveData({
      authorization: 'Bearer secret-token',
      email: 'person@example.com',
      mobile_number: '+91 98765 43210',
      body: 'private chat text',
      nested: {
        detail: 'Contact person@example.com via +1 (415) 555-0100',
        media: 'https://private.example/storage/media.png?token=secret'
      }
    });
    const serialized = JSON.stringify(redacted);

    expect(serialized).not.toContain('secret-token');
    expect(serialized).not.toContain('person@example.com');
    expect(serialized).not.toContain('98765');
    expect(serialized).not.toContain('private chat text');
    expect(serialized).not.toContain('private.example');
  });

  it('isolates test and development events from production', () => {
    expect(isMonitoringEnabled({
      environment: 'test',
      dsn: 'https://dsn.example/1'
    })).toBe(false);
    expect(isMonitoringEnabled({
      environment: 'development',
      dsn: 'https://dsn.example/1'
    })).toBe(false);
    expect(isMonitoringEnabled({
      environment: 'development',
      dsn: 'https://dsn.example/1',
      enableDevelopmentMonitoring: true
    })).toBe(true);
    expect(isMonitoringEnabled({
      environment: 'preview',
      dsn: 'https://dsn.example/1'
    })).toBe(true);
    expect(resolveMonitoringEnvironment('production')).toBe('production');
    expect(resolveMonitoringEnvironment('unknown')).toBe('development');
  });

  it('recognizes expected user validation failures', () => {
    expect(isExpectedError(new Error('Invalid login credentials'))).toBe(true);
    expect(isExpectedError(new Error('File is too large (250 MB).'))).toBe(true);
    expect(isExpectedError(new Error('Database connection timed out'))).toBe(false);
  });
});
