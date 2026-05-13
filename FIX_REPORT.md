# GeoHub hotfix

Fixed after optimization:

1. Restored the original social write layer for posts and stories so the optimization changes do not break publishing.
2. Restored the original social redesign logic for feed/story rendering.
3. Added a working emoji picker on Messages.
4. Added message heart/like reactions.
5. Updated Firebase config to expose `arrayUnion` / `arrayRemove` for message reactions.
6. Updated Firestore rules so conversation participants can update only message reaction fields (`likedBy`, `reactionCount`, `updatedAt`).

Important: after upload, publish the included `firestore.rules` again in Firebase Console → Firestore Database → Rules → Publish.
