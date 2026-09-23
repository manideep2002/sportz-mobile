/**
 * notificationsShim.ts
 *
 * expo-notifications SDK 53 removed Android push notification support from
 * Expo Go and throws an error **synchronously during module evaluation** on
 * that platform. A static `import` is hoisted and executed before any
 * runtime guard can run, so we use a conditional `require()` instead.
 *
 * This shim returns the real module in development builds / production, and
 * returns `null` (no-op) in Expo Go — callers must handle the null case.
 */
import Constants from 'expo-constants';

// Re-export types only (erased at compile time, zero runtime cost).
export type { NotificationResponse } from 'expo-notifications';

type NotificationsModule = typeof import('expo-notifications');

// Evaluate the guard before touching the module.
const _isExpoGo = Constants.appOwnership === 'expo';

let _mod: NotificationsModule | null = null;

if (!_isExpoGo) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _mod = require('expo-notifications') as NotificationsModule;
  } catch {
    // Native module unavailable (web, or other unsupported runtimes).
  }
}

/**
 * The expo-notifications module, or `null` when running in Expo Go on Android
 * (SDK 53+) or any other environment where the module is unavailable.
 *
 * Always check for null before calling any API:
 *   `Notifications?.setNotificationHandler(...)`
 */
export const Notifications = _mod;
