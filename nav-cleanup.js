(function GeoHubNavCleanup() {
  const groups = [
    {
      label: 'Main',
      kind: 'primary',
      items: [
        { label: 'Home', href: 'index.html', icon: 'fa-house' },
        { label: 'Discover', href: 'feed.html', icon: 'fa-compass' },
        { label: 'Map', href: 'map.html', icon: 'fa-map' },
        { label: 'Live', href: 'live.html', icon: 'fa-signal' }
      ]
    },
    {
      label: 'Explore',
      items: [
        { label: 'Places', href: 'places.html', icon: 'fa-location-dot' },
        { label: 'Events', href: 'events.html', icon: 'fa-ticket' },
        { label: 'Groups', href: 'groups.html', icon: 'fa-users' },
        { label: 'Real Estate', href: 'real-estate.html', icon: 'fa-building' },
        { label: 'Learning', href: 'learning.html', icon: 'fa-graduation-cap' },
        { label: 'Marketplace', href: 'services.html', icon: 'fa-briefcase' }
      ]
    },
    {
      label: 'Growth',
      items: [
        { label: 'Dashboard', href: 'dashboard.html', icon: 'fa-chart-line' },
        { label: 'Add Business', href: 'add-business.html', icon: 'fa-store' },
        { label: 'Creators', href: 'creators.html', icon: 'fa-wand-magic-sparkles' }
      ]
    },
    {
      label: 'Personal',
      items: [
        { label: 'Profile', href: 'profile.html', icon: 'fa-user' },
        { label: 'Messages', href: 'messages.html', icon: 'fa-message' },
        { label: 'Rewards', href: 'rewards.html', icon: 'fa-gift' },
        { label: 'Challenges', href: 'challenges.html', icon: 'fa-trophy' },
        { label: 'Trust', href: 'trust.html', icon: 'fa-shield-halved' },
        { label: 'Assistant', href: 'assistant.html', icon: 'fa-sparkles' }
      ]
    }
  ];

  function currentFile() {
    return (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
  }

  function isActive(item) {
    return currentFile() === item.href.toLowerCase();
  }

  function itemLink(item) {
    return `<a href="${item.href}" class="${isActive(item) ? 'active' : ''}">
      <i class="fas ${item.icon}"></i><span>${item.label}</span>
    </a>`;
  }

  function renderDesktopNav() {
    return groups.map(group => {
      if (group.kind === 'primary') {
        return group.items.map(item => `<li class="nav-leaf">${itemLink(item)}</li>`).join('');
      }
      const active = group.items.some(isActive);
      return `<li class="nav-dropdown ${active ? 'active' : ''}">
        <button class="nav-menu-trigger" type="button" aria-expanded="false">
          <span>${group.label}</span><i class="fas fa-chevron-down"></i>
        </button>
        <div class="nav-dropdown-panel">
          <div class="nav-dropdown-title">${group.label}</div>
          ${group.items.map(itemLink).join('')}
        </div>
      </li>`;
    }).join('');
  }

  function renderMobileNav() {
    return groups.map(group => `
      <div class="mobile-menu-group">
        <div class="mobile-menu-title">${group.label}</div>
        ${group.items.map(itemLink).join('')}
      </div>
    `).join('');
  }

  function wireDropdowns() {
    document.querySelectorAll('.nav-menu-trigger').forEach(button => {
      button.addEventListener('click', event => {
        event.stopPropagation();
        const parent = button.closest('.nav-dropdown');
        const isOpen = parent.classList.toggle('open');
        button.setAttribute('aria-expanded', String(isOpen));
        document.querySelectorAll('.nav-dropdown.open').forEach(drop => {
          if (drop !== parent) {
            drop.classList.remove('open');
            drop.querySelector('.nav-menu-trigger')?.setAttribute('aria-expanded', 'false');
          }
        });
      });
    });
    document.addEventListener('click', () => {
      document.querySelectorAll('.nav-dropdown.open').forEach(drop => {
        drop.classList.remove('open');
        drop.querySelector('.nav-menu-trigger')?.setAttribute('aria-expanded', 'false');
      });
    });
  }

  function cleanupActions() {
    const actions = document.querySelector('.navbar-actions');
    if (!actions) return;
    actions.querySelectorAll('a').forEach(link => {
      const href = (link.getAttribute('href') || '').toLowerCase();
      if (href === '#' && /sign up|register|sign in/i.test(link.textContent)) link.remove();
    });
    const profile = [...actions.querySelectorAll('a')].find(link => (link.getAttribute('href') || '').includes('profile.html'));
    if (profile) {
      profile.innerHTML = '<i class="fas fa-user-circle"></i>';
      profile.setAttribute('title', 'Profile');
      profile.setAttribute('aria-label', 'Profile');
      profile.classList.add('nav-profile-icon');
    }
  }

  function init() {
    const navbarLinks = document.querySelector('.navbar-links');
    const mobileMenu = document.querySelector('.mobile-menu');
    if (navbarLinks) navbarLinks.innerHTML = renderDesktopNav();
    if (mobileMenu) mobileMenu.innerHTML = renderMobileNav();
    cleanupActions();
    wireDropdowns();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
