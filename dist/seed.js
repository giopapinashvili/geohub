/**
 * GeoHub Seed Script
 * Run: node seed.js
 * Requires: serviceAccountKey.json in same folder
 */

const admin = require('firebase-admin');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.cert(serviceAccount),
  projectId: 'geohub-main'
});

const db = getFirestore();

// ─── Georgian names ───────────────────────────────────────────────
const FIRST_NAMES = [
  'გიორგი','ნინო','დავით','ანა','ლუკა','მა���იამ','ნიკა','სოფია','ელენე','ბაჩო',
  'თა��არ','ზურა','ლია','ვა��ო','ქეთი','სან��რო','ნათი��','გი��','მაია','ლად���',
  'ირინა','შოთა','მანა���ა','ლე���ა���','ქრისტინე','ზაზა','ეკა','მამუ����','ნინო','ვასო',
  'სალ��მე','ბექა','თეა','ილი���','ხ��თუნა','ნოდა��','ანი','გოგა','ნანა','ალეკო',
  'ნინო','ვიკა','გელ��','ლელა','მიხეილ','ცირა','გიორგი','ლიზი','ლაშა','ტატა',
  'ლუიზა','ბადრი','ია','ბესო','ალი','ლუბა','რატი','ეთო','ოთა���','ნინო',
  'ლამარა','გრიგოლ','ნანი','ნოე','მარი','ბეგი','ცოტნე','ნოდარ','ზეინაბ','ნინი',
  'არჩი��','ასმათ','გოჩა','ლასე','ვაჟა','ნეკა','ორბე���ი','ეთი','ლოტი','ანდრია',
  'ხვიჩა','გვანცა','გელა','ნინო','ჯაბა','ბელა','ვიტო','ნარგი','ედუარდ','ლელა',
  'სიმონ','ეკა','ბა��ო','ლანა','კახა','ნი��ი','ზვიად','თეო','ბადრი','ნინო',
  'ვალო','ელი','ასლა��','ნუნა','კობა','ია','ბესა','ლია','მუხი','ნდა'
];

const LAST_NAMES = [
  'ბე��იძე','ჩხეიძე','ცხადაძე','გოგუაძ���','ღვინიაშვილი','ასათიანი','ვარდანიძე',
  'კვარაცხელია','ხოსიტაშვილი','ხინთიბიძე','ჭითანავა','ლომიძე','ფხაკაძე',
  'ჯიქია','ქობულაძე','კაპანაძე','ლაბაძე','ნოდია','ბასილაია','ბეჟუაშვილი',
  'გუჯაბიძე','ელიზბა��აშვილი','ჯიშკარიანი','ხარიკიშვილი','ბეკელე','კვესიტაძე',
  'ცქვიტინიძე','ბრეგვაძე','ლორთქიფანიძე','ტყებუჩავა','ინასარიძე','ცქიტიშვილი',
  'ქართველიშვილი','ნარიმანიძე','ადამია','ბარამია','გელბახიანი','ფიფია',
  'შარვაშიძე','მაისურაძე','კუჭავა','ავალიანი','ამირეჯიბი','ნიჟარაძე','ხასია',
];

const CITIES = ['თბილისი','ბა��უმი','ქუთაისი','რუსთავი','ზუგდიდი','გორი','ფოთი','თელავი','ახა��ციხე','ოზურგეთი'];

const BIOS = [
  'ვიყვები და ვქმნი 🌿','ფოტოგრაფი და მოგზაურ��� 📸','საქართველო ♥ ყოველ ნაბიჯზე',
  'მუსიკოსი | შე��ქმნ���ლი | ოცნებისმოყვარე 🎵','ბიზნეს კონსუ��ტანტი & მეწა��მე 💼',
  'Chef | ქა���თულ�� სამზა���ეულო 🍽️','სპორტის მოყვარული 🏆 | ფიტნეს ბლოგერი',
  'ტ��ქ ენთუზიასტი 💻 | სტარტაფ კულტურა','ხელოვანი & დიზაინერი 🎨 | Tbilisi-based',
  'ბლოგე��ი & კონტე��ტ კრეატორი 📱','ა/ა ორგანიზაციის დამფუ��ნებელი 🌱',
  'ტრაველ ბლოგერი ✈️ | 30+ ქვეყანა','გარემოს დამცვ��ლი 🌍 | ეკო-ლოგი',
  'ნოვატორი & ინვესტორი 📈','ყოველდღიური ც���ოვრება Tbilisi-ში 🏙️',
  'ფიტნეს კოუჩი 💪 | ჯანსაღ�� ცხოვრება','ლიტერატურის მოყვარუ���ი 📚 | მწე��ალი',
  'კინოს & სერია��ების მოყვარული ��','ქართული ღვინის სომელიე 🍷','DJ & პროდიუსერი 🎧'
];

