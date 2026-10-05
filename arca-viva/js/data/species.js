/* =========================================================
   Espécies — dados de jogo (necessidades, habitat, aparência)
   ========================================================= */
(function (ZM) {
  'use strict';

  /* Perfis de bioma: fração ideal de cada terreno + vegetação desejada
     (foliage = proporção de tiles com vegetação: árvores, arbustos, capim) */
  ZM.BIOMES = {
    savana:    { name: 'Savana',            mix: { grass: 0.6, dirt: 0.25, sand: 0.05, water: 0.1 }, foliage: 0.12 },
    pantanal:  { name: 'Pantanal',          mix: { grass: 0.4, dirt: 0.15, water: 0.35, forest: 0.1 }, foliage: 0.22 },
    tropical:  { name: 'Floresta tropical', mix: { forest: 0.6, grass: 0.1, dirt: 0.1, water: 0.2 }, foliage: 0.45 },
    cerrado:   { name: 'Cerrado',           mix: { grass: 0.5, dirt: 0.3, sand: 0.1, rock: 0.1 }, foliage: 0.18 },
    rio:       { name: 'Rio africano',      mix: { water: 0.45, grass: 0.35, dirt: 0.2 }, foliage: 0.1 },
    lagoa:     { name: 'Lagoa salobra',     mix: { water: 0.45, sand: 0.3, dirt: 0.15, grass: 0.1 }, foliage: 0.05 },
    mata:      { name: 'Mata Atlântica',    mix: { forest: 0.7, grass: 0.1, rock: 0.1, water: 0.1 }, foliage: 0.5 },
    montanha:  { name: 'Floresta temperada', mix: { forest: 0.45, rock: 0.25, grass: 0.2, water: 0.1 }, foliage: 0.35 },
    australia: { name: 'Outback australiano', mix: { sand: 0.4, dirt: 0.4, grass: 0.2 }, foliage: 0.1 },
    deserto:   { name: 'Deserto do Kalahari', mix: { sand: 0.7, rock: 0.2, dirt: 0.1 }, foliage: 0.04 },
    rioamaz:   { name: 'Rio amazônico',     mix: { water: 0.6, forest: 0.25, dirt: 0.15 }, foliage: 0.3 },
    varzea:    { name: 'Várzea alagada',    mix: { water: 0.85, forest: 0.1, grass: 0.05 }, foliage: 0.15 },
    costa:     { name: 'Costão rochoso',    mix: { salt: 0.45, sand: 0.3, rock: 0.25 }, foliage: 0.02 },
    recife:    { name: 'Recife e praia',    mix: { salt: 0.7, sand: 0.2, rock: 0.1 }, foliage: 0.02 },
    oceano:    { name: 'Mar aberto',        mix: { salt: 0.95, sand: 0.05 }, foliage: 0 },
    polar:     { name: 'Ártico',            mix: { snow: 0.45, salt: 0.35, rock: 0.2 }, foliage: 0 },
  };

  /* food: hay (feno/verdura), meat (carne), fruit (frutas), fish (peixe), insects (insetos), seeds (sementes)
     custo de reposição de um comedouro por tipo de alimento */
  ZM.FOOD = {
    hay:     { name: 'Feno e verduras', cost: 40, icon: '🌾' },
    fruit:   { name: 'Frutas', cost: 70, icon: '🍌' },
    seeds:   { name: 'Sementes e frutas', cost: 55, icon: '🌰' },
    insects: { name: 'Insetos', cost: 80, icon: '🐜' },
    fish:    { name: 'Peixe e crustáceos', cost: 90, icon: '🐟' },
    meat:    { name: 'Carne', cost: 130, icon: '🥩' },
  };

  const S = {};
  function add(def) {
    def.biomeData = ZM.BIOMES[def.biome];
    S[def.id] = def;
  }

  /* ---------- Espécies iniciais ---------- */
  add({
    id: 'capivara', name: 'Capivara', plural: 'Capivaras', sci: 'Hydrochoerus hydrochaeris',
    region: 'América do Sul', continent: 'brasil', biome: 'pantanal', diet: 'Herbívora', food: 'hay',
    status: 'LC', price: 600, cp: 0, popularity: 5, space: 7, group: [2, 10], fence: 1,
    swims: true, wades: true, nocturnal: false, sleepy: 1.0, shade: true, climber: false,
    size: 0.85, speed: 0.8, gestation: 3, maturity: 5, litter: [1, 3], temp: [18, 34], unlock: 'start',
    look: { type: 'quad', body: '#8a6240', light: '#a57a52', dark: '#5e4129', L: 17, H: 10, leg: 3.5, neck: 0, head: 4.6, snout: 3, ears: 'round', tail: 'none', headLow: true },
    fact: 'É o maior roedor do mundo e passa boa parte do dia dentro d\'água para se refrescar.',
  });
  add({
    id: 'zebra', name: 'Zebra', plural: 'Zebras', sci: 'Equus quagga',
    region: 'África', continent: 'africa', biome: 'savana', diet: 'Herbívora', food: 'hay',
    status: 'NT', price: 1500, cp: 0, popularity: 6, space: 10, group: [3, 10], fence: 1,
    swims: false, wades: false, nocturnal: false, sleepy: 0.8, shade: false, herd: true,
    size: 1.1, speed: 1.15, gestation: 4, maturity: 6, litter: [1, 1], temp: [15, 36], unlock: 'start',
    look: { type: 'quad', body: '#f4f1ea', light: '#ffffff', dark: '#1d1d1d', L: 20, H: 10, leg: 9, neck: 7, head: 4, snout: 4.5, ears: 'pointy', tail: 'tuft', mane: 'stripe', pattern: 'stripes' },
    fact: 'O padrão de listras de cada zebra é único, como uma impressão digital.',
  });
  add({
    id: 'leao', name: 'Leão', plural: 'Leões', sci: 'Panthera leo',
    region: 'África', continent: 'africa', biome: 'savana', diet: 'Carnívora', food: 'meat',
    status: 'VU', price: 5200, cp: 0, popularity: 9, space: 14, group: [2, 6], fence: 2,
    swims: false, wades: false, nocturnal: false, sleepy: 2.2, shade: true, predator: true,
    size: 1.15, speed: 1.0, gestation: 4, maturity: 7, litter: [1, 3], temp: [15, 38], unlock: 'start', dimorph: 1.1,
    look: { type: 'quad', body: '#c9994f', light: '#dcb576', dark: '#8f6a33', L: 21, H: 10, leg: 7, neck: 2, head: 5, snout: 3, ears: 'round', tail: 'tuft', mane: 'lion' },
    fact: 'Leões podem dormir até 20 horas por dia. O rugido é ouvido a 8 km de distância.',
  });
  add({
    id: 'girafa', name: 'Girafa', plural: 'Girafas', sci: 'Giraffa camelopardalis',
    region: 'África', continent: 'africa', biome: 'savana', diet: 'Herbívora', food: 'hay',
    status: 'VU', price: 4200, cp: 0, popularity: 8, space: 16, group: [2, 8], fence: 2,
    swims: false, wades: false, nocturnal: false, sleepy: 0.6, shade: false, browser: true,
    size: 1.2, speed: 0.9, gestation: 5, maturity: 8, litter: [1, 1], temp: [15, 38], unlock: 'start',
    look: { type: 'quad', body: '#e2b45e', light: '#f3d38f', dark: '#9a5f25', L: 18, H: 9, leg: 15, neck: 22, head: 3.8, snout: 4, ears: 'pointy', tail: 'tuft', pattern: 'patches', ossicones: true, neckAngle: 0.25 },
    fact: 'A língua da girafa mede cerca de 50 cm e é escura para não queimar com o sol.',
  });
  add({
    id: 'flamingo', name: 'Flamingo', plural: 'Flamingos', sci: 'Phoenicopterus roseus',
    region: 'África / Europa / Ásia', continent: 'africa', biome: 'lagoa', diet: 'Onívora', food: 'fish',
    status: 'LC', price: 500, cp: 0, popularity: 5, space: 3, group: [4, 16], fence: 1,
    swims: false, wades: true, nocturnal: false, sleepy: 0.8, shade: false, bird: true,
    size: 0.9, speed: 0.75, gestation: 3, maturity: 4, litter: [1, 1], temp: [10, 38], unlock: 'start',
    look: { type: 'flamingo', body: '#f59ab0', dark: '#e2668a', light: '#ffc6d3' },
    fact: 'A cor rosa vem dos pigmentos dos crustáceos e algas que eles comem.',
  });

  /* ---------- Desbloqueáveis por pesquisa / conservação ---------- */
  add({
    id: 'anta', name: 'Anta', plural: 'Antas', sci: 'Tapirus terrestris',
    region: 'América do Sul', continent: 'brasil', biome: 'tropical', diet: 'Herbívora', food: 'fruit',
    status: 'VU', price: 1900, cp: 0, popularity: 6, space: 12, group: [1, 4], fence: 1,
    swims: true, wades: true, nocturnal: true, sleepy: 1.0, shade: true,
    size: 1.05, speed: 0.8, gestation: 5, maturity: 7, litter: [1, 1], temp: [18, 34], unlock: 'research',
    look: { type: 'quad', body: '#4a4440', light: '#6a625b', dark: '#2e2a27', L: 20, H: 11, leg: 5, neck: 1, head: 4.5, snout: 5, trunkShort: true, ears: 'round', tail: 'none' },
    fact: 'É o maior mamífero terrestre do Brasil e espalha sementes pela floresta: a "jardineira".',
  });
  add({
    id: 'tamandua', name: 'Tamanduá-bandeira', plural: 'Tamanduás-bandeira', sci: 'Myrmecophaga tridactyla',
    region: 'América do Sul', continent: 'brasil', biome: 'cerrado', diet: 'Insetívora', food: 'insects',
    status: 'VU', price: 2300, cp: 0, popularity: 7, space: 12, group: [1, 3], fence: 1,
    swims: false, wades: false, nocturnal: false, sleepy: 1.2, shade: true,
    size: 0.95, speed: 0.7, gestation: 4, maturity: 6, litter: [1, 1], temp: [16, 34], unlock: 'research',
    look: { type: 'quad', body: '#6e5e4c', light: '#d8d0c0', dark: '#1f1b17', L: 20, H: 9, leg: 5, neck: 1, head: 2.6, snout: 10, ears: 'tiny', tail: 'bushy', pattern: 'band' },
    fact: 'Não tem dentes: usa uma língua de até 60 cm para comer até 30 mil formigas por dia.',
  });
  add({
    id: 'jacare', name: 'Jacaré-do-papo-amarelo', plural: 'Jacarés', sci: 'Caiman latirostris',
    region: 'América do Sul', continent: 'brasil', biome: 'pantanal', diet: 'Carnívora', food: 'fish',
    status: 'LC', price: 1600, cp: 0, popularity: 6, space: 8, group: [1, 6], fence: 2,
    swims: true, wades: true, nocturnal: false, sleepy: 2.0, shade: false, predator: true, reptile: true,
    size: 1.0, speed: 0.5, gestation: 5, maturity: 7, litter: [1, 4], temp: [22, 36], unlock: 'research',
    look: { type: 'croc', body: '#5f6b3a', light: '#c9c27a', dark: '#3a4223' },
    fact: 'A temperatura do ninho define o sexo dos filhotes.',
  });
  add({
    id: 'arara', name: 'Arara-azul', plural: 'Araras-azuis', sci: 'Anodorhynchus hyacinthinus',
    region: 'Pantanal e Cerrado', continent: 'brasil', biome: 'cerrado', diet: 'Herbívora', food: 'seeds',
    status: 'VU', price: 1300, cp: 5, popularity: 7, space: 3, group: [2, 10], fence: 1,
    swims: false, wades: false, nocturnal: false, sleepy: 0.8, shade: true, bird: true, climber: true,
    size: 0.8, speed: 1.0, gestation: 4, maturity: 5, litter: [1, 2], temp: [18, 36], unlock: 'research',
    look: { type: 'parrot', body: '#2a4fb8', dark: '#1a3480', light: '#ffd54a' },
    fact: 'É a maior arara do mundo; seu bico quebra cocos de palmeira como o acuri.',
  });
  add({
    id: 'loboguara', name: 'Lobo-guará', plural: 'Lobos-guará', sci: 'Chrysocyon brachyurus',
    region: 'América do Sul', continent: 'brasil', biome: 'cerrado', diet: 'Onívora', food: 'fruit',
    status: 'NT', price: 3600, cp: 10, popularity: 8, space: 14, group: [1, 3], fence: 2,
    swims: false, wades: false, nocturnal: true, sleepy: 1.0, shade: true,
    size: 0.95, speed: 1.1, gestation: 4, maturity: 6, litter: [1, 3], temp: [10, 34], unlock: 'research',
    look: { type: 'quad', body: '#c8642a', light: '#e28c4c', dark: '#2a1a12', L: 16, H: 8, leg: 12, neck: 4, head: 3.8, snout: 4.5, ears: 'big', tail: 'fox', legsDark: true, mane: 'stripe' },
    fact: 'Metade de sua dieta é a lobeira, fruto que ajuda a espalhar pelo Cerrado.',
  });
  add({
    id: 'onca', name: 'Onça-pintada', plural: 'Onças-pintadas', sci: 'Panthera onca',
    region: 'Américas', continent: 'brasil', biome: 'tropical', diet: 'Carnívora', food: 'meat',
    status: 'NT', price: 7200, cp: 20, popularity: 10, space: 16, group: [1, 3], fence: 3,
    swims: true, wades: true, nocturnal: true, sleepy: 1.6, shade: true, predator: true, climber: true,
    size: 1.1, speed: 1.05, gestation: 4, maturity: 7, litter: [1, 2], temp: [18, 36], unlock: 'research',
    look: { type: 'quad', body: '#d9a441', light: '#efd08a', dark: '#2b1d0e', L: 20, H: 9.5, leg: 6, neck: 2, head: 4.8, snout: 3, ears: 'round', tail: 'long', pattern: 'rosettes' },
    fact: 'Maior felino das Américas, tem a mordida mais forte proporcional ao tamanho entre os felinos.',
  });
  add({
    id: 'mico', name: 'Mico-leão-dourado', plural: 'Micos-leões-dourados', sci: 'Leontopithecus rosalia',
    region: 'Mata Atlântica (RJ)', continent: 'brasil', biome: 'mata', diet: 'Onívora', food: 'fruit',
    status: 'EN', price: 3200, cp: 40, popularity: 9, space: 3, group: [2, 8], fence: 2,
    swims: false, wades: false, nocturnal: false, sleepy: 0.8, shade: true, climber: true, primate: true,
    size: 0.55, speed: 1.1, gestation: 4, maturity: 5, litter: [1, 2], temp: [18, 32], unlock: 'research',
    look: { type: 'primate', body: '#f0a020', dark: '#c56f0c', light: '#ffd27a', face: '#4a2c1a', small: true, maneP: true },
    fact: 'Chegou a ter menos de 200 indivíduos nos anos 1970; programas de conservação o salvaram.',
  });
  add({
    id: 'chimpanze', name: 'Chimpanzé', plural: 'Chimpanzés', sci: 'Pan troglodytes',
    region: 'África', continent: 'africa', biome: 'tropical', diet: 'Onívora', food: 'fruit',
    status: 'EN', price: 8200, cp: 30, popularity: 9, space: 10, group: [3, 10], fence: 3,
    swims: false, wades: false, nocturnal: false, sleepy: 0.9, shade: true, climber: true, primate: true,
    size: 0.95, speed: 1.0, gestation: 5, maturity: 8, litter: [1, 1], temp: [18, 34], unlock: 'research',
    look: { type: 'primate', body: '#2a2320', dark: '#15110f', light: '#4a3d36', face: '#c9a183' },
    fact: 'Usam galhos como ferramentas para "pescar" cupins — comportamento ensinado entre gerações.',
  });
  add({
    id: 'hipopotamo', name: 'Hipopótamo', plural: 'Hipopótamos', sci: 'Hippopotamus amphibius',
    region: 'África', continent: 'africa', biome: 'rio', diet: 'Herbívora', food: 'hay',
    status: 'VU', price: 9500, cp: 0, popularity: 8, space: 18, group: [2, 8], fence: 3,
    swims: true, wades: true, nocturnal: true, sleepy: 1.3, shade: false,
    size: 1.3, speed: 0.7, gestation: 6, maturity: 9, litter: [1, 1], temp: [18, 38], unlock: 'research',
    look: { type: 'quad', body: '#7d6f7a', light: '#c89aa0', dark: '#4f4450', L: 24, H: 13, leg: 4, neck: 0, head: 7, snout: 5, ears: 'tiny', tail: 'stub', bigMouth: true },
    fact: 'Secretam um "suor" avermelhado que funciona como protetor solar natural.',
  });
  add({
    id: 'elefante', name: 'Elefante-africano', plural: 'Elefantes', sci: 'Loxodonta africana',
    region: 'África', continent: 'africa', biome: 'savana', diet: 'Herbívora', food: 'hay',
    status: 'EN', price: 16000, cp: 50, popularity: 10, space: 26, group: [2, 8], fence: 3,
    swims: true, wades: true, nocturnal: false, sleepy: 0.6, shade: true, herd: true,
    size: 1.6, speed: 0.75, dimorph: 1.12, gestation: 7, maturity: 10, litter: [1, 1], temp: [15, 38], unlock: 'research',
    look: { type: 'quad', body: '#8d8d8a', light: '#a8a8a4', dark: '#626260', L: 24, H: 15, leg: 9, neck: 0, head: 7, snout: 0, trunk: true, tusks: true, ears: 'elephant', tail: 'thin' },
    fact: 'Comunicam-se por infrassons que viajam vários quilômetros pelo solo.',
  });

  /* ---------- Novas espécies terrestres ---------- */
  add({
    id: 'tigre', name: 'Tigre-de-bengala', plural: 'Tigres', sci: 'Panthera tigris tigris',
    region: 'Índia e Bangladesh', continent: 'asia', biome: 'tropical', diet: 'Carnívora', food: 'meat',
    status: 'EN', price: 9500, cp: 25, popularity: 10, space: 16, group: [1, 3], fence: 3,
    swims: true, wades: true, nocturnal: false, sleepy: 1.6, shade: true, predator: true, dimorph: 1.12,
    size: 1.2, speed: 1.0, gestation: 4, maturity: 8, litter: [1, 3], temp: [10, 36], unlock: 'research',
    look: { type: 'quad', body: '#e0802a', light: '#f6e2c4', dark: '#1d140c', L: 22, H: 10, leg: 6.5, neck: 2, head: 5, snout: 3, ears: 'round', tail: 'long', pattern: 'stripes' },
    fact: 'Ao contrário da maioria dos felinos, o tigre adora água e é ótimo nadador.',
  });
  add({
    id: 'ursopardo', name: 'Urso-pardo', plural: 'Ursos-pardos', sci: 'Ursus arctos',
    region: 'Hemisfério Norte', continent: 'asia', biome: 'montanha', diet: 'Onívora', food: 'fruit',
    status: 'LC', price: 6500, cp: 0, popularity: 8, space: 16, group: [1, 3], fence: 3,
    swims: true, wades: true, nocturnal: false, sleepy: 1.4, shade: true, predator: true, dimorph: 1.18,
    size: 1.25, speed: 0.85, gestation: 5, maturity: 9, litter: [1, 2], temp: [-10, 28], unlock: 'research',
    look: { type: 'quad', body: '#6b4a2f', light: '#8a6646', dark: '#3e2a1a', L: 22, H: 13, leg: 6, neck: 1, head: 5.5, snout: 3, ears: 'round', tail: 'stub', hump: true },
    fact: 'Antes de hibernar, pode ganhar até 1,5 kg de gordura por dia.',
  });
  add({
    id: 'lobo', name: 'Lobo-cinzento', plural: 'Lobos-cinzentos', sci: 'Canis lupus',
    region: 'Hemisfério Norte', continent: 'asia', biome: 'montanha', diet: 'Carnívora', food: 'meat',
    status: 'LC', price: 3200, cp: 0, popularity: 7, space: 12, group: [3, 8], fence: 2,
    swims: false, wades: false, nocturnal: true, sleepy: 1.0, shade: true, predator: true, herd: true, dimorph: 1.08,
    size: 1.0, speed: 1.15, gestation: 4, maturity: 6, litter: [2, 4], temp: [-20, 28], unlock: 'research',
    look: { type: 'quad', body: '#8d8a84', light: '#d8d4cc', dark: '#3c3a36', L: 18, H: 8, leg: 9, neck: 3, head: 3.8, snout: 4, ears: 'pointy', tail: 'fox' },
    fact: 'Vive em alcateias familiares lideradas pelo casal reprodutor.',
  });
  add({
    id: 'sucuarana', name: 'Onça-parda', plural: 'Onças-pardas', sci: 'Puma concolor',
    region: 'Américas', continent: 'brasil', biome: 'cerrado', diet: 'Carnívora', food: 'meat',
    status: 'LC', price: 4800, cp: 0, popularity: 8, space: 14, group: [1, 2], fence: 3,
    swims: false, wades: false, nocturnal: true, sleepy: 1.5, shade: true, predator: true, climber: true, dimorph: 1.1,
    size: 1.05, speed: 1.1, gestation: 4, maturity: 7, litter: [1, 3], temp: [0, 36], unlock: 'research',
    look: { type: 'quad', body: '#b8915e', light: '#e8d6b8', dark: '#4a3420', L: 20, H: 8.5, leg: 6.5, neck: 2, head: 4.2, snout: 2.8, ears: 'round', tail: 'long' },
    fact: 'Também chamada de suçuarana ou puma: tem a maior distribuição entre os mamíferos terrestres das Américas.',
  });
  add({
    id: 'rinoceronte', name: 'Rinoceronte-branco', plural: 'Rinocerontes', sci: 'Ceratotherium simum',
    region: 'África', continent: 'africa', biome: 'savana', diet: 'Herbívora', food: 'hay',
    status: 'NT', price: 14000, cp: 20, popularity: 9, space: 24, group: [2, 6], fence: 3,
    swims: false, wades: true, nocturnal: false, sleepy: 1.2, shade: true, dimorph: 1.1,
    size: 1.45, speed: 0.7, gestation: 7, maturity: 10, litter: [1, 1], temp: [15, 38], unlock: 'research',
    look: { type: 'quad', body: '#9a958c', light: '#b4afa5', dark: '#6a665e', L: 26, H: 14, leg: 6, neck: 0, head: 6, snout: 5, horn: true, ears: 'pointy', tail: 'thin' },
    fact: 'O chifre é feito de queratina, a mesma proteína das nossas unhas.',
  });
  add({
    id: 'avestruz', name: 'Avestruz', plural: 'Avestruzes', sci: 'Struthio camelus',
    region: 'África', continent: 'africa', biome: 'savana', diet: 'Onívora', food: 'seeds',
    status: 'LC', price: 1400, cp: 0, popularity: 6, space: 8, group: [2, 8], fence: 1,
    swims: false, wades: false, nocturnal: false, sleepy: 0.7, shade: false, bird: true, herd: true,
    size: 1.15, speed: 1.4, gestation: 3, maturity: 5, litter: [1, 3], temp: [5, 42], unlock: 'research',
    look: { type: 'ratite', body: '#1e1e1e', tail: '#f4f1ea', neck: '#d9a0a0', female: { body: '#7a6650', tail: '#b8a890', neck: '#c4a896' } },
    fact: 'Maior ave do mundo: não voa, mas corre a 70 km/h. Machos são pretos; fêmeas, pardas.',
  });
  add({
    id: 'ema', name: 'Ema', plural: 'Emas', sci: 'Rhea americana',
    region: 'América do Sul', continent: 'brasil', biome: 'cerrado', diet: 'Onívora', food: 'seeds',
    status: 'NT', price: 1100, cp: 0, popularity: 6, space: 7, group: [2, 10], fence: 1,
    swims: false, wades: false, nocturnal: false, sleepy: 0.7, shade: false, bird: true, herd: true,
    size: 1.0, speed: 1.3, gestation: 3, maturity: 5, litter: [1, 3], temp: [0, 40], unlock: 'research',
    look: { type: 'ratite', body: '#8c8476', tail: '#a69e90', neck: '#9a9284', collar: '#2a2622' },
    fact: 'Maior ave do Brasil. É o macho quem choca os ovos e cuida dos filhotes.',
  });
  add({
    id: 'canguru', name: 'Canguru-vermelho', plural: 'Cangurus', sci: 'Osphranter rufus',
    region: 'Austrália', continent: 'oceania', biome: 'australia', diet: 'Herbívora', food: 'hay',
    status: 'LC', price: 2600, cp: 0, popularity: 7, space: 10, group: [3, 10], fence: 2,
    swims: false, wades: false, nocturnal: false, sleepy: 1.1, shade: true, herd: true, dimorph: 1.2,
    size: 1.05, speed: 1.3, gestation: 3, maturity: 6, litter: [1, 1], temp: [5, 42], unlock: 'research',
    look: { type: 'kangaroo', body: '#b5603a', light: '#e6c2a6', dark: '#5a2e1a', female: { body: '#8f8a92', light: '#d2ced4', dark: '#4e4a52' } },
    fact: 'Machos são avermelhados e fêmeas cinza-azuladas. O filhote vive 8 meses na bolsa.',
  });
  add({
    id: 'suricato', name: 'Suricato', plural: 'Suricatos', sci: 'Suricata suricatta',
    region: 'Sul da África', continent: 'africa', biome: 'deserto', diet: 'Insetívora', food: 'insects',
    status: 'LC', price: 700, cp: 0, popularity: 7, space: 2, group: [4, 15], fence: 1,
    swims: false, wades: false, nocturnal: false, sleepy: 0.8, shade: true,
    size: 0.5, speed: 1.0, gestation: 2, maturity: 4, litter: [2, 4], temp: [10, 40], unlock: 'research',
    look: { type: 'meerkat', body: '#c9a77a', light: '#e8d4b4', dark: '#3a2a1a' },
    fact: 'Sempre há um sentinela de pé vigiando enquanto o grupo procura comida.',
  });
  add({
    id: 'gorila', name: 'Gorila-do-ocidente', plural: 'Gorilas', sci: 'Gorilla gorilla',
    region: 'África Central', continent: 'africa', biome: 'tropical', diet: 'Herbívora', food: 'fruit',
    status: 'CR', price: 15000, cp: 60, popularity: 10, space: 14, group: [3, 8], fence: 3,
    swims: false, wades: false, nocturnal: false, sleepy: 1.2, shade: true, climber: true, primate: true, dimorph: 1.25,
    size: 1.25, speed: 0.8, gestation: 6, maturity: 10, litter: [1, 1], temp: [18, 34], unlock: 'research',
    look: { type: 'primate', body: '#2b2b2e', dark: '#161618', light: '#3e3e42', face: '#4a4246', silverback: true },
    fact: 'O macho adulto, o "costas-prateadas", lidera e protege o grupo familiar.',
  });
  add({
    id: 'tatucanastra', name: 'Tatu-canastra', plural: 'Tatus-canastra', sci: 'Priodontes maximus',
    region: 'América do Sul', continent: 'brasil', biome: 'cerrado', diet: 'Insetívora', food: 'insects',
    status: 'VU', price: 2800, cp: 10, popularity: 7, space: 10, group: [1, 2], fence: 1,
    swims: false, wades: false, nocturnal: true, sleepy: 1.4, shade: true,
    size: 0.95, speed: 0.6, gestation: 4, maturity: 6, litter: [1, 1], temp: [16, 34], unlock: 'research',
    look: { type: 'quad', body: '#7d6a55', light: '#c9b89a', dark: '#4a3c2e', L: 19, H: 9, leg: 3, neck: 0, head: 3, snout: 4, ears: 'tiny', tail: 'thin', pattern: 'bands' },
    fact: 'Maior tatu do mundo: suas tocas abrigam dezenas de outras espécies.',
  });
  add({
    id: 'tucano', name: 'Tucano-toco', plural: 'Tucanos', sci: 'Ramphastos toco',
    region: 'América do Sul', continent: 'brasil', biome: 'mata', diet: 'Onívora', food: 'fruit',
    status: 'LC', price: 900, cp: 0, popularity: 7, space: 2, group: [2, 8], fence: 1,
    swims: false, wades: false, nocturnal: false, sleepy: 0.8, shade: true, bird: true, climber: true,
    size: 0.75, speed: 1.0, gestation: 3, maturity: 4, litter: [1, 3], temp: [16, 36], unlock: 'research',
    look: { type: 'parrot', body: '#151515', dark: '#0a0a0a', light: '#ffffff', beak: '#ff8a1e' },
    fact: 'O bico enorme é leve e ajuda a regular a temperatura do corpo.',
  });
  add({
    id: 'quati', name: 'Quati', plural: 'Quatis', sci: 'Nasua nasua',
    region: 'América do Sul', continent: 'brasil', biome: 'mata', diet: 'Onívora', food: 'fruit',
    status: 'LC', price: 800, cp: 0, popularity: 6, space: 4, group: [3, 12], fence: 1,
    swims: false, wades: false, nocturnal: false, sleepy: 0.9, shade: true, climber: true,
    size: 0.6, speed: 1.0, gestation: 3, maturity: 4, litter: [2, 4], temp: [12, 36], unlock: 'research',
    look: { type: 'quad', body: '#8a5a35', light: '#d6b48c', dark: '#3a2414', L: 15, H: 7, leg: 4, neck: 1, head: 3, snout: 5, ears: 'round', tail: 'ring' },
    fact: 'Anda em bandos de fêmeas e filhotes com a cauda listrada sempre erguida.',
  });
  add({
    id: 'vinagre', name: 'Cachorro-vinagre', plural: 'Cachorros-vinagre', sci: 'Speothos venaticus',
    region: 'América do Sul', continent: 'brasil', biome: 'tropical', diet: 'Carnívora', food: 'meat',
    status: 'NT', price: 2400, cp: 5, popularity: 6, space: 8, group: [3, 8], fence: 2,
    swims: true, wades: true, nocturnal: false, sleepy: 1.0, shade: true, predator: true, herd: true,
    size: 0.7, speed: 1.05, gestation: 3, maturity: 5, litter: [2, 4], temp: [16, 36], unlock: 'research',
    look: { type: 'quad', body: '#9a5426', light: '#c47a42', dark: '#2a1a10', L: 16, H: 8, leg: 4, neck: 1, head: 3.6, snout: 2.6, ears: 'round', tail: 'stub', legsDark: true },
    fact: 'Canídeo raro que nada bem e tem membranas entre os dedos.',
  });
  add({
    id: 'preguica', name: 'Preguiça-de-três-dedos', plural: 'Preguiças', sci: 'Bradypus variegatus',
    region: 'América do Sul', continent: 'brasil', biome: 'tropical', diet: 'Herbívora', food: 'hay',
    status: 'LC', price: 1600, cp: 0, popularity: 8, space: 4, group: [1, 3], fence: 1,
    swims: true, wades: false, nocturnal: false, sleepy: 2.6, shade: true, climber: true,
    size: 0.7, speed: 0.22, gestation: 5, maturity: 6, litter: [1, 1], temp: [20, 34], unlock: 'research',
    look: { type: 'sloth', body: '#8a7a62', light: '#cfc2a6', dark: '#3a2a1a', face: '#efe4ca' },
    fact: 'Desce da árvore só uma vez por semana. Algas crescem no seu pelo e a camuflam.',
  });

  /* ---------- Aquáticos e marinhos ---------- */
  add({
    id: 'ariranha', name: 'Ariranha', plural: 'Ariranhas', sci: 'Pteronura brasiliensis',
    region: 'Amazônia e Pantanal', continent: 'brasil', biome: 'rioamaz', diet: 'Piscívora', food: 'fish',
    status: 'EN', price: 4800, cp: 20, popularity: 9, space: 6, group: [3, 8], fence: 2, aquaticGroup: 'doce',
    swims: true, wades: true, nocturnal: false, sleepy: 0.8, shade: true, predator: true,
    size: 0.85, speed: 1.0, gestation: 3, maturity: 5, litter: [1, 3], temp: [20, 34], unlock: 'research',
    look: { type: 'quad', body: '#5a3a24', light: '#e8d8b8', dark: '#2e1c10', L: 19, H: 6, leg: 3, neck: 1, head: 3.3, snout: 2.4, ears: 'tiny', tail: 'otter' },
    fact: 'A "onça-d\'água" pode passar de 1,8 m e vive em grupos familiares muito barulhentos.',
  });
  add({
    id: 'peixeboi', name: 'Peixe-boi-amazônico', plural: 'Peixes-boi', sci: 'Trichechus inunguis',
    region: 'Bacia Amazônica', continent: 'brasil', biome: 'varzea', diet: 'Herbívora', food: 'hay',
    status: 'VU', price: 9000, cp: 25, popularity: 9, space: 12, group: [1, 4], fence: 3, aquaticGroup: 'doce',
    waterOnly: 'fresh', tank: true, noThirst: true, swims: true, nocturnal: false, sleepy: 1.2,
    size: 1.3, speed: 0.4, gestation: 6, maturity: 9, litter: [1, 1], temp: [24, 32], unlock: 'research',
    look: { type: 'fish', kind: 'manatee', body: '#7c8086', light: '#a4a8ae', dark: '#50545a' },
    fact: 'Come até 8% do próprio peso em plantas aquáticas por dia. Só existe em água doce.',
  });
  add({
    id: 'boto', name: 'Boto-cor-de-rosa', plural: 'Botos', sci: 'Inia geoffrensis',
    region: 'Bacia Amazônica', continent: 'brasil', biome: 'varzea', diet: 'Piscívora', food: 'fish',
    status: 'EN', price: 12000, cp: 40, popularity: 10, space: 16, group: [1, 4], fence: 3, aquaticGroup: 'doce',
    waterOnly: 'fresh', tank: true, noThirst: true, swims: true, jumper: true, nocturnal: false, sleepy: 0.7, dimorph: 1.1,
    size: 1.1, speed: 0.9, gestation: 6, maturity: 9, litter: [1, 1], temp: [24, 32], unlock: 'research',
    look: { type: 'fish', kind: 'dolphin', body: '#f0a2b2', light: '#ffd4dc', dark: '#c8788a', beak: 9 },
    fact: 'Maior golfinho de rio do mundo. Os machos são mais rosados que as fêmeas.',
  });
  add({
    id: 'pinguim', name: 'Pinguim-de-magalhães', plural: 'Pinguins', sci: 'Spheniscus magellanicus',
    region: 'Patagônia (visita o litoral do Brasil)', continent: 'brasil', biome: 'costa', diet: 'Piscívora', food: 'fish',
    status: 'LC', price: 1600, cp: 0, popularity: 9, space: 3, group: [6, 20], fence: 1, aquaticGroup: 'marinho',
    swims: true, wades: true, noThirst: true, marine: true, nocturnal: false, sleepy: 0.8, bird: true,
    size: 0.75, speed: 0.6, gestation: 3, maturity: 4, litter: [1, 2], temp: [2, 24], unlock: 'research',
    look: { type: 'penguin', body: '#1e2226', light: '#f6f6f2', dark: '#0e1012' },
    fact: 'Todo inverno, jovens pinguins chegam ao litoral brasileiro seguindo correntes frias.',
  });
  add({
    id: 'leaomarinho', name: 'Leão-marinho-do-sul', plural: 'Leões-marinhos', sci: 'Otaria flavescens',
    region: 'Litoral sul da América do Sul', continent: 'brasil', biome: 'costa', diet: 'Piscívora', food: 'fish',
    status: 'LC', price: 5200, cp: 0, popularity: 9, space: 10, group: [2, 8], fence: 2, aquaticGroup: 'marinho',
    swims: true, wades: true, noThirst: true, marine: true, nocturnal: false, sleepy: 1.5, dimorph: 1.35,
    size: 1.15, speed: 0.6, gestation: 5, maturity: 7, litter: [1, 1], temp: [5, 26], unlock: 'research',
    look: { type: 'seal', body: '#7a5236', light: '#a87a56', dark: '#4a301e', mane: true, female: { body: '#a08060', light: '#c8a882', dark: '#6a5038', mane: false } },
    fact: 'Machos chegam a 350 kg e têm uma juba; as fêmeas são bem menores.',
  });
  add({
    id: 'tartaruga', name: 'Tartaruga-verde', plural: 'Tartarugas-verdes', sci: 'Chelonia mydas',
    region: 'Oceanos tropicais (desova no Brasil)', continent: 'brasil', biome: 'recife', diet: 'Herbívora', food: 'hay',
    status: 'EN', price: 3600, cp: 15, popularity: 8, space: 6, group: [1, 6], fence: 1, aquaticGroup: 'marinho',
    swims: true, wades: true, noThirst: true, marine: true, nocturnal: false, sleepy: 1.2, reptile: true,
    size: 0.9, speed: 0.45, gestation: 5, maturity: 8, litter: [1, 4], temp: [22, 32], unlock: 'research',
    look: { type: 'turtle', body: '#5d6b3a', light: '#c9c48a', dark: '#3a4422', shell: '#6b5a32' },
    fact: 'Adultas comem algas e capim-marinho. As fêmeas voltam à praia onde nasceram para desovar.',
  });
  add({
    id: 'golfinho', name: 'Golfinho-nariz-de-garrafa', plural: 'Golfinhos', sci: 'Tursiops truncatus',
    region: 'Oceanos do mundo', continent: 'mar', biome: 'oceano', diet: 'Piscívora', food: 'fish',
    status: 'LC', price: 18000, cp: 30, popularity: 10, space: 24, group: [2, 6], fence: 3, aquaticGroup: 'marinho',
    waterOnly: 'salt', tank: true, noThirst: true, marine: true, swims: true, jumper: true, nocturnal: false, sleepy: 0.6, dimorph: 1.08,
    size: 1.25, speed: 1.1, gestation: 6, maturity: 9, litter: [1, 1], temp: [10, 30], unlock: 'research',
    look: { type: 'fish', kind: 'dolphin', body: '#7f8c96', light: '#dfe4e8', dark: '#55626c', beak: 4 },
    fact: 'Cada golfinho tem um assobio-assinatura que funciona como um nome.',
  });
  add({
    id: 'tubarao', name: 'Tubarão-lixa', plural: 'Tubarões-lixa', sci: 'Ginglymostoma cirratum',
    region: 'Atlântico tropical (inclusive o Brasil)', continent: 'mar', biome: 'recife', diet: 'Carnívora', food: 'fish',
    status: 'VU', price: 7000, cp: 10, popularity: 9, space: 14, group: [1, 4], fence: 3, aquaticGroup: 'marinho',
    waterOnly: 'salt', tank: true, noThirst: true, marine: true, swims: true, predator: true, nocturnal: true, sleepy: 1.4,
    size: 1.2, speed: 0.6, gestation: 6, maturity: 9, litter: [1, 3], temp: [20, 30], unlock: 'research',
    look: { type: 'fish', kind: 'shark', body: '#7a7660', light: '#b8b498', dark: '#4e4a38' },
    fact: 'Passa o dia descansando no fundo e caça à noite, sugando presas das tocas.',
  });
  add({
    id: 'ursopolar', name: 'Urso-polar', plural: 'Ursos-polares', sci: 'Ursus maritimus',
    region: 'Ártico', continent: 'mar', biome: 'polar', diet: 'Carnívora', food: 'fish',
    status: 'VU', price: 20000, cp: 40, popularity: 10, space: 22, group: [1, 3], fence: 3, aquaticGroup: 'marinho',
    swims: true, wades: true, noThirst: true, marine: true, cold: true, nocturnal: false, sleepy: 1.3, predator: true, dimorph: 1.2,
    size: 1.35, speed: 0.85, gestation: 6, maturity: 10, litter: [1, 2], temp: [-30, 10], unlock: 'research',
    look: { type: 'quad', body: '#f1efe6', light: '#ffffff', dark: '#b8b4a6', L: 24, H: 13, leg: 6.5, neck: 3, head: 4.8, snout: 3.5, ears: 'round', tail: 'stub' },
    fact: 'Sua pele é preta e os pelos são transparentes e ocos: parecem brancos ao refletir a luz.',
  });

  ZM.SPECIES = S;
  ZM.SPECIES_ORDER = ['capivara', 'flamingo', 'zebra', 'girafa', 'leao', 'anta', 'tamandua', 'jacare', 'arara', 'loboguara', 'onca', 'mico', 'chimpanze', 'hipopotamo', 'elefante',
    'ema', 'tatucanastra', 'tucano', 'quati', 'vinagre', 'preguica', 'avestruz', 'canguru', 'suricato', 'rinoceronte', 'tigre', 'ursopardo', 'lobo', 'sucuarana', 'gorila',
    'ariranha', 'peixeboi', 'boto', 'pinguim', 'leaomarinho', 'tartaruga', 'golfinho', 'tubarao', 'ursopolar'];
  ZM.isAquatic = (sp) => !!sp.aquaticGroup;
})(window.ZM);
