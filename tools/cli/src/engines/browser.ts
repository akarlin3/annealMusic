/* eslint-disable */
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import type {
  RenderEngine,
  RenderEngineOptions,
  RenderEngineResult,
} from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Starts a lightweight, programmatically controlled static server.
 */
function startStaticServer(
  rootDirs: string[],
): Promise<{ port: number; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url || '').split('?')[0] || '';

      let foundPath = '';
      for (const rootDir of rootDirs) {
        const fullPath = path.join(
          rootDir,
          urlPath === '/' ? 'render.html' : urlPath,
        );
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
          foundPath = fullPath;
          break;
        }
      }

      if (!foundPath) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }

      const ext = path.extname(foundPath);
      const mimeTypes: Record<string, string> = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.wasm': 'application/wasm',
      };

      res.writeHead(200, {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      });
      fs.createReadStream(foundPath).pipe(res);
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      resolve({
        port: addr.port,
        close: () =>
          new Promise<void>((resClose) => server.close(() => resClose())),
      });
    });

    server.on('error', (err) => reject(err));
  });
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const buf = Buffer.from(b64, 'base64');
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

export class BrowserRenderEngine implements RenderEngine {
  private getRootDirs(): string[] {
    return [
      path.resolve(__dirname, '../../../dist'), // local dev structure tools/cli/dist/index.js -> dist
      path.resolve(__dirname, '../dist'), // packaged structure
      path.resolve(process.cwd(), 'dist'),
      path.resolve(process.cwd(), '../../dist'),
    ];
  }

  private async executeBrowserRender(
    payload: string,
    options: RenderEngineOptions,
  ): Promise<RenderEngineResult> {
    const rootDirs = this.getRootDirs();
    const { port, close } = await startStaticServer(rootDirs);
    const renderUrl = `http://127.0.0.1:${port}/render.html`;

    const browser = await chromium.launch({
      args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox'],
    });

    const page = await browser.newPage();
    try {
      await page.goto(renderUrl);

      // Wait for page to fully load and register __annealStemsRender
      await page.waitForFunction(
        () => typeof (window as any).__annealStemsRender === 'function',
        { timeout: 15000 },
      );

      // Run stems render inside the browser's native OfflineAudioContext
      const results: Record<string, string> = await page.evaluate(
        async ([payloadStr, opts]) => {
          const stems = await (window as any).__annealStemsRender(
            payloadStr,
            opts,
          );
          return stems;
        },
        [
          payload,
          {
            durationSec: options.durationSec,
            sampleRate: options.sampleRate,
            bitDepth: options.bitDepth,
            perPartial: options.perPartial,
            withFx: options.withFx,
            seed: options.seed,
          },
        ],
      );

      // Convert Base64 results back to ArrayBuffers
      const outputs: Record<string, ArrayBuffer> = {};
      for (const [key, b64] of Object.entries(results)) {
        outputs[key] = base64ToBuffer(b64);
      }

      return { outputs };
    } finally {
      await page.close();
      await browser.close();
      await close();
    }
  }

  async renderPatch(
    payload: string,
    options: RenderEngineOptions,
  ): Promise<RenderEngineResult> {
    return this.executeBrowserRender(payload, options);
  }

  async renderPiece(
    payload: string,
    options: RenderEngineOptions,
  ): Promise<RenderEngineResult> {
    return this.executeBrowserRender(payload, options);
  }

  async renderListeningSession(
    payload: string,
    options: RenderEngineOptions,
  ): Promise<RenderEngineResult> {
    return this.executeBrowserRender(payload, options);
  }
}
