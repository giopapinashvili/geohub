(function(){
'use strict';

var _all = [];
var _activeType = 'all';
var _activeCat  = 'all';
var _activeCity = 'all';

var TYPE_LABEL = {
  'full-time'  : 'სრული განაკვეთი',
  'part-time'  : 'ნახევარი განაკვეთი',
  'remote'     : 'Remote',
  'freelance'  : 'Freelance'
};

var TYPE_CLASS = {
  'full-time'  : 'jb-type-full',
  'part-time'  : 'jb-type-part',
  'remote'     : 'jb-type-remote',
  'freelance'  : 'jb-type-freelance'
};

var CAT_LABEL = {
  'IT'          : 'IT',
  'Marketing'   : 'მარკეტინგი',
  'Design'      : 'დიზაინი',
  'Sales'       : 'გაყიდვები',
  'Finance'     : 'ფინანსები',
  'Legal'       : 'იურიდიული',
  'Healthcare'  : 'მედიცინა',
  'Education'   : 'განათლება',
  'Hospitality' : 'სტუმართმასპინძლობა',
  'Construction': 'მშენებლობა',
  'Other'       : 'სხვა'
};

var GEORGIAN_CITIES = [
  'თბილისი','ბათუმი','ქუთაისი','რუსთავი','გორი','ზუგდიდი','ფოთი','ხაშური',
  'სამტრედია','სენაკი','ზესტაფონი','მარნეული','თელავი','ახალციხე','ოზურგეთი',
  'ახმეტა','სიღნაღი','ლაგოდეხი','ბოლნისი','გარდაბანი','ქობულეთი','ხობი',
  'ხონი','ამბროლაური','ონი','ლენტეხი','მესტია','ჩხოროწყუ','წალენჯიხა',
  'ქარელი','კასპი','მცხეთა','დუშეთი','ჩოხატაური','ლანჩხუთი','ოზურგეთი',
  'ადიგენი','ასპინძა','ახალქალაქი','ბორჯომი','ნინოწმინდა','წალკა'
];

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function timeAgo(ts){
  if(!ts) return '';
  var d = ts.toDate ? ts.toDate() : new Date(ts);
  var diff = Math.floor((Date.now()-d.getTime())/1000);
  if(diff<60) return 'ახლახანს';
  if(diff<3600) return Math.floor(diff/60)+' წთ წინ';
  if(diff<86400) return Math.floor(diff/3600)+' სთ წინ';
  return Math.floor(diff/86400)+' დღის წინ';
}

function logoHtml(item){
  if(item.logoUrl){
    return '<img src="'+esc(item.logoUrl)+'" alt="'+esc(item.company)+'" loading="lazy">';
  }
  var letter = (item.company||item.title||'?').charAt(0).toUpperCase();
  return esc(letter);
}

function jobCard(item){
  var typeClass = TYPE_CLASS[item.type] || 'jb-type-full';
  var typeLabel = TYPE_LABEL[item.type] || esc(item.type||'');
  var catLabel  = CAT_LABEL[item.category] || esc(item.category||'');
  var isClosed  = item.status === 'closed';

  var salaryHtml = '';
  if(item.salary){
    salaryHtml = '<span><i class="fas fa-money-bill-wave"></i>'+esc(item.salary)+'</span>';
  }

  var applyHtml = '';
  if(isClosed){
    applyHtml = '<span class="jb-closed-badge"><i class="fas fa-lock"></i> დახურული</span>';
  } else if(item.contactEmail){
    applyHtml = '<a class="jb-apply-btn" href="mailto:'+esc(item.contactEmail)+'" onclick="event.stopPropagation()"><i class="fas fa-paper-plane"></i> გამოგზავნე CV</a>';
  } else if(item.contactPhone){
    applyHtml = '<a class="jb-apply-btn" href="tel:'+esc(item.contactPhone)+'" onclick="event.stopPropagation()"><i class="fas fa-phone"></i> დარეკე</a>';
  } else if(item.authorId && window.GeoSocial && window.GeoSocial.startConversation){
    applyHtml = '<button class="jb-apply-btn" data-author="'+esc(item.authorId)+'"><i class="fas fa-comment"></i> შეტყობინება</button>';
  }

  return '<div class="jb-card">'
    +'<div class="jb-card-top">'
      +'<div class="jb-card-logo">'+logoHtml(item)+'</div>'
      +'<div class="jb-card-info">'
        +'<div class="jb-card-title">'+esc(item.title)+'</div>'
        +'<div class="jb-card-company"><i class="fas fa-building"></i>'+esc(item.company||'კომპანია')+(item.city?'&nbsp;·&nbsp;'+esc(item.city):'')+'</div>'
      +'</div>'
    +'</div>'
    +'<div class="jb-card-badges">'
      +'<span class="jb-badge-type '+typeClass+'">'+typeLabel+'</span>'
      +(catLabel?'<span class="jb-badge-cat">'+catLabel+'</span>':'')
    +'</div>'
    +'<div class="jb-card-desc">'+esc(item.description||'')+'</div>'
    +'<div class="jb-card-footer">'
      +'<div class="jb-card-meta">'
        +(item.city?'<span><i class="fas fa-map-marker-alt"></i>'+esc(item.city)+'</span>':'')
        +salaryHtml
        +'<span><i class="far fa-clock"></i>'+timeAgo(item.createdAt)+'</span>'
      +'</div>'
      +applyHtml
    +'</div>'
  +'</div>';
}

function applyFilters(){
  var q = (document.getElementById('jbSearchInput')||{}).value || '';
  q = q.toLowerCase().trim();

  var filtered = _all.filter(function(item){
    if(_activeType !== 'all' && item.type !== _activeType) return false;
    if(_activeCat  !== 'all' && item.category !== _activeCat) return false;
    if(_activeCity !== 'all' && item.city !== _activeCity) return false;
    if(q){
      var hay = ((item.title||'')+' '+(item.company||'')+' '+(item.city||'')+' '+(item.description||'')).toLowerCase();
      if(hay.indexOf(q)<0) return false;
    }
    return true;
  });

  var listEl = document.getElementById('jbList');
  if(!listEl) return;

  if(!filtered.length){
    listEl.innerHTML = '<div class="jb-empty"><div><i class="fas fa-search"></i><h3>ვაკანსია ვერ მოიძებნა</h3><p>სცადე სხვა ფილტრი ან საძიებო სიტყვა</p></div></div>';
    return;
  }
  listEl.innerHTML = filtered.map(jobCard).join('');

  listEl.querySelectorAll('[data-author]').forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      var uid = btn.getAttribute('data-author');
      if(window.GeoSocial && window.GeoSocial.startConversation) window.GeoSocial.startConversation(uid);
    });
  });
}

