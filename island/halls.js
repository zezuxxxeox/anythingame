// 명소 내부: 실제 건축을 단순화해 재현한 실내 공간들
(function () {
  const ISL = window.ISL;
  const C = c => new THREE.Color(c);
  const texCache = {};
  function tex(key, w, h, draw, rx = 1, ry = 1) {
    let t = texCache[key];
    if (!t) { t = ISL.LH.canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; texCache[key] = t; }
    const c = t.clone(); c.needsUpdate = true; c.repeat.set(rx, ry); return c;
  }
  const rnd = ISL.mulberry32(808);
  // ---------- 질감 ----------
  const T = {
    stone: (base, mortar, key) => (rx, ry) => tex('st' + key, 256, 256, (x, w, h) => {
      x.fillStyle = mortar; x.fillRect(0, 0, w, h);
      for (let j = 0; j < 8; j++) for (let i = -1; i < 5; i++) { const c = C(base).multiplyScalar(.85 + rnd() * .3); x.fillStyle = '#' + c.getHexString(); const ox = (j % 2) * 32; x.fillRect(i * 64 + ox + 2, j * 32 + 2, 60, 28); for (let k = 0; k < 30; k++) { x.fillStyle = `rgba(0,0,0,${rnd() * .08})`; x.fillRect(i * 64 + ox + rnd() * 60, j * 32 + rnd() * 28, 3, 2); } }
    }, rx, ry),
    concrete: (rx, ry) => tex('conc', 256, 256, (x, w, h) => { x.fillStyle = '#d8d8d3'; x.fillRect(0, 0, w, h); for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(${rnd() < .5 ? 0 : 255},${rnd() < .5 ? 0 : 255},${rnd() < .5 ? 0 : 255},.04)`; x.fillRect(rnd() * w, rnd() * h, 2, 2); } x.fillStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i < w; i += 64) x.fillRect(i, 0, 2, h); x.fillRect(0, 128, w, 2); }, rx, ry),
    planks: (rx, ry) => tex('hpl', 256, 256, (x, w, h) => { for (let i = 0; i < 8; i++) { const c = 95 + rnd() * 25; x.fillStyle = `rgb(${c},${c * .66},${c * .42})`; x.fillRect(i * 32, 0, 32, h); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(i * 32, 0, 2, h); for (let k = 0; k < 8; k++) { x.fillStyle = 'rgba(0,0,0,.05)'; x.fillRect(i * 32 + 4 + k * 3, 0, 1, h); } } }, rx, ry),
    floorStone: (rx, ry) => tex('fst', 256, 256, (x, w, h) => { x.fillStyle = '#5c564d'; x.fillRect(0, 0, w, h); for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const c = C('#b9ae9c').multiplyScalar(.8 + rnd() * .3); x.fillStyle = '#' + c.getHexString(); x.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); } }, rx, ry),
    marble: (rx, ry) => tex('mar', 256, 256, (x, w, h) => { for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { x.fillStyle = (i + j) % 2 ? '#efe9de' : '#3b4a5a'; x.fillRect(i * 64, j * 64, 64, 64); } x.strokeStyle = 'rgba(120,110,100,.25)'; for (let k = 0; k < 20; k++) { x.beginPath(); x.moveTo(rnd() * w, rnd() * h); x.quadraticCurveTo(rnd() * w, rnd() * h, rnd() * w, rnd() * h); x.stroke(); } }, rx, ry),
    gold: (rx, ry) => tex('gold', 256, 256, (x, w, h) => { for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const c = C('#d9a93a').multiplyScalar(.85 + rnd() * .3); x.fillStyle = '#' + c.getHexString(); x.fillRect(i * 32, j * 32, 32, 32); x.fillStyle = 'rgba(120,80,10,.25)'; x.fillRect(i * 32, j * 32, 32, 1); x.fillRect(i * 32, j * 32, 1, 32); } }, rx, ry),
    lacquer: (rx, ry) => tex('lac', 64, 64, (x, w, h) => { x.fillStyle = '#120c09'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(80,30,20,.25)'; for (let i = 0; i < w; i += 16) x.fillRect(i, 0, 1, h); }, rx, ry),
    arab: (rx, ry) => tex('arab', 256, 256, (x, w, h) => { x.fillStyle = '#e8c98a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 2; i++) { const cx = i * 128 + 64; x.fillStyle = '#2f5d8f'; x.beginPath(); x.moveTo(cx - 44, 230); x.lineTo(cx - 44, 90); x.quadraticCurveTo(cx - 44, 30, cx, 18); x.quadraticCurveTo(cx + 44, 30, cx + 44, 90); x.lineTo(cx + 44, 230); x.fill(); x.fillStyle = '#c0392b'; x.beginPath(); x.moveTo(cx - 32, 230); x.lineTo(cx - 32, 96); x.quadraticCurveTo(cx - 32, 48, cx, 36); x.quadraticCurveTo(cx + 32, 48, cx + 32, 96); x.lineTo(cx + 32, 230); x.fill(); x.strokeStyle = '#f2d36b'; x.lineWidth = 3; for (let k = 0; k < 6; k++) { x.beginPath(); x.arc(cx, 140, 8 + k * 4, 0, 7); x.stroke(); } } x.fillStyle = '#7a3b1e'; x.fillRect(0, 236, w, 20); }, rx, ry),
    azulejo: (rx, ry) => tex('hazu', 128, 128, (x, w, h) => { x.fillStyle = '#f8f5ec'; x.fillRect(0, 0, w, h); for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const cx = i * 64 + 32, cy = j * 64 + 32; x.fillStyle = '#e2a33a'; x.beginPath(); x.arc(cx, cy, 10, 0, 7); x.fill(); x.strokeStyle = '#2a5ea8'; x.lineWidth = 4; for (let k = 0; k < 4; k++) { x.beginPath(); x.ellipse(cx, cy, 26, 9, k * Math.PI / 4, 0, 7); x.stroke(); } } }, rx, ry),
    stained: (key, cols) => tex('sg' + key, 128, 256, (x, w, h) => { x.fillStyle = '#1a1a1a'; x.fillRect(0, 0, w, h); for (let k = 0; k < 60; k++) { x.fillStyle = cols[Math.floor(rnd() * cols.length)]; x.beginPath(); const px = rnd() * w, py = rnd() * h; x.moveTo(px, py); for (let v = 0; v < 4; v++) x.lineTo(px + (rnd() - .5) * 50, py + (rnd() - .5) * 50); x.fill(); } x.strokeStyle = '#111'; x.lineWidth = 3; for (let k = 0; k < 14; k++) { x.beginPath(); x.moveTo(rnd() * w, rnd() * h); x.lineTo(rnd() * w, rnd() * h); x.stroke(); } }),
    mandala: (rx, ry) => tex('mand', 256, 256, (x, w, h) => { x.fillStyle = '#7a2a1e'; x.fillRect(0, 0, w, h); const cx = 128, cy = 128; const cols = ['#e3b341', '#2f6f6a', '#c94f3b', '#efe6cf', '#3f5aa0']; for (let r = 120; r > 8; r -= 12) { x.fillStyle = cols[(r / 12 | 0) % 5]; x.beginPath(); for (let k = 0; k <= 16; k++) { const a = k / 16 * Math.PI * 2, rr = r * (k % 2 ? .82 : 1); x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.fill(); } }, rx, ry),
    rock: (rx, ry) => tex('hrock', 256, 256, (x, w, h) => { x.fillStyle = '#6d665c'; x.fillRect(0, 0, w, h); for (let k = 0; k < 160; k++) { const c = C('#8a8174').multiplyScalar(.7 + rnd() * .5); x.fillStyle = '#' + c.getHexString(); x.beginPath(); x.ellipse(rnd() * w, rnd() * h, 6 + rnd() * 22, 5 + rnd() * 14, rnd() * 3, 0, 7); x.fill(); } }, rx, ry),
  };
  const M = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: .85 }, o));

  // ---------- 공통 뼈대: 바닥, 벽, 출구 문 ----------
  function shell(door, o) {
    const LH = ISL.LH, scene = new THREE.Scene(); scene.background = C(o.bg || '#141210');
    if (ISL.envTex) scene.environment = ISL.envTex;
    const g = new THREE.Group(); scene.add(g);
    const W = o.W, D = o.D, H = o.H, phys = new ISL.Phys(4), inter = [], anim = [], env = { fire: 0, clock: 0 };
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(W, D), o.floor); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; g.add(fl);
    const wallBox = (w, h, d, x, y, z, m) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m || o.wall); me.position.set(x, y + h / 2, z); me.receiveShadow = me.castShadow = true; g.add(me); return me; };
    const solid = (x, z, w, d, y1 = H) => phys.add({ t: 'b', x, z, hw: w / 2, hd: d / 2, a: 0, y0: -1, y1 });
    const dw = o.doorW || 2.4, t = .6;
    if (!o.noWalls) {
      wallBox(W + 2 * t, H, t, 0, 0, -D / 2 - t / 2); wallBox(t, H, D, -W / 2 - t / 2, 0, 0); wallBox(t, H, D, W / 2 + t / 2, 0, 0);
      wallBox((W - dw) / 2, H, t, -(W + dw) / 4, 0, D / 2 + t / 2); wallBox((W - dw) / 2, H, t, (W + dw) / 4, 0, D / 2 + t / 2); wallBox(dw, H - 3.2, t, 0, 3.2, D / 2 + t / 2);
    }
    for (const [x, z, w, d] of [[0, -D / 2 - .3, W + 1, .6], [-W / 2 - .3, 0, .6, D + 1], [W / 2 + .3, 0, .6, D + 1], [-(W + dw) / 4 - .1, D / 2 + .3, (W - dw) / 2, .6], [(W + dw) / 4 + .1, D / 2 + .3, (W - dw) / 2, .6]]) solid(x, z, w, d);
    // 출구 문 (큰 나무 문짝 두 개)
    const exitPivot = new THREE.Group(); g.add(exitPivot);
    const leaves = [];
    for (const s of [-1, 1]) { const p = new THREE.Group(); p.position.set(s * dw / 2, 0, D / 2 - .05); exitPivot.add(p); LH.box(p, dw / 2, 3.15, .12, o.doorCol || '#5a3b26', -s * dw / 4, 0, 0); LH.sphere(p, .06, '#c9a24a', -s * (dw / 2 - .2), 1.2, -.08); leaves.push([p, s]); }
    const exit = { pivot: exitPivot, open: 0, target: 0 };
    anim.push(dt => { if (exit.open !== exit.target) { exit.open += Math.sign(exit.target - exit.open) * Math.min(Math.abs(exit.target - exit.open), dt * 2.4); for (const [p, s] of leaves) p.rotation.y = -s * exit.open * 1.4; } }); // 안쪽으로 열림
    inter.push({ x: 0, z: D / 2 - 1, r: 1.6, label: '🚪 밖으로 나가기', act: 'exit' });
    const ctx = { scene, g, phys, inter, anim, env, W, D, H, wallBox, solid, LH,
      light(c, i, d, x, y, z, flick) { const l = new THREE.PointLight(c, i, d, 2); l.position.set(x, y, z); scene.add(l); if (flick) anim.push((dt, tt) => { l.intensity = i * (.85 + Math.sin(tt * 9 + x) * .08 + Math.random() * .07); }); return l; },
      candle(x, y, z) { LH.cyl(g, .05, .05, .3, 8, '#f4ecd8', x, y, z); const f = new THREE.Mesh(new THREE.ConeGeometry(.04, .12, 6), new THREE.MeshBasicMaterial({ color: '#ffcf70' })); f.position.set(x, y + .38, z); g.add(f); anim.push((dt, tt) => { f.scale.y = .8 + Math.sin(tt * 17 + x * 5) * .2; }); },
      seat(x, z, ry, y, label = '🪑 앉기') { inter.push({ x, z, r: .9, label, act: 'sit', seat: { x, z, ry, y } }); },
      info(x, z, r, label, text) { inter.push({ x, z, r, label, act: () => ISL.toast(text, 6000) }); },
      glow(w, h, x, y, z, ry, map, color) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: map || null, color: color || '#ffffff', side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m; },
    };
    ctx.__exit = exit;
    return ctx;
  }
  function finish(ctx, door, extra) {
    const { scene, g, anim, inter, phys, env, W, D, H } = ctx;
    g.traverse(o => { if (o.isMesh && o.castShadow === undefined) o.castShadow = true; });
    return Object.assign({ scene, phys, inter, anim, env, door, W, D, HT: H, exit: ctx.exit || null, resident: null,
      spawn: { x: 0, z: D / 2 - 2, face: Math.PI },
      update(dt, t) { for (const f of anim) f(dt, t); } }, extra || {});
  }
  // 나중에 exit 객체를 결과에 붙이기 위해
  function hall(door, o, build) { const c = shell(door, o); c.exit = null; const r = build(c) || {}; const ex = c.anim.length; const out = finish(c, door, r); out.exit = c.__exit; return out; }

  // 오르골 대신 오르간 소리
  function organ() {
    const A = ISL.Audio; if (!A.ctx || !A.on) return; const c = A.ctx, t0 = c.currentTime;
    const chords = [[0, 4, 7, 12], [5, 9, 12, 17], [7, 11, 14, 19], [0, 4, 7, 12, 24]];
    chords.forEach((ch, k) => ch.forEach(s => {
      const f = 130.8 * Math.pow(2, s / 12), t = t0 + k * 1.4;
      for (const [m, typ, v] of [[1, 'sawtooth', .012], [2, 'square', .006], [.5, 'sine', .03]]) {
        const o = c.createOscillator(), gn = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
        o.type = typ; o.frequency.value = f * m; gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(v, t + .15); gn.gain.setValueAtTime(v, t + 1.3); gn.gain.exponentialRampToValueAtTime(.0001, t + (k === 3 ? 4 : 1.7));
        o.connect(lp).connect(gn).connect(A.master); o.start(t); o.stop(t + 4.2);
      }
    }));
  }

  // ---------- 1. 할그림스키르캬 ----------
  function hallgrim(door) {
    const W = 14, D = 36, H = 19;
    return hall(door, { W, D, H, floor: M({ map: T.concrete(3, 8), color: '#c9c6bd', roughness: .6 }), wall: M({ map: T.concrete(4, 4), roughness: .95 }), bg: '#dfe4ea', doorCol: '#6b5a48' }, c => {
      const { g, LH } = c, conc = M({ color: '#e4e4df', roughness: .9 });
      // 기둥과 뾰족한 갈비뼈 궁륭
      for (let z = -D / 2 + 3; z < D / 2 - 2; z += 4.5) {
        for (const s of [-1, 1]) {
          LH.box(g, 1, H - 6, 1.1, conc, s * 4.6, 0, z); c.solid(s * 4.6, z, 1.1, 1.2);
          // 기둥에서 꼭대기로 휘어 오르는 갈비뼈 (뾰족 아치)
          const rib = new THREE.Mesh(new THREE.BoxGeometry(.5, .5, 8.6), conc); rib.position.set(s * 2.3, H - 3.3, z); rib.rotation.x = 0; rib.rotation.y = Math.PI / 2; rib.rotation.z = 0; rib.rotateX(s * .62); g.add(rib);
          const rib2 = new THREE.Mesh(new THREE.BoxGeometry(.4, .4, 3.4), conc); rib2.position.set(s * 5.8, H - 4.6, z); rib2.rotation.y = Math.PI / 2; rib2.rotateX(s * .42); g.add(rib2);
        }
        // 측면의 길고 좁은 창
        for (const s of [-1, 1]) if (z < D / 2 - 6) { const w = c.glow(.9, 9, s * (W / 2 - .02), 9.5, z + 2.25, s > 0 ? -Math.PI / 2 : Math.PI / 2, null, '#e8f1ff'); const tri = c.glow(.9, .9, s * (W / 2 - .02), 14.3, z + 2.25, s > 0 ? -Math.PI / 2 : Math.PI / 2, null, '#e8f1ff'); tri.scale.set(.7, 1, 1); tri.rotation.z = Math.PI / 4; }
      }
      // 뾰족 천장 두 면
      for (const s of [-1, 1]) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(9.2, D), M({ map: T.concrete(3, 8), side: THREE.DoubleSide })); pl.position.set(s * 3.6, H - 2.2, 0); pl.rotateZ(s * .5); pl.rotateX(-Math.PI / 2); g.add(pl); }
      // 신도석
      const wood = M({ color: '#9a7652', roughness: .7 });
      for (let i = 0; i < 9; i++) for (const s of [-1, 1]) { const z = -6 + i * 1.6; LH.box(g, 3.6, .45, .45, wood, s * 2.6, 0, z); LH.box(g, 3.6, .55, .08, wood, s * 2.6, .45, z + .22); c.solid(s * 2.6, z, 3.6, .6, 1); if (i % 3 === 0) c.seat(s * 2.6, z - .05, Math.PI, .45, '🪑 신도석에 앉기'); }
      // 제단과 십자가
      LH.box(g, 8, .5, 4, '#cfcabf', 0, 0, -D / 2 + 2); c.solid(0, -D / 2 + 2, 8, 4, .5);
      LH.box(g, 2.4, 1, .9, '#efe9dc', 0, .5, -D / 2 + 1.6); for (const x of [-.8, .8]) c.candle(x, 1.5, -D / 2 + 1.6);
      LH.box(g, .25, 4, .2, '#7a6a5a', 0, 2, -D / 2 + .5); LH.box(g, 1.8, .25, .2, '#7a6a5a', 0, 4.8, -D / 2 + .5);
      c.glow(3, 8, 0, 7, -D / 2 + .02, 0, null, '#f2f6ff');
      // 거대한 파이프 오르간 (입구 위 발코니)
      const oz = D / 2 - 2.2; LH.box(g, W, .4, 3.4, conc, 0, 7, oz); LH.box(g, W, 1.1, .2, conc, 0, 7.4, oz - 1.6);
      const parts = [];
      for (let row = 0; row < 3; row++) for (let i = -32; i <= 32; i++) {
        const x = i * .2, f = 1 - Math.abs(i) / 33, towers = Math.pow(Math.abs(Math.sin(i * .19)), .6);
        const h = 1.5 + 8 * Math.pow(f, .5) * (.55 + .45 * towers) - row * .8, r = .07 + .06 * f;
        const pg = new THREE.CylinderGeometry(r, r, h, 10); pg.translate(x, 7.4 + h / 2, oz + row * .45 - .6); parts.push([pg, null]);
        const mouth = new THREE.BoxGeometry(r * 1.4, .12, .05); mouth.translate(x, 8.2, oz + row * .45 - .6 - r); parts.push([mouth, null]);
      }
      const pipes = new THREE.Mesh(ISL.merge(parts.map(([gg]) => [gg, '#ffffff'])), M({ vertexColors: true, color: '#d9dde2', metalness: .95, roughness: .22 })); g.add(pipes);
      LH.box(g, 9, 6, .3, '#8a7a66', 0, 7.4, oz + 1.4);
      c.inter.push({ x: 0, z: oz - 3.5, r: 3, label: '🎹 오르간 소리 듣기', act: organ });
      c.info(0, -D / 2 + 4.5, 2.6, '📖 교회 이야기', '할그림스키르캬는 1945년에 설계해 1986년에 완공했어요. 오르간의 파이프는 무려 5,275개, 높이는 15m예요.');
      // 빛: 차가운 북쪽의 낮빛
      c.scene.add(new THREE.HemisphereLight('#eef4ff', '#a8a49a', 1.1));
      for (let z = -12; z <= 12; z += 8) for (const s of [-1, 1]) c.light('#e9f1ff', 22, 22, s * 5, 10, z);
      c.light('#fff2d8', 6, 10, 0, 3, -D / 2 + 3, true);
      return { spawn: { x: 0, z: D / 2 - 4, face: Math.PI } };
    });
  }

  // ---------- 2. 몽생미셸 수도원 + 회랑 ----------
  function msm(door) {
    const W = 34, D = 30, H = 15;
    return hall(door, { W, D, H, floor: M({ map: T.floorStone(8, 7) }), wall: M({ map: T.stone('#b5a891', '#6e665a', 'msm')(6, 3) }), bg: '#a9c6e0', doorCol: '#4a3426' }, c => {
      const { g, LH } = c, stone = M({ map: T.stone('#b8ab94', '#6e665a', 'msm2')(1, 2) });
      // 본당(왼쪽 x -17..-3) / 회랑(오른쪽 x -1..17) 사이 벽 (통로 하나)
      const nx = -10, mid = -2;
      c.wallBox(.8, H, D / 2 - 2, mid, 0, -D / 4 - 1); c.wallBox(.8, H, D / 2 - 2, mid, 0, D / 4 + 1); c.wallBox(.8, H - 3.5, 4, mid, 3.5, 0);
      c.solid(mid, -D / 4 - 1, .8, D / 2 - 2); c.solid(mid, D / 4 + 1, .8, D / 2 - 2);
      // 본당: 둥근 기둥 + 로마네스크 아치 + 나무 통천장
      for (let z = -D / 2 + 3; z < D / 2 - 2; z += 3.6) for (const s of [-1, 1]) {
        const x = nx + s * 3.8; LH.cyl(g, .45, .5, 6.2, 14, stone, x, 0, z); c.solid(x, z, 1, 1);
        LH.box(g, 1.1, .4, 1.1, stone, x, 6.2, z);
        if (z + 3.6 < D / 2 - 2) { const a = new THREE.Mesh(new THREE.TorusGeometry(1.8, .32, 6, 16, Math.PI), stone); a.position.set(x, 6.6, z + 1.8); a.rotation.y = Math.PI / 2; g.add(a); }
      }
      const vault = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6.4, D, 28, 1, true, -Math.PI / 2, Math.PI), M({ map: T.planks(6, 8), side: THREE.DoubleSide }));
      vault.rotation.x = Math.PI / 2; vault.rotation.z = Math.PI / 2; vault.position.set(nx, H - 6.4, 0); g.add(vault);
      for (let z = -D / 2 + 1; z < D / 2; z += 3.6) { const r = new THREE.Mesh(new THREE.TorusGeometry(6.35, .15, 4, 24, Math.PI), M({ color: '#4a3020' })); r.position.set(nx, H - 6.4, z); g.add(r); }
      // 고딕 성가대석의 스테인드글라스
      const sg = T.stained('msm', ['#2f4fa8', '#b8302a', '#e0b13a', '#2f8a5a', '#6b3f9a']);
      for (const x of [-4, 0, 4]) c.glow(2, 7, nx + x, 6.5, -D / 2 + .02, 0, sg);
      LH.box(g, 4, 1.1, 1.5, '#d8cfbd', nx, 0, -D / 2 + 3); c.solid(nx, -D / 2 + 3, 4, 1.5, 1.1);
      for (const x of [-1.4, -.5, .5, 1.4]) c.candle(nx + x, 1.1, -D / 2 + 3);
      for (let i = 0; i < 6; i++) for (const s of [-1, 1]) { const z = -4 + i * 1.8; LH.box(g, 2.6, .45, .45, '#6b4a30', nx + s * 1.8, 0, z); c.solid(nx + s * 1.8, z, 2.6, .5, 1); }
      c.seat(nx - 1.8, -4.05, Math.PI, .45, '🪑 기도석에 앉기');
      c.info(nx, -D / 2 + 5, 2.5, '📖 수도원 이야기', '708년 오베르 주교가 꿈에서 미카엘 대천사의 계시를 받고 세운 곳이에요. 중세엔 순례자들이 밀물 때를 피해 갯벌을 건너 이곳까지 왔어요.');
      // 회랑: 하늘로 열린 정원 + 엇갈린 두 줄 기둥
      const cx = 8, cw = 14, cd = 22;
      const lawn = new THREE.Mesh(new THREE.PlaneGeometry(cw - 5, cd - 5), M({ color: '#5f8f3c' })); lawn.rotation.x = -Math.PI / 2; lawn.position.set(cx, .02, 0); g.add(lawn);
      for (let i = 0; i < 8; i++) LH.box(g, 1.2, .8, 1.2, '#2f5a2a', cx - 3 + (i % 4) * 2, 0, -5 + Math.floor(i / 4) * 10);
      const col = M({ color: '#c9b9a0' });
      for (let k = 0; k < 2; k++) for (let t = 0; t < 40; t++) {
        const side = Math.floor(t / 10), u = (t % 10) / 9, off = k * .55 + 2.3;
        let x, z; if (side === 0) { x = cx - cw / 2 + off; z = -cd / 2 + 2 + u * (cd - 4); } else if (side === 1) { x = cx + cw / 2 - off; z = -cd / 2 + 2 + u * (cd - 4); } else if (side === 2) { z = -cd / 2 + off; x = cx - cw / 2 + 2 + u * (cw - 4); } else { z = cd / 2 - off; x = cx - cw / 2 + 2 + u * (cw - 4); }
        x += k * .27; LH.cyl(g, .12, .14, 2.8, 8, col, x, 0, z); c.solid(x, z, .3, .3);
      }
      for (const [x, z, w, d] of [[cx - cw / 2 + 1.5, 0, 3, cd], [cx + cw / 2 - 1.5, 0, 3, cd], [cx, -cd / 2 + 1.5, cw, 3], [cx, cd / 2 - 1.5, cw, 3]]) { LH.box(g, w, .3, d, '#4f5560', x, 2.8, z); }
      c.info(cx, 0, 3, '🌿 회랑', '"라 메르베유(경이)"라 불리는 회랑이에요. 기둥이 두 줄로 엇갈려 서 있어서 걸을 때마다 기둥 사이 풍경이 달라져요. 수도사들이 걸으며 명상하던 곳이에요.');
      c.seat(cx - cw / 2 + 1.6, 6, Math.PI / 2, .5, '🪑 회랑에 앉기'); LH.box(g, .6, .5, 3, '#9a8e7e', cx - cw / 2 + 1.4, 0, 6);
      // 빛
      c.scene.add(new THREE.HemisphereLight('#dfe9f5', '#7a6a55', .7));
      const sun = new THREE.DirectionalLight('#fff3dd', 3); sun.position.set(cx + 6, 20, 8); sun.target.position.set(cx, 0, 0); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); const sc = sun.shadow.camera; sc.left = sc.bottom = -14; sc.right = sc.top = 14; c.scene.add(sun, sun.target);
      for (let z = -10; z <= 10; z += 10) c.light('#ffd9a0', 8, 14, nx, 5, z, true);
      c.light('#9fb6ff', 10, 14, nx, 6, -D / 2 + 2);
      return { spawn: { x: nx, z: D / 2 - 2.5, face: Math.PI } };
    });
  }

  // ---------- 3. 벨렝탑 ----------
  function belem(door) {
    const W = 9, D = 9, H = 6.5;
    return hall(door, { W, D, H, floor: M({ map: T.floorStone(3, 3) }), wall: M({ map: T.stone('#e6dcc5', '#b8ab90', 'bel')(2, 2) }), doorCol: '#4a3426', doorW: 1.8 }, c => {
      const { g, LH } = c, lime = M({ map: T.stone('#e9dfc8', '#bdb095', 'bel2')(1, 1) });
      // 마누엘 양식 리브 궁륭 (네 귀퉁이에서 가운데로)
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(6.3, .16, 5, 18, Math.PI / 2), lime); r.position.set(0, H - 4.6, 0); r.rotation.y = Math.atan2(x, z) - Math.PI / 2; r.rotation.order = 'YXZ'; g.add(r);
      }
      for (const a of [0, Math.PI / 2]) { const r = new THREE.Mesh(new THREE.TorusGeometry(4.5, .12, 5, 16, Math.PI), lime); r.position.set(0, H - 4.5, 0); r.rotation.y = a; g.add(r); }
      LH.sphere(g, .35, '#c9a24a', 0, H - .2, 0);
      // 밧줄 장식
      const rope = new THREE.Mesh(new THREE.TorusGeometry(.12, .07, 6, 8), lime);
      for (let i = 0; i < 60; i++) { const t = i / 60, side = Math.floor(t * 4), u = (t * 4) % 1, L = W - .2; const pts = [[-L / 2 + u * L, -D / 2 + .2], [W / 2 - .2, -D / 2 + u * D], [L / 2 - u * L, D / 2 - .2], [-W / 2 + .2, D / 2 - u * D]][side]; const m = rope.clone(); m.position.set(pts[0], 3.6, pts[1]); m.rotation.y = side % 2 ? 0 : Math.PI / 2; g.add(m); }
      // 포안과 대포
      for (const [x, z, ry] of [[0, -D / 2, 0], [-W / 2, 0, Math.PI / 2], [W / 2, 0, -Math.PI / 2]]) {
        const nx = x === 0 ? 0 : Math.sign(x) * -1, nz = z === 0 ? 0 : 1;
        c.glow(1.2, 1.1, x + nx * -.02, 1.6, z + (z ? .02 : 0), ry, null, '#cfe6f5');
        const cg = new THREE.Group(); cg.position.set(x + (x ? -Math.sign(x) * 1.6 : 0), 0, z + (z ? 1.6 : 0)); cg.rotation.y = ry; g.add(cg);
        LH.box(cg, .8, .5, 1.4, '#5a3b26', 0, 0, 0); { const br = LH.cyl(cg, .12, .2, 1.9, 12, M({ color: '#2f3236', metalness: .8, roughness: .4 }), 0, 0, 0); br.rotation.x = -Math.PI / 2 + .05; br.position.set(0, .62, -.35); }
        for (const s of [-1, 1]) LH.cyl(cg, .25, .25, .08, 12, '#3a2a1e', s * .45, .25, -.4).rotation.z = Math.PI / 2;
        c.solid(cg.position.x, cg.position.z, 1.2, 1.6); c.info(cg.position.x, cg.position.z, 1.8, '💣 대포 살펴보기', '벨렝탑엔 16개의 대포가 테주 강을 향해 있었어요. 강 입구로 들어오는 배를 지키는 요새였죠.');
      }
      // 나선 계단
      const st = new THREE.Group(); st.position.set(W / 2 - 1.3, 0, D / 2 - 1.6); g.add(st); LH.cyl(st, .18, .18, H, 10, lime, 0, 0, 0);
      for (let i = 0; i < 18; i++) { const s = LH.box(st, 1, .12, .4, lime, .55, i * .34, 0); s.parent.remove(s); const p = new THREE.Group(); p.rotation.y = i * .45; st.add(p); p.add(s); }
      c.solid(st.position.x, st.position.z, 2.2, 2.2);
      c.info(-2, -2, 2, '📖 탑 이야기', '1519년 완공. 밧줄·산호·혼천의 같은 바다 무늬로 장식한 "마누엘 양식"은 대항해시대 포르투갈의 자부심을 보여 줘요. 바스쿠 다 가마도 여기서 인도로 떠났어요.');
      c.scene.add(new THREE.HemisphereLight('#f2f6ff', '#9a8a70', .9));
      c.light('#ffe2b0', 7, 12, 0, 4.5, 0); for (const [x, z] of [[0, -3.5], [-3.5, 0], [3.5, 0]]) c.light('#d8ecff', 6, 7, x, 1.8, z);
    });
  }

  // ---------- 4. 페나 성 ----------
  function pena(door) {
    const W = 12, D = 10, H = 6.5;
    return hall(door, { W, D, H, floor: M({ map: T.marble(5, 4), roughness: .3 }), wall: M({ map: T.arab(4, 1) }), doorCol: '#6b2a1e' }, c => {
      const { g, LH } = c;
      // 아줄레주 허리벽
      for (const [w, x, z, ry] of [[W, 0, -D / 2 + .02, 0], [D, -W / 2 + .02, 0, Math.PI / 2], [D, W / 2 - .02, 0, -Math.PI / 2]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.3), M({ map: T.azulejo(w / 1.3, 1) })); m.position.set(x, .65, z); m.rotation.y = ry; g.add(m); }
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M({ map: T.mandala(3, 3) })); ceil.rotation.x = Math.PI / 2; ceil.position.y = H; g.add(ceil);
      // 샹들리에
      const ch = new THREE.Group(); ch.position.set(0, H - 1.6, 0); g.add(ch); const gold = M({ color: '#d4a937', metalness: .9, roughness: .3 });
      LH.cyl(ch, .02, .02, 1.6, 4, gold, 0, 0, 0); for (const [r, y] of [[1, 0], [.65, .45]]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r, .04, 6, 24), gold); ring.rotation.x = Math.PI / 2; ring.position.y = y; ch.add(ring); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const b = new THREE.Mesh(new THREE.SphereGeometry(.06, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff1c4' })); b.position.set(Math.cos(a) * r, y + .1, Math.sin(a) * r); ch.add(b); } }
      c.light('#ffe2a8', 14, 14, 0, H - 1.5, 0);
      // 횃불 든 금빛 조각상
      for (const [x, z] of [[-W / 2 + 1, -D / 2 + 1], [W / 2 - 1, -D / 2 + 1], [-W / 2 + 1, D / 2 - 1.5], [W / 2 - 1, D / 2 - 1.5]]) {
        LH.box(g, .7, 1, .7, '#7a6a5a', x, 0, z); const fg = ISL.person({ top: '#c9a24a', bottom: '#c9a24a', skin: '#d4a937', hair: '#b88a2a' }); fg.g.position.set(x, 1, z); fg.g.scale.setScalar(.85); fg.armR.rotation.x = -2.6; fg.g.rotation.y = Math.atan2(-x, -z); g.add(fg.g);
        fg.g.traverse(o => { if (o.isMesh) o.material = gold; }); const fl = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffcf70' })); fl.position.set(x, 3.6, z); g.add(fl); c.light('#ffb860', 2, 6, x, 3.5, z, true); c.solid(x, z, .8, .8);
      }
      // 붉은 벨벳 소파와 탁자
      for (const s of [-1, 1]) { LH.box(g, 2.6, .45, .9, '#8f1f2a', s * 3, 0, -D / 2 + 1); LH.box(g, 2.6, .7, .2, '#8f1f2a', s * 3, .45, -D / 2 + .6); c.solid(s * 3, -D / 2 + 1, 2.6, 1); c.seat(s * 3, -D / 2 + 1.1, 0, .45, '🛋️ 소파에 앉기'); }
      LH.cyl(g, .6, .6, .06, 20, '#5a3826', 0, .75, -1); LH.cyl(g, .08, .12, .75, 8, '#5a3826', 0, 0, -1); LH.cyl(g, .12, .08, .35, 10, '#2a5ea8', 0, .81, -1); c.solid(0, -1, 1.2, 1.2);
      const sg = T.stained('pena', ['#e0b13a', '#b8302a', '#2f6f9a', '#3f8a4a']);
      for (const x of [-3, 3]) c.glow(1.4, 2.6, x, 3.2, -D / 2 + .03, 0, sg);
      c.info(0, 1, 2.2, '📖 궁전 이야기', '페르난도 2세가 1840년대에 지은 낭만주의 궁전이에요. 이슬람·고딕·르네상스 양식을 마음껏 섞었고, 이 "아랍의 방"은 벽 전체를 착시 그림으로 칠했어요.');
      c.scene.add(new THREE.HemisphereLight('#fff0dc', '#6b4a30', .6));
    });
  }

  // ---------- 5. 금각사 ----------
  function kinkaku(door) {
    const W = 12, D = 8, H = 3.8;
    return hall(door, { W, D, H, floor: M({ map: T.lacquer(6, 4), roughness: .18 }), wall: M({ map: T.gold(4, 1.5), metalness: .85, roughness: .32 }), doorCol: '#2a1c14', doorW: 1.8, bg: '#1a120a' }, c => {
      const { g, LH } = c, gold = M({ map: T.gold(1, 1), metalness: .9, roughness: .28 });
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M({ map: T.gold(6, 4), metalness: .8, roughness: .35 })); ceil.rotation.x = Math.PI / 2; ceil.position.y = H; g.add(ceil);
      for (let x = -W / 2 + 1; x < W / 2; x += 1) LH.box(g, .06, .08, D, '#3a2410', x, H - .08, 0);
      for (let z = -D / 2 + 1; z < D / 2; z += 1) LH.box(g, W, .08, .06, '#3a2410', 0, H - .08, z);
      // 종 모양 창 (카토마도) — 밖에서 연못 빛이 들어옴
      const bell = ISL.LH.canvasTex(64, 96, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = '#ffffff'; x.beginPath(); x.moveTo(6, h); x.lineTo(6, 46); x.quadraticCurveTo(8, 18, 32, 4); x.quadraticCurveTo(56, 18, 58, 46); x.lineTo(58, h); x.fill(); });
      for (const s of [-1, 1]) for (const z of [-1.8, 1.8]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.5), new THREE.MeshBasicMaterial({ map: bell, transparent: true, color: '#cfe8d8', side: THREE.DoubleSide })); m.position.set(s * (W / 2 - .03), 1.9, z); m.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(m); }
      // 앞쪽 미닫이 너머 연못 풍경
      const view = ISL.LH.canvasTex(256, 128, (x, w, h) => { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#bcd8ea'); gr.addColorStop(.45, '#e6eef0'); gr.addColorStop(.5, '#4f7a4a'); gr.addColorStop(.6, '#6a9fb0'); gr.addColorStop(1, '#3f6f80'); x.fillStyle = gr; x.fillRect(0, 0, w, h); x.fillStyle = '#2f5a3a'; for (let i = 0; i < 9; i++) { x.beginPath(); x.ellipse(rnd() * w, 60 + rnd() * 8, 10 + rnd() * 20, 7, 0, 0, 7); x.fill(); } });
      c.glow(5, 2.2, 0, 1.3, -D / 2 + .03, 0, view);
      for (const x of [-2.5, -1.25, 0, 1.25, 2.5]) LH.box(g, .08, 2.4, .1, '#2a1c14', x, .2, -D / 2 + .1);
      // 석가여래 좌상
      const bg = new THREE.Group(); bg.position.set(0, 0, -1.2); g.add(bg);
      LH.box(bg, 2.4, .5, 1.6, '#2a1c14', 0, 0, 0);
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const p = LH.sphere(bg, .28, gold, Math.cos(a) * .55, .62, Math.sin(a) * .4, .5); p.scale.set(1, .5, .6); }
      LH.sphere(bg, .55, gold, 0, .95, 0, .55); // 다리
      LH.cyl(bg, .32, .42, .9, 14, gold, 0, .95, 0); LH.sphere(bg, .26, gold, 0, 2.08, 0); LH.sphere(bg, .12, gold, 0, 2.38, 0);
      for (const s of [-1, 1]) LH.cyl(bg, .09, .11, .55, 8, gold, s * .38, 1.15, .12).rotation.z = s * .5;
      const halo = new THREE.Mesh(new THREE.RingGeometry(.45, .85, 32), M({ color: '#e2b33c', metalness: .9, roughness: .25, side: THREE.DoubleSide })); halo.position.set(0, 2.1, -.3); bg.add(halo);
      c.solid(0, -1.2, 2.6, 1.8);
      for (const x of [-1.6, 1.6]) { c.candle(x, .5, -.6); }
      // 향 연기
      const smoke = new ISL.Emitter(c.scene, 60, { size: .9, color: '#d9d4cc', opacity: .25, life: 4 }); LH.cyl(g, .12, .15, .3, 10, '#5a4a30', 0, 0, .6);
      c.anim.push(dt => { if (Math.random() < .4) smoke.emit((Math.random() - .5) * .05, .35, .6, (Math.random() - .5) * .1, .35, (Math.random() - .5) * .1, 4); smoke.update(dt, .05, .2); });
      c.inter.push({ x: 0, z: .9, r: 1.4, label: '🙏 합장하기', act: () => { ISL.debug.doEmote('bow'); ISL.Audio.chime([0, 7], .05); } });
      c.info(-3, 0, 2.2, '📖 금각사 이야기', '1397년 쇼군 아시카가 요시미쓰의 별장으로 지어졌어요. 지금 건물은 1950년 화재 후 1955년에 다시 지은 것으로, 금박 약 20만 장을 붙였어요.');
      c.scene.add(new THREE.AmbientLight('#ffd9a0', .4));
      c.light('#ffd08a', 5, 9, 0, 2.8, 0, true); c.light('#ffcf70', 3, 5, 0, 1, -.2, true); c.light('#d8f0e0', 6, 8, 0, 1.5, -D / 2 + .8);
    });
  }

  // ---------- 6. 시옹성 지하 감옥 ----------
  function chillon(door) {
    const W = 10, D = 24, H = 5.6;
    return hall(door, { W, D, H, floor: M({ map: T.rock(3, 6) }), wall: M({ map: T.rock(3, 2), roughness: 1 }), doorCol: '#3a2a1e', bg: '#0e1210' }, c => {
      const { g, LH } = c, st = M({ map: T.stone('#9a9282', '#5c564c', 'chi')(1, 2) });
      // 가운데 기둥 줄과 고딕 궁륭
      for (let z = -D / 2 + 3; z < D / 2 - 2; z += 4) {
        LH.cyl(g, .45, .55, H - 1.5, 10, st, 0, 0, z); c.solid(0, z, 1.1, 1.1);
        for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const r = new THREE.Mesh(new THREE.BoxGeometry(.3, .3, Math.hypot(W / 2, 2) + .5), st); r.position.set(dx * W / 4, H - .9, z + dz * 1); r.rotation.y = Math.atan2(dx * W / 2, dz * 2); r.rotateX(-.25); g.add(r); }
      }
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M({ map: T.rock(3, 6) })); ceil.rotation.x = Math.PI / 2; ceil.position.y = H; g.add(ceil);
      // 호수 쪽 좁은 창 틈 (푸르스름한 물빛)
      for (let z = -D / 2 + 3; z < D / 2 - 3; z += 4) { c.glow(.25, 1.2, W / 2 - .03, 3.4, z + 2, -Math.PI / 2, null, '#bfe6e0'); c.light('#9fe0d8', 5, 9, W / 2 - 1, 3, z + 2); }
      // 쇠사슬 고리
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.18, .04, 6, 16), M({ color: '#3a3632', metalness: .7, roughness: .5 })); ring.position.set(0, 1.4, -D / 2 + 7 + .55); g.add(ring);
      c.info(0, -D / 2 + 11, 2, '🗿 세 번째 기둥', '시인 바이런이 1816년 이곳을 찾아 세 번째 기둥에 자기 이름 "BYRON"을 새겼어요. 그리고 이곳에 4년간 갇혔던 보니바르를 기리며 「시옹의 죄수」를 썼어요.');
      const name = ISL.LH.canvasTex(128, 32, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = 'rgba(40,30,20,.75)'; x.font = 'bold 22px serif'; x.fillText('BYRON', 22, 24); });
      const nm = new THREE.Mesh(new THREE.PlaneGeometry(.6, .15), new THREE.MeshBasicMaterial({ map: name, transparent: true })); nm.position.set(0, 1.5, -D / 2 + 11 + .56); g.add(nm);
      c.scene.add(new THREE.HemisphereLight('#a8c8c0', '#3a342c', .35));
      for (const z of [-8, 0, 8]) c.light('#ffb070', 4, 9, -W / 2 + .5, 2.2, z, true);
      for (const z of [-8, 0, 8]) LH.box(g, .2, .5, .2, '#2a2a2a', -W / 2 + .15, 2, z);
    });
  }

  // ---------- 7. 오층탑 ----------
  function pagoda(door) {
    const W = 8, D = 8, H = 4.6;
    return hall(door, { W, D, H, floor: M({ map: T.planks(3, 3) }), wall: M({ map: T.mandala(7, 2), color: '#d8c8b0' }), doorCol: '#4a2a1a', doorW: 1.6, bg: '#120c08' }, c => {
      const { g, LH } = c, gold = M({ color: '#d9a93a', metalness: .85, roughness: .3 });
      // 중심 기둥(심주)과 사방불
      const pil = new THREE.Mesh(new THREE.BoxGeometry(.8, H, .8), M({ map: T.mandala(1, 3) })); pil.position.y = H / 2; g.add(pil); c.solid(0, 0, 2.6, 2.6);
      LH.box(g, 2.6, .4, 2.6, '#5a2a1a', 0, 0, 0);
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2, x = Math.sin(a) * 1, z = Math.cos(a) * 1; const bg = new THREE.Group(); bg.position.set(x, .4, z); bg.rotation.y = a; g.add(bg);
        LH.sphere(bg, .38, gold, 0, .2, 0, .45); LH.cyl(bg, .2, .27, .55, 12, gold, 0, .25, 0); LH.sphere(bg, .16, gold, 0, .95, 0);
        const halo = new THREE.Mesh(new THREE.RingGeometry(.25, .5, 24), M({ color: '#e2b33c', metalness: .9, roughness: .25, side: THREE.DoubleSide })); halo.position.set(0, 1, -.18); bg.add(halo);
      }
      for (const [x, z] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) { LH.cyl(g, .22, .22, H, 12, '#a8402a', x, 0, z); c.solid(x, z, .5, .5); }
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; c.candle(Math.sin(a) * 2, 0, Math.cos(a) * 2); }
      const lan = new THREE.MeshStandardMaterial({ color: '#c23a2a', emissive: '#ff6a3a', emissiveIntensity: .8 });
      for (const [x, z] of [[-3.3, 0], [3.3, 0]]) LH.cyl(g, .25, .25, .5, 10, lan, x, 2.8, z);
      c.inter.push({ x: 0, z: 1.8, r: 1.4, label: '🙏 합장하기', act: () => { ISL.debug.doEmote('bow'); ISL.Audio.chime([0, 7, 12], .05); } });
      c.info(-2.5, 1, 1.8, '📖 탑 이야기', '탑 한가운데의 심주(중심 기둥)는 땅에 박혀 있지 않고 매달리듯 서 있어서, 지진이 나면 추처럼 흔들림을 잡아 줘요. 그래서 천 년 넘게 무너지지 않았대요.');
      c.scene.add(new THREE.AmbientLight('#ffcf9a', .35));
      c.light('#ffc070', 6, 9, 0, 3.6, 2.5, true); c.light('#ffc070', 4, 9, 0, 3.6, -2.5, true);
    });
  }

  const BUILDERS = { hallgrim, msm, belem, pena, kinkaku, chillon, pagoda };
  ISL.Halls = { build: door => BUILDERS[door.hall](door), names: { hallgrim: '할그림스키르캬 교회', msm: '몽생미셸 수도원', belem: '벨렝탑', pena: '페나 성', kinkaku: '금각사', chillon: '시옹성', pagoda: '오층탑' } };
})();
