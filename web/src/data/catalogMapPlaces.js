import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { normBiz, normPlace } from './normalize.js';
import { getImportedPlace, isImportedPlaceId } from './importedPlaces.js';
import { isCatalogLocationId } from '../lib/placeLinks.js';
import { readCoordinates } from '../lib/coordinates.js';
import { canonicalCategory } from '../lib/placeTaxonomy.js';
import { publicCatalogBusiness } from '../lib/catalogDiscovery.js';

/** Resolve shareable virtual map IDs without creating fictitious place records. */
export async function getCatalogMapPlace(id) {
  if (!isCatalogLocationId(id)) return null;
  const branchId = id.startsWith('branch_') ? id.slice(7) : '';
  let branch = null;
  if (branchId) {
    const snapshot = await getDoc(doc(db, 'businessBranches', branchId));
    branch = snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } : null;
    if (!branch || branch.status !== 'published' || branch.isDemo !== false) return null;
  }
  const businessId = branch?.businessId || id.slice(9);
  const snapshot = await getDoc(doc(db, 'businesses', businessId));
  const business = snapshot.exists() ? normBiz(snapshot.id, snapshot.data()) : null;
  if (!publicCatalogBusiness(business)) return null;
  const placeId = branch ? branch.placeId : business.raw?.placeId;
  let linked = null;
  if (placeId && !isCatalogLocationId(placeId)) {
    if (isImportedPlaceId(placeId)) linked = await getImportedPlace(placeId);
    else {
      const placeSnapshot = await getDoc(doc(db, 'places', placeId));
      if (placeSnapshot.exists()) linked = normPlace(placeSnapshot.id, placeSnapshot.data());
    }
  }
  const point = readCoordinates(branch || business.raw || business) || readCoordinates(linked);
  const params = new URLSearchParams({ tab: 'catalog' });
  if (branch) params.set('branch', branch.id);
  return {
    ...linked, id, name: branch?.title || linked?.name || business.name,
    description: linked?.description || business.description || '',
    category: canonicalCategory(linked?.category || business.category),
    address: branch ? branch.address || linked?.address || '' : linked?.address || business.address || '',
    city: branch ? branch.city || linked?.city || '' : linked?.city || business.city || '',
    lat: point?.lat ?? null, lng: point?.lng ?? null,
    image: linked?.image || business.logo || '', photos: linked?.photos || [],
    businessId, branchId, pageHref: `/business/${encodeURIComponent(businessId)}?${params}`,
    raw: { ...linked?.raw, businessId, branchId, catalogLocation: true },
  };
}
