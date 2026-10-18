// One removable batch, kept outside real businesses and their data.
// These are UI examples, never imported as genuine prices or reviews.
import { DEMO_MEDIA } from '../../lib/demoMedia.js';
import { DEMO_ENABLED } from '../../lib/commerceDemoConfig.js';
export { DEMO_ENABLED } from '../../lib/commerceDemoConfig.js';
export const DEMO_BATCH_ID = 'geohub-commerce-demo-v1';
const rows = [
  ['coffee', 'ყავა და კრუასანი', 'დემო კაფე', 'dish', 'cafe', 1800, 1200, 'coffee', '#a56c45', 'ესპრესოზე მომზადებული ყავა და კრუასანი. არჩევანის მაგალითი მენიუდან.', 8],
  ['console', 'სათამაშო კონსოლი', 'დემო ტექნიკის მაღაზია', 'product', 'electronics', 159900, 129900, 'game-controller', '#6559c9', 'პროდუქტის შეთავაზების მაგალითი — მოდელი, კომპლექტაცია და ფილიალი კატალოგს უკავშირდება.'],
  ['meal', 'იმერული ხაჭაპური', 'დემო რესტორანი', 'dish', 'restaurant', 2600, 1950, 'fork-knife', '#dc8b35', 'საშუალო ზომის ხაჭაპური. ფასები და მომზადების დრო მხოლოდ დემონსტრაციისთვისაა.', 20],
  ['lesson', 'ინგლისურის კურსი', 'დემო სასწავლო ცენტრი', 'service', 'education', 24000, 18000, 'graduation-cap', '#328d95', 'ერთი თვის კურსის მაგალითი. მომსახურების ფასდაკლება ერთ კონკრეტულ კურსს უკავშირდება.'],
  ['auto', 'საბურავები და მონტაჟი', 'დემო ავტოსერვისი', 'bundle', 'car_repair', 72000, 59000, 'car', '#437ea6', 'ნივთისა და სერვისის ერთობლივი პაკეტის მაგალითი. შემადგენლობა მითითებულია შეთავაზებაში.'],
  ['flowers', 'ყვავილების თაიგული', 'დემო ყვავილების მაღაზია', 'product', 'florist', 8500, 6500, 'flower', '#cc658b', 'კატალოგის პროდუქტის მაგალითი. ნაჩვენები ფასი მოქმედი შეთავაზება არ არის.'],
];
export const DEMO_OFFERS = rows.map(([id, title, businessName, type, categoryId, originalPriceMinor, priceMinor, icon, tone, description, preparationMinutes]) => ({
  id: `demo-${id}`, itemId: `demo-item-${id}`, businessId: '', title, itemTitle: title, businessName,
  demoMerchantId: id, demoPageHref: `/discounts/demo/${id}`, imageUrl: DEMO_MEDIA[id]?.url || '', photoCredit: DEMO_MEDIA[id],
  type, itemType: type, categoryId, originalPriceMinor, priceMinor, currency: 'GEL', icon, tone, description,
  preparationMinutes: preparationMinutes || null, conditions: 'საჩვენებელი ჩანაწერი — შეძენა და დაჯავშნა შეუძლებელია.',
  isDemo: true, demoBatchId: DEMO_BATCH_ID, datasetVersion: 1, status: 'published',
  allBranches: true, branchIds: [], startsAtMs: 0, endsAtMs: 0,
}));

