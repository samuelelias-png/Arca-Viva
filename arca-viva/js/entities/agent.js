/* =========================================================
   Agente base: posição contínua + seguir caminho em grade
   ========================================================= */
(function (ZM) {
  'use strict';
  const U = ZM.util;

  class Agent {
    constructor(x, y) {
      this.id = U.uid();
      this.x = x + 0.5; this.y = y + 0.5;
      this.path = null; this.pi = 0;
      this.speed = 1;
      this.facing = 1;
      this.phase = Math.random() * 10;
      this.moving = false;
      this.thinkT = Math.random() * 0.8;
      this.ox = U.rand(-0.22, 0.22); this.oy = U.rand(-0.22, 0.22); // desvio visual
    }
    tileIdx(map) { return map.idx(Math.floor(this.x), Math.floor(this.y)); }
    tx() { return Math.floor(this.x); }
    ty() { return Math.floor(this.y); }
    setPath(p) {
      this.path = p && p.length ? p : null;
      this.pi = this.path && this.path.length > 1 ? 1 : 0;
      if (this.path && this.path.length === 1) { this.path = null; }
    }
    /* Move ao longo do caminho; retorna true quando chegou ao fim */
    step(dt, map, mult = 1) {
      if (!this.path) { this.moving = false; return true; }
      const target = this.path[this.pi];
      const tx = (target % map.w) + 0.5, ty = ((target / map.w) | 0) + 0.5;
      const dx = tx - this.x, dy = ty - this.y;
      const d = Math.hypot(dx, dy);
      const sp = this.speed * mult * dt;
      this.moving = true;
      this.phase += dt * 9 * this.speed * mult;
      const sdx = dx - dy; // direção na tela
      if (Math.abs(sdx) > 0.01) this.facing = sdx > 0 ? 1 : -1;
      if (d <= sp) {
        this.x = tx; this.y = ty;
        this.pi++;
        if (this.onTile) this.onTile(target);
        if (!this.path) { this.moving = false; return false; } // interrompido por onTile
        if (this.pi >= this.path.length) { this.path = null; this.moving = false; return true; }
      } else {
        this.x += (dx / d) * sp; this.y += (dy / d) * sp;
      }
      return false;
    }
  }
  ZM.Agent = Agent;
})(window.ZM);