// ─── Post content ─────────────────────────────────────────────────
const POSTS = [
  // Travel
  ['დღეს ბათუმი 🌊 ეს ქა��აქი ყოველ ჯერ ახალ ენერგიას მაძლევს. ჩასვლის ღირს!','travel'],
  ['კახეთი ღვი��ის სეზონი დაიწყო 🍷 ყვ��ლაფე��ი ისეთი ხომ არ ყოფილა #კახეთი #ღვინო','travel'],
  ['სვანეთი - ჩემი სუ��ი ქვეყანა ⛰️ ამ ხალხს და ამ ბუნებას ვერ გათანაბრებ #ს��ანეთი','travel'],
  ['მც��ეთა-მთიანეთი, ჟი��ვ��ლი 💙 ეს სილამაზე სხვაგან ვერ იპოვი #საქა��თვე��ო','travel'],
  ['ბა���ათაშვილის ხიდიდან ტბილისი ??? ყვე���ა ადგილი სანახავია 🌆 #თბილისი','travel'],
  ['ბაკურიანი ზამთარში ⛷️ ეს სეზო��ი ვერ გამოვტოვე! #სკი #ბაკუ��იანი','travel'],
  ['გუდაური ❄️ პირველი თოვლი დაეცა! #სნოუბორდი #გუდაური','travel'],
  ['ანანუ��ი 🏰 ამ ციხე-გალავნის ისტორია ძალიან საი�����ერესოა #ისტორია','travel'],
  ['ბოჭორმა - ნა��ახი მხოლოდ ნახა���ებშ���, ახლა ვნახე პირდაპირ 😍 #ბოჭორმა','travel'],
  ['შიომღვიმე ეკლესია ❤️ წყნარი და ზღვაკვარი ადგილი 🙏 #სუ���იერებ���','travel'],

  // Food
  ['ქართული ხინკალი 🥟 საუკეთესო ქინქლები ყოველ პარა���კევს. ვინ მოვა? 😋 #ხი���კალი','food'],
  ['ბათუმური აჭარული ხაჭაპური 🧀 ეს ადამიანი ეს კერძი!!!  #ხაჭაპური #ბათუმი','food'],
  ['სახლისაკენ გზაში სოხუმური ძეხვის ყიდვა 🌭 ჩემი ბავშვობი��� გემო 💚','food'],
  ['ახლად გახსნილი კაფე ოლდ თბილისში ☕ ქართული ჩაი & ნამცხვარი - 10/10!','food'],
  ['დედა-ბებიას ბადრიჯნის ნიგვზით 😍 რეცეპტი მომთხოვეთ, ვიზი��რებ! #ქართულიკულინარია','food'],
  ['ახალი რეს��ო ვარძიის ქუჩაზე 🍽️ ჭარხლის სალა��ი + ლობიანი = ბე��ნიერ���ბა','food'],
  ['ფხალი ��აოჯა��ო სახლის სამზარეუ���ოდან 🌿 ვეგანი? ვეგეტა��იანი? ყველასათვის! #ფხალი','food'],
  ['ლობიანი წვიმიანი საღა���ოს 🌧️ ამ კომბინაციაზე ვერ ვუარი ვყოფ #ლობიანი','food'],
  ['ჩვენი ოჯახის ჩაქაფული 🥘 100 წლის რეცეპტი - ახლა ვიზიარებ! 🙏 #ტრადიცი���','food'],
  ['ტარტი ბლუებერით 🫐 ახალი ცდა სამზა���ეულოში - შეჩვ��ნებულ#ვარ 😂 #ბეიქინგი','food'],

  // Tech
  ['AI-ის ახალი ეპოქა 🤖 ქართული სტარტაფები ამ ტრენდს ეწევიან. ვინ ჰყავს ინფო? 💻','tech'],
  ['Web3 & ბლოკჩეინი საქართველოში 🇬🇪 ბევრი მოხდე��ა 2025-2026-ში! #კრიპტო','tech'],
  ['Flutter vs React Native - ჩემი 2 წლის გამოცდილება 📱 კო��ენტარებში ვისაუბრებ!','tech'],
  ['GitHub Copilot-მა ჩემი პროდუქტიულობა 3x გაზარდა 🚀 ვინ იყენებს?','tech'],
  ['ქართული ტექ კომპანია გლობალურ ბაზარზე 💼 გამიმარჯვდა! #სტარტაფი #ტექნოლოგი���','tech'],
  ['No-code tools 2025 🛠️ შეუძ��ებელი ხდ��ბა შესაძლებელი! Webflow, Bubble...','tech'],
  ['Cybersecurity ქართველი სპეციალისტებისგან 🔐 CTF challenge-ზე გამარჯვება ✅','tech'],
  ['Data Science & ML: ქართული ბაზრის ანალიზ�� 📊 ვიზიარებ შედეგე��ს!','tech'],
  ['UX/UI Design trends 2025 🎨 ყველა დიზაინერმა ნახოს!','tech'],
  ['Cloud computing migration: ჩვენი გა���ოცდილება AWS-ზე ��ადასვლისა��� ☁️','tech'],

  // Music & Arts
  ['ახალი ქართული მ��სიკ�� 🎵 ეს ბე���დი MUST LISTEN! ვი�� უსმენს? #ქართულიმ�������კა','music'],
  ['ჩემი ახალი ნა�����ტი 🎨 3 კვი���ი��� სა���უშაო - ახლა ვასრულე! #ხელო����ება #ფ��რწე���ა','art'],
  ['Street art Tbilisi 🖌️ ქა��აქი გალე���ეაა! #ქუჩის���ელოვნება #თ��ილისი','art'],
  ['ჩემი პირველი EP გ��მოვიდა! 🎧 Link bio-ში! მომისმი��ეთ და შეაფასეთ 🙏','music'],
  ['ფოტოგრაფია: გარდაბნი��� ველები 🌾 სა��ა���-სან���ხი! #ფოტო #საქართველო','art'],
  ['Jazz Festival Tbilisi 🎷 ეს ღამე ცხოვრებაში დაუვიწყარი! #ჯაზი #თბილი���ი','music'],
  ['ახალი გალე��ეა Fabrika-ში 🖼️ ვი�� ნახა? ძალიან სა���ნტერესო! #ხე��ოვნება','art'],
  ['სტუდიო სესი��� 2025 🎹 პროცესი და შე��ეგი - ვიზიარებ! #მუსიკა #სტუდი���','music'],
  ['ქსოვის ხე���ოვნება 🧶 ეს ქარ��უ���ი ტრა���იცია სა��ია��ოვნოა! #ხე���ნაკეთი','art'],
  ['რეჩი-ფოტო: ბოხოჩი��� ლიდო 🌊 ძვირფ���სი სანა��ი #ბოხოჩი #ფოტო','art'],

  // Sports
  ['რაგბი ��აქართველო 🏉 #Lelos ვამაყობ! მარტ�� ს���ორტი კი არა ცხოვრები�� წესი! ','sport'],
  ['ფეხბურთი: ქართული ლიგა 2025 ⚽ ვინ ყვება გუნდი? #ქართულილიგა','sport'],
  ['CrossFit-ის ჩემპიონატი Tbilisi-ში 💪 ვინ მ��ნაწილე��ბდ��? #კროსფიტი','sport'],
  ['ველოსიპედი Mtkvari-ს ��ირას 🚲 ყოველი დილა ას���! #ველო #თბილისი','sport'],
  ['მთის ლაშქრობა: კაზბ��გი 🏔️ 5047 მ. სიმა��ლეზე 🎉 #მთა #ლა������რობა','sport'],
  ['ჩოგბურთი 🎾 ახ��ლი სეზონი იწყება! ვინ ით���მა���ებს? #ჩოგბურთი','sport'],
  ['ბოქ��ი ან MMA - ქართველი სტარები 🥊 ამ ჩემპიონებს ვამაყობ! #ბოქსი','sport'],
  ['ცუ���ვა ბათ��მის ზღვაში 🏊 ეს სიამ��ვნება სხ���აა! #ბა��უ���ი #ზღ��ა','sport'],
  ['სუფ-ბორდინგ��� მთკვარ���ა��� 🏄 ახ���ლი ჰობი! ვინ სცდია? #სუფ #თბილ��სი','sport'],
  ['ჰიკი��გი და��ით გარეჯში ☀️ ადრეული ��ეზო���ი & ყვავილები 🌸 #ლაშქრობა','sport'],

  // Life & Philosophy
  ['ყოველი დილა ახალი შანსი��� 🌅 ჩვენ ვი���ჩევ�� როგორ გამოვიყენოთ ✨','life'],
  ['ტბ���ლისური გვიანი საღ��მო ☕ ქალაქი ძინავს მე ��ი ვფიქრობ 🌙 #თ��ილისი #ფიქრი','life'],
  ['მეგო��რო��ა - ყვ��ლაზე ძვი���ფასი სიმ��იდრე 💙 ეს ხა������ი ჩემი ყველაფერია!','life'],
  ['2025: ჩემი მიზნები 🎯 ვიზიარებ! შეავსე შ��ნი listა კომე��ტარებში!','life'],
  ['ოჯა���ი ➕ კა��იერა - ბ���ლან���ი შესაძლებელი��! ჩემ��� გამოცდილე��ა 💪','life'],
  ['მად���ი��რება სი��ს ეფექტი ✨ ყოველ საღამოს 3 ნივთი - 30 დღის ��ემდე��...','life'],
  ['ნეგატიურ ენერგიებს - Bye! 👋 ჩემი ახალი ფილოსოფ��ა: ნაკლები სტრესი','life'],
  ['სა���ლი vs ოფ���ს�� 🏠 Remote Work-ის 2 წელი: pro & cons | თ��ვენი გა���ოცდილე��ა?','life'],
  ['ყოველი სი���თულე გამოცდილებაა 🌱 ვისაც ეს ჭი��დე��ა: ყ��ელა���ერი გაივლის','life'],
  ['ქართული სული 💚 ეს ხალ��ი, ე�� ქვეყან���, ეს სითბო - გმად���ო��� საქართველო','life'],

  // Business
  ['ჩემი ბიზნეს-პრობლე���ა & გამოსა�����ლი 💡 ვიზიარებ გამოცდილება��� მეწ��რმეე��ს!','business'],
  ['სტ���რტა�� ეკოს��სტემა Tbilisi-ში 🚀 2025 წე��ი ძალიან საინტერესოა! #სტარ���აფი','business'],
  ['მ��რკეტინგი სოც.ქსელებ����� 2025 📱 ჩემი 5 გაკვეთილ��� 1 წ���ის გა���მ��ვლობაში','business'],
  ['B2B vs B2C: ჩვენი გა��აწყვეტილება 💼 კომპანიის გვ. link-ი bio-ში!','business'],
  ['Networking Event Tbilisi 🤝 გუშინ 50+ მეწარმე შევხვდი! ვი��� იყ��?','business'],
  ['ინვესტიცი��� vs Bootstrap - ჩვენ ავირჩიეთ Bootstrap. აი, რა��ომ... 💰','business'],
  ['Customer Service: ჩვენი 98% satisfaction rate-ის ���ა��დ���მლ�� 🏆','business'],
  ['ახალი პარტნიორობა ��ამოცხად��ა 🎉 ვრცელი info soon! #ბი���ნე���ი #პარტნიორობა','business'],
  ['E-commerce ქა��თველი გამყიდველე��ისთვის 🛒 ჩემი best practices','business'],
  ['Hiring: ვეძებთ Junior Developer-ს! 💻 DM-ი ან კო���ენტარი! #ვაკ���ნსი�� #სამუ�������','business'],

  // Nature
  ['ბორჯო���-ხარაგაულის პ���რკი 🌲 3 დღე და 40 კმ - ვარ! #ჰიკინგი #ბორჯომი','nature'],
  ['ჭორ��ხის ხ��ო���ა 🌊 ამ ადგილს სხვა არ ჰყავს! #ბათუ��ი #ბუნ���ბა','nature'],
  ['ლაგოდეხი ბუნების ნაკრ��ა���ი 🦋 ბიომრავა���ფეროვნები��� ოახსნა! #ეკოლოგია','nature'],
  ['კოლხეთი��� ერ�����ნ��ლი პარკი 🌿 ჭაობი & ველურ�� ბუნება - ფასდაუდებელი!','nature'],
  ['ნა���ა��ებ���ს ლიდო 🌊 ეს ფერი! ეს სიმშ���იდე! ✨ #�����ვი_ზღვა','nature'],
  ['სთოდი - მოულოდნელი ადგილი 🏔️ ქვეყნის ოდინდელი სიმშვ��დე','nature'],
  ['ჭყინეთი ☀️ ალაზნის პირი - ოჯა���ური პიკ���იკი & ბედ���იერება 💚','nature'],
  ['ახალცი��ე-ნინოწმ��ნ��ა 🌸 ტყის ბილი��ი - ჰაერი სუფთა! #ჯავახეთი #ბუნებ���','nature'],
];

