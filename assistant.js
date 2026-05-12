const ASSISTANT_STORAGE_KEY = "geohub_assistant_plans";
const PROMPT_CHIPS = [
  "Plan a weekend foodie route",
  "Low budget city walk",
  "Boost XP with check-ins",
  "Hidden spots and chill cafes",
  "Relaxing self-care day",
];
const MOOD_OPTIONS = ["Balanced", "Energetic", "Relaxed", "Focused", "Luxury"];
const INTEREST_OPTIONS = [
  "cafes",
  "events",
  "hiking",
  "photography",
  "budget",
  "wellness",
  "food",
  "nightlife",
];
const BUDGET_SUGGESTIONS = [
  { max: 80, label: "Cozy café and local walk" },
  { max: 160, label: "Cafe hopping and gallery visit" },
  { max: 250, label: "Dinner + small adventure" },
  { max: 350, label: "Premium dining and experience" },
];

function getStoredPlans() {
  return window.safeStorage.get(ASSISTANT_STORAGE_KEY, []);
}

function saveStoredPlans(plans) {
  window.safeStorage.set(ASSISTANT_STORAGE_KEY, plans);
}

function formatBudgetSuggestion(value) {
  return (
    BUDGET_SUGGESTIONS.find((item) => value <= item.max)?.label ||
    "Premium lifestyle intro"
  );
}

function getPlaceholderUser(userId) {
  return (
        null
  );
}

function renderPromptChips() {
  const chipRow = document.getElementById("promptChips");
  chipRow.innerHTML = "";
  PROMPT_CHIPS.forEach((text) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "assistant-chip";
    button.textContent = text;
    button.addEventListener("click", () => {
      document.getElementById("assistantInput").value = text;
      document.getElementById("assistantInput").focus();
    });
    chipRow.appendChild(button);
  });
}

function renderSelectorChips(options, containerId, defaultActive = []) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  options.forEach((option) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className =
      "assistant-selector" + (defaultActive.includes(option) ? " active" : "");
    chip.textContent = option;
    chip.dataset.value = option;
    chip.addEventListener("click", () => {
      chip.classList.toggle("active");
    });
    container.appendChild(chip);
  });
}

function getSelectedChips(containerId) {
  return Array.from(
    document.querySelectorAll(`#${containerId} .assistant-selector.active`),
  ).map((el) => el.dataset.value);
}

function setBudgetDisplay(value) {
  document.getElementById("budgetDisplay").textContent = `${value} GEL`;
  document.getElementById("budgetSuggestion").textContent =
    formatBudgetSuggestion(value);
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "gh-toast show";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1800);
}

function renderUserDropdown() {
  const select = document.getElementById("userSelect");
  select.innerHTML = "";
  const users = []; // production data comes from Firebase user profile
  users.forEach((user) => {
    const option = document.createElement("option");
    option.value = user.id;
    option.textContent = `${user.fullName} · ${user.city} · ${user.explorerLevel}`;
    select.appendChild(option);
  });
  if (users.length) select.value = users[0].id;
}

function updateSelectedUserBox(user) {
  const box = document.getElementById("selectedUserBox");
  if (!user) {
    box.textContent = "No explorer selected.";
    return;
  }
  box.innerHTML = `<strong>${user.fullName}</strong> · ${user.bio} <br><span class="assistant-note">Interests: ${user.interests.join(", ")} · XP ${user.xp} · Rank ${user.rank}</span>`;
}

function buildRecommendationCards(user) {
  const cards = document.getElementById("recommendationCards");
  cards.innerHTML = "";
  if (!user) return;
  const interestSets = {
    cafes: ["Fabrika Café", "Coffee Gallery", "Khevsureti Espresso"],
    events: ["Fabrika Night Market", "Open Air Concert", "Weekend Workshop"],
    hiking: ["Juta Trail", "Matsminda Loop", "Tbilisi Waterfall"],
    photography: ["Sololaki Courtyard", "Bridge of Peace", "Old Town Frame"],
    budget: ["Student Cafe", "Free City Walk", "Economy Market"],
    wellness: ["River Yoga", "Spa Escape", "Wellness Brunch"],
    food: ["Khinkali House", "Wine & Dine", "Street Food Alley"],
    nightlife: ["Bassline", "Moon Club", "Late Night Market"],
  };
  const shown = new Set();
  user.interests.slice(0, 3).forEach((interest) => {
    const list = interestSets[interest] || [];
    list.slice(0, 2).forEach((place) => shown.add(place));
  });
  if (!shown.size) {
    shown.add("GeoHub curated local route");
    shown.add("Personalized XP challenge");
  }
  Array.from(shown)
    .slice(0, 4)
    .forEach((item) => {
      const card = document.createElement("div");
      card.className = "assistant-recommendation-card";
      card.innerHTML = `<strong>${item}</strong><br><small>Because ${user.fullName} loves ${user.interests[0] || "local discovery"}.</small>`;
      cards.appendChild(card);
    });
}

function buildXpPanel(user) {
  const xpPanel = document.getElementById("xpPanel");
  xpPanel.innerHTML = "";
  if (!user) return;
  const nextGoal =
    user.xp >= 12000
      ? "Maintain Platinum streak"
      : `Reach ${Math.ceil(user.xp / 500) * 500 + 500} XP`;
  xpPanel.innerHTML = `
    <div class="metric"><span>Current XP</span><strong>${user.xp}</strong></div>
    <div class="metric"><span>Level</span><strong>${user.explorerLevel}</strong></div>
    <div class="metric"><span>Next target</span><strong>${nextGoal}</strong></div>
  `;
  document.getElementById("xpHint").textContent =
    `Recommended actions based on ${user.fullName}'s current explorer state.`;
}

