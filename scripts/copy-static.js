// Post-build static asset copy.
// Vite bundles only VITE_PAGES (currently: feed.html, messages.html).
// Everything else — HTML pages, JS, CSS, icons — is copied to dist/ as-is
// so non-migrated pages still work exactly like before.
const { cpSync, readdirSync, mkdirSync, existsSync } = require('fs');
const { join, extname, basename } = require('path');

const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

// Files/dirs Vite already handled (don't overwrite)
const VITE_OUTPUTS = new Set(['feed.html', 'messages.html']); // add more as you migrate pages

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

// 1. Service workers (must be at root path, cannot be bundled)
copy('sw.js');
copy('firebase-messaging-sw.js');

// 2. PWA / app metadata
copy('manifest.json');
copy('icons');

// 3. Cloudflare Pages routing & headers
copy('_headers');
copy('_redirects');

// 4. All HTML pages that were NOT bundled by Vite
const htmlFiles = readdirSync(ROOT).filter(f => f.endsWith('.html') && !VITE_OUTPUTS.has(f));
htmlFiles.forEach(f => copy(f));

// 5. All JS files (non-migrated pages reference them directly)
const jsFiles = readdirSync(ROOT).filter(f => f.endsWith('.js') && !f.startsWith('.'));
jsFiles.forEach(f => copy(f));

// 6. All CSS files
const cssFiles = readdirSync(ROOT).filter(f => f.endsWith('.css'));
cssFiles.forEach(f => copy(f));

// 7. Other static assets in root
['robots.txt', 'sitemap.xml', '.htaccess'].forEach(f => copy(f));

console.log('Done.\n');
