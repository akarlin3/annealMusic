export interface CrashReport {
  message: string;
  stack?: string;
  version: string;
  buildSha: string;
  browserOS: string;
  sanitizedUrl: string;
  context?: string;
  timestamp: string;
}

const OPT_IN_KEY = 'am_error_reporting_opt_in';
const VERSION = '8.3.0';
const BUILD_SHA = (import.meta.env?.VITE_BUILD_SHA as string) || 'v8.3.0-dev';

export function getOptInStatus(): boolean | null {
  if (typeof window === 'undefined') return null;
  const val = localStorage.getItem(OPT_IN_KEY);
  if (val === 'true') return true;
  if (val === 'false') return false;
  return null;
}

export function setOptInStatus(optIn: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(OPT_IN_KEY, String(optIn));
}

export function scrubUrl(url: string): string {
  try {
    const parsed = new URL(url);
    let path = parsed.pathname;

    path = path.replace(/\/p\/[^/]+/g, '/p/:slug');
    path = path.replace(/\/jam\/[^/]+/g, '/jam/:id');
    path = path.replace(/\/listening\/[^/]+/g, '/listening/:slug');
    path = path.replace(/\/piece\/[^/]+/g, '/piece/:slug');
    path = path.replace(/\/r\/[^/]+/g, '/r/:slug');
    path = path.replace(/\/u\/[^/]+/g, '/u/:account_id');
    path = path.replace(/\/experiment\/[^/]+/g, '/experiment/:slug');
    path = path.replace(/\/clinical\/[^/]+/g, '/clinical/:slug');

    return path;
  } catch {
    return '/unknown';
  }
}

export function getBrowserOSClass(ua: string): string {
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';

  if (/android/i.test(ua)) {
    os = 'Android';
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    os = 'iOS';
  } else if (/macintosh|mac os x/i.test(ua)) {
    os = 'macOS';
  } else if (/windows/i.test(ua)) {
    os = 'Windows';
  } else if (/linux/i.test(ua)) {
    os = 'Linux';
  }

  if (/firefox|fxios/i.test(ua)) {
    browser = 'Firefox';
  } else if (/edge|edg/i.test(ua)) {
    browser = 'Edge';
  } else if (/opr/i.test(ua)) {
    browser = 'Opera';
  } else if (/chrome|crios/i.test(ua)) {
    browser = 'Chrome';
  } else if (/safari/i.test(ua)) {
    browser = 'Safari';
  }

  return `${browser}/${os}`;
}

export async function reportError(
  error: Error | string | unknown,
  context?: string,
): Promise<void> {
  if (getOptInStatus() !== true) {
    return;
  }

  try {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const currentUrl =
      typeof window !== 'undefined' ? window.location.href : '';

    const payload: CrashReport = {
      message: msg,
      stack,
      version: VERSION,
      buildSha: BUILD_SHA,
      browserOS: getBrowserOSClass(ua),
      sanitizedUrl: scrubUrl(currentUrl),
      context,
      timestamp: new Date().toISOString(),
    };

    // Self-hosted error reporter POST endpoint.
    const baseUrl = import.meta.env?.VITE_API_URL || '';
    await fetch(`${baseUrl}/api/v1/observability/crash-reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn('Failed to send anonymized telemetry report:', e);
  }
}

let isInitialized = false;

export function initializeErrorReporter(): void {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  window.addEventListener('error', (event) => {
    void reportError(event.error || event.message, 'uncaught-runtime-error');
  });

  window.addEventListener('unhandledrejection', (event) => {
    void reportError(event.reason, 'unhandled-promise-rejection');
  });

  console.log(
    '[Observability] Privacy-preserving client error reporter initialized.',
  );
}
