/* ── State ── */
  const state = {
    step: 1,
    photo: null,
    caption: '',
    place: null,
    mood: null,
    moodEmoji: null,
    rating: 0,
    friends: [],
    privacy: 'public',
    challenge: null
  };

  const PLACES = [
    { id:1, name:'Fabrika Tbilisi',       cat:'Café · Tbilisi',           img:'https://picsum.photos/seed/fabrika/80/80' },
    { id:2, name:'Rooms Hotel Kazbegi',   cat:'Hotel · Kazbegi',          img:'https://picsum.photos/seed/kazbegi-hotel/80/80' },
    { id:3, name:'Entree Coffee Vake',    cat:'Café · Tbilisi',           img:'https://picsum.photos/seed/entree-coffee/80/80' },
    { id:4, name:'Batumi Boulevard',      cat:'Attraction · Batumi',      img:'https://picsum.photos/seed/batumi-beach/80/80' },
    { id:5, name:'Signaghi Viewpoint',    cat:'Attraction · Signaghi',    img:'https://picsum.photos/seed/sighnaghi/80/80' },
    { id:6, name:'Old Tbilisi Wine House',cat:'Restaurant · Tbilisi',     img:'https://picsum.photos/seed/wine-house/80/80' },
    { id:7, name:'Gudauri Ski Resort',    cat:'Ski & Snow · Gudauri',     img:'https://picsum.photos/seed/gudauri/80/80' },
    { id:8, name:'Mtatsminda Park',       cat:'Attraction · Tbilisi',     img:'https://picsum.photos/seed/mtatsminda/80/80' },
  ];

  const FRIENDS = [
    { id:1, name:'Ana Kvaratskhelia', handle:'@ana.tbilisi',   avatar:'https://picsum.photos/seed/user-ana/80/80' },
    { id:2, name:'Giorgi Beridze',    handle:'@giorgi.wine',   avatar:'https://picsum.photos/seed/user-giorgi/80/80' },
    { id:3, name:'Mari Chikovanidze', handle:'@mari.cafe',     avatar:'https://picsum.photos/seed/user-mari/80/80' },
    { id:4, name:'Luka Abashidze',    handle:'@luka.mountain', avatar:'https://picsum.photos/seed/user-luka/80/80' },
    { id:5, name:'Tamo Jikia',        handle:'@tamo.vibes',    avatar:'https://picsum.photos/seed/user-tamo/80/80' },
  ];

  /* ── XP Calc ── */
  function calcXP() {
    let xp = 20;
    if (state.photo) xp += 15;
    if (state.rating > 0) xp += 10;
    xp += state.friends.length * 10;
    if (state.challenge) xp += 50;
    return xp;
  }

  function updateXP() {
    const xp = calcXP();
    const el = document.getElementById('xpCount');
    const old = parseInt(el.textContent);
    el.textContent = xp;
    document.getElementById('pvXP').textContent = xp;
    document.getElementById('xpb-total').textContent = xp;
    if (xp !== old) {
      const pill = document.getElementById('xpPill');
      pill.classList.add('bump');
      setTimeout(() => pill.classList.remove('bump'), 300);
    }
    // breakdown rows
    const hasPhoto = !!state.photo;
    const hasRating = state.rating > 0;
    const fCount = state.friends.length;
    const hasCh = !!state.challenge;
    styleXPRow('xpb-photo', 'xpb-photo-val', '+15', hasPhoto);
    styleXPRow('xpb-rating', 'xpb-rating-val', '+10', hasRating);
    document.getElementById('xpb-friend-count').textContent = fCount;
    styleXPRow('xpb-friends', 'xpb-friends-val', '+' + (fCount * 10), fCount > 0);
    styleXPRow('xpb-challenge', 'xpb-challenge-val', '+50', hasCh);
  }

  function styleXPRow(rowId, valId, text, earned) {
    const val = document.getElementById(valId);
    if (val) { val.textContent = text; val.className = 'xpb-val ' + (earned ? 'earn' : 'dim'); }
  }

  /* ── Step Navigation ── */
  function goStep(n) {
    // hide current
    document.getElementById('step' + state.step).classList.remove('active');
    state.step = n;
    // show target
    const target = document.getElementById('step' + n);
    if (target) target.classList.add('active');
    updateBar();
    updateFooter();
    if (n === 4) buildPreview();
  }

  function goNext() {
    if (state.step < 4) goStep(state.step + 1);
    else publish();
  }
  function goBack() { if (state.step > 1) goStep(state.step - 1); }

  function updateBar() {
    [1,2,3,4].forEach(i => {
      const seg = document.getElementById('seg' + i);
      seg.className = 'ci-seg' + (i < state.step ? ' done' : i === state.step ? ' active' : '');
    });
    document.getElementById('stepLabel').textContent = 'Step ' + state.step + ' of 4';
    document.getElementById('skipBtn').style.display = state.step < 4 ? '' : 'none';
  }

  function updateFooter() {
    document.getElementById('backBtn').style.display = state.step > 1 ? '' : 'none';
    const nxt = document.getElementById('nextBtn');
    if (state.step === 4) {
      nxt.textContent = ''; nxt.innerHTML = '<i class="fas fa-paper-plane"></i> Publish';
      nxt.className = 'ci-next publish';
    } else {
      nxt.innerHTML = 'Next <i class="fas fa-arrow-right"></i>';
      nxt.className = 'ci-next';
    }
  }

  /* ── Photo ── */
  document.getElementById('photoInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      state.photo = ev.target.result;
      document.getElementById('photoPreview').src = ev.target.result;
      document.getElementById('photoDrop').classList.add('has-img');
      document.getElementById('cpBadge').className = 'cp-badge verified';
      document.getElementById('cpBadge').innerHTML = '<i class="fas fa-check-circle"></i> Verified';
      updateXP();
    };
    reader.readAsDataURL(file);
  });

  function removePhoto() {
    state.photo = null;
    document.getElementById('photoPreview').src = '';
    document.getElementById('photoDrop').classList.remove('has-img');
    document.getElementById('cpBadge').className = 'cp-badge locked';
    document.getElementById('cpBadge').innerHTML = '<i class="fas fa-lock"></i> Pending';
    document.getElementById('photoInput').value = '';
    updateXP();
  }

  /* ── Caption ── */
  function updateCaption() {
    const v = document.getElementById('captionInput').value;
    state.caption = v;
    document.getElementById('captionLen').textContent = v.length;
  }

  /* ── Place Search ── */
  let placeTimeout;
  function filterPlaces(q) {
    clearTimeout(placeTimeout);
    placeTimeout = setTimeout(() => renderPlaces(q), 120);
    document.getElementById('placeDropdown').classList.add('open');
  }

  function showPlaces() {
    renderPlaces(document.getElementById('placeInput').value);
    document.getElementById('placeDropdown').classList.add('open');
  }

  function hidePlaces() {
    setTimeout(() => document.getElementById('placeDropdown').classList.remove('open'), 200);
  }

  function renderPlaces(q) {
    const dd = document.getElementById('placeDropdown');
    const results = q ? PLACES.filter(p => p.name.toLowerCase().includes(q.toLowerCase())) : PLACES;
    dd.innerHTML = results.slice(0,6).map(p => `
      <div class="place-item" onmousedown="selectPlace(${p.id})">
        <img class="pi-img" src="${p.img}" alt="">
        <div><div class="pi-name">${p.name}</div><div class="pi-cat">${p.cat}</div></div>
        ${state.place && state.place.id === p.id ? '<i class="fas fa-check pi-check" style="display:block"></i>' : ''}
      </div>`).join('');
  }

  function selectPlace(id) {
    const p = PLACES.find(x => x.id === id);
    if (!p) return;
    state.place = p;
    document.getElementById('placeInput').value = p.name;
    document.getElementById('placeChipName').textContent = p.name;
    document.getElementById('placeChip').style.display = 'block';
    document.getElementById('placeDropdown').classList.remove('open');
  }

  function removePlace() {
    state.place = null;
    document.getElementById('placeInput').value = '';
    document.getElementById('placeChip').style.display = 'none';
  }

  /* ── Mood ── */
  function selectMood(el) {
    document.querySelectorAll('.mood-chip').forEach(c => c.classList.remove('sel'));
    el.classList.add('sel');
    state.mood = el.dataset.mood;
    state.moodEmoji = el.querySelector('.m-emoji').textContent;
    updateXP();
  }

  /* ── Rating ── */
  function setRating(val) {
    state.rating = val;
    document.querySelectorAll('.star-btn').forEach((b,i) => b.classList.toggle('on', i < val));
    const labels = ['','Poor','Fair','Good','Great','Excellent'];
    document.getElementById('ratingLabel').textContent = '— ' + labels[val];
    updateXP();
  }

  /* ── Friends ── */
  function filterFriends(q) {
    const list = document.getElementById('friendList');
    const results = q ? FRIENDS.filter(f => f.name.toLowerCase().includes(q.toLowerCase())) : FRIENDS;
    renderFriendList(results);
  }

  function renderFriendList(list) {
    document.getElementById('friendList').innerHTML = list.map(f => {
      const tagged = state.friends.find(x => x.id === f.id);
      return `<div class="friend-row ${tagged ? 'tagged' : ''}" onclick="toggleFriend(${f.id})">
        <img class="fr-avatar" src="${f.avatar}" alt="">
        <div><div class="fr-name">${f.name}</div><div class="fr-handle">${f.handle}</div></div>
        <div class="fr-btn">${tagged ? '<i class="fas fa-check"></i>' : '<i class="fas fa-plus"></i>'}</div>
      </div>`;
    }).join('');
  }

  function toggleFriend(id) {
    const f = FRIENDS.find(x => x.id === id);
    const idx = state.friends.findIndex(x => x.id === id);
    if (idx > -1) state.friends.splice(idx, 1);
    else if (state.friends.length < 5) state.friends.push(f);
    renderFriendList(FRIENDS);
    renderTaggedChips();
    updateXP();
  }

  function renderTaggedChips() {
    document.getElementById('taggedChips').innerHTML = state.friends.map(f => `
      <div class="tagged-chip">
        <img src="${f.avatar}" alt="">
        ${f.name.split(' ')[0]}
        <i class="fas fa-times tc-x" onclick="event.stopPropagation();toggleFriend(${f.id})"></i>
      </div>`).join('');
  }

  /* ── Privacy ── */
  function selectPrivacy(el) {
    document.querySelectorAll('.priv-opt').forEach(o => o.classList.remove('sel'));
    el.classList.add('sel');
    state.privacy = el.dataset.priv;
  }

  /* ── Challenge ── */
  let challengeOpen = false;
  function toggleChallenge() {
    challengeOpen = !challengeOpen;
    document.getElementById('challengeToggle').classList.toggle('on', challengeOpen);
    document.getElementById('challengeOptions').classList.toggle('open', challengeOpen);
    if (!challengeOpen) { state.challenge = null; document.querySelectorAll('.ch-opt').forEach(o => o.classList.remove('sel')); updateXP(); }
  }

  function selectChallenge(el) {
    document.querySelectorAll('.ch-opt').forEach(o => o.classList.remove('sel'));
    el.classList.add('sel');
    state.challenge = el.dataset.ch;
    updateXP();
  }

  /* ── Build Preview ── */
  function buildPreview() {
    // image
    const pvImg = document.getElementById('pvImg');
    pvImg.src = state.photo || 'https://picsum.photos/seed/feed-placeholder/800/400';

    // caption
    const capEl = document.getElementById('pvCaption');
    capEl.textContent = state.caption || 'Your caption will appear here…';
    capEl.style.fontStyle = state.caption ? 'normal' : 'italic';
    capEl.style.color = state.caption ? '' : 'var(--text-muted)';

    // place
    const pvPlace = document.getElementById('pvPlace');
    if (state.place) {
      pvPlace.style.display = 'flex';
      document.getElementById('pvPlaceName').textContent = state.place.name + ' · ' + state.place.cat.split(' · ')[0];
    } else { pvPlace.style.display = 'none'; }

    // mood
    const pvMood = document.getElementById('pvMood');
    if (state.mood) {
      pvMood.style.display = 'flex';
      document.getElementById('pvMoodText').textContent = state.moodEmoji + ' ' + state.mood;
    } else { pvMood.style.display = 'none'; }

    // stars
    document.getElementById('pvStars').textContent = state.rating > 0 ? '★'.repeat(state.rating) + '☆'.repeat(5 - state.rating) : '';

    // xp
    updateXP();
  }

  /* ── Publish ── */
  function publish() {
    const btn = document.getElementById('nextBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing…';
    btn.disabled = true;
    setTimeout(() => {
      // show success
      document.getElementById('step4').classList.remove('active');
      document.getElementById('ciFooter').style.display = 'none';
      document.getElementById('successState').classList.add('show');
      document.getElementById('successXP').textContent = '+' + calcXP();
      launchConfetti();
    }, 1600);
  }

  function launchConfetti() {
    const colors = ['#10b981','#3b82f6','#f59e0b','#a855f7','#ef4444','#34d399','#60a5fa'];
    const layer = document.getElementById('confettiLayer');
    for (let i = 0; i < 60; i++) {
      const el = document.createElement('div');
      el.className = 'conf';
      el.style.left = Math.random() * 100 + 'vw';
      el.style.background = colors[Math.floor(Math.random() * colors.length)];
      el.style.animationDuration = (1.5 + Math.random() * 2) + 's';
      el.style.animationDelay = (Math.random() * 0.8) + 's';
      el.style.width = (5 + Math.random() * 6) + 'px';
      el.style.height = (5 + Math.random() * 6) + 'px';
      el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      layer.appendChild(el);
    }
    setTimeout(() => layer.innerHTML = '', 4000);
  }

  /* ── Init ── */
  renderFriendList(FRIENDS);
  updateXP();
  updateBar();
  updateFooter();

(function () {
  try {
    var u = JSON.parse(localStorage.getItem('geohub_auth_user') || 'null');
    if (!u) return;
    var name = u.fullName || (u.email || '').split('@')[0] || 'Explorer';
    var avatar = u.avatar || '';
    var nameEl = document.querySelector('.pc-name');
    var avatarEl = document.querySelector('.pc-avatar');
    if (nameEl) nameEl.textContent = name;
    if (avatarEl && avatar) { avatarEl.src = avatar; avatarEl.alt = name; }
    else if (avatarEl) avatarEl.style.display = 'none';
  } catch (e) {}
})();
