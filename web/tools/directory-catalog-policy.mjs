import { normalizeSearch } from '../src/lib/discoverySearch.js';
import { normalizeCatalogQuery } from '../src/lib/catalogSearchTerms.js';

export const CATALOG_VERSION = 1;
export const PRICE_CONTEXT = 'delivery-marketplace';
export function safeImageUrl(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && /(^|\.)wolt\.com$/.test(u.hostname) ? u.href : ''; }
  catch { return ''; }
}
export function priceMinor(value) { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 1e10 ? value : null; }
// Source option values are adjustments: choosing a cheaper variant can subtract money.
export function optionPriceMinor(value) { return typeof value === 'number' && Number.isSafeInteger(value) && Math.abs(value) <= 1e10 ? value : null; }
export function retryAfterMilliseconds(value, now = Date.now()) {
  if(typeof value!=='string' || !value.trim())return 0;
  const text=value.trim();
  if(/^\d+(?:\.\d+)?$/.test(text)){const seconds=Number(text);return Number.isFinite(seconds)?seconds*1000:0;}
  const date=Date.parse(text);return Number.isFinite(date)?Math.max(0,date-now):0;
}
export function sameCatalogRoot(prior, next) {
  return Boolean(prior?.sourceResponseSha256 && prior.sourceResponseSha256===next.sourceResponseSha256 && prior.sourceRootFetchedAt===next.sourceRootFetchedAt);
}
export function categoryPageMatches(page, categoryId) {
  return page?.category?.id===categoryId && Array.isArray(page.categories) && (page.categories.some(category=>category.id===categoryId) || page.categories.length===0 && Array.isArray(page.items) && page.items.length===0 && page.metadata?.next_page_token===null);
}
/** A failed refresh must not erase the last complete evidence or mix source generations. */
export function retainPriorCatalogReason(prior, next, phase) {
  if(!Array.isArray(prior?.items) || !prior.items.length || next.status!=='partial')return '';
  if(phase==='roots')return 'root-only-run-preserves-expanded-catalog';
  if(!sameCatalogRoot(prior,next))return 'incomplete-refreshed-assortment';
  const nextIds=new Set(next.items.map(item=>item.id));
  if(prior.items.some(item=>!nextIds.has(item.id)))return 'partial-refresh-would-drop-items';
  return '';
}
export function catalogTokens(value) { return [...new Set(`${normalizeSearch(value)} ${normalizeCatalogQuery(value)}`.split(' ').filter(t => t.length >= 2 && !/^\d/.test(t) && !['da','and','with','the','for','of'].includes(t)))]; }
export function flattenCategories(categories, parentId = '') {
  return (categories || []).flatMap(c => c && typeof c.id === 'string' ? [{ id:c.id, name:String(c.name || ''), slug:String(c.slug || ''), parentId, itemIds:Array.isArray(c.item_ids) ? c.item_ids.filter(x => typeof x === 'string') : [], leaf:!c.subcategories?.length }, ...flattenCategories(c.subcategories, c.id)] : []);
}
export function catalogCategoryMembership(categories) {
  const byId=new Map(categories.map(category=>[category.id,category])),memberships=new Map();
  for(const category of categories)for(const itemId of category.itemIds||[]){
    if(!memberships.has(itemId))memberships.set(itemId,new Set());
    const ids=memberships.get(itemId),visited=new Set();let current=category;
    while(current && !visited.has(current.id)){visited.add(current.id);ids.add(current.id);current=current.parentId?byId.get(current.parentId):null;}
  }
  return new Map([...memberships].map(([id,categories])=>[id,[...categories]]));
}
export function normalizeCatalogItem(item, kind, categoryIds = []) {
  if (!item || typeof item.id !== 'string' || !item.id || typeof item.name !== 'string' || !item.name.trim()) return null;
  const price = priceMinor(item.price);
  const original = priceMinor(item.original_price);
  const optionGroups = (Array.isArray(item.options) ? item.options : []).filter(x => typeof x.option_id === 'string').map(x => ({id:x.option_id, name:String(x.name || ''), min:priceMinor(x.multi_choice_config?.total_range?.min), max:priceMinor(x.multi_choice_config?.total_range?.max),
    freeSelections:priceMinor(x.multi_choice_config?.free_selections),
    prerequisiteValueIds:Array.isArray(x.prerequisite_values)?x.prerequisite_values.filter(v=>typeof v==='string'):[],
  }));
  const perKg=priceMinor(item.sell_by_weight_config?.price_per_kg);
  const declaredDiets=(Array.isArray(item.dietary_preferences)?item.dietary_preferences:[]).filter(value=>['vegan','vegetarian','halal','kosher','gluten_free','lactose_free','dairy_free'].includes(value)).map(value=>value.replaceAll('_','-'));
  return {id:item.id, name:item.name.trim(), kind:kind === 'menu' ? 'dish' : 'product', priceMinor:price, ...(price !== null && original !== null && original > price ? {originalPriceMinor:original} : {}), currency:'GEL', imageUrl:(item.images || []).map(x => safeImageUrl(x?.url)).find(Boolean) || '', categoryIds:[...new Set(categoryIds)], ...(optionGroups.length ? {optionGroups, priceType:optionGroups.some(x => x.min > 0) ? 'base-with-required-options' : 'base'} : {}), ...(typeof item.unit_info === 'string' ? {unitInfo:item.unit_info} : {}),
    ...(perKg!==null ? {sellByWeight:{pricePerKgMinor:perKg,gramsPerStep:Number.isFinite(item.sell_by_weight_config.grams_per_step)?item.sell_by_weight_config.grams_per_step:null}} : {}),
    ...(Number.isSafeInteger(item.min_quantity_per_purchase) && item.min_quantity_per_purchase>1 ? {minQuantity:item.min_quantity_per_purchase} : {}),
    ...(item.disabled_info ? {sourceAvailability:'unavailable'} : {}),
    ...(declaredDiets.length ? {dietaryTags:[...new Set(declaredDiets)],dietarySource:'publisher-declared'} : {}),
  };
}
export function normalizeOptionGroups(options) {
  return (options || []).filter(o => typeof o.id === 'string').map(o => ({id:o.id, name:String(o.name || ''), type:String(o.type || ''), values:(o.values || []).flatMap(v => typeof v.id==='string' && typeof v.name==='string' ? [{id:v.id,name:v.name,priceMinor:optionPriceMinor(v.price),currency:'GEL'}] : [])}));
}
/** Follow public pagination; return partial evidence if a page fails, never call it complete. */
export async function collectCategoryPages(category,fetchPage) {
  const items=new Map(),options=new Map(),categories=new Map(),seen=new Set();
  let token='',pageCount=0,issue='';
  try {
    do {
      const batch=await fetchPage(token);pageCount++;
      if(!Array.isArray(batch?.items)||!Array.isArray(batch.categories)||!batch.metadata)throw new Error('category-format');
      for(const item of batch.items)items.set(item.id,item);
      for(const option of batch.options||[])options.set(option.id,option);
      for(const c of batch.categories){
        if(typeof c.id!=='string' || !Array.isArray(c.item_ids))throw new Error('category-reference-format');
        const entry=categories.get(c.id)||{id:c.id,name:batch.category?.name||category.name,itemIds:[]};
        entry.itemIds=[...new Set([...entry.itemIds,...c.item_ids])];categories.set(c.id,entry);
      }
      const next=batch.metadata.next_page_token;
      if(next!==null && typeof next!=='string')throw new Error('pagination-token-format');
      token=next || '';
      if(token && seen.has(token))throw new Error('repeated-pagination-token');
      seen.add(token);
    }while(token);
  }catch(error){issue=error.message;}
  return {items:[...items.values()],options:[...options.values()],categories:[...categories.values()],pageCount,issue};
}
export function buildCanonicalVenueMap(places) {
  const result = new Map();
  for (const place of places) {
    const references = [{id:place.id,sourceRecordId:place.raw?.sourceRecordId}, ...(place.raw?.officialDirectory || [])];
    for (const ref of references) {
      const venueId = /^directory_wolt_([a-f0-9]{24})$/.exec(ref.id || '')?.[1];
      if (!venueId) continue;
      if (result.has(venueId) && result.get(venueId).id !== place.id) throw new Error(`Ambiguous Wolt canonical identity: ${venueId}`);
      result.set(venueId,place);
    }
  }
  return result;
}
