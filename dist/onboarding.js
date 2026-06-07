/* ================================================================
   GeoHub — Onboarding / Sign-up Flow
   ================================================================ */

// ── i18n ─────────────────────────────────────────────────────────

var OB_DICT = {
  ka: {
    ob_welcome_sub: 'დააყენე პროფილი 2 წუთში — მიიღე პერსონ. ფიდი, სტარტ. ჩელენჯები და ჯილდოები.',
    ob_chip_xp: 'XP რეალური აქტ-ბისთვის', ob_chip_rewards: 'პერს. ჯილდოები',
    ob_chip_groups: 'ჯგუფების შ-ბა', ob_chip_ai: 'AI გეგმა მზ.', ob_chip_biz: 'ბიზნეს ინსტ.',
    ob_get_started: 'დაწყება — უფასოა', ob_already: 'უკვე გაქვს? ფიდზე →',
    ob_photo_kicker: 'ნ. 1 — ფოტო', ob_photo_title: 'პროფ. ფოტოს დამატება',
    ob_photo_sub: 'ხალხი შეძლებს შენი ამოცნობას. ნებ. დ. ს. შ.', ob_choose_photo: 'ფოტოს არჩევა',
    ob_change_photo: 'ფოტოს შ-ვლა', ob_photo_ok: 'ფოტო არ-ლია',
    ob_id_kicker: 'ნ. 2 — იდ-ბა', ob_id_title: 'შ-ქ-ი შ. პ-ლი',
    ob_id_sub: 'მ-ი. სახ. და უნ. @ს-ხ. GeoHub-ისთ.', ob_firstname: 'სახელი', ob_lastname: 'გვარი',
    ob_username_lbl: 'მ-ხმ. სახელი', ob_username_hint: '— უნ. @სახელი',
    ob_fn_ph: 'მაგ. გიორგი', ob_ln_ph: 'მაგ. ბ-ძე', ob_un_ph: 'შ-ი_სახელი',
    ob_about_kicker: 'ნ. 3 — შ. შ-ბ.', ob_about_title: 'ცოტა შ. შ-ბ.',
    ob_about_sub: 'ეხ-ება გ-ბ. შ. გ-ბ-ს. მ. შ-ი ვ-ს ამ. ვინ ხ.',
    ob_birthday: 'დ. თარიღი', ob_gender: 'სქესი',
    ob_male: 'მამ-ბითი', ob_female: 'მდ-ბითი', ob_other: 'სხვა',
    ob_rescity: 'ქ. / სოფელი', ob_rescity_ph: 'მაგ. თბილისი',
    ob_acct_kicker: 'ნ. 4 — ანგ.', ob_acct_title: 'შ. ანგ.',
    ob_email_lbl: 'ელ-ფოსტა', ob_pwd_lbl: 'პაროლი', ob_pwd_hint: '(სურ. — ელ-ფ-ით შ-ს.)',
    ob_pwd_ph: 'მ. 8 სიმბ.', ob_cpwd_lbl: 'პ. დ-სტ.', ob_cpwd_ph: 'გ-ი-მ. პ.',
    ob_pwd_set: 'პ. უ. დ-ლია ამ ანგ-ზე.',
    ob_type_kicker: 'ნ. 5 — ტ-პი', ob_type_title: 'ვინ ხარ GeoHub-ზე?',
    ob_type_sub: 'GeoHub ა-ა შ-ს ფ-ს, ჩ-ბებს და ხ-ლ-ებს შ. როლ-ის მ.',
    ob_type_user: 'ჩვ. მომხ-ი', ob_type_user_desc: 'გ-ი ა-ები, ა-ე XP, ჩ-ი თ-ბ. ჯ-ბ-ში.',
    ob_type_user_f1: 'Discovery ფ.', ob_type_user_f2: 'XP & ჯ-ბ.', ob_type_user_f3: 'თ-ბ. ჯ-ბ.',
    ob_type_inf: 'ინფლ-ი', ob_type_inf_desc: 'გ-ე გ-ბ., ა-ე აუდ., ი-შ. ბ-ბ-თ.',
    ob_type_inf_f1: 'Creator ფ.', ob_type_inf_f2: 'აუდ. ანალ.', ob_type_inf_f3: 'ბ-ბ. თ-შ.',
    ob_int_kicker: 'ნ. 6 — ინტ-ბ.', ob_int_title: 'რა გ-ბ?',
    ob_int_sub: 'ფ., AI, ჩ-ბ., ჯ-ბ. — შ-ი ინ-ბ-ის მ.',
    ob_int_min: 'მ. 1', ob_int_none: 'ჯ. ა-ლ — მ. 1 ირ-ე', ob_int_n: ' ინტ. ა-ლი ✓',
    ob_city_kicker: 'ნ. 7 — ზ-ბ.', ob_city_title: 'საქ. რ. ნ. გ-ბ?',
    ob_city_sub: 'სქ. პ-ია. "მ. სქ." = ნ-ცი. ფ.',
    ob_goal_kicker: 'ნ. 8 — მ-ბ.', ob_goal_title: 'რ. მ-ვ-ა გ-ა?',
    ob_goal_sub: 'ჩ-ბ., ჯ-ბ., რ-ები — მ-ბ-ის მ. ო-ბ.',
    ob_goal_min: 'მ. 2',
    ob_notif_kicker: 'ნ. 9 — შ-ბ.', ob_notif_title: 'დ. განახ.',
    ob_notif_follows: 'ახ. ფ-ბ. & რ-ქ.', ob_notif_deals: 'ლ. ფ-ები',
    ob_notif_xp: 'XP მ. & ჩ-ბ.', ob_notif_enable: 'შ. ჩ-ვა',
    ob_notif_enabled: 'შ-ბ. ჩ-ლია!', ob_notif_enabling: 'ჩ-ება…',
    ob_result_ready: 'GeoHub მ-ია!', ob_result_sub: 'ა-ვ-ეთ პ-ზ. პ-ლი.',
    ob_result_bonus: 'სარ. ბ.', ob_result_feed: 'რ-ლ. ფ.',
    ob_result_groups: 'შ-ლ. ჯ-ბ.', ob_result_challenges: 'სტ. ჩ-ბ.',
    ob_result_rewards: 'პ-ლი ჯ-ბ.', ob_result_ai: 'AI ა. მ-ია',
    ob_result_ai_try: 'სც.', ob_start: 'GeoHub-ის დ-ყება',
    ob_continue: 'გ-ება', ob_back: 'უ-ნ', ob_skip: 'გ-ება',
    ob_build: 'ჩ. პ-ლ. ა-ბა',
    ob_wb_badge: 'პ-ლი უ. გ-ქ.', ob_wb_back: 'კ-ი ი. მ-ბ-ება',
    ob_wb_continue: 'GeoHub-ში გ-ებ.', ob_wb_restart: 'ხ-ლა',
    t_fn: 'შ-ი-ვ. სახ.', t_ln: 'შ-ი-ვ. გ-ი.', t_un: 'მ. 3 სიმ.',
    t_taken: 'დ-ბ. — სხ. ა-ბ.', t_checking: 'მ-ება…',
    t_bday: 'შ-ი. დ. თ.', t_gender: 'შ-ი სქ. ა-ბ.', t_city: 'შ-ი ქ/სფ.',
    t_type: 'ა-ბ. ტ-პი.', t_ints: 'მ. 1 ინტ.', t_areas: 'ა-ბ. ზ-ა.',
    t_goals: 'მ. 2 მ-ი.', t_pwd_len: 'მ. 8 სიმ.', t_pwd_match: 'პ-ბ. ა. ე-ბ.',
  },
  en: {
    ob_welcome_sub: 'Set up your profile in 2 minutes and get a personalized feed, starter challenges, and real rewards.',
    ob_chip_xp: 'XP for real activity', ob_chip_rewards: 'Personalized rewards',
    ob_chip_groups: 'Matched groups', ob_chip_ai: 'AI plan ready', ob_chip_biz: 'Business tools',
    ob_get_started: "Get Started — it's free", ob_already: 'Already set up? Go to feed →',
    ob_photo_kicker: 'Step 1 — Your Photo', ob_photo_title: 'Add a profile photo',
    ob_photo_sub: 'Help people recognise you. You can always change it later.',
    ob_choose_photo: 'Choose Photo', ob_change_photo: 'Change Photo', ob_photo_ok: 'Photo selected',
    ob_id_kicker: 'Step 2 — Identity', ob_id_title: 'Create your profile',
    ob_id_sub: 'Set your name and a unique username for GeoHub.',
    ob_firstname: 'First Name', ob_lastname: 'Last Name',
    ob_username_lbl: 'Username', ob_username_hint: '— unique @handle',
    ob_fn_ph: 'e.g. Giorgi', ob_ln_ph: 'e.g. Beridze', ob_un_ph: 'your_handle',
    ob_about_kicker: 'Step 3 — About You', ob_about_title: 'A bit about you',
    ob_about_sub: 'Helps personalize your experience. Only you control who sees this.',
    ob_birthday: 'Date of Birth', ob_gender: 'Gender',
    ob_male: 'Male', ob_female: 'Female', ob_other: 'Other',
    ob_rescity: 'City / Village', ob_rescity_ph: 'e.g. Tbilisi',
    ob_acct_kicker: 'Step 4 — Account', ob_acct_title: 'Your account',
    ob_email_lbl: 'Email address', ob_pwd_lbl: 'Password',
    ob_pwd_hint: '(optional — lets you also log in with email)',
    ob_pwd_ph: 'Min. 8 characters', ob_cpwd_lbl: 'Confirm password',
    ob_cpwd_ph: 'Repeat password', ob_pwd_set: 'Password is already set for this account.',
    ob_type_kicker: 'Step 5 — Account Type', ob_type_title: 'Who are you on GeoHub?',
    ob_type_sub: 'GeoHub will tailor your feed, challenges, and tools to your role.',
    ob_type_user: 'Regular User', ob_type_user_desc: 'Explore places, earn XP, and join community groups.',
    ob_type_user_f1: 'Discovery feed', ob_type_user_f2: 'XP & rewards', ob_type_user_f3: 'Community groups',
    ob_type_inf: 'Influencer', ob_type_inf_desc: 'Share guides, build your audience, and collaborate with brands.',
    ob_type_inf_f1: 'Creator feed', ob_type_inf_f2: 'Audience analytics', ob_type_inf_f3: 'Brand collaborations',
    ob_int_kicker: 'Step 6 — Interests', ob_int_title: 'What are you into?',
    ob_int_sub: 'Your feed, AI suggestions, challenges, and groups will be built around your interests.',
    ob_int_min: 'Pick at least 1', ob_int_none: 'Nothing selected yet — pick at least 1',
    ob_int_n: ' interest(s) selected ✓',
    ob_city_kicker: 'Step 7 — Areas', ob_city_title: 'Which parts of Georgia interest you?',
    ob_city_sub: 'Georgia is small. Choose <strong>All Georgia</strong> for a nationwide feed, or select several cities.',
    ob_goal_kicker: 'Step 8 — Goals', ob_goal_title: 'What do you want to achieve?',
    ob_goal_sub: 'Your challenges, rewards, and recommendations will be optimized for your goals.',
    ob_goal_min: 'Pick at least 2',
    ob_notif_kicker: 'Step 9 — Notifications', ob_notif_title: 'Stay in the loop',
    ob_notif_follows: 'New followers & reactions', ob_notif_deals: 'Exclusive local deals',
    ob_notif_xp: 'XP milestones & challenges', ob_notif_enable: 'Enable Notifications',
    ob_notif_enabled: 'Notifications already enabled!', ob_notif_enabling: 'Enabling…',
    ob_result_ready: 'Your GeoHub is ready!', ob_result_sub: 'We built a personalized profile based on your choices.',
    ob_result_bonus: 'Signup bonus', ob_result_feed: 'Recommended Feed',
    ob_result_groups: 'Suggested Groups', ob_result_challenges: 'Starter Challenges',
    ob_result_rewards: 'First Rewards to Unlock', ob_result_ai: 'AI Assistant Pre-loaded',
    ob_result_ai_try: 'Try asking', ob_start: 'Start Exploring GeoHub',
    ob_continue: 'Continue', ob_back: 'Back', ob_skip: 'Skip', ob_build: 'Build My Profile',
    ob_wb_badge: 'Profile already set up', ob_wb_back: 'Welcome back',
    ob_wb_continue: 'Continue to GeoHub', ob_wb_restart: 'Restart Setup',
    t_fn: 'Enter your first name.', t_ln: 'Enter your last name.',
    t_un: 'Username must be at least 3 characters.',
    t_taken: 'That username is taken — choose another.',
    t_checking: 'Checking username — please wait.',
    t_bday: 'Please enter your date of birth.',
    t_gender: 'Please select your gender.',
    t_city: 'Please enter your city or village.',
    t_type: 'Choose an account type to continue.',
    t_ints: 'Pick at least 1 interest.',
    t_areas: 'Choose at least one area, or select All Georgia.',
    t_goals: 'Pick at least 2 goals.',
    t_pwd_len: 'Password must be at least 8 characters.',
    t_pwd_match: 'Passwords do not match.',
  },
  ru: {
    ob_welcome_sub: 'Настройте профиль за 2 минуты — персональная лента, задания и награды.',
    ob_chip_xp: 'XP за реальную активность', ob_chip_rewards: 'Персональные награды',
    ob_chip_groups: 'Подобранные группы', ob_chip_ai: 'AI-план готов',
    ob_chip_biz: 'Бизнес-инструменты',
    ob_get_started: 'Начать — бесплатно', ob_already: 'Уже готово? На ленту →',
    ob_photo_kicker: 'Шаг 1 — Фото', ob_photo_title: 'Добавьте фото профиля',
    ob_photo_sub: 'Помогите другим узнать вас. Можно изменить позже.',
    ob_choose_photo: 'Выбрать фото', ob_change_photo: 'Изменить фото',
    ob_photo_ok: 'Фото выбрано',
    ob_id_kicker: 'Шаг 2 — Личность', ob_id_title: 'Создайте профиль',
    ob_id_sub: 'Укажите имя и уникальный username для GeoHub.',
    ob_firstname: 'Имя', ob_lastname: 'Фамилия',
    ob_username_lbl: 'Username', ob_username_hint: '— уникальный @ник',
    ob_fn_ph: 'напр. Гиорги', ob_ln_ph: 'напр. Беридзе', ob_un_ph: 'ваш_ник',
    ob_about_kicker: 'Шаг 3 — О вас', ob_about_title: 'Немного о вас',
    ob_about_sub: 'Помогает персонализировать опыт. Только вы управляете видимостью.',
    ob_birthday: 'Дата рождения', ob_gender: 'Пол',
    ob_male: 'Мужской', ob_female: 'Женский', ob_other: 'Другой',
    ob_rescity: 'Город / Деревня', ob_rescity_ph: 'напр. Тбилиси',
    ob_acct_kicker: 'Шаг 4 — Аккаунт', ob_acct_title: 'Ваш аккаунт',
    ob_email_lbl: 'Эл. почта', ob_pwd_lbl: 'Пароль',
    ob_pwd_hint: '(необязательно — для входа по почте)',
    ob_pwd_ph: 'Мин. 8 символов', ob_cpwd_lbl: 'Повтор пароля',
    ob_cpwd_ph: 'Повторите пароль', ob_pwd_set: 'Пароль уже установлен для этого аккаунта.',
    ob_type_kicker: 'Шаг 5 — Тип аккаунта', ob_type_title: 'Кто вы на GeoHub?',
    ob_type_sub: 'GeoHub адаптирует ленту, задания и инструменты под вашу роль.',
    ob_type_user: 'Обычный пользователь',
    ob_type_user_desc: 'Исследуйте места, зарабатывайте XP и вступайте в группы.',
    ob_type_user_f1: 'Лента Discovery', ob_type_user_f2: 'XP и награды',
    ob_type_user_f3: 'Группы сообщества',
    ob_type_inf: 'Инфлюенсер',
    ob_type_inf_desc: 'Делитесь гайдами, стройте аудиторию и сотрудничайте с брендами.',
    ob_type_inf_f1: 'Лента Creator', ob_type_inf_f2: 'Аналитика аудитории',
    ob_type_inf_f3: 'Сотрудничество с брендами',
    ob_int_kicker: 'Шаг 6 — Интересы', ob_int_title: 'Что вас интересует?',
    ob_int_sub: 'Лента, AI, задания и группы — под ваши интересы.',
    ob_int_min: 'Выберите хотя бы 1',
    ob_int_none: 'Ничего не выбрано — выберите хотя бы 1',
    ob_int_n: ' интерес(а) выбрано ✓',
    ob_city_kicker: 'Шаг 7 — Регионы', ob_city_title: 'Какие части Грузии интересуют?',
    ob_city_sub: 'Грузия небольшая. Выберите <strong>Вся Грузия</strong> для общей ленты.',
    ob_goal_kicker: 'Шаг 8 — Цели', ob_goal_title: 'Чего хотите достичь?',
    ob_goal_sub: 'Задания, награды и рекомендации будут оптимизированы под ваши цели.',
    ob_goal_min: 'Выберите хотя бы 2',
    ob_notif_kicker: 'Шаг 9 — Уведомления', ob_notif_title: 'Будьте в курсе',
    ob_notif_follows: 'Новые подписчики и реакции', ob_notif_deals: 'Эксклюзивные скидки рядом',
    ob_notif_xp: 'Вехи XP и задания', ob_notif_enable: 'Включить уведомления',
    ob_notif_enabled: 'Уведомления уже включены!', ob_notif_enabling: 'Включение…',
    ob_result_ready: 'Ваш GeoHub готов!',
    ob_result_sub: 'Мы создали персонализированный профиль на основе ваших ответов.',
    ob_result_bonus: 'Бонус за регистрацию', ob_result_feed: 'Рекомендованная лента',
    ob_result_groups: 'Предложенные группы', ob_result_challenges: 'Начальные задания',
    ob_result_rewards: 'Первые награды', ob_result_ai: 'AI-ассистент настроен',
    ob_result_ai_try: 'Попробуйте спросить', ob_start: 'Начать исследовать GeoHub',
    ob_continue: 'Продолжить', ob_back: 'Назад', ob_skip: 'Пропустить',
    ob_build: 'Создать профиль',
    ob_wb_badge: 'Профиль уже настроен', ob_wb_back: 'Добро пожаловать обратно',
    ob_wb_continue: 'Продолжить в GeoHub', ob_wb_restart: 'Перезапустить',
    t_fn: 'Введите имя.', t_ln: 'Введите фамилию.',
    t_un: 'Минимум 3 символа.',
    t_taken: 'Логин занят — выберите другой.',
    t_checking: 'Проверка — подождите.',
    t_bday: 'Введите дату рождения.',
    t_gender: 'Выберите пол.',
    t_city: 'Введите город или деревню.',
    t_type: 'Выберите тип аккаунта.',
    t_ints: 'Выберите хотя бы 1 интерес.',
    t_areas: 'Выберите хотя бы один регион.',
    t_goals: 'Выберите хотя бы 2 цели.',
    t_pwd_len: 'Пароль — минимум 8 символов.',
    t_pwd_match: 'Пароли не совпадают.',
  }
};

