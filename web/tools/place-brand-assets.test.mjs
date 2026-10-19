import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PLACE_BRANDS, placeBrand } from '../src/lib/placeBrands.js';

const directory = new URL('../public/map-brands/', import.meta.url);

test('every displayed logo is a local, attributed asset with the reviewed content hash', async () => {
  const credits = JSON.parse(await readFile(new URL('credits.json', directory), 'utf8'));
  const extra = await Promise.all(['institution-credits.json','directory-credits.json','wolt-credits.json','services-credits.json','professional-credits.json'].map(async file=>{
    const value=JSON.parse(await readFile(new URL(file,directory),'utf8'));
    return value.brands ? {logos:value.brands.map(brand=>({...brand,id:`${file.replace('-credits.json','')}-${brand.id}`}))} : value;
  }));
  const byId = new Map([...credits.logos,...extra.flatMap(value=>value.logos || [])].map(credit => [credit.id, credit]));
  for (const [id, brand] of Object.entries(PLACE_BRANDS)) {
    assert.match(brand.file, /^[a-z0-9.-]+\.(png|svg)$/i, id);
    const credit = byId.get(id);
    assert.ok(credit, `Missing provenance: ${id}`);
    assert.equal(brand.file, credit.file, id);
    const sourceUrls=credit.sourceUrl ? [credit.sourceUrl] : (credit.sources || []).map(source=>source.sourceUrl);
    assert.ok(sourceUrls.length,`Missing publisher page: ${id}`);
    assert.ok(sourceUrls.every(url=>new URL(url).protocol.startsWith('http')),id);
    const content = await readFile(new URL(brand.file, directory));
    assert.equal(createHash('sha256').update(content).digest('hex'), credit.sha256, id);
    assert.ok(content.length > 64, id);
  }
});

test('white artwork uses a contrasting background and shared cards resolve official identities', () => {
  assert.equal(placeBrand({ name: 'ნიკორა' }).background, '#a32035');
  assert.notEqual(PLACE_BRANDS.britishuni.background, '#ffffff');
  assert.notEqual(PLACE_BRANDS['domain-college-dtmun-ge'].background, '#ffffff');
  assert.equal(placeBrand({ name: 'ზუმერი', category: 'electronics', raw: { brand: 'ზუმერი' } }).id, 'zoommer');
  assert.equal(placeBrand({ name: 'ქარვასლა', category: 'mall' }).id, 'karvasla');
  assert.equal(placeBrand({ name: 'პსპ', aliases: 'not-an-array', category: 'pharmacy' }).id, 'psp');
  assert.equal(placeBrand({ name: 'SPARTAK', category: 'supermarket' }), null);
});
