/* Hero background — WebGL fragment shader
   Extracted from index.html. Nothing here is minified or bundled — the site
   has no build step, so these files are served exactly as written. */

/* ===== purple silk background (WebGL) =======================================
   Domain-warped fbm folded through sin(), then split into TWO curves off the
   same band: a soft body for colour and a razor-thin crest for the white line.
   Hero-only; falls back to the CSS orbs if WebGL is unavailable.            */
function initBgfx(){
  const cv = document.getElementById('bgfx');
  if(!cv) return;
  const gl = cv.getContext('webgl', {antialias:false, alpha:false})
          || cv.getContext('experimental-webgl', {antialias:false, alpha:false});
  if(!gl) return;                                  /* CSS orbs remain visible */

  const VS = `attribute vec2 a; void main(){ gl_Position = vec4(a,0.0,1.0); }`;
  const FS = `
precision highp float;
uniform vec2  u_res;
uniform float u_time;
uniform float u_scroll;

float hash(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

/* Simplex noise, not the value noise this file used before. The oil look samples
   the field very zoomed in (SCALE 0.3), and value noise shows its square lattice
   at that magnification — simplex has no grid to show. */
vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec2 mod289(vec2 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                        + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x  = 2.0 * fract(p * C.www) - 1.0;
  vec3 h  = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

/* Dark-oil palette, in the site's violet rather than the source's neutral grey.
   Lighting stays additive like the original: a base, a broad mid raised by a wide
   smoothstep, and a narrow sheen at half strength. */
/* Uniforms, not constants: the palette comes from --fx-base / --fx-mid /
   --fx-high on :root so a theme can restyle the shader in CSS with everything
   else. The defaults below are the values these replaced, so a stylesheet that
   does not define them renders exactly as before. */
uniform vec3 COLOR_BASE;   /* near-black, violet bias */
uniform vec3 COLOR_MID;    /* deep violet body        */
uniform vec3 COLOR_HIGH;   /* lilac sheen, deliberately dim */

void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / u_res.y;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= aspect;
  p *= 0.30;                       /* SCALE — small number, so the flow is huge */

  float t  = u_time * 0.15;        /* SPEED */
  float sc = u_scroll * 0.0005;    /* the field drifts as the page moves */
  p.y += sc * 0.5;

  /* Three octaves, each fed the one before it. That feedback is what makes the
     field roll over itself like a fluid instead of merely drifting past. */
  float n1 = snoise(p * 0.8 + vec2(t * 0.10,  t * 0.05 - sc));
  float n2 = snoise(p * 1.5 + vec2(t * 0.15, -t * 0.05) + n1 * 1.5);
  float n3 = snoise(p * 2.0 - vec2(t * 0.05,  t * 0.10) + n2 * 1.0);
  float wave = n1*0.5 + n2*0.3 + n3*0.2;

  vec3 col = COLOR_BASE;
  /* These two ranges are the whole fix for the hard-edged arcs. The source
     shader used a narrow smoothstep(.40,.60) with a DIM grey highlight, so its
     crossings were a subtle sheen. Recolouring that highlight violet made it
     ~3x brighter, and a narrow band under a bright colour is a hard rim — the
     ovals and the line. Widened so the sheen ramps across most of the field,
     and dimmed so widening it does not just wash everything out. */
  col += COLOR_MID  * smoothstep(-0.60, 0.80, wave);
  col += COLOR_HIGH * smoothstep(-0.15, 1.05, wave) * 0.5;

  col += (hash(gl_FragCoord.xy) - 0.5) * 0.005;   /* see note below */
  /* Dither cut from .015 to .005. It cannot go to zero: the canvas renders
     at 0.6 scale and this palette is very dark, so a perfectly smooth ramp
     bands into visible steps. .005 is ~1.5 levels peak-to-peak — enough to
     break the banding, below what reads as grain. */
  gl_FragColor = vec4(col, 1.0);
}`;

  function sh(type, src){
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){
      console.error(gl.getShaderInfoLog(s)); return null;
    }
    return s;
  }
  const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
  if(!vs || !fs) return;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog, gl.LINK_STATUS)){
    console.error(gl.getProgramInfoLog(prog)); return;
  }
  gl.useProgram(prog);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(a);
  gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'u_res');
  const uTime= gl.getUniformLocation(prog, 'u_time');
  const uScr = gl.getUniformLocation(prog, 'u_scroll');
  const uCol = ['COLOR_BASE','COLOR_MID','COLOR_HIGH'].map(n => gl.getUniformLocation(prog, n));

  /* The palette lives in CSS so the theme owns it. Read once per theme change,
     never per frame — getComputedStyle forces a style resolve. */
  const FALLBACK = [[0.022,0.012,0.045],[0.108,0.058,0.282],[0.260,0.195,0.448]];
  function parseColor(v, fallback){
    v = (v || '').trim();
    /* accepts "#rrggbb" or "r, g, b" with channels 0-255 */
    let m = /^#([0-9a-f]{6})$/i.exec(v);
    if(m) return [0,2,4].map(i => parseInt(m[1].substr(i,2),16) / 255);
    const n = v.split(',').map(s => parseFloat(s));
    if(n.length === 3 && n.every(x => !isNaN(x))) return n.map(x => x / 255);
    return fallback;
  }
  function readPalette(){
    const cs = getComputedStyle(document.documentElement);
    ['--fx-base','--fx-mid','--fx-high'].forEach((name, i) => {
      const c = parseColor(cs.getPropertyValue(name), FALLBACK[i]);
      gl.uniform3f(uCol[i], c[0], c[1], c[2]);
    });
  }

  const SCALE = 0.6;               /* render below native — it's all soft gradients */
  const FRAME = 0.0;               /* which moment to freeze on: try 0, 3, 7, 12... */
  function resize(){
    /* sized to the hero element, not the viewport */
    const w = cv.clientWidth  || innerWidth;
    const h = cv.clientHeight || innerHeight;
    cv.width  = Math.max(1, Math.floor(w * SCALE));
    cv.height = Math.max(1, Math.floor(h * SCALE));
    gl.viewport(0, 0, cv.width, cv.height);
    gl.uniform2f(uRes, cv.width, cv.height);
    if(FROZEN && !isLight()) draw(FRAME);
  }
  function draw(seconds){
    gl.uniform1f(uTime, seconds);
    gl.uniform1f(uScr, window.scrollY);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  const FROZEN = matchMedia('(prefers-reduced-motion: reduce)').matches;
  readPalette();
  /* the theme class is the only thing that changes these */
  new MutationObserver(() => { readPalette(); if(FROZEN && !isLight()) draw(FRAME); })
    .observe(document.documentElement, {attributes:true, attributeFilter:['class']});
  resize();
  addEventListener('resize', resize);
  if(window.ResizeObserver) new ResizeObserver(resize).observe(cv);
  cv.classList.add('on');          /* fades in; stays at 0 if we never got here */

  /* Light theme hides the canvas (its palette is near-black and there is no
     light variant), so there is nothing to shade. Read per frame rather than
     subscribing: it costs nothing and keeps the theme toggle from needing to
     know this file exists. */
  const isLight = () => document.documentElement.classList.contains('light');

  /* stop shading once the hero has scrolled off — nobody can see it */
  let onScreen = true;
  const hero = document.querySelector('.hero');
  if(hero && window.IntersectionObserver){
    new IntersectionObserver(es=>{ onScreen = es[0].isIntersecting; },
                             {threshold:0}).observe(hero);
  }

  if(FROZEN){
    if(!isLight()) draw(FRAME);   /* the observer above redraws on theme change */
  }else{
    let running = true;
    document.addEventListener('visibilitychange', ()=>{ running = !document.hidden; });
    (function frame(ms){
      if(running && onScreen && !isLight()) draw(ms * 0.001);
      requestAnimationFrame(frame);
    })(0);
  }
}
/* the canvas lives inside the hero, further down the document than this script,
   so wait for the DOM before looking for it */
if(document.readyState==='loading')
  document.addEventListener('DOMContentLoaded', initBgfx);
else initBgfx();