function buildCityDropdown(){
  var cities = [];
  _all.forEach(function(item){ if(item.city && cities.indexOf(item.city)<0) cities.push(item.city); });
  cities.sort();

  var cityFilter = document.getElementById('jbCityFilter');
  var cityLabel  = document.getElementById('jbCityLabel');
  if(!cityFilter) return;

  if(!cities.length){ cityFilter.style.display='none'; if(cityLabel) cityLabel.style.display='none'; return; }
  cityFilter.style.display='';
  if(cityLabel) cityLabel.style.display='';

  cityFilter.innerHTML = '<option value="all">ყველა ქალაქი</option>';
  cities.forEach(function(c){
    cityFilter.innerHTML += '<option value="'+esc(c)+'">'+esc(c)+'</option>';
  });
  cityFilter.addEventListener('change', function(){
    _activeCity = this.value;
    applyFilters();
  });
}

function wireFilters(){
  document.querySelectorAll('#jbTypeFilter .jb-pill').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('#jbTypeFilter .jb-pill').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      _activeType = btn.getAttribute('data-jb-type');
      applyFilters();
    });
  });

  document.querySelectorAll('#jbCatFilter .jb-pill').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('#jbCatFilter .jb-pill').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      _activeCat = btn.getAttribute('data-jb-cat');
      applyFilters();
    });
  });

  var searchInput = document.getElementById('jbSearchInput');
  if(searchInput){
    var timer;
    searchInput.addEventListener('input', function(){ clearTimeout(timer); timer = setTimeout(applyFilters, 250); });
  }
}

