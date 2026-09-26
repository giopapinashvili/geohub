// Seeds the local Firebase emulators with Georgian demo content.
// Never touches production: it refuses to run without emulator hosts.
//
//   npx firebase emulators:start --only auth,firestore --project demo-geohub
//   node web/tools/seed-emulator.mjs
//
// Test accounts (password: geohub123): nino@test.ge (main), giorgi@test.ge,
// ana@test.ge, admin@test.ge (admin).

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8085';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const PROJECT = 'demo-geohub';
if (!process.env.FIRESTORE_EMULATOR_HOST.startsWith('127.0.0.1') && !process.env.FIRESTORE_EMULATOR_HOST.startsWith('localhost')) {
  throw new Error('Refusing to seed a non-local Firestore.');
}

initializeApp({ projectId: PROJECT });
const db = getFirestore();
const auth = getAuth();

const NOW = Date.now();
const H = 3600000;
const D = 24 * H;
const ts = (msAgo) => Timestamp.fromMillis(NOW - msAgo);
// Local generated photos (web/tools/make-fixtures.mjs), picked by seed.
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const pic = (seed, w = 1080, h = 720) => (h > w ? `/fixtures/tall-${(hash(seed) % 6) + 1}.png` : `/fixtures/photo-${(hash(seed) % 24) + 1}.png`);
const face = (n) => `/fixtures/avatar-${(n % 9) + 1}.png`;

async function wipe() {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
}

const USERS = [
  { uid: 'u_nino', email: 'nino@test.ge', name: 'ნინო ბერიძე', username: 'nino.beridze', city: 'თბილისი', bio: 'ფოტოგრაფი და მოგზაური 📷 ყოველ შაბათს — ახალი ადგილი საქართველოში.', avatar: face(47), cover: pic('nino-cover', 1600, 600), geoId: 20417, points: 1250 },
  { uid: 'u_giorgi', email: 'giorgi@test.ge', name: 'გიორგი კაპანაძე', username: 'giorgi.k', city: 'ბათუმი', bio: 'ზღვა, ველოსიპედი და კარგი ყავა.', avatar: face(12), cover: pic('giorgi-cover', 1600, 600), geoId: 31552, points: 640 },
  { uid: 'u_ana', email: 'ana@test.ge', name: 'ანა ლომიძე', username: 'ana.lomidze', city: 'თბილისი', bio: 'ვწერ ქართულ სამზარეულოზე 🍷', avatar: face(32), cover: '', geoId: 44190, points: 310 },
  { uid: 'u_davit', email: 'davit@test.ge', name: 'დავით მამულაშვილი', username: 'davit.m', city: 'ქუთაისი', bio: 'მთა — ჩემი მეორე სახლია.', avatar: face(15), geoId: 50871, points: 90 },
  { uid: 'u_mariam', email: 'mariam@test.ge', name: 'მარიამ ჯაფარიძე', username: 'mariam.j', city: 'თელავი', bio: 'კახური ღვინის სამყარო 🍇', avatar: face(44), geoId: 61203, points: 470 },
  { uid: 'u_levan', email: 'levan@test.ge', name: 'ლევან ხუციშვილი', username: 'levan.kh', city: 'თბილისი', bio: 'დეველოპერი, ჯაზის მოყვარული.', avatar: face(53), geoId: 72355, points: 55 },
  { uid: 'u_tamar', email: 'tamar@test.ge', name: 'თამარ გელაშვილი', username: 'tamar.g', city: 'სიღნაღი', bio: '', avatar: '', geoId: 83921, points: 20 },
  { uid: 'u_luka', email: 'luka@test.ge', name: 'ლუკა წიკლაური', username: 'luka.ts', city: 'ყაზბეგი', bio: 'გიდი ყაზბეგში 🏔️', avatar: face(60), geoId: 94412, points: 880 },
  { uid: 'u_admin', email: 'admin@test.ge', name: 'GeoHub ადმინი', username: 'admin', city: 'თბილისი', bio: 'GeoHub-ის გუნდი', avatar: '', geoId: 10001, points: 0 },
];

async function seedUsers() {
  for (const u of USERS) {
    await auth.createUser({ uid: u.uid, email: u.email, password: 'geohub123', displayName: u.name, emailVerified: true, photoURL: u.avatar ? `http://127.0.0.1:5173${u.avatar}` : undefined });
    await db.doc(`users/${u.uid}`).set({
      id: u.uid, uid: u.uid, fullName: u.name, displayName: u.name, username: u.username, email: u.email,
      avatar: u.avatar, coverImage: u.cover || '', bio: u.bio, city: u.city, interests: ['მოგზაურობა', 'ფოტოგრაფია'],
      accountType: 'Explorer', explorerLevel: 'New Explorer', badges: [], followers: 0, following: 0, postsCount: 0,
      visitedPlaces: 3, isFirebaseUser: true, geoId: u.geoId, pointsBalance: u.points, xp: u.points * 2,
      verified: u.uid === 'u_nino' || u.uid === 'u_luka', online: ['u_giorgi', 'u_ana', 'u_luka'].includes(u.uid),
      lastSeen: ts(u.uid === 'u_giorgi' ? 60000 : 3 * H), createdAt: NOW - 60 * D, updatedAt: NOW - D,
    });
    await db.doc(`usernames/${u.username}`).set({ uid: u.uid, createdAt: NOW - 60 * D });
    await db.doc(`geoIds/${u.geoId}`).set({ uid: u.uid, assignedAt: NOW - 60 * D });
  }
  await db.doc('admins/u_admin').set({ role: 'admin', createdAt: ts(90 * D) });
  // A garbled demo user the app must hide.
  await db.doc('users/seed_broken').set({ fullName: 'ვასო ტყ��ბუჩავა', isSeedUser: true, username: 'broken_seed' });
}

