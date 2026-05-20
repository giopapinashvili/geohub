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
      cancelFriendRequest: function(){ noop(); },
      listenSentFriendRequests: function(cb){ cb([]); return function(){}; },
      addCommentReply: function(){ noop(); },
      listenCommentReplies: function(postId, commentId, cb){ cb([]); return function(){}; },
      createCheckin: noop,
      createCheckinFull: noop,
      createStory: noop,
      listenStories: function () { return function () {}; },
      addStoryReaction: noop,
      removeStoryReaction: noop,
      addStoryReply: noop,
      deleteStory: noop,
      listenUserNotifications: function (uid, cb) { cb([]); return function () {}; },
      listenActorNotifications: function (actor, cb) { cb([]); return function () {}; },
      createActorNotification: function () { return Promise.resolve(); },
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
      requestJoinGroupWithAnswers: function (groupId, answers, cb) { noop(); if(cb) cb('error'); },
      checkJoinRequest: function (groupId, cb) { cb(false); },
      getMyJoinRequests: function (cb) { cb({}); },
      listenGroupJoinRequests: function(groupId, cb){ cb([]); return function(){}; },
      approveJoinRequest: function(a,b,c,cb){ noop(); if(cb) cb(false); },
      declineJoinRequest: function(a,cb){ noop(); if(cb) cb(false); },
      uploadGroupCover: function(a,b,cb){ noop(); if(cb) cb(null); },
      updateGroupRules: function(a,b,cb){ noop(); if(cb) cb(false); },
      generateGroupInviteToken: function(a,cb){ noop(); if(cb) cb(null); },
      disableGroupInviteToken: function(a,cb){ noop(); if(cb) cb(false); },
      getGroupByInviteToken: function(t,cb){ cb(null); },
      joinGroupViaInvite: function(a,b,cb){ noop(); if(cb) cb(false); },
      updateGroupJoinQuestions: function(a,b,cb){ noop(); if(cb) cb(false); },
      setGroupMemberRole: function(a,b,c,cb){ noop(); if(cb) cb(false); },
      getGroupMemberRole: function(a,cb){ cb(null); },
      banGroupMember: function(a,b,c,d,cb){ noop(); if(cb) cb(false); },
      removeGroupMember: function(a,b,cb){ noop(); if(cb) cb(false); },
      leaveGroup: function(a,cb){ noop(); if(cb) cb(false); },
      updateGroupPostApproval: function(a,b,cb){ noop(); if(cb) cb(false); },
      listenPendingGroupPosts: function(a,cb){ cb([]); return function(){}; },
      approveGroupPost: function(a,cb){ noop(); if(cb) cb(false); },
      declineGroupPost: function(a,cb){ noop(); if(cb) cb(false); },
      pinGroupPost: function(a,b,cb){ noop(); if(cb) cb(false); },
      unpinGroupPost: function(a,b,cb){ noop(); if(cb) cb(false); },
      createGroupEvent: function(a,b,cb){ noop(); if(cb) cb(null); },
      listenGroupEvents: function(a,cb){ cb([]); return function(){}; },
      rsvpGroupEvent: function(a,b,c,cb){ noop(); if(cb) cb(false); },
      rsvpEvent: function(a,cb){ noop(); if(cb) cb(false); },
      uploadGroupFile: function(a,b,cb){ noop(); if(cb) cb(null); },
      listenGroupFiles: function(a,cb){ cb([]); return function(){}; },
      deleteGroupFile: function(a,b,cb){ noop(); if(cb) cb(false); },
      sendGroupChatMessage: function(a,b,cb){ noop(); if(cb) cb(null); },
      listenGroupChat: function(a,cb){ cb([]); return function(){}; },
      deleteGroupChatMessage: function(a,b,cb){ noop(); if(cb) cb(false); },
      getGroupInsights: function(a,cb){ cb(null); },
      setGroupMute: function(a,b,cb){ noop(); if(cb) cb(false); },
      getGroupMuteStatus: function(a,cb){ cb(false); },
      updateGroupSettings: function(a,b,cb){ noop(); if(cb) cb(false); },
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
      listenIncomingGifts: function(uid, cb){ cb([]); return function(){}; },
      listenSentGifts: function(uid, cb){ cb([]); return function(){}; },
      claimPointGift: function(id, cb){ if(cb) cb(false); },
      redeemCoupon: function(){ noop(); },
      findUserByInput: function () { return Promise.resolve(null); },
      uploadImageDataUrl: function(dataUrl, folder, callback){ if(callback) callback(''); return Promise.resolve(''); },
      muteUser: function(){ noop(); },
      unmuteUser: function(){ noop(); },
      checkBlocking:  function(t, cb){ if(cb) cb(false); },
      checkBlockedBy: function(t, cb){ if(cb) cb(false); },
      checkMuting:    function(t, cb){ if(cb) cb(false); },
      getPrivacySettings: function(uid, cb){ cb({ messagingPref:'everyone', followPref:'everyone', profilePref:'public', postsPref:'public', friendRequestPref:'everyone' }); },
      updatePrivacySettings: function(s, cb){ if(cb) cb(false); },
      getBlockedUsersList: function(cb){ cb([]); },
      getMutedUsersList: function(cb){ cb([]); },
      listenReports: function(o, cb){ cb([]); return function(){}; },
      updateReportStatus: function(id, s, e, cb){ if(cb) cb(false); },
      createModerationAction: function(a, t, ty, n, cb){ if(cb) cb(false); },
      editMessage: function(){ noop(); },
      setTyping: function(){},
      markMessagesSeen: function(){},
      setConversationArchive: function(id, a, cb){ if(cb) cb(false); },
      setConversationMute: function(id, m, cb){ if(cb) cb(false); },
      setConversationTheme: function(id, t, cb){ if(cb) cb(false); },
      setConversationNickname: function(id, u, n, cb){ if(cb) cb(false); },
      listenConversationSettings: function(id, cb){ cb({}); return function(){}; },
      uploadAudioBlob: function(b, u, cb){ if(cb) cb(''); return Promise.resolve(''); },
      uploadDocumentBlob: function(b, f, u, cb){ if(cb) cb(''); return Promise.resolve(''); },
      requireAuth: showLoginPrompt,
      toast: toast
    };
    window.dispatchEvent(new Event('GeoSocialReady'));
  }

  // ── Main setup (runs once Firebase is ready) ──────────────────────────
  function setup(GF) {
    var debugMessages = false;
    try { debugMessages = new URLSearchParams(location.search).get('debugMessages') === '1'; } catch(e) {}
    function dbgMessages() { if (debugMessages) console.log.apply(console, ['[GeoSocial Msg]'].concat(Array.prototype.slice.call(arguments))); }
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
    var deleteField    = fs.deleteField;

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


    function createNotification(toUserId, type, title, body, href, extra, dedupKey) {
      var me = meData() || {};
      if (!toUserId || !me.uid || toUserId === me.uid) return Promise.resolve();
      var payload = Object.assign({
        userId: toUserId,
        toUserId: toUserId,
        targetActorType: 'user',
        targetActorId: toUserId,
        fromUserId: me.uid,
        fromName: me.name || 'GeoHub User',
        fromAvatar: me.avatar || '',
        type: type || 'notification',
        title: title || 'GeoHub',
        body: body || '',
        message: body || '',
        href: href || 'feed.html',
        read: false,
        seen: false,
        createdAt: serverTimestamp()
      }, extra || {});
      if (dedupKey) {
        return setDoc(doc(db, 'userNotifications', dedupKey), payload).catch(function (err) {
          console.warn('[GeoSocial] createNotification', err.message);
        });
      }
      return addDoc(collection(db, 'userNotifications'), payload).catch(function (err) {
        console.warn('[GeoSocial] createNotification', err.message);
      });
    }

    function createActorNotification(targetActorType, targetActorId, type, title, body, href, extra, dedupKey) {
      var me = meData() || {};
      if (!targetActorType || !targetActorId || !me.uid) return Promise.resolve();
      var isBusiness = targetActorType === 'business';
      var payload = Object.assign({
        userId: isBusiness ? '' : targetActorId,
        toUserId: isBusiness ? '' : targetActorId,
        businessId: isBusiness ? targetActorId : '',
        targetActorType: isBusiness ? 'business' : 'user',
        targetActorId: targetActorId,
        fromUserId: me.uid,
        fromName: me.name || 'GeoHub User',
        fromAvatar: me.avatar || '',
        type: type || 'notification',
        title: title || 'GeoHub',
        body: body || '',
        message: body || '',
        href: href || 'feed.html',
        read: false,
        seen: false,
        createdAt: serverTimestamp()
      }, extra || {});
      if (dedupKey) {
        return setDoc(doc(db, 'userNotifications', dedupKey), payload).catch(function (err) {
          console.warn('[GeoSocial] createActorNotification', err.message);
        });
      }
      return addDoc(collection(db, 'userNotifications'), payload).catch(function (err) {
        console.warn('[GeoSocial] createActorNotification', err.message);
      });
    }

    function createSystemNotification(toUserId, type, title, body, href, extra) {
      if (!toUserId) return Promise.resolve();
      var payload = Object.assign({
        userId: toUserId,
        toUserId: toUserId,
        targetActorType: 'user',
        targetActorId: toUserId,
        fromUserId: currentUid() || toUserId,
        fromName: 'GeoHub',
        fromAvatar: '',
        type: type || 'notification',
        title: title || 'GeoHub',
        body: body || '',
        message: body || '',
        href: href || 'feed.html',
        read: false,
        seen: false,
        createdAt: serverTimestamp()
      }, extra || {});
      return addDoc(collection(db, 'userNotifications'), payload).catch(function (err) {
        console.warn('[GeoSocial] createSystemNotification', err.message);
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

    // Cloudinary unsigned upload configuration. Firebase Storage is intentionally not used:
    // Firebase Storage is unavailable on the Spark plan for this project.
    // You can override these from DevTools or config.js with window.GEOHUB_CLOUDINARY_CONFIG.
    var cloudinaryOverride = window.GEOHUB_CLOUDINARY_CONFIG || (window.GeoConfig && window.GeoConfig.CLOUDINARY) || {};
    var GEOHUB_CLOUDINARY = {
      cloudName: cloudinaryOverride.cloudName || 'dw5dqk2w7',
      uploadPreset: cloudinaryOverride.uploadPreset || 'geohub_unsigned',
      rootFolder: cloudinaryOverride.rootFolder || 'geohub'
    };

    function cloudinaryConfigured() {
      return !!(GEOHUB_CLOUDINARY.cloudName && GEOHUB_CLOUDINARY.uploadPreset);
    }

    function cloudinaryFolder(folder, uid) {
      var safeFolder = String(folder || 'uploads').replace(/[^a-zA-Z0-9_\-/]/g, '').replace(/^\/+|\/+$/g, '') || 'uploads';
      var safeUid = String(uid || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '');
      return GEOHUB_CLOUDINARY.rootFolder + '/' + safeFolder + '/' + safeUid;
    }

    function uploadBlobToCloudinary(blob, folder, user, onProgress, _attempt) {
      if (!blob) return Promise.resolve('');
      if (!cloudinaryConfigured()) return Promise.reject(new Error('Cloudinary is not configured'));
      _attempt = _attempt || 1;
      var form = new FormData();
      form.append('file', blob);
      form.append('upload_preset', GEOHUB_CLOUDINARY.uploadPreset);
      form.append('folder', cloudinaryFolder(folder, user && user.uid));
      form.append('tags', 'geohub,' + String(folder || 'uploads'));
      var apiUrl = 'https://api.cloudinary.com/v1_1/' + encodeURIComponent(GEOHUB_CLOUDINARY.cloudName) + '/image/upload';
      return new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', apiUrl);
        if (onProgress && xhr.upload) {
          xhr.upload.addEventListener('progress', function(e) {
            if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100));
          });
        }
        var timer = setTimeout(function(){ xhr.abort(); }, 30000);
        xhr.onload = function() {
          clearTimeout(timer);
          var body = {};
          try { body = JSON.parse(xhr.responseText); } catch(e) {}
          if (xhr.status >= 200 && xhr.status < 300 && body.secure_url) {
            resolve(body.secure_url);
          } else {
            reject(new Error((body.error && body.error.message) || ('Cloudinary upload failed: ' + xhr.status)));
          }
        };
        xhr.onerror = function() { clearTimeout(timer); reject(new Error('Network error')); };
        xhr.onabort = function() { clearTimeout(timer); reject(new Error('Upload timeout')); };
        xhr.send(form);
      }).catch(function(err) {
        if (_attempt < 3) {
          return new Promise(function(res){ setTimeout(res, _attempt * 2000); }).then(function(){
            return uploadBlobToCloudinary(blob, folder, user, onProgress, _attempt + 1);
          });
        }
        throw err;
      });
    }

    function uploadFile(file, folder, onProgress) {
      if (!file) return Promise.resolve('');
      return new Promise(function(resolve) {
        requireAuth(function(user) {
          if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type || '')) {
            toast('Use a PNG, JPG, WEBP or GIF image.', 'error');
            return resolve('');
          }
          if (file.size > 8 * 1024 * 1024) {
            toast('Image is too large. Choose a file under 8 MB.', 'error');
            return resolve('');
          }
          compressImageBlob(file).then(function(compressed) {
            return uploadBlobToCloudinary(compressed, folder, user, onProgress);
          }).then(function(url) {
            resolve(url);
          }).catch(function(err) {
            console.error('[GeoSocial] uploadFile failed:', err && err.message ? err.message : err);
            toast('Image upload failed. Check your connection and try again.', 'error');
            resolve('');
          });
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

    function muteUser(targetUserId, callback) {
      requireAuth(function(user){
        if (!targetUserId || targetUserId === user.uid) return;
        setDoc(doc(db, 'mutedUsers', user.uid + '_' + targetUserId), {
          muterId: user.uid, mutedId: targetUserId, createdAt: serverTimestamp()
        }).then(function(){ toast('User muted'); if(callback) callback(true); })
          .catch(function(err){ console.error('[GeoSocial] muteUser', err); toast('Could not mute user.', 'error'); if(callback) callback(false, err); });
      });
    }

    function unmuteUser(targetUserId, callback) {
      requireAuth(function(user){
        deleteDoc(doc(db, 'mutedUsers', user.uid + '_' + targetUserId))
          .then(function(){ toast('User unmuted'); if(callback) callback(true); })
          .catch(function(err){ console.error('[GeoSocial] unmuteUser', err); toast('Could not unmute user.', 'error'); });
      });
    }

    function checkBlocking(targetUserId, callback) {
      requireAuth(function(user){
        if (!targetUserId) { callback(false); return; }
        getDoc(doc(db, 'blockedUsers', user.uid + '_' + targetUserId))
          .then(function(snap){ callback(snap.exists()); })
          .catch(function(){ callback(false); });
      });
    }

    function checkBlockedBy(targetUserId, callback) {
      requireAuth(function(user){
        if (!targetUserId) { callback(false); return; }
        getDoc(doc(db, 'blockedUsers', targetUserId + '_' + user.uid))
          .then(function(snap){ callback(snap.exists()); })
          .catch(function(){ callback(false); });
      });
    }

    function checkMuting(targetUserId, callback) {
      requireAuth(function(user){
        if (!targetUserId) { callback(false); return; }
        getDoc(doc(db, 'mutedUsers', user.uid + '_' + targetUserId))
          .then(function(snap){ callback(snap.exists()); })
          .catch(function(){ callback(false); });
      });
    }

    function listenSafetyPrefs(callback) {
      var uid = currentUid();
      if (!uid) { callback({ hiddenPostIds: [], blockedUserIds: [], mutedUserIds: [] }); return function(){}; }
      var state = { hiddenPostIds: [], blockedUserIds: [], mutedUserIds: [] };
      function emit(){ callback({ hiddenPostIds: state.hiddenPostIds.slice(), blockedUserIds: state.blockedUserIds.slice(), mutedUserIds: state.mutedUserIds.slice() }); }
      var uh = onSnapshot(query(collection(db, 'hiddenPosts'), where('userId', '==', uid), limit(200)), function(snap){
        var ids=[]; snap.forEach(function(d){ var x=d.data()||{}; if(x.postId) ids.push(x.postId); }); state.hiddenPostIds=ids; emit();
      }, function(err){ console.warn('[GeoSocial] hiddenPosts', err.message); emit(); });
      var ub = onSnapshot(query(collection(db, 'blockedUsers'), where('blockerId', '==', uid), limit(200)), function(snap){
        var ids=[]; snap.forEach(function(d){ var x=d.data()||{}; if(x.blockedId) ids.push(x.blockedId); }); state.blockedUserIds=ids; emit();
      }, function(err){ console.warn('[GeoSocial] blockedUsers', err.message); emit(); });
      var um = onSnapshot(query(collection(db, 'mutedUsers'), where('muterId', '==', uid), limit(200)), function(snap){
        var ids=[]; snap.forEach(function(d){ var x=d.data()||{}; if(x.mutedId) ids.push(x.mutedId); }); state.mutedUserIds=ids; emit();
      }, function(err){ console.warn('[GeoSocial] mutedUsers', err.message); emit(); });
      return function(){ try{uh();}catch(e){} try{ub();}catch(e){} try{um();}catch(e){} };
    }

    var PRIVACY_DEFAULTS = { messagingPref: 'everyone', followPref: 'everyone', profilePref: 'public', postsPref: 'public', friendRequestPref: 'everyone' };

    function getPrivacySettings(userId, callback) {
      var uid = userId || currentUid();
      if (!uid) { callback(Object.assign({}, PRIVACY_DEFAULTS)); return; }
      getDoc(doc(db, 'users', uid)).then(function(snap) {
        var data = (snap.exists() ? snap.data() : {}) || {};
        callback(Object.assign({}, PRIVACY_DEFAULTS, data.privacy || {}));
      }).catch(function() { callback(Object.assign({}, PRIVACY_DEFAULTS)); });
    }

    function updatePrivacySettings(settings, callback) {
      requireAuth(function(user) {
        updateDoc(doc(db, 'users', user.uid), { privacy: settings })
          .then(function() { if (callback) callback(true); })
          .catch(function(err) { console.error('[GeoSocial] updatePrivacySettings', err); toast('Could not save settings.', 'error'); if (callback) callback(false); });
      });
    }

    function getBlockedUsersList(callback) {
      requireAuth(function(user) {
        getDocs(query(collection(db, 'blockedUsers'), where('blockerId', '==', user.uid), limit(200))).then(function(snap) {
          var ids = [];
          snap.forEach(function(d) { var x = d.data() || {}; if (x.blockedId) ids.push(x.blockedId); });
          if (!ids.length) { callback([]); return; }
          Promise.all(ids.map(function(id) { return getDoc(doc(db, 'users', id)).catch(function(){ return null; }); }))
            .then(function(snaps) {
              var users = [];
              snaps.forEach(function(s, i) {
                if (!s) return;
                var d = s.exists() ? s.data() : {};
                users.push({ id: ids[i], name: d.fullName || d.displayName || d.name || 'Unknown', username: d.username || '', avatar: d.avatar || d.photoURL || '' });
              });
              callback(users);
            });
        }).catch(function() { callback([]); });
      });
    }

    function getMutedUsersList(callback) {
      requireAuth(function(user) {
        getDocs(query(collection(db, 'mutedUsers'), where('muterId', '==', user.uid), limit(200))).then(function(snap) {
          var ids = [];
          snap.forEach(function(d) { var x = d.data() || {}; if (x.mutedId) ids.push(x.mutedId); });
          if (!ids.length) { callback([]); return; }
          Promise.all(ids.map(function(id) { return getDoc(doc(db, 'users', id)).catch(function(){ return null; }); }))
            .then(function(snaps) {
              var users = [];
              snaps.forEach(function(s, i) {
                if (!s) return;
                var d = s.exists() ? s.data() : {};
                users.push({ id: ids[i], name: d.fullName || d.displayName || d.name || 'Unknown', username: d.username || '', avatar: d.avatar || d.photoURL || '' });
              });
              callback(users);
            });
        }).catch(function() { callback([]); });
      });
    }

    function reportTarget(type, id, reason, details, callback) {
      requireAuth(function(user){
        addDoc(collection(db, 'reports'), {
          reporterId: user.uid, targetType: type, targetId: id,
          reason: reason || 'report', details: details || '', status: 'pending', createdAt: serverTimestamp()
        }).then(function(){ toast('Report submitted'); if(callback) callback(true); })
          .catch(function(err){ console.error('[GeoSocial] reportTarget', err); toast('Report failed.', 'error'); if(callback) callback(false, err); });
      });
    }

    // ── Admin: listen to reports with optional status/type filter ─────────
    function listenReports(opts, callback) {
      var conditions = [orderBy('createdAt', 'desc'), limit(100)];
      if (opts && opts.status && opts.status !== 'all') conditions.unshift(where('status', '==', opts.status));
      if (opts && opts.targetType && opts.targetType !== 'all') conditions.unshift(where('targetType', '==', opts.targetType));
      var q = query.apply(null, [collection(db, 'reports')].concat(conditions));
      return onSnapshot(q, function(snap){
        var items = [];
        snap.forEach(function(d){ items.push(Object.assign({ id: d.id }, d.data())); });
        callback(items);
      }, function(err){ console.warn('[GeoSocial] listenReports', err.message); callback([]); });
    }

    function updateReportStatus(reportId, status, extra, callback) {
      var uid = currentUid();
      updateDoc(doc(db, 'reports', reportId), Object.assign({ status: status, resolvedAt: serverTimestamp(), resolvedBy: uid || '' }, extra || {}))
        .then(function(){ if(callback) callback(true); })
        .catch(function(err){ console.error('[GeoSocial] updateReportStatus', err); if(callback) callback(false, err); });
    }

    function createModerationAction(action, targetId, targetType, notes, callback) {
      var uid = currentUid();
      addDoc(collection(db, 'moderationActions'), {
        action: action, targetId: targetId || '', targetType: targetType || '',
        notes: notes || '', adminId: uid || '', createdAt: serverTimestamp()
      }).then(function(){ if(callback) callback(true); })
        .catch(function(err){ console.error('[GeoSocial] createModerationAction', err); if(callback) callback(false, err); });
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

    function walletRef(uid) {
      return doc(db, 'users', uid, 'private', 'wallet');
    }

    function walletDocToObj(data, uid) {
      data = data || {};
      var credits = Math.max(0, Number(data.credits || 0));
      var reservedDebits = Math.max(0, Number(data.reservedDebits || 0));
      var received = Math.max(0, Number(data.received || 0));
      var sent = Math.max(0, Number(data.sent || 0));
      var spent = Math.max(0, Number(data.spent || 0));
      var redeemed = Math.max(0, Number(data.redeemed || 0));
      return {
        uid: uid || '',
        balance: Math.max(0, credits - reservedDebits),
        credits: credits,
        reservedDebits: reservedDebits,
        earned: Math.max(0, credits - received),
        received: received,
        sent: sent,
        spent: spent,
        redeemed: redeemed,
        transactions: []
      };
    }

    function getWalletSnapshot(uid) {
      uid = uid || currentUid();
      var empty = walletDocToObj({}, uid || '');
      if (!uid) return Promise.resolve(empty);
      return getDoc(walletRef(uid))
        .then(function(snap){ return walletDocToObj(snap.exists() ? snap.data() : {}, uid); })
        .catch(function(err){ console.warn('[GeoSocial] getWalletSnapshot', err.message); return empty; });
    }

    function listenWallet(uid, callback) {
      uid = uid || currentUid();
      if (!uid) { callback(walletDocToObj({}, '')); return function(){}; }
      return onSnapshot(walletRef(uid), function(snap){
        callback(walletDocToObj(snap.exists() ? snap.data() : {}, uid));
      }, function(err){ console.warn('[GeoSocial] listenWallet', err.message); callback(walletDocToObj({}, uid)); });
    }

    function listenPointTransactions(uid, callback) {
      // pointTransactions is admin-only; transaction history is not available to clients on Spark plan
      if (callback) callback([]);
      return function(){};
    }

    function ensureWalletSnapshot(uid) {
      uid = uid || currentUid();
      if (!uid) return Promise.resolve({ credits: 0, reservedDebits: 0, sent: 0, spent: 0, received: 0, redeemed: 0, updatedAt: serverTimestamp() });
      return getDoc(walletRef(uid)).then(function(snap){
        var d = snap.exists() ? (snap.data() || {}) : {};
        return {
          credits: Math.max(0, Number(d.credits || 0)),
          reservedDebits: Math.max(0, Number(d.reservedDebits || 0)),
          sent: Math.max(0, Number(d.sent || 0)),
          spent: Math.max(0, Number(d.spent || 0)),
          received: Math.max(0, Number(d.received || 0)),
          redeemed: Math.max(0, Number(d.redeemed || 0)),
          updatedAt: serverTimestamp()
        };
      }).catch(function(){
        return { credits: 0, reservedDebits: 0, sent: 0, spent: 0, received: 0, redeemed: 0, updatedAt: serverTimestamp() };
      });
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
          var giftRef = doc(collection(db, 'pointGifts'));
          return runTransaction(db, function(tx){
            return tx.get(walletRef(user.uid)).then(function(walletSnap){
              var wallet = walletSnap.exists() ? (walletSnap.data() || {}) : {};
              var credits = Math.max(0, Number(wallet.credits || 0));
              var reservedDebits = Math.max(0, Number(wallet.reservedDebits || 0));
              if (credits - reservedDebits < n) throw new Error('insufficient-points');
              tx.set(walletRef(user.uid), {
                credits: credits,
                reservedDebits: reservedDebits + n,
                sent: Math.max(0, Number(wallet.sent || 0)) + n,
                updatedAt: serverTimestamp()
              }, { merge: true });
              tx.set(giftRef, {
                fromUserId: user.uid, toUserId: targetId, amount: n,
                fromName: me.name || user.displayName || 'GeoHub User',
                toName: target.fullName || target.displayName || target.name || target.email || 'GeoHub User',
                message: String(message || '').slice(0, 240),
                status: 'pending', createdAt: serverTimestamp()
              });
              return targetId;
            });
          });
        }).then(function(targetId){
          updateDoc(doc(db, 'users', user.uid), { geoPointsSentTotal: increment(n), updatedAt: serverTimestamp() }).catch(function(){});
          createNotification(targetId, 'points_received', (me.name || 'GeoHub User') + ' sent you ' + n + ' GeoPoints', message || 'Tap to claim your GeoPoints.', 'rewards.html?tab=wallet', { amount: n });
          toast('GeoPoints sent — recipient must claim'); if(callback) callback(true);
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
        runTransaction(db, function(tx){
          return tx.get(walletRef(user.uid)).then(function(walletSnap){
            var wallet = walletSnap.exists() ? (walletSnap.data() || {}) : {};
            var credits = Math.max(0, Number(wallet.credits || 0));
            var reservedDebits = Math.max(0, Number(wallet.reservedDebits || 0));
            if (credits - reservedDebits < n) throw new Error('insufficient-points');
            tx.set(walletRef(user.uid), {
              credits: credits,
              reservedDebits: reservedDebits + n,
              spent: Math.max(0, Number(wallet.spent || 0)) + n,
              updatedAt: serverTimestamp()
            }, { merge: true });
          });
        }).then(function(){ updateDoc(doc(db, 'users', user.uid), { geoPointsSpentTotal: increment(n), updatedAt: serverTimestamp() }).catch(function(){}); toast('GeoPoints spent'); if(callback) callback(true); })
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
        var rewardDocRef = doc(db, 'rewards', rewardId);
        var couponRef = doc(collection(db, 'rewardCoupons'));
        var code = couponCode('GH');
        runTransaction(db, function(tx){
          return Promise.all([tx.get(rewardDocRef), tx.get(walletRef(user.uid))]).then(function(results){
            var rs = results[0]; var walletSnap = results[1];
            if (!rs.exists()) throw new Error('reward-not-found');
            var r = rs.data() || {};
            if (r.active === false) throw new Error('not-active');
            var expMs = tsToMillis(r.expiresAt);
            if (expMs && expMs < Date.now()) throw new Error('expired');
            var price = normalAmount(r.cost || r.pointsCost || r.pointPrice || r.price || r.points);
            if (!price) throw new Error('invalid-price');
            var wallet = walletSnap.exists() ? (walletSnap.data() || {}) : {};
            var credits = Math.max(0, Number(wallet.credits || 0));
            var reservedDebits = Math.max(0, Number(wallet.reservedDebits || 0));
            if (credits - reservedDebits < price) throw new Error('insufficient-points');
            var stockVal = r.stock != null ? Number(r.stock) : null;
            var remaining = stockVal !== null ? stockVal : Number(r.quantityRemaining || 0);
            var hasLimit = stockVal !== null ? true : Number(r.quantityTotal || 0) > 0;
            if (hasLimit && remaining <= 0) throw new Error('sold-out');
            if (hasLimit) {
              if (stockVal !== null) {
                tx.update(rewardDocRef, { stock: increment(-1), updatedAt: serverTimestamp() });
              } else {
                tx.update(rewardDocRef, { quantityRemaining: increment(-1), updatedAt: serverTimestamp() });
              }
            }
            tx.set(walletRef(user.uid), {
              credits: credits,
              reservedDebits: reservedDebits + price,
              redeemed: Math.max(0, Number(wallet.redeemed || 0)) + price,
              updatedAt: serverTimestamp()
            }, { merge: true });
            tx.set(couponRef, {
              rewardId: rewardId, userId: user.uid, businessId: r.businessId || '',
              rewardTitle: r.title || r.name || 'Reward', pointPrice: price,
              businessOwnerId: r.ownerId || r.createdBy || '',
              code: code, qrValue: code, status: 'active',
              createdAt: serverTimestamp(), expiresAt: r.expiresAt || ''
            });
            return { reward: r, price: price };
          });
        }).then(function(res){
          updateDoc(doc(db, 'users', user.uid), { geoPointsSpentTotal: increment(res.price), updatedAt: serverTimestamp() }).catch(function(){});
          createSystemNotification(user.uid, 'reward', 'Reward Redeemed!', 'You redeemed: ' + (res.reward.title || res.reward.name || 'a reward'), 'rewards.html').catch(function(){});
          var _ownerId = res.reward.ownerId || res.reward.createdBy || '';
          if (false && _ownerId && _ownerId !== user.uid) {
            createSystemNotification(_ownerId, 'coupon_redeemed', 'Coupon Redeemed', 'A customer redeemed: ' + (res.reward.title || res.reward.name || 'a reward') + '. Code: ' + code, 'rewards.html').catch(function(){});
          }
          if (res.reward.businessId) {
            createActorNotification('business', res.reward.businessId, 'coupon_redeemed', 'Coupon Redeemed', 'A customer redeemed: ' + (res.reward.title || res.reward.name || 'a reward') + '. Code: ' + code, 'rewards.html', {
              businessId: res.reward.businessId,
              rewardId: rewardId,
              couponCode: code
            }).catch(function(){});
          }
          toast('Coupon unlocked: ' + code);
          if(callback) callback(true, { couponId: couponRef.id, code: code, reward: res.reward });
        }).catch(function(err){
          var msg = err.message === 'insufficient-points' ? 'Not enough GeoPoints' : err.message === 'sold-out' ? 'Reward sold out' : err.message === 'reward-not-found' ? 'Reward not found' : err.message === 'not-active' ? 'This reward is no longer available' : err.message === 'expired' ? 'This reward has expired' : 'Could not redeem reward';
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

    function listenIncomingGifts(uid, callback) {
      uid = uid || currentUid();
      if (!uid) { callback([]); return function(){}; }
      var q = query(collection(db, 'pointGifts'), where('toUserId', '==', uid), where('status', '==', 'pending'), limit(50));
      return onSnapshot(q, function(snap){
        var rows=[]; snap.forEach(function(d){ rows.push(Object.assign({ id:d.id }, d.data())); });
        rows.sort(function(a,b){ return tsToMillis(b.createdAt)-tsToMillis(a.createdAt); });
        callback(rows);
      }, function(err){ console.warn('[GeoSocial] listenIncomingGifts', err.message); callback([]); });
    }

    function listenSentGifts(uid, callback) {
      uid = uid || currentUid();
      if (!uid) { callback([]); return function(){}; }
      var q = query(collection(db, 'pointGifts'), where('fromUserId', '==', uid), where('status', '==', 'pending'), limit(50));
      return onSnapshot(q, function(snap){
        var rows=[]; snap.forEach(function(d){ rows.push(Object.assign({ id:d.id }, d.data())); });
        rows.sort(function(a,b){ return tsToMillis(b.createdAt)-tsToMillis(a.createdAt); });
        callback(rows);
      }, function(err){ console.warn('[GeoSocial] listenSentGifts', err.message); callback([]); });
    }

    function claimPointGift(giftId, callback) {
      requireAuth(function(user){
        var giftDocRef = doc(db, 'pointGifts', giftId);
        getDoc(giftDocRef).then(function(gSnap){
          if (!gSnap.exists()) throw new Error('gift-not-found');
          var g = gSnap.data() || {};
          if (g.toUserId !== user.uid) throw new Error('not-recipient');
          if (g.status !== 'pending') throw new Error('already-claimed');
          var n = normalAmount(g.amount);
          if (!n) throw new Error('invalid-amount');
          return runTransaction(db, function(tx){
            return tx.get(giftDocRef).then(function(gs){
              var gd = gs.exists() ? (gs.data() || {}) : {};
              if (gd.toUserId !== user.uid) throw new Error('not-recipient');
              if (gd.status !== 'pending') throw new Error('already-claimed');
              return tx.get(walletRef(user.uid)).then(function(walletSnap){
                var wallet = walletSnap.exists() ? (walletSnap.data() || {}) : {};
                tx.set(walletRef(user.uid), {
                  credits: Math.max(0, Number(wallet.credits || 0)) + n,
                  received: Math.max(0, Number(wallet.received || 0)) + n,
                  updatedAt: serverTimestamp()
                }, { merge: true });
                tx.update(giftDocRef, { status: 'claimed', claimedAt: serverTimestamp() });
                return n;
              });
            });
          });
        }).then(function(n){
          updateDoc(doc(db, 'users', user.uid), { geoPointsReceivedTotal: increment(n), updatedAt: serverTimestamp() }).catch(function(){});
          toast(n + ' GeoPoints claimed!');
          if(callback) callback(true, n);
        }).catch(function(err){
          var msg = err.message === 'gift-not-found' ? 'Gift not found' : err.message === 'already-claimed' ? 'Already claimed' : err.message === 'not-recipient' ? 'This gift is not for you' : 'Could not claim gift';
          toast(msg, 'error'); if(callback) callback(false, err);
        });
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
              return createNotification(ownerId, 'like', (meData() || {}).name + ' liked your post', 'Someone liked your post.', 'feed.html#post-' + postId, { postId: postId }, 'like_' + (meData() || {}).uid + '_' + postId);
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
    function addComment(postId, text, callback, extra) {
      extra = extra || {};
      if (!text || !text.trim()) return;
      requireAuth(function (user) {
        var me = meData() || {};
        var cleanText = text.trim();
        var postOwnerId = null;
        // Actor identity — business actor or fallback to current user
        var cAuthorId     = extra.authorId     || user.uid;
        var cAuthorType   = extra.authorType   || 'user';
        var cAuthorName   = extra.authorName   || me.name || user.displayName || 'GeoHub User';
        var cAuthorAvatar = extra.authorAvatar || me.avatar || user.photoURL  || '';
        var cBusinessId   = extra.businessId   || null;

        // Comments must not fail because an optional pre-check/counter/notification fails.
        // The only operation that decides success is the actual comment create.
        getPostOwner(postId)
          .catch(function (err) {
            console.warn('[GeoSocial] comment owner lookup skipped:', err && err.message ? err.message : err);
            return null;
          })
          .then(function(ownerId) {
            postOwnerId = ownerId;
            if (!ownerId) return { exists: function(){ return false; } };
            return getDoc(doc(db, 'blockedUsers', ownerId + '_' + user.uid)).catch(function(err) {
              console.warn('[GeoSocial] block check before comment skipped:', err && err.message ? err.message : err);
              return { exists: function(){ return false; } };
            });
          })
          .then(function(blockSnap) {
            if (blockSnap && blockSnap.exists && blockSnap.exists()) {
              toast('You cannot comment on this post.', 'error');
              if (callback) callback(new Error('blocked'));
              return null;
            }
            return addDoc(collection(db, 'posts', postId, 'comments'), {
              text: cleanText,
              authorId:     cAuthorId,
              userId:       user.uid,     // always real Firebase UID — satisfies Firestore newOwnerMatches()
              createdByUid: user.uid,
              authorType:   cAuthorType,
              authorName:   cAuthorName,
              authorAvatar: cAuthorAvatar,
              businessId:   cBusinessId,
              likes: 0,
              reactionCount: 0,
              replyCount: 0,
              status: 'active',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          })
          .then(function (ref) {
            if (!ref) return;

            // UI success immediately after the comment document exists.
            toast('Comment posted');
            if (callback) callback(null, ref.id);

            // Non-critical side effects: never roll back the visible comment.
            updateDoc(doc(db, 'posts', postId), { commentCount: increment(1), updatedAt: serverTimestamp() })
              .catch(function(err){ console.warn('[GeoSocial] comment counter skipped:', err && err.message ? err.message : err); });

            createNotification(
              postOwnerId,
              'comment',
              (me.name || 'GeoHub User') + ' commented on your post',
              cleanText,
              'feed.html?post=' + postId + '&comment=' + ref.id,
              { postId: postId, commentId: ref.id }
            ).catch(function(){});

            awardPoints(5, 'Comment on post', 'post', postId).catch(function(){});
          })
          .catch(function (err) {
            console.error('[GeoSocial] addComment', err);
            toast('Failed to comment.', 'error');
            if (callback) callback(err);
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
        callback([]);
      });
    }


    function addCommentReply(postId, commentId, text, callback, extra) {
      if (!text || !text.trim()) return;
      extra = extra || {};
      requireAuth(function (user) {
        var me = meData() || {};
        var replyText = text.trim();
        var rAuthorId   = extra.authorId     || user.uid;
        var rAuthorType = extra.authorType   || 'user';
        var rAuthorName = extra.authorName   || me.name || user.displayName || 'GeoHub User';
        var rAuthorAv   = extra.authorAvatar || me.avatar || user.photoURL || '';
        var rBizId      = extra.businessId   || null;
        addDoc(collection(db, 'posts', postId, 'comments', commentId, 'replies'), {
          postId:       postId,
          commentId:    commentId,
          text:         replyText,
          authorId:     rAuthorId,
          userId:       user.uid,
          createdByUid: user.uid,
          authorType:   rAuthorType,
          authorName:   rAuthorName,
          authorAvatar: rAuthorAv,
          businessId:   rBizId,
          likeCount:    0,
          status:       'active',
          createdAt:    serverTimestamp()
        }).then(function () {
          // Increment replyCount on the comment (not commentCount on the post)
          return updateDoc(doc(db, 'posts', postId, 'comments', commentId), { replyCount: increment(1) }).catch(function(){});
        }).then(function () {
          return getDoc(doc(db, 'posts', postId, 'comments', commentId)).then(function (snap) {
            var c = snap.exists() ? snap.data() : {};
            var ownerId = c.authorId || c.userId || null;
            return createNotification(ownerId, 'reply', rAuthorName + ' replied to your comment', replyText, 'feed.html?post=' + postId + '&comment=' + commentId, { postId: postId, commentId: commentId });
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
          return getDoc(doc(db, 'users', targetUserId)).then(function(tSnap) {
            var tData = (tSnap.exists() ? tSnap.data() : {}) || {};
            var pref = (tData.privacy || {}).followPref || 'everyone';
            if (pref === 'nobody') { toast('This user does not accept followers.', 'error'); if (callback) callback(false); return Promise.resolve(null); }
            return setDoc(ref, { followerId: uid, followingId: targetUserId, createdAt: serverTimestamp() })
              .then(function () {
                return updateDoc(doc(db, 'users', targetUserId), { followers: increment(1) }).catch(function(){})
                  .then(function(){ return updateDoc(doc(db, 'users', uid), { following: increment(1) }).catch(function(){}); })
                  .then(function(){ return createNotification(targetUserId, 'follow', (meData() || {}).name + ' followed you', 'You have a new follower.', 'profile.html?id=' + uid, { followerId: uid }, 'follow_' + uid + '_' + targetUserId); });
              })
              .then(function () {
                toast('Following');
                if (callback) callback(true);
              });
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
          rules: data.rules || [],
          joinQuestions: data.joinQuestions || [],
          pinnedPostIds: data.pinnedPostIds || [],
          postApproval: data.postApproval || false,
          inviteToken: null,
          inviteEnabled: false,
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
        // Fetch group privacy once so it can be denormalised onto the post.
        // The Firestore rule uses resource.data.groupPrivacy to gate reads
        // without a per-document get() call inside the rule engine.
        getDoc(doc(db, 'groups', groupId)).then(function(gSnap) {
          var groupPrivacy = gSnap.exists() ? (gSnap.data().privacy || 'public') : 'public';
          return addDoc(collection(db, 'groupPosts'), {
            groupId: groupId, groupPrivacy: groupPrivacy,
            text: text.trim(), mediaUrl: mediaUrl || null,
            authorId: user.uid, userId: user.uid,
            authorName: me.name || user.displayName || 'GeoHub User',
            authorAvatar: me.avatar || user.photoURL || '',
            likeCount: 0, commentCount: 0, createdAt: serverTimestamp()
          });
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
        console.log('[friends] send request', { fromUid: uid, toUid: toUserId, requestId: uid + '_' + toUserId });
        Promise.all([
          getDoc(doc(db, 'users', toUserId)).catch(function(){ return null; }),
          getDoc(friendRef).catch(function(){ return null; }),
          getDoc(reqRef).catch(function(){ return null; }),
          getDoc(reverseReqRef).catch(function(){ return null; })
        ]).then(function(results) {
          var tData = (results[0] && results[0].exists() ? results[0].data() : {}) || {};
          var pref = (tData.privacy || {}).friendRequestPref || 'everyone';
          if (pref === 'nobody') { toast('This user is not accepting friend requests.', 'error'); if (callback) callback('denied'); return Promise.reject('denied'); }
          if (results[1] && results[1].exists()) throw new Error('already-friends');
          if (results[2] && results[2].exists()) throw new Error('already-requested');
          if (results[3] && results[3].exists() && (results[3].data() || {}).status === 'pending') throw new Error('incoming-request-exists');
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
          console.log('[friends] request sent OK', { fromUid: uid, toUid: toUserId });
          toast('Friend request sent');
          if (callback) callback('pending');
        }).catch(function (err) {
          if (err === 'denied') return;
          var msg = err && err.message;
          if (msg === 'already-friends') { toast('Already friends'); if(callback) callback('friends'); return; }
          if (msg === 'already-requested') { toast('Request already sent'); if(callback) callback('pending'); return; }
          if (msg === 'incoming-request-exists') { toast('This user already sent you a request'); if(callback) callback('incoming'); return; }
          console.warn('[friends] request failed', { code: err && err.code, message: err && err.message, fromUid: uid, toUid: toUserId });
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
      // Wait for all 3 listeners to fire at least once before emitting, to avoid
      // intermediate 'none' state flicker during initial load.
      var allSettled = false;
      var settledCount = 0;
      function emit(){
        if (!allSettled) {
          settledCount++;
          if (settledCount < 3) return;
          allSettled = true;
        }
        console.log('[friends] status', { uid: uid, target: targetUserId, state: status.state, requestId: status.requestId });
        callback(Object.assign({}, status));
      }
      unsubs.push(onSnapshot(doc(db, 'friends', friendshipId(uid, targetUserId)), function(snap){
        if (snap.exists()) status = { state: 'friends', friendId: snap.id };
        else if (status.state === 'friends') status = { state: 'none' };
        emit();
      }, function(err){ console.warn('[friends] friends-doc listener err', err && err.message); emit(); }));
      unsubs.push(onSnapshot(doc(db, 'friendRequests', uid + '_' + targetUserId), function(snap){
        if (status.state === 'friends') return emit();
        if (snap.exists() && (snap.data()||{}).status === 'pending') status = { state: 'outgoing', requestId: snap.id };
        else if (status.state === 'outgoing') status = { state: 'none' };
        emit();
      }, function(err){ console.warn('[friends] outgoing-req listener err', err && err.message); emit(); }));
      unsubs.push(onSnapshot(doc(db, 'friendRequests', targetUserId + '_' + uid), function(snap){
        if (status.state === 'friends') return emit();
        if (snap.exists() && (snap.data()||{}).status === 'pending') status = { state: 'incoming', requestId: snap.id, fromUserId: targetUserId };
        else if (status.state === 'incoming') status = { state: 'none' };
        emit();
      }, function(err){ console.warn('[friends] incoming-req listener err', err && err.message); emit(); }));
      return function(){ unsubs.forEach(function(u){ try{u();}catch(e){} }); };
    }

    function respondFriendRequest(requestId, accept, callback) {
      requireAuth(function(user){
        console.log('[friends] respond request', { requestId: requestId, accept: accept, byUid: user.uid });
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
      // Single-field query only — no composite index needed; filter pending client-side
      var q = query(collection(db, 'friendRequests'), where('toUserId', '==', uid), limit(50));
      return onSnapshot(q, function(snap){
        var items=[];
        snap.forEach(function(d){
          var r = Object.assign({id:d.id}, d.data());
          if ((r.status||'')==='pending') items.push(r);
        });
        console.log('[friends] incoming requests', { count: items.length, uid: uid });
        items.sort(function(a,b){ return tsToMillis(b.createdAt)-tsToMillis(a.createdAt); });
        if (!items.length) { callback([]); return; }
        Promise.all(items.map(function(r){
          var fromId = r.fromUserId || r.fromId || '';
          if (!fromId) return Promise.resolve(r);
          return getDoc(doc(db, 'users', fromId)).then(function(us){
            var u = us.exists() ? us.data() : {};
            return Object.assign({}, r, {
              senderName: u.fullName || u.displayName || u.name || 'GeoHub User',
              senderUsername: u.username || fromId,
              senderAvatar: u.avatar || u.photoURL || ''
            });
          }).catch(function(){ return r; });
        })).then(function(enriched){ callback(enriched); });
      }, function(err){ console.warn('[friends] listenFriendRequests error', err.message); callback([]); });
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
        Promise.all([
          deleteDoc(doc(db, 'friends', fid)).catch(function(){}),
          deleteDoc(doc(db, 'friendships', fid)).catch(function(){})
        ]).then(function(){
          updateDoc(doc(db, 'users', targetUserId), { friendsCount: increment(-1) }).catch(function(){});
          updateDoc(doc(db, 'users', user.uid), { friendsCount: increment(-1) }).catch(function(){});
          toast('Friend removed');
          if(callback) callback(false);
        }).catch(function(err){ console.error('[GeoSocial] removeFriend', err); toast('Could not remove friend.', 'error'); });
      });
    }

    function cancelFriendRequest(toUserId, callback) {
      requireAuth(function(user){
        var reqRef = doc(db, 'friendRequests', user.uid + '_' + toUserId);
        deleteDoc(reqRef).then(function(){
          toast('Friend request cancelled');
          if(callback) callback();
        }).catch(function(err){
          if(err && err.code === 'not-found'){ if(callback) callback(); return; }
          console.error('[GeoSocial] cancelFriendRequest', err);
          toast('Could not cancel request.', 'error');
          if(callback) callback(err);
        });
      });
    }

    function listenSentFriendRequests(callback) {
      var uid = currentUid();
      if(!uid){ callback([]); return function(){}; }
      // Single-field query — no composite index needed; filter pending client-side
      var q = query(collection(db,'friendRequests'), where('fromUserId','==',uid), limit(50));
      return onSnapshot(q, function(snap){
        var items=[];
        snap.forEach(function(d){
          var r=Object.assign({id:d.id},d.data());
          if((r.status||'')==='pending') items.push(r);
        });
        items.sort(function(a,b){ return tsToMillis(b.createdAt)-tsToMillis(a.createdAt); });
        if(!items.length){ callback([]); return; }
        Promise.all(items.map(function(r){
          var toId=r.toUserId||'';
          if(!toId) return Promise.resolve(r);
          return getDoc(doc(db,'users',toId)).then(function(us){
            var u=us.exists()?us.data():{};
            return Object.assign({},r,{
              recipientName: u.fullName||u.displayName||u.name||'GeoHub User',
              recipientUsername: u.username||toId,
              recipientAvatar: u.avatar||u.photoURL||''
            });
          }).catch(function(){ return r; });
        })).then(function(enriched){ callback(enriched); });
      }, function(err){ console.warn('[GeoSocial] listenSentFriendRequests', err.message); callback([]); });
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
        }).then(function (docRef) {
          updateDoc(doc(db, 'users', user.uid), {
            visitedPlaces: increment(1),
            checkinCount: increment(1),
            updatedAt: serverTimestamp()
          }).catch(function(){});
          setDoc(doc(db, 'userBadges', user.uid + '_first_checkin'), {
            userId: user.uid, badgeId: 'first_checkin', title: 'First Check-in', icon: 'fa-location-dot', createdAt: serverTimestamp()
          }, { merge: true }).then(function(){
            createSystemNotification(user.uid, 'badge', 'Badge Earned: First Check-in!', 'You earned the First Check-in badge.', 'profile.html', { badgeId: 'first_checkin' }).catch(function(){});
          }).catch(function(){});
          toast('Checked in at ' + (placeName || 'place') + '! +' + (xpAwarded || 50) + ' XP');
          awardPoints(Number(xpAwarded || 50), 'Check-in', 'checkin', placeId || '').catch(function(){});
          if (window.GeoChallenges && window.GeoChallenges.evaluateCheckin) {
            window.GeoChallenges.evaluateCheckin({
              userId: user.uid,
              authorId: user.uid,
              placeId: placeId || '',
              placeName: placeName || '',
              checkinType: 'normal',
              verified: true,
              xpAwarded: Number(xpAwarded || 50)
            }, docRef.id);
          }
          if (callback) callback();
        }).catch(function (err) {
          console.error('[GeoSocial] createCheckin', err);
          toast('Check-in failed.', 'error');
        });
      });
    }

    function createCheckinFull(data, callback) {
      requireAuth(function (user) {
        var me = meData() || {};
        var xp = Number(data.xpAwarded || 50);
        addDoc(collection(db, 'checkins'), {
          userId:             user.uid,
          authorId:           user.uid,
          authorName:         me.name || user.displayName || 'GeoHub User',
          authorAvatar:       me.avatar || user.photoURL || '',
          placeId:            data.placeId     || '',
          placeName:          data.placeName   || '',
          businessId:         data.businessId  || null,
          eventId:            data.eventId     || null,
          city:               data.city        || '',
          country:            data.country     || 'Georgia',
          lat:                data.lat         || null,
          lng:                data.lng         || null,
          accuracy:           data.accuracy    || null,
          checkinType:        data.checkinType || 'normal',
          photoUrl:           data.photoUrl    || null,
          caption:            data.caption     || '',
          verified:           data.verified    === true,
          verificationMethod: data.verificationMethod || 'none',
          xpAwarded:          xp,
          createdAt:          serverTimestamp()
        }).then(function (docRef) {
          updateDoc(doc(db, 'users', user.uid), {
            visitedPlaces:  increment(1),
            checkinCount:   increment(1),
            updatedAt:      serverTimestamp()
          }).catch(function(){});
          setDoc(doc(db, 'userBadges', user.uid + '_first_checkin'), {
            userId: user.uid, badgeId: 'first_checkin',
            title: 'First Check-in', icon: 'fa-location-dot',
            createdAt: serverTimestamp()
          }, { merge: true }).catch(function(){});
          awardPoints(xp, 'Check-in at ' + (data.placeName || 'place'), 'checkin', data.placeId || '').catch(function(){});
          if (window.GeoChallenges && window.GeoChallenges.evaluateCheckin) {
            window.GeoChallenges.evaluateCheckin(Object.assign({}, data, {
              userId: user.uid,
              authorId: user.uid,
              verified: data.verified === true,
              xpAwarded: xp
            }), docRef.id);
          }
          if (callback) callback({ success: true, xpAwarded: xp, checkinId: docRef.id });
        }).catch(function (err) {
          console.error('[GeoSocial] createCheckinFull', err);
          toast('Check-in failed. Please try again.', 'error');
          if (callback) callback({ success: false, error: err.message });
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

    function listenActorNotifications(actor, callback) {
      actor = actor || {};
      var type = actor.targetActorType || actor.type || 'user';
      var actorId = actor.targetActorId || actor.actorId || actor.uid || actor.businessId || currentUid();
      if (type === 'business' && actorId && actorId.indexOf('business_') === 0) actorId = actorId.slice(9);
      if (type !== 'business' && actorId && actorId.indexOf('user_') === 0) actorId = actorId.slice(5);
      if (!actorId) { callback([]); return function () {}; }

      var col = collection(db, 'userNotifications');
      var byId = {};
      var ready = { primary: false, legacy: type === 'business' };
      var unsubs = [];

      function ms(v) { return v && v.toMillis ? v.toMillis() : (v && v.seconds ? v.seconds * 1000 : 0); }
      function emit() {
        if (!ready.primary || !ready.legacy) return;
        var items = Object.keys(byId).map(function (id) { return byId[id]; });
        items.sort(function (a, b) { return ms(b.createdAt) - ms(a.createdAt); });
        callback(items.slice(0, 50));
      }
      function listenSlot(slot, q) {
        unsubs.push(onSnapshot(q, function (snap) {
          snap.forEach(function (d) {
            var n = Object.assign({ id: d.id }, d.data());
            if (type === 'business') {
              if (n.targetActorType !== 'business' || n.targetActorId !== actorId) return;
            } else if (n.targetActorType === 'business') {
              return;
            }
            byId[d.id] = n;
          });
          ready[slot] = true;
          emit();
        }, function (err) {
          console.warn('[GeoSocial] listenActorNotifications', err.message);
          ready[slot] = true;
          emit();
        }));
      }

      listenSlot('primary', query(col,
        where('targetActorType', '==', type === 'business' ? 'business' : 'user'),
        where('targetActorId', '==', actorId),
        limit(50)));
      if (type !== 'business') {
        listenSlot('legacy', query(col, where('userId', '==', actorId), limit(50)));
      }
      return function () { unsubs.forEach(function (u) { try { u(); } catch(e) {} }); };
    }

    function markNotificationRead(notifId) {
      if (!notifId) return Promise.resolve(false);
      return updateDoc(doc(db, 'userNotifications', notifId), {
        read: true,
        seen: true,
        openedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }).then(function(){ return true; })
        .catch(function (err) { console.warn('[GeoSocial] markNotifRead', err.message); return false; });
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

    function addStoryReaction(storyId, ownerId, reactionEmoji, callback) {
      requireAuth(function(user) {
        if(!storyId) { if(callback) callback(null, new Error('No storyId')); return; }
        var me = meData() || {};
        var emoji = reactionEmoji || '❤️';
        setDoc(doc(db, 'stories', storyId, 'reactions', user.uid), {
          userId: user.uid,
          reaction: emoji,
          createdAt: serverTimestamp()
        }).then(function(){
          if(ownerId && ownerId !== user.uid) {
            createNotification(
              ownerId, 'story_reaction',
              (me.name || 'GeoHub User') + ' reacted ' + emoji + ' to your story',
              '',
              'feed.html?story=' + storyId,
              { storyId: storyId, reaction: emoji },
              'story_reaction_' + user.uid + '_' + storyId
            ).catch(function(){});
          }
          if(callback) callback();
        }).catch(function(err){ console.warn('[GeoSocial] addStoryReaction', err.message); if(callback) callback(null, err); });
      });
    }

    function removeStoryReaction(storyId, callback) {
      var uid = currentUid(); if(!uid || !storyId) { if(callback) callback(); return; }
      deleteDoc(doc(db, 'stories', storyId, 'reactions', uid))
        .then(function(){ if(callback) callback(); })
        .catch(function(err){ console.warn('[GeoSocial] removeStoryReaction', err.message); if(callback) callback(null, err); });
    }

    function addStoryReply(storyId, ownerId, text, callback) {
      requireAuth(function(user) {
        if(!storyId || !(text||'').trim()) { if(callback) callback(null, new Error('Missing params')); return; }
        var me = meData() || {};
        var cleanText = text.trim();
        addDoc(collection(db, 'stories', storyId, 'replies'), {
          storyId: storyId,
          ownerId: ownerId || '',
          fromUserId: user.uid,
          authorId: user.uid,
          authorName: me.name || user.displayName || 'GeoHub User',
          authorAvatar: me.avatar || user.photoURL || '',
          text: cleanText,
          createdAt: serverTimestamp()
        }).then(function(){
          if(ownerId && ownerId !== user.uid) {
            createNotification(
              ownerId, 'story_reply',
              (me.name || 'GeoHub User') + ' replied to your story',
              cleanText.slice(0, 80),
              'feed.html?story=' + storyId,
              { storyId: storyId }
            ).catch(function(){});
          }
          if(callback) callback();
        }).catch(function(err){ console.warn('[GeoSocial] addStoryReply', err.message); toast('Could not send reply.', 'error'); if(callback) callback(null, err); });
      });
    }

    function deleteStory(storyId, callback) {
      requireAuth(function(user) {
        if(!storyId) { if(callback) callback(null, new Error('No storyId')); return; }
        deleteDoc(doc(db, 'stories', storyId))
          .then(function(){ if(callback) callback(); })
          .catch(function(err){ console.warn('[GeoSocial] deleteStory', err.message); if(callback) callback(null, err); });
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

    function rsvpEvent(eventId, callback) {
      requireAuth(function (user) {
        var participantId = eventId + '_' + user.uid;
        var docRef = doc(db, 'eventParticipants', participantId);
        getDoc(docRef).then(function (snap) {
          if (snap.exists()) {
            return deleteDoc(docRef).then(function () {
              toast('RSVP removed');
              if (callback) callback('removed');
            });
          }
          return setDoc(docRef, {
            eventId: eventId,
            userId: user.uid,
            uid: user.uid,
            displayName: user.displayName || '',
            photoURL: user.photoURL || '',
            createdAt: serverTimestamp()
          }).then(function () {
            toast('RSVP saved!');
            if (callback) callback(true);
          });
        }).catch(function (err) {
          console.error('[GeoSocial] rsvpEvent', err);
          toast('RSVP failed', 'error');
          if (callback) callback(false);
        });
      });
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
        Promise.all([
          getDoc(doc(db, 'blockedUsers', user.uid + '_' + targetUserId)),
          getDoc(doc(db, 'blockedUsers', targetUserId + '_' + user.uid)),
          getDoc(doc(db, 'users', targetUserId))
        ]).then(function(snaps) {
          if (snaps[0].exists()) { toast('Unblock this user to send messages.', 'error'); return; }
          if (snaps[1].exists()) { toast('You cannot message this user.', 'error'); return; }
          var tData = (snaps[2].exists() ? snaps[2].data() : {}) || {};
          var msgPref = (tData.privacy || {}).messagingPref || 'everyone';
          if (msgPref === 'nobody') { toast('This user is not accepting messages.', 'error'); return; }
          if (msgPref === 'friends') {
            return getDoc(doc(db, 'friends', friendshipId(user.uid, targetUserId))).then(function(fSnap) {
              if (!fSnap.exists()) { toast('This user only accepts messages from friends.', 'error'); return; }
              var cid = conversationIdFor(user.uid, targetUserId);
              return setDoc(doc(db, 'conversations', cid), {
                participants: [user.uid, targetUserId],
                inboxKeys: ['user:' + user.uid, 'user:' + targetUserId],
                inboxActorIds: ['user_' + user.uid, 'user_' + targetUserId],
                memberUids: [user.uid, targetUserId],
                type: 'personal',
                updatedAt: serverTimestamp(),
                createdAt: serverTimestamp(),
                lastMessage: '',
                unreadFor: [],
                readBy: {}
              }, { merge: true }).then(function () { if (callback) callback(cid); });
            });
          }
          var cid = conversationIdFor(user.uid, targetUserId);
          return setDoc(doc(db, 'conversations', cid), {
            participants: [user.uid, targetUserId],
            inboxKeys: ['user:' + user.uid, 'user:' + targetUserId],
            inboxActorIds: ['user_' + user.uid, 'user_' + targetUserId],
            memberUids: [user.uid, targetUserId],
            type: 'personal',
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
            lastMessage: '',
            unreadFor: [],
            readBy: {}
          }, { merge: true }).then(function () {
            if (callback) callback(cid);
          });
        }).catch(function (err) {
          console.error('[GeoSocial] startConversation', err);
          toast('Could not open messages.', 'error');
        });
      });
    }

    function startBusinessConversation(businessId, ownerUid, callback) {
      requireAuth(function (user) {
        if (!businessId || !ownerUid) return;
        if (ownerUid === user.uid) { toast('You own this business.', 'error'); return; }
        var cid = 'biz_' + businessId + '_' + user.uid;
        setDoc(doc(db, 'conversations', cid), {
          participants: [user.uid, ownerUid],
          businessId: businessId,
          forBusiness: true,
          customerUid: user.uid,
          ownerUid: ownerUid,
          type: 'customer_business',
          customerActorId: 'user_' + user.uid,
          pageActorId: 'business_' + businessId,
          inboxActorIds: ['user_' + user.uid, 'business_' + businessId],
          memberUids: [user.uid, ownerUid],
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          lastMessage: '',
          unreadFor: [],
          readBy: {}
        }, { merge: true }).then(function () {
          if (callback) callback(cid);
        }).catch(function (err) {
          console.error('[GeoSocial] startBusinessConversation', err);
          toast('Could not open business messages.', 'error');
        });
      });
    }

    function sendMessage(conversationId, text, callback, extra) {
      extra = extra || {};
      var cleanText = String(text || '').trim();
      var mediaUrl = String(extra.mediaUrl || '').trim();
      var mediaType = String(extra.mediaType || extra.type || '').trim();
      var fileName = String(extra.fileName || '').trim();
      var fileSize = Number(extra.fileSize || 0) || 0;
      var attachments = Array.isArray(extra.attachments) ? extra.attachments.filter(function(a){ return a && a.url; }).map(function(a){
        return {
          type: String(a.type || '').trim() || 'file',
          url: String(a.url || '').trim(),
          name: String(a.name || '').trim(),
          size: Number(a.size || 0) || 0,
          mime: String(a.mime || '').trim(),
          duration: Number(a.duration || 0) || 0,
          createdAt: a.createdAt || Date.now()
        };
      }) : [];
      var replyTo = extra.replyTo && typeof extra.replyTo === 'object' ? extra.replyTo : null;
      if (!cleanText && !mediaUrl && !attachments.length) return;
      requireAuth(function (user) {
        var me = meData() || {};
        var convRef = doc(db, 'conversations', conversationId);
        getDoc(convRef).then(function (snap) {
          if (!snap.exists()) throw new Error('Conversation not found');
          var conv = snap.data() || {};
          var otherId = (conv.participants || []).find(function (id) { return id !== user.uid; });
          var firstAttachment = attachments[0] || null;
          var preview = cleanText || (firstAttachment && firstAttachment.type === 'image' ? '📷 Photo' : (firstAttachment && firstAttachment.type === 'audio' ? 'Voice message' : (fileName || (firstAttachment && firstAttachment.name) ? '📎 ' + (fileName || firstAttachment.name) : 'Attachment')));
          var senderActorType = extra.senderActorType || 'user';
          // Canonical actor ID: 'user_{uid}' or 'business_{bizId}' — never raw UID or bizId alone
          var rawActorId = extra.senderActorId || (senderActorType === 'business' ? (extra.businessId || '') : user.uid);
          // Normalise: if caller passed old-format raw UID/bizId, prefix it; if already canonical, keep it
          var senderActorId = (senderActorType === 'business')
            ? (rawActorId.startsWith('business_') ? rawActorId : 'business_' + rawActorId)
            : (rawActorId.startsWith('user_') ? rawActorId : 'user_' + rawActorId);
          var senderName      = extra.senderName || extra.senderDisplayName || me.name || user.displayName || 'GeoHub User';
          var senderAvatar    = extra.senderAvatar    || me.avatar || '';
          var messageDoc = {
            conversationId: conversationId,
            senderId: user.uid,
            authorId: user.uid,
            performedByUid: user.uid,
            senderActorType: senderActorType,
            senderActorId:   senderActorId,
            senderActorKey:  (senderActorType === 'business' ? 'business:' : 'user:') + rawActorId,
            senderDisplayName: senderName,
            senderName:      senderName,
            senderAvatar:    senderAvatar,
            text: cleanText,
            mediaUrl: mediaUrl || '',
            mediaType: mediaType || '',
            fileName: fileName || '',
            fileSize: fileSize,
            attachments: attachments,
            replyTo: replyTo,
            likedBy: [],
            readBy: [user.uid],
            seenBy: [user.uid],
            readByActors: [senderActorId],
            seenByActors: [senderActorId],
            deletedFor: [],
            delivered: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };
          return addDoc(collection(db, 'conversations', conversationId, 'messages'), messageDoc).then(function () {
            var patch = { lastMessage: preview, lastSenderId: user.uid, lastMessageSenderActorId: senderActorId, updatedAt: serverTimestamp() };
            patch['readBy.' + user.uid] = serverTimestamp();
            patch['readByActors.' + senderActorId] = serverTimestamp();
            patch['typingActors.' + senderActorId] = null;
            patch['typingUsers.' + user.uid] = null;
            // Restore conversation for all relevant actors:
            // - Sender: unarchive/unhide/undelete their own view
            // - Recipients: unarchive/unhide so new message returns conv to their inbox
            //   (covers "if other side sends a message, conv returns to inbox" behavior)
            var inboxActors = Array.isArray(conv.inboxActorIds) ? conv.inboxActorIds : [];
            var _restoreActors = inboxActors.length ? inboxActors : [senderActorId];
            var _restoreKeys = []; // canonical + legacy-colon format
            _restoreActors.forEach(function(a) {
              _restoreKeys.push(a);
              _restoreKeys.push(a.startsWith('business_') ? 'business:' + a.slice(9) : 'user:' + a.slice(5));
            });
            patch.archivedForActors = fs.arrayRemove.apply(null, _restoreActors);
            patch.hiddenForActors   = fs.arrayRemove.apply(null, _restoreKeys);
            patch.deletedForActors  = fs.arrayRemove.apply(null, _restoreActors);
            var existingUnreadActors = Array.isArray(conv.unreadActors) ? conv.unreadActors.slice() : [];
            var nextUnreadActors = existingUnreadActors.filter(function(a) { return a !== senderActorId; });
            function addUnreadActor(a) {
              if (a && a !== senderActorId && nextUnreadActors.indexOf(a) === -1) nextUnreadActors.push(a);
            }
            // Determine who gets the unread badge using canonical inboxActorIds where available
            if(inboxActors.length) {
              // Canonical: all inbox actors except the sender
              var recipients = inboxActors.filter(function(a) { return a !== senderActorId; });
              recipients.forEach(addUnreadActor);
              // Also keep legacy unreadFor (uid-based) for backward compat
              var unreadTarget;
              if(conv.businessId && conv.forBusiness){
                unreadTarget = senderActorType === 'business' ? (conv.customerUid || '') : (conv.ownerUid || otherId || '');
              } else {
                unreadTarget = otherId || '';
              }
              if(unreadTarget && unreadTarget !== user.uid) patch.unreadFor = fs.arrayUnion(unreadTarget);
            } else {
              // Fallback for docs without inboxActorIds
              var unreadTarget;
              if(conv.businessId && conv.forBusiness){
                unreadTarget = senderActorType === 'business' ? (conv.customerUid || '') : (conv.ownerUid || otherId || '');
                var actorKeyOld = senderActorType === 'business' ? 'user:' + (conv.customerUid || user.uid) : 'business:' + conv.businessId;
                var actorKeyNew = senderActorType === 'business' ? 'user_' + (conv.customerUid || user.uid) : 'business_' + conv.businessId;
                addUnreadActor(actorKeyOld);
                addUnreadActor(actorKeyNew);
              } else {
                unreadTarget = otherId || '';
                addUnreadActor('user_' + unreadTarget);
              }
              if(unreadTarget && unreadTarget !== user.uid) patch.unreadFor = fs.arrayUnion(unreadTarget);
            }
            patch.unreadActors = nextUnreadActors;
            return updateDoc(convRef, patch);
          }).then(function () {
            // Determine notification target and link based on sender actor type
            var notifTargetUid, notifLink;
            if(conv.businessId && conv.forBusiness) {
              if(senderActorType === 'business') {
                // Page replying to customer — send customer to withBusiness route
                notifTargetUid = conv.customerUid || otherId;
                notifLink = 'messages.html?withBusiness=' + encodeURIComponent(conv.businessId) + '&cid=' + encodeURIComponent(conversationId);
              } else {
                // Customer sending to business — send owner to business inbox
                notifTargetUid = otherId;
                notifLink = 'messages.html?business=' + encodeURIComponent(conv.businessId) + '&cid=' + encodeURIComponent(conversationId);
                return createActorNotification('business', conv.businessId, 'message', senderName + ' sent your page a message', preview, notifLink, {
                  conversationId: conversationId,
                  businessId: conv.businessId,
                  ownerUid: conv.ownerUid || notifTargetUid || ''
                });
              }
            } else {
              notifTargetUid = otherId;
              notifLink = 'messages.html?with=' + encodeURIComponent(user.uid);
            }
            // Skip self-notification (same uid on both sides, e.g. owner messaging own page as customer)
            if(!notifTargetUid || notifTargetUid === user.uid) return Promise.resolve();
            return createNotification(notifTargetUid, 'message', senderName + ' sent you a message', preview, notifLink, { conversationId: conversationId });
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

    // ── Phase 61C: normalize a raw conversation doc to ensure all actor fields ─
    function normalizeConv(id, data, uid) {
      var n = Object.assign({ id: id }, data);
      if (!Array.isArray(n.participants)) n.participants = [];
      if (!Array.isArray(n.memberUids)) n.memberUids = n.participants.slice();
      if (n.forBusiness && n.businessId) {
        n.type = n.type || 'customer_business';
        n.pageActorId = n.pageActorId || ('business_' + n.businessId);
        // customerUid: prefer stored value, else find the non-owner participant
        var custUid = n.customerUid ||
          n.participants.find(function(p) { return p !== n.ownerUid; }) ||
          uid;
        n.customerUid = custUid;
        n.customerActorId = n.customerActorId || ('user_' + custUid);
        if (!Array.isArray(n.inboxActorIds) || !n.inboxActorIds.length) {
          n.inboxActorIds = [n.customerActorId, n.pageActorId];
        }
      } else {
        n.type = n.type || 'direct';
        if (!Array.isArray(n.inboxActorIds) || !n.inboxActorIds.length) {
          n.inboxActorIds = n.participants.filter(Boolean).map(function(u) { return 'user_' + u; });
        }
      }
      return n;
    }

    // ── Phase 61C: unified listener — rules-compatible query, client-side filter ─
    // Query uses memberUids (safe per rules) + participants (legacy fallback).
    // Actor separation is done entirely in client code by checking inboxActorIds.
    function listenActorConversations(actorId, callback) {
      var uid = currentUid();
      var _dbg = (typeof location !== 'undefined' && new URLSearchParams(location.search).get('debugMessages') === '1');
      if (!uid) { callback([]); return function () {}; }

      function tsOf(v) { return v && v.toMillis ? v.toMillis() : (v && v.seconds ? v.seconds * 1000 : 0); }
      function sortConvs(items) {
        return items.sort(function(a, b) {
          return tsOf(b.updatedAt || b.lastMessageAt || b.createdAt) -
                 tsOf(a.updatedAt || a.lastMessageAt || a.createdAt);
        });
      }

      function flush(pool) {
        var all = Object.values(pool);
        var normalized = all.map(function(d) { return normalizeConv(d.id, d, uid); });
        // Legacy-colon format: 'user:UID' or 'business:BIZID'
        var actorIdLegacy = actorId.startsWith('business_') ? 'business:' + actorId.slice(9) : 'user:' + actorId.slice(5);
        var filtered = normalized.filter(function(d) {
          // Must include actorId in inboxActorIds (client-side actor separation)
          if (!Array.isArray(d.inboxActorIds) || d.inboxActorIds.indexOf(actorId) === -1) {
            if (_dbg) console.log('[GeoSocial] exclude', d.id, 'inboxActorIds=', d.inboxActorIds, 'actorId=', actorId);
            return false;
          }
          // Exclude if hidden for this actor (check both canonical and legacy-colon formats)
          if (Array.isArray(d.hiddenForActors) &&
              (d.hiddenForActors.indexOf(actorId) !== -1 || d.hiddenForActors.indexOf(actorIdLegacy) !== -1)) {
            if (_dbg) console.log('[GeoSocial] exclude', d.id, 'hidden for', actorId);
            return false;
          }
          // Exclude if deleted for this actor (canonical format only — new field)
          if (Array.isArray(d.deletedForActors) && d.deletedForActors.indexOf(actorId) !== -1) {
            if (_dbg) console.log('[GeoSocial] exclude', d.id, 'deleted for', actorId);
            return false;
          }
          if (_dbg) console.log('[GeoSocial] include', d.id, 'inboxActorIds=', d.inboxActorIds);
          return true;
        });
        callback(sortConvs(filtered));
      }

      var pool = {};
      // Primary query: memberUids array-contains uid (rules: uid() in memberUids — always safe)
      var qMember = query(collection(db, 'conversations'), where('memberUids', 'array-contains', uid), limit(60));
      // Fallback query: participants array-contains uid (legacy docs without memberUids)
      var qParts  = query(collection(db, 'conversations'), where('participants', 'array-contains', uid), limit(60));

      if (_dbg) console.log('[GeoSocial] listenActorConversations', {actorId: actorId, uid: uid, querySource: 'memberUids+participants'});

      var unsubMember = onSnapshot(qMember, function(snap) {
        snap.docChanges().forEach(function(ch) {
          if (ch.type === 'removed') { delete pool[ch.doc.id]; return; }
          pool[ch.doc.id] = Object.assign({ id: ch.doc.id }, ch.doc.data());
        });
        flush(pool);
      }, function(err) { console.warn('[GeoSocial] listenActorConversations(memberUids)', err.message); });

      var unsubParts = onSnapshot(qParts, function(snap) {
        snap.docChanges().forEach(function(ch) {
          if (ch.type === 'removed') {
            // Only remove if the memberUids query also doesn't cover this doc
            var existing = pool[ch.doc.id];
            if (existing && Array.isArray(existing.memberUids) && existing.memberUids.indexOf(uid) !== -1) return;
            delete pool[ch.doc.id];
            return;
          }
          var data = ch.doc.data() || {};
          var _isNewEntry = !pool[ch.doc.id];
          // Always update pool data — critical for legacy docs (participants-only, no memberUids)
          // so that hiddenForActors/archivedForActors changes on 'modified' events are reflected
          pool[ch.doc.id] = Object.assign({ id: ch.doc.id }, data);
          if (_isNewEntry && (!data.memberUids || !data.memberUids.length)) {
            lazyBackfillConv(ch.doc.id, data, uid);
          }
        });
        flush(pool);
      }, function(err) { console.warn('[GeoSocial] listenActorConversations(participants)', err.message); });

      return function() { unsubMember(); unsubParts(); };
    }

    function listenConversations(callback) {
      var uid = currentUid();
      if (!uid) { callback([]); return function () {}; }
      return listenActorConversations('user_' + uid, callback);
    }

    function listenBusinessConversations(businessId, callback) {
      if (!businessId) { if (callback) callback([]); return function () {}; }
      return listenActorConversations('business_' + businessId, callback);
    }

    // ── PHASE 57: lazy backfill for old conversations ────────────────────
    function lazyBackfillConv(convId, data, uid) {
      try {
        if (data.inboxActorIds) return; // already migrated
        var parts = data.participants || [];
        var inboxActorIds, type, extraPatch = {};
        if (data.forBusiness && data.businessId) {
          var customerUid = data.customerUid || uid;
          inboxActorIds = ['user_' + customerUid, 'business_' + data.businessId];
          type = 'customer_business';
          extraPatch = {
            customerActorId: 'user_' + customerUid,
            pageActorId: 'business_' + data.businessId,
            customerUid: customerUid
          };
        } else {
          inboxActorIds = parts.filter(Boolean).map(function(u) { return 'user_' + u; });
          type = 'personal';
        }
        var memberUids = parts.slice();
        if (data.ownerUid && memberUids.indexOf(data.ownerUid) === -1) memberUids.push(data.ownerUid);
        updateDoc(doc(db, 'conversations', convId), Object.assign({
          inboxActorIds: inboxActorIds,
          memberUids: memberUids,
          type: type
        }, extraPatch)).catch(function() {});
      } catch(e) {}
    }

    function listenMessages(conversationId, callback) {
      var q = query(collection(db, 'conversations', conversationId, 'messages'), orderBy('createdAt', 'asc'), limit(60));
      return onSnapshot(q, function (snap) {
        var items = [];
        snap.forEach(function (d) { items.push(Object.assign({ id: d.id }, d.data())); });
        callback(items);
      }, function (err) { console.warn('[GeoSocial] listenMessages', err.message); callback([]); });
    }

    function markConversationRead(conversationId, callback, options) {
      var uid = currentUid();
      if (!uid || !conversationId) { if(callback) callback(false); return Promise.resolve(false); }
      var actorId = (options && options.actorId) || (uid ? 'user_' + uid : '');
      var oldActorId = actorId.indexOf('business_') === 0 ? 'business:' + actorId.slice(9) : 'user:' + uid;
      var patch = { unreadFor: fs.arrayRemove(uid), unreadActors: fs.arrayRemove(actorId, oldActorId), updatedAt: serverTimestamp() };
      patch['readBy.' + uid] = serverTimestamp();
      if(actorId) patch['readByActors.' + actorId] = serverTimestamp();
      return updateDoc(doc(db, 'conversations', conversationId), patch)
        .then(function(){ if(callback) callback(true); return true; })
        .catch(function(err){ console.warn('[GeoSocial] markConversationRead', err.message); if(callback) callback(false, err); return false; });
    }

    function reactionDocId(conversationId, messageId, uid) {
      return String(conversationId || '').replace(/[^A-Za-z0-9_-]/g, '_') + '__' +
        String(messageId || '').replace(/[^A-Za-z0-9_-]/g, '_') + '__' +
        String(uid || '').replace(/[^A-Za-z0-9_-]/g, '_');
    }

    function toggleLegacyMessageReaction(conversationId, messageId, emoji, callback) {
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

    function toggleMessageReaction(conversationId, messageId, emoji, callback, options) {
      emoji = emoji || '❤️';
      var uid = currentUid();
      var actorId = (options && options.actorId) || (uid ? 'user_' + uid : '');
      if (!uid || !actorId || !conversationId || !messageId) { if(callback) callback(false); return Promise.resolve(false); }

      var messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      return getDoc(messageRef).then(function(snap){
        if (!snap.exists()) throw new Error('message-not-found');
        var data = snap.data() || {};
        if (data.deleted || data.deletedForEveryone) throw new Error('message-deleted');
        if (Array.isArray(data.deletedFor) && data.deletedFor.indexOf(uid) !== -1) throw new Error('message-hidden');
        if (Array.isArray(data.deletedForActors) && data.deletedForActors.indexOf(actorId) !== -1) throw new Error('message-hidden');

        var current = data.reactions && typeof data.reactions === 'object' && !Array.isArray(data.reactions)
          ? data.reactions[actorId]
          : '';
        var toggledOff = current === emoji;
        var patch = { updatedAt: serverTimestamp() };
        if (toggledOff && deleteField) {
          patch['reactions.' + actorId] = deleteField();
        } else if (toggledOff) {
          var next = Object.assign({}, (data.reactions && typeof data.reactions === 'object' && !Array.isArray(data.reactions)) ? data.reactions : {});
          delete next[actorId];
          patch.reactions = next;
        } else {
          patch['reactions.' + actorId] = emoji;
        }

        return updateDoc(messageRef, patch).then(function(){
          if(callback) callback(!toggledOff);
          return !toggledOff;
        });
      }).catch(function(err){
        console.warn('[GeoSocial] toggleMessageReaction', err.message);
        if(callback) callback(false, err);
        throw err;
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

    function deleteMessage(conversationId, messageId, mode, callback, options) {
      var uid = currentUid();
      if (!uid || !conversationId || !messageId) { if(callback) callback(false); return; }
      // actorId: caller passes via options (preferred) or fall back to canonical user_ form
      var actorId = (options && options.actorId) || ('user_' + uid);
      var ref = doc(db, 'conversations', conversationId, 'messages', messageId);
      var patch;
      if (mode === 'everyone') {
        // Soft-delete for everyone: blank text, keep doc as placeholder
        patch = {
          deletedForEveryone: true,
          deletedAt: serverTimestamp(),
          deletedByActorId: actorId,
          text: '',
          deleted: true,       // legacy compat
          deletedBy: uid,
          updatedAt: serverTimestamp()
        };
      } else {
        // Delete for me: hide only from current actor
        patch = {
          deletedForActors: fs.arrayUnion(actorId),
          deletedFor: fs.arrayUnion(uid),  // legacy compat
          updatedAt: serverTimestamp()
        };
      }
      updateDoc(ref, patch).then(function(){ if(callback) callback(true); })
        .catch(function(err){ console.warn('[GeoSocial] deleteMessage', err.message); toast('Delete failed.', 'error'); if(callback) callback(false, err); });
    }

    function editMessage(conversationId, messageId, newText, callback) {
      var uid = currentUid();
      if (!uid || !conversationId || !messageId) { if(callback) callback(false); return; }
      var ref = doc(db, 'conversations', conversationId, 'messages', messageId);
      updateDoc(ref, { text: String(newText || '').trim(), edited: true, updatedAt: serverTimestamp() })
        .then(function(){ if(callback) callback(true); })
        .catch(function(err){ console.warn('[GeoSocial] editMessage', err.message); toast('Edit failed.', 'error'); if(callback) callback(false, err); });
    }

    function setTyping(conversationId, isTyping, options) {
      var uid = currentUid();
      if (!uid || !conversationId) return;
      var actorId = (options && options.actorId) || (uid ? 'user_' + uid : '');
      var ref = doc(db, 'conversations', conversationId);
      var field = 'typingActors.' + actorId;
      var patch = {};
      if (isTyping) {
        patch[field] = {
          name: (options && options.name) || (meData() || {}).name || 'GeoHub User',
          avatar: (options && options.avatar) || (meData() || {}).avatar || '',
          at: serverTimestamp()
        };
      } else {
        patch[field] = fs.deleteField ? fs.deleteField() : null;
      }
      patch['typingUsers.' + uid] = isTyping ? serverTimestamp() : (fs.deleteField ? fs.deleteField() : null);
      dbgMessages('setTyping', { conversationId: conversationId, actorId: actorId, patch: patch });
      updateDoc(ref, patch).catch(function(e){ dbgMessages('setTyping error', e); console.warn('[GeoSocial] setTyping', e.message); });
    }

    function markMessagesSeen(conversationId, messageIds, callback, options) {
      var uid = currentUid();
      if (!uid || !conversationId || !messageIds || !messageIds.length) return;
      var actorId = (options && options.actorId) || (uid ? 'user_' + uid : '');
      var batch = fs.writeBatch ? fs.writeBatch(db) : null;
      if (!batch) return;
      messageIds.forEach(function(mid){
        var ref = doc(db, 'conversations', conversationId, 'messages', mid);
        batch.update(ref, { seenBy: fs.arrayUnion(uid), readBy: fs.arrayUnion(uid), seenByActors: fs.arrayUnion(actorId), readByActors: fs.arrayUnion(actorId), updatedAt: serverTimestamp() });
      });
      batch.commit().catch(function(e){ console.warn('[GeoSocial] markMessagesSeen', e.message); });
    }

    function setConversationArchive(conversationId, archived, callback) {
      var uid = currentUid();
      if (!uid || !conversationId) { if(callback) callback(false); return; }
      var ref = doc(db, 'userConversationSettings', uid + '_' + conversationId);
      setDoc(ref, { userId: uid, conversationId: conversationId, archived: !!archived, updatedAt: serverTimestamp() }, { merge: true })
        .then(function(){ if(callback) callback(true); })
        .catch(function(err){ console.warn('[GeoSocial] setConversationArchive', err.message); if(callback) callback(false); });
    }

    function setConversationMute(conversationId, mutedUntil, callback) {
      var uid = currentUid();
      if (!uid || !conversationId) { if(callback) callback(false); return; }
      var ref = doc(db, 'userConversationSettings', uid + '_' + conversationId);
      setDoc(ref, { userId: uid, conversationId: conversationId, mutedUntil: mutedUntil || null, updatedAt: serverTimestamp() }, { merge: true })
        .then(function(){ if(callback) callback(true); })
        .catch(function(err){ console.warn('[GeoSocial] setConversationMute', err.message); if(callback) callback(false); });
    }

    function setConversationTheme(conversationId, theme, callback) {
      if (!conversationId) { if(callback) callback(false); return; }
      updateDoc(doc(db, 'conversations', conversationId), { theme: theme || '', updatedAt: serverTimestamp() })
        .then(function(){ if(callback) callback(true); })
        .catch(function(err){ console.warn('[GeoSocial] setConversationTheme', err.message); if(callback) callback(false); });
    }

    function setConversationNickname(conversationId, targetUid, nickname, callback) {
      if (!conversationId) { if(callback) callback(false); return; }
      var patch = {};
      patch['nicknames.' + targetUid] = nickname || '';
      updateDoc(doc(db, 'conversations', conversationId), patch)
        .then(function(){ if(callback) callback(true); })
        .catch(function(err){ console.warn('[GeoSocial] setConversationNickname', err.message); if(callback) callback(false); });
    }

    function listenConversationSettings(conversationId, callback) {
      var uid = currentUid();
      if (!uid || !conversationId) { callback({}); return function(){}; }
      return onSnapshot(doc(db, 'userConversationSettings', uid + '_' + conversationId), function(snap){
        callback(snap.exists() ? (snap.data() || {}) : {});
      }, function(err){ console.warn('[GeoSocial] listenConversationSettings', err.message); callback({}); });
    }

    function uploadAudioBlob(blob, uid, callback) {
      if (!blob || !cloudinaryConfigured()) { if(callback) callback(''); return Promise.resolve(''); }
      var form = new FormData();
      form.append('file', blob, 'voice.webm');
      form.append('upload_preset', GEOHUB_CLOUDINARY.uploadPreset);
      form.append('folder', cloudinaryFolder('voice', uid));
      form.append('resource_type', 'video');
      var apiUrl = 'https://api.cloudinary.com/v1_1/' + encodeURIComponent(GEOHUB_CLOUDINARY.cloudName) + '/video/upload';
      return new Promise(function(resolve){
        var xhr = new XMLHttpRequest();
        xhr.open('POST', apiUrl);
        var timer = setTimeout(function(){ xhr.abort(); }, 30000);
        xhr.onload = function(){
          clearTimeout(timer);
          var body = {};
          try { body = JSON.parse(xhr.responseText); } catch(e) {}
          if (xhr.status >= 200 && xhr.status < 300 && body.secure_url) {
            if(callback) callback(body.secure_url); resolve(body.secure_url);
          } else {
            if(callback) callback(''); resolve('');
          }
        };
        xhr.onerror = function(){ clearTimeout(timer); if(callback) callback(''); resolve(''); };
        xhr.onabort = function(){ clearTimeout(timer); if(callback) callback(''); resolve(''); };
        xhr.send(form);
      });
    }

    function uploadDocumentBlob(blob, filename, uid, callback) {
      if (!blob || !cloudinaryConfigured()) { if(callback) callback(''); return Promise.resolve(''); }
      var form = new FormData();
      form.append('file', blob, filename || 'document');
      form.append('upload_preset', GEOHUB_CLOUDINARY.uploadPreset);
      form.append('folder', cloudinaryFolder('files', uid));
      form.append('resource_type', 'raw');
      var apiUrl = 'https://api.cloudinary.com/v1_1/' + encodeURIComponent(GEOHUB_CLOUDINARY.cloudName) + '/raw/upload';
      return new Promise(function(resolve){
        var xhr = new XMLHttpRequest();
        xhr.open('POST', apiUrl);
        var timer = setTimeout(function(){ xhr.abort(); }, 60000);
        xhr.onload = function(){
          clearTimeout(timer);
          var body = {};
          try { body = JSON.parse(xhr.responseText); } catch(e) {}
          if (xhr.status >= 200 && xhr.status < 300 && body.secure_url) {
            if(callback) callback(body.secure_url); resolve(body.secure_url);
          } else {
            if(callback) callback(''); resolve('');
          }
        };
        xhr.onerror = function(){ clearTimeout(timer); if(callback) callback(''); resolve(''); };
        xhr.onabort = function(){ clearTimeout(timer); if(callback) callback(''); resolve(''); };
        xhr.send(form);
      });
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
        snap.forEach(function (d) {
          var item = Object.assign({ id: d.id }, d.data());
          if (item.status !== 'inactive') items.push(item);
        });
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

    // ── GROUP ADVANCED FEATURES ───────────────────────────────────────────

    // Cover photo upload via Cloudinary
    function uploadGroupCover(groupId, file, callback) {
      requireAuth(function (user) {
        var cfg = window.GEOHUB_CLOUDINARY;
        if (!cfg || !cfg.cloudName || !cfg.uploadPreset) {
          toast('Cloudinary not configured', 'error');
          if (callback) callback(null);
          return;
        }
        var fd = new FormData();
        fd.append('file', file);
        fd.append('upload_preset', cfg.uploadPreset);
        fd.append('folder', 'group_covers');
        fetch('https://api.cloudinary.com/v1_1/' + cfg.cloudName + '/image/upload', { method: 'POST', body: fd })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (!data.secure_url) throw new Error('No URL from Cloudinary');
            return updateDoc(doc(db, 'groups', groupId), { coverUrl: data.secure_url, updatedAt: serverTimestamp() })
              .then(function () { toast('Cover photo updated!'); if (callback) callback(data.secure_url); });
          }).catch(function (err) { console.error('[GeoSocial] uploadGroupCover', err); toast('Cover upload failed', 'error'); if (callback) callback(null); });
      });
    }

    // Group rules CRUD
    function updateGroupRules(groupId, rules, callback) {
      requireAuth(function () {
        updateDoc(doc(db, 'groups', groupId), { rules: rules, updatedAt: serverTimestamp() })
          .then(function () { toast('Rules updated!'); if (callback) callback(true); })
          .catch(function (err) { toast('Failed to update rules', 'error'); if (callback) callback(false); });
      });
    }

    // Invite token generation
    function generateGroupInviteToken(groupId, callback) {
      requireAuth(function () {
        var token = Math.random().toString(36).substr(2, 8);
        updateDoc(doc(db, 'groups', groupId), { inviteToken: token, inviteEnabled: true, updatedAt: serverTimestamp() })
          .then(function () { toast('Invite link generated!'); if (callback) callback(token); })
          .catch(function (err) { toast('Failed', 'error'); if (callback) callback(null); });
      });
    }

    function disableGroupInviteToken(groupId, callback) {
      requireAuth(function () {
        updateDoc(doc(db, 'groups', groupId), { inviteEnabled: false, updatedAt: serverTimestamp() })
          .then(function () { toast('Invite link disabled'); if (callback) callback(true); })
          .catch(function () { if (callback) callback(false); });
      });
    }

    function getGroupByInviteToken(token, callback) {
      getDocs(query(collection(db, 'groups'), where('inviteToken', '==', token), where('inviteEnabled', '==', true), limit(1)))
        .then(function (snap) {
          if (snap.empty) { callback(null); return; }
          var d = snap.docs[0];
          callback(Object.assign({ id: d.id }, d.data()));
        }).catch(function () { callback(null); });
    }

    // Join via invite token — bypasses questions / membership request
    function joinGroupViaInvite(groupId, groupName, callback) {
      requireAuth(function (user) {
        var me = meData() || {};
        var ref = doc(db, 'groupMembers', groupId + '_' + user.uid);
        setDoc(ref, {
          groupId: groupId, groupName: groupName || '', uid: user.uid, userId: user.uid,
          role: 'member', status: 'joined', joinedViaInvite: true,
          joinedAt: serverTimestamp(), createdAt: serverTimestamp()
        }).then(function () {
          return updateDoc(doc(db, 'groups', groupId), { memberCount: increment(1) }).catch(function(){});
        }).then(function () {
          toast('Joined ' + (groupName || 'group') + '!');
          if (callback) callback(true);
        }).catch(function (err) { toast('Failed to join', 'error'); if (callback) callback(false); });
      });
    }

    // Join questions
    function updateGroupJoinQuestions(groupId, questions, callback) {
      requireAuth(function () {
        updateDoc(doc(db, 'groups', groupId), { joinQuestions: questions, updatedAt: serverTimestamp() })
          .then(function () { toast('Questions saved!'); if (callback) callback(true); })
          .catch(function () { toast('Failed', 'error'); if (callback) callback(false); });
      });
    }

    // Submit join request with answers
    function requestJoinGroupWithAnswers(groupId, answers, callback) {
      requireAuth(function (user) {
        var reqRef = doc(db, 'groupJoinRequests', groupId + '__' + user.uid);
        var me = meData() || {};
        setDoc(reqRef, {
          groupId: groupId, userId: user.uid,
          userName: me.name || user.displayName || user.email || 'User',
          userPhoto: me.avatar || user.photoURL || '',
          answers: answers || [],
          status: 'pending',
          createdAt: serverTimestamp()
        }).then(function () {
          toast('Join request sent!');
          if (callback) callback('pending');
          getDoc(doc(db, 'groups', groupId)).then(function (gSnap) {
            if (!gSnap.exists()) return;
            var gd = gSnap.data();
            var ownerId = gd.ownerId || gd.creatorId || gd.userId || '';
            if (ownerId && ownerId !== user.uid) {
              createSystemNotification(ownerId, 'group_join_request', 'New Join Request',
                (me.name || user.displayName || 'Someone') + ' wants to join "' + (gd.name || 'your group') + '"',
                'groups.html?id=' + groupId).catch(function () {});
            }
          }).catch(function () {});
        }).catch(function () { toast('Failed to send request', 'error'); if (callback) callback('error'); });
      });
    }

    // Listen to join requests for a group (owner/admin only)
    function listenGroupJoinRequests(groupId, callback) {
      if (!groupId) { callback([]); return function(){}; }
      var q = query(collection(db, 'groupJoinRequests'), where('groupId', '==', groupId), where('status', '==', 'pending'), limit(50));
      return onSnapshot(q, function (snap) {
        var items = [];
        snap.forEach(function (d) { items.push(Object.assign({ id: d.id }, d.data())); });
        callback(items);
      }, function () { callback([]); });
    }

    // Approve / decline join request
    function approveJoinRequest(groupId, requestId, userId, callback) {
      requireAuth(function (user) {
        var me = meData() || {};
        var reqRef = doc(db, 'groupJoinRequests', requestId);
        updateDoc(reqRef, { status: 'approved', approvedBy: user.uid, approvedAt: serverTimestamp() })
          .then(function () {
            return setDoc(doc(db, 'groupMembers', groupId + '_' + userId), {
              groupId: groupId, uid: userId, userId: userId,
              role: 'member', status: 'joined',
              joinedAt: serverTimestamp(), createdAt: serverTimestamp()
            });
          }).then(function () {
            return updateDoc(doc(db, 'groups', groupId), { memberCount: increment(1) }).catch(function(){});
          }).then(function () {
            toast('Member approved!');
            if (callback) callback(true);
            getDoc(doc(db, 'groups', groupId)).then(function (gSnap) {
              var gName = gSnap.exists() ? (gSnap.data().name || 'the group') : 'the group';
              createSystemNotification(userId, 'group_approved', 'Join Request Approved',
                'You have been approved to join "' + gName + '"',
                'groups.html?id=' + groupId).catch(function () {});
            }).catch(function () {});
          })
          .catch(function () { toast('Failed', 'error'); if (callback) callback(false); });
      });
    }

    function declineJoinRequest(requestId, callback) {
      requireAuth(function () {
        var reqRef = doc(db, 'groupJoinRequests', requestId);
        var _tuid = '', _gid = '';
        getDoc(reqRef).then(function (reqSnap) {
          if (reqSnap.exists()) { _tuid = reqSnap.data().userId || ''; _gid = reqSnap.data().groupId || ''; }
          return deleteDoc(reqRef);
        }).then(function () {
          toast('Request declined');
          if (callback) callback(true);
          if (_tuid && _gid) {
            getDoc(doc(db, 'groups', _gid)).then(function (gSnap) {
              var gName = gSnap.exists() ? (gSnap.data().name || 'the group') : 'the group';
              createSystemNotification(_tuid, 'group_declined', 'Join Request',
                'Your request to join "' + gName + '" was not approved.',
                'groups.html').catch(function () {});
            }).catch(function () {});
          }
        }).catch(function () { toast('Failed', 'error'); if (callback) callback(false); });
      });
    }

    // Member role management
    function setGroupMemberRole(groupId, targetUserId, role, callback) {
      requireAuth(function () {
        var validRoles = ['owner', 'admin', 'moderator', 'member'];
        if (validRoles.indexOf(role) === -1) { toast('Invalid role', 'error'); return; }
        updateDoc(doc(db, 'groupMembers', groupId + '_' + targetUserId), { role: role, updatedAt: serverTimestamp() })
          .then(function () { toast('Role updated to ' + role); if (callback) callback(true); })
          .catch(function () { toast('Failed to update role', 'error'); if (callback) callback(false); });
      });
    }

    // Get current user's role in group
    function getGroupMemberRole(groupId, callback) {
      var uid = currentUid();
      if (!uid) { callback(null); return; }
      getDoc(doc(db, 'groupMembers', groupId + '_' + uid))
        .then(function (d) { callback(d.exists() ? (d.data().role || 'member') : null); })
        .catch(function () { callback(null); });
    }

    // Ban a member
    function banGroupMember(groupId, targetUserId, reason, days, callback) {
      requireAuth(function (user) {
        var bannedUntil = days === 0 ? null : new Date(Date.now() + days * 86400000);
        var banRef = doc(db, 'groups', groupId, 'bans', targetUserId);
        setDoc(banRef, {
          userId: targetUserId, reason: reason || '', days: days,
          bannedUntil: bannedUntil ? fs.Timestamp ? fs.Timestamp.fromDate(bannedUntil) : bannedUntil.toISOString() : null,
          permanent: days === 0, bannedBy: user.uid, createdAt: serverTimestamp()
        }).then(function () {
          return deleteDoc(doc(db, 'groupMembers', groupId + '_' + targetUserId)).catch(function(){});
        }).then(function () {
          return updateDoc(doc(db, 'groups', groupId), { memberCount: increment(-1) }).catch(function(){});
        }).then(function () { toast('Member banned'); if (callback) callback(true); })
          .catch(function () { toast('Failed to ban', 'error'); if (callback) callback(false); });
      });
    }

    // Remove member (no ban)
    function removeGroupMember(groupId, targetUserId, callback) {
      requireAuth(function () {
        deleteDoc(doc(db, 'groupMembers', groupId + '_' + targetUserId))
          .then(function () {
            return updateDoc(doc(db, 'groups', groupId), { memberCount: increment(-1) }).catch(function(){});
          }).then(function () { toast('Member removed'); if (callback) callback(true); })
          .catch(function () { toast('Failed to remove', 'error'); if (callback) callback(false); });
      });
    }

    // Leave group (for current user)
    function leaveGroup(groupId, callback) {
      requireAuth(function (user) {
        var ref = doc(db, 'groupMembers', groupId + '_' + user.uid);
        deleteDoc(ref).then(function () {
          return updateDoc(doc(db, 'groups', groupId), { memberCount: increment(-1) }).catch(function(){});
        }).then(function () { toast('You left the group'); if (callback) callback(true); })
          .catch(function () { toast('Failed to leave', 'error'); if (callback) callback(false); });
      });
    }

    // Post approval queue
    function updateGroupPostApproval(groupId, enabled, callback) {
      requireAuth(function () {
        updateDoc(doc(db, 'groups', groupId), { postApproval: enabled, updatedAt: serverTimestamp() })
          .then(function () { toast('Post approval ' + (enabled ? 'enabled' : 'disabled')); if (callback) callback(true); })
          .catch(function () { if (callback) callback(false); });
      });
    }

    function listenPendingGroupPosts(groupId, callback) {
      var q = query(collection(db, 'posts'), where('targetId', '==', groupId), where('targetType', '==', 'group'), where('status', '==', 'pending'), limit(30));
      return onSnapshot(q, function (snap) {
        var items = [];
        snap.forEach(function (d) { items.push(Object.assign({ id: d.id }, d.data())); });
        callback(items);
      }, function () { callback([]); });
    }

    function approveGroupPost(postId, callback) {
      requireAuth(function () {
        updateDoc(doc(db, 'posts', postId), { status: 'active', approvedAt: serverTimestamp() })
          .then(function () { toast('Post approved!'); if (callback) callback(true); })
          .catch(function () { toast('Failed', 'error'); if (callback) callback(false); });
      });
    }

    function declineGroupPost(postId, callback) {
      requireAuth(function () {
        updateDoc(doc(db, 'posts', postId), { status: 'declined', declinedAt: serverTimestamp() })
          .then(function () { toast('Post declined'); if (callback) callback(true); })
          .catch(function () { toast('Failed', 'error'); if (callback) callback(false); });
      });
    }

    // Announcements / pinned posts
    function pinGroupPost(groupId, postId, callback) {
      requireAuth(function () {
        getDoc(doc(db, 'groups', groupId)).then(function (d) {
          var data = d.exists() ? d.data() : {};
          var pinned = data.pinnedPostIds || [];
          if (pinned.indexOf(postId) === -1) pinned.unshift(postId);
          pinned = pinned.slice(0, 5); // max 5 pinned
          return updateDoc(doc(db, 'groups', groupId), { pinnedPostIds: pinned, updatedAt: serverTimestamp() });
        }).then(function () {
          return updateDoc(doc(db, 'posts', postId), { pinned: true, updatedAt: serverTimestamp() }).catch(function(){});
        }).then(function () { toast('Post pinned!'); if (callback) callback(true); })
          .catch(function () { toast('Failed to pin', 'error'); if (callback) callback(false); });
      });
    }

    function unpinGroupPost(groupId, postId, callback) {
      requireAuth(function () {
        getDoc(doc(db, 'groups', groupId)).then(function (d) {
          var data = d.exists() ? d.data() : {};
          var pinned = (data.pinnedPostIds || []).filter(function (id) { return id !== postId; });
          return updateDoc(doc(db, 'groups', groupId), { pinnedPostIds: pinned, updatedAt: serverTimestamp() });
        }).then(function () {
          return updateDoc(doc(db, 'posts', postId), { pinned: false, updatedAt: serverTimestamp() }).catch(function(){});
        }).then(function () { toast('Post unpinned'); if (callback) callback(true); })
          .catch(function () { toast('Failed', 'error'); if (callback) callback(false); });
      });
    }

    // Group Events
    function createGroupEvent(groupId, data, callback) {
      requireAuth(function (user) {
        var me = meData() || {};
        addDoc(collection(db, 'groups', groupId, 'events'), {
          name: (data.name || '').trim(),
          description: (data.description || '').trim(),
          location: (data.location || '').trim(),
          date: data.date || '',
          coverUrl: data.coverUrl || '',
          creatorId: user.uid,
          creatorName: me.name || user.displayName || 'GeoHub User',
          rsvpCount: 0,
          groupId: groupId,
          createdAt: serverTimestamp()
        }).then(function (ref) { toast('Event created!'); if (callback) callback(ref.id); })
          .catch(function (err) { console.error('[GeoSocial] createGroupEvent', err); toast('Failed to create event', 'error'); if (callback) callback(null); });
      });
    }

    function listenGroupEvents(groupId, callback) {
      if (!groupId) { callback([]); return function(){}; }
      var q = query(collection(db, 'groups', groupId, 'events'), orderBy('date', 'asc'), limit(30));
      return onSnapshot(q, function (snap) {
        var items = [];
        snap.forEach(function (d) { items.push(Object.assign({ id: d.id }, d.data())); });
        callback(items);
      }, function () { callback([]); });
    }

    function rsvpGroupEvent(groupId, eventId, status, callback) {
      requireAuth(function (user) {
        var me = meData() || {};
        var rsvpRef = doc(db, 'groups', groupId, 'events', eventId, 'rsvps', user.uid);
        setDoc(rsvpRef, {
          userId: user.uid, userName: me.name || user.displayName || 'User',
          status: status || 'going', createdAt: serverTimestamp()
        }).then(function () { toast('RSVP: ' + (status || 'going')); if (callback) callback(true); })
          .catch(function () { toast('RSVP failed', 'error'); if (callback) callback(false); });
      });
    }

    // Group Files
    function uploadGroupFile(groupId, file, callback) {
      requireAuth(function (user) {
        var me = meData() || {};
        var cfg = window.GEOHUB_CLOUDINARY;
        if (!cfg || !cfg.cloudName || !cfg.uploadPreset) {
          toast('Cloudinary not configured', 'error');
          if (callback) callback(null);
          return;
        }
        var fd = new FormData();
        fd.append('file', file);
        fd.append('upload_preset', cfg.uploadPreset);
        fd.append('folder', 'group_files');
        var resourceType = file.type && file.type.startsWith('image') ? 'image' : 'raw';
        fetch('https://api.cloudinary.com/v1_1/' + cfg.cloudName + '/' + resourceType + '/upload', { method: 'POST', body: fd })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (!data.secure_url) throw new Error('No URL');
            return addDoc(collection(db, 'groups', groupId, 'files'), {
              name: file.name, size: file.size, type: file.type,
              url: data.secure_url, uploaderId: user.uid,
              uploaderName: me.name || user.displayName || 'User',
              createdAt: serverTimestamp()
            });
          }).then(function (ref) { toast('File uploaded!'); if (callback) callback(ref.id); })
          .catch(function (err) { console.error('[GeoSocial] uploadGroupFile', err); toast('Upload failed', 'error'); if (callback) callback(null); });
      });
    }

    function listenGroupFiles(groupId, callback) {
      if (!groupId) { callback([]); return function(){}; }
      var q = query(collection(db, 'groups', groupId, 'files'), orderBy('createdAt', 'desc'), limit(50));
      return onSnapshot(q, function (snap) {
        var items = [];
        snap.forEach(function (d) { items.push(Object.assign({ id: d.id }, d.data())); });
        callback(items);
      }, function () { callback([]); });
    }

    function deleteGroupFile(groupId, fileId, callback) {
      requireAuth(function () {
        deleteDoc(doc(db, 'groups', groupId, 'files', fileId))
          .then(function () { toast('File deleted'); if (callback) callback(true); })
          .catch(function () { toast('Failed to delete', 'error'); if (callback) callback(false); });
      });
    }

    // Group Chat
    function sendGroupChatMessage(groupId, text, callback) {
      requireAuth(function (user) {
        var me = meData() || {};
        if (!text || !text.trim()) return;
        addDoc(collection(db, 'groups', groupId, 'chatMessages'), {
          text: text.trim(), senderId: user.uid,
          senderName: me.name || user.displayName || 'User',
          senderAvatar: me.avatar || user.photoURL || '',
          createdAt: serverTimestamp()
        }).then(function (ref) { if (callback) callback(ref.id); })
          .catch(function (err) { console.error('[GeoSocial] sendGroupChatMessage', err); toast('Failed to send', 'error'); });
      });
    }

    function listenGroupChat(groupId, callback) {
      if (!groupId) { callback([]); return function(){}; }
      var q = query(collection(db, 'groups', groupId, 'chatMessages'), orderBy('createdAt', 'asc'), limit(50));
      return onSnapshot(q, function (snap) {
        var items = [];
        snap.forEach(function (d) { items.push(Object.assign({ id: d.id }, d.data())); });
        callback(items);
      }, function () { callback([]); });
    }

    function deleteGroupChatMessage(groupId, msgId, callback) {
      requireAuth(function () {
        deleteDoc(doc(db, 'groups', groupId, 'chatMessages', msgId))
          .then(function () { if (callback) callback(true); })
          .catch(function () { if (callback) callback(false); });
      });
    }

    // Group Insights
    function getGroupInsights(groupId, callback) {
      if (!groupId) { callback(null); return; }
      var thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
      var sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
      var tsFrom30 = { seconds: Math.floor(thirtyDaysAgo.getTime() / 1000), nanoseconds: 0 };
      var tsFrom7 = { seconds: Math.floor(sevenDaysAgo.getTime() / 1000), nanoseconds: 0 };
      Promise.all([
        getDocs(query(collection(db, 'posts'), where('targetId', '==', groupId), where('targetType', '==', 'group'), where('createdAt', '>=', tsFrom30), limit(100))),
        getDocs(query(collection(db, 'groupMembers'), where('groupId', '==', groupId), limit(200)))
      ]).then(function (res) {
        var recentPosts = res[0];
        var members = res[1];
        var postCount30 = recentPosts.size;
        var authorIds = {};
        recentPosts.forEach(function (d) { var uid = d.data().userId || d.data().authorId; if (uid) authorIds[uid] = (authorIds[uid] || 0) + 1; });
        var topContributors = Object.keys(authorIds).map(function (uid) { return { uid: uid, count: authorIds[uid] }; }).sort(function (a, b) { return b.count - a.count; }).slice(0, 5);
        callback({
          memberCount: members.size,
          postCount30: postCount30,
          topContributors: topContributors
        });
      }).catch(function (err) { console.error('[GeoSocial] getGroupInsights', err); callback(null); });
    }

    // Group notification mute
    function setGroupMute(groupId, muted, callback) {
      requireAuth(function (user) {
        var ref = doc(db, 'groupMembers', groupId + '_' + user.uid);
        updateDoc(ref, { muted: muted, updatedAt: serverTimestamp() })
          .then(function () { toast(muted ? 'Group muted' : 'Group unmuted'); if (callback) callback(true); })
          .catch(function () { if (callback) callback(false); });
      });
    }

    function getGroupMuteStatus(groupId, callback) {
      var uid = currentUid();
      if (!uid) { callback(false); return; }
      getDoc(doc(db, 'groupMembers', groupId + '_' + uid))
        .then(function (d) { callback(d.exists() ? !!(d.data().muted) : false); })
        .catch(function () { callback(false); });
    }

    // Update group settings (privacy, postApproval, name, desc, category)
    function updateGroupSettings(groupId, settings, callback) {
      requireAuth(function () {
        var allowed = ['name', 'description', 'category', 'privacy', 'postApproval', 'rules', 'joinQuestions', 'coverUrl', 'inviteToken', 'inviteEnabled', 'pinnedPostIds', 'updatedAt'];
        var upd = { updatedAt: serverTimestamp() };
        Object.keys(settings).forEach(function (k) { if (allowed.indexOf(k) !== -1) upd[k] = settings[k]; });
        updateDoc(doc(db, 'groups', groupId), upd)
          .then(function () { toast('Settings saved!'); if (callback) callback(true); })
          .catch(function (err) { toast('Failed to save: ' + (err.code || err.message), 'error'); if (callback) callback(false); });
      });
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
      addDoc(collection(db, 'placeReviews'), {
        placeId: placeId,
        userId: user.uid,
        userName: user.displayName || user.email || 'User',
        userPhoto: user.photoURL || '',
        rating: rating,
        comment: (comment || '').trim(),
        createdAt: serverTimestamp()
      }).then(function () {
        toast('Review submitted!');
        updateDoc(doc(db, 'places', placeId), { reviewCount: increment(1), updatedAt: serverTimestamp() }).catch(function(){});
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
      var empty = { users:[], groups:[], places:[], posts:[], businesses:[], events:[], services:[], rewards:[], creators:[], learningItems:[] };
      if (!q_str || !q_str.trim()) { callback(empty); return; }
      var needle   = q_str.trim();
      var nLow     = needle.toLowerCase();
      var nCap     = nLow.charAt(0).toUpperCase() + nLow.slice(1);

      function matchNeedle(obj) {
        var hay = [obj.name, obj.title, obj.fullName, obj.displayName, obj.username,
                   obj.email, obj.text, obj.description, obj.desc, obj.category,
                   obj.city, obj.address].join(' ').toLowerCase();
        return hay.includes(nLow);
      }

      function prefixSnap(col, field, start) {
        var end = start + '';
        return getDocs(query(collection(db, col), where(field, '>=', start), where(field, '<=', end), limit(25)))
          .then(function(snap) {
            var items = [];
            snap.forEach(function(d) { items.push(Object.assign({ id: d.id }, d.data())); });
            return items;
          }).catch(function() { return []; });
      }

      function scanFallback(col) {
        return getDocs(query(collection(db, col), limit(100))).then(function(snap) {
          var items = [];
          snap.forEach(function(d) {
            var x = Object.assign({ id: d.id }, d.data());
            if (matchNeedle(x)) items.push(x);
          });
          return items;
        }).catch(function() { return []; });
      }

      function dedup(arr) {
        var seen = {};
        return arr.filter(function(x) { if (seen[x.id]) return false; seen[x.id] = 1; return true; });
      }
      function isDeletedBiz(b) {
        return !b || b.status === 'deleted' || b.deleted === true || !!b.deletedAt;
      }

      function searchCol(col, fields) {
        if (!fields.length) return scanFallback(col);
        var promises = [];
        fields.forEach(function(f) {
          promises.push(prefixSnap(col, f, nLow));
          if (nCap !== nLow) promises.push(prefixSnap(col, f, nCap));
        });
        return Promise.all(promises).then(function(arrays) {
          var combined = dedup([].concat.apply([], arrays));
          return combined.length ? combined : scanFallback(col);
        });
      }

      var r = Object.assign({}, empty);
      var jobs = [
        { key:'users',         col:'users',         fields:['username','fullName','displayName'] },
        { key:'groups',        col:'groups',        fields:['name'] },
        { key:'places',        col:'places',        fields:['name'] },
        { key:'businesses',    col:'businesses',    fields:['name'] },
        { key:'events',        col:'events',        fields:['name','title'] },
        { key:'services',      col:'services',      fields:['name','title'] },
        { key:'rewards',       col:'rewards',       fields:['title','name'] },
        { key:'creators',      col:'creators',      fields:['name','username'] },
        { key:'learningItems', col:'learningItems', fields:['title','name'] },
        { key:'posts',         col:'posts',         fields:[] }
      ];
      var pending = jobs.length;
      function done() { if (--pending === 0) callback(r); }
      jobs.forEach(function(job) {
        searchCol(job.col, job.fields)
          .then(function(items) {
            if (job.key === 'businesses') items = items.filter(function(b){ return !isDeletedBiz(b); });
            r[job.key] = items;
            done();
          })
          .catch(function() { done(); });
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
      cancelFriendRequest:    cancelFriendRequest,
      listenSentFriendRequests: listenSentFriendRequests,
      addCommentReply:        addCommentReply,
      listenCommentReplies:   listenCommentReplies,
      createCheckin:           createCheckin,
      createCheckinFull:           createCheckinFull,
      createStory:             createStory,
      listenStories:           listenStories,
      addStoryReaction:        addStoryReaction,
      removeStoryReaction:     removeStoryReaction,
      addStoryReply:           addStoryReply,
      deleteStory:             deleteStory,
      createNotification:       createNotification,
      createActorNotification:  createActorNotification,
      createSystemNotification: createSystemNotification,
      listenUserNotifications: listenUserNotifications,
      listenActorNotifications: listenActorNotifications,
      markNotificationRead:    markNotificationRead,
      listenUserPosts:         listenUserPosts,
      listenUserCheckins:      listenUserCheckins,
      startConversation:       startConversation,
      startBusinessConversation: startBusinessConversation,
      listenBusinessConversations: listenBusinessConversations,
      sendMessage:             sendMessage,
      listenConversations:     listenConversations,
      listenMessages:          listenMessages,
      markConversationRead:    markConversationRead,
      toggleMessageReaction:   toggleMessageReaction,
      listenMessageReactions:   listenMessageReactions,
      deleteMessage:           deleteMessage,
      editMessage:             editMessage,
      setTyping:               setTyping,
      markMessagesSeen:        markMessagesSeen,
      setConversationArchive:  setConversationArchive,
      setConversationMute:     setConversationMute,
      setConversationTheme:    setConversationTheme,
      setConversationNickname: setConversationNickname,
      listenConversationSettings: listenConversationSettings,
      uploadAudioBlob:         uploadAudioBlob,
      uploadDocumentBlob:      uploadDocumentBlob,
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
      requestJoinGroupWithAnswers: requestJoinGroupWithAnswers,
      checkJoinRequest:        checkJoinRequest,
      getMyJoinRequests:       getMyJoinRequests,
      listenGroupJoinRequests: listenGroupJoinRequests,
      approveJoinRequest:      approveJoinRequest,
      declineJoinRequest:      declineJoinRequest,
      uploadGroupCover:        uploadGroupCover,
      updateGroupRules:        updateGroupRules,
      generateGroupInviteToken: generateGroupInviteToken,
      disableGroupInviteToken: disableGroupInviteToken,
      getGroupByInviteToken:   getGroupByInviteToken,
      joinGroupViaInvite:      joinGroupViaInvite,
      updateGroupJoinQuestions: updateGroupJoinQuestions,
      setGroupMemberRole:      setGroupMemberRole,
      getGroupMemberRole:      getGroupMemberRole,
      banGroupMember:          banGroupMember,
      removeGroupMember:       removeGroupMember,
      leaveGroup:              leaveGroup,
      updateGroupPostApproval: updateGroupPostApproval,
      listenPendingGroupPosts: listenPendingGroupPosts,
      approveGroupPost:        approveGroupPost,
      declineGroupPost:        declineGroupPost,
      pinGroupPost:            pinGroupPost,
      unpinGroupPost:          unpinGroupPost,
      createGroupEvent:        createGroupEvent,
      listenGroupEvents:       listenGroupEvents,
      rsvpGroupEvent:          rsvpGroupEvent,
      rsvpEvent:               rsvpEvent,
      uploadGroupFile:         uploadGroupFile,
      listenGroupFiles:        listenGroupFiles,
      deleteGroupFile:         deleteGroupFile,
      sendGroupChatMessage:    sendGroupChatMessage,
      listenGroupChat:         listenGroupChat,
      deleteGroupChatMessage:  deleteGroupChatMessage,
      getGroupInsights:        getGroupInsights,
      setGroupMute:            setGroupMute,
      getGroupMuteStatus:      getGroupMuteStatus,
      updateGroupSettings:     updateGroupSettings,
      uploadImageDataUrl:      uploadImageDataUrl,
      uploadFile:              uploadFile,
      hidePost:                hidePost,
      blockUser:               blockUser,
      unblockUser:             unblockUser,
      muteUser:                muteUser,
      unmuteUser:              unmuteUser,
      checkBlocking:           checkBlocking,
      checkBlockedBy:          checkBlockedBy,
      checkMuting:             checkMuting,
      listenSafetyPrefs:       listenSafetyPrefs,
      getPrivacySettings:      getPrivacySettings,
      updatePrivacySettings:   updatePrivacySettings,
      getBlockedUsersList:     getBlockedUsersList,
      getMutedUsersList:       getMutedUsersList,
      reportTarget:            reportTarget,
      listenReports:           listenReports,
      updateReportStatus:      updateReportStatus,
      createModerationAction:  createModerationAction,
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
      listenIncomingGifts:     listenIncomingGifts,
      listenSentGifts:         listenSentGifts,
      claimPointGift:          claimPointGift,
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
