const LIVE_EVENT_TYPES = [
  { type: "Concert", icon: "music" },
  { type: "Meetup", icon: "users" },
  { type: "Workshop", icon: "lightbulb" },
  { type: "Nightlife", icon: "cocktail" },
  { type: "Hiking", icon: "mountain" },
  { type: "Pop-up", icon: "sparkles" },
];
const LIVE_PLACES = [];
const LIVE_STORIES = [];
const LIVE_GROUPS = [];
const LIVE_NOTIFICATIONS = [];
const LIVE_MAP_PINS = [];
const LIVE_SUGGESTIONS = [];

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "gh-toast show";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1800);
}

function formatAgo(minutes) {
  return minutes === 0 ? "just now" : `${minutes} min ago`;
}

function getPhase() {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  if (day === 0 || day === 6) return "Weekend";
  if (hour >= 22 || hour < 4) return "Late Night";
  if (hour >= 18) return "Evening";
  if (hour >= 9) return "Morning";
  return "Early Hours";
}

function getPhaseStyles() {
  const phase = getPhase();
  if (phase === "Weekend")
    return { label: "Weekend", copy: "Outdoor and hiking pulse is high." };
  if (phase === "Late Night")
    return {
      label: "Late Night",
      copy: "Bars, live music and night markets are active.",
    };
  if (phase === "Evening")
    return {
      label: "Evening",
      copy: "Nightlife, meetups and reward hunts are trending.",
    };
  return {
    label: "Morning",
    copy: "Cafés, work sessions and study spots are busy.",
  };
}

function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function buildLiveFeedEntry() {
  const place = pickRandom(LIVE_PLACES);
  const user = pickRandom(window.MOCK_USERS || []);
  const actions = [
    `${randomBetween(7, 16)} people checked into ${place.name} in the last 10 minutes`,
    `${place.name} reward almost sold out`,
    `${randomBetween(3, 8)} friends joined ${place.name} group`,
    `${place.name} is trending tonight`,
    `Sunset gathering active at ${place.name}`,
  ];
  return {
    title: pickRandom(actions),
    subtitle: `${user ? user.fullName : place.name} · ${place.tag} · ${formatAgo(randomBetween(1, 12))}`,
    badge: place.status === "red" ? "HOT" : "LIVE",
    color: place.status,
  };
}

function renderLiveFeed() {
  const feed = document.getElementById("liveFeed");
  if (!feed) return;
  const items = Array.from({ length: 5 }, buildLiveFeedEntry);
  feed.innerHTML = items
    .map(
      (item) => `
    <div class="live-feed-card">
      <div class="live-card-title">
        <strong>${item.title}</strong>
        <span class="live-badge" style="background: rgba(255,255,255,0.08);color:${item.color === "red" ? "#f87171" : item.color === "gold" ? "#fbbf24" : item.color === "purple" ? "#c084fc" : item.color === "green" ? "#34d399" : "#60a5fa"}">${item.badge}</span>
      </div>
      <small>${item.subtitle}</small>
    </div>
  `,
    )
    .join("");
}

function renderMap() {
  const map = document.getElementById("liveMap");
  if (!map) return;
  map.innerHTML = `
    <div class="live-map-overlay" id="mapOverlay"></div>
  `;
  const overlay = document.getElementById("mapOverlay");
  LIVE_MAP_PINS.forEach((pin, index) => {
    const el = document.createElement("div");
    el.className = `live-pin ${pin.status}`;
    el.style.left = pin.left;
    el.style.top = pin.top;
    el.dataset.index = index;
    el.title = pin.title;
    el.addEventListener("click", () => updateMapOverlay(pin));
    map.appendChild(el);
  });
  updateMapOverlay(LIVE_MAP_PINS[0]);
}

function updateMapOverlay(pin) {
  const overlay = document.getElementById("mapOverlay");
  if (!overlay) return;
  overlay.innerHTML = `
    <div class="live-map-card">
      <strong>${pin.title}</strong>
      <span>${pin.desc}</span>
    </div>
  `;
}

function renderTrendingNow() {
  const container = document.getElementById("trendingNow");
  if (!container) return;
  const items = [
    {
      title: "Rooms Kazbegi is trending",
      detail: "50 attendees",
      status: "purple",
    },
    {
      title: "Jazz Night starts soon",
      detail: "18 min to start",
      status: "gold",
    },
    {
      title: "Live feed spike at Fabrika",
      detail: "+12 check-ins",
      status: "red",
    },
  ];
  container.innerHTML = items
    .map(
      (item) => `
    <div class="live-event-card">
      <div class="live-card-title"><strong>${item.title}</strong><span class="status-dot" style="background:${item.status === "purple" ? "#c084fc" : item.status === "gold" ? "#fbbf24" : "#ef4444"}"></span></div>
      <div class="live-card-details"><span>${item.detail}</span></div>
    </div>
  `,
    )
    .join("");
}

function renderBusyPlaces() {
  const container = document.getElementById("busyPlaces");
  if (!container) return;
  container.innerHTML = LIVE_PLACES.map(
    (place) => `
    <div class="live-place-card">
      <div class="live-card-title"><strong>${place.name}</strong><span class="status-dot" style="background:${place.status === "red" ? "#ef4444" : place.status === "gold" ? "#fbbf24" : place.status === "purple" ? "#c084fc" : place.status === "green" ? "#34d399" : "#60a5fa"}"></span></div>
      <div class="live-card-details"><span>${place.tag}</span><span>${randomBetween(12, 62)} people active</span></div>
    </div>
  `,
  ).join("");
}

