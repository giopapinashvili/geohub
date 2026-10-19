# Public source catalogs

`import-directory-catalogs.mjs` reads only the accepted records in `source-directory-food.mjs`. It resolves each Wolt venue through the current `place-data` record's `raw.officialDirectory` references, preserving canonical branch IDs after source merges. Held venues and unverified physical branches are outside this import.

From the repository root:

```powershell
node web/tools/import-directory-catalogs.mjs --phase=roots --concurrency=2
node web/tools/import-directory-catalogs.mjs --phase=complete --concurrency=2 --max-requests=2000
node --test web/tools/directory-catalogs.test.mjs web/tools/directory-catalog-data.test.mjs
```

The first phase publishes complete restaurant menus and the root metadata of large shop catalogs. The second follows every leaf category and its `next_page_token` until completion, ordering smaller pending catalogs before larger ones. Each invocation defaults to at most 2,000 remote requests (including retries); `--max-requests` changes that bounded budget. Run it again to resume from saved responses without re-fetching completed pages. A failed category retains its successful items but marks that catalog `partial`. An empty successful source response is kept as evidence; it is not filled with fabricated products. `--rebuild-only` rebuilds the public index and search shards from saved catalog files without network access.

The API paths come from Wolt's public web client: `consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/{slug}/assortment`, followed by `/categories/slug/{categorySlug}` with the returned `page_token`. Requests use no account, cookie, credential, cart or ordering operation. A shared interval defaults to 1.5 seconds. HTTP 429 respects the source cooldown and five consecutive rate-limit responses pause the run. Public responses are retained as compressed evidence for seven-day resume in `.codex/artifacts/directory-catalogs/responses/`; `--refresh` explicitly requests fresh data. Catalog price expiry uses the oldest constituent response timestamp, so resuming a catalog never silently renews old prices. Progress and source failures are recorded separately from catalog completeness.

Published outputs are `catalog-data/index.json`, `venues/{venueId}.json`, the search manifest referenced by `index.search.manifest`, prefix search shards and `audit.json`. Search shards and their manifest have content-hash filenames, so each published index retains consistent references across updates. The main index and venue filenames are mutable and must be revalidated or use a bounded cache. The index includes processed/pending source venues. Each catalog retains its source URL, fetch time, root response hash, loading strategy, status, exact branch association and GEL minor-unit prices.

Prices describe the dated delivery-marketplace source, not in-store price or present inventory. Price expiry is seven days after the snapshot. Unknown prices stay `null`. Required options, conditional options, included free selections, weight units, minimum quantities and publisher-disabled products remain explicit. A zero base price with required options is not a free item. No delivery duration is converted to preparation time. Dietary filters use only explicit source `dietary_preferences` whitelist values, labeled `publisher-declared`; names and ingredients never create dietary guarantees. Promotional prose, ratings and customer data are not imported. Product images retain their public source URLs and are product/menu illustrations, not venue photographs.

Search groups identical source titles and points back to exact venue/item pairs. It excludes explicitly unavailable items, stores tokens in a prefix manifest, ranks Georgian/Latin transliterations and bounded typos, and loads full catalogs only for top candidates. Runtime memory/network bounds report truncation; they do not imply complete coverage of every possible match. Unknown dietary/preparation information cannot satisfy those filters.

`audit.json` distinguishes complete, partial, pending, failed and empty catalogs and reports item/photo/price coverage. It measures this accepted public directory, not all businesses or menus in Tbilisi.

A failed refresh retains an existing saved catalog with its original fetch time and price expiry, while the index and audit record the refresh failure. Malformed pagination metadata is treated as partial evidence. The resumability test exercises a one-request budget and a failed refresh in isolated fixture directories without querying the live source.

Option prices are signed adjustments, so a source-provided cheaper choice may subtract money. Unknown option prices remain `null`. Base item prices remain nonnegative; option adjustments are never substituted for a complete item price or an invented total.

For a release snapshot, `--prune-untracked-search` removes only generated search files that are absent from Git's tracked file list and unreferenced by the newly published index/manifest. Tracked historical assets, current references and unrelated files remain. Failure to read the tracked-file list prevents pruning; locked files are reported rather than forced. Run this after other import workers stop writing to the same output directory.
