import * as Sentry from "@sentry/nextjs";

// Sentry in the browser. Off when NEXT_PUBLIC_SENTRY_DSN is unset.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
    tracesSampleRate: 0,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
