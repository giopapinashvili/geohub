/**
 * Migrates every remaining HTML page to Vite entry points.
 * Run once: node scripts/migrate-all-pages.js
 * Then: npm run build to verify.
 */
const { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } = require('fs');
const { join, basename } = require('path');

const ROOT = join(__dirname, '..');
const ENTRIES_DIR = join(ROOT, 'src', 'entries');

// Already migrated — skip
const ALREADY_DONE = new Set(['feed.html', 'messages.html']);

// Pages with no meaningful local JS (no entry needed)
const SKIP_NO_JS = new Set([
  '404.html', 'offline.html', 'terms.html', 'privacy.html',
  'payment-success.html', 'payment-cancel.html',
]);

if (!existsSync(ENTRIES_DIR)) mkdirSync(ENTRIES_DIR, { recursive: true });

const htmlFiles = readdirSync(ROOT)
  .filter(f => f.endsWith('.html') && !ALREADY_DONE.has(f) && !SKIP_NO_JS.has(f));

const migratedPages = [];

for (const htmlFile of htmlFiles) {
  const pageName = htmlFile.replace('.html', '');
  const htmlPath = join(ROOT, htmlFile);
  let html = readFileSync(htmlPath, 'utf8');

  // Collect local <script src="..."> in order (skip CDN / inline / already-module)
  const scriptRe = /<script[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g;
  const localSrcs = [];
  let m;
  while ((m = scriptRe.exec(html)) !== null) {
    const src = m[1];
    if (!src.startsWith('http') && !src.startsWith('//')) {
      // Normalise: strip leading ./ and ensure leading /
      const normalised = '/' + src.replace(/^\.\//, '');
      localSrcs.push(normalised);
    }
  }

  if (localSrcs.length === 0) {
    console.log(`  skip (no local scripts): ${htmlFile}`);
    continue;
  }

  // firebase-config.js must be first
  const ordered = localSrcs.filter(s => s.includes('firebase-config'));
  for (const s of localSrcs) {
    if (!s.includes('firebase-config')) ordered.push(s);
  }

  // Write entry file
  const entryPath = join(ENTRIES_DIR, pageName + '.js');
  const entryContent = ordered.map(s => `import '${s}';`).join('\n') + '\n';
  writeFileSync(entryPath, entryContent, 'utf8');

  // Replace all local <script src="..."> blocks with single entry tag
  // Keep: CDN scripts, inline scripts, the new entry tag
  html = html.replace(/<script[^>]*\bsrc="(?!http|\/\/)([^"]+)"[^>]*><\/script>\n?/g, '');

  // Inject entry tag just before </body>
  const entryTag = `  <!-- Vite: ${localSrcs.length} scripts → 1 chunk. See src/entries/${pageName}.js -->\n  <script type="module" src="/src/entries/${pageName}.js"></script>\n`;
  html = html.replace(/<\/body>/, entryTag + '</body>');

  writeFileSync(htmlPath, html, 'utf8');
  migratedPages.push({ htmlFile, pageName, count: localSrcs.length });
  console.log(`  ✓ ${htmlFile} (${localSrcs.length} scripts → entry)`);
}

// Print vite.config.mjs entries block
console.log('\n--- Add to vite.config.mjs VITE_PAGES ---');
for (const { pageName } of migratedPages) {
  console.log(`  ${pageName}: resolve(__dirname, '${pageName}.html'),`);
}

// Print copy-static.js VITE_OUTPUTS set
console.log('\n--- VITE_OUTPUTS set for copy-static.js ---');
const allMigrated = [...Array.from(ALREADY_DONE), ...migratedPages.map(p => p.htmlFile)];
console.log(`const VITE_OUTPUTS = new Set([${allMigrated.map(f => `'${f}'`).join(', ')}]);`);
