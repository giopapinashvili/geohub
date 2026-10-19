/** Offline extractor; see IMPORTING-PLACES.md. Dependency stays in a private tool folder. */
import { createReadStream, createWriteStream } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { isRelevantOsmElement } from './place-extraction-policy.mjs';
const require = createRequire(import.meta.url);
const option=name=>{const index=process.argv.indexOf(name);return index<0 ? '' : process.argv[index+1];};
const input=resolve(option('--input') || '.codex/artifacts/place-import/georgia.osm.pbf');
const output=resolve(option('--output') || '.codex/artifacts/place-import/osm-tbilisi.json');
const parserPath=resolve(option('--parser-path') || '.codex/artifacts/place-import/runtime/node_modules/osm-pbf-parser');
const parse=require(parserPath);
let sourceUrl=option('--source-url') || 'https://download.geofabrik.de/europe/georgia-latest.osm.pbf';
let sourceDate=option('--source-date');
if (process.argv.includes('--download')) {
  const response=await fetch(sourceUrl,{signal:AbortSignal.timeout(180000)});
  if (!response.ok) throw new Error(`Source download failed: ${response.status}`);
  sourceUrl=response.url;
  sourceDate=new Date(response.headers.get('last-modified')).toISOString().slice(0,10);
  await mkdir(dirname(input),{recursive:true});
  await pipeline(response.body,createWriteStream(input));
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(sourceDate || '')) throw new Error('Pass --source-date YYYY-MM-DD for a local PBF, or --download to preserve source metadata');
const bbox = [44.60, 41.58, 45.05, 41.91];
const nodes = new Map(), ways = new Map(), elements = [], relations = [];
let seenNodes = 0, seenWays = 0;
const inside = (lat, lon) => lat >= bbox[1] && lat <= bbox[3] && lon >= bbox[0] && lon <= bbox[2];
const relevant = isRelevantOsmElement;
const boundsOf = (points) => [Math.min(...points.map(p=>p[1])),Math.min(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0]))];
const clean = (item) => ({type:item.type,id:item.id,tags:item.tags, ...(item.info?.timestamp ? {timestamp:new Date(item.info.timestamp).toISOString()} : {})});
await pipeline(createReadStream(input), parse(), new Writable({ objectMode:true, write(items,enc,next) {
  try {
    for (const item of items) {
      if (item.type === 'node') {
        seenNodes++;
        if (!inside(item.lat,item.lon)) continue;
        nodes.set(item.id,[item.lat,item.lon]);
        if (relevant(item.tags)) elements.push({...clean(item),lat:item.lat,lon:item.lon});
      } else if (item.type === 'way') {
        seenWays++;
        const points = item.refs.map(id=>nodes.get(id)).filter(Boolean);
        if (!points.length) continue;
        const bounds = boundsOf(points);
        const center = {lat:(bounds[1]+bounds[3])/2,lon:(bounds[0]+bounds[2])/2};
        ways.set(item.id,{bounds,center});
        if (relevant(item.tags)) elements.push({...clean(item),center,bounds,...(item.tags.shop==='mall' ? {geometry:points.map(([lat,lon])=>({lat,lon}))} : {})});
      } else if (item.type === 'relation' && relevant(item.tags)) relations.push(item);
    }
    next();
  } catch(error) { next(error); }
} }));
for (const item of relations) {
  const boxes = item.members.filter(m=>m.type==='way').map(m=>ways.get(m.id)?.bounds).filter(Boolean);
  const points = item.members.filter(m=>m.type==='node').map(m=>nodes.get(m.id)).filter(Boolean);
  if (!boxes.length && !points.length) continue;
  const all = [...points,...boxes.flatMap(b=>[[b[1],b[0]],[b[3],b[2]]])];
  const bounds = boundsOf(all);
  elements.push({...clean(item),center:{lat:(bounds[1]+bounds[3])/2,lon:(bounds[0]+bounds[2])/2},bounds});
}
const source={url:sourceUrl,sourceDate,extractedAt:new Date().toISOString(),bbox};
await mkdir(dirname(output),{recursive:true});
await writeFile(output,JSON.stringify({source,elements}));
console.log(JSON.stringify({seenNodes,seenWays,bboxNodes:nodes.size,bboxWays:ways.size,elements:elements.length,bytes:Buffer.byteLength(JSON.stringify(elements))}));
