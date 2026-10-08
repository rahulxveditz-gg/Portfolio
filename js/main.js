/* Scrolling, reveals, video viewer, theme toggle
   Extracted from index.html. Nothing here is minified or bundled — the site
   has no build step, so these files are served exactly as written. */

/* ===== smooth momentum scroll ===== */
const wrap=document.getElementById('smooth-wrap');
const header=document.getElementById('header'),bar=document.querySelector('.progress');
let SMOOTH=false;
let cur=0;                     /* eased scroll position */
const SETTLE=.65;              /* seconds for wheel momentum to settle */
const TAU=SETTLE/4.6;          /* time constant (frame-rate independent) */
const NAV_MS=900;              /* nav-click travel time (was 1000 — 10% quicker) */
/* easeInOutSine: of the curves tested it has both the lowest peak speed
   (1.57x avg) and the longest deceleration, so it never feels rushed */
const navEase=p=>-(Math.cos(Math.PI*p)-1)/2;
let tween=null;                /* active anchor tween */

function syncHeight(){
  if(SMOOTH) document.body.style.height=wrap.getBoundingClientRect().height+'px';
}
/* re-evaluated on resize so it never gets stuck in the wrong mode */
function evalSmooth(){
  const ok = matchMedia('(hover:hover) and (pointer:fine)').matches
          && innerWidth>900
          && !matchMedia('(prefers-reduced-motion:reduce)').matches;
  if(ok===SMOOTH){syncHeight();return}
  SMOOTH=ok;
  if(ok){
    document.documentElement.classList.add('smooth');
    cur=window.scrollY;
    syncHeight();
  }else{
    document.documentElement.classList.remove('smooth');
    document.body.style.height='';
    wrap.style.transform='';
  }
}
evalSmooth();
addEventListener('resize',evalSmooth);
addEventListener('load',evalSmooth);
if(window.ResizeObserver) new ResizeObserver(syncHeight).observe(wrap);

/* ===== video viewer =======================================================
   A plain fixed lightbox: click a card, the page goes dark and the video plays
   centred. It is NOT built out of the card itself — the card stays put in the
   grid and the player is its own element, which is what lets this be a simple
   fixed overlay instead of something coupled to scroll position.           */
