import { BrowserPlaywrightRenderEngine } from '@/render/BrowserPlaywrightRenderEngine.js';
import type {
  RenderEngine,
  RenderEngineOptions,
  RenderEngineResult,
} from './types.js';

export class BrowserRenderEngine implements RenderEngine {
  private engine = new BrowserPlaywrightRenderEngine();

  async renderPatch(
    payload: string,
    options: RenderEngineOptions,
  ): Promise<RenderEngineResult> {
    return this.engine.render(payload, {
      ...options,
      mode: 'open',
      renderType: 'stems',
    });
  }

  async renderPiece(
    payload: string,
    options: RenderEngineOptions,
  ): Promise<RenderEngineResult> {
    return this.engine.render(payload, {
      ...options,
      mode: 'piece',
      renderType: 'stems',
    });
  }

  async renderListeningSession(
    payload: string,
    options: RenderEngineOptions,
  ): Promise<RenderEngineResult> {
    return this.engine.render(payload, {
      ...options,
      mode: 'listening-session',
      renderType: 'stems',
    });
  }
}
