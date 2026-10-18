// Pure multilingual discovery ranking. Canonical spelling is a search key only;
// the original Georgian names and addresses are always retained for display.
const KA = Object.fromEntries([...('აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ')].map((c, i) => [c, ['a','b','g','d','e','v','z','t','i','k','l','m','n','o','p','zh','r','s','t','u','f','k','gh','q','sh','ch','ts','dz','ts','ch','kh','j','h'][i]]));
const GENERIC = new Set(['street', 'st', 'avenue', 'ave', 'road', 'rd', 'kucha', 'gamziri', 'qucha', 'tbilisi', 'tiflis', 'თბილისი']);
export function normalizeSearch(value) {
  return [...String(value ?? '').normalize('NFKD').toLowerCase()].map((c) => KA[c] || c).join('')
    .replace(/\p{M}/gu, '').replace(/ph/g, 'f').replace(/qu/g, 'ku').replace(/[’'`]/g, '')
    .replace(/(\p{L})(\p{N})/gu, '$1 $2').replace(/(\p{N})(\p{L})/gu, '$1 $2')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}
function tokens(text) { return normalizeSearch(text).split(' ').filter((v) => v && !GENERIC.has(v)); }
/** Bounded optimal-string-alignment distance also handles a swapped letter. */
export function editDistance(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = null;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) row[j] = Math.min(row[j], prev2[j - 2] + 1);
      best = Math.min(best, row[j]);
    }
    if (best > max) return max + 1;
    prev2 = prev; prev = row;
  }
  return prev[b.length];
}

const documents = new WeakMap();
function searchDocument(record) {
  if (documents.has(record)) return documents.get(record);
  const name = normalizeSearch(record.name || record.title || '');
  const raw = record.raw || {};
  const aliases = [record.aliases, raw.nameEn, raw.nameKa, raw.brand, raw.tags?.['name:en'], raw.tags?.['name:ka'], raw.tags?.alt_name].flat().filter((v) => typeof v === 'string').join(' ');
  const primary = `${name} ${normalizeSearch(aliases)}`;
  const hay = normalizeSearch([primary, record.address, record.city, record.categoryLabel, record.category, record.subcategory, record.itemTitle, record.businessName, record.model, ...(Array.isArray(record.tags) ? record.tags : [])].filter(Boolean).join(' '));
  const document = { name, primary, hay, words: tokens(hay) };
  documents.set(record, document);
  return document;
}
export function discoveryScore(record, query, prepared) {
  const needle = prepared?.needle ?? normalizeSearch(query);
  if (!needle) return { score: 1, match: 'exact' };
  const { name, primary, hay, words } = searchDocument(record);
  const required = prepared?.required ?? tokens(needle);
  if (!required.length) return { score: hay.includes(needle) ? 100 : 0, match: 'exact' };
  // Street numbers/model numbers are never silently corrected to another value.
  if (required.some((word) => /^\d/.test(word) && !words.includes(word))) return { score: 0, match: 'exact' };
  if (name === needle) return { score: 1000, match: 'exact' };
  if (primary.startsWith(needle)) return { score: 850, match: 'exact' };
  if (primary.includes(needle)) return { score: 750, match: 'exact' };
  if (hay.includes(needle)) return { score: 650, match: 'exact' };
  let score = 0;
  let fuzzy = false;
  for (const word of required) {
    if (words.includes(word)) { score += 80; continue; }
    if (word.length >= 2 && words.some((part) => part.startsWith(word))) { score += 55; continue; }
    if (word.length >= 4 && words.some((part) => part.includes(word))) { score += 40; continue; }
    if (word.length < 4 || /^\d/.test(word)) return { score: 0, match: 'exact' };
    const max = word.length >= 7 ? 2 : 1;
    let distance = max + 1;
    for (const part of words) {
      if (/^\d/.test(part) || Math.abs(part.length - word.length) > max) continue;
      distance = Math.min(distance, editDistance(word, part, max));
      if (!distance) break;
    }
    if (distance > max) return { score: 0, match: 'exact' };
    score += 25 - distance * 5;
    fuzzy = true;
  }
  return { score: (fuzzy ? 100 : 350) + score / required.length, match: fuzzy ? 'fuzzy' : 'exact' };
}

export function rankRecords(records, query, { limit = 50 } = {}) {
  const needle = normalizeSearch(query);
  const prepared = { needle, required: tokens(needle) };
  return records.map((record) => ({ record, result: discoveryScore(record, query, prepared) }))
    .filter((r) => r.result.score > 0).sort((a, b) => b.result.score - a.result.score || String(a.record.id).localeCompare(String(b.record.id)))
    .slice(0, Math.max(0, limit)).map(({ record, result }) => ({ ...record, searchMatch: result.match, searchScore: result.score }));
}
