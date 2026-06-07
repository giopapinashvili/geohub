/* ================================================================
   GeoHub — Actor System (geo-actors.js)
   Clean, canonical actor module. All actor identity, storage, and
   validation flows through here. Other modules must NOT read
   'gh_active_actor' from localStorage directly — use this API.

   Exposed as: window.GeoActors
   ================================================================ */
(function () {
  'use strict';

  var ACTOR_KEY = 'gh_active_actor';

  /* ── Canonical ID helpers ─────────────────────────────────── */

  function actorIdForUser(uid) {
    return 'user_' + uid;
  }

  function actorIdForBusiness(bizId) {
    return 'business_' + bizId;
  }

  /* ── Actor object constructors ────────────────────────────── */

  function getPersonalActor(uid, userObj) {
    userObj = userObj || {};
    return {
      type: 'user',
      actorId: actorIdForUser(uid),
      uid: uid,
      displayName: userObj.displayName || userObj.fullName || userObj.name || '',
      email: userObj.email || '',
      photoURL: userObj.photoURL || userObj.avatar || ''
    };
  }

  function makeBusinessActor(bizId, bizData, ownerUid) {
    return {
      type: 'business',
      actorId: actorIdForBusiness(bizId),
      businessId: bizId,
      ownerUid: ownerUid || '',
      title: bizData.title || bizData.name || 'Business',
      logoUrl: bizData.logoUrl || bizData.logo || ''
    };
  }

  /* ── Async Firestore helpers ──────────────────────────────── */

  function getFS() {
    return window.GeoFirebase ? { db: window.GeoFirebase.db, fs: window.GeoFirebase.fs } : null;
  }

  async function getBusinessActor(bizId, ownerUid) {
    var gf = getFS();
    if (!gf || !bizId) return null;
    try {
      var snap = await gf.fs.getDoc(gf.fs.doc(gf.db, 'businesses', bizId));
      if (!snap.exists()) return null;
      var data = snap.data() || {};
      if (data.status === 'deleted' || data.deleted === true || data.deletedAt) return null;
      return makeBusinessActor(bizId, data, ownerUid || data.ownerId || '');
    } catch (e) {
      return null;
    }
  }

  async function listAvailableActors(uid) {
    var gf = getFS();
    var personal = getPersonalActor(uid);
    var actors = [personal];
    if (!gf || !uid) return actors;

    try {
      // Query 1: businessAdmins docs
      var adminSnap = await gf.fs.getDocs(gf.fs.query(
        gf.fs.collection(gf.db, 'businessAdmins'),
        gf.fs.where('userId', '==', uid),
        gf.fs.limit(10)
      ));
      var adminIds = [];
      adminSnap.forEach(function (d) {
        var id = d.id.replace('_' + uid, '');
        if (id) adminIds.push(id);
      });

      // Query 2: businesses owned directly
      var ownerSnap = await gf.fs.getDocs(gf.fs.query(
        gf.fs.collection(gf.db, 'businesses'),
        gf.fs.where('ownerId', '==', uid),
        gf.fs.limit(10)
      ));
      var ownerIds = [];
      ownerSnap.forEach(function (d) { ownerIds.push(d.id); });

      // Deduplicate
      var seen = {}, bizIds = [];
      adminIds.concat(ownerIds).forEach(function (id) {
        if (id && !seen[id]) { seen[id] = true; bizIds.push(id); }
      });

      // Fetch each business doc
      var bizActors = await Promise.all(bizIds.map(function (id) {
        return getBusinessActor(id, uid);
      }));
      bizActors.filter(Boolean).forEach(function (a) { actors.push(a); });
    } catch (e) {}

    return actors;
  }

  async function canUseActor(actorId, uid) {
    if (!actorId || !uid) return false;
    if (actorId === actorIdForUser(uid)) return true;
    if (!actorId.startsWith('business_')) return false;
    var bizId = actorId.replace('business_', '');
    var actor = await getBusinessActor(bizId, uid);
    if (!actor) return false;
    // Check ownership or admin role
    if (actor.ownerUid === uid) return true;
    var gf = getFS();
    if (!gf) return false;
    try {
      var adminDoc = await gf.fs.getDoc(gf.fs.doc(gf.db, 'businessAdmins', bizId + '_' + uid));
      return adminDoc.exists();
    } catch (e) {
      return false;
    }
  }

  /* ── Active actor storage ─────────────────────────────────── */

  function getActiveActor() {
    try { return JSON.parse(localStorage.getItem(ACTOR_KEY) || 'null'); } catch (e) { return null; }
  }

  function getActiveActorId() {
    var actor = getActiveActor();
    if (!actor) {
      var uid = window.GeoFirebase && window.GeoFirebase.auth && window.GeoFirebase.auth.currentUser
        ? window.GeoFirebase.auth.currentUser.uid : '';
      return uid ? actorIdForUser(uid) : '';
    }
    if (actor.actorId) return actor.actorId;
    // Upgrade legacy storage format on-the-fly
    if (actor.type === 'business' && actor.businessId) return actorIdForBusiness(actor.businessId);
    if (actor.uid) return actorIdForUser(actor.uid);
    return '';
  }

  function setActiveActor(actor) {
    // Ensure actorId field is always present
    if (actor && !actor.actorId) {
      if (actor.type === 'business' && actor.businessId) {
        actor = Object.assign({}, actor, { actorId: actorIdForBusiness(actor.businessId) });
      } else if (actor.uid) {
        actor = Object.assign({}, actor, { actorId: actorIdForUser(actor.uid) });
      }
    }
    try { localStorage.setItem(ACTOR_KEY, JSON.stringify(actor)); } catch (e) {}
    window.dispatchEvent(new CustomEvent('GeoActorChanged', { detail: actor }));
  }

  function clearActiveActor() {
    try { localStorage.removeItem(ACTOR_KEY); } catch (e) {}
  }

  function onActiveActorChanged(callback) {
    window.addEventListener('GeoActorChanged', function (e) { callback(e.detail); });
  }

  /* ── Validation on page load ──────────────────────────────── */

  async function ensureValidActiveActor(uid) {
    uid = uid || (window.GeoFirebase && window.GeoFirebase.auth && window.GeoFirebase.auth.currentUser
      ? window.GeoFirebase.auth.currentUser.uid : '');
    if (!uid) return;

    var actor = getActiveActor();
    if (!actor || actor.type === 'user') {
      // Always store a proper personal actor with actorId
      if (!actor || !actor.actorId) {
        setActiveActor(getPersonalActor(uid));
      }
      return;
    }

    if (actor.type === 'business' && actor.businessId) {
      var valid = await canUseActor(actorIdForBusiness(actor.businessId), uid);
      if (!valid) {
        // Business deleted or user lost access — fall back to personal
        setActiveActor(getPersonalActor(uid));
        return;
      }
      // Refresh actor data from Firestore and re-save with canonical actorId
      var refreshed = await getBusinessActor(actor.businessId, uid);
      if (refreshed) {
        try { localStorage.setItem(ACTOR_KEY, JSON.stringify(refreshed)); } catch (e) {}
        // Don't dispatch again — we're just refreshing fields, not switching
      }
    }
  }

  /* ── Public API ───────────────────────────────────────────── */

  window.GeoActors = {
    actorIdForUser: actorIdForUser,
    actorIdForBusiness: actorIdForBusiness,
    getPersonalActor: getPersonalActor,
    getBusinessActor: getBusinessActor,
    listAvailableActors: listAvailableActors,
    canUseActor: canUseActor,
    setActiveActor: setActiveActor,
    getActiveActor: getActiveActor,
    getActiveActorId: getActiveActorId,
    clearActiveActor: clearActiveActor,
    onActiveActorChanged: onActiveActorChanged,
    ensureValidActiveActor: ensureValidActiveActor
  };

  console.debug('[GeoActors] module loaded');
})();
