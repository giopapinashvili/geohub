/* GeoHub — Check-in Engine v1
   GPS verification, distance, cooldown, XP calc, photo upload.
   Exposes: window.GeoCheckin
*/
(function () {
  'use strict';

  var RADIUS_M       = 100;
  var COOLDOWN_MS    = 3 * 3600 * 1000;
  var GPS_MAX_ACC    = 150;
  var GPS_TIMEOUT    = 15000;
  var GPS_MAX_AGE    = 30000;
  var XP_GPS         = 50;
  var XP_GPS_PHOTO   = 65;
  var XP_QR          = 60;
  var XP_UNVERIFIED  = 10;

  function haversine(lat1, lng1, lat2, lng2) {
    var R = 6371000;
    var toRad = function (d) { return d * Math.PI / 180; };
    var dLat = toRad(lat2 - lat1);
    var dLng = toRad(lng2 - lng1);
    var a = Math.sin(dLat/2)*Math.sin(dLat/2) +
            Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*
            Math.sin(dLng/2)*Math.sin(dLng/2);
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  function requestLocation(onSuccess, onError) {
    if (!navigator.geolocation) {
      onError({ code: 'unsupported', message: 'GPS not available on this device.' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        onSuccess({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) });
      },
      function (err) {
        var MSGS = {
          1: 'Location permission denied. Please allow location access in browser settings.',
          2: 'Location signal unavailable. Try moving near a window or outdoors.',
          3: 'Location request timed out. Please try again.'
        };
        onError({ code: err.code, message: MSGS[err.code] || 'GPS error. Please try again.' });
      },
      { enableHighAccuracy: true, timeout: GPS_TIMEOUT, maximumAge: GPS_MAX_AGE }
    );
  }

  function verifyProximity(userLat, userLng, placeLat, placeLng) {
    if (!placeLat || !placeLng) return { distance: null, withinRadius: false, noCoords: true };
    var dist = haversine(userLat, userLng, Number(placeLat), Number(placeLng));
    return {
      distance:     dist,
      withinRadius: dist <= RADIUS_M,
      radius:       RADIUS_M,
      label:        dist < 1000 ? dist + ' m' : (dist / 1000).toFixed(1) + ' km'
    };
  }

  function checkCooldown(userId, placeId, callback) {
    var GF = window.GeoFirebase;
    if (!GF || !placeId) { callback({ canCheckin: true }); return; }
    var since = new Date(Date.now() - COOLDOWN_MS);
    GF.fs.getDocs(
      GF.fs.query(
        GF.fs.collection(GF.db, 'checkins'),
        GF.fs.where('userId', '==', userId),
        GF.fs.where('placeId', '==', placeId),
        GF.fs.where('createdAt', '>=', since),
        GF.fs.limit(1)
      )
    ).then(function (snap) {
      if (snap.empty) { callback({ canCheckin: true }); return; }
      var d = snap.docs[0].data();
      var lastMs = d.createdAt && typeof d.createdAt.toMillis === 'function' ? d.createdAt.toMillis() : Date.now();
      var remaining = Math.max(0, COOLDOWN_MS - (Date.now() - lastMs));
      callback({ canCheckin: false, remaining: remaining, label: fmtDur(remaining) });
    }).catch(function () { callback({ canCheckin: true }); });
  }

  function fmtDur(ms) {
    var h = Math.floor(ms / 3600000);
    var m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? h + 'h ' + m + 'm' : (m || 1) + 'm';
  }

  function calcXP(opts) {
    if (!opts.verified) return XP_UNVERIFIED;
    if (opts.checkinType === 'qr') return XP_QR;
    return opts.hasPhoto ? XP_GPS_PHOTO : XP_GPS;
  }

  function uploadPhoto(file, userId, onProgress, callback) {
    var GF = window.GeoFirebase;
    if (!GF || !GF.storage || !GF.storageRef || !GF.uploadBytesResumable || !GF.getDownloadURL) {
      callback(null);
      return;
    }
    try {
      var safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
      var path = 'checkins/' + userId + '/' + Date.now() + '_' + safeName;
      var ref  = GF.storageRef(GF.storage, path);
      var task = GF.uploadBytesResumable(ref, file);
      task.on('state_changed',
        function (s) { if (onProgress) onProgress(Math.round(s.bytesTransferred / s.totalBytes * 100)); },
        function ()  { callback(null); },
        function ()  { GF.getDownloadURL(task.snapshot.ref).then(callback).catch(function(){ callback(null); }); }
      );
    } catch (e) { callback(null); }
  }

  function submit(data, callback) {
    var GS = window.GeoSocial;
    if (!GS || !GS.createCheckinFull) {
      callback({ success: false, error: 'System not ready. Please refresh.' });
      return;
    }
    GS.createCheckinFull(data, callback);
  }

  window.GeoCheckin = {
    RADIUS_M: RADIUS_M, COOLDOWN_MS: COOLDOWN_MS, GPS_MAX_ACC: GPS_MAX_ACC,
    haversine: haversine,
    requestLocation: requestLocation,
    verifyProximity: verifyProximity,
    checkCooldown: checkCooldown,
    calcXP: calcXP,
    uploadPhoto: uploadPhoto,
    submit: submit
  };
}());
