# Official menu link review — 19 October 2026

This small enrichment adds publisher links, not imported merchant inventory.
There are no production database writes and no copied menu photographs.
Inspection time is distinct from a menu's effective date. No prices were imported
because an effective date or confirmation of current prices was unavailable.

| Place | Exact OSM match | Publisher trail | Date finding |
| --- | --- | --- | --- |
| Fabrika, Ninoshvili 8 | `osm_way_548795814` | [Official Eats page](https://www.hostelfabrika.com/eats) → [Fabrika's linked menu directory](https://linktr.ee/fabrika.hostel) | Separate Lobby Bar, Bar Bagel and F.A.R.M PDF links; effective dates unconfirmed. This is a multi-venue complex, not one combined restaurant menu. |
| Café Stamba, Kostava 14 | `osm_node_6404748085` | [Official guest menu section](https://guest.stambahotel.com/cafe-stamba#menu) | Embedded publisher CMS metadata lists four menu files uploaded 15 September 2025. The main filename includes `2025_SEP1`. Upload time does not confirm current prices. |
| Café Daphna, Atoneli 29 | `osm_node_8432033717` | [Official homepage](https://daphna.ge/) → [Tbilisi menu](https://cafedaphna.ge/qr-menu/tbilisi/) → embedded merchant menu `https://menu.ps.me/l2azNuLR4EQ` | Menu effective date not displayed. Official homepage and merchant menu agree on Atoneli 29 and the branch phone. Batumi's menu is a separate link and is excluded. |

The old Café Stamba PDF at
`https://stambahotel.com/wp-content/uploads/2024/05/Cafe_Stamba_Main-Menu_24.05.2024.pdf`
was not imported or represented as current.

Stamba's bookshop and hotel points, similarly named Daphna shops, and other
Fabrika-named restaurants are not assigned these menus. Matching is by reviewed
stable ID, not a name guess. The normal merchant-entered menu/catalog continues
to appear alongside the official link whenever there is an explicit business
association. The map drawer and full place page share `PlaceCommerce`.

The review also found Geo.Graphia's official HTML menu with listed prices, but
the exact restaurant/branch was not found in the selected imported records;
no menu was attached by guesswork. Barbarestan's site was unavailable during the
bounded check, so it was not added.
