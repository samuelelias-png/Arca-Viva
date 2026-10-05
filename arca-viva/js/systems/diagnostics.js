/* =========================================================
   Diagnóstico: transforma indicadores em orientações práticas.
   - enclosure(): problemas por espécie e do recinto, com ações
   - purchase(): checklist antes de comprar um animal
   - staffWork(): carga de trabalho e tarefas não atendidas
   ========================================================= */
(function (ZM) {
  'use strict';
  const U = ZM.util;

  /* ações sugeridas (executadas pela interface) */
  const A = {
    locate: (x, y, label = 'Localizar') => ({ label, act: { type: 'locate', x, y } }),
    staff: (role, encId, label) => ({ label: label || 'Ver ' + ZM.STAFF_ROLES[role].name.toLowerCase(), act: { type: 'selectStaff', role, encId } }),
    hire: (role) => ({ label: 'Contratar ' + ZM.STAFF_ROLES[role].name.toLowerCase(), act: { type: 'hire', role } }),
    place: (type, label) => ({ label: label || 'Colocar ' + ZM.OBJECTS[type].name.toLowerCase(), act: { type: 'tool', tool: { type: 'object', param: type } } }),
    tool: (tool, label) => ({ label, act: { type: 'tool', tool } }),
    select: (kind, id, label) => ({ label, act: { type: 'select', kind, id } }),
    fence: (encId, fence) => ({ label: 'Trocar por ' + ZM.FENCES[fence].name.toLowerCase(), act: { type: 'upgradeFence', encId, fence } }),
    layer: (layer, label) => ({ label, act: { type: 'layer', layer } }),
  };
  ZM.DiagActions = A;

  const SEV = { ok: 0, info: 1, warn: 2, bad: 3 };
  const worst = (items) => items.reduce((w, it) => (SEV[it.sev] > SEV[w] ? it.sev : w), 'ok');

  const D = {
    SEV,
    /* situação de uma tarefa da equipe: a caminho, trabalhando, inalcançável ou na fila */
    taskStatus(zoo, key) {
      const s = zoo.staff.find((x) => x.task && x.task.key === key);
      if (s) return { state: s.state === 'WORK' ? 'working' : 'enroute', staff: s };
      if (zoo.isUnreachable(key)) return { state: 'unreachable' };
      return { state: 'queued' };
    },
    keepersFor(zoo, e) { return zoo.staff.filter((s) => s.role === 'keeper' && (!s.assigned.length || s.assigned.includes(e.id))); },

    /* explica quem resolve uma tarefa pendente */
    who(zoo, key, role, e) {
      const st = this.taskStatus(zoo, key);
      const name = ZM.STAFF_ROLES[role].name.toLowerCase();
      if (st.state === 'enroute') return { sev: 'info', text: `${st.staff.name.split(' ')[0]} (${name}) está a caminho.`, actions: [A.select('staff', st.staff.id, 'Ver ' + name)] };
      if (st.state === 'working') return { sev: 'info', text: `${st.staff.name.split(' ')[0]} já está resolvendo.`, actions: [A.select('staff', st.staff.id, 'Ver ' + name)] };
      if (!zoo.staffCount(role)) return { sev: 'bad', text: `Não há ${name} no zoológico.`, actions: [A.hire(role)] };
      if (role === 'keeper' && e && !this.keepersFor(zoo, e).length) return { sev: 'bad', text: 'Nenhum tratador está designado para este recinto.', actions: [A.staff('keeper', e.id, 'Designar tratador')] };
      if (st.state === 'unreachable') return { sev: 'bad', text: `O ${name} não consegue chegar até aqui (caminho bloqueado).`, actions: e && e.gate ? [A.locate(...zoo.map.xy(e.gate.outIdx), 'Ver portão')] : [] };
      const w = this.staffWork(zoo)[role];
      const R = ZM.STAFF_ROLES[role];
      return { sev: 'warn', text: w && w.overloaded ? `Equipe sobrecarregada: ${w.pending} tarefas para ${w.staff} ${(w.staff === 1 ? R.name : R.plural).toLowerCase()}.` : `Na fila de tarefas do ${name}.`, actions: w && w.overloaded ? [A.hire(role)] : [] };
    },

    enclosure(zoo, e) {
      const m = zoo.map, s = e.stats;
      const general = [];
      const [cx, cy] = e.center();
      // --- portão e acesso
      if (!e.gate) general.push({ sev: 'bad', text: 'Sem portão: nenhum caminho encosta na cerca. Tratadores não entram.', actions: [A.tool({ type: 'path' }, 'Construir caminho'), A.locate(cx, cy)] });
      else if (e.gateReachable === false) general.push({ sev: 'bad', text: 'Portão bloqueado para a equipe: água, prédio ou outro recinto impede a passagem.', actions: [A.locate(...m.xy(e.gate.outIdx), 'Ver portão'), A.layer('access', 'Camada de acesso')] });
      if (!s.views.length && e.animalCount) {
        if (s.isolatedViews) general.push({ sev: 'warn', text: 'O caminho ao lado do recinto não chega à entrada: visitantes não veem os animais.', actions: [A.layer('access', 'Camada de acesso'), A.locate(cx, cy)] });
        else general.push({ sev: 'warn', text: 'Nenhum caminho encosta no recinto: visitantes não veem os animais.', actions: [A.tool({ type: 'path' }, 'Construir caminho')] });
      }
      // --- limpeza, cerca e água
      if (e.animalCount && e.cleanliness < 45) {
        const w = this.who(zoo, 'clean:' + e.id, 'keeper', e);
        general.push({ sev: e.cleanliness < 25 ? 'bad' : 'warn', text: `Recinto sujo (${Math.round(e.cleanliness)}%). ${w.text}`, actions: w.actions });
      }
      if (e.condition < 45) {
        const w = this.who(zoo, 'fence:' + e.id, 'maintenance', e);
        general.push({ sev: e.condition < 30 ? 'bad' : 'warn', text: `Cerca danificada (${Math.round(e.condition)}%): risco de fuga. ${w.text}`, actions: w.actions });
      }
      if (s.water && e.animalsIn(zoo).some((a) => a.sp.swims)) {
        const broken = s.filters.filter((id) => zoo.objects.get(id)?.broken).length;
        if (!s.filters.length) general.push({ sev: 'warn', text: "Sem filtro d'água: a qualidade da água vai cair.", actions: [A.place('filter')] });
        else if (broken) general.push({ sev: 'bad', text: `${broken} filtro(s) quebrado(s).`, actions: [A.select('object', s.filters.find((id) => zoo.objects.get(id)?.broken), 'Ver filtro'), ...(zoo.staffCount('maintenance') ? [] : [A.hire('maintenance')])] });
        if (e.waterQuality < 55) general.push({ sev: e.waterQuality < 35 ? 'bad' : 'warn', text: `Água ruim (${Math.round(e.waterQuality)}%): ${s.filters.length} filtro(s) para ${s.water} tiles de água (1 filtro ≈ 25 tiles).`, actions: [A.place('filter', 'Adicionar filtro')] });
      }
      if (e.predatorMix) general.push({ sev: 'bad', text: 'Predadores e presas no mesmo recinto: as presas vivem estressadas.', actions: [A.locate(cx, cy, 'Ver animais')] });

      // --- por espécie
      const groups = [];
      const bySp = e.speciesIn(zoo);
      Object.keys(bySp).forEach((sid) => {
        const sp = ZM.SPECIES[sid];
        const list = e.animalsIn(zoo).filter((a) => a.species === sid);
        const items = [];
        // alimentação conforme a dieta
        const feeders = s.feeders.map((id) => zoo.objects.get(id)).filter(Boolean).filter((o) => list[0].canUse(zoo, m.idx(o.x, o.y)));
        const serving = feeders.filter((o) => o.wantType === sp.food || o.foodType === sp.food);
        const food = ZM.FOOD[sp.food];
        if (!feeders.length) items.push({ sev: 'bad', text: `Sem comedouro que ${sp.plural.toLowerCase()} alcancem.`, actions: [A.place(sp.waterOnly ? 'aquafeeder' : 'feeder')] });
        else if (!serving.length) items.push({ sev: 'bad', text: `Nenhum comedouro com ${food.name.toLowerCase()} (dieta ${sp.diet.toLowerCase()}).`, actions: [A.place(sp.waterOnly ? 'aquafeeder' : 'feeder', 'Adicionar comedouro'), A.select('object', feeders[0].id, 'Ajustar alimento')] });
        else {
          const full = serving.filter((o) => o.foodType === sp.food && o.food >= 8);
          if (!full.length) {
            const o = serving[0];
            const w = this.who(zoo, 'feed:' + o.id, 'keeper', e);
            items.push({ sev: w.sev === 'info' ? 'warn' : w.sev, text: `Comedouro vazio. ${w.text}`, actions: [A.locate(o.x, o.y, 'Localizar comedouro'), ...w.actions] });
          }
        }
        const hungry = list.filter((a) => a.hunger > 75).length;
        if (hungry && serving.some((o) => o.foodType === sp.food && o.food >= 8)) items.push({ sev: 'info', text: `${hungry} com fome, a caminho do comedouro.`, actions: [] });
        // água
        if (!sp.noThirst) {
          const troughs = s.troughs.map((id) => zoo.objects.get(id)).filter(Boolean);
          if (!troughs.length && !s.water) items.push({ sev: 'bad', text: 'Sem bebedouro nem água no recinto.', actions: [A.place('trough')] });
          else if (troughs.length && !s.water && !troughs.some((o) => o.water >= 8)) { const w = this.who(zoo, 'water:' + troughs[0].id, 'keeper', e); items.push({ sev: 'warn', text: 'Bebedouro vazio. ' + w.text, actions: w.actions }); }
        }
        // espaço
        const a0 = list[0];
        if (a0.wb.space != null && a0.wb.space < 85) {
          const room = sp.waterOnly ? (sp.waterOnly === 'salt' ? s.salt : s.fresh) : e.area;
          const need = Math.ceil(room * 100 / Math.max(1, a0.wb.space));
          items.push({ sev: a0.wb.space < 60 ? 'bad' : 'warn', text: `Espaço insuficiente para o grupo: precisa de ~${need} ${sp.waterOnly ? 'tiles de água' : 'tiles'}, tem ${room}.`, actions: [A.select('enclosure', e.id, 'Vender ou transferir')] });
        }
        // habitat
        const hab = e.habitatScore(sp);
        if (hab < 65) {
          const b = sp.biomeData;
          const ideal = Object.keys(b.mix).sort((x, y) => b.mix[y] - b.mix[x]).map((k) => `${ZM.TERRAIN.find((t) => t.key === k).name.toLowerCase()} ${Math.round(b.mix[k] * 100)}%`).join(', ');
          const fol = Math.round(s.foliage * 100), fi = Math.round(b.foliage * 100);
          const extra = Math.abs(fol - fi) > 8 ? ` Vegetação: ${fol}% (ideal ${fi}%).` : '';
          items.push({ sev: hab < 45 ? 'bad' : 'warn', text: `Habitat ${hab}%: ${b.name} pede ${ideal}.${extra}`, actions: [A.tool({ type: 'terrain', param: ZM.TERRAIN.find((t) => t.key === Object.keys(b.mix).sort((x, y) => b.mix[y] - b.mix[x])[0]).id }, 'Pintar terreno'), A.place(fol < fi ? (b.foliage > 0.3 ? 'bigtree' : 'acacia') : 'rock', fol < fi ? 'Plantar árvores' : 'Colocar rochas')] });
        }
        // grupo social
        const [gmin, gmax] = sp.group;
        if (list.length < gmin) items.push({ sev: 'warn', text: `Grupo pequeno: ${sp.plural.toLowerCase()} vivem em grupos de ${gmin}–${gmax} (há ${list.length}).`, actions: [] });
        else if (list.length > gmax) items.push({ sev: 'warn', text: `Grupo grande demais: máximo ${gmax} (há ${list.length}).`, actions: [] });
        // cerca, clima e estruturas
        if (!sp.waterOnly && sp.fence > ZM.FENCES[e.fence].level) {
          const up = Object.values(ZM.FENCES).find((f) => f.level >= sp.fence);
          items.push({ sev: 'bad', text: `Cerca fraca: ${sp.plural.toLowerCase()} precisam de nível ${sp.fence}. Risco de fuga.`, actions: up ? [A.fence(e.id, up.id)] : [] });
        }
        if (sp.tank && !ZM.FENCES[e.fence].watertight) items.push({ sev: 'bad', text: 'Precisa de Parede de aquário (estanque).', actions: [A.fence(e.id, 'glass')] });
        if (sp.cold && !s.icemakers.length) items.push({ sev: 'bad', text: 'Animal polar sem Máquina de gelo.', actions: [A.place('icemaker')] });
        // saúde
        const sick = list.filter((a) => a.sick);
        if (sick.length) { const w = this.who(zoo, 'vet:' + sick[0].id, 'vet', e); items.push({ sev: 'bad', text: `${sick.length} doente(s): ${sick.map((a) => a.name).join(', ')}. ${w.text}`, actions: [A.select('animal', sick[0].id, 'Ver ' + sick[0].name), ...w.actions] }); }
        // reprodução (informativo)
        const br = zoo.breedingInfo(e.id, sid);
        const status = worst(items);
        const avg = Math.round(list.reduce((t, a) => t + a.welfare, 0) / list.length);
        groups.push({ speciesId: sid, title: `${sp.plural}`, status, welfare: avg, items, breeding: br });
      });
      const status = worst([...general, ...groups.map((g) => ({ sev: g.status }))]);
      return { general, groups, status };
    },

    /* checklist antes de comprar */
    purchase(zoo, spId, encId, sex) {
      const sp = ZM.SPECIES[spId], e = zoo.enclosures.get(encId);
      const out = []; let blocked = null;
      const add = (sev, text) => out.push({ sev, text });
      if (!e) return { items: [{ sev: 'bad', text: 'Escolha um recinto.' }], verdict: 'blocked', blocked: 'Escolha um recinto' };
      if (!zoo.isSpeciesUnlocked(spId)) blocked = 'Espécie bloqueada (pesquisa ' + (ZM.RESEARCH[ZM.UNLOCK.species[spId]]?.name || '') + ')';
      if (ZM.isAquatic(sp) && !(e.prefab && ZM.PREFABS[e.prefab].species.includes(spId))) blocked = `Precisa do habitat pronto: ${ZM.prefabsFor(spId).map((k) => ZM.PREFABS[k].name).join(' ou ')}`;
      if (!zoo.sandbox && sp.cp > zoo.cp) blocked = `Faltam Pontos de Conservação (${Math.floor(zoo.cp)}/${sp.cp})`;
      if (!zoo.sandbox && zoo.money < sp.price) blocked = `Dinheiro insuficiente (${U.money(sp.price)})`;
      const m = zoo.map;
      let fit = 0; for (const [x, y] of e.tiles()) if (zoo.tileFits(sp, m.terrain[m.idx(x, y)])) fit++;
      if (!fit) blocked = sp.waterOnly ? `Precisa de ${sp.waterOnly === 'salt' ? 'água salgada' : 'água doce'}` : 'Sem chão adequado no recinto';
      // espaço
      const mates = e.animalsIn(zoo);
      let need = sp.space; mates.forEach((a) => { if (!sp.waterOnly || a.sp.waterOnly) need += a.sp.space * (a.isBaby ? 0.4 : 1); });
      const room = sp.waterOnly ? (sp.waterOnly === 'salt' ? e.stats.salt : e.stats.fresh) : e.area;
      const pctSpace = Math.round((room / Math.max(1, need)) * 100);
      add(pctSpace >= 100 ? 'ok' : pctSpace >= 75 ? 'warn' : 'bad', `Espaço: ${room} de ${Math.ceil(need)} ${sp.waterOnly ? 'tiles de água' : 'tiles'} necessários para o grupo após a compra.`);
      // grupo
      const same = mates.filter((a) => a.species === spId);
      const n = same.length + 1, [gmin, gmax] = sp.group;
      if (n < gmin) add('warn', `Grupo: ficará com ${n}; ${sp.plural.toLowerCase()} precisam de pelo menos ${gmin} para não sofrerem sozinhos.`);
      else if (n > gmax) add('bad', `Grupo: ${n} passa do máximo de ${gmax}.`);
      else add('ok', `Grupo: ${n} (ideal ${gmin}–${gmax}).`);
      // sexo e reprodução
      const sx = sex || zoo.balancedSex(spId, encId);
      const hasM = same.some((a) => a.sex === 'M') || sx === 'M', hasF = same.some((a) => a.sex === 'F') || sx === 'F';
      add(hasM && hasF ? 'ok' : 'info', `Sexo: ${sx === 'M' ? '♂ macho' : '♀ fêmea'}${hasM && hasF ? ' — forma casal para reprodução' : ' — ainda sem casal'}.`);
      // alimentação
      const feeders = e.stats.feeders.map((id) => zoo.objects.get(id)).filter(Boolean).filter((o) => (sp.waterOnly ? o.def.onWater : !o.def.onWater || sp.swims));
      const diets = new Set(mates.filter((a) => (sp.waterOnly ? a.sp.waterOnly || a.sp.swims : !a.sp.waterOnly)).map((a) => a.sp.food)); diets.add(sp.food);
      const fixedOther = feeders.filter((o) => o.foodSetting && o.foodSetting !== 'auto' && o.foodSetting !== sp.food).length;
      const usable = feeders.length - fixedOther;
      const food = ZM.FOOD[sp.food].name.toLowerCase();
      if (!feeders.length) add('bad', `Alimentação: nenhum comedouro${sp.waterOnly ? ' aquático' : ''}; precisa de ${food}.`);
      else if (feeders.some((o) => o.foodSetting === sp.food) || usable >= diets.size) add('ok', `Alimentação: um comedouro receberá ${food}.`);
      else add('bad', `Alimentação: ${feeders.length} comedouro(s) para ${diets.size} dietas diferentes; falta um para ${food}.`);
      // água
      if (!sp.noThirst) add(e.stats.troughs.length || e.stats.water ? 'ok' : 'bad', e.stats.troughs.length || e.stats.water ? 'Água: disponível.' : 'Água: sem bebedouro nem lago.');
      // cerca
      if (!sp.waterOnly) {
        const lvl = ZM.FENCES[e.fence].level;
        add(lvl >= sp.fence ? 'ok' : 'bad', lvl >= sp.fence ? `Cerca: nível ${lvl} é suficiente.` : `Cerca: nível ${lvl}, precisa de ${sp.fence}. Risco de fuga!`);
      }
      // compatibilidade
      const others = [...new Set(mates.map((a) => a.species))].filter((s) => s !== spId);
      const pred = sp.predator && !sp.aquaticGroup, preyHere = others.some((s) => !ZM.SPECIES[s].predator);
      const predHere = others.some((s) => ZM.SPECIES[s].predator && !ZM.SPECIES[s].aquaticGroup);
      if ((pred && others.length) || (predHere && !sp.predator)) add('bad', `Compatibilidade: ${pred ? 'predador junto de outras espécies' : 'presa junto de predador'} — estresse constante.`);
      else if (others.length) add(others.every((s) => ZM.SPECIES[s].biome === sp.biome) ? 'ok' : 'warn', `Compatibilidade: divide o recinto com ${others.map((s) => ZM.SPECIES[s].plural.toLowerCase()).join(', ')}${others.every((s) => ZM.SPECIES[s].biome === sp.biome) ? ' (mesmo bioma)' : ' (biomas diferentes)'}.`);
      // habitat e estruturas
      const hab = e.habitatScore(sp);
      add(hab >= 70 ? 'ok' : hab >= 50 ? 'warn' : 'bad', `Habitat: ${hab}% adequado ao bioma ${sp.biomeData.name}.`);
      if (sp.cold) add(e.stats.icemakers.length ? 'ok' : 'bad', e.stats.icemakers.length ? 'Clima: máquina de gelo presente.' : 'Clima: precisa de Máquina de gelo.');
      if (!e.gate) add('bad', 'Acesso: sem portão, os tratadores não entram.');
      else if (!zoo.staffCount('keeper')) add('warn', 'Equipe: nenhum tratador contratado.');
      const items = out;
      const w = worst(items);
      const verdict = blocked ? 'blocked' : w === 'bad' ? 'risky' : w === 'warn' ? 'caution' : 'ok';
      return { items, verdict, blocked, cost: sp.price, cp: sp.cp };
    },

    /* carga de trabalho por função */
    staffWork(zoo) {
      const tk = Math.floor(zoo.absMinutes / 5);
      if (zoo._workCache && zoo._workCache.t === tk) return zoo._workCache.v;
      const res = {};
      ZM.STAFF_ORDER.forEach((r) => (res[r] = { role: r, staff: zoo.staffCount(r), pending: 0, unreachable: [], uncovered: [] }));
      zoo.enclosures.forEach((e) => {
        if (!e.animalCount) return;
        const covered = this.keepersFor(zoo, e).length > 0;
        let n = 0;
        e.stats.feeders.forEach((id) => { const o = zoo.objects.get(id); if (o && o.wantType && (o.food < 50 || o.foodType !== o.wantType)) { n++; if (zoo.isUnreachable('feed:' + id)) res.keeper.unreachable.push(e.name); } });
        e.stats.troughs.forEach((id) => { const o = zoo.objects.get(id); if (o && o.water < 50) n++; });
        if (e.cleanliness < 70) n++;
        res.keeper.pending += n;
        if (n && !covered && zoo.staffCount('keeper')) res.keeper.uncovered.push(e.name);
        if (e.condition < 75) res.maintenance.pending++;
      });
      zoo.objects.forEach((o) => { if (o.condition != null && o.condition < 55) res.maintenance.pending++; if (o.def.kind === 'bin' && o.fill > o.def.capacity * 0.6) res.janitor.pending++; });
      let litter = 0; zoo.pathTiles.forEach((i) => { if (zoo.map.litter[i]) litter++; });
      res.janitor.pending += litter;
      zoo.animals.forEach((a) => { if (!a.escaped && (a.sick || a.health < 70)) res.vet.pending++; if (a.escaped) res.security.pending++; });
      if (zoo.research.active) res.researcher.pending = 1;
      Object.values(res).forEach((w) => {
        const per = w.role === 'janitor' ? 12 : w.role === 'keeper' ? 6 : 4;
        w.load = w.staff ? w.pending / (w.staff * per) : (w.pending ? Infinity : 0);
        w.overloaded = w.pending > 0 && (w.staff === 0 || w.load > 1);
        w.unreachable = [...new Set(w.unreachable)];
      });
      zoo._workCache = { t: tk, v: res };
      return res;
    },
  };
  ZM.Diagnostics = D;
})(window.ZM);
