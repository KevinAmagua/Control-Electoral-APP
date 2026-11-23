import * as Sentry from '@sentry/react-native';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const SENSITIVE_KEY_PATTERN =
  /(cedula|first_name|last_name|phone|email|correo|nombre|apellido|telefono|password|clave|token)/i;

let initialized = false;

function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 8 || value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, depth + 1));
  }
  if (typeof value !== 'object') {
    return typeof value === 'string' && SENSITIVE_KEY_PATTERN.test(value) ? '[REDACTADO]' : value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    result[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTADO]' : scrubValue(nested, depth + 1);
  }
  return result;
}

export function initializeSentry(): void {
  if (initialized) {
    return;
  }
  initialized = true;

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    sendDefaultPii: false,
    enableNativeCrashHandling: true,
    enableAutoSessionTracking: true,
    tracesSampleRate: 0,
    beforeSend: (event) => scrubValue(event) as Sentry.ErrorEvent,
  });

  Sentry.setContext('device', {
    model: Device.modelName,
    brand: Device.brand,
    osName: Device.osName,
    osVersion: Device.osVersion,
    androidVersion: Platform.OS === 'android' ? Platform.Version : null,
    isDevice: Device.isDevice,
  });
}

export function setSentryScreen(path: string): void {
  Sentry.setTag('screen', path);
  Sentry.setContext('screen', { path });
}

export function setSentryUser(id: string | null): void {
  Sentry.setUser(id ? { id } : null);
}

export function captureError(error: unknown, context?: Record<string, unknown>): void {
  Sentry.captureException(error instanceof Error ? error : new Error(String(error)), {
    contexts: context ? { app: scrubValue(context) as Record<string, string> } : undefined,
  });
}
