// Generates local placeholder photos for the emulator seed, so screenshots
// and tests never depend on third-party image hosts.
//   node web/tools/make-fixtures.mjs   →  web/e2e/fixtures/*.png
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = 'web/e2e/fixtures';
mkdirSync(OUT, { recursive: true });

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, pixel) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pixel(x, y);
      const i = y * (w * 3 + 1) + 1 + x * 3;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

const SCENES = [
  ['mountain', '#7fb2e5', '#f3d7b6', '#3b4a5e', '#1f2a36', '#fff4d6'],
  ['sunset', '#f59e3a', '#e3325f', '#5b2340', '#2b1320', '#ffe08a'],
  ['sea', '#8fd3f4', '#dff4ff', '#1b6f9a', '#0e4a6b', '#ffffff'],
  ['forest', '#b8e0c2', '#f0f7e8', '#2f6b3a', '#173d21', '#fff9d9'],
  ['wine', '#f1c6a8', '#fbe9dc', '#7a2742', '#4a1428', '#fff1c1'],
  ['city', '#c7b8e8', '#f5e9ff', '#4b3f72', '#2a2344', '#ffe4a3'],
  ['desert', '#ffd8a8', '#fff3e0', '#b5651d', '#7a3e10', '#ffffff'],
  ['night', '#1b2440', '#3a3f6b', '#141a2e', '#0a0e1a', '#f7f3d4'],
];

function scene(w, h, [, sky1, sky2, m1, m2, sun], seed) {
  const [s1, s2, a, b, su] = [sky1, sky2, m1, m2, sun].map(hex);
  const sx = w * (0.25 + (seed % 5) * 0.12), sy = h * 0.3, sr = Math.min(w, h) * 0.08;
  const ridge = (x, f, amp, off) => h * off + Math.sin(x / w * Math.PI * f + seed) * h * amp + Math.sin(x / w * Math.PI * f * 2.7 + seed * 2) * h * amp * 0.35;
  return (x, y) => {
    let c = mix(s1, s2, y / h);
    const d = Math.hypot(x - sx, y - sy);
    if (d < sr) c = su; else if (d < sr * 2.2) c = mix(su, c, (d - sr) / (sr * 1.2));
    if (y > ridge(x, 2.2, 0.08, 0.55)) c = mix(a, c, 0.25);
    if (y > ridge(x, 3.1, 0.06, 0.7)) c = a;
    if (y > ridge(x, 4.3, 0.05, 0.82)) c = b;
    return c;
  };
}

let n = 0;
for (let i = 0; i < 24; i++) {
  const sc = SCENES[i % SCENES.length];
  const wide = i % 3 !== 2;
  const [w, h] = wide ? [960, 640] : [720, 900];
  writeFileSync(`${OUT}/photo-${i + 1}.png`, png(w, h, scene(w, h, sc, i + 1)));
  n++;
}
for (let i = 0; i < 6; i++) {
  writeFileSync(`${OUT}/tall-${i + 1}.png`, png(540, 960, scene(540, 960, SCENES[(i + 3) % SCENES.length], i + 7)));
  n++;
}
const TONES = ['#c2305a', '#b8621b', '#1f7a6d', '#6b4fa0', '#8a5a2b', '#2f6f9f', '#7a8b2e', '#a33f86', '#3d5a80'];
TONES.forEach((tone, i) => {
  const bg = hex(tone), skin = hex(['#f1c7a3', '#d9a47a', '#8d5a3b', '#f4d3b5'][i % 4]), shirt = mix(bg, [255, 255, 255], 0.55);
  writeFileSync(`${OUT}/avatar-${i + 1}.png`, png(240, 240, (x, y) => {
    const head = Math.hypot(x - 120, y - 98) < 46;
    const body = Math.hypot((x - 120) / 1.25, y - 250) < 100;
    return head ? skin : body ? shirt : mix(bg, [255, 255, 255], y / 900);
  }));
  n++;
});
console.log(`wrote ${n} images to ${OUT}`);
