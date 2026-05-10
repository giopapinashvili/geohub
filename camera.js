(function () {
  'use strict';

  // ── URL params
  var params     = new URLSearchParams(location.search);
  var initMode   = params.get('mode') || 'checkin';
  var missionId  = params.get('mission') || null;

  // ── State
  var currentMode       = initMode;
  var stream            = null;
  var facingMode        = 'environment';
  var flashOn           = false;
  var gridOn            = false;
  var capturedImageData = null;
  var selectedMood      = 'excited';
  var selectedPlace     = '📍 My Location';
  var selectedStar      = 0;
  var patriotStep       = 1;
  var beforeImageData   = null;
  var afterImageData    = null;

  // ── Mode config
  var MODE_CONFIG = {
    checkin: { name:'Check-in',     sub:'Tap to capture proof',       icon:'📍', label:'Check-in Scene',    trust:'+2',  xp:'+45',  badge:null,               rewardTitle:'Check-in Proof Reward',  rewardIcon:'📍' },
    story:   { name:'Story',        sub:'Create your story',          icon:'🎬', label:'Story Scene',       trust:'+1',  xp:'+30',  badge:'✨ Story Creator',  rewardTitle:'Story Reward',           rewardIcon:'🎬' },
    review:  { name:'Review Photo', sub:'Add visual proof to review', icon:'⭐', label:'Review Scene',      trust:'+3',  xp:'+60',  badge:'📸 Camera Proof',  rewardTitle:'Verified Review Reward', rewardIcon:'⭐' },
    patriot: { name:'Patriot',      sub:'Capture mission proof',      icon:'🇬🇪', label:'Patriot Mission', trust:'+8',  xp:'+120', badge:'🛡️ Patriot Badge', rewardTitle:'Patriot Mission Reward', rewardIcon:'🛡️' },
    qr:      { name:'QR Scan',      sub:'Scan business QR code',      icon:'📷', label:'QR Scanner',       trust:'+1',  xp:'+25',  badge:null,               rewardTitle:'QR Scan Reward',         rewardIcon:'🎁' }
  };

  // ── QR mock rewards
  var QR_REWARDS = [
    { business:'Fabrika Café · Tbilisi',  offer:'15% Off Any Drink',     points:50 },
    { business:'Rooms Hotel · Tbilisi',   offer:'Free Coffee with Stay',  points:75 },
    { business:'Lolita Bar · Tbilisi',    offer:'2-for-1 Cocktails',      points:60 },
    { business:'Stamba Hotel · Tbilisi',  offer:'10% Off Dinner',         points:45 }
  ];

  // ── DOM refs
  var camScreen              = document.getElementById('camScreen');
  var previewScreen          = document.getElementById('previewScreen');
  var patriotScreenEl        = document.getElementById('patriotScreen');
  var qrResultScreen         = document.getElementById('qrResultScreen');
  var camVideo               = document.getElementById('camVideo');
  var camMockBg              = document.getElementById('camMockBg');
  var mockIcon               = document.getElementById('mockIcon');
  var mockLabel              = document.getElementById('mockLabel');
  var camGrid                = document.getElementById('camGrid');
  var focusRing              = document.getElementById('focusRing');
  var flashBtn               = document.getElementById('flashBtn');
  var gridBtn                = document.getElementById('gridBtn');
  var modeName               = document.getElementById('modeName');
  var modeSub                = document.getElementById('modeSub');
  var camTimestamp           = document.getElementById('camTimestamp');
  var boostTrust             = document.getElementById('boostTrust');
  var boostXP                = document.getElementById('boostXP');
  var patriotStepEl          = document.getElementById('patriotStep');
  var psLabel                = document.getElementById('psLabel');
  var psBig                  = document.getElementById('psBig');
  var psSub                  = document.getElementById('psSub');
  var qrOverlay              = document.getElementById('qrOverlay');
  var captureBtn             = document.getElementById('captureBtn');
  var flipBtn                = document.getElementById('flipBtn');
  var galleryBtn             = document.getElementById('galleryBtn');
  var galleryInput           = document.getElementById('galleryInput');
  var galleryThumb           = document.getElementById('galleryThumb');
  var galleryIcon            = document.getElementById('galleryIcon');
  var flashOverlay           = document.getElementById('flashOverlay');
  var previewBack            = document.getElementById('previewBack');
  var previewTitle           = document.getElementById('previewTitle');
  var previewConfirm         = document.getElementById('previewConfirm');
  var previewImg             = document.getElementById('previewImg');
  var previewPlaceholder     = document.getElementById('previewPlaceholder');
  var previewPlaceholderIcon = document.getElementById('previewPlaceholderIcon');
  var previewPlaceholderLbl  = document.getElementById('previewPlaceholderLabel');
  var previewModeBadge       = document.getElementById('previewModeBadge');
  var captionInput           = document.getElementById('captionInput');
  var placeChips             = document.getElementById('placeChips');
  var reviewRating           = document.getElementById('reviewRating');
  var rewardIcon             = document.getElementById('rewardIcon');
  var rewardTitle            = document.getElementById('rewardTitle');
  var rewardXP               = document.getElementById('rewardXP');
  var rewardTrust            = document.getElementById('rewardTrust');
  var rewardBadge            = document.getElementById('rewardBadge');
  var patriotBack            = document.getElementById('patriotBack');
  var compBefore             = document.getElementById('compBefore');
  var compAfter              = document.getElementById('compAfter');
  var compDivider            = document.getElementById('compDivider');
  var compHandle             = document.getElementById('compHandle');
  var aiVerifyCard           = document.getElementById('aiVerifyCard');
  var aiFill                 = document.getElementById('aiFill');
  var patriotSubmit          = document.getElementById('patriotSubmit');
  var qrBusiness             = document.getElementById('qrBusiness');
  var qrOffer                = document.getElementById('qrOffer');
  var qrPoints               = document.getElementById('qrPoints');
  var qrClaimBtn             = document.getElementById('qrClaimBtn');
  var qrDismiss              = document.getElementById('qrDismiss');
  var successToast           = document.getElementById('successToast');
  var toastMsg               = document.getElementById('toastMsg');

  // ── Helpers
  function showToast(msg) {
    toastMsg.textContent = msg;
    successToast.classList.add('show');
    setTimeout(function () { successToast.classList.remove('show'); }, 2800);
  }

  function showScreen(screen) {
    [camScreen, previewScreen, patriotScreenEl, qrResultScreen].forEach(function (s) {
      s.classList.remove('active');
    });
    screen.classList.add('active');
  }

  function updateTimestamp() {
    var now = new Date();
    var h = String(now.getHours()).padStart(2, '0');
    var m = String(now.getMinutes()).padStart(2, '0');
    var s = String(now.getSeconds()).padStart(2, '0');
    camTimestamp.textContent = h + ':' + m + ':' + s + ' · GPS ✓';
  }

  // ── Mode setup
  function setMode(mode) {
    currentMode = mode;
    var cfg = MODE_CONFIG[mode] || MODE_CONFIG.checkin;

    modeName.textContent  = cfg.name;
    modeSub.textContent   = cfg.sub;
    mockIcon.textContent  = cfg.icon;
    mockLabel.textContent = cfg.label;
    boostTrust.textContent = cfg.trust;
    boostXP.textContent   = cfg.xp + ' XP';

    document.querySelectorAll('.mode-pill').forEach(function (p) {
      p.classList.toggle('active', p.dataset.mode === mode);
    });

    captureBtn.className = 'cam-capture-btn';
    if (mode === 'qr')      captureBtn.classList.add('qr-mode');
    if (mode === 'patriot') captureBtn.classList.add('patriot-mode');

    patriotStepEl.style.display = (mode === 'patriot') ? 'block' : 'none';
    if (mode === 'patriot') updatePatriotStep();

    qrOverlay.classList.toggle('visible', mode === 'qr');
  }

  function updatePatriotStep() {
    if (patriotStep === 1) {
      psLabel.textContent = 'Step 1 of 2';
      psBig.textContent   = 'BEFORE';
      psSub.textContent   = 'Capture the area before cleanup';
    } else {
      psLabel.textContent = 'Step 2 of 2';
      psBig.textContent   = 'AFTER';
      psSub.textContent   = 'Now capture the improvement';
    }
  }

  // ── Camera
  function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      useMockMode(); return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: facingMode } })
      .then(function (s) {
        stream = s;
        camVideo.srcObject      = s;
        camVideo.style.display  = 'block';
        camMockBg.style.display = 'none';
      })
      .catch(useMockMode);
  }

  function stopCamera() {
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
  }

  function useMockMode() {
    camVideo.style.display  = 'none';
    camMockBg.style.display = 'flex';
  }

  // ── Capture
  function doCapture() {
    flashOverlay.classList.add('flash');
    setTimeout(function () { flashOverlay.classList.remove('flash'); }, 150);

    focusRing.style.left = '50%';
    focusRing.style.top  = '45%';
    focusRing.classList.remove('show');
    void focusRing.offsetWidth;
    focusRing.classList.add('show');
    setTimeout(function () { focusRing.classList.remove('show'); }, 600);

    if (stream && camVideo.readyState >= 2) {
      var canvas    = document.createElement('canvas');
      canvas.width  = camVideo.videoWidth  || 640;
      canvas.height = camVideo.videoHeight || 480;
      canvas.getContext('2d').drawImage(camVideo, 0, 0);
      capturedImageData = canvas.toDataURL('image/jpeg', 0.85);
    } else {
      capturedImageData = null;
    }

    if (currentMode === 'qr')      { handleQR();             return; }
    if (currentMode === 'patriot') { handlePatriotCapture(); return; }
    setTimeout(showPreview, 120);
  }

  // ── Preview screen
  function showPreview() {
    var cfg = MODE_CONFIG[currentMode] || MODE_CONFIG.checkin;

    if (capturedImageData) {
      previewImg.src              = capturedImageData;
      previewImg.style.display    = 'block';
      previewPlaceholder.style.display = 'none';
    } else {
      previewImg.style.display    = 'none';
      previewPlaceholder.style.display = 'flex';
      previewPlaceholderIcon.textContent = cfg.icon;
      previewPlaceholderLbl.textContent  = cfg.name + ' captured';
    }

    previewModeBadge.textContent = cfg.name;
    rewardIcon.textContent       = cfg.rewardIcon;
    rewardTitle.textContent      = cfg.rewardTitle;
    rewardXP.textContent         = cfg.xp + ' XP';
    rewardTrust.textContent      = cfg.trust + ' Trust';

    if (cfg.badge) {
      rewardBadge.textContent   = cfg.badge;
      rewardBadge.style.display = 'inline-flex';
    } else {
      rewardBadge.style.display = 'none';
    }

    reviewRating.style.display = (currentMode === 'review') ? 'block' : 'none';
    previewTitle.textContent   = (currentMode === 'review') ? 'Add Review Details' : 'Add Details';
    previewConfirm.textContent = (currentMode === 'review') ? 'Post Review' : 'Share';

    showScreen(previewScreen);
  }

  // ── Patriot flow (2-step: before → after)
  function handlePatriotCapture() {
    if (patriotStep === 1) {
      beforeImageData = capturedImageData;
      if (beforeImageData) {
        var imgB = new Image();
        imgB.src = beforeImageData;
        imgB.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0;';
        compBefore.innerHTML = '';
        compBefore.appendChild(imgB);
        var lblB = document.createElement('div');
        lblB.className = 'comp-label before';
        lblB.textContent = 'Before';
        compBefore.appendChild(lblB);
      }
      patriotStep = 2;
      updatePatriotStep();
      showToast('Before photo captured — now take the After photo!');
    } else {
      afterImageData = capturedImageData;
      if (afterImageData) {
        var imgA = new Image();
        imgA.src = afterImageData;
        imgA.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0;';
        compAfter.innerHTML = '';
        compAfter.appendChild(imgA);
        var lblA = document.createElement('div');
        lblA.className = 'comp-label after';
        lblA.textContent = 'After';
        compAfter.appendChild(lblA);
      }
      compDivider.style.display = 'block';
      compHandle.style.display  = 'flex';
      setTimeout(function () {
        aiVerifyCard.style.display = 'flex';
        setTimeout(function () { aiFill.style.width = '86%'; }, 120);
      }, 600);
      patriotSubmit.disabled = false;
      showScreen(patriotScreenEl);
    }
  }

  // ── QR scan mock
  function handleQR() {
    showToast('Scanning QR code...');
    setTimeout(function () {
      var r = QR_REWARDS[Math.floor(Math.random() * QR_REWARDS.length)];
      qrBusiness.textContent = r.business;
      qrOffer.textContent    = r.offer;
      qrPoints.textContent   = r.points + ' GeoPoints';
      showScreen(qrResultScreen);
    }, 1800);
  }

  // ── Confirm (regular modes)
  function confirmCapture() {
    var moodEl  = document.querySelector('.mood-btn.active');
    var placeEl = document.querySelector('.place-chip.active');
    var cfg     = MODE_CONFIG[currentMode] || MODE_CONFIG.checkin;

    var entry = {
      id:        'cam-' + Date.now(),
      mode:      currentMode,
      timestamp: new Date().toISOString(),
      place:     placeEl ? placeEl.dataset.place : selectedPlace,
      mood:      moodEl  ? moodEl.dataset.mood   : selectedMood,
      caption:   captionInput.value.trim(),
      xp:        cfg.xp,
      trust:     cfg.trust,
      star:      selectedStar || null,
      imageData: capturedImageData || null
    };

    try {
      var stored = JSON.parse(localStorage.getItem('geohub_captures') || '[]');
      stored.unshift(entry);
      localStorage.setItem('geohub_captures', JSON.stringify(stored.slice(0, 30)));

      var totals = JSON.parse(localStorage.getItem('geohub_totals') || '{}');
      totals.xp       = (totals.xp       || 0) + (parseInt(cfg.xp) || 0);
      totals.captures = (totals.captures  || 0) + 1;
      localStorage.setItem('geohub_totals', JSON.stringify(totals));
    } catch (_) {}

    showToast('✓ ' + cfg.name + ' saved! ' + cfg.xp + ' XP earned');
    setTimeout(function () { location.href = 'index.html'; }, 1600);
  }

  // ── Confirm patriot mission
  function confirmPatriot() {
    try {
      var totals = JSON.parse(localStorage.getItem('geohub_totals') || '{}');
      totals.xp        = (totals.xp        || 0) + 120;
      totals.patriotXp = (totals.patriotXp  || 0) + 120;
      localStorage.setItem('geohub_totals', JSON.stringify(totals));
    } catch (_) {}
    showToast('🇬🇪 Mission submitted! +120 XP · +8 Trust');
    setTimeout(function () { location.href = missionId ? 'patriot.html' : 'index.html'; }, 1800);
  }

  // ── Claim QR reward
  function claimQR() {
    try {
      var pts    = parseInt(qrPoints.textContent) || 50;
      var totals = JSON.parse(localStorage.getItem('geohub_totals') || '{}');
      totals.xp  = (totals.xp || 0) + pts;
      localStorage.setItem('geohub_totals', JSON.stringify(totals));
    } catch (_) {}
    qrClaimBtn.disabled  = true;
    qrClaimBtn.innerHTML = '<i class="fas fa-check"></i>&nbsp; Claimed!';
    showToast('Reward claimed! GeoPoints added to your wallet.');
    setTimeout(function () { location.href = 'index.html'; }, 1800);
  }

  // ── Comparison slider drag
  function initSlider() {
    var dragging = false;
    var wrap = document.querySelector('.comparison-wrap');
    if (!wrap) return;

    function setSlider(clientX) {
      var rect  = wrap.getBoundingClientRect();
      var ratio = Math.max(0.04, Math.min(0.96, (clientX - rect.left) / rect.width));
      var pct   = (ratio * 100).toFixed(2);
      compBefore.style.clipPath = 'inset(0 ' + (100 - pct) + '% 0 0)';
      compAfter.style.clipPath  = 'inset(0 0 0 ' + pct + '%)';
      compDivider.style.left    = pct + '%';
      compHandle.style.left     = pct + '%';
    }

    compHandle.addEventListener('mousedown',  function ()  { dragging = true; });
    compHandle.addEventListener('touchstart', function ()  { dragging = true; }, { passive: true });
    document.addEventListener('mousemove',    function (e) { if (dragging) setSlider(e.clientX); });
    document.addEventListener('touchmove',    function (e) { if (dragging) setSlider(e.touches[0].clientX); }, { passive: true });
    document.addEventListener('mouseup',      function ()  { dragging = false; });
    document.addEventListener('touchend',     function ()  { dragging = false; });
  }

  // ── Gallery / file upload
  function handleGalleryFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      capturedImageData          = e.target.result;
      galleryThumb.src           = capturedImageData;
      galleryThumb.style.display = 'block';
      galleryIcon.style.display  = 'none';
      if (currentMode === 'qr')      { handleQR();             return; }
      if (currentMode === 'patriot') { handlePatriotCapture(); return; }
      showPreview();
    };
    reader.readAsDataURL(file);
  }

  // ── Viewfinder tap → focus ring
  function handleViewfinderTap(e) {
    var x = e.touches ? e.touches[0].clientX : e.clientX;
    var y = e.touches ? e.touches[0].clientY : e.clientY;
    focusRing.style.left = x + 'px';
    focusRing.style.top  = y + 'px';
    focusRing.classList.remove('show');
    void focusRing.offsetWidth;
    focusRing.classList.add('show');
    setTimeout(function () { focusRing.classList.remove('show'); }, 600);
  }

  // ── Boot
  function init() {
    startCamera();
    updateTimestamp();
    setInterval(updateTimestamp, 1000);
    setMode(initMode);

    // Mode pills
    document.querySelectorAll('.mode-pill').forEach(function (pill) {
      pill.addEventListener('click', function () { setMode(pill.dataset.mode); });
    });

    // Flash toggle
    flashBtn.addEventListener('click', function () {
      flashOn = !flashOn;
      flashBtn.classList.toggle('active', flashOn);
    });

    // Grid toggle
    gridBtn.addEventListener('click', function () {
      gridOn = !gridOn;
      gridBtn.classList.toggle('active', gridOn);
      camGrid.classList.toggle('visible', gridOn);
    });

    // Flip camera
    flipBtn.addEventListener('click', function () {
      flipBtn.classList.add('spinning');
      setTimeout(function () { flipBtn.classList.remove('spinning'); }, 400);
      facingMode = (facingMode === 'environment') ? 'user' : 'environment';
      stopCamera();
      setTimeout(startCamera, 300);
    });

    // Capture
    captureBtn.addEventListener('click', doCapture);

    // Gallery
    galleryBtn.addEventListener('click', function () { galleryInput.click(); });
    galleryInput.addEventListener('change', function (e) { handleGalleryFile(e.target.files[0]); });

    // Viewfinder focus tap
    camMockBg.addEventListener('click',    handleViewfinderTap);
    camMockBg.addEventListener('touchend', handleViewfinderTap, { passive: true });

    // Preview back → return to camera
    previewBack.addEventListener('click', function () {
      capturedImageData = null;
      showScreen(camScreen);
    });

    // Preview confirm
    previewConfirm.addEventListener('click', confirmCapture);

    // Place chips
    placeChips.addEventListener('click', function (e) {
      var chip = e.target.closest('.place-chip');
      if (!chip) return;
      placeChips.querySelectorAll('.place-chip').forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      selectedPlace = chip.dataset.place;
    });

    // Mood buttons
    document.querySelectorAll('.mood-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.mood-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        selectedMood = btn.dataset.mood;
      });
    });

    // Star rating
    var starBtns = document.querySelectorAll('.star-btn');
    starBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectedStar = parseInt(btn.dataset.star);
        starBtns.forEach(function (b, i) { b.classList.toggle('lit', i < selectedStar); });
      });
    });

    // Patriot back → reset and return to camera
    patriotBack.addEventListener('click', function () {
      patriotStep     = 1;
      beforeImageData = null;
      afterImageData  = null;
      aiVerifyCard.style.display = 'none';
      aiFill.style.width         = '0';
      patriotSubmit.disabled     = true;
      compBefore.innerHTML = '<div class="comp-placeholder">📸</div><div class="comp-placeholder-label">Tap to capture</div>';
      compAfter.innerHTML  = '<div class="comp-placeholder">📸</div><div class="comp-placeholder-label">Capture after</div>';
      compDivider.style.display = 'none';
      compHandle.style.display  = 'none';
      showScreen(camScreen);
    });

    // Patriot submit
    patriotSubmit.addEventListener('click', confirmPatriot);

    // QR result buttons
    qrClaimBtn.addEventListener('click', claimQR);
    qrDismiss.addEventListener('click', function () { location.href = 'index.html'; });

    // Close button — navigate back to the originating page
    var camCloseBtn = document.getElementById('camCloseBtn');
    if (camCloseBtn) {
      camCloseBtn.addEventListener('click', function (e) {
        e.preventDefault();
        stopCamera();
        var backUrls = { checkin:'checkin.html', story:'stories.html', review:'reviews.html', patriot:'patriot.html', qr:'rewards.html' };
        location.href = backUrls[currentMode] || 'index.html';
      });
    }

    initSlider();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
