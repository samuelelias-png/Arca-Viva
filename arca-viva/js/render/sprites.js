/* =========================================================
   Sprites procedurais (Canvas 2D) — direção de arte única:
   formas arredondadas, contorno suave, sombras elípticas
   ========================================================= */
(function (ZM) {
  'use strict';
  const U = ZM.util, HW = ZM.CONFIG.HW, HH = ZM.CONFIG.HH;
  const shade = U.shade;

  const Iso = {
    x: (x, y) => (x - y) * HW,
    y: (x, y) => (x + y) * HH,
    p: (x, y) => [(x - y) * HW, (x + y) * HH],
  };
  ZM.Iso = Iso;

  const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
  const S = {};

  function ell(ctx, x, y, rx, ry, fill) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
  function shadow(ctx, x, y, rx, ry, a = 0.22) { ell(ctx, x, y, rx, ry, `rgba(20,30,10,${a})`); }
  S.shadow = shadow;
  S.hiQuality = true; S.zoomPx = 1;
  S.emoji = function (ctx, txt, x, y, size) {
    ctx.font = `${size}px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(txt, x, y);
  };
  S.bubble = function (ctx, x, y, icon, size = 11) {
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath(); ctx.arc(x, y, size * 0.85, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 2, y + size * 0.7); ctx.lineTo(x, y + size * 1.15); ctx.lineTo(x + 2, y + size * 0.7); ctx.fill();
    ctx.fillStyle = '#000';
    S.emoji(ctx, icon, x, y + 0.5, size);
  };

  /* ------------ caixa isométrica (prédios) ------------ */
  function isoBox(ctx, x, y, w, h, z, cTop, cLeft, cRight, base = 0) {
    const [ax, ay] = Iso.p(x, y), [bx, by] = Iso.p(x + w, y), [cx, cy] = Iso.p(x + w, y + h), [dx, dy] = Iso.p(x, y + h);
    // face esquerda (d -> c)
    ctx.beginPath(); ctx.moveTo(dx, dy - base); ctx.lineTo(cx, cy - base); ctx.lineTo(cx, cy - z); ctx.lineTo(dx, dy - z); ctx.closePath(); ctx.fillStyle = cLeft; ctx.fill();
    // face direita (c -> b)
    ctx.beginPath(); ctx.moveTo(cx, cy - base); ctx.lineTo(bx, by - base); ctx.lineTo(bx, by - z); ctx.lineTo(cx, cy - z); ctx.closePath(); ctx.fillStyle = cRight; ctx.fill();
    // topo
    ctx.beginPath(); ctx.moveTo(ax, ay - z); ctx.lineTo(bx, by - z); ctx.lineTo(cx, cy - z); ctx.lineTo(dx, dy - z); ctx.closePath(); ctx.fillStyle = cTop; ctx.fill();
    if (z - base > 3) {
      // arestas: contorno escuro suave, aresta frontal e borda superior iluminadas
      ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(30,20,10,0.28)';
      ctx.beginPath(); ctx.moveTo(dx, dy - base); ctx.lineTo(cx, cy - base); ctx.lineTo(bx, by - base); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.moveTo(cx, cy - base); ctx.lineTo(cx, cy - z); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(dx, dy - z); ctx.lineTo(cx, cy - z); ctx.lineTo(bx, by - z); ctx.stroke();
      // oclusão na base
      const gr = ctx.createLinearGradient(0, cy - base, 0, cy - base - Math.min(8, z - base));
      gr.addColorStop(0, 'rgba(0,0,0,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(dx, dy - base); ctx.lineTo(cx, cy - base); ctx.lineTo(bx, by - base); ctx.lineTo(bx, by - base - 8); ctx.lineTo(cx, cy - base - 8); ctx.lineTo(dx, dy - base - 8); ctx.closePath(); ctx.fill();
    }
    return { ax, ay, bx, by, cx, cy, dx, dy };
  }
  S.isoBox = isoBox;
  function quad(ctx, pts, fill, stroke) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  function roofPyramid(ctx, x, y, w, h, z, peak, col) {
    const m = 0.12;
    const A = Iso.p(x - m, y - m), B = Iso.p(x + w + m, y - m), Cc = Iso.p(x + w + m, y + h + m), D = Iso.p(x - m, y + h + m);
    const [px, py] = Iso.p(x + w / 2, y + h / 2);
    const top = [px, py - z - peak];
    const zz = (p) => [p[0], p[1] - z];
    quad(ctx, [zz(A), zz(B), top], shade(col, 0.15));
    quad(ctx, [zz(D), zz(A), top], shade(col, 0.05));
    quad(ctx, [zz(B), zz(Cc), top], shade(col, -0.25));
    quad(ctx, [zz(Cc), zz(D), top], shade(col, -0.08));
    // fileiras de telhas e cumeeiras
    ctx.lineWidth = 0.7;
    [[zz(D), zz(Cc), 'rgba(0,0,0,0.16)'], [zz(Cc), zz(B), 'rgba(0,0,0,0.22)'], [zz(A), zz(D), 'rgba(255,255,255,0.14)']].forEach(([p1, p2, col2]) => {
      ctx.strokeStyle = col2;
      for (let k = 1; k <= 3; k++) {
        const f = k / 4;
        ctx.beginPath(); ctx.moveTo(p1[0] + (top[0] - p1[0]) * f, p1[1] + (top[1] - p1[1]) * f); ctx.lineTo(p2[0] + (top[0] - p2[0]) * f, p2[1] + (top[1] - p2[1]) * f); ctx.stroke();
      }
    });
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(zz(Cc)[0], zz(Cc)[1]); ctx.lineTo(top[0], top[1]); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.moveTo(zz(D)[0], zz(D)[1]); ctx.lineTo(zz(Cc)[0], zz(Cc)[1]); ctx.lineTo(zz(B)[0], zz(B)[1]); ctx.stroke();
  }

  /* ------------ prédios ------------ */
  S.building = function (ctx, o, t, night) {
    const d = o.def, x = o.x, y = o.y, w = o.w, h = o.h;
    const z = d.height || 18;
    const wall = d.wall || '#eee';
    const inset = 0.08;
    const bx = x + inset, by = y + inset, bw = w - inset * 2, bh = h - inset * 2;
    const [cx, cy] = Iso.p(x + w / 2, y + h / 2);
    shadow(ctx, cx + 6, cy + 4, (w + h) * 15, (w + h) * 7, 0.18);
    if (d.kind === 'entrance') return S.entrance(ctx, o, t, night);
    if (d.kind === 'aquaview') {
      // galeria envidraçada: base de pedra, painéis de vidro e teto plano
      const b = isoBox(ctx, bx, by, bw, bh, 5, '#9aa4a8', '#8a9498', '#6c767a');
      isoBox(ctx, bx, by, bw, bh, z, 'rgba(160,220,240,0.35)', 'rgba(120,200,230,0.55)', 'rgba(90,170,210,0.55)', 5);
      isoBox(ctx, bx - 0.04, by - 0.04, bw + 0.08, bh + 0.08, z + 3, d.roof, U.shade(d.roof, -0.15), U.shade(d.roof, -0.3), z);
      const fish = (t * 0.5 + o.id) % 1;
      const [fx, fy] = Iso.p(bx + bw * fish, by + bh);
      ell(ctx, fx, fy - 9, 2.4, 1.2, '#ffb347');
      void b;
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(cx, cy - z - 12, 8.5, 0, Math.PI * 2); ctx.fill();
      S.emoji(ctx, d.icon, cx, cy - z - 11.5, 11);
      return;
    }
    const box = isoBox(ctx, bx, by, bw, bh, z, shade(wall, 0.1), wall, shade(wall, -0.22));
    // porta e janelas na face esquerda
    const L = (u, v) => [box.dx + (box.cx - box.dx) * u, box.dy + (box.cy - box.dy) * u - v];
    const R = (u, v) => [box.cx + (box.bx - box.cx) * u, box.cy + (box.by - box.cy) * u - v];
    const win = night ? '#ffe9a0' : '#8fc7e8';
    quad(ctx, [L(0.38, 0), L(0.62, 0), L(0.62, z * 0.6), L(0.38, z * 0.6)], shade(wall, -0.55));
    quad(ctx, [R(0.25, z * 0.35), R(0.5, z * 0.35), R(0.5, z * 0.75), R(0.25, z * 0.75)], win);
    if (w > 1) quad(ctx, [R(0.62, z * 0.35), R(0.85, z * 0.35), R(0.85, z * 0.75), R(0.62, z * 0.75)], win);
    if (d.awning) {
      // toldo listrado
      const n = 6;
      for (let i = 0; i < n; i++) {
        const u0 = i / n, u1 = (i + 1) / n;
        const col = i % 2 ? '#ffffff' : d.roof;
        quad(ctx, [L(u0, z), L(u1, z), [L(u1, z)[0] - 3, L(u1, z)[1] + 7], [L(u0, z)[0] - 3, L(u0, z)[1] + 7]], col);
        quad(ctx, [R(u0, z), R(u1, z), [R(u1, z)[0] + 3, R(u1, z)[1] + 7], [R(u0, z)[0] + 3, R(u0, z)[1] + 7]], shade(col, -0.15));
      }
      isoBox(ctx, bx, by, bw, bh, z + 3, shade(d.roof, 0.1), shade(d.roof, -0.1), shade(d.roof, -0.3), z);
    } else {
      roofPyramid(ctx, bx, by, bw, bh, z, 10 + w * 4, d.roof || '#a44');
    }
    if (o.broken) S.emoji(ctx, '🔧', cx, cy - z - 18, 14);
    // placa com ícone
    const iy = cy - z - (d.awning ? 14 : 22 + w * 3);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.arc(cx, iy, 8.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = d.roof || '#888'; ctx.lineWidth = 1.5; ctx.stroke();
    S.emoji(ctx, d.icon, cx, iy + 0.5, 11);
  };

  S.entrance = function (ctx, o, t, night) {
    const x = o.x, y = o.y;
    const d = o.def;
    // bilheteria (pequena casa) atrás e arco na frente
    isoBox(ctx, x + 0.1, y + 0.1, 0.8, 0.8, 18, '#f3e6c8', '#e2cfa6', '#c4ad82');
    roofPyramid(ctx, x + 0.1, y + 0.1, 0.8, 0.8, 18, 10, d.roof);
    // colunas
    const col = (px, py) => { isoBox(ctx, px - 0.12, py - 0.12, 0.24, 0.24, 34, '#d8c9a8', '#cdb88f', '#a8936a'); };
    col(x + 1.25, y + 0.3); col(x + 1.25, y + 1.75); col(x + 0.3, y + 1.75);
    // faixa do arco (lado frontal)
    const [ax, ay] = Iso.p(x + 1.25, y + 1.75), [bx, by] = Iso.p(x + 0.3, y + 1.75), [cx2, cy2] = Iso.p(x + 1.25, y + 0.3);
    quad(ctx, [[ax, ay - 34], [bx, by - 34], [bx, by - 44], [ax, ay - 44]], '#2f7d3b');
    quad(ctx, [[cx2, cy2 - 34], [ax, ay - 34], [ax, ay - 44], [cx2, cy2 - 44]], '#276a31');
    ctx.save();
    ctx.fillStyle = '#fff6d6'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const mx = (ax + bx) / 2, my = (ay + by) / 2 - 39;
    ctx.translate(mx, my); ctx.transform(1, -0.5, 0, 1, 0, 0);
    ctx.fillText('ARCA VIVA', 0, 0);
    ctx.restore();
    // bandeirinhas
    const flag = (px, py, c) => { ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px, py - 34); ctx.lineTo(px, py - 52); ctx.stroke(); const wv = Math.sin(t * 4 + px) * 1.5; quad(ctx, [[px, py - 52], [px + 9, py - 49 + wv], [px, py - 46]], c); };
    flag(ax, ay, '#e85d4a'); flag(bx, by, '#f2c94c'); flag(cx2, cy2, '#4a90d9');
  };

  /* ------------ natureza ------------ */
  S.tree = function (ctx, x, y, type, seed, t, s = 1) {
    const sway = Math.sin(t * 1.3 + seed * 10) * 0.8;
    shadow(ctx, x + 4, y + 1, 13 * s, 6 * s, 0.25);
    if (type === 'palm') {
      ctx.strokeStyle = '#8a6a43'; ctx.lineWidth = 3 * s; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 4 * s, y - 16 * s, x + 2 * s + sway, y - 30 * s); ctx.stroke();
      const tx = x + 2 * s + sway, ty = y - 30 * s;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + seed;
        ctx.strokeStyle = i % 2 ? '#3f8f3a' : '#56a845'; ctx.lineWidth = 3.2 * s;
        ctx.beginPath(); ctx.moveTo(tx, ty);
        ctx.quadraticCurveTo(tx + Math.cos(a) * 9 * s, ty - 6 * s, tx + Math.cos(a) * 15 * s, ty + Math.sin(a) * 4 * s + 4 * s); ctx.stroke();
      }
      ell(ctx, tx, ty + 1, 2.5 * s, 2 * s, '#6b4f2a');
      return;
    }
    if (type === 'acacia') {
      ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 2.6 * s; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 1, y - 14 * s); ctx.lineTo(x - 6 * s, y - 22 * s); ctx.moveTo(x + 1, y - 14 * s); ctx.lineTo(x + 7 * s, y - 23 * s); ctx.stroke();
      ell(ctx, x + sway, y - 24 * s, 18 * s, 6 * s, '#3f6f22');
      ell(ctx, x + sway, y - 25.5 * s, 17 * s, 5.5 * s, '#5e8f2f');
      ell(ctx, x + sway - 2, y - 27.5 * s, 13 * s, 4 * s, '#78aa3d');
      ell(ctx, x + sway - 5, y - 29 * s, 6 * s, 2 * s, '#93c255');
      return;
    }
    // árvore frondosa / ipê
    const ipe = type === 'ipe';
    ctx.fillStyle = '#6b4a2b'; ctx.fillRect(x - 1.8 * s, y - 14 * s, 3.6 * s, 14 * s);
    const c1 = ipe ? '#e9b81f' : '#3f7f34', c2 = ipe ? '#f7d34a' : '#539a43', c3 = ipe ? '#ffe680' : '#6db552';
    const r = (type === 'bigtree' ? 12 : 11) * s;
    ctx.fillStyle = '#4e3420'; ctx.fillRect(x - 1.8 * s, y - 14 * s, 1.4 * s, 14 * s);
    ell(ctx, x + sway + 1, y - 18 * s, r * 1.02, r * 0.8, shade(c1, -0.3));
    ell(ctx, x + sway, y - 20 * s, r, r * 0.85, c1);
    ell(ctx, x - 5 * s + sway, y - 24 * s, r * 0.7, r * 0.6, c2);
    ell(ctx, x + 5 * s + sway, y - 26 * s, r * 0.6, r * 0.55, c2);
    ell(ctx, x - 2 * s + sway, y - 29 * s, r * 0.45, r * 0.4, c3);
    ell(ctx, x - 4 * s + sway, y - 30.5 * s, r * 0.2, r * 0.15, shade(c3, 0.35));
    for (let k = 0; k < 6; k++) ell(ctx, x + sway + (U.hash(k, seed * 50, 3) - 0.5) * r * 1.6, y - 16 * s - U.hash(k, seed * 50, 4) * r * 1.2, 1.2 * s, 1 * s, k % 2 ? shade(c2, 0.2) : shade(c1, -0.15));
  };
  S.bush = function (ctx, x, y, type, seed, t) {
    if (type === 'tallgrass') {
      ctx.strokeStyle = '#a7a845'; ctx.lineWidth = 1.2;
      for (let i = 0; i < 9; i++) {
        const ox = (U.hash(i, seed * 100, 1) - 0.5) * 18, oy = (U.hash(i, seed * 100, 2) - 0.5) * 8;
        const sw = Math.sin(t * 2 + i + seed * 5) * 1.5;
        ctx.beginPath(); ctx.moveTo(x + ox, y + oy); ctx.quadraticCurveTo(x + ox + sw, y + oy - 6, x + ox + sw * 2, y + oy - 11); ctx.stroke();
      }
      return;
    }
    if (type === 'flowers') {
      ell(ctx, x, y, 12, 5.5, '#4f8f34');
      const cols = ['#ff6b8a', '#ffd84a', '#ffffff', '#c47bff', '#ff9a3d'];
      for (let i = 0; i < 12; i++) {
        const ox = (U.hash(i, seed * 77, 1) - 0.5) * 20, oy = (U.hash(i, seed * 77, 2) - 0.5) * 8;
        ell(ctx, x + ox, y + oy - 2, 1.8, 1.5, cols[i % cols.length]);
      }
      return;
    }
    shadow(ctx, x + 2, y + 1, 10, 4.5);
    ell(ctx, x, y - 5, 10, 7, '#3f7f34');
    ell(ctx, x - 4, y - 7, 6, 5, '#54994a');
    ell(ctx, x + 4, y - 8, 5, 4, '#62a852');
  };
  S.rock = function (ctx, x, y, seed) {
    shadow(ctx, x + 2, y + 1, 11, 5);
    quad(ctx, [[x - 10, y], [x - 7, y - 8], [x + 1, y - 11], [x + 9, y - 6], [x + 10, y], [x, y + 3]], '#8e8c84');
    quad(ctx, [[x - 7, y - 8], [x + 1, y - 11], [x + 9, y - 6], [x + 1, y - 4]], '#aaa89f');
  };

  /* ------------ pequenos objetos ------------ */
  S.small = function (ctx, o, t, night) {
    const d = o.def;
    const [x, y] = Iso.p(o.x + 0.5, o.y + 0.5);
    switch (d.kind) {
      case 'bench':
        shadow(ctx, x, y + 1, 10, 4);
        isoBox(ctx, o.x + 0.25, o.y + 0.4, 0.5, 0.2, 5, '#b07a45', '#8e5f33', '#6e4824');
        isoBox(ctx, o.x + 0.25, o.y + 0.32, 0.5, 0.08, 10, '#a06a3a', '#8e5f33', '#6e4824', 5);
        break;
      case 'bin':
        shadow(ctx, x, y + 1, 5, 2.5);
        ctx.fillStyle = '#2f7d3b'; ctx.fillRect(x - 3.5, y - 10, 7, 10);
        ell(ctx, x, y - 10, 3.5, 1.8, '#3c9a4a');
        if (o.fill >= d.capacity * 0.8) S.emoji(ctx, '⚠️', x, y - 17, 8);
        break;
      case 'decor':
        if (o.type === 'lamp') {
          shadow(ctx, x, y + 1, 4, 2);
          ctx.fillStyle = '#3a3f44'; ctx.fillRect(x - 1, y - 26, 2, 26);
          ell(ctx, x, y - 27, 4, 3, night ? '#fff3b0' : '#e7e2c8');
        } else if (o.type === 'fountain') {
          shadow(ctx, x, y + 2, 16, 7);
          ell(ctx, x, y - 2, 16, 7.5, '#bfb8a8'); ell(ctx, x, y - 3, 13, 6, '#5fb6e2');
          ctx.fillStyle = '#bfb8a8'; ctx.fillRect(x - 2, y - 14, 4, 12);
          for (let i = 0; i < 5; i++) { const a = t * 3 + i * 1.3; ell(ctx, x + Math.cos(a) * 5, y - 14 - Math.abs(Math.sin(a)) * 5, 1.4, 1.4, 'rgba(200,235,255,0.9)'); }
        }
        break;
      case 'sign':
        shadow(ctx, x, y + 1, 5, 2);
        ctx.fillStyle = '#6b4a2b'; ctx.fillRect(x - 1, y - 14, 2, 14);
        quad(ctx, [[x - 8, y - 20], [x + 8, y - 24], [x + 8, y - 14], [x - 8, y - 10]], '#3d7d3f');
        ctx.strokeStyle = '#f3e7c4'; ctx.lineWidth = 0.8;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - 6, y - 17.5 + i * 2.6); ctx.lineTo(x + 6, y - 20.5 + i * 2.6); ctx.stroke(); }
        break;
      case 'filter': {
        shadow(ctx, x, y + 1, 9, 4);
        isoBox(ctx, o.x + 0.25, o.y + 0.3, 0.5, 0.4, 9, '#9fb4bf', '#7f97a3', '#5f7581');
        ctx.strokeStyle = '#4a5a62'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 6, y - 6); ctx.quadraticCurveTo(x + 14, y - 6, x + 14, y + 2); ctx.stroke();
        const on = !o.broken;
        ell(ctx, x - 2, y - 11, 2, 2, on ? '#4fd17a' : '#e8473b');
        if (on) for (let k = 0; k < 3; k++) { const ph = (t * 1.5 + k / 3) % 1; ell(ctx, x + 14, y + 2 - ph * 8, 1.2 * (1 - ph), 1.2 * (1 - ph), 'rgba(220,245,255,0.9)'); }
        break;
      }
      case 'icemaker': {
        shadow(ctx, x, y + 1, 11, 5);
        isoBox(ctx, o.x + 0.18, o.y + 0.18, 0.64, 0.64, 13, '#f4fbff', '#d8eef8', '#b4d4e4');
        ell(ctx, x, y - 14, 5, 2.4, '#ffffff');
        for (let k = 0; k < 4; k++) { const ph = (t * 0.6 + k / 4) % 1; ctx.fillStyle = `rgba(255,255,255,${1 - ph})`; ctx.fillRect(x - 8 + k * 5, y - 16 - ph * 10, 1.6, 1.6); }
        break;
      }
      case 'feeder': {
        if (o.def.onWater) {
          ell(ctx, x, y + 1, 12, 5, 'rgba(255,255,255,0.35)');
          isoBox(ctx, o.x + 0.15, o.y + 0.25, 0.7, 0.5, 3, '#c49a62', '#a67c48', '#86602f');
          const lv = o.food / 100;
          if (lv > 0.02) { for (let k = 0; k < Math.ceil(lv * 5); k++) ell(ctx, x - 6 + k * 3, y - 4, 1.6, 0.9, '#9ab6c8'); }
          else S.emoji(ctx, '❗', x, y - 12, 9);
          break;
        }
        shadow(ctx, x, y + 1, 11, 4.5);
        isoBox(ctx, o.x + 0.2, o.y + 0.32, 0.6, 0.36, 6, '#a77a49', '#8a6236', '#6b4a27');
        const lv = o.food / 100;
        if (lv > 0.02) {
          const f = ZM.FOOD[o.foodType || 'hay'];
          const col = { hay: '#d9c25a', meat: '#c44b3b', fruit: '#f0a23a', fish: '#9ab6c8', insects: '#6b4b2b', seeds: '#c99a5a' }[o.foodType || 'hay'];
          isoBox(ctx, o.x + 0.25, o.y + 0.36, 0.5, 0.28, 6 + lv * 3, col, shade(col, -0.1), shade(col, -0.2), 6);
        } else S.emoji(ctx, '❗', x, y - 16, 9);
        break;
      }
      case 'trough': {
        shadow(ctx, x, y + 1, 10, 4.5);
        isoBox(ctx, o.x + 0.22, o.y + 0.22, 0.56, 0.56, 6, '#9aa3a8', '#8a9398', '#6c757a');
        const lv = o.water / 100;
        const [ax, ay] = Iso.p(o.x + 0.3, o.y + 0.3), [bx, by] = Iso.p(o.x + 0.7, o.y + 0.3), [cx, cy] = Iso.p(o.x + 0.7, o.y + 0.7), [dx, dy] = Iso.p(o.x + 0.3, o.y + 0.7);
        if (lv > 0.03) quad(ctx, [[ax, ay - 6], [bx, by - 6], [cx, cy - 6], [dx, dy - 6]], `rgba(70,160,220,${0.4 + lv * 0.6})`);
        else S.emoji(ctx, '❗', x, y - 16, 9);
        break;
      }
      case 'shelter':
        shadow(ctx, x + 3, y + 2, 18, 8);
        isoBox(ctx, o.x + 0.12, o.y + 0.12, 0.76, 0.76, 11, '#8c6a43', '#7a5a35', '#5d4426');
        roofPyramid(ctx, o.x + 0.12, o.y + 0.12, 0.76, 0.76, 11, 12, '#c9a85a');
        quad(ctx, [Iso.p(o.x + 0.4, o.y + 0.88).map((v, i) => v - (i ? 0 : 0)), Iso.p(o.x + 0.65, o.y + 0.88), [Iso.p(o.x + 0.65, o.y + 0.88)[0], Iso.p(o.x + 0.65, o.y + 0.88)[1] - 8], [Iso.p(o.x + 0.4, o.y + 0.88)[0], Iso.p(o.x + 0.4, o.y + 0.88)[1] - 8]], '#2e2014');
        break;
      case 'toy':
        if (o.type === 'ball') { shadow(ctx, x, y + 1, 5, 2); ell(ctx, x, y - 4, 4.5, 4.5, '#e8473b'); ctx.fillStyle = '#fff'; ctx.fillRect(x - 4.5, y - 5, 9, 2); }
        else if (o.type === 'logs') {
          shadow(ctx, x, y + 1, 12, 4);
          for (let i = 0; i < 3; i++) { const oy = i === 2 ? -5 : 0, ox = i === 2 ? 0 : (i ? 5 : -5); ctx.fillStyle = '#7a5530'; ctx.fillRect(x + ox - 7, y + oy - 4, 14, 4); ell(ctx, x + ox + 7, y + oy - 2, 1.8, 2, '#c99a62'); }
        } else if (o.type === 'platform') {
          shadow(ctx, x + 2, y + 1, 14, 6);
          ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 2;
          [[-9, 0], [9, 0], [0, -5], [0, 5]].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(x + a, y + b); ctx.lineTo(x + a, y + b - 18); ctx.stroke(); });
          quad(ctx, [[x - 11, y - 18], [x, y - 24], [x + 11, y - 18], [x, y - 12]], '#a8794a');
          ctx.strokeStyle = '#c9b48a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 9, y - 18); ctx.quadraticCurveTo(x + 14, y - 8, x + 12, y); ctx.stroke();
        } else if (o.type === 'floattoy') {
          const bob = Math.sin(t * 2 + o.id) * 1.2;
          ctx.strokeStyle = '#ff6b3d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y - 2 + bob, 6, 3, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.ellipse(x, y - 2 + bob, 6, 3, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        } else { shadow(ctx, x, y + 1, 7, 3); isoBox(ctx, o.x + 0.35, o.y + 0.35, 0.3, 0.3, 7, '#d9b46a', '#c49a50', '#9a7636'); S.emoji(ctx, '❓', x, y - 12, 6); }
        break;
    }
  };

  /* ------------ pessoas ------------ */
  /* versão simplificada (nível de detalhe) para zoom distante / multidões */
  S.personLOD = function (ctx, x, y, p, staffRole) {
    const s = p.kid ? 0.75 : 1;
    ctx.fillStyle = p.pants; ctx.fillRect(x - 2 * s, y - 6 * s, 4 * s, 6 * s);
    ctx.fillStyle = p.shirt; ctx.fillRect(x - 3 * s, y - 13 * s, 6 * s, 7 * s);
    ctx.fillStyle = staffRole ? ZM.STAFF_ROLES[staffRole].hat : p.skin; ctx.fillRect(x - 2.5 * s, y - 18 * s, 5 * s, 5 * s);
  };
  S.person = function (ctx, x, y, p, phase, moving, facing, staffRole) {
    const s = p.kid ? 0.75 : 1;
    shadow(ctx, x, y, 4.5 * s, 2 * s, 0.25);
    const sw = moving ? Math.sin(phase) * 2.2 * s : 0;
    ctx.lineCap = 'round';
    // pernas
    ctx.strokeStyle = p.pants; ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.moveTo(x - 1 * s, y - 6 * s); ctx.lineTo(x - 1 * s + sw, y); ctx.moveTo(x + 1 * s, y - 6 * s); ctx.lineTo(x + 1 * s - sw, y); ctx.stroke();
    // corpo
    ctx.fillStyle = p.shirt;
    ctx.beginPath(); ctx.moveTo(x - 3 * s, y - 6 * s); ctx.lineTo(x + 3 * s, y - 6 * s); ctx.lineTo(x + 2.6 * s, y - 13 * s); ctx.lineTo(x - 2.6 * s, y - 13 * s); ctx.closePath(); ctx.fill();
    // braços
    ctx.strokeStyle = p.skin; ctx.lineWidth = 1.5 * s;
    ctx.beginPath(); ctx.moveTo(x - 3 * s, y - 12 * s); ctx.lineTo(x - 3.6 * s - sw * 0.5, y - 7 * s); ctx.moveTo(x + 3 * s, y - 12 * s); ctx.lineTo(x + 3.6 * s + sw * 0.5, y - 7 * s); ctx.stroke();
    // cabeça
    ell(ctx, x, y - 15.5 * s, 3 * s, 3 * s, p.skin);
    ctx.fillStyle = p.hair;
    ctx.beginPath(); ctx.arc(x, y - 16 * s, 3.1 * s, Math.PI, 0); ctx.fill();
    if (staffRole) {
      const r = ZM.STAFF_ROLES[staffRole];
      ctx.fillStyle = r.hat;
      if (staffRole === 'vet' || staffRole === 'researcher') { ctx.fillRect(x - 3 * s, y - 13 * s, 6 * s, 1.5 * s); }
      else { ell(ctx, x, y - 17.5 * s, 4.2 * s, 1.4 * s, r.hat); ctx.beginPath(); ctx.arc(x, y - 17.5 * s, 2.8 * s, Math.PI, 0); ctx.fill(); }
      if (staffRole === 'janitor') { ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 4 * facing, y - 12); ctx.lineTo(x + 6 * facing, y + 1); ctx.stroke(); }
    }
  };

  /* ------------ animais ------------ */
  S.animal = function (ctx, x, y, a, t, selected) {
    const sp = a.sp;
    // dimorfismo sexual: cores próprias da fêmea e machos maiores
    const look = a.sex === 'F' && sp.look.female ? Object.assign({}, sp.look, sp.look.female) : sp.look;
    let s = sp.size * (a.isBaby ? 0.55 : 1) * 1.3 * (a.sex === 'M' && sp.dimorph && !a.isBaby ? sp.dimorph : 1);
    let pose = 'stand';
    const st = a.state;
    if (st === 'SLEEP' || st === 'TRANQ') pose = 'sleep';
    else if (st === 'REST' || st === 'HIDE' || st === 'BASK' || st === 'GROOM' || st === 'WALLOW') pose = 'rest';
    else if (st === 'EAT' || st === 'DRINK' || st === 'GRAZE' || st === 'DIG' || st === 'WAIT_FOOD' && Math.sin(t + a.id) > 0.6) pose = 'eat';
    else if (st === 'SWIM') pose = 'swim';
    if (a.inShelter) return; // dentro do abrigo
    const m = ZM.game.zoo.map;
    const onWater = ZM.isWater(m.terrain[m.idx(a.tx(), a.ty())]);
    if (onWater && (sp.swims) && pose !== 'sleep') pose = 'swim';
    const moving = !!a.path;
    const phase = a.phase;
    // olha para os visitantes / alterna o lado ao catar e pastar
    let f = a.facing;
    if (!moving && (st === 'GRAZE' || st === 'GROOM')) f = Math.sin(t * 0.4 + a.id) > 0 ? 1 : -1;
    ctx.save();
    ctx.translate(x, y);
    if (st === 'PLAY' && !moving) ctx.translate(0, -Math.abs(Math.sin(t * 8 + a.id)) * 3);
    if (st === 'CLIMB' && !moving) {
      // no alto da árvore ou da plataforma, balançando de leve
      const hgt = (sp.look.type === 'sloth' ? 20 : 15) + Math.sin(t * 0.9 + a.id) * 1.5;
      ctx.fillStyle = 'rgba(20,15,5,0.18)'; ctx.beginPath(); ctx.ellipse(0, 0, 6 * s, 2.5 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.translate(Math.sin(t * 1.3 + a.id) * 0.8, -hgt);
    }
    if ((st === 'HOWL' || st === 'SENTINEL' || st === 'WATCH') && !moving) ctx.translate(0, -Math.max(0, Math.sin(t * 2 + a.id)) * (st === 'HOWL' ? 1.5 : 0.6));
    // halo escuro suave: destaca o animal do terreno
    if (S.hiQuality) { ctx.shadowColor = 'rgba(20,15,5,0.55)'; ctx.shadowBlur = 2.5 * S.zoomPx; }
    switch (look.type) {
      case 'quad': drawQuad(ctx, look, s, f, phase, moving, pose, a, t); break;
      case 'flamingo': drawFlamingo(ctx, look, s, f, phase, moving, pose, a, t); break;
      case 'parrot': drawParrot(ctx, look, s, f, phase, moving, pose, a, t); break;
      case 'croc': drawCroc(ctx, look, s, f, phase, moving, pose, a, t); break;
      case 'primate': drawPrimate(ctx, look, s, f, phase, moving, pose, a, t); break;
      case 'ratite': drawRatite(ctx, look, s, f, phase, moving, pose, a, t); break;
      case 'kangaroo': drawKangaroo(ctx, look, s, f, phase, moving, pose, a, t); break;
      case 'meerkat': drawMeerkat(ctx, look, s, f, phase, moving, pose, a, t); break;
      case 'sloth': drawSloth(ctx, look, s, f, phase, moving, pose, a, t); break;
      case 'penguin': drawPenguin(ctx, look, s, f, phase, moving, pose, a, t); break;
      case 'seal': drawSeal(ctx, look, s, f, phase, moving, pose, a, t); break;
      case 'turtle': drawTurtle(ctx, look, s, f, phase, moving, pose, a, t); break;
      case 'fish': drawFish(ctx, look, s, f, phase, moving, pose, a, t); break;
    }
    ctx.restore();
  };

  /* símbolo do sexo ao lado do animal (♂ azul, ♀ rosa) */
  S.sexMark = function (ctx, x, y, sex) {
    ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillText(sex === 'M' ? '♂' : '♀', x + 0.8, y + 0.8);
    ctx.fillStyle = sex === 'M' ? '#5aa9ff' : '#ff7eb6'; ctx.fillText(sex === 'M' ? '♂' : '♀', x, y);
  };

  function drawQuad(ctx, L0, s, f, phase, moving, pose, a, t) {
    const L = L0.L, H = L0.H, leg = L0.leg;
    shadow(ctx, 0, 0, L * 0.55 * s, 3.5 * s, pose === 'swim' ? 0 : 0.25);
    ctx.save();
    ctx.scale(f * s, s);
    let bodyY = -leg - H / 2;
    if (pose === 'sleep' || pose === 'rest') bodyY = -H / 2 + 0.5;
    if (pose === 'swim') { bodyY = -H * 0.15; }
    const swing = moving ? Math.sin(phase) * 2.6 : 0;
    const legCol = L0.legsDark ? L0.dark : shade(L0.body, -0.1);
    const lw = Math.max(2.2, L * 0.13);
    if (pose === 'swim') {
      ctx.save(); ctx.beginPath(); ctx.rect(-L * 2, -60, L * 4, 60 - 1); ctx.clip();
    }
    // pernas de trás (lado oposto)
    if (pose === 'stand' || pose === 'eat') {
      ctx.strokeStyle = shade(legCol, -0.2); ctx.lineWidth = lw; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(L * 0.3 + 1.5, bodyY); ctx.lineTo(L * 0.3 + 1.5 - swing, -0.5);
      ctx.moveTo(-L * 0.28 + 1.5, bodyY); ctx.lineTo(-L * 0.28 + 1.5 + swing, -0.5); ctx.stroke();
    }
    // cauda
    drawTail(ctx, L0, -L / 2 + 1, bodyY - H * 0.15, t, a);
    // corpo
    if (L0.hump) ell(ctx, L * 0.18, bodyY - H * 0.38, L * 0.22, H * 0.3, L0.body);
    ell(ctx, 0, bodyY, L / 2, H / 2, L0.body);
    ell(ctx, 0.5, bodyY + H * 0.22, L * 0.4, H * 0.24, L0.light);
    // padrões
    if (L0.pattern) {
      ctx.save(); ctx.beginPath(); ctx.ellipse(0, bodyY, L / 2, H / 2, 0, 0, Math.PI * 2); ctx.clip();
      drawPattern(ctx, L0, L, H, bodyY, a.id);
      ctx.restore();
    }
    if (L0.mane === 'stripe') { ctx.strokeStyle = L0.dark; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(0, bodyY, L / 2 - 0.5, H / 2 - 0.5, 0, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
    // pernas da frente
    if (pose === 'stand' || pose === 'eat') {
      ctx.strokeStyle = legCol; ctx.lineWidth = lw; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(L * 0.3, bodyY + 1); ctx.lineTo(L * 0.3 + swing, 0);
      ctx.moveTo(-L * 0.28, bodyY + 1); ctx.lineTo(-L * 0.28 - swing, 0); ctx.stroke();
      if (L0.pattern === 'stripes') { ctx.strokeStyle = '#222'; ctx.lineWidth = 0.8; for (let k = 1; k < 4; k++) { const yy = bodyY + (leg / 4) * k + 2; ctx.beginPath(); ctx.moveTo(L * 0.3 - 1.2, yy); ctx.lineTo(L * 0.3 + 1.2, yy); ctx.moveTo(-L * 0.28 - 1.2, yy); ctx.lineTo(-L * 0.28 + 1.2, yy); ctx.stroke(); } }
    } else if (pose === 'rest' || pose === 'sleep') {
      ctx.strokeStyle = legCol; ctx.lineWidth = lw; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(L * 0.25, -1); ctx.lineTo(L * 0.5, -0.5); ctx.stroke();
    }
    // pescoço e cabeça
    let hx, hy;
    const neck = L0.neck;
    if (pose === 'eat' && leg > 2) { hx = L / 2 + 2 + neck * 0.3; hy = -L0.head * 0.6; }
    else if (pose === 'sleep') { hx = L / 2 - 1; hy = -L0.head * 0.8; }
    else if (L0.headLow) { hx = L / 2 + 1; hy = bodyY - H * 0.05; }
    else if (L0.neckAngle) { hx = L / 2 + neck * L0.neckAngle; hy = bodyY - H * 0.3 - neck; }
    else { hx = L / 2 + neck * 0.45 + 1; hy = bodyY - H * 0.3 - neck * 0.75; }
    if (neck > 0 || pose === 'eat') {
      ctx.strokeStyle = L0.body; ctx.lineWidth = Math.max(3, L0.head * (neck > 10 ? 0.9 : 1.4)); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(L * 0.33, bodyY - H * 0.15); ctx.lineTo(hx - 1, hy + 1); ctx.stroke();
      if (L0.pattern === 'patches' && neck > 10) { ctx.fillStyle = L0.dark; for (let k = 1; k < 5; k++) { const px = L * 0.33 + (hx - L * 0.33) * k / 5, py = bodyY - H * 0.15 + (hy - bodyY + H * 0.15) * k / 5; ell(ctx, px, py, 1.3, 1.6, L0.dark); } }
      if (L0.pattern === 'stripes') { ctx.strokeStyle = '#1d1d1d'; ctx.lineWidth = 1; for (let k = 1; k < 4; k++) { const px = L * 0.33 + (hx - L * 0.33) * k / 4, py = bodyY - H * 0.15 + (hy - bodyY + H * 0.15) * k / 4; ctx.beginPath(); ctx.moveTo(px - 2, py - 1); ctx.lineTo(px + 1.5, py + 1.5); ctx.stroke(); } }
      if (L0.mane === 'stripe') { ctx.strokeStyle = L0.dark; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(L * 0.3, bodyY - H * 0.45); ctx.lineTo(hx - 2.5, hy - 2); ctx.stroke(); }
    }
    // juba do leão (só machos adultos)
    if (L0.mane === 'lion' && a.sex === 'M' && !a.isBaby) {
      ell(ctx, hx - 1.5, hy, L0.head * 1.75, L0.head * 1.85, '#7a4a1e');
      ell(ctx, hx - 0.5, hy, L0.head * 1.45, L0.head * 1.5, '#9c6128');
    }
    // orelhas
    drawEars(ctx, L0, hx, hy);
    // cabeça
    if (L0.bigMouth) { ell(ctx, hx + 2, hy + 1, L0.head * 1.1, L0.head * 0.8, L0.body); ell(ctx, hx + L0.head * 0.9, hy + 1.5, L0.snout * 0.9, L0.head * 0.7, L0.light); }
    else {
      ell(ctx, hx, hy, L0.head, L0.head * 0.9, L0.body);
      if (L0.snout) {
        const sl = L0.snout;
        ctx.fillStyle = L0.snout > 6 ? L0.body : shade(L0.body, 0.05);
        ctx.beginPath(); ctx.ellipse(hx + L0.head * 0.6 + sl * 0.45, hy + (L0.snout > 6 ? 1.5 : 0.8), sl * 0.6, L0.head * (L0.snout > 6 ? 0.32 : 0.55), L0.snout > 6 ? 0.25 : 0.1, 0, Math.PI * 2); ctx.fill();
        ell(ctx, hx + L0.head * 0.6 + sl * 1.0, hy + (L0.snout > 6 ? 3 : 1), 1, 0.9, '#1a1410');
      }
    }
    if (L0.trunk) {
      ctx.strokeStyle = L0.body; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
      const sw = Math.sin(t * 2 + a.id) * 2;
      ctx.beginPath(); ctx.moveTo(hx + L0.head * 0.7, hy + 1); ctx.quadraticCurveTo(hx + L0.head + 4, hy + 6, hx + L0.head + 2 + sw, hy + 13 + (pose === 'eat' ? 3 : 0)); ctx.stroke();
      if (L0.tusks && !a.isBaby) { const tl = a.sex === 'F' ? 0.55 : 1; ctx.strokeStyle = '#f4efe2'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(hx + L0.head * 0.6, hy + 3); ctx.quadraticCurveTo(hx + L0.head + 4 * tl, hy + 6, hx + L0.head * 0.6 + 5 * tl + 1, hy + 3); ctx.stroke(); }
    }
    if (L0.trunkShort) { ctx.strokeStyle = shade(L0.body, -0.15); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(hx + L0.head + L0.snout * 0.7, hy + 1); ctx.quadraticCurveTo(hx + L0.head + L0.snout + 2, hy + 2, hx + L0.head + L0.snout + 1.5, hy + 4.5); ctx.stroke(); }
    if (L0.horn) { const hb = hx + L0.head * 0.6 + L0.snout * 0.7; quad(ctx, [[hb - 2, hy - L0.head * 0.3], [hb + 2.5, hy - L0.head * 0.3], [hb + 1.5, hy - L0.head * 1.6 - (a.sex === 'M' ? 2 : 0)]], '#d8d0bc'); quad(ctx, [[hb - 3.5, hy - L0.head * 0.55], [hb - 1.5, hy - L0.head * 0.6], [hb - 2.4, hy - L0.head * 1.0]], '#d8d0bc'); }
    if (L0.ossicones) { ctx.strokeStyle = L0.dark; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(hx - 1, hy - L0.head * 0.7); ctx.lineTo(hx - 1.5, hy - L0.head * 1.6); ctx.moveTo(hx + 1, hy - L0.head * 0.7); ctx.lineTo(hx + 0.8, hy - L0.head * 1.6); ctx.stroke(); }
    // olho
    if (pose === 'sleep') { ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(hx + L0.head * 0.15, hy - L0.head * 0.15); ctx.lineTo(hx + L0.head * 0.55, hy - L0.head * 0.15); ctx.stroke(); }
    else ell(ctx, hx + L0.head * 0.35, hy - L0.head * 0.2, 0.9, 0.9, '#1a1410');
    if (pose === 'swim') {
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(0, -1, L * 0.6, 3, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawTail(ctx, L0, x, y, t, a) {
    const wag = Math.sin(t * 3 + a.id) * 2;
    ctx.lineCap = 'round';
    switch (L0.tail) {
      case 'tuft': ctx.strokeStyle = L0.body; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 4, y + 3, x - 3 + wag * 0.5, y + 9); ctx.stroke(); ell(ctx, x - 3 + wag * 0.5, y + 10, 1.4, 2.2, L0.dark); break;
      case 'long': ctx.strokeStyle = L0.body; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 9, y + 2, x - 11 + wag, y - 4); ctx.stroke(); ell(ctx, x - 11 + wag, y - 4, 1.2, 1.2, L0.dark); break;
      case 'fox': ctx.fillStyle = L0.body; ctx.beginPath(); ctx.ellipse(x - 5, y + 3 + wag * 0.3, 6, 2.6, 0.5, 0, Math.PI * 2); ctx.fill(); ell(ctx, x - 9.5, y + 6, 2, 1.6, '#f2ece0'); break;
      case 'bushy': ctx.fillStyle = L0.dark; ctx.beginPath(); ctx.ellipse(x - 7, y - 1 + wag * 0.3, 9, 4.5, -0.25, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = L0.body; ctx.beginPath(); ctx.ellipse(x - 6, y - 2 + wag * 0.3, 7, 3, -0.25, 0, Math.PI * 2); ctx.fill(); break;
      case 'thin': ctx.strokeStyle = L0.body; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2 + wag * 0.4, y + 8); ctx.stroke(); break;
      case 'stub': ell(ctx, x, y + 1, 1.5, 1.2, L0.body); break;
      case 'ring': { ctx.lineWidth = 2.2; for (let k = 0; k < 6; k++) { ctx.strokeStyle = k % 2 ? L0.dark : L0.light; ctx.beginPath(); const a0 = k / 6, a1 = (k + 1) / 6; ctx.moveTo(x - a0 * 3, y - a0 * 11 + wag * a0); ctx.lineTo(x - a1 * 3, y - a1 * 11 + wag * a1); ctx.stroke(); } break; }
      case 'otter': ctx.fillStyle = L0.body; ctx.beginPath(); ctx.moveTo(x, y - 2); ctx.quadraticCurveTo(x - 6, y + 1 + wag * 0.3, x - 11, y + 3); ctx.lineTo(x, y + 2); ctx.fill(); break;
    }
  }
  function drawEars(ctx, L0, hx, hy) {
    const h = L0.head;
    switch (L0.ears) {
      case 'round': ell(ctx, hx - h * 0.45, hy - h * 0.8, h * 0.32, h * 0.32, shade(L0.body, -0.15)); break;
      case 'pointy': quad(ctx, [[hx - h * 0.6, hy - h * 0.5], [hx - h * 0.9, hy - h * 1.6], [hx - h * 0.1, hy - h * 0.7]], L0.body); break;
      case 'big': quad(ctx, [[hx - h * 0.7, hy - h * 0.4], [hx - h * 0.9, hy - h * 2.1], [hx, hy - h * 0.7]], L0.body); quad(ctx, [[hx - h * 0.6, hy - h * 0.6], [hx - h * 0.8, hy - h * 1.7], [hx - h * 0.25, hy - h * 0.75]], '#f2ece0'); break;
      case 'tiny': ell(ctx, hx - h * 0.4, hy - h * 0.8, h * 0.2, h * 0.2, shade(L0.body, -0.2)); break;
      case 'elephant': ell(ctx, hx - h * 0.5, hy + h * 0.1, h * 0.85, h * 1.1, shade(L0.body, -0.1)); break;
    }
  }
  function drawPattern(ctx, L0, L, H, bodyY, seed) {
    switch (L0.pattern) {
      case 'stripes':
        ctx.strokeStyle = '#1d1d1d'; ctx.lineWidth = 1.4;
        for (let i = -L / 2; i < L / 2; i += 2.8) { ctx.beginPath(); ctx.moveTo(i, bodyY - H / 2); ctx.quadraticCurveTo(i + 1.5, bodyY, i - 0.5, bodyY + H / 2); ctx.stroke(); }
        break;
      case 'patches':
        for (let i = 0; i < 14; i++) { const px = -L / 2 + U.hash(i, seed, 1) * L, py = bodyY - H / 2 + U.hash(i, seed, 2) * H; ell(ctx, px, py, 2.2, 1.8, L0.dark); }
        break;
      case 'rosettes':
        for (let i = 0; i < 16; i++) { const px = -L / 2 + U.hash(i, seed, 1) * L, py = bodyY - H / 2 + U.hash(i, seed, 2) * H; ctx.strokeStyle = L0.dark; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(px, py, 1.4, 0, Math.PI * 2); ctx.stroke(); }
        break;
      case 'bands':
        ctx.strokeStyle = L0.dark; ctx.lineWidth = 0.9;
        for (let i = -L / 2 + 2; i < L / 2 - 1; i += 2.2) { ctx.beginPath(); ctx.moveTo(i, bodyY - H / 2); ctx.lineTo(i, bodyY + H / 2); ctx.stroke(); }
        ctx.fillStyle = L0.light; ctx.fillRect(-L / 2, bodyY + H * 0.25, L, H * 0.3);
        break;
      case 'band':
        ctx.fillStyle = '#f2ece0'; ctx.beginPath(); ctx.moveTo(L * 0.35, bodyY - H / 2); ctx.lineTo(L * 0.1, bodyY + H / 2); ctx.lineTo(-L * 0.05, bodyY + H / 2); ctx.lineTo(L * 0.2, bodyY - H / 2); ctx.fill();
        ctx.fillStyle = L0.dark; ctx.beginPath(); ctx.moveTo(L * 0.3, bodyY - H / 2); ctx.lineTo(L * 0.06, bodyY + H / 2); ctx.lineTo(0, bodyY + H / 2); ctx.lineTo(L * 0.24, bodyY - H / 2); ctx.fill();
        break;
    }
  }
  function drawFlamingo(ctx, L0, s, f, phase, moving, pose, a, t) {
    shadow(ctx, 0, 0, 6 * s, 2.5 * s, pose === 'swim' ? 0.1 : 0.25);
    ctx.save(); ctx.scale(f * s, s);
    const sw = moving ? Math.sin(phase) * 3 : 0;
    const legH = pose === 'sleep' ? 6 : 15;
    ctx.strokeStyle = L0.dark; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -legH); ctx.lineTo(sw, 0);
    if (moving || pose === 'eat') { ctx.moveTo(1, -legH); ctx.lineTo(1 - sw, 0); }
    else { ctx.moveTo(1, -legH); ctx.lineTo(3, -legH + 5); ctx.lineTo(1, -legH + 7); }
    ctx.stroke();
    const by = -legH - 3;
    ell(ctx, -1, by, 7, 4, L0.body);
    ell(ctx, -3, by - 0.5, 4, 2.5, L0.light);
    ctx.fillStyle = '#2a1a1a'; ctx.beginPath(); ctx.moveTo(-7, by); ctx.lineTo(-10, by + 1); ctx.lineTo(-7, by + 2); ctx.fill();
    let hx = 7, hy = by - 13;
    if (pose === 'eat' || (pose === 'swim' && Math.sin(t + a.id) > 0)) { hx = 9; hy = -2; }
    if (pose === 'sleep') { hx = 2; hy = by - 3; }
    ctx.strokeStyle = L0.body; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(4, by - 1); ctx.bezierCurveTo(9, by - 5, 1, hy + 6, hx, hy); ctx.stroke();
    ell(ctx, hx, hy, 2, 1.8, L0.body);
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.moveTo(hx + 1, hy - 1); ctx.lineTo(hx + 4.5, hy + 1.5); ctx.lineTo(hx + 1, hy + 1.2); ctx.fill();
    ctx.restore();
  }
  function drawParrot(ctx, L0, s, f, phase, moving, pose, a, t) {
    const fly = moving ? 10 + Math.sin(phase * 0.5) * 3 : 0;
    shadow(ctx, 0, 0, 4 * s, 2 * s, fly ? 0.15 : 0.25);
    ctx.save(); ctx.scale(f * s, s); ctx.translate(0, -fly);
    // cauda
    ctx.fillStyle = L0.dark; ctx.beginPath(); ctx.moveTo(-2, -6); ctx.lineTo(-11, 2); ctx.lineTo(-8, 3); ctx.lineTo(0, -3); ctx.fill();
    ell(ctx, 0, -8, 4.5, 6, L0.body);
    // asa
    const flap = moving ? Math.sin(t * 22) * 6 : 0;
    ctx.fillStyle = L0.dark; ctx.beginPath(); ctx.moveTo(-1, -11); ctx.lineTo(-7, -6 - flap); ctx.lineTo(1, -4); ctx.fill();
    ell(ctx, 2, -15, 3.6, 3.4, L0.body);
    ell(ctx, 3.5, -15.5, 1.3, 1.3, L0.light);
    ell(ctx, 3.7, -15.5, 0.6, 0.6, '#111');
    if (L0.beak) { ctx.fillStyle = L0.beak; ctx.beginPath(); ctx.moveTo(4.5, -17); ctx.quadraticCurveTo(13, -16.5, 13, -13); ctx.lineTo(5, -13); ctx.fill(); ell(ctx, 12.4, -14.2, 1, 1.2, '#111'); ell(ctx, 1.6, -11.5, 2.4, 1.8, L0.light); }
    else { ctx.fillStyle = '#222'; ctx.beginPath(); ctx.moveTo(5, -16); ctx.quadraticCurveTo(8.5, -15, 6, -12); ctx.lineTo(5, -13.5); ctx.fill(); ell(ctx, 4.6, -13.4, 1, 0.8, L0.light); }
    if (!moving) { ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-1, -2.5); ctx.lineTo(-1, 0); ctx.moveTo(1, -2.5); ctx.lineTo(1, 0); ctx.stroke(); }
    ctx.restore();
  }
  function drawCroc(ctx, L0, s, f, phase, moving, pose, a, t) {
    const swim = pose === 'swim';
    if (!swim) shadow(ctx, 0, 0, 14 * s, 3 * s, 0.25);
    ctx.save(); ctx.scale(f * s, s);
    const wig = moving ? Math.sin(phase) * 1.5 : 0;
    if (swim) {
      ell(ctx, 0, -1, 12, 2, L0.body);
      for (let i = -8; i < 8; i += 3) ell(ctx, i, -2.2, 1, 0.8, L0.dark);
      ell(ctx, 10, -2.5, 1.2, 1, L0.dark); ell(ctx, 12, -2.5, 1.2, 1, L0.dark);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, -0.5, 15, 3, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore(); return;
    }
    // patas
    ctx.strokeStyle = L0.dark; ctx.lineWidth = 2;
    [[6, 1], [-6, -1]].forEach(([px, k]) => { ctx.beginPath(); ctx.moveTo(px, -3); ctx.lineTo(px + 2 + wig * k, 0); ctx.stroke(); });
    // cauda
    ctx.fillStyle = L0.body; ctx.beginPath(); ctx.moveTo(-8, -5); ctx.quadraticCurveTo(-16, -3 + wig, -22, -1 + wig); ctx.lineTo(-8, -1); ctx.fill();
    ell(ctx, 0, -3.5, 10, 3.2, L0.body);
    ell(ctx, 0, -2.4, 8, 1.4, L0.light);
    for (let i = -7; i < 8; i += 2.5) ell(ctx, i, -6.2, 0.9, 0.7, L0.dark);
    // cabeça
    ctx.fillStyle = L0.body; ctx.beginPath(); ctx.moveTo(8, -6); ctx.lineTo(19, -3.5); ctx.lineTo(19, -1.5); ctx.lineTo(8, -1.5); ctx.fill();
    ell(ctx, 10, -6, 1.3, 1.1, '#e8d36a'); ell(ctx, 10.2, -6, 0.5, 0.8, '#111');
    ctx.restore();
  }
  function drawPrimate(ctx, L0, s, f, phase, moving, pose, a, t) {
    const sm = L0.small ? 0.65 : 1;
    shadow(ctx, 0, 0, 6 * s * sm, 2.5 * s * sm, 0.25);
    ctx.save(); ctx.scale(f * s * sm, s * sm);
    const sw = moving ? Math.sin(phase) * 2.5 : 0;
    if (L0.small) { ctx.strokeStyle = L0.dark; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-4, -6); ctx.quadraticCurveTo(-13, -4, -12, 4); ctx.stroke(); }
    if (moving) {
      // anda sobre os nós dos dedos
      ctx.strokeStyle = L0.dark; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(-4 + sw, 0); ctx.moveTo(4, -9); ctx.lineTo(5 - sw, 0); ctx.stroke();
      ctx.save(); ctx.translate(0, -8); ctx.rotate(-0.35); ell(ctx, 0, 0, 7, 5, L0.body); if (L0.silverback && a.sex === 'M' && !a.isBaby) ell(ctx, -2, -2.5, 4.5, 2.2, '#a8a8ac'); ctx.restore();
      ell(ctx, 7, -12, 3.6, 3.4, L0.body);
      ell(ctx, 8.5, -11.5, 2.3, 2.2, L0.face);
      ell(ctx, 8.8, -12.6, 0.5, 0.5, '#111');
      if (L0.maneP) ell(ctx, 6.5, -12, 4.6, 4.6, 'rgba(0,0,0,0)');
    } else {
      // sentado
      ctx.strokeStyle = L0.dark; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-3, -2); ctx.lineTo(3, 0); ctx.stroke();
      ell(ctx, 0, -8, 5.5, 7, L0.body);
      if (L0.silverback && a.sex === 'M' && !a.isBaby) ell(ctx, -1.8, -9, 3.4, 4.6, '#a8a8ac');
      ell(ctx, 0.5, -7, 3.4, 4.5, L0.light);
      ctx.beginPath(); ctx.moveTo(3, -11); ctx.lineTo(5 + (pose === 'eat' ? 1 : 0), -3 - (pose === 'eat' ? 8 : 0)); ctx.stroke();
      if (L0.maneP) ell(ctx, 1, -17, 5.6, 5.4, L0.dark);
      ell(ctx, 1, -17, 4, 3.8, L0.body);
      ell(ctx, 2.5, -16.5, 2.6, 2.4, L0.face);
      ell(ctx, 2.8, -17.5, 0.55, 0.55, '#111'); ell(ctx, 1.4, -17.5, 0.55, 0.55, '#111');
      if (!L0.small) { ell(ctx, -2.6, -17.5, 1.3, 1.5, L0.face); }
      if (pose === 'sleep') { ctx.fillStyle = L0.face; }
    }
    ctx.restore();
  }


  /* ---------- novos tipos de animais ---------- */
  function waterLine(ctx, w) { ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, -0.5, w, w * 0.22, 0, 0, Math.PI * 2); ctx.stroke(); }
  function drawRatite(ctx, L0, s, f, phase, moving, pose, a, t) {
    shadow(ctx, 0, 0, 7 * s, 2.6 * s, 0.25);
    ctx.save(); ctx.scale(f * s, s);
    const sw = moving ? Math.sin(phase) * 4 : 0;
    const sit = pose === 'sleep' || pose === 'rest';
    const legH = sit ? 2 : 15;
    ctx.strokeStyle = L0.neck; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    if (!sit) { ctx.beginPath(); ctx.moveTo(-1, -legH); ctx.lineTo(-1 + sw, 0); ctx.moveTo(1, -legH); ctx.lineTo(1 - sw, 0); ctx.stroke(); }
    const by = -legH - 4;
    ell(ctx, 0, by, 8, 5.5, L0.body);
    ell(ctx, -6, by - 1.5, 4, 3.5, L0.tail);
    const eat = pose === 'eat';
    const hx = eat ? 9 : 5, hy = eat ? -2 : by - 17;
    ctx.strokeStyle = L0.neck; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(5, by - 2); ctx.quadraticCurveTo(eat ? 9 : 5, eat ? by : by - 8, hx, hy); ctx.stroke();
    if (L0.collar) { ell(ctx, 5, by - 4, 2, 1.5, L0.collar); }
    ell(ctx, hx, hy, 2.1, 1.8, L0.neck);
    ctx.fillStyle = '#e6c27a'; ctx.beginPath(); ctx.moveTo(hx + 1.5, hy - 0.6); ctx.lineTo(hx + 4.5, hy + 0.3); ctx.lineTo(hx + 1.5, hy + 1); ctx.fill();
    ell(ctx, hx + 0.5, hy - 0.6, 0.6, 0.6, '#111');
    ctx.restore();
  }
  function drawKangaroo(ctx, L0, s, f, phase, moving, pose, a, t) {
    const hop = moving ? Math.abs(Math.sin(phase * 0.55)) * 8 : 0;
    shadow(ctx, 0, 0, 7 * s, 2.5 * s, moving ? 0.15 : 0.25);
    ctx.save(); ctx.scale(f * s, s); ctx.translate(0, -hop);
    const rest = pose === 'sleep' || pose === 'rest';
    ctx.fillStyle = L0.body; ctx.beginPath(); ctx.moveTo(-3, -4); ctx.quadraticCurveTo(-12, -2, -15, 1); ctx.lineTo(-3, -1); ctx.fill();
    ell(ctx, -1, -4, 6, 4, L0.body);
    ctx.strokeStyle = L0.dark; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(1, -1); ctx.lineTo(6, 0); ctx.stroke();
    ctx.save(); ctx.translate(1, rest ? -8 : -11); ctx.rotate(rest ? -1.1 : -0.35); ell(ctx, 0, 0, 4, 7.5, L0.body); ell(ctx, 1.2, 1, 2.2, 5, L0.light); ctx.restore();
    const hx = rest ? 7 : 4, hy = rest ? -11 : -19;
    ctx.strokeStyle = L0.body; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(4, -12); ctx.lineTo(7, -9); ctx.stroke();
    ell(ctx, hx, hy, 2.8, 2.2, L0.body);
    ell(ctx, hx + 2.5, hy + 0.6, 1.8, 1.3, L0.body);
    quad(ctx, [[hx - 1.5, hy - 1.5], [hx - 2.4, hy - 6], [hx - 0.2, hy - 2]], L0.body);
    quad(ctx, [[hx, hy - 1.5], [hx + 0.2, hy - 6], [hx + 1.4, hy - 1.8]], L0.dark);
    ell(ctx, hx + 0.8, hy - 0.6, 0.55, 0.55, '#111'); ell(ctx, hx + 4.2, hy + 0.5, 0.6, 0.5, '#111');
    ctx.restore();
  }
  function drawMeerkat(ctx, L0, s, f, phase, moving, pose, a, t) {
    shadow(ctx, 0, 0, 3.5 * s, 1.5 * s, 0.25);
    ctx.save(); ctx.scale(f * s, s);
    if (moving || pose === 'eat') {
      ctx.strokeStyle = L0.body; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-5, -3); ctx.lineTo(-10, -1); ctx.stroke();
      ell(ctx, 0, -3, 5.5, 2.6, L0.body);
      const sw = moving ? Math.sin(phase) * 1.5 : 0;
      ctx.strokeStyle = L0.dark; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(3, -1.5); ctx.lineTo(3 + sw, 0); ctx.moveTo(-3, -1.5); ctx.lineTo(-3 - sw, 0); ctx.stroke();
      ell(ctx, 5.5, -3.5, 2.2, 1.7, L0.body); ell(ctx, 6, -3.8, 0.7, 0.7, L0.dark);
    } else {
      // sentinela em pé
      ctx.strokeStyle = L0.body; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-1, -1); ctx.quadraticCurveTo(-6, 0, -7, -3); ctx.stroke();
      ell(ctx, 0, -6, 2.6, 6, L0.body); ell(ctx, 0.8, -5.5, 1.5, 4, L0.light);
      ctx.strokeStyle = L0.dark; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(1.6, -8); ctx.lineTo(2.6, -7); ctx.stroke();
      ell(ctx, 0.6, -13, 2.2, 2, L0.body); ell(ctx, 2.5, -12.6, 1.4, 1, L0.light);
      ell(ctx, 1.2, -13.4, 0.9, 0.8, L0.dark); ell(ctx, 3.6, -12.6, 0.4, 0.4, '#111');
    }
    ctx.restore();
  }
  function drawSloth(ctx, L0, s, f, phase, moving, pose, a, t) {
    shadow(ctx, 0, 0, 6 * s, 2.4 * s, 0.25);
    ctx.save(); ctx.scale(f * s, s);
    const sw = moving ? Math.sin(phase * 0.5) * 1.5 : 0;
    ctx.strokeStyle = L0.body; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(3, -7); ctx.lineTo(8 + sw, -1); ctx.moveTo(-3, -6); ctx.lineTo(-7 - sw, -1); ctx.stroke();
    ctx.strokeStyle = '#d8ccae'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(8 + sw, -1); ctx.lineTo(10 + sw, 0); ctx.moveTo(-7 - sw, -1); ctx.lineTo(-9 - sw, 0); ctx.stroke();
    ell(ctx, 0, -7, 6.5, 5.5, L0.body);
    ell(ctx, -1, -8, 4, 3.4, L0.light);
    ell(ctx, 4.5, -11, 3.6, 3.2, L0.body);
    ell(ctx, 5, -10.8, 2.6, 2.2, L0.face);
    ctx.strokeStyle = L0.dark; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(3.4, -11.6); ctx.lineTo(4.4, -10.8); ctx.moveTo(6.4, -11.6); ctx.lineTo(5.6, -10.8); ctx.stroke();
    ell(ctx, 5, -9.6, 0.7, 0.5, '#2a1a10');
    if (pose === 'sleep' || pose === 'rest') { ctx.strokeStyle = L0.face; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(5, -9.4, 1, 0.2, Math.PI - 0.2); ctx.stroke(); }
    ctx.restore();
  }
  function drawPenguin(ctx, L0, s, f, phase, moving, pose, a, t) {
    ctx.save(); ctx.scale(f * s, s);
    if (pose === 'swim') {
      waterLine(ctx, 7);
      ell(ctx, 0, -1, 6, 2, L0.body);
      ell(ctx, 5, -2.5, 2, 1.8, L0.body); ell(ctx, 5.4, -2.3, 1.2, 1, L0.light);
      ctx.fillStyle = '#e8a24a'; ctx.beginPath(); ctx.moveTo(6.6, -2.6); ctx.lineTo(8.6, -2.2); ctx.lineTo(6.6, -1.8); ctx.fill();
      ctx.restore(); return;
    }
    shadow(ctx, 0, 0, 3.6, 1.6, 0.25);
    const wob = moving ? Math.sin(phase * 1.2) * 0.18 : 0;
    ctx.rotate(wob);
    ell(ctx, -0.8, 0, 1.5, 0.8, '#e8a24a'); ell(ctx, 1.2, 0, 1.5, 0.8, '#e8a24a');
    ell(ctx, 0, -6, 3.6, 6, L0.body);
    ell(ctx, 1.2, -5.5, 2.4, 4.8, L0.light);
    ctx.strokeStyle = L0.body; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(1.5, -6.5, 2.2, -0.6, 0.6); ctx.stroke();
    ctx.fillStyle = L0.body; ctx.beginPath(); ctx.moveTo(-2.5, -9); ctx.lineTo(-4.2, -3 + (moving ? Math.sin(phase) : 0)); ctx.lineTo(-1.8, -5); ctx.fill();
    ell(ctx, 0.8, -12.5, 2.6, 2.4, L0.body);
    ctx.strokeStyle = L0.light; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(0.8, -12.3, 1.9, -1.3, 1.1); ctx.stroke();
    ell(ctx, 2, -13, 0.5, 0.5, '#fff');
    ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.moveTo(3, -12.8); ctx.lineTo(5.2, -12.2); ctx.lineTo(3, -11.6); ctx.fill();
    ctx.restore();
  }
  function drawSeal(ctx, L0, s, f, phase, moving, pose, a, t) {
    ctx.save(); ctx.scale(f * s, s);
    if (pose === 'swim') {
      waterLine(ctx, 10);
      ell(ctx, -2, -1, 9, 2.2, L0.body);
      ell(ctx, 7, -3.5, 3, 2.6, L0.body); ell(ctx, 9.4, -3, 1.6, 1.2, L0.light); ell(ctx, 7.6, -4.4, 0.6, 0.6, '#111');
      ctx.restore(); return;
    }
    shadow(ctx, 0, 0, 10, 3, 0.25);
    const lie = pose === 'sleep' || pose === 'rest';
    const sw = moving ? Math.sin(phase * 0.8) * 1.5 : 0;
    ctx.fillStyle = L0.dark; ctx.beginPath(); ctx.moveTo(-9, -2); ctx.lineTo(-14, 0 + sw * 0.3); ctx.lineTo(-13, -3); ctx.fill();
    ell(ctx, -3, -3, 9, 3.6, L0.body);
    ell(ctx, -3, -2, 7, 1.8, L0.light);
    const hx = lie ? 8 : 6, hy = lie ? -4 : -12;
    ctx.save(); ctx.translate(3, -5); ctx.rotate(lie ? -0.3 : -1.1); ell(ctx, 3, 0, 5, 3.4, L0.body); ctx.restore();
    if (L0.mane && !a.isBaby) ell(ctx, hx - 1.5, hy + 2.5, 4.4, 4.2, L0.dark);
    ctx.fillStyle = L0.dark; ctx.beginPath(); ctx.moveTo(4, -2); ctx.lineTo(8 + sw, 0); ctx.lineTo(5, 0); ctx.fill();
    ell(ctx, hx, hy, 2.8, 2.4, L0.body);
    ell(ctx, hx + 2.6, hy + 0.6, 1.8, 1.3, L0.light);
    ell(ctx, hx + 0.8, hy - 0.8, 0.55, 0.55, '#111'); ell(ctx, hx + 4.1, hy + 0.3, 0.5, 0.4, '#111');
    ctx.restore();
  }
  function drawTurtle(ctx, L0, s, f, phase, moving, pose, a, t) {
    ctx.save(); ctx.scale(f * s, s);
    const swim = pose === 'swim';
    const fl = moving ? Math.sin(phase * 0.7) * 2.5 : 0;
    if (swim) { waterLine(ctx, 9); ctx.globalAlpha = 0.75; } else shadow(ctx, 0, 0, 9, 3, 0.25);
    ctx.fillStyle = L0.body;
    [[5, -1, 1], [-5, -1, -1]].forEach(([px, py, k]) => { ctx.beginPath(); ctx.ellipse(px + 1, py + 1, 4, 1.5, k * (0.5 + fl * 0.1), 0, Math.PI * 2); ctx.fill(); });
    ell(ctx, 8.5, -2.5, 2.4, 1.9, L0.body); ell(ctx, 9.6, -3, 0.5, 0.5, '#111');
    ell(ctx, 0, -2.5, 8, 4, L0.shell);
    ctx.strokeStyle = L0.light; ctx.lineWidth = 0.7;
    for (let i = -4; i <= 4; i += 4) { ctx.beginPath(); ctx.ellipse(i, -3, 1.8, 1.3, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  function drawFish(ctx, L0, s, f, phase, moving, pose, a, t) {
    ctx.save(); ctx.scale(f * s, s);
    const kind = L0.kind;
    const len = kind === 'manatee' ? 13 : kind === 'shark' ? 14 : 12;
    const hgt = kind === 'manatee' ? 5 : 3.6;
    const body = () => {
      // corpo completo (centro em 0,0)
      if (kind === 'manatee') {
        ell(ctx, 0, 0, len, hgt, L0.body);
        ctx.fillStyle = L0.body; ctx.beginPath(); ctx.ellipse(-len - 2, 0, 3.5, 3, 0, 0, Math.PI * 2); ctx.fill();
        ell(ctx, len - 1, 0.5, 3.5, 3, L0.light);
        ell(ctx, len - 2, -1, 0.6, 0.6, '#222');
        return;
      }
      ell(ctx, 0, 0, len, hgt, L0.body);
      ell(ctx, 1, hgt * 0.4, len * 0.75, hgt * 0.45, L0.light);
      quad(ctx, [[-len + 1, -0.5], [-len - 5, -4], [-len - 3, 0], [-len - 5, 4], [-len + 1, 0.5]], L0.dark);
      if (kind === 'dolphin') {
        quad(ctx, [[-2, -hgt + 0.5], [-5, -hgt - 4], [2, -hgt + 0.5]], L0.dark);
        ctx.fillStyle = L0.body; ctx.beginPath(); ctx.ellipse(len + (L0.beak || 4) * 0.5, 0.8, (L0.beak || 4) * 0.6, 1.2, 0, 0, Math.PI * 2); ctx.fill();
        ell(ctx, len - 2, -0.8, 0.6, 0.6, '#111');
      } else {
        quad(ctx, [[-1, -hgt + 0.5], [-3, -hgt - 3.5], [2, -hgt + 0.5]], L0.dark);
        quad(ctx, [[-6, -hgt + 1], [-7.5, -hgt - 2], [-5, -hgt + 1]], L0.dark);
        ell(ctx, len - 2, -0.6, 0.5, 0.5, '#111');
        ctx.strokeStyle = L0.dark; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(len - 1, 1.6); ctx.lineTo(len + 1, 1.6); ctx.stroke();
      }
    };
    // salto (golfinhos e botos brincando)
    if (a.state === 'PLAY' && L0.kind === 'dolphin') {
      const jp = ((t * 0.9 + a.id * 0.37) % 2);
      if (jp < 1) {
        const hgtJ = Math.sin(jp * Math.PI) * 22;
        ctx.save(); ctx.translate((jp - 0.5) * 16, -hgtJ - 2); ctx.rotate((jp - 0.5) * 1.6); body(); ctx.restore();
        if (jp < 0.12 || jp > 0.88) { ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse((jp < 0.5 ? -8 : 8), 0, 6, 1.6, 0, 0, Math.PI * 2); ctx.stroke(); }
        ctx.restore(); return;
      }
    }
    // sob a água: corpo translúcido + parte de cima (barbatana) sobre a linha d'água
    const depth = kind === 'shark' ? 4 : kind === 'manatee' ? 2.5 : 3;
    const bob = Math.sin(t * 1.5 + a.id) * 0.8;
    ctx.save(); ctx.translate(0, depth + bob); ctx.globalAlpha = 0.45; body(); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(-40, -40, 80, 39.5); ctx.clip(); ctx.translate(0, depth + bob); body(); ctx.restore();
    waterLine(ctx, len * 0.8);
    ctx.restore();
  }

  ZM.Sprites = S;
})(window.ZM);
