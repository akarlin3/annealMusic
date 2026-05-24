/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      // Multi-page: the SPA, the headless preview-render harness (`/render/`,
      // loaded by the API's Playwright renderer, v0.8 §3), and the standalone
      // embed player (`/embed`, v1.0 §C) — a tiny, independent bundle.
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        render: fileURLToPath(new URL('./render.html', import.meta.url)),
        embed: fileURLToPath(new URL('./embed.html', import.meta.url)),
      },
      output: {
        // Keep the embed entry + CSS at stable, hashless names so the embed
        // shell (served by the API / Firebase) can reference them, and the CI
        // bundle-size gate can find them.
        entryFileNames: (chunk) =>
          chunk.name === 'embed'
            ? 'assets/embed.js'
            : 'assets/[name]-[hash].js',
        assetFileNames: (info) =>
          info.name === 'embed.css'
            ? 'assets/embed.css'
            : 'assets/[name]-[hash][extname]',
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
