/* gh-calls.js — GeoHub WebRTC Voice & Video Calls
   Signaling via Firestore  |  Media via WebRTC
   Firestore schema:
     calls/{callId}: { callerId, calleeId, callerName, callerAvatar,
                       calleeName, calleeAvatar, type, status, offer, answer,
                       createdAt, endedAt, duration }
     calls/{callId}/callerCandidates/{id}: ICE candidate JSON
     calls/{callId}/calleeCandidates/{id}: ICE candidate JSON
     calls/{callId}/messages/{id}: { uid, text, createdAt }
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
  var _myRole = null;
  var _callType = null;
  var _callState = null;
  var _unsubCall = null;
  var _unsubCandidates = null;
  var _incomingUnsub = null;
  var _ringtoneIv = null;
  var _timerIv = null;
  var _timerSec = 0;
  var _audioCtx = null;
  var _pendingCandidates = [];
  var _cachedIce = null;
  var _cachedIceAt = 0;
  var _screenStream = null;
  var _facingMode = 'user';
  var _chatUnsub = null;
  var _chatOpen = false;
  var _qualityIv = null;
  var _callStartMs = 0;

  // Static fallback — used if the worker fetch fails
  var ICE = { iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turns:openrelay.metered.ca:443'],
      username: 'openrelayproject', credential: 'openrelayproject' }
  ], iceCandidatePoolSize: 10 };

  async function _getIceConfig() {
    var now = Date.now();
    // Reuse cached credentials for up to 23 hours (TTL is 24 h)
    if (_cachedIce && (now - _cachedIceAt < 23 * 3600 * 1000)) return _cachedIce;
    try {
      var workerUrl = (window.GeoConfig && window.GeoConfig.PAYMENTS && window.GeoConfig.PAYMENTS.WORKER_URL)
                      || 'https://geohub-payments.gio-papinashvili20-bd3.workers.dev';
      var res = await fetch(workerUrl + '/api/turn-credentials');
      if (res.ok) {
        var data = await res.json();
        if (data && data.iceServers && data.iceServers.length) {
          _cachedIce = { iceServers: data.iceServers, iceCandidatePoolSize: 10 };
          _cachedIceAt = now;
          return _cachedIce;
        }
      }
    } catch (e) {}
    return ICE;
  }

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
  function _workerUrl() {
    return ((window.GeoConfig && window.GeoConfig.PAYMENTS && window.GeoConfig.PAYMENTS.WORKER_URL)
      || 'https://geohub-payments.gio-papinashvili20-bd3.workers.dev').replace(/\/$/, '');
  }
  function _sendCallNotification(calleeUid, callerName, callerAvatar, callType, callId) {
    fetch(_workerUrl() + '/api/notify-call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calleeUid, callerName, callerAvatar, callType, callId })
    }).catch(function () {});
  }

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
        (type === 'video'
          ? '<video id="ghRemoteVideo" autoplay playsinline class="gco-remote-video"></video>' +
            '<video id="ghLocalVideo" autoplay muted playsinline class="gco-local-video"></video>'
          : '<div class="gco-audio-bg"></div>' +
            '<audio id="ghCallAudio" autoplay style="display:none"></audio>') +
        '<div class="gco-top">' +
          '<div class="gco-name">' + _esc(name) + '</div>' +
          '<div class="gco-status" id="ghCallStatus">' + _t('call_calling', 'Calling…') + '</div>' +
          '<div class="gco-timer" id="ghCallTimer" style="display:none">00:00</div>' +
        '</div>' +
        (type !== 'video'
          ? '<div class="gco-middle">' +
              '<div class="gco-av-wrap"><div class="gco-av-ring"></div><div class="gco-av">' + _avatarHtml(avatar, name) + '</div></div>' +
            '</div>'
          : '') +
        '<div class="gco-bottom">' + _controlsHtml(type) + '</div>' +
      '</div>';
    ov.style.display = 'block';
  }

  function _showIncoming(name, avatar, type, callId) {
    var ov = _overlay();
    ov.className = 'gco gco-incoming';
    ov.innerHTML =
      '<div class="gco-card">' +
        '<div class="gco-incoming-info">' +
          '<div class="gco-incoming-label"><i class="fas fa-' + (type === 'video' ? 'video' : 'phone') + '"></i> ' + _t(type === 'video' ? 'call_video_in' : 'call_voice_in', type === 'video' ? 'Incoming video call' : 'Incoming voice call') + '</div>' +
          '<div class="gco-av-wrap"><div class="gco-av-pulse"></div><div class="gco-av">' + _avatarHtml(avatar, name) + '</div></div>' +
          '<div class="gco-name">' + _esc(name) + '</div>' +
        '</div>' +
        '<div class="gco-incoming-row">' +
          '<div class="gco-btn-wrap">' +
            '<button class="gco-btn gco-btn-end" onclick="GhCalls.declineCall(\'' + _esc(callId) + '\')"><i class="fas fa-phone-slash"></i></button>' +
            '<span>' + _t('call_decline', 'Decline') + '</span>' +
          '</div>' +
          '<div class="gco-btn-wrap">' +
            '<button class="gco-btn gco-btn-accept" onclick="GhCalls.acceptCall(\'' + _esc(callId) + '\',\'' + _esc(type) + '\')"><i class="fas fa-phone"></i></button>' +
            '<span>' + _t('call_accept', 'Accept') + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    ov.style.display = 'block';
  }

  function _transitionToActive(name, avatar, type) {
    _callState = 'active';
    _buildActiveUI(name, avatar, type);
  }

  function _buildActiveUI(name, avatar, type) {
    var ov = _overlay();
    ov.className = 'gco gco-active';
    ov.innerHTML =
      '<div class="gco-card">' +
        (type === 'video'
          ? '<video id="ghRemoteVideo" autoplay playsinline class="gco-remote-video"></video>' +
            '<video id="ghLocalVideo" autoplay muted playsinline class="gco-local-video"></video>'
          : '<div class="gco-audio-bg"></div>' +
            '<audio id="ghCallAudio" autoplay style="display:none"></audio>') +
        '<div class="gco-top">' +
          '<div class="gco-name">' + _esc(name) + '</div>' +
          '<div class="gco-status" id="ghCallStatus">' + _t('call_connected', 'Connected') + '</div>' +
          '<div class="gco-timer-row"><div class="gco-timer" id="ghCallTimer">00:00</div><i class="fas fa-signal gco-quality" id="ghCallQuality" style="color:rgba(255,255,255,.4)"></i></div>' +
        '</div>' +
        (type !== 'video'
          ? '<div class="gco-middle"><div class="gco-av-wrap"><div class="gco-av">' + _avatarHtml(avatar, name) + '</div></div></div>'
          : '') +
        '<div class="gco-bottom">' + _controlsHtml(type) + '</div>' +
      '</div>';
    ov.style.display = 'block';
    var lv = document.getElementById('ghLocalVideo');
    var rv = document.getElementById('ghRemoteVideo');
    if (lv && _localStream) { lv.srcObject = _localStream; _makeDraggable(lv); }
    if (rv && _remoteStream) rv.srcObject = _remoteStream;
    _callStartMs = Date.now();
    _startTimer();
    _startQuality();
  }

  function _hideOverlay() {
    var ov = document.getElementById('ghCallOverlay');
    if (ov) { ov.style.display = 'none'; ov.innerHTML = ''; ov.className = ''; }
  }

  /* ── Draggable PiP ──────────────────────────────────────────── */
  function _makeDraggable(el) {
    var sx, sy, sl, st, dragging = false;
    function start(cx, cy) {
      dragging = true; sx = cx; sy = cy;
      var r = el.getBoundingClientRect(); sl = r.left; st = r.top;
      el.style.transition = 'none'; el.style.cursor = 'grabbing';
    }
    function move(cx, cy) {
      if (!dragging) return;
      var nl = sl + cx - sx, nt = st + cy - sy;
      nl = Math.max(8, Math.min(window.innerWidth  - el.offsetWidth  - 8, nl));
      nt = Math.max(8, Math.min(window.innerHeight - el.offsetHeight - 8, nt));
      el.style.left = nl + 'px'; el.style.top = nt + 'px';
      el.style.right = 'auto'; el.style.bottom = 'auto';
    }
    function end() { dragging = false; el.style.cursor = 'grab'; }
    el.addEventListener('mousedown',  function(e) { e.preventDefault(); start(e.clientX, e.clientY); });
    document.addEventListener('mousemove', function(e) { move(e.clientX, e.clientY); });
    document.addEventListener('mouseup',   end);
    el.addEventListener('touchstart', function(e) { start(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    document.addEventListener('touchmove', function(e) { if (dragging) { e.preventDefault(); move(e.touches[0].clientX, e.touches[0].clientY); } }, { passive: false });
    document.addEventListener('touchend', end);
  }

  /* ── Controls HTML builder ───────────────────────────────────── */
  function _controlsHtml(type) {
    var canScreen = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
    var canPiP    = !!(document.pictureInPictureEnabled);
    var isMobile  = /Mobi|Android/i.test(navigator.userAgent);
    var html = '<div class="gco-controls">';
    if (type === 'video') {
      html += '<button class="gco-btn gco-btn-sec" id="ghCamBtn"    onclick="GhCalls.toggleCamera()"><i class="fas fa-video"></i></button>';
      if (isMobile)  html += '<button class="gco-btn gco-btn-sec" id="ghFlipBtn"   onclick="GhCalls.flipCamera()"><i class="fas fa-camera-rotate"></i></button>';
      if (canScreen) html += '<button class="gco-btn gco-btn-sec" id="ghScreenBtn" onclick="GhCalls.toggleScreenShare()"><i class="fas fa-desktop"></i></button>';
      if (canPiP)    html += '<button class="gco-btn gco-btn-sec" id="ghPiPBtn"    onclick="GhCalls.togglePiP()"><i class="fas fa-compress-alt"></i></button>';
    }
    html += '<button class="gco-btn gco-btn-sec" id="ghChatBtn" onclick="GhCalls.toggleChat()"><i class="fas fa-comment"></i></button>';
    html += '<button class="gco-btn gco-btn-sec" id="ghMuteBtn" onclick="GhCalls.toggleMute()"><i class="fas fa-microphone"></i></button>';
    html += '<button class="gco-btn gco-btn-end" onclick="GhCalls.endCall()"><i class="fas fa-phone-slash"></i></button>';
    html += '</div>';
    return html;
  }

  /* ── Quality indicator ───────────────────────────────────────── */
  function _startQuality() {
    _stopQuality();
    _qualityIv = setInterval(async function () {
      if (!_pc) { _stopQuality(); return; }
      try {
        var stats = await _pc.getStats();
        var rtt = null;
        stats.forEach(function (r) {
          if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.currentRoundTripTime != null)
            rtt = r.currentRoundTripTime * 1000;
        });
        var el = document.getElementById('ghCallQuality');
        if (!el) return;
        if (rtt === null)  { el.title = ''; el.style.color = 'rgba(255,255,255,.4)'; return; }
        if (rtt < 120)     { el.title = 'კარგი'; el.style.color = '#22c55e'; }
        else if (rtt < 280){ el.title = 'საშუალო'; el.style.color = '#f59e0b'; }
        else               { el.title = 'ცუდი';  el.style.color = '#ef4444'; }
      } catch (e) {}
    }, 3000);
  }
  function _stopQuality() { clearInterval(_qualityIv); _qualityIv = null; }

  /* ── RTCPeerConnection ───────────────────────────────────────── */
  function _createPC(callId, role, iceConfig) {
    _pc = new RTCPeerConnection(iceConfig || ICE);
    _remoteStream = new MediaStream();

    _pc.onicecandidate = function (e) {
      if (!e.candidate || !_fb()) return;
      var col = role === 'caller' ? 'callerCandidates' : 'calleeCandidates';
      _fs.addDoc(_fs.collection(_db, 'calls', callId, col), e.candidate.toJSON()).catch(function () {});
    };

    _pc.ontrack = function (e) {
      (e.streams[0] ? e.streams[0].getTracks() : [e.track]).forEach(function (t) { _remoteStream.addTrack(t); });
      // Attach to video element (video calls) or audio element (audio calls)
      var rv = document.getElementById('ghRemoteVideo');
      if (rv) { rv.srcObject = _remoteStream; }
      var au = document.getElementById('ghCallAudio');
      if (au) { au.srcObject = _remoteStream; }
    };

    _pc.onconnectionstatechange = function () {
      if (_pc && (_pc.connectionState === 'disconnected' || _pc.connectionState === 'failed')) {
        GC.endCall();
      }
    };

    return _pc;
  }

  function _flushCandidates() {
    if (!_pc || !_pc.remoteDescription) return;
    var q = _pendingCandidates.splice(0);
    q.forEach(function (c) { _pc.addIceCandidate(c).catch(function () {}); });
  }

  function _listenCandidates(callId, col) {
    if (_unsubCandidates) { _unsubCandidates(); _unsubCandidates = null; }
    _pendingCandidates = [];
    _unsubCandidates = _fs.onSnapshot(
      _fs.collection(_db, 'calls', callId, col),
      function (snap) {
        snap.docChanges().forEach(function (ch) {
          if (ch.type !== 'added') return;
          var candidate = new RTCIceCandidate(ch.doc.data());
          if (_pc && _pc.remoteDescription) {
            _pc.addIceCandidate(candidate).catch(function () {});
          } else {
            _pendingCandidates.push(candidate);
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
      if (lv && _localStream) { lv.srcObject = _localStream; _makeDraggable(lv); }
    }
    _ring(true);

    // Create Firestore doc FIRST so ICE candidate subcollection writes are allowed
    var ref = _fs.doc(_fs.collection(_db, 'calls'));
    _callId = ref.id;
    await _fs.setDoc(ref, {
      callerId: me.uid, calleeId: targetUid,
      callerName: callerName, callerAvatar: callerAvatar,
      calleeName: targetName, calleeAvatar: targetAvatar || '',
      type: type, status: 'ringing',
      createdAt: _fs.serverTimestamp()
    });

    // Push notification for callee (fire-and-forget)
    _sendCallNotification(targetUid, callerName, callerAvatar, type, _callId);

    // Now set up WebRTC (ICE candidates will write to existing doc's subcollection)
    var iceConfig = await _getIceConfig();
    _createPC(_callId, 'caller', iceConfig);
    _localStream.getTracks().forEach(function (t) { _pc.addTrack(t, _localStream); });

    var offer = await _pc.createOffer();
    await _pc.setLocalDescription(offer);

    // Update doc with offer SDP
    await _fs.updateDoc(ref, { offer: { type: offer.type, sdp: offer.sdp } });

    // Listen for answer / status
    _unsubCall = _fs.onSnapshot(_fs.doc(_db, 'calls', _callId), async function (snap) {
      var data = snap.data();
      if (!data) return;
      if (data.status === 'active' && data.answer && _pc && !_pc.currentRemoteDescription) {
        await _pc.setRemoteDescription(new RTCSessionDescription(data.answer)).catch(function () {});
        _flushCandidates();
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

    var iceConfig = await _getIceConfig();
    _createPC(callId, 'callee', iceConfig);
    _localStream.getTracks().forEach(function (t) { _pc.addTrack(t, _localStream); });

    // Start collecting remote candidates early (before setRemoteDescription)
    // so none are missed; they queue in _pendingCandidates until remoteDescription is set
    _listenCandidates(callId, 'callerCandidates');

    await _pc.setRemoteDescription(new RTCSessionDescription(data.offer)).catch(function () {});
    _flushCandidates();
    var answer = await _pc.createAnswer();
    await _pc.setLocalDescription(answer);
    await _fs.updateDoc(ref, { answer: { type: answer.type, sdp: answer.sdp }, status: 'active' });

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
    var dur = _callStartMs ? Math.floor((Date.now() - _callStartMs) / 1000) : 0;
    _cleanupLocal();
    if (_fb() && id) {
      try {
        await _fs.updateDoc(_fs.doc(_db, 'calls', id), {
          status: reason || 'ended',
          endedAt: _fs.serverTimestamp(),
          duration: dur
        });
      } catch (e) {}
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

  /* ── Public: toggleScreenShare ───────────────────────────────── */
  GC.toggleScreenShare = async function () {
    if (!_pc) return;
    var btn = document.getElementById('ghScreenBtn');
    if (_screenStream) {
      _screenStream.getTracks().forEach(function (t) { t.stop(); });
      _screenStream = null;
      var camTrack = _localStream && _localStream.getVideoTracks()[0];
      if (camTrack) {
        var sender = _pc.getSenders().find(function (s) { return s.track && s.track.kind === 'video'; });
        if (sender) await sender.replaceTrack(camTrack).catch(function () {});
      }
      var lv = document.getElementById('ghLocalVideo');
      if (lv && _localStream) lv.srcObject = _localStream;
      if (btn) { btn.innerHTML = '<i class="fas fa-desktop"></i>'; btn.classList.remove('gco-btn-muted'); }
    } else {
      try {
        _screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        var screenTrack = _screenStream.getVideoTracks()[0];
        var sender = _pc.getSenders().find(function (s) { return s.track && s.track.kind === 'video'; });
        if (sender) await sender.replaceTrack(screenTrack).catch(function () {});
        var lv = document.getElementById('ghLocalVideo');
        if (lv) lv.srcObject = _screenStream;
        if (btn) { btn.innerHTML = '<i class="fas fa-desktop"></i>'; btn.classList.add('gco-btn-muted'); }
        screenTrack.onended = function () { GC.toggleScreenShare(); };
      } catch (e) {
        _toast(_t('call_screen_denied', 'Screen sharing not available'), 'error');
      }
    }
  };

  /* ── Public: togglePiP ───────────────────────────────────────── */
  GC.togglePiP = async function () {
    var rv = document.getElementById('ghRemoteVideo');
    if (!rv) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await rv.requestPictureInPicture();
      }
    } catch (e) {}
  };

  /* ── Public: toggleChat ──────────────────────────────────────── */
  GC.toggleChat = function () {
    _chatOpen = !_chatOpen;
    var panel = document.getElementById('ghChatPanel');
    var btn   = document.getElementById('ghChatBtn');
    if (!panel) { _buildChatPanel(); return; }
    panel.style.display = _chatOpen ? 'flex' : 'none';
    if (btn) btn.classList.toggle('gco-btn-active', _chatOpen);
  };

  function _buildChatPanel() {
    var existing = document.getElementById('ghChatPanel');
    if (existing) { existing.remove(); }
    var panel = document.createElement('div');
    panel.id = 'ghChatPanel';
    panel.className = 'gco-chat-panel';
    panel.innerHTML =
      '<div class="gco-chat-msgs" id="ghChatMsgs"></div>' +
      '<div class="gco-chat-input-row">' +
        '<input id="ghChatInput" class="gco-chat-input" type="text" placeholder="' + _t('call_chat_placeholder', 'შეტყობინება…') + '" maxlength="300">' +
        '<button class="gco-chat-send" onclick="GhCalls.sendChatMsg()"><i class="fas fa-paper-plane"></i></button>' +
      '</div>';
    var ov = document.getElementById('ghCallOverlay');
    if (ov) ov.appendChild(panel);

    // Send on Enter
    panel.querySelector('#ghChatInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') GC.sendChatMsg();
    });

    // Listen for messages
    if (_fb() && _callId) {
      _chatUnsub = _fs.onSnapshot(
        _fs.query(_fs.collection(_db, 'calls', _callId, 'messages'), _fs.orderBy('createdAt', 'asc')),
        function (snap) {
          snap.docChanges().forEach(function (ch) {
            if (ch.type !== 'added') return;
            var d = ch.doc.data();
            var me = _me();
            var mine = me && d.uid === me.uid;
            var el = document.getElementById('ghChatMsgs');
            if (!el) return;
            var msg = document.createElement('div');
            msg.className = 'gco-chat-msg' + (mine ? ' gco-chat-msg-mine' : '');
            msg.textContent = d.text;
            el.appendChild(msg);
            el.scrollTop = el.scrollHeight;
          });
        },
        function () {}
      );
    }

    var btn = document.getElementById('ghChatBtn');
    if (btn) btn.classList.add('gco-btn-active');
  }

  /* ── Public: sendChatMsg ─────────────────────────────────────── */
  GC.sendChatMsg = async function () {
    if (!_fb() || !_callId) return;
    var inp = document.getElementById('ghChatInput');
    if (!inp || !inp.value.trim()) return;
    var me = _me(); if (!me) return;
    var text = inp.value.trim();
    inp.value = '';
    try {
      await _fs.addDoc(_fs.collection(_db, 'calls', _callId, 'messages'), {
        uid: me.uid, text: text, createdAt: _fs.serverTimestamp()
      });
    } catch (e) {}
  };

  /* ── Public: flipCamera ──────────────────────────────────────── */
  GC.flipCamera = async function () {
    if (!_localStream || _callType !== 'video') return;
    _facingMode = _facingMode === 'user' ? 'environment' : 'user';
    try {
      var newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: _facingMode }, audio: false });
      var newTrack = newStream.getVideoTracks()[0];
      var oldTrack = _localStream.getVideoTracks()[0];
      if (oldTrack) { _localStream.removeTrack(oldTrack); oldTrack.stop(); }
      _localStream.addTrack(newTrack);
      var sender = _pc && _pc.getSenders().find(function (s) { return s.track && s.track.kind === 'video'; });
      if (sender) await sender.replaceTrack(newTrack).catch(function () {});
      var lv = document.getElementById('ghLocalVideo');
      if (lv) lv.srcObject = _localStream;
    } catch (e) { _facingMode = _facingMode === 'user' ? 'environment' : 'user'; }
  };

  /* ── Cleanup ─────────────────────────────────────────────────── */
  function _cleanupLocal() {
    if (_unsubCall) { _unsubCall(); _unsubCall = null; }
    if (_unsubCandidates) { _unsubCandidates(); _unsubCandidates = null; }
    if (_pc) { _pc.close(); _pc = null; }
    if (_localStream) { _localStream.getTracks().forEach(function (t) { t.stop(); }); _localStream = null; }
    if (_screenStream) { _screenStream.getTracks().forEach(function (t) { t.stop(); }); _screenStream = null; }
    if (_chatUnsub) { _chatUnsub(); _chatUnsub = null; }
    _remoteStream = null;
    _callId = null; _myRole = null; _callType = null; _callState = null;
    _pendingCandidates = []; _facingMode = 'user'; _chatOpen = false; _callStartMs = 0;
    _stopTimer(); _stopRing(); _stopQuality(); _hideOverlay();
  }

  /* ── Listen for incoming calls ───────────────────────────────── */
  GC.startListening = function () {
    if (!_fb()) return;
    var me = _me(); if (!me) return;
    if (_incomingUnsub) { _incomingUnsub(); _incomingUnsub = null; }

    function handleSnap(snap) {
      snap.docChanges().forEach(function (ch) {
        if (ch.type !== 'added') return;
        var data = ch.doc.data();
        var cid = ch.doc.id;
        if (data.status !== 'ringing') return;
        if (_callId) return;
        if (data.createdAt) {
          var ms = data.createdAt.toMillis ? data.createdAt.toMillis() : data.createdAt.seconds * 1000;
          if (Date.now() - ms > 30000) return;
        }
        _showIncoming(data.callerName || 'Unknown', data.callerAvatar || '', data.type || 'audio', cid);
        _ring(false);
      });
    }

    // Try full query first (needs composite index); fall back to simple query if index missing
    _incomingUnsub = _fs.onSnapshot(
      _fs.query(
        _fs.collection(_db, 'calls'),
        _fs.where('calleeId', '==', me.uid),
        _fs.where('status', '==', 'ringing'),
        _fs.orderBy('createdAt', 'desc'),
        _fs.limit(1)
      ),
      handleSnap,
      function (err) {
        // Index not ready yet — use simple single-field query, filter in JS
        console.warn('[GhCalls] index missing, using fallback query:', err && err.message);
        if (_incomingUnsub) { _incomingUnsub(); }
        _incomingUnsub = _fs.onSnapshot(
          _fs.query(
            _fs.collection(_db, 'calls'),
            _fs.where('calleeId', '==', me.uid),
            _fs.limit(10)
          ),
          handleSnap,
          function (e) { console.warn('[GhCalls] incoming listen error:', e && e.message); }
        );
      }
    );
  };

  /* ── Pending call from push notification tap ────────────────── */
  async function _checkPendingCallFromUrl(callId) {
    if (!_fb()) return;
    var me = _me(); if (!me) return;
    try {
      var snap = await _fs.getDoc(_fs.doc(_db, 'calls', callId));
      if (!snap.exists()) return;
      var data = snap.data();
      if (data.calleeId !== me.uid) return;
      if (data.status !== 'ringing') return;
      var ageMs = data.createdAt && data.createdAt.toMillis ? Date.now() - data.createdAt.toMillis() : 0;
      if (ageMs > 45000) return;
      if (!_callId) {
        _showIncoming(data.callerName || 'Unknown', data.callerAvatar || '', data.type || 'audio', callId);
        _ring(false);
      }
    } catch (e) {}
  }

  /* ── Init ────────────────────────────────────────────────────── */
  function _init() {
    var pendingCallId = new URLSearchParams(window.location.search).get('call');
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (_fb() && _me()) {
        clearInterval(iv);
        GC.startListening();
        if (pendingCallId) _checkPendingCallFromUrl(pendingCallId);
        return;
      }
      if (tries > 60) clearInterval(iv);
    }, 500);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(_init, 1200); });
  } else { setTimeout(_init, 1200); }
  window.addEventListener('GeoFirebaseReady', function () { if (_fb()) setTimeout(_init, 300); });
  // Re-listen whenever auth state changes (sign-in after page load)
  window.addEventListener('GeoAuthReady', function (e) {
    if (e.detail) { GC.startListening(); }
    else { if (_incomingUnsub) { _incomingUnsub(); _incomingUnsub = null; } }
  });

})();
