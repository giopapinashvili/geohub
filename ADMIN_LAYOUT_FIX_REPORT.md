# Admin Layout Fix Report

Fixed the admin dashboard layout bug where the mobile sidebar overlay div was being treated as a desktop CSS grid item. This pushed the real sidebar/main content into the wrong grid cells and made the dashboard appear squeezed on the left with a large blank area.

Changed:
- `admin.css`

Fixes:
- `.admin-sidebar-overlay { display:none; }` on desktop
- explicit grid placement for `.topbar`, `.sidebar`, and `.main`
- main column uses `minmax(0, 1fr)` and `min-width:0` to prevent clipping
- mobile layout keeps sidebar as a drawer and main content full width

Test:
- Open `/admin.html` or `/admin`
- Dashboard should now show sidebar on the left and main content across the remaining page width
- Stats cards should appear as a normal 4-column dashboard instead of narrow vertical strips
