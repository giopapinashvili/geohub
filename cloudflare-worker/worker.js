/**
 * GeoHub Payments — Cloudflare Worker
 *
 * Endpoints:
 *   POST /create-checkout-session  — create Stripe Checkout session
 *   POST /stripe-webhook           — receive & verify Stripe events
 *   GET  /payment-status/:id       — poll payment status from frontend
 *
 * Required secrets (set via: wrangler secret put <NAME>):
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET
 *   STRIPE_PRICE_PREMIUM_MONTHLY   — Stripe Price ID (price_xxx) for premium monthly plan
 *   STRIPE_PRICE_PREMIUM_YEARLY    — Stripe Price ID for premium yearly plan
 *   FIREBASE_API_KEY               — Firebase web API key (for ID token verification)
 *   FIREBASE_CLIENT_EMAIL          — Service account email (from Firebase Console JSON)
 *   FIREBASE_PRIVATE_KEY           — Service account private key PEM (from Firebase Console JSON)
 *
 * Required vars (in wrangler.toml):
 *   FIREBASE_PROJECT_ID = "geohub-main"
 *   SITE_URL = "https://geohub.pages.dev"
 */

// ── CORS ──────────────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  'https://geohub.pages.dev',
  'https://geohub.ge',
  'https://www.geohub.ge',
];

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allow  = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age':       '86400',
  };
}

function json(data, status = 200, cors = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

// ── Entry point ───────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const { pathname } = new URL(request.url);

    try {
      if (pathname === '/create-checkout-session' && request.method === 'POST') {
        return await handleCreateSession(request, env, cors);
      }
      if (pathname === '/stripe-webhook' && request.method === 'POST') {
        return await handleWebhook(request, env);
      }
      if (pathname.startsWith('/payment-status/') && request.method === 'GET') {
        return await handlePaymentStatus(pathname.slice('/payment-status/'.length), env, cors);
      }
      return json({ error: 'Not found' }, 404, cors);
    } catch (err) {
      console.error('[GeoHub Worker]', err.message);
      return json({ error: 'Internal server error' }, 500, cors);
    }
  },
};

// ── Create checkout session ───────────────────────────────────────────────────

async function handleCreateSession(request, env, cors) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400, cors); }

  const { type, userId, idToken, eventId, businessId, plan, quantity = 1 } = body || {};

  if (!type || !userId || !idToken) {
    return json({ error: 'Missing required fields: type, userId, idToken' }, 400, cors);
  }

  // Verify Firebase ID token — userId must match the token's uid
  const verifiedUid = await verifyFirebaseToken(idToken, env);
  if (!verifiedUid || verifiedUid !== userId) {
    return json({ error: 'Unauthorized — invalid or expired token' }, 401, cors);
  }

  if (type === 'event_ticket') {
    if (!eventId) return json({ error: 'eventId is required for event_ticket' }, 400, cors);
    return await createEventTicketSession(env, cors, verifiedUid, eventId, Number(quantity) || 1);
  }

  if (type === 'business_subscription') {
    if (!businessId || !plan) return json({ error: 'businessId and plan are required for business_subscription' }, 400, cors);
    return await createBusinessSubscriptionSession(env, cors, verifiedUid, businessId, plan);
  }

  return json({ error: 'Unknown type — use event_ticket or business_subscription' }, 400, cors);
}

async function createEventTicketSession(env, cors, userId, eventId, quantity) {
  const event = await firestoreGet(env, `events/${eventId}`);
  if (!event) return json({ error: 'Event not found' }, 404, cors);

  const priceGEL = Number(event.ticketPrice || event.price || 0);
  if (!priceGEL || priceGEL <= 0) {
    return json({ error: 'This event does not have a ticket price set' }, 400, cors);
  }

  const origin = env.SITE_URL || 'https://geohub.pages.dev';
  const eventTitle = String(event.title || event.name || 'Event').slice(0, 100);

  const session = await stripeRequest(env, 'POST', '/checkout/sessions', {
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'gel',
        unit_amount: Math.round(priceGEL * 100), // tetri
        product_data: {
          name: `Ticket — ${eventTitle}`,
          description: event.date ? `GeoHub Event: ${event.date}` : 'GeoHub Event',
          ...(event.image ? { images: [event.image] } : {}),
        },
      },
      quantity,
    }],
    metadata: { type: 'event_ticket', userId, eventId, quantity: String(quantity) },
    success_url: `${origin}/payment-success.html?session_id={CHECKOUT_SESSION_ID}&type=ticket`,
    cancel_url:  `${origin}/payment-cancel.html?type=ticket&event=${eventId}`,
  });

  // Pending payment record — Firestore write ONLY confirms after webhook
  await firestoreSet(env, `payments/${session.id}`, {
    stripeSessionId: session.id,
    userId,
    type: 'event_ticket',
    eventId,
    eventTitle,
    quantity,
    amount: priceGEL * quantity,
    currency: 'gel',
    status: 'pending',
    createdAt: new Date().toISOString(),
  });

  return json({ url: session.url, sessionId: session.id }, 200, cors);
}

