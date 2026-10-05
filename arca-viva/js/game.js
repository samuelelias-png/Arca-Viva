/* =========================================================
   Arca Viva — inicialização e laço principal
   ========================================================= */
(function (ZM) {
  'use strict';

  const game = {
    zoo: null,
    renderer: null,
    last: 0,
    t: 0,
    autosaveT: 0,
    inMenu: true,

    init() {
      const canvas = document.getElementById('game');
      this.renderer = new ZM.Renderer(canvas);
      ZM.UI.init();
      ZM.Input.init(canvas);
      window.addEventListener('resize', () => this.renderer.resize());
      // mundo de fundo para o menu
      this.zoo = new ZM.Zoo('sandbox');
      this.decorateMenuWorld();
      this.renderer.centerOn(28, 28); this.renderer.cam.zoom = 1;
      this.toMenu(true);
      requestAnimationFrame((t) => this.loop(t));
      // salva ao sair
      window.addEventListener('beforeunload', () => { if (!this.inMenu && this.zoo) ZM.Save.save(this.zoo, 'auto'); });
    },

    /* pequeno zoológico decorativo atrás do menu */
    decorateMenuWorld() {
      const z = this.zoo;
      z.placePaths(Array.from({ length: 20 }, (_, i) => [18 + i, 30]));
      z.placePaths(Array.from({ length: 10 }, (_, i) => [27, 31 + i]));
      const e1 = z.createEnclosure(19, 24, 25, 29, 'wood').enc;
      const e2 = z.createEnclosure(29, 23, 36, 29, 'metal').enc;
      const e3 = z.createEnclosure(20, 31, 26, 36, 'wood').enc;
      z.paintTerrain([[20, 27], [21, 27], [20, 28], [21, 28], [22, 28]], ZM.T.WATER);
      z.paintTerrain([[21, 33], [22, 33], [21, 34], [22, 34], [23, 34], [22, 35]], ZM.T.WATER);
      [[23, 25, 'bush'], [24, 27, 'tallgrass'], [31, 24, 'acacia'], [34, 27, 'acacia'], [33, 25, 'tallgrass'], [25, 33, 'tallgrass'], [24, 35, 'bush']].forEach(([x, y, t]) => z.placeObject(t, x, y));
      z.placeObject('feeder', 23, 28); z.placeObject('trough', 32, 28); z.placeObject('feeder', 30, 26); z.placeObject('feeder', 25, 32);
      z.placeObject('snack', 28, 32); z.placeObject('drinks', 26, 37); z.placeObject('lamp', 28, 35); z.placeObject('bench', 28, 37);
      z.placeObject('entrance', 26, 41);
      for (let i = 0; i < 3; i++) z.buyAnimal('capivara', e1.id);
      for (let i = 0; i < 3; i++) z.buyAnimal('zebra', e2.id);
      z.buyAnimal('girafa', e2.id); z.buyAnimal('girafa', e2.id);
      for (let i = 0; i < 4; i++) z.buyAnimal('flamingo', e3.id);
      z.hireStaff('keeper');
      z.open = true; z.minute = 10 * 60;
      this.menuZoo = z;
    },

    toMenu(first) {
      this.inMenu = true;
      if (!first) { this.zoo = this.menuZoo || new ZM.Zoo('sandbox'); }
      this.zoo.speed = 1;
      ZM.UI.showHUD(false);
      ZM.UI.select(null);
      ZM.Modals.mainMenu();
    },

    startZoo(zoo) {
      this.zoo = zoo;
      this.inMenu = false;
      document.getElementById('menu').classList.add('hidden');
      ZM.UI.showHUD(true);
      ZM.UI.select(null);
      ZM.UI.closeDrawer();
      ZM.Input.setTool({ type: 'select' });
      ZM.Input.follow = null;
      ZM.UI.renderMissions();
      ZM.UI.setSpeed(zoo.speed || 1);
      ZM.UI.updateHUD();
      document.getElementById('alerts').innerHTML = '';
      ZM.UI.thoughts = [];
      ZM.UI.setLayer(null);
      document.getElementById('layerBox').classList.add('hidden');
      ZM.UI.showBuyPreview(null);
      ZM.Panels.buySp = null;
      ZM.UI.syncUndo();
      this.autosaveT = ZM.CONFIG.AUTOSAVE_REAL_SEC;
      // centraliza na entrada ou no meio
      const e = zoo.entrance();
      if (e) this.renderer.centerOn(e.x, e.y - 4); else this.renderer.centerOn(zoo.map.w / 2, zoo.map.h * 0.62);
      this.renderer.cam.zoom = 1.25;
      this.lastDay = zoo.day;
    },

    newGame(scId) {
      ZM.Audio.init();
      const z = new ZM.Zoo(scId);
      this.startZoo(z);
      const sc = z.scenario;
      ZM.UI.toast({ text: `🦒 ${sc.name}: ${sc.desc}`, type: 'info' });
      if (sc.tutorial) ZM.UI.setSpeed(1);
    },
    loadGame(slot) {
      const r = ZM.Save.loadResult(slot);
      if (!r.zoo) { ZM.UI.toast({ text: '❌ Não foi possível carregar: ' + r.error, type: 'danger' }); return; }
      const z = r.zoo;
      this.startZoo(z);
      ZM.UI.toast({ text: `📂 Jogo carregado — Dia ${z.day}, ${z.visitors.length} visitantes no parque.${r.migrated ? ' (save antigo convertido para a versão atual)' : ''}`, type: 'good' });
      if (z.animals.some((a) => a.escaped)) ZM.UI.toast({ text: '🚨 Há uma fuga em andamento neste save!', type: 'danger' });
    },
    /* salvamento automático com aviso de falha */
    autosave(z) {
      const r = ZM.Save.save(z, 'auto');
      ZM.UI.saveStatus(r);
      if (!r.ok) {
        const now = Date.now();
        if (!this._lastSaveWarn || now - this._lastSaveWarn > 5 * 60 * 1000) {
          this._lastSaveWarn = now;
          const last = ZM.Save.lastOk ? ` Último salvamento bem-sucedido: dia ${ZM.Save.lastOk.day}, ${ZM.Save.lastOk.time} (${new Date(ZM.Save.lastOk.at).toLocaleTimeString('pt-BR')}).` : ' Nenhum salvamento foi concluído nesta sessão.';
          ZM.UI.toast({ text: '💾 Falha no salvamento automático: ' + r.reason + last, type: 'danger' });
        }
      }
      return r;
    },

    loop(now) {
      const dt = Math.min(0.1, (now - this.last) / 1000 || 0.016);
      this.last = now;
      this.t += dt;
      const z = this.zoo;
      if (z) {
        z.update(dt);
        ZM.Input.update(dt);
        this.renderer.draw(z, this.t);
        if (!this.inMenu) {
          ZM.UI.update(dt);
          ZM.Audio.ambient(dt, z);
          // autosave: por tempo real e a cada novo dia
          this.autosaveT -= dt;
          if (this.autosaveT <= 0 || z.day !== this.lastDay) {
            this.autosaveT = ZM.CONFIG.AUTOSAVE_REAL_SEC;
            this.lastDay = z.day;
            this.autosave(z);
          }
        } else {
          // câmera passeando no menu
          this.renderer.cam.x += Math.sin(this.t * 0.1) * 0.2;
        }
      }
      requestAnimationFrame((t) => this.loop(t));
    },
  };

  ZM.game = game;
  window.addEventListener('DOMContentLoaded', () => game.init());
})(window.ZM);
