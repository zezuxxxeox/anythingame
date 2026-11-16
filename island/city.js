// 실제 도시 그대로: 오픈스트리트맵의 진짜 도로 선형과 건물 윤곽(1:1 축척)을 그 자리에 세운다.
// 데이터: island/osm/*.js (tools/osm2city.py 로 변환) — (c) OpenStreetMap contributors
(function () {
  const ISL = window.ISL, H = (x, z) => ISL.H(x, z);
  let scene, K;
  // 나라별 건축 양식: 칸 너비(bay)·층높이·기본 층수·벽 색·지붕
  const STYLE = {
    reyk: { bay: 2.8, gh: 2.9, uh: 2.8, lv: [2, 2, 2, 3], pal: ['#c0392b', '#2e6f9e', '#e6b422', '#f4f1ea', '#3e7c5a', '#8e5aa8', '#d9733a', '#e9e2d0', '#6f8fa8', '#b8c4b0'], roof: ['#f2f5f8', '#eef2f6', '#f6f8fa'], rh: 2.6, gable: 1, road: 'reyk', winter: 1, tint: '#dfe6ec', yard: '#eef2f6', door: 'is', skip: /Hallgrímskirkja/ },
    kyoto: { bay: 1.9, gh: 2.9, uh: 2.2, lv: [2, 2, 2, 1], pal: ['#efe8d8', '#e6dcc6', '#d9cdb4', '#f2ecdf'], roof: ['#3f4249', '#45484f', '#383b42'], rh: 1.5, gable: 1, road: 'kyoto', tint: '#6f6c66', yard: '#b3ab98', door: 'machiya', skip: /法観寺|八坂の塔/ },
    lisbon: { bay: 2.6, gh: 3.2, uh: 2.9, lv: [3, 4, 4, 5, 3], pal: ['#f2ead8', '#e5b04a', '#e9a6a1', '#f6f3ec', '#cfe0ea', '#f0d9a8', '#e8c9b0'], roof: ['#c25a32', '#b8532d', '#cc6a3c'], rh: 1.7, road: 'lisbon', tint: '#e2dccc', yard: '#d6cdb8', door: 'pt' },
    paris: { bay: 3, gh: 4.3, uh: 3.05, lv: [5, 6, 6, 6], pal: ['#e6d9bf', '#e2d4b8', '#eadfc8'], roof: ['#6e7b86', '#66737e'], rh: 1.1, mans: [1.5, 3.3], road: 'paris', tint: '#8f8a80', yard: '#a8a397', door: 'prov' },
  };
  const districts = [];
  const hash = (a, b) => { let h = (a * 73856093) ^ (b * 19349663); h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  function plan() {
    ISL.cityZones = ISL.cityZones || [];
    for (const id in ISL.OSM || {}) {
      const src = ISL.OSM[id], st = STYLE[id]; if (!st) continue;
      const D = { id, st, b: [], r: [], props: src.t, areas: src.g, walls: src.n, cells: new Map(), yard: new Map() };
      for (const a of src.b) { const p = []; for (let i = 4; i < a.length; i += 2) p.push([a[i], a[i + 1]]); if (st.skip && a[2] && st.skip.test(a[2])) continue; D.b.push({ lv: a[0], ht: a[1], name: a[2], kind: a[3], p }); }
      for (const a of src.r) { const p = []; for (let i = 4; i < a.length; i += 2) p.push([a[i], a[i + 1]]); D.r.push({ kind: a[0], w: a[1], name: a[2], surf: a[3], p, car: /primary|secondary|tertiary|residential|unclassified|living/.test(a[0]) }); }
      let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
      for (const b of D.b) { let cx = 0, cz = 0, rr = 0; for (const [x, z] of b.p) { cx += x; cz += z; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } b.cx = cx / b.p.length; b.cz = cz / b.p.length; for (const [x, z] of b.p) rr = Math.max(rr, Math.hypot(x - b.cx, z - b.cz)); b.rad = rr; ISL.noTree.push({ x: b.cx, z: b.cz, r: rr + 1.5 }); ISL.paved.push({ ax: b.cx - .1, az: b.cz, bx: b.cx + .1, bz: b.cz, hw: rr + 2.5 }); for (const [vx, vz] of b.p.concat([[b.cx, b.cz]])) for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (i * i + j * j <= 5) D.yard.set((Math.round(vx / 2) + i) * 100003 + Math.round(vz / 2) + j, 1); } // 건물 둘레 4m만 마당
      D.box = [x0 - 6, z0 - 6, x1 + 6, z1 + 6]; ISL.cityZones.push(D.box);
      // 도로가 지나는 칸(2m)을 기록 → 땅 색, 풀 없애기
      const mark = (x, z, w) => { const r = Math.ceil(w / 2); for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r + 1) D.cells.set((Math.round(x / 2) + i) * 100003 + Math.round(z / 2) + j, 1); };
      for (const r of D.r) {
        const hw = r.w / 2 + (r.car ? 2 : .3);
        for (let i = 0; i < r.p.length - 1; i++) { const [ax, az] = r.p[i], [bx, bz] = r.p[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 2)); for (let k = 0; k <= n; k++) mark(ax + (bx - ax) * k / n, az + (bz - az) * k / n, hw); ISL.noTreeSeg.push({ ax, az, bx, bz, w: hw + 1 }); ISL.paved.push({ ax, az, bx, bz, hw: hw + .2 }); }
      }
      const pc = new THREE.Color(st.tint), yc = new THREE.Color(st.yard);
      ISL.groundTints.push((x, z) => { if (!(x > D.box[0] && x < D.box[2] && z > D.box[1] && z < D.box[3])) return null; const k = Math.round(x / 2) * 100003 + Math.round(z / 2); return D.cells.has(k) ? [pc, .95, 0] : D.yard.has(k) ? [yc, .8, 0] : null; });
      if (id === 'lisbon') { const car = D.r.filter(r => r.car).sort((a, b) => b.p.length - a.p.length)[0]; if (car) ISL.tramPts = car.p; } // 트램은 실제 찻길을 따라
      districts.push(D);
    }
  }

  // ---------- 벽 타일 (한 칸 × 한 층) : 흰 바탕으로 그리고 건물마다 색을 곱함 ----------
  function tiles(id, st) {
    const F = K.facadeMat, rep = m => { for (const t of [m.map, m.emissiveMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; } m.vertexColors = true; return m; };
    const w = st.bay, W4 = w * 4;
    if (id === 'reyk') return {
      up: rep(F('city|reyk|up', w, st.uh, P => { P.rect(0, 0, w, st.uh, '#ffffff'); for (let x = 0; x < w; x += .076) P.rect(x, 0, .032, st.uh, 'rgba(0,0,0,.1)'); P.window({ cx: w / 2, y0: .85, w: 1.05, h: 1.3, frame: '#ffffff', bars: [2, 2], fw: .08, curtain: 'rgba(255,255,255,.45)' }); for (let q = 0; q < 7; q++) { const px = w / 2 - .33 + q * .11, py = .97 + (.2 - Math.abs(q - 3) * .055); P.rect(px - .012, .95, .024, py - .95, '#f4f0e8'); P.x.fillStyle = '#ffd86a'; P.x.beginPath(); P.x.arc(P.X(px), P.Y(py + .03), P.S(.035), 0, 7); P.x.fill(); } })),
      gr: rep(F('city|reyk|gr', W4, st.gh, P => { P.rect(0, 0, W4, st.gh, '#ffffff'); for (let x = 0; x < W4; x += .076) P.rect(x, .5, .032, st.gh, 'rgba(0,0,0,.1)'); P.rect(0, 0, W4, .5, '#9b9d9e'); for (const b of [0, 1, 3]) P.window({ cx: (b + .5) * w, y0: .9, w: 1.2, h: 1.4, frame: '#ffffff', bars: [2, 2], fw: .08 }); P.doorway(2.5 * w, 1.05, 2.2, '#ffffff'); P.x.strokeStyle = '#1f5a2c'; P.x.lineWidth = P.S(.09); P.x.beginPath(); P.x.arc(P.X(2.5 * w), P.Y(1.6), P.S(.2), 0, 7); P.x.stroke(); })),
    };
    if (id === 'kyoto') return {
      up: rep(F('city|kyoto|up', w, st.uh, P => { P.rect(0, 0, w, st.uh, '#ffffff'); P.noise('#8a7a60', .08, 200); P.rect(0, 0, .1, st.uh, '#3b2a1d'); P.rect(0, 0, w, .1, '#2a1c12'); P.rect(0, st.uh - .12, w, .12, '#2a1c12'); P.rect(w / 2 - .6, .6, 1.2, .85, '#2a2018'); for (let k = 0; k < 7; k++) P.rect(w / 2 - .56 + k * .18, .6, .09, .85, '#ece5d4'); })),
      gr: rep(F('city|kyoto|gr', W4, st.gh, P => { P.rect(0, 0, W4, st.gh, '#4a3526'); for (let x = .05; x < W4; x += .09) P.rect(x, .4, .045, st.gh - .7, (Math.floor(x / .09) % 2) ? '#6a4c38' : '#553c2a'); for (const y of [.4, 1.3, st.gh - .32]) P.rect(0, y, W4, .07, '#2a1c12'); for (let b = 0; b <= 4; b++) P.rect(b * w - .06, 0, .12, st.gh, '#2a1c12'); P.doorway(1.5 * w, 1.4, 2.2, '#2a1c12'); P.window({ cx: 3.5 * w, y0: .8, w: 1, h: 1.2, glass: '#1f1610', glassTop: '#3a2a1e', frame: '#4b3424', bars: [6, 1], shadow: false }); })), grPlain: 1,
    };
    if (id === 'lisbon') return {
      up: rep(F('city|lisbon|up', w, st.uh, P => { P.rect(0, 0, w, st.uh, '#ffffff'); P.noise('#6a5a40', .1, 300); P.window({ cx: w / 2, y0: .3, w: .95, h: 1.9, frame: '#2f5a3a', surround: '#f4f0e8', sw: .16, cap: .1, bars: [2, 3], curtain: 'rgba(250,245,235,.5)' }); P.rect(w / 2 - .7, .22, 1.4, .07, '#d9d4c8'); for (let k = 0; k < 9; k++) P.rect(w / 2 - .66 + k * .165, .29, .025, .8, '#1c1c1c'); P.rect(w / 2 - .68, 1.07, 1.36, .04, '#1c1c1c'); })),
      gr: rep(F('city|lisbon|gr', W4, st.gh, P => { P.rect(0, 0, W4, st.gh, '#ffffff'); P.noise('#6a5a40', .1, 600); P.rect(0, 0, W4, .8, '#d9d2c3'); for (const b of [0, 2]) P.window({ cx: (b + .5) * w, y0: 1, w: .95, h: 1.5, frame: '#5a3a28', surround: '#f4f0e8', sw: .16, cap: .1, bars: [2, 3] }); P.doorway(1.5 * w, 1.1, 2.3, '#f4f0e8'); P.doorway(3.5 * w, 1.1, 2.3, '#f4f0e8'); })),
    };
    return { // paris
      up: rep(F('city|paris|up', w, st.uh, P => { P.rect(0, 0, w, st.uh, '#ffffff'); P.noise('#8a7a5a', .12, 300); for (let y = 0; y < st.uh; y += .5) P.rect(0, y, w, .015, 'rgba(120,100,70,.2)'); P.window({ cx: w / 2, y0: .18, w: 1.25, h: 2.3, frame: '#f4efe6', surround: '#f6efe0', sw: .14, cap: .25, bars: [2, 4], curtain: 'rgba(240,230,210,.45)' }); for (let k = 0; k < 10; k++) P.rect(w / 2 - .72 + k * .16, .12, .03, .85, '#161616'); P.rect(w / 2 - .76, .95, 1.52, .05, '#161616'); P.rect(0, 0, w, .1, '#f5eedd'); })),
      gr: rep(F('city|paris|gr', W4, st.gh, P => { P.rect(0, 0, W4, st.gh, '#ffffff'); for (let y = .45; y < st.gh; y += .45) P.rect(0, y, W4, .05, 'rgba(90,75,50,.35)'); const cols = ['#4a1a22', '#1f3a2c']; for (const [b, n] of [[0, 2], [2.4, 1.6]]) { const c = cols[b ? 1 : 0]; P.rect(b * w + .3, .1, n * w - .6, 3.5, c); P.rect(b * w + .5, .35, n * w - 1, 2.9, '#1d242b'); P.rect(b * w + .3, 3.6, n * w - .6, .55, c); P.text(b ? 'BOULANGERIE' : 'CAFÉ · BRASSERIE', (b + n / 2) * w, 3.88, .34, '#e8c76a'); } P.doorway(2.2 * w, 1.3, 2.5, '#2b2b2b'); P.rect(0, st.gh - .08, W4, .08, '#f5eedd'); })),
    };
  }

  function ribbonGeo(list, lift, tile) {
    const pos = [], uv = [], idx = [];
    for (const { p, hw } of list) {
      let acc = 0, base = -1;
      const pts = []; for (let i = 0; i < p.length - 1; i++) { const [ax, az] = p[i], [bx, bz] = p[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 2.2)); for (let k = i ? 1 : 0; k <= n; k++) pts.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]); }
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1, nx = dz / L, nz = -dx / L, [x, z] = pts[i];
        if (i) acc += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
        const xl = x - nx * hw, zl = z - nz * hw, xr = x + nx * hw, zr = z + nz * hw, k = pos.length / 3;
        pos.push(xl, Math.max(H(xl, zl), H(x, z) - .05) + lift, zl, xr, Math.max(H(xr, zr), H(x, z) - .05) + lift, zr); uv.push(0, acc / tile, hw * 2 / tile, acc / tile);
        if (i) idx.push(k - 2, k, k - 1, k - 1, k, k + 1);
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }

  function buildDistrict(D) {
    const st = D.st, T = tiles(D.id, st), R = ISL.mulberry32(D.id.length * 7919 + 13), col = new THREE.Color();
    // ---- 도로: 실제 선형 그대로 ----
    const rd = K.ROADS[st.road], cars = D.r.filter(r => r.car), peds = D.r.filter(r => !r.car && r.kind !== 'steps'), steps = D.r.filter(r => r.kind === 'steps');
    const mk = (geo, tex, off) => { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: .92, polygonOffset: true, polygonOffsetFactor: off, polygonOffsetUnits: off })); m.receiveShadow = true; m.userData.dynamic = true; scene.add(m); };
    const walkTex = K.repTex(st.road + 'walk', 64, 128, rd.walk || rd.road), roadTex = K.repTex(st.road + 'road', 128, 256, rd.road);
    if (cars.length) { mk(ribbonGeo(cars.map(r => ({ p: r.p, hw: r.w / 2 + 1.9 })), .1, 4), walkTex, -2); const hero = st.winter ? cars.filter(r => /Skólavörðustígur/.test(r.name || '')) : cars, plain = cars.filter(r => !hero.includes(r)); if (hero.length) mk(ribbonGeo(hero.map(r => ({ p: r.p, hw: r.w / 2 })), .14, 10), roadTex, -4); if (plain.length) mk(ribbonGeo(plain.map(r => ({ p: r.p, hw: r.w / 2 })), .14, 8), K.repTex('snowroad', 64, 64, (x, w, h) => { x.fillStyle = '#c9d0d6'; x.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { x.fillStyle = i % 3 ? 'rgba(255,255,255,.5)' : 'rgba(110,120,130,.35)'; x.fillRect((i * 37) % w, (i * 53) % h, 3 + i % 4, 2); } x.fillStyle = 'rgba(90,96,104,.35)'; x.fillRect(w * .28, 0, 5, h); x.fillRect(w * .68, 0, 5, h); }), -4); }
    if (peds.length) mk(ribbonGeo(peds.map(r => ({ p: r.p, hw: r.w / 2 })), .12, 4), walkTex, -3);
    if (steps.length) mk(ribbonGeo(steps.map(r => ({ p: r.p, hw: r.w / 2 })), .16, .5), K.repTex('stairs', 64, 64, (x, w, h) => { x.fillStyle = '#d9d2c2'; x.fillRect(0, 0, w, h); x.fillStyle = '#8f887a'; x.fillRect(0, 0, w, 7); }), -5);

    // ---- 건물: 실제 윤곽 그대로 벽을 세우고 지붕을 얹음 ----
    const up = { pos: [], uv: [], col: [], idx: [] }, gr = { pos: [], uv: [], col: [], idx: [] }, rf = { pos: [], col: [], idx: [] };
    const quad = (B, a, b, y0, y1, u0, u1, v0, v1, c) => { const k = B.pos.length / 3; B.pos.push(a[0], y0, a[1], b[0], y0, b[1], b[0], y1, b[1], a[0], y1, a[1]); B.uv.push(u0, v0, u1, v0, u1, v1, u0, v1); for (let i = 0; i < 4; i++) B.col.push(c.r, c.g, c.b); B.idx.push(k, k + 1, k + 2, k, k + 2, k + 3); };
    let built = 0;
    for (const b of D.b) {
      let p = b.p; const n = p.length;
      let area = 0; for (let i = 0; i < n; i++) area += p[i][0] * p[(i + 1) % n][1] - p[(i + 1) % n][0] * p[i][1];
      if (area < 0) p = p.slice().reverse(); // 한 방향으로 통일
      let lo = 1e9, hi = -1e9, bad = false;
      for (const [x, z] of p) { const h = H(x, z); lo = Math.min(lo, h); hi = Math.max(hi, h); if (ISL.waterAt(x, z).level > h - .3 || h < 1.5) bad = true; }
      if (b.solid) bad = true;
      for (const q of (ISL.Landmarks.planData.inari || [])) if (Math.hypot(q[0] - b.cx, q[1] - b.cz) < b.rad + 3) { bad = true; break; }
      D.skip = D.skip || {}; const why = b.solid ? 'landmark' : bad ? 'water' : hi - lo > 9 ? 'slope' : null; if (why) { D.skip[why] = (D.skip[why] || 0) + 1; continue; }
      for (const pz of (ISL.Streets.plazas || [])) if (Math.hypot(b.cx - pz.x, b.cz - pz.z) < pz.r + b.rad) bad = true;
      if (bad) continue;
      const hsh = hash(Math.round(b.cx * 10), Math.round(b.cz * 10)), small = Math.abs(area) / 2 < 45;
      const lv = Math.max(1, Math.round(b.lv || (b.ht ? b.ht / 3 : small ? 1 : st.lv[Math.floor(hsh * st.lv.length)])));
      const y0 = hi + .12, yG = y0 + (lv > 1 || !small ? st.gh : 2.5), yT = yG + (lv - 1) * st.uh;
      col.set(st.pal[Math.floor(hash(Math.round(b.cz * 7), Math.round(b.cx * 3)) * st.pal.length)]); const fc = col.clone(), dark = col.clone().multiplyScalar(.62);
      const gc = T.grPlain ? new THREE.Color('#ffffff') : fc;
      let de = -1, dbest = 1e9, dpt = null;
      for (let i = 0; i < n; i++) { const a = p[i], c = p[(i + 1) % n], L = Math.hypot(c[0] - a[0], c[1] - a[1]), nb = Math.round(L / st.bay); if (nb < 3) continue; const ux = (c[0] - a[0]) / L, uz = (c[1] - a[1]) / L, s = L / (2 * nb), px = a[0] + ux * s, pz = a[1] + uz * s, ox = px + uz * 1.2, oz = pz - ux * 1.2; const fx = px + uz * .8, fz = pz - ux * .8; if (Math.abs(y0 - H(ox, oz)) > .7 || y0 - H(fx, fz) < -.3 || y0 - H(px, pz) < -.3 || ISL.world.solidAt(ox, y0 + 1, oz)) continue; let rdist = 60; for (const r of D.r) for (let k = 0; k < r.p.length - 1; k++) { if (Math.abs(r.p[k][0] - px) > 60 || Math.abs(r.p[k][1] - pz) > 60) continue; rdist = Math.min(rdist, ISL.segDist(ox, oz, r.p[k][0], r.p[k][1], r.p[k + 1][0], r.p[k + 1][1]).d); } if (rdist < dbest) { dbest = rdist; de = i; dpt = [px, pz, ux, uz, s, L]; } }
      for (let i = 0; i < n; i++) {
        const a = p[i], c = p[(i + 1) % n], dx = c[0] - a[0], dz = c[1] - a[1], L = Math.hypot(dx, dz); if (L < .05) continue;
        const nb = Math.max(1, Math.round(L / st.bay)), blank = L < st.bay * .7;
        quad(gr, a, c, lo - .6, y0, .002, .004, .002, .004, dark); // 기초
        if (blank) { quad(gr, a, c, y0, yG, .002, .02, .3, .32, gc); if (lv > 1) quad(up, a, c, yG, yT, .005, .03, .02, .04, fc); }
        else { const off = nb >= 3 ? .5 : 0; quad(gr, a, c, y0, yG, off, off + nb / 4, 0, 1, gc); if (lv > 1) quad(up, a, c, yG, yT, 0, nb, 0, lv - 1, fc); }
        // 충돌: 벽마다 얇은 상자 (안쪽으로 0.35m)
        if (L > .4) { const ux = dx / L, uz = dz / L, mx = (a[0] + c[0]) / 2 - uz * .3, mz = (a[1] + c[1]) / 2 + ux * .3; let extra = null;
          if (i === de && dbest < 40) { const [px, pz, , , s] = dpt, g = new THREE.Group(); g.position.set(px - uz * .1, y0, pz + ux * .1); g.rotation.y = Math.atan2(uz, -ux); scene.add(g);
            const door = ISL.Interior.addDoor({ x: b.cx, z: b.cz, ry: g.rotation.y, dims: { w: 6, d: 5 }, floorY: y0, street: 'city:' + D.id }, g, 6, .2, st.door, R);
            for (const q of [-1, 1]) ISL.LH.box(g, .14, 2.35, .18, st.door === 'machiya' ? '#2a1c12' : '#f1ece2', q * (door.sliding ? .82 : .64), 0, .14); ISL.LH.box(g, door.sliding ? 1.8 : 1.42, .16, .18, st.door === 'machiya' ? '#2a1c12' : '#f1ece2', 0, 2.3, .14); ISL.LH.box(g, 1.7, .14, .6, '#9a948a', 0, -.14, .4);
            const off = s - L / 2; extra = { door, pass: lx => door.open > .55 && Math.abs(lx - off) < .7 }; D.doors = (D.doors || 0) + 1; }
          ISL.world.add(Object.assign({ t: 'b', x: mx, z: mz, hw: L / 2, hd: .35, a: Math.atan2(-uz, ux), y0: lo - 2, y1: yT + 2, city: 1 }, extra || {})); }
      }
      // 지붕: 가장 긴 변 방향의 용마루로 모아 올림 (맞배/우진각/망사르드)
      let bi = 0, bl = 0; for (let i = 0; i < n; i++) { const L = Math.hypot(p[(i + 1) % n][0] - p[i][0], p[(i + 1) % n][1] - p[i][1]); if (L > bl) { bl = L; bi = i; } }
      const ax = (p[(bi + 1) % n][0] - p[bi][0]) / bl, az = (p[(bi + 1) % n][1] - p[bi][1]) / bl;
      let s0 = 1e9, s1 = -1e9, t0 = 1e9, t1 = -1e9; for (const [x, z] of p) { const s = x * ax + z * az, t = -x * az + z * ax; s0 = Math.min(s0, s); s1 = Math.max(s1, s); t0 = Math.min(t0, t); t1 = Math.max(t1, t); }
      const tc = (t0 + t1) / 2, wd = (t1 - t0) / 2, ln = (s1 - s0) / 2, sc = (s0 + s1) / 2, rl = st.gable ? ln : Math.max(0, ln - wd);
      const proj = ([x, z]) => { const s = Math.max(sc - rl, Math.min(sc + rl, x * ax + z * az)); return [s * ax - tc * az, s * az + tc * ax]; };
      const rc = new THREE.Color(st.roof[Math.floor(hsh * 97) % st.roof.length]), rh = Math.min(st.rh * 1.6, Math.max(st.rh * .5, wd * (st.rh / 4)));
      let ring = p.map(q => [q[0], yT, q[1]]);
      const stage = (f, dy) => { const nr = ring.map((q, i) => { const r = proj(p[i]); return [q[0] + (r[0] - q[0]) * f, q[1] + dy, q[2] + (r[1] - q[2]) * f]; }); for (let i = 0; i < n; i++) { const a = ring[i], c = ring[(i + 1) % n], c2 = nr[(i + 1) % n], a2 = nr[i], k = rf.pos.length / 3; rf.pos.push(...a, ...c, ...c2, ...a2); for (let q = 0; q < 4; q++) rf.col.push(rc.r, rc.g, rc.b); rf.idx.push(k, k + 1, k + 2, k, k + 2, k + 3); } ring = nr; };
      if (st.mans) { stage(Math.min(.5, st.mans[0] / Math.max(wd, 2)), st.mans[1]); stage(1, st.rh); } else stage(1, rh);
      built++;
    }
    const mesh = (B, mat) => { if (!B.pos.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3)); if (B.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(B.col, 3)); g.setIndex(B.idx); g.computeVertexNormals(); const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; m.userData.dynamic = true; scene.add(m); };
    mesh(up, T.up); mesh(gr, T.gr); mesh(rf, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: st.winter ? 1 : .8, side: THREE.DoubleSide }));
    D.built = built;

    // ---- 실제 위치의 가로등·나무·벤치·쓰레기통 ----
    const free = (x, z) => !ISL.world.solidAt(x, H(x, z) + 1, z) && ISL.waterAt(x, z).level < H(x, z) - .2 && !(ISL.Streets.plazas || []).some(q => Math.hypot(x - q.x, z - q.z) < q.r + 1);
    const trees = []; let lamps = 0;
    for (const [k, x, z] of D.props) {
      if (!free(x, z)) continue;
      if (k === 'lamp') { if (lamps++ % 2 === 0) K.lamp(x, z, st.road); }
      else if (k === 'tree') { if (st.winter) K.lightTree(x, z); else trees.push({ x, y: H(x, z), z, s: 1 + R() * .3 }); }
      else if (k === 'bench') K.bench(x, z, R() * 6.28, st.winter);
      else if (k === 'waste_basket') K.bin(x, z, st.road);
    }
    if (trees.length) ISL.placeInstances(scene, D.id === 'kyoto' ? 'cherry' : 'plane', trees);
    // 담장
    for (const w of D.walls || []) for (let i = 1; i + 3 < w.length; i += 2) { const ax = w[i], az = w[i + 1], bx = w[i + 2], bz = w[i + 3], L = Math.hypot(bx - ax, bz - az); if (L < .6 || L > 60) continue; const mx = (ax + bx) / 2, mz = (az + bz) / 2; if (!free(mx, mz)) continue; const g = new THREE.Group(); g.position.set(mx, Math.min(H(ax, az), H(bx, bz)) - .3, mz); g.rotation.y = Math.atan2(-(bz - az), bx - ax); scene.add(g); ISL.LH.box(g, L, w[0] === 'hedge' ? 1.5 : 1.6, .35, w[0] === 'hedge' ? '#3f6b3a' : '#a9a294', 0, 0, 0); ISL.colBox(g, 0, 0, L, .35, 1.6); }
    // ---- 사람들: 이름 있는 큰길을 따라 걷는다 ----
    const main = D.r.filter(r => r.name && (r.car || r.kind === 'pedestrian')).sort((a, b) => b.p.length - a.p.length);
    let wk = 0;
    for (const r of main) for (let i = 0; i < r.p.length - 1 && wk < 26; i++) { const a = r.p[i], b = r.p[i + 1]; if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 14) continue; for (const sd of [-1, 1]) { K.addWalker(a, b, sd * (r.w / 2 + (r.car ? .9 : -.8)), R, !!st.winter, .2); wk++; } }
    // ---- 겨울 거리: 큰길 위를 가로지르는 전구 줄 ----
    if (st.winter) for (const r of main.slice(0, 3)) { let acc = 0; for (let i = 0; i < r.p.length - 1; i++) { const a = r.p[i], b = r.p[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L; for (let t = (7 - acc % 7) % 7; t < L; t += 7) { const x = a[0] + ux * t, z = a[1] + uz * t, o = r.w / 2 + 2.2, p1 = [x + uz * o, H(x + uz * o, z - ux * o) + 5.4, z - ux * o], p2 = [x - uz * o, H(x - uz * o, z + ux * o) + 5.4, z + ux * o]; K.lightString(p1, p2, .8, 16); } acc += L; } }
  }

  function build(sc) {
    scene = sc; K = ISL.Streets.kit;
    // 이웃한 집끼리는 벽을 맞대므로, 다른 것(명소·기존 건물)과 겹치는지는 도시 벽을 세우기 전에 미리 판정
    for (const D of districts) for (const b of D.b) { b.solid = ISL.world.solidAt(b.cx, H(b.cx, b.cz) + 1.5, b.cz); for (const [x, z] of b.p) if (ISL.world.solidAt(x, H(x, z) + 1.5, z)) b.solid = true; }
    for (const D of districts) buildDistrict(D);
    const t = document.getElementById('title'); if (t && !document.getElementById('osmCredit')) { const d = document.createElement('div'); d.id = 'osmCredit'; d.textContent = '도시 지도 © OpenStreetMap contributors'; d.style.cssText = 'position:absolute;left:10px;bottom:8px;font-size:11px;opacity:.7;color:#fff'; t.appendChild(d); }
  }
  // 지금 서 있는 실제 길 이름
  function streetAt(x, z) { let best = null, bd = 9; for (const D of districts) { if (x < D.box[0] || x > D.box[2] || z < D.box[1] || z > D.box[3]) continue; for (const r of D.r) { if (!r.name) continue; for (let i = 0; i < r.p.length - 1; i++) { const d = ISL.segDist(x, z, r.p[i][0], r.p[i][1], r.p[i + 1][0], r.p[i + 1][1]).d; if (d < bd) { bd = d; best = r.name; } } } } return best; }
  ISL.City = { plan, build, districts, streetAt };
})();
