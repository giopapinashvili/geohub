import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { SOURCE_DIRECTORY_FOOD } from './source-directory-food.mjs';

const run=promisify(execFile),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
test('failed category refresh keeps previous provenance and resumes without mixing cached assortments',async()=>{
  const artifactRoot=path.join(root,'.codex/artifacts');
  await fs.mkdir(artifactRoot,{recursive:true});
  const temporary=await fs.mkdtemp(path.join(artifactRoot,'catalog-refresh-test-'));
  const output=path.join(temporary,'output'),cache=path.join(temporary,'cache'),preload=path.join(temporary,'mock.mjs'),requests=path.join(temporary,'requests.jsonl');
  const read=async file=>JSON.parse(await fs.readFile(path.join(output,file),'utf8'));
  await fs.writeFile(preload,`
    import fs from 'node:fs/promises';
    const item=id=>({id,name:id,price:1200,images:[]});
    globalThis.fetch=async url=>{
      await fs.appendFile(process.env.CATALOG_TEST_REQUESTS,JSON.stringify({mode:process.env.CATALOG_TEST_MODE,url})+'\\n');
      if(process.env.CATALOG_TEST_MODE==='old')return new Response(JSON.stringify({assortment_id:'old-assortment',loading_strategy:'full',categories:[{id:'old',name:'Old',slug:'old',item_ids:['old-a','old-b']}],items:[item('old-a'),item('old-b')],options:[]}));
      const id=new URL(url).pathname.split('/').at(-1);
      if(id==='assortment')return new Response(JSON.stringify({assortment_id:'new-assortment',loading_strategy:'partial',categories:['a','b'].map(id=>({id,name:id,slug:id,item_ids:[]})),items:[],options:[]}));
      if(id==='b' && process.env.CATALOG_TEST_MODE==='failing')return new Response('{}',{status:403});
      return new Response(JSON.stringify({category:{id,name:id},categories:[{id,item_ids:['new-'+id]}],items:[item('new-'+id)],options:[],metadata:{next_page_token:null,page:1}}));
    };
  `);
  const argv=['--import',pathToFileURL(preload).href,'web/tools/import-directory-catalogs.mjs','--phase=complete','--limit=1','--max-requests=10','--concurrency=1',`--output-dir=${output}`,`--cache-dir=${cache}`];
  async function invoke(mode,extra=[]){return run(process.execPath,[...argv,...extra],{cwd:root,timeout:30000,maxBuffer:1024*1024,env:{...process.env,CATALOG_TEST_MODE:mode,CATALOG_TEST_REQUESTS:requests}});}
  try{
    await invoke('old');
    const first=await read('index.json'),venueId=Object.keys(first.venues)[0],entry=first.venues[venueId],prior=await read(entry.file);
    const slug=new URL(SOURCE_DIRECTORY_FOOD[0].sourceUrl).pathname.split('/').at(-1);
    const api='https://consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/'+encodeURIComponent(slug)+'/assortment';
    // A still-fresh legacy URL cache belongs to a different assortment and must not leak in.
    const poisoned={fetchedAt:new Date(Date.now()+60000).toISOString(),data:{category:{id:'a'},categories:[{id:'a',item_ids:['stale-old-a']}],items:[{id:'stale-old-a',name:'stale-old-a',price:999}],options:[],metadata:{next_page_token:null}}};
    const legacy=createHash('sha256').update(api+'/categories/slug/a').digest('hex')+'.json.gz';
    await fs.writeFile(path.join(cache,'responses',legacy),gzipSync(JSON.stringify(poisoned)));
    await invoke('failing',['--refresh']);
    const failed=await read('index.json'),retained=await read(entry.file);
    assert.deepEqual(retained,prior,'incomplete refresh preserves the entire dated source evidence');
    assert.equal(failed.venues[venueId].refreshPending,true);
    assert.equal(failed.venues[venueId].refreshIssue,'incomplete-refreshed-assortment');
    assert.equal((await read('audit.json')).requestCount,3);
    await invoke('working');
    const finished=await read('index.json'),catalog=await read(finished.venues[venueId].file),audit=await read('audit.json');
    assert.equal(catalog.status,'complete');assert.equal(catalog.sourceAssortmentId,'new-assortment');
    assert.deepEqual(catalog.items.map(item=>item.id).sort(),['new-a','new-b']);
    assert.equal(finished.venues[venueId].refreshPending,undefined);
    assert.equal(audit.requestCount,1,'the resume fetches only the failed page, using the new scoped root/page cache');
    const calls=(await fs.readFile(requests,'utf8')).trim().split('\n').map(JSON.parse).filter(call=>call.mode==='working');
    assert.equal(calls.length,1);assert.ok(calls[0].url.endsWith('/categories/slug/b'));
  }finally{
    const resolved=await fs.realpath(temporary),allowed=(await fs.realpath(artifactRoot))+path.sep;
    assert.ok(resolved.startsWith(allowed)&&path.basename(resolved).startsWith('catalog-refresh-test-'));
    await fs.rm(resolved,{recursive:true,force:true});
  }
});
