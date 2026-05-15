/* GeoHub Challenges Foundation
   Normalized challenges + per-user progress.
*/
(function () {
  'use strict';

  var ACTIVE_LIMIT = 100;
  var TYPE_LABELS = {
    checkin: 'Verified check-in',
    photo: 'Photo proof',
    qr: 'QR check-in',
    event: 'Event attendance',
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
    var type = (challenge.type || 'checkin').toLowerCase();

    // photo / qr / event / distance require GPS-verified; plain 'checkin' accepts any submission
    if (type !== 'checkin' && checkin.verified !== true) return false;

    if (challenge.city && String(challenge.city).toLowerCase() !== String(checkin.city || '').toLowerCase()) return false;
    if (challenge.businessId && challenge.businessId !== checkin.businessId) return false;
    if (challenge.placeId && challenge.placeId !== checkin.placeId) return false;
    if (challenge.eventId && challenge.eventId !== checkin.eventId) return false;

    if (type === 'photo') return !!checkin.photoUrl;
    if (type === 'qr') return checkin.checkinType === 'qr' || checkin.verificationMethod === 'qr';
    if (type === 'event') return !!checkin.eventId || !!challenge.eventId;
    if (type === 'distance') return Number(checkin.distanceMeters || 0) > 0;
    return true; // 'checkin' type — any submitted check-in counts
  }

  function proofTypeFor(challenge, checkin) {
    if (challenge.type === 'photo') return 'photo';
    if (challenge.type === 'qr') return 'qr';
    if (challenge.type === 'event') return 'event';
    return checkin && checkin.checkinType === 'qr' ? 'qr' : 'checkin';
  }

  function applyCheckinToChallenge(userId, challenge, checkin, checkinId) {
    var f = fs();
    var pRef = progressRef(userId, challenge.id);
    var userRef = f.doc(db(), 'users', userId);
    var badgeId = challenge.badge || null;
    var badgeRef = badgeId ? f.doc(db(), 'users', userId, 'badges', badgeId) : null;
    var target = clampTarget(challenge);

    return f.runTransaction(db(), function (tx) {
      return tx.get(pRef).then(function (snap) {
        var current = snap.exists() ? (snap.data() || {}) : {};
        if (current.completed === true) {
          console.log('[ChallengeEngine] already completed:', challenge.id, '— skipping');
          return { completedNow: false, alreadyCompleted: true };
        }

        var previous = Math.max(0, Number(current.progress || 0));
        var next = Math.min(target, previous + 1);
        var completedNow = next >= target;
        var awardXp = completedNow && current.xpAwarded !== true && challenge.xpReward > 0;

        var payload = {
          userId: userId,
          challengeId: challenge.id,
          progress: next,
          targetCount: target,
          completed: completedNow,
          xpAwarded: completedNow ? true : (current.xpAwarded === true),
          xpReward: challenge.xpReward,
          proofType: proofTypeFor(challenge, checkin),
          updatedAt: f.serverTimestamp()
        };
        if (!snap.exists()) payload.createdAt = f.serverTimestamp();
        if (completedNow) payload.completedAt = f.serverTimestamp();
        if (f.arrayUnion && checkinId) payload.relatedCheckins = f.arrayUnion(checkinId);

        tx.set(pRef, payload, { merge: true });

        console.log('[ChallengeEngine] progress updated:', challenge.id, next + '/' + target);

        if (completedNow) {
          console.log('[ChallengeEngine] challenge completed:', challenge.id);
        }
        if (awardXp) {
          tx.update(userRef, { xp: f.increment(challenge.xpReward), updatedAt: f.serverTimestamp() });
          console.log('[ChallengeEngine] xp awarded:', challenge.xpReward, 'for', challenge.id);
        }
        if (completedNow && badgeRef) {
          var bDef = BADGE_DEFAULTS[badgeId] || {};
          tx.set(badgeRef, {
            badgeId: badgeId,
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