function renderStories() {
  const container = document.getElementById("liveStories");
  if (!container) return;
  container.innerHTML = LIVE_STORIES.map(
    (story) => `
    <div class="live-story">
      <h4>${story.title}</h4>
      <span class="live-badge" style="background: rgba(59,130,246,0.12);color:#60a5fa">${story.badge}</span>
      <small>${story.people} viewers · ${story.location}</small>
    </div>
  `,
  ).join("");
}

function renderEventsRadar() {
  const container = document.getElementById("eventRadar");
  if (!container) return;
  const items = Array.from({ length: 4 }, () => {
    const event = pickRandom(LIVE_EVENT_TYPES);
    const place = pickRandom(LIVE_PLACES);
    return {
      title: `${event.type} at ${place.name}`,
      subtitle: `${randomBetween(20, 60)} participants · ${randomBetween(1, 4)} friends nearby`,
      xp: randomBetween(20, 90),
      rewards: randomBetween(1, 3),
      icon: event.icon,
      status: place.status,
    };
  });
  container.innerHTML = items
    .map(
      (item) => `
    <div class="live-event-card">
      <div class="live-card-title"><strong>${item.title}</strong><span class="status-dot" style="background:${item.status === "red" ? "#ef4444" : item.status === "gold" ? "#fbbf24" : item.status === "purple" ? "#c084fc" : item.status === "green" ? "#34d399" : "#60a5fa"}"></span></div>
      <div class="live-card-details">
        <span><i class="fas fa-${item.icon}"></i> ${item.subtitle}</span>
        <span>+${item.xp} XP</span>
        <span>${item.rewards} rewards</span>
      </div>
      <button type="button" class="live-card-button" data-join>Join Live</button>
    </div>
  `,
    )
    .join("");
}

function renderGroups() {
  const container = document.getElementById("groupDiscovery");
  if (!container) return;
  container.innerHTML = LIVE_GROUPS.map(
    (group) => `
    <div class="live-group-card">
      <div class="live-card-title"><strong>${group.name}</strong><span class="status-dot" style="background:${group.status === "red" ? "#ef4444" : group.status === "gold" ? "#fbbf24" : group.status === "purple" ? "#c084fc" : group.status === "green" ? "#34d399" : "#60a5fa"}"></span></div>
      <div class="live-group-meta">
        <span><i class="fas fa-user-friends"></i> ${group.people} people</span>
        <span><i class="fas fa-heart"></i> ${group.interest}</span>
        <span>Live now</span>
      </div>
      <button type="button" class="live-card-button" data-join>Join Group</button>
    </div>
  `,
  ).join("");
}

function renderNotifications() {
  const container = document.getElementById("liveNotifications");
  if (!container) return;
  const items = LIVE_NOTIFICATIONS.map(
    (note) => `
    <div class="live-notification-item">
      <strong><i class="fas fa-${note.icon}"></i> ${note.text}</strong>
    </div>
  `,
  ).join("");
  container.innerHTML = items;
}

function renderSuggestions() {
  const container = document.getElementById("liveSuggestions");
  if (!container) return;
  const phase = getPhase();
  const suggestions = LIVE_SUGGESTIONS.map((text) => ({
    text,
    score: randomBetween(70, 99),
  }));
  container.innerHTML = suggestions
    .slice(0, 4)
    .map(
      (item) => `
    <div class="live-suggest-card">
      <div class="live-card-title"><strong>${item.text}</strong><span>${phase}</span></div>
      <div class="live-card-details"><span><i class="fas fa-chart-line"></i> ${item.score}% relevance</span></div>
    </div>
  `,
    )
    .join("");
}

function updateStats() {
  const phase = getPhase();
  const counts = {
    Morning: { pulse: 16, events: 4, groups: 10, notifs: 4 },
    Evening: { pulse: 23, events: 7, groups: 14, notifs: 6 },
    "Late Night": { pulse: 19, events: 8, groups: 11, notifs: 7 },
    Weekend: { pulse: 28, events: 9, groups: 18, notifs: 8 },
    "Early Hours": { pulse: 10, events: 2, groups: 6, notifs: 3 },
  };
  const current = counts[phase] || counts["Morning"];
  document.getElementById("livePulseCount").textContent = current.pulse;
  document.getElementById("liveEventCount").textContent = current.events;
  document.getElementById("liveGroupCount").textContent = current.groups;
  document.getElementById("liveNotifCount").textContent = current.notifs;
  const phaseLabel = getPhaseStyles();
  const labelEl = document.getElementById("livePhaseLabel");
  if (labelEl) labelEl.textContent = phaseLabel.label;
}

function refreshLivePage() {
  renderLiveFeed();
  renderTrendingNow();
  renderBusyPlaces();
  renderStories();
  renderEventsRadar();
  renderGroups();
  renderNotifications();
  renderSuggestions();
  updateStats();
}

function handleLiveClicks(event) {
  const button = event.target.closest("[data-join]");
  if (!button) return;
  const message = button.textContent.includes("Group")
    ? "Joined the live group."
    : "Joined the live event.";
  showToast(message);
}

function initLivePage() {
  if (!document.querySelector(".live-page")) return;
  renderMap();
  refreshLivePage();
  document
    .getElementById("liveFeed")
    ?.addEventListener("click", handleLiveClicks);
  document
    .getElementById("eventRadar")
    ?.addEventListener("click", handleLiveClicks);
  document
    .getElementById("groupDiscovery")
    ?.addEventListener("click", handleLiveClicks);

  setInterval(() => {
    refreshLivePage();
  }, 10000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLivePage);
} else {
  initLivePage();
}
