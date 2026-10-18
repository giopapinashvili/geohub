# Personal and business identity audit

Checked 2026-10-19 against the working app. No production documents were written.
The authenticated UID remains the permission owner; a page identity is a public
author/sender identity, not a replacement login.

## Corrected in this audit

- Quick share now publishes as the selected page and shows the publishing name/logo.
- Public comments, replies, story replies, tagged-post notifications and business
  message notifications carry the explicit publishing identity. Personal actions
  still use the personal notification sender.
- Activity on page-authored posts, comments and stories is addressed to the page
  inbox rather than the administrator's personal inbox. Two pages managed by one
  user remain distinct notification actors.
- Optional notification sender metadata is validated by Firestore rules: real
  `fromUserId`, matching personal actor, or a page the caller manages. Legacy
  notifications remain readable.
- Composer drafts have separate account/page/group keys. Input is persisted
  before closing the dialog; another identity cannot inherit that draft.
- Business posts use the business verification flag, never the owner's personal
  verification, and do not expose personal friends/close-friends editing choices.
- Page-authored posts are excluded from their administrator's personal profile
  feed. A personal visitor post on a business wall remains a personal post.
- Video comments now save the same page identity shown by the input, with page
  links/avatars (implemented by the video agents).
- The mobile menu shows the active identity; owner-account shortcuts are labeled
  as personal (implemented by the navigation agent).
- Place review and check-in forms explicitly identify the personal author.
- Private place favorites reset immediately when the selected place or signed-in
  account changes; late reads and writes cannot restore another context's state.

## Deliberately personal or separately scoped behavior

These have not been silently converted into business-owned data:

- Saved/bookmarked items, discount watchlists, friends/follows, safety lists,
  poll votes, reactions/likes, video subscriptions and viewing history are
  authenticated-user records. Page reactions/follows require a separate schema
  and are not advertised as implemented.
- Place/business reviews and physical check-ins describe a person's experience.
  Business review forms now explicitly show the personal publishing account.
- Needs requests and legacy marketplace listings remain personal. Their create
  forms identify the personal author; business merchandise belongs in the
  business catalog.
- Group membership, group creation/management and group post publishing remain
  user-scoped. Group screens and group composer explain this. Public comments
  can use the selected page identity where supported by the existing rules.
- Quote requests use the personal contact information entered in the form and
  now show that scope. Business catalog/discount/branch management acts on the
  explicitly opened business, subject to its permissions.
- A page may reply in its existing customer inbox. Starting an arbitrary new
  personal DM from page mode requires the explicit personal flow. Share-to-chat
  is labeled as a personal chat action.
- Wallet, rewards, account settings, security, support, invitations and global
  administrator actions remain tied to the authenticated user.
- Video channels are explicitly selected publishing destinations, with channel
  permissions; selecting a business page does not silently reassign a channel.

## Validation

- `node --test web/tools/content-identity.test.mjs`: 4 focused checks passed.
- `node web/tools/actor-audit-e2e.mjs`: 9 real UI/emulator scenarios passed:
  page quick share/verification, page-to-page notification identity, comment and
  story reply routing, draft isolation/restoration, personal profile separation,
  explicit personal marketplace/review/check-in notices, and favorite state
  across sign-out/account/place changes, and standalone check-in discovery with
  Georgian/Latin typo matching, address exclusion and exact imported hydration.
  No browser JavaScript errors.
- Rules checks for optional notification actors and video comment identity were
  run by the map/video data agent. Existing legacy personal formats stay valid.
- Targeted ESLint passed for the modified modules and components.

The UI run creates only uniquely prefixed fixtures in local `demo-geohub`
emulators. Its results and screenshot are in
`.codex/artifacts/actor-audit/`, which is not a deployed asset directory.
