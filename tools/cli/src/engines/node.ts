import { NodeOfflineRenderEngine } from '@/render/NodeOfflineRenderEngine.js';
import type {
  RenderEngine,
  RenderEngineOptions,
  RenderEngineResult,
} from './types.js';

export class NodeRenderEngine implements RenderEngine {
  private engine = new NodeOfflineRenderEngine();

  async renderPatch(
    payload: string,
    options: RenderEngineOptions,
  ): Promise<RenderEngineResult> {
    return this.engine.render(payload, {
      ...options,
      mode: 'open',
    });
  }

  async renderPiece(
    payload: string,
    options: RenderEngineOptions,
  ): Promise<RenderEngineResult> {
    return this.engine.render(payload, {
      ...options,
      mode: 'piece',
    });
  }

  async renderListeningSession(
    payload: string,
    options: RenderEngineOptions,
  ): Promise<RenderEngineResult> {
    return this.engine.render(payload, {
      ...options,
      mode: 'listening-session',
    });
  }
}
