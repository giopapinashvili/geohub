// Voice/video call test on the emulators with fake camera and microphone:
// nino calls giorgi, giorgi answers, media flows both ways, mute, hang up;
// then a second call that giorgi declines.
import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
async function open(email) {
  const ctx = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('   pageerror:', e.message.slice(0, 140)));
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForFunction(() => window.__gh, null, { timeout: 20000 });
  await page.evaluate((e) => window.__gh.signIn(e, 'geohub123'), email);
  await page.waitForFunction(() => window.__gh.profile.value, null, { timeout: 15000 });
  await page.evaluate(async () => { window.__calls = (await window.__gh.api()).calls; });
  return page;
}
const state = (p) => p.evaluate(() => { const c = window.__calls.call.value; return c && { status: c.status, reason: c.reason, remote: c.remoteStream ? c.remoteStream.getTracks().length : 0, muted: c.muted }; });
const until = async (p, fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { const s = await state(p); if (fn(s)) return s; await p.waitForTimeout(300); } return state(p); };
let ok = 0; let bad = 0;
const check = (name, cond, info) => { if (cond) { ok++; console.log('  ok  ', name); } else { bad++; console.log('  FAIL', name, JSON.stringify(info)); } };

const A = await open('nino@test.ge');
const B = await open('giorgi@test.ge');

await A.evaluate(() => window.__calls.startCall({ uid: 'u_giorgi', name: 'გიორგი', avatar: '' }, 'video'));
check('nino is calling (ringing)', (await state(A))?.status === 'ringing', await state(A));
let sb = await until(B, (s) => s?.status === 'incoming');
check('giorgi sees the incoming video call', sb?.status === 'incoming', sb);
check('call screen is shown to giorgi', await B.evaluate(() => !!document.querySelector('.call-layer')), null);
await B.evaluate(() => window.__calls.answerCall());
let sa = await until(A, (s) => s?.status === 'active' && s.remote > 0);
sb = await until(B, (s) => s?.status === 'active' && s.remote > 0);
check('connected on nino\'s side with giorgi\'s audio+video', sa?.status === 'active' && sa.remote >= 2, sa);
check('connected on giorgi\'s side with nino\'s audio+video', sb?.status === 'active' && sb.remote >= 2, sb);
await A.evaluate(() => window.__calls.toggleMute());
check('nino mutes the microphone', (await state(A))?.muted === true, await state(A));
await A.evaluate(() => window.__calls.hangUp('ended'));
sb = await until(B, (s) => !s || s.status === 'ended');
check('giorgi sees the call end', !sb || sb.status === 'ended', sb);
await A.waitForTimeout(2600);

await A.evaluate(() => window.__calls.startCall({ uid: 'u_giorgi', name: 'გიორგი', avatar: '' }, 'audio'));
sb = await until(B, (s) => s?.status === 'incoming');
check('second (voice) call rings', sb?.status === 'incoming', sb);
await B.evaluate(() => window.__calls.declineCall());
sa = await until(A, (s) => !s || s.status === 'ended');
check('nino is told the call was declined', sa?.reason === 'declined' || !sa, sa);

console.log(`\n${ok} passed, ${bad} failed`);
await browser.close();
