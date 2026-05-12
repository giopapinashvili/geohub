# GeoHub — Georgia's Real-World Discovery & City Platform

A full-featured MVP prototype for a Georgian social discovery, rewards, business growth, and community platform. Built entirely as a static front-end connected to Firebase Auth and Firestore.

---

## What Is GeoHub?

GeoHub turns the city of Georgia into a living ecosystem:

- **Explorers** discover places, earn XP, complete missions, and build a reputation
- **Businesses** get a verified page, run campaigns, and reach real local customers
- **Creators** build audiences, collaborate with brands, and monetize content
- **Organizers** list events and sell tickets directly on the platform
- **Patriots** complete real-world civic missions and earn community badges
- **Teachers** publish courses and workshops tied to real locations

---

## Feature List

| Category | Features |
|---|---|
| Discovery | Feed, Places, Map, Events, Groups, Live City |
| Social | Profile, Follow system, Messages, Social Layer, Stories |
| Gamification | XP system, GeoPoints, Rewards, Badges, Challenges, Levels |
| Patriot | Civic missions, before/after camera proof, trust scoring |
| Camera | 5 modes: Check-in, Story, Review Photo, Patriot, QR Scan |
| Business | Business pages, Dashboard, Campaigns, Analytics |
| Creators | Creator hub, brand collabs, reel system |
| Learning | Course catalog, enrollment, lessons |
| Real Estate | District listings, property discovery |
| Services | Service marketplace, booking |
| AI Assistant | GeoAI chat, daily planner, place recommendations |
| Search | Global search with command palette (⌘K) |
| Trust & Safety | Trust scores, moderation queue, verification |
| Admin OS | Full admin dashboard with live feed, charts, user/business management |
| AI World | Smart city simulation with live canvas map of Georgia |
| Pricing | Subscription plans for all 6 audience types, upgrade flow, coupons |
| Life Graph | Personal activity visualization and identity graph |
| Auth | Sign up / log in with real user pool |
| PWA | Installable, offline-capable, bottom nav, action sheet |

---

## How to Run Locally

No build step required. Open any HTML file directly in a browser:

```
# Option 1 — Open directly
Double-click index.html in your file explorer

# Option 2 — Local server (recommended, avoids some browser restrictions)
npx serve .
# or
python -m http.server 8080
# then open http://localhost:8080
```

**Note:** The service worker only registers on HTTP/HTTPS (not `file://` protocol). All other features work on `file://`.

---

## Demo Flow

**Core user loop:**
```
index.html → onboarding.html → feed.html → checkin.html → rewards.html → profile.html
```

**Business owner loop:**
```
index.html → add-business.html → dashboard.html
```

**Patriot mission loop:**
```
patriot.html → camera.html?mode=patriot → patriot.html (mission complete)
```

**Full demo presentation:**
```
demo.html → click "Start Presentation" → auto-guided 14-step walkthrough
```

**Power features:**
- `world.html` — AI World / Smart City Simulation
- `admin.html` — GeoHub Admin OS (God Panel)
- `pricing.html` — Subscription Plans + Checkout
- `lifegraph.html` — Personal Life Graph visualization
- `search.html` — Global Search / Command Center

---

## Placeholder Login Credentials

All real users share the same password: **`demo123`**

| User | Username | Account Type |
|---|---|---|
| Nino Gelashvili | `nino.explorer` | Creator |
| Giorgi Beridze | `giorgi.tastes` | Creator |
| Ana Kvaratskhelia | `ana.green` | Patriot |
| Keti Lomidze | `keti.learns` | Teacher |
| Elene Tsiklauri | `elene.student` | Student |
| Oto Kapanadze | `oto.hosts` | Business Owner |

You can also log in from `auth.html` and pick any real user from the quick-select panel.

---

## Coupon Codes (Pricing Page)

| Code | Discount |
|---|---|
| `GEOHUB25` | 25% off |
| `GEORGIA50` | 50% student discount |
| `WELCOME10` | 10% welcome discount |
| `TBILISI` | 15% Tbilisi launch discount |

---

## Known Limitations

- **Backend** — production data is stored in Firebase Auth + Firestore. Browser storage is not used for social/business data.
- **No real payments** — checkout flow is simulated with a 1.8s timeout.
- **No real camera** — falls back to real mode if `getUserMedia` is denied.
- **No real map** — map views are CSS/canvas simulations, not live GPS.
- **No real AI** — AI Assistant and AI World Feed use templated real responses.
- **No real notifications** — push notifications are simulated toast cycles.
- **Images** — user/admin content images come from submitted data. Empty states use neutral UI placeholders, not fake content.
- **PWA install** — works on Chrome/Edge on Android; limited on iOS Safari.
- **`file://` protocol** — Service Worker does not register; use a local HTTP server for full PWA testing.

---

## File Structure

```
/
├── index.html          # Landing page
├── onboarding.html     # Onboarding flow
├── feed.html           # Discovery feed
├── profile.html        # User profile (own + public)
├── admin.html/js       # Admin OS dashboard
├── world.html/js       # AI World simulation
├── pricing.html/js     # Subscription plans
├── camera.html/js      # Camera capture (5 modes)
├── demo.html/js        # Investor demo presentation
├── lifegraph.html/js   # Life graph visualization
├── search.html/js      # Global search
├── styles.css          # Global design system
├── mobile-nav.css/js   # Bottom nav + PWA shell
├── main.js             # Shared navbar + utilities
├── auth.js             # Authentication logic
├── data.js             # Placeholder content data
├── sw.js               # Service worker
├── manifest.json       # PWA manifest
└── icons/              # PWA icons (72–512px)
```

---

## Backend Roadmap

See [backend-roadmap.md](backend-roadmap.md) for the full API migration plan covering:
- Authentication (JWT + refresh tokens)
- Real-time features (WebSockets)
- Geolocation services
- Payment processing
- Push notifications
- Content moderation pipeline
- Analytics events

---

*GeoHub MVP — Built May 2026. Static prototype only. All data is real.*
