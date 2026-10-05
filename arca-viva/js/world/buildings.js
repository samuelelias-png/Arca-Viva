/* =========================================================
   Instância de objeto no mapa (prédio, loja, item, planta)
   ========================================================= */
(function (ZM) {
  'use strict';

  const WEARS = ['shop', 'toilet', 'feeder', 'trough', 'entrance', 'lab', 'clinic', 'info', 'educenter', 'shelter', 'filter', 'icemaker', 'workshop', 'warehouse', 'staffroom', 'aquaview'];

  class ZooObject {
    constructor(type, x, y, id) {
      const d = ZM.OBJECTS[type];
      this.id = id || ZM.util.uid();
      this.type = type; this.x = x; this.y = y; this.w = d.w; this.h = d.h;
      this.access = [];
      if (WEARS.includes(d.kind)) this.condition = 100;
      if (d.kind === 'feeder') { this.food = 0; this.foodType = null; this.foodSetting = 'auto'; }
      if (d.kind === 'trough') this.water = 100;
      if (d.kind === 'bin') this.fill = 0;
      if (d.kind === 'shop') { this.price = d.price; this.sales = 0; this.revenue = 0; }
      this.broken = false;
    }
    get def() { return ZM.OBJECTS[this.type]; }
    get blocks() { return !!this.def.blocks; }
    *tiles() { for (let y = this.y; y < this.y + this.h; y++) for (let x = this.x; x < this.x + this.w; x++) yield [x, y]; }
    toJSON() {
      const o = { id: this.id, type: this.type, x: this.x, y: this.y };
      ['condition', 'food', 'foodType', 'foodSetting', 'water', 'fill', 'price', 'sales', 'revenue', 'broken', 'gaveUp', 'served', 'lostReasons'].forEach((k) => { if (this[k] != null) o[k] = this[k]; });
      return o;
    }
    static fromJSON(d) { const o = new ZooObject(d.type, d.x, d.y, d.id); Object.assign(o, d); o.access = []; return o; }
  }
  ZM.ZooObject = ZooObject;
})(window.ZM);
