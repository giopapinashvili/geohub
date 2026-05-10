/* ================================================================
   GeoHub — Messages / Inbox System
   ================================================================ */

const MY_ID = 'u01';

function t(minAgo) { return Date.now() - Math.abs(minAgo) * 60000; }

const MOCK_CONVS = [
  {
    id: 'c_giorgi', type: 'user', withId: 'u02',
    online: true, lastActive: 'Active now', unread: 2, pinned: true,
    mockReplies: ['Got it! 👌', 'Sounds perfect!', 'See you there!', 'Let me know when you arrive', '🎵🎷'],
    initialMessages: [
      { id: 'g1', from: 'u02', text: 'Hey! Are you going to the Tbilisi Jazz Festival tomorrow?', ts: t(120) },
      { id: 'g2', from: MY_ID, text: 'Yes definitely! Just got my ticket 🎵', ts: t(115) },
      { id: 'g3', from: 'u02', text: 'Amazing! Want to meet at Fabrika first for drinks?', ts: t(90) },
      { id: 'g4', from: 'u02', text: 'We could grab a bite too before heading over 🍕', ts: t(85) },
    ],
    quickReplies: ["Sounds great! 🎉", "What time?", "Count me in!", "Meet at 19:00?"],
    sharedPlaces: ['Fabrika Tbilisi', 'Roasters Lab', 'Vino Underground'],
    sharedEvents: ['Tbilisi Jazz Festival', 'Sololaki Art Walk'],
  },
  {
    id: 'c_nino', type: 'user', withId: 'u04',
    online: false, lastActive: '3h ago', unread: 0, pinned: false,
    mockReplies: ['Great idea!', 'What time should we start?', "I'll bring snacks 😄", 'Sounds like a plan!'],
    initialMessages: [
      { id: 'n1', from: MY_ID, text: 'Hey! Want to join the Gergeti hike this Saturday?', ts: t(1440) },
      { id: 'n2', from: 'u04', text: "Oh yes! I've been wanting to do that hike forever", ts: t(1400) },
      { id: 'n3', from: 'u04', text: 'What time are we leaving? And from where?', ts: t(1395) },
      { id: 'n4', from: MY_ID, text: 'The group meets at Rustaveli at 4am. Transport to Kazbegi included 🏔️', ts: t(1380) },
      { id: 'n5', from: 'u04', text: "Perfect. I'll book my ticket now! 🥾", ts: t(1370) },
    ],
    quickReplies: ["Booked! ✅", "See you Saturday!", "What to bring?", "Check the event page"],
    sharedPlaces: ['Vake Park', 'Café Leila'],
    sharedEvents: ['Gergeti Sunrise Hike', 'Yoga in Vake Park'],
  },
  {
    id: 'c_hotel', type: 'business',
    bizName: 'Rooms Hotel Tbilisi', bizIcon: '🏨',
    online: false, lastActive: 'Replies within 1h', unread: 1, pinned: false,
    mockReplies: ['Thank you for your message! We\'ll confirm shortly.', 'The suite is available. Shall we confirm?', 'Of course! GeoHub members get 10% off 🎉', 'Happy to help with anything else!'],
    initialMessages: [
      { id: 'h1', from: MY_ID, text: "Hello! I'd like to inquire about your rooftop suite for May 10–11", ts: t(2880) },
      { id: 'h2', from: 'biz', text: 'Hello! The rooftop suite is available that weekend at 450 GEL/night.', ts: t(2800) },
      { id: 'h3', from: 'biz', text: 'This includes breakfast, pool access, and a welcome bottle of Georgian wine 🍷', ts: t(2795) },
    ],
    quickReplies: ["I'll take it!", "Any GeoHub discounts?", "Can I see photos?", "What's included?"],
    sharedPlaces: ['Rooms Hotel Tbilisi'],
    sharedEvents: [],
  },
  {
    id: 'c_collab', type: 'offer',
    withId: 'u10', bizName: 'Biltmore Tbilisi',
    online: true, lastActive: 'Active now', unread: 3, pinned: true,
    mockReplies: ['Very interested! 🙌', 'Can we negotiate the rate?', 'What does the Full Campaign include?', "Let me review and get back to you"],
    initialMessages: [
      { id: 'o1', sys: true, text: 'Collaboration offer from Biltmore Tbilisi', ts: t(360) },
      { id: 'o2', from: 'u10', text: "Hi! We love your content and think you'd be a perfect fit for our campaign 🌟", ts: t(355) },
      { id: 'o3', from: 'u10', text: 'We offer the Feed Post package: 1 post + caption + location tags — 80 GEL.', ts: t(350) },
      { id: 'o4', from: 'u10', text: 'Your audience perfectly matches our target. Interested? 🤝', ts: t(340) },
    ],
    quickReplies: ["Very interested! 🙌", "Tell me more", "Full Campaign instead?", "What's the timeline?"],
    sharedPlaces: ['Biltmore Tbilisi'],
    sharedEvents: [],
  },
  {
    id: 'c_hike_chat', type: 'event',
    groupName: 'Gergeti Sunrise Hike 🏔️', eventId: 'ev07',
    participants: ['u02', 'u04', 'u07', 'u30'],
    online: true, lastActive: 'Active', unread: 0, pinned: false,
    mockReplies: ['See you all there! 🏔️', "I'm so excited!", 'What should I pack?', 'Anyone near Rustaveli for a carpool?'],
    initialMessages: [
      { id: 'e1', sys: true, text: 'Group chat · Gergeti Sunrise Hike · Sat 10 May', ts: t(720) },
      { id: 'e2', from: 'u07', text: "So excited for this! First time hiking Gergeti 🏔️", ts: t(700) },
      { id: 'e3', from: 'u30', text: 'Wear layers! It can be cold near the summit even in May', ts: t(690) },
      { id: 'e4', from: 'u04', text: 'Should we coordinate carpooling from Tbilisi?', ts: t(680) },
      { id: 'e5', from: 'u02', text: "I have space for 2 in my car if anyone needs a ride 🚗", ts: t(670) },
    ],
    quickReplies: ["I'd love a ride! 🙏", "See you there! 🏔️", "Leaving at 4am?", "I'll bring snacks 🍫"],
    sharedPlaces: ['Gergeti Trinity Church'],
    sharedEvents: ['Gergeti Sunrise Hike'],
  },
  {
    id: 'c_batumi', type: 'group',
    groupName: 'Batumi Trip 🌊',
    participants: ['u06', 'u12', 'u21'],
    online: false, lastActive: '1h ago', unread: 1, pinned: false,
    mockReplies: ['Count me in! 🏖️', "Let's book tonight", "I'll check train schedules 🚆", 'Who drives?'],
    initialMessages: [
      { id: 'b1', sys: true, text: 'Batumi Trip group created', ts: t(10080) },
      { id: 'b2', from: 'u06', text: 'Guys! Long weekend is coming — Batumi trip?? 🏖️', ts: t(4320) },
      { id: 'b3', from: 'u12', text: 'YES. 100% in. When?', ts: t(4310) },
      { id: 'b4', from: 'u21', text: 'I can go June 1–4, would that work?', ts: t(4300) },
      { id: 'b5', from: MY_ID, text: "June 1 works great for me! Let's start planning 🌊", ts: t(4290) },
      { id: 'b6', from: 'u06', text: "I'll look at guesthouses near Old Batumi. Budget 60–80 GEL/night?", ts: t(1440) },
    ],
    quickReplies: ["Works for me! ✅", "Book it!", "I'll check trains 🚆", "60–80 GEL sounds good"],
    sharedPlaces: ['Batumi Boulevard', 'Café Laguna Batumi'],
    sharedEvents: [],
  },
  {
    id: 'c_jazz_org', type: 'organizer',
    bizName: 'TbilisiJazzFest', bizIcon: '🎷',
    online: false, lastActive: 'Automated',
    unread: 0, pinned: false,
    mockReplies: ['Thanks for the info!', 'See you there! 🎷', 'Is there nearby parking?'],
    initialMessages: [
      { id: 'org1', sys: true, text: 'Message from TbilisiJazzFest — Event Organizer', ts: t(480) },
      { id: 'org2', from: 'org', text: '🎵 Your ticket for Tbilisi Jazz Festival is confirmed!', ts: t(479) },
      { id: 'org3', from: 'org', text: 'Doors open at 20:00. Please bring your ticket QR code. Limited parking on-site.', ts: t(478) },
      { id: 'org4', from: 'org', text: "Can't wait to see you there! Tonight's lineup is incredible 🎷", ts: t(477) },
    ],
    quickReplies: ["See you there! 🎷", "Is there parking?", "Can I bring guests?", "Thanks! ❤️"],
    sharedPlaces: ['Tbilisi Philharmonic'],
    sharedEvents: ['Tbilisi Jazz Festival'],
  },
];

