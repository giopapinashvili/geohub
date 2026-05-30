// GeoHub Story Editor v2 — Instagram-style
(function () {
  'use strict';

  var GRADIENTS = [
    'linear-gradient(135deg,#10b981,#064e3b)',
    'linear-gradient(135deg,#3b82f6,#1e40af)',
    'linear-gradient(135deg,#8b5cf6,#4c1d95)',
    'linear-gradient(135deg,#f59e0b,#92400e)',
    'linear-gradient(135deg,#ec4899,#831843)',
    'linear-gradient(135deg,#06b6d4,#0e7490)',
    'linear-gradient(135deg,#667eea,#764ba2)',
    'linear-gradient(135deg,#f093fb,#f5576c)',
    'linear-gradient(135deg,#4facfe,#00f2fe)',
    'linear-gradient(135deg,#43e97b,#38f9d7)',
    'linear-gradient(135deg,#fa709a,#fee140)',
    'linear-gradient(135deg,#ff9a9e,#fecfef)',
    'linear-gradient(135deg,#0f172a,#1e293b)',
    'linear-gradient(135deg,#ef4444,#991b1b)',
    '#111111','#ffffff','#000000'
  ];
  var EMOJIS = ['❤️','🔥','😂','😍','🎉','👋','💪','🙏','😎','🤩','✨','🌟','💯','🥳','😭','💀','🫶','🌹','🎶','🏆','🇬🇪','🌱','👑','🍕','☕','🎵','🥰','💙','🎈','🦋','🌊','🏔️','🌸','🍀','⭐','🌙','☀️','🌈','🦅','🏅'];
  var TXT_COLS  = ['#ffffff','#000000','#ffd700','#ff4757','#2ed573','#1e90ff','#ff6b81','#eccc68','#a29bfe','#fd79a8'];
  var DRAW_COLS = ['#ffffff','#ff0000','#00ff00','#0000ff','#ffff00','#ff69b4','#000000','#ffa500','#00ffff','#8B5CF6'];

  // ─── State ───────────────────────────────────────────────────────────────
  var S = {};
  var _activePanel = null;
  var _selEl = null;
  var _drawCtx = null;
  var _isDrawing = false;

  function reset() {
    S = {
      bg: GRADIENTS[0],
      mediaFile: null, mediaUrl: '', mediaType: '',
      imgX: 0, imgY: 0, imgScale: 1,
      elements: [],
      drawColor: '#ffffff', drawSize: 6,
      duration: '24h', textColor: '#ffffff',
      poll: null, link: null, question: null,
      hashtags: [], mentions: [],
      countdown: null,
    };
    _activePanel = null; _selEl = null; _drawCtx = null; _isDrawing = false;
  }

  // ─── Utils ───────────────────────────────────────────────────────────────
  function esc(v){ return String(v==null?'':v).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function uid(){ return Math.random().toString(36).slice(2,9); }
  function q(s){ return document.querySelector(s); }
  function GS(){ return window.GeoSocial||null; }
  function toast(msg){ var ov=q('#seOv'); if(!ov){if(window.toast)window.toast(msg);return;} var t=document.createElement('div'); t.className='se-toast'; t.textContent=msg; ov.appendChild(t); setTimeout(function(){t.remove();},2400); }

  // ─── CSS ─────────────────────────────────────────────────────────────────
  function css(){
    if(q('#se-css2'))return;
    var s=document.createElement('style'); s.id='se-css2';
    s.textContent=`
    .se-ov{position:fixed;inset:0;z-index:99999;font-family:Inter,-apple-system,sans-serif;user-select:none;-webkit-user-select:none;background:#000;overflow:hidden}
    /* Top bar — floating */
    .se-top{position:absolute;top:0;left:0;right:0;z-index:20;display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:linear-gradient(to bottom,rgba(0,0,0,.6) 0%,transparent 100%)}
    .se-close{width:36px;height:36px;border-radius:50%;border:none;background:rgba(255,255,255,.2);color:#fff;font-size:.95rem;cursor:pointer;display:flex;align-items:center;justify-content:center}
    .se-pub{padding:9px 22px;border-radius:24px;border:none;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-weight:700;font-size:.9rem;cursor:pointer;display:flex;align-items:center;gap:6px}
    .se-pub:disabled{opacity:.5;cursor:not-allowed}
    .se-actor{display:flex;align-items:center;gap:8px;color:#fff;font-weight:600;font-size:.88rem}
    /* Canvas — full screen */
    .se-cwrap{position:absolute;inset:0;z-index:1}
    .se-cv{position:relative;width:100%;height:100%;overflow:hidden;touch-action:none}
    .se-cv-imgwrap{position:absolute;inset:0;overflow:hidden;touch-action:none}
    .se-cv-img{position:absolute;top:50%;left:50%;transform-origin:center center;object-fit:cover;will-change:transform;pointer-events:none;min-width:100%;min-height:100%}
    .se-dc{position:absolute;inset:0;width:100%;height:100%;display:none;cursor:crosshair;touch-action:none;z-index:6}
    .se-dc.on{display:block}
    /* Elements */
    .se-el{position:absolute;cursor:move;transform-origin:center;touch-action:none;display:inline-flex;align-items:center;justify-content:center;z-index:4;line-height:1}
    .se-el.sel::after{content:"";position:absolute;inset:-6px;border:2px dashed rgba(255,255,255,.9);border-radius:8px;pointer-events:none}
    .se-el-del{position:absolute;top:-14px;right:-14px;width:26px;height:26px;border-radius:50%;background:#ef4444;color:#fff;font-size:.8rem;border:none;cursor:pointer;display:none;align-items:center;justify-content:center;z-index:7}
    .se-el.sel .se-el-del{display:flex}
    .se-el-scale{position:absolute;bottom:-14px;right:-14px;width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,.9);color:#333;font-size:.7rem;border:none;cursor:nwse-resize;display:none;align-items:center;justify-content:center;z-index:7;touch-action:none}
    .se-el.sel .se-el-scale{display:flex}
    .se-el-txt{font-weight:800;text-shadow:0 2px 10px rgba(0,0,0,.7);white-space:pre-wrap;text-align:center;max-width:260px;word-break:break-word}
    /* Stickers */
    .se-sticker{position:absolute;background:rgba(255,255,255,.15);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.3);border-radius:14px;padding:8px 14px;color:#fff;font-size:.82rem;max-width:260px;text-align:center}
    /* Toolbar — floating at bottom */
    .se-tb{position:absolute;bottom:0;left:0;right:0;z-index:20;background:linear-gradient(to top,rgba(0,0,0,.7) 0%,transparent 100%);padding:36px 12px 20px;display:flex;justify-content:center;align-items:center;gap:8px;flex-wrap:wrap}
    .se-t{display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 10px;border-radius:12px;border:none;background:rgba(255,255,255,.15);backdrop-filter:blur(8px);color:#e5e7eb;font-size:.65rem;cursor:pointer;transition:background .15s;white-space:nowrap}
    .se-t i{font-size:1rem}
    .se-t:hover,.se-t.on{background:rgba(255,255,255,.3);color:#fff}
    .se-t.on{color:#10b981}
    /* Panel */
    .se-pnl{position:absolute;bottom:0;left:0;right:0;background:rgba(10,14,26,.97);border-top:1px solid rgba(255,255,255,.12);padding:14px 14px 24px;z-index:30;backdrop-filter:blur(16px);max-height:55vh;overflow-y:auto}
    .se-ph{color:#9ca3af;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:11px}
    .se-close-pnl{float:right;background:none;border:none;color:#6b7280;font-size:1.1rem;cursor:pointer;margin-top:-2px}
    /* Grids */
    .se-bggrid{display:flex;flex-wrap:wrap;gap:7px}
    .se-bgsw{width:44px;height:44px;border-radius:10px;border:2.5px solid transparent;cursor:pointer;transition:all .15s;flex-shrink:0}
    .se-bgsw.sel{border-color:#10b981;transform:scale(1.1)}
    .se-emgrid{display:flex;flex-wrap:wrap;gap:5px}
    .se-emb{font-size:1.55rem;padding:5px;border:none;background:none;cursor:pointer;border-radius:7px;transition:background .1s;line-height:1}
    .se-emb:hover{background:rgba(255,255,255,.12)}
    /* Inputs */
    .se-inp{width:100%;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.18);border-radius:9px;color:#fff;padding:10px 13px;font-size:.95rem;outline:none;margin-bottom:9px;box-sizing:border-box}
    .se-inp::placeholder{color:#6b7280}
    .se-colrow{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
    .se-cdot{width:28px;height:28px;border-radius:50%;border:2.5px solid transparent;cursor:pointer;transition:all .15s;flex-shrink:0}
    .se-cdot.sel{border-color:#fff;transform:scale(1.2)}
    .se-btn-g{padding:10px 20px;border-radius:9px;border:none;background:#10b981;color:#fff;font-weight:700;cursor:pointer;font-size:.88rem;margin-right:8px}
    .se-btn-ghost{padding:9px 16px;border-radius:9px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.07);color:#d1d5db;cursor:pointer;font-size:.88rem}
    /* Draw */
    .se-dcols{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
    .se-dcol{width:32px;height:32px;border-radius:50%;border:2.5px solid transparent;cursor:pointer;flex-shrink:0;transition:all .15s}
    .se-dcol.sel{border-color:#fff;transform:scale(1.1)}
    /* Duration */
    .se-durbtns{display:flex;gap:6px;flex-wrap:wrap}
    .se-durbtn{padding:8px 16px;border-radius:20px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.07);color:#d1d5db;cursor:pointer;font-size:.85rem}
    .se-durbtn.sel{background:#10b981;border-color:#10b981;color:#fff;font-weight:700}
    /* Img control */
    .se-imgctrl{display:flex;flex-direction:column;gap:10px}
    .se-imgctrl label{color:#9ca3af;font-size:.82rem}
    .se-imgctrl input[type=range]{width:100%}
    /* Poll */
    .se-poll-row{display:flex;gap:8px;margin-bottom:8px}
    /* Progress */
    .se-prog{position:absolute;bottom:0;left:0;right:0;height:3px;background:rgba(255,255,255,.12);z-index:50}
    .se-progf{height:100%;background:#10b981;transition:width .2s;width:0}
    /* Toast */
    .se-toast{position:absolute;top:64px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.88);color:#fff;padding:8px 18px;border-radius:20px;font-size:.85rem;white-space:nowrap;pointer-events:none;z-index:60}
    /* Hashtag pills */
    .se-pills{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
    .se-pill{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:rgba(16,185,129,.2);border:1px solid rgba(16,185,129,.35);border-radius:20px;color:#10b981;font-size:.78rem}
    .se-pill button{background:none;border:none;color:#10b981;cursor:pointer;font-size:.85rem;padding:0;line-height:1}
    `;
    document.head.appendChild(s);
  }

  // ─── Build DOM ───────────────────────────────────────────────────────────
  function buildDOM(me){
    var avH = me.avatar
      ? '<img src="'+esc(me.avatar)+'" style="width:30px;height:30px;border-radius:50%;object-fit:cover" alt="">'
      : '<div style="width:30px;height:30px;border-radius:50%;background:#10b981;display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff">'+esc((me.name||'G')[0].toUpperCase())+'</div>';

    var tools = [
      {id:'stPhoto',  icon:'fa-image',          label:'ფოტო'},
      {id:'stBg',     icon:'fa-palette',         label:'ფონი'},
      {id:'stImgCtrl',icon:'fa-crop-simple',     label:'ჩამოჭრა'},
      {id:'stDraw',   icon:'fa-pen-nib',         label:'ხატვა'},
      {id:'stEmoji',  icon:'fa-face-smile',      label:'Emoji'},
      {id:'stText',   icon:'fa-font',            label:'ტექსტი'},
      {id:'stPoll',   icon:'fa-check-to-slot',   label:'გამოკითხვა'},
      {id:'stQA',     icon:'fa-question-circle', label:'კითხვა'},
      {id:'stLink',   icon:'fa-link',            label:'ლინკი'},
      {id:'stHash',   icon:'fa-hashtag',         label:'ჰეშთეგი'},
      {id:'stMention',icon:'fa-at',              label:'მენშენი'},
      {id:'stCd',     icon:'fa-hourglass-half',  label:'ტაიმერი'},
      {id:'stDur',    icon:'fa-clock',           label:'ხანგრძლივობა'},
    ];

    var el=document.createElement('div');
    el.className='se-ov'; el.id='seOv';
    el.innerHTML=
      '<div class="se-top">'+
        '<button class="se-close" id="seClose"><i class="fas fa-times"></i></button>'+
        '<div class="se-actor">'+avH+'<span>'+esc(me.name||'GeoHub')+'</span></div>'+
        '<button class="se-pub" id="sePub"><i class="fas fa-paper-plane"></i> გამოქვეყნება</button>'+
      '</div>'+
      '<div class="se-cwrap" id="seCWrap">'+
        '<div class="se-cv" id="seCv">'+
          '<div class="se-cv-imgwrap" id="seImgWrap"></div>'+
          '<canvas class="se-dc" id="seDc"></canvas>'+
          '<div class="se-prog" id="seProg" style="display:none"><div class="se-progf" id="seProgF"></div></div>'+
        '</div>'+
      '</div>'+
      '<div class="se-tb" id="seTb">'+
        tools.map(function(t){
          return '<button class="se-t" id="'+t.id+'"><i class="fas '+t.icon+'"></i>'+t.label+'</button>';
        }).join('')+
      '</div>'+
      '<input type="file" id="seFile" accept="image/*,video/*" style="display:none">';
    return el;
  }

  // ─── Canvas sizing ───────────────────────────────────────────────────────
  function size(){
    var dc=q('#seDc'); if(!dc)return;
    dc.width=window.innerWidth; dc.height=window.innerHeight;
    updateImgTransform();
  }

  // ─── Background ──────────────────────────────────────────────────────────
  function applyBg(){
    var cv=q('#seCv'), iw=q('#seImgWrap');
    if(!cv||!iw)return;
    iw.innerHTML='';
    if(S.mediaUrl){
      var isV=S.mediaType==='video';
      var m=document.createElement(isV?'video':'img');
      m.className='se-cv-img'; m.id='seMediaEl';
      m.src=S.mediaUrl;
      if(isV){m.autoplay=true;m.loop=true;m.muted=true;m.playsInline=true;}
      iw.appendChild(m);
      cv.style.background='#000';
      updateImgTransform();
      wireImgDrag();
    } else {
      cv.style.background=S.bg;
    }
  }

  function updateImgTransform(){
    var m=q('#seMediaEl'); if(!m)return;
    var cv=q('#seCv'); if(!cv)return;
    var w=cv.offsetWidth||280, h=cv.offsetHeight||500;
    m.style.width=w+'px'; m.style.height=h+'px';
    m.style.marginLeft='-'+(w/2)+'px'; m.style.marginTop='-'+(h/2)+'px';
    m.style.transform='translate('+S.imgX+'px,'+S.imgY+'px) scale('+S.imgScale+')';
  }

  // ─── Image drag + pinch ──────────────────────────────────────────────────
  function wireImgDrag(){
    var iw=q('#seImgWrap'); if(!iw||iw._wired)return; iw._wired=true;
    var ptrs={}, startDist=null, startScale=1, startX=0, startY=0, startPX=0, startPY=0;

    iw.addEventListener('pointerdown',function(e){
      ptrs[e.pointerId]={x:e.clientX,y:e.clientY};
      iw.setPointerCapture(e.pointerId);
      var pts=Object.values(ptrs);
      if(pts.length===1){startPX=S.imgX;startPY=S.imgY;startX=e.clientX;startY=e.clientY;}
      if(pts.length===2){startDist=dist(pts[0],pts[1]);startScale=S.imgScale;}
    });
    iw.addEventListener('pointermove',function(e){
      ptrs[e.pointerId]={x:e.clientX,y:e.clientY};
      var pts=Object.values(ptrs);
      if(pts.length===1){
        S.imgX=startPX+(e.clientX-startX);
        S.imgY=startPY+(e.clientY-startY);
        updateImgTransform();
      } else if(pts.length===2){
        var d=dist(pts[0],pts[1]);
        S.imgScale=Math.max(0.3,Math.min(4,startScale*(d/startDist)));
        updateImgTransform();
      }
    });
    iw.addEventListener('pointerup',function(e){delete ptrs[e.pointerId];startDist=null;});
    iw.addEventListener('pointerleave',function(e){delete ptrs[e.pointerId];});
  }
  function dist(a,b){return Math.sqrt(Math.pow(a.x-b.x,2)+Math.pow(a.y-b.y,2));}

  // ─── Panel management ────────────────────────────────────────────────────
  function closePanel(){
    var p=q('#sePanel'); if(p)p.remove();
    _activePanel=null;
    document.querySelectorAll('.se-t').forEach(function(b){b.classList.remove('on');});
    var dc=q('#seDc'); if(dc){dc.classList.remove('on');_isDrawing=false;}
  }

  function panel(toolId, html){
    closePanel(); _activePanel=toolId;
    var btn=document.getElementById(toolId); if(btn)btn.classList.add('on');
    var p=document.createElement('div'); p.className='se-pnl'; p.id='sePanel';
    p.innerHTML='<button class="se-close-pnl" id="seClosePnl"><i class="fas fa-times"></i></button>'+html;
    var ov=q('#seOv'), tb=q('#seTb'); if(ov&&tb)ov.insertBefore(p,tb);
    q('#seClosePnl').addEventListener('click',closePanel);
    return p;
  }

  // ─── BG panel ────────────────────────────────────────────────────────────
  function showBgPanel(){
    var p=panel('stBg','<div class="se-ph">ფონის ფერი</div><div class="se-bggrid">'+
      GRADIENTS.map(function(g){
        return '<div class="se-bgsw'+(g===S.bg?' sel':'')+'" data-bg="'+esc(g)+'" style="background:'+g+(g==='#ffffff'?';border-color:#555':'')+';"></div>';
      }).join('')+'</div>');
    p.addEventListener('click',function(e){
      var sw=e.target.closest('.se-bgsw'); if(!sw)return;
      S.bg=sw.dataset.bg; S.mediaUrl=''; S.mediaFile=null; S.mediaType='';
      applyBg();
      p.querySelectorAll('.se-bgsw').forEach(function(s){s.classList.remove('sel');});
      sw.classList.add('sel');
    });
  }

  // ─── Image control panel ─────────────────────────────────────────────────
  function showImgCtrl(){
    if(!S.mediaUrl){toast('ჯერ ფოტო/ვიდეო დაამატე');return;}
    var p=panel('stImgCtrl','<div class="se-ph">ფოტოს კონტროლი</div><div class="se-imgctrl">'+
      '<label>მასშტაბი: <b id="seScV">'+Math.round(S.imgScale*100)+'%</b></label>'+
      '<input type="range" id="seScR" min="30" max="400" value="'+Math.round(S.imgScale*100)+'">'+
      '<label style="margin-top:8px">X პოზიცია</label>'+
      '<input type="range" id="seXR" min="-300" max="300" value="'+Math.round(S.imgX)+'">'+
      '<label>Y პოზიცია</label>'+
      '<input type="range" id="seYR" min="-400" max="400" value="'+Math.round(S.imgY)+'">'+
      '</div>'+
      '<button class="se-btn-ghost" id="seImgReset" style="margin-top:10px"><i class="fas fa-undo"></i> გადატვირთვა</button>');
    p.querySelector('#seScR').addEventListener('input',function(){
      S.imgScale=this.value/100; q('#seScV').textContent=this.value+'%'; updateImgTransform();
    });
    p.querySelector('#seXR').addEventListener('input',function(){S.imgX=+this.value;updateImgTransform();});
    p.querySelector('#seYR').addEventListener('input',function(){S.imgY=+this.value;updateImgTransform();});
    p.querySelector('#seImgReset').addEventListener('click',function(){
      S.imgX=0;S.imgY=0;S.imgScale=1;
      p.querySelector('#seScR').value=100; p.querySelector('#seXR').value=0; p.querySelector('#seYR').value=0;
      q('#seScV').textContent='100%'; updateImgTransform();
    });
  }

  // ─── Emoji panel ─────────────────────────────────────────────────────────
  function showEmojiPanel(){
    var p=panel('stEmoji','<div class="se-ph">Emoji — გადაიტანე კანვასზე</div><div class="se-emgrid">'+
      EMOJIS.map(function(e){return '<button class="se-emb" data-em="'+e+'">'+e+'</button>';}).join('')+'</div>');
    p.addEventListener('click',function(e){
      var b=e.target.closest('.se-emb'); if(!b)return;
      addEl({type:'emoji',content:b.dataset.em,x:50,y:40,fontSize:52,scale:1});
      closePanel();
    });
  }

  // ─── Text panel ──────────────────────────────────────────────────────────
  function showTextPanel(){
    var p=panel('stText','<div class="se-ph">ტექსტი</div>'+
      '<input class="se-inp" id="seTxIn" placeholder="შეიყვანე ტექსტი…" maxlength="120">'+
      '<div class="se-colrow">'+TXT_COLS.map(function(c){
        return '<div class="se-cdot'+(c===S.textColor?' sel':'')+'" data-col="'+c+'" style="background:'+c+(c==='#ffffff'?';border-color:#555':'')+';"></div>';
      }).join('')+'</div>'+
      '<button class="se-btn-g" id="seAddTx"><i class="fas fa-plus"></i> კანვასზე</button>');
    p.addEventListener('click',function(e){
      var d=e.target.closest('.se-cdot');
      if(d){S.textColor=d.dataset.col;p.querySelectorAll('.se-cdot').forEach(function(x){x.classList.remove('sel');});d.classList.add('sel');}
      if(e.target.closest('#seAddTx')){
        var txt=(q('#seTxIn').value||'').trim(); if(!txt)return;
        addEl({type:'text',content:txt,x:50,y:50,fontSize:28,color:S.textColor,scale:1});
        closePanel();
      }
    });
    var inp=q('#seTxIn');
    if(inp){inp.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();q('#seAddTx').click();}});setTimeout(function(){inp.focus();},80);}
  }

  // ─── Draw panel ──────────────────────────────────────────────────────────
  function showDrawPanel(){
    var p=panel('stDraw','<div class="se-ph">ხატვა</div>'+
      '<div class="se-dcols">'+DRAW_COLS.map(function(c){
        return '<div class="se-dcol'+(c===S.drawColor?' sel':'')+'" data-dc="'+c+'" style="background:'+c+(c==='#ffffff'?';border-color:#555':'')+';"></div>';
      }).join('')+'</div>'+
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><label style="color:#9ca3af;font-size:.8rem;white-space:nowrap">ზომა: <b id="seSzV">'+S.drawSize+'</b>px</label><input type="range" min="2" max="40" value="'+S.drawSize+'" id="seSzR" style="flex:1"></div>'+
      '<button class="se-btn-ghost" id="seClrD"><i class="fas fa-trash-alt"></i> გასუფთავება</button>');
    var dc=q('#seDc'); if(dc){dc.classList.add('on');_isDrawing=true;}
    var btn=q('#stDraw'); if(btn)btn.classList.add('on');
    p.addEventListener('click',function(e){
      var col=e.target.closest('.se-dcol');
      if(col){S.drawColor=col.dataset.dc;p.querySelectorAll('.se-dcol').forEach(function(d){d.classList.remove('sel');});col.classList.add('sel');if(_drawCtx)_drawCtx.strokeStyle=S.drawColor;}
      if(e.target.closest('#seClrD')&&_drawCtx){var dcEl=q('#seDc');_drawCtx.clearRect(0,0,dcEl.width,dcEl.height);}
    });
    q('#seSzR').addEventListener('input',function(){S.drawSize=+this.value;q('#seSzV').textContent=S.drawSize;if(_drawCtx)_drawCtx.lineWidth=S.drawSize;});
    wireDraw();
  }

  // ─── Poll panel ──────────────────────────────────────────────────────────
  function showPollPanel(){
    var def=S.poll||{q:'',a:'კი',b:'არა'};
    var p=panel('stPoll','<div class="se-ph">გამოკითხვა</div>'+
      '<input class="se-inp" id="sePQ" placeholder="კითხვა…" maxlength="80" value="'+esc(def.q)+'">'+
      '<div class="se-poll-row"><input class="se-inp" id="sePA" placeholder="პასუხი A" maxlength="40" value="'+esc(def.a)+'"><input class="se-inp" id="sePB" placeholder="პასუხი B" maxlength="40" value="'+esc(def.b)+'"></div>'+
      '<button class="se-btn-g" id="seAddPoll">დამატება</button>'+
      (S.poll?'<button class="se-btn-ghost" id="seRmPoll">წაშლა</button>':''));
    p.querySelector('#seAddPoll').addEventListener('click',function(){
      var qv=(q('#sePQ').value||'').trim();
      if(!qv)return;
      S.poll={q:qv,a:(q('#sePA').value||'კი').trim(),b:(q('#sePB').value||'არა').trim()};
      updateStickers(); closePanel(); toast('📊 გამოკითხვა დამატებულია');
    });
    var rm=p.querySelector('#seRmPoll');
    if(rm)rm.addEventListener('click',function(){S.poll=null;updateStickers();closePanel();});
  }

  // ─── Question panel ──────────────────────────────────────────────────────
  function showQAPanel(){
    var def=S.question||'';
    var p=panel('stQA','<div class="se-ph">კითხვის სტიკერი</div>'+
      '<input class="se-inp" id="seQAIn" placeholder="დასვი კითხვა…" maxlength="120" value="'+esc(def)+'">'+
      '<button class="se-btn-g" id="seAddQA">დამატება</button>'+
      (S.question?'<button class="se-btn-ghost" id="seRmQA">წაშლა</button>':''));
    p.querySelector('#seAddQA').addEventListener('click',function(){
      var v=(q('#seQAIn').value||'').trim(); if(!v)return;
      S.question=v; updateStickers(); closePanel(); toast('❓ კითხვა დამატებულია');
    });
    var rm=p.querySelector('#seRmQA');
    if(rm)rm.addEventListener('click',function(){S.question=null;updateStickers();closePanel();});
  }

  // ─── Link panel ──────────────────────────────────────────────────────────
  function showLinkPanel(){
    var def=S.link||{url:'',label:'გახსნა'};
    var p=panel('stLink','<div class="se-ph">ლინკის სტიკერი</div>'+
      '<input class="se-inp" id="seLUrl" placeholder="https://…" maxlength="200" value="'+esc(def.url)+'">'+
      '<input class="se-inp" id="seLLbl" placeholder="ღილაკის ტექსტი" maxlength="30" value="'+esc(def.label)+'">'+
      '<button class="se-btn-g" id="seAddLnk">დამატება</button>'+
      (S.link?'<button class="se-btn-ghost" id="seRmLnk">წაშლა</button>':''));
    p.querySelector('#seAddLnk').addEventListener('click',function(){
      var u=(q('#seLUrl').value||'').trim();
      if(!u.startsWith('http'))return toast('URL უნდა იწყებოდეს https://-ით');
      S.link={url:u,label:(q('#seLLbl').value||'გახსნა').trim()};
      updateStickers(); closePanel(); toast('🔗 ლინკი დამატებულია');
    });
    var rm=p.querySelector('#seRmLnk');
    if(rm)rm.addEventListener('click',function(){S.link=null;updateStickers();closePanel();});
  }

  // ─── Hashtag panel ───────────────────────────────────────────────────────
  function showHashPanel(){
    var p=panel('stHash','<div class="se-ph">ჰეშთეგები</div>'+
      '<input class="se-inp" id="seHashIn" placeholder="#ჰეშთეგი (Enter-ით)" maxlength="40">'+
      '<div class="se-pills" id="seHashPills">'+renderPills()+'</div>');
    q('#seHashIn').addEventListener('keydown',function(e){
      if(e.key!=='Enter')return; e.preventDefault();
      var v=this.value.replace(/^#/,'').trim(); if(!v)return;
      if(S.hashtags.indexOf(v)<0)S.hashtags.push(v);
      this.value=''; q('#seHashPills').innerHTML=renderPills(); bindPillDel();
    });
    bindPillDel();
    function renderPills(){
      return S.hashtags.map(function(h){
        return '<span class="se-pill">#'+esc(h)+'<button data-rh="'+esc(h)+'">×</button></span>';
      }).join('');
    }
    function bindPillDel(){
      document.querySelectorAll('[data-rh]').forEach(function(b){
        b.addEventListener('click',function(){
          S.hashtags=S.hashtags.filter(function(x){return x!==b.dataset.rh;});
          q('#seHashPills').innerHTML=renderPills(); bindPillDel();
        });
      });
    }
  }

  // ─── Mention panel ───────────────────────────────────────────────────────
  function showMentionPanel(){
    var p=panel('stMention','<div class="se-ph">@მენშენი</div>'+
      '<input class="se-inp" id="seMenIn" placeholder="@username (Enter-ით)" maxlength="50">'+
      '<div class="se-pills" id="seMenPills">'+rMen()+'</div>');
    q('#seMenIn').addEventListener('keydown',function(e){
      if(e.key!=='Enter')return; e.preventDefault();
      var v=this.value.replace(/^@/,'').trim(); if(!v)return;
      if(S.mentions.indexOf(v)<0)S.mentions.push(v);
      this.value=''; q('#seMenPills').innerHTML=rMen(); bMen();
    });
    bMen();
    function rMen(){return S.mentions.map(function(m){return '<span class="se-pill">@'+esc(m)+'<button data-rm="'+esc(m)+'">×</button></span>';}).join('');}
    function bMen(){document.querySelectorAll('[data-rm]').forEach(function(b){b.addEventListener('click',function(){S.mentions=S.mentions.filter(function(x){return x!==b.dataset.rm;});q('#seMenPills').innerHTML=rMen();bMen();});});}
  }

  // ─── Countdown panel ─────────────────────────────────────────────────────
  function showCdPanel(){
    var def=S.countdown||{label:'',date:''};
    var p=panel('stCd','<div class="se-ph">ობობა ტაიმერი</div>'+
      '<input class="se-inp" id="seCdLbl" placeholder="სახელი (მაგ. დაბადების დღე)" maxlength="60" value="'+esc(def.label)+'">'+
      '<input class="se-inp" id="seCdDate" type="datetime-local" value="'+esc(def.date)+'">'+
      '<button class="se-btn-g" id="seAddCd">დამატება</button>'+
      (S.countdown?'<button class="se-btn-ghost" id="seRmCd">წაშლა</button>':''));
    p.querySelector('#seAddCd').addEventListener('click',function(){
      var d=(q('#seCdDate').value||'').trim(); if(!d)return toast('თარიღი მიუთითე');
      S.countdown={label:(q('#seCdLbl').value||'Countdown').trim(),date:d};
      updateStickers(); closePanel(); toast('⏳ ტაიმერი დამატებულია');
    });
    var rm=p.querySelector('#seRmCd');
    if(rm)rm.addEventListener('click',function(){S.countdown=null;updateStickers();closePanel();});
  }

  // ─── Duration panel ──────────────────────────────────────────────────────
  function showDurPanel(){
    var opts=[{v:'24h',l:'24 საათი'},{v:'7d',l:'7 დღე'},{v:'30d',l:'30 დღე'},{v:'1y',l:'1 წელი'},{v:'forever',l:'♾️ ყოველთვის'}];
    var p=panel('stDur','<div class="se-ph">ხანგრძლივობა</div><div class="se-durbtns">'+
      opts.map(function(o){return '<button class="se-durbtn'+(o.v===S.duration?' sel':'')+'" data-dur="'+o.v+'">'+o.l+'</button>';}).join('')+'</div>');
    p.addEventListener('click',function(e){
      var b=e.target.closest('.se-durbtn'); if(!b)return;
      S.duration=b.dataset.dur;
      p.querySelectorAll('.se-durbtn').forEach(function(x){x.classList.remove('sel');});
      b.classList.add('sel'); setTimeout(closePanel,350);
    });
  }

  // ─── Sticker overlay (poll/link/question/countdown) ──────────────────────
  function updateStickers(){
    var cv=q('#seCv'); if(!cv)return;
    cv.querySelectorAll('.se-sticker').forEach(function(s){s.remove();});
    var y=12;
    function addStk(html, cls){
      var d=document.createElement('div');
      d.className='se-sticker '+(cls||'');
      d.style.cssText='left:50%;transform:translateX(-50%);top:'+y+'px;position:absolute;z-index:3';
      d.innerHTML=html; cv.appendChild(d);
      y+=d.offsetHeight+8;
    }
    if(S.poll){addStk('<div style="font-weight:700;margin-bottom:6px">'+esc(S.poll.q)+'</div><div style="display:flex;gap:6px"><span style="flex:1;background:rgba(255,255,255,.25);padding:5px;border-radius:8px;text-align:center">'+esc(S.poll.a)+'</span><span style="flex:1;background:rgba(255,255,255,.25);padding:5px;border-radius:8px;text-align:center">'+esc(S.poll.b)+'</span></div>');}
    if(S.question){addStk('<div style="font-size:.75rem;color:#a5b4fc;margin-bottom:3px">კითხვა</div><div style="font-weight:600">'+esc(S.question)+'</div><div style="margin-top:6px;background:rgba(255,255,255,.15);border-radius:8px;padding:6px 10px;font-size:.8rem;color:#c7d2fe">პასუხი…</div>');}
    if(S.link){addStk('<a href="'+esc(S.link.url)+'" style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;background:rgba(255,255,255,.9);border-radius:20px;color:#1e293b;font-weight:700;font-size:.82rem;text-decoration:none"><i class="fas fa-external-link-alt"></i>'+esc(S.link.label)+'</a>');}
    if(S.countdown){
      var ms=new Date(S.countdown.date)-Date.now();
      var rem=ms>0?Math.floor(ms/86400000)+'დ '+Math.floor((ms%86400000)/3600000)+'სთ':'დასრულდა';
      addStk('<div style="font-size:.75rem;color:#fde68a;margin-bottom:3px">'+esc(S.countdown.label)+'</div><div style="font-size:1.2rem;font-weight:800;color:#fbbf24">'+rem+'</div>');
    }
  }

  // ─── Elements ────────────────────────────────────────────────────────────
  function addEl(opts){
    opts.id=opts.id||uid();
    var el=document.createElement('div');
    el.className='se-el se-el-'+opts.type;
    el.dataset.eid=opts.id;
    el.style.left=opts.x+'%'; el.style.top=opts.y+'%';
    el.style.transform='scale('+(opts.scale||1)+')';

    if(opts.type==='emoji'){
      el.style.fontSize=(opts.fontSize||52)+'px';
      el.textContent=opts.content;
    } else {
      var sp=document.createElement('span');
      sp.className='se-el-txt';
      sp.style.fontSize=(opts.fontSize||28)+'px';
      sp.style.color=opts.color||'#fff';
      sp.textContent=opts.content;
      el.appendChild(sp);
    }

    // delete button
    var del=document.createElement('button'); del.className='se-el-del'; del.innerHTML='&times;';
    del.addEventListener('pointerdown',function(e){e.stopPropagation();el.remove();S.elements=S.elements.filter(function(x){return x.id!==opts.id;});if(_selEl===el)_selEl=null;});
    el.appendChild(del);

    // scale handle
    var scl=document.createElement('button'); scl.className='se-el-scale'; scl.innerHTML='⤡';
    wireScaleHandle(scl,el,opts);
    el.appendChild(scl);

    makeDrag(el,opts);
    var cv=q('#seCv'); if(cv)cv.appendChild(el);
    S.elements.push(opts);
    selEl(el);
  }

  function selEl(el){
    if(_selEl)_selEl.classList.remove('sel');
    _selEl=el||null;
    if(_selEl)_selEl.classList.add('sel');
  }

  function makeDrag(el,opts){
    var sx,sy,sl,st,drag=false;
    el.addEventListener('pointerdown',function(e){
      if(e.target.classList.contains('se-el-del')||e.target.classList.contains('se-el-scale'))return;
      e.stopPropagation(); selEl(el); drag=true;
      sx=e.clientX; sy=e.clientY;
      var cv=q('#seCv'), r=cv?cv.getBoundingClientRect():{width:1,height:1};
      sl=(parseFloat(el.style.left)/100)*r.width;
      st=(parseFloat(el.style.top)/100)*r.height;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove',function(e){
      if(!drag)return;
      var cv=q('#seCv'), r=cv?cv.getBoundingClientRect():{width:1,height:1};
      var nl=Math.max(0,Math.min(r.width,sl+(e.clientX-sx)));
      var nt=Math.max(0,Math.min(r.height,st+(e.clientY-sy)));
      el.style.left=(nl/r.width*100).toFixed(2)+'%';
      el.style.top=(nt/r.height*100).toFixed(2)+'%';
    });
    el.addEventListener('pointerup',function(){
      drag=false;
      var st2=S.elements.find(function(x){return x.id===opts.id;});
      if(st2){st2.x=parseFloat(el.style.left);st2.y=parseFloat(el.style.top);}
    });
  }

  function wireScaleHandle(scl,el,opts){
    var startY,startScale;
    scl.addEventListener('pointerdown',function(e){
      e.stopPropagation(); e.preventDefault();
      startY=e.clientY; startScale=opts.scale||1;
      scl.setPointerCapture(e.pointerId);
    });
    scl.addEventListener('pointermove',function(e){
      var dy=startY-e.clientY; // drag up = bigger
      var ns=Math.max(0.3,Math.min(4,startScale+dy*0.01));
      opts.scale=ns; el.style.transform='scale('+ns+')';
    });
  }

  // ─── Draw canvas ─────────────────────────────────────────────────────────
  function wireDraw(){
    var dc=q('#seDc'); if(!dc||dc._wired)return; dc._wired=true;
    _drawCtx=dc.getContext('2d'); _drawCtx.lineCap='round'; _drawCtx.lineJoin='round';
    var painting=false;
    function pos(e){var r=dc.getBoundingClientRect(),sx=dc.width/r.width,sy=dc.height/r.height,src=(e.touches&&e.touches[0])||e;return{x:(src.clientX-r.left)*sx,y:(src.clientY-r.top)*sy};}
    function start(e){if(!_isDrawing)return;e.preventDefault();painting=true;_drawCtx.strokeStyle=S.drawColor;_drawCtx.lineWidth=S.drawSize;var p=pos(e);_drawCtx.beginPath();_drawCtx.moveTo(p.x,p.y);}
    function move(e){if(!painting||!_isDrawing)return;e.preventDefault();var p=pos(e);_drawCtx.lineTo(p.x,p.y);_drawCtx.stroke();}
    function stop(){painting=false;}
    dc.addEventListener('pointerdown',start); dc.addEventListener('pointermove',move); dc.addEventListener('pointerup',stop); dc.addEventListener('pointerleave',stop);
    dc.addEventListener('touchstart',start,{passive:false}); dc.addEventListener('touchmove',move,{passive:false}); dc.addEventListener('touchend',stop);
  }

  // ─── Publish ─────────────────────────────────────────────────────────────
  function publish(){
    var gs=GS(); if(!gs||!gs.createStory){toast('სთორის ფუნქცია მზად არ არის');return;}
    var GF=window.GeoFirebase; if(!GF||!GF.auth||!GF.auth.currentUser){toast('შედი პირველ რიგში');return;}
    var btn=q('#sePub'); btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> …';

    var textParts=S.elements.filter(function(e){return e.type==='text';}).map(function(e){return e.content;});
    if(S.hashtags.length)textParts.push(S.hashtags.map(function(h){return '#'+h;}).join(' '));
    if(S.mentions.length)textParts.push(S.mentions.map(function(m){return '@'+m;}).join(' '));
    var storyText=textParts.join(' ')||' ';

    var extra={bg:S.mediaUrl?'':S.bg,duration:S.duration,elements:S.elements.map(function(e){return{type:e.type,content:e.content,x:e.x,y:e.y,fontSize:e.fontSize,color:e.color||'',scale:e.scale||1};})};
    if(S.poll)extra.poll=S.poll;
    if(S.question)extra.question=S.question;
    if(S.link)extra.link=S.link;
    if(S.hashtags.length)extra.hashtags=S.hashtags;
    if(S.mentions.length)extra.mentions=S.mentions;
    if(S.countdown)extra.countdown=S.countdown;
    if(S.mediaType)extra.mediaType=S.mediaType;
    extra.imgTransform={x:S.imgX,y:S.imgY,scale:S.imgScale};

    if(S.mediaFile&&S.mediaType==='video'){doUpload(S.mediaFile,storyText,extra,gs);return;}

    composite(function(blob){
      if(!blob){gs.createStory(storyText,'',function(){closeEditor();},extra);return;}
      var f=new File([blob],'story-'+Date.now()+'.jpg',{type:'image/jpeg'});
      doUpload(f,storyText,extra,gs);
    });
  }

  function composite(cb){
    var cvEl=q('#seCv'); if(!cvEl){cb(null);return;}
    var w=cvEl.offsetWidth, h=cvEl.offsetHeight;
    var off=document.createElement('canvas'); off.width=w; off.height=h;
    var ctx=off.getContext('2d');

    function layers(){
      // draw canvas
      var dc=q('#seDc'); if(dc&&dc.width){try{ctx.drawImage(dc,0,0,w,h);}catch(e){}}
      // elements
      S.elements.forEach(function(el){
        var x=(el.x/100)*w, y=(el.y/100)*h, fs=el.fontSize||(el.type==='emoji'?52:28), sc=el.scale||1;
        ctx.save();
        ctx.translate(x,y);ctx.scale(sc,sc);
        ctx.font=(el.type==='emoji'?fs+'px serif':'bold '+fs+'px Inter,sans-serif');
        ctx.textAlign='center';ctx.textBaseline='middle';
        if(el.type==='text'){ctx.shadowColor='rgba(0,0,0,.7)';ctx.shadowBlur=12;ctx.fillStyle=el.color||'#fff';}
        ctx.fillText(el.content,0,0);
        ctx.restore();
      });
      off.toBlob(function(b){cb(b);},'image/jpeg',0.92);
    }

    if(S.mediaUrl&&S.mediaType==='image'){
      var img=new Image(); img.crossOrigin='anonymous';
      img.onload=function(){
        ctx.save();
        ctx.translate(w/2+S.imgX,h/2+S.imgY);ctx.scale(S.imgScale,S.imgScale);
        ctx.drawImage(img,-w/2,-h/2,w,h);
        ctx.restore(); layers();
      };
      img.onerror=function(){fillBg(ctx,w,h);layers();};
      img.src=S.mediaUrl;
    } else {
      fillBg(ctx,w,h); layers();
    }
  }

  function fillBg(ctx,w,h){
    var bg=S.bg||'#111';
    if(bg.startsWith('linear-gradient')||bg.startsWith('radial-gradient')){
      var stops=bg.match(/#[0-9a-fA-F]{3,8}|rgb[a]?\([^)]+\)/g)||['#111','#333'];
      var g=ctx.createLinearGradient(0,0,w,h);
      stops.forEach(function(c,i){g.addColorStop(i/(stops.length-1),c);});
      ctx.fillStyle=g;
    } else {ctx.fillStyle=bg;}
    ctx.fillRect(0,0,w,h);
  }

  function doUpload(file,text,extra,gs){
    var prog=q('#seProg'),fill=q('#seProgF'),btn=q('#sePub');
    if(prog)prog.style.display='';
    if(gs.uploadFile){
      gs.uploadFile(file,'stories',function(pct){if(fill)fill.style.width=pct+'%';if(btn)btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> '+pct+'%';})
        .then(function(url){gs.createStory(text,url,function(e){if(e){toast('შეცდომა');resetBtn();return;}toast('🌱 სთორი გამოქვეყნდა!');setTimeout(closeEditor,1000);},extra);})
        .catch(function(){toast('ატვირთვა ვერ მოხდა');resetBtn();});
    } else {
      var r=new FileReader(); r.onload=function(e){
        var fu=gs.uploadImageDataUrl;
        var done=function(url){gs.createStory(text,url,function(err){if(err){toast('შეცდომა');resetBtn();return;}toast('🌱 სთორი გამოქვეყნდა!');setTimeout(closeEditor,1000);},extra);};
        if(fu){fu(e.target.result,'stories').then(done).catch(function(){done(e.target.result);});}
        else done(e.target.result);
      };
      r.readAsDataURL(file);
    }
  }

  function resetBtn(){var b=q('#sePub');if(b){b.disabled=false;b.innerHTML='<i class="fas fa-paper-plane"></i> გამოქვეყნება';}var p=q('#seProg');if(p)p.style.display='none';}

  // ─── Wire events ─────────────────────────────────────────────────────────
  function wire(){
    q('#seClose').addEventListener('click',closeEditor);
    q('#sePub').addEventListener('click',publish);

    q('#stPhoto').addEventListener('click',function(){q('#seFile').click();});
    q('#seFile').addEventListener('change',function(){
      var f=this.files&&this.files[0]; if(!f)return;
      S.mediaFile=f; S.mediaType=f.type.startsWith('video/')?'video':'image';
      S.mediaUrl=URL.createObjectURL(f); S.imgX=0;S.imgY=0;S.imgScale=1;
      applyBg(); closePanel();
    });

    q('#stBg').addEventListener('click',showBgPanel);
    q('#stImgCtrl').addEventListener('click',showImgCtrl);
    q('#stDraw').addEventListener('click',showDrawPanel);
    q('#stEmoji').addEventListener('click',showEmojiPanel);
    q('#stText').addEventListener('click',showTextPanel);
    q('#stPoll').addEventListener('click',showPollPanel);
    q('#stQA').addEventListener('click',showQAPanel);
    q('#stLink').addEventListener('click',showLinkPanel);
    q('#stHash').addEventListener('click',showHashPanel);
    q('#stMention').addEventListener('click',showMentionPanel);
    q('#stCd').addEventListener('click',showCdPanel);
    q('#stDur').addEventListener('click',showDurPanel);

    // canvas click → deselect
    q('#seCv').addEventListener('pointerdown',function(e){
      if(!e.target.closest('.se-el')&&!e.target.closest('.se-sticker')){
        selEl(null);
        if(!_isDrawing)closePanel();
      }
    });

    // ESC
    var onKey=function(e){
      if(e.key!=='Escape')return;
      if(_activePanel)closePanel();
      else{closeEditor();document.removeEventListener('keydown',onKey);}
    };
    document.addEventListener('keydown',onKey);
  }

  // ─── Open / Close ─────────────────────────────────────────────────────────
  function open(){
    css();
    if(q('#seOv'))return;
    reset();
    var GF=window.GeoFirebase, u=GF&&GF.auth&&GF.auth.currentUser;
    var me={name:u?(u.displayName||u.email||'GeoHub'):'GeoHub', avatar:u?u.photoURL||'':''};
    var ov=buildDOM(me);
    document.body.appendChild(ov);
    size(); applyBg(); wire();
    window.addEventListener('resize',size);
  }

  function closeEditor(){
    var ov=q('#seOv'); if(ov)ov.remove();
    window.removeEventListener('resize',size);
  }

  // ─── Hook ────────────────────────────────────────────────────────────────
  function patch(){ window._ghStoryEditor=open; window.openStoryEditor=open; }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',patch);
  else patch();
  window.addEventListener('load',function(){setTimeout(patch,300);});

})();
