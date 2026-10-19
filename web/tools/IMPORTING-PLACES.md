# Tbilisi place snapshot

This pipeline publishes a local, attributed OpenStreetMap snapshot. It does not
write to Firestore or copy Google Maps content. Existing GeoHub place IDs remain
unchanged. OSM records use stable `osm_node_…`, `osm_way_…`, `osm_relation_…` IDs.

The geographic rectangle is `[44.60, 41.58, 45.05, 41.91]` (west, south, east,
north), covering Tbilisi and surroundings. It is not an administrative boundary.
An absent city tag stays absent. This snapshot cannot guarantee all businesses,
all mall tenants, current opening hours, or an exact building entrance.

## Refresh

Run from the repository root. Install the parser into an ignored tools directory;
the website's dependencies do not change:

```powershell
npm.cmd install --prefix .codex/artifacts/place-import/runtime --no-save --no-package-lock osm-pbf-parser@2.3.0
node web/tools/import-tbilisi-extract.mjs --download
node web/tools/import-tbilisi-osm.mjs
node web/tools/generate-native-place-source-records.mjs
node --test web/tools/coordinates.test.mjs web/tools/import-tbilisi.test.mjs
```

For an existing PBF, supply its actual source metadata:

```powershell
node web/tools/import-tbilisi-extract.mjs --input .codex/artifacts/place-import/georgia.osm.pbf --source-date 2026-10-17 --source-url https://download.geofabrik.de/europe/georgia-261017.osm.pbf
```

Review `web/public/place-data/manifest.json` before publishing. It records source
date/URL, category counts, mapped brand locations, directory links, file hashes
and byte sizes. Refreshing files alone does not deploy the site.

The builder gives every data file a content-hash filename and updates only the
small `manifest.json` pointer. Older hashed files stay available for open tabs;
do not delete them while clients may still use the previous manifest. The loader
revalidates the manifest and bounds its parsed shard cache. Cloudflare Pages can
cache the hash-named data assets immutably without making refreshes stale.

## Runtime

Metro markers represent pedestrian entrances, not underground station centers.
The PBF extractor retains `public_transport=stop_area` relation members, and
`metro-entrances.mjs` uses only those explicit memberships to give each entrance
its station name. Entrances keep their own coordinates; no nearest-station guess
is made. Station IDs remain resolvable for old pages, but `raw.mapHidden` removes
their centers from map symbols and search. `raw.mapPlaceId` redirects an old map
link to a documented entrance. The manifest records linked and unresolved counts.

- `loadImportedPlaces(bounds, { zoom })` fetches only intersecting 0.025° shards.
  Distant zoom uses a 500-place overview. A 64-shard safety limit returns honest
  `coverage.truncated` metadata; zoom in for detail.
- `getImportedPlace(id)` loads a lookup index and one shard for a direct page.
- `loadImportedSearchIndex()` loads compact search rows on the first search only;
  it can run in a worker. It includes named streets and building numbers.
- `mergeImportedPlaces()` preserves native IDs. Without an explicit source ID,
  only exact name + category + address within 20 m suppresses an imported duplicate
  in display. Unnamed objects and distinct branches remain separate.
- Mall directory links combine mapped POI points inside a mall polygon with
  explicitly reviewed tenant records from the mall's own directory. Relation-only
  malls can have these explicit links. The page labels the list as partial.
  Floor labels use `facets.level` and retain the publisher's numbering. Shared
  building coordinates are never presented as surveyed indoor shop positions.
- Brand counts use explicit `brand`/`brand:wikidata`, not guessed business names.
  Points within 20 m on the same mapped level are counted once. Branch counts
  exclude ATMs and payment/vending machines. Coverage is this snapshot only.
- Coordinates of areas are approximate centers. Do not describe them as entrances.

No photos, ratings, prices, reviews, menus, dietary claims or preparation times
are fabricated. Diet and accessibility filters use explicit OSM tags only.
Lifecycle tags (`disused`, `abandoned`, vacant shops, etc.) suppress inactive POIs.
Source timestamps, category mappings and deduplication deserve review on updates.

The broader extraction policy also retains office/retail/commercial structures
and educational areas. These are not verified operating businesses; building-only
records carry `raw.recordKind`. Structures with historical/disused uses can remain
as locations with `raw.operatingStatus: source-reports-inactive`, while their old
opening hours are stored separately and not treated as current.