async function createBusinessSubscriptionSession(env, cors, userId, businessId, plan) {
  const priceId = plan === 'premium_monthly'
    ? env.STRIPE_PRICE_PREMIUM_MONTHLY
    : plan === 'premium_yearly'
      ? env.STRIPE_PRICE_PREMIUM_YEARLY
      : null;

  if (!priceId) return json({ error: `Invalid plan: ${plan}` }, 400, cors);

  // Ownership check — never trust frontend
  const business = await firestoreGet(env, `businesses/${businessId}`);
  if (!business) return json({ error: 'Business not found' }, 404, cors);
  if (business.ownerId !== userId && business.createdBy !== userId) {
    return json({ error: 'You do not own this business' }, 403, cors);
  }
  if (business.subscriptionStatus === 'active') {
    return json({ error: 'Business already has an active subscription' }, 409, cors);
  }

  const origin = env.SITE_URL || 'https://geohub.pages.dev';

  const session = await stripeRequest(env, 'POST', '/checkout/sessions', {
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: '1' }],
    metadata: { type: 'business_subscription', userId, businessId, plan },
    subscription_data: { metadata: { userId, businessId, plan } },
    success_url: `${origin}/payment-success.html?session_id={CHECKOUT_SESSION_ID}&type=subscription`,
    cancel_url:  `${origin}/payment-cancel.html?type=subscription`,
  });

  await firestoreSet(env, `payments/${session.id}`, {
    stripeSessionId: session.id,
    userId,
    type: 'business_subscription',
    businessId,
    businessName: String(business.name || '').slice(0, 100),
    plan,
    currency: 'gel',
    status: 'pending',
    createdAt: new Date().toISOString(),
  });

  return json({ url: session.url, sessionId: session.id }, 200, cors);
}

// ── Stripe Webhook ────────────────────────────────────────────────────────────

async function handleWebhook(request, env) {
  const sig = request.headers.get('stripe-signature');
  if (!sig) return new Response('Missing stripe-signature header', { status: 400 });

  const rawBody = await request.text();

  const valid = await verifyStripeWebhook(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) return new Response('Webhook signature verification failed', { status: 400 });

  const event = JSON.parse(rawBody);

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object, env);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    case 'invoice.payment_succeeded':
      await handleInvoiceSucceeded(event.data.object, env);
      break;
    // Add more event types as needed
  }

  return new Response('OK', { status: 200 });
}

async function handleCheckoutCompleted(session, env) {
  const meta = session.metadata || {};

  // Idempotency guard — only process if still pending
  const existing = await firestoreGet(env, `payments/${session.id}`);
  if (existing && existing.status !== 'pending') return;

  // Update payment to completed
  await firestoreSet(env, `payments/${session.id}`, {
    status:                'completed',
    stripePaymentIntentId: session.payment_intent  || '',
    stripeCustomerId:      session.customer        || '',
    stripeSubscriptionId:  session.subscription    || '',
    amountTotal:           session.amount_total    || 0,
    completedAt:           new Date().toISOString(),
  });

  if (meta.type === 'event_ticket') {
    await createEventTicket(session, meta, env);
  } else if (meta.type === 'business_subscription') {
    await activateBusinessSubscription(session, meta, env);
  }
}

async function createEventTicket(session, meta, env) {
  const ticketId   = `TKT-${session.id.slice(-10).toUpperCase()}`;
  const ticketCode = `GH-EVT-${generateCode(8)}`;

  await firestoreSet(env, `eventTickets/${ticketId}`, {
    paymentId:       session.id,
    stripeSessionId: session.id,
    userId:          meta.userId,
    eventId:         meta.eventId,
    quantity:        parseInt(meta.quantity || '1'),
    amountTotal:     session.amount_total || 0,
    currency:        session.currency    || 'gel',
    status:          'active',
    ticketCode,
    qrValue:         ticketCode,
    createdAt:       new Date().toISOString(),
  });
}

