// 하늘, 물, 지형, 나무, 풀밭, 구름, 입자, 오로라
(function () {
  const ISL = window.ISL;
  const rng = ISL.mulberry32(777);
  const U = ISL.U = { uTime: { value: 0 }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uDay: { value: 1 }, uNight: { value: 0 } };

  // ---------- 하늘 색 (GLSL & JS 동일) ----------
  const SKY_GLSL = `
    uniform vec3 uSun; uniform float uDay; uniform float uTime;
    vec3 skyCol(vec3 d){
      float sunH=uSun.y; float day=smoothstep(-0.14,0.22,sunH); float sunset=exp(-pow(sunH*4.2,2.0));
      vec3 top=mix(vec3(0.004,0.007,0.025), vec3(0.13,0.34,0.80), day);
      vec3 hor=mix(vec3(0.018,0.03,0.07), vec3(0.66,0.80,0.95), day);
      float toward=0.5+0.5*dot(normalize(d.xz+1e-4), normalize(uSun.xz+1e-4));
      hor=mix(hor, vec3(1.0,0.45,0.2), sunset*(0.25+0.75*toward*toward)*0.9);
      top=mix(top, vec3(0.25,0.22,0.45), sunset*0.35);
      float h=max(d.y,0.0);
      return mix(hor, top, pow(h,0.42));
    }`;
  ISL.skyColJS = function (d, sun, out) {
    const day = ISL.sstep(-0.14, 0.22, sun.y), sunset = Math.exp(-Math.pow(sun.y * 4.2, 2));
    const top = [0.004 + (0.13 - 0.004) * day, 0.007 + (0.34 - 0.007) * day, 0.025 + (0.80 - 0.025) * day];
    let hor = [0.018 + (0.66 - 0.018) * day, 0.03 + (0.80 - 0.03) * day, 0.07 + (0.95 - 0.07) * day];
    const l1 = Math.hypot(d.x, d.z) || 1, l2 = Math.hypot(sun.x, sun.z) || 1;
    const toward = 0.5 + 0.5 * (d.x * sun.x + d.z * sun.z) / (l1 * l2), k = sunset * (0.25 + 0.75 * toward * toward) * 0.9;
    hor = [hor[0] + (1 - hor[0]) * k, hor[1] + (0.45 - hor[1]) * k, hor[2] + (0.2 - hor[2]) * k];
    const h = Math.pow(Math.max(d.y, 0), 0.42);
    out.setRGB(hor[0] + (top[0] - hor[0]) * h, hor[1] + (top[1] - hor[1]) * h, hor[2] + (top[2] - hor[2]) * h, THREE.LinearSRGBColorSpace);
    return out;
  };

  function makeSky() {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uSun: U.uSun, uDay: U.uDay, uTime: U.uTime, uNight: U.uNight },
      vertexShader: `varying vec3 vD; void main(){ vD=normalize(position); vec4 p=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*p; gl_Position.z=gl_Position.w*0.99999; }`,
      fragmentShader: SKY_GLSL + `
        varying vec3 vD; uniform float uNight;
        float h2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y); }
        // 오로라: 높이별 층을 따라 빛의 커튼을 적분 (아래 초록, 위 보라·붉은빛)
        vec3 aurora(vec3 d){
          vec3 acc=vec3(0.0);
          for(int i=0;i<22;i++){
            float fi=float(i)/22.0, hgt=0.75+fi*0.9;
            vec2 p=d.xz/max(d.y,0.03)*hgt;
            float wob=sin(p.x*0.55+uTime*0.045)*0.45+sin(p.x*1.3-uTime*0.07)*0.18+(n2(p*0.5+uTime*0.015)-0.5)*0.7;
            float band=p.y+1.7+wob;
            float cur=exp(-band*band*9.0)+0.45*exp(-pow(band+0.9+sin(p.x*0.8)*0.3,2.0)*14.0);
            float rays=n2(vec2(p.x*7.0+n2(p*1.7+uTime*0.05)*3.0, fi*2.0+uTime*0.08)); rays=pow(rays,1.6);
            vec3 col=mix(vec3(0.15,1.0,0.5), vec3(0.45,0.35,1.0), smoothstep(0.35,0.75,fi));
            col=mix(col, vec3(1.0,0.25,0.35), smoothstep(0.75,1.0,fi));
            acc+=col*cur*(0.25+rays)*(1.0-fi*0.6)*0.085;
          }
          return acc*smoothstep(0.02,0.14,d.y);
        }
        float hash(vec3 p){ p=fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
        void main(){
          vec3 d=normalize(vD); vec3 c=skyCol(d);
          float day=smoothstep(-0.14,0.22,uSun.y); float sd=dot(d,uSun);
          c+=vec3(1.0,0.82,0.55)*pow(max(sd,0.0),5.0)*0.3*day;
          c+=vec3(1.0,0.95,0.85)*smoothstep(0.9993,0.9997,sd)*30.0*smoothstep(-0.05,0.02,uSun.y);
          float md=dot(d,-uSun);
          c+=vec3(0.75,0.8,1.0)*smoothstep(0.9995,0.99975,md)*4.0*(1.0-day);
          c+=vec3(0.3,0.35,0.5)*pow(max(md,0.0),30.0)*0.15*(1.0-day);
          if(d.y>0.0){ vec3 q=floor(d*280.0); float s=hash(q); float tw=0.6+0.4*sin(uTime*2.0+s*50.0);
            c+=vec3(0.9,0.95,1.0)*step(0.9965,s)*(s-0.9965)*500.0*tw*(1.0-day)*smoothstep(0.0,0.15,d.y); }
          if(d.y>0.0 && uNight>0.01){
            vec3 mwAxis=normalize(vec3(0.35,0.25,0.9)); float mw=exp(-pow(dot(d,mwAxis),2.0)*28.0);
            c+=vec3(0.55,0.6,0.85)*mw*(0.02+0.05*n2(d.xy*40.0+d.z*20.0))*uNight;
            c+=aurora(d)*uNight;
          }
          // 구름: 하늘 위 한 층에 펼쳐진 뭉게구름 (해 쪽은 밝고 두꺼운 곳은 그늘)
          if(d.y>0.0){
            float sunsetC=exp(-pow(uSun.y*4.2,2.0));
            vec2 cp=d.xz/(d.y+0.06)*0.55+vec2(uTime*0.0035,uTime*0.0012);
            float f=0.0, a=0.5; vec2 q=cp; for(int i=0;i<5;i++){ f+=a*n2(q); q=q*2.03+vec2(1.7,9.2); a*=0.5; }
            float cov=smoothstep(0.5,0.74,f);
            vec2 q2=cp+normalize(uSun.xz+1e-4)*0.06; float f2=0.0; a=0.5; for(int i=0;i<4;i++){ f2+=a*n2(q2); q2=q2*2.03+vec2(1.7,9.2); a*=0.5; }
            float shade=clamp(1.05-(f2-f)*4.0-cov*0.22,0.42,1.08);
            vec3 cc=mix(vec3(0.05,0.06,0.09), vec3(0.98,0.98,1.0), day)*shade;
            cc=mix(cc, vec3(1.0,0.62,0.42)*shade*1.05, sunsetC*day*0.7);
            cc+=vec3(1.0,0.9,0.75)*pow(max(sd,0.0),12.0)*(1.0-cov)*0.6*day;
            c=mix(c, cc, cov*smoothstep(0.0,0.12,d.y)*0.96);
          }
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

  // ---------- 파도 (GLSL과 JS가 같은 식 → 헤엄칠 때 파도를 타고 출렁임) ----------
  const WAVES = [[1, .3, 34, .34, .5], [.6, -.8, 21, .22, .45], [-.4, 1, 13, .11, .4], [.9, .5, 7.5, .05, .35]];
  const WAVE_GLSL = `
    vec3 gerst(vec2 p, float amp, out vec3 nrm){
      vec3 o=vec3(0.); vec3 n=vec3(0.,1.,0.);
      ${WAVES.map(([dx, dz, L, A, Q]) => { const l = Math.hypot(dx, dz), k = 2 * Math.PI / L, c = Math.sqrt(9.8 / k); return `{ vec2 d=vec2(${(dx / l).toFixed(4)},${(dz / l).toFixed(4)}); float ph=${k.toFixed(5)}*(dot(d,p)-${c.toFixed(4)}*uTime); float A=${A}*amp; o.x+=${Q}*A*d.x*cos(ph); o.z+=${Q}*A*d.y*cos(ph); o.y+=A*sin(ph); n.x-=d.x*${k.toFixed(5)}*A*cos(ph); n.z-=d.y*${k.toFixed(5)}*A*cos(ph); n.y-=${Q}*${k.toFixed(5)}*A*sin(ph); }`; }).join('\n')}
      nrm=normalize(n); return o;
    }`;
  ISL.waveY = function (x, z, t) {
    const depth = -ISL.H(x, z), amp = ISL.sstep(.5, 8, depth) * .85 + .15; let y = 0;
    for (const [dx, dz, L, A] of WAVES) { const l = Math.hypot(dx, dz), k = 2 * Math.PI / L, c = Math.sqrt(9.8 / k); y += A * amp * Math.sin(k * ((dx * x + dz * z) / l - c * t)); }
    return y;
  };
  // ---------- 물 ----------
  let heightTex = null;
  function makeHeightTex() {
    const g = ISL.getGrid(), N = ISL.N, d = new Uint16Array(N * N);
    for (let i = 0; i < N * N; i++) d[i] = THREE.DataUtils.toHalfFloat(g[i]);
    heightTex = new THREE.DataTexture(d, N, N, THREE.RedFormat, THREE.HalfFloatType);
    heightTex.magFilter = heightTex.minFilter = THREE.LinearFilter; heightTex.needsUpdate = true;
    ISL.heightTex = heightTex;
  }
  function waterMat(opts) {
    const o = Object.assign({ river: 0, deep: '#0b3a52', shallow: '#2f9fae', milky: 0, wave: 0 }, opts);
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uRiver: { value: o.river }, uDeep: { value: new THREE.Color(o.deep) }, uShallow: { value: new THREE.Color(o.shallow) },
      uHeight: { value: heightTex }, uHB: { value: new THREE.Vector3(ISL.E, ISL.STEP, ISL.N) }, uMilky: { value: o.milky },
      uSunCol: { value: new THREE.Color(1, 1, 1) }, uWave: { value: o.wave }, uCam: { value: new THREE.Vector3() },
    }]);
    uniforms.uTime = U.uTime; uniforms.uSun = U.uSun; uniforms.uDay = U.uDay;
    return new THREE.ShaderMaterial({
      uniforms, transparent: true, fog: true,
      vertexShader: `
        varying vec3 vW; varying vec2 vUv; varying vec3 vN; varying float vSp;
        uniform float uWave; uniform float uTime; uniform sampler2D uHeight; uniform vec3 uHB; uniform vec3 uCam;
        attribute float aSpeed;
        #include <fog_pars_vertex>
        ` + WAVE_GLSL + `
        void main(){ vUv=uv; vSp=aSpeed; vec4 w=modelMatrix*vec4(position,1.0); vN=normalize(mat3(modelMatrix)*normal);
          if(uWave>0.5){
            vec2 huv=((w.xz+uHB.x)/uHB.y+0.5)/uHB.z; float depth=-texture2D(uHeight,huv).r;
            float amp=(smoothstep(0.5,8.0,depth)*0.85+0.15)*(1.0-smoothstep(380.0,700.0,length(w.xz-uCam.xz)));
            vec3 nn; w.xyz+=gerst(w.xz, amp, nn); vN=nn;
          }
          vW=w.xyz;
          vec4 mvPosition=viewMatrix*w; gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: SKY_GLSL + `
        varying vec3 vW; varying vec2 vUv; varying vec3 vN; varying float vSp;
        uniform float uRiver; uniform float uWave; uniform vec3 uDeep; uniform vec3 uShallow; uniform sampler2D uHeight; uniform vec3 uHB; uniform float uMilky; uniform vec3 uSunCol;
        #include <fog_pars_fragment>
        float wh(vec2 p){ return sin(p.x*0.8+uTime*1.3)*0.25+sin(p.y*0.63-uTime*1.1+p.x*0.3)*0.25+sin((p.x+p.y)*1.7+uTime*2.1)*0.12+sin((p.x*2.3-p.y*1.9)-uTime*2.7)*0.08+sin(p.x*4.1+p.y*3.3+uTime*3.3)*0.04; }
        void main(){
          // 강은 경사에 따라 빠르기가 다른 흐름 (흐름맵 두 단계 섞기로 늘어짐 없이)
          float ph0=fract(uTime*0.35), ph1=fract(uTime*0.35+0.5), bw=abs(ph0-0.5)*2.0;
          vec2 p = uRiver>0.5 ? vec2(vUv.x*5.0, vUv.y*0.9 - ph0*vSp*3.0) : vW.xz*0.32 + vec2(uTime*0.05, 0.0);
          vec2 p2 = vec2(vUv.x*5.0+0.37, vUv.y*0.9 - ph1*vSp*3.0+0.5);
          float e=0.06; float dx=wh(p+vec2(e,0.0))-wh(p-vec2(e,0.0)); float dz=wh(p+vec2(0.0,e))-wh(p-vec2(0.0,e));
          if(uRiver>0.5){ float dx2=wh(p2+vec2(e,0.0))-wh(p2-vec2(e,0.0)); float dz2=wh(p2+vec2(0.0,e))-wh(p2-vec2(0.0,e)); dx=mix(dx,dx2,bw)*(0.7+vSp*0.25); dz=mix(dz,dz2,bw)*(0.7+vSp*0.25); }
          float camD=length(cameraPosition-vW); float amp=0.2*exp(-camD/240.0)+0.02;
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
          col+=uSunCol*min(pow(max(dot(r,L),0.0),220.0)*(uSun.y>-0.05?2.5:0.5), 1.2);
          float foam=smoothstep(1.1,0.0,depth)*(0.55+0.45*sin(depth*9.0-uTime*2.2+vW.x*0.15));
          // 해안으로 밀려오는 하얀 파도 줄
          float brk=sin(depth*1.35 - uTime*1.7 + sin(vW.x*0.05+vW.z*0.04)*2.0);
          foam += smoothstep(0.55,0.95,brk)*smoothstep(5.0,0.6,depth)*0.75*(1.0-uRiver)*uWave;
          foam += smoothstep(0.32,0.6,vW.y)*smoothstep(0.55,0.9,sin(vW.x*0.7+vW.z*0.5+uTime)*0.5+0.5)*0.3*(1.0-uRiver)*uWave;
          float fall=smoothstep(0.2,0.6,steep);
          foam+=fall*(0.75+0.25*sin(vUv.y*3.0+uTime*14.0+vUv.x*20.0));
          if(uRiver>0.5) foam+=(0.08+smoothstep(1.6,3.2,vSp)*0.5)*smoothstep(0.55,1.0,sin(p.x*3.0+p.y*2.0)*0.5+sin(p2.x*2.0-p2.y*3.0)*0.5);
          col=mix(col, vec3(0.92,0.96,1.0)*lit, clamp(foam,0.0,1.0)*0.85);
          float a = uRiver>0.5 ? mix(0.72,0.95,dk) : mix(0.35,0.97,smoothstep(0.0,3.5,depth));
          a=max(a,fall); if(uMilky>0.5) a=max(a,0.9);
          gl_FragColor=vec4(col,a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
  }
  function makeWater(scene) {
    const segs = matchMedia('(pointer:coarse)').matches ? 160 : 260;
    const sg = new THREE.PlaneGeometry(1500, 1500, segs, segs); sg.rotateX(-Math.PI / 2);
    const seaMat = waterMat({ deep: '#0a3550', shallow: '#3fb5b8', wave: 1 });
    const sea = new THREE.Mesh(sg, seaMat); sea.renderOrder = 1; sea.frustumCulled = false; scene.add(sea);
    const rg = new THREE.RingGeometry(700, 5600, 64, 1); rg.rotateX(-Math.PI / 2);
    const far = new THREE.Mesh(rg, waterMat({ deep: '#0a3550', shallow: '#3fb5b8' })); far.renderOrder = 1; far.frustumCulled = false; scene.add(far);
    ISL.sea = { sea, far, step: 1500 / segs };
    ISL.waterMats = [seaMat, far.material];
    for (const L of ISL.lakes) {
      const m = waterMat(L.color === 'lagoon' ? { deep: '#5fc4cf', shallow: '#a9e6e6', milky: 1 } : L.color === 'glacier' ? { deep: '#2f6f86', shallow: '#7cc3d0' } : { deep: '#0d4a5e', shallow: '#3aa5a8' });
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(L.r * 1.25, 64), m);
      mesh.rotation.x = -Math.PI / 2; mesh.position.set(L.x, L.level, L.z); mesh.renderOrder = 1; scene.add(mesh);
      ISL.waterMats.push(m);
    }
    const rm = waterMat({ river: 1, deep: '#164f5c', shallow: '#4aa7a4' });
    ISL.waterMats.push(rm);
    for (const r of ISL.rivers) {
      const pos = [], uv = [], idx = [], spd = []; let n = 0;
      r.speed = new Float32Array(r.pts.length);
      for (let i = 0; i < r.pts.length; i++) {
        const i0 = Math.max(0, i - 2), i1 = Math.min(r.pts.length - 1, i + 2);
        r.speed[i] = Math.max(.6, Math.min(3.6, .75 + (r.lv[i0] - r.lv[i1]) / Math.max(1, r.s[i1] - r.s[i0]) * 28));
      }
      for (let i = 0; i < r.pts.length; i++) {
        if (r.lv[i] < -0.3) break;
        spd.push(r.speed[i], r.speed[i]);
        const a = r.pts[Math.max(0, i - 1)], b = r.pts[Math.min(r.pts.length - 1, i + 1)];
        let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz); tx /= l; tz /= l;
        const w = r.wd[i] * 1.18, x = r.pts[i][0], z = r.pts[i][1], y = Math.max(r.lv[i], 0.02);
        pos.push(x - tz * w, y, z + tx * w, x + tz * w, y, z - tx * w); uv.push(0, r.s[i] / 6, 1, r.s[i] / 6);
        if (n) { const k = (n - 1) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
        n++;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('aSpeed', new THREE.Float32BufferAttribute(spd, 1));
      g.setIndex(idx); g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, rm); mesh.renderOrder = 2; scene.add(mesh);
    }
  }

  // ---------- 지면 색 ----------
  const C = h => new THREE.Color(h);
  const PAL = {
    grass: [C('#5f7a48'), C('#62a040'), C('#86ab4e'), C('#a9a85e'), C('#559444')],
    grass2: [C('#4b6040'), C('#80b44c'), C('#9fbb5c'), C('#c2ac68'), C('#6ea44c')],
    sand: [C('#2b2b30'), C('#cdbf98'), C('#ddc996'), C('#e8cd92'), C('#d2c6a6')],
    rock: [C('#3d3c40'), C('#86817a'), C('#8d8579'), C('#a08d73'), C('#6f6a63')],
    snow: C('#f2f5fa'), glacier: C('#d6e6f2'), wet: C('#8f8a77'), under: C('#56614f'), gold: C('#d8a560'), chalk: C('#ece9e1'), goldSand: C('#efd39b'),
  };
  const WILD = [
    { g: .2, gc: C('#6f8a4f'), fl: .1, fp: 2 }, { g: .55, gc: C('#6aa544'), fl: .14, fp: 1 }, { g: .5, gc: C('#7aa748'), fl: .04, fp: 3 },
    { g: .45, gc: C('#aaa865'), fl: .05, fp: 6 }, { g: .5, gc: C('#679e45'), fl: .03, fp: 7 },
  ];
  const tmpC = new THREE.Color(), tmpC2 = new THREE.Color();
  const SURF = { rock: 0, snow: 0, sand: 0, wet: 0, cliff: 0, water: false };
  ISL.groundTints = []; // (x,z) => [Color, amount, grassHeight?] | null

  function natural(x, z, h, slope, W, out) {
    const nz = ISL.noise(x * .045, z * .045), nz2 = ISL.noise(x * .011 + 5, z * .011);
    out.setRGB(0, 0, 0);
    for (let i = 0; i < 5; i++) if (W[i] > .01) { tmpC.copy(PAL.grass[i]).lerp(PAL.grass2[i], .5 + .5 * nz2); out.r += tmpC.r * W[i]; out.g += tmpC.g * W[i]; out.b += tmpC.b * W[i]; }
    if (W[0] > .2 && ISL.noise(x * .02, z * .02) > .25) out.lerp(PAL.rock[0], .55 * W[0]); // 이끼 낀 용암 대지
    const d = Math.hypot(x, z) / ISL.coastRadius(x, z);
    const ck = d > .8 ? ISL.cliffK(x, z, W) : 0; SURF.cliff = ck;
    const sandK = ISL.sstep(3.2, 1.2, h); SURF.sand = sandK;
    if (sandK > 0) { tmpC2.setRGB(0, 0, 0); for (let i = 0; i < 5; i++) { tmpC2.r += PAL.sand[i].r * W[i]; tmpC2.g += PAL.sand[i].g * W[i]; tmpC2.b += PAL.sand[i].b * W[i]; } if (ck > .3) tmpC2.lerp(W[2] > W[3] ? PAL.chalk : PAL.goldSand, .6); out.lerp(tmpC2, sandK); }
    if (h < 0) out.lerp(PAL.under, ISL.sstep(0, -6, h));
    const wl = ISL.waterAt(x, z); SURF.wet = 0; SURF.water = wl.level > h + .15; SURF.bank = 0;
    for (const rv of ISL.rivers) { const q = ISL.riverNearest(rv, x, z); if (!q || q.d > q.w + 4.5) continue; const b = ISL.sstep(q.w + 4.5, q.w + .3, q.d) * ISL.sstep(q.level + 2.6, q.level + .2, h); if (b > SURF.bank) SURF.bank = b; }
    if (SURF.bank > 0) { tmpC2.set(ISL.noise(x * .6, z * .6) > .1 ? '#8c8576' : '#5e5444'); out.lerp(tmpC2, SURF.bank * .75); }
    if (wl.kind !== 'sea' && h < wl.level + 0.6) { SURF.wet = ISL.sstep(wl.level + .6, wl.level - 1.5, h); out.lerp(PAL.wet, SURF.wet); }
    let rockK = Math.max(ISL.sstep(.2, .36, slope + nz * .04), ISL.sstep(70, 115, h + nz * 15) * W[1] * .85);
    if (ck > .2) rockK = Math.max(rockK, ISL.sstep(.08, .22, slope) * Math.min(1, ck * 1.5));
    SURF.rock = rockK;
    if (rockK > 0) {
      tmpC2.setRGB(0, 0, 0); for (let i = 0; i < 5; i++) { tmpC2.r += PAL.rock[i].r * W[i]; tmpC2.g += PAL.rock[i].g * W[i]; tmpC2.b += PAL.rock[i].b * W[i]; }
      if (ck > .2) tmpC2.lerp(W[2] > W[3] ? PAL.chalk : PAL.gold, ISL.sstep(.2, .6, ck));
      out.lerp(tmpC2, rockK);
    }
    const snowLine = W[1] * 128 + W[0] * 62 + (W[2] + W[3] + W[4]) * 400 + nz * 12;
    const snowK = ISL.sstep(snowLine, snowLine + 14, h) * (1 - ISL.sstep(.55, .8, slope) * .7); SURF.snow = snowK;
    if (snowK > 0) out.lerp(W[0] > .5 ? PAL.glacier : PAL.snow, snowK);
    return out;
  }

  // 모든 격자점: 지면 색, 풀 높이·색, 들꽃, 토지 이용(밭·길·마을)을 한 번에 굽기
  function bakeGround() {
    const N = ISL.N, E = ISL.E, S = ISL.STEP, g = ISL.getGrid();
    const col = new Float32Array(N * N * 3), A = new Uint8Array(N * N * 4), B = new Uint8Array(N * N * 4), LU = new Uint8Array(N * N);
    const c = new THREE.Color(), G = { g: 0, gc: new THREE.Color(), fl: 0, fp: 0, lu: 0 };
    const srgb = v => Math.round(255 * Math.min(1, v <= .0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - .055));
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i, x = -E + i * S, z = -E + j * S, h = g[k];
      if (h < -8) { col[k * 3] = PAL.under.r; col[k * 3 + 1] = PAL.under.g; col[k * 3 + 2] = PAL.under.b; LU[k] = 4; continue; }
      const hx = g[k + (i < N - 1 ? 1 : 0)] - g[k - (i > 0 ? 1 : 0)], hz = g[k + (j < N - 1 ? N : 0)] - g[k - (j > 0 ? N : 0)];
      const slope = 1 - 2 * S / Math.hypot(hx, 2 * S, hz);
      const W = Array.from(ISL.weights(x, z));
      natural(x, z, h, slope, W, c);
      G.g = 0; G.fl = 0; G.fp = 0; G.lu = 0; G.gc.setRGB(0, 0, 0); let wm = 0;
      for (let r = 0; r < 5; r++) { const w = WILD[r]; G.g += W[r] * w.g; G.fl += W[r] * w.fl; G.gc.r += W[r] * w.gc.r; G.gc.g += W[r] * w.gc.g; G.gc.b += W[r] * w.gc.b; if (W[r] > wm) { wm = W[r]; G.fp = w.fp; } }
      G.gc.lerp(c, .3);
      const bare = Math.max(SURF.rock, SURF.snow, SURF.sand, SURF.wet, SURF.bank * .85, SURF.water ? 1 : 0);
      G.g *= (1 - bare) * (1 - ISL.sstep(.14, .27, slope)); G.fl *= (1 - bare) * (1 - ISL.sstep(.08, .18, slope));
      if (bare < .3 && !SURF.water) ISL.Land.groundInfo(x, z, h, slope, k, c, G);
      for (const f of ISL.groundTints) { const t = f(x, z); if (t) { c.lerp(t[0], t[1]); if (t[2] !== undefined) { G.g = t[2]; G.fl = 0; } else { G.g *= 1 - t[1]; G.fl *= 1 - t[1]; } if (t[1] > .5) G.lu = Math.max(G.lu, 3); } }
      if (SURF.water) G.lu = 4;
      if (G.g > .05) { tmpC.copy(G.gc).multiplyScalar(.62); c.lerp(tmpC, Math.min(.55, G.g * .6)); }
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      A[k * 4] = srgb(G.gc.r); A[k * 4 + 1] = srgb(G.gc.g); A[k * 4 + 2] = srgb(G.gc.b); A[k * 4 + 3] = Math.round(Math.max(0, Math.min(1, G.g)) * 255);
      B[k * 4] = Math.round(Math.max(0, Math.min(1, G.fl)) * 255); B[k * 4 + 1] = G.fp * 32;
      LU[k] = G.lu;
    }
    ISL.groundColors = col; ISL.groundLU = LU;
    const sd = new Float32Array(N * N); for (let k = 0; k < N * N; k++) sd[k] = (g[k] < -.3 && LU[k] === 4) || g[k] < -8 ? 0 : 1e9;
    for (let pass = 0; pass < 2; pass++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = j * N + i; if (i > 0) sd[k] = Math.min(sd[k], sd[k - 1] + S); if (j > 0) sd[k] = Math.min(sd[k], sd[k - N] + S); }
    for (let j = N - 1; j >= 0; j--) for (let i = N - 1; i >= 0; i--) { const k = j * N + i; if (i < N - 1) sd[k] = Math.min(sd[k], sd[k + 1] + S); if (j < N - 1) sd[k] = Math.min(sd[k], sd[k + N] + S); }
    ISL.seaDist = (x, z) => { const i = Math.round((x + E) / S), j = Math.round((z + E) / S); return (i < 0 || j < 0 || i >= N || j >= N) ? 0 : sd[j * N + i]; };
    const tA = new THREE.DataTexture(A, N, N, THREE.RGBAFormat); tA.magFilter = tA.minFilter = THREE.LinearFilter; tA.needsUpdate = true;
    const tB = new THREE.DataTexture(B, N, N, THREE.RGBAFormat); tB.magFilter = tB.minFilter = THREE.NearestFilter; tB.needsUpdate = true;
    ISL.grassTex = { A: tA, B: tB };
  }

  function makeTerrain(scene) {
    makeHeightTex();
    bakeGround();
    const N = ISL.N, E = ISL.E, S = ISL.STEP, g = ISL.getGrid();
    const pos = new Float32Array(N * N * 3);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = j * N + i; pos[k * 3] = -E + i * S; pos[k * 3 + 1] = g[k]; pos[k * 3 + 2] = -E + j * S; }
    const idx = new Uint32Array((N - 1) * (N - 1) * 6); let p = 0;
    for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) { const o = j * N + i; idx[p++] = o; idx[p++] = o + N; idx[p++] = o + 1; idx[p++] = o + 1; idx[p++] = o + N; idx[p++] = o + N + 1; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(ISL.groundColors, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95 });
    // 지면 세부 무늬: 여러 크기의 얼룩, 바위 지층
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = U.uTime;
      sh.vertexShader = 'varying vec3 vWP; varying vec3 vWN;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWP = (modelMatrix*vec4(transformed,1.0)).xyz; vWN = normal;');
      sh.fragmentShader = `varying vec3 vWP; varying vec3 vWN; uniform float uTime;
        float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
        float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
        ` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        float camD = length(cameraPosition - vWP);
        float n1 = vn(vWP.xz*0.045)*0.5 + vn(vWP.xz*0.21)*0.3 + vn(vWP.xz*1.1)*0.2*smoothstep(160.0,40.0,camD);
        diffuseColor.rgb *= mix(0.86, 1.12, n1);
        float swash = sin(uTime*0.9 + vn(vWP.xz*0.04)*6.0)*0.5+0.5;
        float wet = smoothstep(1.5, 0.3, vWP.y - swash*0.7) * step(-3.0, vWP.y);
        diffuseColor.rgb *= 1.0 - wet*0.38;
        float steep = 1.0 - clamp(normalize(vWN).y, 0.0, 1.0);
        float strata = sin(vWP.y*1.6 + vn(vWP.xz*0.04)*6.0)*0.5+0.5;
        float strata2 = sin(vWP.y*5.3 + vn(vWP.xz*0.2)*3.0)*0.5+0.5;
        float bright = dot(diffuseColor.rgb, vec3(.33)); diffuseColor.rgb *= mix(1.0, 0.88 + 0.12*strata + 0.05*strata2, smoothstep(0.3, 0.65, steep) * (1.0 - smoothstep(.55, .75, bright)*.85));`);
    };
    const mesh = new THREE.Mesh(geo, mat); mesh.receiveShadow = true;
    scene.add(mesh); ISL.terrainMesh = mesh;
  }

  // ---------- 나무 ----------
  function merge(parts) {
    const arrs = parts.map(([g, c, smoothCenter]) => {
      const n = g.index ? g.toNonIndexed() : g;
      if (!n.attributes.normal) n.computeVertexNormals();
      if (smoothCenter) { const p = n.attributes.position, nn = n.attributes.normal; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3(p.getX(i) - smoothCenter.x, p.getY(i) - smoothCenter.y, p.getZ(i) - smoothCenter.z).normalize(); nn.setXYZ(i, v.x, v.y, v.z); } }
      return [n, c ? new THREE.Color(c) : null];
    });
    let total = 0; arrs.forEach(([g]) => total += g.attributes.position.count);
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3), uv = new Float32Array(total * 2), leaf = new Float32Array(total);
    let o = 0, anyLeaf = false;
    for (const [g, c] of arrs) {
      const cnt = g.attributes.position.count;
      pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
      if (c) for (let i = 0; i < cnt; i++) { col[(o + i) * 3] = c.r; col[(o + i) * 3 + 1] = c.g; col[(o + i) * 3 + 2] = c.b; }
      else if (g.attributes.color) col.set(g.attributes.color.array, o * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
      if (g.attributes.aLeaf) { leaf.set(g.attributes.aLeaf.array, o); anyLeaf = true; }
      o += cnt;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); out.setAttribute('leafUv', new THREE.BufferAttribute(uv, 2)); out.setAttribute('aLeaf', new THREE.BufferAttribute(leaf, 1)); out.userData.leaf = anyLeaf;
    return out;
  }
  ISL.merge = merge;

  // 잎 텍스처: 투명 배경 위에 작은 잎 수십 장 (흰색 계열 → 정점 색으로 물들임)
  let leafTex = null;
  function getLeafTex() {
    if (leafTex) return leafTex;
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), r = ISL.mulberry32(5);
    x.clearRect(0, 0, 256, 256);
    for (let i = 0; i < 230; i++) {
      const a = r() * 6.283, d = Math.pow(r(), .6) * 112, px = 128 + Math.cos(a) * d, py = 128 + Math.sin(a) * d, L = 9 + r() * 12, ang = a + (r() - .5) * 1.4;
      const v = 150 + r() * 105; x.fillStyle = `rgb(${v * .92 | 0},${v | 0},${v * .85 | 0})`;
      x.beginPath(); x.ellipse(px, py, L, L * .42, ang, 0, 6.283); x.fill();
      x.strokeStyle = 'rgba(60,70,40,.35)'; x.lineWidth = 1; x.beginPath(); x.moveTo(px - Math.cos(ang) * L, py - Math.sin(ang) * L); x.lineTo(px + Math.cos(ang) * L, py + Math.sin(ang) * L); x.stroke();
    }
    leafTex = new THREE.CanvasTexture(c); leafTex.colorSpace = THREE.SRGBColorSpace; leafTex.anisotropy = 4;
    return leafTex;
  }

  // 잎 덩어리: 잎 카드(투명 텍스처 사각형) 수십 장을 덩어리 모양으로 배치. 법선은 수관 중심에서 바깥으로 → 부드러운 빛
  function canopy(parts, low, high, seed) {
    const cL = C(low), cH = C(high), r = ISL.mulberry32(seed * 977 + 13);
    let y0 = 1e9, y1 = -1e9, cx = 0, cy = 0, cz = 0;
    for (const [x, y, z, rr, , sy = 1] of parts) { y0 = Math.min(y0, y - rr * sy); y1 = Math.max(y1, y + rr * sy); cx += x; cy += y; cz += z; }
    cx /= parts.length; cy /= parts.length; cz /= parts.length;
    const pos = [], nor = [], col = [], uv = [], leaf = [], idx = [];
    const v = new THREE.Vector3(), n = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
    for (const [x, y, z, rr, sx = 1, sy = 1, sz = sx] of parts) {
      const cards = Math.round(9 + rr * 9);
      for (let k = 0; k < cards; k++) {
        // 껍질 근처에 많이: 바깥에서 잘 보이는 잎
        const th = r() * 6.283, ph = Math.acos(2 * r() - 1), rad = rr * (.45 + .5 * Math.pow(r(), .5));
        const px = x + Math.sin(ph) * Math.cos(th) * rad * sx, py = y + Math.cos(ph) * rad * sy * .9, pz = z + Math.sin(ph) * Math.sin(th) * rad * sz;
        n.set(px - cx, (py - cy) * 1.1, pz - cz).normalize();
        const tw = new THREE.Vector3(r() - .5, r() - .5, r() - .5).normalize(); const fn = n.clone().multiplyScalar(.55).add(tw.multiplyScalar(.45)).normalize();
        t1.crossVectors(fn, Math.abs(fn.y) > .9 ? new THREE.Vector3(1, 0, 0) : up).normalize(); t2.crossVectors(fn, t1).normalize();
        const size = rr * (.85 + r() * .5), base = pos.length / 3;
        const ht = Math.max(0, Math.min(1, (py - y0) / (y1 - y0) * .8 + n.y * .15 + (r() - .5) * .15));
        c.copy(cL).lerp(cH, ht);
        for (const [a, b, u, w] of [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]]) {
          pos.push(px + (t1.x * a + t2.x * b) * size * .5, py + (t1.y * a + t2.y * b) * size * .5, pz + (t1.z * a + t2.z * b) * size * .5);
          v.copy(n).multiplyScalar(.8).addScaledVector(fn, .2).normalize(); nor.push(v.x, v.y, v.z);
          col.push(c.r, c.g, c.b); uv.push(u, w); leaf.push(1);
        }
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('leafUv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('aLeaf', new THREE.Float32BufferAttribute(leaf, 1)); g.setIndex(idx);
    return [g, null];
  }
  ISL.canopy = canopy;
  function trunk(parts, color) { // [x0,y0,z0,x1,y1,z1,r0,r1]
    return parts.map(([x0, y0, z0, x1, y1, z1, r0, r1]) => {
      const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0), g = new THREE.CylinderGeometry(r1, r0, len, 6, 1);
      g.translate(0, len / 2, 0);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0).normalize()));
      g.translate(x0, y0, z0); return [g, color];
    });
  }
  function tiers(n, h0, h1, r0, r1, low, high, seed) { // 침엽수: 층마다 아래로 처진 가지 카드
    const cL = C(low), cH = C(high), r = ISL.mulberry32(seed * 31 + 7), pos = [], nor = [], col = [], uv = [], leaf = [], idx = [], c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), y = h0 + (h1 - h0) * t, R = r0 + (r1 - r0) * t, k = Math.max(5, Math.round(7 + R * 2));
      for (let j = 0; j < k; j++) {
        const a = (j + r() * .5) / k * 6.283 + i * .7, ca = Math.cos(a), sa = Math.sin(a), droop = .45 + r() * .2, w = R * .9;
        const base = pos.length / 3;
        // 카드: 줄기에서 바깥으로 뻗고 아래로 처짐, 폭은 가지 방향의 수직
        const pts = [[0, -w * .45], [R, -w * .45], [R, w * .45], [0, w * .45]];
        for (const [d, side] of pts) {
          pos.push(ca * d - sa * side, y - d * droop + .25, sa * d + ca * side);
          const nx = ca * .55, ny = .85, nz = sa * .55, l = Math.hypot(nx, ny, nz); nor.push(nx / l, ny / l, nz / l);
          c.copy(cL).lerp(cH, Math.min(1, t * .6 + d / R * .35 + r() * .1)); col.push(c.r, c.g, c.b);
          uv.push(d / R * .9 + .05, side / w + .5); leaf.push(1);
        }
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('leafUv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('aLeaf', new THREE.Float32BufferAttribute(leaf, 1)); g.setIndex(idx);
    return [[g, null]];
  }
  const BARK = '#5b4636', BARK2 = '#4a3a30';
  const TREE_GEO = {
    broad: () => merge([...trunk([[0, 0, 0, 0, 3.4, 0, .42, .28], [0, 2.6, 0, 1.3, 4.2, .3, .18, .1], [0, 2.8, 0, -1.2, 4.3, -.4, .18, .1]], BARK),
      canopy([[0, 5.3, 0, 2.0], [1.4, 4.7, .4, 1.55], [-1.3, 4.8, -.5, 1.55], [.3, 4.4, 1.3, 1.4], [-.4, 4.6, -1.35, 1.4], [0, 6.4, .1, 1.35], [.9, 5.9, -.8, 1.2]], '#3c6a2d', '#93c25a', 1)]),
    plane: () => merge([...trunk([[0, 0, 0, 0, 5, 0, .5, .34], [0, 4, 0, 1.6, 6, .4, .2, .12], [0, 4.2, 0, -1.5, 6.1, -.4, .2, .12]], '#9a8e78'),
      canopy([[0, 7.2, 0, 2.6, 1, .8], [1.9, 6.6, .4, 1.9, 1, .8], [-1.8, 6.7, -.5, 1.9, 1, .8], [.4, 6.4, 1.8, 1.8, 1, .8], [-.4, 6.5, -1.8, 1.8, 1, .8], [0, 8.4, 0, 1.7]], '#40702f', '#9cc760', 2)]),
    poplar: () => merge([...trunk([[0, 0, 0, 0, 3, 0, .3, .2]], BARK), canopy([[0, 4, 0, 1.2], [0, 5.6, 0, 1.15], [0, 7.2, 0, 1.0], [0, 8.6, 0, .75], [.3, 6.4, .3, .9]], '#3e6e2e', '#8fbf55', 3)]),
    cypress: () => merge([...trunk([[0, 0, 0, 0, 1.2, 0, .22, .18]], BARK2), canopy([[0, 1.8, 0, .95], [0, 3.1, 0, .9], [0, 4.4, 0, .78], [0, 5.6, 0, .6], [0, 6.6, 0, .4], [0, 7.3, 0, .22]], '#1f3b26', '#4d7a45', 4)]),
    cherry: () => merge([...trunk([[0, 0, 0, .3, 2.6, 0, .4, .3], [.3, 2.4, 0, 1.8, 3.8, .4, .2, .12], [.3, 2.5, 0, -1.4, 3.9, -.3, .2, .12], [.3, 2.5, 0, .2, 4.4, -1.3, .18, .1]], '#4a3530'),
      canopy([[.2, 4.4, 0, 1.8, 1.25, .75], [1.9, 4.1, .5, 1.4, 1.2, .7], [-1.5, 4.2, -.3, 1.45, 1.2, .7], [.2, 4.1, -1.5, 1.35, 1.2, .7], [.3, 4.0, 1.5, 1.3, 1.2, .7], [.4, 5.3, .2, 1.2, 1.1, .7]], '#e292ab', '#ffe3ec', 5)]),
    maple: () => merge([...trunk([[0, 0, 0, 0, 2.8, 0, .32, .22], [0, 2.2, 0, 1.2, 3.6, 0, .14, .08], [0, 2.3, 0, -1.1, 3.7, .3, .14, .08]], BARK2),
      canopy([[0, 4.3, 0, 1.7, 1.2, .8], [1.4, 3.9, .4, 1.3, 1.2, .75], [-1.3, 4, -.4, 1.3, 1.2, .75], [.2, 3.8, 1.3, 1.2, 1.2, .75], [0, 5.1, -.2, 1.1, 1.1, .75]], '#a8321f', '#f59a3a', 6)]),
    jpine: () => merge([...trunk([[0, 0, 0, .5, 2.4, 0, .34, .26], [.5, 2.4, 0, -.2, 4.4, .2, .26, .16], [.5, 2.2, 0, 1.8, 3.2, .3, .12, .08], [-.1, 3.8, .1, -1.6, 4.4, -.4, .1, .07]], '#5b4436'),
      canopy([[1.9, 3.4, .3, 1.2, 1.4, .38], [-1.7, 4.6, -.4, 1.1, 1.4, .38], [-.2, 5.2, .2, 1.3, 1.3, .4], [.6, 4.2, 1.2, .9, 1.4, .38]], '#23432c', '#5f8f55', 7)]),
    stonepine: () => merge([...trunk([[0, 0, 0, .4, 6.4, 0, .32, .24], [.4, 5.8, 0, 1.8, 7, .3, .14, .1], [.4, 5.9, 0, -1.2, 7.1, -.5, .14, .1]], '#6b4f3a'),
      canopy([[.4, 7.5, 0, 2.2, 1.4, .45], [2.1, 7.2, .4, 1.6, 1.3, .42], [-1.5, 7.3, -.5, 1.6, 1.3, .42], [.5, 7.2, 1.7, 1.5, 1.3, .42], [.4, 7.3, -1.7, 1.5, 1.3, .42]], '#2f522c', '#77a256', 8)]),
    olive: () => merge([...trunk([[0, 0, 0, .3, 1.4, .1, .4, .3], [.3, 1.4, .1, -.2, 2.4, 0, .3, .2], [.3, 1.4, .1, 1.1, 2.3, .2, .16, .1]], '#6d5a48'),
      canopy([[0, 3, 0, 1.4, 1.3, .7], [1.2, 2.7, .3, 1.1, 1.2, .7], [-1, 2.8, -.3, 1.1, 1.2, .7], [.2, 2.6, 1, 1, 1.2, .7], [.1, 3.5, -.3, .9]], '#6a7a52', '#c0c99a', 9)]),
    cork: () => merge([...trunk([[0, 0, 0, 0, 2.2, 0, .5, .4]], '#a3542e'), ...trunk([[0, 2.2, 0, 1.4, 3.6, .3, .26, .15], [0, 2.2, 0, -1.3, 3.7, -.4, .26, .15]], '#4a3a30'),
      canopy([[0, 4.4, 0, 1.9, 1.4, .6], [1.9, 4.0, .4, 1.5, 1.3, .6], [-1.8, 4.1, -.4, 1.5, 1.3, .6], [.3, 3.9, 1.6, 1.4, 1.3, .6], [-.2, 4.0, -1.7, 1.4, 1.3, .6]], '#3a5229', '#869a55', 10)]),
    birch: () => merge([...trunk([[0, 0, 0, .1, 3, 0, .14, .1]], '#e8e2d6'), canopy([[.1, 3.2, 0, .9, 1, 1.3], [.4, 2.6, .3, .7], [-.3, 2.8, -.2, .7]], '#5f8a3a', '#bcd66e', 11)]),
    conifer: () => merge([...trunk([[0, 0, 0, 0, 9.8, 0, .32, .06]], '#4e3a2c'), ...tiers(11, 1.2, 9.6, 2.5, .35, '#1a3526', '#4f7f4c', 12)]),
    sugi: () => merge([...trunk([[0, 0, 0, 0, 14.2, 0, .36, .06]], '#6b4a35'), ...tiers(12, 3.5, 14, 1.8, .3, '#18301f', '#3f6a40', 13)]),
    bush: () => merge([canopy([[0, .6, 0, 1.1, 1.2, .7], [.8, .5, .3, .8, 1, .7], [-.7, .5, -.2, .8, 1, .7]], '#3f6a2d', '#86b452', 14)]),
  };

  const LEAF_VS = `attribute float aLeaf; attribute vec2 leafUv; varying float vLeaf; varying vec2 vLUv;`;
  const LEAF_SWAY = `
        vLeaf = aLeaf; vLUv = leafUv;
        #ifdef USE_INSTANCING
        float ph = instanceMatrix[3].x*0.13 + instanceMatrix[3].z*0.07;
        float sw = max(position.y-1.5,0.0);
        transformed.x += sin(uTime*1.3+ph)*0.025*sw; transformed.z += cos(uTime*1.1+ph*1.3)*0.018*sw;
        transformed += aLeaf * normal * sin(uTime*3.1 + position.x*2.0 + position.y*1.7 + ph) * 0.04;
        #endif`;
  function treeMaterial() {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9, side: THREE.DoubleSide });
    m.onBeforeCompile = sh => {
      sh.uniforms.uTime = U.uTime; sh.uniforms.uLeaf = { value: getLeafTex() };
      sh.vertexShader = 'uniform float uTime;\n' + LEAF_VS + '\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>' + LEAF_SWAY);
      sh.fragmentShader = 'uniform sampler2D uLeaf; varying float vLeaf; varying vec2 vLUv;\n' + sh.fragmentShader
        .replace('#include <color_fragment>', `#include <color_fragment>
          if (vLeaf > .5) { vec4 lt = texture2D(uLeaf, vLUv); if (lt.a < .45) discard; diffuseColor.rgb *= lt.rgb * 1.15; }`)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
          reflectedLight.indirectDiffuse *= 1.25;
          // 잎을 투과하는 빛
          #if NUM_DIR_LIGHTS > 0
          if (vLeaf > .5) reflectedLight.directDiffuse += diffuseColor.rgb * max(0.0, -dot(normal, directionalLights[0].direction)) * directionalLights[0].color * .25;
          #endif`);
    };
    m.customProgramCacheKey = () => 'tree2';
    return m;
  }
  function leafDepthMaterial() {
    const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    m.onBeforeCompile = sh => {
      sh.uniforms.uTime = U.uTime; sh.uniforms.uLeaf = { value: getLeafTex() };
      sh.vertexShader = 'uniform float uTime;\n' + LEAF_VS + '\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>' + LEAF_SWAY);
      sh.fragmentShader = 'uniform sampler2D uLeaf; varying float vLeaf; varying vec2 vLUv;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n if (vLeaf > .5 && texture2D(uLeaf, vLUv).a < .45) discard;');
    };
    return m;
  }
  ISL.treeMaterial = treeMaterial;

  ISL.noTree = []; ISL.noTreeSeg = [];
  function blocked(x, z) {
    for (const b of ISL.noTree) if ((x - b.x) ** 2 + (z - b.z) ** 2 < b.r * b.r) return true;
    for (const s of ISL.noTreeSeg) if (ISL.segDist(x, z, s.ax, s.az, s.bx, s.bz).d < s.w) return true;
    return false;
  }
  ISL.blocked = blocked;

  ISL.chunks = [];
  const geoCache = {};
  function placeInstances(scene, type, list, opts = {}) {
    if (!list.length) return [];
    const geo = typeof type === 'string' ? (geoCache[type] || (geoCache[type] = TREE_GEO[type]())) : type;
    const material = opts.material || (placeInstances.tm || (placeInstances.tm = treeMaterial()));
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
        const v = t.tint !== undefined ? t.tint : .9 + rng() * .2; c.setRGB(v, v, v); mesh.setColorAt(i, t.color || c);
      });
      mesh.computeBoundingSphere();
      mesh.castShadow = opts.shadow !== false; mesh.receiveShadow = true;
      if (geo.userData.leaf) mesh.customDepthMaterial = placeInstances.dm || (placeInstances.dm = leafDepthMaterial());
      mesh.userData.lod = opts.lod || 1200;
      scene.add(mesh); out.push(mesh); ISL.chunks.push(mesh);
      const cr = opts.collide !== undefined ? opts.collide : (typeof type === 'string' && type !== 'bush' ? (type === 'cypress' || type === 'birch' ? .3 : .45) : 0);
      if (cr && ISL.world) for (const t of part) { const c = ISL.colCircle(t.x, t.z, cr * t.s, t.y - 1, t.y + 2.2 * t.s); c.canopy = [2.4 * t.s, t.y + 2.2 * t.s, t.y + 8 * t.s]; }
    }
    return out;
  }
  ISL.placeInstances = placeInstances;

  // 나무는 적게, 숲은 덩어리로, 지역마다 다른 숲 (경계에서는 가중치대로 섞임)
  function makeTrees(scene) {
    const lists = {}; Object.keys(TREE_GEO).forEach(k => lists[k] = []);
    const LU = ISL.groundLU, N = ISL.N;
    const lu = (x, z) => { const i = Math.round((x + ISL.E) / ISL.STEP), j = Math.round((z + ISL.E) / ISL.STEP); return LU[j * N + i]; };
    const ok = (x, z, slopeMax = .32) => {
      const h = ISL.H(x, z); if (h < 2.5) return false; if (lu(x, z)) return false; if (ISL.slopeAt(x, z) > slopeMax) return false;
      if (ISL.waterAt(x, z).level > h - 1) return false;
      for (const r of ISL.rivers) { const q = ISL.riverNearest(r, x, z); if (q && q.d < q.w + 2.5) return false; }
      return !blocked(x, z) && !ISL.Land.reserved(x, z) && !ISL.world.solidAt(x, h + 1, z) && !ISL.world.solidAt(x, h + 6, z);
    };
    const add = (t, x, z, s) => lists[t].push({ x, y: ISL.H(x, z) - .15, z, s: (s || (.8 + rng() * .45)) * (t === 'olive' || t === 'bush' ? 1.15 : t === 'sugi' || t === 'conifer' ? 1.9 : 1.6), rz: (rng() - .5) * .05 });
    let total = 0;
    for (let k = 0; k < 60000 && total < 2300; k++) {
      const x = (rng() * 2 - 1) * 720, z = (rng() * 2 - 1) * 720;
      const W = ISL.weights(x, z), ri = ISL.pickRegion(W, rng());
      const forest = ISL.fbm(x * .007 + ri * 5, z * .007, 3), h = ISL.H(x, z);
      let t = null;
      if (ri === 0) { if (Math.hypot(x - ISL.P.hallgrim.x, z - ISL.P.hallgrim.z) < 140 && rng() < .15) t = 'birch'; }
      else if (ri === 1) { if (forest > .08 && h > 14 && h < 135) t = h > 55 || rng() < .75 ? 'conifer' : 'broad'; else if (rng() < .02) t = 'broad'; }
      else if (ri === 2) { if (forest > .28) t = rng() < .8 ? 'broad' : 'poplar'; else if (rng() < .015) t = 'broad'; }
      else if (ri === 3) { if (forest > .32) t = rng() < .55 ? 'stonepine' : 'cork'; else if (rng() < .06) t = rng() < .5 ? 'cork' : 'olive'; }
      else { if (h > 12 && forest > .05) { const r = rng(); t = r < .4 ? 'sugi' : r < .62 ? 'maple' : r < .82 ? 'broad' : 'cherry'; } else if (rng() < .02) t = 'cherry'; }
      if (!t || !ok(x, z)) continue;
      add(t, x, z); total++;
    }
    for (const e of ISL.Land.extraTrees) { if (!ok(e.x, e.z, .35)) continue; add(e.type, e.x, e.z, e.type === 'olive' ? .9 + rng() * .3 : 1 + rng() * .2); }
    const kr = ISL.rivers[2]; // 교토 강가의 벚꽃길
    for (let i = 0; i < kr.pts.length; i += 3) {
      const a = kr.pts[Math.max(0, i - 1)], b = kr.pts[Math.min(kr.pts.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      for (const sd of [-1, 1]) { const x = kr.pts[i][0] - (b[1] - a[1]) / l * sd * (kr.wd[i] + 5), z = kr.pts[i][1] + (b[0] - a[0]) / l * sd * (kr.wd[i] + 5); if (ok(x, z, .3)) add('cherry', x, z, .9 + rng() * .25); }
    }
    for (const k in lists) placeInstances(scene, k, lists[k]);
    ISL.treeCount = Object.values(lists).reduce((a, b) => a + b.length, 0);
    // 물가: 갈대 무리와 젖은 자갈
    const reedParts = []; for (let i = 0; i < 9; i++) { const a = i * 2.4, rr = .08 + (i % 3) * .1, h = 1.2 + (i % 4) * .25, g = new THREE.CylinderGeometry(.006, .02, h, 3); g.translate(0, h / 2, 0); g.rotateZ((i % 3 - 1) * .09); g.translate(Math.cos(a) * rr, 0, Math.sin(a) * rr); reedParts.push([g, '#6f8a45']); if (i % 2) { const t = new THREE.CylinderGeometry(.03, .03, .22, 5); t.translate(Math.cos(a) * rr, h, Math.sin(a) * rr); reedParts.push([t, '#6b4a2e']); } }
    const reedGeo = merge(reedParts), reeds = [], pebbles = [];
    const shore = (x, z) => { const h = ISL.H(x, z); if (h < .3 || blocked(x, z) || ISL.Land.reserved(x, z) || ISL.world.solidAt(x, h + 1, z)) return; const w = ISL.waterAt(x, z); if (w.level > h + .25) return; return h; };
    for (const rv of ISL.rivers) for (let i = 0; i < rv.pts.length; i += 2) {
      if (rv.lv[i] < .2) continue;
      const a = rv.pts[Math.max(0, i - 1)], b = rv.pts[Math.min(rv.pts.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      for (const sd of [-1, 1]) {
        const off = rv.wd[i] * (1.05 + rng() * .5), x = rv.pts[i][0] - (b[1] - a[1]) / l * sd * off, z = rv.pts[i][1] + (b[0] - a[0]) / l * sd * off, h = shore(x, z);
        if (h === undefined) continue;
        if (rng() < .45) reeds.push({ x, y: h - .1, z, s: .7 + rng() * .6 });
        if (rng() < .7) pebbles.push({ x: x + (rng() - .5) * 2, y: h - .08, z: z + (rng() - .5) * 2, s: .12 + rng() * .25, sy: .55, color: new THREE.Color('#7d776b').multiplyScalar(.8 + rng() * .4) });
      }
    }
    for (const L of ISL.lakes) for (let k = 0; k < L.r * 2.5; k++) { const a = rng() * 6.283, d = L.r * (1.02 + rng() * .18), x = L.x + Math.cos(a) * d, z = L.z + Math.sin(a) * d, h = shore(x, z); if (h !== undefined && L.color !== 'lagoon' && L.color !== 'glacier') reeds.push({ x, y: h - .1, z, s: .7 + rng() * .6 }); }
    placeInstances(scene, reedGeo, reeds, { collide: 0, shadow: false, lod: 260, tile: 120, material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 }) });
    placeInstances(scene, merge([[new THREE.DodecahedronGeometry(1, 0), '#ffffff']]), pebbles, { collide: 0, shadow: false, lod: 200, tile: 120, material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .4, flatShading: true }) });
    const rock = merge([[new THREE.DodecahedronGeometry(1.3, 0).scale(1.3, .8, 1), '#ffffff']]), rocks = [];
    for (let k = 0; k < 9000 && rocks.length < 500; k++) {
      const x = (rng() * 2 - 1) * 720, z = (rng() * 2 - 1) * 720, h = ISL.H(x, z), sl = ISL.slopeAt(x, z);
      if (h < 25 || sl < .18 || sl > .5 || blocked(x, z)) continue;
      const W = ISL.weights(x, z); if (h > 52 * W[0] + 120 * W[1] + 400 * (W[2] + W[3] + W[4])) continue;
      rocks.push({ x, y: h - .4, z, s: .7 + rng() * 1.6, color: new THREE.Color(W[0] > .5 ? '#3c3b3e' : '#8a857d').multiplyScalar(.85 + rng() * .3) });
    }
    placeInstances(scene, rock, rocks, { collide: 1.3, material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, flatShading: true }) });
  }

  // ---------- 풀밭: 플레이어 주변에서 바람에 흔들리는 풀과 들꽃 ----------
  function makeGrass(scene, count) {
    // 한 포기 = 잎 5장 (각자 방향·높이·휘어짐이 다름)
    const BV = [-.5, 0, .5, 0, -.36, .48, .36, .48, -.18, .82, .18, .82, 0, 1], BI = [0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6];
    const NB = 7, bpos = [], bb = [], bidx = [], br = ISL.mulberry32(31);
    for (let b = 0; b < NB; b++) {
      const a = br() * 6.28, r = Math.sqrt(br()) * .5, hf = .55 + br() * .6, rot = br() * 6.28;
      for (let v = 0; v < 7; v++) { bpos.push(BV[v * 2], BV[v * 2 + 1], 0); bb.push(Math.cos(a) * r, Math.sin(a) * r, rot, hf); }
      for (const i of BI) bidx.push(i + b * 7);
    }
    const geo = new THREE.InstancedBufferGeometry(); geo.setIndex(bidx);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(bpos, 3)); geo.setAttribute('aB', new THREE.Float32BufferAttribute(bb, 4));
    const SZ = 80, off = new Float32Array(count * 2), rnd = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) { off[i * 2] = (rng() - .5) * SZ * 4; off[i * 2 + 1] = (rng() - .5) * SZ * 4; rnd[i * 2] = rng(); rnd[i * 2 + 1] = rng(); }
    geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 2)); geo.setAttribute('aRnd', new THREE.InstancedBufferAttribute(rnd, 2));
    geo.instanceCount = count;
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uCenter: { value: new THREE.Vector2() }, uS: { value: SZ }, tA: { value: null }, tB: { value: null }, tH: { value: null },
      uHB: { value: new THREE.Vector3(ISL.E, ISL.STEP, ISL.N) }, uL: { value: new THREE.Vector3(0, 1, 0) }, uLC: { value: new THREE.Color(1, 1, 1) },
      uSkyC: { value: new THREE.Color(.5, .6, .8) }, uGndC: { value: new THREE.Color(.3, .3, .2) },
    }]);
    uniforms.tA.value = ISL.grassTex.A; uniforms.tB.value = ISL.grassTex.B; uniforms.tH.value = ISL.heightTex;
    uniforms.uTime = U.uTime;
    const mat = new THREE.ShaderMaterial({
      uniforms, fog: true, side: THREE.DoubleSide,
      vertexShader: `
        attribute vec2 aOff; attribute vec2 aRnd; attribute vec4 aB;
        uniform vec2 uCenter; uniform float uS; uniform float uTime; uniform sampler2D tA; uniform sampler2D tB; uniform sampler2D tH; uniform vec3 uHB;
        varying vec3 vCol; varying float vY; varying float vBack;
        #include <fog_pars_vertex>
        float vn2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); float a=fract(sin(dot(i,vec2(127.1,311.7)))*43758.5), b=fract(sin(dot(i+vec2(1,0),vec2(127.1,311.7)))*43758.5), c=fract(sin(dot(i+vec2(0,1),vec2(127.1,311.7)))*43758.5), d=fract(sin(dot(i+vec2(1,1),vec2(127.1,311.7)))*43758.5); return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
        float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        vec3 flower(float pal, float r){
          if(pal<1.5) return r<.33? vec3(1.,1.,.94) : r<.66? vec3(1.,.82,.18) : vec3(.62,.45,.95);
          if(pal<2.5) return r<.5? vec3(.5,.35,.92) : vec3(.72,.5,.95);
          if(pal<3.5) return vec3(.92,.12,.08);
          if(pal<4.5) return vec3(1.,.88,.12);
          if(pal<5.5) return vec3(1.,1.,.96);
          if(pal<6.5) return r<.5? vec3(1.,.82,.22) : vec3(1.,1.,.94);
          return r<.5? vec3(1.,.78,.86) : vec3(1.,1.,1.);
        }
        void main(){
          vec2 base = uCenter - uS*.5 + mod(aOff - uCenter + uS*.5, uS);
          vec2 tuv = ((base + uHB.x)/uHB.y + .5)/uHB.z;
          vec4 A = texture2D(tA, tuv); vec4 B = texture2D(tB, tuv);
          float gh = A.a;
          float dist = length(base - uCenter);
          float fade = 1. - smoothstep(uS*.3, uS*.48, dist);
          float bladeR = hh(base*1.7 + aB.xy*13.1);
          float isF = step(bladeR, B.r) * step(aB.w, .9);
          // 자연스럽게 무리 지어 자라는 풀 (큰 얼룩 + 작은 얼룩)
          float ptch = vn2(base*.07)*.65 + vn2(base*.31)*.35;
          float hgt = (.1 + .72*gh) * (.55 + .75*aRnd.x) * aB.w * fade * step(.03, gh) * (.55 + .9*ptch) * (1. + isF*.35);
          float ang = aRnd.y*6.2831 + aB.z;
          vec3 p = position;
          float w = .042*(.75 + aRnd.x*.5)*(1. + isF*1.6);
          vec3 l = vec3(p.x*w*cos(ang) + aB.x*(.35 + gh*.5), p.y*hgt, p.x*w*sin(ang) + aB.y*(.35 + gh*.5));
          float curl = p.y*p.y*hgt*.35; l.x += curl*sin(ang); l.z -= curl*cos(ang);
          float lean = (hh(base + aB.zw) - .5) * .5 * p.y*p.y*hgt; l.x += lean*cos(aB.z); l.z += lean*sin(aB.z);
          float gust = sin(uTime*1.1 + base.x*.05 + base.y*.035)*.5+.5;
          float sway = (sin(uTime*2.3 + base.x*.7 + base.y*.5)*.22 + gust*.6) * p.y*p.y * hgt * .42;
          l.x += sway*.85; l.z += sway*.4; l.y -= sway*sway*.35*p.y;
          vec3 wp = vec3(base.x, texture2D(tH, tuv).r - .06, base.y) + l;
          vec3 g = pow(A.rgb, vec3(2.2));
          float shade = .82 + .36*hh(base*.9 + aB.xy);
          vec3 col = g * mix(.38, 1.05, p.y) * shade * (.85 + .3*ptch);
          col = mix(col, g*1.25 + vec3(.06,.05,-.01), smoothstep(.6,1.,p.y)*.4);
          col = mix(col, col*vec3(1.15,1.05,.7), smoothstep(.75,.95,hh(base*2.3))*p.y*.5); // 마른 잎끝
          float vF = isF*smoothstep(.7,.95,p.y);
          col = mix(col, flower(floor(B.g*255./32.+.5), hh(base*3.1)), vF);
          vCol = col; vY = p.y;
          vBack = p.y;
          vec4 mvPosition = viewMatrix*vec4(wp,1.);
          gl_Position = projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform vec3 uL; uniform vec3 uLC; uniform vec3 uSkyC; uniform vec3 uGndC;
        varying vec3 vCol; varying float vY; varying float vBack;
        #include <fog_pars_fragment>
        void main(){
          vec3 amb = mix(uGndC, uSkyC, .35 + .65*vY);
          float d = max(uL.y, 0.)*.7 + .3;
          vec3 c = vCol * (amb + uLC*d*(.75 + .35*vY)) / 3.14159;
          c += vCol * uLC * vBack*vBack * .06 * (1. - uL.y); // 해를 등지면 잎이 비쳐 보임
          c += uLC * pow(vY, 5.) * .03 * max(uL.y, 0.); // 잎끝 광택
          gl_FragColor = vec4(c, 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; scene.add(mesh);
    ISL.grass = { mesh, uniforms };
    return mesh;
  }

  // ---------- 구름 ----------
  function puffTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.45, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function makeClouds(scene) {
    ISL.puffTex = puffTexture();
    return; // 구름은 이제 하늘 셰이더 안에서 그림
    const group = new THREE.Group(); const mats = [];
    for (let i = 0; i < 40; i++) {
      const cx = (rng() * 2 - 1) * 1300, cz = (rng() * 2 - 1) * 1300, cy = 200 + rng() * 120;
      const m = new THREE.SpriteMaterial({ map: ISL.puffTex, transparent: true, depthWrite: false, opacity: .8, fog: false });
      mats.push(m);
      const n = 6 + Math.floor(rng() * 7);
      for (let k = 0; k < n; k++) { const s = new THREE.Sprite(m), sz = 50 + rng() * 70; s.scale.set(sz * 1.6, sz, 1); s.position.set(cx + (rng() - .5) * 140, cy + (rng() - .5) * 18, cz + (rng() - .5) * 70); group.add(s); }
    }
    scene.add(group); ISL.clouds = { group, mats };
  }

  // ---------- 입자 ----------
  class Emitter {
    constructor(scene, n, opts) {
      this.o = Object.assign({ size: 3, color: '#ffffff', opacity: .7, life: 3, additive: false }, opts);
      this.n = n; this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.age = new Float32Array(n).fill(1e9); this.life = new Float32Array(n); this.alpha = new Float32Array(n);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
      this.mat = new THREE.ShaderMaterial({
        uniforms: { uMap: { value: ISL.puffTex }, uColor: { value: new THREE.Color(this.o.color) }, uSize: { value: this.o.size } },
        vertexShader: `attribute float alpha; varying float vA; uniform float uSize; void main(){ vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=uSize*300.0/max(-mv.z,1.0); gl_Position=projectionMatrix*mv; }`,
        fragmentShader: `uniform sampler2D uMap; uniform vec3 uColor; varying float vA; void main(){ vec4 t=texture2D(uMap,gl_PointCoord); gl_FragColor=vec4(uColor, t.a*vA);
          #include <colorspace_fragment>
        }`,
        transparent: true, depthWrite: false, blending: this.o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; scene.add(this.points); this.i = 0;
    }
    emit(x, y, z, vx, vy, vz, life) { const i = this.i = (this.i + 1) % this.n; this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z; this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz; this.age[i] = 0; this.life[i] = life || this.o.life; }
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
  function makeAurora(scene) { return; // 오로라는 이제 하늘 셰이더 안에서 그림
  }
  function makeAuroraOld(scene) {
    const g = new THREE.PlaneGeometry(1, 1, 160, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) + .5, v = p.getY(i) + .5, a = -1.2 + u * 2.4, r = 1100;
      p.setXYZ(i, Math.sin(a) * r + Math.sin(u * 9) * 60, 260 + v * 230, -Math.cos(a) * r * .55 - 250 + Math.cos(u * 7) * 50);
    }
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uNight: U.uNight },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `varying vec2 vUv; uniform float uTime; uniform float uNight;
        void main(){
          float x=vUv.x;
          float wave=sin(x*26.0+uTime*0.35)*0.5+sin(x*11.0-uTime*0.22)*0.5;
          float rays=0.5+0.5*sin(x*260.0+sin(x*37.0+uTime*0.8)*4.0); rays=0.35+0.65*rays*rays;
          float yy=vUv.y+wave*0.07;
          float band=smoothstep(0.0,0.1,yy)*exp(-max(yy-0.08,0.0)*3.2);
          float pulse=0.55+0.45*sin(x*6.0+uTime*0.3+sin(x*17.0)*1.5);
          vec3 col=mix(vec3(0.15,1.0,0.55), vec3(0.75,0.3,1.0), smoothstep(0.25,0.85,yy));
          float a=band*rays*pulse*uNight*1.25*smoothstep(0.0,0.08,x)*smoothstep(1.0,0.92,x);
          gl_FragColor=vec4(col*a,a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    });
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false; scene.add(m); ISL.aurora = m;
  }

  // 건물·구조물 바닥 아래로 풀이 뚫고 나오지 않게 풀 지도를 지움
  function maskGrass() {
    const A = ISL.grassTex.A.image.data, B = ISL.grassTex.B.image.data, N = ISL.N, E = ISL.E, S = ISL.STEP;
    const clear = (i, j) => { if (i < 0 || j < 0 || i >= N || j >= N) return; const k = j * N + i; A[k * 4 + 3] = 0; B[k * 4] = 0; };
    for (const c of ISL.world.list) {
      if (c.t === 'b') { const r = c.br + .6; for (let j = Math.floor((c.z - r + E) / S); j <= Math.ceil((c.z + r + E) / S); j++) for (let i = Math.floor((c.x - r + E) / S); i <= Math.ceil((c.x + r + E) / S); i++) { const [lx, lz] = ISL.world.toLocal(c, -E + i * S, -E + j * S); if (Math.abs(lx) < c.hw + .6 && Math.abs(lz) < c.hd + .6) clear(i, j); } }
      else if (c.r > .9) { const r = c.r + .5; for (let j = Math.floor((c.z - r + E) / S); j <= Math.ceil((c.z + r + E) / S); j++) for (let i = Math.floor((c.x - r + E) / S); i <= Math.ceil((c.x + r + E) / S); i++) if (Math.hypot(-E + i * S - c.x, -E + j * S - c.z) < r) clear(i, j); }
    }
    ISL.grassTex.A.needsUpdate = true; ISL.grassTex.B.needsUpdate = true;
  }
  ISL.Nature = { maskGrass, makeSky, makeWater, makeTerrain, makeTrees, makeGrass, makeClouds, makeAurora, natural };
})();
