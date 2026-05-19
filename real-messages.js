(function(){
  'use strict';

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

  const esc = v => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const $ = s => document.querySelector(s);

  let activeConversation = null;
  let activeConvData = null;
  let _activeBizId = null;
  let _activeBizTitle = '';
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
  let searchActive = false;
  let typingTimer = null;
  let isTyping = false;
  let convSettings = {};
  let convTheme = '';
  let convNicknames = {};
  let mediaRecorder = null;
  let audioChunks = [];
  let recordingTimer = null;
  let recordingStart = 0;
  let _convFilter = 'all';
  let _searchFilter = '';
  const _userCache = {};

  function whenReady(cb){
    if(window.GeoSocial && window.GeoFirebase) return cb();
    window.addEventListener('GeoSocialReady', cb, {once:true});
  }

  function currentUid(){ return window.GeoFirebase?.auth?.currentUser?.uid || ''; }
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
        const u={ id:uid, name:d.fullName||d.displayName||d.name||d.username||d.email||'GeoHub User', avatar:d.photoURL||d.avatar||d.avatarUrl||d.photo||'' };
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
    const blockedIds = window._ghBlockedUserIds || [];
    const baseConvs = blockedIds.length ? convs.filter(c=>{ const oid=otherId(c); return !oid||!blockedIds.includes(oid); }) : convs;
    const rows=[];
    let unreadCount=0;
    for(const c of baseConvs){
      const oid=otherId(c);
      const u=await userInfo(oid);
      const unread = Array.isArray(c.unreadFor) && c.unreadFor.includes(currentUid());
      if(unread) unreadCount++;
      rows.push({c, oid, u, unread});
    }
    let filtered = rows;
    if(_convFilter === 'unread') filtered = filtered.filter(r=>r.unread);
    if(_searchFilter){
      filtered = filtered.filter(r=>{
        const name = (convNicknames[r.oid] || r.u.name || '').toLowerCase();
        return name.includes(_searchFilter);
      });
    }
    if(!filtered.length){
      const msg = _searchFilter ? 'No results for "'+esc(_searchFilter)+'"'
        : (_convFilter==='unread' ? 'No unread messages' : 'No conversations yet');
      list.innerHTML='<div class="conv-empty"><i class="fas fa-inbox"></i><p>'+msg+'</p></div>';
      updateMsgBadge(unreadCount);
      return;
    }
    list.innerHTML=filtered.map(({c,oid,u,unread})=>{
      const name = convNicknames[oid] || u.name;
      const ts = convTime(c.updatedAt || c.lastMessageAt || c.createdAt || null);
      return '<div class="conv-item '+(c.id===activeConversation?'active':'')+' '+(unread?'has-unread':'')+'" data-conv-id="'+esc(c.id)+'" oncontextmenu="return window.__ghConvCtxMenu(event,\''+esc(c.id)+'\')">'
        + '<a class="conv-av-wrap" href="profile.html?id='+esc(oid)+'" data-open-user-profile="'+esc(oid)+'" onclick="event.stopPropagation()">'
        + (u.avatar ? '<img class="conv-avatar-img" src="'+esc(u.avatar)+'" alt="" onerror="this.style.display=\'none\'">' : '<div class="av-placeholder">'+esc(initials(name))+'</div>')
        + '</a><div class="conv-info"><div class="conv-top-row"><span class="conv-name">'+esc(name)+'</span>'+(ts?'<span class="conv-time">'+esc(ts)+'</span>':'')+'</div>'
        + '<div class="conv-bottom-row"><span class="conv-preview">'+esc(c.lastMessage||'No messages yet')+'</span>'+(unread?'<span class="conv-unread-dot"></span>':'')+'</div></div></div>';
    }).join('');
    updateMsgBadge(unreadCount);
  }

  function summarizeReactions(messageId){
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

  function renderReplyQuote(m){
    if(!m.replyTo) return '';
    return '<div class="msg-reply-quote"><span class="msg-reply-quote-name">'+esc(m.replyTo.senderName||'User')+'</span>'
      + '<span class="msg-reply-quote-text">'+esc((m.replyTo.text||'').slice(0,60))+'</span></div>';
  }

  function receiptIcon(m){
    const uid = currentUid();
    if(m.senderId !== uid && m.authorId !== uid) return '';
    const seenBy = Array.isArray(m.seenBy) ? m.seenBy.filter(id=>id!==uid) : [];
    if(seenBy.length) return '<span class="msg-receipt seen" title="Seen">✓✓</span>';
    if(m.delivered) return '<span class="msg-receipt delivered" title="Delivered">✓✓</span>';
    return '<span class="msg-receipt sent" title="Sent">✓</span>';
  }

  function applyTheme(theme){
    convTheme = theme || '';
    const style = document.getElementById('convThemeStyle') || (() => {
      const s = document.createElement('style'); s.id='convThemeStyle'; document.head.appendChild(s); return s;
    })();
    if(convTheme){
      const [c1,c2] = convTheme.split(',');
      style.textContent = '.bubble-sent { background: linear-gradient(135deg,'+c1+','+c2+') !important; }';
    } else {
      style.textContent = '';
    }
  }

  function renderMessages(items, filterText){
    const box=$('#chatMessages');
    if(!box) return;
    allMessages = items || [];
    const uid=currentUid();
    let visible = (allMessages).filter(m=>!(Array.isArray(m.deletedFor)&&m.deletedFor.includes(uid)));
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
      const mine = m.senderId===uid || m.authorId===uid;
      const summary = summarizeReactions(m.id);
      const deleted = !!m.deleted;
      const text = deleted ? '<em>Message deleted</em>' : esc(m.text||'');
      const media = deleted ? '' : renderMedia(m);
      const replyQuote = deleted ? '' : renderReplyQuote(m);
      const edited = (!deleted && m.edited) ? '<span class="msg-edited">(edited)</span>' : '';
      const receipt = mine ? receiptIcon(m) : '';
      const contextAttr = mine && !deleted ? ' oncontextmenu="return window.__ghMsgCtxMenu(event,\''+esc(m.id)+'\')" ontouchstart="window.__ghMsgTouchStart(event,\''+esc(m.id)+'\')" ontouchend="window.__ghMsgTouchEnd(event)"' : '';
      return '<div class="msg-row '+(mine?'sent':'received')+'" data-message-id="'+esc(m.id)+'">'
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
        + '</div>'
        + '<div class="msg-reaction-picker" data-reaction-picker>'+REACTIONS.map(e=>'<button type="button" data-msg-reaction="'+esc(e)+'">'+esc(e)+'</button>').join('')+'</div>'
        + '</div>'
        + '<div class="msg-meta-row">'
        + (receipt ? receipt : '')
        + '</div>'
        + '<div class="msg-reaction-summary">'+summary.badges+'</div>'
        + '</div></div>';
    }).join('');

    if(wasAtBottom && !filterText) box.scrollTop=box.scrollHeight;

    markVisibleSeen(visible, uid);
  }

  function markVisibleSeen(visible, uid){
    if(!activeConversation || !uid) return;
    const unseen = visible.filter(m => m.senderId !== uid && m.authorId !== uid && !(Array.isArray(m.seenBy) && m.seenBy.includes(uid))).map(m=>m.id);
    if(unseen.length && window.GeoSocial?.markMessagesSeen){
      window.GeoSocial.markMessagesSeen(activeConversation, unseen);
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

  async function toggleReaction(messageId, emoji){
    if(!activeConversation || !messageId) return;
    try{
      await window.GeoSocial.toggleMessageReaction(activeConversation, messageId, emoji || '❤️');
    }catch(err){
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
      if(!isTyping){
        isTyping = true;
        window.GeoSocial?.setTyping && window.GeoSocial.setTyping(activeConversation, true);
      }
      clearTimeout(typingTimer);
      typingTimer = setTimeout(()=>{
        isTyping = false;
        window.GeoSocial?.setTyping && window.GeoSocial.setTyping(activeConversation, false);
      }, 3000);
    });
  }

  function handleTypingIndicator(convData){
    const uid = currentUid();
    const typingUsers = convData?.typingUsers || {};
    const now = Date.now();
    const active = Object.entries(typingUsers).filter(([id, ts])=>{
      if(id === uid) return false;
      const t = ts && ts.toMillis ? ts.toMillis() : (ts && ts.seconds ? ts.seconds*1000 : Number(ts||0));
      return t && (now - t) < 5000;
    });
    const indicator = $('#typingIndicator');
    if(!indicator) return;
    if(active.length){
      indicator.style.display='';
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
    const msg = allMessages.find(m=>m.id===msgId);
    if(!msg) return false;
    showContextMenu(e.clientX, e.clientY, [
      { icon:'fa-edit', label:'Edit', action:()=>startEdit(msgId, msg) },
      { sep:true },
      { icon:'fa-trash', label:'Delete for me', action:()=>window.GeoSocial?.deleteMessage(activeConversation, msgId, 'me') },
      { icon:'fa-trash-alt', label:'Delete for everyone', danger:true, action:()=>window.GeoSocial?.deleteMessage(activeConversation, msgId, 'everyone') },
    ]);
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

  window.__ghConvCtxMenu = function(e, convId){
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, [
      { icon:'fa-archive', label:'Archive', action:()=>window.GeoSocial?.setConversationArchive(convId, true, ()=>window.showToast&&window.showToast('Archived')) },
      { icon:'fa-bell-slash', label:'Mute 1 hour', action:()=>window.GeoSocial?.setConversationMute(convId, Date.now()+3600000, ()=>window.showToast&&window.showToast('Muted 1h')) },
      { icon:'fa-bell-slash', label:'Mute 8 hours', action:()=>window.GeoSocial?.setConversationMute(convId, Date.now()+28800000, ()=>window.showToast&&window.showToast('Muted 8h')) },
      { icon:'fa-bell-slash', label:'Mute always', action:()=>window.GeoSocial?.setConversationMute(convId, -1, ()=>window.showToast&&window.showToast('Muted')) },
      { sep:true },
      { icon:'fa-trash', label:'Delete conversation', danger:true, action:()=>{ if(confirm('Delete this conversation for you?')){ window.GeoSocial?.setConversationArchive(convId, true); } } },
    ]);
    return false;
  };

  function showThemePicker(){
    document.querySelectorAll('.gh-theme-picker').forEach(m=>m.remove());
    const picker=document.createElement('div');
    picker.className='gh-theme-picker';
    picker.innerHTML='<div class="gh-theme-title">Chat Theme</div>'
      + THEMES.map(t=>'<button class="gh-theme-swatch'+(convTheme===t.v?' active':'')+'" data-theme-val="'+esc(t.v)+'" style="background:linear-gradient(135deg,'+t.v.split(',').map(c=>esc(c)).join(',')+')" title="'+esc(t.label)+'"></button>').join('')
      + '<button class="gh-theme-reset" data-theme-val="">Reset</button>';
    picker.querySelectorAll('[data-theme-val]').forEach(btn=>{
      btn.onclick=()=>{
        const val=btn.dataset.themeVal||'';
        window.GeoSocial?.setConversationTheme(activeConversation, val, ok=>{
          if(ok){ applyTheme(val); picker.remove(); }
        });
      };
    });
    const header=$('#chatHeader');
    if(header) header.appendChild(picker);
    const dismiss=e=>{ if(!picker.contains(e.target)){ picker.remove(); document.removeEventListener('click',dismiss,true); } };
    setTimeout(()=>document.addEventListener('click',dismiss,true),50);
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
      : '';
    header.innerHTML=
      '<div class="chat-header-left">'
      +'<button class="back-btn" onclick="document.querySelector(\'.messages-layout\').classList.remove(\'chat-open\')" title="Back"><i class="fas fa-arrow-left"></i></button>'
      +'<div class="chat-header-av">'+(u.avatar?'<img src="'+esc(u.avatar)+'" alt="" onerror="this.style.display=\'none\'">':'<div class="av-placeholder">'+esc(initials(u.name))+'</div>')+'</div>'
      +'<div><div class="chat-header-name">'+esc(displayName(u.id, u.name))+'</div>'+bizCtx+'</div>'
      +'</div>'
      +'<div class="chat-header-actions">'
      +'<button class="header-action-btn" title="Search" id="msgSearchBtn" onclick="window.__ghToggleSearch()"><i class="fas fa-search"></i></button>'
      +'<button class="header-action-btn" title="Theme" onclick="window.__ghShowThemePicker()"><i class="fas fa-palette"></i></button>'
      +'<button class="header-action-btn" title="Nicknames" onclick="window.__ghShowNicknames()"><i class="fas fa-user-tag"></i></button>'
      +'</div>';
  }

  window.__ghToggleSearch = toggleSearch;
  window.__ghShowThemePicker = showThemePicker;
  window.__ghShowNicknames = showNicknamePanel;

  async function openConversation(cid){
    activeConversation=cid;
    document.querySelector('.messages-layout')?.classList.add('chat-open');
    document.querySelectorAll('.conv-item').forEach(el=>{
      el.classList.toggle('active', el.dataset.convId===cid);
    });

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
    const oid = conv ? otherId(conv) : '';
    const u = await userInfo(oid);
    buildHeader(u, conv);

    const GF = window.GeoFirebase;
    if(GF){
      unsubConvDoc = GF.fs.onSnapshot(GF.fs.doc(GF.db,'conversations',cid), snap=>{
        const data = snap.exists() ? snap.data()||{} : {};
        activeConvData = Object.assign({id:cid}, data);
        convNicknames = data.nicknames || {};
        applyTheme(data.theme||'');
        handleTypingIndicator(data);
        buildHeader(u, activeConvData);
      }, ()=>{});
    }

    if(window.GeoSocial?.listenConversationSettings){
      unsubConvSettings = window.GeoSocial.listenConversationSettings(cid, settings=>{
        convSettings = settings || {};
      });
    }

    unsubMsgs=window.GeoSocial.listenMessages(cid, items=>renderMessages(items, getCurrentSearch()));
    if(window.GeoSocial.listenMessageReactions) unsubReactions=window.GeoSocial.listenMessageReactions(cid, applyMessageReactions);
    try{ window.GeoSocial.markConversationRead && window.GeoSocial.markConversationRead(cid, ()=>{
      document.querySelectorAll('.conv-item[data-conv-id="'+cid+'"]').forEach(el=>el.classList.remove('has-unread'));
      const dot=document.querySelector('.conv-item[data-conv-id="'+cid+'"] .conv-unread-dot');
      if(dot) dot.remove();
    }); }catch(e){}
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
    return { mediaUrl:url, type:'file', fileName:file.name, fileSize:file.size };
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
        const uid=currentUid();
        const url = await window.GeoSocial.uploadAudioBlob(blob, uid);
        if(url) await sendCurrentMsg({ mediaUrl:url, type:'audio', duration });
        else window.showToast&&window.showToast('Voice upload failed');
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
      btn.innerHTML='<i class="fas fa-stop-circle"></i>';
      btn.title='Stop recording';
    } else {
      btn.classList.remove('recording');
      btn.innerHTML='<i class="fas fa-microphone"></i>';
      btn.title='Hold to record voice';
    }
  }

  let sendCurrentMsg = null;

  function renderComposer(){
    const input = $('#msgInput') || $('#messageInput');
    const sendBtn = $('.send-btn') || $('#messageSendBtn');
    if(!input) return;
    setupEmojiPicker();
    setupSearch();
    setupTyping();

    async function doSend(extra){
      if(sendingMessage) return;
      const text=(input?.value||'').trim();
      if(!text && !(extra&&extra.mediaUrl) || !activeConversation) return;
      sendingMessage = true;
      if(sendBtn) sendBtn.disabled = true;

      const payload = Object.assign({}, extra||{});
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
        window.GeoSocial?.setTyping && window.GeoSocial.setTyping(activeConversation, false);
      }

      window.GeoSocial.sendMessage(activeConversation, text, ok=>{
        if(ok && input) input.value='';
        if(sendBtn) sendBtn.disabled = !(input && input.value.trim());
        const picker=$('#emojiPicker'); if(picker) picker.style.display='none';
        setTimeout(()=>{ sendingMessage=false; }, 350);
      }, payload);
      setTimeout(()=>{ sendingMessage=false; if(sendBtn) sendBtn.disabled=!(input&&input.value.trim()); }, 4500);
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
      input.addEventListener('input', ()=>{ if(sendBtn) sendBtn.disabled = !input.value.trim(); });
    }
    if(sendBtn && !sendBtn._rmBound){
      sendBtn._rmBound = true;
      sendBtn.onclick=e=>{ e.preventDefault(); doSend(); };
      sendBtn.disabled = !(input && input.value.trim());
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
          window.showToast && window.showToast('Uploading photo...');
          const url=await uploadSelectedImage(file);
          if(url) await doSend({ mediaUrl:url, mediaType:'image' });
        }catch(err){
          window.showToast && window.showToast('Image upload failed');
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
        const extra=await uploadSelectedFile(file);
        if(extra) await doSend(extra);
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
      const react=e.target.closest('[data-msg-reaction]');
      if(react){
        const row=react.closest('[data-message-id]');
        if(row) toggleReaction(row.dataset.messageId, react.dataset.msgReaction);
        react.closest('[data-reaction-picker]')?.classList.remove('open');
        return;
      }
      const trigger=e.target.closest('[data-reaction-trigger]');
      if(trigger){
        const picker=trigger.parentElement?.querySelector('[data-reaction-picker]');
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
            if(input) input.focus();
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
        type: 'business', businessId: bizId, ownerUid: uid,
        title: bizData.title || bizData.name || 'Business',
        logoUrl: bizData.logoUrl || '',
        coverUrl: bizData.coverUrl || bizData.coverImage || ''
      };
      try { localStorage.setItem('gh_active_actor', JSON.stringify(newActor)); } catch(e) {}
      window.dispatchEvent(new CustomEvent('GeoActorChanged', { detail: newActor }));
      if (window._geoSW && window._geoSW.updateNavbarForActor) window._geoSW.updateNavbarForActor(newActor);
    } catch(e) {}
  }

  function init(){
    const auth=window.GeoFirebase?.auth;
    if(!auth?.currentUser){ setTimeout(init,250); return; }
    document.querySelector('.messages-layout')?.classList.add('chat-open');
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
    // Parse params — business wins: ignore ?with when ?business is present
    const _params = new URLSearchParams(location.search);
    const bizParam = _params.get('business');
    const cidParam = _params.get('cid');
    const target = bizParam ? null : _params.get('with');

    // Clean conflicting URL (e.g. ?with=UID&business=BIZ_ID → ?business=BIZ_ID)
    if (bizParam && _params.has('with')) {
      history.replaceState(null, '', location.pathname + '?business=' + encodeURIComponent(bizParam) + (cidParam ? '&cid=' + encodeURIComponent(cidParam) : ''));
    }

    if(unsubConvs) unsubConvs();
    if(bizParam && window.GeoSocial.listenBusinessConversations){
      // ── Business inbox mode ───────────────────────────────────
      _activeBizId = bizParam;
      _activeBizTitle = '';
      // Hard reset ALL stale conversation state and listeners
      activeConversation = null;
      activeConvData = null;
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
      setBizInboxHeader(bizParam);
      syncBizActor(bizParam); // async — validates owner/admin, fires GeoActorChanged
      unsubConvs = window.GeoSocial.listenBusinessConversations(bizParam, function(convs){
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
      _activeBizId = null;
      _activeBizTitle = '';
      if(target){ window.GeoSocial.startConversation(target, cid=>openConversation(cid)); }
      unsubConvs=window.GeoSocial.listenConversations(convs=>{
        window.__geohubLastConvs = convs || [];
        renderConvs(convs || []);
        if(!activeConversation && convs && convs[0]) openConversation(convs[0].id);
        else if(!activeConversation && (!convs || !convs.length)){
          const box=$('#chatMessages');
          if(box) box.innerHTML='<div class="chat-empty"><i class="fas fa-comments"></i><p>Select a conversation to start chatting</p></div>';
        }
      });
    }

    window.addEventListener('pagehide', function(){
      if(isTyping && activeConversation) try{ window.GeoSocial?.setTyping(activeConversation,false); }catch(e){}
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
