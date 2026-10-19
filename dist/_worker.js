/* global publicOffersResponse, isExcludedCuratedPhoto */
// Cloudflare Pages "advanced mode" worker (built to dist/_worker.js).
//
// Share previews: when Facebook, Messenger, Telegram, Viber, WhatsApp,
// iMessage, Discord or a search engine fetches a GeoHub link
// (/post/…, /u/…, /place/…, /business/…, /events/…, /groups/…,
// /marketplace/…, /watch/…, /reels/…, /video/channel/…), the app shell gets
// that page's real title, text and picture in its <head>. Link-preview bots do
// not run JavaScript, so without this every link showed the same generic card.
//
// - Only the routes listed in _routes.json reach this worker; every other file
//   is served by Pages directly.
// - People get the normal app shell untouched (no extra reads, no delay).
// - Imported place cards read the published directory assets and photo credits.
// - Other data comes from Firestore's public REST API without credentials, so the
//   security rules decide: an only-me / friends post, a private profile field,
//   anything the rules refuse simply falls back to the generic card.
// - Any error serves the app exactly as before — this worker must never take
//   the site down.
// - Pages does not apply _headers to worker responses, so the same security
//   headers (copied from _headers at build time) are attached here.

const SECURITY_HEADERS = {"X-Content-Type-Options":"nosniff","X-Frame-Options":"SAMEORIGIN","Referrer-Policy":"strict-origin-when-cross-origin","Permissions-Policy":"camera=(self), microphone=(self), geolocation=(self), payment=(self)","Content-Security-Policy":"default-src 'self'; script-src 'self' https://apis.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; media-src 'self' blob: https://res.cloudinary.com https://firebasestorage.googleapis.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://api.cloudinary.com https://res.cloudinary.com https://geohub-payments.gio-papinashvili20-bd3.workers.dev https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com https://tiles.mapterhorn.com; worker-src 'self' blob:; frame-src https://www.youtube.com https://www.youtube-nocookie.com https://geohub-main.firebaseapp.com https://accounts.google.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; upgrade-insecure-requests"};
const WORKER_VERSION = "92e48da476";
// Public, read-only source adapter. No merchant credentials or user data.
// Only hardcoded official hosts are fetched; caller input never chooses a URL.
function parseZoommerOffers(html, observedAtMs = Date.now()) {
  if (typeof html !== 'string' || html.length > 5 * 1024 * 1024) throw new Error('Invalid source size');
  const match = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error('Official source format changed');
  const next = JSON.parse(match[1]);
  const home = next?.props?.pageProps?.dehydratedState?.queries?.find(query => query.queryKey === 'homePageData')?.state?.data;
  if (!Array.isArray(home?.section)) throw new Error('Official source has no products');
  const offers = new Map();
  for (const section of home.section) for (const item of section.products || []) {
    if (!Number.isSafeInteger(item.id) || item.id <= 0 || item.disableBuyButton || item.preOrder || item.comingSoonText) continue;
    const priceValue = value => typeof value === 'number' || (typeof value === 'string' && /^\d+(?:\.\d{1,2})?$/.test(value.trim()));
    if (!priceValue(item.price) || !priceValue(item.previousPrice)) continue;
    const price = Number(item.price), old = Number(item.previousPrice);
    if (!Number.isFinite(price) || !Number.isFinite(old) || price <= 0 || old <= price || old > 1e6) continue;
    const priceMinor = Math.round(price * 100), originalPriceMinor = Math.round(old * 100);
    if (priceMinor <= 0 || originalPriceMinor <= priceMinor) continue;
    if (typeof item.name !== 'string' || !item.name.trim() || item.name.length > 250 || typeof item.route !== 'string') continue;
    let source, image;
    try { source = new URL(item.route, 'https://zoommer.ge/'); image = new URL(item.imageUrl); } catch { continue; }
    if (source.origin !== 'https://zoommer.ge' || source.username || source.password || image.username || image.password || image.protocol !== 'https:' || !['s3.zoommer.ge','zoommer.ge'].includes(image.hostname)) continue;
    const title = item.name.trim();
    offers.set(item.id, { id: `source-zoommer-${item.id}`, itemId: `zoommer-${item.id}`, businessId: '', brandId: 'zoommer',
      businessName: 'ზუმერი', merchantHref: '/brands/zoommer', title, itemTitle: title, type: 'product', categoryId: 'electronics',
      description: [item.parentCategoryName, item.brandName].filter(value => typeof value === 'string').join(' · '),
      priceMinor, originalPriceMinor, currency: 'GEL', imageUrl: image.href,
      sourceUrl: source.href, sourceName: 'Zoommer.ge', sourceKind: 'official-website', observedAtMs,
      freshnessUntilMs: observedAtMs + 72 * 3600000, isDemo: false, status: 'published', availabilityScope: 'online',
      allBranches: false, branchIds: [], conditions: 'ფასი დაფიქსირებულია ზუმერის ოფიციალურ ონლაინ მაღაზიაში. კონკრეტული ფილიალის მარაგი და საბოლოო ფასი გადაამოწმე მაღაზიის გვერდზე.',
    });
  }
  const result = [...offers.values()].slice(0, 300);
  return { version: 1, source: 'https://zoommer.ge/', observedAtMs, offers: result };
}

