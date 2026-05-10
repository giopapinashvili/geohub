let currentStep = 1;
  let tags = [];
  let selectedCategory = '';
  let selectedPlan = 'free';

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
    document.getElementById('previewCity').textContent = e.target.value ? `${e.target.value}, Georgia` : 'City, Georgia';
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
    if (!city) { markFieldError(document.getElementById('citySelect'), 'Please select a city.'); ok = false; }
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

  function submitForm() {
    document.getElementById('step4').classList.remove('active');
    document.getElementById('stepSuccess').classList.add('active');
    document.getElementById('progressFill').style.width = '100%';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Save business under the current user so dashboard shows it
    try {
      var name = (document.getElementById('bizNameInput') || {}).value || 'My Business';
      var desc = (document.getElementById('descInput') || {}).value || '';
      var city = (document.getElementById('citySelect') || {}).value || 'Tbilisi';
      var cat  = (document.querySelector('.cat-option.selected') || {}).dataset?.cat || '';
      var biz  = { name: name, desc: desc, city: city, category: cat, createdAt: Date.now(), hasActivity: false };
      var authRaw = localStorage.getItem('geohub_auth_user');
      var authUser = authRaw ? JSON.parse(authRaw) : null;
      if (authUser) {
        var key = 'geohub_business_' + (authUser.uid || authUser.id || 'anon');
        localStorage.setItem(key, JSON.stringify(biz));
      }
      localStorage.setItem('geohub_user_business', JSON.stringify(biz));
    } catch (e) {}
  }

  // Hide account creation section if already logged in
  (function() {
    try {
      var authRaw = localStorage.getItem('geohub_auth_user');
      if (authRaw && JSON.parse(authRaw)) {
        var fields = document.getElementById('accountFormFields');
        var notice = document.getElementById('accountAlreadyIn');
        if (fields) fields.style.display = 'none';
        if (notice) notice.style.display = 'block';
      }
    } catch(e) {}
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
