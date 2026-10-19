/** Reviewed exact-site Commons photographs. No arbitrary name/brand matching. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { jpegDimensions } from './place-media-utils.mjs';

const targets = [
  ['TSU Main Building in 2018 (2).jpg', ['osm_relation_900361', 'osm_relation_16510616'], 'თსუ-ს პირველი კორპუსი', 'Wikidata Q37008 P18; exact first-building Q42662646; university representative site'],
  ['Georgische Technische Universität - 1. Korpus.jpg', ['osm_relation_1200123'], 'სტუ-ს პირველი კორპუსი', 'Exact first-building Wikidata Q42642907; not the separate administrative site'],
  ['Technical University of Georgia, Building 1.jpg', ['osm_relation_1200123'], 'საქართველოს ტექნიკური უნივერსიტეტის პირველი კორპუსი', 'Commons description explicitly identifies Building 1 of Georgian Technical University'],
  ['Georgian Technical University administrative building.jpg', ['osm_relation_20406737', 'osm_node_4236723661', 'osm_relation_16507696'], 'სტუ-ს ადმინისტრაციული კორპუსი', 'Commons exact administrative-building title; parent university uses this official administrative-site anchor'],
  ['Tbilisi, Georgia — Tbilisi State University, VI Corpus.JPG', ['osm_relation_20078469'], 'თსუ-ს მეექვსე კორპუსი', 'Commons exact VI corpus title; mapped building 6'],
  ['Iliauni1korpusi.jpg', ['osm_way_156763778'], 'ილიას სახელმწიფო უნივერსიტეტის A კორპუსი', 'Wikidata Q2324420 P18 and exact A building only; university representative anchor is elsewhere'],
  ['Free University of Tbilisi Library.jpg', ['osm_way_161757318'], 'თავისუფალი და აგრარული უნივერსიტეტების კამპუსის ბიბლიოთეკა', 'Wikidata Q16375275 P18; shared Free/Agricultural campus'],
  ['Free University of Tbilisi Garden.JPG', ['osm_way_161757318'], 'თავისუფალი უნივერსიტეტის კამპუსის ბაღი', 'Commons exact campus description; shared Free/Agricultural campus'],
  ['სამხატვრო აკადემიის შენობა გრიბოედოვის ქუჩაზე.jpg', ['osm_relation_17405902'], 'სამხატვრო აკადემია — გრიბოედოვის ქუჩის შენობა', 'Commons Arshakuni Palace category and exact Georgian title'],
  ['სამხატვრო აკადემიის შესასვლელი ვესტიბიული.JPG', ['osm_relation_17405902'], 'სამხატვრო აკადემიის შესასვლელი ვესტიბიული', 'Commons exact institution vestibule title'],
  ['Tbilisi Art Acdemy photo from archive.jpg', ['osm_relation_17405902'], 'სამხატვრო აკადემიის საარქივო ფოტო', 'Wikidata Q619600 P18; historical image explicitly labelled'],
  ['Tbilisi Conservatoire.JPG', ['osm_relation_18222383'], 'თბილისის სახელმწიფო კონსერვატორია', 'Wikidata Q2478876 P18'],
  ['Tbilisi State Conservatoire main hall.jpg', ['osm_relation_18222383'], 'თბილისის სახელმწიფო კონსერვატორიის დიდი დარბაზი', 'Commons exact main hall title; institution interior'],
  ['Shota Rustaveli Theatre and Film University.jpg', ['osm_node_10300242379'], 'შოთა რუსთაველის თეატრისა და კინოს უნივერსიტეტის შენობა', 'Wikidata Q4453142 P18; geographically matching primary building only'],
  ['Tbilisi City - Urban Photos (16).jpg', ['osm_way_991902757'], 'კავკასიის უნივერსიტეტის კამპუსი ქალაქის ხედში', 'Commons category explicitly Caucasus University; historic seminary building identity reviewed visually'],
  ['NPLG building, Tbilisi.jpg', ['osm_node_11427406837'], 'ეროვნული ბიბლიოთეკის III კორპუსი', 'Commons description explicitly Building III, Gudiashvili; coordinate 41.6972,44.8006 within 30m of mapped point'],
  ['National library of Georgia, located in Tbilisi.jpg', ['osm_node_11427406837'], 'ეროვნული ბიბლიოთეკის III კორპუსის შესასვლელი', 'Visually identical entrance to NPLG building Tbilisi (Building III), not Building I'],
  ['National library of Georgia,Tbilisi. Inside view.jpg', ['osm_node_11427406837'], 'ეროვნული ბიბლიოთეკის III კორპუსი — ფრანგული ინსტიტუტის სივრცე', 'Visible Institut Francais sign; official NPLG Location lists French mediatheque in Building III'],
  ['National library of Georgia, located in Tbilisi (conference hall).jpg', ['osm_node_11427406837'], 'ეროვნული ბიბლიოთეკის III კორპუსის საკონფერენციო დარბაზი', 'Commons institution conference-hall title; official NPLG Location lists conference hall in Building III'],
  ['National Parliamentary Library of Georgia, Building №1.jpg', ['osm_relation_1182326'], 'ეროვნული ბიბლიოთეკის I კორპუსი', 'Commons exact building number title; main mapped building'],
  ['East Point, Tbilisi.jpg', ['osm_way_371721697'], 'ისთ ფოინთის სავაჭრო სივრცე', 'Commons exact East Point Tbilisi category and description'],
  ['East point Tbilisi1864.jpg', ['osm_way_371721697'], 'ისთ ფოინთი თბილისში', 'Commons exact East Point mall Tbilisi description'],
  ['Rustaveli St, Tbilisi (50503459911).jpg', ['osm_way_559446309'], 'გალერია თბილისი — ხედი რუსთაველის გამზირიდან', 'Commons Galleria Tbilisi category; facade reviewed visually'],
  ['View from Galleria mall in Tbilisi.jpg', ['osm_way_559446309'], 'ხედი გალერია თბილისიდან', 'Commons exact viewpoint; caption explicitly view from mall'],
  ['Houses and Buildings in Tbilisi - mostafa meraji - Georgia Photos - Travel And Tourism 24.jpg', ['osm_way_124320620'], 'თბილისის პანორამა — შორეულ ხედში ქარვასლის სავაჭრო ცენტრიც ჩანს', 'Commons image annotation identifies Karvasla Shopping Mall; panorama, not close exterior'],
];

const out = 'web/public/place-media', cache = '.codex/artifacts/institution-enrichment';
await mkdir(cache, { recursive: true });
const hash = b => createHash('sha256').update(b).digest('hex');
const clean = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#(?:x([\da-f]+)|(\d+));/gi, (_, h, d) => String.fromCodePoint(parseInt(h || d, h ? 16 : 10))).replace(/\s+/g, ' ').trim();
const ua = { 'User-Agent': 'GeoHubDirectory/1.2 (https://geohub-main.pages.dev; licensed institution photographs)' };
const pause = ms => new Promise(r => setTimeout(r, ms));
function captureDate(raw) {
  if (/upload date/i.test(raw)) return '';
  const iso = raw.match(/(?:^|\s)(\d{4}-\d{2}-\d{2})(?:\D|$)/);
  if (iso) return iso[1];
  const named = raw.match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
  if (named) {
    const month = ['january','february','march','april','may','june','july','august','september','october','november','december'].indexOf(named[2].toLowerCase()) + 1;
    return `${named[3]}-${String(month).padStart(2, '0')}-${named[1].padStart(2, '0')}`;
  }
  return /^\d{4}(?:-\d{2})?$/.test(raw) ? raw : '';
}
const photos = [], skipped = [];
for (const [title, ids, caption, proof] of targets) {
  try {
    const file = `${cache}/${hash(title)}.json`;
    let page;
    try { page = JSON.parse(await readFile(file, 'utf8')); }
    catch {
      const u = new URL('https://commons.wikimedia.org/w/api.php');
      u.search = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', titles: 'File:' + title, prop: 'imageinfo|categories', cllimit: '50', iiprop: 'url|mime|size|timestamp|extmetadata', iiurlwidth: '960', redirects: '1' });
      const r = await fetch(u, { headers: ua, signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw Error(`metadata HTTP ${r.status}`);
      const d = await r.json(); page = d.query?.pages?.[0];
      if (!page?.imageinfo?.length) throw Error('missing file');
      await writeFile(file, JSON.stringify(page, null, 2)); await pause(250);
    }
    const info = page.imageinfo[0], meta = info.extmetadata || {};
    if (info.mime !== 'image/jpeg') throw Error('not JPEG');
    const license = clean(meta.LicenseShortName?.value);
    const categories = clean(meta.Categories?.value).split('|');
    const publicDomain = license === 'Public domain' && clean(meta.Copyrighted?.value).toLowerCase() === 'false' && categories.some(c => ['PD-self', 'PD-user', 'PD-old-100'].includes(c));
    const licenseUrl = publicDomain ? 'https://creativecommons.org/publicdomain/mark/1.0/' : clean(meta.LicenseUrl?.value).replace(/^http:/, 'https:');
    if (!publicDomain && (!/^(CC BY(?:-SA)? [234]\.0|CC0)$/.test(license) || !licenseUrl.startsWith('https://creativecommons.org/'))) throw Error('unverified reusable license');
    const author = clean(meta.Attribution?.value || meta.Artist?.value);
    if (!author) throw Error('missing author');
    let authorUrl = clean((meta.Artist?.value || '').match(/href="([^"]+)"/)?.[1] || '');
    if (authorUrl.startsWith('//')) authorUrl = 'https:' + authorUrl;
    if (authorUrl.startsWith('/')) authorUrl = 'https://commons.wikimedia.org' + authorUrl;
    if (!/^https?:\/\//.test(authorUrl)) authorUrl = '';
    let downloadUrl = info.thumburl || info.url, bytes;
    const cached = `${cache}/${hash(downloadUrl)}.jpg`;
    try { bytes = await readFile(cached); } catch {
      const r = await fetch(downloadUrl, { headers: ua, signal: AbortSignal.timeout(30000) });
      if (!r.ok || !r.headers.get('content-type')?.startsWith('image/jpeg')) throw Error('photo download rejected');
      bytes = Buffer.from(await r.arrayBuffer()); await writeFile(cached, bytes); await pause(250);
    }
    if (bytes.length > 600000) throw Error('oversized derivative');
    const dimensions = jpegDimensions(bytes);
    const sha256 = hash(bytes), url = `/place-media/institution-${sha256.slice(0, 12)}.jpg`;
    await writeFile(out + '/' + url.split('/').pop(), bytes);
    const rawDate = clean(meta.DateTimeOriginal?.value);
    const dateTaken = captureDate(rawDate);
    for (const placeId of ids) photos.push({ placeId, url, caption, author, authorUrl, license, licenseUrl, dateTaken, rawDateTaken: rawDate,
      sourceTitle: page.title, sourceUrl: info.descriptionurl, originalUrl: info.url, preview: dimensions, bytes: bytes.length, sha256,
      sourceMapping: { type: 'reviewed-institution-exact-site', proof, osmUrl: 'https://www.openstreetmap.org/' + placeId.replace(/^osm_/, '').replace('_', '/') },
      description: clean(meta.ImageDescription?.value), categories: page.categories?.map(c => c.title), downloadedAt: new Date().toISOString(),
      changes: 'Wikimedia thumbnail; displayed resized and cropped to fit.',
    });
    console.log(JSON.stringify({ title, places: ids.length, bytes: bytes.length }));
  } catch (error) { skipped.push({ title, reason: error.message }); console.log(JSON.stringify({ title, skipped: error.message })); }
}
const registry = {};
for (const { placeId, url, caption, sourceUrl, sourceTitle, author, authorUrl, license, licenseUrl, dateTaken } of photos) {
  (registry[placeId] ||= []).push({ url, caption, sourceUrl, sourceTitle, author, authorUrl, license, licenseUrl, dateTaken });
}
await writeFile(`${out}/institutions-credits.json`, JSON.stringify({ version: 1, reviewedAt: '2026-10-19', photos }, null, 2) + '\n');
await writeFile('web/src/lib/curatedInstitutionMedia.generated.js', `// Generated by web/tools/enrich-institution-media.mjs. Exact reviewed sites.\nexport const institutionPhotos = ${JSON.stringify(registry)};\nexport function getInstitutionPhotos(place) { return institutionPhotos[typeof place === 'string' ? place : place?.id] || []; }\n`);
const report = { places: Object.keys(registry).length, photoLinks: photos.length, uniquePhotos: new Set(photos.map(p => p.url)).size, skipped };
await writeFile(`${cache}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
