# Tbilisi regional vector refresh

`web/public/map-tiles/tbilisi-20261018-v1/` is a self-hosted regional extract
of the Protomaps daily OpenStreetMap basemap. Its metadata confirms OSM data as
of **2026-10-18 04:00 UTC**, schema 4.15.2. It covers the rectangle
`44.60,41.58,45.05,41.91`, zooms 11–15, including Tbilisi outskirts. This is not
an administrative city boundary.

The verified source archive is 19,975,438 bytes. Production serves **2,368
individual XYZ vector tiles**, totaling 17,220,089 uncompressed bytes; the
largest tile is 136,326 bytes. Only the buildings and roads layers used by the
overlay are retained, with their original layer bytes unchanged. Ten empty
tiles represent empty archive cells. Visible tiles load on demand; the browser
never downloads the whole archive and does not require HTTP Range support.

This matters because Cloudflare Pages documents 200 responses for Range
requests. A live range check against an existing Pages static asset also
returned 200 without Content-Range. The PMTiles decoder is now used only by
the offline export tool, not the browser. Its BSD-3 license and bundled
fflate MIT license are in `web/src/vendor/LICENSES-pmtiles.txt`. No npm
dependencies were installed or changed.

## What is refreshed

- Building footprints, source-supplied heights, building address numbers, road
  names. Buildings without source height remain 2D; dimensions are not invented.
- The existing CARTO geometry remains for roads, water, land cover, worldwide
  context and areas outside this regional extract.
- Old building/address/road-label features inside the region are suppressed
  after the regional data becomes ready. If this source fails, the old layers
  are restored automatically.

This is a dated snapshot, not live OSM updates or proof of complete real-world
coverage. Heights can be derived from levels or quantized by the tile provider.
Do not compare raw CARTO and Protomaps feature counts: both merge multiple
footprints at lower zooms, so one feature can contain thousands of rings.

## Repeatable update

Use the official `pmtiles` CLI from
<https://github.com/protomaps/go-pmtiles/releases>. No long-running tile server
is needed in production. Select a current daily build at
<https://maps.protomaps.com/builds/> and inspect its actual metadata first:

```powershell
pmtiles show https://build.protomaps.com/YYYYMMDD.pmtiles --metadata
pmtiles extract https://build.protomaps.com/YYYYMMDD.pmtiles tbilisi-YYYYMMDD.pmtiles --bbox=44.60,41.58,45.05,41.91 --minzoom=11 --maxzoom=15 --download-threads=4
pmtiles verify tbilisi-YYYYMMDD.pmtiles
Get-FileHash tbilisi-YYYYMMDD.pmtiles -Algorithm SHA256
```

Keep the archive outside public assets. Update the source manifest with its
verified timestamp, actual size and SHA256, then export to a **new** dated,
versioned directory (the tool refuses to overwrite an existing directory):

```powershell
node web/tools/export-map-tiles.mjs .codex/artifacts/map-refresh/tbilisi-20261018.pmtiles web/public/map-tiles/tbilisi-20261018-v1
```

The exporter currently reads `web/public/map-data/tbilisi-20261018.json` as
its verification manifest; update that reference when preparing another
snapshot. Update `TBILISI_MAP_DATA` in `tbilisiBasemap.js` and the public JSON
delivery metadata. Keep source attribution visible. Check schema compatibility,
Georgian labels, 2D/3D, day/night, address numbers, graceful failure and actual
`.mvt` responses on the deployed preview. Old version directories must not be
overwritten; retain them while old application versions can still reference
them. Monitor the Pages file-count limit when adding subsequent snapshots.

## Public cache policy

- `/map-tiles/*`, content-hashed `/place-data/` JSON files and hashed `/assets/*`
  have one-year immutable browser caching. Downloads are demand-driven.
- The mutable place-data manifest uses `no-cache` for ETag revalidation. The
  loader rechecks it after five minutes in a running tab/worker; a new snapshot
  selects different content-hashed URLs. Brand logos have a one-day TTL.
- A 12 MiB serialized-size / 40-entry LRU limits retained parsed place shards
  per tab or worker. Simultaneous requests share one promise; failed requests
  can be retried. The search index loads on first search and its raw JSON is
  not also retained alongside decoded records.
- Persistence uses the browser's ordinary HTTP disk cache, with its own quota
  and eviction. No CacheStorage database, quota prompt, background city download
  or new service-worker fetch handler is introduced. Private/account/Firestore
  responses are outside this policy. HTML and service-worker files revalidate.
- The existing push-only worker stays intact. Browser eviction/private browsing
  can discard cached files; this is not an offline-map guarantee.

Validation: Chromium reused a map tile and public overview with **zero network
asset requests after browser shutdown/restart**; the manifest revalidated with
304. This used a local HTTP server applying the actual `_headers` policy.
Deployment still needs a header/content-type check on the Pages preview.

References:
- <https://docs.protomaps.com/basemaps/downloads>
- <https://docs.protomaps.com/basemaps/layers>
- <https://docs.protomaps.com/pmtiles/maplibre>
- <https://www.openstreetmap.org/copyright>
- <https://docs.carto.com/faqs/carto-basemaps>
- <https://developers.cloudflare.com/pages/configuration/serving-pages/>
- <https://developers.cloudflare.com/pages/configuration/headers/>

Validation: `node --test web/tools/tbilisi-basemap.test.mjs web/tools/public-place-cache.test.mjs`.
