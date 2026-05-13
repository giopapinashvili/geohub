# GeoHub — Facebook-style Social Features Phase 1

## What was added

### 1. Friend requests and friends
- Profile pages now show **Add Friend** for other users.
- Friend button supports states:
  - Add Friend
  - Request sent
  - Respond
  - Friends
- Incoming friend requests can be accepted/rejected from the profile Friends tab.
- Accepted requests create records in the `friends` collection.
- Friends tab displays real Firestore friends as clickable profile cards.

### 2. Profile social actions
- Other user profile now has:
  - Message
  - Add Friend
  - Follow
- Own profile keeps:
  - Edit Profile
  - Share
  - Logout

### 3. Comment replies
- Post comments now support one-level replies.
- Reply form opens under each comment.
- Replies are saved under:
  - `posts/{postId}/comments/{commentId}/replies/{replyId}`
- Replies notify the original comment author.

### 4. Better post composer
- Added privacy selector:
  - Public
  - Friends / Followers
  - Only me
- Added feeling/activity field.
- Basic @username mention extraction is saved into post data.

### 5. Better share composer
- Share modal now includes:
  - Share text
  - Privacy selector
  - Copy link button
  - Shared post preview block
- Shared posts keep `sharedPostId`.

### 6. Reaction state restore
- Reaction state is rehydrated from `posts/{postId}/reactions/{userId}` after feed/business/group posts render.
- Existing older like documents still fall back through `checkLiked`.

### 7. Group member/media tabs
- Group Members tab now loads real `groupMembers` records.
- Members are clickable and open `profile.html?id=USER_ID`.
- Group Media tab now shows media from real group posts.

### 8. Firestore rules
Updated rules for:
- nested comment replies
- `friends` collection
- user counter-only updates for `followers`, `following`, `friendsCount`, `postsCount`

## Files changed
- `firestore-social.js`
- `geohub-social-redesign.js`
- `geohub-social-redesign.css`
- `profile.html`
- `profile.js`
- `profile.css`
- `firestore.rules`

## QA checks run
- JavaScript syntax check for every `.js` file: PASS
- Missing local CSS/JS references in HTML: PASS
- Browser storage references: 0 matches

## Still remaining for later phases
These are bigger systems and should be done separately to avoid breaking the app:
- full privacy filtering based on confirmed friends only
- tagged user notifications
- full media galleries for users/businesses/places
- advanced group moderation/admin tools
- block user / hide user system
- business/page admin role management UI
- notification deep links to exact comment/reply position
- full edit/delete UI for posts/comments/replies
