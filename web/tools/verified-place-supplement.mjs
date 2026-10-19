/** Official directory facts supplement missing OSM POIs. Nothing is geocoded by
 * guessing a street center. Coordinates retain their actual source and accuracy.
 * Reviewed 2026-10-19; operating hours/prices are not copied unless explicit.
 */
export const VERIFIED_PLACE_SUPPLEMENT = [
  {
    id:'directory_british_university_tbilisi', name:'ბრიტანული უნივერსიტეტი', category:'university',
    aliases:['British University','British University in Georgia','ბრიტანული სასწავლო უნივერსიტეტი'],
    address:'ვეფხისტყაოსნის ქუჩა 92', coordinateSourceId:'osm_way_661042367',
    description:'ბრიტანული უნივერსიტეტის თბილისის მისამართი ოფიციალურ საიტზე მითითებულია ვეფხისტყაოსნის ქუჩის 92 ნომერში. პროგრამებისა და მიღების პირობები იხილე უნივერსიტეტის საიტზე.',
    sourceUrl:'https://www.britishuni.edu.ge/en/privacy-policy', website:'https://www.britishuni.edu.ge/en',
    coordinateAccuracy:'approximate-center', sourceCertainty:'official-address-matched-osm-building',
    coordinateNote:'ოფიციალურ მისამართთან შეჯერებული შენობის სავარაუდო ცენტრი; შესასვლელი ცალკე დადასტურებული არ არის.',
  },
  {
    id:'directory_ken_walker_university_tbilisi', name:'კენ ვოლკერის საერთაშორისო უნივერსიტეტი', category:'university',
    aliases:['Ken Walker International University','KWIU','კვსუ'], address:'გუდამაყრის ქუჩა 4',
    lat:41.770107072166674, lng:44.795458677382186,
    description:'კენ ვოლკერის საერთაშორისო უნივერსიტეტის საკონტაქტო მისამართია გუდამაყრის ქუჩა 4. უნივერსიტეტის მისაღები სამსახურისა და პროგრამების ინფორმაცია ხელმისაწვდომია ოფიციალურ საიტზე.',
    sourceUrl:'https://kwiu.edu.ge/en/contact', website:'https://kwiu.edu.ge/', phone:'+995 599 63 55 33',
    coordinateAccuracy:'approximate-center', sourceCertainty:'publisher-contact-map-center',
    coordinateNote:'უნივერსიტეტის ოფიციალურ საკონტაქტო გვერდზე ჩასმული რუკის ცენტრი; ზუსტი შესასვლელი დადასტურებული არ არის.',
  },
  {
    id:'directory_alterbridge_university_tbilisi', name:'უნივერსიტეტი ალტერბრიჯი', category:'university',
    aliases:['Alterbridge University','ალტერბრიჯი'], address:'წყნეთის გზატკეცილი 67',
    coordinateSourceId:'osm_way_1239218926',
    description:'ალტერბრიჯის უნივერსიტეტი ოფიციალურ საკონტაქტო მისამართად უთითებს ბაგებს, წყნეთის გზატკეცილს 67. პროგრამებისა და ჩარიცხვის საკითხებზე ინფორმაციის მიღება შესაძლებელია უნივერსიტეტისგან.',
    sourceUrl:'https://alterbridge.edu.ge/contact/', website:'https://alterbridge.edu.ge/', phone:'+995 558 198 198',
    coordinateAccuracy:'approximate-center', sourceCertainty:'official-address-matched-osm-building',
    coordinateNote:'ოფიციალურ მისამართთან შეჯერებული შენობის სავარაუდო ცენტრი; ოფიციალური საიტის ზოგადი რუკის ცენტრი მისგან დაახლოებით 170 მეტრით განსხვავდება.',
  },
  {
    id:'directory_east_west_university_gorgasali', name:'აღმოსავლეთ-დასავლეთ უნივერსიტეტი — გორგასლის კამპუსი', category:'university',
    aliases:['East West University','East-West University','EWU','აღმოსავლეთ დასავლეთ უნივერსიტეტი'], address:'ვახტანგ გორგასლის ქუჩა 9',
    lat:41.687924697270674, lng:44.81418869537401,
    description:'აღმოსავლეთ-დასავლეთ უნივერსიტეტის გორგასლის კამპუსი. უნივერსიტეტის ოფიციალური გვერდი ასევე ასახელებს უზნაძის კამპუსს; სასურველი პროგრამის ან სამსახურის მდებარეობა გადაამოწმე უნივერსიტეტთან.',
    sourceUrl:'https://eastwest.edu.ge/კონტაქტი/', website:'https://eastwest.edu.ge/', phone:'+995 32 215 71 72',
    coordinateAccuracy:'approximate-center', sourceCertainty:'publisher-contact-map-center',
    coordinateNote:'გორგასლის კამპუსის ოფიციალურ გვერდზე ჩასმული რუკის ცენტრი; შესასვლელი დადასტურებული არ არის.',
  },
  {
    id:'directory_geomedi_university_tbilisi', name:'უნივერსიტეტი გეომედი', category:'university',
    aliases:['University Geomedi','Teaching University Geomedi','გეომედი'], address:'მეფე სოლომონ II-ის ქუჩა 4',
    lat:41.676770114562345, lng:44.8231468694475,
    description:'უნივერსიტეტი გეომედი თბილისში, მეფე სოლომონ II-ის ქუჩის 4 ნომერშია. ოფიციალური საიტი აქვეყნებს საგანმანათლებლო პროგრამებსა და სტუდენტთა მომსახურების ინფორმაციას.',
    sourceUrl:'https://geomedi.edu.ge/?lang=en', website:'https://geomedi.edu.ge/', phone:'+995 32 275 25 13',
    coordinateAccuracy:'approximate-center', sourceCertainty:'publisher-contact-map-center',
    coordinateNote:'უნივერსიტეტის ოფიციალურ საიტზე ჩასმული რუკის ცენტრი; უნივერსიტეტი და მისი სტომატოლოგიური კლინიკა სხვადასხვა ობიექტებია.',
  },
  ...[
    ['italian_library','სტეფანო პაოლინის სახელობის იტალიური ბიბლიოთეკა',['Stefano Paolini Italian Library','იტალიური ბიბლიოთეკა']],
    ['ukrainian_library','უკრაინული ბიბლიოთეკა',['Ukrainian Library','უკრაინული ლიტერატურა']],
    ['wine_library','ღვინისა და ვაზის ბიბლიოთეკა',['Wine and Vine Library','ღვინის ბიბლიოთეკა']],
  ].map(([key,name,aliases])=>({
    id:`directory_nplg_${key}`, name, aliases, category:'library', address:'ლადო გუდიაშვილის ქუჩა 7',
    coordinateSourceId:'osm_node_916895312', parentPlaceId:'osm_node_11427406837', indoor:true,
    description:`${name} ეროვნული ბიბლიოთეკის ოფიციალური ცნობარის მიხედვით III კორპუსშია განთავსებული. ეს ეროვნული ბიბლიოთეკის შიდა სივრცეა; რუკაზე შენობის მდებარეობაა ნაჩვენები.`,
    sourceUrl:'https://www.nplg.gov.ge/geo/Location', website:'https://www.nplg.gov.ge/', phone:'+995 32 297 16 61',
    coordinateAccuracy:'approximate-center', sourceCertainty:'official-directory-shared-building',
    coordinateNote:'ეროვნული ბიბლიოთეკის III კორპუსის მდებარეობა; შიდა ოთახის ან შესასვლელის კოორდინატები დადასტურებული არ არის.',
  })),
  {
    id:'directory_nplg_agricultural_library', name:'აგრობიბლიოთეკა — ეროვნული ბიბლიოთეკა', category:'library',
    aliases:['Agricultural Library','Agrolibrary','აგრო ბიბლიოთეკა'], address:'სულხან ცინცაძის ქუჩა 63',
    coordinateSourceId:'osm_way_1077487801', parentPlaceId:'osm_way_1077487801', indoor:true,
    description:'აგრობიბლიოთეკა ეროვნული ბიბლიოთეკის ოფიციალური ცნობარის მიხედვით VI, ვახტანგ VI-ის სახელობის კორპუსშია განთავსებული. რუკაზე აღნიშნულია ამ შენობის მდებარეობა.',
    sourceUrl:'https://www.nplg.gov.ge/geo/Location', website:'https://www.nplg.gov.ge/', phone:'+995 32 297 16 61',
    coordinateAccuracy:'approximate-center', sourceCertainty:'official-directory-shared-building',
    coordinateNote:'ეროვნული ბიბლიოთეკის VI კორპუსის სავარაუდო ცენტრი; შიდა სივრცის შესასვლელი ცალკე დადასტურებული არ არის.',
  },
];