`verified-place-supplement.mjs` adds reviewed `directory_*` records from official
institutional sources and corrects six multi-campus relation centers using explicit
building/site anchors. Never invent coordinates for a source with only an address.
The record keeps the official facts URL separate from its coordinate evidence;
publisher map centers, shared indoor building positions and address-matched building
centers stay approximate. The manifest lists these official sources and counts
separately from OSM. See `PLACE-COVERAGE-AUDIT.md` for measured coverage and known gaps.

## Public-directory reconciliation

`source-directory-definitions.mjs` combines the previously published institutional
supplement with reviewed chain, bank, school, university, library, museum, postal,
mall, healthcare and merchant-directory sources. The source-specific audit files
record accepted, matched, ambiguous, out-of-area and unavailable rows. A source
row must have a stable ID, explicit category, coordinate evidence and source URL.

`source-directory-policy.mjs` merges only an explicit `matchedPlaceId` backed by
`matchEvidence`; it never deduplicates a branch just because another point is
nearby. Later sources can reference an earlier source ID that has itself been
merged to an OSM ID. Canonical page IDs, coordinates and existing owner data stay
intact. Reviewed name/address/category corrections require separate evidence.
New facts, photos and source-based posts enrich the canonical page. These posts
are labelled GeoHub directory content and are separate from user/merchant posts.

Wolt is labelled `merchant-directory`, not an official institutional register.
The source's delivery listing is not evidence of walk-in access, dine-in service,
stock, opening hours, food preparation time or dietary certification. Virtual
restaurants without a confirmed visitor address and ambiguous same-business
matches remain in the audit, outside publication. Each accepted image is linked
to that merchant's source page and labelled as a listing illustration where its
subject is a dish/product rather than a verified branch exterior.

Source-published photographs and logos do not acquire a Creative Commons license.
Credits retain their publisher, original URL, checked date and byte hash; unknown
capture dates remain unknown. Local previews are resized for loading performance.
Logo registries require reviewed artwork; ambiguous generic names use exact
canonical place IDs, and category guards prevent unrelated businesses receiving
the same logo. An unavailable image remains missing instead of borrowing another
branch's photograph. The existing licensed Commons images retain their licenses.

After changing accepted sources, rebuild the publication and native display bridge:

```powershell
node web/tools/import-tbilisi-osm.mjs
node web/tools/generate-native-place-source-records.mjs
node --test web/tools/directory-publication.test.mjs web/tools/source-directory-*.test.mjs web/tools/place-brand-assets.test.mjs web/tools/native-place-enrichment.test.mjs
npm run build
```

The dataset manifest distinguishes source-row counts, unique enriched places,
new records and mapped structures. Neither record totals nor a successful import
prove that every Tbilisi business, entrance, office or tenant has been found.
The parsed public-data LRU is capped at 24 MiB so the manifest, lookup and dense
source-enriched shards can coexist; it still excludes account/credential data
and a second copy of the search index. Share-preview reads use the same bounded
24 MiB per-file allowance as the importer.

## Global and catalog search

The header, full search page, and map share `discoverySearch` ranking. Imported
street/address ranking runs in a worker; separate request channels prevent a
header query from cancelling a map query. Results retain their original labels
and show a similarity label for spelling corrections. Building/model number
tokens are not corrected to different numbers.

`searchCatalogPlaces(term, limit)` in `data/search.js` returns known map locations
for real, available, published menu/product/service entries. Its array has
`coverage` metadata. Global search also includes businesses without coordinates.
Catalog reads paginate up to 2,000 published records and 500 branches per business,
with a five-minute memory cache. These are bounded client-side scans, not a claim
of complete catalog search at unlimited scale; move the index to a server as the
catalog grows. A partial-source notice appears on errors or coverage limits.
Items restricted to named branches cannot appear at headquarters or another
branch. All catalog links point to the actual business, item and selected branch.
Demonstration data is excluded. No prices, preparation times or branch positions
are inferred. Validate with `node --test web/tools/catalog-discovery.test.mjs`.

## Source menus, products and services

