/* GeoHub — Real Estate Listings
   Collection: realEstateListings
   Fields: title, description, type (rent|buy|commercial), price, currency,
           city, address, rooms, bathrooms, area, floor, totalFloors,
           images[], contactPhone, contactEmail, authorId, createdAt, status, verified
*/
(function () {
  'use strict';

  var _GF = null;
  var allItems = [];
  var filterType = 'all';
  var filterCity = 'all';
  var filterQ    = '';

  var GEORGIAN_CITIES = ['თბილისი','ბათუმი','ქუთაისი','რუსთავი','გორი','ზუგდიდი','ფოთი','ხაშური','სამტრედია','სენაკი','ზესტაფონი','მარნეული','ახალციხე','ოზურგეთი','თელავი','ახმეტა','სიღნაღი','ბოლნისი','გარდაბანი','საგარეჯო','ლაგოდეხი','ყვარელი','ამბროლაური','ონი','ჭიათურა','საჩხერე','ხობი','მარტვილი','ჩოხატაური','ლანჩხუთი','ადიგენი','ასპინძა','ბორჯომი','ახალქალაქი','ნინოწმინდა','დმანისი','თეთრიწყარო','ვანი','ბაღდათი'];

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function fmtPrice(p, cur) {
    if (!p) return '';
    var n = Number(p);
    if (isNaN(n)) return esc(String(p));
    return n.toLocaleString() + ' ' + esc(cur || 'GEL');
  }

  /* ── card HTML ─────────────────────────────────────────────────── */
  function typeBadge(type) {
    var map = { rent:'გაქირავება', buy:'გაყიდვა', commercial:'კომერციული' };
    var colors = {
      rent:'rgba(59,130,246,.2);color:#93c5fd',
      buy:'rgba(16,185,129,.2);color:#6ee7b7',
      commercial:'rgba(245,158,11,.2);color:#fcd34d'
    };
    var label = map[type] || esc(type || '');
    var style = colors[type] || 'rgba(100,116,139,.2);color:#94a3b8';
    return label ? '<span style="padding:3px 9px;border-radius:99px;font-size:.66rem;font-weight:800;text-transform:uppercase;background:'+style+'">'+label+'</span>' : '';
  }

  function listingCard(item) {
    var title = esc(item.title || 'განცხადება');
    var price = fmtPrice(item.price, item.currency);
    var perMonth = item.type === 'rent' ? '/თვე' : '';
    var city = esc(item.city || '');
    var addr = esc(item.address || '');
    var rooms = item.rooms ? item.rooms + ' ოთახი' : '';
    var area  = item.area  ? item.area + ' მ²' : '';
    var floor = (item.floor && item.totalFloors) ? item.floor + '/' + item.totalFloors + ' სართული' : (item.floor ? item.floor + ' სართული' : '');
    var desc  = item.description ? esc(item.description.slice(0, 120)) + (item.description.length > 120 ? '…' : '') : '';
    var img   = (item.images && item.images[0]) ? item.images[0] : (item.imageUrl || '');
    var imgHtml = img
      ? '<div style="width:100%;height:160px;overflow:hidden;border-radius:12px 12px 0 0"><img src="'+esc(img)+'" alt="'+title+'" loading="lazy" style="width:100%;height:100%;object-fit:cover" onerror="this.closest(\'div\').style.display=\'none\'"></div>'
      : '';
    var verBadge = item.verified ? '<span style="background:rgba(16,185,129,.15);color:#6ee7b7;padding:2px 7px;border-radius:99px;font-size:.62rem;font-weight:800"><i class="fas fa-check-circle"></i> Verified</span>' : '';
    var soldBadge = (item.status === 'sold' || item.status === 'rented')
      ? '<span style="background:rgba(239,68,68,.15);color:#fca5a5;padding:2px 7px;border-radius:99px;font-size:.62rem;font-weight:800">'+esc(item.status === 'rented' ? 'გაქირავებულია' : 'გაყიდულია')+'</span>'
      : '';
    var contactBtn = item.contactPhone
      ? '<a href="tel:'+esc(item.contactPhone)+'" class="sv-btn sv-btn-primary" style="flex:1;justify-content:center"><i class="fas fa-phone"></i> დაკავშირება</a>'
      : (item.authorId
          ? '<button class="sv-btn sv-btn-primary re-msg-btn" data-uid="'+esc(item.authorId)+'" data-title="'+title+'" style="flex:1;justify-content:center"><i class="fas fa-comment-dots"></i> შეტყობინება</button>'
          : '');

    return '<div class="sv-card re-card" style="overflow:hidden">'+
      imgHtml+
      '<div class="sv-card-body">'+
        '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px">'+
          typeBadge(item.type)+verBadge+soldBadge+
        '</div>'+
        '<div class="sv-card-title">'+title+'</div>'+
        (price ? '<div style="font-size:1.05rem;font-weight:800;color:var(--gh-green,#10b981);margin-bottom:6px">'+price+esc(perMonth)+'</div>' : '')+
        (city ? '<div class="sv-card-city"><i class="fas fa-map-marker-alt"></i>'+city+(addr?', '+addr:'')+'</div>' : '')+
        '<div style="display:flex;gap:10px;flex-wrap:wrap;font-size:.75rem;color:var(--gh-muted,#9ca3af);margin:6px 0 8px">'+
          (rooms?'<span><i class="fas fa-bed" style="color:var(--gh-green,#10b981)"></i> '+esc(rooms)+'</span>':'')+
          (area ?'<span><i class="fas fa-ruler-combined" style="color:var(--gh-green,#10b981)"></i> '+esc(area)+'</span>':'')+
          (floor?'<span><i class="fas fa-building" style="color:var(--gh-green,#10b981)"></i> '+esc(floor)+'</span>':'')+
        '</div>'+
        (desc ? '<div class="sv-card-desc">'+desc+'</div>' : '')+
        '<div class="sv-card-actions" style="margin-top:auto">'+contactBtn+'</div>'+
      '</div>'+
    '</div>';
  }

  /* ── render ─────────────────────────────────────────────────────── */
  function renderCards(items) {
    var list = document.getElementById('cleanList');
    if (!list) return;
    if (!items || !items.length) {
      var msg = allItems.length > 0
        ? 'ფილტრის შედეგი ცარიელია.'
        : 'განცხადება ჯერ არ არის. პირველი განცხადება ახლავე გამოაქვეყნე!';
      list.innerHTML = '<div class="clean-empty" style="width:100%;min-height:240px"><div>'+
        '<i class="fas fa-home" style="font-size:2rem;color:#374151;display:block;margin-bottom:12px"></i>'+
        '<h3 style="color:#f8fafc;margin:0 0 8px">'+esc(msg)+'</h3></div></div>';
      return;
    }
    list.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">'+
      items.map(listingCard).join('')+'</div>';
    list.querySelectorAll('.re-msg-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        var uid = btn.dataset.uid;
        if (!uid) return;
        if (window.GeoSocial && window.GeoSocial.startConversation) {
          window.GeoSocial.startConversation(uid, function(convId){
            if (convId) window.location.href = 'messages.html?conv='+encodeURIComponent(convId);
          });
        } else {
          window.location.href = 'messages.html';
        }
      });
    });
  }

  /* ── filters ─────────────────────────────────────────────────────── */
  function applyFilters() {
    var q = filterQ.toLowerCase().trim();
    var filtered = allItems.filter(function(item){
      if (filterType !== 'all' && (item.type || '') !== filterType) return false;
      if (filterCity !== 'all' && (item.city || '') !== filterCity) return false;
      if (q) {
        var hay = [item.title, item.description, item.city, item.address].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    renderCards(filtered);
    var el = document.getElementById('stat-total');
    if (el) el.textContent = filtered.length;
  }

  function buildFilters() {
    var catRow = document.getElementById('reCatFilter');
    if (catRow) {
      catRow.innerHTML =
        '<button class="sv-filter-btn active" data-re-type="all">ყველა</button>'+
        '<button class="sv-filter-btn" data-re-type="rent">გაქირავება</button>'+
        '<button class="sv-filter-btn" data-re-type="buy">გაყიდვა</button>'+
        '<button class="sv-filter-btn" data-re-type="commercial">კომერციული</button>';
      catRow.addEventListener('click', function(e){
        var btn = e.target.closest('[data-re-type]');
        if (!btn) return;
        filterType = btn.dataset.reType;
        catRow.querySelectorAll('[data-re-type]').forEach(function(b){ b.classList.toggle('active', b === btn); });
        applyFilters();
      });
    }

    var citySet = {};
    allItems.forEach(function(i){ if (i.city) citySet[i.city] = true; });
    var cities = Object.keys(citySet).sort(function(a,b){ return a.localeCompare(b,'ka'); });
    var cityWrap = document.getElementById('reCityWrap');
    var citySelect = document.getElementById('reCityFilter');
    if (cityWrap && citySelect && cities.length > 1) {
      citySelect.innerHTML = '<option value="all">ყველა ქალაქი</option>' +
        cities.map(function(c){ return '<option value="'+esc(c)+'">'+esc(c)+'</option>'; }).join('');
      citySelect.onchange = function(){ filterCity = citySelect.value; applyFilters(); };
      cityWrap.style.display = '';
    }
  }

  /* ── "Add Listing" modal ─────────────────────────────────────────── */
  function openAddModal(gf) {
    var user = null;
    if (window.GeoFirebaseAuth && window.GeoFirebaseAuth.currentUser) user = window.GeoFirebaseAuth.currentUser;
    if (!user && window.GeoAuth) user = window.GeoAuth.currentUser ? window.GeoAuth.currentUser() : null;
    if (!user) { alert('პირველ რიგში შესვლა გჭირდება.'); return; }

    var cityOpts = GEORGIAN_CITIES.map(function(c){ return '<option>'+esc(c)+'</option>'; }).join('');
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;padding:16px';
    overlay.innerHTML =
      '<div style="background:#111827;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:24px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">'+
          '<h3 style="margin:0;font-size:1.05rem;color:#f8fafc"><i class="fas fa-home" style="color:#10b981"></i> განცხადების დამატება</h3>'+
          '<button id="reCloseModal" style="background:none;border:none;color:#9ca3af;font-size:1.2rem;cursor:pointer;padding:0"><i class="fas fa-times"></i></button>'+
        '</div>'+
        '<div style="display:flex;flex-direction:column;gap:12px">'+
          '<input id="reTitle" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 14px;color:#f8fafc;font-size:.9rem;outline:none;width:100%;box-sizing:border-box" placeholder="სათაური (მაგ: 3-ოთახიანი ბინა ვაკეში)">'+
          '<select id="reType" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 14px;color:#f8fafc;font-size:.9rem;outline:none;width:100%;box-sizing:border-box">'+
            '<option value="rent">გაქირავება</option><option value="buy">გაყიდვა</option><option value="commercial">კომერციული</option>'+
          '</select>'+
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'+
            '<input id="rePrice" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 14px;color:#f8fafc;font-size:.9rem;outline:none;width:100%;box-sizing:border-box" type="number" placeholder="ფასი" min="0">'+
            '<select id="reCurrency" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 14px;color:#f8fafc;font-size:.9rem;outline:none;width:100%;box-sizing:border-box">'+
              '<option value="GEL">GEL ₾</option><option value="USD">USD $</option>'+
            '</select>'+
          '</div>'+
          '<select id="reCity" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 14px;color:#f8fafc;font-size:.9rem;outline:none;width:100%;box-sizing:border-box">'+
            '<option value="">ქალაქი...</option>'+cityOpts+
          '</select>'+
          '<input id="reAddress" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 14px;color:#f8fafc;font-size:.9rem;outline:none;width:100%;box-sizing:border-box" placeholder="მისამართი (სურვილისამებრ)">'+
          '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">'+
            '<input id="reRooms" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 14px;color:#f8fafc;font-size:.9rem;outline:none;width:100%;box-sizing:border-box" type="number" placeholder="ოთახი" min="1">'+
            '<input id="reArea"  style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 14px;color:#f8fafc;font-size:.9rem;outline:none;width:100%;box-sizing:border-box" type="number" placeholder="მ²" min="1">'+
            '<input id="reFloor" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 14px;color:#f8fafc;font-size:.9rem;outline:none;width:100%;box-sizing:border-box" type="number" placeholder="სართული" min="0">'+
          '</div>'+
          '<textarea id="reDesc" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 14px;color:#f8fafc;font-size:.9rem;outline:none;width:100%;box-sizing:border-box;resize:vertical" placeholder="აღწერა..." rows="3"></textarea>'+
          '<input id="rePhone" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 14px;color:#f8fafc;font-size:.9rem;outline:none;width:100%;box-sizing:border-box" placeholder="საკონტაქტო ნომერი (სურვილისამებრ)">'+
          '<input id="reImage" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 14px;color:#f8fafc;font-size:.9rem;outline:none;width:100%;box-sizing:border-box" placeholder="სურათის URL (სურვილისამებრ)">'+
          '<button id="reSubmitBtn" style="background:linear-gradient(135deg,#10b981,#3b82f6);border:none;border-radius:12px;padding:12px;color:#fff;font-size:.9rem;font-weight:700;cursor:pointer;margin-top:4px"><i class="fas fa-paper-plane"></i> გამოქვეყნება</button>'+
        '</div>'+
      '</div>';
    document.body.appendChild(overlay);

    document.getElementById('reCloseModal').onclick = function(){ overlay.remove(); };
    overlay.addEventListener('click', function(e){ if (e.target === overlay) overlay.remove(); });

    document.getElementById('reSubmitBtn').onclick = function(){
      var title = (document.getElementById('reTitle').value || '').trim();
      var type  = document.getElementById('reType').value;
      var price = Number(document.getElementById('rePrice').value) || 0;
      var cur   = document.getElementById('reCurrency').value;
      var city  = document.getElementById('reCity').value;
      var addr  = (document.getElementById('reAddress').value || '').trim();
      var rooms = Number(document.getElementById('reRooms').value) || null;
      var area  = Number(document.getElementById('reArea').value) || null;
      var floor = Number(document.getElementById('reFloor').value) || null;
      var desc  = (document.getElementById('reDesc').value || '').trim();
      var phone = (document.getElementById('rePhone').value || '').trim();
      var img   = (document.getElementById('reImage').value || '').trim();
      if (!title) { alert('სათაური სავალდებულოა.'); return; }
      if (!city)  { alert('ქალაქი სავალდებულოა.'); return; }
      var btn = document.getElementById('reSubmitBtn');
      btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> იგზავნება...';
      var payload = {
        title: title, type: type, price: price || null, currency: cur,
        city: city, address: addr || null, rooms: rooms, area: area, floor: floor,
        description: desc || null, contactPhone: phone || null,
        images: img ? [img] : [], status: 'active', verified: false,
        authorId: user.uid, authorName: (user.displayName || user.email || ''),
        createdAt: gf.fs.serverTimestamp()
      };
      gf.fs.addDoc(gf.fs.collection(gf.db, 'realEstateListings'), payload)
        .then(function(docRef){
          overlay.remove();
          allItems.unshift(Object.assign({ id: docRef.id }, payload, { createdAt: new Date() }));
          applyFilters();
          var el = document.getElementById('stat-total');
          if (el) el.textContent = allItems.length;
        })
        .catch(function(err){
          alert('შეცდომა: ' + err.message);
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-paper-plane"></i> გამოქვეყნება';
        });
    };
  }

  /* ── load data ───────────────────────────────────────────────────── */
  function loadData(gf) {
    var list = document.getElementById('cleanList');
    if (list) list.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:200px"><i class="fas fa-circle-notch fa-spin" style="font-size:1.5rem;color:#10b981"></i></div>';

    var q = gf.fs.query(
      gf.fs.collection(gf.db, 'realEstateListings'),
      gf.fs.where('status', '!=', 'deleted'),
      gf.fs.orderBy('status'),
      gf.fs.orderBy('createdAt', 'desc'),
      gf.fs.limit(100)
    );
    gf.fs.getDocs(q).then(function(snap){
      allItems = [];
      snap.forEach(function(d){ allItems.push(Object.assign({ id: d.id }, d.data())); });
      var el = document.getElementById('stat-total');
      if (el) el.textContent = allItems.length;
      buildFilters();
      applyFilters();
    }).catch(function(err){
      console.error('[RealEstate] load failed', err.message);
      renderCards([]);
    });
  }

  /* ── init ───────────────────────────────────────────────────────── */
  function init() {
    var searchInput = document.querySelector('.clean-search input');

    if (searchInput) {
      var timer = null;
      searchInput.addEventListener('input', function(){
        clearTimeout(timer);
        filterQ = searchInput.value;
        timer = setTimeout(applyFilters, 280);
      });
    }

    function doLoad() {
      _GF = window.GeoFirebase;
      if (!_GF || !_GF.db) return;

      var searchBtn = document.querySelector('.clean-search button');
      if (searchBtn) {
        searchBtn.innerHTML = '<i class="fas fa-plus"></i> განცხადება';
        searchBtn.onclick = function(e){ e.preventDefault(); openAddModal(_GF); };
      }

      loadData(_GF);
    }

    if (window.GeoFirebase && window.GeoFirebase.db) { doLoad(); }
    else { window.addEventListener('GeoFirebaseReady', doLoad, { once: true }); }
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
}());
