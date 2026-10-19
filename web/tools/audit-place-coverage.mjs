/** Compare the current publication to a saved baseline manifest. Read-only. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {taxonomyCategory} from '../src/lib/placeTaxonomy.js';

const option=name=>{const index=process.argv.indexOf(name);return index<0?'':process.argv[index+1];};
const baseline=option('--baseline');
if (!baseline) throw new Error('Pass --baseline path/to/previous-manifest.json; retain its hashed shards');
const folder=new URL('../public/place-data/',import.meta.url);
const beforeManifest=JSON.parse(await readFile(resolve(baseline),'utf8'));
const afterManifest=JSON.parse(await readFile(new URL('manifest.json',folder),'utf8'));
async function records(manifest) {return (await Promise.all(manifest.shards.map(shard=>readFile(new URL(shard.file,folder),'utf8').then(JSON.parse)))).flat();}
const [before,after]=await Promise.all([records(beforeManifest),records(afterManifest)]);
const beforeIds=new Set(before.map(place=>place.id)),afterIds=new Set(after.map(place=>place.id));
const counts=places=>{
  const groups={},categories={};
  for (const place of places) {
    const group=taxonomyCategory(place.category).group;
    groups[group]=(groups[group]||0)+1;
    const count=categories[place.category] ||= {total:0,named:0,explicitUse:0,buildingOnly:0};
    count.total++;count.named+=Number(Boolean(place.raw.named));
    const tags=place.raw.tags||{};
    const explicit=['amenity','shop','office','healthcare','craft','tourism','leisure','education'].some(key=>tags[key]);
    count.explicitUse+=Number(explicit || place.raw.source==='official-directory');
    count.buildingOnly+=Number(Boolean(tags.building)&&!explicit);
  }
  return {total:places.length,groups,categories};
};
const added=after.filter(place=>!beforeIds.has(place.id));
const removed=before.filter(place=>!afterIds.has(place.id));
const audit={
  checkedAt:'2026-10-19',bbox:afterManifest.source.bbox,sourceDate:afterManifest.source.sourceDate,
  countsAre:'Mapped objects, including campuses, buildings and indoor collections; not unique businesses/institutions or completeness percentages.',
  before:counts(before),after:counts(after),
  added:added.length,removed:removed.map(place=>({id:place.id,name:place.name})),
  addedOfficial:added.filter(place=>place.raw.source==='official-directory'),
  addedMappedBuildings:added.filter(place=>place.raw.recordKind==='mapped-building').length,
  addedNamed:added.filter(place=>place.raw.named).map(place=>({id:place.id,name:place.name,category:place.category,recordKind:place.raw.recordKind||'mapped-place',address:place.address||'',lat:place.lat,lng:place.lng,sourceUrl:place.raw.sourceUrl})),
  correctedCampusLocations:after.filter(place=>place.raw.originalSourceCenter).map(place=>({id:place.id,name:place.name,previous:place.raw.originalSourceCenter,lat:place.lat,lng:place.lng,coordinateSourceId:place.raw.coordinateSourceId,evidence:place.raw.coordinateEvidenceUrl})),
};
const output=resolve(option('--output')||'.codex/artifacts/coverage-round2/after.json');
await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(audit,null,2));
console.log(JSON.stringify({before:before.length,after:after.length,added:added.length,removed:removed.length,addedOfficial:audit.addedOfficial.length,addedMappedBuildings:audit.addedMappedBuildings,addedNamed:audit.addedNamed.length,correctedCampusLocations:audit.correctedCampusLocations.length,groups:{before:audit.before.groups,after:audit.after.groups}},null,2));
