// GeoHub Story Editor — Instagram-style canvas editor
// Patches window.openStoryModal with a full-screen drag-and-drop editor
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
    '#111111',
    '#ffffff',
  ];

  var EMOJIS = [
    '❤️','🔥','😂','😍','🎉','👋','💪','🙏','😎','🤩',
    '✨','🌟','💯','🥳','😭','💀','🫶','🌹','🎶','🏆',
    '🇬🇪','🌱','👑','🍕','☕','🎵','🥰','💙','🎈','🦋',
    '🌊','🏔️','🌸','🍀','⭐','🌙','☀️','🌈','🦅','🏅',
  ];

  var TEXT_COLORS = ['#ffffff','#000000','#ffd700','#ff4757','#2ed573','#1e90ff','#ff6b81','#eccc68','#a29bfe','#fd79a8'];
  var DRAW_COLORS = ['#ffffff','#ff0000','#00ff00','#0000ff','#ffff00','#ff69b4','#000000','#ffa500','#00ffff','#8B5CF6'];

  // ─── State ───────────────────────────────────────────────
  var _state = {};
  var _activeTool = null;
  var _selectedEl = null;
  var _drawCtx = null;
  var _isDrawing = false;

  function resetState() {
    _state = {
      bg: GRADIENTS[0],
      mediaFile: null,
      mediaLocalUrl: '',
      mediaType: '',
      elements: [],
      drawColor: '#ffffff',
      drawSize: 6,
      duration: '24h',
      textColor: '#ffffff',
    };
    _activeTool = null;
    _selectedEl = null;
    _drawCtx = null;
    _isDrawing = false;
  }

  // ─── CSS ──────────────────────────────────────────────────
  function injectCSS() {
    if (document.getElementById('se-css')) return;
    var s = document.createElement('style');
    s.id = 'se-css';
    s.textContent = [
      '.se-ov{position:fixed;inset:0;z-index:99999;background:#000;display:flex;flex-direction:column;font-family:Inter,-apple-system,sans-serif;-webkit-user-select:none;user-select:none}',
      '.se-top{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(0,0,0,.55);backdrop-filter:blur(10px);flex-shrink:0;z-index:10}',
      '.se-close{width:36px;height:36px;border-radius:50%;border:none;background:rgba(255,255,255,.18);color:#fff;font-size:.95rem;cursor:pointer;display:flex;align-items:center;justify-content:center}',
      '.se-pub{padding:9px 22px;border-radius:24px;border:none;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-weight:700;font-size:.9rem;cursor:pointer;display:flex;align-items:center;gap:6px}',
      '.se-pub:disabled{opacity:.5;cursor:not-allowed}',
      '.se-actor{display:flex;align-items:center;gap:8px;color:#fff;font-weight:600;font-size:.9rem}',
      '.se-cwrap{flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;padding:8px}',
      '.se-cv{position:relative;border-radius:16px;overflow:hidden;touch-action:none;flex-shrink:0}',
      '.se-cv-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none}',
      '.se-dc{position:absolute;inset:0;width:100%;height:100%;display:none;cursor:crosshair;touch-action:none;z-index:5}',
      '.se-dc.on{display:block}',
      /* Elements */
      '.se-el{position:absolute;cursor:move;transform:translate(-50%,-50%);touch-action:none;display:inline-flex;align-items:center;justify-content:center;z-index:4}',
      '.se-el.sel::after{content:"";position:absolute;inset:-5px;border:2px dashed rgba(255,255,255,.85);border-radius:8px;pointer-events:none}',
      '.se-el-del{position:absolute;top:-13px;right:-13px;width:24px;height:24px;border-radius:50%;background:#ef4444;color:#fff;font-size:.75rem;border:none;cursor:pointer;display:none;align-items:center;justify-content:center;z-index:6}',
      '.se-el.sel .se-el-del{display:flex}',
      '.se-el-txt{font-weight:800;text-shadow:0 2px 10px rgba(0,0,0,.7);white-space:pre-wrap;text-align:center;max-width:200px;word-break:break-word;line-height:1.2}',
      /* Toolbar */
      '.se-tb{background:rgba(0,0,0,.75);backdrop-filter:blur(10px);padding:8px 6px;flex-shrink:0;display:flex;justify-content:center;gap:3px;flex-wrap:wrap}',
      '.se-t{display:flex;flex-direction:column;align-items:center;gap:3px;padding:7px 9px;border-radius:10px;border:none;background:rgba(255,255,255,.09);color:#d1d5db;font-size:.68rem;cursor:pointer;min-width:50px;transition:background .15s}',
      '.se-t i{font-size:1.05rem}',
      '.se-t:hover,.se-t.on{background:rgba(255,255,255,.22);color:#fff}',
      '.se-t.on{color:#10b981}',
      /* Panel */
      '.se-pnl{position:absolute;bottom:0;left:0;right:0;background:rgba(12,15,25,.96);border-top:1px solid rgba(255,255,255,.1);padding:14px;z-index:20;backdrop-filter:blur(14px);max-height:55vh;overflow-y:auto}',
      '.se-ph{color:#9ca3af;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:11px}',
      /* BG */
      '.se-bggrid{display:flex;flex-wrap:wrap;gap:7px}',
      '.se-bgsw{width:42px;height:42px;border-radius:9px;border:2px solid transparent;cursor:pointer;transition:border-color .15s,transform .15s;flex-shrink:0}',
      '.se-bgsw.sel{border-color:#10b981;transform:scale(1.12)}',
      /* Emoji */
      '.se-emgrid{display:flex;flex-wrap:wrap;gap:5px}',
      '.se-emb{font-size:1.5rem;padding:5px;border:none;background:none;cursor:pointer;border-radius:7px;transition:background .1s;line-height:1}',
      '.se-emb:hover{background:rgba(255,255,255,.1)}',
      /* Text */
      '.se-txin{width:100%;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.15);border-radius:9px;color:#fff;padding:10px 13px;font-size:1rem;outline:none;margin-bottom:9px;box-sizing:border-box}',
      '.se-colrow{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:9px}',
      '.se-cdot{width:28px;height:28px;border-radius:50%;border:2px solid transparent;cursor:pointer;transition:border-color .15s,transform .15s}',
      '.se-cdot.sel{border-color:#fff;transform:scale(1.2)}',
      '.se-addbtn{padding:10px 22px;border-radius:9px;border:none;background:#10b981;color:#fff;font-weight:700;cursor:pointer;font-size:.9rem}',
      /* Draw */
      '.se-dcols{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}',
      '.se-dcol{width:30px;height:30px;border-radius:50%;border:2px solid transparent;cursor:pointer}',
      '.se-dcol.sel{border-color:#fff;transform:scale(1.1)}',
      '.se-szrow{display:flex;align-items:center;gap:8px;margin-bottom:10px}',
      '.se-szrow label{color:#9ca3af;font-size:.8rem;white-space:nowrap}',
      '.se-szrow input{flex:1}',
      '.se-clrbtn{padding:8px 16px;background:rgba(239,68,68,.18);border:1px solid rgba(239,68,68,.4);color:#ef4444;border-radius:8px;cursor:pointer;font-size:.85rem}',
      /* Duration */
      '.se-durbtns{display:flex;gap:6px;flex-wrap:wrap}',
      '.se-durbtn{padding:8px 16px;border-radius:20px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.07);color:#d1d5db;cursor:pointer;font-size:.85rem}',
      '.se-durbtn.sel{background:#10b981;border-color:#10b981;color:#fff;font-weight:700}',
      /* Progress bar */
      '.se-prog{position:absolute;bottom:0;left:0;right:0;height:3px;background:rgba(255,255,255,.1);z-index:30}',
      '.se-progf{height:100%;background:#10b981;transition:width .2s;width:0}',
      /* Toast */
      '.se-toast{position:absolute;top:68px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.88);color:#fff;padding:8px 18px;border-radius:20px;font-size:.85rem;white-space:nowrap;pointer-events:none;z-index:40}',
    ].join('');
    document.head.appendChild(s);
  }

  // ─── Helpers ──────────────────────────────────────────────
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"]/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function uid() { return Math.random().toString(36).slice(2, 9); }
  function q(sel) { return document.querySelector(sel); }
  function GS() { return window.GeoSocial || null; }

  // ─── Build overlay HTML ───────────────────────────────────
  function buildOverlay(me) {
    var av = me.avatar || '';
    var name = me.name || 'You';
    var avHtml = av
      ? '<img src="' + esc(av) + '" style="width:30px;height:30px;border-radius:50%;object-fit:cover" alt="">'
      : '<div style="width:30px;height:30px;border-radius:50%;background:#10b981;display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:.85rem">' + esc((name[0] || 'G').toUpperCase()) + '</div>';

    var el = document.createElement('div');
    el.className = 'se-ov'; el.id = 'seOv';
    el.innerHTML =
      '<div class="se-top">' +
        '<button class="se-close" id="seClose" title="დახურვა"><i class="fas fa-times"></i></button>' +
        '<div class="se-actor">' + avHtml + '<span>' + esc(name) + '</span></div>' +
        '<button class="se-pub" id="sePub"><i class="fas fa-paper-plane"></i> გამოქვეყნება</button>' +
      '</div>' +
      '<div class="se-cwrap" id="seCWrap">' +
        '<div class="se-cv" id="seCv">' +
          '<canvas class="se-dc" id="seDc"></canvas>' +
        '</div>' +
        '<div class="se-prog" id="seProg" style="display:none"><div class="se-progf" id="seProgF"></div></div>' +
      '</div>' +
      '<div class="se-tb" id="seTb">' +
        '<button class="se-t" id="stPhoto"><i class="fas fa-image"></i>ფოტო</button>' +
        '<button class="se-t" id="stBg"><i class="fas fa-palette"></i>ფონი</button>' +
        '<button class="se-t" id="stDraw"><i class="fas fa-pen-nib"></i>ხატვა</button>' +
        '<button class="se-t" id="stEmoji"><i class="fas fa-face-smile"></i>Emoji</button>' +
        '<button class="se-t" id="stText"><i class="fas fa-font"></i>ტექსტი</button>' +
        '<button class="se-t" id="stDur"><i class="fas fa-clock"></i>დრო</button>' +
      '</div>' +
      '<input type="file" id="seFile" accept="image/*,video/*" style="display:none">';
    return el;
  }

  // ─── Canvas sizing ────────────────────────────────────────
  function sizeCanvas() {
    var wrap = q('#seCWrap');
    var cv = q('#seCv');
    var dc = q('#seDc');
    if (!wrap || !cv) return;
    var wh = wrap.offsetHeight - 16;
    var ww = wrap.offsetWidth - 16;
    var h = Math.min(wh, 620);
    var w = Math.round(h * 9 / 16);
    if (w > ww) { w = ww; h = Math.round(w * 16 / 9); }
    cv.style.width = w + 'px';
    cv.style.height = h + 'px';
    if (dc) { dc.width = w; dc.height = h; }
    // restore draw strokes after resize
    if (_drawCtx && _state._drawImg) {
      _drawCtx.drawImage(_state._drawImg, 0, 0, w, h);
    }
  }

  // ─── Background ───────────────────────────────────────────
  function applyBg() {
    var cv = q('#seCv');
    if (!cv) return;
    cv.querySelectorAll('.se-cv-bg').forEach(function(el) { el.remove(); });
    if (_state.mediaLocalUrl) {
      var isVid = _state.mediaType === 'video';
      var media = document.createElement(isVid ? 'video' : 'img');
      media.className = 'se-cv-bg';
      media.src = _state.mediaLocalUrl;
      if (isVid) { media.autoplay = true; media.loop = true; media.muted = true; media.playsInline = true; }
      cv.insertBefore(media, cv.firstChild);
      cv.style.background = '#000';
    } else {
      cv.style.background = _state.bg;
    }
  }

  // ─── Panel management ─────────────────────────────────────
  function closePanel() {
    var p = q('#sePanel');
    if (p) p.remove();
    _activeTool = null;
    document.querySelectorAll('.se-t').forEach(function(b) { b.classList.remove('on'); });
    var dc = q('#seDc');
    if (dc) { dc.classList.remove('on'); _isDrawing = false; }
  }

  function openPanel(toolId, html) {
    closePanel();
    _activeTool = toolId;
    var toolBtn = document.getElementById(toolId);
    if (toolBtn) toolBtn.classList.add('on');
    var p = document.createElement('div');
    p.className = 'se-pnl'; p.id = 'sePanel';
    p.innerHTML = html;
    var ov = q('#seOv');
    var tb = q('#seTb');
    if (ov && tb) ov.insertBefore(p, tb);
    return p;
  }

  // ─── BG panel ─────────────────────────────────────────────
  function showBgPanel() {
    var html = '<div class="se-ph">ფონის ფერი</div><div class="se-bggrid">' +
      GRADIENTS.map(function(g) {
        return '<div class="se-bgsw' + (g === _state.bg ? ' sel' : '') + '" data-bg="' + esc(g) + '" style="background:' + g + ';' + (g === '#ffffff' ? 'border:1px solid #555' : '') + '"></div>';
      }).join('') + '</div>';
    var p = openPanel('stBg', html);
    p.addEventListener('click', function(e) {
      var sw = e.target.closest('.se-bgsw');
      if (!sw) return;
      _state.bg = sw.dataset.bg;
      _state.mediaLocalUrl = '';
      _state.mediaFile = null;
      _state.mediaType = '';
      applyBg();
      p.querySelectorAll('.se-bgsw').forEach(function(s) { s.classList.remove('sel'); });
      sw.classList.add('sel');
    });
  }

  // ─── Emoji panel ──────────────────────────────────────────
  function showEmojiPanel() {
    var html = '<div class="se-ph">Emoji — დაამატე და გადაიტანე</div><div class="se-emgrid">' +
      EMOJIS.map(function(e) {
        return '<button class="se-emb" data-em="' + e + '">' + e + '</button>';
      }).join('') + '</div>';
    var p = openPanel('stEmoji', html);
    p.addEventListener('click', function(e) {
      var btn = e.target.closest('.se-emb');
      if (!btn) return;
      addElement({ type: 'emoji', content: btn.dataset.em, x: 50, y: 40, fontSize: 52 });
      closePanel();
    });
  }

  // ─── Text panel ───────────────────────────────────────────
  function showTextPanel() {
    var html = '<div class="se-ph">ტექსტის დამატება</div>' +
      '<input class="se-txin" id="seTxIn" placeholder="შეიყვანე ტექსტი…" maxlength="120">' +
      '<div class="se-colrow">' +
      TEXT_COLORS.map(function(c) {
        return '<div class="se-cdot' + (c === _state.textColor ? ' sel' : '') + '" data-col="' + c + '" style="background:' + c + ';' + (c === '#ffffff' ? 'border-color:#555' : '') + '"></div>';
      }).join('') + '</div>' +
      '<button class="se-addbtn" id="seAddTx"><i class="fas fa-plus"></i> კანვასზე დამატება</button>';
    var p = openPanel('stText', html);

    p.addEventListener('click', function(e) {
      var dot = e.target.closest('.se-cdot');
      if (dot) {
        _state.textColor = dot.dataset.col;
        p.querySelectorAll('.se-cdot').forEach(function(d) { d.classList.remove('sel'); });
        dot.classList.add('sel');
      }
      if (e.target.closest('#seAddTx')) {
        var txt = (document.getElementById('seTxIn').value || '').trim();
        if (!txt) return;
        addElement({ type: 'text', content: txt, x: 50, y: 50, fontSize: 28, color: _state.textColor });
        closePanel();
      }
    });

    var inp = document.getElementById('seTxIn');
    if (inp) {
      inp.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); document.getElementById('seAddTx').click(); }
      });
      setTimeout(function() { inp.focus(); }, 80);
    }
  }

  // ─── Draw panel ───────────────────────────────────────────
  function showDrawPanel() {
    var html = '<div class="se-ph">ხატვა — კანვასზე დახატე</div>' +
      '<div class="se-dcols">' +
      DRAW_COLORS.map(function(c) {
        return '<div class="se-dcol' + (c === _state.drawColor ? ' sel' : '') + '" data-dc="' + c + '" style="background:' + c + ';' + (c === '#ffffff' ? 'border-color:#555' : '') + '"></div>';
      }).join('') + '</div>' +
      '<div class="se-szrow"><label>ზომა: <b id="seSzV">' + _state.drawSize + '</b>px</label><input type="range" min="2" max="36" value="' + _state.drawSize + '" id="seSzR"></div>' +
      '<button class="se-clrbtn" id="seClrDraw"><i class="fas fa-trash-alt"></i> გასუფთავება</button>';

    var p = openPanel('stDraw', html);

    // Activate draw canvas AFTER openPanel (which calls closePanel first)
    var dc = document.getElementById('seDc');
    if (dc) { dc.classList.add('on'); _isDrawing = true; }
    document.getElementById('stDraw').classList.add('on');

    p.addEventListener('click', function(e) {
      var col = e.target.closest('.se-dcol');
      if (col) {
        _state.drawColor = col.dataset.dc;
        p.querySelectorAll('.se-dcol').forEach(function(d) { d.classList.remove('sel'); });
        col.classList.add('sel');
        if (_drawCtx) {
          _drawCtx.strokeStyle = _state.drawColor;
        }
      }
      if (e.target.closest('#seClrDraw') && _drawCtx) {
        var dcEl = document.getElementById('seDc');
        _drawCtx.clearRect(0, 0, dcEl.width, dcEl.height);
        _state._drawImg = null;
      }
    });

    document.getElementById('seSzR').addEventListener('input', function() {
      _state.drawSize = +this.value;
      document.getElementById('seSzV').textContent = _state.drawSize;
      if (_drawCtx) _drawCtx.lineWidth = _state.drawSize;
    });

    wireDrawCanvas();
  }

  // ─── Duration panel ───────────────────────────────────────
  function showDurPanel() {
    var opts = [
      { v: '24h', l: '24 საათი' }, { v: '7d', l: '7 დღე' },
      { v: '30d', l: '30 დღე' }, { v: '1y', l: '1 წელი' },
      { v: 'forever', l: '♾️ ყოველთვის' },
    ];
    var html = '<div class="se-ph">სთორის ხანგრძლივობა</div><div class="se-durbtns">' +
      opts.map(function(o) {
        return '<button class="se-durbtn' + (o.v === _state.duration ? ' sel' : '') + '" data-dur="' + o.v + '">' + o.l + '</button>';
      }).join('') + '</div>';
    var p = openPanel('stDur', html);
    p.addEventListener('click', function(e) {
      var btn = e.target.closest('.se-durbtn');
      if (!btn) return;
      _state.duration = btn.dataset.dur;
      p.querySelectorAll('.se-durbtn').forEach(function(b) { b.classList.remove('sel'); });
      btn.classList.add('sel');
      setTimeout(closePanel, 350);
    });
  }

  // ─── Draw canvas wiring ───────────────────────────────────
  function wireDrawCanvas() {
    var dc = document.getElementById('seDc');
    if (!dc || dc._seWired) return;
    dc._seWired = true;
    _drawCtx = dc.getContext('2d');
    _drawCtx.lineCap = 'round';
    _drawCtx.lineJoin = 'round';

    var painting = false;

    function getPos(e) {
      var rect = dc.getBoundingClientRect();
      var sx = dc.width / rect.width;
      var sy = dc.height / rect.height;
      var src = (e.touches && e.touches[0]) || e;
      return { x: (src.clientX - rect.left) * sx, y: (src.clientY - rect.top) * sy };
    }

    function onStart(e) {
      if (!_isDrawing) return;
      e.preventDefault(); e.stopPropagation();
      painting = true;
      _drawCtx.strokeStyle = _state.drawColor;
      _drawCtx.lineWidth = _state.drawSize;
      var p = getPos(e);
      _drawCtx.beginPath();
      _drawCtx.moveTo(p.x, p.y);
    }
    function onMove(e) {
      if (!painting || !_isDrawing) return;
      e.preventDefault();
      var p = getPos(e);
      _drawCtx.lineTo(p.x, p.y);
      _drawCtx.stroke();
    }
    function onEnd() {
      if (!painting) return;
      painting = false;
      // save snapshot for resize restore
      var img = new Image();
      img.src = dc.toDataURL();
      _state._drawImg = img;
    }

    dc.addEventListener('pointerdown', onStart);
    dc.addEventListener('pointermove', onMove);
    dc.addEventListener('pointerup', onEnd);
    dc.addEventListener('pointerleave', onEnd);
    dc.addEventListener('touchstart', onStart, { passive: false });
    dc.addEventListener('touchmove', onMove, { passive: false });
    dc.addEventListener('touchend', onEnd);
  }

  // ─── Elements ─────────────────────────────────────────────
  function addElement(opts) {
    opts.id = opts.id || uid();
    var el = document.createElement('div');
    el.className = 'se-el se-el-' + opts.type;
    el.dataset.eid = opts.id;
    el.style.left = opts.x + '%';
    el.style.top = opts.y + '%';

    if (opts.type === 'emoji') {
      el.style.fontSize = (opts.fontSize || 52) + 'px';
      el.style.lineHeight = '1';
      el.textContent = opts.content;
    } else {
      var span = document.createElement('span');
      span.className = 'se-el-txt';
      span.style.fontSize = (opts.fontSize || 28) + 'px';
      span.style.color = opts.color || '#fff';
      span.textContent = opts.content;
      el.appendChild(span);
    }

    var del = document.createElement('button');
    del.className = 'se-el-del';
    del.innerHTML = '&times;';
    del.addEventListener('pointerdown', function(e) {
      e.stopPropagation();
      el.remove();
      _state.elements = _state.elements.filter(function(s) { return s.id !== opts.id; });
      if (_selectedEl === el) _selectedEl = null;
    });
    el.appendChild(del);

    makeDraggable(el, opts);

    var cv = document.getElementById('seCv');
    if (cv) cv.appendChild(el);
    _state.elements.push(opts);
    selectEl(el);
  }

  function selectEl(el) {
    if (_selectedEl) _selectedEl.classList.remove('sel');
    _selectedEl = el || null;
    if (_selectedEl) _selectedEl.classList.add('sel');
  }

  function makeDraggable(el, opts) {
    var startX, startY, startL, startT, dragging = false;

    el.addEventListener('pointerdown', function(e) {
      if (e.target.classList.contains('se-el-del')) return;
      e.stopPropagation();
      selectEl(el);
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      var cv = document.getElementById('seCv');
      var rect = cv ? cv.getBoundingClientRect() : { width: 1, height: 1 };
      startL = (parseFloat(el.style.left) / 100) * rect.width;
      startT = (parseFloat(el.style.top) / 100) * rect.height;
      el.setPointerCapture(e.pointerId);
    });

    el.addEventListener('pointermove', function(e) {
      if (!dragging) return;
      var cv = document.getElementById('seCv');
      var rect = cv ? cv.getBoundingClientRect() : { width: 1, height: 1 };
      var nl = Math.max(0, Math.min(rect.width, startL + (e.clientX - startX)));
      var nt = Math.max(0, Math.min(rect.height, startT + (e.clientY - startY)));
      el.style.left = (nl / rect.width * 100).toFixed(2) + '%';
      el.style.top = (nt / rect.height * 100).toFixed(2) + '%';
    });

    el.addEventListener('pointerup', function() {
      dragging = false;
      var st = _state.elements.find(function(s) { return s.id === opts.id; });
      if (st) { st.x = parseFloat(el.style.left); st.y = parseFloat(el.style.top); }
    });
  }

  // ─── Publish: composite to image ─────────────────────────
  function publishStory() {
    var gs = GS();
    if (!gs || !gs.createStory) { showToast('სთორის ფუნქცია არ არის'); return; }
    var GF = window.GeoFirebase;
    var user = GF && GF.auth && GF.auth.currentUser;
    if (!user) { showToast('შედი პირველ რიგში'); return; }

    var pubBtn = document.getElementById('sePub');
    pubBtn.disabled = true;
    pubBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> მზადება…';

    // Collect text from text elements
    var textParts = _state.elements.filter(function(e) { return e.type === 'text'; }).map(function(e) { return e.content; });
    var storyText = textParts.join(' ') || ' ';

    var extra = {
      bg: _state.mediaLocalUrl ? '' : _state.bg,
      duration: _state.duration,
      elements: _state.elements.map(function(e) {
        return { type: e.type, content: e.content, x: e.x, y: e.y, fontSize: e.fontSize, color: e.color || '' };
      }),
    };
    if (_state.mediaType) extra.mediaType = _state.mediaType;

    // If video background — upload video, no compositing
    if (_state.mediaFile && _state.mediaType === 'video') {
      doUploadAndPublish(_state.mediaFile, 'stories', storyText, extra, gs);
      return;
    }

    // Composite: draw everything onto a hidden canvas
    compositeToBlob(function(blob) {
      if (!blob) {
        // No visual content — just publish text
        gs.createStory(storyText, '', function() { closeEditor(); }, extra);
        return;
      }
      var file = new File([blob], 'story-' + Date.now() + '.jpg', { type: 'image/jpeg' });
      doUploadAndPublish(file, 'stories', storyText, extra, gs);
    });
  }

  function compositeToBlob(cb) {
    var cvEl = document.getElementById('seCv');
    if (!cvEl) { cb(null); return; }
    var w = cvEl.offsetWidth;
    var h = cvEl.offsetHeight;
    if (!w || !h) { cb(null); return; }

    var offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    var ctx = offscreen.getContext('2d');

    // 1. Background
    if (_state.mediaLocalUrl && _state.mediaType === 'image') {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function() {
        ctx.drawImage(img, 0, 0, w, h);
        drawLayersAndExport(ctx, offscreen, w, h, cb);
      };
      img.onerror = function() {
        fillBg(ctx, w, h);
        drawLayersAndExport(ctx, offscreen, w, h, cb);
      };
      img.src = _state.mediaLocalUrl;
    } else {
      fillBg(ctx, w, h);
      drawLayersAndExport(ctx, offscreen, w, h, cb);
    }
  }

  function fillBg(ctx, w, h) {
    var bg = _state.bg || '#111';
    if (bg.startsWith('linear-gradient') || bg.startsWith('radial-gradient')) {
      // Parse gradient using a temp DOM element
      var tmp = document.createElement('canvas');
      tmp.width = w; tmp.height = h;
      var tc = tmp.getContext('2d');
      var stops = extractGradientStops(bg);
      if (stops.length >= 2) {
        var grd = tc.createLinearGradient(0, 0, w, h);
        stops.forEach(function(s, i) { grd.addColorStop(i / (stops.length - 1), s); });
        tc.fillStyle = grd;
      } else {
        tc.fillStyle = stops[0] || '#111';
      }
      tc.fillRect(0, 0, w, h);
      ctx.drawImage(tmp, 0, 0);
    } else {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
    }
  }

  function extractGradientStops(grad) {
    var matches = grad.match(/#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|rgba\([^)]+\)/g) || [];
    return matches.length ? matches : ['#111111', '#333333'];
  }

  function drawLayersAndExport(ctx, offscreen, w, h, cb) {
    // 2. Draw layer
    var dc = document.getElementById('seDc');
    if (dc && dc.width) {
      try { ctx.drawImage(dc, 0, 0, w, h); } catch (e) {}
    }

    // 3. Elements
    _state.elements.forEach(function(el) {
      var x = (el.x / 100) * w;
      var y = (el.y / 100) * h;
      var fs = el.fontSize || (el.type === 'emoji' ? 52 : 28);

      ctx.save();
      ctx.font = (el.type === 'emoji' ? fs + 'px serif' : 'bold ' + fs + 'px Inter,sans-serif');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (el.type === 'text') {
        // shadow
        ctx.shadowColor = 'rgba(0,0,0,.6)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = el.color || '#fff';
        ctx.fillText(el.content, x, y);
      } else {
        ctx.fillText(el.content, x, y);
      }
      ctx.restore();
    });

    // Check if anything was drawn (not just empty bg)
    var hasContent = _state.elements.length > 0 || (_state._drawImg != null);
    var alwaysComposite = !!_state.mediaLocalUrl;

    if (!hasContent && !alwaysComposite && !_state.bg) { cb(null); return; }

    offscreen.toBlob(function(blob) { cb(blob); }, 'image/jpeg', 0.92);
  }

  function doUploadAndPublish(file, folder, text, extra, gs) {
    var pubBtn = document.getElementById('sePub');
    var prog = document.getElementById('seProg');
    var progF = document.getElementById('seProgF');
    if (prog) prog.style.display = '';

    if (pubBtn) pubBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> იტვირთება…';

    if (gs.uploadFile) {
      gs.uploadFile(file, folder, function(pct) {
        if (progF) progF.style.width = pct + '%';
        if (pubBtn) pubBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + pct + '%';
      }).then(function(url) {
        gs.createStory(text, url, function(err) {
          if (err) { showToast('შეცდომა — სცადე თავიდან'); resetPubBtn(); return; }
          showToast('🌱 სთორი გამოქვეყნდა!');
          setTimeout(closeEditor, 1000);
        }, extra);
      }).catch(function() {
        showToast('ატვირთვა ვერ მოხდა'); resetPubBtn();
      });
    } else {
      // Fallback: read as dataURL and upload
      var reader = new FileReader();
      reader.onload = function(e) {
        if (gs.uploadImageDataUrl) {
          gs.uploadImageDataUrl(e.target.result, folder).then(function(url) {
            gs.createStory(text, url || e.target.result, function(err) {
              if (err) { showToast('შეცდომა'); resetPubBtn(); return; }
              showToast('🌱 სთორი გამოქვეყნდა!');
              setTimeout(closeEditor, 1000);
            }, extra);
          }).catch(function() { showToast('ატვირთვა ვერ მოხდა'); resetPubBtn(); });
        } else {
          gs.createStory(text, e.target.result, function(err) {
            if (err) { showToast('შეცდომა'); resetPubBtn(); return; }
            showToast('🌱 სთორი გამოქვეყნდა!');
            setTimeout(closeEditor, 1000);
          }, extra);
        }
      };
      reader.readAsDataURL(file);
    }
  }

  function resetPubBtn() {
    var b = document.getElementById('sePub');
    if (b) { b.disabled = false; b.innerHTML = '<i class="fas fa-paper-plane"></i> გამოქვეყნება'; }
    var p = document.getElementById('seProg');
    if (p) p.style.display = 'none';
  }

  // ─── Toast ────────────────────────────────────────────────
  function showToast(msg) {
    var ov = document.getElementById('seOv');
    if (!ov) { if (window.toast) window.toast(msg); return; }
    var t = document.createElement('div');
    t.className = 'se-toast'; t.textContent = msg;
    ov.appendChild(t);
    setTimeout(function() { t.remove(); }, 2400);
  }

  // ─── Close editor ─────────────────────────────────────────
  function closeEditor() {
    var ov = document.getElementById('seOv');
    if (ov) ov.remove();
    window.removeEventListener('resize', sizeCanvas);
  }

  // ─── Wire all events ──────────────────────────────────────
  function wireEvents() {
    document.getElementById('seClose').addEventListener('click', closeEditor);
    document.getElementById('sePub').addEventListener('click', publishStory);

    // Photo/Video
    document.getElementById('stPhoto').addEventListener('click', function() {
      document.getElementById('seFile').click();
    });
    document.getElementById('seFile').addEventListener('change', function() {
      var file = this.files && this.files[0];
      if (!file) return;
      _state.mediaFile = file;
      _state.mediaType = file.type.startsWith('video/') ? 'video' : 'image';
      _state.mediaLocalUrl = URL.createObjectURL(file);
      applyBg();
      closePanel();
    });

    document.getElementById('stBg').addEventListener('click', showBgPanel);
    document.getElementById('stDraw').addEventListener('click', showDrawPanel);
    document.getElementById('stEmoji').addEventListener('click', showEmojiPanel);
    document.getElementById('stText').addEventListener('click', showTextPanel);
    document.getElementById('stDur').addEventListener('click', showDurPanel);

    // Click on canvas background → deselect + close panel
    document.getElementById('seCv').addEventListener('pointerdown', function(e) {
      if (e.target === this || e.target.classList.contains('se-cv-bg')) {
        selectEl(null);
        if (!_isDrawing) closePanel();
      }
    });

    // ESC
    var onKey = function(e) {
      if (e.key === 'Escape') {
        if (_activeTool) closePanel();
        else { closeEditor(); document.removeEventListener('keydown', onKey); }
      }
    };
    document.addEventListener('keydown', onKey);
  }

  // ─── Open ─────────────────────────────────────────────────
  function openEditor() {
    injectCSS();
    if (document.getElementById('seOv')) return;
    resetState();

    var GF = window.GeoFirebase;
    var fbUser = GF && GF.auth && GF.auth.currentUser;
    var me = { name: 'GeoHub', avatar: '' };
    if (fbUser) {
      me.name = fbUser.displayName || fbUser.email || 'You';
      me.avatar = fbUser.photoURL || '';
    }

    var ov = buildOverlay(me);
    document.body.appendChild(ov);

    sizeCanvas();
    applyBg();
    wireDrawCanvas();
    wireEvents();

    window.addEventListener('resize', sizeCanvas);
  }

  // ─── Register override hook ───────────────────────────────
  function patch() {
    window._ghStoryEditor = openEditor;
    window.openStoryEditor = openEditor;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patch);
  } else {
    patch();
  }

})();
