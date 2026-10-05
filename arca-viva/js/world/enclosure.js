/* =========================================================
   Recinto: área retangular cercada com portão automático
   ========================================================= */
(function (ZM) {
  'use strict';
  const U = ZM.util;

  class Enclosure {
    constructor(id, x0, y0, x1, y1, fence) {
      this.id = id;
      this.x0 = x0; this.y0 = y0; this.x1 = x1; this.y1 = y1;
      this.fence = fence;
      this.name = 'Recinto ' + id;
      this.condition = 100;     // estado da cerca
      this.cleanliness = 100;   // higiene
      this.gate = null;         // { inIdx, outIdx }
      this.stats = { area: 0, plants: 0, feeders: 0, troughs: 0, water: 0 };
      this.dirty = true;
      this.reserved = {};       // tarefa -> id do funcionário
      this.visitorsNear = 0;
      this.waterQuality = 100; // qualidade da água (tanques e lagos)
    }
    get w() { return this.x1 - this.x0 + 1; }
    get h() { return this.y1 - this.y0 + 1; }
    get area() { return this.w * this.h; }
    contains(x, y) { return x >= this.x0 && x <= this.x1 && y >= this.y0 && y <= this.y1; }
    perimeter() { return 2 * (this.w + this.h); }
    center() { return [(this.x0 + this.x1 + 1) / 2, (this.y0 + this.y1 + 1) / 2]; }

    *tiles() { for (let y = this.y0; y <= this.y1; y++) for (let x = this.x0; x <= this.x1; x++) yield [x, y]; }

    /* Recalcula composição do habitat, itens e pontos de observação */
    computeStats(zoo) {
      const m = zoo.map;
      const counts = { grass: 0, dirt: 0, sand: 0, forest: 0, rock: 0, water: 0, snow: 0, salt: 0 };
      const freshTiles = [], saltTiles = [], filters = [], icemakers = [];
      let foliage = 0, plants = 0, rocks = 0, shade = 0;
      const feeders = [], troughs = [], shelters = [], toys = [], shadeTiles = [], waterTiles = [], rockTiles = [], climb = [];
      let enrich = 0;
      for (const [x, y] of this.tiles()) {
        const i = m.idx(x, y);
        const t = ZM.TERRAIN[m.terrain[i]].key;
        counts[t]++;
        if (t === 'water') { waterTiles.push(i); freshTiles.push(i); }
        if (t === 'salt') { waterTiles.push(i); saltTiles.push(i); }
        if (t === 'rock') rockTiles.push(i);
        const oid = m.obj[i];
        if (oid >= 0) {
          const o = zoo.objects.get(oid);
          if (!o) continue;
          const d = ZM.OBJECTS[o.type];
          if (d.foliage) { foliage += d.foliage; plants++; }
          if (d.rock) { rocks++; rockTiles.push(i); }
          if (d.shade) { shade++; shadeTiles.push(i); }
          if (d.kind === 'feeder') feeders.push(o.id);
          if (d.kind === 'trough') troughs.push(o.id);
          if (d.kind === 'shelter') { shelters.push(o.id); shadeTiles.push(i); }
          if (d.kind === 'toy') { toys.push(o.id); enrich += d.enrich || 1; if (d.climb) climb.push(o.id); }
          if (d.kind === 'filter') filters.push(o.id);
          if (d.kind === 'icemaker') icemakers.push(o.id);
        }
      }
      const area = this.area;
      const mix = {};
      ZM.HAB_KEYS.forEach((k) => (mix[k] = counts[k] / area));
      // pontos de observação: caminhos encostados no recinto
      const views = [];
      // só conta caminhos ligados à entrada (visitantes conseguem chegar)
      const addView = (x, y) => { if (m.inb(x, y)) { const i = m.idx(x, y); if (m.path[i] && (!zoo.connected || zoo.connected[i]) && !views.includes(i)) views.push(i); } };
      let isolatedViews = 0;
      if (zoo.connected) { const chk = (x, y) => { if (m.inb(x, y)) { const i = m.idx(x, y); if (m.path[i] && !zoo.connected[i]) isolatedViews++; } }; for (let x = this.x0; x <= this.x1; x++) { chk(x, this.y0 - 1); chk(x, this.y1 + 1); } for (let y = this.y0; y <= this.y1; y++) { chk(this.x0 - 1, y); chk(this.x1 + 1, y); } }
      for (let x = this.x0; x <= this.x1; x++) { addView(x, this.y0 - 1); addView(x, this.y1 + 1); }
      for (let y = this.y0; y <= this.y1; y++) { addView(this.x0 - 1, y); addView(this.x1 + 1, y); }

      // visor subaquático encostado no recinto
      let viewer = false;
      zoo.objectsOfKind('aquaview').forEach((o) => {
        const nx = U.clamp(o.x, this.x0 - 1, this.x1 + 1), ny = U.clamp(o.y, this.y0 - 1, this.y1 + 1);
        if (Math.abs(nx - o.x) + Math.abs(ny - o.y) <= 1 || (o.x + o.w >= this.x0 - 1 && o.x <= this.x1 + 1 && o.y + o.h >= this.y0 - 1 && o.y <= this.y1 + 1)) viewer = true;
      });
      this.stats = {
        area, mix, counts, foliage: foliage / area, plants, rocks, shade,
        water: counts.water + counts.salt, fresh: counts.water, salt: counts.salt, snow: counts.snow,
        waterTiles, freshTiles, saltTiles, shadeTiles, rockTiles,
        feeders, troughs, shelters, toys, enrich, climb, filters, icemakers, viewer,
        views, isolatedViews,
      };
      this.findGate(zoo);
      this.dirty = false;
    }

    findGate(zoo) {
      const m = zoo.map;
      const cand = [];
      const test = (ix, iy, ox, oy) => {
        if (!m.inb(ox, oy)) return;
        const o = m.idx(ox, oy);
        if (m.path[o]) cand.push({ inIdx: m.idx(ix, iy), outIdx: o });
      };
      for (let x = this.x0; x <= this.x1; x++) { test(x, this.y0, x, this.y0 - 1); test(x, this.y1, x, this.y1 + 1); }
      for (let y = this.y0; y <= this.y1; y++) { test(this.x0, y, this.x0 - 1, y); test(this.x1, y, this.x1 + 1, y); }
      if (!cand.length) { this.gate = null; return; }
      // prefere: alcançável pela equipe > ligado à entrada > o atual > o meio de um lado
      const [cx, cy] = this.center();
      const score = (c) => {
        const [ax, ay] = m.xy(c.inIdx);
        let s = -Math.hypot(ax - cx, ay - cy);
        if (zoo.staffReach && zoo.staffReach[c.outIdx]) s += 1000;
        if (zoo.connected && zoo.connected[c.outIdx]) s += 300;
        if (this.gate && c.inIdx === this.gate.inIdx && c.outIdx === this.gate.outIdx) s += 50;
        return s;
      };
      cand.sort((a, b) => score(b) - score(a));
      this.gate = cand[0];
      this.gateReachable = !zoo.staffReach || !!zoo.staffReach[this.gate.outIdx];
    }

    /* Pontuação de habitat 0..100 para uma espécie */
    habitatScore(sp) {
      const s = this.stats;
      if (!s.mix) return 50;
      const b = sp.biomeData;
      let d = 0;
      ZM.HAB_KEYS.forEach((k) => (d += Math.abs((s.mix[k] || 0) - (b.mix[k] || 0))));
      const terrain = 1 - d / 2;
      const fi = b.foliage;
      const fol = 1 - Math.min(1, Math.abs(s.foliage - fi) / Math.max(fi, 0.12));
      let score = 0.65 * terrain + 0.35 * fol;
      if ((b.mix.water || 0) >= 0.2 && s.fresh === 0) score -= 0.15;
      if ((b.mix.salt || 0) >= 0.2 && s.salt === 0) score -= 0.3;
      if (sp.waterOnly && (sp.waterOnly === 'salt' ? s.salt : s.fresh) === 0) score = 0;
      if (sp.tank && !ZM.FENCES[this.fence].watertight) score -= 0.3;
      if (sp.cold && !s.icemakers.length && !s.snow) score -= 0.3;
      if (sp.climber && s.climb.length === 0 && s.plants < 3) score -= 0.08;
      return U.clamp(Math.round(score * 100), 0, 100);
    }

    speciesIn(zoo) {
      const set = {};
      zoo.animals.forEach((a) => { if (a.encId === this.id && !a.escaped) set[a.species] = (set[a.species] || 0) + 1; });
      return set;
    }
    animalsIn(zoo) { return zoo.animals.filter((a) => a.encId === this.id && !a.escaped); }

    /* Lista de bordas da cerca (para renderização): [x, y, lado] lado: 0=N(y0) 1=S 2=W 3=E */
    edges() {
      const e = [];
      for (let x = this.x0; x <= this.x1; x++) { e.push([x, this.y0, 0]); e.push([x, this.y1, 1]); }
      for (let y = this.y0; y <= this.y1; y++) { e.push([this.x0, y, 2]); e.push([this.x1, y, 3]); }
      return e;
    }

    toJSON() {
      return { id: this.id, x0: this.x0, y0: this.y0, x1: this.x1, y1: this.y1, fence: this.fence, name: this.name, condition: this.condition, cleanliness: this.cleanliness, waterQuality: this.waterQuality, prefab: this.prefab || null };
    }
    static fromJSON(d) {
      const e = new Enclosure(d.id, d.x0, d.y0, d.x1, d.y1, d.fence);
      e.name = d.name; e.condition = d.condition; e.cleanliness = d.cleanliness; e.waterQuality = d.waterQuality != null ? d.waterQuality : 100; e.prefab = d.prefab || null;
      return e;
    }
  }

  ZM.Enclosure = Enclosure;
})(window.ZM);
