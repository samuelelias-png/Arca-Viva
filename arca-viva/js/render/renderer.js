/* =========================================================
   Renderizador isométrico: câmera, cache de terreno,
   ordenação por profundidade, dia/noite e efeitos
   ========================================================= */
(function (ZM) {
  'use strict';
  const U = ZM.util, C = ZM.CONFIG, HW = C.HW, HH = C.HH, S = ZM.Sprites, Iso = ZM.Iso, T = ZM.T;

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.cam = { x: 0, y: (C.MAP_W + C.MAP_H) * HH * 0.5, zoom: 1.2 };
      this.cache = document.createElement('canvas');
      this.cacheVersion = -1;
      this.preview = null;
      this.hover = null;
      this.selected = null;
      this.rain = [];
      for (let i = 0; i < 140; i++) this.rain.push({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.6 });
      this.showGrid = false;
      this.layer = null;      // camada de informação: access | clean | welfare | staff
      this.flash = null;      // marcador "localizar" { x, y, t0 }
      this.buildMs = 0;       // tempo da última reconstrução do cache (diagnóstico de desempenho)
      this.resize();
    }
    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.dpr = dpr;
      this.w = window.innerWidth; this.h = window.innerHeight;
      this.canvas.width = Math.floor(this.w * dpr); this.canvas.height = Math.floor(this.h * dpr);
      this.canvas.style.width = this.w + 'px'; this.canvas.style.height = this.h + 'px';
    }
    centerOn(tx, ty) { this.cam.x = Iso.x(tx, ty); this.cam.y = Iso.y(tx, ty); }
    worldToScreen(wx, wy) { return [(wx - this.cam.x) * this.cam.zoom + this.w / 2, (wy - this.cam.y) * this.cam.zoom + this.h / 2]; }
    screenToTile(sx, sy) {
      const ix = (sx - this.w / 2) / this.cam.zoom + this.cam.x;
      const iy = (sy - this.h / 2) / this.cam.zoom + this.cam.y;
      const x = (ix / HW + iy / HH) / 2, y = (iy / HH - ix / HW) / 2;
      return [x, y];
    }
    clampCam() {
      const W = C.MAP_W, H = C.MAP_H;
      this.cam.x = U.clamp(this.cam.x, -H * HW, W * HW);
      this.cam.y = U.clamp(this.cam.y, 0, (W + H) * HH);
      this.cam.zoom = U.clamp(this.cam.zoom, 0.45, 3);
    }

    /* ---------- cache do terreno + caminhos ----------
       1) cores base (com margem de floresta ao redor do mapa)
       2) mistura: camada nítida + camada desfocada = transições suaves entre terrenos
       3) manchas de luz/sombra, 4) detalhes por tile, 5) água com profundidade e espuma,
       6) calçamento com meio-fio, 7) floresta densa fora do mapa */
    buildCache(zoo, rg) {
      const m = zoo.map, W = m.w, H = m.h, M = 7;
      const cw = (W + H + 4 * M) * HW, ch = (W + H + 4 * M) * HH + 8;
      this.offX = (H + 2 * M) * HW; this.offY = 2 * M * HH;
      const c = this.cache;
      if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; rg = null; }
      // ---- região a refazer (atualização parcial: só onde o mapa mudou) ----
      // Rt: tiles com cor-base/água alterada (+3 de raio da profundidade da água)
      // P : retângulo em pixels dessas camadas; R: P + margem dos desfoques (cache final)
      let P = null, R = null;
      const tileRect = (x0, y0, x1, y1, pad) => {
        const pts = [Iso.p(x0, y0), Iso.p(x1 + 1, y0), Iso.p(x1 + 1, y1 + 1), Iso.p(x0, y1 + 1)];
        const xs = pts.map((q) => q[0] + this.offX), ys = pts.map((q) => q[1] + this.offY);
        const rx = Math.max(0, Math.floor(Math.min(...xs) - pad)), ry = Math.max(0, Math.floor(Math.min(...ys) - pad));
        return { x: rx, y: ry, w: Math.min(cw, Math.ceil(Math.max(...xs) + pad)) - rx, h: Math.min(ch, Math.ceil(Math.max(...ys) + pad)) - ry };
      };
      let ax0 = -M, ay0 = -M, ax1 = W + M - 1, ay1 = H + M - 1;     // tiles das camadas base/água
      let bx0 = -M, by0 = -M, bx1 = W + M - 1, by1 = H + M - 1;     // tiles do cache final
      if (rg) {
        const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
        P = tileRect(rg.x0 - 3, rg.y0 - 3, rg.x1 + 3, rg.y1 + 3, 4);
        R = tileRect(rg.x0 - 3, rg.y0 - 3, rg.x1 + 3, rg.y1 + 3, 40);
        // todos os tiles que tocam o retângulo (com folga para o que é desenhado para cima, como árvores)
        const range = (rc, down) => {
          const cs = [[rc.x, rc.y], [rc.x + rc.w, rc.y], [rc.x, rc.y + rc.h], [rc.x + rc.w, rc.y + rc.h]].map(([px, py]) => { const ix = px - this.offX, iy = py - this.offY; return [(ix / HW + iy / HH) / 2, (iy / HH - ix / HW) / 2]; });
          const xs = cs.map((q) => q[0]), ys = cs.map((q) => q[1]);
          return [cl(Math.floor(Math.min(...xs)) - 2, -M, W + M - 1), cl(Math.floor(Math.min(...ys)) - 2, -M, H + M - 1), cl(Math.ceil(Math.max(...xs)) + 1 + down, -M, W + M - 1), cl(Math.ceil(Math.max(...ys)) + 1 + down, -M, H + M - 1)];
        };
        [ax0, ay0, ax1, ay1] = range(P, 0);
        [bx0, by0, bx1, by1] = range(R, 3);
      }
      const opened = [];
      const begin = (gg, rect) => {
        gg.setTransform(1, 0, 0, 1, 0, 0); gg.save(); opened.push(gg);
        if (rect) { gg.beginPath(); gg.rect(rect.x, rect.y, rect.w, rect.h); gg.clip(); gg.clearRect(rect.x, rect.y, rect.w, rect.h); }
        else gg.clearRect(0, 0, cw, ch);
      };
      const mk = (k, rect) => {
        const cv = this[k] || (this[k] = document.createElement('canvas'));
        if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; rect = null; }
        const gg = cv.getContext('2d'); begin(gg, rect); return [cv, gg];
      };
      // desenha só a parte necessária de uma camada (o desfoque fica restrito a ela)
      const blit = (gg, src, rect) => { if (!rect) gg.drawImage(src, 0, 0); else { const x = Math.max(0, rect.x - 40), y = Math.max(0, rect.y - 40), w = Math.min(cw, rect.x + rect.w + 40) - x, h = Math.min(ch, rect.y + rect.h + 40) - y; gg.drawImage(src, x, y, w, h, x, y, w, h); } };
      const g = c.getContext('2d');
      const terr = (x, y) => (m.inb(x, y) ? m.terrain[m.idx(x, y)] : -1);
      const inMap = (fn, x0, y0, x1, y1) => { for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) fn(x, y); };
      // 1) base
      const [bc, bg] = mk('_base', P);
      bg.translate(this.offX, this.offY);
      for (let y = ay0; y <= ay1; y++) for (let x = ax0; x <= ax1; x++) {
        const t = terr(x, y), v = (U.hash(x, y, 1) - 0.5);
        let col;
        if (t < 0) col = U.shade('#3d6a2c', v * 0.14);
        else if (ZM.isWater(t)) col = t === T.SALT ? '#cdbb86' : '#a89668';
        else col = U.shade(ZM.TERRAIN[t].color, v * 0.07);
        this.diamond(bg, x, y, -0.03); bg.fillStyle = col; bg.fill();
      }
      // 2) mistura nítida + desfocada
      begin(g, R);
      blit(g, bc, R);
      g.filter = 'blur(12px)'; blit(g, bc, R); g.filter = 'none';
      g.translate(this.offX, this.offY);
      const hitR = (x, y, rx, ry) => !R || (x + this.offX + rx >= R.x && x + this.offX - rx <= R.x + R.w && y + this.offY + ry >= R.y && y + this.offY - ry <= R.y + R.h);
      // 3) manchas grandes de luz e sombra (variação natural do gramado)
      const patches = Math.floor((W + 2 * M) * (H + 2 * M) / 14);
      for (let k = 0; k < patches; k++) {
        const px = -M + U.hash(k, 3, 91) * (W + 2 * M), py = -M + U.hash(k, 7, 92) * (H + 2 * M);
        const [cx, cy] = Iso.p(px, py);
        const r = 40 + U.hash(k, 1, 93) * 90;
        if (!hitR(cx, cy, r, r * 0.55)) continue;
        const light = U.hash(k, 2, 94) > 0.5;
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
        gr.addColorStop(0, light ? 'rgba(255,250,200,0.07)' : 'rgba(10,30,5,0.08)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, r, r * 0.55, 0, 0, Math.PI * 2); g.fill();
      }
      // 4) detalhes
      for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
        const t = terr(x, y);
        if (t >= 0 && ZM.isWater(t)) continue;
        this.drawDetail(g, x, y, t);
      }
      // 5) água: profundidade (distância até a margem) + leve desfoque + espuma
      const [wc, wg] = mk('_water', P);
      wg.translate(this.offX, this.offY);
      const depthOf = (x, y) => { for (let r = 1; r <= 3; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const tt = terr(x + dx, y + dy); if (tt >= 0 && !ZM.isWater(tt)) return r - 1; } return 3; };
      inMap((x, y) => {
        const t = m.terrain[m.idx(x, y)];
        if (!ZM.isWater(t)) return;
        const d = depthOf(x, y);
        const base = t === T.SALT ? ['#5fc4c8', '#2f9db0', '#1d7f97', '#13627a'] : ['#7fc9e0', '#4aa6d4', '#337fb4', '#24639a'];
        this.diamond(wg, x, y, -0.04); wg.fillStyle = base[d]; wg.fill();
      }, ax0, ay0, ax1, ay1);
      // desfoque forte da profundidade, recortado pela forma exata da água
      const [mc, mg] = mk('_wmask', P);
      mg.translate(this.offX, this.offY);
      inMap((x, y) => { if (ZM.isWater(m.terrain[m.idx(x, y)])) { this.diamond(mg, x, y, -0.01); mg.fillStyle = '#000'; mg.fill(); } }, ax0, ay0, ax1, ay1);
      const [bl, blg] = mk('_wblur', R);
      blit(blg, wc, R); // cor original por baixo (bordas)
      blg.filter = 'blur(10px)'; blg.globalAlpha = 0.85; blit(blg, wc, R); blg.filter = 'none'; blg.globalAlpha = 1;
      blg.globalCompositeOperation = 'destination-in'; blit(blg, mc, R); blg.globalCompositeOperation = 'source-over';
      g.setTransform(1, 0, 0, 1, 0, 0);
      blit(g, bl, R);
      g.translate(this.offX, this.offY);
      inMap((x, y) => {
        const t = m.terrain[m.idx(x, y)];
        if (!ZM.isWater(t)) return;
        const [cx, cy] = Iso.p(x + 0.5, y + 0.5);
        // reflexos e ondulações fixas
        g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1;
        const h1 = U.hash(x, y, 33);
        g.beginPath(); g.ellipse(cx + (h1 - 0.5) * 16, cy + (U.hash(x, y, 34) - 0.5) * 8, 5 + h1 * 4, 1.4, 0, 0, Math.PI); g.stroke();
        // espuma na margem
        const corners = [Iso.p(x, y), Iso.p(x + 1, y), Iso.p(x + 1, y + 1), Iso.p(x, y + 1)];
        [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([dx, dy], k) => {
          const tt = terr(x + dx, y + dy);
          if (tt >= 0 && !ZM.isWater(tt)) {
            const a = corners[k], b2 = corners[(k + 1) % 4];
            g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 2;
            g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b2[0], b2[1]); g.stroke();
            const ix = (cx - (a[0] + b2[0]) / 2) * 0.22, iy = (cy - (a[1] + b2[1]) / 2) * 0.22;
            g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 1.2;
            g.beginPath(); g.moveTo(a[0] + ix, a[1] + iy); g.lineTo(b2[0] + ix, b2[1] + iy); g.stroke();
          }
        });
      }, bx0, by0, bx1, by1);
      // 6) caminhos
      inMap((x, y) => { if (m.path[m.idx(x, y)]) this.drawPath(g, m, x, y); }, bx0, by0, bx1, by1);
      // 6b) borda de concreto dos habitats prontos (aparência de construção)
      zoo.enclosures.forEach((e) => {
        if (!e.prefab) return;
        if (rg && (e.x1 + 2 < bx0 || e.x0 - 2 > bx1 || e.y1 + 2 < by0 || e.y0 - 2 > by1)) return;
        const rim = ZM.PREFABS[e.prefab].rim || '#8a9aa0', o = 0.12;
        const P4 = [Iso.p(e.x0 - o, e.y0 - o), Iso.p(e.x1 + 1 + o, e.y0 - o), Iso.p(e.x1 + 1 + o, e.y1 + 1 + o), Iso.p(e.x0 - o, e.y1 + 1 + o)];
        const loop = () => { g.beginPath(); g.moveTo(P4[0][0], P4[0][1]); for (let k = 1; k < 4; k++) g.lineTo(P4[k][0], P4[k][1]); g.closePath(); };
        g.lineJoin = 'round';
        loop(); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 11; g.stroke();
        loop(); g.strokeStyle = rim; g.lineWidth = 8; g.stroke();
        loop(); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.2; g.stroke();
        for (let k = 0; k < 4; k++) { const a = P4[k], b2 = P4[(k + 1) % 4]; const n = Math.max(2, Math.round(Math.hypot(b2[0] - a[0], b2[1] - a[1]) / 18)); for (let q = 1; q < n; q++) { const px = a[0] + (b2[0] - a[0]) * q / n, py = a[1] + (b2[1] - a[1]) * q / n; g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(px - 0.5, py - 3, 1, 6); } }
      });
      // 7) floresta fora do mapa
      const trees = [];
      for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
        if (m.inb(x, y)) continue;
        const dist = Math.max(-x, -y, x - (W - 1), y - (H - 1));
        if (dist < 2 || U.hash(x, y, 77) > 0.8) continue;
        trees.push([x + 0.2 + U.hash(x, y, 78) * 0.6, y + 0.2 + U.hash(x, y, 79) * 0.6, dist]);
      }
      trees.sort((a, b2) => a[0] + a[1] - b2[0] - b2[1]);
      trees.forEach(([x, y, dist]) => this.forestTree(g, x, y, Math.min(1.25, 0.8 + dist * 0.06)));
      opened.forEach((gg) => gg.restore());
      g.setTransform(1, 0, 0, 1, 0, 0);
      this.cacheVersion = m.version;
      this.cacheMap = m;
      this.lastBuild = rg ? 'parcial' : 'completo';
    }
    forestTree(g, x, y, s) {
      const [cx, cy] = Iso.p(x, y);
      const h = U.hash(Math.floor(x * 10), Math.floor(y * 10), 5);
      g.fillStyle = 'rgba(10,25,5,0.3)'; g.beginPath(); g.ellipse(cx + 5, cy + 2, 15 * s, 7 * s, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#4a3420'; g.fillRect(cx - 1.5 * s, cy - 10 * s, 3 * s, 10 * s);
      const pine = h > 0.55;
      if (pine) {
        const cols = ['#24461f', '#2e5a27', '#3a6d30'];
        for (let k = 0; k < 3; k++) { g.fillStyle = cols[k]; g.beginPath(); g.moveTo(cx - (13 - k * 3) * s, cy - (8 + k * 9) * s); g.lineTo(cx, cy - (30 + k * 7) * s); g.lineTo(cx + (13 - k * 3) * s, cy - (8 + k * 9) * s); g.closePath(); g.fill(); }
      } else {
        const r = 12 * s;
        [['#2a5223', 0, -18, 1], ['#336128', -5, -22, 0.75], ['#3d7030', 5, -24, 0.65], ['#4a8038', -1, -28, 0.45]].forEach(([col, ox, oy, k]) => { g.fillStyle = col; g.beginPath(); g.ellipse(cx + ox * s, cy + oy * s, r * k, r * k * 0.85, 0, 0, Math.PI * 2); g.fill(); });
      }
    }
    diamond(g, x, y, inset = 0) {
      const [ax, ay] = Iso.p(x + inset, y + inset), [bx, by] = Iso.p(x + 1 - inset, y + inset), [cx, cy] = Iso.p(x + 1 - inset, y + 1 - inset), [dx, dy] = Iso.p(x + inset, y + 1 - inset);
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.lineTo(cx, cy); g.lineTo(dx, dy); g.closePath();
    }
    drawDetail(g, x, y, t) {
      const [cx, cy] = Iso.p(x + 0.5, y + 0.5);
      const H = (k) => U.hash(x, y, k);
      const inside = (ox, oy) => Math.abs(ox) / 30 + Math.abs(oy) / 15 < 0.9;
      if (t === T.GRASS || t < 0 || t === T.FOREST) {
        const n = t === T.GRASS ? 7 : 5;
        for (let k = 0; k < n; k++) {
          const ox = (H(10 + k) - 0.5) * 56, oy = (H(20 + k) - 0.5) * 28;
          if (!inside(ox, oy)) continue;
          const len = 2.5 + H(30 + k) * 2.5;
          g.strokeStyle = t === T.GRASS ? (k % 2 ? 'rgba(70,125,45,0.75)' : 'rgba(150,200,90,0.55)') : (k % 2 ? 'rgba(30,60,20,0.6)' : 'rgba(90,130,60,0.45)');
          g.lineWidth = 1;
          g.beginPath(); g.moveTo(cx + ox, cy + oy); g.lineTo(cx + ox - 1, cy + oy - len); g.moveTo(cx + ox + 1.5, cy + oy); g.lineTo(cx + ox + 2.5, cy + oy - len * 0.8); g.stroke();
        }
        if (t !== T.GRASS) for (let k = 0; k < 4; k++) { const ox = (H(40 + k) - 0.5) * 50, oy = (H(50 + k) - 0.5) * 24; if (!inside(ox, oy)) continue; g.fillStyle = ['#8a6a2f', '#a3813a', '#6b5424', '#7a8a3a'][k]; g.beginPath(); g.ellipse(cx + ox, cy + oy, 1.6, 0.9, H(60 + k) * 3, 0, Math.PI * 2); g.fill(); }
        if (t === T.GRASS && H(2) > 0.86) {
          const fc = ['#fff6a8', '#ffffff', '#ffb3c8', '#c9a7ff'][Math.floor(H(3) * 4)];
          for (let k = 0; k < 3; k++) { g.fillStyle = fc; g.beginPath(); g.arc(cx + (H(70 + k) - 0.5) * 20, cy + (H(80 + k) - 0.5) * 8, 1.2, 0, Math.PI * 2); g.fill(); }
        }
        if (t === T.GRASS && H(4) > 0.93) { g.fillStyle = 'rgba(120,120,110,0.7)'; g.beginPath(); g.ellipse(cx + (H(5) - 0.5) * 20, cy + (H(6) - 0.5) * 8, 2, 1.2, 0, 0, Math.PI * 2); g.fill(); }
      } else if (t === T.DIRT) {
        for (let k = 0; k < 6; k++) { const ox = (H(60 + k) - 0.5) * 54, oy = (H(70 + k) - 0.5) * 26; if (!inside(ox, oy)) continue; g.fillStyle = k % 2 ? 'rgba(80,55,28,0.45)' : 'rgba(210,180,130,0.45)'; g.beginPath(); g.ellipse(cx + ox, cy + oy, 1.4 + H(90 + k), 0.9, 0, 0, Math.PI * 2); g.fill(); }
        if (H(8) > 0.8) { g.strokeStyle = 'rgba(90,60,30,0.35)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(cx - 8, cy); g.lineTo(cx - 2, cy + 2); g.lineTo(cx + 5, cy + 1); g.stroke(); }
      } else if (t === T.SAND) {
        g.strokeStyle = 'rgba(180,150,90,0.35)'; g.lineWidth = 1;
        for (let k = 0; k < 3; k++) { const oy = (k - 1) * 5 + (H(9) - 0.5) * 3; g.beginPath(); g.moveTo(cx - 14 + k * 3, cy + oy); g.quadraticCurveTo(cx, cy + oy - 2.5, cx + 14 - k * 3, cy + oy); g.stroke(); }
        if (H(11) > 0.85) { g.fillStyle = '#fff3e0'; g.beginPath(); g.ellipse(cx + (H(12) - 0.5) * 18, cy + (H(13) - 0.5) * 6, 1.6, 1.1, 0, 0, Math.PI * 2); g.fill(); }
      } else if (t === T.ROCK) {
        const n = 2 + Math.floor(H(14) * 2);
        for (let k = 0; k < n; k++) {
          const ox = (H(100 + k) - 0.5) * 30, oy = (H(110 + k) - 0.5) * 12, r = 4 + H(120 + k) * 5;
          g.fillStyle = 'rgba(70,70,64,0.35)'; g.beginPath(); g.ellipse(cx + ox + 1, cy + oy + 1, r, r * 0.5, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = U.shade('#a8a69c', (H(130 + k) - 0.5) * 0.2); g.beginPath(); g.ellipse(cx + ox, cy + oy, r, r * 0.5, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.ellipse(cx + ox - r * 0.25, cy + oy - r * 0.15, r * 0.45, r * 0.18, 0, 0, Math.PI * 2); g.fill();
        }
      } else if (t === T.SNOW) {
        g.fillStyle = 'rgba(150,185,215,0.25)'; g.beginPath(); g.ellipse(cx + (H(15) - 0.5) * 16, cy + 3, 10, 3, 0, 0, Math.PI * 2); g.fill();
        for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(255,255,255,0.95)'; g.fillRect(cx + (H(140 + k) - 0.5) * 40, cy + (H(150 + k) - 0.5) * 18, 1.4, 1.4); }
      }
    }
    drawPath(g, m, x, y) {
      // calçamento em 4 placas por tile
      const base = U.shade('#d8cba8', (U.hash(x, y, 5) - 0.5) * 0.05);
      this.diamond(g, x, y, -0.02); g.fillStyle = '#b8a984'; g.fill();
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
        const sx = x + i / 2, sy = y + j / 2, ins = 0.035;
        const [ax, ay] = Iso.p(sx + ins, sy + ins), [bx, by] = Iso.p(sx + 0.5 - ins, sy + ins), [cx, cy] = Iso.p(sx + 0.5 - ins, sy + 0.5 - ins), [dx, dy] = Iso.p(sx + ins, sy + 0.5 - ins);
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.lineTo(cx, cy); g.lineTo(dx, dy); g.closePath();
        g.fillStyle = U.shade(base, (U.hash(x * 2 + i, y * 2 + j, 6) - 0.5) * 0.08); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(dx, dy); g.lineTo(ax, ay); g.lineTo(bx, by); g.stroke();
      }
      const corners = [Iso.p(x, y), Iso.p(x + 1, y), Iso.p(x + 1, y + 1), Iso.p(x, y + 1)];
      [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([dx, dy], k) => {
        const nx = x + dx, ny = y + dy;
        if (!(m.inb(nx, ny) && m.path[m.idx(nx, ny)])) {
          const a = corners[k], b = corners[(k + 1) % 4];
          // meio-fio com sombra
          g.strokeStyle = 'rgba(40,40,20,0.22)'; g.lineWidth = 3; g.beginPath(); g.moveTo(a[0] + 1, a[1] + 2); g.lineTo(b[0] + 1, b[1] + 2); g.stroke();
          g.strokeStyle = '#8f8160'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
          g.strokeStyle = '#eee4c8'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(a[0], a[1] - 1.2); g.lineTo(b[0], b[1] - 1.2); g.stroke();
        }
      });
    }

    /* ---------- quadro principal ---------- */
    draw(zoo, t) {
      const ctx = this.ctx, m = zoo.map;
      if (m.dirty || this.cacheMap !== m) {
        const t0 = performance.now();
        const rg = this.cacheMap === m && m.dirty !== 'all' ? m.dirty : null;
        // regiões muito grandes ou encostadas na floresta da borda: refaz tudo de uma vez
        const ok = rg && (rg.x1 - rg.x0) * (rg.y1 - rg.y0) < m.w * m.h * 0.35 && rg.x0 > 5 && rg.y0 > 5 && rg.x1 < m.w - 6 && rg.y1 < m.h - 6;
        this.buildCache(zoo, ok ? rg : null);
        m.dirty = null;
        this.buildMs = performance.now() - t0;
      }
      this.ls = U.clamp(1.25 / this.cam.zoom, 1, 2.4); // escala de textos: legíveis em qualquer zoom
      const dpr = this.dpr, z = this.cam.zoom;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#26421c'; ctx.fillRect(0, 0, this.w, this.h);
      const tx = this.w / 2 - this.cam.x * z, ty = this.h / 2 - this.cam.y * z;
      ctx.setTransform(dpr * z, 0, 0, dpr * z, tx * dpr, ty * dpr);
      ctx.imageSmoothingEnabled = z < 1;
      ctx.drawImage(this.cache, -this.offX, -this.offY);

      // limites visíveis (em tiles)
      const corners = [this.screenToTile(0, 0), this.screenToTile(this.w, 0), this.screenToTile(0, this.h), this.screenToTile(this.w, this.h)];
      const minX = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[0]))) - 2), maxX = Math.min(m.w - 1, Math.ceil(Math.max(...corners.map((c) => c[0]))) + 2);
      const minY = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[1]))) - 2), maxY = Math.min(m.h - 1, Math.ceil(Math.max(...corners.map((c) => c[1]))) + 4);
      const vis = (x, y) => x >= minX - 2 && x <= maxX + 2 && y >= minY - 2 && y <= maxY + 3;
      this.vb = { minX, maxX, minY, maxY };

      // camada do chão dinâmica: água animada, lixo, sujeira, área isolada, grade
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const i = m.idx(x, y);
        const tr = m.terrain[i];
        if (ZM.isWater(tr)) {
          const ph = U.hash(x, y, 7) * 6.28;
          const a = 0.18 + 0.18 * Math.sin(t * 1.6 + ph);
          const [cx, cy] = Iso.p(x + 0.5, y + 0.5);
          ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 1;
          const o = Math.sin(t * 0.8 + ph) * 4;
          ctx.beginPath(); ctx.moveTo(cx - 8 + o, cy - 2); ctx.lineTo(cx + 2 + o, cy - 2); ctx.moveTo(cx - 2 - o, cy + 4); ctx.lineTo(cx + 8 - o, cy + 4); ctx.stroke();
        }
        if (m.litter[i]) {
          const n = Math.min(6, m.litter[i]);
          for (let k = 0; k < n; k++) {
            const [cx, cy] = Iso.p(x + 0.2 + U.hash(x, y, 30 + k) * 0.6, y + 0.2 + U.hash(x, y, 40 + k) * 0.6);
            ctx.fillStyle = ['#f2f2f2', '#e85d4a', '#4a90d9', '#f2c94c'][k % 4]; ctx.fillRect(cx - 1.5, cy - 1, 3, 2);
          }
        }
        if (m.closed[i]) { this.diamond(ctx, x, y); ctx.fillStyle = `rgba(230,40,40,${0.18 + 0.08 * Math.sin(t * 6)})`; ctx.fill(); }
        if (this.showGrid) { this.diamond(ctx, x, y); ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1; ctx.stroke(); }
      }
      // sujeira nos recintos
      zoo.enclosures.forEach((e) => {
        const n = Math.floor((100 - e.cleanliness) / 9);
        for (let k = 0; k < n; k++) {
          const px = e.x0 + U.hash(e.id, k, 11) * e.w, py = e.y0 + U.hash(e.id, k, 12) * e.h;
          const [cx, cy] = Iso.p(px, py);
          ctx.fillStyle = '#5a4022'; ctx.beginPath(); ctx.ellipse(cx, cy, 2.2, 1.3, 0, 0, Math.PI * 2); ctx.fill();
        }
        if (this.selected && this.selected.kind === 'enclosure' && this.selected.id === e.id) {
          ctx.save();
          const [ax, ay] = Iso.p(e.x0, e.y0), [bx, by] = Iso.p(e.x1 + 1, e.y0), [cx, cy] = Iso.p(e.x1 + 1, e.y1 + 1), [dx, dy] = Iso.p(e.x0, e.y1 + 1);
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.lineTo(dx, dy); ctx.closePath();
          ctx.fillStyle = 'rgba(255,240,120,0.12)'; ctx.fill(); ctx.setLineDash([6, 4]); ctx.strokeStyle = 'rgba(255,240,120,0.9)'; ctx.lineWidth = 2; ctx.stroke();
          ctx.restore();
        }
      });

      // camada de informação escolhida pelo jogador
      if (this.layer) this.drawLayer(ctx, zoo, t);
      // pré-visualização de construção (no chão)
      this.drawPreviewGround(ctx, zoo, t);

      // ----- lista ordenada por profundidade -----
      const list = [];
      zoo.objects.forEach((o) => {
        if (!vis(o.x, o.y) && !vis(o.x + o.w, o.y + o.h)) return;
        list.push({ d: o.x + o.w - 0.5 + o.y + o.h - 0.5 + (o.def.kind === 'shelter' ? 0.45 : 0), k: 0, o });
      });
      zoo.enclosures.forEach((e) => {
        const f = ZM.FENCES[e.fence];
        e.edges().forEach(([x, y, side]) => {
          if (!vis(x, y)) return;
          let d;
          if (side === 0) d = x + 0.5 + y; else if (side === 1) d = x + 0.5 + y + 1; else if (side === 2) d = x + y + 0.5; else d = x + 1 + y + 0.5;
          list.push({ d: d + 0.01, k: 1, e, x, y, side, f });
        });
      });
      const addAgent = (a, k) => { if (vis(a.tx(), a.ty())) list.push({ d: a.x + a.y + (k === 2 && a.state === 'CLIMB' && !a.path ? 0.7 : 0), k, a }); };
      // animais (e o agente selecionado) que podem ficar escondidos atrás de árvores e prédios
      const hidden = new Map();
      zoo.animals.forEach((a) => { if (!a.inShelter && vis(a.tx(), a.ty())) hidden.set(m.idx(a.tx(), a.ty()), a.x + a.y); });
      if (this.selected && (this.selected.kind === 'visitor' || this.selected.kind === 'staff')) {
        const ag = this.selected.kind === 'staff' ? zoo.staff.find((x) => x.id === this.selected.id) : zoo.visitors.find((x) => x.id === this.selected.id);
        if (ag) hidden.set(m.idx(ag.tx(), ag.ty()), ag.x + ag.y);
      }
      this.hidden = hidden;
      zoo.animals.forEach((a) => addAgent(a, 2));
      zoo.visitors.forEach((v) => addAgent(v, 3));
      zoo.staff.forEach((s) => addAgent(s, 4));
      list.sort((p, q) => p.d - q.d);
      const night = this.darkness(zoo.hour) > 0.25;
      S.zoomPx = this.cam.zoom * this.dpr;
      S.hiQuality = zoo.animals.length < 160;
      for (const it of list) {
        if (it.k === 0) {
          const fade = this.occludes(zoo, it.o, it.d);
          if (fade) ctx.globalAlpha = 0.38;
          this.drawObject(ctx, it.o, t, night);
          if (fade) ctx.globalAlpha = 1;
        }
        else if (it.k === 1) this.drawFence(ctx, it, zoo, t);
        else if (it.k === 2) this.drawAnimal(ctx, it.a, t);
        else if (it.k === 3) this.drawVisitor(ctx, it.a, t);
        else this.drawStaff(ctx, it.a, t);
      }
      // ícones e textos flutuantes por cima
      this.drawOverlays(ctx, zoo, t);
      this.drawLayerLabels(ctx);
      this.drawPreviewTop(ctx, zoo, t);

      // sombras de nuvens passando
      if (!zoo.weather.rain) {
        const W2 = (m.w + m.h) * HW;
        for (let k = 0; k < 5; k++) {
          const sp = 14 + k * 3;
          const wx = ((t * sp + k * 977) % (W2 * 1.6)) - W2 * 0.8 - m.h * HW * 0.2;
          const wy = (m.w + m.h) * HH * (0.15 + k * 0.18);
          const r = 160 + k * 30;
          const gr = ctx.createRadialGradient(wx, wy, 0, wx, wy, r);
          gr.addColorStop(0, 'rgba(10,25,40,0.10)'); gr.addColorStop(1, 'rgba(10,25,40,0)');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(wx, wy, r, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
        }
      }

      // ----- iluminação dia/noite -----
      const dark = this.darkness(zoo.hour) * (this.layer ? 0.35 : 1); // camadas continuam legíveis à noite
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (dark > 0) {
        ctx.fillStyle = `rgba(12,20,58,${dark})`; ctx.fillRect(0, 0, this.w, this.h);
        const h = zoo.hour;
        if (h > 17 && h < 20) { ctx.fillStyle = `rgba(255,130,50,${0.1 * Math.sin(((h - 17) / 3) * Math.PI)})`; ctx.fillRect(0, 0, this.w, this.h); }
        // luzes
        ctx.setTransform(dpr * z, 0, 0, dpr * z, tx * dpr, ty * dpr);
        ctx.globalCompositeOperation = 'lighter';
        zoo.objects.forEach((o) => {
          const d = o.def;
          if (!(d.light || d.kind === 'shop' || d.kind === 'entrance' || d.kind === 'toilet' || d.kind === 'lab')) return;
          if (!vis(o.x, o.y)) return;
          const [cx, cy] = Iso.p(o.x + o.w / 2, o.y + o.h / 2);
          const r = d.light ? 70 : 45;
          const gr = ctx.createRadialGradient(cx, cy - (d.light ? 20 : 8), 2, cx, cy, r);
          gr.addColorStop(0, `rgba(255,214,140,${0.55 * dark})`); gr.addColorStop(1, 'rgba(255,214,140,0)');
          ctx.fillStyle = gr; ctx.fillRect(cx - r, cy - r - 20, r * 2, r * 2 + 20);
        });
        ctx.globalCompositeOperation = 'source-over';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      // chuva
      if (zoo.weather.rain) {
        ctx.fillStyle = 'rgba(40,60,90,0.18)'; ctx.fillRect(0, 0, this.w, this.h);
        ctx.strokeStyle = 'rgba(200,220,255,0.45)'; ctx.lineWidth = 1;
        ctx.beginPath();
        this.rain.forEach((r) => {
          r.y += 0.02 * r.s * (zoo.speed || 0.3); r.x -= 0.004 * r.s * (zoo.speed || 0.3);
          if (r.y > 1) { r.y = 0; r.x = Math.random() * 1.1; }
          if (r.x < 0) r.x += 1;
          const x = r.x * this.w, y = r.y * this.h;
          ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 12 * r.s);
        });
        ctx.stroke();
      }
      if (zoo.weather.heat) { ctx.fillStyle = 'rgba(255,170,60,0.08)'; ctx.fillRect(0, 0, this.w, this.h); }
      // gradação de cor: manhã rosada e fim de tarde dourado
      const hh = zoo.hour;
      if (hh >= 6 && hh < 8.5) { ctx.fillStyle = `rgba(255,170,150,${0.07 * (1 - Math.abs(hh - 7) / 1.5)})`; ctx.fillRect(0, 0, this.w, this.h); }
      if (hh >= 15.5 && hh < 18.5) { ctx.fillStyle = `rgba(255,190,90,${0.09 * Math.sin(((hh - 15.5) / 3) * Math.PI)})`; ctx.fillRect(0, 0, this.w, this.h); }
      // luz suave vinda de cima + vinheta
      if (!this.vig || this.vig.width !== this.canvas.width || this.vig.height !== this.canvas.height) {
        const v = this.vig = document.createElement('canvas'); v.width = this.canvas.width; v.height = this.canvas.height;
        const vg = v.getContext('2d'), W3 = v.width, H3 = v.height;
        const top = vg.createLinearGradient(0, 0, 0, H3); top.addColorStop(0, 'rgba(255,250,220,0.06)'); top.addColorStop(0.5, 'rgba(255,250,220,0)'); top.addColorStop(1, 'rgba(0,10,0,0.08)');
        vg.fillStyle = top; vg.fillRect(0, 0, W3, H3);
        const rg = vg.createRadialGradient(W3 / 2, H3 / 2, Math.min(W3, H3) * 0.35, W3 / 2, H3 / 2, Math.max(W3, H3) * 0.75);
        rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(5,15,5,0.38)');
        vg.fillStyle = rg; vg.fillRect(0, 0, W3, H3);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(this.vig, 0, 0);
    }

    darkness(h) {
      if (h >= 7 && h < 18) return 0;
      if (h >= 18 && h < 20.5) return ((h - 18) / 2.5) * 0.5;
      if (h >= 5.5 && h < 7) return (1 - (h - 5.5) / 1.5) * 0.5;
      return 0.5;
    }

    drawObject(ctx, o, t, night) {
      const d = o.def;
      const [cx, cy] = Iso.p(o.x + 0.5, o.y + 0.5);
      const sel = this.selected && this.selected.kind === 'object' && this.selected.id === o.id;
      if (sel) { this.diamond(ctx, o.x, o.y); ctx.save(); ctx.strokeStyle = '#ffe866'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); }
      const seed = U.hash(o.x, o.y, 9);
      if (d.cat === 'nature') {
        const jx = (seed - 0.5) * 8, jy = (U.hash(o.x, o.y, 8) - 0.5) * 4;
        if (d.kind === 'tree') S.tree(ctx, cx + jx, cy + jy, o.type, seed, t, 0.9 + seed * 0.25);
        else if (d.kind === 'rock') S.rock(ctx, cx + jx, cy + jy, seed);
        else S.bush(ctx, cx + jx, cy + jy, o.type, seed, t);
        return;
      }
      if (d.height && d.kind !== 'shelter') S.building(ctx, o, t, night);
      else S.small(ctx, o, t, night);
    }

    drawFence(ctx, it, zoo, t) {
      const { e, x, y, side, f } = it;
      let a, b;
      if (side === 0) { a = Iso.p(x, y); b = Iso.p(x + 1, y); }
      else if (side === 1) { a = Iso.p(x, y + 1); b = Iso.p(x + 1, y + 1); }
      else if (side === 2) { a = Iso.p(x, y); b = Iso.p(x, y + 1); }
      else { a = Iso.p(x + 1, y); b = Iso.p(x + 1, y + 1); }
      const m = zoo.map;
      // portão?
      const i = m.idx(x, y);
      let isGate = false;
      if (e.gate && e.gate.inIdx === i) {
        const [ox, oy] = m.xy(e.gate.outIdx);
        const s2 = oy < y ? 0 : oy > y ? 1 : ox < x ? 2 : 3;
        isGate = s2 === side;
      }
      const broken = e.condition < 30 && U.hash(x, y, side + 20) < (30 - e.condition) / 30;
      ctx.strokeStyle = 'rgba(15,30,10,0.22)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a[0] + 2, a[1] + 1.5); ctx.lineTo(b[0] + 2, b[1] + 1.5); ctx.stroke();
      const hgt = f.level === 3 ? 15 : 12;
      if (isGate) {
        ctx.fillStyle = f.post;
        ctx.fillRect(a[0] - 1.5, a[1] - hgt - 3, 3, hgt + 3); ctx.fillRect(b[0] - 1.5, b[1] - hgt - 3, 3, hgt + 3);
        ctx.strokeStyle = '#e0b030'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(a[0], a[1] - 3); ctx.lineTo(b[0], b[1] - 3); ctx.moveTo(a[0], a[1] - hgt + 1); ctx.lineTo(b[0], b[1] - hgt + 1);
        ctx.moveTo(a[0], a[1] - 3); ctx.lineTo(b[0], b[1] - hgt + 1); ctx.stroke();
        return;
      }
      if (f.level === 3) {
        ctx.fillStyle = f.post;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(b[0], b[1] - 5); ctx.lineTo(a[0], a[1] - 5); ctx.closePath(); ctx.fill();
        if (!broken) { ctx.fillStyle = 'rgba(190,228,242,0.45)'; ctx.beginPath(); ctx.moveTo(a[0], a[1] - 5); ctx.lineTo(b[0], b[1] - 5); ctx.lineTo(b[0], b[1] - hgt); ctx.lineTo(a[0], a[1] - hgt); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(a[0], a[1] - hgt); ctx.lineTo(b[0], b[1] - hgt); ctx.stroke(); }
        return;
      }
      ctx.fillStyle = f.post;
      ctx.fillRect(a[0] - 1.2, a[1] - hgt, 2.4, hgt);
      ctx.fillStyle = U.shade(f.post, 0.25); ctx.fillRect(a[0] - 1.2, a[1] - hgt, 1, hgt);
      ctx.fillStyle = U.shade(f.post, -0.25); ctx.beginPath(); ctx.ellipse(a[0], a[1] - hgt, 1.8, 0.9, 0, 0, Math.PI * 2); ctx.fill();
      if (broken) { ctx.strokeStyle = f.rail; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(a[0], a[1] - 4); ctx.lineTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); ctx.stroke(); return; }
      ctx.strokeStyle = f.rail; ctx.lineWidth = f.level === 2 ? 1 : 1.8;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1] - hgt + 1.5); ctx.lineTo(b[0], b[1] - hgt + 1.5);
      ctx.moveTo(a[0], a[1] - hgt * 0.45); ctx.lineTo(b[0], b[1] - hgt * 0.45);
      if (f.level === 2) { for (let k = 1; k < 5; k++) { const px = a[0] + (b[0] - a[0]) * k / 5, py = a[1] + (b[1] - a[1]) * k / 5; ctx.moveTo(px, py); ctx.lineTo(px, py - hgt + 1.5); } }
      ctx.stroke();
    }

    drawAnimal(ctx, a, t) {
      const [x, y] = Iso.p(a.x, a.y);
      const sel = this.selected && this.selected.kind === 'animal' && this.selected.id === a.id;
      if (sel) this.ring(ctx, x, y, 14 * a.sp.size, t);
      S.animal(ctx, x, y, a, t);
    }
    drawVisitor(ctx, v, t) {
      const [x, y] = Iso.p(v.x + v.ox, v.y + v.oy);
      const sel = this.selected && this.selected.kind === 'visitor' && this.selected.id === v.id;
      if (sel) this.ring(ctx, x, y, 7, t);
      if (this.cam.zoom < 0.9) S.personLOD(ctx, x, y, v); else S.person(ctx, x, y, v, v.phase, !!v.path, v.facing);
      if (v.photo > 0 && v.photo > 0.9) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(x + 4, y - 14, 3, 0, Math.PI * 2); ctx.fill(); }
    }
    drawStaff(ctx, s, t) {
      const [x, y] = Iso.p(s.x + s.ox * 0.5, s.y + s.oy * 0.5);
      const sel = this.selected && this.selected.kind === 'staff' && this.selected.id === s.id;
      if (sel) this.ring(ctx, x, y, 8, t);
      const r = ZM.STAFF_ROLES[s.role];
      if (!s._look) s._look = { shirt: r.shirt, pants: '#3b4a3a', skin: U.pick(['#f1c9a5', '#e0ac7e', '#c68b5e', '#a46a43', '#7a4b2c']), hair: U.pick(['#2b1a10', '#5a3a1c', '#1a1a1a', '#8b5a2b']) };
      S.person(ctx, x, y, s._look, s.phase, !!s.path, s.facing, s.role);
      if (s.state === 'WORK' && !s.path) {
        const k = Math.sin(t * 10 + s.id);
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(x + 5, y - 10 + k, 2, 2);
      }
    }
    ring(ctx, x, y, r, t) {
      ctx.save();
      ctx.strokeStyle = '#ffe866'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y, r + Math.sin(t * 5), (r + Math.sin(t * 5)) * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    drawOverlays(ctx, zoo, t) {
      const vb = this.vb;
      const inV = (a) => a.tx() >= vb.minX && a.tx() <= vb.maxX && a.ty() >= vb.minY && a.ty() <= vb.maxY;
      if (this.cam.zoom > 0.7) {
        zoo.animals.forEach((a) => {
          if (!inV(a) || a.inShelter) return;
          const [x, y] = Iso.p(a.x, a.y);
          const top = y - (a.sp.look.leg || 6) * a.sp.size - (a.sp.look.neck || 0) * a.sp.size - 22 * a.sp.size;
          if (a.state === 'SLEEP' || a.state === 'TRANQ') {
            ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = `bold ${Math.round(10 * this.ls)}px sans-serif`; ctx.textAlign = 'center';
            const k = (t * 0.7 + a.id * 0.3) % 1;
            ctx.globalAlpha = 1 - k; ctx.fillText('z', x + 6 + k * 6, y - 14 - k * 10); ctx.globalAlpha = 1;
          }
          let icon = null;
          if (a.escaped && a.state === 'ESCAPED') icon = '🚨';
          else if (a.sick) icon = '🤒';
          else if (a.thirst > 72) icon = '💧';
          else if (a.hunger > 72) icon = '🍖';
          else if (a.stress > 72) icon = '😰';
          else if (a.pregnant > 0) icon = '💕';
          else if (a.state === 'PLAY') icon = '✨';
          else if (a.state === 'GROOM') icon = '💞';
          else if (a.state === 'HOWL') icon = '🌙';
          else if (a.state === 'SENTINEL') icon = '👀';
          if (icon) S.bubble(ctx, x, top + Math.sin(t * 3 + a.id) * 1.5, icon, 10);
          if (!a.path) this.stateFx(ctx, a, x, y, t);
          const selA = this.selected && this.selected.kind === 'animal' && this.selected.id === a.id;
          if (this.cam.zoom >= 1.5 || selA) S.sexMark(ctx, x + 10 * Math.min(1.4, a.sp.size), y - 6 * a.sp.size - 4, a.sex);
        });
        zoo.visitors.forEach((v) => {
          if (!v.bubble || !inV(v)) return;
          const [x, y] = Iso.p(v.x + v.ox, v.y + v.oy);
          ctx.globalAlpha = Math.min(1, v.bubble.t);
          S.bubble(ctx, x, y - 27, v.bubble.icon, 9);
          ctx.globalAlpha = 1;
        });
      }
      // placas com o nome dos habitats prontos
      if (this.cam.zoom > 0.6) zoo.enclosures.forEach((e) => {
        if (!e.prefab) return;
        const pf = ZM.PREFABS[e.prefab];
        const [px, py] = Iso.p(e.x1 + 1.15, e.y1 + 1.15);
        const label = pf.icon + ' ' + e.name;
        const ls = Math.min(this.ls, 1.6), fh = 13 * ls;
        ctx.font = `bold ${Math.round(9.5 * ls)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const w = ctx.measureText(label).width + 12;
        ctx.fillStyle = '#5a4630'; ctx.fillRect(px - 1, py - 12, 2, 12);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(px - w / 2 + 1.5, py - 12 - fh + 1.5, w, fh);
        ctx.fillStyle = '#f4ead2'; ctx.fillRect(px - w / 2, py - 12 - fh, w, fh);
        ctx.strokeStyle = pf.rim; ctx.lineWidth = 1.5; ctx.strokeRect(px - w / 2, py - 12 - fh, w, fh);
        ctx.fillStyle = '#2b2a22'; ctx.fillText(label, px, py - 12 - fh / 2 + 0.5);
      });
      zoo.floaters.forEach((f) => {
        const [x, y] = Iso.p(f.x, f.y);
        ctx.globalAlpha = Math.max(0, 1 - f.t / 1.6);
        ctx.font = `bold ${Math.round(11 * this.ls)}px sans-serif`; ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillText(f.text, x + 1, y - 30 - f.t * 18 + 1);
        ctx.fillStyle = f.color; ctx.fillText(f.text, x, y - 30 - f.t * 18);
        ctx.globalAlpha = 1;
      });
    }

    /* árvore ou prédio na frente de um animal fica translúcido */
    occludes(zoo, o, d) {
      const h = this.hidden; if (!h || !h.size) return false;
      const def = o.def;
      const reach = def.kind === 'tree' ? 3.6 : def.height && def.kind !== 'shelter' ? (def.height + 16) / HH : 0;
      if (!reach) return false;
      const m = zoo.map, r = Math.ceil(reach);
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2, cd = cx - cy, cs = cx + cy;
      const span = def.kind === 'tree' ? 1.1 : (o.w + o.h) / 2 + 0.2;
      for (let y = o.y - r; y < o.y + o.h; y++) for (let x = o.x - r; x < o.x + o.w; x++) {
        if (!m.inb(x, y)) continue;
        const ad = h.get(m.idx(x, y));
        if (ad == null || ad >= d) continue;
        const px = x + 0.5, py = y + 0.5;
        if (Math.abs(px - py - cd) > span) continue;
        const up = cs - (px + py);
        if (up >= -0.5 && up <= reach + (o.w + o.h) / 2 - 1) return true;
      }
      return false;
    }

    /* efeitos visuais das atividades (poeira, respingos, ondas) */
    stateFx(ctx, a, x, y, t) {
      const s = a.sp.size;
      if (a.state === 'DIG') {
        for (let k = 0; k < 4; k++) {
          const ph = (t * 1.8 + k * 0.25 + a.id * 0.13) % 1;
          ctx.fillStyle = `rgba(150,110,60,${0.7 * (1 - ph)})`;
          ctx.beginPath(); ctx.arc(x + a.facing * (8 + k * 2) * s, y - ph * 10 * s, 1.6 + ph * 1.5, 0, Math.PI * 2); ctx.fill();
        }
      } else if (a.state === 'SPLASH') {
        ctx.strokeStyle = 'rgba(170,220,255,0.85)'; ctx.lineWidth = 1.2;
        for (let k = 0; k < 5; k++) {
          const ph = (t * 1.5 + k * 0.2) % 1, dx = (k - 2) * 4;
          ctx.beginPath(); ctx.arc(x + dx + a.facing * 6 * s, y - 22 * s - ph * 12 + ph * ph * 20, 1.3, 0, Math.PI * 2); ctx.stroke();
        }
      } else if (a.state === 'WALLOW' || (a.state === 'SWIM' && !a.sp.waterOnly)) {
        const ph = (t * 0.6 + a.id * 0.21) % 1;
        ctx.strokeStyle = `rgba(255,255,255,${0.45 * (1 - ph)})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(x, y + 1, (8 + ph * 12) * s, (4 + ph * 6) * s, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }

    /* rótulos das camadas, desenhados por cima dos animais */
    drawLayerLabels(ctx) {
      const labels = this.layerLabels; if (!this.layer || !labels) return;
      const ls = this.ls;
      ctx.font = `bold ${Math.round(13 * ls)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      labels.forEach(([e, text]) => {
        const [x, y] = Iso.p(...e.center());
        const w = ctx.measureText(text).width + 12 * ls, hgt = 18 * ls;
        ctx.fillStyle = 'rgba(15,22,12,0.85)'; ctx.fillRect(x - w / 2, y - hgt / 2, w, hgt);
        ctx.fillStyle = '#fff'; ctx.fillText(text, x, y + 0.5);
      });
      ctx.textBaseline = 'alphabetic';
    }

    /* ---------- camadas de informação ---------- */
    drawLayer(ctx, zoo, t) {
      const m = zoo.map, vb = this.vb, L = this.layer;
      const tile = (x, y, col) => { this.diamond(ctx, x, y, 0.04); ctx.fillStyle = col; ctx.fill(); };
      const outline = (x, y, col) => { this.diamond(ctx, x, y, 0.08); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); };
      const encPoly = (e, fill, stroke) => {
        const [ax, ay] = Iso.p(e.x0, e.y0), [bx, by] = Iso.p(e.x1 + 1, e.y0), [cx, cy] = Iso.p(e.x1 + 1, e.y1 + 1), [dx, dy] = Iso.p(e.x0, e.y1 + 1);
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.lineTo(dx, dy); ctx.closePath();
        ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
      };
      const grade = (v) => (v >= 70 ? '90,220,110' : v >= 45 ? '255,200,70' : '240,80,60');
      const labels = this.layerLabels = [];
      const label = (e, text) => labels.push([e, text]);
      ctx.save();
      if (L === 'access') {
        for (let y = vb.minY; y <= vb.maxY; y++) for (let x = vb.minX; x <= vb.maxX; x++) {
          const i = m.idx(x, y);
          if (m.path[i]) tile(x, y, zoo.connected && zoo.connected[i] ? 'rgba(90,220,110,0.55)' : 'rgba(240,70,60,0.75)');
          else if (!m.enc[i] && zoo.staffReach && zoo.staffReach[i]) tile(x, y, 'rgba(90,160,255,0.13)');
        }
        zoo.objects.forEach((o) => {
          if (!o.def.needsPath) return;
          const ok = zoo.isConnected(o);
          for (let dy = 0; dy < o.h; dy++) for (let dx = 0; dx < o.w; dx++) outline(o.x + dx, o.y + dy, ok ? 'rgba(90,220,110,0.95)' : 'rgba(255,80,60,1)');
        });
        zoo.enclosures.forEach((e) => {
          if (!e.gate) { encPoly(e, 'rgba(240,70,60,0.12)', 'rgba(240,70,60,0.9)'); label(e, '🚫 sem portão'); return; }
          const [gx, gy] = m.xy(e.gate.outIdx);
          tile(gx, gy, e.gateReachable === false ? 'rgba(255,60,60,0.85)' : 'rgba(255,232,102,0.85)');
          if (e.animalCount && !e.stats.views.length) label(e, '👀 sem visitantes');
          else if (e.gateReachable === false) label(e, '🚧 equipe sem acesso');
        });
      } else if (L === 'clean') {
        zoo.enclosures.forEach((e) => { encPoly(e, `rgba(${grade(e.cleanliness)},0.28)`); label(e, `🧹 ${Math.round(e.cleanliness)}%`); });
        for (let y = vb.minY; y <= vb.maxY; y++) for (let x = vb.minX; x <= vb.maxX; x++) {
          const i = m.idx(x, y);
          if (!m.path[i]) continue;
          tile(x, y, m.litter[i] ? `rgba(240,80,60,${Math.min(0.8, 0.25 + m.litter[i] * 0.12)})` : 'rgba(90,220,110,0.18)');
        }
        zoo.objectsOfKind('bin').forEach((b) => {
          const [x, y] = Iso.p(b.x + 0.5, b.y + 0.5), full = b.fill / b.def.capacity;
          ctx.beginPath(); ctx.ellipse(x, y, 4 * HW, 4 * HH, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${full > 0.8 ? '240,80,60' : '90,160,255'},0.08)`; ctx.fill();
          ctx.strokeStyle = `rgba(${full > 0.8 ? '240,80,60' : '90,160,255'},0.6)`; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
        });
      } else if (L === 'welfare') {
        zoo.enclosures.forEach((e) => {
          if (!e.animalCount) { encPoly(e, 'rgba(200,200,200,0.12)'); return; }
          const v = e.avgWelfare || 0;
          encPoly(e, `rgba(${grade(v)},0.32)`, `rgba(${grade(v)},0.9)`);
          const tk = Math.floor(zoo.absMinutes / 3), c = (this._diag || (this._diag = {}))[e.id];
          let n = c && c.t === tk ? c.n : null;
          if (n == null) { const d = ZM.Diagnostics.enclosure(zoo, e); n = d.general.concat(...d.groups.map((g) => g.items)).filter((it) => it.sev === 'bad' || it.sev === 'warn').length; this._diag[e.id] = { t: tk, n }; }
          label(e, `🐾 ${Math.round(v)}%${n ? ` · ⚠️ ${n}` : ''}`);
        });
      } else if (L === 'staff') {
        zoo.enclosures.forEach((e) => {
          if (!e.animalCount) return;
          const keepers = ZM.Diagnostics.keepersFor(zoo, e).length;
          encPoly(e, keepers ? 'rgba(90,220,110,0.22)' : 'rgba(240,70,60,0.3)', keepers ? null : 'rgba(240,70,60,0.9)');
          label(e, keepers ? `👷 ${keepers} tratador${keepers > 1 ? 'es' : ''}` : '👷 sem tratador');
        });
        zoo.objects.forEach((o) => {
          if (o.condition == null) return;
          if (o.broken) outline(o.x, o.y, 'rgba(255,60,60,1)');
          else if (o.condition < 55) outline(o.x, o.y, 'rgba(255,170,60,0.95)');
        });
        zoo.unreachable.forEach((until, key) => {
          if (until < zoo.absMinutes) return;
          const [kind, id] = key.split(':');
          const o = zoo.objects.get(+id), e = zoo.enclosures.get(+id);
          const tx = o ? o.x : e ? e.center()[0] - 0.5 : null, ty = o ? o.y : e ? e.center()[1] - 0.5 : null;
          if (tx == null || kind === 'vet') return;
          const [x, y] = Iso.p(tx + 0.5, ty + 0.5);
          ctx.strokeStyle = '#ff4b3a'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6); ctx.stroke();
        });
        zoo.staff.forEach((s) => {
          const [x, y] = Iso.p(s.x, s.y), busy = s.busyPct || 0;
          ctx.beginPath(); ctx.ellipse(x, y, 11, 5.5, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${busy > 85 ? '240,80,60' : busy > 55 ? '255,200,70' : '90,220,110'},0.95)`; ctx.lineWidth = 2.5; ctx.stroke();
        });
      }
      ctx.restore();
    }

    drawPreviewGround(ctx, zoo, t) {
      const p = this.preview;
      if (this.hover && !p) {
        const [hx, hy] = this.hover;
        if (zoo.map.inb(hx, hy)) { this.diamond(ctx, hx, hy); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.stroke(); }
      }
      if (!p) return;
      const col = p.ok ? 'rgba(90,230,110,' : 'rgba(240,70,60,';
      if (p.rect) {
        const { x0, y0, x1, y1 } = p.rect;
        const [ax, ay] = Iso.p(x0, y0), [bx, by] = Iso.p(x1 + 1, y0), [cx, cy] = Iso.p(x1 + 1, y1 + 1), [dx, dy] = Iso.p(x0, y1 + 1);
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.lineTo(dx, dy); ctx.closePath();
        ctx.fillStyle = col + '0.22)'; ctx.fill(); ctx.strokeStyle = col + '0.95)'; ctx.lineWidth = 2; ctx.stroke();
      }
      (p.colored || []).forEach(([x, y, c]) => { this.diamond(ctx, x, y, 0.03); ctx.globalAlpha = 0.7; ctx.fillStyle = c; ctx.fill(); ctx.globalAlpha = 1; });
      (p.tiles || []).forEach(([x, y, ok]) => {
        this.diamond(ctx, x, y, 0.04);
        const c = ok === false ? 'rgba(240,70,60,' : col;
        ctx.fillStyle = c + '0.35)'; ctx.fill(); ctx.strokeStyle = c + '0.9)'; ctx.lineWidth = 1; ctx.stroke();
      });
    }
    drawPreviewTop(ctx, zoo, t) {
      const p = this.preview;
      if (!p) return;
      if (p.ghost) {
        ctx.globalAlpha = 0.65;
        this.drawObject(ctx, p.ghost, t, false);
        ctx.globalAlpha = 1;
      }
      if (p.label) {
        const [x, y] = Iso.p(p.lx + 0.5, p.ly + 0.5);
        const ls = this.ls, fh = 17 * ls;
        ctx.font = `bold ${Math.round(12 * ls)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const w = ctx.measureText(p.label).width + 12 * ls;
        ctx.fillStyle = p.ok ? 'rgba(20,60,25,0.9)' : 'rgba(110,20,20,0.9)';
        ctx.fillRect(x - w / 2, y - 30 - fh, w, fh);
        ctx.fillStyle = '#fff'; ctx.fillText(p.label, x, y - 30 - fh / 2 + 0.5);
        ctx.textBaseline = 'alphabetic';
      }
      // marcador de "localizar problema"
      if (this.flash) {
        const f = this.flash, age = t - (f.t0 == null ? (f.t0 = t) : f.t0);
        if (age > 3.5) this.flash = null;
        else {
          const [x, y] = Iso.p(f.x + 0.5, f.y + 0.5);
          const k = (age * 1.4) % 1;
          ctx.save();
          ctx.strokeStyle = `rgba(255,232,102,${1 - k})`; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.ellipse(x, y, 10 + k * 34, (10 + k * 34) * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = '#ffe866'; ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(x - 7, y - 28 - Math.sin(t * 6) * 3); ctx.lineTo(x + 7, y - 28 - Math.sin(t * 6) * 3); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      }
    }
  }
  ZM.Renderer = Renderer;
})(window.ZM);
