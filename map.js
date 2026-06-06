(function () {
  'use strict';

  const PLACE_MARKER_STYLES = {
    food:          { color: '#e74c3c', icon: '🍔',  label: 'საკვები / რესტორნები' },
    cafe:          { color: '#8e5a3c', icon: '☕',  label: 'კაფე / ყავა / დესერტი' },
    nightlife:     { color: '#8e44ad', icon: '🍸',  label: 'ბარები / ღამის ცხოვრება' },
    shopping:      { color: '#3498db', icon: '🛍️', label: 'მაღაზიები / მოლები' },
    fitness:       { color: '#f39c12', icon: '🏋️', label: 'სპორტი / ფიტნესი' },
    sports:        { color: '#f39c12', icon: '🏃',  label: 'სპორტული ობიექტი' },
    park:          { color: '#27ae60', icon: '🌳',  label: 'პარკები' },
    nature:        { color: '#2ecc71', icon: '🏞️', label: 'ბუნება / ტბები' },
    transport:     { color: '#1f5fbf', icon: '🚇',  label: 'ტრანსპორტი' },
    health:        { color: '#ff5a6e', icon: '🏥',  label: 'ჯანმრთელობა' },
    pharmacy:      { color: '#06b6d4', icon: '💊',  label: 'აფთიაქი' },
    finance:       { color: '#16a085', icon: '🏦',  label: 'ფინანსები' },
    hotel:         { color: '#0891b2', icon: '🏨',  label: 'სასტუმრო' },
    education:     { color: '#059669', icon: '🎓',  label: 'განათლება' },
    beauty:        { color: '#ff66b3', icon: '✂️',  label: 'სილამაზე / სალონი' },
    auto:          { color: '#64748b', icon: '⛽',  label: 'ავტო / ბენზინი' },
    government:    { color: '#7f8c8d', icon: '🏛️', label: 'სახელმწიფო' },
    religion:      { color: '#7d3c98', icon: '⛪',  label: 'რელიგიური ადგილები' },
    animals:       { color: '#92400e', icon: '🐾',  label: 'ცხოველები / ვეტერინარი' },
    culture:       { color: '#a67c52', icon: '🎭',  label: 'კულტურა / თეატრი / მუზეუმი' },
    entertainment: { color: '#f1c40f', icon: '🎬',  label: 'გართობა' },
    work:          { color: '#475569', icon: '💼',  label: 'სამუშაო / Coworking' },
    photo_spot:    { color: '#db2777', icon: '📸',  label: 'ფოტო ლოკაციები' },
    rooftop:       { color: '#4f46e5', icon: '🌃',  label: 'Rooftop / ხედები' },
    service:       { color: '#9ca3af', icon: '🛠️', label: 'სერვისები' },
    landmark:      { color: '#b45309', icon: '📍',  label: 'ღირსშესანიშნაობა' },
    default:       { color: '#6c757d', icon: '📍',  label: 'სხვა' }
  };

  // Vector tile styles (GL) — text labels stay upright at any rotation angle
  const TILE_LAYERS = {
    dark: {
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      label: '🌑 ბნელი'
    },
    streets: {
      style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
      label: '🗺️ ქუჩები'
    }
  };

  let map, allPlaces = [];
  let markerMap = new Map(); // placeId → { marker, el }
  let currentFilter = '', currentSearch = '', currentSubFilter = '';
  let disabledCategories = new Set();
  let activeMarkerEl = null, activePlaceId = null;
  let cameraMode = 'explore';
  let heatmapVisible = false;
  let _heatmapCheckinData = []; // [{lng,lat,w}] — loaded from Firestore checkins
  let userCheckins = new Set();
  let userMoodVotes = {};
  let currentMoodFilter = '';
  let _moodTagCounts = {};   // { placeId: { tagId: count } } — cached from Firestore
  let allEvents = [];
  let eventMarkers = [];
  let showEvents = false;
  let showThisWeekend = false;

  const MOOD_TAGS = [
    { id: 'cozy',     label: 'Cozy',             emoji: '🛋️', color: '#f59e0b' },
    { id: 'work',     label: 'Good for work',    emoji: '💻', color: '#3b82f6' },
    { id: 'family',   label: 'Family friendly',  emoji: '👨‍👩‍👧', color: '#10b981' },
    { id: 'cheap',    label: 'Budget friendly',  emoji: '💸', color: '#22c55e' },
    { id: 'romantic', label: 'Romantic',         emoji: '🌹', color: '#ec4899' },
    { id: 'crowded',  label: 'Lively & busy',    emoji: '👥', color: '#8b5cf6' },
    { id: 'quiet',    label: 'Quiet & calm',     emoji: '🔇', color: '#64748b' },
    { id: 'night',    label: 'Night vibe',        emoji: '🌃', color: '#6366f1' },
    { id: 'loud',     label: 'Loud music',        emoji: '🎵', color: '#f43f5e' },
    { id: 'instagrammable', label: 'Instagram spot', emoji: '📸', color: '#e879f9' },
    { id: 'outdoor',  label: 'Outdoor seating',  emoji: '🌿', color: '#16a34a' },
    { id: 'trending', label: 'Trending now',      emoji: '🔥', color: '#ef4444' },
  ];

  const CAMERA_MODES = {
    explore:    { label: '🔍 Explore',   pitch: 0,  bearing: 0 },
    cinematic:  { label: '🎬 Cinematic', pitch: 55, bearing: null },
    navigation: { label: '🧭 Navigate',  pitch: 30, bearing: null }
  };
  const _googleDetailsCache = {};

  // ── Live Friend Locations state ───────────────────────
  let _locWatchId   = null;
  let _myLocMarker  = null;
  let _friendMarkers = {};     // { uid: maplibregl.Marker }
  let _friendData    = {};     // { uid: friendData }
  let _friendsListUnsub = null;
  let _friendLocUnsub   = null;
  let _locSharing    = false;
  let _myLatLng      = null;   // [lng, lat]
  let _writeThrottle = null;
  const _placeCatLookup = {};
  const PLACE_CATEGORY_ORDER = [
    'food', 'cafe', 'nightlife', 'shopping', 'fitness', 'park', 'nature', 'transport',
    'health', 'pharmacy', 'finance', 'hotel', 'education', 'beauty', 'auto', 'government',
    'religion', 'animals', 'culture', 'entertainment', 'work', 'photo_spot', 'rooftop',
    'service', 'landmark'
  ];

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  function isOpenNow(wh) {
    if (!wh) return null;
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const h = wh[days[new Date().getDay()]];
    if (!h || h.closed) return false;
    const now = new Date(), cur = now.getHours() * 60 + now.getMinutes();
    const parse = t => { const p = (t || '0:0').split(':'); return parseInt(p[0], 10) * 60 + parseInt(p[1], 10); };
    return cur >= parse(h.open) && cur < parse(h.close);
  }
  function openBadgeHtml(wh) {
    const s = isOpenNow(wh);
    if (s === null) return '';
    return s
      ? '<span class="map-open-badge open">Open</span>'
      : '<span class="map-open-badge closed">Closed</span>';
  }

  function categorySortValue(id, data) {
    const knownIndex = PLACE_CATEGORY_ORDER.indexOf(id);
    if (knownIndex > -1) return knownIndex;
    const sort = Number(data && data.sortOrder);
    return PLACE_CATEGORY_ORDER.length + (Number.isFinite(sort) ? sort : 999);
  }

  function categoryEntries() {
    const firestoreIds = Object.keys(_placeCatLookup);
    if (firestoreIds.length > 0) {
      return firestoreIds
        .map(id => Object.assign({ id }, _placeCatLookup[id]))
        .sort((a, b) => categorySortValue(a.id, a) - categorySortValue(b.id, b) || (a.label || a.id).localeCompare(b.label || b.id));
    }
    return PLACE_CATEGORY_ORDER
      .filter(id => PLACE_MARKER_STYLES[id])
      .map(id => Object.assign({ id, subcategories: [] }, PLACE_MARKER_STYLES[id]));
  }

  function usedCategoryEntries() {
    if (!allPlaces.length) return categoryEntries();
    const usedIds = new Set();
    allPlaces.forEach(function(p) { if (p.categoryId) usedIds.add(p.categoryId); });
    const allEntries = categoryEntries();
    const entryMap = {};
    allEntries.forEach(function(c) { entryMap[c.id] = c; });
    const result = allEntries.filter(function(c) { return usedIds.has(c.id); });
    usedIds.forEach(function(id) {
      if (!entryMap[id] && PLACE_MARKER_STYLES[id]) {
        result.push(Object.assign({ id, subcategories: [] }, PLACE_MARKER_STYLES[id]));
      }
    });
    return result;
  }

  /* ── Google Places helpers ──────────────────────── */
  function fetchGoogleDetails(googlePlaceId) {
    if (_googleDetailsCache[googlePlaceId]) return Promise.resolve(_googleDetailsCache[googlePlaceId]);
    const workerUrl = (window.GeoConfig && window.GeoConfig.PAYMENTS && window.GeoConfig.PAYMENTS.WORKER_URL) || '';
    if (!workerUrl) return Promise.resolve(null);
    return fetch(workerUrl + '/api/google-place-details?placeId=' + encodeURIComponent(googlePlaceId))
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && !data.error) { _googleDetailsCache[googlePlaceId] = data; return data; }
        return null;
      })
      .catch(() => null);
  }

  function getGooglePhotoUrl(photoName) {
    const workerUrl = (window.GeoConfig && window.GeoConfig.PAYMENTS && window.GeoConfig.PAYMENTS.WORKER_URL) || '';
    if (!workerUrl || !photoName) return '';
    return workerUrl + '/api/google-place-photo?maxWidth=600&name=' + encodeURIComponent(photoName);
  }

  function renderGoogleSection(gd) {
    if (!gd) return '';
    let html = '<div class="map-g-section">';
    if (gd.isOpen !== null && gd.isOpen !== undefined) {
      html += '<span class="map-g-status ' + (gd.isOpen ? 'open' : 'closed') + '">' + (gd.isOpen ? 'Open now' : 'Closed now') + '</span>';
    }
    if (gd.todayHours) html += '<div class="map-g-hours">' + esc(gd.todayHours) + '</div>';
    if (gd.rating) {
      html += '<div class="map-g-rating">⭐ ' + gd.rating + ' <span class="map-g-count">(' + (gd.userRatingCount || 0) + ' reviews on Google)</span></div>';
    }
    if (gd.phone) html += '<div class="map-g-detail"><i class="fas fa-phone"></i> ' + esc(gd.phone) + '</div>';
    if (gd.website) {
      const wShort = gd.website.replace(/^https?:\/\//, '').slice(0, 36);
      html += '<div class="map-g-detail"><i class="fas fa-globe"></i> <a href="' + esc(gd.website) + '" target="_blank" rel="noopener">' + esc(wShort) + '</a></div>';
    }
    if (gd.reviews && gd.reviews.length) {
      html += '<div class="map-g-reviews-hd">Google Reviews</div>';
      gd.reviews.slice(0, 3).forEach(r => {
        html += '<div class="map-g-review">'
          + '<span class="map-g-rv-author">' + esc(r.author) + '</span>'
          + (r.rating ? '<span class="map-g-rv-stars">' + '⭐'.repeat(Math.max(1, Math.min(5, r.rating))) + '</span>' : '')
          + (r.relativeTime ? '<span class="map-g-rv-time">' + esc(r.relativeTime) + '</span>' : '')
          + (r.text ? '<div class="map-g-rv-text">' + esc(r.text.slice(0, 150)) + (r.text.length > 150 ? '…' : '') + '</div>' : '')
          + '</div>';
      });
    }
    html += '<div class="map-g-attr">Powered by Google</div>';
    html += '</div>';
    return html;
  }

  /* ── Firestore category lookup ──────────────────── */
  function loadPlaceCategoriesFromFirestore() {
    const GF = window.GeoFirebase;
    if (!GF || !GF.db || !GF.fs) return;
    GF.fs.getDocs(GF.fs.query(GF.fs.collection(GF.db, 'placeCategories'), GF.fs.where('active', '==', true))).then(snap => {
      let changed = false;
      snap.forEach(d => {
        const data = d.data();
        _placeCatLookup[d.id] = {
          color: data.color || '#6c757d',
          icon: data.icon || '📍',
          label: data.labelKa || data.labelEn || d.id,
          sortOrder: data.sortOrder,
          subcategories: (data.subcategories || []).filter(s => s.active !== false)
        };
        changed = true;
      });
      if (changed) {
        buildCategoryChips();
        buildLegend();
        if (allPlaces.length) renderMap();
      }
    }).catch(() => {});
  }

  /* ── Marker helpers ─────────────────────────────── */
  function getSubcategoryIcon(place) {
    if (!place.subcategory) return '';
    const subVal = place.subcategory;
    function matchSub(subs) {
      return subs.find(s =>
        (typeof s === 'object')
          ? s.id === subVal || s.labelKa === subVal || s.labelEn === subVal
          : s === subVal
      );
    }
    const catData = _placeCatLookup[place.categoryId];
    if (catData && catData.subcategories) {
      const sub = matchSub(catData.subcategories);
      if (sub && typeof sub === 'object' && sub.icon) return sub.icon;
    }
    const staticCats = window.GEOHUB_PLACE_CATEGORIES || [];
    const staticCat = staticCats.find(c => c.id === place.categoryId);
    if (staticCat && staticCat.subcategories) {
      const sub = matchSub(staticCat.subcategories);
      if (sub && typeof sub === 'object' && sub.icon) return sub.icon;
    }
    return '';
  }

  function getPlaceMarkerStyle(place) {
    const catId = place.categoryId;
    const catText = place.category || '';
    const base = (catId && _placeCatLookup[catId])
      ? _placeCatLookup[catId]
      : (catId && PLACE_MARKER_STYLES[catId])
        ? PLACE_MARKER_STYLES[catId]
        : PLACE_MARKER_STYLES[catText]
          || Object.values(PLACE_MARKER_STYLES).find(s => s.label === catText)
          || (catText && Object.values(PLACE_MARKER_STYLES).find(s => catText.includes(s.label)))
          || PLACE_MARKER_STYLES.default;
    if (place.icon) return Object.assign({}, base, { icon: place.icon });
    const subIcon = getSubcategoryIcon(place);
    if (subIcon) return Object.assign({}, base, { icon: subIcon });
    return base;
  }

  function hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function buildPlaceMarkerElement(place, isActive) {
    const style       = getPlaceMarkerStyle(place);
    const markerIcon  = place.icon || style.icon || '📍';
    const markerColor = style.color || '#22c55e';
    const glow        = hexToRgba(markerColor, 0.45);
    const boxShadow   = isActive
      ? '0 0 0 5px rgba(255,255,255,.14),0 0 32px ' + hexToRgba(markerColor, 0.7)
      : '0 0 0 4px rgba(255,255,255,.08),0 10px 24px rgba(0,0,0,.35),0 0 20px ' + glow;
    const wrap = document.createElement('div');
    wrap.className = 'gh-map-marker-wrap';
    const inner = document.createElement('div');
    inner.className = 'gh-map-emoji-marker' + (isActive ? ' is-selected' : '');
    inner.style.cssText = '--marker-color:' + markerColor + ';box-shadow:' + boxShadow;
    const span = document.createElement('span');
    span.className = 'gh-map-marker-emoji';
    span.textContent = markerIcon;
    inner.appendChild(span);
    const tooltip = document.createElement('div');
    tooltip.className = 'gh-map-tooltip';
    tooltip.textContent = place.name;
    wrap.appendChild(inner);
    wrap.appendChild(tooltip);

    // Top vibe badge — show most-voted vibe directly on the marker
    const counts = _moodTagCounts[place.id];
    if (counts) {
      const top = MOOD_TAGS
        .filter(t => (counts[t.id] || 0) >= 1)
        .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0))[0];
      if (top) {
        const badge = document.createElement('div');
        badge.className = 'gh-marker-vibe-badge';
        badge.style.cssText = '--vibe-color:' + (top.color || '#10b981');
        badge.textContent = top.emoji + ' ' + top.label;
        wrap.appendChild(badge);
      }
    }

    return wrap;
  }

  /* ── Normalize Firestore doc ────────────────────── */
  function resolveCategoryId(catId, catText) {
    if (catId) return catId;
    if (!catText) return '';
    if (PLACE_MARKER_STYLES[catText]) return catText;
    const fsKey = Object.keys(_placeCatLookup).find(k =>
      _placeCatLookup[k].label === catText ||
      (catText.length > 3 && catText.includes(_placeCatLookup[k].label))
    );
    if (fsKey) return fsKey;
    const staticEntry = Object.entries(PLACE_MARKER_STYLES).find(([, v]) =>
      v.label === catText || (catText.length > 3 && catText.includes(v.label))
    );
    return staticEntry ? staticEntry[0] : '';
  }

  function normalize(id, data, source) {
    const lat = Number(data.lat ?? data.latitude ?? (data.location && data.location.lat));
    const lng = Number(data.lng ?? data.longitude ?? (data.location && data.location.lng));
    if (!isFinite(lat) || !isFinite(lng)) return null;
    const catText = data.category || data.type || '';
    const catId   = resolveCategoryId(data.categoryId || '', catText);
    const style   = PLACE_MARKER_STYLES[catId]
      || Object.values(PLACE_MARKER_STYLES).find(s => s.label === catText)
      || PLACE_MARKER_STYLES.default;
    return {
      id, source, lat, lng,
      name:             data.name || data.placeName || data.title || 'GeoHub Place',
      city:             data.city || data.region || '',
      district:         data.district || '',
      address:          data.address || '',
      categoryId:       catId,
      category:         catText,
      subcategory:      data.subcategoryId || data.subcategory || '',
      categoryLabel:    catText || style.label,
      shortDescription: data.shortDescription || data.description || '',
      image:            data.image || data.imageUrl || data.mediaUrl || '',
      rating:           Number(data.rating || 0),
      reviewCount:      Number(data.reviewCount || 0),
      priceFrom:        data.priceFrom || '',
      currency:         data.currency || '',
      googlePlaceId:    data.googlePlaceId || '',
      icon:             data.icon || '',
      workingHours:     data.workingHours || null
    };
  }

  function stripLeadingIcon(icon, label) {
    const safeLabel = String(label || '').trim();
    const safeIcon  = String(icon  || '').trim();
    if (!safeLabel) return '';
    if (!safeIcon)  return safeLabel;
    if (safeLabel.startsWith(safeIcon)) return safeLabel.slice(safeIcon.length).trim();
    return safeLabel;
  }

  /* ── Filter logic ───────────────────────────────── */
  function filtered() {
    return allPlaces.filter(p => {
      const catKey = p.categoryId || 'default';
      if (disabledCategories.size > 0 && disabledCategories.has(catKey)) return false;
      if (currentFilter && p.categoryId !== currentFilter) return false;
      if (currentSubFilter && p.subcategory !== currentSubFilter) return false;
      if (currentMoodFilter) {
        const counts = _moodTagCounts[p.id];
        if (!counts || !counts[currentMoodFilter] || counts[currentMoodFilter] < 1) return false;
      }
      if (currentSearch) {
        const q = currentSearch.toLowerCase();
        return (p.name + ' ' + p.city + ' ' + p.categoryLabel).toLowerCase().includes(q);
      }
      return true;
    });
  }

  function renderStars(r) { return r ? '⭐'.repeat(Math.max(1, Math.min(5, Math.round(r)))) : ''; }

  /* ── Sync marker DOM → current filtered set ────── */
  function updateMarkerVisibility() {
    if (!map) return;
    const visible = new Set(filtered().map(p => p.id));
    markerMap.forEach(({ marker, el }, id) => {
      const show = visible.has(id);
      el.style.display = show ? '' : 'none';
    });
  }

  /* ── Add new places to map (called on data load) ─ */
  function addPlaceMarkers(places) {
    if (!map) return;
    places.forEach(p => {
      if (!p.lat || !p.lng) return;
      if (markerMap.has(p.id)) return; // already added
      const el = buildPlaceMarkerElement(p, false);
      const m = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([p.lng, p.lat]).addTo(map);
      el.querySelector('.gh-map-emoji-marker').addEventListener('click', () => focusPlace(p.id, el));
      markerMap.set(p.id, { marker: m, el });
    });
  }

  /* ── Map render ─────────────────────────────────── */
  function renderMap() {
    const list = filtered();

    if (activePlaceId && !list.find(p => p.id === activePlaceId)) {
      activePlaceId = null; activeMarkerEl = null;
      const panel = document.getElementById('infoPanel'); if (panel) panel.classList.remove('open');
      const card  = document.getElementById('mobileCard'); if (card)  card.classList.remove('open');
    }

    const count = document.getElementById('mapCount'); if (count) count.textContent = list.length;
    const results = document.getElementById('mapResults');
    if (results) {
      results.innerHTML = list.length
        ? list.map(p => {
            const st = getPlaceMarkerStyle(p);
            const badge = openBadgeHtml(p.workingHours);
            return '<div class="map-result-card" data-id="' + esc(p.id) + '">'
              + '<div class="map-result-icon" style="background:' + (st.color || '#22c55e') + '22;border-color:' + (st.color || '#22c55e') + '44">' + (p.icon || st.icon || '📍') + '</div>'
              + '<div class="map-result-info">'
              + '<div class="map-result-name">' + esc(p.name) + (badge ? ' ' + badge : '') + '</div>'
              + '<div class="map-result-cat">' + esc(p.categoryLabel) + (p.city ? ' · ' + esc(p.city) : '') + '</div>'
              + (p.rating ? '<div class="map-result-footer"><span class="rating-display">' + renderStars(p.rating) + '</span></div>' : '')
              + '</div></div>';
          }).join('')
        : '<div style="padding:20px;text-align:center;color:var(--text-muted)"><i class="fas fa-map-marker-alt" style="font-size:1.4rem;margin-bottom:8px;display:block"></i>' + (window.GHt ? window.GHt('ci_no_places') : 'No places added yet.') + '</div>';
      results.querySelectorAll('.map-result-card').forEach(card => card.addEventListener('click', () => focusPlace(card.dataset.id)));
    }

    addPlaceMarkers(allPlaces);
    updateMarkerVisibility();
    updateHeatmapData();
  }

  /* ── Active marker clear helper ─────────────────── */
  function clearActiveMarker() {
    if (activeMarkerEl) {
      const inner = activeMarkerEl.querySelector('.gh-map-emoji-marker');
      if (inner) inner.classList.remove('is-selected');
    }
    activeMarkerEl = null; activePlaceId = null;
  }

  /* ── Focus place ────────────────────────────────── */
  function focusPlace(id, clickedEl) {
    if (activeMarkerEl) {
      const inner = activeMarkerEl.querySelector('.gh-map-emoji-marker');
      if (inner) { inner.classList.remove('is-selected'); inner.classList.remove('just-selected'); }
    }
    activePlaceId = id;
    activeMarkerEl = clickedEl || (markerMap.has(id) ? markerMap.get(id).el : null);
    if (activeMarkerEl) {
      const inner = activeMarkerEl.querySelector('.gh-map-emoji-marker');
      if (inner) {
        inner.classList.add('is-selected');
        inner.classList.remove('just-selected');
        requestAnimationFrame(() => {
          requestAnimationFrame(() => { inner.classList.add('just-selected'); });
        });
        setTimeout(() => inner.classList.remove('just-selected'), 650);
      }
    }

    const p = allPlaces.find(x => x.id === id); if (!p) return;
    const cm = CAMERA_MODES[cameraMode] || CAMERA_MODES.explore;
    const targetZoom = Math.max(map.getZoom(), cameraMode === 'cinematic' ? 14 : 13);
    const flyOpts = {
      center: [p.lng, p.lat],
      zoom: targetZoom,
      pitch: cm.pitch,
      duration: cameraMode === 'cinematic' ? 1100 : 750,
      essential: true
    };
    if (cameraMode === 'explore') flyOpts.bearing = 0;
    map.flyTo(flyOpts);

    if (window.innerWidth <= 768) {
      openMobileCard(p);
      return;
    }

    const panel  = document.getElementById('infoPanel');
    const img    = document.getElementById('panelImg');
    const imgFb  = document.getElementById('panelImgFallback');
    const pStyle = getPlaceMarkerStyle(p);
    if (img) {
      img._googleTried = false;
      img.onerror = function() {
        const self = this;
        if (p.googlePlaceId && !self._googleTried) {
          self._googleTried = true;
          fetchGoogleDetails(p.googlePlaceId).then(gd => {
            if (gd && gd.photos && gd.photos.length) {
              const gUrl = getGooglePhotoUrl(gd.photos[0]);
              if (gUrl) { self.src = gUrl; return; }
            }
            self.style.display = 'none';
            if (imgFb) { imgFb.style.display = 'flex'; imgFb.textContent = pStyle.icon || '📍'; imgFb.style.background = pStyle.color || '#1e293b'; }
          });
        } else {
          this.style.display = 'none';
          if (imgFb) { imgFb.style.display = 'flex'; imgFb.textContent = pStyle.icon || '📍'; imgFb.style.background = pStyle.color || '#1e293b'; }
        }
      };
      if (p.image) {
        img.src = p.image; img.style.display = '';
        if (imgFb) imgFb.style.display = 'none';
      } else if (p.googlePlaceId) {
        img.style.display = 'none';
        if (imgFb) { imgFb.style.display = 'flex'; imgFb.textContent = pStyle.icon || '📍'; imgFb.style.background = pStyle.color || '#1e293b'; }
        fetchGoogleDetails(p.googlePlaceId).then(gd => {
          if (gd && gd.photos && gd.photos.length) {
            const gUrl = getGooglePhotoUrl(gd.photos[0]);
            if (gUrl) { img.src = gUrl; img.style.display = ''; img._googleTried = true; if (imgFb) imgFb.style.display = 'none'; }
          }
        });
      } else {
        img.style.display = 'none';
        if (imgFb) { imgFb.style.display = 'flex'; imgFb.textContent = pStyle.icon || '📍'; imgFb.style.background = pStyle.color || '#1e293b'; }
      }
    }
    const title  = document.getElementById('panelTitle'); if (title)  title.textContent  = p.name;
    const cat    = document.getElementById('panelCat');   if (cat)    cat.innerHTML      = esc(p.categoryLabel + (p.subcategory ? ' · ' + p.subcategory : '')) + openBadgeHtml(p.workingHours);
    const loc    = document.getElementById('panelLoc');   if (loc)    loc.textContent    = p.city ? p.city + ', Georgia' : 'Georgia';
    const rating = document.getElementById('panelRating'); if (rating) rating.innerHTML  = p.rating ? renderStars(p.rating) + ' <span style="font-size:0.72rem;opacity:.7">(' + p.rating + ')</span>' : '';
    const desc   = document.getElementById('panelDesc');  if (desc)   desc.textContent   = p.shortDescription || '';
    const detail = document.getElementById('panelDetailBtn');
    if (detail) {
      detail.href = 'javascript:void(0)';
      detail.innerHTML = '<i class="fas fa-expand-alt"></i> ვრცლად';
      detail.onclick = () => openPlaceDrawer(p.id, p);
    }
    const maps = document.getElementById('panelMapBtn');
    if (maps) maps.href = 'https://www.google.com/maps/search/' + encodeURIComponent(p.name + ' ' + (p.city || '') + ' Georgia');
    const gSection = document.getElementById('panelGoogleSection');
    if (gSection) {
      gSection.innerHTML = '';
      gSection.style.display = 'none';
      if (p.googlePlaceId) {
        fetchGoogleDetails(p.googlePlaceId).then(gd => {
          if (!gd) return;
          gSection.innerHTML = renderGoogleSection(gd);
          gSection.style.display = 'block';
        });
      }
    }
    _setupCheckinBtn('panelCheckinBtn', p.id);
    _loadMoodTags(p.id);
    if (panel) panel.classList.add('open');
  }
  window.focusPlace = focusPlace;

  window.closePanel = function () {
    const p = document.getElementById('infoPanel'); if (p) p.classList.remove('open');
    clearActiveMarker();
  };

  window.setCameraMode = function (mode) {
    if (!CAMERA_MODES[mode]) return;
    cameraMode = mode;
    document.querySelectorAll('.map-camera-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    const cm = CAMERA_MODES[mode];
    if (map) {
      const opts = { pitch: cm.pitch, duration: 600 };
      if (cm.bearing !== null) opts.bearing = cm.bearing;
      map.easeTo(opts);
    }
  };

  /* ── Mobile card ────────────────────────────────── */
  function buildMobileCard() {
    if (document.getElementById('mobileCard')) return;
    const div = document.createElement('div');
    div.id = 'mobileCard';
    div.className = 'mobile-place-card';
    div.innerHTML =
      '<div class="mpc-drag-handle" id="mpcDragHandle"></div>'
      + '<button class="mpc-close" onclick="window.closeMobileCard()"><i class="fas fa-times"></i></button>'
      + '<div id="mpcImgWrap" class="mpc-img-wrap"><img id="mpcImg" src="" alt=""></div>'
      + '<div id="mpcFallback" class="mpc-fallback" style="display:none"></div>'
      + '<div class="mpc-body">'
      + '<div id="mpcName" class="mpc-name"></div>'
      + '<div class="mpc-meta-row">'
      + '<div id="mpcCat" class="mpc-cat"></div>'
      + '<div id="mpcRating" class="mpc-rating"></div>'
      + '</div>'
      + '<div id="mpcAddr" class="mpc-addr"></div>'
      + '<div id="mpcDesc" class="mpc-desc"></div>'
      + '<div id="mpcMoodTags" class="panel-mood-tags"></div>'
      + '<div id="mpcGoogleSection" style="display:none"></div>'
      + '<div class="mpc-btns">'
      + '<a id="mpcDetail" href="#" class="btn btn-primary btn-sm" style="flex:1;justify-content:center"><i class="fas fa-info-circle"></i> Details</a>'
      + '<a id="mpcDirections" href="#" target="_blank" rel="noopener" class="btn btn-ghost btn-sm"><i class="fas fa-directions"></i></a>'
      + '<button id="mpcCheckinBtn" class="map-checkin-btn map-checkin-btn--sm" onclick="checkInToPlace()"><i class="fas fa-map-pin"></i></button>'
      + '</div></div>';
    document.body.appendChild(div);
    _attachMobileCardDrag(div);
  }

  function _attachMobileCardDrag(card) {
    const handle = document.getElementById('mpcDragHandle');
    if (!handle) return;
    let startY = 0, dy = 0, dragging = false;
    handle.addEventListener('touchstart', function(e) {
      startY = e.touches[0].clientY;
      dy = 0;
      dragging = true;
      card.style.transition = 'none';
    }, { passive: true });
    document.addEventListener('touchmove', function(e) {
      if (!dragging) return;
      dy = Math.max(0, e.touches[0].clientY - startY);
      card.style.transform = 'translateY(' + dy + 'px)';
    }, { passive: true });
    document.addEventListener('touchend', function() {
      if (!dragging) return;
      dragging = false;
      card.style.transition = '';
      if (dy > 110) {
        card.style.transform = '';
        window.closeMobileCard();
      } else {
        card.style.transform = 'translateY(0)';
      }
    });
  }

  function openMobileCard(p) {
    const card = document.getElementById('mobileCard'); if (!card) return;
    const style    = getPlaceMarkerStyle(p);
    const imgWrap  = document.getElementById('mpcImgWrap');
    const img      = document.getElementById('mpcImg');
    const fallback = document.getElementById('mpcFallback');
    if (img) {
      img._googleTried = false;
      img.onerror = function() {
        const self = this;
        if (p.googlePlaceId && !self._googleTried) {
          self._googleTried = true;
          fetchGoogleDetails(p.googlePlaceId).then(gd => {
            if (gd && gd.photos && gd.photos.length) {
              const gUrl = getGooglePhotoUrl(gd.photos[0]);
              if (gUrl) { self.src = gUrl; if (imgWrap) imgWrap.style.display = ''; return; }
            }
            if (imgWrap) imgWrap.style.display = 'none';
            if (fallback) { fallback.style.display = 'flex'; fallback.style.background = style.color; fallback.textContent = style.icon; }
          });
        } else {
          if (imgWrap) imgWrap.style.display = 'none';
          if (fallback) { fallback.style.display = 'flex'; fallback.style.background = style.color; fallback.textContent = style.icon; }
        }
      };
    }
    if (p.image) {
      if (imgWrap) imgWrap.style.display = '';
      if (img) img.src = p.image;
      if (fallback) fallback.style.display = 'none';
    } else if (p.googlePlaceId) {
      if (imgWrap) imgWrap.style.display = 'none';
      if (fallback) { fallback.style.display = 'flex'; fallback.style.background = style.color; fallback.textContent = style.icon; }
      fetchGoogleDetails(p.googlePlaceId).then(gd => {
        if (gd && gd.photos && gd.photos.length) {
          const gUrl = getGooglePhotoUrl(gd.photos[0]);
          if (gUrl && img) { img.src = gUrl; img._googleTried = true; if (imgWrap) imgWrap.style.display = ''; if (fallback) fallback.style.display = 'none'; }
        }
      });
    } else {
      if (imgWrap) imgWrap.style.display = 'none';
      if (fallback) { fallback.style.display = 'flex'; fallback.style.background = style.color; fallback.textContent = style.icon; }
    }
    if (navigator.vibrate) navigator.vibrate(12);
    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setTxt('mpcName', p.name);
    setTxt('mpcCat',  p.categoryLabel + (p.subcategory ? ' · ' + p.subcategory : ''));
    const addrParts = [p.district, p.address, p.city].filter(Boolean);
    setTxt('mpcAddr', addrParts.join(', '));
    setTxt('mpcDesc', p.shortDescription || '');
    const ratingEl = document.getElementById('mpcRating');
    if (ratingEl) ratingEl.innerHTML = p.rating
      ? renderStars(p.rating) + ' <span class="mpc-rating-num">(' + p.rating + ')</span>'
      : '';
    const dir = document.getElementById('mpcDirections');
    if (dir) dir.href = 'https://www.google.com/maps/search/' + encodeURIComponent(p.name + ' ' + (p.city || '') + ' Georgia');
    const det = document.getElementById('mpcDetail');
    if (det) {
      if (p.source === 'businesses') {
        det.href = 'business.html?id=' + encodeURIComponent(p.id);
        det.style.display = '';
      } else {
        det.style.display = 'none';
      }
    }
    const gSection = document.getElementById('mpcGoogleSection');
    if (gSection) {
      gSection.innerHTML = '';
      gSection.style.display = 'none';
      if (p.googlePlaceId) {
        fetchGoogleDetails(p.googlePlaceId).then(gd => {
          if (!gd) return;
          gSection.innerHTML = renderGoogleSection(gd);
          gSection.style.display = 'block';
        });
      }
    }
    _setupCheckinBtn('mpcCheckinBtn', p.id);
    _loadMoodTags(p.id);
    card.classList.add('open');
  }

  window.closeMobileCard = function () {
    const card = document.getElementById('mobileCard'); if (card) card.classList.remove('open');
    clearActiveMarker();
  };

  /* ── Legend ─────────────────────────────────────── */
  function buildLegend() {
    const legend = document.getElementById('legend'); if (!legend) return;
    const catEntries = categoryEntries();

    let html = '<div class="legend-title">კატეგორიები</div>'
      + '<div class="legend-all-btn' + (!currentFilter ? ' legend-all-active' : '') + '" id="legendAllBtn">✓ ყველა</div>'
      + '<div class="legend-scroll">';

    catEntries.forEach(cat => {
      const activeSubs = (cat.subcategories || []).filter(s => s.active !== false);
      const hasSubs = activeSubs.length > 0;
      const catActive = currentFilter === cat.id && !currentSubFilter;
      const expanded = currentFilter === cat.id && hasSubs;
      html += '<div class="legend-cat-row">'
        + '<div class="legend-item legend-toggle' + (catActive ? ' legend-active' : '') + '" data-cat="' + cat.id + '">'
        + '<span class="legend-dot" style="background:' + cat.color + '"></span>'
        + '<span class="legend-icon">' + cat.icon + '</span>'
        + '<span class="legend-label">' + esc(stripLeadingIcon(cat.icon, cat.labelKa || cat.labelEn || cat.label || cat.id || 'Category')) + '</span>'
        + (hasSubs ? '<button class="legend-expand-btn" data-for="' + cat.id + '">' + (expanded ? '▾' : '▸') + '</button>' : '')
        + '</div>';
      if (hasSubs) {
        html += '<div class="legend-subitems" id="legend-subs-' + cat.id + '"' + (expanded ? '' : ' style="display:none"') + '>';
        activeSubs.forEach(sub => {
          const subActive = currentFilter === cat.id && currentSubFilter === sub.id;
          html += '<div class="legend-subitem' + (subActive ? ' legend-active' : '') + '" data-cat="' + cat.id + '" data-sub="' + sub.id + '">'
            + '<span class="legend-sub-icon">' + (sub.icon || '') + '</span>'
            + '<span>' + esc(stripLeadingIcon(sub.icon, sub.labelKa || sub.labelEn || sub.label || sub.id || '')) + '</span>'
            + '</div>';
        });
        html += '</div>';
      }
      html += '</div>';
    });
    html += '</div>';
    legend.innerHTML = html;

    legend.querySelector('#legendAllBtn').addEventListener('click', () => {
      currentFilter = ''; currentSubFilter = '';
      disabledCategories.clear();
      buildCategoryChips();
      buildLegend(); renderMap();
    });
    legend.querySelectorAll('.legend-item.legend-toggle').forEach(item => {
      item.addEventListener('click', e => {
        if (e.target.classList.contains('legend-expand-btn')) return;
        const cat = item.dataset.cat;
        currentFilter = (currentFilter === cat && !currentSubFilter) ? '' : cat;
        currentSubFilter = '';
        buildCategoryChips();
        buildLegend(); renderMap();
        window.closePanel(); window.closeMobileCard();
      });
    });
    legend.querySelectorAll('.legend-expand-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const catId = btn.getAttribute('data-for');
        const subsList = document.getElementById('legend-subs-' + catId);
        if (subsList) {
          const isOpen = subsList.style.display !== 'none';
          subsList.style.display = isOpen ? 'none' : 'block';
          btn.textContent = isOpen ? '▸' : '▾';
        }
      });
    });
    legend.querySelectorAll('.legend-subitem').forEach(item => {
      item.addEventListener('click', () => {
        const cat = item.dataset.cat;
        const sub = item.dataset.sub;
        if (currentFilter === cat && currentSubFilter === sub) {
          currentSubFilter = '';
        } else {
          currentFilter = cat; currentSubFilter = sub;
        }
        buildCategoryChips();
        buildLegend(); renderMap();
        window.closePanel(); window.closeMobileCard();
      });
    });
  }

  /* ── Filter chips ───────────────────────────────── */
  function buildCategoryChips() {
    const wrap = document.getElementById('mapChips');
    if (!wrap) return;
    const allActive = !currentFilter && !currentSubFilter && !currentMoodFilter;
    let html = '<div class="map-chip' + (allActive ? ' active' : '') + '" data-cat="">ყველა</div>';
    usedCategoryEntries().forEach(cat => {
      html += '<div class="map-chip' + (currentFilter === cat.id && !currentSubFilter && !currentMoodFilter ? ' active' : '') + '" data-cat="' + esc(cat.id) + '">'
        + esc((cat.icon || '') + ' ' + stripLeadingIcon(cat.icon, cat.labelKa || cat.labelEn || cat.label || cat.id || 'Category'))
        + '</div>';
    });
    // Divider before mood chips
    html += '<div class="map-chip-divider"></div>';
    MOOD_TAGS.forEach(tag => {
      html += '<div class="map-chip map-chip--mood' + (currentMoodFilter === tag.id ? ' active' : '') + '"' +
        ' data-mood="' + esc(tag.id) + '"' +
        ' style="--mood-chip-color:' + (tag.color || '#10b981') + '">' +
        esc(tag.emoji + ' ' + tag.label) + '</div>';
    });
    wrap.innerHTML = html;
    attachFilters();
  }

  function attachFilters() {
    document.querySelectorAll('.map-chip').forEach(chip => chip.addEventListener('click', () => {
      const moodId = chip.dataset.mood || '';
      document.querySelectorAll('.map-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      if (moodId) {
        // Mood tag chip — toggle mood filter, clear category filter
        currentMoodFilter = currentMoodFilter === moodId ? '' : moodId;
        if (currentMoodFilter) chip.classList.toggle('active', true);
        else {
          chip.classList.remove('active');
          document.querySelector('.map-chip[data-cat=""]')?.classList.add('active');
        }
        currentFilter = '';
        currentSubFilter = '';
      } else {
        currentFilter = chip.dataset.cat || '';
        currentSubFilter = '';
        currentMoodFilter = '';
      }
      window.closePanel(); window.closeMobileCard();
      buildLegend();
      renderMap();
    }));
    const search   = document.getElementById('mapSearchInput');
    const dropdown = document.getElementById('mapSearchDropdown');
    if (search && !search.dataset.mapSearchBound) {
      search.dataset.mapSearchBound = '1';
      let acIndex = -1;
      function closeDropdown() {
        if (dropdown) { dropdown.innerHTML = ''; dropdown.classList.remove('open'); }
        acIndex = -1;
      }
      function openDropdown(q) {
        if (!dropdown || !q) { closeDropdown(); return; }
        const matches = allPlaces.filter(p =>
          (p.name + ' ' + p.categoryLabel + ' ' + p.city).toLowerCase().includes(q.toLowerCase())
        ).slice(0, 8);
        if (!matches.length) { closeDropdown(); return; }
        dropdown.innerHTML = matches.map((p, i) =>
          '<div class="map-search-suggestion" data-idx="' + i + '" data-id="' + esc(p.id) + '">'
          + '<span class="sug-icon">' + (p.icon || getPlaceMarkerStyle(p).icon || '📍') + '</span>'
          + '<span class="sug-text"><span class="sug-name">' + esc(p.name) + '</span>'
          + '<span class="sug-cat">' + esc(p.categoryLabel) + (p.city ? ' · ' + esc(p.city) : '') + '</span></span>'
          + '</div>'
        ).join('');
        dropdown.classList.add('open');
        dropdown.querySelectorAll('.map-search-suggestion').forEach(item => {
          item.addEventListener('mousedown', e => {
            e.preventDefault();
            const place = matches[Number(item.dataset.idx)];
            if (!place) return;
            search.value = place.name;
            currentSearch = '';
            closeDropdown();
            renderMap();
            focusPlace(place.id);
          });
        });
        acIndex = -1;
      }
      search.addEventListener('input', e => {
        currentSearch = e.target.value || '';
        renderMap();
        openDropdown(currentSearch);
      });
      search.addEventListener('keydown', e => {
        const items = dropdown ? dropdown.querySelectorAll('.map-search-suggestion') : [];
        if (!items.length) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); acIndex = Math.min(acIndex + 1, items.length - 1); items.forEach((el, i) => el.classList.toggle('active', i === acIndex)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); acIndex = Math.max(acIndex - 1, 0); items.forEach((el, i) => el.classList.toggle('active', i === acIndex)); }
        else if (e.key === 'Enter' && acIndex >= 0) { items[acIndex].dispatchEvent(new MouseEvent('mousedown')); }
        else if (e.key === 'Escape') { closeDropdown(); }
      });
      search.addEventListener('blur', () => { setTimeout(closeDropdown, 150); });
    }
  }

  /* ── Firestore load ─────────────────────────────── */
  function loadCollection(name) {
    const GF = window.GeoFirebase;
    if (!GF || !GF.db || !GF.fs) return Promise.resolve([]);
    return GF.fs.getDocs(GF.fs.query(GF.fs.collection(GF.db, name), GF.fs.limit(100))).then(snap => {
      const out = [];
      snap.forEach(d => { const p = normalize(d.id, d.data(), name); if (p) out.push(p); });
      return out;
    }).catch(err => { console.warn('[Map] ' + name, err.message); return []; });
  }

  function loadMoodTagCounts() {
    const GF = window.GeoFirebase;
    if (!GF || !GF.db || !GF.fs) return Promise.resolve();
    return GF.fs.getDocs(GF.fs.collection(GF.db, 'placeMoodTags')).then(snap => {
      snap.forEach(d => { _moodTagCounts[d.id] = d.data(); });
    }).catch(() => {});
  }

  function loadRealPlaces() {
    Promise.all([loadCollection('places'), loadCollection('businesses'), loadMoodTagCounts()]).then(([places, businesses]) => {
      allPlaces = places.concat(businesses);
      buildCategoryChips();
      renderMap();
    });
  }

  /* ── Events on Map ─────────────────────────────── */
  function tsToMs(v) {
    if (!v) return 0;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (v.seconds) return v.seconds * 1000;
    if (v instanceof Date) return v.getTime();
    return new Date(v).getTime() || 0;
  }

  function isThisWeekend(v) {
    const ms = tsToMs(v);
    if (!ms) return false;
    const now = new Date(), d = new Date(ms);
    const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat
    const daysUntilFri = (5 - dayOfWeek + 7) % 7;
    const daysUntilSun = (7 - dayOfWeek) % 7 || 7;
    const fri = new Date(now); fri.setDate(now.getDate() + (daysUntilFri === 0 ? 0 : daysUntilFri));
    fri.setHours(0,0,0,0);
    const sun = new Date(now); sun.setDate(now.getDate() + daysUntilSun);
    sun.setHours(23,59,59,999);
    return d >= fri && d <= sun;
  }

  function loadEvents() {
    const GF = window.GeoFirebase;
    if (!GF || !GF.db || !GF.fs) return;
    GF.fs.getDocs(GF.fs.query(GF.fs.collection(GF.db, 'events'), GF.fs.limit(200))).then(snap => {
      allEvents = [];
      snap.forEach(d => {
        const ev = Object.assign({ id: d.id }, d.data());
        const lat = Number(ev.lat || ev.latitude || 0);
        const lng = Number(ev.lng || ev.longitude || ev.lon || 0);
        if (lat && lng) { ev.lat = lat; ev.lng = lng; allEvents.push(ev); }
      });
      if (showEvents) renderEventMarkers();
    }).catch(() => {});
  }

  function renderEventMarkers() {
    eventMarkers.forEach(m => m.remove());
    eventMarkers = [];
    if (!showEvents || !map) return;
    const now = Date.now();
    const eventsToShow = allEvents.filter(ev => {
      const ms = tsToMs(ev.date || ev.startDate);
      if (ms && ms < now) return false; // past event
      if (showThisWeekend && !isThisWeekend(ev.date || ev.startDate)) return false;
      return true;
    });
    eventsToShow.forEach(ev => {
      const el = document.createElement('div');
      el.className = 'gh-event-marker';
      el.textContent = '🎉';
      el.title = ev.title || ev.name || 'Event';
      el.addEventListener('click', () => _openEventPanel(ev));
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([ev.lng, ev.lat])
        .addTo(map);
      eventMarkers.push(marker);
    });
  }

  function _openEventPanel(ev) {
    const dateVal = ev.date || ev.startDate;
    const ms = tsToMs(dateVal);
    const dateStr = ms ? new Date(ms).toLocaleDateString('ka-GE', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    const panel = document.getElementById('infoPanel');
    if (!panel) return;

    const img = ev.imageUrl || ev.image || ev.coverImage || ev.coverImageUrl || '';
    const panelImg = document.getElementById('panelImg');
    const panelImgFb = document.getElementById('panelImgFallback');
    if (img) {
      panelImg.src = img; panelImg.style.display = '';
      if (panelImgFb) panelImgFb.style.display = 'none';
    } else {
      panelImg.style.display = 'none';
      if (panelImgFb) { panelImgFb.style.display = ''; panelImgFb.textContent = '🎉'; }
    }

    const panelTitle = document.getElementById('panelTitle');
    const panelCat   = document.getElementById('panelCat');
    const panelLoc   = document.getElementById('panelLoc');
    const panelDesc  = document.getElementById('panelDesc');
    const panelRating = document.getElementById('panelRating');
    if (panelTitle) panelTitle.textContent = ev.title || ev.name || 'Event';
    if (panelCat)   panelCat.textContent   = '🎉 Event' + (ev.category ? ' · ' + ev.category : '');
    if (panelLoc)   panelLoc.textContent   = (dateStr ? '📅 ' + dateStr : '') + (ev.location || ev.venue ? '  📍 ' + (ev.location || ev.venue) : '');
    if (panelDesc)  panelDesc.textContent  = ev.description || '';
    if (panelRating) panelRating.textContent = ev.rsvpCount ? '👥 ' + ev.rsvpCount + ' going' : '';

    const detailBtn = document.getElementById('panelDetailBtn');
    if (detailBtn) { detailBtn.href = 'events.html'; detailBtn.removeAttribute('aria-disabled'); }
    const mapBtn = document.getElementById('panelMapBtn');
    if (mapBtn && ev.lat && ev.lng) mapBtn.href = 'https://maps.google.com/?q=' + ev.lat + ',' + ev.lng;

    const checkinBtn = document.getElementById('panelCheckinBtn');
    if (checkinBtn) checkinBtn.style.display = 'none';
    const moodTags = document.getElementById('panelMoodTags');
    if (moodTags) moodTags.innerHTML = '';

    panel.classList.add('open');
    map.flyTo({ center: [ev.lng, ev.lat], zoom: Math.max(map.getZoom(), 14) });
  }

  window.toggleEventsLayer = function() {
    showEvents = !showEvents;
    const btn = document.getElementById('eventsToggleBtn');
    if (btn) btn.classList.toggle('active', showEvents);
    const wkBtn = document.getElementById('weekendToggleBtn');
    if (wkBtn) wkBtn.style.display = showEvents ? '' : 'none';
    if (!showEvents) { showThisWeekend = false; if (wkBtn) wkBtn.classList.remove('active'); }
    if (showEvents) loadEvents();
    else { eventMarkers.forEach(m => m.remove()); eventMarkers = []; }
  };

  window.toggleThisWeekend = function() {
    showThisWeekend = !showThisWeekend;
    const btn = document.getElementById('weekendToggleBtn');
    if (btn) btn.classList.toggle('active', showThisWeekend);
    if (showEvents) renderEventMarkers();
  };

  /* ── Map style toggle ───────────────────────────── */
  function getMapStyle() {
    const v = localStorage.getItem('gh_map_style');
    return TILE_LAYERS[v] ? v : 'dark';
  }

  /* ── Mobile sidebar bottom sheet (3-state: closed / peek / expanded) ── */
  function buildMobileSidebar() {
    if (window.innerWidth > 768) return;
    const sidebar = document.getElementById('mapSidebar');
    const pull    = document.getElementById('sidebarPull');
    if (!sidebar || !pull) return;

    function getState() {
      if (sidebar.classList.contains('sb-expanded')) return 'expanded';
      if (sidebar.classList.contains('sb-peek'))     return 'peek';
      return 'closed';
    }

    function setState(state) {
      sidebar.classList.remove('sb-expanded', 'sb-peek', 'sb-closed');
      sidebar.classList.add('sb-' + state);
      // Only allow scroll when fully expanded — prevents scroll interfering with drag
      sidebar.style.overflowY = state === 'expanded' ? 'auto' : 'hidden';
    }

    // Start collapsed — only 3 bars visible
    setState('closed');

    let startY = 0, dy = 0, dragging = false;

    pull.addEventListener('touchstart', e => {
      startY = e.touches[0].clientY;
      dy = 0;
      dragging = true;
      sidebar.style.transition = 'none';
    }, { passive: true });

    pull.addEventListener('touchmove', e => {
      if (!dragging) return;
      e.preventDefault();
      dy = e.touches[0].clientY - startY;
      const h = sidebar.offsetHeight;
      const state = getState();
      const base = state === 'expanded' ? 0 : state === 'peek' ? (h - 220) : (h - 48);
      const clamped = Math.max(0, Math.min(h - 48, base + dy));
      sidebar.style.transform = 'translateY(' + clamped + 'px)';
    }, { passive: false });

    pull.addEventListener('touchend', () => {
      if (!dragging) return;
      dragging = false;
      const state = getState();
      let next = state;
      if      (state === 'expanded' && dy >  50) next = 'peek';
      else if (state === 'peek'     && dy < -50) next = 'expanded';
      else if (state === 'peek'     && dy >  50) next = 'closed';
      else if (state === 'closed'   && dy < -40) next = 'peek';
      // Set class FIRST so CSS target is correct before inline styles are cleared
      setState(next);
      sidebar.style.transition = '';
      sidebar.style.transform = '';
    });

    // Tap the handle to cycle states
    pull.addEventListener('click', () => {
      const s = getState();
      setState(s === 'closed' ? 'peek' : s === 'peek' ? 'expanded' : 'peek');
    });

    // Tap map → collapse to peek if expanded
    const mapEl = document.getElementById('map');
    if (mapEl) mapEl.addEventListener('click', () => {
      if (getState() === 'expanded') setState('peek');
    });
  }

  /* ── Check-ins ──────────────────────────────────── */
  function loadUserCheckins() {
    const GF = window.GeoFirebase, user = window.GeoCurrentUser;
    if (!GF || !user) return;
    GF.fs.getDocs(GF.fs.collection(GF.db, 'users', user.uid, 'checkins'))
      .then(snap => snap.forEach(d => userCheckins.add(d.id)))
      .catch(() => {});
  }

  function _haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371, toR = Math.PI / 180;
    const dLat = (lat2 - lat1) * toR, dLng = (lng2 - lng1) * toR;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*toR)*Math.cos(lat2*toR)*Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  function _doCheckin(placeId, p, GF, user) {
    const ts = GF.fs.serverTimestamp(), inc = GF.fs.increment(1);
    GF.fs.setDoc(GF.fs.doc(GF.db, 'placeCheckins', placeId), { count: inc, lastCheckin: ts }, { merge: true }).catch(() => {});
    GF.fs.setDoc(GF.fs.doc(GF.db, 'users', user.uid, 'checkins', placeId), { count: inc, lastCheckin: ts, placeName: p.name, city: p.city || '' }, { merge: true }).catch(() => {});
    userCheckins.add(placeId);
    if (navigator.vibrate) navigator.vibrate([30, 40, 60]);
    _syncCheckinBtn(placeId, true);
    _updateStreak(placeId, p, GF, user);
    setTimeout(() => _openReviewModal(placeId, p, GF, user), 800);
  }

  function _updateStreak(placeId, p, GF, user) {
    const userRef = GF.fs.doc(GF.db, 'users', user.uid);
    GF.fs.getDoc(userRef).then(snap => {
      const d = snap.data() || {};
      const today = new Date().toISOString().slice(0, 10);
      const last = d.lastCheckinDate || '';
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      let streak = Number(d.streakDays) || 0;
      if (last === today) return; // already counted today
      streak = last === yesterday ? streak + 1 : 1;
      const xp = (Number(d.xp) || 0) + 10 + (streak > 1 ? Math.min(streak, 10) : 0);
      GF.fs.updateDoc(userRef, {
        lastCheckinDate: today,
        streakDays: streak,
        totalCheckins: GF.fs.increment(1),
        xp
      }).catch(() => {});
      _showStreakToast(streak, xp - ((Number(d.xp) || 0)));
    }).catch(() => {});
  }

  function _showStreakToast(streak, xpGained) {
    const _t = window.GHt || (k => k);
    const msg = streak > 1
      ? _t('ci_streak_n').replace('{n}', streak).replace('{xp}', xpGained)
      : _t('ci_streak_1').replace('{xp}', xpGained);
    const rewardLabel = _t('ci_view_rewards');
    const el = document.createElement('div');
    el.className = 'map-checkin-toast map-checkin-toast--reward';
    el.innerHTML = '<span>' + msg + '</span>' +
      '<a href="rewards.html" class="map-checkin-reward-link">' + rewardLabel + '</a>';
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('map-checkin-toast--show'), 10);
    setTimeout(() => { el.classList.remove('map-checkin-toast--show'); setTimeout(() => el.remove(), 400); }, 4000);
  }

  function _openReviewModal(placeId, p, GF, user) {
    const existing = document.getElementById('mapReviewModal');
    if (existing) existing.remove();

    let rating = 0;
    const modal = document.createElement('div');
    modal.id = 'mapReviewModal';
    modal.className = 'map-review-overlay';
    const _t = window.GHt || (k => k);
    modal.innerHTML = `
      <div class="map-review-modal">
        <button class="map-review-close" id="reviewClose"><i class="fas fa-times"></i></button>
        <div class="map-review-title">${_t('ci_rate_visit')}</div>
        <div class="map-review-place">${esc(p.name)}</div>
        <div class="map-review-stars" id="reviewStars">
          ${[1,2,3,4,5].map(i => `<button class="map-review-star" data-star="${i}">★</button>`).join('')}
        </div>
        <textarea class="map-review-text" id="reviewText" placeholder="${_t('ci_share_exp')}" rows="3"></textarea>
        <button class="map-review-submit" id="reviewSubmit" disabled>${_t('ci_skip')}</button>
      </div>`;
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('open'), 10);

    const submitBtn = document.getElementById('reviewSubmit');
    const stars = modal.querySelectorAll('.map-review-star');

    stars.forEach(btn => btn.addEventListener('click', () => {
      rating = Number(btn.dataset.star);
      stars.forEach(s => s.classList.toggle('active', Number(s.dataset.star) <= rating));
      submitBtn.disabled = false;
      submitBtn.textContent = _t('ci_submit_review');
    }));

    function close() { modal.classList.remove('open'); setTimeout(() => modal.remove(), 280); }
    document.getElementById('reviewClose').onclick = close;
    modal.addEventListener('click', e => { if (e.target === modal) close(); });

    submitBtn.onclick = () => {
      if (!rating) { close(); return; }
      const text = (document.getElementById('reviewText') || {}).value || '';
      submitBtn.disabled = true; submitBtn.textContent = _t('ci_saving');
      const reviewData = {
        userId: user.uid,
        userName: user.displayName || user.email || 'GeoHub User',
        userAvatar: user.photoURL || '',
        rating,
        text,
        placeId,
        placeName: p.name,
        createdAt: GF.fs.serverTimestamp()
      };
      GF.fs.setDoc(GF.fs.doc(GF.db, 'placeReviews', placeId, 'reviews', user.uid), reviewData, { merge: true })
        .then(() => {
          // Update aggregate rating on place doc
          return GF.fs.getDoc(GF.fs.doc(GF.db, 'placeReviews', placeId)).then(snap => {
            const d2 = snap.data() || {};
            const count = (d2.reviewCount || 0) + (snap.exists() ? 0 : 1);
            const sum = (d2.ratingSum || 0) + rating;
            return GF.fs.setDoc(GF.fs.doc(GF.db, 'placeReviews', placeId), { reviewCount: GF.fs.increment(1), ratingSum: GF.fs.increment(rating), avgRating: sum / Math.max(count, 1) }, { merge: true });
          });
        })
        .then(() => { close(); _showStreakToast && _showReviewThanks(); })
        .catch(() => { close(); });
    };
  }

  function _showReviewThanks() {
    const _t = window.GHt || (k => k);
    const msg = _t('ci_review_thanks');
    if (window.GeoSocial && window.GeoSocial.toast) { window.GeoSocial.toast(msg); return; }
    const el = document.createElement('div');
    el.className = 'map-checkin-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('map-checkin-toast--show'), 10);
    setTimeout(() => { el.classList.remove('map-checkin-toast--show'); setTimeout(() => el.remove(), 400); }, 2500);
  }

  window.checkInToPlace = function () {
    const btn = document.getElementById('panelCheckinBtn');
    const mBtn = document.getElementById('mpcCheckinBtn');
    const placeId = (btn && btn.dataset.placeId) || (mBtn && mBtn.dataset.placeId);
    if (!placeId) return;
    const GF = window.GeoFirebase, user = window.GeoCurrentUser;
    if (!GF || !user) { if (window.GeoSocial && window.GeoSocial.requireAuth) window.GeoSocial.requireAuth(); return; }
    if (userCheckins.has(placeId)) return;
    const p = allPlaces.find(x => x.id === placeId);
    if (!p) return;

    if (!navigator.geolocation) { _doCheckin(placeId, p, GF, user); return; }

    navigator.geolocation.getCurrentPosition(
      pos => {
        const dist = _haversineKm(pos.coords.latitude, pos.coords.longitude, p.lat, p.lng);
        if (dist > 0.01) {
          const _t = window.GHt || (k => k);
          if (window.GeoSocial && window.GeoSocial.toast) window.GeoSocial.toast(_t('ci_too_far').replace('{m}', Math.round(dist * 1000)));
          return;
        }
        _doCheckin(placeId, p, GF, user);
      },
      () => {
        const _t = window.GHt || (k => k);
        if (window.GeoSocial && window.GeoSocial.toast) window.GeoSocial.toast(_t('ci_enable_loc'));
      },
      { timeout: 8000, maximumAge: 60000, enableHighAccuracy: false }
    );
  };

  function _syncCheckinBtn(placeId, checkedIn) {
    [document.getElementById('panelCheckinBtn'), document.getElementById('mpcCheckinBtn')].forEach(btn => {
      if (!btn || btn.dataset.placeId !== placeId) return;
      btn.classList.toggle('checked-in', checkedIn);
      btn.innerHTML = checkedIn
        ? '<i class="fas fa-check-circle"></i> Checked In'
        : '<i class="fas fa-map-pin"></i> Check In';
    });
  }

  function _setupCheckinBtn(id, placeId) {
    const btn = document.getElementById(id); if (!btn) return;
    btn.dataset.placeId = placeId;
    btn.style.display = '';
    const ci = userCheckins.has(placeId);
    btn.classList.toggle('checked-in', ci);
    btn.innerHTML = ci
      ? '<i class="fas fa-check-circle"></i> Checked In'
      : '<i class="fas fa-map-pin"></i> Check In';
  }

  /* ── Mood Tags ──────────────────────────────────── */
  function _moodTagsHtml(placeId, counts, votes) {
    // Sort: voted first, then by count descending
    const sorted = [...MOOD_TAGS].sort((a, b) => {
      const va = votes[a.id] === true ? 1 : 0;
      const vb = votes[b.id] === true ? 1 : 0;
      if (vb !== va) return vb - va;
      return (counts[b.id] || 0) - (counts[a.id] || 0);
    });
    return '<div class="mood-tags-title"><i class="fas fa-fire-alt"></i> Vibes — tap to vote</div>' +
      '<div class="mood-tags-list">' +
      sorted.map(t => {
        const c = counts[t.id] || 0;
        const v = votes[t.id] === true;
        return '<button class="mood-tag' + (v ? ' voted' : '') + (c === 0 && !v ? ' zero' : '') + '"' +
          ' style="--tag-color:' + (t.color || '#10b981') + '"' +
          ' onclick="toggleMoodTag(\'' + placeId + '\',\'' + t.id + '\',this)">' +
          t.emoji + ' ' + t.label +
          (c > 0 ? ' <span class="mood-tag-count">' + c + '</span>' : '') +
          '</button>';
      }).join('') +
      '</div>';
  }

  function _loadMoodTags(placeId) {
    const GF = window.GeoFirebase, user = window.GeoCurrentUser;
    const render = (counts, votes) => {
      const html = _moodTagsHtml(placeId, counts, votes);
      ['panelMoodTags', 'mpcMoodTags'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = html; });
    };
    if (!GF) { render({}, {}); return; }
    GF.fs.getDoc(GF.fs.doc(GF.db, 'placeMoodTags', placeId)).then(snap => {
      const counts = snap.exists() ? snap.data() : {};
      if (!user) { render(counts, {}); return; }
      if (userMoodVotes[placeId] !== undefined) { render(counts, userMoodVotes[placeId]); return; }
      GF.fs.getDoc(GF.fs.doc(GF.db, 'users', user.uid, 'moodTagVotes', placeId))
        .then(vs => { const votes = vs.exists() ? vs.data() : {}; userMoodVotes[placeId] = votes; render(counts, votes); })
        .catch(() => render(counts, {}));
    }).catch(() => render({}, {}));
  }

  window.toggleMoodTag = function(placeId, tagId, btn) {
    const GF = window.GeoFirebase, user = window.GeoCurrentUser;
    if (!GF || !user) { if (window.GeoSocial && window.GeoSocial.requireAuth) window.GeoSocial.requireAuth(); return; }
    if (!userMoodVotes[placeId]) userMoodVotes[placeId] = {};
    const wasVoted = userMoodVotes[placeId][tagId] === true;
    const newVoted = !wasVoted;
    userMoodVotes[placeId][tagId] = newVoted;
    const delta = newVoted ? 1 : -1;

    // Update every mood-tag button with this tagId in all containers
    ['panelMoodTags', 'mpcMoodTags'].forEach(id => {
      const wrap = document.getElementById(id); if (!wrap) return;
      const b = wrap.querySelector('[onclick*="\'' + tagId + '\'"]'); if (!b) return;
      b.classList.toggle('voted', newVoted);
      const ce = b.querySelector('.mood-tag-count');
      const cur = ce ? (parseInt(ce.textContent) || 0) : 0;
      const next = Math.max(0, cur + delta);
      if (next > 0) { if (ce) ce.textContent = next; else { const s = document.createElement('span'); s.className = 'mood-tag-count'; s.textContent = next; b.appendChild(s); } }
      else if (ce) ce.remove();
    });

    // Keep local cache in sync for mood filter
    if (!_moodTagCounts[placeId]) _moodTagCounts[placeId] = {};
    _moodTagCounts[placeId][tagId] = Math.max(0, (_moodTagCounts[placeId][tagId] || 0) + delta);

    const tagUpd = {}; tagUpd[tagId] = GF.fs.increment(delta);
    GF.fs.setDoc(GF.fs.doc(GF.db, 'placeMoodTags', placeId), tagUpd, { merge: true }).catch(() => {});
    const voteUpd = {}; voteUpd[tagId] = newVoted;
    GF.fs.setDoc(GF.fs.doc(GF.db, 'users', user.uid, 'moodTagVotes', placeId), voteUpd, { merge: true }).catch(() => {});
  };

  /* ── Heatmap ────────────────────────────────────── */
  function initHeatmapLayer() {
    if (map.getSource('gh-heat-src')) return;
    map.addSource('gh-heat-src', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
    map.addLayer({
      id: 'gh-heat-layer',
      type: 'heatmap',
      source: 'gh-heat-src',
      maxzoom: 17,
      layout: { visibility: heatmapVisible ? 'visible' : 'none' },
      paint: {
        'heatmap-weight': ['interpolate', ['linear'], ['get', 'w'], 0, 0.4, 5, 1],
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 5, 0.6, 10, 1.6, 15, 2.2],
        'heatmap-color': [
          'interpolate', ['linear'], ['heatmap-density'],
          0,    'rgba(16,185,129,0)',
          0.15, 'rgba(16,185,129,0.35)',
          0.35, 'rgba(14,165,233,0.55)',
          0.55, 'rgba(139,92,246,0.7)',
          0.75, 'rgba(245,158,11,0.82)',
          1,    'rgba(239,68,68,0.92)'
        ],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 4, 16, 9, 30, 14, 55],
        'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0.8, 16, 0.2]
      }
    });
  }

  function updateHeatmapData() {
    const src = map && map.getSource('gh-heat-src');
    if (!src) return;

    // Merge: static place ratings baseline + real-time check-in activity
    const placeFeatures = allPlaces
      .filter(p => p.lat && p.lng)
      .map(p => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { w: p.rating ? Math.max(0.3, p.rating * 0.5) : 0.3 }
      }));

    const checkinFeatures = _heatmapCheckinData.map(c => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
      properties: { w: c.w }
    }));

    src.setData({ type: 'FeatureCollection', features: [...placeFeatures, ...checkinFeatures] });
  }

  // Load recent check-ins from Firestore and feed them to the heatmap
  function loadHeatmapCheckins() {
    const GF = window.GeoFirebase;
    if (!GF || !GF.fs || !GF.db) return;
    const fs = GF.fs, db = GF.db;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h
    try {
      fs.getDocs(
        fs.query(
          fs.collection(db, 'checkins'),
          fs.where('createdAt', '>=', since),
          fs.orderBy('createdAt', 'desc'),
          fs.limit(500)
        )
      ).then(function(snap) {
        // Group by place (lat+lng rounded to 3dp) so busy places get higher weight
        const groups = {};
        snap.forEach(function(d) {
          const data = d.data();
          if (!data.lat || !data.lng) return;
          const key = data.lat.toFixed(3) + ',' + data.lng.toFixed(3);
          if (!groups[key]) groups[key] = { lat: data.lat, lng: data.lng, count: 0 };
          groups[key].count++;
        });
        _heatmapCheckinData = Object.values(groups).map(function(g) {
          return { lat: g.lat, lng: g.lng, w: Math.min(5, 0.5 + g.count * 0.8) };
        });
        updateHeatmapData();
        _updateHeatmapBadge(snap.size);
        const note = document.getElementById('heatmapLegendNote');
        if (note) note.textContent = snap.size + ' check-in' + (snap.size !== 1 ? 's' : '') + ' in last 24h';
      }).catch(function() {
        // Fallback to static place data only
        updateHeatmapData();
      });
    } catch(e) {
      updateHeatmapData();
    }
  }

  function _updateHeatmapBadge(count) {
    const badge = document.getElementById('heatmapCheckinBadge');
    if (badge) {
      badge.textContent = count > 0 ? (count > 99 ? '99+' : String(count)) : '';
      badge.style.display = count > 0 ? '' : 'none';
    }
  }

  window.toggleHeatmap = function () {
    heatmapVisible = !heatmapVisible;
    if (map && map.getLayer('gh-heat-layer')) {
      map.setLayoutProperty('gh-heat-layer', 'visibility', heatmapVisible ? 'visible' : 'none');
    }
    const btn = document.getElementById('heatmapBtn');
    if (btn) btn.classList.toggle('active', heatmapVisible);
    const legend = document.getElementById('heatmapLegend');
    if (legend) legend.classList.toggle('visible', heatmapVisible);
  };

  function buildHeatmapControl() {
    const container = document.querySelector('.map-container');
    if (!container || document.getElementById('heatmapControl')) return;

    // Main button
    const ctrl = document.createElement('div');
    ctrl.id = 'heatmapControl';
    ctrl.className = 'heatmap-control';
    ctrl.innerHTML =
      '<button id="heatmapBtn" class="heatmap-btn" onclick="toggleHeatmap()" title="სიმჭიდროვე">' +
        '<span class="heatmap-btn-icon">🔥</span>' +
        '<span class="heatmap-btn-label">სიმჭ.</span>' +
        '<span id="heatmapCheckinBadge" class="heatmap-badge" style="display:none"></span>' +
      '</button>';
    container.appendChild(ctrl);

    // Legend (hidden until heatmap is on)
    const legend = document.createElement('div');
    legend.id = 'heatmapLegend';
    legend.className = 'heatmap-legend';
    legend.innerHTML =
      '<div class="heatmap-legend-title">🔥 სიმჭიდროვე (24 სთ)</div>' +
      '<div class="heatmap-legend-bar">' +
        '<div class="heatmap-legend-gradient"></div>' +
        '<div class="heatmap-legend-labels"><span>წყნარი</span><span>გადატვ.</span><span>🔥 ცხელი</span></div>' +
      '</div>' +
      '<div class="heatmap-legend-note" id="heatmapLegendNote">იტვირთება…</div>';
    container.appendChild(legend);
  }

  function applyMapStyle(styleName) {
    const cfg = TILE_LAYERS[styleName] || TILE_LAYERS.dark;
    // Remove HTML markers before style change (they'd be dangling otherwise)
    clusterMarkers.forEach(m => m.remove());
    clusterMarkers = [];
    map.setStyle(cfg.style);
    map.once('style.load', () => { initHeatmapLayer(); updateHeatmapData(); updateClusters(); });
    localStorage.setItem('gh_map_style', styleName);
    const mapEl = document.getElementById('map');
    if (mapEl) mapEl.setAttribute('data-map-style', styleName);
    document.querySelectorAll('.map-style-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.style === styleName);
    });
  }

  function buildStyleToggle() {
    const container = document.querySelector('.map-container');
    if (!container || document.getElementById('mapStyleToggle')) return;
    const wrap = document.createElement('div');
    wrap.id = 'mapStyleToggle';
    wrap.className = 'map-style-toggle';
    const current = getMapStyle();
    Object.entries(TILE_LAYERS).forEach(([key, cfg]) => {
      const btn = document.createElement('button');
      btn.className = 'map-style-btn' + (key === current ? ' active' : '');
      btn.dataset.style = key;
      btn.textContent = cfg.label;
      btn.addEventListener('click', () => applyMapStyle(key));
      wrap.appendChild(btn);
    });
    container.appendChild(wrap);
  }

  /* ── Rotation hint overlay ──────────────────────── */
  function buildRotationHint() {
    const container = document.querySelector('.map-container');
    if (!container || document.getElementById('rotationHint')) return;
    const hint = document.createElement('div');
    hint.id = 'rotationHint';
    hint.className = 'rotation-hint';
    hint.innerHTML = '<span>🖱️ მარჯვენა ღილი: ბრუნვა &nbsp;|&nbsp; Ctrl+ეწევი: დახრა &nbsp;|&nbsp; ორი თითი: მობილურზე</span>';
    container.appendChild(hint);
    setTimeout(() => hint.classList.add('fade-out'), 5000);
    setTimeout(() => hint.remove(), 6200);
  }

  /* ── Live Friend Locations ──────────────────────── */

  function buildLiveFriendsUI() {
    const container = document.querySelector('.map-container');
    if (!container || document.getElementById('liveFriendsBtn')) return;

    // Floating button
    const btn = document.createElement('button');
    btn.id = 'liveFriendsBtn';
    btn.className = 'map-live-btn';
    btn.title = 'Live friends';
    btn.innerHTML = '<i class="fas fa-user-friends"></i>';
    btn.onclick = window.openLivePanel;
    container.appendChild(btn);

    // Side panel
    const panel = document.createElement('div');
    panel.id = 'livePanel';
    panel.className = 'map-live-panel';
    function _t(k, fb) { return (typeof GHt === 'function' ? GHt(k) : null) || fb; }
    panel.innerHTML =
      '<div class="live-panel-head">' +
        '<span><i class="fas fa-satellite-dish"></i> ' + _t('live_friends', 'Live Friends') + '</span>' +
        '<button onclick="window.closeLivePanel()"><i class="fas fa-times"></i></button>' +
      '</div>' +
      '<div class="live-toggle-row">' +
        '<div class="live-toggle-text">' +
          '<div class="live-toggle-label">' + _t('loc_share_my', 'Share my location') + '</div>' +
          '<div class="live-toggle-sub" id="locShareStatus">' + _t('loc_share_sub', 'Visible to friends only') + '</div>' +
        '</div>' +
        '<label class="live-toggle-switch">' +
          '<input type="checkbox" id="locShareToggle">' +
          '<span class="live-toggle-slider"></span>' +
        '</label>' +
      '</div>' +
      '<div class="live-duration-row" id="liveDurationRow" style="display:none;padding:8px 14px 4px;gap:6px;display:none;flex-wrap:wrap">' +
        '<span style="font-size:.78rem;color:var(--gh-muted,#94a3b8);flex-basis:100%;margin-bottom:4px">' + _t('loc_share_for', 'Share for:') + '</span>' +
        '<button class="live-dur-btn active" data-dur="900" onclick="window._setLocDuration(900,this)">15 ' + _t('min', 'min') + '</button>' +
        '<button class="live-dur-btn" data-dur="3600" onclick="window._setLocDuration(3600,this)">1 ' + _t('hour', 'hour') + '</button>' +
        '<button class="live-dur-btn" data-dur="28800" onclick="window._setLocDuration(28800,this)">8 ' + _t('hours', 'hours') + '</button>' +
      '</div>' +
      '<div class="live-friends-list" id="liveFriendsList">' +
        '<div class="live-friends-empty"><i class="fas fa-user-slash"></i><span>' + _t('loc_no_friends', 'No friends sharing location') + '</span></div>' +
      '</div>';
    container.appendChild(panel);

    var _locDurationSec = 900;
    var _locStopTimer = null;

    window._setLocDuration = function(sec, btn) {
      _locDurationSec = sec;
      var btns = panel.querySelectorAll('.live-dur-btn');
      btns.forEach(function(b){ b.classList.remove('active'); });
      if(btn) btn.classList.add('active');
      if(_locSharing) {
        if(_locStopTimer) clearTimeout(_locStopTimer);
        _locStopTimer = setTimeout(function() {
          var tog = document.getElementById('locShareToggle');
          if(tog) tog.checked = false;
          stopSharingLocation();
          var status = document.getElementById('locShareStatus');
          if(status) status.textContent = _t('loc_share_sub', 'Visible to friends only');
          var dur = document.getElementById('liveDurationRow');
          if(dur) dur.style.display = 'none';
        }, sec * 1000);
      }
    };

    document.getElementById('locShareToggle').addEventListener('change', function () {
      var durRow = document.getElementById('liveDurationRow');
      var status = document.getElementById('locShareStatus');
      if (this.checked) {
        startSharingLocation();
        if(durRow) durRow.style.display = 'flex';
        if(_locStopTimer) clearTimeout(_locStopTimer);
        _locStopTimer = setTimeout(function() {
          var tog = document.getElementById('locShareToggle');
          if(tog) tog.checked = false;
          stopSharingLocation();
          if(status) status.textContent = _t('loc_share_sub', 'Visible to friends only');
          if(durRow) durRow.style.display = 'none';
        }, _locDurationSec * 1000);
        if(status){
          var mins = _locDurationSec < 3600 ? (_locDurationSec/60) + ' ' + _t('min','min') : (_locDurationSec/3600) + ' ' + (_locDurationSec===3600?_t('hour','hour'):_t('hours','hours'));
          status.textContent = _t('loc_sharing_for','Sharing for') + ' ' + mins;
        }
      } else {
        if(_locStopTimer){ clearTimeout(_locStopTimer); _locStopTimer=null; }
        stopSharingLocation();
        if(status) status.textContent = _t('loc_share_sub','Visible to friends only');
        if(durRow) durRow.style.display = 'none';
      }
    });
  }

  window.openLivePanel = function () {
    const user = window.GeoCurrentUser;
    if (!user || !user.uid) {
      if (window.GeoAccount && window.GeoAccount.requireLogin)
        window.GeoAccount.requireLogin('see live friend locations');
      else window.location.href = 'auth.html';
      return;
    }
    const panel = document.getElementById('livePanel');
    if (panel) panel.classList.toggle('open');
    if (panel && panel.classList.contains('open')) startWatchingFriendLocations();
  };

  window.closeLivePanel = function () {
    const panel = document.getElementById('livePanel');
    if (panel) panel.classList.remove('open');
  };

  // ── My location ──────────────────────────────────
  function startSharingLocation() {
    if (!navigator.geolocation) { if (window.GeoSocial && window.GeoSocial.toast) window.GeoSocial.toast('GPS not available on this device.'); return; }
    const geo = window.GeoFirebase, user = window.GeoCurrentUser;
    if (!geo || !user) return;
    _locSharing = true;

    _locWatchId = navigator.geolocation.watchPosition(function (pos) {
      _myLatLng = [pos.coords.longitude, pos.coords.latitude];
      updateMyMarker(_myLatLng);
      if (_writeThrottle) return;
      _writeThrottle = setTimeout(function () {
        _writeThrottle = null;
        geo.fs.setDoc(geo.fs.doc(geo.db, 'userLocations', user.uid), {
          uid: user.uid,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading || null,
          accuracy: Math.round(pos.coords.accuracy || 0),
          updatedAt: geo.fs.serverTimestamp(),
          sharing: 'friends',
          displayName: user.displayName || user.fullName || user.username || 'GeoHub User',
          photoURL: user.photoURL || user.avatar || ''
        }, { merge: true });
      }, 5000);
      // Highlight sidebar button when sharing is on
      const sBtn = document.getElementById('sidebarLocBtn');
      if (sBtn) sBtn.classList.add('active');
    }, function (err) {
      _locSharing = false;
      const tog = document.getElementById('locShareToggle');
      if (tog) tog.checked = false;
      const sBtn = document.getElementById('sidebarLocBtn');
      if (sBtn) sBtn.classList.remove('active');
      if (err && err.code === 1 && window.GeoSocial && window.GeoSocial.toast) window.GeoSocial.toast('Location permission denied. Please allow location access in your browser settings.');
    }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 });
  }

  function stopSharingLocation() {
    _locSharing = false;
    const sBtn = document.getElementById('sidebarLocBtn');
    if (sBtn) sBtn.classList.remove('active');
    if (_locWatchId !== null) { navigator.geolocation.clearWatch(_locWatchId); _locWatchId = null; }
    if (_myLocMarker) { _myLocMarker.remove(); _myLocMarker = null; }
    _myLatLng = null;
    if (_writeThrottle) { clearTimeout(_writeThrottle); _writeThrottle = null; }
    const geo = window.GeoFirebase, user = window.GeoCurrentUser;
    if (geo && user)
      geo.fs.updateDoc(geo.fs.doc(geo.db, 'userLocations', user.uid), { sharing: 'off' }).catch(function () {});
  }

  function updateMyMarker(lngLat) {
    if (!_myLocMarker) {
      const el = document.createElement('div');
      el.className = 'my-loc-marker';
      el.innerHTML = '<div class="my-loc-pulse"></div><div class="my-loc-dot"></div>';
      _myLocMarker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(lngLat).addTo(map);
    } else {
      _myLocMarker.setLngLat(lngLat);
    }
  }

  // ── Friend location subscription ─────────────────
  function startWatchingFriendLocations() {
    const geo = window.GeoFirebase, user = window.GeoCurrentUser;
    if (!geo || !user) return;
    const { collection, query, where, onSnapshot, limit: fsLimit } = geo.fs;

    if (_friendsListUnsub) { _friendsListUnsub(); _friendsListUnsub = null; }

    _friendsListUnsub = onSnapshot(
      query(collection(geo.db, 'friends'), where('users', 'array-contains', user.uid), fsLimit(50)),
      function (snap) {
        const friendUids = [];
        snap.forEach(function (d) {
          (d.data().users || []).forEach(function (u) { if (u !== user.uid) friendUids.push(u); });
        });
        watchFriendLocations(friendUids);
      }
    );
  }

  function watchFriendLocations(uids) {
    const geo = window.GeoFirebase;
    if (!geo) return;
    if (_friendLocUnsub) { _friendLocUnsub(); _friendLocUnsub = null; }
    if (!uids.length) { updateFriendMarkers([]); renderFriendsList([]); return; }

    const { collection, query, where, onSnapshot } = geo.fs;
    const batch = uids.slice(0, 10); // Firestore 'in' limit

    _friendLocUnsub = onSnapshot(
      query(collection(geo.db, 'userLocations'), where('uid', 'in', batch), where('sharing', '==', 'friends')),
      function (snap) {
        const now = Date.now();
        const active = [];
        snap.forEach(function (d) {
          const data = d.data();
          const age = now - (data.updatedAt && data.updatedAt.toMillis ? data.updatedAt.toMillis() : 0);
          if (age < 10 * 60 * 1000) active.push(data); // only last 10 min
        });
        updateFriendMarkers(active);
        renderFriendsList(active);
      }
    );
  }

  // ── Friend markers ───────────────────────────────
  function updateFriendMarkers(friends) {
    const activeUids = friends.map(function (f) { return f.uid; });
    Object.keys(_friendMarkers).forEach(function (uid) {
      if (!activeUids.includes(uid)) { _friendMarkers[uid].remove(); delete _friendMarkers[uid]; }
    });
    friends.forEach(function (f) {
      _friendData[f.uid] = f;
      const lngLat = [f.lng, f.lat];
      if (!_friendMarkers[f.uid]) {
        const el = buildFriendMarkerEl(f);
        el.addEventListener('click', function () { showFriendCard(f.uid); });
        _friendMarkers[f.uid] = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(lngLat).addTo(map);
      } else {
        _friendMarkers[f.uid].setLngLat(lngLat);
        _friendData[f.uid] = f;
      }
    });
  }

  function buildFriendMarkerEl(f) {
    const el = document.createElement('div');
    el.className = 'friend-loc-marker';
    const initials = (f.displayName || '?').split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
    if (f.photoURL) {
      const img = document.createElement('img');
      img.src = f.photoURL;
      img.alt = initials;
      el.appendChild(img);
    } else {
      el.textContent = initials;
    }
    const pulse = document.createElement('div');
    pulse.className = 'friend-loc-pulse';
    el.appendChild(pulse);
    const label = document.createElement('div');
    label.className = 'friend-loc-label';
    label.textContent = (f.displayName || '').split(' ')[0];
    el.appendChild(label);
    return el;
  }

  // ── Friend info card ─────────────────────────────
  function showFriendCard(uid) {
    const f = _friendData[uid];
    if (!f) return;
    const initials = (f.displayName || '?').split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
    let distText = '', etaStr = '';
    const _t2 = function(k,fb){ return (typeof GHt==='function'?GHt(k):null)||fb; };
    if (_myLatLng) {
      const dist = haversine(_myLatLng, [f.lng, f.lat]);
      distText = dist < 1
        ? Math.round(dist * 1000) + ' ' + _t2('loc_m_away','m away')
        : dist.toFixed(1) + ' ' + _t2('loc_km_away','km away');
      etaStr = dist < 0.3
        ? _t2('loc_on_foot','On foot') + ': ~' + Math.round(dist / 0.08) + ' min'
        : dist < 5
          ? _t2('loc_on_foot','On foot') + ': ~' + Math.round(dist / 0.067) + ' min'
          : _t2('loc_by_car','By car') + ': ~' + Math.round(dist / 0.42) + ' min';
    }

    const imgEl      = document.getElementById('panelImg');
    const fallbackEl = document.getElementById('panelImgFallback');
    if (f.photoURL) {
      imgEl.src = f.photoURL; imgEl.style.display = '';
      if (fallbackEl) fallbackEl.style.display = 'none';
    } else {
      imgEl.style.display = 'none';
      if (fallbackEl) { fallbackEl.style.display = 'flex'; fallbackEl.textContent = initials; }
    }
    document.getElementById('panelTitle').textContent = f.displayName || _t2('friend','Friend');
    document.getElementById('panelCat').innerHTML   = '<span style="color:#10b981">🟢 ' + _t2('live_now','Live Now') + '</span>';
    document.getElementById('panelLoc').textContent  = distText;
    document.getElementById('panelRating').textContent = etaStr;
    document.getElementById('panelDesc').textContent = _t2('loc_live_desc','Live location — updates every 5 seconds');

    const detailBtn = document.getElementById('panelDetailBtn');
    detailBtn.href = 'profile.html?id=' + encodeURIComponent(uid);
    detailBtn.innerHTML = '<i class="fas fa-user"></i> ' + _t2('profile','Profile');
    detailBtn.removeAttribute('aria-disabled');

    const navBtn = document.getElementById('panelMapBtn');
    navBtn.href = 'javascript:void(0)';
    navBtn.innerHTML = '<i class="fas fa-route"></i>';
    navBtn.onclick = function () { window.goToFriend(uid); };

    const panel = document.getElementById('infoPanel');
    if (panel) panel.classList.add('open');
    map.flyTo({ center: [f.lng, f.lat], zoom: Math.max(map.getZoom(), 14), duration: 600 });
  }

  window.goToFriend = function (uid) {
    const f = _friendData[uid];
    if (!f) return;
    if (_myLatLng) drawRouteLine(_myLatLng, [f.lng, f.lat]);
    const dest   = f.lat + ',' + f.lng;
    const origin = _myLatLng ? _myLatLng[1] + ',' + _myLatLng[0] : '';
    window.open('https://www.google.com/maps/dir/' + origin + '/' + dest, '_blank');
  };

  function drawRouteLine(from, to) {
    if (map.getLayer('friend-route-line')) map.removeLayer('friend-route-line');
    if (map.getSource('friend-route'))     map.removeSource('friend-route');
    map.addSource('friend-route', {
      type: 'geojson',
      data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [from, to] } }
    });
    map.addLayer({
      id: 'friend-route-line', type: 'line', source: 'friend-route',
      paint: { 'line-color': '#10b981', 'line-width': 3, 'line-dasharray': [3, 2], 'line-opacity': 0.85 }
    });
  }

  // ── Friends sidebar list ─────────────────────────
  function renderFriendsList(friends) {
    const list = document.getElementById('liveFriendsList');
    if (!list) return;
    const _t3 = function(k,fb){ return (typeof GHt==='function'?GHt(k):null)||fb; };
    if (!friends.length) {
      list.innerHTML = '<div class="live-friends-empty"><i class="fas fa-user-slash"></i><span>' + _t3('loc_no_friends','No friends sharing location right now') + '</span></div>';
      return;
    }
    list.innerHTML = friends.map(function (f) {
      const initials = (f.displayName || '?').split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
      let distText = '';
      if (_myLatLng) {
        const dist = haversine(_myLatLng, [f.lng, f.lat]);
        distText = dist < 1 ? Math.round(dist * 1000) + ' m' : dist.toFixed(1) + ' km';
      }
      return '<div class="live-friend-row" onclick="window._ghShowFriend(\'' + f.uid + '\')">' +
        '<div class="live-friend-av">' +
        (f.photoURL ? '<img src="' + esc(f.photoURL) + '" alt="' + esc(initials) + '">' : '<span>' + esc(initials) + '</span>') +
        '<div class="live-friend-dot"></div></div>' +
        '<div class="live-friend-info"><div class="live-friend-name">' + esc(f.displayName || _t3('friend','Friend')) + '</div>' +
        '<div class="live-friend-dist">' + (distText ? distText + ' ' + _t3('loc_away','away') : '🟢 ' + _t3('live_now','Live')) + '</div></div>' +
        '<button class="live-friend-nav" onclick="event.stopPropagation();window.goToFriend(\'' + f.uid + '\')" title="' + _t3('navigate','Navigate') + '"><i class="fas fa-route"></i></button>' +
        '</div>';
    }).join('');
  }

  window._ghShowFriend = function (uid) { showFriendCard(uid); };

  // ── Haversine distance (km) ──────────────────────
  function haversine(lngLat1, lngLat2) {
    const R = 6371;
    const [lng1, lat1] = lngLat1, [lng2, lat2] = lngLat2;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /* ── "What's happening NOW" panel ──────────────── */
  let _nowPanelOpen = false;
  let _nowLastLoad = 0;

  window.toggleMapFilterSheet = function() {
    var sheet = document.getElementById('mapFilterSheet');
    var backdrop = document.getElementById('mapFilterBackdrop');
    if (!sheet) return;
    var open = sheet.classList.toggle('open');
    sheet.setAttribute('aria-hidden', String(!open));
    if (backdrop) backdrop.classList.toggle('open', open);
    var nowBtn = document.getElementById('nowBtn');
    if (nowBtn) nowBtn.style.visibility = open ? 'hidden' : '';
  };

  window.toggleNowPanel = function() {
    _nowPanelOpen = !_nowPanelOpen;
    const panel = document.getElementById('nowPanel');
    const btn   = document.getElementById('nowBtn');
    if (!panel) return;
    panel.classList.toggle('open', _nowPanelOpen);
    panel.setAttribute('aria-hidden', String(!_nowPanelOpen));
    if (btn) btn.classList.toggle('active', _nowPanelOpen);
    if (_nowPanelOpen && (Date.now() - _nowLastLoad > 5 * 60 * 1000)) {
      window.loadNowPanel(false);
    }
  };

  window.loadNowPanel = function(force) {
    const GF = window.GeoFirebase;
    const body = document.getElementById('nowPanelBody');
    const badge = document.getElementById('nowBadge');
    const lastUpdated = document.getElementById('nowLastUpdated');
    if (!body) return;
    if (!GF || !GF.fs || !GF.db) {
      body.innerHTML = '<div class="now-empty"><i class="fas fa-wifi-slash"></i><p>Loading data…</p></div>';
      return;
    }
    if (!force && Date.now() - _nowLastLoad < 60000) return;
    _nowLastLoad = Date.now();
    body.innerHTML = '<div class="now-loading"><i class="fas fa-spinner fa-spin"></i> Loading…</div>';
    if (lastUpdated) lastUpdated.textContent = '';

    const fs = GF.fs, db = GF.db;
    const since2h  = new Date(Date.now() - 2  * 60 * 60 * 1000);
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const now = new Date();

    const pTrending = fs.getDocs(
      fs.query(fs.collection(db, 'checkins'), fs.where('createdAt','>=',since2h), fs.orderBy('createdAt','desc'), fs.limit(200))
    ).then(function(snap) {
      const counts = {};
      const names  = {};
      const lats   = {};
      const lngs   = {};
      snap.forEach(function(d) {
        const c = d.data();
        if (!c.placeId) return;
        counts[c.placeId] = (counts[c.placeId] || 0) + 1;
        if (!names[c.placeId]) { names[c.placeId] = c.placeName || 'Unknown'; lats[c.placeId] = c.lat; lngs[c.placeId] = c.lng; }
      });
      return Object.keys(counts)
        .sort(function(a,b){ return counts[b]-counts[a]; })
        .slice(0, 5)
        .map(function(id){ return { id, name: names[id], count: counts[id], lat: lats[id], lng: lngs[id] }; });
    }).catch(function(){ return []; });

    const pEvents = fs.getDocs(
      fs.query(fs.collection(db, 'events'), fs.where('startDate','<=',now), fs.orderBy('startDate','desc'), fs.limit(20))
    ).then(function(snap) {
      const active = [];
      snap.forEach(function(d) {
        const e = Object.assign({ id: d.id }, d.data());
        const end = e.endDate ? (e.endDate.toDate ? e.endDate.toDate() : new Date(e.endDate)) : null;
        if (!end || end >= now) active.push(e);
      });
      return active.slice(0, 4);
    }).catch(function(){ return []; });

    const pFriends = (function() {
      const user = window.GeoCurrentUser;
      if (!user) return Promise.resolve([]);
      return fs.getDocs(
        fs.query(fs.collection(db, 'userLocations'), fs.where('sharing','==','friends'), fs.limit(30))
      ).then(function(snap) {
        const out = [];
        snap.forEach(function(d) {
          if (d.id === user.uid) return;
          const data = d.data();
          const ms = data.updatedAt && data.updatedAt.toMillis ? data.updatedAt.toMillis() : 0;
          if (Date.now() - ms < 10 * 60 * 1000) out.push(Object.assign({ uid: d.id }, data));
        });
        return out.slice(0, 4);
      }).catch(function(){ return []; });
    })();

    const pRecent = fs.getDocs(
      fs.query(fs.collection(db, 'checkins'), fs.where('createdAt','>=',since24h), fs.orderBy('createdAt','desc'), fs.limit(8))
    ).then(function(snap) {
      const out = [];
      snap.forEach(function(d) { out.push(Object.assign({ id: d.id }, d.data())); });
      return out;
    }).catch(function(){ return []; });

    Promise.all([pTrending, pEvents, pFriends, pRecent]).then(function(results) {
      const trending = results[0];
      const events   = results[1];
      const friends  = results[2];
      const recent   = results[3];

      let totalItems = trending.length + events.length + friends.length;
      if (badge) { badge.textContent = totalItems > 99 ? '99+' : String(totalItems); badge.style.display = totalItems > 0 ? '' : 'none'; }
      if (lastUpdated) lastUpdated.textContent = 'Updated ' + _nowTimeAgo(Date.now());

      let html = '';

      // ── Trending spots ────────────────────────────
      html += '<div class="now-section">';
      html += '<div class="now-section-head"><span class="now-sec-icon">🔥</span><span>Trending spots</span><small>last 2h</small></div>';
      if (trending.length) {
        html += '<div class="now-rows">';
        trending.forEach(function(t, i) {
          const heat = i === 0 ? 'now-row--hot' : (i === 1 ? 'now-row--warm' : '');
          const bar  = Math.round((t.count / trending[0].count) * 100);
          html += '<div class="now-row ' + heat + '" onclick="' +
            (t.lat && t.lng ? 'window._ghMap&&window._ghMap.flyTo({center:[' + t.lng + ',' + t.lat + '],zoom:15,duration:800})' : '') +
            ';window.toggleNowPanel()">' +
            '<span class="now-row-rank">' + (i+1) + '</span>' +
            '<div class="now-row-info"><div class="now-row-name">' + esc(t.name) + '</div>' +
            '<div class="now-row-bar"><div class="now-row-fill" style="width:' + bar + '%"></div></div></div>' +
            '<span class="now-row-count">' + t.count + ' <i class="fas fa-map-pin"></i></span>' +
            '</div>';
        });
        html += '</div>';
      } else {
        html += '<div class="now-empty-row"><i class="fas fa-map-marker-alt"></i> No check-ins in last 2h</div>';
      }
      html += '</div>';

      // ── Active events ─────────────────────────────
      html += '<div class="now-section">';
      html += '<div class="now-section-head"><span class="now-sec-icon">🎉</span><span>Active events</span><small>happening now</small></div>';
      if (events.length) {
        html += '<div class="now-rows">';
        events.forEach(function(e) {
          html += '<div class="now-row" onclick="location.href=\'events.html?id=' + esc(e.id) + '\'">' +
            '<span class="now-row-event-dot"></span>' +
            '<div class="now-row-info"><div class="now-row-name">' + esc(e.title || e.name || 'Event') + '</div>' +
            '<div class="now-row-sub">' + esc(e.city || e.location || '') + '</div></div>' +
            '<span class="now-row-live-badge">LIVE</span>' +
            '</div>';
        });
        html += '</div>';
      } else {
        html += '<div class="now-empty-row"><i class="fas fa-calendar-times"></i> No active events right now</div>';
      }
      html += '</div>';

      // ── Friends active ────────────────────────────
      if (window.GeoCurrentUser) {
        html += '<div class="now-section">';
        html += '<div class="now-section-head"><span class="now-sec-icon">👥</span><span>Friends active</span><small>sharing location</small></div>';
        if (friends.length) {
          html += '<div class="now-rows">';
          friends.forEach(function(f) {
            const init = (f.displayName||'?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
            html += '<div class="now-row" onclick="window._ghShowFriend&&window._ghShowFriend(\'' + esc(f.uid) + '\');window.toggleNowPanel()">' +
              '<div class="now-friend-av">' + (f.photoURL ? '<img src="'+esc(f.photoURL)+'" alt="">' : '<span>'+esc(init)+'</span>') + '</div>' +
              '<div class="now-row-info"><div class="now-row-name">' + esc(f.displayName||'Friend') + '</div>' +
              '<div class="now-row-sub">🟢 Online now</div></div>' +
              '</div>';
          });
          html += '</div>';
        } else {
          html += '<div class="now-empty-row"><i class="fas fa-user-slash"></i> No friends sharing location</div>';
        }
        html += '</div>';
      }

      // ── Recent activity feed ──────────────────────
      if (recent.length) {
        html += '<div class="now-section">';
        html += '<div class="now-section-head"><span class="now-sec-icon">⚡</span><span>Recent activity</span><small>last 24h</small></div>';
        html += '<div class="now-rows">';
        recent.forEach(function(c) {
          html += '<div class="now-row">' +
            '<div class="now-friend-av">' + (c.authorAvatar ? '<img src="'+esc(c.authorAvatar)+'" alt="">' : '<span>'+(c.authorName||'U')[0]+'</span>') + '</div>' +
            '<div class="now-row-info"><div class="now-row-name">' + esc(c.authorName||'Someone') + '</div>' +
            '<div class="now-row-sub">checked in at <b>' + esc(c.placeName||'a place') + '</b> · ' + _nowTimeAgo(c.createdAt) + '</div></div>' +
            '</div>';
        });
        html += '</div></div>';
      }

      body.innerHTML = html || '<div class="now-empty"><i class="fas fa-moon"></i><p>Quiet right now</p></div>';
    }).catch(function() {
      body.innerHTML = '<div class="now-empty"><i class="fas fa-exclamation-triangle"></i><p>Could not load data</p></div>';
    });
  };

  function _nowTimeAgo(v) {
    var ms = 0;
    if (!v) return 'now';
    if (typeof v === 'number') ms = v;
    else if (v.toMillis) ms = v.toMillis();
    else if (v.seconds) ms = v.seconds * 1000;
    else if (v instanceof Date) ms = v.getTime();
    var m = Math.max(1, Math.floor((Date.now() - ms) / 60000));
    if (m < 60) return m + 'm ago';
    if (m < 1440) return Math.floor(m/60) + 'h ago';
    return Math.floor(m/1440) + 'd ago';
  }

  /* ── Init ───────────────────────────────────────── */
  function init() {
    if (!window.maplibregl) {
      const mapEl = document.getElementById('map');
      if (mapEl) mapEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#0b1120;color:#94a3b8;font-size:.9rem;flex-direction:column;gap:12px"><i class="fas fa-triangle-exclamation" style="font-size:2rem;color:#f59e0b"></i><p>Map library not loaded. Please refresh.</p></div>';
      window.addEventListener('load', function(){ if(window.maplibregl && !map) init(); }, {once:true});
      return;
    }
    const currentStyle = getMapStyle();
    map = new maplibregl.Map({
      container:       'map',
      style:           TILE_LAYERS[currentStyle].style,
      center:          [44.793, 41.694],
      zoom:            12,
      maxPitch:        85,
      pitchWithRotate: true,
      attributionControl: false,
    });
    window._ghMap = map;

    // Vector tiles keep labels upright — no bearing clamp needed

    // Fallback: if GL vector style fails within 15s, switch to OSM raster
    const _stFbTimer = setTimeout(function(){
      try { if (map.isStyleLoaded()) return; } catch(e) {}
      map.setStyle({version:8,sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',maxzoom:19}},layers:[{id:'osm',type:'raster',source:'osm'}]});
    }, 15000);
    map.once('load', function(){ clearTimeout(_stFbTimer); });

    // Navigation control (zoom + compass + pitch visualizer)
    map.addControl(new maplibregl.NavigationControl({
      showCompass:    true,
      showZoom:       true,
      visualizePitch: true,
    }), 'top-right');

    map.on('load', () => {
      buildStyleToggle();
      buildLegend();
      buildCategoryChips();
      buildMobileCard();
      buildRotationHint();
      buildLiveFriendsUI();
      initHeatmapLayer();
      buildHeatmapControl();
      buildMobileSidebar();
      renderMap();

      // markers are persistent — no rebuild needed on pan/zoom

      if (window.GeoFirebase) {
        loadPlaceCategoriesFromFirestore();
        loadRealPlaces();
        loadUserCheckins();
        loadHeatmapCheckins();
        setTimeout(function() { window.loadNowPanel(false); }, 2000);
        setTimeout(function() { initDiscovery(); }, 1500);
      } else {
        window.addEventListener('GeoFirebaseReady', () => {
          loadPlaceCategoriesFromFirestore();
          loadRealPlaces();
          loadUserCheckins();
          loadHeatmapCheckins();
          setTimeout(function() { window.loadNowPanel(false); }, 2000);
          setTimeout(function() { initDiscovery(); }, 1500);

        }, { once: true });
      }

      /* Video map mode */
      if (window.GeoVideoMap) window.GeoVideoMap.init();
      else window.addEventListener('load', function () {
        if (window.GeoVideoMap) window.GeoVideoMap.init();
      }, { once: true });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  /* ═══════════════════════════════════════════════════════════════
     PLACE DETAIL DRAWER
     4 tabs: Info · Reviews · Photos · Stories 24h
  ═══════════════════════════════════════════════════════════════ */
  let _drawerPid = null;
  let _drawerPlace = null;

  function _mpdTimeAgo(v) {
    if (!v) return '';
    const ms = typeof v.toMillis === 'function' ? v.toMillis() : (v.seconds ? v.seconds * 1000 : new Date(v).getTime());
    const d = Date.now() - ms;
    if (d < 60000)  return 'just now';
    if (d < 3600000) return Math.floor(d / 60000) + 'm ago';
    if (d < 86400000) return Math.floor(d / 3600000) + 'h ago';
    return Math.floor(d / 86400000) + 'd ago';
  }

  window.openPlaceDrawer = function (placeId, p) {
    _drawerPid   = placeId;
    _drawerPlace = p;
    const drawer  = document.getElementById('placeDrawer');
    const backdrop = document.getElementById('mpdBackdrop');
    if (!drawer) return;

    const pStyle = getPlaceMarkerStyle(p);

    // Cover image
    const cImg = document.getElementById('mpdCoverImg');
    const cFb  = document.getElementById('mpdCoverFallback');
    if (p.image) {
      cImg.src = p.image; cImg.style.display = '';
      if (cFb) cFb.style.display = 'none';
    } else {
      cImg.style.display = 'none';
      if (cFb) { cFb.style.display = 'flex'; cFb.textContent = pStyle.icon || '📍'; cFb.style.background = pStyle.color + '33'; }
    }

    // Header text
    const mpdTitle = document.getElementById('mpdTitle');
    const mpdSub   = document.getElementById('mpdSubtitle');
    if (mpdTitle) mpdTitle.textContent = p.name;
    if (mpdSub)   mpdSub.innerHTML =
      '<span>' + esc(pStyle.icon + ' ' + p.categoryLabel) + '</span>' +
      (p.city ? '<span> · ' + esc(p.city) + ', Georgia</span>' : '') +
      openBadgeHtml(p.workingHours);

    // Quick actions
    const qa = document.getElementById('mpdQuickActions');
    if (qa) {
      const bizHref  = p.source === 'businesses' ? 'business.html?id=' + encodeURIComponent(p.id) : null;
      const mapsHref = 'https://www.google.com/maps/search/' + encodeURIComponent(p.name + ' ' + (p.city || '') + ' Georgia');
      qa.innerHTML =
        (bizHref ? '<a href="' + bizHref + '" class="mpd-qa-btn primary"><i class="fas fa-store"></i> Business Page</a>' : '') +
        '<a href="' + mapsHref + '" target="_blank" rel="noopener" class="mpd-qa-btn ghost"><i class="fas fa-route"></i> Directions</a>' +
        '<button class="mpd-qa-btn ghost" onclick="checkInToPlace()"><i class="fas fa-map-pin"></i> Check In</button>';
    }

    // Reset to Info tab
    document.querySelectorAll('[data-mpd-tab]').forEach(t => t.classList.toggle('active', t.dataset.mpdTab === 'info'));
    _mpdLoadTab('info');

    // Tab listeners (rebind each open to avoid leaks via replacing node)
    const tabsEl = document.getElementById('mpdTabs');
    if (tabsEl && !tabsEl._mpdBound) {
      tabsEl._mpdBound = true;
      tabsEl.addEventListener('click', e => {
        const btn = e.target.closest('[data-mpd-tab]');
        if (!btn) return;
        document.querySelectorAll('[data-mpd-tab]').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        _mpdLoadTab(btn.dataset.mpdTab);
      });
    }

    drawer.classList.add('open');
    if (backdrop) backdrop.classList.add('open');
  };

  window.closePlaceDrawer = function () {
    const el = document.getElementById('placeDrawer');
    const bd = document.getElementById('mpdBackdrop');
    if (el) el.classList.remove('open');
    if (bd) bd.classList.remove('open');
  };

  function _mpdLoadTab(tab) {
    const box = document.getElementById('mpdTabContent');
    if (!box) return;
    box.innerHTML = '<div class="mpd-loading"><i class="fas fa-circle-notch fa-spin"></i></div>';
    const GF = window.GeoFirebase;
    if (tab === 'info')    { _mpdInfo(box); }
    else if (tab === 'reviews') { _mpdReviews(box, GF); }
    else if (tab === 'photos')  { _mpdPhotos(box, GF); }
    else if (tab === 'stories') { _mpdStories(box, GF); }
  }

  function _mpdInfo(box) {
    const p = _drawerPlace;
    const pStyle = getPlaceMarkerStyle(p);
    let h = '';

    if (p.rating) {
      h += '<div class="mpd-row"><span class="mpd-lbl">Rating</span><span class="mpd-val">' +
        renderStars(p.rating) + ' <b>' + p.rating + '</b>' + (p.reviewCount ? ' (' + p.reviewCount + ' reviews)' : '') + '</span></div>';
    }
    h += '<div class="mpd-row"><span class="mpd-lbl">Category</span><span class="mpd-val">' + esc(pStyle.icon + ' ' + p.categoryLabel) + '</span></div>';
    if (p.city || p.address) {
      h += '<div class="mpd-row"><span class="mpd-lbl"><i class="fas fa-location-dot"></i> Location</span><span class="mpd-val">' +
        esc((p.address ? p.address + (p.city ? ', ' : '') : '') + (p.city || '')) + '</span></div>';
    }
    if (p.shortDescription) {
      h += '<div class="mpd-desc">' + esc(p.shortDescription) + '</div>';
    }

    // Working hours
    if (p.workingHours) {
      const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const today = new Date().getDay();
      h += '<div class="mpd-section-title"><i class="fas fa-clock"></i> Working Hours</div><div class="mpd-hours">';
      days.forEach((day, i) => {
        const wh = p.workingHours[day];
        const isToday = i === today;
        h += '<div class="mpd-hours-row' + (isToday ? ' today' : '') + '">' +
          '<span class="mpd-hours-day">' + day.slice(0, 3) + '</span>' +
          '<span class="mpd-hours-time">' + (wh ? (wh.closed ? 'Closed' : (wh.open || '?') + ' – ' + (wh.close || '?')) : '—') + '</span>' +
          '</div>';
      });
      h += '</div>';
    }

    // Mood tags
    const counts = _moodTagCounts[p.id];
    if (counts) {
      const active = MOOD_TAGS.filter(t => counts[t.id] >= 1);
      if (active.length) {
        h += '<div class="mpd-section-title">Vibes</div><div class="mpd-mood-row">' +
          active.map(t => '<span class="mpd-mood-chip">' + t.emoji + ' ' + t.label + ' <b>' + counts[t.id] + '</b></span>').join('') +
          '</div>';
      }
    }

    // Async-loaded sections
    h += '<div id="mpdSocialProof" class="mpd-async-section"></div>';
    h += '<div id="mpdActivityChart" class="mpd-async-section"></div>';
    h += '<div id="mpdFriendsSection" class="mpd-async-section"></div>';

    box.innerHTML = h || '<p class="mpd-empty">No additional info available.</p>';

    const GF = window.GeoFirebase;
    if (GF && GF.db && GF.fs) {
      _mpdLoadSocialProof(p.id, GF);
      _mpdLoadActivityChart(p.id, GF);
      _mpdLoadFriendsVisited(p.id, GF);
    }
  }

  function _mpdLoadSocialProof(pid, GF) {
    const el = document.getElementById('mpdSocialProof');
    if (!el) return;
    const since7d = new Date(Date.now() - 7 * 86400000);
    const since = GF.fs.Timestamp ? GF.fs.Timestamp.fromDate(since7d) : since7d;
    GF.fs.getDocs(GF.fs.query(
      GF.fs.collection(GF.db, 'placeCheckins'),
      GF.fs.where('placeId', '==', pid),
      GF.fs.where('checkedInAt', '>=', since),
      GF.fs.limit(200)
    )).then(snap => {
      if (snap.empty) return;
      const n = snap.size;
      const _t = window.GHt || (k => k);
      const label = n === 1 ? _t('ci_social_week').replace('{n}', n) : _t('ci_social_weeks').replace('{n}', n);
      if (el) el.innerHTML = '<div class="mpd-social-proof"><i class="fas fa-users"></i> ' + label + '</div>';
    }).catch(() => {});
  }

  function _mpdLoadActivityChart(pid, GF) {
    const el = document.getElementById('mpdActivityChart');
    if (!el) return;
    const since7d = new Date(Date.now() - 7 * 86400000);
    const since = GF.fs.Timestamp ? GF.fs.Timestamp.fromDate(since7d) : since7d;
    GF.fs.getDocs(GF.fs.query(
      GF.fs.collection(GF.db, 'placeCheckins'),
      GF.fs.where('placeId', '==', pid),
      GF.fs.orderBy('checkedInAt', 'desc'),
      GF.fs.limit(300)
    )).then(snap => {
      if (snap.empty) return;
      const hourCounts = new Array(24).fill(0);
      let total = 0;
      snap.forEach(d => {
        const c = d.data();
        const ts = c.checkedInAt;
        if (!ts) return;
        const dt = ts.toDate ? ts.toDate() : new Date(ts);
        if (dt < since7d) return;
        hourCounts[dt.getHours()]++;
        total++;
      });
      if (total === 0) return;
      const max = Math.max(...hourCounts, 1);
      const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
      const labels = ['12a','','','','','','6a','','','','','','12p','','','','','','6p','','','','',''];
      let html = '<div class="mpd-section-title"><i class="fas fa-chart-bar"></i> Peak Hours ' +
        '<span class="mpd-chart-sub">' + total + ' check-in' + (total !== 1 ? 's' : '') + ' (7 days)</span></div>' +
        '<div class="mpd-chart-wrap"><div class="mpd-chart-bars">';
      for (let h2 = 0; h2 < 24; h2++) {
        const pct = Math.round(hourCounts[h2] / max * 100);
        const isPeak = h2 === peakHour && hourCounts[h2] > 0;
        html += '<div class="mpd-chart-col">' +
          '<div class="mpd-chart-bar' + (isPeak ? ' peak' : '') + '" style="height:' + pct + '%"></div>' +
          '<span class="mpd-chart-lbl">' + (labels[h2] || '') + '</span>' +
          '</div>';
      }
      html += '</div>';
      if (hourCounts[peakHour] > 0) {
        const ph = peakHour;
        const peakStr = ph === 0 ? '12:00am' : ph < 12 ? ph + ':00am' : ph === 12 ? '12:00pm' : (ph - 12) + ':00pm';
        html += '<div class="mpd-chart-peak">🔥 Busiest around ' + peakStr + '</div>';
      }
      html += '</div>';
      if (el) el.innerHTML = html;
    }).catch(() => {});
  }

  function _mpdLoadFriendsVisited(pid, GF) {
    const el = document.getElementById('mpdFriendsSection');
    if (!el) return;
    if (!GF.auth || !GF.auth.currentUser) return;
    const uid = GF.auth.currentUser.uid;
    GF.fs.getDocs(GF.fs.query(
      GF.fs.collection(GF.db, 'follows'),
      GF.fs.where('followerId', '==', uid),
      GF.fs.limit(200)
    )).then(snap => {
      const followingIds = new Set();
      snap.forEach(d => followingIds.add(d.data().followingId));
      if (!followingIds.size) return;
      return GF.fs.getDocs(GF.fs.query(
        GF.fs.collection(GF.db, 'placeCheckins'),
        GF.fs.where('placeId', '==', pid),
        GF.fs.orderBy('checkedInAt', 'desc'),
        GF.fs.limit(200)
      )).then(snap2 => {
        const seen = new Set();
        const friends = [];
        snap2.forEach(d => {
          const c = d.data();
          if (followingIds.has(c.userId) && !seen.has(c.userId)) {
            seen.add(c.userId);
            friends.push(c);
          }
        });
        if (!friends.length) return;
        const elNow = document.getElementById('mpdFriendsSection');
        if (!elNow) return;
        let html = '<div class="mpd-section-title"><i class="fas fa-user-friends"></i> Friends visited <span class="mpd-chart-sub">' + friends.length + '</span></div>' +
          '<div class="mpd-friends-row">';
        friends.slice(0, 9).forEach(c => {
          const firstName = (c.userName || 'User').split(' ')[0];
          html += '<div class="mpd-friend-item">' +
            (c.userAvatar
              ? '<img src="' + esc(c.userAvatar) + '" class="mpd-friend-av" onerror="this.style.display=\'none\'">'
              : '<div class="mpd-friend-av mpd-friend-init">' + esc(firstName[0]) + '</div>') +
            '<span class="mpd-friend-name">' + esc(firstName) + '</span></div>';
        });
        if (friends.length > 9) html += '<div class="mpd-friend-more">+' + (friends.length - 9) + '</div>';
        html += '</div>';
        elNow.innerHTML = html;
      });
    }).catch(() => {});
  }

  function _mpdReviews(box, GF) {
    if (!GF || !GF.db || !GF.fs) { box.innerHTML = '<p class="mpd-empty">Firebase not ready</p>'; return; }
    GF.fs.getDocs(GF.fs.query(
      GF.fs.collection(GF.db, 'placeReviews', _drawerPid, 'reviews'),
      GF.fs.orderBy('createdAt', 'desc'),
      GF.fs.limit(25)
    )).then(snap => {
      if (snap.empty) { box.innerHTML = '<p class="mpd-empty">⭐ No reviews yet — be the first after checking in!</p>'; return; }
      let h = '<div class="mpd-reviews">';
      snap.forEach(d => {
        const r = d.data();
        const av = r.authorAvatar
          ? '<img src="' + esc(r.authorAvatar) + '" class="mpd-rev-av" onerror="this.style.display=\'none\'">'
          : '<div class="mpd-rev-av mpd-rev-init">' + esc((r.authorName || 'U')[0]) + '</div>';
        h += '<div class="mpd-review-card">' +
          '<div class="mpd-rev-head">' + av +
            '<div><div class="mpd-rev-name">' + esc(r.authorName || 'User') + '</div>' +
            '<div class="mpd-rev-stars">' + renderStars(r.rating || 0) + '</div></div>' +
            '<span class="mpd-rev-time">' + _mpdTimeAgo(r.createdAt) + '</span>' +
          '</div>' +
          (r.text ? '<p class="mpd-rev-text">' + esc(r.text) + '</p>' : '') +
          '</div>';
      });
      h += '</div>';
      box.innerHTML = h;
    }).catch(() => { box.innerHTML = '<p class="mpd-empty">Could not load reviews</p>'; });
  }

  function _mpdPhotos(box, GF) {
    if (!GF || !GF.db || !GF.fs) { box.innerHTML = '<p class="mpd-empty">Firebase not ready</p>'; return; }
    GF.fs.getDocs(GF.fs.query(
      GF.fs.collection(GF.db, 'placeCheckins'),
      GF.fs.where('placeId', '==', _drawerPid),
      GF.fs.orderBy('checkedInAt', 'desc'),
      GF.fs.limit(40)
    )).then(snap => {
      const photos = [];
      snap.forEach(d => { const c = d.data(); if (c.photoUrl) photos.push(c); });
      if (!photos.length) { box.innerHTML = '<p class="mpd-empty">📸 No check-in photos yet. Check in and share a photo!</p>'; return; }
      box.innerHTML = '<div class="mpd-photo-grid">' +
        photos.map(c =>
          '<div class="mpd-photo-item">' +
            '<img src="' + esc(c.photoUrl) + '" alt="" loading="lazy" onerror="this.parentElement.remove()">' +
            '<span class="mpd-photo-name">' + esc(c.userName || 'User') + '</span>' +
          '</div>'
        ).join('') + '</div>';
    }).catch(() => { box.innerHTML = '<p class="mpd-empty">Could not load photos</p>'; });
  }

  function _mpdStories(box, GF) {
    if (!GF || !GF.db || !GF.fs) { box.innerHTML = '<p class="mpd-empty">Firebase not ready</p>'; return; }
    const since = GF.fs.Timestamp
      ? GF.fs.Timestamp.fromDate(new Date(Date.now() - 86400000))
      : new Date(Date.now() - 86400000);
    GF.fs.getDocs(GF.fs.query(
      GF.fs.collection(GF.db, 'placeCheckins'),
      GF.fs.where('placeId', '==', _drawerPid),
      GF.fs.where('checkedInAt', '>=', since),
      GF.fs.orderBy('checkedInAt', 'desc'),
      GF.fs.limit(24)
    )).then(snap => {
      if (snap.empty) { box.innerHTML = '<p class="mpd-empty">🔥 No one checked in here in the last 24h. Be the first!</p>'; return; }
      let h = '<div class="mpd-stories-bar"><i class="fas fa-fire"></i> ' + snap.size + ' check-in' + (snap.size !== 1 ? 's' : '') + ' in the last 24h</div>';
      h += '<div class="mpd-stories-grid">';
      snap.forEach(d => {
        const c = d.data();
        const av = c.userAvatar
          ? '<img class="mpd-st-av" src="' + esc(c.userAvatar) + '" onerror="this.style.display=\'none\'">'
          : '<div class="mpd-st-av mpd-st-av-init">' + esc((c.userName || '?')[0]) + '</div>';
        h += '<div class="mpd-story-card">' +
          (c.photoUrl
            ? '<img class="mpd-story-img" src="' + esc(c.photoUrl) + '" loading="lazy" onerror="this.style.display=\'none\'">'
            : '<div class="mpd-story-noimg">' + (c.emoji || '📍') + '</div>') +
          '<div class="mpd-story-foot">' + av +
            '<span class="mpd-st-name">' + esc(c.userName || 'Someone') + '</span>' +
            '<span class="mpd-st-time">' + _mpdTimeAgo(c.checkedInAt) + '</span>' +
          '</div></div>';
      });
      h += '</div>';
      box.innerHTML = h;
    }).catch(() => {
      // index not built yet — fallback without date filter
      GF.fs.getDocs(GF.fs.query(
        GF.fs.collection(GF.db, 'placeCheckins'),
        GF.fs.where('placeId', '==', _drawerPid),
        GF.fs.orderBy('checkedInAt', 'desc'),
        GF.fs.limit(12)
      )).then(snap2 => {
        if (snap2.empty) { box.innerHTML = '<p class="mpd-empty">🔥 No check-ins yet. Be the first!</p>'; return; }
        let h = '<div class="mpd-stories-bar"><i class="fas fa-fire"></i> Recent check-ins</div><div class="mpd-stories-grid">';
        snap2.forEach(d => {
          const c = d.data();
          const av = c.userAvatar ? '<img class="mpd-st-av" src="' + esc(c.userAvatar) + '" onerror="this.style.display=\'none\'">' : '<div class="mpd-st-av mpd-st-av-init">' + esc((c.userName || '?')[0]) + '</div>';
          h += '<div class="mpd-story-card">' +
            (c.photoUrl ? '<img class="mpd-story-img" src="' + esc(c.photoUrl) + '" loading="lazy" onerror="this.style.display=\'none\'">' : '<div class="mpd-story-noimg">' + (c.emoji || '📍') + '</div>') +
            '<div class="mpd-story-foot">' + av + '<span class="mpd-st-name">' + esc(c.userName || 'Someone') + '</span><span class="mpd-st-time">' + _mpdTimeAgo(c.checkedInAt) + '</span></div></div>';
        });
        box.innerHTML = h + '</div>';
      }).catch(() => { box.innerHTML = '<p class="mpd-empty">Could not load stories</p>'; });
    });
  }

  /* ── Nearby Stories ─────────────────────────────────── */
  let _nearbyStoriesActive = false;
  let _storyMarkers = [];

  window.toggleNearbyStories = function() {
    _nearbyStoriesActive = !_nearbyStoriesActive;
    const btn = document.getElementById('mapStoriesBtn');
    if (btn) btn.classList.toggle('active', _nearbyStoriesActive);
    if (!_nearbyStoriesActive) { _clearStoryMarkers(); return; }
    if (_myLatLng) {
      _loadNearbyStories(_myLatLng[1], _myLatLng[0]);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(pos) {
        _myLatLng = [pos.coords.longitude, pos.coords.latitude];
        _loadNearbyStories(pos.coords.latitude, pos.coords.longitude);
      }, function() {
        const c = map.getCenter();
        _loadNearbyStories(c.lat, c.lng);
      }, { timeout: 8000 });
    } else {
      const c = map.getCenter();
      _loadNearbyStories(c.lat, c.lng);
    }
  };

  function _clearStoryMarkers() {
    _storyMarkers.forEach(function(m) { m.remove(); });
    _storyMarkers = [];
  }

  function _groupNearbyStories(stories) {
    const groups = [];
    stories.forEach(function(s) {
      const existing = groups.find(function(g) { return haversine([g.lng, g.lat], [s.lng, s.lat]) < 0.05; });
      if (existing) existing.stories.push(s);
      else groups.push({ lat: s.lat, lng: s.lng, stories: [s] });
    });
    return groups;
  }

  function _loadNearbyStories(lat, lng) {
    const GF = window.GeoFirebase;
    if (!GF || !GF.db || !GF.fs) return;
    _clearStoryMarkers();
    const now = Date.now();
    const fs = GF.fs, db = GF.db;

    GF.fs.getDocs(GF.fs.query(
      GF.fs.collection(GF.db, 'stories'),
      GF.fs.orderBy('createdAt', 'desc'),
      GF.fs.limit(150)
    )).then(function(snap) {
      const nearby = [];
      snap.forEach(function(d) {
        const s = Object.assign({ id: d.id }, d.data());
        if (s.expiresAt) {
          const exp = s.expiresAt.toMillis ? s.expiresAt.toMillis() : (s.expiresAt.seconds || 0) * 1000;
          if (exp < now) return;
        }
        if (s.lat == null || s.lng == null) return;
        const km = haversine([lng, lat], [s.lng, s.lat]);
        if (km <= 2) { s._km = km; nearby.push(s); }
      });

      const groups = _groupNearbyStories(nearby);
      if (!groups.length) {
        if (btn) btn.classList.remove('active');
        _nearbyStoriesActive = false;
        _showMapToast('ახლოს Stories ვერ მოიძებნა (2კმ)');
        return;
      }
      groups.forEach(function(g) { _addStoryBubble(g); });
      _showMapToast(nearby.length + ' story ახლოს');
    }).catch(function() {
      const btn = document.getElementById('mapStoriesBtn');
      if (btn) btn.classList.remove('active');
      _nearbyStoriesActive = false;
    });
  }

  function _addStoryBubble(group) {
    const first = group.stories[0];
    const el = document.createElement('div');
    el.className = 'map-story-bubble' + (group.stories.length > 1 ? ' multi' : '');
    const av = first.authorAvatar || '';
    const initl = (first.authorName || '?').charAt(0).toUpperCase();
    el.innerHTML =
      '<div class="msb-ring"></div>'+
      '<div class="msb-inner">'+(av?'<img src="'+esc(av)+'" alt="" class="msb-av">':'<span class="msb-init">'+esc(initl)+'</span>')+'</div>'+
      (group.stories.length > 1 ? '<span class="msb-count">'+group.stories.length+'</span>' : '');
    el.onclick = function() { _openMapStoryViewer(group.stories); };
    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([group.lng, group.lat])
      .addTo(map);
    _storyMarkers.push(marker);
  }

  function _openMapStoryViewer(stories) {
    let idx = 0;
    const ov = document.createElement('div');
    ov.className = 'map-story-viewer';
    function _tsAgo(ts) {
      if (!ts) return '';
      const ms = ts.toMillis ? ts.toMillis() : (ts.seconds || 0) * 1000;
      const d = Date.now() - ms;
      if (d < 3600000) return Math.floor(d / 60000) + 'm ago';
      if (d < 86400000) return Math.floor(d / 3600000) + 'h ago';
      return Math.floor(d / 86400000) + 'd ago';
    }
    function render() {
      const s = stories[idx];
      const url = s.mediaUrl || '';
      const isVid = url && /\.(mp4|webm|mov)/i.test(url);
      const dots = stories.map(function(_, i) { return '<span class="msv-dot'+(i===idx?' active':'')+'"></span>'; }).join('');
      ov.innerHTML =
        '<div class="msv-backdrop"></div>'+
        '<div class="msv-card">'+
          '<div class="msv-prog">'+dots+'</div>'+
          '<div class="msv-hdr">'+
            (s.authorAvatar?'<img src="'+esc(s.authorAvatar)+'" class="msv-av" alt="">':'')+
            '<span class="msv-name">'+esc(s.authorName||'GeoHub User')+'</span>'+
            '<span class="msv-time">'+_tsAgo(s.createdAt)+'</span>'+
            '<button class="msv-x" id="msvX">×</button>'+
          '</div>'+
          (url
            ? (isVid?'<video class="msv-media" src="'+esc(url)+'" autoplay muted loop playsinline></video>'
                    :'<img class="msv-media" src="'+esc(url)+'" alt="">')
            : '<div class="msv-media msv-text-card"'+(s.bg?' style="background:'+esc(s.bg)+'"':'')+'>'+esc(s.text||'')+'</div>')+
          (s.text&&url?'<div class="msv-caption">'+esc(s.text)+'</div>':'')+
          '<button class="msv-nav msv-prev" id="msvP"'+(idx===0?' disabled':'')+'>&#8249;</button>'+
          '<button class="msv-nav msv-next" id="msvN"'+(idx===stories.length-1?' disabled':'')+'>&#8250;</button>'+
        '</div>';
      ov.querySelector('.msv-backdrop').onclick = function() { ov.remove(); };
      ov.querySelector('#msvX').onclick = function() { ov.remove(); };
      const pBtn = ov.querySelector('#msvP');
      const nBtn = ov.querySelector('#msvN');
      if (pBtn) pBtn.onclick = function() { if (idx > 0) { idx--; render(); } };
      if (nBtn) nBtn.onclick = function() { if (idx < stories.length-1) { idx++; render(); } };
    }
    render();
    document.body.appendChild(ov);
  }

  function _showMapToast(msg) {
    let t = document.getElementById('mapStoryToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'mapStoryToast';
      t.className = 'map-story-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._tmr);
    t._tmr = setTimeout(function() { t.classList.remove('show'); }, 2500);
  }

  /* ── Discovery: "სად წავიდე?" ──────────────────────── */
  let _discMode = '';   // 'nearme' | 'trending' | 'gems' | ''

  function initDiscovery() {
    // Build mood quick-filter row
    const moodRow = document.getElementById('discMoodRow');
    if (moodRow) {
      const quickMoods = MOOD_TAGS.slice(0, 8);
      moodRow.innerHTML = quickMoods.map(tag =>
        '<button class="disc-mood-btn" data-mood-id="' + esc(tag.id) + '"' +
        ' style="--dm-color:' + (tag.color || '#10b981') + '"' +
        ' onclick="window.discoverMood(\'' + esc(tag.id) + '\')">' +
        tag.emoji + ' ' + tag.label + '</button>'
      ).join('');
    }
    // Load today's trending counts
    const GF = window.GeoFirebase;
    if (!GF || !GF.db || !GF.fs) return;
    const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
    const since = GF.fs.Timestamp ? GF.fs.Timestamp.fromDate(todayMidnight) : todayMidnight;
    GF.fs.getDocs(GF.fs.query(
      GF.fs.collection(GF.db, 'placeCheckins'),
      GF.fs.where('checkedInAt', '>=', since),
      GF.fs.limit(200)
    )).then(snap => {
      const counts = {};
      snap.forEach(d => { const pid = d.data().placeId; counts[pid] = (counts[pid] || 0) + 1; });
      const n = Object.keys(counts).length;
      const sub = document.getElementById('discTrendSub');
      if (sub && n > 0) sub.textContent = n + ' ადგილი';
      _trendCounts = counts;
    }).catch(() => {});
  }

  window.discoverMood = function(moodId) {
    const alreadyActive = _discMode === 'mood_' + moodId;
    _discReset();
    document.querySelectorAll('.disc-mood-btn').forEach(b => b.classList.remove('active'));
    if (alreadyActive) {
      _discMode = '';
      renderMap();
      return;
    }
    _discMode = 'mood_' + moodId;
    const btn = document.querySelector('.disc-mood-btn[data-mood-id="' + moodId + '"]');
    if (btn) btn.classList.add('active');
    // Filter places that have this vibe tag voted
    const tagged = allPlaces.filter(p => {
      const c = _moodTagCounts[p.id];
      return c && (c[moodId] || 0) >= 1;
    }).sort((a, b) => {
      const ca = (_moodTagCounts[a.id] || {})[moodId] || 0;
      const cb = (_moodTagCounts[b.id] || {})[moodId] || 0;
      return cb - ca;
    });
    if (tagged.length) {
      _showDiscoverResults(tagged, 'mood');
    } else {
      // Fallback — show all places with mood label hint
      const results = document.getElementById('mapResults');
      if (results) results.innerHTML = '<div style="padding:16px;text-align:center;color:var(--gh-muted);font-size:13px">ჯერ ვერცერთ ადგილს არ მიუღია ეს Vibe tag.<br>შეამოწმე check-in-ის შემდეგ!</div>';
    }
  };

  let _trendCounts = {};

  function _discReset() {
    ['discNearMe', 'discTrending', 'discGems'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });
    document.querySelectorAll('.disc-mood-btn').forEach(b => b.classList.remove('active'));
  }

  window.discoverNearMe = function() {
    if (_discMode === 'nearme') {
      _discMode = ''; _discReset(); renderMap(); return;
    }
    if (!navigator.geolocation) { return; }
    _discReset(); _discMode = 'nearme';
    const btn = document.getElementById('discNearMe');
    if (btn) btn.classList.add('active');
    navigator.geolocation.getCurrentPosition(pos => {
      const ulat = pos.coords.latitude, ulng = pos.coords.longitude;
      allPlaces.forEach(p => {
        const dlat = (p.lat - ulat) * 111000;
        const dlng = (p.lng - ulng) * 111000 * Math.cos(ulat * Math.PI / 180);
        p._dist = Math.sqrt(dlat * dlat + dlng * dlng);
      });
      const nearest = allPlaces.slice().sort((a, b) => (a._dist || 9e9) - (b._dist || 9e9)).slice(0, 10);
      const sub = document.getElementById('discNearSub');
      if (sub && nearest[0]) sub.textContent = 'ახლოს ' + _distLabel(nearest[0]._dist);
      _showDiscoverResults(nearest, 'nearme');
    }, () => { _discMode = ''; _discReset(); });
  };

  window.discoverTrending = function() {
    if (_discMode === 'trending') {
      _discMode = ''; _discReset(); renderMap(); return;
    }
    _discReset(); _discMode = 'trending';
    const btn = document.getElementById('discTrending');
    if (btn) btn.classList.add('active');
    const sorted = allPlaces.slice().sort((a, b) => (_trendCounts[b.id] || 0) - (_trendCounts[a.id] || 0));
    const top = sorted.filter(p => _trendCounts[p.id] > 0).slice(0, 10);
    _showDiscoverResults(top.length ? top : sorted.slice(0, 8), 'trending');
  };

  window.discoverGems = function() {
    if (_discMode === 'gems') {
      _discMode = ''; _discReset(); renderMap(); return;
    }
    _discReset(); _discMode = 'gems';
    const btn = document.getElementById('discGems');
    if (btn) btn.classList.add('active');
    const gems = allPlaces.filter(p => (p.rating || 0) >= 4.0 && (p.reviewCount || 0) <= 5 && !_trendCounts[p.id]);
    const fallback = allPlaces.filter(p => (p.rating || 0) >= 4.0).sort((a, b) => (a.reviewCount || 0) - (b.reviewCount || 0));
    _showDiscoverResults(gems.length >= 3 ? gems.slice(0, 10) : fallback.slice(0, 10), 'gems');
  };

  function _distLabel(m) {
    if (!m && m !== 0) return '';
    return m < 1000 ? Math.round(m) + 'm' : (m / 1000).toFixed(1) + 'km';
  }

  function _showDiscoverResults(places, mode) {
    const results = document.getElementById('mapResults');
    if (!results) return;
    if (!places.length) {
      results.innerHTML = '<div style="padding:20px;text-align:center;color:var(--gh-muted)">ვერ მოიძებნა</div>';
      return;
    }
    results.innerHTML = places.map(p => {
      const st = getPlaceMarkerStyle(p);
      const badge = openBadgeHtml(p.workingHours);
      let meta = '';
      if (mode === 'nearme' && p._dist != null) meta = '<span class="disc-dist">📍 ' + _distLabel(p._dist) + '</span>';
      else if (mode === 'trending' && _trendCounts[p.id]) meta = '<span class="disc-hot">🔥 ' + _trendCounts[p.id] + ' დღეს</span>';
      else if (mode === 'gems') meta = '<span class="disc-gem">💎 Hidden gem</span>';
      return '<div class="map-result-card" data-id="' + esc(p.id) + '">'
        + '<div class="map-result-icon" style="background:' + (st.color||'#22c55e') + '22;border-color:' + (st.color||'#22c55e') + '44">' + (p.icon||st.icon||'📍') + '</div>'
        + '<div class="map-result-info">'
        + '<div class="map-result-name">' + esc(p.name) + (badge ? ' ' + badge : '') + '</div>'
        + '<div class="map-result-cat">' + esc(p.categoryLabel) + (p.city ? ' · ' + esc(p.city) : '') + '</div>'
        + '<div class="map-result-footer">' + (meta || (p.rating ? '<span class="rating-display">' + renderStars(p.rating) + '</span>' : '')) + '</div>'
        + '</div></div>';
    }).join('');
    results.querySelectorAll('.map-result-card').forEach(card => card.addEventListener('click', () => focusPlace(card.dataset.id)));
  }

})();
