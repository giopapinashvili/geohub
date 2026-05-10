// Filter chips
  function setChip(el) {
    document.querySelectorAll('.fchip').forEach(c => c.classList.remove('active','active-blue','active-gold'));
    el.classList.add('active');
    filterCards(el.dataset.filter);
  }

  // Sidebar categories
  function setSideCat(el) {
    document.querySelectorAll('.cat-filter').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
  }

  // Quick toggle switches
  function toggleQT(el) {
    el.querySelector('.qt-switch').classList.toggle('on');
  }

  // Sort buttons
  function setSort(el) {
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
  }

  // Map view toggle
  function setMapView(el) {
    document.querySelectorAll('.mvt-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
  }

  // Map toggle (show/hide map)
  let mapVisible = true;
  function toggleMapView() {
    const mapSection = document.querySelector('.mock-map-section');
    const btn = document.getElementById('mapToggle');
    mapVisible = !mapVisible;
    mapSection.style.display = mapVisible ? '' : 'none';
    btn.classList.toggle('active', mapVisible);
  }

  // Highlight card (from pin click or AI suggestion)
  function highlightCard(cardId) {
    document.querySelectorAll('.place-card').forEach(c => c.classList.remove('highlighted'));
    const card = document.getElementById(cardId);
    if (card) {
      card.classList.add('highlighted');
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => card.classList.remove('highlighted'), 3000);
    }
    // Also highlight corresponding map pin
    document.querySelectorAll('.map-pin').forEach(p => p.classList.remove('highlighted'));
    const pin = document.querySelector(`.map-pin[data-card="${cardId}"]`);
    if (pin) { pin.classList.add('highlighted'); setTimeout(() => pin.classList.remove('highlighted'), 3000); }
  }

  // Filter place cards
  function filterCards(filter) {
    const cards = document.querySelectorAll('.place-card');
    cards.forEach(card => { card.style.display = ''; }); // reset
    // In a real app, filter by category. Here just visual feedback.
  }

  // Search
  function onSearch(val) {
    document.getElementById('clearBtn').style.display = val ? '' : 'none';
  }
  function clearSearch() {
    document.getElementById('mainSearch').value = '';
    document.getElementById('clearBtn').style.display = 'none';
  }

  // Animate live active count
  let count = 847;
  setInterval(() => {
    count += Math.floor(Math.random() * 3) - 1;
    const el = document.getElementById('activeCount');
    if (el) el.textContent = count;
  }, 4000);
  window.GeoHubSocial?.refresh?.();
