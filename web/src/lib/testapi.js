// Emulator-only: exposes the data layer to the end-to-end flow test
// (web/tools/e2e-flows.mjs). Never loaded in the production build.
export * as posts from '../data/posts.js';
export * as messages from '../data/messages.js';
export * as stories from '../data/stories.js';
export * as social from '../data/social.js';
export * as notify from '../data/notify.js';
export * as needs from '../data/needs.js';
export * as market from '../data/market.js';
export * as business from '../data/business.js';
export * as groups from '../data/groups.js';
export * as events from '../data/events.js';
export * as places from '../data/places.js';
export * as users from '../data/users.js';
export * as auth from './auth.js';
