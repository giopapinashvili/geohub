// Security-rules check against the Firestore + Auth emulators.
// Every case runs as a real signed-in (or signed-out) client, so the rules in
// firestore.rules decide — both what must be allowed and what must be refused.
//
//   npm run test:rules
//   (= firebase emulators:exec --only auth,firestore --project demo-geohub "node web/tools/rules-check.mjs")

import { initializeApp as initAdmin } from 'firebase-admin/app';
import { getFirestore as adminDb, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, setDoc, updateDoc, addDoc, deleteField,
  collection, query, where, orderBy, limit, serverTimestamp,
} from 'firebase/firestore';

const PROJECT = 'demo-geohub';
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8085';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
const [FS_HOST, FS_PORT] = process.env.FIRESTORE_EMULATOR_HOST.split(':');

// Admin SDK bypasses the rules — used only to arrange the fixtures.
initAdmin({ projectId: PROJECT });
const admin = adminDb();

let pass = 0; let fail = 0;
const results = [];

/** A separate client app per person, each with its own sign-in. */
async function client(name, email) {
  const app = initializeApp({ apiKey: 'demo-key', projectId: PROJECT, authDomain: `${PROJECT}.firebaseapp.com` }, name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, FS_HOST, Number(FS_PORT));
  let uid = null;
  if (email) {
    const cred = await createUserWithEmailAndPassword(auth, email, 'geohub123');
    uid = cred.user.uid;
  }
  return { app, auth, db, uid, name };
}

async function allowed(label, fn) {
  try { await fn(); pass++; results.push(`  ok    ${label}`); }
  catch (e) { fail++; results.push(`  FAIL  ${label} — expected allowed, got ${e.code || e.message}`); }
}
async function denied(label, fn) {
  try { await fn(); fail++; results.push(`  FAIL  ${label} — expected permission-denied, but it was allowed`); }
  catch (e) {
    if (e.code === 'permission-denied') { pass++; results.push(`  ok    ${label} (refused)`); }
    else { fail++; results.push(`  FAIL  ${label} — expected permission-denied, got ${e.code || e.message}`); }
  }
}

const stamp = Date.now().toString(36);
const A = await client('a', `a${stamp}@test.ge`);   // author
const B = await client('b', `b${stamp}@test.ge`);   // A's friend
const C = await client('c', `c${stamp}@test.ge`);   // stranger
const D = await client('d', `d${stamp}@test.ge`);   // on A's close-friends list
const G = await client('guest', null);              // signed out
const pair = (x, y) => (x < y ? `${x}_${y}` : `${y}_${x}`);
const ts = (minAgo) => Timestamp.fromMillis(Date.now() - minAgo * 60000);

/* ── Fixtures ─────────────────────────────────────────────── */
await admin.doc(`friendships/${pair(A.uid, B.uid)}`).set({ users: [A.uid, B.uid].sort(), user1: [A.uid, B.uid].sort()[0], user2: [A.uid, B.uid].sort()[1], createdAt: ts(500) });
const post = (id, data) => admin.doc(`posts/${id}`).set({ authorId: A.uid, userId: A.uid, text: id, status: 'active', likeCount: 0, commentCount: 0, shareCount: 0, ...data });
await post('p_public', { visibility: 'public', createdAt: ts(10) });
await post('p_legacy', { createdAt: ts(11) }); // no visibility field = public
await post('p_friends', { visibility: 'friends', audienceIds: [A.uid, B.uid], createdAt: ts(12) });
await post('p_friends_old', { visibility: 'friends', createdAt: ts(13) }); // no audience list
await post('p_close', { visibility: 'close_friends', closeFriendIds: [A.uid, D.uid], createdAt: ts(14) });
await post('p_me', { visibility: 'onlyme', createdAt: ts(15) });
await admin.doc('posts/p_me/comments/c1').set({ authorId: A.uid, text: 'secret comment', createdAt: ts(15) });
await admin.doc('posts/p_public/comments/c1').set({ authorId: A.uid, text: 'hello', createdAt: ts(10) });