const lightbox=(function(){
  const lb=document.getElementById('lb');
  /* every project card, not just the ones with a video. Filtering to
     [data-yt] meant next stopped at the last long-form card and the short
     form section could never be reached. */
  const cards=[...document.querySelectorAll('.works .work')];
  if(!lb||!cards.length) return null;
  const veil=lb.querySelector('.lb-veil'),stage=lb.querySelector('.lb-stage'),
        box=lb.querySelector('.lb-box'),rail=lb.querySelector('.rail'),
        label=lb.querySelector('.lb-label'),bClose=lb.querySelector('.vclose'),
        bPrev=lb.querySelector('.vprev'),bNext=lb.querySelector('.vnext'),
        zin=lb.querySelector('.vzoom input');
  if(!veil||!stage||!box||!rail||!label||!zin) return null;

  /* content lives in its own layer so it can cross-fade while the box
     itself morphs between aspect ratios */
  let inner=box.querySelector('.lb-inner');
  if(!inner){inner=document.createElement('div');inner.className='lb-inner';box.appendChild(inner);}

  const CLEAR=84;                 /* the nav is ~72px of fixed height */
  const cl=(v,a,b)=>v<a?a:v>b?b:v;
  let cur=-1,zoom=1,open=false;

  const isShort=c=>c.classList.contains('short');
  /* base size: as large as fits with the rail's lane free and the nav cleared */
  function baseSize(c){
    const ar=isShort(c)?9/16:16/9;
    let w=Math.min(isShort(c)?360:900,innerWidth*.68);
    let h=w/ar;
    const maxH=innerHeight-CLEAR*2;
    if(h>maxH){h=maxH;w=h*ar}
    return {w:Math.round(w),h:Math.round(h)};
  }
  function fitFor(c){
    const b=baseSize(c);
    return Math.max(1,Math.min(innerWidth*.68/b.w,(innerHeight-CLEAR*2)/b.h));
  }
  /* the rail sits beside the player and steps outward as it grows */
  function layout(){
    if(cur<0) return;
    const b=baseSize(cards[cur]);
    box.style.width=b.w+'px';box.style.height=b.h+'px';
    const gap=innerWidth/2-(b.w*zoom)/2;
    rail.style.right=Math.max(14,gap-74)+'px';
    label.style.width=Math.max(90,gap-58)+'px';
  }

  function show(i){
    if(i<0||i>=cards.length) return;
    const first=!open;
    cur=i;
    const c=cards[i],id=c.dataset.yt;
    const zMax=fitFor(c);
    zoom=1;
    zin.min=100;zin.max=Math.round(zMax*100);zin.value=100;
    zin.disabled=zMax<1.04;
    stage.style.setProperty('--z',1);
    bPrev.disabled=i<=0;bNext.disabled=i>=cards.length-1;
    label.textContent=isShort(c)?'Short Form':'Long Form';

    /* Size first: that starts the width/height transition, so the box is
       already travelling between 16:9 and 9:16 while the contents swap. On the
       very first open there is no previous size to travel from, so the morph is
       suppressed for one frame or the box would unfold from nothing. */
    if(first) box.classList.add('no-morph');
    layout();
    if(first){ void box.offsetWidth; box.classList.remove('no-morph'); }

    /* Built on open, destroyed on close — seven idle embeds would cost
       megabytes, and removing it is also what stops playback. Built
       SYNCHRONOUSLY, inside the click, so autoplay still counts as
       user-initiated; deferring it to a timeout breaks that. */
    inner.innerHTML='';
    if(id){
      const f=document.createElement('iframe');
      f.title=(c.querySelector('h3')||{}).textContent||'Video';
      f.allow='accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
      f.allowFullscreen=true;
      f.src='https://www.youtube-nocookie.com/embed/'+encodeURIComponent(id)
           +'?autoplay=1&rel=0&playsinline=1';
      inner.appendChild(f);
    }else{
      /* No video behind this one yet. Show the card's own artwork rather than
         an empty black box — the wN class carries its gradient, so it has to
         come along for the CSS to match. */
      const art=document.createElement('div');
      art.className='lb-art '+((c.className.match(/\bw\d\b/)||[''])[0]);
      const thumb=c.querySelector('.thumb');
      if(thumb) art.innerHTML=thumb.innerHTML;
      art.querySelectorAll('iframe,.play').forEach(n=>n.remove());
      inner.appendChild(art);
      const cap=document.createElement('div');
      cap.className='lb-cap';
      cap.textContent=(c.querySelector('h3')||{}).textContent||'';
      inner.appendChild(cap);
    }
    /* fade the new contents up as the box finishes moving */
    inner.style.transition='none'; inner.style.opacity='0';
    void inner.offsetWidth;
    inner.style.transition=''; inner.style.opacity='1';
    open=true;lb.classList.add('on');lb.setAttribute('aria-hidden','false');
    document.documentElement.classList.add('viewing');
  }
  function hide(){
    open=false;cur=-1;
    lb.classList.remove('on');lb.setAttribute('aria-hidden','true');
    document.documentElement.classList.remove('viewing');
    /* after the fade, so the player does not vanish before the panel does */
    setTimeout(()=>{if(!open) inner.innerHTML=''},340);
  }

  cards.forEach((c,i)=>c.addEventListener('click',()=>show(i)));
  bClose.addEventListener('click',hide);
  veil.addEventListener('click',hide);
  bPrev.addEventListener('click',()=>show(cur-1));
  bNext.addEventListener('click',()=>show(cur+1));
  zin.addEventListener('input',()=>{
    zoom=+zin.value/100;
    stage.style.setProperty('--z',zoom);
    layout();
  });
  addEventListener('keydown',e=>{
    if(!open) return;
    if(e.key==='Escape') hide();
    else if(e.key==='ArrowUp'){e.preventDefault();show(cur-1)}
    else if(e.key==='ArrowDown'){e.preventDefault();show(cur+1)}
  });
  /* hold the page still underneath — a modal that scrolls its own background
     reads as broken. Non-passive so preventDefault actually applies. */
  const block=e=>{if(open) e.preventDefault()};
  addEventListener('wheel',block,{passive:false});
  addEventListener('touchmove',block,{passive:false});
  addEventListener('resize',layout);
  return {show,hide};
})();

