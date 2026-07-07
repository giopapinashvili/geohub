import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// All pages bundled by Vite. copy-static.js copies everything else (CSS, icons, SW…).
const VITE_PAGES = {
  feed:            resolve(__dirname, 'feed.html'),
  messages:        resolve(__dirname, 'messages.html'),
  'add-business':  resolve(__dirname, 'add-business.html'),
  'admin-videos':  resolve(__dirname, 'admin-videos.html'),
  admin:           resolve(__dirname, 'admin.html'),
  assistant:       resolve(__dirname, 'assistant.html'),
  auth:            resolve(__dirname, 'auth.html'),
  'business-suite':resolve(__dirname, 'business-suite.html'),
  business:        resolve(__dirname, 'business.html'),
  camera:          resolve(__dirname, 'camera.html'),
  challenges:      resolve(__dirname, 'challenges.html'),
  channel:         resolve(__dirname, 'channel.html'),
  checkin:         resolve(__dirname, 'checkin.html'),
  creators:        resolve(__dirname, 'creators.html'),
  dashboard:       resolve(__dirname, 'dashboard.html'),
  demo:            resolve(__dirname, 'demo.html'),
  'early-adopter': resolve(__dirname, 'early-adopter.html'),
  events:          resolve(__dirname, 'events.html'),
  explore:         resolve(__dirname, 'explore.html'),
  gamification:    resolve(__dirname, 'gamification.html'),
  groups:          resolve(__dirname, 'groups.html'),
  index:           resolve(__dirname, 'index.html'),
  invite:          resolve(__dirname, 'invite.html'),
  jobs:            resolve(__dirname, 'jobs.html'),
  learning:        resolve(__dirname, 'learning.html'),
  lifegraph:       resolve(__dirname, 'lifegraph.html'),
  live:            resolve(__dirname, 'live.html'),
  map:             resolve(__dirname, 'map.html'),
  marketplace:     resolve(__dirname, 'marketplace.html'),
  notifications:   resolve(__dirname, 'notifications.html'),
  onboarding:      resolve(__dirname, 'onboarding.html'),
  patriot:         resolve(__dirname, 'patriot.html'),
  'place-feed':    resolve(__dirname, 'place-feed.html'),
  places:          resolve(__dirname, 'places.html'),
  premium:         resolve(__dirname, 'premium.html'),
  pricing:         resolve(__dirname, 'pricing.html'),
  products:        resolve(__dirname, 'products.html'),
  profile:         resolve(__dirname, 'profile.html'),
  'real-estate':   resolve(__dirname, 'real-estate.html'),
  reels:           resolve(__dirname, 'reels.html'),
  reviews:         resolve(__dirname, 'reviews.html'),
  rewards:         resolve(__dirname, 'rewards.html'),
  safety:          resolve(__dirname, 'safety.html'),
  scan:            resolve(__dirname, 'scan.html'),
  search:          resolve(__dirname, 'search.html'),
  services:        resolve(__dirname, 'services.html'),
  settings:        resolve(__dirname, 'settings.html'),
  stories:         resolve(__dirname, 'stories.html'),
  trust:           resolve(__dirname, 'trust.html'),
  videos:          resolve(__dirname, 'videos.html'),
  watch:           resolve(__dirname, 'watch.html'),
  world:           resolve(__dirname, 'world.html'),
};

export default defineConfig({
  root: '.',
  publicDir: false, // static assets handled by scripts/copy-static.js

  esbuild: {
    drop: ['console', 'debugger'],
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
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
