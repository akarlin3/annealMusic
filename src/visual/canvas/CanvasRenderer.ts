import type { VisualRenderer, VisualState } from '../types';
import { drawFrame } from './draw';

export class CanvasRenderer implements VisualRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;

  mount(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx2d = canvas.getContext('2d');
  }

  unmount(): void {
    this.canvas = null;
    this.ctx2d = null;
  }

  resize(width: number, height: number, dpr: number): void {
    if (!this.canvas || !this.ctx2d) return;
    // Set buffer size to high-DPI pixels
    this.canvas.width = Math.max(1, Math.floor(width * dpr));
    this.canvas.height = Math.max(1, Math.floor(height * dpr));
    // Scale coordinate system to match CSS pixels
    this.ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  drawFrame(state: VisualState): void {
    if (!this.ctx2d) return;
    drawFrame(this.ctx2d, state);
  }

  setQuality(): void {
    // 2D canvas doesn't use quality presets directly, but the preset controls
    // will adjust the overall resolution ceiling in the parent loop if configured.
  }

  dispose(): void {
    this.unmount();
  }
}
