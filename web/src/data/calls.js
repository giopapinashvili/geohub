// Voice and video calls: WebRTC media, Firestore signalling in the same
// shape the old site used, so calls work between old and new clients.
//   calls/{id}: { callerId, calleeId, callerName, callerAvatar, calleeName,
//                 calleeAvatar, type, status, offer, answer, createdAt, endedAt, duration }
//   calls/{id}/callerCandidates, calls/{id}/calleeCandidates: ICE candidates
// status: ringing → active → ended | declined | missed

import { signal } from '@preact/signals';
import { collection, doc, setDoc, updateDoc, addDoc, getDoc, onSnapshot, query, where, limit, serverTimestamp } from 'firebase/firestore';
import { db, WORKER_URL } from '../lib/firebase.js';
import { me, uid } from '../lib/auth.js';
import { notify } from './notify.js';

/** The current call, or null. Components render from this. */
export const call = signal(null);

const FALLBACK_ICE = { iceServers: [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turns:openrelay.metered.ca:443'], username: 'openrelayproject', credential: 'openrelayproject' },
], iceCandidatePoolSize: 10 };
let iceCache = null;
let iceAt = 0;
async function iceConfig() {
  if (iceCache && Date.now() - iceAt < 23 * 3600000) return iceCache;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 4000);
    const res = await fetch(`${WORKER_URL}/api/turn-credentials`, { signal: ctl.signal });
    clearTimeout(timer);
    const data = res.ok ? await res.json() : null;
    if (data?.iceServers?.length) { iceCache = { iceServers: data.iceServers, iceCandidatePoolSize: 10 }; iceAt = Date.now(); return iceCache; }
  } catch { /* fall back */ }
  return FALLBACK_ICE;
}

let pc = null;
let unsubs = [];
let ringTimer = 0;
const set = (patch) => { if (call.value) call.value = { ...call.value, ...patch }; };

function cleanup() {
  clearTimeout(ringTimer);
  unsubs.forEach((u) => u());
  unsubs = [];
  call.value?.localStream?.getTracks().forEach((t) => t.stop());
  try { pc?.close(); } catch { /* ignore */ }
  pc = null;
}

function finish(reason) {
  cleanup();
  set({ status: 'ended', reason, localStream: null, remoteStream: null });
  setTimeout(() => { if (call.value?.status === 'ended') call.value = null; }, 2200);
}

const getMedia = (type) => navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' ? { facingMode: 'user', width: { ideal: 1280 } } : false });

function connect(callId, role, cfg, local) {
  pc = new RTCPeerConnection(cfg);
  local.getTracks().forEach((tr) => pc.addTrack(tr, local));
  const remote = new MediaStream();
  pc.ontrack = (e) => { (e.streams[0]?.getTracks() || [e.track]).forEach((tr) => { if (!remote.getTracks().includes(tr)) remote.addTrack(tr); }); set({ remoteStream: remote, tracks: remote.getTracks().length }); };
  const mine = role === 'caller' ? 'callerCandidates' : 'calleeCandidates';
  const theirs = role === 'caller' ? 'calleeCandidates' : 'callerCandidates';
  pc.onicecandidate = (e) => { if (e.candidate) addDoc(collection(db, 'calls', callId, mine), e.candidate.toJSON()).catch(() => {}); };
  pc.onconnectionstatechange = () => {
    if (!pc) return;
    if (pc.connectionState === 'connected') set({ status: 'active', startedAt: call.value?.startedAt || Date.now() });
    if (pc.connectionState === 'failed') hangUp('ended');
  };
  unsubs.push(onSnapshot(collection(db, 'calls', callId, theirs), (s) => {
    s.docChanges().forEach((ch) => { if (ch.type === 'added') pc?.addIceCandidate(new RTCIceCandidate(ch.doc.data())).catch(() => {}); });
  }, () => {}));
}