const pair = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);

async function seedGraph() {
  const friends = [['u_nino', 'u_giorgi'], ['u_nino', 'u_ana'], ['u_nino', 'u_luka'], ['u_giorgi', 'u_ana'], ['u_mariam', 'u_ana']];
  for (const [a, b] of friends) {
    await db.doc(`friendRequests/${a}_${b}`).set({ fromUserId: a, toUserId: b, fromUid: a, toUid: b, status: 'accepted', createdAt: ts(20 * D), updatedAt: ts(19 * D) });
    await db.doc(`friends/${pair(a, b)}`).set({ users: [a, b], userA: a, userB: b, createdAt: ts(19 * D) });
  }
  await db.doc('friendRequests/u_davit_u_nino').set({ fromUserId: 'u_davit', toUserId: 'u_nino', fromUid: 'u_davit', toUid: 'u_nino', status: 'pending', fromName: 'დავით მამულაშვილი', fromAvatar: face(15), toName: 'ნინო ბერიძე', createdAt: ts(5 * H), updatedAt: ts(5 * H) });
  await db.doc('friendRequests/u_levan_u_nino').set({ fromUserId: 'u_levan', toUserId: 'u_nino', fromUid: 'u_levan', toUid: 'u_nino', status: 'pending', fromName: 'ლევან ხუციშვილი', fromAvatar: face(53), toName: 'ნინო ბერიძე', createdAt: ts(2 * D), updatedAt: ts(2 * D) });
  await db.doc('friendRequests/u_nino_u_mariam').set({ fromUserId: 'u_nino', toUserId: 'u_mariam', fromUid: 'u_nino', toUid: 'u_mariam', status: 'pending', fromName: 'ნინო ბერიძე', toName: 'მარიამ ჯაფარიძე', toAvatar: face(44), createdAt: ts(D), updatedAt: ts(D) });
  const follows = [['u_nino', 'u_luka'], ['u_nino', 'u_mariam'], ['u_giorgi', 'u_nino'], ['u_ana', 'u_nino'], ['u_luka', 'u_nino'], ['u_tamar', 'u_nino'], ['u_levan', 'u_giorgi']];
  for (const [a, b] of follows) await db.doc(`follows/${a}_${b}`).set({ followerId: a, followingId: b, createdAt: ts(10 * D) });
}

const POSTS = [
  { id: 'p_kazbegi', by: 'u_luka', text: 'გერგეტის სამება დილის 6 საათზე — ღრუბლები ფეხქვეშ. ვინ წამოვა შემდეგ შაბათს? 🏔️ #ყაზბეგი #მთა', media: [pic('kazbegi-1'), pic('kazbegi-2'), pic('kazbegi-3')], ago: 2 * H, likes: 128, comments: 3 },
  { id: 'p_supra', by: 'u_ana', text: 'დღეს ბებიას რეცეპტით ვაკეთებ ჩაქაფულს. ტარხუნი, ტყემალი, ახალგაზრდა ხორცი… გემრიელ სადილს გისურვებთ! 🍲', media: [pic('chakapuli')], ago: 5 * H, likes: 64, comments: 2 },
  { id: 'p_batumi', by: 'u_giorgi', text: 'ბათუმის ბულვარზე ველოსიპედით — საუკეთესო საღამო 🚲🌅', media: [pic('batumi-sunset')], ago: 9 * H, likes: 41, comments: 1, feeling: 'ბედნიერი' },
  { id: 'p_poll', by: 'u_nino', text: 'სად წავიდეთ შემოდგომის ფოტოტურზე?', type: 'poll', poll: { question: 'სად წავიდეთ შემოდგომის ფოტოტურზე?', options: [{ id: '0', text: 'რაჭა', votes: 14 }, { id: '1', text: 'სვანეთი', votes: 22 }, { id: '2', text: 'თუშეთი', votes: 9 }], totalVotes: 45 }, ago: 12 * H, likes: 18, comments: 0 },
  { id: 'p_text', by: 'u_mariam', text: 'რთველი დაიწყო! წელს საფერავი განსაკუთრებით ტკბილია. თელავში ვინ ხართ? 🍇🍷', bg: 'sunset', ago: 26 * H, likes: 77, comments: 0 },
  { id: 'p_nino_trip', by: 'u_nino', text: 'უფლისციხე — სამი ათასი წლის ქალაქი კლდეში. ისტორია ყოველ ქვაში იგრძნობა.', media: [pic('uplistsikhe-1'), pic('uplistsikhe-2')], ago: 2 * D, likes: 203, comments: 1, location: { name: 'უფლისციხე', placeId: 'pl_uplistsikhe' } },
  { id: 'p_levan', by: 'u_levan', text: 'ხვალ ფაბრიკაში ჯაზის საღამოა. თავისუფალი შესვლა 🎷', ago: 3 * D, likes: 12, comments: 0 },
  { id: 'p_davit', by: 'u_davit', text: 'სათაფლიის მღვიმე ბავშვებთან ერთად — დინოზავრების კვალი ნამდვილად შთამბეჭდავია! 🦕', media: [pic('sataplia')], ago: 4 * D, likes: 35, comments: 0 },
  { id: 'p_friends_only', by: 'u_giorgi', text: 'მხოლოდ მეგობრებისთვის: შაბათს ჩემთან ვიკრიბებით 🎉', visibility: 'friends', ago: 5 * D, likes: 3, comments: 0 },
  { id: 'p_tamar', by: 'u_tamar', text: 'სიღნაღის ქუჩები წვიმის შემდეგ ☔', media: [pic('sighnaghi', 1080, 1350)], ago: 6 * D, likes: 22, comments: 0 },
  { id: 'p_private', by: 'u_mariam', text: 'ეს მხოლოდ მე უნდა ვნახო', visibility: 'onlyme', ago: 6 * D, likes: 0, comments: 0 },
  { id: 'p_broken', by: 'seed_broken', text: 'ფოტოგრაფია: გარდაბნი�� ველები', isSeedPost: true, ago: 30 * 60000, likes: 400, comments: 0 },
];