/* ===== custom cursor ===== */
const dot=document.querySelector('.cur-dot'),ring=document.querySelector('.cur-ring');
let mx=innerWidth/2,my=innerHeight/2,rx=mx,ry=my;
addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;dot.style.transform=`translate(${mx}px,${my}px) translate(-50%,-50%)`});
document.querySelectorAll('a,button,[data-cursor]').forEach(el=>{
  el.addEventListener('mouseenter',()=>ring.classList.add('hover'));
  el.addEventListener('mouseleave',()=>ring.classList.remove('hover'));
});

/* ===== single render loop: scroll easing + cursor + progress ===== */
let lastT=performance.now();
(function frame(now){
  now=now||performance.now();
  const dt=Math.min(.05,(now-lastT)/1000); lastT=now;

  if(tween){                                   /* nav click: drive the target */
    const p=Math.min(1,(now-tween.t0)/(tween.ms||NAV_MS));   /* snaps run shorter */
    const max=Math.max(0,document.documentElement.scrollHeight-innerHeight);
    window.scrollTo(0,Math.min(max,tween.from+tween.delta*navEase(p)));
    if(p>=1) tween=null;
  }
  /* the visible position always trails the target exponentially — decay is
     asymptotic, so motion feathers away instead of cutting off at the end */
  if(SMOOTH){
    const tgt=window.scrollY;
    cur+=(tgt-cur)*(1-Math.exp(-dt/TAU));
    if(!tween&&Math.abs(tgt-cur)<.08) cur=tgt;
  }else cur=window.scrollY;

  if(SMOOTH) wrap.style.transform=`translate3d(0,${-cur.toFixed(2)}px,0)`;

  rx+=(mx-rx)*.16; ry+=(my-ry)*.16;
  ring.style.transform=`translate(${rx}px,${ry}px) translate(-50%,-50%)`;

  const h=Math.max(1,document.documentElement.scrollHeight-innerHeight);
  bar.style.width=Math.min(100,cur/h*100)+'%';
  header.classList.toggle('scrolled',cur>40);

  requestAnimationFrame(frame);
})();

/* ===== anchor links (let the easing do the smoothing) ===== */
function goTo(sel){
  const el=document.querySelector(sel);
  if(!el)return;
  const max=Math.max(0,document.documentElement.scrollHeight-innerHeight);
  const y=Math.min(max,Math.max(0,el.getBoundingClientRect().top+cur-(sel==='#top'?0:70)));
  if(SMOOTH) tween={from:window.scrollY,delta:y-window.scrollY,t0:performance.now()};
  else window.scrollTo({top:y,behavior:'smooth'});
}
/* any manual scroll input cancels an in-flight nav tween */
['wheel','touchstart','keydown'].forEach(ev=>addEventListener(ev,()=>{tween=null},{passive:true}));
document.querySelectorAll('a[href^="#"]').forEach(a=>{
  a.addEventListener('click',e=>{
    const href=a.getAttribute('href');
    if(!href||href.length<2)return;
    if(!document.querySelector(href))return;
    e.preventDefault();
    goTo(href);
  });
});

/* ===== reveal on scroll ===== */
const io=new IntersectionObserver((es)=>{
  es.forEach((e,i)=>{if(e.isIntersecting){setTimeout(()=>e.target.classList.add('in'),(i%3)*90);io.unobserve(e.target)}})
},{threshold:.14});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

/* ===== project cards: directional reveal, in and out ======================
   Which side a card flies in from is read from where it actually sits in its
   grid, measured live, so it re-derives itself at every breakpoint instead of
   being hard-coded per card. Two observers rather than one give it real
   hysteresis: a card appears once it is properly in view but only leaves once
   it is well clear of the edge, so parking mid-scroll can't strobe it.     */
