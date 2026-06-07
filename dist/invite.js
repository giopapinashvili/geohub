/* ================================================================
   GeoHub — Invite & Referral System
   Generates unique invite codes, handles referral attribution,
   and renders invite widgets.
   ================================================================ */
(function () {
  'use strict';

  var _db, _fs, _auth;
  var _codeCache = null;

  // ── HELPERS ───────────────────────────────────────────────────

  function generateCode(uid) {
    var chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    var base = (uid || '').slice(0, 5).toLowerCase().replace(/[^a-z0-9]/g, 'x');
    var suffix = '';
    for (var i = 0; i < 3; i++) {
      suffix += chars[Math.floor(Math.random() * chars.length)];
    }
    return base + suffix;
  }

  function getBaseUrl() {
    return window.location.origin || 'https://geohub.ge';
  }

  function getInviteLink(code) {
    return getBaseUrl() + '/auth.html?ref=' + code + '&tab=signup';
  }

  function safeEsc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── CLIPBOARD ─────────────────────────────────────────────────

  function showToast(msg) {
    if (window.pushNotif) {
      window.pushNotif({ emoji: '✅', title: 'Copied!', text: msg, link: null });
      return;
    }
    var t = document.getElementById('geo-invite-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'geo-invite-toast';
      t.style.cssText = 'position:fixed;bottom:84px;left:50%;transform:translateX(-50%) translateY(16px);background:#10b981;color:#fff;padding:9px 20px;border-radius:24px;font-size:.85rem;font-weight:600;z-index:99999;transition:all .25s;opacity:0;pointer-events:none;white-space:nowrap';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(t._t);
    t._t = setTimeout(function () {
      t.style.opacity = '0';
      t.style.transform = 'translateX(-50%) translateY(16px)';
    }, 2500);
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    return ok;
  }

  function copyInviteLink(code) {
    var link = getInviteLink(code);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link)
        .then(function () { showToast('Invite link copied!'); })
        .catch(function () { if (fallbackCopy(link)) showToast('Invite link copied!'); });
    } else {
      fallbackCopy(link);
      showToast('Invite link copied!');
    }
  }

  // ── FIRESTORE ─────────────────────────────────────────────────

  function getOrCreateInviteCode(uid) {
    if (_codeCache) return Promise.resolve(_codeCache);
    return _fs.getDoc(_fs.doc(_db, 'users', uid)).then(function (snap) {
      if (snap.exists() && snap.data().inviteCode) {
        _codeCache = snap.data().inviteCode;
        return _codeCache;
      }
      var code = generateCode(uid);
      var inviteRef = _fs.doc(_db, 'invites', code);
      return _fs.setDoc(inviteRef, {
        createdBy: uid,
        createdAt: _fs.serverTimestamp(),
        uses: 0
      }).then(function () {
        return _fs.updateDoc(_fs.doc(_db, 'users', uid), { inviteCode: code });
      }).then(function () {
        _codeCache = code;
        return code;
      });
    });
  }

  function getInviteStats(uid) {
    return _fs.getDoc(_fs.doc(_db, 'users', uid)).then(function (snap) {
      if (!snap.exists()) return { inviteCount: 0, inviteAccepted: 0, code: null };
      var d = snap.data();
      return {
        inviteCount:    d.inviteCount    || 0,
        inviteAccepted: d.inviteAccepted || 0,
        code: d.inviteCode || null,
      };
    });
  }

  // Called automatically on auth state change (once per session).
  // Reads stored ref code from localStorage, validates it, and writes
  // referral attribution if this user has not been attributed yet.
  function processReferral(uid) {
    var code = null;
    try { code = localStorage.getItem('geo_ref'); } catch (e) {}
    if (!code || !uid) return Promise.resolve(false);

    // Check if user already has a referredBy to avoid double-attribution
    return _fs.getDoc(_fs.doc(_db, 'users', uid)).then(function (snap) {
      if (snap.exists() && snap.data().referredBy) {
        try { localStorage.removeItem('geo_ref'); } catch (e) {}
        return false;
      }
      return _fs.getDoc(_fs.doc(_db, 'invites', code)).then(function (inviteSnap) {
        if (!inviteSnap.exists()) { try { localStorage.removeItem('geo_ref'); } catch (e) {} return false; }
        var d = inviteSnap.data();
        if (!d.createdBy || d.createdBy === uid) return false;

        var batch = _fs.writeBatch(_db);
        batch.update(_fs.doc(_db, 'users', uid), { referredBy: d.createdBy });
        batch.update(_fs.doc(_db, 'invites', code), {
          uses: _fs.increment(1),
          lastUsedAt: _fs.serverTimestamp(),
        });
        batch.update(_fs.doc(_db, 'users', d.createdBy), {
          inviteAccepted: _fs.increment(1),
          inviteCount:    _fs.increment(1),
        });
        return batch.commit().then(function () {
          try { localStorage.removeItem('geo_ref'); } catch (e) {}
          // Award 500 GeoPoints to referrer (pending Cloud Function approval)
          _fs.addDoc(_fs.collection(_db, 'pointEarnRequests'), {
            userId: d.createdBy, toUserId: d.createdBy, amount: 500,
            reason: 'Referral reward — friend joined GeoHub',
            targetType: 'invite', targetId: code,
            status: 'pending', createdAt: _fs.serverTimestamp()
          }).catch(function(){});
          // Award 100 GeoPoints welcome bonus to new user
          _fs.addDoc(_fs.collection(_db, 'pointEarnRequests'), {
            userId: uid, toUserId: uid, amount: 100,
            reason: 'Welcome bonus — joined via friend invite',
            targetType: 'invite', targetId: code,
            status: 'pending', createdAt: _fs.serverTimestamp()
          }).catch(function(){});
          return true;
        });
      });
    }).catch(function () { return false; });
  }

  // ── SHARE ─────────────────────────────────────────────────────

  function shareInvite(code) {
    var link = getInviteLink(code);
    if (navigator.share) {
      navigator.share({
        title: 'Join GeoHub',
        text: 'Discover places, earn rewards, and connect in Georgia!',
        url: link,
      }).catch(function () { copyInviteLink(code); });
    } else {
      copyInviteLink(code);
    }
  }

  // ── WIDGET ────────────────────────────────────────────────────

  function renderInviteWidget(el, uid) {
    if (!el) return;
    el.innerHTML = '<div style="color:#64748b;font-size:.85rem;padding:8px 0"><i class="fas fa-spinner fa-spin"></i> Loading…</div>';

    getOrCreateInviteCode(uid).then(function (code) {
      var link = getInviteLink(code);
      var safeLink = safeEsc(link);
      var safeCode = safeEsc(code);

      el.innerHTML =
        '<div class="invite-widget">' +
          '<div class="invite-widget-header">' +
            '<i class="fas fa-user-plus invite-widget-icon"></i>' +
            '<div>' +
              '<div class="invite-widget-title">Invite Friends</div>' +
              '<div class="invite-widget-sub">Earn XP when friends join via your link</div>' +
            '</div>' +
          '</div>' +
          '<div class="invite-link-row">' +
            '<input class="invite-link-input" readonly value="' + safeLink + '" onclick="this.select()" aria-label="Your invite link" />' +
            '<button class="invite-copy-btn" onclick="window.GeoInvite.copyInviteLink(\'' + safeCode + '\')"><i class="fas fa-copy"></i> Copy</button>' +
          '</div>' +
          (navigator.share
            ? '<button class="invite-share-native-btn" onclick="window.GeoInvite.shareInvite(\'' + safeCode + '\')"><i class="fas fa-share-nodes"></i> Share via…</button>'
            : '') +
          '<div class="invite-stats" id="geo-invite-stats">…</div>' +
        '</div>';

      getInviteStats(uid).then(function (stats) {
        var statsEl = document.getElementById('geo-invite-stats');
        if (statsEl) {
          statsEl.innerHTML = stats.inviteAccepted
            ? '<i class="fas fa-check-circle" style="color:#10b981"></i> <strong>' + stats.inviteAccepted + '</strong> friend' + (stats.inviteAccepted === 1 ? '' : 's') + ' joined via your link'
            : '<i class="fas fa-link" style="color:#64748b"></i> Share your link to invite friends';
        }
      }).catch(function () {});

    }).catch(function () {
      el.innerHTML = '<p style="color:#ef4444;font-size:.83rem;margin:0">Could not load invite link. Try refreshing.</p>';
    });
  }

  // ── INIT ──────────────────────────────────────────────────────

  function init(fb) {
    _db   = fb.db;
    _fs   = fb.fs;
    _auth = fb.auth;

    // Capture referral code from URL into localStorage (works on invite.html and auth.html)
    try {
      var ref = new URLSearchParams(window.location.search).get('ref');
      if (ref && /^[a-z0-9]{6,10}$/i.test(ref)) {
        localStorage.setItem('geo_ref', ref.toLowerCase());
      }
    } catch (e) {}

    // Auto-process referral when a user signs in for the first time
    fb.authFns.onAuthStateChanged(_auth, function (user) {
      if (user) processReferral(user.uid).catch(function () {});
    });

    window.GeoInvite = {
      getOrCreateInviteCode: getOrCreateInviteCode,
      getInviteLink:         getInviteLink,
      copyInviteLink:        copyInviteLink,
      shareInvite:           shareInvite,
      processReferral:       processReferral,
      getInviteStats:        getInviteStats,
      renderInviteWidget:    renderInviteWidget,
    };
  }

  if (window.GeoFirebase) {
    init(window.GeoFirebase);
  } else {
    window.addEventListener('GeoFirebaseReady', function () { init(window.GeoFirebase); }, { once: true });
  }
})();
