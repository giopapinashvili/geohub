# GeoHub — Backend Roadmap

> This document outlines the path from the current localStorage-based prototype to a production backend. Written for a technical lead or backend developer picking up this project.

---

## 1. Stack Options

### Option A — Firebase (Recommended for MVP speed)

| Service | Firebase Product | Cost |
|---------|-----------------|------|
| Auth | Firebase Auth | Free tier generous |
| Database | Firestore | Serverless, real-time |
| File storage | Firebase Storage | 5 GB free |
| Functions | Cloud Functions | Pay per invocation |
| Push notifications | FCM | Free |
| Hosting | Firebase Hosting | Free + CDN |

**Pros:** Zero server management. Real-time sync built-in (perfect for Live City feed). Georgian devs familiar. Fastest MVP path.  
**Cons:** Vendor lock-in. Firestore query limitations. Cost can spike at scale.

---

### Option B — Supabase (Recommended for long-term)

| Service | Supabase Product |
|---------|-----------------|
| Auth | Supabase Auth (JWT + magic link + OAuth) |
| Database | PostgreSQL (full SQL, row-level security) |
| File storage | Supabase Storage (S3-compatible) |
| Real-time | Supabase Realtime (Postgres changes → WebSocket) |
| Edge functions | Deno-based Edge Functions |
| Hosting | Self-host or Supabase hosting |

**Pros:** Full PostgreSQL (complex queries, joins). Open source, can self-host. Better for relational data (GeoHub has many FK relationships). RLS for per-user data isolation.  
**Cons:** Slightly more setup than Firebase. Less real-time simplicity than Firestore.

---

### Option C — Custom Node.js / Express + PostgreSQL

```
Stack:
  API:       Node.js + Express (or Fastify for performance)
  Database:  PostgreSQL 15+
  ORM:       Prisma or Drizzle
  Auth:      JWT (jsonwebtoken) + bcrypt
  Storage:   AWS S3 / Cloudflare R2
  Cache:     Redis (session, rate limiting, leaderboard)
  Queue:     BullMQ (XP events, notifications, email)
  WebSocket: socket.io or ws (Live City feed)
  Hosting:   Railway, Render, Fly.io, or VPS
```

**Pros:** Full control. Best for custom features (QR rewards engine, trust score algo, leaderboard). Can hire Georgian developers.  
**Cons:** Most dev time. Need to manage infra, security, scaling.

**Recommendation:** Start with **Supabase** for MVP (3–6 months). Migrate compute-heavy features to custom Node.js services as traffic grows.

---

## 2. Database Tables / Collections

### PostgreSQL schema (Supabase / custom)

```sql
-- Core
users           (id, full_name, username, email, password_hash, avatar_url, cover_url, bio, city, account_type, explorer_level, xp, rank, trust_score, is_verified, created_at, last_active_at)
user_interests  (user_id, interest)  -- separate table, not JSON array
user_badges     (user_id, badge_id, earned_at)
follows         (follower_id, following_id, created_at)

-- Content
posts           (id, type, user_id, place_id, caption, mood, image_url, xp_value, created_at)
post_tags       (post_id, user_id)        -- "with users"
likes           (user_id, post_id, created_at)
comments        (id, post_id, user_id, text, created_at)
checkins        (id, user_id, place_id, note, mood, xp_earned, lat, lng, created_at)

-- Places / Businesses
places          (id, slug, name, category, city, region, lat, lng, rating, review_count, price_tier, description, phone, email, verified, featured, created_at)
place_images    (place_id, url, position)
place_hours     (place_id, day_label, open_time, close_time, closed)
place_tags      (place_id, tag)
businesses      (id, place_id, owner_id, plan, plan_expiry, loyalty_enabled, points_per_visit, approval_status)
reviews         (id, place_id, user_id, rating, text, images, created_at)

-- Rewards
rewards         (id, business_id, title, description, type, value, xp_required, valid_until, max_claims, claimed_count, active)
reward_claims   (id, reward_id, user_id, code, claimed_at, status)

-- Challenges
challenges      (id, name, description, type, xp, city, ends_at, active)
challenge_participants (challenge_id, user_id, progress, completed, joined_at)

-- Events & Tickets
events          (id, title, organizer_id, type, city, venue, lat, lng, start_at, end_at, price, capacity, sold_count)
tickets         (id, event_id, user_id, quantity, code, status, booked_at, used_at)

-- Messaging
conversations   (id, type, created_at, updated_at)
conversation_participants (conversation_id, user_id)
messages        (id, conversation_id, sender_id, text, sent_at, read_at)

-- Creators
collab_offers   (id, from_user_id, to_creator_id, title, description, budget, currency, deadline, status, sent_at)

-- Real Estate
listings        (id, title, type, status, price, currency, city, district, lat, lng, bedrooms, bathrooms, area, agent_id, active, created_at)
listing_images  (listing_id, url, position)

-- Services & Learning
service_providers (id, user_id, category, city, bio, rate, currency, rating, completed_jobs, verified)
service_requests  (id, user_id, provider_id, description, status, created_at)
teachers        (id, user_id, subject, level, languages, price_per_hour, rating)
courses         (id, teacher_id, title, type, city, price, max_students, start_at)
lesson_bookings (id, student_id, teacher_id, course_id, code, status, booked_at)

-- Trust & Moderation
reports         (id, reporter_id, target_id, target_type, reason, details, status, submitted_at, resolved_at, moderator_id)
trust_events    (id, user_id, type, delta, reason, created_at)  -- audit log for trust score changes

-- Notifications
notifications   (id, user_id, type, from_user_id, target_id, target_type, text, icon, read, created_at)

-- Campaigns
campaigns       (id, owner_id, business_id, title, type, reward_id, budget, status, created_at)
```