const U = Object.fromEntries(USERS.map((u) => [u.uid, u]));

async function seedPosts() {
  for (const p of POSTS) {
    const a = U[p.by] || { name: 'ვასო', avatar: '' };
    await db.doc(`posts/${p.id}`).set({
      text: p.text, mediaUrl: p.media?.[0] || null, mediaUrls: p.media || [], mediaType: null,
      authorId: p.by, userId: p.by, createdByUid: p.by, authorName: a.name, authorAvatar: a.avatar || '',
      authorType: 'user', businessId: null, likeCount: p.likes, reactionCount: p.likes, commentCount: p.comments,
      shareCount: Math.floor(p.likes / 10), viewCount: p.likes * 11, visibility: p.visibility || 'public',
      status: 'active', targetType: 'user', targetId: p.by, feeling: p.feeling || '', type: p.type || null,
      poll: p.poll || null, bgGradient: p.bg || null, location: p.location || null, taggedUsers: [], taggedUserIds: [],
      createdAt: ts(p.ago), ...(p.isSeedPost ? { isSeedPost: true } : {}),
    });
  }
  // Comments with replies and reactions.
  const c = (post, id, by, text, ago, replies = []) => ({ post, id, by, text, ago, replies });
  const comments = [
    c('p_kazbegi', 'c1', 'u_nino', 'წარმოუდგენელი ხედია! მეც მინდა 😍', 90 * 60000, [{ by: 'u_luka', text: 'მოდი, ადგილს დაგიტოვებ 🙂', ago: 80 * 60000 }]),
    c('p_kazbegi', 'c2', 'u_giorgi', 'რომელ საათზე გადიხართ თბილისიდან?', 70 * 60000),
    c('p_kazbegi', 'c3', 'u_ana', 'სამება ყველაზე ლამაზია სწორედ ასე, ნისლში.', 30 * 60000),
    c('p_supra', 'c4', 'u_mariam', 'ტყემალი აუცილებლად მწვანე! 👌', 4 * H, [{ by: 'u_ana', text: 'რა თქმა უნდა 😄', ago: 3 * H }]),
    c('p_supra', 'c5', 'u_nino', 'რეცეპტი გამიზიარე, გთხოვ!', 3 * H),
    c('p_batumi', 'c6', 'u_nino', 'ბათუმი მენატრება 💙', 8 * H),
    c('p_nino_trip', 'c7', 'u_davit', 'შესანიშნავი კადრებია!', 40 * H),
  ];
  for (const cm of comments) {
    const a = U[cm.by];
    await db.doc(`posts/${cm.post}/comments/${cm.id}`).set({
      text: cm.text, voiceUrl: '', authorId: cm.by, userId: cm.by, createdByUid: cm.by, authorType: 'user',
      authorName: a.name, authorAvatar: a.avatar || '', businessId: null, likes: 0, reactionCount: cm.id === 'c1' ? 4 : 0,
      replyCount: cm.replies.length, status: 'active', createdAt: ts(cm.ago), updatedAt: ts(cm.ago),
    });
    let i = 0;
    for (const r of cm.replies) {
      const ra = U[r.by];
      await db.doc(`posts/${cm.post}/comments/${cm.id}/replies/r${++i}`).set({
        postId: cm.post, commentId: cm.id, text: r.text, authorId: r.by, userId: r.by, createdByUid: r.by,
        authorType: 'user', authorName: ra.name, authorAvatar: ra.avatar || '', businessId: null, likeCount: 0, status: 'active', createdAt: ts(r.ago),
      });
    }
  }
  await db.doc('posts/p_kazbegi/reactions/u_giorgi').set({ userId: 'u_giorgi', type: 'love', createdAt: ts(H) });
  await db.doc('posts/p_kazbegi/reactions/u_ana').set({ userId: 'u_ana', type: 'wow', createdAt: ts(H) });
  await db.doc('posts/p_supra/likes/u_nino').set({ uid: 'u_nino', userId: 'u_nino', createdAt: ts(4 * H) });
  await db.doc('posts/p_poll/pollVotes/u_giorgi').set({ optionId: '1', uid: 'u_giorgi', userId: 'u_giorgi', createdAt: ts(10 * H) });
  await db.doc('savedItems/u_nino_post_p_kazbegi').set({ uid: 'u_nino', userId: 'u_nino', type: 'post', itemId: 'p_kazbegi', postId: 'p_kazbegi', createdAt: ts(H) });
}

