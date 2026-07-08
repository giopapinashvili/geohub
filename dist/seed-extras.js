/**
 * GeoHub Seed Extras
 * 1. Migrate ui-avatars.com → inline SVG (users + posts)
 * 2. Seed stories for ~55 seed users
 * 3. Seed comments on seed posts
 * 4. Add more place photos
 * Run: node seed-extras.js
 */

const admin = require('firebase-admin');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.cert(serviceAccount),
  projectId: 'geohub-main',
});
const db = getFirestore();

// ─── SVG avatar ───────────────────────────────────────────────────
function svgAvatar(name) {
  const n = (name || 'GH').trim();
  const initials = n.split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || 'GH';
  const palette = ['#10b981','#6d3fd9','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];
  const color = palette[Math.abs(n.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % palette.length];
  const s = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" rx="60" fill="${color}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-size="44" fill="white" font-weight="700">${initials}</text></svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(s);
}

// ─── Helpers ──────────────────────────────────────────────────────
function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function ago(days, hours = 0) {
  return Timestamp.fromMillis(Date.now() - days * 86400000 - hours * 3600000);
}

const BS = 390; // batch size (under Firestore 500 limit)

async function flushBatch(b, n) {
  if (n > 0) await b.commit();
}

// ─── Content arrays ───────────────────────────────────────────────
const COMMENTS = [
  'ძალიან ლამაზია! 😍',
  'ვეთანხმები, ძალიან სწორია! 👍',
  'ეს ადგილი ძალიან მომეწონა ❤️',
  'ვყვებიხარ! 🙌',
  'ეს სად არის?? 📍',
  'ბრავო! 👏 კარგი პოსტია!',
  'ერთ დღეს აუცილებლად მივალ!',
  'ეს ფოტო სულ სხვა დონეა 📸',
  'შესანიშნავია! 🏆',
  'ქართველი ხალხი საუკეთესოა! 💚',
  'ვინ მოვა? 🙋‍♂️',
  'ეს კი მართლა! 💯',
  'ლამაზი ადგილი! 🌿',
  'ეს ჩემი საყვარელი ადგილია! 💙',
  'Share გავაკეთე! 🔄',
  'ძალიან საინტერესოა!',
  'ნამდვილად ასეა!',
  'კარგი! გამარჯობა 🙏',
  'მინდა ვნახო ეს! 🤩',
  'Super content! ❤️‍🔥',
  'ვეთანხმები 100%',
  'ამაში ვფიქრობდი! 🤔',
  'ეს ჩემი ოცნებაა! 🌟',
  'კარგი გამოცდილება 🎯',
  'ოჯახსაც ვუყვები ამ ადგილზე 🏡',
  'ბედნიერები ხართ! 😊',
  'ძველი ქალაქი ძალიან მიყვარს! 🏰',
  'ამ სეზონს ვგეგმავ 📅',
  'ყველასთვის სავალდებულოა! ✅',
  'ეს ვიდეო გავუზიარე მეგობრებს 👥',
  'ამ გემოს ვერ დაივიწყებ 😋',
  'მომცე გზა! 🗺️',
  'ეს ტრენდი ყველგან ჩანს 📈',
  'ვინ კიდევ ეთანხმება? 🙋',
  'კარგი წვდომა! 💡',
  'მიყვარს ეს! ❤️',
  'ძალიან კარგი! 🔥',
  'წამოვიდეთ ერთად? 🚗',
  'ეს ფასი ბევრი არ არის! 💰',
  'ვარ გამოცდილებული ამ ადგილში 🎓',
];

const STORY_CAPTIONS = [
  'დღე ასე მიდის... ✨',
  'საქართველო ❤️',
  'good vibes only 🌿',
  'ეს ჩემი ადგილია 📍',
  'ბედნიერი ვარ 😊',
  'tbilisi nights 🌙',
  'new day, new energy 💪',
  'ყოველი მომენტი ❤️',
  'ცხოვრება ლამაზია 🌸',
  'sunset vibes 🌅',
  'story time 📖',
  'good morning! ☀️',
  'ამ ადგილს ვერ გათანაბრებ 🏔️',
  'კახეთის სადღეგრძელო 🍷',
  'ყველაფერი შეიძლება 💫',
  'tbilisi, i love you 🏙️',
  'გამარჯობა სამყარო! 🌍',
  'weekend mood 🎉',
];

const STORY_BG = [
  '#1a1a2e','#16213e','#0f3460','#533483',
  '#065f46','#7c3aed','#dc2626','#d97706',
  '#059669','#0284c7','#db2777','#92400e',
];

// ─── MAIN ─────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 GeoHub Seed Extras Starting...\n');

  // ── Load seed users ──────────────────────────────────────────────
  console.log('📥 Loading seed users...');
  const usersSnap = await db.collection('users').where('isSeedUser', '==', true).get();
  const USERS = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`  → ${USERS.length} seed users found`);

  if (USERS.length === 0) {
    console.error('❌ No seed users found. Run seed.js first.');
    process.exit(1);
  }

  // ── Load all seed posts ──────────────────────────────────────────
  console.log('📥 Loading seed posts...');
  const postsSnap = await db.collection('posts').where('isSeedPost', '==', true).get();
  const ALL_POSTS = postsSnap.docs;
  console.log(`  → ${ALL_POSTS.length} seed posts found`);

  let batch = db.batch();
  let ops = 0;
  const totals = { userAvatars: 0, postAvatars: 0, stories: 0, comments: 0, places: 0 };

  // ── 1. Migrate user avatars ──────────────────────────────────────
  console.log('\n🖼️  Migrating user avatars...');
  for (const u of USERS) {
    if (u.avatar && u.avatar.includes('ui-avatars.com')) {
      const newAv = svgAvatar(u.fullName || u.displayName || u.name || '');
      batch.update(db.collection('users').doc(u.id), { avatar: newAv });
      u.avatar = newAv; // update local copy so stories use new avatar
      ops++;
      totals.userAvatars++;
      if (ops >= BS) {
        await batch.commit(); batch = db.batch(); ops = 0; process.stdout.write('.');
      }
    }
  }
  await flushBatch(batch, ops); batch = db.batch(); ops = 0;
  console.log(`\n  ✅ ${totals.userAvatars} user avatars migrated`);

  // ── 2. Migrate post authorAvatars ────────────────────────────────
  console.log('\n🖼️  Migrating post authorAvatars...');
  const uidAvatarMap = {};
  for (const u of USERS) uidAvatarMap[u.id] = u.avatar;

  for (const doc of ALL_POSTS) {
    const d = doc.data();
    if (d.authorAvatar && d.authorAvatar.includes('ui-avatars.com')) {
      const newAv = uidAvatarMap[d.authorId] || svgAvatar(d.authorName || '');
      batch.update(doc.ref, { authorAvatar: newAv });
      ops++;
      totals.postAvatars++;
      if (ops >= BS) {
        await batch.commit(); batch = db.batch(); ops = 0; process.stdout.write('.');
      }
    }
  }
  await flushBatch(batch, ops); batch = db.batch(); ops = 0;
  console.log(`\n  ✅ ${totals.postAvatars} post avatars migrated`);

  // ── 3. Create stories ────────────────────────────────────────────
  console.log('\n📱 Creating stories...');
  const now = Date.now();
  const storyUsers = USERS.slice(0, Math.min(55, USERS.length));

  for (const u of storyUsers) {
    const num = randInt(2, 5);
    for (let s = 0; s < num; s++) {
      const isImage = Math.random() > 0.3;
      const createdAt = Timestamp.fromMillis(now - randInt(0, 20) * 3600000 - s * 5400000);
      const expiresAt = Timestamp.fromMillis(createdAt.toMillis() + 86400000);
      const ref = db.collection('stories').doc();
      const data = {
        authorId: u.id,
        authorName: u.fullName || u.displayName || u.name || '',
        authorAvatar: u.avatar || svgAvatar(u.fullName || ''),
        authorUsername: u.username || '',
        type: isImage ? 'image' : 'text',
        caption: rand(STORY_CAPTIONS),
        viewCount: randInt(5, 400),
        views: [],
        likeCount: randInt(0, 90),
        status: 'active',
        createdAt,
        expiresAt,
        isSeedStory: true,
      };
      if (isImage) {
        data.mediaUrl = `https://picsum.photos/seed/story_${u.username || u.id}_${s}/400/700`;
        data.mediaType = 'image';
      } else {
        data.bgColor = rand(STORY_BG);
        data.text = rand(STORY_CAPTIONS);
        data.textColor = '#ffffff';
        data.fontStyle = rand(['bold', 'normal', 'italic']);
      }
      batch.set(ref, data);
      ops++;
      totals.stories++;
      if (ops >= BS) {
        await batch.commit(); batch = db.batch(); ops = 0; process.stdout.write('.');
      }
    }
  }
  await flushBatch(batch, ops); batch = db.batch(); ops = 0;
  console.log(`\n  ✅ ${totals.stories} stories created`);

  // ── 4. Create comments on posts ──────────────────────────────────
  console.log('\n💬 Creating comments on posts...');

  for (const postDoc of ALL_POSTS) {
    if (Math.random() > 0.75) continue; // 75% of posts get comments
    const postData = postDoc.data();
    const num = randInt(2, 6);
    for (let c = 0; c < num; c++) {
      const commenter = rand(USERS);
      const ref = postDoc.ref.collection('comments').doc();
      batch.set(ref, {
        authorId: commenter.id,
        authorName: commenter.fullName || commenter.displayName || '',
        authorAvatar: commenter.avatar || svgAvatar(commenter.fullName || ''),
        authorUsername: commenter.username || '',
        text: rand(COMMENTS),
        likeCount: randInt(0, 30),
        isAuthor: commenter.id === postData.authorId,
        isPinned: false,
        status: 'active',
        createdAt: ago(randInt(0, 60), randInt(0, 23)),
        updatedAt: ago(randInt(0, 60), randInt(0, 23)),
        isSeedComment: true,
      });
      ops++;
      totals.comments++;
      if (ops >= BS) {
        await batch.commit(); batch = db.batch(); ops = 0; process.stdout.write('.');
      }
    }
  }
  await flushBatch(batch, ops); batch = db.batch(); ops = 0;
  console.log(`\n  ✅ ${totals.comments} comments created`);

  // ── 5. Add place photos ──────────────────────────────────────────
  console.log('\n🏔️  Updating place photos...');
  const placesSnap = await db.collection('places').where('isSeedPlace', '==', true).get();

  for (const placeDoc of placesSnap.docs) {
    const d = placeDoc.data();
    const num = randInt(4, 7);
    const photos = [];
    const slug = (d.name || 'place').slice(0, 8).replace(/\s+/g, '_');
    for (let ph = 0; ph < num; ph++) {
      photos.push(`https://picsum.photos/seed/${slug}_${ph + 1}/600/400`);
    }
    batch.update(placeDoc.ref, { photos });
    ops++;
    totals.places++;
    if (ops >= BS) {
      await batch.commit(); batch = db.batch(); ops = 0; process.stdout.write('.');
    }
  }
  await flushBatch(batch, ops);
  console.log(`  ✅ ${totals.places} places updated with photos`);

  // ── Summary ──────────────────────────────────────────────────────
  console.log('\n🎉 Done!');
  console.log('───────────────────────────────────');
  console.log(`🖼️  User avatars migrated:  ${totals.userAvatars}`);
  console.log(`🖼️  Post avatars migrated:  ${totals.postAvatars}`);
  console.log(`📱 Stories created:        ${totals.stories}`);
  console.log(`💬 Comments created:       ${totals.comments}`);
  console.log(`🏔️  Places with photos:     ${totals.places}`);
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.code || '', err.message || err);
  process.exit(1);
});
