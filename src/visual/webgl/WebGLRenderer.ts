import {
  Renderer,
  Geometry,
  Program,
  Mesh,
  Texture,
  OGLRenderingContext,
} from 'ogl';
import type { VisualRenderer, VisualState } from '../types';
import { ampForFreq } from '../canvas/draw';
import vertShader from './shaders/visual.vert.glsl?raw';
import fragShader from './shaders/visual.frag.glsl?raw';

export class WebGLRenderer implements VisualRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private renderer: Renderer | null = null;
  private gl: OGLRenderingContext | null = null;
  private geometry: Geometry | null = null;
  private program: Program | null = null;
  private mesh: Mesh | null = null;
  private spectrumTexture: Texture | null = null;
  private emptySpectrum = new Uint8Array(512);

  // Configuration and Throttling
  private quality: 'low' | 'medium' | 'high' = 'high';
  private width = 0;
  private height = 0;
  private dpr = 1;
  private scaleFactor = 1.0;

  // Frame monitoring (Dynamic Resolution Scaling)
  private frameTimes: number[] = [];

  // Throttling properties
  private fpsThrottleInterval = 1000 / 5; // 5 FPS in silent mode
  private lastThrottleDrawTime = 0;

  // Uniforms cache to prevent redundant WebGL state calls
  private uCache = {
    u_base_radius: -999,
    u_rms: -999,
    u_input_level: -999,
    u_partial_count: -999,
    u_show_spectrum: -999,
    u_calm: -999,
    u_loop_levels: [-999, -999, -999] as [number, number, number],
    u_loop_frozen: [-999, -999, -999] as [number, number, number],
  };

  mount(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;

    // Bind context loss events
    canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
    canvas.addEventListener(
      'webglcontextrestored',
      this.handleContextRestored,
      false,
    );

    this.initGL();
  }

  private initGL(): void {
    if (!this.canvas) return;

    try {
      this.renderer = new Renderer({
        canvas: this.canvas,
        width: this.width,
        height: this.height,
        dpr: this.dpr,
        alpha: false,
        depth: false,
        stencil: false,
        antialias: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        powerPreference: 'low-power',
      });

      this.gl = this.renderer.gl;
      const gl = this.gl;

      // 1. Geometry: Single Full-Screen Quad (covers -1 to 1 clip space)
      this.geometry = new Geometry(gl, {
        position: {
          size: 2,
          data: new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        },
        uv: {
          size: 2,
          data: new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]),
        },
      });

      // 2. Texture: 512x1 dynamic spectrum buffer
      this.spectrumTexture = new Texture(gl, {
        width: 512,
        height: 1,
        format: (gl as WebGL2RenderingContext).RED || 0x1903,
        internalFormat: (gl as WebGL2RenderingContext).R8 || 0x8229,
        type: gl.UNSIGNED_BYTE,
        minFilter: gl.LINEAR,
        magFilter: gl.LINEAR,
        wrapS: gl.CLAMP_TO_EDGE,
        wrapT: gl.CLAMP_TO_EDGE,
        generateMipmaps: false,
      });

      // 3. Program: Dynamic shader compiler & uniform linker
      this.program = new Program(gl, {
        vertex: vertShader,
        fragment: fragShader,
        uniforms: {
          u_resolution: { value: [this.width, this.height] },
          u_dpr: { value: this.dpr },
          u_base_radius: { value: 0 },
          u_rms: { value: 0.0 },
          u_input_level: { value: -1.0 },
          u_partial_count: { value: 0 },
          u_partials: { value: new Float32Array(16 * 4) },
          u_spectrum: { value: this.spectrumTexture },
          u_show_spectrum: { value: 1 },
          u_loop_levels: { value: [0.0, 0.0, 0.0] },
          u_loop_frozen: { value: [0.0, 0.0, 0.0] },
          u_calm: { value: 0.0 },
        },
      });

      // 4. Mesh: Assemble Geometry + Program
      this.mesh = new Mesh(gl, {
        geometry: this.geometry,
        program: this.program,
      });

      // Run a single off-screen warm-up frame to avoid shader compile lag on first render
      this.renderer.render({ scene: this.mesh });
    } catch (e) {
      console.error('Failed to initialize WebGL2 VisualRenderer:', e);
    }
  }

  unmount(): void {
    if (this.canvas) {
      this.canvas.removeEventListener(
        'webglcontextlost',
        this.handleContextLost,
      );
      this.canvas.removeEventListener(
        'webglcontextrestored',
        this.handleContextRestored,
      );
    }
    this.disposeGL();
    this.canvas = null;
  }

  private disposeGL(): void {
    // Explicit disposal of WebGL resources to prevent GPU memory leaks
    if (this.geometry) this.geometry.remove();
    if (this.spectrumTexture)
      this.spectrumTexture.gl.deleteTexture(this.spectrumTexture.texture);

    this.geometry = null;
    this.program = null;
    this.mesh = null;
    this.spectrumTexture = null;
    this.gl = null;
    this.renderer = null;
  }

  resize(width: number, height: number, dpr: number): void {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.applyResolution();
  }

  private applyResolution(): void {
    if (!this.canvas || !this.renderer) return;

    // Quality-based ceilings
    const qualityCeilings = {
      high: 1.0,
      medium: 0.8,
      low: 0.6,
    };
    const ceiling = qualityCeilings[this.quality] || 1.0;
    const finalFactor = this.scaleFactor * ceiling;

    // Dynamic resolution scaling: adjust canvas buffer resolution, let CSS stretch
    const scaledW = Math.max(
      1,
      Math.floor(this.width * this.dpr * finalFactor),
    );
    const scaledH = Math.max(
      1,
      Math.floor(this.height * this.dpr * finalFactor),
    );

    this.renderer.setSize(scaledW, scaledH);

    if (this.program) {
      this.program.uniforms.u_resolution.value = [scaledW, scaledH];
      this.program.uniforms.u_dpr.value = this.dpr * finalFactor;
    }
  }

  drawFrame(state: VisualState, now: number): void {
    if (!this.gl || !this.program || !this.renderer || !this.mesh) return;

    // Tab visibility check: if tab is hidden, pause draw completely
    if (
      typeof document !== 'undefined' &&
      document.visibilityState === 'hidden'
    ) {
      return;
    }

    // Audio overall RMS calculation
    let rms = 0;
    const spectrum = state.spectrum;
    if (spectrum) {
      let sum = 0;
      for (let i = 0; i < spectrum.length; i++) {
        const val = (spectrum[i] ?? 0) / 255;
        sum += val * val;
      }
      rms = Math.sqrt(sum / spectrum.length);
    }

    // Silence-aware throttling check: if sound is silent (< 0.001) and not playing, drop to 5 FPS
    const isSilent = rms < 0.001 && state.inputLevel === undefined;
    if (isSilent) {
      const elapsed = now - this.lastThrottleDrawTime;
      if (elapsed < this.fpsThrottleInterval) {
        return; // Throttle frame
      }
      this.lastThrottleDrawTime = now;
    }

    const tStart = performance.now();

    // 1. Advance phases in-place and pack partial orbital coordinates
    const cx = state.w / 2;
    const cy = state.h / 2;
    const baseR = Math.min(state.w, state.h) * 0.3; // baseRadiusFactor = 0.3

    const count = Math.min(16, state.count);
    const partialsData = new Float32Array(16 * 4);

    const rVal = state.r ?? 0;
    const isMeditation = state.mode === 'meditation' || state.isCalm;

    for (let i = 0; i < 16; i++) {
      const offset = i * 4;
      if (i < count) {
        const freqHz = state.freqs[i] ?? 0;
        const visualRate = freqHz / 220; // visualRateRef = 220
        const speedScale = isMeditation ? 0.45 : 1.0;
        const phase =
          ((state.phases[i] ?? 0) + visualRate * state.dt * speedScale) %
          (Math.PI * 2);
        state.phases[i] = phase; // Mutate in place

        // Converge orbit radii as synchronization increases (r -> 1)
        const baseOrbitFactor =
          0.45 + 0.55 * (i / Math.max(1, state.count - 1));
        const targetOrbitFactor = 0.725;
        const orbitFactor =
          baseOrbitFactor + (targetOrbitFactor - baseOrbitFactor) * rVal * 0.7;

        const orbit = baseR * orbitFactor;
        const px = cx + Math.cos(phase) * orbit;
        const py = cy + Math.sin(phase) * orbit * 0.78; // orbitSquash = 0.78

        const amp = state.spectrum
          ? ampForFreq(freqHz, state.spectrum, state.sampleRate, state.fftSize)
          : 0.4; // defaultAmp = 0.4

        // Position coordinates in canvas space (we handle scale inside shader via u_resolution and u_dpr)
        // Note: u_dpr in shader matches highDPI ratio, so coordinates here are passed in logical CSS px!
        // We multiply by highDPI factor inside the shader.
        partialsData[offset + 0] = px * this.dpr;
        partialsData[offset + 1] = py * this.dpr;
        partialsData[offset + 2] = freqHz;
        partialsData[offset + 3] = amp;
      }
    }

    // 2. Upload spectrum texture
    if (this.spectrumTexture) {
      if (state.spectrum) {
        this.spectrumTexture.image = state.spectrum;
      } else {
        this.spectrumTexture.image = this.emptySpectrum;
      }
      this.spectrumTexture.needsUpdate = true;
    }

    // 3. Link loop states
    const loopLevels = [0.0, 0.0, 0.0];
    const loopFrozen = [0.0, 0.0, 0.0];
    if (state.loops) {
      for (const loop of state.loops) {
        if (loop.slot >= 0 && loop.slot < 3) {
          loopLevels[loop.slot] = loop.level;
          loopFrozen[loop.slot] = loop.frozen ? 1.0 : 0.0;
        }
      }
    }

    // 4. Update Uniforms selectively if changed
    const program = this.program;
    if (!program) return;
    const u = program.uniforms;

    const nextBaseR = baseR * this.dpr;
    if (this.uCache.u_base_radius !== nextBaseR) {
      u.u_base_radius.value = nextBaseR;
      this.uCache.u_base_radius = nextBaseR;
    }

    if (this.uCache.u_rms !== rms) {
      u.u_rms.value = rms;
      this.uCache.u_rms = rms;
    }

    const nextInputLevel =
      state.inputLevel !== undefined ? state.inputLevel : -1.0;
    if (this.uCache.u_input_level !== nextInputLevel) {
      u.u_input_level.value = nextInputLevel;
      this.uCache.u_input_level = nextInputLevel;
    }

    if (this.uCache.u_partial_count !== count) {
      u.u_partial_count.value = count;
      this.uCache.u_partial_count = count;
    }

    const nextShowSpectrum = state.spectrum ? 1 : 0;
    if (this.uCache.u_show_spectrum !== nextShowSpectrum) {
      u.u_show_spectrum.value = nextShowSpectrum;
      this.uCache.u_show_spectrum = nextShowSpectrum;
    }

    const nextCalm = isMeditation ? 1.0 : 0.0;
    if (this.uCache.u_calm !== nextCalm) {
      u.u_calm.value = nextCalm;
      this.uCache.u_calm = nextCalm;
    }

    let levelsChanged = false;
    let frozenChanged = false;
    for (let i = 0; i < 3; i++) {
      if (this.uCache.u_loop_levels[i] !== loopLevels[i]) {
        this.uCache.u_loop_levels[i] = loopLevels[i]!;
        levelsChanged = true;
      }
      if (this.uCache.u_loop_frozen[i] !== loopFrozen[i]) {
        this.uCache.u_loop_frozen[i] = loopFrozen[i]!;
        frozenChanged = true;
      }
    }
    if (levelsChanged) {
      u.u_loop_levels.value = this.uCache.u_loop_levels;
    }
    if (frozenChanged) {
      u.u_loop_frozen.value = this.uCache.u_loop_frozen;
    }

    // Always update partialsData since it represents 60fps dynamic orbit phases
    u.u_partials.value = partialsData;

    // 5. Render Scene
    this.renderer.render({ scene: this.mesh });

    // 6. Dynamic Resolution Scaling heuristic
    const tEnd = performance.now();
    const frameTime = tEnd - tStart;

    if (!isSilent) {
      this.frameTimes.push(frameTime);
      if (this.frameTimes.length > 60) {
        this.frameTimes.shift();
      }

      // Periodically check framerate health (every 60 frames)
      if (this.frameTimes.length === 60) {
        const avgFrameTime =
          this.frameTimes.reduce((acc, t) => acc + t, 0) / 60;

        if (avgFrameTime > 18.0) {
          // Downscale to save fillrate (cap at 0.5x minimum)
          this.scaleFactor = Math.max(0.5, this.scaleFactor * 0.85);
          this.applyResolution();
          this.frameTimes = []; // Reset window
        } else if (avgFrameTime < 12.0 && this.scaleFactor < 1.0) {
          // Upscale back toward ceiling
          this.scaleFactor = Math.min(1.0, this.scaleFactor * 1.1);
          this.applyResolution();
          this.frameTimes = []; // Reset window
        }
      }
    }
  }

  setQuality(level: 'low' | 'medium' | 'high'): void {
    this.quality = level;
    this.applyResolution();
  }

  dispose(): void {
    this.unmount();
  }

  // Context Loss Handlers
  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    console.warn('WebGL2 context lost! Suspending rendering.');
    this.disposeGL();
  };

  private handleContextRestored = (): void => {
    console.info(
      'WebGL2 context successfully restored! Reinitializing resources.',
    );
    this.initGL();
    this.applyResolution();
  };
}
