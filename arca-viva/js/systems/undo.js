/* =========================================================
   Desfazer construções: cada ação registra como voltar atrás.
   Arrastos (caminhos, terreno, demolição) viram uma única entrada.
   ========================================================= */
(function (ZM) {
  'use strict';

  class UndoStack {
    constructor(zoo) { this.zoo = zoo; this.stack = []; this.cur = null; this.enabled = true; }
    /* registra uma função que desfaz a ação; dentro de group() vira parte do grupo */
    push(label, fn) {
      if (!this.enabled) return;
      if (this.cur) { this.cur.fns.push(fn); if (!this.cur.label) this.cur.label = label; return; }
      this.stack.push({ label, fns: [fn], day: this.zoo.day });
      if (this.stack.length > 40) this.stack.shift();
      ZM.Events.emit('undo');
    }
    group(label, fn) {
      const outer = !this.cur;
      if (outer) this.cur = { label, fns: [], day: this.zoo.day };
      try { return fn(); } finally {
        if (outer) {
          const g = this.cur; this.cur = null;
          if (g.fns.length) { this.stack.push(g); if (this.stack.length > 40) this.stack.shift(); ZM.Events.emit('undo'); }
        }
      }
    }
    peek() { return this.stack[this.stack.length - 1] || null; }
    undo() {
      const e = this.stack.pop();
      if (!e) return { ok: false, reason: 'Nada para desfazer' };
      this.enabled = false;
      try { for (let i = e.fns.length - 1; i >= 0; i--) e.fns[i](); }
      catch (err) { console.error(err); }
      finally { this.enabled = true; }
      // cada ação desfeita marca no mapa a região que mudou (o cache do terreno só refaz ali)
      this.zoo.refreshAll();
      ZM.Events.emit('undo');
      return { ok: true, label: e.label };
    }
    clear() { this.stack = []; this.cur = null; ZM.Events.emit('undo'); }
  }
  ZM.UndoStack = UndoStack;
})(window.ZM);
