import { readCoordinates } from './coordinates.js';
import { canonicalCategory } from './placeTaxonomy.js';
import { isPlaceLocationHeld } from './reviewedPlaceStatus.js';

export function searchableCatalogItem(item) {
  return !!item && item.status === 'published' && item.isDemo === false && item.available !== false
    && ['dish', 'product', 'service', 'bundle'].includes(item.type) && !!item.businessId && !!item.title;
}

export function matchesCatalogFilters(item, filters = {}) {
  if (filters.diet && !item.dietaryTags?.includes(filters.diet)) return false;
  const preparationMax = Number(filters.preparationMax);
  if (preparationMax > 0 && (!Number.isFinite(item.preparationMinutes) || item.preparationMinutes > preparationMax)) return false;
  return true;
}

export function publicCatalogBusiness(business) {
  return !!business && !['deleted', 'suspended', 'inactive', 'draft', 'archived'].includes(business.status)
    && business.deleted !== true && business.raw?.deleted !== true && business.raw?.isDemo !== true;
}

/** A specific-branch item must never acquire another branch or headquarters. */
export function catalogLocations(item, branches) {
  if (!searchableCatalogItem(item)) return [];
  const publicBranches = branches.filter((branch) => branch.businessId === item.businessId
    && branch.status === 'published' && branch.isDemo === false);
  if (item.allBranches) return publicBranches.length ? publicBranches : [null];
  const ids = new Set(item.branchIds || []);
  return publicBranches.filter((branch) => ids.has(branch.id));
}

export function catalogResult(item, business, branch, place) {
  if (!searchableCatalogItem(item) || !publicCatalogBusiness(business) || business.id !== item.businessId) return null;
  if (branch && (branch.businessId !== item.businessId || branch.status !== 'published' || branch.isDemo !== false)) return null;
  if (!item.allBranches && (!branch || !item.branchIds?.includes(branch.id))) return null;
  const linkedId = branch ? branch.placeId : business.raw?.placeId;
  const linkedPlace = linkedId && place?.id === linkedId ? place : null;
  if (isPlaceLocationHeld(linkedPlace) || isPlaceLocationHeld(linkedId)) return null;
  // Coordinates from headquarters cannot stand in for an unlocated branch.
  const coordinates = readCoordinates(branch || business.raw || business) || readCoordinates(linkedPlace);
  const params = new URLSearchParams({ tab: item.type === 'dish' ? 'menu' : 'catalog', item: item.id });
  if (branch) params.set('branch', branch.id);
  const href = `/business/${encodeURIComponent(business.id)}?${params}`;
  const name = branch?.title || linkedPlace?.name || business.name;
  return {
    ...linkedPlace,
    id: linkedPlace?.id || (branch ? `branch_${branch.id}` : `business_${business.id}`),
    resultId: `${item.id}:${branch?.id || business.id}`,
    kind: 'place', name, title: item.title, itemTitle: item.title, matchedItemTitle: item.title,
    matchedItemType: item.type, itemId: item.id, businessId: business.id, businessName: business.name,
    branchId: branch?.id || '', branchName: branch?.title || '',
    category: canonicalCategory(linkedPlace?.category || business.category || item.categoryId),
    address: branch ? (branch.address || linkedPlace?.address || '') : (linkedPlace?.address || business.address || ''),
    city: branch ? (branch.city || linkedPlace?.city || '') : (linkedPlace?.city || business.city || ''),
    lat: coordinates?.lat ?? null, lng: coordinates?.lng ?? null,
    image: linkedPlace?.image || business.logo || '', itemImage: item.imageUrl || '',
    priceMinor: item.priceMinor ?? null, currency: item.currency || 'GEL',
    preparationMinutes: item.preparationMinutes ?? null, dietaryTags: item.dietaryTags || [],
    canonicalBusinessHref: href, pageHref: href,
    searchMatch: item.searchMatch, searchScore: item.searchScore,
    facets: { ...linkedPlace?.facets, diets: item.dietaryTags || [] },
    raw: { ...linkedPlace?.raw, businessId: business.id, branchId: branch?.id || '' },
  };
}

export function addressHref(address) {
  const coordinates = readCoordinates(address);
  if (!coordinates) return '/map';
  return `/map?${new URLSearchParams({ lat: String(coordinates.lat), lng: String(coordinates.lng), label: address.name || address.address || '' })}`;
}