async function seedStories() {
  const stories = [
    { id: 's1', by: 'u_luka', mediaUrl: pic('story-luka', 720, 1280), text: '', ago: 2 * H },
    { id: 's2', by: 'u_luka', mediaUrl: null, text: 'დღეს ყაზბეგში -3° ❄️', bg: 'ocean', ago: 90 * 60000 },
    { id: 's3', by: 'u_giorgi', mediaUrl: pic('story-giorgi', 720, 1280), text: 'ბათუმი 🌊', ago: 4 * H },
    { id: 's4', by: 'u_ana', mediaUrl: pic('story-ana', 720, 1280), text: '', ago: 7 * H, viewedBy: ['u_nino'] },
    { id: 's5', by: 'u_mariam', mediaUrl: pic('story-mariam', 720, 1280), text: 'რთველი 🍇', ago: 10 * H },
  ];
  for (const s of stories) {
    const a = U[s.by];
    await db.doc(`stories/${s.id}`).set({
      text: s.text, mediaUrl: s.mediaUrl, authorId: s.by, userId: s.by, authorName: a.name, authorAvatar: a.avatar || '',
      createdAt: ts(s.ago), expiresAt: Timestamp.fromMillis(NOW - s.ago + D), duration: '24h', viewedBy: s.viewedBy || [], viewCount: (s.viewedBy || []).length,
      ...(s.bg ? { bg: s.bg } : {}),
    });
  }
}

async function seedPlaces() {
  const cats = [
    ['nature', '🏞️ ბუნება', 'Nature', 10], ['history', '🏛️ ისტორია', 'History', 20], ['food', '🍽️ კვება', 'Food', 30],
    ['wine', '🍷 ღვინო', 'Wine', 40], ['beach', '🏖️ სანაპირო', 'Beach', 50], ['city', '🏙️ ქალაქი', 'City', 60],
  ];
  for (const [id, ka, en, sort] of cats) await db.doc(`placeCategories/${id}`).set({ labelKa: ka, labelEn: en, icon: ka.split(' ')[0], active: true, sortOrder: sort });
  const places = [
    ['pl_gergeti', 'გერგეტის სამება', 'nature', 'ყაზბეგი', 42.6624, 44.6206, 'XIV საუკუნის ეკლესია მყინვარწვერის ძირას.'],
    ['pl_uplistsikhe', 'უფლისციხე', 'history', 'გორი', 41.9676, 44.2076, 'კლდეში ნაკვეთი უძველესი ქალაქი.'],
    ['pl_narikala', 'ნარიყალა', 'history', 'თბილისი', 41.6878, 44.8085, 'ციხე-სიმაგრე ძველი თბილისის თავზე.'],
    ['pl_boulevard', 'ბათუმის ბულვარი', 'beach', 'ბათუმი', 41.6512, 41.6360, 'ზღვისპირა პარკი და ველობილიკი.'],
    ['pl_sataplia', 'სათაფლიის ნაკრძალი', 'nature', 'ქუთაისი', 42.3106, 42.6750, 'მღვიმე და დინოზავრების ნაკვალევი.'],
    ['pl_sighnaghi', 'სიღნაღის გალავანი', 'city', 'სიღნაღი', 41.6207, 45.9220, 'სიყვარულის ქალაქის ძველი კედლები.'],
    ['pl_khareba', 'ხარებას მარანი', 'wine', 'ქვარელი', 41.9543, 45.8056, 'გვირაბში მოწყობილი ღვინის მარანი.'],
    ['pl_fabrika', 'ფაბრიკა', 'city', 'თბილისი', 41.7093, 44.8025, 'ყოფილი ქარხანა — ახლა კაფეები და სივრცეები.'],
    ['pl_martvili', 'მარტვილის კანიონი', 'nature', 'მარტვილი', 42.4570, 42.3770, 'ზურმუხტისფერი წყალი და ნავით გასეირნება.'],
    ['pl_prometheus', 'პრომეთეს მღვიმე', 'nature', 'წყალტუბო', 42.3767, 42.6006, 'ერთ-ერთი ყველაზე დიდი მღვიმე საქართველოში.'],
  ];
  let i = 0;
  for (const [id, name, cat, city, lat, lng, desc] of places) {
    await db.doc(`places/${id}`).set({
      name, title: name, category: cat, categoryId: cat, city, lat, lng, description: desc, address: city,
      coverImage: pic(`place-${id}`, 1200, 800), photos: [pic(`place-${id}-a`), pic(`place-${id}-b`)],
      rating: 4.3 + (i % 6) / 10, reviewCount: 12 + i * 3, checkinCount: 40 + i * 17, saveCount: 10 + i * 5,
      status: 'active', creatorId: 'u_admin', userId: 'u_admin', createdAt: ts((30 + i) * D),
    });
    i++;
  }
  await db.doc('placeReviews/pr1').set({ placeId: 'pl_gergeti', userId: 'u_nino', userName: 'ნინო ბერიძე', userPhoto: U.u_nino.avatar, rating: 5, comment: 'ყველამ უნდა ნახოს ერთხელ მაინც.', createdAt: ts(3 * D) });
  await db.doc('placeReviews/pr2').set({ placeId: 'pl_gergeti', userId: 'u_giorgi', userName: 'გიორგი კაპანაძე', userPhoto: U.u_giorgi.avatar, rating: 4, comment: 'გზა ცოტა რთულია, მაგრამ ღირს.', createdAt: ts(8 * D) });
  await db.doc('checkins/ck1').set({ placeId: 'pl_gergeti', placeName: 'გერგეტის სამება', authorId: 'u_nino', userId: 'u_nino', authorName: 'ნინო ბერიძე', xpAwarded: 50, createdAt: ts(6 * D) });
}

