// Isolated activity checks: real projection/normalizers, mocked Firestore and
// clock. No Firebase app, network, emulator or production data is initialized.
// Run: node --experimental-vm-modules web/tools/place-activity-check.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';

let now = 1800000000000;
let nextTimer = 0;
const timers = new Map();
const listeners = [];
class Clock extends Date { static now() { return now; } }
const context = createContext({
  Date: Clock,
  setTimeout: (run, delay) => { const id = ++nextTimer; timers.set(id, { run, at: now + delay }); return id; },
  clearTimeout: (id) => timers.delete(id),
});
function mock(exports) {
  return new SyntheticModule(Object.keys(exports), function () {
    for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
  }, { context });
}
const firebase = mock({
  collection: (_db, name) => name,
  query: (name, ...conditions) => ({ name, conditions }),
  where: (field, op, value) => ({ field, op, value }),
  orderBy: (field, direction) => ({ orderBy: field, direction }),
  limit: (count) => ({ limit: count }),
  onSnapshot: (request, data, error) => {
    const listener = { request, data, error, stopped: false };
    listeners.push(listener);
    return () => { listener.stopped = true; };
  },
});
const dependencies = new Map([
  ['firebase/firestore', firebase],
  [new URL('../src/lib/firebase.js', import.meta.url).href, mock({ db: {} })],
  [new URL('../src/lib/auth.js', import.meta.url).href, mock({ uid: { value: 'viewer' } })],
  [new URL('../src/lib/i18n.js', import.meta.url).href, mock({ lang: { value: 'ka' }, t: (s) => s, formatNumber: String })],
]);
async function load(url) {
  if (dependencies.has(url)) return dependencies.get(url);
  const mod = new SourceTextModule(await readFile(new URL(url), 'utf8'), { context, identifier: url });
  dependencies.set(url, mod);
  await mod.link((specifier, parent) => load(specifier === 'firebase/firestore' ? specifier : new URL(specifier, parent.identifier).href));
  return mod;
}
const activity = await load(new URL('../src/data/placeActivity.js', import.meta.url).href);
await activity.evaluate();
const { buildPlaceActivity, listenPlaceActivity, RECENT_CHECKIN_MS } = activity.namespace;
const ids = (records) => Array.from(records, (record) => record.id);
const place = { id: 'place-a', image: 'https://images.test/cover.jpg', photos: ['https://images.test/cover.jpg', 'https://images.test/gallery.jpg'], raw: { businessId: 'business-a' } };
const checkin = (id, data = {}) => ({ id, placeId: place.id, authorId: id, authorName: id, createdAt: now - 1000, ...data });
const story = (id, data = {}) => ({ id, placeId: place.id, authorId: id, authorName: id, closeFriends: false, createdAt: now - 1000, expiresAt: now + 60000, ...data });

