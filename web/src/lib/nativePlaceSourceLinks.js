/** Reviewed display-only links. Native IDs, ownership and activity stay intact.
 * Exact named landmarks/campuses, checked against the 2026-10-17 OSM snapshot.
 * Do not turn this into name-only matching: Fabrika tenants and same-named bus
 * stops can share an alias with the actual destination.
 */
export const NATIVE_PLACE_SOURCE_LINKS = {
  Eh89R5IPdO5loD8CioiR: 'osm_way_585352693', // Sameba Cathedral; 16 m.
  K2qwC9Yh1Tga5RpsB38K: 'osm_node_4325006493', // Tbilisi History Museum; 8 m.
  NvWbwRZcFjy3iBXKyUWP: 'osm_way_1063062536', // Mother of Georgia; 9 m.
  pcu8OsTw12CgHZuSR9uL: 'osm_way_1064270003', // Metekhi Church; 17 m.
  qVOkEvAR21xy1G1tXLUM: 'osm_way_548795814', // Fabrika complex, not its tenants; 23 m.
  vpLeiOVsPEVrT7wBkqcv: 'osm_node_6653160546', // Lolita; 15 m.
  '6XJDQljvVF0d8Cy7u8Rb': 'osm_node_1567308849', // Gabriadze Theatre; 41 m.
  '7HpBrixaAAwvi1uDwUY5': 'osm_way_174304310', // Dedaena Park, not the bus stop; 67 m.
  ChVHTv3CpIlwJKls2sm5: 'osm_node_6117627285', // Success Bar; 81 m.
  DyYeuaNn7bMaGq00FcrQ: 'osm_way_1234716193', // Tbilisi Circus; 40 m.
  INGlmd5urE4WP460koUi: 'osm_way_56677915', // National Gallery; 83 m.
  R7uZMVa1jbwwfoSmpqx8: 'osm_node_412214448', // National Museum; 20 m.
  SvFcVesXV7MEIxdxHG6y: 'osm_node_390460502', // Marjanishvili Theatre; 63 m.
  Zzs2KH7oSiFFmPTngadT: 'osm_way_1056991782', // First Republic Square; 87 m.
  fBjvosF3WtKhCjCUGFeH: 'osm_way_707446533', // Chronicle of Georgia; 36 m.
  lDOulbB70jKnx0Q8ejwH: 'osm_relation_9868102', // Rike Park; 86 m.
  lddJcHSasfo3a6TVfdoD: 'osm_relation_967676', // Airport, not nearby transport stops; 72 m.
  sVts2X0xNHcMIZrvpFIj: 'osm_relation_9820020', // Narikala; 99 m.
  vUHbNFTGGwRHZzpMcCKY: 'osm_relation_1020718', // Parliament; 49 m.
  xEFKicwm2wbefLCGCNRg: 'osm_relation_1020718', // Existing separate native Parliament record; 39 m.
  vazWmYllXHKVMw4zqKWS: 'osm_way_549602873', // Metekhi Bridge; 74 m.
  // Reviewed legacy station pages, matched by exact station identity, not distance.
  // Their old seed coordinates include misplaced centers. Surface map destinations
  // come from each station's explicit OSM stop-area entrance membership.
  '1u8Z1htmIBMRES8hsoka': 'osm_node_729551832', // Technical University
  '2zM8p1rhGZC6SbIhTyq8': 'osm_node_729562896', // Vazha-Pshavela
  AQcL2oBKrKElcg4WAg6z: 'osm_node_288584312', // 300 Aragveli
  BBY5cFQuG3rwspRmuZyH: 'osm_node_7285245527', // Varketili
  BslHWCcUORNI8wPTC69s: 'osm_node_729562894', // Delisi
  CZiA3plo4JjuTMmdRWQk: 'osm_node_729561142', // Medical University
  IV6KdLB1lVCj3kxdI6uh: 'osm_node_289358478', // Rustaveli
  MOHKyxbArASshhpGwToi: 'osm_node_437955651', // Akhmeteli Theatre
  NDc0dLE15sr7xfbUMvUV: 'osm_node_7285245525', // Station Square 1
  OGfdgRGGLQuY3KuxtDLG: 'osm_node_289383777', // Nadzaladevi
  Sm4FHBHLvz0XpyNk1izV: 'osm_node_5768595732', // Avlabari
  Wm26jgsAUa7PXy0nIpL9: 'osm_node_288584317', // Isani
  XPDBOcqNUFISF5WTJd8E: 'osm_node_729578803', // Tsereteli
  dZkyztXGxcc73odcoGOV: 'osm_node_437955726', // Guramishvili
  f1MCzdy8CdtjZU4rAwxH: 'osm_node_7285245526', // Station Square 2
  gm5e3De7VncSOrD59bdC: 'osm_node_729529330', // Samgori
  kYwrjGa3FfM2CwVadcFT: 'osm_node_289384125', // Marjanishvili
  pj3fmUFERF1bPlZb8fJH: 'osm_node_4632061332', // Didube
  qirgxmRxdVwIfR7PXpFO: 'osm_node_289358479', // Liberty Square
  raIfnyiJbPaA3QoTDU9s: 'osm_node_437955710', // Sarajishvili
  vpQFPnVaKzrpYcEyyeG8: 'osm_node_725175525', // Gotsiridze
  wohT13oYIiOJCl5bxtw5: 'osm_node_358503996', // State University
  xzwAWFYC2FmcTNw0s4yi: 'osm_node_5267558014', // Ghrmaghele
};
