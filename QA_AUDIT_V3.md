# GeoHub Social Redesign — Real Audit v3

What was actually wrong in the previous ZIP:

1. `add-business.js` still had the old `submitForm()` logic that saved the business to Firestore. The new Firestore logic was only a wrapper from `geohub-social-redesign.js`, so the page was fragile and could still behave like the old version depending on load order/cache.
2. Business images, tags, services, working hours and plan were not saved to Firestore when creating a business page.
3. Stories were displayed as cards, but clicking a story did not open a viewer.
4. Notification dropdown showed notifications but did not mark them read, so badges could stay stuck.
5. Business page posts rendered after the listener fired, but post interactions were bound before the posts were injected. Like/comment/share/save on freshly loaded business posts could fail until another event binding existed.
6. Post/story creation accepted only image URLs. It now also allows selecting an image from the device and stores it as a data URL fallback. This is not Firebase Storage yet, but it makes the UI work immediately without a storage pipeline.
7. Discover had no final error UI if the Promise chain failed.
8. A lot of old project files still contain Firestore code. Key redesigned pages do not load most of those old scripts, but other pages still need future cleanup if the whole platform must become production-only.

Changed in this v3:

- `add-business.js`: real Firestore business page creation directly inside submitForm.
- `add-business.js`: saves category, city, description, contact data, tags, working hours, services, plan, cover image and gallery previews.
- `add-business.js`: creates `businessAdmins/{businessId}_{uid}` owner record.
- `geohub-social-redesign.js`: device image picker for posts.
- `geohub-social-redesign.js`: device image picker for stories.
- `geohub-social-redesign.js`: story viewer modal added.
- `geohub-social-redesign.js`: notification “Mark all read” and auto-read behavior added.
- `geohub-social-redesign.js`: business posts now re-bind post interactions after render.
- `geohub-social-redesign.js`: Discover loading now has catch UI.
- `geohub-social-redesign.css`: story viewer and unread notification styles.

Still not fully production-perfect:

- Image uploads are still stored as data URLs in Firestore/local content for immediate preview. Real production should use Firebase Storage and save only download URLs.
- Admin panel still contains old fallback/Firestore sections and needs a deeper dedicated admin rewrite.
- Many non-redesigned pages still contain older placeholder/demo logic.
- “Manage business” points to `add-business.html?edit=...`, but edit mode is not fully implemented yet.
- Group member list/media tab are placeholder states, not full data renderers.

Manual required step:

Publish `firestore.rules` from this ZIP in Firebase Console.
