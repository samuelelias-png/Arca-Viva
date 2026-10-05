/* Carrega a simulação do Arca Viva no Node (sem DOM) para testes automatizados.
   Uso: const { ZM, newZoo, run } = require('./harness'); */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

global.window = global;
const ROOT = path.join(__dirname, '..', 'js');
// mesma ordem do index.html, sem renderização e interface
const FILES = [
  'core/core', 'data/species', 'data/objects', 'data/research', 'data/scenarios', 'data/prefabs',
  'world/map', 'world/enclosure', 'world/buildings', 'world/access',
  'entities/agent', 'entities/animal', 'entities/visitor', 'entities/staff',
  'systems/economy', 'systems/research', 'systems/events', 'systems/missions', 'systems/audio',
  'systems/diagnostics', 'systems/undo', 'zoo', 'world/construction', 'systems/services', 'save',
];
for (const f of FILES) {
  const file = path.join(ROOT, f + '.js');
  if (!fs.existsSync(file)) continue;
  vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: f + '.js' });
}
const ZM = global.ZM;

// localStorage em memória (para testar salvamento)
const store = {};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { if (global.__failStorage) throw new Error('QuotaExceededError'); store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

/* zoológico de teste com área limpa, entrada e caminhos em cruz */
function newZoo(scenario = 'sandbox', opts = {}) {
  const z = new ZM.Zoo(scenario);
  ZM.game = { zoo: z };
  const m = z.map;
  for (let y = 6; y < 54; y++) for (let x = 6; x < 52; x++) {
    const i = m.idx(x, y);
    if (m.obj[i] >= 0) z.removeObjectSilent(m.obj[i]);
    m.terrain[i] = ZM.T.GRASS;
  }
  m.touch(); z.refreshAll();
  if (opts.bare) return z;
  z.placeObject('entrance', 26, 50, { free: true });
  const P = [];
  for (let y = 49; y >= 18; y--) P.push([27, y]);
  for (let x = 12; x <= 44; x++) P.push([x, 30]);
  z.placePaths(P);
  return z;
}

/* executa N horas de jogo */
function run(z, hours) {
  const steps = Math.round((hours * 60) / ZM.CONFIG.MIN_PER_SEC / ZM.CONFIG.SIM_STEP);
  for (let i = 0; i < steps; i++) z.tick(ZM.CONFIG.SIM_STEP);
}

module.exports = { ZM, newZoo, run, store };
