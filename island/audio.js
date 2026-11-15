// 소리: 파도·강·폭포·바람·새·벌레·갈매기·소방울·발소리·문 — 전부 브라우저에서 합성
(function () {
  const ISL = window.ISL;
  const A = {
    ctx: null, on: true, master: null, outdoor: null, muffle: null, layers: {}, inside: false,
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
      const c = this.ctx;
      this.master = c.createGain(); this.master.gain.value = .9; this.master.connect(c.destination);
      // 실내에 들어가면 바깥 소리가 먹먹해짐
      this.muffle = c.createBiquadFilter(); this.muffle.type = 'lowpass'; this.muffle.frequency.value = 20000; this.muffle.connect(this.master);
      this.outdoor = c.createGain(); this.outdoor.connect(this.muffle);
      const len = c.sampleRate * 4, white = c.createBuffer(1, len, c.sampleRate), brown = c.createBuffer(1, len, c.sampleRate), pink = c.createBuffer(1, len, c.sampleRate);
      const w = white.getChannelData(0), b = brown.getChannelData(0), p = pink.getChannelData(0);
      let last = 0, b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < len; i++) {
        const r = Math.random() * 2 - 1; w[i] = r; last = (last + .02 * r) / 1.02; b[i] = last * 3.5;
        b0 = .99765 * b0 + r * .099; b1 = .963 * b1 + r * .2965; b2 = .57 * b2 + r * 1.0526; p[i] = (b0 + b1 + b2 + r * .1848) * .18;
      }
      this.buf = { white, brown, pink };
      const src = (buf) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = Math.random(); s.start(0, Math.random() * 3); return s; };
      const chain = (buf, type, f, q, dest) => { const s = src(buf), fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(fl).connect(g).connect(dest || this.outdoor); return { g, fl }; };
      // 파도: 묵직한 철썩임 + 빠져나가는 쏴아 소리
      this.layers.surf = chain(brown, 'lowpass', 520, .5);
      this.layers.wash = chain(pink, 'bandpass', 2400, .6);
      // 강: 졸졸 흐르는 소리 (빠른 진폭 변조로 거품 소리)
      const river = chain(white, 'bandpass', 1300, .9);
      const babble = c.createGain(); babble.gain.value = .5; river.g.disconnect(); river.fl.disconnect(); river.fl.connect(babble).connect(river.g).connect(this.outdoor);
      for (const [f, d] of [[6.3, .25], [11.7, .18], [17.1, .1]]) { const o = c.createOscillator(); o.frequency.value = f; const og = c.createGain(); og.gain.value = d; o.connect(og).connect(babble.gain); o.start(); }
      this.layers.river = river;
      this.layers.fall = chain(pink, 'lowpass', 1600, .3);
      this.layers.wind = chain(brown, 'bandpass', 380, .4);
      this.layers.fire = chain(brown, 'lowpass', 900, .5, this.master);
      // 밤 귀뚜라미: 고음 + 빠른 맥동
      const cr = c.createOscillator(); cr.frequency.value = 4600; const crAm = c.createGain(); crAm.gain.value = 0; const lfo = c.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 28; const lg = c.createGain(); lg.gain.value = .5;
      lfo.connect(lg).connect(crAm.gain); const crG = c.createGain(); crG.gain.value = 0; cr.connect(crAm).connect(crG).connect(this.outdoor); cr.start(); lfo.start();
      this.layers.cricket = { g: crG, am: crAm };
      this.t = 0; this.surfPhase = 0;
    },
    set(name, v, tc = .4) { const L = this.layers[name]; if (L) L.g.gain.setTargetAtTime(this.on ? v : 0, this.ctx.currentTime, tc); },
    // 매 프레임: 주변 환경에 맞춰 각 층의 크기 조절
    update(dt, env) {
      if (!this.ctx) return;
      this.t += dt;
      // 파도는 약 7초 주기로 밀려왔다 빠져나감
      this.surfPhase += dt / (6.5 + Math.sin(this.t * .1));
      const ph = this.surfPhase % 1, crash = Math.pow(Math.max(0, Math.sin(ph * Math.PI * 2)), 3), ebb = Math.pow(Math.max(0, Math.sin((ph - .25) * Math.PI * 2)), 2);
      const sea = env.sea;
      this.set('surf', sea * (.05 + .55 * crash), .15); this.set('wash', sea * (.02 + .22 * ebb), .2);
      this.set('river', env.river * .55); this.set('fall', env.fall * .9);
      this.set('wind', .05 + env.wind * .25);
      this.set('fire', env.fire * (.12 + Math.random() * .1), .05);
      if (this.layers.cricket) this.layers.cricket.am.gain.setTargetAtTime(this.on ? env.night * env.land * .5 : 0, this.ctx.currentTime, .5);
      if (this.layers.cricket) this.layers.cricket.g.gain.setTargetAtTime(this.on ? .012 * (Math.sin(this.t * .7) > -.3 ? 1 : 0) : 0, this.ctx.currentTime, .05);
      // 가끔 들리는 소리들
      if (this.on) {
        if (env.day > .5 && env.land > .3 && !this.inside && Math.random() < dt * .35) { this.bird(); if (Math.random() < .5) setTimeout(() => this.bird(), 160); }
        if (env.day > .5 && env.sea > .25 && Math.random() < dt * .12) this.gull();
        if (env.cows > 0 && Math.random() < dt * .5 * env.cows) this.cowbell(env.cows);
        if (env.fire > 0 && Math.random() < dt * 9 * env.fire) this.crackle();
        if (env.clock && Math.random() < dt * 1.0) { if (!this._tick || this.t - this._tick > .98) { this._tick = this.t; this.tick(); } }
      }
    },
    setInside(v) {
      if (!this.ctx) return; this.inside = v; const t = this.ctx.currentTime;
      this.muffle.frequency.setTargetAtTime(v ? 450 : 20000, t, .2); this.outdoor.gain.setTargetAtTime(v ? .45 : 1, t, .2);
    },
    tone(f, type, dur, vol, dest, bend) {
      const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
      if (bend) o.frequency.exponentialRampToValueAtTime(bend, t + dur);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(g).connect(dest || this.outdoor); o.start(t); o.stop(t + dur + .05);
    },
    noise(dur, type, f, q, vol, dest, buf) {
      const c = this.ctx, t = c.currentTime, s = c.createBufferSource(); s.buffer = buf || this.buf.white; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur); s.connect(fl).connect(g).connect(dest || this.outdoor); s.start(t, Math.random() * 3); s.stop(t + dur + .05);
    },
    chime(steps, vol = .1) {
      if (!this.ctx || !this.on) return; const c = this.ctx;
      steps.forEach((st, k) => setTimeout(() => { const f = 523.25 * Math.pow(2, st / 12); this.tone(f, 'sine', 1.5, vol, this.master); this.tone(f * 2.01, 'sine', 1, vol / 2, this.master); }, k * 120));
    },
    bird() { const f = 2200 + Math.random() * 1600; this.tone(f, 'sine', .18, .02, this.outdoor, f * (1.2 + Math.random() * .5)); },
    gull() { const c = this.ctx; for (let k = 0; k < 3; k++) setTimeout(() => { this.tone(1500 - k * 60, 'sawtooth', .35, .008, this.outdoor, 850); this.tone(1520 - k * 60, 'triangle', .35, .012, this.outdoor, 900); }, k * 260); },
    cowbell(v) { const f = 540 + Math.random() * 80; [1, 1.48, 2.37, 3.1].forEach((m, i) => this.tone(f * m, 'triangle', .6 - i * .1, .02 * v / (i + 1))); },
    crackle() { this.noise(.03 + Math.random() * .04, 'highpass', 2500, .5, .05 + Math.random() * .05, this.master); },
    tick() { this.noise(.02, 'bandpass', 3800, 4, .05, this.master); },
    step(surface) {
      if (!this.ctx || !this.on) return;
      const dest = this.inside ? this.master : this.outdoor;
      if (surface === 'water') { this.noise(.25, 'bandpass', 900, .7, .12, dest); this.noise(.12, 'highpass', 3000, .5, .04, dest); }
      else if (surface === 'wood') this.noise(.08, 'bandpass', 380, 1.2, .2, dest, this.buf.brown);
      else if (surface === 'stone') this.noise(.05, 'bandpass', 1900, 1.5, .09, dest);
      else if (surface === 'snow') this.noise(.14, 'lowpass', 1300, .5, .1, dest);
      else this.noise(.09, 'bandpass', 1100, .5, .06, dest);
    },
    splash(big) { if (!this.ctx || !this.on) return; this.noise(big ? .6 : .3, 'lowpass', 1800, .4, big ? .35 : .15); this.noise(big ? .4 : .2, 'highpass', 2500, .5, .08); },
    door(open, sliding) {
      if (!this.ctx || !this.on) return; const d = this.master;
      if (sliding) { this.noise(.45, 'bandpass', 1500, .6, .06, d); return; }
      if (open) { this.tone(420, 'sawtooth', .5, .012, d, 310); this.noise(.1, 'bandpass', 600, 1, .06, d, this.buf.brown); }
      else { this.noise(.18, 'lowpass', 400, .7, .5, d, this.buf.brown); this.noise(.05, 'bandpass', 2400, 2, .05, d); }
    },
    melody(region) { // 오르골
      if (!this.ctx || !this.on) return;
      const tunes = [[0, 4, 7, 9, 7, 4, 2, 0], [0, 4, 7, 12, 11, 7, 9, 7], [7, 5, 4, 2, 4, 5, 7, 0], [0, 3, 7, 8, 7, 3, 5, 0], [0, 2, 5, 7, 9, 7, 5, 2]];
      tunes[region].forEach((s, k) => setTimeout(() => { const f = 523.25 * Math.pow(2, s / 12); this.tone(f, 'sine', 1.2, .07, this.master); this.tone(f * 3, 'sine', .6, .015, this.master); }, k * 380));
    },
  };
  ISL.Audio = A;
})();
