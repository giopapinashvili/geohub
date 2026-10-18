import { createSubscriptionRunner } from './advisor-subscription.mjs';
import { selectCandidates, makeAdvisorPrompt, parseAdvisorAnswer } from './advisor-data.mjs';
import { loadExpandedAdvisorCatalog } from './advisor-catalog.mjs';

export function isLocalRequest(req) {
  const address = req.socket?.remoteAddress;
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)) return false;
  const host = req.headers.host || '';
  if (!/^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host)) return false;
  if (req.headers.origin && req.headers.origin !== `http://${host}`) return false;
  if (req.headers['sec-fetch-site'] && !['none', 'same-origin'].includes(req.headers['sec-fetch-site'])) return false;
  return true;
}

export function validateChat(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 2000) {
    throw new Error('დაწერე შეკითხვა, მაქსიმუმ 2000 სიმბოლო.');
  }
  if (body.history !== undefined && !Array.isArray(body.history)) throw new Error('მიმოწერის ფორმატი არასწორია.');
  const history = (body.history || []).slice(-6);
  for (const message of history) {
    if (!message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string' || message.content.length > 6000) throw new Error('მიმოწერის ფორმატი არასწორია.');
  }
  return { message: body.message.trim(), history: history.map((item) => ({ role: item.role, content: item.content.slice(0, 2000) })) };
}

async function readBody(req) {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (Buffer.byteLength(text) > 64000) throw new Error('მოთხოვნა ძალიან დიდია.');
  }
  try { return JSON.parse(text); } catch { throw new Error('მოთხოვნის ფორმატი არასწორია.'); }
}

export function createAdvisorHandler({ runner = createSubscriptionRunner(), loadCatalog = loadExpandedAdvisorCatalog, maxTurns = 30 } = {}) {
  let catalog = null, catalogPending = null, lastLoad = 0, busy = false, turns = 0;
  const currentCatalog = async () => {
    if (catalog && Date.now() - lastLoad < 10 * 60000) return catalog;
    if (!catalogPending) catalogPending = loadCatalog().then((result) => { catalog = result; lastLoad = Date.now(); return result; }).finally(() => { catalogPending = null; });
    return catalogPending;
  };
  const send = (res, status, value) => {
    if (res.destroyed || res.writableEnded) return;
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(value));
  };
  return async (req, res, next) => {
    const pathname = (req.url || '').split('?')[0];
    if (!pathname.startsWith('/__advisor/')) return next();
    if (!isLocalRequest(req)) return send(res, 403, { error: 'მრჩეველი ხელმისაწვდომია მხოლოდ ამ კომპიუტერის პირად საცდელ რეჟიმში.' });
    if (pathname === '/__advisor/status' && req.method === 'GET') {
      const [status, data] = await Promise.all([runner.status(), currentCatalog().catch(() => null)]);
      return send(res, 200, { ...status, coverage: data?.coverage || null, remainingTurns: Math.max(0, maxTurns - turns) });
    }
    if (pathname !== '/__advisor/chat' || req.method !== 'POST') return send(res, 404, { error: 'მოთხოვნა ვერ მოიძებნა.' });
    if (req.headers['x-geohub-advisor'] !== 'local-preview' || !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return send(res, 403, { error: 'მოთხოვნა გაუშვი GeoHub-ის საცდელი გვერდიდან.' });
    if (busy) return send(res, 429, { error: 'ერთი პასუხი უკვე მზადდება. დაელოდე ან შეაჩერე.' });
    if (turns >= maxTurns) return send(res, 429, { error: 'საცდელი სესიის 30 მოთხოვნა ამოიწურა. გამოწერის დასაცავად ახალი მოთხოვნები შეჩერებულია.', remainingTurns: 0 });
    busy = true;
    const controller = new AbortController();
    const disconnected = () => { if (!res.writableEnded) controller.abort(); };
    res.once('close', disconnected);
    try {
      let input;
      try { input = validateChat(await readBody(req)); }
      catch (error) { return send(res, 400, { error: error.message }); }
      const data = await currentCatalog();
      if (!data.records.length) return send(res, 503, { error: 'ადგილების მონაცემები ვერ ჩაიტვირთა. მოგვიანებით სცადე.' });
      const candidates = selectCandidates(data.records, input.message, input.history);
      if (controller.signal.aborted) return;
      turns++;
      const raw = await runner.ask(makeAdvisorPrompt(input.message, input.history, candidates, data.coverage), { signal: controller.signal });
      const answer = parseAdvisorAnswer(raw, candidates);
      return send(res, 200, { ...answer, coverage: data.coverage, provider: 'ChatGPT', remainingTurns: Math.max(0, maxTurns - turns) });
    } catch (error) {
      return send(res, 503, { error: /[ა-ჰ]/.test(error.message || '') ? error.message : 'მრჩეველმა სანდო პასუხი ვერ მოამზადა. სცადე შეკითხვის დაზუსტება.', remainingTurns: Math.max(0, maxTurns - turns) });
    } finally { busy = false; res.removeListener('close', disconnected); }
  };
}

export function advisorPlugin() {
  return {
    name: 'geohub-private-advisor', apply: 'serve',
    configureServer(server) {
      server.middlewares.use(createAdvisorHandler());
    },
  };
}
