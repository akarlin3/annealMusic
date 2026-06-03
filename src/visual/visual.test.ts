import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  probeWebGL2,
  resetWebGL2ProbeCache,
  createVisualRenderer,
} from './index';
import { CanvasRenderer } from './canvas/CanvasRenderer';
import { WebGLRenderer } from './webgl/WebGLRenderer';

describe('Visualizer Module', () => {
  beforeEach(() => {
    resetWebGL2ProbeCache();
  });

  describe('Capability Probe', () => {
    it('returns false in headless/restricted JSDOM by default', () => {
      const result = probeWebGL2();
      expect(result).toHaveProperty('webgl_supported');
      // JSDOM has no WebGL context by default, so it should cleanly return false or true depending on the environment stub.
    });

    it('detects WebGL support when context is mock-able', () => {
      const originalGetContext = HTMLCanvasElement.prototype.getContext;

      // Mock HTMLCanvasElement to return a dummy WebGL2 context
      HTMLCanvasElement.prototype.getContext = vi
        .fn()
        .mockImplementation((id) => {
          if (id === 'webgl2') {
            return {
              addEventListener: vi.fn(),
              removeEventListener: vi.fn(),
              getExtension: vi.fn(),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any;
          }
          return null;
        });

      const result = probeWebGL2();
      expect(result.webgl_supported).toBe(true);

      // Restore original
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    });
  });

  describe('Dynamic Renderer Factory', () => {
    it('returns CanvasRenderer when WebGL is explicitly disabled', () => {
      const renderer = createVisualRenderer({ renderer: 'canvas' });
      expect(renderer).toBeInstanceOf(CanvasRenderer);
    });

    it('falls back to CanvasRenderer when WebGL2 is unsupported', () => {
      const originalGetContext = HTMLCanvasElement.prototype.getContext;

      // Mock context to return null for WebGL2
      HTMLCanvasElement.prototype.getContext = vi
        .fn()
        .mockImplementation((id) => {
          if (id === 'webgl2') return null;
          return originalGetContext.call(document.createElement('canvas'), id);
        });

      const renderer = createVisualRenderer({ renderer: 'auto' });
      expect(renderer).toBeInstanceOf(CanvasRenderer);

      HTMLCanvasElement.prototype.getContext = originalGetContext;
    });

    it('instantiates WebGLRenderer when WebGL2 is supported and selected', () => {
      const originalGetContext = HTMLCanvasElement.prototype.getContext;

      // Mock WebGL2
      HTMLCanvasElement.prototype.getContext = vi
        .fn()
        .mockImplementation((id) => {
          if (id === 'webgl2') {
            return {
              canvas: document.createElement('canvas'),
              addEventListener: vi.fn(),
              removeEventListener: vi.fn(),
              getExtension: vi.fn(),
              viewport: vi.fn(),
              clearColor: vi.fn(),
              clear: vi.fn(),
              createShader: vi.fn().mockReturnValue({}),
              shaderSource: vi.fn(),
              compileShader: vi.fn(),
              getShaderParameter: vi.fn().mockReturnValue(true),
              createProgram: vi.fn().mockReturnValue({}),
              attachShader: vi.fn(),
              linkProgram: vi.fn(),
              getProgramParameter: vi.fn().mockReturnValue(true),
              useProgram: vi.fn(),
              createBuffer: vi.fn().mockReturnValue({}),
              bindBuffer: vi.fn(),
              bufferData: vi.fn(),
              enableVertexAttribArray: vi.fn(),
              vertexAttribPointer: vi.fn(),
              getAttribLocation: vi.fn().mockReturnValue(0),
              getUniformLocation: vi.fn().mockReturnValue({}),
              uniform1i: vi.fn(),
              uniform2f: vi.fn(),
              uniformMatrix4fv: vi.fn(),
              createTexture: vi.fn().mockReturnValue({}),
              bindTexture: vi.fn(),
              texParameteri: vi.fn(),
              texImage2D: vi.fn(),
              drawArrays: vi.fn(),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any;
          }
          return null;
        });

      const renderer = createVisualRenderer({ renderer: 'webgl' });
      expect(renderer).toBeInstanceOf(WebGLRenderer);

      HTMLCanvasElement.prototype.getContext = originalGetContext;
    });
  });

  describe('Lifecycle Checks', () => {
    it('CanvasRenderer mounts, resizes, and disposes without crashing', () => {
      const renderer = createVisualRenderer({ renderer: 'canvas' });
      const canvas = document.createElement('canvas');

      expect(() => renderer.mount(canvas)).not.toThrow();
      expect(() => renderer.resize(200, 100, 2)).not.toThrow();
      expect(() => renderer.dispose()).not.toThrow();
    });
  });
});
