// 충돌: 원(나무·기둥)과 회전된 상자(건물). 공간 해시로 빠르게 찾는다.
(function () {
  const ISL = window.ISL;
  class Phys {
    constructor(cell = 16) { this.cell = cell; this.map = new Map(); this.list = []; this.stamp = 0; }
    add(c) {
      if (c.t === 'b') { c.cs = Math.cos(c.a || 0); c.sn = Math.sin(c.a || 0); c.br = Math.hypot(c.hw, c.hd); } else c.br = c.r;
      if (c.y1 === undefined) c.y1 = 1e9; if (c.y0 === undefined) c.y0 = -1e9; c.mark = 0;
      const C = this.cell, i0 = Math.floor((c.x - c.br) / C), i1 = Math.floor((c.x + c.br) / C), j0 = Math.floor((c.z - c.br) / C), j1 = Math.floor((c.z + c.br) / C);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = i * 100003 + j; let a = this.map.get(k); if (!a) this.map.set(k, a = []); a.push(c); }
      this.list.push(c); return c;
    }
    near(x, z, r) {
      const out = [], C = this.cell, s = ++this.stamp;
      for (let i = Math.floor((x - r) / C); i <= Math.floor((x + r) / C); i++) for (let j = Math.floor((z - r) / C); j <= Math.floor((z + r) / C); j++) {
        const a = this.map.get(i * 100003 + j); if (!a) continue;
        for (const c of a) if (c.mark !== s) { c.mark = s; out.push(c); }
      }
      return out;
    }
    // 세계 → 상자 좌표 (three.js의 rotation.y와 같은 방향)
    toLocal(c, x, z) { const dx = x - c.x, dz = z - c.z; return [dx * c.cs - dz * c.sn, dx * c.sn + dz * c.cs]; }
    toWorld(c, lx, lz) { return [c.x + lx * c.cs + lz * c.sn, c.z - lx * c.sn + lz * c.cs]; }
    resolve(x, z, r, y, h = 1.8) {
      for (let it = 0; it < 3; it++) {
        let moved = false;
        for (const c of this.near(x, z, r + 2)) {
          if (c.off || (y !== undefined && (y > c.y1 - .25 || y + h < c.y0))) continue;
          if (c.t === 'c') {
            const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
            if (d < m) { if (d < 1e-5) { x += m; } else { x = c.x + dx / d * m; z = c.z + dz / d * m; } moved = true; }
          } else {
            let [lx, lz] = this.toLocal(c, x, z);
            if (c.pass && c.pass(lx, lz)) continue;
            const qx = Math.max(-c.hw, Math.min(c.hw, lx)), qz = Math.max(-c.hd, Math.min(c.hd, lz));
            let ddx = lx - qx, ddz = lz - qz, d = Math.hypot(ddx, ddz);
            if (d >= r) continue;
            if (d > 1e-5) { lx += ddx / d * (r - d); lz += ddz / d * (r - d); }
            else { // 안쪽: 가장 가까운 면으로 밀어냄
              const px = c.hw - Math.abs(lx), pz = c.hd - Math.abs(lz);
              if (px < pz) lx = Math.sign(lx || 1) * (c.hw + r); else lz = Math.sign(lz || 1) * (c.hd + r);
            }
            [x, z] = this.toWorld(c, lx, lz); moved = true;
          }
        }
        if (!moved) break;
      }
      return [x, z];
    }
    // 점이 어떤 물체 안에 있는가 (카메라 충돌용)
    solidAt(x, y, z) {
      for (const c of this.near(x, z, 4)) {
        if (c.canopy && y > c.canopy[1] && y < c.canopy[2] && Math.hypot(x - c.x, z - c.z) < c.canopy[0]) return true;
        if (y < c.y0 || y > c.y1) continue;
        if (c.t === 'c') { if (Math.hypot(x - c.x, z - c.z) < c.r + .2) return true; }
        else { const [lx, lz] = this.toLocal(c, x, z); if (Math.abs(lx) < c.hw + .2 && Math.abs(lz) < c.hd + .2) return true; }
      }
      return false;
    }
  }
  ISL.Phys = Phys;
  ISL.world = new Phys(16);
  // 그룹(위치·회전) 기준 상자를 세계 충돌체로 등록
  ISL.colBox = (g, lx, lz, w, d, height, extra) => {
    const a = g.rotation.y, cs = Math.cos(a), sn = Math.sin(a);
    return ISL.world.add(Object.assign({ t: 'b', x: g.position.x + lx * cs + lz * sn, z: g.position.z - lx * sn + lz * cs, hw: w / 2, hd: d / 2, a, y0: g.position.y - 2, y1: g.position.y + (height || 30) }, extra || {}));
  };
  ISL.colCircle = (x, z, r, y0, y1) => ISL.world.add({ t: 'c', x, z, r, y0: y0 === undefined ? -1e9 : y0, y1: y1 === undefined ? 1e9 : y1 });
})();