async function publicOffersResponse(request, env, ctx) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=3600', 'X-Content-Type-Options': 'nosniff' };
  const key = new Request(new URL('/api/public-offers?v=1', request.url));
  const cache = globalThis.caches?.default;
  const cached = cache && await cache.match(key);
  if (cached) return request.method === 'HEAD' ? new Response(null, { headers: cached.headers }) : cached;
  let data, sourceIssue = 'network-unavailable';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const upstream = await fetch('https://zoommer.ge/', { redirect: 'manual', signal: controller.signal, headers: { Accept: 'text/html', 'User-Agent': 'GeoHub-Public-Directory/1.0' }, cf: { cacheTtl: 3600, cacheEverything: true } });
    sourceIssue = upstream.ok ? 'source-format' : `http-${upstream.status}`;
    if (!upstream.ok || Number(upstream.headers.get('content-length')) > 5 * 1024 * 1024) throw new Error('Official source unavailable');
    const reader = upstream.body.getReader(), chunks = []; let bytes = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.length; if (bytes > 5 * 1024 * 1024) { await reader.cancel(); throw new Error('Source too large'); } chunks.push(value); }
    const joined = new Uint8Array(bytes); let offset = 0; for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
    data = parseZoommerOffers(new TextDecoder().decode(joined));
  } catch {
    if (controller.signal.aborted) sourceIssue = 'source-timeout';
    const fallback = await env.ASSETS.fetch(new Request(new URL('/commerce-data/official-offers.json', request.url)));
    data = fallback.ok ? await fallback.json().catch(() => null) : null;
    if (!data?.offers) return new Response(JSON.stringify({ version: 1, offers: [], unavailable: true }), { status: 503, headers: { ...headers, 'Cache-Control': 'no-store' } });
    data = { ...data, fallback: true, sourceIssue, offers: data.offers.filter(offer => offer.freshnessUntilMs > Date.now()) };
  } finally { clearTimeout(timer); }
  const response = new Response(JSON.stringify(data), { headers });
  if (cache && !data.fallback) ctx.waitUntil(cache.put(key, response.clone()));
  return request.method === 'HEAD' ? new Response(null, { headers }) : response;
}

// Reviewed 2026-10-19. Entity-wide Wikidata P18 may depict a different campus
// from the current representative pin; keep exclusions stable across regeneration.
const exclusions = {
  osm_relation_16507696: ['File:Georgische Technische Universität - 1. Korpus.jpg'],
};

function isExcludedCuratedPhoto(placeId, sourceTitle) {
  return exclusions[placeId]?.includes(sourceTitle) || false;
}


const PROJECT = 'geohub-main';
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const SITE = 'GeoHub';
const PROD_ORIGIN = 'https://geohub-main.pages.dev';
const CACHE_SECONDS = 600;

