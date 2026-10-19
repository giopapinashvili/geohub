/** Shared place taxonomy. Attributes remain separate from categories. */
export const PLACE_GROUPS = [
  ['food', 'საჭმელი და სასმელი', 'fork-knife', '#d56a28'],
  ['shopping', 'მაღაზიები', 'shopping-bag', '#c54382'],
  ['health', 'ჯანმრთელობა', 'first-aid', '#db5263'],
  ['finance', 'ფინანსები', 'bank', '#4872b8'],
  ['transport', 'ტრანსპორტი', 'navigation-arrow', '#327fc2'],
  ['auto', 'ავტომობილები', 'car', '#5e7b91'],
  ['education', 'განათლება', 'graduation-cap', '#7966bf'],
  ['entertainment', 'გართობა', 'confetti', '#b658b5'],
  ['sports', 'სპორტი', 'soccer-ball', '#3b9865'],
  ['nature', 'ბუნება და დასვენება', 'tree', '#3c9659'],
  ['culture', 'კულტურა და ისტორია', 'castle-turret', '#a68142'],
  ['stay', 'განთავსება', 'bed', '#3c8c8c'],
  ['services', 'სერვისები და ოფისები', 'briefcase', '#697f9b'],
  ['public', 'საზოგადოებრივი ობიექტები', 'buildings', '#687d91'],
  ['infrastructure', 'ინფრასტრუქტურა', 'map-pin', '#71878c'],
  ['other', 'სხვა', 'map-pin', '#7b746f'],
].map(([id, label, icon, tone]) => ({ id, label, icon, tone }));
const GROUPS = Object.fromEntries(PLACE_GROUPS.map(group => [group.id, group]));

