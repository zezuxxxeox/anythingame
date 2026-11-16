// 나라별 실제 거리: 벽을 맞댄 건물 줄, 포장도로·인도·연석, 거리 소품
// 파리(오스만 대로) · 교토(기온 거리) · 리스본(알파마 골목 + 28번 트램) · 레이캬비크(무지개 거리) · 루체른(구시가지)
(function () {
  const ISL = window.ISL, H = (x, z) => ISL.H(x, z);
  let LH, scene;
  const PX = 24; // 외벽 텍스처: 1m당 픽셀
  const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
  const C = c => new THREE.Color(c);
  const mcache = new Map();
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const ctex = (c, rep) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t; };

  // ---------- 외벽 그리기 도구 (미터 단위) ----------
  function facadeMat(key, wM, hM, paint) {
    if (mcache.has(key)) return mcache.get(key);
    const W = Math.min(1024, Math.round(wM * PX)), Hp = Math.min(1024, Math.round(hM * PX)), sx = W / wM, sy = Hp / hM;
    const c = cv(W, Hp), x = c.getContext('2d'), wins = [], r = ISL.mulberry32(hashStr(key));
    const P = {
      x, r, W: wM, H: hM,
      X: v => v * sx, Y: v => Hp - v * sy, S: v => v * sx,
      rect(x0, y0, w, h, col) { x.fillStyle = col; x.fillRect(x0 * sx, Hp - (y0 + h) * sy, w * sx, h * sy); },
      line(x0, y0, x1, y1, col, wpx) { x.strokeStyle = col; x.lineWidth = wpx; x.beginPath(); x.moveTo(x0 * sx, Hp - y0 * sy); x.lineTo(x1 * sx, Hp - y1 * sy); x.stroke(); },
      noise(col, amt, n) { for (let i = 0; i < n; i++) { x.fillStyle = col; x.globalAlpha = amt * r(); x.fillRect(r() * W, r() * Hp, 1 + r() * 3, 1 + r() * 3); } x.globalAlpha = 1; },
      text(t, x0, y0, size, col, font) { x.fillStyle = col; x.font = `${font || 'bold'} ${Math.round(size * sy)}px Georgia, 'Times New Roman', serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, x0 * sx, Hp - y0 * sy); },
      // 창: 유리(하늘 반사 그라데이션) + 창틀 + 창살
      window(o) {
        const { cx, y0, w, h } = o, x0 = cx - w / 2;
        if (o.surround) P.rect(x0 - o.sw, y0 - o.sw, w + o.sw * 2, h + o.sw * 2 + (o.cap || 0), o.surround);
        if (o.shadow !== false) P.rect(x0 - .02, y0 - .02, w + .04, h + .04, 'rgba(0,0,0,.35)');
        const g = x.createLinearGradient(0, Hp - (y0 + h) * sy, 0, Hp - y0 * sy);
        g.addColorStop(0, o.glassTop || '#9fb4c4'); g.addColorStop(.55, o.glass || '#34404c'); g.addColorStop(1, o.glassBot || '#1f272f');
        x.fillStyle = g; x.fillRect(x0 * sx, Hp - (y0 + h) * sy, w * sx, h * sy);
        if (o.curtain) P.rect(x0 + w * .08, y0 + h * .1, w * .2, h * .85, o.curtain), P.rect(x0 + w * .72, y0 + h * .1, w * .2, h * .85, o.curtain);
        const fw = o.fw || .07, fc = o.frame || '#f3eee4';
        P.rect(x0, y0, w, fw, fc); P.rect(x0, y0 + h - fw, w, fw, fc); P.rect(x0, y0, fw, h, fc); P.rect(x0 + w - fw, y0, fw, h, fc);
        const [cols, rows] = o.bars || [2, 2];
        for (let i = 1; i < cols; i++) P.rect(x0 + w * i / cols - fw * .35, y0, fw * .7, h, fc);
        for (let j = 1; j < rows; j++) P.rect(x0, y0 + h * j / rows - fw * .3, w, fw * .6, fc);
        if (o.shutter) { P.rect(x0 - w * .5 - .03, y0, w * .48, h, o.shutter); P.rect(x0 + w + .03, y0, w * .48, h, o.shutter); for (let k = 0; k < h / .12; k++) { P.rect(x0 - w * .5, y0 + k * .12, w * .44, .025, 'rgba(0,0,0,.18)'); P.rect(x0 + w + .05, y0 + k * .12, w * .44, .025, 'rgba(0,0,0,.18)'); } }
        wins.push([x0 * sx, Hp - (y0 + h) * sy, w * sx, h * sy]);
      },
      doorway(cx, w, h, col) { P.rect(cx - w / 2 - .12, 0, w + .24, h + .14, col || '#d8d0c0'); P.rect(cx - w / 2, 0, w, h, '#14110e'); },
    };
    paint(P);
    const e = cv(Math.max(8, W >> 2), Math.max(8, Hp >> 2)), ex = e.getContext('2d'); ex.fillStyle = '#000'; ex.fillRect(0, 0, e.width, e.height);
    for (const [a, b, w, h] of wins) if (r() < .62) { ex.fillStyle = r() < .5 ? '#ffd38a' : '#ffbe6a'; ex.fillRect(a / 4, b / 4, Math.max(1, w / 4), Math.max(1, h / 4)); }
    const m = new THREE.MeshStandardMaterial({ map: ctex(c), emissiveMap: ctex(e), emissive: C('#ffcf88'), emissiveIntensity: 0, roughness: .85 });
    ISL.nightMats.push(m); mcache.set(key, m); return m;
  }
  // 반복 텍스처 (도로·인도·난간)
  function repTex(key, w, h, draw, alpha) {
    if (mcache.has(key)) return mcache.get(key);
    const c = cv(w, h), x = c.getContext('2d'); draw(x, w, h, ISL.mulberry32(hashStr(key))); const t = ctex(c, true); mcache.set(key, t); return t;
  }
  const railTex = () => repTex('rail', 128, 64, (x, w, h) => {
    x.clearRect(0, 0, w, h); x.strokeStyle = '#141414'; x.lineWidth = 5; x.strokeRect(2, 3, w - 4, h - 6); x.lineWidth = 3;
    for (let i = 0; i < 8; i++) { const px = 8 + i * 16; x.beginPath(); x.moveTo(px, 4); x.lineTo(px, h - 4); x.stroke(); }
    x.lineWidth = 2.5; for (let i = 0; i < 4; i++) { const cx = 16 + i * 32; x.beginPath(); x.arc(cx, h * .5, 9, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.arc(cx, h * .5, 4, 0, Math.PI * 2); x.stroke(); }
  });
  let railMat = null;
  function railing(p, w, x, y, z, ry = 0, hgt = .95) {
    railMat = railMat || new THREE.MeshStandardMaterial({ map: railTex(), alphaTest: .5, side: THREE.DoubleSide, roughness: .5, metalness: .6, color: '#2a2a2a' });
    const t = railMat.map; const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), railMat);
    const uv = m.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * Math.max(1, Math.round(w / 1.1)));
    t.wrapS = THREE.RepeatWrapping; m.position.set(x, y + hgt / 2, z); m.rotation.y = ry; m.castShadow = true; p.add(m); return m;
  }
  const M = (c, o) => LH.mat(c, o);

  // ---------- 나라별 건물 ----------
  const SHOPS = {
    paris: ['BOULANGERIE', 'CAFÉ DE FLORE', 'PHARMACIE', 'LIBRAIRIE', 'FROMAGERIE', 'BISTROT', 'FLEURISTE', 'PÂTISSERIE', 'BRASSERIE', 'CHOCOLATIER'],
    lisbon: ['TASCA', 'PASTELARIA', 'CASA DE FADO', 'MERCEARIA', 'SARDINHAS', 'GINJINHA'],
    reyk: ['KAFFI', 'BÓKABÚÐ', 'ULL', 'LISTHÚS', 'BAKARÍ', 'TÓNLIST'],
    luzern: ['CONFISERIE', 'UHREN', 'BÄCKEREI', 'KÄSE', 'APOTHEKE', 'WEINSTUBE'],
  };
  // 건물 옆면·뒷면: 민벽 대신 실제처럼 창과 배수관이 있는 벽
  function rearMat(key, wM, h, col, bases, o = {}) {
    return facadeMat('rear|' + key + '|' + wM.toFixed(1) + '|' + h.toFixed(1), wM, h, P => {
      P.rect(0, 0, wM, h, col); P.noise(o.noise || '#6a5a40', .1, 900); if (o.corr) for (let x = 0; x < wM; x += .076) P.rect(x, 0, .032, h, 'rgba(0,0,0,.09)');
      if (o.base) P.rect(0, 0, wM, o.baseH || .7, o.base);
      const bays = Math.max(1, Math.round(wM / (o.bay || 3)));
      for (const y of bases) for (let b = 0; b < bays; b++) { if (P.r() < .12) continue; P.window({ cx: (b + .5) * wM / bays, y0: y, w: o.ww || .95, h: o.wh || 1.5, frame: o.frame || '#f4f0e8', surround: o.surround, sw: .12, cap: .1, bars: o.bars || [2, 3], shutter: o.shutter, curtain: P.r() < .4 ? 'rgba(245,238,225,.55)' : null }); }
      P.rect(wM * .08, 0, .09, h, o.pipe || 'rgba(60,60,60,.75)'); if (o.top) P.rect(0, h - .25, wM, .25, o.top);
    });
  }
  const STY = {
    // 파리 오스만 양식: 석회암 외벽, 1층 상점, 2·5층 연속 발코니, 아연 망사르드 지붕과 굴뚝
    paris(g, w, d, r, n) {
      const bays = Math.round(w / 3), ups = 4 + (r() < .5 ? 1 : 0), gh = 4.3, uh = 3.05, h = gh + ups * uh;
      const shopCol = ['#4a1a22', '#1f3a2c', '#1d2a44', '#2b2b2b', '#6b4a22'][Math.floor(r() * 5)], shop = SHOPS.paris[n % SHOPS.paris.length];
      const f = facadeMat(`paris|${bays}|${ups}|${shop}|${shopCol}`, w, h, P => {
        const stone = '#e6d9bf'; P.rect(0, 0, w, h, stone); P.noise('#8a7a5a', .12, 1600);
        for (let y = .45; y < h; y += .5) P.rect(0, y, w, .015, 'rgba(120,100,70,.18)');
        for (let y = .45; y < gh; y += .45) P.rect(0, y, w, .05, 'rgba(90,75,50,.35)'); // 1층 러스티케이션
        // 상점 앞면
        P.rect(.35, .1, w - .7, 3.5, shopCol); P.rect(.55, .35, w - 1.1, 2.9, '#1d242b');
        const gr = P.x.createLinearGradient(0, P.Y(3.3), 0, P.Y(.3)); gr.addColorStop(0, 'rgba(180,200,215,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); P.x.fillStyle = gr; P.x.fillRect(P.X(.55), P.Y(3.25), P.S(w - 1.1), P.S(2.9));
        for (let x = .55 + 1.25; x < w - .6; x += 1.25) P.rect(x, .35, .07, 2.9, shopCol);
        P.rect(.35, 3.6, w - .7, .6, shopCol); P.text(shop, w / 2, 3.9, .38, '#e8c76a');
        P.doorway(w / 2, 1.3, 2.4, shopCol);
        P.rect(0, gh - .05, w, .3, '#f1e7d2'); P.rect(0, gh - .1, w, .06, 'rgba(0,0,0,.25)');
        for (let k = 0; k < ups; k++) {
          const y0 = gh + k * uh, top = k === ups - 1;
          if (k === 1 || top) { P.rect(0, y0 - .02, w, .22, '#f2e9d6'); P.rect(0, y0 - .05, w, .04, 'rgba(0,0,0,.25)'); }
          for (let b = 0; b < bays; b++) {
            const cx = (b + .5) * w / bays, ww = Math.min(1.25, w / bays * .45), wh = top ? 1.8 : 2.3;
            P.window({ cx, y0: y0 + .15, w: ww, h: wh, frame: '#f4efe6', surround: '#efe5cf', sw: .14, cap: .25, bars: [2, 4], curtain: r() < .35 ? 'rgba(240,230,210,.55)' : null });
            if (!top) P.rect(cx - ww / 2 - .2, y0 + wh + .45, ww + .4, .1, 'rgba(0,0,0,.2)');
          }
        }
        P.rect(0, h - .35, w, .35, '#efe4cc'); P.rect(0, h - .38, w, .05, 'rgba(0,0,0,.3)');
      });
            const pb = Array.from({ length: ups + 1 }, (_, k) => k ? gh + (k - 1) * uh + .3 : 1.2), po = { frame: '#f4efe6', surround: '#efe5cf', wh: 2, bars: [2, 4], noise: '#8a7a5a', top: '#efe4cc', base: '#cfc3a8' }, ps = rearMat('paris' + ups, d, h, '#e0d3b8', pb, po);
      LH.mesh(g, new THREE.BoxGeometry(w, h, d), [ps, ps, M('#666'), M('#666'), f, rearMat('paris' + ups, w, h, '#e0d3b8', pb, po)], 0, h / 2, 0);
      // 발코니: 2층·꼭대기층은 연속, 나머지는 창마다
      for (let k = 0; k < ups; k++) {
        const y0 = gh + k * uh, top = k === ups - 1;
        if (k === 1 || top) { LH.box(g, w - .1, .12, .6, M('#e9dfc8'), 0, y0, d / 2 + .3); railing(g, w - .2, 0, y0 + .12, d / 2 + .58); }
        else for (let b = 0; b < bays; b++) { const cx = (b + .5) * w / bays - w / 2, ww = Math.min(1.25, w / bays * .45); railing(g, ww + .2, cx, y0 + .15, d / 2 + .05, 0, .55); }
        for (let b = 0; b < bays; b++) LH.box(g, Math.min(1.25, w / bays * .45) + .3, .1, .14, M('#efe5cf'), (b + .5) * w / bays - w / 2, y0 + (top ? 2.05 : 2.55), d / 2 + .07);
      }
      LH.box(g, w + .06, .32, .5, M('#efe4cc'), 0, h - .3, d / 2 - .12); // 처마 코니스
      // 상점 차양 (줄무늬 천)
      if (r() < .7) { const aw = repTex('awn' + shopCol, 64, 16, (x, W, Hh) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#f2ede2' : shopCol; x.fillRect(i * 8, 0, 8, Hh); } }); const a = new THREE.Mesh(new THREE.BoxGeometry(w - .8, .06, 1.6), new THREE.MeshStandardMaterial({ map: aw, roughness: .9 })); a.geometry.attributes.uv.array.forEach((v, i, arr) => { if (i % 2 === 0) arr[i] = v * (w - .8) / 1.2; }); a.position.set(0, 3.55, d / 2 + .78); a.rotation.x = .38; a.castShadow = true; g.add(a); }
      // 망사르드 지붕 + 지붕창 + 굴뚝
      const zinc = ISL.roofMat('#6e7b86', 'metal'), mh = 3.4;
      LH.mesh(g, LH.frustumGeo(w / 2 + .05, d / 2 + .05, w / 2 - .05, d / 2 - 1.6, mh, 0, 0), zinc, 0, h, 0);
      LH.mesh(g, LH.frustumGeo(w / 2 - .05, d / 2 - 1.6, w / 2 - .4, 1.2, 1.4), zinc, 0, h + mh, 0);
      for (let b = 0; b < bays; b++) { const cx = (b + .5) * w / bays - w / 2; LH.box(g, .95, 1.5, 1.1, M('#e8ddc5'), cx, h + .8, d / 2 - .9); LH.mesh(g, LH.gableGeo(1.1, 1.2, .55, .08), zinc, cx, h + 2.3, d / 2 - .9); LH.box(g, .6, .95, .04, M('#2b343d'), cx, h + 1, d / 2 - .33); LH.box(g, .7, .08, .06, M('#f4efe6'), cx, h + 1.95, d / 2 - .31); }
      for (const sx of [-1, 1]) { LH.box(g, .7, 2.6, 2.6, ISL.blockMat('#b8735a', .25, .1), sx * (w / 2 - .35), h + mh - .2, 0); for (let i = 0; i < 5; i++) LH.cyl(g, .08, .1, .45, 8, M('#c76b45'), sx * (w / 2 - .35), h + mh + 2.4, -1 + i * .5); }
      return { h: h + mh + 1.4, interior: 'prov', trim: '#efe5cf' };
    },
    // 교토 기온: 1층 센본고시 격자, 처마, 낮은 2층 무시코마도, 이누야라이, 초롱, 노렌
    kyoto(g, w, d, r, n) {
      const gh = 3.0, uh = 2.3, h = gh + uh;
      const f = facadeMat(`kyoto|${w}|${n % 3}`, w, h, P => {
        P.rect(0, 0, w, gh, '#3b2a1d');
        for (let x = .05; x < w; x += .09) P.rect(x, .4, .045, gh - .7, (Math.floor(x / .09) % 2) ? '#5a4030' : '#4b3424');
        for (const y of [.4, 1.3, gh - .32]) P.rect(0, y, w, .07, '#2a1c12');
        for (const x of [0, w / 2 - .75, w / 2 + .75, w - .12]) P.rect(x, 0, .12, gh, '#2a1c12');
        P.doorway(w / 2, 1.4, 2.25, '#2a1c12');
        P.rect(0, gh, w, uh, '#ece5d4'); P.noise('#8a7a60', .08, 500);
        for (const x of [0, w / 2 - .06, w - .12]) P.rect(x, gh, .12, uh, '#3b2a1d');
        P.rect(0, gh, w, .1, '#2a1c12'); P.rect(0, h - .12, w, .12, '#2a1c12');
        for (const cx of [w * .27, w * .73]) { P.rect(cx - .8, gh + .65, 1.6, .85, '#2a2018'); for (let k = 0; k < 9; k++) P.rect(cx - .76 + k * .19, gh + .65, .09, .85, '#ece5d4'); P.window({ cx, y0: gh + .66, w: .01, h: .01, frame: '#ece5d4', shadow: false }); }
        P.window({ cx: w * .27, y0: .8, w: .9, h: 1.2, glass: '#1f1610', glassTop: '#3a2a1e', frame: '#4b3424', bars: [6, 1], shadow: false });
        P.window({ cx: w * .73, y0: .8, w: .9, h: 1.2, glass: '#1f1610', glassTop: '#3a2a1e', frame: '#4b3424', bars: [6, 1], shadow: false });
      });
      const side = M('#e3dccb');
      const ko = { frame: '#3b2a1d', ww: .8, wh: .9, bars: [4, 1], base: '#3b2a1d', baseH: 1.1, pipe: 'rgba(59,42,29,.9)', bay: 3.4 }, ks = rearMat('kyoto', d, h, '#e3dccb', [1.5, gh + .7], ko);
      LH.mesh(g, new THREE.BoxGeometry(w, h, d), [ks, ks, M('#555'), M('#555'), f, rearMat('kyoto', w, h, '#e3dccb', [1.5, gh + .7], ko)], 0, h / 2, 0);
      const tile = ISL.roofMat('#3f4249', 'tile');
      const eave = new THREE.Mesh(new THREE.BoxGeometry(w + .02, .1, 1.15), tile); eave.position.set(0, gh + .12, d / 2 + .48); eave.rotation.x = .3; eave.castShadow = true; g.add(eave);
      for (let x = -w / 2 + .3; x < w / 2; x += .6) LH.box(g, .07, .07, 1.0, M('#3b2a1d'), x, gh - .08, d / 2 + .45);
      LH.mesh(g, LH.gableGeo(d, w + .02, 1.5, .75), tile, 0, h, 0, Math.PI / 2);
      LH.box(g, w + .02, .22, .3, M('#2f3036'), 0, h + 1.45, 0);
      // 이누야라이: 대나무를 휘어 만든 울타리 (벽 아래쪽에서 바깥으로 불룩)
      const bamboo = repTex('bamboo', 64, 16, (x, W, Hh) => { x.clearRect(0, 0, W, Hh); for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#7a5a34' : '#6a4c2c'; x.fillRect(i * 8 + 2, 0, 4, Hh); } });
      const bmat = mcache.get('bamboomat') || (mcache.set('bamboomat', new THREE.MeshStandardMaterial({ map: bamboo, alphaTest: .4, side: THREE.DoubleSide, roughness: .7 })), mcache.get('bamboomat'));
      for (const sx of [-1, 1]) {
        const len = w / 2 - 1.05, pos = [], uv = [], idx = [];
        for (let i = 0; i <= 8; i++) { const t = i / 8 * Math.PI / 2, z = .32 * Math.sin(t), y = .8 * Math.cos(t); pos.push(-len / 2, y, z, len / 2, y, z); uv.push(0, i / 8, len * 7, i / 8); if (i) { const k = (i - 1) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); } }
        const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gg.setIndex(idx); gg.computeVertexNormals();
        const me = new THREE.Mesh(gg, bmat); me.position.set(sx * (len / 2 + .85), 0, d / 2 + .02); g.add(me);
      }
      // 노렌과 초롱
      const nor = repTex('noren' + (n % 3), 96, 64, (x, W, Hh) => { x.fillStyle = ['#23365e', '#5a1e22', '#3a3a3a'][n % 3]; x.fillRect(0, 0, W, Hh); x.fillStyle = '#fff'; x.beginPath(); x.arc(W / 2, Hh * .45, 12, 0, 7); x.fill(); x.fillStyle = x.fillStyle; x.clearRect(31, 26, 2, 38); x.clearRect(63, 26, 2, 38); });
      const nm = new THREE.Mesh(new THREE.PlaneGeometry(1.35, .8), new THREE.MeshStandardMaterial({ map: nor, transparent: true, side: THREE.DoubleSide })); nm.position.set(0, 1.85, d / 2 + .16); g.add(nm);
      if (n % 2 === 0) { const lm = mcache.get('chochin') || (mcache.set('chochin', new THREE.MeshStandardMaterial({ color: '#e04a2a', emissive: '#ff8a3a', emissiveIntensity: 0, roughness: .6 })), mcache.get('chochin')); if (!ISL.nightMats.includes(lm)) ISL.nightMats.push(lm); for (const sx of [-1, 1]) { const s = LH.sphere(g, .2, lm, sx * .95, 2.35, d / 2 + .35, 1.5); LH.box(g, .02, .25, .02, M('#222'), sx * .95, 2.6, d / 2 + .35); } }
      return { h: h + 1.6, interior: 'machiya', trim: '#2a1c12' };
    },
    // 리스본 알파마: 좁고 높은 집, 아줄레주 타일 또는 파스텔 벽, 흰 석회암 창틀, 작은 철제 발코니, 테라코타 지붕
    lisbon(g, w, d, r, n) {
      const fl = 3 + (r() < .5 ? 1 : 0), uh = 2.9, h = fl * uh, bays = 2, kind = n % 5;
      const wall = ['azul', '#e5b04a', '#e9a6a1', 'azul2', '#f2ead8'][kind], shopN = r() < .5 ? SHOPS.lisbon[n % SHOPS.lisbon.length] : null;
      const f = facadeMat(`lis|${w}|${fl}|${kind}|${shopN}`, w, h, P => {
        if (wall.startsWith('azul')) {
          P.rect(0, 0, w, h, '#f6f3ec'); const s = .15, c1 = wall === 'azul' ? '#2a5ea8' : '#2f7a5a', c2 = wall === 'azul' ? '#e2a33a' : '#f2d36b';
          for (let y = .8; y < h; y += s) for (let x = 0; x < w; x += s) { const i = Math.round(x / s), j = Math.round(y / s); P.rect(x + .005, y + .005, s - .01, s - .01, (i + j) % 2 ? '#f8f6f0' : '#eef0f2'); if ((i + j) % 2 === 0) { P.rect(x + s * .3, y + s * .3, s * .4, s * .4, c1); } else if (i % 2 === 0 && j % 2 === 0) P.rect(x + s * .42, y + s * .42, s * .16, s * .16, c2); }
        } else { P.rect(0, 0, w, h, wall); P.noise('#6a5a40', .1, 1400); for (let i = 0; i < 6; i++) P.rect(P.r() * w, P.r() * h * .4, .4 + P.r(), .2 + P.r() * .6, 'rgba(90,70,40,.08)'); }
        P.rect(0, 0, w, .8, '#d9d2c3'); P.rect(0, 0, .25, h, '#f4f0e8'); P.rect(w - .25, 0, .25, h, '#f4f0e8');
        const frame = ['#2f5a3a', '#5a3a28', '#f4f0e8', '#2a4a6b'][n % 4];
        for (let k = 0; k < fl; k++) for (let b = 0; b < bays; b++) {
          const cx = (b + .5) * w / bays; if (k === 0 && b === 0) continue;
          P.window({ cx, y0: k * uh + (k ? .25 : .9), w: .95, h: k ? 1.9 : 1.4, frame, surround: '#f4f0e8', sw: .16, cap: .1, bars: [2, 3], curtain: P.r() < .5 ? 'rgba(250,245,235,.6)' : null });
        }
        P.doorway(w * .25, 1.1, 2.3, '#f4f0e8');
        if (shopN) { P.rect(w * .25 - .9, 2.45, 1.8, .38, '#2a2a2a'); P.text(shopN, w * .25, 2.64, .22, '#f2d36b'); }
        P.rect(0, h - .25, w, .25, '#f4f0e8');
      });
      const side = M(wall.startsWith('azul') ? '#f2efe6' : wall);
      const lcol = wall.startsWith('azul') ? '#f2efe6' : wall, lb = Array.from({ length: fl }, (_, k) => k * uh + .8), lo = { frame: '#2f5a3a', surround: '#f4f0e8', base: '#d9d2c3', top: '#f4f0e8', bay: 2.8 }, ls = rearMat('lis' + kind + fl, d, h, lcol, lb, lo);
      LH.mesh(g, new THREE.BoxGeometry(w, h, d), [ls, ls, M('#555'), M('#555'), f, rearMat('lis' + kind + fl, w, h, lcol, lb, lo)], 0, h / 2, 0);
      for (let k = 1; k < fl; k++) { const cx = w * .25 - w / 2 + w / 2; for (const b of [0, 1]) { const x = (b + .5) * w / 2 - w / 2; LH.box(g, 1.35, .08, .5, M('#e9e4d8'), x, k * uh + .2, d / 2 + .25); railing(g, 1.3, x, k * uh + .28, d / 2 + .48, 0, .85); } }
      LH.mesh(g, LH.hipGeo(w, d, 1.6, .5), ISL.roofMat('#c25a32', 'tile'), 0, h, 0);
      LH.box(g, w + .1, .2, d + .1, M('#f4f0e8'), 0, h - .2, 0);
      if (n % 3 === 0) { LH.box(g, .06, .06, .6, M('#1d1d1d'), w / 2 - .6, 3.4, d / 2 + .3); const lm = streetLampMat(); LH.box(g, .28, .4, .28, lm, w / 2 - .6, 3.05, d / 2 + .6); }
      return { h: h + 1.6, interior: 'pt', door: -w / 4, trim: '#f4f0e8' };
    },
    // 레이캬비크: 골함석 집, 흰 창틀, 붉고 검은 금속 지붕
    reyk(g, w, d, r, n) {
      const fl = 2 + (r() < .4 ? 1 : 0), uh = 2.8, h = fl * uh, col = ['#c0392b', '#2e6f9e', '#e6b422', '#f4f1ea', '#3e7c5a', '#8e5aa8', '#d9733a'][n % 7];
      const shopN = r() < .6 ? SHOPS.reyk[n % SHOPS.reyk.length] : null, bays = Math.max(2, Math.round(w / 2.6));
      const f = facadeMat(`rey|${w}|${fl}|${col}|${shopN}`, w, h, P => {
        P.rect(0, 0, w, h, col); for (let x = 0; x < w; x += .076) P.rect(x, .5, .032, h, 'rgba(0,0,0,.09)');
        P.rect(0, 0, w, .5, '#8d8f90');
        for (let k = 0; k < fl; k++) for (let b = 0; b < bays; b++) {
          const cx = (b + .5) * w / bays; if (k === 0 && Math.abs(cx - w / 2) < w / bays * .5) continue;
          if (k === 0 && shopN) P.window({ cx, y0: .6, w: w / bays * .7, h: 1.8, frame: '#ffffff', bars: [1, 1], glassTop: '#c9d8e2' });
          else { P.window({ cx, y0: k * uh + .8, w: 1.05, h: 1.3, frame: '#ffffff', bars: [2, 2], fw: .08, curtain: P.r() < .4 ? 'rgba(255,255,255,.5)' : null });
            for (let q = 0; q < 7; q++) { const px = cx - .33 + q * .11, py = k * uh + .92 + (.2 - Math.abs(q - 3) * .055); P.rect(px - .012, k * uh + .9, .024, py - k * uh - .9, '#f4f0e8'); P.x.fillStyle = '#ffd86a'; P.x.beginPath(); P.x.arc(P.X(px), P.Y(py + .03), P.S(.035), 0, 7); P.x.fill(); } } // 창가의 일곱 촛불(아드벤트 촛대)
        }
        P.doorway(w / 2, 1.1, 2.25, '#ffffff');
        if (shopN) { P.rect(w / 2 - 1.3, 2.55, 2.6, .4, '#f4f1ea'); P.text(shopN, w / 2, 2.75, .26, '#2a2a2a'); }
      });
      const side = M(col);
      const rb = Array.from({ length: fl }, (_, k) => k * uh + .8), ro = { frame: '#ffffff', corr: 1, base: '#8d8f90', baseH: .5, wh: 1.3, ww: 1.05, bars: [2, 2], bay: 2.8, noise: '#333' }, rs = rearMat('rey' + col + fl, d, h, col, rb, ro);
      LH.mesh(g, new THREE.BoxGeometry(w, h, d), [rs, rs, M('#555'), M('#555'), f, rearMat('rey' + col + fl, w, h, col, rb, ro)], 0, h / 2, 0);
      const roof = ISL.roofMat(['#b03a2e', '#2b2f36', '#2f5d50'][n % 3], 'metal');
      LH.mesh(g, LH.gableGeo(d, w + .1, 2.6, .45), roof, 0, h, 0, Math.PI / 2);
      LH.mesh(g, LH.gableGeo(d - .5, w + .12, 2.5, .28), M('#f4f7fa', { roughness: 1 }), 0, h + .16, 0, Math.PI / 2); // 지붕에 쌓인 눈
      { const wr = new THREE.Mesh(new THREE.TorusGeometry(.26, .09, 6, 14), M('#1f5a2c')); wr.position.set(1.15, 1.7, d / 2 + .06); g.add(wr); LH.box(g, .2, .12, .05, M('#c0392b'), 1.15, 1.38, d / 2 + .12); } // 문 옆 리스
      { const N2 = Math.floor(w / .45), lg = new THREE.SphereGeometry(.06, 5, 4), im = new THREE.InstancedMesh(lg, xmasMat(), N2), mt = new THREE.Matrix4(), cc = new THREE.Color(); for (let q = 0; q < N2; q++) { mt.makeTranslation(-w / 2 + (q + .5) * w / N2, h - .12 - Math.abs(Math.sin(q * 1.57)) * .12, d / 2 + .3); im.setMatrixAt(q, mt); im.setColorAt(q, cc.set(XCOL[q % XCOL.length])); } g.add(im); im.userData.dynamic = true; } // 처마 전구
      if (r() < .5) { LH.box(g, 1.3, 1.2, 1.4, side, 0, h + .2, d / 2 - 1.2); LH.mesh(g, LH.gableGeo(1.4, 1.6, .6, .1), roof, 0, h + 1.4, d / 2 - 1.2); LH.box(g, .8, .8, .04, M('#2f3a44'), 0, h + .4, d / 2 - .48); }
      LH.box(g, .5, 1.6, .5, M('#e8e4dc'), w / 2 - 1.2, h + .8, -d / 4);
      return { h: h + 2.6, interior: 'is', trim: '#ffffff' };
    },
    // 루체른 구시가지: 프레스코 벽화, 회색 돌 창틀, 녹색 덧창, 제라늄 꽃상자, 박공이 거리를 향함, 돌출창(에르커)
    luzern(g, w, d, r, n) {
      const fl = 4, uh = 2.85, h = fl * uh, bays = 3, base = ['#e8c98a', '#e7b7a4', '#cfe0c4', '#f2ecdc', '#d9c4e0'][n % 5], shopN = SHOPS.luzern[n % SHOPS.luzern.length];
      const f = facadeMat(`luz|${w}|${n % 10}`, w, h, P => {
        P.rect(0, 0, w, h, base); P.noise('#7a6a50', .08, 1000);
        for (let y = 0; y < h; y += .55) { P.rect(0, y, .45, .5, 'rgba(110,110,105,.55)'); P.rect(w - .45, y, .45, .5, 'rgba(110,110,105,.55)'); }
        P.rect(0, 0, w, uh, '#bdb5a5'); P.rect(.4, .3, w - .8, 2.2, '#3a3028');
        P.window({ cx: w * .22, y0: .6, w: 1.5, h: 1.7, frame: '#5a4636', bars: [3, 2], shadow: false }); P.window({ cx: w * .78, y0: .6, w: 1.5, h: 1.7, frame: '#5a4636', bars: [3, 2], shadow: false });
        P.rect(w / 2 - 1.5, 2.45, 3, .4, '#2a2a2a'); P.text(shopN, w / 2, 2.65, .26, '#e8c76a');
        P.doorway(w / 2, 1.2, 2.25, '#8f8778');
        // 벽화: 창 사이 장식 틀과 인물
        for (let k = 1; k < fl; k++) {
          P.rect(0, k * uh - .05, w, .14, 'rgba(90,80,60,.6)');
          for (let b = 0; b < bays - 1; b++) {
            const cx = (b + 1) * w / bays, y = k * uh + .45;
            P.rect(cx - .55, y, 1.1, 1.8, '#f4ead2'); P.x.strokeStyle = '#7a3a2a'; P.x.lineWidth = 3; P.x.strokeRect(P.X(cx - .5), P.Y(y + 1.75), P.S(1), P.S(1.7));
            const robe = ['#a8302a', '#2a5a8a', '#3a7a4a', '#c9a24a'][(n + k + b) % 4];
            P.rect(cx - .2, y + .2, .4, .9, robe); P.x.fillStyle = '#e9c9a8'; P.x.beginPath(); P.x.arc(P.X(cx), P.Y(y + 1.3), P.S(.14), 0, 7); P.x.fill();
            P.rect(cx - .45, y + 1.5, .9, .14, '#c9a24a');
          }
          for (let b = 0; b < bays; b++) P.window({ cx: (b + .5) * w / bays, y0: k * uh + .55, w: .95, h: 1.55, frame: '#f4f0e8', surround: '#9a958a', sw: .14, cap: .12, bars: [2, 3], shutter: '#2f6b48' });
        }
      });
      const side = M(base);
      const zb = Array.from({ length: fl }, (_, k) => k * uh + .6), zo = { frame: '#f4f0e8', surround: '#9a958a', shutter: '#2f6b48', base: '#bdb5a5', baseH: .9, wh: 1.55 }, zs = rearMat('luz' + base, d, h, base, zb, zo);
      LH.mesh(g, new THREE.BoxGeometry(w, h, d), [zs, zs, M('#555'), M('#555'), f, rearMat('luz' + base, w, h, base, zb, zo)], 0, h / 2, 0);
      const roof = ISL.roofMat('#8a4b35', 'tile');
      LH.mesh(g, LH.gableGeo(w, d, 4.6, .55), roof, 0, h, 0);
      const tri = new THREE.Shape(); tri.moveTo(-w / 2, 0); tri.lineTo(w / 2, 0); tri.lineTo(0, 4.5);
      const tg = new THREE.Mesh(new THREE.ShapeGeometry(tri), side); tg.position.set(0, h, d / 2 + .01); g.add(tg);
      LH.box(g, .9, 1.1, .05, M('#2f3a44'), 0, h + 1.2, d / 2 + .02); LH.box(g, 1.05, .1, .1, M('#f4f0e8'), 0, h + 1.15, d / 2 + .04);
      for (let k = 1; k < fl; k++) for (let b = 0; b < bays; b++) { const x = (b + .5) * w / bays - w / 2; LH.box(g, 1.1, .22, .28, M('#6b4226'), x, k * uh + .3, d / 2 + .15); for (let q = 0; q < 5; q++) LH.sphere(g, .1, M(['#d9333c', '#e8423a', '#c91f2a'][q % 3]), x - .44 + q * .22, k * uh + .58, d / 2 + .18); }
      if (n % 3 === 1) { // 에르커(돌출창)
        const eg = facadeMat('erker', 2.2, 5.5, P => { P.rect(0, 0, 2.2, 5.5, base); for (const y of [.5, 3.3]) P.window({ cx: 1.1, y0: y, w: 1.4, h: 1.7, frame: '#f4f0e8', bars: [3, 3] }); });
        LH.mesh(g, new THREE.BoxGeometry(2.2, 5.5, .8), [side, side, M('#6b4226'), M('#6b4226'), eg, side], 0, uh + .1 + 2.75, d / 2 + .4);
        LH.mesh(g, LH.hipGeo(2.2, .8, .7, .1), roof, 0, uh + 5.6, d / 2 + .4);
      }
      if (n % 4 === 0) { LH.cyl(g, .03, .03, 2.2, 6, M('#ddd'), w / 2 - 1, uh + .5, d / 2 + .2).rotation.x = .9; const fgp = new THREE.Group(); fgp.position.set(w / 2 - 1, uh + 1.7, d / 2 + 1.6); g.add(fgp); LH.box(fgp, .02, .9, .9, M('#d52b1e'), 0, -.9, 0); LH.box(fgp, .03, .55, .17, M('#fff'), 0, -.63, 0); LH.box(fgp, .03, .17, .55, M('#fff'), 0, -.45, 0); }
      return { h: h + 4.6, interior: 'ch', trim: '#8f8778' };
    },
  };
  const XCOL = ['#ff4a3a', '#ffd23a', '#3ad26a', '#3a8aff', '#ff7ad0', '#fff2c0'];
  let xm = null; const xmasMat = () => xm || (xm = new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  // 줄 전구: 두 점 사이에 늘어진 줄 + 색 전구
  function lightString(a, b, sag, n) {
    const pts = [], im = new THREE.InstancedMesh(new THREE.SphereGeometry(.09, 6, 4), xmasMat(), n), mt = new THREE.Matrix4(), cc = new THREE.Color();
    for (let i = 0; i <= n; i++) { const t = i / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, z = a[2] + (b[2] - a[2]) * t; pts.push(x, y, z); if (i < n) { mt.makeTranslation(x, y - .1, z); im.setMatrixAt(i, mt); im.setColorAt(i, cc.set(XCOL[i % XCOL.length])); } }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); scene.add(new THREE.Line(lg, new THREE.LineBasicMaterial({ color: '#1e2a1e' }))); im.userData.dynamic = true; im.frustumCulled = false; scene.add(im);
  }
  // 크리스마스 트리 (오슬로 트리처럼 광장에 선 큰 전나무): 층층 가지 + 눈 + 전구 + 별
  function xmasTree(x, z, hgt) {
    const y = H(x, z), g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
    LH.cyl(g, .22, .3, hgt * .12, 8, M('#4e3a2c'), 0, 0, 0);
    const n = 9; for (let i = 0; i < n; i++) { const t = i / (n - 1), r = hgt * .3 * (1 - t * .92), yy = hgt * .1 + t * hgt * .82; LH.cone(g, r, hgt * .2, 12, M('#1f4a2c'), 0, yy, 0); LH.cone(g, r * .93, hgt * .2 * .5, 12, M('#f2f6f8', { roughness: 1 }), 0, yy + hgt * .105, 0); }
    const N2 = 160, im = new THREE.InstancedMesh(new THREE.SphereGeometry(.11, 6, 4), xmasMat(), N2), mt = new THREE.Matrix4(), cc = new THREE.Color();
    for (let i = 0; i < N2; i++) { const t = i / N2, a = t * 38, r = hgt * .3 * (1 - t * .9) * .92, yy = hgt * .14 + t * hgt * .84; mt.makeTranslation(Math.cos(a) * r, yy, Math.sin(a) * r); im.setMatrixAt(i, mt); im.setColorAt(i, cc.set(XCOL[i % XCOL.length])); }
    im.userData.dynamic = true; g.add(im);
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(.5, 0), new THREE.MeshBasicMaterial({ color: '#ffe680' })); star.position.y = hgt * 1.07; star.scale.set(1, 1.5, .4); star.userData.dynamic = true; g.add(star);
    ISL.colCircle(x, z, hgt * .12, y - 1, y + 4);
    for (const [ox, oz, s] of [[hgt * .3, 2, 1], [-hgt * .3, 1.5, .8], [1, hgt * .32, .9]]) { const px = x + ox, pz = z + oz, py = H(px, pz); LH.box(scene, s, s * .8, s, M(['#c0392b', '#2e6f9e', '#e6b422'][Math.round(s * 10) % 3]), px, py, pz); LH.box(scene, s + .02, s * .82, .14, M('#f4f1ea'), px, py, pz); ISL.colCircle(px, pz, s * .6, py - 1, py + 1); }
  }
  // 불빛이 바닥에 번지는 따뜻한 원 (밤에만 보임)
  let glowM = null;
  function glowPool(x, z, r) {
    if (!glowM) { const c = cv(64, 64), k = c.getContext('2d'), gr = k.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(255,200,120,1)'); gr.addColorStop(1, 'rgba(255,200,120,0)'); k.fillStyle = gr; k.fillRect(0, 0, 64, 64);
      glowM = new THREE.MeshBasicMaterial({ map: ctex(c), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }); (ISL.glowMats = ISL.glowMats || []).push(glowM); }
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 20), glowM); m.rotation.x = -Math.PI / 2; m.position.set(x, H(x, z) + .28, z); m.userData.dynamic = true; scene.add(m);
  }
  const warmM = () => mcache.get('warmglow') || (mcache.set('warmglow', new THREE.MeshBasicMaterial({ color: '#ffd9a0' })), mcache.get('warmglow'));
  // 마켓 오두막: 통나무 벽, 열린 판매대, 눈 쌓인 박공지붕, 전나무 가랜드와 전구, 별 등
  function stall(x, z, ry, goods, n) {
    const y = H(x, z), g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g); const wood = M('#7a5232'), dark = M('#5a3b22');
    LH.box(g, 3.4, .12, 2.4, dark, 0, 0, 0); LH.box(g, 3.4, 2.5, .1, wood, 0, 0, -1.15); for (const sx of [-1, 1]) LH.box(g, .1, 2.5, 2.3, wood, sx * 1.65, 0, 0);
    LH.box(g, 3.4, .95, .12, wood, 0, 0, 1.1); LH.box(g, 3.6, .08, .6, dark, 0, .95, 1.15);
    for (const sx of [-1, 1]) LH.box(g, .12, 2.5, .12, dark, sx * 1.65, 0, 1.1);
    LH.mesh(g, LH.gableGeo(3.5, 2.6, .95, .35), dark, 0, 2.5, 0); LH.mesh(g, LH.gableGeo(3.3, 2.7, .9, .22), M('#f4f7fa', { roughness: 1 }), 0, 2.62, 0);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 1.4), warmM()); glow.position.set(0, 1.75, -1.08); g.add(glow); // 안쪽 따뜻한 불빛
    for (let i = 0; i < 9; i++) { const c = goods[(i + n) % goods.length]; if (i % 3 === 0) LH.cyl(g, .1, .12, .28, 8, M(c), -1.3 + i * .32, 1.03, 1.15); else LH.box(g, .2, .16 + (i % 2) * .1, .2, M(c), -1.3 + i * .32, 1.03, 1.15); }
    for (let i = 0; i < 5; i++) LH.box(g, .5, .32, .3, M(goods[(i + n + 2) % goods.length]), -1.2 + i * .6, 1.5, -.95);
    LH.box(g, 3.5, .18, .16, M('#1f5a2c'), 0, 2.36, 1.14);
    const N2 = 12, im = new THREE.InstancedMesh(new THREE.SphereGeometry(.05, 5, 4), xmasMat(), N2), mt = new THREE.Matrix4(), cc = new THREE.Color('#ffd9a0'); for (let i = 0; i < N2; i++) { mt.makeTranslation(-1.6 + i * 3.2 / (N2 - 1), 2.3 - Math.abs(Math.sin(i * .9)) * .1, 1.24); im.setMatrixAt(i, mt); im.setColorAt(i, cc); } im.userData.dynamic = true; g.add(im);
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(.22, 0), new THREE.MeshBasicMaterial({ color: '#ffe9a8' })); star.position.set(0, 2.05, 1.05); star.scale.set(1, 1.3, .35); star.userData.dynamic = true; g.add(star);
    ISL.colBox(g, 0, 0, 3.5, 2.5, 3.4, { kind: 'stall' }); glowPool(x + Math.sin(ry) * 2.6, z + Math.cos(ry) * 2.6, 4.2);
  }
  // 전구를 감은 겨울 나무 (잎 없는 가지 + 따뜻한 흰 전구)
  function lightTree(x, z) {
    const y = H(x, z), g = new THREE.Group(); g.position.set(x, y, z); scene.add(g); const bark = M('#3a2e26'), r = ISL.mulberry32(Math.floor(x * 31 + z * 17));
    LH.cyl(g, .1, .16, 2.4, 6, bark, 0, 0, 0); const tips = [];
    for (let i = 0; i < 7; i++) { const a = i * .9 + r(), el = .5 + r() * .5, len = 1.6 + r() * 1.2, b = new THREE.Mesh(new THREE.CylinderGeometry(.025, .06, len, 5), bark); const dx = Math.cos(a) * Math.cos(el), dy = Math.sin(el), dz = Math.sin(a) * Math.cos(el); b.position.set(dx * len / 2, 2.2 + dy * len / 2, dz * len / 2); b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz)); g.add(b); for (let k = 1; k <= 9; k++) tips.push([dx * len * k / 9 + (r() - .5) * .12, 2.2 + dy * len * k / 9, dz * len * k / 9 + (r() - .5) * .12]); }
    for (let k = 0; k < 10; k++) tips.push([Math.cos(k * 1.9) * .13, .4 + k * .2, Math.sin(k * 1.9) * .13]);
    const im = new THREE.InstancedMesh(new THREE.SphereGeometry(.045, 5, 4), xmasMat(), tips.length), mt = new THREE.Matrix4(), cc = new THREE.Color('#ffe2b0'); tips.forEach((p, i) => { mt.makeTranslation(p[0], p[1], p[2]); im.setMatrixAt(i, mt); im.setColorAt(i, cc); }); im.userData.dynamic = true; g.add(im);
    ISL.colCircle(x, z, .2, y - 1, y + 3);
  }
  function snowman(x, z) {
    const y = H(x, z), g = new THREE.Group(); g.position.set(x, y, z); scene.add(g); const w = M('#f6f8fa', { roughness: 1 });
    LH.sphere(g, .55, w, 0, .5, 0); LH.sphere(g, .4, w, 0, 1.25, 0); LH.sphere(g, .28, w, 0, 1.82, 0);
    const nose = LH.cone(g, .05, .28, 6, M('#e8761e'), 0, 1.8, .3); nose.rotation.x = Math.PI / 2; nose.position.set(0, 1.84, .36);
    for (const sx of [-1, 1]) LH.sphere(g, .035, M('#1a1a1a'), sx * .1, 1.92, .25); LH.cyl(g, .3, .3, .04, 12, M('#1a1a1a'), 0, 2.04, 0); LH.cyl(g, .19, .19, .28, 12, M('#1a1a1a'), 0, 2.06, 0);
    const sc = new THREE.Mesh(new THREE.TorusGeometry(.26, .07, 6, 12), M('#c0392b')); sc.rotation.x = Math.PI / 2; sc.position.y = 1.58; g.add(sc);
    ISL.colCircle(x, z, .55, y - 1, y + 2);
  }
  let lampMat = null;
  function streetLampMat() { if (!lampMat) { lampMat = new THREE.MeshStandardMaterial({ color: '#fff2c8', emissive: '#ffd890', emissiveIntensity: 0, roughness: .3 }); ISL.nightMats.push(lampMat); } return lampMat; }

  // ---------- 도로 표면 ----------
  const ROADS = {
    paris: { road: (x, w, h, r) => { x.fillStyle = '#4a4b50'; x.fillRect(0, 0, w, h); for (let i = 0; i < 3000; i++) { x.fillStyle = `rgba(${r() < .5 ? 0 : 255},${r() < .5 ? 0 : 255},${r() < .5 ? 0 : 255},.05)`; x.fillRect(r() * w, r() * h, 2, 2); } x.fillStyle = '#e9e6dc'; for (let y = 0; y < h; y += 64) x.fillRect(w / 2 - 2, y, 4, 34); },
             walk: (x, w, h, r) => { x.fillStyle = '#bdb7ab'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(80,70,60,.25)'; for (let y = 0; y < h; y += 32) x.fillRect(0, y, w, 2); for (let y = 0; y < h; y += 32) for (let xx = (y / 32) % 2 * 24; xx < w; xx += 48) x.fillRect(xx, y, 2, 32); }, curb: '#8e8a84' },
    kyoto: { road: (x, w, h, r) => { x.fillStyle = '#5c5a56'; x.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 22) for (let xx = ((y / 22) % 2) * 20; xx < w; xx += 42) { const c = 98 + r() * 34; x.fillStyle = `rgb(${c},${c - 2},${c - 5})`; x.fillRect(xx + 2, y + 2, 38, 18); } x.fillStyle = '#3f3d3a'; x.fillRect(0, 0, 10, h); x.fillRect(w - 10, 0, 10, h); }, walk: null, curb: '#6b6862' },
    lisbon: { road: (x, w, h, r) => { x.fillStyle = '#efeadd'; x.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 5) for (let xx = (y % 10) ? 2 : 0; xx < w; xx += 5) { x.fillStyle = `rgba(0,0,0,${.05 + r() * .06})`; x.fillRect(xx, y, 4, 4); } x.fillStyle = '#2b2b2b'; for (let k = 0; k < 3; k++) for (let y = 0; y < h; y += 2) { const xx = w * (.2 + k * .3) + Math.sin(y / h * Math.PI * 4) * w * .08; x.fillRect(xx, y, 9, 2); } }, walk: (x, w, h, r) => { x.fillStyle = '#e6dfcf'; x.fillRect(0, 0, w, h); for (let i = 0; i < 1500; i++) { x.fillStyle = 'rgba(0,0,0,.07)'; x.fillRect(r() * w, r() * h, 3, 3); } }, curb: '#d8d1c0' },
    reyk: { road: (x, w, h) => { const cols = ['#e63b3b', '#f08a2b', '#f5d33a', '#4dbb5a', '#3a7ad9', '#8a52c9']; for (let i = 0; i < 6; i++) { x.fillStyle = cols[i]; x.fillRect(i * w / 6, 0, w / 6 + 1, h); } x.fillStyle = 'rgba(0,0,0,.06)'; for (let y = 0; y < h; y += 8) x.fillRect(0, y, w, 1); for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(255,255,255,${.25 + Math.random() * .5})`; x.beginPath(); x.ellipse(Math.random() * w, Math.random() * h, 1 + Math.random() * 5, 1 + Math.random() * 3, 0, 0, 7); x.fill(); } }, walk: (x, w, h, r) => { x.fillStyle = '#eef2f6'; x.fillRect(0, 0, w, h); for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(150,170,195,${r() * .18})`; x.beginPath(); x.ellipse(r() * w, r() * h, 2 + r() * 7, 2 + r() * 4, r() * 3, 0, 7); x.fill(); } }, curb: '#dfe6ec' }, // 눈 쌓인 인도
    luzern: { road: (x, w, h, r) => { x.fillStyle = '#6a6762'; x.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 9) for (let xx = (y / 9 % 2) * 5; xx < w; xx += 10) { const c = 120 + r() * 50; x.fillStyle = `rgb(${c},${c - 4},${c - 10})`; x.beginPath(); x.ellipse(xx + 4.5, y + 4.5, 4.2, 3.8, 0, 0, 7); x.fill(); } }, walk: (x, w, h, r) => { x.fillStyle = '#a49e94'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(0,0,0,.15)'; for (let y = 0; y < h; y += 40) x.fillRect(0, y, w, 2); }, curb: '#8a857c' },
  };
  // 땅을 따라 깔리는 띠 (도로·인도). o0~o1: 중심선에서의 가로 거리, lift: 땅 위 높이
  function ribbon(s, o0, o1, lift, tex, tileLen, opts = {}) {
    const N = Math.ceil(s.len / 1.2), K = Math.max(2, Math.ceil(Math.abs(o1 - o0) / 1.2) + 1), pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) { const t = i / N; for (let k = 0; k < K; k++) { const o = o0 + (o1 - o0) * k / (K - 1), x = s.ax + s.ux * s.len * t + s.nx * o, z = s.az + s.uz * s.len * t + s.nz * o; pos.push(x, H(x, z) + lift, z); uv.push(k / (K - 1), s.len * t / tileLen); } }
    for (let i = 0; i < N; i++) for (let k = 0; k < K - 1; k++) { const a = i * K + k, b = (i + 1) * K + k; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    if (o1 < o0) g.index.array.reverse();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: opts.rough || .9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); m.receiveShadow = true; scene.add(m); return m;
  }
  function curb(s, o, lift, col) {
    const N = Math.ceil(s.len / 1.2), pos = [], idx = [];
    for (let i = 0; i <= N; i++) { const t = i / N, x = s.ax + s.ux * s.len * t + s.nx * o, z = s.az + s.uz * s.len * t + s.nz * o, y = H(x, z); pos.push(x, y - .05, z, x, y + lift, z); if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: col, roughness: .8, side: THREE.DoubleSide })));
  }

  // ---------- 거리 소품 ----------
  function lamp(x, z, kind) {
    const y = H(x, z) + .2, g = new THREE.Group(); g.position.set(x, y, z); scene.add(g); const L = streetLampMat();
    if (kind === 'paris') { LH.cyl(g, .07, .12, 4, 10, M('#1f3328'), 0, 0, 0); LH.cyl(g, .16, .2, .5, 10, M('#1f3328'), 0, 0, 0); LH.box(g, .38, .5, .38, L, 0, 4, 0); LH.cone(g, .3, .35, 4, M('#1f3328'), 0, 4.5, 0, Math.PI / 4); }
    else if (kind === 'kyoto') { LH.box(g, .1, 2.2, .1, M('#3b2a1d'), 0, 0, 0); LH.box(g, .36, .6, .36, M('#f2ead2', { emissive: '#ffcf8a', emissiveIntensity: .3 }), 0, 2.2, 0); LH.cone(g, .32, .2, 4, M('#2f3036'), 0, 2.8, 0, Math.PI / 4); }
    else { LH.cyl(g, .06, .08, 4.6, 8, M('#2b2b2b'), 0, 0, 0); LH.box(g, .3, .4, .3, L, 0, 4.6, 0); LH.cone(g, .25, .25, 4, M('#2b2b2b'), 0, 5, 0, Math.PI / 4); }
    ISL.colCircle(x, z, .15, y - 1, y + 4); glowPool(x, z, kind === 'kyoto' ? 3.5 : 6);
  }
  function cafe(x, z, ry) {
    const y = H(x, z) + .2, g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g);
    LH.cyl(g, .35, .35, .04, 16, M('#d8d2c4'), 0, .72, 0); LH.cyl(g, .03, .03, .72, 6, M('#2a2a2a'), 0, 0, 0); LH.cyl(g, .2, .2, .03, 12, M('#2a2a2a'), 0, 0, 0);
    LH.cyl(g, .04, .04, .06, 8, M('#f4f0e8'), .1, .76, .05); LH.cyl(g, .05, .04, .08, 8, M('#7a3a2a'), -.1, .76, -.05);
    for (const a of [Math.PI / 2, -Math.PI / 2]) { const c = new THREE.Group(); c.position.set(Math.sin(a) * .62, 0, Math.cos(a) * .62); c.rotation.y = a + Math.PI; g.add(c); LH.box(c, .42, .05, .42, M('#b8925a'), 0, .44, 0); LH.box(c, .42, .45, .05, M('#b8925a'), 0, .46, -.2); for (const sx of [-1, 1]) for (const sz of [-1, 1]) LH.box(c, .03, .44, .03, M('#2a2a2a'), sx * .18, 0, sz * .18); }
    ISL.colCircle(x, z, .9, y - 1, y + 1);
  }
  function utilityPoles(s, side) {
    const pts = [];
    for (let t = 6; t < s.len; t += 17) { const o = side * (s.road + .35), x = s.ax + s.ux * t + s.nx * o, z = s.az + s.uz * t + s.nz * o, y = H(x, z); const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g); LH.cyl(g, .13, .17, 9, 10, M('#9a9890'), 0, 0, 0); const arm = LH.box(g, 1.6, .1, .1, M('#7a7870'), 0, 7.6, 0); arm.rotation.y = Math.atan2(s.nx, s.nz); LH.cyl(g, .22, .22, .7, 10, M('#8a8c88'), .3, 6.4, 0); ISL.colCircle(x, z, .2, y - 1, y + 9); pts.push([x, y, z]); }
    const lp = [];
    for (let i = 1; i < pts.length; i++) for (const [dy, off] of [[7.65, -.6], [7.65, .6], [6.9, 0]]) { const [x0, y0, z0] = pts[i - 1], [x1, y1, z1] = pts[i]; const ox = s.nx * off, oz = s.nz * off; for (let k = 0; k < 8; k++) { const a = k / 8, b = (k + 1) / 8, sag = q => Math.sin(q * Math.PI) * .6; lp.push(x0 + (x1 - x0) * a + ox, y0 + (y1 - y0) * a + dy - sag(a), z0 + (z1 - z0) * a + oz, x0 + (x1 - x0) * b + ox, y0 + (y1 - y0) * b + dy - sag(b), z0 + (z1 - z0) * b + oz); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#1e1e1e' })));
  }
  function vending(x, z, ry) {
    const y = H(x, z) + .05, g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g);
    const face = facadeMat('vend', 1, 1.8, P => { P.rect(0, 0, 1, 1.8, '#f4f4f4'); P.rect(.08, .9, .84, .8, '#d8eef8'); for (let j = 0; j < 3; j++) for (let i = 0; i < 6; i++) P.rect(.1 + i * .135, .95 + j * .26, .09, .2, ['#c0392b', '#2e6f9e', '#e6b422', '#3e7c5a', '#f08a2b', '#8e44ad'][(i + j) % 6]); P.rect(.1, .2, .8, .3, '#222'); P.window({ cx: .5, y0: .92, w: .82, h: .76, glassTop: 'rgba(255,255,255,.1)', glass: 'rgba(255,255,255,.05)', glassBot: 'rgba(255,255,255,.0)', frame: '#d8d8d8', bars: [1, 1], shadow: false }); });
    const s = M('#e8e8e8'); LH.mesh(g, new THREE.BoxGeometry(1, 1.8, .75), [s, s, s, s, face, s], 0, .9, 0); ISL.colCircle(x, z, .5, y - 1, y + 2);
  }
  function laundry(s, t, y, rr) {
    const o = s.road + s.walk, a = [s.ax + s.ux * t + s.nx * -o, s.az + s.uz * t + s.nz * -o], b = [s.ax + s.ux * t + s.nx * o, s.az + s.uz * t + s.nz * o];
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([a[0], y, a[1], b[0], y, b[1]], 3)); scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#dddddd' })));
    for (let k = 1; k < 7; k++) { if (rr() < .3) continue; const f = k / 7, x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f; const c = new THREE.Mesh(new THREE.PlaneGeometry(.45 + rr() * .3, .5 + rr() * .4), new THREE.MeshStandardMaterial({ color: ['#e74c3c', '#f1c40f', '#ffffff', '#3498db', '#2ecc71', '#f39c12'][Math.floor(rr() * 6)], side: THREE.DoubleSide })); c.position.set(x, y - .32, z); c.rotation.y = Math.atan2(s.ux, s.uz) + Math.PI / 2; scene.add(c); }
  }
  function fountain(x, z, kind) {
    const y = H(x, z), g = new THREE.Group(); g.position.set(x, y, z); scene.add(g); const st = ISL.blockMat('#a8a296', .6, .3);
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.3, .8, 8), st); basin.position.y = .4; g.add(basin);
    const wat = new THREE.Mesh(new THREE.CircleGeometry(2, 8), new THREE.MeshStandardMaterial({ color: '#4f8fa0', roughness: .1, metalness: .2 })); wat.rotation.x = -Math.PI / 2; wat.position.y = .72; g.add(wat);
    LH.cyl(g, .25, .3, 3.4, 8, st, 0, .8, 0); const fig = ISL.person(kind === 'luzern' ? { top: '#2a5a8a', bottom: '#2a5a8a', skin: '#e9c9a8', hair: '#5a3a28' } : { top: '#3f6b5a', bottom: '#3f6b5a', skin: '#3f6b5a', hair: '#3f6b5a' }); fig.g.position.y = 4.2; fig.armR.rotation.x = -2.4; g.add(fig.g);
    ISL.colCircle(x, z, 2.3, y - 1, y + 2);
  }
  function morris(x, z) {
    const y = H(x, z) + .2, g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
    const post = facadeMat('morris', 3.8, 2.4, P => { P.rect(0, 0, 3.8, 2.4, '#e8e0cc'); const cols = ['#c0392b', '#2e6f9e', '#e6b422', '#1f3328', '#8e44ad', '#d35400']; for (let i = 0; i < 6; i++) { P.rect(.05 + i * .63, .1, .58, 2.2, cols[i]); P.text(['THÉÂTRE', 'CINÉMA', 'OPÉRA', 'CONCERT', 'EXPO', 'BALLET'][i], .34 + i * .63, 1.6, .16, '#f4efe6'); P.rect(.15 + i * .63, .4, .38, .8, 'rgba(255,255,255,.4)'); } });
    LH.cyl(g, .62, .62, .5, 16, M('#1f3328'), 0, 0, 0); const body = new THREE.Mesh(new THREE.CylinderGeometry(.6, .6, 2.4, 20, 1, true), post); body.position.y = 1.7; g.add(body);
    LH.cyl(g, .68, .68, .15, 16, M('#1f3328'), 0, 2.9, 0); const dome = new THREE.Mesh(new THREE.SphereGeometry(.62, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M('#1f3328')); dome.position.y = 3.05; dome.scale.y = .8; g.add(dome); LH.cone(g, .1, .4, 8, M('#1f3328'), 0, 3.5, 0);
    ISL.colCircle(x, z, .7, y - 1, y + 3);
  }

  // ---------- 도시 계획: 나라마다 실제 도시 구조를 따름 ----------
  // 파리: 원형 광장에서 대로가 방사형으로 뻗는 에투알 / 교토: 바둑판 골목 / 리스본 알파마: 굽이치는 언덕길과 계단·전망대
  // 레이캬비크: 둥근 크리스마스 광장 + 띄엄띄엄 선 집들 / 루체른: 분수 광장에서 이어지는 구시가 골목
  const streets = [], plazas = []; ISL.streets = streets; ISL.paved = [];
  const DIM = { paris: { road: 5.5, walk: 4, depth: 13, widths: [9, 12, 15] }, kyoto: { road: 2.7, walk: 0, depth: 10, widths: [6.4, 7.2, 8] }, lisbon: { road: 3, walk: .9, depth: 10, widths: [5.6, 6.4, 7.2] },
    reyk: { road: 3.4, walk: 2.2, depth: 11, widths: [7, 8.5, 10] }, luzern: { road: 3.2, walk: 1.3, depth: 11, widths: [7.4, 8.2, 9] } };
  function plan() {
    const P = ISL.P, hall = P.hallgrim;
    const add = (id, style, a, b, o) => streets.push(Object.assign({ id, style, a, b }, DIM[style], o || {}));
    const plaza = (x, z, r, style, kind) => plazas.push({ x, z, r, style, kind });
    // 파리 에투알
    { const C = [-292, 142]; plaza(C[0], C[1], 43, 'paris', 'etoile'); let k = 0;
      for (const deg of [90, 150, 210, 270, 0]) { const a = deg * Math.PI / 180, L = deg === 0 ? 52 : 114; add(k ? 'paris_' + k : 'paris', 'paris', C, [C[0] + Math.cos(a) * L, C[1] + Math.sin(a) * L], { t0: deg === 0 ? 999 : 47, p0: 40, main: !k }); k++; } }
    add('paris2', 'paris', [-40, 58], [-40, 162], { road: 4.2, walk: 3, depth: 12, main: true });
    // 교토: 바둑판
    for (const [k, o] of [[0, 0], [1, -27], [2, 27]]) add(k ? 'kyoto_' + k : 'kyoto', 'kyoto', [222 + o, 513], [222 + o, 600], { main: !k, breaks: [[40.5, 45.5]] });
    add('kyoto_x', 'kyoto', [222 - 40, 556], [222 + 40, 556], { road: 2.2, t0: 999, props: false });
    // 리스본 알파마: 굽은 언덕길 + 계단 골목 + 전망대
    { const pts = [[-374, 432], [-346, 425], [-318, 436], [-288, 428]]; for (let k = 0; k < 3; k++) add(k ? 'lisbon_' + k : 'lisbon', 'lisbon', pts[k], pts[k + 1], { main: !k, t0: k ? 3 : 0, rails: true, joint: k < 2 });
      add('lisbon_s', 'lisbon', [-346, 421], [-339, 394], { road: 1.6, walk: 0, depth: 9, t0: 6, stairs: true, props: false }); plaza(-338, 386, 8.5, 'lisbon', 'miradouro');
      ISL.tramPts = pts;
      const up = [[-330, 388], [-302, 397], [-276, 390]]; for (let k = 0; k < 2; k++) add('lisbon_u' + k, 'lisbon', up[k], up[k + 1], { t0: k ? 3 : 2 }); }
    // 레이캬비크: 크리스마스 광장과 마을
    { const pc = [hall.x, hall.z + 47]; plaza(pc[0], pc[1], 16.5, 'reyk', 'xmas');
      add('reyk', 'reyk', [hall.x, hall.z + 64], [hall.x, hall.z + 138], { main: true, breaks: [[35, 42]] });
      for (const [k, o] of [[1, -37], [2, 37]]) add('reyk_' + k, 'reyk', [hall.x + o, hall.z + 50], [hall.x + o, hall.z + 138], { gap: [2, 5], breaks: [[49, 56]], lights: true });
      add('reyk_x', 'reyk', [hall.x - 54, hall.z + 102.5], [hall.x + 54, hall.z + 102.5], { road: 3, walk: 0, t0: 999, props: false }); }
    // 루체른: 분수 광장(바인마르크트)에서 뻗는 골목
    plaza(236, -13, 10.5, 'luzern', 'weinmarkt');
    add('luzern', 'luzern', [226, -10], [150, 11], { main: true });
    let idx = 0;
    for (const s of streets) {
      const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
      Object.assign(s, { ax: s.a[0], az: s.a[1], len, ux, uz, nx: uz, nz: -ux, ry: Math.atan2(ux, uz), idx: idx++ });
      const p0 = s.p0 || 0, sx = s.ax + ux * p0, sz = s.az + uz * p0, hasB = (s.t0 || 0) < len;
      ISL.noTreeSeg.push({ ax: sx - ux * 4, az: sz - uz * 4, bx: s.b[0] + ux * 4, bz: s.b[1] + uz * 4, w: s.road + s.walk + (hasB ? s.depth : 0) + 4 });
      ISL.paved.push({ ax: sx, az: sz, bx: s.b[0], bz: s.b[1], hw: s.road + s.walk + .3 });
      const pc = new THREE.Color(s.style === 'reyk' ? '#dfe6ec' : s.style === 'lisbon' ? '#e2dccc' : s.style === 'kyoto' ? '#6f6c66' : '#8f8a80');
      ISL.groundTints.push((x, z) => ISL.segDist(x, z, sx, sz, s.b[0], s.b[1]).d < s.road + s.walk + .6 ? [pc, .95, 0] : null);
    }
    for (const p of plazas) {
      ISL.noTree.push({ x: p.x, z: p.z, r: p.r + 2 }); ISL.paved.push({ ax: p.x - .1, az: p.z, bx: p.x + .1, bz: p.z, hw: p.r });
      const pc = new THREE.Color(p.style === 'reyk' ? '#e8eef3' : p.style === 'lisbon' ? '#e2dccc' : '#8f8a80');
      ISL.groundTints.push((x, z) => Math.hypot(x - p.x, z - p.z) < p.r + .5 ? [pc, .95, 0] : null);
    }
  }
  // 둥근 광장 바닥 (땅을 따라 깔림)
  function disc(p, tex, tile, lift) {
    const NR = Math.max(3, Math.ceil(p.r / 1.6)), NA = 40, pos = [], uv = [], idx = [];
    for (let j = 0; j <= NR; j++) for (let i = 0; i <= NA; i++) { const r = p.r * j / NR, a = i / NA * Math.PI * 2, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r; pos.push(x, H(x, z) + lift, z); uv.push(x / tile, z / tile); }
    for (let j = 0; j < NR; j++) for (let i = 0; i < NA; i++) { const a = j * (NA + 1) + i, b = a + NA + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: .9, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })); m.receiveShadow = true; scene.add(m);
  }
  // 새 건물이 기존 건물·명소·광장과 겹치는지 (분리축 검사)
  function free(cx, cz, w, d, ry, style) {
    for (const p of plazas) if (Math.hypot(cx - p.x, cz - p.z) < p.r + Math.max(w, d) / 2 + .5) return false;
    const A = { x: cx, z: cz, hw: w / 2, hd: d / 2, cs: Math.cos(ry), sn: Math.sin(ry) }, br = Math.hypot(w, d) / 2;
    const corners = q => [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => { const lx = a * q.hw, lz = b * q.hd; return [q.x + lx * q.cs + lz * q.sn, q.z - lx * q.sn + lz * q.cs]; });
    const ca = corners(A);
    for (const c of ISL.world.near(cx, cz, br + 2)) {
      if (c.t === 'c') { if (c.r > .9 && Math.hypot(c.x - cx, c.z - cz) < c.r + br * .8) return false; continue; }
      if (c.hw < 1.2 && c.hd < 1.2) continue; if (Math.hypot(c.x - cx, c.z - cz) > c.br + br) continue;
      const cb = corners(c); let sep = false;
      for (const q of [A, c]) for (const ax of [[q.cs, -q.sn], [q.sn, q.cs]]) { const pa = ca.map(p => p[0] * ax[0] + p[1] * ax[1]), pb = cb.map(p => p[0] * ax[0] + p[1] * ax[1]); if (Math.max(...pa) < Math.min(...pb) + .04 || Math.max(...pb) < Math.min(...pa) + .04) sep = true; }
      if (!sep) return false;
    }
    let lo = 1e9, hi = -1e9; for (const [x, z] of ca) { const h = H(x, z); lo = Math.min(lo, h); hi = Math.max(hi, h); if (ISL.waterAt(x, z).level > h - .4) return false; }
    return lo > 1 && hi - lo < 9;
  }

  // ---------- 거리의 사람들 (가벼운 한 덩어리 모형) ----------
  const walkers = [];
  function folk(r, winter) {
    const coat = ['#b23a34', '#2f5d8f', '#3f7a5a', '#d9a23a', '#6b4a8f', '#f1ece2', '#333c4a', '#c96a8a'][Math.floor(r() * 8)], skin = ['#f1d2b6', '#e3b98f', '#c98f65'][Math.floor(r() * 3)], hair = ['#2b1d14', '#5a3825', '#d8c08a', '#111'][Math.floor(r() * 4)], hgt = .92 + r() * .12, P = [];
    const B = (g, c) => P.push([g, c]);
    for (const sx of [-.09, .09]) B(new THREE.CapsuleGeometry(.07, .62, 3, 6).translate(sx, .42, 0), '#2a2d36');
    B(new THREE.CylinderGeometry(.17, winter ? .24 : .2, winter ? .78 : .6, 10).translate(0, winter ? 1.05 : 1.12, 0), coat);
    for (const sx of [-.24, .24]) B(new THREE.CapsuleGeometry(.055, .5, 3, 6).translate(sx, 1.12, 0), coat);
    B(new THREE.SphereGeometry(.125, 10, 8).translate(0, 1.6, 0), skin);
    if (winter) { B(new THREE.SphereGeometry(.135, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.63, 0), ['#c0392b', '#2e6f9e', '#f4f1ea', '#3e7c5a'][Math.floor(r() * 4)]); B(new THREE.SphereGeometry(.045, 6, 5).translate(0, 1.79, 0), '#ffffff'); B(new THREE.TorusGeometry(.13, .05, 5, 10).rotateX(Math.PI / 2).translate(0, 1.45, 0), ['#f4f1ea', '#c0392b', '#e6b422'][Math.floor(r() * 3)]); }
    else B(new THREE.SphereGeometry(.132, 10, 6, 0, Math.PI * 2, 0, Math.PI * .55).translate(0, 1.615, -.01), hair);
    const m = new THREE.Mesh(ISL.merge(P), walkerMat()); m.scale.setScalar(hgt); m.castShadow = true; m.userData.dynamic = true; scene.add(m); return m;
  }
  let wm = null; const walkerMat = () => wm || (wm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85 }));
  function addWalker(a, b, lat, r, winter, lift) { const len = Math.hypot(b[0] - a[0], b[1] - a[1]); walkers.push({ m: folk(r, winter), a, b, len, lat, t: r() * len, dir: r() < .5 ? 1 : -1, sp: .9 + r() * .5, ph: r() * 6, lift: lift || .2, x: 0, z: 0 }); }
  function addStander(x, z, ry, r, winter) { const m = folk(r, winter); m.position.set(x, H(x, z) + .22, z); m.rotation.y = ry; walkers.push({ m, stand: true, ph: r() * 6, ry, x, z }); ISL.colCircle(x, z, .3, H(x, z) - 1, H(x, z) + 2); }
  function update(dt, player) {
    const t = performance.now() * .001;
    for (const w of walkers) {
      if (w.stand) { if (Math.abs(w.x - player.x) < 60 && Math.abs(w.z - player.z) < 60) w.m.rotation.y = w.ry + Math.sin(t * .7 + w.ph) * .25; continue; }
      const ux = (w.b[0] - w.a[0]) / w.len, uz = (w.b[1] - w.a[1]) / w.len;
      let x = w.a[0] + ux * w.t + uz * w.lat, z = w.a[1] + uz * w.t - ux * w.lat;
      const dp = Math.hypot(x - player.x, z - player.z); if (dp > 150) { w.m.visible = false; w.t += w.dir * w.sp * dt; if (w.t > w.len - 1 || w.t < 1) { w.dir *= -1; w.t = Math.max(1, Math.min(w.len - 1, w.t)); } continue; }
      w.m.visible = true;
      if (dp > 1.1) { w.t += w.dir * w.sp * dt; if (w.t > w.len - 1 || w.t < 1) { w.dir *= -1; w.t = Math.max(1, Math.min(w.len - 1, w.t)); } }  // 가까이 가면 멈춰서 길을 내줌
      x = w.a[0] + ux * w.t + uz * w.lat; z = w.a[1] + uz * w.t - ux * w.lat;
      w.m.position.set(x, H(x, z) + w.lift + Math.abs(Math.sin(t * 5.5 * w.sp + w.ph)) * .035, z);
      w.m.rotation.y = dp > 1.1 ? Math.atan2(ux * w.dir, uz * w.dir) : Math.atan2(player.x - x, player.z - z); w.m.rotation.z = Math.sin(t * 5.5 * w.sp + w.ph) * .035;
      if (dp < .5 && dp > .01 && Math.abs(player.y - w.m.position.y) < 1.5 && !player.fly) { player.x += (player.x - x) / dp * (.5 - dp); player.z += (player.z - z) / dp * (.5 - dp); } // 사람을 뚫고 지나가지 않게
    }
  }

  function bench(x, z, ry, snow) { const y = H(x, z) + .2, g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g); for (let k = 0; k < 3; k++) LH.box(g, 1.7, .04, .12, M('#3f6b48'), 0, .43, -.15 + k * .15); for (let k = 0; k < 2; k++) LH.box(g, 1.7, .12, .04, M('#3f6b48'), 0, .62 + k * .18, -.26); for (const sx of [-.75, .75]) { LH.box(g, .06, .45, .45, M('#222'), sx, 0, 0); LH.box(g, .06, .45, .06, M('#222'), sx, .45, -.26); } if (snow) LH.box(g, 1.7, .06, .4, M('#f4f7fa', { roughness: 1 }), 0, .47, 0); ISL.colBox(g, 0, 0, 1.7, .55, 1); }
  function bin(x, z, style) { const y = H(x, z) + .2, g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
    if (style === 'paris') { LH.cyl(g, .03, .03, 1.1, 6, M('#1f3328'), 0, 0, 0); const hoop = new THREE.Mesh(new THREE.TorusGeometry(.2, .02, 6, 14), M('#1f3328')); hoop.rotation.x = Math.PI / 2; hoop.position.set(.22, 1.0, 0); g.add(hoop); LH.cyl(g, .19, .14, .7, 10, new THREE.MeshStandardMaterial({ color: '#7fd08a', transparent: true, opacity: .55, roughness: .3 }), .22, .3, 0); }
    else { LH.cyl(g, .24, .2, .85, 12, M(style === 'kyoto' ? '#5a6a70' : style === 'lisbon' ? '#3a6a4a' : '#3a3f45'), 0, 0, 0); LH.cyl(g, .26, .26, .06, 12, M('#222'), 0, .85, 0); }
    ISL.colCircle(x, z, .3, y - 1, y + 1.2); }

  function build(sc) {
    scene = sc; LH = ISL.LH;
    let n = 0;
    const setts = (x, w, h) => { x.fillStyle = '#6f6c68'; x.fillRect(0, 0, w, h); for (let j = 0; j < 8; j++) for (let i = 0; i < 9; i++) { const v = 118 + ((i * 37 + j * 91) % 5) * 9; x.fillStyle = `rgb(${v},${v - 2},${v - 6})`; x.fillRect(i * 16 - (j % 2) * 8 + 1, j * 16 + 1, 14, 14); } };
    for (const p of plazas) disc(p, p.style === 'paris' ? repTex('setts', 128, 128, setts) : repTex(p.style + 'walk', 64, 128, ROADS[p.style].walk || ROADS[p.style].road), p.style === 'paris' ? 3 : 4, .1);
    // 광장의 중심 시설을 먼저 세움 (건물이 피해 가도록)
    for (const p of plazas) {
      if (p.kind === 'etoile') { let y = -1e9, yl = 1e9; for (let k = 0; k < 16; k++) { const h = H(p.x + Math.cos(k * .3927) * 15.4, p.z + Math.sin(k * .3927) * 15.4); y = Math.max(y, h); yl = Math.min(yl, h); } const g = new THREE.Group(); g.position.set(p.x, y, p.z); scene.add(g); const st = ISL.blockMat('#d9cfb8', .7, .35);
        const ih = y - yl + 1; const isl = new THREE.Mesh(new THREE.CylinderGeometry(15, 15.4, ih, 40), ISL.blockMat('#bdb7ab', .8, .5)); isl.position.y = .5 - ih / 2; isl.receiveShadow = true; g.add(isl);
        const lawn = new THREE.Mesh(new THREE.CylinderGeometry(13.5, 13.5, .12, 40), M('#6f9a4a')); lawn.position.y = .56; g.add(lawn);
        const basin = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.4, .9, 24), st); basin.position.y = .95; g.add(basin);
        const wat = new THREE.Mesh(new THREE.CircleGeometry(4.8, 24), new THREE.MeshStandardMaterial({ color: '#4f8fa0', roughness: .1, metalness: .2 })); wat.rotation.x = -Math.PI / 2; wat.position.y = 1.32; g.add(wat);
        LH.cyl(g, 1.2, 1.5, 2.2, 12, st, 0, .5, 0); LH.cyl(g, 2.4, 2.2, .3, 16, st, 0, 2.7, 0); LH.cyl(g, .5, .7, 1.6, 10, st, 0, 3, 0); LH.cyl(g, 1.3, 1.2, .22, 14, st, 0, 4.6, 0); LH.sphere(g, .35, M('#c9a24a', { metalness: .8, roughness: .3 }), 0, 5.2, 0);
        ISL.colCircle(p.x, p.z, 15.4, yl - 2, y + .45); ISL.colCircle(p.x, p.z, 5.4, y - 1, y + 3);
        for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2 + .26; if (k % 2) lamp(p.x + Math.cos(a) * 16.6, p.z + Math.sin(a) * 16.6, 'paris'); else bench(p.x + Math.cos(a) * 11, p.z + Math.sin(a) * 11, Math.atan2(Math.cos(a), Math.sin(a))); }
        ISL.LANDMARKS.push({ id: 'etoile', name: '파리 에투알 광장', region: 'france', x: p.x, z: p.z, r: 46, desc: '오스만 남작이 19세기에 파리를 다시 지으며 만든 방식이에요. 둥근 광장에서 넓은 대로가 별(에투알) 모양으로 뻗어 나가요.', found: false });
      } else if (p.kind === 'weinmarkt') fountain(p.x, p.z, 'luzern');
      else if (p.kind === 'xmas') xmasTree(p.x, p.z, 15);
      else if (p.kind === 'miradouro') { const y = H(p.x, p.z), g = new THREE.Group(); g.position.set(p.x, y + .12, p.z); scene.add(g);
        for (let k = 0; k < 9; k++) { const a = -Math.PI * .9 + k / 8 * Math.PI * .8; railing(g, 2.6, Math.cos(a) * (p.r - .3), 0, Math.sin(a) * (p.r - .3), -a + Math.PI / 2, 1); }
        bench(p.x - 2, p.z + 1, .6); bench(p.x + 2.5, p.z + 2, -.5);
        ISL.LANDMARKS.push({ id: 'miradouro', name: '알파마 전망대', region: 'portugal', x: p.x, z: p.z, r: 12, desc: '리스본에는 언덕마다 "미라도루(전망대)"가 있어요. 계단 골목을 올라오면 붉은 지붕들과 테주 강이 한눈에 보여요.', found: false }); }
    }
    for (const s of streets) {
      const R = ISL.mulberry32(hashStr(s.id)), lift = s.walk > 0 ? .18 : .06, p0 = s.p0 || 0;
      const rs = Object.assign({}, s, { ax: s.ax + s.ux * p0, az: s.az + s.uz * p0, len: s.len - p0 });
      // 길 표면
      const rd = ROADS[s.style];
      ribbon(rs, -s.road, s.road, .06 + s.idx * .005, s.stairs ? repTex('stairs', 64, 64, (x, w, h) => { x.fillStyle = '#d9d2c2'; x.fillRect(0, 0, w, h); x.fillStyle = '#8f887a'; x.fillRect(0, 0, w, 7); x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(0, 7, w, 5); }) : repTex(s.style + 'road', 128, 256, rd.road), s.stairs ? .5 : s.style === 'lisbon' ? 6 : 10);
      if (s.walk > 0) for (const sd of [-1, 1]) { ribbon(rs, sd * s.road, sd * (s.road + s.walk + .5), lift + s.idx * .003, repTex(s.style + 'walk', 64, 128, rd.walk), 4); curb(rs, sd * s.road, lift, rd.curb); }
      // 건물 줄: 벽을 맞대고 이어 붙임 (교차로·광장·명소 자리는 비움)
      for (const sd of [-1, 1]) {
        let t = s.t0 || 0, guard = 0;
        while (guard++ < 200) {
          const w = s.widths[Math.floor(R() * s.widths.length)]; if (t + w > s.len) break;
          const br = (s.breaks || []).find(([b0, b1]) => t < b1 && t + w > b0); if (br) { t = br[1]; continue; }
          const tc = t + w / 2, off = sd * (s.road + s.walk + s.depth / 2 + (s.walk ? .5 : .15));
          const cx = s.ax + s.ux * tc + s.nx * off, cz = s.az + s.uz * tc + s.nz * off;
          const ry = Math.atan2(-s.nx * sd, -s.nz * sd);
          if (!free(cx, cz, w, s.depth, ry, s.style)) { t += 2; continue; }
          const fx = s.ax + s.ux * tc + s.nx * sd * (s.road + s.walk * .5), fz = s.az + s.uz * tc + s.nz * sd * (s.road + s.walk * .5);
          const dx0 = s.style === 'lisbon' ? -w / 4 : 0, dpx = cx + dx0 * Math.cos(ry) + (s.depth / 2 + .5) * Math.sin(ry), dpz = cz - dx0 * Math.sin(ry) + (s.depth / 2 + .5) * Math.cos(ry);
          const floorY = Math.max(H(fx, fz), H(dpx, dpz)) + lift + .1;
          let lo = 1e9; for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const lx = a * w / 2, lz = b * s.depth / 2, x = cx + lx * Math.cos(ry) + lz * Math.sin(ry), z = cz - lx * Math.sin(ry) + lz * Math.cos(ry); lo = Math.min(lo, H(x, z)); }
          const g = new THREE.Group(); g.position.set(cx, floorY, cz); g.rotation.y = ry; scene.add(g);
          const res = STY[s.style](g, w, s.depth, R, n++);
          LH.box(g, w, Math.max(.3, floorY - lo + .4), s.depth, ISL.blockMat('#8d877c', .6, .3), 0, lo - floorY - .4, 0); // 기초
          const dxo = res.door || 0;
          const hObj = { x: cx, z: cz, ry, dims: { w, d: s.depth }, floorY, street: s.id };
          const dg = new THREE.Group(); dg.position.set(cx + dxo * Math.cos(ry), floorY, cz - dxo * Math.sin(ry)); dg.rotation.y = ry; scene.add(dg);
          const door = ISL.Interior.addDoor(hObj, dg, w, s.depth, res.interior, R);
          for (const q of [-1, 1]) LH.box(dg, .14, 2.35, .16, M(res.trim), q * .64, 0, s.depth / 2 + .04); LH.box(dg, 1.42, .16, .16, M(res.trim), 0, 2.3, s.depth / 2 + .04);
          LH.box(dg, 1.5, .14, .45, ISL.blockMat('#9a948a', .5, .14), 0, -.14, s.depth / 2 + .25);
          ISL.colBox(g, 0, 0, w, s.depth, res.h, { kind: 'street', pass: (lx, lz) => door.open > .55 && Math.abs(lx - dxo) < .7 && lz > -s.depth / 2 + .6, door });
          t += w + (s.gap ? s.gap[0] + R() * (s.gap[1] - s.gap[0]) : 0);
        }
      }
      if (s.props === false) continue;
      // 거리 소품
      const along = (t, o) => [s.ax + s.ux * t + s.nx * o, s.az + s.uz * t + s.nz * o], T0 = Math.max(p0, Math.min(s.t0 || 0, s.len)), ok = (x, z) => !ISL.world.solidAt(x, H(x, z) + 1, z);
      const walk = (k, winter) => { for (let i = 0; i < k; i++) addWalker(along(T0 + 2, 0), along(s.len - 2, 0), (R() < .5 ? -1 : 1) * (s.walk > 1 ? s.road + s.walk * .5 : s.road * .55), R, winter, lift + .04); };
      if (s.style === 'paris') {
        for (let t = T0 + 6; t < s.len - 4; t += 16) for (const sd of [-1, 1]) { const [x, z] = along(t, sd * (s.road + .7)); lamp(x, z, 'paris'); }
        const trees = []; for (let t = T0 + 2; t < s.len; t += 8) for (const sd of [-1, 1]) { if (s.walk < 3.5) continue; const [x, z] = along(t, sd * (s.road + 1.6)); trees.push({ x, y: H(x, z) + .18, z, s: 1.15 }); }
        ISL.placeInstances(scene, 'plane', trees);
        for (let t = T0 + 9; t < s.len - 6; t += 27) { const sd = R() < .5 ? -1 : 1; for (let k = 0; k < 3; k++) { const [x, z] = along(t + k * 2, sd * (s.road + s.walk - .7)); if (ok(x, z)) cafe(x, z, s.ry); } }
        for (let t = T0 + 12; t < s.len - 4; t += 24) { const [x, z] = along(t, (t % 48 < 24 ? 1 : -1) * (s.road + 1)); if (ok(x, z)) bin(x, z, 'paris'); const [bx, bz] = along(t + 6, (t % 48 < 24 ? -1 : 1) * (s.road + 2.6)); if (ok(bx, bz)) bench(bx, bz, s.ry + Math.PI / 2 * (t % 48 < 24 ? -1 : 1)); }
        if (s.main) { const [x, z] = along(s.len * .5 + T0 * .5, -(s.road + s.walk * .5)); if (ok(x, z)) morris(x, z); }
        if (T0 < s.len) walk(s.main ? 5 : 3, false);
      } else if (s.style === 'kyoto') {
        utilityPoles(s, 1);
        for (let t = 5; t < s.len; t += 13) { const [x, z] = along(t, -(s.road - .3)); lamp(x, z, 'kyoto'); }
        { const [x, z] = along(s.len * .62, s.road - .45); vending(x, z, s.ry - Math.PI / 2); const [bx, bz] = along(s.len * .62 + 1.1, s.road - .4); bin(bx, bz, 'kyoto'); }
        if (s.main) { const sak = []; for (const t of [-6, s.len + 6]) for (const sd of [-1, 1]) { const [x, z] = along(t, sd * 4.5); sak.push({ x, y: H(x, z), z, s: 1.4 }); } ISL.placeInstances(scene, 'cherry', sak); }
        walk(s.main ? 5 : 2, false);
      } else if (s.style === 'lisbon') {
        for (let t = 7; t < s.len; t += 11) laundry(s, t, H(...along(t, 0)) + 6.2 + R() * 2.5, R);
        if (s.rails) for (const o of [-.55, .55]) { const N = Math.ceil(s.len / 2); const pos = []; for (let i = 0; i <= N; i++) { const [x, z] = along(s.len * i / N, o); pos.push(x, H(x, z) + .12, z); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#8a8a8a' }))); }
        { const [x, z] = along(s.len * .5, s.road + .3); if (ok(x, z)) bin(x, z, 'lisbon'); }
        walk(2, false);
      } else if (s.style === 'reyk') {
        for (let t = 8; t < s.len; t += 18) for (const sd of [-1, 1]) { const [x, z] = along(t, sd * (s.road + .5)); lamp(x, z, 'reyk'); }
        const o = s.road + s.walk + .45;
        for (let t = 4; t < s.len; t += s.main ? 6.5 : 11) { const a = along(t, -o), b = along(t, o); lightString([a[0], H(a[0], a[1]) + 5.2, a[1]], [b[0], H(b[0], b[1]) + 5.2, b[1]], .8, 16); }
        for (let t = 14; t < s.len; t += 26) { const [x, z] = along(t, (t % 52 < 26 ? 1 : -1) * (s.road + 1.2)); if (ok(x, z)) { if (s.main) bench(x, z, s.ry + Math.PI / 2 * (t % 52 < 26 ? 1 : -1), true); else lightTree(x, z); } }
        if (s.main) { { const [x, z] = along(s.len * .3, -(s.road + 1.1)); snowman(x, z); } { const [x, z] = along(s.len * .8, s.road + 1.2); snowman(x, z); } { const [x, z] = along(s.len * .55, s.road + 1); bin(x, z, 'reyk'); } }
        walk(s.main ? 9 : 4, true);
      } else if (s.style === 'luzern') {
        for (let t = 9; t < s.len; t += 17) { const [x, z] = along(t, (t % 2 ? 1 : -1) * (s.road + .5)); lamp(x, z, 'luzern'); }
        { const [x, z] = along(s.len * .4, s.road + .4); bin(x, z, 'luzern'); const [bx, bz] = along(s.len * .7, -(s.road + .5)); bench(bx, bz, s.ry - Math.PI / 2); }
        walk(5, false);
      }
    }
    // ---- 크리스마스 광장: 큰 트리를 둘러싼 오두막 가게, 트리 꼭대기에서 뻗는 전구 줄, 모닥불, 사람들 ----
    { const p = plazas.find(q => q.kind === 'xmas'), R = ISL.mulberry32(2412), goods = ['#c0392b', '#e6b422', '#2e6f9e', '#f4f1ea', '#3e7c5a', '#d9733a'], y0 = H(p.x, p.z);
      for (let k = 0; k < 8; k++) { const a = (k * 45 + 22.5) * Math.PI / 180, x = p.x + Math.cos(a) * 11.6, z = p.z + Math.sin(a) * 11.6; stall(x, z, Math.atan2(p.x - x, p.z - z), goods, k);
        for (let q = 0; q < 2; q++) { if (R() < .25) continue; const sx = p.x + Math.cos(a + (q - .5) * .16) * 8.6, sz = p.z + Math.sin(a + (q - .5) * .16) * 8.6; addStander(sx, sz, Math.atan2(x - sx, z - sz), R, true); } }
      for (let k = 0; k < 8; k++) { const a = k * 45 * Math.PI / 180, x = p.x + Math.cos(a) * 16, z = p.z + Math.sin(a) * 16, y = H(x, z); LH.cyl(scene, .07, .09, 5, 8, M('#2b2b2b'), x, y, z); ISL.colCircle(x, z, .12, y - 1, y + 5); lightString([p.x, y0 + 14.2, p.z], [x, y + 5, z], 1.6, 22); }
      for (const a of [1.2, 4.3]) { const x = p.x + Math.cos(a) * 5.2, z = p.z + Math.sin(a) * 5.2, y = H(x, z) + .2; LH.cyl(scene, .32, .26, .7, 10, M('#2a2a2a'), x, y, z); const f = new THREE.Mesh(new THREE.ConeGeometry(.24, .6, 7), new THREE.MeshBasicMaterial({ color: '#ffb347' })); f.position.set(x, y + .95, z); f.userData.dynamic = true; scene.add(f); glowPool(x, z, 4.5); ISL.colCircle(x, z, .4, y - 1, y + 1.2);
        for (let q = 0; q < 3; q++) { const b = a + q * 2.1, sx = x + Math.cos(b) * 1.2, sz = z + Math.sin(b) * 1.2; addStander(sx, sz, Math.atan2(x - sx, z - sz), R, true); } }
      { const sg = ISL.person({ top: '#c81e1e', bottom: '#c81e1e', hat: 'knit', hatColor: '#c81e1e', hair: '#ffffff', scarf: '#ffffff' }), sx = p.x - 4.6, sz = p.z + 3.4; sg.g.position.set(sx, H(sx, sz) + .2, sz); sg.g.rotation.y = 2.2; sg.armR.rotation.x = -2.5; scene.add(sg.g); ISL.colCircle(sx, sz, .35); }
      for (let k = 0; k < 10; k++) { const a = k / 10 * 6.283 + .3, x = p.x + Math.cos(a) * 20.5, z = p.z + Math.sin(a) * 20.5; if (!ISL.world.solidAt(x, H(x, z) + 1, z) && !streets.some(s => s.style === 'reyk' && ISL.segDist(x, z, s.ax, s.az, s.b[0], s.b[1]).d < s.road + 1)) lightTree(x, z); }
      snowman(p.x + 6.5, p.z - 2.5); bench(p.x - 6.5, p.z - 3, 1.1, true); bin(p.x + 3, p.z + 14.2, 'reyk');
      for (let k = 0; k < 6; k++) { const a0 = R() * 6.283, a1 = a0 + 2 + R() * 2; addWalker([p.x + Math.cos(a0) * 14, p.z + Math.sin(a0) * 14], [p.x + Math.cos(a1) * 14, p.z + Math.sin(a1) * 14], 0, R, true, .22); }
    }
    // 28번 트램이 달릴 굽은 선로
    { const pts = ISL.tramPts, segs = []; let L = 0; for (let k = 0; k < pts.length - 1; k++) { const l = Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]); segs.push([L, l, pts[k], pts[k + 1]]); L += l; }
      ISL.tramLane = { len: L, at(t) { t = Math.max(0, Math.min(L - .01, t)); const sg = segs.find(q => t < q[0] + q[1]) || segs[segs.length - 1], f = (t - sg[0]) / sg[1]; return [sg[2][0] + (sg[3][0] - sg[2][0]) * f, sg[2][1] + (sg[3][1] - sg[2][1]) * f, Math.atan2(sg[3][0] - sg[2][0], sg[3][1] - sg[2][1])]; } }; }
    ISL.walkerCount = walkers.length;
  }
  ISL.Streets = { plan, build, update, streets, plazas };
})();
