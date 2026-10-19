# Public catalog asset retention

The first catalog release contains 13,720 files against the deployment's 20,000-file limit. Its 965 search files are **all current references**, not disposable history. Repeated catalog releases need bounded retention; the importer must not delete older release assets automatically.

## Standalone search-only tool

From the repository root, after the importer and any deployment have stopped:

```powershell
node web/tools/retain-catalog-search.mjs
node --test web/tools/catalog-search-retention.test.mjs
```

The first command is a **dry run**. It saves retained and candidate file hashes, counts, generation references and sizes to `.codex/artifacts/catalog-retention/latest-plan.json`. Review that report. The separate command below explicitly applies a freshly validated plan:

```powershell
node web/tools/retain-catalog-search.mjs --apply
```

The tool protects the current `index.search.manifest` and **two distinct previous generations** found with Git log/show for `web/public/catalog-data/index.json`. HEAD counts as previous when its manifest differs from the working index; commits with the same manifest do not consume another slot. All available generations are retained when the catalog has fewer than three generations. Git commits are conservatively treated as potentially published; publication must commit its index, search manifest and buckets together. Git alone cannot prove a deployment occurred. An uncommitted published generation cannot be protected by this policy: record it in Git before using retention.

Before planning, each protected manifest and shard must exist locally, pass its filename/content hash, and match descriptor SHA-256, byte and row counts. Historical manifests must also agree with their committed content. Missing assets, Git failures, shallow history, unsafe paths, symlinks/junctions, unsupported schemas and corrupt generated-looking files fail closed. Apply rebuilds the plan before its first deletion and stops if it changes. The mutable index is checked again before each unlink; this is an extra guard, **not permission to overlap an importer**.

Only regular files directly under `catalog-data/search` matching approved hashed manifest or bucket names are candidates. Unknown filenames and subdirectories remain. Place shards, service catalogs, venue files, reports, media, logos and all other directories are outside deletion scope. No recursive deletion is used. **Never blanket-drop place shards.** The importer's older `--prune-untracked-search` option is not a substitute for release retention: it protects Git-tracked files indefinitely and cannot identify an uncommitted published generation.

## Old tabs and release checks

Catalog and place mutable indexes have a **five-minute in-memory TTL**; hashed assets are cached until evicted. Current plus two previous generations gives hourly releases a buffer beyond that TTL, but cannot guarantee every old tab after several rapid publications. Catalog search recovery is implemented separately in the data loaders: a hashed asset's 404 or HTML fallback triggers one mutable-parent refresh and logical retry. Keep its recovery tests passing before enabling unattended pruning, and maintain manifest schema compatibility for older application code. Place and service shards are not pruned by this tool, regardless of their loaders' recovery behavior.

Venue catalogs have mutable `venues/<id>.json` names. Retaining old search hashes does not preserve old venue contents; an older result can refer to a removed item and be skipped. Fully historical catalog consistency would require versioned venue files, which this tool does not introduce. The service worker provides no data-cache fallback.

After retention, validate all current references, build the release, and count **all output files**, including compiled application assets. Use 18,000 as a review threshold below 20,000. If protected references approach the host limit, block unattended publication pending reviewed packaging/retention changes; never remove current references to fit. Also check the largest catalog file against the reader's 24 MiB bound.

The initial 19 October read-only inventory found 13,596 public files, 4,531 catalog files and 485 place files; all current dataset references existed. Older place/service hashes were identified only as investigation candidates, not approved deletions. The first standalone dry run retained all 965 search files, proposed zero deletions and did not alter public output. Recheck counts after each import rather than treating this initial inventory as current.

After the 16:35 UTC batch, the stable-output dry run retained 1,826 search files across the working generation and the one available earlier Git generation, with zero deletion candidates. No public-output apply was run.

Fixture tests cover distinct-generation selection, shared buckets, explicit deletion boundaries, first publication, missing/corrupt protected assets, invalid descriptors, unknown files, Git failures/shallow history, junctions, traversal and stale plans. Runtime stale-parent recovery has separate tests in the data-loader changes.
