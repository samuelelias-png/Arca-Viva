/* =========================================================
   Painel lateral de seleção (animal, recinto, visitante,
   funcionário, construção)
   ========================================================= */
(function (ZM) {
  'use strict';
  const U = ZM.util;
  const $ = (s) => document.querySelector(s);

  const barColor = (v, inverse) => {
    const x = inverse ? 100 - v : v;
    return x >= 70 ? '#7bd389' : x >= 45 ? '#ffc94d' : '#ff6b5b';
  };
  const bar = (label, v, inverse, tip) => `<div class="bar-row"${tip ? ` data-tip="${U.esc(tip)}"` : ''}><span class="lbl">${label}</span><div class="bar"><i style="width:${U.clamp(v, 0, 100)}%;background:${barColor(v, inverse)}"></i></div><span class="val">${Math.round(v)}%</span></div>`;
  const kv = (k, v) => `<div class="kv"><span>${k}</span><span>${v}</span></div>`;
  const head = (icon, title, sub) => `<div class="sp-head"><span class="big">${icon}</span><div><h3>${title}</h3><div class="sub">${sub}</div></div><button class="sp-close" data-act="close">✕</button></div>`;

  const SEV_ICON = { ok: '✔', info: 'ℹ', warn: '!', bad: '✖' };
  const STATUS_TXT = { ok: 'tudo certo', info: 'observação', warn: 'atenção necessária', bad: 'problema grave' };
  const ACTS = {};
  /* chave determinística para cada ação (o mesmo pedido gera a mesma chave) */
  const actKey = (act) => { const j = JSON.stringify(act); let h = 5381; for (let i = 0; i < j.length; i++) h = ((h * 33) ^ j.charCodeAt(i)) >>> 0; const k = 'a' + h.toString(36); ACTS[k] = act; return k; };
  /* item de diagnóstico com botões de ação */
  const diagItem = (it) => {
    const btns = (it.actions || []).map((a) => `<button class="dbtn" data-act="diag" data-k="${actKey(a.act)}">${U.esc(a.label)}</button>`).join('');
    return `<li class="${it.sev}"><i>${SEV_ICON[it.sev]}</i><div>${U.esc(it.text)}${btns ? `<div class="dacts">${btns}</div>` : ''}</div></li>`;
  };

  const Panels = {
    get zoo() { return ZM.game.zoo; },
    show(sel) {
      const p = $('#sidepanel');
      document.body.classList.toggle('side-open', !!sel);
      if (!sel) { p.classList.add('hidden'); p.innerHTML = ''; return; }
      p.classList.remove('hidden');
      this.render(true);
    },
    refresh() {
      const sel = ZM.UI.selected;
      if (!sel) return;
      const p = $('#sidepanel');
      if (p.contains(document.activeElement) && document.activeElement.tagName !== 'BUTTON') return; // não atrapalha digitação
      // não troca os botões debaixo do mouse: evita perder cliques
      if (!this._md) { this._md = true; document.addEventListener('mousedown', () => (this.mouseDown = true), true); document.addEventListener('mouseup', () => setTimeout(() => (this.mouseDown = false), 0), true); }
      const hover = p.matches(':hover');
      if (hover && (this.mouseDown || performance.now() - (this.lastRender || 0) < 2500)) return;
      this.render(false);
    },
    render() {
      const sel = ZM.UI.selected, z = this.zoo, p = $('#sidepanel');
      let html = '';
      switch (sel.kind) {
        case 'animal': { const a = z.animalById(sel.id); if (!a) return ZM.UI.select(null); html = this.animal(a); break; }
        case 'enclosure': { const e = z.enclosures.get(sel.id); if (!e) return ZM.UI.select(null); html = this.enclosure(e); break; }
        case 'visitor': { const v = z.visitors.find((x) => x.id === sel.id); if (!v) return ZM.UI.select(null); html = this.visitor(v); break; }
        case 'staff': { const s = z.staff.find((x) => x.id === sel.id); if (!s) return ZM.UI.select(null); html = this.staff(s); break; }
        case 'object': { const o = z.objects.get(sel.id); if (!o) return ZM.UI.select(null); html = this.object(o); break; }
      }
      if (p.dataset.html === html) return;
      this.lastRender = performance.now();
      const scroll = p.scrollTop;
      p.innerHTML = html; p.dataset.html = html; p.scrollTop = scroll;
      this.bind(p);
    },

    animal(a) {
      const sp = a.sp, st = ZM.STATUS[sp.status], wb = a.wb, z = this.zoo;
      const age = a.ageDays < 1 ? 'recém-nascido' : `${Math.floor(a.ageDays)} dias`;
      const enc = z.enclosures.get(a.encId);
      const encOpts = [...z.enclosures.values()].filter((e) => e.id !== a.encId).map((e) => `<option value="${e.id}">${U.esc(e.name)}</option>`).join('');
      return head(ZM.speciesIcon(sp.id), `${U.esc(a.name)} ${a.sex === 'M' ? '♂' : '♀'}`, `${sp.name} · ${age}${a.isBaby ? ' · filhote' : ''}`) +
        `<div><span class="tag" style="background:${a.sex === 'M' ? '#2f5f9a' : '#9a2f6a'}">${a.sex === 'M' ? '♂ Macho' : '♀ Fêmea'}</span><span class="tag">${a.label}</span>${a.personalityLabel ? `<span class="tag" style="background:#4a3f6b" data-tip="A personalidade muda a frequência dos comportamentos: curiosos observam mais os visitantes, tímidos se escondem, brincalhões brincam e escalam, preguiçosos descansam, sociáveis ficam com o grupo.">🧠 ${a.personalityLabel}</span>` : ''}<span class="tag" style="background:${st.color};color:#1b1b1b">${st.name}</span>${a.sick ? `<span class="tag" style="background:#ff6b5b">🤒 ${U.esc(a.disease)}</span>` : ''}${a.pregnant > 0 ? `<span class="tag" style="background:#f06fa4">💕 Gestação: ${a.pregnant} dia(s)</span>` : ''}</div>` +
        bar('Bem-estar', a.welfare) + bar('Saúde', a.health) + bar('Fome', a.hunger, true) + bar('Sede', a.thirst, true) + bar('Energia', a.energy) + bar('Estresse', a.stress, true) + bar('Felicidade', a.happiness) +
        `<div class="sp-sec"><h4>Componentes do bem-estar</h4>` +
        bar('Habitat', wb.habitat || 0, false, `Ideal: bioma ${sp.biomeData.name}. Ajuste terreno, vegetação e água.`) +
        bar('Espaço', wb.space || 0, false, `${sp.space} tiles por animal`) +
        bar('Social', wb.social || 0, false, `Grupo ideal: ${sp.group[0]}–${sp.group[1]}`) +
        bar('Higiene', wb.hygiene || 0, false, 'Tratadores limpam o recinto') +
        bar('Enriquecim.', wb.enrich || 0, false, 'Bolas, troncos, plataformas e comida escondida') + `</div>` +
        `<div class="sp-sec"><h4>Ficha</h4>${kv('Sexo', a.sex === 'M' ? '♂ Macho' : '♀ Fêmea')}${enc ? kv('Reprodução', z.breedingInfo(enc.id, sp.id).note) : ''}${kv('Recinto', enc ? U.esc(enc.name) : '—')}${kv('Dieta', `${sp.diet} (${ZM.FOOD[sp.food].name})`)}${kv('Região', sp.region)}${kv('Temperatura ideal', `${sp.temp[0]}–${sp.temp[1]} °C`)}<p>💡 ${U.esc(sp.fact)}</p></div>` +
        `<div class="btns"><button class="btn" data-act="follow">🎥 Seguir</button>${encOpts ? `<select data-act="transferSel"><option value="">Transferir para…</option>${encOpts}</select>` : ''}<button class="btn danger" data-act="sellAnimal">Vender (${U.money(sp.price * (a.isBaby ? 0.4 : 0.5))})</button></div>`;
    },

    enclosure(e) {
      const z = this.zoo, s = e.stats, f = ZM.FENCES[e.fence];
      const animals = e.animalsIn(z);
      const bySp = e.speciesIn(z);
      const mixKeys = ZM.HAB_KEYS;
      const mix = mixKeys.map((k) => `<i style="width:${(s.mix[k] || 0) * 100}%;background:${ZM.TERRAIN.find((t) => t.key === k).color}" data-tip="${ZM.TERRAIN.find((t) => t.key === k).name}: ${Math.round((s.mix[k] || 0) * 100)}%"></i>`).join('');
      const legend = mixKeys.filter((k) => s.mix[k] > 0).map((k) => `<span style="--c:${ZM.TERRAIN.find((t) => t.key === k).color}">${ZM.TERRAIN.find((t) => t.key === k).name} ${Math.round(s.mix[k] * 100)}%</span>`).join('');
      const habRows = Object.keys(bySp).map((sid) => {
        const sp = ZM.SPECIES[sid];
        const b = sp.biomeData;
        const ideal = Object.keys(b.mix).map((k) => `${ZM.TERRAIN.find((t) => t.key === k).name} ${Math.round(b.mix[k] * 100)}%`).join(', ');
        return bar(`${ZM.speciesIcon(sid)} ${sp.name.split('-')[0].split(' ')[0]}`, e.habitatScore(sp), false, `<b>${sp.name}</b> — bioma ${b.name}<br>Ideal: ${ideal}; vegetação ${Math.round(b.foliage * 100)}% (atual ${Math.round(s.foliage * 100)}%)`);
      }).join('');
      const needFence = animals.length ? Math.max(...animals.map((a) => a.sp.fence)) : 0;
      const upgrades = Object.values(ZM.FENCES).filter((x) => x.level > f.level).map((x) => `<button class="btn" data-act="upgrade" data-v="${x.id}" ${z.isFenceUnlocked(x.id) ? '' : 'disabled'}>⬆ ${x.name} (${U.money(e.perimeter() * x.cost * 0.8)})</button>`).join('');
      const list = animals.map((a) => `<button data-act="selAnimal" data-v="${a.id}"><span>${ZM.speciesIcon(a.species)} ${U.esc(a.name)} <b style="color:${a.sex === 'M' ? '#5aa9ff' : '#ff7eb6'}">${a.sex === 'M' ? '♂' : '♀'}</b>${a.isBaby ? ' 🍼' : ''}${a.sick ? ' 🤒' : ''}</span><span style="color:${barColor(a.welfare)}">${Math.round(a.welfare)}%</span></button>`).join('');
      const buyOpts = (e.prefab ? ZM.PREFABS[e.prefab].species : ZM.SPECIES_ORDER.filter((id) => !ZM.isAquatic(ZM.SPECIES[id]))).filter((id) => z.isSpeciesUnlocked(id)).map((id) => `<option value="${id}"${this.buySp === id && this.buyEnc === e.id ? ' selected' : ''}>${ZM.SPECIES[id].name} — ${U.money(ZM.SPECIES[id].price)}${ZM.SPECIES[id].cp && !z.sandbox ? ' + ' + ZM.SPECIES[id].cp + '🧬' : ''}</option>`).join('');
      // diagnóstico prático
      const dg = ZM.Diagnostics.enclosure(z, e);
      const dgGen = dg.general.length ? `<ul class="diag">${dg.general.map(diagItem).join('')}</ul>` : '';
      const dgGroups = dg.groups.map((g) => {
        const probs = g.items.filter((it) => it.sev !== 'ok');
        return `<div class="dgroup ${g.status}"><div class="dg-title">${ZM.speciesIcon(g.speciesId)} <b>${U.esc(g.title)}</b> — ${STATUS_TXT[g.status]}<span class="dg-w" style="color:${barColor(g.welfare)}">${g.welfare}%</span></div>${probs.length ? `<ul class="diag">${probs.map(diagItem).join('')}</ul>` : '<p class="dg-ok">Comida, água, espaço e habitat em ordem.</p>'}</div>`;
      }).join('');
      const diagHTML = dgGen || dgGroups ? `<div class="sp-sec diagbox ${dg.status}"><h4>🩺 Diagnóstico <span class="dg-st">${STATUS_TXT[dg.status]}</span></h4>${dgGen}${dgGroups}<div class="dacts" style="margin-top:6px"><button class="dbtn" data-act="diag" data-k="${actKey({ type: 'locate', x: Math.floor(e.center()[0]), y: Math.floor(e.center()[1]) })}">📍 Localizar recinto</button><button class="dbtn" data-act="diag" data-k="${actKey({ type: 'layer', layer: 'welfare' })}">🗺️ Camada de bem-estar</button></div></div>` : '';
      const buyBox = this.buySp && this.buyEnc === e.id ? `<div class="bp-inline">${ZM.UI.purchaseHTML(this.buySp, e.id, this.buySex && this.buySex !== 'auto' ? this.buySex : undefined, true)}</div>` : '';
      return head(e.prefab ? ZM.PREFABS[e.prefab].icon : '🏞️', `<input type="text" value="${U.esc(e.name)}" data-act="rename" style="width:100%;min-width:0;font-family:var(--title);font-size:17px">`, `${e.w}×${e.h} (${e.area} tiles) · ${f.name}`) +
        `<div>${e.gate ? '<span class="tag" style="background:#2f7d3b">🚪 Portão OK</span>' : '<span class="tag" style="background:#8b2f27">🚫 Sem portão — encoste um caminho</span>'}<span class="tag">👀 ${s.views.length} pontos de observação</span>${needFence > f.level ? '<span class="tag" style="background:#ff6b5b">⚠️ Cerca fraca!</span>' : ''}</div>` +
        diagHTML +
        bar('Cerca', e.condition) + bar('Limpeza', e.cleanliness) + (s.water ? bar('Água', e.waterQuality, false, `Qualidade da água. Filtros: ${s.filters.length} (cada um atende ~25 tiles; aqui há ${s.water} tiles de água).`) : '') + (animals.length ? bar('Bem-estar', e.avgWelfare || 0) : '') +
        `<div class="sp-sec"><h4>Terreno</h4><div class="mix">${mix}</div><div class="legend">${legend}</div>${kv('Vegetação', `${Math.round(s.foliage * 100)}% (${s.plants} plantas)`)}${kv('Água', s.water ? `${s.fresh} doce · ${s.salt} salgada` : 'nenhuma')}${s.snow || s.icemakers.length ? kv('Gelo', `${s.snow} tiles de neve · ${s.icemakers.length} máquina(s)`) : ''}${s.water ? kv('Filtros', s.filters.length) : ''}${s.viewer ? kv('Visor subaquático', 'sim (+40% atração)') : ''}${kv('Comedouros / bebedouros', `${s.feeders.length} / ${s.troughs.length}`)}${kv('Abrigos / enriquecimento', `${s.shelters.length} / ${s.toys.length}`)}</div>` +
        (habRows ? `<div class="sp-sec"><h4>Adequação do habitat</h4>${habRows}</div>` : '') +
        (Object.keys(bySp).length ? `<div class="sp-sec"><h4>Sexos e reprodução</h4>${Object.keys(bySp).map((sid) => { const b = z.breedingInfo(e.id, sid); return `<div class="kv"><span>${ZM.speciesIcon(sid)} ${ZM.SPECIES[sid].name}</span><span><b style="color:#5aa9ff">♂ ${b.m}</b> · <b style="color:#ff7eb6">♀ ${b.f}</b></span></div><p style="margin:0 0 6px;font-size:11.5px;color:${b.canBreed ? 'var(--good)' : 'var(--muted)'}">${b.note}</p>`; }).join('')}</div>` : '') +
        `<div class="sp-sec"><h4>Animais (${animals.length})</h4><div class="mini-list">${list || '<p style="color:var(--muted)">Nenhum animal ainda.</p>'}</div>
          <div class="btns"><select data-act="buySex" id="buySex">${[['auto', '⚥ Sexo auto'], ['M', '♂ Macho'], ['F', '♀ Fêmea']].map(([v, l]) => `<option value="${v}"${(this.buySex || 'auto') === v ? ' selected' : ''}>${l}</option>`).join('')}</select><select data-act="buySel"><option value="">➕ Comprar animal…</option>${buyOpts}</select></div>${buyBox}</div>` +
        `<div class="sp-sec"><h4>Cerca</h4><div class="btns" style="margin-top:0">${upgrades || '<span style="color:var(--muted);font-size:12px">Nível máximo.</span>'}</div></div>` +
        `<div class="btns"><button class="btn danger" data-act="demolishEnc">🧨 Demolir recinto</button></div>`;
    },

    visitor(v) {
      return head(v.kid ? '🧒' : '🧑', U.esc(v.name), `${v.label} · ${U.money(v.money)} na carteira`) +
        bar('Felicidade', v.happiness) + bar('Fome', v.hunger, true) + bar('Sede', v.thirst, true) + bar('Energia', v.energy) + bar('Banheiro', v.bladder, true) + bar('Interesse', v.interest) +
        `<div class="sp-sec"><h4>Visita</h4>${kv('Tempo no parque', `${Math.floor(v.timeIn)}h${String(Math.floor((v.timeIn % 1) * 60)).padStart(2, '0')}`)}${kv('Recintos vistos', v.visited.size)}${kv('Espécies vistas', v.seen.size)}${kv('Gastou', U.money(v.spent))}${kv('Placas lidas', v.learned)}</div>` +
        `<div class="sp-sec"><h4>Pensamentos</h4><ul class="thoughts">${v.thoughts.map((t) => `<li>${t.icon} ${U.esc(t.text)}</li>`).join('') || '<li>…</li>'}</ul></div>`;
    },

    staff(s) {
      const z = this.zoo, r = s.def;
      const assign = s.role === 'keeper' && z.enclosures.size ? `<div class="sp-sec"><h4>Recintos designados</h4><p style="color:var(--muted);font-size:12px">Nenhum marcado = cuida de todos.</p><div class="toggle-row">${[...z.enclosures.values()].map((e) => `<button data-act="assign" data-v="${e.id}" class="${s.assigned.includes(e.id) ? 'on' : ''}">${U.esc(e.name)}</button>`).join('')}</div></div>` : '';
      const types = ZM.Staff.PRIORITY_TYPES[s.role] || [];
      const PL = [['0', 'Não fazer'], ['1', 'Normal'], ['2', 'Alta']];
      const prio = types.length > 1 || s.role === 'janitor' ? `<div class="sp-sec"><h4>Prioridades</h4>${types.map(([k, l]) => `<div class="prio-row"><span>${l}</span><span class="seg">${PL.map(([v, t]) => `<button data-act="prio" data-k="${k}" data-v="${v}" class="${String(s.priorities[k] ?? 1) === v ? 'on' : ''}">${t}</button>`).join('')}</span></div>`).join('')}<p style="color:var(--muted);font-size:12px;margin:4px 0 0">"Alta" faz o funcionário escolher essas tarefas primeiro; "Não fazer" deixa para os colegas.</p></div>` : '';
      const w = ZM.Diagnostics.staffWork(z)[s.role];
      const busy = s.busyPct;
      const why = [];
      if (w) {
        if (w.overloaded) why.push({ sev: 'bad', text: `Equipe sobrecarregada: ${w.pending} tarefa(s) pendente(s) para ${w.staff} ${r.plural.toLowerCase()}. Contrate mais ou reduza a demanda.` });
        w.unreachable.forEach((n) => why.push({ sev: 'bad', text: `Não consegue chegar a ${n}: o portão ou o caminho está bloqueado.` }));
        w.uncovered.forEach((n) => why.push({ sev: 'warn', text: `${n} tem tarefas, mas nenhum tratador está designado para ele.` }));
        if (!why.length && busy != null && busy >= 85 && w.pending) why.push({ sev: 'warn', text: `Trabalhando ${busy}% do tempo, com ${w.pending} tarefa(s) na fila: no limite. Novas demandas vão atrasar.`, actions: [ZM.DiagActions.hire(s.role)] });
        if (!why.length && w.pending) why.push({ sev: 'info', text: `${w.pending} tarefa(s) na fila da equipe — dentro da capacidade.` });
        if (!why.length) why.push({ sev: 'ok', text: 'Sem tarefas pendentes.' });
      }
      const off = types.filter(([k]) => s.priorities[k] === 0).map(([, l]) => l.toLowerCase());
      if (off.length) why.push({ sev: 'info', text: `Configurado para não fazer: ${off.join(', ')}.` });
      return head(r.icon, U.esc(s.name), r.name) +
        `<div><span class="tag">${U.esc(s.label)}</span></div>` +
        (busy != null ? bar('Ocupação', busy, true, 'Parte do tempo das últimas 8 horas de jogo gasto trabalhando (inclui deslocamento). Acima de 85% = sobrecarregado.') : '') +
        `<div class="sp-sec"><h4>Carga de trabalho</h4><ul class="diag">${why.map(diagItem).join('')}</ul></div>` +
        `<div class="sp-sec">${kv('Salário', U.money(s.salary) + '/dia')}${kv('Tarefas concluídas', s.tasksDone)}<p>${r.desc}</p></div>` + prio + assign +
        `<div class="btns"><button class="btn" data-act="follow">🎥 Seguir</button><button class="btn danger" data-act="fire">Demitir</button></div>`;
    },

    object(o) {
      const d = o.def, z = this.zoo;
      let body = '';
      if (o.condition != null) body += bar('Conservação', o.condition);
      if (d.kind === 'feeder') {
        const fopts = [['auto', '🔄 Automático (conforme as espécies)'], ...Object.keys(ZM.FOOD).map((k) => [k, ZM.FOOD[k].icon + ' ' + ZM.FOOD[k].name])];
        body += bar('Comida', o.food) + kv('Alimento atual', o.foodType ? ZM.FOOD[o.foodType].icon + ' ' + ZM.FOOD[o.foodType].name : '—') +
          (o.wantType && o.wantType !== o.foodType ? kv('Próximo abastecimento', ZM.FOOD[o.wantType].icon + ' ' + ZM.FOOD[o.wantType].name) : '') +
          `<div class="sp-sec"><h4>Alimento deste comedouro</h4><select data-act="foodSetting" style="width:100%">${fopts.map(([k, l]) => `<option value="${k}"${(o.foodSetting || 'auto') === k ? ' selected' : ''}>${l}</option>`).join('')}</select><p style="color:var(--muted);font-size:12px;margin:4px 0 0">No automático, cada comedouro do recinto recebe uma das dietas necessárias. Fixe um alimento para garantir uma dieta específica.</p></div>`;
        const enc = z.enclosures.get(z.map.enc[z.map.idx(o.x, o.y)]);
        if (enc && enc.dietMissing && enc.dietMissing.length) body += `<p style="color:var(--bad);font-size:12.5px">⚠️ Falta comedouro para: ${enc.dietMissing.map((f) => ZM.FOOD[f].name.toLowerCase()).join(', ')}.</p>`;
      }
      if (d.kind === 'trough') body += bar('Água', o.water);
      if (d.kind === 'bin') body += bar('Ocupação', (o.fill / d.capacity) * 100, true);
      if (d.kind === 'shop') {
        body += `<div class="sp-sec"><h4>Preço: ${d.sells}</h4><input type="range" min="${Math.max(1, Math.round(d.price * 0.3))}" max="${Math.round(d.price * 2.5)}" step="1" value="${o.price}" data-act="price"><div class="kv"><span>Preço atual</span><span><b>${U.money(o.price)}</b> (sugerido ${U.money(d.price)})</span></div>${kv('Custo unitário', U.money(d.unitCost))}${kv('Margem por venda', U.money(o.price - d.unitCost))}${kv('Vendas (hoje / total)', `${o.salesToday || 0} / ${o.sales || 0}`)}${kv('Receita (hoje / total)', `${U.money(o.revenueToday || 0)} / ${U.money(o.revenue || 0)}`)}</div>`;
      }
      if (d.kind === 'shop' || d.kind === 'toilet') {
        const slots = z.serviceSlots(o), busy = z.serviceCount(o), q = z.queueOf(o).length;
        const R = { fila: 'fila longa', espera: 'esperou demais', preco: 'preço alto', dinheiro: 'sem dinheiro', quebrado: 'quebrado' };
        const reasons = Object.keys(o.lostReasons || {}).sort((a, b) => o.lostReasons[b] - o.lostReasons[a]).map((k) => `${R[k] || k}: ${o.lostReasons[k]}`).join(' · ');
        body += `<div class="sp-sec"><h4>Atendimento</h4>${bar('Ocupação', (busy / slots) * 100, true, `${busy} de ${slots} atendimentos simultâneos`)}${kv('Capacidade', `${slots} por vez`)}${kv('Fila agora', q ? `${q} pessoa(s)` : 'vazia')}${kv('Atendidos', o.served || 0)}${kv('Desistências (hoje / total)', `${o.gaveUpToday || 0} / ${o.gaveUp || 0}`)}${reasons ? `<p style="font-size:12px;color:var(--muted);margin:4px 0 0">Motivos: ${reasons}</p>` : ''}${q >= slots * 2 ? '<p style="color:var(--warn);font-size:12.5px">⚠️ Fila grande: construa outra unidade por perto.</p>' : ''}</div>`;
      }
      if (d.needsPath && !o.accessRaw?.length && !o.access.length) body += '<p style="color:var(--bad);font-size:12.5px">⚠️ Sem acesso: coloque um caminho encostado.</p>';
      else if (d.needsPath && !z.isConnected(o)) body += `<p style="color:var(--bad);font-size:12.5px">⚠️ O caminho ao lado não chega à entrada: visitantes não alcançam. <button class="dbtn" data-act="diag" data-k="${actKey({ type: 'layer', layer: 'access' })}">Ver camada de acesso</button></p>`;
      if (o.broken) body += '<p style="color:var(--warn);font-size:12.5px">🔧 Quebrado — aguardando técnico de manutenção.</p>';
      return head(d.icon, d.name, d.upkeep ? `Manutenção: ${U.money(d.upkeep)}/dia` : 'Sem custo diário') + body +
        `<div class="sp-sec"><p>${d.desc || ''}</p></div>` +
        `<div class="btns"><button class="btn" data-act="moveObj">✋ Mover</button><button class="btn danger" data-act="sellObj">Demolir (+${U.money(d.cost * 0.4)})</button></div>`;
    },

    bind(p) {
      const z = this.zoo, sel = ZM.UI.selected;
      p.querySelectorAll('[data-act]').forEach((el) => {
        const act = el.dataset.act;
        const ev = el.tagName === 'SELECT' ? 'change' : el.tagName === 'INPUT' ? (el.type === 'range' ? 'input' : 'change') : 'click';
        el.addEventListener(ev, () => {
          switch (act) {
            case 'close': ZM.UI.select(null); ZM.Input.follow = null; break;
            case 'follow': ZM.Input.follow = sel; break;
            case 'sellAnimal': ZM.ask('Vender este animal?', () => { z.sellAnimal(sel.id); ZM.UI.select(null); ZM.Audio.play('cash'); }); return;
            case 'transferSel': if (el.value) { const r = z.transferAnimal(sel.id, +el.value); if (!r.ok) ZM.UI.toast({ text: '❌ ' + (r.reason || 'Não foi possível transferir'), type: 'warn' }); else ZM.UI.toast({ text: '🚚 Animal transferido (R$ 150).', type: 'good' }); } break;
            case 'rename': { const e = z.enclosures.get(sel.id); if (e && el.value.trim()) e.name = el.value.trim().slice(0, 30); break; }
            case 'selAnimal': ZM.UI.select({ kind: 'animal', id: +el.dataset.v }); break;
            case 'buySex': this.buySex = el.value; break;
            case 'buySel': this.buySp = el.value || null; this.buyEnc = sel.id; break;
            case 'cancelBuy': this.buySp = null; break;
            case 'confirmBuy': {
              const sp = this.buySp; if (!sp) break;
              const r = z.buyAnimal(sp, sel.id, { sex: this.buySex && this.buySex !== 'auto' ? this.buySex : undefined });
              if (!r.ok) { ZM.UI.toast({ text: '❌ ' + r.reason, type: 'warn' }); ZM.Audio.play('error'); }
              else { ZM.UI.toast({ text: `${ZM.speciesIcon(sp)} ${r.animal.name} (${r.animal.sex === 'M' ? '♂ macho' : '♀ fêmea'}) chegou ao zoológico!`, type: 'good' }); ZM.Audio.play('cash'); }
              this.buySp = null;
              break;
            }
            case 'diag': { const a = ACTS[el.dataset.k]; if (a) ZM.UI.runAction(a); return; }
            case 'prio': { const s = z.staff.find((x) => x.id === sel.id); if (s) { s.priorities[el.dataset.k] = +el.dataset.v; s.task && s.task.type === el.dataset.k && +el.dataset.v === 0 && s.endTask && s.endTask(z); } break; }
            case 'foodSetting': { const o = z.objects.get(sel.id); if (o) { o.foodSetting = el.value; z.aggregate && z.aggregate(); } break; }
            case 'moveObj': ZM.Input.setTool({ type: 'move', objId: sel.id }); return;
            case 'upgrade': { const r = z.upgradeFence(sel.id, el.dataset.v); if (!r.ok) ZM.UI.toast({ text: '❌ ' + (r.reason || ''), type: 'warn' }); else { ZM.Audio.play('build'); } break; }
            case 'demolishEnc': { const r = z.removeEnclosure(sel.id); if (!r.ok) { ZM.UI.toast({ text: '❌ ' + r.reason, type: 'warn' }); ZM.Audio.play('error'); } else { ZM.UI.select(null); ZM.Audio.play('demolish'); } break; }
            case 'fire': ZM.ask('Demitir este funcionário?', () => { z.fireStaff(sel.id); ZM.UI.select(null); }); return;
            case 'assign': { const s = z.staff.find((x) => x.id === sel.id); const id = +el.dataset.v; if (s) { s.assigned = s.assigned.includes(id) ? s.assigned.filter((x) => x !== id) : [...s.assigned, id]; } break; }
            case 'price': { const o = z.objects.get(sel.id); if (o) { o.price = +el.value; const lab = el.parentElement.querySelector('.kv b'); if (lab) lab.textContent = U.money(o.price); } return; }
            case 'sellObj': { z.removeObject(sel.id, true); ZM.UI.select(null); ZM.Audio.play('demolish'); break; }
          }
          this.render();
          if (act === 'buySel' && el.value) { const bx = p.querySelector('.bp-inline'); if (bx) bx.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
        });
      });
    },
  };
  ZM.Panels = Panels;
})(window.ZM);