/** Multi-campus relations must not place their map pin midway between campuses. */
export const VERIFIED_SITE_ANCHORS = [
  {id:'osm_relation_16510616',anchorId:'osm_relation_900361',address:'ილია ჭავჭავაძის გამზირი 1',sourceUrl:'https://www.tsu.ge/en/page/Administrative-Departments'},
  {id:'osm_relation_16507696',anchorId:'osm_relation_20406737',address:'მერაბ კოსტავას ქუჩა 77',sourceUrl:'https://www.gtu.edu.ge/en/contact/'},
  {id:'osm_relation_16510614',anchorId:'osm_way_61965437',address:'დავით აღმაშენებლის ხეივანი 2, მე-13 კმ',sourceUrl:'https://ibsu.edu.ge/en/contact/'},
  {id:'osm_relation_16510613',anchorId:'osm_way_992390308',address:'ირინა ენუქიძის ქუჩა 3',sourceUrl:'https://gruni.edu.ge/other_content/index/690/1545731480'},
  {id:'osm_relation_18087876',anchorId:'osm_way_80624407',address:'ქაქუცა ჩოლოყაშვილის გამზირი 3/5',sourceUrl:'https://study.iliauni.edu.ge/en/contact/'},
  {id:'osm_relation_17405902',anchorId:'osm_way_1221837871',address:'ალექსანდრე გრიბოედოვის ქუჩა 22',sourceUrl:'https://art.edu.ge/wp-content/uploads/2025/01/TSAA-Guide-1.pdf'},
];
