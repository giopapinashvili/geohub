// Explicitly illustrative photographs for the removable, fictional demo catalog.
// No file here is assigned to a real venue or represented as its inventory.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const subjects = [
  ['coffee', 'File:Coffee and croissant at Espresso House in Turku.jpg', 'ყავა და კრუასანი — საილუსტრაციო ფოტო'],
  ['console', 'File:PlayStation 5 and DualSense (2).jpg', 'სათამაშო კონსოლი — საილუსტრაციო ფოტო'],
  ['meal', 'File:Georgian Khachapuri cheese bread.jpg', 'ხაჭაპური — საილუსტრაციო ფოტო'],
  ['lesson', 'File:Empty class room.jpg', 'საკლასო ოთახი — საილუსტრაციო ფოტო'],
  ['auto', 'File:Car tire stack 20170516.jpg', 'ავტომობილის საბურავები — საილუსტრაციო ფოტო'],
  ['flowers', 'File:Rose Flower Bouquet 052.JPG', 'ყვავილების თაიგული — საილუსტრაციო ფოტო'],
];
const headers = { 'User-Agent': 'GeoHubDemoMedia/1.0 (https://geohub-main.pages.dev; attributed illustrative demo photography)' };
const root = path.resolve('web/public/demo-media');
const artifactRoot = path.resolve('.codex/artifacts/demo-media');
await fs.mkdir(root, { recursive: true });
await fs.mkdir(artifactRoot, { recursive: true });
const api = new URL('https://commons.wikimedia.org/w/api.php');
api.search = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', prop: 'imageinfo', iiprop: 'url|mime|size|extmetadata|timestamp', iiurlwidth: '960', redirects: '1', titles: subjects.map(([, title]) => title).join('|') });
const response = await fetch(api, { headers, signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`Commons metadata: ${response.status}`);
const data = await response.json();
await fs.writeFile(path.join(artifactRoot, 'commons-source-metadata.json'), JSON.stringify(data, null, 2));
const plain = value => String(value || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const photos = [];
for (const [key, title, caption] of subjects) {
  const page = data.query?.pages.find(row => row.title === title);
  const info = page?.imageinfo?.[0];
  if (!info || info.mime !== 'image/jpeg') throw new Error(`Missing JPEG metadata: ${title}`);
  const meta = info.extmetadata || {};
  const license = plain(meta.LicenseShortName?.value);
  const licenseUrl = plain(meta.LicenseUrl?.value).replace(/^http:/, 'https:');
  if (!/^(CC BY(?:-SA)? [234]\.0|CC0)$/.test(license) || new URL(licenseUrl).hostname !== 'creativecommons.org') throw new Error(`Unreviewed license ${license}: ${title}`);
  const downloadUrl = info.thumburl || info.url;
  if (!['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(new URL(downloadUrl).hostname)) throw new Error('Unexpected image host');
  const downloaded = await fetch(downloadUrl, { headers, signal: AbortSignal.timeout(30000) });
  if (!downloaded.ok || !(downloaded.headers.get('content-type') || '').startsWith('image/jpeg')) throw new Error(`JPEG download failed: ${title} (${downloaded.status})`);
  const bytes = Buffer.from(await downloaded.arrayBuffer());
  if (bytes.length > 3 * 1024 * 1024 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error(`Invalid/oversized JPEG: ${title}`);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const filename = `${key}-${sha256.slice(0, 12)}.jpg`;
  await fs.writeFile(path.join(root, filename), bytes);
  const rawDateTaken = plain(meta.DateTimeOriginal?.value);
  const dateTaken = /^\d{4}-\d{2}-\d{2}/.test(rawDateTaken) ? rawDateTaken.slice(0, 10) : /^\d{4}$/.test(rawDateTaken) ? rawDateTaken : '';
  photos.push({ key, url: `/demo-media/${filename}`, caption, illustrative: true, sourceTitle: title, sourceUrl: info.descriptionurl, originalUrl: info.url, author: plain(meta.Artist?.value), license, licenseUrl, dateTaken, rawDateTaken, uploadTimestamp: info.timestamp, downloadedAt: new Date().toISOString(), bytes: bytes.length, sha256, preview: { width: info.thumbwidth || info.width, height: info.thumbheight || info.height }, changes: 'Wikimedia thumbnail; displayed resized and cropped to fit. Illustrative demo use only; not a depiction of the fictional merchant or confirmed inventory.' });
  console.log(`${key}: ${bytes.length} bytes, ${license}`);
}
await fs.writeFile(path.join(root, 'credits.json'), JSON.stringify({ version: 1, demoBatchId: 'geohub-commerce-demo-v1', illustrative: true, photos }, null, 2) + '\n');
const fields = ['url', 'caption', 'author', 'license', 'licenseUrl', 'sourceUrl', 'dateTaken', 'illustrative'];
const entries = Object.fromEntries(photos.map(photo => [photo.key, Object.fromEntries(fields.map(field => [field, photo[field]]))]));
await fs.writeFile('web/src/lib/demoMedia.js', '// Licensed illustrative photos for fictional demo pages only. Full credits: /demo-media/credits.json\nexport const DEMO_MEDIA = Object.freeze(' + JSON.stringify(entries, null, 2) + ');\n');
console.log(`Saved ${photos.length} illustrative photographs (${photos.reduce((sum, photo) => sum + photo.bytes, 0)} bytes).`);
