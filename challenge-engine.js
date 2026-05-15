/* GeoHub Challenges Foundation
   Normalized challenges + per-user progress.
*/
(function () {
  'use strict';

  var ACTIVE_LIMIT = 100;
  var TYPE_LABELS = {
    checkin_count:         'Check-in Count',
    city_checkin:          'City Check-in',
    place_checkin:         'Place Check-in',
    business_checkin:      'Business Check-in',
    date_limited_checkin:  'Time-Limited',
    checkin:  'Check-in',
    photo:    'Photo Proof',
    qr:       'QR Check-in',
    event:    'Event',
    distance: 'Distance'
  };

  var BADGE_DEFAULTS = {
    first_checkin: {
      title: 'First Check-in',
      description: 'Completed your first GeoHub check-in.',
      icon: 'fa-location-dot',
      rarity: 'common'
    }
  };

  function GF() { return window.GeoFirebase; }
  function uid() { return GF() && GF().auth && GF().auth.currentUser ? GF().auth.currentUser.uid : null; }
  function fs() { return GF() && GF().fs; }
  function db() { return GF() && GF().db; }
  function nowMs() { return Date.now(); }
  function toMs(v) {
    if (!v) return 0;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (v.seconds) return v.seconds * 1000;
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'number') return v;
    return Date.parse(v) || 0;
  }
  function clampTarget(challenge) {
    return Math.max(1, Number(challenge && challenge.targetCount || 1));
  }
  function normalizeChallenge(id, data) {
    var c = Object.assign({ id: id }, data || {});
    c.type = String(c.type || 'checkin').toLowerCase();
    c.targetCount = clampTarget(c);
    c.xpReward = Math.max(0, Number(c.xpReward || 0));
    return c;
  }
  function isActiveChallenge(c) {
    if (!c || c.active !== true) return false;
    var now = nowMs();
    var start = toMs(c.startAt);
    var end = toMs(c.endAt);
    if (start && start > now) return false;
    if (end && end < now) return false;
    return true;
  }
  function progressRef(userId, challengeId) {
    return fs().doc(db(), 'users', userId, 'challengeProgress', challengeId);
  }
  function escapeHtml(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function getActiveChallenges() {
    if (!GF() || !db() || !fs()) return Promise.resolve([]);
    var f = fs();
    return f.getDocs(f.query(f.collection(db(), 'challenges'), f.where('active', '==', true), f.limit(ACTIVE_LIMIT)))
      .then(function (snap) {
        var rows = [];
        snap.forEach(function (docSnap) {
          var c = normalizeChallenge(docSnap.id, docSnap.data());
          if (isActiveChallenge(c)) rows.push(c);
        });
        rows.sort(function (a, b) { return toMs(a.endAt) - toMs(b.endAt); });
        return rows;
      });
  }

  function getChallengeCatalog() {
    if (!GF() || !db() || !fs()) return Promise.resolve([]);
    var f = fs();
    return f.getDocs(f.query(f.collection(db(), 'challenges'), f.limit(ACTIVE_LIMIT)))
      .then(function (snap) {
        var rows = [];
        snap.forEach(function (docSnap) { rows.push(normalizeChallenge(docSnap.id, docSnap.data())); });
        rows.sort(function (a, b) { return toMs(a.endAt) - toMs(b.endAt); });
        return rows;
      });
  }

  function getProgressMap(userId) {
    if (!userId || !GF() || !db() || !fs()) return Promise.resolve({});
    var f = fs();
    return f.getDocs(f.collection(db(), 'users', userId, 'challengeProgress')).then(function (snap) {
      var out = {};
      snap.forEach(function (docSnap) { out[docSnap.id] = Object.assign({ id: docSnap.id }, docSnap.data()); });
      return out;
    }).catch(function (err) {
      console.warn('[GeoChallenges] progress load', err.message);
      return {};
    });
  }

  function challengeMatchesCheckin(challenge, checkin) {
    if (!challenge || !checkin) return false;
    var type = String(challenge.type || 'checkin_count').toLowerCase();
    switch (type) {
      case 'checkin_count':
      case 'date_limited_checkin': // date range already enforced by isActiveChallenge
        return true;
      case 'city_checkin':
        return !!challenge.city &&
          String(challenge.city).toLowerCase() === String(checkin.city || '').toLowerCase();
      case 'place_checkin':
        return !!challenge.placeId && challenge.placeId === checkin.placeId;
      case 'business_checkin':
        return !!challenge.businessId && challenge.businessId === checkin.businessId;
      // backward compat — old type names
      case 'checkin':
        return true;
      case 'photo':
        return checkin.verified === true && !!checkin.photoUrl;
      case 'qr':
        return checkin.verified === true &&
          (checkin.checkinType === 'qr' || checkin.verificationMethod === 'qr');
      case 'event':
        return checkin.verified === true && (!!checkin.eventId || !!challenge.eventId);
      case 'distance':
        return checkin.verified === true && Number(checkin.distanceMeters || 0) > 0;
      default:
        return false;
    }
  }

  function proofTypeFor(challenge, checkin) {
    var t = challenge.type || 'checkin_count';
    if (t === 'photo') return 'photo';
    if (t === 'qr') return 'qr';
    if (t === 'event') return 'event';
    var newTypes = ['checkin_count', 'city_checkin', 'place_checkin', 'business_checkin', 'date_limited_checkin'];
    if (newTypes.indexOf(t) !== -1) return t;
    return checkin && checkin.checkinType === 'qr' ? 'qr' : 'checkin';
  }

  function applyCheckinToChallenge(userId, challenge, checkin, checkinId) {
    var f = fs();
    var pRef = progressRef(userId, challenge.id);
    var userRef = f.doc(db(), 'users', userId);
    var target = clampTarget(challenge);

    // Resolve badge ID: new format (badge:true + badgeId:'slug') or old format (badge:'slug')
    var resolvedBadgeId = challenge.badgeId ||
      (typeof challenge.badge === 'string' && challenge.badge ? challenge.badge : null);
    var badgeRef = resolvedBadgeId
      ? f.doc(db(), 'users', userId, 'badges', resolvedBadgeId)
      : null;

    // Source dedup ref — prevents the same check-in from incrementing a challenge twice
    var sourceRef = (checkinId && f.doc)
      ? f.doc(db(), 'users', userId, 'challengeProgress', challenge.id, 'sources', checkinId)
      : null;

    return f.runTransaction(db(), function (tx) {
      var reads = [tx.get(pRef)];
      if (sourceRef) reads.push(tx.get(sourceRef));

      return Promise.all(reads).then(function (results) {
        var snap = results[0];
        var sourceSnap = sourceRef ? results[1] : null;

        // Deduplication: skip if this exact check-in was already counted
        if (sourceSnap && sourceSnap.exists()) {
          console.log('[ChallengeEngine] duplicate checkin', checkinId, 'for', challenge.id, '— skipping');
          return { completedNow: false, alreadyProcessed: true };
        }

        var current = snap.exists() ? (snap.data() || {}) : {};
        if (current.completed === true) {
          console.log('[ChallengeEngine] already completed:', challenge.id, '— skipping');
          return { completedNow: false, alreadyCompleted: true };
        }

        var previous = Math.max(0, Number(current.count || current.progress || 0));
        var next = Math.min(target, previous + 1);
        var completedNow = next >= target;
        var awardXp = completedNow && current.xpAwarded !== true && challenge.xpReward > 0;

        var payload = {
          uid: userId,
          userId: userId,
          challengeId: challenge.id,
          count: next,                             // primary progress field
          progress: next,                          // backward compat for UI
          targetCount: target,
          completed: completedNow,
          xpAwarded: completedNow ? true : (current.xpAwarded === true),
          xpReward: challenge.xpReward,
          sourceType: proofTypeFor(challenge, checkin),
          proofType: proofTypeFor(challenge, checkin),  // backward compat
          updatedAt: f.serverTimestamp()
        };
        if (checkinId) payload.lastSourceId = checkinId;
        if (!snap.exists()) payload.createdAt = f.serverTimestamp();
        if (completedNow) payload.completedAt = f.serverTimestamp();

        tx.set(pRef, payload, { merge: true });

        // Mark this check-in as processed so it can never double-count
        if (sourceRef) {
          tx.set(sourceRef, { processedAt: f.serverTimestamp() });
        }

        console.log('[ChallengeEngine] progress updated:', challenge.id, next + '/' + target);
        if (completedNow) console.log('[ChallengeEngine] challenge completed:', challenge.id);
        if (awardXp) {
          tx.update(userRef, { xp: f.increment(challenge.xpReward), updatedAt: f.serverTimestamp() });
          console.log('[ChallengeEngine] xp awarded:', challenge.xpReward, 'for', challenge.id);
        }
        if (completedNow && badgeRef) {
          var bDef = BADGE_DEFAULTS[resolvedBadgeId] || {};
          tx.set(badgeRef, {
            badgeId: resolvedBadgeId,
            challengeId: challenge.id,
            title: challenge.badgeTitle || bDef.title || challenge.title || 'Challenge Badge',
            description: challenge.badgeDescription || bDef.description || '',
            icon: challenge.badgeIcon || bDef.icon || 'fa-trophy',
            rarity: challenge.badgeRarity || bDef.rarity || 'common',
            earnedAt: f.serverTimestamp()
          }, { merge: true });
        }
        return { completedNow: completedNow, challenge: challenge };
      });
    });
  }

  function evaluateCheckin(checkin, checkinId, callback) {
    var userId = uid();
    if (!userId || !GF() || !db() || !fs()) {
      if (callback) callback({ completed: [] });
      return Promise.resolve({ completed: [] });
    }
    console.log('[ChallengeEngine] evaluating checkin', checkinId || '(no id)', '— verified:', checkin.verified);
    return getActiveChallenges().then(function (challenges) {
      var matching = challenges.filter(function (c) { return challengeMatchesCheckin(c, checkin); });
      console.log('[ChallengeEngine] active challenges:', challenges.length, '— matched:', matching.length);
      return Promise.all(matching.map(function (c) { return applyCheckinToChallenge(userId, c, checkin, checkinId); }));
    }).then(function (results) {
      var completed = results.filter(function (r) { return r && r.completedNow; }).map(function (r) { return r.challenge; });
      if (completed.length && window.GeoSocial && window.GeoSocial.toast) {
        var c0 = completed[0];
        window.GeoSocial.toast('Challenge completed: ' + (c0.title || c0.name || 'Challenge') + ' (+' + (c0.xpReward || 0) + ' XP)');
      }
      var out = { completed: completed };
      if (callback) callback(out);
      return out;
    }).catch(function (err) {
      console.warn('[ChallengeEngine] evaluateCheckin error:', err.message, err);
      if (callback) callback({ completed: [], error: err.message });
      return { completed: [], error: err.message };
    });
  }

  function listenUserChallenges(callback) {
    var userId = uid();
    if (!GF() || !db() || !fs()) { callback({ active: [], completed: [], progress: {} }); return function () {}; }
    var f = fs();
    var unsubscribeProgress = function () {};
    var stopped = false;

    function emit(challenges, progress) {
      if (stopped) return;
      var completed = [];
      var active = [];
      challenges.forEach(function (c) {
        var p = progress[c.id] || {};
        if (p.completed === true) completed.push(c);
        else if (isActiveChallenge(c)) active.push(c);
      });
      callback({ active: active, completed: completed, progress: progress });
    }

    getChallengeCatalog().then(function (challenges) {
      if (!userId) { emit(challenges, {}); return; }
      unsubscribeProgress = f.onSnapshot(f.collection(db(), 'users', userId, 'challengeProgress'), function (snap) {
        var progress = {};
        snap.forEach(function (docSnap) { progress[docSnap.id] = Object.assign({ id: docSnap.id }, docSnap.data()); });
        emit(challenges, progress);
      }, function (err) {
        console.warn('[GeoChallenges] progress listen', err.message);
        emit(challenges, {});
      });
    }).catch(function (err) {
      console.warn('[GeoChallenges] challenges listen', err.message);
      callback({ active: [], completed: [], progress: {}, error: err.message });
    });

    return function () { stopped = true; unsubscribeProgress(); };
  }

  window.GeoChallenges = {
    TYPE_LABELS: TYPE_LABELS,
    normalizeChallenge: normalizeChallenge,
    isActiveChallenge: isActiveChallenge,
    getActiveChallenges: getActiveChallenges,
    getProgressMap: getProgressMap,
    getChallengeCatalog: getChallengeCatalog,
    evaluateCheckin: evaluateCheckin,
    listenUserChallenges: listenUserChallenges,
    escapeHtml: escapeHtml
  };
  window.dispatchEvent(new Event('GeoChallengesReady'));
}());
