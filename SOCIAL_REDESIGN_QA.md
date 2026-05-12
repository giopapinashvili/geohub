# GeoHub Social Redesign v2 QA Notes

## Changed core files
- `index.html` — now loads the social feed shell.
- `feed.html` — replaced old mixed/static structure with unified GeoHub social feed.
- `explore.html` — replaced old directory/filter page with real mixed Discover feed.
- `groups.html` — replaced old group page with social group list/detail flow.
- `business.html` — replaced old business page with business/page list + business profile page.
- `add-business.html` — now loads the redesign patch so final submit writes to Firestore.
- `geohub-social-redesign.css` — new GeoHub dark/green social layout.
- `geohub-social-redesign.js` — new feed/discover/groups/business/page logic.
- `firestore.rules` — added/updated rules for business pages, followers, reviews, and counter updates.

## Main behavior implemented
- Home/feed uses 3-column social layout: left navigation, center feed, right widgets.
- Composer creates real Firestore posts.
- Posts support reactions, comments, share-to-feed, save, report menu.
- Discover loads real Firestore collections: posts, businesses, groups, places, events, services, rewards, challenges, learningItems, creators.
- Businesses page loads real `businesses` collection.
- Adding a business creates a real Business Page in Firestore plus `businessAdmins` owner record.
- `business.html?id=...` opens profile-style business page with cover, logo, follow, save, message, posts, about, reviews.
- Business admins/owners can post as the business.
- Groups page loads real groups, supports group creation, join/private request, group detail page, and group posts through the unified posts collection.
- Header badges are connected to notifications/conversations where Firestore data exists.

## Manual step still required
After upload/deploy, publish the updated `firestore.rules` manually in Firebase Console:
Firestore Database → Rules → replace with this file → Publish.

## Static checks performed
- `node --check geohub-social-redesign.js` passed.
- `node --check firestore-social.js` passed.
- `node --check add-business.js` passed.
- `node --check real-messages.js` passed.
- ZIP was repacked with the updated files.

## Runtime note
I could not run a real Firebase browser session from this environment. After deploying and publishing rules, test with a real Firebase user:
1. Create a post.
2. React/comment/share/save.
3. Add a business.
4. Confirm it appears on Businesses and Discover.
5. Open business page and post as business.
6. Create group.
7. Open group and post in it.
