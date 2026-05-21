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

  let map, markers = [], allPlaces = [];
  let currentFilter = '', currentSearch = '', currentSubFilter = '';
  let disabledCategories = new Set();
  let activeMarker = null, activePlaceId = null;
  const _googleDetailsCache = {};
  const _placeCatLookup = {};

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

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
          subcategories: (data.subcategories || []).filter(s => s.active !== false)
        };
        changed = true;
      });
      if (changed) {
        buildLegend();
        if (allPlaces.length) renderMap();
      }
    }).catch(() => {});
  }

  /* ── Marker helpers ─────────────────────────────── */
  function getSubcategoryIcon(place) {
    if (!place.subcategory) return '';
    const catData = _placeCatLookup[place.categoryId];
    if (catData && catData.subcategories) {
      const sub = catData.subcategories.find(s => s.id === place.subcategory);
      if (sub && sub.icon) return sub.icon;
    }
    const staticCats = window.GEOHUB_PLACE_CATEGORIES || [];
    const staticCat = staticCats.find(c => c.id === place.categoryId);
    if (staticCat && staticCat.subcategories) {
      const sub = staticCat.subcategories.find(s => s.id === place.subcategory);
      if (sub && sub.icon) return sub.icon;
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

  function buildPlaceMarkerIcon(place, isActive) {
    const style       = getPlaceMarkerStyle(place);
    const markerIcon  = place.icon || style.icon || '📍';
    const markerColor = style.color || '#22c55e';
    const glow        = hexToRgba(markerColor, 0.45);
    const selectedClass = isActive ? ' is-selected' : '';
    const boxShadow = isActive
      ? '0 0 0 5px rgba(255,255,255,.14),0 0 32px ' + hexToRgba(markerColor, 0.7)
      : '0 0 0 4px rgba(255,255,255,.08),0 10px 24px rgba(0,0,0,.35),0 0 20px ' + glow;
    return L.divIcon({
      className: 'gh-map-marker-wrap',
      html: '<div class="gh-map-emoji-marker' + selectedClass + '" style="--marker-color:' + markerColor + ';box-shadow:' + boxShadow + '">'
          + '<span class="gh-map-marker-emoji">' + markerIcon + '</span>'
          + '</div>',
      iconSize:    [44, 44],
      iconAnchor:  [22, 22],
      popupAnchor: [0, -26]
    });
  }

  /* ── Normalize Firestore doc ────────────────────── */
  function normalize(id, data, source) {
    const lat = Number(data.lat ?? data.latitude ?? (data.location && data.location.lat));
    const lng = Number(data.lng ?? data.longitude ?? (data.location && data.location.lng));
    if (!isFinite(lat) || !isFinite(lng)) return null;
    const catId   = data.categoryId || '';
    const catText = data.category || data.type || '';
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
      subcategory:      data.subcategory || '',
      categoryLabel:    catText || style.label,
      shortDescription: data.shortDescription || data.description || '',
      image:            data.image || data.imageUrl || data.mediaUrl || '',
      rating:           Number(data.rating || 0),
      reviewCount:      Number(data.reviewCount || 0),
      priceFrom:        data.priceFrom || '',
      currency:         data.currency || '',
      googlePlaceId:    data.googlePlaceId || '',
      icon:             data.icon || ''
    };
  }

  /* ── Filter logic (chip + legend + search, all applied) */
  function filtered() {
    return allPlaces.filter(p => {
      const catKey = p.categoryId || 'default';
      if (disabledCategories.size > 0 && disabledCategories.has(catKey)) return false;
      if (currentFilter && p.categoryId !== currentFilter) return false;
      if (currentSubFilter && p.subcategory !== currentSubFilter) return false;
      if (currentSearch) {
        const q = currentSearch.toLowerCase();
        return (p.name + ' ' + p.city + ' ' + p.categoryLabel).toLowerCase().includes(q);
      }
      return true;
    });
  }

  function renderStars(r) { return r ? '⭐'.repeat(Math.max(1, Math.min(5, Math.round(r)))) : ''; }

  /* ── Map render ─────────────────────────────────── */
  function renderMap() {
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    const list = filtered();

    // If active place was filtered out, clear selection and close panels
    if (activePlaceId && !list.find(p => p.id === activePlaceId)) {
      activePlaceId = null; activeMarker = null;
      const panel = document.getElementById('infoPanel'); if (panel) panel.classList.remove('open');
      const card  = document.getElementById('mobileCard');  if (card)  card.classList.remove('open');
    }

    const count = document.getElementById('mapCount'); if (count) count.textContent = list.length;
    const results = document.getElementById('mapResults');
    if (results) {
      results.innerHTML = list.length
        ? list.map(p => '<div class="map-result-card" data-id="' + esc(p.id) + '"><div class="map-result-info"><div class="map-result-name">' + esc(p.name) + '</div><div class="map-result-cat">' + esc(p.categoryLabel) + (p.city ? ' · ' + esc(p.city) : '') + '</div><div class="map-result-footer"><span class="rating-display">' + renderStars(p.rating) + '</span></div></div></div>').join('')
        : '<div style="padding:20px;text-align:center;color:var(--text-muted)"><i class="fas fa-map-marker-alt" style="font-size:1.4rem;margin-bottom:8px;display:block"></i>No real places added yet.</div>';
      results.querySelectorAll('.map-result-card').forEach(card => card.addEventListener('click', () => focusPlace(card.dataset.id)));
    }

    list.forEach(p => {
      const isActive = p.id === activePlaceId;
      const marker   = L.marker([p.lat, p.lng], { icon: buildPlaceMarkerIcon(p, isActive) });
      marker.bindTooltip(p.name, { direction: 'top', offset: [0, -48], className: 'place-tooltip' });
      marker._placeId    = p.id;
      marker._place      = p;
      marker.on('click', () => focusPlace(p.id, marker));
      marker.addTo(map);
      markers.push(marker);
      if (isActive) activeMarker = marker;
    });
  }

  /* ── Active marker clear helper ─────────────────── */
  function clearActiveMarker() {
    if (activeMarker) activeMarker.setIcon(buildPlaceMarkerIcon(activeMarker._place, false));
    activeMarker = null; activePlaceId = null;
  }

  /* ── Focus place ────────────────────────────────── */
  function focusPlace(id, clickedMarker) {
    if (activeMarker) activeMarker.setIcon(buildPlaceMarkerIcon(activeMarker._place, false));
    activePlaceId = id;
    activeMarker  = clickedMarker || markers.find(m => m._placeId === id) || null;
    if (activeMarker) activeMarker.setIcon(buildPlaceMarkerIcon(activeMarker._place, true));

    const p = allPlaces.find(x => x.id === id); if (!p) return;
    map.setView([p.lat, p.lng], 13, { animate: true });

    if (window.innerWidth <= 768) {
      openMobileCard(p);
      return;
    }

    const panel    = document.getElementById('infoPanel');
    const img      = document.getElementById('panelImg');
    const imgFb    = document.getElementById('panelImgFallback');
    const pStyle   = getPlaceMarkerStyle(p);
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
    const cat    = document.getElementById('panelCat');   if (cat)    cat.textContent    = p.categoryLabel + (p.subcategory ? ' · ' + p.subcategory : '');
    const loc    = document.getElementById('panelLoc');   if (loc)    loc.textContent    = p.city ? p.city + ', Georgia' : 'Georgia';
    const rating = document.getElementById('panelRating'); if (rating) rating.textContent = p.rating ? (p.rating + ' rating') : '';
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
    if (panel) panel.classList.add('open');
  }
  window.focusPlace = focusPlace;

  window.closePanel = function () {
    const p = document.getElementById('infoPanel'); if (p) p.classList.remove('open');
    clearActiveMarker();
  };

  /* ── Mobile card ────────────────────────────────── */
  function buildMobileCard() {
    if (document.getElementById('mobileCard')) return;
    const div = document.createElement('div');
    div.id = 'mobileCard';
    div.className = 'mobile-place-card';
    div.innerHTML =
      '<div class="mpc-drag-handle"></div>'
      + '<button class="mpc-close" onclick="window.closeMobileCard()"><i class="fas fa-times"></i></button>'
      + '<div id="mpcImgWrap" class="mpc-img-wrap"><img id="mpcImg" src="" alt=""></div>'
      + '<div id="mpcFallback" class="mpc-fallback" style="display:none"></div>'
      + '<div class="mpc-body">'
      + '<div id="mpcName" class="mpc-name"></div>'
      + '<div id="mpcCat"  class="mpc-cat"></div>'
      + '<div id="mpcAddr" class="mpc-addr"></div>'
      + '<div id="mpcDesc" class="mpc-desc"></div>'
      + '<div id="mpcGoogleSection" style="display:none"></div>'
      + '<div class="mpc-btns">'
      + '<a id="mpcDirections" href="#" target="_blank" rel="noopener" class="btn btn-primary btn-sm"><i class="fas fa-directions"></i> Directions</a>'
      + '</div></div>';
    document.body.appendChild(div);
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
    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setTxt('mpcName', p.name);
    setTxt('mpcCat',  p.categoryLabel + (p.subcategory ? ' · ' + p.subcategory : ''));
    const addrParts = [p.district, p.address, p.city].filter(Boolean);
    setTxt('mpcAddr', addrParts.join(', '));
    setTxt('mpcDesc', p.shortDescription || '');
    const dir = document.getElementById('mpcDirections');
    if (dir) dir.href = 'https://www.google.com/maps/search/' + encodeURIComponent(p.name + ' ' + (p.city || '') + ' Georgia');
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
    card.classList.add('open');
  }

  window.closeMobileCard = function () {
    const card = document.getElementById('mobileCard'); if (card) card.classList.remove('open');
    clearActiveMarker();
  };

  /* ── Legend ─────────────────────────────────────── */
  function buildLegend() {
    const legend = document.getElementById('legend'); if (!legend) return;
    const firestoreIds = Object.keys(_placeCatLookup);
    let catEntries;
    if (firestoreIds.length > 0) {
      catEntries = firestoreIds.map(id => Object.assign({ id }, _placeCatLookup[id]));
    } else {
      catEntries = Object.entries(PLACE_MARKER_STYLES)
        .filter(([id]) => id !== 'default')
        .map(([id, s]) => Object.assign({ id, subcategories: [] }, s));
    }

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
        + '<span class="legend-label">' + (cat.label || cat.id) + '</span>'
        + (hasSubs ? '<button class="legend-expand-btn" data-for="' + cat.id + '">' + (expanded ? '▾' : '▸') + '</button>' : '')
        + '</div>';
      if (hasSubs) {
        html += '<div class="legend-subitems" id="legend-subs-' + cat.id + '"' + (expanded ? '' : ' style="display:none"') + '>';
        activeSubs.forEach(sub => {
          const subActive = currentFilter === cat.id && currentSubFilter === sub.id;
          html += '<div class="legend-subitem' + (subActive ? ' legend-active' : '') + '" data-cat="' + cat.id + '" data-sub="' + sub.id + '">'
            + '<span class="legend-sub-icon">' + (sub.icon || '') + '</span>'
            + '<span>' + (sub.labelKa || sub.labelEn || sub.id) + '</span>'
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
      buildLegend(); renderMap();
    });
    legend.querySelectorAll('.legend-item.legend-toggle').forEach(item => {
      item.addEventListener('click', e => {
        if (e.target.classList.contains('legend-expand-btn')) return;
        const cat = item.dataset.cat;
        currentFilter = (currentFilter === cat && !currentSubFilter) ? '' : cat;
        currentSubFilter = '';
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
        buildLegend(); renderMap();
        window.closePanel(); window.closeMobileCard();
      });
    });
  }

  function updateLegendState() {
    buildLegend();
  }

  /* ── Filter chips ───────────────────────────────── */
  function attachFilters() {
    document.querySelectorAll('.map-chip').forEach(chip => chip.addEventListener('click', () => {
      document.querySelectorAll('.map-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.cat || '';
      currentSubFilter = '';
      window.closePanel(); window.closeMobileCard();
      renderMap();
    }));
    const search = document.getElementById('mapSearchInput');
    if (search) search.addEventListener('input', e => { currentSearch = e.target.value || ''; renderMap(); });
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

  function loadRealPlaces() {
    Promise.all([loadCollection('places'), loadCollection('businesses')]).then(([places, businesses]) => {
      allPlaces = places.concat(businesses);
      renderMap();
    });
  }

  /* ── Init ───────────────────────────────────────── */
  function init() {
    map = L.map('map', { center: [42.0, 43.5], zoom: 7, zoomControl: true });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '©OpenStreetMap ©CartoDB', subdomains: 'abcd', maxZoom: 20 }).addTo(map);
    map.fitBounds([[41.0, 40.0], [43.5, 46.7]], { padding: [40, 40] });
    buildLegend(); buildMobileCard(); attachFilters(); renderMap();
    if (window.GeoFirebase) { loadPlaceCategoriesFromFirestore(); loadRealPlaces(); }
    else window.addEventListener('GeoFirebaseReady', () => { loadPlaceCategoriesFromFirestore(); loadRealPlaces(); }, { once: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
