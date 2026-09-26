// Who the signed-in person is acting as: themselves (null) or one of the
// business pages they manage — the same idea as Facebook's page switch.
// While acting as a page, new posts, comments and replies carry the page's
// name and logo, and Messages / Notifications show the page's inbox.

import { signal, effect } from '@preact/signals';
import { uid, authReady } from './auth.js';

const KEY = 'gh_actor';
function read() {
  try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && v.id ? v : null; } catch { return null; }
}

/** null, or { id, name, logo } of the page being acted as. */
export const actor = signal(read());
export const actorId = () => (actor.value ? `business_${actor.value.id}` : null);

export function setActor(page) {
  actor.value = page ? { id: page.id, name: page.name, logo: page.logo || '' } : null;
  try { if (actor.value) localStorage.setItem(KEY, JSON.stringify(actor.value)); else localStorage.removeItem(KEY); } catch { /* ignore */ }
}

// Drop a remembered page on sign-out, or if the person no longer manages it.
let checked = '';
effect(() => {
  const u = uid.value;
  if (!authReady.value) return;
  if (!u) { if (actor.value) setActor(null); return; }
  if (!actor.value || checked === `${u}:${actor.value.id}`) return;
  checked = `${u}:${actor.value.id}`;
  const id = actor.value.id;
  import('../data/business.js').then(async ({ getBusiness, canManageBusiness }) => {
    const b = await getBusiness(id);
    if (!b || !(await canManageBusiness(b))) setActor(null);
  });
});
