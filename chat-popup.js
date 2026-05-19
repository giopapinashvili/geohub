(function(){
  'use strict';
  if (/messages\.html$/i.test(location.pathname)) return;
  if (window.__GeoHubChatPopupLoaded) return;
  window.__GeoHubChatPopupLoaded = true;

  const EMOJIS = ['😀','😁','😂','🤣','😊','😍','😘','😎','😢','😭','😡','👍','👎','👏','🙏','💪','🔥','❤️','💚','💯','🎉','✨','🇬🇪'];
  const REACTIONS = ['❤️','👍','😂','😮','😢','😡'];
  const esc = v => String(v == null ? '' : v).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const ts = v => v && v.toMillis ? v.toMillis() : (v && v.seconds ? v.seconds*1000 : Number(v||0));
  const state = { open:false, minimized:false, activeCid:null, activeOther:null, convs:[], messages:[], userCache:{}, unsubConvs:null, unsubMsgs:null, unsubReactions:null, reactions:{}, ready:false, startedAt:Date.now()+1500, lastSeen:{} };

  function whenReady(cb){
    if(window.GeoSocial && window.GeoFirebase && window.GeoFirebase.auth) return cb();
    window.addEventListener('GeoSocialReady', () => cb(), { once:true });
  }
  function uid(){ return window.GeoFirebase?.auth?.currentUser?.uid || null; }
  function otherId(conv){ const me=uid(); return (conv?.participants||[]).find(id=>id!==me) || ''; }
  function initials(name){ return (String(name||'U').trim()[0] || 'U').toUpperCase(); }
  function activeActor(){ if(window.GeoActors?.getActiveActor) return window.GeoActors.getActiveActor(); try{return JSON.parse(localStorage.getItem('gh_active_actor')||'null');}catch(e){return null;} }
  function activeActorId(){ if(window.GeoActors?.getActiveActorId) return window.GeoActors.getActiveActorId(); const a=activeActor(); if(a?.actorId) return a.actorId; const me=uid(); return me ? 'user_' + me : ''; }
  function activeBusinessId(){ const a=activeActor(); return a && a.type === 'business' ? a.businessId : ''; }
  function inboxHref(){ const bizId=activeBusinessId(); return bizId ? 'messages.html?business=' + encodeURIComponent(bizId) : 'messages.html'; }
  function showBtn(show, count){ const b=document.querySelector('.gh-chat-pop-btn'); const badge=document.querySelector('.gh-cpb-badge'); if(b) b.classList.toggle('show', !!show && !document.body.classList.contains('gh-install-visible')); if(badge){ const n=count>0?String(count>9?'9+':count):''; badge.textContent=n; badge.style.display=n?'':'none'; } }
  function countUnread(){ const me=uid(); const actorId=activeActorId(); const oldActor=actorId.indexOf('business_')===0?'business:'+actorId.slice(9):(me?'user:'+me:''); return state.convs.filter(conv=>{ if(Array.isArray(conv.unreadActors)) return conv.unreadActors.includes(actorId) || (oldActor && conv.unreadActors.includes(oldActor)); const t=ts(conv.updatedAt||conv.createdAt); const lastSeen=Number(localStorage.getItem('gh_chat_seen_'+conv.id)||'0'); return conv.lastSenderId && conv.lastSenderId!==me && t>lastSeen; }).length; }

  async function getUser(userId){
    if(!userId) return { id:'', name:'GeoHub User', avatar:'' };
    if(state.userCache[userId]) return state.userCache[userId];
    const fallback={ id:userId, name:'GeoHub User', avatar:'' };
    try{
      const GF=window.GeoFirebase;
      const snap=await GF.fs.getDoc(GF.fs.doc(GF.db,'users',userId));
      if(snap.exists()){
        const d=snap.data()||{};
        const u={ id:userId, name:d.fullName||d.displayName||d.name||d.username||d.email||'GeoHub User', avatar:d.photoURL||d.avatar||d.avatarUrl||d.photo||'' };
        state.userCache[userId]=u; return u;
      }
    }catch(e){ console.warn('[ChatPopup] user lookup failed', e.message); }
    state.userCache[userId]=fallback; return fallback;
  }

  function mount(){
    if(document.getElementById('ghChatPopRoot')) return;
    const root=document.createElement('div');
    root.id='ghChatPopRoot'; root.className='gh-chat-pop-root';
    root.innerHTML = `
      <button class="gh-chat-pop-btn" type="button" aria-label="Open unread messages"><i class="fas fa-comment-dots" aria-hidden="true"></i><span class="gh-cpb-badge" style="display:none"></span></button>
      <section class="gh-chat-pop" aria-label="GeoHub chat">
        <header class="gh-chat-head">
          <div class="gh-chat-avatar" id="ghChatAvatar">G</div>
          <div class="gh-chat-title"><div class="gh-chat-name" id="ghChatName">Messages</div><div class="gh-chat-status" id="ghChatStatus">Choose a conversation</div></div>
          <div class="gh-chat-actions"><button class="gh-chat-icon" type="button" data-gh-min title="Minimize">−</button><button class="gh-chat-icon" type="button" data-gh-close title="Close">×</button></div>
        </header>
        <div class="gh-chat-body" id="ghChatBody"><div class="gh-chat-empty">No messages yet</div></div>
        <form class="gh-chat-compose" id="ghChatForm">
          <button class="gh-chat-icon" type="button" data-gh-emoji>😊</button>
          <button class="gh-chat-icon" type="button" data-gh-image>📷</button>
          <input class="gh-chat-input" id="ghChatInput" placeholder="Write a message..." autocomplete="off" />
          <input id="ghChatImageInput" type="file" accept="image/*" hidden />
          <button class="gh-chat-send" type="submit">➤</button>
          <div class="gh-chat-emoji-panel" id="ghChatEmojiPanel">${EMOJIS.map(e=>`<button class="gh-chat-emoji" type="button" data-emoji="${esc(e)}">${esc(e)}</button>`).join('')}</div>
        </form>
      </section>`;
    document.body.appendChild(root);
    const toast=document.createElement('div'); toast.id='ghChatToast'; toast.className='gh-chat-toast'; document.body.appendChild(toast);
    root.querySelector('.gh-chat-pop-btn').addEventListener('click', ()=>{
      window.location.href = inboxHref();
    });
    root.querySelector('[data-gh-min]').addEventListener('click', minimize);
    root.querySelector('[data-gh-close]').addEventListener('click', close);
    root.querySelector('[data-gh-emoji]').addEventListener('click', ()=>document.getElementById('ghChatEmojiPanel')?.classList.toggle('open'));
    root.querySelector('#ghChatEmojiPanel').addEventListener('click', e=>{ const b=e.target.closest('[data-emoji]'); if(!b) return; const inp=document.getElementById('ghChatInput'); inp.value += b.dataset.emoji; inp.focus(); });
    root.querySelector('#ghChatForm').addEventListener('submit', send);
    root.querySelector('#ghChatBody').addEventListener('click', e=>{
      const pick=e.target.closest('[data-gh-reaction]');
      if(pick){ const wrap=pick.closest('[data-gh-msg-id]'); if(wrap) toggleReaction(wrap.dataset.ghMsgId, pick.dataset.ghReaction); pick.closest('[data-gh-reaction-panel]')?.classList.remove('open'); return; }
      const trigger=e.target.closest('[data-gh-react-trigger]');
      if(trigger){ trigger.parentElement?.querySelector('[data-gh-reaction-panel]')?.classList.toggle('open'); return; }
    });
    root.querySelector('[data-gh-image]').addEventListener('click', ()=>document.getElementById('ghChatImageInput')?.click());
    root.querySelector('#ghChatImageInput').addEventListener('change', sendImage);
    toast.addEventListener('click', ()=>{ if(toast.dataset.cid) openConversation(toast.dataset.cid); toast.classList.remove('show'); });
  }

  async function setHeader(conv){
    const oid=otherId(conv); state.activeOther=oid;
    const u=await getUser(oid);
    const av=document.getElementById('ghChatAvatar'); const name=document.getElementById('ghChatName'); const status=document.getElementById('ghChatStatus');
    if(av) av.innerHTML = u.avatar ? `<img src="${esc(u.avatar)}" alt="">` : esc(initials(u.name));
    if(name) name.textContent = u.name;
    if(status) status.textContent = 'Active conversation';
  }

  function reactionSummary(messageId){
    const rows=(state.reactions[messageId]&&state.reactions[messageId].rows)||[];
    const me=uid(); const counts={}; let mine='';
    rows.forEach(r=>{ const e=r.emoji||'❤️'; counts[e]=(counts[e]||0)+1; if(r.userId===me) mine=e; });
    return { mine, badges:Object.entries(counts).map(([e,c])=>`<span class="gh-chat-heart">${esc(e)} ${c>1?c:''}</span>`).join('') };
  }

  function mediaHtml(m){
    if(!m.mediaUrl) return '';
    if(m.mediaType==='image' || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(m.mediaUrl)) return `<a href="${esc(m.mediaUrl)}" target="_blank" rel="noopener"><img class="gh-chat-img" src="${esc(m.mediaUrl)}" alt="Message image" loading="lazy" decoding="async"></a>`;
    return `<a class="gh-chat-file" href="${esc(m.mediaUrl)}" target="_blank" rel="noopener">📎 Attachment</a>`;
  }

  function renderMessages(items){
    state.messages=items||[];
    const box=document.getElementById('ghChatBody'); if(!box) return;
    const me=uid();
    const visible=state.messages.filter(m=>!(Array.isArray(m.deletedFor)&&m.deletedFor.includes(me)));
    if(!visible.length){ box.innerHTML='<div class="gh-chat-empty">No messages yet</div>'; return; }
    box.innerHTML=visible.map(m=>{
      const mine=m.senderId===me || m.authorId===me;
      const sum=reactionSummary(m.id);
      const text=m.deleted?'<em>Message deleted</em>':esc(m.text||'');
      return `<div class="gh-chat-row ${mine?'mine':'theirs'}" data-gh-msg-id="${esc(m.id)}"><div class="gh-chat-msg-wrap"><div class="gh-chat-bubble">${text?`<div>${text}</div>`:''}${m.deleted?'':mediaHtml(m)}</div><button class="gh-chat-like ${sum.mine?'active':''}" type="button" data-gh-react-trigger title="React">${sum.mine?esc(sum.mine):'😊'}</button><div class="gh-chat-reaction-panel" data-gh-reaction-panel>${REACTIONS.map(e=>`<button type="button" data-gh-reaction="${esc(e)}">${esc(e)}</button>`).join('')}</div><div class="gh-chat-reaction-summary">${sum.badges}</div></div></div>`;
    }).join('');
    box.scrollTop=box.scrollHeight;
  }

  function applyReactions(reactions){
    const byMsg={};
    (reactions||[]).forEach(r=>{
      if(!r.messageId) return;
      byMsg[r.messageId]=byMsg[r.messageId]||{rows:[]};
      byMsg[r.messageId].rows.push(r);
    });
    state.reactions=byMsg;
    document.querySelectorAll('[data-gh-msg-id]').forEach(row=>{
      const sum=reactionSummary(row.dataset.ghMsgId);
      const btn=row.querySelector('[data-gh-react-trigger]');
      const box=row.querySelector('.gh-chat-reaction-summary');
      if(btn){ btn.classList.toggle('active', !!sum.mine); btn.textContent=sum.mine || '😊'; }
      if(box) box.innerHTML=sum.badges;
    });
  }

  function openUI(){ document.querySelector('.gh-chat-pop')?.classList.add('open'); state.open=true; showBtn(false); }
  function minimize(){ document.querySelector('.gh-chat-pop')?.classList.remove('open'); state.open=false; const u=countUnread(); showBtn(u>0,u); }
  function close(){ document.querySelector('.gh-chat-pop')?.classList.remove('open'); state.open=false; const u=countUnread(); showBtn(u>0,u); }
  function openLastOrFirst(){ const conv=state.convs[0]; if(conv) openConversation(conv.id); else openUI(); }

  function openConversation(cid){
    if(!cid) return;
    const conv=state.convs.find(c=>c.id===cid) || { id:cid, participants:[] };
    state.activeCid=cid; openUI(); setHeader(conv);
    if(state.unsubMsgs) state.unsubMsgs();
    if(state.unsubReactions) state.unsubReactions();
    state.unsubMsgs=window.GeoSocial.listenMessages(cid, renderMessages);
    if(window.GeoSocial.listenMessageReactions) state.unsubReactions=window.GeoSocial.listenMessageReactions(cid, applyReactions);
    try{ localStorage.setItem('gh_chat_seen_'+cid, String(Date.now())); }catch(e){}
    try{ window.GeoSocial.markConversationRead && window.GeoSocial.markConversationRead(cid); }catch(e){}
  }

  function send(e){
    if(e) e.preventDefault();
    const input=document.getElementById('ghChatInput'); const text=(input?.value||'').trim();
    if(!text || !state.activeCid) return;
    window.GeoSocial.sendMessage(state.activeCid, text, ok=>{ if(ok) input.value=''; document.getElementById('ghChatEmojiPanel')?.classList.remove('open'); });
  }

  async function toggleReaction(messageId, emoji){
    if(!state.activeCid || !messageId) return;
    try{
      if(window.GeoSocial && window.GeoSocial.toggleMessageReaction){
        await window.GeoSocial.toggleMessageReaction(state.activeCid, messageId, emoji || '❤️');
      }
    }catch(err){ console.warn('[ChatPopup] heart failed', err.message); }
  }


  async function sendImage(){
    const input=document.getElementById('ghChatImageInput');
    const file=input?.files && input.files[0];
    if(input) input.value='';
    if(!file || !state.activeCid) return;
    if(!file.type || !file.type.startsWith('image/')) return;
    try{
      const dataUrl=await new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(String(r.result||'')); r.onerror=reject; r.readAsDataURL(file); });
      const url=await window.GeoSocial.uploadImageDataUrl(dataUrl, 'messages');
      if(url) window.GeoSocial.sendMessage(state.activeCid, '', null, { mediaUrl:url, mediaType:'image' });
    }catch(err){ console.warn('[ChatPopup] image failed', err.message); }
  }


  async function showIncomingToast(conv){
    const oid=otherId(conv); const u=await getUser(oid); const toast=document.getElementById('ghChatToast'); if(!toast) return;
    toast.dataset.cid=conv.id;
    toast.innerHTML=`<div class="t-avatar">${u.avatar?`<img src="${esc(u.avatar)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`:esc(initials(u.name))}</div><div class="t-text"><div class="t-name">${esc(u.name)}</div><div class="t-msg">${esc(conv.lastMessage||'New message')}</div></div>`;
    toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'), 5200);
  }

  function handleConvs(convs){
    const previous = new Map(state.convs.map(c=>[c.id,c]));
    state.convs=convs||[];
    // Show floating button only when there are unread messages; hide when 0 or panel is open.
    const unread=countUnread();
    if(!state.open) showBtn(unread>0, unread); else showBtn(false);
    const me=uid();
    state.convs.forEach(conv=>{
      const t=ts(conv.updatedAt || conv.createdAt);
      const lastSeen = Number(localStorage.getItem('gh_chat_seen_'+conv.id) || '0');
      const was=previous.get(conv.id);
      const isIncoming = conv.lastSenderId && conv.lastSenderId !== me;
      const isNewAfterLoad = t > state.startedAt || (was && ts(was.updatedAt||was.createdAt) && t > ts(was.updatedAt||was.createdAt));
      if(isIncoming && isNewAfterLoad && t > lastSeen){
        showIncomingToast(conv);
        if(!state.open || state.activeCid !== conv.id) openConversation(conv.id);
      }
    });
  }

  function start(){
    mount();
    const auth=window.GeoFirebase?.auth;
    if(!auth?.currentUser){ showBtn(false); return; }
    // Don't show eagerly — handleConvs decides based on unread count (fail closed).
    if(state.unsubConvs) state.unsubConvs();
    const bizId=activeBusinessId();
    state.unsubConvs=(bizId && window.GeoSocial.listenBusinessConversations)
      ? window.GeoSocial.listenBusinessConversations(bizId, handleConvs)
      : window.GeoSocial.listenConversations(handleConvs);
  }

  window.GeoHubChat = {
    openConversation,
    openWithUser: function(userId){ if(!window.GeoSocial || !userId) return; window.GeoSocial.startConversation(userId, cid=>openConversation(cid)); },
    minimize, close
  };

  function safeStart(){
    mount(); // ensure DOM exists without showing button yet
    if(window.GeoSocial && window.GeoFirebase && window.GeoFirebase.auth){
      const auth=window.GeoFirebase.auth;
      if(auth?.onAuthStateChanged && !window.__GeoHubChatAuthBound){
        window.__GeoHubChatAuthBound = true;
        auth.onAuthStateChanged(()=>setTimeout(start,150));
      }
      start();
      return true;
    }
    return false;
  }

  function bootVisibleButton(){
    // Don't show button eagerly — handleConvs will reveal it only if unread > 0.
    let tries = 0;
    const timer = setInterval(()=>{
      tries += 1;
      if(safeStart() || tries > 40) clearInterval(timer);
    }, 250);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootVisibleButton, { once:true });
  else bootVisibleButton();
  window.addEventListener('GeoSocialReady', safeStart);
  window.addEventListener('GeoFirebaseReady', safeStart);
  window.addEventListener('GeoActorChanged', safeStart);
  window.addEventListener('storage', e=>{ if(e.key === 'gh_active_actor') safeStart(); });
})();