await admin.doc('groups/g_open').set({ name: 'Open', privacy: 'public', creatorId: C.uid, userId: C.uid, memberCount: 1, createdAt: ts(100) });
await admin.doc('groups/g_closed').set({ name: 'Closed', privacy: 'private', creatorId: C.uid, userId: C.uid, memberCount: 1, createdAt: ts(100) });
await admin.doc(`groupMembers/g_open_${C.uid}`).set({ groupId: 'g_open', uid: C.uid, userId: C.uid, role: 'admin', status: 'joined' });
await admin.doc(`groupMembers/g_closed_${C.uid}`).set({ groupId: 'g_closed', uid: C.uid, userId: C.uid, role: 'admin', status: 'joined' });
await post('p_group_closed', { visibility: 'group', groupId: 'g_closed', targetType: 'group', targetId: 'g_closed', authorId: C.uid, userId: C.uid, createdAt: ts(20) });

await admin.doc('stories/s_public').set({ authorId: A.uid, userId: A.uid, closeFriends: false, createdAt: ts(5), expiresAt: Timestamp.fromMillis(Date.now() + 3600000) });
await admin.doc('stories/s_close').set({ authorId: A.uid, userId: A.uid, closeFriends: true, closeFriendsList: [D.uid], createdAt: ts(6), expiresAt: Timestamp.fromMillis(Date.now() + 3600000) });

await admin.doc(`users/${C.uid}`).set({ uid: C.uid, fullName: 'C', username: `c${stamp}`, email: 'legacy@test.ge', phone: '+995 555 000 000', createdAt: Date.now() });
await admin.doc('rewards/r1').set({ title: 'Coffee', active: true, pointPrice: 50, businessId: '', createdAt: ts(50) });

/* ── Posts ────────────────────────────────────────────────── */
results.push('Posts');
await allowed('guest reads a public post', () => getDoc(doc(G.db, 'posts', 'p_public')));
await allowed('guest reads a legacy post without visibility', () => getDoc(doc(G.db, 'posts', 'p_legacy')));
await denied('guest reads an only-me post', () => getDoc(doc(G.db, 'posts', 'p_me')));
await denied('stranger reads an only-me post', () => getDoc(doc(C.db, 'posts', 'p_me')));
await allowed('author reads own only-me post', () => getDoc(doc(A.db, 'posts', 'p_me')));
await denied('stranger reads a friends-only post', () => getDoc(doc(C.db, 'posts', 'p_friends')));
await allowed('friend reads a friends-only post (audience list)', () => getDoc(doc(B.db, 'posts', 'p_friends')));
await allowed('friend reads an old friends-only post (friendship)', () => getDoc(doc(B.db, 'posts', 'p_friends_old')));
await denied('stranger reads a close-friends post', () => getDoc(doc(C.db, 'posts', 'p_close')));
await denied('friend not on the list reads a close-friends post', () => getDoc(doc(B.db, 'posts', 'p_close')));
await allowed('close friend reads a close-friends post', () => getDoc(doc(D.db, 'posts', 'p_close')));
await denied('non-member reads a private-group post', () => getDoc(doc(B.db, 'posts', 'p_group_closed')));
await allowed('group member reads a private-group post', () => getDoc(doc(C.db, 'posts', 'p_group_closed')));
await denied('stranger reads comments of an only-me post', () => getDocs(collection(C.db, 'posts', 'p_me', 'comments')));
await allowed('guest reads comments of a public post', () => getDocs(collection(G.db, 'posts', 'p_public', 'comments')));

results.push('Post queries the app runs');
await allowed('public feed query (guest)', () => getDocs(query(collection(G.db, 'posts'), where('visibility', '==', 'public'), orderBy('createdAt', 'desc'), limit(24))));
await denied('unconstrained feed query (stranger)', () => getDocs(query(collection(C.db, 'posts'), orderBy('createdAt', 'desc'), limit(24))));
await allowed('own posts query', () => getDocs(query(collection(A.db, 'posts'), where('authorId', '==', A.uid), orderBy('createdAt', 'desc'), limit(40))));
await allowed('shared-with-me query (audienceIds)', () => getDocs(query(collection(B.db, 'posts'), where('audienceIds', 'array-contains', B.uid), orderBy('createdAt', 'desc'), limit(40))));
await allowed('close-friends query (closeFriendIds)', () => getDocs(query(collection(D.db, 'posts'), where('closeFriendIds', 'array-contains', D.uid), orderBy('createdAt', 'desc'), limit(40))));
await denied('someone else\'s audience query', () => getDocs(query(collection(C.db, 'posts'), where('audienceIds', 'array-contains', B.uid), limit(10))));
await allowed('profile: friend lists friends posts', () => getDocs(query(collection(B.db, 'posts'), where('authorId', '==', A.uid), where('visibility', 'in', ['friends', 'followers']), limit(40))));
await denied('profile: stranger lists friends posts', () => getDocs(query(collection(C.db, 'posts'), where('authorId', '==', A.uid), where('visibility', 'in', ['friends', 'followers']), limit(40))));
await allowed('profile: public posts of someone', () => getDocs(query(collection(C.db, 'posts'), where('authorId', '==', A.uid), where('visibility', '==', 'public'), limit(40))));
await allowed('group wall: member lists members-only posts', () => getDocs(query(collection(C.db, 'posts'), where('groupId', '==', 'g_closed'), where('visibility', '==', 'group'), limit(40))));
await denied('group wall: non-member lists members-only posts', () => getDocs(query(collection(B.db, 'posts'), where('groupId', '==', 'g_closed'), where('visibility', '==', 'group'), limit(40))));

