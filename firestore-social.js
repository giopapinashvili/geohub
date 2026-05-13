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
      listenFriendshipStatus: function(toUserId, cb){ cb({state:'none'}); return function(){}; },
      respondFriendRequest: function(){ noop(); },
      listenFriendRequests: function(cb){ cb([]); return function(){}; },
      listenFriends: function(uid, cb){ cb([]); return function(){}; },
      removeFriend: function(){ noop(); },
      addCommentReply: function(){ noop(); },
      listenCommentReplies: function(postId, commentId, cb){ cb([]); return function(){}; },
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
      listenGroupMembers: function(groupId, cb){ cb([]); return function(){}; },
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

      // GeoPoints economy fallback
      listenWallet: function(uid, cb){ cb({ balance:0, earned:0, received:0, sent:0, spent:0, redeemed:0, transactions:[] }); return function(){}; },
      getWalletSnapshot: function(uid){ return Promise.resolve({ balance:0, earned:0, received:0, sent:0, spent:0, redeemed:0, transactions:[] }); },
      awardPoints: noop,
      sendPoints: noop,
      spendPoints: noop,
      createReward: noop,
      listenRewards: function(opts, cb){ (cb||opts)([]); return function(){}; },
      redeemReward: function(){ noop(); },
      listenMyCoupons: function(uid, cb){ cb([]); return function(){}; },
      listenPointTransactions: function(uid, cb){ cb([]); return function(){}; },
      redeemCoupon: function(){ noop(); },
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



    // ── PHASE 2: Storage + Safety + Dashboard helpers ───────────────────
    function dataUrlToBlob(dataUrl) {
      var parts = String(dataUrl || '').split(',');
      if (parts.length < 2) return null;
      var meta = parts[0] || '';
      var mime = (meta.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
      var bin = atob(parts[1]);
      var arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: mime });
    }

    // Cloudinary unsigned upload configuration. Firebase Storage is not required for GeoHub media uploads.
    var GEOHUB_CLOUDINARY = {
      cloudName: 'dw5dqk2w7',
      uploadPreset: 'geohub_unsigned',
      rootFolder: 'geohub'
    };

    function cloudinaryFolder(folder, uid) {
      var safeFolder = String(folder || 'uploads').replace(/[^a-zA-Z0-9_\-/]/g, '').replace(/^\/+|\/+$/g, '') || 'uploads';
      var safeUid = String(uid || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '');
      return GEOHUB_CLOUDINARY.rootFolder + '/' + safeFolder + '/' + safeUid;
    }

    function uploadBlobToCloudinary(blob, folder, user) {
      if (!blob) return Promise.resolve('');
      var form = new FormData();
      form.append('file', blob);
      form.append('upload_preset', GEOHUB_CLOUDINARY.uploadPreset);
      form.append('folder', cloudinaryFolder(folder, user && user.uid));
      form.append('tags', 'geohub,' + String(folder || 'uploads'));
      var url = 'https://api.cloudinary.com/v1_1/' + encodeURIComponent(GEOHUB_CLOUDINARY.cloudName) + '/image/upload';
      return fetch(url, { method: 'POST', body: form })
        .then(function(res){
          return res.json().then(function(body){
            if (!res.ok || !body.secure_url) {
              throw new Error((body && body.error && body.error.message) || ('Cloudinary upload failed: ' + res.status));
            }
            return body.secure_url;
          });
        });
    }

    function compressImageBlob(blob, maxSide, quality) {
      maxSide = maxSide || 1600;
      quality = quality || 0.82;
      if (!blob || !/^image\//i.test(blob.type || '') || /gif/i.test(blob.type || '')) return Promise.resolve(blob);
      if (!window.createImageBitmap || !document.createElement) return Promise.resolve(blob);
      return createImageBitmap(blob).then(function(bitmap){
        var w = bitmap.width, h = bitmap.height;
        var scale = Math.min(1, maxSide / Math.max(w, h));
        if (scale >= 1 && blob.size <= 900 * 1024) return blob;
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        var ctx = canvas.getContext('2d', { alpha: false });
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        if (bitmap.close) bitmap.close();
        return new Promise(function(resolve){
          canvas.toBlob(function(out){ resolve(out || blob); }, 'image/jpeg', quality);
        });
      }).catch(function(){ return blob; });
    }

    function uploadImageDataUrl(dataUrl, folder, callback) {
      if (!dataUrl || typeof dataUrl !== 'string' || dataUrl.indexOf('data:') !== 0) {
        if (callback) callback(dataUrl || '');
        return Promise.resolve(dataUrl || '');
      }
      return new Promise(function(resolve){
        requireAuth(function(user){
          var blob = dataUrlToBlob(dataUrl);
          if (!blob) {
            toast('Invalid image data', 'error');
            if (callback) callback('');
            resolve('');
            return;
          }
          if (!/^image\/(png|jpe?g|webp|gif)$/i.test(blob.type || '')) {
            toast('Use a PNG, JPG, WEBP or GIF image.', 'error');
            if (callback) callback('');
            resolve('');
            return;
          }
          if (blob.size > 8 * 1024 * 1024) {
            toast('Image is too large. Choose a file under 8 MB.', 'error');
            if (callback) callback('');
            resolve('');
            return;
          }
          compressImageBlob(blob).then(function(finalBlob){
            return uploadBlobToCloudinary(finalBlob, folder, user);
          }).then(function(url){
            if (callback) callback(url);
            resolve(url);
          }).catch(function(err){
            console.error('[GeoSocial] Cloudinary upload failed:', err && err.message ? err.message : err);
            toast('Image upload failed. Check Cloudinary unsigned preset.', 'error');
            if (callback) callback('');
            resolve('');
          });
        });
      });
    }

    function hidePost(postId, callback) {
      requireAuth(function(user){
        setDoc(doc(db, 'hiddenPosts', user.uid + '_' + postId), {
          userId: user.uid, postId: postId, createdAt: serverTimestamp()
        }).then(function(){ toast('Post hidden'); if(callback) callback(true); })
          .catch(function(err){ console.error('[GeoSocial] hidePost', err); toast('Could not hide post.', 'error'); if(callback) callback(false, err); });
      });
    }

    function blockUser(targetUserId, callback) {
      requireAuth(function(user){
        if (!targetUserId || targetUserId === user.uid) return;
        setDoc(doc(db, 'blockedUsers', user.uid + '_' + targetUserId), {
          blockerId: user.uid, blockedId: targetUserId, createdAt: serverTimestamp()
        }).then(function(){ toast('User blocked'); if(callback) callback(true); })
          .catch(function(err){ console.error('[GeoSocial] blockUser', err); toast('Could not block user.', 'error'); if(callback) callback(false, err); });
      });
    }

    function unblockUser(targetUserId, callback) {
      requireAuth(function(user){
        deleteDoc(doc(db, 'blockedUsers', user.uid + '_' + targetUserId))
          .then(function(){ toast('User unblocked'); if(callback) callback(false); })
          .catch(function(err){ console.error('[GeoSocial] unblockUser', err); toast('Could not unblock user.', 'error'); });
      });
    }

    function listenSafetyPrefs(callback) {
      var uid = currentUid();
      if (!uid) { callback({ hiddenPostIds: [], blockedUserIds: [] }); return function(){}; }
      var state = { hiddenPostIds: [], blockedUserIds: [] };
      function emit(){ callback({ hiddenPostIds: state.hiddenPostIds.slice(), blockedUserIds: state.blockedUserIds.slice() }); }
      var uh = onSnapshot(query(collection(db, 'hiddenPosts'), where('userId', '==', uid), limit(200)), function(snap){
        var ids=[]; snap.forEach(function(d){ var x=d.data()||{}; if(x.postId) ids.push(x.postId); }); state.hiddenPostIds=ids; emit();
      }, function(err){ console.warn('[GeoSocial] hiddenPosts', err.message); emit(); });
      var ub = onSnapshot(query(collection(db, 'blockedUsers'), where('blockerId', '==', uid), limit(200)), function(snap){
        var ids=[]; snap.forEach(function(d){ var x=d.data()||{}; if(x.blockedId) ids.push(x.blockedId); }); state.blockedUserIds=ids; emit();
      }, function(err){ console.warn('[GeoSocial] blockedUsers', err.message); emit(); });
      return function(){ try{uh();}catch(e){} try{ub();}catch(e){} };
    }

    function reportTarget(type, id, reason, details, callback) {
      requireAuth(function(user){
        addDoc(collection(db, 'reports'), {
          reporterId: user.uid, targetType: type, targetId: id,
          reason: reason || 'report', details: details || '', status: 'pending', createdAt: serverTimestamp()
        }).then(function(){ toast('Report sent'); if(callback) callback(true); })
          .catch(function(err){ console.error('[GeoSocial] reportTarget', err); toast('Report failed.', 'error'); if(callback) callback(false, err); });
      });
    }

    function listenManagedBusinesses(uid, callback) {
      uid = uid || currentUid();
      if (!uid) { callback([]); return function(){}; }
      var q = query(collection(db, 'businessAdmins'), where('userId', '==', uid), limit(50));
      return onSnapshot(q, function(snap){
        var ids=[]; snap.forEach(function(d){ var x=d.data()||{}; if(x.businessId) ids.push(x.businessId); });
        if(!ids.length){ callback([]); return; }
        Promise.all(ids.slice(0,30).map(function(id){
          return getDoc(doc(db,'businesses',id)).then(function(bs){ return bs.exists()?Object.assign({id:id},bs.data()):null; }).catch(function(){return null;});
        })).then(function(rows){ callback(rows.filter(Boolean)); });
      }, function(err){ console.warn('[GeoSocial] listenManagedBusinesses', err.message); callback([]); });
    }

    function listenUserBadges(uid, callback) {
      uid = uid || currentUid();
      if (!uid) { callback([]); return function(){}; }
      var q = query(collection(db, 'userBadges'), where('userId', '==', uid), limit(80));
      return onSnapshot(q, function(snap){ var items=[]; snap.forEach(function(d){ items.push(Object.assign({id:d.id}, d.data())); }); callback(items); }, function(){ callback([]); });
    }

    function createBusinessOffer(businessId, data, callback) {
      requireAuth(function(user){
        data = data || {};
        if (!(data.title || '').trim()) return toast('Offer title is required', 'error');
        addDoc(collection(db,'businessOffers'), {
          businessId: businessId,
          title: (data.title || '').trim(),
          description: (data.description || '').trim(),
          startsAt: data.startsAt || '',
          endsAt: data.endsAt || '',
          createdBy: user.uid,
          ownerId: user.uid,
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }).then(function(ref){ toast('Offer created'); if(callback) callback(ref.id); })
          .catch(function(err){ console.error('[GeoSocial] createBusinessOffer', err); toast('Offer failed.', 'error'); if(callback) callback(null, err); });
      });
    }

    function getBusinessDashboard(businessId, callback) {
      Promise.all([
        getDocs(query(collection(db,'businessFollowers'), where('businessId','==',businessId), limit(500))).catch(function(){return null;}),
        getDocs(query(collection(db,'posts'), where('targetType','==','business'), where('targetId','==',businessId), limit(100))).catch(function(){return null;}),
        getDocs(query(collection(db,'businessReviews'), where('businessId','==',businessId), limit(100))).catch(function(){return null;}),
        getDocs(query(collection(db,'businessOffers'), where('businessId','==',businessId), limit(50))).catch(function(){return null;}),
        getDocs(query(collection(db,'rewards'), where('businessId','==',businessId), limit(50))).catch(function(){return null;})
      ]).then(function(res){
        function count(snap){ return snap && !snap.empty ? snap.size : 0; }
        var offers=[]; if(res[3]) res[3].forEach(function(d){ offers.push(Object.assign({id:d.id}, d.data())); });
        var rewards=[]; if(res[4]) res[4].forEach(function(d){ rewards.push(Object.assign({id:d.id}, d.data())); });
        callback({ followers: count(res[0]), posts: count(res[1]), reviews: count(res[2]), offers: offers, rewards: rewards });
      }).catch(function(){ callback({ followers:0, posts:0, reviews:0, offers:[], rewards:[] }); });
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



    // ── GEOPOINTS / REWARD STORE ECONOMY ───────────────────────────────
    function normalAmount(value) {
      var n = Math.floor(Number(value || 0));
      return isFinite(n) && n > 0 ? n : 0;
    }

    function couponCode(prefix) {
      return (prefix || 'GH') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Date.now().toString(36).slice(-5).toUpperCase();
    }

    function computeWallet(transactions, targetUid) {
      var uid = targetUid || currentUid();
      var wallet = {
        uid: uid || '', balance: 0, earned: 0, received: 0, sent: 0, spent: 0, redeemed: 0, refunded: 0,
        transactions: (transactions || []).slice().sort(function(a, b){ return tsToMillis(b.createdAt) - tsToMillis(a.createdAt); })
      };
      wallet.transactions.forEach(function(tx){
        var amount = normalAmount(tx.amount);
        if (!amount) return;
        var type = String(tx.type || '').toLowerCase();
        var from = tx.fromUserId || tx.fromId || '';
        var to = tx.toUserId || tx.toId || tx.userId || '';
        if ((type === 'earn' || type === 'admin_adjustment') && to === uid) { wallet.earned += amount; wallet.balance += amount; }
        else if (type === 'refund' && to === uid) { wallet.refunded += amount; wallet.balance += amount; }
        else if (type === 'gift') {
          if (from === uid) { wallet.sent += amount; wallet.balance -= amount; }
          if (to === uid) { wallet.received += amount; wallet.balance += amount; }
        } else if ((type === 'spend' || type === 'redeem') && from === uid) {
          if (type === 'redeem') wallet.redeemed += amount;
          else wallet.spent += amount;
          wallet.balance -= amount;
        }
      });
      wallet.balance = Math.max(0, wallet.balance);
      return wallet;
    }

    function getWalletSnapshot(uid) {
      uid = uid || currentUid();
      if (!uid) return Promise.resolve(computeWallet([], ''));
      return getDocs(query(collection(db, 'pointTransactions'), where('participantIds', 'array-contains', uid), limit(500)))
        .then(function(snap){ var rows=[]; snap.forEach(function(d){ rows.push(Object.assign({ id:d.id }, d.data())); }); return computeWallet(rows, uid); })
        .catch(function(err){ console.warn('[GeoSocial] getWalletSnapshot', err.message); return computeWallet([], uid); });
    }

    function listenWallet(uid, callback) {
      uid = uid || currentUid();
      if (!uid) { callback(computeWallet([], '')); return function(){}; }
      var q = query(collection(db, 'pointTransactions'), where('participantIds', 'array-contains', uid), limit(500));
      return onSnapshot(q, function(snap){
        var rows=[]; snap.forEach(function(d){ rows.push(Object.assign({ id:d.id }, d.data())); });
        callback(computeWallet(rows, uid));
      }, function(err){ console.warn('[GeoSocial] listenWallet', err.message); callback(computeWallet([], uid)); });
    }

    function listenPointTransactions(uid, callback) {
      return listenWallet(uid, function(wallet){ callback(wallet.transactions || []); });
    }

    function awardPoints(amount, reason, targetType, targetId, callback) {
      // Security hardening: public clients must not create completed `earn` pointTransactions.
      // This creates a pending earn request for a future Cloud Function/admin workflow.
      var n = Math.min(1000, normalAmount(amount));
      if (!n) return Promise.resolve(false);
      return new Promise(function(resolve){
        requireAuth(function(user){
          var me = meData() || {};
          addDoc(collection(db, 'pointEarnRequests'), {
            userId: user.uid, toUserId: user.uid, amount: n,
            reason: reason || 'GeoHub activity', targetType: targetType || '', targetId: targetId || '',
            userName: me.name || user.displayName || 'GeoHub User',
            status: 'pending', createdAt: serverTimestamp()
          }).then(function(ref){
            console.info('[GeoSocial] GeoPoints earn request queued. Approve with Cloud Function/admin:', ref.id);
            if (callback) callback(true, ref.id);
            resolve(true);
          }).catch(function(err){ console.warn('[GeoSocial] awardPoints request', err.message); if(callback) callback(false, err); resolve(false); });
        });
      });
    }

    function sendPoints(recipientInput, amount, message, callback) {
      var n = normalAmount(amount);
      if (!n) { toast('Enter a valid GeoPoints amount', 'error'); if(callback) callback(false); return; }
      requireAuth(function(user){
        var me = meData() || {};
        var targetPromise = (typeof recipientInput === 'object' && recipientInput && (recipientInput.uid || recipientInput.id))
          ? Promise.resolve(recipientInput)
          : findUserByInput(String(recipientInput || ''));
        targetPromise.then(function(target){
          if (!target || !(target.uid || target.id)) throw new Error('recipient-not-found');
          var targetId = target.uid || target.id;
          if (targetId === user.uid) throw new Error('self-transfer');
          return getWalletSnapshot(user.uid).then(function(wallet){
            if (wallet.balance < n) throw new Error('insufficient-points');
            return addDoc(collection(db, 'pointTransactions'), {
              type: 'gift', amount: n,
              fromUserId: user.uid, toUserId: targetId,
              fromName: me.name || user.displayName || 'GeoHub User',
              toName: target.fullName || target.displayName || target.name || target.email || 'GeoHub User',
              participantIds: [user.uid, targetId],
              message: String(message || '').slice(0, 240), reason: 'Gift points',
              status: 'completed', createdAt: serverTimestamp()
            }).then(function(ref){ return { ref: ref, targetId: targetId }; });
          });
        }).then(function(res){
          updateDoc(doc(db, 'users', user.uid), { geoPointsSentTotal: increment(n), updatedAt: serverTimestamp() }).catch(function(){});
          updateDoc(doc(db, 'users', res.targetId), { geoPointsReceivedTotal: increment(n), updatedAt: serverTimestamp() }).catch(function(){});
          createNotification(res.targetId, 'points_received', (me.name || 'GeoHub User') + ' sent you ' + n + ' GeoPoints', message || 'You received GeoPoints.', 'rewards.html?tab=wallet', { amount: n });
          toast('GeoPoints sent'); if(callback) callback(true, res.ref.id);
        }).catch(function(err){
          var msg = err.message === 'recipient-not-found' ? 'Recipient not found' : err.message === 'self-transfer' ? 'You cannot send points to yourself' : err.message === 'insufficient-points' ? 'Not enough GeoPoints' : 'Could not send GeoPoints';
          toast(msg, 'error'); if(callback) callback(false, err);
        });
      });
    }

    function spendPoints(amount, reason, targetType, targetId, callback) {
      var n = normalAmount(amount);
      if (!n) { toast('Invalid GeoPoints amount', 'error'); if(callback) callback(false); return; }
      requireAuth(function(user){
        getWalletSnapshot(user.uid).then(function(wallet){
          if (wallet.balance < n) throw new Error('insufficient-points');
          return addDoc(collection(db, 'pointTransactions'), {
            type: 'spend', amount: n,
            fromUserId: user.uid, toUserId: 'platform', participantIds: [user.uid],
            reason: reason || 'GeoHub platform benefit', targetType: targetType || '', targetId: targetId || '',
            status: 'completed', createdAt: serverTimestamp()
          });
        }).then(function(ref){ updateDoc(doc(db, 'users', user.uid), { geoPointsSpentTotal: increment(n), updatedAt: serverTimestamp() }).catch(function(){}); toast('GeoPoints spent'); if(callback) callback(true, ref.id); })
          .catch(function(err){ toast(err.message === 'insufficient-points' ? 'Not enough GeoPoints' : 'Could not spend GeoPoints', 'error'); if(callback) callback(false, err); });
      });
    }

    function createReward(data, callback) {
      requireAuth(function(user){
        data = data || {};
        var title = String(data.title || '').trim();
        var price = normalAmount(data.pointPrice || data.price || data.points);
        if (!title) { toast('Reward title is required', 'error'); if(callback) callback(null); return; }
        if (!price) { toast('Point price is required', 'error'); if(callback) callback(null); return; }
        addDoc(collection(db, 'rewards'), {
          title: title, name: title,
          description: String(data.description || '').trim(),
          rewardType: data.rewardType || 'discount',
          businessId: data.businessId || '', businessName: data.businessName || '',
          pointPrice: price,
          quantityTotal: normalAmount(data.quantityTotal || data.quantity || 0),
          quantityRemaining: normalAmount(data.quantityRemaining || data.quantityTotal || data.quantity || 0),
          expiresAt: data.expiresAt || '', terms: String(data.terms || '').trim(),
          imageUrl: data.imageUrl || '', status: data.status || 'active',
          createdBy: user.uid, ownerId: user.uid, userId: user.uid,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        }).then(function(ref){ toast('Reward created'); if(callback) callback(ref.id); })
          .catch(function(err){ console.error('[GeoSocial] createReward', err); toast('Reward create failed', 'error'); if(callback) callback(null, err); });
      });
    }

    function listenRewards(opts, callback) {
      if (typeof opts === 'function') { callback = opts; opts = {}; }
      opts = opts || {};
      var q = query(collection(db, 'rewards'), limit(opts.limit || 100));
      return onSnapshot(q, function(snap){
        var rows=[]; snap.forEach(function(d){ var x=Object.assign({ id:d.id }, d.data()); if((x.status || 'active') === 'active') rows.push(x); });
        rows.sort(function(a,b){ return tsToMillis(b.createdAt)-tsToMillis(a.createdAt); });
        callback(rows);
      }, function(err){ console.warn('[GeoSocial] listenRewards', err.message); callback([]); });
    }

    function redeemReward(rewardId, callback) {
      requireAuth(function(user){
        var rewardRef = doc(db, 'rewards', rewardId);
        getDoc(rewardRef).then(function(rewardSnap){
          if (!rewardSnap.exists()) throw new Error('reward-not-found');
          var reward = Object.assign({ id: rewardSnap.id }, rewardSnap.data());
          var price = normalAmount(reward.pointPrice || reward.price || reward.points);
          if (!price) throw new Error('invalid-price');
          return getWalletSnapshot(user.uid).then(function(wallet){
            if (wallet.balance < price) throw new Error('insufficient-points');
            var couponRef = doc(collection(db, 'rewardCoupons'));
            var txRef = doc(collection(db, 'pointTransactions'));
            var code = couponCode('GH');
            var participantIds = [user.uid];
            if (!runTransaction) throw new Error('transactions-unavailable');
            return runTransaction(db, function(tx){
              return tx.get(rewardRef).then(function(rs){
                if (!rs.exists()) throw new Error('reward-not-found');
                var r = rs.data() || {};
                var remaining = Number(r.quantityRemaining || 0);
                if (remaining <= 0 && Number(r.quantityTotal || 0) > 0) throw new Error('sold-out');
                if (Number(r.quantityTotal || 0) > 0) tx.update(rewardRef, { quantityRemaining: increment(-1), updatedAt: serverTimestamp() });
                tx.set(couponRef, {
                  rewardId: rewardId, userId: user.uid, businessId: r.businessId || '',
                  rewardTitle: r.title || r.name || 'Reward', pointPrice: price,
                  businessOwnerId: r.ownerId || r.createdBy || '',
                  code: code, qrValue: code, status: 'active',
                  createdAt: serverTimestamp(), expiresAt: r.expiresAt || ''
                });
                tx.set(txRef, {
                  type: 'redeem', amount: price, fromUserId: user.uid, toUserId: r.businessId || 'partner',
                  participantIds: participantIds, reason: 'Redeemed reward: ' + (r.title || r.name || rewardId),
                  targetType: 'reward', targetId: rewardId, couponId: couponRef.id,
                  status: 'completed', createdAt: serverTimestamp()
                });
              });
            }).then(function(){ return { couponId: couponRef.id, code: code, reward: reward }; });
          });
        }).then(function(res){
          updateDoc(doc(db, 'users', user.uid), { geoPointsSpentTotal: increment(Number(res.reward.pointPrice || 0)), updatedAt: serverTimestamp() }).catch(function(){});
          toast('Coupon unlocked: ' + res.code);
          if(callback) callback(true, res);
        }).catch(function(err){
          var msg = err.message === 'insufficient-points' ? 'Not enough GeoPoints' : err.message === 'sold-out' ? 'Reward sold out' : 'Could not redeem reward';
          toast(msg, 'error'); if(callback) callback(false, err);
        });
      });
    }

    function listenMyCoupons(uid, callback) {
      uid = uid || currentUid();
      if (!uid) { callback([]); return function(){}; }
      var q = query(collection(db, 'rewardCoupons'), where('userId', '==', uid), limit(100));
      return onSnapshot(q, function(snap){
        var rows=[]; snap.forEach(function(d){ rows.push(Object.assign({ id:d.id }, d.data())); });
        rows.sort(function(a,b){ return tsToMillis(b.createdAt)-tsToMillis(a.createdAt); });
        callback(rows);
      }, function(err){ console.warn('[GeoSocial] listenMyCoupons', err.message); callback([]); });
    }

    function redeemCoupon(code, businessId, callback) {
      code = String(code || '').trim().toUpperCase();
      if (!code) { toast('Enter coupon code', 'error'); if(callback) callback(false); return; }
      requireAuth(function(user){
        getDocs(query(collection(db, 'rewardCoupons'), where('code', '==', code), limit(1))).then(function(snap){
          if (snap.empty) throw new Error('not-found');
          var d = snap.docs[0]; var c = d.data() || {};
          if (c.status !== 'active') throw new Error('not-active');
          if (businessId && c.businessId && c.businessId !== businessId) throw new Error('wrong-business');
          return updateDoc(doc(db, 'rewardCoupons', d.id), { status:'used', usedAt: serverTimestamp(), usedBy: user.uid, updatedAt: serverTimestamp() });
        }).then(function(){ toast('Coupon redeemed'); if(callback) callback(true); })
          .catch(function(err){ var msg = err.message === 'not-found' ? 'Coupon not found' : err.message === 'not-active' ? 'Coupon already used/expired' : err.message === 'wrong-business' ? 'This coupon belongs to another business' : 'Could not redeem coupon'; toast(msg, 'error'); if(callback) callback(false, err); });
      });
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
          visibility: (extra && extra.visibility) || 'public',
          status: 'active',
          sharedPostId: extra && extra.sharedPostId ? extra.sharedPostId : null,
          targetType: extra && extra.targetType ? extra.targetType : 'user',
          targetId: extra && extra.targetId ? extra.targetId : user.uid,
          createdAt: serverTimestamp()
        }).then(function (ref) {
          toast('Post published!');
          awardPoints(20, 'Create post', 'post', ref.id);
          if (callback) callback(ref.id);
        }).catch(function (err) {
          console.error('[GeoSocial] createPost', err);
          toast('Failed to post. Try again.', 'error');
        });
      });
    }

    function listenFeed(callback, limitN) {
      var q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(Math.min(Number(limitN) || 20, 30)));
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
        var commentRef = null;
        addDoc(collection(db, 'posts', postId, 'comments'), {
          text: text.trim(),
          authorId: user.uid,
          userId: user.uid,
          authorName: me.name || user.displayName || 'GeoHub User',
          authorAvatar: me.avatar || user.photoURL || '',
          likes: 0,
          status: 'active',
          createdAt: serverTimestamp()
        }).then(function (ref) {
          commentRef = ref;
          return updateDoc(doc(db, 'posts', postId), { commentCount: increment(1) });
        }).then(function () {
          return getPostOwner(postId).then(function (ownerId) {
            var cid = commentRef && commentRef.id;
            return createNotification(ownerId, 'comment', (meData() || {}).name + ' commented on your post', text.trim(), 'feed.html?post=' + postId + (cid ? '&comment=' + cid : ''), { postId: postId, commentId: cid || '' });
          });
        }).then(function () {
          toast('Comment posted');
          awardPoints(5, 'Comment on post', 'post', postId);
          if (callback) callback();
        }).catch(function (err) {
          console.error('[GeoSocial] addComment', err);
          toast('Failed to comment.', 'error');
          if (callback) callback(null, err);
        });
      });
    }

    function listenComments(postId, callback) {
      var q = query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'asc'), limit(40));
      return onSnapshot(q, function (snap) {
        var comments = [];
        snap.forEach(function (d) { comments.push(Object.assign({ id: d.id }, d.data())); });
        callback(comments);
      }, function (err) {
        console.warn('[GeoSocial] listenComments', err.message);
      });
    }


    function addCommentReply(postId, commentId, text, callback) {
      if (!text || !text.trim()) return;
      requireAuth(function (user) {
        var me = meData() || {};
        var replyText = text.trim();
        addDoc(collection(db, 'posts', postId, 'comments', commentId, 'replies'), {
          postId: postId,
          commentId: commentId,
          text: replyText,
          authorId: user.uid,
          userId: user.uid,
          authorName: me.name || user.displayName || 'GeoHub User',
          authorAvatar: me.avatar || user.photoURL || '',
          likeCount: 0,
          status: 'active',
          createdAt: serverTimestamp()
        }).then(function () {
          return updateDoc(doc(db, 'posts', postId), { commentCount: increment(1) }).catch(function(){});
        }).then(function () {
          return getDoc(doc(db, 'posts', postId, 'comments', commentId)).then(function (snap) {
            var c = snap.exists() ? snap.data() : {};
            var ownerId = c.authorId || c.userId || null;
            return createNotification(ownerId, 'reply', (me.name || 'GeoHub User') + ' replied to your comment', replyText, 'feed.html?post=' + postId + '&comment=' + commentId, { postId: postId, commentId: commentId });
          });
        }).then(function () {
          toast('Reply posted');
          awardPoints(3, 'Reply to comment', 'post', postId);
          if (callback) callback();
        }).catch(function (err) {
          console.error('[GeoSocial] addCommentReply', err);
          toast('Failed to reply.', 'error');
          if (callback) callback(null, err);
        });
      });
    }

    function listenCommentReplies(postId, commentId, callback) {
      var q = query(collection(db, 'posts', postId, 'comments', commentId, 'replies'), orderBy('createdAt', 'asc'), limit(50));
      return onSnapshot(q, function (snap) {
        var replies = [];
        snap.forEach(function (d) { replies.push(Object.assign({ id: d.id }, d.data())); });
        callback(replies);
      }, function (err) {
        console.warn('[GeoSocial] listenCommentReplies', err.message);
        callback([]);
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
          return setDoc(ref, { followerId: uid, followingId: targetUserId, createdAt: serverTimestamp() })
              .then(function () {
                return updateDoc(doc(db, 'users', targetUserId), { followers: increment(1) }).catch(function(){})
                  .then(function(){ return updateDoc(doc(db, 'users', uid), { following: increment(1) }).catch(function(){}); })
                  .then(function(){ return createNotification(targetUserId, 'follow', (meData() || {}).name + ' followed you', 'You have a new follower.', 'profile.html?id=' + uid, { followerId: uid }); });
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

    function listenGroupMembers(groupId, callback) {
      if (!groupId) { callback([]); return function(){}; }
      var q = query(collection(db, 'groupMembers'), where('groupId', '==', groupId), limit(100));
      return onSnapshot(q, function(snap){
        var members=[];
        snap.forEach(function(d){ members.push(Object.assign({id:d.id}, d.data())); });
        if(!members.length){ callback([]); return; }
        Promise.all(members.map(function(m){
          var uid = m.userId || m.uid;
          if(!uid) return Promise.resolve(null);
          return getDoc(doc(db,'users',uid)).then(function(us){
            var data = us.exists() ? us.data() : {};
            return Object.assign({}, m, { profile: Object.assign({uid:uid,id:uid}, data) });
          }).catch(function(){ return Object.assign({}, m, { profile:{uid:uid,id:uid,fullName:'GeoHub User'} }); });
        })).then(function(rows){ callback(rows.filter(Boolean)); });
      }, function(err){ console.warn('[GeoSocial] listenGroupMembers', err.message); callback([]); });
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

    // ── FRIEND REQUESTS / FRIENDS ───────────────────────────────────────
    function friendshipId(a, b) {
      return [a, b].sort().join('_');
    }

    function sendFriendRequest(toUserId, callback) {
      requireAuth(function (user) {
        var uid = user.uid;
        if (!toUserId || uid === toUserId) { toast('You cannot send a friend request to yourself.', 'error'); if(callback) callback('self'); return; }
        var fid = friendshipId(uid, toUserId);
        var friendRef = doc(db, 'friends', fid);
        var reqRef = doc(db, 'friendRequests', uid + '_' + toUserId);
        var reverseReqRef = doc(db, 'friendRequests', toUserId + '_' + uid);
        getDoc(friendRef).then(function(friendSnap){
          if (friendSnap.exists()) throw new Error('already-friends');
          return getDoc(reqRef);
        }).then(function(existing){
          if (existing.exists()) throw new Error('already-requested');
          return getDoc(reverseReqRef);
        }).then(function(reverseExisting){
          if (reverseExisting.exists() && (reverseExisting.data() || {}).status === 'pending') throw new Error('incoming-request-exists');
          return setDoc(reqRef, {
            fromUserId: uid,
            toUserId: toUserId,
            status: 'pending',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }, { merge: false });
        }).then(function () {
          var me = meData() || {};
          return createNotification(toUserId, 'friend_request', (me.name || 'GeoHub User') + ' sent you a friend request', 'Open the profile to accept or reject.', 'profile.html?id=' + uid, { fromUserId: uid });
        }).then(function () {
          toast('Friend request sent');
          if (callback) callback('pending');
        }).catch(function (err) {
          var msg = err && err.message;
          if (msg === 'already-friends') { toast('Already friends'); if(callback) callback('friends'); return; }
          if (msg === 'already-requested') { toast('Request already sent'); if(callback) callback('pending'); return; }
          if (msg === 'incoming-request-exists') { toast('This user already sent you a request'); if(callback) callback('incoming'); return; }
          console.error('[GeoSocial] sendFriendRequest failed', { code: err && err.code, message: err && err.message, fromUserId: uid, toUserId: toUserId });
          toast('Failed to send request.', 'error');
          if (callback) callback('error', err);
        });
      });
    }

    function listenFriendshipStatus(targetUserId, callback) {
      var uid = currentUid();
      if (!uid || !targetUserId || uid === targetUserId) { callback({ state: uid === targetUserId ? 'self' : 'none' }); return function(){}; }
      var unsubs = [];
      var status = { state: 'none' };
      function emit(){ callback(Object.assign({}, status)); }
      unsubs.push(onSnapshot(doc(db, 'friends', friendshipId(uid, targetUserId)), function(snap){
        if (snap.exists()) status = { state: 'friends', friendId: snap.id };
        else if (status.state === 'friends') status = { state: 'none' };
        emit();
      }, function(){ emit(); }));
      unsubs.push(onSnapshot(doc(db, 'friendRequests', uid + '_' + targetUserId), function(snap){
        if (status.state === 'friends') return emit();
        if (snap.exists() && (snap.data()||{}).status === 'pending') status = { state: 'outgoing', requestId: snap.id };
        else if (status.state === 'outgoing') status = { state: 'none' };
        emit();
      }, function(){ emit(); }));
      unsubs.push(onSnapshot(doc(db, 'friendRequests', targetUserId + '_' + uid), function(snap){
        if (status.state === 'friends') return emit();
        if (snap.exists() && (snap.data()||{}).status === 'pending') status = { state: 'incoming', requestId: snap.id, fromUserId: targetUserId };
        else if (status.state === 'incoming') status = { state: 'none' };
        emit();
      }, function(){ emit(); }));
      return function(){ unsubs.forEach(function(u){ try{u();}catch(e){} }); };
    }

    function respondFriendRequest(requestId, accept, callback) {
      requireAuth(function(user){
        var reqRef = doc(db, 'friendRequests', requestId);
        getDoc(reqRef).then(function(snap){
          if (!snap.exists()) throw new Error('request-not-found');
          var r = snap.data() || {};
          if ((r.toUserId || r.toId) !== user.uid && !((auth.currentUser.email||'') && false)) throw new Error('not-your-request');
          if (!accept) {
            return updateDoc(reqRef, { status: 'rejected', reviewedAt: serverTimestamp(), updatedAt: serverTimestamp() }).then(function(){ return {accepted:false, fromId:r.fromUserId||r.fromId}; });
          }
          var fromId = r.fromUserId || r.fromId;
          var fid = friendshipId(fromId, user.uid);
          return setDoc(doc(db, 'friends', fid), {
            users: [fromId, user.uid],
            userA: fromId,
            userB: user.uid,
            createdAt: serverTimestamp()
          }, { merge: true }).then(function(){
            return updateDoc(reqRef, { status: 'accepted', reviewedAt: serverTimestamp(), updatedAt: serverTimestamp() }).catch(function(){});
          }).then(function(){
            updateDoc(doc(db, 'users', fromId), { friendsCount: increment(1) }).catch(function(){});
            updateDoc(doc(db, 'users', user.uid), { friendsCount: increment(1) }).catch(function(){});
            return createNotification(fromId, 'friend_accept', (meData()||{}).name + ' accepted your friend request', 'You are now friends on GeoHub.', 'profile.html?id=' + user.uid, { friendId: user.uid });
          }).then(function(){ return {accepted:true, fromId:fromId}; });
        }).then(function(res){
          toast(res.accepted ? 'Friend request accepted' : 'Friend request rejected');
          if(callback) callback(res);
        }).catch(function(err){
          console.error('[GeoSocial] respondFriendRequest', err);
          toast('Could not update request.', 'error');
          if(callback) callback(null, err);
        });
      });
    }

    function listenFriendRequests(callback) {
      var uid = currentUid();
      if (!uid) { callback([]); return function(){}; }
      var q = query(collection(db, 'friendRequests'), where('toUserId', '==', uid), where('status', '==', 'pending'), limit(50));
      return onSnapshot(q, function(snap){
        var items=[];
        snap.forEach(function(d){ items.push(Object.assign({id:d.id}, d.data())); });
        items.sort(function(a,b){ return tsToMillis(b.createdAt)-tsToMillis(a.createdAt); });
        callback(items);
      }, function(err){ console.warn('[GeoSocial] listenFriendRequests', err.message); callback([]); });
    }

    function listenFriends(uid, callback) {
      uid = uid || currentUid();
      if (!uid) { callback([]); return function(){}; }
      var q = query(collection(db, 'friends'), where('users', 'array-contains', uid), limit(100));
      return onSnapshot(q, function(snap){
        var ids=[];
        snap.forEach(function(d){ var data=d.data()||{}; var other=(data.users||[]).find(function(x){ return x !== uid; }); if(other) ids.push(other); });
        if(!ids.length){ callback([]); return; }
        Promise.all(ids.slice(0,50).map(function(id){ return getDoc(doc(db,'users',id)).then(function(us){ return us.exists()?Object.assign({id:id,uid:id},us.data()):{id:id,uid:id,fullName:'GeoHub User'}; }).catch(function(){ return null; }); }))
          .then(function(users){ callback(users.filter(Boolean)); });
      }, function(err){ console.warn('[GeoSocial] listenFriends', err.message); callback([]); });
    }

    function removeFriend(targetUserId, callback) {
      requireAuth(function(user){
        var fid = friendshipId(user.uid, targetUserId);
        deleteDoc(doc(db, 'friends', fid)).then(function(){
          updateDoc(doc(db, 'users', targetUserId), { friendsCount: increment(-1) }).catch(function(){});
          updateDoc(doc(db, 'users', user.uid), { friendsCount: increment(-1) }).catch(function(){});
          toast('Friend removed');
          if(callback) callback(false);
        }).catch(function(err){ console.error('[GeoSocial] removeFriend', err); toast('Could not remove friend.', 'error'); });
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
          updateDoc(doc(db, 'users', user.uid), {
            xp: increment(Number(xpAwarded || 50)),
            visitedPlaces: increment(1),
            checkinCount: increment(1),
            updatedAt: serverTimestamp()
          }).catch(function(){});
          setDoc(doc(db, 'userBadges', user.uid + '_first_checkin'), {
            userId: user.uid, badgeId: 'first_checkin', title: 'First Check-in', icon: 'fa-location-dot', createdAt: serverTimestamp()
          }, { merge: true }).catch(function(){});
          toast('Checked in at ' + (placeName || 'place') + '! +' + (xpAwarded || 50) + ' XP');
          awardPoints(Number(xpAwarded || 50), 'Check-in', 'checkin', placeId || '').catch(function(){});
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
        limit(25));
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
      updateDoc(doc(db, 'userNotifications', notifId), { read: true, updatedAt: serverTimestamp() })
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
      var q = query(collection(db, 'stories'), orderBy('createdAt', 'desc'), limit(24));
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
          lastMessage: '',
          unreadFor: [],
          readBy: {}
        }, { merge: true }).then(function () {
          if (callback) callback(cid);
        }).catch(function (err) {
          console.error('[GeoSocial] startConversation', err);
          toast('Could not open messages.', 'error');
        });
      });
    }

    function sendMessage(conversationId, text, callback, extra) {
      extra = extra || {};
      var cleanText = String(text || '').trim();
      var mediaUrl = String(extra.mediaUrl || '').trim();
      var mediaType = String(extra.mediaType || '').trim();
      if (!cleanText && !mediaUrl) return;
      requireAuth(function (user) {
        var me = meData() || {};
        var convRef = doc(db, 'conversations', conversationId);
        getDoc(convRef).then(function (snap) {
          if (!snap.exists()) throw new Error('Conversation not found');
          var conv = snap.data() || {};
          var otherId = (conv.participants || []).find(function (id) { return id !== user.uid; });
          var preview = cleanText || (mediaType === 'image' ? '📷 Photo' : 'Attachment');
          return addDoc(collection(db, 'conversations', conversationId, 'messages'), {
            conversationId: conversationId,
            senderId: user.uid,
            authorId: user.uid,
            text: cleanText,
            mediaUrl: mediaUrl || '',
            mediaType: mediaType || '',
            likedBy: [],
            readBy: [user.uid],
            deletedFor: [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }).then(function () {
            var patch = { lastMessage: preview, lastSenderId: user.uid, updatedAt: serverTimestamp(), unreadFor: otherId ? fs.arrayUnion(otherId) : [] };
            patch['readBy.' + user.uid] = serverTimestamp();
            return updateDoc(convRef, patch);
          }).then(function () {
            return createNotification(otherId, 'message', (me.name || 'GeoHub User') + ' sent you a message', preview, 'messages.html?with=' + user.uid, { conversationId: conversationId });
          });
        }).then(function () {
          if (callback) callback(true);
        }).catch(function (err) {
          console.error('[GeoSocial] sendMessage', err);
          toast('Message failed.', 'error');
          if (callback) callback(false, err);
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
      var q = query(collection(db, 'conversations'), where('participants', 'array-contains', uid), limit(25));
      return onSnapshot(q, function (snap) {
        var items = [];
        snap.forEach(function (d) { items.push(Object.assign({ id: d.id }, d.data())); });
        callback(sortConvs(items));
      }, function (err) { console.warn('[GeoSocial] listenConversations', err.message); callback([]); });
    }

    function listenMessages(conversationId, callback) {
      var q = query(collection(db, 'conversations', conversationId, 'messages'), orderBy('createdAt', 'asc'), limit(60));
      return onSnapshot(q, function (snap) {
        var items = [];
        snap.forEach(function (d) { items.push(Object.assign({ id: d.id }, d.data())); });
        callback(items);
      }, function (err) { console.warn('[GeoSocial] listenMessages', err.message); callback([]); });
    }

    function markConversationRead(conversationId, callback) {
      var uid = currentUid();
      if (!uid || !conversationId) { if(callback) callback(false); return Promise.resolve(false); }
      var patch = { unreadFor: fs.arrayRemove(uid), updatedAt: serverTimestamp() };
      patch['readBy.' + uid] = serverTimestamp();
      return updateDoc(doc(db, 'conversations', conversationId), patch)
        .then(function(){ if(callback) callback(true); return true; })
        .catch(function(err){ console.warn('[GeoSocial] markConversationRead', err.message); if(callback) callback(false, err); return false; });
    }

    function reactionDocId(conversationId, messageId, uid) {
      return String(conversationId || '').replace(/[^A-Za-z0-9_-]/g, '_') + '__' +
        String(messageId || '').replace(/[^A-Za-z0-9_-]/g, '_') + '__' +
        String(uid || '').replace(/[^A-Za-z0-9_-]/g, '_');
    }

    function toggleMessageReaction(conversationId, messageId, emoji, callback) {
      emoji = emoji || '❤️';
      var uid = currentUid();
      if (!uid || !conversationId || !messageId) { if(callback) callback(false); return Promise.resolve(false); }

      var reactionRef = doc(db, 'messageReactions', reactionDocId(conversationId, messageId, uid));

      return getDoc(reactionRef).then(function(snap){
        if (snap.exists()) {
          var old = snap.data() || {};
          if (old.emoji === emoji) {
            return deleteDoc(reactionRef).then(function(){
              if(callback) callback(false);
              return false;
            });
          }
          return updateDoc(reactionRef, {
            emoji: emoji,
            updatedAt: serverTimestamp()
          }).then(function(){
            if(callback) callback(true);
            return true;
          });
        }
        return setDoc(reactionRef, {
          conversationId: conversationId,
          messageId: messageId,
          userId: uid,
          emoji: emoji,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }).then(function(){
          if(callback) callback(true);
          return true;
        });
      }).catch(function(err){
        console.warn('[GeoSocial] toggleMessageReaction', err.message);
        toast('Reaction failed: ' + (err.code || err.message || 'permission'), 'error');
        if(callback) callback(false, err);
        return false;
      });
    }

    function listenMessageReactions(conversationId, callback) {
      var uid = currentUid();
      if (!uid || !conversationId) { callback && callback([]); return function(){}; }
      var q = query(collection(db, 'messageReactions'), where('conversationId', '==', conversationId), limit(500));
      return onSnapshot(q, function(snap){
        var rows = [];
        snap.forEach(function(d){ rows.push(Object.assign({ id:d.id }, d.data())); });
        callback && callback(rows);
      }, function(err){ console.warn('[GeoSocial] listenMessageReactions', err.message); callback && callback([]); });
    }

    function deleteMessage(conversationId, messageId, mode, callback) {
      var uid = currentUid();
      if (!uid || !conversationId || !messageId) { if(callback) callback(false); return; }
      var ref = doc(db, 'conversations', conversationId, 'messages', messageId);
      var patch = mode === 'everyone'
        ? { text: 'Message deleted', deleted: true, deletedBy: uid, updatedAt: serverTimestamp() }
        : { deletedFor: fs.arrayUnion(uid), updatedAt: serverTimestamp() };
      updateDoc(ref, patch).then(function(){ if(callback) callback(true); })
        .catch(function(err){ console.warn('[GeoSocial] deleteMessage', err.message); toast('Delete failed.', 'error'); if(callback) callback(false, err); });
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
      if (!q_str || !q_str.trim()) { callback({ users: [], groups: [], places: [], posts: [], businesses: [], events: [], services: [], rewards: [] }); return; }
      var needle = q_str.trim().toLowerCase();
      var results = { users: [], groups: [], places: [], posts: [], businesses: [], events: [], services: [], rewards: [] };
      var jobs = [
        ['users', 'users'], ['groups', 'groups'], ['places', 'places'], ['posts', 'posts'],
        ['businesses', 'businesses'], ['events', 'events'], ['services', 'services'], ['rewards', 'rewards']
      ];
      var pending = jobs.length;
      function done(){ if(--pending === 0) callback(results); }
      function filterText(val){ return String(val || '').toLowerCase().includes(needle); }
      jobs.forEach(function(pair){
        var key = pair[0], col = pair[1];
        getDocs(query(collection(db, col), limit(200))).then(function(snap){
          snap.forEach(function(d){
            var x = Object.assign({ id: d.id }, d.data());
            var hay = [x.name, x.title, x.fullName, x.displayName, x.username, x.email, x.text, x.description, x.desc, x.city, x.category, x.address].join(' ');
            if(filterText(hay)) results[key].push(x);
          });
          done();
        }).catch(function(){ done(); });
      });
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
      listenFriendshipStatus: listenFriendshipStatus,
      respondFriendRequest:   respondFriendRequest,
      listenFriendRequests:   listenFriendRequests,
      listenFriends:          listenFriends,
      removeFriend:           removeFriend,
      addCommentReply:        addCommentReply,
      listenCommentReplies:   listenCommentReplies,
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
      markConversationRead:    markConversationRead,
      toggleMessageReaction:   toggleMessageReaction,
      listenMessageReactions:   listenMessageReactions,
      deleteMessage:           deleteMessage,
      trackShare:              trackShare,
      checkSaved:              checkSaved,
      checkGroupMember:        checkGroupMember,
      checkEventParticipant:   checkEventParticipant,
      createGroup:             createGroup,
      listenGroups:            listenGroups,
      listenMyGroups:          listenMyGroups,
      listenGroupMembers:      listenGroupMembers,
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
      uploadImageDataUrl:      uploadImageDataUrl,
      hidePost:                hidePost,
      blockUser:               blockUser,
      unblockUser:             unblockUser,
      listenSafetyPrefs:       listenSafetyPrefs,
      reportTarget:            reportTarget,
      listenManagedBusinesses: listenManagedBusinesses,
      listenUserBadges:        listenUserBadges,
      createBusinessOffer:     createBusinessOffer,
      getBusinessDashboard:    getBusinessDashboard,

      listenWallet:            listenWallet,
      getWalletSnapshot:       getWalletSnapshot,
      listenPointTransactions: listenPointTransactions,
      awardPoints:             awardPoints,
      sendPoints:              sendPoints,
      spendPoints:             spendPoints,
      createReward:            createReward,
      listenRewards:           listenRewards,
      redeemReward:            redeemReward,
      listenMyCoupons:         listenMyCoupons,
      redeemCoupon:            redeemCoupon,
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