async function activateBusinessSubscription(session, meta, env) {
  const subId = session.subscription || session.id;

  await firestoreSet(env, `businesses/${meta.businessId}/subscriptions/${subId}`, {
    paymentId:           session.id,
    stripeSubscriptionId: subId,
    stripeCustomerId:    session.customer || '',
    businessId:          meta.businessId,
    userId:              meta.userId,
    plan:                meta.plan,
    status:              'active',
    createdAt:           new Date().toISOString(),
  });

  // Flip the business to premium
  await firestoreUpdate(env, `businesses/${meta.businessId}`, {
    subscriptionStatus: 'active',
    plan:               meta.plan,
    stripeCustomerId:   session.customer || '',
    premiumSince:       new Date().toISOString(),
    verified:           true,
  });
}

async function handleSubscriptionDeleted(subscription, env) {
  const meta       = subscription.metadata || {};
  const businessId = meta.businessId;
  if (!businessId) return;

  await firestoreUpdate(env, `businesses/${businessId}`, {
    subscriptionStatus: 'canceled',
    premiumEnded:       new Date().toISOString(),
  });
  await firestoreUpdate(env, `businesses/${businessId}/subscriptions/${subscription.id}`, {
    status:     'canceled',
    canceledAt: new Date().toISOString(),
  });
}

async function handleInvoiceSucceeded(invoice, env) {
  if (!invoice.subscription) return;
  const meta       = invoice.subscription_details?.metadata || {};
  const businessId = meta.businessId;
  if (!businessId) return;

  const periodEnd = invoice.lines?.data?.[0]?.period?.end;

  await firestoreUpdate(env, `businesses/${businessId}/subscriptions/${invoice.subscription}`, {
    status:           'active',
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : '',
    lastRenewedAt:    new Date().toISOString(),
  });
}

// ── Payment status ────────────────────────────────────────────────────────────

async function handlePaymentStatus(sessionId, env, cors) {
  if (!sessionId || !sessionId.startsWith('cs_')) {
    return json({ error: 'Invalid session ID' }, 400, cors);
  }

  const payment = await firestoreGet(env, `payments/${sessionId}`);
  if (!payment) return json({ status: 'not_found' }, 404, cors);

  const result = {
    status:   payment.status,
    type:     payment.type,
    currency: payment.currency || 'gel',
  };

  if (payment.status === 'completed') {
    if (payment.type === 'event_ticket') {
      const ticketId = `TKT-${sessionId.slice(-10).toUpperCase()}`;
      const ticket   = await firestoreGet(env, `eventTickets/${ticketId}`);
      if (ticket) {
        result.ticket = {
          ticketCode: ticket.ticketCode,
          qrValue:    ticket.qrValue,
          eventId:    ticket.eventId,
          quantity:   ticket.quantity,
        };
      }
    } else if (payment.type === 'business_subscription') {
      result.plan       = payment.plan;
      result.businessId = payment.businessId;
    }
  }

  return json(result, 200, cors);
}

// ── Stripe helpers ────────────────────────────────────────────────────────────

