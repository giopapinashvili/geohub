/* ================================================================
   GeoHub — Application Configuration
   ----------------------------------------------------------------
   Single source of truth for app-wide settings.
   When connecting to a real backend, update API_BASE_URL and
   flip the relevant FEATURE_FLAGS to true.
   ================================================================ */

const GeoConfig = Object.freeze({

  /* ── Identity ────────────────────────────────────────────── */
  APP_NAME:    'GeoHub',
  APP_VERSION: '1.0.0-beta',
  APP_LOCALE:  'ka-GE',          // Georgian locale default
  APP_CURRENCY: 'GEL',

  /* ── Backend ─────────────────────────────────────────────── */
  // TODO: Replace with real API URL before production launch
  API_BASE_URL:   'https://api.geohub.ge/v1',
  CDN_BASE_URL:   'https://cdn.geohub.ge',
  MAPS_TILE_URL:  'https://maps.geohub.ge/tiles/{z}/{x}/{y}.png',
  WS_URL:         'wss://ws.geohub.ge',   // WebSocket for Live City

  /* ── Demo / environment ──────────────────────────────────── */
  DEMO_MODE: true,    // flip to false when real backend is connected
  ENV: 'development', // 'development' | 'staging' | 'production'

  /* ── Feature flags ───────────────────────────────────────── */
  // Set to true progressively as each backend service goes live
  FEATURE_FLAGS: {
    realAuth:        false,  // JWT/session auth via backend
    realFeed:        false,  // Feed posts from database
    realRewards:     false,  // Rewards engine with QR codes
    realPayments:    false,  // Stripe/BOG payments for tickets
    realPush:        false,  // Web push via FCM/VAPID
    realSearch:      false,  // Algolia / PostgreSQL full-text
    realMaps:        false,  // Mapbox / Google Maps API
    fileUpload:      false,  // S3 / Supabase Storage media upload
    socialLogin:     false,  // Google / Apple OAuth
    liveWebSocket:   false,  // Real-time Live City feed
    emailVerify:     false,  // Email confirmation on sign-up
    adminPanel:      false,  // Internal dashboard for moderation
    analytics:       false,  // PostHog / Mixpanel event tracking
  },

  /* ── localStorage key registry ──────────────────────────── */
  // All localStorage keys in one place — prevents key collisions
  STORAGE_KEYS: {
    authUser:           'geohub_auth_user',
    authToken:          'geohub_auth_token',
    registeredUsers:    'geohub_registered_users',
    onboarding:         'geohub_onboarding',
    wishlist:           'geohub_wishlist',
    checkins:           'geohub_checkins',
    rewardClaims:       'geohub_reward_claims',
    challengeProgress:  'geohub_challenge_progress',
    tickets:            'geohub_tickets',
    messages:           'geohub_messages',
    notifications:      'geohub_notifications',
    reports:            'geohub_reports',
    collabOffers:       'geohub_collab_offers',
    serviceRequests:    'geohub_service_requests',
    lessonBookings:     'geohub_lesson_bookings',
    campaigns:          'geohub_campaigns',
    draftPost:          'geohub_draft_post',
    searchHistory:      'geohub_search_history',
    themePreference:    'geohub_theme',
    installDismissed:   'geohub_install_dismissed',
    splashShown:        'geohub_splash_shown',
    demoMode:           'geohub_demo_mode',
  },

  /* ── App routes ──────────────────────────────────────────── */
  ROUTES: {
    home:          'index.html',
    auth:          'auth.html',
    onboarding:    'onboarding.html',
    feed:          'feed.html',
    profile:       'profile.html',
    explore:       'explore.html',
    places:        'places.html',
    rewards:       'rewards.html',
    challenges:    'challenges.html',
    checkin:       'checkin.html',
    events:        'events.html',
    messages:      'messages.html',
    dashboard:     'dashboard.html',
    live:          'live.html',
    map:           'map.html',
    groups:        'groups.html',
    business:      'business.html',
    addBusiness:   'add-business.html',
    creators:      'creators.html',
    assistant:     'assistant.html',
    learning:      'learning.html',
    realEstate:    'real-estate.html',
    services:      'services.html',
    trust:         'trust.html',
  },

  /* ── Mock / simulation settings ─────────────────────────── */
  MOCK: {
    delay:          { min: 180, max: 700 },   // simulated API latency ms
    defaultCity:    'Tbilisi',
    xpPerCheckin:   35,
    xpPerReview:    55,
    xpPerChallenge: 120,
    xpPerPhoto:     60,
    xpPerPatriot:   180,
    maxFeedPage:    12,
  },

  /* ── Validation rules ────────────────────────────────────── */
  VALIDATION: {
    usernameMin:  3,
    usernameMax:  32,
    passwordMin:  6,
    bioMax:       200,
    postCaptionMax: 500,
  },

});

window.GeoConfig = GeoConfig;
