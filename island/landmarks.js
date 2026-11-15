// 각국 명소 — 실제 생김새를 단순화해 재현
(function () {
  const ISL = window.ISL, P = ISL.P, H = ISL.H;
  const rng = ISL.mulberry32(4242);
  let scene;
  ISL.nightMats = [];
  ISL.LANDMARKS = [];
  const dyn = []; // 매 프레임 갱신 함수

  // ---------- 도우미 ----------
  const MATS = {};
  function mat(c, o) { const k = c + (o ? JSON.stringify(o) : ''); return MATS[k] || (MATS[k] = new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .82 }, o || {}))); }
  // 돌을 쌓은 벽: 월드 좌표로 벽돌 줄눈과 돌마다 다른 색을 그림
  function blockMat(c, bw, bh, extra) {
    const key = 'blk' + c + bw + bh; if (MATS[key]) return MATS[key];
    const m = new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .92 }, extra || {}));
    m.onBeforeCompile = sh => {
      sh.vertexShader = 'varying vec3 vBW; varying vec3 vBN;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vBW = (modelMatrix*vec4(transformed,1.0)).xyz; vBN = normalize(mat3(modelMatrix)*objectNormal);');
      sh.fragmentShader = 'varying vec3 vBW; varying vec3 vBN;\nfloat bhh(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        vec3 an = abs(vBN); vec2 q = an.y > max(an.x, an.z) ? vBW.xz : (an.x > an.z ? vBW.zy : vBW.xy);
        q /= vec2(${bw.toFixed(2)}, ${bh.toFixed(2)}); q.x += floor(q.y)*0.5; vec2 cell = floor(q), f = fract(q);
        float mortar = smoothstep(0.0,0.045,f.x)*smoothstep(1.0,0.955,f.x)*smoothstep(0.0,0.08,f.y)*smoothstep(1.0,0.92,f.y);
        float grain = bhh(floor(vBW.xz*7.0)+floor(vBW.y*7.0))*0.06;
        diffuseColor.rgb *= (0.84 + 0.24*bhh(cell) - grain) * mix(0.6, 1.0, mortar);`);
    };
    return MATS[key] = m;
  }
  ISL.blockMat = blockMat;
  function mesh(p, geo, m, x = 0, y = 0, z = 0, ry = 0) { const me = new THREE.Mesh(geo, typeof m === 'string' ? mat(m) : m); me.position.set(x, y, z); me.rotation.y = ry; me.castShadow = me.receiveShadow = true; p.add(me); return me; }
  let autoCol = false;
  const isDyn = o => { for (let p = o; p; p = p.parent) if (p.userData.dynamic) return true; return false; };
  // 메시로부터 충돌체 만들기 (상자 → 회전 상자, 원기둥 → 원)
  function colOf(me) {
    if (isDyn(me)) return;
    me.updateWorldMatrix(true, false);
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(); me.matrixWorld.decompose(p, q, sc);
    const gp = me.geometry.parameters, e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
    if (gp.width !== undefined) ISL.world.add({ t: 'b', x: p.x, z: p.z, hw: gp.width * sc.x / 2, hd: gp.depth * sc.z / 2, a: e.y, y0: p.y - gp.height * sc.y / 2 - .5, y1: p.y + gp.height * sc.y / 2 });
    else ISL.world.add({ t: 'c', x: p.x, z: p.z, r: Math.max(gp.radiusTop, gp.radiusBottom) * sc.x, y0: p.y - gp.height * sc.y / 2 - .5, y1: p.y + gp.height * sc.y / 2 });
  }
  const box = (p, w, h, d, m, x = 0, y = 0, z = 0, ry = 0) => { const me = mesh(p, new THREE.BoxGeometry(w, h, d), m, x, y + h / 2, z, ry); if (autoCol && w >= 1.4 && d >= 1.4 && h >= 1.2) colOf(me); return me; };
  const cyl = (p, rt, rb, h, seg, m, x = 0, y = 0, z = 0) => { const me = mesh(p, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y + h / 2, z); if (autoCol && Math.max(rt, rb) >= .7 && h >= 1.5) colOf(me); return me; };
  const cone = (p, r, h, seg, m, x = 0, y = 0, z = 0, ry = 0) => mesh(p, new THREE.ConeGeometry(r, h, seg), m, x, y + h / 2, z, ry);
  const sphere = (p, r, m, x, y, z, sy = 1) => { const s = mesh(p, new THREE.SphereGeometry(r, 16, 10), m, x, y, z); s.scale.y = sy; return s; };
  function group(x, z, ry = 0, y) { const g = new THREE.Group(); g.position.set(x, y !== undefined ? y : H(x, z), z); g.rotation.y = ry; scene.add(g); return g; }
  function landmark(id, name, region, x, z, r, desc) { ISL.LANDMARKS.push({ id, name, region, x, z, r, desc, found: false }); }

  function canvasTex(w, h, draw, srgb = true) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  // 창문이 있는 외벽 (밤에는 창문이 켜짐)
  function facade(o) {
    o = Object.assign({ wall: '#e8dcc4', win: '#3b4a5a', frame: '#ffffff', cols: 3, rows: 3, shutter: null, balcony: null, tiles: null, lit: .7 }, o);
    const draw = (x, w, h, night) => {
      x.fillStyle = night ? '#000' : o.wall; x.fillRect(0, 0, w, h);
      if (!night && o.lattice) { x.fillStyle = o.lattice; for (let i = 0; i < w; i += 5) x.fillRect(i, 0, 2, h); }
      if (!night && o.tiles) { x.fillStyle = o.tiles; for (let i = 0; i < w; i += 8) for (let j = 0; j < h; j += 8) if ((i + j) % 16 === 0) { x.fillRect(i + 1, j + 1, 6, 6); } }
      if (!night && o.corrugated) { for (let i = 0; i < w; i += 4) { x.fillStyle = 'rgba(0,0,0,.10)'; x.fillRect(i, 0, 2, h); } }
      if (!night && o.planks) { x.fillStyle = o.planks; for (let j = 0; j < h; j += 9) x.fillRect(0, j, w, 1.6); }
      if (!night && o.timber) {
        x.fillStyle = o.timber; const t = 5;
        x.fillRect(0, 0, w, t); x.fillRect(0, h - t, w, t); x.fillRect(0, h / 2 - t / 2, w, t); x.fillRect(0, 0, t, h); x.fillRect(w - t, 0, t, h);
        for (const vx of [w / 3, 2 * w / 3]) x.fillRect(vx - t / 2, 0, t, h);
        x.strokeStyle = o.timber; x.lineWidth = 4; x.beginPath(); x.moveTo(0, h); x.lineTo(w / 3, h / 2); x.moveTo(w, h); x.lineTo(2 * w / 3, h / 2); x.moveTo(w / 3, 0); x.lineTo(0, h / 2); x.moveTo(2 * w / 3, 0); x.lineTo(w, h / 2); x.stroke();
      }
      const cw = w / o.cols, ch = h / o.rows;
      for (let i = 0; i < o.cols; i++) for (let j = 0; j < o.rows; j++) {
        const wx = i * cw + cw * .28, wy = j * ch + ch * .2, ww = cw * .44, wh = ch * .55;
        if (night) { if (Math.random() < o.lit) { x.fillStyle = Math.random() < .5 ? '#ffd38a' : '#ffbf66'; x.fillRect(wx, wy, ww, wh); } continue; }
        if (o.doorGap && j === o.rows - 1 && Math.abs((i + .5) * cw - w / 2) < cw * .55) continue; // 문 자리는 비워 둠
        if (o.shutter) { x.fillStyle = o.shutter; x.fillRect(wx - ww * .45, wy, ww * .4, wh); x.fillRect(wx + ww * 1.05, wy, ww * .4, wh); }
        x.fillStyle = o.frame; x.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
        x.fillStyle = o.win; x.fillRect(wx, wy, ww, wh);
        x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(wx, wy, ww * .45, wh);
        if (o.lattice) { x.fillStyle = o.lattice; for (let k = 0; k <= 6; k++) x.fillRect(wx + k * ww / 6 - 1, wy, 2, wh); }
        if (o.balcony && (j === 1 || j === o.rows - 2)) { x.fillStyle = o.balcony; x.fillRect(i * cw + 2, wy + wh, cw - 4, 3); for (let k = 0; k < 5; k++) x.fillRect(i * cw + 3 + k * (cw - 6) / 4, wy + wh - 6, 1.5, 6); }
      }
    };
    const map = canvasTex(128, 128, (x, w, h) => draw(x, w, h, false));
    const em = canvasTex(128, 128, (x, w, h) => draw(x, w, h, true));
    const m = new THREE.MeshStandardMaterial({ map, emissiveMap: em, emissive: new THREE.Color('#ffcf88'), emissiveIntensity: 0, roughness: .85 });
    ISL.nightMats.push(m);
    return m;
  }
  function boxMats(side, top) { return [side, side, mat(top || '#777'), mat(top || '#777'), side, side]; }
  function frustumGeo(bx, bz, tx, tz, h, ox = 0, oz = 0) {
    const g = new THREE.BoxGeometry(1, 1, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), top = y > 0; p.setXYZ(i, (top ? tx : bx) * 2 * x + (top ? ox : 0), top ? h : 0, (top ? tz : bz) * 2 * z + (top ? oz : 0)); }
    g.computeVertexNormals(); return g;
  }
  // 두 점 사이를 잇는 기울어진 각기둥 (에펠탑 다리 등)
  function slantGeo(p0, s0, p1, s1, uvScale) {
    const g = new THREE.BoxGeometry(1, 1, 1), p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), top = y > 0, c = top ? p1 : p0, s = top ? s1 : s0; p.setXYZ(i, c[0] + x * s, c[1], c[2] + z * s); }
    if (uvScale) { const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]); for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(s0, s1) / uvScale, uv.getY(i) * len / uvScale); }
    g.computeVertexNormals(); return g;
  }
  function gableGeo(w, d, h, ov = .6) {
    const s = new THREE.Shape(); s.moveTo(-w / 2 - ov, 0); s.lineTo(w / 2 + ov, 0); s.lineTo(0, h); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: d + ov * 2, bevelEnabled: false }); g.translate(0, 0, -d / 2 - ov); return g;
  }
  function hipGeo(w, d, h, ov = .5) { const g = new THREE.ConeGeometry(1, h, 4); g.rotateY(Math.PI / 4); g.translate(0, h / 2, 0); g.scale((w / 2 + ov) * Math.SQRT2, 1, (d / 2 + ov) * Math.SQRT2); return g; }
  // 처마가 휘어 올라간 일본식 지붕
  function jRoofGeo(w, d, h, lift = .35) {
    const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(1 - t * .93, h * Math.pow(t, 1.8))); }
    const g = new THREE.LatheGeometry(pts, 4, Math.PI / 4); g.scale(w / 2 / .7071, 1, d / 2 / .7071);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (w / 2), z = p.getZ(i) / (d / 2), y = p.getY(i); const c = Math.pow(Math.abs(x * z), 3); p.setY(i, y + lift * h * c * (1 - y / h)); }
    g.computeVertexNormals(); return g;
  }
  function crenels(p, w, d, y, m, size = .9, gap = 1.9) {
    for (const [sx, sz, len, horiz] of [[0, d / 2, w, 1], [0, -d / 2, w, 1], [w / 2, 0, d, 0], [-w / 2, 0, d, 0]]) {
      const n = Math.max(2, Math.floor(len / gap));
      for (let i = 0; i <= n; i++) { const t = -len / 2 + i * len / n; box(p, size, size * 1.1, size, m, horiz ? t : sx, y, horiz ? sz : t); }
    }
  }
  function ringCrenels(p, r, y, n, m, size = .8, cx = 0, cz = 0) { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; box(p, size, size * 1.1, size * .8, m, cx + Math.cos(a) * r, y, cz + Math.sin(a) * r, -a); } }
  function turret(p, x, y, z, r, h, wall, dome) {
    cyl(p, r, r, h, 10, wall, x, y, z);
    const d = sphere(p, r * 1.05, dome, x, y + h, z, 1.3); d.geometry = new THREE.SphereGeometry(r * 1.05, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    cone(p, r * .2, r * 1.2, 6, dome, x, y + h + r * 1.2, z);
  }

  // 사람이 걸을 수 있는 다리 표면
  function addBridge(riverName, nx, nz, opts = {}) {
    const r = ISL.rivers.find(v => v.name === riverName); const q = ISL.riverNearest(r, nx, nz);
    const tl = Math.hypot(q.tx, q.tz); let dx = -q.tz / tl, dz = q.tx / tl;
    const sk = opts.skew || 0; const c = Math.cos(sk), s = Math.sin(sk); [dx, dz] = [dx * c - dz * s, dx * s + dz * c];
    const half = (q.w * 1.55 + (opts.extra || 4)) / Math.max(.5, Math.cos(sk));
    const ax = q.x - dx * half, az = q.z - dz * half, bx = q.x + dx * half, bz = q.z + dz * half;
    const yA = H(ax, az) + .25, yB = H(bx, bz) + .25;
    const need = q.level + (opts.clear || 2.6), arch = Math.max(0, need - (yA + yB) / 2);
    const w = { ax, az, bx, bz, hw: (opts.width || 4) / 2, yA, yB, arch, cx: q.x, cz: q.z, dx, dz, len: half * 2, level: q.level };
    ISL.walkables.push(w); return w;
  }
  ISL.deckY = function (w, t) { return w.yA + (w.yB - w.yA) * t + w.arch * Math.sin(Math.PI * t); };
  function buildDeck(w, deckMat, railMat, opts = {}) {
    const n = Math.ceil(w.len / 2.2), ang = Math.atan2(w.dx, w.dz);
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, tm = (t0 + t1) / 2;
      const y0 = ISL.deckY(w, t0), y1 = ISL.deckY(w, t1);
      const x = w.ax + (w.bx - w.ax) * tm, z = w.az + (w.bz - w.az) * tm, y = (y0 + y1) / 2;
      const seg = new THREE.Mesh(new THREE.BoxGeometry(w.hw * 2, .5, w.len / n + .1), deckMat);
      seg.position.set(x, y - .25, z); seg.rotation.set(0, ang, 0); seg.rotateX(-Math.atan2(y1 - y0, w.len / n)); seg.castShadow = seg.receiveShadow = true; scene.add(seg);
      if (railMat) for (const sd of [-1, 1]) {
        const rl = new THREE.Mesh(new THREE.BoxGeometry(.2, opts.railH || 1, w.len / n + .1), railMat);
        rl.position.set(x + Math.cos(ang) * sd * w.hw, y + (opts.railH || 1) / 2, z - Math.sin(ang) * sd * w.hw); rl.rotation.copy(seg.rotation); rl.castShadow = true; scene.add(rl);
      }
      if (opts.piers && i % opts.piers === 0 && i > 0) {
        const gy = H(x, z); if (gy < y - 1.5) { const pr = new THREE.Mesh(new THREE.BoxGeometry(w.hw * 2.1, y - gy, 1.2), opts.pierMat || deckMat); pr.position.set(x, (y + gy) / 2 - .4, z); pr.rotation.y = ang; pr.castShadow = true; scene.add(pr); }
      }
    }
    return ang;
  }

  // ============================================================
  // 계획 단계 (지형 메시를 만들기 전에: 땅 색, 나무 금지 구역, 다리)
  // ============================================================
  const plan = {};
  function planAll() {
    const T = ISL.groundTints, NT = ISL.noTree, NS = ISL.noTreeSeg;
    // 프랑스
    NT.push({ x: P.eiffel.x, z: P.eiffel.z, r: 118 });
    NS.push({ ax: P.eiffel.x, az: P.eiffel.z, bx: P.eiffel.x, bz: P.eiffel.z + 170, w: 34 });
    T.push((x, z) => { const dx = x - P.eiffel.x; let dz = z - P.eiffel.z; if (Math.abs(dx) < 66 && Math.abs(dz) < 66) return [new THREE.Color('#cbb994'), .85, 0]; dz -= 118; return Math.abs(dx) < 32 && Math.abs(dz) < 52 ? [new THREE.Color(Math.abs(dx) < 22 && Math.abs(dz) < 46 ? '#86b84e' : '#cbb994'), .85, Math.abs(dx) < 22 && Math.abs(dz) < 46 ? .3 : 0] : null; });
    T.push((x, z) => { const dx = x - P.lavender.x, dz = z - P.lavender.z; return Math.abs(dx) < 56 && Math.abs(dz) < 38 ? [new THREE.Color('#8b7558'), .8] : null; });
    NT.push({ x: P.lavender.x, z: P.lavender.z, r: 70 });
    NT.push({ x: P.msm.x, z: P.msm.z, r: 45 });
    T.push((x, z) => { const d = Math.hypot(x - P.msm.x, z - P.msm.z); if (d < 34) return [new THREE.Color('#7d7568'), .8]; if (d < 125 && ISL.Hexact && d > 34) { return [new THREE.Color('#a49a82'), .55 * ISL.sstep(125, 90, d)]; } return null; });
    // 포르투갈
    NT.push({ x: P.belem.x, z: P.belem.z, r: 22 }, { x: P.pena.x, z: P.pena.z, r: 26 });
    plan.lisbon = { x: -330, z: 452 };
    NT.push({ x: plan.lisbon.x, z: plan.lisbon.z, r: 78 });
    plan.tramR = 40;
    plan.ponte = addBridge('테주 강', -372, 525, { width: 6, extra: 6, clear: 9 });
    // 교토
    NT.push({ x: P.kinkaku.x, z: P.kinkaku.z, r: 52 });
    T.push((x, z) => { const d = Math.hypot(x - P.kinkaku.x, z - P.kinkaku.z); return d < 50 ? [new THREE.Color('#5d8a3e'), .5] : null; });
    const ip = [[436, 420], [452, 404], [446, 384], [466, 370], [482, 352], [498, 344], [510, 328], [508, 310]];
    plan.inari = ISL.catmull(ip, .62); // 실제처럼 거의 맞닿게 촘촘히
    for (let i = 0; i < ip.length - 1; i++) NS.push({ ax: ip[i][0], az: ip[i][1], bx: ip[i + 1][0], bz: ip[i + 1][1], w: 4 });
    T.push((x, z) => { for (let i = 0; i < ip.length - 1; i++) if (ISL.segDist(x, z, ip[i][0], ip[i][1], ip[i + 1][0], ip[i + 1][1]).d < 1.7) return [new THREE.Color('#9c8466'), .85, 0]; return null; });
    NT.push({ x: P.pagoda.x, z: P.pagoda.z, r: 18 });
    plan.bamboo = { x: 352, z: 528 };
    NT.push({ x: plan.bamboo.x, z: plan.bamboo.z, r: 42 });
    T.push((x, z) => { const d = ISL.segDist(x, z, 322, 512, 384, 548).d; return d < 2.2 && Math.hypot(x - plan.bamboo.x, z - plan.bamboo.z) < 44 ? [new THREE.Color('#a08c6a'), .85] : null; });
    plan.togetsu = addBridge('가쓰라 강', 400, 500, { width: 5, extra: 5, clear: 2 });
    // 아이슬란드
    NT.push({ x: P.hallgrim.x, z: P.hallgrim.z, r: 70 }, { x: P.geysir.x, z: P.geysir.z, r: 32 }, { x: P.lagoon.x, z: P.lagoon.z, r: 45 });
    T.push((x, z) => { const d = Math.hypot(x - P.geysir.x, z - P.geysir.z); return d < 26 ? [new THREE.Color(d < 9 ? '#d8d2c0' : '#a8875a'), d < 9 ? .9 : .6 * (1 - d / 26)] : null; });
    T.push((x, z) => { const d = Math.hypot(x - P.lagoon.x, z - P.lagoon.z); return d < 45 && d > 28 ? [new THREE.Color('#2a292c'), .8] : null; });
    const bc = P.blackCoast; plan.basalt = { x: bc.x - bc.dirx * 16, z: bc.z - bc.dirz * 16, dx: bc.dirx, dz: bc.dirz };
    NT.push({ x: plan.basalt.x, z: plan.basalt.z, r: 60 });
    T.push((x, z) => { const d = Math.hypot(x - plan.basalt.x, z - plan.basalt.z); if (d > 110) return null; const h = ISL.H(x, z); return h < 5 ? [new THREE.Color('#232327'), .9 * ISL.sstep(110, 70, d)] : null; });
    // 계단밭: 포도(라보·도우루), 계단식 논(다나다)
    const terr = (cx, cz, r, col, g) => (x, z) => Math.hypot(x - cx, z - cz) < r && ISL.slopeAt(x, z) < .2 ? [new THREE.Color(col), .8, g] : null;
    T.push(terr(P.lavaux.x, P.lavaux.z, 36, '#8a7352', .05), terr(P.douro.x, P.douro.z, 52, '#9a7a52', .05), terr(P.tanada.x, P.tanada.z, 54, '#7fb84a', .65));
    NT.push({ x: P.lavaux.x, z: P.lavaux.z, r: 40 }, { x: P.douro.x, z: P.douro.z, r: 55 }, { x: P.tanada.x, z: P.tanada.z, r: 56 });
    // 요쿨살론: 빙하 혀가 호수까지 내려옴
    const J = P.jokul, gx = 60 - J.x, gz = -585 - J.z, gl = Math.hypot(gx, gz);
    T.push((x, z) => { const dx = x - J.x, dz = z - J.z, d = Math.hypot(dx, dz); if (d > 95 || d < 30) return null; const along = (dx * gx + dz * gz) / gl; const side = Math.abs((dx * gz - dz * gx) / gl); return along > 10 && side < 26 + along * .25 ? [new THREE.Color('#dbe9f3'), .9 * ISL.sstep(95, 70, d), 0] : null; });
    NT.push({ x: J.x, z: J.z, r: 60 }, { x: P.etretat.x, z: P.etretat.z, r: 40 }, { x: P.algarve.x, z: P.algarve.z, r: 50 });
    plan.fossbridge = addBridge('스코가 강', -176, -390, { width: 3, extra: 3, clear: 1.5 });
    // 스위스
    NT.push({ x: P.chillon.x, z: P.chillon.z, r: 16 }, { x: 182, z: -32, r: 42 });
    plan.kapell = addBridge('센-론 강', 182, -32, { width: 3.6, extra: 6, clear: 2.2, skew: .5 });
    plan.iena = addBridge('센-론 강', -150, 40, { width: 9, extra: 6, clear: 3 });
    plan.chalets = [];
    for (let k = 0; k < 400 && plan.chalets.length < 16; k++) {
      const a = rng() * Math.PI * 2, r = 20 + rng() * 120, x = 300 + Math.cos(a) * r, z = -40 + Math.sin(a) * r;
      const h = H(x, z); if (h < 6 || ISL.slopeAt(x, z) > .18 || ISL.waterAt(x, z).level > h - 1) continue;
      if (ISL.regionAt(x, z).id !== 'swiss') continue;
      let near = false; for (const r2 of ISL.rivers) { const q = ISL.riverNearest(r2, x, z); if (q && q.d < q.w + 6) near = true; }
      if (near || plan.chalets.some(c => Math.hypot(c.x - x, c.z - z) < 16) || Math.hypot(x - 330, z - 40) < 72 || Math.hypot(x - 182, z + 32) < 48) continue;
      plan.chalets.push({ x, z, ry: rng() * Math.PI }); NT.push({ x, z, r: 9 });
    }
    // 파리 건물 위치
    plan.paris = [];
    for (let i = -6; i <= 6; i++) for (let j = -5; j <= 4; j++) {
      const x = -110 + i * 17 + (rng() - .5) * 1.2, z = 40 + j * 17 + (rng() - .5) * 1.2;
      if (Math.abs(x - P.eiffel.x) < 82 && Math.abs(z - P.eiffel.z) < 82) continue;
      if (Math.abs(x - P.eiffel.x) < 42 && z > P.eiffel.z && z < P.eiffel.z + 180) continue;
      const q = ISL.riverNearest(ISL.rivers[0], x, z); if (q && q.d < q.w + 12) continue;
      if (rng() < .25) continue;
      if (Math.hypot(x - -110, z - 40) > 105) continue;
      plan.paris.push({ x, z }); NT.push({ x, z, r: 10 });
    }
    // 레이캬비크 집
    plan.reyk = [];
    for (let k = 0; k < 300 && plan.reyk.length < 26; k++) {
      const a = rng() * Math.PI * 2, r = 26 + rng() * 44, x = P.hallgrim.x + Math.cos(a) * r, z = P.hallgrim.z + Math.sin(a) * r;
      if (Math.abs(x - P.hallgrim.x) < 18 && z > P.hallgrim.z - 30) continue;
      if (plan.reyk.some(c => Math.hypot(c.x - x, c.z - z) < 9) || ISL.slopeAt(x, z) > .25) continue;
      plan.reyk.push({ x, z, ry: Math.round(rng() * 4) * Math.PI / 2 });
    }
  }

  // ============================================================
  // 프랑스
  // ============================================================
  function buildEiffel() {
    const { x, z } = P.eiffel; const g = group(x, z); const S = ISL.EIFFEL_S = 4.6; g.scale.setScalar(S); // 모델 72 → 실제 330m
    const latTex = canvasTex(64, 64, (c, w, h) => {
      c.clearRect(0, 0, w, h); c.strokeStyle = '#fff'; c.lineWidth = 7; c.strokeRect(3, 3, w - 6, h - 6);
      c.lineWidth = 4; c.beginPath(); c.moveTo(0, 0); c.lineTo(w, h); c.moveTo(w, 0); c.lineTo(0, h); c.stroke();
      c.lineWidth = 3; c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.stroke();
    });
    latTex.wrapS = latTex.wrapT = THREE.RepeatWrapping;
    const lat = new THREE.MeshStandardMaterial({ color: '#7a5d44', map: latTex, alphaTest: .5, side: THREE.DoubleSide, roughness: .6, metalness: .35 });
    const solid = mat('#654b37', { roughness: .6, metalness: .3 });
    const add = geo => mesh(g, geo, lat);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      add(slantGeo([sx * 14.5, 0, sz * 14.5], 5.6, [sx * 8.4, 13, sz * 8.4], 3.4, 1.6));
      box(g, 6.2, .32, 6.2, ISL.blockMat('#c9bfae', .5, .3), sx * 14.5, -.1, sz * 14.5); ISL.colCircle(x + sx * 14.5 * S, z + sz * 14.5 * S, 3.6 * S, -1e9, H(x, z) + 30);
      add(slantGeo([sx * 7.8, 14.4, sz * 7.8], 3.1, [sx * 4.6, 27.2, sz * 4.6], 2.1, 1.4));
    }
    // 1층 아치
    for (let k = 0; k < 4; k++) {
      const a = new THREE.Mesh(new THREE.TorusGeometry(10.2, .42, 6, 36, Math.PI), solid);
      a.position.set(k % 2 ? 0 : (k ? -1 : 1) * 11.6, 2.6, k % 2 ? (k === 1 ? 1 : -1) * 11.6 : 0); a.rotation.y = k % 2 ? 0 : Math.PI / 2; a.castShadow = true; g.add(a);
    }
    box(g, 19.5, 1.6, 19.5, solid, 0, 12.6, 0);
    add(new THREE.BoxGeometry(20, 1.6, 20)).position.y = 14.9;
    box(g, 11, 1.2, 11, solid, 0, 27, 0);
    add(new THREE.BoxGeometry(11.4, 1.2, 11.4)).position.y = 28.8;
    add(slantGeo([0, 29.4, 0], 9.6, [0, 61, 0], 2.4, 1.4));
    add(slantGeo([0, 29.4, 0], 6, [0, 50, 0], 1.6, 1.4));
    box(g, 4, 1.6, 4, solid, 0, 61, 0); box(g, 2.6, 2.6, 2.6, solid, 0, 62.6, 0);
    cyl(g, .35, .55, 5, 8, solid, 0, 65.2, 0); cyl(g, .1, .2, 3.5, 6, solid, 0, 70.2, 0);
    // 밤의 반짝이는 조명
    // 밤 조명: 금빛 조명(밤 내내) + 반짝이(정각마다). 낮에는 아예 보이지 않음
    const lamp = new THREE.MeshBasicMaterial({ color: '#ffcf70', transparent: true, opacity: 1, depthWrite: false });
    const sparkle = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const lampGeo = new THREE.SphereGeometry(.06, 5, 3), N = 600;
    const im = new THREE.InstancedMesh(lampGeo, lamp, N), sm = new THREE.InstancedMesh(lampGeo, sparkle, N), mm = new THREE.Matrix4();
    for (let i = 0; i < N; i++) {
      const y = Math.pow(rng(), 1.15) * 62, half = y < 13 ? 14.5 - y * .47 : y < 28 ? 8 - (y - 13) * .23 : 4.8 - (y - 28) * .07;
      const side = Math.floor(rng() * 4), t = (rng() * 2 - 1) * half;
      mm.makeTranslation(side < 2 ? t : (side === 2 ? 1 : -1) * (half + .05), y + 1, side < 2 ? (side ? 1 : -1) * (half + .05) : t); im.setMatrixAt(i, mm); sm.setMatrixAt(i, mm);
    }
    im.visible = sm.visible = false; im.frustumCulled = sm.frustumCulled = false; g.add(im); g.add(sm);
    ISL.eiffelLights = { im, sm, sparkle, sm2: sm };
    const beacon = new THREE.Mesh(new THREE.ConeGeometry(.8, 60, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#fff4d0', transparent: true, opacity: .08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beacon.position.set(0, 72, 30); beacon.rotation.x = Math.PI / 2; const bg = new THREE.Group(); bg.position.y = 0; bg.add(beacon); bg.visible = false; g.add(bg); ISL.eiffelLights.beacon = bg;
    landmark('eiffel', '에펠탑', 'france', x, z, 150, '1889년 파리 만국박람회 때 세워진 철탑. 약 7,300톤의 연철로 만들어졌고, 밤마다 반짝이는 조명 쇼를 해요.');

    // 이에나 다리
    const w = plan.iena; const stone = mat('#cfc6b4');
    buildDeck(w, stone, mat('#bdb3a0'), { piers: 4, pierMat: stone });
  }

  function haussmann(x, z) {
    const w = 11 + rng() * 2.4, d = 11 + rng() * 2.4, h = 17 + rng() * 3; // 오스만 건물: 6층 약 18m
    const g = group(x, z, Math.round(rng() * 2) * Math.PI / 2, H(x, z) - .5);
    const f = facadeCache.paris || (facadeCache.paris = facade({ wall: '#e9dfc9', win: '#3d4756', frame: '#f4efe4', cols: 4, rows: 6, balcony: '#2b2b2b', lit: .6 }));
    colOf(mesh(g, new THREE.BoxGeometry(w, h, d), boxMats(f, '#5f6b78'), 0, h / 2, 0)); ISL.world.list[ISL.world.list.length - 1].kind = 'city';
    mesh(g, frustumGeo(w / 2 + .3, d / 2 + .3, w / 2 - 1.6, d / 2 - 1.6, 3.4), mat('#5f6b78', { roughness: .5, metalness: .4 }), 0, h, 0);
    for (let i = 0; i < 3; i++) box(g, .8, 1.6, 1.8, '#c4a58a', (rng() - .5) * (w - 4), h + 2.8, (rng() - .5) * (d - 4));
  }
  const facadeCache = {};

  function buildLavender() {
    const { x: cx, z: cz } = P.lavender;
    const geo = ISL.merge([[new THREE.IcosahedronGeometry(.75, 1).scale(.9, .85, .62).translate(0, .45, 0), '#ffffff']]);
    const list = [];
    for (let r = -36; r <= 36; r += 2.4) for (let c = -54; c <= 54; c += 1.25) {
      const x = cx + c, z = cz + r + Math.sin(c * .05) * .8;
      list.push({ x, y: H(x, z) - .1, z, s: .85 + rng() * .35, color: new THREE.Color().setHSL(.73 + rng() * .04, .5 + rng() * .15, .42 + rng() * .1), ry: 0 });
    }
    ISL.placeInstances(scene, geo, list, { shadow: false, material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 }) });
    // 프로방스 농가 (마스)
    const g = group(cx + 68, cz - 6, -.2);
    const wall = facade({ wall: '#dcc8a2', win: '#40566b', frame: '#c9b48d', shutter: '#5f8fb3', cols: 3, rows: 2, lit: .5 });
    colOf(mesh(g, new THREE.BoxGeometry(14, 6, 8), boxMats(wall, '#b85c35'), 0, 3, 0));
    mesh(g, gableGeo(8, 14, 2.2, .7), mat('#bf6a3f'), 0, 6, 0, Math.PI / 2);
    mesh(g, new THREE.BoxGeometry(6, 4.5, 6), boxMats(wall, '#b85c35'), -8, 2.25, 2);
    mesh(g, gableGeo(6, 6, 1.6, .5), mat('#bf6a3f'), -8, 4.5, 2);
    // 사이프러스 길
    const cyp = []; for (let i = 0; i < 10; i++) { const x = cx - 62, z = cz - 40 + i * 8; cyp.push({ x, y: H(x, z), z, s: .9 + rng() * .3 }); }
    ISL.placeInstances(scene, 'cypress', cyp);
    landmark('lavender', '프로방스 라벤더 밭', 'france', cx, cz, 60, '6~7월이면 남프랑스 발랑솔 고원이 보랏빛 라벤더로 물들어요. 줄지어 심은 이랑이 바다처럼 펼쳐지죠.');
  }

  function buildMSM() {
    const { x, z } = P.msm; const g = group(x, z, 0, 0);
    const stone = blockMat('#a39b8d', .9, .45), stone2 = blockMat('#8f887b', .8, .4), roof = mat('#3f4048'), slate = mat('#4a4c55', { roughness: .5 });
    // 성벽과 원형 탑
    for (let i = 0; i <= 22; i++) {
      const a = -1.9 + i * .16, r = 31, px = Math.cos(a) * r, pz = Math.sin(a) * r, gy = H(x + px, z + pz);
      box(g, 4.6, 6, 1.6, stone, px, gy - 1, pz, -a + Math.PI / 2);
      if (i % 4 === 0) { cyl(g, 2.3, 2.5, 8, 12, stone2, px, gy - 1, pz); ringCrenels(g, 2.2, gy + 7, 8, stone2, .6, px, pz); }
    }
    // 마을 집들 (나선형으로 언덕을 오름)
    for (let i = 0; i < 46; i++) {
      const a = -1.6 + i * .19, r = 26 - i * .38, px = Math.cos(a) * r, pz = Math.sin(a) * r, gy = H(x + px, z + pz);
      const w = 3 + rng() * 1.5, h = 4 + rng() * 3;
      const hm = box(g, w, h, 3.4, rng() < .3 ? '#b8a690' : '#a49b8b', px, gy - .5, pz, -a + Math.PI / 2);
      mesh(g, gableGeo(w, 3.4, 2.2, .3), roof, px, gy - .5 + h, pz, -a + Math.PI / 2);
    }
    // 수도원
    const top = H(x, z);
    box(g, 18, 8, 12, stone2, 0, top - 2, 0);
    box(g, 17, 8, 6, stone, 0, top + 6, -1);
    mesh(g, gableGeo(6, 17, 4.5, .3), slate, 0, top + 14, -1, Math.PI / 2);
    box(g, 6, 7, 10, stone, -2, top + 6, 4);
    mesh(g, gableGeo(6, 10, 4, .3), slate, -2, top + 13, 4);
    box(g, 12, 12, 4, stone2, 0, top - 2, -8);
    box(g, 4, 6, 4, stone, 0, top + 14, -1);
    const sp = cone(g, 2.6, 16, 8, slate, 0, top + 20, -1);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; cone(g, .5, 4, 6, slate, Math.cos(a) * 2.3, top + 19, -1 + Math.sin(a) * 2.3); }
    cyl(g, .12, .12, 3, 6, slate, 0, top + 36, -1);
    const gold = mat('#e7b84a', { metalness: 1, roughness: .25 });
    sphere(g, .45, gold, 0, top + 39.5, -1, 1.6); cone(g, .3, 1.4, 6, gold, .5, top + 39.2, -1);
    landmark('msm', '몽생미셸', 'france', x, z, 70, '노르망디 앞바다의 바위섬 위에 지은 수도원. 밀물 때는 섬이, 썰물 때는 갯벌 위의 언덕이 돼요. 첨탑 끝에는 금빛 미카엘 대천사상이 있어요.');
  }

  // ============================================================
  // 포르투갈
  // ============================================================
  function buildBelem() {
    const { x, z } = P.belem; const dir = Math.atan2(P.belemCoast.dirx, P.belemCoast.dirz);
    const g = group(x, z, dir, 0.6); g.scale.setScalar(1.3); // 실제 높이 30m
    const lime = blockMat('#ece4cf', 1.1, .5), lime2 = blockMat('#ddd3ba', 1.1, .5), dome = mat('#e6dcc4');
    // 바다 쪽 다각형 보루
    cyl(g, 9, 9.8, 6, 8, lime2, 0, -2, 5);
    ringCrenels(g, 8.6, 4, 22, lime, .9, 0, 5);
    for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i + .5) * Math.PI / 6 + Math.PI / 2; turret(g, Math.sin(a) * 9.2, 4, 5 + Math.cos(a) * 9.2, .55, 1.6, lime, dome); }
    // 탑
    box(g, 8, 20, 8, lime, 0, 0, -3);
    box(g, 6.4, 2.4, 1.8, lime2, 0, 11, 1.5);
    for (let i = -1; i <= 1; i++) box(g, 1.2, 1.8, .2, '#3d3a35', i * 1.9, 11.6, 2.45);
    for (let k = 0; k < 3; k++) for (const sx of [-1, 1]) box(g, .2, 2, 1.2, '#3d3a35', sx * 4.05, 6 + k * 5, -3);
    const rope = new THREE.Mesh(new THREE.TorusGeometry(5.8, .22, 6, 4), lime2); rope.rotation.set(Math.PI / 2, 0, Math.PI / 4); rope.position.set(0, 9.5, -3); g.add(rope);
    crenels(g, 8, 8, 20, lime, .9, 1.8);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) turret(g, sx * 4.1, 18.5, -3 + sz * 4.1, .65, 2.4, lime, dome);
    box(g, 5, 3, 5, lime, 0, 20, -3); crenels(g, 5, 5, 23, lime, .7, 1.4);
    landmark('belem', '벨렝탑', 'portugal', x, z, 35, '대항해시대에 테주 강 하구를 지키던 16세기 요새. 마누엘 양식의 밧줄 장식과 작은 둥근 망루들이 특징이에요.');
  }

  function buildLisbon() {
    const { x: cx, z: cz } = plan.lisbon;
    const pal = [['#f2c14e', 0], ['#ea9f9b', 0], ['#ffffff', '#3f78c4'], ['#e07b39', 0], ['#7fb2d9', 0], ['#f6efe0', 0], ['#d9534f', 0], ['#9ccf9a', 0]];
    const fs = pal.map(([w, t]) => facade({ wall: w, win: '#3a4655', frame: '#fbf7ee', tiles: t || null, cols: 2, rows: 3, balcony: rng() < .5 ? '#333' : null, lit: .65 }));
    const roof = mat('#c4572e');
    let n = 0;
    for (let k = 0; k < 0 && n < 130; k++) { // 옛 무작위 집 → streets.js의 알파마 골목으로 대체
      const a = rng() * Math.PI * 2, r = 8 + rng() * 68, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (Math.abs(r - plan.tramR) < 6) continue;
      const h0 = H(x, z); if (h0 < 2 || ISL.slopeAt(x, z) > .45) continue;
      const q = ISL.riverNearest(ISL.rivers[3], x, z); if (q && q.d < q.w + 5) continue;
      if (Math.hypot(x - P.belem.x, z - P.belem.z) < 25) continue;
      const w = 5 + rng() * 2, d = 6 + rng() * 2, h = 6 + Math.floor(rng() * 3) * 2.6;
      const g = group(x, z, -a + Math.PI / 2, h0 - 1.2);
      colOf(mesh(g, new THREE.BoxGeometry(w, h + 1.2, d), boxMats(fs[Math.floor(rng() * fs.length)], '#c4572e'), 0, (h + 1.2) / 2, 0));
      mesh(g, hipGeo(w, d, 1.8, .4), roof, 0, h + 1.2, 0);
      n++;
    }
    // 노란 28번 트램
    const tram = new THREE.Group(); tram.userData.dynamic = true; scene.add(tram);
    box(tram, 2.4, 2.2, 7, '#f2c200', 0, .5, 0); box(tram, 2.45, .9, 7.05, '#ffffff', 0, 2.2, 0);
    box(tram, 2.5, .7, 6, '#2c3e50', 0, 1.6, 0); box(tram, 2.2, .3, 6.6, '#777', 0, 3.1, 0);
    box(tram, .1, 1.5, .1, '#333', 0, 3.4, -1.5);
    for (const sz of [-2.4, 2.4]) box(tram, 2.2, .5, 1.2, '#222', 0, 0, sz);
    const head = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff3c0', emissiveIntensity: 0 }); ISL.nightMats.push(head);
    mesh(tram, new THREE.SphereGeometry(.22, 8, 6), head, 0, 1.2, 3.55);
    let ta = 0;
    dyn.push(dt => {
      const L = ISL.tramLane; if (!L) return; ta += dt * 3.2; const per = 2 * (L.len - 10), q = ta % per, s = q < per / 2 ? q : per - q, t = 5 + s;
      const x = L.ax + L.ux * t, z = L.az + L.uz * t, ahead = H(L.ax + L.ux * Math.min(L.len, t + 3), L.az + L.uz * Math.min(L.len, t + 3)) - H(L.ax + L.ux * Math.max(0, t - 3), L.az + L.uz * Math.max(0, t - 3));
      tram.position.set(x, H(x, z) + .1, z); tram.rotation.set(0, L.ry + (q < per / 2 ? 0 : Math.PI), 0); tram.rotateX(-Math.atan2(ahead, 6) * (q < per / 2 ? 1 : -1));
      if (ISL.debug && ISL.debug.player) { const pl = ISL.debug.player; if (Math.hypot(pl.x - x, pl.z - z) < 4 && Math.abs(pl.y - H(x, z)) < 3 && ISL.Audio && Math.random() < dt * .3) ISL.Audio.chime([12, 12], .04); }
    });
    ISL.tram = tram;
    landmark('lisbon', '리스본 언덕과 28번 트램', 'portugal', cx, cz, 70, '알록달록한 집과 아줄레주(파란 타일) 외벽 사이로 노란 트램이 덜컹거리며 언덕을 올라요.');

    // 4월 25일 다리
    const w = plan.ponte, red = mat('#c0392b', { roughness: .6 });
    const ang = buildDeck(w, red, red, { railH: .8 });
    const towerT = [.3, .7], deckTop = t => ISL.deckY(w, t);
    const tops = [];
    for (const t of towerT) {
      const x = w.ax + (w.bx - w.ax) * t, z = w.az + (w.bz - w.az) * t, gy = Math.min(H(x, z), w.level - 2), y0 = deckTop(t), top = y0 + 22;
      for (const sd of [-1, 1]) { const px = x + Math.cos(ang) * sd * (w.hw + .7), pz = z - Math.sin(ang) * sd * (w.hw + .7); const m = box(scene, 1.2, top - gy, 1.2, red, px, gy, pz); m.rotation.y = ang; }
      for (const yy of [y0 - 1, top - 4, top - .6]) { const m = box(scene, w.hw * 2 + 2.6, .9, 1, red, x, yy, z); m.rotation.y = ang; }
      tops.push([x, top, z]);
    }
    const cableMat = new THREE.LineBasicMaterial({ color: '#a8322a' });
    for (const sd of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= 60; i++) {
        const t = i / 60, x = w.ax + (w.bx - w.ax) * t, z = w.az + (w.bz - w.az) * t;
        let y;
        if (t < .3) y = deckTop(t) + .8 + (tops[0][1] - deckTop(t) - .8) * Math.pow(t / .3, 1.6);
        else if (t > .7) y = deckTop(t) + .8 + (tops[1][1] - deckTop(t) - .8) * Math.pow((1 - t) / .3, 1.6);
        else { const u = (t - .3) / .4; y = deckTop(t) + 1.2 + (tops[0][1] - deckTop(t) - 1.2) * Math.pow(2 * u - 1, 2); }
        pts.push(new THREE.Vector3(x + Math.cos(ang) * sd * (w.hw + .7), y, z - Math.sin(ang) * sd * (w.hw + .7)));
      }
      const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, .22, 5), red); cable.castShadow = true; scene.add(cable);
    }
  }

  function buildPena() {
    const { x, z } = P.pena; const g = group(x, z, .4, P.pena.y - .5);
    const grey = blockMat('#8d8a83', 1, .5), red = mat('#b9473c'), yel = mat('#e8bb42'), dome = mat('#7d8c95', { roughness: .4, metalness: .3 }), wh = mat('#efe6d6');
    box(g, 30, 4, 22, grey, 0, -1, 0); crenels(g, 30, 22, 3, grey, .9, 2.2);
    box(g, 13, 10, 10, red, -6, 3, -3); crenels(g, 13, 10, 13, yel, .8, 1.6);
    box(g, 14, 8, 9, yel, 7, 3, 2); crenels(g, 14, 9, 11, red, .8, 1.6);
    for (let i = -2; i <= 2; i++) box(g, 1.4, 2.4, .2, '#5b3a2e', 7 + i * 2.6, 5, 6.55);
    box(g, 4.4, 18, 4.4, red, -9, 3, 3); crenels(g, 4.4, 4.4, 21, yel, .7, 1.3);
    cyl(g, 1.6, 1.6, 3, 10, yel, -9, 22, 3); sphere(g, 1.7, dome, -9, 25, 3, 1.4); cone(g, .3, 1.8, 6, dome, -9, 27, 3);
    sphere(g, .6, wh, -9, 16, 5.25);
    cyl(g, 3.4, 3.6, 13, 14, wh, 8, 3, -6); sphere(g, 3.6, dome, 8, 16, -6, 1.15); cone(g, .5, 2.4, 8, dome, 8, 19.5, -6);
    ringCrenels(g, 3.5, 15.6, 14, wh, .6, 8, -6);
    for (const [tx, tz, m] of [[-13, -8, yel], [13, 8, red], [14, -9, yel], [-14, 9, red], [1, -9, wh]]) turret(g, tx, 3, tz, 1, 7, m, dome);
    landmark('pena', '페나 성', 'portugal', x, z, 40, '신트라 산꼭대기의 낭만주의 궁전. 빨강과 노랑으로 칠한 탑과 양파 모양 돔이 동화 속 성 같아요.');
  }

  // ============================================================
  // 교토
  // ============================================================
  function buildKinkaku() {
    const cx = 280, cz = 377; const g = group(cx, cz, 0, P.kinkaku.y - .3); g.scale.setScalar(.72); // 실제 높이 12.5m
    const gold = mat('#e2b33c', { metalness: 1, roughness: .22 }), wood = mat('#3d2f26'), plaster = mat('#ece6d6'), roof = mat('#3a302a', { roughness: .9 });
    box(g, 15, .8, 11, '#8f8b84', 0, -.2, 0);
    box(g, 13.5, 4, 9.5, plaster, 0, .6, 0);
    for (let i = -3; i <= 3; i++) { box(g, .35, 4, .35, wood, i * 2.2, .6, 4.8); box(g, .35, 4, .35, wood, i * 2.2, .6, -4.8); }
    box(g, 14, .4, 10, wood, 0, 4.5, 0);
    mesh(g, jRoofGeo(17.5, 13, 1.6, .25), roof, 0, 4.9, 0);
    box(g, 12.5, 3.6, 8.5, gold, 0, 5.6, 0);
    box(g, 13.4, .25, 9.4, gold, 0, 6.2, 0);
    mesh(g, jRoofGeo(16, 12, 1.6, .3), roof, 0, 9.2, 0);
    box(g, 7, 3.2, 7, gold, 0, 10.2, 0);
    mesh(g, jRoofGeo(10.5, 10.5, 3.6, .35), roof, 0, 13.3, 0);
    // 봉황
    cyl(g, .25, .35, .8, 6, gold, 0, 16.8, 0); const bird = box(g, .5, .6, 1.6, gold, 0, 17.6, 0);
    box(g, 1.8, .15, .7, gold, 0, 18, .1).rotation.z = .3;
    // 연못 속 작은 섬들과 소나무
    const pines = [];
    for (const [ix, iz, r] of [[-12, 34, 4], [8, 30, 3], [16, 44, 5], [-4, 48, 3.5]]) {
      const ix2 = cx + ix, iz2 = cz + iz, y = P.pond.y;
      const isl = mesh(scene, new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#4f7a3a'), ix2, y - .4, iz2); isl.scale.y = .35;
      pines.push({ x: ix2, y: y + .4, z: iz2, s: .5 + r * .08 });
      for (let k = 0; k < 4; k++) { const a = rng() * 6.28; mesh(scene, new THREE.DodecahedronGeometry(.6 + rng() * .5, 0), '#7c7770', ix2 + Math.cos(a) * r * .9, y, iz2 + Math.sin(a) * r * .9); }
    }
    for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2, r = 36 + rng() * 8, x = 280 + Math.cos(a) * r, z = 405 + Math.sin(a) * r; if (z < 380 && Math.abs(x - 280) < 14) continue; pines.push({ x, y: H(x, z), z, s: .7 + rng() * .4 }); }
    ISL.placeInstances(scene, 'jpine', pines);
    const cherries = []; for (let i = 0; i < 10; i++) { const a = rng() * 6.28, r = 46 + rng() * 6, x = 280 + Math.cos(a) * r, z = 400 + Math.sin(a) * r; cherries.push({ x, y: H(x, z), z, s: .9 + rng() * .3 }); }
    ISL.placeInstances(scene, 'cherry', cherries);
    landmark('kinkaku', '금각사 (킨카쿠지)', 'kyoto', 280, 395, 55, '연못 위에 비친 금빛 누각. 2층과 3층 외벽을 금박으로 덮었고, 지붕 꼭대기엔 금동 봉황이 앉아 있어요.');
  }

  function buildInari() {
    const path = plan.inari;
    const ver = mat('#e5482c', { roughness: .55 }), blk = mat('#1d1b1b');
    // 도리이 하나: 기둥 2(살짝 안쪽으로 기울어짐) + 검은 네마키 + 누키(기둥을 관통) + 가쿠즈카 + 시마키 + 위로 휜 검은 가사기
    const bend = (geo, lift) => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setY(i, p.getY(i) + lift * Math.pow(Math.abs(x) / 1.6, 2.6)); } geo.computeVertexNormals(); return geo; };
    const HW = 1.15, TH = 2.95, V = '#d9431f', K = '#1a1716';
    const pillar = s => { const g = new THREE.CylinderGeometry(.1, .12, TH, 10); g.translate(0, TH / 2, 0); g.rotateZ(-s * .02); g.translate(s * HW, 0, 0); return g; };
    const torii = ISL.merge([
      [pillar(-1), V], [pillar(1), V],
      [new THREE.CylinderGeometry(.14, .14, .32, 10).translate(-HW, .16, 0), K], [new THREE.CylinderGeometry(.14, .14, .32, 10).translate(HW, .16, 0), K],
      [new THREE.BoxGeometry(2.9, .14, .12).translate(0, 2.32, 0), V],
      [new THREE.BoxGeometry(.12, .3, .1).translate(0, 2.55, 0), V],
      [bend(new THREE.BoxGeometry(3.1, .16, .26, 16, 1, 1).translate(0, 2.8, 0), .12), V],
      [bend(new THREE.BoxGeometry(3.3, .12, .3, 16, 1, 1).translate(0, 2.94, 0), .16), K],
    ]);
    const tmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .5 });
    const list = [];
    for (let i = 0; i < path.length - 1; i += 1) {
      const [x, z] = path[i], [x2, z2] = path[i + 1], a = Math.atan2(x2 - x, z2 - z);
      list.push({ x, y: H(x, z) - .05, z, s: 1, ry: a, tint: .92 + rng() * .12 });
      for (const ox of [-HW, HW]) ISL.colCircle(x + Math.cos(a) * ox, z - Math.sin(a) * ox, .14);
    }
    ISL.placeInstances(scene, torii, list, { material: tmat, collide: 0, tile: 60 });
    // 신사 가는 길의 돌 등롱과 여우상
    for (let i = 6; i < path.length - 1; i += 28) { const [x, z] = path[i], [x2, z2] = path[i + 1], a = Math.atan2(x2 - x, z2 - z); for (const sd of [-1, 1]) { const lx = x + Math.cos(a) * sd * 2.1, lz = z - Math.sin(a) * sd * 2.1, ly = H(lx, lz); box(scene, .5, .7, .5, '#9a958c', lx, ly, lz); box(scene, .7, .3, .7, '#8f8a80', lx, ly + .7, lz); box(scene, .45, .4, .45, '#b4ae9f', lx, ly + 1, lz); cone(scene, .5, .35, 4, '#8f8a80', lx, ly + 1.4, lz, Math.PI / 4); } }
    // 입구 로몬(누문)
    const [sx, sz] = path[0], [nx, nz] = path[3]; const a = Math.atan2(nx - sx, nz - sz);
    const g = group(sx - Math.sin(a) * 8, sz - Math.cos(a) * 8, a);
    for (const px of [-4, -1.5, 1.5, 4]) for (const pz of [-2, 2]) cyl(g, .32, .32, 5, 8, ver, px, 0, pz);
    box(g, 9.5, .6, 5, ver, 0, 5, 0); box(g, 7, 2.6, 3.4, ver, 0, 5.6, 0); box(g, 7.2, .5, 3.6, '#f4efe3', 0, 6.4, 0);
    mesh(g, jRoofGeo(12, 7.5, 1.4, .3), mat('#2c2b2e'), 0, 5.6, 0);
    mesh(g, jRoofGeo(11, 7, 2.6, .35), mat('#2c2b2e'), 0, 8.2, 0);
    for (const s of [-1, 1]) { box(g, .9, 1.2, .9, '#9a958c', s * 6, 0, -2); const fox = box(g, .5, 1.4, 1, '#f2efe8', s * 6, 1.2, -2); cone(g, .15, .5, 4, '#f2efe8', s * 6 - .15, 2.6, -1.7); cone(g, .15, .5, 4, '#f2efe8', s * 6 + .15, 2.6, -1.7); }
    landmark('inari', '후시미 이나리 신사', 'kyoto', 470, 370, 45, '산길을 따라 1만 개가 넘는 주홍빛 도리이가 이어져요. 여우는 곡식의 신 이나리의 사자랍니다.');
  }

  function buildPagoda() {
    const { x, z } = P.pagoda; const g = group(x, z, 0, P.pagoda.y - .3); g.scale.setScalar(1.4); // 실제 높이 46m
    const wood = mat('#6e3b28'), roof = mat('#3a3633', { roughness: .85 }), wh = mat('#efe8da'), bronze = mat('#4d4a40', { metalness: .6, roughness: .45 });
    box(g, 11, 1.2, 11, '#8e8a83', 0, 0, 0);
    let y = 1.2;
    for (let i = 0; i < 5; i++) {
      const s = 7.4 - i * .7, h = i ? 3 : 3.8;
      box(g, s, h, s, wood, 0, y, 0);
      box(g, s * .55, h * .6, s + .05, wh, 0, y + h * .2, 0); box(g, s + .05, h * .6, s * .55, wh, 0, y + h * .2, 0);
      y += h;
      mesh(g, jRoofGeo(s * 1.85, s * 1.85, 1.3, .3), roof, 0, y - .1, 0);
      y += .9;
      if (i < 4) box(g, s * .85, .6, s * .85, wood, 0, y, 0), y += .6;
    }
    cyl(g, .22, .28, 9, 8, bronze, 0, y, 0);
    for (let i = 0; i < 9; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(.75 - i * .03, .1, 6, 14), bronze); t.rotation.x = Math.PI / 2; t.position.y = y + 1.5 + i * .65; g.add(t); }
    sphere(g, .35, mat('#c99b3a', { metalness: .8, roughness: .3 }), 0, y + 9.4, 0);
    landmark('pagoda', '야사카 오층탑 & 니넨자카', 'kyoto', x, z + 20, 35, '히가시야마 언덕에 우뚝 선 오층탑과 그 아래 돌계단 골목. 옛 목조 상점(마치야)들이 줄지어 있어요.');

    // 니넨자카 골목의 마치야와 등롱
    const front = facade({ wall: '#4a3427', win: '#2a2017', frame: '#6a4b36', cols: 3, rows: 2, lit: .9 });
    const lanternMat = new THREE.MeshStandardMaterial({ color: '#d84a33', emissive: '#ff7a3a', emissiveIntensity: .1 }); ISL.nightMats.push(lanternMat);
    for (let i = 0; i < 0; i++) for (const s of [-1, 1]) { // → streets.js 기온 거리
      const hx = 222 + s * 8, hz = 516 + i * 6.6; const hy = H(hx, hz);
      const hg = group(hx, hz, s > 0 ? -Math.PI / 2 : Math.PI / 2, hy - .6);
      colOf(mesh(hg, new THREE.BoxGeometry(6, 6.5, 8), boxMats(front, '#333'), 0, 3.25, 0));
      mesh(hg, gableGeo(8, 6, 1.8, .9), mat('#36363a'), 0, 6.5, 0, Math.PI / 2);
      mesh(hg, gableGeo(8, 1.2, .5, .1), mat('#36363a'), 0, 3.2, 3.4, Math.PI / 2);
      const l = sphere(hg, .45, lanternMat, 2.2, 3, 4.4, 1.3);
    }
  }

  function buildBamboo() {
    const { x: cx, z: cz } = plan.bamboo;
    const stalk = ISL.merge([[new THREE.CylinderGeometry(.14, .17, 15, 6, 6).translate(0, 7.5, 0), '#ffffff']]);
    const leaves = ISL.merge([0, 1, 2, 3, 4, 5].map(i => { const a = i * 2.4, y = 9.5 + i * .9; const g = new THREE.IcosahedronGeometry(.7, 0).scale(1.6, .22, .55); g.rotateZ(-.35); g.translate(.9, 0, 0); g.rotateY(a); g.translate(0, y, 0); return [g, '#ffffff']; }));
    const sl = [], ll = [];
    for (let k = 0; k < 2600 && sl.length < 900; k++) {
      const a = rng() * 6.28, r = Math.sqrt(rng()) * 42, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (ISL.segDist(x, z, 322, 512, 384, 548).d < 2.6) continue;
      const q = ISL.riverNearest(ISL.rivers[2], x, z); if (q && q.d < q.w + 2) continue;
      const y = H(x, z), s = .8 + rng() * .45, lean = (rng() - .5) * .12, lz = (rng() - .5) * .12;
      ISL.colCircle(x, z, .2); sl.push({ x, y, z, s, rx: lean, rz: lz, color: new THREE.Color().setHSL(.2 + rng() * .06, .55, .27 + rng() * .08) });
      ll.push({ x, y, z, s, rx: lean, rz: lz, color: new THREE.Color().setHSL(.25 + rng() * .05, .55, .24 + rng() * .08) });
    }
    ISL.placeInstances(scene, stalk, sl, { material: ISL.treeMaterial() });
    ISL.placeInstances(scene, leaves, ll, { material: ISL.treeMaterial() });
    landmark('bamboo', '아라시야마 대나무 숲', 'kyoto', cx, cz, 40, '하늘 높이 솟은 대나무 사이로 바람이 지나가면 사각사각 소리가 나요. 일본의 "남기고 싶은 소리 100선"에 뽑혔죠.');
    // 도게츠쿄 다리
    const w = plan.togetsu; buildDeck(w, mat('#6b5643'), mat('#5a4636'), { piers: 2, railH: .9 });
    landmark('togetsu', '도게츠쿄 다리', 'kyoto', w.cx, w.cz, 20, '"달이 건너는 다리"라는 뜻. 아라시야마의 산과 강을 잇는 나무 다리예요.');
  }

  // ============================================================
  // 아이슬란드
  // ============================================================
  function buildHallgrim() {
    const { x, z } = P.hallgrim; const g = group(x, z, 0, P.hallgrim.y - .3); g.scale.setScalar(1.35); // 실제 높이 74.5m
    const conc = blockMat('#d9d9d3', 1.6, 3.2);
    box(g, 5.6, 46, 4.5, conc, 0, 0, 0);
    mesh(g, hipGeo(5.6, 4.5, 5, 0), conc, 0, 46, 0);
    cyl(g, .12, .2, 4, 6, '#9a9a96', 0, 51, 0);
    sphere(g, .35, mat('#c9a646', { metalness: .7, roughness: .3 }), 0, 55.3, 0);
    for (const yy of [30, 36]) for (const sz of [1, -1]) box(g, 1.4, 2.6, .1, '#4f5560', 0, yy, sz * 2.28);
    const clock = mesh(g, new THREE.CircleGeometry(.9, 20), '#f5f5f0', 0, 40.5, 2.27);
    for (let k = 1; k <= 7; k++) for (const s of [-1, 1]) {
      const h = 40 - k * 4.9, cx = s * (2.8 + (k - .5) * 1.7);
      box(g, 1.6, h, 4.2 - k * .1, conc, cx, 0, 0);
      box(g, .3, h - 2, .1, '#b8b8b2', cx, 0, 2.1 - k * .05);
    }
    box(g, 14, 16, 30, conc, 0, 0, -18);
    mesh(g, gableGeo(14, 30, 7, .2), mat('#8c949c', { roughness: .5 }), 0, 16, -18);
    box(g, 3.2, 4, .3, '#3c3d42', 0, 0, 2.3);
    // 레이프 에릭손 동상
    box(g, 2.2, 3.2, 2.2, '#9b958d', 0, 0, 22); const st = cyl(g, .45, .5, 2.6, 8, '#5c6b62', 0, 3.2, 22); sphere(g, .38, '#5c6b62', 0, 6.2, 22);
    // 레이캬비크의 알록달록한 집
    const cols = ['#c0392b', '#2e6f9e', '#e6b422', '#f4f1ea', '#3e7c5a', '#8e44ad'], roofs = ['#3a3f45', '#b03a2e', '#2f5d50', '#5a5f66'];
    for (const p of []) { // → streets.js 무지개 거리
      const hg = group(p.x, p.z, p.ry, H(p.x, p.z) - .5);
      const f = facade({ wall: cols[Math.floor(rng() * cols.length)], win: '#2f3a44', frame: '#fff', cols: 2, rows: 2, lit: .8 });
      const w = 5 + rng() * 2, d = 6 + rng() * 2, h = 4 + rng() * 3;
      colOf(mesh(hg, new THREE.BoxGeometry(w, h, d), boxMats(f, '#555'), 0, h / 2, 0));
      mesh(hg, gableGeo(w, d, 2.4, .4), mat(roofs[Math.floor(rng() * roofs.length)], { roughness: .5, metalness: .3 }), 0, h, 0);
    }
    landmark('hallgrim', '할그림스키르캬 교회', 'iceland', x, z, 50, '레이캬비크의 상징. 화산이 식으며 생긴 주상절리를 본떠 계단처럼 내려오는 기둥들이 파이프 오르간처럼 보여요.');
  }

  let emit = {};
  function buildIcelandNature() {
    // 스코가포스 폭포 — 강이 절벽에서 떨어지는 곳
    const r = ISL.rivers[1]; let fi = 0, drop = 0;
    for (let i = 1; i < r.pts.length; i++) if (r.lv[i - 1] - r.lv[i] > drop) { drop = r.lv[i - 1] - r.lv[i]; fi = i; }
    const fx = r.pts[fi][0], fz = r.pts[fi][1], top = r.lv[fi - 1], bot = r.lv[Math.min(r.pts.length - 1, fi + 3)];
    plan.foss = { x: fx, z: fz, top, bot };
    emit.mist = new ISL.Emitter(scene, 260, { size: 8, opacity: .18, life: 3.5 });
    // 무지개
    const rb = new THREE.Mesh(new THREE.TorusGeometry(14, 1.6, 8, 48, Math.PI), new THREE.ShaderMaterial({
      uniforms: { uDay: ISL.U.uDay }, transparent: true, depthWrite: false,
      vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP; uniform float uDay; void main(){ float t=clamp((length(vP.xy)-12.4)/3.2,0.0,1.0);
        vec3 c=clamp(abs(mod(t*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0); gl_FragColor=vec4(c,0.22*uDay*sin(t*3.14)); }`,
    }));
    const tx = r.pts[fi + 1][0] - r.pts[fi - 1][0], tz = r.pts[fi + 1][1] - r.pts[fi - 1][1];
    rb.position.set(fx + tx * 2, bot, fz + tz * 2); rb.rotation.y = Math.atan2(tx, tz) + Math.PI / 2; scene.add(rb);
    landmark('skogafoss', '스코가포스 폭포', 'iceland', fx, fz, 40, '높이 60m, 폭 25m의 장대한 폭포. 맑은 날엔 물보라 속에 무지개가 자주 걸려요. 전설에 따르면 폭포 뒤에 바이킹의 보물상자가 숨겨져 있대요.');

    // 게이시르 / 스트로퀴르
    const { x: gx, z: gz } = P.geysir, gy = P.geysir.y;
    const pool = mesh(scene, new THREE.CircleGeometry(3.4, 32), new THREE.MeshStandardMaterial({ color: '#5fd0dc', emissive: '#2a8fa0', emissiveIntensity: .25, roughness: .1 }), gx, gy + .08, gz); pool.rotation.x = -Math.PI / 2;
    const rim = mesh(scene, new THREE.TorusGeometry(3.6, .35, 6, 28), '#e9e4d6', gx, gy, gz); rim.rotation.x = Math.PI / 2;
    for (const [ox, oz] of [[-9, 6], [7, -8], [11, 7]]) { const p2 = mesh(scene, new THREE.CircleGeometry(1.6, 20), new THREE.MeshStandardMaterial({ color: '#7fd8e0', emissive: '#2a8fa0', emissiveIntensity: .2 }), gx + ox, H(gx + ox, gz + oz) + .1, gz + oz); p2.rotation.x = -Math.PI / 2; }
    emit.geyser = new ISL.Emitter(scene, 500, { size: 7, opacity: .7, life: 3 });
    emit.steam = new ISL.Emitter(scene, 300, { size: 10, opacity: .22, life: 5 });
    let gt = 4, erupt = 0;
    plan.geyserState = () => erupt > 0;
    dyn.push((dt, near) => {
      gt -= dt; if (gt < 0) { erupt = 2.2; gt = 9 + rng() * 8; if (ISL.onGeyser) ISL.onGeyser(); }
      if (erupt > 0) { erupt -= dt; for (let i = 0; i < 12; i++) emit.geyser.emit(gx + (rng() - .5) * 1.5, gy + .5, gz + (rng() - .5) * 1.5, (rng() - .5) * 3, 22 + rng() * 14, (rng() - .5) * 3, 2.5 + rng()); }
      if (rng() < .5) emit.steam.emit(gx + (rng() - .5) * 4, gy + .3, gz + (rng() - .5) * 4, (rng() - .5), 2 + rng() * 2, (rng() - .5), 5);
      // 블루라군 김
      const L = P.lagoon; if (rng() < .7) { const a = rng() * 6.28, rr = rng() * 24; emit.steam.emit(L.x + Math.cos(a) * rr, L.y + .3, L.z + Math.sin(a) * rr, (rng() - .5), 1.2 + rng(), (rng() - .5), 5); }
      // 폭포 물보라
      for (let i = 0; i < 3; i++) emit.mist.emit(fx + (rng() - .5) * 10, bot + rng() * 3, fz + (rng() - .5) * 10, (rng() - .5) * 4, 2 + rng() * 3, (rng() - .5) * 4, 3.5);
      emit.geyser.update(dt, -9, .3); emit.steam.update(dt, 0, .1); emit.mist.update(dt, -.5, .5);
    });
    landmark('geysir', '게이시르 & 스트로퀴르', 'iceland', gx, gz, 35, '"간헐천(geyser)"이라는 말이 여기서 나왔어요. 스트로퀴르는 몇 분마다 뜨거운 물기둥을 20m 넘게 뿜어 올려요.');

    // 블루라군 주변 용암 바위
    const L = P.lagoon; const lava = [];
    for (let i = 0; i < 90; i++) { const a = rng() * 6.28, rr = 30 + rng() * 14, x = L.x + Math.cos(a) * rr, z = L.z + Math.sin(a) * rr; lava.push({ x, y: H(x, z) - .2, z, s: .6 + rng() * 1.4, color: new THREE.Color('#2a2a2e') }); }
    ISL.placeInstances(scene, ISL.merge([[new THREE.DodecahedronGeometry(1.3, 0).scale(1.3, .7, 1), '#ffffff']]), lava, { material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }) });
    landmark('lagoon', '블루라군', 'iceland', L.x, L.z, 40, '용암 대지 한가운데의 우윳빛 하늘색 온천. 물속의 실리카와 미네랄 때문에 신비로운 색을 띠어요.');

    // 레이니스피아라 검은 모래 해변의 주상절리
    const b = plan.basalt, ang = Math.atan2(b.dx, b.dz);
    const col = ISL.merge([[new THREE.CylinderGeometry(.62, .62, 1, 6).translate(0, .5, 0), '#ffffff']]);
    const list = [];
    for (let i = -14; i <= 14; i++) for (let j = 0; j < 9; j++) {
      const lx = i * 1.08 + (j % 2) * .54, lz = -j * .94;
      const x = b.x + Math.cos(ang) * lx + Math.sin(ang) * lz, z = b.z - Math.sin(ang) * lx + Math.cos(ang) * lz;
      const h = (j + 1) * 1.8 * (1 - Math.abs(i) / 18) + Math.sin(i * 1.7) * 1.2 + 2;
      const y0 = H(x, z) - 1;
      if (h > 2) ISL.colCircle(x, z, .62, y0, y0 + h); list.push({ x, y: y0, z, s: 1, sy: Math.max(1, h), ry: 0, color: new THREE.Color('#2b2b2f').multiplyScalar(.8 + rng() * .4) });
    }
    ISL.placeInstances(scene, col, list, { material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, flatShading: true }) });
    // 레이니스드랑가르 바다 기둥
    for (let k = 0; k < 3; k++) {
      const d = 45 + k * 22, sx = b.x + b.dx * d + (k - 1) * 10, sz = b.z + b.dz * d + (k - 1) * 8;
      const geo = new THREE.CylinderGeometry(1.5 + rng(), 5 + rng() * 2, 26 + k * 6, 7, 5); const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * (1 + ISL.noise(p.getY(i) * .3, k) * .25));
      geo.computeVertexNormals();
      mesh(scene, geo, mat('#26262a', { flatShading: true }), sx, (26 + k * 6) / 2 - 6, sz); ISL.colCircle(sx, sz, 4.5);
    }
    landmark('blackbeach', '레이니스피아라 검은 모래 해변', 'iceland', b.x, b.z, 50, '화산 현무암이 부서져 생긴 새까만 모래와 육각기둥 절벽. 바다 위 바위기둥은 굳어버린 트롤이라는 전설이 있어요.');
    // 폭포 아래 작은 다리
    buildDeck(plan.fossbridge, mat('#6b5643'), mat('#5a4636'), { railH: .9 });
  }

  // ============================================================
  // 스위스
  // ============================================================
  function buildSwiss() {
    landmark('matterhorn', '마터호른', 'swiss', 470, -175, 150, '피라미드처럼 뾰족한 알프스의 명봉(4,478m). 네 개의 날카로운 능선이 동서남북을 향해요. 토블론 초콜릿 상자의 그 산!');
    // 시옹성
    const C = P.chillon; const g = group(C.x, C.z, -.3, C.y - .8);
    const wall = blockMat('#e3dccd', .9, .45), roof = mat('#8a4b35', { roughness: .7 }), dark = blockMat('#cfc6b4', .8, .4);
    box(g, 22, 7, 10, wall, 0, 0, 0); crenels(g, 22, 10, 7, wall, .7, 1.5);
    box(g, 6, 17, 6, dark, -3, 0, 0); mesh(g, hipGeo(6, 6, 6, .3), roof, -3, 17, 0);
    for (const [tx, tz, r, h] of [[-10, 4, 1.8, 11], [9, -4, 2, 12], [10, 4.5, 1.6, 10], [-10, -4.5, 1.6, 9.5]]) { cyl(g, r, r, h, 14, wall, tx, 0, tz); cone(g, r * 1.25, r * 2.8, 14, roof, tx, h, tz); }
    box(g, 7, 9, 7, wall, 5, 0, 0); mesh(g, gableGeo(7, 7, 3.6, .4), roof, 5, 9, 0);
    for (let i = -3; i <= 3; i++) box(g, .4, 1.2, .1, '#4c4a44', i * 2.6, 3.5, 5.05);
    landmark('chillon', '시옹성', 'swiss', C.x, C.z, 35, '레만 호수 위 바위섬에 지은 중세의 성. 물 위에 떠 있는 듯한 모습으로 바이런의 시에도 등장해요.');

    // 카펠교와 바서투름
    const w = plan.kapell, woodM = mat('#7a5638'), roofM = mat('#7d3b2b', { roughness: .7 });
    const ang = buildDeck(w, woodM, woodM, { railH: 1.1, piers: 2 });
    const n = Math.ceil(w.len / 3);
    const flowerM = mat('#e2303a');
    for (let i = 0; i < n; i++) {
      const t = (i + .5) / n, x = w.ax + (w.bx - w.ax) * t, z = w.az + (w.bz - w.az) * t, y = ISL.deckY(w, t);
      const seg = new THREE.Group(); seg.position.set(x, y, z); seg.rotation.y = ang; scene.add(seg);
      for (const s of [-1, 1]) { box(seg, .2, 2.6, .2, woodM, s * w.hw, 0, 0); box(seg, .5, .35, 2.6, flowerM, s * (w.hw + .3), .9, 0); }
      mesh(seg, gableGeo(w.hw * 2, w.len / n, 1.4, .4), roofM, 0, 2.6, 0);
    }
    const tx = w.cx + Math.cos(ang) * 6, tz = w.cz - Math.sin(ang) * 6, ty = w.level - 2.5;
    cyl(scene, 3.2, 3.5, 17, 8, '#a99576', tx, ty, tz); cone(scene, 3.9, 6.5, 8, roofM, tx, ty + 17, tz);
    landmark('kapell', '카펠교 (루체른)', 'swiss', w.cx, w.cz, 30, '1333년에 지어진 유럽에서 가장 오래된 지붕 덮인 나무다리. 옆의 팔각형 물탑 "바서투름"과 함께 루체른의 상징이에요.');

    // 루체른 구시가지
    const lcols = ['#f3e3c3', '#e8b7a0', '#d9e2c4', '#f2d18b', '#c9d6e8', '#f7f1e6'];
    let ln = 0;
    for (let k = 0; k < 0 && ln < 16; k++) { // → streets.js 루체른 구시가지
      const a = rng() * 6.28, rr = 12 + rng() * 26, hx = 182 + Math.cos(a) * rr, hz = -32 + Math.sin(a) * rr;
      const q = ISL.riverNearest(ISL.rivers[0], hx, hz); if (q && q.d < q.w + 4) continue;
      if (ISL.segDist(hx, hz, w.ax, w.az, w.bx, w.bz).d < 6 || ISL.slopeAt(hx, hz) > .2) continue;
      const hg = group(hx, hz, -a + Math.PI / 2, H(hx, hz) - .5), hh = 7 + rng() * 4;
      const f = facade({ wall: lcols[ln % lcols.length], win: '#34404c', frame: '#fff', shutter: rng() < .5 ? '#3f6b48' : '#8a3b2b', cols: 3, rows: 3, lit: .7 });
      colOf(mesh(hg, new THREE.BoxGeometry(6, hh, 6), boxMats(f, '#555'), 0, hh / 2, 0));
      mesh(hg, gableGeo(6, 6, 4, .4), roofM, 0, hh, 0); ln++;
    }
    // 샬레와 소
    const lowWall = mat('#ece7dc'), upWood = mat('#7a4a2b'), chRoof = mat('#4b3a30'), red = mat('#d52b1e');
    for (const c of plan.chalets) {
      const cg = group(c.x, c.z, c.ry, H(c.x, c.z) - .6);
      box(cg, 9, 3.4, 7.5, lowWall, 0, 0, 0); box(cg, 9, 3.4, 7.5, upWood, 0, 3.4, 0);
      mesh(cg, gableGeo(9, 7.5, 3, 1.6), chRoof, 0, 6.8, 0);
      box(cg, 9.6, .25, 1.4, upWood, 0, 4, 4.3); box(cg, 9.4, .4, .4, red, 0, 4.25, 4.9);
      for (const s of [-2.5, 0, 2.5]) box(cg, 1.2, 1.4, .1, '#33404a', s, 4.8, 3.8);
    }
    const c0 = plan.chalets[0];
    if (c0) { cyl(scene, .1, .12, 9, 6, '#ddd', c0.x + 7, H(c0.x + 7, c0.z + 5), c0.z + 5); const fg = group(c0.x + 8.1, c0.z + 5, 0, H(c0.x + 7, c0.z + 5) + 7); box(fg, 2.2, 2.2, .1, red); box(fg, 1.3, .4, .12, '#fff', 0, .9, 0); box(fg, .4, 1.3, .12, '#fff', 0, .45, 0); }
    const cows = [];
    for (let k = 0; k < 14; k++) {
      const c = plan.chalets[k % Math.max(1, plan.chalets.length)]; if (!c) break;
      const x = c.x + (rng() - .5) * 30, z = c.z + (rng() - .5) * 30;
      if (ISL.waterAt(x, z).level > H(x, z) - 1) continue;
      const cg = new THREE.Group(); cg.userData.dynamic = true; scene.add(cg);
      box(cg, 1.2, 1.1, 2.2, '#f4f1ea', 0, .8, 0); box(cg, 1.22, .6, .9, '#5a3a28', 0, 1.2, .2);
      box(cg, .8, .8, .9, '#f4f1ea', 0, 1.3, 1.4); box(cg, .6, .4, .3, '#e8b7a8', 0, 1.1, 1.9);
      for (const [lx, lz] of [[-.4, -.8], [.4, -.8], [-.4, .8], [.4, .8]]) box(cg, .22, .8, .22, '#4b3a30', lx, 0, lz);
      cyl(cg, .15, .2, .25, 8, '#d4a937', 0, .7, 1.55);
      cows.push({ g: cg, x, z, a: rng() * 6, t: rng() * 10 });
    }
    dyn.push(dt => { for (const c of cows) { c.t += dt; if (Math.sin(c.t * .3) > .7) { c.a += dt * .3 * Math.sin(c.t); c.x += Math.sin(c.a) * dt * .6; c.z += Math.cos(c.a) * dt * .6; } c.g.position.set(c.x, H(c.x, c.z), c.z); c.g.rotation.y = c.a; } });
  }

  // ============================================================
  // 바위 재질 (지층 무늬)
  function rockMat(color) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: .92, flatShading: true });
    m.onBeforeCompile = sh => {
      sh.vertexShader = 'varying vec3 vWPr;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWPr = (modelMatrix * vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = 'varying vec3 vWPr;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        float st = sin(vWPr.y*2.1 + sin(vWPr.x*.13+vWPr.z*.11)*2.0)*.5+.5; float st2 = sin(vWPr.y*7.0+vWPr.x*.3)*.5+.5;
        diffuseColor.rgb *= .8 + .16*st + .08*st2;`);
    };
    return m;
  }
  ISL.rockMat = rockMat;
  function rockGeo(geo, amp, seed) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = ISL.noise(x * .35 + seed, y * .25 + z * .35) * amp; const l = Math.hypot(x, z) || 1; p.setXYZ(i, x + x / l * n, y, z + z / l * n); }
    geo.computeVertexNormals(); return geo;
  }
  function archGeo(R, tube, seed) { const g = new THREE.TorusGeometry(R, tube, 7, 18, Math.PI); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const n = 1 + ISL.noise(p.getX(i) * .3 + seed, p.getY(i) * .3) * .18; p.setXYZ(i, p.getX(i) * n, p.getY(i) * n, p.getZ(i) * (1 + ISL.noise(p.getY(i) * .4, seed) * .3)); } g.computeVertexNormals(); return g; }

  function buildAlgarve() {
    const A = P.algarve, tx = -A.dirz, tz = A.dirx, gold = rockMat('#d9a45e'), cap = mat('#6e8f45', { flatShading: true });
    const put = (geo, m, x, y, z, ry = 0) => { const me = mesh(scene, geo, m, x, y, z, ry); return me; };
    const spots = [[-48, 14, 18], [-30, 28, 24], [-8, 22, 14], [12, 34, 20], [30, 16, 12], [52, 26, 22], [70, 12, 16], [-66, 20, 15]];
    for (const [t, o, h] of spots) {
      const x = A.x + tx * t + A.dirx * o, z = A.z + tz * t + A.dirz * o;
      const r = 3 + rng() * 3, geo = rockGeo(new THREE.CylinderGeometry(r * .75, r * 1.15, h + 12, 9, 6), 1.4, t);
      put(geo, gold, x, h / 2 - 6, z, rng() * 3); ISL.colCircle(x, z, r * 1.05);
      const c = mesh(scene, new THREE.SphereGeometry(r * .8, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), cap, x, h, z); c.scale.y = .35;
    }
    for (const [t, o] of [[-20, 9], [42, 8]]) {
      const x = A.x + tx * t + A.dirx * o, z = A.z + tz * t + A.dirz * o, ry = Math.atan2(A.dirx, A.dirz) + Math.PI / 2;
      put(archGeo(7, 2.8, t), gold, x, 2, z, ry);
      for (const s of [-1, 1]) put(rockGeo(new THREE.CylinderGeometry(2.6, 3.4, 10, 8, 3), .8, s + t), gold, x + Math.cos(ry) * s * 7, -3, z - Math.sin(ry) * s * 7);
    }
    landmark('algarve', '알가르브 해안 절벽', 'portugal', A.x - A.dirx * 15, A.z - A.dirz * 15, 60, '포르투갈 남쪽 끝의 황금빛 석회암 절벽. 파도가 깎아 만든 바다 아치와 바위기둥 사이로 작은 모래 해변이 숨어 있어요 (폰타 다 피에다드, 베나질 동굴).');
  }
  function buildEtretat() {
    const E = P.etretat, tx = -E.dirz, tz = E.dirx, chalk = rockMat('#eeebe3'), grass = mat('#7aa648', { flatShading: true });
    const ry = Math.atan2(tx, tz) + Math.PI / 2;
    const ax = E.x + E.dirx * 9 + tx * 6, az = E.z + E.dirz * 9 + tz * 6;
    mesh(scene, archGeo(8.5, 3.6, 5), chalk, ax, 6.5, az, Math.atan2(E.dirx, E.dirz) + Math.PI / 2);
    mesh(scene, rockGeo(new THREE.CylinderGeometry(3.4, 4.2, 16, 8, 4), .8, 3), chalk, ax + E.dirx * 8.5, -2, az + E.dirz * 8.5);
    const nx = E.x + E.dirx * 34 + tx * 14, nz = E.z + E.dirz * 34 + tz * 14;
    mesh(scene, rockGeo(new THREE.CylinderGeometry(.5, 4.5, 38, 9, 8), .7, 9), chalk, nx, 9, nz); ISL.colCircle(nx, nz, 4); ISL.colCircle(ax + E.dirx * 8.5, az + E.dirz * 8.5, 3.6);
    landmark('etretat', '에트르타 코끼리 절벽', 'france', E.x - E.dirx * 12, E.z - E.dirz * 12, 55, '노르망디 해안의 하얀 백악 절벽. 바다로 코를 담근 코끼리 같은 아치(포르트 다발)와 뾰족한 바위 "바늘(에귀유)"은 모네가 여러 번 그린 풍경이에요.');
  }
  function buildJokul() {
    const J = P.jokul, L = P.jokulLake;
    const geo = ISL.merge([[new THREE.IcosahedronGeometry(1.4, 0), '#ffffff']]);
    const list = [], cols = ['#e9f6fb', '#bfe6f5', '#8fd0ee', '#d7eef7'];
    for (let i = 0; i < 46; i++) { const a = rng() * 6.28, r = Math.sqrt(rng()) * 25, s = .6 + rng() * 2.2; list.push({ x: J.x + Math.cos(a) * r, y: L.y - .4 * s, z: J.z + Math.sin(a) * r, s, sx: 1 + rng(), sy: .7 + rng() * .8, rx: rng(), rz: rng(), color: new THREE.Color(cols[i % 4]) }); }
    for (let i = 0; i < 24; i++) { const t = (rng() - .5) * 90, x = J.x + J.dirx * 40 - J.dirz * t, z = J.z + J.dirz * 40 + J.dirx * t; const h = H(x, z); if (h < -1.5) continue; const s = .3 + rng() * .7; list.push({ x, y: h + .2, z, s, rx: rng(), rz: rng(), color: new THREE.Color(cols[i % 4]) }); }
    ISL.placeInstances(scene, geo, list, { material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .12, metalness: 0, emissive: '#3c8fc0', emissiveIntensity: .12, flatShading: true }) });
    landmark('jokul', '요쿨살론 빙하 호수', 'iceland', J.x, J.z, 50, '빙하에서 떨어져 나온 푸른 얼음덩이들이 천천히 바다로 흘러가는 호수. 바닷가 검은 모래 위에 얼음이 보석처럼 흩어져 "다이아몬드 해변"이라 불려요.');
  }
  function terraceVines(cx, cz, r, color) {
    const geo = ISL.merge([[new THREE.IcosahedronGeometry(.6, 0).scale(2.2, 1.1, .75).translate(0, .85, 0), '#ffffff']]), list = [];
    for (let x = cx - r; x < cx + r; x += 1.35) for (let z = cz - r; z < cz + r; z += 1.35) {
      if (Math.hypot(x - cx, z - cz) > r) continue;
      const h = H(x, z); if (ISL.slopeAt(x, z) > .16 || h < 3 || ISL.world.solidAt(x, h + 1, z)) continue;
      const hx = H(x + 2, z) - H(x - 2, z), hz = H(x, z + 2) - H(x, z - 2);
      if (Math.hypot(hx, hz) < .01 && rng() < .5) continue;
      list.push({ x, y: h - .05, z, s: .9, ry: Math.atan2(hz, -hx) + (rng() - .5) * .1, color: new THREE.Color(color).multiplyScalar(.8 + rng() * .4) });
    }
    ISL.placeInstances(scene, geo, list, { material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 }), lod: 420, tile: 80 });
  }
  function buildTerraces() {
    terraceVines(P.lavaux.x, P.lavaux.z, 36, '#557a30');
    landmark('lavaux', '라보 포도밭 테라스', 'swiss', P.lavaux.x, P.lavaux.z, 45, '호수를 내려다보는 가파른 비탈에 돌담을 쌓아 만든 계단식 포도밭. 천 년 가까이 이어진 풍경으로 유네스코 세계유산이에요.');
    terraceVines(P.douro.x, P.douro.z, 52, '#5f7a2c');
    landmark('douro', '도우루 와인 계단밭', 'portugal', P.douro.x, P.douro.z, 55, '강을 따라 굽이굽이 이어지는 계단식 포도밭. 여기서 난 포도로 달콤한 포트와인을 만들어요.');
    landmark('tanada', '교토 산골 계단식 논', 'kyoto', P.tanada.x, P.tanada.z, 55, '산비탈을 따라 층층이 일군 논(다나다). 초여름엔 물을 대어 하늘이 비치고, 가을엔 황금빛 벼가 고개를 숙여요.');
    // 계단식 논에 물 대기: 평평한 칸마다 얇은 물판
    const water = new THREE.MeshStandardMaterial({ color: '#7fb0b8', roughness: .08, metalness: .1, transparent: true, opacity: .55 });
    const seen = new Set();
    for (let x = P.tanada.x - 46; x < P.tanada.x + 46; x += 6) for (let z = P.tanada.z - 46; z < P.tanada.z + 46; z += 6) {
      if (Math.hypot(x - P.tanada.x, z - P.tanada.z) > 46 || ISL.slopeAt(x, z) > .05 || rng() < .45) continue;
      const h = H(x, z), key = Math.round(h * 2) + ':' + Math.round(x / 12) + ':' + Math.round(z / 12); if (seen.has(key)) continue; seen.add(key);
      const pl = mesh(scene, new THREE.CircleGeometry(3.2 + rng() * 1.5, 10), water, x, h + .12, z); pl.rotation.x = -Math.PI / 2; pl.castShadow = false;
    }
  }

  // 해안 절벽: 지형 격자보다 훨씬 날카로운 수직 암벽을 해안선을 따라 세움
  function buildCliffFaces() {
    const strips = { gold: [], chalk: [] }; let cur = null, curType = null;
    const flush = () => { if (cur && cur.length > 3) strips[curType].push(cur); cur = null; };
    for (let a = -Math.PI; a < Math.PI; a += .0026) {
      const c = Math.cos(a), s = Math.sin(a);
      let r = 940; while (r > 300 && H(c * r, s * r) < .8) r -= 1.2;
      if (r <= 300) { flush(); continue; } r += 1.2;
      const rx = c * (r - 9), rz = s * (r - 9), top = H(rx, rz), W = ISL.weights(rx, rz), k = ISL.cliffK(rx, rz, W);
      if (k < .45 || top < 7) { flush(); continue; }
      const type = W[2] > W[3] ? 'chalk' : 'gold';
      if (cur && type !== curType) flush();
      if (!cur) { cur = []; curType = type; }
      let re = r; while (re > r - 16 && H(c * re, s * re) < top - 1.2) re -= .5;
      cur.push({ c, s, a, re, top, rs: r });
    }
    flush();
    ISL.cliffStrips = { gold: strips.gold.map(s => s.length), chalk: strips.chalk.map(s => s.length) };
    const boulders = [];
    for (const type of ['gold', 'chalk']) {
      const pos = [], idx = []; let base = 0; const ROWS = 12;
      for (const st of strips[type]) {
        st.forEach((p, i) => {
          for (let k = 0; k <= ROWS; k++) {
            const t = k / ROWS, y = p.top + .5 - t * (p.top + 7.5);
            const ov = ISL.noise(p.a * 95, y * .22) * 1.6 + ISL.noise(p.a * 340, y * .9) * .55 + (Math.sin(y * 1.7 + ISL.noise(p.a * 40, 0) * 3) * .25);
            const cave = Math.max(0, ISL.noise(p.a * 60, 7.3) - .45) * 6 * ISL.sstep(4, 0, y) * ISL.sstep(-3, 0, y);
            const rr = p.re + .3 + t * 1.4 + ov - cave + (k === 0 ? -.9 : 0);
            pos.push(p.c * rr, y, p.s * rr);
          }
          if (i) for (let k = 0; k < ROWS; k++) { const a0 = base + (i - 1) * (ROWS + 1) + k, b0 = base + i * (ROWS + 1) + k; idx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1); }
          if (i % 3 === 0) for (let b = 0; b < 2; b++) { const rr = p.rs + rng() * 7 - 1, x = p.c * rr, z = p.s * rr; boulders.push({ x, y: -1 + rng() * 1.2, z, s: .5 + rng() * 1.5, color: new THREE.Color(type === 'gold' ? '#c99a5a' : '#e3e0d6').multiplyScalar(.75 + rng() * .3) }); }
        });
        base += st.length * (ROWS + 1);
      }
      if (!pos.length) continue;
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      const m = rockMat(type === 'gold' ? '#d4a05c' : '#ece8de'); m.side = THREE.DoubleSide;
      const me = new THREE.Mesh(g, m); me.castShadow = me.receiveShadow = true; scene.add(me);
    }
    ISL.placeInstances(scene, ISL.merge([[new THREE.DodecahedronGeometry(1.2, 1).scale(1.3, .75, 1), '#ffffff']]), boulders, { collide: 1, material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, flatShading: true }) });
  }

  // 명소 입구와 에펠탑 전망대
  function hallDoors() {
    const add = (hall, x, z, a, y) => ISL.Interior.addHallDoor({ scene, hall, x, z, a, y: Math.max(y !== undefined ? y : -1e9, H(x + Math.sin(a) * .8, z + Math.cos(a) * .8) + .02) });
    add('hallgrim', P.hallgrim.x, P.hallgrim.z + 2.35 * 1.35, 0, P.hallgrim.y - .3);
    { const dx = P.msmCoast.x - P.msm.x, dz = P.msmCoast.z - P.msm.z, l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l; add('msm', P.msm.x + ux * 32.5, P.msm.z + uz * 32.5, Math.atan2(ux, uz)); }
    { const r = Math.atan2(P.belemCoast.dirx, P.belemCoast.dirz); add('belem', P.belem.x - 7.1 * 1.3 * Math.sin(r), P.belem.z - 7.1 * 1.3 * Math.cos(r), r + Math.PI, .6); }
    add('pena', P.pena.x + 11.2 * Math.sin(.4), P.pena.z + 11.2 * Math.cos(.4), .4);
    add('kinkaku', 280, 377 - 4.85 * .72, Math.PI, P.kinkaku.y - .3);
    add('pagoda', P.pagoda.x, P.pagoda.z + 5.55 * 1.4, 0, P.pagoda.y - .3);
    // 시옹성: 호숫가에서 성까지 나무다리
    { const C = P.chillon, ux0 = C.x - 330, uz0 = C.z - 40, l = Math.hypot(ux0, uz0), ux = ux0 / l, uz = uz0 / l, lv = P.swissLake.y + 1.2;
      const ax = C.x + ux * 11.6, az = C.z + uz * 11.6, bx = C.x + ux * 27, bz = C.z + uz * 27;
      const w = { ax, az, bx, bz, hw: 1.6, yA: lv, yB: H(bx, bz) + .25, arch: 0, cx: (ax + bx) / 2, cz: (az + bz) / 2, dx: uz, dz: -ux, len: Math.hypot(bx - ax, bz - az), level: P.swissLake.y };
      ISL.walkables.push(w); buildDeck(w, mat('#6b5643'), mat('#5a4636'), { railH: 1, piers: 2 });
      add('chillon', C.x + ux * 11.3, C.z + uz * 11.3, Math.atan2(ux, uz), lv); }
    // 에펠탑: 1층·2층·꼭대기 전망대를 걸을 수 있게
    const E = P.eiffel, y0 = H(E.x, E.z);
    const ES = ISL.EIFFEL_S, D1 = y0 + 15.7 * ES, D2 = y0 + 29.4 * ES, D3 = y0 + 62.6 * ES;
    ISL.floors = ISL.floors || [];
    const levels = [['지상', y0], ['1층 전망대 (57m)', D1], ['2층 전망대 (115m)', D2], ['꼭대기 전망대 (276m)', D3]];
    for (const [nm, y, hw] of [[1, D1, 9.6 * ES], [2, D2, 5.6 * ES], [3, D3, 1.9 * ES]]) {
      ISL.floors.push({ x: E.x, z: E.z, hw, hd: hw, y });
      for (const [x, z, a, b] of [[0, hw, hw, .1], [0, -hw, hw, .1], [hw, 0, .1, hw], [-hw, 0, .1, hw]]) {
        ISL.world.add({ t: 'b', x: E.x + x, z: E.z + z, hw: a, hd: b, a: 0, y0: y - .3, y1: y + 1.1 });
        for (let k = -hw; k <= hw; k += 1.2) box(scene, .06, 1.05, .06, mat('#4a382a'), E.x + x + (a > .2 ? k : 0), y, E.z + z + (b > .2 ? k : 0));
        box(scene, a * 2 + .1, .08, b * 2 + .1, mat('#4a382a'), E.x + x, y + 1.05, E.z + z);
      }
    }
    ISL.elevators = [{ x: E.x, z: E.z, levels, name: '에펠탑 엘리베이터' }];
  }

  // ============================================================
  function build(sc) {
    scene = sc; autoCol = true;
    buildEiffel(); // 파리 건물은 streets.js의 오스만 대로로
    buildLavender(); buildMSM();
    buildBelem(); buildLisbon(); buildPena();
    buildKinkaku(); buildInari(); buildPagoda(); buildBamboo();
    buildHallgrim(); buildIcelandNature();
    buildSwiss();
    buildAlgarve(); buildEtretat(); buildJokul(); buildTerraces(); buildCliffFaces();
    autoCol = false;
    hallDoors();
  }
  // 움직이지 않는 명소 부품을 재질·구역별로 합쳐 드로우콜을 줄임
  function mergeStatic() {
    scene.updateMatrixWorld(true);
    const buckets = new Map(), c = new THREE.Vector3();
    scene.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || o === ISL.terrainMesh) return;
      for (let p = o; p; p = p.parent) if (p.userData.dynamic) return;
      if (!o.material || !o.material.isMeshStandardMaterial) return;
      const g = o.geometry; if (!g.attributes.uv || !g.attributes.normal) return;
      o.getWorldPosition(c);
      const key = o.material.uuid + '|' + Math.floor(c.x / 250) + ',' + Math.floor(c.z / 250);
      if (!buckets.has(key)) buckets.set(key, { mat: o.material, list: [] });
      buckets.get(key).list.push(o);
    });
    let merged = 0;
    for (const { mat, list } of buckets.values()) {
      if (list.length < 2) continue;
      const geos = list.map(o => { const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrixWorld); return g; });
      let n = 0; geos.forEach(g => n += g.attributes.position.count);
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let k = 0;
      for (const g of geos) { pos.set(g.attributes.position.array, k * 3); nor.set(g.attributes.normal.array, k * 3); uv.set(g.attributes.uv.array, k * 2); k += g.attributes.position.count; g.dispose(); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; scene.add(m);
      for (const o of list) o.parent.remove(o);
      merged += list.length;
    }
    ISL.mergedParts = merged;
  }
  function update(dt, player) { for (const f of dyn) f(dt, player); }

  ISL.LH = { mat, mesh, box, cyl, cone, sphere, gableGeo, hipGeo, jRoofGeo, facade, boxMats, canvasTex, frustumGeo };
  ISL.Landmarks = { mergeStatic: () => mergeStatic(), plan: planAll, build, update, planData: plan, mat, box, cyl, cone, sphere, mesh, group: (...a) => group(...a) };
})();
