// Who the signed-in person is acting as: themselves (null) or one of the
// business pages they manage — the same idea as Facebook's page switch.
// While acting as a page, new posts, comments and replies carry the page's
// name and logo, and Messages / Notifications show the page's inbox.

import { signal, effect, computed } from '@preact/signals';
import { uid, authReady, me } from './auth.js';

const KEY = 'gh_actor';
function read() {
  try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && v.id ? v : null; } catch { return null; }
}

/** null, or { id, name, logo } of the page being acted as. */
let remembered = read();
export const actor = signal(null);
export const actorId = () => (actor.value ? `business_${actor.value.id}` : null);
/** Display identity is separate from the real authenticated permission owner. */
export const actingIdentity = computed(() => {
  const user = me();
  if (!user) return null;
  const page = actor.value;
  return page
    ? { uid: user.uid, actorId: `business_${page.id}`, authorType: 'business', businessId: page.id, name: page.name, avatar: page.logo || '' }
    : { ...user, actorId: `user_${user.uid}`, authorType: 'user', businessId: null };
});

export function setActor(page) {
  remembered = null;
  actor.value = page ? { id: page.id, name: page.name, logo: page.logo || '', verified: !!page.verified, accountUid: uid.value } : null;
  try { if (actor.value) localStorage.setItem(KEY, JSON.stringify(actor.value)); else localStorage.removeItem(KEY); } catch { /* ignore */ }
}

// Drop a remembered page on sign-out, or if the person no longer manages it.
let checked = '';
let revision = 0;
effect(() => {
  const u = uid.value;
  if (!authReady.value) return;
  if (!u) { revision++; checked = ''; remembered = null; setActor(null); return; }
  if (actor.value?.accountUid && actor.value.accountUid !== u) { revision++; checked = ''; setActor(null); return; }
  const candidate = actor.value || remembered;
  if (!candidate) { revision++; checked = ''; return; }
  if (candidate.accountUid && candidate.accountUid !== u) { remembered = null; return; }
  if (checked === `${u}:${candidate.id}`) return;
  checked = `${u}:${candidate.id}`;
  const currentRevision = ++revision;
  const id = candidate.id;
  const displayedId = actor.value?.id || '';
  remembered = null;
  import('../data/business.js').then(async ({ getBusiness, canManageBusiness }) => {
    const b = await getBusiness(id);
    const allowed = b && await canManageBusiness(b);
    if (revision !== currentRevision || uid.value !== u || (actor.value?.id || '') !== displayedId) return;
    if (!allowed) setActor(null);
    else setActor(b); // Refresh the canonical page name/logo after restoration.
  }).catch(() => { /* A temporary network error cannot clear a newer choice. */ });
});
