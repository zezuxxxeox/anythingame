// 다섯 나라가 합쳐진 섬의 지형 생성 (Node에서도 실행 가능하도록 THREE 의존성 없음)
(function (root) {
  const ISL = root.ISL = root.ISL || {};

  // ---------- 기본 수학 ----------
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;

  const perm = new Uint8Array(512);
  { const p = [...Array(256).keys()], r = mulberry32(1889); for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) perm[i] = p[i & 255]; }
  const GX = [1, -1, 1, -1, 1, -1, 0, 0], GY = [1, 1, -1, -1, 0, 0, 1, -1];
  function noise(x, y) {
    const F2 = .366025403, G2 = .211324865, s = (x + y) * F2, i = Math.floor(x + s), j = Math.floor(y + s), t = (i + j) * G2;
    const x0 = x - (i - t), y0 = y - (j - t), i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2, ii = i & 255, jj = j & 255;
    let n = 0, t0 = .5 - x0 * x0 - y0 * y0, t1 = .5 - x1 * x1 - y1 * y1, t2 = .5 - x2 * x2 - y2 * y2, g;
    if (t0 > 0) { g = perm[ii + perm[jj]] & 7; t0 *= t0; n += t0 * t0 * (GX[g] * x0 + GY[g] * y0); }
    if (t1 > 0) { g = perm[ii + i1 + perm[jj + j1]] & 7; t1 *= t1; n += t1 * t1 * (GX[g] * x1 + GY[g] * y1); }
    if (t2 > 0) { g = perm[ii + 1 + perm[jj + 1]] & 7; t2 *= t2; n += t2 * t2 * (GX[g] * x2 + GY[g] * y2); }
    return 70 * n;
  }
  function fbm(x, y, o) { let a = 1, f = 1, s = 0, n = 0; for (let i = 0; i < o; i++) { s += a * noise(x * f, y * f); n += a; a *= .5; f *= 2.03; } return s / n; }
  function ridge(x, y, o) { let a = 1, f = 1, s = 0, n = 0; for (let i = 0; i < o; i++) { let v = 1 - Math.abs(noise(x * f, y * f)); v *= v; s += a * v; n += a; a *= .5; f *= 2.1; } return s / n; }

  // ---------- 지역 ----------
  const REGIONS = [
    { id: 'iceland', name: '아이슬란드', flag: '🇮🇸', hello: 'Halló!', x: 0, z: -500 },
    { id: 'swiss', name: '스위스', flag: '🇨🇭', hello: 'Grüezi!', x: 360, z: -110 },
    { id: 'france', name: '프랑스', flag: '🇫🇷', hello: 'Bonjour !', x: -220, z: 10 },
    { id: 'portugal', name: '포르투갈', flag: '🇵🇹', hello: 'Olá!', x: -350, z: 420 },
    { id: 'kyoto', name: '교토', flag: '🇯🇵', hello: 'こんにちは!', x: 360, z: 410 },
  ];
  const _w = new Float32Array(5);
  function weights(x, z) {
    let dmin = 1e9; const d = [];
    for (let i = 0; i < 5; i++) { const r = REGIONS[i]; const v = Math.hypot(x - r.x, z - r.z) + noise(x * .005 + i * 7, z * .005) * 55; d.push(v); if (v < dmin) dmin = v; }
    let s = 0; for (let i = 0; i < 5; i++) { _w[i] = Math.exp(-(d[i] - dmin) / 45); s += _w[i]; }
    for (let i = 0; i < 5; i++) _w[i] /= s;
    return _w;
  }
  function regionAt(x, z) { const w = weights(x, z); let b = 0; for (let i = 1; i < 5; i++) if (w[i] > w[b]) b = i; return REGIONS[b]; }

  const gauss = (x, z, cx, cz, r) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (r * r));

  // ---------- 기본 지형 (명소 보정 전) ----------
  function coastRadius(x, z) {
    const a = Math.atan2(z, x);
    return 770 + noise(Math.cos(a) * 1.2 + 3, Math.sin(a) * 1.2 - 2) * 55 + noise(Math.cos(a) * 3.5, Math.sin(a) * 3.5) * 18;
  }
  function baseH(x, z) {
    const d = Math.hypot(x, z) / coastRadius(x, z);
    const land = sstep(1.03, 0.8, d);
    if (land <= 0) return -28 + fbm(x * .01, z * .01, 2) * 3;
    const W = weights(x, z);
    const inland = sstep(0.95, 0.6, d);
    let h = 2 + 6 * land + fbm(x * .005, z * .005, 4) * 6 + fbm(x * .02 + 9, z * .02, 3) * 2;
    // 스위스 알프스
    if (W[1] > .01) {
      const rg = ridge(x * .0062 + 3, z * .0062 + 1, 5), pk = Math.max(0, rg - .52);
      h += W[1] * inland * (rg * 135 - 18 + Math.pow(pk, 1.25) * 330 * (.75 + ridge(x * .021 + 7, z * .021, 3) * .5)); // 봉우리만 더 높고 날카롭게 (골짜기·마을은 그대로)
      const mx = x - 470, mz = z + 175, ca = Math.cos(.35), sa = Math.sin(.35);
      const u = mx * ca - mz * sa, v = mx * sa + mz * ca;
      const q = Math.max(Math.abs(u), Math.abs(v)) * .8 + (Math.abs(u) + Math.abs(v)) * .2;
      const m = Math.max(0, 1 - q / 120);
      if (m > 0) h = Math.max(h, 25 + 215 * Math.pow(m, 1.55) + ridge(x * .05, z * .05, 3) * 10 * m);
    }
    // 아이슬란드: 빙하, 용암 대지, 스코가포스 절벽
    if (W[0] > .01) {
      h += W[0] * (fbm(x * .03, z * .03, 3) * 3 + 110 * gauss(x, z, 60, -585, 125) + 30 * gauss(x, z, -60, -600, 70));
      const plateau = sstep(-436, -443, z + noise(x * .03, 2.2) * 5) * sstep(-350, -300, x) * sstep(10, -30, x);
      h += plateau * 58 * W[0]; // 스코가포스 절벽 (실제 높이 60m)
    }
    // 교토: 히가시야마 언덕, 이나리 산
    if (W[4] > .01) h += W[4] * inland * (ridge(x * .01, z * .01 + 4, 4) * 28 - 6 + 52 * gauss(x, z, 515, 320, 65) + 30 * gauss(x, z, 560, 420, 70) + 26 * gauss(x, z, 532, 238, 50));
    // 포르투갈: 신트라 산, 리스본 언덕
    if (W[3] > .01) h += W[3] * inland * (fbm(x * .008 + 2, z * .008, 4) * 14 + 46 * gauss(x, z, -485, 330, 55) + 20 * gauss(x, z, -330, 455, 65) + 34 * gauss(x, z, -255, 335, 55));
    // 프랑스: 완만한 평야
    if (W[2] > .01) h -= W[2] * fbm(x * .006, z * .006, 3) * 2;
    let out = h * land + (1 - land) * (-28 + fbm(x * .01, z * .01, 2) * 3);
    // 해안 절벽: 포르투갈 알가르브(황금빛 석회암), 프랑스 에트르타(하얀 백악)
    if (d > .8 && (W[2] > .05 || W[3] > .05)) {
      const ck = cliffK(x, z, W);
      if (ck > .01) {
        const a = Math.atan2(z, x);
        const plateau = 14 + fbm(x * .012, z * .012, 3) * 5 + ck * 4;
        const dd = d + noise(Math.cos(a) * 40, Math.sin(a) * 40) * .004;
        const edge = sstep(.994, .975, dd);
        const hc = edge * plateau + (1 - edge) * (-12);
        out = mix(out, hc, ck * sstep(.84, .92, d));
      }
    }
    return out;
  }
  const A_ET = Math.atan2(-330, -560);
  const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  function cliffK(x, z, W) {
    W = W || weights(x, z);
    const a = Math.atan2(z, x); let k = 0;
    if (W[3] > .05) {
      const cove = sstep(-.12, .2, noise(Math.cos(a) * 7 + 11, Math.sin(a) * 7 - 3));
      const excl = 1 - Math.exp(-(angDiff(a, 2.31) ** 2) / (.17 ** 2));
      k = Math.max(k, Math.min(1, W[3] * 1.6) * cove * excl);
    }
    if (W[2] > .05) k = Math.max(k, Math.min(1, W[2] * 1.4) * Math.exp(-(angDiff(a, A_ET) ** 2) / (.085 ** 2)));
    return k;
  }

  function coastPoint(tx, tz, offset) {
    const a = Math.atan2(tz, tx), c = Math.cos(a), s = Math.sin(a);
    let r = 250;
    while (r < 900 && baseH(c * r, s * r) > 0.6) r += 1;
    r += offset;
    return { x: c * r, z: s * r, dirx: c, dirz: s };
  }

  // ---------- 명소 위치 & 지형 보정 ----------
  const P = {};
  const features = [], lakes = [], walkables = [];
  let rivers = [];

  function addFlat(name, x, z, r, r2, dh = 0, h) {
    const f = { t: 'flat', x, z, r, r2, h: h !== undefined ? h : applyFeatures(x, z, baseH(x, z)) + dh };
    features.push(f); P[name] = { x, z, y: f.h }; return f;
  }
  function addLake(name, x, z, r, r2, level, depth, color) {
    const L = { t: 'lake', x, z, r, r2, level, depth, color };
    features.push(L); lakes.push(L); if (name) P[name] = { x, z, y: level }; return L;
  }

  function applyFeatures(x, z, h) {
    for (let i = 0; i < features.length; i++) {
      const f = features[i];
      if (f.t === 'flat') {
        const d = Math.hypot(x - f.x, z - f.z); if (d < f.r2) h = mix(h, f.h, sstep(f.r2, f.r, d));
      } else if (f.t === 'lake') {
        const d = Math.hypot(x - f.x, z - f.z) * (1 + noise(x * .05 + f.x, z * .05) * .08);
        if (d < f.r2) {
          const shore = f.level + 1.4;
          h = mix(h, shore, sstep(f.r2, f.r * 1.1, d));
          if (d < f.r * 1.15) h = Math.min(h, mix(f.level - f.depth, shore, sstep(f.r * .45, f.r * 1.12, d)));
        }
      } else if (f.t === 'msm') {
        const d = Math.hypot(x - f.x, z - f.z);
        if (d < 120) h = Math.max(h, mix(h, 0.5 + noise(x * .08, z * .08) * .25, sstep(120, 80, d)));
        if (d < 36) h = Math.max(h, 0.5 + 27 * Math.pow(1 - d / 36, 0.85) + noise(x * .2, z * .2) * 1.2);
      } else if (f.t === 'causeway') {
        const d = segDist(x, z, f.ax, f.az, f.bx, f.bz).d;
        if (d < f.w * 2) h = Math.max(h, mix(f.h, h, sstep(f.w, f.w * 2, d)));
      } else if (f.t === 'terrace') {
        const d = Math.hypot(x - f.x, z - f.z);
        if (d < f.r2) { const q = h / f.step, fl = Math.floor(q), fr = q - fl; const hs = (fl + sstep(.72, 1, fr)) * f.step; h = mix(h, hs, sstep(f.r2, f.r, d)); }
      } else if (f.t === 'islet') {
        const d = Math.hypot(x - f.x, z - f.z);
        if (d < f.r) h = Math.max(h, f.h * Math.pow(1 - d / f.r, 0.6));
      }
    }
    return h;
  }

  function segDist(px, pz, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    const t = clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1);
    return { d: Math.hypot(px - ax - dx * t, pz - az - dz * t), t };
  }

  // ---------- 강 ----------
  function catmull(pts, step) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => .5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    out.push(pts[pts.length - 1].slice());
    return out;
  }

  function makeRiver(name, ctrl, w0, w1) {
    const pts = catmull(ctrl, 3);
    const n = pts.length, lv = new Float32Array(n), wd = new Float32Array(n), s = new Float32Array(n);
    let acc = 0, cur = 1e9;
    for (let i = 0; i < n; i++) {
      if (i) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      s[i] = acc;
    }
    for (let i = 0; i < n; i++) {
      let h = applyFeatures(pts[i][0], pts[i][1], baseH(pts[i][0], pts[i][1])) - 0.6;
      for (const L of lakes) if (Math.hypot(pts[i][0] - L.x, pts[i][1] - L.z) < L.r * 1.25) h = Math.max(h, L.level - .08); // 발원 연못 안에서는 연못 수면에서 시작
      cur = Math.min(cur, h); lv[i] = cur; wd[i] = mix(w0, w1, Math.pow(s[i] / acc, 0.8)) * (1 + 1.7 * sstep(.8, 1, s[i] / acc)); // 하구로 갈수록 넓어짐
    }
    // 아주 짧은 구간의 급경사는 약간 부드럽게 (폭포는 남김)
    for (let it = 0; it < 2; it++) for (let i = 1; i < n - 1; i++) { const a = (lv[i - 1] + lv[i + 1]) / 2; if (Math.abs(lv[i - 1] - lv[i + 1]) < 4) lv[i] = Math.min(lv[i], a + .2); }
    let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
    for (const p of pts) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); minz = Math.min(minz, p[1]); maxz = Math.max(maxz, p[1]); }
    const r = { name, pts, lv, wd, s, len: acc, bb: [minx - 40, maxx + 40, minz - 40, maxz + 40] };
    rivers.push(r); return r;
  }

  // 강 위의 가장 가까운 점
  function riverNearest(r, x, z) {
    if (x < r.bb[0] || x > r.bb[1] || z < r.bb[2] || z > r.bb[3]) return null;
    let best = 1e9, bi = 0, bt = 0;
    const p = r.pts;
    for (let i = 0; i < p.length - 1; i++) {
      const ax = p[i][0], az = p[i][1];
      if (Math.abs(x - ax) > 45 || Math.abs(z - az) > 45) continue;
      const q = segDist(x, z, ax, az, p[i + 1][0], p[i + 1][1]);
      if (q.d < best) { best = q.d; bi = i; bt = q.t; }
    }
    if (best > 1e8) return null;
    return { d: best, i: bi, t: bt, level: mix(r.lv[bi], r.lv[bi + 1], bt), w: mix(r.wd[bi], r.wd[bi + 1], bt),
      tx: p[bi + 1][0] - p[bi][0], tz: p[bi + 1][1] - p[bi][1], x: mix(p[bi][0], p[bi + 1][0], bt), z: mix(p[bi][1], p[bi + 1][1], bt) };
  }

  function carve(x, z, h) {
    for (const r of rivers) {
      const q = riverNearest(r, x, z); if (!q) continue;
      const W = Math.max(q.w, 4.2), L = q.level; // 격자(3.2m)보다 좁으면 물길이 땅에 묻혀 끊겨 보임
      if (q.d < W * 2.6) {
        const target = q.d < W ? L - 2.6 * (1 - (q.d / W) ** 2) : L + ((q.d - W) / (1.6 * W)) ** 2 * 7;
        if (target < h) h = target;
      }
    }
    return h;
  }

  function Hexact(x, z) { return carve(x, z, applyFeatures(x, z, baseH(x, z))); }

  // ---------- 높이 격자 ----------
  const E = 820, STEP = 3.2, N = Math.round(2 * E / STEP) + 1;
  let grid = null;
  function H(x, z) {
    if (!grid) return Hexact(x, z);
    const gx = clamp((x + E) / STEP, 0, N - 1.001), gz = clamp((z + E) / STEP, 0, N - 1.001);
    const ix = gx | 0, iz = gz | 0, fx = gx - ix, fz = gz - iz, o = iz * N + ix;
    // 렌더 메시와 같은 삼각형 분할로 보간 (발이 땅에 정확히 닿도록)
    const h00 = grid[o], h10 = grid[o + 1], h01 = grid[o + N], h11 = grid[o + N + 1];
    if (fx + fz < 1) return h00 + (h10 - h00) * fx + (h01 - h00) * fz;
    return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
  }
  function normalAt(x, z) {
    const e = STEP, hx = H(x + e, z) - H(x - e, z), hz = H(x, z + e) - H(x, z - e);
    const l = Math.hypot(hx, 2 * e, hz); return [-hx / l, 2 * e / l, -hz / l];
  }
  function slopeAt(x, z) { return 1 - normalAt(x, z)[1]; }

  function waterAt(x, z) {
    let lvl = 0, kind = 'sea';
    for (const L of lakes) { const d = Math.hypot(x - L.x, z - L.z); if (d < L.r * 1.15 && L.level > lvl) { lvl = L.level; kind = 'lake'; } }
    for (const r of rivers) { const q = riverNearest(r, x, z); if (q && q.d < q.w && q.level > lvl) { lvl = q.level; kind = 'river'; } }
    return { level: lvl, kind };
  }

  // ---------- 초기화 ----------
  function init(progress) {
    // 해안 기준 명소
    P.belemCoast = coastPoint(-470, 575, 0);
    P.msmCoast = coastPoint(-620, -110, 0);
    P.blackCoast = coastPoint(170, -650, 0);
    P.belem = { x: P.belemCoast.x - P.belemCoast.dirx * 3, z: P.belemCoast.z - P.belemCoast.dirz * 3 };
    P.msm = { x: P.msmCoast.x + P.msmCoast.dirx * 85, z: P.msmCoast.z + P.msmCoast.dirz * 85 };

    features.push({ t: 'msm', x: P.msm.x, z: P.msm.z });
    features.push({ t: 'causeway', ax: P.msmCoast.x - P.msmCoast.dirx * 10, az: P.msmCoast.z - P.msmCoast.dirz * 10, bx: P.msm.x, bz: P.msm.z, w: 3, h: 1.7 });
    P.msm.y = 0.5;

    // 프랑스
    addFlat('eiffel', -150, 150, 82, 125);   // 실제 크기(330m) 에펠탑과 샹드마르스
    addFlat('lavender', 48, 238, 60, 100);
    // 포르투갈
    addFlat('belem', P.belem.x, P.belem.z, 13, 26, 0, 1.6);
    addFlat('pena', -485, 330, 16, 30, 1);
    // 교토
    addFlat('kinkaku', 280, 385, 58, 88);
    addLake('pond', 280, 405, 30, 34, P.kinkaku.y - 0.5, 1.8);
    addFlat('pagoda', 222, 498, 16, 30);
    addFlat('machiya', 222, 536, 10, 26);
    // 아이슬란드
    addFlat('hallgrim', 40, -395, 34, 55);
    addFlat('geysir', 205, -470, 26, 45);
    addFlat('lagoonArea', -255, -545, 45, 65);
    addLake('lagoon', -255, -545, 26, 30, P.lagoonArea.y - 0.4, 1.6, 'lagoon');
    // 스위스
    addFlat('lakeArea', 330, 40, 64, 88, 0);
    addLake('swissLake', 330, 40, 58, 62, P.lakeArea.y - 1.2, 6);
    P.chillon = { x: 330 + 50, z: 40 + 14 };
    features.push({ t: 'islet', x: P.chillon.x, z: P.chillon.z, r: 11, h: P.swissLake.y + 3.2 });
    P.chillon.y = P.swissLake.y + 3.2;
    addFlat('chalets', 260, -10, 30, 50);
    addFlat('lucerne', 182, -32, 34, 72, 0, 18);
    addFlat('luzStreet', 188, 0, 48, 84, 0, 18); // 루체른 구시가지 거리
    // 계단식 풍경
    features.push({ t: 'terrace', x: 330, z: -58, r: 26, r2: 40, step: 3 }); P.lavaux = { x: 330, z: -58 };
    features.push({ t: 'terrace', x: -255, z: 335, r: 40, r2: 56, step: 2.6 }); P.douro = { x: -255, z: 335 };
    features.push({ t: 'terrace', x: 532, z: 238, r: 40, r2: 56, step: 2.2 }); P.tanada = { x: 532, z: 238 };
    // 해안 명소
    P.etretat = coastPoint(-560, -330, 0);
    let best = null;
    for (let a = 1.97; a < 2.04; a += .005) {
      const c = coastPoint(Math.cos(a) * 600, Math.sin(a) * 600, 0), k = cliffK(c.x - c.dirx * 12, c.z - c.dirz * 12);
      if (!best || k > best.k) best = { ...c, k };
    }
    P.algarve = best;
    P.jokul = coastPoint(95, -720, -32);
    addLake('jokulLake', P.jokul.x, P.jokul.z, 30, 40, 0.7, 4, 'glacier');

    // 강의 발원지: 빙하 호수·샘 연못
    const spring = (x, z, r) => { const h = applyFeatures(x, z, baseH(x, z)); addLake(null, x, z, r, r + 10, h - .9, 2.2); };
    spring(420, -95, 9); spring(-105, -585, 11); spring(400, 175, 7); spring(-120, 238, 7);
    // 강
    makeRiver('센-론 강', [[420, -95], [360, -78], [290, -62], [230, -46], [180, -32], [110, -12], [40, 6], [-30, 24], [-80, 38], [-135, 40], [-190, 24], [-260, 0], [-340, -36], [-420, -70], [-500, -88], [-570, -84], [-640, -66], [-800, -40]], 1.4, 11);
    makeRiver('스코가 강', [[-105, -585], [-122, -525], [-140, -478], [-150, -450], [-152, -436], [-158, -418], [-178, -385], [-232, -347], [-320, -318], [-420, -298], [-520, -282], [-760, -255]], 1.2, 9);
    makeRiver('가쓰라 강', [[400, 175], [386, 240], [372, 300], [374, 352], [384, 410], [392, 462], [402, 505], [422, 552], [446, 605], [480, 760]], 1.3, 9);
    makeRiver('테주 강', [[-120, 238], [-160, 310], [-200, 382], [-242, 450], [-296, 486], [-360, 512], [-440, 540], [-600, 580]], 1.5, 15);

    grid = null;
    const g = new Float32Array(N * N);
    for (let j = 0; j < N; j++) {
      const z = -E + j * STEP;
      for (let i = 0; i < N; i++) g[j * N + i] = Hexact(-E + i * STEP, z);
      if (progress && j % 40 === 0) progress(j / N);
    }
    grid = g;
  }

  Object.assign(ISL, { cliffK, mulberry32, clamp, sstep, mix, noise, fbm, ridge, REGIONS, weights, regionAt, H, Hexact, normalAt, slopeAt,
    waterAt, riverNearest, segDist, catmull, init, P, features, lakes, walkables, getGrid: () => grid, get rivers() { return rivers; }, E, STEP, N, baseH, coastRadius });
})(typeof window !== 'undefined' ? window : globalThis);
