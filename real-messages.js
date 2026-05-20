(function(){
  'use strict';

  // ── Synchronous pre-redirect ──────────────────────────────────────────────
  // Runs at script-parse time — before auth polling, GeoSocial wait, or any
  // listener setup. If the active actor is a business page and the URL has no
  // explicit route param, redirect to ?business=BIZ_ID and shut down this
  // module immediately so NOTHING else in the IIFE executes.
  // This is the hard barrier that prevents personal inbox from rendering even
  // for a single frame when the user is in page/business mode.
  {
    const _sp = new URLSearchParams(location.search);
    if (!_sp.has('business') && !_sp.has('withBusiness') && !_sp.has('with')) {
      try {
        const _sa = JSON.parse(localStorage.getItem('gh_active_actor') || 'null');
        if (_sa && _sa.type === 'business' && _sa.businessId) {
          location.replace(location.pathname + '?business=' + encodeURIComponent(_sa.businessId));
          return; // Stop the entire module — page is navigating
        }
      } catch(_se) {}
    }
  }

  const REACTIONS = ['👍','❤️','😂','😮','😢','😡'];
  const EMOJIS = ['😀','😁','😂','🤣','😊','😍','😘','😎','😢','😭','😡','👍','👎','👏','🙏','💪','🔥','❤️','💚','💯','🎉','✨','🇬🇪'];
  const THEMES = [
    { label:'Default', v:'#10b981,#3b82f6' },
    { label:'Sunset',  v:'#f97316,#ec4899' },
    { label:'Ocean',   v:'#06b6d4,#6366f1' },
    { label:'Forest',  v:'#22c55e,#15803d' },
    { label:'Candy',   v:'#f472b6,#a855f7' },
    { label:'Fire',    v:'#ef4444,#f97316' },
    { label:'Night',   v:'#6366f1,#1e1b4b' },
    { label:'Gold',    v:'#f59e0b,#d97706' },
  ];
  const DEFAULT_THEME = THEMES[0].v;

  const esc = v => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const $ = s => document.querySelector(s);
  // Debug mode: add ?debugMessages=1 to URL to enable verbose inbox logging
  const _dbgMessages = new URLSearchParams(location.search).get('debugMessages') === '1';
  function dbg(...args){ if(_dbgMessages) console.log('[GeoHub Msg]', ...args); }

  let activeConversation = null;
  let activeConvData = null;
  let _activeBizId = null;   // set when in business INBOX mode (?business=BIZ_ID)
  let _activeBizTitle = '';
  let _activeBizLogo = '';   // logo url for business inbox mode
  let _withBizId = '';       // set when in customer-side biz chat (?withBusiness=BIZ_ID)
  let _withBizTitle = '';
  let _withBizLogo = '';
  let unsubConvs = null;
  let unsubMsgs = null;
  let unsubReactions = null;
  let unsubSafety = null;
  let unsubConvSettings = null;
  let unsubConvDoc = null;
  let sendingMessage = false;
  let reactionState = {};
  let replyState = null;
  let allMessages = [];
  let activePeerInfo = null;
  let searchActive = false;
  let typingTimer = null;
  let isTyping = false;
  let lastTypingWrite = 0;
  let convSettings = {};
  let convTheme = '';
  let convNicknames = {};
  let mediaRecorder = null;
  let audioChunks = [];
  let recordingTimer = null;
  let recordingStart = 0;
  let uploadingAttachment = false;
  let _convFilter = 'all';
  let _searchFilter = '';
  let _routeMode = ''; // 'businessInbox' | 'customerBusinessChat' | 'personalInbox'
  const _userCache = {};

  function whenReady(cb){
    if(window.GeoSocial && window.GeoFirebase) return cb();
    window.addEventListener('GeoSocialReady', cb, {once:true});
  }

  function isMobileMsg(){ return window.matchMedia('(max-width: 768px)').matches; }

  function setChatOpen(open){
    document.body.classList.toggle('chat-open', !!open);
    var layout = document.querySelector('.messages-layout');
    if(layout) layout.classList.toggle('chat-open', !!open);
    if (open) closeMobileInfoPanel();
  }
  function closeMobileInfoPanel(){
    if(!isMobileMsg()) return;
    closeMobileInfoSheet();
    const panel = document.getElementById('infoPanel');
    if(panel){
      panel.classList.remove('open', 'panel-visible');
      panel.style.display = 'none';
      panel.hidden = true;
    }
  }
  window.ghChatBack = function(){ closeMobileInfoPanel(); setChatOpen(false); };
  window.addEventListener('resize', closeMobileInfoPanel);
  window.addEventListener('orientationchange', closeMobileInfoPanel);
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', closeMobileInfoPanel, { once:true });
  else closeMobileInfoPanel();

  function currentUid(){ return window.GeoFirebase?.auth?.currentUser?.uid || ''; }
  function currentActorId(){
    if(_activeBizId) return 'business_' + _activeBizId;
    const uid = currentUid();
    return uid ? 'user_' + uid : '';
  }
  function otherId(conv){ const uid=currentUid(); return (conv?.participants||[]).find(id=>id!==uid) || ''; }
  function initials(name){ return (String(name||'U').trim()[0] || 'U').toUpperCase(); }

  async function userInfo(uid){
    if(_userCache[uid]) return _userCache[uid];
    const fallback = { id:uid, name:'GeoHub User', avatar:'' };
    if(!uid) return fallback;
    try{
      const GF=window.GeoFirebase;
      const snap=await GF.fs.getDoc(GF.fs.doc(GF.db,'users',uid));
      if(snap.exists()){
        const d=snap.data()||{};
        const u={ id:uid, name:d.fullName||d.displayName||d.name||d.username||d.email||'GeoHub User', avatar:d.photoURL||d.avatar||d.avatarUrl||d.photo||'', lastSeen:d.lastSeen||d.lastActive||d.updatedAt||null };
        _userCache[uid]=u; return u;
      }
    }catch(e){}
    _userCache[uid]=fallback; return fallback;
  }

  function displayName(uid, fallback){
    if(convNicknames && convNicknames[uid]) return convNicknames[uid];
    return fallback || 'User';
  }

  function updateMsgBadge(count){
    ['navMsgBadge','ghMsgBadge'].forEach(id=>{
      const b=document.getElementById(id);
      if(!b) return;
      if(count > 0){ b.textContent=count>99?'99+':String(count); b.style.display=''; }
      else { b.textContent=''; b.style.display='none'; }
    });
  }

  async function renderConvs(convs){
    const list=$('#convList');
    if(!list) return;
    const _uid0 = currentUid();
    const _actorKeyOld0 = _activeBizId ? 'business:' + _activeBizId : 'user:' + _uid0;
    const _actorKeyNew0 = currentActorId(); // canonical: 'business_bizId' or 'user_uid'
    dbg('renderConvs', {mode:_routeMode, actorId:_actorKeyNew0, uid:_uid0, total:convs.length, bizId:_activeBizId, convSummary: convs.map(c=>({id:c.id, inboxActorIds:c.inboxActorIds, hiddenForActors:c.hiddenForActors}))});
    const blockedIds = window._ghBlockedUserIds || [];
    const baseConvs = blockedIds.length ? convs.filter(c=>{ const oid=otherId(c); return !oid||!blockedIds.includes(oid); }) : convs;
    // Filter hidden: check BOTH old ('user:uid'/'business:bizId') and canonical ('user_uid'/'business_bizId') formats
    const visibleConvs = baseConvs.filter(c => {
      if(!Array.isArray(c.hiddenForActors)) return true;
      if(c.hiddenForActors.includes(_actorKeyOld0)){ dbg('exclude',c.id,'hiddenForActors(old)'); return false; }
      if(c.hiddenForActors.includes(_actorKeyNew0)){ dbg('exclude',c.id,'hiddenForActors(new)'); return false; }
      return true;
    });
    // Route-mode guard: prefer canonical inboxActorIds; fall back to legacy fields for old convs
    // that haven't been backfilled yet. This prevents "No conversations yet" while backfill runs.
    const routeConvs = (_routeMode === 'personalInbox' || _routeMode === 'customerBusinessChat')
      ? visibleConvs.filter(c => {
          // Canonical Phase 57: inboxActorIds contains 'user_{uid}'
          if(Array.isArray(c.inboxActorIds) && c.inboxActorIds.includes('user_' + _uid0)){
            dbg('include',c.id,'inboxActorIds'); return true;
          }
          // Personal conv (no business flag at all)
          if(!c.forBusiness){ dbg('include',c.id,'personal'); return true; }
          // Business conv where this user is explicitly the customer
          if(c.customerUid === _uid0){ dbg('include',c.id,'customerUid'); return true; }
          // Backward compat: old biz conv without customerUid field but user is in participants
          if(c.forBusiness && !c.customerUid && Array.isArray(c.participants) && c.participants.includes(_uid0)){
            dbg('include',c.id,'legacy-biz-no-customerUid'); return true;
          }
          dbg('exclude',c.id,'biz-not-customer customerUid='+c.customerUid);
          return false;
        })
      : (_routeMode === 'businessInbox')
        ? visibleConvs.filter(c => {
            // Canonical Phase 57: inboxActorIds contains 'business_{bizId}'
            if(Array.isArray(c.inboxActorIds) && c.inboxActorIds.includes('business_' + _activeBizId)){
              dbg('include',c.id,'inboxActorIds-biz'); return true;
            }
            // Legacy: businessId field matches (backfill may not have run yet)
            if(c.businessId === _activeBizId){ dbg('include',c.id,'businessId-match'); return true; }
            dbg('exclude',c.id,'biz-wrong-id '+c.businessId);
            return false;
          })
        : visibleConvs;
    // Pane/list sync: if active conv is no longer visible but list has other entries, clear stale right pane
    if(activeConversation && routeConvs.length > 0 && !routeConvs.find(c => c.id === activeConversation)){
      if(_routeMode !== 'customerBusinessChat'){ // withBiz mode always has exactly one conv; never clear it
        dbg('pane-sync','clearing stale active conv',activeConversation);
        activeConversation = null; activeConvData = null; activePeerInfo = null;
        if(unsubMsgs){ try{unsubMsgs();}catch(ex){} unsubMsgs=null; }
        if(unsubReactions){ try{unsubReactions();}catch(ex){} unsubReactions=null; }
        if(unsubConvDoc){ try{unsubConvDoc();}catch(ex){} unsubConvDoc=null; }
        if(unsubConvSettings){ try{unsubConvSettings();}catch(ex){} unsubConvSettings=null; }
        const box=$('#chatMessages');
        if(box) box.innerHTML='<div class="chat-empty"><i class="fas fa-comments"></i><p>Select a conversation</p></div>';
        closeMobileInfoSheet();
        renderConversationDetails();
        setChatOpen(false);
      }
    }
    const rows=[];
    let unreadCount=0;
    for(const c of routeConvs){
      let oid, u, isBiz=false;
      if(c.forBusiness && c.businessId){
        if(_activeBizId){
          // Business INBOX view: show the customer as the contact
          oid = c.customerUid || otherId(c) || '';
          u = oid ? await userInfo(oid) : { id: '', name: 'Customer', avatar: '' };
        } else {
          // Personal/customer sidebar: show business as the contact
          oid = c.businessId;
          u = { id: c.businessId, name: c.businessName || 'Business', avatar: c.businessLogo || '' };
          isBiz = true;
        }
      } else {
        oid = otherId(c);
        u = await userInfo(oid);
      }
      // Check both old ('business:bizId' / 'user:uid') and new canonical ('business_bizId' / 'user_uid') formats during transition
      const _actorKeyNew = currentActorId();
      const _actorKeyOld = _activeBizId ? 'business:' + _activeBizId : 'user:' + currentUid();
      const hasActorUnread = Array.isArray(c.unreadActors);
      const unread = hasActorUnread
        ? (c.unreadActors.includes(_actorKeyNew) || c.unreadActors.includes(_actorKeyOld))
        : (Array.isArray(c.unreadFor) && !_activeBizId && c.unreadFor.includes(currentUid()));
      if(unread) unreadCount++;
      rows.push({c, oid, u, unread, isBiz});
    }
    let filtered = rows;
    if(_convFilter === 'unread') filtered = filtered.filter(r=>r.unread);
    if(_searchFilter){
      filtered = filtered.filter(r=>{
        const name = (convNicknames[r.oid] || r.u.name || '').toLowerCase();
        return name.includes(_searchFilter);
      });
    }
    // Pinned convs float to top; preserve relative time order within each group
    const _pinActorKey = currentActorId();
    filtered.sort((a,b)=>{
      const ap=Array.isArray(a.c.pinnedForActors)&&a.c.pinnedForActors.includes(_pinActorKey);
      const bp=Array.isArray(b.c.pinnedForActors)&&b.c.pinnedForActors.includes(_pinActorKey);
      if(ap===bp) return 0;
      return ap?-1:1;
    });
    if(!filtered.length){
      const msg = _searchFilter ? 'No results for "'+esc(_searchFilter)+'"'
        : (_convFilter==='unread' ? 'No unread messages' : 'No conversations yet');
      list.innerHTML='<div class="conv-empty"><i class="fas fa-inbox"></i><p>'+msg+'</p></div>';
      updateMsgBadge(unreadCount);
      return;
    }
    list.innerHTML=filtered.map(({c,oid,u,unread,isBiz})=>{
      const name = isBiz ? (u.name || 'Business') : (convNicknames[oid] || u.name);
      const ts = convTime(c.updatedAt || c.lastMessageAt || c.createdAt || null);
      const profileHref = isBiz ? 'business.html?id='+esc(c.businessId) : 'profile.html?id='+esc(oid);
      const bizBadge = isBiz ? '<span style="font-size:.65rem;color:#10b981;vertical-align:middle;margin-right:3px"><i class="fas fa-store"></i></span>' : '';
      const isPinnedConv = Array.isArray(c.pinnedForActors)&&c.pinnedForActors.includes(_pinActorKey);
      const pinBadge = isPinnedConv ? '<i class="fas fa-thumbtack" style="font-size:.55rem;color:var(--gh-muted,#94a3b8);margin-left:4px;opacity:.65;transform:rotate(45deg);display:inline-block" title="Pinned"></i>' : '';
      return '<div class="conv-item '+(c.id===activeConversation?'active':'')+' '+(unread?'has-unread':'')+' '+(isPinnedConv?'is-pinned':'')+'" data-conv-id="'+esc(c.id)+'" oncontextmenu="return window.__ghConvCtxMenu(event,\''+esc(c.id)+'\')">'
        + '<a class="conv-av-wrap" href="'+profileHref+'" data-open-user-profile="'+esc(oid)+'" onclick="event.stopPropagation()">'
        + (u.avatar ? '<img class="conv-avatar-img" src="'+esc(u.avatar)+'" alt="" onerror="this.style.display=\'none\'">' : '<div class="av-placeholder">'+esc(initials(name))+'</div>')
        + '</a><div class="conv-info"><div class="conv-top-row"><span class="conv-name">'+bizBadge+esc(name)+pinBadge+'</span>'+(ts?'<span class="conv-time">'+esc(ts)+'</span>':'')+'</div>'
        + '<div class="conv-bottom-row"><span class="conv-preview">'+esc(c.lastMessage||'No messages yet')+'</span>'+(unread?'<span class="conv-unread-dot"></span>':'')+'</div></div>'
        + '<button class="conv-dots-btn" title="More options" aria-label="Conversation options" onclick="event.stopPropagation();window.__ghConvDotsMenu(event,\''+esc(c.id)+'\')"><i class="fas fa-ellipsis-v"></i></button>'
        + '</div>';
    }).join('');
    updateMsgBadge(unreadCount);
  }

  function summarizeLegacyReactions(messageId){
    const rows = reactionState[messageId]?.rows || [];
    const counts = {};
    let mine = '';
    const me = currentUid();
    rows.forEach(r=>{
      const emoji = r.emoji || '❤️';
      counts[emoji] = (counts[emoji]||0)+1;
      if(r.userId === me) mine = emoji;
    });
    const badges = Object.entries(counts).map(([emoji,count])=>'<span class="msg-reaction-badge">'+esc(emoji)+' '+(count>1?count:'')+'</span>').join('');
    return { mine, badges };
  }

  function summarizeReactions(messageId){
    const counts = {};
    let mine = '';
    const actorId = currentActorId();
    const msg = (allMessages || []).find(m => m && m.id === messageId) || {};
    const reactionMap = msg.reactions && typeof msg.reactions === 'object' && !Array.isArray(msg.reactions)
      ? msg.reactions
      : null;

    if(reactionMap){
      Object.keys(reactionMap).forEach(key=>{
        const emoji = reactionMap[key];
        if(!emoji) return;
        counts[emoji] = (counts[emoji]||0)+1;
        if(key === actorId) mine = emoji;
      });
    } else {
      const rows = reactionState[messageId]?.rows || [];
      const me = currentUid();
      rows.forEach(r=>{
        const emoji = r.emoji || '❤️';
        const rowActor = r.actorId || (r.userId ? 'user_' + r.userId : '');
        counts[emoji] = (counts[emoji]||0)+1;
        if(rowActor === actorId || (!actorId && r.userId === me)) mine = emoji;
      });
    }

    const badges = Object.entries(counts).map(([emoji,count])=>'<span class="msg-reaction-badge">'+esc(emoji)+' '+(count>1?count:'')+'</span>').join('');
    return { mine, badges };
  }

  function renderMedia(m){
    if(!m.mediaUrl) return '';
    if(m.type === 'audio'){
      const dur = m.duration ? Math.round(m.duration) + 's' : '';
      return '<div class="msg-audio-player"><button class="msg-audio-play" onclick="var a=this.nextElementSibling;a.paused?a.play():a.pause()" type="button"><i class="fas fa-play"></i></button>'
        + '<audio src="'+esc(m.mediaUrl)+'" onended="this.currentTime=0" onplay="this.previousElementSibling.innerHTML=\'<i class=\\\"fas fa-pause\\\"></i>\'" onpause="this.previousElementSibling.innerHTML=\'<i class=\\\"fas fa-play\\\"></i>\'"></audio>'
        + '<div class="msg-audio-wave"></div><span class="msg-audio-dur">'+esc(dur)+'</span></div>';
    }
    if(m.type === 'file'){
      const size = m.fileSize ? formatFileSize(m.fileSize) : '';
      return '<a class="msg-file-card" href="'+esc(m.mediaUrl)+'" target="_blank" rel="noopener">'
        + '<i class="fas fa-file-alt"></i><div class="msg-file-info"><div class="msg-file-name">'+esc(m.fileName||'File')+'</div>'
        + '<div class="msg-file-size">'+esc(size)+'</div></div><i class="fas fa-download"></i></a>';
    }
    if(m.mediaType === 'image' || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(m.mediaUrl)){
      return '<a class="msg-media-link" href="'+esc(m.mediaUrl)+'" target="_blank" rel="noopener"><img class="msg-image" src="'+esc(m.mediaUrl)+'" alt="Message image" loading="lazy" decoding="async" onerror="this.style.display=\'none\'"></a>';
    }
    return '<a class="msg-file-link" href="'+esc(m.mediaUrl)+'" target="_blank" rel="noopener">📎 Open attachment</a>';
  }

  function formatFileSize(bytes){
    if(!bytes) return '';
    if(bytes < 1024) return bytes+'B';
    if(bytes < 1024*1024) return (bytes/1024).toFixed(1)+'KB';
    return (bytes/1024/1024).toFixed(1)+'MB';
  }

  function normalizeAttachments(m){
    const rows = Array.isArray(m.attachments) ? m.attachments.slice() : [];
    if(!rows.length && m.mediaUrl){
      rows.push({
        type: m.type || m.mediaType || (/^audio/i.test(m.mime||'') ? 'audio' : 'file'),
        url: m.mediaUrl,
        name: m.fileName || '',
        size: m.fileSize || 0,
        mime: m.mime || '',
        duration: m.duration || 0
      });
    }
    const pushUrl = (type, url, name, size, mime)=>{
      if(!url || rows.some(a=>a && a.url===url)) return;
      rows.push({ type:type||'', url, name:name||'', size:size||0, mime:mime||'', duration:m.duration||0 });
    };
    pushUrl('image', m.imageUrl, m.fileName || 'Image', m.fileSize, m.mime || 'image/*');
    (Array.isArray(m.imageUrls) ? m.imageUrls : []).forEach((url,i)=>pushUrl('image', url, 'Image '+(i+1), 0, 'image/*'));
    (Array.isArray(m.mediaUrls) ? m.mediaUrls : []).forEach((url,i)=>pushUrl(m.mediaType || '', url, m.fileName || 'Attachment '+(i+1), 0, m.mime || ''));
    pushUrl('file', m.attachmentUrl, m.fileName || m.attachmentName || 'Attachment', m.fileSize || m.attachmentSize, m.mime || m.fileType || '');
    pushUrl('file', m.fileUrl, m.fileName || 'File', m.fileSize, m.fileType || m.mime || '');
    pushUrl('audio', m.audioUrl, m.fileName || 'Audio message', m.fileSize, m.mime || 'audio/*');
    pushUrl('audio', m.voiceUrl, m.fileName || 'Voice message', m.fileSize, m.mime || 'audio/*');
    return rows.filter(a=>a && a.url);
  }

  function renderAttachment(a){
    const type = a.type || '';
    if(type === 'audio'){
      const dur = a.duration ? Math.round(a.duration) + 's' : '';
      return '<div class="msg-audio-player"><button class="msg-audio-play" onclick="var a=this.nextElementSibling;a.paused?a.play():a.pause()" type="button"><i class="fas fa-play"></i></button>'
        + '<audio src="'+esc(a.url)+'" onended="this.currentTime=0" onplay="this.previousElementSibling.innerHTML=\'<i class=\\\"fas fa-pause\\\"></i>\'" onpause="this.previousElementSibling.innerHTML=\'<i class=\\\"fas fa-play\\\"></i>\'"></audio>'
        + '<div class="msg-audio-wave"></div><span class="msg-audio-dur">'+esc(dur)+'</span></div>';
    }
    if(type === 'file'){
      const size = a.size ? formatFileSize(a.size) : '';
      return '<a class="msg-file-card" href="'+esc(a.url)+'" target="_blank" rel="noopener">'
        + '<i class="fas fa-file-alt"></i><div class="msg-file-info"><div class="msg-file-name">'+esc(a.name||'File')+'</div>'
        + '<div class="msg-file-size">'+esc(size)+'</div></div><i class="fas fa-download"></i></a>';
    }
    if(type === 'image' || /^image\//i.test(a.mime||'') || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(a.url)){
      return '<button class="msg-media-link" type="button" data-msg-image="'+esc(a.url)+'" aria-label="Open image"><img class="msg-image" src="'+esc(a.url)+'" alt="Message image" loading="lazy" decoding="async" onerror="this.style.display=\'none\'"></button>';
    }
    return '<a class="msg-file-link" href="'+esc(a.url)+'" target="_blank" rel="noopener">Open attachment</a>';
  }

  function renderMedia(m){
    const attachments = normalizeAttachments(m);
    if(!attachments.length) return '';
    return '<div class="msg-attachments">'+attachments.map(renderAttachment).join('')+'</div>';
  }

  function openMessageImage(url){
    if(!url) return;
    const existing = document.querySelector('.msg-lightbox');
    if(existing) existing.remove();
    const box = document.createElement('div');
    box.className = 'msg-lightbox';
    box.innerHTML = '<button class="msg-lightbox-close" type="button" aria-label="Close"><i class="fas fa-times"></i></button><img src="'+esc(url)+'" alt="Message image">';
    box.addEventListener('click', e=>{ if(e.target === box || e.target.closest('.msg-lightbox-close')) box.remove(); });
    document.body.appendChild(box);
  }

  function visibleMessagesForDetails(){
    const uid=currentUid();
    const actorId=currentActorId();
    return (allMessages||[]).filter(m=>{
      if(!m || m.deleted || m.deletedForEveryone) return false;
      if(Array.isArray(m.deletedFor) && m.deletedFor.includes(uid)) return false;
      if(Array.isArray(m.deletedForActors) && m.deletedForActors.includes(actorId)) return false;
      return true;
    });
  }

  function detailAttachments(){
    const media=[], files=[], audio=[];
    visibleMessagesForDetails().forEach(m=>{
      normalizeAttachments(m).forEach(a=>{
        const type=String(a.type||'').toLowerCase();
        const mime=String(a.mime||'').toLowerCase();
        const url=String(a.url||'');
        const item=Object.assign({}, a, { messageId:m.id, createdAt:m.createdAt });
        if(type==='audio' || mime.indexOf('audio/')===0 || /\.(mp3|m4a|wav|ogg|webm)(\?|$)/i.test(url)) audio.push(item);
        else if(type==='image' || mime.indexOf('image/')===0 || /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(url)) media.push(item);
        else files.push(item);
      });
    });
    return { media, files, audio };
  }

  function conversationContextLabel(conv){
    if(!conv) return 'Conversation';
    if(_activeBizId && conv.forBusiness) return 'Business inbox';
    if(conv.forBusiness && conv.businessId) return 'Page conversation';
    return conv.isFriend || conv.friendshipId ? 'Friend' : 'Direct message';
  }

  function peerHref(peer, conv){
    if(!peer) return '#';
    if(conv && conv.forBusiness && !_activeBizId && conv.businessId) return 'business.html?id='+encodeURIComponent(conv.businessId);
    if(peer.type==='business') return 'business.html?id='+encodeURIComponent(peer.id||'');
    return peer.id ? 'profile.html?id='+encodeURIComponent(peer.id) : '#';
  }

  function renderDetailMedia(att){
    const images = att.media.length
      ? '<div class="msg-details-grid">'+att.media.slice(0,12).map(a=>'<button type="button" class="msg-detail-thumb" data-detail-image="'+esc(a.url)+'"><img src="'+esc(a.url)+'" alt="" loading="lazy" onerror="this.remove()"></button>').join('')+'</div>'
      : '<div class="msg-detail-empty">No media shared yet</div>';
    const files = att.files.length
      ? '<div class="msg-detail-list">'+att.files.slice(0,10).map(a=>'<a class="msg-detail-file" href="'+esc(a.url)+'" target="_blank" rel="noopener"><i class="fas fa-file-alt"></i><span><strong>'+esc(a.name||'File')+'</strong><small>'+esc(a.size?formatFileSize(a.size):'Open file')+'</small></span><i class="fas fa-arrow-up-right-from-square"></i></a>').join('')+'</div>'
      : '<div class="msg-detail-empty">No files shared yet</div>';
    const audio = att.audio.length
      ? '<div class="msg-detail-list">'+att.audio.slice(0,10).map(a=>'<div class="msg-detail-audio"><i class="fas fa-microphone"></i><span>'+esc(a.name||'Voice message')+'</span><audio controls src="'+esc(a.url)+'"></audio></div>').join('')+'</div>'
      : '<div class="msg-detail-empty">No voice messages yet</div>';
    return '<div class="msg-details-section"><div class="msg-details-title"><i class="fas fa-image"></i> Media</div>'+images+'</div>'+
      '<div class="msg-details-section"><div class="msg-details-title"><i class="fas fa-file"></i> Files</div>'+files+'</div>'+
      '<div class="msg-details-section"><div class="msg-details-title"><i class="fas fa-microphone"></i> Voice messages</div>'+audio+'</div>';
  }

  function renderDetailsHtml(mobile){
    const conv=activeConvData;
    const peer=activePeerInfo || { id:'', name:'Conversation', avatar:'' };
    const name=displayName(peer.id, peer.name || 'Conversation');
    const href=peerHref(peer, conv);
    const isBizPeer = !!(conv && conv.forBusiness && !_activeBizId && conv.businessId) || peer.type==='business';
    const context=conversationContextLabel(conv);
    const active=activeLabelFromLastSeen(peer.lastSeen);
    const mutedUntil = convSettings && convSettings.mutedUntil;
    const mutedMs = mutedUntil && mutedUntil.toMillis ? mutedUntil.toMillis() : Number(mutedUntil||0);
    const muted = !!(mutedUntil && (!mutedMs || mutedMs > Date.now()));
    const att=detailAttachments();
    const currentTheme = THEMES.find(t=>t.v === (convTheme || '')) || THEMES.find(t=>t.v === (convTheme || DEFAULT_THEME)) || THEMES[0];
    const themeVal = convTheme || DEFAULT_THEME;
    const themeColors = themeVal.split(',').map(c=>esc(c.trim())).join(',');
    const avatar = peer.avatar ? '<img class="info-big-av" src="'+esc(peer.avatar)+'" alt="" onerror="this.style.display=\'none\'">' : '<div class="info-big-av info-av-icon">'+esc(initials(name))+'</div>';
    return (mobile ? '<div class="msg-mobile-details-head"><button type="button" class="msg-mobile-details-close" onclick="window.__ghCloseMobileInfoSheet()"><i class="fas fa-arrow-left"></i></button><strong>Conversation details</strong></div>' : '')+
      '<div class="info-top msg-details-top">'+avatar+
        '<div class="info-name">'+esc(name)+'</div>'+
        '<div class="info-type-badge">'+esc(context)+'</div>'+
        (active?'<div class="info-online-row"><span class="active-dot"></span>'+esc(active)+'</div>':'')+
      '</div>'+
      '<div class="msg-details-actions">'+
        '<a class="info-action-btn" href="'+esc(href)+'"><i class="fas '+(isBizPeer?'fa-store':'fa-user')+'"></i> '+(isBizPeer?'View Page':'View Profile')+'</a>'+
        '<button type="button" class="info-action-btn" onclick="window.__ghToggleSearch();window.__ghCloseMobileInfoSheet&&window.__ghCloseMobileInfoSheet();"><i class="fas fa-search"></i> Search in conversation</button>'+
        '<button type="button" class="info-action-btn" onclick="window.__ghToggleActiveMute()"><i class="fas '+(muted?'fa-bell':'fa-bell-slash')+'"></i> '+(muted?'Unmute':'Mute')+'</button>'+
      '</div>'+
      '<div class="msg-details-section"><div class="msg-details-title"><i class="fas fa-palette"></i> Customize chat</div>'+
        '<button type="button" class="msg-details-row" onclick="window.__ghShowThemePicker(this)"><span>Theme/color <small class="msg-theme-current"><span class="msg-theme-dot" style="background:linear-gradient(135deg,'+themeColors+')"></span>'+esc(currentTheme.label)+'</small></span><i class="fas fa-chevron-right"></i></button>'+
        '<button type="button" class="msg-details-row" onclick="window.__ghShowNicknames()"><span>Nicknames</span><i class="fas fa-chevron-right"></i></button>'+
      '</div>'+
      renderDetailMedia(att)+
      '<div class="msg-details-section"><div class="msg-details-title"><i class="fas fa-ellipsis-h"></i> Conversation actions</div>'+
        '<button type="button" class="msg-details-row" onclick="window.__ghArchiveActiveConversation()"><span>Archive / Hide</span><i class="fas fa-box-archive"></i></button>'+
        '<button type="button" class="msg-details-row danger" onclick="window.__ghDeleteActiveConversation()"><span>Delete for me</span><i class="fas fa-trash"></i></button>'+
      '</div>';
  }

  function renderConversationDetails(){
    const panel=$('#infoPanel');
    if(panel){
      const scroll=panel.querySelector('.info-scroll') || panel;
      scroll.innerHTML=activeConversation ? renderDetailsHtml(false) : '<div style="color:var(--text-muted);text-align:center;padding:40px 16px;font-size:0.85rem">Select a conversation to see details</div>';
      panel.hidden=false;
    }
    const sheet=$('#mobileInfoSheet');
    if(sheet && document.body.classList.contains('msg-details-open') && activeConversation){
      const body=sheet.querySelector('.msg-mobile-details-body') || sheet;
      body.innerHTML=renderDetailsHtml(true);
    }
  }

  function ensureMobileInfoSheet(){
    let backdrop=$('#mobileInfoBackdrop');
    if(!backdrop){
      backdrop=document.createElement('div');
      backdrop.id='mobileInfoBackdrop';
      backdrop.className='msg-mobile-details-backdrop';
      backdrop.onclick=closeMobileInfoSheet;
      document.body.appendChild(backdrop);
    }
    let sheet=$('#mobileInfoSheet');
    if(!sheet){
      sheet=document.createElement('div');
      sheet.id='mobileInfoSheet';
      sheet.className='msg-mobile-details';
      sheet.innerHTML='<div class="msg-mobile-details-body"></div>';
      document.body.appendChild(sheet);
    }
    return sheet;
  }

  function openMobileInfoSheet(){
    if(!activeConversation) return;
    const sheet=ensureMobileInfoSheet();
    const body=sheet.querySelector('.msg-mobile-details-body') || sheet;
    body.innerHTML=renderDetailsHtml(true);
    document.body.classList.add('msg-details-open');
  }

  function closeMobileInfoSheet(){
    document.body.classList.remove('msg-details-open');
  }

  function convTime(val){
    if(!val) return '';
    const ms = val && val.toMillis ? val.toMillis() : (val && val.seconds ? val.seconds*1000 : Number(val||0));
    if(!ms) return '';
    const diff = Date.now() - ms;
    if(diff < 60000) return 'now';
    if(diff < 3600000) return Math.floor(diff/60000)+'m';
    if(diff < 86400000) return Math.floor(diff/3600000)+'h';
    const d = new Date(ms);
    return (d.getMonth()+1)+'/'+(d.getDate());
  }

  function tsMillis(val){
    return val && val.toMillis ? val.toMillis() : (val && val.seconds ? val.seconds*1000 : Number(val||0));
  }

  function activeLabelFromLastSeen(val){
    const ms = tsMillis(val);
    if(!ms) return '';
    const diff = Date.now() - ms;
    if(diff < 5 * 60000) return 'Active recently';
    if(diff < 3600000) return 'Active '+Math.max(1, Math.floor(diff/60000))+'m ago';
    if(diff < 86400000) return 'Active '+Math.floor(diff/3600000)+'h ago';
    return '';
  }

  function actorLabel(actorId, convData){
    if(!actorId) return 'Someone';
    if(actorId.startsWith('business_')){
      const bid = actorId.slice(9);
      if(convData && convData.businessId === bid) return convData.businessName || 'Business';
      return 'Business';
    }
    if(actorId.startsWith('user_')){
      const uid = actorId.slice(5);
      if(uid === currentUid()) return 'You';
      return convNicknames[uid] || _userCache[uid]?.name || 'Someone';
    }
    return convNicknames[actorId] || _userCache[actorId]?.name || 'Someone';
  }

  function typingActorMeta(){
    const actorId = currentActorId();
    if(actorId.startsWith('business_')){
      return { actorId, name:_activeBizTitle || activeConvData?.businessName || 'Business', avatar:_activeBizLogo || activeConvData?.businessLogo || '' };
    }
    const user = window.GeoFirebase?.auth?.currentUser;
    return { actorId, name:user?.displayName || (user?.email ? user.email.split('@')[0] : 'GeoHub User'), avatar:user?.photoURL || '' };
  }

  function typingTime(value){
    if(value && typeof value === 'object' && !value.toMillis && !value.seconds) return tsMillis(value.at);
    return tsMillis(value);
  }

  function renderReplyQuote(m){
    if(!m.replyTo) return '';
    return '<div class="msg-reply-quote"><span class="msg-reply-quote-name">'+esc(m.replyTo.senderName||'User')+'</span>'
      + '<span class="msg-reply-quote-text">'+esc((m.replyTo.text||'').slice(0,60))+'</span></div>';
  }

  function isMineMsg(m){
    const uid = currentUid();
    const aid = currentActorId();
    // 1. Canonical Phase 57: senderActorId === 'user_{uid}' or 'business_{bizId}'
    if (m.senderActorId && m.senderActorId.includes('_')) return m.senderActorId === aid;
    // 2. Phase 56 senderActorKey: 'business:bizId' / 'user:uid'
    if (m.senderActorKey) {
      return _activeBizId ? m.senderActorKey === 'business:' + _activeBizId : m.senderActorKey === 'user:' + uid;
    }
    // 3. Legacy: raw senderId / senderActorType
    if (_activeBizId) {
      return m.senderActorType === 'business'
        ? (m.senderActorId === _activeBizId)
        : (m.senderActorType == null && (m.senderId === uid || m.authorId === uid));
    }
    return m.senderId === uid || m.authorId === uid;
  }

  function legacyReceiptIcon(m){
    const uid = currentUid();
    const isMine = isMineMsg(m);
    if(!isMine) return '';
    const seenBy = Array.isArray(m.seenBy) ? m.seenBy.filter(id=>id!==uid) : [];
    if(seenBy.length) return '<span class="msg-receipt seen" title="Seen">✓✓</span>';
    if(m.delivered) return '<span class="msg-receipt delivered" title="Delivered">✓✓</span>';
    return '<span class="msg-receipt sent" title="Sent">✓</span>';
  }

  function receiptIcon(m){
    const actorId = currentActorId();
    const isMine = isMineMsg(m);
    if(!isMine) return '';
    const seenByActors = Array.isArray(m.seenByActors) ? m.seenByActors.filter(id=>id!==actorId) : [];
    const legacySeen = !seenByActors.length && Array.isArray(m.seenBy) ? m.seenBy.filter(id=>id!==currentUid()) : [];
    if(seenByActors.length || legacySeen.length) return '<span class="msg-receipt seen" title="Seen">Seen</span>';
    return '<span class="msg-receipt delivered" title="'+(m.delivered?'Delivered':'Sent')+'">✓</span>';
  }

  function applyTheme(theme){
    convTheme = theme || '';
    const effective = convTheme || DEFAULT_THEME;
    const parts = effective.split(',').map(c => c.trim()).filter(Boolean);
    const c1 = parts[0] || '#10b981';
    const c2 = parts[1] || c1;
    document.body.style.setProperty('--msg-theme-1', c1);
    document.body.style.setProperty('--msg-theme-2', c2);
    document.body.style.setProperty('--msg-theme-gradient', 'linear-gradient(135deg,'+c1+','+c2+')');
    const style = document.getElementById('convThemeStyle') || (() => {
      const s = document.createElement('style'); s.id='convThemeStyle'; document.head.appendChild(s); return s;
    })();
    style.textContent = 'body.page-messages .bubble-sent{background:var(--msg-theme-gradient)!important;color:#fff!important;}'
      + 'body.page-messages .send-btn:not(:disabled){background:var(--msg-theme-gradient)!important;color:#fff!important;}'
      + 'body.page-messages .header-action-btn:hover,body.page-messages .info-action-btn:hover,body.page-messages .msg-details-row:hover{border-color:var(--msg-theme-1)!important;color:var(--msg-theme-1)!important;}'
      + 'body.page-messages .gh-theme-swatch.active{border-color:#fff!important;box-shadow:0 0 0 2px var(--msg-theme-1),0 10px 24px rgba(0,0,0,.28)!important;}';
  }

  function renderMessages(items, filterText){
    const box=$('#chatMessages');
    if(!box) return;
    allMessages = items || [];
    renderConversationDetails();
    const uid=currentUid();
    const _myActorId = currentActorId();
    // Exclude messages deleted-for-me: check both canonical (deletedForActors) and legacy (deletedFor)
    let visible = allMessages.filter(m => {
      if(Array.isArray(m.deletedFor) && m.deletedFor.includes(uid)) return false;
      if(Array.isArray(m.deletedForActors) && m.deletedForActors.includes(_myActorId)) return false;
      return true;
    });
    if(filterText){
      const q = filterText.toLowerCase();
      visible = visible.filter(m=>(m.text||'').toLowerCase().includes(q));
    }
    if(!visible.length){
      box.innerHTML = filterText
        ? '<div class="chat-empty"><i class="fas fa-search"></i><p>No messages match "'+esc(filterText)+'"</p></div>'
        : '<div class="chat-empty"><i class="fas fa-comment-dots"></i><p>No messages yet. Say hello!</p></div>';
      return;
    }
    const wasAtBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    box.innerHTML=visible.map(m=>{
      const mine = isMineMsg(m);
      const summary = summarizeReactions(m.id);
      // deletedForEveryone: show placeholder; legacy deleted field also triggers placeholder
      const deleted = !!m.deleted || !!m.deletedForEveryone;
      const text = deleted ? '<em style="color:var(--text-muted,#64748b);font-style:italic">This message was deleted</em>' : esc(m.text||'');
      const media = deleted ? '' : renderMedia(m);
      const replyQuote = deleted ? '' : renderReplyQuote(m);
      const edited = (!deleted && m.edited) ? '<span class="msg-edited">(edited)</span>' : '';
      const receipt = mine ? receiptIcon(m) : '';
      // Context menu (right-click / touch-hold) on ALL non-deleted messages — menu options differ by ownership
      const contextAttr = !deleted ? ' oncontextmenu="return window.__ghMsgCtxMenu(event,\''+esc(m.id)+'\')" ontouchstart="window.__ghMsgTouchStart(event,\''+esc(m.id)+'\')" ontouchend="window.__ghMsgTouchEnd(event)"' : '';
      // 3-dot button: visible on hover, only for non-deleted messages
      const dotsBtn = !deleted
        ? '<button class="msg-dots-btn" type="button" title="Message options" onclick="event.stopPropagation();return window.__ghMsgCtxMenu(event,\''+esc(m.id)+'\')"><i class="fas fa-ellipsis-h"></i></button>'
        : '';
      const reactionSummary = (!deleted && summary.badges)
        ? '<div class="msg-reaction-summary">'+summary.badges+'</div>'
        : '';
      return '<div class="msg-row '+(mine?'sent':'received')+(deleted?' is-deleted':'')+'" data-message-id="'+esc(m.id)+'">'
        + '<div class="msg-col">'
        + '<div class="msg-bubble-wrap">'
        + '<div class="msg-bubble '+(mine?'bubble-sent':'bubble-recv')+'"'+contextAttr+'>'
        + replyQuote
        + (text?'<div class="msg-text">'+text+'</div>':'')
        + media
        + (edited?'<div class="msg-edited-label">'+edited+'</div>':'')
        + '</div>'
        + '<div class="msg-actions">'
        + '<button class="msg-reply-btn" data-reply-btn title="Reply">↩</button>'
        + '<button class="msg-reaction-trigger '+(summary.mine?'active':'')+'" data-reaction-trigger type="button" title="React">'+(summary.mine?esc(summary.mine):'😊')+'</button>'
        + dotsBtn
        + '</div>'
        + '<div class="msg-reaction-picker" data-reaction-picker>'+REACTIONS.map(e=>'<button type="button" data-msg-reaction="'+esc(e)+'">'+esc(e)+'</button>').join('')+'</div>'
        + reactionSummary
        + '</div>'
        + '<div class="msg-meta-row">'
        + (receipt ? receipt : '')
        + '</div>'
        + '</div></div>';
    }).join('');

    if(wasAtBottom && !filterText) box.scrollTop=box.scrollHeight;

    markVisibleSeen(visible, uid);
  }

  function markVisibleSeen(visible, uid){
    if(!activeConversation || !uid) return;
    const actorId = currentActorId();
    const unseen = visible.filter(m => {
      if(isMineMsg(m)) return false;
      if(Array.isArray(m.seenByActors) && m.seenByActors.includes(actorId)) return false;
      if(!Array.isArray(m.seenByActors) && Array.isArray(m.seenBy) && m.seenBy.includes(uid)) return false;
      return true;
    }).map(m=>m.id);
    if(unseen.length && window.GeoSocial?.markMessagesSeen){
      window.GeoSocial.markMessagesSeen(activeConversation, unseen, null, { actorId });
    }
  }

  function applyMessageReactions(reactions){
    const grouped={};
    (reactions||[]).forEach(r=>{
      if(!r.messageId) return;
      grouped[r.messageId]=grouped[r.messageId]||{rows:[]};
      grouped[r.messageId].rows.push(r);
    });
    reactionState = grouped;
    document.querySelectorAll('[data-message-id]').forEach(row=>{
      const mid=row.dataset.messageId;
      const summary=summarizeReactions(mid);
      const trigger=row.querySelector('[data-reaction-trigger]');
      const summaryBox=row.querySelector('.msg-reaction-summary');
      if(trigger){ trigger.classList.toggle('active', !!summary.mine); trigger.textContent=summary.mine || '😊'; }
      if(summaryBox) summaryBox.innerHTML=summary.badges;
    });
  }

  async function toggleLegacyReaction(messageId, emoji){
    if(!activeConversation || !messageId) return;
    try{
      await window.GeoSocial.toggleMessageReaction(activeConversation, messageId, emoji || '❤️');
    }catch(err){
      window.showToast && window.showToast('Reaction failed');
    }
  }

  async function toggleReaction(messageId, emoji){
    if(!activeConversation || !messageId) return;
    const actorId = currentActorId();
    const uid = currentUid();
    const msg = (allMessages || []).find(m => m && m.id === messageId);
    if(!msg || msg.deleted || msg.deletedForEveryone) return;
    if(Array.isArray(msg.deletedFor) && msg.deletedFor.includes(uid)) return;
    if(Array.isArray(msg.deletedForActors) && msg.deletedForActors.includes(actorId)) return;
    try{
      await window.GeoSocial.toggleMessageReaction(activeConversation, messageId, emoji || '❤️', null, { actorId });
    }catch(err){
      console.error('[GeoHub Msg] Reaction failed', err);
      window.showToast && window.showToast('Reaction failed');
    }
  }

  function setReplyState(msg){
    replyState = msg;
    const bar = $('#replyPreviewBar');
    if(!bar) return;
    if(!msg){ bar.style.display='none'; bar.innerHTML=''; return; }
    bar.style.display='flex';
    bar.innerHTML='<div class="reply-preview-inner"><span class="reply-preview-name">'+esc(msg.senderName||'User')+'</span><span class="reply-preview-text">'+esc((msg.text||'').slice(0,60))+'</span></div>'
      + '<button class="reply-preview-close" type="button" onclick="window.__ghClearReply()">×</button>';
  }
  window.__ghClearReply = function(){ setReplyState(null); };

  function setupTyping(){
    const input = $('#msgInput') || $('#messageInput');
    if(!input || input._typingBound) return;
    input._typingBound = true;
    input.addEventListener('input', ()=>{
      if(!activeConversation) return;
      const text = (input.value || '').trim();
      const meta = typingActorMeta();
      if(!text){
        isTyping = false;
        lastTypingWrite = 0;
        clearTimeout(typingTimer);
        dbg('typing clear empty', { conversationId: activeConversation, currentActorId: meta.actorId });
        window.GeoSocial?.setTyping && window.GeoSocial.setTyping(activeConversation, false, meta);
        return;
      }
      const now = Date.now();
      if(!isTyping || now - lastTypingWrite > 1800){
        isTyping = true;
        lastTypingWrite = now;
        dbg('typing write', { conversationId: activeConversation, currentActorId: meta.actorId, payload: meta });
        window.GeoSocial?.setTyping && window.GeoSocial.setTyping(activeConversation, true, meta);
      }
      clearTimeout(typingTimer);
      typingTimer = setTimeout(()=>{
        isTyping = false;
        lastTypingWrite = 0;
        dbg('typing clear idle', { conversationId: activeConversation, currentActorId: meta.actorId });
        window.GeoSocial?.setTyping && window.GeoSocial.setTyping(activeConversation, false, meta);
      }, 4000);
    });
  }

  function handleTypingIndicator(convData){
    const actorId = currentActorId();
    const typingUsers = Object.assign({}, convData?.typingUsers || {}, convData?.typingActors || {});
    const now = Date.now();
    dbg('typing read', { conversationId: activeConversation, currentActorId: actorId, typingActors: convData?.typingActors || {}, typingUsers: convData?.typingUsers || {} });
    const active = Object.entries(typingUsers).filter(([id, entry])=>{
      if(id === actorId || id === currentUid()) return false;
      const t = typingTime(entry);
      return t && (now - t) < 5000;
    });
    dbg('typing active filtered', active);
    const indicator = $('#typingIndicator');
    if(!indicator) return;
    if(active.length){
      indicator.style.display='block';
      const entry = active[0][1];
      const label = entry && typeof entry === 'object' && entry.name ? entry.name : actorLabel(active[0][0], convData);
      indicator.innerHTML = '<div class="typing-name">'+esc(label)+' is typing...</div><div class="typing-bubble"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
    } else {
      indicator.style.display='none';
    }
  }

  function showContextMenu(x, y, items){
    document.querySelectorAll('.gh-ctx-menu').forEach(m=>m.remove());
    const menu = document.createElement('div');
    menu.className='gh-ctx-menu';
    menu.style.cssText='position:fixed;left:'+x+'px;top:'+y+'px;z-index:9999;background:var(--bg-card,#111827);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:6px;min-width:160px;box-shadow:0 12px 40px rgba(0,0,0,.5);';
    items.forEach(item=>{
      if(item.sep){ const s=document.createElement('div'); s.style.cssText='height:1px;background:rgba(255,255,255,.08);margin:4px 0;'; menu.appendChild(s); return; }
      const btn=document.createElement('button');
      btn.type='button';
      btn.style.cssText='display:flex;width:100%;gap:8px;align-items:center;padding:8px 12px;border-radius:8px;background:transparent;border:0;color:'+(item.danger?'#ef4444':'var(--gh-text,#f0f4ff)')+';font-size:.85rem;cursor:pointer;text-align:left;';
      btn.innerHTML=(item.icon?'<i class="fas '+item.icon+'" style="width:14px;text-align:center;opacity:.7"></i>':'')+esc(item.label);
      btn.onmouseenter=()=>btn.style.background='rgba(255,255,255,.06)';
      btn.onmouseleave=()=>btn.style.background='transparent';
      btn.onclick=()=>{ menu.remove(); item.action(); };
      menu.appendChild(btn);
    });
    document.body.appendChild(menu);
    const dismiss=e=>{ if(!menu.contains(e.target)){ menu.remove(); document.removeEventListener('click',dismiss,true); } };
    setTimeout(()=>document.addEventListener('click',dismiss,true), 50);
    const rect=menu.getBoundingClientRect();
    if(rect.right>window.innerWidth) menu.style.left=(window.innerWidth-rect.width-8)+'px';
    if(rect.bottom>window.innerHeight) menu.style.top=(y-rect.height)+'px';
  }

  window.__ghMsgCtxMenu = function(e, msgId){
    e.preventDefault();
    const msg=allMessages.find(m=>m.id===msgId);
    if(!msg) return false;
    const mine=isMineMsg(msg);
    const isDeleted=!!msg.deleted||!!msg.deletedForEveryone;
    const hasText=!!(msg.text&&!isDeleted);
    const opts=[];

    // Reply — always available (even on deleted messages shows quoted text)
    opts.push({icon:'fa-reply',label:'Reply',action:()=>{
      const convs=window.__geohubLastConvs||[];
      const conv=convs.find(c=>c.id===activeConversation);
      const oid=conv?otherId(conv):'';
      msg.senderName=mine?'You':(convNicknames[msg.senderId]||oid||'User');
      setReplyState(msg);
      const input=$('#msgInput')||$('#messageInput');
      if(input && !isMobileMsg()) input.focus();
    }});

    // Copy text
    if(hasText) opts.push({icon:'fa-copy',label:'Copy text',action:()=>{
      try{ navigator.clipboard.writeText(msg.text); window.showToast&&window.showToast('Copied'); }
      catch(err){ window.showToast&&window.showToast('Could not copy'); }
    }});

    // Edit (mine, non-deleted, has text)
    if(mine&&hasText) opts.push({icon:'fa-edit',label:'Edit',action:()=>startEdit(msgId,msg)});

    opts.push({sep:true});

    // Delete for me — always available on non-deleted messages
    opts.push({icon:'fa-eye-slash',label:'Delete for me',action:()=>{
      window.GeoSocial?.deleteMessage(activeConversation,msgId,'me',null,{actorId:currentActorId()});
    }});

    // Delete for everyone — only sender may do this
    if(mine&&!isDeleted) opts.push({icon:'fa-trash-alt',label:'Delete for everyone',danger:true,action:()=>{
      if(!confirm('Delete this message for everyone? This cannot be undone.')) return;
      window.GeoSocial?.deleteMessage(activeConversation,msgId,'everyone',null,{actorId:currentActorId()});
    }});

    showContextMenu(e.clientX,e.clientY,opts);
    return false;
  };

  let touchTimer = null;
  window.__ghMsgTouchStart = function(e, msgId){
    touchTimer = setTimeout(()=>{ const t=e.touches[0]; window.__ghMsgCtxMenu({preventDefault:()=>{},clientX:t.clientX,clientY:t.clientY,target:e.target}, msgId); }, 500);
  };
  window.__ghMsgTouchEnd = function(){ clearTimeout(touchTimer); };

  function startEdit(msgId, msg){
    const row = document.querySelector('[data-message-id="'+msgId+'"]');
    if(!row) return;
    const bubble = row.querySelector('.msg-bubble');
    if(!bubble) return;
    const oldText = msg.text || '';
    bubble.innerHTML='<textarea class="msg-edit-input">'+esc(oldText)+'</textarea>'
      + '<div class="msg-edit-actions"><button class="msg-edit-save" type="button">Save</button><button class="msg-edit-cancel" type="button">Cancel</button></div>';
    const ta = bubble.querySelector('.msg-edit-input');
    ta.focus(); ta.select();
    bubble.querySelector('.msg-edit-save').onclick=()=>{
      const newText=(ta.value||'').trim();
      if(newText && newText!==oldText) window.GeoSocial?.editMessage(activeConversation, msgId, newText);
    };
    bubble.querySelector('.msg-edit-cancel').onclick=()=>renderMessages(allMessages, getCurrentSearch());
  }

  function getCurrentSearch(){
    const bar=$('#msgSearchInput'); return bar && searchActive ? bar.value.trim() : '';
  }

  function toggleSearch(){
    searchActive = !searchActive;
    const wrap=$('#msgSearchWrap');
    if(!wrap) return;
    wrap.style.display = searchActive ? 'flex' : 'none';
    if(searchActive){ const inp=$('#msgSearchInput'); if(inp){ inp.value=''; inp.focus(); } }
    else { renderMessages(allMessages); }
  }

  function setupSearch(){
    const inp=$('#msgSearchInput');
    if(!inp || inp._searchBound) return;
    inp._searchBound=true;
    inp.oninput=()=>renderMessages(allMessages, inp.value.trim());
    inp.onkeydown=e=>{ if(e.key==='Escape') toggleSearch(); };
  }

  // ── Conversation action helpers ─────────────────────────────────────────────

  function closeChatPane(){
    if(!activeConversation) return;
    activeConversation=null; activeConvData=null; activePeerInfo=null;
    if(unsubMsgs){ try{unsubMsgs();}catch(er){} unsubMsgs=null; }
    if(unsubReactions){ try{unsubReactions();}catch(er){} unsubReactions=null; }
    if(unsubConvDoc){ try{unsubConvDoc();}catch(er){} unsubConvDoc=null; }
    if(unsubConvSettings){ try{unsubConvSettings();}catch(er){} unsubConvSettings=null; }
    const box=$('#chatMessages'), hdr=$('#chatHeader');
    if(box) box.innerHTML='<div class="chat-empty"><i class="fas fa-comment-dots"></i><p>Select a conversation</p></div>';
    if(hdr) hdr.innerHTML='';
    closeMobileInfoSheet();
    renderConversationDetails();
    setChatOpen(false);
  }

  function showConvActionToast(convId, label, actorKeyOld, actorKeyNew, isArchive){
    document.querySelectorAll('.gh-hide-undo-toast').forEach(t=>t.remove());
    const toast=document.createElement('div');
    toast.className='gh-hide-undo-toast';
    toast.innerHTML='<span>'+label+'</span><button class="gh-undo-btn" type="button">Undo</button>';
    document.body.appendChild(toast);
    requestAnimationFrame(()=>requestAnimationFrame(()=>toast.classList.add('show')));
    const timer=setTimeout(()=>{ toast.classList.remove('show'); setTimeout(()=>toast.remove(),300); }, 4500);
    toast.querySelector('.gh-undo-btn').onclick=()=>{
      clearTimeout(timer); toast.remove();
      const GF=window.GeoFirebase;
      if(!GF||!GF.fs||!GF.db) return;
      const patch={
        hiddenForActors:   GF.fs.arrayRemove(actorKeyOld, actorKeyNew||actorKeyOld),
        archivedForActors: GF.fs.arrayRemove(actorKeyNew||actorKeyOld),
        deletedForActors:  GF.fs.arrayRemove(actorKeyNew||actorKeyOld)
      };
      GF.fs.updateDoc(GF.fs.doc(GF.db,'conversations',convId), patch)
        .then(()=>window.showToast&&window.showToast('Conversation restored'))
        .catch(()=>window.showToast&&window.showToast('Could not undo'));
    };
  }

  function archiveConv(convId){
    const actorKeyOld = _activeBizId ? 'business:' + _activeBizId : 'user:' + currentUid();
    const actorKeyNew = currentActorId();
    const GF=window.GeoFirebase;
    if(!GF||!GF.fs||!GF.db) return;
    // Write to both archivedForActors (semantic) and hiddenForActors (listener filter)
    GF.fs.updateDoc(GF.fs.doc(GF.db,'conversations',convId),{
      archivedForActors: GF.fs.arrayUnion(actorKeyNew),
      hiddenForActors:   GF.fs.arrayUnion(actorKeyOld, actorKeyNew)
    }).then(()=>{
      if(activeConversation===convId) closeChatPane();
      showConvActionToast(convId,'Conversation archived',actorKeyOld,actorKeyNew,true);
    }).catch(()=>window.showToast&&window.showToast('Could not archive'));
  }

  function deleteConvForMe(convId){
    if(!confirm('Delete this conversation for you?\n\nThe other person may still see the chat history.')) return;
    const actorKeyOld = _activeBizId ? 'business:' + _activeBizId : 'user:' + currentUid();
    const actorKeyNew = currentActorId();
    const GF=window.GeoFirebase;
    if(!GF||!GF.fs||!GF.db) return;
    // deletedForActors: listener will exclude this conv for current actor
    // hiddenForActors: belt-and-suspenders so renderConvs also filters it
    GF.fs.updateDoc(GF.fs.doc(GF.db,'conversations',convId),{
      deletedForActors:  GF.fs.arrayUnion(actorKeyNew),
      hiddenForActors:   GF.fs.arrayUnion(actorKeyOld, actorKeyNew)
    }).then(()=>{
      if(activeConversation===convId) closeChatPane();
      showConvActionToast(convId,'Conversation deleted for you',actorKeyOld,actorKeyNew,false);
    }).catch(()=>window.showToast&&window.showToast('Could not delete conversation'));
  }

  function markConvUnread(convId, isCurrentlyUnread){
    const GF=window.GeoFirebase;
    if(!GF||!GF.fs||!GF.db) return;
    const actorKeyNew=currentActorId();
    GF.fs.updateDoc(GF.fs.doc(GF.db,'conversations',convId),{
      unreadActors: isCurrentlyUnread ? GF.fs.arrayRemove(actorKeyNew) : GF.fs.arrayUnion(actorKeyNew)
    }).then(()=>window.showToast&&window.showToast(isCurrentlyUnread?'Marked as read':'Marked as unread'))
      .catch(()=>{});
  }

  function togglePinConv(convId, isPinned){
    const GF=window.GeoFirebase;
    if(!GF||!GF.fs||!GF.db) return;
    const actorKeyNew=currentActorId();
    GF.fs.updateDoc(GF.fs.doc(GF.db,'conversations',convId),{
      pinnedForActors: isPinned ? GF.fs.arrayRemove(actorKeyNew) : GF.fs.arrayUnion(actorKeyNew)
    }).then(()=>window.showToast&&window.showToast(isPinned?'Unpinned':'Conversation pinned'))
      .catch(()=>{});
  }

  function muteConv(convId, duration){
    const label=duration>=28800000?'8 hours':'1 hour';
    window.GeoSocial?.setConversationMute&&window.GeoSocial.setConversationMute(convId,Date.now()+duration,
      ()=>window.showToast&&window.showToast('Muted '+label));
  }

  // 3-dot menu on conv rows (also used as right-click handler)
  function convOptionsMenu(e, convId){
    e.preventDefault();
    const conv=(window.__geohubLastConvs||[]).find(c=>c.id===convId)||{};
    const actorKeyNew=currentActorId();

    // Link to the other side's profile or business page
    let profileHref='', profileLabel='View profile';
    if(conv.forBusiness&&conv.businessId){
      if(_activeBizId){
        if(conv.customerUid) profileHref='profile.html?id='+esc(conv.customerUid);
      } else {
        profileHref='business.html?id='+esc(conv.businessId);
        profileLabel='View business page';
      }
    } else {
      const oid=otherId(conv);
      if(oid) profileHref='profile.html?id='+esc(oid);
    }

    const isPinned=Array.isArray(conv.pinnedForActors)&&conv.pinnedForActors.includes(actorKeyNew);
    const isUnread=Array.isArray(conv.unreadActors)&&(conv.unreadActors.includes(actorKeyNew)||
      (Array.isArray(conv.unreadFor)&&conv.unreadFor.includes(currentUid())));

    const opts=[];
    if(profileHref) opts.push({icon:'fa-user',label:profileLabel,action:()=>{location.href=profileHref;}});
    if(profileHref) opts.push({sep:true});
    opts.push({icon:'fa-box-archive',label:'Archive',action:()=>archiveConv(convId)});
    opts.push({icon:isUnread?'fa-envelope-open':'fa-envelope',label:isUnread?'Mark as read':'Mark as unread',action:()=>markConvUnread(convId,isUnread)});
    opts.push({icon:'fa-thumbtack',label:isPinned?'Unpin':'Pin',action:()=>togglePinConv(convId,isPinned)});
    opts.push({sep:true});
    opts.push({icon:'fa-bell-slash',label:'Mute 1 hour',action:()=>muteConv(convId,3600000)});
    opts.push({icon:'fa-bell-slash',label:'Mute 8 hours',action:()=>muteConv(convId,28800000)});
    opts.push({sep:true});
    opts.push({icon:'fa-trash',label:'Delete for me',danger:true,action:()=>deleteConvForMe(convId)});
    showContextMenu(e.clientX,e.clientY,opts);
    return false;
  }

  window.__ghConvDotsMenu = function(e, convId){ return convOptionsMenu(e, convId); };
  window.__ghConvCtxMenu  = function(e, convId){ return convOptionsMenu(e, convId); };

  function showThemePicker(anchor){
    if(!activeConversation) return;
    document.querySelectorAll('.gh-theme-picker').forEach(m=>m.remove());
    const picker=document.createElement('div');
    const inline = !!(anchor && anchor.closest && anchor.closest('.info-panel, .msg-mobile-details'));
    picker.className='gh-theme-picker' + (inline ? ' inline' : '');
    picker.innerHTML='<div class="gh-theme-title">Chat Theme</div>'
      + THEMES.map(t=>'<button type="button" class="gh-theme-swatch'+(((convTheme || DEFAULT_THEME)===t.v)?' active':'')+'" data-theme-val="'+esc(t.v)+'" style="background:linear-gradient(135deg,'+t.v.split(',').map(c=>esc(c)).join(',')+')" title="'+esc(t.label)+'" aria-label="'+esc(t.label)+'"></button>').join('')
      + '<button class="gh-theme-reset" data-theme-val="">Reset</button>';
    picker.querySelectorAll('[data-theme-val]').forEach(btn=>{
      btn.onclick=()=>{
        const val=btn.dataset.themeVal||'';
        const prevTheme = activeConvData && activeConvData.theme || '';
        applyTheme(val);
        activeConvData = Object.assign({}, activeConvData || {}, { theme: val });
        picker.querySelectorAll('.gh-theme-swatch').forEach(b=>b.classList.toggle('active', (b.dataset.themeVal || DEFAULT_THEME) === (val || DEFAULT_THEME)));
        renderConversationDetails();
        window.GeoSocial?.setConversationTheme(activeConversation, val, ok=>{
          if(ok){
            if(!inline) picker.remove();
          } else {
            applyTheme(prevTheme);
            activeConvData = Object.assign({}, activeConvData || {}, { theme: prevTheme });
            renderConversationDetails();
            window.showToast && window.showToast('Theme update failed');
          }
        });
      };
    });
    if(inline && anchor){
      anchor.insertAdjacentElement('afterend', picker);
    } else {
      const header=$('#chatHeader');
      if(header) header.appendChild(picker);
      const dismiss=e=>{ if(!picker.contains(e.target)){ picker.remove(); document.removeEventListener('click',dismiss,true); } };
      setTimeout(()=>document.addEventListener('click',dismiss,true),50);
    }
  }

  function showNicknamePanel(){
    if(!activeConvData) return;
    const uid=currentUid();
    const participants=activeConvData.participants||[];
    const items=participants.map(pid=>{
      const current=convNicknames[pid]||'';
      return '<div class="gh-nickname-row"><span class="gh-nickname-uid">'+esc(pid===uid?'You':pid.slice(0,8))+'</span>'
        +'<input class="gh-nickname-input" data-nick-uid="'+esc(pid)+'" value="'+esc(current)+'" placeholder="Nickname…" maxlength="30"></div>';
    }).join('');
    const modal=document.createElement('div');
    modal.className='gh-nick-modal';
    modal.innerHTML='<div class="gh-nick-card"><button class="gh-nick-close" type="button">×</button><h3>Nicknames</h3>'+items
      +'<button class="gh-nick-save btn" type="button">Save</button></div>';
    modal.querySelector('.gh-nick-close').onclick=()=>modal.remove();
    modal.querySelector('.gh-nick-save').onclick=()=>{
      modal.querySelectorAll('[data-nick-uid]').forEach(inp=>{
        window.GeoSocial?.setConversationNickname(activeConversation, inp.dataset.nickUid, inp.value.trim());
      });
      modal.remove();
      window.showToast&&window.showToast('Nicknames saved');
    };
    document.body.appendChild(modal);
  }

  function buildHeader(u, conv){
    const header=$('#chatHeader');
    if(!header) return;
    const bizCtx = _activeBizId
      ? '<div class="biz-reply-ctx"><i class="fas fa-store"></i> Replying as <strong>'+esc(_activeBizTitle||'Business')+'</strong></div>'
      : (activeLabelFromLastSeen(u && u.lastSeen) ? '<div class="header-online"><span class="active-dot"></span>'+esc(activeLabelFromLastSeen(u.lastSeen))+'</div>' : '');
    header.innerHTML=
      '<div class="chat-header-left">'
      +'<button class="back-btn" onclick="ghChatBack()" title="Back"><i class="fas fa-arrow-left"></i></button>'
      +'<div class="chat-header-av">'+(u.avatar?'<img src="'+esc(u.avatar)+'" alt="" onerror="this.style.display=\'none\'">':'<div class="av-placeholder">'+esc(initials(u.name))+'</div>')+'</div>'
      +'<div><div class="chat-header-name">'+esc(displayName(u.id, u.name))+'</div>'+bizCtx+'</div>'
      +'</div>'
      +'<div class="chat-header-actions">'
      +'<button class="header-action-btn" title="Search" id="msgSearchBtn" onclick="window.__ghToggleSearch()"><i class="fas fa-search"></i></button>'
      +'<button class="header-action-btn" title="Theme" onclick="window.__ghShowThemePicker(this)"><i class="fas fa-palette"></i></button>'
      +'<button class="header-action-btn" title="Nicknames" onclick="window.__ghShowNicknames()"><i class="fas fa-user-tag"></i></button>'
      +'<button class="header-action-btn mobile-info-btn" title="Info" onclick="window.__ghToggleInfoPanel()"><i class="fas fa-info-circle"></i></button>'
      +'</div>';
  }

  window.__ghToggleSearch = toggleSearch;
  window.__ghShowThemePicker = showThemePicker;
  window.__ghShowNicknames = showNicknamePanel;
  window.__ghToggleInfoPanel = function(){
    const panel=$('#infoPanel');
    if(isMobileMsg()){
      if(panel){
        panel.classList.remove('open', 'panel-visible');
        panel.style.display='none';
        panel.hidden=true;
      }
      openMobileInfoSheet();
      return;
    }
    if(panel) panel.hidden=false;
    renderConversationDetails();
    if(panel) panel.classList.toggle('open');
  };
  window.__ghCloseMobileInfoSheet = closeMobileInfoSheet;
  window.__ghToggleActiveMute = function(){
    if(!activeConversation || !window.GeoSocial?.setConversationMute) return;
    const mutedUntil = convSettings && convSettings.mutedUntil;
    const mutedMs = mutedUntil && mutedUntil.toMillis ? mutedUntil.toMillis() : Number(mutedUntil||0);
    const muted = !!(mutedUntil && (!mutedMs || mutedMs > Date.now()));
    const next = muted ? null : Date.now() + 30*24*60*60*1000;
    window.GeoSocial.setConversationMute(activeConversation, next, ok=>{
      if(ok){
        convSettings = Object.assign({}, convSettings, { mutedUntil: next });
        renderConversationDetails();
        window.showToast && window.showToast(muted?'Conversation unmuted':'Conversation muted');
      }
    });
  };
  window.__ghArchiveActiveConversation = function(){ if(activeConversation) archiveConv(activeConversation); };
  window.__ghDeleteActiveConversation = function(){ if(activeConversation) deleteConvForMe(activeConversation); };

  async function openConversation(cid){
    activeConversation=cid;
    setChatOpen(true);
    closeMobileInfoPanel();
    document.querySelector('#infoPanel')?.classList.remove('open');
    document.querySelectorAll('.conv-item').forEach(el=>{
      el.classList.toggle('active', el.dataset.convId===cid);
    });

    // Unhide for current actor when any conv is explicitly opened.
    // Covers: archive → re-open, delete-for-me → re-open, any hidden conv navigated to.
    // Also force-patches the local conv list so the left sidebar refreshes instantly
    // without waiting for the Firestore listener round-trip.
    {
      const _oGF = window.GeoFirebase;
      if (_oGF && _oGF.fs && _oGF.db) {
        const _oOld = _activeBizId ? 'business:' + _activeBizId : 'user:' + currentUid();
        const _oNew = currentActorId();
        _oGF.fs.updateDoc(_oGF.fs.doc(_oGF.db, 'conversations', cid), {
          hiddenForActors:   _oGF.fs.arrayRemove(_oOld, _oNew),
          archivedForActors: _oGF.fs.arrayRemove(_oNew),
          deletedForActors:  _oGF.fs.arrayRemove(_oNew)
        }).catch(()=>{});
      }
      // Instant local patch: remove actor from hidden arrays in the cached list
      const _lc = window.__geohubLastConvs;
      if (Array.isArray(_lc)) {
        const _li = _lc.findIndex(c => c.id === cid);
        if (_li >= 0) {
          _lc[_li] = Object.assign({}, _lc[_li], {
            hiddenForActors: [], archivedForActors: [], deletedForActors: []
          });
        }
      }
    }

    if(unsubMsgs){ unsubMsgs(); unsubMsgs=null; }
    if(unsubReactions){ unsubReactions(); unsubReactions=null; }
    if(unsubConvSettings){ unsubConvSettings(); unsubConvSettings=null; }
    if(unsubConvDoc){ unsubConvDoc(); unsubConvDoc=null; }

    isTyping=false;
    clearTimeout(typingTimer);
    setReplyState(null);
    searchActive=false;
    const wrap=$('#msgSearchWrap'); if(wrap) wrap.style.display='none';

    const box=$('#chatMessages');
    if(box) box.innerHTML='<div class="chat-empty"><i class="fas fa-circle-notch fa-spin"></i><p>Loading messages…</p></div>';

    const convs = window.__geohubLastConvs || [];
    const conv = convs.find(x => x.id === cid) || null;
    activeConvData = conv;
    convNicknames = conv?.nicknames || {};
    applyTheme(conv?.theme || '');
    let oid, u;
    if(_activeBizId && conv && conv.forBusiness){
      // Business inbox: header shows customer info
      oid = conv.customerUid || otherId(conv) || '';
      u = oid ? await userInfo(oid) : { id: '', name: 'Customer', avatar: '' };
    } else if(conv && conv.forBusiness && conv.businessId){
      // Personal inbox or withBiz mode: show the business/page as the contact — not the owner's profile
      oid = conv.businessId;
      u = { id: conv.businessId, name: conv.businessName || _withBizTitle || 'Business', avatar: conv.businessLogo || _withBizLogo || '' };
    } else {
      oid = conv ? otherId(conv) : '';
      u = await userInfo(oid);
    }
    activePeerInfo = Object.assign({}, u, { type: (conv && conv.forBusiness && !_activeBizId) ? 'business' : 'user' });
    buildHeader(u, conv);
    renderConversationDetails();

    const GF = window.GeoFirebase;
    if(GF){
      unsubConvDoc = GF.fs.onSnapshot(GF.fs.doc(GF.db,'conversations',cid), snap=>{
        const data = snap.exists() ? snap.data()||{} : {};
        activeConvData = Object.assign({id:cid}, data);
        convNicknames = data.nicknames || {};
        applyTheme(data.theme||'');
        handleTypingIndicator(data);
        buildHeader(u, activeConvData);
        renderConversationDetails();
      }, ()=>{});
    }

    if(window.GeoSocial?.listenConversationSettings){
      unsubConvSettings = window.GeoSocial.listenConversationSettings(cid, settings=>{
        convSettings = settings || {};
        renderConversationDetails();
      });
    }

    unsubMsgs=window.GeoSocial.listenMessages(cid, items=>renderMessages(items, getCurrentSearch()));
    if(window.GeoSocial.listenMessageReactions) unsubReactions=window.GeoSocial.listenMessageReactions(cid, applyMessageReactions);
    try{ window.GeoSocial.markConversationRead && window.GeoSocial.markConversationRead(cid, ()=>{
      document.querySelectorAll('.conv-item[data-conv-id="'+cid+'"]').forEach(el=>el.classList.remove('has-unread'));
      const dot=document.querySelector('.conv-item[data-conv-id="'+cid+'"] .conv-unread-dot');
      if(dot) dot.remove();
    }, { actorId: currentActorId() }); }catch(e){}
    // Also clear actor-level unread (unreadActors array) — remove both old and new format during transition
    try{
      const _rGF = window.GeoFirebase;
      if(_rGF && _rGF.fs && _rGF.db){
        const _uid2 = currentUid();
        const _actorKeyOld2 = _activeBizId ? 'business:' + _activeBizId : 'user:' + _uid2;
        const _actorKeyNew2 = currentActorId();
        _rGF.fs.updateDoc(_rGF.fs.doc(_rGF.db,'conversations',cid), {
          unreadActors: _rGF.fs.arrayRemove(_actorKeyOld2, _actorKeyNew2),
          updatedAt: _rGF.fs.serverTimestamp()
        }).catch(()=>{});
      }
    }catch(e){}
    renderComposer();
  }

  function setupEmojiPicker(){
    const picker=$('#emojiPicker');
    const input=$('#msgInput') || $('#messageInput');
    if(!picker || !input) return;
    if(!picker.dataset.ready){
      picker.innerHTML = EMOJIS.map(e=>'<button type="button" class="emoji-btn" data-emoji="'+esc(e)+'">'+esc(e)+'</button>').join('');
      picker.dataset.ready='1';
      picker.addEventListener('click', e=>{
        const btn=e.target.closest('[data-emoji]');
        if(!btn) return;
        input.value += btn.dataset.emoji;
        input.focus();
      });
    }
  }

  async function uploadSelectedImage(file){
    if(!file) return '';
    if(!file.type || !file.type.startsWith('image/')){
      window.showToast && window.showToast('Only image upload is supported');
      return '';
    }
    if(file.size > 8 * 1024 * 1024){
      window.showToast && window.showToast('Image must be under 8 MB');
      return '';
    }
    const dataUrl = await new Promise((resolve,reject)=>{
      const r=new FileReader();
      r.onload=()=>resolve(String(r.result||''));
      r.onerror=reject;
      r.readAsDataURL(file);
    });
    return await window.GeoSocial.uploadImageDataUrl(dataUrl, 'messages');
  }

  function setAttachmentBusy(busy, label){
    uploadingAttachment = !!busy;
    const sendBtn = $('.send-btn') || $('#messageSendBtn');
    const input = $('#msgInput') || $('#messageInput');
    const buttons = document.querySelectorAll('#attachmentMenuBtn,[data-pick-image],#fileAttachBtn,#voiceBtn');
    buttons.forEach(btn=>{ btn.disabled = !!busy; btn.classList.toggle('is-busy', !!busy); });
    if(sendBtn){
      sendBtn.disabled = !!busy || !(input && input.value.trim());
      sendBtn.classList.toggle('is-busy', !!busy);
      sendBtn.title = busy ? (label || 'Uploading...') : 'Send';
    }
  }

  function attachmentFromUpload(type, url, file, extra){
    return Object.assign({
      type,
      url,
      name: file?.name || (type === 'audio' ? 'Voice message' : ''),
      size: file?.size || 0,
      mime: file?.type || '',
      createdAt: Date.now()
    }, extra || {});
  }

  async function uploadSelectedFile(file){
    if(!file) return null;
    const allowed = /\.(pdf|doc|docx|txt|xls|xlsx|csv)$/i;
    if(!allowed.test(file.name)){
      window.showToast&&window.showToast('Allowed: PDF, DOC, TXT, XLS, CSV');
      return null;
    }
    if(file.size > 10*1024*1024){
      window.showToast&&window.showToast('File must be under 10 MB');
      return null;
    }
    const uid=currentUid();
    window.showToast&&window.showToast('Uploading file…');
    const url = await window.GeoSocial.uploadDocumentBlob(file, file.name, uid);
    if(!url){ window.showToast&&window.showToast('Upload failed'); return null; }
    const attachment = attachmentFromUpload('file', url, file);
    return { mediaUrl:url, type:'file', fileName:file.name, fileSize:file.size, attachments:[attachment] };
  }

  function startVoiceRecording(){
    if(mediaRecorder && mediaRecorder.state==='recording') return;
    navigator.mediaDevices.getUserMedia({audio:true}).then(stream=>{
      audioChunks=[];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable=e=>{ if(e.data.size>0) audioChunks.push(e.data); };
      mediaRecorder.onstop=async()=>{
        stream.getTracks().forEach(t=>t.stop());
        const duration = (Date.now()-recordingStart)/1000;
        const blob = new Blob(audioChunks, {type:'audio/webm'});
        if(!activeConversation) return;
        window.showToast&&window.showToast('Uploading voice…');
        setAttachmentBusy(true, 'Uploading voice...');
        const uid=currentUid();
        try{
          const url = await window.GeoSocial.uploadAudioBlob(blob, uid);
          setAttachmentBusy(false);
          if(url) await sendCurrentMsg({ mediaUrl:url, type:'audio', duration, attachments:[attachmentFromUpload('audio', url, { name:'voice.webm', size:blob.size, type:blob.type }, { duration })] });
          else window.showToast&&window.showToast('Voice upload failed');
        }catch(err){
          window.showToast&&window.showToast('Voice upload failed');
        }finally{
          setAttachmentBusy(false);
        }
      };
      recordingStart=Date.now();
      mediaRecorder.start();
      updateVoiceBtn(true);
      recordingTimer=setTimeout(()=>stopVoiceRecording(), 120000);
    }).catch(()=>window.showToast&&window.showToast('Microphone access denied'));
  }

  function stopVoiceRecording(){
    clearTimeout(recordingTimer);
    if(mediaRecorder && mediaRecorder.state==='recording'){
      mediaRecorder.stop();
    }
    updateVoiceBtn(false);
  }

  function updateVoiceBtn(recording){
    const btn=$('#voiceBtn');
    if(!btn) return;
    if(recording){
      btn.classList.add('recording');
      btn.innerHTML='<i class="fas fa-stop-circle"></i><span>Stop</span>';
      btn.title='Stop recording';
    } else {
      btn.classList.remove('recording');
      btn.innerHTML='<i class="fas fa-microphone"></i><span>Voice</span>';
      btn.title='Hold to record voice';
    }
  }

  function closeAttachmentSheet(){
    const sheet=$('#msgAttachSheet'), btn=$('#attachmentMenuBtn');
    if(sheet){
      sheet.classList.remove('open');
      sheet.setAttribute('aria-hidden','true');
    }
    if(btn) btn.setAttribute('aria-expanded','false');
  }

  window.__ghToggleAttachSheet = function(e){
    if(e) e.preventDefault();
    const sheet=$('#msgAttachSheet'), btn=$('#attachmentMenuBtn');
    if(!sheet) return;
    const open=!sheet.classList.contains('open');
    sheet.classList.toggle('open', open);
    sheet.setAttribute('aria-hidden', open ? 'false' : 'true');
    if(btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  let sendCurrentMsg = null;

  function renderComposer(){
    const input = $('#msgInput') || $('#messageInput');
    const sendBtn = $('.send-btn') || $('#messageSendBtn');
    if(!input) return;
    setupEmojiPicker();
    setupSearch();
    setupTyping();
    const attachBtn=$('#attachmentMenuBtn');
    const attachSheet=$('#msgAttachSheet');
    if(attachBtn && attachSheet && !attachBtn._rmBound){
      attachBtn._rmBound=true;
      attachBtn.onclick=e=>{
        window.__ghToggleAttachSheet(e);
      };
      attachSheet.addEventListener('click', e=>{
        if(e.target.closest('button')) setTimeout(closeAttachmentSheet, 0);
      });
    }

    async function doSend(extra){
      if(sendingMessage || uploadingAttachment) return;
      const text=(input?.value||'').trim();
      const hasAttachment = !!(extra && (extra.mediaUrl || (Array.isArray(extra.attachments) && extra.attachments.length)));
      if((!text && !hasAttachment) || !activeConversation) return;
      sendingMessage = true;
      if(sendBtn) sendBtn.disabled = true;

      const payload = Object.assign({}, extra||{});
      // Attach sender actor context — use canonical 'business_{bizId}' / 'user_{uid}' format
      if(_activeBizId){
        payload.senderActorType = 'business';
        payload.senderActorId = 'business_' + _activeBizId;
        payload.businessId = _activeBizId;
        payload.senderDisplayName = _activeBizTitle || 'Business';
        payload.senderName = _activeBizTitle || 'Business';
        payload.senderAvatar = _activeBizLogo || '';
      } else {
        payload.senderActorType = 'user';
        payload.senderActorId = 'user_' + currentUid();
        payload.senderAvatar = (_userCache[currentUid()] || {}).avatar || '';
      }
      if(replyState){
        payload.replyTo = {
          messageId: replyState.id,
          text: (replyState.text||'').slice(0,50),
          senderName: replyState.senderName||replyState.senderId||'User'
        };
        setReplyState(null);
      }

      if(isTyping){
        isTyping=false;
        clearTimeout(typingTimer);
        const meta = typingActorMeta();
        dbg('typing clear send', { conversationId: activeConversation, currentActorId: meta.actorId });
        window.GeoSocial?.setTyping && window.GeoSocial.setTyping(activeConversation, false, meta);
      }

      const _sendConvId = activeConversation;
      window.GeoSocial.sendMessage(activeConversation, text, ok=>{
        if(ok && input) input.value='';
        if(sendBtn) sendBtn.disabled = uploadingAttachment || !(input && input.value.trim());
        closeAttachmentSheet();
        const picker=$('#emojiPicker'); if(picker) picker.style.display='none';
        setTimeout(()=>{ sendingMessage=false; }, 350);
        // Force-restore the conv in the left sidebar instantly after send.
        // sendMessage already patches Firestore (removes from hiddenForActors etc.),
        // but the Firestore listener may not have fired yet. Push the conv back
        // locally so the sidebar reflects it without a perceptible delay.
        if(ok && _sendConvId && activeConvData) {
          const _sl = window.__geohubLastConvs || [];
          const _si = _sl.findIndex(c => c.id === _sendConvId);
          if(_si < 0) {
            // Conv was filtered out (hidden) — add it back immediately
            const _sr = Object.assign({}, activeConvData, {
              hiddenForActors: [], archivedForActors: [], deletedForActors: []
            });
            window.__geohubLastConvs = [_sr, ..._sl];
            renderConvs(window.__geohubLastConvs);
          } else if(Array.isArray(_sl[_si].hiddenForActors) && _sl[_si].hiddenForActors.length) {
            _sl[_si] = Object.assign({}, _sl[_si], {
              hiddenForActors: [], archivedForActors: [], deletedForActors: []
            });
            renderConvs(window.__geohubLastConvs);
          }
        }
      }, payload);
      setTimeout(()=>{ sendingMessage=false; if(sendBtn) sendBtn.disabled=uploadingAttachment || !(input&&input.value.trim()); }, 4500);
    }

    sendCurrentMsg = doSend;
    window.sendMsg = () => doSend();
    window.toggleEmojiPicker = function(){
      setupEmojiPicker();
      const p=$('#emojiPicker'); if(!p) return;
      p.style.display = p.style.display==='flex' ? 'none' : 'flex';
    };

    if(input && !input._rmBound){
      input._rmBound = true;
      input.onkeydown=e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); doSend(); } };
      input.addEventListener('input', ()=>{ if(sendBtn) sendBtn.disabled = uploadingAttachment || !input.value.trim(); });
    }
    if(sendBtn && !sendBtn._rmBound){
      sendBtn._rmBound = true;
      sendBtn.onclick=e=>{ e.preventDefault(); doSend(); };
      sendBtn.disabled = uploadingAttachment || !(input && input.value.trim());
    }
    document.querySelectorAll('[data-toggle-emoji]').forEach(btn=>{ if(!btn._rmBound){ btn._rmBound=true; btn.onclick=window.toggleEmojiPicker; } });
    document.querySelectorAll('[data-pick-image]').forEach(btn=>{ if(!btn._rmBound){ btn._rmBound=true; btn.onclick=()=>$('#messageImageInput')?.click(); } });

    const fileInput=$('#messageImageInput');
    if(fileInput && !fileInput._rmBound){
      fileInput._rmBound=true;
      fileInput.onchange=async()=>{
        const file=fileInput.files && fileInput.files[0];
        fileInput.value='';
        if(!file || !activeConversation) return;
        try{
          setAttachmentBusy(true, 'Uploading photo...');
          window.showToast && window.showToast('Uploading photo...');
          const url=await uploadSelectedImage(file);
          setAttachmentBusy(false);
          if(url) await doSend({ mediaUrl:url, mediaType:'image', attachments:[attachmentFromUpload('image', url, file)] });
        }catch(err){
          window.showToast && window.showToast('Image upload failed');
        }finally{
          setAttachmentBusy(false);
        }
      };
    }

    const docInput=$('#messageFileInput');
    if(docInput && !docInput._rmBound){
      docInput._rmBound=true;
      docInput.onchange=async()=>{
        const file=docInput.files && docInput.files[0];
        docInput.value='';
        if(!file || !activeConversation) return;
        try{
          setAttachmentBusy(true, 'Uploading file...');
          window.showToast && window.showToast('Uploading file...');
          const extra=await uploadSelectedFile(file);
          setAttachmentBusy(false);
          if(extra) await doSend(extra);
        }catch(err){
          window.showToast && window.showToast('File upload failed');
        }finally{
          setAttachmentBusy(false);
        }
      };
    }

    const voiceBtn=$('#voiceBtn');
    if(voiceBtn && !voiceBtn._vBound){
      voiceBtn._vBound=true;
      voiceBtn.onclick=()=>{
        if(mediaRecorder && mediaRecorder.state==='recording') stopVoiceRecording();
        else startVoiceRecording();
      };
    }

    const fileBtn=$('#fileAttachBtn');
    if(fileBtn && !fileBtn._fBound){
      fileBtn._fBound=true;
      fileBtn.onclick=()=>$('#messageFileInput')?.click();
    }
  }

  function bindClicks(){
    if(window.__GeoHubMessagesV2ClicksBound) return;
    window.__GeoHubMessagesV2ClicksBound = true;
    document.addEventListener('click', e=>{
      const img=e.target.closest('[data-msg-image]');
      if(img){
        e.preventDefault();
        openMessageImage(img.dataset.msgImage);
        return;
      }
      const detailImg=e.target.closest('[data-detail-image]');
      if(detailImg){
        e.preventDefault();
        openMessageImage(detailImg.dataset.detailImage);
        return;
      }
      const react=e.target.closest('[data-msg-reaction]');
      if(react){
        const row=react.closest('[data-message-id]');
        if(row) toggleReaction(row.dataset.messageId, react.dataset.msgReaction);
        react.closest('[data-reaction-picker]')?.classList.remove('open');
        return;
      }
      const trigger=e.target.closest('[data-reaction-trigger]');
      if(trigger){
        const picker=trigger.closest('.msg-bubble-wrap')?.querySelector('[data-reaction-picker]');
        document.querySelectorAll('[data-reaction-picker].open').forEach(p=>{ if(p!==picker) p.classList.remove('open'); });
        picker?.classList.toggle('open');
        return;
      }
      const replyBtn=e.target.closest('[data-reply-btn]');
      if(replyBtn){
        const row=replyBtn.closest('[data-message-id]');
        if(row){
          const mid=row.dataset.messageId;
          const msg=allMessages.find(m=>m.id===mid);
          if(msg){
            const uid=currentUid();
            const convs=window.__geohubLastConvs||[];
            const conv=convs.find(c=>c.id===activeConversation);
            const oid=conv?otherId(conv):'';
            msg.senderName = msg.senderId===uid ? 'You' : (convNicknames[msg.senderId]||oid||'User');
            setReplyState(msg);
            const input=$('#msgInput')||$('#messageInput');
            if(input && !isMobileMsg()) input.focus();
          }
        }
        return;
      }
      if(e.target.closest('[data-open-user-profile]')) return;
      const row=e.target.closest('[data-conv-id]');
      if(row) openConversation(row.dataset.convId);
    });
    document.addEventListener('click', e=>{
      if(!e.target.closest('#emojiPicker') && !e.target.closest('#emojiBtn')){
        const p=$('#emojiPicker'); if(p && p.style.display==='flex') p.style.display='none';
      }
      if(!e.target.closest('#msgAttachSheet') && !e.target.closest('#attachmentMenuBtn')){
        closeAttachmentSheet();
      }
    });
  }

  function showConvLoading(){
    const list=$('#convList');
    if(list) list.innerHTML='<div class="conv-empty"><i class="fas fa-circle-notch fa-spin"></i><p>Loading…</p></div>';
  }

  async function setBizInboxHeader(bizId){
    const titleEl = document.querySelector('.sidebar-title');
    if (!titleEl) return;
    // Render immediately with placeholder; update with real name when Firestore responds
    titleEl.innerHTML =
      '<div style="display:flex;align-items:center;gap:7px;min-width:0;flex:1;overflow:hidden">' +
        '<i class="fas fa-store biz-inbox-icon" style="color:#10b981;flex-shrink:0;font-size:.95rem"></i>' +
        '<span id="bizInboxTitle" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:1.05rem;font-weight:800">Business Inbox</span>' +
      '</div>' +
      '<div style="display:flex;gap:5px;align-items:center;flex-shrink:0">' +
        '<a href="messages.html" class="sidebar-icon-btn" title="Personal inbox" style="text-decoration:none;display:flex;align-items:center;justify-content:center"><i class="fas fa-user" style="font-size:.78rem"></i></a>' +
        '<button class="sidebar-icon-btn" title="New message" onclick="openNewConversationSearch()"><i class="fas fa-edit"></i></button>' +
      '</div>';
    try {
      const GF = window.GeoFirebase;
      if (!GF || !GF.fs || !GF.db) return;
      const snap = await GF.fs.getDoc(GF.fs.doc(GF.db, 'businesses', bizId));
      if (!snap.exists()) return;
      const biz = snap.data() || {};
      const title = biz.title || biz.name || 'Business';
      const logo = biz.logoUrl || '';
      _activeBizTitle = title;
      _activeBizLogo = logo;
      const titleSpan = document.getElementById('bizInboxTitle');
      if (titleSpan) titleSpan.textContent = title + ' Inbox';
      if (logo) {
        const iconEl = titleEl.querySelector('.biz-inbox-icon');
        if (iconEl) {
          const img = document.createElement('img');
          img.src = logo; img.alt = '';
          img.style.cssText = 'width:22px;height:22px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1px solid rgba(255,255,255,.1)';
          img.onerror = function(){ this.style.display='none'; };
          iconEl.parentNode.replaceChild(img, iconEl);
        }
      }
    } catch(e) {}
  }

  function getStoredActor(){
    if(window.GeoActors) return window.GeoActors.getActiveActor();
    try{ return JSON.parse(localStorage.getItem('gh_active_actor')||'null'); }catch(e){ return null; }
  }

  async function syncBizActor(bizId){
    const uid = currentUid();
    if (!uid || !bizId) return;
    const cur = getStoredActor();
    // If already acting as this business, re-fire event to refresh topbar/banner on page load
    if (cur && cur.type === 'business' && cur.businessId === bizId) {
      window.dispatchEvent(new CustomEvent('GeoActorChanged', { detail: cur }));
      if (window._geoSW && window._geoSW.updateNavbarForActor) window._geoSW.updateNavbarForActor(cur);
      return;
    }
    const GF = window.GeoFirebase;
    if (!GF || !GF.fs || !GF.db) return;
    try {
      const [bizSnap, adminSnap] = await Promise.all([
        GF.fs.getDoc(GF.fs.doc(GF.db, 'businesses', bizId)),
        GF.fs.getDoc(GF.fs.doc(GF.db, 'businessAdmins', bizId + '_' + uid))
      ]);
      if (!bizSnap.exists()) return;
      const bizData = bizSnap.data() || {};
      if (bizData.status === 'deleted' || bizData.deleted === true || !!bizData.deletedAt) return;
      // Allow access if user is the business owner (ownerId field) OR has a businessAdmins doc
      const isOwner = bizData.ownerId === uid || bizData.ownerUid === uid;
      const isAdmin = adminSnap.exists();
      if (!isOwner && !isAdmin) return;
      const newActor = {
        type: 'business',
        actorId: 'business_' + bizId,
        businessId: bizId, ownerUid: uid,
        title: bizData.title || bizData.name || 'Business',
        logoUrl: bizData.logoUrl || '',
        coverUrl: bizData.coverUrl || bizData.coverImage || ''
      };
      if(window.GeoActors) window.GeoActors.setActiveActor(newActor);
      else { try { localStorage.setItem('gh_active_actor', JSON.stringify(newActor)); } catch(e) {} window.dispatchEvent(new CustomEvent('GeoActorChanged', { detail: newActor })); }
      if (window._geoSW && window._geoSW.updateNavbarForActor) window._geoSW.updateNavbarForActor(newActor);
    } catch(e) {}
  }

  function init(){
    const auth=window.GeoFirebase?.auth;
    if(!auth?.currentUser){ setTimeout(init,250); return; }

    // Route priority: ?business > ?withBusiness > ?with > active actor
    // Parse params FIRST — before touching any UI — so we can redirect if needed.
    const _params = new URLSearchParams(location.search);
    const bizParam = _params.get('business');
    const withBizParam = _params.get('withBusiness');
    const cidParam = _params.get('cid');
    const target = bizParam ? null : _params.get('with');

    // TASK 1/4: When there is no explicit route param, redirect by active identity
    // BEFORE rendering anything. This prevents personal inbox flash in page mode.
    if(!bizParam && !withBizParam && !target){
      const actor = getStoredActor();
      if(actor && actor.type === 'business' && actor.businessId){
        location.replace(location.pathname + '?business=' + encodeURIComponent(actor.businessId));
        return;
      }
    }

    // Clean conflicting URL (e.g. ?with=UID&business=BIZ_ID → ?business=BIZ_ID)
    if (bizParam && _params.has('with')) {
      history.replaceState(null, '', location.pathname + '?business=' + encodeURIComponent(bizParam) + (cidParam ? '&cid=' + encodeURIComponent(cidParam) : ''));
    }

    showConvLoading();
    renderComposer();
    bindClicks();
    if(window.GeoSocial && window.GeoSocial.listenSafetyPrefs) {
      if(unsubSafety) try{unsubSafety();}catch(e){}
      unsubSafety = window.GeoSocial.listenSafetyPrefs(function(prefs){
        window._ghBlockedUserIds = prefs.blockedUserIds || [];
        if(window.__geohubLastConvs) renderConvs(window.__geohubLastConvs);
      });
    }

    dbg('init', {routeMode: _routeMode || '(resolving)', uid: currentUid(), actorId: currentActorId(), bizParam, withBizParam, target, cidParam, querySource: 'memberUids+participants(client-filter)'});
    if(unsubConvs) unsubConvs();
    if(withBizParam){
      // ── Customer-side business chat ─────────────────────────────
      // Personal identity stays; topbar remains personal user
      _routeMode = 'customerBusinessChat';
      _activeBizId = null;
      _activeBizTitle = '';
      _withBizId = withBizParam;
      _withBizTitle = '';
      _withBizLogo = '';
      const customerUid = currentUid();
      const GF = window.GeoFirebase;
      const cid = cidParam || ('biz_' + withBizParam + '_' + customerUid);

      const chatBox = document.querySelector('#chatMessages');
      const chatHdr = document.querySelector('#chatHeader');
      if(chatHdr) chatHdr.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:.9rem"><i class="fas fa-circle-notch fa-spin"></i> Loading…</div>';

      // Fetch business info then ensure conversation exists
      GF.fs.getDoc(GF.fs.doc(GF.db, 'businesses', withBizParam)).then(function(snap){
        if(!snap.exists()){
          if(chatHdr) chatHdr.innerHTML = '<div style="padding:16px;color:var(--text-muted)"><i class="fas fa-store"></i> Business not found</div>';
          return;
        }
        const bizData = snap.data() || {};
        const ownerUid = bizData.ownerId || bizData.createdBy || '';
        _withBizTitle = bizData.title || bizData.name || 'Business';
        _withBizLogo = bizData.logoUrl || '';

        // Render business header (no "Replying as" — this is customer view)
        if(chatHdr) chatHdr.innerHTML =
          '<div class="chat-header-left">' +
            '<button class="back-btn" onclick="ghChatBack()" title="Back"><i class="fas fa-arrow-left"></i></button>' +
            '<div class="chat-header-av">' +
              (_withBizLogo ? '<img src="'+esc(_withBizLogo)+'" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">' : '<div class="av-placeholder" style="background:rgba(16,185,129,.2)"><i class="fas fa-store" style="font-size:.9rem;color:#10b981"></i></div>') +
            '</div>' +
            '<div>' +
              '<div class="chat-header-name">'+esc(_withBizTitle)+'</div>' +
              '<div style="font-size:.68rem;color:#10b981"><i class="fas fa-store"></i> Business Page</div>' +
            '</div>' +
          '</div>' +
          '<div class="chat-header-actions">' +
            '<button class="header-action-btn" title="Search" id="msgSearchBtn" onclick="window.__ghToggleSearch()"><i class="fas fa-search"></i></button>' +
            '<button class="header-action-btn mobile-info-btn" title="Info" onclick="window.__ghToggleInfoPanel()"><i class="fas fa-info-circle"></i></button>' +
          '</div>';

        // Set composer placeholder
        const inputEl = document.querySelector('#msgInput') || document.querySelector('#messageInput');
        if(inputEl) inputEl.placeholder = 'Message ' + _withBizTitle + '…';

        // Create/merge conversation doc (setDoc merge:true is idempotent)
        const convDoc = {
          participants: customerUid === ownerUid ? [customerUid] : [customerUid, ownerUid],
          participantActors: ['user:' + customerUid, 'business:' + withBizParam],
          inboxKeys: ['user:' + customerUid, 'business:' + withBizParam],
          inboxActorIds: ['user_' + customerUid, 'business_' + withBizParam],
          memberUids: customerUid === ownerUid ? [customerUid] : [customerUid, ownerUid],
          type: 'customer_business',
          customerActorId: 'user_' + customerUid,
          pageActorId: 'business_' + withBizParam,
          businessId: withBizParam,
          businessName: _withBizTitle,
          businessLogo: _withBizLogo,
          forBusiness: true,
          customerUid: customerUid,
          ownerUid: ownerUid || customerUid,
          updatedAt: GF.fs.serverTimestamp(),
          lastMessage: '',
          unreadFor: [],
          unreadActors: [],
          readBy: {}
        };
        GF.fs.setDoc(
          GF.fs.doc(GF.db, 'conversations', cid),
          Object.assign({}, convDoc, {createdAt: GF.fs.serverTimestamp()}),
          {merge: true}
        ).then(function(){
          // Unhide for personal actor — both legacy ('user:UID') and canonical ('user_UID') formats
          GF.fs.updateDoc(GF.fs.doc(GF.db, 'conversations', cid), {
            hiddenForActors:   GF.fs.arrayRemove('user:' + customerUid, 'user_' + customerUid),
            archivedForActors: GF.fs.arrayRemove('user:' + customerUid, 'user_' + customerUid),
            deletedForActors:  GF.fs.arrayRemove('user:' + customerUid, 'user_' + customerUid)
          }).then(function() {
            // Force instant sidebar refresh: add conv to visible list immediately so the
            // left sidebar shows the biz conv without waiting for the Firestore listener
            if (!window.__geohubLastConvs) window.__geohubLastConvs = [];
            var _wfi = window.__geohubLastConvs.findIndex(function(c){ return c.id === cid; });
            var _wfc = Object.assign({ id: cid }, convDoc, {
              hiddenForActors: [], archivedForActors: [], deletedForActors: []
            });
            if (_wfi >= 0) {
              window.__geohubLastConvs[_wfi] = Object.assign({}, window.__geohubLastConvs[_wfi], {
                hiddenForActors: [], archivedForActors: [], deletedForActors: []
              });
            } else {
              window.__geohubLastConvs.unshift(_wfc);
            }
            renderConvs(window.__geohubLastConvs);
          }).catch(function(){});
          activeConversation = cid;
          activeConvData = convDoc;
          activePeerInfo = { id: withBizParam, type:'business', name:_withBizTitle, avatar:_withBizLogo };
          renderConversationDetails();
          setChatOpen(true);
          // Update URL to include cid so refresh goes directly to this conversation
          if(!cidParam){
            history.replaceState(null, '',
              location.pathname + '?withBusiness=' + encodeURIComponent(withBizParam) + '&cid=' + encodeURIComponent(cid)
            );
          }
          if(unsubMsgs){ try{unsubMsgs();}catch(e){} unsubMsgs=null; }
          unsubMsgs = window.GeoSocial.listenMessages(cid, renderMessages);
        }).catch(function(err){
          console.error('[GeoHub] withBusiness conv create', err);
          if(chatBox) chatBox.innerHTML = '<div class="chat-empty"><i class="fas fa-store"></i><p>Could not open conversation</p></div>';
        });
      }).catch(function(){
        if(chatBox) chatBox.innerHTML = '<div class="chat-empty"><i class="fas fa-store"></i><p>Business not found</p></div>';
      });

      // Personal inbox sidebar — shows all personal convs including this biz conv
      unsubConvs = window.GeoSocial.listenConversations(function(convs){
        if (_routeMode !== 'customerBusinessChat') return; // guard: never render personal data in page mode
        dbg('customerBusinessChat convs', convs.length, convs.map(c=>c.id));
        window.__geohubLastConvs = convs || [];
        renderConvs(convs || []);
        // Re-highlight the active biz conv after sidebar re-renders
        if(activeConversation){
          document.querySelectorAll('[data-conv-id]').forEach(function(el){
            el.classList.toggle('active', el.dataset.convId === activeConversation);
          });
        }
      });
    } else if(bizParam && window.GeoSocial.listenBusinessConversations){
      // ── Business inbox (page identity) mode ──────────────────
      _routeMode = 'businessInbox';
      _activeBizId = bizParam;
      _activeBizTitle = '';
      _activeBizLogo = '';
      _withBizId = '';
      _withBizTitle = '';
      _withBizLogo = '';
      // Hard reset ALL stale conversation state and listeners
      activeConversation = null;
      activeConvData = null;
      activePeerInfo = null;
      window.__geohubLastConvs = [];
      if(unsubMsgs){ try{unsubMsgs();}catch(e){} unsubMsgs=null; }
      if(unsubConvDoc){ try{unsubConvDoc();}catch(e){} unsubConvDoc=null; }
      if(unsubReactions){ try{unsubReactions();}catch(e){} unsubReactions=null; }
      if(unsubConvSettings){ try{unsubConvSettings();}catch(e){} unsubConvSettings=null; }
      // Hard reset chat DOM — remove active conv highlight + clear panels
      document.querySelectorAll('.conv-item.active').forEach(function(el){ el.classList.remove('active'); });
      const chatBox=$('#chatMessages'), chatHdr=$('#chatHeader');
      if(chatBox) chatBox.innerHTML='<div class="chat-empty"><i class="fas fa-store"></i><p>Select a conversation</p></div>';
      if(chatHdr) chatHdr.innerHTML='<div style="display:flex;align-items:center;gap:10px;padding:16px;color:var(--text-muted);font-size:.9rem"><i class="fas fa-store" style="color:#10b981;font-size:1.1rem"></i><span>Select a conversation</span></div>';
      renderConversationDetails();
      setBizInboxHeader(bizParam);
      syncBizActor(bizParam); // async — validates owner/admin, fires GeoActorChanged
      // Unhide for business actor if cidParam is explicitly given in the URL
      if(cidParam){
        const _uf = window.GeoFirebase;
        if(_uf && _uf.fs && _uf.db){
          _uf.fs.updateDoc(_uf.fs.doc(_uf.db, 'conversations', cidParam), {
            hiddenForActors:   _uf.fs.arrayRemove('business:' + bizParam, 'business_' + bizParam),
            archivedForActors: _uf.fs.arrayRemove('business:' + bizParam, 'business_' + bizParam),
            deletedForActors:  _uf.fs.arrayRemove('business:' + bizParam, 'business_' + bizParam)
          }).catch(function(){});
        }
      }
      // Migration: patch the owner's own-page conv (biz_{bizId}_{uid}) with businessId/forBusiness
      // if it was created before Phase 54C and lacks these fields.
      const _mGF = window.GeoFirebase;
      if(_mGF && _mGF.fs && _mGF.db){
        _mGF.fs.updateDoc(
          _mGF.fs.doc(_mGF.db, 'conversations', 'biz_' + bizParam + '_' + currentUid()),
          { businessId: bizParam, forBusiness: true }
        ).catch(() => {});
      }
      unsubConvs = window.GeoSocial.listenBusinessConversations(bizParam, function(convs){
        if (_routeMode !== 'businessInbox') return; // guard: never let a stale business listener pollute personal mode
        dbg('businessInbox convs', convs.length, convs.map(c=>({id:c.id,biz:c.businessId,forBiz:c.forBusiness,inboxActorIds:c.inboxActorIds})));
        window.__geohubLastConvs = convs || [];
        renderConvs(convs || []);
        if(cidParam && !activeConversation){
          // Verify cid belongs to this business inbox before opening
          const matchConv = (convs || []).find(function(c){ return c.id === cidParam; });
          if(matchConv){
            openConversation(cidParam);
          } else if(convs && convs.length > 0){
            // Convs are loaded but cid is not in this inbox — safe fallback
            const box=$('#chatMessages');
            if(box) box.innerHTML='<div class="chat-empty"><i class="fas fa-store"></i><p>Conversation not found in this inbox.</p></div>';
          }
          // if convs empty, wait for next real-time snapshot before showing error
        } else if(!activeConversation){
          // No cid — always render a clear empty state (never leave stale messages)
          const box=$('#chatMessages');
          if(box) box.innerHTML = (convs && convs.length)
            ? '<div class="chat-empty"><i class="fas fa-store"></i><p>Select a conversation to reply</p></div>'
            : '<div class="chat-empty"><i class="fas fa-store"></i><p>No messages yet for this business page.</p></div>';
        }
      });
    } else {
      // ── Personal inbox mode ───────────────────────────────────
      _routeMode = 'personalInbox';
      _activeBizId = null;
      _activeBizTitle = '';
      _withBizId = '';
      _withBizTitle = '';
      _withBizLogo = '';
      if(target){ window.GeoSocial.startConversation(target, cid=>openConversation(cid)); }
      unsubConvs=window.GeoSocial.listenConversations(convs=>{
        if (_routeMode !== 'personalInbox') return; // guard: never let personal listener run in page mode
        dbg('personalInbox convs', convs.length, convs.map(c=>({id:c.id,forBiz:c.forBusiness,customerUid:c.customerUid,inboxActorIds:c.inboxActorIds})));
        window.__geohubLastConvs = convs || [];
        renderConvs(convs || []);
        var _onMobile = window.matchMedia('(max-width: 768px)').matches;
        if(!activeConversation && convs && convs[0] && !_onMobile) openConversation(convs[0].id);
        else if(!activeConversation && (!convs || !convs.length)){
          const box=$('#chatMessages');
          if(box) box.innerHTML='<div class="chat-empty"><i class="fas fa-comments"></i><p>Select a conversation to start chatting</p></div>';
        }
      });
    }

    window.addEventListener('pagehide', function(){
      if(isTyping && activeConversation) try{ window.GeoSocial?.setTyping(activeConversation,false,typingActorMeta()); }catch(e){}
      if(unsubConvs){ try{ unsubConvs(); }catch(e){} unsubConvs=null; }
      if(unsubMsgs){ try{ unsubMsgs(); }catch(e){} unsubMsgs=null; }
      if(unsubReactions){ try{ unsubReactions(); }catch(e){} unsubReactions=null; }
      if(unsubSafety){ try{ unsubSafety(); }catch(e){} unsubSafety=null; }
      if(unsubConvSettings){ try{ unsubConvSettings(); }catch(e){} unsubConvSettings=null; }
      if(unsubConvDoc){ try{ unsubConvDoc(); }catch(e){} unsubConvDoc=null; }
    }, {once:true});
  }

  window.openConversation = openConversation;
  window.setFilter = function(f, btn){
    _convFilter = f || 'all';
    document.querySelectorAll('.filter-tab').forEach(b=>b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    renderConvs(window.__geohubLastConvs || []);
  };
  window.searchConvs = function(q){
    _searchFilter = String(q||'').trim().toLowerCase();
    renderConvs(window.__geohubLastConvs || []);
  };
  whenReady(init);

  // TASK 1: Real-time actor switch — redirect inbox to match active identity.
  // Fires when user switches account (personal ↔ business) anywhere on the page.
  window.addEventListener('GeoActorChanged', function(e){
    const actor = e.detail || {};
    const cur = new URLSearchParams(location.search);
    if(actor.type === 'business' && actor.businessId && !cur.has('business')){
      // Switched to a business page — go to its inbox immediately
      location.replace(location.pathname + '?business=' + encodeURIComponent(actor.businessId));
    } else if(actor.type !== 'business' && cur.has('business') && !cur.has('withBusiness')){
      // Switched back to personal — go to personal inbox
      location.replace(location.pathname);
    }
  });

  window.openNewConversationSearch = function(){
    const modal=document.getElementById('newConversationModal');
    const input=document.getElementById('newConversationSearch');
    const results=document.getElementById('newConversationResults');
    if(!modal) return;
    modal.hidden=false;
    if(results) results.innerHTML='<div style="color:var(--text-muted);font-size:.85rem;padding:8px 0">Type a name or email to search users.</div>';
    setTimeout(()=>input&&input.focus(),50);
  };
  window.closeNewConversationSearch = function(){
    const modal=document.getElementById('newConversationModal');
    if(modal) modal.hidden=true;
  };
  window.searchNewConversationUsers = async function(q){
    const box=document.getElementById('newConversationResults');
    if(!box) return;
    q=String(q||'').trim().toLowerCase();
    if(q.length<2){ box.innerHTML='<div style="color:var(--text-muted);font-size:.85rem;padding:8px 0">Type at least 2 letters.</div>'; return; }
    const gf=window.GeoFirebase;
    if(!gf||!gf.fs||!gf.db){ box.innerHTML='<div style="color:var(--text-muted);font-size:.85rem">Firebase not ready.</div>'; return; }
    try{
      const snap=await gf.fs.getDocs(gf.fs.query(gf.fs.collection(gf.db,'users'), gf.fs.limit(40)));
      const me=gf.auth&&gf.auth.currentUser&&gf.auth.currentUser.uid;
      const rows=[];
      const blockedIds = window._ghBlockedUserIds || [];
      snap.forEach(d=>{ const u=Object.assign({id:d.id}, d.data()||{}); const hay=[u.fullName,u.name,u.username,u.email].filter(Boolean).join(' ').toLowerCase(); if(u.id!==me && !blockedIds.includes(u.id) && hay.includes(q)) rows.push(u); });
      if(!rows.length){ box.innerHTML='<div style="color:var(--text-muted);font-size:.85rem;padding:8px 0">No matching users.</div>'; return; }
      box.innerHTML=rows.slice(0,12).map(u=>'<button type="button" class="new-conversation-user" data-start-user="'+esc(u.id)+'"><span>'+(u.avatar||u.photoURL?'<img src="'+esc(u.avatar||u.photoURL)+'" alt="" loading="lazy">':esc(((u.fullName||u.name||u.email||'?')[0]||'?').toUpperCase()))+'</span><strong>'+esc(u.fullName||u.name||u.username||u.email||'User')+'</strong><small>'+esc(u.email||('@'+(u.username||'')))+'</small></button>').join('');
    }catch(err){ box.innerHTML='<div style="color:var(--text-muted);font-size:.85rem">Search failed: '+esc(err.message)+'</div>'; }
  };
  document.addEventListener('click', async function(e){
    const btn=e.target.closest('[data-start-user]');
    if(!btn) return;
    const userId=btn.getAttribute('data-start-user');
    if(!userId||!window.GeoSocial||!window.GeoSocial.startConversation) return;
    try{
      btn.disabled=true;
      await window.GeoSocial.startConversation(userId, function(convId){
        window.closeNewConversationSearch();
        if(convId) openConversation(convId);
      });
    }catch(err){ window.showToast&&window.showToast('Could not start conversation'); }
    finally{ btn.disabled=false; }
  });

})();
