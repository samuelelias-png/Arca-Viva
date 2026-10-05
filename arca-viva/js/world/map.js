/* =========================================================
   Mapa em grade (arrays tipados) + Pathfinder A*
   ========================================================= */
(function (ZM) {
  'use strict';
  const T = ZM.T;

  class ZooMap {
    constructor(w, h) {
      this.w = w; this.h = h;
      const N = w * h;
      this.N = N;
      this.terrain = new Uint8Array(N);
      this.path = new Uint8Array(N);
      this.enc = new Uint16Array(N);       // id do recinto (0 = nenhum)
      this.obj = new Int32Array(N).fill(-1); // id do objeto que ocupa o tile
      this.litter = new Uint8Array(N);      // lixo no caminho (0-10)
      this.closed = new Uint8Array(N);      // área isolada (fuga)
      this.version = 1;                     // muda a cada alteração do mapa
      this.dirty = 'all';                   // região que o cache de terreno precisa redesenhar
    }
    idx(x, y) { return y * this.w + x; }
    inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    xy(i) { return [i % this.w, (i / this.w) | 0]; }
    /* marca alteração; com coordenadas, só aquela região do cache é refeita */
    touch(x0, y0, x1, y1) {
      this.version++;
      if (x0 == null) { this.dirty = 'all'; return; }
      if (this.dirty === 'all') return;
      if (x1 == null) { x1 = x0; y1 = y0; }
      const d = this.dirty;
      this.dirty = d ? { x0: Math.min(d.x0, x0), y0: Math.min(d.y0, y0), x1: Math.max(d.x1, x1), y1: Math.max(d.y1, y1) } : { x0, y0, x1, y1 };
    }
    /* marca os tiles (índices) alterados */
    touchTiles(list) {
      if (!list.length) return;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const i of list) { const x = i % this.w, y = (i / this.w) | 0; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
      this.touch(x0, y0, x1, y1);
    }

    generate() {
      const { w, h } = this;
      this.terrain.fill(T.GRASS);
      // manchas de terra
      for (let k = 0; k < 8; k++) {
        const cx = ZM.util.randInt(4, w - 5), cy = ZM.util.randInt(4, h - 5), r = ZM.util.rand(1.5, 3.5);
        for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
          const tx = cx + x, ty = cy + y;
          if (this.inb(tx, ty) && Math.hypot(x, y) < r + ZM.util.hash(tx, ty, 3) * 1.2) this.terrain[this.idx(tx, ty)] = T.DIRT;
        }
      }
      // um lago natural
      const lx = Math.floor(w * 0.7), ly = Math.floor(h * 0.3);
      for (let y = -4; y <= 4; y++) for (let x = -5; x <= 5; x++) {
        const tx = lx + x, ty = ly + y;
        if (!this.inb(tx, ty)) continue;
        const d = Math.hypot(x / 1.3, y);
        if (d < 2.8 + ZM.util.hash(tx, ty, 9)) this.terrain[this.idx(tx, ty)] = T.WATER;
        else if (d < 3.6 + ZM.util.hash(tx, ty, 9)) this.terrain[this.idx(tx, ty)] = T.SAND;
      }
      // bosque
      const fx = Math.floor(w * 0.22), fy = Math.floor(h * 0.75);
      for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) {
        const tx = fx + x, ty = fy + y;
        if (this.inb(tx, ty) && Math.hypot(x, y) < 4 + ZM.util.hash(tx, ty, 5) * 1.5) this.terrain[this.idx(tx, ty)] = T.FOREST;
      }
      this.touch();
    }

    toJSON() {
      const enc = (a) => Array.from(a);
      return { w: this.w, h: this.h, terrain: rle(this.terrain), path: rle(this.path), enc: rle(this.enc), litter: rle(this.litter) };
      function rle(a) { // compressão run-length simples
        const out = []; let prev = a[0], n = 1;
        for (let i = 1; i < a.length; i++) { if (a[i] === prev) n++; else { out.push(prev, n); prev = a[i]; n = 1; } }
        out.push(prev, n); return out;
      }
    }
    static fromJSON(d) {
      const m = new ZooMap(d.w, d.h);
      const un = (arr, target) => { let p = 0; for (let i = 0; i < arr.length; i += 2) { target.fill(arr[i], p, p + arr[i + 1]); p += arr[i + 1]; } };
      un(d.terrain, m.terrain); un(d.path, m.path); un(d.enc, m.enc); un(d.litter, m.litter);
      return m;
    }
  }

  /* ---------- A* com heap binário e arrays reutilizáveis ---------- */
  class Pathfinder {
    constructor(map) {
      this.map = map;
      const N = map.N;
      this.g = new Float32Array(N);
      this.came = new Int32Array(N);
      this.stamp = new Uint32Array(N);
      this.closedStamp = new Uint32Array(N);
      this.cur = 1;
      this.heap = new Int32Array(N * 4);
      this.hf = new Float32Array(N * 4);
      this.budget = 0;
    }
    /* canStep(a, b) -> custo (>0) ou 0 se bloqueado */
    find(start, goal, canStep, maxNodes = 4000) {
      if (start === goal) return [goal];
      const m = this.map, W = m.w;
      this.cur++;
      const cur = this.cur, g = this.g, came = this.came, stamp = this.stamp, cl = this.closedStamp;
      const heap = this.heap, hf = this.hf;
      let hs = 0;
      const gx = goal % W, gy = (goal / W) | 0;
      const push = (n, f) => {
        let i = hs++; heap[i] = n; hf[i] = f;
        while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= hf[i]) break; swap(i, p); i = p; }
      };
      const swap = (a, b) => { const t = heap[a]; heap[a] = heap[b]; heap[b] = t; const u = hf[a]; hf[a] = hf[b]; hf[b] = u; };
      const pop = () => {
        const top = heap[0]; hs--;
        if (hs > 0) {
          heap[0] = heap[hs]; hf[0] = hf[hs];
          let i = 0;
          for (;;) {
            const l = 2 * i + 1, r = l + 1; let s = i;
            if (l < hs && hf[l] < hf[s]) s = l;
            if (r < hs && hf[r] < hf[s]) s = r;
            if (s === i) break; swap(i, s); i = s;
          }
        }
        return top;
      };
      stamp[start] = cur; g[start] = 0; came[start] = -1;
      push(start, 0);
      let expanded = 0;
      const dx = [1, -1, 0, 0], dy = [0, 0, 1, -1];
      while (hs > 0) {
        const n = pop();
        if (cl[n] === cur) continue;
        cl[n] = cur;
        if (n === goal) {
          const out = []; let c = n;
          while (c !== -1) { out.push(c); c = came[c]; }
          out.reverse(); return out;
        }
        if (++expanded > maxNodes || hs > heap.length - 8) return null;
        const nx = n % W, ny = (n / W) | 0;
        for (let k = 0; k < 4; k++) {
          const x = nx + dx[k], y = ny + dy[k];
          if (x < 0 || y < 0 || x >= W || y >= m.h) continue;
          const b = y * W + x;
          if (cl[b] === cur) continue;
          const c = canStep(n, b);
          if (!c) continue;
          const ng = g[n] + c;
          if (stamp[b] !== cur || ng < g[b]) {
            stamp[b] = cur; g[b] = ng; came[b] = n;
            push(b, ng + Math.abs(x - gx) + Math.abs(y - gy));
          }
        }
      }
      return null;
    }
    /* Busca em largura até o tile mais próximo que satisfaça pred (útil para "procurar comida") */
    nearest(start, pred, canStep, maxNodes = 3000) {
      const m = this.map, W = m.w;
      this.cur++;
      const cur = this.cur, stamp = this.stamp, came = this.came;
      const q = this.heap; let qh = 0, qt = 0;
      q[qt++] = start; stamp[start] = cur; came[start] = -1;
      const dx = [1, -1, 0, 0], dy = [0, 0, 1, -1];
      let n = 0;
      while (qh < qt && n++ < maxNodes) {
        const a = q[qh++];
        if (pred(a)) {
          const out = []; let c = a;
          while (c !== -1) { out.push(c); c = came[c]; }
          return out.reverse();
        }
        const ax = a % W, ay = (a / W) | 0;
        for (let k = 0; k < 4; k++) {
          const x = ax + dx[k], y = ay + dy[k];
          if (x < 0 || y < 0 || x >= W || y >= m.h) continue;
          const b = y * W + x;
          if (stamp[b] === cur || !canStep(a, b)) continue;
          stamp[b] = cur; came[b] = a; q[qt++] = b;
        }
      }
      return null;
    }
  }

  ZM.ZooMap = ZooMap;
  ZM.Pathfinder = Pathfinder;
})(window.ZM);