// ─── Groups ───────────────────────────────────────────────────────
const GROUPS = [
  { name: 'ქართული ტექ კო���იუნი��ი', description: 'IT სპეცი��ლისტები, სტა���ტაფ მეწარმეები და ტექ ენ��უზი��ს���ები', category: 'technology', membersCount: 1240, privacy: 'public', emoji: '💻' },
  { name: 'ფოტოგრაფები საქართველო', description: 'ქართ��ელი ფოტოგრაფების ���აე���თიანება', category: 'art', membersCount: 830, privacy: 'public', emoji: '📸' },
  { name: 'Tbilisi Foodies', description: 'ყველაფერი ქართულ სამზარეულოზე და Tbilisi-ს რეს���ორნე��ზე', category: 'food', membersCount: 2100, privacy: 'public', emoji: '🍽️' },
  { name: 'Georgian Hikers', description: 'მოყვარული ლაშქრობის ჯგუფი', category: 'sports', membersCount: 1560, privacy: 'public', emoji: '🏔️' },
  { name: 'ქართული მუსიკა 🎵', description: 'ქართველი მუსიკოსე���ი, ბე�����ები და მუსიკი�� მოყ��არულე���ი', category: 'music', membersCount: 3200, privacy: 'public', emoji: '🎵' },
  { name: 'StartUp Georgia', description: 'ქართული ს��ა���ტაფ ეკოსისტემა', category: 'business', membersCount: 970, privacy: 'public', emoji: '🚀' },
  { name: 'ჯანსაღი ცხოვ��ე��ა 💪', description: 'ფ��ტნ�����, სპო���ტი, ჯანსაღი კვება', category: 'health', membersCount: 1800, privacy: 'public', emoji: '💪' },
  { name: 'Travel Georgia', description: 'გაიგე ყველაფერი მოგზაურობაზე', category: 'travel', membersCount: 4500, privacy: 'public', emoji: '✈️' },
  { name: 'ხელოვნება & დ��ზა���ნ���', description: 'ქართველი მხა���ვ�����ბი, დიზაინერები', category: 'art', membersCount: 720, privacy: 'public', emoji: '🎨' },
  { name: 'ქართული ფილმი & სერ��ებ��', description: 'კინ���, სერ��ები, ლიტე��ატურა', category: 'entertainment', membersCount: 2800, privacy: 'public', emoji: '🎬' },
  { name: 'Moms of Georgia', description: 'ქართველი დედების ����არდამჭერი ჯ���უფი', category: 'family', membersCount: 5200, privacy: 'public', emoji: '👶' },
  { name: 'ქართული ღვი��ო 🍷', description: 'ღვინის მოყვარულები & სომ���ლიეებ���', category: 'food', membersCount: 1430, privacy: 'public', emoji: '🍷' },
  { name: 'Remote Workers Georgia', description: 'Digital nomads & remote workers', category: 'work', membersCount: 890, privacy: 'public', emoji: '🌍' },
  { name: 'Batumi Lovers', description: 'ბათუმის სიყვარულით', category: 'travel', membersCount: 3600, privacy: 'public', emoji: '🌊' },
  { name: 'ქართულ�� ლიტერატურა', description: 'წიგნები, პოეზ��ა, ლიტერატ���რულ��� განხ���ლვა', category: 'culture', membersCount: 660, privacy: 'public', emoji: '📚' },
];

