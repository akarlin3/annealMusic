import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getOptInStatus,
  setOptInStatus,
  scrubUrl,
  getBrowserOSClass,
  reportError,
} from '../errorReporter';

describe('Error Reporter Consent and Anonymization', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('Consent Gating', () => {
    it('defaults to null when no preference is set', () => {
      expect(getOptInStatus()).toBeNull();
    });

    it('correctly tracks and updates consent status', () => {
      setOptInStatus(true);
      expect(getOptInStatus()).toBe(true);

      setOptInStatus(false);
      expect(getOptInStatus()).toBe(false);
    });
  });

  describe('Scrubbing Filters', () => {
    it('replaces dynamic slugs and identifiers in URL paths', () => {
      expect(scrubUrl('http://localhost:5173/p/calming-waves-123')).toBe(
        '/p/:slug',
      );
      expect(
        scrubUrl('https://anneal.averykarlin.org/jam/session-xyz-abc'),
      ).toBe('/jam/:id');
      expect(scrubUrl('http://localhost:5173/listening/deep-focus-bell')).toBe(
        '/listening/:slug',
      );
      expect(scrubUrl('https://localhost/u/user-987654')).toBe(
        '/u/:account_id',
      );
      expect(scrubUrl('https://localhost/experiment/exp-99')).toBe(
        '/experiment/:slug',
      );
    });

    it('strips all query parameters and hash components', () => {
      expect(
        scrubUrl(
          'http://localhost:5173/gallery?search=ambient&sort=new#header',
        ),
      ).toBe('/gallery');
      expect(
        scrubUrl('http://localhost:5173/p/sleep-patch?token=xyz_key'),
      ).toBe('/p/:slug');
    });

    it('handles invalid or empty URLs gracefully', () => {
      expect(scrubUrl('not-a-valid-url')).toBe('/unknown');
    });
  });

  describe('Browser & OS Classification', () => {
    it('identifies Chrome on Android correctly', () => {
      const ua =
        'Mozilla/5.0 (Linux; Android 10; SM-A205U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
      expect(getBrowserOSClass(ua)).toBe('Chrome/Android');
    });

    it('identifies Safari on macOS correctly', () => {
      const ua =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
      expect(getBrowserOSClass(ua)).toBe('Safari/macOS');
    });

    it('identifies Firefox on iOS correctly', () => {
      const ua =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/30.0 Mobile/15E148 Safari/605.1.15';
      expect(getBrowserOSClass(ua)).toBe('Firefox/iOS');
    });
  });

  describe('Telemetry Reporting Gating', () => {
    it('does NOT send fetch report when user is opted out', async () => {
      const fetchSpy = vi
        .spyOn(window, 'fetch')
        .mockResolvedValue(new Response());
      setOptInStatus(false);

      await reportError(new Error('Test failure'), 'test-context');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('does NOT send fetch report when consent is not yet given (null)', async () => {
      const fetchSpy = vi
        .spyOn(window, 'fetch')
        .mockResolvedValue(new Response());

      await reportError('String error message', 'test-context');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('sends fully anonymized payload when user has opted in', async () => {
      const fetchSpy = vi
        .spyOn(window, 'fetch')
        .mockResolvedValue(new Response());
      setOptInStatus(true);

      // Override global properties for test stability
      vi.stubGlobal('location', {
        href: 'http://localhost:5173/p/ambient-sleep-99?token=123',
      });
      vi.stubGlobal('navigator', {
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      });

      await reportError(new Error('Fatal synth failure'), 'synth-mount');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const firstCall = fetchSpy.mock.calls[0] as [
        string | URL,
        RequestInit | undefined,
      ];
      const [url, options] = firstCall;
      expect(url).toContain('/api/v1/observability/crash-reports');
      expect(options?.method).toBe('POST');

      const payload = JSON.parse(options?.body as string);
      expect(payload.message).toBe('Fatal synth failure');
      expect(payload.browserOS).toBe('Chrome/macOS');
      expect(payload.sanitizedUrl).toBe('/p/:slug');
      expect(payload.context).toBe('synth-mount');
      expect(payload.version).toBe('8.3.0');
    });
  });
});
