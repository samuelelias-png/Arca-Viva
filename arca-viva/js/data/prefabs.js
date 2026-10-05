/* =========================================================
   Habitats prontos (prefabricados) para animais aquáticos e
   marinhos: colocados de uma vez, como um prédio, já com
   terreno, água, parede de aquário, filtros e comedouros.
   terrain(dx, dy, w, h) -> id do terreno de cada tile
   items: [tipo, dx, dy]
   ========================================================= */
(function (ZM) {
  'use strict';
  const T = ZM.T;

  ZM.PREFABS = {
    pf_rio: {
      id: 'pf_rio', name: 'Tanque Amazônico', icon: '🏞️', w: 10, h: 8, cost: 26000, research: 'aqua1', fence: 'glass',
      species: ['boto', 'peixeboi', 'ariranha'], rim: '#8a7a5a',
      desc: 'Rio de água doce com margem de floresta. Para boto-cor-de-rosa, peixe-boi e ariranha.',
      terrain: (dx, dy, w, h) => (dx >= w - 3 ? (dy < 3 ? T.FOREST : T.DIRT) : T.WATER),
      items: [['aquafeeder', 2, 2], ['aquafeeder', 4, 5], ['floattoy', 5, 2], ['filter', 9, 7], ['filter', 8, 7], ['feeder', 7, 5], ['palm', 8, 0], ['bigtree', 9, 1], ['bush', 7, 1], ['logs', 9, 4], ['tallgrass', 7, 3]],
    },
    pf_costa: {
      id: 'pf_costa', name: 'Costão Rochoso', icon: '🪨', w: 9, h: 8, cost: 18000, research: 'aqua2', fence: 'glass',
      species: ['pinguim', 'leaomarinho'], rim: '#7c8a90',
      desc: 'Mar gelado, praia e rochedos. Para pinguins-de-magalhães e leões-marinhos.',
      terrain: (dx, dy, w, h) => (dx < 4 ? T.SALT : dx < 7 ? T.SAND : T.ROCK),
      items: [['aquafeeder', 1, 3], ['floattoy', 2, 5], ['filter', 8, 7], ['filter', 8, 6], ['feeder', 5, 2], ['rock', 7, 1], ['rock', 7, 4], ['rock', 5, 6], ['shelter', 8, 0]],
    },
    pf_recife: {
      id: 'pf_recife', name: 'Aquário de Recife', icon: '🐠', w: 9, h: 9, cost: 22000, research: 'aqua2', fence: 'glass',
      species: ['tartaruga', 'tubarao'], rim: '#5c8fa0',
      desc: 'Recife de coral com praia de desova. Para tartarugas-verdes e tubarões-lixa.',
      terrain: (dx, dy, w, h) => (dy >= h - 2 ? T.SAND : T.SALT),
      items: [['aquafeeder', 2, 2], ['aquafeeder', 6, 4], ['floattoy', 4, 5], ['filter', 0, 8], ['filter', 1, 8], ['filter', 8, 8], ['rock', 4, 7], ['palm', 6, 8], ['flowers', 3, 8]],
    },
    pf_oceano: {
      id: 'pf_oceano', name: 'Oceanário', icon: '🐬', w: 12, h: 10, cost: 38000, research: 'aqua3', fence: 'glass',
      species: ['golfinho'], rim: '#4f7f98',
      desc: 'Grande tanque de água salgada com deque de tratadores. Para golfinhos.',
      terrain: (dx, dy, w, h) => (dy === h - 1 ? T.ROCK : T.SALT),
      items: [['aquafeeder', 3, 3], ['aquafeeder', 8, 5], ['floattoy', 5, 2], ['floattoy', 9, 7], ['filter', 1, 9], ['filter', 4, 9], ['filter', 7, 9], ['filter', 10, 9]],
    },
    pf_polar: {
      id: 'pf_polar', name: 'Domo Polar', icon: '🧊', w: 10, h: 9, cost: 34000, research: 'polar1', fence: 'glass',
      species: ['ursopolar', 'pinguim'], rim: '#a8c4d0',
      desc: 'Neve, gelo e mar gelado com máquina de gelo. Para urso-polar (e pinguins).',
      terrain: (dx, dy, w, h) => (dx >= 5 ? T.SALT : dx === 4 && dy % 3 === 0 ? T.ROCK : T.SNOW),
      items: [['icemaker', 1, 1], ['icemaker', 1, 7], ['aquafeeder', 7, 4], ['filter', 3, 8], ['filter', 4, 1], ['feeder', 2, 4], ['rock', 3, 2], ['shelter', 0, 4]],
    },
  };
  ZM.PREFAB_ORDER = ['pf_rio', 'pf_costa', 'pf_recife', 'pf_oceano', 'pf_polar'];
  /* habitat pronto que aceita uma espécie */
  ZM.prefabsFor = (spId) => ZM.PREFAB_ORDER.filter((k) => ZM.PREFABS[k].species.includes(spId));
})(window.ZM);