const data = buildPlaceActivity(place, [
  checkin('old', { createdAt: now - RECENT_CHECKIN_MS - 1 }),
  checkin('latest', { authorId: 'same', createdAt: now - 500, photoUrl: 'https://images.test/checkin.jpg' }),
  checkin('previous', { authorId: 'same', createdAt: now - 2000 }),
  checkin('boundary', { createdAt: now - RECENT_CHECKIN_MS }),
  checkin('elsewhere', { placeId: 'place-b' }),
  checkin('deleted', { deleted: true }),
  checkin('private', { visibility: 'only_me', photoUrl: 'https://images.test/private.jpg' }),
  checkin('privacy', { privacy: 'friends' }),
  checkin('future', { createdAt: now + 1 }),
  checkin('pending-time', { createdAt: null }),
], [
  story('new', { authorId: 'same', createdAt: now - 100, mediaUrl: 'https://images.test/story.jpg', mediaType: 'image/jpeg' }),
  story('earlier', { authorId: 'same', createdAt: now - 500 }),
  story('new', { authorId: 'same' }),
  story('business', { placeId: '', businessId: 'business-a' }),
  story('unrelated-owner', { placeId: '', authorId: 'owner', businessId: 'business-b' }),
  story('private', { closeFriends: true, mediaUrl: 'https://images.test/private-story.jpg' }),
  story('missing-public', { closeFriends: undefined }),
  story('expired', { expiresAt: now }),
  story('expired-default', { createdAt: now - 86400001, expiresAt: undefined }),
  story('invalid-expiry', { expiresAt: 'broken-date' }),
  story('forever', { duration: 'forever', createdAt: now - 86400001, expiresAt: undefined }),
  story('future', { createdAt: now + 1 }),
  story('deleted', { status: 'deleted' }),
  story('group-only', { groupId: 'private-group' }),
  story('video', { mediaUrl: 'https://images.test/clip.mp4', mediaType: 'video/mp4' }),
  story('unsafe-url', { mediaUrl: 'javascript:alert(1)', mediaType: 'image' }),
], now);
assert.deepEqual(ids(data.checkins), ['latest', 'previous', 'boundary', 'old']);
assert.deepEqual(ids(data.recentCheckins), ['latest', 'boundary']);
assert.deepEqual(new Set(ids(data.stories)), new Set(['new', 'earlier', 'business', 'forever', 'video', 'unsafe-url']));
assert.deepEqual(ids(data.storyGroups.find((g) => g.authorId === 'same').stories), ['earlier', 'new']);
assert.deepEqual(Array.from(data.photos), ['https://images.test/cover.jpg', 'https://images.test/gallery.jpg', 'https://images.test/checkin.jpg', 'https://images.test/story.jpg']);

const states = [];
const errors = [];
const unsubscribe = listenPlaceActivity(place, (state) => states.push(state), (error, source) => errors.push({ error, source }));
assert.equal(states[0].loading, true);
assert.equal(listeners.length, 3);
for (const listener of listeners) {
  assert.ok(listener.request.conditions.some((c) => c.orderBy === 'createdAt' && c.direction === 'desc'));
  assert.ok(listener.request.conditions.some((c) => c.field === 'placeId' || c.field === 'businessId'));
  if (listener.request.name === 'stories') assert.ok(listener.request.conditions.some((c) => c.field === 'closeFriends' && c.value === false));
}
function send(listener, records) {
  listener.data({ docs: records.map((record) => ({ id: record.id, data: () => record })) });
}
send(listeners[0], [checkin('live', { createdAt: now - RECENT_CHECKIN_MS + 1000 })]);
send(listeners[1], [story('live-story', { expiresAt: now + 1000 })]);
send(listeners[2], []);
assert.equal(states.at(-1).loading, false);
assert.deepEqual(ids(states.at(-1).recentCheckins), ['live']);
now += 1001;
for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.run(); }
assert.equal(states.at(-1).recentCheckins.length, 0);
assert.equal(states.at(-1).stories.length, 0);
assert.equal(states.at(-1).checkins.length, 1);

const permissionError = new Error('permission-denied');
listeners[1].error(permissionError);
assert.equal(states.at(-1).errors.stories, permissionError);
assert.equal(states.at(-1).loading, false);
assert.equal(errors[0].source, 'stories');
assert.equal(errors[0].error, permissionError);
unsubscribe();
assert.ok(listeners.every((l) => l.stopped));
assert.equal(timers.size, 0);
const stoppedCount = states.length;
send(listeners[0], [checkin('late')]);
listeners[1].error(permissionError);
assert.equal(states.length, stoppedCount);
assert.equal(errors.length, 1);

const noBusinessStart = listeners.length;
const stopPlaceOnly = listenPlaceActivity({ ...place, raw: { ownerId: 'owner' } }, () => {});
assert.equal(listeners.length - noBusinessStart, 2, 'An owner ID must not create a business story subscription');
stopPlaceOnly();
console.log('Place activity: privacy, linkage, sort/dedup, image filtering, expiry, query scope, error and unsubscribe checks passed.');