function obT(key) {
  var lang;
  try { lang = localStorage.getItem('gh_lang') || 'ka'; } catch(e) { lang = 'ka'; }
  var d = OB_DICT[lang] || OB_DICT['en'];
  return d[key] || OB_DICT['en'][key] || key;
}

function obLang(l) {
  try { localStorage.setItem('gh_lang', l); } catch(e) {}
  document.querySelectorAll('.ob-lang-btn').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-lang') === l);
  });
  renderStep(obState.step);
}

// ── DATA ─────────────────────────────────────────────────────────

const OB_DATA = {
  accountTypes: [
    { id: 'user',       icon: 'fas fa-compass',             color: '#10b981' },
    { id: 'influencer', icon: 'fas fa-wand-magic-sparkles', color: '#a855f7' },
  ],

  interests: [
    { id: 'cafes',       label: 'Cafés',         icon: 'fas fa-mug-hot' },
    { id: 'hiking',      label: 'Hiking',         icon: 'fas fa-person-hiking' },
    { id: 'events',      label: 'Events',         icon: 'fas fa-ticket' },
    { id: 'nightlife',   label: 'Nightlife',      icon: 'fas fa-moon' },
    { id: 'learning',    label: 'Learning',       icon: 'fas fa-book-open' },
    { id: 'fitness',     label: 'Fitness',        icon: 'fas fa-dumbbell' },
    { id: 'realestate',  label: 'Real Estate',    icon: 'fas fa-house' },
    { id: 'services',    label: 'Services',       icon: 'fas fa-wrench' },
    { id: 'travel',      label: 'Travel',         icon: 'fas fa-plane' },
    { id: 'photography', label: 'Photography',    icon: 'fas fa-camera' },
    { id: 'discounts',   label: 'Discounts',      icon: 'fas fa-tag' },
    { id: 'community',   label: 'Community',      icon: 'fas fa-hand-holding-heart' },
  ],

  cities: [
    { id: 'all_georgia', name: 'All Georgia', region: 'Nationwide feed', emoji: '🇬🇪' },
    { id: 'tbilisi',   name: 'Tbilisi',   region: 'Capital',     emoji: '🏛️' },
    { id: 'batumi',    name: 'Batumi',    region: 'Adjara',      emoji: '🌊' },
    { id: 'kutaisi',   name: 'Kutaisi',   region: 'Imereti',     emoji: '🏔️' },
    { id: 'rustavi',   name: 'Rustavi',   region: 'Kvemo Kartli',emoji: '🏙️' },
    { id: 'gori',      name: 'Gori',      region: 'Shida Kartli',emoji: '🌄' },
    { id: 'zugdidi',   name: 'Zugdidi',   region: 'Samegrelo',   emoji: '🌿' },
    { id: 'telavi',    name: 'Telavi',    region: 'Kakheti',     emoji: '🍇' },
    { id: 'kobuleti',  name: 'Kobuleti',  region: 'Adjara',      emoji: '🏖️' },
  ],

  goals: [
    { id: 'discover',  label: 'Discover places',   icon: 'fas fa-compass',         desc: 'Find hidden gems and trending spots.' },
    { id: 'rewards',   label: 'Earn rewards',       icon: 'fas fa-gift',            desc: 'Unlock discounts, XP, and partner perks.' },
    { id: 'meet',      label: 'Meet people',        icon: 'fas fa-users',           desc: 'Join groups and connect with locals.' },
    { id: 'audience',  label: 'Grow audience',      icon: 'fas fa-chart-line',      desc: 'Build following through real-world content.' },
    { id: 'promote',   label: 'Promote business',   icon: 'fas fa-bullhorn',        desc: 'Reach customers and run local campaigns.' },
    { id: 'learn',     label: 'Learn skills',       icon: 'fas fa-graduation-cap',  desc: 'Complete courses, workshops, challenges.' },
    { id: 'services',  label: 'Find services',      icon: 'fas fa-magnifying-glass',desc: 'Hire trusted local professionals.' },
    { id: 'attend',    label: 'Attend events',      icon: 'fas fa-calendar-check',  desc: 'Find and RSVP to events near you.' },
  ],
};

