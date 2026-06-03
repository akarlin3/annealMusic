import type { VisualRenderer } from './types';
import { CanvasRenderer } from './canvas/CanvasRenderer';
import { WebGLRenderer } from './webgl/WebGLRenderer';
import { probeWebGL2, resetWebGL2ProbeCache } from './capabilityProbe';

export * from './types';
export { probeWebGL2, resetWebGL2ProbeCache };

export interface RendererOptions {
  renderer: 'auto' | 'canvas' | 'webgl';
}

/**
 * Creates and returns the appropriate VisualRenderer implementation based on
 * hardware capabilities and user preferences.
 */
export function createVisualRenderer(
  options: RendererOptions = { renderer: 'auto' },
): VisualRenderer {
  const cap = probeWebGL2();

  if (options.renderer === 'webgl' && cap.webgl_supported) {
    return new WebGLRenderer();
  }

  if (options.renderer === 'auto' && cap.webgl_supported) {
    return new WebGLRenderer();
  }

  // Fall back to Canvas for explicit choice or unsupported hardware
  return new CanvasRenderer();
}
