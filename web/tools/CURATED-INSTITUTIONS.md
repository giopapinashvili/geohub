# Curated institution enrichment

Reviewed 2026-10-19. This pass adds original Georgian directory summaries for
48 researched groups, attached to 81 exact published place IDs. Each group has
two useful directory posts (96 distinct posts, 162 place/post links), highlights,
an official website when verified, review date and source links. Institutions
with multiple mapped buildings share institution facts, not automatically photos.
Alta's nine mapped locations explicitly share brand-level information.

## Integration

- `src/lib/curatedPlaceEditorial.js`: `getPlaceEditorial(placeOrId)`.
- `src/lib/curatedInstitutionMedia.generated.js`: `getInstitutionPhotos(placeOrId)`.
- `src/lib/curatedPlaceMediaExclusions.js`: `isExcludedCuratedPhoto(id, title)`
  suppresses the former GTU representative-pin P18 image after that pin moved to
  the official administration building. Keep this filter when regenerating the
  older automatic Commons registry.
- Prefer an owner's existing description. Directory posts are never attributed
  to the institution as if it posted them. Source links must remain visible.
- Photos have captions, authors, licenses, source links and capture dates. Full
  provenance/hash records are `public/place-media/institutions-credits.json`.

## Scope

Universities: TSU, GTU, Ilia, Caucasus, Free/Agricultural campus, TSMU, UG,
Sulkhan-Saba, SEU, GIPA, BTU, Conservatoire, Art Academy, GAU, DTMU, IBSU,
Grigol Robakidze, European, Aviation, British, Ken Walker, East-West, Geomedi,
Caucasus International and Sukhumi. ITSTEP is also covered.

Libraries: National Library central buildings, Humboldt German Library,
National Science Library, TSU library, municipal Mediathekas and the four
newly mapped Italian, Ukrainian, Wine/Vine and Agricultural collections.

Other institutions: East Point, Galleria, City Mall, Tbilisi Mall, Karvasla,
Fabrika, Cafe Stamba, New Hospitals, Chachava, Gagua, Georgian National Museum,
Georgian Museum of Fine Arts and Alta.

## Photograph review

25 unique local JPEGs (5,565,490 bytes) create 28 photo links on 18 exact sites.
All have verified CC BY, CC BY-SA or public-domain metadata; no stock images or
Google reviews/photos are copied. The downloader records the original and
thumbnail URLs, SHA-256, dimensions, author, license, capture date, retrieval
time, description, categories and the reason for each exact place match.

Buildings covered include TSU I and VI, GTU I and administration, Ilia A,
Free/Agricultural campus, Art Academy, Conservatoire, Theatre/Film University,
Caucasus campus, National Library I and III, East Point and Galleria.

Important limitations retained in captions/metadata:

- Karvasla appears only in a distant 2017 city panorama. A suitable close
  exterior photo was not found; this is not presented as a detailed storefront.
- Caucasus University is visible in a city panorama; caption says so.
- Art Academy includes an 1884 archive photo after its contemporary exterior
  and interior. Capture dates are not silently replaced with today's date.
- GTU's latest administration photo has an upload date but no confirmed capture
  date. Its `dateTaken` is intentionally blank.
- Ilia's A-building photo is attached only to that exact building, not the
  university representative point on Choloqashvili Avenue.
- National Library's 2024 entrance/interior/conference photos belong to III,
  not I. Their building is verified by facade identity and the official room
  directory. New indoor collections do not receive arbitrary room photographs.
- An apparent CIU image was a logo and was excluded from photographic galleries.
- Wikidata's National Science Library P18 depicts the Academy of Sciences at
  another address; it was rejected. The former Kostava technical-library
  building retains its imported historical status, with no active-library
  editorial assigned.

Most other researched institutions still need a place-specific reusable photo.
This pass does not claim photographic coverage of all Tbilisi places or a complete
current tenant directory for malls. Karvasla has exact OSM-derived context, not a
verified current tenant list. No hours, prices, reviews, menus or admissions
guarantees were invented to fill gaps.

## Reproduce and verify

From the repository root:

```sh
node web/tools/enrich-institution-media.mjs
node --test web/tools/curated-editorial.test.mjs
```

The importer uses an allowlisted exact-file review table and caches source
metadata/bytes under `.codex/artifacts/institution-enrichment`. The tests check
published ID existence, post provenance, local image hashes/dimensions/licenses,
unknown-ID isolation and the campus/building mismatches found during review.
No network requests occur during tests.