const details = {
  coffee: { about: 'გამოგონილი კაფის გვერდი აჩვენებს, როგორ უკავშირდება მენიუს კონკრეტული კერძი შეთავაზებას. აქ მოცემული ფასები, შემადგენლობა და მომზადების დრო მხოლოდ მაგალითებია.', itemDetails: ['1 ყავა და 1 კრუასანი', 'პორცია: ერთი ადამიანისთვის', 'შემადგენლობა და ალერგენები ნამდვილ მენიუში ცალკე დაზუსტდება'], label: 'მენიუ' },
  console: { about: 'გამოგონილი ტექნიკის მაღაზია პროდუქტის კატალოგისა და ფასდაკლების კავშირს აჩვენებს. რეალურ გვერდზე გამყიდველი მიუთითებს ზუსტ მოდელს, კომპლექტაციასა და ხელმისაწვდომ ფილიალს.', itemDetails: ['კატალოგის ტიპი: სათამაშო კონსოლი', 'ფოტოზე ნაჩვენები მოდელი მხოლოდ ილუსტრაციაა', 'ამ მაგალითს არ აქვს რეალური მარაგი ან გარანტიის შეთავაზება'], label: 'პროდუქტების კატალოგი' },
  meal: { about: 'გამოგონილი რესტორნის მენიუში შეგიძლია ნახო კერძის ფასი, აღწერა და მომზადების დრო. ეს მონაცემები აჩვენებს გვერდის სტრუქტურას და რეალურ რესტორანს არ წარმოადგენს.', itemDetails: ['იმერული ხაჭაპური — საშუალო ზომის მაგალითი', 'საჩვენებელი ინგრედიენტები: ცომი, ყველი', 'ალერგენების მაგალითი: რძე და გლუტენი'], label: 'მენიუ' },
  lesson: { about: 'გამოგონილი სასწავლო ცენტრი მომსახურების კატალოგის მაგალითია. ფასდაკლება უკავშირდება ინგლისურის კონკრეტულ კურსს და არა ზოგად სარეკლამო პოსტს.', itemDetails: ['ინგლისურის ჯგუფური კურსი — საჩვენებელი პროგრამა', 'პაკეტის მაგალითი: ერთი თვე, 8 შეხვედრა', 'განრიგი, მასწავლებელი და ჩარიცხვა ამ დემოში არ არის შეთავაზებული'], label: 'სერვისები' },
  auto: { about: 'გამოგონილი ავტოსერვისი აჩვენებს ნივთისა და მომსახურების გაერთიანებულ შეთავაზებას. ნამდვილ კატალოგში საბურავის ზომა, ბრენდი და მომსახურების პირობები ცალ-ცალკე ივსება.', itemDetails: ['პაკეტის მაგალითი: 4 საბურავი და მონტაჟი', 'საბურავების ფოტო საილუსტრაციოა', 'ზომა, ავტომობილთან თავსებადობა და მარაგი ამ დემოსთვის განსაზღვრული არ არის'], label: 'პროდუქტები და სერვისები' },
  flowers: { about: 'გამოგონილი ყვავილების მაღაზიის გვერდი პროდუქტის ფოტოს, აღწერასა და შეთავაზებას აერთიანებს. ფოტო კატალოგის დიზაინის საჩვენებლადაა და ამ თაიგულის შეძენას არ გულისხმობს.', itemDetails: ['ყვავილების თაიგული — პროდუქტის მაგალითი', 'შემადგენლობა და ზომა ნამდვილ შეკვეთაში დაზუსტდება', 'ამ გვერდზე შეკვეთა და მიტანა არ არის ხელმისაწვდომი'], label: 'პროდუქტების კატალოგი' },
};
export const DEMO_MERCHANTS = DEMO_OFFERS.map(offer => ({
  id: offer.demoMerchantId, name: offer.businessName, href: offer.demoPageHref, isDemo: true,
  demoBatchId: DEMO_BATCH_ID, icon: offer.icon, tone: offer.tone, media: offer.photoCredit,
  ...details[offer.demoMerchantId], offer,
  item: { id: offer.itemId, title: offer.itemTitle, description: offer.description, type: offer.type,
    priceMinor: offer.originalPriceMinor, currency: offer.currency, preparationMinutes: offer.preparationMinutes, isDemo: true },
}));
export const getDemoMerchant = id => DEMO_ENABLED ? DEMO_MERCHANTS.find(merchant => merchant.id === id) || null : null;