async function seedGroups() {
  const groups = [
    { id: 'g_hikers', name: 'საქართველოს ლაშქრობები', category: 'travel', privacy: 'public', owner: 'u_luka', desc: 'ლაშქრობები, მარშრუტები და მთის ამბები. შემოგვიერთდით!', members: ['u_luka', 'u_nino', 'u_davit', 'u_giorgi'] },
    { id: 'g_food', name: 'ქართული სამზარეულო', category: 'food', privacy: 'public', owner: 'u_ana', desc: 'რეცეპტები ბებიების რვეულებიდან.', members: ['u_ana', 'u_mariam'] },
    { id: 'g_photo', name: 'თბილისის ფოტოგრაფები', category: 'art', privacy: 'private', owner: 'u_nino', desc: 'დახურული ჯგუფი ფოტოგრაფებისთვის.', members: ['u_nino', 'u_levan'] },
  ];
  for (const g of groups) {
    await db.doc(`groups/${g.id}`).set({
      name: g.name, description: g.desc, category: g.category, coverUrl: pic(`group-${g.id}`, 1600, 600), privacy: g.privacy,
      location: 'საქართველო', tags: [], rules: ['პატივისცემა ყველას მიმართ', 'სპამი აკრძალულია'], joinQuestions: [], pinnedPostIds: [],
      postApproval: false, inviteToken: null, inviteEnabled: false, creatorId: g.owner, userId: g.owner,
      creatorName: U[g.owner].name, creatorAvatar: U[g.owner].avatar || '', memberCount: g.members.length, postCount: 1, createdAt: ts(40 * D),
    });
    for (const m of g.members) {
      await db.doc(`groupMembers/${g.id}_${m}`).set({ groupId: g.id, groupName: g.name, uid: m, userId: m, role: m === g.owner ? 'admin' : 'member', status: 'joined', joinedAt: ts(30 * D), createdAt: ts(30 * D) });
    }
  }
  await db.doc('posts/gp_1').set({
    text: 'შაბათს მივდივართ თრუსოს ხეობაში. შეკრება 7:00-ზე, ვაგზლის მოედანი. 🥾', mediaUrl: pic('truso'), mediaUrls: [pic('truso')],
    authorId: 'u_luka', userId: 'u_luka', createdByUid: 'u_luka', authorName: U.u_luka.name, authorAvatar: U.u_luka.avatar,
    authorType: 'user', likeCount: 9, commentCount: 0, shareCount: 0, visibility: 'public', status: 'active',
    targetType: 'group', targetId: 'g_hikers', groupId: 'g_hikers', groupPrivacy: 'public', createdAt: ts(20 * H),
  });
}

async function seedBusinesses() {
  const biz = [
    { id: 'b_cafe', title: 'კაფე ვერა', category: 'კაფე', city: 'თბილისი', owner: 'u_nino', desc: 'სპეშელთი ყავა და ბრანჩი ვერაზე. ყოველდღე 09:00–22:00.', rating: 4.8, reviews: 2 },
    { id: 'b_winery', title: 'თელავის მარანი', category: 'ღვინის მარანი', city: 'თელავი', owner: 'u_mariam', desc: 'ოჯახური მარანი, დეგუსტაცია და ტურები ვენახში.', rating: 4.9, reviews: 1 },
    { id: 'b_guide', title: 'ყაზბეგის გიდი', category: 'ტურიზმი', city: 'ყაზბეგი', owner: 'u_luka', desc: 'მთის ტურები, ლაშქრობები და ტრანსფერი.', rating: 4.7, reviews: 0 },
  ];
  for (const b of biz) {
    await db.doc(`businesses/${b.id}`).set({
      title: b.title, name: b.title, description: b.desc, category: b.category, tags: [b.category], plan: 'free', status: 'active', verified: b.id === 'b_winery',
      ownerId: b.owner, ownerName: U[b.owner].name, ownerEmail: U[b.owner].email, businessType: 'physical', isOnline: false,
      city: b.city, address: `${b.city}, მთავარი ქ. 12`, phone: '+995 555 12 34 56', email: `info@${b.id}.ge`, website: `https://${b.id}.ge`,
      socialLinks: { instagram: '', facebook: '', whatsapp: '' }, coverUrl: pic(`biz-${b.id}`, 1600, 600), logoUrl: pic(`logo-${b.id}`, 300, 300),
      priceRange: '₾₾', workingHours: null, followerCount: 120, postCount: 1, reviewCount: b.reviews, viewCount: 900,
      ratingAverage: b.rating, ratingTotal: b.rating * b.reviews, ratingCount: b.reviews, createdAt: ts(50 * D), updatedAt: ts(D),
    });
    await db.doc(`businessAdmins/${b.id}_${b.owner}`).set({ businessId: b.id, userId: b.owner, role: 'owner', createdAt: ts(50 * D) });
    await db.doc(`businesses/${b.id}/services/s1`).set({ title: 'ძირითადი მომსახურება', description: 'დეტალები ადგილზე.', price: '25', currency: 'GEL', category: '', status: 'active', order: 0, createdBy: b.owner, createdAt: ts(40 * D), updatedAt: ts(40 * D) });
  }
  await db.doc('businessReviews/br1').set({ businessId: 'b_cafe', userId: 'u_giorgi', userName: 'გიორგი კაპანაძე', userAvatarUrl: U.u_giorgi.avatar, rating: 5, text: 'საუკეთესო ფლეტ უაიტი თბილისში!', status: 'active', helpful: 3, reported: false, createdAt: ts(4 * D), updatedAt: ts(4 * D) });
  await db.doc('businessReviews/br2').set({ businessId: 'b_cafe', userId: 'u_ana', userName: 'ანა ლომიძე', userAvatarUrl: U.u_ana.avatar, rating: 4, text: 'მყუდრო ადგილია, ოღონდ შაბათობით ხალხმრავლობაა.', status: 'active', helpful: 1, reported: false, createdAt: ts(9 * D), updatedAt: ts(9 * D) });
  await db.doc('businessFollowers/b_cafe_u_giorgi').set({ businessId: 'b_cafe', userId: 'u_giorgi', createdAt: ts(4 * D) });
  await db.doc('posts/bp_1').set({
    text: 'ახალი შემოდგომის მენიუ უკვე ხელმისაწვდომია! ☕🍂 გოგრის ლატე და ხაჭაპური ბრიოშზე.', mediaUrl: pic('cafe-menu'), mediaUrls: [pic('cafe-menu')],
    authorId: 'u_nino', userId: 'u_nino', createdByUid: 'u_nino', authorName: 'კაფე ვერა', authorAvatar: pic('logo-b_cafe', 300, 300),
    authorType: 'business', businessId: 'b_cafe', likeCount: 31, commentCount: 0, shareCount: 2, visibility: 'public', status: 'active',
    targetType: 'business', targetId: 'b_cafe', createdAt: ts(30 * H),
  });
}

