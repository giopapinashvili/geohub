/* ================================================================
   GeoHub — Shared JavaScript (navbar, utilities, components)
   ================================================================
   BACKEND PREP: Direct localStorage calls in this file should
   eventually be replaced with GeoAPI.* calls from api-client.js.
   Storage key constants are now centralised in GeoConfig.STORAGE_KEYS
   (config.js). See backend-roadmap.md for migration milestones.
   ================================================================ */

// ======================== NAVBAR ========================
(function initNavbar() {
  const navbar = document.querySelector(".navbar");
  const hamburger = document.querySelector(".hamburger");
  const mobileMenu = document.querySelector(".mobile-menu");

  if (navbar) {
    window.addEventListener("scroll", () => {
      navbar.classList.toggle("scrolled", window.scrollY > 20);
    });

    const desktopNav = navbar.querySelector(".navbar-links");
    const mobileNav = document.querySelector(".mobile-menu");
    const createLink = (href, label) => {
      const link = document.createElement("a");
      link.href = href;
      link.textContent = label;
      return link;
    };

    if (desktopNav && !desktopNav.querySelector('a[href="events.html"]')) {
      const item = document.createElement("li");
      const a = createLink("events.html", "Events");
      if (window.location.pathname.endsWith("events.html")) a.classList.add("active");
      item.appendChild(a);
      const creatorsEl = desktopNav.querySelector('a[href="creators.html"]')?.parentElement;
      const dashEl = desktopNav.querySelector('a[href="dashboard.html"]')?.parentElement;
      desktopNav.insertBefore(item, creatorsEl || dashEl || null);
    }

    if (mobileMenu && !mobileMenu.querySelector('a[href="events.html"]')) {
      const evLink = createLink("events.html", "Events");
      if (window.location.pathname.endsWith("events.html")) evLink.classList.add("active");
      const creatorsEl = mobileMenu.querySelector('a[href="creators.html"]');
      const dashEl = mobileMenu.querySelector('a[href="dashboard.html"]');
      mobileMenu.insertBefore(evLink, creatorsEl || dashEl || null);
    }

    if (desktopNav && !desktopNav.querySelector('a[href="live.html"]')) {
      const item = document.createElement("li");
      item.appendChild(createLink("live.html", "Live"));
      const dashboardLink = desktopNav.querySelector(
        'a[href="dashboard.html"]',
      )?.parentElement;
      desktopNav.insertBefore(item, dashboardLink || null);
    }

    if (desktopNav && !desktopNav.querySelector('a[href="assistant.html"]')) {
      const item = document.createElement("li");
      item.appendChild(createLink("assistant.html", "Assistant"));
      const dashboardLink = desktopNav.querySelector(
        'a[href="dashboard.html"]',
      )?.parentElement;
      desktopNav.insertBefore(item, dashboardLink || null);
    }

    if (mobileNav && !mobileNav.querySelector('a[href="live.html"]')) {
      const liveLink = createLink("live.html", "Live");
      const dashboardLink = mobileNav.querySelector('a[href="dashboard.html"]');
      mobileNav.insertBefore(liveLink, dashboardLink || null);
    }

    if (mobileNav && !mobileNav.querySelector('a[href="assistant.html"]')) {
      const assistantLink = createLink("assistant.html", "Assistant");
      const dashboardLink = mobileNav.querySelector('a[href="dashboard.html"]');
      mobileNav.insertBefore(assistantLink, dashboardLink || null);
    }

    if (desktopNav && !desktopNav.querySelector('a[href="trust.html"]')) {
      const item = document.createElement("li");
      const a = createLink("trust.html", "Trust");
      if (window.location.pathname.endsWith("trust.html")) a.classList.add("active");
      item.appendChild(a);
      const creatorsEl = desktopNav.querySelector('a[href="creators.html"]')?.parentElement;
      const dashEl = desktopNav.querySelector('a[href="dashboard.html"]')?.parentElement;
      desktopNav.insertBefore(item, creatorsEl || dashEl || null);
    }

    if (mobileNav && !mobileNav.querySelector('a[href="trust.html"]')) {
      const trustLink = createLink("trust.html", "Trust");
      if (window.location.pathname.endsWith("trust.html")) trustLink.classList.add("active");
      const creatorsEl = mobileNav.querySelector('a[href="creators.html"]');
      const dashEl = mobileNav.querySelector('a[href="dashboard.html"]');
      mobileNav.insertBefore(trustLink, creatorsEl || dashEl || null);
    }

    if (desktopNav && !desktopNav.querySelector('a[href="real-estate.html"]')) {
      const item = document.createElement("li");
      const a = createLink("real-estate.html", "Real Estate");
      if (window.location.pathname.endsWith("real-estate.html")) a.classList.add("active");
      item.appendChild(a);
      const dashEl = desktopNav.querySelector('a[href="dashboard.html"]')?.parentElement;
      desktopNav.insertBefore(item, dashEl || null);
    }

    if (mobileNav && !mobileNav.querySelector('a[href="real-estate.html"]')) {
      const reLink = createLink("real-estate.html", "Real Estate");
      if (window.location.pathname.endsWith("real-estate.html")) reLink.classList.add("active");
      const dashEl = mobileNav.querySelector('a[href="dashboard.html"]');
      mobileNav.insertBefore(reLink, dashEl || null);
    }

    if (desktopNav && !desktopNav.querySelector('a[href="services.html"]')) {
      const item = document.createElement("li");
      const a = createLink("services.html", "Services");
      if (window.location.pathname.endsWith("services.html")) a.classList.add("active");
      item.appendChild(a);
      const dashEl = desktopNav.querySelector('a[href="dashboard.html"]')?.parentElement;
      desktopNav.insertBefore(item, dashEl || null);
    }

    if (mobileNav && !mobileNav.querySelector('a[href="services.html"]')) {
      const svLink = createLink("services.html", "Services");
      if (window.location.pathname.endsWith("services.html")) svLink.classList.add("active");
      const dashEl = mobileNav.querySelector('a[href="dashboard.html"]');
      mobileNav.insertBefore(svLink, dashEl || null);
    }

    if (desktopNav && !desktopNav.querySelector('a[href="learning.html"]')) {
      const item = document.createElement("li");
      const a = createLink("learning.html", "Learning");
      if (window.location.pathname.endsWith("learning.html")) a.classList.add("active");
      item.appendChild(a);
      const dashEl = desktopNav.querySelector('a[href="dashboard.html"]')?.parentElement;
      desktopNav.insertBefore(item, dashEl || null);
    }

    if (mobileNav && !mobileNav.querySelector('a[href="learning.html"]')) {
      const lrLink = createLink("learning.html", "Learning");
      if (window.location.pathname.endsWith("learning.html")) lrLink.classList.add("active");
      const dashEl = mobileNav.querySelector('a[href="dashboard.html"]');
      mobileNav.insertBefore(lrLink, dashEl || null);
    }

    if (desktopNav && !desktopNav.querySelector('a[href="messages.html"]')) {
      const item = document.createElement("li");
      const a = createLink("messages.html", "Messages");
      if (window.location.pathname.endsWith("messages.html")) a.classList.add("active");
      item.appendChild(a);
      const creatorsEl = desktopNav.querySelector('a[href="creators.html"]')?.parentElement;
      const dashEl = desktopNav.querySelector('a[href="dashboard.html"]')?.parentElement;
      desktopNav.insertBefore(item, creatorsEl || dashEl || null);
    }

    if (mobileNav && !mobileNav.querySelector('a[href="messages.html"]')) {
      const msgLink = createLink("messages.html", "Messages");
      if (window.location.pathname.endsWith("messages.html")) msgLink.classList.add("active");
      const creatorsEl = mobileNav.querySelector('a[href="creators.html"]');
      const dashEl = mobileNav.querySelector('a[href="dashboard.html"]');
      mobileNav.insertBefore(msgLink, creatorsEl || dashEl || null);
    }

    if (desktopNav && !desktopNav.querySelector('a[href="groups.html"]')) {
      const item = document.createElement("li");
      const a = createLink("groups.html", "Groups");
      if (window.location.pathname.endsWith("groups.html")) a.classList.add("active");
      item.appendChild(a);
      const dashEl = desktopNav.querySelector('a[href="dashboard.html"]')?.parentElement;
      desktopNav.insertBefore(item, dashEl || null);
    }

    if (mobileNav && !mobileNav.querySelector('a[href="groups.html"]')) {
      const grLink = createLink("groups.html", "Groups");
      if (window.location.pathname.endsWith("groups.html")) grLink.classList.add("active");
      const dashEl = mobileNav.querySelector('a[href="dashboard.html"]');
      mobileNav.insertBefore(grLink, dashEl || null);
    }

    if (desktopNav && !desktopNav.querySelector('a[href="demo.html"]')) {
      const item = document.createElement("li");
      const a = createLink("demo.html", "Demo");
      if (window.location.pathname.endsWith("demo.html")) a.classList.add("active");
      item.appendChild(a);
      desktopNav.appendChild(item);
    }

    if (mobileNav && !mobileNav.querySelector('a[href="demo.html"]')) {
      const demoLink = createLink("demo.html", "Demo");
      if (window.location.pathname.endsWith("demo.html")) demoLink.classList.add("active");
      mobileNav.appendChild(demoLink);
    }

    // Search icon button in navbar
    if (navbar && !navbar.querySelector('.geo-search-btn')) {
      const srBtn = document.createElement('button');
      srBtn.className = 'geo-search-btn';
      srBtn.setAttribute('aria-label', 'Search');
      srBtn.setAttribute('title', 'Search GeoHub (⌘K)');
      srBtn.innerHTML = '<i class="fas fa-search"></i>';
      srBtn.style.cssText = 'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.6);border-radius:9999px;padding:6px 12px 6px 10px;display:inline-flex;align-items:center;gap:6px;font-size:0.8rem;cursor:pointer;transition:all 0.2s;margin-right:8px;font-family:inherit';
      srBtn.innerHTML += '<span style="font-size:0.72rem;font-weight:600">Search</span><kbd style="font-size:0.55rem;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);border-radius:3px;padding:1px 4px;color:rgba(255,255,255,0.4)">⌘K</kbd>';
      srBtn.addEventListener('mouseover', function () { this.style.borderColor = 'rgba(16,185,129,0.4)'; this.style.color = '#10b981'; });
      srBtn.addEventListener('mouseout',  function () { this.style.borderColor = 'rgba(255,255,255,0.1)'; this.style.color = 'rgba(255,255,255,0.6)'; });
      srBtn.addEventListener('click', function () { if (typeof openCmdPalette === 'function') openCmdPalette(); else location.href = 'search.html'; });
      const navActions = navbar.querySelector('.navbar-actions') || navbar.querySelector('.navbar-cta') || navbar;
      navActions.insertBefore(srBtn, navActions.firstChild);
    }
  }

  if (hamburger && mobileMenu) {
    hamburger.addEventListener("click", () => {
      mobileMenu.classList.toggle("open");
      const spans = hamburger.querySelectorAll("span");
      spans[0].style.transform = mobileMenu.classList.contains("open")
        ? "rotate(45deg) translate(5px, 5px)"
        : "";
      spans[1].style.opacity = mobileMenu.classList.contains("open")
        ? "0"
        : "1";
      spans[2].style.transform = mobileMenu.classList.contains("open")
        ? "rotate(-45deg) translate(5px, -5px)"
        : "";
    });
    document.addEventListener("click", (e) => {
      if (!navbar.contains(e.target) && !mobileMenu.contains(e.target)) {
        mobileMenu.classList.remove("open");
      }
    });
  }

  // Set active nav link
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  document
    .querySelectorAll(".navbar-links a, .mobile-menu a")
    .forEach((link) => {
      if (link.getAttribute("href") === currentPage)
        link.classList.add("active");
    });
})();

