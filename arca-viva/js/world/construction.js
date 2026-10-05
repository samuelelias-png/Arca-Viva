/* =========================================================
   Construção (extraído de zoo.js): objetos, caminhos, terreno,
   recintos e habitats prontos — com custo, reembolso e desfazer.
   ========================================================= */
(function (ZM) {
  'use strict';
  Object.assign(ZM.Zoo.prototype, {
    canPlaceObject(type, x, y) {
      const d = ZM.OBJECTS[type], m = this.map;
      if (!d) return { ok: false, reason: 'Objeto inválido' };
      if (!this.isObjectUnlocked(type)) return { ok: false, reason: 'Bloqueado — requer pesquisa' };
      if (d.unique && this.countObjects(type) > 0) return { ok: false, reason: 'Só pode haver uma ' + d.name };
      let encId = null;
      for (let yy = y; yy < y + d.h; yy++) for (let xx = x; xx < x + d.w; xx++) {
        if (!m.inb(xx, yy)) return { ok: false, reason: 'Fora do mapa' };
        const i = m.idx(xx, yy);
        if (m.obj[i] >= 0) return { ok: false, reason: 'Espaço ocupado' };
        if (m.path[i]) return { ok: false, reason: 'Há um caminho aqui' };
        if (d.onWater && !ZM.isWater(m.terrain[i])) return { ok: false, reason: 'Deve ficar sobre a água' };
        if (!d.onWater && ZM.isWater(m.terrain[i])) return { ok: false, reason: 'Não é possível construir na água' };
        const e = m.enc[i];
        if (encId === null) encId = e; else if (encId !== e) return { ok: false, reason: 'Cruza a cerca de um recinto' };
        if (d.inEnc === true && !e) return { ok: false, reason: 'Deve ficar dentro de um recinto' };
        if (d.inEnc === false && e) return { ok: false, reason: 'Não pode ficar dentro de um recinto' };
      }
      if (d.inEnc === false && d.blocks) {
        // não bloquear portões de recintos
        for (const e of this.enclosures.values()) if (e.gate) { const [gx, gy] = m.xy(e.gate.outIdx); if (gx >= x && gx < x + d.w && gy >= y && gy < y + d.h) return { ok: false, reason: 'Bloquearia o portão de um recinto' }; }
      }
      if (!this.sandbox && this.money < d.cost) return { ok: false, reason: 'Dinheiro insuficiente' };
      return { ok: true, cost: d.cost };
    },
    placeObject(type, x, y, opt = {}) {
      if (!opt.free) {
        const c = this.canPlaceObject(type, x, y);
        if (!c.ok) return c;
      }
      const d = ZM.OBJECTS[type];
      if (!opt.free && !this.spend(d.cost, 'construcao')) return { ok: false, reason: 'Dinheiro insuficiente' };
      const o = opt.restore || new ZM.ZooObject(type, x, y);
      for (const [xx, yy] of o.tiles()) this.map.obj[this.map.idx(xx, yy)] = o.id;
      this.objects.set(o.id, o);
      this.kindCache = null;
      if (!opt.free) this.undo.push('Construir ' + d.name, () => { this.removeObjectSilent(o.id); this.refund(d.cost, 'construcao'); });
      if (!opt.silent) this.refreshAll();
      return { ok: true, obj: o };
    },
    /* mover sem custo (valida o novo lugar como se fosse construir) */
    canMoveObject(id, x, y) {
      const o = this.objects.get(id); if (!o) return { ok: false, reason: 'Objeto inválido' };
      const tiles = [...o.tiles()].map(([xx, yy]) => this.map.idx(xx, yy));
      tiles.forEach((i) => (this.map.obj[i] = -1)); this.kindCache = null;
      const sb = this.sandbox; this.sandbox = true; // ignora dinheiro
      const uniq = o.def.unique; if (uniq) this.objects.delete(id);
      const c = this.canPlaceObject(o.type, x, y);
      if (uniq) this.objects.set(id, o);
      this.sandbox = sb;
      tiles.forEach((i) => (this.map.obj[i] = id)); this.kindCache = null;
      return c.ok ? { ok: true } : c;
    },
    moveObject(id, x, y) {
      const c = this.canMoveObject(id, x, y);
      if (!c.ok) return c;
      const o = this.objects.get(id), ox = o.x, oy = o.y;
      const doMove = (nx, ny) => {
        for (const [xx, yy] of o.tiles()) this.map.obj[this.map.idx(xx, yy)] = -1;
        o.x = nx; o.y = ny;
        for (const [xx, yy] of o.tiles()) this.map.obj[this.map.idx(xx, yy)] = o.id;
        this.kindCache = null;
      };
      doMove(x, y);
      this.undo.push('Mover ' + o.def.name, () => doMove(ox, oy));
      this.refreshAll();
      return { ok: true, obj: o };
    },
    removeObject(id, refund = true, opt) {
      const o = this.objects.get(id);
      if (!o) return false;
      for (const [xx, yy] of o.tiles()) this.map.obj[this.map.idx(xx, yy)] = -1;
      this.objects.delete(id);
      this.kindCache = null;
      const back = refund && o.def.cost ? Math.round(o.def.cost * 0.4) : 0;
      if (back) this.earn(back, 'reembolso');
      const snap = o.toJSON();
      this.undo.push('Demolir ' + o.def.name, () => {
        const r = ZM.ZooObject.fromJSON(snap);
        if ([...r.tiles()].every(([xx, yy]) => this.map.inb(xx, yy) && this.map.obj[this.map.idx(xx, yy)] < 0)) {
          this.placeObject(r.type, r.x, r.y, { free: true, silent: true, restore: r });
          this.unearn(back, 'reembolso');
        }
      });
      if (!opt || !opt.batch) this.refreshAll();
      return true;
    },
    canPath(x, y) {
      const m = this.map;
      if (!m.inb(x, y)) return false;
      const i = m.idx(x, y);
      return !m.path[i] && !m.enc[i] && !ZM.isWater(m.terrain[i]) && (m.obj[i] < 0 || this.objects.get(m.obj[i]).def.cat === 'nature');
    },
    placePaths(tiles) {
      let n = 0;
      const placed = [], removed = [];
      for (const [x, y] of tiles) {
        if (!this.canPath(x, y)) continue;
        if (!this.spend(ZM.PATH_COST, 'construcao')) break;
        const i = this.map.idx(x, y);
        if (this.map.obj[i] >= 0) { removed.push(this.objects.get(this.map.obj[i]).toJSON()); this.removeObjectSilent(this.map.obj[i]); }
        this.map.path[i] = 1; n++; placed.push(i);
      }
      if (n) {
        this.undo.push(`Construir ${n} caminho(s)`, () => {
          placed.forEach((i) => { this.map.path[i] = 0; this.map.litter[i] = 0; });
          this.map.touchTiles(placed);
          removed.forEach((od) => { const r = ZM.ZooObject.fromJSON(od); this.placeObject(r.type, r.x, r.y, { free: true, silent: true, restore: r }); });
          this.refund(n * ZM.PATH_COST, 'construcao');
        });
        this.map.touchTiles(placed); this.refreshAll();
      }
      return n;
    },
    removeObjectSilent(id) {
      const o = this.objects.get(id); if (!o) return;
      for (const [xx, yy] of o.tiles()) this.map.obj[this.map.idx(xx, yy)] = -1;
      this.objects.delete(id); this.kindCache = null;
    },
    removePath(x, y, opt) {
      const m = this.map; if (!m.inb(x, y)) return false;
      const i = m.idx(x, y);
      if (!m.path[i]) return false;
      m.path[i] = 0; m.litter[i] = 0; m.touch(x, y);
      const back = Math.round(ZM.PATH_COST * 0.3);
      this.earn(back, 'reembolso');
      this.undo.push('Remover caminho', () => { if (this.canPath(x, y)) { m.path[i] = 1; m.touch(x, y); this.unearn(back, 'reembolso'); } });
      if (!opt || !opt.batch) this.refreshAll();
      return true;
    },
    paintTerrain(tiles, t) {
      const m = this.map;
      const cost = ZM.TERRAIN[t].cost;
      if (!this.isTerrainUnlocked(t)) return 0;
      let n = 0; const prev = [];
      for (const [x, y] of tiles) {
        if (!m.inb(x, y)) continue;
        const i = m.idx(x, y);
        if (m.terrain[i] === t) continue;
        if (ZM.isWater(t) && (m.path[i] || (m.obj[i] >= 0 && !this.objects.get(m.obj[i]).def.onWater))) continue;
        if (!ZM.isWater(t) && m.obj[i] >= 0 && this.objects.get(m.obj[i]).def.onWater) continue;
        if (!this.spend(cost, 'construcao')) break;
        prev.push([i, m.terrain[i]]);
        m.terrain[i] = t; n++;
      }
      if (n) {
        this.undo.push(`Pintar ${n} tile(s) de ${ZM.TERRAIN[t].name.toLowerCase()}`, () => {
          prev.forEach(([i, old]) => (m.terrain[i] = old));
          m.touchTiles(prev.map((p) => p[0]));
          this.enclosures.forEach((e) => (e.dirty = true));
          this.refund(n * cost, 'construcao');
        });
        m.touchTiles(prev.map((p) => p[0])); this.enclosures.forEach((e) => (e.dirty = true)); this.refreshAll();
      }
      return n;
    },
    canEnclosure(x0, y0, x1, y1, fence, opt = {}) {
      const m = this.map;
      if (x1 - x0 < 2 || y1 - y0 < 2) return { ok: false, reason: 'Tamanho mínimo 3×3' };
      if (!opt.noCost && !this.isFenceUnlocked(fence)) return { ok: false, reason: 'Cerca bloqueada — requer pesquisa' };
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (!m.inb(x, y)) return { ok: false, reason: 'Fora do mapa' };
        const i = m.idx(x, y);
        if (m.enc[i]) return { ok: false, reason: 'Sobrepõe outro recinto' };
        if (m.path[i]) return { ok: false, reason: 'Há caminhos na área' };
        if (m.obj[i] >= 0 && this.objects.get(m.obj[i]).def.cat !== 'nature') return { ok: false, reason: 'Há construções na área' };
      }
      // não encostar diretamente em outro recinto (cercas precisam de espaço)
      const cost = 2 * (x1 - x0 + 1 + y1 - y0 + 1) * ZM.FENCES[fence].cost;
      if (!opt.noCost && !this.sandbox && this.money < cost) return { ok: false, reason: 'Dinheiro insuficiente', cost };
      return { ok: true, cost };
    },
    /* ---------- habitats prontos (aquáticos/marinhos) ---------- */
    isPrefabUnlocked(id) {
      const p = ZM.PREFABS[id];
      return this.scenario.unlockAll || !p.research || this.research.isDone(p.research);
    },
    canPrefab(id, x, y) {
      const p = ZM.PREFABS[id];
      if (!p) return { ok: false, reason: 'Habitat inválido' };
      if (!this.isPrefabUnlocked(id)) return { ok: false, reason: 'Bloqueado — requer pesquisa ' + ZM.RESEARCH[p.research].name };
      const c = this.canEnclosure(x, y, x + p.w - 1, y + p.h - 1, p.fence, { noCost: true });
      if (!c.ok) return c;
      if (!this.sandbox && this.money < p.cost) return { ok: false, reason: 'Dinheiro insuficiente' };
      // precisa encostar num caminho para ter portão
      const m = this.map; let touches = false;
      for (let xx = x; xx < x + p.w; xx++) for (const yy of [y - 1, y + p.h]) if (m.inb(xx, yy) && m.path[m.idx(xx, yy)]) touches = true;
      for (let yy = y; yy < y + p.h; yy++) for (const xx of [x - 1, x + p.w]) if (m.inb(xx, yy) && m.path[m.idx(xx, yy)]) touches = true;
      return { ok: true, cost: p.cost, touches };
    },
    placePrefab(id, x, y) {
      const c = this.canPrefab(id, x, y);
      if (!c.ok) return c;
      const p = ZM.PREFABS[id], m = this.map;
      this.spend(p.cost, 'construcao');
      const r = this.createEnclosure(x, y, x + p.w - 1, y + p.h - 1, p.fence, { free: true });
      if (!r.ok) return r;
      const e = r.enc;
      const prevTerrain = [], prevObjs = [];
      for (const [xx, yy] of e.tiles()) {
        const i = m.idx(xx, yy);
        if (m.obj[i] >= 0) { prevObjs.push(this.objects.get(m.obj[i]).toJSON()); this.removeObjectSilent(m.obj[i]); }
        prevTerrain.push([i, m.terrain[i]]);
        m.terrain[i] = p.terrain(xx - x, yy - y, p.w, p.h);
      }
      this.undo.push('Construir ' + p.name, () => {
        if (e.animalsIn(this).length) { this.alert('Não foi possível desfazer: há animais no habitat.', 'warn'); return; }
        this.clearEnclosure(e);
        prevTerrain.forEach(([i, t]) => (m.terrain[i] = t));
        m.touch(e.x0 - 1, e.y0 - 1, e.x1 + 1, e.y1 + 1);
        prevObjs.forEach((od) => { const o = ZM.ZooObject.fromJSON(od); this.placeObject(o.type, o.x, o.y, { free: true, silent: true, restore: o }); });
        this.refund(p.cost, 'construcao');
      });
      p.items.forEach(([type, dx, dy]) => this.placeObject(type, x + dx, y + dy, { free: true, silent: true }));
      this.objects.forEach((o) => { if (o.def.kind === 'feeder' && m.enc[m.idx(o.x, o.y)] === e.id) o.food = 100; });
      e.prefab = id; e.name = p.name + (this.countPrefab(id) > 1 ? ' ' + this.countPrefab(id) : '');
      m.touch(e.x0 - 1, e.y0 - 1, e.x1 + 1, e.y1 + 1); this.refreshAll();
      return { ok: true, enc: e, touches: c.touches };
    },
    countPrefab(id) { return [...this.enclosures.values()].filter((e) => e.prefab === id).length; },

    createEnclosure(x0, y0, x1, y1, fence, opt = {}) {
      const c = this.canEnclosure(x0, y0, x1, y1, fence, { noCost: opt.free });
      if (!c.ok) return c;
      if (!opt.free) this.spend(c.cost, 'construcao');
      const id = this.nextEncId++;
      const e = new ZM.Enclosure(id, x0, y0, x1, y1, fence);
      for (const [x, y] of e.tiles()) this.map.enc[this.map.idx(x, y)] = id;
      this.enclosures.set(id, e);
      if (!opt.free) this.undo.push('Construir ' + e.name, () => {
        if (e.animalsIn(this).length) { this.alert('Não foi possível desfazer: há animais no recinto.', 'warn'); return; }
        this.clearEnclosure(e); this.map.touch(x0 - 1, y0 - 1, x1 + 1, y1 + 1); this.refund(c.cost, 'construcao');
      });
      this.map.touch(x0 - 1, y0 - 1, x1 + 1, y1 + 1);
      this.refreshAll();
      return { ok: true, enc: e };
    },
    /* remove o recinto e os itens internos (sem dinheiro) e devolve um instantâneo */
    clearEnclosure(e) {
      const items = [];
      for (const [x, y] of e.tiles()) {
        const i = this.map.idx(x, y);
        this.map.enc[i] = 0;
        const oid = this.map.obj[i];
        if (oid >= 0 && this.objects.get(oid)?.def.inEnc) { items.push(this.objects.get(oid).toJSON()); this.removeObjectSilent(oid); }
      }
      this.enclosures.delete(e.id);
      return items;
    },
    removeEnclosure(id) {
      const e = this.enclosures.get(id);
      if (!e) return { ok: false };
      if (e.animalsIn(this).length) return { ok: false, reason: 'Venda ou transfira os animais primeiro.' };
      const snap = e.toJSON();
      const items = this.clearEnclosure(e);
      const back = Math.round(e.prefab ? ZM.PREFABS[e.prefab].cost * 0.35 : e.perimeter() * ZM.FENCES[e.fence].cost * 0.3);
      this.earn(back, 'reembolso');
      this.undo.push('Demolir ' + e.name, () => {
        for (let y = snap.y0; y <= snap.y1; y++) for (let x = snap.x0; x <= snap.x1; x++) if (this.map.enc[this.map.idx(x, y)] || this.map.path[this.map.idx(x, y)]) return;
        const r = ZM.Enclosure.fromJSON(snap);
        for (const [x, y] of r.tiles()) this.map.enc[this.map.idx(x, y)] = r.id;
        this.enclosures.set(r.id, r);
        items.forEach((od) => { const o = ZM.ZooObject.fromJSON(od); if (this.map.obj[this.map.idx(o.x, o.y)] < 0) this.placeObject(o.type, o.x, o.y, { free: true, silent: true, restore: o }); });
        this.map.touch(snap.x0 - 1, snap.y0 - 1, snap.x1 + 1, snap.y1 + 1);
        this.unearn(back, 'reembolso');
      });
      this.map.touch(e.x0 - 1, e.y0 - 1, e.x1 + 1, e.y1 + 1); this.refreshAll();
      return { ok: true };
    },
    upgradeFence(id, fence) {
      const e = this.enclosures.get(id);
      if (!e || e.fence === fence) return { ok: false };
      if (!this.isFenceUnlocked(fence)) return { ok: false, reason: 'Requer pesquisa' };
      const cost = e.perimeter() * ZM.FENCES[fence].cost * 0.8;
      if (!this.spend(cost, 'construcao')) return { ok: false, reason: 'Dinheiro insuficiente' };
      const old = e.fence, oldCond = e.condition;
      e.fence = fence; e.condition = 100;
      this.undo.push('Trocar cerca do ' + e.name, () => { e.fence = old; e.condition = oldCond; this.refund(cost, 'construcao'); });
      return { ok: true };
    },
  });
})(window.ZM);
