// 플레이어·카메라·물리·집 안팎·대화·감정표현·UI·메인 루프
(function () {
  const ISL = window.ISL;
  const $ = id => document.getElementById(id);
  const rng = ISL.mulberry32(99);
  const A = ISL.Audio, Net = ISL.Net;
  const MOBILE = matchMedia('(pointer:coarse)').matches, LQ = /lq/.test(location.search);
  let renderer, scene, camera, sunLight, hemi, sky, pmrem, envScene, post = null;
  let tDay = 0.31; const DAY_SECONDS = 720;
  const TIME_PRESETS = [[0.29, '🌅 아침'], [0.45, '☀️ 한낮'], [0.715, '🌇 노을'], [0.93, '🌙 밤']];
  const ITEMS = ISL.ITEMS, NPCS = ISL.NPCS, TOURIST_LINES = ISL.TOURIST_LINES;

  // ---------- 저장 ----------
  const SAVE_KEY = 'fiveIsland.save.v1';
  const S = { found: {}, items: {}, quests: {}, met: {}, gifted: {} };
  try { Object.assign(S, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) {}
  const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} };

  // ---------- 사람 모형 ----------
  function person(o) {
    const g = new THREE.Group(), M = c => new THREE.MeshStandardMaterial({ color: c, roughness: .8 });
    const skin = M(o.skin || '#f1d2b6'), top = M(o.top), bottom = M(o.bottom || '#3b3b4f'), hair = M(o.hair || '#3a2a20');
    const body = new THREE.Group(); g.add(body);
    const part = (geo, m, x, y, z, parent = body) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true; parent.add(me); return me; };
    const limb = (x, y, m, len, r) => { const piv = new THREE.Group(); piv.position.set(x, y, 0); body.add(piv); part(new THREE.CapsuleGeometry(r, len, 4, 8), m, 0, -len / 2 - r * .3, 0, piv); return piv; };
    const legL = limb(-.17, .95, bottom, .62, .13), legR = limb(.17, .95, bottom, .62, .13);
    part(new THREE.CapsuleGeometry(.3, .55, 4, 10), top, 0, 1.35, 0);
    if (o.skirt) part(new THREE.CylinderGeometry(.3, .5, .9, 12), top, 0, .75, 0);
    if (o.obi) part(new THREE.CylinderGeometry(.33, .33, .22, 12), M(o.obi), 0, 1.2, 0);
    const armL = limb(-.42, 1.68, top, .5, .1), armR = limb(.42, 1.68, top, .5, .1);
    part(new THREE.SphereGeometry(.28, 16, 12), skin, 0, 2.05, 0);
    part(new THREE.SphereGeometry(.3, 16, 10, 0, Math.PI * 2, 0, Math.PI * .55), hair, 0, 2.08, -.02);
    if (o.longHair) part(new THREE.CapsuleGeometry(.2, .35, 4, 8), hair, 0, 1.85, -.17);
    for (const s of [-1, 1]) part(new THREE.SphereGeometry(.035, 6, 4), M('#1b1b1b'), s * .1, 2.08, .25);
    part(new THREE.SphereGeometry(.04, 6, 4), M('#e09a8a'), 0, 1.98, .27).scale.set(1.6, .6, .5);
    if (o.hat === 'beret') { const b = part(new THREE.CylinderGeometry(.3, .32, .1, 16), M(o.hatColor), .05, 2.33, 0); b.rotation.z = .2; }
    if (o.hat === 'cap') { part(new THREE.SphereGeometry(.31, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(o.hatColor), 0, 2.12, 0); part(new THREE.BoxGeometry(.3, .04, .25), M(o.hatColor), 0, 2.14, .3); }
    if (o.hat === 'knit') { part(new THREE.SphereGeometry(.31, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(o.hatColor), 0, 2.1, 0).scale.y = 1.25; part(new THREE.SphereGeometry(.09, 8, 6), M('#ffffff'), 0, 2.5, 0); }
    if (o.hat === 'alpine') { part(new THREE.CylinderGeometry(.22, .3, .25, 12), M(o.hatColor), 0, 2.32, 0); part(new THREE.CylinderGeometry(.42, .42, .03, 16), M(o.hatColor), 0, 2.22, 0); part(new THREE.BoxGeometry(.03, .25, .06), M('#c94b3b'), .2, 2.4, 0); }
    if (o.hat === 'sun') { part(new THREE.CylinderGeometry(.2, .26, .2, 12), M(o.hatColor), 0, 2.3, 0); part(new THREE.CylinderGeometry(.5, .5, .03, 18), M(o.hatColor), 0, 2.22, 0); }
    if (o.kanzashi) part(new THREE.SphereGeometry(.07, 8, 6), M('#e85a8a'), .2, 2.25, -.1);
    if (o.scarf) part(new THREE.TorusGeometry(.22, .07, 6, 12), M(o.scarf), 0, 1.73, 0).rotation.x = Math.PI / 2;
    if (o.pattern) part(new THREE.TorusGeometry(.31, .05, 6, 16), M(o.pattern), 0, 1.62, 0).rotation.x = Math.PI / 2;
    if (o.backpack) { part(new THREE.BoxGeometry(.5, .6, .26), M(o.backpack), 0, 1.4, -.38); part(new THREE.CylinderGeometry(.1, .1, .5, 8), M('#5b6b7a'), 0, 1.78, -.38).rotation.z = Math.PI / 2; }
    body.scale.setScalar(.747); // 키 174cm
    return { g, body, legL, legR, armL, armR, emote: null };
  }
  ISL.person = person;
  function walkPose(p, phase, amt) { const s = Math.sin(phase) * amt; p.legL.rotation.set(s, 0, 0); p.legR.rotation.set(-s, 0, 0); p.armL.rotation.set(-s * .8, 0, 0); p.armR.rotation.set(s * .8, 0, 0); }
  // 감정표현 포즈를 몸통에 적용
  function poseEmote(m, dt) {
    if (!m.emote) { m.body.position.y = 0; m.body.rotation.set(0, 0, 0); return false; }
    m.emote.t += dt; const def = ISL.EMOTES.find(e => e.id === m.emote.id);
    if (m.emote.t > def.dur) { m.emote = null; ISL.resetPose(m); m.body.position.y = 0; m.body.rotation.set(0, 0, 0); return false; }
    ISL.resetPose(m); ISL.applyEmote(m, m.emote.id, m.emote.t);
    m.body.position.y = m.extraY; m.body.rotation.set(m.tilt, m.spin, 0);
    return true;
  }

  // ---------- NPC ----------
  let npcs = [], tourists = [], pickups = [];
  function placeNPCs() {
    const PL = ISL.P, pd = ISL.Landmarks.planData;
    const pos = { sigrid: [PL.hallgrim.x + 6, PL.hallgrim.z + 28], lukas: [300, 110], chloe: [PL.eiffel.x + 8, PL.eiffel.z + 96], joao: [pd.lisbon.x, pd.lisbon.z - 44], haruka: [300, 440] };
    for (const d of NPCS) {
      const m = person(d.look); let [x, z] = pos[d.id];
      for (let k = 0; k < 80 && (ISL.world.solidAt(x, ISL.H(x, z) + 1, z) || ISL.waterAt(x, z).level > ISL.H(x, z)); k++) { const a = k * 2.4, r = 1 + k * .35; x = pos[d.id][0] + Math.cos(a) * r; z = pos[d.id][1] + Math.sin(a) * r; } // 막힌 곳이면 근처 빈자리로
      m.g.position.set(x, ISL.H(x, z), z); scene.add(m.g);
      const tag = label(d.name, '#ffd166'); tag.position.set(0, 2.25, 0); m.g.add(tag);
      (ISL.debug.npcPos = ISL.debug.npcPos || []).push([d.id, x, z]); npcs.push({ d, m, x, z, tag, face: 0 }); ISL.colCircle(x, z, .35);
    }
    const spots = [[PL.eiffel.x - 14, PL.eiffel.z + 110], [260, 430], [PL.hallgrim.x - 16, PL.hallgrim.z + 30], [PL.belem.x + 20, PL.belem.z], [PL.chillon.x - 10, PL.chillon.z + 30], [PL.msm.x + 40, PL.msm.z + 10], [470, 380], [180, -30]];
    const looks = [{ top: '#f4a261', hat: 'sun', hatColor: '#f6e7c1', backpack: '#2a9d8f' }, { top: '#9b5de5', bottom: '#264653', hat: 'cap', hatColor: '#f15bb5' }, { top: '#00bbf9', bottom: '#333', backpack: '#fee440' }, { top: '#e76f51', hair: '#d4a373', longHair: 1 }];
    spots.forEach(([x, z], i) => {
      const m = person(looks[i % looks.length]); m.g.position.set(x, ISL.H(x, z), z); scene.add(m.g);
      tourists.push({ m, ax: x, az: z, x, z, tx: x, tz: z, t: rng() * 5, phase: 0, line: TOURIST_LINES[i % TOURIST_LINES.length] });
    });
    const b = pd.basalt;
    const spotsP = [['sakura', 238, 436], ['lavender', PL.lavender.x, PL.lavender.z - 42], ['stone', b.x + b.dx * 4, b.z + b.dz * 4]];
    ISL.placeInstances(scene, 'cherry', [{ x: 234, y: ISL.H(234, 433), z: 433, s: 1.1 }]);
    const glow = new THREE.MeshStandardMaterial({ color: '#fff7c2', emissive: '#ffd166', emissiveIntensity: 1.2 });
    for (const [id, x, z] of spotsP) {
      if (S.items[id] || NPCS.some(d => d.wants === id && S.quests[d.id] === 2)) continue;
      const g = new THREE.Group(); g.position.set(x, ISL.H(x, z) + 1, z); scene.add(g);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(.35, 0), glow); g.add(gem);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ISL.puffTex, color: '#ffe08a', transparent: true, opacity: .6, depthWrite: false })); sp.scale.set(2.4, 2.4, 1); g.add(sp);
      pickups.push({ id, x, z, g, gem });
    }
  }
  function label(text, color) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
    x.font = 'bold 30px system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = 'rgba(20,24,40,.55)'; const w = x.measureText(text).width + 30; x.beginPath(); x.roundRect ? x.roundRect(128 - w / 2, 8, w, 48, 24) : x.rect(128 - w / 2, 8, w, 48); x.fill();
    x.fillStyle = color; x.fillText(text, 128, 33);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(3.2, .8, 1); s.renderOrder = 10; return s;
  }

  // ---------- 플레이어 ----------
  const player = { x: -150, z: 262, y: 0, vy: 0, fly: false, ground: true, phase: 0, face: Math.PI, speed: 0, swim: false, stepN: 0, splashT: 0, seat: null };
  const cam = { yaw: Math.PI, pitch: .25, dist: 8, tx: 0, ty: 0, tz: 0 };
  let pm, glider;
  function groundAt(x, z, curY) {
    let h = ISL.H(x, z);
    if (curY !== undefined && ISL.floors) for (const f of ISL.floors) if (Math.abs(x - f.x) < f.hw && Math.abs(z - f.z) < f.hd && f.y > h && f.y < curY + 1) h = f.y;
    for (const w of ISL.walkables) {
      if (Math.abs(x - w.cx) > w.len && Math.abs(z - w.cz) > w.len) continue;
      const q = ISL.segDist(x, z, w.ax, w.az, w.bx, w.bz);
      if (q.d < w.hw + .3) { const y = ISL.deckY(w, q.t); if (y > h && (curY === undefined || y < curY + 1.7)) { h = y; player.onDeck = true; } }
    }
    return h;
  }
  function deepWater(x, z) { const g = groundAt(x, z), w = ISL.waterAt(x, z); return w.kind !== 'river' && w.level - g > 1.3; }

  // ---------- 입력 ----------
  const keys = {}; let joy = { x: 0, y: 0, active: false }, drag = null, pinch = null, uiHidden = false;
  const touches = new Map();
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') { if (e.code === 'Escape') closeChat(); return; }
    keys[e.code] = true;
    if (state.mode !== 'play') return;
    if (state.dlg) {
      if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); dlgAdvance(); }
      const n = parseInt(e.key); if (n >= 1 && n <= 5) dlgChoose(n - 1);
      if (e.code === 'Escape') dlgClose();
      return;
    }
    if (state.wheel) { const n = parseInt(e.key); if (n >= 1 && n <= 9) { doEmote(ISL.EMOTES[n - 1].id); toggleWheel(false); } if (e.code === 'Escape' || e.code === 'KeyG') toggleWheel(false); return; }
    if (e.code === 'KeyE') interact();
    if (e.code === 'Enter') { e.preventDefault(); openChat(); }
    if (e.code === 'KeyG') toggleWheel();
    if (e.code === 'KeyM') toggleMap();
    if (e.code === 'KeyJ' || e.code === 'Tab') { e.preventDefault(); togglePassport(); }
    if (e.code === 'KeyT') cycleTime();
    if (e.code === 'KeyF') toggleFly();
    if (e.code === 'KeyH') toggleUI();
    if (e.code === 'Escape') closeModals();
    if (e.code === 'Space') { e.preventDefault(); jump(); }
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  function jump() { if (player.seat) { standUp(); return; } if (!player.fly && player.ground && !player.swim) { player.vy = 5.4; player.ground = false; } }
  function setupPointer() {
    const el = renderer.domElement;
    el.addEventListener('pointerdown', e => {
      A.init();
      if (e.pointerType === 'touch') {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (e.clientX < innerWidth * .42 && state.mode === 'play' && !joy.active) { joy = { x: 0, y: 0, active: true, id: e.pointerId, ox: e.clientX, oy: e.clientY }; showJoy(e.clientX, e.clientY, 0, 0); return; }
        const others = [...touches.keys()].filter(k => k !== joy.id);
        if (others.length === 2) { const [a, b] = others.map(k => touches.get(k)); pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: cam.dist }; drag = null; return; }
      }
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
      if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (joy.active && e.pointerId === joy.id) { let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const l = Math.hypot(dx, dy), m = 55; if (l > m) { dx *= m / l; dy *= m / l; } joy.x = dx / m; joy.y = dy / m; showJoy(joy.ox, joy.oy, dx, dy); return; }
      if (pinch) { const others = [...touches.keys()].filter(k => k !== joy.id); if (others.length === 2) { const [a, b] = others.map(k => touches.get(k)); cam.dist = Math.max(4, Math.min(60, pinch.dist * pinch.d / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)))); } return; }
      if (drag && e.pointerId === drag.id) { const k = MOBILE ? .007 : .005; cam.yaw -= (e.clientX - drag.x) * k; cam.pitch = Math.max(-.25, Math.min(1.35, cam.pitch + (e.clientY - drag.y) * k * .8)); drag.x = e.clientX; drag.y = e.clientY; }
    });
    const up = e => { touches.delete(e.pointerId); if (joy.active && e.pointerId === joy.id) { joy = { x: 0, y: 0, active: false }; $('joy').style.display = 'none'; } if (drag && e.pointerId === drag.id) drag = null; if (touches.size < 2) pinch = null; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => { cam.dist = Math.max(4, Math.min(60, cam.dist * (1 + Math.sign(e.deltaY) * .1))); }, { passive: true });
  }
  function showJoy(x, y, dx, dy) { const j = $('joy'); j.style.display = 'block'; j.style.left = (x - 60) + 'px'; j.style.top = (y - 60) + 'px'; $('knob').style.transform = `translate(${dx}px,${dy}px)`; }

  // ---------- UI ----------
  const state = { mode: 'loading', dlg: null, region: null, nearest: null, modal: null, inside: null, wheel: false, fading: false };
  ISL.onSong = name => toast('♪ ' + name, 4200);
  function toast(html, ms = 3200) {
    const d = document.createElement('div'); d.className = 'toast'; d.innerHTML = html; $('toasts').appendChild(d);
    setTimeout(() => d.classList.add('out'), ms); setTimeout(() => d.remove(), ms + 600);
  }
  ISL.toast = toast;
  function banner(r) {
    const b = $('banner'); b.innerHTML = `<div class="flag">${r.flag}</div><div><b>${r.name}</b><span>${r.hello}</span></div>`;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); $('where').textContent = `${r.flag} ${r.name}`;
  }
  function closeModals() { $('map').classList.remove('open'); $('passport').classList.remove('open'); state.modal = null; toggleWheel(false); }
  function toggleUI() { uiHidden = !uiHidden; document.body.classList.toggle('photo', uiHidden); if (uiHidden) toast('📷 사진 모드 — H 키나 화면 아래 버튼으로 돌아와요', 2500); }
  function fade(fn) { if (state.fading) return; state.fading = true; const f = $('fade'); f.classList.add('on'); setTimeout(() => { fn(); setTimeout(() => { f.classList.remove('on'); state.fading = false; }, 120); }, 330); }

  // ---------- 대화 ----------
  function flagOf(n) { return ISL.REGIONS.find(r => r.id === n.d.region).flag; }
  function talkTo(n) {
    A.chime([0, 4, 7], .06);
    n.face = Math.atan2(player.x - n.x, player.z - n.z); player.face = Math.atan2(n.x - player.x, n.z - player.z);
    const d = n.d, pages = [];
    if (!S.met[d.id]) { pages.push(d.hello, d.intro); S.met[d.id] = 1; save(); } else pages.push(d.hello);
    if (d.gives && !S.gifted[d.id]) pages.push(d.giveText);
    openDlg(d.name, flagOf(n), pages, () => {
      if (d.gives && !S.gifted[d.id]) { S.gifted[d.id] = 1; S.items[d.gives] = (S.items[d.gives] || 0) + 1; save(); toast(`가방에 <b>${ITEMS[d.gives]}</b>을(를) 넣었어요`); A.chime([7, 12], .07); }
      return menu(n);
    });
  }
  function menu(n) {
    const d = n.d, q = S.quests[d.id] || 0;
    const ch = [['이곳에 대해 알려 줘', () => say(n, d.about)], ['추천할 만한 곳 있어?', () => say(n, d.tip)], ['요즘 어떻게 지내?', () => say(n, d.life)]];
    if (q < 2) ch.push([q === 0 ? '내가 도와줄 일 있어?' : (S.items[d.wants] ? `${ITEMS[d.wants]} 건네기` : '부탁했던 거 말인데…'), () => quest(n)]);
    else ch.push(['우리 친구지? 💛', () => say(n, d.after)]);
    ch.push(['또 봐요! 👋', null]);
    return { text: q === 2 ? '또 무슨 얘기를 해 볼까요?' : '무엇이 궁금해요?', choices: ch };
  }
  function say(n, text) { openDlg(n.d.name, flagOf(n), [text], () => menu(n)); }
  function quest(n) {
    const d = n.d, q = S.quests[d.id] || 0;
    if (q === 0) { S.quests[d.id] = 1; save(); openDlg(d.name, flagOf(n), [d.ask], () => { toast(`📔 수첩에 <b>${d.name}</b>의 부탁을 적었어요`); return menu(n); }); }
    else if (S.items[d.wants]) {
      S.items[d.wants]--; if (!S.items[d.wants]) delete S.items[d.wants]; S.quests[d.id] = 2; save();
      openDlg(d.name, flagOf(n), [d.thanks], () => { A.chime([0, 4, 7, 12, 16], .08); toast(`💛 <b>${d.name}</b>와(과) 친구가 되었어요!`, 4000); hearts(n.m.g.position); n.m.emote = { id: 'cheer', t: 0 }; checkComplete(); return menu(n); });
    } else openDlg(d.name, flagOf(n), [d.remind], () => menu(n));
  }
  let heartFx = null;
  function hearts(p) { if (!heartFx) heartFx = new ISL.Emitter(scene, 120, { size: 2, color: '#ff6b8b', opacity: 1, life: 1.6, additive: true }); for (let i = 0; i < 30; i++) heartFx.emit(p.x, p.y + 2.2, p.z, (rng() - .5) * 4, 3 + rng() * 3, (rng() - .5) * 4, 1.6); }

  function openDlg(name, flag, pages, onEnd) { state.dlg = { name, flag, pages, i: 0, shown: 0, onEnd, choices: null }; $('dlg').classList.add('open'); $('dlgName').textContent = `${flag} ${name}`; renderDlg(); }
  function renderDlg() {
    const d = state.dlg; if (!d) return;
    const txt = d.choices ? d.menuText : d.pages[d.i];
    $('dlgText').textContent = txt.slice(0, Math.floor(d.shown));
    const box = $('dlgChoices'); box.innerHTML = '';
    if (d.choices && d.shown >= txt.length) d.choices.forEach(([t], i) => { const b = document.createElement('button'); b.textContent = `${i + 1}. ${t}`; b.onclick = () => dlgChoose(i); box.appendChild(b); });
    $('dlgNext').style.visibility = !d.choices && d.shown >= txt.length ? 'visible' : 'hidden';
  }
  function dlgAdvance() {
    const d = state.dlg; if (!d) return;
    const txt = d.choices ? d.menuText : d.pages[d.i];
    if (d.shown < txt.length) { d.shown = txt.length; renderDlg(); return; }
    if (d.choices) return;
    if (d.i < d.pages.length - 1) { d.i++; d.shown = 0; renderDlg(); return; }
    const next = d.onEnd && d.onEnd();
    if (next && state.dlg === d) { d.choices = next.choices; d.menuText = next.text; d.shown = 0; renderDlg(); }
    else if (!next && state.dlg === d) dlgClose();
  }
  function dlgChoose(i) { const d = state.dlg; if (!d || !d.choices || !d.choices[i]) return; A.chime([4], .04); const fn = d.choices[i][1]; if (!fn) { dlgClose(); return; } fn(); }
  function dlgClose() { state.dlg = null; $('dlg').classList.remove('open'); }

  // ---------- 상호작용 ----------
  function interact() {
    if (state.inside) return interactInside();
    const n = state.nearest; if (!n) return;
    if (n.kind === 'npc') talkTo(n.o);
    else if (n.kind === 'tourist') { const r = ISL.regionAt(n.o.x, n.o.z); openDlg('여행자', '🧳', [`${r.hello} ${n.o.line}`], null); n.o.line = TOURIST_LINES[Math.floor(rng() * TOURIST_LINES.length)]; n.o.m.emote = { id: 'wave', t: 0 }; }
    else if (n.kind === 'pickup') {
      const p = n.o; S.items[p.id] = (S.items[p.id] || 0) + 1; save(); scene.remove(p.g); pickups.splice(pickups.indexOf(p), 1);
      A.chime([7, 11, 14], .08); toast(`가방에 <b>${ITEMS[p.id]}</b>을(를) 넣었어요`);
    } else if (n.kind === 'elevator') {
      const e = n.o, ch = e.levels.filter(([nm, y]) => Math.abs(y - player.y) > 1).map(([nm, y]) => [`🛗 ${nm}`, () => { dlgClose(); fade(() => { player.y = y; player.vy = 0; cam.curDist = undefined; }); A.chime([0, 4, 7], .05); }]);
      ch.push(['그만두기', null]);
      openDlg(e.name, '🗼', ['어느 층으로 갈까요? 위로 갈수록 바람이 세고 섬이 한눈에 보여요.'], () => ({ text: '층을 골라 주세요', choices: ch }));
    } else if (n.kind === 'door') {
      const d = n.o; if (d.target) { d.open = 1; enterHouse(d); } else { ISL.Interior.toggle(d, true); setTimeout(() => { if (!state.inside && d.target && Math.hypot(player.x - d.x, player.z - d.z) < 3.2) enterHouse(d); }, 750); } // 문이 열리면 그대로 안으로 들어감
    }
  }
  // 집 안으로
  const interiorCache = new Map();
  function enterHouse(door) {
    if (state.inside || state.fading) return;
    fade(() => {
      let it = interiorCache.get(door); if (!it) { it = ISL.Interior.build(door); interiorCache.set(door, it); if (interiorCache.size > 6) interiorCache.delete(interiorCache.keys().next().value); }
      state.inside = it; scene.remove(pm.g); it.scene.add(pm.g); glider.visible = false; player.fly = false; document.body.classList.remove('flying');
      it.outside = { x: player.x, z: player.z };
      player.x = it.spawn.x; player.z = it.spawn.z; player.y = 0; player.vy = 0; player.face = it.spawn.face; player.seat = null; pm.emote = null;
      cam.yaw = Math.PI + .7; cam.pitch = .5; cam.tx = player.x; cam.ty = 1.5; cam.tz = player.z; cam.curDist = undefined; cam.ix = cam.iy = cam.iz = undefined;
      it.exit.target = 0; ISL.Interior.toggle(door, false);
      A.setInside(true);
      $('where').textContent = door.hall ? `🏛️ ${ISL.Halls.names[door.hall]}` : '🏠 실내'; document.body.classList.add('inside');
      if (it.resident) setTimeout(() => { if (state.inside === it) { ISL.bubble(it.resident.m.g, it.resident.hello); it.resident.m.emote = { id: 'wave', t: 0 }; } }, 600);
    });
  }
  function exitHouse() {
    const it = state.inside; if (!it || state.fading) return;
    it.exit.target = 1; A.door(true, it.door.sliding);
    setTimeout(() => fade(() => {
      it.scene.remove(pm.g); scene.add(pm.g); ISL.clearBubbles();
      const d = it.door, sn = Math.sin(d.a), cs = Math.cos(d.a);
      player.x = d.x + sn * 1.2; player.z = d.z + cs * 1.2; player.y = groundAt(player.x, player.z); player.face = d.a; cam.yaw = d.a; cam.pitch = .3; player.seat = null; pm.emote = null; cam.curDist = undefined;
      state.inside = null; it.exit.target = 0; it.exit.open = 0;
      ISL.Interior.toggle(d, true); d.timer = 5.2;
      A.setInside(false); document.body.classList.remove('inside'); state.region = null; seasonKey = '';
    }), 350);
  }
  function interactInside() {
    const it = state.inside, n = state.nearest; if (!n) return;
    const a = n.o.act;
    if (a === 'exit') return exitHouse();
    if (a === 'sit') { const s = n.o.seat; player.seat = s; player.x = s.x; player.z = s.z; player.face = s.ry; pm.emote = { id: 'sit', t: 0 }; toast('🪑 앉았어요 — 움직이면 일어나요', 1800); return; }
    if (a === 'rest') { fade(() => { tDay = (tDay > .7 || tDay < .25) ? .28 : (tDay + .12) % 1; envDirty = true; }); setTimeout(() => toast('😴 푹 쉬었어요. 몸이 가뿐해요!', 2600), 500); return; }
    if (a === 'warm') { toast('🔥 따뜻해요… 장작 타는 소리가 좋네요', 2200); return; }
    if (a === 'resident') { const r = it.resident; r.m.g.rotation.y = Math.atan2(player.x - r.x, player.z - r.z); r.m.emote = { id: 'wave', t: 0 }; openDlg(r.name, ISL.REGIONS[it.door.region].flag, [r.hello + ' ' + r.lines[r.i % r.lines.length]], null); r.i++; return; }
    if (typeof a === 'function') a();
  }
  function standUp() { player.seat = null; pm.emote = null; }

  // 명소 발견
  function checkDiscover() {
    for (const L of ISL.LANDMARKS) {
      if (S.found[L.id] || Math.hypot(player.x - L.x, player.z - L.z) > L.r) continue;
      S.found[L.id] = 1; save(); A.chime([0, 7, 12, 16], .07);
      toast(`<div class="stamp">📮 새 명소 발견!</div><b>${L.name}</b><br><small>${L.desc}</small><br><small>스탬프 ${Object.keys(S.found).length} / ${ISL.LANDMARKS.length}</small>`, 6500);
      checkComplete();
    }
  }
  function checkComplete() {
    const all = ISL.LANDMARKS.every(L => S.found[L.id]) && NPCS.every(d => S.quests[d.id] === 2);
    if (all && !S.completed) { S.completed = 1; save(); setTimeout(() => { toast('<div class="stamp">🎉 여행 완료!</div>모든 명소를 돌아보고 다섯 친구를 사귀었어요.<br>이 섬은 언제든 다시 걸으러 와도 좋아요. 💛', 9000); A.chime([0, 4, 7, 12, 16, 19, 24], .08); }, 1500); }
  }

  // ---------- 감정표현 & 채팅 ----------
  function toggleWheel(v) { state.wheel = v === undefined ? !state.wheel : v; $('wheel').classList.toggle('open', state.wheel); }
  function doEmote(id) { if (player.fly) return; Net.send('emote', { id }); }
  Net.on('emote', msg => {
    if (msg.from !== Net.id) return; // (멀티플레이: 다른 사람 아바타에 적용)
    pm.emote = { id: msg.id, t: 0 }; if (msg.id !== 'sit') player.seat = null;
    if (msg.id === 'heart') hearts(pm.g.position);
    if (msg.id === 'laugh') ISL.bubble(pm.g, '😂', 2.2, 'emo'); if (msg.id === 'cry') ISL.bubble(pm.g, '😢', 2.6, 'emo');
    const react = { wave: 'wave', bow: 'bow', dance: 'clap', heart: 'heart', cheer: 'clap', clap: 'cheer', laugh: 'laugh' }[msg.id];
    if (!react) return;
    const near = state.inside ? (state.inside.resident ? [state.inside.resident] : []) : npcs.concat(tourists);
    for (const n of near) if (Math.hypot(n.x - player.x, n.z - player.z) < 10) setTimeout(() => { n.m.emote = { id: react, t: 0 }; if (react === 'heart') ISL.bubble(n.m.g, '💕', 2, 'emo'); }, 400 + rng() * 500);
  });
  function openChat() { if (state.dlg) return; $('chatbox').classList.add('open'); const i = $('chatIn'); i.value = ''; setTimeout(() => i.focus(), 30); }
  function closeChat() { $('chatbox').classList.remove('open'); $('chatIn').blur(); }
  function sendChat() { const t = $('chatIn').value.trim().slice(0, 80); closeChat(); if (t) Net.send('chat', { text: t }); }
  Net.on('chat', msg => {
    const me = msg.from === Net.id;
    if (me) ISL.bubble(pm.g, msg.text, 6); ISL.chatLog(me ? '나' : msg.name, msg.text, me);
    if (!me) return;
    const greet = /안녕|하이|hello|hi\b|hey|반가|bonjour|olá|ola|halló|grüezi|こんにちは|헬로/i.test(msg.text);
    const thanks = /고마|감사|thank|merci|obrigad|ありがと|takk/i.test(msg.text);
    const near = state.inside ? (state.inside.resident ? [{ m: state.inside.resident.m, x: state.inside.resident.x, z: state.inside.resident.z, name: state.inside.resident.name, hello: state.inside.resident.hello }] : [])
      : npcs.map(n => ({ m: n.m, x: n.x, z: n.z, name: n.d.name, hello: n.d.hello.split(' ')[0] })).concat(tourists.map(t => ({ m: t.m, x: t.x, z: t.z, name: '여행자', hello: '안녕하세요!' })));
    const n = near.filter(n => Math.hypot(n.x - player.x, n.z - player.z) < 12).sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z))[0];
    if (!n || !(greet || thanks || rng() < .5)) return;
    const reply = greet ? n.hello + ' 😊' : thanks ? '천만에요! 💛' : ['그렇군요!', '하하, 재밌네요 😄', '좋은 하루 보내요!', '오늘 날씨 참 좋죠?', '맞아요, 맞아요!'][Math.floor(rng() * 5)];
    setTimeout(() => { ISL.bubble(n.m.g, reply, 5); ISL.chatLog(n.name, reply); n.m.emote = { id: greet ? 'wave' : 'laugh', t: 0 }; }, 700);
  });

  // ---------- 수첩 & 지도 ----------
  function togglePassport() { if (state.modal === 'passport') return closeModals(); closeModals(); state.modal = 'passport'; $('passport').classList.add('open'); renderPassport(); }
  let ppTab = 'stamps';
  function renderPassport() {
    const body = $('ppBody'); let h = '';
    document.querySelectorAll('#passport .tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === ppTab));
    if (ppTab === 'stamps') {
      h += `<p class="sum">발견한 명소 <b>${Object.keys(S.found).length}</b> / ${ISL.LANDMARKS.length}</p>`;
      for (const r of ISL.REGIONS) {
        h += `<h3>${r.flag} ${r.name}</h3><div class="stamps">`;
        for (const L of ISL.LANDMARKS.filter(l => l.region === r.id)) { const f = S.found[L.id]; h += `<div class="st ${f ? 'on' : ''}"><b>${f ? '✅' : '❔'} ${f ? L.name : '???'}</b>${f ? `<small>${L.desc}</small>` : `<small>${r.name} 어딘가에 있어요</small>`}</div>`; }
        h += '</div>';
      }
    } else if (ppTab === 'friends') {
      h += `<p class="sum">친구 <b>${NPCS.filter(d => S.quests[d.id] === 2).length}</b> / ${NPCS.length}</p><div class="stamps">`;
      for (const d of NPCS) {
        const r = ISL.REGIONS.find(x => x.id === d.region), q = S.quests[d.id] || 0, met = S.met[d.id];
        const st = q === 2 ? '💛 친구' : q === 1 ? `📝 부탁: ${ITEMS[d.wants]}${S.items[d.wants] ? ' — 가방에 있어요!' : ''}` : met ? '👋 인사를 나눴어요' : '아직 만나지 못했어요';
        h += `<div class="st ${q === 2 ? 'on' : ''}"><b>${r.flag} ${met ? d.name : '???'}</b><small>${st}</small>${q === 1 ? `<small class="hint">💡 ${d.remind}</small>` : ''}</div>`;
      }
      h += '</div>';
    } else {
      const ks = Object.keys(S.items).filter(k => S.items[k] > 0);
      h += ks.length ? '<div class="stamps">' + ks.map(k => `<div class="st on"><b>${ITEMS[k]}</b><small>× ${S.items[k]}</small></div>`).join('') + '</div>' : '<p class="sum">가방이 비어 있어요. 반짝이는 곳을 찾아보거나 사람들과 이야기해 보세요.</p>';
      h += `<p class="sum" style="margin-top:18px"><button id="resetBtn" class="ghost">처음부터 다시 여행하기</button></p>`;
    }
    body.innerHTML = h;
    const rb = $('resetBtn'); if (rb) rb.onclick = () => { if (rb.dataset.armed) { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} location.reload(); } else { rb.dataset.armed = 1; rb.textContent = '한 번 더 누르면 기록이 지워져요'; } };
  }
  let mapImg = null;
  function buildMapImage() {
    const S2 = 400, c = document.createElement('canvas'); c.width = c.height = S2; const x = c.getContext('2d'), img = x.createImageData(S2, S2);
    const N = ISL.N, G = ISL.groundColors, LUg = ISL.groundLU, grid = ISL.getGrid();
    const sr = v => 255 * Math.min(1, v <= .0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - .055);
    for (let j = 0; j < S2; j++) for (let i = 0; i < S2; i++) {
      const gi = Math.min(N - 2, Math.floor(i / S2 * (N - 1))), gj = Math.min(N - 2, Math.floor(j / S2 * (N - 1))), k = gj * N + gi, h = grid[k];
      let r, g, b;
      if (h < 0 || LUg[k] === 4) { const d = Math.min(1, Math.max(0, -h) / 25); r = 90 - d * 50; g = 165 - d * 60; b = 200 - d * 40; }
      else { const sh = Math.max(.6, Math.min(1.3, 1 + (grid[k] - grid[k + N + 1]) * .06)); r = sr(G[k * 3]) * sh; g = sr(G[k * 3 + 1]) * sh; b = sr(G[k * 3 + 2]) * sh; }
      const o = (j * S2 + i) * 4; img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
    x.putImageData(img, 0, 0); mapImg = c.toDataURL();
  }
  const toMap = (x, z) => [((x + ISL.E) / (2 * ISL.E) * 100).toFixed(2) + '%', ((z + ISL.E) / (2 * ISL.E) * 100).toFixed(2) + '%'];
  function toggleMap() {
    if (state.modal === 'map') return closeModals();
    closeModals(); state.modal = 'map'; $('map').classList.add('open');
    const box = $('mapBox'); box.style.backgroundImage = `url(${mapImg})`; box.innerHTML = '';
    for (const r of ISL.REGIONS) { const [l, t] = toMap(r.x, r.z), d = document.createElement('div'); d.className = 'rlabel'; d.style.left = l; d.style.top = t; d.textContent = `${r.flag} ${r.name}`; box.appendChild(d); }
    for (const L of ISL.LANDMARKS) {
      const [l, t] = toMap(L.x, L.z), b = document.createElement('button'); b.className = 'pin' + (S.found[L.id] ? ' on' : '');
      b.style.left = l; b.style.top = t; b.innerHTML = `<span>${S.found[L.id] ? '📍' : '❔'}</span><em>${S.found[L.id] ? L.name : '???'}</em>`; b.onclick = () => teleport(L); box.appendChild(b);
    }
    for (const n of npcs) { const [l, t] = toMap(n.x, n.z), d = document.createElement('div'); d.className = 'npcpin'; d.style.left = l; d.style.top = t; d.textContent = S.quests[n.d.id] === 2 ? '💛' : '💬'; box.appendChild(d); }
    for (const p of pickups) { const [l, t] = toMap(p.x, p.z), d = document.createElement('div'); d.className = 'npcpin'; d.style.left = l; d.style.top = t; d.textContent = '✨'; box.appendChild(d); }
    const px = state.inside ? state.inside.outside.x : player.x, pz = state.inside ? state.inside.outside.z : player.z;
    const [l, t] = toMap(px, pz), me = document.createElement('div'); me.className = 'me'; me.style.left = l; me.style.top = t; me.style.transform = `translate(-50%,-50%) rotate(${-player.face + Math.PI}rad)`; me.textContent = '▲'; box.appendChild(me);
  }
  function teleport(L) {
    const go = () => {
      let best = null;
      for (let k = 0; k < 60; k++) { const a = k * .7, r = Math.min(L.r * .6, 30) + k * .5, x = L.x + Math.sin(a) * r, z = L.z + Math.cos(a) * r; if (!deepWater(x, z) && ISL.H(x, z) > .5 && ISL.slopeAt(x, z) < .4 && !ISL.world.solidAt(x, ISL.H(x, z) + 1, z)) { best = [x, z]; break; } }
      if (!best) best = [L.x, L.z];
      player.x = best[0]; player.z = best[1]; player.y = groundAt(best[0], best[1]) + (player.fly ? 15 : 0); player.vy = 0;
      cam.yaw = Math.atan2(L.x - player.x, L.z - player.z) || cam.yaw; player.face = cam.yaw; cam.curDist = undefined;
    };
    closeModals();
    if (state.inside) { const it = state.inside; it.scene.remove(pm.g); scene.add(pm.g); state.inside = null; A.setInside(false); document.body.classList.remove('inside'); }
    fade(go); A.chime([12, 7], .06); toast(`✈️ ${L.name} 근처로 이동했어요`, 2000);
  }
  function cycleTime() { let i = TIME_PRESETS.findIndex(p => p[0] > tDay + .01); if (i < 0) i = 0; tDay = TIME_PRESETS[i][0]; toast(TIME_PRESETS[i][1], 1500); envDirty = true; }
  function toggleFly() {
    if (state.inside) return toast('🏠 실내에서는 날 수 없어요', 1500);
    player.fly = !player.fly; glider.visible = player.fly; player.seat = null; pm.emote = null;
    if (player.fly) { player.vy = 0; player.y += 4; toast(MOBILE ? '🪂 패러글라이딩! ▲▼ 버튼으로 높이 조절' : '🪂 패러글라이딩! Space 위로 · C 아래로 · F 내리기', 3000); cam.dist = Math.max(cam.dist, 16); document.body.classList.add('flying'); }
    else { toast('🚶 착지!', 1200); document.body.classList.remove('flying'); }
  }

  // ---------- 장면 ----------
  let envDirty = true, envT = 0, xmasK = 0;
  function initScene() {
    renderer = new THREE.WebGLRenderer({ antialias: LQ || MOBILE, powerPreference: 'high-performance' }); ISL.renderer = renderer;
    renderer.setPixelRatio(LQ ? .5 : Math.min(devicePixelRatio || 1, MOBILE ? 1.3 : 1.75)); renderer.setSize(innerWidth, innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
    renderer.shadowMap.enabled = !LQ; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    $('app').appendChild(renderer.domElement);
    scene = new THREE.Scene(); ISL.scene = scene; scene.fog = new THREE.FogExp2('#bcd3e6', .00078);
    camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, .3, 7000); // 깊이 정밀도 → 바닥 깜빡임 방지
    addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); if (post) post.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
    sunLight = new THREE.DirectionalLight('#fff4e0', 2.6); sunLight.castShadow = true;
    const sm = MOBILE ? 1024 : 2048; sunLight.shadow.mapSize.set(sm, sm); const sc = sunLight.shadow.camera; sc.left = sc.bottom = -85; sc.right = sc.top = 85; sc.near = 1; sc.far = 900;
    sunLight.shadow.bias = -.0004; sunLight.shadow.normalBias = .6;
    scene.add(sunLight, sunLight.target);
    hemi = new THREE.HemisphereLight('#cfe3ff', '#5d6b45', .9); scene.add(hemi);
    pmrem = new THREE.PMREMGenerator(renderer);
    if (!LQ && !MOBILE && renderer.capabilities.isWebGL2) { post = new ISL.Post(renderer); // 폰에서는 후처리 없이 직접 그림 (iOS에서 검은 네모 깜빡임 방지)
 post.setSize(innerWidth, innerHeight); }
  }
  function updateEnv() {
    if (!envScene) { envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(sky.geometry, sky.material)); }
    const rt = pmrem.fromScene(envScene, 0, .1, 9000);
    if (scene.environment && scene.environment !== rt.texture) scene.environment.dispose();
    scene.environment = rt.texture; ISL.envTex = rt.texture;
  }
  const tmpV = new THREE.Vector3(), fogC = new THREE.Color(), lightC = new THREE.Color();
  function updateSky(dt) {
    tDay = (tDay + dt / DAY_SECONDS) % 1;
    // 크리스마스 마을(할그림스키르캬 주변)은 한겨울 아이슬란드처럼 늘 푸르스름한 해 질 녘
    { const hp = ISL.P.hallgrim, px = state.inside ? state.inside.outside.x : player.x, pz = state.inside ? state.inside.outside.z : player.z, target = hp ? 1 - ISL.sstep(190, 300, Math.hypot(px - hp.x, pz - hp.z)) : 0; xmasK += (target - xmasK) * Math.min(1, dt * .8); }
    let dd = .772 - tDay; if (dd > .5) dd -= 1; if (dd < -.5) dd += 1; const tEff = (tDay + dd * xmasK + 1) % 1;
    const a = (tEff - .25) * Math.PI * 2;
    const sun = ISL.U.uSun.value.set(Math.cos(a) * .85, Math.sin(a), -.38).normalize();
    const day = ISL.sstep(-.14, .22, sun.y), night = 1 - ISL.sstep(-.25, .03, sun.y), low = Math.exp(-Math.pow(sun.y * 4, 2));
    ISL.U.uDay.value = day; ISL.U.uNight.value = night;
    const isSun = sun.y > -.06, L = isSun ? sun : tmpV.copy(sun).negate();
    const snap = 170 / sunLight.shadow.mapSize.x, sx = Math.round(player.x / snap) * snap, sz = Math.round(player.z / snap) * snap;
    sunLight.position.set(sx + L.x * 400, player.y + L.y * 400, sz + L.z * 400); sunLight.target.position.set(sx, player.y, sz);
    if (isSun) { lightC.setRGB(1, .93 - low * .3, .85 - low * .5); sunLight.intensity = 2.8 * ISL.sstep(-.06, .12, sun.y); }
    else { lightC.setRGB(.55, .65, 1); sunLight.intensity = .35 * ISL.sstep(-.06, .3, -sun.y); }
    sunLight.color.copy(lightC);
    hemi.intensity = .25 + .8 * day; hemi.color.setRGB(.55 + .25 * day, .62 + .25 * day, .9); hemi.groundColor.setRGB(.25 * day + .05, .3 * day + .05, .2 * day + .08);
    renderer.toneMappingExposure = .95 + night * .25;
    if (post) post.exposure = state.inside ? 1.05 : .92 + night * .35 + low * .05;
    if (ISL.grass) {
      const gu = ISL.grass.uniforms; gu.uCenter.value.set(player.x, player.z); gu.uL.value.copy(L); gu.uLC.value.copy(lightC).multiplyScalar(sunLight.intensity);
      gu.uSkyC.value.copy(hemi.color).multiplyScalar(hemi.intensity * 1.9); gu.uGndC.value.copy(hemi.groundColor).multiplyScalar(hemi.intensity * 1.6);
    }
    camera.getWorldDirection(tmpV); tmpV.y = .02; tmpV.normalize();
    ISL.skyColJS(tmpV, sun, fogC); scene.fog.color.copy(fogC);
    for (const m of ISL.waterMats) { m.uniforms.uSunCol.value.copy(lightC).multiplyScalar(isSun ? 1 : .4); m.uniforms.uCam.value.copy(camera.position); }
    if (ISL.sea && !state.inside) { const st = ISL.sea.step; ISL.sea.sea.position.set(Math.round(camera.position.x / st) * st, 0, Math.round(camera.position.z / st) * st); ISL.sea.far.position.set(ISL.sea.sea.position.x, -.02, ISL.sea.sea.position.z); }
    if (ISL.clouds) { const cc = new THREE.Color().setRGB(.05 + .95 * day + low * .25, .06 + .9 * day + low * .02, .1 + .85 * day - low * .15); for (const m of ISL.clouds.mats) m.color.copy(cc); ISL.clouds.group.position.x = (performance.now() * .002) % 400; }
    for (const m of ISL.nightMats) m.emissiveIntensity = Math.min(1.3, night * 1.6);
    for (const m of ISL.glowMats || []) m.opacity = night * .55;
    if (ISL.eiffelLights) { const L2 = ISL.eiffelLights, on = night > .25, tt = performance.now() * .001; L2.im.visible = on; L2.beacon.visible = on; L2.beacon.rotation.y = tt * .6;
      const sp = on && (tt % 60) < 10; L2.sm.visible = sp; if (sp) { L2.sparkle.opacity = .5 + .5 * Math.sin(tt * 40); L2.sm.rotation.y = Math.floor(tt * 12) * 1.7; } }
    ISL.U.uTime.value += dt;
    sky.position.copy(camera.position);
    if (!state.inside) for (const c of ISL.chunks) { const bs = c.boundingSphere; c.visible = bs.center.distanceTo(camera.position) - bs.radius < c.userData.lod; }
    envT -= dt; if (envDirty || envT < 0) { envT = 3; envDirty = false; updateEnv(); }
    $('clock').textContent = (() => { const h = Math.floor(tEff * 24), m = Math.floor((tEff * 24 - h) * 60); return `${night > .5 ? '🌙' : low > .5 ? '🌅' : '☀️'} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; })();
  }

  // ---------- 물 효과: 물결 고리와 물방울 ----------
  let splashFx = null; const ripples = [];
  function ripple(x, y, z, big) {
    if (!splashFx) splashFx = new ISL.Emitter(scene, 160, { size: .55, color: '#e8f4ff', opacity: .9, life: .8 });
    let r = ripples.find(r => r.t > 1.4);
    if (!r && ripples.length < 14) { const m = new THREE.Mesh(new THREE.RingGeometry(.35, .5, 28), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; scene.add(m); r = { m, t: 2 }; ripples.push(r); }
    if (r) { r.t = 0; r.m.position.set(x, y + .04, z); r.big = big; }
    for (let i = 0; i < (big ? 26 : 7); i++) splashFx.emit(x + (rng() - .5) * .6, y + .1, z + (rng() - .5) * .6, (rng() - .5) * 2.5, 1.5 + rng() * (big ? 4 : 2), (rng() - .5) * 2.5, .8);
  }
  function updateRipples(dt) { for (const r of ripples) { r.t += dt; const k = Math.min(1, r.t / 1.4); r.m.scale.setScalar(1 + k * (r.big ? 9 : 5)); r.m.material.opacity = (1 - k) * .55; r.m.visible = k < 1; } if (splashFx) splashFx.update(dt, -9, .5); }

  // ---------- 플레이어 갱신 ----------
  function moveInput() {
    let ix = 0, iz = 0;
    if (keys.KeyW || keys.ArrowUp) iz += 1; if (keys.KeyS || keys.ArrowDown) iz -= 1;
    if (keys.KeyA || keys.ArrowLeft) ix -= 1; if (keys.KeyD || keys.ArrowRight) ix += 1;
    if (joy.active) { ix += joy.x; iz -= joy.y; }
    const il = Math.hypot(ix, iz); if (il > 1) { ix /= il; iz /= il; }
    const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw), rx = -Math.cos(cam.yaw), rz = Math.sin(cam.yaw);
    return [fx * iz + rx * ix, fz * iz + rz * ix];
  }
  let turnRate = 0;
  function turnTo(mx, mz, dt) { const tf = Math.atan2(mx, mz); let d = tf - player.face; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; const st = d * Math.min(1, dt * (player.fly ? 2.2 : 10)); player.face += st; turnRate += (st / Math.max(dt, 1e-3) - turnRate) * Math.min(1, dt * 4); }
  function footstep(surface) { const n = Math.floor(player.phase / Math.PI); if (n !== player.stepN) { player.stepN = n; A.step(surface); } }

  function updatePlayer(dt) {
    if (state.dlg) { player.speed = 0; if (!poseEmote(pm, dt)) walkPose(pm, 0, 0); return; }
    let [mx, mz] = moveInput(); const mag = Math.hypot(mx, mz);
    if (mag > .05 && (pm.emote || player.seat)) standUp();
    const run = keys.ShiftLeft || keys.ShiftRight || $('runBtn').classList.contains('on');
    const wl = ISL.waterAt(player.x, player.z), g0 = groundAt(player.x, player.z, player.y);
    const depth = wl.level - g0;
    player.swim = !player.fly && depth > 1.3;
    const wading = !player.fly && !player.swim && depth > .15 && player.y < wl.level;
    const sp = player.fly ? (run ? 26 : 13) : (run ? 9.5 : 4.4) * (player.swim ? .35 : wading ? .55 : 1);
    player.speed += ((mag > .05 ? sp * Math.min(1, mag) : 0) - player.speed) * Math.min(1, dt * 8);
    let nx = player.x, nz = player.z;
    if (mag > .05) { nx += mx / mag * player.speed * dt; nz += mz / mag * player.speed * dt; turnTo(mx, mz, dt); }
    // 강물에 떠밀림
    if ((player.swim || wading) && wl.kind === 'river') {
      for (const r of ISL.rivers) { const q = ISL.riverNearest(r, player.x, player.z); if (q && q.d < q.w) { const l = Math.hypot(q.tx, q.tz) || 1, v = (r.speed ? r.speed[q.i] : 1) * (player.swim ? 1.6 : .7); nx += q.tx / l * v * dt; nz += q.tz / l * v * dt; break; } }
    }
    if (!player.fly && !player.swim && mag > .05) {
      const g1 = groundAt(nx, nz, player.y), g0b = groundAt(player.x, player.z, player.y), run2 = Math.hypot(nx - player.x, nz - player.z) || 1e-3;
      if ((g1 - g0b) / run2 > 1.25 && g1 > player.y + .35) { // 너무 가파르면 막힘
        const gx = groundAt(nx, player.z, player.y), gz = groundAt(player.x, nz, player.y);
        if ((gx - g0b) / run2 <= 1.25) nz = player.z; else if ((gz - g0b) / run2 <= 1.25) nx = player.x; else { nx = player.x; nz = player.z; }
      }
    }
    if (Math.hypot(nx, nz) < 930) {
      // 다리 위에서는 난간 밖으로 떨어지지 않게
      for (const w of ISL.walkables) { const q0 = ISL.segDist(player.x, player.z, w.ax, w.az, w.bx, w.bz); if (w.noRail || player.fly || q0.d > w.hw || Math.abs(player.y - ISL.deckY(w, q0.t)) > .6) continue; const q1 = ISL.segDist(nx, nz, w.ax, w.az, w.bx, w.bz); if (q1.t > .03 && q1.t < .97 && q1.d > w.hw - .3) { const px = w.ax + (w.bx - w.ax) * q1.t, pz = w.az + (w.bz - w.az) * q1.t, k = (w.hw - .3) / q1.d; nx = px + (nx - px) * k; nz = pz + (nz - pz) * k; } }
      [nx, nz] = ISL.world.resolve(nx, nz, player.fly ? .9 : .32, player.y, player.fly ? 6 : 1.8);
      player.x = nx; player.z = nz;
    }
    // 문이 열린 집 안으로 걸어 들어가면 실내로
    if (!player.fly) for (const c of ISL.world.near(player.x, player.z, 1)) {
      if (!c.door || c.door.open < .55) continue; const [lx, lz] = ISL.world.toLocal(c, player.x, player.z);
      if (Math.abs(lx) < c.hw && Math.abs(lz) < c.hd - .5) { enterHouse(c.door); break; }
    }
    player.onDeck = false;
    const g = groundAt(player.x, player.z, player.y);
    if (player.fly) {
      let vy = -1.5; if (keys.Space || upHeld) vy = 18; if (keys.KeyC || keys.ControlLeft || downHeld) vy = -22;
      player.y = Math.max(g + 1.5, Math.min(420, player.y + vy * dt));
    } else if (player.swim) {
      const wave = wl.kind === 'sea' ? ISL.waveY(player.x, player.z, ISL.U.uTime.value) : 0;
      const ty = wl.level + wave - 1.05; if (player.y > ty + 1 && player.vy < -3) { ripple(player.x, wl.level + wave, player.z, true); A.splash(true); }
      player.y += (ty - player.y) * Math.min(1, dt * 5); player.vy = 0; player.ground = true;
      if ((player.splashT -= dt) < 0 && player.speed > 1) { player.splashT = .55; ripple(player.x, wl.level + wave, player.z); A.step('water'); }
    } else {
      player.vy -= 20 * dt; player.y += player.vy * dt;
      if (player.y <= g) { if (player.vy < -8 && wading) { ripple(player.x, wl.level, player.z, true); A.splash(true); } player.y = g; player.vy = 0; player.ground = true; } else if (player.y - g > .4) player.ground = false;
      if (player.ground && player.y - g < .6) player.y = g;
      if (player.ground && player.speed > 1) {
        if (wading) { if ((player.splashT -= dt) < 0) { player.splashT = .35; ripple(player.x, wl.level, player.z); } footstep('water'); }
        else { const lu = ISL.Land.landuseAt(player.x, player.z), W = ISL.weights(player.x, player.z); footstep(player.onDeck ? 'wood' : lu === 2 || lu === 3 ? 'stone' : (W[1] > .5 && g > 120) || (W[0] > .5 && g > 62) ? 'snow' : 'grass'); }
      }
    }
    pm.g.position.set(player.x, player.y, player.z); pm.g.rotation.y = player.face;
    player.phase += dt * Math.min(player.speed, 12) * 1.55;
    if (!poseEmote(pm, dt)) {
      walkPose(pm, player.phase, player.fly ? 0 : Math.min(.85, player.speed * .1));
      if (player.swim) { const sw = Math.sin(player.phase * 1.5); pm.armL.rotation.x = -2.2 + sw; pm.armR.rotation.x = -2.2 - sw; }
      if (player.fly) { // 하네스에 앉아 브레이크 줄을 잡은 자세
        pm.armL.rotation.set(-2.75, 0, -.25); pm.armR.rotation.set(-2.75, 0, .25); pm.legL.rotation.x = -.35; pm.legR.rotation.x = -.2; pm.body.position.y = .3; // 줄에 매달린 자세 (의자 없음)
        const t = performance.now() * .001; glider.rotation.z = Math.sin(t * .9) * .04 - turnRate * .25; glider.rotation.x = Math.sin(t * .7) * .02 + .05; }
    }
  }
  function updatePlayerInside(dt) {
    const it = state.inside;
    if (state.dlg) { if (!poseEmote(pm, dt)) walkPose(pm, 0, 0); return; }
    const [mx, mz] = moveInput(), mag = Math.hypot(mx, mz);
    if (mag > .05 && (pm.emote || player.seat)) standUp();
    const sp = keys.ShiftLeft || $('runBtn').classList.contains('on') ? 3.6 : 1.9;
    player.speed += ((mag > .05 ? sp * Math.min(1, mag) : 0) - player.speed) * Math.min(1, dt * 10);
    if (mag > .05) { let nx = player.x + mx / mag * player.speed * dt, nz = player.z + mz / mag * player.speed * dt; [nx, nz] = it.phys.resolve(nx, nz, .28, 0); player.x = nx; player.z = nz; turnTo(mx, mz, dt); }
    if (player.z > it.D / 2 - .5 && Math.abs(player.x) < .65 && mag > .05 && mz > 0) exitHouse();
    pm.g.position.set(player.x, 0, player.z); pm.g.rotation.y = player.face;
    player.phase += dt * player.speed * 2.6;
    if (player.speed > .5) footstep(it.door.style === 'machiya' || it.door.style === 'farm' ? 'grass' : 'wood');
    if (!poseEmote(pm, dt)) walkPose(pm, player.phase, Math.min(.75, player.speed * .3));
    if (player.seat) pm.body.position.y += player.seat.y - .05;
  }
  function updateCamera(dt) {
    const it = state.inside;
    const tx = player.x, ty = player.y + (it ? 1.35 : player.fly ? 3 : 1.6), tz = player.z;
    cam.tx += (tx - cam.tx) * Math.min(1, dt * 10); cam.ty += (ty - cam.ty) * Math.min(1, dt * 8); cam.tz += (tz - cam.tz) * Math.min(1, dt * 10);
    if (!drag && player.speed > 3 && !state.dlg && !it) { let d = player.face - cam.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; cam.yaw += d * dt * .6; }
    const cp = Math.cos(cam.pitch);
    let dist = it ? Math.min(cam.dist, 4.2) : state.dlg ? Math.min(cam.dist, 9) : cam.dist;
    const dirx = -Math.sin(cam.yaw) * cp, diry = Math.sin(cam.pitch), dirz = -Math.cos(cam.yaw) * cp;
    if (it) { // 방 안: 카메라가 벽을 따라 미끄러지며 방 전체가 보이게
      const cx = Math.max(-it.W / 2 + .3, Math.min(it.W / 2 - .3, cam.tx + dirx * dist)), cz = Math.max(-it.D / 2 + .3, Math.min(it.D / 2 - .3, cam.tz + dirz * dist)), cy = Math.max(.5, Math.min(it.HT - .25, cam.ty + diry * dist));
      cam.ix = cam.ix === undefined ? cx : cam.ix + (cx - cam.ix) * Math.min(1, dt * 8); cam.iz = cam.iz === undefined ? cz : cam.iz + (cz - cam.iz) * Math.min(1, dt * 8); cam.iy = cam.iy === undefined ? cy : cam.iy + (cy - cam.iy) * Math.min(1, dt * 8);
      if (camera.fov !== 70) { camera.fov = 70; camera.updateProjectionMatrix(); }
      camera.position.set(cam.ix, cam.iy, cam.iz); camera.lookAt(cam.tx, cam.ty, cam.tz); return;
    } else { // 건물·나무에 카메라가 박히지 않게
      for (let s = 1; s <= dist; s += .8) { const x = cam.tx + dirx * s, z = cam.tz + dirz * s, y = cam.ty + diry * s; if (ISL.world.solidAt(x, y, z)) { dist = Math.max(1.5, s - .8); break; } }
    }
    cam.curDist = cam.curDist === undefined ? dist : cam.curDist + (dist - cam.curDist) * Math.min(1, dt * (dist < cam.curDist ? 20 : 4));
    if (camera.fov !== 55) { camera.fov = 55; camera.updateProjectionMatrix(); }
    const x = cam.tx + dirx * cam.curDist, z = cam.tz + dirz * cam.curDist; let y = cam.ty + diry * cam.curDist;
    if (!it) { const w = ISL.waterAt(x, z), gy = Math.max(groundAt(x, z), w.level + (w.kind === 'sea' ? ISL.waveY(x, z, ISL.U.uTime.value) : 0)) + 1.7; if (y < gy) y = gy; }
    camera.position.set(x, y, z); camera.lookAt(cam.tx, cam.ty, cam.tz);
  }
  function updateWorld(dt) {
    ISL.Landmarks.update(dt, player); ISL.Streets.update(dt, player);
    ISL.Interior.update(dt, camera.position);
    for (const n of npcs) {
      const near = Math.hypot(player.x - n.x, player.z - n.z) < 14;
      const target = near ? Math.atan2(player.x - n.x, player.z - n.z) : n.face;
      let d = target - n.m.g.rotation.y; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; n.m.g.rotation.y += d * Math.min(1, dt * 4);
      if (!poseEmote(n.m, dt)) { walkPose(n.m, 0, 0); n.m.armR.rotation.x = near && !state.dlg ? -2.4 + Math.sin(performance.now() * .008) * .4 : (state.dlg && state.dlg.name === n.d.name ? Math.sin(performance.now() * .004) * .3 - .3 : 0); }
      n.m.g.position.y = ISL.H(n.x, n.z);
      n.tag.material.opacity = Math.min(1, Math.max(0, (60 - Math.hypot(camera.position.x - n.x, camera.position.z - n.z)) / 20));
    }
    for (const t of tourists) {
      t.t -= dt;
      if (t.t < 0) { t.t = 3 + rng() * 6; const a = rng() * 6.28, r = rng() * 14; t.tx = t.ax + Math.cos(a) * r; t.tz = t.az + Math.sin(a) * r; if (deepWater(t.tx, t.tz)) { t.tx = t.ax; t.tz = t.az; } }
      const dx = t.tx - t.x, dz = t.tz - t.z, d = Math.hypot(dx, dz), talking = state.nearest && state.nearest.o === t;
      if (poseEmote(t.m, dt)) { /* 감정표현 중 */ }
      else if (d > .3 && !talking) { let nx = t.x + dx / d * dt * 1.3, nz = t.z + dz / d * dt * 1.3; [nx, nz] = ISL.world.resolve(nx, nz, .32); if (Math.hypot(nx - t.x, nz - t.z) < dt * .5) t.t = 0; t.x = nx; t.z = nz; t.m.g.rotation.y = Math.atan2(dx, dz); t.phase += dt * 3.4; walkPose(t.m, t.phase, .45); }
      else walkPose(t.m, 0, 0);
      if (talking) t.m.g.rotation.y = Math.atan2(player.x - t.x, player.z - t.z);
      t.m.g.position.set(t.x, groundAt(t.x, t.z), t.z);
    }
    for (const p of pickups) { p.gem.rotation.y += dt * 2; p.g.position.y = ISL.H(p.x, p.z) + 1 + Math.sin(performance.now() * .003) * .2; }
    if (heartFx) heartFx.update(dt, -2, .5);
    updateRipples(dt);
    const rid = state.region && state.region.id;
    if (rid === 'kyoto') { // 봄 구역엔 벚꽃잎, 가을 구역엔 단풍잎
      if (!petals) { petals = new ISL.Emitter(scene, 220, { size: .8, color: '#ffc4d6', opacity: .95, life: 7 }); leavesFx = new ISL.Emitter(scene, 220, { size: .9, color: '#e0662a', opacity: .95, life: 7 }); }
      const em = ISL.kyotoAutumn(player.x, player.z) ? leavesFx : petals;
      for (let i = 0; i < 2; i++) em.emit(player.x + (rng() - .5) * 60, player.y + 14 + rng() * 6, player.z + (rng() - .5) * 60, 1 + rng(), -1.5, (rng() - .5), 7);
    }
    if (petals) { petals.update(dt, 0, 0); leavesFx.update(dt, 0, 0); }
    if (rid === 'iceland' && !player.swim) { // 크리스마스의 눈
      if (!snowFx) snowFx = new ISL.Emitter(scene, 700, { size: .55, color: '#ffffff', opacity: .9, life: 6 });
      for (let i = 0; i < 6; i++) snowFx.emit(player.x + (rng() - .5) * 70, player.y + 10 + rng() * 14, player.z + (rng() - .5) * 70, (rng() - .5) * 1.5, -2.6 - rng(), (rng() - .5) * 1.5, 6);
    }
    if (snowFx) snowFx.update(dt, 0, 0);
    let best = null, bd = 1e9;
    const consider = (o, kind, x, z, r) => { const d = Math.hypot(player.x - x, player.z - z); if (d < r && d < bd) { bd = d; best = { o, kind }; } };
    if (!player.fly) {
      for (const n of npcs) consider(n, 'npc', n.x, n.z, 3.6); for (const t of tourists) consider(t, 'tourist', t.x, t.z, 2.6); for (const p of pickups) consider(p, 'pickup', p.x, p.z, 2.4);
      if (!best) { const d = ISL.Interior.nearestDoor(player.x, player.z, 2.6); if (d && Math.abs((d.y || 0) - player.y) < 4.2) best = { o: d, kind: 'door' }; }
      for (const e of ISL.elevators || []) if (Math.hypot(player.x - e.x, player.z - e.z) < 3.5) best = { o: e, kind: 'elevator' };
    }
    state.nearest = best;
    setPrompt(best ? (best.kind === 'pickup' ? `${ITEMS[best.o.id]} 줍기` : best.kind === 'elevator' ? '🛗 엘리베이터 타기' : best.kind === 'door' ? (best.o.target ? (best.o.hall ? `🏛️ ${ISL.Halls.names[best.o.hall]} 안으로` : '🏠 안으로 들어가기') : (best.o.hall ? `🚪 ${ISL.Halls.names[best.o.hall]} 문 열기` : '🚪 문 열기')) : `${best.kind === 'npc' ? best.o.d.name : '여행자'}와(과) 이야기하기`) : null,
      best ? (best.kind === 'elevator' ? '🛗' : best.kind === 'door' ? '🚪' : best.kind === 'pickup' ? '✋' : '💬') : '✋');
  }
  function updateInside(dt) {
    const it = state.inside;
    it.update(dt, ISL.U.uTime.value, ISL.U.uDay.value);
    if (it.resident) { const r = it.resident, near = Math.hypot(player.x - r.x, player.z - r.z) < 4; if (!poseEmote(r.m, dt)) walkPose(r.m, 0, 0); if (near) { let d = Math.atan2(player.x - r.x, player.z - r.z) - r.m.g.rotation.y; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; r.m.g.rotation.y += d * Math.min(1, dt * 3); } }
    let best = null, bd = 1e9; for (const o of it.inter) { const d = Math.hypot(player.x - o.x, player.z - o.z); if (d < o.r && d < bd) { bd = d; best = { o, kind: 'inside' }; } }
    state.nearest = best;
    setPrompt(best ? best.o.label : null, best ? [...best.o.label][0] : '✋');
  }
  function setPrompt(text, icon) {
    const pr = $('prompt');
    if (text && !state.dlg) { pr.style.display = 'block'; pr.innerHTML = `<kbd>E</kbd> ${text}`; } else pr.style.display = 'none';
    const tb = $('talkBtn'); tb.classList.toggle('ready', !!text); tb.textContent = icon || '✋';
  }

  // 소리 환경 (0.2초마다)
  let envSndT = 0, regionT = 0, petals = null, leavesFx = null, snowFx = null, seasonKey = '';
  function soundEnv(dt) {
    if ((envSndT -= dt) > 0) return; envSndT = .2;
    const it = state.inside, px = it ? it.outside.x : player.x, pz = it ? it.outside.z : player.z;
    const seaD = ISL.seaDist ? ISL.seaDist(px, pz) : 999, alt = it ? 0 : Math.max(0, player.y - ISL.H(px, pz));
    let rd = 1e9, rsp = 1; for (const r of ISL.rivers) { const q = ISL.riverNearest(r, px, pz); if (q && q.d - q.w < rd) { rd = q.d - q.w; rsp = r.speed ? r.speed[q.i] : 1; } }
    const f = ISL.Landmarks.planData.foss, fd = f ? Math.hypot(px - f.x, pz - f.z) : 1e9;
    let cows = 0; for (const c of ISL.Landmarks.planData.chalets || []) if (Math.hypot(c.x - px, c.z - pz) < 50) cows = 1;
    A.update(.2, {
      sea: (1 - ISL.sstep(4, 85, seaD)) * (1 - ISL.sstep(20, 120, alt)), river: (1 - ISL.sstep(0, 32, rd)) * Math.min(1, .45 + rsp * .3), fall: 1 - ISL.sstep(8, 130, fd),
      wind: Math.min(1, (player.y / 160) + (player.fly ? .5 : 0)), night: ISL.U.uNight.value, day: ISL.U.uDay.value, land: 1 - ISL.sstep(30, 0, seaD) * .8,
      cows: it ? 0 : cows, fire: it ? it.env.fire : 0, clock: it ? it.env.clock : 0,
    });
  }

  // ---------- 시작 ----------
  const frame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
  async function step(label, pct) { $('loadText').textContent = label; $('loadBar').style.width = pct + '%'; await frame(); }
  async function boot() {
    initScene();
    await step('지형을 빚는 중… 🏔️', 5); ISL.init();
    await step('마을과 길을 그리는 중… 🏘️', 25); ISL.Landmarks.plan(); ISL.Streets.plan(); ISL.City.plan(); ISL.Land.plan();
    await step('하늘과 땅과 바다를 칠하는 중… 🌊', 35);
    sky = ISL.Nature.makeSky(); scene.add(sky);
    ISL.Nature.makeTerrain(scene); ISL.Nature.makeWater(scene); ISL.Nature.makeClouds(scene); ISL.Nature.makeAurora(scene);
    await step('마을을 짓고 밭을 가꾸는 중… 🌻', 55); ISL.Land.build(scene);
    await step('에펠탑과 금각사를 세우는 중… 🗼', 68); ISL.Landmarks.build(scene); ISL.Streets.build(scene); ISL.City.build(scene); ISL.Landmarks.mergeStatic();
    await step('숲과 풀밭을 키우는 중… 🌿', 80);
    ISL.Nature.makeTrees(scene);
    ISL.Nature.maskGrass();
    ISL.Nature.makeGrass(scene, LQ ? 7000 : MOBILE ? 16000 : 46000);
    await step('친구들을 부르는 중… 👋', 88);
    pm = person({ top: '#4a90d9', bottom: '#34495e', hat: 'cap', hatColor: '#f4a261', backpack: '#e07a3a', hair: '#2b1d14' });
    glider = makeGlider(); glider.visible = false; pm.g.add(glider); scene.add(pm.g);
    player.y = groundAt(player.x, player.z);
    placeNPCs();
    await step('지도를 그리는 중… 🗺️', 95); buildMapImage(); setupPointer(); buildWheel();
    await step('준비 완료!', 100);
    $('loading').classList.add('done'); state.mode = 'title'; $('title').classList.add('open');
    cam.tx = player.x; cam.ty = player.y + 2; cam.tz = player.z;
    loop();
  }
  // 패러글라이더: 활처럼 휜 날개(에어포일 단면을 호를 따라 쓸어 만듦) + 셀 무늬 + 줄 + 하네스
  function makeGlider() {
    const G = new THREE.Group(), R = 5.6, SPAN = 1.25, NS = 36, chord = 2.6;
    const af = []; for (let k = 0; k <= 16; k++) { const t = k / 16, x = (1 - Math.cos(t * Math.PI)) / 2, th = .16 * (1.4845 * Math.sqrt(x) - .63 * x - 1.758 * x * x + 1.4215 * x ** 3 - .5075 * x ** 4); af.push([x, th]); }
    const sec = af.concat(af.slice(1, -1).reverse().map(([x, t]) => [x, -t * .35]));
    const pos = [], col = [], idx = [], NC = sec.length, cA = new THREE.Color('#ff7b2e'), cB = new THREE.Color('#ffd23f'), cC = new THREE.Color('#2a9df4');
    for (let i = 0; i <= NS; i++) {
      const u = i / NS, a = (u - .5) * SPAN * 2, ch = chord * (1 - .45 * Math.pow(Math.abs(u - .5) * 2, 2.2));
      const cx = Math.sin(a) * R, cy = Math.cos(a) * R, nx = Math.sin(a), ny = Math.cos(a);
      const cell = Math.floor(u * 18), c = cell % 6 === 0 ? cC : cell % 2 ? cA : cB;
      for (const [x, t] of sec) { pos.push(cx + nx * t * chord, cy + ny * t * chord - R + 6.6, (.5 - x) * ch); col.push(c.r, c.g, c.b); }
      if (i) for (let k = 0; k < NC; k++) { const a0 = (i - 1) * NC + k, a1 = (i - 1) * NC + (k + 1) % NC, b0 = i * NC + k, b1 = i * NC + (k + 1) % NC; idx.push(a0, b0, a1, a1, b0, b1); }
    }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); wg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); wg.setIndex(idx); wg.computeVertexNormals();
    const wing = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .55 })); wing.castShadow = true; G.add(wing);
    const lp = [];
    for (let i = 1; i < NS; i += 3) for (const fx of [.15, .55, .9]) {
      const u = i / NS, a = (u - .5) * SPAN * 2, ch = chord * (1 - .45 * Math.pow(Math.abs(u - .5) * 2, 2.2));
      lp.push(Math.sin(a) * R, Math.cos(a) * R - R + 6.6 - .05, (.5 - fx) * ch, (u < .5 ? -.2 : .2), 1.62, 0);
    }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    G.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#d9d4c8', transparent: true, opacity: .75 })));
    return G;
  }

  function buildWheel() {
    const w = $('wheel'); w.innerHTML = '';
    ISL.EMOTES.forEach((e, i) => { const b = document.createElement('button'); b.innerHTML = `<span>${e.icon}</span><em>${MOBILE ? '' : (i + 1) + '. '}${e.name}</em>`; b.onclick = () => { doEmote(e.id); toggleWheel(false); }; w.appendChild(b); });
  }
  function startGame() {
    A.init(); A.chime([0, 4, 7, 12], .07);
    $('title').classList.remove('open'); state.mode = 'play'; document.body.classList.add('playing');
    if (MOBILE && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    setTimeout(() => { if (!S.met.chloe) toast(MOBILE ? '👋 앞에 있는 <b>클로에</b>에게 다가가 💬 버튼을 눌러 보세요' : '👋 앞에 있는 <b>클로에</b>에게 다가가 <kbd>E</kbd> 를 눌러 말을 걸어 보세요', 6000); }, 1200);
    setTimeout(() => toast(MOBILE ? '🚪 집 문 앞에서 🚪 버튼을 누르면 문을 열고 들어갈 수 있어요' : '🚪 집 문 앞에서 <kbd>E</kbd> 로 문을 열고 들어가요 · <kbd>G</kbd> 감정표현 · <kbd>Enter</kbd> 채팅', 6000), 8000);
  }

  let last = performance.now(), titleA = 0, upHeld = false, downHeld = false;
  // 렉 방지: 실제 프레임 속도를 재서 느리면 해상도 → 그림자 순으로 자동으로 낮추고, 여유가 생기면 다시 올림
  const gov = { t: performance.now(), n: 0, acc: 0, lvl: 0, good: 0, base: 0 };
  function govern() {
    const now = performance.now(), d = now - gov.t; gov.t = now; if (d > 500 || LQ) return; gov.acc += d; gov.n++;
    if (gov.acc < 2500) return; const fps = gov.n * 1000 / gov.acc; gov.acc = 0; gov.n = 0; if (!gov.base) gov.base = renderer.getPixelRatio();
    const apply = () => { renderer.setPixelRatio(gov.base * [1, .85, .72, .6, .6, .5][gov.lvl]); renderer.setSize(innerWidth, innerHeight); if (post && post.setSize) post.setSize(innerWidth, innerHeight); sunLight.castShadow = gov.lvl < 4; ISL.gfxLevel = gov.lvl; };
    if (fps < 38 && gov.lvl < 5) { gov.lvl++; gov.good = 0; apply(); }
    else if (fps > 57 && gov.lvl > 0 && ++gov.good >= 6) { gov.lvl--; gov.good = 0; apply(); }
    else if (fps <= 57) gov.good = 0;
  }
  function loop() {
    requestAnimationFrame(loop); govern();
    const now = performance.now(), dt = Math.min(.05, (now - last) / 1000); last = now;
    updateSky(dt);
    if (state.mode === 'title') { titleA += dt * .04; camera.position.set(Math.sin(titleA) * 520, 260, Math.cos(titleA) * 520); camera.lookAt(0, 20, 0); }
    else {
      if (state.inside) { updatePlayerInside(dt); updateCamera(dt); updateInside(dt); }
      else { updatePlayer(dt); updateCamera(dt); updateWorld(dt); }
      if (state.freeCam) { const f = state.freeCam; camera.position.set(f[0], f[1], f[2]); camera.lookAt(f[3], f[4], f[5]); }
      if (state.dlg) { const d = state.dlg, txt = d.choices ? d.menuText : d.pages[d.i]; if (d.shown < txt.length) { d.shown = Math.min(txt.length, d.shown + dt * 45); renderDlg(); } }
      if (!state.inside && (regionT -= dt) < 0) { regionT = .4; const r = ISL.regionAt(player.x, player.z), sk = r.id === 'kyoto' ? (ISL.kyotoAutumn(player.x, player.z) ? '교토 · 가을 🍁' : '교토 · 봄 🌸') : r.id === 'iceland' ? '아이슬란드 · 크리스마스 🎄' : r.name; A.setMusic(r.id); if (sk !== seasonKey) { seasonKey = sk; state.region = r; banner(Object.assign({}, r, { name: sk, hello: r.id === 'iceland' ? 'Gleðileg jól!' : r.hello })); state.region = r; } checkDiscover(); }
      soundEnv(dt);
      ISL.updateBubbles(camera);
    }
    const sc = state.inside ? state.inside.scene : scene;
    if (post) post.render(sc, camera, state.inside ? 0 : ISL.U.uNight.value, ISL.U.uTime.value); else renderer.render(sc, camera);
  }

  window.addEventListener('DOMContentLoaded', () => {
    $('startBtn').onclick = startGame;
    $('mapBtn').onclick = toggleMap; $('ppBtn').onclick = togglePassport; $('timeBtn').onclick = cycleTime; $('flyBtn').onclick = toggleFly; $('photoBtn').onclick = toggleUI; $('unphoto').onclick = toggleUI;
    $('sndBtn').onclick = () => { A.init(); A.on = !A.on; $('sndBtn').textContent = A.on ? '🔊 소리' : '🔈 소리 꺼짐'; };
    $('musBtn').onclick = () => { A.init(); A.musicOn = !A.musicOn; $('musBtn').textContent = A.musicOn ? '🎵 음악 켜짐' : '🎵 음악 꺼짐'; };
    $('moreBtn').onclick = () => $('more').classList.toggle('open'); $('more').addEventListener('click', () => $('more').classList.remove('open'));
    $('emoBtn').onclick = () => toggleWheel(); $('chatBtn').onclick = openChat; $('mEmo').onclick = () => toggleWheel(); $('mChat').onclick = openChat;
    $('chatSend').onclick = sendChat; $('chatIn').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendChat(); } });
    $('fsBtn').onclick = () => { if (!document.fullscreenElement) { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); } else document.exitFullscreen(); };
    $('talkBtn').onclick = () => { A.init(); if (state.dlg) dlgAdvance(); else interact(); };
    $('runBtn').onclick = () => $('runBtn').classList.toggle('on');
    $('jumpBtn').onclick = jump;
    const hold = (id, set) => { const b = $(id); b.addEventListener('pointerdown', e => { e.preventDefault(); set(true); }); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => set(false)); };
    hold('upBtn', v => upHeld = v); hold('downBtn', v => downHeld = v);
    $('dlg').addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') dlgAdvance(); });
    document.querySelectorAll('.close').forEach(b => b.onclick = closeModals);
    document.querySelectorAll('#passport .tabs button').forEach(b => b.onclick = () => { ppTab = b.dataset.tab; renderPassport(); });
    boot().catch(err => { console.error(err); $('loadText').textContent = '앗, 불러오다 문제가 생겼어요: ' + err.message; });
  });
  ISL.debug = { xmas: v => { xmasK = v; envDirty = true; }, look: a => { state.freeCam = a; }, player, cam, state, S, setTime: t => { tDay = t; envDirty = true; }, teleport: (x, z) => { player.x = x; player.z = z; player.y = groundAt(x, z); cam.curDist = undefined; }, startGame, enterHouse, exitHouse, doEmote, interact, get camera() { return camera; } };
})();
