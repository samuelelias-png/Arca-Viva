/* =========================================================
   Eventos aleatórios, clima, doenças e fugas
   ========================================================= */
(function (ZM) {
  'use strict';
  const U = ZM.util;

  const DISEASES = ['Verminose', 'Infecção respiratória', 'Parasitas de pele', 'Problema digestivo', 'Infecção nos cascos/patas', 'Conjuntivite'];

  class EventSystem {
    constructor(zoo) {
      this.zoo = zoo;
      this.active = []; // { id, name, icon, until (minuto absoluto), effects }
    }
    has(id) { return this.active.some((e) => e.id === id); }
    start(id, name, icon, hours, extra) {
      const z = this.zoo;
      this.active = this.active.filter((e) => e.id !== id);
      this.active.push({ id, name, icon, until: z.absMinutes + hours * 60, ...(extra || {}) });
      this.applyWeather();
      ZM.Events.emit('eventsChanged');
    }
    applyWeather() {
      const w = this.zoo.weather;
      w.heat = this.has('heat'); w.rain = this.has('rain');
    }
    update() {
      const now = this.zoo.absMinutes;
      const before = this.active.length;
      this.active = this.active.filter((e) => {
        if (e.until > now) return true;
        if (e.endText) this.zoo.alert(e.endText, 'info');
        return false;
      });
      if (this.active.length !== before) { this.applyWeather(); ZM.Events.emit('eventsChanged'); }
    }
    modifier(key) {
      let m = 1;
      this.active.forEach((e) => { if (e[key]) m *= e[key]; });
      return m;
    }

    /* Sorteio diário (07:00) */
    daily() {
      const z = this.zoo;
      if (z.day < 2 || z.scenario.tutorial && z.day < 3) return;
      const r = Math.random();
      const avgW = z.avgWelfare();
      const animals = z.animals.length;
      const opts = [];
      opts.push({ w: 10, f: () => { this.start('heat', 'Onda de calor', '🌡️', 36, { endText: 'A onda de calor terminou.' }); z.alert('🌡️ Onda de calor! Animais e visitantes sentem mais sede. Bebedouros, sombra e quiosques serão essenciais.', 'warn'); } });
      opts.push({ w: 10, f: () => { this.start('rain', 'Chuva forte', '🌧️', 20, { spawn: 0.45, endText: 'A chuva passou.' }); z.alert('🌧️ Chuva forte: menos visitantes hoje.', 'warn'); } });
      if (animals >= 3) opts.push({ w: 5, f: () => this.outbreak() });
      opts.push({ w: 7, f: () => { const v = U.randInt(5, 20) * 100; z.earn(v, 'doacoes'); z.alert(`💝 Uma fundação doou ${U.money(v)} ao zoológico!`, 'good'); } });
      if (animals >= 2) opts.push({ w: 6, f: () => this.inspection() });
      if (z.reputation >= 2.5) opts.push({ w: 6, f: () => { this.start('news', 'Notícia positiva', '📰', 48, { spawn: 1.3 }); z.reputation = Math.min(5, z.reputation + 0.1); z.alert('📰 Uma reportagem elogiou o zoológico! Mais visitantes nos próximos dias.', 'good'); } });
      if (avgW < 50 && animals >= 3) opts.push({ w: 12, f: () => { this.start('protest', 'Protesto', '📢', 24, { spawn: 0.6 }); z.reputation = Math.max(0, z.reputation - 0.3); z.alert('📢 Protesto na entrada pelas condições dos animais! Reputação caiu.', 'danger'); } });
      if (z.objects.size > 4) opts.push({ w: 6, f: () => this.breakSomething() });
      if (z.visitors.length > 15) opts.push({ w: 4, f: () => this.lostChild() });
      if (z.reputation >= 3 && !this.has('sponsor')) opts.push({ w: 5, f: () => { const v = U.randInt(3, 8) * 100; this.start('sponsor', 'Patrocínio', '🤝', 24 * 7, { sponsor: v, endText: 'O contrato de patrocínio terminou.' }); z.alert(`🤝 Nova empresa patrocinadora: ${U.money(v)} por dia durante 7 dias!`, 'good'); } });
      const total = opts.reduce((s, o) => s + o.w, 0) + 40; // 40 = dia tranquilo
      let pick = Math.random() * total;
      for (const o of opts) { pick -= o.w; if (pick <= 0) { o.f(); ZM.Audio.play('alert'); return; } }
    }

    outbreak() {
      const z = this.zoo;
      const n = Math.min(3, Math.max(1, Math.floor(z.animals.length / 5)));
      const healthy = z.animals.filter((a) => !a.sick && !a.escaped);
      for (let i = 0; i < n && healthy.length; i++) {
        const a = healthy.splice(Math.floor(Math.random() * healthy.length), 1)[0];
        this.makeSick(a, true);
      }
      z.alert(`🦠 Surto de doença! ${n} animal(is) adoeceram. Veterinários são necessários.`, 'danger');
    }
    makeSick(a, quiet) {
      a.sick = true; a.disease = U.pick(DISEASES);
      if (!quiet) this.zoo.alert(`🤒 ${a.name} (${a.sp.name}) está doente: ${a.disease}.`, 'warn', a);
    }
    inspection() {
      const z = this.zoo;
      const w = z.avgWelfare();
      if (w >= 75) {
        const v = 2000; z.earn(v, 'eventos'); z.reputation = Math.min(5, z.reputation + 0.2);
        z.alert(`📋 Fiscalização ambiental: aprovado com louvor! Bem-estar médio ${Math.round(w)}%. Prêmio de ${U.money(v)}.`, 'good');
      } else if (w >= 55) {
        z.alert(`📋 Fiscalização ambiental: aprovado com ressalvas (bem-estar ${Math.round(w)}%).`, 'info');
      } else {
        const v = 3000; z.spend(v, 'multas', true); z.reputation = Math.max(0, z.reputation - 0.35);
        z.alert(`📋 Fiscalização ambiental: REPROVADO (bem-estar ${Math.round(w)}%). Multa de ${U.money(v)}.`, 'danger');
      }
    }
    breakSomething() {
      const z = this.zoo;
      const cands = [...z.objects.values()].filter((o) => o.condition != null && !o.broken);
      if (!cands.length) return;
      const o = U.pick(cands);
      o.condition = 10; o.broken = true;
      z.alert(`🔧 Equipamento quebrado: ${o.def.name}. Um técnico de manutenção precisa consertar.`, 'warn', o);
    }
    lostChild() {
      const z = this.zoo;
      const sec = z.staffCount('security');
      if (sec) z.alert('🧒 Uma criança se perdeu dos pais — a segurança a encontrou rapidamente.', 'info');
      else {
        z.visitors.forEach((v) => (v.happiness -= 5));
        z.reputation = Math.max(0, z.reputation - 0.05);
        z.alert('🧒 Uma criança se perdeu e demorou para ser encontrada. Contrate seguranças!', 'warn');
      }
    }

    /* Verificações de hora em hora: doença e fuga */
    hourly() {
      const z = this.zoo;
      const clinic = z.countObjects('clinic') ? 0.75 : 1;
      z.animals.forEach((a) => {
        if (a.sick || a.escaped) return;
        const enc = z.enclosures.get(a.encId);
        let p = 0.0012;
        if (enc && enc.cleanliness < 40) p += 0.004;
        if (a.welfare < 40) p += 0.004;
        if (z.day - a.checkedDay > 6) p += 0.0008;
        if (Math.random() < p * z.mods.disease * clinic) this.makeSick(a);
      });
      // fugas
      const sec = z.staffCount('security');
      z.enclosures.forEach((e) => {
        const list = e.animalsIn(z);
        if (!list.length) return;
        const level = ZM.FENCES[e.fence].level;
        let risk = 0, worst = null;
        list.forEach((a) => {
          if (a.sp.waterOnly) return;
          const need = a.sp.fence;
          if (need > level) { risk = Math.max(risk, 0.025 * (need - level)); worst = a; }
        });
        if (e.condition < 35) risk += ((35 - e.condition) / 35) * 0.035;
        const stress = list.reduce((s, a) => s + a.stress, 0) / list.length;
        if (stress > 60) risk *= 1.6;
        risk /= 1 + 0.35 * sec;
        if (z.scenario.tutorial && z.day < 3) risk = 0;
        if (risk > 0 && Math.random() < risk) {
          const a = worst || U.pick(list);
          if (a.escape(z)) z.onEscape(a, e);
        }
      });
    }

    toJSON() { return this.active; }
    load(d) { this.active = d || []; this.applyWeather(); }
  }
  ZM.EventSystem = EventSystem;
})(window.ZM);
