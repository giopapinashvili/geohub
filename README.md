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

## Security model (read before touching data access)

`firestore.rules` is the source of truth for who may read what. Rules are not
filters: every query must carry a constraint that proves the reader may see
all of its results, or Firestore rejects the whole query.

- **Posts** — `visibility`: `public` | `friends` | `followers` | `close_friends` |
  `onlyme` | `group` (posts in private/secret groups). Friends-only posts store
  `audienceIds` (author + friends at posting time), close-friends posts store
  `closeFriendIds`. The feed is the public stream (`visibility == 'public'`)
  merged with `authorId == me`, `audienceIds array-contains me` and
  `closeFriendIds array-contains me` for the same time window
  (`web/src/data/posts.js`). Comments, replies and reactions follow the post.
- **Stories** — public stories carry `closeFriends: false` explicitly; the tray
  asks for that, plus `closeFriendsList array-contains me`, plus my own.
- **Profiles** — `users/{uid}` is public. `email`, `phone`, `birthday` and
  `searchHistory` live in `users/{uid}/private/account` (owner + admin only);
  the rules refuse them in the public document, and sign-in moves legacy
  values over (`movePrivateFields` in `web/src/lib/auth.js`).
- **Groups** — joining is self-service only as `member`: open groups directly,
  private/secret groups after a manager approved `groupJoinRequests/{gid}__{uid}`.
  Roles are changed by the group's owner/admins, never by the member.
- **Friend requests** — only the recipient may set `accepted`; an accepted
  request is what allows a `friendships`/`friends` document.
- **Coupons** — only the `redeemReward` Cloud Function issues `rewardCoupons`
  (idempotent per `requestId`); business owners mark them used.
- **Support** — `tickets` accept guests, with a strict field whitelist.

`npm run test:rules` runs `web/tools/rules-check.mjs` against the emulators
(allowed **and** refused cases). CI runs it on every push and pull request.

## Deploy order for rules changes

New queries need their indexes, the new site calls the new `redeemReward`,
and the new rules reject old clients' queries, so:

1. `npx firebase deploy --only firestore:indexes,functions` — then wait until
   every index shows "Enabled" (Firebase console → Firestore → Indexes).
2. `node web/tools/migrate-privacy.mjs` (dry run) → check the summary →
   `node web/tools/migrate-privacy.mjs --apply` (needs `serviceAccountKey.json`).
3. Publish the site (merge to `master`; Cloudflare Pages serves `dist/`).
4. `npx firebase deploy --only firestore:rules`.
5. Cloudinary console → Settings → Upload → preset `geohub_unsigned`: allow only
   image/video/audio/pdf formats, set a max file size (e.g. 100 MB) and keep the
   `geohub/` folder — the browser checks alone cannot stop direct uploads.
