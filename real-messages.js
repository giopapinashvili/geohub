(function(){
  'use strict';
  const esc = v => String(v == null ? '' : v).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  const $ = s => document.querySelector(s);
  let activeConversation = null, unsubConvs = null, unsubMsgs = null, sendingMessage = false;
  function ts(v){ return v && v.toMillis ? v.toMillis() : (v && v.seconds ? v.seconds*1000 : Number(v||Date.now())); }
  function whenReady(cb){ if(window.GeoSocial && window.GeoFirebase) return cb(); window.addEventListener('GeoSocialReady', cb, {once:true}); }
  function otherId(conv){ const uid=window.GeoFirebase?.auth?.currentUser?.uid; return (conv.participants||[]).find(id=>id!==uid) || ''; }
  async function userName(uid){
    try{ const GF=window.GeoFirebase; const snap=await GF.fs.getDoc(GF.fs.doc(GF.db,'users',uid)); if(snap.exists()){ const d=snap.data(); return d.fullName||d.displayName||d.name||d.username||d.email||'GeoHub User'; }}catch(e){}
    return 'GeoHub User';
  }
  async function renderConvs(convs){
    const list=$('#convList'); if(!list) return;
    if(!convs.length){ list.innerHTML='<div class="conv-empty"><i class="fas fa-inbox"></i><p>No conversations yet</p></div>'; return; }
    const rows=[];
    for(const c of convs){ const oid=otherId(c); rows.push({c, oid, name: await userName(oid)}); }
    list.innerHTML=rows.map(({c,oid,name})=>'<div class="conv-item '+(c.id===activeConversation?'active':'')+'" data-conv-id="'+esc(c.id)+'"><a class="conv-av-wrap" href="profile.html?id='+esc(oid)+'" data-open-user-profile="'+esc(oid)+'"><div class="av-placeholder">'+esc(name[0]||'U')+'</div></a><div class="conv-info"><div class="conv-top-row"><a class="conv-name" href="profile.html?id='+esc(oid)+'" data-open-user-profile="'+esc(oid)+'">'+esc(name)+'</a></div><div class="conv-bottom-row"><span class="conv-preview">'+esc(c.lastMessage||'No messages yet')+'</span></div></div></div>').join('');
  }
  function renderMessages(items){
    const box=$('#chatMessages'); if(!box) return;
    const uid=window.GeoFirebase?.auth?.currentUser?.uid;
    if(!items.length){ box.innerHTML='<div class="chat-empty"><i class="fas fa-comment-dots"></i><p>No messages yet</p></div>'; return; }
    box.innerHTML=items.map(m=>'<div class="msg-row '+(m.senderId===uid?'sent':'received')+'"><div class="msg-col"><div class="msg-bubble-wrap"><div class="msg-bubble '+(m.senderId===uid?'bubble-sent':'bubble-recv')+'">'+esc(m.text||'')+'</div></div></div></div>').join('');
    box.scrollTop=box.scrollHeight;
  }
  async function openConversation(cid){
    activeConversation=cid;
    if(unsubMsgs) unsubMsgs();
    const header=$('#chatHeader');
    if(header){
      const convs = window.__geohubLastConvs || [];
      const conv = convs.find(x => x.id === cid) || null;
      const oid = conv ? otherId(conv) : '';
      userName(oid).then(name => { header.innerHTML='<div style="padding:18px 20px;font-weight:700"><a href="profile.html?id='+esc(oid)+'" style="color:inherit;text-decoration:none">'+esc(name || 'Messages')+'</a></div>'; });
    }
    unsubMsgs=window.GeoSocial.listenMessages(cid, renderMessages);
    renderComposer();
  }
  function renderComposer(){
    const existingInput = $('#msgInput');
    const existingSend = $('.send-btn');
    function sendCurrent(){
      if(sendingMessage) return;
      const input = $('#msgInput') || $('#messageInput');
      const text=(input?.value||'').trim();
      if(!text||!activeConversation)return;
      sendingMessage = true;
      window.GeoSocial.sendMessage(activeConversation,text,()=>{
        input.value='';
        setTimeout(()=>{ sendingMessage = false; }, 350);
      });
      setTimeout(()=>{ sendingMessage = false; }, 3500);
    }
    window.sendMsg = sendCurrent;
    if(existingInput){
      existingInput.onkeydown = e => { if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); sendCurrent(); } };
      if(existingSend) existingSend.onclick = sendCurrent;
      return;
    }
    let form=$('#messageForm');
    if(!form){
      const area=$('.chat-input-area') || $('.message-input-area') || $('#chatComposer');
      if(!area) return;
      area.innerHTML='<form id="messageForm" class="message-form" style="display:flex;gap:10px;width:100%"><input id="messageInput" type="text" placeholder="Write a message..." autocomplete="off" style="flex:1"><button type="submit"><i class="fas fa-paper-plane"></i></button></form>';
      form=$('#messageForm');
    }
    form.onsubmit=e=>{ e.preventDefault(); sendCurrent(); };
  }
  function init(){
    const auth=window.GeoFirebase?.auth;
    if(!auth?.currentUser){ setTimeout(init,250); return; }
    const target=new URLSearchParams(location.search).get('with');
    if(target){ window.GeoSocial.startConversation(target, cid=>openConversation(cid)); }
    if(unsubConvs) unsubConvs();
    unsubConvs=window.GeoSocial.listenConversations(convs=>{ window.__geohubLastConvs = convs || []; renderConvs(convs); if(!activeConversation && convs[0]) openConversation(convs[0].id); });
    document.addEventListener('click', e=>{ if(e.target.closest('[data-open-user-profile]')) return; const row=e.target.closest('[data-conv-id]'); if(row) openConversation(row.dataset.convId); });
  }
  whenReady(init);
})();