function renderSavedPlans() {
  const container = document.getElementById("savedPlans");
  const plans = getStoredPlans();
  container.innerHTML = "";
  if (!plans.length) {
    container.innerHTML =
      '<p class="assistant-note">No saved plans yet. Generate one and save it.</p>';
    return;
  }
  plans.slice(0, 6).forEach((plan) => {
    const card = document.createElement("div");
    card.className = "assistant-plan-card";
    card.innerHTML = `
      <header>
        <div>
          <h4>${plan.title}</h4>
          <p>${plan.mood} · ${plan.interests.join(", ")}</p>
        </div>
        <div>
          <button type="button" class="btn btn-ghost-nav" data-action="load" data-id="${plan.id}">Load</button>
          <button type="button" class="btn btn-ghost-nav" data-action="delete" data-id="${plan.id}">Delete</button>
        </div>
      </header>
      <p>${plan.generated.substring(0, 120)}...</p>
    `;
    container.appendChild(card);
  });
}

function loadPlan(id) {
  const plans = getStoredPlans();
  const plan = plans.find((item) => item.id === id);
  if (!plan) return;
  document.getElementById("assistantInput").value = plan.title;
  document.getElementById("budgetRange").value = plan.budget;
  setBudgetDisplay(plan.budget);
  document.getElementById("assistantMessages").innerHTML = "";
  addAssistantMessage(
    "assistant",
    `Loaded saved plan for ${plan.title}. Use Generate plan to refresh or adjust.`,
  );
  showToast("Saved plan loaded");
}

function deletePlan(id) {
  const plans = getStoredPlans().filter((item) => item.id !== id);
  saveStoredPlans(plans);
  renderSavedPlans();
  showToast("Saved plan removed");
}

function addAssistantMessage(role, content) {
  const container = document.getElementById("assistantMessages");
  const message = document.createElement("div");
  message.className = `assistant-message ${role}`;
  message.innerHTML = `<div>${content}</div><small>${role === "user" ? "You" : "GeoHub Assistant"}</small>`;
  container.appendChild(message);
  container.scrollTop = container.scrollHeight;
}

function generatePlan() {
  const userSelect = document.getElementById("userSelect");
  const user = getPlaceholderUser(userSelect.value);
  const prompt =
    document.getElementById("assistantInput").value.trim() ||
    "Create an optimized GeoHub lifestyle plan.";
  const mood = getSelectedChips("moodChips")[0] || "Balanced";
  const interests = getSelectedChips("interestChips");
  const budget = Number(document.getElementById("budgetRange").value);
  const userLabel = user ? user.fullName : "Explorer";

  addAssistantMessage("user", prompt);

  const generated = `Hi ${userLabel}! Based on ${prompt.toLowerCase()}, the assistant suggests a ${mood.toLowerCase()} plan with ${interests.length ? interests.join(", ") : "local activities"}. Your budget of ${budget} GEL will cover a ${formatBudgetSuggestion(budget)}. Start with a welcome check-in, then boost XP by completing a challenge and visiting a high-value spot tied to your interests.`;
  addAssistantMessage("assistant", generated);
  showToast("Plan generated");
}

function saveCurrentPlan() {
  const input = document.getElementById("assistantInput").value.trim();
  const userSelect = document.getElementById("userSelect");
  const user = getPlaceholderUser(userSelect.value);
  const mood = getSelectedChips("moodChips")[0] || "Balanced";
  const interests = getSelectedChips("interestChips");
  const budget = Number(document.getElementById("budgetRange").value);
  const lastMessage = Array.from(
    document.querySelectorAll(".assistant-message.assistant"),
  ).pop();
  const generated = lastMessage
    ? lastMessage.textContent.replace("GeoHub Assistant", "").trim()
    : "";

  if (!generated) {
    showToast("Generate a plan first");
    return;
  }
  const plans = getStoredPlans();
  plans.unshift({
    id: Date.now(),
    title: input || "GeoHub Lifestyle Plan",
    mood,
    interests,
    budget,
    generated,
    savedAt: new Date().toISOString(),
  });
  saveStoredPlans(plans);
  renderSavedPlans();
  showToast("Plan saved");
}

function handleUserChanged() {
  const userSelect = document.getElementById("userSelect");
  const user = getPlaceholderUser(userSelect.value);
  updateSelectedUserBox(user);
  buildRecommendationCards(user);
  buildXpPanel(user);
}

function handleSavedPlansClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const id = Number(button.dataset.id);
  if (button.dataset.action === "load") loadPlan(id);
  if (button.dataset.action === "delete") deletePlan(id);
}

function initAssistantUI() {
  if (!document.querySelector(".assistant-page")) return;
  renderPromptChips();
  renderSelectorChips(MOOD_OPTIONS, "moodChips", ["Balanced"]);
  renderSelectorChips(INTEREST_OPTIONS, "interestChips", ["cafes", "food"]);
  renderUserDropdown();
  setBudgetDisplay(Number(document.getElementById("budgetRange").value));
  renderSavedPlans();
  handleUserChanged();

  document
    .getElementById("assistantSend")
    .addEventListener("click", generatePlan);
  document
    .getElementById("savePlanBtn")
    .addEventListener("click", saveCurrentPlan);
  document.getElementById("budgetRange").addEventListener("input", (event) => {
    setBudgetDisplay(Number(event.target.value));
  });
  document
    .getElementById("userSelect")
    .addEventListener("change", handleUserChanged);
  document
    .getElementById("savedPlans")
    .addEventListener("click", handleSavedPlansClick);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAssistantUI);
} else {
  initAssistantUI();
}