// ======================== UTILITIES ========================
function renderStars(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return `
    <div class="stars">
      ${'<i class="fas fa-star"></i>'.repeat(full)}
      ${half ? '<i class="fas fa-star-half-alt"></i>' : ""}
      ${'<i class="far fa-star empty"></i>'.repeat(empty)}
    </div>`;
}

function getCategoryBadgeClass(category) {
  const map = {
    tours: "green",
    hotels: "blue",
    restaurants: "gold",
    cafes: "gold",
    guesthouses: "green",
    attractions: "blue",
    hiking: "green",
    camping: "green",
    guides: "blue",
    "4x4": "gray",
    beauty: "red",
    dental: "blue",
  };
  return "badge-" + (map[category] || "gray");
}

function formatNumber(num) {
  if (num >= 1000) return (num / 1000).toFixed(num >= 10000 ? 0 : 1) + "k";
  return num.toString();
}

function animateCounter(el, target, duration = 1500) {
  let start = 0;
  const step = target / (duration / 16);
  const timer = setInterval(() => {
    start += step;
    if (start >= target) {
      start = target;
      clearInterval(timer);
    }
    el.textContent = formatNumber(Math.floor(start));
  }, 16);
}

function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ======================== CARD RENDERING ========================
function renderListingCard(biz, size = "md") {
  const sizeClass = size === "sm" ? "" : "";
  return `
    <a href="business.html?id=${biz.id}" class="listing-card animate-fade-up">
      <div class="listing-card-image">
        <img src="${biz.image}" alt="${biz.name}" loading="lazy" onerror="this.style.background='#172030';this.style.display='block'">
        <div class="listing-card-badge">
          <span class="badge ${getCategoryBadgeClass(biz.category)}">${biz.categoryLabel}</span>
        </div>
        ${biz.featured ? '<div class="listing-card-featured"><span class="badge badge-gold"><i class="fas fa-star"></i> Featured</span></div>' : ""}
        <div class="listing-card-wishlist"><i class="far fa-heart"></i></div>
      </div>
      <div class="listing-card-content">
        <div class="listing-card-header">
          <div class="listing-card-name">${biz.name}</div>
          ${biz.verified ? '<span class="badge badge-verified"><i class="fas fa-check-circle"></i> Verified</span>' : ""}
        </div>
        <div class="listing-card-location">
          <i class="fas fa-map-marker-alt"></i>
          <span>${biz.city}, Georgia</span>
        </div>
        <div class="rating-display">
          ${renderStars(biz.rating)}
          <span class="score">${biz.rating}</span>
          <span class="count">(${formatNumber(biz.reviewCount)})</span>
        </div>
        <div class="listing-card-footer">
          <div class="listing-card-price">
            <span class="from">From</span>
            <span class="amount">${biz.priceFrom} ${biz.currency}</span>
          </div>
          <span class="badge badge-gray">${biz.price}</span>
        </div>
      </div>
    </a>`;
}