// ── STATE ─────────────────────────────────────────────────────────

const obState = {
  step: 1,
  firstName: '', lastName: '', username: '', usernameStatus: '',
  birthday: '', gender: '', residentialCity: '', password: '',
  accountType: null,
  interests: [],
  city: 'all_georgia',
  cities: ['all_georgia'],
  cityScope: 'all_georgia',
  goals: [],
};

const TOTAL_STEPS = 11;

// ── PERSONALIZATION MAPS ─────────────────────────────────────────

const FEED_TYPES = {
  user:       { label: 'Discovery Feed',   icon: 'fas fa-compass',             desc: 'Places, events, check-ins, challenges, community posts.' },
  influencer: { label: 'Creator Feed',     icon: 'fas fa-wand-magic-sparkles', desc: 'Trending content, collab opportunities, engagement metrics.' },
  // legacy types kept for existing accounts
  explorer:   { label: 'Discovery Feed',   icon: 'fas fa-compass',             desc: 'Places, events, check-ins, challenges, creator posts.' },
  creator:    { label: 'Creator Feed',     icon: 'fas fa-wand-magic-sparkles', desc: 'Trending content, collab opportunities, engagement.' },
  business:   { label: 'Business Hub',     icon: 'fas fa-store',               desc: 'Campaigns, customer visits, analytics, offers.' },
  teacher:    { label: 'Learning Hub',     icon: 'fas fa-graduation-cap',      desc: 'Workshops, study groups, skill challenges, courses.' },
  service:    { label: 'Services Feed',    icon: 'fas fa-wrench',              desc: 'Client requests, reviews, local service demand.' },
  realestate: { label: 'Property Feed',    icon: 'fas fa-house',               desc: 'Listings, market trends, open houses, inquiries.' },
  events:     { label: 'Events Hub',       icon: 'fas fa-calendar-days',       desc: 'Event creation, RSVPs, promotions, live coverage.' },
};

const GROUP_MAP = {
  cafes:       { name: 'Tbilisi Coffee Lovers',    members: '1.2K' },
  hiking:      { name: 'Georgia Trail Runners',     members: '840'  },
  events:      { name: 'City Event Crew',           members: '2.1K' },
  nightlife:   { name: 'Nightlife Tbilisi',         members: '680'  },
  learning:    { name: 'GeoHub Learners',           members: '520'  },
  fitness:     { name: 'Fitness Challengers',       members: '940'  },
  realestate:  { name: 'Georgia Property Network',  members: '320'  },
  services:    { name: 'Local Services Hub',        members: '410'  },
  travel:      { name: 'Georgia Explorers',         members: '1.8K' },
  photography: { name: 'GeoHub Photo Club',         members: '760'  },
  discounts:   { name: 'Deal Hunters',              members: '1.5K' },
  community:   { name: 'Patriot Community',         members: '890'  },
};

const CHALLENGE_MAP = {
  user:       ['First Check-in',        'Visit 5 Different Cafés',    'Explore 3 City Districts'],
  influencer: ['Post Your First Guide', 'Get 10 Saves on a Post',     'Collaborate with a Business'],
  // legacy
  explorer:   ['First Check-in',        'Visit 5 Different Cafés',    'Explore 3 City Districts'],
  creator:    ['Post Your First Guide', 'Get 10 Saves on a Post',     'Collaborate with a Business'],
  business:   ['Set Up Your Business Page','Launch Your First Offer', 'Reach 10 Verified Visitors'],
  teacher:    ['Share a Learning Resource','Host Your First Workshop','Gain 5 Followers'],
  service:    ['List Your First Service','Get Your First Client Review','Earn a 5-Star Rating'],
  realestate: ['List Your First Property','Get 3 Inquiries',          'Host a Virtual Tour'],
  events:     ['Create Your First Event','Get 20 RSVPs',              'Run a Live Event'],
};

const CHALLENGE_XP = [50, 80, 120];