The public merchant source catalog is separate from owner-managed Firestore
catalogs. `catalog-data/index.json` maps each reviewed Wolt venue to its existing
canonical place; accepted source definitions are the allowlist. A restaurant's
root response can contain its full menu, while larger shops require category
pagination. A partial response is never labelled complete. The importer retains
source dates, exact item IDs, source categories, product images, GEL minor-unit
prices and optional choices. Missing prices stay unknown. Delivery prices are
explicitly labelled and are not asserted to be in-store prices or branch stock.
Preparation times, dietary guarantees, ratings and customer content are not
inferred. Explicit publisher dietary flags are retained separately and labelled
as source declarations; product names cannot establish them. Unavailable items
are omitted from search. Old price snapshots expire.

`directoryCatalogSearch.js` uses a small prefix index and loads relevant catalog
files on demand. Georgian, transliterated Georgian and misspellings share the
same ranking; numeric product models stay exact. Product categories remain
visible so an accessory with a short phone-model name is not presented as the
phone itself. Result links preserve the exact place and item. Unknown diet or
preparation-time fields cannot satisfy those filters.

`source-service-catalog.mjs` contains individually sourced provider services.
Its publisher validates every place membership, price and source URL before
emitting content-addressed files and `services-index.json`. Branch-specific
services remain branch-specific; provider-wide digital services say so. Clinic
catalogs with limited source results retain a partial marker and their own branch
source links. A provider's generic contact page cannot establish a service at
every branch. Run this publisher after rebuilding the place dataset.

```powershell
node web/tools/import-directory-catalogs.mjs --phase=roots
node web/tools/import-directory-catalogs.mjs --phase=complete
node web/tools/publish-service-catalog.mjs
node web/tools/audit-place-content.mjs
node --test web/tools/directory-catalog*.test.mjs web/tools/source-catalog-runtime.test.mjs web/tools/source-service-catalog.test.mjs
```

The merchant importer saves responses and progress under the ignored
`.codex/artifacts/directory-catalogs/` directory. Respect source throttling and
Retry-After; do not rotate identities or increase request rates to bypass limits.
`--rebuild-only` reconstructs indexes from existing local venue files without
remote requests. Catalog indexes and mutable venue/search filenames revalidate;
hashed service files can remain cached. Memory caching is bounded to 12 MiB and
contains only public catalog data, with no account cookies or credentials.

`place-content-audit.json` distinguishes mapped objects, named places, photographs,
logos, sourced posts and actual nonempty catalogs by category. It is a source
inventory, not a claim that every business or every product has been found.
Owner-entered catalogs are outside this static audit. Infrastructure is not
expected to have a commercial catalog.

## Explicit community experience

`placeReviews.experienceTags` is an optional array of up to six allowed values.
Users select these themselves; review text is never treated as proof of a tag.
The same person contributes at most one vote per tag and place. The map reads
only reviews containing the chosen tag, up to 2,000 documents with explicit
coverage metadata. Unknown or untagged places do not silently qualify.
`loadCommunityTagPlaces` results are cached for five minutes and invalidated
after review writes. Displayed summaries refer to the reviews actually loaded.

## Curated photographs

Four manually checked Wikimedia Commons photos cover three exact OSM records.
`lib/curatedPlaceMedia.js` contains the ID mapping; `public/place-media/credits.json`
records original URLs, authors, licenses, capture dates, checksums and download
metadata. The photographs retain their respective CC BY-SA licenses separately
from the ODbL map database. Local JPEGs are Wikimedia's 1,280-pixel previews;
the UI fits them to gallery frames and exposes credits/date/license links.
They are historical photographs, not a claim of present-day appearance.

When refreshing, request `prop=imageinfo&iiprop=url|extmetadata` from the Commons
MediaWiki API for each recorded source title, check its license and inspect the
image before changing the exact-ID mapping. Never match a photo just by a
similar business name. Do not replace an owner's existing primary photo.
Validate asset attribution and bytes with `node --test web/tools/place-media.test.mjs`.

## Attribution and license

Source: [Geofabrik Georgia extract](https://download.geofabrik.de/europe/georgia.html),
© [OpenStreetMap contributors](https://www.openstreetmap.org/copyright),
[ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).

The published `place-data/*.json` files are the attributed extracted database and
are offered under ODbL. The application code is separate. Keep visible source and
license links in the map and imported place pages. The complete national PBF and
intermediate snapshots remain ignored local build inputs, not website payloads.
