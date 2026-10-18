import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

// Bundle the real release modules with the single switch in each state.
// Route page loaders stay lazy: neither browsers nor Firebase are required.
async function releaseModule(relative, enabled) {
  const bundled = await build({
    entryPoints: [fileURLToPath(new URL(relative, import.meta.url))],
    bundle: true, write: false, platform: 'node', format: 'esm',
    define: { 'import.meta.env': JSON.stringify({ DEV: false, MODE: 'production' }) },
    plugins: [{ name: 'test-release-switch', setup(builder) {
      builder.onLoad({ filter: /commerceDemoConfig\.js$/ }, () => ({ contents: `export const DEMO_ENABLED = ${enabled};`, loader: 'js' }));
      builder.onResolve({ filter: /^preact\/compat$/ }, () => ({ path: 'lazy', namespace: 'test' }));
      builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const lazy = loader => loader;' }));
      builder.onResolve({ filter: /^\.\/pages\/.*\.jsx$/ }, args => ({ path: args.path, external: true }));
    } }],
  });
  return import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
}

test('one disabled flag removes the demo route and merchant content while keeping real discounts', async () => {
  const [routes, demo] = await Promise.all([releaseModule('../src/routes.js', false), releaseModule('../src/features/commerce/demo.js', false)]);
  assert.ok(routes.ROUTES.some(route => route.path === '/discounts'));
  assert.ok(!routes.ROUTES.some(route => route.path.startsWith('/discounts/demo')));
  assert.equal(demo.DEMO_ENABLED, false);
  for (const id of ['coffee', 'console', 'meal', 'lesson', 'auto', 'flowers']) assert.equal(demo.getDemoMerchant(id), null);
});

test('enabled release has exactly one demo route and six complete destinations', async () => {
  const [routes, demo] = await Promise.all([releaseModule('../src/routes.js', true), releaseModule('../src/features/commerce/demo.js', true)]);
  assert.equal(routes.ROUTES.filter(route => route.path === '/discounts/demo/:id').length, 1);
  assert.equal(demo.DEMO_ENABLED, true);
  assert.equal(demo.DEMO_OFFERS.length, 6);
  for (const offer of demo.DEMO_OFFERS) assert.equal(demo.getDemoMerchant(offer.demoMerchantId)?.item.id, offer.itemId);
});
