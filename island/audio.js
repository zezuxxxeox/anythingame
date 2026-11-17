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
      this.layers.wind = chain(brown, 'lowpass', 520, .2);
      this.layers.fire = chain(brown, 'lowpass', 900, .5, this.master);
      // (밤 벌레 소리는 '지이잉' 하는 기계음처럼 들려서 없앰)
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
      this.set('wind', env.wind * .1, 1.5);
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
    gull() { const c = this.ctx; for (let k = 0; k < 3; k++) setTimeout(() => { this.tone(1520 - k * 60, 'triangle', .35, .012, this.outdoor, 900); }, k * 260); },
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
      if (open) { this.noise(.1, 'bandpass', 600, 1, .06, d, this.buf.brown); }
      else { this.noise(.18, 'lowpass', 400, .7, .5, d, this.buf.brown); this.noise(.05, 'bandpass', 2400, 2, .05, d); }
    },
    melody(region) { // 오르골
      if (!this.ctx || !this.on) return;
      const tunes = [[0, 4, 7, 9, 7, 4, 2, 0], [0, 4, 7, 12, 11, 7, 9, 7], [7, 5, 4, 2, 4, 5, 7, 0], [0, 3, 7, 8, 7, 3, 5, 0], [0, 2, 5, 7, 9, 7, 5, 2]];
      tunes[region].forEach((s, k) => setTimeout(() => { const f = 523.25 * Math.pow(2, s / 12); this.tone(f, 'sine', 1.2, .07, this.master); this.tone(f * 3, 'sine', .6, .015, this.master); }, k * 380));
    },
  };
  // ---------- 지역별 배경 음악 (브라우저에서 직접 연주) ----------
  // step = 박의 1/2. mel: 반음(으뜸음 기준) 또는 null, ch: 마디별 [근음, 장(1)/단(0)]
  const N_ = null;
  const TUNES = {
    france: { bpm: 84, beats: 3, root: 220, lead: 'accordion', comp: 'accordion', // 뮈제트 왈츠
      mel: [12, N_, 11, N_, 12, N_, 16, N_, 12, N_, 9, N_, 8, N_, 9, N_, 11, N_, 14, N_, 11, N_, 8, N_, 9, N_, 12, N_, 16, N_, 21, N_, 19, N_, 17, N_, 16, N_, 14, N_, 12, N_, 11, N_, 8, N_, 4, N_, 9, N_, N_, N_, N_, N_],
      ch: [[0, 0], [0, 0], [7, 1], [7, 1], [0, 0], [5, 0], [7, 1], [0, 0], [0, 0]] },
    kyoto: { bpm: 66, beats: 4, root: 293.66, lead: 'koto', comp: 'kotoLow', // 미야코부시 음계
      mel: [12, N_, N_, 8, 7, N_, 5, N_, 7, N_, N_, N_, 1, N_, 0, N_, 5, N_, 7, 8, 7, N_, 5, N_, 1, N_, 0, N_, N_, N_, N_, N_, 12, 13, 12, N_, 8, N_, 7, N_, 5, N_, 7, N_, 0, N_, N_, N_],
      ch: [[0, 2], [0, 2], [5, 2], [0, 2], [0, 2], [5, 2]] },
    portugal: { bpm: 84, beats: 3, root: 146.83, lead: 'guitar', comp: 'guitarLow', // 파두풍 단조
      mel: [12, 15, 19, 24, 19, 15, 12, 15, 19, 24, 19, 15, 10, 14, 17, 22, 17, 14, 10, 14, 17, 22, 17, 14, 8, 12, 15, 20, 15, 12, 7, 11, 14, 19, 14, 11, 12, 15, 19, 24, 22, 20, 19, N_, N_, N_, N_, N_],
      ch: [[0, 0], [0, 0], [10, 1], [10, 1], [8, 1], [7, 1], [0, 0], [0, 0]] },
    iceland: { bpm: 78, beats: 3, root: 196, lead: 'bells', comp: 'pad', // 고요한 밤 (1818, 공유 저작물)
      mel: [7, N_, N_, 9, 7, N_, 4, N_, N_, N_, N_, N_, 7, N_, N_, 9, 7, N_, 4, N_, N_, N_, N_, N_, 14, N_, N_, N_, 14, N_, 11, N_, N_, N_, N_, N_, 12, N_, N_, N_, 12, N_, 7, N_, N_, N_, N_, N_],
      ch: [[0, 1], [0, 1], [0, 1], [0, 1], [7, 1], [7, 1], [0, 1], [0, 1]] },
    swiss: { bpm: 96, beats: 3, root: 261.63, lead: 'accordionBright', comp: 'accordion', // 랜들러
      mel: [7, N_, 12, N_, 16, N_, 19, N_, 16, N_, 12, N_, 9, N_, 14, N_, 17, N_, 21, N_, 17, N_, 14, N_, 11, N_, 14, N_, 17, N_, 19, N_, 17, N_, 14, N_, 12, N_, 16, N_, 19, N_, 24, N_, N_, N_, N_, N_],
      ch: [[0, 1], [0, 1], [5, 1], [5, 1], [7, 1], [7, 1], [0, 1], [0, 1]] },
    italy: { bpm: 92, beats: 2, root: 220, lead: 'mandolin', comp: 'guitarLow', // 타란텔라풍 (step = 셋잇단)
      trip: true, mel: [12, 11, 12, 16, 12, 9, 12, 11, 12, 16, 12, 9, 11, 9, 11, 14, 11, 8, 11, 9, 11, 14, 11, 8, 9, 11, 12, 14, 16, 17, 16, 14, 12, 11, 9, 8, 9, N_, 9, 9, N_, N_],
      ch: [[0, 0], [0, 0], [7, 1], [7, 1], [0, 0], [7, 1], [0, 0]] },
  };
  // ---------- 실제 곡 (모두 저작권이 끝난 옛 노래) : "음이름:박" ----------
  const SONGS = {
    silent: { name: '고요한 밤 거룩한 밤 (Stille Nacht)', bpm: 84, beats: 3, bell: 1,
      n: 'g4:1.5 a4:.5 g4:1 e4:3 g4:1.5 a4:.5 g4:1 e4:3 d5:2 d5:1 b4:3 c5:2 c5:1 g4:3 a4:2 a4:1 c5:1.5 b4:.5 a4:1 g4:1.5 a4:.5 g4:1 e4:3 a4:2 a4:1 c5:1.5 b4:.5 a4:1 g4:1.5 a4:.5 g4:1 e4:3 d5:2 d5:1 f5:1.5 d5:.5 b4:1 c5:3 e5:3 c5:1.5 g4:.5 e4:1 g4:1.5 f4:.5 d4:1 c4:3 r:3',
      c: 'C C C C G G C C F F C C F F C C G G C C C G C C' },
    jingle: { name: '징글벨 (Jingle Bells)', bpm: 112, beats: 4, bell: 1,
      n: 'e5:1 e5:1 e5:2 e5:1 e5:1 e5:2 e5:1 g5:1 c5:1.5 d5:.5 e5:4 f5:1 f5:1 f5:1.5 f5:.5 f5:1 e5:1 e5:1 e5:.5 e5:.5 e5:1 d5:1 d5:1 e5:1 d5:2 g5:2 e5:1 e5:1 e5:2 e5:1 e5:1 e5:2 e5:1 g5:1 c5:1.5 d5:.5 e5:4 f5:1 f5:1 f5:1.5 f5:.5 f5:1 e5:1 e5:1 e5:.5 e5:.5 g5:1 g5:1 f5:1 d5:1 c5:4',
      c: 'C C C C F C G G C C C C F C G C' },
    tannen: { name: '오 탄넨바움 (O Tannenbaum)', bpm: 88, beats: 3, bell: 1,
      n: 'r:2 g4:1 c5:.75 c5:.25 c5:1 d5:1 e5:.75 e5:.25 e5:1.5 e5:.5 d5:.5 e5:.5 f5:1 b4:1 d5:1 c5:1 r:.5 g5:.5 g5:.5 e5:.5 a5:1.5 g5:.5 g5:.5 f5:.5 f5:1.5 f5:.5 f5:.5 d5:.5 g5:1.5 f5:.5 f5:.5 e5:.5 e5:1 g4:1 c5:.75 c5:.25 c5:1 d5:1 e5:.75 e5:.25 e5:1.5 e5:.5 d5:.5 e5:.5 f5:1 b4:1 d5:1 c5:2',
      c: 'C C C G C C G G C C C G C' },
    deck: { name: '덱 더 홀스 (Deck the Halls)', bpm: 108, beats: 4, bell: 1,
      n: 'g5:1.5 f5:.5 e5:1 d5:1 c5:1 d5:1 e5:1 c5:1 d5:.5 e5:.5 f5:.5 d5:.5 e5:1.5 d5:.5 c5:1 b4:1 c5:2 g5:1.5 f5:.5 e5:1 d5:1 c5:1 d5:1 e5:1 c5:1 d5:.5 e5:.5 f5:.5 d5:.5 e5:1.5 d5:.5 c5:1 b4:1 c5:2 d5:1.5 e5:.5 f5:1 d5:1 e5:1.5 f5:.5 g5:1 d5:1 e5:.5 f#5:.5 g5:1 a5:.5 b5:.5 c6:1 b5:1 a5:1 g5:2 g5:1.5 f5:.5 e5:1 d5:1 c5:1 d5:1 e5:1 c5:1 a5:.5 a5:.5 a5:.5 a5:.5 g5:1.5 f5:.5 e5:1 d5:1 c5:2',
      c: 'C C G C C C G C G C D G C C F C' },
    wish: { name: '위 위시 유 어 메리 크리스마스', bpm: 116, beats: 3, bell: 1,
      n: 'r:2 g4:1 c5:1 c5:.5 d5:.5 c5:.5 b4:.5 a4:1 a4:1 a4:1 d5:1 d5:.5 e5:.5 d5:.5 c5:.5 b4:1 g4:1 g4:1 e5:1 e5:.5 f5:.5 e5:.5 d5:.5 c5:1 a4:1 g4:.5 g4:.5 a4:1 d5:1 b4:1 c5:2 g4:1 c5:1 c5:.5 d5:.5 c5:.5 b4:.5 a4:1 a4:1 a4:1 d5:1 d5:.5 e5:.5 d5:.5 c5:.5 b4:1 g4:1 g4:1 e5:1 e5:.5 f5:.5 e5:.5 d5:.5 c5:1 a4:1 g4:.5 g4:.5 a4:1 d5:1 b4:1 c5:3',
      c: 'C C F Dm G C F G C C F Dm G C F G C' },
    sakura: { name: '사쿠라 사쿠라 (일본 전래곡)', bpm: 66, beats: 4,
      n: 'a4:1 a4:1 b4:2 a4:1 a4:1 b4:2 a4:1 b4:1 c5:1 b4:1 a4:1 b4:.5 a4:.5 f4:2 e4:1 c4:1 e4:1 f4:1 e4:1 e4:.5 c4:.5 b3:2 a4:1 b4:1 c5:1 b4:1 a4:1 b4:.5 a4:.5 f4:2 e4:1 c4:1 e4:1 f4:1 e4:1 e4:.5 c4:.5 b3:2 a4:1 a4:1 b4:2 a4:1 a4:1 b4:2 e4:1 f4:1 b4:.5 a4:.5 f4:1 e4:4 r:4',
      c: 'A5 A5 A5 F A5 E5 A5 F A5 E5 A5 A5 F E5 E5' },
    kojo: { name: '황성의 달 (荒城の月, 1901)', bpm: 63, beats: 4,
      n: 'e4:1 e4:1 a4:1 b4:1 c5:1 b4:1 a4:2 f4:1 f4:1 e4:1 d4:1 e4:3 r:1 e4:1 e4:1 a4:1 b4:1 c5:1 b4:1 a4:2 f4:1 d4:1 e4:1.5 e4:.5 a3:3 r:1 c4:1 c4:1 b3:1 a3:1 f4:1 f4:1 e4:2 d4:1 e4:1 f4:1.5 f4:.5 e4:3 r:1 e4:1 e4:1 a4:1 b4:1 c5:1 b4:1 a4:2 f4:1 d4:1 e4:1.5 e4:.5 a3:3 r:5',
      c: 'Am Am Dm E Am Am Dm Am Am Dm Dm E Am Am Dm Am Am' },
    gymno: { name: '짐노페디 1번 (에릭 사티, 1888)', bpm: 70, beats: 3,
      n: 'r:12 r:1 f#5:1 a5:1 g5:1 f#5:1 c#5:1 b4:1 c#5:1 d5:1 a4:3 f#4:6 r:6 r:1 f#5:1 a5:1 g5:1 f#5:1 c#5:1 b4:1 c#5:1 d5:1 a4:3 f#4:6 r:3',
      c: 'GM7 DM7 GM7 DM7 GM7 DM7 GM7 DM7 GM7 DM7 GM7 DM7 GM7 DM7 GM7 DM7 GM7 DM7 GM7 DM7 GM7 DM7 GM7' },
  };
  const NOTE = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  const pitch = k => { const m = /^([a-g])(#?)(\d)$/.exec(k); return NOTE[m[1]] + (m[2] ? 1 : 0) + (m[3] - 4) * 12; }; // 가온 다(C4) 기준 반음
  const QUAL = { '': [0, 4, 7], m: [0, 3, 7], 5: [0, 7, 12], M7: [0, 4, 7, 11] };
  function compile(sg) {
    if (sg.notes) return sg;
    sg.notes = sg.n.split(' ').map(tk => { const [k, d] = tk.split(':'); return [k === 'r' ? null : pitch(k), +d]; });
    sg.ch = sg.c.split(' ').map(tk => { const m = /^([A-G])(#?)(.*)$/.exec(tk); return [NOTE[m[1].toLowerCase()] + (m[2] ? 1 : 0), QUAL[m[3]]]; });
    sg.root = 261.63; return sg;
  }
  // 예전 방식(반박 단위 배열)으로 적어 둔 지역 곡도 같은 형식으로 변환
  function legacy(id, name) {
    const d = TUNES[id], sub = d.trip ? 3 : 2, notes = [];
    for (const s of d.mel) { if (s === null && notes.length) notes[notes.length - 1][1] += 1 / sub; else notes.push([s, 1 / sub]); }
    return { name, bpm: d.bpm, beats: d.beats, root: d.root / 2, notes, ch: d.ch.map(([r, q]) => [r, q === 1 ? QUAL[''] : q === 0 ? QUAL.m : QUAL[5]]) };
  }
  // 실제 연주 녹음 (위키미디어 공용, 공유 저작물·CC) — 파일이 없거나 재생이 안 되면 같은 곡을 오르골로 대신 연주
  const REC = (file, name, alt) => ({ file: 'island/music/' + file + '.mp3', name, alt: alt ? compile(SONGS[alt]) : null });
  const LISTS = {
    iceland: [REC('silent', '고요한 밤 거룩한 밤 — 미 공군 군악대 합창단', 'silent'), REC('jingle', '징글벨 — 미 공군 군악대', 'jingle'), REC('tannen', '오 탄넨바움 — 미 공군 군악대 합창단', 'tannen'), REC('deck', '덱 더 홀스 — 미 공군 군악대 합창단', 'deck'), REC('wish', '위 위시 유 어 메리 크리스마스 — 미 공군 군악대', 'wish')],
    kyoto: [REC('koto', '고토(일본 전통 현악기) 연주 — Torsodog (CC BY 3.0)', 'sakura'), compile(SONGS.sakura), compile(SONGS.kojo)],
    france: [REC('gymno', '사티: 짐노페디 1번 — 피아노 Robin Alciatore', 'gymno'), REC('waltz', '쇼팽: 왈츠 Op.34-2 — 피아노', null), legacy('france', '파리의 왈츠')],
    portugal: [legacy('portugal', '알파마의 기타')], swiss: [legacy('swiss', '알프스 랜들러')], italy: [legacy('italy', '타란텔라')],
  };
  Object.assign(A, {
    music: null, musicId: null, musicGain: null, musicOn: true, songName: '',
    setMusic(id) {
      if (!this.ctx || id === this.musicId) { this.pendingMusic = id; return; }
      this.musicId = id; const c = this.ctx;
      if (!this.musicGain) { this.musicGain = c.createGain(); this.musicGain.gain.value = 0; this.musicLP = c.createBiquadFilter(); this.musicLP.type = 'lowpass'; this.musicLP.frequency.value = 6000; this.musicGain.connect(this.musicLP).connect(this.master); setInterval(() => this.musicTick(), 120); }
      const t = c.currentTime; this.musicGain.gain.cancelScheduledValues(t); this.musicGain.gain.setTargetAtTime(0, t, .5);
      setTimeout(() => { if (this.musicId !== id) return; const L = LISTS[id]; if (this.el) this.el.pause(); this.music = L ? { list: L, k: Math.floor(Math.random() * L.length), i: 0, beat: 0, next: c.currentTime + .3, bar: -1 } : null; if (this.music) this.startEntry(); }, 1400);
    },
    // 목록의 현재 곡 시작: 녹음 파일이면 재생기로, 아니면 오르골 합성으로
    startEntry() {
      const m = this.music; if (!m) return; let e = m.list[m.k]; m.i = 0; m.beat = 0; m.bar = -1; m.next = this.ctx.currentTime + .4; m.rec = null;
      if (e.file && !e.bad) {
        if (!this.el) { this.el = new Audio(); this.el.preload = 'auto'; this.el.addEventListener('ended', () => this.nextEntry()); this.el.addEventListener('error', () => { const mm = this.music; if (mm && mm.rec) { mm.rec.bad = true; if (mm.rec.alt) { mm.cur = mm.rec.alt; mm.rec = null; this.announce(); } else this.nextEntry(); } }); }
        m.rec = e; m.cur = null; this.el.src = e.file; this.el.volume = 0; const pr = this.el.play(); if (pr && pr.catch) pr.catch(() => { e.bad = true; if (this.music === m) { m.rec = null; m.cur = e.alt; if (!m.cur) this.nextEntry(); } });
      } else m.cur = e.file ? e.alt : e;
      if (!m.rec && !m.cur) return this.nextEntry();
      this.announce();
    },
    nextEntry() { const m = this.music; if (!m) return; if (m.list.every(e => e.file && e.bad && !e.alt)) { this.music = null; return; } m.k = (m.k + 1) % m.list.length; this.startEntry(); },
    announce() { const m = this.music; this.songName = (m.rec || m.cur).name; if (ISL.onSong && this.on && this.musicOn) ISL.onSong(this.songName); },
    musicTick() {
      const m = this.music, c = this.ctx; if (!c) return; if (this.musicGain) this.musicGain.gain.setTargetAtTime(this.on && this.musicOn && m ? (this.inside ? .2 : .36) : 0, c.currentTime, .6);
      if (this.el) { const want = m && m.rec && this.on && this.musicOn ? (this.inside ? .3 : .55) : 0; this.el.volume = Math.max(0, Math.min(1, this.el.volume + Math.sign(want - this.el.volume) * Math.min(.04, Math.abs(want - this.el.volume)))); if (m && m.rec && want > 0 && this.el.paused && !m.rec.bad) { const pr = this.el.play(); if (pr && pr.catch) pr.catch(() => {}); } if ((!m || !m.rec || want === 0) && this.el.volume === 0 && !this.el.paused) this.el.pause(); }
      if (m && m.rec) { m.next = c.currentTime + .1; return; }
      if (!m || !m.cur || !this.on || !this.musicOn || c.state !== 'running') { if (m) m.next = c.currentTime + .1; return; }
      while (m.next < c.currentTime + .4) {
        const sg = m.cur, bd = 60 / sg.bpm;
        if (m.i >= sg.notes.length) { this.nextEntry(); if (this.music) this.music.next += 3; return; }
        // 반주: 마디마다 화음을 한 음씩 뜯는 오르골 반주 (길게 끄는 저음 없음)
        const [s, d] = sg.notes[m.i], b0 = m.beat, b1 = m.beat + d;
        for (let bar = Math.floor(b0 / sg.beats + 1e-6); bar * sg.beats < b1 - 1e-6; bar++) {
          if (bar <= m.bar) continue; m.bar = bar; const [cr, q] = sg.ch[bar % sg.ch.length], tb = m.next + (bar * sg.beats - b0) * bd;
          for (let k = 0; k < sg.beats; k++) { const semi = k === 0 ? cr - 12 : cr + q[1 + (k - 1) % (q.length - 1)]; this.voice('comp', sg.root * Math.pow(2, (semi > 7 ? semi - 12 : semi) / 12), tb + k * bd, bd * 1.5, k === 0 ? .55 : .36); }
        }
        if (s !== null) this.voice(sg.bell ? 'bell' : 'box', sg.root * Math.pow(2, s / 12), m.next, Math.min(d * bd, 2.2));
        m.i++; m.beat = b1; m.next += d * bd;
      }
    },
    // 오르골·피아노 같은 맑은 소리만 사용: 톡 치고 자연스럽게 사라짐 (윙 하고 끄는 소리 없음)
    voice(kind, f, t, dur, vol = 1) {
      const c = this.ctx, g = c.createGain(); g.connect(this.musicGain); const tail = Math.min(2.4, Math.max(.9, dur + .9));
      const o = (fr, gain, dec) => { const x = c.createOscillator(), xg = c.createGain(); x.type = 'sine'; x.frequency.value = fr; xg.gain.setValueAtTime(gain, t); xg.gain.exponentialRampToValueAtTime(gain * .001, t + tail * dec); x.connect(xg).connect(g); x.start(t); x.stop(t + tail + .05); };
      o(f, 1, 1); o(f * 2, .32, .55); o(f * 3, .1, .3); if (kind === 'bell') { o(f * 4, .09, .22); o(f * 5.4, .035, .12); }
      const pk = (kind === 'comp' ? .05 : .085) * vol;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(pk, t + .006); g.gain.exponentialRampToValueAtTime(pk * .35, t + .28); g.gain.exponentialRampToValueAtTime(0.0001, t + tail);
    },
  });
  ISL.Audio = A;
})();