const ROWS = {
  food: [
    ['food','კვება','fork-knife'], ['restaurant','რესტორანი','fork-knife'], ['cafe','კაფე','coffee'],
    ['bar','ბარი','martini'], ['pub','პაბი','wine'], ['wine','ღვინის ბარი','wine'], ['bakery','საცხობი','hamburger'],
    ['fast-food','სწრაფი კვება','hamburger'], ['ice-cream','ნაყინი','coffee'], ['food-court','კვების სივრცე','fork-knife'],
    ['confectionery','საკონდიტრო','gift'], ['tea','ჩაის მაღაზია','coffee'], ['coffee-shop','ყავის მაღაზია','coffee'],
  ],
  shopping: [
    ['shopping','მაღაზია','shopping-bag'], ['supermarket','სუპერმარკეტი','shopping-cart'], ['convenience','სასურსათო მაღაზია','shopping-cart'],
    ['mall','სავაჭრო ცენტრი','buildings'], ['market','ბაზარი','storefront'], ['department-store','უნივერმაღი','shopping-bag'],
    ['clothes','ტანსაცმელი','t-shirt'], ['shoes','ფეხსაცმელი','shopping-bag'], ['electronics','ელექტრონიკა','device-mobile'],
    ['computer','კომპიუტერები','laptop'], ['mobile-phone','ტელეფონების მაღაზია','device-mobile'], ['furniture','ავეჯი','couch'],
    ['houseware','სახლის ნივთები','house-line'], ['hardware','სამშენებლო და სამეურნეო','wrench'], ['wallpaper','შპალერის მაღაზია','paint-brush'],
    ['paint','საღებავები','paint-brush'], ['florist','ყვავილების მაღაზია','flower'], ['books','წიგნის მაღაზია','book-open'],
    ['stationery','საკანცელარიო','pencil-line'], ['gifts','საჩუქრები და სუვენირები','gift'], ['jewelry','საიუველირო','sparkle'],
    ['cosmetics','კოსმეტიკა','sparkle'], ['toys','სათამაშოები','baby'], ['sports-shop','სპორტული მაღაზია','soccer-ball'],
    ['pet-shop','ზოომაღაზია','dog'], ['butcher','ხორცის მაღაზია','shopping-cart'], ['greengrocer','ხილ-ბოსტნეული','shopping-cart'],
    ['seafood','თევზისა და ზღვის პროდუქტები','shopping-cart'], ['dairy','რძის პროდუქტები','shopping-cart'], ['beverages','სასმელების მაღაზია','wine'],
    ['alcohol','ალკოჰოლის მაღაზია','wine'], ['tobacco','თამბაქოს მაღაზია','storefront'], ['second-hand','მეორადი ნივთები','shopping-bag'],
    ['wholesale','საბითუმო მაღაზია','package'], ['outdoor-shop','ლაშქრობის აღჭურვილობა','tent'], ['fabric','ქსოვილები','t-shirt'],
    ['musical-instrument','მუსიკალური ინსტრუმენტები','music-notes'], ['garden-centre','ბაღის მაღაზია','tree'],
    ['retail-building','სავაჭრო შენობა','buildings'],
  ],
  health: [
    ['health','ჯანმრთელობის მომსახურება','first-aid'],
    ['hospital','საავადმყოფო','first-aid'], ['clinic','კლინიკა','first-aid-kit'], ['doctor','ექიმის კაბინეტი','first-aid-kit'],
    ['dentist','სტომატოლოგია','first-aid'], ['pharmacy','აფთიაქი','first-aid-kit'], ['optician','ოპტიკა','eye'],
    ['laboratory','ლაბორატორია','first-aid'], ['psychologist','ფსიქოლოგი','heart'], ['physiotherapy','ფიზიოთერაპია','first-aid'],
    ['veterinary','ვეტერინარი','dog'], ['medical-supply','სამედიცინო აღჭურვილობა','first-aid-kit'],
  ],
  finance: [
    ['financial-services','ფინანსური მომსახურება','wallet'],
    ['bank','ბანკი','bank'], ['atm','ბანკომატი','money'], ['payment-terminal','გადახდის აპარატი','credit-card'],
    ['crypto-atm','კრიპტო აპარატი','coins'], ['pawnshop','ლომბარდი','coins'], ['microfinance','მიკროსაფინანსო','wallet'],
    ['exchange','ვალუტის გადაცვლა','currency-circle-dollar'], ['insurance','დაზღვევა','shield-check'],
  ],
  transport: [
    ['transit-stop','საზოგადოებრივი ტრანსპორტის გაჩერება','signpost'],
    ['metro','მეტროს სადგური','navigation-arrow'], ['metro-entrance','მეტროს შესასვლელი','navigation-arrow'],
    ['bus-stop','ავტობუსის გაჩერება','signpost'], ['bus-station','ავტოსადგური','truck'], ['rail-station','რკინიგზის სადგური','navigation-arrow'],
    ['taxi','ტაქსის გაჩერება','car'], ['airport','აეროპორტი','paper-plane-tilt'], ['cable-car','საბაგირო','navigation-arrow'],
    ['bicycle-rental','ველოსიპედის გაქირავება','navigation-arrow'], ['bicycle-parking','ველოსიპედის სადგომი','map-pin'],
  ],
  auto: [
    ['car-dealer','ავტომობილების გაყიდვა','car'], ['car-repair','ავტოსერვისი','wrench'], ['tires','საბურავები და ვულკანიზაცია','car'],
    ['vehicle-inspection','ტექინსპექტირება','shield-check'],
    ['car-parts','ავტონაწილები','wrench'], ['car-wash','ავტოსამრეცხაო','car'], ['car-rental','ავტოგაქირავება','car'],
    ['fuel','ავტოგასამართი სადგური','car'], ['charging-station','ელექტრომობილის დამტენი','lightning'], ['parking','ავტოსადგომი','car'],
    ['motorcycle','მოტოციკლები','car'], ['bicycle-shop','ველოსიპედის მაღაზია','navigation-arrow'],
  ],
  education: [
    ['school','სკოლა','graduation-cap'], ['university','უნივერსიტეტი','graduation-cap'], ['college','კოლეჯი','graduation-cap'],
    ['kindergarten','საბავშვო ბაღი','baby'], ['childcare','ბავშვის მოვლა','baby'], ['tutoring','რეპეტიტორი და სასწავლო ცენტრი','book-open'],
    ['language-school','ენების სკოლა','translate'], ['music-school','მუსიკისა და სიმღერის სწავლება','music-notes'],
    ['dance-school','ცეკვის სკოლა','music-notes'], ['art-school','ხელოვნების სკოლა','palette'], ['driving-school','ავტოსკოლა','car'],
    ['coding-school','პროგრამირების სკოლა','laptop'], ['training','კურსები და ტრენინგი','book-open'],
    ['education-campus','საგანმანათლებლო სივრცე','graduation-cap'],
  ],
  entertainment: [
    ['gaming','გეიმინგ ცენტრი','game-controller'], ['internet-cafe','ინტერნეტკაფე','laptop'], ['vr','ვირტუალური რეალობა','game-controller'], ['cinema','კინოთეატრი','film-strip'],
    ['nightlife','ღამის გართობა','martini'], ['nightclub','ღამის კლუბი','music-notes'], ['karaoke','კარაოკე','microphone-stage'],
    ['bowling','ბოულინგი','target'], ['billiards','ბილიარდი','target'], ['escape-room','ესქეიფ რუმი','key'],
    ['playground','სათამაშო მოედანი','baby'], ['kids-centre','ბავშვთა გასართობი ცენტრი','confetti'], ['circus','ცირკი','confetti'],
    ['theme-park','ატრაქციონები','confetti'], ['water-park','აკვაპარკი','waves'], ['zoo','ზოოპარკი','dog'], ['casino','კაზინო','coins'],
    ['event-venue','ღონისძიების სივრცე','calendar-blank'],
  ],
  sports: [
    ['sports','სპორტული სივრცე','soccer-ball'], ['gym','სპორტდარბაზი','barbell'], ['stadium','სტადიონი','soccer-ball'],
    ['sports-pitch','სპორტული მოედანი','soccer-ball'], ['swimming-pool','საცურაო აუზი','waves'], ['yoga','იოგა','heart'],
    ['fitness-station','გარე სავარჯიშო სივრცე','barbell'], ['sports-school','სპორტული სკოლა','medal'],
  ],
  nature: [
    ['leisure','დასასვენებელი სივრცე','tree'],
    ['nature','ბუნება','mountains'], ['park','პარკი','tree'], ['garden','ბაღი','flower'], ['picnic-site','საპიკნიკე ადგილი','tree'],
    ['viewpoint','ხედის ადგილი','binoculars'], ['beach','სანაპირო','umbrella'], ['peak','მწვერვალი','mountains'], ['spring','წყარო','waves'],
    ['nature-reserve','დაცული ტერიტორია','tree'], ['camping','კემპინგი','tent'],
  ],
  culture: [
    ['history','ისტორიული ადგილი','castle-turret'], ['museum','მუზეუმი','bank'], ['gallery','გალერეა','palette'],
    ['theatre','თეატრი','mask-happy'], ['library','ბიბლიოთეკა','book-open'], ['monument','ძეგლი','castle-turret'],
    ['memorial','მემორიალი','castle-turret'], ['church','რელიგიური ადგილი','church'], ['attraction','ღირსშესანიშნაობა','binoculars'],
    ['artwork','ხელოვნების ნიმუში','palette'], ['community-centre','საზოგადოებრივი ცენტრი','users-three'],
  ],
  stay: [
    ['hotel','სასტუმრო','bed'], ['hostel','ჰოსტელი','bed'], ['guest-house','საოჯახო სასტუმრო','house-line'],
    ['apartment','აპარტამენტი','buildings'], ['motel','მოტელი','bed'],
    ['dormitory','საერთო საცხოვრებელი','buildings'],
    ['lodging-building','სასტუმროს შენობა','buildings'],
  ],
  services: [
    ['office','ოფისი','briefcase'], ['real-estate','უძრავი ქონების სააგენტო','house-line'], ['telecom','ინტერნეტისა და კავშირის ოფისი','phone'],
    ['lawyer','იურიდიული მომსახურება','briefcase'], ['notary','ნოტარიუსი','stamp'], ['accountant','ბუღალტერია','receipt'], ['travel-agency','ტურისტული სააგენტო','globe-simple'],
    ['employment-agency','დასაქმების სააგენტო','briefcase'], ['it-services','IT სერვისები','laptop'], ['coworking','საერთო სამუშაო სივრცე','users-three'],
    ['beauty','სილამაზის სალონი','sparkle'], ['hairdresser','თმის სალონი','user'], ['tattoo','ტატუ და პირსინგი','paint-brush'],
    ['spa','სპა','waves'], ['massage','მასაჟი','heart'], ['laundry','სამრეცხაო','t-shirt'], ['dry-cleaning','ქიმწმენდა','t-shirt'],
    ['phone-repair','ტელეფონის შეკეთება','device-mobile'], ['repair','შეკეთების სერვისი','wrench'], ['tailor','ატელიე','t-shirt'],
    ['locksmith','გასაღებები და საკეტები','key'], ['printing','ბეჭდვა და ასლები','copy'], ['photography','ფოტოსტუდია','camera'],
    ['craft','სახელოსნო','wrench'], ['cleaning','დასუფთავება','sparkle'], ['logistics','ლოჯისტიკა','truck'],
    ['office-building','საოფისე შენობა','buildings'], ['commercial-building','კომერციული შენობა','buildings'],
  ],
  public: [
    ['post-office','ფოსტა','envelope'], ['police','პოლიცია','shield-check'], ['fire-station','სახანძრო','fire'],
    ['government','სახელმწიფო დაწესებულება','buildings'], ['courthouse','სასამართლო','bank'], ['embassy','საელჩო','flag'],
    ['social-facility','სოციალური დაწესებულება','users'], ['warehouse','საწყობი','package'], ['industrial','საწარმო','buildings'],
    ['cemetery','სასაფლაო','map-pin'], ['public-service','საზოგადოებრივი ობიექტი','buildings'], ['city','ქალაქის სივრცე','buildings'],
  ],
  infrastructure: [
    ['traffic-signals','შუქნიშანი','signpost'], ['drinking-water','სასმელი წყალი','waves'], ['fountain','შადრევანი','waves'],
    ['water-point','წყლის პუნქტი','waves'], ['toilets','საპირფარეშო','map-pin'], ['bench','სკამი','couch'], ['shelter','მოსაცდელი და თავშესაფარი','house-line'],
    ['post-box','საფოსტო ყუთი','envelope'], ['parcel-locker','ამანათის აპარატი','package'], ['recycling','გადამუშავების პუნქტი','arrows-clockwise'],
    ['vending-machine','ავტომატი','storefront'], ['waste-basket','ნაგვის ურნა','trash'], ['emergency-point','საგანგებო დახმარების პუნქტი','first-aid'],
    ['information','საინფორმაციო პუნქტი','info'], ['public-bookcase','წიგნების საჯარო თარო','book-open'],
  ],
  other: [['other','სხვა','map-pin']],
};

