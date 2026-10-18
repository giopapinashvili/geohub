# Enriching exact place photos

`node web/tools/enrich-place-media.mjs` reads the existing local Tbilisi OSM extract and the current public place lookup. It never creates Firestore records or fetches Google Maps photos.

The pipeline accepts only:

- An exact `wikimedia_commons=File:…` or Commons `image` link attached to that imported OSM object.
- `P18` images from the object's own `wikidata` entity, with a non-deprecated coordinate inside its footprint (100 m boundary allowance) or within 250 m of the mapped point. Person entities are excluded. Brand/network IDs are never used as branch-photo matches.

Category-only Commons links, name-only matches, arbitrary website images, missing files, non-JPEG graphics and unsupported licenses are skipped with reasons. Metadata comes from the official Wikimedia APIs. A Commons file is accepted only with an identified author and explicit CC BY, CC BY-SA or CC0 license URL. Full attribution, original source, capture-date text, upload timestamp, OSM linkage and SHA256 remain in `/place-media/credits.json`. Missing capture dates remain unknown; upload time is never presented as capture time.

Images use Wikimedia-generated derivatives (normally 960 px, with a 500 px fallback for larger files). Newly enriched JPEGs cannot exceed 400 KB. Width and height come from the actual JPEG frame header. The public filenames contain their content hash; existing versioned files are never overwritten with different bytes. This uses ordinary browser HTTP caching, without prefetching every photo.

The importer caches API metadata/downloads below `.codex/artifacts/place-enrichment/cache`, uses small metadata batches and bounded download concurrency, and retries transient Wikimedia errors. Reruns preserve the original manually curated photos. It outputs a compact runtime lookup with shared author/license tables; the larger audit metadata stays in a separate public JSON file. Existing user/merchant cover photos take precedence.

Review `.codex/artifacts/place-enrichment/report.json` for final coverage and skipped reasons. These are source-linked photographs, not a claim that every business in Tbilisi has an available licensed photo or that an older photo shows its current condition. Do not fill remaining gaps with unrelated stock images or brand logos.

The October 2026 batch links 1,165 photographs to 1,144 imported places, using about 168.5 MB of JPEG files and a 214 KB runtime table (60 KB gzip). The table is shared once; photographs load only when displayed. Eight capture dates are unknown. Coverage is strongest for memorials, artworks, historic buildings and landmarks; ordinary commercial branches often have no usable licensed photograph. Source links are not an on-site identity check, and the regional import includes surrounding areas as well as Tbilisi itself.

Validation:

```powershell
node --test web/tools/place-media.test.mjs
```

Primary references:

- https://www.mediawiki.org/wiki/API:Imageinfo
- https://www.wikidata.org/wiki/Wikidata:Data_access
- https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia
- https://www.openstreetmap.org/copyright
