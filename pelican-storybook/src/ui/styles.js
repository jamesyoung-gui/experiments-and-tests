// OWNER: ui. The control card's stylesheet (injected once as <style id="ui-style">).
// Style B: a warm storybook gouache object. The card is a sheet of deckle-edged watercolour paper lying on the page
// (a second, slightly rotated sheet peeks out underneath; a soft warm shadow), hand-lettered serif labels in warm brown
// ink, gouache "dabs" of colour behind every icon, a knitted scarf-red bookmark ribbon, index tabs cut from coloured
// paper, pencil double lines on buttons. Colours are CSS variables derived from the scene's live seven inks
// (--pb-ink{P,K,O,R,B,T,N}, copied by ui.js ≤10 Hz), mixed toward fixed gouache pigments so the card always reads as
// paper under the current light (warm at golden hour, lamp-lit lilac at bedtime) and always passes contrast.
// Performance: no filters and no blend modes anywhere. The deckled silhouette is a seeded SVG mask (ui.js regenerates
// it only when the card is resized); the paper grain is a static seeded SVG image of translucent blotches and fibres.

// ---------------------------------------------------------------- seeded helpers (deterministic, no Math.random)
export function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const f1 = n => (Math.round(n * 10) / 10).toString();
const svgURI = s => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;

// A deckle-edged rounded rectangle (torn watercolour paper): the edge walks the perimeter in ~4 px steps with a
// low-frequency drift plus fine fibre jitter, always inset (0…amp) so the mask never exceeds the box.
export function deckle(w, h, seed = 7, { r = 9, amp = 2.6, step = 4 } = {}) {
  w = Math.max(8, Math.round(w)); h = Math.max(8, Math.round(h));
  const R = mulberry(seed), a = Math.min(amp, w / 6, h / 6), rr = Math.min(r, w / 3, h / 3);
  const pts = [];
  // perimeter segments of a rounded rect, clockwise from the top-left corner's end
  const seg = [];
  const line = (x0, y0, x1, y1, nx, ny) => seg.push({ k: 'l', x0, y0, x1, y1, nx, ny, len: Math.hypot(x1 - x0, y1 - y0) });
  const arc = (cx, cy, a0) => seg.push({ k: 'a', cx, cy, a0, len: rr * Math.PI / 2 });
  line(rr, 0, w - rr, 0, 0, 1); arc(w - rr, rr, -Math.PI / 2);
  line(w, rr, w, h - rr, -1, 0); arc(w - rr, h - rr, 0);
  line(w - rr, h, rr, h, 0, -1); arc(rr, h - rr, Math.PI / 2);
  line(0, h - rr, 0, rr, 1, 0); arc(rr, rr, Math.PI);
  let drift = R() * a, target = R() * a;
  for (const s of seg) {
    const n = Math.max(1, Math.round(s.len / step));
    for (let i = 0; i < n; i++) {
      const u = i / n;
      if (R() < 0.18) target = R() * a;                         // the tear wanders slowly…
      drift += (target - drift) * 0.35;
      const d = Math.min(a, Math.max(0, drift + (R() - 0.5) * a * 0.55));   // …with fine fibre jitter
      let x, y;
      if (s.k === 'l') { x = s.x0 + (s.x1 - s.x0) * u + s.nx * d; y = s.y0 + (s.y1 - s.y0) * u + s.ny * d; }
      else { const t = s.a0 + u * Math.PI / 2, rd = rr - d; x = s.cx + Math.cos(t) * rd; y = s.cy + Math.sin(t) * rd; }
      pts.push(f1(x) + ' ' + f1(y));
    }
  }
  return svgURI(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="M${pts.join('L')}Z"/></svg>`);
}

// Paper grain: translucent warm-brown gouache blotches, a few paper fibres and pigment specks. Colour-neutral enough
// to sit on every tint of the paper (it only ever darkens slightly). Static: rasterised once, tiled.
const GRAIN = (() => {
  const R = mulberry(20260930), S = 180;
  let s = '';
  for (let i = 0; i < 70; i++) {
    const x = R() * S, y = R() * S, rx = 6 + R() * 26, ry = rx * (0.4 + R() * 0.6), rot = R() * 180;
    const o = (0.012 + R() * 0.022).toFixed(3), col = R() < 0.5 ? '#c07a3e' : R() < 0.6 ? '#e0905a' : '#a8663a';
    for (const [dx, dy] of [[0, 0], [x > S / 2 ? -S : S, 0], [0, y > S / 2 ? -S : S]])   // wrap for a seamless tile
      s += `<ellipse cx="${f1(x + dx)}" cy="${f1(y + dy)}" rx="${f1(rx)}" ry="${f1(ry)}" transform="rotate(${f1(rot)} ${f1(x + dx)} ${f1(y + dy)})" fill="${col}" fill-opacity="${o}"/>`;
  }
  for (let i = 0; i < 26; i++) {
    const x = R() * S, y = R() * S, l = 5 + R() * 10, t = R() * Math.PI, c = (R() - 0.5) * 5;
    const x1 = x + Math.cos(t) * l, y1 = y + Math.sin(t) * l, mx = (x + x1) / 2 - Math.sin(t) * c, my = (y + y1) / 2 + Math.cos(t) * c;
    s += `<path d="M${f1(x)} ${f1(y)}Q${f1(mx)} ${f1(my)} ${f1(x1)} ${f1(y1)}" stroke="#6b4028" stroke-opacity="${(0.07 + R() * 0.07).toFixed(3)}" stroke-width=".6" fill="none" stroke-linecap="round"/>`;
  }
  for (let i = 0; i < 90; i++) s += `<circle cx="${f1(R() * S)}" cy="${f1(R() * S)}" r="${f1(0.3 + R() * 0.6)}" fill="#6b4028" fill-opacity="${(0.05 + R() * 0.1).toFixed(3)}"/>`;
  return svgURI(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${s}</svg>`);
})();

