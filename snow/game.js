// 눈의 마을 — 해가 뜨지 않는 크리스마스 마을. 배치는 design/layout.js(설계도와 같은 데이터)를 그대로 3D로 세운다.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const MOBILE = matchMedia('(pointer:coarse)').matches, LQ = /lq/.test(location.search);
  const setLoad = (k, t) => { $('bar').firstElementChild.style.width = (k * 100) + '%'; if (t) $('loadTxt').textContent = t; };
  const frame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
  const L = window.SnowLayout(null), O = L.OUT;
  const X = x => x - 1200, Z = y => y - 800; // 배치 좌표(m) → 3D 좌표
  const sstep = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  let seed = 7; const R = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const rr = (a, b) => a + R() * (b - a), pick = a => a[Math.floor(R() * a.length)];
  const hash = (a, b) => { let h = (a * 73856093) ^ (b * 19349663); h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  // ---------- 지형 ----------
  const COAST = L.SEA.slice(0, 9);
  const noise2 = (x, y) => Math.sin(x * .021 + Math.sin(y * .017) * 2) * Math.cos(y * .019 + Math.sin(x * .013) * 2);
  function townMask(x, y) { const d = Math.min(x - 730, 1975 - x, y - 545, 1320 - y); return sstep(-45, 5, d); }
  function hgt(x, y) {
    let h = Math.max(0, 330 - y) * .5 * (.85 + .15 * Math.sin(x * .009)) + noise2(x, y) * 2.2;
    h += 90 * Math.exp(-((x - 1052) ** 2 + (y - 436) ** 2) / (2 * 105 * 105));
    const dS = Math.hypot(x - 2062, (y - 318) / 1.15); h = Math.max(h, 185 * Math.pow(Math.max(0, 1 - dS / 470), 1.35) + noise2(x * 2, y * 2) * 3 * (dS < 470 ? 1 : 0));
    h += 30 * Math.exp(-((x - 520) ** 2 + (y - 560) ** 2) / (2 * 120 * 120));
    h *= 1 - townMask(x, y);
    // 바다
    const dc = L.lineD(x, y, COAST), sea = L.inPoly(L.SEA, x, y);
    if (sea) h = Math.min(h, -1 - 5 * sstep(0, 30, dc)); else if (dc < 18) h = Math.min(h, .6 + dc * .25);
    // 얼음 호수와 개울
    const e = ((x - L.LAKE.x) / L.LAKE.rx) ** 2 + ((y - L.LAKE.y) / L.LAKE.ry) ** 2; if (e < 1.35) h = Math.min(h, -1.1 + 1.1 * sstep(.85, 1.35, e));
    const ds = L.lineD(x, y, L.STREAM); if (ds < 6) h -= (1 - ds / 6) * 1.3;
    return h;
  }
  // 걸을 수 있는 바닥 높이 (부두 위, 얼음 위 포함)
  const PIER = [[1870, 1262], [1902, 1410]];
  function floorAt(x, y) {
    if (L.lineD(x, y, PIER) < 3.8) return Math.max(hgt(x, y), .7);
    const e = ((x - L.LAKE.x) / L.LAKE.rx) ** 2 + ((y - L.LAKE.y) / L.LAKE.ry) ** 2; if (e < 1) return -.12;
    return hgt(x, y);
  }

  // ---------- 렌더러·장면 ----------
  const canvas = $('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !MOBILE, powerPreference: 'high-performance' });
  renderer.setPixelRatio(LQ ? .6 : Math.min(devicePixelRatio || 1, MOBILE ? 1.4 : 1.6)); renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.35;
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2('#1a2744', .0026);
  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, .3, 4000);
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
  const hemi = new THREE.HemisphereLight('#7d92c8', '#1c2438', 1.15); scene.add(hemi);
  const moon = new THREE.DirectionalLight('#b9c9f0', .55); moon.position.set(-300, 500, -400); scene.add(moon);
  const C = c => new THREE.Color(c);

  // 지오메트리 합치기 (색 포함)
  function merge(parts) {
    const pos = [], nor = [], col = [];
    for (const [geo0, color, mat4] of parts) { const geo = geo0.index ? geo0.toNonIndexed() : geo0; if (mat4) geo.applyMatrix4(mat4); const p = geo.attributes.position.array, n = geo.attributes.normal.array, c = C(color); for (let i = 0; i < p.length; i += 3) { pos.push(p[i], p[i + 1], p[i + 2]); nor.push(n[i], n[i + 1], n[i + 2]); col.push(c.r, c.g, c.b); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g;
  }
  const M4 = (x, y, z, ry, sx, sy, sz) => new THREE.Matrix4().compose(new THREE.Vector3(x || 0, y || 0, z || 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry || 0, 0)), new THREE.Vector3(sx || 1, sy || sx || 1, sz || sx || 1));
  const vcMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();

  // ---------- 하늘 (늘 밤: 푸른 저녁 ~ 깊은 밤, 오로라, 별) ----------
  const skyU = { uTop: { value: C('#0b1630') }, uHor: { value: C('#3a4f86') }, uAur: { value: 0 }, uTime: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }',
    fragmentShader: `varying vec3 vD; uniform vec3 uTop, uHor; uniform float uAur, uTime;
      float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h1(i), h1(i+vec2(1,0)), f.x), mix(h1(i+vec2(0,1)), h1(i+vec2(1,1)), f.x), f.y); }
      void main(){ float y = max(vD.y, 0.0); vec3 c = mix(uHor, uTop, pow(y, .55));
        vec2 sp = vD.xz / (vD.y + .25) * 180.0; float st = step(.9965, h1(floor(sp))) * smoothstep(.0, .25, vD.y); c += st * (0.6 + 0.4 * sin(uTime * 3. + h1(floor(sp)) * 40.)) * vec3(.9,.95,1.);
        // 오로라: 하늘을 가로지르는 커튼
        vec2 ap = vec2(atan(vD.x, vD.z) * 2.2, y * 3.0);
        float band = 0.; for (int i = 0; i < 3; i++) { float fi = float(i); float x = ap.x * (1.0 + fi * .35) + uTime * (.03 + fi * .015); float wv = sin(x * 1.7 + n2(vec2(x * .8, fi)) * 4.0) * .12 + .42 + fi * .09; float d = abs(ap.y - wv * 3.0 * .55 - .25); band += smoothstep(.5, 0., d) * (0.55 + 0.45 * n2(vec2(x * 6.0, uTime * .4 + fi))) * (1.0 - fi * .25); }
        float curtain = band * smoothstep(.04, .2, y) * smoothstep(.95, .35, y);
        vec3 ac = mix(vec3(.25,1.,.62), vec3(.75,.35,1.), smoothstep(.35, .9, y * 1.6));
        c += ac * curtain * uAur * .55;
        gl_FragColor = vec4(c, 1.0); }` }));
  scene.add(sky);

  // ---------- 지형 메시 ----------
  function buildGround() {
    const W = 2600, Hh = 1800, step = LQ ? 16 : 8, nx = W / step, nz = Hh / step, pos = [], col = [], idx = [];
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = -100 + i * step, y = -100 + j * step, h = hgt(x, y); pos.push(X(x), h, Z(y)); const v = .93 + noise2(x * 3, y * 3) * .03, rock = h > 40 ? sstep(60, 160, h) * .25 : 0; col.push(v - rock, v - rock * .9, v + .03 - rock * .7); }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i; idx.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); { const n = g.attributes.normal.array; for (let i = 0; i < n.length; i += 3) if (!(n[i] === n[i]) || !(n[i + 1] === n[i + 1]) || !(n[i + 2] === n[i + 2])) { n[i] = 0; n[i + 1] = 1; n[i + 2] = 0; } }
    scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, color: '#e8eef7' })));
    // 바다와 유빙
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(4000, 3000), new THREE.MeshLambertMaterial({ color: '#0f2440', emissive: '#06101e' })); sea.rotation.x = -Math.PI / 2; sea.position.set(0, -2.2, 900); scene.add(sea);
    const floe = []; for (let k = 0; k < 160; k++) { const x = rr(1250, 2500), y = rr(1330, 1700); if (!L.inPoly(L.SEA, x, y) || L.lineD(x, y, COAST) < 25) continue; floe.push([new THREE.CylinderGeometry(rr(3, 12), rr(3, 13), .7, 6 + Math.floor(R() * 3)), '#eef4fa', M4(X(x), -1.9, Z(y), R() * 6, 1, 1, rr(.5, 1))]); }
    if (floe.length) scene.add(new THREE.Mesh(merge(floe), vcMat));
    // 얼음 호수
    const ice = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshLambertMaterial({ color: '#cfe4f4', emissive: '#203248', transparent: true, opacity: .96 })); ice.rotation.x = -Math.PI / 2; ice.scale.set(L.LAKE.rx, L.LAKE.ry, 1); ice.position.set(X(L.LAKE.x), -.15, Z(L.LAKE.y)); scene.add(ice);
  }

  // ---------- 길 ----------
  function texCanvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
  const cobble = texCanvas(128, 128, (x, w, h) => { x.fillStyle = '#7d8590'; x.fillRect(0, 0, w, h); for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const v = 150 + ((i * 37 + j * 91) % 7) * 9; x.fillStyle = `rgb(${v},${v + 2},${v + 8})`; x.beginPath(); x.ellipse(i * 16 + 8 + (j % 2) * 8 - 4, j * 16 + 8, 7, 6.5, 0, 0, 7); x.fill(); } x.fillStyle = 'rgba(240,245,250,.55)'; for (let i = 0; i < 60; i++) x.fillRect((i * 53) % w, (i * 29) % h, 6 + i % 7, 3); });
  const trodden = texCanvas(64, 64, (x, w, h) => { x.fillStyle = '#d3dbe6'; x.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { x.fillStyle = i % 3 ? 'rgba(255,255,255,.55)' : 'rgba(140,150,170,.35)'; x.fillRect((i * 37) % w, (i * 23) % h, 2 + i % 5, 2 + i % 3); } });
  function ribbonGeo(list, lift, tile) {
    const pos = [], uv = [], idx = [];
    for (const { pts, w } of list) {
      const P = []; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], Lg = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(Lg / 3)); for (let k = i ? 1 : 0; k <= n; k++) P.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
      let acc = 0; const base = pos.length / 3;
      for (let i = 0; i < P.length; i++) { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l; if (i) acc += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
        for (const s of [-1, 1]) { const x = P[i][0] + nx * s * w / 2, y = P[i][1] + ny * s * w / 2; pos.push(X(x), Math.max(hgt(x, y), hgt(P[i][0], P[i][1])) + lift, Z(y)); uv.push((s + 1) / 2 * w / tile, acc / tile); }
        if (i) { const k = base + i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); } }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => i % 3 === 1 ? 1 : 0), 3)); g.setIndex(idx); return g;
  }
  function buildRoads() {
    const st = O.roads.filter(r => r.kind === 'street'), pa = O.roads.filter(r => r.kind === 'path'), fa = O.roads.filter(r => r.kind === 'fair');
    const mk = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.renderOrder = 1; scene.add(m); };
    const pm = (map, color, off) => new THREE.MeshLambertMaterial({ map, color, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: off, polygonOffsetUnits: off });
    mk(ribbonGeo(pa, .05, 3), pm(trodden, '#ffffff', -1)); mk(ribbonGeo(fa, .06, 3), pm(trodden, '#fff3e2', -2)); mk(ribbonGeo(st, .08, 4), pm(cobble, '#ffffff', -3));
    // 광장 바닥
    const pl = new THREE.Mesh(new THREE.CircleGeometry(31, 64), pm(cobble, '#ffffff', -4)); pl.rotation.x = -Math.PI / 2; pl.position.set(X(L.PLAZA[0]), .1, Z(L.PLAZA[1])); pl.material.map = cobble.clone(); pl.material.map.repeat.set(12, 12); pl.material.map.needsUpdate = true; scene.add(pl);
    // 스키 슬로프 (다진 눈)
    mk(ribbonGeo(L.RUNS.map(r => ({ pts: r.pts, w: r.w })), .12, 6), new THREE.MeshLambertMaterial({ color: '#f7fbff', emissive: '#1a2436', side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  }

  // ---------- 건물: 실제 배치 그대로, 창·문·목조 무늬는 셰이더로 ----------
  const bMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  bMat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aWall; attribute vec4 aInfo; varying vec2 vWall; varying vec4 vInfo;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWall = aWall; vInfo = aInfo;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec2 vWall; varying vec4 vInfo; float gWin = 0.0;
      float hh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      { float u = vWall.x, v = vWall.y, fh = vInfo.y, st = vInfo.z, shop = vInfo.w; float bay = st > 2.5 ? 3.2 : 2.6;
        float row = floor(v / fh), fv = fract(v / fh), col = floor(u / bay), fu = fract(u / bay);
        bool ground = row < .5; bool big = ground && shop > .5;
        float wx = big ? step(.07, fu) * step(fu, .93) : step(.3, fu) * step(fu, .7);
        float wy = big ? step(.12, fv) * step(fv, .8) : step(.32, fv) * step(fv, .82);
        float fx = big ? step(.04, fu) * step(fu, .96) : step(.26, fu) * step(fu, .74);
        float fy = big ? step(.09, fv) * step(fv, .84) : step(.28, fv) * step(fv, .86);
        float valid = step(.55, v) * step(fh, 50.0) * step(.9, vInfo.x);
        float door = (ground && shop < .5 && mod(col, 4.0) == 1.0) ? step(.3, fu) * step(fu, .7) * step(fv, .78) : 0.0;
        float lit = step(.3, hh(vec3(vInfo.x * 13.1, col, row)));
        if (st > .5 && st < 1.5 && !ground && (fv < .05 || fu < .045 || fu > .955)) diffuseColor.rgb = vec3(.23, .15, .1);
        if (st > 1.5 && st < 2.5) diffuseColor.rgb *= .93 + .07 * step(.5, fract(u * 6.5));
        if (st > 2.5) diffuseColor.rgb *= .9 + .1 * step(.5, fract(v * 4.0));
        if (valid > .5) {
          if (door > .5) diffuseColor.rgb = vec3(.3, .16, .09) * (1. + step(.48, abs(fu - .5)) * 0.);
          else if (fx * fy > .5 && wx * wy < .5) diffuseColor.rgb = st > 2.5 ? vec3(.25,.16,.1) : vec3(.93, .92, .88);
          else if (wx * wy > .5) { diffuseColor.rgb = mix(vec3(.08, .1, .16), vec3(.95, .74, .45), lit); gWin = lit * (big ? 1.7 : 1.25); }
        } }`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, .7, .38) * gWin;');
  };
  const roofMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const STYLES = [
    { test: f => ['#5b6676', '#6a5048', '#4f5a6a', '#7a5a4a'].includes(f), walls: ['#d9cfbf', '#cfc3ad', '#e3dccd', '#c9bba1', '#ddd4c4'], floors: [4, 5, 5], fh: 3.3, st: 0, shop: .8, pitch: .32 },
    { test: f => ['#c0392b', '#2e6f9e', '#e6b422', '#3e7c5a', '#f4f1ea', '#8e5aa8', '#d9733a'].includes(f), wallIsFill: 1, roof: ['#3a3f48', '#2c3038', '#5a2a24'], floors: [2, 2, 3], fh: 2.8, st: 2, shop: .25, pitch: .5 },
    { test: f => ['#6b4226', '#5a3825', '#7a4b2a'].includes(f), walls: ['#7a5236', '#6a4630', '#85593a'], floors: [2, 2], fh: 3, st: 3, shop: .1, pitch: .62 },
    { test: f => ['#b23a2e', '#d65a48', '#c4473a', '#a8322a', '#9e3328'].includes(f), walls: ['#a8322a', '#b4392f', '#9a2e26'], roof: ['#eef3f8'], floors: [1, 2], fh: 3.2, st: 3, shop: .5, pitch: .55 },
    { test: f => f === '#9a8f86' || f === '#8a8078', walls: ['#cfc8bd'], floors: [1], fh: 7, st: 0, shop: 0, pitch: .7 },
    { test: f => f === '#b9d3e6', walls: ['#d8e8f4'], floors: [1], fh: 9, st: 0, shop: 1, pitch: .25, glass: 1 },
    { test: () => true, walls: ['#efe6d2', '#e8d9b8', '#f2e0c8', '#dcc8a8', '#e6c9a8', '#efe9df'], floors: [3, 3, 4], fh: 2.9, st: 1, shop: .5, pitch: .55 },
  ];
  const colliders = [], grid = new Map(), GS = 24;
  const addCol = c => { c.br = c.t === 'c' ? c.r : Math.hypot(c.hw, c.hd); for (let i = Math.floor((c.x - c.br) / GS); i <= Math.floor((c.x + c.br) / GS); i++) for (let j = Math.floor((c.z - c.br) / GS); j <= Math.floor((c.z + c.br) / GS); j++) { const k = i * 9973 + j; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(c); } colliders.push(c); };
  const eaveLights = [], warmLights = [], colorLights = [];
  function buildBuildings() {
    const tiles = new Map(), T = k => { if (!tiles.has(k)) tiles.set(k, { w: { pos: [], nor: [], col: [], wall: [], info: [] }, r: { pos: [], nor: [], col: [] } }); return tiles.get(k); };
    const XCOL = ['#ffd27a', '#ffd27a', '#fff1c4', '#ff7a6a', '#7fd0ff', '#9fe0b8'];
    let id = 0;
    for (const b of O.buildings) {
      id++; const area = b.w * b.d, small = area < 10, stall = !small && area < 26 && (b.fill === '#c4473a' || b.fill === '#e6b422');
      const S = STYLES.find(s => s.test(b.fill)), hs = hash(Math.round(b.x * 10), Math.round(b.y * 10));
      const wallC = S.wallIsFill ? b.fill : S.walls[Math.floor(hs * S.walls.length)];
      const roofC = small ? '#eef3f8' : S.roof ? S.roof[Math.floor(hs * 7) % S.roof.length] : b.fill;
      const floors = small ? 1 : stall ? 1 : S.floors[Math.floor(hs * 13) % S.floors.length], fh = small ? 99 : stall ? 99 : S.fh, Ht = small ? 2.1 : stall ? 2.5 : floors * fh;
      const ca = Math.cos(b.ang), sa = Math.sin(b.ang), cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, c]) => [b.x + a * b.w / 2 * ca - c * b.d / 2 * sa, b.y + a * b.w / 2 * sa + c * b.d / 2 * ca]);
      let lo = 1e9, hi = -1e9; for (const [x, y] of cs) { const h = hgt(x, y); lo = Math.min(lo, h); hi = Math.max(hi, h); } hi = Math.max(hi, hgt(b.x, b.y));
      const base = hi + .05, top = base + Ht, tk = Math.floor(X(b.x) / 300) + ',' + Math.floor(Z(b.y) / 300), t = T(tk), wc = C(wallC);
      const info = [b.ridge === false && !stall ? 0 : 1, fh, small ? 0 : S.st, stall ? 1 : (hash(id, 3) < S.shop ? 1 : 0)];
      // 벽 4면
      for (let i = 0; i < 4; i++) { const a = cs[i], c = cs[(i + 1) % 4], ex = c[0] - a[0], ey = c[1] - a[1], Lg = Math.hypot(ex, ey), nx = ey / Lg, nz = -ex / Lg;
        const quad = [[a, lo - .6], [c, lo - .6], [c, top], [a, lo - .6], [c, top], [a, top]];
        for (const [[px, py], yy] of quad) { t.w.pos.push(X(px), yy, Z(py)); t.w.nor.push(nx, 0, nz); t.w.col.push(wc.r, wc.g, wc.b); t.w.wall.push(Math.hypot(px - a[0], py - a[1]), yy - base); t.w.info.push(...info); } }
      // 지붕: 긴 변 방향 용마루 맞배지붕 + 박공벽
      const long = b.w >= b.d, half = (long ? b.d : b.w) / 2 + .35, run = (long ? b.w : b.d) / 2 + .3, rh = Math.max(.6, half * (S.pitch || .5) * 1.8);
      const ux = long ? ca : -sa, uy = long ? sa : ca, vx = long ? -sa : ca, vy = long ? ca : sa;
      const P = (s, q, y) => [X(b.x + ux * s + vx * q), y, Z(b.y + uy * s + vy * q)];
      const rc = C(roofC), snow = C('#eef3f8'), rcol = small || stall ? (stall ? C(roofC) : snow) : rc.clone().lerp(snow, S.glass ? .1 : .72);
      const tri = (A, B, Cc, col, arr) => { const n = new THREE.Vector3().subVectors(new THREE.Vector3(...B), new THREE.Vector3(...A)).cross(new THREE.Vector3().subVectors(new THREE.Vector3(...Cc), new THREE.Vector3(...A))).normalize(); for (const v of [A, B, Cc]) { arr.pos.push(...v); arr.nor.push(n.x, n.y, n.z); arr.col.push(col.r, col.g, col.b); } };
      const y0 = top - .05, yr = top + rh;
      for (const q of [-1, 1]) { const A = P(-run, q * half, y0), B = P(run, q * half, y0), Cc = P(run, 0, yr), Dd = P(-run, 0, yr); if (q < 0) { tri(A, B, Cc, rcol, t.r); tri(A, Cc, Dd, rcol, t.r); } else { tri(B, A, Dd, rcol, t.r); tri(B, Dd, Cc, rcol, t.r); }
        const ec = rc.clone().multiplyScalar(.7); const A2 = P(-run, q * half, y0 - .18), B2 = P(run, q * half, y0 - .18); tri(A, B, B2, ec, t.r); tri(A, B2, A2, ec, t.r); }
      for (const s of [-1, 1]) { const A = P(s * (run - .3), -half + .35, top), B = P(s * (run - .3), half - .35, top), Cc = P(s * (run - .3), 0, yr - .1); tri(s < 0 ? A : B, s < 0 ? B : A, Cc, wc, t.r); }
      if (b.chimney && !small) { const cx = b.x + ux * run * .45 + vx * half * .35, cy = b.y + uy * run * .45 + vy * half * .35, hb = top + rh * .5, g = new THREE.BoxGeometry(.7, rh * .7 + 1.1, .7).toNonIndexed(); g.translate(X(cx), hb + (rh * .7 + 1.1) / 2, Z(cy)); const p = g.attributes.position.array, n = g.attributes.normal.array, cc = C(S.st === 3 ? '#6e6a66' : '#9b6b55'); for (let i = 0; i < p.length; i += 3) { t.r.pos.push(p[i], p[i + 1], p[i + 2]); t.r.nor.push(n[i], n[i + 1], n[i + 2]); const top2 = n[i + 1] > .5; t.r.col.push(top2 ? .93 : cc.r, top2 ? .95 : cc.g, top2 ? .97 : cc.b); } }
      // 처마 전구 (집의 40%), 가게 앞 전구
      if (!small && (stall || hash(id, 9) < .42)) { const colorful = stall || hash(id, 5) < .35; for (const q of [-1, 1]) for (let s = -run; s <= run; s += .5) { const p = P(s, q * (half + .02), y0 - .12); (colorful ? colorLights : warmLights).push(p[0], p[1] - Math.abs(Math.sin(s * 2.1)) * .14, p[2]); } }
      if (stall) { for (let s = -b.w / 2; s <= b.w / 2; s += .35) { const p = [X(b.x + ca * s), base + 2.3, Z(b.y + sa * s)]; colorLights.push(...p); } }
      addCol({ t: 'b', x: X(b.x), z: Z(b.y), hw: b.w / 2, hd: b.d / 2, cs: ca, sn: sa, y1: top + rh });
    }
    for (const [, t] of tiles) {
      if (t.w.pos.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(t.w.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(t.w.nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(t.w.col, 3)); g.setAttribute('aWall', new THREE.Float32BufferAttribute(t.w.wall, 2)); g.setAttribute('aInfo', new THREE.Float32BufferAttribute(t.w.info, 4)); g.computeBoundingSphere(); scene.add(new THREE.Mesh(g, bMat)); }
      if (t.r.pos.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(t.r.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(t.r.nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(t.r.col, 3)); g.computeBoundingSphere(); scene.add(new THREE.Mesh(g, roofMat)); }
    }
  }

  // ---------- 나무: 눈 쌓인 전나무 (구역별 묶음) ----------
  const firGeo = (() => { const parts = [[new THREE.CylinderGeometry(.08, .12, .5, 5).translate(0, .25, 0), '#4a3626']]; for (let k = 0; k < 4; k++) { const r = .5 - k * .1, y = .35 + k * .19; parts.push([new THREE.ConeGeometry(r, .34, 8).translate(0, y + .17, 0), k % 2 ? '#2f4f40' : '#35574a']); parts.push([new THREE.ConeGeometry(r * .82, .16, 8).translate(0, y + .3, 0), '#e9f0f6']); } return merge(parts); })();
  const treeTiles = [];
  function buildTrees() {
    const tiles = new Map(), all = O.trees.map(([x, y, r]) => [x, y, r * 3.4]).concat(O.firs);
    for (const [x, y, hgtT] of all) { const k = Math.floor(X(x) / 250) + ',' + Math.floor(Z(y) / 250); if (!tiles.has(k)) tiles.set(k, []); tiles.get(k).push([x, y, hgtT]); }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (const [k, list] of tiles) { const im = new THREE.InstancedMesh(firGeo, vcMat, list.length); let cx = 0, cz = 0;
      list.forEach(([x, y, h], i) => { e.set(0, hash(Math.round(x), Math.round(y)) * 6.28, 0); q.setFromEuler(e); m.compose(new THREE.Vector3(X(x), hgt(x, y) - .05, Z(y)), q, new THREE.Vector3(h * .55, h, h * .55)); im.setMatrixAt(i, m); cx += X(x); cz += Z(y); if (h > 3) addCol({ t: 'c', x: X(x), z: Z(y), r: Math.max(.3, h * .05) }); });
      im.computeBoundingSphere(); scene.add(im); treeTiles.push({ im, x: cx / list.length, z: cz / list.length }); }
    // 장식 트리 (놀이공원 작은 트리): 전구
    for (const [x, y, h] of O.firs) for (let i = 0; i < 26; i++) { const t = i / 26, a = t * 25, r = (1 - t) * h * .28; colorLights.push(X(x) + Math.cos(a) * r, hgt(x, y) + .3 + t * h * .92, Z(y) + Math.sin(a) * r); }
  }

  // ---------- 가로등 ----------
  function buildLamps() {
    const post = merge([[new THREE.CylinderGeometry(.06, .09, 4.2, 6).translate(0, 2.1, 0), '#1c1f24'], [new THREE.BoxGeometry(.38, .5, .38).translate(0, 4.4, 0), '#2a2c30'], [new THREE.ConeGeometry(.33, .3, 4).rotateY(.785).translate(0, 4.8, 0), '#1c1f24'], [new THREE.BoxGeometry(.3, .4, .3).translate(0, 4.4, 0), '#ffe0a8']]);
    const im = new THREE.InstancedMesh(post, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#000' }), O.lamps.length), m = new THREE.Matrix4();
    const pool = new THREE.InstancedMesh(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex, color: '#ffae5a', transparent: true, opacity: .32, depthWrite: false, blending: THREE.AdditiveBlending, fog: true }), O.lamps.length);
    O.lamps.forEach(([x, y], i) => { const h = floorAt(x, y); m.makeTranslation(X(x), h, Z(y)); im.setMatrixAt(i, m); m.makeTranslation(X(x), h + .15, Z(y)); pool.setMatrixAt(i, m); warmLights.push(X(x), h + 4.4, Z(y)); addCol({ t: 'c', x: X(x), z: Z(y), r: .2 }); });
    im.computeBoundingSphere(); pool.computeBoundingSphere(); scene.add(im); scene.add(pool);
  }

  // ---------- 빛 점들 (전구) ----------
  const lightMats = [];
  function lightPoints(arr, color, size) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    const cols = []; const base = Array.isArray(color) ? color.map(C) : [C(color)]; for (let i = 0; i < arr.length / 3; i++) { const c = base[i % base.length]; cols.push(c.r, c.g, c.b); } g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTex: { value: glowTex }, uSize: { value: size }, uScale: { value: 1 }, uTime: { value: 0 } },
      vertexShader: 'attribute vec3 color; varying vec3 vC; varying float vTw; uniform float uSize, uScale, uTime; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); vTw = .75 + .25 * sin(uTime * 2.0 + position.x * 3.1 + position.z * 1.7); gl_PointSize = clamp(uSize * 2.2 * uScale / -mv.z, 1.5, 64.0); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform sampler2D uTex; varying vec3 vC; varying float vTw; void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vC * t.a * 1.6 * vTw, t.a); }' });
    lightMats.push(mat); const p = new THREE.Points(g, mat); p.frustumCulled = false; scene.add(p); return p;
  }

  // ---------- 특별한 곳들 ----------
  const anim = [];
  function personGeo(coat) { return merge([[new THREE.CapsuleGeometry(.09, .62, 3, 6).translate(-.1, .42, 0), '#2a2d36'], [new THREE.CapsuleGeometry(.09, .62, 3, 6).translate(.1, .42, 0), '#2a2d36'], [new THREE.CylinderGeometry(.2, .27, .8, 10).translate(0, 1.13, 0), coat], [new THREE.CapsuleGeometry(.065, .5, 3, 6).translate(-.29, 1.12, 0), coat], [new THREE.CapsuleGeometry(.065, .5, 3, 6).translate(.29, 1.12, 0), coat], [new THREE.SphereGeometry(.14, 10, 8).translate(0, 1.64, 0), '#f1d2b6'], [new THREE.SphereGeometry(.15, 10, 6, 0, 6.3, 0, 1.6).translate(0, 1.67, 0), coat], [new THREE.SphereGeometry(.05, 6, 5).translate(0, 1.83, 0), '#ffffff'], [new THREE.TorusGeometry(.14, .055, 5, 10).rotateX(1.57).translate(0, 1.48, 0), '#f4f1ea']]); }
  function santaGeo() { return merge([[new THREE.CapsuleGeometry(.1, .6, 3, 6).translate(-.11, .42, 0), '#1a1a1a'], [new THREE.CapsuleGeometry(.1, .6, 3, 6).translate(.11, .42, 0), '#1a1a1a'], [new THREE.CylinderGeometry(.26, .36, .9, 12).translate(0, 1.15, 0), '#c0262c'], [new THREE.CylinderGeometry(.37, .37, .1, 12).translate(0, .86, 0), '#2a1a10'], [new THREE.CapsuleGeometry(.08, .5, 3, 6).translate(-.37, 1.15, 0), '#c0262c'], [new THREE.CapsuleGeometry(.08, .5, 3, 6).translate(.37, 1.15, 0), '#c0262c'], [new THREE.SphereGeometry(.16, 10, 8).translate(0, 1.72, 0), '#f1d2b6'], [new THREE.SphereGeometry(.17, 10, 8, 0, 6.3, 1.4, 1.8).translate(0, 1.66, .02), '#ffffff'], [new THREE.ConeGeometry(.17, .42, 10).translate(0, 2.0, 0), '#c0262c'], [new THREE.SphereGeometry(.06, 6, 5).translate(0, 2.22, 0), '#ffffff']]); }
  function bearGeo() { const W = '#f6f1e4'; return merge([[new THREE.SphereGeometry(.5, 12, 10).scale(1.55, 1, 1).translate(0, .78, 0), W], [new THREE.SphereGeometry(.3, 10, 8).translate(.82, 1.0, 0), W], [new THREE.SphereGeometry(.15, 8, 6).scale(1.3, .9, 1).translate(1.08, .94, 0), W], [new THREE.SphereGeometry(.05, 6, 5).translate(1.26, .97, 0), '#222'], [new THREE.SphereGeometry(.035, 6, 5).translate(1.0, 1.1, .14), '#222'], [new THREE.SphereGeometry(.035, 6, 5).translate(1.0, 1.1, -.14), '#222'], [new THREE.SphereGeometry(.08, 6, 5).translate(.75, 1.27, .17), W], [new THREE.SphereGeometry(.08, 6, 5).translate(.75, 1.27, -.17), W], ...[[.45, .22], [.45, -.22], [-.45, .22], [-.45, -.22]].map(([x, z]) => [new THREE.CylinderGeometry(.14, .13, .5, 8).translate(x, .25, z), W]), [new THREE.TorusGeometry(.2, .06, 5, 10).rotateY(1.57).translate(.62, 1.02, 0), '#c0262c']]); }
  function deerGeo() { const B = '#7a5236', D = '#4a3020'; return merge([[new THREE.CapsuleGeometry(.24, .75, 4, 8).rotateZ(1.57).translate(0, .95, 0), B], [new THREE.CapsuleGeometry(.09, .4, 3, 6).rotateZ(.6).translate(.55, 1.25, 0), B], [new THREE.SphereGeometry(.13, 8, 6).scale(1.5, 1, 1).translate(.75, 1.48, 0), B], [new THREE.SphereGeometry(.045, 6, 5).translate(.95, 1.47, 0), '#d22'], ...[[.3, .12], [.3, -.12], [-.32, .12], [-.32, -.12]].map(([x, z]) => [new THREE.CylinderGeometry(.04, .035, .72, 5).translate(x, .36, z), D]), ...[-1, 1].flatMap(s => [[new THREE.CylinderGeometry(.018, .02, .38, 4).rotateX(s * .5).translate(.68, 1.72, s * .09), '#d9c8a8'], [new THREE.CylinderGeometry(.015, .016, .2, 4).rotateZ(.9).translate(.76, 1.84, s * .17), '#d9c8a8']])]); }
  function sleighGeo() { return merge([[new THREE.BoxGeometry(2.0, .7, 1.2).translate(0, .75, 0), '#b3252b'], [new THREE.BoxGeometry(.5, 1.1, 1.2).translate(-.8, 1.1, 0), '#b3252b'], [new THREE.BoxGeometry(2.4, .06, .08).translate(0, .2, .5), '#e0b84a'], [new THREE.BoxGeometry(2.4, .06, .08).translate(0, .2, -.5), '#e0b84a'], [new THREE.SphereGeometry(.45, 8, 6).translate(.1, 1.3, 0), '#2e6f3e']]); }
  function buildSpecials() {
    const P = L.PLAZA, px = X(P[0]), pz = Z(P[1]);
    // 큰 트리 20m + 전구 900개 + 별
    { const parts = [[new THREE.CylinderGeometry(.5, .8, 3, 8).translate(0, 1.5, 0), '#4a3626']]; for (let k = 0; k < 8; k++) { const r = 6 - k * .7, y = 2 + k * 2.2; parts.push([new THREE.ConeGeometry(r, 3.4, 16).translate(0, y + 1.7, 0), k % 2 ? '#24463a' : '#2b5243']); } const tr = new THREE.Mesh(merge(parts), vcMat); tr.position.set(px, 0, pz); scene.add(tr);
      for (let i = 0; i < 1000; i++) { const t = i / 1000, a = t * 70, r = (1 - t) * 6.1 + .3; colorLights.push(px + Math.cos(a) * r, 2 + t * 17.5, pz + Math.sin(a) * r); }
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(.9), new THREE.MeshBasicMaterial({ color: '#ffe08a' })); star.position.set(px, 21, pz); scene.add(star); anim.push(t => { star.rotation.y = t * .8; });
      addCol({ t: 'c', x: px, z: pz, r: 6 });
      // 트리 꼭대기에서 광장 가장자리로 전구 줄 16가닥
      for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283, ex = px + Math.cos(a) * 32.5, ez = pz + Math.sin(a) * 32.5; for (let s = 0; s <= 1; s += .012) { const x = px + (ex - px) * s, z = pz + (ez - pz) * s, y = 19 + (4.6 - 19) * s - Math.sin(s * Math.PI) * 2.2; warmLights.push(x, y, z); } } }
    // 종탑 (시계탑)
    { const tx = px, tz = pz - 38; const tw = new THREE.Mesh(merge([[new THREE.BoxGeometry(10, 22, 10).translate(0, 11, 0), '#b9b0a4'], [new THREE.BoxGeometry(11, .8, 11).translate(0, 22.4, 0), '#8a8078'], [new THREE.ConeGeometry(7.4, 14, 4).rotateY(.785).translate(0, 29.8, 0), '#3e5f58'], [new THREE.CylinderGeometry(.15, .15, 3, 5).translate(0, 38, 0), '#c9a24a']]), vcMat); tw.position.set(tx, 0, tz); scene.add(tw);
      const face = new THREE.Mesh(new THREE.CircleGeometry(2.2, 32), new THREE.MeshBasicMaterial({ color: '#ffe8b8' })); face.position.set(tx, 17, tz + 5.02); scene.add(face); addCol({ t: 'b', x: tx, z: tz, hw: 5, hd: 5, cs: 1, sn: 0 }); }
    // 장터 오두막 (광장)
    for (const s of O.stalls) buildStall(s.x, s.y, s.ang, s.color);
    // 회전목마 (광장, 놀이공원)
    const carousel = (x, y, r) => { const g = new THREE.Group(); g.position.set(X(x), hgt(x, y), Z(y)); scene.add(g); const rot = new THREE.Group(); g.add(rot);
      rot.add(new THREE.Mesh(merge([[new THREE.CylinderGeometry(r, r, .4, 24).translate(0, .2, 0), '#d8b6c4'], [new THREE.ConeGeometry(r * 1.08, r * .45, 24).translate(0, 4.2 + r * .22, 0), '#c0392b'], [new THREE.CylinderGeometry(.25, .25, 4.2, 8).translate(0, 2.1, 0), '#e6b422']]), vcMat));
      for (let k = 0; k < Math.round(r * 2); k++) { const a = k / Math.round(r * 2) * 6.283; rot.add(new THREE.Mesh(merge([[new THREE.CylinderGeometry(.04, .04, 3.8, 4).translate(0, 2.1, 0), '#e6b422'], [new THREE.BoxGeometry(.9, .5, .25).translate(0, 1.3, 0), k % 2 ? '#f4f1ea' : '#7a5236']]), vcMat)).position.set(Math.cos(a) * r * .78, 0, Math.sin(a) * r * .78); }
      const lp = []; for (let k = 0; k < 60; k++) { const a = k / 60 * 6.283; lp.push(Math.cos(a) * r * 1.05, 4.05, Math.sin(a) * r * 1.05); } const pts = lightPointsLocal(lp, ['#ffd27a', '#fff1c4'], .5); rot.add(pts);
      anim.push((t, dt) => { rot.rotation.y += dt * .35; rot.children.forEach((c, i) => { if (i > 0 && c.position) c.position.y = Math.sin(t * 2 + i) * .25; }); }); addCol({ t: 'c', x: X(x), z: Z(y), r: r + .3 }); };
    carousel(P[0] + 16, P[1] + 14, 5.5);
    for (const s of O.specials) {
      if (s.type === 'carousel') carousel(s.x, s.y, s.r);
      if (s.type === 'ferris') buildFerris(s.x, s.y, s.r);
      if (s.type === 'coaster') buildCoaster(s.pts);
      if (s.type === 'swing') buildSwing(s.x, s.y, s.r);
      if (s.type === 'slide') { const g = new THREE.Mesh(merge([[new THREE.CylinderGeometry(2.4, 2.8, 11, 12).translate(0, 5.5, 0), '#e8f4fb'], [new THREE.ConeGeometry(3.2, 3, 12).translate(0, 12.5, 0), '#2e6f9e']]), vcMat); g.position.set(X(s.x), 0, Z(s.y)); scene.add(g); const cv = []; for (let i = 0; i <= 60; i++) { const t = i / 60, a = t * 12.5; cv.push(new THREE.Vector3(X(s.x) + Math.cos(a) * 4.6, 10.5 - t * 10, Z(s.y) + Math.sin(a) * 4.6)); } scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cv), 120, .55, 6), new THREE.MeshLambertMaterial({ color: '#7fc8e8' }))); addCol({ t: 'c', x: X(s.x), z: Z(s.y), r: 5.4 }); }
      if (s.type === 'train') buildTrain(s.pts);
      if (s.type === 'fairground') { const sh = new THREE.Shape(s.poly.map(([x, y]) => new THREE.Vector2(X(x), -Z(y)))); const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshLambertMaterial({ color: '#f3ede4', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })); m.rotation.x = -Math.PI / 2; m.position.y = .04; scene.add(m);
        const poly = s.poly.concat([s.poly[0]]); for (let i = 0; i < poly.length - 1; i++) { const a = poly[i], b = poly[i + 1], Lg = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let d = 0; d < Lg; d += .8) { const x = a[0] + (b[0] - a[0]) * d / Lg, y = a[1] + (b[1] - a[1]) * d / Lg; colorLights.push(X(x), 1.25 + Math.sin(d * .8) * .1, Z(y)); } } }
    }
    // 빛의 대로: 천사 날개 조명
    for (const a of O.arches) { const cx = X(a.x), cz = Z(a.y), nx = -a.uy, nz = a.ux; for (const s of [-1, 1]) { for (let t = 0; t <= 1; t += .02) { const w = t * a.half * .98; warmLights.push(cx + nx * s * w, 8.2 + Math.sin(t * Math.PI) * 2.6 - t * 1.2, cz + nz * s * w); }
        for (let f = 1; f <= 6; f++) { const t = f / 7, w = t * a.half * .98, y0 = 8.2 + Math.sin(t * Math.PI) * 2.6 - t * 1.2; for (let d = 0; d <= 1; d += .1) warmLights.push(cx + nx * s * (w - d * .5), y0 - d * (1.2 + Math.sin(t * Math.PI) * 1.6), cz + nz * s * (w - d * .5) + a.ux * d * .4); } }
      for (const s of [-1, 1]) { const x = cx + nx * s * a.half, z = cz + nz * s * a.half; const pole = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 8.4, 5), new THREE.MeshLambertMaterial({ color: '#222' })); pole.position.set(x, 4.2, z); scene.add(pole); } }
    // 부두와 등대
    { const [a, b] = PIER, len = Math.hypot(b[0] - a[0], b[1] - a[1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]); const deck = new THREE.Mesh(new THREE.BoxGeometry(len, .5, 7.5), new THREE.MeshLambertMaterial({ color: '#8b7355' })); deck.position.set(X((a[0] + b[0]) / 2), .45, Z((a[1] + b[1]) / 2)); deck.rotation.y = -ang; scene.add(deck);
      const lx = X(b[0]), lz = Z(b[1] + 4), parts = []; for (let k = 0; k < 6; k++) parts.push([new THREE.CylinderGeometry(2.4 - k * .15, 2.5 - k * .15, 3.5, 16).translate(0, 1.75 + k * 3.5, 0), k % 2 ? '#c0392b' : '#f4f1ea']); parts.push([new THREE.CylinderGeometry(1.5, 1.5, 2, 12).translate(0, 22, 0), '#ffe8b0']); parts.push([new THREE.ConeGeometry(1.9, 1.8, 12).translate(0, 23.9, 0), '#2c3038']);
      const lh = new THREE.Mesh(merge(parts), vcMat); lh.position.set(lx, 0, lz); scene.add(lh); addCol({ t: 'c', x: lx, z: lz, r: 2.6 });
      const beam = new THREE.Mesh(new THREE.ConeGeometry(14, 160, 24, 1, true).translate(0, -80, 0).rotateZ(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fff2c8', transparent: true, opacity: .07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); const bg = new THREE.Group(); bg.position.set(lx, 22, lz); bg.add(beam); scene.add(bg); anim.push(t => { bg.rotation.y = t * .6; }); }
    // 노천 온천: 김
    for (const [x, y, r] of [[1830, 1305, 7], [1845, 1318, 4]]) { const w = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshBasicMaterial({ color: '#7fd6cf' })); w.rotation.x = -Math.PI / 2; w.position.set(X(x), hgt(x, y) + .12, Z(y)); scene.add(w); steamSpots.push([X(x), hgt(x, y), Z(y), r]); }
    // 별빛 언덕: 유리 오두막과 모닥불
    { const x = 1052, y = 436, h = hgt(x, y); for (let k = 0; k < 4; k++) { const a = k / 4 * 6.283 + .5, gx = X(x + Math.cos(a) * 15), gz = Z(y + Math.sin(a) * 15); const d = new THREE.Mesh(new THREE.SphereGeometry(3.6, 16, 10, 0, 6.3, 0, 1.6), new THREE.MeshLambertMaterial({ color: '#cfe7f2', emissive: '#ffb860', emissiveIntensity: .35, transparent: true, opacity: .72 })); d.position.set(gx, h, gz); scene.add(d); addCol({ t: 'c', x: gx, z: gz, r: 3.6 }); }
      fireSpots.push([X(x), h, Z(y)]); }
    // 스키 리프트
    { const a = L.BASE, b = L.PEAK, n = 9, cable = []; for (let i = 0; i <= n; i++) { const t = i / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, h = hgt(x, y); const tower = new THREE.Mesh(new THREE.CylinderGeometry(.3, .4, 9, 6), new THREE.MeshLambertMaterial({ color: '#3a3f48' })); tower.position.set(X(x) + 3, h + 4.5, Z(y)); scene.add(tower); cable.push(new THREE.Vector3(X(x) + 3, h + 9, Z(y))); }
      const curve = new THREE.CatmullRomCurve3(cable); scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 80, .05, 4), new THREE.MeshBasicMaterial({ color: '#111' })));
      const chairs = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, .9, .8).translate(0, -1.2, 0), new THREE.MeshLambertMaterial({ color: '#c0392b' }), 24), mm = new THREE.Matrix4(); scene.add(chairs);
      anim.push(t => { for (let i = 0; i < 24; i++) { const u = ((t * .006 + i / 24) % 1), p = curve.getPointAt(u); mm.makeTranslation(p.x, p.y, p.z); chairs.setMatrixAt(i, mm); } chairs.instanceMatrix.needsUpdate = true; }); }
  }
  const steamSpots = [], fireSpots = [];
  function lightPointsLocal(arr, color, size) { const p = lightPoints(arr, color, size); scene.remove(p); p.frustumCulled = false; return p; }
  function buildStall(x, y, ang, color) {
    const g = new THREE.Group(); g.position.set(X(x), hgt(x, y), Z(y)); g.rotation.y = -ang; scene.add(g);
    g.add(new THREE.Mesh(merge([[new THREE.BoxGeometry(3.4, 2.4, 2.6).translate(0, 1.2, 0), '#7a4b2a'], [new THREE.BoxGeometry(3.0, 1.1, .05).translate(0, 1.45, 1.31), '#ffcf88'], [new THREE.BoxGeometry(3.6, .1, 3.0).translate(0, .95, .5), '#5a3825'], [new THREE.ConeGeometry(2.6, 1.3, 4).rotateY(.785).scale(1, 1, .8).translate(0, 3.05, 0), color], [new THREE.ConeGeometry(2.5, .5, 4).rotateY(.785).scale(1, 1, .8).translate(0, 3.45, 0), '#eef3f8']]), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#2a1606' })));
    for (let s = -1.7; s <= 1.7; s += .3) colorLights.push(X(x) + Math.cos(-ang) * s, hgt(x, y) + 2.4, Z(y) - Math.sin(-ang) * s);
    addCol({ t: 'b', x: X(x), z: Z(y), hw: 1.7, hd: 1.3, cs: Math.cos(ang), sn: Math.sin(ang) });
  }
  function buildFerris(x, y, r) {
    const cx = X(x), cz = Z(y), hy = r + 5, g = new THREE.Group(); g.position.set(cx, hy, cz); scene.add(g);
    const wheel = new THREE.Group(); g.add(wheel); const red = new THREE.MeshLambertMaterial({ color: '#c0392b' });
    wheel.add(new THREE.Mesh(new THREE.TorusGeometry(r, .35, 6, 64), red)); wheel.add(new THREE.Mesh(new THREE.TorusGeometry(r * .55, .2, 6, 48), red));
    const sp = []; for (let k = 0; k < 24; k++) { const a = k / 24 * 6.283; sp.push([new THREE.CylinderGeometry(.08, .08, r, 4).translate(0, r / 2, 0).applyMatrix4(new THREE.Matrix4().makeRotationZ(a)), '#d6d6d6']); } wheel.add(new THREE.Mesh(merge(sp), vcMat));
    const lp = []; for (let k = 0; k < 240; k++) { const a = k / 240 * 6.283; lp.push(Math.cos(a) * r, Math.sin(a) * r, 0); if (k % 2 === 0) lp.push(Math.cos(a) * r * .55, Math.sin(a) * r * .55, 0); } wheel.add(lightPointsLocal(lp, ['#ff7a6a', '#ffd27a', '#7fd0ff', '#9fe0b8'], .9));
    const gond = []; const gcol = ['#ffd27a', '#e0645c', '#7fc8e8', '#9fe0b8']; for (let k = 0; k < 24; k++) { const m = new THREE.Mesh(merge([[new THREE.BoxGeometry(2, 2, 2).translate(0, -1.4, 0), gcol[k % 4]], [new THREE.BoxGeometry(1.6, .8, 2.02).translate(0, -1.2, 0), '#ffe8b8']]), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#3a2410' })); g.add(m); gond.push(m); }
    for (const s of [-1, 1]) for (const q of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(.4, .5, hy * 1.08, 6), new THREE.MeshLambertMaterial({ color: '#7a2a24' })); leg.position.set(cx + q * r * .35, hy / 2, cz + s * 2.2); leg.rotation.z = q * .34; scene.add(leg); addCol({ t: 'c', x: cx + q * r * .7, z: cz + s * 2.2, r: .8 }); }
    anim.push((t, dt) => { wheel.rotation.z += dt * .05; gond.forEach((m, k) => { const a = wheel.rotation.z + k / 24 * 6.283; m.position.set(Math.cos(a) * r, Math.sin(a) * r, 0); }); });
  }
  function buildCoaster(pts2) {
    const cv = pts2.map(([x, y], i) => new THREE.Vector3(X(x), 0, Z(y))); cv.forEach((v, i) => { const t = i / cv.length; v.y = 4 + 8 * (.5 + .5 * Math.sin(t * 6.283 * 2 + .5)) + 4 * Math.max(0, Math.sin(t * 6.283)); });
    const curve = new THREE.CatmullRomCurve3(cv, true); scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 400, .35, 6, true), new THREE.MeshLambertMaterial({ color: '#c0392b' })));
    const sup = []; for (let i = 0; i < 70; i++) { const p = curve.getPointAt(i / 70); sup.push([new THREE.CylinderGeometry(.12, .15, p.y, 4).translate(p.x, p.y / 2, p.z), '#8a8f99']); } scene.add(new THREE.Mesh(merge(sup), vcMat));
    const lp = []; for (let i = 0; i < 500; i++) { const p = curve.getPointAt(i / 500); lp.push(p.x, p.y + .4, p.z); } lightPoints(lp, ['#ffd27a', '#ff7a6a'], .55);
    const cars = []; for (let k = 0; k < 5; k++) { const m = new THREE.Mesh(sleighGeo(), vcMat); m.scale.setScalar(.8); scene.add(m); cars.push(m); }
    anim.push(t => { const u0 = (t * .028) % 1; cars.forEach((m, k) => { const u = (u0 - k * .006 + 1) % 1, p = curve.getPointAt(u), q = curve.getPointAt((u + .002) % 1); m.position.copy(p).y += .4; m.lookAt(q.x, q.y + .4, q.z); m.rotateY(-Math.PI / 2); }); });
  }
  function buildSwing(x, y, r) { const g = new THREE.Group(); g.position.set(X(x), 0, Z(y)); scene.add(g); g.add(new THREE.Mesh(new THREE.CylinderGeometry(.5, .7, 13, 10).translate(0, 6.5, 0), new THREE.MeshLambertMaterial({ color: '#2e6f9e' })));
    const top = new THREE.Group(); top.position.y = 12.5; g.add(top); top.add(new THREE.Mesh(new THREE.CylinderGeometry(r * .7, r * .7, .6, 20), new THREE.MeshLambertMaterial({ color: '#e6b422', emissive: '#3a2a08' })));
    const seats = []; for (let k = 0; k < 16; k++) { const s = new THREE.Group(); s.rotation.y = k / 16 * 6.283; top.add(s); const arm = new THREE.Group(); arm.position.x = r * .68; s.add(arm); arm.add(new THREE.Mesh(merge([[new THREE.CylinderGeometry(.02, .02, 6, 3).translate(0, -3, 0), '#ccc'], [new THREE.BoxGeometry(.6, .15, .6).translate(0, -6, 0), '#c0392b']]), vcMat)); seats.push(arm); }
    const lp = []; for (let k = 0; k < 50; k++) { const a = k / 50 * 6.283; lp.push(Math.cos(a) * r * .7, .4, Math.sin(a) * r * .7); } top.add(lightPointsLocal(lp, ['#ffd27a', '#fff1c4'], .6));
    anim.push((t, dt) => { const sp = .8 + .4 * Math.sin(t * .15); top.rotation.y += dt * sp; seats.forEach(a => a.rotation.z = -.5 * sp); }); addCol({ t: 'c', x: X(x), z: Z(y), r: 1 }); }
  function buildTrain(pts2) { const cv = pts2.slice(0, -1).map(([x, y]) => new THREE.Vector3(X(x), .3, Z(y))), curve = new THREE.CatmullRomCurve3(cv, true, 'catmullrom', .05);
    const cars = []; const colors = ['#2e6f3e', '#c0392b', '#e6b422', '#2e6f9e']; for (let k = 0; k < 5; k++) { const m = new THREE.Mesh(merge(k === 0 ? [[new THREE.BoxGeometry(2.6, 1.4, 1.3).translate(0, .9, 0), '#1f3a2c'], [new THREE.CylinderGeometry(.25, .3, .9, 8).translate(.9, 2, 0), '#222']] : [[new THREE.BoxGeometry(2.2, .9, 1.2).translate(0, .65, 0), colors[k % 4]]]), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#1a1006' })); scene.add(m); cars.push(m); }
    anim.push(t => { const u0 = (t * .004) % 1; cars.forEach((m, k) => { const u = (u0 - k * .0035 + 1) % 1, p = curve.getPointAt(u), q = curve.getPointAt((u + .001) % 1); m.position.copy(p); m.lookAt(q); m.rotateY(-Math.PI / 2); }); }); }

  // ---------- 사람·산타·북극곰·순록 ----------
  const walkers = [];
  function buildPeople() {
    const COATS = ['#b23a34', '#2f5d8f', '#3f7a5a', '#d9a23a', '#6b4a8f', '#f1ece2', '#333c4a', '#c96a8a', '#8a5a3a'];
    const geos = COATS.map(personGeo), N = LQ ? 120 : MOBILE ? 220 : 420;
    const streets = O.roads.filter(r => (r.kind === 'street' || r.kind === 'fair') && r.pts.length > 1);
    const meshes = geos.map(g => { const m = new THREE.InstancedMesh(g, vcMat, Math.ceil(N / COATS.length) + 2); m.count = 0; m.frustumCulled = false; scene.add(m); return m; });
    for (let i = 0; i < N; i++) { const s = pick(streets), k = Math.floor(R() * (s.pts.length - 1)), mi = i % COATS.length; walkers.push({ pts: s.pts, seg: k, t: R(), dir: R() < .5 ? 1 : -1, lat: (R() - .5) * Math.max(.6, s.w - 1.2), sp: rr(.9, 1.4), mesh: meshes[mi], idx: meshes[mi].count++, ph: R() * 6 }); }
    // 호수 스케이터
    for (let i = 0; i < 18; i++) { const mi = i % COATS.length; walkers.push({ lake: true, a: R() * 6.28, rad: rr(.35, .8), sp: rr(.05, .09) * (R() < .2 ? -1 : 1), mesh: meshes[mi], idx: meshes[mi].count++, ph: R() * 6 }); }
    // 산타들
    const sg = santaGeo(), santas = new THREE.InstancedMesh(sg, vcMat, 12), m = new THREE.Matrix4(); santas.frustumCulled = false; scene.add(santas);
    const spots = [[L.PLAZA[0] - 12, L.PLAZA[1] + 8], [L.PLAZA[0] + 10, L.PLAZA[1] - 12], [520, 625], [560, 648], [590, 690], [480, 705], [455, 640], [600, 640], [1592, 812], [1720, 930], [1052, 450], [758, 790]];
    spots.forEach(([x, y], i) => { m.compose(new THREE.Vector3(X(x), floorAt(x, y), Z(y)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * 6, 0)), new THREE.Vector3(1.05, 1.05, 1.05)); santas.setMatrixAt(i, m); addCol({ t: 'c', x: X(x), z: Z(y), r: .4 }); });
    // 북극곰 주민
    const bears = new THREE.InstancedMesh(bearGeo(), vcMat, O.bears.length); bears.frustumCulled = false; scene.add(bears);
    const bearState = O.bears.map((b, i) => ({ x: X(b.x), z: Z(b.y), s: Math.max(.7, b.s) * 1.25, a: R() * 6, ph: R() * 6, roam: !b.name || /아기곰|형제|강사/.test(b.name) }));
    bearState.forEach(b => addCol({ t: 'c', x: b.x, z: b.z, r: .9 * b.s }));
    anim.push((t, dt) => { bearState.forEach((b, i) => { let x = b.x, z = b.z, a = b.a + Math.sin(t * .3 + b.ph) * .6; if (b.roam) { x += Math.cos(t * .2 + b.ph) * 3; z += Math.sin(t * .2 + b.ph) * 3; a = -(t * .2 + b.ph) - Math.PI; } m.compose(new THREE.Vector3(x, floorAt(x + 1200, z + 800) + Math.abs(Math.sin(t * 2 + b.ph)) * .04, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, 0)), new THREE.Vector3(b.s, b.s, b.s)); bears.setMatrixAt(i, m); }); bears.instanceMatrix.needsUpdate = true; });
    // 순록 (마구간 울타리 마당)
    const deer = new THREE.InstancedMesh(deerGeo(), vcMat, 8); deer.frustumCulled = false; scene.add(deer);
    const dState = Array.from({ length: 8 }, (_, i) => ({ x: X(440 + R() * 20), z: Z(702 + R() * 16), ph: R() * 6 }));
    anim.push(t => { dState.forEach((d, i) => { m.compose(new THREE.Vector3(d.x + Math.sin(t * .1 + d.ph) * 2, floorAt(d.x + 1200, d.z + 800), d.z + Math.cos(t * .12 + d.ph) * 1.5), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, t * .1 + d.ph, 0)), new THREE.Vector3(1.1, 1.1, 1.1)); deer.setMatrixAt(i, m); }); deer.instanceMatrix.needsUpdate = true; });
  }
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpV = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  function updatePeople(t, dt, cx, cz) {
    const dirty = new Set();
    for (const w of walkers) {
      let x, y, a;
      if (w.lake) { w.a += w.sp * dt * 6; x = L.LAKE.x + Math.cos(w.a) * L.LAKE.rx * w.rad; y = L.LAKE.y + Math.sin(w.a) * L.LAKE.ry * w.rad; a = -w.a - (w.sp > 0 ? 0 : Math.PI); tmpV.set(X(x), -.1, Z(y)); }
      else { const p = w.pts, A = p[w.seg], B = p[w.seg + 1], Lg = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1; w.t += w.dir * w.sp * dt / Lg;
        if (w.t > 1) { if (w.seg < p.length - 2) { w.seg++; w.t = 0; } else { w.t = 1; w.dir = -1; } } else if (w.t < 0) { if (w.seg > 0) { w.seg--; w.t = 1; } else { w.t = 0; w.dir = 1; } }
        const A2 = p[w.seg], B2 = p[w.seg + 1], ux = (B2[0] - A2[0]), uy = (B2[1] - A2[1]), l2 = Math.hypot(ux, uy) || 1; x = A2[0] + ux * w.t - uy / l2 * w.lat; y = A2[1] + uy * w.t + ux / l2 * w.lat; a = Math.atan2(ux * w.dir, uy * w.dir);
        tmpV.set(X(x), hgt(x, y) + .08 + Math.abs(Math.sin(t * 6 * w.sp + w.ph)) * .04, Z(y)); }
      tmpE.set(0, a, 0); tmpQ.setFromEuler(tmpE); tmpM.compose(tmpV, tmpQ, one); w.mesh.setMatrixAt(w.idx, tmpM); dirty.add(w.mesh);
    }
    dirty.forEach(m => m.instanceMatrix.needsUpdate = true);
  }

  // ---------- 자정: 산타들이 썰매를 타고 사방으로 ----------
  const sleighs = [], trail = { pos: new Float32Array(3 * 1500), life: new Float32Array(1500), i: 0 };
  let trailPts;
  function buildSleighs() {
    const sg = sleighGeo(), dg = deerGeo(), sant = santaGeo();
    const ra = L.RUNWAY.a, rb = L.RUNWAY.b, dirs = [[700, 120], [1300, 60], [2300, 120], [60, 80], [900, 0], [2000, 1500]];
    dirs.forEach(([fx, fy], k) => { const g = new THREE.Group(); g.add(new THREE.Mesh(sg, vcMat)); const s = new THREE.Mesh(sant, vcMat); s.position.set(-.2, .6, 0); s.scale.setScalar(.8); g.add(s); for (let i = 0; i < 4; i++) for (const q of [-1, 1]) { const d = new THREE.Mesh(dg, vcMat); d.position.set(2.2 + i * 1.6, 0, q * .5); d.scale.setScalar(.75); g.add(d); }
      g.visible = false; scene.add(g);
      const p0 = new THREE.Vector3(X(ra[0]), hgt(ra[0], ra[1]) + .2, Z(ra[1])), p1 = new THREE.Vector3(X(rb[0]), hgt(rb[0], rb[1]) + 3, Z(rb[1])), c = new THREE.Vector3(X(L.PLAZA[0]) + (k - 2.5) * 60, 140 + k * 12, Z(L.PLAZA[1]) - 60), far = new THREE.Vector3(X(fx), 420, Z(fy));
      sleighs.push({ g, curve: new THREE.CatmullRomCurve3([p0, p0.clone().lerp(p1, .5), p1, p1.clone().lerp(c, .4).setY(70), c, c.clone().lerp(far, .5).setY(300), far]), delay: k * 3.2 }); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(trail.pos, 3)); trail.pos.fill(-9999);
    trailPts = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffd27a', size: 2.2, map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true })); trailPts.frustumCulled = false; scene.add(trailPts);
  }
  function updateSleighs(clockMin, dt) {
    // 23:50 출발 준비 ~ 00:05 하늘로 사라짐 (게임 시각 분)
    const tm = clockMin - 23 * 60 - 50; // 0 = 23:50
    for (const s of sleighs) {
      const T = (tm - 10) * 4.5 - s.delay; // 자정(00:00)에 출발
      if (tm < 0 || tm > 40) { s.g.visible = false; continue; }
      s.g.visible = true; const u = Math.max(0, Math.min(1, T / 60)), uu = u < .15 ? u * u / .15 : u, p = s.curve.getPointAt(Math.min(.999, uu)), q = s.curve.getPointAt(Math.min(.9999, uu + .004));
      s.g.position.copy(p); s.g.lookAt(q); s.g.rotateY(-Math.PI / 2);
      if (u > .05 && u < .999) for (let k = 0; k < 3; k++) { const i = trail.i = (trail.i + 1) % 1500; trail.pos[i * 3] = p.x + rr(-.6, .6); trail.pos[i * 3 + 1] = p.y + rr(-.3, .5); trail.pos[i * 3 + 2] = p.z + rr(-.6, .6); trail.life[i] = 4; }
    }
    for (let i = 0; i < 1500; i++) if (trail.life[i] > 0) { trail.life[i] -= dt; trail.pos[i * 3 + 1] -= dt * .4; if (trail.life[i] <= 0) trail.pos[i * 3 + 1] = -9999; }
    trailPts.geometry.attributes.position.needsUpdate = true;
  }

  // ---------- 눈 ----------
  let snow;
  function buildSnow() { const N = LQ ? 2500 : MOBILE ? 5000 : 9000, p = new Float32Array(N * 3); for (let i = 0; i < N; i++) { p[i * 3] = rr(-60, 60); p[i * 3 + 1] = rr(0, 40); p[i * 3 + 2] = rr(-60, 60); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    snow = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: .22, map: glowTex, transparent: true, depthWrite: false, opacity: .9 })); snow.frustumCulled = false; scene.add(snow); }
  function updateSnow(dt, cx, cy, cz, k) { const p = snow.geometry.attributes.position.array; for (let i = 0; i < p.length; i += 3) { p[i + 1] -= dt * (1.1 + (i % 7) * .12) * (.6 + k); p[i] += Math.sin(p[i + 1] * .3 + i) * dt * .3; if (p[i + 1] < cy - 6) { p[i + 1] += 40; p[i] = cx + rr(-60, 60); p[i + 2] = cz + rr(-60, 60); } if (Math.abs(p[i] - cx) > 60) p[i] = cx + rr(-60, 60); if (Math.abs(p[i + 2] - cz) > 60) p[i + 2] = cz + rr(-60, 60); } snow.geometry.attributes.position.needsUpdate = true; }

  // ---------- 플레이어 ----------
  const player = { x: 0, z: 0, y: 0, vy: 0, face: 0, onGround: true };
  let pm; const cam = { yaw: .6, pitch: .22, dist: 7 };
  function buildPlayer() { pm = new THREE.Mesh(merge([[new THREE.CapsuleGeometry(.09, .62, 3, 6).translate(-.1, .42, 0), '#2a2d36'], [new THREE.CapsuleGeometry(.09, .62, 3, 6).translate(.1, .42, 0), '#2a2d36'], [new THREE.CylinderGeometry(.2, .27, .8, 10).translate(0, 1.13, 0), '#3a78c8'], [new THREE.CapsuleGeometry(.065, .5, 3, 6).translate(-.29, 1.12, 0), '#3a78c8'], [new THREE.CapsuleGeometry(.065, .5, 3, 6).translate(.29, 1.12, 0), '#3a78c8'], [new THREE.SphereGeometry(.14, 10, 8).translate(0, 1.64, 0), '#f1d2b6'], [new THREE.SphereGeometry(.15, 10, 6, 0, 6.3, 0, 1.6).translate(0, 1.67, 0), '#e07a3a'], [new THREE.SphereGeometry(.055, 6, 5).translate(0, 1.84, 0), '#fff'], [new THREE.TorusGeometry(.14, .055, 5, 10).rotateX(1.57).translate(0, 1.48, 0), '#c0392b'], [new THREE.BoxGeometry(.34, .42, .16).translate(0, 1.18, -.24), '#a0522d']]), vcMat); scene.add(pm);
    const st = L.pointAt(L.PATHS.forest.pts, .9); player.x = X(st[0]); player.z = Z(st[1]); player.face = Math.atan2(X(L.PLAZA[0]) - player.x, Z(L.PLAZA[1]) - player.z); cam.yaw = player.face + Math.PI; player.y = floorAt(st[0], st[1]); }
  function collide(nx, nz) {
    const r = .35, k0 = Math.floor(nx / GS), k1 = Math.floor(nz / GS);
    for (let i = k0 - 1; i <= k0 + 1; i++) for (let j = k1 - 1; j <= k1 + 1; j++) { const list = grid.get(i * 9973 + j); if (!list) continue; for (const c of list) {
      if (c.y1 !== undefined && player.y > c.y1) continue;
      if (c.t === 'c') { const dx = nx - c.x, dz = nz - c.z, d = Math.hypot(dx, dz); if (d < c.r + r && d > 1e-4) { nx = c.x + dx / d * (c.r + r); nz = c.z + dz / d * (c.r + r); } }
      else { const dx = nx - c.x, dz = nz - c.z, lx = dx * c.cs + dz * c.sn, lz = -dx * c.sn + dz * c.cs, ox = c.hw + r - Math.abs(lx), oz = c.hd + r - Math.abs(lz); if (ox > 0 && oz > 0) { let ax = lx, az = lz; if (ox < oz) ax = Math.sign(lx || 1) * (c.hw + r); else az = Math.sign(lz || 1) * (c.hd + r); nx = c.x + ax * c.cs - az * c.sn; nz = c.z + ax * c.sn + az * c.cs; } } } }
    const fx = nx + 1200, fy = nz + 800; if (hgt(fx, fy) < -.7 && !(L.lineD(fx, fy, PIER) < 3.8) && !(((fx - L.LAKE.x) / L.LAKE.rx) ** 2 + ((fy - L.LAKE.y) / L.LAKE.ry) ** 2 < 1)) return [player.x, player.z]; // 바다에는 못 들어감
    if (fx < -60 || fx > 2460 || fy < -60 || fy > 1660) return [player.x, player.z];
    return [nx, nz];
  }

  let camDist = 7;
  function insideSolid(x, z, y) { const list = grid.get(Math.floor(x / GS) * 9973 + Math.floor(z / GS)); if (!list) return false; for (const c of list) { if (c.t !== 'b') continue; if (c.y1 !== undefined && y > c.y1) continue; const dx = x - c.x, dz = z - c.z, lx = dx * c.cs + dz * c.sn, lz = -dx * c.sn + dz * c.cs; if (Math.abs(lx) < c.hw + .25 && Math.abs(lz) < c.hd + .25) return true; } return false; }
  // ---------- 조작 ----------
  const keys = {}; let running = false, touchMove = null, touchLook = null, drag = null;
  addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'KeyM') toggleMap(); if (e.code === 'Space') jump(); });
  addEventListener('keyup', e => { keys[e.code] = false; });
  const jump = () => { if (player.onGround) { player.vy = 5.2; player.onGround = false; } };
  canvas.addEventListener('pointerdown', e => { try { canvas.setPointerCapture(e.pointerId); } catch (err) {} if (e.pointerType === 'touch' && e.clientX < innerWidth * .45 && !touchMove) { touchMove = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0 }; const s = $('stick'); s.style.display = 'block'; s.style.left = e.clientX + 'px'; s.style.top = e.clientY + 'px'; } else drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointermove', e => { if (touchMove && e.pointerId === touchMove.id) { touchMove.dx = Math.max(-1, Math.min(1, (e.clientX - touchMove.x) / 50)); touchMove.dy = Math.max(-1, Math.min(1, (e.clientY - touchMove.y) / 50)); $('stick').firstElementChild.style.transform = `translate(${touchMove.dx * 30}px,${touchMove.dy * 30}px)`; } else if (drag && e.pointerId === drag.id) { const k = MOBILE ? .007 : .005; cam.yaw -= (e.clientX - drag.x) * k; cam.pitch = Math.max(-.2, Math.min(1.25, cam.pitch + (e.clientY - drag.y) * k * .8)); drag.x = e.clientX; drag.y = e.clientY; } });
  const up = e => { if (touchMove && e.pointerId === touchMove.id) { touchMove = null; $('stick').style.display = 'none'; } if (drag && e.pointerId === drag.id) drag = null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { cam.dist = Math.max(3, Math.min(40, cam.dist * Math.exp(e.deltaY * .001))); }, { passive: true });
  $('jumpBtn').onclick = jump; $('runBtn').onclick = () => { running = !running; $('runBtn').textContent = running ? '걷기' : '달리기'; };

  // ---------- 지도 ----------
  let mapBase = null;
  function drawMapBase() { const c = document.createElement('canvas'); c.width = 1200; c.height = 800; const x = c.getContext('2d'), k = .5;
    x.fillStyle = '#dfe7f1'; x.fillRect(0, 0, 1200, 800); x.fillStyle = '#9cc0e0'; x.beginPath(); L.SEA.forEach(([a, b], i) => i ? x.lineTo(a * k, b * k) : x.moveTo(a * k, b * k)); x.fill();
    x.fillStyle = '#5d7a6b'; for (const [a, b] of O.trees) x.fillRect(a * k, b * k, 1.4, 1.4);
    x.fillStyle = '#cfe2f2'; x.beginPath(); x.ellipse(L.LAKE.x * k, L.LAKE.y * k, L.LAKE.rx * k, L.LAKE.ry * k, 0, 0, 7); x.fill();
    x.lineCap = 'round'; x.lineJoin = 'round'; for (const r of O.roads) { x.strokeStyle = r.kind === 'street' ? '#ffffff' : '#f1e3c2'; x.lineWidth = Math.max(1, r.w * k); x.beginPath(); r.pts.forEach(([a, b], i) => i ? x.lineTo(a * k, b * k) : x.moveTo(a * k, b * k)); x.stroke(); }
    for (const b of O.buildings) { x.save(); x.translate(b.x * k, b.y * k); x.rotate(b.ang); x.fillStyle = b.fill; x.fillRect(-b.w * k / 2, -b.d * k / 2, b.w * k, b.d * k); x.restore(); }
    x.font = 'bold 13px system-ui'; x.textAlign = 'center'; x.fillStyle = '#1d2c45'; const seen = new Set(); for (const p of O.pois) { if (seen.has(p.group)) continue; seen.add(p.group); x.strokeStyle = '#fff'; x.lineWidth = 3; x.strokeText(p.group, p.x * k, p.y * k - 8); x.fillText(p.group, p.x * k, p.y * k - 8); }
    mapBase = c; }
  function toggleMap() { const m = $('map'); m.classList.toggle('open'); if (m.classList.contains('open')) drawMapNow(); }
  function drawMapNow() { if (!mapBase) drawMapBase(); const x = $('mapc').getContext('2d'); x.drawImage(mapBase, 0, 0); const px = (player.x + 1200) * .5, py = (player.z + 800) * .5; x.fillStyle = '#ff8a2a'; x.strokeStyle = '#fff'; x.lineWidth = 3; x.beginPath(); x.arc(px, py, 7, 0, 7); x.fill(); x.stroke(); x.beginPath(); x.moveTo(px + Math.sin(player.face) * 16, py + Math.cos(player.face) * 16); x.lineTo(px + Math.sin(player.face + 2.6) * 8, py + Math.cos(player.face + 2.6) * 8); x.lineTo(px + Math.sin(player.face - 2.6) * 8, py + Math.cos(player.face - 2.6) * 8); x.fill(); }
  $('mapBtn').onclick = toggleMap; $('map').onclick = toggleMap;

  // ---------- 소리 ----------
  const A = window.ISL.Audio; let sound = true;
  $('sndBtn').onclick = () => { sound = !sound; if (A) { A.on = sound; if (A.musicGain) A.musicGain.gain.value = sound ? .36 : 0; if (A.el) A.el.volume = sound ? .55 : 0; if (!sound && A.el) A.el.pause(); } $('sndBtn').textContent = sound ? '소리 켜짐' : '소리 꺼짐'; };

  // ---------- 하늘의 흐름: 16:00(푸른 저녁) → 04:00, 8분에 한 바퀴 ----------
  const CYCLE = 480; let gameT = 0;
  function skyState(p) { // p: 0..1
    const clockMin = (16 * 60 + p * 12 * 60) % (24 * 60);
    const evening = 1 - sstep(.05, .3, p) + sstep(.9, 1, p), aur = sstep(.25, .45, p) * (1 - sstep(.92, 1, p)), heavy = sstep(.7, .78, p) * (1 - sstep(.95, 1, p));
    return { clockMin, evening, aur, heavy };
  }

  // ---------- 시작 ----------
  let started = false, last = performance.now(), stepT = 0, whereT = 0;
  async function boot() {
    setLoad(.05, '땅을 고르는 중…'); await frame(); buildGround();
    setLoad(.2, '길을 까는 중…'); await frame(); buildRoads();
    setLoad(.35, '집 ' + O.buildings.length + '채를 짓는 중…'); await frame(); buildBuildings();
    setLoad(.55, '나무를 심는 중…'); await frame(); buildTrees(); buildLamps();
    setLoad(.7, '광장과 놀이공원을 세우는 중…'); await frame(); buildSpecials();
    setLoad(.82, '주민들을 부르는 중…'); await frame(); buildPeople(); buildSleighs(); buildSnow(); buildPlayer();
    lightPoints(warmLights, ['#ffd27a', '#ffe2a8', '#ffc477'], .42); lightPoints(colorLights, ['#ff6a5a', '#ffd27a', '#7fd0ff', '#9fe0b8', '#fff1c4', '#ff9ad0'], .42);
    // 모닥불 빛
    for (const [x, y, z] of fireSpots) { const f = new THREE.Mesh(new THREE.ConeGeometry(.7, 1.6, 8), new THREE.MeshBasicMaterial({ color: '#ffb347' })); f.position.set(x, y + .8, z); scene.add(f); const gl = new THREE.Mesh(new THREE.PlaneGeometry(16, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex, color: '#ff9a4a', transparent: true, opacity: .45, depthWrite: false, blending: THREE.AdditiveBlending })); gl.position.set(x, y + .1, z); scene.add(gl); anim.push(t => { f.scale.y = .8 + Math.sin(t * 9) * .15 + Math.sin(t * 13) * .1; }); }
    setLoad(1, '준비 완료'); await frame();
    $('load').classList.add('done'); $('title').classList.add('open');
    renderer.compile(scene, camera); loop();
  }
  $('start').onclick = () => { $('title').classList.remove('open'); document.body.classList.add('play'); started = true; if (A) { try { A.init(); A.setMusic('iceland'); } catch (e) {} } if (MOBILE && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); };

  // ---------- 매 프레임 ----------
  const camTarget = new THREE.Vector3();
  function loop() {
    requestAnimationFrame(loop);
    const now = performance.now(), dt = Math.min(.05, (now - last) / 1000); last = now; gameT += dt;
    const p = (gameT / CYCLE + .02) % 1, S = skyState(p);
    // 하늘 색
    const top = C('#06102a').lerp(C('#14306a'), S.evening), hor = C('#16224a').lerp(C('#5a6fae'), S.evening); skyU.uTop.value.copy(top); skyU.uHor.value.copy(hor); skyU.uAur.value = S.aur; skyU.uTime.value = gameT;
    scene.fog.color.copy(hor).lerp(C('#0d1630'), .35); scene.fog.density = .0022 + S.heavy * .0022; hemi.intensity = 1.05 + S.evening * .55;
    const pScale = innerHeight * renderer.getPixelRatio() / (2 * Math.tan(camera.fov * Math.PI / 360)); lightMats.forEach(m => { m.uniforms.uTime.value = gameT; m.uniforms.uScale.value = pScale; });
    // 시계
    const hh = Math.floor(S.clockMin / 60) % 24, mm = Math.floor(S.clockMin % 60); $('clock').textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    updateSleighs(S.clockMin < 12 * 60 ? S.clockMin + 24 * 60 : S.clockMin, dt);
    if (A && A.update && started) { try { A.update(dt, { sea: 0, river: 0, fall: 0, wind: .25 + S.heavy * .5, fire: 0, night: 0, land: 1, day: 0, cows: 0 }); if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); } catch (e) {} }
    // 플레이어 이동
    if (started) {
      let mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0), mz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
      if (touchMove) { mx = touchMove.dx; mz = touchMove.dy; }
      const len = Math.hypot(mx, mz);
      if (len > .1) { const sp = (keys.ShiftLeft || keys.ShiftRight || running ? 8.5 : 3.6) * Math.min(1, len), s = Math.sin(cam.yaw), c = Math.cos(cam.yaw), dx = (mx * c + mz * s) / Math.max(1, len), dz = (-mx * s + mz * c) / Math.max(1, len);
        const [nx, nz] = collide(player.x + dx * sp * dt, player.z + dz * sp * dt); player.x = nx; player.z = nz; player.face = Math.atan2(dx, dz); stepT += dt * sp; if (stepT > 1.6 && player.onGround) { stepT = 0; if (A && A.step) try { A.step('snow'); } catch (e) {} } }
      const gy = floorAt(player.x + 1200, player.z + 800); player.vy -= 14 * dt; player.y += player.vy * dt; if (player.y <= gy) { player.y = gy; player.vy = 0; player.onGround = true; }
      pm.position.set(player.x, player.y, player.z); pm.rotation.y = player.face + (len > .1 ? Math.sin(gameT * 9) * .03 : 0);
      camTarget.set(player.x, player.y + 1.5, player.z);
      // 카메라가 건물 속으로 들어가지 않게: 플레이어에서 카메라 쪽으로 가며 벽을 만나면 그 앞에서 멈춤
      let cd = cam.dist; { const dx = Math.sin(cam.yaw) * Math.cos(cam.pitch), dz = Math.cos(cam.yaw) * Math.cos(cam.pitch), dy = Math.sin(cam.pitch);
        for (let d = 1; d <= cam.dist; d += .5) { const x = player.x + dx * d, z = player.z + dz * d, y = player.y + 1.6 + dy * d; if (insideSolid(x, z, y)) { cd = Math.max(1.2, d - .6); break; } } }
      camDist += (cd - camDist) * Math.min(1, dt * (cd < camDist ? 12 : 3));
      let cx = player.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * camDist, cz = player.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * camDist, cy = player.y + 1.6 + Math.sin(cam.pitch) * camDist; cy = Math.max(cy, floorAt(cx + 1200, cz + 800) + .5);
      camera.position.set(cx, cy, cz); camera.lookAt(camTarget);
      if ((whereT -= dt) < 0) { whereT = 1; let best = null, bd = 140; for (const q of O.pois) { const d = Math.hypot(X(q.x) - player.x, Z(q.y) - player.z); if (d < bd) { bd = d; best = q.group; } } $('where').textContent = best || '눈의 마을'; }
      if ($('map').classList.contains('open')) drawMapNow();
    } else { const t = gameT * .03, P = L.PLAZA; camera.position.set(X(P[0]) + Math.sin(t) * 160, 70 + Math.sin(t * .7) * 10, Z(P[1]) + Math.cos(t) * 160); camera.lookAt(X(P[0]), 8, Z(P[1])); }
    updatePeople(gameT, dt, camera.position.x, camera.position.z);
    anim.forEach(f => f(gameT, dt));
    updateSnow(dt, camera.position.x, camera.position.y, camera.position.z, S.heavy);
    // 먼 나무 묶음 숨기기
    for (const t of treeTiles) t.im.visible = Math.hypot(t.x - camera.position.x, t.z - camera.position.z) < (MOBILE ? 520 : 760);
    renderer.render(scene, camera);
  }
  window.SNOW = { sleighs, player, cam, L, setT: t => { gameT = t * CYCLE; }, start: () => $('start').onclick(), renderer, scene, camera };
  boot();
})();
