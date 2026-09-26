// End-to-end feature test against the Firebase emulators (production rules).
// Three people use the real data layer through the running emulator build:
// nino (A) and giorgi (B) from the seed, and a brand-new account (C) that
// signs up, verifies its email and signs in.
//   npm run dev:emulator & node web/tools/e2e-flows.mjs
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:5173';
const AUTH = 'http://127.0.0.1:9099';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = {};
let pass = 0; let fail = 0;

async function open(email) {
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => console.log('   pageerror:', e.message.slice(0, 120)));
  await page.goto(BASE + '/');
  await page.waitForFunction(() => window.__gh, null, { timeout: 20000 });
  if (email) {
    await page.evaluate((e) => window.__gh.signIn(e, 'geohub123'), email);
    await page.waitForFunction(() => window.__gh.profile.value, null, { timeout: 15000 });
  }
  return page;
}

async function step(name, page, src) {
  try {
    const out = await page.evaluate(async ({ src, ctx }) => {
      const api = await window.__gh.api();
      const once = (sub, ok = (d) => (Array.isArray(d) ? d.length : d)) => new Promise((res) => {
        let unsub = null; let done = false;
        const t = setTimeout(() => { done = true; unsub?.(); res(null); }, 8000);
        unsub = sub((d) => { if (!done && ok(d)) { done = true; clearTimeout(t); setTimeout(() => unsub?.(), 0); res(d); } });
      });
      const fn = new Function('api', 'ctx', 'once', `return (async () => { ${src} })()`);
      return fn(api, ctx, once);
    }, { src, ctx });
    if (out && typeof out === 'object') Object.assign(ctx, out);
    pass++; console.log(`  ok   ${name}`);
  } catch (e) {
    fail++; console.log(`  FAIL ${name}: ${String(e.message).split('\n')[0].slice(0, 160)}`);
  }
}
const expect = (cond, msg) => `if (!(${cond})) throw new Error(${JSON.stringify(msg)});`;

const A = await open('nino@test.ge');
const B = await open('giorgi@test.ge');
const C = await open(null);
ctx.A = 'u_nino'; ctx.B = 'u_giorgi';
ctx.email = `qa${Date.now()}@test.ge`;

console.log('Account');
await step('sign up a new account', C, `
  await api.auth.signUp({ email: ctx.email, password: 'geohub123', fullName: 'QA ტესტერი', username: 'qa' + Date.now().toString(36), city: 'თბილისი', accountType: 'personal', interests: ['travel'] });`);
const codes = await (await fetch(`${AUTH}/emulator/v1/projects/demo-geohub/oobCodes`)).json();
const link = codes.oobCodes.filter((c) => c.email === ctx.email && c.requestType === 'VERIFY_EMAIL').pop()?.oobLink;
if (link) { await fetch(link); console.log('  ok   verify email (link from the emulator inbox)'); pass++; } else { console.log('  FAIL verify email: no link'); fail++; }
await step('sign in and profile document exists', C, `
  await api.auth.signIn(ctx.email, 'geohub123');
  await new Promise((r) => setTimeout(r, 2500));
  const me = api.auth.profile.value; ${expect('me && me.name', 'no profile')}
  return { C: api.auth.uid.value };`);
await step('edit profile (bio, city)', C, `await api.users.updateMyProfile({ bio: 'QA bio', city: 'ბათუმი' });`);

console.log('Posting');
await step('A posts text', A, `const p = await api.posts.createPost({ text: 'QA პოსტი #ტესტი', visibility: 'public' }); return { postId: p.id };`);
await step('A posts a photo', A, `const p = await api.posts.createPost({ text: 'ფოტო', media: ['${BASE}/fixtures/photo-3.png'], mediaType: 'image' }); return { photoPost: p.id };`);
await step('A posts a poll', A, `const p = await api.posts.createPost({ poll: { question: 'სად წავიდეთ?', options: ['ყაზბეგი', 'სვანეთი'], endsAt: new Date(Date.now() + 86400000) } }); return { pollPost: p.id };`);
await step('A edits the text post', A, `await api.posts.editPost(ctx.postId, { text: 'QA პოსტი (შეცვლილი)' });`);

