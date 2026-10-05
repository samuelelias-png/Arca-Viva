/* =========================================================
   Animal: necessidades, bem-estar e máquina de estados (IA)
   ========================================================= */
(function (ZM) {
  'use strict';
  const U = ZM.util, T = ZM.T;

  const STATE_LABEL = {
    IDLE: 'Observando', WANDER: 'Explorando', SEEK_FOOD: 'Indo comer', EAT: 'Comendo',
    SEEK_WATER: 'Indo beber', DRINK: 'Bebendo', SLEEP: 'Dormindo', REST: 'Descansando',
    SEEK_SHADE: 'Procurando sombra', SOCIAL: 'Socializando', PLAY: 'Brincando', HIDE: 'Escondido no abrigo',
    SWIM: 'Nadando', ESCAPED: 'FUGIU!', TRANQ: 'Tranquilizado', RETURN: 'Voltando ao recinto', WAIT_FOOD: 'Esperando comida',
    GRAZE: 'Pastando', PATROL: 'Patrulhando o território', WATCH: 'Observando os visitantes', CLIMB: 'Escalando', DIG: 'Cavando e farejando',
    SENTINEL: 'De sentinela', GROOM: 'Catando o companheiro', BASK: 'Tomando sol', SPLASH: 'Tomando banho', HOWL: 'Uivando', WALLOW: 'Relaxando na água',
  };

  const WALK_STATE = { EAT: 'SEEK_FOOD', DRINK: 'SEEK_WATER', SEEK_SHADE: 'SEEK_SHADE', PATROL: 'PATROL' };
  const PERSONALITIES = ['curioso', 'timido', 'brincalhao', 'preguicoso', 'sociavel'];
  const PERSONALITY_LABEL = { curioso: 'Curioso', timido: 'Tímido', brincalhao: 'Brincalhão', preguicoso: 'Preguiçoso', sociavel: 'Sociável' };
  const ARRIVE_STATE = { WANDER: 'IDLE', SEEK_SHADE: 'REST', EAT_TREE: 'EAT', PATROL: 'IDLE' };
  const LEISURE = new Set(['IDLE', 'REST', 'PLAY', 'SOCIAL', 'SWIM', 'GRAZE', 'WATCH', 'CLIMB', 'DIG', 'SENTINEL', 'GROOM', 'BASK', 'SPLASH', 'HOWL', 'WALLOW']);

  class Animal extends ZM.Agent {
    constructor(speciesId, encId, x, y, o = {}) {
      super(x, y);
      const sp = ZM.SPECIES[speciesId];
      this.species = speciesId;
      this.encId = encId;
      this.sex = o.sex || (Math.random() < 0.5 ? 'M' : 'F');
      this.name = o.name || U.pick(this.sex === 'M' ? ZM.NAMES.animalM : ZM.NAMES.animalF);
      this.ageDays = o.ageDays != null ? o.ageDays : U.rand(sp.maturity, sp.maturity * 3);
      this.health = 100; this.hunger = U.rand(10, 30); this.thirst = U.rand(10, 30);
      this.energy = U.rand(60, 90); this.stress = 15; this.happiness = 70; this.social = 70;
      this.welfare = 70; this.wb = {};
      this.state = 'IDLE'; this.goal = null; this.actT = 0;
      this.sick = false; this.disease = null; this.pregnant = 0; this.lastBirthDay = -99;
      this.escaped = false; this.tranq = 0; this.inShelter = false;
      this.checkedDay = 0; this.playBoost = 0;
      this.speed = 0.55 * sp.speed;
      this.born = o.born || false;
      this.fails = 0;
      this.welfareTarget = 70;
      this.personality = o.personality || U.pick(PERSONALITIES);
    }
    get personalityLabel() { return PERSONALITY_LABEL[this.personality] || ''; }
    get sp() { return ZM.SPECIES[this.species]; }
    get isBaby() { return this.ageDays < this.sp.maturity; }
    get label() { return STATE_LABEL[this.state] || this.state; }
    get visible() { return !this.inShelter && !this.escaped; }

    /* ----- passabilidade ----- */
    canStepFn(zoo) {
      const m = zoo.map, sp = this.sp, enc = this.encId;
      if (this.escaped) {
        return (a, b) => {
          if (m.enc[b] !== 0) return 0;
          if (ZM.isWater(m.terrain[b]) && !sp.swims) return 0;
          const o = m.obj[b]; if (o >= 0 && zoo.objects.get(o)?.blocks) return 0;
          return 1;
        };
      }
      const wt = sp.waterOnly === 'salt' ? T.SALT : T.WATER;
      return (a, b) => {
        if (m.enc[b] !== enc) return 0;
        const t = m.terrain[b];
        if (sp.waterOnly) return t === wt ? 1 : 0;
        if (ZM.isWater(t)) return sp.swims || sp.wades ? 1.3 : 0;
        return 1;
      };
    }
    /* tile utilizável por este animal (água certa para aquáticos, terra para terrestres) */
    canUse(zoo, i) { return this.canStepFn(zoo)(i, i) > 0; }
    returnStepFn(zoo) {
      const m = zoo.map, sp = this.sp, enc = this.encId;
      return (a, b) => {
        const e = m.enc[b];
        if (e !== 0 && e !== enc) return 0;
        if (ZM.isWater(m.terrain[b]) && !sp.swims) return 0;
        const o = m.obj[b]; if (o >= 0 && zoo.objects.get(o)?.blocks) return 0;
        return 1;
      };
    }

    /* ----- atualização contínua ----- */
    update(zoo, dt) {
      const gh = (dt * ZM.CONFIG.MIN_PER_SEC) / 60; // horas de jogo
      const sp = this.sp, mods = zoo.mods;
      this.ageDays += gh / 24;
      const sleeping = this.state === 'SLEEP' || this.state === 'TRANQ';
      const babyMul = this.isBaby ? 1.15 : 1;
      if (this.state !== 'EAT') this.hunger = U.clamp(this.hunger + 4.0 * gh * mods.hungerRate * babyMul, 0, 100);
      if (sp.noThirst) this.thirst = 0;
      else if (this.state !== 'DRINK') this.thirst = U.clamp(this.thirst + 5.5 * gh * (zoo.weather.heat ? 1.7 : 1) * (this.state === 'SWIM' ? 0.3 : 1), 0, 100);
      if (sleeping || this.state === 'REST' || this.state === 'HIDE') this.energy = U.clamp(this.energy + 16 * gh, 0, 100);
      else this.energy = U.clamp(this.energy - 4.2 * gh * sp.sleepy, 0, 100);

      // saúde
      let dh = 0.8;
      if (this.sick) dh = -3.5;
      else if (this.welfare < 35) dh = -1.5;
      if (this.hunger > 90) dh -= 3;
      if (this.thirst > 90) dh -= 4;
      const before = this.health;
      this.health = U.clamp(this.health + dh * gh, 0, 100);
      // aviso antes que seja tarde: saúde crítica
      if (before >= 35 && this.health < 35 && !this.escaped) {
        const why = this.sick ? `doente (${this.disease})` : this.hunger > 90 ? 'com fome extrema' : this.thirst > 90 ? 'com sede extrema' : 'com bem-estar muito baixo';
        zoo.alert(`🆘 ${this.name} (${sp.name}) está em estado crítico, ${why}. ${this.sick && !zoo.staffCount('vet') ? 'Contrate um veterinário já!' : 'Aja agora.'}`, 'danger', this);
      }

      // estresse tende a um alvo
      this.stress = U.clamp(this.stress + (this.stressTarget(zoo) - this.stress) * Math.min(1, 0.6 * gh), 0, 100);
      this.welfare += (this.welfareTarget - this.welfare) * Math.min(1, 0.5 * gh);
      this.playBoost = Math.max(0, this.playBoost - 3 * gh);
      this.happiness = U.clamp(this.happiness + (Math.min(100, this.welfare + this.playBoost) - this.happiness) * Math.min(1, 0.6 * gh), 0, 100);

      if (this.tranq > 0) {
        this.tranq -= gh * 60;
        if (this.tranq <= 0 && this.state === 'TRANQ') { this.state = 'RETURN'; this.path = null; }
      }

      // movimento
      if (this.path) {
        const mult = this.state === 'ESCAPED' ? 1.6 : this.state === 'RETURN' ? 1.5 : 1;
        if (this.step(dt, zoo.map, mult)) this.arrive(zoo);
      } else if (this.actT > 0) {
        // atividades de lazer são interrompidas por fome ou sede fortes
        if (LEISURE.has(this.state) && (this.hunger > 75 || (!sp.noThirst && this.thirst > 75))) this.actT = 0;
        else if (this.state === 'SLEEP' && (this.hunger > 88 || (!sp.noThirst && this.thirst > 88))) this.actT = 0; // fome/sede extremas acordam
        this.actT -= gh * 60;
        this.doAction(zoo, gh);
        if (this.actT <= 0) this.finishAction(zoo);
      }

      this.thinkT -= dt;
      if (this.thinkT <= 0) {
        this.thinkT = U.rand(0.6, 1.2);
        this.computeWelfare(zoo);
        // passeios de lazer são abandonados quando a fome ou a sede apertam
        if (this.path && this.goal && !this.escaped && (LEISURE.has(this.goal.state) || this.goal.state === 'WANDER' || this.goal.state === 'PATROL' || this.goal.state === 'SEEK_SHADE') &&
          ((this.hunger > 75 && zoo.absMinutes - (this.noFoodAt ?? -1e9) > 60) || (!sp.noThirst && this.thirst > 75 && zoo.absMinutes - (this.noWaterAt ?? -1e9) > 60))) { this.path = null; this.goal = null; this.state = 'IDLE'; this.actT = 0; }
        if (!this.path && this.actT <= 0) this.think(zoo);
      }
    }

    stressTarget(zoo) {
      if (this.escaped) return 90;
      const enc = zoo.enclosures.get(this.encId);
      let s = 10;
      if (enc) {
        const views = enc.stats.views ? enc.stats.views.length : 0;
        const crowd = enc.visitorsNear / Math.max(4, enc.area / 3);
        s += Math.min(35, crowd * 30 * (this.sp.predator ? 0.6 : 1));
        if (enc.stats.shelters && enc.stats.shelters.length) s -= 6;
        if (this.wb.habitat != null) s += (100 - this.wb.habitat) * 0.25;
        if (this.wb.space != null) s += (100 - this.wb.space) * 0.3;
        if (enc.predatorMix && !this.sp.predator) s += 35;
        if (this.state === 'HIDE') s -= 15;
        if (views === 0) s -= 4;
      }
      if (this.sick) s += 15;
      if (zoo.weather.heat && this.sp.shade && !zoo.inShade(this)) s += 10;
      return U.clamp(s, 0, 100);
    }

    computeWelfare(zoo) {
      const enc = zoo.enclosures.get(this.encId);
      const sp = this.sp;
      const wb = this.wb;
      wb.food = 100 - this.hunger;
      wb.water = 100 - this.thirst;
      wb.health = this.health;
      wb.stress = 100 - this.stress;
      if (enc && !this.escaped) {
        const mates = enc.animalsIn(zoo);
        let need = 0; mates.forEach((a) => (need += a.sp.space * (a.isBaby ? 0.4 : 1)));
        // aquáticos exclusivos contam só a água adequada como espaço
        const room = sp.waterOnly ? (sp.waterOnly === 'salt' ? enc.stats.salt : enc.stats.fresh) : enc.area;
        if (sp.waterOnly) { need = 0; mates.forEach((a) => { if (a.sp.waterOnly) need += a.sp.space * (a.isBaby ? 0.4 : 1); }); }
        wb.space = U.clamp(Math.round((room / Math.max(1, need)) * 100), 0, 100);
        wb.habitat = enc.habitatScore(sp);
        const same = mates.filter((a) => a.species === this.species).length;
        const [gmin, gmax] = sp.group;
        if (same < gmin) wb.social = gmin <= 1 ? 100 : Math.round(30 + 60 * (same - 1) / Math.max(1, gmin - 1));
        else if (same > gmax) wb.social = 65;
        else wb.social = 100;
        wb.hygiene = sp.waterOnly ? enc.waterQuality : (sp.swims && enc.stats.water ? Math.min(enc.cleanliness, (enc.cleanliness + enc.waterQuality) / 2) : enc.cleanliness);
        const enrich = enc.stats.enrich || 0;
        wb.enrich = U.clamp(Math.round(45 + enrich * 28 / Math.max(1, mates.length / 3)), 0, 100);
      } else {
        wb.space = 30; wb.habitat = 20; wb.social = 30; wb.hygiene = 50; wb.enrich = 20;
      }
      this.social = wb.social;
      this.welfareTarget =
        wb.food * 0.15 + wb.water * 0.15 + wb.space * 0.12 + wb.habitat * 0.15 + wb.social * 0.1 +
        wb.health * 0.13 + wb.hygiene * 0.08 + wb.stress * 0.07 + wb.enrich * 0.05;
      if (this.sick) this.welfareTarget -= 10;
      if (sp.cold && enc && !enc.stats.icemakers.length) this.welfareTarget -= zoo.weather.heat ? 25 : 12;
      this.welfareTarget = U.clamp(this.welfareTarget, 0, 100);
    }

    /* ----- IA: escolha de comportamento ----- */
    think(zoo) {
      const sp = this.sp;
      this.inShelter = false;
      if (this.state === 'TRANQ') return;
      if (this.state === 'RETURN') return this.goHome(zoo);
      if (this.escaped) return this.wanderEscaped(zoo);
      const enc = zoo.enclosures.get(this.encId);
      if (!enc) return;
      const h = zoo.hour;
      const night = h >= 21 || h < 6;
      const day = h >= 9 && h < 17;
      const sleepTime = sp.nocturnal ? day : night;

      const can = (i) => this.canUse(zoo, i);
      const shelters = enc.stats.shelters.filter((id) => can(this.tileOfObj(zoo, id)));
      const shade = enc.stats.shadeTiles.filter(can);
      const toys = enc.stats.toys.filter((id) => can(this.tileOfObj(zoo, id)));
      if (!sp.noThirst && this.thirst > 55 && this.seekWater(zoo, enc)) return;
      if (this.hunger > 55 && this.seekFood(zoo, enc)) return;
      if ((sleepTime && this.energy < 85) || this.energy < 22) return this.goSleep(zoo, enc);
      if (this.stress > 65 && shelters.length && U.chance(0.6)) return this.goTo(zoo, this.tileOfObj(zoo, U.pick(shelters)), 'HIDE', 50);
      if (sp.shade && h >= 11 && h < 15 && (zoo.weather.heat || U.chance(0.35)) && shade.length) {
        return this.goTo(zoo, U.pick(shade), 'SEEK_SHADE', 50);
      }
      // comportamentos característicos
      const r = Math.random();
      if (sp.waterOnly) {
        const wt = sp.waterOnly === 'salt' ? enc.stats.saltTiles : enc.stats.freshTiles;
        if (sp.jumper && r < 0.25 * this.trait('play')) { this.state = 'PLAY'; this.actT = U.rand(15, 30); this.playBoost = Math.min(25, this.playBoost + 10); return; }
        if (toys.length && r < 0.4) return this.goTo(zoo, this.tileOfObj(zoo, U.pick(toys)), 'PLAY', 30);
        if (wt.length && r < 0.85) return this.goTo(zoo, U.pick(wt), 'SWIM', U.rand(10, 30));
        this.state = 'SWIM'; this.actT = U.rand(10, 25); return;
      }
      if (this.chooseBehavior(zoo, enc, { toys, shade, shelters })) return;
      this.state = 'IDLE'; this.actT = U.rand(10, 30);
    }

    /* ---------- comportamentos por espécie + personalidade ---------- */
    trait(kind) {
      const p = this.personality;
      const T = { curioso: { watch: 1.8, wander: 1.4, hide: 0.6 }, timido: { watch: 0.3, hide: 1.8, rest: 1.2 }, brincalhao: { play: 2.2, climb: 1.4 },
        preguicoso: { rest: 1.9, patrol: 0.5, wander: 0.6 }, sociavel: { groom: 1.8, herd: 1.6, social: 1.6 } };
      return (T[p] && T[p][kind]) || 1;
    }
    chooseBehavior(zoo, enc, ctx) {
      const sp = this.sp, m = zoo.map, st = enc.stats;
      const prof = ZM.BEHAVIOR[this.species] || ZM.BEHAVIOR._default(sp);
      const h = zoo.hour, sunny = !zoo.weather.rain && h >= 9 && h < 16;
      const mates = enc.animalsIn(zoo).filter((a) => a !== this && a.species === this.species);
      const water = (sp.marine ? st.saltTiles.concat(st.freshTiles) : st.waterTiles).filter((i) => this.canUse(zoo, i));
      const land = (pred) => { const out = []; for (const [x, y] of enc.tiles()) { const i = m.idx(x, y); if (this.canUse(zoo, i) && pred(m.terrain[i], i)) out.push(i); } return out; };
      const centroid = () => { const g = mates.concat([this]); return [g.reduce((t, a) => t + a.x, 0) / g.length, g.reduce((t, a) => t + a.y, 0) / g.length]; };
      const nearest = (tiles, cx, cy, spread = 4) => { if (!tiles.length) return null; const c = tiles.filter((i) => { const [x, y] = m.xy(i); return Math.abs(x - cx) + Math.abs(y - cy) <= spread; }); return U.pick(c.length ? c : tiles); };
      const climbSpots = () => st.climb.map((id) => this.tileOfObj(zoo, id)).concat(st.shadeTiles.filter((i) => { const o = zoo.objAt(...m.xy(i)); return o && o.def.kind === 'tree'; })).filter((i) => this.canUse(zoo, i));
      const opts = {
        graze: () => { const g = land((t) => t === ZM.T.GRASS || t === ZM.T.FOREST); if (!g.length) return false; const [cx, cy] = sp.herd && mates.length ? centroid() : [this.x, this.y]; return this.goTo(zoo, nearest(g, cx, cy), 'GRAZE', U.rand(25, 50)); },
        browse: () => ctx.shade.length ? this.goTo(zoo, U.pick(ctx.shade), 'EAT_TREE', 25) : false,
        herd: () => { if (!mates.length) return false; const [cx, cy] = centroid(); const tx = U.clamp(Math.floor(cx + U.rand(-2.5, 2.5)), enc.x0, enc.x1), ty = U.clamp(Math.floor(cy + U.rand(-2.5, 2.5)), enc.y0, enc.y1); return this.goTo(zoo, m.idx(tx, ty), 'WANDER', U.rand(5, 15)); },
        wander: () => this.goTo(zoo, m.idx(U.randInt(enc.x0, enc.x1), U.randInt(enc.y0, enc.y1)), 'WANDER', U.rand(5, 20)),
        groupWater: () => { if (!water.length) return false; const [cx, cy] = mates.length ? centroid() : [this.x, this.y]; return this.goTo(zoo, nearest(water, cx, cy, 5), 'WALLOW', U.rand(40, 90)); },
        swim: () => water.length && sp.swims ? this.goTo(zoo, U.pick(water), 'SWIM', U.rand(30, 70)) : false,
        wade: () => water.length ? this.goTo(zoo, U.pick(water), 'SWIM', U.rand(30, 60)) : false,
        rest: () => { if (ctx.shade.length && U.chance(0.5)) return this.goTo(zoo, U.pick(ctx.shade), 'SEEK_SHADE', U.rand(30, 70)); this.state = 'REST'; this.actT = U.rand(30, 70); return true; },
        patrol: () => { const edge = land((t, i) => { const [x, y] = m.xy(i); return x === enc.x0 || x === enc.x1 || y === enc.y0 || y === enc.y1; }); if (!edge.length) return false; const far = edge.filter((i) => { const [x, y] = m.xy(i); return Math.abs(x - this.x) + Math.abs(y - this.y) > Math.max(enc.w, enc.h) * 0.6; }); return this.goTo(zoo, U.pick(far.length ? far : edge), 'PATROL', U.rand(3, 8)); },
        watch: () => {
          // vai até a cerca do lado onde há visitantes e observa
          const spots = st.views.map((v) => { const [vx, vy] = m.xy(v); const ix = U.clamp(vx, enc.x0, enc.x1), iy = U.clamp(vy, enc.y0, enc.y1); return m.idx(ix, iy); }).filter((i) => this.canUse(zoo, i));
          if (!spots.length) return false;
          const busy = spots.filter((i) => zoo.visitors.some((v) => v.state === 'VIEW' && Math.abs(v.tx() - (i % m.w)) + Math.abs(v.ty() - ((i / m.w) | 0)) <= 2));
          return this.goTo(zoo, U.pick(busy.length ? busy : spots), 'WATCH', U.rand(20, 45));
        },
        climb: () => { const c = climbSpots(); return c.length ? this.goTo(zoo, U.pick(c), 'CLIMB', this.species === 'preguica' ? U.rand(150, 300) : U.rand(30, 80)) : false; },
        dig: () => { const d = land((t) => t === ZM.T.DIRT || t === ZM.T.SAND || t === ZM.T.GRASS || t === ZM.T.FOREST); return d.length ? this.goTo(zoo, U.pick(d), 'DIG', U.rand(20, 45)) : false; },
        sentinel: () => { if (!mates.length || mates.some((a) => a.state === 'SENTINEL')) return false; const rocks = st.rockTiles.filter((i) => this.canUse(zoo, i)); if (rocks.length) return this.goTo(zoo, U.pick(rocks), 'SENTINEL', U.rand(40, 90)); this.state = 'SENTINEL'; this.actT = U.rand(40, 90); return true; },
        groom: () => { const mate = mates.find((a) => !a.path && a.state !== 'SLEEP' && a.state !== 'EAT'); if (!mate) return false; return this.goTo(zoo, mate.tileIdx(m), 'GROOM', 25, { mate: mate.id }); },
        bask: () => { if (!sunny) return false; const b = land((t, i) => (t === ZM.T.SAND || t === ZM.T.ROCK || t === ZM.T.DIRT) && !st.shadeTiles.includes(i)); return b.length ? this.goTo(zoo, U.pick(b), 'BASK', U.rand(40, 80)) : false; },
        splash: () => { const edge = land((t, i) => { const [x, y] = m.xy(i); return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => m.inb(x + a, y + b) && ZM.isWater(m.terrain[m.idx(x + a, y + b)])); }); return edge.length ? this.goTo(zoo, U.pick(edge), 'SPLASH', U.rand(20, 35)) : false; },
        howl: () => { if (!(h >= 20 || h < 5)) return false; this.state = 'HOWL'; this.actT = U.rand(6, 12); return true; },
        play: () => ctx.toys.length ? this.goTo(zoo, this.tileOfObj(zoo, U.pick(ctx.toys)), 'PLAY', 40) : false,
        social: () => { const mate = mates[0]; return mate ? this.goTo(zoo, mate.tileIdx(m), 'SOCIAL', 20) : false; },
      };
      // sorteio ponderado (personalidade altera os pesos)
      const keys = Object.keys(prof).filter((k) => opts[k]);
      for (let tries = 0; tries < 3 && keys.length; tries++) {
        const w = keys.map((k) => prof[k] * this.trait(k));
        let tot = w.reduce((a, b) => a + b, 0), pick = Math.random() * tot, k = 0;
        for (; k < keys.length; k++) { pick -= w[k]; if (pick <= 0) break; }
        k = Math.min(k, keys.length - 1);
        const key = keys[k];
        if (opts[key]()) { this.lastBehavior = key; return true; }
        keys.splice(k, 1);
      }
      return false;
    }

    tileOfObj(zoo, oid) { const o = zoo.objects.get(oid); return o ? zoo.map.idx(o.x, o.y) : this.tileIdx(zoo.map); }

    goTo(zoo, tile, state, dur, goal) {
      const start = this.tileIdx(zoo.map);
      const p = zoo.requestPath(start, tile, this.canStepFn(zoo));
      if (p === undefined) return true; // sem orçamento: tenta depois
      if (!p) { this.state = 'IDLE'; this.actT = 10; return false; }
      this.setPath(p);
      this.state = WALK_STATE[state] || 'WANDER';
      this.goal = { state, dur, tile, ...(goal || {}) };
      if (!this.path) this.arrive(zoo);
      return true;
    }

    /* o comedouro tem (ou terá) a comida da dieta desta espécie? */
    eatsFrom(o) { return o.foodType === this.sp.food && o.food >= 8; }
    servedBy(o) { return o.wantType === this.sp.food || this.eatsFrom(o); }
    seekFood(zoo, enc) {
      const feeders = enc.stats.feeders.map((id) => zoo.objects.get(id)).filter((o) => o && this.canUse(zoo, zoo.map.idx(o.x, o.y)));
      const near = (a, b) => U.dist(a.x, a.y, this.x, this.y) - U.dist(b.x, b.y, this.x, this.y);
      const ready = feeders.filter((o) => this.eatsFrom(o)).sort(near);
      const mine = ready.length ? ready : feeders.filter((o) => this.servedBy(o)).sort(near);
      if (!mine.length) { this.needIcon = ZM.FOOD[this.sp.food].icon; this.noFoodAt = zoo.absMinutes; zoo.flagNeed(this.encId, 'food'); return false; }
      const f = mine[0];
      this.state = 'SEEK_FOOD';
      return this.goTo(zoo, zoo.map.idx(f.x, f.y), 'EAT', 30, { obj: f.id });
    }
    seekWater(zoo, enc) {
      const m = zoo.map;
      const tr = enc.stats.troughs.map((id) => zoo.objects.get(id)).filter((o) => o && o.water >= 8);
      let best = null, bd = 1e9;
      tr.forEach((o) => { const d = U.dist(o.x, o.y, this.x, this.y); if (d < bd) { bd = d; best = { tile: m.idx(o.x, o.y), obj: o.id }; } });
      // água natural
      const canWade = this.sp.swims || this.sp.wades;
      enc.stats.waterTiles.forEach((i) => {
        const [x, y] = m.xy(i);
        let ti = i;
        if (!canWade) {
          // precisa ficar na margem
          const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [x + a, y + b]).find(([a, b]) => enc.contains(a, b) && !ZM.isWater(m.terrain[m.idx(a, b)]));
          if (!nb) return;
          ti = m.idx(nb[0], nb[1]);
        }
        const d = U.dist(x, y, this.x, this.y) - 1;
        if (d < bd) { bd = d; best = { tile: ti, obj: null }; }
      });
      if (!best) { this.needIcon = '💧'; this.noWaterAt = zoo.absMinutes; return false; }
      this.state = 'SEEK_WATER';
      return this.goTo(zoo, best.tile, 'DRINK', 15, { obj: best.obj });
    }
    goSleep(zoo, enc) {
      let tile;
      const shel = enc.stats.shelters.filter((id) => this.canUse(zoo, this.tileOfObj(zoo, id)));
      if (this.sp.waterOnly) tile = this.tileIdx(zoo.map);
      else if (shel.length) tile = this.tileOfObj(zoo, U.pick(shel));
      else if (enc.stats.shadeTiles.some((i) => this.canUse(zoo, i)) && U.chance(0.6)) tile = U.pick(enc.stats.shadeTiles.filter((i) => this.canUse(zoo, i)));
      else tile = this.tileIdx(zoo.map);
      return this.goTo(zoo, tile, 'SLEEP', U.rand(90, 200));
    }

    arrive(zoo) {
      const g = this.goal;
      this.goal = null;
      if (this.state === 'ESCAPED') { this.actT = U.rand(5, 15); return; }
      if (this.state === 'RETURN') return this.reachedHome(zoo);
      if (!g) { this.state = 'IDLE'; this.actT = 5; return; }
      this.state = ARRIVE_STATE[g.state] || g.state;
      this.actT = g.dur;
      this.actObj = g.obj || null;
      this.treeSnack = g.state === 'EAT_TREE';
      if (this.state === 'EAT' && !this.treeSnack) {
        const o = zoo.objects.get(this.actObj);
        if (!o || !this.eatsFrom(o)) {
          if (o && this.servedBy(o)) { this.state = 'WAIT_FOOD'; this.actT = 25; }
          else { this.state = 'IDLE'; this.actT = 8; }
          this.needIcon = ZM.FOOD[this.sp.food].icon; zoo.flagNeed(this.encId, 'food');
        }
      }
      if (this.state === 'DRINK' && this.actObj) {
        const o = zoo.objects.get(this.actObj);
        if (!o || o.water < 8) { this.state = 'IDLE'; this.actT = 10; this.needIcon = '💧'; zoo.flagNeed(this.encId, 'water'); }
      }
      if (this.state === 'GROOM' && g.mate) {
        // o parceiro para e participa
        const mate = zoo.animals.find((a) => a.id === g.mate);
        if (mate && !mate.path && mate.encId === this.encId && !['SLEEP', 'EAT', 'DRINK', 'GROOM'].includes(mate.state) && !mate.escaped) {
          mate.state = 'GROOM'; mate.actT = this.actT; mate.goal = null;
        }
      }
      if (this.state === 'HIDE' || ((this.state === 'SLEEP' || this.state === 'REST') && this.onShelter(zoo))) this.inShelter = true;
    }
    onShelter(zoo) {
      const o = zoo.map.obj[this.tileIdx(zoo.map)];
      return o >= 0 && zoo.objects.get(o)?.def.kind === 'shelter';
    }

    doAction(zoo, gh) {
      switch (this.state) {
        case 'EAT': {
          if (this.treeSnack) { this.hunger = Math.max(0, this.hunger - 25 * gh); break; }
          const o = zoo.objects.get(this.actObj);
          if (o && o.food > 0 && o.foodType === this.sp.food) { const amt = 130 * gh; this.hunger = Math.max(0, this.hunger - amt); o.food = Math.max(0, o.food - amt * 0.35 * this.sp.size); }
          else this.actT = 0;
          break;
        }
        case 'DRINK': {
          this.thirst = Math.max(0, this.thirst - 220 * gh);
          const o = this.actObj && zoo.objects.get(this.actObj);
          if (o) o.water = Math.max(0, o.water - 60 * gh);
          if (this.thirst <= 1) this.actT = 0;
          break;
        }
        case 'PLAY': this.playBoost = Math.min(25, this.playBoost + 40 * gh); this.stress = Math.max(0, this.stress - 20 * gh); break;
        case 'SOCIAL': this.stress = Math.max(0, this.stress - 10 * gh); break;
        case 'GRAZE': {
          // pasto e mata ajudam a saciar herbívoros entre as refeições do comedouro
          const t = zoo.map.terrain[this.tileIdx(zoo.map)];
          if (t === T.GRASS || t === T.FOREST) this.hunger = Math.max(0, this.hunger - 5 * gh);
          break;
        }
        case 'DIG':
          if (this.sp.food === 'insects') this.hunger = Math.max(0, this.hunger - 6 * gh);
          this.playBoost = Math.min(25, this.playBoost + 8 * gh);
          break;
        case 'CLIMB': this.playBoost = Math.min(25, this.playBoost + 15 * gh); this.stress = Math.max(0, this.stress - 8 * gh); break;
        case 'GROOM': this.stress = Math.max(0, this.stress - 14 * gh); break;
        case 'BASK': this.stress = Math.max(0, this.stress - 6 * gh); this.energy = Math.min(100, this.energy + 6 * gh); break;
        case 'SPLASH': this.thirst = Math.max(0, this.thirst - 30 * gh); this.playBoost = Math.min(25, this.playBoost + 12 * gh); break;
        case 'WALLOW': this.stress = Math.max(0, this.stress - 10 * gh); this.thirst = Math.max(0, this.thirst - 10 * gh); break;
        case 'HOWL': case 'SENTINEL': case 'WATCH': this.stress = Math.max(0, this.stress - 3 * gh); break;
        case 'WAIT_FOOD': {
          const o = zoo.objects.get(this.actObj);
          if (o && this.eatsFrom(o)) { this.state = 'EAT'; this.actT = 30; this.needIcon = null; }
          break;
        }
        case 'SLEEP': {
          const h = zoo.hour;
          if (this.energy >= 99 && (this.sp.nocturnal ? !(h >= 9 && h < 17) : !(h >= 21 || h < 6))) this.actT = 0;
          break;
        }
      }
    }
    finishAction(zoo) {
      this.inShelter = false;
      if (this.state === 'EAT' || this.state === 'DRINK') this.needIcon = null;
      this.state = 'IDLE';
      this.actT = 0;
    }

    /* ----- fuga ----- */
    escape(zoo) {
      if (this.sp.waterOnly) return false;
      const enc = zoo.enclosures.get(this.encId);
      if (!enc) return false;
      const m = zoo.map;
      // procura um tile fora encostado na cerca
      const opts = [];
      for (let x = enc.x0; x <= enc.x1; x++) { opts.push([x, enc.y0 - 1]); opts.push([x, enc.y1 + 1]); }
      for (let y = enc.y0; y <= enc.y1; y++) { opts.push([enc.x0 - 1, y]); opts.push([enc.x1 + 1, y]); }
      const ok = opts.filter(([x, y]) => m.inb(x, y) && m.enc[m.idx(x, y)] === 0 && !ZM.isWater(m.terrain[m.idx(x, y)]) && !(m.obj[m.idx(x, y)] >= 0 && zoo.objects.get(m.obj[m.idx(x, y)])?.blocks));
      if (!ok.length) return false;
      const [x, y] = U.pick(ok);
      this.x = x + 0.5; this.y = y + 0.5;
      this.escaped = true; this.state = 'ESCAPED'; this.path = null; this.actT = 0; this.inShelter = false;
      return true;
    }
    wanderEscaped(zoo) {
      this.state = 'ESCAPED';
      const m = zoo.map;
      const tx = U.clamp(this.tx() + U.randInt(-5, 5), 0, m.w - 1), ty = U.clamp(this.ty() + U.randInt(-5, 5), 0, m.h - 1);
      const p = zoo.requestPath(this.tileIdx(m), m.idx(tx, ty), this.canStepFn(zoo), 600);
      if (p) this.setPath(p); else this.actT = 5;
    }
    tranquilize() {
      this.state = 'TRANQ'; this.tranq = 45; this.path = null; this.actT = 0;
    }
    goHome(zoo) {
      const enc = zoo.enclosures.get(this.encId);
      if (!enc) { this.escaped = false; return; }
      const m = zoo.map;
      const target = enc.gate ? enc.gate.inIdx : m.idx(Math.floor((enc.x0 + enc.x1) / 2), Math.floor((enc.y0 + enc.y1) / 2));
      const p = zoo.requestPath(this.tileIdx(m), target, this.returnStepFn(zoo), 5000);
      if (p === undefined) return;
      if (!p) { const [x, y] = m.xy(target); this.x = x + 0.5; this.y = y + 0.5; return this.reachedHome(zoo); }
      this.setPath(p);
      if (!this.path) this.reachedHome(zoo);
    }
    reachedHome(zoo) {
      this.escaped = false; this.state = 'IDLE'; this.actT = 20; this.stress = 60;
      const enc = zoo.enclosures.get(this.encId);
      if (enc) enc.condition = Math.max(enc.condition, 55);
      zoo.onAnimalReturned(this);
    }

    toJSON() {
      const k = ['id', 'species', 'encId', 'sex', 'name', 'ageDays', 'health', 'hunger', 'thirst', 'energy', 'stress', 'happiness', 'welfare', 'sick', 'disease', 'pregnant', 'lastBirthDay', 'checkedDay', 'x', 'y', 'born', 'escaped', 'escapedAt', 'tranq', 'personality'];
      const o = {}; k.forEach((n) => (o[n] = this[n]));
      // emergências em andamento são preservadas
      o.state = ['ESCAPED', 'TRANQ', 'RETURN'].includes(this.state) ? this.state : 'IDLE';
      return o;
    }
    static fromJSON(d) {
      const a = new Animal(d.species, d.encId, 0, 0, d);
      Object.assign(a, d);
      a.path = null; a.actT = 0; a.goal = null;
      if (d.escaped) {
        a.escaped = true;
        a.state = ['ESCAPED', 'TRANQ', 'RETURN'].includes(d.state) ? d.state : 'ESCAPED';
        if (a.state === 'TRANQ' && !(a.tranq > 0)) a.tranq = 30;
      } else { a.escaped = false; a.state = 'IDLE'; a.tranq = 0; }
      return a;
    }
  }

  /* pesos de comportamento por espécie (o que cada uma faz quando as necessidades estão atendidas) */
  ZM.BEHAVIOR = {
    capivara: { groupWater: 4, graze: 2, swim: 2, rest: 2 },
    zebra: { graze: 5, herd: 3, wander: 1 },
    leao: { rest: 5, patrol: 2, watch: 2, play: 1.5, bask: 1 },
    girafa: { browse: 5, herd: 2, wander: 1 },
    flamingo: { wade: 6, herd: 2 },
    anta: { groupWater: 3, swim: 2, browse: 1, rest: 2 },
    tamandua: { dig: 5, wander: 2, rest: 1 },
    jacare: { bask: 5, swim: 4, rest: 2 },
    arara: { climb: 5, social: 2, wander: 1 },
    loboguara: { patrol: 3, dig: 1, howl: 1, rest: 2, wander: 2 },
    onca: { rest: 4, climb: 2, patrol: 2, swim: 1, watch: 1, play: 1 },
    mico: { climb: 5, groom: 3, play: 2 },
    chimpanze: { climb: 3, groom: 3, play: 3, watch: 2, social: 1 },
    hipopotamo: { groupWater: 5, swim: 4, graze: 1 },
    elefante: { splash: 3, browse: 2, herd: 3, play: 1 },
    ema: { graze: 4, herd: 3 },
    tatucanastra: { dig: 6, rest: 2 },
    tucano: { climb: 5, social: 1 },
    quati: { dig: 3, climb: 3, herd: 2 },
    vinagre: { patrol: 3, herd: 3, play: 1, swim: 1 },
    preguica: { climb: 8, rest: 4 },
    avestruz: { graze: 4, herd: 2, wander: 2 },
    canguru: { graze: 4, herd: 2, rest: 2 },
    suricato: { dig: 4, sentinel: 3, herd: 2 },
    rinoceronte: { graze: 4, groupWater: 2, rest: 2 },
    tigre: { rest: 4, patrol: 2, swim: 2, play: 1, watch: 1 },
    ursopardo: { dig: 2, swim: 2, rest: 3, play: 1, wander: 1 },
    lobo: { patrol: 3, herd: 3, howl: 1, rest: 2 },
    sucuarana: { climb: 2, rest: 4, patrol: 2, watch: 1 },
    gorila: { groom: 3, rest: 3, watch: 2, play: 1, wander: 1 },
    ariranha: { swim: 5, play: 3, groupWater: 2 },
    pinguim: { swim: 4, herd: 3, wander: 1 },
    leaomarinho: { bask: 4, swim: 4, rest: 1 },
    tartaruga: { swim: 5, bask: 2 },
    ursopolar: { swim: 3, rest: 3, patrol: 2, play: 1 },
    /* espécies sem tabela: deriva das características */
    _default(sp) {
      const p = { wander: 2, rest: 1 };
      if (sp.predator) { p.rest = 3; p.patrol = 2; }
      else if (sp.food === 'hay') p.graze = 3;
      if (sp.herd) p.herd = 2;
      if (sp.climber) p.climb = 3;
      if (sp.swims) p.swim = 2;
      if (sp.food === 'insects') p.dig = 3;
      return p;
    },
  };

  Animal.STATE_LABEL = STATE_LABEL;
  ZM.Animal = Animal;
})(window.ZM);
