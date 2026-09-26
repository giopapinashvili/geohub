// Renders the app icons and the social preview image from the logo SVG.
//   node web/tools/make-icons.mjs  →  web/public/icons/*
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';

const OUT = 'web/public/icons';
mkdirSync(OUT, { recursive: true });
const svg = readFileSync('web/public/favicon.svg', 'utf8');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
const font = (f) => `url(data:font/woff2;base64,${readFileSync(`web/src/assets/fonts/${f}`).toString('base64')}) format('woff2')`;
const FACES = `<style>@font-face{font-family:F;font-weight:700;src:${font('firago-latin-700.woff2')};unicode-range:U+0000-00FF}
@font-face{font-family:F;font-weight:700;src:${font('firago-georgian-700.woff2')};unicode-range:U+10D0-10FF}
@font-face{font-family:F;font-weight:500;src:${font('firago-georgian-500.woff2')};unicode-range:U+10D0-10FF}
@font-face{font-family:F;font-weight:500;src:${font('firago-latin-500.woff2')};unicode-range:U+0000-00FF}</style>`;

async function render(size, html, name, w = size, h = size) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><head>${FACES}</head><body style="margin:0;background:transparent">${html}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${OUT}/${name}`, omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
}

for (const s of [32, 72, 96, 128, 192, 512]) {
  await render(s, `<div style="width:${s}px;height:${s}px">${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}</div>`, `icon-${s}.png`);
}
// Maskable: full-bleed gradient with the mark inside the safe zone.
await render(512, `<div style="width:512px;height:512px;background:linear-gradient(135deg,#1d4ed8,#06b6d4);display:grid;place-items:center">${svg.replace('<svg ', '<svg width="300" height="300" ').replace(/<rect[^>]*\/>/, '')}</div>`, 'icon-maskable-512.png');
// Social preview 1200×630.
await render(0, `<div style="width:1200px;height:630px;background:linear-gradient(150deg,#020617 0%,#0b1f4d 38%,#1d4ed8 72%,#06b6d4 100%);display:flex;align-items:center;gap:48px;padding:0 96px;box-sizing:border-box;font-family:F,sans-serif;color:#fff">
  ${svg.replace('<svg ', '<svg width="220" height="220" ')}
  <div><div style="font-size:100px;font-weight:700;letter-spacing:-3px">GeoHub</div><div style="font-size:44px;font-weight:500;opacity:.92;margin-top:10px">აღმოაჩინე საქართველო</div></div></div>`, 'og-image.png', 1200, 630);
await browser.close();
console.log('icons written');
