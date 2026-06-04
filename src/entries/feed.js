// Feed page entry point — Vite bundles this into one optimized file.
// Import order matches the original <script defer> order in feed.html.
// All scripts are IIFEs that set window.* globals — order is preserved by Rollup.

import '/firebase-config.js';          // Sets window.GeoFirebase, fires GeoFirebaseReady
import '/gh-i18n.js';
import '/gh-schema.js';
import '/main.js';
import '/account.js';
import '/nav-cleanup.js';
import '/mobile-nav.js';
import '/firestore-social.js';
import '/friendships.js';
import '/moderation.js';
import '/chat-popup.js';
import '/gh-calls.js';
import '/gh-call-history.js';
import '/gh-group-calls.js';
import '/geohub-social-redesign.js';
import '/story-editor.js';
import '/geo-actors.js';
import '/account-switcher.js';
import '/geohub-production-stabilization-v1.js';
import '/responsive-polish.js';
import '/push-notifications.js';
import '/analytics.js';
