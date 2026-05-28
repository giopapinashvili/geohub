/* ================================================================
   GeoHub — Internationalization (i18n) System
   Supports: ka (Georgian), en (English), ru (Russian)
   Usage: window.GHI18N.t('key') → translated string
          window.GHI18N.apply('en') → apply to DOM
   ================================================================ */
(function () {
  'use strict';

  var _lang = 'ka';
  try { _lang = localStorage.getItem('gh_lang') || 'ka'; } catch(e) {}

  var DICT = {
    /* ── Navigation ─────────────────────────────────────────── */
    nav_feed:         { ka: 'მთავარი',      en: 'Home',        ru: 'Главная'       },
    nav_discover:     { ka: 'აღმოაჩინე',   en: 'Discover',    ru: 'Открыть'       },
    nav_groups:       { ka: 'ჯგუფები',     en: 'Groups',      ru: 'Группы'        },
    nav_messages:     { ka: 'შეტყობინება', en: 'Messages',    ru: 'Сообщения'     },
    nav_notifications:{ ka: 'შეტყობ.',     en: 'Alerts',      ru: 'Уведомления'   },
    nav_marketplace:  { ka: 'ბაზარი',      en: 'Marketplace', ru: 'Маркет'        },
    nav_events:       { ka: 'ივენთები',    en: 'Events',      ru: 'Мероприятия'   },
    nav_gamification: { ka: 'XP & ჯილდო', en: 'XP & Rewards',ru: 'XP и Награды'  },
    nav_assistant:    { ka: 'AI ასისტენტი',en: 'AI Assistant',ru: 'AI Ассистент'  },
    nav_premium:      { ka: 'პრემიუმი',    en: 'Premium',     ru: 'Премиум'       },
    nav_map:          { ka: 'რუქა',        en: 'Map',         ru: 'Карта'         },
    nav_reels:        { ka: 'Reels',       en: 'Reels',       ru: 'Reels'         },
    nav_videos:       { ka: 'ვიდეო',      en: 'Videos',      ru: 'Видео'         },
    nav_places:       { ka: 'ადგილები',   en: 'Places',      ru: 'Места'         },
    nav_my_channel:   { ka: 'ჩემი არხი',  en: 'My Channel',  ru: 'Мой канал'     },
    nav_business:     { ka: 'ბიზნესი',    en: 'Businesses',  ru: 'Бизнесы'       },
    nav_creators:     { ka: 'კრეატორები', en: 'Creators',    ru: 'Авторы'        },
    nav_rewards:      { ka: 'ჯილდოები',   en: 'Rewards',     ru: 'Награды'       },
    nav_challenges:   { ka: 'გამოწვევები', en: 'Challenges',  ru: 'Испытания'     },
    nav_services:     { ka: 'სერვისები',  en: 'Services',    ru: 'Сервисы'       },
    nav_realestate:   { ka: 'უძრავი ქ.',  en: 'Real Estate', ru: 'Недвижимость'  },
    nav_learning:     { ka: 'სწავლა',     en: 'Learning',    ru: 'Обучение'      },
    nav_trust:        { ka: 'უსაფრთხოება',en: 'Trust/Safety',ru: 'Безопасность'  },
    nav_admin:        { ka: 'ადმინ პანელი',en: 'Admin Panel', ru: 'Администратор' },
    nav_more:         { ka: 'მეტი',       en: 'More',        ru: 'Ещё'           },
    nav_less:         { ka: 'ნაკლები',    en: 'Less',        ru: 'Меньше'        },
    nav_go_live:      { ka: 'Go Live',    en: 'Go Live',     ru: 'Трансляция'    },
    nav_how_works:    { ka: 'როგორ მუშაობს GeoHub',en: 'How GeoHub works',ru: 'Как работает GeoHub' },
    nav_post:         { ka: 'პოსტი',      en: 'Post',        ru: 'Пост'          },
    nav_profile:      { ka: 'პროფილი',    en: 'Profile',     ru: 'Профиль'       },
    nav_search:       { ka: 'ძებნა',      en: 'Search',      ru: 'Поиск'         },
    search_placeholder: { ka: 'მოძებნე ადგილები, ადამიანები, ჯგუფები…', en: 'Search places, people, groups…', ru: 'Поиск мест, людей, групп…' },

    /* ── Dropdown panel ─────────────────────────────────────── */
    profile:          { ka: 'პროფილი',     en: 'Profile',     ru: 'Профиль'       },
    settings:         { ka: 'პარამეტრები', en: 'Settings',    ru: 'Настройки'     },
    signout:          { ka: 'გამოსვლა',    en: 'Sign Out',    ru: 'Выйти'         },
    dark_mode:        { ka: 'ბნელი რეჟიმი',en: 'Dark Mode',  ru: 'Тёмный режим'  },
    light_mode:       { ka: 'ნათელი რეჟ.',en: 'Light Mode',  ru: 'Светлый режим' },
    language:         { ka: 'ენა',         en: 'Language',    ru: 'Язык'          },

    /* ── Feed / Composer ────────────────────────────────────── */
    composer_placeholder: { ka: 'რას აზიარებ დღეს?', en: 'What\'s on your mind?', ru: 'Что у вас нового?' },
    feed_foryou:      { ka: 'შენთვის',     en: 'For You',     ru: 'Для вас'       },
    feed_following:   { ka: 'გამოწერილი',  en: 'Following',   ru: 'Подписки'      },
    feed_local:       { ka: 'ლოკალური',    en: 'Local',       ru: 'Местное'       },
    feed_nearme:      { ka: 'ახლოს',       en: 'Near Me',     ru: 'Рядом'         },
    feed_empty:       { ka: 'ფიდი ცარიელია',en: 'Feed is empty',ru: 'Лента пуста' },
    post_action_like: { ka: 'მოწონება',    en: 'Like',        ru: 'Нравится'      },
    post_action_comment:{ ka: 'კომენტარი', en: 'Comment',     ru: 'Комментарий'   },
    post_action_share:{ ka: 'გაზიარება',   en: 'Share',       ru: 'Поделиться'    },
    post_action_save: { ka: 'შენახვა',     en: 'Save',        ru: 'Сохранить'     },
    comment_placeholder:{ ka: 'დაწერე კომენტარი…',en: 'Write a comment…',ru: 'Напишите комментарий…' },

    /* ── Post types / actions ───────────────────────────────── */
    create_post:      { ka: 'პოსტის გამოქვეყნება',en: 'Create Post', ru: 'Создать пост' },
    photo:            { ka: 'ფოტო',         en: 'Photo',       ru: 'Фото'          },
    place:            { ka: 'ადგილი',       en: 'Place',       ru: 'Место'         },
    business:         { ka: 'ბიზნესი',      en: 'Business',    ru: 'Бизнес'        },
    event:            { ka: 'ივენთი',       en: 'Event',       ru: 'Мероприятие'   },
    translate_btn:    { ka: '🌐 თარგმნა',  en: '🌐 Translate', ru: '🌐 Перевести'  },

    /* ── Auth ───────────────────────────────────────────────── */
    sign_in:          { ka: 'შესვლა',       en: 'Sign In',     ru: 'Войти'         },
    sign_up:          { ka: 'რეგისტრაცია',  en: 'Sign Up',     ru: 'Регистрация'   },

    /* ── General UI ─────────────────────────────────────────── */
    loading:          { ka: 'იტვირთება…',   en: 'Loading…',    ru: 'Загрузка…'     },
    save:             { ka: 'შენახვა',       en: 'Save',        ru: 'Сохранить'     },
    cancel:           { ka: 'გაუქმება',      en: 'Cancel',      ru: 'Отмена'        },
    submit:           { ka: 'გაგზავნა',      en: 'Submit',      ru: 'Отправить'     },
    confirm:          { ka: 'დადასტურება',   en: 'Confirm',     ru: 'Подтвердить'   },
    delete:           { ka: 'წაშლა',         en: 'Delete',      ru: 'Удалить'       },
    edit:             { ka: 'რედაქტირება',   en: 'Edit',        ru: 'Редактировать' },
    follow:           { ka: 'გამოწერა',      en: 'Follow',      ru: 'Подписаться'   },
    unfollow:         { ka: 'გამოუწერა',     en: 'Unfollow',    ru: 'Отписаться'    },
    send_message:     { ka: 'შეტყობ. გაგზ.',en: 'Message',     ru: 'Написать'      },
    search:           { ka: 'ძებნა',         en: 'Search',      ru: 'Поиск'         },
    view_more:        { ka: 'მეტის ნახვა',   en: 'View more',   ru: 'Показать ещё'  },
    all_caught_up:    { ka: 'ყველა პოსტი ნანახია',en: 'All caught up',ru: 'Всё просмотрено' },
    no_results:       { ka: 'შედეგი არ მოიძებნა',en: 'No results',ru: 'Нет результатов' },

    /* ── Profile tabs ───────────────────────────────────────── */
    profile_posts:    { ka: 'პოსტები',       en: 'Posts',       ru: 'Посты'         },
    profile_about:    { ka: 'ინფო',           en: 'About',       ru: 'О себе'        },
    profile_gallery:  { ka: 'გალერეა',        en: 'Gallery',     ru: 'Галерея'       },
    profile_friends:  { ka: 'მეგობრები',      en: 'Friends',     ru: 'Друзья'        },
    profile_checkins: { ka: 'ჩეკ-ინები',      en: 'Check-ins',   ru: 'Отметки'       },
    profile_badges:   { ka: 'ნიშნები',        en: 'Badges',      ru: 'Значки'        },
    profile_saved:    { ka: 'შენახული',        en: 'Saved',       ru: 'Сохранённое'   },
    profile_edit:     { ka: 'პროფილის რედ.',  en: 'Edit Profile',ru: 'Ред. профиль'  },
    profile_add_friend:{ ka: 'მეგობრად დამატება',en: 'Add Friend',ru: 'Добавить друга'},
    profile_message:  { ka: 'შეტყობინება',    en: 'Message',     ru: 'Написать'      },
  };

  /* ── Core t() function ───────────────────────────────────── */
  function t(key, lang) {
    var l = lang || _lang;
    var entry = DICT[key];
    if (!entry) return key;
    return entry[l] || entry['en'] || key;
  }

  /* ── Apply all data-i18n elements in DOM ─────────────────── */
  function apply(lang) {
    _lang = lang || _lang;
    try { localStorage.setItem('gh_lang', _lang); } catch(e) {}
    document.documentElement.setAttribute('lang', _lang === 'ka' ? 'ka' : _lang === 'ru' ? 'ru' : 'en');
    var els = document.querySelectorAll('[data-i18n]');
    els.forEach(function(el) {
      var key = el.getAttribute('data-i18n');
      var translated = t(key, _lang);
      if (translated && translated !== key) el.textContent = translated;
    });
    // Update placeholders
    var pls = document.querySelectorAll('[data-i18n-placeholder]');
    pls.forEach(function(el) {
      var key = el.getAttribute('data-i18n-placeholder');
      var translated = t(key, _lang);
      if (translated && translated !== key) el.placeholder = translated;
    });
  }

  /* ── Auto-apply on load ──────────────────────────────────── */
  function init() {
    apply(_lang);
    // Re-apply after shell() renders content (GeoSocialReady)
    window.addEventListener('GeoSocialReady', function() { apply(_lang); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ── Also re-apply whenever shell() re-renders ─────────────
     shell() replaces document.body.innerHTML — hook via MutationObserver */
  var _applyTimer = null;
  var _bodyObs = new MutationObserver(function() {
    clearTimeout(_applyTimer);
    _applyTimer = setTimeout(function() { apply(_lang); }, 120);
  });
  if (document.body) {
    _bodyObs.observe(document.body, { childList: true, subtree: false });
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      _bodyObs.observe(document.body, { childList: true, subtree: false });
    });
  }

  /* ── Public API ──────────────────────────────────────────── */
  window.GHI18N = { t: t, apply: apply, lang: function() { return _lang; }, dict: DICT };
  window.GHt = t; // shorthand
})();
