// OWNER: ui. The control card's stylesheet (injected once as <style id="ui-style">).
// Style C: a small screen-printed railway ticket / deco control card in the seven inks of the hour. Every colour is a
// CSS variable (--pb-ink{P,K,O,R,B,T,N}) that ui.js copies from the live palette, so the card is re-inked with the scene.
// Rules: paper P face, N key line + inner rule, R accents, N drums with P numerals, K hover, O press, N "on" state.
// Masks use an ink as the opaque layer (mask alpha only). No filters, no blend modes, no gradients except the
// radial-gradient halftone dots and the hard-stop notch/scallop masks.

export const CSS = String.raw`
#ui{
  --ui-font:"Futura","Avenir Next","Century Gothic","Gill Sans","DejaVu Sans",system-ui,sans-serif;
  --ui-cjk:"PingFang SC","Hiragino Sans GB","Noto Sans CJK SC","Source Han Sans SC","Microsoft YaHei","WenQuanYi Zen Hei",sans-serif;
  --ui-w:19.5rem; --ui-inset:28px; --ui-notch:0px; --ui-room:60vh;
  position:fixed; inset:0; pointer-events:none; z-index:10; font:13px/1.25 var(--ui-font); color:var(--pb-inkN);
  -webkit-font-smoothing:antialiased; touch-action:manipulation;
}
#ui *{box-sizing:border-box}
#ui[data-hud="off"] .ui-card, #ui[data-hud="off"] .ui-hint{display:none}
#ui :lang(zh-CN){font-family:var(--ui-cjk)}
#ui .ui-sr{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;margin:-1px;padding:0;border:0}
#ui svg{display:block}

/* ---------- language modes: bi (中文 first, English second) · zh · en ---------- */
#ui[data-lang="zh"] .en, #ui[data-lang="en"] .zh, .ui-help[data-lang="zh"] .en, .ui-help[data-lang="en"] .zh{display:none!important}
#ui .en{font-family:var(--ui-font)}
#ui[data-lang="bi"] .unit-zh{display:none}
#ui[data-lang="bi"] .ui-btn .en{font-size:.62rem; letter-spacing:.04em; text-transform:uppercase; font-weight:700}

/* ---------- the card ---------- */
.ui-card{
  position:absolute; left:var(--ui-inset); bottom:var(--ui-inset); width:var(--ui-w); max-width:calc(100vw - 32px);
  pointer-events:auto; transition:transform .45s cubic-bezier(.2,.9,.25,1.15), opacity .3s;
}
.ui-card[data-dock="right"]{left:auto; right:var(--ui-inset)}
.ui-card[data-dock$="top"]{bottom:auto; top:var(--ui-inset)}
.ui-card[data-dock="right-top"]{left:auto; right:var(--ui-inset)}
/* registration-shifted shadow plate + the paper plate share one mask: two notches at the perforation, scalloped foot */
.ui-plate, .ui-shadow{
  --m:linear-gradient(var(--pb-inkN),var(--pb-inkN));
  -webkit-mask:
    radial-gradient(circle 9px at 0 var(--ui-notch),transparent 8.5px,var(--pb-inkN) 9px),
    radial-gradient(circle 9px at 100% var(--ui-notch),transparent 8.5px,var(--pb-inkN) 9px),
    radial-gradient(circle 4px at 50% 100%,transparent 3.6px,var(--pb-inkN) 4px) bottom / 11px 6px repeat-x,
    var(--m) top / 100% calc(100% - 5px) no-repeat;
  -webkit-mask-composite: source-in, source-in, source-over, source-over;
  mask:
    radial-gradient(circle 9px at 0 var(--ui-notch),transparent 8.5px,var(--pb-inkN) 9px),
    radial-gradient(circle 9px at 100% var(--ui-notch),transparent 8.5px,var(--pb-inkN) 9px),
    radial-gradient(circle 4px at 50% 100%,transparent 3.6px,var(--pb-inkN) 4px) bottom / 11px 6px repeat-x,
    var(--m) top / 100% calc(100% - 5px) no-repeat;
  mask-composite: intersect, intersect, add, add;
}
.ui-card:not([data-open="true"]) .ui-plate, .ui-card:not([data-open="true"]) .ui-shadow{--ui-notch:-40px}
.ui-shadow{position:absolute; inset:0; transform:translate(4px,4px); background:var(--pb-inkN); pointer-events:none}
.ui-plate{
  position:relative; background:var(--pb-inkP); padding:6px 6px 11px;
  max-height:calc(100dvh - 2 * var(--ui-inset)); overflow:hidden; display:flex; flex-direction:column;
}
.ui-frame{border:2px solid var(--pb-inkN); outline:1px solid var(--pb-inkN); outline-offset:-5px; padding:6px; display:flex; flex-direction:column; min-height:0; flex:0 1 auto}
.ui-frame > *{flex:none}
.ui-card[data-up="true"] .ui-body{order:2}
.ui-card[data-up="true"] .ui-perf{order:3; margin-bottom:2px}
.ui-card[data-up="true"] .ui-quick{order:4}
.ui-card[data-up="true"] .ui-note{order:5}
.ui-frame > .ui-body{flex:0 1 auto; min-height:0; overflow:auto; overscroll-behavior:contain; scrollbar-width:thin}

/* header band: N plate, P glyph lettering, R seal, B halftone fringe */
.ui-head{
  display:flex; align-items:center; gap:8px; background:var(--pb-inkN); color:var(--pb-inkP);
  margin:-6px -6px 0; padding:7px 9px 11px; position:relative;
}
.ui-head::after{
  content:""; position:absolute; left:0; right:0; bottom:0; height:6px;
  background:radial-gradient(circle,var(--pb-inkB) 1.1px,transparent 1.5px) 0 0/5px 5px, var(--pb-inkN);
}
.ui-seal{flex:none; width:44px; height:21px; background:var(--pb-inkR); border:1.5px solid var(--pb-inkP); outline:1px solid var(--pb-inkR); padding:2px 3px}
.ui-seal svg, .ui-wordmark svg{width:100%; height:100%; fill:currentColor}
.ui-wordmark{flex:1; min-width:0}
.ui-wordmark svg{height:13px; width:auto}
.ui-sub{display:block; margin-top:3px; font-size:.6rem; letter-spacing:.14em; text-transform:uppercase; color:var(--pb-inkK); white-space:nowrap}
.ui-serial{flex:none; font-size:.6rem; letter-spacing:.06em; text-align:right; color:var(--pb-inkK); line-height:1.2}
.ui-serial b{display:block; color:var(--pb-inkP); font-size:.72rem; letter-spacing:.1em}

/* ticket guilloche band */
.ui-guil{width:calc(100% + 12px); height:8px; margin:3px -6px 0; fill:none; stroke-width:.8; vector-effect:non-scaling-stroke}
.ui-guil path{vector-effect:non-scaling-stroke; stroke-width:.9}
.ui-card[data-level="1"] .ui-guil, .ui-card[data-level="2"] .ui-guil{display:none}
@media (max-width:600px), (max-aspect-ratio:4/5){ .ui-guil{display:none} }
/* ---------- odometer: mechanical drums ---------- */
.ui-odo{display:grid; grid-template-columns:1fr auto; gap:6px 10px; align-items:center; padding:8px 2px 6px; border-bottom:1.5px solid var(--pb-inkN)}
.ui-meter{display:flex; align-items:center; gap:6px}
.ui-meter-lab{font-size:.62rem; line-height:1.1; letter-spacing:.06em; text-transform:uppercase}
.ui-meter-lab .zh{display:block; font-size:.72rem; letter-spacing:.02em; font-weight:700}
.ui-drums{display:flex; align-items:stretch; gap:1px; padding:2px; background:var(--pb-inkN); border-radius:2px; box-shadow:inset 0 0 0 1px var(--pb-inkN), 0 0 0 1.5px var(--pb-inkO)}
.ui-drums.big .ui-drum{width:17px; height:25px}
.ui-drum{position:relative; width:12px; height:18px; overflow:hidden; background:var(--pb-inkN); color:var(--pb-inkP)}
.ui-drum.red{background:var(--pb-inkR); color:var(--pb-inkP)}
.ui-drum svg{width:100%; height:100%; fill:currentColor; overflow:hidden}
.ui-drum .ui-reel{transition:transform .1s linear}
.ui-drum.snap .ui-reel{transition:transform .22s cubic-bezier(.3,1.4,.5,1)}
/* cylinder shading as printed halftone: dots at the top and bottom edges of each drum */
.ui-drum::before, .ui-drum::after{content:""; position:absolute; left:0; right:0; height:5px; pointer-events:none;
  background:radial-gradient(circle,var(--pb-inkB) .9px,transparent 1.2px) 0 0/3px 3px}
.ui-drum::before{top:0} .ui-drum::after{bottom:0}
.ui-drum.red::before, .ui-drum.red::after{background-image:radial-gradient(circle,var(--pb-inkN) .8px,transparent 1.1px)}
.ui-dot{width:4px; align-self:flex-end; margin:0 1px 3px; height:4px; background:var(--pb-inkP); border-radius:50%}
.ui-unit{font-size:.62rem; letter-spacing:.06em; margin-left:2px; white-space:nowrap}
.ui-odo-row2{grid-column:1 / -1; display:flex; gap:14px; justify-content:space-between}
.ui-odo .ui-state{font-size:.6rem; text-align:right; letter-spacing:.08em; text-transform:uppercase; line-height:1.15}
.ui-odo .ui-state .zh{display:block; font-size:.7rem; letter-spacing:0; font-weight:700}
.ui-lamp{display:inline-block; width:8px; height:8px; border-radius:50%; border:1.5px solid var(--pb-inkN); margin-right:4px; vertical-align:-1px; background:var(--pb-inkP)}
[data-playing="true"] .ui-lamp.run{background:var(--pb-inkT)}
[data-coasting="true"] .ui-lamp.run{background:var(--pb-inkO)}

/* ---------- buttons ---------- */
.ui-quick{display:grid; grid-template-columns:repeat(4,1fr); gap:5px; padding:7px 0 2px}
.ui-btn{
  appearance:none; font:inherit; color:var(--pb-inkN); background:var(--pb-inkP); border:2px solid var(--pb-inkN);
  border-radius:3px; padding:4px 4px; min-height:36px; min-width:0; cursor:pointer; position:relative;
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px; text-align:center;
  box-shadow:2px 2px 0 var(--pb-inkN); transition:transform .08s, box-shadow .08s, background-color .12s;
  -webkit-tap-highlight-color:transparent; touch-action:manipulation; overflow-wrap:break-word; hyphens:auto;
}
.ui-btn .ico{width:20px; height:20px; flex:none; fill:none; stroke:currentColor; stroke-width:1.9; stroke-linecap:round; stroke-linejoin:round}
.ui-btn .lab{display:flex; flex-direction:column; align-items:center; min-width:0}
.ui-btn .zh{font-weight:700; font-size:.78rem; line-height:1.1}
#ui[data-lang="bi"] .zh + .en{margin-left:.3em}
#ui[data-lang="bi"] .ui-btn .zh + .en{margin-left:0}
.ui-btn .en{font-size:.72rem; line-height:1.1}
#ui[data-lang="en"] .ui-btn .en{font-weight:700; font-size:.74rem}
.ui-btn.row{flex-direction:row; gap:6px; justify-content:flex-start; padding:4px 8px; text-align:left}
.ui-btn.row .lab{align-items:flex-start}
.ui-btn:hover{background:var(--pb-inkK)}
.ui-btn:active{background:var(--pb-inkO); transform:translate(2px,2px); box-shadow:0 0 0 var(--pb-inkN)}
.ui-btn:focus{outline:none}
.ui-btn:focus-visible, .ui-range:focus-visible, .ui-check input:focus-visible + span{
  outline:3px solid var(--pb-inkR); outline-offset:2px; box-shadow:0 0 0 2px var(--pb-inkP), 0 0 0 5px var(--pb-inkN);
}
.ui-btn[aria-pressed="true"], .ui-btn[aria-checked="true"], .ui-btn[aria-selected="true"]{background:var(--pb-inkN); color:var(--pb-inkP); box-shadow:2px 2px 0 var(--pb-inkR)}
.ui-btn[aria-pressed="true"]:hover, .ui-btn[aria-checked="true"]:hover{background:var(--pb-inkB)}
/* state indicator lamp (so "on" is never colour-only): hollow ring off, filled + tick on */
.ui-btn .pip{position:absolute; top:3px; right:3px; width:8px; height:8px; border:1.5px solid currentColor; border-radius:50%}
.ui-btn[aria-pressed="true"] .pip, .ui-btn[aria-checked="true"] .pip{background:var(--pb-inkO); border-color:var(--pb-inkO)}
/* key-cap hint on keyboard focus */
.ui-btn .kbd{position:absolute; top:-9px; left:50%; transform:translateX(-50%); padding:0 4px; font:700 .6rem/14px var(--ui-font);
  background:var(--pb-inkN); color:var(--pb-inkP); border:1px solid var(--pb-inkP); border-radius:2px; opacity:0; pointer-events:none; white-space:nowrap; transition:opacity .12s}
.ui-btn:focus-visible .kbd{opacity:1}
/* fired: an inked stamp pops out of the button */
.ui-btn.fired::after{content:""; position:absolute; inset:-2px; border:2px solid var(--pb-inkR); border-radius:4px; animation:ui-stamp .42s ease-out forwards; pointer-events:none}
@keyframes ui-stamp{0%{opacity:1; transform:scale(.9)}100%{opacity:0; transform:scale(1.22)}}
.ui-btn.nope{animation:ui-nope .38s}
@keyframes ui-nope{0%,100%{translate:0}20%{translate:-3px}40%{translate:3px}60%{translate:-2px}80%{translate:2px}}
/* the bell swings on the same damped spring the bike bell rings with (ω≈24 rad/s, ζ≈0.18) */
.ui-btn.ring .ico{animation:ui-ring .72s; transform-origin:50% 22%}
@keyframes ui-ring{0%{rotate:0deg}9%{rotate:22deg}22%{rotate:-15deg}35%{rotate:10deg}48%{rotate:-6deg}61%{rotate:3.5deg}74%{rotate:-2deg}100%{rotate:0deg}}
.ui-btn.gulp .ico{animation:ui-gulp .5s}
@keyframes ui-gulp{0%{translate:0 0}30%{translate:3px -4px; rotate:-12deg}60%{translate:6px 1px; scale:.6}61%{translate:-6px 0; scale:.2}100%{translate:0 0; scale:1}}
.ui-btn .cool{position:absolute; left:4px; right:4px; bottom:3px; height:2px; background:var(--pb-inkR); transform-origin:left; transform:scaleX(0)}
.ui-btn.cooling .cool{animation:ui-cool var(--cd,.95s) linear forwards}
@keyframes ui-cool{from{transform:scaleX(1)}to{transform:scaleX(0)}}

/* expand toggle */
.ui-toggle .ico{transition:rotate .25s}
.ui-card[data-open="true"] .ui-toggle .ico{rotate:180deg}

/* ---------- perforation + body ---------- */
.ui-perf{height:0; border-top:2px dashed var(--pb-inkN); margin:8px -6px 0}
.ui-body{padding-top:4px}
.ui-card:not([data-open="true"]) .ui-body, .ui-card:not([data-open="true"]) .ui-perf{display:none}
.ui-tabs{display:grid; grid-template-columns:repeat(4,1fr); gap:0; margin:6px 0 0; border-bottom:2px solid var(--pb-inkN)}
.ui-tabs .ui-btn{min-height:30px; box-shadow:none; border-width:2px 1px 0; border-radius:4px 4px 0 0; padding:3px 2px; margin-bottom:-2px; border-bottom:2px solid var(--pb-inkN)}
.ui-tabs .ui-btn:first-child{border-left-width:2px} .ui-tabs .ui-btn:last-child{border-right-width:2px}
.ui-tabs .ui-btn[aria-selected="true"]{background:var(--pb-inkP); color:var(--pb-inkN); border-bottom-color:var(--pb-inkP); box-shadow:none}
.ui-tabs .ui-btn[aria-selected="true"]::before{content:""; position:absolute; top:2px; left:50%; width:5px; height:5px; background:var(--pb-inkR); rotate:45deg; translate:-50% 0}
.ui-tabs .ui-btn[aria-selected="false"]{background:var(--pb-inkK)}
.ui-tabs .ui-btn[aria-selected="false"]:hover{background:var(--pb-inkO)}
.ui-sec{display:none; padding:8px 0 2px}
.ui-sec.active{display:block}
.ui-sec-h{display:none; align-items:center; gap:6px; margin:0 0 6px; font-size:.64rem; letter-spacing:.16em; text-transform:uppercase; font-weight:700}
.ui-sec-h .zh{font-size:.8rem; letter-spacing:.1em}
.ui-sec-h::before, .ui-sec-h::after{content:""; height:2px; flex:1; background:var(--pb-inkN)}
.ui-sec-h::before{flex:0 0 10px}
.ui-sec-h i{width:6px; height:6px; background:var(--pb-inkR); rotate:45deg; flex:none}
.ui-row{display:grid; grid-template-columns:repeat(3,1fr); gap:5px}
.ui-row.two{grid-template-columns:repeat(2,1fr)}
.ui-field{display:grid; grid-template-columns:auto 1fr; gap:3px 8px; align-items:center; margin-bottom:6px}
.ui-field label{font-size:.72rem; line-height:1.1}
.ui-field label .zh{font-weight:700}
.ui-readout{justify-self:end; font-weight:700; font-size:.74rem; font-variant-numeric:tabular-nums; white-space:nowrap}
.ui-field .ui-range, .ui-field .ui-ticks{grid-column:1 / -1}
.ui-todico{display:inline-block; vertical-align:-4px; margin-right:4px}
.ui-todico svg{display:inline-block}
.ui-field .ico{width:18px; height:18px; fill:none; stroke:currentColor; stroke-width:1.9; stroke-linecap:round}

/* sliders: an N rule with an amber pedal-block thumb */
.ui-range{appearance:none; -webkit-appearance:none; width:100%; height:24px; margin:0; background:transparent; cursor:pointer; touch-action:pan-y}
.ui-range::-webkit-slider-runnable-track{height:10px; background:linear-gradient(90deg,var(--pb-inkO) var(--p,50%),var(--pb-inkP) var(--p,50%)); border:2px solid var(--pb-inkN); border-radius:3px}
.ui-range::-moz-range-track{height:6px; background:var(--pb-inkP); border:2px solid var(--pb-inkN); border-radius:3px}
.ui-range::-moz-range-progress{height:6px; background:var(--pb-inkO)}
.ui-range::-webkit-slider-thumb{-webkit-appearance:none; width:16px; height:20px; margin-top:-7px; background:var(--pb-inkN); border:2px solid var(--pb-inkP); border-radius:2px; box-shadow:0 0 0 1.5px var(--pb-inkN), inset 0 -6px 0 var(--pb-inkR)}
.ui-range::-moz-range-thumb{width:14px; height:18px; background:var(--pb-inkN); border:2px solid var(--pb-inkP); border-radius:2px}
.ui-range:hover::-webkit-slider-thumb{background:var(--pb-inkB)}
.ui-range:active::-webkit-slider-thumb{background:var(--pb-inkR)}
.ui-range.tod::-webkit-slider-runnable-track{background:linear-gradient(90deg,var(--pb-inkN) 0 20%,var(--pb-inkR) 20% 30%,var(--pb-inkK) 30% 62%,var(--pb-inkO) 62% 76%,var(--pb-inkR) 76% 82%,var(--pb-inkN) 82%)}
.ui-ticks{display:flex; justify-content:space-between; font-size:.56rem; letter-spacing:.04em; margin-top:-2px; padding:0 2px; position:relative}
.ui-ticks span{position:relative; padding-top:5px; white-space:nowrap}
.ui-ticks span::before{content:""; position:absolute; top:0; left:50%; width:1.5px; height:4px; background:var(--pb-inkN)}
.ui-check{display:flex; align-items:center; gap:8px; font-size:.72rem; cursor:pointer; margin-top:6px}
.ui-check input{position:absolute; opacity:0; width:1px; height:1px}
.ui-check span.box{width:18px; height:18px; border:2px solid var(--pb-inkN); border-radius:2px; flex:none; display:grid; place-items:center; background:var(--pb-inkP)}
.ui-check input:checked + span.box{background:var(--pb-inkN)}
.ui-check input:checked + span.box::after{content:""; width:8px; height:4px; border:solid var(--pb-inkP); border-width:0 0 2.5px 2.5px; rotate:-45deg; margin-top:-2px}
.ui-note{font-size:.66rem; margin:6px 0 0; padding:3px 6px; border:1.5px dashed var(--pb-inkN); line-height:1.3}
.ui-note[hidden]{display:none}
.ui-foot{display:flex; justify-content:space-between; gap:6px; font-size:.56rem; letter-spacing:.12em; text-transform:uppercase; padding-top:6px; border-top:1px solid var(--pb-inkN); margin-top:4px}

/* ---------- idle hint: a small printed tag with a hand-drawn arrow ---------- */
.ui-hint{position:absolute; left:0; top:0; pointer-events:none; opacity:0; transform:translateY(6px); transition:opacity .4s, transform .4s;
  background:var(--pb-inkP); color:var(--pb-inkN); border:2px solid var(--pb-inkN); box-shadow:3px 3px 0 var(--pb-inkN); padding:5px 9px 6px; max-width:15rem; font-size:.74rem; line-height:1.25}
.ui-hint.on{opacity:1; transform:none}
.ui-hint .zh{display:block; font-weight:700; font-size:.82rem}
.ui-hint svg{position:absolute; left:18px; top:100%; width:34px; height:30px; fill:none; stroke:var(--pb-inkN); stroke-width:2.2; stroke-linecap:round}
.ui-hint::before{content:""; position:absolute; top:-2px; right:-2px; width:12px; height:12px; background:var(--pb-inkR); clip-path:polygon(0 0,100% 0,100% 100%)}

/* ---------- toast (reduced-motion switch etc.) ---------- */
.ui-toast{position:absolute; left:50%; top:22px; translate:-50% 0; pointer-events:none; background:var(--pb-inkN); color:var(--pb-inkP); padding:5px 12px; border:2px solid var(--pb-inkP); outline:2px solid var(--pb-inkN); font-size:.74rem; opacity:0; transition:opacity .3s}
.ui-toast.on{opacity:1}

/* ---------- help dialog: an inked keyboard ---------- */
.ui-help{
  --ui-font:"Futura","Avenir Next","Century Gothic","Gill Sans","DejaVu Sans",system-ui,sans-serif;
  --ui-cjk:"PingFang SC","Hiragino Sans GB","Noto Sans CJK SC","Source Han Sans SC","Microsoft YaHei","WenQuanYi Zen Hei",sans-serif;
  font:13px/1.3 var(--ui-font); color:var(--pb-inkN); background:var(--pb-inkP); border:3px solid var(--pb-inkN); outline:1.5px solid var(--pb-inkN); outline-offset:-8px;
  pointer-events:auto; padding:18px 22px 16px; width:min(48rem,calc(100vw - 32px)); max-height:calc(100dvh - 32px); overflow:auto; box-shadow:6px 6px 0 var(--pb-inkN);
}
.ui-help :lang(zh-CN){font-family:var(--ui-cjk)}
.ui-help::backdrop{background:radial-gradient(circle,var(--pb-inkN) 1.3px,transparent 1.8px) 0 0/6px 6px}
.ui-help h2{margin:0 0 2px; font-size:1.05rem; letter-spacing:.14em; text-transform:uppercase; display:flex; gap:10px; align-items:baseline; flex-wrap:wrap}
.ui-help h2 .zh{font-size:1.2rem; letter-spacing:.12em}
.ui-help .try{margin:0 0 12px; font-size:.74rem}
.ui-kb{display:flex; flex-direction:column; gap:5px; align-items:center; padding:12px 8px 10px; background:var(--pb-inkB); border:2px solid var(--pb-inkN); border-radius:6px; box-shadow:inset 0 -5px 0 var(--pb-inkN)}
.ui-kb-row{display:flex; gap:5px}
.ui-kb-row.arrows{margin-top:4px}
.ui-cap{width:3.7rem; min-height:3.3rem; overflow:hidden; border:2px solid var(--pb-inkN); border-radius:4px; background:var(--pb-inkP); color:var(--pb-inkN); display:flex; flex-direction:column; justify-content:space-between; padding:2px 4px 3px; box-shadow:0 3px 0 var(--pb-inkN); font-size:.8rem; font-weight:700; transition:transform .06s, box-shadow .06s, background-color .06s}
.ui-cap.dim{background:var(--pb-inkB); color:var(--pb-inkN); border-color:var(--pb-inkN); box-shadow:0 3px 0 var(--pb-inkN); opacity:.55}
.ui-cap small{font-size:.56rem; font-weight:700; line-height:1.1; letter-spacing:.02em; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.ui-cap .face{font-size:.95rem; line-height:1}
.ui-cap small.zh{font-size:.62rem}
.ui-cap.wide{width:19rem; min-height:2.8rem; flex-direction:row; align-items:center; gap:8px}
.ui-cap.q{width:3.7rem}
.ui-cap.lit{background:var(--pb-inkR); color:var(--pb-inkP); transform:translateY(3px); box-shadow:0 0 0 var(--pb-inkN)}
.ui-legend{display:grid; grid-template-columns:repeat(auto-fill,minmax(13rem,1fr)); gap:4px 16px; margin:12px 0 0; padding:0; list-style:none; font-size:.76rem}
.ui-legend li{display:flex; gap:8px; align-items:center; border-bottom:1px dotted var(--pb-inkN); padding:2px 0}
.ui-legend kbd{font:700 .7rem var(--ui-font); min-width:1.7rem; text-align:center; padding:1px 5px; border:1.5px solid var(--pb-inkN); border-radius:3px; box-shadow:0 2px 0 var(--pb-inkN); white-space:nowrap}
.ui-legend .zh{font-weight:700}
.ui-gestures{display:none; margin:0; padding:0; list-style:none}
.ui-gestures li{display:flex; gap:10px; align-items:center; padding:6px 0; border-bottom:1px dotted var(--pb-inkN)}
.ui-gestures svg{width:34px; height:34px; flex:none; fill:none; stroke:var(--pb-inkN); stroke-width:2; stroke-linecap:round; stroke-linejoin:round}
.ui-help .ui-help-foot{display:flex; justify-content:space-between; align-items:center; gap:12px; margin-top:12px; flex-wrap:wrap}
.ui-help .ui-btn{flex-direction:row; gap:6px; padding:6px 14px}
@media (pointer:coarse){ .ui-help .ui-kb, .ui-help .ui-legend, .ui-help .try{display:none} .ui-help .ui-gestures{display:block} }

/* ---------- phones: a bottom sheet ---------- */
@media (max-width:600px), (max-aspect-ratio:4/5){
  #ui{--ui-inset:8px!important}
  .ui-card, .ui-card[data-dock]{left:8px; right:8px; bottom:calc(8px + env(safe-area-inset-bottom)); top:auto; width:auto; max-width:none}
  .ui-plate{max-height:max(16rem, calc(var(--ui-room) - 8px)); padding:4px 6px 10px}
  .ui-card[data-open="true"] .ui-odo{display:none}
  .ui-quick .ui-btn .ico{width:16px; height:16px}
  #ui .ui-quick .ui-btn .en{letter-spacing:0; font-size:.58rem}
  .ui-field{margin-bottom:2px}
  .ui-ticks{margin-top:-8px}
  .ui-grip{display:block; width:44px; height:5px; margin:0 auto 5px; border-radius:3px; background:var(--pb-inkP); position:relative; cursor:grab; touch-action:none}
  .ui-grip::before{content:""; position:absolute; inset:-14px -30px}
  .ui-head{display:none}
  .ui-frame{padding:4px 6px 6px}
  .ui-odo{display:flex; justify-content:space-between; gap:6px; padding:2px 0 5px}
  .ui-odo-row2{display:contents}
  .ui-odo .ui-state, .ui-meter-lab{display:none}
  .ui-meter{gap:3px}
  .ui-drums.big .ui-drum{width:13px; height:19px}
  .ui-quick{gap:6px; padding-top:5px}
  .ui-quick .ui-btn{flex-direction:row; gap:5px; padding:3px 4px}
  .ui-quick .ui-btn .lab{align-items:flex-start}
  .ui-foot{display:none}
}
@media (max-width:600px) and (pointer:coarse), (pointer:coarse){
  .ui-btn{min-height:44px; min-width:44px}
  .ui-range{height:44px}
  .ui-range::-webkit-slider-thumb{width:24px; height:28px; margin-top:-11px}
}
.ui-grip{display:none}
/* compact levels chosen by the dock when the rider fills the frame (close-up, short screens) */
.ui-card[data-level="1"] .ui-head, .ui-card[data-level="2"] .ui-head, .ui-card[data-level="2"] .ui-odo{display:none}
.ui-card[data-level="1"] .ui-odo{display:flex; justify-content:space-between; gap:6px; padding:2px 0 5px}
.ui-card[data-level="1"] .ui-odo-row2{display:contents}
.ui-card[data-level="1"] .ui-odo .ui-state, .ui-card[data-level="1"] .ui-meter-lab{display:none}
.ui-card[data-level="1"] .ui-meter{gap:3px}
.ui-card[data-level="1"] .ui-drums.big .ui-drum{width:13px; height:19px}
.ui-card[data-level="2"] .ui-quick .ui-btn .ico{display:none}
.ui-card[data-level="2"] .ui-quick{padding-top:0}
.ui-card[data-level="2"] .ui-quick .ui-btn{min-height:34px}

/* ---------- a11y media ---------- */
@media (prefers-reduced-motion:reduce){
  #ui *, #ui *::before, #ui *::after, .ui-help *{animation:none!important; transition:none!important}
}
#ui[data-reduced="true"] *{animation-duration:.01ms!important; transition-duration:.01ms!important}
@media (prefers-contrast:more){
  .ui-btn, .ui-cap{border-width:3px}
  .ui-btn .en, .ui-sub, .ui-serial{color:inherit}
  .ui-drum::before, .ui-drum::after{display:none}
}
@media (forced-colors:active){
  .ui-plate, .ui-shadow{-webkit-mask:none; mask:none}
  .ui-shadow{display:none}
  .ui-plate{border:2px solid CanvasText; background:Canvas}
  .ui-btn{border:2px solid ButtonText; forced-color-adjust:auto}
  .ui-btn[aria-pressed="true"], .ui-btn[aria-checked="true"], .ui-btn[aria-selected="true"]{outline:3px solid Highlight}
  .ui-drum, .ui-drums{background:Canvas; color:CanvasText; border:1px solid CanvasText}
  .ui-drum svg{fill:CanvasText}
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
