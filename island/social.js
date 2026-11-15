// 감정표현·채팅 말풍선. 모든 행동은 Net을 거치므로 나중에 서버만 붙이면 멀티플레이가 된다.
(function () {
  const ISL = window.ISL;
  // ---------- 네트워크 계층 (지금은 혼자, 나중에 WebSocket으로 교체) ----------
  const Net = {
    id: 'me-' + Math.random().toString(36).slice(2, 8), name: '여행자', listeners: {},
    on(type, cb) { (this.listeners[type] || (this.listeners[type] = [])).push(cb); },
    emit(type, msg) { (this.listeners[type] || []).forEach(cb => cb(msg)); },
    // send: 서버가 있으면 서버로 보내고, 없으면 바로 내 화면에 반영
    send(type, data) { const msg = Object.assign({ from: this.id, name: this.name, t: Date.now() }, data); if (this.socket && this.socket.readyState === 1) this.socket.send(JSON.stringify({ type, msg })); this.emit(type, msg); },
    connect(url) { // 나중에: Net.connect('wss://서버주소') 로 다른 여행자들과 연결
      this.socket = new WebSocket(url);
      this.socket.onmessage = e => { try { const { type, msg } = JSON.parse(e.data); if (msg.from !== this.id) this.emit(type, msg); } catch (err) {} };
    },
  };
  ISL.Net = Net;

  const EMOTES = [
    { id: 'wave', icon: '👋', name: '손 흔들기', dur: 2.2 }, { id: 'bow', icon: '🙇', name: '인사', dur: 1.8 }, { id: 'dance', icon: '💃', name: '춤', dur: 6 },
    { id: 'clap', icon: '👏', name: '박수', dur: 2.4 }, { id: 'sit', icon: '🪑', name: '앉기', dur: 9999 }, { id: 'heart', icon: '❤️', name: '하트', dur: 2 },
    { id: 'laugh', icon: '😂', name: '웃기', dur: 2.2 }, { id: 'cheer', icon: '🙌', name: '만세', dur: 2.4 }, { id: 'cry', icon: '😢', name: '슬픔', dur: 2.6 },
  ];
  ISL.EMOTES = EMOTES;

  // ---------- 동작 포즈 (사람 모형에 적용) ----------
  ISL.applyEmote = function (m, id, t) {
    const s = Math.sin(t * 8);
    m.g.children[0] && (m.body = m.body || m.g);
    m.root = m.root || m.g;
    m.extraY = 0; m.tilt = 0; m.spin = 0;
    switch (id) {
      case 'wave': m.armR.rotation.x = -2.8; m.armR.rotation.z = .4 + s * .35; break;
      case 'bow': m.tilt = Math.min(1, Math.sin(Math.min(t, 1.6) / 1.6 * Math.PI) * 1.4) * .55; m.armL.rotation.x = m.armR.rotation.x = .2; break;
      case 'dance': m.armL.rotation.x = -2 + Math.sin(t * 6) * .8; m.armR.rotation.x = -2 - Math.sin(t * 6) * .8; m.legL.rotation.x = Math.max(0, Math.sin(t * 6)) * .6; m.legR.rotation.x = Math.max(0, -Math.sin(t * 6)) * .6; m.extraY = Math.abs(Math.sin(t * 6)) * .25; m.spin = Math.sin(t * 1.5) * .9; break;
      case 'clap': { const c = Math.abs(Math.sin(t * 9)); m.armL.rotation.x = m.armR.rotation.x = -1.4; m.armL.rotation.z = -.5 * c - .1; m.armR.rotation.z = .5 * c + .1; break; }
      case 'sit': m.legL.rotation.x = m.legR.rotation.x = -1.45; m.armL.rotation.x = m.armR.rotation.x = -.4; m.extraY = -.62; break;
      case 'heart': m.armL.rotation.x = m.armR.rotation.x = -2.9; m.armL.rotation.z = -.6; m.armR.rotation.z = .6; break;
      case 'laugh': m.extraY = Math.abs(Math.sin(t * 10)) * .08; m.tilt = -.12; m.armL.rotation.x = m.armR.rotation.x = -.6; break;
      case 'cheer': m.armL.rotation.x = m.armR.rotation.x = -3; m.armL.rotation.z = -.35; m.armR.rotation.z = .35; m.extraY = Math.max(0, Math.sin(t * 7)) * .45; break;
      case 'cry': m.tilt = .25; m.armL.rotation.x = m.armR.rotation.x = -2.2; m.armL.rotation.z = -.9; m.armR.rotation.z = .9; break;
    }
  };
  ISL.resetPose = function (m) { m.armL.rotation.set(0, 0, 0); m.armR.rotation.set(0, 0, 0); m.legL.rotation.set(0, 0, 0); m.legR.rotation.set(0, 0, 0); m.extraY = 0; m.tilt = 0; m.spin = 0; };

  // ---------- 말풍선 (3D 머리 위에 붙는 HTML) ----------
  const bubbles = [];
  ISL.bubble = function (obj, text, sec = 5, cls = '') {
    const old = bubbles.find(b => b.obj === obj); if (old) { old.el.remove(); bubbles.splice(bubbles.indexOf(old), 1); }
    const el = document.createElement('div'); el.className = 'bubble ' + cls; el.textContent = text; document.getElementById('bubbles').appendChild(el);
    bubbles.push({ obj, el, until: performance.now() + sec * 1000 });
  };
  const v = new THREE.Vector3();
  ISL.updateBubbles = function (camera) {
    const now = performance.now();
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      if (now > b.until || !b.obj.parent) { b.el.remove(); bubbles.splice(i, 1); continue; }
      b.obj.getWorldPosition(v); v.y += 2.15; v.project(camera);
      const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      b.el.style.display = vis ? 'block' : 'none';
      if (vis) { b.el.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; b.el.style.top = ((1 - v.y) / 2 * innerHeight) + 'px'; b.el.style.opacity = Math.min(1, (b.until - now) / 400); }
    }
  };
  ISL.clearBubbles = () => { bubbles.forEach(b => b.el.remove()); bubbles.length = 0; };

  // ---------- 채팅 기록 ----------
  ISL.chatLog = function (name, text, me) {
    const log = document.getElementById('chatlog'); const d = document.createElement('div');
    d.innerHTML = `<b${me ? ' class="me"' : ''}></b> <span></span>`; d.querySelector('b').textContent = name; d.querySelector('span').textContent = text;
    log.appendChild(d); while (log.children.length > 6) log.firstChild.remove();
    log.classList.add('show'); clearTimeout(log._t); log._t = setTimeout(() => log.classList.remove('show'), 9000);
  };
})();
