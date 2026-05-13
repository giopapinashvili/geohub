# Messages Scroll Fix V2

Fixed a regression from the reaction picker hotfix where `.chat-messages` was forced to `overflow: visible !important`, which disabled vertical scrolling in the Messages page.

Changes:
- Restored `.chat-messages { overflow-y: auto !important; }`
- Kept only message rows/bubble wrappers overflow-visible for reaction picker positioning
- Locked page/layout/chat-window heights to `100dvh` with `min-height: 0`
- Added mobile chat-open grid height rules
