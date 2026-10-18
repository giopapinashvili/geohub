import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'node:url';
import { cpSync, existsSync, createReadStream, readFileSync, writeFileSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { createHash } from 'node:crypto';
import { advisorPlugin } from './web/tools/advisor-plugin.mjs';

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

/** The "/*" block of a Cloudflare _headers file as { name: value }. */
export function siteHeaders(text) {
  const blocks = {};
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) { current = line.trim(); blocks[current] = blocks[current] || {}; continue; }
    const i = line.indexOf(':');
    if (current && i > 0) blocks[current][line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return blocks['/*'] || {};
}

// Share-preview worker (web/worker/og-worker.js → dist/_worker.js, Pages
// "advanced mode"). Pages does not apply _headers to worker responses, so the
// site-wide security headers are copied into it here — one source of truth.
function pagesWorker() {
  return {
    name: 'geohub-pages-worker',
    apply: 'build',
    writeBundle(opts) {
      const src = readFileSync(join(root, 'worker/og-worker.js'), 'utf8');
      const headers = siteHeaders(readFileSync(join(root, 'public/_headers'), 'utf8'));
      if (!headers['Content-Security-Policy']) throw new Error('_headers: no site-wide Content-Security-Policy found');
      const out = src.replace("'__SECURITY_HEADERS__'", JSON.stringify(headers));
      if (out === src) throw new Error('og-worker.js: security header placeholder missing');
      // A content hash (not a timestamp: CI checks that the build is reproducible)
      // so cached previews from an older worker are not reused.
      const version = createHash('sha1').update(out).digest('hex').slice(0, 10);
      const worker = out.replace("'__WORKER_VERSION__'", JSON.stringify(version));
      if (worker === out) throw new Error('og-worker.js: version placeholder missing');
      writeFileSync(join(opts.dir, '_worker.js'), worker);
    },
  };
}

// The app lives in web/. `npm run build` writes dist/, which is committed:
// Cloudflare Pages serves it as-is.
export default defineConfig(({ mode }) => ({
  root,
  publicDir: 'public',
  plugins: [preact(), pagesWorker(), mode === 'emulator' && fixturesPlugin(), mode === 'advisor' && advisorPlugin()].filter(Boolean),
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
