import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import * as Sentry from '@sentry/react-native';

import { env } from '@/lib/env';
import {
  isExpectedError,
  isMonitoringEnabled,
  redactSensitiveData
} from '@/lib/monitoringPrivacy';

interface CaptureContext {
  operation: string;
  correlationId?: string;
  expected?: boolean;
  tags?: Record<string, string | number | boolean | undefined>;
  extra?: Record<string, unknown>;
}

const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true
});

let initialized = false;
let activeRoute: string | undefined;

const appVersion = Constants.expoConfig?.version ?? '0.0.0';
const runtimeVersion = Updates.runtimeVersion ?? appVersion;
const updateId = Updates.updateId ?? 'embedded';
const release = `sportz-mobile@${appVersion}`;

export function createCorrelationId(prefix = 'mobile'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function initializeMonitoring(): void {
  if (initialized || !isMonitoringEnabled({
    environment: env.appEnvironment,
    dsn: env.sentryDsn,
    enableDevelopmentMonitoring: env.enableDevelopmentMonitoring
  })) {
    return;
  }

  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.appEnvironment,
    release,
    dist: updateId,
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    enableAutoSessionTracking: true,
    tracesSampleRate: env.appEnvironment === 'production' ? 0.1 : 1,
    integrations: [navigationIntegration],
    beforeSend(event) {
      return redactSensitiveData(event) as typeof event;
    },
    beforeBreadcrumb(breadcrumb) {
      return redactSensitiveData(breadcrumb) as typeof breadcrumb;
    },
    initialScope: {
      tags: {
        app_environment: env.appEnvironment,
        app_version: appVersion,
        runtime_version: runtimeVersion,
        update_id: updateId
      }
    }
  });
  initialized = true;
}

export function registerNavigationContainer(container: unknown): void {
  if (!initialized) return;
  navigationIntegration.registerNavigationContainer(container);
}

export function recordNavigationRoute(routeName?: string): void {
  if (!initialized || !routeName || routeName === activeRoute) return;
  activeRoute = routeName;
  Sentry.setTag('route', routeName);
  Sentry.setContext('navigation', { route: routeName });
  Sentry.addBreadcrumb({
    category: 'navigation',
    type: 'navigation',
    level: 'info',
    message: routeName,
    data: { route: routeName }
  });
}

export function captureUnexpectedError(error: unknown, context: CaptureContext): string | undefined {
  if (!initialized || context.expected || isExpectedError(error)) return undefined;

  const correlationId = context.correlationId ?? createCorrelationId();
  const safeExtra = redactSensitiveData(context.extra ?? {}) as Record<string, unknown>;
  const safeTags = redactSensitiveData(context.tags ?? {}) as Record<string, string | number | boolean>;

  return Sentry.captureException(error, {
    tags: {
      operation: context.operation,
      correlation_id: correlationId,
      route: activeRoute ?? 'unknown',
      ...safeTags
    },
    contexts: {
      operation: {
        name: context.operation,
        correlation_id: correlationId
      }
    },
    extra: safeExtra
  });
}

export function captureControlledTestError(): string | undefined {
  return captureUnexpectedError(new Error('Controlled observability test error'), {
    operation: 'observability.controlled_test',
    correlationId: createCorrelationId('test')
  });
}

export const monitoringMetadata = {
  environment: env.appEnvironment,
  release,
  runtimeVersion,
  updateId
};