// ======================== STATE ========================
let activeConvId = window.safeStorage.get('gh_msg_active', null) || MOCK_CONVS[0].id;
let msgFilter   = 'all';
let msgSearch   = '';
let extraMsgs   = window.safeStorage.get('gh_msg_extra', {});
let readState   = window.safeStorage.get('gh_msg_read',  {});
let replyIdx    = {};
let typingTimer = null;

function getConv(id) { return MOCK_CONVS.find(c => c.id === id); }
function getUser(id) { return (typeof MOCK_USERS !== 'undefined' ? MOCK_USERS : []).find(u => u.id === id); }

function getConvMessages(convId) {
  const conv = getConv(convId);
  const base  = conv ? [...conv.initialMessages] : [];
  const extra = extraMsgs[convId] || [];
  return [...base, ...extra].sort((a, b) => a.ts - b.ts);
}

function getUnread(conv) {
  if (readState[conv.id]) return 0;
  return conv.unread;
}

// ======================== TIME FORMAT ========================
function fmtTime(ts) {
  const now  = Date.now();
  const diff = now - ts;
  const d    = new Date(ts);
  if (diff < 60000)   return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  const today = new Date(); today.setHours(0,0,0,0);
  if (d >= today) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  if (d >= yest) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function fmtTimestamp(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ======================== CONV DISPLAY HELPERS ========================
function getConvName(conv) {
  if (conv.groupName) return conv.groupName;
  if (conv.bizName)   return conv.bizName;
  const u = getUser(conv.withId);
  return u ? u.fullName : 'Unknown';
}

function getConvAvatar(conv) {
  if (conv.withId) {
    const u = getUser(conv.withId);
    return u ? `<img src="${u.avatar}" alt="${u.fullName}">` : '<div class="av-placeholder">?</div>';
  }
  if (conv.participants) {
    const avatars = conv.participants.slice(0, 2).map(uid => {
      const u = getUser(uid);
      return u ? `<img src="${u.avatar}" class="av-stack" alt="">` : '';
    }).join('');
    return `<div class="av-group">${avatars}</div>`;
  }
  const letter = (conv.bizName || conv.groupName || '?')[0].toUpperCase();
  const colors = { 'R':'#3b82f6','B':'#10b981','T':'#f59e0b','F':'#a78bfa','G':'#ef4444' };
  const color  = colors[letter] || '#64748b';
  return `<div class="av-placeholder" style="background:${color}20;color:${color}">${letter}</div>`;
}

function getLastMsg(conv) {
  const msgs = getConvMessages(conv.id);
  if (!msgs.length) return '';
  const last = msgs[msgs.length - 1];
  if (last.sys) return last.text;
  const prefix = last.from === MY_ID ? 'You: ' : '';
  return prefix + (last.text || '').slice(0, 50);
}

function getConvTypeBadge(conv) {
  const badges = {
    user:      '',
    business:  '<span class="conv-type-badge badge-blue">Business</span>',
    offer:     '<span class="conv-type-badge badge-gold">Offer</span>',
    event:     '<span class="conv-type-badge badge-green">Event</span>',
    group:     '<span class="conv-type-badge badge-purple">Group</span>',
    organizer: '<span class="conv-type-badge badge-red">Organizer</span>',
  };
  return badges[conv.type] || '';
}

// ======================== RENDER CONV LIST ========================
function renderConvList() {
  const el = document.getElementById('convList');
  if (!el) return;

  let convs = MOCK_CONVS.filter(c => {
    if (msgFilter === 'unread'   && !getUnread(c))                return false;
    if (msgFilter === 'business' && c.type !== 'business')        return false;
    if (msgFilter === 'events'   && !['event','organizer'].includes(c.type)) return false;
    if (msgFilter === 'groups'   && c.type !== 'group')           return false;
    if (msgFilter === 'offers'   && c.type !== 'offer')           return false;
    if (msgSearch) {
      const name = getConvName(c).toLowerCase();
      if (!name.includes(msgSearch.toLowerCase())) return false;
    }
    return true;
  });

  convs.sort((a, b) => {
    const aTime = getConvMessages(a.id).slice(-1)[0]?.ts || 0;
    const bTime = getConvMessages(b.id).slice(-1)[0]?.ts || 0;
    return bTime - aTime;
  });

  if (!convs.length) {
    el.innerHTML = '<div class="conv-empty"><i class="fas fa-inbox"></i><p>No conversations found</p></div>';
    return;
  }

  el.innerHTML = convs.map(conv => {
    const unread    = getUnread(conv);
    const isActive  = conv.id === activeConvId;
    const lastMsgs  = getConvMessages(conv.id);
    const lastTs    = lastMsgs[lastMsgs.length - 1]?.ts;
    return `
    <div class="conv-item ${isActive ? 'active' : ''} ${unread ? 'has-unread' : ''}" onclick="openConv('${conv.id}')">
      <div class="conv-av-wrap">
        ${getConvAvatar(conv)}
        ${conv.online ? '<span class="online-dot"></span>' : ''}
      </div>
      <div class="conv-info">
        <div class="conv-top-row">
          <span class="conv-name">${getConvName(conv)}</span>
          <span class="conv-time">${lastTs ? fmtTime(lastTs) : ''}</span>
        </div>
        <div class="conv-bottom-row">
          <span class="conv-preview">${getLastMsg(conv)}</span>
          ${unread ? `<span class="conv-unread">${unread}</span>` : ''}
        </div>
        ${getConvTypeBadge(conv)}
      </div>
    </div>`;
  }).join('');
}

// ======================== RENDER CHAT ========================
function renderChat(convId) {
  const conv = getConv(convId);
  if (!conv) return;

  const headerEl   = document.getElementById('chatHeader');
  const msgsEl     = document.getElementById('chatMessages');
  const repliesEl  = document.getElementById('quickRepliesBar');

  if (headerEl) {
    const name    = getConvName(conv);
    const subline = conv.online
      ? `<span class="header-online"><span class="online-dot-sm"></span> ${conv.lastActive}</span>`
      : `<span class="header-sub">${conv.lastActive}</span>`;
    headerEl.innerHTML = `
      <div class="chat-header-left">
        <button class="back-btn" onclick="showSidebar()"><i class="fas fa-arrow-left"></i></button>
        <div class="chat-header-av">${getConvAvatar(conv)}</div>
        <div class="chat-header-info">
          <div class="chat-header-name">${name}</div>
          ${subline}
        </div>
      </div>
      <div class="chat-header-actions">
        <button class="header-action-btn" title="Video call"><i class="fas fa-video"></i></button>
        <button class="header-action-btn" title="Voice call"><i class="fas fa-phone"></i></button>
        <button class="header-action-btn" title="Info" onclick="toggleInfoPanel()"><i class="fas fa-info-circle"></i></button>
      </div>`;
  }

  if (msgsEl) msgsEl.innerHTML = renderMessages(convId);

  if (repliesEl && conv.quickReplies?.length) {
    repliesEl.innerHTML = conv.quickReplies.map(r =>
      `<button class="quick-reply-chip" onclick="sendQuick('${r.replace(/'/g,"\\'")}')">` + r + '</button>'
    ).join('');
    repliesEl.style.display = 'flex';
  } else if (repliesEl) {
    repliesEl.style.display = 'none';
  }

  scrollChatBottom();
}

function renderMessages(convId) {
  const msgs = getConvMessages(convId);
  if (!msgs.length) return '<div class="chat-empty"><i class="fas fa-comment-dots"></i><p>No messages yet</p></div>';

  let html = '';
  let lastDate = null;
  let lastFrom = null;

  msgs.forEach((msg, i) => {
    const msgDate = new Date(msg.ts).toDateString();
    if (msgDate !== lastDate) {
      html += `<div class="msg-date-sep">${formatDateSep(msg.ts)}</div>`;
      lastDate = msgDate;
      lastFrom = null;
    }

    if (msg.sys) {
      html += `<div class="msg-system"><span>${msg.text}</span></div>`;
      lastFrom = null;
      return;
    }

    const isMe    = msg.from === MY_ID;
    const showAv  = !isMe && msg.from !== lastFrom;
    const fromUser = !isMe ? getUser(msg.from) : null;
    const av = fromUser
      ? `<img src="${fromUser.avatar}" alt="${fromUser.fullName}" class="msg-av">`
      : `<div class="msg-av msg-av-placeholder">${(msg.from || '?')[0].toUpperCase()}</div>`;

    html += `
      <div class="msg-row ${isMe ? 'sent' : 'received'} ${showAv ? 'show-av' : 'no-av'}">
        ${!isMe ? `<div class="msg-av-col">${showAv ? av : '<div class="msg-av-spacer"></div>'}</div>` : ''}
        <div class="msg-col">
          ${showAv && !isMe && fromUser ? `<div class="msg-sender-name">${fromUser.fullName.split(' ')[0]}</div>` : ''}
          <div class="msg-bubble-wrap" title="${fmtTimestamp(msg.ts)}">
            <div class="msg-bubble ${isMe ? 'bubble-sent' : 'bubble-recv'}">${escHtml(msg.text)}</div>
            <div class="msg-reactions" onclick="addReaction(event, '${msg.id}')"><i class="far fa-smile-beam"></i></div>
          </div>
          ${i === msgs.length - 1 ? `<div class="msg-ts">${fmtTimestamp(msg.ts)}</div>` : ''}
        </div>
        ${isMe ? '<div class="msg-av-col"></div>' : ''}
      </div>`;

    lastFrom = msg.from;
  });

  return html;
}

function formatDateSep(ts) {
  const d = new Date(ts);
  const today = new Date(); today.setHours(0,0,0,0);
  const yest  = new Date(today); yest.setDate(yest.getDate() - 1);
  if (d >= today) return 'Today';
  if (d >= yest)  return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function scrollChatBottom() {
  const el = document.getElementById('chatMessages');
  if (el) setTimeout(() => { el.scrollTop = el.scrollHeight; }, 50);
}

// ======================== RENDER INFO PANEL ========================
function renderInfoPanel(convId) {
  const conv = getConv(convId);
  const el   = document.getElementById('infoPanel');
  if (!conv || !el) return;

  const name   = getConvName(conv);
  const withUser = conv.withId ? getUser(conv.withId) : null;

  const avatarHtml = withUser
    ? `<img src="${withUser.avatar}" class="info-big-av">`
    : `<div class="info-big-av info-av-icon">${(name[0] || '?').toUpperCase()}</div>`;

  const statsHtml = withUser ? `
    <div class="info-stats">
      <div class="info-stat"><div class="info-stat-val">${withUser.explorerLevel || '—'}</div><div class="info-stat-lbl">Level</div></div>
      <div class="info-stat"><div class="info-stat-val">${(withUser.trustScore || 0)}</div><div class="info-stat-lbl">Trust</div></div>
      <div class="info-stat"><div class="info-stat-val">${(withUser.followers || 0) >= 1000 ? ((withUser.followers||0)/1000).toFixed(1)+'k' : withUser.followers||0}</div><div class="info-stat-lbl">Followers</div></div>
    </div>` : '';

  const placesHtml = (conv.sharedPlaces || []).length ? `
    <div class="info-section">
      <div class="info-section-lbl"><i class="fas fa-map-marker-alt"></i> Shared Places</div>
      ${conv.sharedPlaces.map(p => `<div class="info-chip">${p}</div>`).join('')}
    </div>` : '';

  const eventsHtml = (conv.sharedEvents || []).length ? `
    <div class="info-section">
      <div class="info-section-lbl"><i class="fas fa-calendar"></i> Shared Events</div>
      ${conv.sharedEvents.map(e => `<div class="info-chip ev-chip">${e}</div>`).join('')}
    </div>` : '';

  const typeBadgeMap = { user: '', business: 'Business', offer: 'Creator', event: 'Event Chat', group: 'Group', organizer: 'Organizer' };
  const typeBadge = typeBadgeMap[conv.type] || '';

  const actionsHtml = `
    <div class="info-actions">
      ${withUser ? `<a href="profile.html" class="info-action-btn"><i class="fas fa-user"></i> View Profile</a>` : ''}
      <button class="info-action-btn" onclick="showToast('Share Plan coming soon!')"><i class="fas fa-map"></i> Share Plan</button>
      <button class="info-action-btn" onclick="showToast('Event invite sent!')"><i class="fas fa-calendar-plus"></i> Invite to Event</button>
      ${conv.type === 'user' ? `<a href="creators.html" class="info-action-btn"><i class="fas fa-rocket"></i> Send Offer</a>` : ''}
    </div>`;

  const participantsHtml = conv.participants ? `
    <div class="info-section">
      <div class="info-section-lbl"><i class="fas fa-users"></i> Members (${conv.participants.length + 1})</div>
      <div class="info-members">
        ${[MY_ID, ...conv.participants].slice(0, 6).map(uid => {
          const u = getUser(uid);
          return u ? `<img src="${u.avatar}" title="${u.fullName}" class="member-av">` : '';
        }).join('')}
      </div>
    </div>` : '';

  el.innerHTML = `
    <div class="info-scroll">
      <div class="info-top">
        ${avatarHtml}
        <div class="info-name">${name}</div>
        ${typeBadge ? `<span class="info-type-badge">${typeBadge}</span>` : ''}
        ${withUser ? `<div class="info-handle">@${withUser.username || ''} · ${withUser.city || ''}</div>` : ''}
        ${conv.online ? '<div class="info-online-row"><span class="online-dot-sm"></span> Active now</div>' : `<div class="info-online-row" style="color:var(--text-muted)">${conv.lastActive}</div>`}
      </div>
      ${statsHtml}
      ${participantsHtml}
      ${placesHtml}
      ${eventsHtml}
      ${actionsHtml}
    </div>`;
}

// ======================== OPEN CONVERSATION ========================
function openConv(id) {
  activeConvId = id;
  window.safeStorage.set('gh_msg_active', id);
  readState[id] = true;
  window.safeStorage.set('gh_msg_read', readState);

  document.querySelectorAll('.conv-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`.conv-item[onclick*="${id}"]`)?.classList.add('active');

  renderChat(id);
  renderInfoPanel(id);
  renderConvList();

  const layout = document.querySelector('.messages-layout');
  if (layout) layout.classList.add('chat-open');
}

function showSidebar() {
  const layout = document.querySelector('.messages-layout');
  if (layout) layout.classList.remove('chat-open');
}

function toggleInfoPanel() {
  const ip = document.getElementById('infoPanel');
  if (ip) ip.classList.toggle('panel-visible');
}

// ======================== SEND MESSAGE ========================
function sendMsg() {
  const input = document.getElementById('msgInput');
  const text  = input?.value.trim();
  if (!text || !activeConvId) return;
  input.value = '';

  const msg = {
    id:   'u_' + Date.now(),
    from: MY_ID,
    text,
    ts:   Date.now(),
  };

  if (!extraMsgs[activeConvId]) extraMsgs[activeConvId] = [];
  extraMsgs[activeConvId].push(msg);
  window.safeStorage.set('gh_msg_extra', extraMsgs);

  const msgsEl = document.getElementById('chatMessages');
  if (msgsEl) {
    msgsEl.innerHTML = renderMessages(activeConvId);
    scrollChatBottom();
  }
  renderConvList();
  triggerAutoReply(activeConvId);
}

function sendQuick(text) {
  const input = document.getElementById('msgInput');
  if (input) input.value = text;
  sendMsg();
}

// ======================== AUTO REPLY ========================
function triggerAutoReply(convId) {
  const conv = getConv(convId);
  if (!conv || !conv.mockReplies?.length) return;
  if (typingTimer) clearTimeout(typingTimer);

  showTyping(true);
  typingTimer = setTimeout(() => {
    showTyping(false);
    const idx   = (replyIdx[convId] || 0) % conv.mockReplies.length;
    replyIdx[convId] = idx + 1;
    const replyText = conv.mockReplies[idx];
    const fromId    = conv.withId || conv.participants?.[0] || 'biz';
    const msg = { id: 'ar_' + Date.now(), from: fromId, text: replyText, ts: Date.now() };
    if (!extraMsgs[convId]) extraMsgs[convId] = [];
    extraMsgs[convId].push(msg);
    window.safeStorage.set('gh_msg_extra', extraMsgs);
    if (activeConvId === convId) {
      document.getElementById('chatMessages').innerHTML = renderMessages(convId);
      scrollChatBottom();
    }
    renderConvList();
  }, 1800 + Math.random() * 800);
}

function showTyping(show) {
  let ti = document.getElementById('typingIndicator');
  if (!ti) return;
  ti.style.display = show ? 'flex' : 'none';
}

// ======================== EMOJI PICKER ========================
const EMOJIS = ['😊','😂','❤️','🔥','👍','🙌','🎉','🥾','🏔️','🎵','🍕','🍷','🚗','✅','😍','🤝','🌊','🏖️','🎷','👏'];
let emojiOpen = false;

function toggleEmojiPicker() {
  let picker = document.getElementById('emojiPicker');
  if (!picker) return;
  emojiOpen = !emojiOpen;
  picker.style.display = emojiOpen ? 'flex' : 'none';
}

function insertEmoji(emoji) {
  const input = document.getElementById('msgInput');
  if (input) { input.value += emoji; input.focus(); }
  toggleEmojiPicker();
}

function addReaction(e, msgId) {
  e.stopPropagation();
  const btn = e.currentTarget;
  btn.innerHTML = '❤️';
  btn.style.opacity = '1';
  btn.style.pointerEvents = 'none';
}

// ======================== TOAST ========================
function showToast(msg) {
  let toast = document.getElementById('msgToast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

// ======================== FILTERS ========================
function setFilter(filter, el) {
  msgFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderConvList();
}

function searchConvs(q) {
  msgSearch = q;
  renderConvList();
}

// ======================== INIT ========================
document.addEventListener('DOMContentLoaded', () => {
  const isReal = window.GeoMode && window.GeoMode.isRealUser();

  if (!isReal) {
    renderConvList();
    openConv(activeConvId);

    const unreadTotal = MOCK_CONVS.reduce((s, c) => s + getUnread(c), 0);
    const badge = document.querySelector('.msg-nav-badge');
    if (badge && unreadTotal) { badge.textContent = unreadTotal; badge.style.display = 'inline-flex'; }

    const urlParams = new URLSearchParams(window.location.search);
    const userParam = urlParams.get('user');
    if (userParam) {
      const conv = MOCK_CONVS.find(c => c.withId === userParam || getUser(c.withId)?.username === userParam);
      if (conv) openConv(conv.id);
    }
  }

  const input = document.getElementById('msgInput');
  if (input) {
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } });
  }

  const emoji = document.getElementById('emojiPicker');
  if (emoji) {
    emoji.innerHTML = EMOJIS.map(e => `<button class="emoji-btn" onclick="insertEmoji('${e}')">${e}</button>`).join('');
  }

  document.addEventListener('click', e => {
    const picker = document.getElementById('emojiPicker');
    const emojiBtn = document.getElementById('emojiBtn');
    if (picker && emojiOpen && !picker.contains(e.target) && e.target !== emojiBtn) {
      emojiOpen = false;
      picker.style.display = 'none';
    }
  });
});
