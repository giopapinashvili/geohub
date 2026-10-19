// Official online catalogs with separately mapped physical branches.
export const OFFICIAL_MERCHANTS = [
  {
    "id": "zoommer",
    "name": "ზუმერი",
    "website": "https://zoommer.ge/",
    "phone": "*7007",
    "description": "ზუმერი ტექნიკის მაღაზიათა ქსელია. მის ონლაინ კატალოგში წარმოდგენილია მობილური ტელეფონები, კომპიუტერები, აუდიო მოწყობილობები, სათამაშო კონსოლები და აქსესუარები.",
    "sources": [
      {
        "label": "ზუმერის ოფიციალური ონლაინ მაღაზია",
        "url": "https://zoommer.ge/"
      }
    ],
    "branches": [
      {
        "id": "osm_node_11758046845",
        "name": "ზუმერი",
        "lat": 41.6908797,
        "lng": 44.8960536,
        "category": "electronics"
      },
      {
        "id": "osm_relation_17841751",
        "name": "ზუმერი",
        "lat": 41.7237753,
        "lng": 44.73696255,
        "category": "electronics"
      },
      {
        "id": "osm_node_9868162017",
        "name": "ზუმერი",
        "lat": 41.721780300000006,
        "lng": 44.773929900000006,
        "category": "electronics"
      },
      {
        "id": "osm_node_11795456897",
        "name": "ზუმერი",
        "lat": 41.81745,
        "lng": 44.7726374,
        "category": "electronics"
      },
      {
        "id": "osm_way_1280895097",
        "name": "ზუმერი",
        "lat": 41.721690550000005,
        "lng": 44.799744200000006,
        "category": "electronics"
      },
      {
        "id": "osm_way_215028328",
        "name": "ზუმერი",
        "address": "აკაკი წერეთლის გამზირი 1გ",
        "lat": 41.72374755,
        "lng": 44.7921308,
        "category": "electronics"
      },
      {
        "id": "osm_node_11222872471",
        "name": "ზუმერი",
        "lat": 41.7920682,
        "lng": 44.8158097,
        "category": "electronics"
      }
    ]
  }
];
export const officialMerchant = id => OFFICIAL_MERCHANTS.find(merchant => merchant.id === id) || null;
export const officialMerchantForPlace = place => OFFICIAL_MERCHANTS.find(merchant => merchant.branches.some(branch => branch.id === place?.id || branch.id === place?.raw?.linkedOsmId)) || null;
