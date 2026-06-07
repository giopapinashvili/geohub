/* GeoHub — Live Streaming (P2P WebRTC broadcast, no paid services)
   Broadcaster holds one RTCPeerConnection per viewer.
   Viewers use recvonly transceivers.

   Firestore schema:
     livestreams/{streamId}                               — stream metadata
     livestreams/{streamId}/viewers/{viewerUid}           — viewer presence + offer/answer
     livestreams/{streamId}/bcCandidates/{viewerUid}/candidates/{id} — broadcaster→viewer ICE
     livestreams/{streamId}/vcCandidates/{viewerUid}/candidates/{id} — viewer→broadcaster ICE
*/
(function () {
  'use strict';

  var _db, _auth;
  var _streamId   = null;
  var _myUid      = null, _myName = null, _myAvatar = null;
  var _isBc       = false; // broadcaster
  var _localStream = null;
  var _viewerPCs  = {};    // { viewerUid: RTCPeerConnection }  — broadcaster side
  var _viewerPC   = null;  // single PC — viewer side
  var _unsubscribers = [];

  var ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];

  function _t(k, fb) {
    try { return (window.GHI18N && window.GHI18N.t(k)) || fb; } catch(e) { return fb; }
  }
  function _esc(s) {
    return String(s).replace(/[&<>"']/g, function(c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function _log() { console.log.apply(console, ['[Live]'].concat(Array.from(arguments))); }

  // ── INIT ───────────────────────────────────────────────────────────

  function _init() {
    try {
      _db   = firebase.firestore();
      _auth = firebase.auth();
    } catch(e) { setTimeout(_init, 800); return; }

    _auth.onAuthStateChanged(function(user) {
      _myUid    = user ? user.uid        : null;
      _myName   = user ? (user.displayName || 'User') : null;
      _myAvatar = user ? (user.photoURL   || '')       : null;
      if (document.getElementById('glive-container')) _loadStreams();
    });
  }

  // ── STREAMS LIST ───────────────────────────────────────────────────

  async function _loadStreams() {
    var list = document.getElementById('glive-list');
    if (!list) return;
    list.innerHTML = '<p class="glive-loading"><i class="fas fa-spinner fa-spin"></i> ' +
      _t('live_loading', 'Loading…') + '</p>';

    try {
      var snap = await _db.collection('livestreams')
        .where('status', '==', 'live')
        .orderBy('startedAt', 'desc')
        .limit(24)
        .get();

      if (snap.empty) {
        list.innerHTML = '<div class="glive-empty"><i class="fas fa-broadcast-tower"></i>' +
          '<p>' + _t('live_no_streams', 'No live streams right now') + '</p></div>';
        return;
      }

      list.innerHTML = '';
      snap.docs.forEach(function(doc) {
        var d = doc.data();
        var card = document.createElement('div');
        card.className = 'glive-card';
        card.innerHTML =
          '<div class="glive-host">' +
            '<img src="' + _esc(d.hostAvatar || 'icons/icon-72.png') + '" class="glive-av" ' +
              'onerror="this.src=\'icons/icon-72.png\'">' +
            '<div>' +
              '<strong>' + _esc(d.hostName || 'Host') + '</strong>' +
              '<span class="glive-badge">● LIVE</span>' +
            '</div>' +
          '</div>' +
          '<h3 class="glive-title">' + _esc(d.title || 'Live Stream') + '</h3>' +
          '<div class="glive-meta"><i class="fas fa-eye"></i> ' +
            (d.viewerCount || 0) + ' ' + _t('live_viewers', 'viewers') +
          '</div>' +
          '<button class="glive-join-btn"><i class="fas fa-play"></i> ' +
            _t('live_watch', 'Watch') + '</button>';
        card.querySelector('.glive-join-btn').addEventListener('click', function() {
          joinStream(doc.id);
        });
        list.appendChild(card);
      });
    } catch(e) {
      list.innerHTML = '<p style="color:#ef4444;text-align:center;padding:20px">' + e.message + '</p>';
    }
  }

  // ── BROADCASTER: start stream ──────────────────────────────────────

  async function startStream(title) {
    if (!_myUid) { alert(_t('login_required', 'Please log in first')); return; }
    if (_streamId) { _log('already streaming'); return; }

    title = (title || '').trim() || (_myName + ' Live');

    try {
      _localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
      });
    } catch(e) {
      alert(_t('call_perm_denied', 'Camera/microphone permission denied'));
      return;
    }

    _isBc     = true;
    _streamId = _db.collection('livestreams').doc().id;

    await _db.collection('livestreams').doc(_streamId).set({
      hostUid:     _myUid,
      hostName:    _myName,
      hostAvatar:  _myAvatar,
      title:       title,
      status:      'live',
      viewerCount: 0,
      startedAt:   firebase.firestore.FieldValue.serverTimestamp()
    });

    _showBroadcastUI();
    _listenForViewers();
    _log('stream started:', _streamId);
  }

  async function stopStream() {
    if (!_streamId || !_isBc) return;
    var sid = _streamId;
    _cleanup();
    try {
      await _db.collection('livestreams').doc(sid).update({
        status:   'ended',
        endedAt:  firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch(e) {}
  }

  // ── BROADCASTER: viewer listener ────────────────────────────────────

  function _listenForViewers() {
    var unsub = _db.collection('livestreams').doc(_streamId)
      .collection('viewers').where('active', '==', true)
      .onSnapshot(function(snap) {
        snap.docChanges().forEach(function(ch) {
          var vid = ch.doc.id;
          if (vid === _myUid) return;
          if (ch.type === 'added' && !_viewerPCs[vid]) _connectViewer(vid);
          if (ch.type === 'modified' && !ch.doc.data().active && _viewerPCs[vid]) {
            try { _viewerPCs[vid].close(); } catch(e) {}
            delete _viewerPCs[vid];
          }
        });
        // Update viewer count display
        var n = snap.docs.filter(function(d) { return d.data().active; }).length;
        var el = document.getElementById('glive-vc');
        if (el) el.textContent = n;
      });
    _unsubscribers.push(unsub);
  }

  async function _connectViewer(viewerUid) {
    _log('connecting viewer:', viewerUid);
    var pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    _viewerPCs[viewerUid] = pc;

    if (_localStream) {
      _localStream.getTracks().forEach(function(t) { pc.addTrack(t, _localStream); });
    }

    pc.onicecandidate = function(ev) {
      if (!ev.candidate) return;
      _db.collection('livestreams').doc(_streamId)
        .collection('bcCandidates').doc(viewerUid)
        .collection('candidates').add({
          c: ev.candidate.toJSON(),
          ts: firebase.firestore.FieldValue.serverTimestamp()
        });
    };

    var offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await _db.collection('livestreams').doc(_streamId)
      .collection('viewers').doc(viewerUid)
      .update({ offer: { type: offer.type, sdp: offer.sdp } });

    // Listen for viewer answer
    var u1 = _db.collection('livestreams').doc(_streamId)
      .collection('viewers').doc(viewerUid)
      .onSnapshot(async function(snap) {
        if (!snap.exists) return;
        var d = snap.data();
        if (d.answer && pc.signalingState === 'have-local-offer') {
          try { await pc.setRemoteDescription(new RTCSessionDescription(d.answer)); } catch(e) {}
        }
      });
    _unsubscribers.push(u1);

    // Listen for viewer ICE
    var u2 = _db.collection('livestreams').doc(_streamId)
      .collection('vcCandidates').doc(viewerUid)
      .collection('candidates').onSnapshot(function(snap) {
        snap.docChanges().forEach(async function(ch) {
          if (ch.type !== 'added') return;
          try { await pc.addIceCandidate(new RTCIceCandidate(ch.doc.data().c)); } catch(e) {}
        });
      });
    _unsubscribers.push(u2);
  }

  // ── VIEWER: join stream ─────────────────────────────────────────────

  async function joinStream(streamId) {
    if (!_myUid) { alert(_t('login_required', 'Please log in first')); return; }
    if (_streamId) { _log('already in a stream'); return; }
    _streamId = streamId;
    _isBc = false;

    var snap = await _db.collection('livestreams').doc(streamId).get().catch(function() { return null; });
    if (!snap || !snap.exists) {
      alert(_t('live_not_found', 'Stream not found'));
      _streamId = null; return;
    }
    var data = snap.data();
    if (data.status !== 'live') {
      alert(_t('live_stream_ended', 'This stream has ended'));
      _streamId = null; return;
    }

    var pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    _viewerPC = pc;
    var remoteStream = new MediaStream();

    pc.ontrack = function(ev) {
      ev.streams[0].getTracks().forEach(function(t) { remoteStream.addTrack(t); });
      var vid = document.getElementById('glive-remote-video');
      if (vid) { vid.srcObject = remoteStream; vid.play().catch(function(){}); }
    };

    pc.onicecandidate = function(ev) {
      if (!ev.candidate) return;
      _db.collection('livestreams').doc(streamId)
        .collection('vcCandidates').doc(_myUid)
        .collection('candidates').add({
          c: ev.candidate.toJSON(),
          ts: firebase.firestore.FieldValue.serverTimestamp()
        });
    };

    // recvonly — we don't send any media
    pc.addTransceiver('audio', { direction: 'recvonly' });
    pc.addTransceiver('video', { direction: 'recvonly' });

    // Write viewer doc so broadcaster notices us
    await _db.collection('livestreams').doc(streamId)
      .collection('viewers').doc(_myUid).set({
        uid:      _myUid,
        name:     _myName,
        avatar:   _myAvatar,
        active:   true,
        joinedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

    await _db.collection('livestreams').doc(streamId).update({
      viewerCount: firebase.firestore.FieldValue.increment(1)
    });

    // Wait for broadcaster's offer
    var u1 = _db.collection('livestreams').doc(streamId)
      .collection('viewers').doc(_myUid)
      .onSnapshot(async function(snap) {
        if (!snap.exists) return;
        var d = snap.data();
        if (d.offer && !pc.currentRemoteDescription) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(d.offer));
            var ans = await pc.createAnswer();
            await pc.setLocalDescription(ans);
            await _db.collection('livestreams').doc(streamId)
              .collection('viewers').doc(_myUid)
              .update({ answer: { type: ans.type, sdp: ans.sdp } });
          } catch(e) { _log('answer error:', e); }
        }
      });
    _unsubscribers.push(u1);

    // Broadcaster ICE → us
    var u2 = _db.collection('livestreams').doc(streamId)
      .collection('bcCandidates').doc(_myUid)
      .collection('candidates').onSnapshot(function(snap) {
        snap.docChanges().forEach(async function(ch) {
          if (ch.type !== 'added') return;
          try { await pc.addIceCandidate(new RTCIceCandidate(ch.doc.data().c)); } catch(e) {}
        });
      });
    _unsubscribers.push(u2);

    // Watch for stream end
    var u3 = _db.collection('livestreams').doc(streamId).onSnapshot(function(snap) {
      if (!snap.exists || snap.data().status === 'ended') {
        _showStreamEnded();
        _cleanup();
      }
    });
    _unsubscribers.push(u3);

    _showViewerUI(data);
  }

  async function leaveStream() {
    if (!_streamId || _isBc) return;
    var sid = _streamId;
    _cleanup();
    try {
      await _db.collection('livestreams').doc(sid).collection('viewers').doc(_myUid).update({ active: false });
      await _db.collection('livestreams').doc(sid).update({
        viewerCount: firebase.firestore.FieldValue.increment(-1)
      });
    } catch(e) {}
  }

  // ── UI ──────────────────────────────────────────────────────────────

  function _showBroadcastUI() {
    var el = document.getElementById('glive-broadcast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'glive-broadcast';
      el.className = 'glive-overlay';
      el.innerHTML =
        '<div class="glive-bc-card">' +
          '<video id="glive-local-video" autoplay muted playsinline></video>' +
          '<div class="glive-bc-bar">' +
            '<span class="glive-badge-lg">● LIVE</span>' +
            '<span class="glive-vc-wrap"><i class="fas fa-eye"></i> <span id="glive-vc">0</span></span>' +
            '<button class="gco-btn gco-btn-sec" id="glive-mic-btn" onclick="GhLivestream._toggleMic()">' +
              '<i class="fas fa-microphone" id="glive-mic-icon"></i>' +
            '</button>' +
            '<button class="gco-btn gco-btn-sec" id="glive-cam-btn" onclick="GhLivestream._toggleCam()">' +
              '<i class="fas fa-video" id="glive-cam-icon"></i>' +
            '</button>' +
            '<button class="gco-btn gco-btn-end" onclick="GhLivestream.stopStream()">' +
              '<i class="fas fa-stop"></i> ' + _t('live_stop', 'End') +
            '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(el);
    }
    el.style.display = 'flex';
    var vid = document.getElementById('glive-local-video');
    if (vid && _localStream) vid.srcObject = _localStream;
  }

  function _showViewerUI(streamData) {
    var el = document.getElementById('glive-viewer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'glive-viewer';
      el.className = 'glive-overlay';
      el.innerHTML =
        '<div class="glive-bc-card">' +
          '<video id="glive-remote-video" autoplay playsinline></video>' +
          '<div class="glive-bc-bar">' +
            '<span class="glive-badge-lg">● LIVE</span>' +
            '<span>' + _esc((streamData && streamData.hostName) || 'Host') + '</span>' +
            '<button class="gco-btn gco-btn-end" onclick="GhLivestream.leaveStream()">' +
              '<i class="fas fa-times"></i>' +
            '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(el);
    }
    el.style.display = 'flex';
  }

  function _showStreamEnded() {
    var el = document.getElementById('glive-viewer');
    if (!el) return;
    var msg = el.querySelector('.glive-ended-msg');
    if (msg) return;
    msg = document.createElement('div');
    msg.className = 'glive-ended-msg';
    msg.innerHTML = '<i class="fas fa-stop-circle"></i><p>' + _t('live_stream_ended', 'Stream ended') + '</p>';
    var card = el.querySelector('.glive-bc-card');
    if (card) card.appendChild(msg);
  }

  // ── MIC / CAM (broadcaster) ────────────────────────────────────────

  function _toggleMic() {
    if (!_localStream) return;
    var t = _localStream.getAudioTracks()[0]; if (!t) return;
    t.enabled = !t.enabled;
    var ic = document.getElementById('glive-mic-icon');
    if (ic) ic.className = t.enabled ? 'fas fa-microphone' : 'fas fa-microphone-slash';
    var btn = document.getElementById('glive-mic-btn');
    if (btn) btn.classList.toggle('gco-btn-muted', !t.enabled);
  }

  function _toggleCam() {
    if (!_localStream) return;
    var t = _localStream.getVideoTracks()[0]; if (!t) return;
    t.enabled = !t.enabled;
    var ic = document.getElementById('glive-cam-icon');
    if (ic) ic.className = t.enabled ? 'fas fa-video' : 'fas fa-video-slash';
    var btn = document.getElementById('glive-cam-btn');
    if (btn) btn.classList.toggle('gco-btn-muted', !t.enabled);
  }

  // ── GO-LIVE MODAL ──────────────────────────────────────────────────

  function openGoLiveModal() {
    if (!_myUid) { alert(_t('login_required', 'Please log in first')); return; }
    var modal = document.getElementById('glive-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'glive-modal';
      modal.className = 'ggc-modal-bg';
      modal.innerHTML =
        '<div class="ggc-modal">' +
          '<h3>' + _t('live_go_live', 'Go Live') + '</h3>' +
          '<label>' + _t('live_title_label', 'Stream title') + '</label>' +
          '<input id="glive-title-input" class="ggc-id-box" placeholder="' +
            _t('live_title_placeholder', 'What are you streaming?') + '" maxlength="80">' +
          '<div style="display:flex;gap:10px;margin-top:16px">' +
            '<button class="ggc-action-btn" onclick="GhLivestream._goLive()">' +
              '<i class="fas fa-broadcast-tower"></i> ' + _t('live_start', 'Start Streaming') +
            '</button>' +
            '<button class="ggc-cancel-btn" onclick="GhLivestream._closeGoLive()">' +
              _t('cancel', 'Cancel') +
            '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    var inp = document.getElementById('glive-title-input');
    if (inp) { inp.value = ''; inp.focus(); }
  }

  function _closeGoLive() {
    var modal = document.getElementById('glive-modal');
    if (modal) modal.style.display = 'none';
  }

  async function _goLive() {
    var inp = document.getElementById('glive-title-input');
    var title = inp ? inp.value.trim() : '';
    _closeGoLive();
    await startStream(title);
  }

  // ── CLEANUP ────────────────────────────────────────────────────────

  function _cleanup() {
    _unsubscribers.forEach(function(u) { try { u(); } catch(e) {} });
    _unsubscribers = [];
    Object.values(_viewerPCs).forEach(function(pc) { try { pc.close(); } catch(e) {} });
    _viewerPCs = {};
    if (_viewerPC) { try { _viewerPC.close(); } catch(e) {} _viewerPC = null; }
    if (_localStream) { _localStream.getTracks().forEach(function(t) { t.stop(); }); _localStream = null; }
    var bel = document.getElementById('glive-broadcast');
    if (bel) bel.style.display = 'none';
    var vel = document.getElementById('glive-viewer');
    if (vel) vel.style.display = 'none';
    _streamId = null;
    _isBc = false;
  }

  // ── PUBLIC API ─────────────────────────────────────────────────────

  window.GhLivestream = {
    startStream:      startStream,
    stopStream:       stopStream,
    joinStream:       joinStream,
    leaveStream:      leaveStream,
    openGoLiveModal:  openGoLiveModal,
    _closeGoLive:     _closeGoLive,
    _goLive:          _goLive,
    _toggleMic:       _toggleMic,
    _toggleCam:       _toggleCam,
    reload:           _loadStreams
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else { setTimeout(_init, 0); }
})();