// Link-preview fetchers and search crawlers.
const BOTS = /facebookexternalhit|facebot|meta-externalagent|twitterbot|telegrambot|whatsapp|viber|slackbot|slack-imgproxy|discordbot|linkedinbot|skypeuripreview|microsoft preview|teams|pinterest|redditbot|applebot|googlebot|google-inspectiontool|googleother|bingbot|bingpreview|yandex|duckduckbot|baiduspider|petalbot|seznambot|mastodon|bluesky|cardyb|embedly|iframely|vkshare|odnoklassniki|okru|snapchat|kakaotalk|line\/|zalo|quora link preview|tumblr|flipboard|bitlybot|nuzzel|outbrain|ia_archiver|w3c_validator|metainspector|opengraph|preview/i;

const ROUTES = [
  [/^\/post\/([^/]+)\/?$/, 'post'],
  [/^\/u\/([^/]+)\/?$/, 'user'],
  [/^\/place\/([^/]+)\/?$/, 'place'],
  [/^\/business\/([^/]+)\/?$/, 'business'],
  [/^\/events\/([^/]+)\/?$/, 'event'],
  [/^\/groups\/([^/]+)\/?$/, 'group'],
  [/^\/marketplace\/([^/]+)\/?$/, 'item'],
  [/^\/watch\/([^/]+)\/?$/, 'video'],
  [/^\/reels\/([^/]+)\/?$/, 'video'],
  [/^\/video\/channel\/([^/]+)\/?$/, 'channel'],
];
const NOT_IDS = new Set(['new', 'me', 'manage', 'edit']);

export default {
  async fetch(request, env, ctx) {
    try {
      return await handle(request, env, ctx);
    } catch {
      try { return withHeaders(await env.ASSETS.fetch(request)); }
      catch { return new Response('GeoHub is temporarily unavailable', { status: 503 }); }
    }
  },
};

async function handle(request, env, ctx) {
  const url = new URL(request.url);
  if (url.pathname === '/api/public-offers') return withHeaders(await publicOffersResponse(request, env, ctx));
  const asset = await env.ASSETS.fetch(request);
  const wantsPreview = request.method === 'GET'
    && (BOTS.test(request.headers.get('user-agent') || '') || url.searchParams.has('og'));
  const html = asset.status === 200 && (asset.headers.get('content-type') || '').includes('text/html');
  const target = wantsPreview && html ? match(url.pathname) : null;
  if (!target) return withHeaders(asset, { 'X-GeoHub-Worker': 'pass' });

  const cache = typeof caches !== 'undefined' ? caches.default : null;
  // Keyed by the worker version and the shell's etag, so a new deployment never
  // serves an old shell or a card built by older code.
  const shell = (asset.headers.get('etag') || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 40) || 'shell';
  const cacheKey = new Request(`${url.origin}${url.pathname}?__geohub_og=${WORKER_VERSION}-${shell}`);
  const cached = cache ? await cache.match(cacheKey).catch(() => null) : null;
  if (cached) return withHeaders(cached, { 'X-GeoHub-Preview': 'cached' });

  const meta = await loadMeta(target, env, url.origin).catch(() => null);
  const body = await rewrite(asset, meta, url).text();
  const headers = { 'Content-Type': 'text/html; charset=utf-8', 'X-GeoHub-Preview': meta ? 'page' : 'default' };
  // Only real cards are cached: a missing page or a slow read is tried again next time.
  if (meta && cache && ctx?.waitUntil) {
    ctx.waitUntil(cache.put(cacheKey, new Response(body, { headers: { ...headers, 'Cache-Control': `public, max-age=${CACHE_SECONDS}` } })).catch(() => {}));
  }
  return withHeaders(new Response(body, { status: 200, headers }), { 'Cache-Control': 'public, max-age=0, must-revalidate' });
}

