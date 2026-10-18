// Export only the layers used by GeoHub into immutable, individually cacheable
// XYZ files. Cloudflare Pages static assets do not guarantee HTTP Range support.
import { open, readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import Pbf from 'pbf';

const [archivePath, outputPath] = process.argv.slice(2);
if (!archivePath || !outputPath) throw new Error('Usage: node web/tools/export-map-tiles.mjs input.pmtiles new-version-directory');
const metadata = JSON.parse(await readFile(new URL('../public/map-data/tbilisi-20261018.json', import.meta.url), 'utf8'));
const archiveBytes = await readFile(archivePath);
const sha256 = createHash('sha256').update(archiveBytes).digest('hex');
if (sha256 !== metadata.sha256) throw new Error('Archive hash does not match the verified source manifest');
const decoder = await readFile(new URL('../src/vendor/pmtiles-4.5.0.js', import.meta.url), 'utf8');
const { PMTiles } = await import(`data:text/javascript;base64,${Buffer.from(decoder).toString('base64')}`);
const file = await open(archivePath, 'r');
const source = new PMTiles({
  getKey: () => resolve(archivePath),
  async getBytes(offset, length) {
    const bytes = Buffer.alloc(length);
    const { bytesRead } = await file.read(bytes, 0, length, offset);
    if (bytesRead !== length) throw new Error('Incomplete archive read');
    return { data: bytes.buffer };
  },
});

// Preserve the source layer's bytes exactly; only discard unused entire layers.
function selectedLayers(bytes) {
  const pbf = new Pbf(bytes);
  const parts = [];
  while (pbf.pos < pbf.length) {
    const start = pbf.pos;
    const tag = pbf.readVarint();
    if (tag !== 26) { pbf.skip(tag); continue; }
    const end = pbf.readVarint() + pbf.pos;
    let name;
    while (pbf.pos < end) {
      const field = pbf.readVarint();
      if (field === 10) { name = pbf.readString(); break; }
      pbf.skip(field);
    }
    if (name === 'buildings' || name === 'roads') parts.push(bytes.subarray(start, end));
    pbf.pos = end;
  }
  return Buffer.concat(parts);
}

const xTile = (lng, zoom) => Math.floor((lng + 180) / 360 * 2 ** zoom);
const yTile = (lat, zoom) => Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * 2 ** zoom);
let count = 0, totalBytes = 0, largestBytes = 0;
try {
  const output = resolve(outputPath);
  // Never rewrite an existing immutable snapshot directory.
  if (await stat(output).catch(() => null)) throw new Error('Output directory already exists; choose a new version');
  await mkdir(output, { recursive: true });
  for (let z = metadata.minzoom; z <= metadata.maxzoom; z++) {
    for (let x = xTile(metadata.bbox[0], z); x <= xTile(metadata.bbox[2], z); x++) {
      const directory = join(output, String(z), String(x));
      await mkdir(directory, { recursive: true });
      for (let y = yTile(metadata.bbox[3], z); y <= yTile(metadata.bbox[1], z); y++) {
        const tile = await source.getZxy(z, x, y);
        const bytes = tile ? selectedLayers(new Uint8Array(tile.data)) : Buffer.alloc(0);
        await writeFile(join(directory, `${y}.mvt`), bytes);
        count++; totalBytes += bytes.length; largestBytes = Math.max(largestBytes, bytes.length);
      }
    }
  }
  const result = { sourceSha256: sha256, layers: ['buildings', 'roads'], count, totalBytes, largestBytes };
  await writeFile(join(output, 'export.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
} finally { await file.close(); }
