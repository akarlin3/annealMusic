/* eslint-disable @typescript-eslint/no-explicit-any */
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RenderEngine, RenderOptions, RenderResult } from './types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

export class BrowserPlaywrightRenderEngine implements RenderEngine {
  private getRootDirs(): string[] {
    return [
      path.resolve(__dirname, '../../dist'),
      path.resolve(__dirname, '../../../dist'),
      path.resolve(process.cwd(), 'dist'),
      path.resolve(process.cwd(), '../../dist'),
    ];
  }

  async render(payload: string, options: RenderOptions): Promise<RenderResult> {
    const moduleName = 'playwright';
    const { chromium } = (await import(moduleName)) as any;
    const rootDirs = this.getRootDirs();
    const { port, close } = await startStaticServer(rootDirs);
    const renderUrl = `http://127.0.0.1:${port}/render.html`;

    const browser = await chromium.launch({
      args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox'],
    });

    const page = await browser.newPage();
    try {
      await page.goto(renderUrl);

      const renderType = options.renderType ?? 'audio';

      if (renderType === 'video') {
        await page.waitForFunction(
          () => typeof (window as any).__annealVideoRender === 'function',
          { timeout: 15000 },
        );

        const result: { b64: string; mime: string } = await page.evaluate(
          async ([payloadStr, opts]: [any, any]) => {
            return await (window as any).__annealVideoRender(payloadStr, opts);
          },
          [
            payload,
            {
              durationSec: options.durationSec,
              width: options.width,
              height: options.height,
              fps: options.fps,
              videoBitrate: options.videoBitrate,
              captureUrls: options.captureUrls,
              previewSliceStartMs: options.previewSliceStartMs,
              isCalm: options.isCalm,
            },
          ],
        );

        return {
          outputs: { master: base64ToBuffer(result.b64) },
          mime: result.mime,
        };
      } else if (renderType === 'stems') {
        await page.waitForFunction(
          () => typeof (window as any).__annealStemsRender === 'function',
          { timeout: 15000 },
        );

        const results: Record<string, string> = await page.evaluate(
          async ([payloadStr, opts]: [any, any]) => {
            return await (window as any).__annealStemsRender(payloadStr, opts);
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

        const outputs: Record<string, ArrayBuffer> = {};
        for (const [key, b64] of Object.entries(results)) {
          outputs[key] = base64ToBuffer(b64);
        }

        return { outputs };
      } else {
        await page.waitForFunction(
          () => typeof (window as any).__annealRender === 'function',
          { timeout: 15000 },
        );

        const result: { b64: string; mime: string } = await page.evaluate(
          async ([payloadStr, opts]: [any, any]) => {
            return await (window as any).__annealRender(payloadStr, opts);
          },
          [
            payload,
            {
              durationSec: options.durationSec,
              captureUrls: options.captureUrls,
              previewSliceStartMs: options.previewSliceStartMs,
            },
          ],
        );

        return {
          outputs: { master: base64ToBuffer(result.b64) },
          mime: result.mime,
        };
      }
    } finally {
      await page.close();
      await browser.close();
      await close();
    }
  }
}