export const PLACE_TAXONOMY = Object.entries(ROWS).flatMap(([group, rows]) => rows.map(([id, label, icon]) => ({ id, label, icon, tone: GROUPS[group].tone, group })));
const BY_ID = Object.fromEntries(PLACE_TAXONOMY.map(category => [category.id, category]));
const BY_LABEL = Object.fromEntries(PLACE_TAXONOMY.map(category => [category.label, category.id]));
export const CATEGORY_ALIASES = {
  cafes:'cafe', coffee:'cafe', restaurants:'restaurant', bars:'bar', 'wine-bar':'wine', winery:'wine',
  hotels:'hotel', guesthouse:'guest-house', guesthouses:'guest-house', apartments:'apartment',
  shop:'shopping', store:'shopping', clothing:'clothes', 'department_store':'department-store',
  'fast_food':'fast-food', 'ice_cream':'ice-cream', 'food_court':'food-court',
  'car_repair':'car-repair', 'car_parts':'car-parts', 'car_wash':'car-wash', 'car_rental':'car-rental', 'tire-service':'tires', tyres:'tires',
  dental:'dentist', vet:'veterinary', fitness:'gym', theater:'theatre', 'beauty-salon':'beauty', 'hair-salon':'hairdresser', barbershop:'hairdresser',
  'kids-school':'tutoring', 'kids-cafe':'kids-centre', 'online-education':'training', 'language_school':'language-school',
  'music_school':'music-school', 'driving_school':'driving-school', 'dance_school':'dance-school',
  'real_estate':'real-estate', estate_agent:'real-estate', 'travel_agency':'travel-agency', telecoms:'telecom',
  subway:'metro', subway_entrance:'metro-entrance', bus_stop:'bus-stop', bus_station:'bus-station', station:'rail-station',
  drinking_water:'drinking-water', traffic_signals:'traffic-signals', post_office:'post-office', fire_station:'fire-station',
  'nature_reserve':'nature-reserve', 'picnic_site':'picnic-site', 'camp_site':'camping', 'sports_centre':'sports',
};
export function canonicalCategory(value) {
  const id = String(value || '').trim();
  if (BY_ID[id]) return id;
  return BY_LABEL[id] || CATEGORY_ALIASES[id.toLowerCase()] || 'other';
}
export function taxonomyCategory(value) { return BY_ID[canonicalCategory(value)]; }
export function matchesPlaceCategory(place, selected) {
  if (!selected || selected === 'all') return true;
  const category = taxonomyCategory(place.category || place.categoryId);
  return category.id === selected || (selected === 'metro' && category.id === 'metro-entrance') || (GROUPS[selected] && category.group === selected);
}

