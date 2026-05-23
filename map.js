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

  // OpenFreeMap vector tiles — includes building fills + house numbers at zoom 17+
  const TILE_LAYERS = {
    dark: {
      style: 'https://tiles.openfreemap.org/styles/dark',
      label: '🌑 Dark'
    },
    streets: {
      style: 'https://tiles.openfreemap.org/styles/bright',
      label: '🗺️ Streets'
    }
  };

  let map, superclusterInst, clusterMarkers = [], allPlaces = [];
  let currentFilter = '', currentSearch = '', currentSubFilter = '';
  let disabledCategories = new Set();
  let activeMarkerEl = null, activePlaceId = null;
  let cameraMode = 'explore';
  let heatmapVisible = false;
  let userCheckins = new Set();
  let userMoodVotes = {};
  let currentMoodFilter = '';
  let _moodTagCounts = {};   // { placeId: { tagId: count } } — cached from Firestore
  let allEvents = [];
  let eventMarkers = [];
  let showEvents = false;
  let showThisWeekend = false;

  const MOOD_TAGS = [
    { id: 'cozy',     label: 'Cozy',             emoji: '🛋️' },
    { id: 'work',     label: 'Good for work',    emoji: '💻' },
    { id: 'family',   label: 'Family friendly',  emoji: '👨‍👩‍👧' },
    { id: 'cheap',    label: 'Cheap',            emoji: '💰' },
    { id: 'romantic', label: 'Romantic',         emoji: '🌹' },
    { id: 'crowded',  label: 'Crowded',          emoji: '👥' },
    { id: 'quiet',    label: 'Quiet',            emoji: '🔇' },
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

  /* ── Cluster rendering ──────────────────────────── */
  function updateClusters() {
    if (!map || !superclusterInst) return;
    clusterMarkers.forEach(m => m.remove());
    clusterMarkers = [];

    const bounds = map.getBounds();
    const zoom   = Math.floor(map.getZoom());
    let clusters;
    try {
      clusters = superclusterInst.getClusters(
        [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
        zoom
      );
    } catch (e) { return; }

    clusters.forEach(feature => {
      const [lng, lat] = feature.geometry.coordinates;

      if (feature.properties.cluster) {
        const count = feature.properties.point_count;
        const size  = count < 10 ? 38 : count < 50 ? 46 : 54;
        const el = document.createElement('div');
        el.className = 'gh-cluster-icon';
        el.style.cssText = 'width:' + size + 'px;height:' + size + 'px;font-size:' + (count > 99 ? '0.72rem' : '0.9rem');
        el.textContent = count;
        const m = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([lng, lat]).addTo(map);
        el.addEventListener('click', () => {
          try {
            const z = superclusterInst.getClusterExpansionZoom(feature.properties.cluster_id);
            map.flyTo({ center: [lng, lat], zoom: Math.min(z + 0.5, 20), duration: 500 });
          } catch (e) {}
        });
        clusterMarkers.push(m);
      } else {
        const place = feature.properties.place;
        const isActive = place.id === activePlaceId;
        const el = buildPlaceMarkerElement(place, isActive);
        if (isActive) activeMarkerEl = el;
        const m = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([lng, lat]).addTo(map);
        el.querySelector('.gh-map-emoji-marker').addEventListener('click', () => focusPlace(place.id, el));
        clusterMarkers.push(m);
      }
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
        : '<div style="padding:20px;text-align:center;color:var(--text-muted)"><i class="fas fa-map-marker-alt" style="font-size:1.4rem;margin-bottom:8px;display:block"></i>No real places added yet.</div>';
      results.querySelectorAll('.map-result-card').forEach(card => card.addEventListener('click', () => focusPlace(card.dataset.id)));
    }

    const features = list.map(p => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { place: p }
    }));
    superclusterInst = new Supercluster({ radius: 60, maxZoom: 15, minPoints: 2 });
    superclusterInst.load(features);
    updateClusters();
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
    activeMarkerEl = clickedEl || null;
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
    if (detail) detail.href = p.source === 'businesses' ? 'business.html?id=' + encodeURIComponent(p.id) : '#';
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
      html += '<div class="map-chip map-chip--mood' + (currentMoodFilter === tag.id ? ' active' : '') + '" data-mood="' + esc(tag.id) + '">'
        + esc(tag.emoji + ' ' + tag.label)
        + '</div>';
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
    const msg = streak > 1
      ? '🔥 ' + streak + '-day streak! +' + xpGained + ' XP'
      : '✅ Checked in! +' + xpGained + ' XP';
    if (window.GeoSocial && window.GeoSocial.toast) { window.GeoSocial.toast(msg); return; }
    const el = document.createElement('div');
    el.className = 'map-checkin-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('map-checkin-toast--show'), 10);
    setTimeout(() => { el.classList.remove('map-checkin-toast--show'); setTimeout(() => el.remove(), 400); }, 3000);
  }

  function _openReviewModal(placeId, p, GF, user) {
    const existing = document.getElementById('mapReviewModal');
    if (existing) existing.remove();

    let rating = 0;
    const modal = document.createElement('div');
    modal.id = 'mapReviewModal';
    modal.className = 'map-review-overlay';
    modal.innerHTML = `
      <div class="map-review-modal">
        <button class="map-review-close" id="reviewClose"><i class="fas fa-times"></i></button>
        <div class="map-review-title">Rate your visit</div>
        <div class="map-review-place">${esc(p.name)}</div>
        <div class="map-review-stars" id="reviewStars">
          ${[1,2,3,4,5].map(i => `<button class="map-review-star" data-star="${i}">★</button>`).join('')}
        </div>
        <textarea class="map-review-text" id="reviewText" placeholder="Share your experience… (optional)" rows="3"></textarea>
        <button class="map-review-submit" id="reviewSubmit" disabled>Skip</button>
      </div>`;
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('open'), 10);

    const submitBtn = document.getElementById('reviewSubmit');
    const stars = modal.querySelectorAll('.map-review-star');

    stars.forEach(btn => btn.addEventListener('click', () => {
      rating = Number(btn.dataset.star);
      stars.forEach(s => s.classList.toggle('active', Number(s.dataset.star) <= rating));
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit review';
    }));

    function close() { modal.classList.remove('open'); setTimeout(() => modal.remove(), 280); }
    document.getElementById('reviewClose').onclick = close;
    modal.addEventListener('click', e => { if (e.target === modal) close(); });

    submitBtn.onclick = () => {
      if (submitBtn.textContent === 'Skip') { close(); return; }
      const text = (document.getElementById('reviewText') || {}).value || '';
      submitBtn.disabled = true; submitBtn.textContent = 'Saving…';
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
    const msg = '⭐ Review saved — thanks!';
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
    if (!GF || !user) { alert('Please sign in to check in.'); return; }
    if (userCheckins.has(placeId)) return;
    const p = allPlaces.find(x => x.id === placeId);
    if (!p) return;

    if (!navigator.geolocation) { _doCheckin(placeId, p, GF, user); return; }

    navigator.geolocation.getCurrentPosition(
      pos => {
        const dist = _haversineKm(pos.coords.latitude, pos.coords.longitude, p.lat, p.lng);
        if (dist > 0.01) {
          alert('You need to be within 10m of this place to check in. (You are ' + Math.round(dist * 1000) + 'm away)');
          return;
        }
        _doCheckin(placeId, p, GF, user);
      },
      () => alert('Please enable location access to check in.'),
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
    return '<div class="mood-tags-title">Vibes</div><div class="mood-tags-list">'
      + MOOD_TAGS.map(t => {
          const c = counts[t.id] || 0;
          const v = votes[t.id] === true;
          return '<button class="mood-tag' + (v ? ' voted' : '') + '" onclick="toggleMoodTag(\'' + placeId + '\',\'' + t.id + '\',this)">'
            + t.emoji + ' ' + t.label
            + (c > 0 ? ' <span class="mood-tag-count">' + c + '</span>' : '')
            + '</button>';
        }).join('')
      + '</div>';
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
    if (!GF || !user) { alert('Sign in to vote on vibes'); return; }
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
    const features = allPlaces.map(p => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { w: p.rating ? Math.max(0.4, p.rating) : 1 }
    }));
    src.setData({ type: 'FeatureCollection', features });
  }

  window.toggleHeatmap = function () {
    heatmapVisible = !heatmapVisible;
    if (map && map.getLayer('gh-heat-layer')) {
      map.setLayoutProperty('gh-heat-layer', 'visibility', heatmapVisible ? 'visible' : 'none');
    }
    const btn = document.getElementById('heatmapBtn');
    if (btn) btn.classList.toggle('active', heatmapVisible);
  };

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
    hint.innerHTML = '<span>🖱️ Right-drag: rotate &nbsp;|&nbsp; Ctrl+drag: tilt &nbsp;|&nbsp; Two-finger twist on mobile</span>';
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
    panel.innerHTML =
      '<div class="live-panel-head">' +
        '<span><i class="fas fa-satellite-dish"></i> Live Friends</span>' +
        '<button onclick="window.closeLivePanel()"><i class="fas fa-times"></i></button>' +
      '</div>' +
      '<div class="live-toggle-row">' +
        '<div class="live-toggle-text">' +
          '<div class="live-toggle-label">Share my location</div>' +
          '<div class="live-toggle-sub">Visible to friends only</div>' +
        '</div>' +
        '<label class="live-toggle-switch">' +
          '<input type="checkbox" id="locShareToggle">' +
          '<span class="live-toggle-slider"></span>' +
        '</label>' +
      '</div>' +
      '<div class="live-friends-list" id="liveFriendsList">' +
        '<div class="live-friends-empty"><i class="fas fa-user-slash"></i><span>No friends sharing location</span></div>' +
      '</div>';
    container.appendChild(panel);

    document.getElementById('locShareToggle').addEventListener('change', function () {
      if (this.checked) startSharingLocation(); else stopSharingLocation();
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
    if (!navigator.geolocation) { alert('GPS not available on this device.'); return; }
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
      if (err && err.code === 1) alert('Location permission denied. Please allow location access in your browser settings.');
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
    if (_myLatLng) {
      const dist = haversine(_myLatLng, [f.lng, f.lat]);
      distText = dist < 1 ? Math.round(dist * 1000) + ' m away' : dist.toFixed(1) + ' km away';
      etaStr = dist < 0.3 ? 'On foot: ~' + Math.round(dist / 0.08) + ' min'
             : dist < 5   ? 'On foot: ~' + Math.round(dist / 0.067) + ' min'
             : 'By car: ~' + Math.round(dist / 0.42) + ' min';
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
    document.getElementById('panelTitle').textContent = f.displayName || 'Friend';
    document.getElementById('panelCat').innerHTML   = '<span style="color:#10b981">🟢 Live Now</span>';
    document.getElementById('panelLoc').textContent  = distText;
    document.getElementById('panelRating').textContent = etaStr;
    document.getElementById('panelDesc').textContent = 'Live location — updates every 5 seconds';

    const detailBtn = document.getElementById('panelDetailBtn');
    detailBtn.href = 'profile.html?id=' + encodeURIComponent(uid);
    detailBtn.innerHTML = '<i class="fas fa-user"></i> Profile';
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
    if (!friends.length) {
      list.innerHTML = '<div class="live-friends-empty"><i class="fas fa-user-slash"></i><span>No friends sharing location right now</span></div>';
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
        '<div class="live-friend-info"><div class="live-friend-name">' + esc(f.displayName || 'Friend') + '</div>' +
        '<div class="live-friend-dist">' + (distText ? distText + ' away' : '🟢 Live') + '</div></div>' +
        '<button class="live-friend-nav" onclick="event.stopPropagation();window.goToFriend(\'' + f.uid + '\')" title="Navigate"><i class="fas fa-route"></i></button>' +
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

  /* ── Init ───────────────────────────────────────── */
  function init() {
    const currentStyle = getMapStyle();
    map = new maplibregl.Map({
      container:       'map',
      style:           TILE_LAYERS[currentStyle].style,
      center:          [43.5, 42.0],
      zoom:            7,
      maxPitch:        85,
      pitchWithRotate: true,
      attributionControl: false,
    });

    map.fitBounds([[40.0, 41.0], [46.7, 43.5]], { padding: 40, duration: 0 });

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
      buildMobileSidebar();
      renderMap();

      // Re-cluster on viewport change
      map.on('moveend', updateClusters);
      map.on('zoomend', updateClusters);

      if (window.GeoFirebase) {
        loadPlaceCategoriesFromFirestore();
        loadRealPlaces();
        loadUserCheckins();
      } else {
        window.addEventListener('GeoFirebaseReady', () => {
          loadPlaceCategoriesFromFirestore();
          loadRealPlaces();
          loadUserCheckins();
        }, { once: true });
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
