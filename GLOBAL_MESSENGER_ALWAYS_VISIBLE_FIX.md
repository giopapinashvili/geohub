# Global Messenger Always Visible Fix

Fixed the floating Messenger bubble so it appears on every page for logged-in users immediately after auth loads.

Changes:
- The Messenger button no longer waits for existing conversations.
- It stays visible even when the user has no conversations yet.
- Closing/minimizing returns the floating button.
- New incoming messages still auto-open the popup.
- Button styling was made more visible.

Test:
1. Deploy to Cloudflare.
2. Login.
3. Open Home, Feed, Profile, Groups, Places.
4. The Messages bubble should be visible at the bottom-right on all pages.
