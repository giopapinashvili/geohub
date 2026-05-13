# GeoHub Chat Popup Feature

Added Facebook-style floating chat popup.

## What was added
- `chat-popup.js`
- `chat-popup.css`
- Included on pages that already load `firestore-social.js`:
  - `index.html`
  - `feed.html`
  - `profile.html`
  - `messages.html`
  - `groups.html`
  - `business.html`
  - `explore.html`
  - `places.html`
  - `rewards.html`
  - `search.html`
  - `add-business.html`

## Features
- Floating Messages button in bottom-right corner.
- Small chat window like Facebook Messenger.
- Incoming message toast notification.
- Incoming message auto-opens the chat popup.
- Reply directly from the popup.
- Emoji picker in the popup.
- Heart/like reaction on messages.
- Uses the existing Firestore structure:
  - `conversations/{conversationId}`
  - `conversations/{conversationId}/messages/{messageId}`

## Important
No Firestore schema migration is required.
Existing `firestore.rules` already allow participant message reads/creates and message reactions.
