import { defineConfig } from 'vite';
import { resolve, basename } from 'path';
import { readdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Auto-detect all HTML pages for MPA
const htmlEntries = Object.fromEntries(
  readdirSync(__dirname)
    .filter(f => f.endsWith('.html'))
    .map(f => [basename(f, '.html'), resolve(__dirname, f)])
);

export default defineConfig({
  root: '.',
  publicDir: false, // static assets handled by scripts/copy-static.js

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: htmlEntries,
      output: {
        // Shared chunks for code used across multiple pages
        manualChunks(id) {
          if (id.includes('node_modules/firebase')) return 'firebase';
          if (id.includes('node_modules')) return 'vendor';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },

  // Dev server: serve from root so all existing URLs work
  server: {
    port: 5173,
    open: '/feed.html',
  },
});