async function seedEvents() {
  const iso = (msAhead) => new Date(NOW + msAhead).toISOString().slice(0, 16);
  const events = [
    ['e_jazz', 'ჯაზის საღამო ფაბრიკაში', 'music', 'თბილისი', 'ფაბრიკა', iso(2 * D), 0, 'ცოცხალი ჯაზი ეზოში. შესვლა თავისუფალია.'],
    ['e_rtveli', 'რთველი თელავში', 'food', 'თელავი', 'თელავის მარანი', iso(6 * D), 45, 'ყურძნის კრეფა, სუფრა და ღვინის დეგუსტაცია.'],
    ['e_hike', 'ლაშქრობა თრუსოს ხეობაში', 'outdoor', 'ყაზბეგი', 'სნო', iso(9 * D), 30, 'საშუალო სირთულის ლაშქრობა გიდთან ერთად.'],
    ['e_film', 'ქართული კინოს კვირეული', 'culture', 'ბათუმი', 'აპოლო', iso(15 * D), 10, 'კლასიკური ქართული ფილმები რესტავრირებული ასლებით.'],
  ];
  for (const [id, title, category, city, venue, date, price, description] of events) {
    await db.doc(`events/${id}`).set({ title, name: title, category, city, venue, date, ticketPrice: price, capacity: 120, description, imageUrl: pic(`event-${id}`, 1200, 630), status: 'active', ownerId: 'u_admin', userId: 'u_admin', createdBy: 'u_admin', createdAt: ts(10 * D), updatedAt: ts(10 * D) });
  }
  await db.doc('eventParticipants/e_jazz_u_giorgi').set({ eventId: 'e_jazz', eventName: 'ჯაზის საღამო ფაბრიკაში', uid: 'u_giorgi', userId: 'u_giorgi', status: 'going', joinedAt: ts(D), createdAt: ts(D) });
}

