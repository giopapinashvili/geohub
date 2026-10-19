import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run=promisify(execFile),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
test('bounded importer resumes from successful files without re-fetching or hiding previous catalogs',async()=>{
  const artifactRoot=path.join(root,'.codex/artifacts');await fs.mkdir(artifactRoot,{recursive:true});
  const temporary=await fs.mkdtemp(path.join(artifactRoot,'catalog-resume-test-'));
  const output=path.join(temporary,'output'),cache=path.join(temporary,'cache'),preload=path.join(temporary,'mock-public-source.mjs');
  await fs.writeFile(preload,`globalThis.fetch=async(url,options)=>{
    if(new URL(url).hostname!=='consumer-api.wolt.com'||options.headers['App-Language']!=='ka')throw new Error('Unexpected source request');
    return new Response(JSON.stringify({loading_strategy:'full',categories:[{id:'test-category',name:'Test category',slug:'test',item_ids:['test-item'],subcategories:[]}],items:[{id:'test-item',name:'Test dish',price:1200,images:[]}],options:[]}),{status:200,headers:{'content-type':'application/json'}});
  };`);
  const argv=['--import',pathToFileURL(preload).href,'web/tools/import-directory-catalogs.mjs','--phase=roots','--limit=2','--max-requests=1','--concurrency=2',`--output-dir=${output}`,`--cache-dir=${cache}`];
  try{
    await run(process.execPath,argv,{cwd:root,timeout:30000,maxBuffer:1024*1024});
    const first=JSON.parse(await fs.readFile(path.join(output,'index.json'))),audit1=JSON.parse(await fs.readFile(path.join(output,'audit.json')));
    assert.equal(audit1.requestCount,1);assert.equal(audit1.pausedReason,'request-budget');assert.equal(first.coverage.pendingVenues,1);assert.equal(first.totalItems,1);
    const saved=Object.entries(first.venues).find(([,v])=>v.status==='complete');assert.ok(saved);
    const unused=path.join(output,'search/deadbeef-0-000000000000.json'),unrelated=path.join(output,'search/user-note.txt');
    await fs.writeFile(unused,'{}');await fs.writeFile(unrelated,'Keep this unrelated file');
    await run(process.execPath,[...argv,'--prune-untracked-search'],{cwd:root,timeout:30000,maxBuffer:1024*1024});
    const second=JSON.parse(await fs.readFile(path.join(output,'index.json'))),audit2=JSON.parse(await fs.readFile(path.join(output,'audit.json')));
    assert.equal(audit2.requestCount,1);assert.equal(second.coverage.pendingVenues,0);assert.equal(second.totalItems,2);
    assert.equal(second.venues[saved[0]].fetchedAt,saved[1].fetchedAt,'resuming must not renew the old snapshot time');
    assert.equal(second.venues[saved[0]].placeId,saved[1].placeId);
    await assert.rejects(fs.access(unused),{code:'ENOENT'});assert.equal(await fs.readFile(unrelated,'utf8'),'Keep this unrelated file');
    const publishedSearch=JSON.parse(await fs.readFile(path.join(output,second.search.manifest)));
    for(const entry of Object.values(publishedSearch.buckets).flat())await fs.access(path.join(output,entry.file));
    await fs.writeFile(preload,"globalThis.fetch=async()=>new Response('{}',{status:403});");
    await run(process.execPath,[...argv.filter(arg=>!arg.startsWith('--max-requests=')),'--max-requests=2','--refresh'],{cwd:root,timeout:30000,maxBuffer:1024*1024});
    const failedRefresh=JSON.parse(await fs.readFile(path.join(output,'index.json'))),audit3=JSON.parse(await fs.readFile(path.join(output,'audit.json')));
    assert.equal(failedRefresh.totalItems,2,'a failed refresh must keep prior source evidence');
    assert.equal(audit3.requestCount,2);assert.equal(audit3.errors.length,2);assert.ok(audit3.errors.every(error=>error.retainedSnapshot && error.issue==='http-403'));
    for(const[id,venue]of Object.entries(second.venues)){
      assert.equal(failedRefresh.venues[id].fetchedAt,venue.fetchedAt);
      assert.equal(failedRefresh.venues[id].freshnessUntilMs,venue.freshnessUntilMs);
      assert.equal(failedRefresh.venues[id].refreshIssue,'http-403');
    }
    await fs.writeFile(preload,"globalThis.fetch=async()=>new Response(JSON.stringify({loading_strategy:'partial',categories:[],items:[],options:[]}),{status:200});");
    const partialArgv=argv.filter(arg=>!arg.startsWith('--output-dir=')&&!arg.startsWith('--phase=')&&!arg.startsWith('--limit='));
    await run(process.execPath,[...partialArgv,'--refresh','--phase=complete','--limit=1',`--output-dir=${output}-partial`],{cwd:root,timeout:30000,maxBuffer:1024*1024});
    const incomplete=JSON.parse(await fs.readFile(path.join(`${output}-partial`,'index.json'))),partialEntry=Object.values(incomplete.venues)[0];
    assert.equal(partialEntry.status,'partial');assert.equal(incomplete.coverage.statusCounts.complete,undefined);
    const partialCatalog=JSON.parse(await fs.readFile(path.join(`${output}-partial`,partialEntry.file)));
    assert.ok(partialCatalog.sourceIssues.some(issue=>issue.issue==='source-partial-without-category-pages'));
  }finally{
    const resolved=await fs.realpath(temporary),allowed=(await fs.realpath(artifactRoot))+path.sep;
    assert.ok(resolved.startsWith(allowed) && path.basename(resolved).startsWith('catalog-resume-test-'));
    await fs.rm(resolved,{recursive:true,force:true});
  }
});