results.push('Writing posts');
await allowed('author changes audience and lists', () => updateDoc(doc(A.db, 'posts', 'p_public'), { visibility: 'friends', audienceIds: [A.uid, B.uid], closeFriendIds: [], updatedAt: serverTimestamp() }));
await denied('stranger edits someone\'s audience list', () => updateDoc(doc(C.db, 'posts', 'p_friends'), { audienceIds: [A.uid, B.uid, C.uid] }));

/* ── Stories ──────────────────────────────────────────────── */
results.push('Stories');
await allowed('public tray query', () => getDocs(query(collection(G.db, 'stories'), where('closeFriends', '==', false), orderBy('createdAt', 'desc'), limit(40))));
await denied('stranger reads a close-friends story', () => getDoc(doc(C.db, 'stories', 's_close')));
await allowed('listed friend reads a close-friends story', () => getDoc(doc(D.db, 'stories', 's_close')));
await denied('unconstrained story query (stranger)', () => getDocs(query(collection(C.db, 'stories'), orderBy('createdAt', 'desc'), limit(40))));

/* ── Users: public profile vs private account data ────────── */
results.push('Profiles and private data');
await denied('create own profile with an email field', () => setDoc(doc(A.db, 'users', A.uid), { uid: A.uid, fullName: 'A', email: 'a@test.ge', createdAt: Date.now() }));
await allowed('create own profile without private fields', () => setDoc(doc(A.db, 'users', A.uid), { uid: A.uid, fullName: 'A', username: `a${stamp}`, createdAt: Date.now() }));
await denied('add a phone number to the public profile', () => updateDoc(doc(A.db, 'users', A.uid), { phone: '+995 599 000 000' }));
await allowed('edit bio on the public profile', () => updateDoc(doc(A.db, 'users', A.uid), { bio: 'hi', updatedAt: Date.now() }));
await allowed('keep legacy private fields while editing something else', () => updateDoc(doc(C.db, 'users', C.uid), { bio: 'still here' }));
await allowed('move legacy private fields out (delete them)', () => updateDoc(doc(C.db, 'users', C.uid), { email: deleteField(), phone: deleteField() }));
await allowed('write own private account document', () => setDoc(doc(A.db, 'users', A.uid, 'private', 'account'), { email: 'a@test.ge', phone: '+995 599 000 000' }, { merge: true }));
await allowed('read own private account document', () => getDoc(doc(A.db, 'users', A.uid, 'private', 'account')));
await denied('stranger reads someone\'s private account document', () => getDoc(doc(C.db, 'users', A.uid, 'private', 'account')));
await denied('give yourself points on the profile', () => updateDoc(doc(A.db, 'users', A.uid), { pointsBalance: 99999 }));

