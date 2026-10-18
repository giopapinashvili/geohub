// Package the owner's supplied artwork for app icons and the social preview.
// The source PNG is preserved byte-for-byte; the browser only sizes/layouts it.
//   node web/tools/make-icons.mjs
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const OUT = 'web/public/icons';
mkdirSync(OUT, { recursive: true });
const source = readFileSync('web/public/brand/geohub-g-source.png');
const image = `data:image/png;base64,${source.toString('base64')}`;
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium'].find(existsSync) });
const page = await browser.newPage({ deviceScaleFactor: 1 });
const font = f => `url(data:font/woff2;base64,${readFileSync(`web/src/assets/fonts/${f}`).toString('base64')}) format('woff2')`;
const faces = `<style>@font-face{font-family:F;font-weight:700;src:${font('firago-latin-700.woff2')};unicode-range:U+0000-00FF}
@font-face{font-family:F;font-weight:700;src:${font('firago-georgian-700.woff2')};unicode-range:U+10D0-10FF}
@font-face{font-family:F;font-weight:500;src:${font('firago-georgian-500.woff2')};unicode-range:U+10D0-10FF}</style>`;
// Contain transparent outer padding; the original mark is not redrawn.
const mark = size => `<span style="display:block;position:relative;overflow:hidden;width:${size}px;height:${size}px;flex:none"><img alt="" src="${image}" style="position:absolute;width:120%;height:120%;left:-10%;top:-10%;object-fit:contain"></span>`;
async function render(html, name, width, height = width) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<html><head>${faces}</head><body style="margin:0;background:transparent">${html}</body></html>`);
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(img => img.decode())); });
  await page.screenshot({ path: `${OUT}/${name}`, omitBackground: true, clip: { x: 0, y: 0, width, height } });
}
try {
  for (const size of [32, 72, 96, 128, 192, 512]) {
    await render(mark(size), `geohub-g-${size}.png`, size);
    copyFileSync(`${OUT}/geohub-g-${size}.png`, `${OUT}/icon-${size}.png`);
  }
  await render(`<div style="width:512px;height:512px;background:#0b1322;display:grid;place-items:center">${mark(330)}</div>`, 'geohub-g-maskable-512.png', 512);
  copyFileSync(`${OUT}/geohub-g-maskable-512.png`, `${OUT}/icon-maskable-512.png`);
  await render(`<div style="width:1200px;height:630px;background:linear-gradient(145deg,#050b13,#102940);display:flex;align-items:center;gap:40px;padding:0 86px;box-sizing:border-box;font-family:F,sans-serif;color:#fff">
    ${mark(250)}<div><div style="font-size:100px;font-weight:700;letter-spacing:-3px">Geo<span style="color:#09b9dc">Hub</span></div><div style="font-size:38px;font-weight:500;opacity:.92;margin-top:14px">აღმოაჩინე საქართველო</div></div></div>`, 'geohub-g-og.png', 1200, 630);
  copyFileSync(`${OUT}/geohub-g-og.png`, `${OUT}/og-image.png`);
  const fallback = readFileSync(`${OUT}/geohub-g-128.png`).toString('base64');
  writeFileSync('web/public/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><image width="128" height="128" href="data:image/png;base64,${fallback}"/></svg>\n`);
  const manifestPath = 'web/public/manifest.webmanifest';
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  for (const icon of [...manifest.icons, ...manifest.shortcuts.flatMap(shortcut => shortcut.icons || [])]) icon.src = icon.src.replace(/\/(?:icon|geohub-g)-/, '/geohub-g-');
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ sourceSha256: createHash('sha256').update(source).digest('hex'), icons: [32, 72, 96, 128, 192, 512], maskable: true, socialPreview: true }));
} finally { await browser.close(); }