async function seedVideos() {
  await db.doc('channels/ch_travel').set({ name: 'საქართველოს გზებზე', description: 'სამოგზაურო ვლოგები საქართველოდან.', ownerId: 'u_luka', avatar: pic('ch-travel', 300, 300), banner: pic('ch-travel-banner', 1600, 400), subscriberCount: 12400, videoCount: 4, youtubeUrl: '', createdAt: ts(80 * D) });
  await db.doc('channels/ch_food').set({ name: 'ანას სამზარეულო', description: 'ქართული კერძები ნაბიჯ-ნაბიჯ.', ownerId: 'u_ana', avatar: pic('ch-food', 300, 300), banner: pic('ch-food-banner', 1600, 400), subscriberCount: 3100, videoCount: 2, youtubeUrl: '', createdAt: ts(70 * D) });
  const vids = [
    ['v1', 'ყაზბეგი ზამთარში — სრული მარშრუტი', 'ch_travel', 'u_luka', 'aqz-KE-bpKQ', false, 3 * D],
    ['v2', 'სვანეთის კოშკები დრონით', 'ch_travel', 'u_luka', 'LXb3EKWsInQ', false, 5 * D],
    ['v3', 'ხინკლის საიდუმლო', 'ch_food', 'u_ana', 'ysz5S6PUM-U', false, 7 * D],
    ['v4', 'ბათუმის ღამე', 'ch_travel', 'u_luka', 'jNQXAC9IVRw', false, 9 * D],
    ['v5', 'მწვადი ცეცხლზე 🔥', 'ch_food', 'u_ana', 'dQw4w9WgXcQ', true, 2 * D],
    ['v6', 'გერგეტი 30 წამში', 'ch_travel', 'u_luka', 'M7lc1UVf-VE', true, 3 * D],
    ['v7', 'თბილისის სახურავები', 'ch_travel', 'u_luka', '9bZkp7q19f0', true, 4 * D],
  ];
  for (const [id, title, ch, by, yt, isShort, ago] of vids) {
    await db.doc(`videos/${id}`).set({
      title, description: 'GeoHub-ის სატესტო ვიდეო.', channelId: ch, channelName: ch === 'ch_food' ? 'ანას სამზარეულო' : 'საქართველოს გზებზე',
      authorId: by, authorName: U[by].name, authorAvatar: U[by].avatar || '', youtubeId: yt, youtubeUrl: `https://www.youtube.com/watch?v=${yt}`,
      thumbnail: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`, isShort, status: 'active', likeCount: 40, viewCount: 1500, commentCount: 1,
      category: ch === 'ch_food' ? 'food' : 'travel', city: '', tags: [], placeId: null, placeName: null, businessId: null, businessName: null, createdAt: ts(ago),
    });
  }
  await db.doc('videos/v1/comments/vc1').set({ text: 'ძალიან კარგი მარშრუტია!', authorId: 'u_nino', authorName: U.u_nino.name, authorAvatar: U.u_nino.avatar, createdAt: ts(2 * D) });
}

async function seedNeeds() {
  const needs = [
    ['n1', 'u_giorgi', 'მჭირდება ელექტრიკოსი საბურთალოზე, შაბათს. სამზარეულოში როზეტები უნდა გამოიცვალოს.', 'repair', 'თბილისი', 80, 'week'],
    ['n2', 'u_ana', 'ვეძებ ფოტოგრაფს ნათლობისთვის, 2 საათით. სასურველია პორტფოლიოს ნახვა.', 'events', 'თბილისი', 300, 'week'],
    ['n3', 'u_levan', 'მჭირდება ინგლისურის მასწავლებელი ბავშვისთვის, კვირაში 2-ჯერ, ონლაინ ან ვაკეში.', 'education', 'თბილისი', 0, 'flexible'],
    ['n4', 'u_mariam', 'ტრანსფერი ქუთაისის აეროპორტიდან ბათუმში, პარასკევს 23:00-ზე, 3 ადამიანი.', 'transport', 'ბათუმი', 150, 'asap'],
  ];
  let i = 0;
  for (const [id, by, text, category, city, budget, when] of needs) {
    await db.doc(`posts/${id}`).set({
      type: 'need', text, need: { category, city, budget, when, status: 'open' }, authorId: by, userId: by, createdByUid: by,
      authorName: U[by].name, authorAvatar: U[by].avatar || '', authorType: 'user', city, likeCount: 0, commentCount: i, shareCount: 0,
      visibility: 'public', status: 'active', targetType: 'user', targetId: by, createdAt: ts((2 + i * 5) * H),
    });
    i++;
  }
  await db.doc('businessOffers/o1').set({ businessId: 'b_cafe', title: '−20% ყველა ყავაზე სამშაბათს', description: 'მხოლოდ ადგილზე.', startsAt: '', endsAt: '', createdBy: 'u_nino', ownerId: 'u_nino', status: 'active', createdAt: ts(D) });
  await db.doc('businessOffers/o2').set({ businessId: 'b_winery', title: 'დეგუსტაცია ორისთვის — 1+1', description: '', startsAt: '', endsAt: '', createdBy: 'u_mariam', ownerId: 'u_mariam', status: 'active', createdAt: ts(D) });
}

async function seedMarket() {
  const items = [
    ['m1', 'Canon EOS R6 კამერა', 'item', 3800, 'თბილისი', 'u_nino', 'კარგ მდგომარეობაში, 2 ობიექტივით.'],
    ['m2', 'ველოსიპედი Trek Marlin 5', 'item', 1200, 'ბათუმი', 'u_giorgi', 'ორი სეზონი ნატარები, სრულად მომსახურებული.'],
    ['m3', 'ფოტოსესია ქორწილისთვის', 'service', 600, 'თბილისი', 'u_nino', 'სრული დღე + 300 დამუშავებული ფოტო.'],
    ['m4', 'ბარისტა — სრული განაკვეთი', 'job', 1500, 'თბილისი', 'u_nino', 'კაფე ვერა ეძებს გამოცდილ ბარისტას.'],
    ['m5', '2-ოთახიანი ბინა ვაკეში', 'property', 1100, 'თბილისი', 'u_levan', 'ქირავდება გრძელვადიანად, ავეჯით.'],
    ['m6', 'ხელნაკეთი მინანქარი', 'item', 90, 'თელავი', 'u_mariam', 'ტრადიციული ტექნიკით, ვერცხლის ჩარჩოში.'],
  ];
  for (const [id, title, category, price, city, by, description] of items) {
    await db.doc(`marketplace/${id}`).set({ title, category, price, currency: 'GEL', city, description, images: [pic(`market-${id}`, 900, 900)], sellerId: by, userId: by, sellerName: U[by].name, sellerAvatar: U[by].avatar || '', condition: category === 'item' ? 'used' : '', status: 'active', createdAt: ts(3 * D), updatedAt: ts(3 * D) });
  }
}

async function seedRewards() {
  const rewards = [
    ['r_coffee', 'უფასო ყავა კაფე ვერაში', 'food_drink', 300, 'b_cafe', 'კაფე ვერა', 25],
    ['r_tour', '20% ფასდაკლება მთის ტურზე', 'experience', 900, 'b_guide', 'ყაზბეგის გიდი', 10],
    ['r_wine', 'ღვინის დეგუსტაცია ორისთვის', 'experience', 1500, 'b_winery', 'თელავის მარანი', 5],
  ];
  let i = 0;
  for (const [id, title, category, cost, businessId, businessName, stock] of rewards) {
    await db.doc(`rewards/${id}`).set({ title, name: title, description: 'წარადგინე კოდი ადგილზე.', category, cost, pointPrice: cost, businessId, businessName, stock, active: true, status: 'active', imageUrl: pic(`reward-${id}`, 800, 500), sortOrder: i++, createdAt: ts(20 * D) });
  }
  const challenges = [
    ['first_checkin', 'პირველი ჩეკინი', 'გააკეთე პირველი ჩეკინი ნებისმიერ ადგილას', 'checkin', 1, 100],
    ['explorer_5', 'მკვლევარი', 'ეწვიე 5 სხვადასხვა ადგილს', 'checkin', 5, 300],
    ['social_10', 'სოციალური პეპელა', 'დაწერე 10 კომენტარი', 'comment', 10, 150],
  ];
  for (const [id, title, description, type, targetCount, xpReward] of challenges) {
    await db.doc(`challenges/${id}`).set({ title, description, type, targetCount, xpReward, active: true, category: 'Exploration' });
  }
  await db.doc('users/u_nino/challengeProgress/first_checkin').set({ userId: 'u_nino', challengeId: 'first_checkin', count: 1, progress: 100, completed: true, xpAwarded: true });
  await db.doc('users/u_nino/challengeProgress/explorer_5').set({ userId: 'u_nino', challengeId: 'explorer_5', count: 2, progress: 40, completed: false, xpAwarded: false });
  await db.doc('userBadges/u_nino_first_checkin').set({ userId: 'u_nino', badgeId: 'first_checkin', title: 'პირველი ჩეკინი', icon: '📍', createdAt: ts(6 * D) });
  await db.doc('rewardCoupons/cp1').set({ rewardId: 'r_coffee', userId: 'u_nino', businessId: 'b_cafe', rewardTitle: 'უფასო ყავა კაფე ვერაში', pointPrice: 300, businessOwnerId: 'u_nino', code: 'GH-7K2P-QX91', qrValue: 'GH-7K2P-QX91', status: 'active', createdAt: ts(2 * D) });
}

async function seedMessages() {
  const cid = 'u_giorgi_u_nino';
  const msgs = [
    ['u_giorgi', 'გამარჯობა! როგორ ხარ? 👋', 50],
    ['u_nino', 'კარგად, შენ? ბათუმში ხარ ისევ?', 48],
    ['u_giorgi', 'კი, ზღვა ჯერ კიდევ თბილია 🌊 ჩამოდი!', 46],
    ['u_giorgi', 'ფოტოებიც გადამიღე, თუ ჩამოხვალ 📷', 3],
  ];
  await db.doc(`conversations/${cid}`).set({
    participants: ['u_nino', 'u_giorgi'], memberUids: ['u_nino', 'u_giorgi'], inboxActorIds: ['user_u_nino', 'user_u_giorgi'],
    inboxKeys: ['user:u_nino', 'user:u_giorgi'], type: 'personal', lastMessage: msgs[msgs.length - 1][1], lastSenderId: 'u_giorgi',
    unreadActors: ['user_u_nino'], unreadFor: ['u_nino'], readBy: {}, updatedAt: ts(3 * 60000), createdAt: ts(D),
  });
  let i = 0;
  for (const [by, text, minsAgo] of msgs) {
    await db.doc(`conversations/${cid}/messages/m${++i}`).set({
      conversationId: cid, senderId: by, authorId: by, senderActorType: 'user', senderActorId: `user_${by}`, senderName: U[by].name,
      senderAvatar: U[by].avatar || '', text, mediaUrl: '', mediaType: '', attachments: [], replyTo: null, likedBy: [], readBy: [by], seenBy: [by],
      readByActors: [`user_${by}`], seenByActors: [`user_${by}`], deletedFor: [], delivered: true, createdAt: ts(minsAgo * 60000), updatedAt: ts(minsAgo * 60000),
    });
  }
  const cid2 = 'u_ana_u_nino';
  await db.doc(`conversations/${cid2}`).set({
    participants: ['u_ana', 'u_nino'], memberUids: ['u_ana', 'u_nino'], inboxActorIds: ['user_u_ana', 'user_u_nino'], type: 'personal',
    lastMessage: 'რეცეპტს ხვალ გამოგიგზავნი 😊', lastSenderId: 'u_ana', unreadActors: [], unreadFor: [], readBy: {}, updatedAt: ts(20 * H), createdAt: ts(3 * D),
  });
  await db.doc(`conversations/${cid2}/messages/m1`).set({ conversationId: cid2, senderId: 'u_ana', senderActorId: 'user_u_ana', senderName: U.u_ana.name, text: 'რეცეპტს ხვალ გამოგიგზავნი 😊', attachments: [], readBy: ['u_ana', 'u_nino'], seenBy: ['u_ana', 'u_nino'], deletedFor: [], createdAt: ts(20 * H), updatedAt: ts(20 * H) });
}

async function seedNotifications() {
  const n = (id, type, from, title, body, href, ago, read = false, extra = {}) => db.doc(`userNotifications/${id}`).set({
    userId: 'u_nino', toUserId: 'u_nino', targetActorType: 'user', targetActorId: 'u_nino', fromUserId: from, fromName: U[from].name,
    fromAvatar: U[from].avatar || '', type, title, body, message: body, href, read, seen: read, createdAt: ts(ago), ...extra,
  });
  await n('n1', 'comment', 'u_luka', 'Luka commented on your post', 'მოდი, ადგილს დაგიტოვებ 🙂', 'feed.html?post=p_kazbegi&comment=c1', 80 * 60000, false, { postId: 'p_kazbegi' });
  await n('n2', 'friend_request', 'u_davit', 'Davit sent you a friend request', '', 'profile.html?id=u_davit', 5 * H);
  await n('n3', 'like', 'u_giorgi', 'Giorgi reacted', '', 'feed.html?post=p_nino_trip', 20 * H, false, { postId: 'p_nino_trip' });
  await n('n4', 'follow', 'u_tamar', 'Tamar followed you', '', 'profile.html?id=u_tamar', 2 * D, true);
  await n('n5', 'story_reaction', 'u_ana', 'Ana reacted to your story', '', 'feed.html?story=s4', 3 * D, true);
}

await wipe();
await seedUsers();
await seedGraph();
await seedPosts();
await seedStories();
await seedPlaces();
await seedGroups();
await seedBusinesses();
await seedEvents();
await seedVideos();
await seedMarket();
await seedNeeds();
await seedRewards();
await seedMessages();
await seedNotifications();
await db.doc('adminFlags/maintenance').set({ enabled: false, feature: 'maintenance', updatedAt: NOW });
console.log('Seeded emulators.');
process.exit(0);
