import * as Sentry from "@sentry/nextjs";

/**
 * Sentry on the server (SPEC › Tech stack: monitoring). Off when
 * NEXT_PUBLIC_SENTRY_DSN is unset, e.g. locally and in CI.
 */
export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.CONTEXT,
    tracesSampleRate: 0,
    // dataCollection keeps Sentry's defaults, which leave out user details,
    // cookies and request bodies.
  });
}

// Reports errors from Server Components, route handlers and server actions.
// Does nothing while Sentry isn't initialised.
export const onRequestError = Sentry.captureRequestError;
