/** Catalog search rows lead to their merchant, including their specific branch. */
export function placePageHref(place) {
  const href = place?.pageHref || place?.canonicalBusinessHref;
  return typeof href === 'string' && href.startsWith('/business/')
    ? href : `/place/${encodeURIComponent(place?.id || '')}`;
}

export const isCatalogLocationId = id => /^(branch|business)_[A-Za-z0-9_-]{1,150}$/.test(String(id || ''));
