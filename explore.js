let currentView = 'grid';
  let filters = { category: '', cities: [], minRating: 0, maxPrice: 1000, tags: [], search: '', sort: 'featured', verified: false, premium: false };

  // Parse URL params
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('category')) filters.category = urlParams.get('category');
  if (urlParams.get('q')) filters.search = urlParams.get('q');
  if (urlParams.get('city')) {
    const c = urlParams.get('city');
    filters.cities = [c.charAt(0).toUpperCase() + c.slice(1)];
  }

  // Set initial radio
  if (filters.category) {
    const radio = document.querySelector(`input[name="category"][value="${filters.category}"]`);
    if (radio) radio.checked = true;
  } else {
    document.querySelector('input[name="category"][value=""]').checked = true;
  }

  // Set initial checkboxes for cities
  filters.cities.forEach(city => {
    const cb = document.querySelector(`input[name="city"][value="${city}"]`);
    if (cb) cb.checked = true;
  });

  // Set initial search
  if (filters.search) document.getElementById('sidebarSearch').value = filters.search;

  function getFiltered() {
    return BUSINESSES.filter(b => {
      if (filters.category && b.category !== filters.category) return false;
      if (filters.cities.length && !filters.cities.includes(b.city)) return false;
      if (filters.minRating && b.rating < filters.minRating) return false;
      if (b.priceFrom > filters.maxPrice) return false;
      if (filters.tags.length && !filters.tags.some(t => b.tags.includes(t))) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!b.name.toLowerCase().includes(q) && !b.city.toLowerCase().includes(q) && !b.description.toLowerCase().includes(q)) return false;
      }
      if (filters.verified && !b.verified) return false;
      if (filters.premium && !b.premium) return false;
      return true;
    }).sort((a, b) => {
      if (filters.sort === 'rating') return b.rating - a.rating;
      if (filters.sort === 'price-asc') return a.priceFrom - b.priceFrom;
      if (filters.sort === 'price-desc') return b.priceFrom - a.priceFrom;
      if (filters.sort === 'reviews') return b.reviewCount - a.reviewCount;
      // featured first
      return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
    });
  }

  function renderResults() {
    const results = getFiltered();
    document.getElementById('resultsCount').textContent = results.length;

    const context = filters.search ? ` for "<strong>${filters.search}</strong>"` : (filters.category ? ` in <strong>${filters.category}</strong>` : '');
    document.getElementById('resultsContext').innerHTML = context;

    const grid = document.getElementById('resultsGrid');
    if (!results.length) {
      grid.innerHTML = '';
      document.getElementById('noResults').classList.remove('hidden');
      return;
    }
    document.getElementById('noResults').classList.add('hidden');

    if (currentView === 'grid') {
      grid.className = 'listings-grid';
      grid.innerHTML = results.map(b => renderListingCard(b)).join('');
    } else {
      grid.className = '';
      grid.style.display = 'flex';
      grid.style.flexDirection = 'column';
      grid.style.gap = '12px';
      grid.innerHTML = results.map(b => `
        <a href="business.html?id=${b.id}" class="listing-card-list">
          <div class="list-img">
            <img src="${b.image}" alt="${b.name}" loading="lazy">
          </div>
          <div class="list-content">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
              <div style="font-size:1rem;font-weight:700">${b.name}</div>
              <span class="badge ${getCategoryBadgeClass(b.category)}">${b.categoryLabel}</span>
            </div>
            <div class="listing-card-location" style="margin:4px 0"><i class="fas fa-map-marker-alt"></i> ${b.city}, Georgia</div>
            <div class="rating-display">${renderStars(b.rating)} <span class="score">${b.rating}</span> <span class="count">(${formatNumber(b.reviewCount)})</span></div>
            <div class="list-desc">${b.description}</div>
            <div class="list-footer">
              <div class="listing-card-price"><span class="from">From </span><span class="amount">${b.priceFrom} ${b.currency}</span></div>
              <a href="business.html?id=${b.id}" class="btn btn-primary btn-sm">View Details</a>
            </div>
          </div>
        </a>`).join('');
    }
    initScrollAnimations();
    renderActiveFilters();
  }

  function renderActiveFilters() {
    const af = document.getElementById('activeFilters');
    const chips = [];
    if (filters.category) chips.push({ label: `Category: ${filters.category}`, clear: () => { filters.category = ''; document.querySelector('input[name="category"][value=""]').checked = true; } });
    filters.cities.forEach(c => chips.push({ label: c, clear: () => { filters.cities = filters.cities.filter(x => x !== c); document.querySelector(`input[name="city"][value="${c}"]`).checked = false; } }));
    filters.tags.forEach(t => chips.push({ label: t, clear: () => { filters.tags = filters.tags.filter(x => x !== t); document.querySelector(`[data-tag="${t}"]`).classList.remove('active'); } }));
    if (filters.search) chips.push({ label: `"${filters.search}"`, clear: () => { filters.search = ''; document.getElementById('sidebarSearch').value = ''; } });
    if (chips.length) {
      af.style.display = 'flex';
      af.innerHTML = chips.map((c, i) => `<div class="active-filter-chip" data-chip="${i}">${c.label} <i class="fas fa-times"></i></div>`).join('');
      af.querySelectorAll('.active-filter-chip').forEach((el, i) => el.addEventListener('click', () => { chips[i].clear(); renderResults(); }));
    } else {
      af.style.display = 'none';
    }
  }

  function clearAllFilters() {
    filters = { category: '', cities: [], minRating: 0, maxPrice: 1000, tags: [], search: '', sort: 'featured', verified: false, premium: false };
    document.querySelector('input[name="category"][value=""]').checked = true;
    document.querySelectorAll('input[name="city"]').forEach(cb => cb.checked = false);
    document.getElementById('sidebarSearch').value = '';
    document.getElementById('priceRange').value = 1000;
    document.getElementById('priceLabel').textContent = 'Up to 1000 GEL';
    document.querySelectorAll('.rating-btn').forEach(b => b.classList.toggle('active', b.dataset.rating === '0'));
    document.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
    renderResults();
  }

  // Event listeners
  document.querySelectorAll('input[name="category"]').forEach(r => r.addEventListener('change', e => { filters.category = e.target.value; renderResults(); }));
  document.querySelectorAll('input[name="city"]').forEach(cb => cb.addEventListener('change', e => {
    if (e.target.checked) filters.cities.push(e.target.value);
    else filters.cities = filters.cities.filter(c => c !== e.target.value);
    renderResults();
  }));
  document.getElementById('sidebarSearch').addEventListener('input', debounce(e => { filters.search = e.target.value; renderResults(); }));
  document.getElementById('priceRange').addEventListener('input', e => {
    filters.maxPrice = parseInt(e.target.value);
    document.getElementById('priceLabel').textContent = `Up to ${e.target.value} GEL`;
    renderResults();
  });
  document.querySelectorAll('.rating-btn').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filters.minRating = parseInt(btn.dataset.rating);
    renderResults();
  }));
  document.querySelectorAll('.filter-tag').forEach(tag => tag.addEventListener('click', () => {
    const t = tag.dataset.tag;
    if (tag.classList.toggle('active')) filters.tags.push(t);
    else filters.tags = filters.tags.filter(x => x !== t);
    renderResults();
  }));
  document.getElementById('sortSelect').addEventListener('change', e => { filters.sort = e.target.value; renderResults(); });
  document.getElementById('clearFilters').addEventListener('click', clearAllFilters);
  document.querySelectorAll('input[name="verified"]').forEach(cb => cb.addEventListener('change', e => { filters.verified = e.target.checked; renderResults(); }));
  document.querySelectorAll('input[name="premium"]').forEach(cb => cb.addEventListener('change', e => { filters.premium = e.target.checked; renderResults(); }));

  document.getElementById('gridView').addEventListener('click', () => {
    currentView = 'grid';
    document.getElementById('gridView').classList.add('active');
    document.getElementById('listView').classList.remove('active');
    renderResults();
  });
  document.getElementById('listView').addEventListener('click', () => {
    currentView = 'list';
    document.getElementById('listView').classList.add('active');
    document.getElementById('gridView').classList.remove('active');
    renderResults();
  });

  renderResults();
