// 사람이 사는 풍경: 마을, 길, 밭. 국경에서는 양식이 확률적으로 섞인다.
(function () {
  const ISL = window.ISL, H = (x, z) => ISL.H(x, z);
  const rng = ISL.mulberry32(5150);
  const hash2 = (a, b) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  // 국경 지대: 지역 가중치대로 무작위 선택 → 두 나라 양식이 자연스럽게 섞임
  function pickRegion(W, r) { let acc = 0; for (let i = 0; i < 5; i++) { acc += W[i]; if (r <= acc) return i; } return 4; }
  ISL.hash2 = hash2; ISL.pickRegion = pickRegion;
  const C = h => new THREE.Color(h);

  // ---------- 작물 ----------
  const CROPS = {
    wheat: { tint: '#cfb15e', g: .95, gc: '#dcbd5f' },
    sunflower: { tint: '#6c8b3a', g: .3, gc: '#7a9a40', rows: 'sunflower' },
    rapeseed: { tint: '#d6cb40', g: .6, gc: '#a9b83b', fl: .85, fp: 4 },
    pasture: { tint: '#7cab4a', g: .4, gc: '#79a946', fl: .05, fp: 5 },
    poppy: { tint: '#7aa648', g: .5, gc: '#7aa646', fl: .4, fp: 3 },
    vineyard: { tint: '#8b7352', g: .05, gc: '#7d8f45', rows: 'vine' },
    meadow: { tint: '#6ea948', g: .6, gc: '#6aa544', fl: .24, fp: 1 },
    hay: { tint: '#93ad5a', g: .16, gc: '#9fbb5e', rows: 'bales' },
    lupine: { tint: '#5e8a4c', g: .5, gc: '#5f8f45', fl: .6, fp: 2 },
    moss: { tint: '#6d8b4b', g: .12, gc: '#7d9a52', fl: .03, fp: 5 },
    drywheat: { tint: '#d3b068', g: .85, gc: '#d9b66c' },
    olive: { tint: '#b9a56c', g: .3, gc: '#b3a467', fl: .04, fp: 6, rows: 'olive' },
    drypasture: { tint: '#bda866', g: .45, gc: '#bca966', fl: .05, fp: 6 },
    rice: { tint: '#7fb84a', g: .62, gc: '#8cc946' },
    tea: { tint: '#5a6f38', g: 0, gc: '#5a7a3a', rows: 'tea' },
    veg: { tint: '#7d6c4b', g: .2, gc: '#6f9a3f' },
  };
  for (const k in CROPS) { const c = CROPS[k]; c.tintC = C(c.tint); c.gcC = C(c.gc); c.fl = c.fl || 0; c.fp = c.fp || 0; c.name = k; }
  const REGION_CROPS = [
    ['hay', 'moss', 'lupine', 'moss', 'lupine'],
    ['meadow', 'meadow', 'hay', 'pasture', 'meadow'],
    ['wheat', 'wheat', 'sunflower', 'pasture', 'rapeseed', 'vineyard', 'poppy'],
    ['drywheat', 'vineyard', 'olive', 'olive', 'drypasture', 'drywheat'],
    ['rice', 'rice', 'rice', 'tea', 'veg'],
  ];
  const HEDGE = [
    { c: C('#5b7b44'), g: .3, gc: C('#6a8a4a') }, { c: C('#4c7032'), g: .9, gc: C('#4f7a34') }, { c: C('#4c7032'), g: .95, gc: C('#4a7432') },
    { c: C('#a69c86'), g: .08, gc: C('#9fa060') }, { c: C('#8b7b56'), g: .35, gc: C('#7a9a45') },
  ];
  const ROAD = [C('#5e5a55'), C('#9e978a'), C('#b6a483'), C('#cbbfa6'), C('#a6977a')];

  const SU = 44, SV = 30;
  function fieldCell(x, z) {
    const ang = .4 + ISL.noise(x * .0015 + 3, z * .0015) * .9, c = Math.cos(ang), s = Math.sin(ang);
    const u = x * c - z * s, v = x * s + z * c, iu = Math.floor(u / SU), iv = Math.floor(v / SV), fu = u / SU - iu, fv = v / SV - iv;
    return { iu, iv, ang, edge: Math.min(Math.min(fu, 1 - fu) * SU, Math.min(fv, 1 - fv) * SV) };
  }
  function cropAt(x, z) {
    const f = fieldCell(x, z);
    if (hash2(f.iu * 3 + 1, f.iv * 5 + 2) < .16) return null; // 군데군데 야생 초지
    const c = Math.cos(f.ang), s = Math.sin(f.ang), uc = (f.iu + .5) * SU, vc = (f.iv + .5) * SV;
    const W = ISL.weights(uc * c + vc * s, -uc * s + vc * c);
    const ri = pickRegion(W, hash2(f.iu, f.iv));
    const list = REGION_CROPS[ri], name = list[Math.floor(hash2(f.iv + 99, f.iu - 7) * list.length)];
    return { name, crop: CROPS[name], ri, f };
  }

  // ---------- 격자 마스크 ----------
  let roadMask, resMask;
  const gIndex = (x, z) => { const i = Math.round((x + ISL.E) / ISL.STEP), j = Math.round((z + ISL.E) / ISL.STEP); return (i < 0 || j < 0 || i >= ISL.N || j >= ISL.N) ? -1 : j * ISL.N + i; };
  function stamp(mask, x, z, w, val = 1) {
    const S = ISL.STEP, E = ISL.E, N = ISL.N, r = Math.ceil((w + 2) / S), ci = Math.round((x + E) / S), cj = Math.round((z + E) / S);
    for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
      if (i < 0 || j < 0 || i >= N || j >= N) continue;
      const d = Math.hypot(x - (-E + i * S), z - (-E + j * S)), v = val * (1 - ISL.sstep(w * .55, w + 1.4, d)), k = j * N + i;
      if (v > mask[k]) mask[k] = v;
    }
  }
  function reserved(x, z) { const k = gIndex(x, z); return k >= 0 && resMask[k] > .5; }

  function farmable(x, z, h, slope) {
    if (h < 2.6 || h > 58 || slope > .11) return false;
    if (ISL.fbm(x * .005 + 9, z * .005, 3) < -.2) return false;
    if (Math.hypot(x, z) / ISL.coastRadius(x, z) > .9) return false;
    const k = gIndex(x, z); if (k >= 0 && (resMask[k] > .3 || roadMask[k] > .5)) return false;
    if (ISL.blocked(x, z)) return false;
    for (const r of ISL.rivers) { const q = ISL.riverNearest(r, x, z); if (q && q.d < q.w + 5) return false; }
    for (const L of ISL.lakes) if (Math.hypot(x - L.x, z - L.z) < L.r * 1.35) return false;
    return true;
  }

  // ---------- 마을과 길 ----------
  const villages = [], houses = [], roads = [], extraTrees = [], cells = new Map();
  function landOK(x, z, slopeMax) {
    for (const b of ISL.cityZones || []) if (x > b[0] - 8 && x < b[2] + 8 && z > b[1] - 8 && z < b[3] + 8) return false; // 실제 도시 구역에는 시골집을 짓지 않음
    const h = H(x, z); if (h < 2.5) return false; if (ISL.slopeAt(x, z) > slopeMax) return false;
    if (ISL.waterAt(x, z).level > h - 1) return false;
    for (const r of ISL.rivers) { const q = ISL.riverNearest(r, x, z); if (q && q.d < q.w + 6) return false; }
    return !ISL.blocked(x, z);
  }
  function plan() {
    const N = ISL.N; roadMask = new Float32Array(N * N); resMask = new Float32Array(N * N);
    const P = ISL.P, inward = (c, d) => [c.x - c.dirx * d, c.z - c.dirz * d];
    const anchors = [[P.eiffel.x, P.eiffel.z + 100], [P.lavender.x, P.lavender.z - 46], [-330, 398], inward(P.belemCoast, 30), [280, 472], [222, 584], [428, 428], [205, 4], [330, 112],
      [40, -345], [205, -442], inward(P.msmCoast, 16), [-255, 392], [532, 290], inward(P.jokul, 40), inward(P.etretat, 45), inward(P.algarve, 40), [300, -18], [-455, 360]];
    const anc = anchors.filter(([x, z]) => H(x, z) > 1);
    for (let k = 0; k < 5000 && villages.length < 26; k++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 640, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = H(x, z); if (h < 3 || h > 60 || !landOK(x, z, .09)) continue;
      if (villages.some(v => Math.hypot(v.x - x, v.z - z) < 105) || anc.some(([ax, az]) => Math.hypot(ax - x, az - z) < 60)) continue;
      villages.push({ x, z, ang: rng() * Math.PI, n: 0 });
    }
    // 마을 집 배치
    for (const v of villages) {
      const dx = Math.cos(v.ang), dz = Math.sin(v.ang), L = 44 + rng() * 38;
      const street = [];
      for (let t = -L / 2; t <= L / 2; t += 2) street.push([v.x + dx * t, v.z + dz * t]);
      roads.push(street);
      for (let t = -L / 2 + 5; t <= L / 2 - 5; t += 13 + rng() * 2.5) for (const sd of [-1, 1]) { // 집 폭(최대 11m)보다 넓게
        if (rng() < .12) continue;
        const off = 9.5 + rng() * 1.5, x = v.x + dx * t - dz * sd * off, z = v.z + dz * t + dx * sd * off;
        if (!landOK(x, z, .25)) continue;
        const ry = Math.atan2(dz * sd, -dx * sd); if (footprintY(x, z, ry, 9.5, 10).drop > 3.4) continue; // 너무 기운 땅엔 짓지 않음
        houses.push({ x, z, ry, v }); v.n++;
        stamp(resMask, x, z, 6);
      }
      // 마을 바깥쪽 농가 몇 채
      for (let k = 0; k < 4; k++) {
        const a = rng() * 6.28, r = L / 2 + 16 + rng() * 30, x = v.x + Math.cos(a) * r, z = v.z + Math.sin(a) * r;
        const ry = rng() * 6.28; if (!landOK(x, z, .2) || reserved(x, z) || houses.some(o => Math.hypot(o.x - x, o.z - z) < 15) || footprintY(x, z, ry, 9.5, 10).drop > 3.4) continue;
        houses.push({ x, z, ry, v, farm: true }); stamp(resMask, x, z, 6);
        roads.push(path(v.x + dx * 0, v.z, x, z, 3));
      }
      v.church = [v.x - dz * 16, v.z + dx * 16];
      { // 교회(신랑 18m)가 집과 겹치지 않는 자리만
        const ry = -v.ang, cs = Math.cos(ry), sn = Math.sin(ry), nc = [v.church[0] - 8 * sn, v.church[1] - 8 * cs];
        if (houses.some(h => [v.church, nc].some(([px, pz]) => Math.hypot(h.x - px, h.z - pz) < 12.5))) v.church = null;
      }
      if (v.church && landOK(v.church[0], v.church[1], .2)) stamp(resMask, v.church[0], v.church[1], 15); else v.church = null;
      stamp(resMask, v.x, v.z, 5);
    }
    // 마을과 명소를 잇는 길 (최소 신장 트리 + 몇 개의 고리)
    const nodes = villages.map(v => [v.x, v.z]).concat(anc);
    const inT = [0], edges = [];
    while (inT.length < nodes.length) {
      let best = null;
      for (const a of inT) for (let b = 0; b < nodes.length; b++) if (!inT.includes(b)) { const d = Math.hypot(nodes[a][0] - nodes[b][0], nodes[a][1] - nodes[b][1]); if (!best || d < best[2]) best = [a, b, d]; }
      inT.push(best[1]); edges.push(best);
    }
    for (let a = 0; a < villages.length; a++) {
      const ds = nodes.map((n, b) => [b, Math.hypot(n[0] - nodes[a][0], n[1] - nodes[a][1])]).filter(e => e[0] !== a).sort((p, q) => p[1] - q[1]);
      const e = ds[1]; if (e && e[1] < 190 && !edges.some(([p, q]) => (p === a && q === e[0]) || (q === a && p === e[0]))) edges.push([a, e[0], e[1]]);
    }
    for (const [a, b] of edges) roads.push(path(nodes[a][0], nodes[a][1], nodes[b][0], nodes[b][1], 18));
    for (const r of roads) for (const [x, z] of r) {
      const h = H(x, z); if (h < .6 || ISL.slopeAt(x, z) > .5) continue;
      if (ISL.waterAt(x, z).level > h - .3) continue;
      stamp(roadMask, x, z, 1.9);
    }
    // 길가 가로수 (프랑스 플라타너스, 교토 벚나무)
    for (const r of roads) for (let i = 0; i < r.length; i += 6) {
      const [x, z] = r[i], [x2, z2] = r[Math.min(r.length - 1, i + 1)]; const l = Math.hypot(x2 - x, z2 - z) || 1;
      const W = ISL.weights(x, z), ri = pickRegion(W, rng());
      if (!(ri === 2 && rng() < .55) && !(ri === 4 && rng() < .25)) continue;
      for (const sd of [-1, 1]) {
        const tx = x - (z2 - z) / l * sd * 4.2, tz = z + (x2 - x) / l * sd * 4.2;
        if (!landOK(tx, tz, .3) || reserved(tx, tz)) continue;
        extraTrees.push({ type: ri === 2 ? 'plane' : 'cherry', x: tx, z: tz });
      }
    }
  }
  function path(ax, az, bx, bz, wig) {
    const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), nx = -dz / L, nz = dx / L, pts = [];
    const ctrl = [[ax, az]];
    const segs = Math.max(1, Math.round(L / 60));
    for (let i = 1; i < segs; i++) { const t = i / segs, o = ISL.noise(ax * .01 + i, az * .01) * wig; ctrl.push([ax + dx * t + nx * o, az + dz * t + nz * o]); }
    ctrl.push([bx, bz]);
    return ISL.catmull(ctrl, 2);
  }

  // ---------- 지면 굽기 정보 (nature.js에서 호출) ----------
  function groundInfo(x, z, h, slope, k, c, G) {
    // G: { g, gc(Color), fl, fp, lu }
    if (farmable(x, z, h, slope)) {
      const cr = cropAt(x, z);
      if (cr) {
        G.lu = 1;
        if (cr.f.edge < 1.7) { const hd = HEDGE[cr.ri]; c.lerp(hd.c, .8); G.g = hd.g; G.gc.copy(hd.gc); G.fl = .03; }
        else {
          const cp = cr.crop; c.lerp(cp.tintC, .82); G.g = cp.g; G.gc.copy(cp.gcC); G.fl = cp.fl; G.fp = cp.fp;
          const id = cr.f.iu * 100003 + cr.f.iv;
          if (cp.rows && !cells.has(id)) cells.set(id, { iu: cr.f.iu, iv: cr.f.iv, ang: cr.f.ang, crop: cp });
        }
      }
    }
    const rm = roadMask[k];
    if (rm > 0) {
      const W = ISL.weights(x, z), rc = new THREE.Color(0, 0, 0);
      for (let i = 0; i < 5; i++) { rc.r += ROAD[i].r * W[i]; rc.g += ROAD[i].g * W[i]; rc.b += ROAD[i].b * W[i]; }
      c.lerp(rc, rm * .9); G.g *= 1 - rm; G.fl *= 1 - rm; if (rm > .5) G.lu = 2;
    }
    if (resMask[k] > .3) { G.g *= .4; G.fl *= .3; G.lu = 3; }
  }

  // ---------- 건물 ----------
  let LH, scene;
  const cache = {};
  const once = (k, f) => cache[k] || (cache[k] = f());
  function grp(x, z, ry, y) { const g = new THREE.Group(); g.position.set(x, y !== undefined ? y : H(x, z), z); g.rotation.y = ry; scene.add(g); return g; }
  // 경사지에서도 뜨거나 묻히지 않게: 바닥 높이 = 네 귀퉁이 중 가장 높은 땅 + 15cm
  function footprintY(x, z, ry, w, d) {
    const cs = Math.cos(ry), sn = Math.sin(ry); let hi = -1e9, lo = 1e9;
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]]) { const lx = a * w / 2, lz = b * d / 2, gx = x + lx * cs + lz * sn, gz = z - lx * sn + lz * cs, h = H(gx, gz); hi = Math.max(hi, h); lo = Math.min(lo, h); }
    return { floor: hi + .15, drop: hi - lo };
  }
  ISL.footprintY = footprintY;
  // 지붕 기와: 월드 좌표 줄무늬 (경사면을 따라 줄이 생김)
  const roofCache = {};
  function roofMat(c, kind) {
    const k = c + kind; if (roofCache[k]) return roofCache[k];
    const m = new THREE.MeshStandardMaterial({ color: c, roughness: kind === 'metal' ? .45 : .85, metalness: kind === 'metal' ? .35 : 0 });
    m.onBeforeCompile = sh => {
      sh.vertexShader = 'varying vec3 vRW;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vRW = (modelMatrix*vec4(transformed,1.0)).xyz;');
      const body = kind === 'tile' ? `float row = vRW.y*3.2; float t = fract(row); float col = fract((vRW.x+vRW.z)*1.6 + floor(row)*.5);
          diffuseColor.rgb *= (.78 + .22*smoothstep(0.,.35,t)) * (.9 + .1*smoothstep(.0,.08,col)*smoothstep(1.,.92,col)) * (.92 + .16*fract(sin(dot(floor(vec2(row,(vRW.x+vRW.z)*1.6)),vec2(12.9,78.2)))*43758.5));`
        : kind === 'slate' ? `float row = vRW.y*4.5; float t = fract(row); diffuseColor.rgb *= (.82 + .18*smoothstep(0.,.2,t)) * (.9 + .2*fract(sin(dot(floor(vec2(row,(vRW.x-vRW.z)*2.5+floor(row)*.5)),vec2(12.9,78.2)))*43758.5));`
        : kind === 'metal' ? `diffuseColor.rgb *= .85 + .15*smoothstep(.3,.5,abs(fract((vRW.x+vRW.z)*2.2)-.5));`
        : kind === 'thatch' ? `float n = fract(sin(dot(floor(vec2((vRW.x+vRW.z)*14., vRW.y*2.)),vec2(12.9,78.2)))*43758.5); diffuseColor.rgb *= .75 + .3*n * (.8+.2*fract(vRW.y*1.3));`
        : `float n = fract(sin(dot(floor(vec2((vRW.x+vRW.z)*6., vRW.y*6.)),vec2(12.9,78.2)))*43758.5); diffuseColor.rgb *= .85 + .2*n;`;
      sh.fragmentShader = 'varying vec3 vRW;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + body);
    };
    return roofCache[k] = m;
  }
  ISL.roofMat = roofMat;

  // ---------- 집 짓기 도구 ----------
  // 창 하나의 위치는 facade 텍스처와 같은 규칙: 칸 너비의 28%~72%, 층 높이의 20%~75%
  function house(g, o, r) {
    const { w, d, floors } = o, fh = o.fh || 3.1, h = floors * fh;
    const key = o.key + floors;
    const side = once(key, () => LH.facade(Object.assign({ cols: o.cols, rows: floors }, o.fac)));
    const front = once(key + 'F', () => LH.facade(Object.assign({ cols: o.cols, rows: floors, doorGap: true }, o.fac)));
    const sideD = once(key + 'D', () => LH.facade(Object.assign({ cols: o.sideCols || 2, rows: floors }, o.fac)));
    LH.mesh(g, new THREE.BoxGeometry(w, h, d), [sideD, sideD, LH.mat('#777'), LH.mat('#777'), front, side], 0, h / 2, 0);
    // 돌 기초 (경사 아래로 3m까지 내려감)
    const dep = (g.userData.drop || 0) + .9; LH.box(g, w + .16, dep + .15, d + .16, ISL.blockMat(o.plinth || '#8d877c', .6, .3), 0, -dep, 0);
    // 창틀·창턱·덧창 (실제 입체)
    const trimM = LH.mat(o.trim || '#f2eee6'), shM = o.shutter ? LH.mat(o.shutter) : null, boxM = o.flowers ? LH.mat('#7a4a2b') : null;
    const faces = [[w, o.cols, 0, d / 2, 0, true], [w, o.cols, 0, -d / 2, Math.PI, false], [d, o.sideCols || 2, w / 2, 0, Math.PI / 2, false], [d, o.sideCols || 2, -w / 2, 0, -Math.PI / 2, false]];
    for (const [fw, cols, fx, fz, fry, isFront] of faces) {
      const fg = new THREE.Group(); fg.position.set(fx, 0, fz); fg.rotation.y = fry; g.add(fg);
      const cw = fw / cols;
      for (let j = 0; j < floors; j++) for (let i = 0; i < cols; i++) {
        if (isFront && j === floors - 1 && Math.abs(-fw / 2 + (i + .5) * cw) < cw * .55) continue; // 1층 문 자리
        if (fry === Math.PI && o.mirrorBack === false) continue;
        const x = -fw / 2 + (i + .5) * cw, ww = cw * .44, wh = fh * .55, y0 = (floors - 1 - j) * fh + fh * .25;
        LH.box(fg, ww + .16, .08, .2, trimM, x, y0 - .08, .08);            // 창턱
        LH.box(fg, ww + .12, .1, .08, trimM, x, y0 + wh, .03);              // 인방
        for (const sx of [-1, 1]) LH.box(fg, .06, wh, .06, trimM, x + sx * (ww / 2 + .03), y0, .03);
        if (shM) for (const sx of [-1, 1]) LH.box(fg, ww * .48, wh, .04, shM, x + sx * (ww * .74 + .02), y0, .05);
        if (boxM && j < floors - 1 && r() < .5) { LH.box(fg, ww + .1, .22, .25, boxM, x, y0 - .3, .2); for (let k = 0; k < 4; k++) LH.sphere(fg, .1, ['#e8423a', '#f2c14e', '#e86b9a', '#ffffff'][k], x - ww / 2 + .12 + k * ww / 3.4, y0 - .02, .22); }
      }
    }
    // 문틀과 계단
    const fg = new THREE.Group(); fg.position.set(0, 0, d / 2); g.add(fg);
    const frM = LH.mat(o.doorFrame || o.trim || '#e9e4d8');
    for (const sx of [-1, 1]) LH.box(fg, .14, 2.35, .16, frM, sx * .64, 0, .04);
    LH.box(fg, 1.42, .16, .16, frM, 0, 2.3, .04);
    if (o.canopy) { LH.box(fg, 1.8, .08, .8, LH.mat(o.canopy), 0, 2.62, .4); for (const sx of [-1, 1]) LH.box(fg, .05, .35, .05, LH.mat(o.canopy), sx * .8, 2.3, .7); }
    LH.box(fg, 1.5, .18, .5, ISL.blockMat('#9a948a', .5, .18), 0, -.18, .3);  // 문턱 돌
    LH.box(fg, 1.14, 2.22, .02, '#17120d', 0, 0, .006);                         // 문 안쪽 어둠
    const gy = g.position.y, cs = Math.cos(g.rotation.y), sn = Math.sin(g.rotation.y);
    // 계단: 땅이 내려갈수록 한 칸씩 (칸 높이 17cm, 깊이 30cm), 각 칸은 땅까지 채움
    let k = 1;
    const k0 = 1; for (; k < 14; k++) { const z = .3 + k * .3, sx = g.position.x + (d / 2 + z) * sn, sz = g.position.z + (d / 2 + z) * cs, top = -.17 * k, gnd = H(sx, sz) - gy; if (top < gnd + .05) break; LH.box(fg, 1.5, top - gnd + .3, .3, ISL.blockMat('#9a948a', .5, .17), 0, gnd - .3, z); }
    if (k > 1) { // 계단을 실제로 밟고 오르내릴 수 있게
      const z0 = d / 2 + .25, z1 = d / 2 + .45 + k * .3, ax = g.position.x + z0 * sn, az = g.position.z + z0 * cs, bx = g.position.x + z1 * sn, bz = g.position.z + z1 * cs;
      ISL.walkables.push({ ax, az, bx, bz, hw: .85, yA: gy, yB: H(bx, bz), arch: 0, cx: (ax + bx) / 2, cz: (az + bz) / 2, dx: sn, dz: cs, len: z1 - z0, level: -99, noRail: true, stairs: true });
    }
    return h;
  }
  function chimney(g, x, z, y, c, cap) { LH.box(g, .7, 2, .7, ISL.blockMat(c, .35, .2), x, y - .6, z); LH.box(g, .9, .12, .9, LH.mat(cap || '#5a5650'), x, y + 1.4, z); LH.box(g, .25, .3, .25, LH.mat('#3a3632'), x, y + 1.52, z); }

  const STYLE = {
    // 포르투갈: 하얀 회벽, 색 띠, 테라코타 기와, 알가르브식 굴뚝
    pt(g, r) {
      const trim = ['#2f6db5', '#e2a33a', '#3f8f7a'][Math.floor(r() * 3)];
      const w = 6.4 + r() * 2, d = 6.2 + r() * 1.6, floors = r() < .6 ? 1 : 2;
      const h = house(g, { key: 'pt' + trim, w, d, floors, cols: 2, sideCols: 2, fac: { wall: '#f6f2ea', win: '#33404e', frame: '#fbf7ee', lit: .6 }, trim: '#fbf7ee', doorFrame: trim, plinth: '#cfc6b2' }, r);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) LH.box(g, .3, h, .3, trim, sx * (w / 2 - .1), 0, sz * (d / 2 - .1));
      LH.box(g, w + .1, .25, d + .1, trim, 0, h - .25, 0);
      LH.mesh(g, LH.hipGeo(w, d, 1.6, .45), roofMat('#c8643a', 'tile'), 0, h, 0);
      const cx = w / 2 - 1.2; LH.box(g, .8, 1.6, .8, '#f6f2ea', cx, h + .5, 0); LH.box(g, 1.1, .5, 1.1, '#f6f2ea', cx, h + 2.1, 0); LH.cone(g, .5, .5, 4, '#f6f2ea', cx, h + 2.6, 0, Math.PI / 4);
      return { w, d, h: h + 1.6 };
    },
    // 프로방스: 베이지 석회석, 파스텔 덧창, 낮은 기와
    prov(g, r) {
      const sh = ['#7b8fb3', '#7a9a7a', '#a58ab5'][Math.floor(r() * 3)];
      const w = 8.6 + r() * 2.4, d = 6.4 + r() * 1.6;
      const h = house(g, { key: 'prov' + sh, w, d, floors: 2, cols: 3, sideCols: 2, fac: { wall: '#dcc6a0', win: '#3d4652', frame: '#cdb38c', lit: .6 }, trim: '#e8dcc0', shutter: sh, flowers: true, plinth: '#a89a80' }, r);
      LH.mesh(g, LH.gableGeo(w, d, 1.8, .55), roofMat('#c46d3c', 'tile'), 0, h, 0);
      chimney(g, -w / 2 + 1.3, 0, h + 1, '#d0bb98');
      return { w, d, h: h + 1.8 };
    },
    // 노르망디: 반목조, 가파른 초가·슬레이트 지붕
    norm(g, r) {
      const w = 7.4 + r() * 2.2, d = 5.8 + r() * 1.4, thatch = r() < .6;
      const h = house(g, { key: 'norm', w, d, floors: 2, fh: 2.8, cols: 2, sideCols: 2, fac: { wall: '#efe7d6', win: '#2f3742', frame: '#5a3b28', timber: '#5a3b28', lit: .6 }, trim: '#5a3b28', plinth: '#7d776c' }, r);
      LH.mesh(g, LH.gableGeo(w, d, 4.2, .6), roofMat(thatch ? '#8d7b56' : '#4b4e57', thatch ? 'thatch' : 'slate'), 0, h, 0);
      if (thatch) LH.box(g, .7, .5, d + 1.3, roofMat('#6f8a4a', 'thatch'), 0, h + 4, 0);
      chimney(g, w / 2 - .9, 0, h + 2.4, '#8f7a64');
      return { w, d, h: h + 4.2 };
    },
    // 스위스 샬레: 석조 1층 + 목조 2층, 발코니, 깊은 처마
    ch(g, r) {
      const w = 8.6 + r() * 1.6, d = 7.4 + r() * 1.2;
      const h1 = house(g, { key: 'chs', w, d, floors: 1, cols: 3, sideCols: 2, fac: { wall: '#ece7dc', win: '#2c3036', frame: '#7a4a2b', lit: .6 }, trim: '#7a4a2b', shutter: '#3f6b48', plinth: '#8a8478' }, r);
      const wood = once('chw', () => LH.facade({ wall: '#7a4a2b', win: '#2c3036', frame: '#efe8d8', planks: '#5f3920', cols: 3, rows: 1, lit: .7 }));
      LH.box(g, w, 3, d, wood, 0, h1, 0);
      LH.mesh(g, LH.gableGeo(w, d, 2.9, 1.6), roofMat('#4a3a30', 'shingle'), 0, h1 + 3, 0);
      LH.box(g, w + .6, .2, 1.4, '#6b4226', 0, h1 + .1, d / 2 + .7);
      for (let x = -w / 2 - .2; x <= w / 2 + .2; x += .35) LH.box(g, .08, .9, .08, '#6b4226', x, h1 + .3, d / 2 + 1.35);
      LH.box(g, w + .6, .1, .12, '#6b4226', 0, h1 + 1.2, d / 2 + 1.35);
      for (let x = -w / 2 + .5; x < w / 2; x += .9) LH.sphere(g, .2, ['#d9333c', '#e85a8a'][Math.floor(r() * 2)], x, h1 + 1.35, d / 2 + 1.35);
      return { w, d, h: h1 + 6 };
    },
    // 아이슬란드: 골함석 집
    is(g, r) {
      const col = ['#c0392b', '#2e6f9e', '#e6b422', '#f4f1ea', '#3e7c5a'][Math.floor(r() * 5)];
      const w = 5.6 + r() * 1.6, d = 6.4 + r() * 1.6;
      const h = house(g, { key: 'is' + col, w, d, floors: 2, fh: 2.8, cols: 2, sideCols: 2, fac: { wall: col, win: '#2f3a44', frame: '#fff', corrugated: 1, lit: .8 }, trim: '#ffffff', plinth: '#4a4a4c' }, r);
      LH.mesh(g, LH.gableGeo(w, d, 2.4, .4), roofMat(['#b03a2e', '#2f5d50', '#3a3f45'][Math.floor(r() * 3)], 'metal'), 0, h, 0);
      chimney(g, 0, -d / 4, h + 1.4, '#e8e4dc', '#3a3f45');
      return { w, d, h: h + 2.4 };
    },
    // 아이슬란드: 잔디 지붕집 (흙벽 + 흰 박공 + 풀 지붕)
    turf(g, r) {
      const w = 5.4, d = 7.6;
      LH.box(g, w + 1.2, 1.9, d, ISL.blockMat('#5c5650', .5, .22), 0, -2.2, 0);
      LH.box(g, w + 1.2, 1.9, d, ISL.blockMat('#6a6258', .5, .22), 0, -.3, 0);
      const gab = new THREE.Shape(); gab.moveTo(-w / 2, 0); gab.lineTo(w / 2, 0); gab.lineTo(w / 2, 1.6); gab.lineTo(0, 3.6); gab.lineTo(-w / 2, 1.6);
      const front = once('turfF', () => LH.facade({ wall: '#f2efe6', win: '#2f3a44', frame: '#b03a2e', planks: '#d8d2c4', cols: 2, rows: 1, doorGap: true, lit: .8 }));
      const gm = new THREE.Mesh(new THREE.ShapeGeometry(gab), front); gm.position.set(0, 0, d / 2 + .02); g.add(gm);
      LH.mesh(g, LH.gableGeo(w + 1.2, d, 2.2, .3), roofMat('#eef2f5', 'grass'), 0, 1.6, 0); // 눈 덮인 잔디 지붕
      const fg = new THREE.Group(); fg.position.set(0, 0, d / 2); g.add(fg);
      for (const sx of [-1, 1]) LH.box(fg, .14, 2.35, .16, '#b03a2e', sx * .64, 0, .04); LH.box(fg, 1.42, .16, .16, '#b03a2e', 0, 2.3, .04);
      LH.box(fg, 1.5, .18, .5, '#7a746a', 0, -.18, .3);
      return { w, d, h: 3.8 };
    },
    // 교토 마치야: 1층 격자(코시), 1층 처마(히사시), 낮은 2층(쓰시니카이) + 무시코마도, 기와
    machiya(g, r) {
      const w = 6.4, d = 9;
      const h1 = house(g, { key: 'mch', w, d, floors: 1, fh: 3.1, cols: 3, sideCols: 3, fac: { wall: '#efe9dc', win: '#2a2017', frame: '#4e3626', lattice: '#2e2118', lit: .9 }, trim: '#3a281c', plinth: '#5a5650' }, r);
      // 앞면 1층 나무 격자 (문 양옆)
      for (const sx of [-1, 1]) for (let k = 0; k < 14; k++) LH.box(g, .045, 2.1, .06, '#3a2818', sx * (.95 + k * .16), .1, d / 2 + .06);
      for (const sx of [-1, 1]) for (const y of [.12, 1.1, 2.2]) LH.box(g, 2.3, .06, .08, '#3a2818', sx * 2.05, y, d / 2 + .07);
      // 1층 처마: 벽에서 앞으로 1.1m 경사
      const eave = new THREE.Mesh(new THREE.BoxGeometry(w + .4, .1, 1.2), roofMat('#44474e', 'tile')); eave.position.set(0, h1 + .05, d / 2 + .5); eave.rotation.x = .28; eave.castShadow = true; g.add(eave);
      for (let x = -w / 2; x <= w / 2 + .01; x += w / 4) LH.box(g, .08, .08, 1.15, '#3a2818', x, h1 - .12, d / 2 + .48);
      // 2층 (낮음, 무시코마도: 흰 회벽에 세로 살 창)
      const h2 = 2.2;
      LH.box(g, w, h2, d - 1.2, LH.mat('#efe9dc'), 0, h1, -.6);
      for (const sx of [-1.4, 1.4]) { LH.box(g, 1.4, .7, .06, '#cfc6b4', sx, h1 + .7, d / 2 - 1.15); for (let k = 0; k < 7; k++) LH.box(g, .07, .7, .1, '#efe9dc', sx - .6 + k * .2, h1 + .7, d / 2 - 1.12); }
      LH.box(g, w + .05, .16, d - 1.15, '#3a2818', 0, h1, -.6);
      LH.mesh(g, LH.gableGeo(w, d - 1.2, 1.7, .7), roofMat('#44474e', 'tile'), 0, h1 + h2, -.6);
      // 노렌(문 가림 천)
      LH.box(g, 1.15, .7, .02, '#2a3f6b', 0, 1.6, d / 2 + .22);
      return { w, d, h: h1 + h2 + 1.7 };
    },
    // 교토 산골 초가 (가야부키)
    farm(g, r) {
      const w = 9.4, d = 6.8;
      const h = house(g, { key: 'jfarm', w, d, floors: 1, fh: 3, cols: 3, sideCols: 2, fac: { wall: '#efe9dc', win: '#3a2c20', frame: '#4e3626', timber: '#4e3626', lit: .8 }, trim: '#4e3626', plinth: '#6a655c' }, r);
      LH.mesh(g, LH.hipGeo(w, d, 5, .9), roofMat('#8c7c5a', 'thatch'), 0, h, 0);
      LH.box(g, w * .5, .5, .8, roofMat('#3a3530', 'shingle'), 0, h + 4.6, 0);
      return { w, d, h: h + 5 };
    },
  };
  function styleFor(ri, x, z, r, farm) {
    if (ri === 0) return r() < .35 || farm ? 'turf' : 'is';
    if (ri === 1) return 'ch';
    if (ri === 2) return z < -120 ? 'norm' : 'prov';
    if (ri === 3) return 'pt';
    return farm || r() < .3 ? 'farm' : 'machiya';
  }
  function church(v) {
    const [x, z] = v.church, W = ISL.weights(v.x, v.z); let ri = 0; for (let i = 1; i < 5; i++) if (W[i] > W[ri]) ri = i;
    const g = grp(x, z, -v.ang, footprintY(x, z, -v.ang, 10, 18).floor), B = LH.box, M = LH.mesh;
    if (ri === 4) { // 작은 신사
      for (const s of [-1.6, 1.6]) LH.cyl(g, .22, .24, 3.6, 8, '#e5482c', s, 0, 7); B(g, 4.4, .3, .5, '#1d1b1b', 0, 3.7, 7); B(g, 3.8, .25, .4, '#e5482c', 0, 3.1, 7);
      B(g, 6, 3, 5, '#5a3b2a', 0, .4, 0); ISL.colBox(g, 0, 0, 6, 5, 6); M(g, LH.jRoofGeo(8.5, 7, 2.2, .3), '#3a3633', 0, 3.4, 0);
      for (const s of [-2.5, 2.5]) { B(g, .6, 1.2, .6, '#9a958c', s, 0, 4); B(g, 1, .8, 1, '#9a958c', s, 1.2, 4); B(g, 1.2, .3, 1.2, '#8a857c', s, 2, 4); }
      return;
    }
    const conf = [
      { wall: '#f4f1ea', roof: '#b03a2e', tw: 2.6, th: 8, sp: 4, spc: '#b03a2e', w: 5, d: 9, h: 4 },
      { wall: '#f1ede4', roof: '#4b4e57', tw: 3.4, th: 15, sp: 9, spc: '#3d4048', w: 8, d: 14, h: 7 },
      { wall: '#cdbb98', roof: '#4b4e57', tw: 4, th: 13, sp: 8, spc: '#4b4e57', w: 9, d: 16, h: 8 },
      { wall: '#f6f2ea', roof: '#c8643a', tw: 3.6, th: 12, sp: 2.5, spc: '#c8643a', w: 8, d: 14, h: 7 },
    ][ri];
    B(g, conf.w, conf.h + 3, conf.d, ISL.blockMat(conf.wall, .9, .45), 0, -3, -conf.d / 2); ISL.colBox(g, 0, -conf.d / 2, conf.w, conf.d, conf.h + 4, { kind: 'church' }); ISL.colBox(g, 0, conf.tw / 2, conf.tw, conf.tw, conf.th, { kind: 'church' }); M(g, LH.gableGeo(conf.w, conf.d, conf.w * .45, .4), roofMat(conf.roof, ri === 3 ? 'tile' : 'slate'), 0, conf.h, -conf.d / 2);
    B(g, conf.tw, conf.th + 3, conf.tw, ISL.blockMat(conf.wall, .9, .45), 0, -3, conf.tw / 2);
    B(g, conf.tw * .4, conf.tw * .5, .1, '#3a3d44', 0, conf.th - conf.tw * .7, conf.tw + .02);
    M(g, LH.hipGeo(conf.tw, conf.tw, conf.sp, .15), conf.spc, 0, conf.th, conf.tw / 2);
    if (ri === 3) for (const s of [-1, 1]) B(g, .3, conf.th, .3, '#e2a33a', s * conf.tw / 2, 0, conf.tw);
  }

  // ---------- 줄지어 심는 작물 ----------
  // 포도나무 한 칸(2.6m): 말뚝 + 철사 두 줄 + 뒤틀린 줄기 + 잎 카드로 된 얇은 잎 벽 + 포도송이
  ISL.vineGeo = function () {
    if (ISL._vine) return ISL._vine;
    const parts = [ISL.canopy([[-.75, 1.25, 0, .5, 1.5, .9, .32], [.0, 1.3, 0, .52, 1.5, .9, .32], [.75, 1.22, 0, .5, 1.5, .9, .32]], '#3f6a26', '#8fb84a', 41)];
    for (const x of [-1.3, 1.3]) parts.push([new THREE.CylinderGeometry(.035, .04, 1.7, 5).translate(x, .85, 0), '#6b5a46']);
    for (const y of [.8, 1.45]) parts.push([new THREE.CylinderGeometry(.006, .006, 2.6, 3).rotateZ(Math.PI / 2).translate(0, y, 0), '#9a9a9a']);
    for (const x of [-.65, .65]) { parts.push([new THREE.CylinderGeometry(.03, .05, .85, 5).rotateZ(x * .25).translate(x, .42, 0), '#4a3a2c']); for (const s of [-1, 1]) parts.push([new THREE.SphereGeometry(.07, 5, 4).scale(1, 1.6, 1).translate(x + s * .3, .78, .12 * s), '#4a2a5e']); }
    return ISL._vine = ISL.merge(parts);
  };
  function rowGeos() {
    const blob = (r, sx, sy, sz, y, c) => { const g = new THREE.IcosahedronGeometry(r, 0); g.scale(sx, sy, sz); g.translate(0, y, 0); return [g, c]; };
    return {
      vine: ISL.vineGeo(),
      tea: ISL.merge([blob(.7, 1.9, .8, 1.15, .45, '#ffffff')]),
      sunflower: ISL.merge([[new THREE.CylinderGeometry(.05, .07, 2, 4).translate(0, 1, 0), '#4f7a2e'], [new THREE.CylinderGeometry(.42, .42, .12, 10).rotateX(Math.PI / 2 - .3).translate(0, 2.05, .1), '#f2c21b'], [new THREE.CylinderGeometry(.2, .2, .14, 8).rotateX(Math.PI / 2 - .3).translate(0, 2.05, .16), '#5a3a1e'], blob(.3, 1.4, .25, .9, 1.2, '#4f7a2e')]),
      bale: ISL.merge([[new THREE.CylinderGeometry(.75, .75, 1.3, 12).rotateZ(Math.PI / 2).translate(0, .72, 0), '#d8c27a']]),
    };
  }
  function buildRows() {
    const G = rowGeos(), lists = { vine: [], tea: [], sunflower: [], bale: [] };
    const tint = (c, v) => new THREE.Color(c).multiplyScalar(v);
    for (const c of cells.values()) {
      const kind = c.crop.rows, cs = Math.cos(c.ang), sn = Math.sin(c.ang);
      if (kind === 'bales') {
        for (let k = 0; k < 7; k++) { const u = (c.iu + .15 + rng() * .7) * SU, v = (c.iv + .15 + rng() * .7) * SV, x = u * cs + v * sn, z = -u * sn + v * cs; const h = H(x, z); if (h > 2 && !ISL.world.solidAt(x, h + 1, z) && !ISL.blocked(x, z)) { lists.bale.push({ x, y: h - .1, z, s: 1, ry: rng() * 3 }); ISL.colCircle(x, z, .8, h - 1, h + 1.4); } }
        continue;
      }
      const [du, dv] = { vine: [2.6, 2.6], tea: [2.3, 2.3], sunflower: [1.15, 1.7], olive: [9, 9] }[kind];
      for (let u = c.iu * SU + 2.5; u < (c.iu + 1) * SU - 2.5; u += du) for (let v = c.iv * SV + 2.5; v < (c.iv + 1) * SV - 2.5; v += dv) {
        const x = u * cs + v * sn, z = -u * sn + v * cs, f = fieldCell(x, z);
        if (f.iu !== c.iu || f.iv !== c.iv) continue;
        const h = H(x, z); if (!farmable(x, z, h, ISL.slopeAt(x, z)) || ISL.world.solidAt(x, h + 1, z) || ISL.world.solidAt(x + 1, h + 1, z) || ISL.world.solidAt(x, h + 1, z + 1)) continue;
        if (ISL.treeBlocked(x, z)) continue;
        if (kind === 'olive') { extraTrees.push({ type: 'olive', x, z }); continue; }
        if (kind !== 'sunflower') ISL.colCircle(x, z, .45, h - 1, h + 1.3);
        lists[kind].push({ x, y: h - .05, z, s: .9 + rng() * .2, ry: c.ang, color: kind === 'vine' ? tint('#ffffff', .82 + rng() * .18) : kind === 'tea' ? tint('#3f6a2c', .85 + rng() * .3) : null });
      }
    }
    const m = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 });
    ISL.placeInstances(scene, G.vine, lists.vine, { lod: 380, tile: 120 });
    ISL.placeInstances(scene, G.tea, lists.tea, { material: m(), lod: 380, tile: 120 });
    ISL.placeInstances(scene, G.sunflower, lists.sunflower, { material: m(), lod: 300, tile: 120, shadow: false });
    ISL.placeInstances(scene, G.bale, lists.bale, { material: m(), lod: 500 });
    ISL.rowCounts = Object.fromEntries(Object.entries(lists).map(([k, v]) => [k, v.length]));
  }
  function buildSheep() {
    const geo = ISL.merge([[new THREE.IcosahedronGeometry(.75, 1).scale(1, .8, 1.3).translate(0, .95, 0), '#f3f0e8'], [new THREE.BoxGeometry(.38, .42, .5).translate(0, 1.05, .95), '#2b2826'],
      ...[[-.3, -.45], [.3, -.45], [-.3, .45], [.3, .45]].map(([x, z]) => [new THREE.CylinderGeometry(.07, .07, .6, 4).translate(x, .3, z), '#2b2826'])]);
    const list = [];
    for (const v of villages) {
      const W = ISL.weights(v.x, v.z); if (W[0] + W[1] < .5) continue;
      for (let k = 0; k < 9; k++) { const x = v.x + (rng() - .5) * 120, z = v.z + (rng() - .5) * 120, h = H(x, z); if (h < 3 || ISL.slopeAt(x, z) > .2 || reserved(x, z) || ISL.blocked(x, z) || ISL.world.solidAt(x, h + 1, z) || ISL.waterAt(x, z).level > h - .5) continue; list.push({ x, y: h, z, s: .9 + rng() * .3 }); }
    }
    ISL.placeInstances(scene, geo, list, { material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), lod: 400 });
  }

  function build(sc) {
    scene = sc; LH = ISL.LH;
    for (const h of houses) {
      const r = ISL.mulberry32(Math.floor(h.x * 13 + h.z * 7) | 0);
      const ri = pickRegion(ISL.weights(h.x, h.z), r());
      const st = styleFor(ri, h.x, h.z, r, h.farm);
      const fp = footprintY(h.x, h.z, h.ry, 10, 10.5);
      const g = grp(h.x, h.z, h.ry, fp.floor); g.userData.drop = fp.drop; g.userData.kind = 'house';
      const dims = STYLE[st](g, r); h.style = st; h.dims = dims; h.floorY = fp.floor;
      const door = ISL.Interior.addDoor(h, g, dims.w, dims.d, st, r);
      h.col = ISL.colBox(g, 0, 0, dims.w, dims.d, dims.h, { kind: 'house', pass: (lx, lz) => door.open > .55 && Math.abs(lx) < .7 && lz > -dims.d / 2 + .6, door });
    }
    for (const v of villages) if (v.church) church(v);
    buildRows(); buildSheep();
  }
  function landuseAt(x, z) { const k = gIndex(x, z); return k < 0 ? 0 : ISL.groundLU ? ISL.groundLU[k] : 0; }

  ISL.Land = { plan, build, groundInfo, farmable, cropAt, reserved, landuseAt, villages, houses, roads, extraTrees, cells, get roadMask() { return roadMask; } };
})();
