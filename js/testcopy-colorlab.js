/* Colour lab — TEST COPY ONLY.
   A live palette editor for tuning the theme in the browser instead of
   round-tripping hex codes through chat. It writes CSS custom properties as
   inline styles on <html>, which outrank both the :root and html.light rules,
   so nothing here touches the stylesheet and nothing reaches index.html.

   It edits ONE THEME AT A TIME: whichever is active. Flip the site's own
   theme toggle and the panel follows, restoring that theme's own edits. Both
   sets are kept separately in localStorage, so you can tune dark, switch,
   tune light, and come back to find each as you left it.

   "Copy CSS" prints the finished values for both themes, ready to paste into
   css/styles.css. That is the only way these edits reach the real site —
   this file is deliberately a dead end. */
(function(){
  if(!/TESTCOPY/i.test(location.pathname)) return;   /* belt and braces */

  const ROOT = document.documentElement;
  const STORE = 'rv-colorlab';

  /* ---------- which tokens the lab owns -------------------------------- */
  /* group decides what the global sliders are allowed to touch: lightness on
     a background would flip the theme inside out, so it is kept to accents. */
  const TOKENS = [
    ['--bg','base','Page'],              ['--bg-2','base','Page alt'],
    ['--surface','base','Surface'],      ['--surface-2','base','Surface alt'],
    ['--text','text','Text'],            ['--muted','text','Muted'],
    ['--muted-2','text','Muted 2'],
    ['--violet','accent','Violet'],      ['--violet-bright','accent','Violet bright'],
    ['--glow','accent','Glow'],          ['--deep','accent','Deep'],
    ['--line','line','Line'],            ['--line-strong','line','Line strong'],
    ['--grad','accent','Gradient'],      ['--grad-btn','accent','Gradient (button)'],
    ['--mk-bg','accent','Marker'],       ['--mk-ink','text','Marker ink'],
    ['--mk-edge','accent','Marker edge'],
    ['--fx-base','base','Shader base'],  ['--fx-mid','accent','Shader mid'],
    ['--fx-high','accent','Shader high'],
    ['--aura-scrim','base','Aura scrim'],['--lb-veil','base','Viewer veil'],
  ];
  /* the ones that get a colour well — solid hex only; gradients and rgba are
     still recoloured by the wheel, they just have no single swatch */
  const SWATCHES = ['--bg','--bg-2','--surface','--surface-2','--text','--muted',
                    '--violet','--violet-bright','--glow','--deep',
                    '--mk-bg','--mk-edge','--fx-base','--fx-mid','--fx-high'];

  /* ---------- colour maths --------------------------------------------- */
  const clamp=(v,a,b)=>v<a?a:v>b?b:v;
  function hexToRgb(h){
    h=h.trim().replace('#','');
    if(h.length===3) h=h.split('').map(c=>c+c).join('');
    return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];
  }
  const toHex=n=>clamp(Math.round(n),0,255).toString(16).padStart(2,'0');
  const rgbToHex=([r,g,b])=>'#'+toHex(r)+toHex(g)+toHex(b);
  function rgbToHsl([r,g,b]){
    r/=255;g/=255;b/=255;
    const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;
    let h=0;
    if(d){ h = mx===r ? ((g-b)/d+(g<b?6:0)) : mx===g ? ((b-r)/d+2) : ((r-g)/d+4); h*=60; }
    const l=(mx+mn)/2;
    const s=d===0?0:d/(1-Math.abs(2*l-1));
    return [h,s,l];
  }
  function hslToRgb([h,s,l]){
    h=((h%360)+360)%360; s=clamp(s,0,1); l=clamp(l,0,1);
    const c=(1-Math.abs(2*l-1))*s, x=c*(1-Math.abs((h/60)%2-1)), m=l-c/2;
    const t=[[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]][Math.floor(h/60)%6];
    return t.map(v=>(v+m)*255);
  }
  /* one place that knows how to push a single rgb triplet through the globals */
  function shift(rgb, cfg, group){
    let [h,s,l]=rgbToHsl(rgb);
    h+=cfg.hue;
    s=clamp(s*cfg.sat,0,1);
    if(group==='accent') l=clamp(l+cfg.light/100,0,1);
    return hslToRgb([h,s,l]);
  }
  /* a token's value can be a hex, an rgba(), a gradient full of hexes, or a
     var() that just follows something else — handle each in place */
  function transform(value, cfg, group){
    if(!value) return value;
    const v=value.trim();
    if(v.startsWith('var(')) return v;                       /* follows another token */
    if(/^#[0-9a-f]{3,8}$/i.test(v)) return rgbToHex(shift(hexToRgb(v),cfg,group));
    return v
      .replace(/#[0-9a-f]{6}\b/gi, m=>rgbToHex(shift(hexToRgb(m),cfg,group)))
      .replace(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)\s*(?:[,/]\s*([\d.]+))?\s*\)/gi,
        (_m,r,g,b,a)=>{
          const o=shift([+r,+g,+b],cfg,group).map(n=>clamp(Math.round(n),0,255));
          return a===undefined ? `rgb(${o[0]}, ${o[1]}, ${o[2]})`
                               : `rgba(${o[0]}, ${o[1]}, ${o[2]}, ${a})`;
        });
  }

  /* ---------- baselines, read straight out of the stylesheet ------------ */
  /* Reading the RULES rather than getComputedStyle is what lets the lab know
     the inactive theme's values too — computed style only ever shows you the
     theme you are standing in. */
  function baselines(){
    const out={dark:{},light:{}};
    for(const sheet of document.styleSheets){
      let rules; try{ rules=sheet.cssRules }catch(e){ continue }
      for(const r of rules){
        if(!r.style||!r.selectorText) continue;
        const which = r.selectorText===':root' ? 'dark'
                    : r.selectorText==='html.light' ? 'light' : null;
        if(!which) continue;
        for(const [k] of TOKENS){
          const v=r.style.getPropertyValue(k);
          if(v) out[which][k]=v.trim();
        }
      }
    }
    /* light inherits anything it does not restate */
    for(const [k] of TOKENS) if(!out.light[k]) out.light[k]=out.dark[k];
    return out;
  }
  const BASE = baselines();

  /* ---------- state ----------------------------------------------------- */
  const blank = () => ({hue:0, sat:1, light:0, over:{}});
  let state;
  try{ state = JSON.parse(localStorage.getItem(STORE)) || {}; }catch(e){ state = {}; }
  state.dark = Object.assign(blank(), state.dark);
  state.light = Object.assign(blank(), state.light);

  const themeNow = () => ROOT.classList.contains('light') ? 'light' : 'dark';
  const save = () => { try{ localStorage.setItem(STORE, JSON.stringify(state)) }catch(e){} };

  /* final value of one token under the current settings */
  function resolve(theme,k,group){
    const cfg=state[theme];
    if(cfg.over[k]) return cfg.over[k];                      /* hand-picked wins */
    return transform(BASE[theme][k], cfg, group);
  }

  function apply(){
    const theme=themeNow();
    for(const [k,group] of TOKENS) ROOT.style.setProperty(k, resolve(theme,k,group));
    /* the hero shader reads --fx-* only when the class attribute changes, so
       give its MutationObserver something to notice. setTimeout, not rAF:
       rAF does not fire in a background tab and the class would stick. */
    ROOT.classList.add('cl-tick');
    setTimeout(()=>ROOT.classList.remove('cl-tick'),30);
    paintSwatches();
  }
  function reset(){
    state[themeNow()]=blank();
    for(const [k] of TOKENS) ROOT.style.removeProperty(k);
    save(); apply(); syncControls();
  }

  /* ---------- panel ------------------------------------------------------ */
  const css=document.createElement('style');
  css.textContent=`
  #cl-fab{position:fixed;right:16px;bottom:16px;z-index:100000;width:46px;height:46px;
    border-radius:50%;border:1px solid rgba(255,255,255,.25);cursor:pointer;
    background:conic-gradient(red,#ff0,#0f0,#0ff,#00f,#f0f,red);
    box-shadow:0 8px 24px rgba(0,0,0,.45)}
  #cl{position:fixed;right:16px;bottom:72px;z-index:100000;width:290px;max-height:78vh;
    overflow:auto;overscroll-behavior:contain;display:none;
    background:#15151a;color:#eee;border:1px solid #333;border-radius:14px;padding:14px;
    font:12px/1.45 ui-sans-serif,system-ui,sans-serif;
    box-shadow:0 20px 60px rgba(0,0,0,.6)}
  #cl.open{display:block}
  #cl h4{margin:0 0 2px;font-size:13px;font-weight:700;letter-spacing:.02em}
  #cl .sub{color:#9a9aa6;margin-bottom:10px}
  #cl .sub b{color:#ffd479}
  #cl .row{display:flex;align-items:center;gap:8px;margin:7px 0}
  #cl .row label{flex:0 0 86px;color:#b9b9c4}
  #cl input[type=range]{flex:1;min-width:0;accent-color:#a855f7}
  #cl .val{flex:0 0 46px;text-align:right;color:#8f8fa0;font-variant-numeric:tabular-nums}
  #cl .sw{display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center;margin:5px 0}
  #cl .sw span{color:#b9b9c4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #cl input[type=color]{width:38px;height:24px;border:1px solid #444;border-radius:6px;
    background:none;padding:0;cursor:pointer}
  #cl button{font:inherit;cursor:pointer;border-radius:8px;border:1px solid #3a3a44;
    background:#23232b;color:#eee;padding:7px 10px}
  #cl button:hover{background:#2e2e38}
  #cl .btns{display:flex;gap:6px;margin-top:12px}
  #cl .btns button{flex:1}
  #cl hr{border:0;border-top:1px solid #2a2a33;margin:12px 0}
  #cl canvas{display:block;margin:2px auto 6px;cursor:crosshair;border-radius:50%}
  #cl textarea{width:100%;height:120px;margin-top:8px;background:#0e0e12;color:#cfcfda;
    border:1px solid #333;border-radius:8px;font:11px/1.4 ui-monospace,monospace;padding:8px}`;
  document.head.appendChild(css);

  const fab=document.createElement('button');
  fab.id='cl-fab'; fab.type='button';
  fab.title='Colour lab (test copy only)';
  fab.setAttribute('aria-label','Toggle colour lab');

  const panel=document.createElement('div');
  panel.id='cl';
  panel.innerHTML=`
    <h4>Colour lab</h4>
    <div class="sub">Editing <b id="cl-theme">dark</b> — flip the site's own toggle to edit the other.</div>
    <canvas id="cl-wheel" width="128" height="128"></canvas>
    <div class="row"><label>Hue</label><input id="cl-hue" type="range" min="-180" max="180" step="1"><span class="val" id="cl-hue-v">0°</span></div>
    <div class="row"><label>Saturation</label><input id="cl-sat" type="range" min="0" max="200" step="1"><span class="val" id="cl-sat-v">100%</span></div>
    <div class="row"><label>Accent light</label><input id="cl-light" type="range" min="-25" max="25" step="1"><span class="val" id="cl-light-v">0</span></div>
    <hr>
    <div id="cl-sw"></div>
    <div class="btns">
      <button id="cl-reset" type="button">Reset</button>
      <button id="cl-copy" type="button">Copy CSS</button>
    </div>
    <textarea id="cl-out" readonly placeholder="Copy CSS puts both themes here, ready to paste into css/styles.css"></textarea>`;

  /* appended to body, which puts it OUTSIDE #smooth-wrap — that wrapper is
     fixed and transformed, and would otherwise capture position:fixed */
  document.body.appendChild(fab);
  document.body.appendChild(panel);
  fab.addEventListener('click',()=>panel.classList.toggle('open'));

  const $=id=>panel.querySelector(id);
  const hue=$('#cl-hue'), sat=$('#cl-sat'), light=$('#cl-light');

  /* swatch wells */
  const swWrap=$('#cl-sw');
  const wells={};
  for(const key of SWATCHES){
    const meta=TOKENS.find(t=>t[0]===key); if(!meta) continue;
    const row=document.createElement('div'); row.className='sw';
    row.innerHTML=`<span title="${key}">${meta[2]}</span>`;
    const inp=document.createElement('input'); inp.type='color';
    inp.addEventListener('input',()=>{
      state[themeNow()].over[key]=inp.value; save(); apply();
    });
    row.appendChild(inp); swWrap.appendChild(row); wells[key]=inp;
  }
  function paintSwatches(){
    const theme=themeNow();
    for(const key of SWATCHES){
      const meta=TOKENS.find(t=>t[0]===key); if(!meta||!wells[key]) continue;
      const v=resolve(theme,key,meta[1]);
      if(/^#[0-9a-f]{6}$/i.test(v)) wells[key].value=v;
    }
  }

  /* hue ring */
  const wheel=$('#cl-wheel'), wx=wheel.getContext('2d'), R=64;
  (function drawRing(){
    for(let a=0;a<360;a++){
      wx.beginPath();
      wx.strokeStyle=`hsl(${a} 85% 55%)`;
      wx.lineWidth=16;
      wx.arc(R,R,R-9,(a-90.5)*Math.PI/180,(a-88.5)*Math.PI/180);
      wx.stroke();
    }
  })();
  let marker=null;
  function drawMarker(deg){
    if(marker) wx.putImageData(marker,0,0); else marker=wx.getImageData(0,0,128,128);
    const a=(deg-90)*Math.PI/180;
    wx.beginPath();
    wx.arc(R+Math.cos(a)*(R-9), R+Math.sin(a)*(R-9), 7, 0, Math.PI*2);
    wx.strokeStyle='#fff'; wx.lineWidth=2.5; wx.stroke();
  }
  function wheelPick(ev){
    const r=wheel.getBoundingClientRect();
    const dx=ev.clientX-(r.left+r.width/2), dy=ev.clientY-(r.top+r.height/2);
    let deg=Math.atan2(dy,dx)*180/Math.PI+90;
    deg=((deg+180)%360)-180;                    /* -180..180, matching the slider */
    hue.value=Math.round(deg); onGlobal();
  }
  let dragging=false;
  wheel.addEventListener('pointerdown',e=>{dragging=true;wheel.setPointerCapture(e.pointerId);wheelPick(e)});
  wheel.addEventListener('pointermove',e=>{if(dragging)wheelPick(e)});
  wheel.addEventListener('pointerup',()=>{dragging=false});

  function onGlobal(){
    const cfg=state[themeNow()];
    cfg.hue=+hue.value; cfg.sat=+sat.value/100; cfg.light=+light.value;
    $('#cl-hue-v').textContent=cfg.hue+'°';
    $('#cl-sat-v').textContent=sat.value+'%';
    $('#cl-light-v').textContent=(cfg.light>0?'+':'')+cfg.light;
    drawMarker(cfg.hue);
    save(); apply();
  }
  [hue,sat,light].forEach(el=>el.addEventListener('input',onGlobal));

  function syncControls(){
    const cfg=state[themeNow()];
    hue.value=cfg.hue; sat.value=Math.round(cfg.sat*100); light.value=cfg.light;
    $('#cl-hue-v').textContent=cfg.hue+'°';
    $('#cl-sat-v').textContent=Math.round(cfg.sat*100)+'%';
    $('#cl-light-v').textContent=(cfg.light>0?'+':'')+cfg.light;
    $('#cl-theme').textContent=themeNow();
    drawMarker(cfg.hue);
    paintSwatches();
  }

  $('#cl-reset').addEventListener('click',reset);
  $('#cl-copy').addEventListener('click',()=>{
    const block=theme=>TOKENS.map(([k,g])=>'  '+k+':'+resolve(theme,k,g)+';').join('\n');
    const out=`/* paste over the token blocks in css/styles.css */\n:root{\n${block('dark')}\n}\nhtml.light{\n${block('light')}\n}`;
    $('#cl-out').value=out;
    $('#cl-out').select();
    try{ navigator.clipboard.writeText(out); }catch(e){}
    console.log(out);
  });

  /* Follow the site's own theme toggle. Compare the theme rather than holding
     a "we are mid-apply" flag: apply() toggles cl-tick on this same element,
     so a flag has to be cleared on a timer, and anything that delays that timer
     (a background tab throttling rAF, say) leaves the observer deaf to a real
     theme change — which silently keeps one theme's palette on the other. */
  let lastTheme=themeNow();
  new MutationObserver(()=>{
    const t=themeNow();
    if(t===lastTheme) return;          /* our own cl-tick, or something unrelated */
    lastTheme=t;
    syncControls(); apply();
  }).observe(ROOT,{attributes:true,attributeFilter:['class']});

  syncControls();
  apply();
  console.log('[colour lab] ready — bottom-right button. Test copy only.');
})();
