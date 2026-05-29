/* gh-calls.js — GeoHub WebRTC Voice & Video Calls
   Signaling via Firestore  |  Media via WebRTC
   Firestore schema:
     calls/{callId}: { callerId, calleeId, callerName, callerAvatar,
                       calleeName, calleeAvatar, type, status, offer, answer, createdAt }
     calls/{callId}/callerCandidates/{id}: ICE candidate JSON
     calls/{callId}/calleeCandidates/{id}: ICE candidate JSON
*/
(function () {
  'use strict';

  window.GhCalls = window.GhCalls || {};
  var GC = window.GhCalls;

  /* ── State ───────────────────────────────────────────────────── */
  var _db, _fs, _auth;
  var _pc = null;
  var _localStream = null;
  var _remoteStream = null;
  var _callId = null;
  var _myRole = null;       // 'caller' | 'callee'
  var _callType = null;     // 'audio' | 'video'
  var _callState = null;    // 'ringing' | 'active' | 'ended'
  var _unsubCall = null;
  var _unsubCandidates = null;
  var _incomingUnsub = null;
  var _ringtoneIv = null;
  var _timerIv = null;
  var _timerSec = 0;
  var _audioCtx = null;

  var ICE = { iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]};

  /* ── Helpers ─────────────────────────────────────────────────── */
  function _t(k, fb) {
    if (typeof window.GHt === 'function') { var v = window.GHt(k); if (v && v !== k) return v; }
    return fb || k;
  }
  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function _initials(n) { return (n || '?').trim().split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase(); }
  function _fb() {
    if (_db && _fs && _auth) return true;
    var GF = window.GeoFirebase; if (!GF) return false;
    _db = GF.db; _fs = GF.fs; _auth = GF.auth;
    return !!(GF.db && GF.fs && GF.auth);
  }
  function _me() { return _auth && _auth.currentUser; }
  function _toast(msg, type) { if (window.GeoSocial && window.GeoSocial.toast) window.GeoSocial.toast(msg, type); }

  /* ── Ringtone (Web Audio) ────────────────────────────────────── */
  function _ring(outgoing) {
    _stopRing();
    try {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return; }
    var tick = 0;
    var interval = outgoing ? 800 : 1600;
    function beep() {
      if (!_audioCtx || tick > 60) return;
      var o = _audioCtx.createOscillator();
      var g = _audioCtx.createGain();
      o.connect(g); g.connect(_audioCtx.destination);
      o.type = 'sine';
      o.frequency.value = outgoing ? (tick % 2 === 0 ? 440 : 480) : 480;
      g.gain.setValueAtTime(0.12, _audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + 0.28);
      o.start(); o.stop(_audioCtx.currentTime + 0.28);
      tick++;
    }
    beep();
    _ringtoneIv = setInterval(beep, interval);
  }
  function _stopRing() {
    clearInterval(_ringtoneIv); _ringtoneIv = null;
    try { if (_audioCtx) { _audioCtx.close(); _audioCtx = null; } } catch (e) {}
  }

  /* ── Timer ───────────────────────────────────────────────────── */
  function _startTimer() {
    _timerSec = 0;
    _timerIv = setInterval(function () {
      _timerSec++;
      var m = Math.floor(_timerSec / 60), s = _timerSec % 60;
      var el = document.getElementById('ghCallTimer');
      if (el) el.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }, 1000);
  }
  function _stopTimer() { clearInterval(_timerIv); _timerIv = null; }

  /* ── Overlay UI ──────────────────────────────────────────────── */
  function _overlay() {
    var el = document.getElementById('ghCallOverlay');
    if (!el) { el = document.createElement('div'); el.id = 'ghCallOverlay'; document.body.appendChild(el); }
    return el;
  }

  function _avatarHtml(avatar, name) {
    if (avatar) return '<img src="' + _esc(avatar) + '" alt="" onerror="this.style.display=\'none\'">';
    return '<div class="gco-av-init">' + _esc(_initials(name)) + '</div>';
  }

  function _showRinging(name, avatar, type) {
    var ov = _overlay();
    ov.className = 'gco gco-ringing';
    ov.innerHTML =
      '<div class="gco-card">' +
        '<div class="gco-av-wrap"><div class="gco-av-ring"></div><div class="gco-av">' + _avatarHtml(avatar, name) + '</div></div>' +
        '<div class="gco-name">' + _esc(name) + '</div>' +
        '<div class="gco-status" id="ghCallStatus">' + _t('call_calling', 'Calling…') + '</div>' +
        '<div class="gco-timer" id="ghCallTimer" style="display:none">00:00</div>' +
        (type === 'video' ? '<div class="gco-video-wrap"><video id="ghRemoteVideo" autoplay playsinline class="gco-remote-video"></video><video id="ghLocalVideo" autoplay muted playsinline class="gco-local-video"></video></div>' : '<div class="gco-audio-icon"><i class="fas fa-phone-volume"></i></div>') +
        '<div class="gco-controls">' +
          (type === 'video' ? '<button class="gco-btn gco-btn-sec" id="ghCamBtn" onclick="GhCalls.toggleCamera()" title="' + _t('call_toggle_cam', 'Toggle camera') + '"><i class="fas fa-video"></i></button>' : '') +
          '<button class="gco-btn gco-btn-sec" id="ghMuteBtn" onclick="GhCalls.toggleMute()" title="' + _t('call_toggle_mute', 'Toggle mute') + '"><i class="fas fa-microphone"></i></button>' +
          '<button class="gco-btn gco-btn-end" onclick="GhCalls.endCall()" title="' + _t('call_end', 'End call') + '"><i class="fas fa-phone-slash"></i></button>' +
        '</div>' +
      '</div>';
    ov.style.display = 'flex';
  }

  function _showIncoming(name, avatar, type, callId) {
    var ov = _overlay();
    ov.className = 'gco gco-incoming';
    ov.innerHTML =
      '<div class="gco-card">' +
        '<div class="gco-type-badge"><i class="fas fa-' + (type === 'video' ? 'video' : 'phone') + '"></i> ' + _t(type === 'video' ? 'call_video_in' : 'call_voice_in', type === 'video' ? 'Incoming video call' : 'Incoming voice call') + '</div>' +
        '<div class="gco-av-wrap"><div class="gco-av-pulse"></div><div class="gco-av">' + _avatarHtml(avatar, name) + '</div></div>' +
        '<div class="gco-name">' + _esc(name) + '</div>' +
        '<div class="gco-status">' + _t(type === 'video' ? 'call_wants_video' : 'call_wants_voice', type === 'video' ? 'wants to video call' : 'is calling you') + '</div>' +
        '<div class="gco-incoming-row">' +
          '<button class="gco-btn gco-btn-end" onclick="GhCalls.declineCall(\'' + _esc(callId) + '\')">' +
            '<i class="fas fa-phone-slash"></i><span>' + _t('call_decline', 'Decline') + '</span>' +
          '</button>' +
          '<button class="gco-btn gco-btn-accept" onclick="GhCalls.acceptCall(\'' + _esc(callId) + '\',\'' + _esc(type) + '\')">' +
            '<i class="fas fa-phone"></i><span>' + _t('call_accept', 'Accept') + '</span>' +
          '</button>' +
        '</div>' +
      '</div>';
    ov.style.display = 'flex';
  }

  function _transitionToActive(name, avatar, type) {
    _callState = 'active';
    var statusEl = document.getElementById('ghCallStatus');
    if (statusEl) statusEl.textContent = _t('call_connected', 'Connected');
    var timerEl = document.getElementById('ghCallTimer');
    if (timerEl) timerEl.style.display = '';
    var ov = _overlay();
    ov.classList.remove('gco-ringing', 'gco-incoming');
    ov.classList.add('gco-active');
    if (type === 'video') {
      var lv = document.getElementById('ghLocalVideo');
      var rv = document.getElementById('ghRemoteVideo');
      if (lv && _localStream) lv.srcObject = _localStream;
      if (rv && _remoteStream) rv.srcObject = _remoteStream;
    }
    _startTimer();
  }

  function _buildActiveUI(name, avatar, type) {
    var ov = _overlay();
    ov.className = 'gco gco-active';
    ov.innerHTML =
      '<div class="gco-card">' +
        (type === 'video' ? '<div class="gco-video-wrap"><video id="ghRemoteVideo" autoplay playsinline class="gco-remote-video"></video><video id="ghLocalVideo" autoplay muted playsinline class="gco-local-video"></video></div>' : '<div class="gco-audio-icon"><i class="fas fa-phone-volume"></i></div>') +
        '<div class="gco-av-wrap"><div class="gco-av">' + _avatarHtml(avatar, name) + '</div></div>' +
        '<div class="gco-name">' + _esc(name) + '</div>' +
        '<div class="gco-status" id="ghCallStatus">' + _t('call_connected', 'Connected') + '</div>' +
        '<div class="gco-timer" id="ghCallTimer">00:00</div>' +
        '<div class="gco-controls">' +
          (type === 'video' ? '<button class="gco-btn gco-btn-sec" id="ghCamBtn" onclick="GhCalls.toggleCamera()" title="' + _t('call_toggle_cam', 'Toggle camera') + '"><i class="fas fa-video"></i></button>' : '') +
          '<button class="gco-btn gco-btn-sec" id="ghMuteBtn" onclick="GhCalls.toggleMute()" title="' + _t('call_toggle_mute', 'Toggle mute') + '"><i class="fas fa-microphone"></i></button>' +
          '<button class="gco-btn gco-btn-end" onclick="GhCalls.endCall()" title="' + _t('call_end', 'End call') + '"><i class="fas fa-phone-slash"></i></button>' +
        '</div>' +
      '</div>';
    ov.style.display = 'flex';
    var lv = document.getElementById('ghLocalVideo');
    var rv = document.getElementById('ghRemoteVideo');
    if (lv && _localStream) lv.srcObject = _localStream;
    if (rv && _remoteStream) rv.srcObject = _remoteStream;
    _startTimer();
  }

  function _hideOverlay() {
    var ov = document.getElementById('ghCallOverlay');
    if (ov) { ov.style.display = 'none'; ov.innerHTML = ''; ov.className = ''; }
  }

  /* ── RTCPeerConnection ───────────────────────────────────────── */
  function _createPC(callId, role) {
    _pc = new RTCPeerConnection(ICE);
    _remoteStream = new MediaStream();

    _pc.onicecandidate = function (e) {
      if (!e.candidate || !_fb()) return;
      var col = role === 'caller' ? 'callerCandidates' : 'calleeCandidates';
      _fs.addDoc(_fs.collection(_db, 'calls', callId, col), e.candidate.toJSON()).catch(function () {});
    };

    _pc.ontrack = function (e) {
      (e.streams[0] ? e.streams[0].getTracks() : [e.track]).forEach(function (t) { _remoteStream.addTrack(t); });
      var rv = document.getElementById('ghRemoteVideo');
      if (rv) rv.srcObject = _remoteStream;
    };

    _pc.onconnectionstatechange = function () {
      if (_pc && (_pc.connectionState === 'disconnected' || _pc.connectionState === 'failed')) {
        GC.endCall();
      }
    };

    return _pc;
  }

  function _listenCandidates(callId, col) {
    if (_unsubCandidates) { _unsubCandidates(); _unsubCandidates = null; }
    _unsubCandidates = _fs.onSnapshot(
      _fs.collection(_db, 'calls', callId, col),
      function (snap) {
        snap.docChanges().forEach(function (ch) {
          if (ch.type === 'added' && _pc && _pc.remoteDescription) {
            _pc.addIceCandidate(new RTCIceCandidate(ch.doc.data())).catch(function () {});
          }
        });
      }
    );
  }

  /* ── Public: startCall ───────────────────────────────────────── */
  GC.startCall = async function (targetUid, targetName, targetAvatar, type) {
    if (!_fb()) { _toast(_t('call_not_ready', 'System not ready'), 'error'); return; }
    var me = _me();
    if (!me) { if (window.GeoSocial && window.GeoSocial.requireAuth) window.GeoSocial.requireAuth(); return; }
    if (_callId) { _toast(_t('call_already_active', 'Already in a call'), 'error'); return; }

    type = type || 'audio';
    _callType = type; _myRole = 'caller'; _callState = 'ringing';

    // Caller profile
    var callerName = me.displayName || me.email || 'User';
    var callerAvatar = me.photoURL || '';
    try {
      var mySnap = await _fs.getDoc(_fs.doc(_db, 'users', me.uid));
      if (mySnap.exists()) {
        var d = mySnap.data();
        callerName = d.fullName || d.displayName || d.username || callerName;
        callerAvatar = d.avatar || callerAvatar;
      }
    } catch (e) {}

    // Get media
    try {
      _localStream = await navigator.mediaDevices.getUserMedia(
        type === 'video' ? { video: { facingMode: 'user' }, audio: true } : { audio: true }
      );
    } catch (e) {
      _toast(_t('call_media_denied', 'Microphone/camera access denied'), 'error');
      return;
    }

    _showRinging(targetName, targetAvatar, type);
    if (type === 'video') {
      var lv = document.getElementById('ghLocalVideo');
      if (lv && _localStream) lv.srcObject = _localStream;
    }
    _ring(true);

    // Firestore call doc
    var ref = _fs.doc(_fs.collection(_db, 'calls'));
    _callId = ref.id;
    _createPC(_callId, 'caller');
    _localStream.getTracks().forEach(function (t) { _pc.addTrack(t, _localStream); });

    var offer = await _pc.createOffer();
    await _pc.setLocalDescription(offer);

    await _fs.setDoc(ref, {
      callerId: me.uid, calleeId: targetUid,
      callerName: callerName, callerAvatar: callerAvatar,
      calleeName: targetName, calleeAvatar: targetAvatar || '',
      type: type, status: 'ringing',
      offer: { type: offer.type, sdp: offer.sdp },
      createdAt: _fs.serverTimestamp()
    });

    // Listen for answer / status
    _unsubCall = _fs.onSnapshot(_fs.doc(_db, 'calls', _callId), async function (snap) {
      var data = snap.data();
      if (!data) return;
      if (data.status === 'active' && data.answer && _pc && !_pc.currentRemoteDescription) {
        await _pc.setRemoteDescription(new RTCSessionDescription(data.answer)).catch(function () {});
        _listenCandidates(_callId, 'calleeCandidates');
        _stopRing();
        _transitionToActive(targetName, targetAvatar, type);
      } else if (data.status === 'declined') {
        _stopRing();
        var st = document.getElementById('ghCallStatus');
        if (st) st.textContent = _t('call_declined', 'Call declined');
        setTimeout(function () { _cleanupLocal(); }, 1800);
      } else if (data.status === 'missed') {
        _stopRing();
        var st2 = document.getElementById('ghCallStatus');
        if (st2) st2.textContent = _t('call_no_answer', 'No answer');
        setTimeout(function () { _cleanupLocal(); }, 1800);
      } else if (data.status === 'ended' && _callState === 'active') {
        _cleanupLocal();
      }
    });

    // Auto-timeout 45 s
    setTimeout(function () {
      if (_callId && _callState === 'ringing') GC.endCall('missed');
    }, 45000);
  };

  /* ── Public: acceptCall ──────────────────────────────────────── */
  GC.acceptCall = async function (callId, type) {
    if (!_fb()) return;
    var me = _me(); if (!me) return;
    _stopRing();
    type = type || 'audio';
    _callId = callId; _callType = type; _myRole = 'callee'; _callState = 'active';

    var ref = _fs.doc(_db, 'calls', callId);
    var snap = await _fs.getDoc(ref);
    if (!snap.exists()) return;
    var data = snap.data();

    // Get media
    try {
      _localStream = await navigator.mediaDevices.getUserMedia(
        type === 'video' ? { video: { facingMode: 'user' }, audio: true } : { audio: true }
      );
    } catch (e) {
      _toast(_t('call_media_denied', 'Microphone/camera access denied'), 'error');
      GC.declineCall(callId); return;
    }

    _buildActiveUI(data.callerName || 'Unknown', data.callerAvatar || '', type);

    _createPC(callId, 'callee');
    _localStream.getTracks().forEach(function (t) { _pc.addTrack(t, _localStream); });

    await _pc.setRemoteDescription(new RTCSessionDescription(data.offer)).catch(function () {});
    var answer = await _pc.createAnswer();
    await _pc.setLocalDescription(answer);
    await _fs.updateDoc(ref, { answer: { type: answer.type, sdp: answer.sdp }, status: 'active' });

    _listenCandidates(callId, 'callerCandidates');

    _unsubCall = _fs.onSnapshot(ref, function (s2) {
      var d = s2.data();
      if (d && (d.status === 'ended' || d.status === 'declined') && _callState === 'active') {
        _cleanupLocal();
      }
    });
  };

  /* ── Public: declineCall ─────────────────────────────────────── */
  GC.declineCall = async function (callId) {
    _stopRing(); _hideOverlay();
    if (_fb() && callId) {
      try { await _fs.updateDoc(_fs.doc(_db, 'calls', callId), { status: 'declined' }); } catch (e) {}
    }
    _cleanupLocal();
  };

  /* ── Public: endCall ─────────────────────────────────────────── */
  GC.endCall = async function (reason) {
    _stopRing(); _stopTimer();
    var id = _callId;
    _cleanupLocal();
    if (_fb() && id) {
      try { await _fs.updateDoc(_fs.doc(_db, 'calls', id), { status: reason || 'ended' }); } catch (e) {}
    }
  };

  /* ── Public: toggleMute ──────────────────────────────────────── */
  GC.toggleMute = function () {
    if (!_localStream) return;
    var t = _localStream.getAudioTracks()[0]; if (!t) return;
    t.enabled = !t.enabled;
    var btn = document.getElementById('ghMuteBtn');
    if (btn) {
      btn.innerHTML = t.enabled ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';
      btn.classList.toggle('gco-btn-muted', !t.enabled);
    }
  };

  /* ── Public: toggleCamera ────────────────────────────────────── */
  GC.toggleCamera = function () {
    if (!_localStream) return;
    var t = _localStream.getVideoTracks()[0]; if (!t) return;
    t.enabled = !t.enabled;
    var btn = document.getElementById('ghCamBtn');
    if (btn) {
      btn.innerHTML = t.enabled ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';
      btn.classList.toggle('gco-btn-muted', !t.enabled);
    }
  };

  /* ── Cleanup ─────────────────────────────────────────────────── */
  function _cleanupLocal() {
    if (_unsubCall) { _unsubCall(); _unsubCall = null; }
    if (_unsubCandidates) { _unsubCandidates(); _unsubCandidates = null; }
    if (_pc) { _pc.close(); _pc = null; }
    if (_localStream) { _localStream.getTracks().forEach(function (t) { t.stop(); }); _localStream = null; }
    _remoteStream = null;
    _callId = null; _myRole = null; _callType = null; _callState = null;
    _stopTimer(); _stopRing(); _hideOverlay();
  }

  /* ── Listen for incoming calls ───────────────────────────────── */
  GC.startListening = function () {
    if (!_fb()) return;
    var me = _me(); if (!me) return;
    if (_incomingUnsub) { _incomingUnsub(); _incomingUnsub = null; }

    _incomingUnsub = _fs.onSnapshot(
      _fs.query(
        _fs.collection(_db, 'calls'),
        _fs.where('calleeId', '==', me.uid),
        _fs.where('status', '==', 'ringing'),
        _fs.orderBy('createdAt', 'desc'),
        _fs.limit(1)
      ),
      function (snap) {
        snap.docChanges().forEach(function (ch) {
          if (ch.type !== 'added') return;
          var data = ch.doc.data();
          var cid = ch.doc.id;
          if (_callId) return; // already in call
          // Ignore stale calls (>30 s old)
          if (data.createdAt) {
            var ms = data.createdAt.toMillis ? data.createdAt.toMillis() : data.createdAt.seconds * 1000;
            if (Date.now() - ms > 30000) return;
          }
          _showIncoming(data.callerName || 'Unknown', data.callerAvatar || '', data.type || 'audio', cid);
          _ring(false);
        });
      }
    );
  };

  /* ── Init ────────────────────────────────────────────────────── */
  function _init() {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (_fb() && _me()) { clearInterval(iv); GC.startListening(); return; }
      if (tries > 60) clearInterval(iv);
    }, 500);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(_init, 1200); });
  } else { setTimeout(_init, 1200); }
  window.addEventListener('GeoFirebaseReady', function () { if (_fb()) setTimeout(_init, 300); });

})();
