/* =========================================================
   Window of Tomorrow — flowing sky gradient (WebGL)
   深夜 → 明け方へ移ろい、常にゆらめくグラデーション背景
   ========================================================= */
(function () {
  const canvas = document.getElementById('sky');
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false });

  if (!gl) {
    // WebGL非対応時はCSSグラデにフォールバック
    document.body.classList.add('no-webgl');
    return;
  }

  /* ---- 空のカラーランプ(下=深夜 → 上=明け方 の順で並べる) ---- */
  // 各 vec3 は 0..1 のRGB。スクロールが進むほど後ろの色へ移ろう。
  const STOPS = [
    [0.031, 0.031, 0.110], // 0.00 真夜中の濃紺
    [0.110, 0.075, 0.250], // 0.14 藍〜紫
    [0.075, 0.145, 0.280], // 0.30 群青にわずかな光
    [0.130, 0.230, 0.235], // 0.44 深いティール+金の気配
    [0.180, 0.140, 0.360], // 0.56 紫紺
    [0.360, 0.250, 0.320], // 0.70 夜明け前の温かいモーヴ
    [0.720, 0.520, 0.360], // 0.82 地平のピーチ
    [0.720, 0.610, 0.720], // 0.92 淡い薔薇色〜藤
    [0.760, 0.800, 0.720], // 1.00 明け方の淡い緑がかった光
  ];
  const POS = [0.0, 0.14, 0.30, 0.44, 0.56, 0.70, 0.82, 0.92, 1.0];
  const N = STOPS.length;

  const vertSrc = `
    attribute vec2 aPos;
    void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
  `;

  const fragSrc = `
    precision highp float;
    uniform vec2  uRes;
    uniform float uTime;
    uniform float uScroll;      // 0..1 ページ全体のスクロール進捗
    uniform vec3  uColors[${N}];
    uniform float uPos[${N}];

    // --- simplex noise (Ashima Arts / webgl-noise) ---
    vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
    vec2 mod289(vec2 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
    vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }
    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                         -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0))
             + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m; m = m*m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }
    // やわらかい大きなうねり用(オクターブ少なめ=なめらか)
    float fbm(vec2 p){
      float f = 0.0, amp = 0.55;
      for(int i=0;i<3;i++){ f += amp*snoise(p); p *= 2.0; amp *= 0.5; }
      return f;
    }

    // カラーランプから位置 t(0..1) の色を取り出す
    vec3 ramp(float t){
      vec3 col = uColors[0];
      for(int i=0;i<${N - 1};i++){
        float a = smoothstep(uPos[i], uPos[i+1], t);
        col = mix(col, uColors[i+1], a);
      }
      return col;
    }

    void main(){
      vec2 uv = gl_FragCoord.xy / uRes;              // 0..1
      float aspect = uRes.x / uRes.y;
      vec2 p = vec2(uv.x * aspect, uv.y);

      float t = uTime;
      float wind = t * 0.16;   // 風は横方向(x)へゆっくり流れる

      // --- 風になびく布のような大きなうねり ---
      // 位相を低周波ノイズでゆらし、複数の進行波を重ねて大きなヒダを作る
      float ph = snoise(vec2(uv.y * 1.1, t * 0.05)) * 1.6;   // 高さで位相をずらす
      float w1 = sin(uv.x * 2.6 + wind * 1.10 + ph);
      float w2 = sin(uv.x * 1.5 - wind * 0.75 + uv.y * 2.0 + 1.3);
      float w3 = sin(uv.x * 4.4 + wind * 1.70 + uv.y * 1.1 + ph * 0.5);
      float wave = w1 * 0.55 + w2 * 0.30 + w3 * 0.15;        // -1..1 布のうねり

      // 下ほど大きくたなびく(吊るした布のように)
      float amp = 0.055 + 0.035 * (1.0 - uv.y);
      float fold = wave * amp;
      // 大きくゆっくりした空気の呼吸を薄く重ねる
      fold += (fbm(vec2(p.x * 0.6 + wind * 0.35, p.y * 0.8 + t * 0.02)) - 0.5) * 0.06;

      // 1画面に見えるランプ幅。上ほど「早い時刻(暗い)」、下ほど「遅い時刻(明るい)」
      float span = 0.17;
      float base = uScroll * (1.0 - span);
      float samp = clamp(base + (1.0 - uv.y) * span + fold, 0.0, 1.0);

      vec3 col = ramp(samp);

      // 布のヒダが光を受けるようなやわらかい陰影(サテンの光沢)
      float sheen = smoothstep(0.15, 1.0, wave);
      col += (sheen - 0.35) * 0.05;

      // 中央に向かうやわらかな明暗
      float vig = smoothstep(1.3, 0.2, distance(uv, vec2(0.5)));
      col *= 0.85 + 0.15 * vig;

      // バンディング除去の微細ディザ
      float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))) * 43758.5453) - 0.5) / 255.0;
      col += dither;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
    }
    return s;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vertSrc));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'uRes');
  const uTime = gl.getUniformLocation(prog, 'uTime');
  const uScroll = gl.getUniformLocation(prog, 'uScroll');
  const uColors = gl.getUniformLocation(prog, 'uColors');
  const uPos = gl.getUniformLocation(prog, 'uPos');

  gl.uniform3fv(uColors, new Float32Array(STOPS.flat()));
  gl.uniform1fv(uPos, new Float32Array(POS));

  let dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
  }
  window.addEventListener('resize', resize);
  resize();

  // スクロール進捗(なめらかに追従)
  let scrollTarget = 0, scrollNow = 0;
  function updateScroll() {
    const max = document.documentElement.scrollHeight - innerHeight;
    scrollTarget = max > 0 ? window.scrollY / max : 0;
  }
  window.addEventListener('scroll', updateScroll, { passive: true });
  updateScroll();

  const start = performance.now();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function frame(now) {
    scrollNow += (scrollTarget - scrollNow) * 0.06;
    const t = reduce ? 0 : (now - start) / 1000;
    gl.uniform1f(uTime, t);
    gl.uniform1f(uScroll, scrollNow);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
