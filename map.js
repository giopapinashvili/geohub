// Category colors
  const CAT_COLORS = {
    tours: '#10b981', hotels: '#3b82f6', guesthouses: '#3b82f6',
    restaurants: '#f59e0b', cafes: '#f59e0b',
    attractions: '#a855f7', hiking: '#10b981',
    default: '#ef4444'
  };

  // Custom marker icon
  function createIcon(category) {
    const color = CAT_COLORS[category] || CAT_COLORS.default;
    const icons = { tours: '🗺️', hotels: '🏨', guesthouses: '🏡', restaurants: '🍽️', cafes: '☕', attractions: '🏛️', hiking: '🥾', camping: '⛺', default: '📍' };
    const icon = icons[category] || icons.default;
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 52" width="40" height="52">
        <path d="M20 0C9 0 0 9 0 20c0 15 20 32 20 32S40 35 40 20C40 9 31 0 20 0z" fill="${color}" opacity="0.9"/>
        <circle cx="20" cy="20" r="14" fill="rgba(0,0,0,0.3)"/>
        <text x="20" y="26" text-anchor="middle" font-size="16">${icon}</text>
      </svg>`;
    return L.divIcon({
      html: svg,
      iconSize: [40, 52],
      iconAnchor: [20, 52],
      popupAnchor: [0, -52],
      className: ''
    });
  }

  // Init map — centered on Georgia
  const map = L.map('map', {
    center: [42.0, 43.5],
    zoom: 7,
    zoomControl: true
  });

  // Dark tile layer (CartoDB Dark Matter)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '©OpenStreetMap ©CartoDB',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map);

  let markers = [];
  let currentFilter = '';
  let currentSearch = '';
  let activeMarker = null;

  function getFiltered() {
    return BUSINESSES.filter(b => {
      if (currentFilter && b.category !== currentFilter) return false;
      if (currentSearch) {
        const q = currentSearch.toLowerCase();
        if (!b.name.toLowerCase().includes(q) && !b.city.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }

  function renderMap() {
    // Remove old markers
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    const filtered = getFiltered();
    document.getElementById('mapCount').textContent = filtered.length;

    // Render results list
    document.getElementById('mapResults').innerHTML = filtered.map(b => `
      <div class="map-result-card" data-id="${b.id}" onclick="focusPlace(${b.id})">
        <img class="map-result-img" src="${b.image}" alt="${b.name}" loading="lazy">
        <div class="map-result-info">
          <div class="map-result-name">${b.name}</div>
          <div class="map-result-cat">${b.categoryLabel} · ${b.city}</div>
          <div class="map-result-footer">
            <div class="rating-display">${renderStars(b.rating)}<span class="score" style="font-size:0.8rem">${b.rating}</span></div>
            <span style="font-size:0.78rem;color:var(--green);font-weight:600">${b.priceFrom} ${b.currency}</span>
          </div>
        </div>
      </div>`).join('');

    // Add markers
    filtered.forEach(biz => {
      const marker = L.marker([biz.lat, biz.lng], { icon: createIcon(biz.category) });
      marker.on('click', () => focusPlace(biz.id));
      marker.addTo(map);
      markers.push(marker);
    });
  }

  function focusPlace(id) {
    const biz = BUSINESSES.find(b => b.id === id);
    if (!biz) return;

    // Pan map
    map.setView([biz.lat, biz.lng], 13, { animate: true });

    // Update info panel
    document.getElementById('panelImg').src = biz.image;
    document.getElementById('panelTitle').textContent = biz.name;
    document.getElementById('panelCat').innerHTML = `<span class="badge ${getCategoryBadgeClass(biz.category)}">${biz.categoryLabel}</span>`;
    document.getElementById('panelLoc').innerHTML = `<i class="fas fa-map-marker-alt" style="color:var(--green)"></i> ${biz.city}, Georgia`;
    document.getElementById('panelRating').innerHTML = renderStars(biz.rating) + ` <span style="font-size:0.8rem;font-weight:700">${biz.rating}</span> <span style="font-size:0.75rem;color:var(--text-muted)">(${formatNumber(biz.reviewCount)})</span>`;
    document.getElementById('panelDetailBtn').href = `business.html?id=${biz.id}`;
    document.getElementById('panelMapBtn').href = `https://www.google.com/maps/search/${encodeURIComponent(biz.name + ' ' + biz.city + ' Georgia')}`;
    document.getElementById('infoPanel').classList.add('open');

    // Highlight result card
    document.querySelectorAll('.map-result-card').forEach(c => c.classList.toggle('active', parseInt(c.dataset.id) === id));
  }

  function closePanel() {
    document.getElementById('infoPanel').classList.remove('open');
    document.querySelectorAll('.map-result-card').forEach(c => c.classList.remove('active'));
  }

  // Category filter chips
  document.querySelectorAll('.map-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.map-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.cat;
      closePanel();
      renderMap();
    });
  });

  // Search
  document.getElementById('mapSearchInput').addEventListener('input', debounce(e => {
    currentSearch = e.target.value;
    renderMap();
  }));

  // Add Georgia boundary outline (approximate bounding box markers)
  const georgiaBounds = [[41.0, 40.0], [43.5, 46.7]];
  map.fitBounds(georgiaBounds, { padding: [40, 40] });

  // Add major city markers
  const cities = [
    { name: 'Tbilisi', lat: 41.6938, lng: 44.8015 },
    { name: 'Batumi', lat: 41.6405, lng: 41.6372 },
    { name: 'Kutaisi', lat: 42.2679, lng: 42.6979 },
    { name: 'Kazbegi', lat: 42.6587, lng: 44.6406 },
    { name: 'Mestia', lat: 43.0490, lng: 42.7216 },
    { name: 'Gudauri', lat: 42.4793, lng: 44.4773 },
    { name: 'Sighnaghi', lat: 41.6167, lng: 45.9333 },
    { name: 'Borjomi', lat: 41.8397, lng: 43.3878 },
  ];

  cities.forEach(city => {
    L.circleMarker([city.lat, city.lng], {
      radius: 5, color: '#ffffff', fillColor: '#94a3b8', fillOpacity: 0.7, weight: 1
    }).bindTooltip(city.name, { permanent: false, direction: 'top', className: '' }).addTo(map);
  });

  // Initial render
  renderMap();
