/* GeoHub — Firestore Social Layer  (window.GeoSocial)
   All persistent social actions: posts, likes, comments, follows,
   saved posts, groups, events, friend requests, check-ins, stories.
*/
(function GeoSocialInit() {
  'use strict';

  // ── Toast helper (standalone so fallback can use it too) ──────────────
  function toast(msg, type) {
    var el = document.querySelector('.gh-toast');
    if (el) el.remove();
    el = document.createElement('div');
    el.className = 'gh-toast' + (type === 'error' ? ' gh-toast-error' : '');
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { el.remove(); }, 250);
    }, 2200);
  }

  // ── Login prompt ──────────────────────────────────────────────────────
  function showLoginPrompt() {
    if (document.getElementById('ghAuthModal')) return;
    var ov = document.createElement('div');
    ov.id = 'ghAuthModal';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:99998;display:flex;align-items:center;justify-content:center';
    ov.innerHTML =
      '<div style="background:var(--bg-card,#1a1f35);border:1px solid var(--border,#2a3050);border-radius:16px;padding:32px 28px;max-width:360px;width:90%;text-align:center">' +
        '<div style="font-size:2rem;margin-bottom:12px">🔐</div>' +
        '<h3 style="font-size:1.1rem;font-weight:800;color:var(--text-primary,#f0f4ff);margin-bottom:8px">Sign in to GeoHub</h3>' +
        '<p style="color:var(--text-secondary,#94a3b8);font-size:0.875rem;margin-bottom:24px;line-height:1.55">Like, comment, follow, post — all require a free account.</p>' +
        '<a href="auth.html" style="display:block;padding:12px;border-radius:10px;background:linear-gradient(135deg,#10b981,#3b82f6);color:#fff;font-weight:700;text-decoration:none;margin-bottom:10px;font-size:0.9rem">Log In / Sign Up</a>' +
        '<button id="ghAuthModalClose" style="background:none;border:none;color:var(--text-muted,#6b7280);cursor:pointer;font-size:0.875rem;padding:6px">Maybe later</button>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
    document.getElementById('ghAuthModalClose').addEventListener('click', function () { ov.remove(); });
  }

  // ── No-op fallback when Firebase is unavailable ───────────────────────
  function setupFallback() {
    function noop() { console.warn('[GeoSocial] Firebase unavailable'); }
    window.GeoSocial = {
      createPost: noop,
      listenFeed: function () { return function () {}; },
      toggleLike: noop,
      checkLiked: function (id, cb) { cb(false); },
      addComment: noop,
      listenComments: function () { return function () {}; },
      toggleFollow: noop,
      checkFollowing: function (id, cb) { cb(false); },
      toggleSavePost: noop,
      checkSaved: function (id, cb) { cb(false); },
      checkGroupMember: function (id, cb) { cb(false); },
      checkEventParticipant: function (id, cb) { cb(false); },
      toggleGroupMember: noop,
      toggleEventParticipant: noop,
      sendFriendRequest: noop,
      createCheckin: noop,
      createStory: noop,
      listenStories: function () { return function () {}; },
      listenUserNotifications: function (uid, cb) { cb([]); return function () {}; },
      markNotificationRead: function () {},
      listenUserPosts: function (uid, cb) { cb([]); return function () {}; },
      listenUserCheckins: function (uid, cb) { cb([]); return function () {}; },
      trackShare: noop,
      createGroup: noop,
      listenGroups: function (o, cb) { (cb||o)([]); return function(){}; },
      listenMyGroups: function (uid, cb) { cb([]); return function(){}; },
      createGroupPost: noop,
      listenGroupPosts: function (id, cb) { cb([]); return function(){}; },
      createPlace: noop,
      listenPlaces: function (o, cb) { (cb||o)([]); return function(){}; },
      toggleSaveItem: noop,
      checkSavedItem: function (t, id, cb) { cb(false); },
      listenSavedItems: function (uid, t, cb) { cb([]); return function(){}; },
      listenSavedPosts: function (uid, cb) { cb([]); return function(){}; },
      listenSavedPlaces: function (uid, cb) { cb([]); return function(){}; },
      createPlaceReview: function (placeId, rating, comment, cb) { noop(); if(cb) cb(false); },
      listenPlaceReviews: function (placeId, cb) { cb([]); return function(){}; },
      requestJoinGroup: function (groupId, cb) { noop(); if(cb) cb('error'); },
      checkJoinRequest: function (groupId, cb) { cb(false); },
      getMyJoinRequests: function (cb) { cb({}); },
      searchFirestore: function (q, cb) { cb({ users:[], groups:[], places:[], posts:[] }); },
      findUserByInput: function () { return Promise.resolve(null); },
      requireAuth: showLoginPrompt,
      toast: toast
    };
    window.dispatchEvent(new Event('GeoSocialReady'));
  }

  // ── Main setup (runs once Firebase is ready) ──────────────────────────
  function setup(GF) {
    var db  = GF.db;
    var auth = GF.auth;
    var fs  = GF.fs;
    var doc            = fs.doc;
    var setDoc         = fs.setDoc;
    var getDoc         = fs.getDoc;
    var addDoc         = fs.addDoc;
    var updateDoc      = fs.updateDoc;
    var deleteDoc      = fs.deleteDoc;
    var collection     = fs.collection;
    var query          = fs.query;
    var orderBy        = fs.orderBy;
    var where          = fs.where;
    var limit          = fs.limit;
    var onSnapshot     = fs.onSnapshot;
    var getDocs        = fs.getDocs;
    var serverTimestamp = fs.serverTimestamp;
    var increment      = fs.increment;
    var runTransaction = fs.runTransaction;

    // ── Auth helpers ────────────────────────────────────────────────────
    function requireAuth(cb) {
      var user = auth.currentUser;
      if (user) return cb(user);
      showLoginPrompt();
    }

    function currentUid() {
      return auth.currentUser ? auth.currentUser.uid : null;
    }

    function meData() {
      var user = auth.currentUser;
      if (!user) return null;
      return {
        uid: user.uid,
        name: user.displayName || (user.email ? user.email.split('@')[0] : 'GeoHub User'),
        avatar: user.photoURL || ''
      };
    }


    function createNotification(toUserId, type, title, body, href, extra) {
      var me = meData() || {};
      if (!toUserId || !me.uid || toUserId === me.uid) return Promise.resolve();
      var payload = Object.assign({
        userId: toUserId,
        toUserId: toUserId,
        fromUserId: me.uid,
        fromName: me.name || 'GeoHub User',
        fromAvatar: me.avatar || '',
        type: type || 'notification',
        title: title || 'GeoHub',
        body: body || '',
        message: body || '',
        href: href || 'feed.html',
        read: false,
        createdAt: serverTimestamp()
      }, extra || {});
      return addDoc(collection(db, 'userNotifications'), payload).catch(function (err) {
        console.warn('[GeoSocial] createNotification', err.message);
      });
    }

    function getPostOwner(postId) {
      return getDoc(doc(db, 'posts', postId)).then(function (snap) {
        if (!snap.exists()) return null;
        var data = snap.data() || {};
        return data.authorId || data.userId || null;
      });
    }

    function conversationIdFor(a, b) {
      return [a, b].sort().join('_');
    }

    // ── POSTS ────────────────────────────────────────────────────────────
    function createPost(text, mediaUrl, callback, extra) {
      text = (text || '').trim();
      if (!text && !mediaUrl) return toast('Write something or choose a photo first!', 'error');
      requireAuth(function (user) {
        var me = meData() || {};
        addDoc(collection(db, 'posts'), {
          text: text,
          mediaUrl: mediaUrl || null,
          mediaType: extra && extra.mediaType ? extra.mediaType : null,
          taggedUserIds: extra && extra.taggedUserIds ? extra.taggedUserIds : [],
          taggedUsers: extra && extra.taggedUsers ? extra.taggedUsers : [],
          feeling: extra && extra.feeling ? extra.feeling : '',
          authorId: user.uid,
          userId: user.uid,
          authorName: me.name || user.displayName || 'GeoHub User',
          authorAvatar: me.avatar || user.photoURL || '',
          likeCount: 0,
          commentCount: 0,
          shareCount: 0,
          createdAt: serverTimestamp()
        }).then(function (ref) {
          toast('Post published!');
          if (callback) callback(ref.id);
        }).catch(function (err) {
          console.error('[GeoSocial] createPost', err);
          toast('Failed to post. Try again.', 'error');
        });
      });
    }

    function listenFeed(callback, limitN) {
      var q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(limitN || 30));
      return onSnapshot(q, function (snap) {
        var posts = [];
        snap.forEach(function (d) { posts.push(Object.assign({ id: d.id }, d.data())); });
        callback(posts);
      }, function (err) {
        console.warn('[GeoSocial] listenFeed', err.message);
      });
    }

    // ── LIKES ────────────────────────────────────────────────────────────
    function toggleLike(postId, currentlyLiked, callback) {
      requireAuth(function (user) {
        var uid = user.uid;
        var likeRef = doc(db, 'posts', postId, 'likes', uid);
        var postRef = doc(db, 'posts', postId);
        var nextLiked = false;

        var work = runTransaction ? runTransaction(db, function (tx) {
          return tx.get(likeRef).then(function (likeSnap) {
            if (likeSnap.exists()) {
              tx.delete(likeRef);
              tx.update(postRef, { likeCount: increment(-1) });
              nextLiked = false;
            } else {
              tx.set(likeRef, { uid: uid, userId: uid, createdAt: serverTimestamp() });
              tx.update(postRef, { likeCount: increment(1) });
              nextLiked = true;
            }
          });
        }) : (currentlyLiked
          ? deleteDoc(likeRef).then(function () { nextLiked = false; return updateDoc(postRef, { likeCount: increment(-1) }); })
          : setDoc(likeRef, { uid: uid, userId: uid, createdAt: serverTimestamp() }).then(function () { nextLiked = true; return updateDoc(postRef, { likeCount: increment(1) }); })
        );

        work.then(function () {
          if (nextLiked) {
            getPostOwner(postId).then(function (ownerId) {
              return createNotification(ownerId, 'like', (meData() || {}).name + ' liked your post', 'Someone liked your post.', 'feed.html#post-' + postId, { postId: postId });
            });
          }
          if (callback) callback(nextLiked);
        }).catch(function (err) {
          console.error('[GeoSocial] toggleLike', err);
          toast('Like failed. Try again.', 'error');
        });
      });
    }

    function checkLiked(postId, callback) {
      var uid = currentUid();
      if (!uid) return callback(false);
      getDoc(doc(db, 'posts', postId, 'likes', uid))
        .then(function (d) { callback(d.exists()); })
        .catch(function () { callback(false); });
    }

    // ── COMMENTS ────────────────────────────────────────────────────────
    function addComment(postId, text, callback) {
      if (!text || !text.trim()) return;
      requireAuth(function (user) {
        var me = meData() || {};
        addDoc(collection(db, 'posts', postId, 'comments'), {
          text: text.trim(),
          authorId: user.uid,
          userId: user.uid,
          authorName: me.name || user.displayName || 'GeoHub User',
          authorAvatar: me.avatar || user.photoURL || '',
          likes: 0,
          createdAt: serverTimestamp()
        }).then(function () {
          return updateDoc(doc(db, 'posts', postId), { commentCount: increment(1) });
        }).then(function () {
          return getPostOwner(postId).then(function (ownerId) {
            return createNotification(ownerId, 'comment', (meData() || {}).name + ' commented on your post', text.trim(), 'feed.html#post-' + postId, { postId: postId });
          });
        }).then(function () {
          toast('Comment posted');
          if (callback) callback();
        }).catch(function (err) {
          console.error('[GeoSocial] addComment', err);
          toast('Failed to comment.', 'error');
          if (callback) callback(null, err);
        });
      });
    }

    function listenComments(postId, callback) {
      var q = query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'asc'));
      return onSnapshot(q, function (snap) {
        var comments = [];
        snap.forEach(function (d) { comments.push(Object.assign({ id: d.id }, d.data())); });
        callback(comments);
      }, function (err) {
        console.warn('[GeoSocial] listenComments', err.message);
      });
    }

    // ── FOLLOWS ─────────────────────────────────────────────────────────
    function toggleFollow(targetUserId, callback) {
      requireAuth(function (user) {
        var uid = user.uid;
        if (uid === targetUserId) return;
        var ref = doc(db, 'follows', uid + '_' + targetUserId);
        getDoc(ref).then(function (d) {
          if (d.exists()) {
            return deleteDoc(ref).then(function () {
              return updateDoc(doc(db, 'users', targetUserId), { followers: increment(-1) }).catch(function(){})
                .then(function(){ return updateDoc(doc(db, 'users', uid), { following: increment(-1) }).catch(function(){}); });
            }).then(function () {
              toast('Unfollowed');
              if (callback) callback(false);
            });
          } else {
            return setDoc(ref, { followerId: uid, followingId: targetUserId, targetId: targetUserId, createdAt: serverTimestamp() })
              .then(function () {
                return updateDoc(doc(db, 'users', targetUserId), { followers: increment(1) }).catch(function(){})
                  .then(function(){ return updateDoc(doc(db, 'users', uid), { following: increment(1) }).catch(function(){}); })
                  .then(function(){ return createNotification(targetUserId, 'follow', (meData() || {}).name + ' followed you', 'You have a new follower.', 'profile.html?uid=' + uid, { followerId: uid }); });
              })
              .then(function () {
                toast('Following');
                if (callback) callback(true);
              });
          }
        }).catch(function (err) {
          console.error('[GeoSocial] toggleFollow', err);
          toast('Action failed.', 'error');
        });
      });
    }

    function checkFollowing(targetUserId, callback) {
      var uid = currentUid();
      if (!uid) return callback(false);
      getDoc(doc(db, 'follows', uid + '_' + targetUserId))
        .then(function (d) { callback(d.exists()); })
        .catch(function () { callback(false); });
    }

    // ── SAVED POSTS ──────────────────────────────────────────────────────
    function toggleSavePost(postId, callback) {
      requireAuth(function (user) {
        var uid = user.uid;
        var ref = doc(db, 'savedPosts', uid + '_' + postId);
        getDoc(ref).then(function (d) {
          if (d.exists()) {
            return deleteDoc(ref).then(function () {
              toast('Removed from saved');
              if (callback) callback(false);
            });
          } else {
            return setDoc(ref, { uid: uid, userId: uid, postId: postId, createdAt: serverTimestamp() })
              .then(function () {
                toast('Post saved');
                if (callback) callback(true);
              });
          }
        }).catch(function (err) {
          console.error('[GeoSocial] toggleSavePost', err);
          toast('Action failed.', 'error');
        });
      });
    }

    // ── GROUPS ──────────────────────────────────────────────────────────
    function toggleGroupMember(groupId, groupName, callback) {
      requireAuth(function (user) {
        var uid = user.uid;
        var ref = doc(db, 'groupMembers', groupId + '_' + uid);
        var groupRef = doc(db, 'groups', groupId);
        getDoc(ref).then(function (d) {
          if (d.exists()) {
            return deleteDoc(ref).then(function () {
              return updateDoc(groupRef, { memberCount: increment(-1) }).catch(function(){});
            }).then(function () {
              toast('Left group');
              if (callback) callback(false);
            });
          } else {
            return setDoc(ref, { groupId: groupId, groupName: groupName || '', uid: uid, userId: uid, role: 'member', status: 'joined', joinedAt: serverTimestamp(), createdAt: serverTimestamp() })
              .then(function () {
                return updateDoc(groupRef, { memberCount: increment(1) }).catch(function(){});
              }).then(function () {
                toast('Joined ' + (groupName || 'group') + '!');
                if (callback) callback(true);
              });
          }
        }).catch(function (err) {
          console.error('[GeoSocial] toggleGroupMember', err);
          toast('Action failed.', 'error');
        });
      });
    }

    function createGroup(data, callback) {
      requireAuth(function (user) {
        var me = meData() || {};
        var name = (data.name || '').trim();
        if (!name) return toast('Group name is required', 'error');
        addDoc(collection(db, 'groups'), {
          name: name,
          description: (data.description || '').trim(),
          category: data.category || 'general',
          coverUrl: data.coverUrl || '',
          privacy: data.privacy || 'public',
          location: data.location || '',
          tags: data.tags || [],
          creatorId: user.uid,
          userId: user.uid,
          creatorName: me.name || user.displayName || 'GeoHub User',
          creatorAvatar: me.avatar || user.photoURL || '',
          memberCount: 1,
          postCount: 0,
          createdAt: serverTimestamp()
        }).then(function (ref) {
          return setDoc(doc(db, 'groupMembers', ref.id + '_' + user.uid), {
            groupId: ref.id, groupName: name, uid: user.uid, userId: user.uid,
            role: 'admin', status: 'joined', joinedAt: serverTimestamp(), createdAt: serverTimestamp()
          }).then(function () { toast('Group created!'); if (callback) callback(ref.id); });
        }).catch(function (err) {
          console.error('[GeoSocial] createGroup', err);
          toast('Failed to create group: ' + (err.code || err.message), 'error');
          if (callback) callback(null);
        });
      });
    }

    function listenGroups(opts, callback) {
      if (typeof opts === 'function') { callback = opts; opts = {}; }
      var cat = (opts && opts.category) || '';
      var q = (cat && cat !== 'all')
        ? query(collection(db, 'groups'), where('category', '==', cat), limit(50))
        : query(collection(db, 'groups'), limit(50));
      return onSnapshot(q, function (snap) {
        var items = [];
        snap.forEach(function (d) { items.push(Object.assign({ id: d.id }, d.data())); });
        items.sort(function (a, b) {
          function ms(v) { return v && v.toMillis ? v.toMillis() : (v && v.seconds ? v.seconds * 1000 : 0); }
          return ms(b.createdAt) - ms(a.createdAt);
        });
        callback(items);
      }, function (err) { console.error('[GeoSocial] listenGroups error:', err.code, err.message); callback([]); });
    }

    function listenMyGroups(uid, callback) {
      if (!uid) { callback([]); return function () {}; }
      var q = query(collection(db, 'groupMembers'), where('uid', '==', uid), limit(50));
      return onSnapshot(q, function (snap) {
        var memberDocs = [];
        snap.forEach(function (d) { memberDocs.push(d.data()); });
        if (!memberDocs.length) { callback([]); return; }
        var ids = memberDocs.map(function (m) { return m.groupId; }).filter(Boolean);
        Promise.all(ids.map(function (gid) {
          return getDoc(doc(db, 'groups', gid))
            .then(function (d) { return d.exists() ? Object.assign({ id: d.id }, d.data()) : null; })
            .catch(function () { return null; });
        })).then(function (groups) { callback(groups.filter(Boolean)); });
      }, function (err) { console.warn('[GeoSocial] listenMyGroups', err.message); callback([]); });
    }

    function createGroupPost(groupId, text, mediaUrl, callback) {
      if (!text || !text.trim()) return;
      requireAuth(function (user) {
        var me = meData() || {};
        addDoc(collection(db, 'groupPosts'), {
          groupId: groupId, text: text.trim(), mediaUrl: mediaUrl || null,
          authorId: user.uid, userId: user.uid,
          authorName: me.name || user.displayName || 'GeoHub User',
          authorAvatar: me.avatar || user.photoURL || '',
          likeCount: 0, commentCount: 0, createdAt: serverTimestamp()
        }).then(function () {
          return updateDoc(doc(db, 'groups', groupId), { postCount: increment(1) }).catch(function(){});
        }).then(function () { toast('Posted!'); if (callback) callback(); })
          .catch(function (err) { console.error('[GeoSocial] createGroupPost', err); toast('Failed to post.', 'error'); });
      });
    }

    function listenGroupPosts(groupId, callback) {
      var q = query(collection(db, 'groupPosts'), where('groupId', '==', groupId), limit(50));
      return onSnapshot(q, function (snap) {
        var items = [];
        snap.forEach(function (d) { items.push(Object.assign({ id: d.id }, d.data())); });
        items.sort(function (a, b) {
          function ms(v) { return v && v.toMillis ? v.toMillis() : (v && v.seconds ? v.seconds * 1000 : 0); }
          return ms(b.createdAt) - ms(a.createdAt);
        });
        callback(items);
      }, function (err) {
        console.error('[GeoSocial] listenGroupPosts error:', err.code, err.message);
        callback([]);
      });
    }

    // ── EVENTS ──────────────────────────────────────────────────────────
    function toggleEventParticipant(eventId, eventName, status, callback) {
      requireAuth(function (user) {
        var uid = user.uid;
        var ref = doc(db, 'eventParticipants', eventId + '_' + uid);
        getDoc(ref).then(function (d) {
          if (d.exists()) {
            return deleteDoc(ref).then(function () {
              toast('Removed from event');
              if (callback) callback(false);
            });
          } else {
            return setDoc(ref, { eventId: eventId, eventName: eventName || '', uid: uid, userId: uid, status: status || 'going', joinedAt: serverTimestamp(), createdAt: serverTimestamp() })
              .then(function () {
                toast((status === 'interested' ? 'Interested in ' : 'Going to ') + (eventName || 'event') + '!');
                if (callback) callback(true);
              });
          }
        }).catch(function (err) {
          console.error('[GeoSocial] toggleEventParticipant', err);
          toast('Action failed.', 'error');
        });
      });
    }

    // ── FRIEND REQUESTS ──────────────────────────────────────────────────
    function sendFriendRequest(toUserId, callback) {
      requireAuth(function (user) {
        var uid = user.uid;
        if (uid === toUserId) return;
        var ref = doc(db, 'friendRequests', uid + '_' + toUserId);
        setDoc(ref, { fromId: uid, fromUserId: uid, toId: toUserId, toUserId: toUserId, status: 'pending', createdAt: serverTimestamp() }, { merge: false })
          .then(function () {
            toast('Friend request sent!');
            if (callback) callback();
          }).catch(function (err) {
            console.error('[GeoSocial] sendFriendRequest', err);
            toast(err.code === 'permission-denied' ? 'Request already sent.' : 'Failed to send request.', 'error');
          });
      });
    }

    // ── CHECK-INS ────────────────────────────────────────────────────────
    function createCheckin(placeId, placeName, xpAwarded, callback) {
      requireAuth(function (user) {
        var me = meData() || {};
        addDoc(collection(db, 'checkins'), {
          placeId: placeId || '',
          placeName: placeName || '',
          xpAwarded: xpAwarded || 50,
          authorId: user.uid,
          userId: user.uid,
          authorName: me.name || user.displayName || 'GeoHub User',
          authorAvatar: me.avatar || user.photoURL || '',
          createdAt: serverTimestamp()
        }).then(function () {
          toast('Checked in at ' + (placeName || 'place') + '! +' + (xpAwarded || 50) + ' XP');
          if (callback) callback();
        }).catch(function (err) {
          console.error('[GeoSocial] createCheckin', err);
          toast('Check-in failed.', 'error');
        });
      });
    }

    // ── STORIES ─────────────────────────────────────────────────────────
    function createStory(text, mediaUrl, callback) {
      requireAuth(function (user) {
        var me = meData() || {};
        addDoc(collection(db, 'stories'), {
          text: text || '',
          mediaUrl: mediaUrl || null,
          authorId: user.uid,
          userId: user.uid,
          authorName: me.name || user.displayName || 'GeoHub User',
          authorAvatar: me.avatar || user.photoURL || '',
          createdAt: serverTimestamp(),
          expiresAt: new Date(Date.now() + 86400000)
        }).then(function () {
          toast('Story posted!');
          if (callback) callback();
        }).catch(function (err) {
          console.error('[GeoSocial] createStory', err);
          toast('Failed to post story.', 'error');
          if (callback) callback(null, err);
        });
      });
    }

    function listenUserNotifications(uid, callback) {
      if (!uid) return function () {};
      var q = query(collection(db, 'userNotifications'),
        where('userId', '==', uid),
        limit(30));
      return onSnapshot(q, function (snap) {
        var notifs = [];
        snap.forEach(function (d) { notifs.push(Object.assign({ id: d.id }, d.data())); });
        notifs.sort(function (a, b) {
          function ms(v) { return v && v.toMillis ? v.toMillis() : (v && v.seconds ? v.seconds * 1000 : 0); }
          return ms(b.createdAt) - ms(a.createdAt);
        });
        callback(notifs);
      }, function (err) { console.warn('[GeoSocial] listenUserNotifications', err.message); });
    }

    function markNotificationRead(notifId) {
      updateDoc(doc(db, 'userNotifications', notifId), { read: true })
        .catch(function (err) { console.warn('[GeoSocial] markNotifRead', err.message); });
    }

    function listenUserPosts(uid, callback) {
      var postsById = {};
      var ready = { a:false, u:false };
      function emit(){
        if(!ready.a || !ready.u) return;
        var posts = Object.keys(postsById).map(function(id){ return postsById[id]; });
        posts.sort(function(a,b){ return tsToMillis(b.createdAt) - tsToMillis(a.createdAt); });
        callback(posts);
      }
      var qa = query(collection(db, 'posts'), where('authorId', '==', uid), limit(50));
      var qu = query(collection(db, 'posts'), where('userId', '==', uid), limit(50));
      var unsubA = onSnapshot(qa, function(snap){
        snap.forEach(function(d){ postsById[d.id] = Object.assign({id:d.id}, d.data()); });
        ready.a = true; emit();
      }, function(err){ console.warn('[GeoSocial] listenUserPosts authorId', err.message); ready.a=true; emit(); });
      var unsubU = onSnapshot(qu, function(snap){
        snap.forEach(function(d){ postsById[d.id] = Object.assign({id:d.id}, d.data()); });
        ready.u = true; emit();
      }, function(err){ console.warn('[GeoSocial] listenUserPosts userId', err.message); ready.u=true; emit(); });
      return function(){ try{unsubA();}catch(e){} try{unsubU();}catch(e){} };
    }

    function listenUserCheckins(uid, callback) {
      var q = query(collection(db, 'checkins'), where('authorId', '==', uid), limit(30));
      return onSnapshot(q, function (snap) {
        var items = [];
        snap.forEach(function (d) { items.push(Object.assign({ id: d.id }, d.data())); });
        items.sort(function (a, b) {
          function ms(v) { return v && v.toMillis ? v.toMillis() : (v && v.seconds ? v.seconds * 1000 : 0); }
          return ms(b.createdAt) - ms(a.createdAt);
        });
        callback(items);
      }, function (err) { console.warn('[GeoSocial] listenUserCheckins', err.message); callback([]); });
    }

    function tsToMillis(value) {
      if (!value) return 0;
      if (typeof value.toMillis === 'function') return value.toMillis();
      if (value instanceof Date) return value.getTime();
      if (typeof value === 'number') return value;
      if (value.seconds) return value.seconds * 1000;
      return Date.parse(value) || 0;
    }

    function listenStories(callback) {
      var q = query(collection(db, 'stories'), orderBy('createdAt', 'desc'), limit(50));
      return onSnapshot(q, function (snap) {
        var now = Date.now();
        var stories = [];
        snap.forEach(function (d) {
          var data = Object.assign({ id: d.id }, d.data());
          if (!data.expiresAt || tsToMillis(data.expiresAt) > now) stories.push(data);
        });
        callback(stories.slice(0, 20));
      }, function (err) {
        console.warn('[GeoSocial] listenStories', err.message);
        callback([]);
      });
    }

    // ── CHECK STATE HELPERS ──────────────────────────────────────────────
    function checkSaved(postId, callback) {
      var uid = currentUid();
      if (!uid) return callback(false);
      getDoc(doc(db, 'savedPosts', uid + '_' + postId))
        .then(function (d) { callback(d.exists()); })
        .catch(function () { callback(false); });
    }

    function checkGroupMember(groupId, callback) {
      var uid = currentUid();
      if (!uid) return callback(false);
      getDoc(doc(db, 'groupMembers', groupId + '_' + uid))
        .then(function (d) { callback(d.exists()); })
        .catch(function () { callback(false); });
    }

    function checkEventParticipant(eventId, callback) {
      var uid = currentUid();
      if (!uid) return callback(false);
      getDoc(doc(db, 'eventParticipants', eventId + '_' + uid))
        .then(function (d) { callback(d.exists()); })
        .catch(function () { callback(false); });
    }

    // ── SHARES ──────────────────────────────────────────────────────────
    function trackShare(postId) {
      updateDoc(doc(db, 'posts', postId), { shareCount: increment(1) })
        .catch(function (err) { console.warn('[GeoSocial] trackShare', err.message); });
    }


    // ── REAL MESSAGES ───────────────────────────────────────────────────
    function startConversation(targetUserId, callback) {
      requireAuth(function (user) {
        if (!targetUserId || targetUserId === user.uid) return;
        var cid = conversationIdFor(user.uid, targetUserId);
        setDoc(doc(db, 'conversations', cid), {
          participants: [user.uid, targetUserId],
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          lastMessage: ''
        }, { merge: true }).then(function () {
          if (callback) callback(cid);
        }).catch(function (err) {
          console.error('[GeoSocial] startConversation', err);
          toast('Could not open messages.', 'error');
        });
      });
    }

    function sendMessage(conversationId, text, callback) {
      if (!text || !text.trim()) return;
      requireAuth(function (user) {
        var me = meData() || {};
        var convRef = doc(db, 'conversations', conversationId);
        getDoc(convRef).then(function (snap) {
          if (!snap.exists()) throw new Error('Conversation not found');
          var conv = snap.data() || {};
          var otherId = (conv.participants || []).find(function (id) { return id !== user.uid; });
          return addDoc(collection(db, 'conversations', conversationId, 'messages'), {
            conversationId: conversationId,
            senderId: user.uid,
            authorId: user.uid,
            text: text.trim(),
            createdAt: serverTimestamp()
          }).then(function () {
            return updateDoc(convRef, { lastMessage: text.trim(), lastSenderId: user.uid, updatedAt: serverTimestamp() });
          }).then(function () {
            return createNotification(otherId, 'message', (me.name || 'GeoHub User') + ' sent you a message', text.trim(), 'messages.html?with=' + user.uid, { conversationId: conversationId });
          });
        }).then(function () {
          if (callback) callback();
        }).catch(function (err) {
          console.error('[GeoSocial] sendMessage', err);
          toast('Message failed.', 'error');
        });
      });
    }

    function listenConversations(callback) {
      var uid = currentUid();
      if (!uid) { callback([]); return function () {}; }
      function sortConvs(items){
        return items.sort(function(a,b){
          function t(v){ return v && v.toMillis ? v.toMillis() : (v && v.seconds ? v.seconds*1000 : 0); }
          return t(b.updatedAt || b.createdAt) - t(a.updatedAt || a.createdAt);
        });
      }
      var q = query(collection(db, 'conversations'), where('participants', 'array-contains', uid));
      return onSnapshot(q, function (snap) {
        var items = [];
        snap.forEach(function (d) { items.push(Object.assign({ id: d.id }, d.data())); });
        callback(sortConvs(items));
      }, function (err) { console.warn('[GeoSocial] listenConversations', err.message); callback([]); });
    }

    function listenMessages(conversationId, callback) {
      var q = query(collection(db, 'conversations', conversationId, 'messages'), orderBy('createdAt', 'asc'), limit(100));
      return onSnapshot(q, function (snap) {
        var items = [];
        snap.forEach(function (d) { items.push(Object.assign({ id: d.id }, d.data())); });
        callback(items);
      }, function (err) { console.warn('[GeoSocial] listenMessages', err.message); callback([]); });
    }

    // ── PLACES ──────────────────────────────────────────────────────────
    function createPlace(data, callback) {
      requireAuth(function (user) {
        var me = meData() || {};
        var name = (data.name || '').trim();
        if (!name) return toast('Place name is required', 'error');
        addDoc(collection(db, 'places'), {
          name: name,
          description: (data.description || '').trim(),
          category: data.category || 'other',
          photoUrl: data.photoUrl || '',
          address: data.address || '',
          lat: data.lat || null,
          lng: data.lng || null,
          tags: data.tags || [],
          creatorId: user.uid,
          userId: user.uid,
          creatorName: me.name || user.displayName || 'GeoHub User',
          rating: 0, reviewCount: 0, saveCount: 0,
          createdAt: serverTimestamp()
        }).then(function (ref) {
          toast('Place added!');
          if (callback) callback(ref.id);
        }).catch(function (err) {
          console.error('[GeoSocial] createPlace', err);
          toast('Failed to add place: ' + (err.code || err.message), 'error');
          if (callback) callback(null);
        });
      });
    }

    function listenPlaces(opts, callback) {
      if (typeof opts === 'function') { callback = opts; opts = {}; }
      var cat = (opts && opts.category) || '';
      var q = (cat && cat !== 'all')
        ? query(collection(db, 'places'), where('category', '==', cat), limit(50))
        : query(collection(db, 'places'), limit(50));
      return onSnapshot(q, function (snap) {
        var items = [];
        snap.forEach(function (d) { items.push(Object.assign({ id: d.id }, d.data())); });
        items.sort(function (a, b) {
          function ms(v) { return v && v.toMillis ? v.toMillis() : (v && v.seconds ? v.seconds * 1000 : 0); }
          return ms(b.createdAt) - ms(a.createdAt);
        });
        callback(items);
      }, function (err) { console.error('[GeoSocial] listenPlaces error:', err.code, err.message); callback([]); });
    }

    // ── SAVE ITEMS (generic: posts, places, etc.) ─────────────────────────
    function toggleSaveItem(type, itemId, callback) {
      requireAuth(function (user) {
        var uid = user.uid;
        var ref = doc(db, 'savedItems', uid + '_' + type + '_' + itemId);
        getDoc(ref).then(function (d) {
          if (d.exists()) {
            return deleteDoc(ref).then(function () { toast('Removed from saved'); if (callback) callback(false); });
          } else {
            return setDoc(ref, { userId: uid, uid: uid, type: type, itemId: itemId, createdAt: serverTimestamp() })
              .then(function () { toast('Saved!'); if (callback) callback(true); });
          }
        }).catch(function (err) {
          console.error('[GeoSocial] toggleSaveItem', err);
          toast('Action failed.', 'error');
        });
      });
    }

    function checkSavedItem(type, itemId, callback) {
      var uid = currentUid();
      if (!uid) return callback(false);
      getDoc(doc(db, 'savedItems', uid + '_' + type + '_' + itemId))
        .then(function (d) { callback(d.exists()); })
        .catch(function () { callback(false); });
    }

    function listenSavedItems(uid, type, callback) {
      if (!uid) { callback([]); return function () {}; }
      var q = (type && type !== 'all')
        ? query(collection(db, 'savedItems'), where('userId', '==', uid), where('type', '==', type), limit(50))
        : query(collection(db, 'savedItems'), where('userId', '==', uid), limit(50));
      return onSnapshot(q, function (snap) {
        var items = [];
        snap.forEach(function (d) { items.push(Object.assign({ id: d.id }, d.data())); });
        callback(items);
      }, function (err) { console.warn('[GeoSocial] listenSavedItems', err.message); callback([]); });
    }

    function listenSavedPosts(uid, callback) {
      if (!uid) { callback([]); return function () {}; }
      var q = query(collection(db, 'savedPosts'), where('userId', '==', uid), limit(50));
      return onSnapshot(q, function (snap) {
        var ids = [];
        snap.forEach(function (d) { var data = d.data(); if (data.postId) ids.push(data.postId); });
        if (!ids.length) { callback([]); return; }
        Promise.all(ids.slice(0, 20).map(function (pid) {
          return getDoc(doc(db, 'posts', pid))
            .then(function (d) { return d.exists() ? Object.assign({ id: d.id }, d.data()) : null; })
            .catch(function () { return null; });
        })).then(function (posts) { callback(posts.filter(Boolean)); });
      }, function (err) { console.warn('[GeoSocial] listenSavedPosts', err.message); callback([]); });
    }

    function listenSavedPlaces(uid, callback) {
      if (!uid) { callback([]); return function () {}; }
      var q = query(collection(db, 'savedItems'), where('userId', '==', uid), where('type', '==', 'place'), limit(50));
      return onSnapshot(q, function (snap) {
        var ids = [];
        snap.forEach(function (d) { var data = d.data(); if (data.itemId) ids.push(data.itemId); });
        if (!ids.length) { callback([]); return; }
        Promise.all(ids.slice(0, 20).map(function (placeId) {
          return getDoc(doc(db, 'places', placeId))
            .then(function (d) { return d.exists() ? Object.assign({ id: d.id }, d.data()) : null; })
            .catch(function () { return null; });
        })).then(function (places) { callback(places.filter(Boolean)); });
      }, function (err) { console.warn('[GeoSocial] listenSavedPlaces', err.message); callback([]); });
    }

    // ── GROUP JOIN REQUESTS ───────────────────────────────────────────────
    function requestJoinGroup(groupId, callback) {
      requireAuth(function (user) {
        var reqRef = doc(db, 'groupJoinRequests', groupId + '__' + user.uid);
        getDoc(reqRef).then(function (d) {
          if (d.exists()) {
            deleteDoc(reqRef).then(function () {
              toast('Join request cancelled');
              if (callback) callback('cancelled');
            });
          } else {
            setDoc(reqRef, {
              groupId: groupId,
              userId: user.uid,
              userName: user.displayName || user.email || 'User',
              userPhoto: user.photoURL || '',
              status: 'pending',
              createdAt: serverTimestamp()
            }).then(function () {
              toast('Join request sent!');
              if (callback) callback('pending');
            });
          }
        }).catch(function () {
          toast('Failed to send request', 'error');
          if (callback) callback('error');
        });
      });
    }

    function checkJoinRequest(groupId, callback) {
      var user = auth.currentUser;
      if (!user) { callback(false); return; }
      var reqRef = doc(db, 'groupJoinRequests', groupId + '__' + user.uid);
      getDoc(reqRef).then(function (d) { callback(d.exists() ? 'pending' : false); }).catch(function () { callback(false); });
    }

    function getMyJoinRequests(callback) {
      var user = auth.currentUser;
      if (!user) { callback({}); return; }
      getDocs(query(collection(db, 'groupJoinRequests'), where('userId', '==', user.uid), limit(100)))
        .then(function (snap) {
          var map = {};
          snap.forEach(function (d) { var r = d.data(); if (r.groupId) map[r.groupId] = 'pending'; });
          callback(map);
        }).catch(function () { callback({}); });
    }

    // ── PLACE REVIEWS ────────────────────────────────────────────────────
    function createPlaceReview(placeId, rating, comment, callback) {
      var user = auth.currentUser;
      if (!user) { showLoginPrompt(); return; }
      var placeRef = doc(db, 'places', placeId);
      var reviewRef = doc(collection(db, 'placeReviews'));
      runTransaction(db, function (txn) {
        return txn.get(placeRef).then(function (placeDoc) {
          var data = placeDoc.exists() ? placeDoc.data() : {};
          var prevCount = data.reviewCount || 0;
          var prevTotal = data.ratingTotal || 0;
          var newCount = prevCount + 1;
          var newTotal = prevTotal + rating;
          var newAvg = Math.round((newTotal / newCount) * 10) / 10;
          txn.set(reviewRef, {
            placeId: placeId,
            userId: user.uid,
            userName: user.displayName || user.email || 'User',
            userPhoto: user.photoURL || '',
            rating: rating,
            comment: (comment || '').trim(),
            createdAt: serverTimestamp()
          });
          txn.update(placeRef, {
            reviewCount: newCount,
            ratingTotal: newTotal,
            rating: newAvg
          });
        });
      }).then(function () {
        toast('Review submitted!');
        if (callback) callback(true);
      }).catch(function (err) {
        toast('Failed to submit review', 'error');
        if (callback) callback(false);
      });
    }

    function listenPlaceReviews(placeId, callback) {
      if (!placeId) { callback([]); return function () {}; }
      var q = query(collection(db, 'placeReviews'), where('placeId', '==', placeId), limit(30));
      return onSnapshot(q, function (snap) {
        var reviews = [];
        snap.forEach(function (d) { reviews.push(Object.assign({ id: d.id }, d.data())); });
        reviews.sort(function (a, b) {
          function ms(v) { return v && v.toMillis ? v.toMillis() : (v && v.seconds ? v.seconds * 1000 : 0); }
          return ms(b.createdAt) - ms(a.createdAt);
        });
        callback(reviews);
      }, function (err) { console.warn('[GeoSocial] listenPlaceReviews', err.message); callback([]); });
    }

    // ── SEARCH ───────────────────────────────────────────────────────────
    function searchFirestore(q_str, callback) {
      if (!q_str || !q_str.trim()) { callback({ users: [], groups: [], places: [], posts: [] }); return; }
      var q = q_str.trim().toLowerCase();
      var results = { users: [], groups: [], places: [], posts: [] };
      var pending = 4;
      function done() { if (--pending === 0) callback(results); }
      function filterText(val) { return (val || '').toLowerCase().includes(q); }

      getDocs(query(collection(db, 'users'), limit(200))).then(function (snap) {
        snap.forEach(function (d) {
          var u = Object.assign({ id: d.id }, d.data());
          if (filterText(u.name) || filterText(u.displayName) || filterText(u.username) || filterText(u.email)) results.users.push(u);
        }); done();
      }).catch(done);

      getDocs(query(collection(db, 'groups'), orderBy('createdAt', 'desc'), limit(200))).then(function (snap) {
        snap.forEach(function (d) {
          var g = Object.assign({ id: d.id }, d.data());
          if (filterText(g.name) || filterText(g.description) || filterText(g.category)) results.groups.push(g);
        }); done();
      }).catch(done);

      getDocs(query(collection(db, 'places'), orderBy('createdAt', 'desc'), limit(200))).then(function (snap) {
        snap.forEach(function (d) {
          var p = Object.assign({ id: d.id }, d.data());
          if (filterText(p.name) || filterText(p.description) || filterText(p.address) || filterText(p.category)) results.places.push(p);
        }); done();
      }).catch(done);

      getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(200))).then(function (snap) {
        snap.forEach(function (d) {
          var p = Object.assign({ id: d.id }, d.data());
          if (filterText(p.text) || filterText(p.authorName)) results.posts.push(p);
        }); done();
      }).catch(done);
    }

    function findUserByInput(input) {
      if (!input || !input.trim()) return Promise.resolve(null);
      var q = input.trim().toLowerCase();
      return getDocs(query(collection(db, 'users'), limit(200))).then(function (snap) {
        var found = null;
        snap.forEach(function (d) {
          if (found) return;
          var u = Object.assign({ id: d.id, uid: d.id }, d.data());
          if ((u.email || '').toLowerCase() === q ||
              (u.username || '').toLowerCase() === q ||
              (u.name || '').toLowerCase().includes(q) ||
              (u.displayName || '').toLowerCase().includes(q)) {
            found = u;
          }
        });
        return found;
      });
    }

    // ── Public API ───────────────────────────────────────────────────────
    window.GeoSocial = {
      createPost:              createPost,
      listenFeed:              listenFeed,
      toggleLike:              toggleLike,
      checkLiked:              checkLiked,
      addComment:              addComment,
      listenComments:          listenComments,
      toggleFollow:            toggleFollow,
      checkFollowing:          checkFollowing,
      toggleSavePost:          toggleSavePost,
      toggleGroupMember:       toggleGroupMember,
      toggleEventParticipant:  toggleEventParticipant,
      sendFriendRequest:       sendFriendRequest,
      createCheckin:           createCheckin,
      createStory:             createStory,
      listenStories:           listenStories,
      listenUserNotifications: listenUserNotifications,
      markNotificationRead:    markNotificationRead,
      listenUserPosts:         listenUserPosts,
      listenUserCheckins:      listenUserCheckins,
      startConversation:       startConversation,
      sendMessage:             sendMessage,
      listenConversations:     listenConversations,
      listenMessages:          listenMessages,
      trackShare:              trackShare,
      checkSaved:              checkSaved,
      checkGroupMember:        checkGroupMember,
      checkEventParticipant:   checkEventParticipant,
      createGroup:             createGroup,
      listenGroups:            listenGroups,
      listenMyGroups:          listenMyGroups,
      createGroupPost:         createGroupPost,
      listenGroupPosts:        listenGroupPosts,
      createPlace:             createPlace,
      listenPlaces:            listenPlaces,
      toggleSaveItem:          toggleSaveItem,
      checkSavedItem:          checkSavedItem,
      listenSavedItems:        listenSavedItems,
      listenSavedPosts:        listenSavedPosts,
      listenSavedPlaces:       listenSavedPlaces,
      createPlaceReview:       createPlaceReview,
      listenPlaceReviews:      listenPlaceReviews,
      requestJoinGroup:        requestJoinGroup,
      checkJoinRequest:        checkJoinRequest,
      getMyJoinRequests:       getMyJoinRequests,
      searchFirestore:         searchFirestore,
      findUserByInput:         findUserByInput,
      requireAuth:             requireAuth,
      toast:                   toast
    };

    window.dispatchEvent(new Event('GeoSocialReady'));
  }

  // ── Bootstrap ────────────────────────────────────────────────────────
  var booted = false;
  function boot(gf) {
    if (booted) return;
    booted = true;
    if (gf) setup(gf);
    else setupFallback();
  }
  if (window.GeoFirebase) {
    boot(window.GeoFirebase);
  } else {
    window.addEventListener('GeoFirebaseReady', function () {
      boot(window.GeoFirebase || null);
    }, { once: true });
    // If the Firebase module is blocked/offline, do not leave pages waiting forever.
    setTimeout(function () { boot(window.GeoFirebase || null); }, 3000);
  }
})();
