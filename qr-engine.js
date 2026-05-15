/* GeoHub — QR Engine v1
   QR code ID generation, validation, scan tracking.
   Exposes: window.GeoQr
*/
(function () {
  'use strict';

  var PREFIX       = 'ghbiz_';
  var SCAN_COOLDOWN = 30000; // 30 s per-code sessionStorage gate

  function genQrId(businessId) {
    return PREFIX + businessId;
  }

  /* Accepts either:
     - A plain code string: "ghbiz_abc123"
     - A full URL:          "https://…/scan.html?code=ghbiz_abc123"
  */
  function validateQrCode(raw) {
    if (!raw || typeof raw !== 'string') return { valid: false };
    var s = raw.trim();
    if (s.indexOf('://') !== -1) {
      try {
        var u = new URL(s);
        s = u.searchParams.get('code') || '';
      } catch (e) { return { valid: false }; }
    }
    if (s.indexOf(PREFIX) !== 0) return { valid: false };
    var businessId = s.slice(PREFIX.length);
    if (!businessId || businessId.length < 5) return { valid: false };
    return { valid: true, businessId: businessId, qrCode: s };
  }

  /* Reads/creates the qrCode field on the business document.
     Only the business owner should call this. */
  function ensureBusinessQr(businessId, callback) {
    var GF = window.GeoFirebase;
    if (!GF || !GF.db || !GF.fs) { callback(null); return; }
    var bizRef = GF.fs.doc(GF.db, 'businesses', businessId);
    GF.fs.getDoc(bizRef).then(function (snap) {
      if (!snap.exists()) { callback(null); return; }
      var data = snap.data();
      if (data.qrCode) {
        callback({ qrCode: data.qrCode, businessId: businessId, businessData: data });
        return;
      }
      var qrCode = genQrId(businessId);
      GF.fs.updateDoc(bizRef, { qrCode: qrCode, qrGeneratedAt: GF.fs.serverTimestamp() })
        .then(function () {
          callback({ qrCode: qrCode, businessId: businessId, businessData: data });
        })
        .catch(function () { callback(null); });
    }).catch(function () { callback(null); });
  }

  /* Writes a scan-log entry. Called by scan.html for every successful scan.
     Rate-limited client-side; Firestore rule limits damage server-side. */
  function trackQrScan(businessId, userId) {
    var GF = window.GeoFirebase;
    if (!GF || !GF.db || !GF.fs || !businessId) return;
    var key = 'gh_qr_scan_' + businessId;
    try {
      var last = Number(sessionStorage.getItem(key) || 0);
      if (Date.now() - last < SCAN_COOLDOWN) return;
      sessionStorage.setItem(key, String(Date.now()));
    } catch (e) {}
    GF.fs.addDoc(
      GF.fs.collection(GF.db, 'businesses', businessId, 'qrScanLogs'),
      {
        userId:    userId || null,
        scannedAt: GF.fs.serverTimestamp(),
        ua:        navigator.userAgent.slice(0, 100)
      }
    ).catch(function () {});
  }

  /* Returns total scan count from subcollection (owner view). */
  function getQrScanCount(businessId, callback) {
    var GF = window.GeoFirebase;
    if (!GF || !GF.db || !GF.fs) { callback(0); return; }
    GF.fs.getDocs(
      GF.fs.query(
        GF.fs.collection(GF.db, 'businesses', businessId, 'qrScanLogs'),
        GF.fs.limit(1000)
      )
    ).then(function (snap) { callback(snap.size); })
     .catch(function () { callback(0); });
  }

  window.GeoQr = {
    PREFIX: PREFIX,
    genQrId: genQrId,
    validateQrCode: validateQrCode,
    ensureBusinessQr: ensureBusinessQr,
    trackQrScan: trackQrScan,
    getQrScanCount: getQrScanCount
  };
}());
