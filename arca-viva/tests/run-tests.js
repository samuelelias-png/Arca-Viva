/* Testes automatizados da simulação (node tests/run-tests.js) */
'use strict';
const { ZM, newZoo, run } = require('./harness');

let pass = 0, fail = 0;
const results = [];
function test(name, fn) {
  try { fn(); pass++; results.push('  ✔ ' + name); }
  catch (e) { fail++; results.push('  ✘ ' + name + '\n      ' + (e && e.message)); }
}
function ok(cond, msg) { if (!cond) throw new Error(msg || 'falhou'); }
const roundTrip = (z) => { const s = JSON.stringify(z.serialize()); const z2 = ZM.Zoo.deserialize(JSON.parse(s)); ZM.game.zoo = z2; return z2; };

/* recinto simples encostado no caminho (x 20..26, y 23..29) */
function basicEnclosure(z, fence = 'wood') {
  const e = z.createEnclosure(20, 23, 26, 29, fence).enc;
  z.placeObject('feeder', 22, 25); z.placeObject('trough', 24, 26);
  return e;
}

/* ---------------- salvamento ---------------- */
test('salvar e carregar preserva visitantes, necessidades e atividade', () => {
  const z = newZoo();
  const e = basicEnclosure(z);
  z.buyAnimal('capivara', e.id); z.buyAnimal('capivara', e.id);
  z.open = true; z.minute = 10 * 60;
  run(z, 3);
  ok(z.visitors.length > 3, 'precisa de visitantes no parque para o teste (' + z.visitors.length + ')');
  const v = z.visitors[0];
  v.hunger = 77; v.money = 42.5; v.visited.add(e.id);
  const before = z.visitors.length;
  const z2 = roundTrip(z);
  ok(z2.visitors.length === before, `visitantes: ${before} → ${z2.visitors.length}`);
  const v2 = z2.visitors.find((x) => x.id === v.id);
  ok(v2, 'visitante com o mesmo id');
  ok(Math.abs(v2.hunger - 77) < 0.01 && Math.abs(v2.money - 42.5) < 0.01, 'necessidades e dinheiro preservados');
  ok(v2.visited.has(e.id), 'recintos visitados preservados');
  run(z2, 1); // continua funcionando
});

test('salvar e carregar preserva fuga, tranquilização e retorno', () => {
  const z = newZoo();
  const e = basicEnclosure(z, 'metal'); // cerca adequada: sem nova fuga durante o teste
  const a = z.buyAnimal('leao', e.id).animal;
  ok(a.escape(z), 'animal deve conseguir fugir');
  z.onEscape(a, e);
  const pos = [a.x, a.y];
  let z2 = roundTrip(z);
  let a2 = z2.animalById(a.id);
  ok(a2.escaped && a2.state === 'ESCAPED', 'continua fugitivo: ' + a2.state);
  ok(Math.abs(a2.x - pos[0]) < 0.01 && Math.abs(a2.y - pos[1]) < 0.01, 'posição fora do recinto preservada');
  a2.tranquilize();
  z2 = roundTrip(z2); a2 = z2.animalById(a.id);
  ok(a2.state === 'TRANQ' && a2.tranq > 0 && a2.escaped, 'tranquilizado continua tranquilizado');
  a2.tranq = 0; a2.state = 'RETURN';
  z2 = roundTrip(z2); a2 = z2.animalById(a.id);
  ok(a2.state === 'RETURN' && a2.escaped, 'retorno preservado');
  run(z2, 8);
  ok(!z2.animalById(a.id).escaped, 'acaba voltando ao recinto');
});

test('falha no salvamento automático é informada', () => {
  const z = newZoo();
  global.__failStorage = true;
  const r = ZM.Save.save(z, 'auto');
  global.__failStorage = false;
  ok(r.ok === false && r.reason, 'retorna erro');
  const r2 = ZM.Save.save(z, 'auto');
  ok(r2.ok && ZM.Save.lastOk && ZM.Save.lastOk.slot === 'auto', 'registra o último salvamento bem-sucedido');
});

/* ---------------- tutorial ---------------- */
test('tutorial reconhece um ou mais comedouros e bebedouros', () => {
  const z = newZoo('tutorial');
  const e = basicEnclosure(z);
  const goals = ZM.SCENARIOS.tutorial.goals;
  const feeder = goals.find((g) => g.text.includes('comedouro'));
  const trough = goals.find((g) => g.text.includes('bebedouro'));
  ok(feeder.check(z) && trough.check(z), 'um de cada');
  z.placeObject('feeder', 21, 27); z.placeObject('trough', 25, 28);
  ok(e.stats.feeders.length === 2, 'dois comedouros no recinto');
  ok(feeder.check(z), 'dois comedouros ainda contam');
  ok(trough.check(z), 'dois bebedouros ainda contam');
});

