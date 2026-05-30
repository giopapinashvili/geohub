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
  function getEventImage(e) { return e.imageUrl||e.image||e.coverImage||e.coverImageUrl||e.coverUrl||e.photoUrl||e.thumbnail||''; }

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

  function gcalLink(ev) {
    var dateVal = ev.date || ev.startDate;
    var ms = tsToMs(dateVal);
    if (!ms) return '';
    var start = new Date(ms);
    var end   = new Date(ms + 2 * 3600 * 1000);
    function fmt(d) {
      return d.getUTCFullYear()
        + String(d.getUTCMonth() + 1).padStart(2, '0')
        + String(d.getUTCDate()).padStart(2, '0')
        + 'T' + String(d.getUTCHours()).padStart(2, '0')
        + String(d.getUTCMinutes()).padStart(2, '0') + '00Z';
    }
    return 'https://www.google.com/calendar/render?action=TEMPLATE'
      + '&text=' + encodeURIComponent(ev.title || ev.name || 'GeoHub Event')
      + '&dates=' + fmt(start) + '/' + fmt(end)
      + (ev.description ? '&details=' + encodeURIComponent(String(ev.description).slice(0, 500)) : '')
      + ((ev.location || ev.venue) ? '&location=' + encodeURIComponent(ev.location || ev.venue) : '');
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

  function rsvpBtnHtml(eventId, isGoing, size) {
    var pad = size === 'lg' ? '8px 16px' : '6px 12px';
    var fs  = size === 'lg' ? '.82rem' : '.76rem';
    return '<button class="geo-rsvp-btn" data-event-id="' + esc(eventId) + '"'
      + (isGoing ? ' data-going="1"' : '')
      + ' style="background:rgba(255,255,255,.07);border:1px solid '
      + (isGoing ? 'rgba(16,185,129,.3)' : 'rgba(255,255,255,.1)') + ';color:'
      + (isGoing ? '#10b981' : '#94a3b8')
      + ';border-radius:8px;padding:' + pad + ';cursor:pointer;font-size:' + fs + ';font-weight:600">'
      + (isGoing ? '<i class="fas fa-check"></i> Going!' : '<i class="fas fa-calendar-check"></i> RSVP')
      + '</button>';
  }

  function renderCard(event) {
    var going   = Number(event.rsvpCount || event.attendees || 0);
    var cap     = Number(event.capacity || 0);
    var soldOut = cap > 0 && going >= cap;
    var future  = isFuture(event.date || event.startDate);
    var dateVal = event.date || event.startDate;
    var isGoing = !!state.myRsvpIds[event.id];
    var img     = getEventImage(event);

    return [
      '<article class="geo-event-card" style="',
        'background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);',
        'border-radius:18px;overflow:hidden;display:flex;flex-direction:column;',
        'cursor:pointer;transition:border-color .25s,transform .25s" ',
        'onclick="openEventDetail(\'' + esc(event.id) + '\')"',
        'onmouseover="this.style.borderColor=\'rgba(16,185,129,.35)\';this.style.transform=\'translateY(-2px)\'"',
        'onmouseout="this.style.borderColor=\'rgba(255,255,255,.08)\';this.style.transform=\'\'">',

        img
          ? '<div style="height:170px;overflow:hidden"><img src="' + esc(img) + '" alt="" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.style.display=\'none\'"></div>'
          : '<div style="height:90px;background:linear-gradient(135deg,rgba(16,185,129,.2),rgba(59,130,246,.15));display:flex;align-items:center;justify-content:center;font-size:2.2rem">🎉</div>',

        '<div style="padding:16px;flex:1;display:flex;flex-direction:column;gap:9px">',
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">',
            categoryBadge(event.category),
            event.status === 'cancelled'
              ? '<span style="color:#ef4444;font-size:.7rem;font-weight:700;background:rgba(239,68,68,.12);padding:2px 8px;border-radius:6px">CANCELLED</span>'
              : future
                ? '<span style="color:#10b981;font-size:.7rem;font-weight:700;background:rgba(16,185,129,.1);padding:2px 8px;border-radius:6px">UPCOMING</span>'
                : '<span style="color:#64748b;font-size:.7rem;background:rgba(255,255,255,.05);padding:2px 8px;border-radius:6px">PAST</span>',
          '</div>',

          '<h3 style="font-size:.95rem;font-weight:700;color:#f1f5f9;line-height:1.35;margin:0">' + esc(event.title || event.name || 'Event') + '</h3>',

          event.description
            ? '<p style="color:#94a3b8;font-size:.8rem;line-height:1.5;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + esc(event.description) + '</p>'
            : '',

          '<div style="display:flex;flex-direction:column;gap:3px;font-size:.78rem;color:#94a3b8">',
            dateVal ? '<span><i class="fas fa-calendar" style="width:14px;text-align:center;color:#10b981;margin-right:6px"></i>' + formatDate(dateVal) + (formatTime(dateVal) ? ' &middot; ' + formatTime(dateVal) : '') + '</span>' : '',
            (event.location || event.venue) ? '<span><i class="fas fa-map-marker-alt" style="width:14px;text-align:center;color:#3b82f6;margin-right:6px"></i>' + esc(event.location || event.venue) + '</span>' : '',
            cap > 0
              ? '<span><i class="fas fa-users" style="width:14px;text-align:center;color:#f59e0b;margin-right:6px"></i>' + going + ' / ' + cap + ' attendees</span>'
              : (going > 0 ? '<span><i class="fas fa-users" style="width:14px;text-align:center;color:#f59e0b;margin-right:6px"></i>' + going + ' going</span>' : ''),
          '</div>',

          '<div style="margin-top:auto;padding-top:6px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px" onclick="event.stopPropagation()">',
            soldOut
              ? '<span style="color:#ef4444;font-size:.8rem;font-weight:700"><i class="fas fa-ban"></i> Sold out</span>'
              : ticketButton(event),
            rsvpBtnHtml(event.id, isGoing),
          '</div>',
        '</div>',
      '</article>',
    ].join('');
  }

  function renderEmpty(msg) {
    return '<div style="grid-column:1/-1;min-height:260px;display:flex;align-items:center;justify-content:center;'
      + 'text-align:center;color:#94a3b8;border:1px dashed rgba(255,255,255,.12);border-radius:22px;background:rgba(255,255,255,.02)">'
      + '<div><div style="font-size:2rem;margin-bottom:10px">🎉</div>'
      + '<h3 style="color:#f8fafc;margin:0 0 6px">No events</h3>'
      + '<p style="margin:0;font-size:.83rem">' + (msg || 'Events appear here once created in the Admin Panel.') + '</p></div></div>';
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
    else {
      var m = document.querySelector('.clean-content') || document.querySelector('main');
      if (m) m.appendChild(grid);
    }
    return grid;
  }

  // ── Sidebar ────────────────────────────────────────────────────────────────

  function paintSidebar() {
    var aside = document.querySelector('.clean-card');
    if (!aside) return;

    var cats = {};
    state.all.forEach(function (e) { var c = e.category; if (c) cats[c] = (cats[c] || 0) + 1; });
    var catKeys = Object.keys(cats).sort();

    var html = '<strong style="font-size:.9rem;color:#f1f5f9">Filters</strong>';

    if (catKeys.length) {
      var btnStyle = function(active) {
        return 'text-align:left;width:100%;background:' + (active ? 'rgba(16,185,129,.12)' : 'rgba(255,255,255,.04)')
          + ';border:1px solid ' + (active ? 'rgba(16,185,129,.3)' : 'rgba(255,255,255,.06)')
          + ';color:' + (active ? '#10e0a0' : '#94a3b8')
          + ';border-radius:8px;padding:7px 12px;cursor:pointer;font-size:.82rem;font-weight:600';
      };
      html += '<div style="margin-top:14px;display:flex;flex-direction:column;gap:5px">'
        + '<div style="font-size:.72rem;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Category</div>'
        + '<button onclick="_setEvCat(\'\')" style="' + btnStyle(!state.catFilter) + '">All (' + state.all.length + ')</button>'
        + catKeys.map(function (c) {
            return '<button onclick="_setEvCat(\'' + esc(c) + '\')" style="' + btnStyle(state.catFilter === c) + '">'
              + esc(c) + ' <span style="opacity:.5">(' + cats[c] + ')</span></button>';
          }).join('')
        + '</div>';
    } else {
      html += '<p style="color:#64748b;font-size:.82rem;margin-top:10px;line-height:1.6">Categories appear once events are added.</p>';
    }

    if (user()) {
      var rsvpCount = Object.keys(state.myRsvpIds).length;
      html += '<div style="margin-top:16px;border-top:1px solid rgba(255,255,255,.06);padding-top:14px">'
        + '<div style="font-size:.72rem;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Your Activity</div>'
        + '<button onclick="_setEvFilter(\'mine\')" style="text-align:left;width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);color:#94a3b8;border-radius:8px;padding:7px 12px;cursor:pointer;font-size:.82rem;font-weight:600">'
        + '<i class="fas fa-calendar-check" style="color:#10b981;margin-right:6px"></i>My RSVPs (' + rsvpCount + ')</button>'
        + '</div>';
    }

    aside.innerHTML = html;
  }

  // ── State + paint ──────────────────────────────────────────────────────────

  var state = { all: [], filter: 'all', search: '', catFilter: '', myRsvpIds: {} };

  function paint() {
    var grid   = getOrCreateGrid();
    var events = state.all.slice();

    if (state.filter === 'upcoming') events = events.filter(function (e) { return isFuture(e.date || e.startDate); });
    if (state.filter === 'past')     events = events.filter(function (e) { var ms = tsToMs(e.date || e.startDate); return ms > 0 && ms <= Date.now(); });
    if (state.filter === 'mine')     events = events.filter(function (e) { return !!state.myRsvpIds[e.id]; });

    if (state.catFilter) {
      events = events.filter(function (e) { return (e.category || '') === state.catFilter; });
    }

    if (state.search) {
      var q = state.search.toLowerCase();
      events = events.filter(function (e) {
        return (e.title || e.name || '').toLowerCase().includes(q)
          || (e.description || '').toLowerCase().includes(q)
          || (e.location || e.venue || '').toLowerCase().includes(q);
      });
    }

    var emptyMsg = state.filter === 'mine' ? 'RSVP to events to see them here.'
      : state.filter === 'past' ? 'No past events found.'
      : state.filter === 'upcoming' ? 'No upcoming events found.'
      : undefined;

    grid.innerHTML = events.length ? events.map(renderCard).join('') : renderEmpty(emptyMsg);

    var statTotal = $('stat-total');
    if (statTotal) statTotal.textContent = state.all.length;
    var statUpcoming = $('stat-upcoming');
    if (statUpcoming) statUpcoming.textContent = state.all.filter(function (e) { return isFuture(e.date || e.startDate); }).length;
    var statMine = $('stat-mine');
    if (statMine) statMine.textContent = Object.keys(state.myRsvpIds).length;

    paintSidebar();
  }

  // ── Global helpers called from inline onclick ──────────────────────────────

  window._setEvCat = function (cat) {
    state.catFilter = cat;
    paint();
  };

  window._setEvFilter = function (filter) {
    state.filter = filter;
    document.querySelectorAll('.clean-tab').forEach(function (b) {
      var lbl = b.textContent.trim().toLowerCase();
      var match = (filter === 'mine' && lbl.includes('my'))
        || (filter === 'upcoming' && lbl.includes('upcoming'))
        || (filter === 'past' && lbl === 'past')
        || (filter === 'all' && lbl === 'all');
      b.classList.toggle('active', match);
    });
    paint();
  };

  // ── Firestore — events ─────────────────────────────────────────────────────

  var _eventsUnsub = null;

  function loadEvents() {
    var fb = window.GeoFirebase;
    if (!fb || !fb.db || !fb.fs) return;
    var fs = fb.fs;

    function subscribe(q) {
      _eventsUnsub = fs.onSnapshot(q, function (snap) {
        state.all = [];
        snap.forEach(function (d) {
          var item = Object.assign({ id: d.id }, d.data());
          if (item.status !== 'inactive') state.all.push(item);
        });
        paint();
      }, function (err) {
        console.warn('[GeoHub Events]', err.message);
      });
    }

    try {
      subscribe(fs.query(
        fs.collection(fb.db, 'events'),
        fs.where('status', '==', 'active'),
        fs.orderBy('createdAt', 'desc'),
        fs.limit(60)
      ));
    } catch (e) {
      subscribe(fs.query(
        fs.collection(fb.db, 'events'),
        fs.orderBy('createdAt', 'desc'),
        fs.limit(60)
      ));
    }
  }

  // ── Firestore — RSVPs ──────────────────────────────────────────────────────

  function loadMyRsvps() {
    var fb = window.GeoFirebase;
    var u = user();
    if (!fb || !fb.db || !fb.fs || !u) return;
    fb.fs.getDocs(fb.fs.query(
      fb.fs.collection(fb.db, 'eventParticipants'),
      fb.fs.where('userId', '==', u.uid),
      fb.fs.limit(100)
    )).then(function (snap) {
      state.myRsvpIds = {};
      snap.forEach(function (d) {
        var data = d.data();
        if (data.eventId) state.myRsvpIds[data.eventId] = true;
      });
      // Patch existing RSVP buttons without full repaint
      document.querySelectorAll('.geo-rsvp-btn').forEach(function (btn) {
        var eid = btn.dataset.eventId;
        if (!eid) return;
        var going = !!state.myRsvpIds[eid];
        btn.dataset.going = going ? '1' : '';
        btn.style.color = going ? '#10b981' : '#94a3b8';
        btn.style.borderColor = going ? 'rgba(16,185,129,.3)' : 'rgba(255,255,255,.1)';
        btn.innerHTML = going ? '<i class="fas fa-check"></i> Going!' : '<i class="fas fa-calendar-check"></i> RSVP';
      });
      var statMine = $('stat-mine');
      if (statMine) statMine.textContent = Object.keys(state.myRsvpIds).length;
      paintSidebar();
    }).catch(function (err) {
      console.warn('[Events] loadMyRsvps', err.message);
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
        state.filter = lbl.includes('upcoming') ? 'upcoming'
          : lbl === 'past' ? 'past'
          : lbl.includes('my') ? 'mine'
          : 'all';
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
      e.preventDefault(); e.stopPropagation();
      if (!user()) { window.location.href = 'auth.html'; return; }
      if (!window.GeoCheckout) { toast('Payment system loading, please retry.', 'error'); return; }
      window.GeoCheckout.buyEventTicket(tBtn.dataset.eventId, 1, tBtn);
      return;
    }

    var rBtn = e.target.closest('.geo-rsvp-btn');
    if (rBtn) {
      e.preventDefault(); e.stopPropagation();
      if (!user()) { window.location.href = 'auth.html'; return; }
      var gs = GS();
      var eid = rBtn.dataset.eventId;
      if (!eid) return;
      if (gs && gs.rsvpEvent) {
        rBtn.disabled = true;
        gs.rsvpEvent(eid, function (result) {
          rBtn.disabled = false;
          if (result === true) {
            state.myRsvpIds[eid] = true;
            rBtn.dataset.going = '1';
            rBtn.style.color = '#10b981';
            rBtn.style.borderColor = 'rgba(16,185,129,.3)';
            rBtn.innerHTML = '<i class="fas fa-check"></i> Going!';
          } else if (result === 'removed') {
            delete state.myRsvpIds[eid];
            rBtn.dataset.going = '';
            rBtn.style.color = '#94a3b8';
            rBtn.style.borderColor = 'rgba(255,255,255,.1)';
            rBtn.innerHTML = '<i class="fas fa-calendar-check"></i> RSVP';
          }
          // Sync all other RSVP buttons for same event (card + detail)
          document.querySelectorAll('.geo-rsvp-btn[data-event-id="' + eid + '"]').forEach(function (b) {
            if (b === rBtn) return;
            var g = !!state.myRsvpIds[eid];
            b.dataset.going = g ? '1' : '';
            b.style.color = g ? '#10b981' : '#94a3b8';
            b.style.borderColor = g ? 'rgba(16,185,129,.3)' : 'rgba(255,255,255,.1)';
            b.innerHTML = g ? '<i class="fas fa-check"></i> Going!' : '<i class="fas fa-calendar-check"></i> RSVP';
          });
          var statMine = $('stat-mine');
          if (statMine) statMine.textContent = Object.keys(state.myRsvpIds).length;
          paintSidebar();
        });
      }
    }
  });

  // ── Share event ────────────────────────────────────────────────────────────

  window.shareEvent = function (eventId, eventTitle) {
    var url = location.origin + '/events.html?id=' + encodeURIComponent(eventId);
    if (navigator.share) {
      navigator.share({ title: eventTitle || 'GeoHub Event', url: url }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () { toast('Link copied!'); }).catch(function () { prompt('Copy this link:', url); });
    } else {
      prompt('Copy this link:', url);
    }
  };

  // ── Event detail overlay ──────────────────────────────────────────────────

  function _renderEventDetail(ev) {
    var box = $('evDetailBox');
    if (!box) return;
    var img     = getEventImage(ev);
    var dateVal = ev.date || ev.startDate;
    var going   = Number(ev.rsvpCount || ev.attendees || 0);
    var cap     = Number(ev.capacity || 0);
    var soldOut = cap > 0 && going >= cap;
    var isGoing = !!state.myRsvpIds[ev.id];
    var calUrl  = gcalLink(ev);
    var loc     = ev.location || ev.venue || '';
    var mapsUrl = loc ? 'https://maps.google.com/?q=' + encodeURIComponent(loc) : '';
    var detBtn  = 'display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:9px;'
      + 'border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);color:#e2e8f0;'
      + 'font-size:.8rem;font-weight:600;cursor:pointer;text-decoration:none';

    box.innerHTML =
      '<div style="position:relative">'
        + (img
            ? '<div style="height:220px;overflow:hidden;border-radius:22px 22px 0 0"><img src="' + esc(img) + '" alt="" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.style.display=\'none\'"></div>'
            : '<div style="height:110px;background:linear-gradient(135deg,rgba(16,185,129,.2),rgba(59,130,246,.15));border-radius:22px 22px 0 0;display:flex;align-items:center;justify-content:center;font-size:3rem">🎉</div>')
        + '<button onclick="closeEventDetail()" style="position:absolute;top:12px;right:12px;background:rgba(0,0,0,.55);border:none;color:#fff;border-radius:50%;width:34px;height:34px;cursor:pointer;font-size:.95rem;line-height:1">✕</button>'
      + '</div>'
      + '<div style="padding:22px">'
        + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px;flex-wrap:wrap">'
          + '<div>'
            + '<h2 style="font-size:1.25rem;font-weight:900;margin:0 0 8px;color:#f8fafc">' + esc(ev.title || ev.name || 'Event') + '</h2>'
            + categoryBadge(ev.category)
          + '</div>'
          + (ev.status === 'cancelled'
              ? '<span style="color:#ef4444;font-size:.72rem;font-weight:700;background:rgba(239,68,68,.12);padding:3px 10px;border-radius:6px;white-space:nowrap;align-self:flex-start">CANCELLED</span>'
              : '<span style="color:#' + (isFuture(dateVal) ? '10b981' : '64748b') + ';font-size:.72rem;font-weight:700;'
                + 'background:rgba(' + (isFuture(dateVal) ? '16,185,129' : '255,255,255') + ',.08);padding:3px 10px;border-radius:6px;white-space:nowrap;align-self:flex-start">'
                + (isFuture(dateVal) ? 'UPCOMING' : 'PAST') + '</span>')
        + '</div>'
        + '<div style="display:flex;flex-direction:column;gap:7px;font-size:.84rem;color:#94a3b8;margin:14px 0">'
          + (dateVal ? '<span><i class="fas fa-calendar" style="width:16px;text-align:center;color:#10b981;margin-right:7px"></i>' + formatDate(dateVal) + (formatTime(dateVal) ? ' &middot; ' + formatTime(dateVal) : '') + '</span>' : '')
          + (loc ? '<span><i class="fas fa-map-marker-alt" style="width:16px;text-align:center;color:#3b82f6;margin-right:7px"></i>' + esc(loc) + '</span>' : '')
          + ((ev.hostName || ev.organizerName) ? '<span><i class="fas fa-user" style="width:16px;text-align:center;color:#a855f7;margin-right:7px"></i>' + esc(ev.hostName || ev.organizerName) + '</span>' : '')
          + (cap > 0
              ? '<span><i class="fas fa-users" style="width:16px;text-align:center;color:#f59e0b;margin-right:7px"></i>' + going + ' / ' + cap + ' attendees</span>'
              : (going > 0 ? '<span><i class="fas fa-users" style="width:16px;text-align:center;color:#f59e0b;margin-right:7px"></i>' + going + ' going</span>' : ''))
          + (ev.businessId ? '<span><i class="fas fa-store" style="width:16px;text-align:center;color:#10b981;margin-right:7px"></i><a href="business.html?id=' + esc(ev.businessId) + '" style="color:#10b981;text-decoration:none">View Business Page</a></span>' : '')
          + (ev.groupId ? '<span><i class="fas fa-users-cog" style="width:16px;text-align:center;color:#a855f7;margin-right:7px"></i><a href="groups.html?id=' + esc(ev.groupId) + '" style="color:#a855f7;text-decoration:none">View Group</a></span>' : '')
        + '</div>'
        + (ev.description ? '<p style="font-size:.88rem;color:#94a3b8;line-height:1.65;margin:0 0 16px">' + esc(ev.description) + '</p>' : '')
        + '<div id="evStoriesStrip" style="margin-bottom:14px;display:none">'
          + '<div style="font-size:.75rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px"><i class="fas fa-circle-play" style="color:#10b981;margin-right:5px"></i>ღონისძიების სტორიები</div>'
          + '<div class="gh-stories-bar" id="evStoriesBar">'
            + '<div id="evStoriesItems" style="display:contents"></div>'
          + '</div>'
        + '</div>'
        + '<div id="evRsvpAdminList"></div>'
        // RSVP + ticket row
        + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px">'
          + (soldOut
              ? '<span style="color:#ef4444;font-size:.85rem;font-weight:700"><i class="fas fa-ban"></i> Sold out</span>'
              : ticketButton(ev))
          + rsvpBtnHtml(ev.id, isGoing, 'lg')
        + '</div>'
        // Action buttons row
        + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
          + '<button style="' + detBtn + '" onclick="shareEvent(\'' + esc(ev.id) + '\',\'' + esc(ev.title || ev.name || '') + '\')"><i class="fas fa-share-alt"></i> Share</button>'
          + (calUrl ? '<a style="' + detBtn + '" href="' + calUrl + '" target="_blank" rel="noopener"><i class="fas fa-calendar-plus"></i> Add to Calendar</a>' : '')
          + (mapsUrl ? '<a style="' + detBtn + '" href="' + mapsUrl + '" target="_blank" rel="noopener"><i class="fas fa-directions"></i> Directions</a>' : '')
        + '</div>'
      + '</div>';

    // Load event stories
    (function loadEvStories() {
      var gs2 = GS();
      if (!gs2 || !gs2.listenEventStories) return;
      var _evStoriesUnsub = gs2.listenEventStories(ev.id, function(sts) {
        var strip = document.getElementById('evStoriesStrip');
        var itemsEl = document.getElementById('evStoriesItems');
        if (!strip || !itemsEl) { if(_evStoriesUnsub) _evStoriesUnsub(); return; }
        if (!sts || !sts.length) { strip.style.display = 'none'; return; }
        strip.style.display = 'block';
        var bsg = window.GeoHub && window.GeoHub.buildStoryGroups;
        var rsc = window.GeoHub && window.GeoHub.renderStoryCard;
        var osv = window.GeoHub && window.GeoHub.openStoryViewer;
        if (typeof bsg !== 'function') {
          itemsEl.innerHTML = sts.map(function(s) {
            var av = s.authorAvatar || '';
            return '<div class="gh-story-card" style="flex-shrink:0;width:56px;text-align:center;cursor:pointer">'
              + '<div class="gh-story-ring" style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#10b981,#3b82f6);padding:2px;margin:0 auto">'
              + '<div style="width:100%;height:100%;border-radius:50%;overflow:hidden;background:#1a1f35;display:flex;align-items:center;justify-content:center">'
              + (av ? '<img src="' + s.authorAvatar + '" style="width:100%;height:100%;object-fit:cover" alt="">' : '<i class="fas fa-user" style="color:#94a3b8;font-size:.9rem"></i>')
              + '</div></div>'
              + '<span style="font-size:.65rem;color:#94a3b8;display:block;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:56px">' + (s.authorName || '').substring(0, 8) + '</span>'
              + '</div>';
          }).join('');
          return;
        }
        var groups = bsg(sts);
        itemsEl.innerHTML = groups.map(function(grp, i) { return typeof rsc === 'function' ? rsc(grp, i) : ''; }).join('');
        if (typeof osv === 'function') {
          itemsEl.querySelectorAll('[data-story-group-idx]').forEach(function(card) {
            card.onclick = function() { osv(groups, parseInt(card.dataset.storyGroupIdx || '0', 10)); };
          });
        }
      });
    })();

    // Async verify RSVP if not already cached
    var gs = GS();
    if (gs && gs.checkEventParticipant && !state.myRsvpIds[ev.id]) {
      gs.checkEventParticipant(ev.id, function (alreadyGoing) {
        if (!alreadyGoing) return;
        state.myRsvpIds[ev.id] = true;
        box.querySelectorAll('.geo-rsvp-btn[data-event-id="' + ev.id + '"]').forEach(function (btn) {
          btn.dataset.going = '1';
          btn.style.color = '#10b981';
          btn.style.borderColor = 'rgba(16,185,129,.3)';
          btn.innerHTML = '<i class="fas fa-check"></i> Going!';
        });
      });
    }

    // Admin: load RSVP participant list
    var u = user();
    var fb = window.GeoFirebase;
    if (u && fb && fb.fs && fb.db) {
      fb.fs.getDoc(fb.fs.doc(fb.db, 'admins', u.uid)).then(function (snap) {
        if (!snap.exists()) return;
        var listEl = document.getElementById('evRsvpAdminList');
        if (!listEl) return;
        listEl.innerHTML = '<div style="margin-top:16px;border-top:1px solid rgba(255,255,255,.08);padding-top:14px">'
          + '<div style="font-size:.75rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">'
          + '<i class="fas fa-shield-alt" style="color:#10b981;margin-right:5px"></i>Admin · RSVP List</div>'
          + '<div id="evRsvpAdminListInner" style="font-size:.8rem;color:#94a3b8"><i class="fas fa-circle-notch fa-spin"></i></div>'
          + '</div>';
        fb.fs.getDocs(fb.fs.query(
          fb.fs.collection(fb.db, 'eventParticipants'),
          fb.fs.where('eventId', '==', ev.id),
          fb.fs.limit(100)
        )).then(function (pSnap) {
          var inner = document.getElementById('evRsvpAdminListInner');
          if (!inner) return;
          if (pSnap.empty) { inner.textContent = 'No RSVPs yet.'; return; }
          var rows = [];
          pSnap.forEach(function (d) {
            var p = d.data();
            rows.push('<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05)">'
              + '<i class="fas fa-user-check" style="color:#10b981;font-size:.75rem"></i>'
              + '<span>' + esc(p.userName || p.userId || d.id) + '</span>'
              + '</div>');
          });
          inner.innerHTML = '<div style="color:#e2e8f0;font-weight:700;margin-bottom:6px">'
            + pSnap.size + ' attendee' + (pSnap.size !== 1 ? 's' : '') + '</div>'
            + rows.join('');
        }).catch(function () {
          var inner = document.getElementById('evRsvpAdminListInner');
          if (inner) inner.textContent = 'Could not load participants.';
        });
      }).catch(function () {});
    }
  }

  function openEventDetail(eventId) {
    var overlay = $('evDetailOverlay');
    var box     = $('evDetailBox');
    if (!overlay || !box) return;
    overlay.classList.add('open');
    var ev = state.all.find(function (e) { return e.id === eventId; });
    if (ev) { _renderEventDetail(ev); return; }
    box.innerHTML = '<div style="padding:40px;text-align:center;color:#64748b"><i class="fas fa-circle-notch fa-spin" style="font-size:1.5rem"></i></div>';
    var fb = window.GeoFirebase;
    if (!fb || !fb.fs || !fb.db) { box.innerHTML = '<p style="padding:24px;color:#94a3b8">Event not found.</p>'; return; }
    fb.fs.getDoc(fb.fs.doc(fb.db, 'events', eventId)).then(function (snap) {
      if (!snap.exists()) { box.innerHTML = '<p style="padding:24px;color:#94a3b8">Event not found.</p>'; return; }
      _renderEventDetail(Object.assign({ id: snap.id }, snap.data()));
    }).catch(function () { box.innerHTML = '<p style="padding:24px;color:#94a3b8">Could not load event.</p>'; });
  }

  function closeEventDetail() {
    var overlay = $('evDetailOverlay');
    if (overlay) overlay.classList.remove('open');
  }

  window.openEventDetail  = openEventDetail;
  window.closeEventDetail = closeEventDetail;

  (function () {
    var ov = $('evDetailOverlay');
    if (ov) ov.addEventListener('click', function (e) { if (e.target === ov) closeEventDetail(); });
  })();

  // ── Boot ──────────────────────────────────────────────────────────────────

  function boot() {
    bindControls();
    loadEvents();
    var urlId = new URLSearchParams(location.search).get('id');
    if (urlId) openEventDetail(urlId);
    var fb = window.GeoFirebase;
    if (fb && fb.auth && fb.auth.onAuthStateChanged) {
      fb.auth.onAuthStateChanged(function (u) { if (u) loadMyRsvps(); });
    }
  }

  if (window.GeoFirebase) boot();
  else window.addEventListener('GeoFirebaseReady', boot, { once: true });
})();
