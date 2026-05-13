let currentStep = 1;
  let tags = [];
  let selectedCategory = '';
  let selectedPlan = 'free';
  let selectedBusinessType = 'physical';
  let selectedServiceArea = 'georgia';
  let editingBusinessId = new URLSearchParams(location.search).get('edit') || '';
  let editingBusinessData = null;

  // Hours inputs
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  document.getElementById('hoursInputs').innerHTML = days.map(d => `
    <div class="hours-grid">
      <div class="day-label">${d}</div>
      <input type="time" value="09:00" id="open_${d}">
      <input type="time" value="18:00" id="close_${d}">
      <label class="closed-toggle">
        <input type="checkbox" style="accent-color:var(--red)" id="closed_${d}"> Closed
      </label>
    </div>`).join('');

  days.forEach(d => {
    document.getElementById(`closed_${d}`).addEventListener('change', (e) => {
      document.getElementById(`open_${d}`).disabled = e.target.checked;
      document.getElementById(`close_${d}`).disabled = e.target.checked;
      document.getElementById(`open_${d}`).style.opacity = e.target.checked ? '0.4' : '1';
      document.getElementById(`close_${d}`).style.opacity = e.target.checked ? '0.4' : '1';
    });
  });


  function getBusinessType() {
    var selected = document.querySelector('.business-type-option.selected');
    return (selected && selected.dataset.businessType) || selectedBusinessType || 'physical';
  }

  function getServiceArea() {
    var sel = document.getElementById('serviceAreaSelect');
    return (sel && sel.value) || selectedServiceArea || 'georgia';
  }

  function serviceAreaLabel(area) {
    return {
      georgia: 'Available across Georgia',
      worldwide: 'Worldwide / Remote',
      tbilisi: 'Tbilisi only',
      batumi: 'Batumi only',
      regions: 'Selected Georgian regions'
    }[area || 'georgia'] || 'Available online';
  }

  function applyBusinessTypeUI() {
    var type = getBusinessType();
    var isOnline = type === 'online';
    var physical = document.getElementById('physicalLocationFields');
    var online = document.getElementById('onlineServiceAreaFields');
    var city = document.getElementById('citySelect');
    var address = document.getElementById('addressInput');
    var maps = document.getElementById('mapsLinkGroup');
    var hint = document.getElementById('businessTypeHint');
    var previewCity = document.getElementById('previewCity');

    if (physical) physical.style.display = isOnline ? 'none' : 'block';
    if (online) online.style.display = isOnline ? 'block' : 'none';
    if (maps) maps.style.display = isOnline ? 'none' : 'block';

    if (city) city.required = !isOnline;
    if (address) address.required = false;

    if (hint) hint.textContent = isOnline
      ? 'Online businesses can serve all Georgia without a physical address or map pin.'
      : 'Physical businesses appear on the map and nearby discovery.';

    if (isOnline && previewCity) previewCity.textContent = serviceAreaLabel(getServiceArea());
    if (!isOnline && previewCity) previewCity.textContent = city && city.value ? city.value + ', Georgia' : 'City, Georgia';
  }

  document.querySelectorAll('.business-type-option').forEach(function(opt) {
    opt.addEventListener('click', function() {
      document.querySelectorAll('.business-type-option').forEach(function(o) { o.classList.remove('selected'); });
      opt.classList.add('selected');
      selectedBusinessType = opt.dataset.businessType || 'physical';
      clearFieldErrors();
      applyBusinessTypeUI();


  function setValue(id, value) {
    var el = document.getElementById(id);
    if (el) el.value = value || '';
  }

  function selectCategory(cat) {
    if (!cat) return;
    var opt = document.querySelector('.cat-option[data-cat="' + String(cat).replace(/"/g, '\\"') + '"]');
    if (!opt) return;
    document.querySelectorAll('.cat-option').forEach(function(o) { o.classList.remove('selected'); });
    opt.classList.add('selected');
    selectedCategory = cat;
    var preview = document.getElementById('previewCat');
    if (preview) preview.textContent = opt.querySelector('.cat-icon').textContent + ' ' + opt.textContent.replace(/[^\w\s]/g,'').trim();
  }

  function selectBusinessType(type) {
    selectedBusinessType = type === 'online' ? 'online' : 'physical';
    document.querySelectorAll('.business-type-option').forEach(function(o) {
      o.classList.toggle('selected', o.dataset.businessType === selectedBusinessType);
    });
    applyBusinessTypeUI();
  }

  function loadEditBusinessIfNeeded() {
    if (!editingBusinessId) return;
    var geo = window.GeoFirebase;
    if (!geo || !geo.fs || !geo.db) {
      window.addEventListener('GeoFirebaseReady', loadEditBusinessIfNeeded, { once: true });
      return;
    }
    var f = geo.fs;
    f.getDoc(f.doc(geo.db, 'businesses', editingBusinessId)).then(function(snap) {
      if (!snap.exists()) {
        alert('Business not found.');
        return;
      }
      var data = snap.data() || {};
      editingBusinessData = data;
      var title = document.querySelector('.form-header h1');
      var subtitle = document.querySelector('.form-header p');
      if (title) title.innerHTML = 'Edit <span class="gradient-text">Business Page</span>';
      if (subtitle) subtitle.textContent = 'Update your GeoHub business page. Online businesses can work across all Georgia without an address.';
      setValue('bizNameInput', data.name || data.title || '');
      setValue('descInput', data.description || data.desc || '');
      setValue('citySelect', data.city || '');
      setValue('addressInput', data.address || '');
      setValue('phoneInput', data.phone || '');
      setValue('whatsappInput', data.whatsapp || '');
      setValue('emailInput', data.email || '');
      setValue('websiteInput', data.website || '');
      setValue('instagramInput', data.instagram || (data.socialLinks && data.socialLinks.instagram) || '');
      setValue('facebookInput', data.facebook || (data.socialLinks && data.socialLinks.facebook) || '');
      setValue('startingPriceInput', data.startingPrice || '');
      setValue('priceRangeSelect', data.priceRange || '');
      setValue('mapsLink', data.mapsLink || '');
      selectedPlan = data.plan || 'free';
      selectedServiceArea = data.serviceArea || 'georgia';
      setValue('serviceAreaSelect', selectedServiceArea);
      selectBusinessType(data.businessType || (data.isOnline ? 'online' : 'physical'));
      selectCategory(data.category || '');
      tags = Array.isArray(data.tags) ? data.tags.slice(0,8) : [];
      renderTags();
      var pn = document.getElementById('previewName');
      if (pn) pn.textContent = data.name || data.title || 'Your Business Name';
      applyBusinessTypeUI();
      var btn = document.querySelector('button[onclick="submitForm()"]');
      if (btn) btn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
    }).catch(function(err) {
      console.error('[AddBusiness] edit load failed', err);
      alert('Could not load business for editing: ' + (err.code || err.message));
    });
  }
  loadEditBusinessIfNeeded();
    });
  });

  var serviceAreaSelect = document.getElementById('serviceAreaSelect');
  if (serviceAreaSelect) {
    serviceAreaSelect.addEventListener('change', function(e) {
      selectedServiceArea = e.target.value || 'georgia';
      applyBusinessTypeUI();
    });
  }
  applyBusinessTypeUI();

  // Category selector
  document.querySelectorAll('.cat-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.cat-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedCategory = opt.dataset.cat;
      document.getElementById('previewCat').textContent = opt.querySelector('.cat-icon').textContent + ' ' + opt.textContent.replace(/[^\w\s]/g,'').trim();
    });
  });

  // Tag input
  document.getElementById('tagInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = e.target.value.trim().replace(/,/g,'');
      if (val && tags.length < 8 && !tags.includes(val)) {
        tags.push(val);
        renderTags();
        e.target.value = '';
      }
    }
  });
  function renderTags() {
    const container = document.getElementById('tagContainer');
    const input = document.getElementById('tagInput');
    const chips = container.querySelectorAll('.tag-chip');
    chips.forEach(c => c.remove());
    tags.forEach((tag, i) => {
      const chip = document.createElement('div');
      chip.className = 'tag-chip';
      chip.innerHTML = `${tag} <button onclick="removeTag(${i})">×</button>`;
      container.insertBefore(chip, input);
    });
  }
  function removeTag(i) { tags.splice(i, 1); renderTags(); }

  // Preview sync
  document.getElementById('bizNameInput').addEventListener('input', e => {
    document.getElementById('previewName').textContent = e.target.value || 'Your Business Name';
  });
  document.getElementById('citySelect').addEventListener('change', e => {
    if (getBusinessType() === 'online') {
      document.getElementById('previewCity').textContent = serviceAreaLabel(getServiceArea());
    } else {
      document.getElementById('previewCity').textContent = e.target.value ? `${e.target.value}, Georgia` : 'City, Georgia';
    }
  });

  // Plan selector
  document.querySelectorAll('.plan-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.plan-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedPlan = opt.dataset.plan;
    });
  });

  // Service rows
  function addServiceRow() {
    const container = document.getElementById('servicesInputs');
    const row = document.createElement('div');
    row.className = 'form-row';
    row.style.alignItems = 'flex-end';
    row.innerHTML = `
      <input type="text" class="form-input" placeholder="Service name">
      <input type="text" class="form-input" placeholder="Price (e.g. 80 GEL)">
      <button class="btn btn-ghost btn-sm" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>`;
    container.appendChild(row);
  }

  // Step validation helpers
  function clearFieldErrors() {
    document.querySelectorAll('.biz-field-err').forEach(function(e) { e.remove(); });
  }
  function markFieldError(el, msg) {
    el.style.outline = '2px solid #ef4444';
    var err = document.createElement('div');
    err.className = 'biz-field-err';
    err.style.cssText = 'color:#ef4444;font-size:0.77rem;margin-top:5px;font-weight:500';
    err.textContent = msg;
    el.parentNode.appendChild(err);
    el.addEventListener('input', clearFieldErrors, { once: true });
    el.addEventListener('change', function() { el.style.outline = ''; clearFieldErrors(); }, { once: true });
  }
  function validateStep1() {
    clearFieldErrors();
    var name = document.getElementById('bizNameInput').value.trim();
    var city = document.getElementById('citySelect').value;
    var cat  = document.querySelector('.cat-option.selected');
    var type = getBusinessType();
    var ok = true;
    if (!name) { markFieldError(document.getElementById('bizNameInput'), 'Business name is required.'); ok = false; }
    if (!cat)  {
      var catErr = document.createElement('div');
      catErr.className = 'biz-field-err';
      catErr.style.cssText = 'color:#ef4444;font-size:0.77rem;margin-top:5px;font-weight:500';
      catErr.textContent = 'Please select a category.';
      document.getElementById('catSelector').parentNode.appendChild(catErr);
      ok = false;
    }
    if (type !== 'online' && !city) { markFieldError(document.getElementById('citySelect'), 'Please select a city for a physical business.'); ok = false; }
    return ok;
  }

  // Step navigation
  function nextStep(n) {
    if (currentStep === 1 && n === 2 && !validateStep1()) return;
    document.getElementById(`step${currentStep}`).classList.remove('active');
    currentStep = n;
    document.getElementById(`step${n}`).classList.add('active');
    updateStepUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function prevStep(n) {
    clearFieldErrors();
    nextStep(n);
  }

  function updateStepUI() {
    const pct = (currentStep / 4) * 100;
    document.getElementById('progressFill').style.width = pct + '%';
    [1,2,3,4].forEach(i => {
      document.getElementById(`dot${i}`).className = 'step-dot' + (i < currentStep ? ' done' : '') + (i === currentStep ? ' active' : '');
      if (i < 4) document.getElementById(`line${i}`).className = 'step-line' + (i < currentStep ? ' active' : '');
    });
  }

  function collectHours() {
    var hours = {};
    days.forEach(function(d) {
      var closed = document.getElementById('closed_' + d).checked;
      hours[d] = {
        closed: closed,
        open: closed ? '' : document.getElementById('open_' + d).value,
        close: closed ? '' : document.getElementById('close_' + d).value
      };
    });
    return hours;
  }

  function collectServices() {
    return Array.from(document.querySelectorAll('#servicesInputs .form-row')).map(function(row) {
      var inputs = row.querySelectorAll('input');
      return {
        name: (inputs[0] && inputs[0].value || '').trim(),
        price: (inputs[1] && inputs[1].value || '').trim()
      };
    }).filter(function(x) { return x.name || x.price; });
  }

  function firstPreviewImage(selector) {
    var img = document.querySelector(selector + ' img');
    return img ? img.src : '';
  }

  function submitForm() {
    if (!validateStep1()) return;

    var geo = window.GeoFirebase;
    var user = geo && geo.auth && geo.auth.currentUser;
    if (!user) {
      if (window.GeoSocial && window.GeoSocial.requireAuth) window.GeoSocial.requireAuth();
      else window.location.href = 'auth.html';
      return;
    }

    var f = geo.fs;
    var name = (document.getElementById('bizNameInput') || {}).value.trim();
    var desc = (document.getElementById('descInput') || {}).value.trim();
    var city = (document.getElementById('citySelect') || {}).value;
    var businessType = getBusinessType();
    var serviceArea = businessType === 'online' ? getServiceArea() : (city ? city.toLowerCase() : 'local');
    var serviceAreaText = businessType === 'online' ? serviceAreaLabel(serviceArea) : (city ? city + ', Georgia' : 'Local business');
    var catEl = document.querySelector('.cat-option.selected');
    var cat = catEl ? catEl.dataset.cat : selectedCategory;
    var cover = firstPreviewImage('#coverUpload') || '';
    var gallery = Array.from(document.querySelectorAll('#uploadedPhotos img')).map(function(img){ return img.src; }).slice(0,10);

    var submitBtn = document.querySelector('button[onclick="submitForm()"]');
    var oldHtml = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + (editingBusinessId ? 'Saving...' : 'Creating...'); }

    var payload = {
      name: name,
      title: name,
      description: desc,
      desc: desc,
      category: cat || 'business',
      businessType: businessType,
      serviceArea: serviceArea,
      serviceAreaText: serviceAreaText,
      isOnline: businessType === 'online',
      city: businessType === 'online' ? '' : city,
      address: businessType === 'online' ? '' : ((document.getElementById('addressInput') || {}).value || ''),
      phone: (document.getElementById('phoneInput') || {}).value || '',
      email: (document.getElementById('emailInput') || {}).value || '',
      website: (document.getElementById('websiteInput') || {}).value || '',
      mapsLink: businessType === 'online' ? '' : ((document.getElementById('mapsLink') || {}).value || ''),
      whatsapp: (document.getElementById('whatsappInput') || {}).value || '',
      instagram: (document.getElementById('instagramInput') || {}).value || '',
      facebook: (document.getElementById('facebookInput') || {}).value || '',
      socialLinks: {
        instagram: (document.getElementById('instagramInput') || {}).value || '',
        facebook: (document.getElementById('facebookInput') || {}).value || ''
      },
      startingPrice: (document.getElementById('startingPriceInput') || {}).value || '',
      priceRange: (document.getElementById('priceRangeSelect') || {}).value || '',
      tags: tags.slice(0, 8),
      workingHours: collectHours(),
      services: collectServices(),
      plan: selectedPlan || 'free',
      coverImageUrl: cover,
      imageUrl: cover,
      logoUrl: '',
      galleryUrls: gallery,
      ownerId: user.uid,
      createdBy: user.uid,
      userId: user.uid,
      ownerName: user.displayName || (user.email ? user.email.split('@')[0] : 'GeoHub User'),
      ownerEmail: user.email || '',
      status: 'active',
      verified: false,
      followerCount: 0,
      postCount: 0,
      reviewCount: 0,
      ratingAverage: 0,
      createdAt: f.serverTimestamp(),
      updatedAt: f.serverTimestamp()
    };

    var savePromise;
    if (editingBusinessId) {
      payload.updatedAt = f.serverTimestamp();
      delete payload.createdAt;
      savePromise = f.updateDoc(f.doc(geo.db, 'businesses', editingBusinessId), payload)
        .then(function(){ return { id: editingBusinessId }; });
    } else {
      savePromise = f.addDoc(f.collection(geo.db, 'businesses'), payload).then(function(ref) {
        return f.setDoc(f.doc(geo.db, 'businessAdmins', ref.id + '_' + user.uid), {
          businessId: ref.id,
          userId: user.uid,
          role: 'owner',
          createdAt: f.serverTimestamp()
        }).then(function(){ return ref; });
      });
    }

    savePromise.then(function(ref) {
      document.getElementById('step4').classList.remove('active');
      document.getElementById('stepSuccess').classList.add('active');
      document.getElementById('progressFill').style.width = '100%';
      window.GeoLastCreatedBusinessId = ref.id;
      setTimeout(function(){ window.location.href = 'business.html?id=' + encodeURIComponent(ref.id); }, 900);
    }).catch(function(err) {
      console.error('[AddBusiness] Firestore create failed', err);
      alert('Business could not be created: ' + (err.code || err.message));
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = oldHtml; }
    });
  }

  // Hide account creation section if already logged in through Firebase Auth
  (function() {
    function apply() {
      var user = window.GeoFirebase && window.GeoFirebase.auth && window.GeoFirebase.auth.currentUser;
      if (!user) user = window.GeoAuth && window.GeoAuth.getCurrentUser && window.GeoAuth.getCurrentUser();
      if (user) {
        var fields = document.getElementById('accountFormFields');
        var notice = document.getElementById('accountAlreadyIn');
        if (fields) fields.style.display = 'none';
        if (notice) notice.style.display = 'block';
      }
    }
    apply();
    window.addEventListener('GeoAuthReady', apply);
  })();

  // Upload zone — file picker + preview
  ['coverUpload','galleryUpload'].forEach(id => {
    const zone = document.getElementById(id);
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('dragover');
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      handleFiles(id, zone, files);
    });
    zone.addEventListener('click', () => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*'; if (id === 'galleryUpload') inp.multiple = true;
      inp.style.display = 'none';
      document.body.appendChild(inp);
      inp.onchange = () => {
        handleFiles(id, zone, Array.from(inp.files));
        document.body.removeChild(inp);
      };
      inp.click();
    });
  });

  function handleFiles(id, zone, files) {
    files.slice(0, 10).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (id === 'coverUpload') {
          zone.innerHTML = `<img src="${ev.target.result}" style="width:100%;height:120px;object-fit:cover;border-radius:var(--radius-sm);display:block">`;
          const ph = document.querySelector('.preview-img-ph');
          if (ph) ph.innerHTML = `<img src="${ev.target.result}" style="width:100%;height:160px;object-fit:cover;display:block">`;
        } else {
          const img = document.createElement('img');
          img.src = ev.target.result;
          img.style.cssText = 'width:80px;height:64px;object-fit:cover;border-radius:6px';
          document.getElementById('uploadedPhotos').appendChild(img);
        }
      };
      reader.readAsDataURL(file);
    });
  }
