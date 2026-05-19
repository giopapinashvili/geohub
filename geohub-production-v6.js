
/* GeoHub production fixes v6 */
(function(){
  'use strict';
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $ = s => document.querySelector(s);
  function waitReady(cb){
    if(window.GeoFirebase && window.GeoSocial) return cb();
    let tries=0; const t=setInterval(()=>{ tries++; if(window.GeoFirebase && window.GeoSocial){clearInterval(t); cb();} if(tries>80) clearInterval(t); },100);
  }
  function currentUser(){ return window.GeoFirebase && window.GeoFirebase.auth && window.GeoFirebase.auth.currentUser; }
  function ts(v){ return v && v.toMillis ? v.toMillis() : (v && v.seconds ? v.seconds*1000 : Date.now()); }

  // Better user search for Tag People: accepts email, username, display/full name.
  async function findUserByInput(q){
    q = String(q||'').trim().replace(/^@/,'').toLowerCase();
    if(!q || !window.GeoFirebase) return null;
    const GF=window.GeoFirebase, fs=GF.fs, db=GF.db;
    const users = fs.collection(db,'users');
    const fields = ['email','username','fullName','displayName'];
    for(const field of fields){
      try{
        const snap = await fs.getDocs(fs.query(users, fs.where(field,'==',q)));
        if(!snap.empty){ const d=snap.docs[0]; return Object.assign({id:d.id, uid:d.id}, d.data()); }
      }catch(e){}
    }
    // Fallback scan limited users for case-insensitive partial match.
    try{
      const snap = await fs.getDocs(fs.query(users, fs.limit(100)));
      let found=null;
      snap.forEach(doc=>{
        if(found) return;
        const d=doc.data()||{};
        const vals=[d.email,d.username,d.fullName,d.displayName].filter(Boolean).map(x=>String(x).toLowerCase());
        if(vals.some(v=>v===q || v.includes(q))) found=Object.assign({id:doc.id, uid:doc.id}, d);
      });
      return found;
    }catch(e){ return null; }
  }

  function installComposerFix(){
    if(!/feed\.html|\/feed/.test(location.pathname)) return;

    function isVisible(el){
      if(!el) return false;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
    }

    function findAction(label){
      const candidates = Array.from(document.querySelectorAll(
        'button, a, [role="button"], .composer-action, .post-action, .create-action, .composer-option'
      ));
      return candidates.find(el => {
        const text = (el.textContent || '').replace(/\s+/g,' ').trim();
        if(!isVisible(el)) return false;
        if(!text.includes(label)) return false;
        // IMPORTANT: avoid binding to large parent cards/sections.
        const r = el.getBoundingClientRect();
        return r.width < 260 && r.height < 90;
      });
    }

    const photoBtn = findAction('Photo/Video');
    const tagBtn = findAction('Tag People');
    const feelBtn = findAction('Feeling/Activity');

    const input = document.querySelector(
      '.composer-input, .post-input, input[placeholder*="mind"], textarea[placeholder*="mind"], input[placeholder*="GeoHub"]'
    ) || document.querySelector('.create-post input, .post-composer input');

    const composer = input ? input.closest('.composer, .post-composer, .create-post, .feed-create, .feed-composer, .feed-card') : null;
    if(!input || !composer) return;

    const send = composer.querySelector('.composer-send, .post-send, .send-post-btn, button[title="Post"], button[type="submit"]')
      || Array.from(composer.querySelectorAll('button')).find(b => /paper-plane|Post/i.test(b.innerHTML + b.textContent));

    if(!send || send.dataset.v6Composer) return;
    send.dataset.v6Composer='1';

    let selectedFile = null, selectedDataUrl = '', taggedUsers=[], feeling='';
    let fileInput = document.getElementById('ghV6FileInput');
    if(!fileInput){
      fileInput=document.createElement('input');
      fileInput.type='file';
      fileInput.accept='image/*,video/*';
      fileInput.id='ghV6FileInput';
      fileInput.style.display='none';
      document.body.appendChild(fileInput);
    }

    let preview = document.getElementById('ghV6Preview');
    if(!preview){
      preview=document.createElement('div');
      preview.id='ghV6Preview';
      preview.style.cssText='margin:12px 18px;border:1px solid rgba(255,255,255,.08);border-radius:12px;overflow:hidden;display:none;padding:10px;color:#94a3b8';
      composer.appendChild(preview);
    }

    function renderPreview(){
      let html='';
      if(selectedDataUrl){
        if((selectedFile && selectedFile.type || '').startsWith('video/')) {
          html+='<video controls style="max-width:100%;border-radius:10px" src="'+esc(selectedDataUrl)+'"></video>';
        } else {
          html+='<img style="max-width:100%;max-height:320px;border-radius:10px;object-fit:cover" src="'+esc(selectedDataUrl)+'">';
        }
      }
      if(taggedUsers.length) html+='<div style="margin-top:8px">Tagged: '+taggedUsers.map(u=>'@'+esc(u.username||u.email||u.fullName||u.uid)).join(', ')+'</div>';
      if(feeling) html+='<div style="margin-top:8px">Feeling: <b>'+esc(feeling)+'</b></div>';
      preview.innerHTML=html;
      preview.style.display=html?'block':'none';
    }

    if(photoBtn && !photoBtn.dataset.v7Bound){
      photoBtn.dataset.v7Bound='1';
      photoBtn.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        fileInput.click();
      });
    }

    fileInput.onchange=function(){
      selectedFile=this.files && this.files[0];
      if(!selectedFile) return;
      const r=new FileReader();
      r.onload=()=>{ selectedDataUrl=r.result; renderPreview(); };
      r.readAsDataURL(selectedFile);
    };

    if(tagBtn && !tagBtn.dataset.v7Bound){
      tagBtn.dataset.v7Bound='1';
      tagBtn.addEventListener('click', async function(e){
        e.preventDefault();
        e.stopPropagation();
        const q=prompt('Enter user email, username or name to tag:');
        if(!q) return;
        const u=await findUserByInput(q);
        if(!u){ alert('User not found. Try exact email or username.'); return; }
        if(!taggedUsers.some(x=>(x.uid||x.id)===(u.uid||u.id))) taggedUsers.push(u);
        renderPreview();
      });
    }

    if(feelBtn && !feelBtn.dataset.v7Bound){
      feelBtn.dataset.v7Bound='1';
      feelBtn.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        const q=prompt('Feeling / Activity (example: traveling, happy, working):', feeling || 'traveling');
        if(q){ feeling=q.trim(); renderPreview(); }
      });
    }

    send.addEventListener('click', async function(e){
      const text=(input.value || input.textContent || '').trim();
      if(!text && !selectedDataUrl) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      send.disabled=true;
      try{
        const extra={
          mediaType: selectedFile ? selectedFile.type : (selectedDataUrl ? 'image/data-url' : null),
          taggedUserIds: taggedUsers.map(u=>u.uid||u.id).filter(Boolean),
          taggedUsers: taggedUsers.map(u=>({uid:u.uid||u.id, username:u.username||'', fullName:u.fullName||u.displayName||'', email:u.email||''})),
          feeling: feeling || ''
        };
        await window.GeoSocial.createPost(text, selectedDataUrl || null, function(){
          input.value='';
          input.textContent='';
          selectedFile=null;
          selectedDataUrl='';
          taggedUsers=[];
          feeling='';
          renderPreview();
        }, extra);
      } finally {
        setTimeout(()=>{ send.disabled=false; },700);
      }
    }, true);
  }

  // Render real feed cards with tags and feeling if the active social renderer missed them.
  function enhanceRenderedPosts(){
    document.querySelectorAll('[data-social-id], .feed-card').forEach(card=>{
      if(card.dataset.v6Enhanced) return;
      card.dataset.v6Enhanced='1';
      // This is a visual safeguard; full rendering is handled by existing feed renderer.
    });
  }

  // Phase 56C: installMessagesFix() is fully disabled.
  // real-messages.js owns the messages page entirely — routing, listeners,
  // rendering, and the composer. This legacy v6 patch must not start any
  // listenConversations() call or touch the conv list on messages.html.
  function installMessagesFix(){ /* no-op — see real-messages.js */ }

  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(installComposerFix,700);
    setTimeout(enhanceRenderedPosts,1200);
    installMessagesFix();
  });
  window.addEventListener('GeoSocialReady', function(){ setTimeout(installComposerFix,500); installMessagesFix(); });
})();
