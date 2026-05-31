/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: 'docs/v8/measurements/bundle-mobile.html',
      title: 'AnnealMusic Mobile Bundle Map',
      template: 'treemap',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  base: './', // CRITICAL: ensures assets are loaded via relative paths in WebView (file:// or capacitor://)
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    // Inject build-time environment variable for mobile-specific optimization/tree-shaking
    'import.meta.env.VITE_MOBILE': JSON.stringify(true),
  },
  build: {
    outDir: 'dist-mobile',
    sourcemap: false,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // Embed and preview-renderer are excluded from mobile package
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
      },
    },
  },
});
