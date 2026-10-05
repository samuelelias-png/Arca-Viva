/* =========================================================
   Salvamento: localStorage com 3 slots + autosave.
   Inclui versão, migração de formatos antigos e validação.
   ========================================================= */
(function (ZM) {
  'use strict';
  const KEY = 'arcaviva_save_';
  ZM.SAVE_VERSION = 2;

  /* migrações: cada função recebe dados da versão N e devolve N+1 */
  const MIGRATIONS = {
    1: (d) => {
      // v1 não guardava visitantes, fugas nem configuração de comedouros
      d.visitors = d.visitors || [];
      (d.objects || []).forEach((o) => { if (ZM.OBJECTS[o.type] && ZM.OBJECTS[o.type].kind === 'feeder' && !o.foodSetting) o.foodSetting = 'auto'; });
      (d.enclosures || []).forEach((e) => { if (e.waterQuality == null) e.waterQuality = 100; });
      d.v = 2;
      return d;
    },
  };

  function validate(d) {
    const errs = [];
    if (!d || typeof d !== 'object') return ['arquivo vazio ou corrompido'];
    if (!ZM.SCENARIOS[d.scenarioId]) errs.push('cenário desconhecido: ' + d.scenarioId);
    if (!d.map || !Array.isArray(d.map.terrain)) errs.push('mapa ausente');
    ['objects', 'enclosures', 'animals', 'staff'].forEach((k) => { if (d[k] && !Array.isArray(d[k])) errs.push(k + ' inválido'); });
    (d.objects || []).forEach((o) => { if (!ZM.OBJECTS[o.type]) errs.push('objeto desconhecido: ' + o.type); });
    (d.animals || []).forEach((a) => { if (!ZM.SPECIES[a.species]) errs.push('espécie desconhecida: ' + a.species); });
    return errs;
  }

  ZM.Save = {
    slots: ['auto', '1', '2', '3'],
    lastOk: null,      // { slot, at, day, time }
    lastError: null,   // { slot, at, reason }
    save(zoo, slot) {
      try {
        const data = zoo.serialize();
        localStorage.setItem(KEY + slot, JSON.stringify(data));
        this.lastOk = { slot, at: Date.now(), day: zoo.day, time: ZM.util.timeStr(zoo.minute) };
        this.lastError = null;
        return { ok: true };
      } catch (e) {
        const quota = e && /quota/i.test(String(e.name) + String(e.message));
        const reason = quota ? 'o armazenamento do navegador está cheio' : 'o navegador bloqueou o armazenamento';
        this.lastError = { slot, at: Date.now(), reason };
        return { ok: false, reason: 'Não foi possível salvar: ' + reason + '.' };
      }
    },
    /* lê, migra e valida; devolve { zoo } ou { error } */
    loadResult(slot) {
      let raw;
      try { raw = localStorage.getItem(KEY + slot); } catch (e) { return { error: 'O navegador bloqueou o acesso ao armazenamento.' }; }
      if (!raw) return { error: 'Slot vazio.' };
      let d;
      try { d = JSON.parse(raw); } catch (e) { return { error: 'O arquivo salvo está corrompido.' }; }
      try {
        let v = d.v || 1;
        while (v < ZM.SAVE_VERSION && MIGRATIONS[v]) { d = MIGRATIONS[v](d); v = d.v; }
        const errs = validate(d);
        if (errs.length) return { error: 'Save incompatível: ' + errs.slice(0, 3).join('; ') + '.' };
        return { zoo: ZM.Zoo.deserialize(d), migrated: (JSON.parse(raw).v || 1) < ZM.SAVE_VERSION };
      } catch (e) {
        console.error(e);
        return { error: 'Erro ao reconstruir o zoológico: ' + (e && e.message) };
      }
    },
    load(slot) { const r = this.loadResult(slot); return r.zoo || null; },
    info(slot) {
      try {
        const raw = localStorage.getItem(KEY + slot);
        if (!raw) return null;
        const d = JSON.parse(raw);
        const sc = ZM.SCENARIOS[d.scenarioId];
        return { scenario: sc ? sc.name : d.scenarioId, day: d.day, money: d.money, animals: (d.animals || []).length, savedAt: d.savedAt, v: d.v || 1 };
      } catch (e) { return null; }
    },
    remove(slot) { try { localStorage.removeItem(KEY + slot); } catch (e) { /* ignore */ } },
    hasAny() { return this.slots.some((s) => this.info(s)); },
  };
})(window.ZM);
