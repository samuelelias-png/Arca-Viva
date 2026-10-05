/* =========================================================
   Janelas: painel de métricas, pesquisa, equipe, menus
   ========================================================= */
(function (ZM) {
  'use strict';
  const U = ZM.util;
  const $ = (s) => document.querySelector(s);

  const M = {
    get zoo() { return ZM.game.zoo; },
    open(html, small, onClose) {
      const m = $('#modal'), card = m.querySelector('.modal-card');
      card.className = 'modal-card' + (small ? ' small' : '');
      card.innerHTML = `<button class="modal-x" data-x>✕</button>` + html;
      m.classList.remove('hidden');
      this.onClose = onClose;
      card.querySelector('[data-x]').addEventListener('click', () => this.close());
      m.onclick = (e) => { if (e.target === m) this.close(); };
      this.isOpen = true;
      return card;
    },
    close() {
      $('#modal').classList.add('hidden');
      this.isOpen = false;
      if (this.onClose) { const f = this.onClose; this.onClose = null; f(); }
    },

    /* ---------------- Painel ---------------- */
    dashboard(tab = 'fin') {
      const z = this.zoo;
      const card = this.open(`<h2>📊 Painel do zoológico</h2><p class="lead">Dia ${z.day} · ${U.esc(z.scenario.name)}</p>
        <div class="tabs"><button data-tab="fin">💰 Finanças</button><button data-tab="zoo">🦓 Zoológico</button><button data-tab="log">📜 Registro</button></div><div id="dashBody"></div>`);
      const show = (t) => {
        card.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
        const body = card.querySelector('#dashBody');
        if (t === 'fin') this.finTab(body); else if (t === 'zoo') this.zooTab(body); else this.logTab(body);
      };
      card.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));
      show(tab);
    },
    /* separa resultado operacional (dia a dia) de investimentos (obras e compras) */
    splitDay(day) {
      const inv = ZM.INVEST_CATS;
      const r = { opIn: 0, opOut: 0, invIn: 0, invOut: 0 };
      Object.keys(day.income).forEach((k) => { if (inv.includes(k)) r.invIn += day.income[k]; else r.opIn += day.income[k]; });
      Object.keys(day.expense).forEach((k) => { if (inv.includes(k)) r.invOut += day.expense[k]; else r.opOut += day.expense[k]; });
      r.op = r.opIn - r.opOut; r.inv = r.invIn - r.invOut;
      return r;
    },
    /* previsão de despesas recorrentes por dia */
    forecast() {
      const z = this.zoo;
      const sal = z.staff.reduce((t, x) => t + x.salary, 0);
      let up = 0; z.objects.forEach((o) => (up += o.def.upkeep || 0)); up = (up + z.enclosures.size * 20) * z.mods.utility;
      let care = 0; z.animals.forEach((a) => (care += Math.max(6, a.sp.price * 0.004)));
      const hist = z.econ.history.slice(-3);
      const avg = (cats) => hist.length ? hist.reduce((t, h) => t + cats.reduce((s2, c) => s2 + (h.breakdown.expense[c] || 0), 0), 0) / hist.length : 0;
      const food = avg(['alimentacao', 'agua']), vet = avg(['veterinario']), stock = avg(['estoque', 'manutencao']);
      const items = [['Salários', sal, 'fixo'], ['Energia, operação e manutenção das construções', up, 'fixo'], ['Cuidados diários com os animais', care, 'fixo'], ['Alimentação e água (média 3 dias)', food, 'variável'], ['Estoque das lojas e reparos (média 3 dias)', stock, 'variável'], ['Veterinário (média 3 dias)', vet, 'variável']];
      const total = items.reduce((t, x) => t + x[1], 0);
      const opIn = hist.length ? hist.reduce((t, h) => t + this.splitDay(h.breakdown).opIn, 0) / hist.length : 0;
      return { items, total, opIn, days: hist.length };
    },
    finTab(body) {
      const z = this.zoo;
      const tot = z.econ.totals();
      const last = z.econ.history[z.econ.history.length - 1];
      const rows = (obj, sign) => Object.keys(obj).filter((k) => Math.abs(obj[k]) >= 0.5).sort((a, b) => obj[b] - obj[a]).map((k) => `<tr><td>${ZM.LEDGER_LABELS[k] || k}${ZM.INVEST_CATS.includes(k) ? ' <small class="tag inv">investimento</small>' : ''}</td><td style="color:${sign > 0 ? 'var(--good)' : 'var(--bad)'}">${sign > 0 ? '+' : '-'}${U.money(obj[k])}</td></tr>`).join('') || '<tr><td colspan="2" style="color:var(--muted)">—</td></tr>';
      const src = last ? last.breakdown : z.econ.today;
      const fair = z.fairPrice();
      const sp = this.splitDay(z.econ.today);
      const fc = this.forecast();
      const shops = z.objects ? [...z.objects.values()].filter((o) => o.def.kind === 'shop' || o.def.kind === 'toilet') : [];
      const R = { fila: 'fila', espera: 'espera', preco: 'preço', dinheiro: 'sem dinheiro', quebrado: 'quebrado' };
      const shopRows = shops.sort((a, b) => (b.revenue || 0) - (a.revenue || 0)).map((o) => {
        const lost = o.lostReasons || {}, top = Object.keys(lost).sort((a, b) => lost[b] - lost[a])[0];
        const margin = o.def.kind === 'shop' ? (o.revenue || 0) - (o.sales || 0) * o.def.unitCost : 0;
        const conn = z.isConnected(o);
        return `<tr><td>${o.def.icon} ${o.def.name}${conn ? '' : ' <small class="tag" style="background:#8b2f27">sem acesso</small>'}</td><td>${o.def.kind === 'shop' ? `${o.salesToday || 0} / ${o.sales || 0}` : `${o.served || 0}`}</td><td>${o.def.kind === 'shop' ? U.money(o.revenueToday || 0) : '—'}</td><td>${o.def.kind === 'shop' ? U.money(margin) : '—'}</td><td>${z.queueOf(o).length}/${z.serviceSlots(o)}</td><td style="color:${(o.gaveUpToday || 0) ? 'var(--warn)' : 'inherit'}">${o.gaveUpToday || 0}${top ? ` <small>(${R[top] || top})</small>` : ''}</td></tr>`;
      }).join('');
      body.innerHTML = `
        <div class="kpis">
          <div class="kpi"><div class="k">Caixa</div><div class="v ${z.money < 0 ? 'neg' : ''}">${z.sandbox ? '∞' : U.money(z.money)}</div></div>
          <div class="kpi" data-tip="Receitas do dia a dia (ingressos, lojas, doações, conservação, patrocínios) menos custos recorrentes (salários, operação, comida, cuidados). Não inclui obras nem compras."><div class="k">Resultado operacional hoje</div><div class="v ${sp.op >= 0 ? 'pos' : 'neg'}">${U.money(sp.op)}</div></div>
          <div class="kpi" data-tip="Construções, compra de animais, contratações e pesquisas, menos reembolsos de demolição e vendas de animais."><div class="k">Investimentos hoje</div><div class="v ${sp.inv >= 0 ? 'pos' : 'neg'}">${U.money(sp.inv)}</div></div>
          <div class="kpi"><div class="k">Saldo do dia</div><div class="v ${tot.profit >= 0 ? 'pos' : 'neg'}">${U.money(tot.profit)}</div></div>
          <div class="kpi" data-tip="Custos que se repetem todos os dias com a estrutura atual."><div class="k">Custo recorrente previsto</div><div class="v neg">${U.money(fc.total)}/dia</div></div>
        </div>
        <div class="cols2">
          <div>
            <div class="chart-wrap"><canvas id="finChart" width="440" height="200" style="width:100%"></canvas>
              <div class="legend-row"><span><i style="background:#7bd389"></i>Receita</span><span><i style="background:#ff6b5b"></i>Despesas</span><span><i style="background:#ffd35c"></i>Lucro</span></div></div>
            <h3 style="margin:16px 0 6px">🎟️ Preço do ingresso</h3>
            <input type="range" id="ticketRange" min="0" max="60" step="1" value="${z.ticketPrice}">
            <div class="kv"><span>Preço</span><span><b id="ticketVal">${U.money(z.ticketPrice)}</b></span></div>
            <div class="kv"><span>Valor percebido (justo)</span><span>${U.money(fair)}</span></div>
            <div class="kv"><span>Fluxo estimado agora</span><span id="ticketFlow">${Math.round(z.spawnRate())} visitantes/h</span></div>
            <p style="font-size:12px;color:var(--muted)">Preço baixo atrai mais gente com menor renda por pessoa. Preço alto afasta visitantes e gera reclamações. O valor justo cresce com a atratividade e a reputação.</p>
          </div>
          <div>
            <h3 style="margin:0 0 6px">📅 Previsão de despesas recorrentes</h3>
            <table class="ledger">${fc.items.map(([n, v, k]) => `<tr><td>${n} <small style="color:var(--muted)">${k}</small></td><td style="color:var(--bad)">-${U.money(v)}</td></tr>`).join('')}<tr><td><b>Total por dia</b></td><td style="color:var(--bad)"><b>-${U.money(fc.total)}</b></td></tr>
            ${fc.days ? `<tr><td>Receita operacional média (${fc.days} dia${fc.days > 1 ? 's' : ''})</td><td style="color:var(--good)">+${U.money(fc.opIn)}</td></tr><tr><td><b>Margem operacional esperada</b></td><td style="color:${fc.opIn - fc.total >= 0 ? 'var(--good)' : 'var(--bad)'}"><b>${U.money(fc.opIn - fc.total)}/dia</b></td></tr>` : '<tr><td colspan="2" style="color:var(--muted)">A receita média aparece depois do primeiro dia completo.</td></tr>'}</table>
            <h3 style="margin:14px 0 6px">${last ? `Dia ${last.day} (fechado)` : 'Hoje (parcial)'}</h3>
            <table class="ledger"><tr><td colspan="2"><b>Receitas</b></td></tr>${rows(src.income, 1)}<tr><td colspan="2"><b>Despesas</b></td></tr>${rows(src.expense, -1)}</table>
          </div>
        </div>
        <h3 style="margin:16px 0 6px">🏪 Desempenho das lojas e banheiros</h3>
        ${shopRows ? `<table class="ledger shops"><tr><th>Serviço</th><th>Vendas/atend. (hoje / total)</th><th>Receita hoje</th><th>Margem total</th><th>Fila / capacidade</th><th>Desistências hoje</th></tr>${shopRows}</table>` : '<p style="color:var(--muted)">Nenhuma loja construída.</p>'}`;
      const r = body.querySelector('#ticketRange');
      r.addEventListener('input', () => { z.ticketPrice = +r.value; body.querySelector('#ticketVal').textContent = U.money(z.ticketPrice); body.querySelector('#ticketFlow').textContent = Math.round(z.spawnRate()) + ' visitantes/h'; });
      this.drawFinChart(body.querySelector('#finChart'));
    },
    drawFinChart(c) {
      const z = this.zoo, g = c.getContext('2d');
      const hist = z.econ.history.slice(-14);
      const t = z.econ.totals();
      const data = hist.map((h) => ({ d: 'D' + h.day, i: h.income, e: h.expense, p: h.profit }));
      data.push({ d: 'Hoje', i: t.income, e: t.expense, p: t.profit, partial: true });
      const W = c.width, H = c.height, pad = 30;
      g.clearRect(0, 0, W, H);
      const max = Math.max(100, ...data.map((d) => Math.max(d.i, d.e)));
      const min = Math.min(0, ...data.map((d) => d.p));
      const sy = (v) => H - pad - ((v - min) / (max - min)) * (H - pad * 1.6);
      g.strokeStyle = 'rgba(255,255,255,0.1)'; g.fillStyle = '#b9c2a8'; g.font = '10px Nunito, sans-serif'; g.textAlign = 'right';
      for (let k = 0; k <= 4; k++) { const v = min + (max - min) * k / 4; const y = sy(v); g.beginPath(); g.moveTo(pad + 10, y); g.lineTo(W, y); g.stroke(); g.fillText(Math.round(v / 100) / 10 + 'k', pad + 6, y + 3); }
      const bw = (W - pad - 20) / data.length;
      data.forEach((d, i) => {
        const x = pad + 14 + i * bw;
        g.globalAlpha = d.partial ? 0.55 : 1;
        g.fillStyle = '#7bd389'; g.fillRect(x, sy(d.i), bw * 0.36, sy(0) - sy(d.i));
        g.fillStyle = '#ff6b5b'; g.fillRect(x + bw * 0.38, sy(d.e), bw * 0.36, sy(0) - sy(d.e));
        g.globalAlpha = 1;
        g.fillStyle = '#b9c2a8'; g.textAlign = 'center'; g.fillText(d.d, x + bw * 0.37, H - 10);
      });
      g.strokeStyle = '#ffd35c'; g.lineWidth = 2; g.beginPath();
      data.forEach((d, i) => { const x = pad + 14 + i * bw + bw * 0.37; const y = sy(d.p); i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.stroke();
      data.forEach((d, i) => { const x = pad + 14 + i * bw + bw * 0.37; g.fillStyle = '#ffd35c'; g.beginPath(); g.arc(x, sy(d.p), 2.5, 0, 6.3); g.fill(); });
    },
    zooTab(body) {
      const z = this.zoo;
      const sp = z.speciesList();
      const kp = (k, v, cls = '') => `<div class="kpi"><div class="k">${k}</div><div class="v ${cls}">${v}</div></div>`;
      const spRows = sp.map((id) => {
        const s = ZM.SPECIES[id], list = z.animals.filter((a) => a.species === id);
        const w = list.reduce((a, b) => a + b.welfare, 0) / list.length;
        const mm = list.filter((a) => a.sex === 'M').length;
        return `<tr><td>${ZM.speciesIcon(id)} ${s.name} <span class="tag" style="background:${ZM.STATUS[s.status].color};color:#111">${s.status}</span></td><td>♂ ${mm} · ♀ ${list.length - mm} · ${Math.round(w)}%</td></tr>`;
      }).join('');
      body.innerHTML = `<div class="kpis">
        ${kp('Reputação', '★ ' + z.reputation.toFixed(2))}
        ${kp('Satisfação', Math.round(z.stats.satAvg) + '%')}
        ${kp('Bem-estar animal', z.animals.length ? Math.round(z.avgWelfare()) + '%' : '—')}
        ${kp('Educação', Math.round(z.education) + '%')}
        ${kp('Conservação', Math.floor(z.cp) + ' 🧬')}
        ${kp('Visitantes (total)', z.stats.totalVisitors.toLocaleString('pt-BR'))}
        ${kp('Hoje', z.stats.visitorsToday)}
        ${kp('Espécies', sp.length)}
        ${kp('Animais', z.animals.length)}
        ${kp('Nascimentos', z.stats.births)}
        ${kp('Funcionários', z.staff.length)}
        ${kp('Fugas', z.stats.escapes, z.stats.escapes ? 'neg' : '')}
      </div>
      <div class="cols2"><div><h3 style="margin:0 0 6px">Espécies</h3><table class="ledger">${spRows || '<tr><td>Nenhuma ainda.</td></tr>'}</table></div>
      <div><h3 style="margin:0 0 6px">Como a reputação é calculada</h3><p style="font-size:13px;color:var(--muted);line-height:1.5">30% satisfação dos visitantes · 30% bem-estar animal · 18% diversidade e conservação · 12% educação ambiental · 10% limpeza dos caminhos. Mortes, fugas, protestos e fiscalizações também afetam.</p>
      <h3 style="margin:12px 0 6px">💬 O que os visitantes dizem</h3><ul class="thoughts">${(ZM.UI.thoughts || []).slice(0, 8).map((t) => `<li style="border-left:3px solid ${t.mood > 0 ? 'var(--good)' : 'var(--bad)'}">“${U.esc(t.text)}” <small style="color:var(--muted)">— ${U.esc(t.name)}</small></li>`).join('') || '<li>Ainda sem comentários.</li>'}</ul>
      <h3 style="margin:12px 0 6px">Histórico (últimos dias)</h3><table class="ledger">${z.econ.history.slice(-7).reverse().map((h) => `<tr><td>Dia ${h.day}: ${h.visitors} visitantes · satisfação ${h.satisfaction}%</td><td style="color:${h.profit >= 0 ? 'var(--good)' : 'var(--bad)'}">${U.money(h.profit)}</td></tr>`).join('') || '<tr><td>—</td></tr>'}</table></div></div>`;
    },
    logTab(body) {
      const z = this.zoo;
      body.innerHTML = `<div class="log">${z.alerts.map((a) => `<div class="${a.type}"><small>Dia ${a.day} ${a.time}</small>${U.esc(a.text)}</div>`).join('') || '<p>Nada registrado ainda.</p>'}</div>`;
    },

    /* ---------------- Pesquisa ---------------- */
    research() {
      const z = this.zoo, R = z.research;
      const labs = z.objectsOfKind('lab').length, res = z.staffCount('researcher');
      const labNames = z.objectsOfKind('lab').map((o) => o.def.name);
      const cols = Object.keys(ZM.RESEARCH_CATS).map((cat) => {
        const c = ZM.RESEARCH_CATS[cat];
        const nodes = ZM.RESEARCH_LIST.filter((r) => r.cat === cat).map((r) => {
          const done = R.isDone(r.id), active = R.active === r.id, avail = R.available(r.id);
          const cls = done ? 'done' : active ? 'active' : avail ? '' : 'locked';
          let act = '';
          if (done) act = '<span class="tag" style="background:#2f7d3b">✅ Concluída</span>';
          else if (active) act = `<div class="bar"><i style="width:${(R.progress / r.rp) * 100}%;background:#ffd35c"></i></div><small>${R.progress.toFixed(1)} / ${r.rp} PP</small>`;
          else if (avail) act = `<button class="btn primary" data-r="${r.id}">${R.saved[r.id] != null ? 'Retomar' : 'Iniciar · ' + U.money(r.money)}</button> <small>${r.rp} PP</small>`;
          else act = `<small>🔒 Requer: ${[...r.req.filter((q) => !R.isDone(q)).map((q) => ZM.RESEARCH[q].name), ...(r.reqBuilding && !z.countObjects(r.reqBuilding) ? ['construir ' + ZM.OBJECTS[r.reqBuilding].name] : [])].join(', ')}</small>`;
          return `<div class="rnode ${cls}"><div class="rn">${r.name}</div><div class="rd">${r.desc}</div>${act}</div>`;
        }).join('');
        return `<div class="rcol"><h3>${c.icon} ${c.name}</h3>${nodes}</div>`;
      }).join('');
      const warn = !labs ? '⚠️ Construa um <b>Centro de Pesquisa</b> (Construção ▸ Prédios) e contrate <b>Pesquisadores</b>.' : !res ? '⚠️ Contrate <b>Pesquisadores</b> para gerar pontos.' : `✅ ${res} pesquisador(es) gerando ~${(res * z.researchRate()).toFixed(1)} PP por hora de jogo em: ${[...new Set(labNames)].join(', ')}.`;
      const card = this.open(`<h2>🔬 Pesquisa</h2><p class="lead">${warn}</p><div class="rtree">${cols}</div>`);
      card.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => {
        const r = R.start(b.dataset.r);
        if (!r.ok) { ZM.UI.toast({ text: '❌ ' + r.reason, type: 'warn' }); ZM.Audio.play('error'); }
        else ZM.Audio.play('click');
        this.research();
      }));
    },

    /* ---------------- Equipe ---------------- */
    staffList() {
      const z = this.zoo;
      const rows = z.staff.map((s) => `<tr><td>${s.def.icon} <b>${U.esc(s.name)}</b><br><small style="color:var(--muted)">${s.def.name} · ${U.esc(s.label)}</small></td><td>${s.tasksDone} tarefas${s.busyPct != null ? `<br><small style="color:${s.busyPct > 85 ? 'var(--bad)' : 'var(--muted)'}">${s.busyPct}% ocupado</small>` : ''}</td><td>${U.money(s.salary)}/dia</td><td><button class="btn" data-go="${s.id}">Ver</button> <button class="btn danger" data-fire="${s.id}">Demitir</button></td></tr>`).join('');
      const W = ZM.Diagnostics.staffWork(z);
      const wrows = ZM.STAFF_ORDER.map((r) => {
        const w = W[r], role = ZM.STAFF_ROLES[r];
        if (!w.staff && !w.pending) return '';
        const load = w.load === Infinity ? '—' : Math.round(w.load * 100) + '%';
        const notes = [];
        if (!w.staff && w.pending) notes.push(`<span style="color:var(--bad)">ninguém contratado</span>`);
        else if (w.overloaded) notes.push('<span style="color:var(--bad)">sobrecarregada</span>');
        if (w.unreachable.length) notes.push(`<span style="color:var(--bad)">sem acesso: ${w.unreachable.map(U.esc).join(', ')}</span>`);
        if (w.uncovered.length) notes.push(`<span style="color:var(--warn)">sem tratador designado: ${w.uncovered.map(U.esc).join(', ')}</span>`);
        const busy = z.staff.filter((s) => s.role === r && s.busyPct != null);
        const avgBusy = busy.length ? Math.round(busy.reduce((t, s) => t + s.busyPct, 0) / busy.length) + '%' : '—';
        return `<tr><td>${role.icon} ${role.plural || role.name}</td><td>${w.staff}</td><td>${w.pending}</td><td>${load}</td><td>${avgBusy}</td><td>${notes.join(' · ') || '<span style="color:var(--good)">ok</span>'}</td></tr>`;
      }).join('');
      const card = this.open(`<h2>👷 Equipe (${z.staff.length})</h2><p class="lead">Folha diária: ${U.money(z.staff.reduce((a, b) => a + b.salary, 0))}. Contrate na aba FUNCIONÁRIOS. Clique em um funcionário para ajustar prioridades.</p>
        ${wrows ? `<h3 style="margin:0 0 6px">Carga de trabalho por função</h3><table class="ledger"><tr><th>Função</th><th>Equipe</th><th>Pendências</th><th>Carga</th><th>Ocupação média</th><th>Observações</th></tr>${wrows}</table>` : ''}
        <h3 style="margin:14px 0 6px">Funcionários</h3>
        <table class="ledger">${rows || '<tr><td>Nenhum funcionário.</td></tr>'}</table>`);
      card.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { const s = z.staff.find((x) => x.id === +b.dataset.go); if (s) { ZM.game.renderer.centerOn(s.x, s.y); ZM.UI.select({ kind: 'staff', id: s.id }); } this.close(); }));
      card.querySelectorAll('[data-fire]').forEach((b) => b.addEventListener('click', () => { z.fireStaff(+b.dataset.fire); this.staffList(); }));
    },

    /* ---------------- Menu de pausa ---------------- */
    pauseMenu() {
      const z = this.zoo;
      const prev = z.speed || this.prevSpeed || 1; this.prevSpeed = prev; z.speed = 0;
      const slots = ['1', '2', '3'].map((s) => {
        const i = ZM.Save.info(s);
        return `<div class="slot"><div class="si"><b>Slot ${s}</b><small>${i ? `${U.esc(i.scenario)} · Dia ${i.day} · ${i.animals} animais · ${new Date(i.savedAt).toLocaleString('pt-BR')}` : 'Vazio'}</small></div><button class="btn primary" data-save="${s}">Salvar</button>${i ? `<button class="btn" data-load="${s}">Carregar</button>` : ''}</div>`;
      }).join('');
      const auto = ZM.Save.info('auto');
      const card = this.open(`<h2>☰ Menu</h2><p class="lead">Jogo pausado.</p>
        <div class="slots">${slots}${auto ? `<div class="slot"><div class="si"><b>Autosave</b><small>Dia ${auto.day} · ${new Date(auto.savedAt).toLocaleString('pt-BR')}</small></div><button class="btn" data-load="auto">Carregar</button></div>` : ''}</div>
        <div class="btns" style="margin-top:14px"><button class="btn good" data-x2>▶ Continuar</button><button class="btn" data-help>❓ Como jogar</button><button class="btn" data-grid>▦ Grade ${ZM.game.renderer.showGrid ? 'ligada' : 'desligada'}</button><button class="btn danger" data-quit>🏠 Menu principal</button></div>
        <div class="scale-row"><span>🔠 Tamanho da interface</span>${[[1, '100%'], [1.15, '115%'], [1.3, '130%']].map(([v, l]) => `<button class="btn ${ZM.UI.uiScale === v ? 'primary' : ''}" data-scale="${v}">${l}</button>`).join('')}<small>Use 115% ou 130% em notebooks pequenos ou projetores.</small></div>`, true, () => { if (this.zoo) this.zoo.speed = prev || 1; ZM.UI.updateHUD(); });
      card.querySelector('[data-x2]').addEventListener('click', () => this.close());
      card.querySelector('[data-help]').addEventListener('click', () => this.help());
      card.querySelector('[data-grid]').addEventListener('click', () => { ZM.game.renderer.showGrid = !ZM.game.renderer.showGrid; this.close(); });
      card.querySelectorAll('[data-scale]').forEach((b) => b.addEventListener('click', () => { ZM.UI.applyScale(+b.dataset.scale); this.onClose = null; this.close(); this.pauseMenu(); z.speed = 0; }));
      card.querySelectorAll('[data-save]').forEach((b) => b.addEventListener('click', () => {
        const r = ZM.Save.save(z, b.dataset.save);
        ZM.UI.toast({ text: r.ok ? `💾 Jogo salvo no slot ${b.dataset.save}.` : '❌ ' + r.reason, type: r.ok ? 'good' : 'warn' });
        this.onClose = null; this.close(); this.pauseMenu(); z.speed = 0;
      }));
      card.querySelectorAll('[data-load]').forEach((b) => b.addEventListener('click', () => { this.onClose = null; this.close(); ZM.game.loadGame(b.dataset.load); }));
      card.querySelector('[data-quit]').addEventListener('click', () => ZM.ask('Voltar ao menu principal? O progresso não salvo será perdido (há autosave diário).', () => { ZM.Save.save(z, 'auto'); this.onClose = null; this.close(); ZM.game.toMenu(); }));
    },

    help() {
      const keep = this.onClose;
      this.open(`<h2>❓ Como jogar</h2><div class="help">
        <h3>Objetivo</h3><p>Construa e administre um zoológico equilibrando <b>bem-estar animal</b>, <b>visitantes</b>, <b>economia</b>, <b>funcionários</b> e <b>conservação</b>. Comprar muitos animais não basta: cada espécie precisa do habitat certo, de cuidados e de espaço.</p>
        <h3>Primeiros passos</h3><p>1) Construa a <b>Entrada</b> · 2) puxe <b>caminhos</b> · 3) cerque um <b>recinto</b> encostado no caminho (o portão aparece sozinho) · 4) ajuste o <b>terreno</b> e a <b>vegetação</b> ao bioma da espécie · 5) coloque <b>comedouro</b> e <b>bebedouro</b> · 6) compre os <b>animais</b> · 7) contrate um <b>tratador</b> · 8) <b>abra</b> o zoológico.</p>
        <h3>Dicas</h3><p>• Clique em um recinto para ver a adequação do habitat por espécie.<br>• Visitantes precisam de lanchonetes, bebidas, banheiros, bancos e lixeiras.<br>• Placas educativas perto dos recintos aumentam a educação e a reputação.<br>• Espécies ameaçadas que se reproduzem geram <b>Pontos de Conservação</b>, que liberam espécies raras.<br>• Felinos e grandes animais exigem cercas fortes — senão, fogem!<br>• Pesquise no Centro de Pesquisa para liberar espécies, itens e melhorias.</p>
        <h3>Controles</h3><p><kbd>WASD</kbd>/<kbd>setas</kbd> ou arrastar com botão direito/meio: mover · <kbd>roda</kbd>: zoom · <kbd>Espaço</kbd>: pausa · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd>: velocidade · <kbd>Esc</kbd>: cancelar/menu · <kbd>Del</kbd>: demolir selecionado · <kbd>Ctrl</kbd>+<kbd>Z</kbd>: desfazer construção · <kbd>M</kbd>: mover construção · <kbd>L</kbd>: camadas (acesso, limpeza, bem-estar, equipe) · <kbd>G</kbd>: grade · botão direito: cancelar ferramenta.</p>
        <h3>Diagnóstico</h3><p>Clique num recinto: o painel diz o que está errado em cada espécie (comida, água, espaço, habitat, cerca, saúde) e oferece botões para <b>localizar o problema</b>, <b>ver o funcionário responsável</b> ou <b>ajustar o recinto</b>. Ao escolher um animal para comprar, a prévia mostra se cabe no recinto, se a comida e a cerca bastam e se as espécies são compatíveis.</p>
      </div>`, false, keep);
    },

    scenarioComplete({ scenario, reward }) {
      const z = this.zoo;
      const i = ZM.CAMPAIGN.indexOf(scenario.id);
      const next = i >= 0 ? ZM.CAMPAIGN[i + 1] : null;
      const nsc = next ? ZM.SCENARIOS[next] : null;
      const prev = z.speed; z.speed = 0;
      ZM.Audio.play('unlock');
      const card = this.open(`<h2>🏆 ${U.esc(scenario.name)} concluído!</h2><p class="lead">${reward ? `Prêmio de ${U.money(reward)} adicionado ao caixa.` : ''}</p>
        ${nsc ? `<p>Próxima fase liberada: <b>${U.esc(nsc.subtitle)}</b> — ${U.esc(nsc.desc)}</p>` : '<p>Você concluiu toda a campanha! Continue expandindo ou experimente o modo livre.</p>'}
        <div class="btns">${nsc ? `<button class="btn primary" data-next>➡ Continuar com este zoológico na ${U.esc(nsc.subtitle.split('—')[0])}</button>` : ''}<button class="btn" data-stay>Continuar jogando aqui</button></div>`, true, () => { if (this.zoo) this.zoo.speed = prev || 1; });
      const nb = card.querySelector('[data-next]');
      if (nb) nb.addEventListener('click', () => {
        z.scenarioId = next; z.missions = new ZM.Missions(z);
        ZM.UI.renderMissions();
        ZM.UI.toast({ text: `🎯 Novos objetivos: ${nsc.name}`, type: 'good' });
        this.close();
      });
      card.querySelector('[data-stay]').addEventListener('click', () => this.close());
    },

    /* ---------------- Menu principal ---------------- */
    mainMenu() {
      const menu = $('#menu');
      const hasSave = ZM.Save.hasAny();
      const phases = ZM.CAMPAIGN.map((id) => {
        const sc = ZM.SCENARIOS[id], unlocked = ZM.Missions.isPhaseUnlocked(id);
        const [ph, problem] = sc.subtitle.split('—').map((x) => x.trim());
        const nSus = (sc.goals || []).filter((g) => g.sustain).length;
        return `<div class="phase ${unlocked ? '' : 'locked'}" data-sc="${id}"><div class="pn">${unlocked ? '' : '🔒 '}${U.esc(ph)}</div><h3>${U.esc(sc.name)}</h3>${problem ? `<div class="pproblem">⚡ ${U.esc(problem)}</div>` : ''}<p>${U.esc(sc.desc)}</p><div class="ptags"><span>🎯 ${(sc.goals || []).length} objetivos</span>${nSus ? `<span>📅 ${nSus} de vários dias</span>` : ''}${sc.money ? `<span>💰 ${U.money(sc.money)}</span>` : ''}</div></div>`;
      }).join('');
      menu.innerHTML = `<div class="menu-card">
        <div class="logo">Arca <span>Viva</span></div>
        <div class="tagline">Construa, cuide e conserve — um zoológico com alma brasileira 🦫🦜🐆</div>
        <div class="menu-btns">
          ${hasSave ? '<button class="btn primary" data-m="continue">▶ Continuar</button>' : ''}
          <button class="btn ${hasSave ? '' : 'primary'}" data-m="tutorial">🎓 Tutorial: Seu primeiro zoológico</button>
          <button class="btn" data-m="sandbox">🏝️ Modo livre (sandbox)</button>
          ${hasSave ? '<button class="btn" data-m="load">📂 Carregar</button>' : ''}
          <button class="btn" data-m="help">❓ Como jogar</button>
        </div>
        <h3 style="font-family:var(--title);margin:6px 0 10px">Campanha</h3>
        <div class="phases">${phases}</div>
        <div class="credits">Protótipo v${ZM.VERSION} · HTML5 Canvas + JavaScript · arte procedural original</div>
      </div>`;
      menu.classList.remove('hidden');
      menu.querySelectorAll('[data-sc]').forEach((el) => el.addEventListener('click', () => {
        if (el.classList.contains('locked')) { ZM.UI.toast({ text: '🔒 Conclua a fase anterior para liberar.', type: 'info' }); return; }
        ZM.game.newGame(el.dataset.sc);
      }));
      menu.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => {
        ZM.Audio.init(); ZM.Audio.play('click');
        const m = b.dataset.m;
        if (m === 'tutorial' || m === 'sandbox') ZM.game.newGame(m);
        else if (m === 'help') this.help(true);
        else if (m === 'continue') {
          const best = ['auto', '1', '2', '3'].map((s) => ({ s, i: ZM.Save.info(s) })).filter((x) => x.i).sort((a, b) => b.i.savedAt - a.i.savedAt)[0];
          if (best) ZM.game.loadGame(best.s);
        } else if (m === 'load') this.loadMenu();
      }));
    },
    loadMenu() {
      const slots = ['auto', '1', '2', '3'].map((s) => {
        const i = ZM.Save.info(s);
        if (!i) return '';
        return `<div class="slot"><div class="si"><b>${s === 'auto' ? 'Autosave' : 'Slot ' + s}</b><small>${U.esc(i.scenario)} · Dia ${i.day} · ${i.animals} animais · ${new Date(i.savedAt).toLocaleString('pt-BR')}</small></div><button class="btn primary" data-load="${s}">Carregar</button><button class="btn danger" data-del="${s}">🗑</button></div>`;
      }).join('');
      const card = this.open(`<h2>📂 Carregar jogo</h2><div class="slots">${slots || '<p>Nenhum jogo salvo.</p>'}</div>`, true);
      card.querySelectorAll('[data-load]').forEach((b) => b.addEventListener('click', () => { this.close(); ZM.game.loadGame(b.dataset.load); }));
      card.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => ZM.ask('Apagar este save?', () => { ZM.Save.remove(b.dataset.del); this.loadMenu(); this.mainMenu(); })));
    },
  };
  ZM.Modals = M;
})(window.ZM);
