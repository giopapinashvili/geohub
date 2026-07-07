(function () {
  'use strict';

  function fb()  { return window.GeoFirebase || null; }
  function fs()  { return fb() && fb().fs   ? fb().fs   : null; }
  function db()  { return fb() && fb().db   ? fb().db   : null; }
  function auth(){ return fb() && fb().auth ? fb().auth : null; }
  function authUser(){ return auth() && auth().currentUser ? auth().currentUser : null; }

  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function fmtNum(n){ n=Number(n)||0; if(n>=1000000) return (n/1000000).toFixed(1)+'M'; if(n>=1000) return (n/1000).toFixed(1)+'K'; return String(n); }
  function timeAgo(ts){ if(!ts) return ''; var ms=ts.toMillis?ts.toMillis():ts; var s=Math.floor((Date.now()-ms)/1000); if(s<60) return 'ახლახანს'; if(s<3600) return Math.floor(s/60)+' წ. წინ'; if(s<86400) return Math.floor(s/3600)+' სთ. წინ'; return Math.floor(s/86400)+' დ. წინ'; }

  var CHANNEL_ID = new URLSearchParams(location.search).get('id');
  var _ch = null;        /* current channel data */
  var _activeTab = 'home';
  var _allVideos = null; /* cached after first load */
  var _manageMode = false;

  /* ─────────────────────────────── Boot ─────────────────── */
  function boot(){
    if(!document.getElementById('channelPage')) return;
    if(fs()&&db()) loadChannel();
    else window.addEventListener('GeoFirebaseReady', loadChannel, {once:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
  else boot();

  /* ─────────────────────────── Load channel ─────────────── */
  function loadChannel(){
    if(!CHANNEL_ID){ showError('Channel ID არ არის'); return; }
    if(!fs()||!db()){ window.addEventListener('GeoFirebaseReady',loadChannel,{once:true}); return; }
    fs().getDoc(fs().doc(db(),'channels',CHANNEL_ID))
      .then(function(snap){
        if(!snap.exists()){ showError('Channel ვერ მოიძებნა'); return; }
        _ch = Object.assign({_id:snap.id}, snap.data());
        renderShell(_ch);
      })
      .catch(function(e){ showError(e.message); });
  }

  /* ─────────────────────────── Shell render ──────────────── */
  function renderShell(ch){
    document.title = esc(ch.name)+' — GeoHub';
    var page=document.getElementById('channelPage');
    if(!page) return;

    page.innerHTML =
      /* Banner */
      '<div class="ch-banner" id="chBannerWrap">' +
        (ch.banner
          ? '<img class="ch-banner-img" src="'+esc(ch.banner)+'" alt="" onerror="this.style.display=\'none\'">'
          : '<div class="ch-banner-empty" id="chBannerEmpty"></div>') +
      '</div>' +

      /* Meta row */
      '<div class="ch-meta">' +
        '<div class="ch-avatar-wrap">' +
          (ch.avatar ? '<img class="ch-avatar" src="'+esc(ch.avatar)+'" alt="">' : '<div class="ch-avatar-placeholder"><i class="fas fa-tv"></i></div>') +
        '</div>' +
        '<div class="ch-info">' +
          '<h1 class="ch-name">'+esc(ch.name||'Channel')+'</h1>' +
          '<div class="ch-stats">' +
            '<span id="chSubCount"><i class="fas fa-users"></i> '+fmtNum(ch.subscriberCount)+' გამომწერი</span>' +
            ' &middot; <span id="chVidCount">'+fmtNum(ch.videoCount)+' ვიდეო</span>' +
            (ch.customUrl?' &middot; <span>'+esc(ch.customUrl)+'</span>':'') +
          '</div>' +
          (ch.description ? '<p class="ch-description" id="chDesc">'+esc(ch.description.slice(0,200))+(ch.description.length>200?'…':'')+'</p>' : '') +
          (ch.youtubeUrl ? '<a class="ch-yt-link" href="'+esc(ch.youtubeUrl)+'" target="_blank" rel="noopener"><i class="fab fa-youtube"></i> YouTube-ზე ნახვა</a>' : '') +
        '</div>' +
        '<div class="ch-actions" id="chActions">' +
          '<button class="ch-sub-btn" id="chSubBtn"><i class="fas fa-plus"></i> გამოწერა</button>' +
        '</div>' +
      '</div>' +

      /* Owner bar */
      '<div id="chOwnerBar" style="display:none" class="ch-owner-bar">' +
        '<span class="ch-owner-label"><i class="fas fa-shield-halved"></i> ჩემი არხი</span>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button class="vid-btn ghost ch-owner-btn" id="chEditBtn"><i class="fas fa-pen"></i> რედაქტირება</button>' +
          '<button class="vid-btn ghost ch-owner-btn" id="chManageBtn"><i class="fas fa-sliders"></i> ვიდეოების მართვა</button>' +
          '<button class="vid-btn ghost ch-owner-btn" id="chImportBtn" style="color:#3b82f6;border-color:rgba(59,130,246,.3)"><i class="fab fa-youtube"></i> Re-Import</button>' +
          '<button class="vid-btn ghost ch-owner-btn" id="chDeleteAllVideosBtn" style="color:#f59e0b;border-color:rgba(245,158,11,.3)"><i class="fas fa-trash"></i> ყველა ვიდეო</button>' +
          '<button class="vid-btn ghost ch-owner-btn" id="chDeleteChannelBtn" style="color:#ef4444;border-color:rgba(239,68,68,.3)"><i class="fas fa-ban"></i> არხის წაშლა</button>' +
        '</div>' +
      '</div>' +

      /* Tab nav */
      (function(){ var _t=typeof GHt==='function'?GHt:function(k){return k;};
      return '<nav class="ch-tabs" id="chTabs">' +
        '<button class="ch-tab active" data-tab="home"><i class="fas fa-house"></i> '+_t('ch_home')+'</button>' +
        '<button class="ch-tab" data-tab="videos"><i class="fas fa-film"></i> '+_t('ch_videos')+'</button>' +
        '<button class="ch-tab" data-tab="shorts"><i class="fas fa-bolt"></i> '+_t('ch_shorts')+'</button>' +
        '<button class="ch-tab" data-tab="playlists"><i class="fas fa-list"></i> '+_t('ch_playlists')+'</button>' +
        '<button class="ch-tab" data-tab="posts"><i class="fas fa-newspaper"></i> '+_t('ch_posts')+'</button>' +
      '</nav>'; })() +

      /* Tab content area */
      '<div id="chTabContent" class="ch-tab-content"></div>';

    initSubBtn(ch);
    initOwnerControls(ch);
    initTabs(ch);
    switchTab('home', ch);
  }

  /* ─────────────────────────── Tabs ──────────────────────── */
  function initTabs(ch){
    document.getElementById('chTabs').addEventListener('click', function(e){
      var btn = e.target.closest('[data-tab]');
      if(!btn) return;
      document.querySelectorAll('.ch-tab').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      switchTab(btn.dataset.tab, ch);
    });
  }

  function switchTab(tab, ch){
    _activeTab = tab;
    var el = document.getElementById('chTabContent');
    if(!el) return;
    el.innerHTML = '<div class="ch-init-loading"><i class="fas fa-spinner fa-spin"></i></div>';
    if(tab==='home')      renderHomeTab(ch, el);
    else if(tab==='videos')    renderVideosTab(ch, el);
    else if(tab==='shorts')    renderShortsTab(ch, el);
    else if(tab==='playlists') renderPlaylistsTab(ch, el);
    else if(tab==='posts')     renderPostsTab(ch, el);
  }

  /* ─────────────────────── Fetch all videos (cached) ─────── */
  function fetchVideos(channelId){
    if(_allVideos) return Promise.resolve(_allVideos);
    if(!fs()||!db()) return Promise.resolve([]);
    return fs().getDocs(fs().query(
      fs().collection(db(),'videos'),
      fs().where('channelId','==',channelId),
      fs().limit(50)
    )).then(function(snap){
      var vids=[];
      snap.forEach(function(d){
        var v=d.data();
        if(v.status==='hidden'||v.status==='removed') return;
        vids.push(Object.assign({id:d.id},v));
      });
      vids.sort(function(a,b){
        var ta=a.createdAt&&a.createdAt.toMillis?a.createdAt.toMillis():0;
        var tb=b.createdAt&&b.createdAt.toMillis?b.createdAt.toMillis():0;
        return tb-ta;
      });
      _allVideos=vids;
      return vids;
    });
  }

  /* ─────────────────────────── Home tab ──────────────────── */
  function renderHomeTab(ch, el){
    fetchVideos(ch._id).then(function(all){
      var regular = all.filter(function(v){ return !v.isShort; });
      var shorts  = all.filter(function(v){ return v.isShort; });
      var countEl = document.getElementById('chVidCount');
      if(countEl) countEl.textContent = fmtNum(all.length) + ' ვიდეო';
      var html = '';

      /* Featured video */
      if(ch.featuredVideoId){
        var fv = all.find(function(v){ return v.id===ch.featuredVideoId; });
        if(fv){
          html += '<div class="ch-featured-section">' +
            '<h2 class="ch-section-title"><i class="fas fa-star"></i> Featured</h2>' +
            renderCard(fv,'featured') +
          '</div>';
        }
      }

      /* Latest uploads */
      if(regular.length){
        var latest = regular.slice(0,8);
        html += '<div class="ch-home-section">' +
          '<div class="ch-section-header">' +
            '<h2 class="ch-section-title"><i class="fas fa-film"></i> '+(typeof GHt==='function'?GHt('ch_latest_videos'):'Latest Videos')+'</h2>' +
            (regular.length>8?'<button class="vid-btn ghost" data-tab-switch="videos" style="font-size:.8rem">ყველა →</button>':'') +
          '</div>' +
          '<div class="vid-tv-row">'+latest.map(function(v){ return renderCard(v,'tv'); }).join('')+'</div>' +
        '</div>';
      }

      /* Shorts row */
      if(shorts.length){
        var topShorts = shorts.slice(0,8);
        html += '<div class="ch-home-section">' +
          '<div class="ch-section-header">' +
            '<h2 class="ch-section-title"><i class="fas fa-bolt"></i> Shorts</h2>' +
            (shorts.length>8?'<button class="vid-btn ghost" data-tab-switch="shorts" style="font-size:.8rem">ყველა →</button>':'') +
          '</div>' +
          '<div class="vid-shorts-strip">'+topShorts.map(function(v){ return renderCard(v,'short'); }).join('')+'</div>' +
        '</div>';
      }

      /* Playlists + Posts preview */
      Promise.all([fetchPlaylists(ch._id), fetchChannelPosts(ch._id)]).then(function(res){
        var pls = res[0], posts = res[1];
        var extra = '';
        if(posts.length){
          extra += '<div class="ch-home-section">' +
            '<div class="ch-section-header">' +
              '<h2 class="ch-section-title"><i class="fas fa-newspaper"></i> Posts</h2>' +
              (posts.length>3?'<button class="vid-btn ghost" data-tab-switch="posts" style="font-size:.8rem">ყველა →</button>':'') +
            '</div>' +
            '<div class="ch-posts-preview">'+posts.slice(0,3).map(function(p){ return renderLocalPostCard(p,ch); }).join('')+'</div>' +
          '</div>';
        }
        if(pls.length){
          extra += '<div class="ch-home-section">' +
            '<div class="ch-section-header">' +
              '<h2 class="ch-section-title"><i class="fas fa-list"></i> Playlists</h2>' +
              (pls.length>4?'<button class="vid-btn ghost" data-tab-switch="playlists" style="font-size:.8rem">ყველა →</button>':'') +
            '</div>' +
            '<div class="vid-tv-row">'+pls.slice(0,4).map(renderPlaylistCard).join('')+'</div>' +
          '</div>';
        }
        el.innerHTML = (html||'<div class="vid-empty"><i class="fas fa-video-slash"></i><h3>ვიდეო არ არის</h3></div>') + extra;
        el.querySelectorAll('[data-tab-switch]').forEach(function(b){
          b.addEventListener('click',function(){ switchTabByName(b.dataset.tabSwitch); });
        });
      });
    });
  }

  function switchTabByName(tab){
    document.querySelectorAll('.ch-tab').forEach(function(b){ b.classList.toggle('active', b.dataset.tab===tab); });
    switchTab(tab, _ch);
  }

  /* ─────────────────────────── Videos tab ────────────────── */
  function renderVideosTab(ch, el){
    fetchVideos(ch._id).then(function(all){
      var vids = all.filter(function(v){ return !v.isShort; });
      var countEl = document.getElementById('chVidCount');
      if(countEl) countEl.textContent = fmtNum(all.length) + ' ვიდეო';
      if(!vids.length){ el.innerHTML='<div class="vid-empty"><i class="fas fa-film"></i><h3>ვიდეო არ არის</h3></div>'; return; }
      el.innerHTML='<div class="vid-grid" id="chVideoGrid">'+vids.map(function(v){ return renderCard(v,'grid'); }).join('')+'</div>';
      if(_manageMode) injectDelBtns(ch);
    });
  }

  /* ─────────────────────────── Shorts tab ────────────────── */
  function renderShortsTab(ch, el){
    fetchVideos(ch._id).then(function(all){
      var shorts = all.filter(function(v){ return v.isShort; });
      if(!shorts.length){ el.innerHTML='<div class="vid-empty"><i class="fas fa-bolt"></i><h3>Shorts არ არის</h3></div>'; return; }
      el.innerHTML='<div class="ch-shorts-grid">'+shorts.map(function(v){ return renderCard(v,'short'); }).join('')+'</div>';
    });
  }

  /* ─────────────────────────── Posts tab ─────────────────── */
  function renderPostsTab(ch, el){
    var isOw = authUser() && authUser().uid === ch.ownerId;
    fetchChannelPosts(ch._id).then(function(posts){
      var ownerBtn = isOw
        ? '<div style="margin-bottom:16px"><button class="vid-btn primary" id="chNewPostBtn"><i class="fas fa-plus"></i> ახალი პოსტი</button></div>'
        : '';
      if(!posts.length){
        el.innerHTML = ownerBtn + '<div class="vid-empty"><i class="fas fa-newspaper"></i><h3>პოსტი არ არის</h3></div>';
      } else {
        el.innerHTML = ownerBtn + '<div class="ch-posts-list">'+posts.map(function(p){ return renderLocalPostCard(p,ch); }).join('')+'</div>';
      }
      var nb = document.getElementById('chNewPostBtn');
      if(nb) nb.onclick = function(){ openNewPostModal(ch); };
      wirePostDelBtns(ch, el);
    });
  }

  function wirePostDelBtns(ch, el){
    el.querySelectorAll('[data-del-post]').forEach(function(b){
      b.onclick = function(e){
        e.preventDefault(); e.stopPropagation();
        var _delPost = b.dataset.delPost;
        window.ghConfirm('პოსტი წაიშლება?', function(){
          b.disabled = true;
          fs().deleteDoc(fs().doc(db(),'channels',ch._id,'posts',_delPost))
            .then(function(){ b.closest('.ch-post-card').remove(); })
            .catch(function(){ b.disabled = false; });
        });
      };
    });
  }

  function renderLocalPostCard(post, ch){
    var isOw = authUser() && authUser().uid === ch.ownerId;
    var ts = timeAgo(post.createdAt);
    return '<div class="ch-post-card">' +
      '<div class="ch-post-header">' +
        '<div class="ch-post-avatar">'+(ch.avatar?'<img src="'+esc(ch.avatar)+'" alt="" loading="lazy">':'<i class="fas fa-tv"></i>')+'</div>' +
        '<div>' +
          '<div class="ch-post-chname">'+esc(ch.name||'Channel')+'</div>' +
          '<div class="ch-post-time">'+ts+'</div>' +
        '</div>' +
        (isOw?'<button class="ch-post-del" data-del-post="'+esc(post._id)+'" title="წაშლა"><i class="fas fa-trash-can"></i></button>':'') +
      '</div>' +
      (post.text?'<div class="ch-post-text">'+esc(post.text).replace(/\n/g,'<br>')+'</div>':'') +
      (post.imageUrl?'<div class="ch-post-img"><img src="'+esc(post.imageUrl)+'" alt="" loading="lazy"></div>':'') +
      '<div class="ch-post-footer">' +
        '<span><i class="far fa-heart"></i> '+(post.likeCount||0)+'</span>' +
        '<span><i class="far fa-comment"></i> '+(post.commentCount||0)+'</span>' +
      '</div>' +
    '</div>';
  }

  function openNewPostModal(ch){
    if(document.getElementById('chNpModal')) return;
    var ov = document.createElement('div');
    ov.className = 'vid-modal-overlay'; ov.id = 'chNpModal';
    ov.innerHTML =
      '<div class="vid-modal" style="max-width:520px">' +
        '<h2><i class="fas fa-newspaper"></i> ახალი პოსტი' +
          '<button class="vid-modal-close" id="chNpClose"><i class="fas fa-times"></i></button>' +
        '</h2>' +
        '<div class="vid-form-group">' +
          '<label class="vid-form-label">ტექსტი <span>*</span></label>' +
          '<textarea id="chNpText" class="vid-form-textarea" rows="5" maxlength="2000" placeholder="რას ფიქრობ?…"></textarea>' +
        '</div>' +
        '<div class="vid-form-group">' +
          '<label class="vid-form-label">სურათის URL (სურვილისამებრ)</label>' +
          '<input id="chNpImage" class="vid-form-input" type="url" placeholder="https://...">' +
        '</div>' +
        '<div class="vid-modal-footer">' +
          '<button class="vid-btn ghost" id="chNpCancel">გაუქმება</button>' +
          '<button class="vid-btn primary" id="chNpSave"><i class="fas fa-paper-plane"></i> გამოქვეყნება</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    function close(){ ov.remove(); }
    document.getElementById('chNpClose').onclick = close;
    document.getElementById('chNpCancel').onclick = close;
    ov.addEventListener('click', function(e){ if(e.target===ov) close(); });
    document.getElementById('chNpSave').onclick = function(){
      var text = document.getElementById('chNpText').value.trim();
      if(!text){ toast('ტექსტი სავალდებულოა'); return; }
      var imageUrl = document.getElementById('chNpImage').value.trim();
      var btn = document.getElementById('chNpSave');
      btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      var u = authUser();
      var data = {
        text: text, imageUrl: imageUrl||'',
        authorId: u.uid, authorName: u.displayName||'', authorAvatar: u.photoURL||'',
        channelId: ch._id, channelName: ch.name||'',
        likeCount: 0, commentCount: 0,
        createdAt: fs().serverTimestamp()
      };
      fs().addDoc(fs().collection(db(),'channels',ch._id,'posts'), data)
        .then(function(){
          return fs().addDoc(fs().collection(db(),'posts'), Object.assign({},data,{type:'channelPost'})).catch(function(){});
        })
        .then(function(){ toast('პოსტი გამოქვეყნდა ✓'); close(); switchTabByName('posts'); })
        .catch(function(e){ toast('შეცდომა: '+e.message); btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane"></i> გამოქვეყნება'; });
    };
  }

  /* ─────────────────────────── Fetch channel posts ───────── */
  function fetchChannelPosts(channelId){
    if(!fs()||!db()) return Promise.resolve([]);
    return fs().getDocs(fs().query(
      fs().collection(db(),'channels',channelId,'posts'),
      fs().orderBy('createdAt','desc'),
      fs().limit(50)
    )).then(function(snap){
      var posts=[];
      snap.forEach(function(d){ posts.push(Object.assign({_id:d.id},d.data())); });
      return posts;
    }).catch(function(){ return []; });
  }

  /* ─────────────────────────── Playlists tab ─────────────── */
  function renderPlaylistsTab(ch, el){
    fetchPlaylists(ch._id).then(function(pls){
      if(!pls.length){
        el.innerHTML='<div class="vid-empty"><i class="fas fa-list"></i><h3>Playlist არ არის</h3>'+
          (authUser()&&authUser().uid===ch.ownerId?'<button class="vid-btn primary" id="chAddPlBtn" style="margin-top:12px"><i class="fas fa-plus"></i> Playlist-ის შექმნა</button>':'')+
          '</div>';
        var addBtn=document.getElementById('chAddPlBtn');
        if(addBtn) addBtn.onclick=function(){ openPlaylistModal(ch); };
        return;
      }
      var ownerBtns = (authUser()&&authUser().uid===ch.ownerId)
        ? '<div style="display:flex;gap:8px;margin-bottom:16px"><button class="vid-btn primary" id="chAddPlBtn"><i class="fas fa-plus"></i> ახალი Playlist</button></div>'
        : '';
      el.innerHTML=ownerBtns+'<div class="ch-playlist-grid">'+pls.map(renderPlaylistCard).join('')+'</div>';
      var addBtn=document.getElementById('chAddPlBtn');
      if(addBtn) addBtn.onclick=function(){ openPlaylistModal(ch); };
      el.querySelectorAll('[data-playlist-id]').forEach(function(card){
        card.addEventListener('click',function(e){
          e.preventDefault();
          openPlaylistView(card.dataset.playlistId, card.dataset.playlistName, ch);
        });
      });
    });
  }

  /* ─────────────────────────── Fetch playlists ───────────── */
  function fetchPlaylists(channelId){
    if(!fs()||!db()) return Promise.resolve([]);
    return fs().getDocs(fs().collection(db(),'channels',channelId,'playlists'))
      .then(function(snap){
        var pls=[];
        snap.forEach(function(d){ pls.push(Object.assign({_id:d.id},d.data())); });
        pls.sort(function(a,b){ return (b.createdAt&&b.createdAt.toMillis?b.createdAt.toMillis():0)-(a.createdAt&&a.createdAt.toMillis?a.createdAt.toMillis():0); });
        return pls;
      }).catch(function(){ return []; });
  }

  /* ─────────────────────────── Card renderers ─────────────── */
  function renderCard(v, mode){
    if(window.GeoVideos&&window.GeoVideos.cardHTML&&mode==='grid') return window.GeoVideos.cardHTML(v);
    var thumb = v.thumbnail||('https://i.ytimg.com/vi/'+(v.youtubeId||'')+'/hqdefault.jpg');
    var isShortCard = mode==='short';
    var cls = isShortCard ? 'vid-short-card' : (mode==='tv'?'vid-tv-card':'vid-card');
    return '<a class="'+cls+'" href="watch.html?v='+esc(v.id)+'">' +
      '<div class="'+(isShortCard?'vid-short-thumb':'vid-thumb-wrap')+'">' +
        '<img src="'+esc(thumb)+'" alt="" loading="lazy" onerror="if(this.src.indexOf(\'maxresdefault\')>-1)this.src=this.src.replace(\'maxresdefault\',\'hqdefault\')">' +
        '<div class="vid-play-overlay"><div class="vid-play-btn"><i class="fas fa-play"></i></div></div>' +
      '</div>' +
      (isShortCard
        ? '<div class="vid-short-title">'+esc((v.title||'').slice(0,60))+'</div>'
        : '<div class="vid-card-body">' +
            '<div class="vid-card-title">'+esc((v.title||'').slice(0,80))+'</div>' +
            '<div class="vid-card-meta">' +
              '<span class="vid-card-stat"><i class="fas fa-eye"></i>'+fmtNum(v.viewCount)+'</span>' +
              '<span class="vid-card-stat"><i class="fas fa-clock"></i>'+timeAgo(v.createdAt)+'</span>' +
            '</div>' +
          '</div>'
      ) +
    '</a>';
  }

  function renderPlaylistCard(pl){
    var thumb = pl.thumbnail||'';
    return '<div class="ch-playlist-card" data-playlist-id="'+esc(pl._id)+'" data-playlist-name="'+esc(pl.title||'Playlist')+'" style="cursor:pointer">' +
      '<div class="ch-pl-thumb" style="'+(thumb?'background-image:url('+esc(thumb)+');background-size:cover;background-position:center':'background:#1a2133')+'">' +
        (!thumb?'<i class="fas fa-list" style="font-size:2rem;color:#94a3b8"></i>':'') +
        '<div class="ch-pl-count"><i class="fas fa-film"></i> '+(pl.videoCount||0)+'</div>' +
      '</div>' +
      '<div class="ch-pl-info">' +
        '<div class="ch-pl-title">'+esc(pl.title||'Playlist')+'</div>' +
        (pl.description?'<div class="ch-pl-desc">'+esc(pl.description.slice(0,80))+'</div>':'') +
      '</div>' +
    '</div>';
  }

  /* ─────────────────────────── Playlist view ─────────────── */
  function openPlaylistView(plId, plName, ch){
    var el=document.getElementById('chTabContent');
    if(!el) return;
    el.innerHTML='<div style="margin-bottom:12px"><button class="vid-btn ghost" id="chPlBack"><i class="fas fa-arrow-left"></i> Playlists</button></div>' +
      '<h2 class="ch-section-title" style="margin-bottom:16px"><i class="fas fa-list"></i> '+esc(plName)+'</h2>' +
      '<div id="chPlVideos" class="vid-grid"><div class="ch-init-loading"><i class="fas fa-spinner fa-spin"></i></div></div>';
    document.getElementById('chPlBack').onclick=function(){ switchTabByName('playlists'); };
    if(!fs()||!db()){ document.getElementById('chPlVideos').innerHTML='<div class="vid-empty">Firebase unavailable</div>'; return; }
    fs().getDoc(fs().doc(db(),'channels',ch._id,'playlists',plId))
      .then(function(snap){
        if(!snap.exists()){ document.getElementById('chPlVideos').innerHTML='<div class="vid-empty">Playlist ვერ მოიძებნა</div>'; return; }
        var pl=snap.data();
        var itemIds=(pl.itemYoutubeIds||[]);
        if(!itemIds.length){ document.getElementById('chPlVideos').innerHTML='<div class="vid-empty"><i class="fas fa-film"></i><h3>Playlist ცარიელია</h3></div>'; return; }
        fetchVideos(ch._id).then(function(all){
          var plVids=itemIds.map(function(ytId){ return all.find(function(v){ return v.youtubeId===ytId; }); }).filter(Boolean);
          var grid=document.getElementById('chPlVideos');
          if(!grid) return;
          if(!plVids.length){ grid.innerHTML='<div class="vid-empty"><i class="fas fa-film"></i><h3>ვიდეოები ჯერ არ არის</h3></div>'; return; }
          grid.innerHTML=plVids.map(function(v){ return renderCard(v,'grid'); }).join('');
        });
      });
  }

  /* ─────────────────────────── Subscribe ─────────────────── */
  function initSubBtn(ch){
    var btn=document.getElementById('chSubBtn');
    if(!btn) return;
    var u=authUser();
    if(!u){ btn.onclick=function(){ window.location.href='auth.html'; }; return; }
    fs().getDoc(fs().doc(db(),'channels',ch._id,'subscribers',u.uid))
      .then(function(d){ setSubBtn(btn,d.exists()); }).catch(function(){});
    btn.onclick=function(){
      var u2=authUser(); if(!u2){ window.location.href='auth.html'; return; }
      btn.disabled=true;
      var subRef=fs().doc(db(),'channels',ch._id,'subscribers',u2.uid);
      var chRef=fs().doc(db(),'channels',ch._id);
      fs().getDoc(subRef).then(function(d){
        if(d.exists()){
          return fs().deleteDoc(subRef).then(function(){ return fs().updateDoc(chRef,{subscriberCount:fs().increment(-1)}); })
            .then(function(){ setSubBtn(btn,false); updateSubDisplay(-1); });
        } else {
          return fs().setDoc(subRef,{subscribedAt:fs().serverTimestamp()}).then(function(){ return fs().updateDoc(chRef,{subscriberCount:fs().increment(1)}); })
            .then(function(){ setSubBtn(btn,true); updateSubDisplay(1); });
        }
      }).finally(function(){ btn.disabled=false; });
    };
  }
  function setSubBtn(btn,sub){
    var _t=typeof GHt==='function'?GHt:function(k){return k;};
    btn.innerHTML=sub?'<i class="fas fa-check"></i> '+_t('ch_subscribed'):'<i class="fas fa-plus"></i> '+_t('ch_subscribe');
    btn.classList.toggle('subscribed',sub);
  }
  function updateSubDisplay(delta){
    var el=document.getElementById('chSubCount'); if(!el) return;
    var m=(el.textContent||'').match(/[\d.]+[KM]?/);
    if(m) el.innerHTML='<i class="fas fa-users"></i> '+fmtNum((parseFloat(m[0])||0)+delta)+' გამომწერი';
  }

  /* ─────────────────────────── Owner controls ─────────────── */
  function initOwnerControls(ch){
    var u=authUser();
    if(!u||u.uid!==ch.ownerId) return;
    var bar=document.getElementById('chOwnerBar');
    if(bar) bar.style.display='flex';
    /* "Add Banner" overlay on empty banner */
    var emptyBanner=document.getElementById('chBannerEmpty');
    if(emptyBanner){
      emptyBanner.innerHTML='<button class="ch-add-banner-btn" id="chAddBannerBtn"><i class="fas fa-image"></i> Banner-ის დამატება</button>';
      document.getElementById('chAddBannerBtn').onclick=function(){ openEditChannelModal(ch); };
    }
    var subBtn=document.getElementById('chSubBtn');
    if(subBtn) subBtn.outerHTML='<a class="ch-sub-btn subscribed" href="videos.html" style="text-decoration:none"><i class="fas fa-plus"></i> ვიდეოს დამატება</a>';
    var editBtn=document.getElementById('chEditBtn');
    var manageBtn=document.getElementById('chManageBtn');
    var importBtn=document.getElementById('chImportBtn');
    var delAllBtn=document.getElementById('chDeleteAllVideosBtn');
    var delChBtn=document.getElementById('chDeleteChannelBtn');
    if(editBtn)    editBtn.onclick    = function(){ openEditChannelModal(ch); };
    if(manageBtn)  manageBtn.onclick  = function(){ toggleManageMode(ch); };
    if(importBtn)  importBtn.onclick  = function(){ openReImportModal(ch); };
    if(delAllBtn)  delAllBtn.onclick  = function(){ deleteAllChannelVideos(ch); };
    if(delChBtn)   delChBtn.onclick   = function(){ deleteChannel(ch); };
  }

  function toggleManageMode(ch){
    _manageMode=!_manageMode;
    var btn=document.getElementById('chManageBtn');
    if(btn){ btn.innerHTML=_manageMode?'<i class="fas fa-check"></i> დასრულება':'<i class="fas fa-sliders"></i> ვიდეოების მართვა'; btn.classList.toggle('active',_manageMode); }
    if(_manageMode) injectDelBtns(ch);
    else document.querySelectorAll('.ch-vid-del').forEach(function(b){ b.style.display='none'; });
  }

  function injectDelBtns(ch){
    document.querySelectorAll('#chTabContent .vid-card, #chTabContent .vid-tv-card, #chTabContent .vid-short-card').forEach(function(card){
      if(card.querySelector('.ch-vid-del')) { card.querySelector('.ch-vid-del').style.display=''; return; }
      var href=card.getAttribute('href')||'';
      var vidId=href.replace(/.*\?v=/,'');
      if(!vidId) return;
      var b=document.createElement('button');
      b.className='ch-vid-del';
      b.title='წაშლა';
      b.innerHTML='<i class="fas fa-trash-can"></i>';
      b.style.display='';
      b.onclick=function(e){
        e.preventDefault(); e.stopPropagation();
        window.ghConfirm('ვიდეო წაიშლება. გააგრძელო?', function(){
          b.disabled=true;
          fs().deleteDoc(fs().doc(db(),'videos',vidId)).then(function(){
            card.style.opacity='0'; card.style.pointerEvents='none';
            setTimeout(function(){ card.remove(); },300);
            _allVideos=_allVideos&&_allVideos.filter(function(v){ return v.id!==vidId; });
            if(ch._id) fs().updateDoc(fs().doc(db(),'channels',ch._id),{videoCount:fs().increment(-1)}).catch(function(){});
          }).catch(function(){ b.disabled=false; });
        });
      };
      card.style.position='relative';
      card.appendChild(b);
    });
  }

  /* ─────────────────────────── Edit channel modal ─────────── */
  function openEditChannelModal(ch){
    if(document.getElementById('chEditModal')) return;
    var ov=document.createElement('div');
    ov.className='vid-modal-overlay'; ov.id='chEditModal';
    ov.innerHTML=
      '<div class="vid-modal" style="max-width:520px">' +
        '<h2><i class="fas fa-pen"></i> არხის რედაქტირება' +
          '<button class="vid-modal-close" id="cheClose"><i class="fas fa-times"></i></button>' +
        '</h2>' +
        '<div class="vid-form-group">' +
          '<label class="vid-form-label">სახელი <span>*</span></label>' +
          '<input id="cheName" class="vid-form-input" type="text" maxlength="80" value="'+esc(ch.name||'')+'">' +
        '</div>' +
        '<div class="vid-form-group">' +
          '<label class="vid-form-label">აღწერა</label>' +
          '<textarea id="cheDesc" class="vid-form-textarea" maxlength="1000" rows="4">'+esc(ch.description||'')+'</textarea>' +
        '</div>' +
        '<div class="vid-form-group">' +
          '<label class="vid-form-label">Avatar URL</label>' +
          '<input id="cheAvatar" class="vid-form-input" type="url" value="'+esc(ch.avatar||'')+'">' +
        '</div>' +
        '<div class="vid-form-group">' +
          '<label class="vid-form-label"><i class="fas fa-image" style="color:#60a5fa;margin-right:4px"></i>Banner URL' +
            '<span style="font-size:.75rem;color:#94a3b8;font-weight:400;margin-left:6px">(YouTube Studio → Customization → Branding → Banner image → copy URL)</span>' +
          '</label>' +
          '<input id="cheBanner" class="vid-form-input" type="url" placeholder="https://yt3.googleusercontent.com/..." value="'+esc(ch.banner||'')+'">' +
          (ch.banner?'<div style="margin-top:6px"><img src="'+esc(ch.banner)+'" style="width:100%;height:60px;object-fit:cover;border-radius:8px;border:1px solid rgba(255,255,255,.1)" alt="Banner preview" onerror="this.remove()"></div>':'') +
        '</div>' +
        '<div class="vid-form-group">' +
          '<label class="vid-form-label"><i class="fas fa-star" style="color:#f59e0b;margin-right:4px"></i>Featured Video ID (Firestore ID)</label>' +
          '<input id="cheFeatured" class="vid-form-input" type="text" placeholder="ვიდეოს ID (სურვილისამებრ)" value="'+esc(ch.featuredVideoId||'')+'">' +
        '</div>' +
        '<div class="vid-modal-footer">' +
          '<button class="vid-btn ghost" id="cheCancel"><i class="fas fa-times"></i> გაუქმება</button>' +
          '<button class="vid-btn primary" id="cheSave"><i class="fas fa-floppy-disk"></i> შენახვა</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    function close(){ ov.remove(); }
    document.getElementById('cheClose').onclick=close;
    document.getElementById('cheCancel').onclick=close;
    ov.addEventListener('click',function(e){ if(e.target===ov) close(); });
    document.getElementById('cheSave').onclick=function(){
      var name=document.getElementById('cheName').value.trim();
      if(!name){ toast('სახელი სავალდებულოა','error'); return; }
      var saveBtn=document.getElementById('cheSave');
      saveBtn.disabled=true; saveBtn.innerHTML='<i class="fas fa-spinner fa-spin"></i>';
      var updates={
        name:        name,
        description: document.getElementById('cheDesc').value.trim(),
        avatar:      document.getElementById('cheAvatar').value.trim(),
        banner:      document.getElementById('cheBanner').value.trim(),
        featuredVideoId: document.getElementById('cheFeatured').value.trim()||null
      };
      fs().updateDoc(fs().doc(db(),'channels',ch._id),updates)
        .then(function(){ toast('შეინახა ✓'); close(); location.reload(); })
        .catch(function(e){ toast('შეცდომა: '+e.message,'error'); saveBtn.disabled=false; saveBtn.innerHTML='<i class="fas fa-floppy-disk"></i> შენახვა'; });
    };
  }

  /* ─────────────────────────── Playlist modal ─────────────── */
  function openPlaylistModal(ch, existing){
    if(document.getElementById('chPlModal')) return;
    var ov=document.createElement('div');
    ov.className='vid-modal-overlay'; ov.id='chPlModal';
    ov.innerHTML=
      '<div class="vid-modal" style="max-width:460px">' +
        '<h2><i class="fas fa-list"></i> '+(existing?'Playlist-ის რედაქტირება':'Playlist-ის შექმნა')+
          '<button class="vid-modal-close" id="chPlClose"><i class="fas fa-times"></i></button>' +
        '</h2>' +
        '<div class="vid-form-group">' +
          '<label class="vid-form-label">სათაური <span>*</span></label>' +
          '<input id="chPlTitle" class="vid-form-input" type="text" maxlength="100" value="'+esc(existing&&existing.title||'')+'">' +
        '</div>' +
        '<div class="vid-form-group">' +
          '<label class="vid-form-label">აღწერა</label>' +
          '<textarea id="chPlDesc" class="vid-form-textarea" maxlength="500">'+esc(existing&&existing.description||'')+'</textarea>' +
        '</div>' +
        '<div class="vid-form-group">' +
          '<label class="vid-form-label">Thumbnail URL (სურვილისამებრ)</label>' +
          '<input id="chPlThumb" class="vid-form-input" type="url" value="'+esc(existing&&existing.thumbnail||'')+'">' +
        '</div>' +
        '<div class="vid-modal-footer">' +
          '<button class="vid-btn ghost" id="chPlCancel">გაუქმება</button>' +
          '<button class="vid-btn primary" id="chPlSave"><i class="fas fa-floppy-disk"></i> შენახვა</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    function close(){ ov.remove(); }
    document.getElementById('chPlClose').onclick=close;
    document.getElementById('chPlCancel').onclick=close;
    ov.addEventListener('click',function(e){ if(e.target===ov) close(); });
    document.getElementById('chPlSave').onclick=function(){
      var title=document.getElementById('chPlTitle').value.trim();
      if(!title){ toast('სათაური სავალდებულოა','error'); return; }
      var btn=document.getElementById('chPlSave');
      btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i>';
      var data={
        title:       title,
        description: document.getElementById('chPlDesc').value.trim(),
        thumbnail:   document.getElementById('chPlThumb').value.trim(),
        videoCount:  existing&&existing.videoCount||0,
        itemYoutubeIds: existing&&existing.itemYoutubeIds||[],
        createdAt:   fs().serverTimestamp()
      };
      var p = existing
        ? fs().updateDoc(fs().doc(db(),'channels',ch._id,'playlists',existing._id), data)
        : fs().addDoc(fs().collection(db(),'channels',ch._id,'playlists'), data);
      p.then(function(){ toast('Playlist შეინახა ✓'); close(); switchTabByName('playlists'); })
       .catch(function(e){ toast('შეცდომა: '+e.message,'error'); btn.disabled=false; btn.innerHTML='<i class="fas fa-floppy-disk"></i> შენახვა'; });
    };
  }

  /* ─────────────────────────── Re-import modal ─────────────── */
  function openReImportModal(ch){
    if(!ch.youtubeUrl){ toast('ამ არხს YouTube URL არ აქვს','error'); return; }
    window.ghConfirm('YouTube-დან კვლავ გადმოვიტანო ყველა ვიდეო, Shorts და Playlist? (დუბლიკატები გამოტოვდება)', function(){
      toast('Import დაიწყო...');
      var u=authUser();
      if(!u){ toast('ავტორიზაცია საჭიროა','error'); return; }
      if(window.GeoVideos&&window.GeoVideos.importChannelVideos){
        window.GeoVideos.importChannelVideos(ch.youtubeUrl, ch._id, u, function(){
          _allVideos=null;
          toast('Import დასრულდა ✓');
          switchTab(_activeTab, _ch);
        });
      } else { toast('videos.js ვერ მოიძებნა','error'); }
    });
  }

  /* ─────────────────────────── Delete all videos ─────────── */
  function deleteAllChannelVideos(ch){
    window.ghConfirm('ყველა ვიდეო წაიშლება. გააგრძელო?', function(){
      var btn=document.getElementById('chDeleteAllVideosBtn');
      if(btn){ btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i>'; }
      fs().getDocs(fs().query(fs().collection(db(),'videos'),fs().where('channelId','==',ch._id),fs().limit(50)))
        .then(function(snap){
          return Promise.all(snap.docs.map(function(d){ return fs().deleteDoc(d.ref); }))
            .then(function(){ return fs().updateDoc(fs().doc(db(),'channels',ch._id),{videoCount:0}); });
        })
        .then(function(){
          _allVideos=null;
          toast('ყველა ვიდეო წაიშალა ✓');
          setTimeout(function(){ location.reload(); },800);
        })
        .catch(function(e){ toast('შეცდომა: '+e.message,'error'); if(btn){ btn.disabled=false; btn.innerHTML='<i class="fas fa-trash"></i> ყველა ვიდეო'; } });
    });
  }

  /* ─────────────────────────── Delete channel ─────────────── */
  function deleteChannel(ch){
    window.ghConfirm('"'+ch.name+'" წაიშლება საბოლოოდ. გააგრძელო?', function(){
      var btn=document.getElementById('chDeleteChannelBtn');
      if(btn){ btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i>'; }
      fs().getDocs(fs().query(fs().collection(db(),'videos'),fs().where('channelId','==',ch._id),fs().limit(50)))
        .then(function(snap){ return Promise.all(snap.docs.map(function(d){ return fs().deleteDoc(d.ref); })); })
        .then(function(){ return fs().deleteDoc(fs().doc(db(),'channels',ch._id)); })
        .then(function(){ window.location.href='videos.html'; })
        .catch(function(e){ toast('შეცდომა: '+e.message,'error'); if(btn){ btn.disabled=false; btn.innerHTML='<i class="fas fa-ban"></i> არხის წაშლა'; } });
    });
  }

  /* ─────────────────────────── Toast ─────────────────────── */
  function toast(msg){
    var el=document.querySelector('.gh-toast'); if(el) el.remove();
    el=document.createElement('div'); el.className='gh-toast show'; el.textContent=msg;
    document.body.appendChild(el);
    setTimeout(function(){ el.classList.remove('show'); setTimeout(function(){ el.remove(); },250); },2800);
  }

  /* ─────────────────────────── Error ─────────────────────── */
  function showError(msg){
    var page=document.getElementById('channelPage');
    if(page) page.innerHTML='<div class="vid-empty" style="padding:100px 0"><i class="fas fa-exclamation-circle" style="font-size:3rem;color:#ef4444;display:block;margin-bottom:16px"></i><h3>'+esc(msg)+'</h3><a href="videos.html" style="color:var(--green)">← Videos-ზე დაბრუნება</a></div>';
  }

})();
