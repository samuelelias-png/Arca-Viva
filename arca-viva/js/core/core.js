/* =========================================================
   Arca Viva — núcleo: namespace, configuração, utilidades
   ========================================================= */
window.ZM = window.ZM || {};
(function (ZM) {
  'use strict';

  ZM.VERSION = '0.2.0';

  ZM.CONFIG = {
    MAP_W: 56,
    MAP_H: 56,
    HW: 32,              // meia largura do losango isométrico (px)
    HH: 16,              // meia altura do losango isométrico (px)
    MIN_PER_SEC: 8,      // minutos de jogo por segundo real em 1x
    OPEN_HOUR: 8,
    LAST_ENTRY_HOUR: 18,
    CLOSE_HOUR: 20,
    SIM_STEP: 0.1,       // passo fixo de simulação (segundos escalados)
    MAX_VISITORS: 350,
    PATH_BUDGET: 60,     // buscas A* por passo de simulação
    AUTOSAVE_REAL_SEC: 180,
  };

  let _uid = 1;
  const U = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    rand: (a, b) => a + Math.random() * (b - a),
    randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    chance: (p) => Math.random() < p,
    dist: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
    uid: () => _uid++,
    setUid: (v) => { _uid = Math.max(_uid, v); },
    getUid: () => _uid,
    money(v) {
      if (!isFinite(v)) return '∞';
      return (v < 0 ? '-' : '') + 'R$ ' + Math.abs(Math.round(v)).toLocaleString('pt-BR');
    },
    pct: (v) => Math.round(v) + '%',
    hash(x, y, s) {
      let h = (x * 374761393 + y * 668265263 + (s || 0) * 982451653) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      h = h ^ (h >>> 16);
      return (h >>> 0) / 4294967295;
    },
    /* texto sem acentos e minúsculo (busca) */
    norm(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); },
    esc(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    shade(hex, amt) {
      // escurece (amt<0) ou clareia (amt>0) uma cor hex
      let c = hex.replace('#', '');
      if (c.length === 3) c = c.split('').map((x) => x + x).join('');
      const n = parseInt(c, 16);
      let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      const f = (v) => U.clamp(Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt), 0, 255);
      r = f(r); g = f(g); b = f(b);
      return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    },
    timeStr(min) {
      const h = Math.floor(min / 60) % 24, m = Math.floor(min % 60);
      return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    },
  };
  ZM.util = U;

  /* Barramento de eventos simples (desacopla simulação e UI) */
  ZM.Events = {
    _h: {},
    on(e, f) { (this._h[e] = this._h[e] || []).push(f); },
    off(e, f) { this._h[e] = (this._h[e] || []).filter((x) => x !== f); },
    emit(e, d) { (this._h[e] || []).forEach((f) => f(d)); },
  };

  /* Confirmação dentro da página (confirm() nativo pode estar bloqueado) */
  ZM.ask = function (msg, onYes) {
    const box = document.createElement('div');
    box.className = 'ask';
    box.innerHTML = '<div class="ask-card"><p></p><div class="btns"><button class="btn danger" data-y>Confirmar</button><button class="btn" data-n>Cancelar</button></div></div>';
    box.querySelector('p').textContent = msg;
    document.body.appendChild(box);
    box.querySelector('[data-y]').addEventListener('click', () => { box.remove(); onYes(); });
    box.querySelector('[data-n]').addEventListener('click', () => box.remove());
  };

  /* Tipos de terreno */
  ZM.T = { GRASS: 0, DIRT: 1, SAND: 2, FOREST: 3, ROCK: 4, WATER: 5, SNOW: 6, SALT: 7 };
  ZM.isWater = (t) => t === 5 || t === 7;
  ZM.TERRAIN = [
    { id: 0, key: 'grass',  name: 'Grama',   icon: '🌱', color: '#7cb950', dark: '#5f9a3c', cost: 4 },
    { id: 1, key: 'dirt',   name: 'Terra',   icon: '🟫', color: '#b08a5a', dark: '#8e6d43', cost: 4 },
    { id: 2, key: 'sand',   name: 'Areia',   icon: '🏖️', color: '#e3cf91', dark: '#c9b16f', cost: 6 },
    { id: 3, key: 'forest', name: 'Chão de floresta', icon: '🍂', color: '#4f7f39', dark: '#3c652a', cost: 8 },
    { id: 4, key: 'rock',   name: 'Pedra',   icon: '🪨', color: '#9a9a92', dark: '#7c7c74', cost: 10 },
    { id: 5, key: 'water',  name: 'Água doce', icon: '💧', color: '#3f9bd0', dark: '#2f7fb0', cost: 25 },
    { id: 6, key: 'snow',   name: 'Neve e gelo', icon: '❄️', color: '#eef4f7', dark: '#cfdde4', cost: 18, research: 'polar1' },
    { id: 7, key: 'salt',   name: 'Água salgada', icon: '🌊', color: '#1f7f97', dark: '#16677c', cost: 35, research: 'aqua2' },
  ];
  ZM.HAB_KEYS = ['grass', 'dirt', 'sand', 'forest', 'rock', 'water', 'salt', 'snow'];

  ZM.STATUS = {
    LC: { name: 'Pouco preocupante', short: 'LC', color: '#4caf50', cp: 1 },
    NT: { name: 'Quase ameaçada', short: 'NT', color: '#9ccc65', cp: 2 },
    VU: { name: 'Vulnerável', short: 'VU', color: '#ffb300', cp: 4 },
    EN: { name: 'Ameaçada', short: 'EN', color: '#ff7043', cp: 8 },
    CR: { name: 'Criticamente ameaçada', short: 'CR', color: '#e53935', cp: 16 },
  };

  ZM.NAMES = {
    animalM: ['Bento', 'Tião', 'Juca', 'Caio', 'Dante', 'Faísca', 'Zeca', 'Biju', 'Rudá', 'Tupã', 'Pipoca', 'Nino', 'Otto', 'Bóris', 'Chico', 'Guará', 'Jabuti', 'Iberê', 'Kauê', 'Simba', 'Tom', 'Raí', 'Lino', 'Davi', 'Moacir', 'Paçoca'],
    animalF: ['Jurema', 'Iara', 'Luna', 'Maya', 'Flora', 'Mel', 'Jade', 'Cacau', 'Aurora', 'Tainá', 'Bela', 'Pérola', 'Nina', 'Lia', 'Cora', 'Jaci', 'Maré', 'Ceci', 'Duda', 'Kiara', 'Pitanga', 'Moana', 'Brisa', 'Graúna'],
    people: ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabi', 'Heitor', 'Isa', 'João', 'Kátia', 'Lucas', 'Marta', 'Nuno', 'Olga', 'Paulo', 'Rita', 'Sérgio', 'Tati', 'Vítor', 'Yara', 'Zé', 'Bia', 'Caio', 'Duda', 'Edu', 'Léo', 'Malu', 'Rafa', 'Teo'],
    surnames: ['Silva', 'Souza', 'Oliveira', 'Santos', 'Lima', 'Costa', 'Ferreira', 'Almeida', 'Rocha', 'Barbosa', 'Ribeiro', 'Gomes', 'Martins', 'Araújo', 'Melo'],
  };
})(window.ZM);