/* ---------------- trajetos ---------------- */
test('visitante não continua andando sobre caminho demolido', () => {
  const z = newZoo();
  z.open = true; z.minute = 10 * 60;
  const v = new ZM.Visitor(27, 49);
  v.maxStay = 99; v.interest = 100;
  z.visitors.push(v);
  const m = z.map;
  const p = z.pf.find(m.idx(27, 49), m.idx(27, 31), v.canStepFn(z));
  v.setPath(p); v.state = 'WALK';
  run(z, 0.05);
  ok(v.path && v.state === 'WALK', 'visitante andando no início');
  // demole um trecho à frente
  for (let y = 36; y <= 40; y++) z.removePath(27, y);
  z.tick(0.1);
  const bad = v.path && v.path.slice(v.pi).some((i) => !m.path[i]);
  ok(!bad, 'rota restante não pode usar tiles sem caminho');
  run(z, 1);
  ok(m.path[v.tileIdx(m)] || v.gone, 'visitante termina sobre um caminho');
});

/* ---------------- alimentação ---------------- */
test('animal só come alimento compatível com a dieta', () => {
  const z = newZoo();
  const e = basicEnclosure(z, 'metal');
  const lion = z.buyAnimal('leao', e.id).animal;
  const f = z.objects.get(e.stats.feeders[0]);
  f.food = 100; f.foodType = 'hay'; f.foodSetting = 'hay';
  lion.hunger = 80;
  run(z, 4);
  ok(lion.hunger >= 80, 'leão não pode matar a fome com feno (fome ' + Math.round(lion.hunger) + ')');
  f.foodSetting = 'meat'; f.food = 100; f.foodType = 'meat';
  run(z, 4);
  ok(lion.hunger < 60, 'com carne, o leão come (fome ' + Math.round(lion.hunger) + ')');
});

test('tratador abastece cada comedouro com a comida certa em recinto misto', () => {
  const z = newZoo();
  const e = z.createEnclosure(20, 23, 26, 29, 'metal').enc;
  z.placeObject('feeder', 22, 25); z.placeObject('feeder', 24, 25); z.placeObject('trough', 23, 27);
  z.buyAnimal('zebra', e.id); z.buyAnimal('leao', e.id);
  z.hireStaff('keeper');
  run(z, 6);
  const types = e.stats.feeders.map((id) => z.objects.get(id).foodType).sort();
  ok(types.includes('hay') && types.includes('meat'), 'tipos abastecidos: ' + types.join(','));
});

/* ---------------- acesso ---------------- */
test('loja num caminho isolado não é considerada acessível', () => {
  const z = newZoo();
  z.placePaths([[40, 40], [41, 40], [42, 40]]); // trecho solto
  const shop = z.placeObject('snack', 41, 41).obj;
  ok(!z.isConnected(shop), 'loja isolada não conectada');
  ok(shop.access.length === 0, 'sem acesso para visitantes');
  const shop2 = z.placeObject('drinks', 28, 35).obj;
  ok(z.isConnected(shop2), 'loja ligada à entrada');
});

test('pontos de observação só contam caminhos ligados à entrada', () => {
  const z = newZoo();
  const e = z.createEnclosure(34, 40, 38, 44, 'wood').enc;
  z.placePaths([[33, 40], [33, 41], [33, 42]]); // encostado mas isolado
  ok(e.stats.views.length === 0, 'nenhum ponto válido: ' + e.stats.views.length);
});

/* ---------------- desfazer ---------------- */
test('desfazer devolve o dinheiro de uma construção', () => {
  const z = newZoo('regional');
  const before = z.money;
  z.placeObject('snack', 28, 35);
  ok(z.money < before, 'pagou');
  ok(z.undo.undo().ok, 'desfez');
  ok(Math.abs(z.money - before) < 0.01 && !z.objectsOfKind('shop').length, 'dinheiro e objeto restaurados');
});

/* ---------------- metas sustentadas ---------------- */
test('metas sustentadas exigem dias seguidos', () => {
  const z = newZoo('grande');
  const g = z.scenario.goals.find((x) => x.sustain);
  ok(g, 'cenário tem meta sustentada');
  let cond = true;
  const ms = z.missions; ms.completed = []; ms.streaks = {}; ms.finished = false;
  Object.defineProperty(ms, 'scenario', { value: { id: 'teste', goals: [{ text: 'meta de teste', sustain: 2, check: () => cond }, { text: 'outra', check: () => false }] } });
  ms.endOfDay(); ok(ms.streaks[0] === 1 && !ms.completed.length, 'um dia não basta');
  cond = false; ms.endOfDay(); ok(ms.streaks[0] === 0, 'sequência zera quando a condição falha');
  cond = true; ms.endOfDay(); ms.endOfDay();
  ok(ms.completed.includes(0), 'dois dias seguidos concluem a meta');
});