const AMENITIES = {
  vehicle_inspection:'vehicle-inspection',
  restaurant:'restaurant', cafe:'cafe', bar:'bar', pub:'pub', biergarten:'bar', fast_food:'fast-food', food_court:'food-court', ice_cream:'ice-cream',
  hospital:'hospital', clinic:'clinic', doctors:'doctor', dentist:'dentist', pharmacy:'pharmacy', veterinary:'veterinary',
  bank:'bank', atm:'atm', payment_terminal:'payment-terminal', payment_centre:'payment-terminal', bureau_de_change:'exchange',
  school:'school', university:'university', college:'college', kindergarten:'kindergarten', childcare:'childcare', language_school:'language-school', music_school:'music-school', driving_school:'driving-school', training:'training', dancing_school:'dance-school',
  cinema:'cinema', theatre:'theatre', nightclub:'nightclub', casino:'casino', gambling:'casino', internet_cafe:'internet-cafe', money_transfer:'financial-services', events_venue:'event-venue', community_centre:'community-centre', arts_centre:'gallery', library:'library',
  police:'police', fire_station:'fire-station', post_office:'post-office', courthouse:'courthouse', townhall:'government', embassy:'embassy', social_facility:'social-facility', place_of_worship:'church', marketplace:'market',
  bus_station:'bus-station', taxi:'taxi', bicycle_rental:'bicycle-rental', bicycle_parking:'bicycle-parking', car_rental:'car-rental', car_wash:'car-wash', fuel:'fuel', charging_station:'charging-station', parking:'parking', parking_entrance:'parking',
  drinking_water:'drinking-water', fountain:'fountain', water_point:'water-point', toilets:'toilets', bench:'bench', shelter:'shelter', post_box:'post-box', parcel_locker:'parcel-locker', recycling:'recycling', waste_disposal:'recycling', waste_basket:'waste-basket', vending_machine:'vending-machine', public_bookcase:'public-bookcase',
};
const SHOPS = {
  supermarket:'supermarket', convenience:'convenience', mall:'mall', department_store:'department-store', general:'shopping', variety_store:'shopping', kiosk:'convenience',
  bakery:'bakery', pastry:'confectionery', confectionery:'confectionery', chocolate:'confectionery', coffee:'coffee-shop', tea:'tea', butcher:'butcher', greengrocer:'greengrocer', seafood:'seafood', dairy:'dairy', cheese:'dairy', beverages:'beverages', alcohol:'alcohol', wine:'alcohol', tobacco:'tobacco',
  clothes:'clothes', fashion:'clothes', shoes:'shoes', electronics:'electronics', computer:'computer', mobile_phone:'mobile-phone', furniture:'furniture', kitchen:'furniture', household_linen:'houseware', houseware:'houseware', appliances:'electronics', hardware:'hardware', doityourself:'hardware', trade:'hardware', wallpaper:'wallpaper', paint:'paint', bathroom_furnishing:'hardware', carpet:'houseware', curtains:'houseware',
  florist:'florist', garden_centre:'garden-centre', books:'books', stationery:'stationery', gift:'gifts', jewelry:'jewelry', watches:'jewelry', cosmetics:'cosmetics', perfume:'cosmetics', toys:'toys', baby_goods:'toys', sports:'sports-shop', outdoor:'outdoor-shop', pet:'pet-shop', fabric:'fabric', wool:'fabric', musical_instrument:'musical-instrument', second_hand:'second-hand', charity:'second-hand', wholesale:'wholesale',
  car:'car-dealer', car_repair:'car-repair', car_parts:'car-parts', tyres:'tires', motorcycle:'motorcycle', motorcycle_repair:'car-repair', bicycle:'bicycle-shop',
  pawnbroker:'pawnshop', money_lender:'microfinance', optician:'optician', medical_supply:'medical-supply', hearing_aids:'medical-supply',
  beauty:'beauty', hairdresser:'hairdresser', tattoo:'tattoo', massage:'massage', laundry:'laundry', dry_cleaning:'dry-cleaning', tailor:'tailor', locksmith:'locksmith', copyshop:'printing', photo:'photography', travel_agency:'travel-agency', repair:'repair', electronics_repair:'repair', mobile_phone_repair:'phone-repair', telecommunication:'telecom',
};
const LEISURE = { park:'park', garden:'garden', nature_reserve:'nature-reserve', playground:'playground', indoor_play:'kids-centre', amusement_arcade:'gaming', adult_gaming_centre:'casino', escape_game:'escape-room', bowling_alley:'bowling', sports_centre:'sports', fitness_centre:'gym', fitness_station:'fitness-station', stadium:'stadium', pitch:'sports-pitch', swimming_pool:'swimming-pool', water_park:'water-park', dance:'dance-school', sauna:'spa', spa:'spa' };
const TOURISM = { hotel:'hotel', hostel:'hostel', guest_house:'guest-house', apartment:'apartment', motel:'motel', camp_site:'camping', caravan_site:'camping', museum:'museum', gallery:'gallery', attraction:'attraction', artwork:'artwork', viewpoint:'viewpoint', zoo:'zoo', theme_park:'theme-park', picnic_site:'picnic-site', information:'information' };
const OFFICES = { estate_agent:'real-estate', telecommunication:'telecom', lawyer:'lawyer', notary:'notary', accountant:'accountant', insurance:'insurance', employment_agency:'employment-agency', it:'it-services', coworking:'coworking', government:'government', diplomatic:'embassy', educational_institution:'training', logistics:'logistics', financial:'financial-services', financial_advisor:'financial-services' };

