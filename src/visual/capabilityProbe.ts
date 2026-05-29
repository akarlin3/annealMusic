export interface CapabilityResult {
  webgl_supported: boolean;
  reason?: string;
}

/**
 * Probes the current browser environment for WebGL2 support.
 * Securely wrapped to prevent crashes in SSR or old/restricted WebView containers.
 */
export function probeWebGL2(): CapabilityResult {
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
      return {
        webgl_supported: false,
        reason: 'WebGL2 context creation returned null',
      };
    }

    return { webgl_supported: true };
  } catch (err) {
    return {
      webgl_supported: false,
      reason:
        err instanceof Error
          ? err.message
          : 'WebGL2 context creation exception',
    };
  }
}
