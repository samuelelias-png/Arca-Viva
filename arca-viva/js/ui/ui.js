/* =========================================================
   UI: barra superior, ferramentas, gaveta, alertas, missões,
   tooltip, minimapa e protocolo de fuga
   ========================================================= */
(function (ZM) {
  'use strict';
  const U = ZM.util;
  const $ = (s) => document.querySelector(s);

  const UI = {
    selected: null,
    openCat: null,
    brush: 1,
    sexPref: 'auto',
    hudT: 0,

    init() {
      // velocidade
      document.querySelectorAll('#speedBtns button').forEach((b) => b.addEventListener('click', () => { this.setSpeed(+b.dataset.speed); ZM.Audio.play('click'); }));
      $('#btnOpen').addEventListener('click', () => this.toggleOpen());
      $('#btnTicket').addEventListener('click', () => ZM.Modals.dashboard('fin'));
      $('#btnDash').addEventListener('click', () => ZM.Modals.dashboard());
      $('#btnResearch').addEventListener('click', () => ZM.Modals.research());
      $('#btnStaffList').addEventListener('click', () => ZM.Modals.staffList());
      $('#btnMenu').addEventListener('click', () => ZM.Modals.pauseMenu());
      $('#btnSound').addEventListener('click', () => { const m = ZM.Audio.toggleMute(); $('#btnSound').textContent = m ? '🔇' : '🔊'; });
      document.querySelectorAll('#toolbar [data-cat]').forEach((b) => b.addEventListener('click', () => {
        ZM.Audio.play('click');
        if (b.dataset.cat === 'research') { ZM.Modals.research(); return; }
        this.toggleDrawer(b.dataset.cat);
      }));
      document.querySelectorAll('#toolbar [data-tool]').forEach((b) => b.addEventListener('click', () => {
        ZM.Audio.play('click');
        this.closeDrawer();
        ZM.Input.setTool({ type: b.dataset.tool });
      }));
      $('#minimap').addEventListener('mousedown', (e) => this.minimapClick(e));
      $('#btnSave').addEventListener('click', () => ZM.Modals.pauseMenu());
      $('#btnUndo').addEventListener('click', () => this.doUndo());
      $('#btnLayer').addEventListener('click', () => this.toggleLayerBox());
      ZM.Events.on('undo', () => this.syncUndo());
      this.catF = { q: '', cont: 'all', biome: 'all', threat: false, avail: false };
      this.applyScale(this.pref('uiScale', 1));
      this.initTooltips();
      ZM.Events.on('alert', (a) => this.toast(a));
      ZM.Events.on('missions', () => this.renderMissions());
      ZM.Events.on('research', () => { if (this.openCat) this.renderDrawer(); });
      ZM.Events.on('scenarioComplete', (d) => setTimeout(() => ZM.Modals.scenarioComplete(d), 600));
      ZM.Events.on('dayEnd', (rec) => this.dayToast(rec));
      this.thoughts = [];
      ZM.Events.on('thought', (d) => { if (d.mood === 0) return; this.thoughts.unshift({ text: d.text, mood: d.mood, name: d.v.name }); if (this.thoughts.length > 14) this.thoughts.pop(); });
    },
    get zoo() { return ZM.game.zoo; },

    showHUD(v) { $('#hud').classList.toggle('hidden', !v); },
    setSpeed(s) {
      if (!this.zoo) return;
      this.zoo.speed = s;
      document.querySelectorAll('#speedBtns button').forEach((b) => b.classList.toggle('on', +b.dataset.speed === s));
    },
    toggleOpen() {
      const z = this.zoo;
      if (!z.open && !z.entranceConnected()) { this.toast({ text: '⚠️ Construa a Entrada e ligue-a a um caminho antes de abrir.', type: 'warn' }); ZM.Audio.play('error'); return; }
      z.open = !z.open;
      ZM.Audio.play(z.open ? 'goal' : 'click');
      if (z.open) this.toast({ text: '🎉 O zoológico está aberto! Os visitantes chegam entre 8h e 18h.', type: 'good' });
      this.updateHUD(true);
    },

    /* ---------- HUD ---------- */
    update(dt) {
      this.hudT -= dt;
      if (this.hudT <= 0) { this.hudT = 0.25; this.updateHUD(); this.renderMissionProgress(); this.updateProtocol(); }
      this.sideT = (this.sideT || 0) - dt;
      if (this.sideT <= 0) { this.sideT = 0.5; ZM.Panels.refresh(); }
      this.mmT = (this.mmT || 0) - dt;
      if (this.mmT <= 0) { this.mmT = 0.5; this.drawMinimap(); }
    },
    updateHUD() {
      const z = this.zoo; if (!z) return;
      const set = (id, html) => { const el = $(id + ' b'); if (el.innerHTML !== html) el.innerHTML = html; };
      set('#stMoney', z.sandbox ? '∞' : U.money(z.money));
      $('#stMoney').classList.toggle('neg', !z.sandbox && z.money < 0);
      set('#stVisitors', `${z.visitors.length} <small style="opacity:.7">/ ${z.stats.visitorsToday}</small>`);
      const full = Math.floor(z.reputation), half = z.reputation - full >= 0.5;
      set('#stRep', '★'.repeat(full) + (half ? '½' : '') + `<small style="opacity:.7"> ${z.reputation.toFixed(1)}</small>`);
      set('#stWelfare', z.animals.length ? U.pct(z.avgWelfare()) : '—');
      set('#stCP', Math.floor(z.cp).toString());
      set('#stEdu', U.pct(z.education));
      const h = z.hour;
      const ic = h < 6 || h >= 20 ? '🌙' : h < 8 ? '🌅' : h < 17 ? '☀️' : '🌇';
      $('#stTime .ic').textContent = ic;
      set('#stTime', `Dia ${z.day} · ${U.timeStr(z.minute)}`);
      const w = z.events.active.map((e) => `<span data-tip="${U.esc(e.name)}">${e.icon}</span>`).join('');
      if ($('#stWeather').innerHTML !== w) $('#stWeather').innerHTML = w;
      const bo = $('#btnOpen');
      bo.className = 'toggle ' + (z.open ? 'open' : 'closed');
      const ot = z.open ? (h >= ZM.CONFIG.OPEN_HOUR && h < ZM.CONFIG.CLOSE_HOUR ? '🔓 Aberto' : '🌙 Abre às 8h') : '🔒 Fechado';
      if (bo.textContent !== ot) bo.textContent = ot;
      $('#btnTicket b').textContent = U.money(z.ticketPrice);
      document.querySelectorAll('#speedBtns button').forEach((b) => b.classList.toggle('on', +b.dataset.speed === z.speed));
      this.updateSave();
      this.syncUndo();
    },

    /* ---------- indicador de salvamento ---------- */
    saveStatus(r) { this.lastSaveResult = r; this.updateSave(); },
    updateSave() {
      const b = $('#btnSave'); if (!b) return;
      const S = ZM.Save, ok = S.lastOk, err = S.lastError;
      let txt = 'não salvo', cls = 'save-ind', tip = 'Ainda não houve salvamento nesta sessão. Clique para salvar.';
      if (err && (!ok || err.at >= ok.at)) {
        txt = 'falhou'; cls += ' bad';
        tip = `<b>Falha ao salvar</b>: ${U.esc(err.reason)}.<br>${ok ? `Último salvamento bem-sucedido: ${ok.slot === 'auto' ? 'autosave' : 'slot ' + ok.slot}, dia ${ok.day} às ${ok.time}.` : 'Nenhum salvamento bem-sucedido nesta sessão.'}`;
      } else if (ok) {
        const min = Math.floor((Date.now() - ok.at) / 60000);
        txt = min < 1 ? 'agora' : min < 60 ? `há ${min} min` : `há ${Math.floor(min / 60)} h`;
        if (min >= 10) cls += ' old';
        tip = `Salvo em ${ok.slot === 'auto' ? 'autosave' : 'slot ' + ok.slot} · dia ${ok.day} às ${ok.time}.<br>O autosave roda a cada poucos minutos e no início de cada dia.`;
      }
      const html = txt;
      const el = b.querySelector('b');
      if (el.textContent !== html) el.textContent = html;
      if (b.className !== 'chip-btn ' + cls) b.className = 'chip-btn ' + cls;
      b.dataset.tip = tip;
    },

    /* ---------- desfazer ---------- */
    doUndo() {
      const z = this.zoo; if (!z) return;
      const r = z.undo.undo();
      if (!r.ok) { this.toast({ text: '↶ ' + r.reason + '.', type: 'info' }); return; }
      ZM.Audio.play('click');
      this.toast({ text: `↶ Desfeito: ${r.label}.`, type: 'info' });
      if (this.selected) ZM.Panels.render();
      if (this.openCat) this.renderDrawer();
      ZM.Input.updatePreview();
    },
    syncUndo() {
      const z = this.zoo, b = $('#btnUndo'); if (!b || !z) return;
      const p = z.undo.peek();
      b.disabled = !p;
      const tip = p ? `Desfazer: <b>${U.esc(p.label)}</b> (Ctrl+Z)` : 'Nada para desfazer';
      if (b.dataset.tip !== tip) b.dataset.tip = tip;
    },

    /* ---------- camadas do mapa ---------- */
    LAYERS: [
      ['access', '🚶 Acesso', '<span><i style="--c:#5adc6e"></i>caminho ligado à entrada</span>  <span><i style="--c:#f04a3c"></i>trecho isolado</span>  <span><i style="--c:#5aa0ff"></i>área por onde a equipe circula</span>  <span><i style="--c:#ffe866"></i>portão</span> '],
      ['clean', '🧹 Limpeza', '<span><i style="--c:#f04a3c"></i>lixo no caminho</span>  <span><i style="--c:#5aa0ff"></i>alcance das lixeiras</span>  · recintos coloridos pela limpeza'],
      ['welfare', '🐾 Bem-estar', 'Recintos coloridos pelo bem-estar médio <span><i style="--c:#5adc6e"></i>bom</span>  <span><i style="--c:#ffc846"></i>atenção</span>  <span><i style="--c:#f04a3c"></i>crítico</span>  · ⚠️ = problemas'],
      ['staff', '👷 Equipe', '<span><i style="--c:#5adc6e"></i>recinto com tratador</span>  <span><i style="--c:#f04a3c"></i>sem tratador</span>  · ✖ tarefa inalcançável · anel = ocupação do funcionário'],
    ],
    setLayer(l) {
      ZM.game.renderer.layer = l || null;
      $('#btnLayer').classList.toggle('active', !!l);
      this.renderLayerBox();
    },
    cycleLayer() {
      const order = [null, ...this.LAYERS.map((x) => x[0])];
      const i = order.indexOf(ZM.game.renderer.layer || null);
      this.setLayer(order[(i + 1) % order.length]);
      $('#layerBox').classList.remove('hidden');
      const L = this.LAYERS.find((x) => x[0] === ZM.game.renderer.layer);
      this.toast({ text: L ? `🗺️ Camada: ${L[1].replace(/^\S+ /, '')}` : '🗺️ Camadas desligadas', type: 'info', key: 'layer' });
    },
    toggleLayerBox() {
      const box = $('#layerBox');
      box.classList.toggle('hidden');
      this.renderLayerBox();
    },
    renderLayerBox() {
      const box = $('#layerBox'), cur = ZM.game.renderer.layer;
      const btn = $('#btnLayer').getBoundingClientRect();
      box.style.left = Math.max(8, Math.min(window.innerWidth - 340, btn.left - 120)) + 'px';
      const L = this.LAYERS.find((x) => x[0] === cur);
      box.innerHTML = `<div class="lb-row"><button data-layer="" class="${cur ? '' : 'on'}">Nenhuma</button>${this.LAYERS.map(([k, n]) => `<button data-layer="${k}" class="${cur === k ? 'on' : ''}">${n}</button>`).join('')}</div>${L ? `<div class="lb-legend">${L[2]}</div>` : '<div class="lb-legend">Escolha uma camada para enxergar acesso, limpeza, bem-estar ou cobertura da equipe. Atalho: <kbd>L</kbd>.</div>'}`;
      box.querySelectorAll('[data-layer]').forEach((b) => b.addEventListener('click', () => this.setLayer(b.dataset.layer)));
    },

    /* ---------- ações sugeridas pelo diagnóstico ---------- */
    runAction(act) {
      const z = this.zoo, R = ZM.game.renderer;
      switch (act.type) {
        case 'locate': R.centerOn(act.x + 0.5, act.y + 0.5); R.flash = { x: act.x, y: act.y }; break;
        case 'selectStaff': {
          const list = z.staff.filter((s) => s.role === act.role);
          if (!list.length) { this.toast({ text: `Não há ${ZM.STAFF_ROLES[act.role].name.toLowerCase()}. Contrate na aba Funcionários.`, type: 'warn' }); return; }
          const s = list.find((x) => !x.task) || list[0];
          R.centerOn(s.x, s.y); this.select({ kind: 'staff', id: s.id });
          if (act.encId) this.toast({ text: `💡 Marque o recinto no painel de ${s.name.split(' ')[0]} para designá-lo.`, type: 'info' });
          break;
        }
        case 'hire': {
          const r = z.hireStaff(act.role);
          if (!r.ok) { this.toast({ text: '❌ ' + r.reason, type: 'warn' }); ZM.Audio.play('error'); return; }
          this.toast({ text: `${ZM.STAFF_ROLES[act.role].icon} ${r.staff.name} foi contratado(a).`, type: 'good' });
          break;
        }
        case 'tool': ZM.Input.setTool(act.tool); this.toast({ text: '🛠️ Ferramenta escolhida — veja a dica acima da barra.', type: 'info', key: 'tool' }); break;
        case 'select': {
          this.select({ kind: act.kind, id: act.id });
          const ent = act.kind === 'animal' ? z.animalById(act.id) : act.kind === 'staff' ? z.staff.find((x) => x.id === act.id) : act.kind === 'object' ? z.objects.get(act.id) : null;
          if (ent) R.centerOn(ent.x + (act.kind === 'object' ? 0.5 : 0), ent.y + (act.kind === 'object' ? 0.5 : 0));
          break;
        }
        case 'upgradeFence': {
          const r = z.upgradeFence(act.encId, act.fence);
          if (!r.ok) { this.toast({ text: '❌ ' + (r.reason || 'Não foi possível'), type: 'warn' }); ZM.Audio.play('error'); return; }
          ZM.Audio.play('build');
          break;
        }
        case 'layer': this.setLayer(act.layer); $('#layerBox').classList.remove('hidden'); this.renderLayerBox(); break;
      }
      ZM.Audio.play('click');
      ZM.Panels.render();
    },

    /* ---------- escala da interface ---------- */
    pref(k, def) { try { const v = localStorage.getItem('arcaviva_' + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
    setPref(k, v) { try { localStorage.setItem('arcaviva_' + k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } },
    applyScale(v) {
      this.uiScale = v;
      document.documentElement.style.setProperty('--ui-scale', v);
      document.body.classList.toggle('ui-big', v > 1);
      this.setPref('uiScale', v);
    },

    /* ---------- gaveta de construção ---------- */
    toggleDrawer(cat) {
      if (this.openCat === cat && this.compact) { this.compact = false; return this.renderDrawer(); }
      if (this.openCat === cat) return this.closeDrawer();
      this.openCat = cat;
      this.compact = false;
      document.querySelectorAll('#toolbar [data-cat]').forEach((b) => b.classList.toggle('active', b.dataset.cat === cat));
      this.renderDrawer();
      $('#drawer').classList.remove('hidden');
      document.body.classList.add('drawer-open');
    },
    closeDrawer() {
      this.openCat = null;
      $('#drawer').classList.add('hidden');
      document.body.classList.remove('drawer-open');
      $('#alerts').style.bottom = '96px';
      document.querySelectorAll('#toolbar [data-cat]').forEach((b) => b.classList.remove('active'));
    },
    renderDrawer() {
      const z = this.zoo, d = $('#drawer');
      const tool = ZM.Input.tool;
      const sel = (type, param) => tool.type === type && tool.param === param ? ' sel' : '';
      const card = (o) => `<button class="card${o.locked ? ' locked' : ''}${o.sel || ''}" data-act='${JSON.stringify(o.act)}' data-tip="${U.esc(o.tip || '')}"${o.data || ''}>
        ${o.badge ? `<span class="badge" style="background:${o.badgeColor}">${o.badge}</span>` : ''}
        ${o.locked ? '<span class="lock">🔒</span>' : o.count ? `<span class="count">${o.count}</span>` : ''}
        <span class="ci">${o.icon}</span><span class="cn">${U.esc(o.name)}</span><span class="cp">${o.price || ''}</span>${o.req ? `<span class="req">${U.esc(o.req)}</span>` : ''}</button>`;
      const sec = (title, cards, extra = '') => `<div class="drawer-sec"><h4>${title}${extra}</h4><div class="cards">${cards.join('')}</div></div>`;
      const objCard = (id) => {
        const def = ZM.OBJECTS[id];
        const locked = !z.isObjectUnlocked(id);
        const req = locked ? ZM.RESEARCH[ZM.UNLOCK.objects[id] || def.research] : null;
        return card({ icon: def.icon, name: def.name, price: U.money(def.cost), locked, req: req ? '🔬 ' + req.name : '', sel: sel('object', id), act: { type: 'object', param: id },
          tip: `<b>${def.name}</b> — ${U.money(def.cost)}${def.upkeep ? ` (+${U.money(def.upkeep)}/dia)` : ''}<br>${def.desc || ''}${req ? `<br>🔒 Requer pesquisa: <b>${req.name}</b>` : ''}` });
      };
      let html = '';
      switch (this.openCat) {
        case 'animals': {
          const mk = (id) => {
            const sp = ZM.SPECIES[id];
            const locked = !z.isSpeciesUnlocked(id);
            const st = ZM.STATUS[sp.status];
            const req = locked ? ZM.RESEARCH[ZM.UNLOCK.species[id]] : null;
            const cpTxt = sp.cp && !z.sandbox ? ` · ${sp.cp}🧬` : '';
            const needCP = !locked && !z.sandbox && sp.cp > z.cp;
            const reqTxt = locked ? '🔬 ' + (req ? req.name : 'pesquisa') : needCP ? `faltam ${Math.ceil(sp.cp - z.cp)}🧬` : ZM.isAquatic(sp) ? '🌊 habitat pronto' : '';
            const data = ` data-name="${U.esc((sp.name + ' ' + sp.sci + ' ' + sp.region).toLowerCase())}" data-cont="${sp.continent}" data-biome="${sp.biome}" data-status="${sp.status}" data-avail="${!locked && !needCP ? 1 : 0}"`;
            return card({ icon: speciesIcon(id), name: sp.name, price: U.money(sp.price) + cpTxt, locked, req: reqTxt, data, badge: st.short, badgeColor: st.color, sel: sel('animal', id), act: { type: 'animal', param: id },
              tip: `<b>${sp.name}</b> <i>(${sp.sci})</i><br>🌍 ${sp.region} · Bioma: ${sp.biomeData.name}<br>🍽️ ${sp.diet} · Grupo: ${sp.group[0]}–${sp.group[1]} · Espaço: ${sp.space} ${sp.waterOnly ? 'tiles de água' : 'tiles'}/animal<br>🛡️ Cerca mínima: nível ${sp.fence} · Status: ${st.name}${ZM.isAquatic(sp) ? `<br>🌊 Mora num habitat pronto: <b>${ZM.prefabsFor(id).map((k) => ZM.PREFABS[k].name).join(' ou ')}</b> (Construção)` : ''}${sp.cold ? '<br>🧊 Precisa de neve e Máquina de gelo' : ''}${sp.dimorph || sp.look.female ? '<br>⚥ Machos e fêmeas têm aparência diferente' : ''}${sp.cp ? `<br>🧬 Requer ${sp.cp} Pontos de Conservação` : ''}${req ? `<br>🔒 Pesquisa: <b>${req.name}</b>` : ''}` });
          };
          const sexBtns = `<span class="brush">${[['auto', '⚥ Auto'], ['M', '♂ Macho'], ['F', '♀ Fêmea']].map(([k, l]) => `<button data-sex="${k}" class="${this.sexPref === k ? 'on' : ''}">${l}</button>`).join('')}</span>`;
          const land = ZM.SPECIES_ORDER.filter((id) => !ZM.isAquatic(ZM.SPECIES[id]));
          const aqua = ZM.SPECIES_ORDER.filter((id) => ZM.isAquatic(ZM.SPECIES[id]));
          const F = this.catF;
          const conts = [['all', 'Todas'], ['brasil', '🇧🇷 Brasil'], ['africa', 'África'], ['asia', 'Ásia'], ['oceania', 'Oceania'], ['mar', 'Mar']];
          const biomes = [...new Set(ZM.SPECIES_ORDER.map((id) => ZM.SPECIES[id].biome))];
          const filters = `<div class="cat-filter"><input type="search" id="catQ" placeholder="🔎 Buscar espécie…" value="${U.esc(F.q)}">
            <span class="brush">${conts.map(([k, l]) => `<button data-cont="${k}" class="${F.cont === k ? 'on' : ''}">${l}</button>`).join('')}</span>
            <select id="catBiome"><option value="all">Todos os biomas</option>${biomes.map((b) => `<option value="${b}"${F.biome === b ? ' selected' : ''}>${ZM.BIOMES[b].name}</option>`).join('')}</select>
            <label><input type="checkbox" id="catThreat"${F.threat ? ' checked' : ''}> Ameaçadas</label>
            <label><input type="checkbox" id="catAvail"${F.avail ? ' checked' : ''}> Disponíveis agora</label>
            <span class="cat-count" id="catCount"></span></div>`;
          html = (this.compact ? '' : filters) + sec('Terrestres — escolha e clique num recinto · Sexo:', land.map(mk), sexBtns) + sec('Aquáticos e marinhos', aqua.map(mk));
          break;
        }
        case 'build': {
          const fences = Object.values(ZM.FENCES).map((f) => {
            const locked = !z.isFenceUnlocked(f.id);
            return card({ icon: f.icon, name: f.name, price: U.money(f.cost) + '/m', locked, sel: sel('enclosure', f.id), act: { type: 'enclosure', param: f.id }, tip: `<b>${f.name}</b> (nível ${f.level})<br>${f.desc}<br>Arraste um retângulo para criar o recinto. O portão surge onde a cerca encosta num caminho.` });
          });
          const prefabs = ZM.PREFAB_ORDER.map((id) => {
            const p = ZM.PREFABS[id], locked = !z.isPrefabUnlocked(id);
            return card({ icon: p.icon, name: p.name, price: U.money(p.cost), locked, sel: sel('prefab', id), act: { type: 'prefab', param: id },
              tip: `<b>${p.name}</b> — ${p.w}×${p.h} · ${U.money(p.cost)}<br>${p.desc}<br>Vem pronto: água, parede de aquário, filtros e comedouros.<br>🐾 ${p.species.map((s) => ZM.SPECIES[s].name).join(', ')}<br>Encoste num caminho para criar o portão.${locked ? `<br>🔒 Pesquisa: <b>${ZM.RESEARCH[p.research].name}</b>` : ''}` });
          });
          html = sec('Habitats aquáticos prontos', prefabs) + sec('Recintos (arraste para cercar)', fences) +
            sec('Itens de recinto', ['feeder', 'trough', 'shelter', 'ball', 'logs', 'platform', 'hiddenfood'].map(objCard)) +
            sec('Aquático e polar', ['aquafeeder', 'filter', 'floattoy', 'icemaker', 'aquaview'].map(objCard)) +
            sec('Pesquisa', ['lab', 'genelab', 'aqualab'].map(objCard)) +
            sec('Manutenção e apoio', ['workshop', 'warehouse', 'staffroom', 'clinic'].map(objCard)) +
            sec('Visitantes', ['entrance', 'edu'].map(objCard));
          break;
        }
        case 'path':
          html = sec('Caminhos', [
            card({ icon: '🛤️', name: 'Caminho', price: U.money(ZM.PATH_COST) + '/tile', sel: sel('path'), act: { type: 'path' }, tip: '<b>Caminho</b><br>Arraste para construir (em L). Visitantes só andam por caminhos.' }),
            card({ icon: '⛏️', name: 'Remover caminho', price: '', sel: sel('removePath'), act: { type: 'removePath' }, tip: 'Arraste para remover caminhos.' }),
          ]);
          break;
        case 'nature': {
          const terr = ZM.TERRAIN.map((t) => { const locked = !z.isTerrainUnlocked(t.id); return card({ icon: t.icon, name: t.name, price: U.money(t.cost) + '/tile', locked, sel: sel('terrain', t.id), act: { type: 'terrain', param: t.id }, tip: `<b>${t.name}</b><br>Pinte o terreno (clique ou arraste). Dentro dos recintos, reproduza o bioma de cada espécie.${locked ? `<br>🔒 Pesquisa: <b>${ZM.RESEARCH[t.research].name}</b>` : ''}` }); });
          const brush = `<span class="brush">${[1, 2, 3].map((n) => `<button data-brush="${n}" class="${this.brush === n ? 'on' : ''}">${n}×${n}</button>`).join('')}</span>`;
          html = sec('Terreno', terr, brush) + sec('Plantas e rochas', ['acacia', 'palm', 'ipe', 'bigtree', 'bush', 'tallgrass', 'flowers', 'rock'].map(objCard));
          break;
        }
        case 'staff': {
          const cards = ZM.STAFF_ORDER.map((r) => {
            const role = ZM.STAFF_ROLES[r];
            return card({ icon: role.icon, name: role.name, price: U.money(role.salary) + '/dia', count: z.staffCount(r) || '', act: { type: 'hire', param: r }, tip: `<b>${role.name}</b><br>${role.desc}<br>Contratação: ${U.money(role.hire)} · Salário: ${U.money(role.salary)}/dia<br><i>Clique para contratar.</i>` });
          });
          cards.push(card({ icon: '📋', name: 'Ver equipe', act: { type: 'staffList' }, tip: 'Lista de funcionários, tarefas e demissões.' }));
          html = sec('Contratar funcionários', cards);
          break;
        }
        case 'shop':
          html = sec('Comida e lojas', ['snack', 'drinks', 'icecream', 'restaurant', 'souvenir'].map(objCard)) +
            sec('Infraestrutura', ['toilet', 'bench', 'bin', 'lamp', 'sign', 'info', 'fountain'].map(objCard));
          break;
      }
      // modo compacto: depois de escolher um item, mostra só a seção dele (libera o mapa)
      if (this.compact) {
        const tmp = document.createElement('div'); tmp.innerHTML = html;
        const secSel = [...tmp.querySelectorAll('.drawer-sec')].find((x) => x.querySelector('.card.sel'));
        if (secSel) {
          const btn = '<button class="btn" data-expand style="align-self:center;padding:6px 10px">⤢ Ver tudo</button>';
          html = secSel.outerHTML + btn;
        }
      }
      d.innerHTML = html;
      const ex = d.querySelector('[data-expand]');
      if (ex) ex.addEventListener('click', () => { this.compact = false; this.renderDrawer(); });
      d.querySelectorAll('.card').forEach((c) => c.addEventListener('click', () => {
        const act = JSON.parse(c.dataset.act);
        ZM.Audio.play('click');
        if (c.classList.contains('locked')) { this.toast({ text: '🔒 Bloqueado — veja a árvore de pesquisa.', type: 'info' }); return; }
        if (act.type === 'hire') {
          const r = z.hireStaff(act.param);
          if (!r.ok) { this.toast({ text: '❌ ' + r.reason, type: 'warn' }); ZM.Audio.play('error'); }
          else { this.toast({ text: `${ZM.STAFF_ROLES[act.param].icon} ${r.staff.name} foi contratado(a) como ${ZM.STAFF_ROLES[act.param].name.toLowerCase()}.`, type: 'good' }); this.select({ kind: 'staff', id: r.staff.id }); }
          this.renderDrawer();
          return;
        }
        if (act.type === 'staffList') { ZM.Modals.staffList(); return; }
        this.compact = true;
        ZM.Input.setTool(act);
        this.renderDrawer();
      }));
      d.querySelectorAll('[data-brush]').forEach((b) => b.addEventListener('click', () => { this.brush = +b.dataset.brush; this.renderDrawer(); }));
      requestAnimationFrame(() => { $('#alerts').style.bottom = (d.classList.contains('hidden') ? 96 : d.offsetHeight + 100) + 'px'; if (ZM.Input.tool.type !== 'select') ZM.UI.toolHint($('#toolHint').textContent); });
      d.querySelectorAll('[data-sex]').forEach((b) => b.addEventListener('click', () => { this.sexPref = b.dataset.sex; this.renderDrawer(); ZM.Input.updatePreview(); }));
      if (this.openCat === 'animals') this.bindCatalog(d);
    },
    /* busca e filtros do catálogo (filtra sem redesenhar, para não perder o foco da busca) */
    bindCatalog(d) {
      const F = this.catF;
      const q = d.querySelector('#catQ');
      if (q) q.addEventListener('input', () => { F.q = q.value; this.applyCatalog(d); });
      d.querySelectorAll('[data-cont]').forEach((b) => b.addEventListener('click', () => { F.cont = b.dataset.cont; d.querySelectorAll('[data-cont]').forEach((x) => x.classList.toggle('on', x === b)); this.applyCatalog(d); }));
      const bi = d.querySelector('#catBiome'); if (bi) bi.addEventListener('change', () => { F.biome = bi.value; this.applyCatalog(d); });
      const th = d.querySelector('#catThreat'); if (th) th.addEventListener('change', () => { F.threat = th.checked; this.applyCatalog(d); });
      const av = d.querySelector('#catAvail'); if (av) av.addEventListener('change', () => { F.avail = av.checked; this.applyCatalog(d); });
      this.applyCatalog(d);
    },
    applyCatalog(d) {
      const F = this.catF, q = U.norm ? U.norm(F.q.trim()) : F.q.trim().toLowerCase();
      let shown = 0, total = 0;
      d.querySelectorAll('.card[data-name]').forEach((c) => {
        total++;
        const name = U.norm ? U.norm(c.dataset.name) : c.dataset.name;
        const ok = (!q || name.includes(q)) && (F.cont === 'all' || c.dataset.cont === F.cont) && (F.biome === 'all' || c.dataset.biome === F.biome) &&
          (!F.threat || ['VU', 'EN', 'CR'].includes(c.dataset.status)) && (!F.avail || c.dataset.avail === '1');
        c.style.display = ok ? '' : 'none';
        if (ok) shown++;
      });
      d.querySelectorAll('.drawer-sec').forEach((sc) => { const any = [...sc.querySelectorAll('.card[data-name]')].some((c) => c.style.display !== 'none'); if (sc.querySelector('.card[data-name]')) sc.style.display = any ? '' : 'none'; });
      const cnt = d.querySelector('#catCount'); if (cnt) cnt.textContent = shown === total ? `${total} espécies` : `${shown} de ${total}`;
    },

    /* ---------- prévia de compra (ao passar o mouse com a ferramenta de animal) ---------- */
    showBuyPreview(spId, encId, sex) {
      const box = $('#buyPreview');
      if (!spId || encId == null) { box.classList.add('hidden'); this.bpKey = null; return; }
      const z = this.zoo;
      const key = [spId, encId, sex, z.animals.length, z.objects.size, Math.floor(z.absMinutes / 2)].join(':');
      if (key === this.bpKey) { box.classList.remove('hidden'); return; }
      this.bpKey = key;
      box.innerHTML = this.purchaseHTML(spId, encId, sex);
      box.classList.remove('hidden');
      box.style.bottom = ($('#drawer').classList.contains('hidden') ? 96 : $('#drawer').offsetHeight + 100) + 'px';
    },
    purchaseHTML(spId, encId, sex, withButton) {
      const z = this.zoo, sp = ZM.SPECIES[spId], e = z.enclosures.get(encId);
      const r = ZM.Diagnostics.purchase(z, spId, encId, sex);
      const V = { ok: ['✅', 'Compra adequada', 'ok'], caution: ['⚠️', 'Dá para comprar, com atenção', 'warn'], risky: ['⛔', 'Compra arriscada — entenda as consequências', 'bad'], blocked: ['🚫', 'Não é possível comprar', 'bad'] }[r.verdict];
      const ic = { ok: '✔', info: 'ℹ', warn: '!', bad: '✖' };
      return `<div class="bp-head ${V[2]}"><span>${ZM.speciesIcon(spId)}</span><div><b>${U.esc(sp.name)} → ${U.esc(e ? e.name : '')}</b><small>${V[0]} ${V[1]}${r.blocked ? ': ' + U.esc(r.blocked) : ''}</small></div><span class="bp-price">${U.money(sp.price)}${sp.cp && !z.sandbox ? ` · ${sp.cp}🧬` : ''}</span></div>
        <ul class="bp-list">${r.items.map((it) => `<li class="${it.sev}"><i>${ic[it.sev]}</i>${U.esc(it.text)}</li>`).join('')}</ul>
        ${withButton ? `<div class="btns"><button class="btn ${r.verdict === 'ok' ? 'good' : r.verdict === 'blocked' ? '' : 'warnb'}" data-act="confirmBuy" ${r.verdict === 'blocked' ? 'disabled' : ''}>${r.verdict === 'risky' ? 'Comprar mesmo assim' : 'Confirmar compra'} (${U.money(sp.price)})</button><button class="btn" data-act="cancelBuy">Cancelar</button></div>` : '<small class="bp-foot">Clique para comprar · botão direito cancela</small>'}`;
    },

    toolHint(text) {
      const h = $('#toolHint');
      if (!text) { h.classList.add('hidden'); return; }
      h.textContent = text; h.classList.remove('hidden');
      h.style.bottom = $('#drawer').classList.contains('hidden') ? '84px' : ($('#drawer').offsetHeight + 90) + 'px';
    },
    syncToolButtons() {
      const t = ZM.Input.tool.type;
      document.querySelectorAll('#toolbar [data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === t));
    },

    /* ---------- seleção ---------- */
    select(sel) {
      this.selected = sel;
      ZM.game.renderer.selected = sel;
      ZM.Panels.show(sel);
    },

    /* ---------- alertas ---------- */
    /* alertas repetidos viram um só (com contador); os que pedem ação ficam no topo */
    toast(a) {
      const box = $('#alerts');
      const type = a.type || 'info';
      const PR = { danger: 3, warn: 2, good: 1, info: 0 };
      const key = a.key || (type + ':' + String(a.text).replace(/[\d.,:%]+/g, '#'));
      let el = [...box.children].find((c) => c.dataset.key === key);
      if (el) {
        el.dataset.count = (+el.dataset.count || 1) + 1;
        el.querySelector('.tx').textContent = a.text;
        const c = el.querySelector('.cnt'); c.textContent = '×' + el.dataset.count; c.classList.remove('hidden');
        el.classList.remove('fade');
        el._a = a;
      } else {
        el = document.createElement('div');
        el.className = 'toast ' + type;
        el.dataset.key = key; el.dataset.pr = PR[type] || 0; el.dataset.count = 1;
        el.innerHTML = `<span class="tx"></span><span class="cnt hidden"></span>${a.target ? '<span class="go" title="Localizar">📍</span>' : ''}`;
        el.querySelector('.tx').textContent = a.text;
        el._a = a;
        el.addEventListener('click', () => {
          const t = el._a.target;
          if (t) {
            ZM.game.renderer.centerOn(t.x, t.y);
            if (t.kind === 'animal') this.select({ kind: 'animal', id: t.id });
            if (t.kind === 'object') this.select({ kind: 'object', id: t.id });
            if (t.kind === 'enclosure') this.select({ kind: 'enclosure', id: t.id });
          }
          el.remove();
        });
      }
      // posição: prioridade maior primeiro; dentro da mesma prioridade, o mais recente em cima
      const pr = +el.dataset.pr;
      const before = [...box.children].find((c) => c !== el && +c.dataset.pr <= pr);
      if (before) box.insertBefore(el, before); else box.appendChild(el);
      // limite: descarta primeiro os menos importantes e mais antigos
      while (box.children.length > 6) {
        const kids = [...box.children];
        const low = kids.reduce((m, c) => (+c.dataset.pr <= +m.dataset.pr ? c : m), kids[0]);
        low.remove();
      }
      clearTimeout(el._t1); clearTimeout(el._t2);
      const life = type === 'danger' ? 14000 : type === 'warn' ? 10000 : 6500;
      el._t1 = setTimeout(() => { el.classList.add('fade'); el._t2 = setTimeout(() => el.remove(), 500); }, life);
      if ((type === 'warn' || type === 'danger') && el.dataset.count === '1') ZM.Audio.play(type === 'danger' ? 'alert' : 'click');
    },
    dayToast(rec) {
      this.toast({ text: `📅 Fim do dia ${rec.day}: receita ${U.money(rec.income)}, despesas ${U.money(rec.expense)}, ${rec.profit >= 0 ? 'lucro' : 'prejuízo'} ${U.money(Math.abs(rec.profit))} · ${rec.visitors} visitantes.`, type: rec.profit >= 0 ? 'good' : 'warn' });
    },

    /* ---------- missões e tutorial ---------- */
    renderMissions() {
      const z = this.zoo, box = $('#missionTracker');
      const sc = z.scenario;
      if (!sc.goals || !sc.goals.length) { box.innerHTML = ''; $('#tutorialBox').classList.add('hidden'); return; }
      const cur = z.missions.currentIndex();
      const items = sc.goals.map((g, i) => {
        const done = z.missions.completed.includes(i);
        const isCur = sc.sequential ? i === cur : !done;
        return `<li class="${done ? 'done' : isCur && sc.sequential ? 'cur' : ''}" data-i="${i}"><span class="ck">${done ? '✓' : ''}</span><span>${U.esc(g.text)}</span><span class="pg"></span></li>`;
      }).join('');
      box.innerHTML = `<h4>🎯 ${U.esc(sc.name)}<span class="sub">${z.missions.completed.length}/${sc.goals.length}</span></h4><ul>${items}</ul>`;
      box.querySelector('h4').addEventListener('click', () => box.classList.toggle('collapsed'));
      this.renderMissionProgress();
      this.renderTutorial();
    },
    renderMissionProgress() {
      const z = this.zoo; if (!z) return;
      const box = $('#missionTracker');
      box.querySelectorAll('li').forEach((li) => {
        const i = +li.dataset.i;
        const pg = z.missions.progressOf(i);
        const el = li.querySelector('.pg');
        const g = z.scenario.goals[i];
        const done = z.missions.completed.includes(i);
        let txt = pg && !done ? `${pg[0].toLocaleString('pt-BR')}/${pg[1].toLocaleString('pt-BR')}` : '';
        let tip = '';
        if (g && g.sustain && !done) {
          const live = z.missions.liveOk(i);
          txt = `${live ? '🟢' : '🔴'} ${pg[0]}/${pg[1]} dias`;
          tip = live ? 'A condição está sendo cumprida agora. Mantenha até o fim do dia para somar mais um dia seguido.' : 'A condição NÃO está sendo cumprida agora. Se continuar assim no fim do dia, a sequência zera.';
        }
        if (el.textContent !== txt) el.textContent = txt;
        if (tip && el.dataset.tip !== tip) el.dataset.tip = tip;
      });
    },
    renderTutorial() {
      const z = this.zoo, sc = z.scenario, box = $('#tutorialBox');
      document.querySelectorAll('.pulse').forEach((e) => e.classList.remove('pulse'));
      if (!sc.tutorial || z.missions.finished) { box.classList.add('hidden'); return; }
      const i = z.missions.currentIndex();
      const g = sc.goals[i];
      if (!g) { box.classList.add('hidden'); return; }
      box.innerHTML = `<span class="ti">🧑‍🏫</span><div><b>Passo ${i + 1} de ${sc.goals.length}</b>${U.esc(g.hint || g.text)}</div>`;
      box.classList.remove('hidden');
      if (g.hl === 'open') $('#btnOpen').classList.add('pulse');
      else if (g.hl) { const b = document.querySelector(`#toolbar [data-cat="${g.hl}"]`); if (b) b.classList.add('pulse'); }
    },

    /* ---------- protocolo de fuga ---------- */
    updateProtocol() {
      const z = this.zoo, box = $('#protocol');
      const a = z.animals.find((x) => x.escaped);
      if (!a) { if (!box.classList.contains('hidden')) box.classList.add('hidden'); return; }
      const sec = z.staffCount('security') > 0, vet = z.staffCount('vet') > 0;
      const tranq = a.state === 'TRANQ' || a.state === 'RETURN';
      const ret = a.state === 'RETURN';
      const steps = [
        ['🚨 Alerta', true, false],
        ['🚧 Área isolada', true, false],
        ['👮 Segurança', sec, !sec],
        ['🧑‍⚕️ Veterinário', vet, false],
        ['💉 Tranquilização', tranq, sec && !tranq],
        ['🏠 Retorno', false, ret],
      ];
      const html = `<h4>🚨 Animal fugitivo: ${U.esc(a.name)} (${U.esc(a.sp.name)}) <button class="btn" id="protoGo" style="margin-left:auto">Ver</button></h4>
        <div class="steps">${steps.map(([n, ok, now]) => `<div class="step ${ok ? 'ok' : now ? 'now' : ''}">${n}</div>`).join('')}</div>
        ${!sec ? '<p style="margin:6px 0 0;font-size:12px">Sem seguranças! Contrate um agora — ou uma equipe externa cobrará R$ 3.000.</p>' : ''}`;
      if (box.dataset.k !== html) {
        box.innerHTML = html; box.dataset.k = html;
        box.querySelector('#protoGo').addEventListener('click', () => { ZM.game.renderer.centerOn(a.x, a.y); this.select({ kind: 'animal', id: a.id }); });
      }
      box.classList.remove('hidden');
    },

    /* ---------- tooltip ---------- */
    initTooltips() {
      const tip = $('#tooltip');
      document.addEventListener('mouseover', (e) => {
        const el = e.target.closest('[data-tip]');
        if (!el || !el.dataset.tip) { tip.classList.add('hidden'); return; }
        tip.innerHTML = el.dataset.tip;
        tip.classList.remove('hidden');
        const r = el.getBoundingClientRect();
        const tw = tip.offsetWidth, th = tip.offsetHeight;
        let x = r.left + r.width / 2 - tw / 2, y = r.top - th - 8;
        if (y < 4) y = r.bottom + 8;
        x = U.clamp(x, 4, window.innerWidth - tw - 4);
        tip.style.left = x + 'px'; tip.style.top = y + 'px';
      });
      document.addEventListener('mousedown', () => tip.classList.add('hidden'));
    },

    /* ---------- minimapa ---------- */
    drawMinimap() {
      const z = this.zoo; if (!z) return;
      const c = $('#minimap'); const g = c.getContext('2d');
      const m = z.map;
      const W = c.width, H = c.height;
      g.fillStyle = '#1d2e17'; g.fillRect(0, 0, W, H);
      // projeção isométrica reduzida
      const s = W / (m.w + m.h);
      const P = (x, y) => [(x - y) * s + m.h * s, (x + y) * s * 0.5 + 4];
      if (!this.mmCache || this.mmV !== m.version + ':' + z.objects.size) {
        const oc = this.mmCache || document.createElement('canvas'); oc.width = W; oc.height = H;
        const og = oc.getContext('2d');
        for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
          const i = m.idx(x, y);
          let col = ZM.TERRAIN[m.terrain[i]].color;
          if (m.path[i]) col = '#e8dcc0';
          else if (m.enc[i]) col = U.shade(col, -0.15);
          if (m.obj[i] >= 0) { const o = z.objects.get(m.obj[i]); if (o && o.def.cat !== 'nature') col = '#d36b4c'; else if (o && o.def.kind === 'tree') col = '#2f5a24'; }
          const [px, py] = P(x, y);
          og.fillStyle = col; og.fillRect(px, py, s * 2 + 0.5, s + 0.5);
        }
        this.mmCache = oc; this.mmV = m.version + ':' + z.objects.size;
      }
      g.drawImage(this.mmCache, 0, 0);
      g.fillStyle = '#ffd35c';
      z.animals.forEach((a) => { const [px, py] = P(a.x, a.y); g.fillRect(px, py, 2, 2); });
      g.fillStyle = '#ffffff';
      z.visitors.forEach((v, k) => { if (k % 2) return; const [px, py] = P(v.x, v.y); g.fillRect(px, py, 1, 1); });
      // retângulo da câmera
      const r = ZM.game.renderer;
      const c0 = r.screenToTile(0, 0), c1 = r.screenToTile(r.w, r.h);
      const [ax, ay] = P(c0[0], c0[1]), [bx, by] = P(c1[0], c1[1]);
      const left = Math.min(ax, bx), top = Math.min(...[P(c0[0], c0[1])[1], P(r.screenToTile(r.w, 0)[0], r.screenToTile(r.w, 0)[1])[1]]);
      const tl = r.screenToTile(0, 0), br = r.screenToTile(r.w, r.h), tr = r.screenToTile(r.w, 0), bl = r.screenToTile(0, r.h);
      const pts = [tl, tr, br, bl].map((p) => P(p[0], p[1]));
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1;
      g.strokeRect(Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1])));
      void left; void top;
    },
    minimapClick(e) {
      const z = this.zoo, m = z.map, c = $('#minimap');
      const rect = c.getBoundingClientRect();
      const px = (e.clientX - rect.left) * (c.width / rect.width), py = (e.clientY - rect.top) * (c.height / rect.height);
      const s = c.width / (m.w + m.h);
      const a = (px - m.h * s) / s, b = (py - 4) / (s * 0.5);
      const x = (a + b) / 2, y = (b - a) / 2;
      ZM.game.renderer.centerOn(x, y);
    },
  };

  /* ícone representativo por espécie (UI) */
  const ICONS = { capivara: '🦫', zebra: '🦓', leao: '🦁', girafa: '🦒', flamingo: '🦩', anta: '🐗', tamandua: '🐜', jacare: '🐊', arara: '🦜', loboguara: '🦊', onca: '🐆', mico: '🐒', chimpanze: '🐵', hipopotamo: '🦛', elefante: '🐘',
    tigre: '🐅', ursopardo: '🐻', lobo: '🐺', sucuarana: '🐈', rinoceronte: '🦏', avestruz: '🐦', ema: '🐓', canguru: '🦘', suricato: '🐿️', gorila: '🦍', tatucanastra: '🦔', tucano: '🐤', quati: '🦝', vinagre: '🐕', preguica: '🦥',
    ariranha: '🦦', peixeboi: '🐋', boto: '🐬', pinguim: '🐧', leaomarinho: '🦭', tartaruga: '🐢', golfinho: '🐬', tubarao: '🦈', ursopolar: '🐻‍❄️' };
  function speciesIcon(id) { return ICONS[id] || '🐾'; }
  ZM.speciesIcon = speciesIcon;

  ZM.UI = UI;
})(window.ZM);
