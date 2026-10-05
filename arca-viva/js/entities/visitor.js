/* =========================================================
   Visitante: necessidades, decisões e satisfação
   ========================================================= */
(function (ZM) {
  'use strict';
  const U = ZM.util;

  const SHIRTS = ['#e85d4a', '#f2a93b', '#4a90d9', '#6cc070', '#b064d9', '#f06fa4', '#3cc4c4', '#f5d547', '#ffffff', '#ff8a3d', '#7f8cff'];
  const SKIN = ['#f1c9a5', '#e0ac7e', '#c68b5e', '#a46a43', '#7a4b2c', '#5a3620'];
  const HAIR = ['#2b1a10', '#5a3a1c', '#8b5a2b', '#d9b26a', '#1a1a1a', '#a33', '#777'];

  const LABEL = {
    WALK: 'Passeando', VIEW: 'Observando animais', SHOP: 'Comprando', TOILET: 'No banheiro', REST: 'Descansando no banco',
    READ: 'Lendo placa', INFO: 'No ponto de informação', QUEUE: 'Na fila', LEAVE: 'Indo embora', FLEE: 'Fugindo assustado', IDLE: 'Pensando',
  };

  class Visitor extends ZM.Agent {
    constructor(x, y) {
      super(x, y);
      this.kid = U.chance(0.25);
      this.name = U.pick(ZM.NAMES.people) + (this.kid ? ' (criança)' : ' ' + U.pick(ZM.NAMES.surnames));
      this.money = this.kid ? U.rand(10, 40) : U.rand(40, 150);
      this.hunger = U.rand(5, 35); this.thirst = U.rand(5, 35);
      this.energy = U.rand(75, 100); this.bladder = U.rand(0, 30);
      this.happiness = 65; this.interest = 100;
      this.visited = new Set(); this.seen = new Set(); this.readSigns = new Set();
      this.state = 'IDLE'; this.goal = null; this.actT = 0;
      this.thoughts = [];
      this.bubble = null;
      this.trash = 0; this.spent = 0; this.learned = 0;
      this.speed = U.rand(1.2, 1.6) * (this.kid ? 1.1 : 1);
      this.shirt = U.pick(SHIRTS); this.skin = U.pick(SKIN); this.hair = U.pick(HAIR); this.pants = U.pick(['#334', '#446', '#553', '#2c3e50', '#6b4f3a']);
      this.timeIn = 0;
      this.leaving = false;
      this.boughtSouvenir = false;
      this.noPathT = 0;
      this.maxStay = U.rand(3.5, 6.5); // horas de jogo
    }
    get label() { return LABEL[this.state] || this.state; }

    think2(text, icon, mood) {
      this.thoughts.unshift({ text, icon });
      if (this.thoughts.length > 6) this.thoughts.pop();
      this.bubble = { icon: icon || '💭', t: 3 };
      ZM.Events.emit('thought', { v: this, text, mood: mood || 0 });
    }

    canStepFn(zoo) {
      const m = zoo.map;
      const flee = this.state === 'FLEE';
      return (a, b) => (m.path[b] && (flee || !m.closed[b]) ? 1 : 0);
    }

    update(zoo, dt) {
      const gh = (dt * ZM.CONFIG.MIN_PER_SEC) / 60;
      this.timeIn += gh;
      const heat = zoo.weather.heat ? 1.7 : 1;
      this.hunger = U.clamp(this.hunger + 5 * gh, 0, 100);
      this.thirst = U.clamp(this.thirst + 6.5 * gh * heat, 0, 100);
      this.bladder = U.clamp(this.bladder + 7 * gh, 0, 100);
      if (this.state !== 'REST') this.energy = U.clamp(this.energy - (this.kid ? 4 : 6) * gh, 0, 100);
      this.interest = U.clamp(this.interest - 2.5 * gh, 0, 100);
      if (this.hunger > 85 || this.thirst > 85) this.happiness -= 3 * gh;
      if (this.bladder > 90) this.happiness -= 6 * gh;
      if (zoo.weather.rain) this.happiness -= 2 * gh;
      this.happiness = U.clamp(this.happiness, 0, 100);
      if (this.bubble) { this.bubble.t -= dt; if (this.bubble.t <= 0) this.bubble = null; }
      if (this.photo > 0) this.photo -= dt;
      // fechamento: todos se dirigem à saída
      const h = zoo.hour;
      if (!this.leaving && (h >= ZM.CONFIG.CLOSE_HOUR || h < 6 || !zoo.open) && this.state !== 'FLEE') {
        this.leaving = true; this.path = null; this.actT = 0; this.goal = null; this.state = 'LEAVE';
      }
      if (this.leaving && h >= 23 && !this.gone) { this.exit(zoo); return; }
      if (this.trash > 0) { this.trash += gh; if (this.trash > 0.7) this.dropTrash(zoo); }

      if (this.path) {
        const mult = this.state === 'FLEE' ? 1.9 : 1;
        if (this.step(dt, zoo.map, mult)) this.arrive(zoo);
      } else if (this.actT > 0) {
        this.actT -= gh * 60;
        if (this.state === 'REST') this.energy = Math.min(100, this.energy + 90 * gh);
        if (this.actT <= 0) { this.state = 'IDLE'; }
      }
      this.thinkT -= dt;
      if (this.thinkT <= 0) {
        this.thinkT = U.rand(0.4, 0.9);
        if (!this.path && this.actT <= 0) this.think(zoo);
      }
    }

    onTile(i) {
      const zoo = ZM.game.zoo;
      const m = zoo.map;
      if (m.litter[i] > 2 && U.chance(0.08)) {
        this.happiness -= 2;
        if (U.chance(0.4)) this.think2('O zoológico está muito sujo.', '🤢', -1);
      }
      if (this.trash > 0 && zoo.disposeTrash(this)) this.trash = 0;
      // placas educativas
      if (this.state !== 'LEAVE' && this.state !== 'FLEE') {
        const [x, y] = m.xy(i);
        const s = zoo.signNear(x, y, this.readSigns);
        if (s && U.chance(0.55)) {
          this.readSigns.add(s.id);
          this.path = null; this.goal = null; this.state = 'READ'; this.actT = 4;
          zoo.addEducation(1, s);
          this.learned++;
          const spId = s.species;
          if (spId) this.think2('Aprendi: ' + ZM.SPECIES[spId].fact, '📖', 1);
        }
        // decoração alegra
        const dec = zoo.decorAt(x, y);
        if (dec > 0) this.happiness = Math.min(100, this.happiness + dec * 0.15);
      }
    }

    dropTrash(zoo) {
      const i = this.tileIdx(zoo.map);
      if (zoo.map.path[i]) { zoo.map.litter[i] = Math.min(10, zoo.map.litter[i] + 1); }
      this.trash = 0;
    }

    think(zoo) {
      const C = ZM.CONFIG;
      const m = zoo.map, here = this.tileIdx(m);
      if (!m.path[here]) {
        // o caminho sob o visitante foi removido: volta para o caminho mais próximo
        const back = zoo.requestNearest(here, (i) => m.path[i] === 1, (a, b) => (m.enc[b] || ZM.isWater(m.terrain[b]) || (m.obj[b] >= 0 && zoo.objects.get(m.obj[b])?.blocks) ? 0 : 1), 600);
        if (back === undefined) return;
        if (!back) { this.exit(zoo); return; }
        this.setPath(back); this.goal = null; this.recovering = true; if (this.state !== 'LEAVE' && this.state !== 'FLEE') this.state = 'WALK';
        if (!this.path) this.state = 'IDLE';
        return;
      }
      this.recovering = false;
      if (this.state === 'QUEUE') { const dtm = zoo.absMinutes - (this._lastQ || zoo.absMinutes); this._lastQ = zoo.absMinutes; return this.tickQueue(zoo, dtm); }
      if (this.state === 'LEAVE' || this.state === 'FLEE') return this.goLeave(zoo);
      // ir embora?
      const late = zoo.hour >= C.CLOSE_HOUR - 0.5 || zoo.hour < C.OPEN_HOUR || !zoo.open;
      if (late || this.interest <= 8 || this.happiness < 12 || this.energy < 4 || this.timeIn > this.maxStay) {
        if (this.happiness < 12) this.think2('Que zoológico decepcionante. Vou embora!', '😠', -1);
        else if (late) this.think2('Hora de ir para casa.', '🏠', 0);
        else this.think2('Foi um ótimo passeio!', '😊', 1);
        return this.goLeave(zoo);
      }
      // necessidades
      if (this.bladder > 70 && this.goService(zoo, (d) => d.kind === 'toilet', 'TOILET')) return;
      if (this.bladder > 70 && !this.warnedToilet) { this.warnedToilet = true; this.think2('Preciso de um banheiro!', '🚻', -1); this.happiness -= 6; }
      if (this.hunger > 60 && this.money > 8 && this.goService(zoo, (d) => d.kind === 'shop' && d.need === 'hunger', 'SHOP')) return;
      if (this.hunger > 60 && !this.warnedFood) { this.warnedFood = true; this.think2('Estou com fome.', '🍔', -1); this.happiness -= 4; }
      if (this.thirst > 60 && this.money > 4 && this.goService(zoo, (d) => d.kind === 'shop' && (d.need === 'thirst' || d.thirst), 'SHOP')) return;
      if (this.thirst > 60 && !this.warnedDrink) { this.warnedDrink = true; this.think2('Que sede! Cadê as bebidas?', '🥤', -1); this.happiness -= 4; }
      if (this.energy < 30 && this.goService(zoo, (d) => d.kind === 'bench', 'REST')) return;
      if (this.energy < 30 && !this.warnedBench) { this.warnedBench = true; this.think2('Meus pés doem, não há bancos.', '🪑', -1); this.happiness -= 3; }
      // atrações
      if (U.chance(0.8) && this.goEnclosure(zoo, false)) return;
      if (U.chance(0.25) && this.goEnclosure(zoo, true)) return;
      if (!this.boughtSouvenir && this.happiness > 70 && this.money > 25 && U.chance(0.3) && this.goService(zoo, (d) => d.need === 'souvenir', 'SHOP')) return;
      if (U.chance(0.15) && this.goService(zoo, (d) => d.kind === 'info' || d.kind === 'educenter', 'INFO')) return;
      // vagar (sem novidades, o interesse cai mais rápido)
      this.interest -= 10;
      const p = zoo.randomPathNear(this.tx(), this.ty(), 8);
      if (p != null) {
        const path = zoo.requestPath(this.tileIdx(m), p, this.canStepFn(zoo), 1500);
        if (path) { this.setPath(path); this.state = 'WALK'; this.goal = null; return; }
      }
      this.actT = 5; this.state = 'IDLE';
    }

    goService(zoo, pred, state) {
      const o = zoo.findService(this, pred);
      if (!o) return false;
      const m = zoo.map;
      const access = o.access.reduce((best, i) => {
        const [x, y] = m.xy(i);
        const d = Math.abs(x - this.x) + Math.abs(y - this.y);
        return d < best.d ? { i, d } : best;
      }, { i: -1, d: 1e9 }).i;
      if (access < 0) return false;
      const p = zoo.requestPath(this.tileIdx(m), access, this.canStepFn(zoo), 3000);
      if (p === undefined) return true;
      if (!p) { o._unreach = (o._unreach || 0) + 1; return false; }
      this.setPath(p); this.state = 'WALK'; this.goal = { state, obj: o.id };
      if (!this.path) this.arrive(zoo);
      return true;
    }

    goEnclosure(zoo, revisit) {
      const m = zoo.map;
      let best = null, bs = -1;
      for (const e of zoo.enclosures.values()) {
        if (this.visited.has(e.id) !== !!revisit || !e.stats.views || !e.stats.views.length) continue;
        if (revisit && e.id === this.lastEnc) continue;
        const n = e.animalCount || 0;
        if (!n) continue;
        const [cx, cy] = e.center();
        const d = Math.abs(cx - this.x) + Math.abs(cy - this.y);
        const s = (e.attraction || 1) / (1 + d / 12) * U.rand(0.7, 1.3);
        if (s > bs) { bs = s; best = e; }
      }
      if (!best) return false;
      // ponto de observação mais próximo
      let vi = -1, vd = 1e9;
      best.stats.views.forEach((i) => { const [x, y] = m.xy(i); const d = Math.abs(x - this.x) + Math.abs(y - this.y) + Math.random() * 3; if (d < vd && !m.closed[i]) { vd = d; vi = i; } });
      if (vi < 0) return false;
      const p = zoo.requestPath(this.tileIdx(m), vi, this.canStepFn(zoo), 3000);
      if (p === undefined) return true;
      if (!p) { this.visited.add(best.id); return false; }
      this.setPath(p); this.state = 'WALK'; this.goal = { state: 'VIEW', enc: best.id }; this.lastEnc = best.id;
      if (!this.path) this.arrive(zoo);
      return true;
    }

    goLeave(zoo) {
      const m = zoo.map;
      const ent = zoo.entranceAccess();
      if (ent < 0) { this.gone = true; return; }
      if (this.tileIdx(m) === ent) { this.exit(zoo); return; }
      const p = zoo.requestPath(this.tileIdx(m), ent, this.canStepFn(zoo), 6000);
      if (p === undefined) return;
      if (!p) { this.noPathT++; if (this.noPathT > 3) this.exit(zoo); return; }
      if (this.state !== 'FLEE') this.state = 'LEAVE';
      this.setPath(p); this.goal = { state: 'EXIT' };
      if (!this.path) this.exit(zoo);
    }

    exit(zoo) {
      this.gone = true;
      zoo.onVisitorExit(this);
    }

    flee(zoo) {
      if (this.state === 'FLEE' || this.gone) return;
      this.state = 'FLEE'; this.path = null; this.actT = 0;
      this.happiness = Math.max(0, this.happiness - 25);
      this.think2('Socorro! Um animal fugiu!', '😱', -1);
      this.goLeave(zoo);
    }

    arrive(zoo) {
      const g = this.goal; this.goal = null;
      if (!g) { this.state = 'IDLE'; this.actT = U.rand(2, 6); return; }
      if (g.state === 'EXIT') return this.exit(zoo);
      if (g.state === 'VIEW') return this.view(zoo, zoo.enclosures.get(g.enc));
      const o = zoo.objects.get(g.obj);
      if (!o || o.broken) { this.state = 'IDLE'; this.actT = 2; if (o && o.broken) { this.think2(`${o.def.name} está quebrado!`, '🔧', -1); zoo.lostSale(o, 'quebrado'); this.avoidObj(zoo, o); } return; }
      const d = o.def;
      if (g.state === 'SHOP' || g.state === 'TOILET') return this.joinService(zoo, o, g.state);
      if (g.state === 'REST') { this.state = 'REST'; this.actT = 25; this.warnedBench = false; return; }
      if (g.state === 'INFO') {
        this.state = 'INFO'; this.actT = 8; this.interest = Math.min(100, this.interest + 20); this.happiness = Math.min(100, this.happiness + 4);
        zoo.addEducation(d.kind === 'educenter' ? 6 : 2, o);
        this.think2(d.kind === 'educenter' ? 'Quero ajudar a proteger a natureza!' : 'Esse mapa ajuda muito!', d.kind === 'educenter' ? '🌎' : 'ℹ️', 1);
        return;
      }
      if (g.state === 'SHOP') return this.buy(zoo, o);
      this.state = 'IDLE';
    }

    /* ---------- filas e capacidade de atendimento ---------- */
    joinService(zoo, o, kind) {
      const slots = zoo.serviceSlots(o);
      const busy = zoo.serviceCount(o), queue = zoo.queueOf(o);
      this.svcObj = o.id; this.svcKind = kind;
      if (busy < slots && !queue.length) return this.startService(zoo, o, kind);
      if (queue.length >= slots * 3) { this.giveUp(zoo, o, 'fila', `Fila enorme ${kind === 'TOILET' ? 'no banheiro' : 'na ' + o.def.name.toLowerCase()}! Desisto.`); return; }
      this.state = 'QUEUE'; this.queuedAt = zoo.absMinutes; this._lastQ = zoo.absMinutes; this.waitT = kind === 'TOILET' ? 18 : 25;
      const k = queue.length + 1; this.ox = U.clamp(-0.3 + k * 0.12, -0.35, 0.35); this.oy = U.clamp(0.3 - k * 0.12, -0.35, 0.35);
    }
    tickQueue(zoo, minutes) {
      const o = zoo.objects.get(this.svcObj);
      if (!o || o.broken) { this.state = 'IDLE'; this.actT = 2; return; }
      this.waitT -= minutes;
      const q = zoo.queueOf(o);
      if (q[0] === this && zoo.serviceCount(o) < zoo.serviceSlots(o)) return this.startService(zoo, o, this.svcKind);
      if (this.waitT <= 0) this.giveUp(zoo, o, 'espera', `Esperei demais ${this.svcKind === 'TOILET' ? 'no banheiro' : 'na fila da ' + o.def.name.toLowerCase()}.`);
    }
    startService(zoo, o, kind) {
      this.svcObj = o.id; this.ox = U.rand(-0.22, 0.22); this.oy = U.rand(-0.22, 0.22);
      if (kind === 'TOILET') { this.state = 'TOILET'; this.actT = 6; this.bladder = 0; this.warnedToilet = false; o.served = (o.served || 0) + 1; return; }
      return this.buy(zoo, o);
    }
    giveUp(zoo, o, reason, text) {
      zoo.lostSale(o, reason);
      this.think2(text, '⏳', -1); this.happiness -= 5;
      this.avoidObj(zoo, o);
      this.state = 'IDLE'; this.actT = 2; this.svcObj = null;
    }
    avoidObj(zoo, o) { this.avoid = { id: o.id, until: zoo.absMinutes + 90 }; }

    buy(zoo, o) {
      const d = o.def;
      const price = o.price;
      const fair = d.price;
      this.state = 'SHOP'; this.actT = 6; this.svcObj = o.id;
      if (price > fair * 1.7 && U.chance(0.8)) { this.think2(`${d.sells} por ${U.money(price)}? Muito caro!`, '💸', -1); this.happiness -= 4; zoo.lostSale(o, 'preco'); this.avoidObj(zoo, o); this.actT = 1; return; }
      if (this.money < price) { this.think2(`Não tenho dinheiro para ${d.sells.toLowerCase()} (${U.money(price)}).`, '👛', -1); zoo.lostSale(o, 'dinheiro'); this.actT = 1; return; }
      this.money -= price; this.spent += price;
      zoo.earn(price, 'lojas'); zoo.spend(d.unitCost * (zoo.sandbox ? 0 : 1), 'estoque', true);
      o.sales = (o.sales || 0) + 1; o.revenue = (o.revenue || 0) + price;
      o.salesToday = (o.salesToday || 0) + 1; o.revenueToday = (o.revenueToday || 0) + price; o.served = (o.served || 0) + 1;
      zoo.floatText(o.x + d.w / 2, o.y + d.h / 2, '+' + U.money(price), '#ffe066');
      if (d.need === 'hunger') { this.hunger = Math.max(0, this.hunger - d.amount); this.warnedFood = false; }
      if (d.need === 'thirst') { this.thirst = Math.max(0, this.thirst - d.amount); this.warnedDrink = false; }
      if (d.thirst) this.thirst = Math.max(0, this.thirst - d.thirst);
      if (d.fun) this.happiness = Math.min(100, this.happiness + d.fun);
      if (d.need === 'souvenir') { this.boughtSouvenir = true; this.think2('Comprei uma pelúcia linda!', '🧸', 1); }
      else if (price < fair * 0.8) this.think2('Que preço bom!', '👍', 1);
      if (d.trash) this.trash = 0.01;
      this.happiness = Math.min(100, this.happiness + 2);
    }

    view(zoo, enc) {
      this.state = 'VIEW'; this.actT = U.rand(10, 20);
      if (!enc) return;
      this.visited.add(enc.id);
      const animals = enc.animalsIn(zoo);
      const vis = animals.filter((a) => a.visible);
      this.interest -= 9;
      if (!vis.length) {
        const sp = animals.length ? ZM.SPECIES[animals[0].species] : null;
        this.happiness -= 5;
        this.think2(sp ? `Não consigo ver ${sp.name.startsWith('O') ? 'a' : 'o(a)'} ${sp.name.toLowerCase()}.` : 'Esse recinto está vazio.', '🔍', -1);
        return;
      }
      const bySp = {};
      vis.forEach((a) => { (bySp[a.species] = bySp[a.species] || []).push(a); });
      let gain = 0;
      let bestMsg = null, worst = null;
      Object.keys(bySp).forEach((sid) => {
        const sp = ZM.SPECIES[sid];
        const list = bySp[sid];
        const wf = list.reduce((s, a) => s + a.welfare, 0) / list.length;
        const novelty = this.seen.has(sid) ? 0.35 : 1;
        const countF = Math.min(1.3, 0.7 + list.length * 0.15);
        const v = sp.popularity * (0.3 + wf / 100) * novelty * countF;
        gain += v;
        this.seen.add(sid);
        if (wf >= 78 && (!bestMsg || sp.popularity > bestMsg.p)) bestMsg = { p: sp.popularity, t: `O recinto ${sp.plural.startsWith('O') ? 'das' : 'dos'} ${sp.plural.toLowerCase()} está ótimo!` };
        if (wf < 45) worst = `${sp.plural} parecem tristes e malcuidados...`;
        if (list.some((a) => a.isBaby)) bestMsg = { p: 99, t: `Que filhote de ${sp.name.toLowerCase()} fofo!` };
      });
      if (enc.cleanliness < 40) { gain -= 3; worst = worst || 'Que cheiro forte vem desse recinto...'; }
      this.happiness = U.clamp(this.happiness + gain * 0.8, 0, 100);
      this.interest = Math.min(100, this.interest + gain * 0.4);
      if (worst) { this.think2(worst, '😟', -1); this.happiness -= 6; zoo.stats.complaintsToday++; }
      else if (bestMsg) this.think2(bestMsg.t, '😍', 1);
      if (U.chance(0.45)) { this.photo = 1.2; zoo.stats.photosToday++; }
    }

    toJSON() {
      const o = {};
      ['id', 'x', 'y', 'ox', 'oy', 'kid', 'name', 'money', 'hunger', 'thirst', 'energy', 'bladder', 'happiness', 'interest',
        'actT', 'trash', 'spent', 'learned', 'speed', 'shirt', 'skin', 'hair', 'pants', 'timeIn', 'leaving', 'boughtSouvenir',
        'maxStay', 'warnedToilet', 'warnedFood', 'warnedDrink', 'warnedBench', 'lastEnc', 'facing'].forEach((k) => (o[k] = this[k]));
      o.visited = [...this.visited]; o.seen = [...this.seen]; o.readSigns = [...this.readSigns];
      o.thoughts = this.thoughts.slice(0, 6);
      // atividades paradas continuam; deslocamentos são recalculados ao carregar
      o.state = ['VIEW', 'SHOP', 'TOILET', 'REST', 'READ', 'INFO', 'QUEUE'].includes(this.state) && this.actT > 0 ? this.state : (this.leaving || this.state === 'LEAVE' || this.state === 'FLEE' ? 'LEAVE' : 'IDLE');
      if (o.state === 'QUEUE') { o.state = 'IDLE'; o.actT = 0; }
      return o;
    }
    static fromJSON(d) {
      const v = new Visitor(0, 0);
      Object.assign(v, d);
      v.visited = new Set(d.visited || []); v.seen = new Set(d.seen || []); v.readSigns = new Set(d.readSigns || []);
      v.thoughts = d.thoughts || [];
      v.path = null; v.goal = null; v.bubble = null;
      if (v.state === 'IDLE') v.actT = 0;
      return v;
    }
  }

  Visitor.LABEL = LABEL;
  ZM.Visitor = Visitor;
})(window.ZM);
