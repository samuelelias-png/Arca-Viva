/* =========================================================
   Cenários: tutorial, campanha e modo livre
   Cada objetivo: { text, check(zoo) -> bool, prog(zoo) -> [atual, meta] }
   ========================================================= */
(function (ZM) {
  'use strict';

  const encWith = (zoo, fn) => [...zoo.enclosures.values()].some(fn);

  const G = {
    entrance: { text: 'Construa a Entrada (Construção ▸ Entrada)', hl: 'build', hint: 'Abra CONSTRUÇÃO e posicione a Entrada perto da borda do mapa.', check: (z) => z.countObjects('entrance') > 0 },
    path: { text: 'Crie um caminho ligado à entrada (6+ tiles)', hl: 'path', hint: 'Abra CAMINHOS e arraste a partir da entrada.', check: (z) => z.pathCount >= 6 && z.entranceConnected(), prog: (z) => [Math.min(z.pathCount, 6), 6] },
    enclosure: { text: 'Construa um recinto ao lado do caminho', hl: 'build', hint: 'Em CONSTRUÇÃO escolha uma cerca e arraste um retângulo encostado no caminho (o portão aparece sozinho).', check: (z) => z.enclosures.size > 0 },
    plants: { text: 'Adicione 3 plantas dentro do recinto', hl: 'nature', hint: 'Em NATUREZA, coloque árvores, arbustos ou capim dentro do recinto.', check: (z) => encWith(z, (e) => e.stats.plants >= 3), prog: (z) => [Math.max(0, ...[...z.enclosures.values()].map((e) => Math.min(3, e.stats.plants))), 3] },
    trough: { text: 'Coloque um bebedouro (ou lago) no recinto', hl: 'build', hint: 'Em CONSTRUÇÃO ▸ Itens de recinto, coloque um Bebedouro.', check: (z) => encWith(z, (e) => e.stats.troughs.length > 0 || e.stats.water > 0) },
    feeder: { text: 'Coloque um comedouro no recinto', hl: 'build', hint: 'Em CONSTRUÇÃO ▸ Itens de recinto, coloque um Comedouro.', check: (z) => encWith(z, (e) => e.stats.feeders.length > 0) },
    capys: { text: 'Compre duas capivaras', hl: 'animals', hint: 'Abra ANIMAIS, escolha a Capivara e clique dentro do recinto (duas vezes).', check: (z) => z.countSpecies('capivara') >= 2, prog: (z) => [Math.min(2, z.countSpecies('capivara')), 2] },
    keeper: { text: 'Contrate um tratador', hl: 'staff', hint: 'Abra FUNCIONÁRIOS e contrate um Tratador.', check: (z) => z.staffCount('keeper') > 0 },
    open: { text: 'Abra o zoológico', hl: 'open', hint: 'Clique no botão "Fechado" na barra superior para abrir.', check: (z) => z.open },
    v50: { text: 'Receba 50 visitantes', hint: 'Acelere o tempo (⏩) e acompanhe a satisfação. Lojas e banheiros ajudam!', check: (z) => z.stats.totalVisitors >= 50, prog: (z) => [Math.min(50, z.stats.totalVisitors), 50] },
  };

  const num = (text, get, goal) => ({ text, check: (z) => get(z) >= goal, prog: (z) => [Math.min(goal, Math.floor(get(z))), goal] });


  /* ---------- construtor dos mapas iniciais de cada fase ---------- */
  const B = {
    clear(z, x0, y0, x1, y1) {
      const m = z.map;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (!m.inb(x, y)) continue;
        const i = m.idx(x, y);
        if (m.obj[i] >= 0) z.removeObjectSilent(m.obj[i]);
        m.terrain[i] = ZM.T.GRASS; m.path[i] = 0;
      }
    },
    path(z, x0, y0, x1, y1) { const m = z.map; for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) if (m.inb(x, y) && !m.enc[m.idx(x, y)]) { const i = m.idx(x, y); if (m.obj[i] >= 0) z.removeObjectSilent(m.obj[i]); m.path[i] = 1; } },
    paint(z, x0, y0, x1, y1, t) { const m = z.map; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (m.inb(x, y)) m.terrain[m.idx(x, y)] = t; },
    obj(z, type, x, y, props) { const r = z.placeObject(type, x, y, { free: true, silent: true }); if (r.ok && props) Object.assign(r.obj, props); return r.obj; },
    enc(z, x0, y0, x1, y1, fence, props) { const r = z.createEnclosure(x0, y0, x1, y1, fence, { free: true }); if (r.ok && props) Object.assign(r.enc, props); return r.enc; },
    animals(z, e, sp, n, props) { const out = []; for (let k = 0; k < n; k++) { const r = z.buyAnimal(sp, e.id, { sex: k % 2 ? 'F' : 'M' }); if (r.ok) { if (props) Object.assign(r.animal, typeof props === 'function' ? props(r.animal, k) : props); out.push(r.animal); } } return out; },
    litter(z, n) { const t = z.pathTiles; for (let k = 0; k < n && t.length; k++) { const i = t[Math.floor(Math.random() * t.length)]; z.map.litter[i] = Math.min(10, z.map.litter[i] + 1 + Math.floor(Math.random() * 3)); } },
    /* monta sem gastar o caixa do cenário */
    build(z, fn) {
      const money = z.money, sb = z.sandbox;
      z.sandbox = true;
      try { fn(); } finally { z.sandbox = sb; z.money = money; z.econ = new ZM.Economy(); z.map.touch(); z.refreshAll(); z.aggregate(); }
    },
    /* contadores usados nos objetivos */
    repairTotal(z) { if (z._repairTotal == null) z._repairTotal = B.brokenCount(z) || 1; return Math.max(z._repairTotal, B.brokenCount(z)); },
    brokenCount(z) { let n = 0; z.objects.forEach((o) => { if (o.broken) n++; }); z.enclosures.forEach((e) => { if (e.condition < 70) n++; }); return n; },
    services(z) { return [...z.objects.values()].filter((o) => ['shop', 'toilet', 'bench', 'info'].includes(o.def.kind)); },
    serviceTotal(z) { return B.services(z).length; },
    isolatedServices(z) { return B.services(z).filter((o) => !o.access.length).length; },

    regional(z) {
      B.build(z, () => {
        B.clear(z, 10, 26, 44, 53);
        z.placeObject('entrance', 26, 50, { free: true, silent: true });
        B.path(z, 27, 30, 27, 49); B.path(z, 15, 38, 40, 38); B.path(z, 16, 30, 38, 30);
        const e1 = B.enc(z, 17, 31, 23, 37, 'wood', { condition: 34, cleanliness: 28, name: 'Recinto das Capivaras' });
        B.paint(z, 18, 35, 19, 36, ZM.T.WATER);
        B.obj(z, 'feeder', 21, 33, { food: 0 }); B.obj(z, 'trough', 22, 36, { water: 5, condition: 12, broken: true }); B.obj(z, 'bush', 18, 32);
        const e2 = B.enc(z, 29, 31, 36, 37, 'wood', { condition: 26, cleanliness: 35, name: 'Recinto das Zebras' });
        B.obj(z, 'feeder', 31, 33, { food: 0, condition: 10, broken: true }); B.obj(z, 'trough', 34, 35, { water: 20 }); B.obj(z, 'acacia', 35, 32);
        const e3 = B.enc(z, 17, 39, 23, 45, 'wood', { condition: 52, cleanliness: 40, name: 'Lago dos Flamingos' });
        B.paint(z, 18, 40, 21, 43, ZM.T.WATER); B.paint(z, 18, 44, 21, 45, ZM.T.SAND);
        B.obj(z, 'feeder', 22, 44, { food: 10 });
        B.obj(z, 'snack', 28, 42, { condition: 8, broken: true }); B.obj(z, 'drinks', 26, 40, { condition: 38 });
        B.obj(z, 'toilet', 28, 45, { condition: 9, broken: true }); B.obj(z, 'bin', 26, 44, { fill: 40 }); B.obj(z, 'bench', 26, 46, {});
        z.refreshAll();
        const sickly = (a, k) => ({ health: k === 1 ? 90 : 72 + Math.random() * 10, hunger: 55 + Math.random() * 15, welfare: 48, ageDays: a.ageDays, sick: k === 1, disease: k === 1 ? 'Verminose' : null });
        B.animals(z, e1, 'capivara', 3, sickly); B.animals(z, e2, 'zebra', 3, (a, k) => sickly(a, k + 5)); B.animals(z, e3, 'flamingo', 4, (a) => ({ hunger: 60, welfare: 50, ageDays: a.ageDays }));
        z.hireStaff('keeper');
        B.litter(z, 45);
      });
      z.ticketPrice = 10;
    },

    grande(z) {
      z.research.done.push('hab1');
      z.recomputeMods();
      B.build(z, () => {
        B.clear(z, 8, 22, 46, 53);
        z.placeObject('entrance', 26, 50, { free: true, silent: true });
        // eixo principal e uma volta longa
        B.path(z, 27, 40, 27, 49); B.path(z, 27, 40, 42, 40); B.path(z, 42, 26, 42, 40); B.path(z, 28, 26, 42, 26);
        // trechos soltos (circulação ruim)
        B.path(z, 10, 44, 16, 44); B.path(z, 14, 37, 22, 37); B.path(z, 36, 46, 40, 46);
        const e1 = B.enc(z, 14, 29, 22, 36, 'wood', { name: 'Recinto das Antas', cleanliness: 70 }); // habitat errado: só grama, sem água
        B.obj(z, 'feeder', 16, 31); B.obj(z, 'trough', 20, 34);
        const e2 = B.enc(z, 29, 31, 36, 39, 'wood', { name: 'Savana', cleanliness: 80 });
        B.paint(z, 29, 31, 32, 34, ZM.T.DIRT); B.obj(z, 'feeder', 31, 36); B.obj(z, 'trough', 34, 33); B.obj(z, 'acacia', 35, 37);
        const e3 = B.enc(z, 29, 21, 37, 25, 'wood', { name: 'Capivaras', cleanliness: 75 });
        B.paint(z, 30, 22, 32, 23, ZM.T.WATER); B.obj(z, 'feeder', 35, 22); B.obj(z, 'bush', 34, 24);
        B.obj(z, 'snack', 12, 45); B.obj(z, 'toilet', 38, 47); B.obj(z, 'bench', 16, 45); B.obj(z, 'drinks', 28, 44); B.obj(z, 'souvenir', 26, 43);
        z.refreshAll();
        B.animals(z, e1, 'anta', 2, (a) => ({ ageDays: ZM.SPECIES.anta.maturity + 2, welfare: 55 }));
        B.animals(z, e2, 'zebra', 4); B.animals(z, e3, 'capivara', 4);
        z.hireStaff('keeper'); z.hireStaff('keeper'); z.hireStaff('janitor');
      });
      z.open = true;
    },

    internacional(z) {
      ['hab1', 'aqua1', 'aqua2'].forEach((r) => z.research.done.push(r));
      z.recomputeMods();
      B.build(z, () => {
        B.clear(z, 6, 14, 50, 53);
        z.placeObject('entrance', 26, 50, { free: true, silent: true });
        B.path(z, 27, 18, 27, 49); B.path(z, 10, 30, 46, 30); B.path(z, 10, 42, 46, 42);
        z.placeObject('aqualab', 12, 44, { free: true, silent: true });
        const rio = z.placePrefab('pf_rio', 28, 20).enc;
        const costa = z.placePrefab('pf_costa', 18, 21).enc;
        [rio, costa].forEach((e) => { e.waterQuality = 48; });
        z.objects.forEach((o) => { if (o.def.kind === 'filter' && Math.random() < 0.6) { o.broken = true; o.condition = 8; } });
        B.animals(z, rio, 'ariranha', 3); B.animals(z, rio, 'peixeboi', 1);
        B.animals(z, costa, 'pinguim', 8); B.animals(z, costa, 'leaomarinho', 2);
        const e1 = B.enc(z, 29, 31, 36, 38, 'metal', { name: 'Savana' });
        B.paint(z, 29, 31, 33, 34, ZM.T.DIRT); B.obj(z, 'feeder', 31, 36); B.obj(z, 'trough', 34, 33); B.obj(z, 'acacia', 35, 37);
        z.refreshAll();
        B.animals(z, e1, 'zebra', 4); B.animals(z, e1, 'girafa', 2);
        B.obj(z, 'snack', 28, 44); B.obj(z, 'drinks', 26, 45); B.obj(z, 'toilet', 28, 47); B.obj(z, 'restaurant', 24, 43);
        z.hireStaff('keeper'); z.hireStaff('keeper'); z.hireStaff('janitor'); z.hireStaff('vet');
      });
      z.open = true;
    },
  };
  ZM.ScenarioBuilder = B;

  ZM.SCENARIOS = {
    tutorial: {
      id: 'tutorial', phase: 1, name: 'Seu primeiro zoológico', subtitle: 'Fase 1 — Zoológico municipal',
      desc: 'A prefeitura cedeu um terreno vazio. Aprenda o básico: entrada, caminhos, recintos, alimentação e visitantes.',
      money: 30000, sequential: true, tutorial: true, rep: 1, spawnBonus: 1.8,
      unlockAll: false,
      goals: [G.entrance, G.path, G.enclosure, G.plants, G.trough, G.feeder, G.capys, G.keeper, G.open, G.v50],
      reward: 5000,
    },
    regional: {
      id: 'regional', phase: 2, name: 'Recuperar o Zoológico Regional', subtitle: 'Fase 2 — Instalações deterioradas e orçamento curto',
      desc: 'A prefeitura entregou um zoológico abandonado: cercas podres, lojas quebradas, lixo e animais malcuidados. O caixa é curto: priorize.',
      money: 22000, rep: 0.8, setup: (z, B) => B.regional(z),
      goals: [
        { text: 'Conserte todas as instalações quebradas e cercas abaixo de 70%', check: (z) => B.brokenCount(z) === 0, prog: (z) => { const t = B.repairTotal(z); return [t - B.brokenCount(z), t]; } },
        { text: 'Deixe caminhos sem lixo e recintos acima de 70% de limpeza', check: (z) => z.totalLitter() < 5 && [...z.enclosures.values()].every((e) => !e.animalCount || e.cleanliness >= 70) },
        { text: 'Bem-estar animal médio de 75% por 2 dias seguidos', sustain: 2, check: (z) => z.animals.length >= 3 && z.avgWelfare() >= 75 },
        { text: 'Feche 3 dias seguidos sem prejuízo', sustain: 3, check: (z) => z.econ.totals().profit >= 0 },
        num('Receba 400 visitantes', (z) => z.stats.totalVisitors, 400),
      ],
      reward: 12000,
    },
    grande: {
      id: 'grande', phase: 3, name: 'Reorganizar e Conservar', subtitle: 'Fase 3 — Circulação ruim e reprodução de espécie ameaçada',
      desc: 'Um zoológico grande, mas mal planejado: lojas em trechos isolados, recintos que ninguém consegue ver e um casal de antas num habitat errado.',
      money: 45000, rep: 1.8, setup: (z, B) => B.grande(z),
      goals: [
        { text: 'Ligue todas as lojas, banheiros e bancos à entrada', check: (z) => B.isolatedServices(z) === 0, prog: (z) => { const t = B.serviceTotal(z); return [t - B.isolatedServices(z), t]; } },
        { text: 'Todos os recintos com animais visíveis pelos visitantes', check: (z) => [...z.enclosures.values()].every((e) => !e.animalCount || e.stats.views.length > 0) },
        num('Reproduza uma espécie ameaçada (VU ou pior)', (z) => z.stats.threatenedBirths, 1),
        { text: 'Bem-estar animal médio de 80% por 3 dias seguidos', sustain: 3, check: (z) => z.animals.length >= 6 && z.avgWelfare() >= 80 },
        num('Alcance reputação de 3,5 estrelas', (z) => z.reputation * 10, 35),
      ],
      reward: 20000,
    },
    internacional: {
      id: 'internacional', phase: 4, name: 'Parque Aquático Internacional', subtitle: 'Fase 4 — Manutenção e qualidade da água',
      desc: 'Tanques lotados, filtros quebrados e nenhum técnico. Equilibre manutenção, qualidade da água e finanças para virar referência mundial.',
      money: 70000, rep: 2.2, setup: (z, B) => B.internacional(z),
      goals: [
        { text: 'Água de todos os tanques acima de 80% por 3 dias seguidos', sustain: 3, check: (z) => { const t = [...z.enclosures.values()].filter((e) => e.stats.water && e.animalCount); return t.length >= 2 && t.every((e) => e.waterQuality >= 80); } },
        num('Tenha 5 espécies aquáticas ou marinhas', (z) => z.speciesList().filter((s) => ZM.SPECIES[s].aquaticGroup).length, 5),
        num('Tenha 10 espécies diferentes', (z) => z.speciesList().length, 10),
        { text: 'Lucro acima de R$ 2.000 por 3 dias seguidos', sustain: 3, check: (z) => z.econ.totals().profit >= 2000 },
        num('Receba 2.000 visitantes', (z) => z.stats.totalVisitors, 2000),
        num('Acumule 80 Pontos de Conservação', (z) => z.stats.cpEarned, 80),
      ],
      reward: 50000,
    },
    sandbox: {
      id: 'sandbox', phase: 0, name: 'Modo livre', subtitle: 'Sandbox — dinheiro infinito',
      desc: 'Todos os animais e construções liberados. Construa o zoológico dos seus sonhos.',
      money: Infinity, sandbox: true, unlockAll: true, rep: 2.5,
      goals: [],
    },
  };
  ZM.CAMPAIGN = ['tutorial', 'regional', 'grande', 'internacional'];
})(window.ZM);
