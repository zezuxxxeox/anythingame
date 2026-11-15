// 하늘, 물, 지형 메시, 나무, 구름, 입자, 오로라
(function () {
  const ISL = window.ISL;
  const rng = ISL.mulberry32(777);
  const U = ISL.U = { uTime: { value: 0 }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uDay: { value: 1 }, uNight: { value: 0 } };

  // ---------- 공통 하늘 색 (GLSL & JS 동일) ----------
  const SKY_GLSL = `
    uniform vec3 uSun; uniform float uDay; uniform float uTime;
    vec3 skyCol(vec3 d){
      float sunH=uSun.y; float day=smoothstep(-0.14,0.22,sunH); float sunset=exp(-pow(sunH*4.2,2.0));
      vec3 top=mix(vec3(0.004,0.007,0.025), vec3(0.10,0.30,0.78), day);
      vec3 hor=mix(vec3(0.018,0.03,0.07), vec3(0.60,0.76,0.95), day);
      float toward=0.5+0.5*dot(normalize(d.xz+1e-4), normalize(uSun.xz+1e-4));
      hor=mix(hor, vec3(1.0,0.42,0.18), sunset*(0.25+0.75*toward*toward)*0.9);
      top=mix(top, vec3(0.25,0.22,0.45), sunset*0.35);
      float h=max(d.y,0.0);
      return mix(hor, top, pow(h,0.42));
    }`;
  ISL.skyColJS = function (d, sun, out) {
    const ss = (a, b, v) => ISL.sstep(a, b, v);
    const day = ss(-0.14, 0.22, sun.y), sunset = Math.exp(-Math.pow(sun.y * 4.2, 2));
    const top = [0.004 + (0.10 - 0.004) * day, 0.007 + (0.30 - 0.007) * day, 0.025 + (0.78 - 0.025) * day];
    let hor = [0.018 + (0.6 - 0.018) * day, 0.03 + (0.76 - 0.03) * day, 0.07 + (0.95 - 0.07) * day];
    const l1 = Math.hypot(d.x, d.z) || 1, l2 = Math.hypot(sun.x, sun.z) || 1;
    const toward = 0.5 + 0.5 * (d.x * sun.x + d.z * sun.z) / (l1 * l2);
    const k = sunset * (0.25 + 0.75 * toward * toward) * 0.9;
    hor = [hor[0] + (1 - hor[0]) * k, hor[1] + (0.42 - hor[1]) * k, hor[2] + (0.18 - hor[2]) * k];
    const h = Math.pow(Math.max(d.y, 0), 0.42);
    out.setRGB(hor[0] + (top[0] - hor[0]) * h, hor[1] + (top[1] - hor[1]) * h, hor[2] + (top[2] - hor[2]) * h, THREE.LinearSRGBColorSpace);
    return out;
  };

  function makeSky() {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uSun: U.uSun, uDay: U.uDay, uTime: U.uTime },
      vertexShader: `varying vec3 vD; void main(){ vD=normalize(position); vec4 p=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*p; gl_Position.z=gl_Position.w*0.99999; }`,
      fragmentShader: SKY_GLSL + `
        varying vec3 vD;
        float hash(vec3 p){ p=fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
        void main(){
          vec3 d=normalize(vD); vec3 c=skyCol(d);
          float day=smoothstep(-0.14,0.22,uSun.y);
          float sd=dot(d,uSun);
          c+=vec3(1.0,0.85,0.6)*pow(max(sd,0.0),6.0)*0.25*day;
          c+=vec3(1.0,0.95,0.85)*smoothstep(0.9993,0.9997,sd)*30.0*smoothstep(-0.05,0.02,uSun.y);
          float md=dot(d,-uSun);
          c+=vec3(0.75,0.8,1.0)*smoothstep(0.9995,0.99975,md)*4.0*(1.0-day);
          c+=vec3(0.3,0.35,0.5)*pow(max(md,0.0),30.0)*0.15*(1.0-day);
          if(d.y>0.0){ vec3 q=floor(d*280.0); float s=hash(q); float tw=0.6+0.4*sin(uTime*2.0+s*50.0);
            c+=vec3(0.9,0.95,1.0)*step(0.9965,s)*(s-0.9965)*500.0*tw*(1.0-day)*smoothstep(0.0,0.15,d.y); }
          if(d.y<0.0) c=mix(c, c*0.6, smoothstep(0.0,-0.2,d.y));
          gl_FragColor=vec4(c,1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 24), mat);
    m.frustumCulled = false; m.renderOrder = -10;
    return m;
  }

  // ---------- 물 ----------
  let heightTex = null;
  function makeHeightTex() {
    const g = ISL.getGrid(), N = ISL.N, d = new Uint16Array(N * N);
    for (let i = 0; i < N * N; i++) d[i] = THREE.DataUtils.toHalfFloat(g[i]);
    heightTex = new THREE.DataTexture(d, N, N, THREE.RedFormat, THREE.HalfFloatType);
    heightTex.magFilter = heightTex.minFilter = THREE.LinearFilter; heightTex.needsUpdate = true;
  }
  function waterMat(opts) {
    const o = Object.assign({ river: 0, deep: '#0b3a52', shallow: '#2f9fae', opacityBoost: 0, milky: 0 }, opts);
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uRiver: { value: o.river }, uDeep: { value: new THREE.Color(o.deep) }, uShallow: { value: new THREE.Color(o.shallow) },
      uHeight: { value: heightTex }, uHB: { value: new THREE.Vector3(ISL.E, ISL.STEP, ISL.N) }, uMilky: { value: o.milky },
      uSunCol: { value: new THREE.Color(1, 1, 1) },
    }]);
    uniforms.uTime = U.uTime; uniforms.uSun = U.uSun; uniforms.uDay = U.uDay;
    const m = new THREE.ShaderMaterial({
      uniforms, transparent: true, fog: true, depthWrite: true,
      vertexShader: `
        varying vec3 vW; varying vec2 vUv; varying vec3 vN;
        #include <fog_pars_vertex>
        void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal);
          vec4 mvPosition=viewMatrix*w; gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: SKY_GLSL + `
        varying vec3 vW; varying vec2 vUv; varying vec3 vN;
        uniform float uRiver; uniform vec3 uDeep; uniform vec3 uShallow; uniform sampler2D uHeight; uniform vec3 uHB; uniform float uMilky; uniform vec3 uSunCol;
        #include <fog_pars_fragment>
        float wh(vec2 p){ return sin(p.x*0.8+uTime*1.3)*0.25+sin(p.y*0.63-uTime*1.1+p.x*0.3)*0.25+sin((p.x+p.y)*1.7+uTime*2.1)*0.12+sin((p.x*2.3-p.y*1.9)-uTime*2.7)*0.08+sin(p.x*4.1+p.y*3.3+uTime*3.3)*0.04; }
        void main(){
          vec2 p = uRiver>0.5 ? vec2(vUv.x*5.0, vUv.y*0.9 - uTime*2.2) : vW.xz*0.32;
          float e=0.06; float dx=wh(p+vec2(e,0.0))-wh(p-vec2(e,0.0)); float dz=wh(p+vec2(0.0,e))-wh(p-vec2(0.0,e));
          float camD=length(cameraPosition-vW); float amp=0.22*exp(-camD/260.0)+0.02;
          vec3 n=normalize(vec3(-dx/(2.0*e)*amp, 1.0, -dz/(2.0*e)*amp));
          vec3 gN=normalize(vN); float steep=1.0-abs(gN.y);
          n=normalize(mix(n,gN,smoothstep(0.15,0.5,steep)));
          vec3 v=normalize(cameraPosition-vW);
          float fres=0.03+0.97*pow(1.0-max(dot(n,v),0.0),5.0);
          vec3 r=reflect(-v,n); r.y=abs(r.y);
          vec3 refl=skyCol(r);
          vec2 huv=((vW.xz+uHB.x)/uHB.y+0.5)/uHB.z; float ground=texture2D(uHeight,huv).r;
          float depth=max(vW.y-ground,0.0); float dk=1.0-exp(-depth*0.22);
          float lit=0.18+0.82*uDay;
          vec3 water=mix(uShallow,uDeep,dk)*lit;
          vec3 col=mix(water,refl,fres*(1.0-uMilky*0.6));
          vec3 L=uSun.y>-0.05?uSun:-uSun;
          float spec=pow(max(dot(r,L),0.0),220.0)*(uSun.y>-0.05?2.5:0.5);
          col+=uSunCol*spec;
          float foam=smoothstep(1.1,0.0,depth)*(0.55+0.45*sin(depth*9.0-uTime*2.2+vW.x*0.15));
          float fall=smoothstep(0.2,0.6,steep);
          foam+=fall*(0.75+0.25*sin(vUv.y*3.0+uTime*14.0+vUv.x*20.0));
          if(uRiver>0.5) foam+=0.12*smoothstep(0.6,1.0,sin(p.x*3.0+p.y*2.0));
          col=mix(col, vec3(0.92,0.96,1.0)*lit, clamp(foam,0.0,1.0)*0.85);
          float a = uRiver>0.5 ? mix(0.72,0.95,dk) : mix(0.35,0.97,smoothstep(0.0,3.5,depth));
          a=max(a,fall); if(uMilky>0.5) a=max(a,0.9);
          gl_FragColor=vec4(col,a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    return m;
  }

  function makeWater(scene) {
    makeHeightTex();
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000, 1, 1), waterMat({}));
    sea.rotation.x = -Math.PI / 2; sea.renderOrder = 1; scene.add(sea);
    ISL.waterMats = [sea.material];
    for (const L of ISL.lakes) {
      const lagoon = L.color === 'lagoon';
      const m = waterMat(lagoon ? { deep: '#5fc4cf', shallow: '#a9e6e6', milky: 1 } : { deep: '#0d4a5e', shallow: '#3aa5a8' });
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(L.r * 1.25, 64), m);
      mesh.rotation.x = -Math.PI / 2; mesh.position.set(L.x, L.level, L.z); mesh.renderOrder = 1; scene.add(mesh);
      ISL.waterMats.push(m);
    }
    const rm = waterMat({ river: 1, deep: '#164f5c', shallow: '#4aa7a4' });
    ISL.waterMats.push(rm);
    for (const r of ISL.rivers) {
      const pos = [], uv = [], idx = [];
      let n = 0;
      for (let i = 0; i < r.pts.length; i++) {
        if (r.lv[i] < -0.3) break;
        const a = r.pts[Math.max(0, i - 1)], b = r.pts[Math.min(r.pts.length - 1, i + 1)];
        let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz); tx /= l; tz /= l;
        const w = r.wd[i] * 1.18, x = r.pts[i][0], z = r.pts[i][1], y = Math.max(r.lv[i], 0.02);
        pos.push(x - tz * w, y, z + tx * w, x + tz * w, y, z - tx * w);
        uv.push(0, r.s[i] / 6, 1, r.s[i] / 6);
        if (n) { const k = (n - 1) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
        n++;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, rm); mesh.renderOrder = 2; scene.add(mesh);
    }
  }

  // ---------- 지형 메시 ----------
  const C = h => new THREE.Color(h);
  const PAL = {
    grass: [C('#6f8d4c'), C('#5f9a3c'), C('#82a74c'), C('#a3a35c'), C('#4f8c3f')],
    grass2: [C('#4f6b3a'), C('#7fb24a'), C('#9cb85a'), C('#b8a565'), C('#6aa04a')],
    sand: [C('#2b2b30'), C('#cdbf98'), C('#dcc896'), C('#e2cd98'), C('#cfc4a5')],
    rock: [C('#3d3c40'), C('#7f7a73'), C('#8a8278'), C('#9a8a74'), C('#6f6a63')],
    snow: C('#f2f5fa'), glacier: C('#d6e6f2'), dirt: C('#8a7352'), wet: C('#8f8a77'), under: C('#56614f'),
  };
  const tmpC = new THREE.Color(), tmpC2 = new THREE.Color();

  ISL.groundTints = []; // (x,z) => [THREE.Color, amount] | null

  function terrainColor(x, z, h, slope, out) {
    const W = ISL.weights(x, z);
    const nz = ISL.noise(x * .045, z * .045), nz2 = ISL.noise(x * .011 + 5, z * .011);
    out.setRGB(0, 0, 0); tmpC2.setRGB(0, 0, 0);
    for (let i = 0; i < 5; i++) if (W[i] > .01) {
      tmpC.copy(PAL.grass[i]).lerp(PAL.grass2[i], .5 + .5 * nz2); out.r += tmpC.r * W[i]; out.g += tmpC.g * W[i]; out.b += tmpC.b * W[i];
    }
    // 아이슬란드 용암 대지
    if (W[0] > .2 && ISL.noise(x * .02, z * .02) > .25) out.lerp(PAL.rock[0], .55 * W[0]);
    const sandK = ISL.sstep(3.2, 1.2, h);
    if (sandK > 0) {
      for (let i = 0; i < 5; i++) { tmpC2.r += PAL.sand[i].r * W[i]; tmpC2.g += PAL.sand[i].g * W[i]; tmpC2.b += PAL.sand[i].b * W[i]; }
      out.lerp(tmpC2, sandK);
    }
    if (h < 0) out.lerp(PAL.under, ISL.sstep(0, -6, h));
    const wl = ISL.waterAt(x, z);
    if (wl.kind !== 'sea' && h < wl.level + 0.6) out.lerp(PAL.wet, ISL.sstep(wl.level + .6, wl.level - 1.5, h));
    const rockK = Math.max(ISL.sstep(.28, .5, slope + nz * .05), ISL.sstep(70, 115, h + nz * 15) * W[1] * .85);
    if (rockK > 0) { tmpC2.setRGB(0, 0, 0); for (let i = 0; i < 5; i++) { tmpC2.r += PAL.rock[i].r * W[i]; tmpC2.g += PAL.rock[i].g * W[i]; tmpC2.b += PAL.rock[i].b * W[i]; } out.lerp(tmpC2, rockK); }
    const snowLine = W[1] * 128 + W[0] * 62 + (W[2] + W[3] + W[4]) * 400 + nz * 12;
    const snowK = ISL.sstep(snowLine, snowLine + 14, h) * (1 - ISL.sstep(.55, .8, slope) * .7);
    if (snowK > 0) out.lerp(W[0] > .5 ? PAL.glacier : PAL.snow, snowK);
    for (const f of ISL.groundTints) { const t = f(x, z); if (t) out.lerp(t[0], t[1]); }
    const v = 1 + nz * .07; out.r *= v; out.g *= v; out.b *= v;
    return out;
  }

  function makeTerrain(scene) {
    const N = ISL.N, E = ISL.E, S = ISL.STEP, g = ISL.getGrid();
    const pos = new Float32Array(N * N * 3), col = new Float32Array(N * N * 3);
    const c = new THREE.Color();
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i, x = -E + i * S, z = -E + j * S, h = g[k];
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      if (h < -20) { c.copy(PAL.under); } else {
        const hx = g[k + (i < N - 1 ? 1 : 0)] - g[k - (i > 0 ? 1 : 0)], hz = g[k + (j < N - 1 ? N : 0)] - g[k - (j > 0 ? N : 0)];
        const ny = 2 * S / Math.hypot(hx, 2 * S, hz);
        terrainColor(x, z, h, 1 - ny, c);
      }
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    }
    const idx = new Uint32Array((N - 1) * (N - 1) * 6); let p = 0;
    for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
      const o = j * N + i; idx[p++] = o; idx[p++] = o + N; idx[p++] = o + 1; idx[p++] = o + 1; idx[p++] = o + N; idx[p++] = o + N + 1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: 0 }));
    mesh.receiveShadow = true;
    scene.add(mesh);
    ISL.terrainMesh = mesh;
  }

  // ---------- 지오메트리 병합 도우미 ----------
  function merge(parts) {
    const arrs = parts.map(([g, c, smoothCenter]) => {
      const n = g.index ? g.toNonIndexed() : g;
      if (smoothCenter) { // 구형 노멀로 부드러운 잎 덩어리
        const p = n.attributes.position, nn = n.attributes.normal;
        for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3(p.getX(i) - smoothCenter.x, p.getY(i) - smoothCenter.y, p.getZ(i) - smoothCenter.z).normalize(); nn.setXYZ(i, v.x, v.y, v.z); }
      }
      return [n, new THREE.Color(c)];
    });
    let total = 0; arrs.forEach(([g]) => total += g.attributes.position.count);
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
    let o = 0;
    for (const [g, c] of arrs) {
      pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
      for (let i = 0; i < g.attributes.position.count; i++) { col[(o + i) * 3] = c.r; col[(o + i) * 3 + 1] = c.g; col[(o + i) * 3 + 2] = c.b; }
      o += g.attributes.position.count;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return out;
  }
  ISL.merge = merge;
  function blob(r, detail, sx, sy, sz, x, y, z, seed) {
    const g = new THREE.IcosahedronGeometry(r, detail), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
      const k = 1 + ISL.noise(vx * .9 + seed, vy * .9 + vz * .7) * .22;
      p.setXYZ(i, vx * k * sx + x, vy * k * sy + y, vz * k * sz + z);
    }
    g.computeVertexNormals();
    return [g, null, new THREE.Vector3(x, y, z)];
  }
  const tr = (g, x, y, z, rx = 0, ry = 0, rz = 0) => { g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); return g; };
  function col(part, c) { part[1] = c; return part; }

  const TREE_GEO = {
    conifer: () => merge([[tr(new THREE.CylinderGeometry(.25, .4, 2.4, 6), 0, 1.2, 0), '#5b4030'],
      [tr(new THREE.ConeGeometry(2.6, 4.6, 8), 0, 3.6, 0), '#2d5a35'], [tr(new THREE.ConeGeometry(2.0, 3.8, 8), 0, 5.7, 0), '#30613a'],
      [tr(new THREE.ConeGeometry(1.3, 3.2, 8), 0, 7.6, 0), '#356b3f']]),
    broad: () => merge([[tr(new THREE.CylinderGeometry(.3, .5, 4, 6), 0, 2, 0), '#5e4634'],
      col(blob(2.6, 1, 1, .85, 1, 0, 5.4, 0, 1), '#4f8a3a'), col(blob(1.9, 1, 1, .9, 1, 1.4, 4.6, .6, 2), '#5a9442'), col(blob(1.8, 1, 1, .9, 1, -1.2, 4.9, -.7, 3), '#47803a')]),
    poplar: () => merge([[tr(new THREE.CylinderGeometry(.22, .35, 3, 6), 0, 1.5, 0), '#5e4634'], col(blob(1.6, 1, 1, 3.2, 1, 0, 7, 0, 4), '#5b8f3d')]),
    cypress: () => merge([[tr(new THREE.CylinderGeometry(.2, .3, 1.5, 6), 0, .75, 0), '#4d3a2c'], col(blob(1.1, 1, 1, 4.2, 1, 0, 5.2, 0, 5), '#2f4f2c')]),
    cherry: () => merge([[tr(new THREE.CylinderGeometry(.28, .45, 3.2, 6), 0, 1.6, 0, 0, 0, .12), '#4a3530'],
      [tr(new THREE.CylinderGeometry(.15, .25, 2.2, 5), .9, 3.4, 0, 0, 0, -.6), '#4a3530'],
      col(blob(2.6, 1, 1.25, .7, 1.2, .3, 4.7, 0, 6), '#f6b9cb'), col(blob(1.9, 1, 1.1, .7, 1.1, 1.8, 4.2, .9, 7), '#f9cad7'), col(blob(1.7, 1, 1.1, .7, 1, -1.5, 4.4, -.6, 8), '#f2a8be')]),
    maple: () => merge([[tr(new THREE.CylinderGeometry(.25, .4, 3, 6), 0, 1.5, 0), '#4d3a2e'],
      col(blob(2.3, 1, 1.2, .8, 1.2, 0, 4.4, 0, 9), '#c9452b'), col(blob(1.6, 1, 1.1, .8, 1.1, 1.3, 4, .5, 10), '#e0702f')]),
    jpine: () => merge([[tr(new THREE.CylinderGeometry(.22, .4, 4.5, 6), 0, 2.2, 0, 0, 0, .25), '#5b4436'],
      col(blob(1.8, 1, 1.5, .45, 1.3, 1.1, 4.6, 0, 11), '#2f5a3a'), col(blob(1.3, 1, 1.5, .45, 1.3, -.6, 3.6, .8, 12), '#335f3c'), col(blob(1.1, 1, 1.5, .45, 1.3, .2, 5.6, -.5, 13), '#2c5537')]),
    stonepine: () => merge([[tr(new THREE.CylinderGeometry(.25, .42, 6, 6), 0, 3, 0, 0, 0, .08), '#6b4f3a'], col(blob(3.2, 1, 1.3, .38, 1.3, .4, 6.6, 0, 14), '#466b3a')]),
    olive: () => merge([[tr(new THREE.CylinderGeometry(.35, .55, 2, 6), 0, 1, 0, 0, 0, .15), '#6d5a48'], col(blob(2.1, 1, 1.2, .75, 1.2, .2, 3.1, 0, 15), '#8b9a62'), col(blob(1.4, 1, 1, .8, 1, 1.2, 2.8, .5, 16), '#9aa874')]),
    birch: () => merge([[tr(new THREE.CylinderGeometry(.12, .18, 2.4, 5), 0, 1.2, 0), '#e8e2d6'], col(blob(1.1, 1, 1, 1.1, 1, 0, 2.6, 0, 17), '#7e9a4c')]),
    bush: () => merge([col(blob(1.1, 1, 1.2, .7, 1.1, 0, .5, 0, 18), '#4d7a3a')]),
  };

  function treeMaterial() {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 });
    m.onBeforeCompile = sh => {
      sh.uniforms.uTime = U.uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
        float ph = instanceMatrix[3].x*0.13 + instanceMatrix[3].z*0.07;
        float sw = max(position.y-1.5,0.0);
        transformed.x += sin(uTime*1.3+ph)*0.035*sw; transformed.z += cos(uTime*1.1+ph*1.3)*0.025*sw;
        #endif`);
    };
    return m;
  }
  ISL.treeMaterial = treeMaterial;

  ISL.noTree = []; // {x,z,r}
  ISL.noTreeSeg = []; // {ax,az,bx,bz,w}
  function blocked(x, z) {
    for (const b of ISL.noTree) if ((x - b.x) ** 2 + (z - b.z) ** 2 < b.r * b.r) return true;
    for (const s of ISL.noTreeSeg) if (ISL.segDist(x, z, s.ax, s.az, s.bx, s.bz).d < s.w) return true;
    return false;
  }
  ISL.blocked = blocked;

  function placeInstances(scene, type, list, opts = {}) {
    if (!list.length) return;
    const geo = typeof type === 'string' ? TREE_GEO[type]() : type;
    const material = opts.material || treeMaterial();
    // 공간을 타일로 나눠 화면 밖/그림자 범위 밖의 덩어리는 그리지 않도록
    const TILE = opts.tile || 200, tiles = new Map();
    for (const t of list) { const k = Math.floor(t.x / TILE) + ',' + Math.floor(t.z / TILE); if (!tiles.has(k)) tiles.set(k, []); tiles.get(k).push(t); }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler(), c = new THREE.Color();
    const out = [];
    for (const part of tiles.values()) {
      const mesh = new THREE.InstancedMesh(geo, material, part.length);
      part.forEach((t, i) => {
        e.set(t.rx || 0, t.ry !== undefined ? t.ry : rng() * Math.PI * 2, t.rz || 0); q.setFromEuler(e);
        s.set(t.s * (t.sx || 1), t.s * (t.sy || 1), t.s * (t.sz || 1)); p.set(t.x, t.y, t.z);
        m.compose(p, q, s); mesh.setMatrixAt(i, m);
        const v = t.tint !== undefined ? t.tint : .85 + rng() * .3; c.setRGB(v, v * (0.95 + rng() * .1), v); mesh.setColorAt(i, t.color || c);
      });
      mesh.computeBoundingSphere();
      mesh.castShadow = opts.shadow !== false; mesh.receiveShadow = true;
      mesh.userData.lod = opts.lod || 1100;
      scene.add(mesh); out.push(mesh); ISL.chunks.push(mesh);
    }
    return out;
  }
  ISL.chunks = [];
  ISL.placeInstances = placeInstances;

  function makeVegetation(scene) {
    const lists = {}; Object.keys(TREE_GEO).forEach(k => lists[k] = []);
    const pick = (arr) => { let r = rng() * arr.reduce((a, b) => a + b[1], 0); for (const [k, w] of arr) { if ((r -= w) <= 0) return k; } return arr[0][0]; };
    const MIX = [
      [['birch', 3], ['bush', 2]],
      [['conifer', 7], ['broad', 2], ['bush', 1]],
      [['broad', 6], ['poplar', 2], ['cypress', 1], ['bush', 1]],
      [['olive', 4], ['stonepine', 4], ['broad', 2], ['cypress', 1]],
      [['broad', 3], ['cherry', 3], ['maple', 2], ['jpine', 3]],
    ];
    const DENS = [0.06, 0.6, 0.35, 0.42, 0.62];
    for (let k = 0; k < 60000; k++) {
      const x = (rng() * 2 - 1) * 760, z = (rng() * 2 - 1) * 760;
      const h = ISL.H(x, z); if (h < 2.2) continue;
      const W = ISL.weights(x, z); let ri = 0; for (let i = 1; i < 5; i++) if (W[i] > W[ri]) ri = i;
      // 숲 덩어리 패턴
      const forest = ISL.noise(x * .012 + ri * 3, z * .012);
      if (rng() > DENS[ri] * (forest > 0 ? 1 : .25)) continue;
      if (ISL.slopeAt(x, z) > .3) continue;
      if (ri === 1 && h > 135) continue;
      if (ri === 0 && h > 55) continue;
      const w = ISL.waterAt(x, z); if (w.level > h - 1.2 && w.kind !== 'sea') continue;
      let near = false; for (const r of ISL.rivers) { const q = ISL.riverNearest(r, x, z); if (q && q.d < q.w + 3) { near = true; break; } }
      if (near || blocked(x, z)) continue;
      let t = pick(MIX[ri]);
      if (ri === 1 && h > 80) t = 'conifer';
      lists[t].push({ x, y: h - .2, z, s: .75 + rng() * .6 });
      if (lists[t].length > 3500) lists[t].pop();
    }
    for (const k in lists) placeInstances(scene, k, lists[k]);
    ISL.treeCount = Object.values(lists).reduce((a, b) => a + b.length, 0);

    // 풀 & 들꽃
    const tuft = (() => {
      const parts = [];
      for (let i = 0; i < 3; i++) { const g = new THREE.ConeGeometry(.12, .9, 3, 1, true); g.translate(0, .45, 0); g.rotateZ((i - 1) * .35); g.rotateY(i * 2.1); parts.push([g, '#ffffff']); }
      return merge(parts);
    })();
    const flower = merge([[tr(new THREE.CylinderGeometry(.03, .03, .7, 3), 0, .35, 0), '#4f7a35'], [tr(new THREE.IcosahedronGeometry(.18, 0), 0, .75, 0), '#ffffff']]);
    const grass = [], flowers = [];
    const FLOWER_COL = [['#8f6ad8', '#6f7fe0', '#b07be0'], ['#ffffff', '#f4d23c', '#e85a8a', '#7aa0f0'], ['#e8423a', '#f4d23c', '#ffffff'], ['#f2c14e', '#e86b5a', '#ffffff'], ['#f6c3d3', '#ffffff', '#d94f6a']];
    for (let k = 0; k < 90000 && grass.length < 26000; k++) {
      const x = (rng() * 2 - 1) * 760, z = (rng() * 2 - 1) * 760;
      const h = ISL.H(x, z); if (h < 2.5) continue;
      if (ISL.slopeAt(x, z) > .25) continue;
      const W = ISL.weights(x, z); let ri = 0; for (let i = 1; i < 5; i++) if (W[i] > W[ri]) ri = i;
      if ((ri === 1 && h > 120) || (ri === 0 && h > 55)) continue;
      const w = ISL.waterAt(x, z); if (w.kind !== 'sea' && w.level > h - .5) continue;
      if (blocked(x, z)) continue;
      terrainColor(x, z, h, 0, tmpC);
      const cl = tmpC.clone().multiplyScalar(.82);
      if (rng() < (ri === 0 ? .25 : .12)) {
        const fc = FLOWER_COL[ri][Math.floor(rng() * 3)];
        const n = ri === 0 ? 5 : 3;
        for (let f = 0; f < n; f++) flowers.push({ x: x + (rng() - .5) * 3, y: h, z: z + (rng() - .5) * 3, s: .8 + rng() * .6, sy: ri === 0 ? 1.8 : 1, color: new THREE.Color(fc) });
      }
      grass.push({ x, y: h - .05, z, s: .7 + rng() * .6, sy: 1.3, color: cl });
    }
    placeInstances(scene, tuft, grass, { shadow: false, lod: 260, tile: 100, material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }) });
    placeInstances(scene, flower, flowers, { shadow: false, lod: 260, tile: 100, material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 }) });

    // 바위
    const rock = merge([blob(1.4, 1, 1.3, .8, 1, 0, .4, 0, 30)]);
    const rocks = [];
    for (let k = 0; k < 12000 && rocks.length < 1500; k++) {
      const x = (rng() * 2 - 1) * 760, z = (rng() * 2 - 1) * 760, h = ISL.H(x, z);
      if (h < .5) continue; const sl = ISL.slopeAt(x, z); if ((sl < .15 && rng() > .08) || sl > .5) continue;
      const W0 = ISL.weights(x, z); if (h > 52 * W0[0] + 120 * W0[1] + 400 * (W0[2] + W0[3] + W0[4])) continue;
      if (blocked(x, z)) continue;
      const W = ISL.weights(x, z);
      rocks.push({ x, y: h - .3, z, s: .6 + rng() * 1.6, color: new THREE.Color(W[0] > .5 ? '#3c3b3e' : '#8a857d').multiplyScalar(.85 + rng() * .3) });
    }
    placeInstances(scene, rock, rocks, { material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, flatShading: true }) });
  }

  // ---------- 구름 ----------
  function puffTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.45, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  ISL.puffTex = null;
  function makeClouds(scene) {
    ISL.puffTex = puffTexture();
    const group = new THREE.Group(); const mats = [];
    for (let i = 0; i < 46; i++) {
      const cx = (rng() * 2 - 1) * 1300, cz = (rng() * 2 - 1) * 1300, cy = 190 + rng() * 120;
      const m = new THREE.SpriteMaterial({ map: ISL.puffTex, transparent: true, depthWrite: false, opacity: .85, fog: false });
      mats.push(m);
      const n = 6 + Math.floor(rng() * 7);
      for (let k = 0; k < n; k++) {
        const s = new THREE.Sprite(m); const sz = 50 + rng() * 70;
        s.scale.set(sz * 1.6, sz, 1); s.position.set(cx + (rng() - .5) * 140, cy + (rng() - .5) * 18, cz + (rng() - .5) * 70);
        group.add(s);
      }
    }
    scene.add(group);
    ISL.clouds = { group, mats };
  }

  // ---------- 입자 ----------
  class Emitter {
    constructor(scene, n, opts) {
      this.o = Object.assign({ size: 3, color: '#ffffff', opacity: .7, life: 3, additive: false }, opts);
      this.n = n; this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.age = new Float32Array(n).fill(1e9); this.life = new Float32Array(n);
      this.alpha = new Float32Array(n);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
      const mat = new THREE.ShaderMaterial({
        uniforms: { uMap: { value: ISL.puffTex }, uColor: { value: new THREE.Color(this.o.color) }, uSize: { value: this.o.size }, uLight: { value: 1 } },
        vertexShader: `attribute float alpha; varying float vA; uniform float uSize; void main(){ vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=uSize*300.0/max(-mv.z,1.0); gl_Position=projectionMatrix*mv; }`,
        fragmentShader: `uniform sampler2D uMap; uniform vec3 uColor; uniform float uLight; varying float vA; void main(){ vec4 t=texture2D(uMap,gl_PointCoord); gl_FragColor=vec4(uColor*uLight, t.a*vA);
          #include <colorspace_fragment>
        }`,
        transparent: true, depthWrite: false, blending: this.o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      this.mat = mat;
      this.points = new THREE.Points(g, mat); this.points.frustumCulled = false; scene.add(this.points);
      this.i = 0;
    }
    emit(x, y, z, vx, vy, vz, life) {
      const i = this.i = (this.i + 1) % this.n;
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z; this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
      this.age[i] = 0; this.life[i] = life || this.o.life;
    }
    update(dt, grav = 0, drag = 0) {
      for (let i = 0; i < this.n; i++) {
        if (this.age[i] > this.life[i]) { this.alpha[i] = 0; continue; }
        this.age[i] += dt; const k = this.age[i] / this.life[i];
        this.vel[i * 3 + 1] += grav * dt; const d = 1 - drag * dt;
        this.vel[i * 3] *= d; this.vel[i * 3 + 1] *= d; this.vel[i * 3 + 2] *= d;
        this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
        this.alpha[i] = this.o.opacity * Math.min(1, k * 5) * (1 - k);
      }
      this.points.geometry.attributes.position.needsUpdate = true; this.points.geometry.attributes.alpha.needsUpdate = true;
    }
  }
  ISL.Emitter = Emitter;

  // ---------- 오로라 ----------
  function makeAurora(scene) {
    const g = new THREE.PlaneGeometry(1, 1, 160, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) + .5, v = p.getY(i) + .5;
      const a = -1.2 + u * 2.4, r = 1100;
      p.setXYZ(i, Math.sin(a) * r + Math.sin(u * 9) * 60, 260 + v * 230, -Math.cos(a) * r * .55 - 250 + Math.cos(u * 7) * 50);
    }
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uNight: U.uNight },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `varying vec2 vUv; uniform float uTime; uniform float uNight;
        void main(){
          float x=vUv.x;
          float wave=sin(x*26.0+uTime*0.35)*0.5+sin(x*11.0-uTime*0.22)*0.5;
          float rays=0.5+0.5*sin(x*260.0+sin(x*37.0+uTime*0.8)*4.0);
          rays=0.35+0.65*rays*rays;
          float yy=vUv.y+wave*0.07;
          float band=smoothstep(0.0,0.1,yy)*exp(-max(yy-0.08,0.0)*3.2);
          float pulse=0.55+0.45*sin(x*6.0+uTime*0.3+sin(x*17.0)*1.5);
          vec3 col=mix(vec3(0.15,1.0,0.55), vec3(0.75,0.3,1.0), smoothstep(0.25,0.85,yy));
          float a=band*rays*pulse*uNight*1.25*smoothstep(0.0,0.08,x)*smoothstep(1.0,0.92,x);
          gl_FragColor=vec4(col*a,a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    });
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false; scene.add(m);
    ISL.aurora = m;
  }

  ISL.Nature = { makeSky, makeWater, makeTerrain, makeVegetation, makeClouds, makeAurora, terrainColor };
})();