// ======================== ANIMATE ON SCROLL ========================
function initScrollAnimations() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = "1";
          entry.target.style.transform = "translateY(0)";
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
  );

  document.querySelectorAll(".animate-fade-up").forEach((el, i) => {
    el.style.opacity = "0";
    el.style.transform = "translateY(24px)";
    el.style.transition = `opacity 0.5s ease ${i * 0.07}s, transform 0.5s ease ${i * 0.07}s`;
    observer.observe(el);
  });
}

// ======================== SAFE STORAGE ========================
const safeStorage = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch(e) { return fallback; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch(e) {}
  },
};
window.safeStorage = safeStorage;

// ======================== WISHLIST ========================
let wishlist = safeStorage.get("geohub_wishlist", []);

function toggleWishlist(id) {
  const idx = wishlist.indexOf(id);
  if (idx === -1) { wishlist.push(id); } else { wishlist.splice(idx, 1); }
  safeStorage.set("geohub_wishlist", wishlist);
}

// ======================== SEARCH ========================
function initSearchBar() {
  const form = document.querySelector(".search-bar");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const cat = form.querySelector(".search-select")?.value || "";
    const q = form.querySelector(".search-input")?.value || "";
    window.location.href = `explore.html?category=${cat}&q=${encodeURIComponent(q)}`;
  });

  // Search tags click
  document.querySelectorAll(".search-tag").forEach((tag) => {
    tag.addEventListener("click", () => {
      const q = tag.textContent.trim().replace(/^[^\w]+/, "");
      window.location.href = `explore.html?q=${encodeURIComponent(q)}`;
    });
  });
}

// ======================== COUNTER ANIMATION ========================
function initCounters() {
  const counters = document.querySelectorAll("[data-count]");
  if (!counters.length) return;
  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          animateCounter(e.target, parseInt(e.target.dataset.count));
          obs.unobserve(e.target);
        }
      });
    },
    { threshold: 0.5 },
  );
  counters.forEach((el) => obs.observe(el));
}

// ======================== INIT ========================
document.addEventListener("DOMContentLoaded", () => {
  initScrollAnimations();
  initSearchBar();
  initCounters();
});
