(function () {
  'use strict';

  const PLACE_MARKER_STYLES = {
    food:          { color: '#e74c3c', icon: '🍽️', label: 'საჭმელი / კვება' },
    cafe:          { color: '#8e5a3c', icon: '☕',  label: 'კაფე / ყავა / დესერტი' },
    nightlife:     { color: '#8e44ad', icon: '🍸',  label: 'ბარები / ღამის ცხოვრება' },
    shopping:      { color: '#3498db', icon: '🛍️', label: 'შოპინგი / მაღაზიები' },
    transport:     { color: '#1f5fbf', icon: '🚇',  label: 'ტრანსპორტი' },
    education:     { color: '#27ae60', icon: '🎓',  label: 'განათლება' },
    health:        { color: '#ff5a6e', icon: '🏥',  label: 'ჯანმრთელობა' },
    beauty:        { color: '#ff66b3', icon: '✂️',  label: 'სილამაზე / თავის მოვლა' },
    sports:        { color: '#f39c12', icon: '🏃',  label: 'სპორტი / ფიტნესი' },
    entertainment: { color: '#f1c40f', icon: '🎮',  label: 'გასართობი' },
    nature:        { color: '#2ecc71', icon: '🌳',  label: 'პარკები / ბუნება' },
    culture:       { color: '#a67c52', icon: '🏛️', label: 'კულტურა / ისტორია' },
    religion:      { color: '#7d3c98', icon: '⛪',  label: 'რელიგიური ადგილები' },
    government:    { color: '#7f8c8d', icon: '🏢',  label: 'სახელმწიფო / ოფიციალური სერვისები' },
    finance:       { color: '#16a085', icon: '💳',  label: 'ფინანსები' },
    default:       { color: '#6c757d', icon: '📍',  label: 'სხვა' }
  };

  let map, markers = [], allPlaces = [], currentFilter = '', currentSearch = '', activeMarker = null;

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  function getPlaceMarkerStyle(place) {
    if (place.categoryId && PLACE_MARKER_STYLES[place.categoryId]) return PLACE_MARKER_STYLES[place.categoryId];
    if (place.category) {
      const byLabel = Object.values(PLACE_MARKER_STYLES).find(s => s.label === place.category);
      if (byLabel) return byLabel;
    }
    return PLACE_MARKER_STYLES.default;
  }

  function buildPlaceMarkerIcon(style, isActive) {
    const size = isActive ? 46 : 40;
    const h    = isActive ? 60 : 52;
    const ring = isActive ? '<circle cx="20" cy="20" r="19" fill="none" stroke="white" stroke-width="2.5" opacity="0.9"/>' : '';
    return L.divIcon({
      html: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 52" width="' + size + '" height="' + h + '">'
          + '<path d="M20 0C9 0 0 9 0 20c0 15 20 32 20 32S40 35 40 20C40 9 31 0 20 0z" fill="' + style.color + '" opacity="0.92"/>'
          + '<circle cx="20" cy="20" r="13" fill="rgba(0,0,0,0.25)"/>'
          + ring
          + '<text x="20" y="26" text-anchor="middle" font-size="15">' + style.icon + '</text>'
          + '</svg>',
      iconSize:    [size, h],
      iconAnchor:  [size / 2, h],
      popupAnchor: [0, -h],
      className: isActive ? 'place-marker-active' : ''
    });
  }

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
      name:          data.name || data.placeName || data.title || 'GeoHub Place',
      city:          data.city || data.region || '',
      categoryId:    catId,
      category:      catText,
      subcategory:   data.subcategory || '',
      categoryLabel: catText || style.label,
      image:         data.image || data.imageUrl || data.mediaUrl || '',
      rating:        Number(data.rating || 0),
      reviewCount:   Number(data.reviewCount || 0),
      priceFrom:     data.priceFrom || '',
      currency:      data.currency || ''
    };
  }

  function filtered() {
    return allPlaces.filter(p => {
      if (currentFilter && p.categoryId !== currentFilter) return false;
      if (currentSearch) {
        const q = currentSearch.toLowerCase();
        return (p.name + ' ' + p.city + ' ' + p.categoryLabel).toLowerCase().includes(q);
      }
      return true;
    });
  }

  function renderStars(r) { return r ? '⭐'.repeat(Math.max(1, Math.min(5, Math.round(r)))) : ''; }

  function renderMap() {
    markers.forEach(m => map.removeLayer(m));
    markers = []; activeMarker = null;
    const list = filtered();
    const count = document.getElementById('mapCount'); if (count) count.textContent = list.length;
    const results = document.getElementById('mapResults');
    if (results) {
      results.innerHTML = list.length
        ? list.map(p => '<div class="map-result-card" data-id="' + esc(p.id) + '"><div class="map-result-info"><div class="map-result-name">' + esc(p.name) + '</div><div class="map-result-cat">' + esc(p.categoryLabel) + (p.city ? ' · ' + esc(p.city) : '') + '</div><div class="map-result-footer"><span class="rating-display">' + renderStars(p.rating) + '</span></div></div></div>').join('')
        : '<div style="padding:20px;text-align:center;color:var(--text-muted)"><i class="fas fa-map-marker-alt" style="font-size:1.4rem;margin-bottom:8px;display:block"></i>No real places added yet.</div>';
      results.querySelectorAll('.map-result-card').forEach(card => card.addEventListener('click', () => focusPlace(card.dataset.id)));
    }
    list.forEach(p => {
      const style  = getPlaceMarkerStyle(p);
      const marker = L.marker([p.lat, p.lng], { icon: buildPlaceMarkerIcon(style, false) });
      marker.bindTooltip(p.name, { direction: 'top', offset: [0, -48], className: 'place-tooltip' });
      marker._placeId    = p.id;
      marker._placeStyle = style;
      marker.on('click', () => focusPlace(p.id, marker));
      marker.addTo(map);
      markers.push(marker);
    });
  }

  function focusPlace(id, clickedMarker) {
    if (activeMarker) activeMarker.setIcon(buildPlaceMarkerIcon(activeMarker._placeStyle, false));
    activeMarker = clickedMarker || markers.find(m => m._placeId === id) || null;
    if (activeMarker) activeMarker.setIcon(buildPlaceMarkerIcon(activeMarker._placeStyle, true));

    const p = allPlaces.find(x => x.id === id); if (!p) return;
    map.setView([p.lat, p.lng], 13, { animate: true });
    const panel = document.getElementById('infoPanel');
    const img = document.getElementById('panelImg');
    if (img) { img.src = p.image || ''; img.style.display = p.image ? '' : 'none'; }
    const title = document.getElementById('panelTitle'); if (title) title.textContent = p.name;
    const cat = document.getElementById('panelCat');
    if (cat) cat.textContent = p.categoryLabel + (p.subcategory ? ' · ' + p.subcategory : '');
    const loc = document.getElementById('panelLoc'); if (loc) loc.textContent = p.city ? p.city + ', Georgia' : 'Georgia';
    const rating = document.getElementById('panelRating'); if (rating) rating.textContent = p.rating ? (p.rating + ' rating') : '';
    const detail = document.getElementById('panelDetailBtn');
    if (detail) detail.href = p.source === 'businesses' ? 'business.html?id=' + encodeURIComponent(p.id) : '#';
    const maps = document.getElementById('panelMapBtn');
    if (maps) maps.href = 'https://www.google.com/maps/search/' + encodeURIComponent(p.name + ' ' + (p.city || '') + ' Georgia');
    if (panel) panel.classList.add('open');
  }
  window.focusPlace = focusPlace;

  window.closePanel = function () {
    const p = document.getElementById('infoPanel'); if (p) p.classList.remove('open');
    if (activeMarker) { activeMarker.setIcon(buildPlaceMarkerIcon(activeMarker._placeStyle, false)); activeMarker = null; }
  };

  function buildLegend() {
    const legend = document.getElementById('legend');
    if (!legend) return;
    const items = Object.entries(PLACE_MARKER_STYLES).map(([, s]) =>
      '<div class="legend-item"><span class="legend-dot" style="background:' + s.color + '"></span>'
      + '<span class="legend-icon">' + s.icon + '</span>'
      + '<span>' + s.label + '</span></div>'
    ).join('');
    legend.innerHTML = '<div class="legend-title">კატეგორიები</div><div class="legend-scroll">' + items + '</div>';
  }

  function attachFilters() {
    document.querySelectorAll('.map-chip').forEach(chip => chip.addEventListener('click', () => {
      document.querySelectorAll('.map-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.cat || '';
      window.closePanel();
      renderMap();
    }));
    const search = document.getElementById('mapSearchInput');
    if (search) search.addEventListener('input', e => { currentSearch = e.target.value || ''; renderMap(); });
  }

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

  function init() {
    map = L.map('map', { center: [42.0, 43.5], zoom: 7, zoomControl: true });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '©OpenStreetMap ©CartoDB', subdomains: 'abcd', maxZoom: 20 }).addTo(map);
    map.fitBounds([[41.0, 40.0], [43.5, 46.7]], { padding: [40, 40] });
    buildLegend(); attachFilters(); renderMap();
    if (window.GeoFirebase) loadRealPlaces();
    else window.addEventListener('GeoFirebaseReady', loadRealPlaces, { once: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
