/* =========================================================
   Zoo: estado do jogo e orquestração da simulação
   (construção em world/construction.js; serviços em systems/services.js)
   ========================================================= */
(function (ZM) {
  'use strict';
  const U = ZM.util, T = ZM.T, C = ZM.CONFIG;

  class Zoo {
    constructor(scenarioId, opts = {}) {
      this.scenarioId = scenarioId;
      const sc = this.scenario;
      this.sandbox = !!sc.sandbox;
      this.map = new ZM.ZooMap(C.MAP_W, C.MAP_H);
      this.pf = new ZM.Pathfinder(this.map);
      this.objects = new Map();
      this.enclosures = new Map();
      this.animals = []; this.visitors = []; this.staff = [];
      this.money = sc.money;
      this.day = 1; this.minute = 7 * 60;
      this.speed = 1; this.open = false; this.ticketPrice = 12;
      this.reputation = sc.rep || 1; this.education = 0; this.cp = this.sandbox ? 999 : 0;
      this.stats = { totalVisitors: 0, visitorsToday: 0, exitsToday: 0, satAvg: 60, births: 0, threatenedBirths: 0, cpEarned: 0, bestDayProfit: 0, complaintsToday: 0, photosToday: 0, eduToday: 0, deaths: 0, escapes: 0 };
      this.econ = new ZM.Economy();
      this.research = new ZM.ResearchSystem(this);
      this.events = new ZM.EventSystem(this);
      this.missions = new ZM.Missions(this);
      this.weather = { heat: false, rain: false };
      this.mods = { ...ZM.BASE_MODS };
      this.reservations = new Map(); this.unreachable = new Map();
      this.alerts = []; this.floaters = []; this.alertTimes = {};
      this.encSeq = 1;
      this.decorMap = new Float32Array(this.map.N);
      this.pathTiles = [];
      this.kindCache = null;
      this.spawnAcc = 0; this.acc = 0; this.periodicT = 0; this.pathBudget = C.PATH_BUDGET;
      this.nextEncId = 1;
      this.undo = new ZM.UndoStack(this);
      this.routesDirty = false;
      if (!opts.empty) this.generateWorld();
      if (!opts.empty && !opts.noSetup && sc.setup) sc.setup(this, ZM.ScenarioBuilder);
      this.undo.clear();
    }
    get scenario() { return ZM.SCENARIOS[this.scenarioId]; }
    get hour() { return this.minute / 60; }
    get absMinutes() { return this.day * 1440 + this.minute; }
    get pathCount() { return this.pathTiles.length; }

    generateWorld() {
      this.map.generate();
      const m = this.map;
      // vegetação natural espalhada
      for (let i = 0; i < 140; i++) {
        const x = U.randInt(0, m.w - 1), y = U.randInt(0, m.h - 1);
        const t = m.terrain[m.idx(x, y)];
        if (ZM.isWater(t)) continue;
        const edge = x < 4 || y < 4 || x > m.w - 5 || y > m.h - 5;
        if (t === T.FOREST || (edge && U.chance(0.6)) || U.chance(0.12)) {
          const type = t === T.FOREST ? U.pick(['bigtree', 'bigtree', 'bush', 'palm']) : U.pick(['acacia', 'bush', 'tallgrass', 'ipe', 'bush', 'rock', 'flowers']);
          this.placeObject(type, x, y, { free: true, silent: true });
        }
      }
      this.recomputeMods();
      this.refreshAll();
    }

    /* =================== consultas =================== */
    isSpeciesUnlocked(id) {
      if (this.scenario.unlockAll) return true;
      const sp = ZM.SPECIES[id];
      if (sp.unlock === 'start') return true;
      const r = ZM.UNLOCK.species[id];
      return r ? this.research.isDone(r) : false;
    }
    isObjectUnlocked(type) {
      if (this.scenario.unlockAll) return true;
      const r = ZM.UNLOCK.objects[type] || ZM.OBJECTS[type].research;
      return r ? this.research.isDone(r) : true;
    }
    isTerrainUnlocked(t) {
      if (this.scenario.unlockAll) return true;
      const r = ZM.TERRAIN[t].research;
      return r ? this.research.isDone(r) : true;
    }
    isFenceUnlocked(f) {
      if (this.scenario.unlockAll) return true;
      const r = ZM.UNLOCK.fences[f];
      return r ? this.research.isDone(r) : true;
    }
    countObjects(type) { let n = 0; this.objects.forEach((o) => { if (o.type === type) n++; }); return n; }
    objectsOfKind(kind) {
      if (!this.kindCache) {
        this.kindCache = {};
        this.objects.forEach((o) => { const k = o.def.kind; (this.kindCache[k] = this.kindCache[k] || []).push(o); });
      }
      return this.kindCache[kind] || [];
    }
    countSpecies(id) { return this.animals.filter((a) => a.species === id).length; }
    speciesList() { return [...new Set(this.animals.map((a) => a.species))]; }
    staffCount(role) { return this.staff.filter((s) => s.role === role).length; }
    staffRoles() { return [...new Set(this.staff.map((s) => s.role))]; }
    avgWelfare() { if (!this.animals.length) return 0; return this.animals.reduce((s, a) => s + a.welfare, 0) / this.animals.length; }
    animalById(id) { return this.animals.find((a) => a.id === id); }
    entrance() { return this.objectsOfKind('entrance')[0] || null; }
    entranceAccess() { const e = this.entrance(); return e && e.access.length ? e.access[0] : -1; }
    /* construção alcançável por visitantes a partir da entrada */
    isConnected(o) { return !!(o && o.access && o.access.length); }
    /* encostado num caminho, mas o caminho não chega à entrada */
    isIsolated(o) { return !!(o && o.accessRaw && o.accessRaw.length && !o.access.length); }
    entranceConnected() { return this.entranceAccess() >= 0; }
    encAt(x, y) { if (!this.map.inb(x, y)) return null; const id = this.map.enc[this.map.idx(x, y)]; return id ? this.enclosures.get(id) : null; }
    objAt(x, y) { if (!this.map.inb(x, y)) return null; const id = this.map.obj[this.map.idx(x, y)]; return id >= 0 ? this.objects.get(id) : null; }
    inShade(a) { const o = this.objAt(a.tx(), a.ty()); return !!(o && (o.def.shade || o.def.kind === 'shelter')); }
    encFoodType(enc) {
      const c = {};
      this.animals.forEach((a) => { if (a.encId === enc.id) c[a.sp.food] = (c[a.sp.food] || 0) + 1; });
      let best = 'hay', n = -1;
      Object.keys(c).forEach((k) => { if (c[k] > n) { n = c[k]; best = k; } });
      return best;
    }
    flagNeed(encId, what) { const e = this.enclosures.get(encId); if (e) { if (what === 'food') e.needFood = true; else e.needWater = true; } }
    researchRate(lab) {
      let r = 0.9;
      const act = this.research.active ? ZM.RESEARCH[this.research.active] : null;
      if (lab && act) {
        const t = lab.def.labType;
        if (t === 'gene' && (act.cat === 'conservacao' || act.cat === 'veterinaria')) r *= 1.5;
        if (t === 'aqua' && act.cat === 'aquaticos') r *= 1.5;
      }
      return r * this.mods.workSpeed;
    }
    totalLitter() { let n = 0; for (const i of this.pathTiles) n += this.map.litter[i]; return n; }

    /* =================== economia =================== */
    earn(v, cat) {
      if (v <= 0) return;
      if (!this.sandbox) this.money += v;
      this.econ.earn(v, cat);
    }
    spend(v, cat, force) {
      if (v <= 0) return true;
      if (this.sandbox) { this.econ.spend(v, cat); return true; }
      if (!force && this.money < v) return false;
      this.money -= v;
      this.econ.spend(v, cat);
      return true;
    }
    /* estornos usados pelo desfazer */
    refund(v, cat) { if (v <= 0) return; if (!this.sandbox) this.money += v; this.econ.today.expense[cat] = (this.econ.today.expense[cat] || 0) - v; }
    unearn(v, cat) { if (v <= 0) return; if (!this.sandbox) this.money -= v; this.econ.today.income[cat] = (this.econ.today.income[cat] || 0) - v; }
    fairPrice() { return Math.round(8 + this.attraction * 0.3 + this.reputation * 3); }

    /* construção: js/world/construction.js */

    /* =================== animais =================== */
    buyAnimal(speciesId, encId, opt = {}) {
      const sp = ZM.SPECIES[speciesId];
      const enc = this.enclosures.get(encId);
      if (!enc) return { ok: false, reason: 'Escolha um recinto' };
      if (!this.isSpeciesUnlocked(speciesId)) return { ok: false, reason: 'Espécie bloqueada' };
      if (ZM.isAquatic(sp) && !(enc.prefab && ZM.PREFABS[enc.prefab].species.includes(speciesId))) {
        return { ok: false, reason: `${sp.name} só pode morar num habitat pronto: ${ZM.prefabsFor(speciesId).map((k) => ZM.PREFABS[k].name).join(' ou ')} (Construção ▸ Habitats aquáticos)` };
      }
      if (!this.sandbox && sp.cp > this.cp) return { ok: false, reason: `Requer ${sp.cp} Pontos de Conservação` };
      const m = this.map;
      const tiles = [];
      for (const [x, y] of enc.tiles()) { const i = m.idx(x, y); if (this.tileFits(sp, m.terrain[i])) tiles.push(i); }
      if (!tiles.length) return { ok: false, reason: sp.waterOnly ? `Precisa de ${sp.waterOnly === 'salt' ? 'água salgada' : 'água doce'} no recinto` : 'Sem espaço adequado no recinto' };
      if (!this.spend(sp.price, 'animais')) return { ok: false, reason: 'Dinheiro insuficiente' };
      if (!this.sandbox && sp.cp) this.cp -= sp.cp;
      let t = tiles[Math.floor(Math.random() * tiles.length)];
      if (opt.x != null && enc.contains(opt.x, opt.y)) { const i = m.idx(opt.x, opt.y); if (tiles.includes(i)) t = i; }
      const [x, y] = m.xy(t);
      const sex = opt.sex || this.balancedSex(speciesId, encId);
      const a = new ZM.Animal(speciesId, encId, x, y, { sex });
      this.animals.push(a);
      a.computeWelfare(this); a.welfare = Math.max(55, a.welfareTarget);
      this.aggregate();
      ZM.Audio.play('cash');
      return { ok: true, animal: a };
    }
    tileFits(sp, t) {
      if (sp.waterOnly) return t === (sp.waterOnly === 'salt' ? T.SALT : T.WATER);
      return !ZM.isWater(t) || sp.swims || sp.wades;
    }
    /* resumo de sexos e situação reprodutiva de uma espécie num recinto */
    breedingInfo(encId, speciesId) {
      const g = this.animals.filter((a) => a.encId === encId && a.species === speciesId && !a.escaped);
      const m = g.filter((a) => a.sex === 'M').length, f = g.length - m;
      const adultM = g.filter((a) => a.sex === 'M' && !a.isBaby).length, adultF = g.filter((a) => a.sex === 'F' && !a.isBaby).length;
      const sp = ZM.SPECIES[speciesId];
      let note;
      if (!adultM && !adultF) note = 'Só filhotes';
      else if (!adultM) note = 'Sem macho adulto: não reproduz';
      else if (!adultF) note = 'Sem fêmea adulta: não reproduz';
      else if (g.length >= sp.group[1]) note = 'Grupo cheio: reprodução pausada';
      else note = 'Casal formado: pode reproduzir';
      return { m, f, note, canBreed: note.startsWith('Casal') };
    }
    balancedSex(speciesId, encId) {
      const g = this.animals.filter((a) => a.species === speciesId && a.encId === encId);
      const m = g.filter((a) => a.sex === 'M').length;
      return m <= g.length - m ? 'M' : 'F';
    }
    sellAnimal(id) {
      const a = this.animalById(id); if (!a) return false;
      this.animals = this.animals.filter((x) => x !== a);
      this.earn(Math.round(a.sp.price * (a.isBaby ? 0.4 : 0.5)), 'vendas');
      this.aggregate();
      return true;
    }
    transferAnimal(id, encId) {
      const a = this.animalById(id), e = this.enclosures.get(encId);
      if (!a || !e || a.escaped) return { ok: false };
      if (ZM.isAquatic(a.sp) && !(e.prefab && ZM.PREFABS[e.prefab].species.includes(a.species))) return { ok: false, reason: 'Animais aquáticos só podem ir para o habitat pronto da espécie' };
      const m = this.map, sp = a.sp;
      const tiles = [];
      for (const [x, y] of e.tiles()) { const i = m.idx(x, y); if (this.tileFits(sp, m.terrain[i])) tiles.push(i); }
      if (!tiles.length) return { ok: false };
      if (!this.spend(150, 'animais')) return { ok: false, reason: 'Dinheiro insuficiente' };
      const [x, y] = m.xy(U.pick(tiles));
      a.encId = encId; a.x = x + 0.5; a.y = y + 0.5; a.path = null; a.state = 'IDLE'; a.actT = 0; a.stress = Math.min(100, a.stress + 20);
      this.aggregate();
      return { ok: true };
    }

    /* =================== funcionários =================== */
    spawnPoint() {
      const ea = this.entranceAccess();
      if (ea >= 0) return this.map.xy(ea);
      if (this.pathTiles.length) return this.map.xy(this.pathTiles[0]);
      return [Math.floor(this.map.w / 2), this.map.h - 3];
    }
    hireStaff(role) {
      const r = ZM.STAFF_ROLES[role];
      if (!this.spend(r.hire, 'contratacao')) return { ok: false, reason: 'Dinheiro insuficiente' };
      const [x, y] = this.spawnPoint();
      const s = new ZM.Staff(role, x, y);
      this.staff.push(s);
      ZM.Audio.play('cash');
      return { ok: true, staff: s };
    }
    fireStaff(id) {
      const s = this.staff.find((x) => x.id === id); if (!s) return;
      s.endTask(this);
      this.staff = this.staff.filter((x) => x !== s);
    }

    /* =================== tarefas / reservas =================== */
    canReserve(key, id) {
      const h = this.reservations.get(key);
      if (h == null || h === id) return true;
      if (!this.staff.some((s) => s.id === h && s.task && s.task.key === key)) { this.reservations.delete(key); return true; }
      return false;
    }
    reserve(key, id) { this.reservations.set(key, id); }
    release(key, id) { if (this.reservations.get(key) === id) this.reservations.delete(key); }
    markUnreachable(key) { this.unreachable.set(key, this.absMinutes + 90); }
    isUnreachable(key) { const t = this.unreachable.get(key); if (t == null) return false; if (t < this.absMinutes) { this.unreachable.delete(key); return false; } return true; }

    requestPath(start, goal, canStep, maxNodes) {
      if (this.pathBudget <= 0) return undefined;
      this.pathBudget--;
      return this.pf.find(start, goal, canStep, maxNodes || 4000);
    }
    requestNearest(start, pred, canStep, maxNodes) {
      if (this.pathBudget <= 0) return undefined;
      this.pathBudget--;
      return this.pf.nearest(start, pred, canStep, maxNodes);
    }
    /* serviços aos visitantes: js/systems/services.js */

    /* =================== recálculos =================== */
    refreshAll() {
      const m = this.map;
      this.pathTiles = [];
      for (let i = 0; i < m.N; i++) if (m.path[i]) this.pathTiles.push(i);
      // caminhos encostados em cada objeto (accessRaw) e só os ligados à entrada (access)
      this.objects.forEach((o) => {
        o.accessRaw = [];
        const add = (x, y) => { if (m.inb(x, y)) { const i = m.idx(x, y); if (m.path[i]) o.accessRaw.push(i); } };
        for (let x = o.x; x < o.x + o.w; x++) { add(x, o.y - 1); add(x, o.y + o.h); }
        for (let y = o.y; y < o.y + o.h; y++) { add(o.x - 1, y); add(o.x + o.w, y); }
      });
      this.kindCache = null;
      ZM.Access.compute(this);
      this.objects.forEach((o) => { o.access = o.def.kind === 'entrance' ? o.accessRaw.slice() : o.accessRaw.filter((i) => this.connected[i]); });
      this.routesDirty = true;
      // decoração
      this.decorMap.fill(0);
      this.objects.forEach((o) => {
        const dv = o.def.decor; if (!dv || o.def.inEnc) return;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const x = o.x + dx, y = o.y + dy;
          if (m.inb(x, y)) this.decorMap[m.idx(x, y)] += dv / (1 + Math.abs(dx) + Math.abs(dy));
        }
      });
      this.enclosures.forEach((e) => e.computeStats(this));
      this.recomputeMods();
      this.unreachable.clear();
      this.objects.forEach((o) => (o._unreach = 0));
      this.aggregate();
      ZM.Events.emit('worldChanged');
    }

    recomputeMods() {
      this.mods = { ...ZM.BASE_MODS };
      this.research.done.forEach((id) => {
        const mods = ZM.RESEARCH[id].effect.mods || {};
        Object.keys(mods).forEach((k) => (this.mods[k] *= mods[k]));
      });
      // prédios de apoio (cada tipo conta uma vez; precisam estar funcionando)
      const has = (type) => [...this.objects.values()].some((o) => o.type === type && !o.broken);
      if (has('workshop')) { this.mods.decay *= 0.75; this.mods.repairSpeed *= 2; }
      if (has('warehouse')) { this.mods.foodCost *= 0.85; this.mods.feedSpeed *= 1.6; }
      if (has('genelab')) { this.mods.breeding *= 1.3; this.mods.cpMult *= 1.25; }
      if (has('staffroom')) this.mods.workSpeed *= 1.15;
    }

    /* agregados por recinto usados pela IA (rápido) */
    aggregate() {
      let attraction = 0;
      this.enclosures.forEach((e) => { e.animalCount = 0; e._sp = {}; e._w = 0; e.predatorMix = false; });
      this.animals.forEach((a) => {
        if (a.escaped) return;
        const e = this.enclosures.get(a.encId); if (!e) return;
        e.animalCount++; e._w += a.welfare;
        e._sp[a.species] = (e._sp[a.species] || 0) + 1;
      });
      this.enclosures.forEach((e) => {
        let att = 0; const sps = Object.keys(e._sp);
        sps.forEach((s) => { att += ZM.SPECIES[s].popularity * Math.sqrt(Math.min(e._sp[s], 5)) / 1.6; });
        const w = e.animalCount ? e._w / e.animalCount : 0;
        e.attraction = att * (0.4 + w / 100) * (e.stats.views && e.stats.views.length ? 1 : 0) * (e.stats.viewer && e.stats.water ? 1.4 : 1);
        e.avgWelfare = w;
        e.predatorMix = sps.length > 1 && sps.some((s) => ZM.SPECIES[s].predator && !ZM.SPECIES[s].aquaticGroup);
        attraction += e.attraction;
      });
      // diversidade vale mais que quantidade
      this.attraction = attraction * (0.8 + Math.min(0.6, this.speciesList().length * 0.05));
      this.enclosures.forEach((e) => this.assignFeeders(e));
    }

    /* define que comida cada comedouro deve receber (configuração manual ou automática) */
    assignFeeders(e) {
      const feeders = (e.stats.feeders || []).map((id) => this.objects.get(id)).filter(Boolean);
      const land = {}, water = {};
      this.animals.forEach((a) => {
        if (a.encId !== e.id || a.escaped) return;
        const f = a.sp.food;
        if (!a.sp.waterOnly) land[f] = (land[f] || 0) + 1;
        if (a.sp.waterOnly || a.sp.swims) water[f] = (water[f] || 0) + 1;
      });
      const assign = (list, needs) => {
        const fixed = new Set(list.filter((o) => o.foodSetting && o.foodSetting !== 'auto').map((o) => o.foodSetting));
        list.forEach((o) => { if (o.foodSetting && o.foodSetting !== 'auto') o.wantType = o.foodSetting; });
        const autos = list.filter((o) => !o.foodSetting || o.foodSetting === 'auto').sort((a, b) => a.id - b.id);
        const all = Object.keys(needs).sort((a, b) => needs[b] - needs[a]);
        let open = all.filter((f) => !fixed.has(f));
        if (!open.length) open = all;
        autos.forEach((o, k) => {
          // mantém o tipo atual se ainda for necessário e houver comida, evitando trocas desnecessárias
          if (o.foodType && open.includes(o.foodType) && o.food > 20 && autos.filter((x) => x.wantType === o.foodType).length < Math.ceil(autos.length / open.length)) { o.wantType = o.foodType; return; }
          o.wantType = open.length ? open[k % open.length] : null;
        });
      };
      assign(feeders.filter((o) => !o.def.onWater), land);
      assign(feeders.filter((o) => o.def.onWater), water);
      const served = new Set(feeders.map((o) => o.wantType).filter(Boolean));
      e.dietMissing = Object.keys({ ...land, ...water }).filter((f) => !served.has(f));
    }

    /* =================== simulação =================== */
    update(dtReal) {
      this.updateFloaters(dtReal);
      if (this.speed <= 0) return;
      this.acc += Math.min(dtReal, 0.25) * this.speed;
      let n = 0;
      while (this.acc >= C.SIM_STEP && n < 40) { this.tick(C.SIM_STEP); this.acc -= C.SIM_STEP; n++; }
    }

    tick(dt) {
      this.pathBudget = C.PATH_BUDGET;
      if (this.routesDirty) { this.routesDirty = false; this.revalidateRoutes(); }
      const prevHour = Math.floor(this.minute / 60);
      this.minute += dt * C.MIN_PER_SEC;
      if (this.minute >= 1440) { this.minute -= 1440; this.endOfDay(); this.day++; this.startOfDay(); }
      const h = Math.floor(this.minute / 60);
      if (h !== prevHour) this.hourly(h);

      this.spawnVisitors(dt);
      for (let i = 0; i < this.animals.length; i++) this.animals[i].update(this, dt);
      for (let i = 0; i < this.staff.length; i++) this.staff[i].update(this, dt);
      for (let i = 0; i < this.visitors.length; i++) {
        const v = this.visitors[i];
        v.update(this, dt);
      }
      if (this.visitors.some((v) => v.gone)) this.visitors = this.visitors.filter((v) => !v.gone);
      // mortes
      if (this.animals.some((a) => a.health <= 0)) {
        this.animals.filter((a) => a.health <= 0).forEach((a) => {
          this.stats.deaths++;
          this.reputation = Math.max(0, this.reputation - 0.4);
          this.alert(`🕊️ ${a.name} (${a.sp.name}) morreu por falta de cuidados. A reputação caiu.`, 'danger');
        });
        this.animals = this.animals.filter((a) => a.health > 0);
      }
      this.periodicT -= dt;
      if (this.periodicT <= 0) { this.periodicT = 1; this.periodic(); }
    }

    /* depois de qualquer mudança no mapa, rotas que passam por tiles agora proibidos são descartadas */
    revalidateRoutes() {
      const m = this.map;
      const bad = (ag, canStep) => {
        if (!ag.path) return false;
        let prev = ag.tileIdx(m);
        for (let k = ag.pi; k < ag.path.length; k++) {
          const b = ag.path[k];
          if (b !== prev && !canStep(prev, b)) return true;
          prev = b;
        }
        return false;
      };
      this.visitors.forEach((v) => {
        if (v.recovering || !bad(v, v.canStepFn(this))) return;
        v.path = null; v.goal = null; v.actT = 0;
        if (v.state !== 'LEAVE' && v.state !== 'FLEE') v.state = 'IDLE';
        v.thinkT = 0;
      });
      this.staff.forEach((s) => {
        if (!bad(s, s.canStepFn(this, s.task ? s.task.encId || 0 : 0))) return;
        s.endTask(this); s.thinkT = 0;
      });
      this.animals.forEach((a) => {
        const fn = a.state === 'RETURN' ? a.returnStepFn(this) : a.canStepFn(this);
        if (!bad(a, fn)) return;
        a.path = null; a.goal = null; a.actT = 0; a.thinkT = 0;
        if (!a.escaped) a.state = 'IDLE';
      });
    }

    spawnVisitors(dt) {
      const h = this.hour;
      if (!this.open || h < C.OPEN_HOUR || h >= C.LAST_ENTRY_HOUR) return;
      const ea = this.entranceAccess();
      if (ea < 0 || this.visitors.length >= C.MAX_VISITORS) return;
      this.spawnAcc += this.spawnRate() * (dt * C.MIN_PER_SEC) / 60;
      while (this.spawnAcc >= 1) {
        this.spawnAcc -= 1;
        const [x, y] = this.map.xy(ea);
        const v = new ZM.Visitor(x, y);
        const fair = this.fairPrice();
        if (this.ticketPrice > fair * 1.35) { v.happiness -= 10; v.think2(`Ingresso de ${U.money(this.ticketPrice)} é caro!`, '💸', -1); }
        else if (this.ticketPrice < fair * 0.7) { v.happiness += 5; v.think2('Ingresso baratinho!', '👍', 1); }
        v.money = Math.max(0, v.money - (v.kid ? 0 : 0));
        this.earn(this.ticketPrice * (v.kid ? 0.5 : 1), 'ingressos');
        this.visitors.push(v);
        this.stats.totalVisitors++; this.stats.visitorsToday++;
      }
    }
    spawnRate() {
      const fair = this.fairPrice();
      const base = 1.5 + this.attraction * 0.6;
      const rep = 0.5 + this.reputation * 0.25;
      const price = U.clamp(1.45 - 0.75 * (this.ticketPrice / fair), 0.06, 1.4);
      const h = this.hour;
      const time = 0.55 + 0.6 * Math.max(0, Math.sin(((h - C.OPEN_HOUR) / (C.LAST_ENTRY_HOUR - C.OPEN_HOUR)) * Math.PI));
      const weekend = (this.day % 7 === 6 || this.day % 7 === 0) ? 1.35 : 1;
      return base * rep * price * time * weekend * this.events.modifier('spawn') * this.mods.spawn * (this.scenario.spawnBonus || 1);
    }

    /* a cada segundo de simulação */
    periodic() {
      this.events.update();
      // visitantes por recinto + fugas
      this.aggregate();
      this.countViewers();
      this.enclosures.forEach((e) => {
        e.needFood = this.animals.some((a) => a.encId === e.id && a.hunger > 60);
        e.needWater = this.animals.some((a) => a.encId === e.id && a.thirst > 60);
      });
      // área isolada ao redor de animais fugitivos
      const esc = this.animals.filter((a) => a.escaped);
      const m = this.map;
      if (esc.length || this._hadClosed) {
        m.closed.fill(0);
        esc.forEach((a) => {
          for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
            const x = a.tx() + dx, y = a.ty() + dy;
            if (m.inb(x, y) && Math.abs(dx) + Math.abs(dy) <= 5) m.closed[m.idx(x, y)] = 1;
          }
          this.visitors.forEach((v) => { if (U.dist(v.x, v.y, a.x, a.y) < 5) v.flee(this); });
          if (a.state === 'ESCAPED' && !this.staffCount('security') && this.absMinutes - (a.escapedAt || 0) > 180) {
            this.spend(3000, 'multas', true);
            a.tranquilize(); a.state = 'RETURN'; a.tranq = 0;
            this.alert(`🚑 Sem seguranças, uma equipe externa capturou ${a.name}. Custo: ${U.money(3000)}.`, 'warn', a);
          }
        });
        this._hadClosed = esc.length > 0;
      }
      this.missions.check();
    }
    countViewers() {
      const m = this.map;
      this.enclosures.forEach((e) => (e.visitorsNear = 0));
      this.visitors.forEach((v) => {
        if (v.state !== 'VIEW') return;
        const x = v.tx(), y = v.ty();
        [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
          if (!m.inb(x + dx, y + dy)) return false;
          const id = m.enc[m.idx(x + dx, y + dy)];
          if (id) { const e = this.enclosures.get(id); if (e) e.visitorsNear++; return true; }
          return false;
        });
      });
    }

    hourly(h) {
      const m = this.mods;
      // desgaste
      this.enclosures.forEach((e) => {
        let dirt = 0;
        this.animals.forEach((a) => { if (a.encId === e.id && !a.escaped && !a.sp.waterOnly) dirt += 1.1 * a.sp.size; });
        e.cleanliness = U.clamp(e.cleanliness - dirt * 25 / Math.max(9, e.area) * 1.0, 0, 100);
        const big = e.animalCount ? 1 + Math.max(...e.animalsIn(this).map((a) => a.sp.size)) * 0.3 : 1;
        e.condition = U.clamp(e.condition - 0.35 * ZM.FENCES[e.fence].decay * m.decay * big, 0, 100);
        // qualidade da água: animais que nadam sujam, filtros limpam
        if (e.stats.water) {
          let load = 0;
          this.animals.forEach((a) => { if (a.encId === e.id && !a.escaped && (a.sp.swims || a.sp.wades)) load += a.sp.size * (a.sp.waterOnly ? 1.4 : 0.8); });
          const filters = e.stats.filters.filter((id) => { const o = this.objects.get(id); return o && !o.broken; }).length;
          const cap = filters * 25;
          const clean = filters ? Math.min(1, cap / e.stats.water) * 9 + 1 : 0.3;
          e.waterQuality = U.clamp(e.waterQuality - load * 40 / Math.max(6, e.stats.water) + clean, 0, 100);
        }
      });
      if (h % 6 === 0) this.recomputeMods();
      this.objects.forEach((o) => {
        if (o.condition == null) return;
        const use = o.def.kind === 'shop' || o.def.kind === 'toilet' ? 0.5 : 0.2;
        o.condition = U.clamp(o.condition - use * m.decay, 0, 100);
        if (o.condition < 15 && !o.broken) { o.broken = true; this.alertOnce('broken' + o.id, 12, `🔧 ${o.def.name} quebrou por falta de manutenção.`, 'warn', o); }
      });
      this.events.hourly();
      if (h === 7) this.events.daily();
      // educação e reputação (suavizadas)
      const vt = Math.max(8, this.stats.visitorsToday);
      const eduT = U.clamp((this.stats.eduToday / vt) * 60, 0, 100);
      if (this.stats.visitorsToday > 0) this.education += (eduT - this.education) * 0.08;
      this.updateReputation(0.02);
      if (h % 3 === 0) this.problemScan();
    }

    reputationTarget() {
      const sat = this.stats.satAvg / 20;
      const welf = this.animals.length ? this.avgWelfare() / 20 : 1;
      const edu = this.education / 20;
      const litter = this.pathCount ? this.totalLitter() / this.pathCount : 0;
      const clean = U.clamp(5 - litter * 3, 0, 5);
      const variety = U.clamp(this.speciesList().length * 0.6 + this.stats.cpEarned / 40, 0, 5);
      return 0.3 * sat + 0.3 * welf + 0.12 * edu + 0.1 * clean + 0.18 * variety;
    }
    updateReputation(rate) {
      const t = this.reputationTarget();
      this.reputation = U.clamp(this.reputation + (t - this.reputation) * rate, 0, 5);
    }

    startOfDay() {
      this.stats.visitorsToday = 0; this.stats.exitsToday = 0; this.stats.complaintsToday = 0; this.stats.photosToday = 0; this.stats.eduToday = 0;
      this.objects.forEach((o) => { if (o.def.kind === 'shop' || o.def.kind === 'toilet') { o.salesToday = 0; o.revenueToday = 0; o.gaveUpToday = 0; } });
      this.events.active.forEach((e) => { if (e.sponsor) this.earn(e.sponsor, 'patrocinio'); });
    }
    endOfDay() {
      // salários e operação
      let sal = 0; this.staff.forEach((s) => (sal += s.salary));
      this.spend(sal, 'salarios', true);
      let up = 0; this.objects.forEach((o) => (up += o.def.upkeep || 0));
      up += this.enclosures.size * 20;
      this.spend(up * this.mods.utility, 'energia', true);
      // cuidados diários por animal (suplementos, exames, enriquecimento)
      let care = 0; this.animals.forEach((a) => (care += Math.max(6, a.sp.price * 0.004)));
      this.spend(care, 'cuidados', true);
      // conservação
      let cpDay = 0;
      this.animals.forEach((a) => {
        if (a.sp.status !== 'LC' && a.welfare >= 70 && !a.escaped) cpDay += ZM.STATUS[a.sp.status].cp * 0.2;
      });
      if (this.education > 50) cpDay += 1;
      cpDay *= this.mods.cpMult;
      if (cpDay > 0) { this.addCP(cpDay); this.earn(Math.round(cpDay * 40), 'conservacao'); }
      this.breeding();
      this.updateReputation(0.12);
      this.dayStats = { profit: this.econ.totals().profit, welfare: this.avgWelfare(), sat: this.stats.satAvg };
      this.missions.endOfDay();
      const rec = this.econ.endDay(this);
      if (rec.profit > this.stats.bestDayProfit) this.stats.bestDayProfit = rec.profit;
      ZM.Events.emit('dayEnd', rec);
      if (!this.sandbox && this.money < 0) this.alert(`⚠️ O caixa está negativo (${U.money(this.money)}). Reduza custos ou aumente a receita!`, 'danger');
    }
    addCP(v) { this.cp += v; this.stats.cpEarned += v; }

    breeding() {
      this.enclosures.forEach((e) => {
        const list = e.animalsIn(this);
        const bySp = {};
        list.forEach((a) => (bySp[a.species] = bySp[a.species] || []).push(a));
        Object.keys(bySp).forEach((sid) => {
          const sp = ZM.SPECIES[sid], g = bySp[sid];
          // gestação
          g.forEach((f) => {
            if (f.pregnant > 0) {
              f.pregnant--;
              if (f.pregnant <= 0) this.birth(f, e);
            }
          });
          if (g.length >= sp.group[1]) return;
          const males = g.filter((a) => a.sex === 'M' && !a.isBaby);
          const fem = g.filter((a) => a.sex === 'F' && !a.isBaby && !a.pregnant && this.day - a.lastBirthDay > sp.gestation * 2);
          if (!males.length || !fem.length) return;
          const w = g.reduce((s, a) => s + a.welfare, 0) / g.length;
          const space = fem[0].wb.space || 0;
          if (w < 72 || space < 85) return;
          if (Math.random() < 0.3 * this.mods.breeding) {
            const f = U.pick(fem);
            f.pregnant = sp.gestation;
            this.alert(`💕 ${f.name} (${sp.name}) está esperando filhote(s)!`, 'good', f);
          }
        });
      });
    }
    birth(mother, enc) {
      const sp = mother.sp;
      const n = U.randInt(sp.litter[0], sp.litter[1]);
      for (let i = 0; i < n; i++) {
        const a = new ZM.Animal(sp.id, enc.id, mother.tx(), mother.ty(), { ageDays: 0, born: true });
        a.hunger = 10; a.thirst = 10; a.welfare = mother.welfare; a.checkedDay = this.day;
        this.animals.push(a);
      }
      mother.lastBirthDay = this.day;
      this.stats.births += n;
      const st = ZM.STATUS[sp.status];
      let cpGain = st.cp * 2 * n * this.mods.cpMult;
      if (sp.status !== 'LC' && sp.status !== 'NT') this.stats.threatenedBirths += n;
      this.addCP(cpGain);
      this.reputation = Math.min(5, this.reputation + 0.05 * n);
      this.alert(`🍼 Nasceu${n > 1 ? 'ram' : ''} ${n} filhote${n > 1 ? 's' : ''} de ${sp.name}! +${Math.round(cpGain)} Pontos de Conservação.`, 'good', mother);
      ZM.Audio.play('birth');
      this.aggregate();
    }

    /* =================== fugas =================== */
    onEscape(a, e) {
      a.escapedAt = this.absMinutes;
      this.stats.escapes++;
      this.reputation = Math.max(0, this.reputation - 0.25);
      this.alert(`🚨 FUGA! ${a.name} (${a.sp.name}) escapou do ${e.name}! Área isolada — protocolo de emergência ativado.`, 'danger', a);
      ZM.Audio.play('danger');
      ZM.Events.emit('escape', a);
    }
    onAnimalReturned(a) {
      if (this.staffCount('vet')) a.checkedDay = -99;
      this.alert(`✅ ${a.name} voltou ao recinto em segurança. Protocolo encerrado.`, 'good', a);
      ZM.Events.emit('escape', a);
    }

    /* =================== visitantes =================== */
    onVisitorExit(v) {
      this.stats.exitsToday++;
      // satisfação = felicidade comparada à expectativa (cresce com reputação e preço)
      const expect = 45 + this.reputation * 6 + Math.max(0, this.ticketPrice - this.fairPrice()) * 1.5;
      const sat = U.clamp(55 + (v.happiness - expect) * 1.2, 0, 100);
      v.satisfaction = sat;
      this.stats.satAvg = this.stats.satAvg * 0.95 + sat * 0.05;
      if (v.satisfaction > 70 && Math.random() < 0.35) { const d = U.randInt(2, 15); this.earn(d, 'doacoes'); }
    }

    /* =================== alertas =================== */
    alert(text, type = 'info', target) {
      const a = { text, type, day: this.day, time: U.timeStr(this.minute), target: target ? { kind: target instanceof ZM.Animal ? 'animal' : target instanceof ZM.ZooObject ? 'object' : 'other', id: target.id, x: target.x, y: target.y } : null };
      this.alerts.unshift(a);
      if (this.alerts.length > 80) this.alerts.pop();
      ZM.Events.emit('alert', a);
    }
    alertOnce(key, hours, text, type, target) {
      const t = this.alertTimes[key];
      if (t != null && this.absMinutes - t < hours * 60) return;
      this.alertTimes[key] = this.absMinutes;
      this.alert(text, type, target);
    }
    problemScan() {
      const keepers = this.staffCount('keeper');
      if (this.animals.length && !keepers) this.alertOnce('nokeeper', 8, '⚠️ Ninguém está cuidando dos animais! Contrate um tratador.', 'warn');
      this.enclosures.forEach((e) => {
        const n = e.animalCount;
        if (!n) return;
        if (!e.gate) this.alertOnce('gate' + e.id, 8, `⚠️ ${e.name} não tem portão: encoste um caminho na cerca.`, 'warn');
        if (!e.stats.feeders.length) this.alertOnce('feed' + e.id, 8, `⚠️ ${e.name} não tem comedouro.`, 'warn');
        else if (e.dietMissing && e.dietMissing.length) this.alertOnce('diet' + e.id, 8, `🍽️ ${e.name}: falta comedouro para ${e.dietMissing.map((f) => ZM.FOOD[f].name.toLowerCase()).join(', ')}. Adicione um comedouro ou ajuste o alimento de um existente.`, 'warn');
        if (!e.stats.troughs.length && !e.stats.water) this.alertOnce('wat' + e.id, 8, `⚠️ ${e.name} não tem bebedouro nem água.`, 'warn');
        if (this.animals.some((a) => a.encId === e.id && a.hunger > 80)) this.alertOnce('hungry' + e.id, 6, `⚠️ Animais com fome no ${e.name}.`, 'warn');
        if (e.cleanliness < 35) this.alertOnce('dirty' + e.id, 8, `⚠️ ${e.name} está sujo.`, 'warn');
        const need = Math.max(0, ...e.animalsIn(this).filter((a) => !a.sp.waterOnly).map((a) => a.sp.fence));
        if (need > ZM.FENCES[e.fence].level) this.alertOnce('fence' + e.id, 12, `⚠️ A cerca do ${e.name} é fraca demais para essas espécies! Risco de fuga.`, 'danger');
        if (e.condition < 40) this.alertOnce('cond' + e.id, 8, `⚠️ Cerca danificada no ${e.name}. Contrate um técnico de manutenção.`, 'warn');
        const list = e.animalsIn(this);
        if (list.some((a) => a.sp.tank) && !ZM.FENCES[e.fence].watertight) this.alertOnce('tank' + e.id, 12, `⚠️ ${e.name}: animais de tanque precisam de Parede de aquário (estanque).`, 'warn');
        if (e.stats.water && list.some((a) => a.sp.swims) && !e.stats.filters.length) this.alertOnce('filt' + e.id, 12, `⚠️ ${e.name} não tem filtro d'água: a qualidade da água vai cair.`, 'warn');
        if (e.stats.water && e.waterQuality < 45) this.alertOnce('wq' + e.id, 8, `💧 Água ruim no ${e.name} (${Math.round(e.waterQuality)}%). Adicione filtros ou conserte os existentes.`, 'warn');
        if (list.some((a) => a.sp.cold) && !e.stats.icemakers.length) this.alertOnce('ice' + e.id, 12, `🧊 ${e.name}: animais polares precisam de Máquina de gelo.`, 'warn');
        if (list.some((a) => a.sp.waterOnly) && !e.stats.feeders.some((id) => this.objects.get(id)?.def.onWater)) this.alertOnce('aqf' + e.id, 12, `🐟 ${e.name}: animais que só nadam precisam de Comedouro aquático sobre a água.`, 'warn');
        if (e.predatorMix) this.alertOnce('mix' + e.id, 12, `⚠️ Predadores e presas no mesmo recinto (${e.name}) causam estresse!`, 'warn');
      });
      if (this.animals.some((a) => a.sick) && !this.staffCount('vet')) this.alertOnce('novet', 6, '⚠️ Há animais doentes: veterinário necessário!', 'danger');
      if (!this.sandbox && this.money < 1500 && this.money >= 0) this.alertOnce('money', 12, '⚠️ Caixa do zoológico baixa.', 'warn');
      if (this.totalLitter() > 25 && !this.staffCount('janitor')) this.alertOnce('litter', 8, '⚠️ Caminhos sujos de lixo. Contrate um faxineiro e coloque lixeiras.', 'warn');
      if (this.objectsOfKind('lab').length && this.staffCount('researcher') && !this.research.active) this.alertOnce('resIdle', 8, '🔬 Pesquisadores sem projeto. Escolha uma pesquisa!', 'info');
      if (this.staffCount('researcher') && !this.objectsOfKind('lab').length) this.alertOnce('nolab', 8, '🔬 Pesquisadores precisam de um Centro de Pesquisa.', 'warn');
      if (this.visitors.length > 12 && !this.objectsOfKind('toilet').length) this.alertOnce('toilet', 8, '🚻 Visitantes procurando banheiro!', 'warn');
      if (this.open && !this.entranceConnected()) this.alertOnce('entr', 6, '⚠️ A entrada não está ligada a um caminho.', 'warn');
    }

    floatText(x, y, text, color) { if (this.floaters.length < 60) this.floaters.push({ x, y, text, color, t: 0 }); }
    updateFloaters(dt) {
      this.floaters.forEach((f) => (f.t += dt));
      if (this.floaters.length) this.floaters = this.floaters.filter((f) => f.t < 1.6);
    }

    /* =================== salvar / carregar =================== */
    serialize() {
      return {
        v: ZM.SAVE_VERSION, scenarioId: this.scenarioId, money: this.sandbox ? null : this.money, day: this.day, minute: this.minute,
        open: this.open, ticketPrice: this.ticketPrice, reputation: this.reputation, education: this.education, cp: this.cp,
        stats: this.stats, econ: this.econ.toJSON(), research: this.research.toJSON(), events: this.events.toJSON(),
        missions: this.missions.toJSON(), map: this.map.toJSON(),
        objects: [...this.objects.values()].map((o) => o.toJSON()),
        enclosures: [...this.enclosures.values()].map((e) => e.toJSON()),
        animals: this.animals.map((a) => a.toJSON()), staff: this.staff.map((s) => s.toJSON()),
        visitors: this.visitors.filter((v) => !v.gone).map((v) => v.toJSON()),
        spawnAcc: this.spawnAcc, alertTimes: this.alertTimes,
        nextEncId: this.nextEncId, uid: U.getUid(), savedAt: Date.now(),
      };
    }
    static deserialize(d) {
      const z = new Zoo(d.scenarioId, { empty: true });
      z.map = ZM.ZooMap.fromJSON(d.map);
      z.pf = new ZM.Pathfinder(z.map);
      z.decorMap = new Float32Array(z.map.N);
      z.map.obj.fill(-1);
      z.money = d.money == null ? Infinity : d.money;
      ['day', 'minute', 'open', 'ticketPrice', 'reputation', 'education', 'cp', 'nextEncId'].forEach((k) => { if (d[k] != null) z[k] = d[k]; });
      Object.assign(z.stats, d.stats || {});
      z.econ = ZM.Economy.fromJSON(d.econ);
      z.research.load(d.research);
      z.events.load(d.events);
      z.missions.load(d.missions);
      U.setUid(d.uid || 1);
      (d.enclosures || []).forEach((e) => z.enclosures.set(e.id, ZM.Enclosure.fromJSON(e)));
      (d.objects || []).forEach((od) => { const o = ZM.ZooObject.fromJSON(od); z.placeObject(o.type, o.x, o.y, { free: true, silent: true, restore: o }); });
      (d.animals || []).forEach((ad) => {
        const a = ZM.Animal.fromJSON(ad);
        const e = z.enclosures.get(a.encId);
        if (!e) return;
        const inside = e.contains(Math.floor(a.x), Math.floor(a.y));
        const onMap = z.map.inb(Math.floor(a.x), Math.floor(a.y));
        if (a.escaped && !inside && onMap) { /* continua fugitivo onde estava */ }
        else if (!inside) { const [cx, cy] = e.center(); a.x = cx; a.y = cy; a.escaped = false; a.state = 'IDLE'; }
        else if (a.escaped) { a.escaped = false; a.state = 'IDLE'; }
        z.animals.push(a);
      });
      (d.staff || []).forEach((sd) => z.staff.push(ZM.Staff.fromJSON(sd)));
      (d.visitors || []).forEach((vd) => { const v = ZM.Visitor.fromJSON(vd); if (z.map.inb(Math.floor(v.x), Math.floor(v.y))) z.visitors.push(v); });
      if (d.spawnAcc) z.spawnAcc = d.spawnAcc;
      if (d.alertTimes) z.alertTimes = d.alertTimes;
      z.recomputeMods();
      z.refreshAll();
      z.undo.clear();
      return z;
    }
  }
  ZM.Zoo = Zoo;
})(window.ZM);