function match(pathname) {
  for (const [re, kind] of ROUTES) {
    const m = pathname.match(re);
    if (!m) continue;
    let id = '';
    try { id = decodeURIComponent(m[1]); } catch { return null; }
    if (!id || NOT_IDS.has(id) || id.length > 128 || /[/\\?#]/.test(id)) return null;
    return { kind, id };
  }
  return null;
}

function withHeaders(res, extra = {}) {
  const out = new Response(res.body, res);
  const sec = typeof SECURITY_HEADERS === 'object' && SECURITY_HEADERS ? SECURITY_HEADERS : {};
  for (const [k, v] of Object.entries(sec)) if (!out.headers.has(k)) out.headers.set(k, v);
  for (const [k, v] of Object.entries(extra)) out.headers.set(k, v);
  return out;
}

/* ── Firestore REST (anonymous: the security rules apply) ───────────────── */

async function getDocument(env, path) {
  const base = (env && env.FIRESTORE_BASE) || FIRESTORE;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 3000);
  try {
    const r = await fetch(`${base}/${path.split('/').map(encodeURIComponent).join('/')}`, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.fields ? decodeFields(j.fields) : null;
  } finally {
    clearTimeout(timer);
  }
}

function decodeValue(v) {
  if (!v || typeof v !== 'object') return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return Date.parse(v.timestampValue);
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields || {});
  if ('geoPointValue' in v) return v.geoPointValue;
  if ('referenceValue' in v) return v.referenceValue;
  return undefined;
}

function decodeFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) out[k] = decodeValue(v);
  return out;
}

/* ── Meta per page type (field fallbacks mirror web/src/data/normalize.js) ─ */

const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const first = (...vals) => { for (const v of vals) if (v) return v; return ''; };
const arr = (v) => (Array.isArray(v) ? v : []);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const clean = (t) => str(t).replace(/\s+/g, ' ').trim();
const cut = (t, n) => { const c = clean(t); return c.length > n ? `${c.slice(0, n - 1).trimEnd()}…` : c; };
const garbled = (d) => Object.keys(d).some((k) => k.startsWith('isSeed') && d[k] === true)
  && ['name', 'title', 'text', 'description', 'fullName', 'displayName', 'bio'].some((f) => typeof d[f] === 'string' && d[f].includes('�'));
const gone = (d) => !d || garbled(d) || ['deleted', 'removed', 'hidden', 'banned', 'rejected', 'pending'].includes(str(d.status)) || d.deleted === true || !!d.deletedAt;

const isVideo = (u, type) => (type && String(type).startsWith('video')) || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u || '') || /\/video\/upload\//.test(u || '');

/** A Cloudinary picture cut to the card's shape; other hosts pass through. */
function picture(u, w, h, origin) {
  let url = str(u).trim();
  if (!url) return '';
  if (url.startsWith('//')) url = `https:${url}`;
  else if (url.startsWith('/')) url = origin + url;
  if (!/^https?:\/\//i.test(url)) return '';
  const crop = `c_fill,g_auto,w_${w},h_${h},q_auto,f_jpg`;
  if (/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url) && !/\/image\/upload\/[^/]*(w_|c_)/.test(url)) {
    return url.replace('/image/upload/', `/image/upload/${crop}/`);
  }
  if (/res\.cloudinary\.com\/[^/]+\/video\/upload\//.test(url)) {
    return url.replace('/video/upload/', `/video/upload/so_0,${crop}/`).replace(/\.(mp4|webm|mov|m4v|mkv)(\?.*)?$/i, '.jpg');
  }
  return url;
}

const large = (u, origin) => (u ? { image: picture(u, 1200, 630, origin), width: 1200, height: 630, card: 'summary_large_image' } : null);
const square = (u, origin) => (u ? { image: picture(u, 600, 600, origin), width: 600, height: 600, card: 'summary' } : null);

// Imported directory pages live in public, versioned assets rather than in
// Firestore. Read only the exact shard for this ID, and only for link previews.
async function directoryJson(env, origin, path) {
  const response = await env.ASSETS.fetch(new Request(new URL(path, origin)));
  if (!response.ok || !(response.headers.get('content-type') || '').includes('application/json')) return null;
  const length = Number(response.headers.get('content-length'));
  if (length > 8 * 1024 * 1024) return null;
  return response.json();
}