(function(){
  const grids=[...document.querySelectorAll('.work-grid,.works')];
  const cards=[...document.querySelectorAll('.reveal-x')];
  if(!cards.length)return;
  /* no observer, no reveal — show the cards rather than hiding them forever */
  if(!window.IntersectionObserver){cards.forEach(el=>el.classList.add('shown'));return}

  function place(){
    const dist=Math.max(26,Math.min(78,innerWidth*.062));
    grids.forEach(g=>{
      const gr=g.getBoundingClientRect(),gc=gr.left+gr.width/2;
      /* querySelectorAll, not children: the Long Form cards sit inside
         .stack-pin, which is display:contents in the fallback layout */
      const kids=[...g.querySelectorAll('.reveal-x')];
      /* single column: every card is as wide as the grid, so there is no left
         or right to read — alternate sides by order instead */
      const single=kids.every(c=>c.getBoundingClientRect().width>gr.width-4);
      kids.forEach((c,i)=>{
        let dir;
        if(single) dir=i%2?1:-1;
        else{
          const r=c.getBoundingClientRect();
          const t=((r.left+r.width/2)-gc)/(gr.width/2||1);
          dir=Math.abs(t)<.18?0:(t<0?-1:1);   /* dead zone = a centred column */
        }
        c.style.setProperty('--dx',(dir*dist)+'px');
        c.style.setProperty('--rd',(dir<0?0:dir===0?70:140)+'ms');
      });
    });
  }
  place();
  let rt;addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(place,150)});

  /* which edge the card enters from */
  const edge=el=>{
    const r=el.getBoundingClientRect();
    return (r.top+r.height/2<innerHeight/2?-30:30)+'px';
  };
  function set(el,cls){
    el.classList.remove('in','shown');
    el.style.setProperty('--dy',edge(el));
    void el.offsetWidth;                    /* restart the animation cleanly */
    el.classList.add(cls);
  }

  /* fill-mode:both would pin the end frame and keep overriding :hover, so the
     class comes off as soon as the animation is done */
  cards.forEach(el=>el.addEventListener('animationend',e=>{
    if(e.animationName==='rxIn'){el.classList.remove('in');el.classList.add('shown')}
  }));

  /* Reveal once, then stop watching.

     There used to be a matching exit animation driven by a second observer,
     and it had a bug that left cards invisible. The two observers watched
     different roots: this one the whole viewport, the other only its middle
     60%. A card could leave the middle band — and be sent to opacity 0 — while
     still intersecting THIS root, so this observer's state never flipped to
     false. Scrolling back up produced no false->true transition, nothing
     re-fired, and the card stayed blank. Revealing once removes the whole
     class of problem. */
  const el_shown=el=>el.classList.contains('in')||el.classList.contains('shown');
  const inObs=new IntersectionObserver(es=>es.forEach(e=>{
    if(!e.isIntersecting) return;
    if(!el_shown(e.target)) set(e.target,'in');
    inObs.unobserve(e.target);
  }),{threshold:.18,rootMargin:'0px 0px -6% 0px'});
  cards.forEach(el=>inObs.observe(el));
})();

/* ===== theme toggle ===== */
(function(){
  const html = document.documentElement;
  const btn = document.getElementById('themeToggle');
  if(!btn) return;
  const STORAGE_KEY = 'rv-theme';
  
  function applyTheme(theme){
    if(theme === 'light'){
      html.classList.add('light');
    } else {
      html.classList.remove('light');
    }
    /* dim the WebGL canvas in light mode — the dark silk doesn't suit a light page */
    const cv = document.getElementById('bgfx');
    if(cv) cv.style.opacity = theme === 'light' ? '0.18' : '';
  }
  
  /* default to light as the user requested; honour saved preference */
  const saved = localStorage.getItem(STORAGE_KEY);
  const initial = saved || 'light';
  applyTheme(initial);
  
  btn.addEventListener('click', ()=>{
    const isLight = html.classList.contains('light');
    const next = isLight ? 'dark' : 'light';
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
  });
})();

/* ===== mobile menu (simple scroll) ===== */
document.getElementById('burger').addEventListener('click',()=>goTo('#contact'));