/* ── Groups ───────────────────────────────────────────────── */
results.push('Groups');
const member = (who, gid, role) => setDoc(doc(who.db, 'groupMembers', `${gid}_${who.uid}`), { groupId: gid, uid: who.uid, userId: who.uid, role, status: 'joined', joinedAt: serverTimestamp() });
await denied('join an open group directly as admin', () => member(B, 'g_open', 'admin'));
await allowed('join an open group as a member', () => member(B, 'g_open', 'member'));
await denied('promote yourself to admin', () => updateDoc(doc(B.db, 'groupMembers', `g_open_${B.uid}`), { role: 'admin' }));
await denied('join a private group without approval', () => member(B, 'g_closed', 'member'));
await denied('approve your own join request', () => setDoc(doc(B.db, 'groupJoinRequests', `g_closed__${B.uid}`), { groupId: 'g_closed', userId: B.uid, status: 'approved', createdAt: serverTimestamp() }));
await allowed('ask to join a private group', () => setDoc(doc(B.db, 'groupJoinRequests', `g_closed__${B.uid}`), { groupId: 'g_closed', userId: B.uid, status: 'pending', createdAt: serverTimestamp() }));
await allowed('group admin approves the request', () => updateDoc(doc(C.db, 'groupJoinRequests', `g_closed__${B.uid}`), { status: 'approved', approvedBy: C.uid, approvedAt: serverTimestamp() }));
await allowed('approved person joins the private group', () => member(B, 'g_closed', 'member'));
await allowed('group admin makes a member moderator', () => updateDoc(doc(C.db, 'groupMembers', `g_open_${B.uid}`), { role: 'moderator', updatedAt: serverTimestamp() }));
await denied('moderator promotes themselves to admin', () => updateDoc(doc(B.db, 'groupMembers', `g_open_${B.uid}`), { role: 'admin' }));
await allowed('creator of a new group becomes its admin', async () => {
  const ref = await addDoc(collection(D.db, 'groups'), { name: 'New', privacy: 'public', creatorId: D.uid, userId: D.uid, memberCount: 1, postCount: 0, createdAt: serverTimestamp() });
  await member(D, ref.id, 'admin');
});

/* ── Friend requests ──────────────────────────────────────── */
results.push('Friend requests');
const reqId = `${C.uid}_${D.uid}`;
await allowed('send a friend request', () => setDoc(doc(C.db, 'friendRequests', reqId), { fromUserId: C.uid, toUserId: D.uid, fromUid: C.uid, toUid: D.uid, status: 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
await denied('sender marks own request accepted', () => updateDoc(doc(C.db, 'friendRequests', reqId), { status: 'accepted', updatedAt: serverTimestamp() }));
await denied('friendship without an accepted request', () => setDoc(doc(C.db, 'friendships', pair(C.uid, D.uid)), { users: [C.uid, D.uid].sort(), user1: [C.uid, D.uid].sort()[0], user2: [C.uid, D.uid].sort()[1], createdAt: serverTimestamp() }));
await allowed('recipient accepts', () => updateDoc(doc(D.db, 'friendRequests', reqId), { status: 'accepted', reviewedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
await allowed('friendship after acceptance', () => setDoc(doc(D.db, 'friendships', pair(C.uid, D.uid)), { users: [C.uid, D.uid].sort(), user1: [C.uid, D.uid].sort()[0], user2: [C.uid, D.uid].sort()[1], createdAt: serverTimestamp() }));
await denied('request under someone else\'s id', () => setDoc(doc(C.db, 'friendRequests', `${A.uid}_${B.uid}`), { fromUserId: C.uid, toUserId: B.uid, status: 'pending', createdAt: serverTimestamp() }));

/* ── Rewards, support ─────────────────────────────────────── */
results.push('Rewards and support');
await denied('mint a coupon for yourself', () => addDoc(collection(C.db, 'rewardCoupons'), { userId: C.uid, rewardId: 'r1', code: 'GH-FREE', status: 'active', createdAt: serverTimestamp() }));
await allowed('guest sends a support request', () => addDoc(collection(G.db, 'tickets'), { userId: '', name: 'Guest', email: 'guest@test.ge', category: 'account', subject: 'Cannot log in', message: 'I cannot log in to my account since yesterday.', status: 'open', page: '/support', lang: 'ka', createdAt: serverTimestamp() }));
await denied('support request with extra fields', () => addDoc(collection(G.db, 'tickets'), { userId: '', email: 'x@test.ge', category: 'help', subject: '', message: 'long enough message here', status: 'open', page: '/', lang: 'ka', createdAt: serverTimestamp(), isAdmin: true }));
await allowed('signed-in user asks to delete the account', () => addDoc(collection(A.db, 'tickets'), { userId: A.uid, name: 'A', email: 'a@test.ge', category: 'account_deletion', subject: 'Account deletion request', message: 'Please delete my GeoHub account and its data.', status: 'open', page: '/settings/account', lang: 'ka', createdAt: serverTimestamp() }));
await denied('support request pretending to be someone else', () => addDoc(collection(C.db, 'tickets'), { userId: A.uid, name: 'A', email: 'a@test.ge', category: 'help', subject: '', message: 'pretending to be someone else', status: 'open', page: '/', lang: 'ka', createdAt: serverTimestamp() }));

await signOut(A.auth).catch(() => {});
for (const c of [A, B, C, D, G]) await deleteApp(c.app).catch(() => {});

console.log(results.join('\n'));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
