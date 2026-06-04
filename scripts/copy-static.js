// Post-build: copies static assets that Vite doesn't process into dist/
// Run automatically by `npm run build` after `vite build`.
const { cpSync, mkdirSync, existsSync } = require('fs');
const { join } = require('path');

const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

function copy(src, dest) {
  const from = join(ROOT, src);
  const to = join(DIST, dest || src);
  if (!existsSync(from)) return;
  try {
    cpSync(from, to, { recursive: true, force: true });
    console.log(`  ✓ ${src}`);
  } catch (e) {
    console.warn(`  ✗ ${src}: ${e.message}`);
  }
}

console.log('\nCopying static assets to dist/...');

// Service workers must be at root path — cannot be bundled
copy('sw.js');
copy('firebase-messaging-sw.js');

// PWA manifest
copy('manifest.json');

// Icons / images
copy('icons');

// Cloudflare Pages routing & headers
copy('_headers');
copy('_redirects');

// 404 page
copy('404.html');

console.log('Done.\n');
