// 후처리: 부드러운 빛 번짐(블룸), 따뜻한 색 보정, 비네트
(function () {
  const ISL = window.ISL;
  const VS = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }';
  class Post {
    constructor(renderer) {
      this.r = renderer; this.exposure = .9; this.bloom = .55;
      const opt = { type: THREE.HalfFloatType, depthBuffer: false };
      this.main = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
      this.a = new THREE.WebGLRenderTarget(1, 1, opt); this.b = new THREE.WebGLRenderTarget(1, 1, opt);
      this.c = new THREE.WebGLRenderTarget(1, 1, opt); this.d = new THREE.WebGLRenderTarget(1, 1, opt);
      this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.scene = new THREE.Scene(); this.scene.add(this.quad);
      this.bright = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, px: { value: new THREE.Vector2() } }, vertexShader: VS, depthTest: false,
        fragmentShader: `uniform sampler2D t; uniform vec2 px; varying vec2 vUv;
          void main(){ vec3 c = (texture2D(t,vUv+px*vec2(-1.,-1.)).rgb+texture2D(t,vUv+px*vec2(1.,-1.)).rgb+texture2D(t,vUv+px*vec2(-1.,1.)).rgb+texture2D(t,vUv+px*vec2(1.,1.)).rgb)*.25;
            float l = dot(c, vec3(.2126,.7152,.0722)); gl_FragColor = vec4(c*smoothstep(.75,1.6,l), 1.); }` });
      this.blur = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, dir: { value: new THREE.Vector2() } }, vertexShader: VS, depthTest: false,
        fragmentShader: `uniform sampler2D t; uniform vec2 dir; varying vec2 vUv;
          void main(){ vec3 c = texture2D(t,vUv).rgb*.227;
            c += (texture2D(t,vUv+dir*1.385).rgb + texture2D(t,vUv-dir*1.385).rgb)*.316;
            c += (texture2D(t,vUv+dir*3.231).rgb + texture2D(t,vUv-dir*3.231).rgb)*.07;
            gl_FragColor = vec4(c,1.); }` });
      this.final = new THREE.ShaderMaterial({ uniforms: { tS: { value: null }, tB1: { value: null }, tB2: { value: null }, uExp: { value: 1 }, uBloom: { value: .5 }, uNight: { value: 0 }, uTime: { value: 0 } },
        vertexShader: VS, depthTest: false,
        fragmentShader: `uniform sampler2D tS; uniform sampler2D tB1; uniform sampler2D tB2; uniform float uExp; uniform float uBloom; uniform float uNight; uniform float uTime; varying vec2 vUv;
          vec3 aces(vec3 x){ x*=.6; return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }
          vec3 toSRGB(vec3 c){ return mix(c*12.92, 1.055*pow(c,vec3(1./2.4))-.055, step(vec3(.0031308),c)); }
          float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
          void main(){
            vec3 c = texture2D(tS,vUv).rgb;
            vec3 b = texture2D(tB1,vUv).rgb*.6 + texture2D(tB2,vUv).rgb*.9;
            c += b*uBloom;
            c = aces(c*uExp);
            float l = dot(c, vec3(.2126,.7152,.0722));
            c = mix(vec3(l), c, 1.1 - uNight*.15);
            c = c*vec3(1.025,1.0,.965) + vec3(.012,.01,.018)*(1.-l);
            vec2 q = vUv-.5; c *= 1. - dot(q,q)*.6;
            c = toSRGB(clamp(c,0.,1.));
            c += (h(gl_FragCoord.xy + uTime) - .5)/255.;
            gl_FragColor = vec4(c,1.);
          }` });
    }
    setSize(w, h) {
      const pr = this.r.getPixelRatio(); w = Math.floor(w * pr); h = Math.floor(h * pr);
      this.main.setSize(w, h);
      this.a.setSize(w >> 2, h >> 2); this.b.setSize(w >> 2, h >> 2); this.c.setSize(w >> 3, h >> 3); this.d.setSize(w >> 3, h >> 3);
      this.w = w; this.h = h;
    }
    pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.scene, this.cam); }
    render(scene, camera, night, time) {
      const r = this.r;
      r.setRenderTarget(this.main); r.render(scene, camera);
      this.bright.uniforms.t.value = this.main.texture; this.bright.uniforms.px.value.set(1.5 / this.w, 1.5 / this.h); this.pass(this.bright, this.a);
      const bl = this.blur.uniforms;
      bl.t.value = this.a.texture; bl.dir.value.set(4 / this.w, 0); this.pass(this.blur, this.b);
      bl.t.value = this.b.texture; bl.dir.value.set(0, 4 / this.h); this.pass(this.blur, this.a);
      bl.t.value = this.a.texture; bl.dir.value.set(8 / this.w, 0); this.pass(this.blur, this.c);
      bl.t.value = this.c.texture; bl.dir.value.set(0, 8 / this.h); this.pass(this.blur, this.d);
      const f = this.final.uniforms; f.tS.value = this.main.texture; f.tB1.value = this.a.texture; f.tB2.value = this.d.texture;
      f.uExp.value = this.exposure; f.uBloom.value = this.bloom; f.uNight.value = night; f.uTime.value = time % 100;
      this.pass(this.final, null);
    }
  }
  ISL.Post = Post;
})();
