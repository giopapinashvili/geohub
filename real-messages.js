(function(){
  'use strict';

  const REACTIONS = ['❤️','👍','😂','😮','😢','😡'];
  const EMOJIS = ['😀','😁','😂','🤣','😊','😍','😘','😎','😢','😭','😡','👍','👎','👏','🙏','💪','🔥','❤️','💚','💯','🎉','✨','🇬🇪'];
  const esc = v => String(v == null ? '' : v).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
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

  async function renderConvs(convs){
    const list=$('#convList');
    if(!list) return;
    if(!convs.length){
      list.innerHTML='<div class="conv-empty"><i class="fas fa-inbox"></i><p>No conversations yet</p></div>';
      return;
    }
    const rows=[];
    for(const c of convs){
      const oid=otherId(c);
      const u=await userInfo(oid);
      rows.push({c, oid, u});
    }
    list.innerHTML=rows.map(({c,oid,u})=>{
      const unread = Array.isArray(c.unreadFor) && c.unreadFor.includes(currentUid());
      return '<div class="conv-item '+(c.id===activeConversation?'active':'')+' '+(unread?'unread':'')+'" data-conv-id="'+esc(c.id)+'">'
        + '<a class="conv-av-wrap" href="profile.html?id='+esc(oid)+'" data-open-user-profile="'+esc(oid)+'">'
        + (u.avatar ? '<img class="conv-avatar-img" src="'+esc(u.avatar)+'" alt="">' : '<div class="av-placeholder">'+esc(initials(u.name))+'</div>')
        + '</a><div class="conv-info"><div class="conv-top-row"><a class="conv-name" href="profile.html?id='+esc(oid)+'" data-open-user-profile="'+esc(oid)+'">'+esc(u.name)+'</a>'+(unread?'<span class="conv-unread-dot"></span>':'')+'</div>'
        + '<div class="conv-bottom-row"><span class="conv-preview">'+esc(c.lastMessage||'No messages yet')+'</span></div></div></div>';
    }).join('');
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
      return '<a class="msg-media-link" href="'+esc(m.mediaUrl)+'" target="_blank" rel="noopener"><img class="msg-image" src="'+esc(m.mediaUrl)+'" alt="Message image" loading="lazy" decoding="async"></a>';
    }
    return '<a class="msg-file-link" href="'+esc(m.mediaUrl)+'" target="_blank" rel="noopener">📎 Open attachment</a>';
  }

  function renderMessages(items){
    const box=$('#chatMessages');
    if(!box) return;
    const uid=currentUid();
    const visible = (items||[]).filter(m=>!(Array.isArray(m.deletedFor)&&m.deletedFor.includes(uid)));
    if(!visible.length){
      box.innerHTML='<div class="chat-empty"><i class="fas fa-comment-dots"></i><p>No messages yet</p></div>';
      return;
    }
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
    box.scrollTop=box.scrollHeight;
  }

  function applyMessageReactions(reactions){
    const grouped={};
    (reactions||[]).forEach(r=>{
      if(!r.messageId) return;
      grouped[r.messageId]=grouped[r.messageId]||{rows:[]};
      grouped[r.messageId].rows.push(r);
    });
    reactionState = grouped;
    // Re-render from current message DOM data by asking listener to refresh on next snapshot is not needed;
    // patch only visible controls for instant UI updates.
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
    if(unsubMsgs) unsubMsgs();
    if(unsubReactions) unsubReactions();
    const header=$('#chatHeader');
    if(header){
      const convs = window.__geohubLastConvs || [];
      const conv = convs.find(x => x.id === cid) || null;
      const oid = conv ? otherId(conv) : '';
      const u = await userInfo(oid);
      header.innerHTML='<div class="chat-peer-head"><a href="profile.html?id='+esc(oid)+'" class="chat-peer-link">'+(u.avatar?'<img src="'+esc(u.avatar)+'" alt="">':'<span>'+esc(initials(u.name))+'</span>')+'<strong>'+esc(u.name || 'Messages')+'</strong></a></div>';
    }
    unsubMsgs=window.GeoSocial.listenMessages(cid, renderMessages);
    if(window.GeoSocial.listenMessageReactions) unsubReactions=window.GeoSocial.listenMessageReactions(cid, applyMessageReactions);
    try{ window.GeoSocial.markConversationRead && window.GeoSocial.markConversationRead(cid); }catch(e){}
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
      window.showToast && window.showToast('Only image upload is supported in messages now');
      return '';
    }
    const dataUrl = await new Promise((resolve,reject)=>{
      const r=new FileReader();
      r.onload=()=>resolve(String(r.result||''));
      r.onerror=reject;
      r.readAsDataURL(file);
    });
    if(file.size > 8 * 1024 * 1024){
      window.showToast && window.showToast('Image must be under 8 MB');
      return '';
    }
    return await window.GeoSocial.uploadImageDataUrl(dataUrl, 'messages');
  }

  function renderComposer(){
    let input = $('#msgInput') || $('#messageInput');
    let sendBtn = $('.send-btn') || $('#messageSendBtn');
    let area=$('.chat-input-area') || $('.message-input-area') || $('#chatComposer');
    if(!input && area){
      area.innerHTML='<form id="messageForm" class="message-form"><button type="button" class="input-btn" data-toggle-emoji>😊</button><button type="button" class="input-btn" data-pick-image>📷</button><input id="messageInput" type="text" placeholder="Write a message..." autocomplete="off"><button type="submit" class="send-btn"><i class="fas fa-paper-plane"></i></button><input id="messageImageInput" type="file" accept="image/*" hidden><div class="emoji-picker-wrap" id="emojiPicker"></div></form>';
      input=$('#messageInput');
      sendBtn=$('.send-btn');
    }else if(area && !$('#messageImageInput')){
      const file=document.createElement('input'); file.type='file'; file.accept='image/*'; file.hidden=true; file.id='messageImageInput'; area.appendChild(file);
      if(!area.querySelector('[data-pick-image]')){
        const b=document.createElement('button'); b.type='button'; b.className='input-btn'; b.dataset.pickImage='1'; b.textContent='📷';
        const emoji=area.querySelector('[onclick*="Emoji"], [data-toggle-emoji]');
        (emoji?.parentNode || area).insertBefore(b, emoji ? emoji.nextSibling : input);
      }
    }
    setupEmojiPicker();

    async function sendCurrent(extra){
      if(sendingMessage) return;
      const text=(input?.value||'').trim();
      if(!text && !(extra&&extra.mediaUrl) || !activeConversation) return;
      sendingMessage = true;
      window.GeoSocial.sendMessage(activeConversation, text, ok=>{
        if(ok && input) input.value='';
        const picker=$('#emojiPicker'); if(picker) picker.style.display='none';
        setTimeout(()=>{ sendingMessage=false; }, 350);
      }, extra || {});
      setTimeout(()=>{ sendingMessage=false; }, 4500);
    }

    window.sendMsg = () => sendCurrent();
    window.toggleEmojiPicker = function(){
      setupEmojiPicker();
      const p=$('#emojiPicker'); if(!p) return;
      p.style.display = p.style.display==='flex' ? 'none' : 'flex';
    };

    const form=$('#messageForm');
    if(form) form.onsubmit=e=>{ e.preventDefault(); sendCurrent(); };
    if(input) input.onkeydown=e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendCurrent(); } };
    if(sendBtn) sendBtn.onclick=e=>{ e.preventDefault(); sendCurrent(); };

    document.querySelectorAll('[data-toggle-emoji]').forEach(btn=>btn.onclick=window.toggleEmojiPicker);
    document.querySelectorAll('[data-pick-image]').forEach(btn=>btn.onclick=()=>$('#messageImageInput')?.click());
    const fileInput=$('#messageImageInput');
    if(fileInput){
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
  }

  function init(){
    const auth=window.GeoFirebase?.auth;
    if(!auth?.currentUser){ setTimeout(init,250); return; }
    document.querySelector('.messages-layout')?.classList.add('chat-open');
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
  }

  whenReady(init);

  window.openNewConversationSearch = function(){
    const modal=document.getElementById('newConversationModal');
    const input=document.getElementById('newConversationSearch');
    const results=document.getElementById('newConversationResults');
    if(!modal) return;
    modal.hidden=false;
    if(results) results.innerHTML='<div class="admin-step4-empty">Type a name or email to search users.</div>';
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
    if(q.length<2){ box.innerHTML='<div class="admin-step4-empty">Type at least 2 letters.</div>'; return; }
    const gf=window.GeoFirebase;
    if(!gf||!gf.fs||!gf.db){ box.innerHTML='<div class="admin-step4-empty">Firebase not ready.</div>'; return; }
    try{
      const snap=await gf.fs.getDocs(gf.fs.query(gf.fs.collection(gf.db,'users'), gf.fs.limit(40)));
      const me=gf.auth&&gf.auth.currentUser&&gf.auth.currentUser.uid;
      const rows=[];
      snap.forEach(d=>{ const u=Object.assign({id:d.id}, d.data()||{}); const hay=[u.fullName,u.name,u.username,u.email].filter(Boolean).join(' ').toLowerCase(); if(u.id!==me && hay.includes(q)) rows.push(u); });
      if(!rows.length){ box.innerHTML='<div class="admin-step4-empty">No matching users.</div>'; return; }
      box.innerHTML=rows.slice(0,12).map(u=>'<button type="button" class="new-conversation-user" data-start-user="'+esc(u.id)+'"><span>'+(u.avatar||u.photoURL?'<img src="'+esc(u.avatar||u.photoURL)+'" alt="">':esc(((u.fullName||u.name||u.email||'?')[0]||'?').toUpperCase()))+'</span><strong>'+esc(u.fullName||u.name||u.username||u.email||'User')+'</strong><small>'+esc(u.email||('@'+(u.username||'')))+'</small></button>').join('');
    }catch(err){ console.error('[Messages] user search failed', err); box.innerHTML='<div class="admin-step4-empty">Search failed: '+esc(err.message)+'</div>'; }
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
        if(convId && window.openConversation) window.openConversation(convId);
      });
    }catch(err){ console.error('[Messages] start conversation failed', err); window.showToast&&window.showToast('Could not start conversation'); }
    finally{ btn.disabled=false; }
  });

})();
