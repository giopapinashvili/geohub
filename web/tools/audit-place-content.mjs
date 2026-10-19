/** Evidence inventory, not a completeness percentage or a scan of private merchant data. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { placeBrandId } from '../src/lib/placeBrands.js';
import { taxonomyCategory } from '../src/lib/placeTaxonomy.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const json = async path => JSON.parse(await readFile(resolve(root,path),'utf8'));
const manifest = await json('web/public/place-data/manifest.json');
const catalogs = await json('web/public/catalog-data/index.json');
const services = await json('web/public/catalog-data/services-index.json');
const places = (await Promise.all(manifest.shards.map(shard=>json(`web/public/place-data/${shard.file}`)))).flat();
const categories = {}, total = {};
const commerceGroups = new Set(['food','shopping','services','auto','health','education','finance']);
const init = () => ({objects:0,namedPlaces:0,mappedBuildings:0,photos:0,logos:0,sourceEditorial:0,sourcePosts:0,menuCatalogs:0,productCatalogs:0,serviceCatalogs:0,completeMarketplaceCatalogs:0,partialMarketplaceCatalogs:0,withSourceCatalog:0,sourceCatalogNotYetKnown:0});
Object.assign(total,init());
for (const place of places) {
  const taxonomy = taxonomyCategory(place.category);
  const stats = categories[place.category] ||= {label:taxonomy.label,group:taxonomy.group,...init()};
  const venues = (catalogs.byPlaceId[place.id] || []).map(id=>catalogs.venues[id]).filter(Boolean);
  const withMenu = venues.some(venue=>venue.kind==='menu' && venue.itemCount>0);
  const withProducts = venues.some(venue=>venue.kind==='products' && venue.itemCount>0);
  const withServices = (services.places[place.id]?.count || 0)>0;
  const withCatalog = withMenu || withProducts || withServices;
  const named = !!place.raw?.named && place.raw?.recordKind!=='mapped-building';
  const metrics = {
    objects:1,namedPlaces:Number(named),mappedBuildings:Number(place.raw?.recordKind==='mapped-building'),
    photos:Number(!!place.image || place.photos?.length>0),logos:Number(!!placeBrandId(place)),
    sourceEditorial:Number(!!place.raw?.editorial?.description),sourcePosts:place.raw?.editorial?.posts?.length || 0,
    menuCatalogs:Number(withMenu),productCatalogs:Number(withProducts),serviceCatalogs:Number(withServices),
    completeMarketplaceCatalogs:venues.filter(venue=>venue.status==='complete').length,
    partialMarketplaceCatalogs:venues.filter(venue=>venue.status==='partial').length,
    withSourceCatalog:Number(withCatalog),sourceCatalogNotYetKnown:Number(named && commerceGroups.has(taxonomy.group) && !withCatalog),
  };
  for(const [key,value] of Object.entries(metrics)){stats[key]+=value;total[key]+=value;}
}
const audit = {
  generatedAt:new Date().toISOString(),placeDatasetId:manifest.datasetId,placeSourceDate:manifest.source.sourceDate,
  catalogGeneratedAt:catalogs.generatedAt,serviceGeneratedAt:services.generatedAt,
  scope:'Published public directory only. Native/private merchant catalogs are not inspected. Objects include branches, structures and street furniture; no city completeness percentage is implied.',
  unknownMeaning:'No imported source catalog is known yet; this does not mean the business has no menu, products, services or an owner-entered catalog. Infrastructure is not expected to have commercial catalogs.',
  totals:total,marketplace:catalogs.coverage,marketplaceItems:catalogs.totalItems,officialServiceItems:services.totalItems,
  metro:manifest.metro,categories:Object.fromEntries(Object.entries(categories).sort((a,b)=>b[1].objects-a[1].objects)),
};
const argument=process.argv.indexOf('--output');
const output=resolve(root,argument>=0?process.argv[argument+1]:'web/tools/place-content-audit.json');
await writeFile(output,JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify({output,totals:audit.totals,marketplace:audit.marketplace,marketplaceItems:audit.marketplaceItems,officialServiceItems:audit.officialServiceItems,metro:audit.metro},null,2));
