// Category chips init
(function() {
  const wrap = document.getElementById('catChips');
  if (!wrap) return;
  CATEGORIES.forEach((cat, i) => {
    const btn = document.createElement('button');
    btn.className = 'lr-cat-chip' + (i === 0 ? ' active' : '');
    btn.textContent = cat;
    btn.onclick = () => {
      document.querySelectorAll('.lr-cat-chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      lrState.category = cat;
      applyLrFilters();
    };
    wrap.appendChild(btn);
  });
})();

function resetLrFilters() {
  lrState = { view: lrState.view, q: '', category: 'All', mode: 'all', city: 'all', priceMin: '', priceMax: '', level: 'all', verified: false, free: false, highRating: false, sort: 'featured' };
  document.getElementById('lrSearchInput').value = '';
  document.getElementById('lrCityFilter').value = 'all';
  document.getElementById('lrSortSelect').value = 'featured';
  document.getElementById('lrPriceMin').value = '';
  document.getElementById('lrPriceMax').value = '';
  document.getElementById('lrVerified').checked = false;
  document.getElementById('lrFree').checked = false;
  document.getElementById('lrHighRating').checked = false;
  document.querySelectorAll('.lr-mode-btn').forEach((b,i)  => b.classList.toggle('active', i===0));
  document.querySelectorAll('.lr-level-btn').forEach((b,i) => b.classList.toggle('active', i===0));
  document.querySelectorAll('.lr-cat-chip').forEach((b,i)  => b.classList.toggle('active', i===0));
  applyLrFilters();
}

// Courses tab — reuse main layout with coursesGrid
document.querySelector('.lr-tab[data-tab="courses"]').addEventListener('click', function() {
  // Move grids into panel-teachers' layout when switching tabs
  lrState.view = 'courses';
  document.getElementById('teachersGrid').style.display = 'none';
  document.getElementById('coursesGrid').style.display = 'grid';
  applyLrFilters();
});

// Mentors tab — show teacher layout filtered
document.querySelector('.lr-tab[data-tab="mentors"]').addEventListener('click', function() {
  document.getElementById('panel-mentors').innerHTML = document.getElementById('panel-teachers').innerHTML.replace('id="panel-teachers"','');
});
