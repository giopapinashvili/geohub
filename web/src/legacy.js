// Maps every URL of the old 59-page site to its place in the new app.
// Used on first load, on every in-app navigation, and to open links stored
// in old notifications ("feed.html?post=…", "profile.html?id=…").
//
// Cloudflare serves index.html for unknown paths (no top-level 404.html), so
// "/profile.html?id=x" reaches the app and is rewritten here.

const enc = encodeURIComponent;

function q(params, keys) {
  for (const k of keys) {
    const v = params.get(k);
    if (v) return v;
  }
  return '';
}

function withQuery(path, obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `${path}?${s}` : path;
}

const RULES = {
  index: () => '/',
  feed: (p, hash) => {
    const post = q(p, ['post']) || (hash.match(/^#post-(.+)$/) || [])[1];
    if (post) return withQuery(`/post/${enc(post)}`, { comment: q(p, ['comment']) });
    const story = q(p, ['story']);
    if (story) return withQuery('/', { story });
    const tag = q(p, ['tag']);
    if (tag) return withQuery('/search', { q: `#${tag}` });
    if (p.get('compose')) return withQuery('/', { compose: '1' });
    return '/';
  },
  stories: (p) => withQuery('/', { story: q(p, ['id', 'story']) }),
  reels: (p) => { const v = q(p, ['v', 'id']); return v ? `/reels/${enc(v)}` : '/reels'; },
  videos: (p) => { const v = q(p, ['v', 'id']); return v ? `/watch/${enc(v)}` : '/video'; },
  watch: (p) => { const v = q(p, ['v', 'id']); return v ? `/watch/${enc(v)}` : '/video'; },
  live: () => '/video',
  channel: (p) => { const id = q(p, ['id', 'channel']); return id ? `/video/channel/${enc(id)}` : '/video?tab=channels'; },
  'admin-videos': () => '/admin/videos',

  explore: (p) => withQuery('/explore', { q: q(p, ['q']), cat: q(p, ['category', 'cat']) }),
  places: (p) => { const id = q(p, ['id', 'place']); return id ? `/place/${enc(id)}` : '/explore'; },
  'place-feed': (p) => { const id = q(p, ['id', 'place', 'placeId']); return id ? `/place/${enc(id)}` : '/explore'; },
  'place-updates': (p) => { const id = q(p, ['id', 'place', 'placeId']); return id ? `/place/${enc(id)}` : '/explore'; },
  reviews: (p) => { const id = q(p, ['place', 'placeId', 'id']); return id ? `/place/${enc(id)}` : '/explore'; },
  search: (p) => withQuery('/search', { q: q(p, ['q', 'query']), tab: q(p, ['tab']) }),
  world: () => '/map',
  map: (p) => withQuery('/map', { place: q(p, ['place', 'id']) }),
  checkin: () => '/map?checkin=1',
  camera: () => '/map?checkin=1',
  scan: () => '/map?checkin=1',

  profile: (p) => { const id = q(p, ['id', 'uid', 'user']); return id ? `/u/${enc(id)}` : '/u/me'; },
  lifegraph: () => '/u/me',
  messages: (p) => {
    const biz = q(p, ['business']);
    const cid = q(p, ['cid', 'conv']);
    if (biz) return withQuery(`/business/${enc(biz)}/manage`, { tab: 'inbox', cid });
    if (cid) return `/messages/${enc(cid)}`;
    const withUser = q(p, ['with']);
    if (withUser) return withQuery('/messages', { with: withUser });
    const withBiz = q(p, ['withBusiness']);
    if (withBiz) return withQuery('/messages', { business: withBiz });
    return '/messages';
  },
  notifications: () => '/notifications',

  business: (p) => { const id = q(p, ['id', 'businessId']); return id ? `/business/${enc(id)}` : '/business'; },
  'business-suite': (p) => { const id = q(p, ['businessId', 'id']); return id ? `/business/${enc(id)}/manage` : '/business'; },
  dashboard: (p) => { const id = q(p, ['businessId', 'id']); return id ? `/business/${enc(id)}/manage` : '/business'; },
  'add-business': (p) => { const id = q(p, ['edit']); return id ? `/business/${enc(id)}/manage?tab=settings` : '/business/new'; },

  events: (p) => { const id = q(p, ['id', 'event']); return id ? `/events/${enc(id)}` : '/events'; },
  groups: (p) => {
    const id = q(p, ['id', 'group']);
    if (id) return `/groups/${enc(id)}`;
    const invite = q(p, ['invite']);
    return invite ? withQuery('/groups', { invite }) : '/groups';
  },
  marketplace: (p) => { const id = q(p, ['id', 'item']); return id ? `/marketplace/${enc(id)}` : '/marketplace'; },
  products: () => '/marketplace?cat=item',
  services: () => '/marketplace?cat=service',
  jobs: () => '/marketplace?cat=job',
  'real-estate': () => '/marketplace?cat=property',

  rewards: (p) => withQuery('/rewards', { tab: q(p, ['tab']) === 'wallet' ? '' : q(p, ['tab']), focus: q(p, ['focus']) }),
  challenges: () => '/rewards?tab=challenges',
  gamification: () => '/rewards',
  patriot: () => '/rewards?tab=challenges',
  pricing: () => '/premium',
  premium: (p) => withQuery('/premium', { tab: q(p, ['tab']), payment: q(p, ['payment']), session_id: q(p, ['session_id']), type: q(p, ['type']) }),
  'early-adopter': () => '/premium?tab=business',
  'payment-success': (p) => withQuery('/premium', { payment: 'success', session_id: q(p, ['session_id']), type: q(p, ['type']) }),
  'payment-cancel': (p) => withQuery('/premium', { payment: 'cancel', type: q(p, ['type']) }),

  settings: (p) => { const tab = q(p, ['tab', 'section']); return tab ? `/settings/${enc(tab)}` : '/settings'; },
  auth: (p) => {
    const mode = q(p, ['tab', 'mode']);
    const next = q(p, ['next']);
    const ref = q(p, ['ref']);
    if (ref) return `/invite/${enc(ref)}`;
    return withQuery(mode === 'signup' || mode === 'register' ? '/signup' : '/login', { next });
  },
  onboarding: () => '/onboarding',
  invite: (p) => { const code = q(p, ['code', 'ref', 'invite']); return code ? `/invite/${enc(code)}` : '/invite'; },
  admin: (p) => { const tab = q(p, ['tab']); return tab ? `/admin/${enc(tab)}` : '/admin'; },

  creators: () => '/search?tab=people',
  trust: () => '/about?tab=safety',
  safety: () => '/about?tab=safety',
  learning: () => '/',
  assistant: () => '/',
  demo: () => '/',
  offline: () => '/',
  terms: () => '/terms',
  privacy: () => '/privacy',
};

const NEW_ROOTS = new Set(['reels', 'explore', 'search', 'map', 'messages', 'notifications', 'business', 'events', 'groups', 'marketplace', 'rewards', 'premium', 'settings', 'onboarding', 'invite', 'admin', 'terms', 'privacy']);
const LEGACY_PARAMS = {
  business: ['id', 'businessId'],
  events: ['id', 'event'],
  groups: ['id', 'group'],
  marketplace: ['id', 'item'],
  messages: ['cid', 'conv', 'business', 'withBusiness'],
  settings: ['tab', 'section'],
  admin: ['tab'],
  invite: ['code', 'ref'],
  reels: ['v', 'id'],
  rewards: ['focus'],
};

/**
 * Returns the new-app URL for a legacy URL, or null when `href` already
 * belongs to the new app. Accepts absolute URLs, "/x.html?…", "x.html?…".
 */
export function resolveLegacy(href) {
  let url;
  try { url = new URL(href, 'https://geohub.local/'); } catch { return null; }
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const m = path.match(/^\/([a-z-]+)(\.html)?$/i);
  if (!m) return null;
  const name = m[1].toLowerCase();
  const rule = RULES[name];
  if (!rule) return null;
  // Several new routes share a name with an old page ("/events", "/groups"…).
  // Without the .html suffix those are only rewritten when they carry one of
  // the old query parameters that the new route does not understand.
  if (!m[2] && NEW_ROOTS.has(name)) {
    const legacyKeys = LEGACY_PARAMS[name] || [];
    if (!legacyKeys.some((k) => url.searchParams.has(k))) return null;
  }
  const target = rule(url.searchParams, url.hash || '');
  return target;
}

/** Normalises an href for in-app use (legacy links become new routes). */
export function appHref(href) {
  if (!href) return '/';
  if (/^https?:\/\//i.test(href)) {
    try {
      const u = new URL(href);
      if (u.origin !== location.origin) return href;
      href = u.pathname + u.search + u.hash;
    } catch { return href; }
  }
  return resolveLegacy(href) || href;
}
