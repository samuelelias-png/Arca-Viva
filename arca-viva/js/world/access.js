/* =========================================================
   Acesso: rede de caminhos ligada à entrada (visitantes) e
   área alcançável pela equipe (que também anda na grama)
   ========================================================= */
(function (ZM) {
  'use strict';

  ZM.Access = {
    /* recalcula zoo.connected (caminhos ligados à entrada) e zoo.staffReach */
    compute(zoo) {
      const m = zoo.map, N = m.N, W = m.w;
      if (!zoo.connected || zoo.connected.length !== N) { zoo.connected = new Uint8Array(N); zoo.staffReach = new Uint8Array(N); }
      const conn = zoo.connected, sr = zoo.staffReach;
      conn.fill(0); sr.fill(0);
      const q = new Int32Array(N);
      const dx = [1, -1, 0, 0], dy = [0, 0, 1, -1];
      // --- visitantes: BFS pelos caminhos a partir dos acessos da entrada
      const ent = zoo.objectsOfKind('entrance')[0];
      let qh = 0, qt = 0;
      if (ent) (ent.accessRaw || []).forEach((i) => { if (!conn[i]) { conn[i] = 1; q[qt++] = i; } });
      while (qh < qt) {
        const a = q[qh++], ax = a % W, ay = (a / W) | 0;
        for (let k = 0; k < 4; k++) {
          const x = ax + dx[k], y = ay + dy[k];
          if (x < 0 || y < 0 || x >= W || y >= m.h) continue;
          const b = y * W + x;
          if (conn[b] || !m.path[b]) continue;
          conn[b] = 1; q[qt++] = b;
        }
      }
      // --- equipe: anda fora dos recintos, evita água e construções que bloqueiam
      const walk = (i) => {
        if (m.enc[i] || ZM.isWater(m.terrain[i])) return false;
        const o = m.obj[i];
        if (o >= 0) { const ob = zoo.objects.get(o); if (ob && ob.blocks) return false; }
        return true;
      };
      qh = 0; qt = 0;
      const starts = ent ? (ent.accessRaw || []).slice() : [];
      if (!starts.length && zoo.pathTiles.length) starts.push(zoo.pathTiles[0]);
      starts.forEach((i) => { if (walk(i) && !sr[i]) { sr[i] = 1; q[qt++] = i; } });
      while (qh < qt) {
        const a = q[qh++], ax = a % W, ay = (a / W) | 0;
        for (let k = 0; k < 4; k++) {
          const x = ax + dx[k], y = ay + dy[k];
          if (x < 0 || y < 0 || x >= W || y >= m.h) continue;
          const b = y * W + x;
          if (sr[b] || !walk(b)) continue;
          sr[b] = 1; q[qt++] = b;
        }
      }
      zoo.accessVersion = (zoo.accessVersion || 0) + 1;
    },
  };
})(window.ZM);
