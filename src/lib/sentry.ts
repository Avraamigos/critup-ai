import * as Sentry from '@sentry/react'

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined

export function initSentry() {
  if (!dsn) return  // no DSN in env → disabled (dev / not configured)

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,   // 'production' | 'development'
    // Only send errors in production — keeps free quota for what matters
    enabled: import.meta.env.PROD,
    // Capture 10% of sessions for performance tracing (keeps quota low)
    tracesSampleRate: 0.1,
    // Replay 1% of sessions, 100% when an error occurs
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1.0,
    // Ignore known noise
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
    ],
    beforeSend(event) {
      // Strip PII from breadcrumbs before sending
      return event
    },
  })
}

// Tag the current user so errors in Sentry link to a user ID
export function setSentryUser(id: string | null, email?: string | null) {
  if (!dsn) return
  if (id) {
    Sentry.setUser({ id, email: email ?? undefined })
  } else {
    Sentry.setUser(null)
  }
}
