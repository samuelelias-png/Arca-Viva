/* =========================================================
   Funcionários: cada papel procura tarefas e as executa
   ========================================================= */
(function (ZM) {
  'use strict';
  const U = ZM.util, T = ZM.T;

  const LABEL = { IDLE: 'Aguardando tarefa', WALK: 'A caminho', WORK: 'Trabalhando', PATROL: 'Patrulhando' };
  const TASK_LABEL = {
    feed: 'Abastecendo comedouro', water: 'Repondo água', clean: 'Limpando recinto', treat: 'Tratando animal', checkup: 'Examinando animal',
    litter: 'Recolhendo lixo', bin: 'Esvaziando lixeira', chase: 'Capturando animal fugitivo', patrol: 'Patrulhando',
    repairFence: 'Consertando cerca', repairObj: 'Consertando equipamento', research: 'Pesquisando',
  };

  /* tipos de tarefa que cada função pode priorizar (0 = desligado, 1 = normal, 2 = alta) */
  const PRIORITY_TYPES = {
    keeper: [['feed', 'Alimentar'], ['water', 'Água'], ['clean', 'Limpeza']],
    vet: [['treat', 'Tratamentos'], ['checkup', 'Exames']],
    janitor: [['litter', 'Lixo no chão'], ['bin', 'Lixeiras']],
    maintenance: [['repairFence', 'Cercas'], ['repairObj', 'Equipamentos']],
    security: [['chase', 'Fugas']],
    researcher: [['research', 'Pesquisa']],
  };

  class Staff extends ZM.Agent {
    constructor(role, x, y, o = {}) {
      super(x, y);
      const r = ZM.STAFF_ROLES[role];
      this.role = role;
      this.name = o.name || U.pick(ZM.NAMES.people) + ' ' + U.pick(ZM.NAMES.surnames);
      this.salary = r.salary;
      this.task = null; this.state = 'IDLE'; this.actT = 0;
      this.speed = 1.5;
      this.assigned = o.assigned || []; // recintos designados (vazio = todos)
      this.idleT = 0; this.tasksDone = o.tasksDone || 0;
      this.tries = 0;
      this.priorities = Object.assign({}, ...(PRIORITY_TYPES[role] || []).map(([k]) => ({ [k]: 1 })), o.priorities || {});
      this.workMin = o.workMin || 0; this.totalMin = o.totalMin || 0; // para a taxa de ocupação
    }
    get busyPct() { return this.totalMin > 30 ? Math.round((this.workMin / this.totalMin) * 100) : null; }
    get def() { return ZM.STAFF_ROLES[this.role]; }
    get label() { return this.task ? (this.state === 'WALK' ? 'Indo: ' : '') + (TASK_LABEL[this.task.type] || this.task.type) : LABEL[this.state] || this.state; }

    canStepFn(zoo, targetEnc) {
      const m = zoo.map;
      return (a, b) => {
        const o = m.obj[b];
        if (o >= 0) { const ob = zoo.objects.get(o); if (ob && ob.blocks) return 0; }
        const ea = m.enc[a], eb = m.enc[b];
        if (ea !== eb) {
          if (eb !== 0) { const e = zoo.enclosures.get(eb); if (!e || eb !== targetEnc || !e.gate || e.gate.outIdx !== a || e.gate.inIdx !== b) return 0; }
          if (ea !== 0) { const e = zoo.enclosures.get(ea); if (!e || !e.gate || e.gate.inIdx !== a || e.gate.outIdx !== b) return 0; }
        }
        if (ZM.isWater(m.terrain[b])) return 5;
        return m.path[b] ? 1 : 1.6;
      };
    }

    update(zoo, dt) {
      const gh = (dt * ZM.CONFIG.MIN_PER_SEC) / 60;
      // ocupação das últimas ~8 horas (média móvel)
      this.totalMin += gh * 60; if (this.task) this.workMin += gh * 60;
      if (this.totalMin > 480) { this.workMin *= 480 / this.totalMin; this.totalMin = 480; }
      if (this.path) {
        if (this.task && this.task.type === 'chase') {
          const a = zoo.animalById(this.task.animalId);
          if (!a || !a.escaped || a.state === 'TRANQ' || a.state === 'RETURN') { this.endTask(zoo); return; }
          if (U.dist(a.x, a.y, this.x, this.y) < 1.4) { this.path = null; this.arrive(zoo); return; }
        }
        if (this.step(dt, zoo.map, this.task && this.task.type === 'chase' ? 1.5 : 1)) this.arrive(zoo);
      } else if (this.actT > 0) {
        this.actT -= gh * 60;
        if (this.task && this.task.type === 'research') zoo.research.addPoints(gh * zoo.researchRate(zoo.objects.get(this.task.objId)));
        if (this.actT <= 0) this.complete(zoo);
      }
      this.thinkT -= dt;
      if (this.thinkT <= 0) {
        this.thinkT = U.rand(0.6, 1.1);
        if (!this.path && this.actT <= 0) this.think(zoo);
      }
    }

    think(zoo) {
      if (this.task) { this.endTask(zoo); }
      const t = this.findTask(zoo);
      if (t) return this.startTask(zoo, t);
      // ocioso: caminha um pouco
      this.state = this.role === 'security' ? 'PATROL' : 'IDLE';
      this.idleT++;
      if (this.idleT % 4 === 0 || this.role === 'security') {
        const p = zoo.randomPathNear(this.tx(), this.ty(), this.role === 'security' ? 14 : 6);
        if (p != null) {
          const path = zoo.requestPath(this.tileIdx(zoo.map), p, this.canStepFn(zoo, 0), 2500);
          if (path) { this.setPath(path); return; }
        }
      }
      this.actT = U.rand(3, 8);
    }

    startTask(zoo, t) {
      const path = zoo.requestPath(this.tileIdx(zoo.map), t.tile, this.canStepFn(zoo, t.encId || 0), 6000);
      if (path === undefined) return;
      if (!path) { zoo.markUnreachable(t.key); zoo.release(t.key, this.id); return; }
      this.task = t; this.idleT = 0; this.tries = 0;
      this.setPath(path); this.state = 'WALK';
      if (!this.path) this.arrive(zoo);
    }

    arrive(zoo) {
      const t = this.task;
      if (!t) { this.state = 'IDLE'; return; }
      if (t.type === 'treat' || t.type === 'checkup' || t.type === 'chase') {
        const a = zoo.animalById(t.animalId);
        if (!a) return this.endTask(zoo);
        if (U.dist(a.x, a.y, this.x, this.y) > 1.7) {
          if (++this.tries > 4) return this.endTask(zoo);
          const path = zoo.requestPath(this.tileIdx(zoo.map), a.tileIdx(zoo.map), this.canStepFn(zoo, t.encId || 0), 6000);
          if (path) { this.setPath(path); return; }
          return this.endTask(zoo);
        }
        if (t.type === 'chase') {
          a.tranquilize();
          zoo.alert('💉 ' + a.name + ' foi tranquilizado(a) pela segurança e será levado(a) de volta.', 'info', a);
          this.tasksDone++;
          return this.endTask(zoo);
        }
        a.path = null; a.actT = Math.max(a.actT, t.dur); a.state = 'REST';
      }
      this.state = 'WORK';
      const md = zoo.mods;
      let f = md.workSpeed;
      if (t.type === 'repairFence' || t.type === 'repairObj') f *= md.repairSpeed;
      if (t.type === 'feed' || t.type === 'water' || t.type === 'clean') f *= md.feedSpeed;
      this.actT = t.type === 'research' ? t.dur : t.dur / f;
    }

    complete(zoo) {
      const t = this.task;
      if (!t) return;
      const m = zoo.mods;
      switch (t.type) {
        case 'feed': {
          const o = zoo.objects.get(t.objId); const enc = zoo.enclosures.get(t.encId);
          if (o && enc) {
            const food = o.wantType || zoo.encFoodType(enc);
            // trocar o tipo de comida descarta o que sobrou
            const fill = o.foodType === food ? (100 - o.food) / 100 : 1;
            const cost = ZM.FOOD[food].cost * m.foodCost * fill;
            zoo.spend(cost, 'alimentacao', true);
            o.food = 100; o.foodType = food;
          }
          break;
        }
        case 'water': { const o = zoo.objects.get(t.objId); if (o) { o.water = 100; zoo.spend(6, 'agua', true); } break; }
        case 'clean': { const enc = zoo.enclosures.get(t.encId); if (enc) enc.cleanliness = Math.min(100, enc.cleanliness + 60); break; }
        case 'treat': {
          const a = zoo.animalById(t.animalId);
          if (a) {
            if (a.sick) zoo.alert(`✅ ${a.name} (${a.sp.name}) foi curado(a).`, 'good', a);
            a.sick = false; a.disease = null; a.health = Math.min(100, a.health + 30 * m.healAmount); a.checkedDay = zoo.day;
            zoo.spend(120, 'veterinario', true);
          }
          break;
        }
        case 'checkup': { const a = zoo.animalById(t.animalId); if (a) { a.checkedDay = zoo.day; a.health = Math.min(100, a.health + 5); } break; }
        case 'litter': zoo.map.litter[t.tile] = 0; break;
        case 'bin': { const o = zoo.objects.get(t.objId); if (o) o.fill = 0; break; }
        case 'repairFence': {
          const enc = zoo.enclosures.get(t.fenceEnc);
          if (enc) { zoo.spend(enc.perimeter() * ZM.FENCES[enc.fence].cost * 0.08, 'manutencao', true); enc.condition = 100; }
          break;
        }
        case 'repairObj': { const o = zoo.objects.get(t.objId); if (o) { o.condition = 100; o.broken = false; zoo.spend(o.def.cost * 0.05, 'manutencao', true); } break; }
        case 'research': break;
      }
      this.tasksDone++;
      this.endTask(zoo);
    }

    endTask(zoo) {
      if (this.task) zoo.release(this.task.key, this.id);
      this.task = null; this.state = 'IDLE'; this.actT = 0; this.path = null;
    }

    /* ---------- busca de tarefas por papel ---------- */
    findTask(zoo) {
      switch (this.role) {
        case 'keeper': return this.keeperTask(zoo);
        case 'vet': return this.vetTask(zoo);
        case 'janitor': return this.janitorTask(zoo);
        case 'security': return this.securityTask(zoo);
        case 'maintenance': return this.maintTask(zoo);
        case 'researcher': return this.researchTask(zoo);
      }
      return null;
    }

    pickBest(zoo, cands) {
      let best = null, bs = -1e9;
      for (const c of cands) {
        const pr = this.priorities[c.type] != null ? this.priorities[c.type] : 1;
        if (pr === 0) continue;
        if (!zoo.canReserve(c.key, this.id)) continue;
        const [x, y] = zoo.map.xy(c.tile);
        const s = c.score * (pr === 2 ? 2 : 1) + (pr === 2 ? 60 : 0) - (Math.abs(x - this.x) + Math.abs(y - this.y)) * 0.6;
        if (s > bs) { bs = s; best = c; }
      }
      if (best) zoo.reserve(best.key, this.id);
      return best;
    }

    myEnclosures(zoo) {
      const all = [...zoo.enclosures.values()];
      return this.assigned.length ? all.filter((e) => this.assigned.includes(e.id)) : all;
    }

    keeperTask(zoo) {
      const c = [];
      const m = zoo.map;
      for (const e of this.myEnclosures(zoo)) {
        if (!e.gate) continue;
        const n = e.animalCount || 0;
        if (!n) continue;
        const hungry = e.needFood ? 40 : 0;
        e.stats.feeders.forEach((id) => {
          const o = zoo.objects.get(id); if (!o) return;
          const wrong = o.wantType && o.foodType !== o.wantType;
          if (o.wantType && (o.food < 50 || wrong)) c.push({ key: 'feed:' + id, type: 'feed', encId: e.id, objId: id, tile: m.idx(o.x, o.y), dur: 15, score: (wrong ? 100 : 100 - o.food) + hungry });
        });
        e.stats.troughs.forEach((id) => {
          const o = zoo.objects.get(id); if (!o) return;
          if (o.water < 50) c.push({ key: 'water:' + id, type: 'water', encId: e.id, objId: id, tile: m.idx(o.x, o.y), dur: 10, score: 100 - o.water + (e.needWater ? 40 : 0) });
        });
        if (e.cleanliness < 70) {
          let tile = e.gate.inIdx;
          for (let k = 0; k < 6; k++) { const x = U.randInt(e.x0, e.x1), y = U.randInt(e.y0, e.y1); const i = m.idx(x, y); if (!ZM.isWater(m.terrain[i])) { tile = i; break; } }
          c.push({ key: 'clean:' + e.id, type: 'clean', encId: e.id, tile, dur: 30, score: (100 - e.cleanliness) * 0.9 });
        }
      }
      return this.pickBest(zoo, c.filter((t) => !zoo.isUnreachable(t.key)));
    }

    vetTask(zoo) {
      const c = [];
      zoo.animals.forEach((a) => {
        if (a.escaped || a.state === 'TRANQ') return;
        const e = zoo.enclosures.get(a.encId); if (!e || !e.gate) return;
        const dur = 40 / (zoo.mods.vetSpeed * (zoo.countObjects('clinic') ? 1.5 : 1));
        if (a.sick || a.health < 70) c.push({ key: 'vet:' + a.id, type: 'treat', encId: a.encId, animalId: a.id, tile: a.tileIdx(zoo.map), dur, score: a.sick ? 200 : 100 - a.health });
        else if (zoo.day - a.checkedDay >= 4) c.push({ key: 'vet:' + a.id, type: 'checkup', encId: a.encId, animalId: a.id, tile: a.tileIdx(zoo.map), dur: dur * 0.4, score: 10 });
      });
      return this.pickBest(zoo, c.filter((t) => !zoo.isUnreachable(t.key)));
    }

    janitorTask(zoo) {
      const c = [];
      zoo.objects.forEach((o) => {
        if (o.def.kind === 'bin' && o.fill > o.def.capacity * 0.6) {
          const adj = zoo.adjacentWalkable(o);
          if (adj.length) c.push({ key: 'bin:' + o.id, type: 'bin', objId: o.id, tile: adj[0], dur: 6, score: 60 + o.fill });
        }
      });
      const bin = this.pickBest(zoo, c);
      if (bin) return bin;
      // lixo mais próximo (busca em largura)
      const m = zoo.map;
      if (this.priorities.litter === 0) return null;
      const p = zoo.requestNearest(this.tileIdx(m), (i) => m.litter[i] > 0 && zoo.canReserve('lit:' + i, this.id), this.canStepFn(zoo, 0), 2500);
      if (p && p.length) {
        const tile = p[p.length - 1];
        zoo.reserve('lit:' + tile, this.id);
        return { key: 'lit:' + tile, type: 'litter', tile, dur: 3 + m.litter[tile], score: 1 };
      }
      return null;
    }

    securityTask(zoo) {
      const esc = zoo.animals.filter((a) => a.escaped && a.state === 'ESCAPED');
      if (esc.length) {
        const c = esc.map((a) => ({ key: 'chase:' + a.id + ':' + this.id, type: 'chase', animalId: a.id, tile: a.tileIdx(zoo.map), dur: 1, score: 100 }));
        return this.pickBest(zoo, c);
      }
      return null;
    }

    maintTask(zoo) {
      const c = [];
      const m = zoo.map;
      const decayFloor = 75;
      for (const e of zoo.enclosures.values()) {
        if (e.condition < decayFloor) {
          const tile = e.gate ? e.gate.outIdx : zoo.fenceOutside(e);
          if (tile != null && tile >= 0) c.push({ key: 'fence:' + e.id, type: 'repairFence', encId: 0, fenceEnc: e.id, tile, dur: 35, score: (100 - e.condition) * 1.5 + (e.animalCount ? 20 : 0) });
        }
      }
      zoo.objects.forEach((o) => {
        if (o.condition == null || o.condition >= 55) return;
        const d = o.def;
        let tile = -1, encId = 0;
        if (d.inEnc) { encId = m.enc[m.idx(o.x, o.y)]; tile = m.idx(o.x, o.y); }
        else { const adj = zoo.adjacentWalkable(o); if (adj.length) tile = adj[0]; }
        if (tile >= 0) c.push({ key: 'obj:' + o.id, type: 'repairObj', objId: o.id, encId, tile, dur: 20, score: 100 - o.condition });
      });
      return this.pickBest(zoo, c.filter((t) => !zoo.isUnreachable(t.key)));
    }

    researchTask(zoo) {
      const labs = zoo.objectsOfKind('lab');
      if (!labs.length) return null;
      const lab = labs[this.id % labs.length];
      const adj = zoo.adjacentWalkable(lab);
      if (!adj.length) return null;
      return { key: 'res:' + this.id, type: 'research', objId: lab.id, tile: adj[this.id % adj.length], dur: 120, score: 1 };
    }

    toJSON() { return { id: this.id, role: this.role, name: this.name, x: this.x, y: this.y, assigned: this.assigned, tasksDone: this.tasksDone, priorities: this.priorities, workMin: this.workMin, totalMin: this.totalMin }; }
    static fromJSON(d) {
      const s = new Staff(d.role, 0, 0, d);
      s.id = d.id; s.x = d.x; s.y = d.y;
      return s;
    }
  }
  Staff.TASK_LABEL = TASK_LABEL;
  Staff.PRIORITY_TYPES = PRIORITY_TYPES;
  ZM.Staff = Staff;
})(window.ZM);
