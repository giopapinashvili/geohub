/** Preserve the publisher's hierarchy; never combine equal child labels across parents. */
export function buildSourceCategoryTree(categories, items) {
  const nodes = new Map();
  for (const category of categories || []) {
    if (typeof category.id !== 'string' || !category.name || nodes.has(category.id)) continue;
    nodes.set(category.id, { id: category.id, name: category.name, parentId: category.parentId || '', children: [], itemIds: new Set() });
  }
  // Treat invalid/cyclic parent references as roots rather than losing their items.
  for (const node of nodes.values()) {
    const seen = new Set([node.id]);
    let parent = nodes.get(node.parentId);
    while (parent && !seen.has(parent.id)) { seen.add(parent.id); parent = nodes.get(parent.parentId); }
    if (!nodes.has(node.parentId) || parent) node.parentId = '';
  }
  for (const node of nodes.values()) if (node.parentId) nodes.get(node.parentId).children.push(node);
  for (const item of items || []) for (const categoryId of item.categoryIds || []) {
    let node = nodes.get(categoryId);
    while (node) { node.itemIds.add(item.id); node = nodes.get(node.parentId); }
  }
  for (const node of nodes.values()) node.children = node.children.filter(child => child.itemIds.size);
  return { nodes, roots: [...nodes.values()].filter(node => !node.parentId && node.itemIds.size) };
}

export function sourceCategoryPath(tree, categoryId) {
  const path = [];
  let node = tree.nodes.get(categoryId);
  while (node) { path.unshift(node); node = tree.nodes.get(node.parentId); }
  return path;
}

export function sourceCatalogFocusItem(catalog, place, params) {
  const itemId = place.itemId || params.get('item') || '';
  let venueId = place.itemId ? '' : params.get('venue') || '';
  if (place.itemId && (place.pageHref || place.canonicalBusinessHref)) {
    try { venueId = new URL(place.pageHref || place.canonicalBusinessHref, 'https://geohub.local').searchParams.get('venue') || ''; }
    catch { /* A missing venue still permits exact item membership below. */ }
  }
  if (venueId && venueId !== catalog.venueId) return '';
  return catalog.items.some(item => item.id === itemId) ? itemId : '';
}
