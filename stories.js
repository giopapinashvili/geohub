/* ================================================================
   GeoHub — Stories & Reels
   ================================================================ */
(function () {
  'use strict';

  /* ── MOCK REELS ─────────────────────────────────────────────── */
  var REELS = [
    {
      id:'r1',type:'checkin',tabs:['nearby','places'],
      bg:'linear-gradient(160deg,#064e3b 0%,#065f46 45%,#052e22 100%)',
      emoji:'☕',sceneText:'Fabrika, Tbilisi',
      user:{name:'Tamara Kvaratskhelia',handle:'tamara.k',verified:true,av:'T',color:'#10b981'},
      place:{name:'Fabrika Coffee Roasters',district:'Chugureti'},
      caption:'Best morning vibes in Tbilisi ☕✨ The cortado here is absolutely unmatched — creamy, bold, and full of character. This city never disappoints!',
      mood:'☕ Cozy',xp:'+12 XP',cam:'Pixel 8',
      likes:847,saves:134,
      music:{name:'Morning Ritual',artist:'Nils Frahm'},
      comments:[
        {user:'Luka',av:'#3b82f6',txt:'Fabrika is my second home! 🙌',time:'2h'},
        {user:'Ana G',av:'#8b5cf6',txt:'The cortado there is seriously top tier',time:'1h'},
        {user:'David T',av:'#10b981',txt:'Need to try this weekend 🔥',time:'45m'},
        {user:'Mari',av:'#f59e0b',txt:'You have impeccable taste ☕',time:'20m'}
      ]
    },
    {
      id:'r2',type:'checkin',tabs:['nearby','places'],
      bg:'linear-gradient(160deg,#1e1b4b 0%,#312e81 45%,#0e0d2e 100%)',
      emoji:'🌅',sceneText:'Mtatsminda, Tbilisi',
      user:{name:'Giorgi Asatiani',handle:'geo.shot',verified:false,av:'G',color:'#8b5cf6'},
      place:{name:'Mtatsminda Park',district:'Mtatsminda'},
      caption:'Golden hour from the top hits different every single time 🌅 The whole city laid out below you — pure magic.',
      mood:'🌅 Dreamy',xp:'+18 XP',cam:'Sony A7IV',
      likes:2341,saves:567,
      music:{name:'Golden Hour',artist:'JVKE'},
      comments:[
        {user:'Nino',av:'#ec4899',txt:'This view never gets old 😍',time:'3h'},
        {user:'Sandro',av:'#10b981',txt:'Incredible shot! What lens?',time:'2h'},
        {user:'Keti',av:'#f59e0b',txt:'I was there yesterday!! 🌟',time:'1h'}
      ]
    },
    {
      id:'r3',type:'checkin',tabs:['nearby','places'],
      bg:'linear-gradient(160deg,#451a03 0%,#78350f 45%,#2c1002 100%)',
      emoji:'🍷',sceneText:'Wine Cellar, Telavi',
      user:{name:'Salome Beridze',handle:'salome.wine',verified:true,av:'S',color:'#f59e0b'},
      place:{name:'Twins Old Cellar',district:'Telavi, Kakheti'},
      caption:'Discovered a 1987 Rkatsiteli in the most incredible wine cellar in Kakheti 🍷🍇 Georgian wine culture is something else entirely.',
      mood:'🍷 Sophisticated',xp:'+25 XP',cam:'iPhone 15 Pro',
      likes:1204,saves:289,
      music:{name:'Mkurnali',artist:'Mgzavrebi'},
      comments:[
        {user:'Thomas',av:'#3b82f6',txt:'Kakheti wine region is unreal! 🍷',time:'5h'},
        {user:'Darejan',av:'#8b5cf6',txt:"The best decision you'll ever make 🙌",time:'4h'},
        {user:'Pierre',av:'#10b981',txt:'On my bucket list since forever!',time:'2h'},
        {user:'Elene',av:'#ec4899',txt:'Twins Old Cellar is legendary 🌟',time:'1h'}
      ]
    },
    {
      id:'r4',type:'checkin',tabs:['nearby','places'],
      bg:'linear-gradient(160deg,#042f2e 0%,#134e4a 45%,#021c1b 100%)',
      emoji:'🏃',sceneText:'Vake Park, Tbilisi',
      user:{name:'Irakli Meskhia',handle:'irakli.fit',verified:false,av:'I',color:'#10b981'},
      place:{name:'Vake Park',district:'Vake'},
      caption:'Morning 10K done! 💪 Vake Park in the morning is absolutely therapeutic. Nothing beats that fresh mountain air before the city wakes up.',
      mood:'🏃 Energized',xp:'+30 XP',cam:'GoPro 12',
      likes:634,saves:88,
      music:{name:'Run The World',artist:'Beyoncé'},
      comments:[
        {user:'Natia',av:'#ec4899',txt:"You're an inspiration! 🔥",time:'2h'},
        {user:'Levan',av:'#8b5cf6',txt:'Next time let me join!',time:'1h'},
        {user:'Ana',av:'#f59e0b',txt:'Vake Park mornings are the best 🌿',time:'30m'}
      ]
    },
    {
      id:'r5',type:'place',tabs:['nearby','places'],
      bg:'linear-gradient(160deg,#0a0a1a 0%,#1a1a3e 45%,#050510 100%)',
      emoji:'🏰',sceneText:'Narikala Fortress',
      user:{name:'Alex Müller',handle:'alex.wanders',verified:true,av:'A',color:'#3b82f6'},
      place:{name:'Narikala Fortress',district:'Old Tbilisi'},
      caption:"Narikala standing strong since the 4th century 🏰 Every stone here has witnessed centuries of history. One of the most awe-inspiring spots I've ever visited.",
      mood:'🏰 Awestruck',xp:'+20 XP',cam:'Fujifilm X-T5',
      likes:3102,saves:890,
      music:{name:'Ancient Dreams',artist:'Hans Zimmer'},
      comments:[
        {user:'Mariam',av:'#10b981',txt:'Best view in Tbilisi! 🌟',time:'4h'},
        {user:'Tourist',av:'#f59e0b',txt:'Stunning architecture 😮',time:'3h'},
        {user:'Gvantsa',av:'#8b5cf6',txt:'Home always 🇬🇪❤️',time:'2h'},
        {user:'Chris',av:'#ec4899',txt:'Added to my travel list immediately!',time:'1h'},
        {user:'Nino',av:'#3b82f6',txt:'Go at sunset, trust me 🌅',time:'30m'}
      ]
    },
    {
      id:'r6',type:'place',tabs:['nearby','places'],
      bg:'linear-gradient(160deg,#1a0a2e 0%,#3b1a6e 45%,#0d0518 100%)',
      emoji:'🛤️',sceneText:'Old Town Alley',
      user:{name:'Nino Gogua',handle:'nino.lens',verified:false,av:'N',color:'#8b5cf6'},
      place:{name:'Shardeni Street',district:'Old Town'},
      caption:"Shardeni Street on a quiet evening — cobblestones, iron balconies, and that warm amber light 🛤️ Old Tbilisi is a photographer's paradise.",
      mood:'✨ Nostalgic',xp:'+15 XP',cam:'Leica Q2',
      likes:1876,saves:445,
      music:{name:'Balcony',artist:'Galt MacDermot'},
      comments:[
        {user:'Tamar',av:'#10b981',txt:'My favorite street in the world! ❤️',time:'6h'},
        {user:'Diego',av:'#3b82f6',txt:'Incredible photo composition!',time:'5h'},
        {user:'Ekaterine',av:'#f59e0b',txt:'This is pure art 🎨',time:'3h'}
      ]
    },
    {
      id:'r7',type:'place',tabs:['nearby','places'],
      bg:'linear-gradient(160deg,#0c1445 0%,#1e3a8a 45%,#060a25 100%)',
      emoji:'🌉',sceneText:'Bridge of Peace',
      user:{name:'Mariam Tsiklauri',handle:'mariam.tbilisi',verified:true,av:'M',color:'#3b82f6'},
      place:{name:'Bridge of Peace',district:'Rike Park'},
      caption:'The Bridge of Peace at midnight — when the whole city reflects in the Mtkvari river ✨ This is why Tbilisi never sleeps.',
      mood:'🌃 Electric',xp:'+22 XP',cam:'Canon R6',
      likes:4210,saves:1102,
      music:{name:'City of Stars',artist:'La La Land'},
      comments:[
        {user:'Giorgi',av:'#10b981',txt:'Best midnight walk destination 🌙',time:'4h'},
        {user:'Sophie',av:'#ec4899',txt:'This city is magical at night 😍',time:'3h'},
        {user:'Zura',av:'#8b5cf6',txt:'Took my girlfriend here last week ❤️',time:'2h'},
        {user:'Tourist_X',av:'#f59e0b',txt:'Instantly my favorite spot in Georgia!',time:'45m'}
      ]
    },
    {
      id:'r8',type:'place',tabs:['nearby','places'],
      bg:'linear-gradient(160deg,#1a0000 0%,#4a0000 45%,#0f0000 100%)',
      emoji:'🕌',sceneText:'Metekhi Cliff',
      user:{name:'Beka Jojua',handle:'beka.shoots',verified:false,av:'B',color:'#ef4444'},
      place:{name:'Metekhi Church',district:'Old Tbilisi'},
      caption:"Metekhi standing on the cliff edge — 1700 years of continuous presence over the river 🕌 Georgia's history is carved into every rock here.",
      mood:'🙏 Reverent',xp:'+20 XP',cam:'Nikon Z6',
      likes:2870,saves:730,
      music:{name:'Sacred Ground',artist:'Traditional Georgian'},
      comments:[
        {user:'Lali',av:'#10b981',txt:'Most beautiful church in Tbilisi 🙏',time:'7h'},
        {user:'Nika',av:'#8b5cf6',txt:'The cliff view is insane!',time:'5h'},
        {user:'Maka',av:'#ec4899',txt:'Georgia is so underrated as a destination',time:'3h'}
      ]
    },
    {
      id:'r9',type:'event',tabs:['events'],
      bg:'linear-gradient(160deg,#1a0a0a 0%,#7f1d1d 45%,#100606 100%)',
      emoji:'🎸',sceneText:'Tbilisi Jazz Festival',
      user:{name:'Festival Official',handle:'tbilisi.jazz',verified:true,av:'F',color:'#ef4444'},
      place:{name:'Rike Park Amphitheater',district:'Rike'},
      caption:'🎸 Tbilisi Jazz Festival TONIGHT at Rike Park! Free entry, world-class performers, and the most beautiful open-air venue in the Caucasus. Be there! 🎵',
      mood:'🎵 Vibrant',xp:'+40 XP',
      likes:5621,saves:1204,
      music:{name:'Take Five',artist:'Dave Brubeck'},
      event:{icon:'🎸',name:'Tbilisi Jazz Festival',going:'4,280 going · Free Entry'},
      comments:[
        {user:'Jazz Fan',av:'#3b82f6',txt:'CANNOT WAIT!! 🎸🔥',time:'2h'},
        {user:'Mariam',av:'#10b981',txt:'Last year was incredible, this will be even better!',time:'1h'},
        {user:'Tourist',av:'#f59e0b',txt:'Flew from Berlin just for this! 🎵',time:'45m'},
        {user:'Giorgi',av:'#8b5cf6',txt:'See you there tonight! 🙌',time:'20m'}
      ]
    },
    {
      id:'r10',type:'event',tabs:['events'],
      bg:'linear-gradient(160deg,#0a1a0a 0%,#166534 45%,#060f06 100%)',
      emoji:'🍜',sceneText:'Street Food Night Market',
      user:{name:'Tbilisi Eats',handle:'tbilisi.eats',verified:true,av:'T',color:'#10b981'},
      place:{name:'Dezerter Bazaar',district:'Didube'},
      caption:'🍜 Street Food Night Market this Saturday! 40+ vendors, khinkali battles, natural wine bar, live folk music. Chaotic and delicious! 🍷',
      mood:'🍴 Hungry',xp:'+35 XP',
      likes:3890,saves:945,
      music:{name:'Davluri',artist:'Georgian Folk'},
      event:{icon:'🍜',name:'Street Food Night Market',going:'2,100 interested · Sat 6PM'},
      comments:[
        {user:'Foodie',av:'#f59e0b',txt:"Khinkali battle?? I'm there! 🥟",time:'3h'},
        {user:'Nino',av:'#ec4899',txt:'Organizing a group for this!',time:'2h'},
        {user:'Max',av:'#3b82f6',txt:'Georgian street food is ELITE 🔥',time:'1h'}
      ]
    },
    {
      id:'r11',type:'event',tabs:['events'],
      bg:'linear-gradient(160deg,#1e0a3c 0%,#5b21b6 45%,#0e0520 100%)',
      emoji:'🎪',sceneText:'Tbilisi Open Air',
      user:{name:'Tbilisi Open Air',handle:'toa.official',verified:true,av:'T',color:'#8b5cf6'},
      place:{name:'Lisi Lake',district:'Saburtalo'},
      caption:'🎪 Tbilisi Open Air 2025 lineup is HERE! 3 days, 5 stages, 60+ artists. Get tickets before they sell out — THE summer event of the year! ✨',
      mood:'🎊 Hyped',xp:'+50 XP',
      likes:8920,saves:2341,
      music:{name:'Festival Season',artist:'Various'},
      event:{icon:'🎪',name:'Tbilisi Open Air 2025',going:'12,400 interested · July 18-20'},
      comments:[
        {user:'Archil',av:'#10b981',txt:'Already got my 3-day pass! 🙌',time:'5h'},
        {user:'Sophie_D',av:'#3b82f6',txt:'Flying in from Amsterdam for this!',time:'4h'},
        {user:'Luka',av:'#f59e0b',txt:'Best festival in Eastern Europe no debate',time:'2h'},
        {user:'Tamuna',av:'#ec4899',txt:'The lineup is UNREAL this year 😍🔥',time:'1h'},
        {user:'Zurab',av:'#8b5cf6',txt:'Counting down the days!!!',time:'30m'}
      ]
    },
    {
      id:'r12',type:'business',tabs:['nearby'],
      bg:'linear-gradient(160deg,#0a0a1a 0%,#1e1b4b 45%,#050510 100%)',
      emoji:'☕',sceneText:'Fabrika Roasters',
      user:{name:'Fabrika Coffee',handle:'fabrika.coffee',verified:true,av:'F',color:'#8b5cf6'},
      place:{name:'Fabrika Coffee Roasters',district:'Chugureti'},
      caption:'☕ Monday special: 2-for-1 on all specialty drinks until 12PM! Our Ethiopian Yirgacheffe single origin is in — light, floral, incredible. Come in!',
      mood:'☕ Energized',xp:'+10 XP',
      likes:1203,saves:234,
      music:{name:'Coffee Shop',artist:'Beabadoobee'},
      offer:{disc:'2-for-1',name:'Morning Special',desc:'All specialty drinks · Until 12PM today'},
      comments:[
        {user:'Tamara',av:'#10b981',txt:'Already on my way! ☕',time:'1h'},
        {user:'Nika',av:'#3b82f6',txt:'Their Ethiopian beans are FIRE',time:'45m'},
        {user:'Mari',av:'#f59e0b',txt:'See everyone there! ✨',time:'20m'}
      ]
    },
    {
      id:'r13',type:'business',tabs:['nearby'],
      bg:'linear-gradient(160deg,#1a1000 0%,#713f12 45%,#0f0900 100%)',
      emoji:'🏨',sceneText:'Rooms Hotel',
      user:{name:'Rooms Hotel Tbilisi',handle:'rooms.hotel',verified:true,av:'R',color:'#f59e0b'},
      place:{name:'Rooms Hotel',district:'Mtatsminda'},
      caption:'🏨 Exclusive GeoHub offer: 30% off weekend stays + complimentary Georgian wine tasting 🍷 Book through the app for the best rate in the city.',
      mood:'🌟 Luxurious',xp:'+15 XP',
      likes:2100,saves:567,
      music:{name:'Hotel California',artist:'Eagles'},
      offer:{disc:'30% OFF',name:'Weekend Getaway',desc:'Includes wine tasting · GeoHub exclusive'},
      comments:[
        {user:'Sarah',av:'#ec4899',txt:'Stayed here last month — absolutely stunning! 🏨',time:'3h'},
        {user:'Mikheil',av:'#8b5cf6',txt:'This is the best hotel in Tbilisi',time:'2h'},
        {user:'John',av:'#3b82f6',txt:'Booking this for our anniversary! ❤️',time:'1h'},
        {user:'Nino',av:'#10b981',txt:"30% off?? That's incredible value",time:'30m'}
      ]
    },
    {
      id:'r14',type:'business',tabs:['nearby'],
      bg:'linear-gradient(160deg,#0a1a0a 0%,#14532d 45%,#060f06 100%)',
      emoji:'🌿',sceneText:'Culinarium Khasheria',
      user:{name:'Culinarium Khasheria',handle:'culinarium.ge',verified:true,av:'C',color:'#10b981'},
      place:{name:'Culinarium Khasheria',district:'Old Town'},
      caption:'🌿 New seasonal menu just launched! 8-course tasting menu featuring modern Georgian cuisine with organic Kakhetian produce. Limited seats — reserve now!',
      mood:'🍽️ Gourmet',xp:'+12 XP',
      likes:1850,saves:430,
      music:{name:'Bon Appétit',artist:'Katy Perry'},
      offer:{disc:'NEW!',name:'Seasonal Tasting Menu',desc:'8 courses · Local organic · Limited seats'},
      comments:[
        {user:'Chef_Fan',av:'#f59e0b',txt:'Best fine dining in the Caucasus!',time:'4h'},
        {user:'Dali',av:'#8b5cf6',txt:'Reserving a table right now! 🔥',time:'2h'},
        {user:'Tomas',av:'#3b82f6',txt:'Their khachapuri variations alone are worth it',time:'1h'}
      ]
    },
    {
      id:'r15',type:'creator',tabs:['creators'],
      bg:'linear-gradient(160deg,#1a0a1a 0%,#5b21b6 45%,#0d050d 100%)',
      emoji:'🎨',sceneText:'Street Art Tour',
      user:{name:'DAGA Art',handle:'daga.art',verified:true,av:'D',color:'#ec4899'},
      place:{name:'Fabrika Creative Hub',district:'Chugureti'},
      caption:'🎨 Episode 12 of my Tbilisi Street Art series! This hidden alley in Chugureti has the most incredible murals — most people walk right past them. Let me show you.',
      mood:'🎨 Creative',xp:'+28 XP',cam:'DJI Pocket 3',
      likes:6780,saves:1890,
      music:{name:'Electric Feel',artist:'MGMT'},
      comments:[
        {user:'Art Lover',av:'#3b82f6',txt:'Your series is my favorite content on GeoHub! 🎨',time:'5h'},
        {user:'Lika',av:'#10b981',txt:'Never knew about this alley!',time:'4h'},
        {user:'Creator_X',av:'#f59e0b',txt:'Incredible filming and editing as always 🙌',time:'2h'},
        {user:'Tourist',av:'#ec4899',txt:'Adding to my Tbilisi street art walk!',time:'1h'}
      ]
    },
    {
      id:'r16',type:'creator',tabs:['creators'],
      bg:'linear-gradient(160deg,#0a1a0a 0%,#065f46 45%,#040f08 100%)',
      emoji:'📸',sceneText:'Food Photography',
      user:{name:'Keso Tsikhelashvili',handle:'keso.frames',verified:false,av:'K',color:'#10b981'},
      place:{name:'Various Restaurants',district:'Tbilisi'},
      caption:'📸 A week shooting Georgian cuisine — from khinkali in Old Town to modern fusion at Barbarestan. Food tells the story of a nation. Behind-the-scenes reel! 🍽️',
      mood:'📷 Artistic',xp:'+22 XP',cam:'Sony A7R V',
      likes:4230,saves:1120,
      music:{name:'Slow Burn',artist:'Kacey Musgraves'},
      comments:[
        {user:'FoodPhoto',av:'#f59e0b',txt:'The khinkali shot is magazine-worthy 😍',time:'6h'},
        {user:'Barbare',av:'#8b5cf6',txt:'The Barbarestan shots are PERFECT',time:'4h'},
        {user:'Gio',av:'#3b82f6',txt:'Your eye for composition is incredible',time:'2h'},
        {user:'Meri',av:'#ec4899',txt:'Following for more! 🔥',time:'1h'}
      ]
    },
    {
      id:'r17',type:'live',tabs:['live'],
      bg:'linear-gradient(160deg,#1a0505 0%,#991b1b 45%,#0f0303 100%)',
      emoji:'📡',sceneText:'● LIVE NOW',
      user:{name:'Dezerter Bazaar',handle:'dezerter.live',verified:true,av:'D',color:'#ef4444'},
      place:{name:'Dezerter Bazaar',district:'Didube'},
      caption:'📡 LIVE from Dezerter Bazaar — Saturday morning rush! Spices, fresh produce, churchkhela, incredible energy. The real Tbilisi is right here! 🌶️🥬',
      mood:'📡 Live',xp:'+20 XP',
      likes:892,saves:145,
      music:{name:'No music · Live Audio',artist:''},
      comments:[
        {user:'Viewer_1',av:'#10b981',txt:'I miss this place so much! 😭',time:'just now'},
        {user:'Viewer_2',av:'#3b82f6',txt:'The spice section 🔥🌶️',time:'just now'},
        {user:'Viewer_3',av:'#f59e0b',txt:'Show the churchkhela vendors! 🍬',time:'just now'},
        {user:'Viewer_4',av:'#8b5cf6',txt:'This takes me back 🇬🇪',time:'1m'}
      ]
    },
    {
      id:'r18',type:'live',tabs:['live'],
      bg:'linear-gradient(160deg,#0a0a1e 0%,#1e1b4b 45%,#06060f 100%)',
      emoji:'📡',sceneText:'● LIVE NOW',
      user:{name:'TbilisiNow',handle:'tbilisi.now',verified:true,av:'T',color:'#ef4444'},
      place:{name:'Rike Park',district:'Old Town'},
      caption:'📡 LIVE: Night at Rike Park — watching the Bridge of Peace light show ✨ Thousands of people out tonight. The city is buzzing!',
      mood:'🌃 Electric',xp:'+18 XP',
      likes:2140,saves:312,
      music:{name:'No music · Live Audio',artist:''},
      comments:[
        {user:'NightOwl',av:'#ec4899',txt:'Wish I was there right now! 😭',time:'just now'},
        {user:'Local_G',av:'#10b981',txt:'Rike is so alive tonight! 🔥',time:'just now'},
        {user:'Traveler',av:'#f59e0b',txt:'Watching from New York 🗽❤️',time:'1m'},
        {user:'Khatia',av:'#3b82f6',txt:'The light show never gets old 😍',time:'2m'}
      ]
    },
    {
      id:'r19',type:'challenge',tabs:['challenges'],
      bg:'linear-gradient(160deg,#1a1200 0%,#713f12 45%,#0f0a00 100%)',
      emoji:'🏆',sceneText:'30 Spots Challenge',
      user:{name:'GeoHub Challenges',handle:'gh.challenges',verified:true,av:'G',color:'#f59e0b'},
      place:{name:'All of Tbilisi',district:'Citywide'},
      caption:'🏆 The "30 Best Spots in 30 Days" challenge has 4,200+ participants! Can you find all the hidden gems before month end? Top explorer wins Premium for life! ✨',
      mood:'🎯 Competitive',xp:'+100 XP',
      likes:7890,saves:2100,
      music:{name:'Eye of the Tiger',artist:'Survivor'},
      challenge:{name:'30 Best Spots Challenge',progress:0.68,joined:4280,total:30},
      comments:[
        {user:'Challenger_1',av:'#10b981',txt:'On spot 21/30! Almost there! 🔥',time:'2h'},
        {user:'Explorer',av:'#3b82f6',txt:'This challenge changed how I see my city!',time:'1h'},
        {user:'Giga',av:'#8b5cf6',txt:'Who else is on the leaderboard? 👀',time:'45m'},
        {user:'Tina',av:'#ec4899',txt:'Just joined! Starting my journey today 🚀',time:'20m'}
      ]
    },
    {
      id:'r20',type:'challenge',tabs:['challenges'],
      bg:'linear-gradient(160deg,#0a0a1a 0%,#1e40af 45%,#050510 100%)',
      emoji:'🔍',sceneText:'Hidden Gems Hunt',
      user:{name:'GeoHub Challenges',handle:'gh.challenges',verified:true,av:'G',color:'#3b82f6'},
      place:{name:'Secret Locations',district:'Tbilisi'},
      caption:'🔍 Hidden Gems Hunt: 15 locations, zero clues except coordinates. 890 explorers are on the map right now. Are you sharp enough? 🗺️ Prizes daily!',
      mood:'🔍 Focused',xp:'+75 XP',
      likes:5430,saves:1670,
      music:{name:'Mission Impossible Theme',artist:'Lalo Schifrin'},
      challenge:{name:'Hidden Gems Hunt',progress:0.42,joined:890,total:15},
      comments:[
        {user:'Hunter_1',av:'#f59e0b',txt:'Found 8/15! Getting tough now 😅',time:'3h'},
        {user:'Hunter_2',av:'#10b981',txt:'Location 7 nearly broke me 😂',time:'2h'},
        {user:'Gio_X',av:'#8b5cf6',txt:'The coordinates are so clever!',time:'1h'},
        {user:'Ana_E',av:'#ec4899',txt:'Just joined after seeing this reel! 🔍',time:'30m'}
      ]
    },
    {
      id:'r21',type:'patriot',tabs:['nearby','places'],
      bg:'linear-gradient(160deg,#052414 0%,#065f46 45%,#020f08 100%)',
      emoji:'🇬🇪',sceneText:'Georgia Wine Heritage',
      user:{name:'Georgia Heritage',handle:'georgia.heritage',verified:true,av:'G',color:'#10b981'},
      place:{name:'Kakheti Wine Region',district:'Eastern Georgia'},
      caption:'🇬🇪 Georgia is the birthplace of wine — 8,000 years of winemaking tradition! The qvevri method is UNESCO-listed. Come taste history in every glass 🍷✨',
      mood:'🍷 Proud',xp:'+30 XP',cam:'DJI Mini 4 Pro',
      likes:9120,saves:2890,
      music:{name:'Mravalzhamier',artist:'Traditional Georgian Polyphony'},
      comments:[
        {user:'Wine_Lover',av:'#f59e0b',txt:'Georgian wine is the GOAT 🍷',time:'8h'},
        {user:'History_Buff',av:'#3b82f6',txt:'8000 years of winemaking! Unbelievable',time:'6h'},
        {user:'Tamara',av:'#10b981',txt:"This is why I'm proud to be Georgian 🇬🇪❤️",time:'4h'},
        {user:'Tourist_FR',av:'#8b5cf6',txt:'France can learn a thing or two! 😂',time:'2h'},
        {user:'Giorgi',av:'#ec4899',txt:'Gamarjoba from Telavi! 🍷🍇',time:'1h'}
      ]
    },
    {
      id:'r22',type:'patriot',tabs:['nearby','places'],
      bg:'linear-gradient(160deg,#0c0c1e 0%,#1e3a8a 45%,#060610 100%)',
      emoji:'📜',sceneText:'Ancient Tbilisi',
      user:{name:'Tbilisi 1600',handle:'tbilisi.history',verified:true,av:'T',color:'#3b82f6'},
      place:{name:'Dzveli Tbilisi',district:'Old Town'},
      caption:"📜 Tbilisi was founded in the 5th century AD by King Vakhtang Gorgasali — he discovered the warm sulphur springs. 1,600 years later, the baths still flow 🌊",
      mood:'🏛️ Historical',xp:'+25 XP',cam:'iPhone 15 Pro',
      likes:6780,saves:1920,
      music:{name:'Georgian Hymn',artist:'Traditional'},
      comments:[
        {user:'History',av:'#f59e0b',txt:'The sulphur baths are still incredible today!',time:'10h'},
        {user:'Levan_H',av:'#10b981',txt:'Our city is one of the oldest in the world 🏛️',time:'7h'},
        {user:'Visitor',av:'#3b82f6',txt:'I visited the Abanotubani baths — magical!',time:'5h'},
        {user:'Ketevan',av:'#ec4899',txt:'Every Georgian should share this 🇬🇪',time:'2h'}
      ]
    }
  ];

  /* ── TYPE META ──────────────────────────────────────────────── */
  var TYPE_META = {
    checkin:  {label:'Check-in', icon:'fa-location-dot',  color:'#10b981',border:'rgba(16,185,129,0.4)', bg:'rgba(16,185,129,0.12)'},
    place:    {label:'Place',    icon:'fa-building',       color:'#3b82f6',border:'rgba(59,130,246,0.4)', bg:'rgba(59,130,246,0.12)'},
    event:    {label:'Event',    icon:'fa-calendar-days',  color:'#f59e0b',border:'rgba(245,158,11,0.4)', bg:'rgba(245,158,11,0.12)'},
    business: {label:'Business', icon:'fa-store',          color:'#8b5cf6',border:'rgba(139,92,246,0.4)',bg:'rgba(139,92,246,0.12)'},
    creator:  {label:'Creator',  icon:'fa-paintbrush',     color:'#ec4899',border:'rgba(236,72,153,0.4)',bg:'rgba(236,72,153,0.12)'},
    live:     {label:'LIVE',     icon:'fa-circle',         color:'#ef4444',border:'rgba(239,68,68,0.4)', bg:'rgba(239,68,68,0.12)'},
    challenge:{label:'Challenge',icon:'fa-trophy',         color:'#f59e0b',border:'rgba(245,158,11,0.4)', bg:'rgba(245,158,11,0.12)'},
    patriot:  {label:'Georgia',  icon:'fa-flag',           color:'#10b981',border:'rgba(16,185,129,0.4)', bg:'rgba(16,185,129,0.12)'}
  };

  var SHARE_ITEMS = [
    {label:'Messages',  color:'#10b981',bg:'rgba(16,185,129,0.15)', icon:'💬'},
    {label:'Instagram', color:'#ec4899',bg:'rgba(236,72,153,0.15)', icon:'📸'},
    {label:'WhatsApp',  color:'#10b981',bg:'rgba(16,185,129,0.15)', icon:'📱'},
    {label:'Telegram',  color:'#3b82f6',bg:'rgba(59,130,246,0.15)', icon:'✈️'},
    {label:'Twitter',   color:'#3b82f6',bg:'rgba(59,130,246,0.15)', icon:'🐦'},
    {label:'Facebook',  color:'#3b82f6',bg:'rgba(59,130,246,0.15)', icon:'👥'},
    {label:'Save to Map',color:'#8b5cf6',bg:'rgba(139,92,246,0.15)',icon:'🗺️'},
    {label:'More',      color:'#94a3b8',bg:'rgba(255,255,255,0.08)', icon:'⋯'}
  ];

  /* ── STATE ──────────────────────────────────────────────────── */
  var state = {
    tab:'foryou',
    filtered: REELS.slice(),
    idx:0,
    liked:{}, saved:{}, followed:{},
    pbTimer:null,
    pbStart:0,
    pbDuration:8000,
    transitioning:false,
    commentsOpen:false,
    shareOpen:false,
    touchStartY:0,
    touchStartX:0
  };

  /* ── HELPERS ────────────────────────────────────────────────── */
  function fmt(n){
    if(n>=1000) return (n/1000).toFixed(1).replace('.0','')+'K';
    return String(n);
  }
  function currentReel(){ return state.filtered[state.idx]||null; }
  function findById(id){
    for(var i=0;i<REELS.length;i++){ if(REELS[i].id===id) return REELS[i]; }
    return null;
  }
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  /* ── RENDER MEDIA ───────────────────────────────────────────── */
  function renderMedia(r){
    var media=document.getElementById('srMedia');
    var emoji=document.getElementById('srEmoji');
    var scene=document.getElementById('srScene');
    var amb=document.getElementById('srAmbient');
    if(media) media.style.background=r.bg;
    if(emoji) emoji.textContent=r.emoji;
    if(scene) scene.textContent=r.sceneText;
    if(amb){ amb.style.background=r.bg; amb.style.opacity='0.35'; }
  }

  /* ── RENDER TYPE CHIP ───────────────────────────────────────── */
  function renderTypeChip(r){
    var chip=document.getElementById('srTypeChip');
    if(!chip) return;
    var m=TYPE_META[r.type]||TYPE_META.checkin;
    chip.style.cssText='background:'+m.bg+';border:1px solid '+m.border+';color:'+m.color;
    if(r.type==='live'){
      chip.innerHTML='<span class="sr-live-dot">●</span>&nbsp;LIVE';
    } else {
      chip.innerHTML='<i class="fas '+m.icon+'"></i>&nbsp;'+m.label;
    }
  }

  /* ── RENDER SIDE ────────────────────────────────────────────── */
  function renderSide(r){
    var liked=!!state.liked[r.id];
    var saved=!!state.saved[r.id];
    var followed=!!state.followed[r.user.handle];
    var c=r.user.color||'#10b981';
    return (
      '<div class="sr-act">'+
        '<div class="sr-av-btn" style="background:'+c+';border-color:'+c+'" onclick="window.srToggleFollow(\''+esc(r.user.handle)+'\')">'+
          esc(r.user.av)+
          '<div class="sr-av-follow-dot'+(followed?' following':'')+'">'+
            (followed?'<i class="fas fa-check"></i>':'<i class="fas fa-plus"></i>')+
          '</div>'+
        '</div>'+
      '</div>'+
      '<div class="sr-act">'+
        '<button class="sr-act-btn'+(liked?' a-liked':'')+'" id="srLikeBtn" onclick="window.srToggleLike(\''+r.id+'\')">'+
          '<i class="fas fa-heart"></i>'+
        '</button>'+
        '<span class="sr-act-n" id="srLikeCount">'+fmt(r.likes+(liked?1:0))+'</span>'+
      '</div>'+
      '<div class="sr-act">'+
        '<button class="sr-act-btn" onclick="window.srOpenComments()">'+
          '<i class="fas fa-comment"></i>'+
        '</button>'+
        '<span class="sr-act-n">'+fmt(r.comments.length)+'</span>'+
      '</div>'+
      '<div class="sr-act">'+
        '<button class="sr-act-btn'+(saved?' a-saved':'')+'" id="srSaveBtn" onclick="window.srToggleSave(\''+r.id+'\')">'+
          '<i class="fas fa-bookmark"></i>'+
        '</button>'+
        '<span class="sr-act-n" id="srSaveCount">'+fmt(r.saves+(saved?1:0))+'</span>'+
      '</div>'+
      '<div class="sr-act">'+
        '<button class="sr-act-btn" onclick="window.srOpenShare()">'+
          '<i class="fas fa-share-nodes"></i>'+
        '</button>'+
        '<span class="sr-act-n">Share</span>'+
      '</div>'
    );
  }

  /* ── RENDER CONTENT ─────────────────────────────────────────── */
  function renderContent(r){
    var h='';
    // user row
    h+='<div class="sr-user-row">'+
      '<div class="sr-uname">'+esc(r.user.name)+'</div>'+
      (r.user.verified?'<i class="fas fa-circle-check sr-verified"></i>':'')+
      '<span class="sr-uhandle">@'+esc(r.user.handle)+'</span>'+
    '</div>';
    // caption
    h+='<div class="sr-caption" id="srCaption">'+esc(r.caption)+'</div>'+
      '<div class="sr-more-cap" onclick="window.srExpandCaption()">more</div>';
    // tags
    h+='<div class="sr-tags">';
    if(r.place) h+='<span class="sr-tag sr-tag-place"><i class="fas fa-location-dot"></i> '+esc(r.place.name)+'</span>';
    if(r.mood)  h+='<span class="sr-tag sr-tag-mood">'+esc(r.mood)+'</span>';
    if(r.xp)    h+='<span class="sr-tag sr-tag-xp"><i class="fas fa-star"></i> '+esc(r.xp)+'</span>';
    if(r.cam)   h+='<span class="sr-tag sr-tag-cam"><i class="fas fa-camera"></i> '+esc(r.cam)+'</span>';
    h+='</div>';
    // type-specific
    if(r.offer){
      h+='<div class="sr-offer-row">'+
        '<div class="sr-offer-disc">'+esc(r.offer.disc)+'</div>'+
        '<div><div class="sr-offer-nm">'+esc(r.offer.name)+'</div>'+
        '<div class="sr-offer-desc">'+esc(r.offer.desc)+'</div></div>'+
      '</div>'+
      '<button class="sr-cta-btn sr-cta-purple" onclick="window.srShowToast(\'Offer claimed! Check your wallet 🎁\')">'+
        '<i class="fas fa-store"></i> Claim Offer</button>';
    } else if(r.event){
      h+='<div class="sr-event-row">'+
        '<div class="sr-event-ico">'+r.event.icon+'</div>'+
        '<div><div class="sr-event-nm">'+esc(r.event.name)+'</div>'+
        '<div class="sr-event-going">'+esc(r.event.going)+'</div></div>'+
      '</div>'+
      '<button class="sr-cta-btn sr-cta-gold" onclick="window.srShowToast(\'You\'re going! Added to calendar 📅\')">'+
        '<i class="fas fa-calendar-plus"></i> I\'m Going!</button>';
    } else if(r.challenge){
      var pct=Math.round(r.challenge.progress*100);
      h+='<div class="sr-ch-row">'+
        '<div class="sr-ch-nm">🏆 '+esc(r.challenge.name)+'</div>'+
        '<div class="sr-ch-track"><div class="sr-ch-fill" style="width:'+pct+'%"></div></div>'+
        '<div class="sr-ch-meta">'+
          '<span>'+fmt(r.challenge.joined)+' joined</span>'+
          '<span>'+pct+'% avg progress</span>'+
        '</div>'+
      '</div>'+
      '<button class="sr-cta-btn sr-cta-green" onclick="window.srShowToast(\'Challenge joined! Good luck 🏆\')">'+
        '<i class="fas fa-trophy"></i> Join Challenge</button>';
    } else if(r.type==='live'){
      h+='<button class="sr-cta-btn sr-cta-red">'+
        '<span class="sr-live-dot"><i class="fas fa-circle"></i></span>&nbsp; Watch Live</button>';
    } else if(r.type==='checkin'){
      h+='<button class="sr-cta-btn sr-cta-green" onclick="window.srShowToast(\'Checked in! +XP earned ✅\')">'+
        '<i class="fas fa-location-dot"></i> Check In Here</button>';
    } else if(r.type==='place'||r.type==='patriot'){
      h+='<button class="sr-cta-btn sr-cta-blue" onclick="window.location.href=\'map.html\'">'+
        '<i class="fas fa-map-location-dot"></i> Open on Map</button>';
    } else if(r.type==='creator'){
      h+='<button class="sr-cta-btn sr-cta-purple" onclick="window.srShowToast(\'Following creator! ✅\')">'+
        '<i class="fas fa-user-plus"></i> Follow Creator</button>';
    }
    // music
    if(r.music&&r.music.name&&r.music.name!=='No music · Live Audio'){
      h+='<div class="sr-music-row">'+
        '<div class="sr-music-disc"><i class="fas fa-music" style="color:rgba(255,255,255,0.7);font-size:0.65rem"></i></div>'+
        '<div class="sr-music-nm">♪ '+esc(r.music.name)+(r.music.artist?' · '+esc(r.music.artist):'')+'</div>'+
      '</div>';
    }
    return h;
  }

  /* ── RENDER COMMENTS ────────────────────────────────────────── */
  function renderComments(r){
    var title=document.getElementById('srDrawerTitle');
    var list=document.getElementById('srCommentsList');
    if(title) title.textContent='Comments ('+r.comments.length+')';
    if(!list) return;
    list.innerHTML=r.comments.map(function(c){
      return '<div class="sr-comment">'+
        '<div class="sr-cmnt-av" style="background:'+c.av+'">'+esc(c.user.charAt(0))+'</div>'+
        '<div>'+
          '<div class="sr-cmnt-nm">'+esc(c.user)+'</div>'+
          '<div class="sr-cmnt-txt">'+esc(c.txt)+'</div>'+
          '<div class="sr-cmnt-meta">'+esc(c.time)+(c.time==='just now'?'':' ago')+'</div>'+
        '</div>'+
      '</div>';
    }).join('');
  }

  /* ── RENDER SHARE GRID ──────────────────────────────────────── */
  function renderShareGrid(){
    var grid=document.getElementById('srShareGrid');
    if(!grid) return;
    grid.innerHTML=SHARE_ITEMS.map(function(s){
      return '<div class="sr-share-item" onclick="window.srShowToast(\'Sharing via '+s.label+'…\')">'+
        '<div class="sr-share-ico" style="background:'+s.bg+';border:1px solid '+s.bg.replace('0.15','0.3').replace('0.08','0.15')+'">'+s.icon+'</div>'+
        '<div class="sr-share-lbl">'+s.label+'</div>'+
      '</div>';
    }).join('');
  }

  /* ── FULL RENDER ────────────────────────────────────────────── */
  function renderReel(r){
    if(!r){
      var card=document.getElementById('srReel');
      if(card) card.innerHTML='<div class="sr-empty"><div class="sr-empty-ico">🔍</div><div class="sr-empty-txt">No reels in this tab yet</div></div>';
      return;
    }
    try {
      renderMedia(r);
      renderTypeChip(r);
      var side=document.getElementById('srSide');
      if(side) side.innerHTML=renderSide(r);
      var content=document.getElementById('srContent');
      if(content) content.innerHTML=renderContent(r);
      renderComments(r);
    } catch(e){
      if(typeof console!=='undefined') console.error('sr render:',e);
    }
  }

  /* ── PROGRESS BAR ───────────────────────────────────────────── */
  function pbStart(){
    pbClear();
    var fill=document.getElementById('srPbFill');
    if(!fill) return;
    fill.style.transition='none';
    fill.style.width='0%';
    state.pbStart=Date.now();
    void fill.offsetWidth;
    fill.style.transition='width '+state.pbDuration+'ms linear';
    fill.style.width='100%';
    state.pbTimer=setTimeout(goNext, state.pbDuration);
  }
  function pbClear(){
    if(state.pbTimer){ clearTimeout(state.pbTimer); state.pbTimer=null; }
  }
  function pbReset(){
    pbClear();
    var fill=document.getElementById('srPbFill');
    if(fill){ fill.style.transition='none'; fill.style.width='0%'; }
  }

  /* ── NAVIGATION ─────────────────────────────────────────────── */
  function goTo(n){
    var len=state.filtered.length;
    if(!len) return;
    if(state.transitioning) return;
    state.transitioning=true;
    pbClear();
    if(n<0) n=len-1;
    if(n>=len) n=0;
    var card=document.getElementById('srReel');
    if(card){
      card.style.transition='opacity 0.16s,transform 0.16s';
      card.style.opacity='0';
      card.style.transform='scale(0.97)';
    }
    setTimeout(function(){
      state.idx=n;
      renderReel(currentReel());
      if(card){
        card.style.opacity='1';
        card.style.transform='scale(1)';
        setTimeout(function(){
          if(card){ card.style.transition=''; }
          state.transitioning=false;
          pbStart();
        },160);
      } else {
        state.transitioning=false;
        pbStart();
      }
    },160);
  }
  function goNext(){ goTo(state.idx+1); }
  function goPrev(){ goTo(state.idx-1); }

  /* ── TAB FILTER ─────────────────────────────────────────────── */
  function filterTab(tab){
    state.tab=tab;
    state.filtered=tab==='foryou'
      ? REELS.slice()
      : REELS.filter(function(r){ return r.tabs.indexOf(tab)!==-1; });
    state.idx=0;
    pbReset();
    var r=currentReel();
    if(r){ renderReel(r); pbStart(); }
    else {
      var card=document.getElementById('srReel');
      if(card) card.innerHTML='<div class="sr-empty"><div class="sr-empty-ico">🔍</div><div class="sr-empty-txt">No reels in this tab yet</div></div>';
    }
  }

  /* ── INTERACTIONS ───────────────────────────────────────────── */
  window.srToggleLike=function(id){
    state.liked[id]=!state.liked[id];
    var r=findById(id); if(!r) return;
    var btn=document.getElementById('srLikeBtn');
    var cnt=document.getElementById('srLikeCount');
    if(btn) btn.classList.toggle('a-liked',!!state.liked[id]);
    if(cnt) cnt.textContent=fmt(r.likes+(state.liked[id]?1:0));
    if(state.liked[id]) showToast('❤️ Liked!');
  };

  window.srToggleSave=function(id){
    state.saved[id]=!state.saved[id];
    var r=findById(id); if(!r) return;
    var btn=document.getElementById('srSaveBtn');
    var cnt=document.getElementById('srSaveCount');
    if(btn) btn.classList.toggle('a-saved',!!state.saved[id]);
    if(cnt) cnt.textContent=fmt(r.saves+(state.saved[id]?1:0));
    if(state.saved[id]) showToast('🔖 Saved to collection!');
  };

  window.srToggleFollow=function(handle){
    state.followed[handle]=!state.followed[handle];
    var r=currentReel();
    var side=document.getElementById('srSide');
    if(side&&r) side.innerHTML=renderSide(r);
    showToast(state.followed[handle]?'✅ Following @'+handle:'Unfollowed @'+handle);
  };

  window.srOpenComments=function(){
    pbClear();
    var ovl=document.getElementById('srDrawerOvl');
    var drw=document.getElementById('srDrawer');
    if(ovl) ovl.classList.add('open');
    if(drw) drw.classList.add('open');
    state.commentsOpen=true;
  };

  window.srCloseComments=function(){
    var ovl=document.getElementById('srDrawerOvl');
    var drw=document.getElementById('srDrawer');
    if(ovl) ovl.classList.remove('open');
    if(drw) drw.classList.remove('open');
    state.commentsOpen=false;
    pbStart();
  };

  window.srSendComment=function(){
    var inp=document.getElementById('srCommentInp');
    if(!inp||!inp.value.trim()) return;
    var txt=inp.value.trim();
    inp.value='';
    var r=currentReel(); if(!r) return;
    r.comments.unshift({user:'You',av:'#10b981',txt:txt,time:'just now'});
    renderComments(r);
    var list=document.getElementById('srCommentsList');
    if(list) list.scrollTop=0;
    showToast('Comment posted! 💬');
  };

  window.srOpenShare=function(){
    pbClear();
    renderShareGrid();
    var ovl=document.getElementById('srShareOvl');
    var panel=document.getElementById('srSharePanel');
    if(ovl) ovl.classList.add('open');
    if(panel) panel.classList.add('open');
    state.shareOpen=true;
  };

  window.srCloseShare=function(){
    var ovl=document.getElementById('srShareOvl');
    var panel=document.getElementById('srSharePanel');
    if(ovl) ovl.classList.remove('open');
    if(panel) panel.classList.remove('open');
    state.shareOpen=false;
    pbStart();
  };

  window.srCopyLink=function(){
    var r=currentReel();
    var link='https://geohub.app/reel/'+(r?r.id:'unknown');
    try { navigator.clipboard.writeText(link); } catch(e){}
    showToast('🔗 Link copied!');
    window.srCloseShare();
  };

  window.srExpandCaption=function(){
    var cap=document.getElementById('srCaption');
    if(!cap) return;
    var expanded=cap.classList.toggle('expanded');
    var more=cap.nextElementSibling;
    if(more&&more.classList.contains('sr-more-cap')) more.style.display=expanded?'none':'';
  };

  window.srShowToast=function(msg){ showToast(msg); };

  /* ── TOAST ──────────────────────────────────────────────────── */
  function showToast(msg){
    try {
      var t=document.getElementById('srToast');
      if(!t) return;
      t.textContent=msg;
      t.classList.add('show');
      clearTimeout(showToast._t);
      showToast._t=setTimeout(function(){ t.classList.remove('show'); },2200);
    } catch(e){}
  }

  /* ── TOUCH / SWIPE ──────────────────────────────────────────── */
  function bindTouch(){
    var card=document.getElementById('srReel');
    if(!card) return;
    card.addEventListener('touchstart',function(e){
      state.touchStartY=e.touches[0].clientY;
      state.touchStartX=e.touches[0].clientX;
    },{passive:true});
    card.addEventListener('touchend',function(e){
      var dy=state.touchStartY-e.changedTouches[0].clientY;
      var dx=state.touchStartX-e.changedTouches[0].clientX;
      if(Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>44){
        if(dy>0) goNext(); else goPrev();
      }
    },{passive:true});
  }

  /* ── KEYBOARD ───────────────────────────────────────────────── */
  function bindKeyboard(){
    document.addEventListener('keydown',function(e){
      if(state.commentsOpen||state.shareOpen){
        if(e.key==='Escape'){
          if(state.commentsOpen) window.srCloseComments();
          if(state.shareOpen) window.srCloseShare();
        }
        return;
      }
      if(e.key==='ArrowDown'||e.key==='ArrowRight'){ e.preventDefault(); goNext(); }
      else if(e.key==='ArrowUp'||e.key==='ArrowLeft'){ e.preventDefault(); goPrev(); }
      else if(e.key==='Escape'){ window.location.href='feed.html'; }
      else if(e.key==='l'||e.key==='L'){ var r=currentReel(); if(r) window.srToggleLike(r.id); }
      else if(e.key==='s'||e.key==='S'){ var r2=currentReel(); if(r2) window.srToggleSave(r2.id); }
    });
  }

  /* ── SUPPRESS INJECTED BOTTOM NAV ──────────────────────────── */
  function suppressBottomNav(){
    var s=document.createElement('style');
    s.textContent='.mobile-nav,.bottom-nav,.nav-bar,[class*="bottom-nav"],[id*="bottomNav"],[id*="mobile-nav"]{display:none!important}';
    document.head.appendChild(s);
  }

  /* ── INIT ───────────────────────────────────────────────────── */
  function init(){
    try {
      suppressBottomNav();

      // tabs
      var tabs=document.querySelectorAll('.sr-tab');
      for(var i=0;i<tabs.length;i++){
        (function(btn){
          btn.addEventListener('click',function(){
            for(var j=0;j<tabs.length;j++) tabs[j].classList.remove('active');
            btn.classList.add('active');
            filterTab(btn.getAttribute('data-tab'));
          });
        })(tabs[i]);
      }

      // nav zones
      var navL=document.getElementById('srNavL');
      var navR=document.getElementById('srNavR');
      if(navL) navL.addEventListener('click',goPrev);
      if(navR) navR.addEventListener('click',goNext);

      // desktop arrows
      var extUp=document.getElementById('srExtUp');
      var extDn=document.getElementById('srExtDn');
      if(extUp) extUp.addEventListener('click',goPrev);
      if(extDn) extDn.addEventListener('click',goNext);

      // overlay close
      var drawerOvl=document.getElementById('srDrawerOvl');
      var shareOvl=document.getElementById('srShareOvl');
      if(drawerOvl) drawerOvl.addEventListener('click',window.srCloseComments);
      if(shareOvl) shareOvl.addEventListener('click',window.srCloseShare);

      // comment input enter
      var inp=document.getElementById('srCommentInp');
      if(inp) inp.addEventListener('keydown',function(e){ if(e.key==='Enter') window.srSendComment(); });

      bindTouch();
      bindKeyboard();

      // initial render
      state.filtered=REELS.slice();
      renderReel(currentReel());
      pbStart();

    } catch(e){
      if(typeof console!=='undefined') console.error('GeoHub stories init:',e);
    }
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init);
  } else {
    init();
  }

})();