// A building-use tag describes the mapped structure, not a verified operating
// merchant. Keep generic commercial structures separate from actual shops.
export const OSM_BUILDING_CATEGORIES = {
  warehouse:'warehouse', industrial:'industrial', works:'industrial', school:'school', hospital:'hospital',
  university:'university', college:'college', kindergarten:'kindergarten', library:'library',
  fire_station:'fire-station', government:'government', public:'public-service', civic:'public-service',
  train_station:'rail-station', office:'office-building', commercial:'commercial-building',
  retail:'retail-building', dormitory:'dormitory', hotel:'lodging-building', church:'church',
  cinema:'cinema', stadium:'stadium', sports_centre:'sports',
};
const EDUCATION = { university:'university', school:'school', college:'college', kindergarten:'kindergarten',
  language_school:'language-school', language:'language-school', music_school:'music-school', music:'music-school',
  driving_school:'driving-school', driving:'driving-school', art_school:'art-school', art:'art-school',
  dance:'dance-school', tutoring:'tutoring', training:'training', course:'training', centre:'training',
};

export function categoryFromOsm(tags = {}) {
  if (tags.aeroway === 'aerodrome') return 'airport';
  if (tags.aerialway === 'station') return 'cable-car';
  if (tags.amenity === 'theatre' && tags['theatre:type'] === 'circus') return 'circus';
  if (tags.amenity === 'drinking_water' && tags.drinking_water === 'no') return 'water-point';
  if (tags.railway === 'subway_entrance') return 'metro-entrance';
  if ((tags.railway === 'station' || tags.public_transport === 'station') && (tags.station === 'subway' || tags.subway === 'yes')) return 'metro';
  if (tags.highway === 'bus_stop' || (['platform','stop_position'].includes(tags.public_transport) && tags.bus === 'yes')) return 'bus-stop';
  if (tags.highway === 'traffic_signals') return 'traffic-signals';
  if (tags.amenity === 'atm' && (tags.cryptocurrency === 'yes' || tags['currency:XBT'] === 'yes' || tags['currency:BTC'] === 'yes')) return 'crypto-atm';
  if (tags.amenity === 'vending_machine' && /payment|bill_payment/.test(tags.vending || '')) return 'payment-terminal';
  if (tags.amenity && AMENITIES[tags.amenity]) return AMENITIES[tags.amenity];
  if (tags.shop) return SHOPS[tags.shop] || 'shopping';
  if (tags.healthcare) return ({hospital:'hospital',clinic:'clinic',doctor:'doctor',dentist:'dentist',laboratory:'laboratory',psychotherapist:'psychologist',physiotherapist:'physiotherapy'})[tags.healthcare] || 'health';
  if (tags.leisure) return LEISURE[tags.leisure] || 'leisure';
  if (tags.tourism) return TOURISM[tags.tourism] || 'attraction';
  if (tags.office) return OFFICES[tags.office] || 'office';
  if (tags.craft) return ({car_repair:'car-repair',electrician:'repair',electronics_repair:'repair',shoemaker:'repair',tailor:'tailor',locksmith:'locksmith',photographer:'photography',printer:'printing',cleaning:'cleaning'})[tags.craft] || 'craft';
  if (tags.amenity) return 'public-service';
  if (tags.education && !['no','yes','none'].includes(tags.education)) {
    if (tags['disused:amenity'] || tags['abandoned:amenity'] || tags['was:amenity']) return 'education-campus';
    return EDUCATION[tags.education] || 'education-campus';
  }
  if (tags.landuse === 'education') return 'education-campus';
  if (tags.railway === 'station' || tags.railway === 'halt') return 'rail-station';
  if (tags.public_transport) return 'transit-stop';
  if (tags.emergency) return 'emergency-point';
  if (tags.historic) return ({monument:'monument',memorial:'memorial'})[tags.historic] || 'history';
  if (tags.natural) return ({spring:'spring',peak:'peak',beach:'beach'})[tags.natural] || 'nature';
  if (tags.man_made === 'water_tap' || tags.man_made === 'water_well') return tags.drinking_water === 'yes' ? 'drinking-water' : 'water-point';
  if (tags.building) return OSM_BUILDING_CATEGORIES[tags.building] || null;
  return null;
}

