/* =========================================================
   Áudio: efeitos sintetizados (placeholders) + ambiente.
   Estrutura pronta para arquivos reais: ZM.Audio.register(nome, url)
   ========================================================= */
(function (ZM) {
  'use strict';

  const A = {
    ctx: null, master: null, muted: false, music: false, files: {}, buffers: {},
    ambientT: 0,
    init() {
      if (this.ctx) return;
      try {
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) return;
        this.ctx = new C();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.35;
        this.master.connect(this.ctx.destination);
      } catch (e) { this.ctx = null; }
    },
    /* registra um arquivo de som que substitui o placeholder sintetizado */
    register(name, url) {
      this.files[name] = url;
      if (!this.ctx) return;
      fetch(url).then((r) => r.arrayBuffer()).then((b) => this.ctx.decodeAudioData(b)).then((buf) => (this.buffers[name] = buf)).catch(() => {});
    },
    tone(freq, dur, type = 'sine', vol = 0.3, slide = 0, delay = 0) {
      const c = this.ctx; if (!c) return;
      const t = c.currentTime + delay;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.05);
    },
    noise(dur, vol = 0.2, filter = 1200) {
      const c = this.ctx; if (!c) return;
      const len = Math.floor(c.sampleRate * dur);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const s = c.createBufferSource(); s.buffer = buf;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter;
      const g = c.createGain(); g.gain.value = vol;
      s.connect(f); f.connect(g); g.connect(this.master); s.start();
    },
    play(name) {
      if (this.muted || !this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      if (this.buffers[name]) {
        const s = this.ctx.createBufferSource(); s.buffer = this.buffers[name]; s.connect(this.master); s.start(); return;
      }
      switch (name) {
        case 'click': this.tone(660, 0.06, 'triangle', 0.15); break;
        case 'build': this.noise(0.12, 0.25, 900); this.tone(180, 0.12, 'square', 0.08, -60); break;
        case 'cash': this.tone(1320, 0.08, 'triangle', 0.15); this.tone(1760, 0.12, 'triangle', 0.15, 0, 0.07); break;
        case 'error': this.tone(200, 0.18, 'sawtooth', 0.12, -80); break;
        case 'demolish': this.noise(0.3, 0.3, 600); break;
        case 'alert': this.tone(880, 0.12, 'square', 0.1); this.tone(660, 0.16, 'square', 0.1, 0, 0.13); break;
        case 'danger': for (let i = 0; i < 3; i++) { this.tone(990, 0.12, 'square', 0.12, 0, i * 0.25); this.tone(740, 0.12, 'square', 0.12, 0, i * 0.25 + 0.12); } break;
        case 'birth': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.18, 0, i * 0.1)); break;
        case 'goal': [784, 988, 1175].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.18, 0, i * 0.09)); break;
        case 'unlock': [440, 554, 659, 880].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.16, 0, i * 0.08)); break;
        case 'animal': this.tone(300 + Math.random() * 200, 0.25, 'sawtooth', 0.05, -120); break;
        case 'bird': this.tone(2200 + Math.random() * 800, 0.07, 'sine', 0.05, 600); this.tone(2600 + Math.random() * 600, 0.06, 'sine', 0.04, -500, 0.09); break;
      }
    },
    /* ambiente conforme o que a câmera mostra: água, multidão, vozes dos animais visíveis, noite */
    ambient(dt, zoo) {
      if (this.muted || !this.ctx || !zoo) return;
      this.ambientT -= dt;
      if (this.ambientT > 0) return;
      this.ambientT = 1.6 + Math.random() * 2.6;
      const R = ZM.game && ZM.game.renderer, vb = R && R.vb;
      const h = zoo.hour, night = h < 6 || h >= 20;
      if (zoo.weather.rain) this.noise(1.5, 0.05, 2500);
      if (!vb) { if (h > 5 && h < 19 && Math.random() < 0.7) this.play('bird'); return; }
      const m = zoo.map, near = Math.min(1.4, Math.max(0.35, R.cam.zoom / 1.2));
      // amostra o terreno visível
      let water = 0, n = 0;
      for (let y = vb.minY; y <= vb.maxY; y += 3) for (let x = vb.minX; x <= vb.maxX; x += 3) { n++; if (ZM.isWater(m.terrain[m.idx(x, y)])) water++; }
      const inV = (a) => a.x >= vb.minX && a.x <= vb.maxX + 1 && a.y >= vb.minY && a.y <= vb.maxY + 1;
      const vis = zoo.visitors.filter(inV).length;
      const animals = zoo.animals.filter((a) => inV(a) && !a.inShelter);
      if (n && water / n > 0.12) this.water(0.04 * near * Math.min(1, water / n * 3));
      if (vis > 4) this.crowd(Math.min(0.06, 0.008 * Math.sqrt(vis)) * near);
      if (animals.length && Math.random() < 0.55) this.voice(animals[Math.floor(Math.random() * animals.length)], near);
      if (night && !vis && Math.random() < 0.6) this.crickets(near);
      else if (!night && h > 5 && Math.random() < 0.5) this.play('bird');
    },
    water(vol) { this.noise(2.2, vol, 520); },
    crowd(vol) {
      const c = this.ctx; if (!c) return;
      for (let k = 0; k < 3; k++) this.tone(180 + Math.random() * 140, 0.35 + Math.random() * 0.3, 'triangle', vol * 0.5, (Math.random() - 0.5) * 60, k * 0.18);
      this.noise(0.9, vol * 0.6, 900);
    },
    crickets(near) { for (let k = 0; k < 4; k++) this.tone(4200 + Math.random() * 300, 0.035, 'square', 0.012 * near, 0, k * 0.07); },
    /* voz aproximada por tipo de animal (placeholder sintetizado) */
    voice(a, near) {
      const sp = a.sp, v = 0.06 * near;
      if (a.state === 'HOWL') { this.tone(420, 1.1, 'sine', v, 260); this.tone(680, 0.9, 'sine', v * 0.6, -200, 1.0); return; }
      if (a.state === 'SLEEP') return;
      if (sp.bird) { this.tone(1500 + Math.random() * 900, 0.09, 'sine', v * 0.7, 500); this.tone(1800 + Math.random() * 700, 0.08, 'sine', v * 0.6, -400, 0.11); return; }
      if (sp.primate) { [0, 0.16, 0.3].forEach((d, i) => this.tone(380 + i * 120, 0.12, 'triangle', v * 0.8, 160, d)); return; }
      if (sp.predator && sp.size > 1) { this.tone(110 + Math.random() * 30, 0.7, 'sawtooth', v * 0.9, -40); this.noise(0.5, v * 0.5, 300); return; }
      if (sp.size >= 1.6) { this.tone(160, 0.8, 'sawtooth', v * 0.7, 220); return; }
      if (sp.swims && a.state === 'SWIM') { this.noise(0.4, v * 0.6, 700); return; }
      this.play('animal');
    },
    toggleMute() { this.muted = !this.muted; return this.muted; },
  };
  ZM.Audio = A;
})(window.ZM);