const REWARD_MAP = {
  cafes:       { emoji: '☕', label: 'Free coffee at partner cafes',  pts: 50  },
  hiking:      { emoji: '🥾', label: 'Trail guide PDF unlock',         pts: 80  },
  events:      { emoji: '🎟️', label: 'Event ticket 20% discount',      pts: 100 },
  nightlife:   { emoji: '🌙', label: 'Nightlife fast-entry pass',       pts: 120 },
  learning:    { emoji: '📚', label: 'Premium course access',           pts: 90  },
  fitness:     { emoji: '💪', label: 'Gym day pass at partner',         pts: 100 },
  realestate:  { emoji: '🏠', label: 'Property market report',          pts: 150 },
  services:    { emoji: '🔧', label: 'Service voucher (20 GEL off)',     pts: 80  },
  travel:      { emoji: '✈️', label: 'Georgia travel guide unlock',      pts: 60  },
  photography: { emoji: '📷', label: 'Photo contest entry ticket',       pts: 70  },
  discounts:   { emoji: '🏷️', label: '20% off at partner store',         pts: 40  },
  community:   { emoji: '🤝', label: 'Community Pioneer badge',          pts: 30  },
};

function getAiSuggestion(city, interests, accountType) {
  const cityName = city === 'all_georgia' ? 'all Georgia' : (OB_DATA.cities.find(c => c.id === city)?.name || city || 'Georgia');
  const interest = OB_DATA.interests.find(i => i.id === interests[0])?.label || 'exploration';
  if (accountType === 'business') return `"Help me attract more customers to my ${cityName} business this week with XP rewards."`;
  if (accountType === 'influencer' || accountType === 'creator') return `"Plan a content creation day in ${cityName} focused on ${interest} — maximize reach and XP."`;
  if (accountType === 'events') return `"What events are trending in ${cityName} this weekend and how can I promote mine?"`;
  return `"Plan my perfect ${interest.toLowerCase()} day in ${cityName} under 40 GEL with XP stops."`;
}

// ── INIT ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
  // Init lang switcher active state
  var curLang;
  try { curLang = localStorage.getItem('gh_lang') || 'ka'; } catch(e) { curLang = 'ka'; }
  document.querySelectorAll('.ob-lang-btn').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-lang') === curLang);
  });

  const saved = window.safeStorage ? JSON.stringify(window.safeStorage.get('geohub_onboarding', null)) : null;
  if (saved) {
    try {
      const data = JSON.parse(saved);
      if (data && data.accountType) {
        renderWelcomeBack(data);
        return;
      }
    } catch (e) { /* ignore corrupt data */ }
  }
  // Pre-fill obState from existing user profile (Google/Facebook users already have some fields)
  var u = window.GeoCurrentUser;
  if (u) {
    var np = (u.fullName || '').trim().split(/\s+/);
    if (!obState.firstName && np[0]) obState.firstName = np[0];
    if (!obState.lastName && np.length > 1) obState.lastName = np.slice(1).join(' ');
    if (!obState.username && u.username) { obState.username = u.username; obState.usernameStatus = 'available'; }
    if (!obState.birthday && u.birthday) obState.birthday = u.birthday;
    if (!obState.gender && u.gender)     obState.gender = u.gender;
    if (!obState.residentialCity && u.city) obState.residentialCity = u.city;
    if (!obState.accountType && u.accountType) obState.accountType = u.accountType;
    if (!obState.interests.length && u.interests && u.interests.length) obState.interests = u.interests.slice();
    if (u.cities && u.cities.length) obState.cities = u.cities.slice();
  }
  renderStep(1);
});

// ── NAVIGATION ───────────────────────────────────────────────────

function obNext() {
  if (!validateStep(obState.step)) return;
  if (obState.step === TOTAL_STEPS - 1) {
    var profile = computeProfile();
    saveToStorage(profile);
    renderStep(TOTAL_STEPS);
  } else if (obState.step < TOTAL_STEPS) {
    renderStep(obState.step + 1);
  }
}

function obBack() {
  if (obState.step > 1) renderStep(obState.step - 1);
}

function obSkip() {
  if (obState.step === 5) { obState.password = ''; }
  if (obState.step === 7) { obState.interests = []; }
  if (obState.step === 9) { obState.goals = []; }
  // Advance directly, bypassing validation
  if (obState.step === TOTAL_STEPS - 1) {
    var profile = computeProfile();
    saveToStorage(profile);
    renderStep(TOTAL_STEPS);
  } else if (obState.step < TOTAL_STEPS) {
    renderStep(obState.step + 1);
  }
}

// ── VALIDATION ───────────────────────────────────────────────────

function validateStep(step) {
  if (step === 3) {
    var fn = ((document.getElementById('ob-firstname') || {}).value || obState.firstName || '').trim();
    var ln = ((document.getElementById('ob-lastname')  || {}).value || obState.lastName  || '').trim();
    var un = obState.username || '';
    if (!fn) { showToast(obT('t_fn')); return false; }
    if (!ln) { showToast(obT('t_ln')); return false; }
    if (un.length < 3) { showToast(obT('t_un')); return false; }
    if (obState.usernameStatus === 'taken')    { showToast(obT('t_taken')); return false; }
    if (obState.usernameStatus === 'checking') { showToast(obT('t_checking')); return false; }
    obState.firstName = fn; obState.lastName = ln;
    return true;
  }
  if (step === 4) {
    var bd = document.getElementById('ob-birthday'); if (bd) obState.birthday = bd.value;
    var rc = document.getElementById('ob-rescity');  if (rc) obState.residentialCity = rc.value.trim();
    // gender is set via obSelectGender(), already in obState
    if (!obState.birthday)        { showToast(obT('t_bday')); return false; }
    if (!obState.gender)          { showToast(obT('t_gender')); return false; }
    if (!obState.residentialCity) { showToast(obT('t_city')); return false; }
    return true;
  }
  if (step === 5) {
    var pw1 = document.getElementById('ob-password');
    var pw2 = document.getElementById('ob-password2');
    if (pw1 && pw1.value) {
      if (pw1.value.length < 8) { showToast(obT('t_pwd_len')); return false; }
      if (pw2 && pw1.value !== pw2.value) { showToast(obT('t_pwd_match')); return false; }
      obState.password = pw1.value;
    }
    return true;
  }
  if (step === 6 && !obState.accountType) {
    showToast(obT('t_type'));
    return false;
  }
  if (step === 7 && obState.interests.length < 1) {
    showToast(obT('t_ints'));
    return false;
  }
  if (step === 8 && (!obState.cities || !obState.cities.length)) {
    showToast(obT('t_areas'));
    return false;
  }
  if (step === 9 && obState.goals.length < 2) {
    showToast(obT('t_goals'));
    return false;
  }
  return true;
}

// ── STEP RENDERER ─────────────────────────────────────────────────

function renderStep(n) {
  obState.step = n;
  updateHeader(n);

  const content = document.getElementById('ob-step-content');
  content.style.opacity = '0';
  content.style.transform = 'translateX(16px)';

  setTimeout(function () {
    switch (n) {
      case 1:  content.innerHTML = renderWelcome(); break;
      case 2:  content.innerHTML = renderPhoto(); break;
      case 3:  content.innerHTML = renderIdentity(); break;
      case 4:  content.innerHTML = renderAboutYou(); break;
      case 5:  content.innerHTML = renderAccountInfo(); break;
      case 6:  content.innerHTML = renderAccountType(); break;
      case 7:  content.innerHTML = renderInterests(); break;
      case 8:  content.innerHTML = renderCity(); break;
      case 9:  content.innerHTML = renderGoals(); break;
      case 10: content.innerHTML = renderNotifPermission(); break;
      case 11: content.innerHTML = renderResult(); break;
    }
    content.style.transition = 'opacity 0.26s ease, transform 0.26s ease';
    content.style.opacity = '1';
    content.style.transform = 'translateX(0)';
    bindStep(n);
  }, 180);
}

// ── HEADER UPDATE ─────────────────────────────────────────────────

function updateHeader(step) {
  var fill = document.getElementById('ob-progress-fill');
  var label = document.getElementById('ob-step-label');
  var nav = document.getElementById('ob-nav');
  var back = document.getElementById('ob-back-btn');
  var skip = document.getElementById('ob-skip-btn');
  var next = document.getElementById('ob-next-btn');

  var pct = Math.round(((step - 1) / (TOTAL_STEPS - 1)) * 100);
  fill.style.width = pct + '%';

  label.textContent = step > 1 && step < TOTAL_STEPS ? ('Step ' + (step - 1) + ' of ' + (TOTAL_STEPS - 2)) : '';

  if (step === 1 || step === TOTAL_STEPS) {
    nav.style.display = 'none';
  } else {
    nav.style.display = 'flex';
    back.style.display = step === 2 ? 'none' : 'inline-flex';
    back.innerHTML = '<i class="fas fa-arrow-left"></i> ' + obT('ob_back');
    skip.style.display = (step === 2 || step === 5 || step === 7 || step === 9 || step === 10) ? 'block' : 'none';
    skip.textContent = obT('ob_skip');
    next.innerHTML = step === TOTAL_STEPS - 1
      ? '<i class="fas fa-wand-magic-sparkles" style="margin-right:6px"></i> ' + obT('ob_build')
      : obT('ob_continue') + ' <i class="fas fa-arrow-right" style="margin-left:6px"></i>';
  }
}

// ── STEP 1: WELCOME ───────────────────────────────────────────────

