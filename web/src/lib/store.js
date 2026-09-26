// App-wide state that outlives pages: open dialogs, chat popups, unread
// counters and the viewer's social graph. Session listeners start when a
// user signs in and are torn down on sign-out.

import { signal, effect, computed } from '@preact/signals';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { db } from './firebase.js';
import { uid } from './auth.js';
import { pageTitle } from './hooks.js';
import { listenNotifications } from '../data/notify.js';
import { listenConversations } from '../data/messages.js';
import { listenFriendIds, listenSafety, listenIncomingRequests } from '../data/social.js';
import { claimPendingInvite, ensureMyCode } from '../data/referrals.js';

/* ── Dialog state ──────────────────────────────────────────── */
/** Post composer: null (closed) or options { mode, groupId, asBusiness, onBusinessId, onCreated }. */
export const composer = signal(null);
export const storyCreator = signal(false);
export const createMenu = signal(false);
export const loginPrompt = signal(null);

export function openComposer(opts = {}) {
  if (!uid.value) { loginPrompt.value = { reason: 'post' }; return; }
  composer.value = opts;
}

export function requireLogin(reason) {
  if (uid.value) return true;
  loginPrompt.value = { reason };
  return false;
}

/* ── Chat popups (desktop) ─────────────────────────────────── */
export const chatPopups = signal([]); // [{ cid, minimized }]
export function openChat(cid) {
  const list = chatPopups.value.filter((c) => c.cid !== cid);
  chatPopups.value = [{ cid, minimized: false }, ...list].slice(0, 4);
}
export function closeChat(cid) { chatPopups.value = chatPopups.value.filter((c) => c.cid !== cid); }
export function toggleChat(cid) {
  chatPopups.value = chatPopups.value.map((c) => (c.cid === cid ? { ...c, minimized: !c.minimized } : c));
}

/* ── Session data ──────────────────────────────────────────── */
export const notifications = signal([]);
export const conversations = signal([]);
export const friendIds = signal(new Set());
export const followingIds = signal(new Set());
export const incomingRequests = signal([]);
export const safety = signal({ hidden: new Set(), blocked: new Set(), muted: new Set() });

export const unreadNotifications = computed(() => notifications.value.filter((n) => !n.read && n.type !== 'message').length);
export const unreadMessages = computed(() => conversations.value.filter((c) => c.unread).length);

/** Context for feed visibility checks (posts.canSee). */
export const viewerCtx = computed(() => ({
  uid: uid.value,
  friends: friendIds.value,
  following: followingIds.value,
  blocked: safety.value.blocked,
  muted: safety.value.muted,
  hidden: safety.value.hidden,
}));

let stop = null;
effect(() => {
  const id = uid.value;
  if (stop) { stop(); stop = null; }
  if (!id) {
    notifications.value = [];
    conversations.value = [];
    friendIds.value = new Set();
    followingIds.value = new Set();
    incomingRequests.value = [];
    safety.value = { hidden: new Set(), blocked: new Set(), muted: new Set() };
    return;
  }
  const unsubs = [
    listenNotifications(id, (list) => { notifications.value = list; }),
    listenConversations((list) => { conversations.value = list; }),
    listenFriendIds(id, (ids) => { friendIds.value = new Set(ids); }),
    listenIncomingRequests((list) => { incomingRequests.value = list; }),
    listenSafety((s) => { safety.value = { hidden: new Set(s.hiddenPostIds), blocked: new Set(s.blockedUserIds), muted: new Set(s.mutedUserIds) }; }),
    onSnapshot(query(collection(db, 'follows'), where('followerId', '==', id), limit(500)),
      (s) => { followingIds.value = new Set(s.docs.map((d) => d.data().followingId)); }, () => {}),
  ];
  stop = () => unsubs.forEach((u) => u && u());
  // Wait for the profile snapshot before invite bookkeeping.
  setTimeout(() => { claimPendingInvite(); ensureMyCode(); }, 4000);
});

/* Document title with an unread badge: "(3) შეტყობინებები · GeoHub". */
effect(() => {
  const n = unreadNotifications.value + unreadMessages.value;
  const base = pageTitle.value ? `${pageTitle.value} · GeoHub` : 'GeoHub';
  document.title = n ? `(${n > 99 ? '99+' : n}) ${base}` : base;
});
