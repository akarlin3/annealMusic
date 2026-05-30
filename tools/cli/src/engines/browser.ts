/* eslint-disable */
import type {
  RenderEngine,
  RenderEngineOptions,
  RenderEngineResult,
} from './types.js';

export class BrowserRenderEngine implements RenderEngine {
  async renderPatch(
    payload: string,
    options: RenderEngineOptions,
  ): Promise<RenderEngineResult> {
    throw new Error('Option B Browser Engine not implemented yet.');
  }
  async renderPiece(
    payload: string,
    options: RenderEngineOptions,
  ): Promise<RenderEngineResult> {
    throw new Error('Option B Browser Engine not implemented yet.');
  }
  async renderListeningSession(
    payload: string,
    options: RenderEngineOptions,
  ): Promise<RenderEngineResult> {
    throw new Error('Option B Browser Engine not implemented yet.');
  }
}
