(function(){
  'use strict';

  const REACTIONS = ['❤️','👍','😂','😮','😢','😡'];
  const EMOJIS = ['😀','😁','😂','🤣','😊','😍','😘','😎','😢','😭','😡','👍','👎','👏','🙏','💪','🔥','❤️','💚','💯','🎉','✨','🇬🇪'];
  const esc = v => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const $ = s => document.querySelector(s);

  let activeConversation = null;
  let unsubConvs = null;
  let unsubMsgs = null;
  let unsubReactions = null;
  let sendingMessage = false;
  let reactionState = {};

  function whenReady(cb){
    if(window.GeoSocial && window.GeoFirebase) return cb();
    window.addEventListener('GeoSocialReady', cb, {once:true});
  }

  function currentUid(){ return window.GeoFirebase?.auth?.currentUser?.uid || ''; }
  function otherId(conv){ const uid=currentUid(); return (conv?.participants||[]).find(id=>id!==uid) || ''; }
  function initials(name){ return (String(name||'U').trim()[0] || 'U').toUpperCase(); }

  async function userInfo(uid){
    const fallback = { id:uid, name:'GeoHub User', avatar:'' };
    if(!uid) return fallback;
    try{
      const GF=window.GeoFirebase;
      const snap=await GF.fs.getDoc(GF.fs.doc(GF.db,'users',uid));
      if(snap.exists()){
        const d=snap.data()||{};
        return { id:uid, name:d.fullName||d.displayName||d.name||d.username||d.email||'GeoHub User', avatar:d.photoURL||d.avatar||d.avatarUrl||d.photo||'' };
      }
    }catch(e){}
    return fallback;
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
    if(!convs.length){
      list.innerHTML='<div class="conv-empty"><i class="fas fa-inbox"></i><p>No conversations yet</p></div>';
      updateMsgBadge(0);
      return;
    }
    const rows=[];
    let unreadCount=0;
    for(const c of convs){
      const oid=otherId(c);
      const u=await userInfo(oid);
      const unread = Array.isArray(c.unreadFor) && c.unreadFor.includes(currentUid());
      if(unread) unreadCount++;
      rows.push({c, oid, u, unread});
    }
    list.innerHTML=rows.map(({c,oid,u,unread})=>{
      return '<div class="conv-item '+(c.id===activeConversation?'active':'')+' '+(unread?'has-unread':'')+'" data-conv-id="'+esc(c.id)+'">'
        + '<a class="conv-av-wrap" href="profile.html?id='+esc(oid)+'" data-open-user-profile="'+esc(oid)+'" onclick="event.stopPropagation()">'
        + (u.avatar ? '<img class="conv-avatar-img" src="'+esc(u.avatar)+'" alt="" onerror="this.style.display=\'none\'">' : '<div class="av-placeholder">'+esc(initials(u.name))+'</div>')
        + '</a><div class="conv-info"><div class="conv-top-row"><span class="conv-name">'+esc(u.name)+'</span>'+(unread?'<span class="conv-unread-dot"></span>':'')+'</div>'
        + '<div class="conv-bottom-row"><span class="conv-preview">'+esc(c.lastMessage||'No messages yet')+'</span></div></div></div>';
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
    if(m.mediaType === 'image' || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(m.mediaUrl)){
      return '<a class="msg-media-link" href="'+esc(m.mediaUrl)+'" target="_blank" rel="noopener"><img class="msg-image" src="'+esc(m.mediaUrl)+'" alt="Message image" loading="lazy" decoding="async" onerror="this.style.display=\'none\'"></a>';
    }
    return '<a class="msg-file-link" href="'+esc(m.mediaUrl)+'" target="_blank" rel="noopener">📎 Open attachment</a>';
  }

  function renderMessages(items){
    const box=$('#chatMessages');
    if(!box) return;
    const uid=currentUid();
    const visible = (items||[]).filter(m=>!(Array.isArray(m.deletedFor)&&m.deletedFor.includes(uid)));
    if(!visible.length){
      box.innerHTML='<div class="chat-empty"><i class="fas fa-comment-dots"></i><p>No messages yet. Say hello!</p></div>';
      return;
    }
    const wasAtBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    box.innerHTML=visible.map(m=>{
      const mine = m.senderId===uid || m.authorId===uid;
      const summary = summarizeReactions(m.id);
      const deleted = !!m.deleted;
      const text = deleted ? '<em>Message deleted</em>' : esc(m.text||'');
      const media = deleted ? '' : renderMedia(m);
      return '<div class="msg-row '+(mine?'sent':'received')+'" data-message-id="'+esc(m.id)+'">'
        + '<div class="msg-col"><div class="msg-bubble-wrap">'
        + '<div class="msg-bubble '+(mine?'bubble-sent':'bubble-recv')+'">'+(text?'<div class="msg-text">'+text+'</div>':'')+media+'</div>'
        + '<button class="msg-reaction-trigger '+(summary.mine?'active':'')+'" data-reaction-trigger type="button" title="React">'+(summary.mine?esc(summary.mine):'😊')+'</button>'
        + '<div class="msg-reaction-picker" data-reaction-picker>'+REACTIONS.map(e=>'<button type="button" data-msg-reaction="'+esc(e)+'">'+esc(e)+'</button>').join('')+'</div>'
        + '</div><div class="msg-reaction-summary">'+summary.badges+'</div></div></div>';
    }).join('');
    if(wasAtBottom) box.scrollTop=box.scrollHeight;
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
      const ok = await window.GeoSocial.toggleMessageReaction(activeConversation, messageId, emoji || '❤️');
      if (!ok) console.warn('[Messages] reaction was not saved');
    }catch(err){
      console.error('[Messages] reaction failed', err);
      window.showToast && window.showToast('Reaction failed');
    }
  }

  async function openConversation(cid){
    activeConversation=cid;
    document.querySelector('.messages-layout')?.classList.add('chat-open');
    document.querySelectorAll('.conv-item').forEach(el=>{
      el.classList.toggle('active', el.dataset.convId===cid);
    });
    if(unsubMsgs){ unsubMsgs(); unsubMsgs=null; }
    if(unsubReactions){ unsubReactions(); unsubReactions=null; }

    const box=$('#chatMessages');
    if(box) box.innerHTML='<div class="chat-empty"><i class="fas fa-circle-notch fa-spin"></i><p>Loading messages…</p></div>';

    const header=$('#chatHeader');
    if(header){
      const convs = window.__geohubLastConvs || [];
      const conv = convs.find(x => x.id === cid) || null;
      const oid = conv ? otherId(conv) : '';
      const u = await userInfo(oid);
      header.innerHTML=
        '<div class="chat-header-left">'
        +'<button class="back-btn" onclick="document.querySelector(\'.messages-layout\').classList.remove(\'chat-open\')" title="Back"><i class="fas fa-arrow-left"></i></button>'
        +'<div class="chat-header-av">'+(u.avatar?'<img src="'+esc(u.avatar)+'" alt="" onerror="this.style.display=\'none\'">':'<div class="av-placeholder">'+esc(initials(u.name))+'</div>')+'</div>'
        +'<div><div class="chat-header-name">'+esc(u.name||'Messages')+'</div></div>'
        +'</div>'
        +'<div class="chat-header-actions"><button class="header-action-btn" title="Info" onclick=""><i class="fas fa-info-circle"></i></button></div>';
    }

    unsubMsgs=window.GeoSocial.listenMessages(cid, renderMessages);
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
      window.showToast && window.showToast('Only image upload is supported in messages');
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

  function renderComposer(){
    const input = $('#msgInput') || $('#messageInput');
    const sendBtn = $('.send-btn') || $('#messageSendBtn');
    if(!input) return;
    setupEmojiPicker();

    async function sendCurrent(extra){
      if(sendingMessage) return;
      const text=(input?.value||'').trim();
      if(!text && !(extra&&extra.mediaUrl) || !activeConversation) return;
      sendingMessage = true;
      if(sendBtn) sendBtn.disabled = true;
      window.GeoSocial.sendMessage(activeConversation, text, ok=>{
        if(ok && input) input.value='';
        if(sendBtn) sendBtn.disabled = false;
        const picker=$('#emojiPicker'); if(picker) picker.style.display='none';
        setTimeout(()=>{ sendingMessage=false; }, 350);
      }, extra || {});
      setTimeout(()=>{ sendingMessage=false; if(sendBtn) sendBtn.disabled=false; }, 4500);
    }

    window.sendMsg = () => sendCurrent();
    window.toggleEmojiPicker = function(){
      setupEmojiPicker();
      const p=$('#emojiPicker'); if(!p) return;
      p.style.display = p.style.display==='flex' ? 'none' : 'flex';
    };

    if(input && !input._rmBound){
      input._rmBound = true;
      input.onkeydown=e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendCurrent(); } };
    }
    if(sendBtn && !sendBtn._rmBound){
      sendBtn._rmBound = true;
      sendBtn.onclick=e=>{ e.preventDefault(); sendCurrent(); };
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
          if(url) await sendCurrent({ mediaUrl:url, mediaType:'image' });
        }catch(err){
          console.error('[Messages] image upload failed', err);
          window.showToast && window.showToast('Image upload failed');
        }
      };
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

  function init(){
    const auth=window.GeoFirebase?.auth;
    if(!auth?.currentUser){ setTimeout(init,250); return; }
    document.querySelector('.messages-layout')?.classList.add('chat-open');
    showConvLoading();
    renderComposer();
    bindClicks();
    const target=new URLSearchParams(location.search).get('with');
    if(target){ window.GeoSocial.startConversation(target, cid=>openConversation(cid)); }
    if(unsubConvs) unsubConvs();
    unsubConvs=window.GeoSocial.listenConversations(convs=>{
      window.__geohubLastConvs = convs || [];
      renderConvs(convs || []);
      if(!activeConversation && convs && convs[0]) openConversation(convs[0].id);
    });

    window.addEventListener('pagehide', function(){
      if(unsubConvs){ try{ unsubConvs(); }catch(e){} unsubConvs=null; }
      if(unsubMsgs){ try{ unsubMsgs(); }catch(e){} unsubMsgs=null; }
      if(unsubReactions){ try{ unsubReactions(); }catch(e){} unsubReactions=null; }
    }, {once:true});
  }

  window.openConversation = openConversation;
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
      snap.forEach(d=>{ const u=Object.assign({id:d.id}, d.data()||{}); const hay=[u.fullName,u.name,u.username,u.email].filter(Boolean).join(' ').toLowerCase(); if(u.id!==me && hay.includes(q)) rows.push(u); });
      if(!rows.length){ box.innerHTML='<div style="color:var(--text-muted);font-size:.85rem;padding:8px 0">No matching users.</div>'; return; }
      box.innerHTML=rows.slice(0,12).map(u=>'<button type="button" class="new-conversation-user" data-start-user="'+esc(u.id)+'"><span>'+(u.avatar||u.photoURL?'<img src="'+esc(u.avatar||u.photoURL)+'" alt="" loading="lazy">':esc(((u.fullName||u.name||u.email||'?')[0]||'?').toUpperCase()))+'</span><strong>'+esc(u.fullName||u.name||u.username||u.email||'User')+'</strong><small>'+esc(u.email||('@'+(u.username||'')))+'</small></button>').join('');
    }catch(err){ console.error('[Messages] user search failed', err); box.innerHTML='<div style="color:var(--text-muted);font-size:.85rem">Search failed: '+esc(err.message)+'</div>'; }
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
    }catch(err){ console.error('[Messages] start conversation failed', err); window.showToast&&window.showToast('Could not start conversation'); }
    finally{ btn.disabled=false; }
  });

})();
