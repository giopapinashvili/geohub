/* GeoHub — Group Video Calls (WebRTC mesh, up to 5 participants)
   Firestore schema:
     groupCalls/{callId}                          — call metadata
     groupCalls/{callId}/members/{uid}            — participant presence
     groupCalls/{callId}/signals/{pairId}         — offer/answer (pairId = minUid_maxUid)
     groupCalls/{callId}/ice/{fromUid_toUid}/candidates/{id} — ICE candidates
*/
(function () {
  'use strict';

  var _db, _auth;
  var _callId = null;
  var _myUid = null, _myName = null, _myAvatar = null;
  var _callType = 'video';
  var _localStream = null;
  var _peers = {};        // { uid: { pc, remoteStream } }
  var _members = [];
  var _unsubscribers = [];
  var _isHost = false;
  var MAX_PARTICIPANTS = 5;

  var ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];

  function _t(key, fb) {
    try { return (window.GHI18N && window.GHI18N.t(key)) || fb; } catch(e) { return fb; }
  }
  function _log() { console.log.apply(console, ['[GCalls]'].concat(Array.from(arguments))); }

  // ── INIT ───────────────────────────────────────────────────────────

  function _init() {
    try {
      _db   = firebase.firestore();
      _auth = firebase.auth();
    } catch(e) { setTimeout(_init, 800); return; }

    _auth.onAuthStateChanged(function(user) {
      if (!user) return;
      _myUid   = user.uid;
      _myName  = user.displayName || 'User';
      _myAvatar = user.photoURL || '';
      _buildUI();
    });
  }

  // ── UI ─────────────────────────────────────────────────────────────

  function _buildUI() {
    if (document.getElementById('ggc-overlay')) return;
    var el = document.createElement('div');
    el.id = 'ggc-overlay';
    el.className = 'ggc';
    el.innerHTML =
      '<div class="ggc-card">' +
        '<div class="ggc-header">' +
          '<span class="ggc-title" id="ggc-title"></span>' +
          '<span class="ggc-count" id="ggc-count"></span>' +
        '</div>' +
        '<div class="ggc-grid" id="ggc-grid"></div>' +
        '<div class="ggc-controls">' +
          '<button class="gco-btn gco-btn-sec" id="ggc-mic-btn" onclick="GhGroupCalls._toggleMic()">' +
            '<i class="fas fa-microphone" id="ggc-mic-icon"></i>' +
          '</button>' +
          '<button class="gco-btn gco-btn-sec" id="ggc-cam-btn" onclick="GhGroupCalls._toggleCam()">' +
            '<i class="fas fa-video" id="ggc-cam-icon"></i>' +
          '</button>' +
          '<button class="gco-btn gco-btn-end" onclick="GhGroupCalls.leave()">' +
            '<i class="fas fa-phone-slash"></i>' +
          '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
  }

  // ── INVITE MODAL ─────────────────────────────────────────────────

  function openInviteModal() {
    var modal = document.getElementById('ggc-invite-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'ggc-invite-modal';
      modal.className = 'ggc-modal-bg';
      modal.innerHTML =
        '<div class="ggc-modal">' +
          '<h3>' + _t('group_call_new', 'New Group Call') + '</h3>' +
          '<label>' + _t('group_call_type', 'Call type') + '</label>' +
          '<div class="ggc-type-btns">' +
            '<button class="ggc-type-btn ggc-type-active" data-type="video" onclick="GhGroupCalls._selectType(this,\'video\')">' +
              '<i class="fas fa-video"></i> ' + _t('call_video_label', 'Video') + '</button>' +
            '<button class="ggc-type-btn" data-type="audio" onclick="GhGroupCalls._selectType(this,\'audio\')">' +
              '<i class="fas fa-phone"></i> ' + _t('call_voice_label', 'Voice') + '</button>' +
          '</div>' +
          '<p style="font-size:.83rem;color:#94a3b8;margin:8px 0 4px">' +
            _t('group_call_share', 'Share this call ID with participants:') +
          '</p>' +
          '<div style="display:flex;gap:8px">' +
            '<input id="ggc-callid-box" readonly class="ggc-id-box" value="">' +
            '<button class="ggc-copy-btn" onclick="GhGroupCalls._copyId()">' +
              '<i class="fas fa-copy"></i>' +
            '</button>' +
          '</div>' +
          '<div style="display:flex;gap:10px;margin-top:16px">' +
            '<button class="ggc-action-btn" onclick="GhGroupCalls._startFromModal()">' +
              _t('group_call_start', 'Start Call') +
            '</button>' +
            '<button class="ggc-cancel-btn" onclick="GhGroupCalls._closeModal()">' +
              _t('cancel', 'Cancel') +
            '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(modal);
    }
    // Generate a call ID upfront so it can be shared before starting
    var preId = _db.collection('groupCalls').doc().id;
    modal._pendingCallId = preId;
    modal._pendingType   = 'video';
    var box = document.getElementById('ggc-callid-box');
    if (box) box.value = preId;
    modal.style.display = 'flex';
  }

  function _closeModal() {
    var modal = document.getElementById('ggc-invite-modal');
    if (modal) modal.style.display = 'none';
  }

  function _selectType(btn, type) {
    var modal = document.getElementById('ggc-invite-modal');
    if (modal) modal._pendingType = type;
    document.querySelectorAll('.ggc-type-btn').forEach(function(b) {
      b.classList.toggle('ggc-type-active', b === btn);
    });
  }

  function _copyId() {
    var box = document.getElementById('ggc-callid-box');
    if (box) { navigator.clipboard && navigator.clipboard.writeText(box.value); }
  }

  async function _startFromModal() {
    var modal = document.getElementById('ggc-invite-modal');
    if (!modal) return;
    var id   = modal._pendingCallId;
    var type = modal._pendingType || 'video';
    _closeModal();
    await startCall([], type, id);
  }

  // ── START (host) ────────────────────────────────────────────────

  async function startCall(participantUids, type, presetCallId) {
    if (_callId) { _log('already in group call'); return; }
    type = type || 'video';
    _callType = type;
    _isHost   = true;

    try {
      _localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video' ? { width: 640, height: 480, facingMode: 'user' } : false
      });
    } catch(e) {
      alert(_t('call_perm_denied', 'Camera/microphone permission denied'));
      return;
    }

    _callId = presetCallId || _db.collection('groupCalls').doc().id;
    var allUids = [_myUid].concat(
      (participantUids || []).filter(function(u) { return u !== _myUid; })
    ).slice(0, MAX_PARTICIPANTS);

    await _db.collection('groupCalls').doc(_callId).set({
      hostUid:        _myUid,
      hostName:       _myName,
      hostAvatar:     _myAvatar,
      type:           type,
      status:         'active',
      participantIds: allUids,
      createdAt:      firebase.firestore.FieldValue.serverTimestamp()
    });

    await _db.collection('groupCalls').doc(_callId).collection('members').doc(_myUid).set({
      uid:      _myUid,
      name:     _myName,
      avatar:   _myAvatar,
      active:   true,
      joinedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    _members = [_myUid];
    _showOverlay();
    _addLocalTile();
    _listenForMembers();
    _listenForCallEnd();
  }

  // ── JOIN ────────────────────────────────────────────────────────

  async function joinCall(callId) {
    if (_callId) { _log('already in group call'); return; }
    _callId = callId;
    _isHost = false;

    var snap = await _db.collection('groupCalls').doc(callId).get().catch(function() { return null; });
    if (!snap || !snap.exists) {
      alert(_t('group_call_not_found', 'Group call not found'));
      _callId = null;
      return;
    }
    var data = snap.data();
    if (data.status === 'ended') {
      alert(_t('group_call_ended', 'This group call has already ended'));
      _callId = null;
      return;
    }
    _callType = data.type || 'video';

    var ids = data.participantIds || [];
    if (ids.length >= MAX_PARTICIPANTS && !ids.includes(_myUid)) {
      alert(_t('group_call_full', 'Group call is full (max 5 participants)'));
      _callId = null;
      return;
    }

    try {
      _localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: _callType === 'video' ? { width: 640, height: 480, facingMode: 'user' } : false
      });
    } catch(e) {
      alert(_t('call_perm_denied', 'Camera/microphone permission denied'));
      _callId = null;
      return;
    }

    await _db.collection('groupCalls').doc(callId).update({
      participantIds: firebase.firestore.FieldValue.arrayUnion(_myUid)
    });
    await _db.collection('groupCalls').doc(callId).collection('members').doc(_myUid).set({
      uid:      _myUid,
      name:     _myName,
      avatar:   _myAvatar,
      active:   true,
      joinedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    _showOverlay();
    _addLocalTile();
    _listenForMembers();
    _listenForCallEnd();
  }

  // ── OPEN JOIN DIALOG ────────────────────────────────────────────

  function openJoinDialog() {
    var id = window.prompt(_t('group_call_enter_id', 'Enter group call ID:'));
    if (id && id.trim()) joinCall(id.trim());
  }

  // ── LEAVE ───────────────────────────────────────────────────────

  async function leave() {
    if (!_callId) return;
    var cid = _callId;
    _cleanup();
    try {
      await _db.collection('groupCalls').doc(cid).collection('members').doc(_myUid).update({ active: false });
      await _db.collection('groupCalls').doc(cid).update({
        participantIds: firebase.firestore.FieldValue.arrayRemove(_myUid)
      });
    } catch(e) {}
  }

  function _cleanup() {
    _unsubscribers.forEach(function(u) { try { u(); } catch(e) {} });
    _unsubscribers = [];
    Object.keys(_peers).forEach(function(uid) {
      try { _peers[uid].pc.close(); } catch(e) {}
    });
    _peers = {};
    if (_localStream) { _localStream.getTracks().forEach(function(t) { t.stop(); }); _localStream = null; }
    _callId = null;
    _members = [];
    _isHost = false;
    _hideOverlay();
  }

  // ── MEMBERS LISTENER ────────────────────────────────────────────

  function _listenForMembers() {
    var unsub = _db.collection('groupCalls').doc(_callId)
      .collection('members').where('active', '==', true)
      .onSnapshot(function(snap) {
        var current = snap.docs.map(function(d) { return d.id; });

        // New members — connect
        current.forEach(function(uid) {
          if (uid === _myUid || _peers[uid]) return;
          _createPC(uid);
        });

        // Gone members — disconnect
        Object.keys(_peers).forEach(function(uid) {
          if (!current.includes(uid)) {
            _log('member left:', uid);
            try { _peers[uid].pc.close(); } catch(e) {}
            var tile = document.getElementById('ggc-tile-' + uid);
            if (tile) tile.remove();
            delete _peers[uid];
          }
        });

        _members = current;
        var el = document.getElementById('ggc-count');
        if (el) el.textContent = current.length + ' / ' + MAX_PARTICIPANTS;
      });
    _unsubscribers.push(unsub);
  }

  function _listenForCallEnd() {
    var unsub = _db.collection('groupCalls').doc(_callId).onSnapshot(function(snap) {
      if (!snap.exists) return;
      if (snap.data().status === 'ended') { _cleanup(); }
    });
    _unsubscribers.push(unsub);
  }

  // ── PEER CONNECTION ─────────────────────────────────────────────

  function _pairId(a, b) { return a < b ? a + '_' + b : b + '_' + a; }
  function _amOfferer(other) { return _myUid < other; }

  async function _createPC(remoteUid) {
    if (_peers[remoteUid]) return;
    _log('creating PC with', remoteUid, '— offerer:', _amOfferer(remoteUid));

    var pc          = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    var remoteStream = new MediaStream();
    _peers[remoteUid] = { pc: pc, remoteStream: remoteStream };
    _addRemoteTile(remoteUid, remoteStream);

    if (_localStream) {
      _localStream.getTracks().forEach(function(t) { pc.addTrack(t, _localStream); });
    }

    pc.ontrack = function(ev) {
      ev.streams[0].getTracks().forEach(function(t) { remoteStream.addTrack(t); });
    };

    pc.onicecandidate = function(ev) {
      if (!ev.candidate) return;
      _db.collection('groupCalls').doc(_callId)
        .collection('ice').doc(_myUid + '_' + remoteUid)
        .collection('candidates').add({
          c:  ev.candidate.toJSON(),
          ts: firebase.firestore.FieldValue.serverTimestamp()
        });
    };

    var pId = _pairId(_myUid, remoteUid);

    if (_amOfferer(remoteUid)) {
      var offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      await _db.collection('groupCalls').doc(_callId).collection('signals').doc(pId)
        .set({ offer: { type: offer.type, sdp: offer.sdp },
               offererUid: _myUid, answererUid: remoteUid,
               ts: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });

      var u1 = _db.collection('groupCalls').doc(_callId).collection('signals').doc(pId)
        .onSnapshot(async function(snap) {
          if (!snap.exists) return;
          var d = snap.data();
          if (d.answer && pc.signalingState === 'have-local-offer') {
            try { await pc.setRemoteDescription(new RTCSessionDescription(d.answer)); } catch(e) {}
          }
        });
      _unsubscribers.push(u1);
    } else {
      var u2 = _db.collection('groupCalls').doc(_callId).collection('signals').doc(pId)
        .onSnapshot(async function(snap) {
          if (!snap.exists) return;
          var d = snap.data();
          if (d.offer && !pc.currentRemoteDescription) {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(d.offer));
              var ans = await pc.createAnswer();
              await pc.setLocalDescription(ans);
              await _db.collection('groupCalls').doc(_callId).collection('signals').doc(pId)
                .set({ answer: { type: ans.type, sdp: ans.sdp },
                       ts: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            } catch(e) { _log('answer error:', e); }
          }
        });
      _unsubscribers.push(u2);
    }

    // Remote ICE (they write to remoteUid_myUid)
    var u3 = _db.collection('groupCalls').doc(_callId)
      .collection('ice').doc(remoteUid + '_' + _myUid)
      .collection('candidates').onSnapshot(function(snap) {
        snap.docChanges().forEach(async function(ch) {
          if (ch.type !== 'added') return;
          try { await pc.addIceCandidate(new RTCIceCandidate(ch.doc.data().c)); } catch(e) {}
        });
      });
    _unsubscribers.push(u3);
  }

  // ── TILES ──────────────────────────────────────────────────────

  function _addLocalTile() {
    var grid = document.getElementById('ggc-grid');
    if (!grid || document.getElementById('ggc-tile-local')) return;
    var tile = document.createElement('div');
    tile.className = 'ggc-tile ggc-tile-local';
    tile.id = 'ggc-tile-local';
    if (_callType === 'video') {
      var v = document.createElement('video');
      v.autoplay = true; v.muted = true; v.playsInline = true;
      if (_localStream) v.srcObject = _localStream;
      tile.appendChild(v);
    } else {
      var av = document.createElement('div');
      av.className = 'ggc-tile-av';
      av.textContent = (_myName[0] || '?').toUpperCase();
      tile.appendChild(av);
    }
    var lbl = document.createElement('div');
    lbl.className = 'ggc-tile-lbl';
    lbl.textContent = _t('you', 'You');
    tile.appendChild(lbl);
    grid.appendChild(tile);
  }

  function _addRemoteTile(uid, stream) {
    var grid = document.getElementById('ggc-grid');
    if (!grid || document.getElementById('ggc-tile-' + uid)) return;
    var tile = document.createElement('div');
    tile.className = 'ggc-tile';
    tile.id = 'ggc-tile-' + uid;
    if (_callType === 'video') {
      var v = document.createElement('video');
      v.autoplay = true; v.playsInline = true;
      v.srcObject = stream;
      tile.appendChild(v);
    } else {
      var av = document.createElement('div');
      av.className = 'ggc-tile-av';
      av.textContent = uid.slice(0, 1).toUpperCase();
      tile.appendChild(av);
    }
    var lbl = document.createElement('div');
    lbl.className = 'ggc-tile-lbl';
    lbl.id = 'ggc-lbl-' + uid;
    lbl.textContent = uid.slice(0, 8);
    tile.appendChild(lbl);
    grid.appendChild(tile);
  }

  // ── OVERLAY ────────────────────────────────────────────────────

  function _showOverlay() {
    var el = document.getElementById('ggc-overlay');
    if (!el) { _buildUI(); el = document.getElementById('ggc-overlay'); }
    if (!el) return;
    el.style.display = 'flex';
    var title = document.getElementById('ggc-title');
    if (title) title.textContent = _callType === 'video'
      ? _t('group_video_call', 'Group Video Call')
      : _t('group_audio_call', 'Group Voice Call');
  }

  function _hideOverlay() {
    var el = document.getElementById('ggc-overlay');
    if (!el) return;
    el.style.display = 'none';
    var grid = document.getElementById('ggc-grid');
    if (grid) grid.innerHTML = '';
  }

  // ── MIC / CAM ──────────────────────────────────────────────────

  function _toggleMic() {
    if (!_localStream) return;
    var t = _localStream.getAudioTracks()[0]; if (!t) return;
    t.enabled = !t.enabled;
    var ic = document.getElementById('ggc-mic-icon');
    if (ic) ic.className = t.enabled ? 'fas fa-microphone' : 'fas fa-microphone-slash';
    var btn = document.getElementById('ggc-mic-btn');
    if (btn) btn.classList.toggle('gco-btn-muted', !t.enabled);
  }

  function _toggleCam() {
    if (!_localStream) return;
    var t = _localStream.getVideoTracks()[0]; if (!t) return;
    t.enabled = !t.enabled;
    var ic = document.getElementById('ggc-cam-icon');
    if (ic) ic.className = t.enabled ? 'fas fa-video' : 'fas fa-video-slash';
    var btn = document.getElementById('ggc-cam-btn');
    if (btn) btn.classList.toggle('gco-btn-muted', !t.enabled);
  }

  // ── PUBLIC API ─────────────────────────────────────────────────

  window.GhGroupCalls = {
    startCall:       startCall,
    joinCall:        joinCall,
    leave:           leave,
    openInviteModal: openInviteModal,
    openJoinDialog:  openJoinDialog,
    _startFromModal: _startFromModal,
    _closeModal:     _closeModal,
    _selectType:     _selectType,
    _copyId:         _copyId,
    _toggleMic:      _toggleMic,
    _toggleCam:      _toggleCam
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else { setTimeout(_init, 0); }
})();
