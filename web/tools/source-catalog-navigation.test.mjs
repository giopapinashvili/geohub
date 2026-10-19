import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { buildSourceCategoryTree, sourceCategoryPath, sourceCatalogFocusItem } from '../src/lib/sourceCatalogNavigation.js';

// Exercise the real JSX and event handlers without controlling a browser.
async function componentHarness() {
  const state = [], deps = [], effects = [];
  let cursor = 0;
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; },
    useRef(initial) { const i = cursor++; return state[i] ||= { current: initial }; },
    useMemo(fn) { cursor++; return fn(); },
    useEffect(fn, next) { const i = cursor++; if (!deps[i] || next.some((value, index) => !Object.is(value, deps[i][index]))) { effects.push(fn); deps[i] = next; } },
  };
  const query = { value: new URLSearchParams() };
  const built = await build({ entryPoints: ['web/src/features/commerce/SourcePlaceCatalog.jsx'], bundle: true, write: false, format: 'cjs', platform: 'node', jsxFactory: 'jsx',
    banner: { js: 'const jsx = (type, props, ...children) => ({ type, props: { ...props, children } }); const Fragment = "fragment";' }, jsxFragment: 'Fragment',
    plugins: [{ name: 'component-fixture', setup(plugin) {
      plugin.onResolve({ filter: /^(preact\/hooks|.*\/(router|Button|Icon|misc|sourceCatalogs)\.(js|jsx))$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'preact/hooks' ? 'export const {useState,useMemo,useRef,useEffect}=fixtureHooks;' : args.path.endsWith('/router.js') ? 'export const query=fixtureQuery;' : args.path.endsWith('/sourceCatalogs.js') ? 'export const sourceHttpsUrl=value=>value;' : 'export const Button="button",Icon="icon",Img="img";', loader: 'js' }));
      plugin.onLoad({ filter: /\.css$/ }, () => ({ contents: '', loader: 'js' }));
    } }],
  });
  const module = { exports: {} };
  new Function('module', 'exports', 'fixtureHooks', 'fixtureQuery', built.outputFiles[0].text)(module, module.exports, hooks, query);
  return { query, render(props) { cursor = 0; return module.exports.SourcePlaceCatalog(props); }, flush() {
    const previous = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = () => 0;
    try { while (effects.length) effects.shift()(); } finally { globalThis.requestAnimationFrame = previous; }
  } };
}

function elements(root) {
  if (!root || typeof root !== 'object') return [];
  if (Array.isArray(root)) return root.flatMap(elements);
  return [root, ...elements(root.props?.children)];
}
const fixture = {
  catalog: { placeId: 'place-one', venueId: 'venue-one', kind: 'products', items: [
    { id: 'case-one', name: 'Phone one case', kind: 'product', categoryIds: ['phone-one', 'cases-one'] },
    { id: 'case-two', name: 'Phone two case', kind: 'product', categoryIds: ['phone-two', 'cases-two'] },
  ], categories: [{ id: 'phone-one', name: 'Phone one' }, { id: 'cases-one', name: 'Cases', parentId: 'phone-one' }, { id: 'phone-two', name: 'Phone two' }, { id: 'cases-two', name: 'Cases', parentId: 'phone-two' }], sourceUrl: 'https://example.com/catalog' },
  place: { id: 'place-one', name: 'Phone store' },
};

test('a new item deep link clears stale category/search filters in the same catalog', async () => {
  const harness = await componentHarness();
  harness.render(fixture); harness.flush();
  let tree = harness.render(fixture);
  elements(tree).find(element => element.type === 'button' && JSON.stringify(element.props.children).includes('Phone one')).props.onClick();
  tree = harness.render(fixture); harness.flush();
  assert.equal(elements(tree).filter(element => typeof element.type === 'function' && element.type.name === 'CatalogItem').length, 1);
  harness.query.value = new URLSearchParams({ item: 'case-two', venue: 'venue-one' });
  harness.render(fixture); harness.flush();
  tree = harness.render(fixture);
  assert.ok(elements(tree).some(element => element.props?.item?.id === 'case-two' && element.props.focused));
  // User navigation after arrival must still work while the URL retains the item.
  elements(tree).find(element => element.type === 'button' && JSON.stringify(element.props.children).includes('Phone one')).props.onClick();
  harness.render(fixture); harness.flush(); tree = harness.render(fixture);
  assert.equal(elements(tree).filter(element => element.props?.item).length, 1);
  assert.equal(elements(tree).find(element => element.props?.item).props.item.id, 'case-one');
  elements(tree).find(element => element.type === 'input').props.onInput({ currentTarget: { value: 'Phone one' } });
  harness.render(fixture); harness.flush();
  harness.query.value = new URLSearchParams({ item: 'case-one', venue: 'venue-one' });
  harness.render(fixture); harness.flush(); tree = harness.render(fixture);
  assert.equal(elements(tree).find(element => element.type === 'input').props.value, '');
});

