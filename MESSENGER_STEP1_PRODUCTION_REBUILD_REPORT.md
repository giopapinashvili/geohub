# Messenger Step 1 Production Rebuild Report

## Scope
This pass focuses only on the Messenger system, because it was the biggest conflict source.

## Fixed
- `sendMessage()` now supports text-only and image messages.
- Message images upload through Cloudinary via existing `uploadImageDataUrl()`.
- Message documents now store `mediaUrl` and `mediaType`.
- Reactions now support multiple emoji: ❤️ 👍 😂 😮 😢 😡.
- Reaction toggle now behaves correctly:
  - same emoji again = remove reaction
  - different emoji = update reaction
  - no reaction = create reaction
- Reactions use the separate `messageReactions` collection.
- `messages.html` now renders real reaction picker UI instead of only a heart toggle.
- `messages.html` now has image sending button.
- Message images are constrained with responsive max width/height.
- Floating chat popup supports reaction picker and image sending.
- Floating chat popup is disabled on `messages.html` to prevent overlap with the full messages page.
- Emoji picker is populated and reusable.
- Conversation unread dot UI is improved.
- All changed JS files passed syntax checks:
  - `firestore-social.js`
  - `real-messages.js`
  - `chat-popup.js`

## Files changed
- `firestore-social.js`
- `real-messages.js`
- `chat-popup.js`
- `chat-popup.css`

## Still not part of this step
- Voice messages
- File/PDF attachments
- Message reply/threading
- Delivered/seen indicators
- Full Messenger multi-window stack

These should be separate steps after this Messenger foundation is tested live.
