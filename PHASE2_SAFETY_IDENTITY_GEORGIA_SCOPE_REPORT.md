# GeoHub Phase 2 Update Report

Implemented on top of `Geohub1_facebook_features_phase1.zip`.

## Added / Improved
- Report / Hide / Block safety system:
  - `hiddenPosts`
  - `blockedUsers`
  - improved `reports`
  - post menu now includes hide/report/block actions.
- Feed now filters hidden posts and blocked authors for the current user.
- Notification deep links improved:
  - comments now link to `feed.html?post=POST_ID&comment=COMMENT_ID`.
  - feed auto-scrolls and opens comments for deep-linked posts.
- Profile upgrade:
  - edit profile modal
  - city scope supports `All Georgia`
  - Businesses tab
  - Badges tab
  - report/block buttons on other profiles.
- Business owner dashboard inside business page:
  - followers/posts/reviews/offers overview
  - create offer
  - edit page
  - post update.
- Image upload pipeline:
  - Cloudinary upload helper is used for post/story/profile/check-in media.
  - Firebase Storage is intentionally not required on the free/Spark setup.
- Onboarding changed from single-city assumption to Georgia-wide/multi-area interests:
  - `All Georgia`
  - multi-city/region selection.
- GeoPulse live panel now uses real collection counts instead of fake city numbers.

## Firestore collections added
- `hiddenPosts`
- `blockedUsers`
- `userBadges`
- `businessOffers`
- `businessAnalytics`

## Manual step still required
Publish the updated `firestore.rules` in Firebase Console after deployment.

## Notes
This update avoids making users choose only one city. GeoHub can now support users interested in all Georgia or multiple cities/regions, which fits Georgia better because people move between cities often.
