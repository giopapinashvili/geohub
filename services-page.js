(function initCatChips() {
  const wrap = document.getElementById('svCatChips');
  if (!wrap) return;
  SV_CATEGORIES.forEach((cat, i) => {
    const btn = document.createElement('button');
    btn.className = 'sv-cat-chip' + (i === 0 ? ' active' : '');
    const ico = i === 0 ? 'fas fa-th' : (function(c){const m={'Home Repair':'fas fa-tools','Cleaning':'fas fa-broom','Beauty':'fas fa-spa','Photography':'fas fa-camera','Design':'fas fa-pen-nib','Web Development':'fas fa-code','Fitness':'fas fa-dumbbell','Tour Guides':'fas fa-map','Drivers':'fas fa-car','Tutors':'fas fa-book','Event Services':'fas fa-glass-cheers','Moving':'fas fa-truck'};return m[c]||'fas fa-briefcase';})(cat);
    btn.innerHTML = `<i class="${ico}"></i>${cat}`;
    btn.onclick = () => {
      document.querySelectorAll('.sv-cat-chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      svState.category = cat;
      applySvFilters();
    };
    wrap.appendChild(btn);
  });
})();

function resetSvFilters() {
  svState = { category:'All', city:'all', priceMin:'', priceMax:'', rating:'all', verified:false, availableToday:false, onlineService:false, homeVisit:false, highTrust:false, q:'', sort:'featured' };
  document.getElementById('svSearchInput').value = '';
  document.getElementById('svCityFilter').value = 'all';
  document.getElementById('svRatingFilter').value = 'all';
  document.getElementById('svSortSelect').value = 'featured';
  document.getElementById('svPriceMin').value = '';
  document.getElementById('svPriceMax').value = '';
  ['svVerified','svAvailToday','svOnline','svHomeVisit','svHighTrust'].forEach(id => { const el = document.getElementById(id); if (el) el.checked = false; });
  document.querySelectorAll('.sv-cat-chip').forEach((b,i) => b.classList.toggle('active', i===0));
  applySvFilters();
}
