/* GeoHub API client — Firebase Auth + Firestore only. */
(function () {
  'use strict';
  function ok(data) { return { success: true, data: data }; }
  function fail(error, code) { return { success: false, error: error, code: code || 400 }; }
  function fb() { return window.GeoFirebase; }
  function authUser() { return (window.GeoAuth && window.GeoAuth.getCurrentUser && window.GeoAuth.getCurrentUser()) || window.GeoCurrentUser || null; }
  function requireAuth() { var u = authUser(); if (!u) throw { code: 401, message: 'Authentication required' }; return u; }
  function coll(name) { return fb().fs.collection(fb().db, name); }
  function doc(name, id) { return fb().fs.doc(fb().db, name, id); }
  function ts() { return fb().fs.serverTimestamp ? fb().fs.serverTimestamp() : Date.now(); }
  function list(name, field, value, max) {
    return new Promise(function(resolve) {
      var geo = fb(); if (!geo || !geo.db || !geo.fs) return resolve(fail('Firebase unavailable', 503));
      var q = geo.fs.query(geo.fs.collection(geo.db, name), geo.fs.orderBy('createdAt', 'desc'), geo.fs.limit(max || 50));
      if (field && value !== undefined) q = geo.fs.query(geo.fs.collection(geo.db, name), geo.fs.where(field, '==', value), geo.fs.limit(max || 50));
      geo.fs.getDocs(q).then(function(snap){ var arr=[]; snap.forEach(function(d){ arr.push(Object.assign({ id:d.id }, d.data())); }); resolve(ok(arr)); }).catch(function(e){ resolve(fail(e.message, 500)); });
    });
  }
  function add(name, data) {
    return new Promise(function(resolve) {
      try { var u = requireAuth(); var geo = fb(); if (!geo || !geo.db || !geo.fs) return resolve(fail('Firebase unavailable', 503));
        geo.fs.addDoc(geo.fs.collection(geo.db, name), Object.assign({}, data || {}, { userId: u.uid, authorId: u.uid, createdBy: u.uid, createdAt: ts(), updatedAt: ts(), status: (data && data.status) || 'active' }))
          .then(function(ref){ resolve(ok({ id: ref.id })); }).catch(function(e){ resolve(fail(e.message, 500)); });
      } catch(e) { resolve(fail(e.message, e.code)); }
    });
  }
  function login(email, password) { return window.GeoFirebaseAuth.signIn(email, password).then(function(u){ return ok(u); }).catch(function(e){ return fail(e.message, 401); }); }
  function signup(data) { return window.GeoFirebaseAuth.signUp(data.email, data.password, data.fullName).then(function(u){ return ok(u); }).catch(function(e){ return fail(e.message, 400); }); }
  function logout() { return (window.GeoFirebaseAuth ? window.GeoFirebaseAuth.logout() : Promise.resolve()).then(function(){ return ok({}); }); }
  function getCurrentUser() { return Promise.resolve(ok(authUser())); }
  function updateProfile(updates) { return (window.GeoAuth ? window.GeoAuth.updateUser(updates) : Promise.resolve(null)).then(function(u){ return ok(u); }).catch(function(e){ return fail(e.message, 500); }); }
  function getFeed() { return list('posts'); }
  function createPost(data) { return add('posts', data); }
  function createCheckin(placeId, data) { return add('checkins', Object.assign({ placeId: placeId }, data || {})); }
  function getPlaces() { return list('places'); }
  function getPlace(placeId) { var geo=fb(); return geo.fs.getDoc(doc('places', placeId)).then(function(s){ return s.exists()?ok(Object.assign({id:s.id},s.data())):fail('Place not found',404); }); }
  function getRewards() { return list('rewards'); }
  function claimReward(rewardId) { return add('rewardClaims', { rewardId: rewardId }); }
  function getChallenges() { return list('challenges'); }
  function joinChallenge(challengeId) { return add('challengeProgress', { challengeId: challengeId }); }
  function getEvents() { return list('events'); }
  function bookTicket(eventId, quantity) { return add('tickets', { eventId: eventId, quantity: quantity || 1 }); }
  function getMessages(conversationId) { return conversationId ? list('messages', 'conversationId', conversationId) : list('messages'); }
  function sendMessage(conversationId, text, recipientId) { return add('messages', { conversationId: conversationId, text: text, recipientId: recipientId }); }
  function getBusinesses() { return list('businesses'); }
  function createCampaign(data) { return add('campaigns', data); }
  function getCreators() { return list('creators'); }
  function sendCollabOffer(creatorId, offerData) { return add('collabOffers', Object.assign({ creatorId: creatorId }, offerData || {})); }
  function getListings() { return list('realEstateListings'); }
  function requestService(providerId, data) { return add('serviceRequests', Object.assign({ providerId: providerId }, data || {})); }
  function bookLesson(teacherId, data) { return add('lessonBookings', Object.assign({ teacherId: teacherId }, data || {})); }
  function submitReport(targetType, targetId, reason, details) { return add('reports', { targetType: targetType, targetId: targetId, reason: reason, details: details, status: 'pending' }); }
  function getNotifications() { var u=authUser(); return u ? list('userNotifications','userId',u.uid) : Promise.resolve(fail('Authentication required',401)); }
  function markNotificationsRead() { var geo=fb(), u=authUser(); if(!geo||!u) return Promise.resolve(fail('Firebase unavailable or not logged in',503)); return geo.fs.getDocs(geo.fs.query(geo.fs.collection(geo.db,'userNotifications'), geo.fs.where('userId','==',u.uid), geo.fs.where('read','==',false))).then(function(snap){ var batch=geo.fs.writeBatch(geo.db); snap.forEach(function(d){ batch.update(d.ref,{read:true}); }); return batch.commit().then(function(){ return ok({updated:snap.size}); }); }).catch(function(e){ return fail(e.message,500); }); }
  window.GeoAPI = { login, signup, logout, getCurrentUser, updateProfile, getFeed, createPost, createCheckin, getPlaces, getPlace, getRewards, claimReward, getChallenges, joinChallenge, getEvents, bookTicket, getMessages, sendMessage, getBusinesses, createCampaign, getCreators, sendCollabOffer, getListings, requestService, bookLesson, submitReport, getNotifications, markNotificationsRead };
})();
