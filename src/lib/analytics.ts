import { IS_PRODUCTION, POSTHOG_HOST, POSTHOG_KEY } from "./config.ts";

/**
 * PostHog error-tracking wrapper.
 * NOOP in development; in production, autocaptures unhandled exceptions and
 * exposes a manual `captureException` for caught error paths.
 */

interface Analytics {
  captureException(error: unknown, properties?: Record<string, unknown>): void;
}

const noop: Analytics = {
  captureException() {},
};

let analytics: Analytics = noop;

export function initAnalytics(): void {
  if (!IS_PRODUCTION || !POSTHOG_KEY) {
    return;
  }

  const script = document.createElement("script");
  script.src = "https://us-assets.i.posthog.com/static/array.js";
  script.onload = () => {
    // deno-lint-ignore no-explicit-any
    const posthog = (window as any).posthog;
    if (posthog) {
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        capture_exceptions: true,
        person_profiles: "identified_only",
      });
      analytics = {
        captureException: (error, properties) =>
          posthog.captureException(error, properties),
      };
    }
  };
  document.head.appendChild(script);
}

export function captureException(
  error: unknown,
  properties?: Record<string, unknown>,
): void {
  analytics.captureException(error, properties);
}
