/* =========================================================
   Entrada: mouse, teclado, toque e ferramentas de construção
   ========================================================= */
(function (ZM) {
  'use strict';
  const U = ZM.util;

  const HINTS = {
    select: null,
    demolish: '🧨 Clique ou arraste para demolir construções e caminhos · botão direito cancela',
    path: '🛤️ Arraste para construir caminhos · botão direito cancela',
    removePath: '⛏️ Arraste para remover caminhos',
    terrain: '🖌️ Clique ou arraste para pintar o terreno',
    enclosure: '🏞️ Arraste um retângulo (mín. 3×3) encostado em um caminho',
    object: '📍 Clique para posicionar · botão direito cancela',
    prefab: '🏞️ Clique para colocar o habitat pronto encostado num caminho',
    animal: '🐾 Clique dentro de um recinto para soltar o animal',
    move: '✋ Clique numa construção para pegá-la e depois no novo lugar · botão direito cancela',
  };

  const Input = {
    tool: { type: 'select' },
    keys: {},
    follow: null,
    init(canvas) {
      this.canvas = canvas;
      canvas.addEventListener('mousedown', (e) => this.down(e));
      window.addEventListener('mousemove', (e) => this.move(e));
      window.addEventListener('mouseup', (e) => this.up(e));
      canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      window.addEventListener('keydown', (e) => this.keydown(e));
      window.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });
      window.addEventListener('blur', () => { this.keys = {}; });
      // toque
      canvas.addEventListener('touchstart', (e) => this.touch(e, 'start'), { passive: false });
      canvas.addEventListener('touchmove', (e) => this.touch(e, 'move'), { passive: false });
      canvas.addEventListener('touchend', (e) => this.touch(e, 'end'), { passive: false });
    },
    get r() { return ZM.game.renderer; },
    get zoo() { return ZM.game.zoo; },

    setTool(t) {
      this.tool = t;
      this.drag = null;
      this.r.preview = null;
      ZM.UI.syncToolButtons();
      let hint = HINTS[t.type];
      if (t.type === 'object') hint = `📍 ${ZM.OBJECTS[t.param].name}: clique para posicionar · botão direito cancela`;
      if (t.type === 'prefab') hint = `🏞️ ${ZM.PREFABS[t.param].name}: clique para colocar (encoste num caminho) · botão direito cancela`;
      if (t.type === 'animal') hint = `🐾 ${ZM.SPECIES[t.param].name}: clique dentro de um recinto · botão direito cancela`;
      if (t.type === 'terrain') hint = `🖌️ ${ZM.TERRAIN[t.param].name}: clique ou arraste para pintar`;
      if (t.type === 'enclosure') hint = `🏞️ ${ZM.FENCES[t.param].name}: arraste um retângulo encostado em um caminho`;
      if (t.type === 'move' && t.objId) { const o = this.zoo.objects.get(t.objId); if (o) hint = `✋ Movendo ${o.def.name}: clique no novo lugar · botão direito cancela`; }
      if (t.type !== 'animal') ZM.UI.showBuyPreview(null);
      ZM.UI.toolHint(hint);
      this.canvas.style.cursor = t.type === 'select' ? 'default' : 'crosshair';
      if (t.type !== 'select' && t.type !== 'demolish') { /* mantém a gaveta aberta */ } else ZM.UI.closeDrawer();
    },
    cancel() {
      if (this.tool.type !== 'select') { this.setTool({ type: 'select' }); return true; }
      return false;
    },

    tileAt(sx, sy) { const [x, y] = this.r.screenToTile(sx, sy); return [Math.floor(x), Math.floor(y)]; },

    down(e) {
      if (!this.zoo || ZM.Modals.isOpen) return;
      ZM.Audio.init();
      this.mx = e.clientX; this.my = e.clientY;
      if (e.button === 1 || e.button === 2) { this.pan = { x: e.clientX, y: e.clientY, moved: false, btn: e.button }; return; }
      if (e.button !== 0) return;
      const t = this.tileAt(e.clientX, e.clientY);
      const dragTools = ['path', 'removePath', 'terrain', 'enclosure', 'demolish'];
      if (dragTools.includes(this.tool.type)) { this.drag = { start: t, cur: t }; this.updatePreview(); return; }
      this.lpan = { x: e.clientX, y: e.clientY, moved: false };
    },
    move(e) {
      if (!this.zoo) return;
      this.mx = e.clientX; this.my = e.clientY;
      const p = this.pan || this.lpan;
      if (p) {
        const dx = e.clientX - p.x, dy = e.clientY - p.y;
        if (p.moved || Math.abs(dx) + Math.abs(dy) > 5) {
          p.moved = true;
          this.r.cam.x -= dx / this.r.cam.zoom; this.r.cam.y -= dy / this.r.cam.zoom;
          this.r.clampCam();
          p.x = e.clientX; p.y = e.clientY;
          this.follow = null;
          this.canvas.style.cursor = 'grabbing';
        }
        return;
      }
      if (e.target !== this.canvas && !this.drag) { this.r.hover = null; return; }
      const t = this.tileAt(e.clientX, e.clientY);
      this.r.hover = t;
      if (this.drag) this.drag.cur = t;
      this.updatePreview();
    },
    up(e) {
      if (!this.zoo) return;
      if (this.pan && (e.button === 1 || e.button === 2)) {
        const moved = this.pan.moved; this.pan = null;
        this.canvas.style.cursor = this.tool.type === 'select' ? 'default' : 'crosshair';
        if (!moved && e.button === 2) { if (!this.cancel()) ZM.UI.select(null); }
        return;
      }
      if (e.button !== 0) return;
      if (this.drag) { this.applyDrag(); this.drag = null; this.updatePreview(); return; }
      if (this.lpan) {
        const moved = this.lpan.moved; this.lpan = null;
        this.canvas.style.cursor = this.tool.type === 'select' ? 'default' : 'crosshair';
        if (!moved && e.target === this.canvas) this.click(e.clientX, e.clientY);
      }
    },
    zoomAt(sx, sy, f) {
      const r = this.r;
      const bx = (sx - r.w / 2) / r.cam.zoom + r.cam.x, by = (sy - r.h / 2) / r.cam.zoom + r.cam.y;
      r.cam.zoom = U.clamp(r.cam.zoom * f, 0.45, 3);
      r.cam.x = bx - (sx - r.w / 2) / r.cam.zoom; r.cam.y = by - (sy - r.h / 2) / r.cam.zoom;
      r.clampCam();
    },

    keydown(e) {
      if (!this.zoo) return;
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      this.keys[k] = true;
      if (k === 'escape') {
        if (ZM.Modals.isOpen) ZM.Modals.close();
        else if (this.cancel()) {}
        else if (ZM.UI.openCat) ZM.UI.closeDrawer();
        else if (ZM.UI.selected) ZM.UI.select(null);
        else ZM.Modals.pauseMenu();
        return;
      }
      if (ZM.Modals.isOpen) return;
      if (k === ' ') { e.preventDefault(); const z = this.zoo; if (z.speed) { this.prevSpeed = z.speed; ZM.UI.setSpeed(0); } else ZM.UI.setSpeed(this.prevSpeed || 1); }
      if (k === '1') ZM.UI.setSpeed(1);
      if (k === '2') ZM.UI.setSpeed(2);
      if (k === '3') ZM.UI.setSpeed(4);
      if (k === 'g') this.r.showGrid = !this.r.showGrid;
      if (k === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ZM.UI.doUndo(); return; }
      if (k === 'l' && !e.ctrlKey && !e.metaKey) ZM.UI.cycleLayer();
      if (k === 'm' && !e.ctrlKey && !e.metaKey) this.setTool(this.tool.type === 'move' ? { type: 'select' } : { type: 'move' });
      if (k === '+' || k === '=') this.zoomAt(this.r.w / 2, this.r.h / 2, 1.15);
      if (k === '-') this.zoomAt(this.r.w / 2, this.r.h / 2, 1 / 1.15);
      if ((k === 'delete' || k === 'backspace') && ZM.UI.selected && ZM.UI.selected.kind === 'object') { this.zoo.removeObject(ZM.UI.selected.id, true); ZM.UI.select(null); ZM.Audio.play('demolish'); }
    },
    update(dt) {
      if (!this.zoo) return;
      const r = this.r, sp = 650 * dt / r.cam.zoom;
      let moved = false;
      if (this.keys['w'] || this.keys['arrowup']) { r.cam.y -= sp; moved = true; }
      if (this.keys['s'] || this.keys['arrowdown']) { r.cam.y += sp; moved = true; }
      if (this.keys['a'] || this.keys['arrowleft']) { r.cam.x -= sp; moved = true; }
      if (this.keys['d'] || this.keys['arrowright']) { r.cam.x += sp; moved = true; }
      if (moved) { r.clampCam(); this.follow = null; }
      if (this.follow) {
        const z = this.zoo, f = this.follow;
        const ent = f.kind === 'animal' ? z.animalById(f.id) : f.kind === 'staff' ? z.staff.find((s) => s.id === f.id) : z.visitors.find((v) => v.id === f.id);
        if (!ent) this.follow = null;
        else { const tx = ZM.Iso.x(ent.x, ent.y), ty = ZM.Iso.y(ent.x, ent.y); r.cam.x += (tx - r.cam.x) * Math.min(1, dt * 4); r.cam.y += (ty - r.cam.y) * Math.min(1, dt * 4); }
      }
    },

    /* ---------- pré-visualização ---------- */
    rectOf(a, b) { return { x0: Math.min(a[0], b[0]), y0: Math.min(a[1], b[1]), x1: Math.max(a[0], b[0]), y1: Math.max(a[1], b[1]) }; },
    lineTiles(a, b) {
      const out = [];
      const [x0, y0] = a, [x1, y1] = b;
      const sx = Math.sign(x1 - x0) || 1, sy = Math.sign(y1 - y0) || 1;
      for (let x = x0; x !== x1 + sx; x += sx) out.push([x, y0]);
      for (let y = y0 + sy; y !== y1 + sy; y += sy) out.push([x1, y]);
      if (y0 === y1) out.splice(out.length - 0, 0);
      return out;
    },
    brushTiles(t) {
      const n = ZM.UI.brush, o = Math.floor((n - 1) / 2), out = [];
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) out.push([t[0] - o + x, t[1] - o + y]);
      return out;
    },
    rectTiles(r) { const out = []; for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) out.push([x, y]); return out; },

    updatePreview() {
      const z = this.zoo, r = this.r, t = this.tool, h = r.hover;
      if (!h) { r.preview = null; if (t.type === 'animal') ZM.UI.showBuyPreview(null); return; }
      const m = z.map;
      const P = (o) => { r.preview = o; };
      switch (t.type) {
        case 'select': r.preview = null; break;
        case 'path': {
          const tiles = this.drag ? this.lineTiles(this.drag.start, this.drag.cur) : [h];
          const marked = tiles.map(([x, y]) => [x, y, z.canPath(x, y) || (m.inb(x, y) && !!m.path[m.idx(x, y)])]);
          const n = tiles.filter(([x, y]) => z.canPath(x, y)).length;
          P({ tiles: marked, ok: true, label: this.drag ? `${n} × ${U.money(ZM.PATH_COST)} = ${U.money(n * ZM.PATH_COST)}` : null, lx: h[0], ly: h[1] });
          break;
        }
        case 'removePath': case 'demolish': {
          const rc = this.drag ? this.rectOf(this.drag.start, this.drag.cur) : { x0: h[0], y0: h[1], x1: h[0], y1: h[1] };
          let back = 0, n = 0; const seen = new Set();
          this.rectTiles(rc).forEach(([x, y]) => {
            if (!m.inb(x, y)) return;
            const o = t.type === 'demolish' ? z.objAt(x, y) : null;
            if (o) { if (!seen.has(o.id)) { seen.add(o.id); n++; back += Math.round((o.def.cost || 0) * 0.4); } }
            else if (m.path[m.idx(x, y)]) { n++; back += Math.round(ZM.PATH_COST * 0.3); }
          });
          P({ rect: rc, ok: false, label: n ? `${t.type === 'demolish' ? 'Demolir' : 'Remover'} ${n} · devolve ${U.money(back)}` : null, lx: rc.x1, ly: rc.y1 });
          break;
        }
        case 'move': {
          if (!t.objId) { const o = z.objAt(h[0], h[1]); P({ tiles: [h], ok: !!(o && o.def.cat !== 'nature' || o), label: o ? `Pegar ${o.def.name}` : null, lx: h[0], ly: h[1] }); break; }
          const o = z.objects.get(t.objId);
          if (!o) { this.setTool({ type: 'move' }); break; }
          const c = z.canMoveObject(o.id, h[0], h[1]);
          const ghost = new ZM.ZooObject(o.type, h[0], h[1], -1); if (o.food != null) ghost.food = o.food;
          const tiles = []; for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) tiles.push([h[0] + x, h[1] + y]);
          P({ tiles, ok: c.ok, ghost, label: c.ok ? `Mover ${o.def.name} (grátis)` : c.reason, lx: h[0], ly: h[1] });
          break;
        }
        case 'terrain': {
          const tiles = this.drag && (this.drag.start[0] !== this.drag.cur[0] || this.drag.start[1] !== this.drag.cur[1]) ? this.rectTiles(this.rectOf(this.drag.start, this.drag.cur)) : this.brushTiles(h);
          const cost = tiles.filter(([x, y]) => m.inb(x, y) && m.terrain[m.idx(x, y)] !== t.param).length * ZM.TERRAIN[t.param].cost;
          P({ tiles: tiles.map(([x, y]) => [x, y]), ok: true, label: this.drag ? U.money(cost) : null, lx: h[0], ly: h[1] });
          break;
        }
        case 'enclosure': {
          if (!this.drag) { P({ tiles: [h], ok: true }); break; }
          const rc = this.rectOf(this.drag.start, this.drag.cur);
          const c = z.canEnclosure(rc.x0, rc.y0, rc.x1, rc.y1, t.param);
          P({ rect: rc, ok: c.ok, label: c.ok ? `${rc.x1 - rc.x0 + 1}×${rc.y1 - rc.y0 + 1} · ${U.money(c.cost)}` : c.reason, lx: rc.x1, ly: rc.y1 });
          break;
        }
        case 'object': {
          const c = z.canPlaceObject(t.param, h[0], h[1]);
          const d = ZM.OBJECTS[t.param];
          const ghost = new ZM.ZooObject(t.param, h[0], h[1], -1);
          if (d.kind === 'feeder') ghost.food = 100;
          const tiles = []; for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) tiles.push([h[0] + x, h[1] + y]);
          P({ tiles, ok: c.ok, ghost, label: c.ok ? U.money(d.cost) : c.reason, lx: h[0], ly: h[1] });
          break;
        }
        case 'prefab': {
          const pf = ZM.PREFABS[t.param];
          const ox = h[0] - Math.floor(pf.w / 2), oy = h[1] - Math.floor(pf.h / 2);
          const c = z.canPrefab(t.param, ox, oy);
          const tiles = [];
          for (let dy = 0; dy < pf.h; dy++) for (let dx = 0; dx < pf.w; dx++) tiles.push([ox + dx, oy + dy, ZM.TERRAIN[pf.terrain(dx, dy, pf.w, pf.h)].color]);
          P({ rect: { x0: ox, y0: oy, x1: ox + pf.w - 1, y1: oy + pf.h - 1 }, colored: tiles, ok: c.ok, label: c.ok ? `${pf.name} · ${U.money(pf.cost)}${c.touches ? '' : ' · ⚠️ sem caminho encostado'}` : c.reason, lx: ox + pf.w - 1, ly: oy + pf.h - 1 });
          break;
        }
        case 'animal': {
          const e = z.encAt(h[0], h[1]);
          const sp = ZM.SPECIES[t.param];
          ZM.UI.showBuyPreview(e ? t.param : null, e ? e.id : null, ZM.UI.sexPref === 'auto' ? undefined : ZM.UI.sexPref);
          if (!e) { P({ tiles: [h], ok: false, label: 'Clique dentro de um recinto', lx: h[0], ly: h[1] }); break; }
          const score = e.habitatScore(sp);
          const fenceOk = ZM.FENCES[e.fence].level >= sp.fence;
          const sx = ZM.UI.sexPref === 'M' ? ' ♂' : ZM.UI.sexPref === 'F' ? ' ♀' : '';
          const waterOk = !sp.waterOnly || (sp.waterOnly === 'salt' ? e.stats.salt : e.stats.fresh) > 0;
          const lbl = `${sp.name}${sx} · ${U.money(sp.price)} · habitat ${score}%${fenceOk ? '' : ' · ⚠️ cerca fraca'}${waterOk ? '' : ' · sem ' + (sp.waterOnly === 'salt' ? 'água salgada' : 'água doce')}`;
          P({ rect: { x0: e.x0, y0: e.y0, x1: e.x1, y1: e.y1 }, ok: score >= 50 && fenceOk && waterOk, label: lbl, lx: h[0], ly: h[1] });
          break;
        }
      }
    },

    applyDrag() {
      const z = this.zoo, t = this.tool, d = this.drag;
      const m = z.map;
      switch (t.type) {
        case 'path': {
          const tiles = this.lineTiles(d.start, d.cur);
          const n = z.placePaths(tiles);
          if (n) ZM.Audio.play('build');
          else if (!tiles.some(([x, y]) => m.inb(x, y) && m.path[m.idx(x, y)])) { ZM.UI.toast({ text: '❌ Não é possível construir caminho aqui (água, recinto ou construção).', type: 'warn' }); ZM.Audio.play('error'); }
          break;
        }
        case 'removePath': {
          let n = 0;
          z.undo.group('Remover caminhos', () => { this.rectTiles(this.rectOf(d.start, d.cur)).forEach(([x, y]) => { if (z.removePath(x, y, { batch: true })) n++; }); });
          if (n) { z.refreshAll(); ZM.Audio.play('demolish'); }
          break;
        }
        case 'terrain': {
          const tiles = d.start[0] !== d.cur[0] || d.start[1] !== d.cur[1] ? this.rectTiles(this.rectOf(d.start, d.cur)) : this.brushTiles(d.cur);
          const n = z.paintTerrain(tiles, t.param);
          if (n) ZM.Audio.play('build'); else if (!z.sandbox && z.money < ZM.TERRAIN[t.param].cost) { ZM.UI.toast({ text: '❌ Dinheiro insuficiente.', type: 'warn' }); }
          break;
        }
        case 'enclosure': {
          const rc = this.rectOf(d.start, d.cur);
          const res = z.createEnclosure(rc.x0, rc.y0, rc.x1, rc.y1, t.param);
          if (!res.ok) { ZM.UI.toast({ text: '❌ ' + res.reason, type: 'warn' }); ZM.Audio.play('error'); }
          else {
            ZM.Audio.play('build');
            ZM.UI.select({ kind: 'enclosure', id: res.enc.id });
            if (!res.enc.gate) ZM.UI.toast({ text: '💡 Recinto criado! Encoste um caminho na cerca para surgir o portão.', type: 'info' });
          }
          break;
        }
        case 'demolish': {
          const rc = this.rectOf(d.start, d.cur);
          let n = 0;
          const single = rc.x0 === rc.x1 && rc.y0 === rc.y1;
          z.undo.group(single ? 'Demolir' : 'Demolir área', () => {
            this.rectTiles(rc).forEach(([x, y]) => {
              const o = z.objAt(x, y);
              if (o) { z.removeObject(o.id, true, { batch: true }); n++; }
              else if (z.removePath(x, y, { batch: true })) n++;
            });
          });
          if (n) { z.refreshAll(); ZM.Audio.play('demolish'); }
          else if (single) { const e = z.encAt(rc.x0, rc.y0); if (e) { ZM.UI.select({ kind: 'enclosure', id: e.id }); ZM.UI.toast({ text: 'Para remover o recinto, use "Demolir recinto" no painel.', type: 'info' }); } }
          break;
        }
      }
      ZM.UI.renderDrawer && ZM.UI.openCat && ZM.UI.renderDrawer();
    },

    click(sx, sy) {
      const z = this.zoo, t = this.tool;
      const [tx, ty] = this.tileAt(sx, sy);
      if (t.type === 'move') {
        if (!t.objId) {
          const o = z.objAt(tx, ty);
          if (!o) { ZM.UI.toast({ text: 'Clique numa construção, item ou planta para movê-la.', type: 'info', key: 'move' }); return; }
          this.setTool({ type: 'move', objId: o.id });
          this.updatePreview();
          return;
        }
        const o = z.objects.get(t.objId);
        const res = o ? z.moveObject(o.id, tx, ty) : { ok: false, reason: 'Objeto não existe mais' };
        if (!res.ok) { ZM.UI.toast({ text: '❌ ' + res.reason, type: 'warn' }); ZM.Audio.play('error'); return; }
        ZM.Audio.play('build');
        this.setTool({ type: 'move' });
        this.updatePreview();
        return;
      }
      if (t.type === 'object') {
        const res = z.placeObject(t.param, tx, ty);
        if (!res.ok) { ZM.UI.toast({ text: '❌ ' + res.reason, type: 'warn' }); ZM.Audio.play('error'); return; }
        ZM.Audio.play('build');
        const d = ZM.OBJECTS[t.param];
        if (d.needsPath && !res.obj.access.length) ZM.UI.toast({ text: `💡 ${d.name} precisa de um caminho encostado para funcionar.`, type: 'info' });
        if (d.unique) this.setTool({ type: 'select' });
        this.updatePreview();
        return;
      }
      if (t.type === 'prefab') {
        const pf = ZM.PREFABS[t.param];
        const res = z.placePrefab(t.param, tx - Math.floor(pf.w / 2), ty - Math.floor(pf.h / 2));
        if (!res.ok) { ZM.UI.toast({ text: '❌ ' + res.reason, type: 'warn' }); ZM.Audio.play('error'); return; }
        ZM.Audio.play('build');
        ZM.UI.toast({ text: `${pf.icon} ${pf.name} construído! Agora compre os animais no painel do habitat.${res.touches ? '' : ' Encoste um caminho para criar o portão.'}`, type: 'good' });
        this.setTool({ type: 'select' });
        ZM.UI.select({ kind: 'enclosure', id: res.enc.id });
        return;
      }
      if (t.type === 'animal') {
        const e = z.encAt(tx, ty);
        if (!e) { ZM.UI.toast({ text: 'Clique dentro de um recinto.', type: 'info' }); return; }
        // compra arriscada pede um segundo clique: o jogador pode arriscar, mas sabendo das consequências
        const pv = ZM.Diagnostics.purchase(z, t.param, e.id, ZM.UI.sexPref === 'auto' ? undefined : ZM.UI.sexPref);
        if (pv.verdict === 'blocked') { ZM.UI.toast({ text: '❌ ' + pv.blocked, type: 'warn' }); ZM.Audio.play('error'); return; }
        if (pv.verdict === 'risky') {
          const k = t.param + ':' + e.id, now = performance.now();
          if (!this.riskOk || this.riskOk.k !== k || now - this.riskOk.t > 6000) {
            this.riskOk = { k, t: now };
            const bad = pv.items.filter((i) => i.sev === 'bad').map((i) => i.text.split(':')[0].toLowerCase());
            ZM.UI.toast({ text: `⛔ Compra arriscada (${bad.join(', ')}). Clique de novo para comprar mesmo assim.`, type: 'warn', key: 'risk' });
            return;
          }
          this.riskOk = null;
        }
        const res = z.buyAnimal(t.param, e.id, { x: tx, y: ty, sex: ZM.UI.sexPref === 'auto' ? undefined : ZM.UI.sexPref });
        if (!res.ok) { ZM.UI.toast({ text: '❌ ' + res.reason, type: 'warn' }); ZM.Audio.play('error'); return; }
        const sp = ZM.SPECIES[t.param];
        ZM.UI.toast({ text: `${ZM.speciesIcon(sp.id)} ${res.animal.name} (${res.animal.sex === 'M' ? 'macho' : 'fêmea'}) chegou ao ${e.name}!`, type: 'good' });
        if (ZM.FENCES[e.fence].level < sp.fence) ZM.UI.toast({ text: `⚠️ ${sp.plural} precisam de cerca nível ${sp.fence}. Risco de fuga!`, type: 'danger' });
        return;
      }
      // seleção
      const r = this.r;
      let best = null, bd = 18;
      const test = (ent, kind, yoff, rad) => {
        const [wx, wy] = [ZM.Iso.x(ent.x, ent.y), ZM.Iso.y(ent.x, ent.y)];
        const [px, py] = r.worldToScreen(wx, wy - yoff);
        const d = Math.hypot(px - sx, py - sy) / (rad || 1);
        if (d < bd) { bd = d; best = { kind, id: ent.id }; }
      };
      z.animals.forEach((a) => { if (!a.inShelter) test(a, 'animal', 8 * a.sp.size, 1.3 * a.sp.size); });
      z.staff.forEach((s) => test(s, 'staff', 9, 1));
      z.visitors.forEach((v) => test(v, 'visitor', 9, 1));
      if (best) { ZM.UI.select(best); ZM.Audio.play('click'); if (best.kind === 'animal' && Math.random() < 0.5) ZM.Audio.play('animal'); return; }
      const o = z.objAt(tx, ty);
      if (o && o.def.cat !== 'nature') { ZM.UI.select({ kind: 'object', id: o.id }); ZM.Audio.play('click'); return; }
      const e = z.encAt(tx, ty);
      if (e) { ZM.UI.select({ kind: 'enclosure', id: e.id }); ZM.Audio.play('click'); return; }
      if (o) { ZM.UI.select({ kind: 'object', id: o.id }); return; }
      ZM.UI.select(null);
    },

    /* ---------- toque (básico) ---------- */
    touch(e, phase) {
      e.preventDefault();
      const ts = e.touches;
      if (phase === 'start') {
        if (ts.length === 1) this.tp = { x: ts[0].clientX, y: ts[0].clientY, moved: false, sx: ts[0].clientX, sy: ts[0].clientY };
        if (ts.length === 2) this.pinch = Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
      } else if (phase === 'move') {
        if (ts.length === 2 && this.pinch) {
          const d = Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
          this.zoomAt((ts[0].clientX + ts[1].clientX) / 2, (ts[0].clientY + ts[1].clientY) / 2, d / this.pinch);
          this.pinch = d; if (this.tp) this.tp.moved = true;
        } else if (ts.length === 1 && this.tp) {
          const dx = ts[0].clientX - this.tp.x, dy = ts[0].clientY - this.tp.y;
          if (this.tp.moved || Math.abs(ts[0].clientX - this.tp.sx) + Math.abs(ts[0].clientY - this.tp.sy) > 8) {
            this.tp.moved = true;
            this.r.cam.x -= dx / this.r.cam.zoom; this.r.cam.y -= dy / this.r.cam.zoom; this.r.clampCam();
          }
          this.tp.x = ts[0].clientX; this.tp.y = ts[0].clientY;
        }
      } else if (phase === 'end') {
        if (this.tp && !this.tp.moved && ts.length === 0) {
          const [tx, ty] = this.tileAt(this.tp.x, this.tp.y);
          this.r.hover = [tx, ty];
          if (['path', 'removePath', 'terrain', 'enclosure', 'demolish'].includes(this.tool.type)) {
            // toque duplo define retângulo: 1º toque inicia, 2º finaliza
            if (!this.touchDrag) { this.touchDrag = [tx, ty]; this.drag = { start: [tx, ty], cur: [tx, ty] }; this.updatePreview(); }
            else { this.drag = { start: this.touchDrag, cur: [tx, ty] }; this.applyDrag(); this.drag = null; this.touchDrag = null; this.updatePreview(); }
          } else this.click(this.tp.x, this.tp.y);
        }
        if (ts.length < 2) this.pinch = null;
        if (ts.length === 0) this.tp = null;
      }
    },
  };
  ZM.Input = Input;
})(window.ZM);
