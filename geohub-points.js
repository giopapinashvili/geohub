
(function(){
  'use strict';
  var state = { tab: new URLSearchParams(location.search).get('tab') || 'store', wallet: null, rewards: [], coupons: [] };
  function $(s,r){return (r||document).querySelector(s)} function $all(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function compact(n){n=Number(n||0);return n>=1000?(n/1000).toFixed(n>=10000?0:1)+'k':String(n)}
  function ts(v){if(!v)return 0;if(typeof v.toMillis==='function')return v.toMillis();if(v.seconds)return v.seconds*1000;if(v instanceof Date)return v.getTime();return Date.parse(v)||0}
  function dateText(v){var t=ts(v);return t?new Date(t).toLocaleDateString('ka-GE'):''}
  function GF(){return window.GeoFirebase} function GS(){return window.GeoSocial} function user(){return GF()&&GF().auth&&GF().auth.currentUser}
  function ready(cb){if(window.GeoFirebase&&window.GeoSocial)return cb();window.addEventListener('GeoSocialReady',function(){cb()},{once:true})}
  function toast(msg,type){if(GS()&&GS().toast)return GS().toast(msg,type); alert(msg)}
  function applyTheme(){var p=document.documentElement.getAttribute('data-gh-theme')||document.body.getAttribute('data-gh-theme')||((window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light');document.documentElement.setAttribute('data-gh-theme',p);document.body.setAttribute('data-gh-theme',p)}
  function page(){return document.body && document.body.dataset && document.body.dataset.gpPage}

  function renderRewardsPage(){
    applyTheme();
    document.body.classList.add('gp-body');
    document.body.innerHTML='<div class="gh-shell gp-app-shell"><header class="gh-topbar"><a class="gh-brand" href="feed.html"><div class="gh-brand-mark">GH</div><span>Geo<span>Hub</span></span></a><div class="gh-top-search"><i class="fas fa-search"></i><input placeholder="Search GeoHub…" id="gpGlobalSearch"></div><div class="gh-top-actions"><a class="gh-icon-btn" href="feed.html" title="Home"><i class="fas fa-house"></i></a><a class="gh-icon-btn" href="explore.html" title="Discover"><i class="fas fa-compass"></i></a><button class="gh-icon-btn gh-theme-toggle" id="gpTheme" title="Toggle theme"><i class="fas fa-circle-half-stroke"></i></button><a class="gh-icon-btn" href="messages.html" title="Messages"><i class="fas fa-comment-dots"></i></a><a class="gh-user-btn" href="'+(user()?('profile.html?id='+encodeURIComponent(user().uid)):'auth.html')+'"><span class="gh-avatar">'+(user()?esc(((user().displayName||user().email||'GH')[0]||'G')):'GH')+'</span><span>'+(user()?esc((user().displayName||user().email||'Profile').split(' ')[0]):'Sign in')+'</span></a></div></header><div class="gh-layout"><aside class="gh-left"><nav class="gh-panel"><a class="gh-nav-item" href="feed.html"><i class="fas fa-house"></i><span>Home</span></a><a class="gh-nav-item" href="explore.html"><i class="fas fa-compass"></i><span>Discover</span></a><a class="gh-nav-item" href="business.html"><i class="fas fa-store"></i><span>Businesses</span></a><a class="gh-nav-item" href="groups.html"><i class="fas fa-users"></i><span>Groups</span></a><a class="gh-nav-item active" href="rewards.html"><i class="fas fa-gift"></i><span>Rewards</span></a><a class="gh-nav-item" href="'+(user()?('profile.html?id='+encodeURIComponent(user().uid)):'auth.html')+'"><i class="fas fa-user"></i><span>Profile</span></a></nav></aside><main class="gh-center"><div class="gp-shell"><section class="gp-hero"><div class="gp-wallet"><div class="gp-kicker">Loyalty wallet</div><div class="gp-balance" id="gpBalance">0 <span>GeoPoints</span></div><p style="max-width:680px;color:var(--gp-muted);line-height:1.7">Collect GeoPoints, support friends/creators, unlock GeoHub boosts and redeem partner coupons. GeoPoints are loyalty points only — not money and not cash-out.</p><div class="gp-stats"><div class="gp-stat"><strong id="gpEarned">0</strong><span>Earned</span></div><div class="gp-stat"><strong id="gpReceived">0</strong><span>Received</span></div><div class="gp-stat"><strong id="gpSent">0</strong><span>Sent</span></div><div class="gp-stat"><strong id="gpSpent">0</strong><span>Spent/Redeemed</span></div></div></div><div class="gp-terms"><div class="gp-kicker">Important terms</div><h2>No cash value</h2><p>GeoPoints are internal loyalty/reward points. They cannot be exchanged for cash, cryptocurrency or legal tender. They can unlock GeoHub platform benefits, partner discounts, coupons and promotional rewards only.</p><div class="gp-warning"><strong>PlayStation example:</strong> users do not buy a console with points as money. They may redeem a limited partner campaign coupon, for example a 20%, 50% or 100% discount voucher with clear terms.</div></div></section><div class="gp-tabs"><button class="gp-tab" data-tab="store">Reward Store</button><button class="gp-tab" data-tab="coupons">My Coupons</button><button class="gp-tab" data-tab="send">Send Points</button><button class="gp-tab" data-tab="history">History</button><button class="gp-tab" data-tab="spend">GeoHub Boosts</button></div><main id="gpContent"></main></div></main><aside class="gh-right"><div class="gh-panel gh-right-widget"><div class="gh-section-title"><h3>GeoPoints rules</h3></div><p class="gh-small">No cash-out. No crypto. Partner coupons only.</p></div></aside></div></div>';
    bindPage();
    ready(function(){ startListeners(); });
  }
  function bindPage(){
    var gpSearch=$('#gpGlobalSearch'); if(gpSearch){gpSearch.addEventListener('keydown',function(e){if(e.key==='Enter'&&gpSearch.value.trim())location.href='search.html?q='+encodeURIComponent(gpSearch.value.trim());});}
    document.addEventListener('click',function(e){
      var t=e.target.closest('[data-tab]'); if(t){state.tab=t.dataset.tab; paint();}
      var buy=e.target.closest('[data-buy-reward]'); if(buy){ if(!user())return location.href='auth.html'; GS().redeemReward(buy.dataset.buyReward,function(ok){if(ok){state.tab='coupons';paint();}}); }
      var spend=e.target.closest('[data-spend-boost]'); if(spend){ if(!user())return location.href='auth.html'; var amount=Number(spend.dataset.amount||0); GS().spendPoints(amount, spend.dataset.label||'GeoHub boost', 'platform_perk', spend.dataset.boost||'', function(ok){if(ok)paint();}); }
      if(e.target.closest('#gpSendBtn')) sendPoints();
      if(e.target.closest('#gpTheme')){var cur=document.documentElement.getAttribute('data-gh-theme')==='dark'?'light':'dark';document.documentElement.setAttribute('data-gh-theme',cur);document.body.setAttribute('data-gh-theme',cur);}
    });
  }
  function startListeners(){
    var u=user();
    if(u && GS().listenWallet) GS().listenWallet(u.uid,function(w){state.wallet=w;updateWallet(); if(state.tab==='history'||state.tab==='send'||state.tab==='spend')paint();});
    else {state.wallet={balance:0,earned:0,received:0,sent:0,spent:0,redeemed:0,transactions:[]};updateWallet();}
    if(u && GS().listenMyCoupons) GS().listenMyCoupons(u.uid,function(c){state.coupons=c; if(state.tab==='coupons')paint();});
    if(GS().listenRewards) GS().listenRewards(function(r){state.rewards=r; if(state.tab==='store')paint();});
    paint();
  }
  function updateWallet(){var w=state.wallet||{};[['gpBalance',compact(w.balance||0)+' <span>GeoPoints</span>'],['gpEarned',compact(w.earned||0)],['gpReceived',compact(w.received||0)],['gpSent',compact(w.sent||0)],['gpSpent',compact((w.spent||0)+(w.redeemed||0))]].forEach(function(x){var el=$('#'+x[0]); if(el)el.innerHTML=x[1];});}
  function paint(){
    $all('.gp-tab').forEach(function(b){b.classList.toggle('active',b.dataset.tab===state.tab)});updateWallet();
    var box=$('#gpContent'); if(!box)return;
    if(state.tab==='store')return paintStore(box);
    if(state.tab==='coupons')return paintCoupons(box);
    if(state.tab==='send')return paintSend(box);
    if(state.tab==='spend')return paintBoosts(box);
    return paintHistory(box);
  }
  function paintStore(box){
    if(!state.rewards.length){box.innerHTML='<div class="gp-empty"><i class="fas fa-gift"></i><h2>No partner rewards yet</h2><p>Business owners can create coffee, gym visit, course discount, product coupon or special discount rewards from their Business Dashboard.</p></div>';return;}
    box.innerHTML='<div class="gp-section-title"><h2>Partner rewards & discounts</h2><span class="gp-chip">'+state.rewards.length+' active</span></div><div class="gp-grid">'+state.rewards.map(function(r){var price=Number(r.pointPrice||r.price||0);var q=Number(r.quantityRemaining||0), qt=Number(r.quantityTotal||0);return '<article class="gp-card"><div class="gp-kicker">'+esc(r.rewardType||'reward')+'</div><h3>'+esc(r.title||r.name||'Reward')+'</h3><p>'+esc(r.description||'Partner coupon / discount reward')+'</p><div class="gp-meta"><span class="gp-price"><i class="fas fa-coins"></i>'+compact(price)+' pts</span>'+(r.businessName?'<span class="gp-chip">'+esc(r.businessName)+'</span>':'')+(qt>0?'<span class="gp-chip">'+q+' left</span>':'<span class="gp-chip">Unlimited</span>')+'</div>'+(r.terms?'<p style="font-size:.82rem">'+esc(r.terms)+'</p>':'')+'<button class="gp-btn" data-buy-reward="'+esc(r.id)+'"><i class="fas fa-ticket"></i>Unlock coupon</button></article>';}).join('')+'</div>';
  }
  function paintCoupons(box){
    if(!user()){box.innerHTML='<div class="gp-empty"><h2>Sign in to see your coupons</h2><a class="gp-btn" href="auth.html">Sign in</a></div>';return;}
    if(!state.coupons.length){box.innerHTML='<div class="gp-empty"><i class="fas fa-ticket"></i><h2>No coupons yet</h2><p>Unlock rewards with GeoPoints and coupon codes will appear here.</p></div>';return;}
    box.innerHTML='<div class="gp-section-title"><h2>My coupons</h2><span class="gp-chip">Show this code to the partner</span></div><div class="gp-grid">'+state.coupons.map(function(c){return '<article class="gp-card"><div class="gp-kicker">'+esc(c.status||'active')+'</div><h3>'+esc(c.rewardTitle||'Reward coupon')+'</h3><div class="gp-code">'+esc(c.code||c.qrValue||'')+'</div><div class="gp-meta"><span class="gp-price">'+compact(c.pointPrice||0)+' pts</span>'+(c.expiresAt?'<span class="gp-chip">Expires '+esc(c.expiresAt)+'</span>':'')+'</div><p>One-time use. Non-cash, non-refundable partner coupon.</p></article>';}).join('')+'</div>';
  }
  function paintSend(box){
    if(!user()){box.innerHTML='<div class="gp-empty"><h2>Sign in to send GeoPoints</h2><a class="gp-btn" href="auth.html">Sign in</a></div>';return;}
    box.innerHTML='<section class="gp-card" style="max-width:720px"><div class="gp-section-title"><h2>Send GeoPoints</h2><span class="gp-chip">Balance: '+compact((state.wallet||{}).balance||0)+' pts</span></div><div class="gp-form"><input class="gp-input" id="gpRecipient" placeholder="Recipient email, username or user id"><input class="gp-input" id="gpAmount" type="number" min="1" placeholder="Amount"><textarea class="gp-textarea" id="gpMessage" placeholder="Message, e.g. support for your content"></textarea><button class="gp-btn" id="gpSendBtn"><i class="fas fa-paper-plane"></i>Send Points</button></div><p style="color:var(--gp-muted);line-height:1.6;margin-top:16px">Use this for friend help, creator support and group goals. Selling GeoPoints or requesting cash-out is not allowed.</p></section>';
  }
  function sendPoints(){var btn=$('#gpSendBtn'); if(btn&&btn.disabled)return; var r=$('#gpRecipient').value.trim(), a=$('#gpAmount').value, m=$('#gpMessage').value; if(!r||!a)return toast('Recipient and amount are required','error'); if(btn){btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i>Sending…';} GS().sendPoints(r,a,m,function(ok){if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-paper-plane"></i>Send Points';} if(ok){$('#gpRecipient').value='';$('#gpAmount').value='';$('#gpMessage').value='';state.tab='history';paint();}});}
  function paintBoosts(box){
    var items=[['post_boost',500,'Highlight a post for 24 hours'],['business_boost',2000,'Feature a business card in Discover'],['event_highlight',1500,'Highlight an event'],['creator_boost',3000,'Creator profile boost'],['premium_badge',5000,'Premium explorer badge']];
    box.innerHTML='<div class="gp-section-title"><h2>GeoHub internal boosts</h2><span class="gp-chip">Platform benefits</span></div><div class="gp-grid">'+items.map(function(i){return '<article class="gp-card"><div class="gp-kicker">GeoHub perk</div><h3>'+esc(i[2])+'</h3><p>Spend GeoPoints inside GeoHub. This is not a cash purchase and cannot be refunded as money.</p><div class="gp-price">'+compact(i[1])+' pts</div><br><br><button class="gp-btn" data-spend-boost="'+i[0]+'" data-amount="'+i[1]+'" data-label="'+esc(i[2])+'">Use GeoPoints</button></article>';}).join('')+'</div>';
  }
  function paintHistory(box){
    var tx=(state.wallet&&state.wallet.transactions)||[]; if(!tx.length){box.innerHTML='<div class="gp-empty"><i class="fas fa-clock"></i><h2>No GeoPoints history yet</h2><p>Earn, send or redeem GeoPoints and your history will appear here.</p></div>';return;}
    box.innerHTML='<div class="gp-section-title"><h2>Transaction history</h2><span class="gp-chip">'+tx.length+' records</span></div><div class="gp-list">'+tx.map(function(t){var incoming=(t.toUserId===user().uid&&(t.type==='earn'||t.type==='gift'||t.type==='refund'||t.type==='admin_adjustment'));var sign=incoming?'+':'-';return '<div class="gp-row"><div><strong>'+esc(t.reason||t.type||'GeoPoints')+'</strong><br><small>'+esc(t.type||'')+' · '+dateText(t.createdAt)+' '+(t.message?'· '+esc(t.message):'')+'</small></div><strong style="color:'+(incoming?'var(--gp-green)':'var(--gp-gold)')+'">'+sign+compact(t.amount||0)+'</strong></div>';}).join('')+'</div>';
  }
  function updateProfileWallet(){
    ready(function(){var u=user(); if(!u||!GS().listenWallet)return; GS().listenWallet(u.uid,function(w){
      var pts=compact(w.balance||0); var earned=compact(w.earned||0); var mini=$('.mini-wallet-pts'); if(mini)mini.textContent=pts+' pts'; var sub=$('.mini-wallet-sub'); if(sub)sub.innerHTML='<strong>'+earned+' pts</strong> earned · '+(w.redeemed||0)+' redeemed'; var fill=$('.mini-wallet-fill'); if(fill)fill.style.width=Math.min(100,((w.balance||0)%10000)/100)+'%';
      var stats=$all('.profile-stats-bar .pstat-value'); if(stats[4])stats[4].textContent=pts;
      var tab=$('#tab-rewards'); if(tab){tab.innerHTML='<div class="wallet-card"><div class="wallet-header"><div><div class="wallet-points">'+pts+'</div><div class="wallet-points-label">GeoPoints balance</div></div><a href="rewards.html" class="btn btn-primary btn-sm">Open Reward Store</a></div><div class="wallet-progress-wrap"><div class="wallet-progress-label"><span>Next perk progress</span><span>'+((w.balance||0)%10000)+' / 10000</span></div><div class="wallet-progress-bar"><div class="wallet-progress-fill" style="width:'+Math.min(100,((w.balance||0)%10000)/100)+'%"></div></div></div><div class="wallet-stats"><div><strong>'+compact(w.earned||0)+'</strong><span>Earned</span></div><div><strong>'+compact(w.received||0)+'</strong><span>Received</span></div><div><strong>'+compact((w.spent||0)+(w.redeemed||0))+'</strong><span>Spent</span></div></div></div>';}
    });});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){ if(page()==='rewards')renderRewardsPage(); else updateProfileWallet(); }); else { if(page()==='rewards')renderRewardsPage(); else updateProfileWallet(); }
})();
