import * as Sentry from '@sentry/node';
import { Transaction } from '@sentry/tracing';

/**
 * Sentry Configuration for Looped Agent
 * Error monitoring and tracing
 */

export function initSentry(dsn?: string): void {
  Sentry.init({
    dsn: dsn || process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',

    // Performance monitoring
    tracesSampleRate: 1.0,

    // Release tracking
    release: process.env.AGENT_VERSION || '1.0.0',

    // Filter events
    beforeSend(event) {
      // Don't send events in local development
      if (process.env.NODE_ENV === 'development') {
        return null;
      }
      return event;
    },

    // Ignore certain errors
    ignoreErrors: [/Network Error/i, /fetch failed/i],
  });
}

/**
 * Capture an error with context
 */
export function captureError(
  error: Error,
  context?: Record<string, unknown>
): void {
  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture a message with level
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info'
): void {
  Sentry.captureMessage(message, level);
}

/**
 * Add user context
 */
export function setUserContext(userId: string, email?: string): void {
  Sentry.setUser({
    id: userId,
    email,
  });
}

/**
 * Add custom tags
 */
export function setTags(tags: Record<string, string>): void {
  Object.entries(tags).forEach(([key, value]) => {
    Sentry.setTag(key, value);
  });
}

/**
 * Create a transaction span
 */
export function startTransaction(name: string, op: string): Transaction {
  return new Transaction({
    name,
    op,
  });
}