async function stripeRequest(env, method, path, params = {}) {
  const url  = `https://api.stripe.com/v1${path}`;
  const body = method !== 'GET' ? new URLSearchParams(flattenStripe(params)).toString() : undefined;

  const res  = await fetch(url, {
    method,
    headers: {
      'Authorization':  `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type':   'application/x-www-form-urlencoded',
      'Stripe-Version': '2024-11-20.acacia',
    },
    body,
  });

  const data = await res.json();
  if (data.error) throw new Error(`Stripe: ${data.error.message}`);
  return data;
}

function flattenStripe(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && item !== undefined && typeof item === 'object') {
          Object.assign(out, flattenStripe(item, `${key}[${i}]`));
        } else if (item !== null && item !== undefined) {
          out[`${key}[${i}]`] = String(item);
        }
      });
    } else if (typeof v === 'object') {
      Object.assign(out, flattenStripe(v, key));
    } else {
      out[key] = String(v);
    }
  }
  return out;
}

async function verifyStripeWebhook(body, signature, secret) {
  const parts = signature.split(',');
  const tPart = parts.find(p => p.startsWith('t='));
  const v1Part = parts.find(p => p.startsWith('v1='));
  if (!tPart || !v1Part) return false;

  const timestamp   = tPart.slice(2);
  const expectedSig = v1Part.slice(3);

  // Reject replays older than 5 minutes
  if (Math.abs(Math.floor(Date.now() / 1000) - parseInt(timestamp, 10)) > 300) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${body}`));
  const computed  = Array.from(new Uint8Array(sigBytes)).map(b => b.toString(16).padStart(2, '0')).join('');

  return computed === expectedSig;
}

// ── Firebase token verification ───────────────────────────────────────────────

async function verifyFirebaseToken(idToken, env) {
  if (!idToken) return null;
  try {
    const res  = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ idToken }),
      },
    );
    const data = await res.json();
    if (data.error || !data.users?.[0]) return null;
    return data.users[0].localId; // uid
  } catch {
    return null;
  }
}

// ── Firestore REST helpers ────────────────────────────────────────────────────

async function getFirestoreToken(env) {
  const jwt = await buildServiceAccountJWT(env.FIREBASE_CLIENT_EMAIL, env.FIREBASE_PRIVATE_KEY);
  const res  = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const { access_token } = await res.json();
  if (!access_token) throw new Error('Could not obtain Firestore access token');
  return access_token;
}

async function buildServiceAccountJWT(email, privateKeyPem) {
  const now     = Math.floor(Date.now() / 1000);
  const b64url  = obj => btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const header  = b64url({ alg: 'RS256', typ: 'JWT' });
  const payload = b64url({
    iss:   email, sub: email,
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,   exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/datastore',
  });

  const sigInput = `${header}.${payload}`;

  const pem     = privateKeyPem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const keyData = Uint8Array.from(atob(pem), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const sigBytes = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(sigInput));
  const sig      = btoa(String.fromCharCode(...new Uint8Array(sigBytes)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${sigInput}.${sig}`;
}

function fsUrl(env, path) {
  return `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`;
}

async function firestoreGet(env, path) {
  try {
    const token = await getFirestoreToken(env);
    const res   = await fetch(fsUrl(env, path), { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) return null;
    const doc = await res.json();
    return doc.fields ? fromFsFields(doc.fields) : null;
  } catch { return null; }
}

async function firestoreSet(env, path, data) {
  const token  = await getFirestoreToken(env);
  const fields = toFsFields(data);
  return fetch(fsUrl(env, path), {
    method:  'PATCH',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fields }),
  });
}

// PATCH with updateMask so only provided fields are written
async function firestoreUpdate(env, path, data) {
  const token  = await getFirestoreToken(env);
  const fields = toFsFields(data);
  const mask   = Object.keys(data).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  return fetch(`${fsUrl(env, path)}?${mask}`, {
    method:  'PATCH',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fields }),
  });
}

function toFsFields(obj) {
  const f = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) { f[k] = { nullValue: null }; }
    else if (typeof v === 'boolean')   { f[k] = { booleanValue: v }; }
    else if (typeof v === 'number')    { f[k] = Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }; }
    else if (typeof v === 'string')    { f[k] = { stringValue: v }; }
    else if (typeof v === 'object')    { f[k] = { mapValue: { fields: toFsFields(v) } }; }
  }
  return f;
}

function fromFsFields(fields) {
  const obj = {};
  for (const [k, v] of Object.entries(fields)) {
    if ('stringValue'  in v) obj[k] = v.stringValue;
    else if ('integerValue' in v) obj[k] = parseInt(v.integerValue, 10);
    else if ('doubleValue'  in v) obj[k] = v.doubleValue;
    else if ('booleanValue' in v) obj[k] = v.booleanValue;
    else if ('nullValue'    in v) obj[k] = null;
    else if ('timestampValue' in v) obj[k] = v.timestampValue;
    else if ('mapValue'     in v) obj[k] = fromFsFields(v.mapValue.fields || {});
    else if ('arrayValue'   in v) obj[k] = (v.arrayValue.values || []).map(i => fromFsFields({ _: i })._);
  }
  return obj;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function generateCode(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  for (const b of bytes) code += chars[b % chars.length];
  return code;
}
