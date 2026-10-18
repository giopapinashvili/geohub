// App-wide state that outlives pages: open dialogs, chat popups, unread
// counters and the viewer's social graph. Session listeners start when a
// user signs in and are torn down on sign-out.

import { actor } from './actor.js';
import { signal, effect, computed } from '@preact/signals';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { db } from './firebase.js';
import { uid, account } from './auth.js';
import { pageTitle } from './hooks.js';
import { listenNotifications, listenBusinessNotifications } from '../data/notify.js';
import { listenConversations } from '../data/messages.js';
import { listenFriendIds, listenSafety, listenIncomingRequests } from '../data/social.js';
import { listenSaved } from '../data/posts.js';
import { claimPendingInvite, ensureMyCode } from '../data/referrals.js';

/* ── Dialog state ──────────────────────────────────────────── */
/** Post composer: null (closed) or options { mode, groupId, asBusiness, onBusinessId, onCreated }. */
export const composer = signal(null);
export const storyCreator = signal(false);
export const createMenu = signal(false);
export const loginPrompt = signal(null);

export function openComposer(opts = {}) {
  if (!uid.value) { loginPrompt.value = { reason: 'post' }; return; }
  const page = actor.value;
  composer.value = page && !opts.groupId && !opts.asBusiness ? { ...opts, asBusiness: page } : opts;
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
export const inboxActor = computed(() => !uid.value ? '' : actor.value ? `business_${actor.value.id}` : `user_${uid.value}`);
export const inboxScope = computed(() => `${uid.value || ''}:${inboxActor.value}`);
const notificationState = signal({ scope: '', list: [] });
const conversationState = signal({ scope: '', list: [] });
// Hide the previous identity synchronously, even before effect cleanup runs.
export const notifications = computed(() => notificationState.value.scope === inboxScope.value ? notificationState.value.list : []);
export const conversations = computed(() => conversationState.value.scope === inboxScope.value ? conversationState.value.list : []);
export const friendIds = signal(new Set());
export const followingIds = signal(new Set());
export const incomingRequests = signal([]);
/** Ids of posts the viewer saved (bookmark state on every post card). */
export const savedPostIds = signal(new Set());
export const safety = signal({ hidden: new Set(), blocked: new Set(), muted: new Set() });

/** The viewer's close-friends list (kept private in users/{uid}/private/account); only current friends count. */
export const closeFriendIds = computed(() => (account.value?.closeFriends || []).filter((id) => friendIds.value.has(id)));

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

let previousScope;
effect(() => {
  const id = uid.value;
  const pageId = actor.value?.id;
  const scope = inboxScope.value;
  const actorKey = inboxActor.value;
  let active = true;
  notificationState.value = { scope, list: [] };
  conversationState.value = { scope, list: [] };
  if (previousScope !== undefined && previousScope !== scope) {
    chatPopups.value = [];
    composer.value = null;
    storyCreator.value = false;
    createMenu.value = false;
  }
  previousScope = scope;
  if (!id) return;
  const valid = () => active && inboxScope.peek() === scope;
  const onNotifications = (list) => { if (valid()) notificationState.value = { scope, list }; };
  const stops = [
    pageId ? listenBusinessNotifications(pageId, onNotifications) : listenNotifications(id, onNotifications),
    listenConversations((list) => { if (valid()) conversationState.value = { scope, list }; }, actorKey),
  ];
  return () => { active = false; stops.forEach((stop) => stop()); };
});

effect(() => {
  const id = uid.value;
  let active = true;
  const valid = () => active && uid.peek() === id;
    friendIds.value = new Set();
    followingIds.value = new Set();
    incomingRequests.value = [];
    savedPostIds.value = new Set();
    safety.value = { hidden: new Set(), blocked: new Set(), muted: new Set() };
  if (!id) return;
  const unsubs = [
    listenFriendIds(id, (ids) => { if (valid()) friendIds.value = new Set(ids); }),
    listenIncomingRequests((list) => { if (valid()) incomingRequests.value = list; }),
    listenSaved((items) => { if (valid()) savedPostIds.value = new Set(items.filter((x) => x.type === 'post').map((x) => x.itemId)); }),
    listenSafety((s) => { if (valid()) safety.value = { hidden: new Set(s.hiddenPostIds), blocked: new Set(s.blockedUserIds), muted: new Set(s.mutedUserIds) }; }),
    onSnapshot(query(collection(db, 'follows'), where('followerId', '==', id), limit(500)),
      (s) => { if (valid()) followingIds.value = new Set(s.docs.map((d) => d.data().followingId)); }, () => {}),
  ];
  // Wait for the profile snapshot before invite bookkeeping.
  const timer = setTimeout(() => { if (valid()) { claimPendingInvite(); ensureMyCode(); } }, 4000);
  return () => { active = false; clearTimeout(timer); unsubs.forEach((stop) => stop?.()); };
});

/* Document title with an unread badge: "(3) შეტყობინებები · GeoHub". */
effect(() => {
  const n = unreadNotifications.value + unreadMessages.value;
  const base = pageTitle.value ? `${pageTitle.value} · GeoHub` : 'GeoHub';
  document.title = n ? `(${n > 99 ? '99+' : n}) ${base}` : base;
});
