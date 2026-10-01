// OWNER: ui. The control card's stylesheet (injected once as <style id="ui-style">).
// Style X (docs/STYLE-X.md §8): the courier's translucent HUD terminal — a void glass panel with static scanlines,
// hairline cyan keylines, cyan / magenta corner brackets, a monospace readout face (DejaVu Sans Mono and friends) and a
// bold display face (DejaVu Sans Bold and friends) — all system fonts; the wordmarks are path glyphs from print-glyphs.
// Neon is emissive: the UI colours are FIXED (they do not follow the city mood), so the contrast is the same at every
// hour. Small text uses the lifted tints (--ui-magT, --ui-dim) that keep ≥ 4.5:1 on the panel over any scene pixel
// (panel alpha .88 over pure white still gives L ≤ .03). Glow = box-shadow / text-shadow on the UI only (it repaints
// only on interaction, never per frame); no CSS / SVG filters, no backdrop-filter, no blend modes.
// State is never colour-only: pressed toggles fill their pip square and gain a double keyline; the selected tab and
// camera get a notch + underline; focus is a 2 px acid ring with a void halo.

export const CSS = String.raw`
#ui, .ui-help{
  --ui-void:#07060F; --ui-night:#141029; --ui-night2:#261A45; --ui-steel:#3A3F5C; --ui-haze:#5B3F7A;
  --ui-cyan:#19E6FF; --ui-cyanT:#7FF2FF; --ui-cyanCore:#D8FBFF; --ui-mag:#FF2E88; --ui-magT:#FF7AB6; --ui-acid:#C6FF3D; --ui-amber:#FFB547;
  --ui-plume:#EEEBF7; --ui-dim:#B3ADD3; --ui-line:rgba(25,230,255,.5); --ui-line2:rgba(25,230,255,.28);
  --ui-panel:rgba(10,8,26,.88); --ui-cell:rgba(24,19,50,.78); --ui-glowC:rgba(25,230,255,.45); --ui-glowM:rgba(255,46,136,.5);
  --ui-scan:repeating-linear-gradient(0deg,rgba(25,230,255,.045) 0 1px,transparent 1px 3px);
  --ui-mono:"DejaVu Sans Mono","SFMono-Regular","JetBrains Mono","Cascadia Mono",Menlo,Consolas,ui-monospace,monospace;
  --ui-font:"DejaVu Sans","Segoe UI","Helvetica Neue",Arial,system-ui,sans-serif;
  --ui-cjk:"PingFang SC","Hiragino Sans GB","Noto Sans CJK SC","Source Han Sans SC","Microsoft YaHei","WenQuanYi Zen Hei",sans-serif;
}
#ui{
  --ui-w:19.5rem; --ui-inset:28px; --ui-room:60vh;
  position:fixed; inset:0; pointer-events:none; z-index:10; font:12.5px/1.25 var(--ui-font); color:var(--ui-plume);
  -webkit-font-smoothing:antialiased; touch-action:manipulation;
}
#ui *{box-sizing:border-box}
#ui[data-hud="off"] .ui-card, #ui[data-hud="off"] .ui-hint, #ui[data-hud="off"] .ui-eggs{display:none}
#ui :lang(zh-CN){font-family:var(--ui-cjk)}
#ui .ui-sr{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;margin:-1px;padding:0;border:0}
#ui svg{display:block}

/* ---------- language modes: bi (中文 first, English second) · zh · en ---------- */
#ui[data-lang="zh"] .en, #ui[data-lang="en"] .zh, .ui-help[data-lang="zh"] .en, .ui-help[data-lang="en"] .zh{display:none!important}
#ui .en{font-family:var(--ui-font)}
#ui[data-lang="bi"] .unit-zh{display:none}
#ui[data-lang="bi"] .ui-btn .en{font:700 .58rem/1.1 var(--ui-mono); letter-spacing:.06em; text-transform:uppercase}

/* ---------- the card: a translucent HUD panel ---------- */
.ui-card{
  position:absolute; left:var(--ui-inset); bottom:var(--ui-inset); width:var(--ui-w); max-width:calc(100vw - 32px);
  pointer-events:auto; transition:transform .4s cubic-bezier(.2,.9,.25,1.1), opacity .3s;
}
.ui-card[data-dock="right"]{left:auto; right:var(--ui-inset)}
.ui-card[data-dock$="top"]{bottom:auto; top:var(--ui-inset)}
.ui-card[data-dock="right-top"]{left:auto; right:var(--ui-inset)}
/* the bracket frame: four neon L's just outside the glass (cyan TL/BR, magenta TR/BL) + edge ticks, static */
.ui-shadow{
  position:absolute; inset:-5px; pointer-events:none;
  --c:var(--ui-cyan); --m:var(--ui-mag);
  background:
    linear-gradient(var(--c),var(--c)) 0 0/18px 2px no-repeat, linear-gradient(var(--c),var(--c)) 0 0/2px 18px no-repeat,
    linear-gradient(var(--m),var(--m)) 100% 0/18px 2px no-repeat, linear-gradient(var(--m),var(--m)) 100% 0/2px 18px no-repeat,
    linear-gradient(var(--m),var(--m)) 0 100%/18px 2px no-repeat, linear-gradient(var(--m),var(--m)) 0 100%/2px 18px no-repeat,
    linear-gradient(var(--c),var(--c)) 100% 100%/18px 2px no-repeat, linear-gradient(var(--c),var(--c)) 100% 100%/2px 18px no-repeat,
    linear-gradient(var(--ui-line2),var(--ui-line2)) 50% 0/40px 1px no-repeat, linear-gradient(var(--ui-line2),var(--ui-line2)) 50% 100%/40px 1px no-repeat;
}
.ui-plate{
  position:relative; padding:0; max-height:calc(100dvh - 2 * var(--ui-inset)); overflow:hidden; display:flex; flex-direction:column;
  background:var(--ui-scan), linear-gradient(180deg,rgba(24,16,52,.9),rgba(8,6,20,.9) 60%), var(--ui-panel);
  border:1px solid var(--ui-line);
  box-shadow:0 0 0 1px rgba(7,6,15,.85), 0 0 22px rgba(25,230,255,.16), 0 10px 30px rgba(7,6,15,.55), inset 0 0 28px rgba(255,46,136,.07), inset 0 1px 0 rgba(216,251,255,.18);
}
/* the side rail: a magenta data spine down the left edge */
.ui-plate::before{content:""; position:absolute; left:0; top:12px; bottom:12px; width:2px; background:linear-gradient(var(--ui-mag),var(--ui-mag)) 0 0/2px 34% no-repeat, repeating-linear-gradient(180deg,rgba(255,46,136,.55) 0 3px,transparent 3px 7px); pointer-events:none}
.ui-frame{padding:8px 10px 8px 12px; display:flex; flex-direction:column; min-height:0; flex:0 1 auto}
.ui-frame > *{flex:none}
.ui-card[data-up="true"] .ui-body{order:2}
.ui-card[data-up="true"] .ui-perf{order:3; margin-bottom:2px}
.ui-card[data-up="true"] .ui-quick{order:4}
.ui-card[data-up="true"] .ui-note{order:5}
.ui-frame > .ui-body{flex:0 1 auto; min-height:0; overflow:auto; overscroll-behavior:contain; scrollbar-width:thin; scrollbar-color:var(--ui-cyan) transparent}

/* header: 鹈鹕外卖 tag · PELICAN EXPRESS wordmark · courier id */
.ui-head{display:flex; align-items:center; gap:8px; padding:1px 0 6px; position:relative}
.ui-head::after{content:""; position:absolute; left:0; right:0; bottom:0; height:1px; background:linear-gradient(90deg,var(--ui-cyan),rgba(255,46,136,.8) 55%,transparent)}
.ui-seal{flex:none; height:22px; padding:3px 5px; background:var(--ui-mag); color:var(--ui-void); box-shadow:0 0 10px var(--ui-glowM), inset 0 0 0 1px rgba(255,211,231,.6)}
.ui-seal svg, .ui-wordmark svg{height:100%; width:auto; fill:currentColor}
.ui-wordmark{flex:1; min-width:0; color:var(--ui-plume)}
.ui-wordmark svg{height:11px; width:auto; overflow:visible}
.ui-wordmark .ui-wm-c{fill:var(--ui-cyan); opacity:.55}
.ui-sub{display:block; margin-top:4px; font:700 .54rem/1 var(--ui-mono); letter-spacing:.16em; text-transform:uppercase; color:var(--ui-cyanT); white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
#ui .ui-sub .zh{font-weight:700; letter-spacing:.08em}
#ui .ui-sub .en{font-family:var(--ui-mono)}
#ui[data-lang="bi"] .ui-sub .zh + .en{margin-left:.5em}
.ui-serial{flex:none; font:700 .52rem/1.2 var(--ui-mono); letter-spacing:.1em; text-align:right; color:var(--ui-dim)}
.ui-serial b{display:block; color:var(--ui-acid); font-size:.8rem; letter-spacing:.08em; text-shadow:0 0 8px rgba(198,255,61,.45)}

/* data strip: a barcode + tick ruler under the header (static svg) */
.ui-guil{width:100%; height:7px; margin:4px 0 0}
#ui .ui-card[data-level="1"] .ui-guil, #ui .ui-card[data-level="2"] .ui-guil{display:none}
@media (max-width:600px), (max-aspect-ratio:4/5){ #ui .ui-guil{display:none} }
#ui[data-still] .ui-reel{transition:none!important}

/* ---------- readouts: rolling neon counters (speed · cadence · km) + the cadence spectrum ---------- */
.ui-odo{display:grid; grid-template-columns:auto auto 1fr; gap:4px 12px; align-items:stretch; padding:7px 0 6px; position:relative}
.ui-odo::after{content:""; position:absolute; left:0; right:0; bottom:0; height:1px; background:var(--ui-line2)}
.ui-odo-row2{display:contents}
.ui-meter{display:grid; grid-template-columns:auto auto; grid-template-rows:auto 1fr; align-items:end; justify-content:start; gap:0 4px; min-width:0; align-self:stretch}
.ui-meter > .ui-sr{grid-column:1}
.ui-meter-lab{grid-column:1 / -1; font:700 .54rem/1.2 var(--ui-mono); letter-spacing:.1em; text-transform:uppercase; color:var(--ui-dim); white-space:nowrap; margin-bottom:2px}
.ui-meter-lab .zh{font-size:.64rem; letter-spacing:.04em; margin-right:.4em; color:var(--ui-plume)}
#ui .ui-meter-lab .en{font-family:var(--ui-mono)}
.ui-drums{display:flex; align-items:flex-end; gap:0; position:relative}
.ui-drums::after{content:""; position:absolute; left:0; right:0; bottom:-3px; height:1px; background:currentColor; opacity:.35}
.ui-drum{position:relative; width:11px; height:18px; overflow:hidden; color:inherit}
.ui-drums.big .ui-drum{width:15px; height:25px}
.ui-drums[data-drums="kmh"]{color:var(--ui-plume)}
.ui-drums[data-drums="rpm"]{color:var(--ui-magT)}
.ui-drums[data-drums="km"]{color:var(--ui-acid)}
.ui-drum.red{color:var(--ui-cyanT)}
.ui-drum svg{width:100%; height:100%; fill:currentColor; overflow:hidden}
.ui-drum .ui-reel{transition:transform .1s linear}
.ui-drum.snap .ui-reel{transition:transform .22s cubic-bezier(.3,1.4,.5,1)}
/* the rolling window: digits fade into the glass at the top and bottom of each counter cell */
.ui-drum::before, .ui-drum::after{content:""; position:absolute; left:0; right:0; height:4px; pointer-events:none; z-index:1}
.ui-drum::before{top:0; background:linear-gradient(rgba(12,9,30,.95),transparent)}
.ui-drum::after{bottom:0; background:linear-gradient(transparent,rgba(12,9,30,.95))}
.ui-dot{width:3px; height:3px; align-self:flex-end; margin:0 1px 2px; background:var(--ui-acid)}
.ui-unit{font:700 .56rem/1 var(--ui-mono); letter-spacing:.06em; text-transform:uppercase; color:var(--ui-dim); white-space:nowrap}
#ui .ui-unit .en{font-family:var(--ui-mono)}
.ui-odo-t{grid-column:1 / 3; grid-row:1; display:flex; align-items:center; gap:5px; font:700 .54rem/1.1 var(--ui-mono); letter-spacing:.16em; text-transform:uppercase; color:var(--ui-cyanT)}
#ui .ui-odo-t .en{font-family:var(--ui-mono)}
#ui[data-lang="bi"] .ui-odo-t .zh + .en{margin-left:.4em}
.ui-odo-t i{width:0; height:0; border:4px solid transparent; border-left:6px solid var(--ui-cyan); border-right:0}
.ui-odo .ui-state{grid-column:3; grid-row:1; justify-self:end; align-self:start; font:700 .54rem/1.1 var(--ui-mono); letter-spacing:.1em; text-transform:uppercase; color:var(--ui-plume); display:flex; align-items:center; gap:5px; margin-top:-1px}
#ui .ui-odo .ui-state .en{font-family:var(--ui-mono)}
#ui[data-lang="bi"] .ui-state .zh + .en{margin-left:.4em}
.ui-odo .ui-state .zh{font-size:.62rem; letter-spacing:.02em}
.ui-odo .ui-meter{grid-row:2}
/* status lamp: shape AND colour change (hollow ring = paused, solid square = riding, split square = coasting) */
.ui-lamp{display:inline-block; width:8px; height:8px; border:1.5px solid var(--ui-magT); border-radius:50%; flex:none}
[data-playing="true"] .ui-lamp.run{border-radius:1px; border-color:var(--ui-acid); background:var(--ui-acid); box-shadow:0 0 6px rgba(198,255,61,.7)}
[data-playing="true"][data-coasting="true"] .ui-lamp.run{border-color:var(--ui-amber); background:linear-gradient(90deg,var(--ui-amber) 50%,transparent 50%); box-shadow:0 0 6px rgba(255,181,71,.6)}
/* cadence spectrum: fixed-height bars, the lit part clipped to cadence / max (written ≤ 10 Hz, on change only) */
.ui-eq{grid-column:1 / -1; grid-row:3; position:relative; height:10px; margin-top:4px}
.ui-eq > span{position:absolute; inset:0; display:flex; align-items:flex-end; gap:2px}
.ui-eq i{flex:1; min-width:0; background:var(--ui-steel); opacity:.7}
.ui-eq .lit i{opacity:1; background:var(--ui-cyan)}
.ui-eq .lit i:nth-child(n+17){background:var(--ui-mag)}
.ui-eq .lit i:nth-child(n+25){background:var(--ui-acid)}
.ui-eq .lit{clip-path:inset(0 var(--eq,100%) 0 0)}

/* ---------- buttons: glass cells with a cyan hairline, corner nicks, a glow when active ---------- */
.ui-quick{display:grid; grid-template-columns:repeat(4,1fr); gap:5px; padding:7px 0 1px}
.ui-btn{
  appearance:none; font:inherit; color:var(--ui-plume); background:var(--ui-cell); border:1px solid var(--ui-line);
  border-radius:1px; padding:4px 4px; min-height:38px; min-width:0; cursor:pointer; position:relative;
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; text-align:center;
  box-shadow:inset 0 0 0 1px rgba(7,6,15,.55);
  transition:transform .08s, box-shadow .14s, background-color .14s, border-color .14s, color .14s;
  -webkit-tap-highlight-color:transparent; touch-action:manipulation; overflow-wrap:break-word; hyphens:auto;
}
/* corner nicks (TL cyan, BR magenta): pure shape, no text */
.ui-btn::before{content:""; position:absolute; inset:-1px; pointer-events:none;
  background:linear-gradient(var(--ui-cyan),var(--ui-cyan)) 0 0/7px 2px no-repeat, linear-gradient(var(--ui-cyan),var(--ui-cyan)) 0 0/2px 7px no-repeat,
    linear-gradient(var(--ui-mag),var(--ui-mag)) 100% 100%/7px 2px no-repeat, linear-gradient(var(--ui-mag),var(--ui-mag)) 100% 100%/2px 7px no-repeat}
.ui-btn .ico{width:19px; height:19px; flex:none; fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round}
.ui-btn .lab{display:flex; flex-direction:column; align-items:center; min-width:0}
.ui-btn .zh{font-weight:700; font-size:.76rem; line-height:1.1}
#ui[data-lang="bi"] .zh + .en{margin-left:.3em}
#ui[data-lang="bi"] .ui-btn .zh + .en{margin-left:0; color:var(--ui-cyanT)}
.ui-btn .en{font-size:.7rem; line-height:1.1}
#ui[data-lang="en"] .ui-btn .en{font:700 .66rem/1.1 var(--ui-mono); letter-spacing:.05em; text-transform:uppercase}
.ui-btn.row{flex-direction:row; gap:6px; justify-content:flex-start; padding:4px 8px; text-align:left}
.ui-btn.row .lab{align-items:flex-start}
.ui-btn:hover{background:rgba(25,230,255,.13); border-color:var(--ui-cyan); color:#fff; box-shadow:0 0 12px rgba(25,230,255,.32), inset 0 0 0 1px rgba(25,230,255,.25)}
.ui-btn:active{background:rgba(255,46,136,.34); border-color:var(--ui-mag); color:#fff; transform:translateY(1px); box-shadow:0 0 14px var(--ui-glowM), inset 0 0 10px rgba(255,46,136,.4)}
.ui-btn:focus{outline:none}
.ui-btn:focus-visible, .ui-range:focus-visible, .ui-check input:focus-visible + span{
  outline:2px solid var(--ui-acid); outline-offset:2px; box-shadow:0 0 0 5px var(--ui-void), 0 0 14px rgba(198,255,61,.55);
}
.ui-btn[aria-pressed="true"], .ui-btn[aria-checked="true"]{
  background:linear-gradient(180deg,rgba(25,230,255,.32),rgba(25,230,255,.12)); border-color:var(--ui-cyan); color:var(--ui-cyanCore);
  box-shadow:0 0 0 1px var(--ui-void), 0 0 0 2px var(--ui-cyan), 0 0 16px var(--ui-glowC), inset 0 0 12px rgba(25,230,255,.3);
  text-shadow:0 0 8px rgba(25,230,255,.7);
}
#ui[data-lang="bi"] .ui-btn[aria-pressed="true"] .zh + .en, #ui[data-lang="bi"] .ui-btn[aria-checked="true"] .zh + .en{color:var(--ui-cyanCore)}
.ui-btn[aria-pressed="true"]:hover, .ui-btn[aria-checked="true"]:hover{background:linear-gradient(180deg,rgba(25,230,255,.46),rgba(25,230,255,.2))}
/* state pip (so "on" is never colour-only): hollow square off, filled acid square + glow on */
.ui-btn .pip{position:absolute; top:4px; right:4px; width:7px; height:7px; border:1.5px solid currentColor; border-radius:0; opacity:.8}
.ui-btn[aria-pressed="true"] .pip, .ui-btn[aria-checked="true"] .pip{background:var(--ui-acid); border-color:var(--ui-acid); opacity:1; box-shadow:0 0 6px rgba(198,255,61,.8)}
/* key-cap hint on keyboard focus */
.ui-btn .kbd{position:absolute; top:-10px; left:50%; transform:translateX(-50%); padding:0 4px; font:700 .58rem/14px var(--ui-mono);
  background:var(--ui-void); color:var(--ui-acid); border:1px solid var(--ui-acid); opacity:0; pointer-events:none; white-space:nowrap; transition:opacity .12s; z-index:2}
.ui-btn:focus-visible .kbd{opacity:1}
/* fired: a magenta scan frame pulses out of the button (a brief glitch echo) */
.ui-btn.fired::after{content:""; position:absolute; inset:-2px; border:1px solid var(--ui-mag); box-shadow:0 0 10px var(--ui-glowM); animation:ui-stamp .42s ease-out forwards; pointer-events:none}
@keyframes ui-stamp{0%{opacity:1; transform:scale(.94,.8)}35%{opacity:1; transform:scale(1.06,1.02) translateX(1px)}100%{opacity:0; transform:scale(1.18,1.3)}}
.ui-btn.nope{animation:ui-nope .38s; border-color:var(--ui-mag)}
@keyframes ui-nope{0%,100%{translate:0}20%{translate:-3px}40%{translate:3px}60%{translate:-2px}80%{translate:2px}}
/* the bell swings on the same damped spring the bike bell rings with (ω≈24 rad/s, ζ≈0.18) */
.ui-btn.ring .ico{animation:ui-ring .72s; transform-origin:50% 22%}
@keyframes ui-ring{0%{rotate:0deg}9%{rotate:22deg}22%{rotate:-15deg}35%{rotate:10deg}48%{rotate:-6deg}61%{rotate:3.5deg}74%{rotate:-2deg}100%{rotate:0deg}}
.ui-btn.gulp .ico{animation:ui-gulp .5s}
@keyframes ui-gulp{0%{translate:0 0}30%{translate:3px -4px; rotate:-12deg}60%{translate:6px 1px; scale:.6}61%{translate:-6px 0; scale:.2}100%{translate:0 0; scale:1}}
.ui-btn .cool{position:absolute; left:4px; right:4px; bottom:3px; height:2px; background:var(--ui-acid); transform-origin:left; transform:scaleX(0)}
.ui-btn.cooling .cool{animation:ui-cool var(--cd,.95s) linear forwards}
@keyframes ui-cool{from{transform:scaleX(1)}to{transform:scaleX(0)}}

/* expand toggle */
.ui-toggle .ico{transition:rotate .25s}
.ui-card[data-open="true"] .ui-toggle .ico{rotate:180deg}

/* ---------- divider + body ---------- */
.ui-perf{height:1px; margin:8px 0 0; background:repeating-linear-gradient(90deg,var(--ui-line) 0 6px,transparent 6px 10px)}
.ui-body{padding-top:4px}
.ui-card:not([data-open="true"]) .ui-body, .ui-card:not([data-open="true"]) .ui-perf{display:none}
.ui-tabs{display:grid; grid-template-columns:repeat(4,1fr); gap:3px; margin:6px 0 0; border-bottom:1px solid var(--ui-line)}
.ui-tabs .ui-btn{min-height:30px; border-width:1px 1px 0; padding:3px 2px 4px; background:rgba(20,16,41,.55); color:var(--ui-dim)}
.ui-tabs .ui-btn::before{background:none}
.ui-tabs .ui-btn[aria-selected="true"]{background:linear-gradient(180deg,rgba(25,230,255,.22),rgba(25,230,255,.06)); color:var(--ui-cyanCore); border-color:var(--ui-cyan); box-shadow:inset 0 -3px 0 var(--ui-cyan), 0 -4px 14px rgba(25,230,255,.25); text-shadow:0 0 8px rgba(25,230,255,.6)}
/* the selected tab's notch: a small magenta chevron at the top (shape, not text) */
.ui-tabs .ui-btn[aria-selected="true"]::before{content:""; inset:auto; top:-1px; left:50%; width:14px; height:3px; translate:-50% 0; background:var(--ui-mag); box-shadow:0 0 6px var(--ui-glowM)}
#ui[data-lang="bi"] .ui-tabs .ui-btn[aria-selected="true"] .zh + .en{color:var(--ui-cyanCore)}
.ui-tabs .ui-btn[aria-selected="false"]:hover{background:rgba(25,230,255,.12); color:var(--ui-plume)}
.ui-sec{display:none; padding:8px 0 2px}
.ui-sec.active{display:block}
.ui-sec-h{display:none; align-items:center; gap:6px; margin:0 0 6px; font:700 .6rem/1 var(--ui-mono); letter-spacing:.16em; text-transform:uppercase; color:var(--ui-cyanT)}
.ui-sec-h .zh{font-size:.78rem; letter-spacing:.1em}
.ui-sec-h::before, .ui-sec-h::after{content:""; height:1px; flex:1; background:var(--ui-line)}
.ui-sec-h::before{flex:0 0 10px}
.ui-sec-h i{width:6px; height:6px; background:var(--ui-mag); rotate:45deg; flex:none}
.ui-row{display:grid; grid-template-columns:repeat(3,1fr); gap:5px}
.ui-row.two{grid-template-columns:repeat(2,1fr)}
.ui-row + .ui-row{margin-top:5px}
.ui-field{display:grid; grid-template-columns:auto 1fr; gap:3px 8px; align-items:center; margin-bottom:6px}
.ui-field label{font-size:.7rem; line-height:1.1; color:var(--ui-plume)}
.ui-field label .zh{font-weight:700}
#ui[data-lang="bi"] .ui-field label .zh + .en{color:var(--ui-dim)}
.ui-readout{justify-self:end; font:700 .7rem/1 var(--ui-mono); font-variant-numeric:tabular-nums; white-space:nowrap; color:var(--ui-acid); text-shadow:0 0 8px rgba(198,255,61,.35)}
.ui-field .ui-range, .ui-field .ui-ticks{grid-column:1 / -1}
.ui-todico{display:inline-block; vertical-align:-4px; margin-right:4px; color:var(--ui-amber)}
.ui-todico svg{display:inline-block}
.ui-field .ico{width:18px; height:18px; fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round}

/* sliders: a thin neon rail (cyan → magenta fill) with a plume blade thumb */
.ui-range{appearance:none; -webkit-appearance:none; width:100%; height:24px; margin:0; background:transparent; cursor:pointer; touch-action:pan-y}
.ui-range::-webkit-slider-runnable-track{height:6px; background:linear-gradient(90deg,var(--ui-cyan),var(--ui-mag) var(--p,50%),rgba(58,63,92,.9) var(--p,50%)); border:1px solid var(--ui-line); box-shadow:0 0 8px rgba(25,230,255,.2)}
.ui-range::-moz-range-track{height:4px; background:rgba(58,63,92,.9); border:1px solid var(--ui-line)}
.ui-range::-moz-range-progress{height:4px; background:linear-gradient(90deg,var(--ui-cyan),var(--ui-mag))}
.ui-range::-webkit-slider-thumb{-webkit-appearance:none; width:10px; height:20px; margin-top:-8px; background:var(--ui-plume); border:2px solid var(--ui-void); box-shadow:0 0 0 1px var(--ui-cyan), 0 0 10px var(--ui-glowC), inset 0 -6px 0 var(--ui-mag)}
.ui-range::-moz-range-thumb{width:8px; height:18px; background:var(--ui-plume); border:2px solid var(--ui-void); border-radius:0}
.ui-range:hover::-webkit-slider-thumb{background:#fff; box-shadow:0 0 0 1px var(--ui-cyan), 0 0 16px var(--ui-cyan), inset 0 -6px 0 var(--ui-mag)}
.ui-range:active::-webkit-slider-thumb{background:var(--ui-mag); box-shadow:0 0 0 1px #fff, 0 0 16px var(--ui-mag)}
/* the time rail is the day's city moods: deep night · smog dawn · grey-violet noon · neon dusk · acid night · deep night */
.ui-range.tod::-webkit-slider-runnable-track{background:linear-gradient(90deg,#3E2E6A 0 19%,#7A3A8A 19% 24%,#FF8A4A 24% 30%,#9C94A6 30% 64%,#FF6A5C 64% 74%,#FF2E88 74% 79%,#9B5CFF 79% 85%,#3E2E6A 85%)}
.ui-ticks{display:flex; justify-content:space-between; font:.54rem/1.1 var(--ui-mono); letter-spacing:.04em; margin-top:-2px; padding:0 2px; position:relative; color:var(--ui-dim)}
#ui .ui-ticks .en{font-family:var(--ui-mono)}
.ui-ticks span{position:relative; padding-top:5px; white-space:nowrap}
.ui-ticks span::before{content:""; position:absolute; top:0; left:50%; width:1px; height:4px; background:var(--ui-cyan)}
.ui-check{display:flex; align-items:center; gap:8px; font-size:.72rem; cursor:pointer; margin-top:6px}
.ui-check input{position:absolute; opacity:0; width:1px; height:1px}
.ui-check span.box{width:18px; height:18px; border:1.5px solid var(--ui-cyan); flex:none; display:grid; place-items:center; background:var(--ui-cell)}
.ui-check input:checked + span.box{background:var(--ui-acid); border-color:var(--ui-acid); box-shadow:0 0 8px rgba(198,255,61,.55)}
.ui-check input:checked + span.box::after{content:""; width:8px; height:4px; border:solid var(--ui-void); border-width:0 0 2.5px 2.5px; rotate:-45deg; margin-top:-2px}
.ui-note{font-size:.66rem; margin:6px 0 0; padding:4px 7px; border-left:2px solid var(--ui-amber); background:rgba(255,181,71,.1); color:#FFD9A0; line-height:1.3}
.ui-note[hidden]{display:none}
.ui-foot{display:flex; justify-content:space-between; gap:6px; font:700 .5rem/1.2 var(--ui-mono); letter-spacing:.12em; text-transform:uppercase; padding-top:6px; border-top:1px solid var(--ui-line2); margin-top:6px; color:var(--ui-dim)}
#ui .ui-foot .en{font-family:var(--ui-mono)}
#ui[data-lang="bi"] .ui-foot .zh + .en{margin-left:.4em}

/* ---------- idle hint: a HUD callout with a leader line to the rider ---------- */
.ui-hint{position:absolute; left:0; top:0; pointer-events:none; opacity:0; transform:translateY(6px); transition:opacity .4s, transform .4s;
  background:var(--ui-scan), var(--ui-panel); color:var(--ui-plume); border:1px solid var(--ui-line); border-left:3px solid var(--ui-acid);
  box-shadow:0 0 16px rgba(25,230,255,.2); padding:5px 10px 6px 9px; max-width:17.5rem; font-size:.74rem; line-height:1.25}
.ui-hint.on{opacity:1; transform:none}
.ui-hint .zh{display:block; font-weight:700; font-size:.82rem}
.ui-hint .en{font-family:var(--ui-mono)!important; font-size:.66rem; color:var(--ui-cyanT)}
.ui-hint svg{position:absolute; left:-4px; top:100%; width:40px; height:34px; fill:none; stroke:var(--ui-acid); stroke-width:1.5}
.ui-hint svg circle{fill:var(--ui-void)}
.ui-hint::before{content:""; position:absolute; top:-5px; right:-5px; width:12px; height:12px; border:solid var(--ui-mag); border-width:2px 2px 0 0}

/* ---------- toast (reduced-motion switch etc.) ---------- */
.ui-toast{position:absolute; left:50%; top:22px; translate:-50% 0; pointer-events:none; background:var(--ui-panel); color:var(--ui-cyanCore); padding:5px 12px; border:1px solid var(--ui-cyan); box-shadow:0 0 14px var(--ui-glowC); font:700 .72rem/1.3 var(--ui-mono); letter-spacing:.04em; opacity:0; transition:opacity .3s}
.ui-toast.on{opacity:1}

/* ---------- help dialog: a neon keyboard on the courier's terminal ---------- */
.ui-help{
  font:13px/1.3 var(--ui-font); color:var(--ui-plume);
  background:var(--ui-scan), linear-gradient(180deg,rgba(24,16,52,.96),rgba(8,6,20,.97)); border:1px solid var(--ui-cyan);
  box-shadow:0 0 0 1px var(--ui-void), 0 0 30px rgba(25,230,255,.28), inset 0 0 40px rgba(255,46,136,.08);
  pointer-events:auto; padding:18px 22px 16px; width:min(48rem,calc(100vw - 32px)); max-height:calc(100dvh - 32px); overflow:auto;
}
.ui-help :lang(zh-CN){font-family:var(--ui-cjk)}
.ui-help::backdrop{background:repeating-linear-gradient(0deg,rgba(25,230,255,.05) 0 1px,transparent 1px 3px), rgba(7,6,15,.72)}
.ui-help h2{margin:0 0 4px; font:800 1rem/1.2 var(--ui-font); letter-spacing:.2em; text-transform:uppercase; display:flex; gap:10px; align-items:baseline; flex-wrap:wrap; color:var(--ui-cyanCore); text-shadow:0 0 10px rgba(25,230,255,.6)}
.ui-help h2::before{content:""; width:10px; height:10px; background:var(--ui-mag); align-self:center; box-shadow:0 0 8px var(--ui-glowM)}
.ui-help h2 .zh{font-size:1.15rem; letter-spacing:.12em}
.ui-help .try{margin:0 0 12px; font-size:.74rem; color:var(--ui-dim)}
.ui-kb{display:flex; flex-direction:column; gap:5px; align-items:center; padding:12px 8px 10px; background:rgba(7,6,15,.6); border:1px solid var(--ui-line); position:relative}
.ui-kb::before{content:""; position:absolute; inset:-1px; pointer-events:none; background:linear-gradient(var(--ui-mag),var(--ui-mag)) 0 0/22px 2px no-repeat, linear-gradient(var(--ui-mag),var(--ui-mag)) 0 0/2px 22px no-repeat, linear-gradient(var(--ui-cyan),var(--ui-cyan)) 100% 100%/22px 2px no-repeat, linear-gradient(var(--ui-cyan),var(--ui-cyan)) 100% 100%/2px 22px no-repeat}
.ui-kb-row{display:flex; gap:5px}
.ui-kb-row.arrows{margin-top:4px}
.ui-cap{width:3.7rem; min-height:3.3rem; overflow:hidden; border:1px solid rgba(25,230,255,.6); border-radius:2px; background:linear-gradient(180deg,#221A42,#141029); color:var(--ui-plume); display:flex; flex-direction:column; justify-content:space-between; padding:2px 4px 3px; box-shadow:0 3px 0 #07060F, inset 0 1px 0 rgba(216,251,255,.15); font-size:.8rem; font-weight:700; transition:transform .06s, box-shadow .06s, background-color .06s}
.ui-cap.dim{background:rgba(20,16,41,.6); border-color:var(--ui-steel); color:var(--ui-dim); box-shadow:0 3px 0 #07060F; opacity:.6}
.ui-cap small{font-size:.54rem; font-weight:700; line-height:1.1; letter-spacing:.02em; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--ui-cyanT)}
.ui-cap small.en{font-family:var(--ui-mono)}
.ui-cap .face{font:700 .95rem/1 var(--ui-mono)}
.ui-cap small.zh{font-size:.62rem; color:var(--ui-plume)}
.ui-cap.wide{width:19rem; min-height:2.8rem; flex-direction:row; align-items:center; justify-content:center; gap:10px; font-family:var(--ui-mono)}
.ui-cap.q{width:3.7rem}
.ui-cap.lit{background:var(--ui-mag); color:var(--ui-void); border-color:#FFD3E7; transform:translateY(3px); box-shadow:0 0 0 #07060F, 0 0 16px var(--ui-glowM)}
.ui-cap.lit small{color:var(--ui-void)}
.ui-legend{display:grid; grid-template-columns:repeat(auto-fill,minmax(13rem,1fr)); gap:4px 16px; margin:12px 0 0; padding:0; list-style:none; font-size:.76rem}
.ui-legend li.beat{grid-column:1 / -1}
.ui-legend li{display:flex; gap:8px; align-items:center; border-bottom:1px dashed var(--ui-line2); padding:3px 0}
.ui-legend kbd{font:700 .68rem var(--ui-mono); min-width:1.9rem; text-align:center; padding:1px 5px; border:1px solid var(--ui-cyan); color:var(--ui-cyanCore); background:rgba(25,230,255,.1); white-space:nowrap}
.ui-legend .zh{font-weight:700}
.ui-help[data-lang="bi"] .ui-legend .zh + .en, .ui-help[data-lang="bi"] .ui-gestures .zh + .en{color:var(--ui-dim); margin-left:.3em}
.ui-gestures{display:none; margin:0; padding:0; list-style:none}
.ui-gestures li{display:flex; gap:10px; align-items:center; padding:6px 0; border-bottom:1px dashed var(--ui-line2)}
.ui-gestures svg{width:34px; height:34px; flex:none; fill:none; stroke:var(--ui-cyan); stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round}
.ui-help .ui-help-foot{display:flex; justify-content:space-between; align-items:center; gap:12px; margin-top:12px; flex-wrap:wrap}
.ui-help .ui-btn{flex-direction:row; gap:6px; padding:6px 14px; font-weight:700}
.ui-help .ui-btn kbd{font:700 .62rem var(--ui-mono); color:var(--ui-acid); border:1px solid var(--ui-acid); padding:0 4px}
@media (pointer:coarse){ .ui-help .ui-kb, .ui-help .ui-legend, .ui-help .try{display:none} .ui-help .ui-gestures{display:block} }

.ui-grip{display:none}
/* ---------- phones: a bottom sheet ---------- */
@media (max-width:600px), (max-aspect-ratio:4/5){
  #ui{--ui-inset:8px!important}
  .ui-card, .ui-card[data-dock]{left:8px; right:8px; bottom:calc(8px + env(safe-area-inset-bottom)); top:auto; width:auto; max-width:none}
  .ui-shadow{inset:-4px}
  .ui-plate{max-height:min(38dvh, max(14rem, calc(var(--ui-room) - 8px)))}   /* short sheet: the rider stays visible above it; the body scrolls */
  .ui-card[data-open="true"] .ui-odo{display:none}
  .ui-quick .ui-btn .ico{width:16px; height:16px}
  #ui .ui-quick .ui-btn .en{letter-spacing:0; font-size:.56rem}
  .ui-field{margin-bottom:2px}
  .ui-ticks{margin-top:-8px}
  .ui-grip{display:block; width:44px; height:4px; margin:0 auto 6px; background:var(--ui-cyan); box-shadow:0 0 8px var(--ui-glowC); position:relative; cursor:grab; touch-action:none}
  .ui-grip::before{content:""; position:absolute; inset:-14px -30px}
  .ui-head{display:none}
  .ui-frame{padding:5px 8px 7px 10px}
  .ui-odo{grid-template-columns:auto auto 1fr auto; gap:2px 10px; padding:1px 0 5px}
  .ui-odo .ui-meter{grid-row:1}
  .ui-odo .ui-state{grid-column:4; grid-row:1; align-self:center; margin:0}
  .ui-odo .ui-state [data-state]{display:none}
  .ui-meter-lab, .ui-odo-t{display:none}
  .ui-eq{grid-row:2; height:6px; margin-top:3px}
  .ui-drums.big .ui-drum{width:13px; height:21px}
  .ui-quick{gap:6px; padding-top:5px}
  .ui-quick .ui-btn{flex-direction:row; gap:5px; padding:3px 4px}
  .ui-quick .ui-btn .lab{align-items:flex-start}
  .ui-foot{display:none}
}
@media (max-width:600px) and (pointer:coarse), (pointer:coarse){
  .ui-btn, .ui-tabs .ui-btn{min-height:44px; min-width:44px}
  .ui-range{height:44px}
  .ui-range::-webkit-slider-thumb{width:18px; height:30px; margin-top:-13px}
}
/* landscape phones (844×390 …): a narrow side column, so the rider keeps the middle of the screen */
@media (max-height:500px) and (orientation:landscape) and (min-aspect-ratio:4/5){
  #ui{--ui-w:15.5rem}
  .ui-frame{padding:6px 8px 6px 10px}
  .ui-quick .ui-btn{padding:3px 2px}
  #ui .ui-quick .ui-btn .en{font-size:.52rem; letter-spacing:0}
  .ui-sec{padding-top:5px}
  #ui[data-lang="bi"] .ui-ticks .en{display:none}
}
/* compact levels chosen by the dock when the rider fills the frame (close-up, short screens) */
.ui-card[data-level="1"] .ui-head, .ui-card[data-level="2"] .ui-head, .ui-card[data-level="2"] .ui-odo{display:none}
.ui-card[data-level="1"] .ui-odo{grid-template-columns:auto auto 1fr auto; gap:2px 10px; padding:1px 0 5px}
.ui-card[data-level="1"] .ui-odo .ui-meter{grid-row:1}
.ui-card[data-level="1"] .ui-odo .ui-state{grid-column:4; grid-row:1; align-self:center; margin:0}
.ui-card[data-level="1"] .ui-odo .ui-state [data-state]{display:none}
.ui-card[data-level="1"] .ui-meter-lab, .ui-card[data-level="1"] .ui-odo-t{display:none}
.ui-card[data-level="1"] .ui-eq{grid-row:2; height:6px; margin-top:3px}
.ui-card[data-level="1"] .ui-drums.big .ui-drum{width:13px; height:21px}
.ui-card[data-level="2"] .ui-quick .ui-btn .ico{display:none}
.ui-card[data-level="2"] .ui-quick{padding-top:0}
.ui-card[data-level="2"] .ui-quick .ui-btn{min-height:34px}

/* ---------- a11y media ---------- */
@media (prefers-reduced-motion:reduce){
  #ui *, #ui *::before, #ui *::after, .ui-help *{animation:none!important; transition:none!important}
}
#ui[data-reduced="true"] *{animation-duration:.01ms!important; transition-duration:.01ms!important}
@media (prefers-contrast:more){
  #ui, .ui-help{--ui-panel:rgba(7,6,15,.97); --ui-cell:#07060F; --ui-line:var(--ui-cyan); --ui-dim:#DAD6EE; --ui-scan:none}
  .ui-plate{background:var(--ui-void)}
  .ui-btn, .ui-cap{border-width:2px}
  .ui-btn .en, .ui-sub, .ui-serial, .ui-unit, .ui-meter-lab{color:inherit!important}
  .ui-drum::before, .ui-drum::after, .ui-plate::before{display:none}
}
@media (forced-colors:active){
  .ui-shadow, .ui-plate::before, .ui-btn::before, .ui-eq{display:none}
  .ui-plate{border:2px solid CanvasText; background:Canvas}
  .ui-btn{border:2px solid ButtonText; forced-color-adjust:auto}
  .ui-btn[aria-pressed="true"], .ui-btn[aria-checked="true"], .ui-btn[aria-selected="true"]{outline:3px solid Highlight}
  .ui-btn[aria-pressed="true"] .pip, .ui-btn[aria-checked="true"] .pip{background:Highlight; border-color:Highlight}
  .ui-drum, .ui-drums{background:Canvas; color:CanvasText}
  .ui-drum::before, .ui-drum::after{display:none}
  .ui-drum svg, .ui-seal svg, .ui-wordmark svg{fill:CanvasText}
  .ui-seal{background:Canvas; border:1px solid CanvasText}
  .ui-btn:focus-visible, .ui-range:focus-visible{outline:3px solid Highlight}
  .ui-help{border:2px solid CanvasText; background:Canvas}
  .ui-cap{border:1px solid CanvasText; background:Canvas; color:CanvasText}
  .ui-cap.lit{background:Highlight; color:HighlightText}
}

/* ---------- easter-egg counter (feature of src/fx/eggs.js): a small HUD chip, hidden until the first find ---------- */
.ui-eggs{position:absolute; right:var(--ui-inset); top:calc(19vh + 14px); pointer-events:none; display:flex; flex-direction:column; align-items:flex-end; gap:6px; font:700 11px/1.2 var(--ui-mono)}
.ui-eggs[hidden]{display:none}
.ui-eggs-stub{position:relative; display:flex; align-items:center; gap:7px; background:var(--ui-scan), var(--ui-panel); color:var(--ui-plume); padding:4px 10px 4px 8px; border:1px solid var(--ui-line); border-left:3px solid var(--ui-acid); box-shadow:0 0 12px rgba(198,255,61,.18); letter-spacing:.1em}
.ui-eggs-stub i{display:block; width:10px; height:13px; background:var(--ui-acid); border-radius:50% 50% 46% 46%/60% 60% 40% 40%; box-shadow:0 0 8px rgba(198,255,61,.7), inset 0 -3px 0 rgba(7,6,15,.35)}
.ui-eggs-stub b{color:var(--ui-acid); font-size:13px}
.ui-eggs-stub.pop{animation:ui-egg-pop .5s cubic-bezier(.2,1.6,.4,1)}
@keyframes ui-egg-pop{0%{transform:scale(.6) skewX(-12deg)}100%{transform:none}}
.ui-eggs-toast{background:var(--ui-panel); color:var(--ui-acid); padding:4px 10px; border:1px solid var(--ui-acid); box-shadow:0 0 12px rgba(198,255,61,.3); font-size:11px; opacity:0; transition:opacity .3s; white-space:nowrap}
.ui-eggs-toast.on{opacity:1}
@media (max-width:600px){ .ui-eggs{right:12px; top:calc(24vh + 4px)} }
`;

export function injectStyles(doc = document) {
  if (doc.getElementById('ui-style')) return;
  const el = doc.createElement('style');
  el.id = 'ui-style';
  el.textContent = CSS;
  doc.head.appendChild(el);
}