// ─── Businesses ───────────────────────────────────────────────────
const BUSINESSES = [
  { name: 'Cafe Vera', businessType: 'restaurant', category: 'Cafe & Coffee', city: 'თ�����ლისი', description: 'სა��კეთესო ყ���ვა ვერა-ს უ��ანში. Specialty coffee & ბრანჩი', rating: 4.8, reviewCount: 234, followerCount: 1200, verified: false },
  { name: 'GeoTech Solutions', businessType: 'tech', category: 'IT & Technology', city: 'თბ���ლ��სი', description: 'ქართული IT კ��მპანია - Web, Mobile, Cloud', rating: 4.6, reviewCount: 89, followerCount: 450, verified: false },
  { name: 'Hotel Batumi Pearl', businessType: 'hotel', category: 'Hotels & Accommodation', city: 'ბა���უმ��', description: 'ბათუმის ზღვისპირა 4* ��ასტუმ��ო', rating: 4.7, reviewCount: 512, followerCount: 2300, verified: false },
  { name: 'Tamada Wine Bar', businessType: 'restaurant', category: 'Wine & Bar', city: 'თბილისი', description: 'ქარ���ული ღვინო, ჩიზი & ხელოვნება ერთ ��დგილზე', rating: 4.9, reviewCount: 178, followerCount: 880, verified: false },
  { name: 'Kutaisi Guest House', businessType: 'hotel', category: 'Hotels & Accommodation', city: 'ქ���თაი���ი', description: 'კო���ფორტული სახლი ქუთაის��ს ცენტრში', rating: 4.5, reviewCount: 67, followerCount: 230, verified: false },
  { name: 'Georgian Bakery', businessType: 'food', category: 'Bakery', city: 'თბილისი', description: 'ყოვე���დღიური ახა���ი ხაჭაპ��რი, ლო��იანი & ნამც��ვრე���ი', rating: 4.8, reviewCount: 445, followerCount: 3100, verified: false },
  { name: 'Adventure Georgia Tours', businessType: 'tour', category: 'Tours & Travel', city: 'თბილისი', description: 'ექსკლუზიური ტუ��ი-პაკეტები მ���ე�� საქართველ���ში', rating: 4.9, reviewCount: 203, followerCount: 1560, verified: false },
  { name: 'Fitness Club Pro', businessType: 'fitness', category: 'Fitness & Health', city: 'თბილ���სი', description: 'სრული ფიტნეს ��ომპლ��ქსი - CrossFit, Yoga, Pool', rating: 4.6, reviewCount: 321, followerCount: 2400, verified: false },
  { name: 'Creative Hub Tbilisi', businessType: 'coworking', category: 'Co-working & Events', city: 'თბილი���ი', description: 'Coworking space კრეა���იული გონე���ებისთვი���', rating: 4.7, reviewCount: 92, followerCount: 670, verified: false },
  { name: 'Georgian Craft Beer', businessType: 'brewery', category: 'Bar & Brewery', city: 'თბილისი', description: 'ქართული craft beer - 12 სა���ეობა', rating: 4.8, reviewCount: 156, followerCount: 1100, verified: false },
  { name: 'Telavi Wine Estate', businessType: 'winery', category: 'Winery & Tours', city: 'თელა��ი', description: 'ოჯახ���რი ��არანი კ��ხეთში, ვიზ���ტე���ი & ღვინის დეგუს��აცია', rating: 4.9, reviewCount: 287, followerCount: 1890, verified: false },
  { name: 'Studio 27 Design', businessType: 'design', category: 'Design & Creative', city: 'თბ��ლისი', description: 'Branding, UI/UX, ვებ-დიზაინი', rating: 4.7, reviewCount: 44, followerCount: 340, verified: false },
  { name: 'Pharmacy Nature', businessType: 'pharmacy', category: 'Health & Pharmacy', city: 'ბა��უმი', description: 'ბუნებრივი & ეკ��-პრე�����რა���ე��ი', rating: 4.6, reviewCount: 88, followerCount: 560, verified: false },
  { name: 'Kazbegi Mountain Lodge', businessType: 'hotel', category: 'Hotels & Accommodation', city: 'კა���ბეგ��', description: 'მთი�� ლოჯი კ��ზბეგის ფანჯრი�����ნ 🏔️', rating: 4.9, reviewCount: 198, followerCount: 4200, verified: false },
  { name: 'GeoFood Delivery', businessType: 'delivery', category: 'Food Delivery', city: 'თბ��ლისი', description: 'ქ��რთული სამზარეულო თქ��ენს კა��თან', rating: 4.5, reviewCount: 734, followerCount: 6500, verified: false },
];

