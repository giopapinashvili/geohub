// Category chips init
  const GR_CAT_ICONS = {
    'All':'fas fa-th','Hiking':'fas fa-mountain','Cafés':'fas fa-coffee','Photography':'fas fa-camera',
    'Nightlife':'fas fa-moon','Startups':'fas fa-rocket','Fitness':'fas fa-dumbbell',
    'Students':'fas fa-graduation-cap','Travel':'fas fa-map-marked-alt','Learning':'fas fa-book-open',
    'Real Estate':'fas fa-building'
  };
  const chipsContainer = document.getElementById('grCatChips');
  if (chipsContainer && typeof GROUP_CATEGORIES !== 'undefined') {
    GROUP_CATEGORIES.forEach(cat => {
      const chip = document.createElement('button');
      chip.className = 'gr-cat-chip' + (cat === 'All' ? ' active' : '');
      chip.innerHTML = `<i class="${GR_CAT_ICONS[cat]||'fas fa-tag'}"></i>${cat}`;
      chip.addEventListener('click', () => {
        document.querySelectorAll('.gr-cat-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        grState.category = cat;
        applyGrFilters();
      });
      chipsContainer.appendChild(chip);
    });
  }

  function resetGrFilters() {
    grState.city = 'all'; grState.verified = false; grState.open = false; grState.q = '';
    document.getElementById('grCityFilter').value = 'all';
    document.getElementById('grVerified').checked = false;
    document.getElementById('grOpen').checked = false;
    document.getElementById('grSearchInput').value = '';
    applyGrFilters();
  }
