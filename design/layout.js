// 눈의 마을 배치: 설계도(SVG)와 3D 게임이 같은 배치를 쓰도록 한 곳에서 만든다. 단위 m, x 동쪽, y 남쪽.
(function () {
  window.SnowLayout = function (svg) {
  const NS = 'http://www.w3.org/2000/svg';
  const OUT = { roads: [], buildings: [], trees: [], firs: [], lamps: [], bears: [], pois: [], specials: [], stalls: [], arches: [], snowmen: [] };
  const D = { setAttribute() {}, appendChild() {}, insertBefore() {}, classList: { toggle() {} }, set textContent(v) {} }; D.parentNode = D; D.lastChild = D;
  const el = (t, a, p) => {
    if (t === 'circle' && a.cx !== undefined) { if (a.fill === '#ffb347') OUT.lamps.push([+a.cx, +a.cy]); else if (a.fill === '#6f8c7d' || a.fill === '#5d7a6b') OUT.trees.push([+a.cx, +a.cy, +a.r]); else if (a.fill === '#fff' && +a.r === .9) OUT.snowmen.push([+a.cx, +a.cy]); }
    if (!svg) return D; const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); (p || svg).appendChild(e); return e; };
  const g = (cls) => el('g', cls ? { class: cls } : {});
  const path = pts => 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L');
  let seed = 20241224; const R = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const rr = (a, b) => a + R() * (b - a);
  const segD = (x, y, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l)) : 0; return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t); };
  const lineD = (x, y, pts) => { let m = 1e9; for (let i = 0; i < pts.length - 1; i++) m = Math.min(m, segD(x, y, pts[i], pts[i + 1])); return m; };
  const offset = (pts, d) => pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [p[0] - dy / l * d, p[1] + dx / l * d]; });
  const along = (pts, step, fn) => { let carry = 0; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L; for (let s = carry; s < L; s += step) fn(a[0] + ux * s, a[1] + uy * s, ux, uy); carry = (carry - L) % step; if (carry < 0) carry += step; } };
  const pointAt = (pts, f) => { let tot = 0; const ls = []; for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); ls.push(l); tot += l; } let t = f * tot; for (let i = 0; i < ls.length; i++) { if (t <= ls[i]) { const a = pts[i], b = pts[i + 1], u = t / ls[i]; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, Math.atan2(b[1] - a[1], b[0] - a[0])]; } t -= ls[i]; } const a = pts[pts.length - 2], b = pts[pts.length - 1]; return [b[0], b[1], Math.atan2(b[1] - a[1], b[0] - a[0])]; };

  // ---------- 지형 데이터 (단위: m, 위가 북쪽) ----------
  const PLAZA = [1180, 820];
  const SEA = [[1180, 1600], [1330, 1530], [1520, 1450], [1700, 1380], [1860, 1345], [2000, 1320], [2150, 1300], [2290, 1265], [2400, 1240], [2400, 1600]];
  const LAKE = { x: 1180, y: 1065, rx: 75, ry: 35 };
  const CANAL = [[-500, -500], [-499, -500]]; // (운하 동네는 없앰)
  const FAIR = { x: 1720, y: 955 };
  const FAIRPOLY = [[1484, 806], [1946, 794], [1962, 1112], [1486, 1124]];
  const inPoly = (P, x, y) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > y) !== (P[j][1] > y) && x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; };
  const STREAM = [[610, 520], [640, 660], [672, 800], [696, 930], [712, 1012], [770, 1078], [900, 1104], [1050, 1088], [1106, 1070]];
  const ST = {
    alley: { name: '등불 골목', w: 4, pts: [[1150, 826], [1100, 846], [1040, 853], [985, 872], [925, 874], [865, 862], [812, 842], [782, 806]] },
    market: { name: '빛의 대로', w: 14, pts: [[1210, 816], [1290, 799], [1380, 789], [1470, 781], [1560, 772]] },
    skiroad: { name: '스키장 길', w: 6, pts: [[1560, 772], [1650, 763], [1760, 760], [1880, 768], [1950, 772]] },
    fairway: { name: '놀이공원 길', w: 6, pts: [[1560, 772], [1588, 796]] },
    entry: { name: '다리 길', w: 6, pts: [[712, 1012], [800, 974], [900, 935], [1000, 902], [1085, 864], [1150, 834]] },
    lake: { name: '호숫길', w: 6, pts: [[1180, 851], [1180, 935], [1180, 1022]] },
    santa: { name: '산타 마을 길', w: 5, pts: [[782, 806], [720, 770], [650, 718], [590, 672]] },
    harbor: { name: '부둣길', w: 7, pts: [[1470, 781], [1462, 860], [1460, 960], [1462, 1060], [1474, 1140], [1560, 1168], [1690, 1190], [1780, 1232], [1870, 1262]] },
    fairsouth: { name: '놀이공원 남문 길', w: 5, pts: [[1724, 1124], [1730, 1190]] },
    lane1: { name: '윗골목', w: 3.5, pts: [[1128, 806], [1066, 796], [1004, 806], [944, 824], [884, 826], [838, 818]] },
    lane2: { name: '빵집 골목', w: 3.5, pts: [[1100, 846], [1080, 890], [1046, 926], [998, 948], [950, 958]] },
    lane3: { name: '계단 골목', w: 3, pts: [[1040, 853], [1036, 826], [1028, 800], [1012, 768], [990, 744]] },
    lane4: { name: '우물 골목', w: 3, pts: [[925, 874], [930, 912], [950, 956]] },
    lane5: { name: '언덕 골목', w: 3, pts: [[865, 862], [870, 826], [884, 826]] },
    hb2: { name: '항구 뒷골목', w: 3.5, pts: [[1650, 1150], [1730, 1146], [1810, 1170], [1860, 1200]] },
    bk1: { name: '대로 뒷골목 북', w: 3.5, pts: [[1290, 770], [1380, 758], [1470, 750], [1530, 744]] },
    bk2: { name: '대로 뒷골목 남', w: 3.5, pts: [[1300, 832], [1390, 824], [1440, 822]] },
    cross1: { name: '종 골목', w: 3.5, pts: [[1380, 789], [1384, 758]] },
    cross2: { name: '장갑 골목', w: 3.5, pts: [[1390, 824], [1386, 796]] },
    shore: { name: '해안 산책로', w: 3, pts: [[1870, 1262], [1960, 1278], [2050, 1268], [2140, 1250], [2260, 1235]] },
  };
  const PATHS = {
    forest: { name: '숲속 등불길', w: 2.6, pts: [[90, 1530], [170, 1470], [250, 1420], [330, 1370], [420, 1310], [500, 1240], [570, 1170], [630, 1100], [690, 1040], [712, 1012]] },
    star: { name: '별빛 언덕 숲길', w: 2.6, pts: [[1180, 790], [1150, 730], [1196, 676], [1124, 622], [1162, 566], [1086, 520], [1104, 468], [1052, 436]] },
    lakering: { name: '호수 산책로', w: 2.4, pts: Array.from({ length: 49 }, (_, i) => [LAKE.x + Math.cos(i / 48 * 6.283) * (LAKE.rx + 9), LAKE.y + Math.sin(i / 48 * 6.283) * (LAKE.ry + 9)]) },
    chapel: { name: '예배당 오르막', w: 2.4, pts: [[1262, 1050], [1300, 1028], [1330, 1006]] },
    cabin: { name: '오두막 오솔길', w: 2, pts: [[782, 806], [770, 790], [758, 776]] },
  };
  const SLED = [[590, 672], [500, 730], [400, 810], [310, 930], [262, 1060], [300, 1170], [410, 1215], [520, 1150], [600, 1030], [656, 900], [640, 780], [590, 672]];
  const RUNWAY = { a: [478, 560], b: [624, 396], w: 14 };
  const PEAK = [2062, 318], BASE = [1960, 752];
  const RUNS = [
    { name: '완만한 슬로프', w: 30, pts: [[2062, 330], [2000, 420], [1940, 520], [1900, 620], [1930, 700], [1955, 742]] },
    { name: '보통 슬로프', w: 24, pts: [[2066, 330], [2080, 440], [2050, 560], [2010, 660], [1970, 740]] },
    { name: '숲길 슬로프', w: 16, pts: [[2072, 334], [2150, 430], [2170, 540], [2120, 640], [2050, 710], [1985, 748]] },
  ];

  // ---------- 바탕 ----------
  el('rect', { x: -200, y: -200, width: 2800, height: 2000, fill: '#dfe7f1' });
  const gGrid = g();
  for (let x = 0; x <= 2400; x += 100) el('line', { x1: x, y1: 0, x2: x, y2: 1600, stroke: '#c7d3e1', 'stroke-width': x % 500 ? .6 : 1.2 }, gGrid);
  for (let y = 0; y <= 1600; y += 100) el('line', { x1: 0, y1: y, x2: 2400, y2: y, stroke: '#c7d3e1', 'stroke-width': y % 500 ? .6 : 1.2 }, gGrid);
  for (let x = 0; x <= 2400; x += 500) el('text', { x: x + 6, y: 18, 'font-size': 13, fill: '#8a9ab0' }, gGrid).textContent = x + 'm';
  for (let y = 500; y <= 1500; y += 500) el('text', { x: 6, y: y - 6, 'font-size': 13, fill: '#8a9ab0' }, gGrid).textContent = y + 'm';

  // 등고선 (광장 = 0m)
  const gC = g();
  const contour = (cx, cy, rx, ry, h, rot, lx) => { const pts = []; for (let i = 0; i <= 64; i++) { const a = i / 64 * 6.283, w = 1 + .07 * Math.sin(a * 3 + cx) + .05 * Math.sin(a * 5 + cy); pts.push([cx + Math.cos(a) * rx * w, cy + Math.sin(a) * ry * w]); } el('path', { d: path(pts) + 'Z', fill: 'none', stroke: '#8da3bd', 'stroke-width': h % 30 ? .6 : 1.1, opacity: .75, transform: `rotate(${rot || 0} ${cx} ${cy})` }, gC); if (lx !== false) el('text', { x: cx + rx * .72, y: cy - ry * .72, 'font-size': 10, fill: '#7186a1', class: 'det' }, gC).textContent = '+' + h; };
  [[60, 300, 210], [30, 200, 140], [60, 130, 95], [90, 70, 50]].forEach(([h, rx, ry], i) => contour(1060, 440, rx * .9, ry * .8, [20, 40, 60, 90][i], -12));
  [[40, 420, 520], [80, 320, 420], [120, 230, 320], [160, 140, 210], [180, 70, 100]].forEach(([h, rx, ry]) => contour(2075, 290, rx, ry, h, 18));
  [[10, 70, 50], [20, 40, 30]].forEach(([h, rx, ry]) => contour(1330, 1000, rx, ry, h, 0));
  [[10, 180, 140], [20, 120, 90], [30, 60, 45]].forEach(([h, rx, ry]) => contour(520, 560, rx, ry, h, 25));
  for (let k = 0; k < 6; k++) { const y0 = 260 - k * 42, pts = []; for (let x = -10; x <= 1720; x += 40) pts.push([x, y0 + Math.sin(x * .006 + k) * 22 + Math.sin(x * .017) * 9]); el('path', { d: path(pts), fill: 'none', stroke: '#8da3bd', 'stroke-width': k % 3 === 2 ? 1.1 : .6, opacity: .7 }, gC); el('text', { x: 300 + k * 160, y: y0 - 4, 'font-size': 10, fill: '#7186a1', class: 'det' }, gC).textContent = '+' + (40 + k * 30); }

  // 물
  const gW = g();
  el('path', { d: path(SEA) + 'Z', fill: '#9cc0e0' }, gW);
  el('path', { d: path(SEA.slice(0, 9)), fill: 'none', stroke: '#eef5fb', 'stroke-width': 5, opacity: .9 }, gW);
  for (let i = 0; i < 70; i++) { const x = rr(1900, 2380), y = rr(1300, 1590); if (y < 1240 + (2400 - x) * .25 + 70) continue; const s = rr(4, 16), pts = []; for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283 + rr(-.3, .3); pts.push([x + Math.cos(a) * s * rr(.6, 1.1), y + Math.sin(a) * s * rr(.5, .9)]); } el('path', { d: path(pts) + 'Z', fill: '#f4f8fc', stroke: '#c3d6ea', 'stroke-width': .6 }, gW); }
  el('path', { d: path(STREAM), fill: 'none', stroke: '#9cc0e0', 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, gW);
  el('ellipse', { cx: LAKE.x, cy: LAKE.y, rx: LAKE.rx + 2, ry: LAKE.ry + 2, fill: '#8c96a3' }, gW);
  el('ellipse', { cx: LAKE.x, cy: LAKE.y, rx: LAKE.rx, ry: LAKE.ry, fill: '#cfe2f2' }, gW);
  el('ellipse', { cx: LAKE.x, cy: LAKE.y, rx: LAKE.rx - 8, ry: LAKE.ry - 6, fill: 'none', stroke: '#ffb347', 'stroke-width': 1.2, 'stroke-dasharray': '1.5 3' }, gW);
  el('ellipse', { cx: LAKE.x, cy: LAKE.y, rx: LAKE.rx - 22, ry: LAKE.ry - 14, fill: 'none', stroke: '#b5cbe0', 'stroke-width': .8 }, gW);

  // 스키장
  const gS = g();
  RUNS.forEach(r => { el('path', { d: path(r.pts), fill: 'none', stroke: '#c5d3e3', 'stroke-width': r.w + 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, gS); el('path', { d: path(r.pts), fill: 'none', stroke: '#ffffff', 'stroke-width': r.w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, gS); along(r.pts, 24, (x, y, ux, uy) => { for (const s of [-1, 1]) el('circle', { cx: x - uy * s * (r.w / 2 + 2), cy: y + ux * s * (r.w / 2 + 2), r: 1, fill: '#ffb347' }, gS); }); });

  // 숲 (나무 한 그루 = 점 하나, 실제 수관 지름 4~7m)
  const gT = g(), avoidLines = [PATHS.forest.pts, SLED, STREAM, ST.santa.pts, ST.entry.pts, PATHS.star.pts, ...RUNS.map(r => r.pts)];
  const nearLine = (x, y, d) => avoidLines.some(L => lineD(x, y, L) < d);
  const treeAt = (x, y, s, snowy) => { el('circle', { cx: x, cy: y, r: s, fill: snowy ? '#6f8c7d' : '#5d7a6b' }, gT); el('circle', { cx: x - s * .3, cy: y - s * .3, r: s * .45, fill: '#eef3f6', opacity: .8 }, gT); };
  for (let i = 0; i < 2600; i++) { const x = rr(0, 760), y = rr(380, 1600); if (y > 1540 && x < 140) continue; if (x > 420 && x < 660 && y > 380 && y < 720) continue; if (Math.hypot(x - 760, y - 790) < 50) continue; if (nearLine(x, y, 7)) continue; if (x > 600 && y < 600) continue; treeAt(x, y, rr(2, 3.5), 1); }
  for (let i = 0; i < 900; i++) { const x = rr(0, 1780), y = rr(0, 330); if (Math.hypot(x - 1060, y - 440) < 80) continue; if (nearLine(x, y, 6)) continue; if (R() < .45) continue; treeAt(x, y, rr(2, 3.2), 1); }
  for (let i = 0; i < 520; i++) { const a = R() * 6.283, d = rr(70, 260), x = 1060 + Math.cos(a) * d * 1.15, y = 440 + Math.sin(a) * d * .7; if (y > 700 || (y > 552 && x > 1150) || nearLine(x, y, 6) || Math.hypot(x - PLAZA[0], y - PLAZA[1]) < 120) continue; treeAt(x, y, rr(2, 3.2), 1); }
  for (let i = 0; i < 700; i++) { const x = rr(1820, 2400), y = rr(120, 760); if (Math.hypot(x - PEAK[0], y - PEAK[1]) < 60) continue; if (nearLine(x, y, 4)) continue; if (lineD(x, y, [PEAK, BASE]) < 8) continue; treeAt(x, y, rr(2, 3), 1); }

  // ---- 사람 사는 동네: 구역마다 굽은 골목망을 깔고 길 양쪽에 집을 붙인다 ----
  const HOODS = [];
  const okArea = (x, y) => !inPoly(FAIRPOLY, x, y) && Math.hypot(x - PLAZA[0], y - PLAZA[1]) > 48 && ((x - LAKE.x) / (LAKE.rx + 20)) ** 2 + ((y - LAKE.y) / (LAKE.ry + 20)) ** 2 > 1 && Math.hypot(x - 1330, y - 1003) > 32 && lineD(x, y, STREAM) > 8;
  const hood = (id, name, poly, ang, dv, du, wv, wu, roof, depth) => {
    let cx = 0, cy = 0; poly.forEach(q => { cx += q[0]; cy += q[1]; }); cx /= poly.length; cy /= poly.length; let R = 0; poly.forEach(q => R = Math.max(R, Math.hypot(q[0] - cx, q[1] - cy)));
    const ca = Math.cos(ang), sa = Math.sin(ang), W = (u, v) => [cx + u * ca - v * sa, cy + u * sa + v * ca], keys = [];
    const trace = (fixed, along, w, wav, k) => { let seg = []; const flush = () => { if (seg.length > 1) { let L = 0; for (let i = 1; i < seg.length; i++) L += Math.hypot(seg[i][0] - seg[i - 1][0], seg[i][1] - seg[i - 1][1]); if (L > 28) { const key = id + k + '_' + keys.length; ST[key] = { name, w, pts: seg.filter((_, i) => i % 3 === 0 || i === seg.length - 1) }; keys.push(key); } } seg = []; };
      for (let t = -R; t <= R; t += 4) { const off = fixed + Math.sin(t * .013 + fixed * .07) * wav; const [x, y] = along ? W(t, off) : W(off, t); if (inPoly(poly, x, y) && okArea(x, y)) seg.push([x, y]); else flush(); } flush(); };
    for (let v = -R + dv / 2; v < R; v += dv) trace(v, true, wv, 13, 'v');
    for (let u = -R + du / 2; u < R; u += du) trace(u, false, wu, 7, 'u');
    HOODS.push({ id, name, keys, roof, depth: depth || 9, cx, cy, lab: LABS[id] }); };
  const LABS = { lake: [1180, 1250], west: [900, 975], hill: [1470, 600], ski: [1770, 600], harb: [1600, 1300] };
  hood('hill', '언덕 동네', [[1222, 560], [1730, 556], [1730, 732], [1222, 740]], -.06, 58, 64, 4.5, 3.5, 'hill');
  hood('lake', '호숫가 동네', [[880, 1010], [1100, 990], [1260, 955], [1440, 960], [1440, 1260], [1150, 1290], [920, 1210]], .08, 52, 60, 4.5, 3.5, 'lakeside');
  hood('west', '다리목 동네', [[770, 900], [900, 880], [1090, 920], [1060, 990], [870, 1010], [760, 1040]], -.3, 46, 58, 4, 3.5, 'alley', 8.5);
  hood('ski', '산자락 마을', [[1640, 580], [1900, 590], [1900, 742], [1640, 742]], .02, 44, 50, 4, 3.5, 'chalet', 10);
  hood('harb', '항구 마을', [[1490, 1180], [1760, 1170], [1860, 1250], [1700, 1300], [1500, 1290]], .35, 40, 52, 4, 3.5, 'harbor');

  // 길
  const gR = g();
  const road = (s, casing, fill) => { OUT.roads.push({ pts: s.pts, w: s.w, kind: fill === '#f1e3c2' ? 'path' : 'street', name: s.name }); el('path', { d: path(s.pts), fill: 'none', stroke: casing, 'stroke-width': s.w + 1.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, gR); el('path', { d: path(s.pts), fill: 'none', stroke: fill, 'stroke-width': s.w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, gR); };
  el('path', { d: path(SLED) + 'Z', fill: 'none', stroke: '#d9822b', 'stroke-width': 2.2, 'stroke-dasharray': '7 5' }, gR);
  Object.values(PATHS).forEach(s => road(s, '#d8c8a4', '#f1e3c2'));
  Object.values(ST).forEach(s => road(s, '#9eacbf', '#f6f8fb'));
  // 중앙선이 있는 큰길: 마켓 거리
  el('path', { d: path(ST.market.pts), fill: 'none', stroke: '#c9d3df', 'stroke-width': .5, 'stroke-dasharray': '3 3' }, gR);

  // 활주로
  const gRw = g(); { const { a, b, w } = RUNWAY, ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI, L = Math.hypot(b[0] - a[0], b[1] - a[1]); el('rect', { x: a[0], y: a[1] - w / 2, width: L, height: w, fill: '#f6f8fb', stroke: '#9eacbf', 'stroke-width': .8, transform: `rotate(${ang} ${a[0]} ${a[1]})` }, gRw); el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: '#d6dde6', 'stroke-width': .6, 'stroke-dasharray': '6 4' }, gRw); along([a, b], 12, (x, y, ux, uy) => { for (const s of [-1, 1]) el('circle', { cx: x - uy * s * (w / 2 + 1.5), cy: y + ux * s * (w / 2 + 1.5), r: 1.1, fill: '#ffb347' }, gRw); }); }

  // ---------- 건물 ----------
  const placed = [], gB = g(), gL = g();
  const blocked = (x, y, r) => { if (inPoly(FAIRPOLY, x, y)) return true; if (Math.hypot(x - PLAZA[0], y - PLAZA[1]) < 31 + r) return true; for (const p of placed) if (Math.hypot(x - p.x, y - p.y) < (p.r + r) * .82) return true; if (lineD(x, y, CANAL) < 3 + r * .7) return true; if (lineD(x, y, STREAM) < 2 + r * .7) return true; if (((x - LAKE.x) / (LAKE.rx + 14)) ** 2 + ((y - LAKE.y) / (LAKE.ry + 14)) ** 2 < 1) return true; for (const s of [...Object.values(ST), ...Object.values(PATHS)]) if (lineD(x, y, s.pts) < s.w / 2 + r * .62) return true; return false; };
  const building = (x, y, w, d, ang, fill, opt = {}) => {
    const r = Math.hypot(w, d) / 2; if (!opt.force && blocked(x, y, r)) return null; placed.push({ x, y, r }); OUT.buildings.push({ x, y, w, d, ang, fill, ridge: opt.ridge !== false, chimney: !!opt.chimney, kind: opt.kind || '' });
    const tr = `rotate(${ang * 180 / Math.PI} ${x} ${y})`;
    el('rect', { x: x - w / 2, y: y - d / 2, width: w, height: d, fill, stroke: '#33435a', 'stroke-width': .45, transform: tr }, gB);
    if (opt.ridge !== false) { const long = w >= d; el('line', long ? { x1: x - w / 2 + Math.min(w, d) * .5, y1: y, x2: x + w / 2 - Math.min(w, d) * .5, y2: y } : { x1: x, y1: y - d / 2 + w * .5, x2: x, y2: y + d / 2 - w * .5 }, gB).setAttribute('stroke', 'rgba(30,40,58,.45)'), gB.lastChild.setAttribute('stroke-width', '.4'), gB.lastChild.setAttribute('transform', tr); }
    if (opt.chimney) el('rect', { x: x + w * .22 - .5, y: y - d * .18 - .5, width: 1, height: 1, fill: '#7b5b4a', transform: tr }, gB);
    return { x, y };
  };
  const ROOF = { hill: ['#7a4b3a', '#5b6676', '#8a5a44', '#6e4637', '#9a6b4e'], lakeside: ['#c0392b', '#2e6f9e', '#e6b422', '#3e7c5a', '#f4f1ea', '#8e5aa8', '#d9733a'], chalet: ['#6b4226', '#5a3825', '#7a4b2a'], avenue: ['#5b6676', '#6a5048', '#4f5a6a', '#7a5a4a'], alley: ['#7a4b3a', '#8a5a44', '#6e4637', '#93624a'], market: ['#b23a2e', '#c4473a', '#9e3328'], canal: ['#e6a49a', '#efd38a', '#a9cbe6', '#f0b98c', '#c9e0b8'], harbor: ['#c0392b', '#2e6f9e', '#e6b422', '#3e7c5a', '#8e5aa8', '#d9733a'], entry: ['#7a4b3a', '#6e4637'], lake: ['#8a5a44', '#7a4b3a'] };
  const pick = a => a[Math.floor(R() * a.length)];
  const rowsAlong = (pts, o) => {
    const out = [];
    for (const side of o.sides || [-1, 1]) {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, nx = -uy * side, ny = ux * side, ang = Math.atan2(uy, ux);
        let s = o.start || 1.5;
        while (s < L - 2) { const w = rr(o.minW, o.maxW); if (s + w > L) break; const c = s + w / 2, off = o.half + o.set + o.depth / 2, x = a[0] + ux * c + nx * off, y = a[1] + uy * c + ny * off; const b2 = building(x, y, w, o.depth, ang, pick(o.roof), { chimney: R() < .5 }); if (b2) out.push({ x, y, side, nx, ny, w }); s += w + (o.gap || .25); }
      }
    }
    return out;
  };
  // 번호와 이름은 확대해도 화면에서 같은 크기로 보이게 (apply()에서 배율을 맞춤)
  const PINS = [];
  const pin = (x, y, cls) => { const p = el('g', { class: cls || '' }, gL); PINS.push({ p, x, y }); return p; };
  const marker = (n, x, y) => { const p = pin(x, y, 'mk'); el('circle', { r: 9, fill: '#1d2c45', stroke: '#fff', 'stroke-width': 1.6 }, p); el('text', { y: 4, 'font-size': 11, 'text-anchor': 'middle', fill: '#fff', 'font-weight': 700 }, p).textContent = n; return p; };
  const label = (t, x, y, cls, size, anchor) => { const p = pin(x, y, cls === 'zl' ? 'zg' : ''); const e = el('text', { class: cls, 'font-size': cls === 'zl' ? Math.min(19, size * .8) : 12, 'stroke-width': cls === 'zl' ? 4.5 : 3.2, 'text-anchor': anchor || 'middle' }, p); e.textContent = t; return e; };
  const KEY = []; let num = 0;
  const key = (group, name, note, x, y, z) => { OUT.pois.push({ group, name, note, x, y });  num++; KEY.push({ n: num, group, name, note, x, y, z: z || 1.2 }); const m = marker(num, x, y); const t = el('text', { x: 13, y: 4, class: 'bl', 'font-size': 12, 'stroke-width': 3.2 }, m); t.textContent = name; return num; };

  // 종탑 광장
  { const [cx, cy] = PLAZA, gp = gB;
    el('circle', { cx, cy, r: 31, fill: '#d6dde6', stroke: '#9eacbf', 'stroke-width': 1 }, gp);
    for (const r of [26, 20, 14]) el('circle', { cx, cy, r, fill: 'none', stroke: '#c3ccd8', 'stroke-width': .5 }, gp);
    el('circle', { cx, cy, r: 6, fill: '#3f6b50', stroke: '#2a4a37', 'stroke-width': .6 }, gp); el('path', { d: `M${cx} ${cy - 3.5}l1 2.4 2.5.2-1.9 1.6.6 2.4-2.2-1.3-2.2 1.3.6-2.4-1.9-1.6 2.5-.2z`, fill: '#ffd66b' }, gp);
    el('rect', { x: cx - 5, y: cy - 43, width: 10, height: 10, fill: '#9a8f86', stroke: '#33435a', 'stroke-width': .5 }, gp); el('path', { d: `M${cx - 5} ${cy - 43}L${cx + 5} ${cy - 33}M${cx + 5} ${cy - 43}L${cx - 5} ${cy - 33}`, stroke: '#5d5550', 'stroke-width': .4 }, gp); placed.push({ x: cx, y: cy - 38, r: 7 });
    el('circle', { cx: cx + 16, cy: cy + 14, r: 5.5, fill: '#f2d6e0', stroke: '#b05d7d', 'stroke-width': .6 }, gp);
    OUT.specials.push({ type: 'plaza', x: cx, y: cy }); for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283 + .26, x = cx + Math.cos(a) * 23.5, y = cy + Math.sin(a) * 23.5; if (Math.hypot(x - cx - 16, y - cy - 14) < 8) continue; OUT.stalls.push({ x, y, ang: a + Math.PI / 2, color: '#c4473a' }); el('rect', { x: x - 2, y: y - 1.5, width: 4, height: 3, fill: '#c4473a', stroke: '#6d2219', 'stroke-width': .35, transform: `rotate(${a * 180 / Math.PI + 90} ${x} ${y})` }, gp); }
    for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283, x = cx + Math.cos(a) * 32.5, y = cy + Math.sin(a) * 32.5; el('circle', { cx: x, cy: y, r: 1.2, fill: '#ffb347' }, gp); }
    for (const a of [.9, 2.3, 3.9, 5.4]) { const x = cx + Math.cos(a) * 11, y = cy + Math.sin(a) * 11; el('rect', { x: x - .9, y: y - .3, width: 1.8, height: .6, fill: '#5d4a3a', transform: `rotate(${a * 180 / Math.PI + 90} ${x} ${y})` }, gp); }
    for (const a of [1.6, 4.7]) el('circle', { cx: cx + Math.cos(a) * 9, cy: cy + Math.sin(a) * 9, r: 1.6, fill: '#e07a3a' }, gp);
    key('종탑 광장', '큰 트리 (높이 20m)', '금·빨강 두 색 장식', cx, cy, 5); key('종탑 광장', '종탑 (4층)', '해 질 녘·자정에 울림', cx, cy - 38, 5); key('종탑 광장', '회전목마', '', cx + 16, cy + 14, 5); key('종탑 광장', '장터 오두막 11채', '아몬드·생강빵·장갑·장난감·촛불·음료…', cx - 23.5, cy + 3, 5); key('종탑 광장', '모닥불과 통나무 의자', '', cx - 6, cy + 12, 6);
  }

  // 등불 골목
  const alley = rowsAlong(ST.alley.pts, { half: 2, set: .2, depth: 9, minW: 5.5, maxW: 8, roof: ROOF.alley, gap: .15 });
  { const sq = pointAt(ST.alley.pts, .52); el('circle', { cx: sq[0], cy: sq[1] + 1, r: 7, fill: '#d6dde6', stroke: '#9eacbf', 'stroke-width': .6 }, gB); key('등불 골목', '합창단 작은 광장', '저녁 캐럴', sq[0], sq[1] + 1, 6); }
  along(ST.alley.pts, 12, (x, y, ux, uy) => el('circle', { cx: x - uy * 1.6, cy: y + ux * 1.6, r: .9, fill: '#ffb347' }, gB));
  [['서점', '문 열면 종이 딸랑'], ['찻집', '김 서린 창'], ['오르골 가게', ''], ['빵집', '생강빵 굽는 냄새'], ['털실 가게', '장갑을 떠 주는 주인']].forEach(([n, d], i) => { const h = alley[3 + i * 5]; if (h) key('등불 골목', n, d, h.x, h.y, 7); });

  // 마켓 거리
  // 유리 지붕 마켓 홀 (거대 구슬이 매달린 홀) · 빨간 아케이드
  { const [x, y, a] = pointAt(ST.market.pts, .13); const nx = Math.sin(a), ny = -Math.cos(a), cx = x + nx * 20, cy = y + ny * 20; building(cx, cy, 40, 20, a, '#b9d3e6', { force: 1 }); for (let k = -3; k <= 3; k++) el('circle', { cx: cx + Math.cos(a) * k * 5, cy: cy + Math.sin(a) * k * 5, r: 1.6, fill: k % 2 ? '#c0392b' : '#d8dde4', stroke: '#6d2219', 'stroke-width': .3 }, gB); key('빛의 대로', '유리 지붕 마켓 홀', '천장에 거대한 빨강·은 구슬', cx, cy, 5); }
  { const [x, y, a] = pointAt(ST.market.pts, .42); const nx = Math.sin(a), ny = -Math.cos(a), cx = x + nx * 21, cy = y + ny * 21; building(cx, cy, 6, 28, a, '#a8322a', { force: 1, ridge: false }); for (let k = -3; k <= 3; k++) el('circle', { cx: cx + nx * k * 3.6, cy: cy + ny * k * 3.6, r: .9, fill: '#3f6b50' }, gB); key('빛의 대로', '빨간 아케이드', '지붕 덮인 통로, 작은 트리가 줄지어', cx, cy, 6); }
  const market = rowsAlong(ST.market.pts, { half: 7, set: .3, depth: 14, minW: 10, maxW: 15, roof: ROOF.avenue, gap: 0 });
  el('path', { d: path(ST.market.pts), fill: 'none', stroke: '#cdd5df', 'stroke-width': 8, 'stroke-linecap': 'round' }, gR);
  along(ST.market.pts, 20, (x, y, ux, uy) => { OUT.arches.push({ x, y, ux, uy, half: 6.2 }); const a = [x - uy * 6.2, y + ux * 6.2], b = [x + uy * 6.2, y - ux * 6.2]; el('path', { d: `M${a[0]} ${a[1]}Q${x + ux * 3} ${y + uy * 3} ${b[0]} ${b[1]}`, fill: 'none', stroke: '#ffd27a', 'stroke-width': .9, opacity: .9 }, gB); for (const s of [-1, 1]) el('path', { d: `M${x} ${y}q${ux * 4 - uy * s * 2.5} ${uy * 4 + ux * s * 2.5} ${-uy * s * 5} ${ux * s * 5}`, fill: 'none', stroke: '#fff1c4', 'stroke-width': .7 }, gB); for (const s of [-1, 1]) el('circle', { cx: x - uy * s * 6.2, cy: y + ux * s * 6.2, r: 1.1, fill: '#ffb347' }, gB); });
  along(ST.market.pts, 10, (x, y, ux, uy) => { for (const s of [-1, 1]) el('circle', { cx: x + ux * 5 - uy * s * 5.2, cy: y + uy * 5 + ux * s * 5.2, r: 1.5, fill: '#5d7a6b' }, gB); });
  for (const k of ['lane1', 'lane2', 'lane3', 'lane4', 'lane5']) { rowsAlong(ST[k].pts, { half: ST[k].w / 2, set: .2, depth: 8, minW: 5, maxW: 7.5, roof: ROOF.alley, gap: .15 }); along(ST[k].pts, 14, (x, y, ux, uy) => el('circle', { cx: x - uy * 1.4, cy: y + ux * 1.4, r: .8, fill: '#ffb347' }, gB)); }
  rowsAlong(ST.hb2.pts, { half: ST.hb2.w / 2, set: .3, depth: 9, minW: 6, maxW: 8, roof: ROOF.harbor, gap: .3 });
  // 집 사이 작은 정원·우물
  { const w = pointAt(ST.lane4.pts, .5); el('circle', { cx: w[0] + 6, cy: w[1], r: 1.6, fill: '#8c96a3', stroke: '#33435a', 'stroke-width': .4 }, gB); key('등불 골목', '골목 우물', '', w[0] + 6, w[1], 7); }
  if (market[2]) key('빛의 대로', '여관 “눈송이”', '', market[2].x, market[2].y, 6);
  if (market[5]) key('빛의 대로', '백화점 쇼윈도', '움직이는 인형 장식', market[5].x, market[5].y, 6);
  if (market[9]) key('빛의 대로', '극장', '크리스마스 연극', market[9].x, market[9].y, 6);
  { const p = pointAt(ST.market.pts, .5); key('빛의 대로', '머리 위 천사 날개 조명', '20m마다 길을 가로질러', p[0], p[1], 5); }
  for (const k of ['bk1', 'bk2', 'cross1', 'cross2']) rowsAlong(ST[k].pts, { half: ST[k].w / 2, set: .2, depth: 8, minW: 5, maxW: 7, roof: ROOF.alley, gap: .15 });

  // 다리 길·호숫길
  rowsAlong(ST.entry.pts, { half: 3, set: .4, depth: 10, minW: 7, maxW: 10, roof: ROOF.entry, gap: .3 });
  const lakeRow = rowsAlong(ST.lake.pts.slice(0, 2), { half: 3, set: 1.5, depth: 9, minW: 6, maxW: 8, roof: ROOF.lake, gap: 1 });
  if (lakeRow[1]) key('얼음 호수', '스케이트 대여소', '', lakeRow[1].x, lakeRow[1].y, 6);

  // 겨울 놀이공원 (약 460×310m)
  { const gF2 = g(); gB.parentNode.insertBefore(gF2, gB); const P = FAIRPOLY;
    el('path', { d: path(P) + 'Z', fill: '#eef1f6', stroke: '#9eacbf', 'stroke-width': 1.2 }, gF2);
    const inset = P.map(([x, y]) => [x + (FAIR.x - x) * .045, y + (FAIR.y - y) * .07]);
    el('path', { d: path(inset) + 'Z', fill: 'none', stroke: '#6e5f4b', 'stroke-width': 2.2 }, gF2); el('path', { d: path(inset) + 'Z', fill: 'none', stroke: '#c8b08c', 'stroke-width': 1, 'stroke-dasharray': '1 2' }, gF2);
    OUT.specials.push({ type: 'fairground', poly: P }); const fp = (pts, w) => { OUT.roads.push({ pts, w, kind: 'fair' }); el('path', { d: path(pts), fill: 'none', stroke: '#d8c8a4', 'stroke-width': w + 1.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, gF2); el('path', { d: path(pts), fill: 'none', stroke: '#f6efe0', 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, gF2); along(pts, 12, (x, y, ux, uy) => el('circle', { cx: x - uy * (w / 2 + .6), cy: y + ux * (w / 2 + .6), r: .8, fill: '#ffb347' }, gF2)); };
    const C = [FAIR.x, FAIR.y];
    fp([[1592, 800], [1620, 860], [1680, 920], C], 6); fp([[1490, 960], [1580, 958], [1660, 955], C], 6); fp([C, [1724, 1040], [1724, 1124]], 6); fp([C, [1800, 930], [1860, 900]], 5); fp([C, [1820, 1010], [1880, 1050]], 5); fp([[1620, 860], [1560, 920], [1560, 1040], [1640, 1080]], 4);
    const T = (x, y, r) => { OUT.firs.push([x, y, r * 2.2]); el('path', { d: `M${x} ${y - r}l${r * .6} ${r * 1.4}h${-r * 1.2}z`, fill: '#3f6b50' }, gB); el('circle', { cx: x, cy: y - r, r: .6, fill: '#ffd66b' }, gB); };
    // 정문 세 곳
    for (const [x, y, a] of [[1592, 803, .1], [1488, 960, 1.57], [1724, 1121, 0]]) { el('rect', { x: x - 8, y: y - 1.5, width: 16, height: 3, fill: '#c0392b', stroke: '#6d2219', 'stroke-width': .5, transform: `rotate(${a * 57.3} ${x} ${y})` }, gB); }
    key('겨울 놀이공원', '정문 (빛의 대로 쪽)', '사탕 지팡이 기둥과 별 아치', 1592, 803, 4);
    // 가운데 광장: 푸드코트
    el('circle', { cx: C[0], cy: C[1], r: 30, fill: '#d6dde6', stroke: '#9eacbf', 'stroke-width': .6 }, gB); T(C[0], C[1], 4.5);
    OUT.specials.push({ type: 'foodcourt', x: C[0], y: C[1] }); for (let k = 0; k < 14; k++) { const a = k / 14 * 6.283; building(C[0] + Math.cos(a) * 36, C[1] + Math.sin(a) * 36, 5, 4, a + 1.57, k % 2 ? '#c4473a' : '#e6b422', { force: 1, ridge: false }); }
    for (let k = 0; k < 10; k++) { const a = k / 10 * 6.283 + .3; el('circle', { cx: C[0] + Math.cos(a) * 18, cy: C[1] + Math.sin(a) * 18, r: 1.4, fill: '#8a6a4a' }, gB); }
    placed.push({ x: C[0], y: C[1], r: 40 }); key('겨울 놀이공원', '푸드코트 광장', '간식 오두막 14채·트리·테이블', C[0] + 14, C[1] - 8, 3);
    // 대관람차
    { const x = 1852, y = 872, r = 30; OUT.specials.push({ type: 'ferris', x, y, r }); el('circle', { cx: x, cy: y, r, fill: 'none', stroke: '#c0392b', 'stroke-width': 2.4 }, gB); el('circle', { cx: x, cy: y, r: r * .55, fill: 'none', stroke: '#c0392b', 'stroke-width': .8 }, gB); for (let k = 0; k < 24; k++) { const a = k / 24 * 6.283; el('line', { x1: x, y1: y, x2: x + Math.cos(a) * r, y2: y + Math.sin(a) * r, stroke: '#c0392b', 'stroke-width': .35 }, gB); el('rect', { x: x + Math.cos(a) * r - 1.5, y: y + Math.sin(a) * r - 1.5, width: 3, height: 3, rx: .8, fill: ['#ffd27a', '#e0645c', '#7fc8e8', '#9fe0b8'][k % 4] }, gB); } placed.push({ x, y, r: r + 4 }); key('겨울 놀이공원', '대관람차 (지름 60m)', '꼭대기에서 오로라와 마을 전체', x, y, 3); }
    // 롤러코스터
    { const pts = []; for (let i = 0; i <= 80; i++) { const t = i / 80 * 6.283; pts.push([1860 + Math.cos(t) * 62 + Math.sin(t * 3) * 10, 1040 + Math.sin(t) * 42 + Math.cos(t * 2) * 8]); } OUT.specials.push({ type: 'coaster', pts }); el('path', { d: path(pts) + 'Z', fill: 'none', stroke: '#6d2219', 'stroke-width': 3.2 }, gB); el('path', { d: path(pts) + 'Z', fill: 'none', stroke: '#e0645c', 'stroke-width': 1.6 }, gB); along(pts, 9, (x, y) => el('circle', { cx: x, cy: y, r: .7, fill: '#33435a' }, gB)); placed.push({ x: 1860, y: 1040, r: 66 }); building(1800, 1086, 14, 8, 0, '#2e6f9e', { force: 1 }); key('겨울 놀이공원', '눈썰매 롤러코스터', '산타 썰매 모양 열차', 1860, 1040, 3); }
    // 2층 회전목마
    { const x = 1648, y = 878; OUT.specials.push({ type: 'carousel', x, y, r: 13 }); el('circle', { cx: x, cy: y, r: 13, fill: '#f2d6e0', stroke: '#b05d7d', 'stroke-width': 1 }, gB); for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; el('line', { x1: x, y1: y, x2: x + Math.cos(a) * 13, y2: y + Math.sin(a) * 13, stroke: '#b05d7d', 'stroke-width': .4 }, gB); } el('circle', { cx: x, cy: y, r: 2.5, fill: '#e6b422' }, gB); placed.push({ x, y, r: 15 }); key('겨울 놀이공원', '2층 회전목마', '순록·북극곰 목마', x, y, 4); }
    // 회전 그네
    { const x = 1568, y = 888; OUT.specials.push({ type: 'swing', x, y, r: 11 }); el('circle', { cx: x, cy: y, r: 11, fill: 'none', stroke: '#2e6f9e', 'stroke-width': 1.2, 'stroke-dasharray': '2 2' }, gB); el('circle', { cx: x, cy: y, r: 2, fill: '#2e6f9e' }, gB); placed.push({ x, y, r: 12 }); key('겨울 놀이공원', '회전 그네', '', x, y, 5); }
    // 범퍼카 홀
    { building(1626, 1030, 34, 22, 0, '#5b6676', { force: 1 }); key('겨울 놀이공원', '범퍼카 홀', '', 1626, 1030, 5); }
    // 생강빵 집 미로
    { const x0 = 1520, y0 = 990, n = 8, s = 6; el('rect', { x: x0, y: y0, width: n * s, height: n * s, fill: '#f3e3c8', stroke: '#8a5a3a', 'stroke-width': .8 }, gB); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (R() < .45) el('line', R() < .5 ? { x1: x0 + i * s, y1: y0 + j * s, x2: x0 + i * s + s, y2: y0 + j * s, stroke: '#8a5a3a', 'stroke-width': 1 } : { x1: x0 + i * s, y1: y0 + j * s, x2: x0 + i * s, y2: y0 + j * s + s, stroke: '#8a5a3a', 'stroke-width': 1 }, gB); building(x0 + n * s / 2, y0 + n * s / 2, 8, 8, 0, '#a0522d', { force: 1 }); placed.push({ x: x0 + 24, y: y0 + 24, r: 32 }); key('겨울 놀이공원', '생강빵 집 미로', '가운데에 과자로 지은 집', x0 + 24, y0 + 24, 4); }
    // 얼음 미끄럼탑 · 공연 무대
    { const x = 1540, y = 1080; OUT.specials.push({ type: 'slide', x, y }); el('path', { d: `M${x} ${y - 12}a12 12 0 1 1 -1 0`, fill: 'none', stroke: '#7fc8e8', 'stroke-width': 3 }, gB); el('circle', { cx: x, cy: y, r: 3, fill: '#e8f4fb', stroke: '#5f86b0', 'stroke-width': .6 }, gB); placed.push({ x, y, r: 15 }); key('겨울 놀이공원', '얼음 미끄럼탑', '', x, y, 5); }
    { building(1760, 846, 24, 10, 0, '#6a5048', { force: 1 }); for (let r2 = 0; r2 < 4; r2++) el('path', { d: `M${1744} ${862 + r2 * 4}h32`, stroke: '#8a6a4a', 'stroke-width': 1.4 }, gB); placed.push({ x: 1760, y: 862, r: 16 }); key('겨울 놀이공원', '야외 무대와 관람석', '합창단 공연·자정 카운트다운', 1760, 846, 4); }
    // 빛의 터널
    { const pts = [[1600, 818], [1630, 870], [1690, 920]]; el('path', { d: path(pts), fill: 'none', stroke: '#ffd27a', 'stroke-width': 9, opacity: .35 }, gB); along(pts, 4, (x, y, ux, uy) => { for (const s2 of [-1, 1]) el('circle', { cx: x - uy * s2 * 4.2, cy: y + ux * s2 * 4.2, r: .7, fill: '#ffd27a' }, gB); }); key('겨울 놀이공원', '빛의 터널', '정문에서 광장까지 전구 터널', 1630, 870, 5); }
    // 둘레 미니 기차
    { const tr = P.map(([x, y]) => [x + (FAIR.x - x) * .08, y + (FAIR.y - y) * .12]); tr.push(tr[0]); OUT.specials.push({ type: 'train', pts: tr }); el('path', { d: path(tr), fill: 'none', stroke: '#33435a', 'stroke-width': 1.4 }, gB); along(tr, 3, (x, y, ux, uy) => el('line', { x1: x - uy * 1.4, y1: y + ux * 1.4, x2: x + uy * 1.4, y2: y - ux * 1.4, stroke: '#7b5b4a', 'stroke-width': .4 }, gB)); key('겨울 놀이공원', '꼬마 기차', '공원 둘레 한 바퀴', tr[1][0], tr[1][1], 3); }
    // 공원 안 나무
    for (let k = 0; k < 70; k++) { const x = rr(1500, 1940), y = rr(812, 1110); if (!inPoly(P, x, y) || placed.some(q => Math.hypot(q.x - x, q.y - y) < q.r + 3)) continue; T(x, y, rr(2, 3)); placed.push({ x, y, r: 3 }); }
    label('겨울 놀이공원', FAIR.x, 780, 'zl', 22); }
  // 항구
  const harborRow = rowsAlong(ST.harbor.pts.slice(5), { sides: [-1], half: 3.5, set: 2, depth: 10, minW: 6, maxW: 8, roof: ROOF.harbor, gap: .6 });
  if (harborRow[4]) key('등대 항구', '책방', '크리스마스이브에 책 선물', harborRow[4].x, harborRow[4].y, 6);
  if (harborRow[8]) key('등대 항구', '생선 가게', '북극곰 간식', harborRow[8].x, harborRow[8].y, 6);
  { const a = [1870, 1262], b = [1902, 1410]; el('path', { d: path([a, b]), stroke: '#8b7355', 'stroke-width': 9, 'stroke-linecap': 'butt' }, gB); el('path', { d: path([a, b]), stroke: '#c8b08c', 'stroke-width': 7.5 }, gB); along([a, b], 10, (x, y) => el('circle', { cx: x + 4.5, cy: y, r: .8, fill: '#ffb347' }, gB)); el('circle', { cx: b[0], cy: b[1] + 4, r: 5, fill: '#f4f1ea', stroke: '#c0392b', 'stroke-width': 1.6 }, gB); key('등대 항구', '등대 (22m)', '', b[0], b[1] + 4, 5); key('등대 항구', '부두 (180m)', '눈 덮인 고깃배', 1886, 1330, 5);
    for (const [x, y, r2] of [[1830, 1305, 7], [1845, 1318, 4]]) { el('circle', { cx: x, cy: y, r: r2 + 1.2, fill: '#8c96a3' }, gB); el('circle', { cx: x, cy: y, r: r2, fill: '#bfe3e0' }, gB); } key('등대 항구', '노천 온천', '눈송이가 김 속으로', 1830, 1305, 5);
    for (const [x, y] of [[1858, 1300], [1915, 1350], [1925, 1300]]) el('path', { d: `M${x - 6} ${y}q6 -5 12 0q-6 4 -12 0z`, fill: '#7b5b4a' }, gB); }

  // 북극곰 주민: 따로 사는 곳이 아니라 마을 곳곳에서 일하고 노는 NPC
  const bear = (x, y, s, name, note) => { OUT.bears.push({ x, y, s, name: name || '' }); el('ellipse', { cx: x, cy: y, rx: 2.4 * s, ry: 1.4 * s, fill: '#fffaf0', stroke: '#9c8c70', 'stroke-width': .5 }, gB); el('circle', { cx: x + 2.4 * s, cy: y - .3 * s, r: .95 * s, fill: '#fffaf0', stroke: '#9c8c70', 'stroke-width': .5 }, gB); if (name) key('북극곰 주민', name, note, x, y, 6); };
  bear(PLAZA[0] - 18, PLAZA[1] + 16, 1, '코코아 장수 곰', '광장 장터의 따뜻한 음료');
  bear(LAKE.x - 30, LAKE.y + 6, 1, '스케이트 강사 곰', '손잡고 함께 타요'); bear(LAKE.x - 20, LAKE.y - 8, .7); bear(LAKE.x + 22, LAKE.y + 10, .7);
  bear(530, 640, 1, '선물 포장 곰', '산타 공장에서 일해요');
  bear(1886, 1300, 1, '낚시하는 곰', '부두 끝에서'); bear(1210, 870, .7, '눈사람 만드는 아기곰들', '호숫길 공원'); bear(1218, 876, .65);
  bear(1600, 822, 1, '풍선 파는 곰', '놀이공원 정문'); bear(1900, 715, .8, '썰매 타는 곰 형제', '눈썰매 언덕'); bear(1906, 724, .7);
  bear(990, 950, .9, '군밤 굽는 곰', '빵집 골목 모퉁이');
  // 산타 마을
  { building(520, 598, 40, 24, -.18, '#b23a2e', { force: 1 }); key('산타 마을', '선물 공장 (40×24m)', '창 너머 장난감 만들기', 520, 598, 4);
    building(585, 662, 16, 12, .5, '#c4473a', { force: 1 }); key('산타 마을', '산타 우체국', '편지 쓰기·답장', 585, 662, 5);
    building(470, 688, 30, 12, .3, '#8a5a44', { force: 1 }); key('산타 마을', '순록 마구간 (6칸)', '먹이 주기·썰매 출발', 470, 688, 5);
    el('rect', { x: 430, y: 700, width: 34, height: 22, fill: 'none', stroke: '#8a5a44', 'stroke-width': .6, 'stroke-dasharray': '2 1.5', transform: 'rotate(17 447 711)' }, gB); key('산타 마을', '순록 울타리 마당', '', 447, 712, 5);
    [[455, 620], [470, 645], [560, 560], [600, 620], [545, 650]].forEach(([x, y], i) => building(x, y, 9, 8, R() * .6 - .3, '#d65a48', { force: 1, chimney: true }));
    key('산타 마을', '산타들의 집 5채', '', 470, 645, 5);
    const sp = { w: 3, pts: [[590, 672], [545, 650], [520, 615], [478, 560]] }; el('path', { d: path(sp.pts), fill: 'none', stroke: '#d8c8a4', 'stroke-width': 4.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, gR); el('path', { d: path(sp.pts), fill: 'none', stroke: '#f1e3c2', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, gR);
    el('path', { d: path([[545, 650], [500, 660], [470, 688]]), fill: 'none', stroke: '#f1e3c2', 'stroke-width': 3, 'stroke-linecap': 'round' }, gR);
    for (const [x, y] of [[560, 640], [505, 625], [470, 610]]) { el('path', { d: `M${x} ${y - 3}l2.2 5h-4.4z`, fill: '#3f6b50' }, gB); el('circle', { cx: x, cy: y - 3.4, r: .6, fill: '#ffd66b' }, gB); }
    const { a, b } = RUNWAY; key('산타 마을', '썰매 활주로 (220m)', '자정 출발 장소', (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 3);
    label('산타 마을', 520, 540, 'zl', 24); }

  // 내 오두막
  { building(758, 772, 9, 8, -.4, '#6e4637', { force: 1, chimney: true }); el('circle', { cx: 758, cy: 772, r: 14, fill: 'none', stroke: '#8a6a4a', 'stroke-width': .6, 'stroke-dasharray': '1.5 1.5' }, gB); key('내 오두막', '내 오두막', '벽난로·고양이·내 트리', 758, 772, 6); }

  // 입구와 시작
  { const [x, y] = [712, 1012]; el('rect', { x: x - 7, y: y - 2.5, width: 14, height: 5, fill: '#b8a58a', stroke: '#6e5f4b', 'stroke-width': .5, transform: `rotate(-24 ${x} ${y})` }, gB); key('마을 입구', '입구 다리', '등불 할머니·핫초코와 열쇠', x, y, 5); }
  key('마을 입구', '시작: 숲속 등불길', '등불 10m 간격', 90, 1530, 2.5);
  { const p = pointAt(PATHS.forest.pts, .86); key('마을 입구', '마을이 처음 보이는 모퉁이', '불빛이 한꺼번에', p[0] + 6, p[1] - 6, 3); }
  along(PATHS.forest.pts, 10, (x, y, ux, uy) => el('circle', { cx: x - uy * 2.4, cy: y + ux * 2.4, r: .8, fill: '#ffb347' }, gB));

  // 별빛 언덕
  { const [x, y] = [1052, 436]; el('circle', { cx: x, cy: y, r: 22, fill: '#d6dde6', stroke: '#9eacbf', 'stroke-width': .6 }, gB); el('circle', { cx: x, cy: y, r: 3, fill: '#e07a3a' }, gB); for (let k = 0; k < 4; k++) { const a = k / 4 * 6.283 + .5; el('circle', { cx: x + Math.cos(a) * 15, cy: y + Math.sin(a) * 15, r: 3.6, fill: '#cfe7f2', stroke: '#5f86b0', 'stroke-width': .6 }, gB); } placed.push({ x, y, r: 22 });
    key('별빛 언덕', '유리 지붕 오두막 4채', '누워서 오로라', x + 15, y - 6, 4); key('별빛 언덕', '큰 모닥불·소원 등불', '광장보다 90m 높음', x, y, 4); label('별빛 언덕', x, y - 34, 'zl', 22);
    along(PATHS.star.pts, 14, (px, py, ux, uy) => el('circle', { cx: px - uy * 2.4, cy: py + ux * 2.4, r: .8, fill: '#ffb347' }, gB)); }

  // 예배당
  { building(1330, 1003, 11, 20, .35, '#9a8f86', { force: 1 }); el('rect', { x: 1326.5, y: 989, width: 7, height: 7, fill: '#8a8078', stroke: '#33435a', 'stroke-width': .4, transform: 'rotate(20 1330 1003)' }, gB); key('얼음 호수', '언덕 위 예배당', '촛불·고요한 밤', 1330, 1003, 5); }
  key('얼음 호수', '얼음 호수 스케이트장 (150×70m)', '전구 둘레', LAKE.x, LAKE.y, 3);
  { const sled = [[1250, 980], [1290, 950]]; el('path', { d: path(sled), stroke: '#ffffff', 'stroke-width': 10, 'stroke-linecap': 'round' }, gB); }

  // 스키장 시설
  { el('line', { x1: BASE[0], y1: BASE[1], x2: PEAK[0], y2: PEAK[1], stroke: '#33435a', 'stroke-width': 1, 'stroke-dasharray': '4 2' }, gB); along([BASE, PEAK], 55, (x, y) => el('rect', { x: x - 1, y: y - 1, width: 2, height: 2, fill: '#33435a' }, gB));
    building(PEAK[0] - 2, PEAK[1] - 10, 14, 9, .2, '#8a5a44', { force: 1, chimney: true }); building(BASE[0] - 18, BASE[1] + 6, 20, 12, 0, '#a0523d', { force: 1, chimney: true });
    key('스키 산', '리프트 (높이 차 180m)', '', (BASE[0] + PEAK[0]) / 2, (BASE[1] + PEAK[1]) / 2, 2.5); key('스키 산', '정상 산장', '오로라가 머리 위로', PEAK[0] - 2, PEAK[1] - 10, 4); key('스키 산', '베이스 산장·장비 대여', '', BASE[0] - 18, BASE[1] + 6, 4);
    RUNS.forEach((r, i) => { const p = pointAt(r.pts, .45); key('스키 산', r.name, ['초보', '중급', '숲 사이로'][i], p[0], p[1], 2.5); });
    el('path', { d: path([[1880, 700], [1905, 740]]), stroke: '#ffffff', 'stroke-width': 14, 'stroke-linecap': 'round' }, gB); key('스키 산', '눈썰매 언덕', '아이들', 1892, 720, 5);
    label('스키 산', 2140, 300, 'zl', 24); }

  // 자정 썰매 비행 경로
  { const gF = g(), o = RUNWAY.b; [[700, 120], [1300, 60], [2300, 120], [60, 80], [900, 0]].forEach(([x, y], i) => el('path', { d: `M${o[0]} ${o[1]} Q${(o[0] + x) / 2 + (i % 2 ? 160 : -120)} ${(o[1] + y) / 2 - 80} ${x} ${y}`, fill: 'none', stroke: '#2fa37a', 'stroke-width': 2, 'stroke-dasharray': '1.5 6', 'stroke-linecap': 'round', opacity: .9 }, gF));
    el('path', { d: `M${o[0]} ${o[1]} C 900 300 1400 500 ${PLAZA[0]} ${PLAZA[1] - 60} S 1500 350 2300 120`, fill: 'none', stroke: '#2fa37a', 'stroke-width': 2, 'stroke-dasharray': '1.5 6', opacity: .55 }, gF); }

  // 새 동네 집들
  for (const H2 of HOODS) { for (const k of H2.keys) { const s = ST[k]; rowsAlong(s.pts, { half: s.w / 2, set: .3, depth: H2.depth, minW: H2.roof === 'chalet' ? 9 : 6, maxW: H2.roof === 'chalet' ? 12 : 9, roof: ROOF[H2.roof], gap: H2.roof === 'chalet' ? 3 : .2 }); along(s.pts, 14, (x, y, ux, uy) => el('circle', { cx: x - uy * (s.w / 2 + .6), cy: y + ux * (s.w / 2 + .6), r: .8, fill: '#ffb347' }, gB)); }
    label(H2.name, H2.lab ? H2.lab[0] : H2.cx, H2.lab ? H2.lab[1] : H2.cy, 'zl', 20); }
  // 길 모퉁이 작은 쉼터 (트리·벤치)
  for (const H2 of HOODS) for (const k of H2.keys) { const s = ST[k]; if (k.indexOf('v') < 0) continue; const m = pointAt(s.pts, .5); if (blocked(m[0] + 8, m[1] + 8, 4)) continue; el('circle', { cx: m[0] + 8, cy: m[1] + 8, r: 4, fill: '#d6dde6', stroke: '#9eacbf', 'stroke-width': .5 }, gB); el('path', { d: `M${m[0] + 8} ${m[1] + 5.5}l2 4.5h-4z`, fill: '#3f6b50' }, gB); placed.push({ x: m[0] + 8, y: m[1] + 8, r: 4.5 }); }
  // 블록 안쪽 채우기: 집 뒤 마당의 나무, 장작 헛간, 텃밭 울타리, 눈사람
  { const houses = placed.slice(); const gY = g(); gB.parentNode.insertBefore(gY, gB);
    const near = (x, y) => { for (const q of houses) if (q.r < 12 && Math.abs(q.x - x) < 16 && Math.abs(q.y - y) < 16 && Math.hypot(q.x - x, q.y - y) < q.r + 9) return true; return false; };
    for (let y = 540; y < 1310; y += 5) for (let x = 740; x < 1960; x += 5) { const jx = x + rr(-2, 2), jy = y + rr(-2, 2); if (!near(jx, jy) || blocked(jx, jy, 2.2)) continue; const t = R();
      if (t < .3) { el('circle', { cx: jx, cy: jy, r: rr(1.6, 2.6), fill: '#6f8c7d' }, gY); el('circle', { cx: jx - .6, cy: jy - .6, r: 1, fill: '#eef3f6', opacity: .8 }, gY); placed.push({ x: jx, y: jy, r: 2.2 }); }
      else if (t < .38) { building(jx, jy, 3, 2.4, rr(0, 3.14), '#8a6a4a', { force: 1, ridge: false }); }
      else if (t < .43) { el('rect', { x: jx - 2.5, y: jy - 2, width: 5, height: 4, fill: '#eef2f6', stroke: '#9b8a70', 'stroke-width': .35, 'stroke-dasharray': '.8 .5' }, gY); placed.push({ x: jx, y: jy, r: 3 }); }
      else if (t < .45) { el('circle', { cx: jx, cy: jy, r: .9, fill: '#fff', stroke: '#9eacbf', 'stroke-width': .3 }, gY); el('circle', { cx: jx, cy: jy - 1.1, r: .6, fill: '#fff', stroke: '#9eacbf', 'stroke-width': .3 }, gY); placed.push({ x: jx, y: jy, r: 1.2 }); } } }
  // 동네 이름
  label('종탑 광장', PLAZA[0], PLAZA[1] - 60, 'zl', 26); label('등불 골목', 960, 900, 'zl', 22); label('빛의 대로', 1390, 735, 'zl', 22); label('등대 항구', 1760, 1200, 'zl', 22); label('해안 산책로', 2100, 1225, 'zl', 16); label('얼음 호수', LAKE.x, LAKE.y + 60, 'zl', 20); label('자작나무 숲', 300, 1300, 'zl', 24); label('순록 썰매 길', 230, 1010, 'zl', 16);
  label('얼음 바다', 1600, 1530, 'zl', 22);

  // 단면선 A-A'
  el('line', { x1: 1180, y1: 380, x2: 1180, y2: 1560, stroke: '#c0392b', 'stroke-width': 1, 'stroke-dasharray': '10 5', opacity: .7 });
  el('text', { x: 1186, y: 396, 'font-size': 14, fill: '#c0392b', 'font-weight': 700 }).textContent = 'A'; el('text', { x: 1186, y: 1556, 'font-size': 14, fill: '#c0392b', 'font-weight': 700 }).textContent = 'A′';

  if (svg) svg.appendChild(gL);
  return { OUT, KEY, PINS, PLAZA, SEA, LAKE, STREAM, FAIR, FAIRPOLY, ST, PATHS, SLED, RUNWAY, PEAK, BASE, RUNS, pointAt, lineD, inPoly };
  };
})();
