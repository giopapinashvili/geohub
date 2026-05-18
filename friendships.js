/* ================================================================
   GeoHub — Friendships System (window.GeoFriendships)
   Complete friend request / friendship management.

   Firestore structure:
     friendRequests/{id}  = { fromUserId, toUserId, status, createdAt, respondedAt }
     friendships/{id}     = { users:[uid1,uid2], user1, user2, createdAt }
       friendshipId = sorted([uid1,uid2]).join('_')
   ================================================================ */
(function () {
  'use strict';

  /* ── helpers ─────────────────────────────────────────────────── */

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg, type) {
    if (window.GeoSocial && window.GeoSocial.toast) return window.GeoSocial.toast(msg, type);
    var el = document.querySelector('.gh-toast');
    if (el) el.remove();
    el = document.createElement('div');
    el.className = 'gh-toast' + (type === 'error' ? ' gh-toast-error' : '');
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    setTimeout(function () { el.classList.remove('show'); setTimeout(function () { el.remove(); }, 250); }, 2200);
  }

  function friendshipId(uid1, uid2) {
    return [uid1, uid2].sort().join('_');
  }

  function currentUser() {
    var GF = window.GeoFirebase;
    return GF && GF.auth && GF.auth.currentUser;
  }

  function requireAuth(cb) {
    var u = currentUser();
    if (u) return cb(u);
    if (window.GeoSocial && window.GeoSocial.requireAuth) window.GeoSocial.requireAuth(function () {});
    toast('Sign in to use this feature.', 'error');
  }

  /* ── presence ────────────────────────────────────────────────── */

  var _presenceInterval = null;

  function updatePresence() {
    var GF = window.GeoFirebase;
    var u = currentUser();
    if (!GF || !GF.db || !GF.fs || !u) return;
    var ref = GF.fs.doc(GF.db, 'users', u.uid);
    GF.fs.updateDoc(ref, {
      online: true,
      lastSeen: GF.fs.serverTimestamp()
    }).catch(function () {});
  }

  function initPresence() {
    var u = currentUser();
    if (!u) return;
    updatePresence();
    if (_presenceInterval) clearInterval(_presenceInterval);
    _presenceInterval = setInterval(updatePresence, 60000);

    window.addEventListener('beforeunload', function () {
      var GF = window.GeoFirebase;
      var cu = currentUser();
      if (!GF || !GF.db || !GF.fs || !cu) return;
      // Best-effort synchronous-ish update
      try {
        GF.fs.updateDoc(GF.fs.doc(GF.db, 'users', cu.uid), { online: false });
      } catch (e) {}
    });
  }

  /* ── birthday check ──────────────────────────────────────────── */

  function checkFriendBirthdays(friendUids) {
    var GF = window.GeoFirebase;
    if (!GF || !GF.db || !GF.fs || !friendUids.length) return;
    var today = new Date();
    var todayStr = String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    var checked = 0;
    friendUids.forEach(function (uid) {
      GF.fs.getDoc(GF.fs.doc(GF.db, 'users', uid)).then(function (snap) {
        if (!snap.exists()) return;
        var d = snap.data();
        if (!d.birthday) return;
        if (d.birthday === todayStr) {
          var name = d.fullName || d.displayName || 'A friend';
          showBirthdayBanner(name, uid);
        }
        checked++;
        if (checked === friendUids.length) {}
      }).catch(function () {});
    });
  }

  function showBirthdayBanner(name, uid) {
    var existing = document.getElementById('gh-birthday-banner');
    if (existing) return; // only show first one
    var banner = document.createElement('div');
    banner.id = 'gh-birthday-banner';
    banner.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9000;background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff;padding:14px 20px;border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.4);font-size:.9rem;font-weight:700;display:flex;align-items:center;gap:12px;max-width:420px;width:calc(100vw - 40px)';
    banner.innerHTML = '<span style="font-size:1.4rem">🎂</span>'
      + '<div style="flex:1"><div>' + esc(name) + '\'s birthday is today!</div><div style="font-size:.76rem;font-weight:400;opacity:.85;margin-top:2px">Send them a message</div></div>'
      + '<a href="profile.html?id=' + encodeURIComponent(uid) + '" style="background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);border-radius:8px;padding:6px 12px;color:#fff;text-decoration:none;font-size:.78rem;white-space:nowrap">View Profile</a>'
      + '<button onclick="this.closest(\'#gh-birthday-banner\').remove()" style="background:none;border:none;color:#fff;cursor:pointer;padding:4px;font-size:1rem;opacity:.7">✕</button>';
    document.body.appendChild(banner);
    setTimeout(function () { if (banner.parentNode) banner.remove(); }, 10000);
  }

  /* ── core API ────────────────────────────────────────────────── */

  function sendRequest(toUserId) {
    requireAuth(function (me) {
      var GF = window.GeoFirebase;
      if (!GF || !GF.db || !GF.fs) return;
      if (me.uid === toUserId) { toast('You cannot add yourself.', 'error'); return; }

      // Check no existing request/friendship first
      getStatus(toUserId, function (status) {
        if (status !== 'none') {
          if (status === 'friends') toast('Already friends.', 'error');
          else if (status === 'pending_sent') toast('Request already sent.', 'error');
          else if (status === 'pending_received') toast('They already sent you a request — accept it!');
          return;
        }
        GF.fs.addDoc(GF.fs.collection(GF.db, 'friendRequests'), {
          fromUserId: me.uid,
          toUserId: toUserId,
          status: 'pending',
          createdAt: GF.fs.serverTimestamp()
        }).then(function () {
          toast('Friend request sent!');
          // Notification
          if (window.GeoSocial && window.GeoSocial._createNotification) {
            window.GeoSocial._createNotification(toUserId, 'friend_request', 'New Friend Request',
              (me.displayName || 'Someone') + ' sent you a friend request.', 'profile.html?id=' + me.uid);
          }
        }).catch(function (err) {
          console.warn('[GeoFriendships] sendRequest', err.message);
          toast('Could not send request.', 'error');
        });
      });
    });
  }

  function accept(requestId, fromUserId) {
    requireAuth(function (me) {
      var GF = window.GeoFirebase;
      if (!GF || !GF.db || !GF.fs) return;
      var reqRef = GF.fs.doc(GF.db, 'friendRequests', requestId);
      var fId = friendshipId(me.uid, fromUserId);
      var fsRef = GF.fs.doc(GF.db, 'friendships', fId);

      // Also write to legacy 'friends' collection that existing code queries
      var legacyRef = GF.fs.doc(GF.db, 'friends', fId);

      Promise.all([
        GF.fs.updateDoc(reqRef, { status: 'accepted', respondedAt: GF.fs.serverTimestamp() }),
        GF.fs.setDoc(fsRef, {
          users: [me.uid, fromUserId].sort(),
          user1: [me.uid, fromUserId].sort()[0],
          user2: [me.uid, fromUserId].sort()[1],
          createdAt: GF.fs.serverTimestamp()
        }),
        GF.fs.setDoc(legacyRef, {
          users: [me.uid, fromUserId].sort(),
          user1: [me.uid, fromUserId].sort()[0],
          user2: [me.uid, fromUserId].sort()[1],
          createdAt: GF.fs.serverTimestamp()
        })
      ]).then(function () {
        toast('Friend request accepted!');
        if (window.GeoSocial && window.GeoSocial._createNotification) {
          window.GeoSocial._createNotification(fromUserId, 'friend_accepted', 'Friend Request Accepted',
            (me.displayName || 'Someone') + ' accepted your friend request.', 'profile.html?id=' + me.uid);
        }
      }).catch(function (err) {
        console.warn('[GeoFriendships] accept', err.message);
        toast('Could not accept request.', 'error');
      });
    });
  }

  function decline(requestId) {
    requireAuth(function () {
      var GF = window.GeoFirebase;
      if (!GF || !GF.db || !GF.fs) return;
      GF.fs.updateDoc(GF.fs.doc(GF.db, 'friendRequests', requestId), {
        status: 'declined',
        respondedAt: GF.fs.serverTimestamp()
      }).then(function () {
        toast('Request declined.');
      }).catch(function (err) {
        console.warn('[GeoFriendships] decline', err.message);
        toast('Could not decline request.', 'error');
      });
    });
  }

  function unfriend(otherUserId) {
    requireAuth(function (me) {
      var GF = window.GeoFirebase;
      if (!GF || !GF.db || !GF.fs) return;
      var fId = friendshipId(me.uid, otherUserId);
      Promise.all([
        GF.fs.deleteDoc(GF.fs.doc(GF.db, 'friendships', fId)).catch(function () {}),
        GF.fs.deleteDoc(GF.fs.doc(GF.db, 'friends', fId)).catch(function () {})
      ]).then(function () { toast('Unfriended.'); });
    });
  }

  function getStatus(otherUserId, callback) {
    var GF = window.GeoFirebase;
    var me = currentUser();
    if (!GF || !GF.db || !GF.fs || !me) { callback('none'); return; }

    var fId = friendshipId(me.uid, otherUserId);

    // Check friendship first (cheapest)
    Promise.all([
      GF.fs.getDoc(GF.fs.doc(GF.db, 'friendships', fId)).catch(function () { return null; }),
      GF.fs.getDoc(GF.fs.doc(GF.db, 'friends', fId)).catch(function () { return null; })
    ]).then(function (results) {
      if ((results[0] && results[0].exists()) || (results[1] && results[1].exists())) {
        callback('friends'); return;
      }
      // Check pending requests: sent by me
      return GF.fs.getDocs(GF.fs.query(
        GF.fs.collection(GF.db, 'friendRequests'),
        GF.fs.where('fromUserId', '==', me.uid),
        GF.fs.where('toUserId', '==', otherUserId),
        GF.fs.where('status', '==', 'pending'),
        GF.fs.limit(1)
      )).then(function (snap) {
        if (!snap.empty) { callback('pending_sent'); return; }
        // Check pending requests: received by me
        return GF.fs.getDocs(GF.fs.query(
          GF.fs.collection(GF.db, 'friendRequests'),
          GF.fs.where('fromUserId', '==', otherUserId),
          GF.fs.where('toUserId', '==', me.uid),
          GF.fs.where('status', '==', 'pending'),
          GF.fs.limit(1)
        )).then(function (snap2) {
          if (!snap2.empty) { callback('pending_received'); return; }
          callback('none');
        });
      });
    }).catch(function () { callback('none'); });
  }

  function getFriends(userId, callback) {
    var GF = window.GeoFirebase;
    if (!GF || !GF.db || !GF.fs) { callback([]); return; }

    // Query both collections for compatibility
    Promise.all([
      GF.fs.getDocs(GF.fs.query(
        GF.fs.collection(GF.db, 'friendships'),
        GF.fs.where('users', 'array-contains', userId),
        GF.fs.limit(200)
      )).catch(function () { return { docs: [] }; }),
      GF.fs.getDocs(GF.fs.query(
        GF.fs.collection(GF.db, 'friends'),
        GF.fs.where('users', 'array-contains', userId),
        GF.fs.limit(200)
      )).catch(function () { return { docs: [] }; })
    ]).then(function (results) {
      var seen = {};
      var uids = [];
      results.forEach(function (snap) {
        snap.docs.forEach(function (d) {
          var data = d.data();
          var arr = Array.isArray(data.users) ? data.users : [];
          arr.forEach(function (uid) {
            if (uid !== userId && !seen[uid]) { seen[uid] = true; uids.push(uid); }
          });
        });
      });
      callback(uids);
    }).catch(function () { callback([]); });
  }

  function getRequests(callback) {
    var GF = window.GeoFirebase;
    var me = currentUser();
    if (!GF || !GF.db || !GF.fs || !me) { callback([]); return; }

    return GF.fs.onSnapshot(
      GF.fs.query(
        GF.fs.collection(GF.db, 'friendRequests'),
        GF.fs.where('toUserId', '==', me.uid),
        GF.fs.where('status', '==', 'pending'),
        GF.fs.limit(30)
      ),
      function (snap) {
        var requests = [];
        var pending = snap.docs.length;
        if (!pending) { callback([]); return; }
        snap.docs.forEach(function (d) {
          var r = Object.assign({ id: d.id }, d.data());
          // Fetch sender profile
          GF.fs.getDoc(GF.fs.doc(GF.db, 'users', r.fromUserId)).then(function (uSnap) {
            var uData = uSnap.exists() ? uSnap.data() : {};
            r.senderName = uData.fullName || uData.displayName || uData.name || 'GeoHub User';
            r.senderAvatar = uData.avatar || uData.photoURL || '';
            r.senderUsername = uData.username || r.fromUserId;
            requests.push(r);
            if (requests.length === snap.docs.length) {
              callback(requests);
            }
          }).catch(function () {
            r.senderName = 'GeoHub User';
            r.senderAvatar = '';
            r.senderUsername = r.fromUserId;
            requests.push(r);
            if (requests.length === snap.docs.length) {
              callback(requests);
            }
          });
        });
      },
      function () { callback([]); }
    );
  }

  function getMutualFriends(otherUserId, callback) {
    var me = currentUser();
    if (!me) { callback([]); return; }
    getFriends(me.uid, function (myFriends) {
      getFriends(otherUserId, function (theirFriends) {
        var theirSet = {};
        theirFriends.forEach(function (uid) { theirSet[uid] = true; });
        callback(myFriends.filter(function (uid) { return theirSet[uid]; }));
      });
    });
  }

  function getSuggestions(callback) {
    var me = currentUser();
    if (!me) { callback([]); return; }
    getFriends(me.uid, function (myFriends) {
      if (!myFriends.length) { callback([]); return; }
      var GF = window.GeoFirebase;
      if (!GF || !GF.db || !GF.fs) { callback([]); return; }

      var myFriendsSet = {};
      myFriends.forEach(function (uid) { myFriendsSet[uid] = true; });
      myFriendsSet[me.uid] = true;

      var suggestions = {};
      var done = 0;

      // For each of my friends, get their friends
      myFriends.slice(0, 10).forEach(function (friendUid) {
        getFriends(friendUid, function (fofs) {
          fofs.forEach(function (uid) {
            if (!myFriendsSet[uid]) {
              suggestions[uid] = (suggestions[uid] || 0) + 1;
            }
          });
          done++;
          if (done === Math.min(myFriends.length, 10)) {
            var sorted = Object.keys(suggestions).sort(function (a, b) { return suggestions[b] - suggestions[a]; }).slice(0, 10);
            if (!sorted.length) { callback([]); return; }
            // Fetch user profiles
            Promise.all(sorted.map(function (uid) {
              return GF.fs.getDoc(GF.fs.doc(GF.db, 'users', uid)).then(function (snap) {
                if (!snap.exists()) return null;
                var d = snap.data();
                return { uid: uid, fullName: d.fullName || d.displayName || 'GeoHub User', avatar: d.avatar || d.photoURL || '', username: d.username || uid, mutualCount: suggestions[uid] };
              }).catch(function () { return null; });
            })).then(function (results) {
              callback(results.filter(Boolean));
            }).catch(function () { callback([]); });
          }
        });
      });
    });
  }

  /* ── "People You May Know" widget on feed/profile ─────────────── */

  function renderPymkWidget(container) {
    if (!container) return;
    container.innerHTML = '<div style="color:var(--gh-muted,#64748b);font-size:.82rem;padding:12px">Loading suggestions…</div>';
    getSuggestions(function (people) {
      if (!people.length) {
        container.innerHTML = '<div style="color:var(--gh-muted,#64748b);font-size:.82rem;padding:12px">No suggestions yet. Add more friends to get suggestions.</div>';
        return;
      }
      container.innerHTML = people.map(function (p) {
        var avatarHtml = p.avatar
          ? '<img src="' + esc(p.avatar) + '" alt="" style="width:40px;height:40px;border-radius:50%;object-fit:cover">'
          : '<div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#6d3fd9,#10b981);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.85rem">' + esc((p.fullName || 'U').charAt(0).toUpperCase()) + '</div>';
        return '<div class="pymk-card" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--gh-border,rgba(255,255,255,.07))">'
          + '<a href="profile.html?id=' + encodeURIComponent(p.uid) + '" style="flex-shrink:0">' + avatarHtml + '</a>'
          + '<div style="flex:1;min-width:0">'
          + '<div style="font-weight:700;font-size:.85rem;color:var(--gh-text,#f0f4ff);white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><a href="profile.html?id=' + encodeURIComponent(p.uid) + '" style="color:inherit;text-decoration:none">' + esc(p.fullName) + '</a></div>'
          + '<div style="font-size:.72rem;color:var(--gh-muted,#64748b)">' + p.mutualCount + ' mutual friend' + (p.mutualCount !== 1 ? 's' : '') + '</div>'
          + '</div>'
          + '<button class="pymk-add-btn" data-pymk-uid="' + esc(p.uid) + '" style="background:linear-gradient(135deg,#10b981,#3b82f6);color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:.75rem;font-weight:700;cursor:pointer;white-space:nowrap">Add Friend</button>'
          + '</div>';
      }).join('');

      // Wire add buttons
      Array.from(container.querySelectorAll('.pymk-add-btn')).forEach(function (btn) {
        btn.addEventListener('click', function () {
          var uid = btn.dataset.pymkUid;
          sendRequest(uid);
          btn.textContent = 'Sent';
          btn.disabled = true;
          btn.style.opacity = '0.6';
        });
      });
    });
  }

  /* ── mutual friends display ──────────────────────────────────── */

  function renderMutualFriendsWidget(otherUserId, container) {
    if (!container) return;
    getMutualFriends(otherUserId, function (mutualUids) {
      if (!mutualUids.length) { container.innerHTML = ''; return; }
      var GF = window.GeoFirebase;
      if (!GF || !GF.db || !GF.fs) { container.innerHTML = mutualUids.length + ' mutual friends'; return; }

      var previewUids = mutualUids.slice(0, 3);
      Promise.all(previewUids.map(function (uid) {
        return GF.fs.getDoc(GF.fs.doc(GF.db, 'users', uid)).then(function (snap) {
          return snap.exists() ? snap.data() : null;
        }).catch(function () { return null; });
      })).then(function (users) {
        var avatarsHtml = users.filter(Boolean).map(function (u) {
          return u.avatar
            ? '<img src="' + esc(u.avatar) + '" alt="" style="width:22px;height:22px;border-radius:50%;object-fit:cover;border:2px solid var(--gh-bg,#0d111f);margin-right:-6px">'
            : '<div style="width:22px;height:22px;border-radius:50%;background:#6d3fd9;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:.55rem;font-weight:700;border:2px solid var(--gh-bg,#0d111f);margin-right:-6px">' + esc((u.fullName || 'U').charAt(0).toUpperCase()) + '</div>';
        }).join('');
        container.innerHTML = '<div style="display:flex;align-items:center;gap:8px;font-size:.82rem;color:var(--gh-muted,#64748b)">'
          + '<div style="display:flex;padding-right:6px">' + avatarsHtml + '</div>'
          + mutualUids.length + ' mutual friend' + (mutualUids.length !== 1 ? 's' : '')
          + '</div>';
      }).catch(function () {
        container.innerHTML = '<span style="font-size:.82rem;color:var(--gh-muted,#64748b)">' + mutualUids.length + ' mutual friends</span>';
      });
    });
  }

  /* ── online status display ───────────────────────────────────── */

  function renderOnlineStatus(userId, container) {
    if (!container) return;
    var GF = window.GeoFirebase;
    if (!GF || !GF.db || !GF.fs) return;
    GF.fs.getDoc(GF.fs.doc(GF.db, 'users', userId)).then(function (snap) {
      if (!snap.exists()) return;
      var d = snap.data();
      if (d.online) {
        container.innerHTML = '<span style="display:inline-flex;align-items:center;gap:5px;font-size:.78rem;color:#10b981"><span style="width:8px;height:8px;border-radius:50%;background:#10b981;display:inline-block"></span>Active now</span>';
      } else if (d.lastSeen) {
        var ms = typeof d.lastSeen === 'object' && d.lastSeen.toMillis ? d.lastSeen.toMillis() : (d.lastSeen.seconds || 0) * 1000;
        var diff = Date.now() - ms;
        var label;
        if (diff < 3600000) label = Math.floor(diff / 60000) + 'm ago';
        else if (diff < 86400000) label = Math.floor(diff / 3600000) + 'h ago';
        else label = Math.floor(diff / 86400000) + 'd ago';
        container.innerHTML = '<span style="font-size:.78rem;color:var(--gh-muted,#64748b)">Active ' + esc(label) + '</span>';
      }
    }).catch(function () {});
  }

  /* ── expose ──────────────────────────────────────────────────── */

  window.GeoFriendships = {
    sendRequest: sendRequest,
    accept: accept,
    decline: decline,
    unfriend: unfriend,
    getStatus: getStatus,
    getFriends: getFriends,
    getRequests: getRequests,
    getMutualFriends: getMutualFriends,
    getSuggestions: getSuggestions,
    renderPymkWidget: renderPymkWidget,
    renderMutualFriendsWidget: renderMutualFriendsWidget,
    renderOnlineStatus: renderOnlineStatus,
    initPresence: initPresence,
    checkFriendBirthdays: checkFriendBirthdays
  };

  /* ── auto-init presence on Firebase ready ────────────────────── */

  function tryInit() {
    var GF = window.GeoFirebase;
    if (!GF || !GF.auth) return;
    if (GF.auth.currentUser) {
      initPresence();
    } else if (typeof GF.auth.onAuthStateChanged === 'function') {
      GF.auth.onAuthStateChanged(function (u) {
        if (u) { initPresence(); }
      });
    }
  }

  if (window.GeoFirebase && window.GeoFirebase.db) {
    tryInit();
  } else {
    window.addEventListener('GeoFirebaseReady', tryInit, { once: true });
  }

})();
