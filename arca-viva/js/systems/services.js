/* =========================================================
   Serviços aos visitantes (extraído de zoo.js): rotas próximas,
   lojas/banheiros com capacidade e fila, lixo e placas.
   ========================================================= */
(function (ZM) {
  'use strict';
  const U = ZM.util;
  Object.assign(ZM.Zoo.prototype, {
    randomPathNear(x, y, r) {
      const m = this.map;
      for (let k = 0; k < 14; k++) {
        const tx = x + U.randInt(-r, r), ty = y + U.randInt(-r, r);
        if (m.inb(tx, ty) && m.path[m.idx(tx, ty)]) return m.idx(tx, ty);
      }
      return this.pathTiles.length ? U.pick(this.pathTiles) : null;
    },
    adjacentWalkable(o) {
      const m = this.map, out = [], paths = [];
      const test = (x, y) => {
        if (!m.inb(x, y)) return;
        const i = m.idx(x, y);
        if (m.enc[i] || ZM.isWater(m.terrain[i])) return;
        const ob = m.obj[i]; if (ob >= 0 && this.objects.get(ob)?.blocks) return;
        (m.path[i] ? paths : out).push(i);
      };
      for (let x = o.x; x < o.x + o.w; x++) { test(x, o.y - 1); test(x, o.y + o.h); }
      for (let y = o.y; y < o.y + o.h; y++) { test(o.x - 1, y); test(o.x + o.w, y); }
      return paths.concat(out);
    },
    fenceOutside(e) {
      const m = this.map;
      const opts = [];
      for (let x = e.x0; x <= e.x1; x++) { opts.push([x, e.y0 - 1]); opts.push([x, e.y1 + 1]); }
      for (let y = e.y0; y <= e.y1; y++) { opts.push([e.x0 - 1, y]); opts.push([e.x1 + 1, y]); }
      for (const [x, y] of opts) {
        if (!m.inb(x, y)) continue;
        const i = m.idx(x, y);
        if (!m.enc[i] && !ZM.isWater(m.terrain[i]) && !(m.obj[i] >= 0 && this.objects.get(m.obj[i])?.blocks)) return i;
      }
      return -1;
    },

    /* =================== serviços aos visitantes =================== */
    findService(v, pred) {
      let best = null, bd = 1e9;
      this.objects.forEach((o) => {
        const d = o.def;
        if (!o.access.length || o.broken || !pred(d)) return;
        if ((o._unreach || 0) > 6) return;
        if (v.avoid && v.avoid.id === o.id && v.avoid.until > this.absMinutes) return;
        const dist = Math.abs(o.x - v.x) + Math.abs(o.y - v.y) + Math.random() * 4;
        if (dist < bd) { bd = dist; best = o; }
      });
      return best;
    },
    /* capacidade de atendimento simultâneo e filas */
    serviceSlots(o) { return o.def.slots || (o.def.kind === 'toilet' ? 3 : o.def.w > 1 ? 4 : 2); },
    serviceCount(o) { let n = 0; for (const v of this.visitors) if (v.svcObj === o.id && v.actT > 0 && (v.state === 'SHOP' || v.state === 'TOILET')) n++; return n; },
    queueOf(o) { return this.visitors.filter((v) => v.state === 'QUEUE' && v.svcObj === o.id && !v.gone).sort((a, b) => a.queuedAt - b.queuedAt); },
    lostSale(o, reason) {
      if (!o) return;
      o.gaveUp = (o.gaveUp || 0) + 1; o.gaveUpToday = (o.gaveUpToday || 0) + 1;
      o.lostReasons = o.lostReasons || {}; o.lostReasons[reason] = (o.lostReasons[reason] || 0) + 1;
    },
    disposeTrash(v) {
      const bins = this.objectsOfKind('bin');
      for (const b of bins) {
        if (b.fill >= b.def.capacity) continue;
        if (Math.abs(b.x + 0.5 - v.x) + Math.abs(b.y + 0.5 - v.y) <= 4.5) { b.fill++; return true; }
      }
      return false;
    },
    signNear(x, y, readSet) {
      const m = this.map;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const o = this.objAt(x + dx, y + dy);
        if (!o || o.def.kind !== 'sign' || readSet.has(o.id)) continue;
        // espécie do recinto mais próximo (raio 5)
        let best = null, bd = 6;
        this.enclosures.forEach((e) => {
          if (!e.animalCount) return;
          const cx = U.clamp(o.x, e.x0, e.x1), cy = U.clamp(o.y, e.y0, e.y1);
          const d = Math.abs(cx - o.x) + Math.abs(cy - o.y);
          if (d < bd) { bd = d; best = e; }
        });
        if (!best) continue;
        const sp = Object.keys(best.speciesIn(this))[0];
        o.species = sp;
        return o;
      }
      return null;
    },
    decorAt(x, y) { return this.map.inb(x, y) ? this.decorMap[this.map.idx(x, y)] : 0; },
    addEducation(p) { this.stats.eduToday += p * this.mods.education; },
  });
})(window.ZM);
