const urlParams = new URLSearchParams(window.location.search);
  const bizId = parseInt(urlParams.get('id')) || 1;
  const biz = BUSINESSES.find(b => b.id === bizId) || BUSINESSES[0] || null;

  if (!biz) {
    document.title = 'Business — GeoHub';
    document.body.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;text-align:center;padding:40px 20px;color:#94a3b8"><i class="fas fa-store" style="font-size:2.5rem;margin-bottom:16px;opacity:0.4"></i><h2 style="font-size:1.2rem;font-weight:700;color:#e2e8f0;margin-bottom:8px">Business not found</h2><p style="font-size:0.9rem;margin-bottom:24px">This listing may have been removed or is not yet available.</p><a href="map.html" style="padding:10px 24px;background:#10b981;color:#000;border-radius:8px;text-decoration:none;font-weight:700">Explore Places</a></div>';
    throw new Error('No business data');
  }

  // Update title
  document.title = `${biz.name} — GeoHub`;

  // Breadcrumb
  document.getElementById('breadcrumbCat').textContent = biz.categoryLabel;
  document.getElementById('breadcrumbName').textContent = biz.name;

  // Gallery
  document.getElementById('mainImage').src = biz.images[0];
  document.getElementById('mainImage').alt = biz.name;
  if (biz.images[1]) { document.querySelector('#thumb1 img').src = biz.images[1]; }
  if (biz.images[2]) { document.querySelector('#thumb2 img').src = biz.images[2]; }
  if (biz.images.length > 2) document.getElementById('morePhotos').textContent = `+${biz.images.length - 2} More`;

  // Photo nav
  document.getElementById('photoNav').innerHTML = biz.images.map((img, i) => `
    <div class="photo-nav-thumb ${i === 0 ? 'active' : ''}" data-idx="${i}">
      <img src="${img}" alt="">
    </div>`).join('');
  document.querySelectorAll('.photo-nav-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      document.querySelectorAll('.photo-nav-thumb').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
      document.getElementById('mainImage').src = biz.images[parseInt(thumb.dataset.idx)];
    });
  });

  // Basic info
  document.getElementById('bizName').textContent = biz.name;
  document.getElementById('bizCategory').textContent = biz.categoryLabel;
  document.getElementById('bizCategory').className = `badge ${getCategoryBadgeClass(biz.category)}`;
  if (biz.verified) document.getElementById('bizVerified').innerHTML = '<span class="badge badge-verified"><i class="fas fa-check-circle"></i> Verified</span><span class="badge" style="background:rgba(16,185,129,0.12);color:#6ee7b7;border:1px solid rgba(16,185,129,0.2);margin-left:4px"><i class="fas fa-shield-alt"></i> Trust Score 94</span>';
  if (biz.premium) document.getElementById('bizPremium').innerHTML = '<span class="badge badge-gold"><i class="fas fa-star"></i> Premium</span>';
  document.getElementById('bizLocation').textContent = `${biz.city}, Georgia`;
  document.getElementById('bizRating').innerHTML = renderStars(biz.rating) + `<span class="score">${biz.rating}</span><span class="count">(${formatNumber(biz.reviewCount)} reviews)</span>`;
  document.getElementById('bizDescription').textContent = biz.description;

  // Tags
  document.getElementById('bizTags').innerHTML = (biz.tags || []).map(t => `<span class="profile-tag">${t}</span>`).join('');

  // Services
  if (biz.services) {
    document.getElementById('servicesGrid').innerHTML = biz.services.map(s => `
      <div class="service-item">
        <div class="service-item-name">${s.name}</div>
        <div class="service-item-price">${s.price}</div>
      </div>`).join('');
  }

  // Sidebar price
  document.getElementById('sidebarPrice').textContent = `${biz.priceFrom} ${biz.currency}`;

  // Map
  document.getElementById('mapPreviewImg').src = `https://picsum.photos/seed/map-${biz.id}/800/300`;
  document.getElementById('openMapBtn').href = `https://www.google.com/maps/search/${encodeURIComponent(biz.name + ' ' + biz.city + ' Georgia')}`;

  // Contact actions
  const contacts = [];
  if (biz.phone) contacts.push({ cls: 'green', icon: 'fas fa-phone', label: 'Phone', value: biz.phone, href: `tel:${biz.phone}` });
  if (biz.whatsapp) contacts.push({ cls: 'whatsapp', icon: 'fab fa-whatsapp', label: 'WhatsApp', value: 'Send Message', href: `https://wa.me/${biz.whatsapp.replace(/[^0-9]/g,'')}` });
  if (biz.instagram) contacts.push({ cls: 'instagram', icon: 'fab fa-instagram', label: 'Instagram', value: biz.instagram, href: '#' });
  if (biz.website) contacts.push({ cls: 'map-btn', icon: 'fas fa-globe', label: 'Website', value: biz.website, href: `https://${biz.website}` });
  contacts.push({ cls: 'map-btn', icon: 'fas fa-map-marked-alt', label: 'Location', value: `${biz.city}, Georgia`, href: `https://www.google.com/maps/search/${encodeURIComponent(biz.name + ' ' + biz.city)}` });

  document.getElementById('contactActions').innerHTML = contacts.map(c => `
    <a href="${c.href}" class="contact-btn ${c.cls}" target="_blank" rel="noopener">
      <div class="cb-icon"><i class="${c.icon}"></i></div>
      <div class="cb-info">
        <span class="cb-label">${c.label}</span>
        <span class="cb-value">${c.value}</span>
      </div>
      <i class="fas fa-arrow-right" style="color:var(--text-muted);font-size:0.75rem"></i>
    </a>`).join('');

  // Hours
  if (biz.hours) {
    const today = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];
    document.getElementById('hoursList').innerHTML = Object.entries(biz.hours).map(([day, time]) => `
      <div class="hour-row ${day === today ? 'today' : ''}">
        <span class="day">${day}</span>
        <span class="${time === 'Closed' ? 'closed' : 'time'}">${time}</span>
      </div>`).join('');
  } else { document.getElementById('hoursCard').style.display = 'none'; }

  // Reviews
  const bizReviews = REVIEWS.filter(r => r.businessId === biz.id);
  document.getElementById('ratingScore').textContent = biz.rating;
  document.getElementById('ratingStars').innerHTML = renderStars(biz.rating);
  document.getElementById('ratingOutOf').textContent = `out of 5 · ${formatNumber(biz.reviewCount)} reviews`;

  document.getElementById('reviewsList').innerHTML = bizReviews.length
    ? bizReviews.map(r => `
        <div class="review-card animate-fade-up">
          <div class="review-header">
            <div class="reviewer-info">
              <div class="reviewer-avatar">${r.avatar}</div>
              <div>
                <div class="reviewer-name">${r.author}</div>
                <div class="review-date">${r.date}</div>
              </div>
            </div>
            ${renderStars(r.rating)}
          </div>
          <p class="review-text">${r.text}</p>
        </div>`).join('')
    : `<div class="review-card" style="text-align:center;padding:32px;color:var(--text-secondary)"><i class="far fa-comment-dots" style="font-size:2rem;margin-bottom:12px;display:block"></i>No reviews yet. Be the first to review!</div>`;

  // Star input
  let selectedRating = 0;
  document.querySelectorAll('.star-btn').forEach(star => {
    star.addEventListener('mouseenter', () => document.querySelectorAll('.star-btn').forEach((s, i) => s.classList.toggle('active', i < parseInt(star.dataset.val))));
    star.addEventListener('mouseleave', () => document.querySelectorAll('.star-btn').forEach((s, i) => s.classList.toggle('active', i < selectedRating)));
    star.addEventListener('click', () => { selectedRating = parseInt(star.dataset.val); document.querySelectorAll('.star-btn').forEach((s, i) => s.classList.toggle('active', i < selectedRating)); });
  });

  // Wishlist
  document.getElementById('wishlistBtn').addEventListener('click', function() {
    toggleWishlist(biz.id);
    const saved = JSON.parse(localStorage.getItem('geohub_wishlist') || '[]').includes(biz.id);
    this.innerHTML = saved ? '<i class="fas fa-heart" style="color:var(--red)"></i> Saved' : '<i class="far fa-heart"></i> Save';
  });

  // Related
  const related = BUSINESSES.filter(b => b.id !== biz.id && (b.category === biz.category || b.city === biz.city)).slice(0, 4);
  document.getElementById('relatedGrid').innerHTML = related.map(b => renderListingCard(b)).join('');

  initScrollAnimations();
  window.GeoHubSocial?.refresh?.();
