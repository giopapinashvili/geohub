# GeoHub

ქართული სოციალური ქსელი და ბიზნეს-ცენტრი: ადგილები, ბიზნესები, „მჭირდება“ მოთხოვნები,
განცხადებები, ღონისძიებები, ჯგუფები, მესენჯერი ზარებით და ვიდეო.

Live: https://geohub-main.pages.dev — Cloudflare Pages serves the committed `dist/`.

## Layout

| Path | What |
| --- | --- |
| `web/` | The app (Vite + Preact). `web/src` code, `web/public` static files (`_headers`, `sw.js`, icons) |
| `dist/` | Production build — commit it after `npm run build` |
| `functions/` | Firebase Cloud Functions |
| `cloudflare-worker/` | Payments / TURN worker |
| `firestore.rules`, `firestore.indexes.json` | Database rules and indexes (shared with production data) |

## Develop

```bash
npm install
npm run emulators          # Firebase auth + Firestore emulators with the production rules
npm run seed               # Georgian demo data (nino@test.ge / geohub123 …)
npm run dev:emulator       # http://127.0.0.1:5173 against the emulators
npm run dev                # against the real project
```

## Before committing

```bash
npm run lint
npm run i18n:check         # missing translation keys (ka is complete; en/ru are not yet)
npm run build              # writes dist/
npm run test:e2e           # needs the emulators + dev:emulator running
```

`test:e2e` runs `web/tools/e2e-flows.mjs` (posting, comments, messages, stories, friends, groups,
business, page switching …), `web/tools/e2e-call.mjs` (voice/video calls with fake media) and
`web/tools/sweep.mjs` (every route at several widths: overflow, errors, untranslated keys).

Old links such as `/feed.html?post=…` or `/profile.html?id=…` are redirected by `web/src/legacy.js`.
