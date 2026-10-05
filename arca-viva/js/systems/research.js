/* =========================================================
   Sistema de pesquisa: projeto ativo, pontos e desbloqueios
   ========================================================= */
(function (ZM) {
  'use strict';

  // mapa: o que é desbloqueado por qual pesquisa
  ZM.UNLOCK = { species: {}, objects: {}, fences: {}, terrain: {} };
  ZM.RESEARCH_LIST.forEach((r) => {
    (r.effect.species || []).forEach((s) => (ZM.UNLOCK.species[s] = r.id));
    (r.effect.objects || []).forEach((s) => (ZM.UNLOCK.objects[s] = r.id));
    (r.effect.fences || []).forEach((s) => (ZM.UNLOCK.fences[s] = r.id));
    (r.effect.terrain || []).forEach((s) => (ZM.UNLOCK.terrain[s] = r.id));
  });

  ZM.BASE_MODS = { repairSpeed: 1, feedSpeed: 1, workSpeed: 1, foodCost: 1, vetSpeed: 1, healAmount: 1, disease: 1, hungerRate: 1, decay: 1, utility: 1, breeding: 1, cpMult: 1, spawn: 1, education: 1 };

  class ResearchSystem {
    constructor(zoo) { this.zoo = zoo; this.done = []; this.active = null; this.progress = 0; this.saved = {}; }
    isDone(id) { return this.done.includes(id); }
    available(id) {
      const r = ZM.RESEARCH[id];
      return r && !this.isDone(id) && r.req.every((q) => this.isDone(q)) && (!r.reqBuilding || this.zoo.countObjects(r.reqBuilding) > 0 || this.zoo.scenario.unlockAll);
    }
    start(id) {
      const z = this.zoo;
      const rr = ZM.RESEARCH[id];
      if (rr && rr.reqBuilding && !this.zoo.countObjects(rr.reqBuilding) && !this.zoo.scenario.unlockAll) return { ok: false, reason: 'Construa primeiro: ' + ZM.OBJECTS[rr.reqBuilding].name + '.' };
      if (!this.available(id)) return { ok: false, reason: 'Pré-requisitos não cumpridos.' };
      if (this.active === id) return { ok: false, reason: 'Já em andamento.' };
      const r = ZM.RESEARCH[id];
      if (this.saved[id] == null && !z.spend(r.money, 'pesquisa')) return { ok: false, reason: 'Dinheiro insuficiente.' };
      if (this.active && this.progress > 0) { this.saved[this.active] = this.progress; z.alert(`Pesquisa "${ZM.RESEARCH[this.active].name}" foi pausada (progresso guardado).`, 'info'); }
      this.active = id; this.progress = this.saved[id] || 0; delete this.saved[id];
      ZM.Events.emit('research', this);
      return { ok: true };
    }
    addPoints(p) {
      if (!this.active) return;
      this.progress += p;
      const r = ZM.RESEARCH[this.active];
      if (this.progress >= r.rp) this.complete(this.active);
    }
    complete(id) {
      const r = ZM.RESEARCH[id];
      this.done.push(id); this.active = null; this.progress = 0;
      this.zoo.recomputeMods();
      const names = [];
      (r.effect.species || []).forEach((s) => names.push(ZM.SPECIES[s].name));
      (r.effect.objects || []).forEach((s) => names.push(ZM.OBJECTS[s].name));
      (r.effect.fences || []).forEach((s) => names.push(ZM.FENCES[s].name));
      (r.effect.terrain || []).forEach((s) => names.push(ZM.TERRAIN.find((t) => t.key === s).name));
      this.zoo.alert(`🔬 Pesquisa concluída: ${r.name}.` + (names.length ? ' ✅ Liberado: ' + names.join(', ') : ''), 'good');
      ZM.Audio.play('unlock');
      ZM.Events.emit('research', this);
    }
    toJSON() { return { done: this.done, active: this.active, progress: this.progress, saved: this.saved }; }
    load(d) { if (!d) return; this.done = d.done || []; this.active = d.active; this.progress = d.progress || 0; this.saved = d.saved || {}; }
  }
  ZM.ResearchSystem = ResearchSystem;
})(window.ZM);
