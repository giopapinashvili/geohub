# Global Chat Visible Fix

Fixed the Messenger bubble not appearing on the Home page.

Changes:
- `chat-popup.js` now mounts the floating button immediately on DOM load.
- The button no longer waits for Firebase/Auth/conversation listeners before appearing.
- If Firebase chat is not ready, clicking the button opens `messages.html` instead of doing nothing.
- Added retry boot for `GeoFirebaseReady` and `GeoSocialReady` race conditions.
- Added force CSS to keep the bubble visible above all layouts.

Expected result:
- The Messenger button appears on every page in the bottom-right corner.
- Logged-in users can open the popup directly.
- If chat services are still loading, the button still shows and links to Messages.