/** Call someone. peer: { uid, name, avatar }; type: 'audio' | 'video'. */
export async function startCall(peer, type = 'audio') {
  if (call.value) return;
  const m = me();
  const local = await getMedia(type);
  const ref = doc(collection(db, 'calls'));
  call.value = { id: ref.id, role: 'caller', type, peer, status: 'ringing', localStream: local, muted: false, cameraOff: false };
  try {
    await setDoc(ref, {
      callerId: m.uid, calleeId: peer.uid, callerName: m.name, callerAvatar: m.avatar || '', calleeName: peer.name || '', calleeAvatar: peer.avatar || '',
      type, status: 'ringing', createdAt: serverTimestamp(),
    });
    connect(ref.id, 'caller', await iceConfig(), local);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await updateDoc(ref, { offer: { type: offer.type, sdp: offer.sdp } });
  } catch (e) { finish('failed'); throw e; }
  unsubs.push(onSnapshot(ref, async (s) => {
    const d = s.data();
    if (!d || !pc) return;
    if (d.answer && !pc.currentRemoteDescription) { await pc.setRemoteDescription(new RTCSessionDescription(d.answer)).catch(() => {}); set({ status: 'connecting' }); clearTimeout(ringTimer); }
    if (['declined', 'ended', 'missed'].includes(d.status)) finish(d.status);
  }, () => {}));
  ringTimer = setTimeout(() => { if (call.value?.status === 'ringing') hangUp('missed'); }, 45000);
}

/** Watches for someone calling the signed-in user. */
export function listenIncoming() {
  const u = uid.value;
  if (!u) return () => {};
  return onSnapshot(query(collection(db, 'calls'), where('calleeId', '==', u), where('status', '==', 'ringing'), limit(5)), (s) => {
    if (call.value) return;
    const fresh = s.docs.map((d) => ({ id: d.id, ...d.data() }))
      .filter((d) => d.offer && Date.now() - (d.createdAt?.toMillis?.() || Date.now()) < 60000).pop();
    if (fresh) call.value = { id: fresh.id, role: 'callee', type: fresh.type || 'audio', peer: { uid: fresh.callerId, name: fresh.callerName, avatar: fresh.callerAvatar }, status: 'incoming', muted: false, cameraOff: false };
  }, () => {});
}

export async function answerCall() {
  const c = call.value;
  if (!c || c.role !== 'callee') return;
  const local = await getMedia(c.type);
  set({ localStream: local, status: 'connecting' });
  const ref = doc(db, 'calls', c.id);
  const d = (await getDoc(ref)).data();
  if (!d || d.status !== 'ringing' || !d.offer) { local.getTracks().forEach((tr) => tr.stop()); finish('ended'); return; }
  connect(c.id, 'callee', await iceConfig(), local);
  await pc.setRemoteDescription(new RTCSessionDescription(d.offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await updateDoc(ref, { answer: { type: answer.type, sdp: answer.sdp }, status: 'active', answeredAt: serverTimestamp() });
  unsubs.push(onSnapshot(ref, (s) => { const x = s.data(); if (x && ['ended', 'declined'].includes(x.status)) finish(x.status); }, () => {}));
}

export function declineCall() {
  const c = call.value;
  if (!c) return;
  updateDoc(doc(db, 'calls', c.id), { status: 'declined', endedAt: serverTimestamp() }).catch(() => {});
  finish('declined');
}

export function hangUp(reason = 'ended') {
  const c = call.value;
  if (!c || c.status === 'ended') return;
  const duration = c.startedAt ? Math.round((Date.now() - c.startedAt) / 1000) : 0;
  updateDoc(doc(db, 'calls', c.id), { status: reason, endedAt: serverTimestamp(), duration }).catch(() => {});
  if (reason === 'missed' && c.role === 'caller') {
    const m = me();
    notify(c.peer.uid, { type: 'missed_call', title: `${m.name} — გამოტოვებული ${c.type === 'video' ? 'ვიდეოზარი' : 'ზარი'}`, href: 'messages.html', extra: { callId: c.id, callType: c.type } });
  }
  finish(reason);
}

export function toggleMute() {
  const c = call.value;
  if (!c?.localStream) return;
  c.localStream.getAudioTracks().forEach((tr) => { tr.enabled = c.muted; });
  set({ muted: !c.muted });
}

export function toggleCamera() {
  const c = call.value;
  if (!c?.localStream) return;
  c.localStream.getVideoTracks().forEach((tr) => { tr.enabled = c.cameraOff; });
  set({ cameraOff: !c.cameraOff });
}