// A hand-drawn wavy pencil rule (mask only: its colour comes from the element's background ink)
const WAVY = svgURI('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="6" viewBox="0 0 48 6"><path d="M0 3.2C4 1.4 8 1.2 12 3s8 2 12 .2 8-2 12-.3 8 2.1 12 .1" fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round"/></svg>');
// stitched running-thread line (the fold between the quick row and the controls)
const STITCH = svgURI('<svg xmlns="http://www.w3.org/2000/svg" width="14" height="4" viewBox="0 0 14 4"><path d="M1.5 2.3 8 1.7" stroke="#000" stroke-width="1.7" stroke-linecap="round"/></svg>');
// a little curled flourish for section headings
const SWASH = svgURI('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="10" viewBox="0 0 40 10"><path d="M1 6.2C8 3.6 14 3.4 21 5.4s12 1.6 15-1.2c1.2-1.2.4-2.8-.9-2.2-1.4.7-.6 2.6 1.4 2.7" fill="none" stroke="#000" stroke-width="1.4" stroke-linecap="round"/><circle cx="3" cy="6" r="1.2"/></svg>');

export const CSS = String.raw`
#ui{
  --ui-font:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,"DejaVu Serif",serif;
  --ui-cjk:"LXGW WenKai","Kaiti SC",STKaiti,KaiTi,BiauKai,"Noto Serif CJK SC","Source Han Serif SC","Songti SC","WenQuanYi Zen Hei",serif;
  --ui-w:19.75rem; --ui-inset:28px; --ui-room:60vh;
  /* gouache pigments, re-lit by the scene's inks (golden: paper #FFF6EC, line #4A2C20) */
  --u-paper:color-mix(in srgb, var(--pb-inkP) 45%, #FFF3E0);
  --u-paper2:color-mix(in srgb, var(--u-paper) 82%, var(--pb-inkK));
  --u-ink:color-mix(in srgb, var(--pb-inkN) 45%, #4A2C20);
  --u-ink-soft:color-mix(in srgb, var(--u-ink) 38%, transparent);
  --u-shade:color-mix(in srgb, #5a3424 30%, transparent);
  --u-peach:color-mix(in srgb, var(--pb-inkK) 42%, var(--u-paper));
  --u-sun:color-mix(in srgb, #FAC957 70%, var(--pb-inkO));
  --u-sunwash:color-mix(in srgb, #FAC957 52%, var(--u-paper));
  --u-red:var(--pb-inkR);
  --u-teal:var(--pb-inkT);
  --u-sea:var(--pb-inkB);
  --u-mauve:color-mix(in srgb, #94777F 70%, var(--pb-inkB));
  --u-wicker:color-mix(in srgb, #C89B5E 80%, var(--pb-inkO));
  --u-grain:${GRAIN};
  position:fixed; inset:0; pointer-events:none; z-index:10; font:13.5px/1.25 var(--ui-font); color:var(--u-ink);
  -webkit-font-smoothing:antialiased; touch-action:manipulation;
}
#ui *{box-sizing:border-box}
#ui[data-hud="off"] .ui-card, #ui[data-hud="off"] .ui-hint{display:none}
#ui :lang(zh-CN){font-family:var(--ui-cjk)}
#ui .ui-sr{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;margin:-1px;padding:0;border:0}
#ui svg{display:block}

/* ---------- language modes: bi (中文 first, English second, italic) · zh · en ---------- */
#ui[data-lang="zh"] .en, #ui[data-lang="en"] .zh, .ui-help[data-lang="zh"] .en, .ui-help[data-lang="en"] .zh{display:none!important}
#ui .en{font-family:var(--ui-font)}
#ui[data-lang="bi"] .unit-zh{display:none}
#ui[data-lang="bi"] .ui-btn .en{font-size:.66rem; font-style:italic; letter-spacing:.01em}

/* ---------- the card: a sheet of deckled paper on the page ---------- */
.ui-card{
  position:absolute; left:var(--ui-inset); bottom:var(--ui-inset); width:var(--ui-w); max-width:calc(100vw - 32px);
  pointer-events:auto; transition:transform .45s cubic-bezier(.2,.9,.25,1.15), opacity .3s;
}
.ui-card[data-dock="right"]{left:auto; right:var(--ui-inset)}
.ui-card[data-dock$="top"]{bottom:auto; top:var(--ui-inset)}
.ui-card[data-dock="right-top"]{left:auto; right:var(--ui-inset)}
/* the deckle mask (--ui-deckle) is generated by ui.js for the live size; before that a plain rounded box */
.ui-plate, .ui-shadow, .ui-under{-webkit-mask:var(--ui-deckle, linear-gradient(#000,#000)) 0 0 / 100% 100% no-repeat; mask:var(--ui-deckle, linear-gradient(#000,#000)) 0 0 / 100% 100% no-repeat}
.ui-shadow{position:absolute; inset:0; transform:translate(3px,6px); background:var(--u-shade); pointer-events:none}
/* a second, rose-tinted sheet peeking out underneath (the stack of pages) */
.ui-under{position:absolute; inset:3px -5px -3px 5px; transform:rotate(-2.2deg); transform-origin:30% 100%; pointer-events:none;
  background:var(--u-grain) 37px 11px / 180px 180px, color-mix(in srgb, var(--u-peach) 70%, var(--u-mauve))}
.ui-plate{
  position:relative; padding:8px 9px 10px; color:var(--u-ink);
  background:
    radial-gradient(70% 45% at 12% 4%, color-mix(in srgb, var(--pb-inkK) 26%, transparent), transparent 70%),
    radial-gradient(60% 40% at 96% 100%, color-mix(in srgb, #FAC957 22%, transparent), transparent 70%),
    radial-gradient(140% 120% at 50% 45%, transparent 60%, color-mix(in srgb, #b0683a 14%, transparent) 100%),
    var(--u-grain) 0 0 / 180px 180px,
    var(--u-paper);
  max-height:calc(100dvh - 2 * var(--ui-inset)); overflow:hidden; display:flex; flex-direction:column;
}
.ui-frame{padding:2px 2px 0; display:flex; flex-direction:column; min-height:0; flex:0 1 auto}
.ui-frame > *{flex:none}
.ui-card[data-up="true"] .ui-body{order:2}
.ui-card[data-up="true"] .ui-perf{order:3; margin-bottom:0}
.ui-card[data-up="true"] .ui-quick{order:4}
.ui-card[data-up="true"] .ui-note{order:5}
.ui-frame > .ui-body{flex:0 1 auto; min-height:0; overflow:auto; overscroll-behavior:contain; scrollbar-width:thin; scrollbar-color:var(--u-ink-soft) transparent}

/* the knitted bookmark ribbon (scarf red and cream), tucked under the top edge */
.ui-ribbon{position:absolute; top:-12px; right:22px; width:20px; height:46px; z-index:2; pointer-events:none;
  clip-path:polygon(0 0,100% 0,100% 100%,50% 80%,0 100%);
  background:
    linear-gradient(0deg, transparent 0 12px, #FFF3E0 12px 16px, transparent 16px 20px, #FFF3E0 20px 24px, transparent 24px),
    repeating-linear-gradient(60deg, color-mix(in srgb, #3a1a14 20%, transparent) 0 1px, transparent 1px 3.4px),
    repeating-linear-gradient(-60deg, color-mix(in srgb, #fff 16%, transparent) 0 1px, transparent 1px 3.4px),
    var(--u-red)}
.ui-ribbon::after{content:""; position:absolute; left:0; right:0; top:0; height:12px; background:linear-gradient(180deg, color-mix(in srgb, #3a1a14 38%, transparent), color-mix(in srgb, #3a1a14 12%, transparent))}   /* tucked under the page */
.ui-card[data-dock$="top"] .ui-ribbon{top:auto; bottom:-12px; clip-path:polygon(0 0,100% 0,100% 100%,50% 80%,0 100%)}
.ui-card[data-dock$="top"] .ui-ribbon::after{top:0}

/* header: a little pelican vignette, the hand-lettered title and an italic subtitle */
.ui-head{display:flex; align-items:center; gap:9px; padding:2px 30px 4px 2px; position:relative; cursor:default}
.ui-vig{flex:none; width:52px; height:40px; margin:-2px 0 -3px -2px}
.ui-vig svg{width:100%; height:100%; overflow:visible}
.ui-wordmark{flex:1; min-width:0}
.ui-title{display:flex; align-items:flex-end; gap:7px}
.ui-title svg{height:17px; width:auto; fill:var(--u-ink); overflow:visible}
.ui-title .zhm{height:13px; fill:var(--u-red); margin-bottom:1px}
.ui-sub{display:block; margin-top:3px; font-size:.7rem; line-height:1.2; font-style:italic; color:color-mix(in srgb, var(--u-ink) 88%, var(--u-paper))}
#ui .ui-sub .zh{font-style:normal; display:block}

/* painted wave border under the header */
.ui-guil{width:calc(100% + 4px); height:9px; margin:2px -2px 0; fill:none; overflow:visible}
.ui-guil path{stroke-linecap:round; stroke-linejoin:round}
.ui-card[data-level="1"] .ui-guil, .ui-card[data-level="2"] .ui-guil{display:none}
@media (max-width:600px), (max-aspect-ratio:4/5){ .ui-guil{display:none} }

/* ---------- odometer: little painted number tiles ---------- */
.ui-odo{display:grid; grid-template-columns:1fr auto; gap:6px 10px; align-items:center; padding:7px 4px 7px; margin:2px 0 0; position:relative}
.ui-meter{display:flex; align-items:center; gap:6px}
.ui-meter-lab{font-size:.68rem; line-height:1.1; font-style:italic}
.ui-meter-lab .zh{display:block; font-size:.78rem; font-style:normal; font-weight:700}
.ui-drums{display:flex; align-items:stretch; gap:2px; padding:0}
.ui-drums.big .ui-drum{width:17px; height:25px}
.ui-drum{position:relative; width:12px; height:18px; overflow:hidden; color:var(--u-ink);
  background:linear-gradient(180deg, color-mix(in srgb, var(--u-ink) 16%, var(--u-paper)) 0, var(--u-paper) 28%, var(--u-paper) 70%, color-mix(in srgb, var(--u-ink) 18%, var(--u-paper)) 100%);
  border:1.5px solid var(--u-ink); border-radius:4px 3px 4px 3px / 3px 4px 3px 4px}
.ui-drums > .ui-drum:nth-child(2n){rotate:1.2deg; border-radius:3px 4px 3px 5px}
.ui-drums > .ui-drum:nth-child(3n){rotate:-1deg; translate:0 .5px}
.ui-drum.red{color:#FFF6EC; border-color:color-mix(in srgb, var(--u-red) 55%, var(--u-ink));
  background:linear-gradient(180deg, color-mix(in srgb, #000 22%, var(--u-red)) 0, var(--u-red) 30%, var(--u-red) 70%, color-mix(in srgb, #000 24%, var(--u-red)) 100%)}
.ui-drum svg{width:100%; height:100%; fill:currentColor; overflow:hidden}
.ui-drum .ui-reel{transition:transform .1s linear}
.ui-drum.snap .ui-reel{transition:transform .22s cubic-bezier(.3,1.4,.5,1)}
.ui-dot{width:4px; align-self:flex-end; margin:0 1px 3px; height:4px; background:var(--u-ink); border-radius:50% 40% 50% 45%}
.ui-unit{font-size:.7rem; font-style:italic; margin-left:2px; white-space:nowrap}
.ui-odo-row2{grid-column:1 / -1; display:flex; gap:14px; justify-content:space-between}
.ui-odo .ui-state{display:flex; align-items:center; gap:2px; font-size:.68rem; text-align:right; font-style:italic; line-height:1.15}
.ui-odo .ui-state .zh{display:block; font-size:.78rem; font-style:normal; font-weight:700}
.ui-lamp{display:inline-block; width:9px; height:9px; border-radius:50% 45% 50% 42%; border:1.5px solid var(--u-ink); margin-right:4px; vertical-align:-1px; background:var(--u-paper)}
[data-playing="true"] .ui-lamp.run{background:var(--u-teal)}
[data-coasting="true"] .ui-lamp.run{background:var(--u-sun)}

/* ---------- buttons: hand-cut paper with a pencil double line and a gouache dab behind the icon ---------- */
.ui-quick{display:grid; grid-template-columns:repeat(4,1fr); gap:6px; padding:8px 0 3px}
.ui-btn{
  --dab:var(--u-peach); --r:11px 8px 12px 9px / 9px 12px 8px 11px;
  appearance:none; font:inherit; color:var(--u-ink); background:var(--u-paper2); border:2px solid var(--u-ink);
  border-radius:var(--r); padding:4px 4px; min-height:38px; min-width:0; cursor:pointer; position:relative;
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px; text-align:center;
  box-shadow:0 2.5px 0 var(--u-shade); transition:transform .08s, box-shadow .08s, background-color .12s;
  -webkit-tap-highlight-color:transparent; touch-action:manipulation; overflow-wrap:break-word; hyphens:auto;
}
.ui-btn:nth-child(3n+2){--r:8px 12px 9px 11px / 12px 8px 11px 9px}
.ui-btn:nth-child(3n){--r:12px 9px 8px 12px / 8px 11px 12px 9px}
/* the pencil's second, lighter line, a little off-register */
.ui-btn::before{content:""; position:absolute; inset:-3px -1px -1px -3px; border:1px solid var(--u-ink-soft); border-radius:var(--r); rotate:-.7deg; pointer-events:none}
.ui-btn .ico{width:22px; height:22px; flex:none; fill:none; stroke:currentColor; stroke-width:1.9; stroke-linecap:round; stroke-linejoin:round; overflow:visible}
.ui-btn .ico .dab, .ui-gestures .dab{fill:var(--dab); stroke:none; opacity:.8}
.ui-btn .lab{display:flex; flex-direction:column; align-items:center; min-width:0}
.ui-btn .zh{font-weight:700; font-size:.84rem; line-height:1.1}
#ui[data-lang="bi"] .zh + .en{margin-left:.3em}
#ui[data-lang="bi"] .ui-btn .zh + .en{margin-left:0}
.ui-btn .en{font-size:.76rem; line-height:1.1}
#ui[data-lang="en"] .ui-btn .en{font-weight:700; font-size:.8rem}
.ui-btn.row{flex-direction:row; gap:6px; justify-content:flex-start; padding:4px 8px; text-align:left}
.ui-btn.row .lab{align-items:flex-start}
/* gouache colour per action */
[data-act="play"]{--dab:color-mix(in srgb, var(--u-teal) 45%, var(--u-paper))}
[data-act="bell"], [data-act="sound"], [data-act="music"]{--dab:color-mix(in srgb, #FAC957 75%, var(--u-paper))}
[data-act="feed"], [data-cam]{--dab:color-mix(in srgb, var(--u-sea) 42%, var(--u-paper))}
[data-act="coast"], [data-act="auto"]{--dab:color-mix(in srgb, var(--u-teal) 38%, var(--u-paper))}
[data-act="hop"], [data-act="tod"]{--dab:color-mix(in srgb, var(--pb-inkO) 50%, var(--u-paper))}
[data-act="help"], [data-act="lang"]{--dab:color-mix(in srgb, var(--u-mauve) 45%, var(--u-paper))}
.ui-btn:hover{background:var(--u-peach)}
.ui-btn:hover .ico .dab{opacity:1}
.ui-btn:active{background:color-mix(in srgb, var(--pb-inkO) 45%, var(--u-paper)); transform:translateY(2.5px); box-shadow:0 0 0 var(--u-shade)}
.ui-btn:focus{outline:none}
.ui-btn:focus-visible, .ui-range:focus-visible, .ui-check input:focus-visible + span{
  outline:3px solid var(--u-red); outline-offset:3px; box-shadow:0 0 0 2px var(--u-paper), 0 0 0 5px var(--u-ink);
}
/* "on": a warm sunny wash, bold ink, the pip filled scarf-red with a tick */
.ui-btn[aria-pressed="true"], .ui-btn[aria-checked="true"]{background:var(--u-sunwash); box-shadow:inset 0 0 0 2px color-mix(in srgb, #FAC957 60%, var(--u-paper)), 0 2.5px 0 var(--u-shade)}
.ui-btn[aria-pressed="true"]:hover, .ui-btn[aria-checked="true"]:hover{background:var(--u-sun)}
.ui-btn .pip{position:absolute; top:3px; right:3px; width:10px; height:10px; border:1.5px solid currentColor; border-radius:50% 45% 50% 40%; background:var(--u-paper)}
.ui-btn[aria-pressed="true"] .pip, .ui-btn[aria-checked="true"] .pip{background:var(--u-red); border-color:var(--u-ink)}
.ui-btn[aria-pressed="true"] .pip::after, .ui-btn[aria-checked="true"] .pip::after{content:""; position:absolute; left:2px; top:1.5px; width:4px; height:2.2px; border:solid #FFF6EC; border-width:0 0 1.5px 1.5px; rotate:-45deg}
/* key-cap hint on keyboard focus: a little paper tag */
.ui-btn .kbd{position:absolute; top:-11px; left:50%; transform:translateX(-50%) rotate(-3deg); padding:0 5px; font:700 .64rem/15px var(--ui-font);
  background:var(--u-sun); color:var(--u-ink); border:1.5px solid var(--u-ink); border-radius:4px 3px 5px 3px; opacity:0; pointer-events:none; white-space:nowrap; transition:opacity .12s}
.ui-btn:focus-visible .kbd{opacity:1}
/* fired: a soft ink-blot ring blooms out of the button */
.ui-btn.fired::after{content:""; position:absolute; inset:-3px; border:2.5px solid var(--u-red); border-radius:var(--r); animation:ui-stamp .42s ease-out forwards; pointer-events:none}
@keyframes ui-stamp{0%{opacity:.9; transform:scale(.92) rotate(-1deg)}100%{opacity:0; transform:scale(1.2) rotate(1.5deg)}}
.ui-btn.nope{animation:ui-nope .38s}
@keyframes ui-nope{0%,100%{translate:0}20%{translate:-3px}40%{translate:3px}60%{translate:-2px}80%{translate:2px}}
/* the bell swings on the same damped spring the bike bell rings with (ω≈24 rad/s, ζ≈0.18) */
.ui-btn.ring .ico{animation:ui-ring .72s; transform-origin:50% 22%}
@keyframes ui-ring{0%{rotate:0deg}9%{rotate:22deg}22%{rotate:-15deg}35%{rotate:10deg}48%{rotate:-6deg}61%{rotate:3.5deg}74%{rotate:-2deg}100%{rotate:0deg}}
.ui-btn.gulp .ico{animation:ui-gulp .5s}
@keyframes ui-gulp{0%{translate:0 0}30%{translate:3px -4px; rotate:-12deg}60%{translate:6px 1px; scale:.6}61%{translate:-6px 0; scale:.2}100%{translate:0 0; scale:1}}
.ui-btn .cool{position:absolute; left:6px; right:6px; bottom:3px; height:2.5px; border-radius:2px; background:var(--u-red); transform-origin:left; transform:scaleX(0)}
.ui-btn.cooling .cool{animation:ui-cool var(--cd,.95s) linear forwards}
@keyframes ui-cool{from{transform:scaleX(1)}to{transform:scaleX(0)}}

/* expand toggle */
.ui-toggle .ico .glyph{transition:rotate .25s; transform-origin:12px 12px}
.ui-card[data-open="true"] .ui-toggle .ico .glyph{rotate:180deg}

/* ---------- the stitched fold + body ---------- */
.ui-perf{height:4px; margin:8px 2px 0; background:var(--u-ink-soft); -webkit-mask:${STITCH} 0 0 / 14px 4px repeat-x; mask:${STITCH} 0 0 / 14px 4px repeat-x}
.ui-body{padding-top:2px}
.ui-card:not([data-open="true"]) .ui-body, .ui-card:not([data-open="true"]) .ui-perf{display:none}
/* index tabs cut from coloured paper */
.ui-tabs{display:grid; grid-template-columns:repeat(4,1fr); gap:3px; margin:6px 0 0; padding:0 2px; position:relative}
.ui-tabs::after{content:""; position:absolute; left:0; right:0; bottom:0; height:2px; background:var(--u-ink); border-radius:2px}
.ui-tabs .ui-btn{min-height:32px; box-shadow:none; border-width:2px 2px 0; border-radius:12px 9px 0 0 / 10px 8px 0 0; padding:3px 2px 4px; margin-bottom:0}
.ui-tabs .ui-btn::before{inset:-3px -1px 2px -2px; border-bottom:0; border-radius:12px 9px 0 0 / 10px 8px 0 0}
.ui-tabs .ui-btn[data-tab="ride"]{--tab:color-mix(in srgb, var(--pb-inkK) 55%, var(--u-paper))}
.ui-tabs .ui-btn[data-tab="time"]{--tab:color-mix(in srgb, #FAC957 55%, var(--u-paper))}
.ui-tabs .ui-btn[data-tab="view"]{--tab:color-mix(in srgb, var(--u-sea) 30%, var(--u-paper))}
.ui-tabs .ui-btn[data-tab="more"]{--tab:color-mix(in srgb, var(--u-teal) 30%, var(--u-paper))}
.ui-tabs .ui-btn[aria-selected="false"]{background:var(--tab); translate:0 3px}
.ui-tabs .ui-btn[aria-selected="false"]:hover{background:color-mix(in srgb, var(--tab) 70%, var(--pb-inkO)); translate:0 1px}
.ui-tabs .ui-btn[aria-selected="true"]{background:var(--u-paper); z-index:1; box-shadow:0 2px 0 var(--u-paper)}
.ui-tabs .ui-btn[aria-selected="true"] .lab::before{content:""; position:absolute; top:3px; left:7px; width:7px; height:7px; background:var(--u-red); border-radius:50% 45% 50% 40%}
.ui-tabs .ui-btn[aria-selected="true"] .zh{font-size:.9rem}
.ui-sec{display:none; padding:9px 0 2px}
.ui-sec.active{display:block}
.ui-sec-h{display:none; align-items:center; gap:6px; margin:0 0 6px; font-size:.72rem; font-style:italic; font-weight:700}
.ui-sec-h .zh{font-size:.86rem; font-style:normal}
.ui-sec-h::before, .ui-sec-h::after{content:""; height:10px; flex:1; background:var(--u-ink-soft); -webkit-mask:${SWASH} center / 40px 10px no-repeat; mask:${SWASH} center / 40px 10px no-repeat}
.ui-sec-h::after{transform:scaleX(-1)}
.ui-sec-h i{display:none}
.ui-row{display:grid; grid-template-columns:repeat(3,1fr); gap:6px}
.ui-row.two{grid-template-columns:repeat(2,1fr)}
.ui-row.four{grid-template-columns:repeat(4,1fr)}
#ui[data-lang="bi"] .ui-row.four .ui-btn .en{font-size:.6rem}
.ui-field{display:grid; grid-template-columns:auto 1fr; gap:3px 8px; align-items:center; margin-bottom:6px}
.ui-field label{font-size:.78rem; line-height:1.1}
.ui-field label .zh{font-weight:700; font-size:.84rem}
#ui[data-lang="bi"] .ui-field label .en{font-style:italic}
.ui-readout{justify-self:end; font-weight:700; font-size:.78rem; font-variant-numeric:tabular-nums oldstyle-nums; white-space:nowrap}
.ui-field .ui-range, .ui-field .ui-ticks{grid-column:1 / -1}
.ui-todico{display:inline-block; vertical-align:-4px; margin-right:4px}
.ui-todico svg{display:inline-block}
.ui-field .ico{width:18px; height:18px; fill:none; stroke:currentColor; stroke-width:1.9; stroke-linecap:round; overflow:visible}
.ui-field .ico .dab{fill:color-mix(in srgb, #FAC957 70%, var(--u-paper)); stroke:none}

/* sliders: a painted brush-stroke track, a round pebble thumb with a sunny heart */
.ui-range{appearance:none; -webkit-appearance:none; width:100%; height:26px; margin:0; background:transparent; cursor:pointer; touch-action:pan-y}
.ui-range::-webkit-slider-runnable-track{height:10px; border:2px solid var(--u-ink); border-radius:8px 5px 7px 4px / 5px 7px 4px 8px;
  background:linear-gradient(90deg, color-mix(in srgb, var(--pb-inkO) 75%, #FAC957) var(--p,50%), var(--u-paper2) var(--p,50%))}
.ui-range::-moz-range-track{height:6px; background:var(--u-paper2); border:2px solid var(--u-ink); border-radius:6px}
.ui-range::-moz-range-progress{height:6px; background:var(--pb-inkO); border-radius:6px}
.ui-range::-webkit-slider-thumb{-webkit-appearance:none; width:20px; height:20px; margin-top:-7px; border:2px solid var(--u-ink); border-radius:52% 48% 50% 46% / 48% 52% 46% 50%;
  background:radial-gradient(circle at 50% 50%, var(--u-red) 0 3px, transparent 3.5px), radial-gradient(circle at 38% 34%, #fff 0 2px, transparent 5px), var(--u-sunwash);
  box-shadow:0 2px 0 var(--u-shade)}
.ui-range::-moz-range-thumb{width:16px; height:16px; border:2px solid var(--u-ink); border-radius:50%; background:var(--u-sunwash)}
.ui-range:hover::-webkit-slider-thumb{background:radial-gradient(circle, var(--u-red) 0 3px, transparent 3.5px), var(--u-sun)}
.ui-range:active::-webkit-slider-thumb{background:radial-gradient(circle, #FFF6EC 0 3px, transparent 3.5px), var(--u-red)}
/* the time-of-day track is a little painted sky: night · dawn · morning · noon · golden · sunset · dusk · night */
.ui-range.tod::-webkit-slider-runnable-track{background:linear-gradient(90deg,#3b3f78 0,#5b5a98 18%,#e8a3a0 25%,#f7cf9c 31%,#fbeed2 45%,#fff3d9 56%,#f8c77a 67%,#f3a063 74%,#d86a58 79%,#8a5f8e 84%,#3b3f78 92%)}
.ui-ticks{display:flex; justify-content:space-between; font-size:.64rem; font-style:italic; margin-top:-1px; padding:0 2px; position:relative}
.ui-ticks .zh{font-style:normal}
.ui-ticks span{position:relative; padding-top:6px; white-space:nowrap}
.ui-ticks span::before{content:""; position:absolute; top:0; left:50%; width:2px; height:5px; border-radius:1px; background:var(--u-ink); rotate:6deg}
.ui-check{display:flex; align-items:center; gap:8px; font-size:.78rem; cursor:pointer; margin-top:6px}
.ui-check input{position:absolute; opacity:0; width:1px; height:1px}
.ui-check span.box{width:19px; height:19px; border:2px solid var(--u-ink); border-radius:4px 6px 3px 5px; flex:none; display:grid; place-items:center; background:var(--u-paper)}
.ui-check input:checked + span.box{background:var(--u-sunwash)}
.ui-check input:checked + span.box::after{content:""; width:10px; height:5px; border:solid var(--u-red); border-width:0 0 3px 3px; rotate:-48deg; margin-top:-3px; border-radius:1px}
.ui-note{font-size:.74rem; margin:6px 0 0; padding:4px 8px; background:var(--u-sunwash); border:1.5px dashed var(--u-ink-soft); border-radius:8px 5px 9px 6px; line-height:1.3}
.ui-note[hidden]{display:none}
.ui-foot{display:flex; justify-content:space-between; gap:6px; white-space:nowrap; font-size:.6rem; font-style:italic; padding-top:6px; margin-top:6px; position:relative}
.ui-foot::before{content:""; position:absolute; left:0; right:0; top:0; height:6px; background:var(--u-ink-soft); -webkit-mask:${WAVY} 0 0 / 48px 6px repeat-x; mask:${WAVY} 0 0 / 48px 6px repeat-x}
.ui-foot .zh{font-style:normal}

/* ---------- idle hint: a speech bubble from the storybook ---------- */
.ui-hint{position:absolute; left:0; top:0; pointer-events:none; opacity:0; transform:translateY(6px) rotate(-1.5deg); transition:opacity .4s, transform .4s;
  background:var(--u-grain) 0 0 / 180px 180px, var(--u-paper); color:var(--u-ink); border:2px solid var(--u-ink); border-radius:18px 22px 20px 16px / 16px 18px 22px 20px;
  box-shadow:0 4px 0 var(--u-shade); padding:7px 13px 8px; max-width:15.5rem; font-size:.8rem; font-style:italic; line-height:1.25}
.ui-hint.on{opacity:1; transform:rotate(-1.5deg)}
.ui-hint .zh{display:block; font-weight:700; font-size:.9rem; font-style:normal}
.ui-hint svg{position:absolute; left:20px; top:calc(100% - 2px); width:34px; height:30px; fill:none; stroke:var(--u-ink); stroke-width:2.2; stroke-linecap:round; stroke-linejoin:round}
.ui-hint svg .fillp{fill:var(--u-paper); stroke:none}
.ui-hint::before{content:""; position:absolute; top:-7px; right:14px; width:14px; height:14px; background:color-mix(in srgb, #FAC957 80%, var(--u-paper)); border:1.5px solid var(--u-ink); border-radius:50% 45% 50% 40%}

/* ---------- toast (reduced-motion switch etc.): a little paper label ---------- */
.ui-toast{position:absolute; left:50%; top:22px; translate:-50% 0; pointer-events:none; background:var(--u-paper); color:var(--u-ink); padding:6px 14px; border:2px solid var(--u-ink); border-radius:12px 9px 13px 10px; box-shadow:0 3px 0 var(--u-shade); font-size:.8rem; opacity:0; transition:opacity .3s}
.ui-toast.on{opacity:1}

/* ---------- help dialog: a storybook page with a hand-made paper keyboard ---------- */
.ui-help{
  --ui-font:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,"DejaVu Serif",serif;
  --ui-cjk:"LXGW WenKai","Kaiti SC",STKaiti,KaiTi,BiauKai,"Noto Serif CJK SC","Source Han Serif SC","Songti SC","WenQuanYi Zen Hei",serif;
  --u-paper:color-mix(in srgb, var(--pb-inkP) 45%, #FFF3E0);
  --u-paper2:color-mix(in srgb, var(--u-paper) 82%, var(--pb-inkK));
  --u-ink:color-mix(in srgb, var(--pb-inkN) 45%, #4A2C20);
  --u-ink-soft:color-mix(in srgb, var(--u-ink) 38%, transparent);
  --u-shade:color-mix(in srgb, #5a3424 30%, transparent);
  --u-peach:color-mix(in srgb, var(--pb-inkK) 42%, var(--u-paper));
  --u-sun:color-mix(in srgb, #FAC957 70%, var(--pb-inkO));
  --u-sunwash:color-mix(in srgb, #FAC957 52%, var(--u-paper));
  --u-red:var(--pb-inkR); --u-teal:var(--pb-inkT); --u-sea:var(--pb-inkB);
  --u-mauve:color-mix(in srgb, #94777F 70%, var(--pb-inkB));
  --u-wicker:color-mix(in srgb, #C89B5E 80%, var(--pb-inkO));
  --u-grain:${GRAIN};
  font:14px/1.3 var(--ui-font); color:var(--u-ink); border:0; outline:0;
  background:
    radial-gradient(120% 70% at 15% 0%, color-mix(in srgb, #fff 30%, transparent), transparent 60%),
    radial-gradient(140% 120% at 50% 45%, transparent 62%, color-mix(in srgb, #9a5f3c 14%, transparent) 100%),
    var(--u-grain) 0 0 / 180px 180px, var(--u-paper);
  -webkit-mask:var(--ui-deckle, linear-gradient(#000,#000)) 0 0 / 100% 100% no-repeat; mask:var(--ui-deckle, linear-gradient(#000,#000)) 0 0 / 100% 100% no-repeat;
  pointer-events:auto; padding:20px 26px 18px; width:min(48rem,calc(100vw - 32px)); max-height:calc(100dvh - 32px); overflow:auto;
}
.ui-help :lang(zh-CN){font-family:var(--ui-cjk)}
.ui-help::backdrop{background:radial-gradient(ellipse at 50% 45%, color-mix(in srgb, #2b1a24 30%, transparent), color-mix(in srgb, #2b1a24 58%, transparent))}
.ui-help h2{margin:0 0 2px; font-size:1.3rem; font-style:italic; display:flex; gap:10px; align-items:baseline; flex-wrap:wrap}
.ui-help h2 .zh{font-size:1.45rem; font-style:normal; color:var(--u-red)}
.ui-help h2::after{content:""; flex:1 0 60px; align-self:center; height:6px; background:var(--u-ink-soft); -webkit-mask:${WAVY} 0 0 / 48px 6px repeat-x; mask:${WAVY} 0 0 / 48px 6px repeat-x}
.ui-help .try{margin:2px 0 12px; font-size:.82rem; font-style:italic}
.ui-help .try .zh{font-style:normal}
/* the keyboard: a woven-wicker tray (like the bike's basket) holding paper keys */
.ui-kb{display:flex; flex-direction:column; gap:6px; align-items:center; padding:14px 10px 12px; border:2px solid var(--u-ink); border-radius:16px 12px 18px 14px / 12px 16px 12px 18px;
  background:
    repeating-linear-gradient(90deg, transparent 0 9px, color-mix(in srgb, #5a3424 16%, transparent) 9px 10px),
    repeating-linear-gradient(0deg, color-mix(in srgb, #fff 12%, transparent) 0 3px, transparent 3px 7px),
    var(--u-wicker);
  box-shadow:inset 0 -5px 0 color-mix(in srgb, #5a3424 28%, transparent), 0 3px 0 var(--u-shade)}
.ui-kb-row{display:flex; gap:6px}
.ui-kb-row.arrows{margin-top:4px}
.ui-cap{--r:9px 6px 10px 7px / 7px 10px 6px 9px; width:3.7rem; min-height:3.3rem; overflow:hidden; border:2px solid var(--u-ink); border-radius:var(--r); background:var(--u-grain) 0 0 / 180px 180px, var(--u-paper); color:var(--u-ink);
  display:flex; flex-direction:column; justify-content:space-between; padding:2px 5px 3px; box-shadow:0 3px 0 color-mix(in srgb, #3a2014 45%, transparent); font-size:.9rem; font-weight:700; transition:transform .06s, box-shadow .06s, background-color .06s}
.ui-cap:nth-child(2n){--r:6px 10px 7px 9px / 10px 6px 9px 7px; rotate:.8deg}
.ui-cap:nth-child(3n){rotate:-.9deg}
.ui-cap.dim{background:color-mix(in srgb, var(--u-paper) 55%, var(--u-wicker)); opacity:.62}
.ui-cap small{font-size:.62rem; font-weight:700; font-style:italic; line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.ui-cap .face{font-size:1rem; line-height:1}
.ui-cap small.zh{font-size:.68rem; font-style:normal}
.ui-cap.wide{width:19rem; min-height:2.8rem; flex-direction:row; align-items:center; gap:8px; font-style:italic}
.ui-cap.q{width:3.7rem}
.ui-cap.lit{background:var(--u-sun); color:var(--u-ink); transform:translateY(3px); box-shadow:0 0 0 transparent}
.ui-legend{display:grid; grid-template-columns:repeat(auto-fill,minmax(13rem,1fr)); gap:4px 18px; margin:14px 0 0; padding:0; list-style:none; font-size:.82rem}
.ui-legend li{display:flex; gap:8px; align-items:center; border-bottom:1.5px dotted var(--u-ink-soft); padding:3px 0}
.ui-legend kbd{font:700 .76rem var(--ui-font); min-width:1.8rem; text-align:center; padding:1px 6px; background:var(--u-paper2); border:1.5px solid var(--u-ink); border-radius:6px 4px 7px 5px; box-shadow:0 2px 0 var(--u-shade); white-space:nowrap}
.ui-legend .zh{font-weight:700}
.ui-legend .en{font-style:italic}
.ui-gestures{display:none; margin:0; padding:0; list-style:none}
.ui-gestures li{display:flex; gap:10px; align-items:center; padding:6px 0; border-bottom:1.5px dotted var(--u-ink-soft)}
.ui-gestures svg{width:36px; height:36px; flex:none; fill:none; stroke:var(--u-ink); stroke-width:2; stroke-linecap:round; stroke-linejoin:round; overflow:visible; --dab:var(--u-sunwash)}
.ui-help .ui-help-foot{display:flex; justify-content:space-between; align-items:center; gap:12px; margin-top:14px; flex-wrap:wrap}
.ui-help .ui-btn{flex-direction:row; gap:6px; padding:6px 16px}
.ui-help .ui-btn kbd{font:700 .7rem var(--ui-font); padding:0 4px; border:1px solid var(--u-ink-soft); border-radius:4px}
@media (pointer:coarse){ .ui-help .ui-kb, .ui-help .ui-legend, .ui-help .try{display:none} .ui-help .ui-gestures{display:block} }

/* ---------- phones: a bottom sheet (a page sliding up from the bottom of the book) ---------- */
@media (max-width:600px), (max-aspect-ratio:4/5){
  #ui{--ui-inset:8px!important}
  .ui-card, .ui-card[data-dock]{left:8px; right:8px; bottom:calc(8px + env(safe-area-inset-bottom)); top:auto; width:auto; max-width:none}
  .ui-plate{max-height:min(38dvh, max(14rem, calc(var(--ui-room) - 8px))); padding:6px 8px 9px}   /* short sheet: the rider stays visible above it; the body scrolls */
  .ui-card[data-open="true"] .ui-odo{display:none}
  .ui-ribbon{right:14px; height:36px}
  .ui-quick .ui-btn .ico{width:18px; height:18px}
  #ui .ui-quick .ui-btn .en{letter-spacing:0; font-size:.64rem}
  .ui-field{margin-bottom:2px}
  .ui-ticks{margin-top:-6px}
  .ui-grip{display:block; width:48px; height:6px; margin:0 auto 4px; border-radius:4px 3px 4px 3px; background:var(--u-ink-soft); position:relative; cursor:grab; touch-action:none}
  .ui-grip::before{content:""; position:absolute; inset:-14px -30px}
  .ui-head{display:none}
  .ui-frame{padding:2px 2px 0}
  .ui-odo{display:flex; justify-content:space-between; gap:6px; padding:2px 2px 5px}
  .ui-odo-row2{display:contents}
  .ui-odo .ui-state, .ui-meter-lab{display:none}
  .ui-meter{gap:3px}
  .ui-drums.big .ui-drum{width:13px; height:19px}
  .ui-quick{gap:7px; padding-top:5px}
  .ui-quick .ui-btn{flex-direction:row; gap:5px; padding:3px 4px}
  .ui-quick .ui-btn .lab{align-items:flex-start}
  .ui-foot{display:none}
  .ui-under{display:none}
}
@media (max-width:600px) and (pointer:coarse), (pointer:coarse){
  .ui-btn, .ui-tabs .ui-btn{min-height:44px; min-width:44px}
  .ui-range{height:44px}
  .ui-range::-webkit-slider-thumb{width:28px; height:28px; margin-top:-11px}
}
.ui-grip{display:none}
/* compact levels chosen by the dock when the rider fills the frame (close-up, short screens) */
.ui-card[data-level="1"] .ui-head, .ui-card[data-level="2"] .ui-head, .ui-card[data-level="2"] .ui-odo{display:none}
.ui-card[data-level="1"] .ui-odo{display:flex; justify-content:space-between; gap:6px; padding:2px 2px 5px}
.ui-card[data-level="1"] .ui-odo-row2{display:contents}
.ui-card[data-level="1"] .ui-odo .ui-state, .ui-card[data-level="1"] .ui-meter-lab{display:none}
.ui-card[data-level="1"] .ui-meter{gap:3px}
.ui-card[data-level="1"] .ui-drums.big .ui-drum{width:13px; height:19px}
.ui-card[data-level="2"] .ui-quick .ui-btn .ico{display:none}
.ui-card[data-level="2"] .ui-quick{padding-top:2px}
.ui-card[data-level="2"] .ui-quick .ui-btn{min-height:34px}
.ui-card[data-level="1"] .ui-ribbon, .ui-card[data-level="2"] .ui-ribbon{height:30px}

/* ---------- a11y media ---------- */
@media (prefers-reduced-motion:reduce){
  #ui *, #ui *::before, #ui *::after, .ui-help *{animation:none!important; transition:none!important}
}
#ui[data-reduced="true"] *{animation-duration:.01ms!important; transition-duration:.01ms!important}
@media (prefers-contrast:more){
  .ui-btn, .ui-cap{border-width:3px}
  .ui-btn::before{display:none}
  .ui-sub, .ui-btn .en{color:inherit}
  #ui{--u-ink:#2a1610; --u-ink-soft:#2a1610}
}
@media (forced-colors:active){
  .ui-plate, .ui-shadow, .ui-under, .ui-help{-webkit-mask:none; mask:none}
  .ui-shadow, .ui-under, .ui-ribbon{display:none}
  .ui-plate{border:2px solid CanvasText; background:Canvas}
  .ui-btn{border:2px solid ButtonText; forced-color-adjust:auto}
  .ui-btn::before{display:none}
  .ui-btn[aria-pressed="true"], .ui-btn[aria-checked="true"], .ui-btn[aria-selected="true"]{outline:3px solid Highlight}
  .ui-drum, .ui-drums{background:Canvas; color:CanvasText; border:1px solid CanvasText}
  .ui-drum svg{fill:CanvasText}
  .ui-title svg{fill:CanvasText}
  .ui-btn:focus-visible, .ui-range:focus-visible{outline:3px solid Highlight}
}
`;

export function injectStyles(doc = document) {
  if (doc.getElementById('ui-style')) return;
  const el = doc.createElement('style');
  el.id = 'ui-style';
  el.textContent = CSS;
  doc.head.appendChild(el);
}
