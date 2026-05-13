# GeoHub Step 4 — Admin Panel + Placeholder Cleanup

## What was changed

### Admin Content Studio
- Moved the Content Studio section back into the main admin layout so sidebar navigation can open it correctly.
- Added `admin-step4-production.js`.
- Added richer Firestore item creation fields:
  - image URL / cover URL
  - website/link
  - price / points cost
  - event date
  - status
  - visibility
- Added normalized payloads for:
  - places
  - businesses
  - groups
  - events
  - rewards
  - challenges
  - services
  - real estate listings
  - learning items/courses
  - creators
- Added Recent Content preview with delete button per selected collection.
- Added real Firestore count refresh for admin dashboard counters.

### Placeholder cleanup
- Replaced visible Admin “coming soon” labels with “Firestore / Admin-controlled” text.
- Replaced the Messages “New conversation coming soon” button with a real user-search modal.
- Replaced the Messages “Attachment coming soon” button with a real image picker hook.
- Removed visible coming-soon labels from clean content pages where they were shown as feature placeholders.

### QA performed
- Checked all HTML script/CSS references for missing local files: OK.
- Ran `node --check` on all JS files: OK.
- Verified `admin-step4-production.js`: OK.
- Verified `admin.js`: OK.

## Important note
Firebase live writes still require:
- `admins/{your_uid}` existing in Firestore.
- Latest `firestore.rules` published.
