export interface CapabilityResult {
  webgl_supported: boolean;
  reason?: string;
}

/**
 * Probes the current browser environment for WebGL2 support.
 * Securely wrapped to prevent crashes in SSR or old/restricted WebView containers.
 */
let cachedResult: CapabilityResult | null = null;

export function probeWebGL2(): CapabilityResult {
  if (cachedResult) return cachedResult;

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { webgl_supported: false, reason: 'Non-browser/SSR environment' };
  }

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      depth: false,
      stencil: false,
      antialias: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });

    if (!gl) {
      cachedResult = {
        webgl_supported: false,
        reason: 'WebGL2 context creation returned null',
      };
      return cachedResult;
    }

    cachedResult = { webgl_supported: true };
    return cachedResult;
  } catch (err) {
    cachedResult = {
      webgl_supported: false,
      reason:
        err instanceof Error
          ? err.message
          : 'WebGL2 context creation exception',
    };
    return cachedResult;
  }
}

export function resetWebGL2ProbeCache(): void {
  cachedResult = null;
}
