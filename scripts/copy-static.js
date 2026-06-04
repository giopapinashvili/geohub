// Post-build static asset copy.
// Vite bundles all HTML pages via src/entries/*.js entry points.
// copy-static.js copies everything else — JS, CSS, icons, SW, manifests.
const { cpSync, readdirSync, mkdirSync, existsSync } = require('fs');
const { join, extname, basename } = require('path');

const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

// All HTML pages are now Vite outputs — none need to be copied
const VITE_OUTPUTS = new Set(['feed.html', 'messages.html', 'add-business.html', 'admin-videos.html', 'admin.html', 'assistant.html', 'auth.html', 'business-suite.html', 'business.html', 'camera.html', 'challenges.html', 'channel.html', 'checkin.html', 'creators.html', 'dashboard.html', 'demo.html', 'early-adopter.html', 'events.html', 'explore.html', 'gamification.html', 'groups.html', 'index.html', 'invite.html', 'jobs.html', 'learning.html', 'lifegraph.html', 'live.html', 'map.html', 'marketplace.html', 'notifications.html', 'onboarding.html', 'patriot.html', 'place-feed.html', 'places.html', 'premium.html', 'pricing.html', 'products.html', 'profile.html', 'real-estate.html', 'reels.html', 'reviews.html', 'rewards.html', 'safety.html', 'scan.html', 'search.html', 'services.html', 'settings.html', 'stories.html', 'trust.html', 'videos.html', 'watch.html', 'world.html']);

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
