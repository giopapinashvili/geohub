// Refresh the dated offline fallback from the same fixed source as the Worker.
import { writeFile } from 'node:fs/promises';
import { parseZoommerOffers } from '../worker/public-offers.js';

const response = await fetch('https://zoommer.ge/', { redirect: 'error', signal: AbortSignal.timeout(15000), headers: { Accept: 'text/html' } });
if (!response.ok) throw new Error(`Official source unavailable: ${response.status}`);
const data = parseZoommerOffers(await response.text());
await writeFile(new URL('../public/commerce-data/official-offers.json', import.meta.url), `${JSON.stringify(data)}\n`);
console.log(JSON.stringify({ offers: data.offers.length, observedAt: new Date(data.observedAtMs).toISOString(), source: data.source }));
