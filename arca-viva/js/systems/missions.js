/* =========================================================
   Missões / objetivos do cenário + progresso da campanha
   ========================================================= */
(function (ZM) {
  'use strict';

  class Missions {
    constructor(zoo) { this.zoo = zoo; this.completed = []; this.finished = false; this.streaks = {}; }
    get scenario() { return this.zoo.scenario; }
    goals() { return this.scenario.goals || []; }
    currentIndex() {
      const g = this.goals();
      for (let i = 0; i < g.length; i++) if (!this.completed.includes(i)) return i;
      return -1;
    }
    check() {
      const z = this.zoo, g = this.goals();
      if (!g.length || this.finished) return;
      const seq = this.scenario.sequential;
      for (let i = 0; i < g.length; i++) {
        if (this.completed.includes(i)) continue;
        if (g[i].sustain) { if (seq) break; continue; } // metas sustentadas são avaliadas no fim do dia
        let ok = false;
        try { ok = g[i].check(z); } catch (e) { ok = false; }
        if (ok) this.complete(i);
        else if (seq) break;
      }
      this.finishIfDone();
    }
    complete(i) {
      const g = this.goals();
      this.completed.push(i);
      this.zoo.alert('🎯 Objetivo concluído: ' + g[i].text, 'good');
      ZM.Audio.play('goal');
      ZM.Events.emit('missions');
    }
    /* fim do dia: metas que exigem dias seguidos */
    endOfDay() {
      const z = this.zoo, g = this.goals();
      if (this.finished) return;
      g.forEach((goal, i) => {
        if (!goal.sustain || this.completed.includes(i)) return;
        let ok = false;
        try { ok = goal.check(z); } catch (e) { ok = false; }
        const before = this.streaks[i] || 0;
        this.streaks[i] = ok ? before + 1 : 0;
        if (ok && this.streaks[i] >= goal.sustain) this.complete(i);
        else if (ok) z.alert(`📈 ${goal.text}: ${this.streaks[i]}/${goal.sustain} dias seguidos.`, 'info');
        else if (before > 0) z.alert(`📉 ${goal.text}: a sequência foi interrompida (${before} dia${before > 1 ? 's' : ''}).`, 'warn');
      });
      ZM.Events.emit('missions');
      this.finishIfDone();
    }
    /* condição atual de uma meta sustentada (para mostrar na interface) */
    liveOk(i) { const g = this.goals()[i]; try { return !!g.check(this.zoo); } catch (e) { return false; } }
    finishIfDone() {
      const z = this.zoo, g = this.goals();
      if (!g.length || this.finished) return;
      if (this.completed.length === g.length) {
        this.finished = true;
        const reward = this.scenario.reward || 0;
        if (reward) z.earn(reward, 'eventos');
        Missions.unlockNext(this.scenario.id);
        ZM.Events.emit('scenarioComplete', { scenario: this.scenario, reward });
      }
    }
    progressOf(i) {
      const g = this.goals()[i];
      if (g && g.sustain) return [this.streaks[i] || 0, g.sustain];
      if (!g || !g.prog) return null;
      try { return g.prog(this.zoo); } catch (e) { return null; }
    }
    toJSON() { return { completed: this.completed, finished: this.finished, streaks: this.streaks }; }
    load(d) { if (d) { this.completed = d.completed || []; this.finished = !!d.finished; this.streaks = d.streaks || {}; } }

    /* progresso da campanha persistido */
    static progress() {
      try { return JSON.parse(localStorage.getItem('arcaviva_progress') || '{}'); } catch (e) { return {}; }
    }
    static unlockNext(id) {
      const p = Missions.progress();
      p[id] = true;
      try { localStorage.setItem('arcaviva_progress', JSON.stringify(p)); } catch (e) { /* sem armazenamento */ }
    }
    static isPhaseUnlocked(id) {
      const i = ZM.CAMPAIGN.indexOf(id);
      if (i <= 0) return true;
      return !!Missions.progress()[ZM.CAMPAIGN[i - 1]];
    }
  }
  ZM.Missions = Missions;
})(window.ZM);
