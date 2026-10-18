// Run only against local emulators:
// firebase emulators:exec --only auth,firestore --project demo-geohub "node web/tools/commerce-rules-check.mjs"
import { initializeApp as initAdmin, deleteApp as deleteAdmin } from 'firebase-admin/app';
import { getFirestore as adminDb } from 'firebase-admin/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  collection, query, where, orderBy, documentId, startAfter, limit, serverTimestamp,
} from 'firebase/firestore';
import { normalizeCommerceItem, normalizeCommerceOffer } from '../src/lib/commerce.js';

const PROJECT = 'demo-geohub';
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8085';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
  if (!/^127\.0\.0\.1:\d+$/.test(process.env[key])) throw new Error('This test only writes to local demo emulators.');
}
const adminApp = initAdmin({ projectId: PROJECT }, 'commerce-admin');
const admin = adminDb(adminApp);
const stamp = Date.now().toString(36);
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
const clients = [];
async function client(name, guest = false) {
  const app = initializeApp({ apiKey: 'demo-key', projectId: PROJECT, authDomain: `${PROJECT}.firebaseapp.com` }, `${name}_${stamp}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, host, Number(port));
  const uid = guest ? '' : (await createUserWithEmailAndPassword(auth, `${name}_${stamp}@test.ge`, 'geohub123')).user.uid;
  const result = { app, db, uid };
  clients.push(result);
  return result;
}
const owner = await client('owner');
const manager = await client('manager');
const stranger = await client('stranger');
const staffAdmin = await client('admin');
const guest = await client('guest', true);
const businessId = `commerce_biz_${stamp}`;
const otherId = `commerce_other_${stamp}`;
await admin.doc(`businesses/${businessId}`).set({ ownerId: owner.uid, name: 'Test business', status: 'active' });
await admin.doc(`businesses/${otherId}`).set({ ownerId: stranger.uid, name: 'Other business', status: 'active' });
await admin.doc(`businesses/${businessId}/admins/${manager.uid}`).set({ role: 'admin', userId: manager.uid });
await admin.doc(`admins/${staffAdmin.uid}`).set({ role: 'admin' });
const path = (kind, id) => `${kind}/${stamp}_${id}`;
const withMeta = (data, who = owner) => ({ ...data, createdBy: who.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
const itemData = (overrides = {}) => normalizeCommerceItem({ businessId, type: 'dish', title: 'ხაჭაპური', priceMinor: 2000, status: 'published', ...overrides });
const itemId = `${stamp}_item`;
const sampleItem = { id: itemId, ...itemData() };
const offerData = (overrides = {}, item = sampleItem) => normalizeCommerceOffer({ businessId, itemId: item.id, originalPriceMinor: item.priceMinor, priceMinor: 1500, startsAtMs: Date.now() - 1000, endsAtMs: Date.now() + 3600000, status: 'published', ...overrides }, item);
let passed = 0; let failed = 0;
async function check(label, allowed, operation) {
  try {
    await operation();
    if (!allowed) throw new Error('Expected permission-denied; write/read succeeded.');
    passed++;
    console.log(`ok ${label}`);
  } catch (error) {
    if (!allowed && error.code === 'permission-denied') { passed++; console.log(`ok ${label} (refused)`); }
    else { failed++; console.error(`FAIL ${label}: ${error.code || error.message}`); }
  }
}
const yes = (label, fn) => check(label, true, fn);
const no = (label, fn) => check(label, false, fn);

await yes('business owner creates priced published dish', () => setDoc(doc(owner.db, 'commerceItems', itemId), withMeta(itemData())));
await yes('guest reads published catalog item', () => getDoc(doc(guest.db, 'commerceItems', itemId)));
await yes('page admin creates draft service', () => setDoc(doc(manager.db, path('commerceItems', 'draft')), withMeta(itemData({ type: 'service', status: 'draft', priceMinor: null }), manager)));
await no('guest cannot read draft', () => getDoc(doc(guest.db, path('commerceItems', 'draft'))));
await yes('owner reads own draft', () => getDoc(doc(owner.db, path('commerceItems', 'draft'))));
await no('stranger cannot publish item for another business', () => setDoc(doc(stranger.db, path('commerceItems', 'forged')), withMeta(itemData(), stranger)));
await no('negative price rejected', () => updateDoc(doc(owner.db, 'commerceItems', itemId), { priceMinor: -1, updatedAt: serverTimestamp() }));
await no('fractional minor units rejected', () => updateDoc(doc(owner.db, 'commerceItems', itemId), { priceMinor: 12.5, updatedAt: serverTimestamp() }));
await no('unknown currency rejected', () => updateDoc(doc(owner.db, 'commerceItems', itemId), { currency: 'BTC', updatedAt: serverTimestamp() }));
await no('unbounded preparation time rejected', () => updateDoc(doc(owner.db, 'commerceItems', itemId), { preparationMinutes: 2000, updatedAt: serverTimestamp() }));
await no('non-menu item cannot claim diet/preparation attributes', () => updateDoc(doc(owner.db, 'commerceItems', itemId), { type: 'product', preparationMinutes: 10, updatedAt: serverTimestamp() }));
await no('unknown extra fields rejected', () => updateDoc(doc(owner.db, 'commerceItems', itemId), { adminOnly: true, updatedAt: serverTimestamp() }));
await no('createdBy is immutable', () => updateDoc(doc(owner.db, 'commerceItems', itemId), { createdBy: stranger.uid, updatedAt: serverTimestamp() }));
await no('business identity is immutable', () => updateDoc(doc(owner.db, 'commerceItems', itemId), { businessId: otherId, updatedAt: serverTimestamp() }));
await no('ordinary manager cannot create a fake demo dataset', () => setDoc(doc(owner.db, path('commerceItems', 'demo_denied')), withMeta(itemData({ isDemo: true, demoBatchId: 'test_batch' }))));
await yes('admin creates labeled demo catalog item', () => setDoc(doc(staffAdmin.db, path('commerceItems', 'demo')), withMeta(itemData({ isDemo: true, demoBatchId: 'test_batch' }), staffAdmin)));
await no('admin cannot erase demo marker through client update', () => updateDoc(doc(staffAdmin.db, path('commerceItems', 'demo')), { isDemo: false, demoBatchId: '', updatedAt: serverTimestamp() }));
await no('demo batch identity is immutable', () => updateDoc(doc(staffAdmin.db, path('commerceItems', 'demo')), { demoBatchId: 'another_batch', updatedAt: serverTimestamp() }));

await yes('owner publishes an item-linked discount', () => setDoc(doc(owner.db, path('commerceOffers', 'offer')), withMeta(offerData())));
await yes('owner edits catalog description', () => updateDoc(doc(owner.db, 'commerceItems', itemId), { description: 'Updated description', updatedAt: serverTimestamp() }));
await yes('page admin edits valid discount price', () => updateDoc(doc(manager.db, path('commerceOffers', 'offer')), { priceMinor: 1400, updatedAt: serverTimestamp() }));
await yes('page admin publishes second discount', () => setDoc(doc(manager.db, path('commerceOffers', 'offer2')), withMeta(offerData(), manager)));
await no('stranger cannot create forged discount', () => setDoc(doc(stranger.db, path('commerceOffers', 'forged')), withMeta(offerData(), stranger)));
await no('reference to another business item rejected', () => setDoc(doc(stranger.db, path('commerceOffers', 'wrong_business')), withMeta({ ...offerData(), businessId: otherId }, stranger)));
await no('inflated original price rejected', () => updateDoc(doc(owner.db, path('commerceOffers', 'offer')), { originalPriceMinor: 999999, updatedAt: serverTimestamp() }));
await no('inverted date range rejected', () => updateDoc(doc(owner.db, path('commerceOffers', 'offer')), { endsAtMs: 1, updatedAt: serverTimestamp() }));
await no('discount with price increase rejected', () => updateDoc(doc(owner.db, path('commerceOffers', 'offer')), { priceMinor: 2200, updatedAt: serverTimestamp() }));
await no('offer item identity cannot be replaced', () => updateDoc(doc(owner.db, path('commerceOffers', 'offer')), { itemId: `${stamp}_draft`, updatedAt: serverTimestamp() }));
await no('offer cannot promote real item as demo', () => setDoc(doc(staffAdmin.db, path('commerceOffers', 'fake_demo')), withMeta({ ...offerData(), isDemo: true, demoBatchId: 'test_batch' }, staffAdmin)));

const feed = (db, cursor) => query(collection(db, 'commerceOffers'), where('status', '==', 'published'), where('isDemo', '==', false), where('endsAtMs', '>', Date.now()), orderBy('endsAtMs', 'asc'), orderBy(documentId(), 'asc'), ...(cursor ? [startAfter(cursor)] : []), limit(1));
await yes('public offer query with expiry ordering', () => getDocs(feed(guest.db)));
await yes('public offer cursor advances without repeats', async () => {
  const first = await getDocs(feed(guest.db));
  const second = await getDocs(feed(guest.db, first.docs[0]));
  if (!second.docs.length || first.docs[0].id === second.docs[0].id) throw new Error('Cursor did not advance.');
});
await no('unconstrained public query cannot expose drafts', () => getDocs(query(collection(guest.db, 'commerceOffers'), limit(24))));
await yes('business manager lists all own offers', () => getDocs(query(collection(owner.db, 'commerceOffers'), where('businessId', '==', businessId), orderBy('createdAt', 'desc'), limit(24))));

const branchIds = [];
for (let i = 0; i < 5; i++) {
  const id = `${stamp}_branch${i}`;
  branchIds.push(id);
  await yes(`owner creates branch ${i + 1}`, () => setDoc(doc(owner.db, 'businessBranches', id), withMeta({ businessId, placeId: '', title: `Branch ${i}`, address: 'Test', city: 'თბილისი', lat: 41.7, lng: 44.8, status: 'published', isDemo: false, demoBatchId: '', datasetVersion: 1 })));
}
await yes('five explicitly scoped branches fit rules access limits', () => setDoc(doc(owner.db, path('commerceItems', 'branches')), withMeta(itemData({ allBranches: false, branchIds }))));
const branchItem = { id: `${stamp}_branches`, ...itemData({ allBranches: false, branchIds }) };
await yes('five-branch offer validates references within access limits', () => setDoc(doc(owner.db, path('commerceOffers', 'branches')), withMeta(offerData({ allBranches: false, branchIds }, branchItem))));
await yes('page admin can publish a five-branch offer', () => setDoc(doc(manager.db, path('commerceOffers', 'branches_manager')), withMeta(offerData({ allBranches: false, branchIds }, branchItem), manager)));
await yes('site admin can publish a five-branch offer', () => setDoc(doc(staffAdmin.db, path('commerceOffers', 'branches_admin')), withMeta(offerData({ allBranches: false, branchIds }, branchItem), staffAdmin)));
await no('missing branch rejected', () => updateDoc(doc(owner.db, path('commerceItems', 'branches')), { branchIds: ['missing_branch'], updatedAt: serverTimestamp() }));
await no('branch-scoped item cannot discount all branches', () => updateDoc(doc(owner.db, path('commerceOffers', 'branches')), { allBranches: true, branchIds: [], updatedAt: serverTimestamp() }));
const componentIds = [];
for (let i = 0; i < 5; i++) {
  const id = `${stamp}_component${i}`;
  componentIds.push(id);
  await setDoc(doc(owner.db, 'commerceItems', id), withMeta(itemData({ type: i % 2 ? 'service' : 'product', title: `Component ${i}` })));
}
await yes('five-component mixed product/service bundle validated', () => setDoc(doc(owner.db, path('commerceItems', 'bundle')), withMeta(itemData({ type: 'bundle', bundleItemIds: componentIds }))));
await no('bundle cannot contain another business item', () => setDoc(doc(stranger.db, path('commerceItems', 'bundle_forge')), withMeta(itemData({ businessId: otherId, type: 'bundle', bundleItemIds: componentIds }), stranger)));
await yes('item can be archived with existing offers', () => updateDoc(doc(owner.db, 'commerceItems', itemId), { status: 'archived', updatedAt: serverTimestamp() }));
await no('new discount cannot link archived item', () => setDoc(doc(owner.db, path('commerceOffers', 'archived_item')), withMeta(offerData())));
await yes('old offer can still be archived after item archive', () => updateDoc(doc(owner.db, path('commerceOffers', 'offer')), { status: 'archived', updatedAt: serverTimestamp() }));
await no('real item cannot be hard deleted', () => deleteDoc(doc(staffAdmin.db, 'commerceItems', itemId)));
await yes('admin cleanup can delete a demo item', () => deleteDoc(doc(staffAdmin.db, path('commerceItems', 'demo'))));

await no('business grant ID cannot impersonate another business', () => setDoc(doc(stranger.db, 'businessAdmins', `${businessId}_${stranger.uid}`), { businessId: otherId, userId: stranger.uid, role: 'owner' }));
await admin.doc(`businessAdmins/${businessId}_${stranger.uid}`).set({ businessId: otherId, userId: stranger.uid, role: 'owner' });
await no('malformed legacy grant does not grant business access', () => setDoc(doc(stranger.db, path('commerceItems', 'legacy_forge')), withMeta(itemData(), stranger)));
await yes('ordinary legacy business offer still works for owner', () => setDoc(doc(owner.db, path('businessOffers', 'legacy')), { businessId, title: 'Legacy offer', createdBy: owner.uid, ownerId: owner.uid, status: 'active', createdAt: serverTimestamp() }));
await no('legacy author-only forgery blocked', () => setDoc(doc(stranger.db, path('businessOffers', 'forged')), { businessId, title: 'Forged', createdBy: stranger.uid, ownerId: stranger.uid }));
await no('legacy offer cannot be moved onto another business', () => updateDoc(doc(owner.db, path('businessOffers', 'legacy')), { businessId: otherId }));

const menuPhotos = Array.from({ length: 20 }, (_, i) => ({ url: `https://example.com/menu-${i}.jpg`, imageAssetId: `geohub/menu/${i}` }));
await yes('owner may save twenty menu photo references', () => updateDoc(doc(owner.db, 'businesses', businessId), { menuPhotos }));
await no('twenty-first menu photo rejected', () => updateDoc(doc(owner.db, 'businesses', businessId), { menuPhotos: [...menuPhotos, menuPhotos[0]] }));
await no('unsafe menu image URL rejected', () => updateDoc(doc(owner.db, 'businesses', businessId), { menuPhotos: [{ url: 'javascript:alert(1)' }] }));
await no('invalid last menu photo rejected', () => updateDoc(doc(owner.db, 'businesses', businessId), { menuPhotos: [...menuPhotos.slice(0, 19), { url: 'javascript:alert(1)' }] }));
await no('stranger cannot replace menu photo list', () => updateDoc(doc(stranger.db, 'businesses', businessId), { menuPhotos: [] }));
await yes('menu photos may be cleared', () => updateDoc(doc(owner.db, 'businesses', businessId), { menuPhotos: [] }));

const place = (extra) => ({ name: 'Test place', createdBy: owner.uid, ...extra });
await yes('unknown place coordinates remain absent', () => setDoc(doc(owner.db, path('places', 'unknown')), place({})));
await yes('explicit null coordinate pair allowed', () => setDoc(doc(owner.db, path('places', 'null')), place({ lat: null, lng: null })));
await yes('zero coordinates preserved', () => setDoc(doc(owner.db, path('places', 'zero')), place({ lat: 0, lng: 0 })));
await no('partial coordinate pair rejected', () => setDoc(doc(owner.db, path('places', 'partial')), place({ lat: 41.7 })));
await no('out-of-range latitude rejected', () => setDoc(doc(owner.db, path('places', 'range')), place({ lat: 91, lng: 44.8 })));
await no('coordinate strings rejected', () => setDoc(doc(owner.db, path('places', 'strings')), place({ lat: '41.7', lng: '44.8' })));
await no('NaN coordinate rejected', () => setDoc(doc(owner.db, path('places', 'nan')), place({ lat: NaN, lng: 44.8 })));
await no('updating only one unknown coordinate rejected', () => updateDoc(doc(owner.db, path('places', 'unknown')), { lat: 41.7 }));
await yes('valid full coordinate update allowed', () => updateDoc(doc(owner.db, path('places', 'unknown')), { lat: 41.7, lng: 44.8 }));
await admin.doc(path('places', 'legacy_bad')).set(place({ lat: 'unknown', lng: null }));
await yes('descriptive update preserves legacy coordinate migration path', () => updateDoc(doc(owner.db, path('places', 'legacy_bad')), { name: 'Correct name' }));
await no('changing invalid legacy coordinates requires valid pair', () => updateDoc(doc(owner.db, path('places', 'legacy_bad')), { lng: 44.8 }));
await yes('legacy bad coordinates can be cleared honestly', () => updateDoc(doc(owner.db, path('places', 'legacy_bad')), { lat: null, lng: null }));

for (const entry of clients) await deleteApp(entry.app);
await deleteAdmin(adminApp);
console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
