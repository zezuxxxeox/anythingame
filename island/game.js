// 플레이어, 카메라, 대화, UI, 메인 루프
(function () {
  const ISL = window.ISL;
  const $ = id => document.getElementById(id);
  const rng = ISL.mulberry32(99);
  let renderer, scene, camera, sunLight, hemi, sky, pmrem, envScene;
  let tDay = 0.31; const DAY_SECONDS = 720;
  const TIME_PRESETS = [[0.29, '🌅 아침'], [0.45, '☀️ 한낮'], [0.715, '🌇 노을'], [0.93, '🌙 밤']];

  // ---------- 저장 ----------
  const SAVE_KEY = 'fiveIsland.save.v1';
  const S = { found: {}, items: {}, quests: {}, met: {}, gifted: {} };
  try { Object.assign(S, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) {}
  const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} };

  // ---------- 소리 ----------
  const Snd = {
    ctx: null, on: true, wind: null, water: null,
    init() {
      if (this.ctx) return; try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
      const c = this.ctx, buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = buf.getChannelData(0);
      let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + .02 * w) / 1.02; d[i] = last * 3.5; }
      const mk = (type, f, q) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(fl).connect(g).connect(c.destination); s.start(); return g; };
      this.wind = mk('lowpass', 500, .5); this.water = mk('bandpass', 900, .4);
    },
    chime(steps, vol = .1) {
      if (!this.ctx || !this.on) return; const c = this.ctx, t0 = c.currentTime;
      steps.forEach((st, k) => {
        const f = 523.25 * Math.pow(2, st / 12), t = t0 + k * .12;
        [1, 2.01].forEach((m, i) => { const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f * m; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol / (i + 1), t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + 1.6); o.connect(g).connect(c.destination); o.start(t); o.stop(t + 1.7); });
      });
    },
    bird() {
      if (!this.ctx || !this.on) return; const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
      const f = 2200 + Math.random() * 1600; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * (1.2 + Math.random() * .5), t + .08); o.frequency.exponentialRampToValueAtTime(f * .8, t + .16);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.025, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .2); o.connect(g).connect(c.destination); o.start(t); o.stop(t + .25);
    },
    ambient(windV, waterV) { if (!this.ctx) return; const t = this.ctx.currentTime; this.wind.gain.setTargetAtTime(this.on ? windV : 0, t, .5); this.water.gain.setTargetAtTime(this.on ? waterV : 0, t, .5); },
  };

  // ---------- 사람 모형 ----------
  function person(o) {
    const g = new THREE.Group(), M = c => new THREE.MeshStandardMaterial({ color: c, roughness: .8 });
    const skin = M(o.skin || '#f1d2b6'), top = M(o.top), bottom = M(o.bottom || '#3b3b4f'), hair = M(o.hair || '#3a2a20');
    const part = (geo, m, x, y, z, parent = g) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true; parent.add(me); return me; };
    const limb = (x, y, m, len, r) => { const piv = new THREE.Group(); piv.position.set(x, y, 0); g.add(piv); part(new THREE.CapsuleGeometry(r, len, 4, 8), m, 0, -len / 2 - r * .3, 0, piv); return piv; };
    const legL = limb(-.17, .95, bottom, .62, .13), legR = limb(.17, .95, bottom, .62, .13);
    part(new THREE.CapsuleGeometry(.3, .55, 4, 10), top, 0, 1.35, 0);
    if (o.skirt) part(new THREE.CylinderGeometry(.3, .5, .9, 12), top, 0, .75, 0);
    if (o.obi) part(new THREE.CylinderGeometry(.33, .33, .22, 12), M(o.obi), 0, 1.2, 0);
    const armL = limb(-.42, 1.68, top, .5, .1), armR = limb(.42, 1.68, top, .5, .1);
    part(new THREE.SphereGeometry(.28, 16, 12), skin, 0, 2.05, 0);
    const hr = part(new THREE.SphereGeometry(.3, 16, 10, 0, Math.PI * 2, 0, Math.PI * .55), hair, 0, 2.08, -.02);
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
    return { g, legL, legR, armL, armR };
  }
  function animate(p, phase, amt) {
    const s = Math.sin(phase) * amt;
    p.legL.rotation.x = s; p.legR.rotation.x = -s; p.armL.rotation.x = -s * .8; p.armR.rotation.x = s * .8;
  }

  // ---------- 아이템 & NPC ----------
  const ITEMS = { sakura: '🌸 벚꽃 가지', lavender: '💜 라벤더 다발', stone: '🪨 검은 화산석', nata: '🥧 파스텔 드 나타', choco: '🍫 스위스 초콜릿' };
  const NPCS = [
    { id: 'sigrid', name: '시그리드', region: 'iceland', look: { top: '#e9e4d8', pattern: '#2f4f7f', bottom: '#2c3440', hat: 'knit', hatColor: '#3b6ea5', hair: '#e8d6a0', longHair: 1 },
      hello: 'Halló! 할그림스키르캬에 온 걸 환영해요.',
      intro: '나는 시그리드. 레이캬비크에서 털실 스웨터(로파페이사)를 떠요. 이 섬 신기하죠? 빙하에서 조금만 걸어가면 벚꽃이 피어 있다니!',
      about: '이 교회는 용암이 식으면서 생긴 육각기둥, "주상절리"를 본떠 지었어요. 양옆으로 계단처럼 내려오는 기둥들 보여요? 파이프 오르간 같기도 하죠.',
      tip: '밤이 되면 꼭 북쪽 하늘을 봐요. 초록빛 오로라가 커튼처럼 춤을 춰요 (🌗 버튼으로 시간을 바꿀 수 있어요). 서쪽 절벽의 스코가포스 폭포에선 낮에 무지개가 떠요!',
      life: '아이슬란드의 여름엔 해가 거의 지지 않아요. 백야라고 하죠. 그래서 여름엔 밤새 산책하고, 겨울엔 뜨개질을 잔뜩 해요.',
      wants: 'sakura', ask: '부탁이 하나 있어요. 남동쪽 교토엔 벚꽃이 한가득이라던데, 벚꽃 가지 하나만 가져다줄 수 있어요? 이 차가운 섬에 봄을 조금 들여놓고 싶어요.',
      remind: '교토 금각사 근처 벚나무 아래에서 반짝이는 걸 찾아봐요. 🌸',
      thanks: '와아… 정말 분홍색이에요! 이 꽃잎 색으로 새 스웨터를 떠 볼래요. 우리 이제 친구예요! Takk fyrir!',
      after: '스웨터 거의 다 떴어요. 소매에 벚꽃 무늬를 넣었답니다. 🌸' },
    { id: 'lukas', name: '루카스', region: 'swiss', look: { top: '#c8102e', bottom: '#4b3a2a', hat: 'alpine', hatColor: '#3a5f2b', hair: '#7a5230', scarf: '#ffffff' },
      hello: 'Grüezi! 호수 바람 시원하죠?',
      intro: '나는 루카스. 저 산자락 샬레에서 소를 키우고 치즈랑 초콜릿을 만들어요. 소 목에 달린 방울 소리 들려요? 땡그랑~',
      gives: 'choco', giveText: '처음 왔으니 선물! 우리 집 밀크 초콜릿이에요. 누군가와 나눠 먹으면 더 맛있어요.',
      about: '저 물 위의 성이 시옹성 — 800년도 넘은 성이에요. 북동쪽 뾰족한 산이 마터호른이고요. 정상 근처는 한여름에도 눈이 쌓여 있어요. 한번 올라가 볼래요?',
      tip: '강을 따라 서쪽으로 가면 지붕 덮인 나무다리, 카펠교가 있어요. 강 한가운데 팔각형 물탑도 꼭 봐요.',
      life: '스위스엔 공용어가 네 개예요. 독일어, 프랑스어, 이탈리아어, 로만슈어! 저는 세 개까지 인사할 수 있어요. Grüezi, Bonjour, Buongiorno~',
      wants: 'nata', ask: '포르투갈 리스본에 "파스텔 드 나타"라는 에그타르트가 있다던데… 초콜릿만 만들다 보니 다른 디저트가 너무 궁금해요. 하나 구해 줄 수 있어요?',
      remind: '리스본 언덕의 주앙이 빵집 단골이래요. 남서쪽으로 가 보세요!',
      thanks: '이게 그 유명한 에그타르트! 바삭하고 달콤해… Merci vilmal! 이제 우린 친구예요.',
      after: '에그타르트 맛 초콜릿을 연구 중이에요. 완성되면 제일 먼저 맛보게 해 줄게요!' },
    { id: 'chloe', name: '클로에', region: 'france', look: { top: '#1e3a6e', pattern: '#ffffff', bottom: '#2a2a2a', hat: 'beret', hatColor: '#c0392b', hair: '#5a3825', longHair: 1, scarf: '#e9c46a' },
      hello: 'Bonjour ! 에펠탑 그리러 왔어요?',
      intro: '나는 클로에. 샹드마르스 잔디밭에서 그림을 그려요. 에펠탑은 아침, 낮, 노을, 밤마다 색이 달라서 아무리 그려도 질리지 않아요.',
      about: '에펠탑은 1889년 만국박람회 때 지어졌어요. 처음엔 "흉물"이라고 싫어한 사람도 많았대요! 지금은 파리에서 가장 사랑받는 곳이죠. 밤에는 조명이 반짝반짝해요.',
      tip: '서쪽 바다로 가면 몽생미셸이 있어요. 갯벌 위 바위섬 수도원이에요. 남쪽엔 보랏빛 라벤더 밭도 있고요!',
      life: '오늘 바게트를 두 개 샀어요. 하나는 점심, 하나는… 집에 가는 길에 다 먹을 거예요. 😋',
      wants: 'choco', ask: '그림을 그리다 보면 손이 시려서 따뜻한 쇼콜라 쇼(핫초코)가 마시고 싶어요. 스위스 초콜릿이 있으면 최고일 텐데…',
      remind: '북동쪽 스위스 호숫가의 루카스가 초콜릿을 만든대요!',
      thanks: 'Oh là là ! 진짜 스위스 초콜릿! 다음 그림엔 당신도 그려 넣을게요. 우린 이제 친구예요. Merci beaucoup !',
      after: '보세요, 에펠탑 옆에 배낭 멘 여행자를 작게 그렸어요. 당신이에요! 🎨' },
    { id: 'joao', name: '주앙', region: 'portugal', look: { top: '#2f6f4f', bottom: '#3a3a3a', hat: 'cap', hatColor: '#333333', hair: '#2b1d14' },
      hello: 'Olá! 트램 소리 들려요? 땡땡!',
      intro: '나는 주앙. 아줄레주 — 파란 타일에 그림을 그리는 장인이에요. 이 언덕 집들 벽에 붙은 타일 중 몇 개는 내가 만든 거예요.',
      gives: 'nata', giveText: '여기, 막 구운 파스텔 드 나타예요! 하나는 먹고, 하나는 누군가에게 나눠 줘요. 그게 리스본식이에요.',
      about: '노란 28번 트램은 백 년 가까이 리스본의 좁은 언덕길을 오르내렸어요. 남서쪽 강가엔 벨렝탑, 서쪽 산 위엔 페나 성. 저 빨간 다리는 "4월 25일 다리"예요.',
      tip: '해 질 녘에 벨렝탑에 가 봐요. 하얀 석회암이 노을에 분홍빛으로 물들어요.',
      life: '포르투갈 사람들은 "사우다드"라는 말을 좋아해요. 그리운 무언가를 향한 따뜻하고 아련한 마음. 파두 노래를 들으면 알 수 있어요.',
      wants: 'stone', ask: '새 타일 유약을 만드는데, 아이슬란드 검은 모래 해변의 화산석을 갈아 넣으면 깊은 검정이 나올 것 같아요. 하나 주워다 줄래요?',
      remind: '북쪽 끝 아이슬란드, 육각기둥 절벽이 있는 검은 모래 해변을 찾아봐요.',
      thanks: 'Obrigado! 이 돌로 만든 첫 타일은 당신에게 줄게요. 우린 이제 친구!',
      after: '화산석 유약이 아주 반짝반짝하게 나왔어요. 바다처럼 깊은 색이에요!' },
    { id: 'haruka', name: '하루카', region: 'kyoto', look: { top: '#c94f7c', obi: '#e8c46a', skirt: 1, bottom: '#c94f7c', hair: '#1b1414', kanzashi: 1 },
      hello: 'こんにちは! 금각사에 어서 오세요.',
      intro: '저는 하루카예요. 근처 찻집에서 말차를 내려요. 바람이 없는 날엔 연못에 금각사가 거울처럼 비쳐서 두 채로 보여요.',
      about: '금각사의 정식 이름은 로쿠온지예요. 1층은 귀족 저택, 2층은 무사 저택, 3층은 선종 사원 양식이라 층마다 모습이 달라요. 금박은 2층과 3층에만 입혔어요.',
      tip: '동쪽 산의 후시미 이나리 신사엔 주홍빛 도리이 터널이 끝없이 이어져요. 남쪽엔 오층탑과 대나무 숲! 대나무 숲에선 꼭 귀를 기울여 보세요.',
      life: '교토에는 절과 신사가 2,000개가 넘어요. 매일 하나씩 가도 5년 넘게 걸린대요.',
      wants: 'lavender', ask: '향 주머니(니오이부쿠로)를 만들고 싶은데, 프랑스 라벤더 향이 그렇게 좋다면서요? 한 다발만 가져다주실 수 있나요?',
      remind: '섬 가운데 남쪽, 프로방스 라벤더 밭에서 찾을 수 있을 거예요.',
      thanks: '좋은 향기… 마음이 차분해져요. 향 주머니가 완성되면 하나 드릴게요. 이제 우리 친구예요. ありがとう!',
      after: '라벤더 향 주머니, 찻집 손님들이 다들 좋아해요. 😊' },
  ];
  const TOURIST_LINES = ['사진 한 장 찍어 드릴까요? 📷 …찰칵! 잘 나왔어요.', '이 섬 지도 봤어요? (M 키) 명소가 엄청 많아요!', '오늘만 세 나라를 걸었어요. 다리가 아파요… 😅',
    '밤에 북쪽 하늘을 보면 오로라가 보인대요!', '마터호른 꼭대기까지 올라가 봤어요? 바람이 장난 아니에요.', '강물이 정말 맑네요. 발 담그면 시원해요!', 'F 키를 누르면 패러글라이딩을 할 수 있대요! 🪂',
    '저기 사람들이랑 얘기해 봤어요? 다들 부탁 하나씩은 있더라고요.', '이 섬에선 해가 지는 방향이 제일 예뻐요.'];

  let npcs = [], tourists = [], pickups = [];
  function placeNPCs() {
    const PL = ISL.P, pd = ISL.Landmarks.planData;
    const pos = { sigrid: [PL.hallgrim.x + 6, PL.hallgrim.z + 28], lukas: [300, 110], chloe: [PL.eiffel.x + 6, PL.eiffel.z + 44], joao: [pd.lisbon.x, pd.lisbon.z - 44], haruka: [300, 440] };
    for (const d of NPCS) {
      const m = person(d.look); const [x, z] = pos[d.id];
      m.g.position.set(x, ISL.H(x, z), z); scene.add(m.g);
      const tag = label(d.name, '#ffd166'); tag.position.set(0, 3, 0); m.g.add(tag);
      npcs.push({ d, m, x, z, tag, face: 0 });
    }
    const spots = [[PL.eiffel.x - 20, PL.eiffel.z + 30], [260, 430], [PL.hallgrim.x - 16, PL.hallgrim.z + 30], [PL.belem.x + 20, PL.belem.z], [P2(PL.chillon, -10, 30)], [PL.msm.x + 40, PL.msm.z + 10], [470, 380], [180, -30]];
    function P2(p, a, b) { return [p.x + a, p.z + b]; }
    const looks = [{ top: '#f4a261', hat: 'sun', hatColor: '#f6e7c1', backpack: '#2a9d8f' }, { top: '#9b5de5', bottom: '#264653', hat: 'cap', hatColor: '#f15bb5' }, { top: '#00bbf9', bottom: '#333', backpack: '#fee440' }, { top: '#e76f51', hair: '#d4a373', longHair: 1 }];
    spots.forEach((s, i) => {
      const [x, z] = Array.isArray(s[0]) ? s[0] : s; const lk = looks[i % looks.length];
      const m = person(lk); m.g.position.set(x, ISL.H(x, z), z); scene.add(m.g);
      tourists.push({ m, ax: x, az: z, x, z, tx: x, tz: z, t: rng() * 5, phase: 0, line: TOURIST_LINES[i % TOURIST_LINES.length] });
    });
    // 아이템 줍는 곳
    const b = pd.basalt;
    const spotsP = [['sakura', 238, 436], ['lavender', PL.lavender.x, PL.lavender.z - 42], ['stone', b.x + b.dx * 4, b.z + b.dz * 4]];
    ISL.placeInstances(scene, 'cherry', [{ x: 234, y: ISL.H(234, 433), z: 433, s: 1.1 }]);
    const glow = new THREE.MeshStandardMaterial({ color: '#fff7c2', emissive: '#ffd166', emissiveIntensity: 1.2 });
    for (const [id, x, z] of spotsP) {
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
  const player = { x: -110, z: 175, y: 0, vy: 0, fly: false, ground: true, phase: 0, face: Math.PI, speed: 0 };
  const cam = { yaw: Math.PI, pitch: .3, dist: 13, tx: 0, ty: 0, tz: 0, pos: new THREE.Vector3() };
  let pm, glider;
  function groundAt(x, z, curY) {
    let h = ISL.H(x, z);
    for (const w of ISL.walkables) {
      if (Math.abs(x - w.cx) > w.len && Math.abs(z - w.cz) > w.len) continue;
      const q = ISL.segDist(x, z, w.ax, w.az, w.bx, w.bz);
      if (q.d < w.hw + .3) { const y = ISL.deckY(w, q.t); if (y > h && (curY === undefined || y < curY + 1.7)) h = y; }
    }
    return h;
  }
  function deepWater(x, z, y) {
    const g = groundAt(x, z, y), w = ISL.waterAt(x, z);
    return w.kind !== 'river' && w.level - g > 1.3;
  }

  // ---------- 입력 ----------
  const keys = {}; let joy = { x: 0, y: 0, active: false }, dragging = null, uiHidden = false;
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase(); keys[e.code] = true;
    if (state.mode === 'title') return;
    if (state.dlg) {
      if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); dlgAdvance(); }
      const n = parseInt(e.key); if (n >= 1 && n <= 5) dlgChoose(n - 1);
      if (e.code === 'Escape') dlgClose();
      return;
    }
    if (e.code === 'KeyE') interact();
    if (e.code === 'KeyM') toggleMap();
    if (e.code === 'KeyJ' || e.code === 'Tab') { e.preventDefault(); togglePassport(); }
    if (e.code === 'KeyT') cycleTime();
    if (e.code === 'KeyF') toggleFly();
    if (e.code === 'KeyH') toggleUI();
    if (e.code === 'Escape') { closeModals(); }
    if (e.code === 'Space') { e.preventDefault(); if (!player.fly && player.ground) { player.vy = 9; player.ground = false; } }
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  const cv = () => renderer.domElement;
  function setupPointer() {
    const el = cv();
    el.addEventListener('pointerdown', e => {
      Snd.init();
      if (e.pointerType === 'touch' && e.clientX < innerWidth * .45 && state.mode === 'play') { joy = { x: 0, y: 0, active: true, id: e.pointerId, ox: e.clientX, oy: e.clientY }; showJoy(e.clientX, e.clientY, 0, 0); return; }
      dragging = { id: e.pointerId, x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
      if (joy.active && e.pointerId === joy.id) { let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const l = Math.hypot(dx, dy), m = 55; if (l > m) { dx *= m / l; dy *= m / l; } joy.x = dx / m; joy.y = dy / m; showJoy(joy.ox, joy.oy, dx, dy); return; }
      if (dragging && e.pointerId === dragging.id) { cam.yaw -= (e.clientX - dragging.x) * .005; cam.pitch = Math.max(-.25, Math.min(1.35, cam.pitch + (e.clientY - dragging.y) * .004)); dragging.x = e.clientX; dragging.y = e.clientY; }
    });
    const up = e => { if (joy.active && e.pointerId === joy.id) { joy = { x: 0, y: 0, active: false }; $('joy').style.display = 'none'; } if (dragging && e.pointerId === dragging.id) dragging = null; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => { cam.dist = Math.max(5, Math.min(60, cam.dist * (1 + Math.sign(e.deltaY) * .1))); }, { passive: true });
  }
  function showJoy(x, y, dx, dy) { const j = $('joy'); j.style.display = 'block'; j.style.left = (x - 60) + 'px'; j.style.top = (y - 60) + 'px'; $('knob').style.transform = `translate(${dx}px,${dy}px)`; }

  // ---------- UI ----------
  const state = { mode: 'loading', dlg: null, region: null, nearest: null, modal: null };
  function toast(html, ms = 3200) {
    const d = document.createElement('div'); d.className = 'toast'; d.innerHTML = html; $('toasts').appendChild(d);
    setTimeout(() => d.classList.add('out'), ms); setTimeout(() => d.remove(), ms + 600);
  }
  function banner(r) {
    const b = $('banner'); b.innerHTML = `<div class="flag">${r.flag}</div><div><b>${r.name}</b><span>${r.hello}</span></div>`;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    $('where').textContent = `${r.flag} ${r.name}`;
  }
  function closeModals() { $('map').classList.remove('open'); $('passport').classList.remove('open'); state.modal = null; }
  function toggleUI() { uiHidden = !uiHidden; document.body.classList.toggle('photo', uiHidden); if (uiHidden) toast('📷 사진 모드 — H 키나 화면 아래 버튼으로 돌아와요', 2500); }

  // 대화
  function talkTo(n) {
    Snd.chime([0, 4, 7], .06);
    n.face = Math.atan2(player.x - n.x, player.z - n.z);
    player.face = Math.atan2(n.x - player.x, n.z - player.z);
    const d = n.d, first = !S.met[d.id];
    const pages = [];
    if (first) { pages.push(d.hello, d.intro); S.met[d.id] = 1; save(); }
    else pages.push(d.hello);
    if (d.gives && !S.gifted[d.id]) { pages.push(d.giveText); }
    openDlg(d.name, ISL.REGIONS.find(r => r.id === d.region).flag, pages, () => {
      if (d.gives && !S.gifted[d.id]) { S.gifted[d.id] = 1; S.items[d.gives] = (S.items[d.gives] || 0) + 1; save(); toast(`가방에 <b>${ITEMS[d.gives]}</b>을(를) 넣었어요`); Snd.chime([7, 12], .07); }
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
  function flagOf(n) { return ISL.REGIONS.find(r => r.id === n.d.region).flag; }
  function quest(n) {
    const d = n.d, q = S.quests[d.id] || 0;
    if (q === 0) { S.quests[d.id] = 1; save(); openDlg(d.name, flagOf(n), [d.ask], () => { toast(`📔 수첩에 <b>${d.name}</b>의 부탁을 적었어요`); return menu(n); }); }
    else if (S.items[d.wants]) {
      S.items[d.wants]--; if (!S.items[d.wants]) delete S.items[d.wants]; S.quests[d.id] = 2; save();
      openDlg(d.name, flagOf(n), [d.thanks], () => { Snd.chime([0, 4, 7, 12, 16], .08); toast(`💛 <b>${d.name}</b>와(과) 친구가 되었어요!`, 4000); burstHearts(n); checkComplete(); return menu(n); });
    } else openDlg(d.name, flagOf(n), [d.remind], () => menu(n));
  }
  let hearts = null;
  function burstHearts(n) { if (!hearts) hearts = new ISL.Emitter(scene, 80, { size: 2, color: '#ff6b8b', opacity: 1, life: 1.6, additive: true }); for (let i = 0; i < 40; i++) hearts.emit(n.x, n.m.g.position.y + 2.2, n.z, (rng() - .5) * 4, 3 + rng() * 3, (rng() - .5) * 4, 1.6); }

  function openDlg(name, flag, pages, onEnd) {
    state.dlg = { name, flag, pages, i: 0, shown: 0, onEnd, choices: null, t: 0 };
    $('dlg').classList.add('open'); $('dlgName').textContent = `${flag} ${name}`; renderDlg();
  }
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
  function dlgChoose(i) {
    const d = state.dlg; if (!d || !d.choices || !d.choices[i]) return;
    Snd.chime([4], .04);
    const fn = d.choices[i][1]; if (!fn) { dlgClose(); return; } fn();
  }
  function dlgClose() { state.dlg = null; $('dlg').classList.remove('open'); }

  function interact() {
    const n = state.nearest; if (!n) return;
    if (n.kind === 'npc') talkTo(n.o);
    else if (n.kind === 'tourist') { const r = ISL.regionAt(n.o.x, n.o.z); openDlg('여행자', '🧳', [`${r.hello} ${n.o.line}`], null); n.o.line = TOURIST_LINES[Math.floor(rng() * TOURIST_LINES.length)]; }
    else if (n.kind === 'pickup') {
      const p = n.o; S.items[p.id] = (S.items[p.id] || 0) + 1; save(); scene.remove(p.g); pickups.splice(pickups.indexOf(p), 1);
      Snd.chime([7, 11, 14], .08); toast(`가방에 <b>${ITEMS[p.id]}</b>을(를) 넣었어요`);
    }
  }

  // 명소 발견
  function checkDiscover() {
    for (const L of ISL.LANDMARKS) {
      if (S.found[L.id]) continue;
      if (Math.hypot(player.x - L.x, player.z - L.z) < L.r) {
        S.found[L.id] = 1; save(); Snd.chime([0, 7, 12, 16], .07);
        const n = Object.keys(S.found).length;
        toast(`<div class="stamp">📮 새 명소 발견!</div><b>${L.name}</b><br><small>${L.desc}</small><br><small>스탬프 ${n} / ${ISL.LANDMARKS.length}</small>`, 6500);
        checkComplete();
      }
    }
  }
  function checkComplete() {
    const all = ISL.LANDMARKS.every(L => S.found[L.id]) && NPCS.every(d => S.quests[d.id] === 2);
    if (all && !S.completed) { S.completed = 1; save(); setTimeout(() => { toast('<div class="stamp">🎉 여행 완료!</div>모든 명소를 돌아보고 다섯 친구를 사귀었어요.<br>이 섬은 언제든 다시 걸으러 와도 좋아요. 💛', 9000); Snd.chime([0, 4, 7, 12, 16, 19, 24], .08); }, 1500); }
  }

  // 수첩
  function togglePassport() {
    if (state.modal === 'passport') return closeModals();
    closeModals(); state.modal = 'passport'; $('passport').classList.add('open'); renderPassport();
  }
  let ppTab = 'stamps';
  function renderPassport() {
    const body = $('ppBody'); let h = '';
    document.querySelectorAll('#passport .tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === ppTab));
    if (ppTab === 'stamps') {
      const n = Object.keys(S.found).length; h += `<p class="sum">발견한 명소 <b>${n}</b> / ${ISL.LANDMARKS.length}</p>`;
      for (const r of ISL.REGIONS) {
        h += `<h3>${r.flag} ${r.name}</h3><div class="stamps">`;
        for (const L of ISL.LANDMARKS.filter(l => l.region === r.id)) {
          const f = S.found[L.id];
          h += `<div class="st ${f ? 'on' : ''}"><b>${f ? '✅' : '❔'} ${f ? L.name : '???'}</b>${f ? `<small>${L.desc}</small>` : `<small>${r.name} 어딘가에 있어요</small>`}</div>`;
        }
        h += '</div>';
      }
    } else if (ppTab === 'friends') {
      const n = NPCS.filter(d => S.quests[d.id] === 2).length; h += `<p class="sum">친구 <b>${n}</b> / ${NPCS.length}</p><div class="stamps">`;
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

  // 지도
  let mapImg = null;
  function buildMapImage() {
    const S2 = 400, c = document.createElement('canvas'); c.width = c.height = S2; const x = c.getContext('2d'), img = x.createImageData(S2, S2);
    const N = ISL.N, G = ISL.groundColors, LUg = ISL.groundLU, grid = ISL.getGrid();
    const sr = v => 255 * Math.min(1, v <= .0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - .055);
    for (let j = 0; j < S2; j++) for (let i = 0; i < S2; i++) {
      const gi = Math.min(N - 2, Math.floor(i / S2 * (N - 1))), gj = Math.min(N - 2, Math.floor(j / S2 * (N - 1))), k = gj * N + gi, h = grid[k];
      let r, g, b;
      if (h < 0 || LUg[k] === 4) { const d = Math.min(1, Math.max(0, -h) / 25); r = 90 - d * 50; g = 165 - d * 60; b = 200 - d * 40; }
      else {
        const sh = Math.max(.6, Math.min(1.3, 1 + (grid[k] - grid[k + N + 1]) * .06));
        r = sr(G[k * 3]) * sh; g = sr(G[k * 3 + 1]) * sh; b = sr(G[k * 3 + 2]) * sh;
      }
      const o = (j * S2 + i) * 4; img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
    x.putImageData(img, 0, 0); mapImg = c.toDataURL();
  }
  const toMap = (x, z) => [((x + ISL.E) / (2 * ISL.E) * 100).toFixed(2) + '%', ((z + ISL.E) / (2 * ISL.E) * 100).toFixed(2) + '%'];
  function toggleMap() {
    if (state.modal === 'map') return closeModals();
    closeModals(); state.modal = 'map'; $('map').classList.add('open');
    const box = $('mapBox'); box.style.backgroundImage = `url(${mapImg})`; box.innerHTML = '';
    for (const r of ISL.REGIONS) { const [l, t] = toMap(r.x, r.z); const d = document.createElement('div'); d.className = 'rlabel'; d.style.left = l; d.style.top = t; d.textContent = `${r.flag} ${r.name}`; box.appendChild(d); }
    for (const L of ISL.LANDMARKS) {
      const [l, t] = toMap(L.x, L.z), b = document.createElement('button'); b.className = 'pin' + (S.found[L.id] ? ' on' : '');
      b.style.left = l; b.style.top = t; b.innerHTML = `<span>${S.found[L.id] ? '📍' : '❔'}</span><em>${S.found[L.id] ? L.name : '???'}</em>`;
      b.title = '여기로 이동'; b.onclick = () => teleport(L); box.appendChild(b);
    }
    for (const n of npcs) { const [l, t] = toMap(n.x, n.z), d = document.createElement('div'); d.className = 'npcpin'; d.style.left = l; d.style.top = t; d.textContent = S.met[n.d.id] ? (S.quests[n.d.id] === 2 ? '💛' : '💬') : '💬'; box.appendChild(d); }
    for (const p of pickups) { const [l, t] = toMap(p.x, p.z), d = document.createElement('div'); d.className = 'npcpin'; d.style.left = l; d.style.top = t; d.textContent = '✨'; box.appendChild(d); }
    const [l, t] = toMap(player.x, player.z), me = document.createElement('div'); me.className = 'me'; me.style.left = l; me.style.top = t; me.style.transform = `translate(-50%,-50%) rotate(${-player.face + Math.PI}rad)`; me.textContent = '▲'; box.appendChild(me);
  }
  function teleport(L) {
    let best = null;
    for (let k = 0; k < 40; k++) {
      const a = k * .7, r = Math.min(L.r * .6, 30) + k * .5, x = L.x + Math.sin(a) * r, z = L.z + Math.cos(a) * r;
      if (!deepWater(x, z) && ISL.H(x, z) > .5 && ISL.slopeAt(x, z) < .4) { best = [x, z]; break; }
    }
    if (!best) best = [L.x, L.z];
    player.x = best[0]; player.z = best[1]; player.y = groundAt(best[0], best[1]) + (player.fly ? 15 : 0); player.vy = 0;
    cam.yaw = Math.atan2(L.x - player.x, L.z - player.z) || cam.yaw; player.face = cam.yaw;
    closeModals(); Snd.chime([12, 7], .06); toast(`✈️ ${L.name} 근처로 이동했어요`, 2000);
  }

  function cycleTime() {
    let i = TIME_PRESETS.findIndex(p => p[0] > tDay + .01); if (i < 0) i = 0;
    tDay = TIME_PRESETS[i][0]; toast(TIME_PRESETS[i][1], 1500); envDirty = true;
  }
  function toggleFly() {
    player.fly = !player.fly; glider.visible = player.fly;
    if (player.fly) { player.vy = 0; player.y += 4; toast('🪂 패러글라이딩! Space 위로 · C 아래로 · F 내리기', 3000); cam.dist = Math.max(cam.dist, 20); document.body.classList.add('flying'); }
    else { toast('🚶 착지!', 1200); document.body.classList.remove('flying'); }
  }

  // ---------- 장면 ----------
  let envDirty = true, envT = 0, post = null; const LQ = /lq/.test(location.search);
  function initScene() {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    renderer.setPixelRatio(LQ ? .5 : Math.min(devicePixelRatio || 1, 1.75)); renderer.setSize(innerWidth, innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
    renderer.shadowMap.enabled = !LQ; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    $('app').appendChild(renderer.domElement);
    scene = new THREE.Scene(); scene.fog = new THREE.FogExp2('#bcd3e6', .00078);
    camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, .3, 12000);
    addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); if (post) post.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
    sunLight = new THREE.DirectionalLight('#fff4e0', 2.6); sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048); const sc = sunLight.shadow.camera; sc.left = sc.bottom = -95; sc.right = sc.top = 95; sc.near = 1; sc.far = 900;
    sunLight.shadow.bias = -.0004; sunLight.shadow.normalBias = .6;
    scene.add(sunLight, sunLight.target);
    hemi = new THREE.HemisphereLight('#cfe3ff', '#5d6b45', .9); scene.add(hemi);
    pmrem = new THREE.PMREMGenerator(renderer);
    if (!LQ && renderer.capabilities.isWebGL2) { post = new ISL.Post(renderer); post.setSize(innerWidth, innerHeight); }
  }
  function updateEnv() {
    if (!envScene) { envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(sky.geometry, sky.material)); }
    const rt = pmrem.fromScene(envScene, 0, .1, 9000);
    if (scene.environment && scene.environment !== rt.texture) scene.environment.dispose();
    scene.environment = rt.texture;
  }

  const tmpV = new THREE.Vector3(), fogC = new THREE.Color(), lightC = new THREE.Color();
  function updateSky(dt) {
    tDay = (tDay + dt / DAY_SECONDS) % 1;
    const a = (tDay - .25) * Math.PI * 2;
    const sun = ISL.U.uSun.value.set(Math.cos(a) * .85, Math.sin(a), -.38).normalize();
    const day = ISL.sstep(-.14, .22, sun.y), night = 1 - ISL.sstep(-.25, .03, sun.y), low = Math.exp(-Math.pow(sun.y * 4, 2));
    ISL.U.uDay.value = day; ISL.U.uNight.value = night;
    const isSun = sun.y > -.06;
    const L = isSun ? sun : tmpV.copy(sun).negate();
    sunLight.position.set(player.x + L.x * 400, player.y + L.y * 400, player.z + L.z * 400);
    sunLight.target.position.set(player.x, player.y, player.z);
    if (isSun) { lightC.setRGB(1, .93 - low * .3, .85 - low * .5); sunLight.intensity = 2.8 * ISL.sstep(-.06, .12, sun.y); }
    else { lightC.setRGB(.55, .65, 1); sunLight.intensity = .35 * ISL.sstep(-.06, .3, -sun.y); }
    sunLight.color.copy(lightC);
    hemi.intensity = .25 + .8 * day; hemi.color.setRGB(.55 + .25 * day, .62 + .25 * day, .9); hemi.groundColor.setRGB(.25 * day + .05, .3 * day + .05, .2 * day + .08);
    renderer.toneMappingExposure = .95 + night * .25;
    if (post) post.exposure = .92 + night * .35 + low * .05;
    if (ISL.grass) {
      const gu = ISL.grass.uniforms; gu.uCenter.value.set(player.x, player.z);
      gu.uL.value.copy(L); gu.uLC.value.copy(lightC).multiplyScalar(sunLight.intensity);
      gu.uSkyC.value.copy(hemi.color).multiplyScalar(hemi.intensity * 1.9); gu.uGndC.value.copy(hemi.groundColor).multiplyScalar(hemi.intensity * 1.6);
    }
    camera.getWorldDirection(tmpV); tmpV.y = .02; tmpV.normalize();
    ISL.skyColJS(tmpV, sun, fogC); scene.fog.color.copy(fogC);
    for (const m of ISL.waterMats) m.uniforms.uSunCol.value.copy(lightC).multiplyScalar(isSun ? 1 : .4);
    if (ISL.clouds) { const c = ISL.clouds; const cc = new THREE.Color().setRGB(.05 + .95 * day + low * .25, .06 + .9 * day + low * .02, .1 + .85 * day - low * .15); for (const m of c.mats) { m.color.copy(cc); } c.group.position.x = (performance.now() * .002) % 400; }
    for (const m of ISL.nightMats) m.emissiveIntensity = night * (m === ISL.eiffelLamp ? 2.2 + Math.sin(performance.now() * .02) * .8 : 1.1);
    ISL.U.uTime.value += dt;
    sky.position.copy(camera.position);
    for (const c of ISL.chunks) { const bs = c.boundingSphere; c.visible = bs.center.distanceTo(camera.position) - bs.radius < c.userData.lod; }
    envT -= dt; if (envDirty || envT < 0) { envT = 3; envDirty = false; updateEnv(); }
    $('clock').textContent = (() => { const h = Math.floor(tDay * 24), m = Math.floor((tDay * 24 - h) * 60); return `${night > .5 ? '🌙' : low > .5 ? '🌅' : '☀️'} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; })();
  }

  // ---------- 갱신 ----------
  let regionT = 0, birdT = 2, petals = null;
  function updatePlayer(dt) {
    if (state.dlg) { player.speed = 0; animate(pm, 0, 0); return; }
    let ix = 0, iz = 0;
    if (keys.KeyW || keys.ArrowUp) iz += 1; if (keys.KeyS || keys.ArrowDown) iz -= 1;
    if (keys.KeyA || keys.ArrowLeft) ix -= 1; if (keys.KeyD || keys.ArrowRight) ix += 1;
    if (joy.active) { ix += joy.x; iz -= joy.y; }
    const il = Math.hypot(ix, iz); if (il > 1) { ix /= il; iz /= il; }
    const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw), rx = -Math.cos(cam.yaw), rz = Math.sin(cam.yaw);
    let mx = fx * iz + rx * ix, mz = fz * iz + rz * ix;
    const run = keys.ShiftLeft || keys.ShiftRight || $('runBtn').classList.contains('on');
    const w = ISL.waterAt(player.x, player.z), inRiver = !player.fly && w.kind === 'river' && w.level > player.y + .3;
    const swimD = ISL.waterAt(player.x, player.z).level - groundAt(player.x, player.z, player.y); player.swim = !player.fly && swimD > 1.3;
    let sp = player.fly ? (run ? 85 : 42) : (run ? 22 : 10) * (inRiver ? .55 : 1) * (player.swim ? .5 : 1);
    const mag = Math.hypot(mx, mz);
    player.speed += ((mag > .05 ? sp * Math.min(1, mag) : 0) - player.speed) * Math.min(1, dt * 8);
    if (mag > .05) {
      const nx = player.x + mx / mag * player.speed * dt, nz = player.z + mz / mag * player.speed * dt;
      if (Math.hypot(nx, nz) < 930) { player.x = nx; player.z = nz; }
      const tf = Math.atan2(mx, mz); let d = tf - player.face; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; player.face += d * Math.min(1, dt * 10);
    }
    player.x = Math.max(-ISL.E + 5, Math.min(ISL.E - 5, player.x)); player.z = Math.max(-ISL.E + 5, Math.min(ISL.E - 5, player.z));
    const g = groundAt(player.x, player.z, player.y);
    if (player.fly) {
      let vy = -1.5; if (keys.Space || $('upBtn').matches(':active')) vy = 18; if (keys.KeyC || keys.ControlLeft || $('downBtn').matches(':active')) vy = -22;
      player.y += vy * dt; player.y = Math.max(g + 1.5, Math.min(420, player.y));
      if (player.y <= g + 1.6 && vy < 0 && !keys.Space) { /* 지면 가까이 */ }
    } else {
      const wl = ISL.waterAt(player.x, player.z);
      if (wl.level - g > 1.3) { // 헤엄치기
        const ty = wl.level - 1.35 + Math.sin(performance.now() * .003) * .08; player.y += (ty - player.y) * Math.min(1, dt * 6); player.vy = 0; player.ground = true;
      } else {
        player.vy -= 25 * dt; player.y += player.vy * dt;
        if (player.y <= g) { player.y = g; player.vy = 0; player.ground = true; } else if (player.y - g > .4) player.ground = false;
        if (player.ground && player.y - g < .6) player.y = g;
      }
    }
    pm.g.position.set(player.x, player.y, player.z); pm.g.rotation.y = player.face;
    player.phase += dt * player.speed * .9;
    animate(pm, player.phase, player.fly ? 0 : Math.min(.9, player.speed * .06));
    if (player.swim) { const sw = Math.sin(player.phase * 1.5); pm.armL.rotation.x = -2.2 + sw; pm.armR.rotation.x = -2.2 - sw; }
    if (player.fly) { pm.armL.rotation.x = pm.armR.rotation.x = -2.6; pm.legL.rotation.x = pm.legR.rotation.x = .3; glider.rotation.z = Math.sin(performance.now() * .001) * .05; }
  }
  function updateCamera(dt) {
    const tx = player.x, ty = player.y + 2.2, tz = player.z;
    cam.tx += (tx - cam.tx) * Math.min(1, dt * 10); cam.ty += (ty - cam.ty) * Math.min(1, dt * 8); cam.tz += (tz - cam.tz) * Math.min(1, dt * 10);
    if (!dragging && player.speed > 3 && !state.dlg) { let d = player.face - cam.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; cam.yaw += d * dt * .6; }
    const cp = Math.cos(cam.pitch), dist = state.dlg ? Math.min(cam.dist, 9) : cam.dist;
    let x = cam.tx - Math.sin(cam.yaw) * cp * dist, y = cam.ty + Math.sin(cam.pitch) * dist, z = cam.tz - Math.cos(cam.yaw) * cp * dist;
    const gy = Math.max(groundAt(x, z), 0) + 1.2; if (y < gy) y = gy;
    camera.position.set(x, y, z); camera.lookAt(cam.tx, cam.ty, cam.tz);
  }
  function updateWorld(dt) {
    ISL.Landmarks.update(dt, player);
    for (const n of npcs) {
      const near = Math.hypot(player.x - n.x, player.z - n.z) < 14;
      const target = near ? Math.atan2(player.x - n.x, player.z - n.z) : n.face;
      let d = target - n.m.g.rotation.y; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; n.m.g.rotation.y += d * Math.min(1, dt * 4);
      n.m.armR.rotation.x = near && !state.dlg ? -2.4 + Math.sin(performance.now() * .008) * .4 : (state.dlg && state.dlg.name === n.d.name ? Math.sin(performance.now() * .004) * .3 - .3 : 0);
      n.m.g.position.y = ISL.H(n.x, n.z) + Math.abs(Math.sin(performance.now() * .002)) * .03;
      n.tag.material.opacity = Math.min(1, Math.max(0, (60 - Math.hypot(camera.position.x - n.x, camera.position.z - n.z)) / 20));
    }
    for (const t of tourists) {
      t.t -= dt;
      if (t.t < 0) { t.t = 3 + rng() * 6; const a = rng() * 6.28, r = rng() * 14; t.tx = t.ax + Math.cos(a) * r; t.tz = t.az + Math.sin(a) * r; if (deepWater(t.tx, t.tz)) { t.tx = t.ax; t.tz = t.az; } }
      const dx = t.tx - t.x, dz = t.tz - t.z, d = Math.hypot(dx, dz), talking = state.nearest && state.nearest.o === t;
      if (d > .3 && !talking) { t.x += dx / d * dt * 2.2; t.z += dz / d * dt * 2.2; t.m.g.rotation.y = Math.atan2(dx, dz); t.phase += dt * 4; animate(t.m, t.phase, .5); } else animate(t.m, 0, 0);
      if (talking) t.m.g.rotation.y = Math.atan2(player.x - t.x, player.z - t.z);
      t.m.g.position.set(t.x, groundAt(t.x, t.z), t.z);
    }
    for (const p of pickups) { p.gem.rotation.y += dt * 2; p.g.position.y = ISL.H(p.x, p.z) + 1 + Math.sin(performance.now() * .003) * .2; }
    if (hearts) hearts.update(dt, -2, .5);
    // 교토의 꽃잎
    const inKyoto = state.region && state.region.id === 'kyoto';
    if (inKyoto) { if (!petals) petals = new ISL.Emitter(scene, 220, { size: .8, color: '#ffc4d6', opacity: .95, life: 7 }); for (let i = 0; i < 2; i++) petals.emit(player.x + (rng() - .5) * 60, player.y + 14 + rng() * 6, player.z + (rng() - .5) * 60, 1 + rng(), -1.5, (rng() - .5), 7); }
    if (petals) petals.update(dt, 0, 0);
    // 가까운 상호작용 대상
    let best = null, bd = 1e9;
    const consider = (o, kind, x, z, r) => { const d = Math.hypot(player.x - x, player.z - z); if (d < r && d < bd) { bd = d; best = { o, kind }; } };
    if (!player.fly) { for (const n of npcs) consider(n, 'npc', n.x, n.z, 6); for (const t of tourists) consider(t, 'tourist', t.x, t.z, 3.5); for (const p of pickups) consider(p, 'pickup', p.x, p.z, 3.5); }
    state.nearest = best;
    const pr = $('prompt');
    if (best && !state.dlg) { pr.style.display = 'block'; pr.innerHTML = best.kind === 'pickup' ? `<kbd>E</kbd> ${ITEMS[best.o.id]} 줍기` : `<kbd>E</kbd> ${best.kind === 'npc' ? best.o.d.name : '여행자'}와(과) 이야기하기`; }
    else pr.style.display = 'none';
    $('talkBtn').classList.toggle('ready', !!best);
    // 지역 & 발견 & 소리
    regionT -= dt;
    if (regionT < 0) {
      regionT = .4; const r = ISL.regionAt(player.x, player.z); if (r !== state.region) { state.region = r; banner(r); }
      checkDiscover();
      let wd = 1e9; for (const rv of ISL.rivers) { const q = ISL.riverNearest(rv, player.x, player.z); if (q) wd = Math.min(wd, q.d - q.w); }
      const pd = ISL.Landmarks.planData.foss; const fd = pd ? Math.hypot(player.x - pd.x, player.z - pd.z) : 1e9;
      const coast = Math.max(0, 6 - ISL.H(player.x, player.z)) / 6;
      Snd.ambient(.012 + Math.min(.05, Math.max(0, player.y) / 4000) + (player.fly ? .03 : 0), Math.min(.09, .05 * Math.max(0, 1 - wd / 30) + .09 * Math.max(0, 1 - fd / 90) + .03 * coast));
    }
    birdT -= dt; if (birdT < 0) { birdT = 1.5 + rng() * 5; if (ISL.U.uDay.value > .5 && !player.fly && ISL.slopeAt(player.x, player.z) < .3) { Snd.bird(); if (rng() < .5) setTimeout(() => Snd.bird(), 180); } }
  }

  // ---------- 시작 ----------
  const frame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
  async function step(label, pct) { $('loadText').textContent = label; $('loadBar').style.width = pct + '%'; await frame(); }
  async function boot() {
    initScene();
    await step('지형을 빚는 중… 🏔️', 5);
    ISL.init();
    await step('마을과 길을 그리는 중… 🏘️', 25);
    ISL.Landmarks.plan();
    ISL.Land.plan();
    await step('하늘과 땅과 바다를 칠하는 중… 🌊', 35);
    sky = ISL.Nature.makeSky(); scene.add(sky);
    ISL.Nature.makeTerrain(scene);
    ISL.Nature.makeWater(scene);
    ISL.Nature.makeClouds(scene);
    ISL.Nature.makeAurora(scene);
    await step('마을을 짓고 밭을 가꾸는 중… 🌻', 55);
    ISL.Land.build(scene);
    await step('에펠탑과 금각사를 세우는 중… 🗼', 68);
    ISL.Landmarks.build(scene);
    ISL.Landmarks.mergeStatic();
    await step('숲과 풀밭을 키우는 중… 🌿', 80);
    ISL.Nature.makeTrees(scene);
    ISL.Nature.makeGrass(scene, LQ ? 12000 : matchMedia('(pointer:coarse)').matches ? 22000 : 42000);
    await step('친구들을 부르는 중… 👋', 86);
    pm = person({ top: '#4a90d9', bottom: '#34495e', hat: 'cap', hatColor: '#f4a261', backpack: '#e07a3a', hair: '#2b1d14' });
    glider = new THREE.Group();
    const canopy = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 1.8, 24, 1, true, -1.1, 2.2), new THREE.MeshStandardMaterial({ color: '#ff7b54', side: THREE.DoubleSide, roughness: .6 }));
    canopy.rotation.set(0, 0, Math.PI / 2); canopy.rotation.y = Math.PI / 2; canopy.position.y = 2.2; canopy.castShadow = true; glider.add(canopy);
    const stripe = canopy.clone(); stripe.material = new THREE.MeshStandardMaterial({ color: '#ffd166', side: THREE.DoubleSide }); stripe.scale.set(1.002, .35, 1.002); glider.add(stripe);
    glider.position.y = 3.2; glider.visible = false; pm.g.add(glider);
    scene.add(pm.g);
    player.y = groundAt(player.x, player.z);
    placeNPCs();
    await step('지도를 그리는 중… 🗺️', 94);
    buildMapImage();
    setupPointer();
    await step('준비 완료!', 100);
    $('loading').classList.add('done');
    state.mode = 'title'; $('title').classList.add('open');
    cam.tx = player.x; cam.ty = player.y + 2; cam.tz = player.z;
    loop();
  }
  function startGame() {
    Snd.init(); Snd.chime([0, 4, 7, 12], .07);
    $('title').classList.remove('open'); state.mode = 'play'; document.body.classList.add('playing');
    setTimeout(() => { if (!S.met.chloe) toast('👋 앞에 있는 <b>클로에</b>에게 다가가 <kbd>E</kbd> 를 눌러 말을 걸어 보세요', 6000); }, 1200);
  }

  let last = performance.now(), titleA = 0;
  function loop() {
    requestAnimationFrame(loop);
    const now = performance.now(), dt = Math.min(.05, (now - last) / 1000); last = now;
    updateSky(dt);
    if (state.mode === 'title') {
      titleA += dt * .04; const r = 520;
      camera.position.set(Math.sin(titleA) * r, 260, Math.cos(titleA) * r); camera.lookAt(0, 20, 0);
    } else {
      updatePlayer(dt); updateCamera(dt); updateWorld(dt);
      if (state.freeCam) { const f = state.freeCam; camera.position.set(f[0], f[1], f[2]); camera.lookAt(f[3], f[4], f[5]); }
      if (state.dlg) { const d = state.dlg, txt = d.choices ? d.menuText : d.pages[d.i]; if (d.shown < txt.length) { d.shown = Math.min(txt.length, d.shown + dt * 45); renderDlg(); } }
    }
    if (post) post.render(scene, camera, ISL.U.uNight.value, ISL.U.uTime.value); else renderer.render(scene, camera);
  }

  // 버튼
  window.addEventListener('DOMContentLoaded', () => {
    $('startBtn').onclick = startGame;
    $('mapBtn').onclick = toggleMap; $('ppBtn').onclick = togglePassport; $('timeBtn').onclick = cycleTime; $('flyBtn').onclick = toggleFly; $('photoBtn').onclick = toggleUI; $('unphoto').onclick = toggleUI;
    $('sndBtn').onclick = () => { Snd.init(); Snd.on = !Snd.on; $('sndBtn').textContent = Snd.on ? '🔊' : '🔈'; };
    $('talkBtn').onclick = () => { if (state.dlg) dlgAdvance(); else interact(); };
    $('runBtn').onclick = () => $('runBtn').classList.toggle('on');
    $('jumpBtn').onclick = () => { if (!player.fly && player.ground) { player.vy = 9; player.ground = false; } };
    $('dlg').addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') dlgAdvance(); });
    document.querySelectorAll('.close').forEach(b => b.onclick = closeModals);
    document.querySelectorAll('#passport .tabs button').forEach(b => b.onclick = () => { ppTab = b.dataset.tab; renderPassport(); });
    boot().catch(err => { console.error(err); $('loadText').textContent = '앗, 불러오다 문제가 생겼어요: ' + err.message; });
  });
  ISL.debug = { look: (a) => { state.freeCam = a; }, player, cam, state, S, setTime: t => { tDay = t; envDirty = true; }, teleport: (x, z) => { player.x = x; player.z = z; player.y = groundAt(x, z); }, startGame, get camera() { return camera; } };
})();
