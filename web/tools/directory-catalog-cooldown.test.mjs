import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run=promisify(execFile),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
test('source cooldown survives a bounded run and checkpoints show active request progress',async()=>{
  const artifactRoot=path.join(root,'.codex/artifacts');await fs.mkdir(artifactRoot,{recursive:true});
  const temporary=await fs.mkdtemp(path.join(artifactRoot,'catalog-cooldown-test-'));
  const output=path.join(temporary,'output'),cache=path.join(temporary,'cache'),preload=path.join(temporary,'mock.mjs'),calls=path.join(temporary,'calls.jsonl');
  const argv=['--import',pathToFileURL(preload).href,'web/tools/import-directory-catalogs.mjs','--phase=roots','--limit=2','--max-requests=10','--concurrency=1',`--output-dir=${output}`,`--cache-dir=${cache}`];
  const options={cwd:root,timeout:30000,maxBuffer:1024*1024,env:{...process.env,CATALOG_TEST_CALLS:calls}};
  try{
    // Advance only this isolated child's clock so real 10-minute retry delays are testable.
    await fs.writeFile(preload,`
      import fs from 'node:fs/promises';
      let now=Date.now();const realTimeout=globalThis.setTimeout;Date.now=()=>now;
      globalThis.setTimeout=(callback,delay,...args)=>{now+=Math.max(0,Number(delay)||0);return realTimeout(callback,0,...args);};
      globalThis.fetch=async()=>{await fs.appendFile(process.env.CATALOG_TEST_CALLS,JSON.stringify({at:Date.now()})+'\\n');return new Response('{}',{status:429,headers:{'retry-after':'600'}});};
    `);
    const {stdout}=await run(process.execPath,argv,options);
    const timestamps=(await fs.readFile(calls,'utf8')).trim().split('\n').map(line=>JSON.parse(line).at);
    assert.equal(timestamps.length,5);
    for(let i=1;i<timestamps.length;i++)assert.ok(timestamps[i]-timestamps[i-1]>=600000,'every retry respects the source delay');
    const cooldown=JSON.parse(await fs.readFile(path.join(cache,'source-cooldown.json'),'utf8'));
    assert.ok(cooldown.retryAfterUntilMs>=timestamps.at(-1)+600000);
    const audit=JSON.parse(await fs.readFile(path.join(output,'audit.json'),'utf8'));assert.equal(audit.pausedReason,'source-rate-limit');
    const progress=stdout.trim().split('\n').map(line=>JSON.parse(line)).filter(row=>row.activeVenues?.length);
    assert.ok(progress.some(row=>row.requests>0 && row.activeVenues[0].name && row.activeVenues[0].stage==='root'));
    // A fresh process must read the persisted delay before its first request.
    const retryAfterUntilMs=Date.now()+1800;await fs.writeFile(path.join(cache,'source-cooldown.json'),JSON.stringify({source:'consumer-api.wolt.com',retryAfterUntilMs}));
    await fs.writeFile(calls,'');
    await fs.writeFile(preload,`import fs from 'node:fs/promises';globalThis.fetch=async()=>{await fs.appendFile(process.env.CATALOG_TEST_CALLS,JSON.stringify({at:Date.now()})+'\\n');return new Response(JSON.stringify({loading_strategy:'full',items:[],categories:[],options:[]}));};`);
    await run(process.execPath,[...argv.filter(arg=>arg!=='--limit=2'),'--limit=1'],options);
    const resumed=JSON.parse((await fs.readFile(calls,'utf8')).trim());assert.ok(resumed.at>=retryAfterUntilMs);
  }finally{
    const resolved=await fs.realpath(temporary),allowed=(await fs.realpath(artifactRoot))+path.sep;
    assert.ok(resolved.startsWith(allowed)&&path.basename(resolved).startsWith('catalog-cooldown-test-'));
    await fs.rm(resolved,{recursive:true,force:true});
  }
});
