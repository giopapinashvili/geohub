(function () {
  'use strict';

  const CAT_COLORS = {
    tours: '#10b981', hotels: '#3b82f6', guesthouses: '#3b82f6', restaurants: '#f59e0b', cafes: '#f59e0b', attractions: '#a855f7', hiking: '#10b981', default: '#ef4444'
  };
  const CAT_LABELS = { tours:'Tours', hotels:'Hotels', guesthouses:'Guesthouses', restaurants:'Restaurants', cafes:'Cafés', attractions:'Sights', hiking:'Hiking', default:'Place' };
  const icons = { tours:'🗺️', hotels:'🏨', guesthouses:'🏡', restaurants:'🍽️', cafes:'☕', attractions:'🏛️', hiking:'🥾', camping:'⛺', default:'📍' };
  let map, markers = [], allPlaces = [], currentFilter = '', currentSearch = '';

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function createIcon(category) {
    const color = CAT_COLORS[category] || CAT_COLORS.default;
    const icon = icons[category] || icons.default;
    return L.divIcon({
      html: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 52" width="40" height="52"><path d="M20 0C9 0 0 9 0 20c0 15 20 32 20 32S40 35 40 20C40 9 31 0 20 0z" fill="' + color + '" opacity="0.9"/><circle cx="20" cy="20" r="14" fill="rgba(0,0,0,0.3)"/><text x="20" y="26" text-anchor="middle" font-size="16">' + icon + '</text></svg>',
      iconSize: [40, 52], iconAnchor: [20, 52], popupAnchor: [0, -52], className: ''
    });
  }

  function normalize(id, data, source) {
    const lat = Number(data.lat ?? data.latitude ?? (data.location && data.location.lat));
    const lng = Number(data.lng ?? data.longitude ?? (data.location && data.location.lng));
    if (!isFinite(lat) || !isFinite(lng)) return null;
    return {
      id, source, lat, lng,
      name: data.name || data.placeName || data.title || 'GeoHub Place',
      city: data.city || data.region || '',
      category: data.category || data.type || 'default',
      categoryLabel: data.categoryLabel || CAT_LABELS[data.category || data.type] || 'Place',
      image: data.image || data.imageUrl || data.mediaUrl || '',
      rating: Number(data.rating || 0),
      reviewCount: Number(data.reviewCount || 0),
      priceFrom: data.priceFrom || '', currency: data.currency || ''
    };
  }

  function filtered() {
    return allPlaces.filter(p => {
      if (currentFilter && p.category !== currentFilter) return false;
      if (currentSearch) {
        const q = currentSearch.toLowerCase();
        return (p.name + ' ' + p.city + ' ' + p.categoryLabel).toLowerCase().includes(q);
      }
      return true;
    });
  }

  function renderStars(r) { return r ? '⭐'.repeat(Math.max(1, Math.min(5, Math.round(r)))) : ''; }

  function renderMap() {
    markers.forEach(m => map.removeLayer(m)); markers = [];
    const list = filtered();
    const count = document.getElementById('mapCount'); if (count) count.textContent = list.length;
    const results = document.getElementById('mapResults');
    if (results) {
      results.innerHTML = list.length ? list.map(p => '<div class="map-result-card" data-id="' + esc(p.id) + '"><div class="map-result-info"><div class="map-result-name">' + esc(p.name) + '</div><div class="map-result-cat">' + esc(p.categoryLabel) + (p.city ? ' · ' + esc(p.city) : '') + '</div><div class="map-result-footer"><span class="rating-display">' + renderStars(p.rating) + '</span></div></div></div>').join('') : '<div style="padding:20px;text-align:center;color:var(--text-muted)"><i class="fas fa-map-marker-alt" style="font-size:1.4rem;margin-bottom:8px;display:block"></i>No real places added yet.</div>';
      results.querySelectorAll('.map-result-card').forEach(card => card.addEventListener('click', () => focusPlace(card.dataset.id)));
    }
    list.forEach(p => {
      const marker = L.marker([p.lat, p.lng], { icon: createIcon(p.category) });
      marker.on('click', () => focusPlace(p.id)); marker.addTo(map); markers.push(marker);
    });
  }

  function focusPlace(id) {
    const p = allPlaces.find(x => x.id === id); if (!p) return;
    map.setView([p.lat, p.lng], 13, { animate: true });
    const panel = document.getElementById('infoPanel');
    const img = document.getElementById('panelImg'); if (img) { img.src = p.image || ''; img.style.display = p.image ? '' : 'none'; }
    const title = document.getElementById('panelTitle'); if (title) title.textContent = p.name;
    const cat = document.getElementById('panelCat'); if (cat) cat.textContent = p.categoryLabel;
    const loc = document.getElementById('panelLoc'); if (loc) loc.textContent = p.city ? p.city + ', Georgia' : 'Georgia';
    const rating = document.getElementById('panelRating'); if (rating) rating.textContent = p.rating ? (p.rating + ' rating') : '';
    const detail = document.getElementById('panelDetailBtn'); if (detail) detail.href = p.source === 'businesses' ? 'business.html?id=' + encodeURIComponent(p.id) : '#';
    const maps = document.getElementById('panelMapBtn'); if (maps) maps.href = 'https://www.google.com/maps/search/' + encodeURIComponent(p.name + ' ' + (p.city || '') + ' Georgia');
    if (panel) panel.classList.add('open');
  }
  window.focusPlace = focusPlace;
  window.closePanel = function () { const p = document.getElementById('infoPanel'); if (p) p.classList.remove('open'); };

  function attachFilters() {
    document.querySelectorAll('.map-chip').forEach(chip => chip.addEventListener('click', () => {
      document.querySelectorAll('.map-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active'); currentFilter = chip.dataset.cat || ''; window.closePanel(); renderMap();
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
    attachFilters(); renderMap();
    if (window.GeoFirebase) loadRealPlaces(); else window.addEventListener('GeoFirebaseReady', loadRealPlaces, { once: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
