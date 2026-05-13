# GeoHub Profile Links + Facebook Gap Report

## Fixed in this ZIP

### 1. Global user profile routing
User names and avatars now route to the correct public profile using:

```text
profile.html?id={USER_ID}
```

Applied to:
- feed post author avatar/name
- feed comment author avatar/name
- business review author avatar/name
- story viewer author name
- messages conversation user avatar/name/header
- search user results

### 2. Profile page route compatibility
`profile.js` now supports both:

```text
profile.html?id={USER_ID}
profile.html?uid={USER_ID}
```

This keeps old links working while standardizing the new route on `id`.

### 3. Top profile button
The topbar profile button now routes to:

```text
profile.html?id={CURRENT_USER_ID}
```

When logged out it routes to `auth.html`.

### 4. Business posts vs user posts
If a post is authored as a business page, clicking its author opens the business page:

```text
business.html?id={BUSINESS_ID}
```

Normal user posts open the user profile.

### 5. Safer user display names
Profiles now also read `name` field, not only `fullName` / `displayName`, so older Firestore user docs display correctly.

## Static checks run

- JS syntax check: PASS
- Search page inline script check: PASS
- Remaining `profile.html?uid` references in active JS/HTML: 0

## Facebook features GeoHub still does not fully have

### High priority missing / incomplete
1. Friend system: add friend, accept/decline, friends-only posts.
2. Full profile timeline: posts, photos, friends, groups, check-ins rendered as real tabs.
3. Tagged users in posts/comments with clickable profile mentions.
4. Comment replies and threaded comments beyond basic comments.
5. Reaction picker with persistent user reaction state shown after reload.
6. Share composer with embedded original post preview, not only basic share.
7. Full notification targets: every notification should deep-link to exact post/comment/profile/group/business.
8. Member/follower lists with clickable profiles.
9. Business/page roles: owner, admin, editor, moderator with invite/remove flow.
10. Group roles and moderation: admins, moderators, post approval, member removal.
11. Media galleries: photos/videos collected from posts.
12. Privacy controls: public, followers, friends, only me, group-only.
13. Blocking/hiding users and posts.
14. Report flow with admin review UI.
15. Saved collections/folders, not just basic save.

### GeoHub-specific upgrades better than Facebook clone
1. Check-ins tied to places/businesses.
2. XP and badges for real-world discovery.
3. Map-first discovery layer.
4. Online/Nationwide businesses without required location.
5. Georgia-wide service areas.
6. Business pages as live local/online hubs.
7. GeoPulse / live activity widgets.

## Recommended next fixes

1. Make follower/member lists real and clickable.
2. Add public profile preview cards on hover.
3. Add full friend request system.
4. Add profile timeline cards using the same `postCard()` component.
5. Add business/page admin role management.
6. Add group member tab from Firestore.
