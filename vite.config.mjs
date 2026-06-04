import { defineConfig } from 'vite';
import { resolve, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Only pages that have been migrated to src/entries/* get bundled by Vite.
// Other pages are copied as-is by scripts/copy-static.js along with all JS files.
const VITE_PAGES = {
  feed: resolve(__dirname, 'feed.html'),
  // Add more as you create src/entries/*.js for each page:
  // messages: resolve(__dirname, 'messages.html'),
  // profile:  resolve(__dirname, 'profile.html'),
};

export default defineConfig({
  root: '.',
  publicDir: false, // static assets handled by scripts/copy-static.js

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: VITE_PAGES,
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },

  // Dev server: serves everything from root so current URLs all work
  server: {
    port: 5173,
    open: '/feed.html',
  },
});
