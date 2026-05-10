/* ================================================================
   GeoHub — Mock Data (Georgian businesses, places, destinations)
   ================================================================ */

const BUSINESSES = [];

const DESTINATIONS = [
  {
    id: 1, name: 'Tbilisi', slug: 'tbilisi',
    description: 'Ancient capital with sulfur baths & vibrant old town',
    count: 342, region: 'Capital',
    featured: true,
    image: 'https://picsum.photos/seed/tbilisi-city/1200/800',
    highlights: ['Old Town', 'Narikala Fortress', 'Wine bars', 'Museums']
  },
  {
    id: 2, name: 'Kazbegi', slug: 'kazbegi',
    description: 'Iconic mountain village beneath Mt. Kazbek',
    count: 87, region: 'Mtskheta-Mtianeti',
    featured: false,
    image: 'https://picsum.photos/seed/kazbegi-dest/800/600',
    highlights: ['Gergeti Trinity Church', 'Hiking', 'Mountain views', 'Adventure']
  },
  {
    id: 3, name: 'Batumi', slug: 'batumi',
    description: 'Georgian riviera on the Black Sea coast',
    count: 198, region: 'Adjara',
    featured: false,
    image: 'https://picsum.photos/seed/batumi-dest/800/600',
    highlights: ['Black Sea Beach', 'Botanical Garden', 'Nightlife', 'Architecture']
  },
  {
    id: 4, name: 'Sighnaghi', slug: 'sighnaghi',
    description: 'Romantic walled city in the wine region',
    count: 64, region: 'Kakheti',
    featured: false,
    image: 'https://picsum.photos/seed/sighnaghi-dest/800/600',
    highlights: ['Wine tasting', 'Panoramic views', 'Old walls', 'Crafts']
  },
  {
    id: 5, name: 'Gudauri', slug: 'gudauri',
    description: 'Premier ski resort in the Caucasus mountains',
    count: 52, region: 'Mtskheta-Mtianeti',
    featured: false,
    image: 'https://picsum.photos/seed/gudauri-dest/800/600',
    highlights: ['Skiing', 'Snowboard', 'Mountain views', 'Winter sports']
  },
  {
    id: 6, name: 'Mestia', slug: 'mestia',
    description: 'Medieval Svan towers in UNESCO heritage Svaneti',
    count: 43, region: 'Svaneti',
    featured: false,
    image: 'https://picsum.photos/seed/mestia-dest/800/600',
    highlights: ['Svan Towers', 'Trekking', 'Culture', 'Glaciers']
  }
];

const CATEGORIES = [
  { id: 'tours', icon: '🗺️', name: 'Tours', count: 148 },
  { id: 'cafes', icon: '☕', name: 'Cafés', count: 214 },
  { id: 'restaurants', icon: '🍽️', name: 'Restaurants', count: 389 },
  { id: 'hotels', icon: '🏨', name: 'Hotels', count: 176 },
  { id: 'guesthouses', icon: '🏡', name: 'Guesthouses', count: 93 },
  { id: 'hiking', icon: '🥾', name: 'Hiking', count: 67 },
  { id: 'camping', icon: '⛺', name: 'Camping', count: 38 },
  { id: 'attractions', icon: '🏛️', name: 'Attractions', count: 124 },
  { id: 'guides', icon: '🧭', name: 'Guides', count: 55 },
  { id: '4x4', icon: '🚙', name: '4×4 Routes', count: 29 },
  { id: 'beauty', icon: '💆', name: 'Beauty', count: 84 },
  { id: 'dental', icon: '🦷', name: 'Dental', count: 47 },
];

const REVIEWS = [];

const STATS = {
  businesses: 1842,
  cities: 47,
  users: 28600,
  reviews: 14300
};