export async function loadImportedPlaceMeta(id, env, origin) {
  if (!/^(?:osm_(node|way|relation)_\d+|directory_[a-z0-9_]+)$/.test(id)) return null;
  const manifest = await directoryJson(env, origin, '/place-data/manifest.json');
  const assetName = value => typeof value === 'string' && /^(lookup|places)-[a-zA-Z0-9_-]+\.json$/.test(value);
  const lookupFile = typeof manifest?.lookup === 'string' ? manifest.lookup : manifest?.lookup?.file;
  if (manifest?.version !== 1 || !assetName(lookupFile) || !Array.isArray(manifest.shards)) return null;
  const lookup = await directoryJson(env, origin, `/place-data/${lookupFile}`);
  const key = lookup && Object.hasOwn(lookup, id) ? lookup[id] : null;
  if (!key) return null;
  const shard = manifest.shards.find(entry => entry.key === key);
  if (!assetName(shard?.file)) return null;
  const rows = await directoryJson(env, origin, `/place-data/${shard.file}`);
  const place = Array.isArray(rows) ? rows.find(row => row?.id === id) : null;
  if (gone(place)) return null;
  const [institutions, credits] = await Promise.all([
    directoryJson(env, origin, '/place-media/institutions-credits.json').catch(() => null),
    directoryJson(env, origin, '/place-media/credits.json').catch(() => null),
  ]);
  const photo = [...arr(institutions?.photos), ...arr(credits?.photos)].find(entry => entry.placeId === id && !isExcludedCuratedPhoto(id, entry.sourceTitle) && /^\/place-media\/[a-zA-Z0-9_-]+\.(jpg|webp|png)$/.test(entry.url));
  const name = clean(place.name) || SITE;
  const details = [clean(place.address), clean(place.city)].filter(Boolean).join(' · ');
  const photoSize = photo?.preview;
  const look = photo ? {
    image: picture(photo.url, 1200, 630, origin), card: 'summary_large_image',
    width: Number.isInteger(photoSize?.width) && photoSize.width > 0 ? photoSize.width : null,
    height: Number.isInteger(photoSize?.height) && photoSize.height > 0 ? photoSize.height : null,
  } : large(place.image, origin);
  return {
    title: name, docTitle: name, type: 'place',
    description: cut(place.description, 220) || cut(details, 220) || `${name} · ადგილების ცნობარი GeoHub-ზე`,
    ...(look || {}),
  };
}

// Written out by hand: the Workers runtime may not carry Georgian locale data.
const KA_MONTHS = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
const TBILISI_MS = 4 * 3600000;
/** Event times: timestamps as they are; "2026-06-01T08:00" (no zone) and "2026-06-01" are Tbilisi time, as the app reads them. */
function toMs(v) {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string' || !v) return 0;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return (Date.parse(`${v}T00:00:00Z`) - TBILISI_MS) || 0;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(v)) return (Date.parse(`${v}Z`) - TBILISI_MS) || 0;
  return Date.parse(v) || 0;
}