function openPostModal(gf){
  var fs = gf.fs, db = gf.db;
  var user = (window.GeoFirebaseAuth && window.GeoFirebaseAuth.currentUser)
    || (window.GeoAuth && typeof window.GeoAuth.currentUser === 'function' && window.GeoAuth.currentUser());

  if(!user){
    alert('ვაკანსიის განთავსებისთვის გთხოვთ გაიაროთ ავტორიზაცია.');
    return;
  }

  if(document.getElementById('jbPostModal')) return;

  var cityOptions = GEORGIAN_CITIES.map(function(c){
    return '<option value="'+esc(c)+'">'+esc(c)+'</option>';
  }).join('');

  var modal = document.createElement('div');
  modal.id = 'jbPostModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto';
  modal.innerHTML = [
    '<div style="background:#0f1520;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:28px;width:100%;max-width:560px;max-height:90vh;overflow-y:auto">',
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">',
        '<h2 style="margin:0;font-size:1.2rem">ვაკანსიის განთავსება</h2>',
        '<button id="jbModalClose" style="background:rgba(255,255,255,.08);border:none;border-radius:50%;width:32px;height:32px;color:#9ca3af;cursor:pointer;font-size:1.1rem">×</button>',
      '</div>',
      '<div style="display:flex;flex-direction:column;gap:14px">',
        inp('jbFTitle','სათაური (ვაკანსია)','text','სად: პროგრამისტი, დიზაინერი…'),
        inp('jbFCompany','კომპანია','text','კომპანიის სახელი'),
        sel('jbFCategory','კატეგორია','IT Marketing Design Sales Finance Legal Healthcare Education Hospitality Construction Other'.split(' '), CAT_LABEL),
        sel2('jbFType','სამუშაოს ტიპი',['full-time','part-time','remote','freelance'], TYPE_LABEL),
        sel('jbFCity','ქალაქი', GEORGIAN_CITIES, null),
        inp('jbFSalary','ანაზღაურება','text','მაგ: 2000–3000 ₾ ან "შეთანხმებით"'),
        inp('jbFEmail','საკონტაქტო Email','email',''),
        inp('jbFPhone','საკონტაქტო ტელეფონი','tel',''),
        inp('jbFLogo','კომპანიის ლოგოს URL (სურვილისამებრ)','url',''),
        '<div><label style="font-size:.8rem;color:#9ca3af;display:block;margin-bottom:4px">აღწერა</label><textarea id="jbFDesc" rows="4" placeholder="ვაკანსიის დეტალური აღწერა…" style="width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#f0f4ff;border-radius:10px;padding:10px;font-size:.88rem;outline:none;resize:vertical;box-sizing:border-box"></textarea></div>',
        '<div><label style="font-size:.8rem;color:#9ca3af;display:block;margin-bottom:4px">მოთხოვნები (სურვილისამებრ)</label><textarea id="jbFReq" rows="3" placeholder="გამოცდილება, უნარ-ჩვევები…" style="width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#f0f4ff;border-radius:10px;padding:10px;font-size:.88rem;outline:none;resize:vertical;box-sizing:border-box"></textarea></div>',
        '<button id="jbSubmitBtn" style="background:linear-gradient(135deg,#10b981,#3b82f6);border:none;border-radius:12px;padding:13px;color:#fff;font-weight:800;font-size:.9rem;cursor:pointer;margin-top:4px">განათავსე ვაკანსია</button>',
      '</div>',
    '</div>'
  ].join('');

  document.body.appendChild(modal);

  modal.addEventListener('click', function(e){ if(e.target===modal) closeModal(); });
  document.getElementById('jbModalClose').addEventListener('click', closeModal);

  document.getElementById('jbSubmitBtn').addEventListener('click', function(){
    var title   = (document.getElementById('jbFTitle')||{}).value.trim();
    var company = (document.getElementById('jbFCompany')||{}).value.trim();
    var cat     = (document.getElementById('jbFCategory')||{}).value;
    var type    = (document.getElementById('jbFType')||{}).value;
    var city    = (document.getElementById('jbFCity')||{}).value;
    var salary  = (document.getElementById('jbFSalary')||{}).value.trim();
    var email   = (document.getElementById('jbFEmail')||{}).value.trim();
    var phone   = (document.getElementById('jbFPhone')||{}).value.trim();
    var logo    = (document.getElementById('jbFLogo')||{}).value.trim();
    var desc    = (document.getElementById('jbFDesc')||{}).value.trim();
    var req     = (document.getElementById('jbFReq')||{}).value.trim();

    if(!title){ alert('გთხოვთ შეიყვანეთ ვაკანსიის სათაური.'); return; }
    if(!company){ alert('გთხოვთ შეიყვანეთ კომპანიის სახელი.'); return; }
    if(!desc){ alert('გთხოვთ შეიყვანეთ ვაკანსიის აღწერა.'); return; }
    if(!email && !phone){ alert('გთხოვთ შეიყვანეთ საკონტაქტო Email ან ტელეფონი.'); return; }

    var btn = document.getElementById('jbSubmitBtn');
    btn.disabled = true; btn.textContent = '⏳ ინახება…';

    var doc = {
      title: title, company: company, category: cat, type: type, city: city,
      salary: salary, contactEmail: email, contactPhone: phone, logoUrl: logo,
      description: desc, requirements: req, authorId: user.uid,
      status: 'active', createdAt: fs.serverTimestamp()
    };

    fs.addDoc(fs.collection(db,'jobListings'), doc).then(function(ref){
      closeModal();
      var newItem = Object.assign({id: ref.id}, doc);
      _all.unshift(newItem);
      document.getElementById('jbTotal').textContent = _all.length;
      var remotes = _all.filter(function(x){ return x.type==='remote'; }).length;
      document.getElementById('jbRemoteCount').textContent = remotes;
      buildCityDropdown();
      applyFilters();
    }).catch(function(err){
      console.error(err);
      alert('შეცდომა: ' + err.message);
      btn.disabled = false; btn.textContent = 'განათავსე ვაკანსია';
    });
  });

  function closeModal(){
    var m = document.getElementById('jbPostModal');
    if(m) m.remove();
  }
}