function renderWelcome() {
  return '<div class="ob-welcome">' +
    '<img src="icons/icon-192.png" alt="GeoHub" style="width:80px;height:80px;border-radius:22px;object-fit:cover;box-shadow:0 8px 32px rgba(16,185,129,.3);margin-bottom:16px">' +
    '<h1>Welcome to <span class="hl">GeoHub</span></h1>' +
    '<p>' + obT('ob_welcome_sub') + '</p>' +
    '<div class="ob-feature-chips">' +
      '<span class="ob-feature-chip"><i class="fas fa-bolt"></i> ' + obT('ob_chip_xp') + '</span>' +
      '<span class="ob-feature-chip"><i class="fas fa-gift"></i> ' + obT('ob_chip_rewards') + '</span>' +
      '<span class="ob-feature-chip"><i class="fas fa-users"></i> ' + obT('ob_chip_groups') + '</span>' +
      '<span class="ob-feature-chip"><i class="fas fa-wand-magic-sparkles"></i> ' + obT('ob_chip_ai') + '</span>' +
      '<span class="ob-feature-chip"><i class="fas fa-chart-line"></i> ' + obT('ob_chip_biz') + '</span>' +
    '</div>' +
    '<div class="ob-welcome-cta">' +
      '<button class="ob-start-btn" onclick="renderStep(2)">' +
        '<i class="fas fa-arrow-right"></i> ' + obT('ob_get_started') +
      '</button>' +
      '<a href="feed.html" class="ob-already-link">' + obT('ob_already') + '</a>' +
    '</div>' +
  '</div>';
}

// ── STEP 2: PROFILE PHOTO ─────────────────────────────────────────

function renderPhoto() {
  var preview = obState.photoURL || '';
  return '<div class="ob-step-header">' +
    '<div class="ob-step-kicker">' + obT('ob_photo_kicker') + '</div>' +
    '<h2>' + obT('ob_photo_title') + '</h2>' +
    '<p>' + obT('ob_photo_sub') + '</p>' +
  '</div>' +
  '<div style="display:flex;flex-direction:column;align-items:center;gap:20px;padding:20px 0">' +
    '<div id="ob-photo-preview" style="width:110px;height:110px;border-radius:50%;background:rgba(16,185,129,.12);border:3px dashed rgba(16,185,129,.4);display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:pointer" onclick="document.getElementById(\'ob-photo-input\').click()">' +
      (preview
        ? '<img src="' + preview + '" style="width:100%;height:100%;object-fit:cover">'
        : '<i class="fas fa-camera" style="font-size:2rem;color:rgba(16,185,129,.6)"></i>') +
    '</div>' +
    '<input type="file" id="ob-photo-input" accept="image/*" style="display:none" onchange="obHandlePhoto(this)">' +
    '<button type="button" onclick="document.getElementById(\'ob-photo-input\').click()" style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);color:#10e0a0;border-radius:12px;padding:10px 24px;font-weight:700;cursor:pointer;font-size:.9rem">' +
      '<i class="fas fa-upload" style="margin-right:8px"></i>' + (preview ? obT('ob_change_photo') : obT('ob_choose_photo')) +
    '</button>' +
    (preview ? '<p style="color:#10b981;font-size:.85rem"><i class="fas fa-check-circle"></i> ' + obT('ob_photo_ok') + '</p>' : '') +
  '</div>';
}

function obHandlePhoto(input) {
  var file = input.files && input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    obState.photoFile = file;
    obState.photoURL = e.target.result;
    var preview = document.getElementById('ob-photo-preview');
    if (preview) preview.innerHTML = '<img src="' + e.target.result + '" style="width:100%;height:100%;object-fit:cover">';
  };
  reader.readAsDataURL(file);

  var formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', 'geohub_unsigned');
  formData.append('folder', 'geohub/avatars');
  fetch('https://api.cloudinary.com/v1_1/dw5dqk2w7/image/upload', { method: 'POST', body: formData })
    .then(function(r){ return r.json(); })
    .then(function(data){ if (data.secure_url) obState.photoCloudinaryURL = data.secure_url; })
    .catch(function(){});
}

// ── STEP 3: IDENTITY ─────────────────────────────────────────────

var _unCheckTimer = null;

function obCheckUsername(val) {
  var clean = val.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 30);
  obState.username = clean;
  var inp = document.getElementById('ob-username');
  if (inp && inp.value !== clean) inp.value = clean;
  var status = document.getElementById('ob-username-status');
  if (!status) return;
  clearTimeout(_unCheckTimer);
  if (clean.length < 3) {
    obState.usernameStatus = 'invalid';
    status.innerHTML = clean.length > 0 ? '<span style="color:#ef4444"><i class="fas fa-times-circle"></i> At least 3 characters required</span>' : '';
    return;
  }
  obState.usernameStatus = 'checking';
  status.innerHTML = '<span style="color:#94a3b8"><i class="fas fa-circle-notch fa-spin"></i> Checking…</span>';
  _unCheckTimer = setTimeout(function () {
    var geo = window.GeoFirebase, f = geo && geo.fs;
    if (!geo || !f) {
      obState.usernameStatus = 'available';
      status.innerHTML = '<span style="color:#10b981"><i class="fas fa-check-circle"></i> @' + clean + ' looks good</span>';
      return;
    }
    var q = f.query(f.collection(geo.db, 'users'), f.where('username', '==', clean), f.limit(2));
    f.getDocs(q).then(function (snap) {
      var currentUid = window.GeoCurrentUser && window.GeoCurrentUser.uid;
      var taken = false;
      snap.forEach(function (d) { if (d.id !== currentUid) taken = true; });
      if (taken) {
        obState.usernameStatus = 'taken';
        status.innerHTML = '<span style="color:#ef4444"><i class="fas fa-times-circle"></i> This username is taken — try another</span>';
      } else {
        obState.usernameStatus = 'available';
        status.innerHTML = '<span style="color:#10b981"><i class="fas fa-check-circle"></i> @' + clean + ' is available</span>';
      }
    }).catch(function () {
      obState.usernameStatus = 'available';
      status.innerHTML = '<span style="color:#10b981"><i class="fas fa-check-circle"></i> @' + clean + ' looks good</span>';
    });
  }, 600);
}

function obCheckPasswords() {
  var pw1 = document.getElementById('ob-password');
  var pw2 = document.getElementById('ob-password2');
  var st  = document.getElementById('ob-pw-status');
  if (!pw1 || !pw2 || !st) return;
  if (!pw1.value && !pw2.value) { st.innerHTML = ''; return; }
  if (pw1.value.length < 8) { st.innerHTML = '<span style="color:#f59e0b">At least 8 characters</span>'; return; }
  if (pw1.value !== pw2.value) { st.innerHTML = '<span style="color:#ef4444">Passwords do not match</span>'; return; }
  st.innerHTML = '<span style="color:#10b981"><i class="fas fa-check-circle"></i> Passwords match</span>';
}

function renderIdentity() {
  var fn = obState.firstName || '';
  var ln = obState.lastName  || '';
  var un = obState.username  || '';
  return '<div class="ob-step-header">' +
    '<div class="ob-step-kicker">' + obT('ob_id_kicker') + '</div>' +
    '<h2>' + obT('ob_id_title') + '</h2>' +
    '<p>' + obT('ob_id_sub') + '</p>' +
  '</div>' +
  '<div style="display:flex;flex-direction:column;gap:14px;max-width:440px;margin:0 auto">' +
    '<div style="display:flex;gap:12px">' +
      '<div style="flex:1">' +
        '<label style="display:block;font-size:.78rem;color:#94a3b8;margin-bottom:5px">' + obT('ob_firstname') + '</label>' +
        '<input type="text" id="ob-firstname" class="form-input" placeholder="' + obT('ob_fn_ph') + '" value="' + fn + '" oninput="obState.firstName=this.value.trim()">' +
      '</div>' +
      '<div style="flex:1">' +
        '<label style="display:block;font-size:.78rem;color:#94a3b8;margin-bottom:5px">' + obT('ob_lastname') + '</label>' +
        '<input type="text" id="ob-lastname" class="form-input" placeholder="' + obT('ob_ln_ph') + '" value="' + ln + '" oninput="obState.lastName=this.value.trim()">' +
      '</div>' +
    '</div>' +
    '<div>' +
      '<label style="display:block;font-size:.78rem;color:#94a3b8;margin-bottom:5px">' + obT('ob_username_lbl') + ' <span style="color:#64748b;font-weight:400;font-size:.75rem">' + obT('ob_username_hint') + '</span></label>' +
      '<div style="position:relative">' +
        '<span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#64748b;pointer-events:none">@</span>' +
        '<input type="text" id="ob-username" class="form-input" style="padding-left:28px" placeholder="' + obT('ob_un_ph') + '" value="' + un + '" oninput="obCheckUsername(this.value)" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false">' +
      '</div>' +
      '<div id="ob-username-status" style="margin-top:5px;font-size:.78rem;min-height:18px">' +
        (un.length >= 3 ? '<span style="color:#10b981"><i class="fas fa-check-circle"></i> @' + un + ' is available</span>' : '') +
      '</div>' +
    '</div>' +
  '</div>';
}

// ── STEP 4: ABOUT YOU ─────────────────────────────────────────────

function obSelectGender(g) {
  obState.gender = g;
  document.querySelectorAll('.ob-gender-pill').forEach(function(b) {
    b.classList.toggle('selected', b.getAttribute('data-g') === g);
  });
}