test('same-label children stay under their model and empty filters are absent', async () => {
  const harness = await componentHarness();
  const props = { ...fixture, catalog: { ...fixture.catalog, categories: [...fixture.catalog.categories, { id: 'empty', name: 'Unavailable category' }] } };
  harness.render(props); harness.flush(); let tree = harness.render(props);
  const buttons = () => elements(tree).filter(element => element.type === 'button');
  assert.equal(buttons().length, 3); // All and two model roots, not indistinguishable Cases buttons.
  assert.ok(!buttons().some(element => JSON.stringify(element.props.children).includes('Unavailable')));
  buttons().find(element => JSON.stringify(element.props.children).includes('Phone two')).props.onClick();
  tree = harness.render(props);
  const children = elements(tree).find(element => element.props?.class === 'directory-catalog-subcategories');
  const childButtons = elements(children).filter(element => element.type === 'button');
  assert.equal(childButtons.length, 2);
  childButtons.find(element => JSON.stringify(element.props.children).includes('Cases')).props.onClick();
  tree = harness.render(props);
  assert.equal(elements(tree).find(element => element.props?.item).props.item.id, 'case-two');
  const breadcrumb = elements(tree).find(element => element.props?.class === 'directory-catalog-breadcrumb');
  assert.ok(JSON.stringify(breadcrumb).includes('Phone two'));
  assert.ok(!JSON.stringify(breadcrumb).includes('Phone one'));
});

test('nested source categories include descendants without duplicate counts and tolerate invalid parents', () => {
  const tree = buildSourceCategoryTree([
    { id: 'root', name: 'Root' }, { id: 'child', name: 'Child', parentId: 'root' }, { id: 'leaf', name: 'Leaf', parentId: 'child' },
    { id: 'orphan', name: 'Orphan', parentId: 'missing' }, { id: 'loop1', name: 'Loop one', parentId: 'loop2' }, { id: 'loop2', name: 'Loop two', parentId: 'loop1' },
  ], [{ id: 'one', categoryIds: ['leaf', 'child'] }, { id: 'two', categoryIds: ['orphan', 'loop2'] }]);
  assert.deepEqual([...tree.nodes.get('root').itemIds], ['one']);
  assert.deepEqual(sourceCategoryPath(tree, 'leaf').map(node => node.id), ['root', 'child', 'leaf']);
  assert.equal(tree.nodes.get('orphan').parentId, '');
  assert.ok(tree.roots.some(node => node.itemIds.has('two')));
});

test('large root lists use a labelled selector rather than dozens of horizontal controls', async () => {
  const harness = await componentHarness();
  const categories = Array.from({length: 20}, (_, index) => ({id: `root-${index}`, name: `Model ${index}`}));
  const props = { ...fixture, catalog: { ...fixture.catalog, categories, items: categories.map(category => ({id: `item-${category.id}`, name: category.name, categoryIds: [category.id]})) } };
  harness.render(props); harness.flush(); let tree = harness.render(props);
  const selector = elements(tree).find(element => element.type === 'select');
  assert.ok(selector);
  assert.equal(elements(selector).filter(element => element.type === 'option').length, 21);
  assert.ok(!elements(tree).some(element => element.props?.class === 'directory-catalog-categories'));
  selector.props.onChange({currentTarget: {value: 'root-19'}});
  tree = harness.render(props);
  assert.equal(elements(tree).find(element => element.props?.item).props.item.id, 'item-root-19');
});

test('venue-scoped deep links never focus a same-ID item in another catalog', () => {
  const params = new URLSearchParams({ item: 'case-one', venue: 'another-venue' });
  assert.equal(sourceCatalogFocusItem(fixture.catalog, fixture.place, params), '');
  assert.equal(sourceCatalogFocusItem(fixture.catalog, { ...fixture.place, itemId: 'case-one', pageHref: '/place/place-one?tab=catalog&item=case-one&venue=venue-one' }, params), 'case-one');
  assert.equal(sourceCatalogFocusItem(fixture.catalog, fixture.place, new URLSearchParams({ item: 'missing' })), '');
});