/** Only explicitly mapped attributes are asserted; missing means unknown. */
export function facetsFromOsm(tags = {}) {
  const facets = {};
  for (const diet of ['vegan','vegetarian','halal','kosher','gluten_free','lactose_free']) {
    if (['yes','only'].includes(tags[`diet:${diet}`])) (facets.diets ||= []).push(diet.replaceAll('_','-'));
  }
  if (tags.cuisine) facets.cuisine = tags.cuisine.split(';').map(value=>value.trim()).filter(Boolean);
  if (['yes','limited','no'].includes(tags.wheelchair)) facets.wheelchair = tags.wheelchair;
  if (tags.outdoor_seating === 'yes') facets.outdoorSeating = true;
  if (tags.indoor === 'yes') facets.indoor = true;
  if (tags.internet_access && tags.internet_access !== 'no') facets.internetAccess = tags.internet_access;
  if (tags.takeaway === 'yes') facets.takeaway = true;
  if (tags.delivery === 'yes') facets.delivery = true;
  if (tags.reservation) facets.reservation = tags.reservation;
  if (tags.access) facets.access = tags.access;
  if (tags.fee === 'yes' || tags.fee === 'no') facets.fee = tags.fee === 'yes';
  if (tags.level) facets.level = tags.level;
  return facets;
}