console.log('Likes, comments, replies');
await step('B reacts ❤️', B, `const p = await api.posts.getPost(ctx.postId); await api.posts.setReaction(p, 'love', ''); ${expect("(await api.posts.getMyReaction(ctx.postId)) === 'love'", 'reaction not stored')}`);
await step('B comments', B, `const p = await api.posts.getPost(ctx.postId); await api.posts.addComment(p, 'მაგარია! 👏');`);
await step('A replies to the comment', A, `
  const list = await once((cb) => api.posts.listenComments(ctx.postId, cb)); ${expect('list && list.length', 'no comments')}
  const c = list.find((x) => x.authorId === ctx.B); await api.posts.addReply(ctx.postId, c, 'მადლობა!');
  const replies = await once((cb) => api.posts.listenReplies(ctx.postId, c.id, cb)); ${expect('replies && replies.length', 'reply missing')}
  return { commentId: c.id };`);
await step('B likes the comment', B, `
  const list = await once((cb) => api.posts.listenComments(ctx.postId, cb)); const c = list.find((x) => x.id === ctx.commentId);
  await api.posts.setCommentReaction(ctx.postId, c, 'like', '');`);
await step('B votes in the poll', B, `await api.posts.votePoll(ctx.pollPost, '0'); ${expect("(await api.posts.getMyVote(ctx.pollPost)) != null", 'vote missing')}`);
await step('B shares the post', B, `await api.posts.createPost({ text: '', sharedPostId: ctx.postId });`);
await step('A sees notifications from B', A, `const n = await once((cb) => api.notify.listenNotifications(ctx.A, cb), (d) => d && d.some((x) => x.fromUserId === ctx.B)); ${expect('n', 'no notification from B')}`);

console.log('Messages');
await step('A opens a chat with B and sends a message', A, `const cid = await api.messages.openDirect(ctx.B); await api.messages.sendMessage(cid, { text: 'გამარჯობა 👋' }); return { cid };`);
await step('B receives, reads, reacts and answers', B, `
  const msgs = await once((cb) => api.messages.listenMessages(ctx.cid, cb), (d) => d && d.some((m) => m.text === 'გამარჯობა 👋'));
  ${expect('msgs', 'message not received')}
  const m = msgs.find((x) => x.text === 'გამარჯობა 👋');
  await api.messages.markConversationRead(ctx.cid);
  await api.messages.toggleMessageReaction(ctx.cid, m, '❤️');
  await api.messages.sendMessage(ctx.cid, { text: 'გაგიმარჯოს!', replyTo: { id: m.id, text: m.text, senderName: m.senderName || '' } });
  return { msgId: m.id };`);
await step('A edits and deletes own message', A, `await api.messages.editMessage(ctx.cid, ctx.msgId, 'გამარჯობა! (შეცვლილი)'); await api.messages.deleteMessage(ctx.cid, ctx.msgId, true);`);
await step('B sees the conversation in the inbox', B, `const l = await once((cb) => api.messages.listenConversations(cb), (d) => d && d.some((c) => c.id === ctx.cid)); ${expect('l', 'not in inbox')}`);

console.log('Stories');
await step('A posts a story', A, `await api.stories.createStory({ text: 'QA სთორი ✨', bg: 'linear-gradient(135deg,#2563eb,#06b6d4)' });`);
await step('B views, reacts and replies to the story', B, `
  const tray = await once((cb) => api.stories.listenStoryTray(cb), (d) => d && d.some((g) => (g.userId || g.authorId || g.uid) === ctx.A || (g.stories || []).some((s) => s.authorId === ctx.A)));
  ${expect('tray', 'story not in tray')}
  const g = tray.find((x) => (x.userId || x.authorId || x.uid) === ctx.A || (x.stories || []).some((s) => s.authorId === ctx.A));
  const s = (g.stories || [g]).slice(-1)[0];
  await api.stories.markStoryViewed(s); await api.stories.reactToStory(s, '🔥'); await api.stories.replyToStory(s, 'მაგარია!');`);

console.log('Friends and follows');
await step('C sends A a friend request', C, `await api.social.sendFriendRequest(ctx.A);`);
await step('A accepts', A, `
  const reqs = await once((cb) => api.social.listenIncomingRequests(cb), (d) => d && d.some((r) => r.fromId === ctx.C));
  ${expect('reqs', 'request not received')}
  await api.social.acceptFriendRequest(reqs.find((r) => r.fromId === ctx.C).id);
  const ids = await once((cb) => api.social.listenFriendIds(ctx.A, cb), (d) => d && d.includes(ctx.C)); ${expect('ids', 'not friends')}`);