function inp(id, label, type, placeholder){
  return '<div><label style="font-size:.8rem;color:#9ca3af;display:block;margin-bottom:4px">'+label+'</label>'
    +'<input id="'+id+'" type="'+type+'" placeholder="'+placeholder+'" style="width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#f0f4ff;border-radius:10px;padding:10px 12px;font-size:.88rem;outline:none;box-sizing:border-box"></div>';
}

function sel(id, label, options, labelMap){
  var opts = options.map(function(v){
    var l = labelMap ? (labelMap[v]||v) : v;
    return '<option value="'+esc(v)+'">'+esc(l)+'</option>';
  }).join('');
  return '<div><label style="font-size:.8rem;color:#9ca3af;display:block;margin-bottom:4px">'+label+'</label>'
    +'<select id="'+id+'" style="width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#f0f4ff;border-radius:10px;padding:10px 12px;font-size:.88rem;outline:none;box-sizing:border-box">'+opts+'</select></div>';
}

function sel2(id, label, options, labelMap){
  return sel(id, label, options, labelMap);
}

function loadData(gf){
  var fs = gf.fs, db = gf.db;
  var q = fs.query(
    fs.collection(db, 'jobListings'),
    fs.where('status','!=','deleted'),
    fs.orderBy('status'),
    fs.orderBy('createdAt','desc'),
    fs.limit(80)
  );

  fs.getDocs(q).then(function(snap){
    _all = [];
    snap.forEach(function(doc){
      _all.push(Object.assign({id: doc.id}, doc.data()));
    });

    document.getElementById('jbTotal').textContent = _all.length;
    var remotes = _all.filter(function(x){ return x.type==='remote'; }).length;
    document.getElementById('jbRemoteCount').textContent = remotes;

    buildCityDropdown();
    applyFilters();
  }).catch(function(err){
    console.error('jobs loadData error', err);
    var listEl = document.getElementById('jbList');
    if(listEl) listEl.innerHTML = '<div class="jb-empty"><div><i class="fas fa-exclamation-triangle"></i><h3>ჩატვირთვის შეცდომა</h3><p>გვერდი განაახლე და კვლავ სცადე.</p></div></div>';
  });
}

function init(){
  wireFilters();

  var postBtn = document.getElementById('jbPostBtn');
  if(postBtn){
    postBtn.addEventListener('click', function(){
      waitGF(function(gf){ openPostModal(gf); });
    });
  }

  waitGF(loadData);
}

function waitGF(cb){
  if(window.GeoFirebase && window.GeoFirebase.db && window.GeoFirebase.fs){
    cb(window.GeoFirebase);
  } else {
    var attempts = 0;
    var t = setInterval(function(){
      attempts++;
      if(window.GeoFirebase && window.GeoFirebase.db && window.GeoFirebase.fs){
        clearInterval(t);
        cb(window.GeoFirebase);
      } else if(attempts > 40){
        clearInterval(t);
        var listEl = document.getElementById('jbList');
        if(listEl) listEl.innerHTML = '<div class="jb-empty"><div><i class="fas fa-wifi"></i><h3>Firebase ვერ ჩაიტვირთა</h3><p>გვერდი განაახლე.</p></div></div>';
      }
    }, 250);
  }
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
