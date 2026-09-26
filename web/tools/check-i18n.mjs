// Lists translation keys used in web/src that are missing from a dictionary,
// and keys present in ka.js but missing from en.js / ru.js.
//   node web/tools/check-i18n.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = 'web/src';
const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p); else if (/\.(jsx?|mjs)$/.test(f) && !p.includes('/i18n/')) files.push(p);
  }
})(root);

const used = new Set();
const re = /\bt[n]?\(\s*'([a-zA-Z0-9_.]+)'/g;
const reKey = /(?:label|title|sub|key|labelKey):\s*'([a-z]+\.[a-zA-Z0-9_.]+)'/g;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(re)) used.add(m[1]);
  for (const m of src.matchAll(reKey)) used.add(m[1]);
}
const load = async (l) => (await import(`../src/i18n/${l}.js?${Date.now()}`)).default;
const ka = await load('ka');
const base = (k) => k.replace(/\.(one|few|many|other)$/, '');
const kaKeys = new Set(Object.keys(ka).map(base));
const missing = [...used].filter((k) => !kaKeys.has(k) && !/\.$/.test(k)).sort();
console.log(`used: ${used.size}, ka: ${Object.keys(ka).length}`);
if (missing.length) console.log('MISSING in ka:\n  ' + missing.join('\n  '));
for (const l of ['en', 'ru']) {
  const d = await load(l);
  const dk = new Set(Object.keys(d).map(base));
  const miss = [...kaKeys].filter((k) => !dk.has(k));
  const extra = Object.keys(d).map(base).filter((k) => !kaKeys.has(k));
  console.log(`${l}: ${Object.keys(d).length} keys, missing ${miss.length}${extra.length ? `, extra ${extra.length}: ${extra.slice(0, 10).join(', ')}` : ''}`);
}