/* ---------------- comportamento das espécies ---------------- */
test('espécies exibem comportamentos próprios por 24h sem erros', () => {
  const z = newZoo();
  const mk = (x0, y0, x1, y1, fence, setup) => { const e = z.createEnclosure(x0, y0, x1, y1, fence, { free: true }).enc; setup && setup(e); return e; };
  // capivaras: lago + capim
  const cap = mk(14, 31, 20, 37, 'wood', () => { z.paintTerrain([[16, 33], [17, 33], [16, 34], [17, 34]], ZM.T.WATER, { free: true }); z.placeObject('feeder', 19, 36, { free: true }); });
  // preguiças e micos: árvores e plataformas
  const tree = mk(28, 31, 34, 37, 'wood', () => { z.placeObject('platform', 30, 33, { free: true }); z.placeObject('bigtree', 32, 35, { free: true }); z.placeObject('feeder', 33, 32, { free: true }); z.placeObject('feeder', 31, 36, { free: true }); z.placeObject('trough', 29, 36, { free: true }); });
  // leões
  const lio = mk(35, 31, 42, 38, 'metal', () => { z.placeObject('feeder', 37, 33, { free: true }); z.placeObject('trough', 40, 36, { free: true }); z.placeObject('ball', 39, 33, { free: true }); });
  const counts = {};
  const watchA = [];
  const add = (sp, e, n) => { for (let i = 0; i < n; i++) { const r = z.buyAnimal(sp, e.id, { free: true }); if (r.animal) watchA.push(r.animal); } };
  z.sandbox = true;
  add('capivara', cap, 4); add('preguica', tree, 2); add('mico', tree, 3); add('leao', lio, 2);
  ok(watchA.length >= 9, 'animais adicionados: ' + watchA.length);
  z.hireStaff('keeper'); z.hireStaff('keeper');
  const steps = Math.round((24 * 60) / ZM.CONFIG.MIN_PER_SEC / ZM.CONFIG.SIM_STEP);
  for (let i = 0; i < steps; i++) {
    z.tick(ZM.CONFIG.SIM_STEP);
    if (i % 20 === 0) watchA.forEach((a) => { const k = a.species + ':' + a.state; counts[k] = (counts[k] || 0) + 1; });
  }
  const has = (sp, states) => states.some((s) => counts[sp + ':' + s]);
  ok(has('capivara', ['WALLOW', 'SWIM']), 'capivaras usam a água');
  ok(has('preguica', ['CLIMB']), 'preguiças escalam');
  ok(has('mico', ['CLIMB', 'GROOM']), 'micos escalam ou catam');
  ok(has('leao', ['REST', 'PATROL', 'WATCH', 'PLAY', 'BASK']), 'leões alternam descanso e patrulha');
  ok(watchA.every((a) => a.health > 40), 'todos com saúde: ' + watchA.map((a) => a.species + ' ' + Math.round(a.health)).join(', '));
});

/* ---------------- prévia de compra ---------------- */
test('prévia de compra aponta cerca fraca e falta de comida', () => {
  const z = newZoo();
  z.sandbox = true;
  const e = z.createEnclosure(20, 23, 23, 26, 'wood', { free: true }).enc;
  const r = ZM.Diagnostics.purchase(z, 'leao', e.id);
  const txt = r.items.map((i) => i.text).join(' | ');
  ok(r.verdict === 'risky' || r.verdict === 'caution', 'veredito de risco: ' + r.verdict);
  ok(/cerca/i.test(txt), 'menciona a cerca: ' + txt);
  ok(/comedouro|comida|alimenta/i.test(txt), 'menciona a comida');
});

/* ---------------- filas e capacidade ---------------- */
test('serviço lotado gera fila e desistência com motivo', () => {
  const z = newZoo();
  z.open = true; z.minute = 600;
  const wc = z.placeObject('toilet', 28, 40).obj;
  const slots = z.serviceSlots(wc);
  const vs = [];
  for (let i = 0; i < slots * 5; i++) { const v = new ZM.Visitor(27.5, 40.5); z.visitors.push(v); vs.push(v); }
  vs.forEach((v) => v.joinService(z, wc, 'TOILET'));
  ok(z.serviceCount(wc) === slots, 'atende no máximo ' + slots);
  ok(z.queueOf(wc).length > 0, 'forma fila');
  ok((wc.gaveUp || 0) > 0 && wc.lostReasons && wc.lostReasons.fila > 0, 'registra desistência por fila');
});

console.log(results.join('\n'));
console.log(`\n${pass} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
