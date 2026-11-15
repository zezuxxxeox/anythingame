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
      const side = ISL.blockMat('#d9ccb0', .9, .5);
      LH.mesh(g, new THREE.BoxGeometry(w, h, d), [side, side, M('#666'), M('#666'), f, side], 0, h / 2, 0);
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
      LH.mesh(g, new THREE.BoxGeometry(w, h, d), [side, side, M('#555'), M('#555'), f, side], 0, h / 2, 0);
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
      LH.mesh(g, new THREE.BoxGeometry(w, h, d), [side, side, M('#555'), M('#555'), f, side], 0, h / 2, 0);
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
          else P.window({ cx, y0: k * uh + .8, w: 1.05, h: 1.3, frame: '#ffffff', bars: [2, 2], fw: .08, curtain: P.r() < .4 ? 'rgba(255,255,255,.5)' : null });
        }
        P.doorway(w / 2, 1.1, 2.25, '#ffffff');
        if (shopN) { P.rect(w / 2 - 1.3, 2.55, 2.6, .4, '#f4f1ea'); P.text(shopN, w / 2, 2.75, .26, '#2a2a2a'); }
      });
      const side = M(col);
      LH.mesh(g, new THREE.BoxGeometry(w, h, d), [side, side, M('#555'), M('#555'), f, side], 0, h / 2, 0);
      const roof = ISL.roofMat(['#b03a2e', '#2b2f36', '#2f5d50'][n % 3], 'metal');
      LH.mesh(g, LH.gableGeo(d, w + .1, 2.6, .45), roof, 0, h, 0, Math.PI / 2);
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
      LH.mesh(g, new THREE.BoxGeometry(w, h, d), [side, side, M('#555'), M('#555'), f, side], 0, h / 2, 0);
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
  let lampMat = null;
  function streetLampMat() { if (!lampMat) { lampMat = new THREE.MeshStandardMaterial({ color: '#fff2c8', emissive: '#ffd890', emissiveIntensity: 0, roughness: .3 }); ISL.nightMats.push(lampMat); } return lampMat; }

  // ---------- 도로 표면 ----------
  const ROADS = {
    paris: { road: (x, w, h, r) => { x.fillStyle = '#4a4b50'; x.fillRect(0, 0, w, h); for (let i = 0; i < 3000; i++) { x.fillStyle = `rgba(${r() < .5 ? 0 : 255},${r() < .5 ? 0 : 255},${r() < .5 ? 0 : 255},.05)`; x.fillRect(r() * w, r() * h, 2, 2); } x.fillStyle = '#e9e6dc'; for (let y = 0; y < h; y += 64) x.fillRect(w / 2 - 2, y, 4, 34); },
             walk: (x, w, h, r) => { x.fillStyle = '#bdb7ab'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(80,70,60,.25)'; for (let y = 0; y < h; y += 32) x.fillRect(0, y, w, 2); for (let y = 0; y < h; y += 32) for (let xx = (y / 32) % 2 * 24; xx < w; xx += 48) x.fillRect(xx, y, 2, 32); }, curb: '#8e8a84' },
    kyoto: { road: (x, w, h, r) => { x.fillStyle = '#5c5a56'; x.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 22) for (let xx = ((y / 22) % 2) * 20; xx < w; xx += 42) { const c = 98 + r() * 34; x.fillStyle = `rgb(${c},${c - 2},${c - 5})`; x.fillRect(xx + 2, y + 2, 38, 18); } x.fillStyle = '#3f3d3a'; x.fillRect(0, 0, 10, h); x.fillRect(w - 10, 0, 10, h); }, walk: null, curb: '#6b6862' },
    lisbon: { road: (x, w, h, r) => { x.fillStyle = '#efeadd'; x.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 5) for (let xx = (y % 10) ? 2 : 0; xx < w; xx += 5) { x.fillStyle = `rgba(0,0,0,${.05 + r() * .06})`; x.fillRect(xx, y, 4, 4); } x.fillStyle = '#2b2b2b'; for (let k = 0; k < 3; k++) for (let y = 0; y < h; y += 2) { const xx = w * (.2 + k * .3) + Math.sin(y / h * Math.PI * 4) * w * .08; x.fillRect(xx, y, 9, 2); } }, walk: (x, w, h, r) => { x.fillStyle = '#e6dfcf'; x.fillRect(0, 0, w, h); for (let i = 0; i < 1500; i++) { x.fillStyle = 'rgba(0,0,0,.07)'; x.fillRect(r() * w, r() * h, 3, 3); } }, curb: '#d8d1c0' },
    reyk: { road: (x, w, h) => { const cols = ['#e63b3b', '#f08a2b', '#f5d33a', '#4dbb5a', '#3a7ad9', '#8a52c9']; for (let i = 0; i < 6; i++) { x.fillStyle = cols[i]; x.fillRect(i * w / 6, 0, w / 6 + 1, h); } x.fillStyle = 'rgba(0,0,0,.06)'; for (let y = 0; y < h; y += 8) x.fillRect(0, y, w, 1); }, walk: (x, w, h, r) => { x.fillStyle = '#9a9c9e'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(0,0,0,.15)'; for (let y = 0; y < h; y += 40) x.fillRect(0, y, w, 2); }, curb: '#7d8082' },
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
    ISL.colCircle(x, z, .15, y - 1, y + 4);
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

  // ---------- 거리 정의 ----------
  const streets = []; ISL.streets = streets; ISL.paved = [];
  function plan() {
    const P = ISL.P, hall = P.hallgrim;
    const defs = [
      { id: 'paris', style: 'paris', a: [-282, 86], b: [-282, 200], road: 5.5, walk: 4, depth: 13, widths: [9, 12, 15], name: '파리 오스만 대로' },
      { id: 'paris2', style: 'paris', a: [-40, 58], b: [-40, 162], road: 4.2, walk: 3, depth: 12, widths: [9, 12, 15] },
      { id: 'kyoto', style: 'kyoto', a: [222, 513], b: [222, 600], road: 2.7, walk: 0, depth: 10, widths: [6.4, 7.2, 8], name: '교토 기온 거리' },
      { id: 'lisbon', style: 'lisbon', a: [-374, 430], b: [-286, 430], road: 3, walk: .9, depth: 10, widths: [5.6, 6.4, 7.2], name: '리스본 알파마 골목' },
      { id: 'reyk', style: 'reyk', a: [hall.x, hall.z + 40], b: [hall.x, hall.z + 122], road: 3.4, walk: 2.2, depth: 11, widths: [7, 8.5, 10], name: '레이캬비크 무지개 거리' },
      { id: 'luzern', style: 'luzern', a: [226, -10], b: [150, 11], road: 3.2, walk: 1.3, depth: 11, widths: [7.4, 8.2, 9], name: '루체른 구시가지' },
    ];
    for (const d of defs) {
      const dx = d.b[0] - d.a[0], dz = d.b[1] - d.a[1], len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
      const s = Object.assign(d, { ax: d.a[0], az: d.a[1], len, ux, uz, nx: uz, nz: -ux, ry: Math.atan2(ux, uz) });
      streets.push(s);
      const half = s.road + s.walk + s.depth + 1;
      ISL.noTreeSeg.push({ ax: s.ax - ux * 4, az: s.az - uz * 4, bx: d.b[0] + ux * 4, bz: d.b[1] + uz * 4, w: half });
      ISL.paved.push({ ax: s.ax, az: s.az, bx: d.b[0], bz: d.b[1], hw: s.road + s.walk + .3 });
      const pc = new THREE.Color(s.style === 'reyk' ? '#7d7f80' : s.style === 'lisbon' ? '#e2dccc' : s.style === 'kyoto' ? '#8e8b84' : '#8f8a80');
      ISL.groundTints.push((x, z) => ISL.segDist(x, z, s.ax, s.az, d.b[0], d.b[1]).d < s.road + s.walk + .6 ? [pc, .95, 0] : null);
    }
  }

  function build(sc) {
    scene = sc; LH = ISL.LH;
    let n = 0;
    for (const s of streets) {
      const R = ISL.mulberry32(hashStr(s.id)), lift = s.walk > 0 ? .18 : .06;
      // 길 표면
      const rd = ROADS[s.style];
      ribbon(s, -s.road, s.road, .06, repTex(s.style + 'road', 128, 256, rd.road), s.style === 'lisbon' ? 6 : 10);
      if (s.walk > 0) for (const sd of [-1, 1]) { ribbon(s, sd * s.road, sd * (s.road + s.walk + .5), lift, repTex(s.style + 'walk', 64, 128, rd.walk), 4); curb(s, sd * s.road, lift, rd.curb); }
      // 건물 줄: 양쪽으로 벽을 맞대고 이어 붙임
      for (const sd of [-1, 1]) {
        let t = 0;
        while (true) {
          const w = s.widths[Math.floor(R() * s.widths.length)]; if (t + w > s.len) break;
          const tc = t + w / 2, off = sd * (s.road + s.walk + s.depth / 2 + (s.walk ? .5 : .15));
          const cx = s.ax + s.ux * tc + s.nx * off, cz = s.az + s.uz * tc + s.nz * off;
          const ry = Math.atan2(-s.nx * sd, -s.nz * sd);
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
          t += w;
        }
      }
      // 거리 소품
      const along = (t, o) => [s.ax + s.ux * t + s.nx * o, s.az + s.uz * t + s.nz * o];
      if (s.style === 'paris') {
        for (let t = 8; t < s.len - 4; t += 16) for (const sd of [-1, 1]) { const [x, z] = along(t, sd * (s.road + .7)); lamp(x, z, 'paris'); }
        const trees = []; for (let t = 4; t < s.len; t += 8) for (const sd of [-1, 1]) { if (s.walk < 3.5) continue; const [x, z] = along(t, sd * (s.road + 1.6)); trees.push({ x, y: H(x, z) + .18, z, s: 1.15 }); }
        ISL.placeInstances(scene, 'plane', trees);
        for (let t = 10; t < s.len - 6; t += 23) { const sd = R() < .5 ? -1 : 1; for (let k = 0; k < 3; k++) { const [x, z] = along(t + k * 2, sd * (s.road + s.walk - .7)); cafe(x, z, s.ry); } }
        { const [x, z] = along(s.len * .5, -(s.road + s.walk * .5)); morris(x, z); }
      } else if (s.style === 'kyoto') {
        utilityPoles(s, 1);
        for (let t = 5; t < s.len; t += 13) { const [x, z] = along(t, -(s.road - .3)); lamp(x, z, 'kyoto'); }
        { const [x, z] = along(s.len * .62, s.road - .45); vending(x, z, s.ry - Math.PI / 2); }
        const sak = []; for (const t of [-6, s.len + 6]) for (const sd of [-1, 1]) { const [x, z] = along(t, sd * 4.5); sak.push({ x, y: H(x, z), z, s: 1.4 }); } ISL.placeInstances(scene, 'cherry', sak);
      } else if (s.style === 'lisbon') {
        for (let t = 7; t < s.len; t += 11) laundry(s, t, H(...along(t, 0)) + 6.2 + R() * 2.5, R);
        for (const o of [-.55, .55]) { const N = Math.ceil(s.len / 2); const pos = []; for (let i = 0; i <= N; i++) { const [x, z] = along(s.len * i / N, o); pos.push(x, H(x, z) + .1, z); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#8a8a8a' }))); }
        ISL.tramLane = s;
      } else if (s.style === 'reyk') {
        for (let t = 8; t < s.len; t += 18) for (const sd of [-1, 1]) { const [x, z] = along(t, sd * (s.road + .5)); lamp(x, z, 'reyk'); }
      } else if (s.style === 'luzern') {
        for (let t = 9; t < s.len; t += 17) { const [x, z] = along(t, (t % 2 ? 1 : -1) * (s.road + .5)); lamp(x, z, 'luzern'); }
        const [fx, fz] = along(-5, 0); fountain(fx, fz, 'luzern');
      }
    }
  }
  ISL.Streets = { plan, build, streets };
})();
