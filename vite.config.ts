/* eslint-disable */
/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: 'docs/v8/measurements/bundle-main.html',
      title: 'AnnealMusic Main Bundle Map',
      template: 'treemap',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      // Multi-page: the SPA, the headless preview-render harness (`/render/`,
      // loaded by the API's Playwright renderer, v0.8 §3), the standalone
      // embed player (`/embed`, v1.0 §C) — a tiny, independent bundle — and the
      // Researcher console (`/research.html`). The console is its own entry
      // (#research-root, no React Router) that the SPA hard-redirects to for
      // researcher mode; building it here guarantees it lands in dist/ so
      // Firebase serves the real page instead of falling through the catch-all
      // rewrite to index.html (which renders blank — no SPA route matches it).
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        render: fileURLToPath(new URL('./render.html', import.meta.url)),
        embed: fileURLToPath(new URL('./embed.html', import.meta.url)),
        research: fileURLToPath(new URL('./research.html', import.meta.url)),
      },
      output: {
        // Keep the embed entry + CSS at stable, hashless names so the embed
        // shell (served by the API / Firebase) can reference them, and the CI
        // bundle-size gate can find them.
        entryFileNames: (chunk: any) =>
          chunk.name === 'embed'
            ? 'assets/embed.js'
            : 'assets/[name]-[hash].js',
        assetFileNames: (info: any) =>
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
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest}.config.*',
    ],
  },
} as any);