// ─── Places ───────────────────────────────────────────────────────
const PLACES = [
  { name: 'ნ��რი����ლა ციხე', category: 'landmark', city: 'თბილისი', description: 'IV-V საუკუნის ციხე-სიმა��რე ოლდ თბილ��სში', rating: 4.8, visitCount: 15200, lat: 41.6892, lng: 44.8097 },
  { name: 'ბათუმის ბოტ��ნიკური ბაღი', category: 'nature', city: 'ბათუმი', description: '1912 წელ�� ��აარს��ბული მდიდარი ბოტანიკურ��� ბაღი', rating: 4.9, visitCount: 23400, lat: 41.6889, lng: 41.6823 },
  { name: 'მცხე��ა - ძ���ელი ქა��აქი', category: 'historical', city: 'მცხეთა', description: 'სა��ართველოს სულ���ერი დედაქალაქი', rating: 4.9, visitCount: 31000, lat: 41.8464, lng: 44.7219 },
  { name: 'ვარძი��� მღვიმე-ქ��ლაქი', category: 'landmark', city: 'ასპი���ძა', description: 'XII საუკუნის კლდეშ��� გამოჭრილ�� ქალაქი', rating: 4.9, visitCount: 18900, lat: 41.3858, lng: 43.2858 },
  { name: 'უფლისციხე', category: 'historical', city: 'გ��რ���', description: 'კ��დის ქალაქი ახ.წ. I-VI სს.', rating: 4.7, visitCount: 12000, lat: 41.9822, lng: 44.2422 },
  { name: 'სი��ნაღი', category: 'town', city: 'სიღნაღი', description: 'სიყვარულ��ს ქალაქი კ���ხეთში', rating: 4.8, visitCount: 27300, lat: 41.6181, lng: 45.9228 },
  { name: 'ომა��ო (შ��დილი)', category: 'nature', city: 'ახ����ტა', description: 'ზემო და ქვე���ო ომალო, ტუშე��ი', rating: 4.9, visitCount: 8900, lat: 42.3614, lng: 45.5819 },
  { name: 'ჟი���ვალი�� წყ��ლ���აცა���ი', category: 'nature', city: 'დუშე�����', description: 'ლამაზი ლურჯი წყალი მთი��� ფონზე', rating: 4.7, visitCount: 19200, lat: 42.0844, lng: 44.7394 },
  { name: 'ბაკურიანი სა��ხი����მურო კურორტი', category: 'resort', city: 'ბაკ��რია��ი', description: 'სათხილამ���რო კურორტი ბორჯომ-ხარაგაულის ახლო��', rating: 4.6, visitCount: 22100, lat: 41.7464, lng: 43.5275 },
  { name: 'ანა���ური ციხე-კო��პლექსი', category: 'historical', city: 'დუშეთი', description: 'XVI-XVIII სს. ციხე-კო��პლე���სი ართვისთან', rating: 4.8, visitCount: 14800, lat: 42.1272, lng: 44.7175 },
  { name: 'გელათი��� ��ონ��სტერ���', category: 'religious', city: 'ქუთაისი', description: 'XII ს. ეკლესია, UNESCO მ��მკვიდრ����ბა', rating: 4.9, visitCount: 16500, lat: 42.2769, lng: 42.6911 },
  { name: 'Fabrika Tbilisi', category: 'urban', city: 'თბილისი', description: 'ძველი ფაბრიკა, ახლა — ბარებ���, კაფეები, co-working', rating: 4.7, visitCount: 38900, lat: 41.6931, lng: 44.8000 },
  { name: 'ბათუმის ზღვის სა��ა��ირო', category: 'beach', city: 'ბა���უმ��', description: 'შა��ი ზღვა, ბუ��ვარი, Batumi Boulevard', rating: 4.8, visitCount: 89000, lat: 41.6468, lng: 41.6369 },
  { name: 'კიდობანი ჟინვ. ტყე', category: 'nature', city: 'მცხეთა', description: 'სიმშვიდე ბუნებასთან', rating: 4.6, visitCount: 7600, lat: 41.9453, lng: 44.7597 },
  { name: 'გუდაური ��ათ��ილამ. კომპლ.', category: 'resort', city: 'სტ���ფანწმინ���ა', description: 'სათხილამურო კომპ���ე��სი კა��კ��სიონზე', rating: 4.8, visitCount: 31200, lat: 42.4781, lng: 44.4892 },
];

