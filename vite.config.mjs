import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'node:url';
import { cpSync, existsSync, createReadStream } from 'node:fs';
import { join, normalize } from 'node:path';

const root = fileURLToPath(new URL('./web', import.meta.url));
const fixtures = join(root, 'e2e/fixtures');

// Emulator builds serve the generated test photos at /fixtures/*.
function fixturesPlugin() {
  const serve = (server) => {
    server.middlewares.use('/fixtures', (req, res, next) => {
      const file = normalize(join(fixtures, decodeURIComponent(req.url.split('?')[0])));
      if (!file.startsWith(fixtures) || !existsSync(file)) return next();
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'max-age=3600');
      createReadStream(file).pipe(res);
    });
  };
  return {
    name: 'geohub-fixtures',
    configureServer: serve,
    configurePreviewServer: serve,
    writeBundle(opts) { if (existsSync(fixtures)) cpSync(fixtures, join(opts.dir, 'fixtures'), { recursive: true }); },
  };
}

// The app lives in web/. `npm run build` writes dist/, which is committed:
// Cloudflare Pages serves it as-is.
export default defineConfig(({ mode }) => ({
  root,
  publicDir: 'public',
  plugins: [preact(), mode === 'emulator' && fixturesPlugin()].filter(Boolean),
  build: {
    outDir: fileURLToPath(new URL(mode === 'emulator' ? './.dist-emulator' : './dist', import.meta.url)),
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase/') || id.includes('node_modules/@firebase/')) {
            if (id.includes('firestore')) return 'firestore';
            if (id.includes('auth')) return 'firebase-auth';
            if (id.includes('messaging') || id.includes('functions') || id.includes('installations')) return undefined;
            return 'firebase-core';
          }
          if (id.includes('node_modules/preact') || id.includes('node_modules/@preact/signals')) return 'preact';
          return undefined;
        },
      },
    },
  },
  esbuild: {
    pure: mode === 'production' ? ['console.log', 'console.debug', 'console.info'] : [],
  },
  server: { port: 5173, strictPort: true, host: '127.0.0.1' },
  preview: { port: 4173, strictPort: true, host: '127.0.0.1' },
}));
