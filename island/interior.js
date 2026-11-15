// 문과 실내: 집마다 여닫는 문, 지역 양식의 실내, 주민, 만질 수 있는 물건들
(function () {
  const ISL = window.ISL;
  const doors = []; ISL.doors = doors;
  const DOOR_COL = { pt: ['#2f6db5', '#3f8f7a', '#c9852e'], prov: ['#7b8fb3', '#7a9a7a'], norm: ['#5a3b28'], ch: ['#6b4226'], is: ['#f4f1ea', '#3a3f45', '#b03a2e'], turf: ['#6b3d2b'], machiya: ['#3a2a1e'], farm: ['#5a4632'] };
  const STYLE_REGION = { pt: 3, prov: 2, norm: 2, ch: 1, is: 0, turf: 0, machiya: 4, farm: 4 };
  const doorMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7 });

  // ---------- 바깥 문 ----------
  function addDoor(h, g, w, d, style, rnd) {
    const sliding = style === 'machiya' || style === 'farm';
    const dw = sliding ? 1.5 : 1.1, cols = DOOR_COL[style], c = cols[Math.floor(rnd() * cols.length)];
    const parts = [[new THREE.BoxGeometry(dw, 2.15, .1).translate(sliding ? 0 : dw / 2, 1.075, 0), c]];
    if (sliding) for (let i = -2; i <= 2; i++) parts.push([new THREE.BoxGeometry(.05, 2.1, .12).translate(i * dw / 5, 1.075, 0), '#1e150e']);
    else { parts.push([new THREE.SphereGeometry(.06, 8, 6).translate(dw - .14, 1.05, .08), '#d4a937']); parts.push([new THREE.BoxGeometry(dw - .25, .7, .12).translate(dw / 2, 1.55, 0), new THREE.Color(c).multiplyScalar(.8).getStyle()]); }
    const geo = ISL.merge(parts);
    const pivot = new THREE.Group(), mesh = new THREE.Mesh(geo, doorMat); mesh.castShadow = true; pivot.add(mesh);
    const a = g.rotation.y, cs = Math.cos(a), sn = Math.sin(a), lx = sliding ? 0 : -dw / 2, lz = d / 2 + .07;
    pivot.position.set(g.position.x + lx * cs + lz * sn, g.position.y, g.position.z - lx * sn + lz * cs); pivot.rotation.y = a;
    pivot.userData.dynamic = true; g.parent.add(pivot);
    const door = { house: h, pivot, mesh, open: 0, target: 0, sliding, dw, w, d, a, style, timer: 0, base: pivot.position.clone(),
      x: g.position.x + (d / 2 + .7) * sn, z: g.position.z + (d / 2 + .7) * cs, y: g.position.y, region: STYLE_REGION[style], seed: Math.floor(rnd() * 1e9) };
    doors.push(door); h.door = door;
    return door;
  }
  // 명소 입구 문 (크고 무거운 나무문)
  function addHallDoor(o) {
    const dw = o.w || 2.2, dh = o.h || 3.2, a = o.a, cs = Math.cos(a), sn = Math.sin(a);
    const geo = ISL.merge([[new THREE.BoxGeometry(dw, dh, .14).translate(dw / 2, dh / 2, 0), o.color || '#4a3020'], [new THREE.BoxGeometry(dw - .3, .12, .18).translate(dw / 2, dh * .3, 0), '#2a1a10'], [new THREE.BoxGeometry(dw - .3, .12, .18).translate(dw / 2, dh * .75, 0), '#2a1a10'], [new THREE.SphereGeometry(.09, 8, 6).translate(dw - .2, dh * .48, .1), '#d4a937']]);
    const pivot = new THREE.Group(), mesh = new THREE.Mesh(geo, doorMat); mesh.castShadow = true; pivot.add(mesh);
    pivot.position.set(o.x - dw / 2 * cs, o.y, o.z + dw / 2 * sn); pivot.rotation.y = a; pivot.userData.dynamic = true; o.scene.add(pivot);
    const door = { hall: o.hall, pivot, mesh, open: 0, target: 0, sliding: false, dw, w: 8, d: 8, a, style: 'hall', timer: 0, base: pivot.position.clone(), x: o.x + sn * .8, z: o.z + cs * .8, y: o.y, region: 0, seed: 1 };
    doors.push(door); return door;
  }
  function toggle(door, open) {
    door.target = open === undefined ? (door.target ? 0 : 1) : (open ? 1 : 0); door.timer = 0;
    ISL.Audio.door(door.target === 1, door.sliding);
  }
  function update(dt, camPos) {
    for (const d of doors) {
      const dist = Math.hypot(d.x - camPos.x, d.z - camPos.z);
      d.pivot.visible = dist < 180;
      if (d.target && (d.timer += dt) > 7) toggle(d, false); // 자동으로 닫힘
      if (d.open !== d.target) {
        d.open += Math.sign(d.target - d.open) * Math.min(Math.abs(d.target - d.open), dt * 2.4);
        const e = d.open * d.open * (3 - 2 * d.open);
        if (d.sliding) { const s = -d.dw * .95 * e; d.pivot.position.set(d.base.x + s * Math.cos(d.a), d.base.y, d.base.z - s * Math.sin(d.a)); }
        else d.pivot.rotation.y = d.a + e * 1.7;
      }
    }
  }
  function nearestDoor(x, z, r = 2.8) { let best = null, bd = r; for (const d of doors) { const dd = Math.hypot(d.x - x, d.z - z); if (dd < bd) { bd = dd; best = d; } } return best; }

  // ---------- 실내 재질 ----------
  const texCache = {};
  function tex(key, w, h, draw, rep) {
    if (texCache[key]) return texCache[key];
    const t = ISL.LH.canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rep) t.repeat.set(rep[0], rep[1]);
    return texCache[key] = t;
  }
  const noiseFill = (x, w, h, base, amt) => { x.fillStyle = base; x.fillRect(0, 0, w, h); for (let i = 0; i < w * h / 30; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},${Math.random() * amt})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } };
  const FLOORS = {
    wood: () => tex('fw', 256, 256, (x, w, h) => { for (let i = 0; i < 8; i++) { const c = 110 + Math.random() * 30; x.fillStyle = `rgb(${c},${c * .68},${c * .42})`; x.fillRect(0, i * 32, w, 32); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, i * 32, w, 2); x.fillRect((i * 97) % w, i * 32, 2, 32); for (let k = 0; k < 6; k++) { x.fillStyle = 'rgba(0,0,0,.06)'; x.fillRect(0, i * 32 + 4 + k * 5, w, 1); } } }),
    pine: () => tex('fp', 256, 256, (x, w, h) => { for (let i = 0; i < 6; i++) { const c = 190 + Math.random() * 25; x.fillStyle = `rgb(${c},${c * .78},${c * .55})`; x.fillRect(0, i * 43, w, 43); x.fillStyle = 'rgba(60,30,10,.4)'; x.fillRect(0, i * 43, w, 2); x.beginPath(); x.arc(Math.random() * w, i * 43 + 20, 4, 0, 7); x.fill(); } }),
    terracotta: () => tex('ft', 256, 256, (x, w, h) => { x.fillStyle = '#d9c4a6'; x.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const c = 175 + Math.random() * 30; x.fillStyle = `rgb(${c},${c * .52},${c * .32})`; x.fillRect(i * 64 + 3, j * 64 + 3, 58, 58); } }),
    tatami: () => tex('fta', 256, 512, (x, w, h) => { x.fillStyle = '#c8c28a'; x.fillRect(0, 0, w, h); for (let i = 0; i < h; i += 3) { x.fillStyle = `rgba(90,100,40,${.08 + Math.random() * .08})`; x.fillRect(0, i, w, 1); } x.fillStyle = '#2f3b2a'; x.fillRect(0, 0, 10, h); x.fillRect(w - 10, 0, 10, h); }),
    stone: () => tex('fs', 256, 256, (x, w, h) => { noiseFill(x, w, h, '#8f897f', .15); x.strokeStyle = 'rgba(40,35,30,.6)'; x.lineWidth = 3; for (let i = 0; i < 9; i++) { x.beginPath(); x.moveTo(Math.random() * w, 0); x.lineTo(Math.random() * w, h); x.stroke(); x.beginPath(); x.moveTo(0, Math.random() * h); x.lineTo(w, Math.random() * h); x.stroke(); } }),
  };
  const WALLS = {
    plaster: (c) => tex('wp' + c, 128, 128, (x, w, h) => noiseFill(x, w, h, c, .05)),
    azulejo: () => tex('wa', 256, 256, (x, w, h) => { x.fillStyle = '#f6f3ec'; x.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 2; j < 4; j++) { x.fillStyle = '#fbfaf6'; x.fillRect(i * 64 + 1, j * 64 + 1, 62, 62); x.strokeStyle = '#2a5ea8'; x.lineWidth = 3; x.beginPath(); x.arc(i * 64 + 32, j * 64 + 32, 18, 0, 7); x.stroke(); x.beginPath(); x.moveTo(i * 64 + 32, j * 64 + 4); x.lineTo(i * 64 + 32, j * 64 + 60); x.moveTo(i * 64 + 4, j * 64 + 32); x.lineTo(i * 64 + 60, j * 64 + 32); x.stroke(); x.fillStyle = '#e2a33a'; x.beginPath(); x.arc(i * 64 + 32, j * 64 + 32, 5, 0, 7); x.fill(); } x.fillStyle = '#2a5ea8'; x.fillRect(0, 124, w, 6); }),
    planks: () => tex('wk', 256, 256, (x, w, h) => { for (let i = 0; i < 8; i++) { const c = 120 + Math.random() * 30; x.fillStyle = `rgb(${c},${c * .66},${c * .4})`; x.fillRect(i * 32, 0, 32, h); x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(i * 32, 0, 2, h); } }),
    timber: () => tex('wt', 256, 256, (x, w, h) => { noiseFill(x, w, h, '#efe7d6', .04); x.fillStyle = '#4e3322'; x.fillRect(0, 0, w, 10); x.fillRect(0, h - 10, w, 10); for (const v of [0, 128]) x.fillRect(v, 0, 10, h); x.lineWidth = 8; x.strokeStyle = '#4e3322'; x.beginPath(); x.moveTo(10, h - 10); x.lineTo(128, 10); x.stroke(); }),
    shoji: () => tex('wsh', 256, 256, (x, w, h) => { x.fillStyle = '#f3efe2'; x.fillRect(0, 0, w, h); x.fillStyle = '#6b4e35'; for (let i = 0; i <= 4; i++) x.fillRect(i * 64 - 2, 0, 4, h); for (let j = 0; j <= 8; j++) x.fillRect(0, j * 32 - 2, w, 4); x.fillRect(0, 0, w, 8); }),
    stoneWall: () => tex('ws', 256, 256, (x, w, h) => { x.fillStyle = '#b7a68a'; x.fillRect(0, 0, w, h); for (let j = 0; j < 8; j++) for (let i = 0; i < 5; i++) { const c = 190 + Math.random() * 30; x.fillStyle = `rgb(${c},${c * .9},${c * .74})`; x.fillRect(i * 56 + (j % 2) * 28 - 26, j * 32 + 2, 52, 28); } }),
  };
  const STYLES = {
    pt: { floor: 'terracotta', wall: () => WALLS.azulejo(), beams: false, fire: false },
    prov: { floor: 'terracotta', wall: () => WALLS.stoneWall(), beams: true, fire: false },
    norm: { floor: 'stone', wall: () => WALLS.timber(), beams: true, fire: true },
    ch: { floor: 'pine', wall: () => WALLS.planks(), beams: true, fire: true, clock: true },
    is: { floor: 'wood', wall: () => WALLS.plaster('#f1eee6'), beams: false, fire: true },
    turf: { floor: 'wood', wall: () => WALLS.planks(), beams: true, fire: true },
    machiya: { floor: 'tatami', wall: () => WALLS.shoji(), beams: true, fire: false, jp: true },
    farm: { floor: 'tatami', wall: () => WALLS.shoji(), beams: true, fire: true, jp: true, irori: true },
  };
  const RESIDENT_LINES = [
    ['커피 한잔 할래요? 아이슬란드 사람은 하루에 커피를 다섯 잔은 마셔요. ☕', '겨울엔 해가 네 시간밖에 안 떠요. 그래서 집을 아늑하게 꾸미는 게 중요하죠.', '오늘 밤 오로라 예보가 좋대요. 꼭 하늘을 봐요!', '이 담요는 할머니가 떠 주신 거예요. 양털이라 정말 따뜻해요.'],
    ['Grüezi! 들어와요. 신발은 거기 두면 돼요.', '저 뻐꾸기 시계, 정각마다 울어요. 100년 된 거예요.', '치즈 퐁뒤 먹어 봤어요? 빵을 냄비에 빠뜨리면 벌칙이에요! 🧀', '창밖으로 산이 보이죠? 아침마다 저 산을 보며 커피를 마셔요.'],
    ['Bonjour ! 마침 빵이 구워졌어요. 🥖', '라벤더 향 맡아 봐요. 서랍마다 넣어 두면 옷에서 좋은 냄새가 나요.', '할아버지가 쓰시던 벽난로예요. 겨울밤엔 다 같이 여기 모여요.', '오늘 저녁엔 동네 광장에서 작은 음악회가 있어요.'],
    ['Olá! 앉아요, 앉아요. 정어리 구운 냄새 나죠? 🐟', '벽의 파란 타일은 아줄레주예요. 집마다 무늬가 달라요.', '저녁이면 창가에서 파두를 들어요. 마음이 차분해져요.', '에그타르트 하나 줄까요? 아, 방금 다 먹었네… 😅'],
    ['いらっしゃい! 신발은 벗어 주세요. 🙏', '다다미 냄새 좋죠? 골풀로 짜서 여름엔 시원해요.', '도코노마에는 계절에 맞는 족자와 꽃을 걸어요. 지금은 벚꽃이에요.', '차 한잔 드릴게요. 천천히 쉬다 가세요. 🍵'],
  ];
  const LOOKS = [
    { top: '#e9e4d8', pattern: '#7f2f2f', bottom: '#2c3440', hair: '#e8d6a0' }, { top: '#2f5d8f', bottom: '#4b3a2a', hair: '#7a5230', scarf: '#c8102e' },
    { top: '#f2e6d0', bottom: '#3b4a6b', hair: '#5a3825', longHair: 1 }, { top: '#8f3b2b', bottom: '#2a2a2a', hair: '#1f1712' },
    { top: '#3b5f8f', obi: '#d9c27a', skirt: 1, bottom: '#3b5f8f', hair: '#141010' },
  ];

  // ---------- 실내 만들기 ----------
  function build(door) {
    if (door.hall) return ISL.Halls.build(door);
    const LH = ISL.LH, st = STYLES[door.style], ri = door.region, rnd = ISL.mulberry32(door.seed);
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#1a1612');
    const g = new THREE.Group(); scene.add(g);
    const W = Math.max(5.2, Math.min(9, door.w - .4)), D = Math.max(5.2, Math.min(9, door.d - .4)), HT = 3;
    const phys = new ISL.Phys(4), inter = [];
    const M = (c, o) => LH.mat(c, o);
    const box = (w, h, d, m, x, y, z, ry = 0) => LH.box(g, w, h, d, m, x, y, z, ry);
    const solid = (x, z, w, d, ry = 0) => phys.add({ t: 'b', x, z, hw: w / 2, hd: d / 2, a: ry, y0: -1, y1: 3 });
    // 바닥·천장·벽
    const fT = FLOORS[st.floor]().clone(); fT.needsUpdate = true; fT.repeat.set(W / 2.5, D / 2.5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: fT, roughness: .75 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M(st.jp ? '#8a6a4a' : '#efe9dc')); ceil.rotation.x = Math.PI / 2; ceil.position.y = HT; g.add(ceil);
    const wallT = st.wall().clone(); wallT.needsUpdate = true; wallT.repeat.set(1, 1);
    const wallMat = (len) => { const t = wallT.clone(); t.needsUpdate = true; t.repeat.set(len / 3, 1); return new THREE.MeshStandardMaterial({ map: t, roughness: .9, side: THREE.DoubleSide }); };
    const wall = (len, x, z, ry, h = HT, y = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(len, h), wallMat(len)); m.position.set(x, y + h / 2, z); m.rotation.y = ry; m.receiveShadow = true; g.add(m); return m; };
    wall(W, 0, -D / 2, 0); wall(D, -W / 2, 0, Math.PI / 2); wall(D, W / 2, 0, -Math.PI / 2);
    const dw = 1.3; wall((W - dw) / 2, -(W + dw) / 4, D / 2, Math.PI); wall((W - dw) / 2, (W + dw) / 4, D / 2, Math.PI); wall(dw, 0, D / 2, Math.PI, HT - 2.25, 2.25);
    for (const [x, z, w, d] of [[0, -D / 2 - .25, W + 1, .5], [-W / 2 - .25, 0, .5, D + 1], [W / 2 + .25, 0, .5, D + 1], [-(W + dw) / 4 - .1, D / 2 + .25, (W - dw) / 2, .5], [(W + dw) / 4 + .1, D / 2 + .25, (W - dw) / 2, .5]]) solid(x, z, w, d);
    box(W, .12, .06, st.jp ? '#4e3626' : '#d8cfbf', 0, 0, -D / 2 + .03); // 걸레받이
    if (st.beams) for (let x = -W / 2 + .8; x < W / 2; x += 1.6) box(.22, .26, D, '#5a3e2a', x, HT - .26, 0);
    // 창문 (바깥 하늘빛이 비침)
    const glass = new THREE.MeshBasicMaterial({ color: '#bcd8f0' }), windows = [];
    for (const [x, z, ry] of [[-W / 2 + .02, -D / 4, Math.PI / 2], [W / 2 - .02, D / 6, -Math.PI / 2], [W / 4, -D / 2 + .02, 0]]) {
      const wg = new THREE.Group(); wg.position.set(x, 1.55, z); wg.rotation.y = ry; g.add(wg);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.2), glass); gl.position.z = .01; wg.add(gl);
      const fc = st.jp ? '#5a3e2a' : '#f4f1ea';
      for (const [w, h, px, py] of [[1.3, .1, 0, .65], [1.3, .14, 0, -.66], [.1, 1.3, .6, 0], [.1, 1.3, -.6, 0], [.05, 1.2, 0, 0], [1.2, .05, 0, 0]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, .08), M(fc)); f.position.set(px, py, .03); wg.add(f); }
      if (!st.jp) { const sill = new THREE.Mesh(new THREE.BoxGeometry(1.4, .06, .25), M(fc)); sill.position.set(0, -.72, .1); wg.add(sill); }
      windows.push(wg);
    }
    // 가구 도우미
    const items = {
      table(x, z, w, d, c = '#7a5236', h = .76) { box(w, .06, d, c, x, h - .06, z); for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(.07, h - .06, .07, c, x + sx * (w / 2 - .08), 0, z + sz * (d / 2 - .08)); solid(x, z, w, d); },
      chair(x, z, ry, c = '#6b4a30') { const cg = new THREE.Group(); cg.position.set(x, 0, z); cg.rotation.y = ry; g.add(cg); LH.box(cg, .45, .05, .45, c, 0, .44, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) LH.box(cg, .05, .44, .05, c, sx * .19, 0, sz * .19); LH.box(cg, .45, .5, .05, c, 0, .49, -.2); inter.push({ x, z, r: 1, label: '🪑 앉기', act: 'sit', seat: { x, z, ry, y: .46 } }); },
      bed(x, z, ry, blanket) { const bg = new THREE.Group(); bg.position.set(x, 0, z); bg.rotation.y = ry; g.add(bg); LH.box(bg, 1.5, .45, 2.1, '#6b4a30', 0, 0, 0); LH.box(bg, 1.4, .2, 2, '#f4f1ea', 0, .45, 0); LH.box(bg, 1.42, .08, 1.4, blanket, 0, .62, .3); LH.box(bg, .9, .14, .4, '#ffffff', 0, .66, -.7); LH.box(bg, 1.5, 1, .08, '#5a3e2a', 0, 0, -1.04); solid(x, z, ry ? 2.1 : 1.5, ry ? 1.5 : 2.1); inter.push({ x, z, r: 1.6, label: '🛏️ 잠시 쉬기', act: 'rest' }); },
      futon(x, z) { box(1.2, .12, 2, '#f1ece0', x, 0, z); box(1.22, .08, 1.3, '#3f5f8f', x, .12, z + .3); box(.6, .1, .3, '#fff', x, .13, z - .75); inter.push({ x, z, r: 1.4, label: '🛏️ 잠시 쉬기', act: 'rest' }); },
      shelf(x, z, ry) { const sg = new THREE.Group(); sg.position.set(x, 0, z); sg.rotation.y = ry; g.add(sg); LH.box(sg, 1.2, 1.9, .35, '#5e4330', 0, 0, 0); for (let k = 0; k < 4; k++) { LH.box(sg, 1.1, .03, .32, '#7a5a40', 0, .25 + k * .45, .02); for (let b = 0; b < 7; b++) if (rnd() < .8) LH.box(sg, .1, .3 + rnd() * .08, .24, ['#8f2f2f', '#2f5d8f', '#3f7a4a', '#c9a24a', '#6b3f7a'][Math.floor(rnd() * 5)], -.45 + b * .14, .28 + k * .45, .02); } solid(x, z, ry ? .4 : 1.2, ry ? 1.2 : .4); },
      wardrobe(x, z, ry, c = '#6b4a30') {
        const wg = new THREE.Group(); wg.position.set(x, 0, z); wg.rotation.y = ry; g.add(wg); LH.box(wg, 1.3, 2.1, .6, c, 0, 0, 0);
        const ds = []; for (const s of [-1, 1]) { const p = new THREE.Group(); p.position.set(s * .64, 0, .31); wg.add(p); const dm = LH.box(p, .62, 1.9, .04, new THREE.Color(c).multiplyScalar(1.15).getStyle(), -s * .31, .1, 0); LH.sphere(p, .03, '#d4a937', -s * .55, 1.1, .04); ds.push([p, s]); }
        const w = { open: 0, target: 0, ds }; anim.push(dt => { if (w.open !== w.target) { w.open += Math.sign(w.target - w.open) * Math.min(Math.abs(w.target - w.open), dt * 3); for (const [p, s] of ds) p.rotation.y = -s * w.open * 1.6; } });
        solid(x, z, ry ? .6 : 1.3, ry ? 1.3 : .6); inter.push({ x, z, r: 1.7, label: '🚪 옷장 열기/닫기', act: () => { w.target = w.target ? 0 : 1; ISL.Audio.door(!!w.target); } });
      },
      rug(x, z, w, d, c1, c2) { const t = ISL.LH.canvasTex(64, 64, (k, cw, ch) => { k.fillStyle = c1; k.fillRect(0, 0, cw, ch); k.strokeStyle = c2; k.lineWidth = 4; k.strokeRect(6, 6, cw - 12, ch - 12); k.fillStyle = c2; k.fillRect(28, 10, 8, 44); k.fillRect(10, 28, 44, 8); }); const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: t, roughness: 1 })); m.rotation.x = -Math.PI / 2; m.position.set(x, .012, z); m.receiveShadow = true; g.add(m); },
      plant(x, z) { LH.cyl(g, .22, .17, .38, 10, '#b5653a', x, 0, z); const c = ISL.canopy([[0, .75, 0, .32], [.18, .62, .1, .25], [-.15, .66, -.1, .25]], '#2f5a2a', '#7fb050', 77)[0]; const p = new THREE.Mesh(c, new THREE.MeshStandardMaterial({ vertexColors: true })); p.position.set(x, 0, z); g.add(p); solid(x, z, .5, .5); },
      picture(x, y, z, ry) { const t = ISL.LH.canvasTex(96, 64, (k, w, h) => { const sky = k.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, ['#9fc7e8', '#f2b07a', '#cfe3f0'][Math.floor(rnd() * 3)]); sky.addColorStop(1, '#fff'); k.fillStyle = sky; k.fillRect(0, 0, w, h); k.fillStyle = ['#5a7d4a', '#7a8fa0', '#6b8f5a'][Math.floor(rnd() * 3)]; k.beginPath(); k.moveTo(0, h); for (let i = 0; i <= 8; i++) k.lineTo(i * w / 8, h * (.45 + rnd() * .3)); k.lineTo(w, h); k.fill(); }); const pg = new THREE.Group(); pg.position.set(x, y, z); pg.rotation.y = ry; g.add(pg); LH.box(pg, .82, .6, .04, '#6b4a2a', 0, -.3, 0); const pm = new THREE.Mesh(new THREE.PlaneGeometry(.7, .48), new THREE.MeshStandardMaterial({ map: t })); pm.position.z = .025; pg.add(pm); },
      kitchen(x, z, w) { box(w, .9, .62, '#efe9dc', x, 0, z); box(w + .04, .05, .66, '#7a6a5a', x, .9, z); box(.5, .05, .4, '#b8c0c8', x + w / 4, .93, z); LH.cyl(g, .03, .03, .35, 6, '#b8c0c8', x + w / 4, .93, z - .2); for (let i = 0; i < 3; i++) LH.cyl(g, .12, .12, .14, 10, ['#c9452e', '#2f5d8f', '#e0b040'][i], x - w / 3 + i * .3, .95, z); solid(x, z, w, .65); },
      fireplace(x, z, ry) {
        const fg = new THREE.Group(); fg.position.set(x, 0, z); fg.rotation.y = ry; g.add(fg); LH.box(fg, 1.8, 1.2, .7, '#9a8e7e', 0, 0, 0); LH.box(fg, 2, .12, .8, '#7a6a5a', 0, 1.2, 0); LH.box(fg, 1.1, 1.8, .6, '#9a8e7e', 0, 1.3, -.05); LH.box(fg, 1, .7, .3, '#1a1512', 0, .15, .22);
        const flame = new THREE.MeshBasicMaterial({ color: '#ffb347' }); const fl = new THREE.Mesh(new THREE.ConeGeometry(.22, .5, 6), flame); fl.position.set(0, .4, .2); fg.add(fl); const fl2 = fl.clone(); fl2.position.x = .2; fl2.scale.setScalar(.7); fg.add(fl2);
        const light = new THREE.PointLight('#ff8a3a', 4, 9, 2); light.position.set(0, .7, .8); fg.add(light);
        anim.push((dt, t) => { const f = .8 + Math.sin(t * 13) * .1 + Math.sin(t * 29) * .08 + Math.random() * .08; light.intensity = 4 * f; fl.scale.y = .8 + f * .4; fl2.scale.y = .6 + f * .3; });
        solid(x, z, ry ? .8 : 1.9, ry ? 1.9 : .8); env.fire = 1; inter.push({ x, z, r: 2, label: '🔥 불 쬐기', act: 'warm' });
      },
      stove(x, z) { box(1, 1.7, .8, '#3f7a5a', x, 0, z); for (let i = 0; i < 6; i++) box(1.02, .03, .82, '#2f5a42', x, .25 + i * .26, z); box(1.1, .1, .9, '#2f5a42', x, 1.7, z); solid(x, z, 1, .8); env.fire = .4; },
      cuckoo(x, z) { const c = new THREE.Group(); c.position.set(x, 2.1, z); g.add(c); LH.box(c, .4, .45, .15, '#6b4226', 0, 0, 0); LH.mesh(c, LH.gableGeo(.4, .15, .2, .06), '#4a2a18', 0, .45, 0); const face = new THREE.Mesh(new THREE.CircleGeometry(.12, 16), M('#f4ecd8')); face.position.set(0, .22, .08); c.add(face); for (const s of [-.08, .08]) LH.cyl(c, .025, .03, .25, 6, '#c9a24a', s, -.45, 0); env.clock = 1; },
      lamp(x, z, h = 2.3) { LH.cyl(g, .01, .01, HT - h, 4, '#333', x, h, z); const shade = LH.cone(g, .32, .3, 12, st.jp ? '#f4ecd0' : '#e8d7a8', x, h - .2, z); const bulb = new THREE.Mesh(new THREE.SphereGeometry(.08, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff3c9' })); bulb.position.set(x, h - .22, z); g.add(bulb); return bulb; },
      lowtable(x, z) { box(1.2, .08, .8, '#5a3826', x, .3, z); for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(.07, .3, .07, '#5a3826', x + sx * .5, 0, z + sz * .32); solid(x, z, 1.2, .8); LH.cyl(g, .05, .06, .08, 10, '#e9e4d8', x + .2, .38, z); LH.cyl(g, .09, .07, .12, 10, '#3f5f4a', x - .2, .38, z); for (const [cx, cz] of [[0, .85], [0, -.85], [.95, 0], [-.95, 0]]) { box(.55, .1, .55, '#8f3b4a', x + cx, 0, z + cz); inter.push({ x: x + cx, z: z + cz, r: .8, label: '🧘 방석에 앉기', act: 'sit', seat: { x: x + cx, z: z + cz, ry: Math.atan2(-cx, -cz), y: .05 } }); } },
      tokonoma(x, z) { box(1.6, .15, .7, '#4e3626', x, 0, z); const t = ISL.LH.canvasTex(32, 96, (k, w, h) => { k.fillStyle = '#efe6cf'; k.fillRect(0, 0, w, h); k.fillStyle = '#e59ab0'; for (let i = 0; i < 9; i++) { k.beginPath(); k.arc(6 + Math.random() * 20, 30 + Math.random() * 40, 2.5, 0, 7); k.fill(); } k.strokeStyle = '#3a2a20'; k.lineWidth = 2; k.beginPath(); k.moveTo(4, 70); k.quadraticCurveTo(16, 40, 28, 28); k.stroke(); }); const s = new THREE.Mesh(new THREE.PlaneGeometry(.45, 1.3), new THREE.MeshStandardMaterial({ map: t })); s.position.set(x, 1.4, z - .33); g.add(s); LH.cyl(g, .1, .08, .3, 10, '#3a4a5a', x + .45, .15, z); const c = ISL.canopy([[0, .6, 0, .2], [.12, .5, 0, .15]], '#e292ab', '#ffe3ec', 9)[0]; const b = new THREE.Mesh(c, new THREE.MeshStandardMaterial({ vertexColors: true })); b.position.set(x + .45, 0, z); g.add(b); solid(x, z, 1.6, .7); },
      andon(x, z) { box(.3, .5, .3, '#efe6cf', x, .1, z); const l = new THREE.PointLight('#ffcf8a', 1.5, 5, 2); l.position.set(x, .4, z); g.add(l); return l; },
      irori(x, z) { box(1.3, .05, 1.3, '#4e3626', x, 0, z); box(1, .06, 1, '#3a3530', x, 0, z); LH.cyl(g, .01, .01, HT - .9, 4, '#222', x, .9, z); const k = LH.sphere(g, .2, '#2a2a2a', x, .75, z, .8); const l = new THREE.PointLight('#ff8a3a', 2.5, 7, 2); l.position.set(x, .5, z); g.add(l); anim.push((dt, t) => { l.intensity = 2.5 * (.8 + Math.sin(t * 11) * .1 + Math.random() * .1); }); solid(x, z, 1.3, 1.3); env.fire = .8; },
      musicbox(x, y, z) { LH.box(g, .25, .15, .18, '#8a5a3a', x, y, z); LH.box(g, .26, .02, .19, '#c9a24a', x, y + .15, z); inter.push({ x, z, r: 1.3, label: '🎵 오르골 듣기', act: () => ISL.Audio.melody(door.region) }); },
    };
    const anim = [], env = { fire: 0, clock: 0 };
    // 양식별 배치
    const L = -W / 2, R = W / 2, B = -D / 2, F = D / 2;
    let lampBulb = null, andonLight = null;
    if (st.jp) {
      items.tokonoma(0, B + .4);
      if (st.irori) items.irori(0, .2); else items.lowtable(0, .2);
      items.futon(L + .8, B + 1.4);
      andonLight = items.andon(R - .5, B + .5);
      items.plant(R - .5, F - .6);
      items.musicbox(R - .6, 0, -.2);
      lampBulb = items.lamp(0, .2, 2.4);
    } else {
      items.bed(L + .9, B + 1.2, 0, ['#c0392b', '#2e6f9e', '#7a8f4a', '#d9a83a', '#7a4a8f'][ri]);
      items.table(R - 1.4, .1, 1.3, .85, st.floor === 'pine' ? '#a8784a' : '#7a5236');
      items.chair(R - 1.4, .85, Math.PI); items.chair(R - 1.4, -.65, 0);
      items.kitchen(R - 1.1, B + .4, Math.min(2, W / 2 - .2));
      items.wardrobe(L + .45, .6, Math.PI / 2);
      items.rug(-.2, .4, 1.8, 1.3, ['#c9a24a', '#c0392b', '#7b8fb3', '#2a5ea8', '#8f3b4a'][ri], '#f4ecd8');
      if (st.fire && ri !== 1) items.fireplace(0, B + .45, 0);
      if (ri === 1) { items.stove(-.4, B + .5); items.cuckoo(R - .1 - .02, -.8); }
      items.shelf(R - .25, F - 1.4, -Math.PI / 2);
      items.plant(L + .4, F - .5);
      items.picture(L + .03, 1.7, -.6 + D / 4, Math.PI / 2); items.picture(0, 1.9, B + .03, 0);
      items.musicbox(R - 1.6, .76, .1);
      lampBulb = items.lamp(0, 0, 2.3);
      if (ri === 2) { LH.cyl(g, .08, .1, .25, 10, '#e9e4d8', R - 1.2, .76, .1); for (let i = 0; i < 6; i++) LH.cyl(g, .01, .01, .3, 3, '#7a5ab0', R - 1.2 + (rnd() - .5) * .1, 1.01, .1 + (rnd() - .5) * .1); }
      if (ri === 3) for (let i = 0; i < 4; i++) LH.sphere(g, .06, '#f0902a', R - 1.5 + i * .09, .82, .1);
      if (ri === 0) for (let i = 0; i < 3; i++) { LH.cyl(g, .04, .04, .18, 8, '#f4f1ea', R - .9 + i * .1, .76, -.1); }
    }
    // 조명
    scene.add(new THREE.AmbientLight('#ffe9cf', .35));
    const hemi = new THREE.HemisphereLight('#cfe0ff', '#6b5040', .4); scene.add(hemi);
    const lamp = new THREE.PointLight('#ffd9a0', 9, 14, 2); lamp.position.set(0, 2.35, st.jp ? .2 : 0); lamp.castShadow = true; lamp.shadow.mapSize.set(512, 512); lamp.shadow.bias = -.002; scene.add(lamp);
    const winLight = new THREE.PointLight('#cfe3ff', 0, 9, 2); winLight.position.set(L + .6, 1.6, -D / 4); scene.add(winLight);
    const winLight2 = new THREE.PointLight('#cfe3ff', 0, 9, 2); winLight2.position.set(R - .6, 1.6, D / 6); scene.add(winLight2);
    let lampOn = true;
    inter.push({ x: 0, z: F - 1.3, r: 1.2, label: '💡 불 켜기/끄기', act: () => { lampOn = !lampOn; ISL.Audio.noise && ISL.Audio.noise(.03, 'bandpass', 3000, 3, .1, ISL.Audio.master); } });
    // 바깥으로 나가는 문
    const exitPivot = new THREE.Group(); exitPivot.position.set(-dw / 2 + .05, 0, F - .04); g.add(exitPivot);
    const ed = new THREE.Mesh(door.mesh.geometry, doorMat); ed.rotation.y = Math.PI; ed.position.x = door.sliding ? 0 : 1.1; ed.scale.x = door.sliding ? .8 : 1; exitPivot.add(ed);
    const exit = { pivot: exitPivot, open: 0, target: 0 };
    anim.push(dt => { if (exit.open !== exit.target) { exit.open += Math.sign(exit.target - exit.open) * Math.min(Math.abs(exit.target - exit.open), dt * 2.4); const e = exit.open * exit.open * (3 - 2 * exit.open); if (door.sliding) exitPivot.position.x = -dw / 2 + .05 - e * 1.1; else exitPivot.rotation.y = -e * 1.6; } });
    inter.push({ x: 0, z: F - .6, r: 1.3, label: '🚪 밖으로 나가기', act: 'exit' });
    // 주민
    let resident = null;
    if (rnd() < .75) {
      const m = ISL.person(LOOKS[ri]); const rx = st.jp ? -.9 : -.6, rz = st.jp ? .2 : .2; m.g.position.set(rx, 0, rz); m.g.rotation.y = Math.PI / 4; g.add(m.g);
      phys.add({ t: 'c', x: rx, z: rz, r: .45, y0: -1, y1: 3 });
      resident = { m, x: rx, z: rz, lines: RESIDENT_LINES[ri], i: Math.floor(rnd() * 4), name: ['이웃 아주머니', '이웃 할아버지', '집주인', '이웃 아저씨', '집주인 할머니'][Math.floor(rnd() * 5)], hello: ISL.REGIONS[ri].hello };
      inter.push({ x: rx, z: rz, r: 1.8, label: `💬 ${resident.name}와(과) 이야기하기`, act: 'resident' });
      resident.m.g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    }
    g.traverse(o => { if (o.isMesh) { o.castShadow = o.castShadow || false; o.receiveShadow = true; } });
    return {
      scene, phys, inter, resident, exit, env, door, W, D, HT,
      spawn: { x: 0, z: F - 1.6, face: Math.PI },
      update(dt, t, day) {
        for (const f of anim) f(dt, t);
        lamp.intensity = lampOn ? 9 : 0; if (lampBulb) lampBulb.material.color.set(lampOn ? '#fff3c9' : '#555'); if (andonLight) andonLight.intensity = lampOn ? 1.5 : .2;
        winLight.intensity = winLight2.intensity = day * 5; glass.color.setRGB(.25 + .55 * day, .3 + .55 * day, .4 + .5 * day);
        hemi.intensity = .15 + day * .45;
      },
    };
  }

  ISL.Interior = { addHallDoor, addDoor, toggle, update, nearestDoor, build, doors };
})();