await step('C follows B', C, `await api.social.follow(ctx.B);`);
await step('C saves, hides, reports; blocks and unblocks B', C, `
  await api.posts.setSaved('post', ctx.postId, true); ${expect("await api.posts.isSaved('post', ctx.postId)", 'not saved')}
  await api.social.hidePost(ctx.photoPost); await api.social.report('post', ctx.photoPost, 'spam');
  await api.social.blockUser(ctx.B); ${expect('await api.social.isBlocking(ctx.B)', 'block failed')} await api.social.unblockUser(ctx.B);`);

console.log('Requests, marketplace, groups, business, events, places');
await step('C posts a request (მჭირდება) and closes it', C, `const id = await api.needs.createNeed({ text: 'მჭირდება ელექტრიკოსი, QA', category: 'repair', city: 'თბილისი', budget: 80, when: 'week' }); await api.needs.closeNeed(id);`);
await step('C lists an item, marks it sold, deletes it', C, `const id = await api.market.createItem({ title: 'QA ველოსიპედი', description: 'ტესტი', price: 100, category: 'item', condition: 'used', city: 'თბილისი', images: [] }); await api.market.setItemStatus(id, 'sold'); await api.market.deleteItem(id);`);
await step('C joins and leaves a public group', C, `const g = await api.groups.getGroup('g_hikers'); await api.groups.joinGroup(g); await api.groups.leaveGroup(g);`);
await step('C asks to join a private group', C, `const g = await api.groups.getGroup('g_photo'); await api.groups.requestToJoin(g);`);
await step('A (group owner) approves', A, `
  const g = await api.groups.getGroup('g_photo');
  const reqs = await once((cb) => api.groups.listenJoinRequests('g_photo', cb), (d) => d && d.some((r) => r.userId === ctx.C)); ${expect('reqs', 'no join request')}
  await api.groups.answerJoinRequest(g, reqs.find((r) => r.userId === ctx.C), true);`);
await step('C becomes a member after approval', C, `
  const g = await api.groups.getGroup('g_photo');
  const r = await once((cb) => api.groups.listenMyJoinRequest('g_photo', cb), (d) => d && d.status === 'approved'); ${expect('r', 'not approved')}
  ${expect('await api.groups.claimApprovedMembership(g, r)', 'membership not created')}`);
await step('C posts in the group', C, `await api.posts.createPost({ text: 'გამარჯობა ჯგუფს!', groupId: 'g_photo', groupPrivacy: 'private' });`);
await step('C follows, reviews and messages a business; sends a quote request', C, `
  const b = await api.business.getBusiness('b_cafe');
  await api.business.setFollowBusiness(b, true); await api.business.addBusinessReview(b, 5, 'QA: საუკეთესო ყავა');
  await api.business.sendQuoteRequest(b, { name: 'QA', email: 'qa@test.ge', message: 'გამარჯობა, 10 კაცზე მაგიდა გაქვთ?' });
  const cid = await api.messages.openBusinessConversation(b.id, b.ownerId); await api.messages.sendMessage(cid, { text: 'გამარჯობა კაფე!' });
  return { bizCid: cid };`);
await step('A (page owner) sees the quote, replies to the review, answers as the page', A, `
  const q = await api.business.listQuoteRequests('b_cafe'); ${expect('q.some((x) => x.submittedBy === ctx.C)', 'quote missing')}
  const reviews = await once((cb) => api.business.listenBusinessReviews('b_cafe', cb), (d) => d && d.some((r) => r.userId === ctx.C));
  await api.business.replyToReview(reviews.find((r) => r.userId === ctx.C).id, 'მადლობა!');
  await api.messages.sendMessage(ctx.bizCid, { text: 'მოგესალმებით!', asBusiness: 'b_cafe' });`);
await step('C goes to an event (RSVP) and cancels', C, `const e = await api.events.getEvent('e_jazz'); await api.events.setRsvp(e, 'going'); ${expect("(await api.events.myRsvp('e_jazz')) === 'going'", 'rsvp missing')} await api.events.setRsvp(e, null);`);
await step('C reviews a place and checks in', C, `await api.places.addPlaceReview('pl_gergeti', 5, 'QA: ულამაზესი'); const p = await api.places.getPlace('pl_gergeti'); await api.places.checkIn(p, { caption: 'აქ ვარ!', share: true });`);

console.log('Cleanup');
await step('A deletes the photo post', A, `await api.posts.deletePost(ctx.photoPost);`);

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