// ─── Helpers ──────────────────────────────────────────────────────
function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function fakeUid() { return 'seed_' + Math.random().toString(36).slice(2, 18); }
function avatar(name) { return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=200&bold=true&color=fff`; }
function cover(seed) { return `https://picsum.photos/seed/${seed}/900/300`; }
function ago(daysAgo, hoursOffset = 0) {
  return Timestamp.fromMillis(Date.now() - daysAgo * 86400000 - hoursOffset * 3600000);
}
function username(firstName, lastName, i) {
  const clean = (s) => s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  // ლათი��უ���ი ექვ��ვა������ნტ��ბი
  const map = { 'გ':'g','ი':'i','ო':'o','რ':'r','გ':'g','დ':'d','ა':'a','ვ':'v','ი':'i','ლ':'l','უ':'u','კ':'k','ა':'a','ნ':'n','ი':'i','ნ':'n','ო':'o','ბ':'b','ა':'a','ჩ':'ch','ო':'o','ე':'e','ს':'s','ო':'o','ფ':'f','ი':'i','ა':'a','ელ':'el','თ':'t','ა':'a','მ':'m','ა':'a','რ':'r','ზ':'z','უ':'u','რ':'r','ა':'a','ლ':'l','ი':'i','ა':'a','ვ':'v','ა':'a','ხ':'kh','ო':'o','ქ':'q','ე':'e','თ':'t','ი':'i','ს':'s','ა':'a','ნ':'n','დ':'d','რ':'r','ო':'o','გ':'g','ი':'i','ა':'a','მ':'m','ა':'a','ი':'i','ა':'a' };
  const seed = Math.random().toString(36).slice(2, 7);
  return `user_${seed}_${i}`;
}

// ─── MAIN SEED ────────────────────────────────────────────────────
async function seed() {
  console.log('🌱 GeoHub Seed Script Starting...\n');

  const batch_size = 400; // Firestore batch limit is 500
  let total = { users: 0, posts: 0, groups: 0, businesses: 0, places: 0 };

  // ─��� 1. Create Users ────────────────────────────────────────────
  console.log('👤 Creating 105 users...');
  const USERS = [];
  for (let i = 0; i < 105; i++) {
    const fname = FIRST_NAMES[i % FIRST_NAMES.length];
    const lname = LAST_NAMES[i % LAST_NAMES.length];
    const fullName = `${fname} ${lname}`;
    const uname = username(fname, lname, i);
    const city = rand(CITIES);
    const uid = fakeUid();
    USERS.push({ uid, fullName, username: uname, city });
  }

  let batch = db.batch();
  let opCount = 0;

  for (let i = 0; i < USERS.length; i++) {
    const u = USERS[i];
    const ref = db.collection('users').doc(u.uid);
    const followersCount = randInt(12, 4800);
    batch.set(ref, {
      uid: u.uid,
      id: u.uid,
      fullName: u.fullName,
      displayName: u.fullName,
      name: u.fullName,
      username: u.username,
      email: `${u.username}@geohub-seed.ge`,
      avatar: avatar(u.fullName),
      coverImage: cover(u.username),
      bio: rand(BIOS),
      city: u.city,
      cityScope: u.city,
      accountType: rand(['Explorer','Creator','Business','Standard']),
      explorerLevel: rand(['New Explorer','Explorer','Senior Explorer','Master Explorer']),
      interests: [rand(['ტექნოლოგია','ფოტოგრაფია','მუსიკა','სპ���რ�����','კვე���ა','მო���ზაუ����ბა','ხ��ლოვნე��ა','კი��ო','ლიტერატურა'])],
      followers: followersCount,
      following: randInt(50, 800),
      postsCount: 0,
      friendsCount: randInt(5, 200),
      visitedPlaces: randInt(0, 80),
      badges: [],
      isFirebaseUser: false,
      isSeedUser: true,
      geoId: String(10000 + i * 89 + randInt(0, 88)),
      createdAt: ago(randInt(60, 730)).toMillis(),
      updatedAt: Date.now(),
      lastSeen: ago(randInt(0, 14)).toMillis(),
    });
    opCount++;
    total.users++;

    if (opCount >= batch_size) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
      process.stdout.write('.');
    }
  }
  if (opCount > 0) { await batch.commit(); batch = db.batch(); opCount = 0; }
  console.log(`\n✅ ${total.users} users created`);

  // ── 2. Create Posts (5-8 per user) ────────────────────────────
  console.log('\n📝 Creating posts (5-8 per user)...');

  for (let i = 0; i < USERS.length; i++) {
    const u = USERS[i];
    const postCount = randInt(5, 8);
    for (let p = 0; p < postCount; p++) {
      const postTemplate = POSTS[(i * 7 + p * 13) % POSTS.length];
      const [text, tag] = postTemplate;
      const daysAgo = randInt(0, 180);
      const ref = db.collection('posts').doc();
      const hasImage = Math.random() > 0.45;
      const imageUrl = hasImage ? `https://picsum.photos/seed/${u.username}_${p}/600/400` : null;
      batch.set(ref, {
        authorId: u.uid,
        authorName: u.fullName,
        authorAvatar: avatar(u.fullName),
        authorUsername: u.username,
        authorCity: u.city,
        text: text + (Math.random() > 0.7 ? `\n\n📍 ${u.city}` : ''),
        type: 'post',
        postType: 'post',
        visibility: 'public',
        status: 'active',
        tags: [tag, rand(['tbilisi','georgia','lifestyle'])],
        imageUrl: imageUrl,
        images: imageUrl ? [imageUrl] : [],
        likeCount: randInt(2, 420),
        commentCount: randInt(0, 45),
        shareCount: randInt(0, 30),
        viewCount: randInt(10, 8000),
        saveCount: randInt(0, 50),
        reactionCount: randInt(0, 80),
        createdAt: ago(daysAgo, randInt(0, 23)),
        updatedAt: ago(daysAgo, randInt(0, 23)),
        isSeedPost: true,
      });
      opCount++;
      total.posts++;

      if (opCount >= batch_size) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
        process.stdout.write('.');
      }
    }
  }
  if (opCount > 0) { await batch.commit(); batch = db.batch(); opCount = 0; }
  console.log(`\n✅ ${total.posts} posts created`);

  // ── 3. Create Groups ───────────────────────────────────────────
  console.log('\n👥 Creating groups...');
  for (const g of GROUPS) {
    const creator = rand(USERS);
    const ref = db.collection('groups').doc();
    batch.set(ref, {
      ...g,
      creatorId: creator.uid,
      creatorName: creator.fullName,
      creatorAvatar: avatar(creator.fullName),
      coverImage: `https://picsum.photos/seed/group_${g.name.slice(0,8)}/900/300`,
      avatar: avatar(g.name),
      postsCount: randInt(20, 500),
      inviteEnabled: true,
      createdAt: ago(randInt(30, 500)),
      updatedAt: ago(randInt(0, 30)),
      isSeedGroup: true,
    });
    opCount++;
    total.groups++;
  }
  if (opCount > 0) { await batch.commit(); batch = db.batch(); opCount = 0; }
  console.log(`✅ ${total.groups} groups created`);

  // ── 4. Create Businesses ───────────────────────────────────────
  console.log('\n🏢 Creating businesses...');
  for (const b of BUSINESSES) {
    const owner = rand(USERS);
    const ref = db.collection('businesses').doc();
    batch.set(ref, {
      ...b,
      ownerId: owner.uid,
      ownerName: owner.fullName,
      logo: avatar(b.name),
      coverImage: `https://picsum.photos/seed/biz_${b.name.slice(0,8)}/900/300`,
      phone: `+995 5${randInt(10,99)} ${randInt(100,999)} ${randInt(100,999)}`,
      website: '',
      address: `${b.city}, ,,${rand(['მაინი','ვაკ���','გლდ���ნ���','ვერა','ნაძალ���დე���ი','ისა��ი'])} ${randInt(1,150)}`,
      hours: '10:00 - 22:00',
      tags: [b.category, b.city],
      isVerified: false,
      status: 'active',
      postCount: randInt(5, 80),
      createdAt: ago(randInt(30, 500)),
      updatedAt: ago(randInt(0, 30)),
      isSeedBusiness: true,
    });
    opCount++;
    total.businesses++;
  }
  if (opCount > 0) { await batch.commit(); batch = db.batch(); opCount = 0; }
  console.log(`✅ ${total.businesses} businesses created`);

  // ── 5. Create Places ───────────────────────────────────────────
  console.log('\n📍 Creating places...');
  for (const pl of PLACES) {
    const creator = rand(USERS);
    const ref = db.collection('places').doc();
    batch.set(ref, {
      ...pl,
      creatorId: creator.uid,
      creatorName: creator.fullName,
      coverImage: `https://picsum.photos/seed/place_${pl.name.slice(0,8)}/900/300`,
      photos: [`https://picsum.photos/seed/place_${pl.name.slice(0,6)}_1/600/400`],
      checkinCount: randInt(50, 5000),
      saveCount: randInt(20, 2000),
      status: 'active',
      createdAt: ago(randInt(60, 800)),
      updatedAt: ago(randInt(0, 60)),
      isSeedPlace: true,
    });
    opCount++;
    total.places++;
  }
  if (opCount > 0) { await batch.commit(); }
  console.log(`✅ ${total.places} places created`);

  // ── Summary ────────────────────────────────────────────────────
  console.log('\n🎉 Seed complete!');
  console.log('──────────────────────────────');
  console.log(`👤 Users:      ${total.users}`);
  console.log(`📝 Posts:      ${total.posts}`);
  console.log(`👥 Groups:     ${total.groups}`);
  console.log(`🏢 Businesses: ${total.businesses}`);
  console.log(`📍 Places:     ${total.places}`);
  console.log('──────────────────────────────');
  console.log('✅ Cloudflare/Firebase ჩა�����ი��თვა 1-2 წ��-ში!');
}

seed().catch(console.error);
