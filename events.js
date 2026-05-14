/* GeoHub Events — Firestore-backed events list + Stripe ticket checkout */
(function () {
  'use strict';

  if (!document.body.classList.contains('page-events') &&
      document.body.dataset.ghPage !== 'events') return;

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(id)  { return document.getElementById(id); }
  function user() { return window.GeoFirebase && window.GeoFirebase.auth && window.GeoFirebase.auth.currentUser; }
  function GS()   { return window.GeoSocial; }
  function toast(msg, t) { if (GS() && GS().toast) GS().toast(msg, t); else alert(msg); }
  function getEventImage(e){ return e.imageUrl||e.image||e.coverImage||e.coverImageUrl||e.coverUrl||e.photoUrl||e.thumbnail||''; }

  // ── Render helpers ─────────────────────────────────────────────────────────

  function categoryBadge(cat) {
    var colors = {
      music: '#a855f7', sports: '#3b82f6', tech: '#06b6d4',
      food: '#f59e0b', art: '#ec4899', outdoor: '#10b981',
      gaming: '#8b5cf6', business: '#64748b'
    };
    var c = colors[String(cat || '').toLowerCase()] || '#10b981';
    return '<span style="background:' + c + '1a;color:' + c + ';border:1px solid ' + c + '33;'
      + 'border-radius:6px;padding:2px 8px;font-size:.7rem;font-weight:700;text-transform:uppercase">'
      + esc(cat || 'Event') + '</span>';
  }

  function tsToMs(v) {
    if (!v) return 0;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (v.seconds) return v.seconds * 1000;
    if (v instanceof Date) return v.getTime();
    return new Date(v).getTime() || 0;
  }

  function formatDate(v) {
    var ms = tsToMs(v); if (!ms) return '';
    return new Date(ms).toLocaleDateString('ka-GE', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function formatTime(v) {
    var ms = tsToMs(v); if (!ms) return '';
    return new Date(ms).toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' });
  }

  function isFuture(v) {
    var ms = tsToMs(v);
    return !ms || ms > Date.now();
  }

  function ticketButton(event) {
    var price = Number(event.ticketPrice || event.price || 0);
    if (!price || price <= 0) {
      return '<span style="color:#94a3b8;font-size:.8rem"><i class="fas fa-ticket"></i> Free entry</span>';
    }
    var paymentsEnabled = window.GeoConfig && window.GeoConfig.FEATURE_FLAGS && window.GeoConfig.FEATURE_FLAGS.realPayments;
    if (!paymentsEnabled) {
      return '<span style="color:#64748b;font-size:.78rem;background:rgba(255,255,255,.05);padding:4px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.08)">'
        + '<i class="fas fa-ticket"></i> ' + price.toFixed(0) + ' &#x20BE; &middot; Tickets coming soon</span>';
    }
    return '<button class="geo-ticket-btn" data-event-id="' + esc(event.id) + '" style="'
      + 'background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;'
      + 'border-radius:10px;padding:9px 18px;font-weight:700;cursor:pointer;font-size:.83rem;'
      + 'display:inline-flex;align-items:center;gap:7px;transition:opacity .2s'
      + '" onmouseover="this.style.opacity=\'.85\'" onmouseout="this.style.opacity=\'1\'">'
      + '<i class="fas fa-ticket"></i> Buy Ticket &mdash; ' + price.toFixed(0) + ' &#x20BE;'
      + '</button>';
  }

  function renderCard(event) {
    var going   = Number(event.rsvpCount || event.attendees || 0);
    var cap     = Number(event.capacity || 0);
    var soldOut = cap > 0 && going >= cap;
    var future  = isFuture(event.date || event.startDate);
    var dateVal = event.date || event.startDate;

    return [
      '<article class="geo-event-card" style="',
        'background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);',
        'border-radius:18px;overflow:hidden;display:flex;flex-direction:column;',
        'transition:border-color .25s,transform .25s" ',
        'onmouseover="this.style.borderColor=\'rgba(16,185,129,.35)\';this.style.transform=\'translateY(-2px)\'"',
        'onmouseout="this.style.borderColor=\'rgba(255,255,255,.08)\';this.style.transform=\'\'">',

        getEventImage(event)
          ? '<div style="height:170px;overflow:hidden"><img src="' + esc(getEventImage(event)) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover"></div>'
          : '<div style="height:90px;background:linear-gradient(135deg,rgba(16,185,129,.2),rgba(59,130,246,.15));display:flex;align-items:center;justify-content:center;font-size:2.2rem">🎉</div>',

        '<div style="padding:16px;flex:1;display:flex;flex-direction:column;gap:9px">',
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">',
            categoryBadge(event.category),
            future
              ? '<span style="color:#10b981;font-size:.7rem;font-weight:700;background:rgba(16,185,129,.1);padding:2px 8px;border-radius:6px">UPCOMING</span>'
              : '<span style="color:#64748b;font-size:.7rem;background:rgba(255,255,255,.05);padding:2px 8px;border-radius:6px">PAST</span>',
          '</div>',

          '<h3 style="font-size:.95rem;font-weight:700;color:#f1f5f9;line-height:1.35;margin:0">' + esc(event.title || event.name || 'Event') + '</h3>',

          event.description
            ? '<p style="color:#94a3b8;font-size:.8rem;line-height:1.5;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + esc(event.description) + '</p>'
            : '',

          '<div style="display:flex;flex-direction:column;gap:3px;font-size:.78rem;color:#94a3b8">',
            dateVal ? '<span><i class="fas fa-calendar" style="width:14px;text-align:center;color:#10b981;margin-right:6px"></i>' + formatDate(dateVal) + ' &middot; ' + formatTime(dateVal) + '</span>' : '',
            (event.location || event.venue) ? '<span><i class="fas fa-map-marker-alt" style="width:14px;text-align:center;color:#3b82f6;margin-right:6px"></i>' + esc(event.location || event.venue) + '</span>' : '',
            cap > 0
              ? '<span><i class="fas fa-users" style="width:14px;text-align:center;color:#f59e0b;margin-right:6px"></i>' + going + ' / ' + cap + ' attendees</span>'
              : (going > 0 ? '<span><i class="fas fa-users" style="width:14px;text-align:center;color:#f59e0b;margin-right:6px"></i>' + going + ' going</span>' : ''),
          '</div>',

          '<div style="margin-top:auto;padding-top:6px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">',
            soldOut
              ? '<span style="color:#ef4444;font-size:.8rem;font-weight:700"><i class="fas fa-ban"></i> Sold out</span>'
              : ticketButton(event),
            '<button class="geo-rsvp-btn" data-event-id="' + esc(event.id) + '" style="'
              + 'background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);color:#94a3b8;'
              + 'border-radius:8px;padding:6px 12px;cursor:pointer;font-size:.76rem;font-weight:600'
              + '"><i class="fas fa-calendar-check"></i> RSVP</button>',
          '</div>',
        '</div>',
      '</article>',
    ].join('');
  }

  function renderEmpty() {
    return '<div style="grid-column:1/-1;min-height:260px;display:flex;align-items:center;justify-content:center;'
      + 'text-align:center;color:#94a3b8;border:1px dashed rgba(255,255,255,.12);border-radius:22px;background:rgba(255,255,255,.02)">'
      + '<div><div style="font-size:2rem;margin-bottom:10px">🎉</div>'
      + '<h3 style="color:#f8fafc;margin:0 0 6px">No events yet</h3>'
      + '<p style="margin:0;font-size:.83rem">Events appear here once created in the Admin Panel.</p></div></div>';
  }

  // ── Grid ──────────────────────────────────────────────────────────────────

  function getOrCreateGrid() {
    var el = $('geoEventsGrid');
    if (el) return el;
    var grid  = document.createElement('div');
    grid.id   = 'geoEventsGrid';
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(295px,1fr));gap:16px;width:100%';
    var target = $('cleanList');
    if (target) target.parentNode.replaceChild(grid, target);
    else { var m = document.querySelector('.clean-content main') || document.querySelector('main'); if (m) m.appendChild(grid); }
    return grid;
  }

  // ── State + paint ─────────────────────────────────────────────────────────

  var state = { all: [], filter: 'all', search: '' };

  function paint() {
    var grid   = getOrCreateGrid();
    var events = state.all.slice();

    if (state.filter === 'upcoming') events = events.filter(function (e) { return isFuture(e.date || e.startDate); });
    if (state.filter === 'mine')     events = events.filter(function (e) { return user() && e.createdBy === user().uid; });

    if (state.search) {
      var q = state.search.toLowerCase();
      events = events.filter(function (e) {
        return (e.title || e.name || '').toLowerCase().includes(q)
            || (e.description || '').toLowerCase().includes(q)
            || (e.location || e.venue || '').toLowerCase().includes(q);
      });
    }

    grid.innerHTML = events.length ? events.map(renderCard).join('') : renderEmpty();

    var stat = $('stat-total');
    if (stat) stat.textContent = state.all.length;
  }

  // ── Firestore ─────────────────────────────────────────────────────────────

  var _eventsUnsub = null;

  function loadEvents() {
    var fb = window.GeoFirebase;
    if (!fb || !fb.db || !fb.fs) return;
    var fs = fb.fs;

    var q = fs.query(
      fs.collection(fb.db, 'events'),
      fs.orderBy('createdAt', 'desc'),
      fs.limit(60)
    );

    _eventsUnsub = fs.onSnapshot(q, function (snap) {
      state.all = [];
      snap.forEach(function (d) { state.all.push(Object.assign({ id: d.id }, d.data())); });
      paint();
    }, function (err) {
      console.warn('[GeoHub Events]', err.message);
    });
  }

  window.addEventListener('pagehide', function () {
    if (_eventsUnsub) { try { _eventsUnsub(); } catch (e) {} _eventsUnsub = null; }
  });

  // ── Controls ──────────────────────────────────────────────────────────────

  function bindControls() {
    document.querySelectorAll('.clean-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.clean-tab').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var lbl = btn.textContent.trim().toLowerCase();
        state.filter = lbl.includes('upcoming') ? 'upcoming' : lbl.includes('my') ? 'mine' : 'all';
        paint();
      });
    });

    var si = document.querySelector('.clean-search input');
    if (si) {
      si.addEventListener('input',  function () { state.search = si.value.trim(); paint(); });
      var sb = document.querySelector('.clean-search button');
      if (sb) sb.addEventListener('click', function () { state.search = si.value.trim(); paint(); });
    }
  }

  // ── Ticket & RSVP delegation ──────────────────────────────────────────────

  document.addEventListener('click', function (e) {
    var tBtn = e.target.closest('.geo-ticket-btn');
    if (tBtn) {
      e.preventDefault();
      if (!user()) { window.location.href = 'auth.html'; return; }
      if (!window.GeoCheckout) { toast('Payment system loading, please retry.', 'error'); return; }
      window.GeoCheckout.buyEventTicket(tBtn.dataset.eventId, 1, tBtn);
      return;
    }

    var rBtn = e.target.closest('.geo-rsvp-btn');
    if (rBtn) {
      e.preventDefault();
      if (!user()) { window.location.href = 'auth.html'; return; }
      var gs = GS();
      if (gs && gs.rsvpEvent) {
        rBtn.disabled = true;
        gs.rsvpEvent(rBtn.dataset.eventId, function (ok) {
          rBtn.disabled = false;
          if (ok) { rBtn.style.color = '#10b981'; rBtn.innerHTML = '<i class="fas fa-check"></i> Going!'; }
        });
      } else {
        rBtn.style.color = '#10b981';
        rBtn.innerHTML = '<i class="fas fa-check"></i> Going!';
        toast('RSVP saved!', 'success');
      }
    }
  });

  // ── Boot ──────────────────────────────────────────────────────────────────

  function boot() { bindControls(); loadEvents(); }

  if (window.GeoFirebase) boot();
  else window.addEventListener('GeoFirebaseReady', boot, { once: true });
})();
