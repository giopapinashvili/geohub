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
    following:        { ka: 'გამოწერილია',   en: 'Following',   ru: 'Подписан'      },
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

    /* ── Groups ─────────────────────────────────────────────── */
    groups_discover:  { ka: 'აღმოჩენა',       en: 'Discover',    ru: 'Открыть'       },
    groups_mine:      { ka: 'ჩემი ჯგუფები',   en: 'Your groups', ru: 'Мои группы'    },
    groups_requests:  { ka: 'მოთხოვნები',      en: 'Requests',    ru: 'Запросы'       },
    create_group:     { ka: 'ჯგუფის შექმნა',  en: 'Create Group',ru: 'Создать группу'},
    group_join:       { ka: 'გაწევრება',       en: 'Join',        ru: 'Вступить'      },
    group_leave:      { ka: 'გასვლა',          en: 'Leave',       ru: 'Выйти'         },
    group_request_join:{ ka: 'შეერთების მოთხ.',en: 'Request to Join',ru: 'Запросить вступление' },
    group_pending:    { ka: 'მოლოდინში…',      en: 'Request Pending',ru: 'Запрос отправлен' },
    group_manage:     { ka: 'მართვა',           en: 'Manage',      ru: 'Управление'    },
    group_discussion: { ka: 'დისკუსია',         en: 'Discussion',  ru: 'Обсуждение'    },
    group_members:    { ka: 'წევრები',          en: 'Members',     ru: 'Участники'     },
    group_media:      { ka: 'მედია',            en: 'Media',       ru: 'Медиа'         },
    group_files:      { ka: 'ფაილები',          en: 'Files',       ru: 'Файлы'         },
    group_chat:       { ka: 'ჩატი',             en: 'Chat',        ru: 'Чат'           },
    group_admin:      { ka: 'ადმინი',           en: 'Admin',       ru: 'Админ'         },

    /* ── Events ─────────────────────────────────────────────── */
    create_event:     { ka: 'ივენთის შექმნა',  en: 'Create Event',ru: 'Создать событие'},
    evt_upcoming:     { ka: 'მომავალი',         en: 'Upcoming',    ru: 'Предстоящие'   },
    evt_today:        { ka: 'დღეს',             en: 'Today',       ru: 'Сегодня'       },
    evt_weekend:      { ka: 'ეს შაბათ-კვირა',  en: 'This weekend',ru: 'Эти выходные'  },
    evt_past:         { ka: 'გასული',           en: 'Past',        ru: 'Прошедшие'     },
    evt_view:         { ka: 'ნახვა',            en: 'View',        ru: 'Смотреть'      },
    evt_rsvp:         { ka: 'დადასტ.',          en: 'RSVP',        ru: 'Пойду'         },

    /* ── Business page ──────────────────────────────────────── */
    biz_overview:     { ka: 'მიმოხილვა',        en: 'Overview',    ru: 'Обзор'         },
    biz_services:     { ka: 'სერვისები',        en: 'Services',    ru: 'Услуги'        },
    biz_photos:       { ka: 'ფოტოები',          en: 'Photos',      ru: 'Фото'          },
    biz_reviews:      { ka: 'მიმოხილვები',      en: 'Reviews',     ru: 'Отзывы'        },
    biz_dashboard:    { ka: 'დაშბორდი',         en: 'Dashboard',   ru: 'Дашборд'       },
    biz_followers:    { ka: 'გამომწერი',         en: 'Followers',   ru: 'Подписчики'    },
    biz_rating:       { ka: 'რეიტინგი',         en: 'Rating',      ru: 'Рейтинг'       },
    biz_reviews_lbl:  { ka: 'მიმოხილვა',        en: 'Reviews',     ru: 'Отзывы'        },
    biz_add_business: { ka: 'ბიზნესის დამატება',en: 'Add Business',ru: 'Добавить бизнес'},
    biz_message:      { ka: 'შეტყობინება',       en: 'Message',     ru: 'Написать'      },

    /* ── Notifications ──────────────────────────────────────── */
    notif_mark_all:   { ka: 'ყველა წაკითხულია', en: 'Mark all read',ru: 'Всё прочитано' },
    notif_all:        { ka: 'ყველა',             en: 'All',         ru: 'Все'           },
    notif_likes:      { ka: 'მოწონებები',        en: 'Likes',       ru: 'Лайки'         },
    notif_comments:   { ka: 'კომენტარები',       en: 'Comments',    ru: 'Комментарии'   },
    notif_replies:    { ka: 'პასუხები',           en: 'Replies',     ru: 'Ответы'        },
    notif_follows:    { ka: 'გამოწერები',         en: 'Follows',     ru: 'Подписки'      },
    notif_stories:    { ka: 'სტორები',            en: 'Stories',     ru: 'Истории'       },
    notif_rewards:    { ka: 'ჯილდოები',           en: 'Rewards',     ru: 'Награды'       },
    notif_today:      { ka: 'დღეს',              en: 'Today',       ru: 'Сегодня'       },
    notif_yesterday:  { ka: 'გუშინ',             en: 'Yesterday',   ru: 'Вчера'         },
    notif_older:      { ka: 'ძველი',             en: 'Older',       ru: 'Ранее'         },

    /* ── Marketplace ────────────────────────────────────────── */
    mkt_sell:         { ka: 'გაყიდვა',           en: 'Sell item',   ru: 'Продать'       },
    mkt_contact:      { ka: 'კონტაქტი',          en: 'Contact',     ru: 'Написать'      },
    mkt_list_item:    { ka: 'განცხადება',         en: 'List Item',   ru: 'Опубликовать'  },
    mkt_sell_modal:   { ka: 'ნივთის გაყიდვა',    en: 'Sell an Item',ru: 'Продать товар' },
    mkt_sold:         { ka: 'გაიყიდა',           en: 'Sold',        ru: 'Продано'       },

    /* ── Gamification ───────────────────────────────────────── */
    xp_daily:         { ka: 'დღის დავალებები',    en: 'Daily Missions',ru: 'Ежедневные задания' },
    xp_badges:        { ka: 'ნიშნები',            en: 'Badges',      ru: 'Значки'        },
    xp_leaderboard:   { ka: 'ლიდერბორდი',         en: 'Leaderboard', ru: 'Рейтинг'       },
    xp_sign_in:       { ka: 'შედი XP-ის სანახავად',en: 'Sign in to see your XP',ru: 'Войдите, чтобы видеть XP' },
    xp_rewards_title: { ka: 'XP & ჯილდოები',     en: 'XP & Rewards',ru: 'XP и Награды'  },
    xp_claim:         { ka: 'დამიბრუნე',          en: 'Claim',       ru: 'Получить'      },
    xp_claimed:       { ka: 'მიღებული',           en: 'Claimed ✓',   ru: 'Получено ✓'    },

    /* ── Auth page ──────────────────────────────────────────── */
    auth_back:        { ka: '← მთავარი',          en: '← Back to Home', ru: '← Главная'    },
    auth_login_tab:   { ka: 'შესვლა',             en: 'Login',          ru: 'Войти'         },
    auth_signup_tab:  { ka: 'რეგისტრაცია',        en: 'Sign Up',        ru: 'Регистрация'   },
    auth_welcome_back:{ ka: 'კეთილი დაბრუნება!',  en: 'Welcome back',   ru: 'С возвращением!'},
    auth_login_sub:   { ka: 'GeoHub-ში შესვლა.',  en: 'Log in to your GeoHub account to continue exploring.', ru: 'Войдите в свой аккаунт GeoHub.' },
    auth_email_or_user:{ ka: 'ელ-ფოსტა ან სახელი',en: 'Email or Username',ru: 'Email или логин'},
    auth_password:    { ka: 'პაროლი',             en: 'Password',       ru: 'Пароль'        },
    auth_remember_me: { ka: 'გამახსოვრება',        en: 'Remember me',    ru: 'Запомнить'     },
    auth_forgot:      { ka: 'პაროლი დამავიწყდა?', en: 'Forgot password?',ru: 'Забыли пароль?'},
    auth_login_btn:   { ka: 'შესვლა',             en: 'Login',          ru: 'Войти'         },
    auth_google_login:{ ka: 'Google-ით შესვლა',   en: 'Continue with Google',ru: 'Войти через Google'},
    auth_no_account:  { ka: 'ანგარიში არ გაქვს?', en: 'Don\'t have an account?',ru: 'Нет аккаунта?'},
    auth_join:        { ka: 'შეუერთდი GeoHub-ს',  en: 'Join GeoHub',    ru: 'Присоединиться к GeoHub'},
    auth_join_sub:    { ka: 'შექმენი ანგარიში და დაიწყე Georgia-ს აღმოჩენა.',en: 'Create your account and start discovering Georgia.',ru: 'Создайте аккаунт и откройте для себя Грузию.'},
    auth_full_name:   { ka: 'სრული სახელი',        en: 'Full Name',      ru: 'Полное имя'    },
    auth_username_lbl:{ ka: 'სახელი (nickname)',   en: 'Username',       ru: 'Псевдоним'     },
    auth_email_lbl:   { ka: 'ელ-ფოსტა',           en: 'Email',          ru: 'Email'          },
    auth_account_type:{ ka: 'ანგარიშის ტიპი',     en: 'Account Type',   ru: 'Тип аккаунта'  },
    auth_city_lbl:    { ka: 'ქალაქი',             en: 'City',           ru: 'Город'          },
    auth_interests:   { ka: 'ინტერესები',          en: 'Interests',      ru: 'Интересы'       },
    auth_create_btn:  { ka: 'ანგარიშის შექმნა',   en: 'Create Account', ru: 'Создать аккаунт'},
    auth_google_signup:{ ka: 'Google-ით რეგ.',    en: 'Sign up with Google',ru: 'Регистрация через Google'},
    auth_have_account:{ ka: 'ანგარიში გაქვს?',    en: 'Already have an account?',ru: 'Уже есть аккаунт?'},
    auth_reset_title: { ka: 'პაროლის აღდგენა',    en: 'Reset Password',  ru: 'Сброс пароля'  },
    auth_reset_sub:   { ka: 'ელ-ფოსტა შეიყვანე — გამოვაგზავნით ლინკს.',en: 'Enter the email linked to your account. We\'ll send a real Firebase password reset link.',ru: 'Введите email — мы отправим ссылку для сброса пароля.' },
    auth_send_reset:  { ka: 'გამოგზავნა',          en: 'Send Reset Link', ru: 'Отправить ссылку'},
    auth_reset_sent:  { ka: '✓ გამოიგზავნა. შეამოწმე ელ-ფოსტა.',en: '✓ Password reset email sent. Check your inbox.',ru: '✓ Письмо отправлено. Проверьте почту.'},

    /* ── Search page ────────────────────────────────────────── */
    srch_title:       { ka: 'GeoHub-ში ძებნა',   en: 'Search GeoHub',ru: 'Поиск в GeoHub'},
    srch_people:      { ka: 'ადამიანები',          en: 'People',      ru: 'Люди'          },
    srch_type_to_search:{ ka: 'მოძებნე…',         en: 'Type to search',ru: 'Введите запрос'},
    srch_no_results:  { ka: 'შედეგი არ მოიძებნა', en: 'No results',  ru: 'Нет результатов'},

    /* ── Reels ──────────────────────────────────────────────── */
    reels_loading:    { ka: 'Reels იტვირთება…',  en: 'Loading Reels…',ru: 'Загрузка Reels…'},
    reels_unavailable:{ ka: 'Reels მიუწვდომელია',en: 'Reels unavailable',ru: 'Reels недоступны'},
    reels_empty:      { ka: 'Reels ჯერ არ არის', en: 'No reels yet', ru: 'Пока нет Reels' },
    reels_empty_sub:  { ka: 'გამოაქვეყნე ვიდეო აქ!',en: 'Post a short video to be featured here!',ru: 'Опубликуйте видео здесь!' },

    /* ── AI Assistant ───────────────────────────────────────── */
    ai_subtitle:      { ka: 'შენი Georgian ასისტენტი',en: 'Your Georgian travel & lifestyle assistant',ru: 'Ваш грузинский ассистент' },
    ai_placeholder:   { ka: 'GeoAI-ს ჰკითხე…',  en: 'Ask GeoAI anything…',ru: 'Спросите GeoAI…'  },
    ai_cleared:       { ka: 'ჩატი გასუფთავდა!', en: 'Chat cleared! How can I help?',ru: 'Чат очищен! Чем помочь?' },

    /* ── Discover / misc ────────────────────────────────────── */
    disc_title:       { ka: 'აღმოაჩინე',           en: 'Discover',        ru: 'Открыть'          },
    disc_sub:         { ka: 'ყველა GeoHub კონტენტი ერთ ადგილას.',en: 'All real GeoHub content in one social feed.',ru: 'Весь контент GeoHub в одной ленте.' },
    disc_add_biz:     { ka: 'ბიზნესის დამატება',   en: 'Add business',    ru: 'Добавить бизнес'  },
    disc_search:      { ka: 'პოსტი, ბიზნ., ჯგ., ადგ…',en: 'Search posts, businesses, groups, places…',ru: 'Поиск постов, бизнесов, групп, мест…' },
    disc_loading:     { ka: 'იტვირთება…',           en: 'Loading Discover…',ru: 'Загрузка…'        },
    disc_nothing:     { ka: 'ვერ მოიძებნა',         en: 'Nothing found',   ru: 'Ничего не найдено'},
    coming_soon:      { ka: 'მალე…',               en: 'Coming soon',     ru: 'Скоро'            },
    back_to_feed:     { ka: 'ფიდზე დაბრუნება',     en: 'Back to Feed',    ru: 'Вернуться в ленту'},

    /* ── Messages page ──────────────────────────────────────── */
    msg_title:        { ka: 'შეტყობინებები',       en: 'Messages',        ru: 'Сообщения'       },
    msg_new:          { ka: 'ახალი შეტყობინება',   en: 'New message',     ru: 'Новое сообщение' },
    msg_search_convs: { ka: 'ჩეტის ძებნა…',        en: 'Search conversations…',ru: 'Поиск чатов…'  },
    msg_all:          { ka: 'ყველა',               en: 'All',             ru: 'Все'              },
    msg_unread:       { ka: 'წაუკითხავი',           en: 'Unread',          ru: 'Непрочитанные'   },
    msg_select_conv:  { ka: 'ჩეტი აარჩიე',         en: 'Select a conversation',ru: 'Выберите чат' },
    msg_search_msgs:  { ka: 'შეტყობინებების ძ…',   en: 'Search messages…',ru: 'Поиск сообщений…' },
    msg_photo:        { ka: 'ფოტო',                en: 'Photo',           ru: 'Фото'             },
    msg_file:         { ka: 'ფაილი',               en: 'File',            ru: 'Файл'             },
    msg_voice:        { ka: 'ხმა',                 en: 'Voice',           ru: 'Голос'            },
    msg_type_msg:     { ka: 'შეტყობინება…',         en: 'Type a message…', ru: 'Написать…'        },
    msg_start_conv:   { ka: 'ჩეტი დაიწყე',         en: 'Start a conversation',ru: 'Начать чат'   },
    msg_start_sub:    { ka: 'მოძებნე მომხმარებელი.',en: 'Search real users and open a chat.',ru: 'Найдите пользователя и откройте чат.' },
    msg_search_user:  { ka: 'სახელი ან ელ-ფოსტა…', en: 'Search by name or email…',ru: 'Имя или email…' },
    msg_conv_details: { ka: 'ჩეტის დეტალები',      en: 'Select a conversation to see details',ru: 'Выберите чат для просмотра деталей' },

    /* ── Places page ────────────────────────────────────────── */
    pl_discover:      { ka: 'ადგილების აღმოჩენა',  en: 'Discover Places', ru: 'Открыть места'    },
    pl_add:           { ka: 'ადგილის დამატება',    en: 'Add a Place',     ru: 'Добавить место'   },
    pl_name:          { ka: 'სახელი *',             en: 'Place Name *',    ru: 'Название *'       },
    pl_category:      { ka: 'კატეგორია',            en: 'Category',        ru: 'Категория'        },
    pl_description:   { ka: 'აღწერა',              en: 'Description',     ru: 'Описание'         },
    pl_address:       { ka: 'მისამართი',            en: 'Address',         ru: 'Адрес'            },
    pl_coords:        { ka: 'კოორდინატები (სურ.)',  en: 'Coordinates (optional)',ru: 'Координаты (необяз.)' },
    pl_photo:         { ka: 'ფოტო (სურ.)',          en: 'Photo (optional)', ru: 'Фото (необяз.)'  },
    pl_add_btn:       { ka: 'ადგილის დამატება',    en: 'Add Place',        ru: 'Добавить'         },

    /* ── Channel page ───────────────────────────────────────── */
    ch_home:          { ka: 'მთავარი',              en: 'Home',            ru: 'Главная'          },
    ch_videos:        { ka: 'ვიდეოები',            en: 'Videos',          ru: 'Видео'            },
    ch_shorts:        { ka: 'Shorts',              en: 'Shorts',          ru: 'Shorts'            },
    ch_playlists:     { ka: 'Playlist-ები',        en: 'Playlists',       ru: 'Плейлисты'        },
    ch_posts:         { ka: 'პოსტები',             en: 'Posts',           ru: 'Посты'             },
    ch_latest_videos: { ka: 'უახლესი ვიდეოები',   en: 'Latest Videos',   ru: 'Последние видео'   },
    ch_subscribe:     { ka: 'გამოწერა',            en: 'Subscribe',       ru: 'Подписаться'       },
    ch_subscribed:    { ka: 'გამოწერილია',          en: 'Subscribed',      ru: 'Подписан'          },

    /* ── Check-in page ──────────────────────────────────────── */
    ci_title:         { ka: 'ჩეკ-ინი',           en: 'Check In',       ru: 'Отметка'        },
    ci_subtitle:      { ka: 'დაადასტურე ვიზიტი და მიიღე XP',en: 'Verify your visit and earn XP',ru: 'Подтвердите визит и получите XP' },
    ci_sign_in_title: { ka: 'შედი ჩეკ-ინისთვის', en: 'Sign in to Check In',ru: 'Войдите для отметки' },
    ci_sign_in_sub:   { ka: 'GeoHub-ის ანგარიში გჭირდება ადგილებში ჩეკ-ინისა და XP-ის მოსაგებად.',en: 'You need a GeoHub account to check in at places and earn XP.',ru: 'Нужен аккаунт GeoHub для отметки и получения XP.' },
    ci_login_btn:     { ka: 'შესვლა / რეგ.',      en: 'Log In / Sign Up',ru: 'Войти / Зарегистрироваться' },
    ci_select_place:  { ka: 'ადგილის არჩევა',     en: 'Select a Place', ru: 'Выберите место'  },
    ci_change_btn:    { ka: 'შეცვლა',             en: 'Change',         ru: 'Изменить'        },
    ci_verify_loc:    { ka: 'მდებარეობის დადასტ.',en: 'Verify Location', ru: 'Проверить геолокацию' },
    ci_get_loc:       { ka: 'ჩემი მდებარეობა',    en: 'Get My Location', ru: 'Моё местоположение' },
    ci_add_photo:     { ka: 'ფოტოს დამატება',     en: 'Add Photo',      ru: 'Добавить фото'   },
    ci_take_photo:    { ka: 'ფოტოს გადაღება',     en: 'Take Photo or Upload',ru: 'Сфотографировать или загрузить' },
    ci_caption:       { ka: 'კომენტარი',          en: 'Caption',        ru: 'Подпись'         },
    ci_caption_ph:    { ka: 'რა ხდება? გაგვიზიარე…',en: 'What\'s happening here? Share a note…',ru: 'Что здесь происходит? Поделитесь…' },
    ci_for_checkin:   { ka: 'ამ ჩეკ-ინისთვის',   en: 'for this check-in',ru: 'за эту отметку'  },
    ci_verify_gps:    { ka: 'GPS-ის დადასტ. სრული XP-ისთვის',en: 'Verify your GPS location to earn full XP',ru: 'Подтвердите GPS для полного XP' },
    ci_submit_btn:    { ka: '📍 ჩეკ-ინი ახლა',   en: 'Check In Now',   ru: 'Отметиться'      },
    ci_search_place:  { ka: 'ადგილის ძებნა',      en: 'Search for a Place',ru: 'Найти место'   },
    ci_place_ph:      { ka: 'რესტორანი, კაფე, ატრაქცია…',en: 'Restaurant, café, attraction…',ru: 'Ресторан, кафе, достопримечательность…' },
    ci_start_typing:  { ka: 'შეიყვანე ძებნის ტექსტი…',en: 'Start typing to search nearby places',ru: 'Начните вводить для поиска мест' },
    ci_checked_in:    { ka: '✓ ჩეკ-ინი გაკეთდა!',en: 'Checked In!',    ru: 'Отметка сделана!'},

    /* ── Map page ───────────────────────────────────────────── */
    map_title:        { ka: 'რუქაზე აღმოჩენა',   en: 'Discover on Map',ru: 'Открыть на карте'},
    map_biz:          { ka: 'ბიზნესი',            en: 'Biz',         ru: 'Бизнес'         },

    /* ── Creators page ──────────────────────────────────────── */
    cr_marketplace:   { ka: 'კრეატორთა ბაზარი',   en: 'Creator Marketplace',ru: 'Рынок авторов'   },
    cr_title:         { ka: 'რეალური კრეატორები',  en: 'Real Creators',  ru: 'Реальные авторы' },
    cr_search_ph:     { ka: 'მოძებნე კრეატორი…',  en: 'Search real creators...',ru: 'Найти автора…' },
    cr_total:         { ka: 'სულ კრეატორი',        en: 'Total creators', ru: 'Всего авторов'   },
    cr_showing:       { ka: 'ნაჩვენები',            en: 'Showing',        ru: 'Показано'        },
    cr_campaigns:     { ka: 'კამპანიები',           en: 'Campaigns',      ru: 'Кампании'        },
    cr_filter_by_cat: { ka: 'კატეგორიით ფილტრი',   en: 'Filter by Category',ru: 'Фильтр по категории' },
    cr_all:           { ka: 'ყველა კრეატორი',       en: 'All Creators',   ru: 'Все авторы'      },
    cr_loading:       { ka: 'კრეატ. იტვირთება…',   en: 'Loading creators…',ru: 'Загрузка авторов…' },

    /* ── Rewards JS strings ─────────────────────────────────── */
    rw_redeem:        { ka: 'გამოყენება',          en: 'Redeem',         ru: 'Использовать'    },
    rw_expired:       { ka: 'ვადა გავიდა',         en: 'Expired',        ru: 'Истёк'           },
    rw_unavailable:   { ka: 'მიუწვდომელია',        en: 'Unavailable',    ru: 'Недоступно'      },
    rw_out_of_stock:  { ka: 'ამოიწურა',            en: 'Out of Stock',   ru: 'Нет в наличии'   },
    rw_need_more:     { ka: 'საჭირო pts',           en: 'Need more pts',  ru: 'Нужно больше pts'},
    rw_claimed_before:{ ka: 'უკვე გამოყენებული',  en: 'Claimed before', ru: 'Уже использовано'},
    rw_no_category:   { ka: 'ამ კატეგ. ჯილდო არ არის',en: 'No rewards in this category',ru: 'Нет наград в этой категории' },
    rw_send_modal:    { ka: 'GeoPoints-ის გაგზავნა',en: 'Send GeoPoints', ru: 'Отправить GeoPoints' },
    rw_send_btn:      { ka: 'გაგზავნა',            en: 'Send Points',    ru: 'Отправить'       },
    rw_earned:        { ka: 'მიღებული',            en: 'Earned',         ru: 'Заработано'      },
    rw_received:      { ka: 'მიღ. გამოგზ.',        en: 'Received',       ru: 'Получено'        },
    rw_redeemed:      { ka: 'გამოყენებული',        en: 'Redeemed',       ru: 'Использовано'    },

    /* ── Rewards page ───────────────────────────────────────── */
    rw_balance:       { ka: 'GeoPoints-ის ბალანსი',en: 'GeoPoints Balance',ru: 'Баланс GeoPoints' },
    rw_send:          { ka: 'პოინტების გაგზავნა', en: 'Send Points',     ru: 'Отправить баллы' },
    rw_history:       { ka: 'ისტორია',             en: 'History',        ru: 'История'          },
    rw_info:          { ka: 'GeoPoints — ლოიალობის ქულები. მათი გამოტანა ან ფულზე გაცვლა შეუძლებელია.',en: 'GeoPoints are non-cash loyalty rewards. They cannot be withdrawn or exchanged for real money.',ru: 'GeoPoints — баллы лояльности. Нельзя вывести или обменять на деньги.' },
    rw_all:           { ka: 'ყველა ჯილდო',        en: 'All Rewards',    ru: 'Все награды'      },
    rw_food:          { ka: 'საჭმელი & სასმელი',  en: 'Food & Drink',   ru: 'Еда и напитки'    },
    rw_experience:    { ka: 'გამოცდილება',         en: 'Experience',     ru: 'Впечатления'      },
    rw_shopping:      { ka: 'შოპინგი',             en: 'Shopping',       ru: 'Шоппинг'          },
    rw_entertainment: { ka: 'გართობა',             en: 'Entertainment',  ru: 'Развлечения'      },
    rw_travel:        { ka: 'მოგზაურობა',          en: 'Travel',         ru: 'Путешествия'      },
    rw_available:     { ka: 'ხელმისაწვდომი ჯილდოები',en: 'Available Rewards',ru: 'Доступные награды' },
    rw_loading:       { ka: 'ჯილდოები იტვირთება…', en: 'Loading rewards…',ru: 'Загрузка наград…' },
    rw_pending_gifts: { ka: 'მომლოდინე საჩუქრები', en: 'Pending Gifts',  ru: 'Ожидающие подарки'},
    rw_my_coupons:    { ka: 'ჩემი ვაუჩერები',      en: 'My Coupons',     ru: 'Мои купоны'       },
    rw_biz_coupons:   { ka: 'ჩემი ბიზნესის ვაუჩერები',en: 'Coupons at My Business',ru: 'Купоны моего бизнеса' },

    /* ── Premium ────────────────────────────────────────────── */
    prem_monthly:     { ka: 'ყოველთვიური',        en: 'Monthly',     ru: 'Ежемесячно'     },
    prem_yearly:      { ka: 'ყოველწლიური',        en: 'Yearly',      ru: 'Ежегодно'       },
    prem_best_value:  { ka: 'საუკეთესო',          en: 'Best value',  ru: 'Выгоднее'       },
    prem_per_month:   { ka: 'ლარი/თვე',           en: 'GEL/month',   ru: 'GEL/мес'        },
    prem_per_year:    { ka: 'ლარი/წელი',          en: 'GEL/year',    ru: 'GEL/год'        },
    prem_save:        { ka: '34%-ით დაზოგვა',     en: 'Save 34% vs monthly',ru: 'Экономия 34%' },
    prem_start_monthly:{ ka: 'ყოველთვ. გამოწ.',   en: 'Start Monthly',ru: 'Подписаться (мес)'},
    prem_start_yearly:{ ka: 'ყოველწ. გამოწ.',     en: 'Start Yearly', ru: 'Подписаться (год)'},
    prem_included:    { ka: 'ყველაფერი შედის:',   en: 'Everything included:',ru: 'Всё включено:'},
    prem_cancel:      { ka: 'გაუქმება ნებისმიერ დროს.',en: 'Cancel anytime.',ru: 'Отмена в любое время.'},
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
