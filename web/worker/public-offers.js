// Public, read-only source adapter. No merchant credentials or user data.
// Only hardcoded official hosts are fetched; caller input never chooses a URL.
export function parseZoommerOffers(html, observedAtMs = Date.now()) {
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

export async function publicOffersResponse(request, env, ctx) {
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
