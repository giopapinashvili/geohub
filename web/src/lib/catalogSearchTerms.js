import { normalizeSearch } from './discoverySearch.js';

// Query-only spelling aliases. Source titles and product facts are never rewritten.
const aliases = new Map([
  ['iphone',['აიფონი','აიფონ','იფონი','iphoni','aifoni','aifon']],
  ['ipad',['აიპადი','აიპად','aipadi','aipad']],
  ['playstation',['ფლეისთეიშენი','ფლეისთეიშენ','პლეისტეიშენი','პლეისთეიშენი','პლეისტეიშენ','pleisteisheni','pleisteishen','fleisteisheni','pleistation']],
  ['xbox',['იქსბოქსი','იქსბოქს','iksboksi','iksboks']],
  ['samsung',['სამსუნგი','სამსუნგ','samsungi']],
  ['sony',['სონი','soni']],
  ['airpods',['ეარპოდსი','ეარპოდს','earpodsi','earpods']],
].flatMap(([canonical, spellings])=>spellings.map(spelling=>[normalizeSearch(spelling),normalizeSearch(canonical)])));

export function normalizeCatalogQuery(value) {
  return normalizeSearch(value).split(' ').map(token=>aliases.get(token)||token).join(' ').replace(/\bps ([345])\b/g,'playstation $1');
}
