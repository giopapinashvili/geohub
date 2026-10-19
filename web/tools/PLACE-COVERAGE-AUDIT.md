# Place coverage review — 19 October 2026

The 17 October 2026 Geofabrik source was re-extracted with broader selectors.
The source rectangle is `[44.60, 41.58, 45.05, 41.91]`; it includes parts of the
surrounding area, including Mtskheta. These numbers describe mapped objects,
not unique businesses, institutions, or a percentage of all Tbilisi places.

## Measured changes

| Measure | Previous | Current |
| --- | ---: | ---: |
| All mapped records | 43,577 | 45,637 |
| Education group | 1,064 | 1,117 |
| Libraries and indoor library collections | 40 | 44 |
| University institutions, campuses and buildings | 101 | 106 |
| Schools and school buildings | 502 | 502 |
| Colleges and college buildings | 22 | 29 |
| Shopping group, including retail structures | 8,108 | 9,093 |
| Services group, including office/commercial structures | 2,359 | 3,169 |
| Health group | 1,686 | 1,686 |
| Address search entries | 43,221 | 43,221 |
| Named street search entries | 4,868 | 4,868 |

All 43,577 previous IDs remain available. The 2,060 additions comprise 2,010
mapped structures, 40 educational areas, one explicitly mapped art school, and
nine individually reviewed official-directory records. There are 72 named new
records. This is not 2,060 newly verified operating businesses. No benches or
other already-imported street furniture were added to increase this delta.

Building-only records retain `raw.recordKind: mapped-building`. Generic office,
retail, commercial and hotel structures have their own categories. A building
name containing “university” does not by itself classify it as a university.
The current university category includes 55 building-only objects and 51 objects
with explicit mapped/official institutional use; these can still refer to the
same institution. The four new libraries are National Library indoor collections,
not four new independent library institutions.

## Official additions

Definitions and evidence are in `verified-place-supplement.mjs`. Every record has
its official source URL, coordinate evidence, accuracy and `sourceCertainty`.

| Place | Address evidence | Coordinate evidence |
| --- | --- | --- |
| British University | [Official site](https://www.britishuni.edu.ge/en/privacy-policy), 92 Vepkhistkaosani | Matching OSM address building |
| Ken Walker International University | [Contact page](https://kwiu.edu.ge/en/contact), 4 Gudamakari | Publisher's embedded map center |
| Alterbridge University | [Contact page](https://alterbridge.edu.ge/contact/), 67 Tskneti Highway | Matching OSM address building; publisher map center differs by about 170 m |
| East West University, Gorgasali campus | [Contact page](https://eastwest.edu.ge/კონტაქტი/), 9 Gorgasali | Publisher's campus map center |
| Geomedi University | [Official site](https://geomedi.edu.ge/?lang=en), 4 King Solomon II | Publisher's embedded map center |
| Italian, Ukrainian, Wine and Vine collections | [National Library directory](https://www.nplg.gov.ge/geo/Location), III building, 7 Gudiashvili | Shared building location, not individual rooms |
| Agricultural Library | [National Library directory](https://www.nplg.gov.ge/geo/Location), VI building, 63 Tsintsadze | Shared building center |

All these coordinates are labelled approximate. An embedded map center or
address-matched building is not represented as a surveyed entrance. No rating,
price, menu, review, or operating hours was invented for the additions.

## Incorrect campus centers

Six multi-campus OSM relations previously used the center of all their members'
bounding rectangle. This could position a university pin between campuses.
They now use a reviewed building/site at the official contact address:

| Stable ID | Institution | Coordinate anchor |
| --- | --- | --- |
| `osm_relation_16510616` | TSU | `osm_relation_900361`, Building I |
| `osm_relation_16507696` | Georgian Technical University | `osm_relation_20406737`, administrative building |
| `osm_relation_16510614` | International Black Sea University | `osm_way_61965437`, administrative building |
| `osm_relation_16510613` | Grigol Robakidze University | `osm_way_992390308`, Enukidze campus |
| `osm_relation_18087876` | Ilia State University | `osm_way_80624407`, Choloqashvili campus |
| `osm_relation_17405902` | Tbilisi State Academy of Arts | `osm_way_1221837871`, Griboedov site |

The original centers remain in `raw.originalSourceCenter`. Official contact
evidence and the OSM coordinate source are retained separately. Search rows,
lookup records and spatial shards all use the corrected coordinates.

## Existing GeoHub pages

`nativePlaceSourceLinks.js` contains 21 manually reviewed links to 20 distinct
OSM sources. Two existing Parliament pages share one source. The generated
`nativePlaceSourceRecords.generated.js` is a small synchronous evidence subset
for display enrichment; it does not write to Firestore. Existing native IDs,
ownership and activity must be preserved by the consumer. Name-only matching
was rejected: Fabrika tenants can share a Fabrika operator alias, and transit
stops can have the same name as a nearby landmark.

## Source limitations and unresolved work

- A source snapshot is not a complete city directory. There is no defensible
  “100% of Tbilisi” denominator. A directory scrape or record total cannot prove
  every shop, tenant, office, entrance and institution has been captured.
- The map list previously stopped at 80 results. This was a display limit,
  not the source's total; it must not be presented as the total city coverage.
- Libraries were already imported (40 records); the review adds four documented
  indoor collections. Municipal directories and the national education register
  are useful cross-checks but may list institutions rather than every branch.
- International University of Tbilisi lists 35 Ksani Street, and East West
  University lists an additional Uznadze campus. Reliable point/address geometry
  was not established in this pass; neither was assigned a guessed street-center
  coordinate. They remain candidates for a verified follow-up import.
- The mapped Mediathek `osm_way_1330515311` explicitly reports reconstruction
  and disuse. Its location remains available with an inactive-source flag;
  historical opening hours are not exposed as current hours. Former School 128
  is an educational site, not an asserted active school. The former Mikeladze
  library and residential developments with “University” names were not promoted
  to active libraries/universities.
- The existing health count is unchanged. This pass did not establish that every
  clinic, pharmacy or doctor's office in the city is present. A source-backed
  institution/branch inventory is required before claiming completeness.
- Public building/land-use geometry does not prove current tenants or operation.
  Mall lists derived from mapped tenant points remain partial. Historical media
  and brand logos must not be presented as current site-specific photographs.

## Reproduce the comparison

Retain the baseline manifest and its content-hashed shards, then run:

```powershell
node web/tools/audit-place-coverage.mjs --baseline path/to/baseline-manifest.json
node web/tools/generate-native-place-source-records.mjs
node --test web/tools/import-tbilisi.test.mjs web/tools/coordinates.test.mjs
```

The JSON audit lists category/group totals, all named additions, source facts,
removed IDs and coordinate corrections. The build manifest additionally records
OSM versus official additions, source URLs and mapped-building counts.