function renderAboutYou() {
  var maxDate = new Date(Date.now() - 13 * 365.25 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  var g = obState.gender || '';
  return '<div class="ob-step-header">' +
    '<div class="ob-step-kicker">' + obT('ob_about_kicker') + '</div>' +
    '<h2>' + obT('ob_about_title') + '</h2>' +
    '<p>' + obT('ob_about_sub') + '</p>' +
  '</div>' +
  '<div style="display:flex;flex-direction:column;gap:12px;max-width:480px;margin:0 auto">' +

    // Birthday card
    '<div class="ob-about-card">' +
      '<div class="ob-about-icon" style="background:rgba(239,68,68,.12);color:#f87171">' +
        '<i class="fas fa-cake-candles"></i>' +
      '</div>' +
      '<div class="ob-about-field">' +
        '<label>' + obT('ob_birthday') + '</label>' +
        '<input type="date" id="ob-birthday" class="form-input ob-date-input" max="' + maxDate + '" value="' + (obState.birthday || '') + '">' +
      '</div>' +
    '</div>' +

    // Gender card
    '<div class="ob-about-card">' +
      '<div class="ob-about-icon" style="background:rgba(168,85,247,.12);color:#c084fc">' +
        '<i class="fas fa-venus-mars"></i>' +
      '</div>' +
      '<div class="ob-about-field">' +
        '<label>' + obT('ob_gender') + '</label>' +
        '<div class="ob-gender-pills">' +
          '<button type="button" class="ob-gender-pill' + (g === 'male'   ? ' selected' : '') + '" data-g="male"   onclick="obSelectGender(\'male\')">'   + obT('ob_male')   + '</button>' +
          '<button type="button" class="ob-gender-pill' + (g === 'female' ? ' selected' : '') + '" data-g="female" onclick="obSelectGender(\'female\')">' + obT('ob_female') + '</button>' +
          '<button type="button" class="ob-gender-pill' + (g === 'other'  ? ' selected' : '') + '" data-g="other"  onclick="obSelectGender(\'other\')">'  + obT('ob_other')  + '</button>' +
        '</div>' +
      '</div>' +
    '</div>' +

    // City card
    '<div class="ob-about-card">' +
      '<div class="ob-about-icon" style="background:rgba(59,130,246,.12);color:#60a5fa">' +
        '<i class="fas fa-location-dot"></i>' +
      '</div>' +
      '<div class="ob-about-field">' +
        '<label>' + obT('ob_rescity') + '</label>' +
        '<input type="text" id="ob-rescity" class="form-input" placeholder="' + obT('ob_rescity_ph') + '" value="' + (obState.residentialCity || '') + '">' +
      '</div>' +
    '</div>' +

  '</div>';
}

// ── STEP 5: ACCOUNT INFO ──────────────────────────────────────────

function renderAccountInfo() {
  var fbUser = window.GeoFirebase && window.GeoFirebase.auth && window.GeoFirebase.auth.currentUser;
  var email = (fbUser && fbUser.email) || (window.GeoCurrentUser && window.GeoCurrentUser.email) || '';
  var hasPwd = false;
  if (fbUser && fbUser.providerData) {
    fbUser.providerData.forEach(function (p) { if (p.providerId === 'password') hasPwd = true; });
  }
  return '<div class="ob-step-header">' +
    '<div class="ob-step-kicker">' + obT('ob_acct_kicker') + '</div>' +
    '<h2>' + obT('ob_acct_title') + '</h2>' +
    '<p>' + (hasPwd ? obT('ob_acct_kicker').replace(/.*—\s*/, '') : obT('ob_pwd_hint').replace(/[()]/g,'')) + '</p>' +
  '</div>' +
  '<div style="display:flex;flex-direction:column;gap:14px;max-width:440px;margin:0 auto">' +
    '<div>' +
      '<label style="display:block;font-size:.78rem;color:#94a3b8;margin-bottom:5px">' + obT('ob_email_lbl') + '</label>' +
      '<input type="email" class="form-input" value="' + email + '" readonly style="opacity:.7;cursor:default;background:rgba(255,255,255,.06);color:var(--text-primary)">' +
    '</div>' +
    (hasPwd
      ? '<div style="background:rgba(16,185,129,.07);border:1px solid rgba(16,185,129,.2);border-radius:12px;padding:12px 16px;display:flex;align-items:center;gap:10px">' +
          '<i class="fas fa-lock" style="color:#10b981"></i>' +
          '<span style="font-size:.85rem;color:#94a3b8">' + obT('ob_pwd_set') + '</span>' +
        '</div>'
      : '<div>' +
          '<label style="display:block;font-size:.78rem;color:#94a3b8;margin-bottom:5px">' + obT('ob_pwd_lbl') + ' <span style="color:#64748b;font-weight:400;font-size:.75rem">' + obT('ob_pwd_hint') + '</span></label>' +
          '<input type="password" id="ob-password" class="form-input" placeholder="' + obT('ob_pwd_ph') + '" oninput="obCheckPasswords()">' +
        '</div>' +
        '<div>' +
          '<label style="display:block;font-size:.78rem;color:#94a3b8;margin-bottom:5px">' + obT('ob_cpwd_lbl') + '</label>' +
          '<input type="password" id="ob-password2" class="form-input" placeholder="' + obT('ob_cpwd_ph') + '" oninput="obCheckPasswords()">' +
          '<div id="ob-pw-status" style="margin-top:5px;font-size:.78rem;min-height:18px"></div>' +
        '</div>') +
  '</div>';
}

// ── STEP 6: ACCOUNT TYPE ──────────────────────────────────────────

function renderAccountType() {
  var sel = obState.accountType;
  var types = [
    {
      id: 'user', color: '#10b981', icon: 'fas fa-compass',
      lbl: obT('ob_type_user'), desc: obT('ob_type_user_desc'),
      features: [obT('ob_type_user_f1'), obT('ob_type_user_f2'), obT('ob_type_user_f3')]
    },
    {
      id: 'influencer', color: '#a855f7', icon: 'fas fa-wand-magic-sparkles',
      lbl: obT('ob_type_inf'), desc: obT('ob_type_inf_desc'),
      features: [obT('ob_type_inf_f1'), obT('ob_type_inf_f2'), obT('ob_type_inf_f3')]
    }
  ];

  var cards = types.map(function(t, i) {
    var isSel = sel === t.id;
    return '<div class="ob-type-big' + (isSel ? ' selected' : '') + '" onclick="selectType(\'' + t.id + '\',' + i + ')" style="--ob-color:' + t.color + '">' +
      '<div class="ob-type-big-check"><i class="fas fa-check"></i></div>' +
      '<div class="ob-type-big-icon"><i class="' + t.icon + '"></i></div>' +
      '<h3>' + t.lbl + '</h3>' +
      '<p>' + t.desc + '</p>' +
      '<div class="ob-type-big-features">' +
        t.features.map(function(f) { return '<span><i class="fas fa-check-circle"></i> ' + f + '</span>'; }).join('') +
      '</div>' +
    '</div>';
  }).join('');

  return '<div class="ob-step-header">' +
    '<div class="ob-step-kicker">' + obT('ob_type_kicker') + '</div>' +
    '<h2>' + obT('ob_type_title') + '</h2>' +
    '<p>' + obT('ob_type_sub') + '</p>' +
  '</div>' +
  '<div class="ob-type-duo">' + cards + '</div>';
}

function selectType(id, idx) {
  obState.accountType = id;
  document.querySelectorAll('.ob-type-big').forEach(function(el, i) {
    el.classList.toggle('selected', i === idx);
  });
}

// ── STEP 7: INTERESTS ─────────────────────────────────────────────

function renderInterests() {
  var chips = OB_DATA.interests.map(function (item) {
    var sel = obState.interests.indexOf(item.id) !== -1;
    return '<div class="ob-interest-chip' + (sel ? ' selected' : '') + '"' +
      ' onclick="toggleInterest(\'' + item.id + '\')">' +
      '<i class="' + item.icon + '"></i>' +
      '<span>' + item.label + '</span>' +
    '</div>';
  }).join('');

  return '<div class="ob-step-header">' +
    '<div class="ob-step-kicker">' + obT('ob_int_kicker') + '</div>' +
    '<h2>' + obT('ob_int_title') + '</h2>' +
    '<p>' + obT('ob_int_sub') + '</p>' +
    '<p class="ob-min-note">' + obT('ob_int_min') + '</p>' +
  '</div>' +
  '<div class="ob-interest-grid">' + chips + '</div>' +
  '<div class="ob-select-count" id="ob-interest-count">' + interestCountText() + '</div>';
}

function interestCountText() {
  var n = obState.interests.length;
  if (n === 0) return obT('ob_int_none');
  return '<strong>' + n + '</strong>' + obT('ob_int_n');
}

function toggleInterest(id) {
  var idx = obState.interests.indexOf(id);
  if (idx === -1) {
    obState.interests.push(id);
  } else {
    obState.interests.splice(idx, 1);
  }
  document.querySelectorAll('.ob-interest-chip').forEach(function (el, i) {
    var isSelected = obState.interests.indexOf(OB_DATA.interests[i].id) !== -1;
    el.classList.toggle('selected', isSelected);
  });
  var countEl = document.getElementById('ob-interest-count');
  if (countEl) countEl.innerHTML = interestCountText();
}

// ── STEP 8: CITY ──────────────────────────────────────────────────

function renderCity() {
  var selected = obState.cities || [obState.city || 'all_georgia'];
  var cards = OB_DATA.cities.map(function (c) {
    var sel = selected.indexOf(c.id) !== -1;
    return '<div class="ob-city-card' + (sel ? ' selected' : '') + '"' +
      ' onclick="selectCity(\'' + c.id + '\')">' +
      '<div class="ob-city-emoji">' + c.emoji + '</div>' +
      '<div class="ob-city-name">' + c.name + '</div>' +
      '<div class="ob-city-region">' + c.region + '</div>' +
    '</div>';
  }).join('');

  return '<div class="ob-step-header">' +
    '<div class="ob-step-kicker">' + obT('ob_city_kicker') + '</div>' +
    '<h2>' + obT('ob_city_title') + '</h2>' +
    '<p>' + obT('ob_city_sub') + '</p>' +
  '</div>' +
  '<div class="ob-city-grid">' + cards + '</div>' +
  '<div class="ob-select-count"><strong>' + selected.length + '</strong> area option' + (selected.length === 1 ? '' : 's') + ' selected</div>';
}

function selectCity(id) {
  if (!obState.cities) obState.cities = obState.city ? [obState.city] : ['all_georgia'];
  if (id === 'all_georgia') {
    obState.cities = ['all_georgia'];
    obState.city = 'all_georgia';
    obState.cityScope = 'all_georgia';
  } else {
    obState.cities = obState.cities.filter(function (x) { return x !== 'all_georgia'; });
    var idx = obState.cities.indexOf(id);
    if (idx === -1) obState.cities.push(id); else obState.cities.splice(idx, 1);
    if (!obState.cities.length) obState.cities = ['all_georgia'];
    obState.city = obState.cities[0];
    obState.cityScope = obState.cities.indexOf('all_georgia') !== -1 ? 'all_georgia' : 'multi_city';
  }
  renderStep(obState.step);
}

// ── STEP 9: GOALS ─────────────────────────────────────────────────

function renderGoals() {
  var cards = OB_DATA.goals.map(function (g) {
    var sel = obState.goals.indexOf(g.id) !== -1;
    return '<div class="ob-goal-card' + (sel ? ' selected' : '') + '"' +
      ' onclick="toggleGoal(\'' + g.id + '\')">' +
      '<div class="ob-goal-icon"><i class="' + g.icon + '"></i></div>' +
      '<div class="ob-goal-text"><h4>' + g.label + '</h4><p>' + g.desc + '</p></div>' +
    '</div>';
  }).join('');

  return '<div class="ob-step-header">' +
    '<div class="ob-step-kicker">' + obT('ob_goal_kicker') + '</div>' +
    '<h2>' + obT('ob_goal_title') + '</h2>' +
    '<p>' + obT('ob_goal_sub') + '</p>' +
    '<p class="ob-min-note">' + obT('ob_goal_min') + '</p>' +
  '</div>' +
  '<div class="ob-goal-grid">' + cards + '</div>';
}

function toggleGoal(id) {
  var idx = obState.goals.indexOf(id);
  if (idx === -1) {
    obState.goals.push(id);
  } else {
    obState.goals.splice(idx, 1);
  }
  document.querySelectorAll('.ob-goal-card').forEach(function (el, i) {
    el.classList.toggle('selected', obState.goals.indexOf(OB_DATA.goals[i].id) !== -1);
  });
}

// ── STEP 10: NOTIFICATIONS ─────────────────────────────────────────

function renderNotifPermission() {
  var granted = Notification && Notification.permission === 'granted';
  return '<div class="ob-step-header">' +
    '<div class="ob-step-kicker">' + obT('ob_notif_kicker') + '</div>' +
    '<h2>' + obT('ob_notif_title') + '</h2>' +
    '<p>Get notified when someone follows you, comments on your post, or a nearby deal drops.</p>' +
  '</div>' +
  '<div style="display:flex;flex-direction:column;align-items:center;gap:20px;padding:20px 0">' +
    '<div style="font-size:4rem">🔔</div>' +
    '<div style="display:flex;flex-direction:column;gap:10px;width:100%;max-width:360px">' +
      '<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:rgba(255,255,255,.04);border-radius:14px;border:1px solid rgba(255,255,255,.07)">' +
        '<i class="fas fa-heart" style="color:#f43f5e;width:20px"></i><span style="font-size:.88rem">' + obT('ob_notif_follows') + '</span>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:rgba(255,255,255,.04);border-radius:14px;border:1px solid rgba(255,255,255,.07)">' +
        '<i class="fas fa-tag" style="color:#f59e0b;width:20px"></i><span style="font-size:.88rem">' + obT('ob_notif_deals') + '</span>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:rgba(255,255,255,.04);border-radius:14px;border:1px solid rgba(255,255,255,.07)">' +
        '<i class="fas fa-trophy" style="color:#10b981;width:20px"></i><span style="font-size:.88rem">' + obT('ob_notif_xp') + '</span>' +
      '</div>' +
    '</div>' +
    (granted
      ? '<div style="color:#10b981;font-weight:700;font-size:.95rem"><i class="fas fa-check-circle"></i> ' + obT('ob_notif_enabled') + '</div>'
      : '<button type="button" id="ob-notif-btn" onclick="obRequestNotif()" style="background:linear-gradient(135deg,#10b981,#3b82f6);border:none;color:#fff;border-radius:14px;padding:14px 32px;font-weight:800;font-size:1rem;cursor:pointer;width:100%;max-width:360px"><i class="fas fa-bell" style="margin-right:8px"></i> ' + obT('ob_notif_enable') + '</button>') +
  '</div>';
}

function obRequestNotif() {
  var btn = document.getElementById('ob-notif-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + obT('ob_notif_enabling'); }
  if (!('Notification' in window)) { obNext(); return; }
  Notification.requestPermission().then(function(result) {
    if (result === 'granted') {
      if (btn) btn.innerHTML = '<i class="fas fa-check-circle"></i> ' + obT('ob_notif_enabled');
      setTimeout(obNext, 800);
    } else {
      obNext();
    }
  }).catch(obNext);
}

// ── STEP 11: RESULT ────────────────────────────────────────────────

function computeProfile() {
  var typeId = obState.accountType || 'user';
  var feed = FEED_TYPES[typeId] || FEED_TYPES.user;
  var typeColor = (OB_DATA.accountTypes.find(function(t){ return t.id === typeId; }) || OB_DATA.accountTypes[0]).color;
  var typeIcon  = (OB_DATA.accountTypes.find(function(t){ return t.id === typeId; }) || OB_DATA.accountTypes[0]).icon;
  var typeLabel = typeId === 'influencer' ? obT('ob_type_inf') : obT('ob_type_user');
  var selectedCities = obState.cities && obState.cities.length ? obState.cities : [obState.city || 'all_georgia'];
  var cityData = selectedCities.indexOf('all_georgia') !== -1 ? OB_DATA.cities[0] : (OB_DATA.cities.find(function (c) { return c.id === selectedCities[0]; }) || OB_DATA.cities[0]);
  var cityNames = selectedCities.indexOf('all_georgia') !== -1 ? ['All Georgia'] : selectedCities.map(function(id){ var c = OB_DATA.cities.find(function(x){return x.id===id;}); return c ? c.name : id; });

  var topInterests = obState.interests.length ? obState.interests.slice(0, 3) : ['cafes', 'events', 'travel'];
  var groups = topInterests.map(function (id) { return GROUP_MAP[id] || { name: 'City Explorers', members: '500+' }; });

  var challenges = CHALLENGE_MAP[typeId] || CHALLENGE_MAP.user;

  var rewardInterests = obState.interests.length ? obState.interests.slice(0, 2) : ['cafes', 'events'];
  var rewards = rewardInterests.map(function (id) { return REWARD_MAP[id] || { emoji: '🎁', label: 'Starter reward', pts: 50 }; });

  var aiSuggestion = getAiSuggestion(obState.city, obState.interests, typeId);

  return {
    accountType: typeId,
    accountLabel: typeLabel,
    accountColor: typeColor,
    accountIcon:  typeIcon,
    city: obState.city,
    cities: selectedCities,
    cityScope: selectedCities.indexOf('all_georgia') !== -1 ? 'all_georgia' : 'multi_city',
    cityName: cityNames.join(', '),
    cityEmoji: cityData.emoji,
    interests: obState.interests,
    goals: obState.goals,
    feed: feed,
    groups: groups,
    challenges: challenges,
    rewards: rewards,
    aiSuggestion: aiSuggestion,
    xpBonus: 250,
    completedAt: new Date().toISOString(),
  };
}

function renderResult() {
  var profile = computeProfile();

  var groupChips = profile.groups.map(function (g) {
    return '<div class="ob-group-chip"><i class="fas fa-users"></i> ' + g.name + ' <span>· ' + g.members + ' members</span></div>';
  }).join('');

  var challengeRows = profile.challenges.map(function (c, i) {
    return '<div class="ob-challenge-row">' +
      '<i class="fas fa-trophy"></i>' +
      '<span>' + c + '</span>' +
      '<span class="ob-challenge-xp">+' + CHALLENGE_XP[i] + ' XP</span>' +
    '</div>';
  }).join('');

  var rewardRows = profile.rewards.map(function (r) {
    return '<div class="ob-reward-row">' +
      '<span class="reward-icon">' + r.emoji + '</span>' +
      '<span>' + r.label + '</span>' +
      '<span class="ob-reward-pts">' + r.pts + ' XP</span>' +
    '</div>';
  }).join('');

  return '<div class="ob-result-hero">' +
    '<div class="ob-result-check"><i class="fas fa-check"></i></div>' +
    '<h2>' + obT('ob_result_ready') + '</h2>' +
    '<p>' + obT('ob_result_sub') + '</p>' +
  '</div>' +

  '<div class="ob-result-profile">' +
    '<div class="ob-profile-avatar" style="background:' + profile.accountColor + '22;color:' + profile.accountColor + '">' +
      '<i class="' + profile.accountIcon + '"></i>' +
    '</div>' +
    '<div class="ob-profile-info">' +
      '<h3>' + profile.accountLabel + ' · ' + profile.cityEmoji + ' ' + profile.cityName + '</h3>' +
      '<p>Feed type: <strong>' + profile.feed.label + '</strong></p>' +
    '</div>' +
    '<div class="ob-profile-xp">' +
      '<strong>+' + profile.xpBonus + ' XP</strong>' +
      '<span>' + obT('ob_result_bonus') + '</span>' +
    '</div>' +
  '</div>' +

  '<div class="ob-result-section">' +
    '<div class="ob-result-label"><i class="fas fa-compass" style="margin-right:5px"></i> ' + obT('ob_result_feed') + '</div>' +
    '<div class="ob-feed-badge"><i class="' + profile.feed.icon + '"></i> ' + profile.feed.label + '</div>' +
    '<p style="color:var(--text-muted);font-size:0.8rem;margin-top:8px">' + profile.feed.desc + '</p>' +
  '</div>' +

  '<div class="ob-result-section">' +
    '<div class="ob-result-label"><i class="fas fa-users" style="margin-right:5px"></i> ' + obT('ob_result_groups') + '</div>' +
    '<div class="ob-result-grid">' + groupChips + '</div>' +
  '</div>' +

  '<div class="ob-result-section">' +
    '<div class="ob-result-label"><i class="fas fa-trophy" style="margin-right:5px"></i> ' + obT('ob_result_challenges') + '</div>' +
    '<div class="ob-challenge-list">' + challengeRows + '</div>' +
  '</div>' +

  '<div class="ob-result-section">' +
    '<div class="ob-result-label"><i class="fas fa-gift" style="margin-right:5px"></i> ' + obT('ob_result_rewards') + '</div>' +
    '<div class="ob-reward-list">' + rewardRows + '</div>' +
  '</div>' +

  '<div class="ob-result-section">' +
    '<div class="ob-result-label"><i class="fas fa-wand-magic-sparkles" style="margin-right:5px"></i> ' + obT('ob_result_ai') + '</div>' +
    '<div class="ob-ai-bubble"><strong>' + obT('ob_result_ai_try') + '</strong><span class="ob-ai-suggestion">' + profile.aiSuggestion + '</span></div>' +
  '</div>' +

  '<div class="ob-result-finish">' +
    '<a href="feed.html" class="ob-finish-btn"><i class="fas fa-compass"></i> ' + obT('ob_start') + '</a>' +
    '<p class="ob-finish-note">Your profile is saved. You can update interests anytime in Settings.</p>' +
  '</div>';
}

// ── WELCOME BACK ──────────────────────────────────────────────────

function renderWelcomeBack(data) {
  function doMark(fb) {
    var user = fb.auth && fb.auth.currentUser;
    if (!user) return;
    fb.fs.updateDoc(fb.fs.doc(fb.db, 'users', user.uid), { onboardingComplete: true }).catch(function(){});
  }
  if (window.GeoFirebase && window.GeoFirebase.auth) doMark(window.GeoFirebase);
  else window.addEventListener('GeoFirebaseReady', function() { if (window.GeoFirebase) doMark(window.GeoFirebase); }, { once: true });

  var header = document.getElementById('ob-step-label');
  if (header) header.textContent = '';
  var fill = document.getElementById('ob-progress-fill');
  if (fill) fill.style.width = '100%';
  var nav = document.getElementById('ob-nav');
  if (nav) nav.style.display = 'none';

  // Determine a label from legacy data
  var legacyLabels = { explorer: 'Explorer', creator: 'Creator', business: 'Business', teacher: 'Teacher', service: 'Service', realestate: 'Real Estate', events: 'Events', user: obT('ob_type_user'), influencer: obT('ob_type_inf') };
  var label = legacyLabels[data.accountType] || (data.accountType || 'Explorer');
  var cityData = OB_DATA.cities.find(function (c) { return c.id === data.city; });
  var cityName = cityData ? (cityData.emoji + ' ' + cityData.name) : 'Georgia';

  var content = document.getElementById('ob-step-content');
  content.innerHTML =
    '<div class="ob-welcome-back">' +
      '<div class="ob-wb-badge"><i class="fas fa-check-circle"></i> ' + obT('ob_wb_badge') + '</div>' +
      '<h2>' + obT('ob_wb_back') + ', ' + label + '!</h2>' +
      '<p>Your GeoHub profile is ready in ' + cityName + '. Jump back in where you left off.</p>' +
      '<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">' +
        '<a href="feed.html" class="btn btn-primary btn-lg"><i class="fas fa-compass"></i> ' + obT('ob_wb_continue') + '</a>' +
        '<button class="btn btn-ghost" onclick="restartOnboarding()"><i class="fas fa-rotate"></i> ' + obT('ob_wb_restart') + '</button>' +
      '</div>' +
    '</div>';
}

function restartOnboarding() {
  if (window.safeStorage) window.safeStorage.remove('geohub_onboarding');
  obState.firstName = ''; obState.lastName = ''; obState.username = ''; obState.usernameStatus = '';
  obState.birthday = ''; obState.gender = ''; obState.residentialCity = ''; obState.password = '';
  obState.accountType = null;
  obState.interests = [];
  obState.city = 'all_georgia';
  obState.cities = ['all_georgia'];
  obState.cityScope = 'all_georgia';
  obState.goals = [];
  renderStep(1);
}

// ── STORAGE ───────────────────────────────────────────────────────

function saveToStorage(profile) {
  var data = {
    firstName:       obState.firstName || '',
    lastName:        obState.lastName  || '',
    username:        obState.username  || '',
    birthday:        obState.birthday  || '',
    gender:          obState.gender    || '',
    residentialCity: obState.residentialCity || '',
    accountType: obState.accountType,
    interests:   obState.interests,
    city:        obState.city,
    cities:      obState.cities || [obState.city || 'all_georgia'],
    cityScope:   obState.cityScope || 'all_georgia',
    goals:       obState.goals,
    photoURL:    obState.photoCloudinaryURL || obState.photoURL || '',
    profile:     profile,
    completedAt: new Date().toISOString(),
  };
  if (window.safeStorage) window.safeStorage.set('geohub_onboarding', data);
  saveOnboardingToFirestore(data);
}

function saveOnboardingToFirestore(data) {
  function doSave(fb) {
    var user = fb.auth && fb.auth.currentUser;
    if (!user) return;
    var fullName = ((data.firstName || '') + ' ' + (data.lastName || '')).trim();
    var update = {
      onboardingComplete:    true,
      onboardingCompletedAt: fb.fs.serverTimestamp(),
      firstName:   data.firstName || '',
      lastName:    data.lastName  || '',
      username:    data.username  || '',
      birthday:    data.birthday  || '',
      gender:      data.gender    || '',
      city:        data.residentialCity || data.city || '',
      accountType: data.accountType || 'user',
      interests:   data.interests   || [],
      feedCity:    data.city        || 'all_georgia',
      cities:      data.cities      || [data.city || 'all_georgia'],
      goals:       data.goals       || [],
    };
    if (fullName) update.fullName = fullName;
    if (data.photoURL) { update.photoURL = data.photoURL; update.avatar = data.photoURL; }
    fb.fs.updateDoc(fb.fs.doc(fb.db, 'users', user.uid), update).catch(function () {});
    if (obState.password && obState.password.length >= 8) {
      try {
        var hasPwd = user.providerData && user.providerData.some(function(p){ return p.providerId === 'password'; });
        if (!hasPwd && fb.authFns && fb.authFns.EmailAuthProvider && fb.authFns.linkWithCredential) {
          var cred = fb.authFns.EmailAuthProvider.credential(user.email, obState.password);
          fb.authFns.linkWithCredential(user, cred).catch(function(){});
        } else if (hasPwd && fb.authFns && fb.authFns.updatePassword) {
          fb.authFns.updatePassword(user, obState.password).catch(function(){});
        }
      } catch(e) {}
    }
  }
  if (window.GeoFirebase && window.GeoFirebase.auth) {
    doSave(window.GeoFirebase);
  } else {
    window.addEventListener('GeoFirebaseReady', function () {
      if (window.GeoFirebase) doSave(window.GeoFirebase);
    }, { once: true });
  }
}

// ── TOAST ─────────────────────────────────────────────────────────

function showToast(msg) {
  var toast = document.getElementById('ob-toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(function () { toast.classList.remove('show'); }, 2800);
}

// ── BIND STEP (post-render hooks) ─────────────────────────────────

function bindStep() {
  // No additional binding needed — all handled via inline onclick
}