---

## 3. Authentication Plan

### Flow

```
Sign Up → email verification (optional MVP) → JWT issued → stored in HttpOnly cookie
Login → password checked (bcrypt) → JWT + refresh token
Refresh → short-lived JWT (15m) + long-lived refresh (30d)
Logout → refresh token revoked server-side
```

### OAuth (Phase 2)
- Google Sign-In (most relevant for Georgian users)
- Apple Sign-In (required for iOS App Store)
- Facebook (optional)

### Security checklist
- `bcrypt` cost factor ≥ 12
- JWT secret in env var, rotated quarterly
- Rate limit `/auth/login` — max 10 attempts / 15 min per IP
- CSRF protection on all state-changing routes
- HttpOnly, Secure, SameSite=Strict cookies
- Email uniqueness enforced at DB level (unique index)

---

## 4. File Storage Plan

**Provider:** Supabase Storage (S3-compatible) or Cloudflare R2

```
Bucket structure:
  geohub-avatars/       → user avatars (max 2 MB, WebP)
  geohub-covers/        → profile covers (max 5 MB)
  geohub-posts/         → post images (max 8 MB each, 4 per post)
  geohub-businesses/    → business/place photos
  geohub-documents/     → verification docs (private bucket)
```

**Processing pipeline (Phase 2):**
- Resize avatars to 200×200 and 64×64 via Cloudflare Images or Sharp
- Convert all uploads to WebP
- Strip EXIF data (privacy)
- Virus scan on upload (ClamAV or SaaS)

---

## 5. Maps / Geolocation Plan

### Phase 1 (current) — static mock
- No real map API calls
- lat/lng stored in data, not rendered live

### Phase 2 (Mapbox GL JS — recommended)
```javascript
// Replace mock map divs with:
mapboxgl.accessToken = 'pk.geohub...';
const map = new mapboxgl.Map({
  container: 'liveMap',
  style: 'mapbox://styles/mapbox/dark-v11',
  center: [44.8, 41.7],  // Tbilisi
  zoom: 12
});
```
- Custom GeoHub map style (dark, Georgian street names)
- Place markers with category icons
- Clustering for dense areas
- User location (browser Geolocation API)

### Phase 3 (custom tile server)
- Self-hosted OpenStreetMap tiles via TileServer GL
- Georgia-specific PoI layer

---

## 6. QR / Rewards Plan

### QR code lifecycle
```
Business creates reward → reward.id stored in DB
User claims reward → server generates unique claim_code
claim_code hashed + stored → QR rendered client-side (qrcode.js)
Business scans QR → POST /rewards/verify { code }
Server validates hash, checks expiry, marks used
Business sees confirmation + earns verification XP
```

### Libraries
- `qrcode` (npm) — QR generation in-browser
- `zxing-js` — QR scanner via camera
- Or native `BarcodeDetector` API (Chrome/Edge)

---

## 7. Payments / Tickets Plan

### Provider options (Georgia)
| Provider | Notes |
|----------|-------|
| **BOG Pay** (Bank of Georgia) | Best for Georgian cards, native GEL |
| **TBC Pay** | Second-largest Georgian bank |
| **Stripe** | International cards, USD/EUR — add as fallback |
| **PayPal** | Optional for foreign tourists |

### Flow
```
User selects ticket → POST /checkout/initiate
Server creates pending order + Stripe/BOG session
User pays on provider checkout page
Webhook → POST /checkout/webhook (verify signature)
Server marks ticket confirmed → sends email + QR
```

### Security
- All payment amounts computed server-side — never trust client
- Idempotency keys on all payment requests
- Webhook signature verification (HMAC)
- Store only last-4 card digits + token — never full card data

---

## 8. Moderation / Trust Plan

### Trust score algorithm inputs
- Account age
- Verified email / phone
- Check-in consistency (not 50 check-ins in 5 minutes)
- Review quality score (length, photos, voted helpful)
- Reports received (negative delta)
- Reports submitted and confirmed (positive delta)
- Business owner verification
- Community badges earned

### Moderation tiers
1. **Auto-flag:** ML classifier on post text / images (offensive content)
2. **Community reports:** 3+ reports on same content → human review queue
3. **Moderator review:** Admin dashboard → approve / reject / warn
4. **Appeals:** User can appeal within 7 days via support ticket