/** "5 ნოემბერი, 20:00" in Tbilisi time (UTC+4 all year); no time for midnight. */
function eventWhen(ms) {
  if (!ms) return '';
  const d = new Date(ms + TBILISI_MS);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${d.getUTCDate()} ${KA_MONTHS[d.getUTCMonth()]}${hh === '00' && mm === '00' ? '' : `, ${hh}:${mm}`}`;
}

async function loadMeta({ kind, id }, env, origin) {
  if (kind === 'post') {
    const d = await getDocument(env, `posts/${id}`);
    if (gone(d) || (d.status && d.status !== 'active')) return null;
    const author = clean(first(d.authorName, d.userName, d.businessName)) || SITE;
    const text = clean(d.text || d.caption) || clean(d.poll && d.poll.question);
    const media = arr(d.mediaUrls).filter(Boolean).length ? arr(d.mediaUrls).filter(Boolean)
      : [first(d.mediaUrl, d.imageUrl, d.photoUrl, d.image)].filter(Boolean).concat(arr(d.images).filter((x) => typeof x === 'string'));
    const pic = media.find((u) => !isVideo(u, d.mediaType)) || media[0] || '';
    const look = large(pic, origin) || square(first(d.authorAvatar, d.userPhoto, d.userPhotoURL, d.avatar, d.logoUrl), origin);
    return {
      title: author,
      docTitle: text ? `${author}: ${cut(text, 60)}` : author,
      description: text ? cut(text, 220) : (d.sharedPostId ? 'გააზიარა პოსტი GeoHub-ზე' : 'პოსტი GeoHub-ზე'),
      type: 'article',
      ...look,
    };
  }
  if (kind === 'user') {
    let d = await getDocument(env, `users/${id}`);
    if (!d) {
      const handle = await getDocument(env, `usernames/${id.toLowerCase()}`);
      const viaGeoId = !handle && /^\d{5}$/.test(id) ? await getDocument(env, `geoIds/${id}`) : null;
      const uid = str((handle || viaGeoId || {}).uid);
      if (uid) d = await getDocument(env, `users/${uid}`);
    }
    if (gone(d) || d.suspended) return null;
    const name = clean(first(d.fullName, d.displayName, d.name, d.username)) || SITE;
    const username = clean(d.username);
    const city = clean(d.city === 'all_georgia' ? '' : d.city);
    return {
      title: username ? `${name} (@${username})` : name,
      docTitle: name,
      description: cut(d.bio, 220) || (city ? `${name} · ${city} · GeoHub` : `${name} GeoHub-ზე`),
      type: 'profile',
      ...(square(first(d.avatar, d.photoURL, d.avatarUrl, d.photoUrl), origin) || large(first(d.coverImage, d.coverUrl, d.cover), origin) || {}),
    };
  }
  if (kind === 'place') {
    if (/^(?:osm_(node|way|relation)_\d+|directory_[a-z0-9_]+)$/.test(id)) return loadImportedPlaceMeta(id, env, origin);
    const d = await getDocument(env, `places/${id}`);
    if (gone(d)) return null;
    const name = clean(first(d.name, d.title)) || SITE;
    const where = [clean(d.category), clean(first(d.city, d.region))].filter(Boolean).join(' · ');
    const photos = arr(d.photos).filter((x) => typeof x === 'string');
    return {
      title: name,
      docTitle: name,
      description: cut(first(d.description, d.shortDescription), 220) || where || 'ადგილი GeoHub-ზე',
      type: 'place',
      ...(large(first(d.coverImage, d.imageUrl, d.photoUrl, d.image, photos[0]), origin) || {}),
    };
  }
  if (kind === 'business') {
    const d = await getDocument(env, `businesses/${id}`);
    if (gone(d)) return null;
    const name = clean(first(d.title, d.name)) || SITE;
    const where = [clean(d.category), clean(d.city)].filter(Boolean).join(' · ');
    const rating = num(d.ratingAverage || d.rating);
    const reviews = num(d.reviewCount ?? d.ratingCount);
    const stars = rating && reviews ? `★ ${rating.toFixed(1)} (${reviews}) · ` : '';
    return {
      title: name,
      docTitle: name,
      description: `${stars}${cut(first(d.description, d.desc), 200) || where || 'ბიზნესი GeoHub-ზე'}`,
      type: 'business.business',
      ...(large(first(d.coverUrl, d.coverImageUrl, d.coverImage, d.imageUrl, d.image), origin) || square(first(d.logoUrl, d.logo), origin) || {}),
    };
  }
  if (kind === 'event') {
    const d = await getDocument(env, `events/${id}`);
    if (gone(d)) return null;
    const title = clean(first(d.title, d.name)) || SITE;
    const when = eventWhen(toMs(d.date || d.startsAt || d.startDate));
    const where = clean(first(d.venue, d.location, d.address, d.city));
    const head = [when, where].filter(Boolean).join(' · ');
    const desc = cut(d.description, 180);
    return {
      title,
      docTitle: title,
      description: [head, desc].filter(Boolean).join(' — ') || 'ღონისძიება GeoHub-ზე',
      type: 'website',
      ...(large(first(d.imageUrl, d.image, d.coverUrl), origin) || {}),
    };
  }
  if (kind === 'group') {
    const d = await getDocument(env, `groups/${id}`);
    if (gone(d)) return null;
    const name = clean(first(d.name, d.title)) || SITE;
    const members = num(d.memberCount ?? d.membersCount);
    return {
      title: name,
      docTitle: name,
      description: cut(first(d.description, d.desc), 220) || (members ? `ჯგუფი · ${members} წევრი` : 'ჯგუფი GeoHub-ზე'),
      type: 'website',
      ...(large(first(d.coverUrl, d.coverImage, d.imageUrl, d.image), origin) || square(first(d.avatar, d.logo), origin) || {}),
    };
  }
  if (kind === 'item') {
    const d = await getDocument(env, `marketplace/${id}`);
    if (gone(d)) return null;
    const title = clean(d.title) || SITE;
    const price = num(d.price);
    const currency = str(d.currency || 'GEL') === 'GEL' ? '₾' : str(d.currency);
    const head = [price ? `${price} ${currency}` : '', clean(d.city)].filter(Boolean).join(' · ');
    const images = arr(d.images).filter(Boolean);
    return {
      title: price ? `${title} — ${price} ${currency}` : title,
      docTitle: title,
      description: [head, cut(d.description, 180)].filter(Boolean).join(' — ') || 'განცხადება GeoHub-ზე',
      type: 'product',
      ...(large(images[0] || first(d.imageUrl, d.image), origin) || {}),
    };
  }
  if (kind === 'video') {
    const d = await getDocument(env, `videos/${id}`);
    if (gone(d)) return null;
    const title = clean(d.title) || SITE;
    const yt = str(d.youtubeId) || (str(d.youtubeUrl || d.url).match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([A-Za-z0-9_-]{11})/) || [])[1] || '';
    const thumb = first(d.thumbnail, d.thumbnailUrl, yt && `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`, d.videoUrl, d.mediaUrl);
    return {
      title,
      docTitle: title,
      description: cut(d.description, 220) || clean(first(d.channelName, d.authorName)) || 'ვიდეო GeoHub-ზე',
      type: 'video.other',
      ...(large(thumb, origin) || {}),
    };
  }
  if (kind === 'channel') {
    const d = await getDocument(env, `channels/${id}`);
    if (gone(d)) return null;
    const name = clean(d.name) || SITE;
    const subs = num(d.subscriberCount);
    return {
      title: name,
      docTitle: name,
      description: cut(d.description, 220) || (subs ? `არხი · ${subs} გამომწერი` : 'ვიდეო არხი GeoHub-ზე'),
      type: 'website',
      ...(large(d.banner, origin) || square(d.avatar, origin) || {}),
    };
  }
  return null;
}

/* ── <head> rewrite ─────────────────────────────────────────────────────── */

const esc = (v) => str(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function rewrite(res, meta, url) {
  const origin = url.origin;
  const pageUrl = `${origin}${url.pathname}`;
  const canonicalOrigin = /\.geohub-main\.pages\.dev$/.test(url.hostname) ? PROD_ORIGIN : origin;
  const m = meta || {};
  const title = m.title || 'GeoHub — აღმოაჩინე საქართველო';
  const docTitle = m.docTitle ? `${m.docTitle} · ${SITE}` : title;
  const description = m.description || 'ადამიანები, ადგილები, ღონისძიებები, ბიზნესები და ვიდეოები ერთ სივრცეში.';
  const image = m.image || `${origin}/icons/geohub-g-og.png`;
  const width = m.image ? m.width : 1200;
  const height = m.image ? m.height : 630;
  const card = m.image ? m.card : 'summary_large_image';
  const set = (value) => ({ element(el) { el.setAttribute('content', value); } });
  const dimension = value => ({ element(el) { if (Number.isInteger(value) && value > 0) el.setAttribute('content', String(value)); else el.remove(); } });
  const extra = [
    `<meta property="og:url" content="${esc(pageUrl)}">`,
    `<meta property="og:image:alt" content="${esc(m.title || SITE)}">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    `<meta name="twitter:image" content="${esc(image)}">`,
    `<link rel="canonical" href="${esc(canonicalOrigin + url.pathname)}">`,
  ].filter(Boolean).join('\n  ');
  return new HTMLRewriter()
    .on('title', { element(el) { el.setInnerContent(docTitle); } })
    .on('meta[name="description"]', set(description))
    .on('meta[property="og:title"]', set(title))
    .on('meta[property="og:description"]', set(description))
    .on('meta[property="og:image"]', set(image))
    .on('meta[property="og:image:width"]', dimension(width))
    .on('meta[property="og:image:height"]', dimension(height))
    .on('meta[property="og:type"]', set(m.type || 'website'))
    .on('meta[name="twitter:card"]', set(card))
    .on('head', { element(el) { el.append(`\n  ${extra}\n`, { html: true }); } })
    .transform(res);
}
