import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

/**
 * Dedicated build for the physical-modeling AudioWorklet bundle. Vite has no
 * native AudioWorklet support, so the processors are bundled here into a single
 * self-contained IIFE (no imports, no module syntax) emitted to
 * `public/worklets/physical.js`. `audioWorklet.addModule` loads it as a classic
 * worklet script — works in every browser, and the shared DSP/noise utility is
 * bundled exactly once. The artifact is committed so `vite dev` serves it from
 * `public/` without a prior build.
 */
export default defineConfig({
  // The worklet output lives under public/, so disable public-dir copying to
  // avoid recursively copying public/* into the output.
  publicDir: false,
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    emptyOutDir: false,
    outDir: 'public/worklets',
    target: 'es2020',
    minify: true,
    lib: {
      entry: fileURLToPath(
        new URL(
          './src/audio/engines/physical-worklets/entry.ts',
          import.meta.url,
        ),
      ),
      name: 'AnnealPhysicalWorklets',
      formats: ['iife'],
      fileName: () => 'physical.js',
    },
    rollupOptions: {
      output: { entryFileNames: 'physical.js' },
    },
  },
});