---

## 9. Deployment Plan

### Recommended infrastructure

```
Production:
  API server:    Railway or Fly.io (auto-scaling)
  Database:      Supabase (managed PostgreSQL) or Neon
  File storage:  Supabase Storage or Cloudflare R2
  CDN:           Cloudflare (static assets + image CDN)
  Frontend:      Cloudflare Pages or Vercel (static HTML/JS)
  Email:         Resend.com or Postmark
  Monitoring:    Sentry (errors) + PostHog (analytics)
  Uptime:        BetterUptime.com

Staging:
  Mirror of production, seeded with test data
  Separate Supabase project
  GitHub Actions → deploy on push to `staging` branch

Development:
  Local: supabase start (Docker)
  Hot reload: nodemon / Vite
```

### CI/CD (GitHub Actions)
```yaml
on: push to main/staging
steps:
  - lint + typecheck
  - unit tests
  - integration tests (test DB)
  - build frontend
  - deploy API
  - deploy frontend
  - run smoke tests
  - notify Slack
```

---

## 10. MVP Backend Milestones

### Milestone 1 — Auth + User (Week 1–2)
- [ ] Supabase project setup + PostgreSQL schema
- [ ] `POST /auth/signup` with email verification
- [ ] `POST /auth/login` → JWT
- [ ] `GET /auth/me`
- [ ] `PATCH /auth/me` (profile update)
- [ ] Update `auth.js` → call real API instead of localStorage
- [ ] Update `account.js` → call `GeoAPI.getCurrentUser()`

### Milestone 2 — Places + Feed (Week 3–4)
- [ ] Seed `places` table with all mock BUSINESSES data
- [ ] `GET /places` with city/category filters
- [ ] `GET /places/:id`
- [ ] `POST /checkins`
- [ ] `GET /feed` (paginated, newest first)
- [ ] `POST /feed/posts`
- [ ] Image upload for posts (Supabase Storage)

### Milestone 3 — Rewards + Challenges (Week 5)
- [ ] `GET /rewards`
- [ ] `POST /rewards/:id/claim` → generate QR code
- [ ] `POST /rewards/verify` → validate QR scan
- [ ] `GET /challenges`
- [ ] `POST /challenges/:id/join`
- [ ] XP event queue (BullMQ) → update user.xp + rank

### Milestone 4 — Events + Messaging (Week 6–7)
- [ ] `GET /events` with date/city filters
- [ ] `POST /events/:id/tickets` (free events first, no payment yet)
- [ ] `GET /messages/:conversationId`
- [ ] `POST /messages`
- [ ] WebSocket for real-time message delivery
- [ ] Push notifications (FCM) for new messages

### Milestone 5 — Payments + Business Tools (Week 8–9)
- [ ] BOG Pay / Stripe integration for paid event tickets
- [ ] Webhook handler for payment confirmation
- [ ] `POST /businesses` (add business listing)
- [ ] Business dashboard: stats API `GET /businesses/:id/stats`
- [ ] `POST /campaigns`

### Milestone 6 — Admin + Trust (Week 10)
- [ ] Admin panel (internal, simple React or plain HTML)
- [ ] Report queue + moderation UI
- [ ] Trust score computation job (nightly cron)
- [ ] Email verification enforcement
- [ ] Rate limiting + abuse detection

### Milestone 7 — Polish + Launch (Week 11–12)
- [ ] Replace all `GeoConfig.DEMO_MODE = true` → `false`
- [ ] Replace all `GeoConfig.FEATURE_FLAGS.*` → `true`
- [ ] Remove demo-mode.js from production build
- [ ] Performance audit (Lighthouse ≥ 90)
- [ ] Security audit (OWASP top 10)
- [ ] Load test (Artillery or k6) — target: 500 concurrent users
- [ ] Soft launch with invite-only access
- [ ] Public launch 🇬🇪

---

## 11. Frontend Integration Checklist

When connecting each feature, update these files:

| File | What to change |
|------|----------------|
| `auth.js` | Replace `doLogin/doSignup` with `GeoAPI.login/signup` |
| `account.js` | Replace localStorage reads with `GeoAPI.getCurrentUser` |
| `feed.js` | Replace `MOCK_FEED_POSTS` with `GeoAPI.getFeed()` |
| `rewards.html` script | Replace static data with `GeoAPI.getRewards()` |
| `events.js` | Replace mock events with `GeoAPI.getEvents()` |
| `messages.js` | Replace mock convos with `GeoAPI.getMessages()` |
| `checkin.html` script | Replace fake XP with `GeoAPI.createCheckin()` |
| `business.js` | Replace `BUSINESSES` with `GeoAPI.getPlace(id)` |
| `config.js` | Flip `DEMO_MODE: false` and `FEATURE_FLAGS` |

---

*GeoHub Backend Roadmap v1.0 — Updated 2026-05*
