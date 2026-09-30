// OWNER: pelican-body. Slots: neck, tail, body, pouch, billLower, billUpper, head, eye, crest (+ the LED scarf and
// the techwear bomber, drawn inside the body slot; the HUD visor + earpiece ride in the crest slot, counter-transformed
// back into head space, so they sit OVER the eye and the eye reads through the translucent lens).
// Style X (STYLE-X §3, "Neon Pelican"): still unmistakably a great white pelican (cool-white plumage, peach face skin,
// yellow gular pouch, hooked nail, shaggy nape crest), styled cyber: a cyan visor with live HUD glyphs, a short
// techwear bomber with magenta piping and 鹈鹕 / PELICAN patches, a chrome nail, a glowing circuit tattoo on the
// pouch, an earpiece antenna and an LED scarf on the rig's scarf pose.
// Lighting: dual-colour neon rim (cyan from the back/left, magenta from the top/right) done ONLY with stacked strokes,
// bbox gradients and clip paths. NO filters anywhere in this module (rider slots move every frame).
// Everything static is built once as markup; update() rewrites the neck + scarf geometry (fixed command counts) and
// a handful of transforms / opacities (LED chase, visor, reticle, blink lights), all de-duplicated.
import { fmt2 } from '../core/math.js';
import { h, refs } from '../core/svg.js';
import { SKEL } from '../contract.js';

export const id = 'pelican-body';
export const materials = {};

// ---------------------------------------------------------------- colours
// Bird parts use the core material tokens (graded per city mood, and re-pointed by the brown-pelican egg). Neon is
// emissive: it reads the palette's neon tokens when they exist and falls back to the STYLE-X §1 hexes.
const NE = {
  mag: 'var(--pb-magenta,#FF2E88)', cy: 'var(--pb-cyan,#19E6FF)', acid: 'var(--pb-acid,#C6FF3D)', amber: 'var(--pb-amber,#FFB547)',
  red: 'var(--pb-neonRed,#FF3B4E)', magCore: 'var(--pb-magentaCore,#FFD3E7)', cyCore: 'var(--pb-cyanCore,#D8FBFF)',
  acidCore: 'var(--pb-acidCore,#F1FFD0)', hot: 'var(--pb-neonWhite,#F6F4FF)',
};
// Techwear / hardware (dark, near-neutral; module-scoped tokens with STYLE-X fallbacks)
const HW = {
  jk: 'var(--pb-pbJacket,#1C1932)', jkHi: 'var(--pb-pbJacketHi,#35306A)', jkLo: 'var(--pb-pbJacketLo,#100E1F)', seam: 'var(--pb-pbSeam,#08070F)',
  chrome: 'var(--pb-pbChrome,#C9D1EE)', chromeHi: 'var(--pb-pbChromeHi,#FFFFFF)', chromeDk: 'var(--pb-pbChromeDk,#3A3F5C)', chromeMid: 'var(--pb-pbChromeMid,#7D84A8)',
  fab: 'var(--pb-pbScarf,#4A1A5E)', fabHi: 'var(--pb-pbScarfHi,#6E2A84)', fabLo: 'var(--pb-pbScarfLo,#2A0F38)', fabFar: 'var(--pb-pbScarfFar,#2A1238)',
  lens: 'var(--pb-pbLens,#19E6FF)', lensDk: 'var(--pb-pbLensDk,#0B5C78)', patch: 'var(--pb-pbPatch,#0B0A16)',
};

// ---- lettering as paths (tools/ttf.mjs: DejaVu Sans Bold, DejaVu Sans Mono Bold, WenQuanYi Zen Hei; em = 100, baseline y = 0)
const GLYPH = {
  PELICAN: { d: 'M9 -73L40 -73Q54 -73 62 -67Q69 -61 69 -49Q69 -38 62 -31Q54 -25 40 -25L28 -25L28 0L9 0ZM28 -59L28 -39L38 -39Q44 -39 47 -42Q50 -44 50 -49Q50 -54 47 -57Q44 -59 38 -59ZM90 -73L141 -73L141 -59L109 -59L109 -45L139 -45L139 -31L109 -31L109 -14L142 -14L142 0L90 0ZM167 -73L186 -73L186 -14L219 -14L219 0L167 0ZM239 -73L257 -73L257 0L239 0ZM342 -4Q336 -1 331 0Q325 1 319 1Q301 1 290 -9Q280 -19 280 -36Q280 -54 290 -64Q301 -74 319 -74Q325 -74 331 -73Q336 -71 342 -69L342 -54Q336 -57 331 -59Q326 -61 321 -61Q310 -61 305 -54Q299 -48 299 -36Q299 -25 305 -19Q310 -12 321 -12Q326 -12 331 -14Q336 -16 342 -19ZM409 -13L380 -13L375 0L356 0L383 -73L406 -73L433 0L414 0ZM385 -27L405 -27L395 -56ZM450 -73L471 -73L498 -23L498 -73L516 -73L516 0L495 0L468 -50L468 0L450 0Z', w: 525 },
  HAN: { d: 'M32 12Q28 12 25 12Q25 5 25 -1L25 -17Q19 -6 6 5Q4 3 1 1Q7 -4 11 -10Q16 -16 22 -26L9 -26L9 -47L25 -47L25 -58L18 -58Q13 -58 9 -57Q9 -60 9 -62Q13 -62 18 -62L28 -62Q33 -70 36 -80Q40 -79 43 -78Q41 -71 35 -62L48 -62L48 -43L31 -43L31 -31L48 -31L48 -13Q48 -10 45 -7Q41 -5 36 -5Q37 -10 34 -13Q35 -13 37 -13Q41 -12 41 -13Q42 -13 42 -14L42 -26L31 -26L31 -1Q31 5 32 12ZM26 -66L20 -63L10 -78L17 -82ZM25 -31L25 -43L15 -43Q15 -37 16 -31ZM31 -47L41 -47L41 -58L33 -58L32 -57Q32 -58 31 -58ZM86 -13Q85 -10 86 -7Q81 -8 77 -8L64 -8Q60 -8 56 -7Q56 -10 56 -13Q60 -12 64 -12L77 -12Q81 -12 86 -13ZM80 -51L75 -46L68 -57L73 -61ZM78 -33Q79 -38 77 -41Q79 -41 82 -41Q85 -41 85 -41Q86 -42 86 -43L86 -63L72 -63L71 -62Q71 -63 70 -63Q69 -63 66 -63L66 -29L96 -29L96 4Q96 8 94 11Q90 14 82 14Q83 9 80 6Q83 6 86 6Q90 6 90 5Q91 5 91 3L91 -25L61 -25L61 -68Q65 -68 68 -68Q72 -72 73 -78Q76 -77 79 -76Q78 -71 76 -68L91 -68L91 -42Q91 -39 89 -37Q86 -33 78 -33ZM149 -26L139 -26Q140 -11 135 -2Q130 7 122 12Q121 9 117 7Q133 0 133 -22L133 -74L156 -74L156 1Q156 8 152 10Q148 13 141 12Q142 8 139 5Q141 5 144 5Q147 5 148 4Q149 3 149 -3ZM112 -2L105 -2L105 -38Q109 -38 113 -38L113 -54L102 -53Q102 -56 102 -58L113 -58L113 -69Q113 -76 113 -82Q116 -82 120 -82Q119 -76 119 -69L119 -58L132 -58Q132 -56 132 -53L119 -54L119 -38L128 -38L128 -2L121 -2L121 -10L112 -10ZM149 -52L149 -70L139 -70L139 -52ZM149 -30L149 -49L139 -49L139 -30ZM121 -34L112 -34L112 -14L121 -14ZM187 -13Q186 -10 187 -7Q183 -8 179 -8L166 -8Q163 -8 159 -7Q159 -10 159 -13Q163 -12 166 -12L179 -12Q183 -12 187 -13ZM181 -51L177 -46L171 -57L175 -61ZM180 -33Q180 -38 178 -41Q180 -41 183 -41Q186 -41 186 -41Q187 -42 187 -43L187 -63L174 -63L173 -62Q173 -63 172 -63Q171 -63 168 -63L168 -29L197 -29L197 4Q197 8 194 11Q191 14 183 14Q184 9 181 6Q184 6 187 6Q190 6 191 5Q191 5 191 3L191 -25L163 -25L163 -68Q167 -68 171 -68Q174 -72 175 -78Q178 -77 181 -76Q179 -71 178 -68L192 -68L192 -42Q192 -39 190 -37Q187 -33 180 -33Z', w: 200 },
  NUM: { d: 'M35 -72L30 -54L40 -54L44 -72L55 -72L51 -54L60 -54L60 -43L48 -43L44 -29L54 -29L54 -18L42 -18L37 0L26 0L31 -18L21 -18L16 0L6 0L10 -18L0 -18L0 -29L13 -29L16 -43L6 -43L6 -54L19 -54L24 -72ZM37 -43L27 -43L24 -29L34 -29ZM84 -36Q84 -39 86 -41Q88 -42 90 -42Q93 -42 95 -41Q96 -39 96 -36Q96 -34 95 -32Q93 -30 90 -30Q88 -30 86 -32Q84 -34 84 -36ZM90 -62Q85 -62 83 -56Q81 -50 81 -36Q81 -23 83 -17Q85 -11 90 -11Q95 -11 98 -17Q100 -23 100 -36Q100 -50 98 -56Q95 -62 90 -62ZM66 -36Q66 -55 72 -65Q78 -74 90 -74Q102 -74 108 -65Q114 -55 114 -36Q114 -17 108 -8Q102 1 90 1Q78 1 72 -8Q66 -17 66 -36ZM127 -73L173 -73L173 -63L148 0L134 0L157 -60L127 -60ZM190 -13L206 -13L206 -60L191 -56L191 -69L206 -73L220 -73L220 -13L236 -13L236 0L190 0ZM251 -1L251 -14Q255 -12 258 -11Q262 -10 265 -10Q273 -10 277 -15Q281 -20 281 -30Q279 -27 275 -26Q272 -24 267 -24Q257 -24 252 -30Q246 -37 246 -48Q246 -60 252 -67Q258 -74 269 -74Q283 -74 289 -65Q295 -56 295 -36Q295 -17 287 -8Q280 2 265 2Q262 2 258 1Q254 0 251 -1ZM270 -36Q274 -36 277 -40Q279 -43 279 -49Q279 -56 277 -59Q274 -63 270 -63Q265 -63 262 -59Q260 -56 260 -49Q260 -43 262 -40Q265 -36 270 -36Z', w: 301 },
  SER: { d: 'M22 -61L22 -39L28 -39Q35 -39 38 -42Q41 -44 41 -50Q41 -56 38 -58Q35 -61 28 -61ZM8 -73L28 -73Q43 -73 49 -68Q56 -62 56 -50Q56 -38 49 -33Q43 -27 28 -27L22 -27L22 0L8 0ZM80 -33L80 -12L90 -12Q97 -12 99 -14Q102 -16 102 -22Q102 -28 99 -31Q96 -33 90 -33ZM80 -62L80 -45L90 -45Q95 -45 98 -47Q100 -48 100 -53Q100 -57 98 -59Q95 -62 90 -62ZM66 -73L90 -73Q102 -73 108 -68Q114 -64 114 -55Q114 -48 111 -44Q107 -40 100 -39Q108 -38 113 -33Q117 -29 117 -20Q117 -9 110 -5Q104 0 90 0L66 0ZM135 -36L166 -36L166 -22L135 -22ZM205 -36Q205 -39 206 -41Q208 -42 211 -42Q213 -42 215 -41Q217 -39 217 -36Q217 -34 215 -32Q213 -30 211 -30Q208 -30 206 -32Q205 -34 205 -36ZM211 -62Q206 -62 203 -56Q201 -50 201 -36Q201 -23 203 -17Q206 -11 211 -11Q216 -11 218 -17Q220 -23 220 -36Q220 -50 218 -56Q216 -62 211 -62ZM187 -36Q187 -55 193 -65Q199 -74 211 -74Q223 -74 229 -65Q235 -55 235 -36Q235 -17 229 -8Q223 1 211 1Q199 1 193 -8Q187 -17 187 -36ZM247 -73L294 -73L294 -63L269 0L254 0L278 -60L247 -60ZM310 -13L326 -13L326 -60L311 -56L311 -69L326 -73L340 -73L340 -13L356 -13L356 0L310 0ZM371 -1L371 -14Q375 -12 379 -11Q382 -10 385 -10Q393 -10 397 -15Q401 -20 402 -30Q399 -27 396 -26Q392 -24 387 -24Q377 -24 372 -30Q367 -37 367 -48Q367 -60 373 -67Q379 -74 390 -74Q403 -74 409 -65Q415 -56 415 -36Q415 -17 408 -8Q400 2 386 2Q382 2 378 1Q375 0 371 -1ZM390 -36Q395 -36 397 -40Q400 -43 400 -49Q400 -56 397 -59Q395 -63 390 -63Q385 -63 383 -59Q380 -56 380 -49Q380 -43 383 -40Q385 -36 390 -36Z', w: 421 },
  KMH: { d: 'M6 -73L20 -73L20 -44L43 -73L59 -73L36 -44L60 0L44 0L27 -33L20 -25L20 0L6 0ZM64 -73L82 -73L90 -41L99 -73L116 -73L116 0L104 0L104 -58L96 -27L85 -27L77 -58L77 0L64 0ZM164 -73L175 -73L137 9L126 9ZM187 -73L202 -73L202 -45L220 -45L220 -73L234 -73L234 0L220 0L220 -32L202 -32L202 0L187 0Z', w: 241 },
  EXP: { d: 'M9 -73L60 -73L60 -59L28 -59L28 -45L58 -45L58 -31L28 -31L28 -14L61 -14L61 0L9 0ZM124 -37L149 0L130 0L113 -25L96 0L76 0L102 -37L77 -73L97 -73L113 -49L129 -73L148 -73ZM167 -73L198 -73Q212 -73 219 -67Q227 -61 227 -49Q227 -38 219 -31Q212 -25 198 -25L185 -25L185 0L167 0ZM185 -59L185 -39L196 -39Q201 -39 204 -42Q207 -44 207 -49Q207 -54 204 -57Q201 -59 196 -59ZM273 -41Q279 -41 281 -43Q284 -45 284 -50Q284 -55 281 -57Q279 -59 273 -59L265 -59L265 -41ZM265 -28L265 0L246 0L246 -73L275 -73Q289 -73 296 -68Q302 -63 302 -53Q302 -46 299 -41Q295 -36 288 -34Q292 -33 295 -30Q298 -27 302 -21L312 0L292 0L283 -18Q280 -24 277 -26Q275 -28 270 -28ZM329 -73L380 -73L380 -59L348 -59L348 -45L378 -45L378 -31L348 -31L348 -14L381 -14L381 0L329 0ZM454 -71L454 -55Q448 -58 442 -59Q436 -61 431 -61Q425 -61 421 -59Q418 -57 418 -53Q418 -50 420 -48Q423 -47 428 -46L436 -44Q448 -42 454 -37Q459 -32 459 -22Q459 -10 452 -4Q444 1 430 1Q423 1 416 0Q409 -1 402 -4L402 -20Q409 -16 415 -14Q422 -12 428 -12Q434 -12 437 -14Q441 -16 441 -20Q441 -24 438 -25Q436 -27 430 -29L422 -30Q411 -33 406 -38Q401 -43 401 -52Q401 -62 408 -68Q415 -74 428 -74Q434 -74 441 -73Q447 -72 454 -71ZM532 -71L532 -55Q526 -58 520 -59Q515 -61 509 -61Q503 -61 499 -59Q496 -57 496 -53Q496 -50 498 -48Q501 -47 506 -46L514 -44Q526 -42 532 -37Q537 -32 537 -22Q537 -10 530 -4Q522 1 508 1Q501 1 494 0Q487 -1 480 -4L480 -20Q487 -16 493 -14Q500 -12 506 -12Q512 -12 515 -14Q519 -16 519 -20Q519 -24 516 -25Q514 -27 508 -29L500 -30Q489 -33 484 -38Q479 -43 479 -52Q479 -62 486 -68Q493 -74 506 -74Q512 -74 519 -73Q525 -72 532 -71Z', w: 544 },
  DIG: ["M24 -36Q24 -39 26 -41Q28 -42 30 -42Q33 -42 34 -41Q36 -39 36 -36Q36 -34 34 -32Q33 -30 30 -30Q28 -30 26 -32Q24 -34 24 -36ZM30 -62Q25 -62 23 -56Q21 -50 21 -36Q21 -23 23 -17Q25 -11 30 -11Q35 -11 37 -17Q40 -23 40 -36Q40 -50 37 -56Q35 -62 30 -62ZM6 -36Q6 -55 12 -65Q18 -74 30 -74Q42 -74 48 -65Q54 -55 54 -36Q54 -17 48 -8Q42 1 30 1Q18 1 12 -8Q6 -17 6 -36Z","M9 -13L25 -13L25 -60L10 -56L10 -69L25 -73L39 -73L39 -13L55 -13L55 0L9 0Z","M21 -13L52 -13L52 0L6 0L6 -12L13 -21Q27 -35 30 -39Q34 -43 36 -46Q37 -50 37 -53Q37 -58 34 -60Q31 -63 26 -63Q22 -63 17 -61Q12 -60 7 -57L7 -70Q12 -72 17 -73Q22 -74 27 -74Q39 -74 45 -69Q52 -63 52 -54Q52 -50 50 -46Q49 -42 45 -38Q43 -34 31 -23Q25 -16 21 -13Z","M27 -33L19 -33L19 -45L27 -45Q32 -45 35 -47Q38 -50 38 -53Q38 -57 35 -60Q32 -62 27 -62Q23 -62 18 -61Q13 -60 8 -58L8 -71Q13 -73 18 -73Q23 -74 28 -74Q39 -74 46 -69Q52 -64 52 -55Q52 -49 48 -45Q45 -41 38 -39Q46 -38 50 -33Q54 -28 54 -20Q54 -10 47 -4Q40 1 27 1Q22 1 16 0Q11 0 6 -2L6 -16Q11 -13 16 -12Q21 -11 27 -11Q33 -11 36 -14Q40 -16 40 -21Q40 -27 36 -30Q33 -33 27 -33Z","M34 -57L15 -28L34 -28ZM33 -73L48 -73L48 -28L56 -28L56 -16L48 -16L48 0L34 0L34 -16L5 -16L5 -30Z","M9 -73L49 -73L49 -60L21 -60L21 -47Q23 -47 25 -48Q27 -48 29 -48Q40 -48 47 -41Q53 -34 53 -23Q53 -12 46 -5Q39 1 26 1Q22 1 17 1Q12 0 7 -2L7 -15Q11 -13 15 -12Q20 -11 24 -11Q31 -11 35 -14Q39 -17 39 -23Q39 -29 35 -33Q32 -36 25 -36Q21 -36 17 -35Q13 -34 9 -32Z","M31 -37Q27 -37 24 -33Q22 -30 22 -23Q22 -17 24 -13Q27 -10 31 -10Q36 -10 39 -13Q41 -17 41 -23Q41 -30 39 -33Q36 -37 31 -37ZM50 -71L50 -58Q46 -60 43 -61Q39 -62 36 -62Q28 -62 24 -57Q20 -52 20 -42Q22 -45 26 -47Q29 -48 34 -48Q44 -48 49 -42Q55 -36 55 -24Q55 -12 49 -5Q43 2 32 2Q18 2 12 -7Q6 -16 6 -36Q6 -55 14 -65Q21 -74 36 -74Q39 -74 43 -73Q47 -73 50 -71Z","M7 -73L53 -73L53 -63L28 0L13 0L37 -60L7 -60Z","M30 -33Q25 -33 22 -29Q19 -26 19 -21Q19 -16 22 -13Q25 -10 30 -10Q35 -10 38 -13Q41 -16 41 -21Q41 -26 38 -29Q35 -33 30 -33ZM19 -39Q14 -41 11 -45Q8 -49 8 -55Q8 -64 14 -69Q20 -74 30 -74Q40 -74 46 -69Q52 -64 52 -55Q52 -49 49 -45Q46 -41 41 -39Q47 -37 50 -32Q54 -27 54 -21Q54 -10 48 -4Q42 1 30 1Q19 1 13 -4Q6 -10 6 -21Q6 -27 10 -32Q13 -37 19 -39ZM21 -53Q21 -49 23 -47Q26 -44 30 -44Q34 -44 37 -47Q39 -49 39 -53Q39 -58 37 -60Q34 -63 30 -63Q26 -63 23 -60Q21 -58 21 -53Z","M10 -1L10 -14Q14 -12 17 -11Q21 -10 24 -10Q32 -10 36 -15Q40 -20 40 -30Q38 -27 34 -26Q31 -24 26 -24Q16 -24 11 -30Q5 -37 5 -48Q5 -60 11 -67Q17 -74 28 -74Q42 -74 48 -65Q54 -56 54 -36Q54 -17 46 -8Q39 2 24 2Q21 2 17 1Q14 0 10 -1ZM29 -36Q33 -36 36 -40Q38 -43 38 -49Q38 -56 36 -59Q33 -63 29 -63Q24 -63 22 -59Q19 -56 19 -49Q19 -43 22 -40Q24 -36 29 -36Z"],
};

// ---------------------------------------------------------------- helpers (pure)
const D2R = Math.PI / 180;
const f = fmt2;   // = String(Math.round(x * 100) / 100), fast (core/math.js)
const pt = p => `${f(p[0])} ${f(p[1])}`;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const lerp = (a, b, t) => a + (b - a) * t;
const lerp2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rot = ([x, y], a) => { const c = Math.cos(a * D2R), s = Math.sin(a * D2R); return [x * c - y * s, x * s + y * c]; };
const norm = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
const perp = v => [-v[1], v[0]];                     // +90° (clockwise on screen)
// Catmull-Rom through points -> cubic path (closed or open)
function smooth(pts, closed = true, k = 1 / 6) {
  const n = pts.length; const g = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  let d = `M${pt(pts[0])}`;
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    d += `C${pt([p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k])} ${pt([p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k])} ${pt(p2)}`;
  }
  return d + (closed ? 'Z' : '');
}
// midpoint-quadratic smoothing of an open polyline: fixed command count (M + Q×(n-2) + L)
function qline(p) {
  let d = `M${pt(p[0])}`;
  for (let i = 1; i < p.length - 1; i++) d += `Q${pt(p[i])} ${pt(lerp2(p[i], p[i + 1], 0.5))}`;
  return d + `L${pt(p[p.length - 1])}`;
}
// Catmull-Rom resample of a polyline (k samples per span)
function resample(P, k, closed = false) {
  const out = [], n = P.length, g = i => closed ? P[(i + n) % n] : P[Math.max(0, Math.min(n - 1, i))];
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) for (let j = 0; j < k; j++) {
    const t = j / k, t2 = t * t, t3 = t2 * t, p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    const cr = c => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3);
    out.push([cr(0), cr(1)]);
  }
  out.push(closed ? P[0] : P[n - 1]); return out;
}
// A long line as short C1-continuous quadratic pieces (midpoint to midpoint). Looks identical to one smooth stroke
// with round caps, but each piece only encloses a sliver (keeps hit-testing honest for the things underneath).
function splitQ(S) {
  const m = i => lerp2(S[i], S[i + 1], 0.5);
  let d = `M${pt(S[0])}L${pt(m(0))}`;
  for (let i = 1; i < S.length - 1; i++) d += `M${pt(m(i - 1))}Q${pt(S[i])} ${pt(m(i))}`;
  return d + `M${pt(m(S.length - 2))}L${pt(S[S.length - 1])}`;
}
// Scallop arc: chord across the flow at c (width w), bulging by `depth` toward the flow direction u.
const scallop = (c, u, w, depth) => {
  const n = perp(u), a = add(c, mul(n, -w / 2)), b = add(c, mul(n, w / 2)), q = add(c, mul(u, depth * 2));
  return `M${pt(a)}Q${pt(q)} ${pt(b)}`;
};
const line = (d, stroke, w, extra = {}) => h('path', { d, fill: 'none', stroke, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra });
// stacked-stroke neon (NO filter): wide faint halo + mid glow + saturated tube + hot core
const neon = (d, col, core, w = 1, extra = {}, op = 1) => h('g', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: op === 1 ? undefined : op, ...extra },
  h('path', { d, stroke: col, 'stroke-width': f(w * 5.5), opacity: 0.13 }),
  h('path', { d, stroke: col, 'stroke-width': f(w * 2.6), opacity: 0.32 }),
  h('path', { d, stroke: col, 'stroke-width': f(w * 1.2) }),
  h('path', { d, stroke: core, 'stroke-width': f(w * 0.45) }));
// glyph run: path d at em 100 -> placed at (x, y) baseline-left, scaled to `size` em units
const glyph = (g, x, y, size, fill, extra = {}) => h('path', { d: g.d || g, fill, transform: `translate(${f(x)} ${f(y)}) scale(${f(size / 100)})`, ...extra });
// radial glow disc (gradient, no filter)
const glowDisc = (cx, cy, r, grad, op = 1, extra = {}) => h('circle', { cx: f(cx), cy: f(cy), r: f(r), fill: `url(#${grad})`, opacity: op === 1 ? undefined : op, ...extra });

// ---------------------------------------------------------------- neck deformer (pure; also used by the baker)
// Cubic Bézier centreline (rig-spec §2); width w0 -> w1. Optional bulge {at: 0..1, amp} for the gulp.
function neckSamples(n, N, bulge) {
  const B = (t, a, b, c, d) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d;
  const Bd = (t, a, b, c, d) => 3 * (1 - t) ** 2 * (b - a) + 6 * (1 - t) * t * (c - b) + 3 * t * t * (d - c);
  const C = [], T = [], W = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    C.push([B(t, n.p0[0], n.p1[0], n.p2[0], n.p3[0]), B(t, n.p0[1], n.p1[1], n.p2[1], n.p3[1])]);
    T.push(norm([Bd(t, n.p0[0], n.p1[0], n.p2[0], n.p3[0]), Bd(t, n.p0[1], n.p1[1], n.p2[1], n.p3[1])]));
    // slight throat fullness under the head + taper; bulge for the gulp
    let w = (n.w0 + (n.w1 - n.w0) * t) / 2 + 1.6 * Math.sin(Math.PI * t) ** 2;
    const bg = bulge || (n.bulgeA > 0 ? { at: n.bulgeT, amp: (n.bulgeW ?? 13 * n.bulgeA) / 2 } : null);
    if (bg && bg.amp > 0) w += bg.amp * Math.exp(-(((t - bg.at) / 0.1) ** 2));
    W.push(w);
  }
  return { C, T, W };
}
const openCubic = P => {
  let d = '';
  const g = i => P[Math.max(0, Math.min(P.length - 1, i))];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    d += `C${pt([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${pt([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${pt(p2)}`;
  }
  return d;
};
// Outline: M + 8 C (front side, base -> head) + L + 8 C (back side, head -> base) + Z. Fixed command count.
export function neckD(n, bulge) {
  const { C, T, W } = neckSamples(n, 9, bulge);
  const F = C.map((c, i) => add(c, mul(perp(T[i]), W[i]))), Bk = C.map((c, i) => add(c, mul(perp(T[i]), -W[i]))).reverse();
  return `M${pt(F[0])}${openCubic(F)}L${pt(Bk[0])}${openCubic(Bk)}Z`;
}
// Feather-flow marks + front crease + the two neon rim lines + the nape jack, riding on the deformer (fixed counts).
function neckDetail(n, bulge) {
  const N = 13, { C, T, W } = neckSamples(n, N, bulge);
  let flow = '', flowSmall = '';
  for (let i = 3; i < N - 1; i++) {
    const nr = perp(T[i]), u = mul(T[i], -1);            // feathers overlap downward, toward the body
    for (const [o, s, pathSel] of [[-0.42, 0.3, 0], [0.16, 0.36, 1]]) {
      const tt = i + (pathSel ? 0.5 : 0); if (tt > N - 1.5) continue;
      const k = Math.floor(tt), fr = tt - k, c0 = lerp2(C[k], C[k + 1], fr), w = lerp(W[k], W[k + 1], fr);
      const c = add(c0, mul(nr, o * w));
      if (pathSel) flowSmall += scallop(c, u, s * w * 2, 1.6 + 0.04 * w);
      else flow += scallop(c, u, s * w * 2, 2.1 + 0.05 * w);
    }
  }
  const at = (sgn, inset, tt0) => {
    const tt = tt0 * (N - 1), k = Math.min(N - 2, Math.floor(tt)), fr = tt - k;
    const c = lerp2(C[k], C[k + 1], fr), tn = norm(lerp2(T[k], T[k + 1], fr)), w = lerp(W[k], W[k + 1], fr);
    return { p: add(c, mul(perp(tn), sgn * (w - inset))), tn };
  };
  const side = (sgn, inset, t0, t1) => {
    const p = []; for (let i = 0; i < 9; i++) p.push(at(sgn, inset, lerp(t0, t1, i / 8)).p);
    return qline(p);
  };
  const jack = at(-1, 3.4, 0.5);
  return {
    flow, flowSmall,
    crease: side(1, 4.2, 0.24, 0.64),
    rimF: side(1, 1.9, 0.2, 0.9),      // magenta: the throat side, facing the signs ahead
    rimB: side(-1, 1.9, 0.12, 0.94),   // cyan: the nape side
    shade: side(-1, 6.5, 0.18, 0.7),
    jack: `translate(${f(jack.p[0])} ${f(jack.p[1])}) rotate(${f(Math.atan2(jack.tn[1], jack.tn[0]) / D2R)})`,
  };
}

// ---------------------------------------------------------------- static geometry
// Body (pelvis-local): the spec ellipse (centre (32,-50), rx 98, ry 58, rot −18°) warped into a deep-chested teardrop.
function bodyPoly() {
  const pts = [];
  for (let i = 0; i < 48; i++) {
    const t = i / 48 * Math.PI * 2; let ex = 98 * Math.cos(t), ey = 58 * Math.sin(t);
    const deg = (t / D2R) % 360;
    // warp mask: 0 on the belly bottom (the saddle contact band), 1 elsewhere
    const m = 1 - sstep(55, 85, deg) * (1 - sstep(150, 180, deg));
    const back = Math.max(0, -Math.cos(t)), breast = Math.max(0, Math.cos(t)) * Math.max(0, Math.sin(t));
    ey *= 1 - 0.3 * back * back * m; ex *= 1 + (0.06 * back + 0.05 * breast) * m; ey *= 1 + 0.05 * breast * m;
    if (Math.sin(t) < 0) ey *= 1 - 0.06 * Math.max(0, -Math.cos(t));    // flatter back line
    const p = rot([ex, ey], -18); pts.push([32 + p[0], -50 + p[1]]);
  }
  return pts;
}
// lowest belly point (pelvis-local) for a body rotation, on the exact spec ellipse (matches rig bellyLow)
// (the ellipse samples are fixed: precomputed once; per call only the rotation runs, allocation-free, same arithmetic)
let BELLY_E = null;
function bellyLowLocal(bodyRot, sx = 1, sy = 1) {
  if (!BELLY_E) { BELLY_E = []; for (let d = 70; d <= 170; d += 0.5) { const t = d * D2R; BELLY_E.push(rot([98 * Math.cos(t), 58 * Math.sin(t)], -18)); } }
  const c = Math.cos(bodyRot * D2R), sn = Math.sin(bodyRot * D2R);
  let by = 0, bx0 = 0, by0 = 0, has = false;
  for (let i = 0; i < BELLY_E.length; i++) {
    const e = BELLY_E[i], qx = (32 + e[0]) * sx, qy = (-50 + e[1]) * sy, y = qx * sn + qy * c;
    if (!has || y > by) { has = true; by = y; bx0 = qx; by0 = qy; }
  }
  return [bx0, by0];
}
const EL = (e, g) => { const p = rot([e * 98, g * 58], -18); return [32 + p[0], -50 + p[1]]; };   // ellipse param -> body-local
// outward offset of a closed polygon about a centre (puffy jacket shell)
const puff = (poly, c, k) => poly.map(p => { const d = sub(p, c), l = Math.hypot(d[0], d[1]) || 1; return add(p, mul(d, k / l)); });

// scarf wrap frame (body-local), from the neck base and the rig's first neck control offset (30,-58)
const NB = SKEL.neckBase, NU = norm([30, -58]), NN = perp(NU);   // NU along the neck (up), NN across (toward the front)
// Scarf art lives in a canonical frame (origin = wrap centre on the neck axis, axes NN/NU at rest); update() places it
// at the rig's knot (pose.scarf, rider space -> body-local) or at the default spot below.
const WRAP_DEFAULT = add(NB, mul(NU, 18)), NU_ANG = Math.atan2(NU[1], NU[0]) / D2R;
const W_ = (a, b) => add(mul(NN, a), mul(NU, b));  // across, along (canonical)
const KNOT = W_(12, -3);
const TAIL0 = { near: W_(-17, 1), far: W_(-13, 6) };
const scarfXf = (c, dAng) => `translate(${f(c[0])} ${f(c[1])}) rotate(${f(dAng)})`;
const XF0 = scarfXf(WRAP_DEFAULT, 0);
const EYE = SKEL.eye;                                   // eye centre in head space

export function build({ v }) {
  const P = v('plume'), Bk = v('plumeShade'), Bd = v('plumeDeep'), N = v('flight'), K = v('bill'), Ks = v('skin'), O = v('pouch'), Od = v('pouchDeep');
  const R = v('billNail'), Re = v('billEdge'), INK = v('ink');
  const Pf = v('plume', { far: true });
  const KW = 1.6;                                       // ink key line
  const key = (d, w = KW, extra = {}) => line(d, INK, w, extra);
  const tag = (kind, name) => `pelican:${kind}:${name}`;
  const s = {};

  // ================================================================ shared defs (gradients; all bbox-relative so they
  // follow each part's own frame; stops that use CSS variables resolve where the gradient lives = module defs)
  const stop = (o, c, a = 1) => h('stop', { offset: o, style: `stop-color:${c}${a < 1 ? `;stop-opacity:${a}` : ''}` });
  const lg = (gid, x1, y1, x2, y2, stops, extra = {}) => h('linearGradient', { id: gid, x1, y1, x2, y2, ...extra }, stops.map(a => stop(...a)));
  const rg = (gid, stops, extra = {}) => h('radialGradient', { id: gid, ...extra }, stops.map(a => stop(...a)));
  const defs = [
    // rim bands: cyan from the back (left), magenta from the top-right; spill = the outside halo (both hues)
    lg('pb-gCy', 0, 0, 1, 0, [[0, NE.cy], [0.2, NE.cy, 0.55], [0.4, NE.cy, 0]]),
    lg('pb-gMg', 0, 1, 1, 0, [[0.5, NE.mag, 0], [0.74, NE.mag, 0.55], [1, NE.mag]]),
    lg('pb-gMgTop', 0, 0, 0, 1, [[0, NE.mag], [0.3, NE.mag, 0.35], [0.55, NE.mag, 0]]),
    lg('pb-gCyBot', 0, 0, 0, 1, [[0.45, NE.cy, 0], [0.8, NE.cy, 0.45], [1, NE.cy]]),
    lg('pb-gSpill', 0, 0, 1, 0, [[0, NE.cy], [0.35, NE.cy, 0], [0.62, NE.mag, 0], [1, NE.mag]]),
    // jacket satin: sheen at the top, deep at the hem
    lg('pb-gJk', 0.35, 0, 0.55, 1, [[0, HW.jkHi], [0.42, HW.jk], [1, HW.jkLo]]),
    // chrome (nail, earpiece, zipper pull): a hard horizon line reflection
    lg('pb-gChrome', 0, 0, 0, 1, [[0, HW.chromeHi], [0.38, HW.chrome], [0.5, HW.chromeDk], [0.62, HW.chromeMid], [1, HW.chromeHi]]),
    lg('pb-gLens', 0, 0, 1, 0.3, [[0, HW.lensDk, 0.5], [0.5, HW.lens, 0.22], [1, NE.cyCore, 0.5]]),
    lg('pb-gPouchSh', 0, 0, 0, 1, [[0.35, Od, 0], [1, Od, 0.5]]),
    lg('pb-gBillSh', 0, 0, 0, 1, [[0, NE.hot, 0.35], [0.3, NE.hot, 0], [0.8, Re, 0], [1, Re, 0.5]]),
    lg('pb-gFab', 0, 0, 0, 1, [[0, HW.fabHi], [0.55, HW.fab], [1, HW.fabLo]]),
    rg('pb-rgCy', [[0, NE.cyCore], [0.25, NE.cy, 0.75], [1, NE.cy, 0]]),
    rg('pb-rgMg', [[0, NE.magCore], [0.25, NE.mag, 0.75], [1, NE.mag, 0]]),
    rg('pb-rgAcid', [[0, NE.acidCore], [0.25, NE.acid, 0.75], [1, NE.acid, 0]]),
    rg('pb-rgRed', [[0, NE.magCore], [0.25, NE.red, 0.8], [1, NE.red, 0]]),
    rg('pb-rgAmber', [[0, NE.amber, 0.55], [1, NE.amber, 0]]),
  ].join('');
  // dual rim for a static closed shape d, drawn INSIDE a clip of the same shape: band glow + bright edge per hue.
  const rimIn = (d, w = 1, hues = ['pb-gCy', 'pb-gMg']) => hues.map(gid => h('path', { d, fill: 'none', stroke: `url(#${gid})`, 'stroke-width': f(9 * w), opacity: 0.3 })
    + h('path', { d, fill: 'none', stroke: `url(#${gid})`, 'stroke-width': f(2.8 * w) })).join('');
  const spill = (d, w = 1, op = 0.2) => h('path', { d, fill: 'none', stroke: 'url(#pb-gSpill)', 'stroke-width': f(8 * w), opacity: op, 'stroke-linejoin': 'round' });

  // ================================================================ NECK (rider space; deformer)
  // The outline lives once in <defs> (one d write per frame); fill, halo and clip all <use> it.
  s.neck = h('g', { 'data-detail': tag('O', 'neck') },
    h('defs', {}, h('path', { id: 'pb-neckG', 'data-ref': 'pb-neck', d: '' }),
      h('path', { id: 'pb-nkRimF', 'data-ref': 'pb-neckRimF', d: '' }), h('path', { id: 'pb-nkRimB', 'data-ref': 'pb-neckRimB', d: '' })),
    h('use', { href: '#pb-neckG', fill: 'none', stroke: 'url(#pb-gSpill)', 'stroke-width': 9, opacity: 0.22, 'data-detail': tag('O', 'neck-neon-spill') }),
    h('use', { href: '#pb-neckG', fill: P, stroke: INK, 'stroke-width': KW, 'stroke-linejoin': 'round' }),
    h('path', { 'data-ref': 'pb-neckShade', 'data-detail': tag('O', 'neck-nape-shade'), d: '', fill: 'none', stroke: Bk, 'stroke-width': 6, 'stroke-linecap': 'round', opacity: 0.55 }),
    h('path', { 'data-ref': 'pb-neckFlow', 'data-detail': tag('T', 'neck-feather-flow'), d: '', fill: 'none', stroke: Bk, 'stroke-width': 1.2, 'stroke-linecap': 'round' }),
    h('path', { 'data-ref': 'pb-neckFlow2', 'data-detail': tag('T', 'neck-feather-flow-fine'), d: '', fill: 'none', stroke: Bd, 'stroke-width': 0.85, 'stroke-linecap': 'round' }),
    h('path', { 'data-ref': 'pb-neckCrease', 'data-detail': tag('O', 'neck-throat-crease'), d: '', fill: 'none', stroke: Bk, 'stroke-width': 1.2, 'stroke-linecap': 'round' }),
    h('g', { 'data-detail': tag('O', 'neck-rim-cyan'), fill: 'none', 'stroke-linecap': 'round' },
      h('use', { href: '#pb-nkRimB', stroke: NE.cy, 'stroke-width': 6, opacity: 0.22 }), h('use', { href: '#pb-nkRimB', stroke: NE.cy, 'stroke-width': 2.2 }),
      h('use', { href: '#pb-nkRimB', stroke: NE.cyCore, 'stroke-width': 0.8 })),
    h('g', { 'data-detail': tag('O', 'neck-rim-magenta'), fill: 'none', 'stroke-linecap': 'round' },
      h('use', { href: '#pb-nkRimF', stroke: NE.mag, 'stroke-width': 6, opacity: 0.22 }), h('use', { href: '#pb-nkRimF', stroke: NE.mag, 'stroke-width': 2.2 }),
      h('use', { href: '#pb-nkRimF', stroke: NE.magCore, 'stroke-width': 0.8 })),
    // courier barcode tattoo on the nape (ink bars + a cyan status dot), riding the deformer
    h('g', { 'data-ref': 'pb-neckJack', 'data-detail': tag('O', 'nape-barcode-tattoo') },
      h('path', { d: 'M-6 -1.6v3.2M-4.6 -1.6v3.2M-2.4 -1.6v3.2M-1.2 -1.6v3.2M0.8 -1.6v3.2M3 -1.6v3.2M4 -1.6v3.2M6 -1.6v3.2', fill: 'none', stroke: INK, 'stroke-width': 0.7, opacity: 0.75 }),
      h('path', { d: 'M-3.4 -1.6v3.2M1.9 -1.6v3.2M5 -1.6v3.2', fill: 'none', stroke: INK, 'stroke-width': 1.3, opacity: 0.75 }),
      glowDisc(8.6, 0, 2.4, 'pb-rgCy'), h('circle', { cx: 8.6, cy: 0, r: 0.6, fill: NE.cyCore })),
  );

  // ================================================================ TAIL (tail-local: pivot at the rump, feathers along −x)
  // A short, square pelican tail: 5 tight rectrices with blunt, grey-tipped ends, rooted inside the rump (the body
  // slot draws over the roots, so the tail grows out from under the jacket's back vent) and angled a little down.
  {
    const TILT = -17;                                   // slot adds tailRot +8°: net ≈ 9° tip-down
    const fan = [[-7, 38, -6], [-3, 41, -3], [1, 42, 0], [5, 41, 3], [9, 38, 6]];
    let feathers = '', tips = '', shafts = '', rimT = '';
    fan.forEach(([ang0, L, yb], fi) => {
      const ang = ang0 + TILT, dir = rot([-1, 0], ang), nr = perp(dir), b = [8, yb];
      const at = (u, w) => add(add(b, mul(dir, u)), mul(nr, w)), w = 4.4;
      const o = [at(0, -w), at(L * 0.5, -w * 1.02), at(L - 1.6, -w * 0.96), at(L, -w * 0.55), at(L + 0.3, 0), at(L, w * 0.55), at(L - 1.6, w * 0.96), at(L * 0.5, w * 1.02), at(0, w)];
      feathers += h('path', { d: smooth(o, true, 1 / 9), fill: fi % 2 ? P : v('plume'), stroke: INK, 'stroke-width': 1.2, 'stroke-linejoin': 'round' });
      tips += `M${pt(at(L - 5, -w * 0.9))}L${pt(at(L - 1.6, -w * 0.9))}Q${pt(at(L + 0.3, -w * 0.5))} ${pt(at(L + 0.3, 0))}Q${pt(at(L + 0.3, w * 0.5))} ${pt(at(L - 1.6, w * 0.9))}L${pt(at(L - 5, w * 0.9))}Q${pt(at(L - 3.8, 0))} ${pt(at(L - 5, -w * 0.9))}Z`;
      shafts += `M${pt(at(L * 0.45, 0))}L${pt(at(L - 5.5, 0))}`;
      if (fi === 0) rimT += `M${pt(at(L * 0.2, -w * 0.72))}Q${pt(at(L * 0.6, -w * 0.86))} ${pt(at(L - 2, -w * 0.62))}`;
      if (fi === 4) rimT += `M${pt(at(L * 0.3, w * 0.7))}Q${pt(at(L * 0.62, w * 0.84))} ${pt(at(L - 3, w * 0.6))}`;
    });
    let cv = '';
    for (const [x, y, L, w] of [[2, -7, 16, 5.4], [0, -1.5, 14, 5.2]]) {
      const q = p => add([x, y], rot(p, TILT));
      const d = smooth([q([2, -w * 0.8]), q([-L * 0.5, -w * 0.8]), q([-L, 0.3]), q([-L * 0.5, w * 0.75]), q([2, w * 0.8])]);
      cv += h('path', { d, fill: P, stroke: INK, 'stroke-width': 1.1, 'stroke-linejoin': 'round' });
    }
    const uq = p => rot(p, TILT);
    const ut = smooth([[12, 8], [2, 11], [-8, 13.5], [-14, 12], [-9, 9], [2, 6]].map(uq));
    s.tail = h('g', { 'data-detail': tag('O', 'tail-rectrices') }, feathers,
      h('path', { 'data-detail': tag('O', 'tail-grey-tips'), d: tips, fill: Bk }),
      line(shafts, Bd, 0.7, { 'data-detail': tag('T', 'tail-rachis-lines') }),
      h('g', { 'data-detail': tag('O', 'tail-upper-coverts') }, cv),
      h('g', { 'data-detail': tag('O', 'undertail-coverts') }, h('path', { d: ut, fill: P, stroke: INK, 'stroke-width': 1.1, 'stroke-linejoin': 'round' }),
        line(`M${pt(uq([0, 9.5]))}Q${pt(uq([-5, 11]))} ${pt(uq([-9, 11.4]))}`, Bk, 0.9)),
      h('g', { 'data-detail': tag('O', 'tail-neon-rim') }, line(rimT, NE.mag, 3.4, { opacity: 0.25 }), line(rimT, NE.mag, 1.2), line(rimT, NE.magCore, 0.45)));
  }

  // ================================================================ BODY (pelvis-local): plumage, bomber jacket, LED scarf
  {
    const poly = bodyPoly();
    const o = smooth(poly);
    const CTR = [32, -50];
    let b = '';
    // far scarf tail, behind the body mass (dim far fabric; its LEDs are the far pair)
    b += h('g', { 'data-detail': tag('O', 'scarf-far-tail') },
      h('defs', {}, h('path', { id: 'pb-sfCL', 'data-ref': 'pb-sfCL', d: '', pathLength: 100 }), h('path', { id: 'pb-sfFr', 'data-ref': 'pb-sfFringe', d: '' })),
      h('path', { 'data-ref': 'pb-sfFill', d: '', fill: HW.fabFar, stroke: INK, 'stroke-width': 1 }),
      h('use', { href: '#pb-sfCL', fill: 'none', stroke: NE.mag, 'stroke-width': 0.9, opacity: 0.55 }),
      h('g', { 'data-ref': 'pb-sfLed', 'stroke-dasharray': '0.01 11', 'stroke-linecap': 'round', fill: 'none', opacity: 0.7 },
        h('use', { href: '#pb-sfCL', stroke: NE.mag, 'stroke-width': 6, opacity: 0.3 }), h('use', { href: '#pb-sfCL', stroke: NE.magCore, 'stroke-width': 2.2 })),
      h('g', { fill: 'none', 'stroke-linecap': 'round', opacity: 0.6 }, h('use', { href: '#pb-sfFr', stroke: NE.mag, 'stroke-width': 3.2, opacity: 0.3 }), h('use', { href: '#pb-sfFr', stroke: NE.magCore, 'stroke-width': 0.9 })));

    // ---------------- plumage under the jacket (only the belly band, the breast bib and the rump show)
    let inner = '';
    const DOWN = norm(rot([0.35, 1], -18)), BACK = norm(rot([-1, 0], -18));
    const row = (g, e0, e1, n, depth, gTilt = 0) => {
      const pts = []; for (let i = 0; i <= n; i++) { const u = i / n; pts.push(EL(lerp(e0, e1, u), g + gTilt * u)); }
      let d = '';
      for (let i = 0; i < n; i++) { const m = lerp2(pts[i], pts[i + 1], 0.5), q = add(m, add(mul(DOWN, depth * 2), mul(BACK, depth * 0.7))); d += `M${pt(pts[i])}Q${pt(q)} ${pt(pts[i + 1])}`; }
      return { d, pts };
    };
    const rows = defs0 => defs0.map(a => row(...a).d).join('');
    // belly: soft shade band along the lower edge (flat plumeShade, a touch of volume), then feather rows
    {
      const low = poly.filter(p => p[1] > -26 && p[0] > -70 && p[0] < 96).sort((a, c) => a[0] - c[0]);
      const band = [...low.map(p => [p[0], p[1] + 2]), ...low.slice().reverse().map(p => [p[0], p[1] - 7])];
      inner += h('path', { 'data-detail': tag('T', 'belly-shade-band'), d: 'M' + band.map(pt).join('L') + 'Z', fill: Bk, opacity: 0.55 });
    }
    inner += line(rows([[0.62, 0.62, -0.02, 6, 2.6, 0.02], [0.8, 0.5, -0.3, 5, 2.4, 0.02]]), Bk, 1.2, { 'data-detail': tag('T', 'belly-scallops'), 'data-tract': 'belly' });
    inner += line(rows([[-0.08, -0.62, -0.94, 3, 2.6, 0.1], [0.18, -0.62, -0.92, 3, 2.6, 0.08]]), Bk, 1.15, { 'data-detail': tag('T', 'rump-scallops'), 'data-tract': 'rump' });
    // breast bib (open jacket front): the yellowish breeding breast patch of P. onocrotalus in O, then fine P rows
    inner += h('path', { 'data-detail': tag('O', 'breast-buff-wash'), d: smooth([[98, -100], [116, -96], [126, -80], [126, -60], [118, -44], [106, -40], [104, -64]]), fill: O, opacity: 0.32 });
    inner += line(rows([[-0.64, 0.96, 0.7, 4, 1.8, 0.04], [-0.47, 0.98, 0.7, 4, 1.9, 0.04], [-0.3, 0.99, 0.72, 4, 2, 0.03]]), O, 1.3, { 'data-detail': tag('T', 'breast-buff-feathers'), 'data-tract': 'breast' });
    inner += line(rows([[-0.12, 0.99, 0.74, 3, 2, 0.03], [0.06, 0.98, 0.76, 3, 2.1, 0.02], [0.24, 0.96, 0.78, 3, 2.1, 0.02]]), Bk, 1.1, { 'data-detail': tag('T', 'breast-scallops'), 'data-tract': 'breast' });
    {
      let d = '';
      for (const a of [[0.62, 0.62, -0.02, 6, 2.6, 0.02]]) { const { pts } = row(...a); for (let i = 0; i < pts.length - 1; i++) { const m = lerp2(pts[i], pts[i + 1], 0.5); d += `M${pt(add(m, mul(DOWN, -1.5)))}L${pt(add(m, add(mul(DOWN, a[4] * 1.1), mul(BACK, a[4] * 0.4))))}`; } }
      inner += line(d, Bd, 0.7, { 'data-detail': tag('T', 'feather-shaft-ticks') });
    }
    inner += line('M-44 6Q-30 11 -12 10.5M-36 1.5Q-26 5 -16 4.6', Bk, 1.1, { 'data-detail': tag('O', 'saddle-compression-crease') });
    inner += line('M-66 -14Q-61 -7 -59 0M-61 -18Q-55 -13 -53 -7', Bk, 1, { 'data-detail': tag('O', 'vent-fluff') });
    b += h('g', { 'data-detail': tag('O', 'body') },
      spill(o, 1, 0.16),
      h('path', { d: o, fill: P, stroke: INK, 'stroke-width': KW, 'stroke-linejoin': 'round' }),
      h('clipPath', { id: 'pb-bodyclip' }, h('path', { d: o })),
      h('g', { 'clip-path': 'url(#pb-bodyclip)' }, inner, h('g', { 'data-detail': tag('O', 'plumage-neon-rim') }, rimIn(o, 0.9, ['pb-gCy', 'pb-gMg']))));

    // --- belly-on-saddle compression: along the saddle the belly arc is pushed down onto the saddle top (y 13) and
    // spreads a touch, so the weight visibly rests on it. Drawn over the key line.
    {
      const arc = [];
      for (let d = 60; d <= 175; d += 2.5) { const t = d * D2R, e = rot([98 * Math.cos(t), 58 * Math.sin(t)], -18), q = [32 + e[0], -50 + e[1]]; if (q[1] > 6 && q[0] > -42 && q[0] < 24) arc.push(q); }
      arc.sort((a, c) => a[0] - c[0]);
      const x0 = arc[0][0], x1 = arc[arc.length - 1][0];
      const low = arc.map(([x, y]) => { const u = (x - x0) / (x1 - x0), wgt = Math.sin(Math.PI * u) ** 0.6; return [x, lerp(y, 13.6, 0.85 * wgt)]; });
      const top = arc.map(([x, y]) => [x, y - 2.2]).reverse();
      const dB = 'M' + low.map(pt).join('L') + 'L' + top.map(pt).join('L') + 'Z';
      const ends = [low[Math.round(low.length * 0.1)], low[Math.round(low.length * 0.9)]];
      b += h('g', { 'data-detail': tag('O', 'belly-saddle-bulge') },
        h('path', { d: dB, fill: P }), line(qline(low), INK, KW),
        line(`M${pt(add(ends[0], [4, -2.6]))}q-2.6 0.4 -4.6 3.2q-0.8 -2.6 -3.2 -3.4M${pt(add(ends[1], [-4, -2.2]))}q2.6 0.4 4.4 3q0.8 -2.4 3 -3.2`, Bk, 1.1, { 'data-detail': tag('O', 'belly-splay-tufts') }));
    }

    // ---------------- the bomber jacket: the puffed body shell above the ribbed hem, open at the front zipper
    {
      const HEM = [[-72, -31], [-58, -21], [-30, -12.5], [10, -8], [50, -9.5], [80, -14.5], [96, -19]];   // hem lower edge
      const ZIP = [[93, -17], [101, -44], [107, -72], [111, -99]];                                          // zipper (open front edge)
      const clipPoly = [[-240, -260], [124, -260], [119, -101], ...ZIP.slice().reverse().map(p => add(p, [0.6, 0])), ...HEM.slice().reverse().map(p => add(p, [0, 0.4])), [-240, -34]];
      const shellPts = puff(poly, CTR, 2.2);
      const shell = smooth(shellPts);
      const cp = 'M' + clipPoly.map(pt).join('L') + 'Z';
      let jk = '';
      // quilted back panel: a diamond stitch grid clipped to the panel between the yoke and the hem
      {
        let dq = '';
        for (let k = -8; k <= 8; k++) { const x = -40 + k * 13; dq += `M${f(x)} -20L${f(x + 60)} -110M${f(x)} -20L${f(x - 60)} -110`; }
        jk += h('clipPath', { id: 'pb-quiltclip' }, h('path', { d: smooth([[-60, -40], [-34, -74], [4, -94], [48, -104], [66, -80], [56, -28], [10, -16], [-40, -20]]) }));
        jk += h('g', { 'clip-path': 'url(#pb-quiltclip)', 'data-detail': tag('T', 'jacket-quilt-stitching') },
          line(dq, HW.jkLo, 1.5), line(dq, HW.jkHi, 0.55, { 'stroke-dasharray': '1.6 1.5', transform: 'translate(0.9 -0.5)' }));
      }
      // satin sheen along the upper back + a cyan environment reflection streak
      jk += h('g', { 'data-detail': tag('O', 'jacket-satin-sheen') },
        line('M-50 -52Q-20 -86 30 -101Q60 -108 88 -104', HW.jkHi, 8, { opacity: 0.55 }),
        line('M-42 -58Q-14 -86 30 -98', NE.cy, 1.4, { opacity: 0.35 }), line('M40 -104Q64 -108 84 -105', NE.hot, 0.9, { opacity: 0.45 }));
      // yoke seam with magenta piping (stacked-stroke neon) + stitch line under it
      const YOKE = 'M-58 -46Q-30 -66 2 -80Q40 -94 84 -94Q100 -94 112 -96';
      jk += h('g', { 'data-detail': tag('O', 'jacket-yoke-seam') }, line(YOKE, HW.seam, 2.2), line('M-56 -41Q-28 -61 4 -75Q40 -89 84 -89', HW.jkHi, 0.55, { 'stroke-dasharray': '1.4 1.6' }));
      jk += neon(YOKE, NE.mag, NE.magCore, 1.1, { 'data-detail': tag('O', 'jacket-magenta-piping'), transform: 'translate(0 -1.4)' });
      // taped side seam (techwear): dark tape with a hairline highlight
      jk += h('g', { 'data-detail': tag('O', 'jacket-taped-side-seam') }, line('M36 -92Q44 -62 40 -14', HW.seam, 3.4), line('M38 -92Q46 -62 42 -15', HW.jkHi, 0.6));
      // fabric compression folds where the jacket bunches above the saddle
      jk += h('g', { 'data-detail': tag('O', 'jacket-compression-folds') },
        line('M-40 -22Q-26 -30 -12 -24M-8 -18Q6 -26 20 -18M-54 -30Q-48 -38 -38 -36', HW.jkLo, 1.5), line('M-38 -24.5Q-26 -32 -14 -26.5M-6 -20.5Q6 -28 18 -20.5', HW.jkHi, 0.6));
      // PELICAN patch (woven label, cyan neon thread border) on the back panel
      {
        const pw = 50, ph = 15, gs = 44 / GLYPH.PELICAN.w * 100;
        jk += h('g', { 'data-detail': tag('O', 'patch-pelican'), transform: 'translate(-2 -56) rotate(-14)' },
          h('rect', { x: -pw / 2 - 1.2, y: -ph / 2 + 1.4, width: pw + 2.4, height: ph, rx: 2.4, fill: HW.seam, opacity: 0.55 }),
          h('rect', { x: -pw / 2, y: -ph / 2, width: pw, height: ph, rx: 2.4, fill: HW.patch }),
          neon(`M${-pw / 2 + 1.2} ${-ph / 2 + 1.2}h${pw - 2.4}v${ph - 2.4}h${-(pw - 2.4)}Z`, NE.cy, NE.cyCore, 0.6),
          glyph(GLYPH.PELICAN, -22, 3.2, gs, NE.cy, { opacity: 0.35, 'stroke-width': 90, stroke: NE.cy, 'stroke-linejoin': 'round' }),
          glyph(GLYPH.PELICAN, -22, 3.2, gs, NE.cyCore));
      }
      // courier number under the patch (reflective acid print)
      jk += h('g', { 'data-detail': tag('O', 'courier-number') }, glyph(GLYPH.NUM, -12, -34, 6.2, NE.acid, { transform: 'translate(-12 -34) rotate(-14) scale(0.062)' }));
      // 鹈鹕 embroidered tab, vertical, magenta, near the rear of the back panel
      {
        const gs = 9.4;
        jk += h('g', { 'data-detail': tag('O', 'patch-hanzi'), transform: 'translate(-38 -40) rotate(-26)' },
          h('rect', { x: -6.6, y: -11.6, width: 13.2, height: 23.2, rx: 1.8, fill: NE.mag }),
          h('rect', { x: -5.2, y: -10.2, width: 10.4, height: 20.4, rx: 1.2, fill: 'none', stroke: NE.magCore, 'stroke-width': 0.5, 'stroke-dasharray': '0.8 0.8' }),
          h('path', { d: GLYPH.HAN.d, fill: HW.patch, transform: `translate(-4.6 -1.6) scale(${f(gs / 100)})`, 'clip-path': 'url(#pb-han1)' }),
          h('clipPath', { id: 'pb-han1' }, h('rect', { x: 0, y: -100, width: 100, height: 130 })),
          h('clipPath', { id: 'pb-han2' }, h('rect', { x: 100, y: -100, width: 100, height: 130 })),
          h('path', { d: GLYPH.HAN.d, fill: HW.patch, transform: `translate(${f(-4.6 - gs)} 8.6) scale(${f(gs / 100)})`, 'clip-path': 'url(#pb-han2)' }));
      }
      // clip-on rear light on the back hem (blinks: opacity only, low rate)
      const rearLight = h('g', { 'data-detail': tag('O', 'clip-on-rear-light'), transform: 'translate(-63.4 -28.6) rotate(-36)' },
        h('rect', { x: -3.6, y: -6.4, width: 7.2, height: 12.8, rx: 2.4, fill: HW.chromeDk, stroke: INK, 'stroke-width': 0.8 }),
        h('g', { 'data-ref': 'pb-rearLed' }, glowDisc(0, 0, 11, 'pb-rgRed', 0.8), h('rect', { x: -2.2, y: -4.6, width: 4.4, height: 9.2, rx: 1.6, fill: NE.red }),
          line('M-0.8 -3.4v6.8', NE.magCore, 0.9)));
      // jacket assembly: halo spill, shell, details, the dual neon rim, all clipped to "above the hem, behind the zip"
      b += h('clipPath', { id: 'pb-jkclip' }, h('path', { d: cp }));
      b += h('clipPath', { id: 'pb-shellclip' }, h('path', { d: shell }));
      b += h('g', { 'clip-path': 'url(#pb-jkclip)' },
        spill(shell, 1.1, 0.22),
        h('path', { d: shell, fill: 'url(#pb-gJk)', 'data-detail': tag('O', 'jacket-shell') }),
        h('g', { 'clip-path': 'url(#pb-shellclip)' }, jk, h('g', { 'data-detail': tag('O', 'jacket-neon-rim') }, rimIn(shell, 1))),
        h('path', { d: shell, fill: 'none', stroke: INK, 'stroke-width': KW + 0.2, 'stroke-linejoin': 'round' }));
      // shadow the hem casts on the belly feathers
      const hemD = qline(HEM);
      b += h('g', { 'clip-path': 'url(#pb-bodyclip)', 'data-detail': tag('O', 'hem-cast-shadow') }, line(hemD, Bd, 5, { opacity: 0.45, transform: 'translate(0 3.6)' }));
      // ribbed hem band + acid reflective strip + magenta top piping (clipped to the shell)
      const bandD = qline(HEM.map(p => add(p, [0, -4.4])));
      b += h('g', { 'clip-path': 'url(#pb-shellclip)' },
        h('g', { 'data-detail': tag('O', 'jacket-hem-band') }, line(bandD, INK, 10.6, { 'stroke-linecap': 'butt' }), line(bandD, HW.jkLo, 8.6, { 'stroke-linecap': 'butt' })),
        line(bandD, HW.jkHi, 7.6, { 'stroke-linecap': 'butt', 'stroke-dasharray': '0.9 1.5', 'data-detail': tag('T', 'jacket-hem-rib') }),
        h('g', { 'data-detail': tag('O', 'hem-reflective-strip') }, line(bandD, NE.acid, 1.3, { transform: 'translate(0 -0.4)' }), line(bandD, NE.acidCore, 0.4, { transform: 'translate(0 -0.4)' })), rearLight);
      // zipper: open front edge (tape, chrome teeth, pull with an LED tab)
      const zipD = qline(ZIP);
      b += h('g', { 'data-detail': tag('O', 'jacket-zipper') }, line(zipD, INK, 3.4), line(zipD, NE.cy, 0.7, { opacity: 0.65, transform: 'translate(1.8 0)' }));
      b += line(zipD, HW.chrome, 1.5, { 'stroke-dasharray': '0.9 0.9', 'stroke-linecap': 'butt', 'data-detail': tag('T', 'zipper-teeth') });
      b += h('g', { 'data-detail': tag('O', 'zipper-pull'), transform: 'translate(106.2 -68) rotate(14)' },
        h('rect', { x: -1.6, y: -1, width: 3.2, height: 3, rx: 0.6, fill: 'url(#pb-gChrome)', stroke: INK, 'stroke-width': 0.5 }),
        h('path', { d: 'M-1.4 2L-1.8 9.6Q0 11 1.8 9.6L1.4 2Z', fill: 'url(#pb-gChrome)', stroke: INK, 'stroke-width': 0.6 }),
        h('circle', { cx: 0, cy: 8, r: 0.9, fill: NE.acid }));
    }

    // --- LED scarf (canonical frame, placed by update): collar + cast shadow | near tail | wrap | hanging end | knot
    const wrapPts = [W_(-21, 10), W_(-8, 13.5), W_(8, 13.5), W_(21, 10), W_(24, 1), W_(21, -9), W_(8, -13), W_(-8, -13), W_(-21, -9), W_(-24, 1)];
    const wrap = smooth(wrapPts);
    let gA = h('path', { d: smooth(wrapPts.slice(5).concat([W_(-18, -17), W_(0, -19), W_(18, -16)]).map(p => add(p, mul(NU, -3)))), fill: Bd, opacity: 0.7 });  // cast shadow
    {
      // ribbed knit collar of the bomber hugging the neck base
      const cA = W_(-25, -12), cB = W_(25, -12);
      const cd = smooth([W_(-26, -9), W_(0, -12.5), W_(26, -9), W_(27, -19), W_(0, -22), W_(-27, -19)]);
      gA += h('g', { 'data-detail': tag('O', 'jacket-rib-collar') }, h('path', { d: cd, fill: HW.jkLo, stroke: INK, 'stroke-width': 1.1 }),
        h('clipPath', { id: 'pb-collarclip' }, h('path', { d: cd })),
        h('g', { 'clip-path': 'url(#pb-collarclip)' }, (() => { let d = ''; for (let a = -26; a <= 26; a += 2.2) d += `M${pt(W_(a, -8))}L${pt(W_(a * 1.04, -23))}`; return line(d, HW.jkHi, 0.7); })()),
        neon(`M${pt(cA)}Q${pt(W_(0, -15.5))} ${pt(cB)}`, NE.mag, NE.magCore, 0.7, { transform: `translate(${pt(mul(NU, -8.6))})` }));
      // neck-base feather tips poking out below the scarf
      let d = '', dl = '';
      for (let i = 0; i < 4; i++) {
        const a = -21 + i * 6.8, c = W_(a, -10.5 - (i % 2) * 1.2), u = mul(NU, -1);
        const nrm = perp(u), p0 = add(c, mul(nrm, -3.8)), p1 = add(c, mul(nrm, 3.8)), q = add(c, mul(u, 9));
        d += `M${pt(add(p0, mul(u, -2)))}L${pt(p0)}Q${pt(q)} ${pt(p1)}L${pt(add(p1, mul(u, -2)))}Z`;
        dl += `M${pt(p0)}Q${pt(q)} ${pt(p1)}`;
      }
      gA += h('g', { 'data-detail': tag('O', 'collar-ruff') }, h('path', { d, fill: P }), line(dl, INK, 1));
    }
    b += h('g', { 'data-ref': 'pb-scarfA', transform: XF0 }, gA);
    // near trailing end: fabric ribbon + neon centre stripe + chasing LEDs (dash patterns on a pathLength=100 centreline)
    b += h('g', { 'data-detail': tag('O', 'scarf-trailing-end') },
      h('defs', {}, h('path', { id: 'pb-snCL', 'data-ref': 'pb-snCL', d: '', pathLength: 100 }), h('path', { id: 'pb-snFr', 'data-ref': 'pb-snFringe', d: '' })),
      h('path', { 'data-ref': 'pb-snFill', d: '', fill: 'url(#pb-gFab)', stroke: INK, 'stroke-width': 1.1, 'stroke-linejoin': 'round' }),
      h('path', { 'data-ref': 'pb-snKnit', 'data-detail': tag('T', 'scarf-weave'), d: '', fill: 'none', stroke: HW.fabHi, 'stroke-width': 0.7, 'stroke-dasharray': '1.2 1.8' }),
      h('g', { 'data-detail': tag('O', 'scarf-neon-stripe'), fill: 'none', 'stroke-linecap': 'round' },
        h('use', { href: '#pb-snCL', stroke: NE.cy, 'stroke-width': 4, opacity: 0.22 }), h('use', { href: '#pb-snCL', stroke: NE.cy, 'stroke-width': 1 })),
      h('g', { 'data-ref': 'pb-snLedA', 'data-detail': tag('O', 'scarf-led-chase'), 'stroke-dasharray': '0.01 12', 'stroke-linecap': 'round', fill: 'none' },
        h('use', { href: '#pb-snCL', stroke: NE.cy, 'stroke-width': 7, opacity: 0.3 }), h('use', { href: '#pb-snCL', stroke: NE.cy, 'stroke-width': 3.2 }), h('use', { href: '#pb-snCL', stroke: NE.hot, 'stroke-width': 1.3 })),
      h('g', { 'data-ref': 'pb-snLedB', 'stroke-dasharray': '0.01 12', 'stroke-linecap': 'round', fill: 'none' },
        h('use', { href: '#pb-snCL', stroke: NE.mag, 'stroke-width': 7, opacity: 0.3 }), h('use', { href: '#pb-snCL', stroke: NE.mag, 'stroke-width': 3.2 }), h('use', { href: '#pb-snCL', stroke: NE.hot, 'stroke-width': 1.3 })),
      h('g', { 'data-detail': tag('O', 'scarf-fibre-fringe'), fill: 'none', 'stroke-linecap': 'round' },
        h('use', { href: '#pb-snFr', stroke: NE.cy, 'stroke-width': 3.6, opacity: 0.3 }), h('use', { href: '#pb-snFr', stroke: NE.cy, 'stroke-width': 1.1 }), h('use', { href: '#pb-snFr', stroke: NE.cyCore, 'stroke-width': 0.45 })));
    {
      let hatch = '';
      for (let a = -21; a <= 4; a += 3.1) hatch += `M${pt(W_(a, -12.6))}L${pt(W_(a + 2.4, -8.2))}`;
      let leds = '';
      for (let a = -18; a <= 18; a += 7.2) leds += `M${pt(W_(a, 1.2))}h0`;
      b += h('g', { 'data-ref': 'pb-scarfB', transform: XF0 }, h('g', { 'data-detail': tag('O', 'scarf-wrap') },
        h('path', { d: wrap, fill: 'url(#pb-gFab)', stroke: INK, 'stroke-width': 1.2 }),
        h('clipPath', { id: 'pb-wrapclip' }, h('path', { d: wrap })),
        h('g', { 'clip-path': 'url(#pb-wrapclip)' },
          line(hatch, HW.fabLo, 0.9, { 'data-detail': tag('T', 'scarf-shade-hatching') }),
          h('g', { 'data-detail': tag('O', 'scarf-wrap-neon-bands') },
            neon(`M${pt(W_(-25, 6.4))}Q${pt(W_(0, 9.6))} ${pt(W_(25, 6.4))}`, NE.cy, NE.cyCore, 0.8),
            neon(`M${pt(W_(-25, -4.6))}Q${pt(W_(0, -7.8))} ${pt(W_(25, -4.6))}`, NE.mag, NE.magCore, 0.8)),
          h('g', { 'data-ref': 'pb-wrapLed', 'data-detail': tag('O', 'scarf-wrap-leds') }, line(leds, NE.acid, 6, { opacity: 0.25 }), line(leds, NE.acid, 2.6), line(leds, NE.acidCore, 1.1)))));
    }
    // short front end hanging from the knot
    b += h('g', { 'data-detail': tag('O', 'scarf-hanging-end') },
      h('defs', {}, h('path', { id: 'pb-shCL', 'data-ref': 'pb-shCL', d: '', pathLength: 100 }), h('path', { id: 'pb-shFr', 'data-ref': 'pb-shFringe', d: '' })),
      h('path', { 'data-ref': 'pb-shFill', d: '', fill: 'url(#pb-gFab)', stroke: INK, 'stroke-width': 1, 'stroke-linejoin': 'round' }),
      h('use', { href: '#pb-shCL', fill: 'none', stroke: NE.mag, 'stroke-width': 0.9 }),
      h('g', { 'data-ref': 'pb-shLed', 'stroke-dasharray': '0.01 16', 'stroke-linecap': 'round', fill: 'none' },
        h('use', { href: '#pb-shCL', stroke: NE.acid, 'stroke-width': 6, opacity: 0.3 }), h('use', { href: '#pb-shCL', stroke: NE.acid, 'stroke-width': 2.8 }), h('use', { href: '#pb-shCL', stroke: NE.acidCore, 'stroke-width': 1.1 })),
      h('g', { 'data-detail': tag('O', 'scarf-fringe-magenta'), fill: 'none', 'stroke-linecap': 'round' },
        h('use', { href: '#pb-shFr', stroke: NE.mag, 'stroke-width': 3.4, opacity: 0.3 }), h('use', { href: '#pb-shFr', stroke: NE.mag, 'stroke-width': 1 }), h('use', { href: '#pb-shFr', stroke: NE.magCore, 'stroke-width': 0.4 })));
    // the knot is the scarf's power pod: a fabric knot around a round LED hub (pulses slowly)
    b += h('g', { 'data-ref': 'pb-scarfC', transform: XF0 }, h('g', { 'data-detail': tag('O', 'scarf-knot') },
      h('ellipse', { cx: f(KNOT[0]), cy: f(KNOT[1]), rx: 8, ry: 7, fill: 'url(#pb-gFab)', stroke: INK, 'stroke-width': 1.1, transform: `rotate(-62 ${f(KNOT[0])} ${f(KNOT[1])})` }),
      line(`M${pt(add(KNOT, [-5, -3]))}Q${pt(add(KNOT, [1, -1]))} ${pt(add(KNOT, [3, 5.5]))}`, HW.fabHi, 1.6, {}),
      h('g', { 'data-detail': tag('O', 'scarf-power-hub') },
        h('circle', { cx: f(KNOT[0] + 0.5), cy: f(KNOT[1] + 0.5), r: 3.6, fill: HW.seam, stroke: HW.chromeMid, 'stroke-width': 0.8 }),
        h('g', { 'data-ref': 'pb-hubGlow' }, glowDisc(KNOT[0] + 0.5, KNOT[1] + 0.5, 8, 'pb-rgAcid', 0.85)),
        h('circle', { cx: f(KNOT[0] + 0.5), cy: f(KNOT[1] + 0.5), r: 1.7, fill: NE.acid }),
        h('circle', { cx: f(KNOT[0] + 0.1), cy: f(KNOT[1] + 0.1), r: 0.6, fill: NE.acidCore }))));
    const lowP = poly.reduce((a, p) => (p[1] > a[1] ? p : a), poly[0]);
    b += h('g', { 'data-ref': 'pb-seat', 'data-anchor': 'pb-seatContact', transform: `translate(${f(lowP[0])} ${f(lowP[1])})` });
    s.body = b;
  }

  // ================================================================ POUCH (pouch-local: hangs +y under the lower mandible)
  {
    const po = 'M-26 -3L108 -3C100 4 88 13 70 21C52 28 30 31.5 10 31.5C-8 31.5 -24 30 -36 25.5C-40 21 -40 15 -37 10C-34 5 -30 0 -26 -3Z';
    const edge = resample([[108, -3], [92, 10], [70, 21], [42, 29.6], [10, 31.5], [-14, 30.6], [-36, 25.5], [-39.4, 17], [-37, 10]], 2);
    // circuit tattoo: PCB traces with 45° bends, via pads and a tiny chip, in cyan ink that glows (emissive)
    const TR = 'M-30 13h10l6 -6h16l5 5h20l6 -6h14l5 5h14M-24 21h18l5 5h14l4 -4h20l6 6M6 12l6 -8h22M44 12l5 6h16l6 -6h8M62 6h14l6 -5M-8 26h10M30 26v3.6';
    const PADS = [[-30, 13], [88, 11], [-24, 21], [57, 22], [34, 4], [79, 12], [82, 1], [2, 26], [30, 29.6], [6, 12]];
    const pads = PADS.map(([x, y]) => `M${x} ${y}h0`).join('');
    s.pouch = h('g', { 'data-detail': tag('O', 'pouch') },
      h('path', { d: po, fill: O }),
      h('clipPath', { id: 'pb-pouchclip' }, h('path', { d: po })),
      h('g', { 'clip-path': 'url(#pb-pouchclip)' },
        h('path', { d: po, fill: 'url(#pb-gPouchSh)', 'data-detail': tag('O', 'pouch-lower-shade') }),
        h('path', { 'data-ref': 'pb-pouchGlow', d: 'M-20 2C10 8 60 8 98 0C88 12 66 20 44 24C20 27 -8 26 -28 20Z', fill: NE.amber, opacity: 0.45, style: 'display:none' }),
        h('g', { 'data-ref': 'pb-pouchFish', style: 'display:none' },
          h('path', { d: 'M18 0C13 -5.6 -1 -7 -10 -3L-20 -8.4L-17.6 0L-20 8.4L-10 3C-1 7 13 5.6 18 0Z', fill: Od, opacity: 0.7 }),
          line('M4 -4.6Q7 0 4 4.6', O, 0.9), h('circle', { cx: 12.4, cy: -1, r: 1.3, fill: O })),
        line('M-30 7C-4 14 40 16 92 3M-34 15C-6 23 36 24 76 13M-34 22C-10 29 22 30 54 23', Re, 1.1, { 'data-detail': tag('T', 'pouch-stretch-lines'), 'data-stretch': 'sy', opacity: 0.8 }),
        // circuit: soft glow under-stroke (pulses), the trace, bright via pads, a chip
        h('g', { 'data-detail': tag('O', 'pouch-circuit-tattoo') },
          h('g', { 'data-ref': 'pb-circGlow' }, line(TR, NE.cy, 3.8, { opacity: 0.22 })),
          line(TR, NE.cy, 0.95), line(TR, NE.cyCore, 0.35)),
        h('g', { 'data-detail': tag('O', 'circuit-via-pads') }, line(pads, NE.cy, 3.2), line(pads, NE.cyCore, 1.4)),
        h('g', { 'data-detail': tag('O', 'circuit-chip'), transform: 'translate(22 15) rotate(-8)' },
          h('rect', { x: -4.4, y: -2.6, width: 8.8, height: 5.2, rx: 0.8, fill: 'none', stroke: NE.cy, 'stroke-width': 0.8 }),
          line('M-3.2 -2.6v-1.6M-1 -2.6v-1.6M1.2 -2.6v-1.6M3.4 -2.6v-1.6M-3.2 2.6v1.6M-1 2.6v1.6M1.2 2.6v1.6M3.4 2.6v1.6', NE.cy, 0.5),
          h('circle', { cx: -2.6, cy: -0.9, r: 0.6, fill: NE.cyCore })),
        line('M-33 14q-1.6 4 -0.6 8M-28.4 16q-1.4 4.4 -0.4 8.6M-23.6 17.6q-1.2 4.4 0 8.6M-18.8 19q-1 4.2 0 8', Od, 0.9, { 'data-detail': tag('T', 'pouch-throat-wrinkles'), opacity: 0.8 }),
        line('M4 22q3 3 7 3M18 24q3 3 7 2.6M32 23q3 3 7 1.6M46 19.5q3 2.6 6.6 1', Od, 0.9, { 'data-detail': tag('T', 'pouch-sag-folds'), opacity: 0.8 }),
        h('g', { 'data-detail': tag('O', 'pouch-neon-rim') }, rimIn(po, 0.8, ['pb-gCyBot', 'pb-gCy']))),
      line(splitQ(edge), Re, 1.4, { 'data-detail': tag('O', 'pouch-edge-line') }),
      line('M14 1.6C36 6 60 5.4 90 0.6', NE.hot, 1.6, { 'data-detail': tag('O', 'pouch-highlight'), opacity: 0.75 }),
      line('M-12 -1q4 3 8 0q4 3 8 0q4 3 8 0q4 3 8 0q4 3 8 0q4 3 8 0q4 3 8 0q4 3 8 0q4 3 8 0q4 2.6 8 0q4 2.2 8 0q4 2 8 0', Re, 0.9, { 'data-detail': tag('O', 'pouch-rim-folds') }));
  }

  // ================================================================ LOWER BILL (pivot at the gape; +x along the bill)
  {
    const lb = 'M-4 -0.4L114 -0.6C117.4 0 118.4 2.2 115.6 3.8L0 5.6C-4 5 -5.4 1.2 -4 -0.4Z';
    s.billLower = h('g', { 'data-detail': tag('O', 'bill-lower') },
      h('path', { d: lb, fill: K }),
      line('M0 5L115 3.4', Re, 1.3, { 'data-detail': tag('O', 'mandible-ramus-line') }),
      line('M20 2.4L104 1.6', NE.hot, 0.8, { 'stroke-dasharray': '10 5', opacity: 0.7, 'data-detail': tag('O', 'ramus-sheen') }),
      line('M4 5.4L112 3.8', NE.cy, 0.8, { opacity: 0.8, 'data-detail': tag('O', 'ramus-cyan-rim') }),
      h('g', { 'data-ref': 'pb-drips', style: 'display:none' },
        ...[[40, 6, 1], [76, 5, 0.8], [100, 4, 1.1]].map(([x, y, k], i) => h('path', { 'data-ref': 'pb-drip' + i, d: `M${x} ${y}c${f(-1.8 * k)} ${f(3 * k)} ${f(-1.8 * k)} ${f(5 * k)} 0 ${f(5 * k)}s${f(1.8 * k)} ${f(-2 * k)} 0 ${f(-5 * k)}Z`, fill: NE.cyCore, stroke: NE.cy, 'stroke-width': 0.7, opacity: 0.9 }))));
  }

  // ================================================================ UPPER BILL (pivot at the gape)
  {
    const ub = 'M-4 -13C20 -13.6 60 -9.8 100 -7.1C110 -6.5 117 -6.9 121 -6.7L121 3.1L-2 4.1C-6 1 -7 -8 -4 -13Z';
    const nail = 'M114 -6.6C120 -7.6 126 -7 129.6 -3.8C132.6 0.5 131.8 6 128.6 10.8C127.6 7.6 125 5.2 121 4L114 3.4Z';
    s.billUpper = h('g', { 'data-detail': tag('O', 'bill-upper') },
      h('path', { d: ub, fill: K }),
      h('clipPath', { id: 'pb-billclip' }, h('path', { d: ub })),
      h('g', { 'clip-path': 'url(#pb-billclip)' }, h('path', { d: ub, fill: 'url(#pb-gBillSh)', 'data-detail': tag('O', 'bill-sheen') }),
        h('g', { 'data-detail': tag('O', 'culmen-neon-rim') }, rimIn(ub, 0.7, ['pb-gMgTop']))),
      line('M-2 3.7L119 2.9', Re, 1.4, { 'data-detail': tag('O', 'tomium-line') }),
      line('M24 -0.6C56 -0.8 88 -1.4 116 -1.6', Re, 0.8, { 'data-detail': tag('O', 'maxillary-groove') }),
      line('M28 -4.2l-0.8 3.2M33 -4.4l-0.8 3.3M38 -4.4l-0.8 3.3M43 -4.3l-0.8 3.2M48 -4.1l-0.7 3', Re, 0.7, { 'data-detail': tag('T', 'bill-growth-ridges') }),
      line('M4 -8.2C40 -6.8 80 -5 114 -4.3', Re, 1.1, { 'data-detail': tag('O', 'culmen-ridge') }),
      line('M6 -11.2C40 -10.2 76 -8.2 104 -7', NE.hot, 1.2, { 'data-detail': tag('O', 'culmen-highlight'), opacity: 0.8 }),
      line('M30 -6.7Q36 -7.1 44 -6.2', N, 1.1, { 'data-detail': tag('O', 'nostril-slit') }),
      // laser-etched courier serial on the side of the mandible
      glyph(GLYPH.SER, 60, -1.6, 4.4, Re, { 'data-detail': tag('O', 'bill-serial-etching'), opacity: 0.85 }),
      h('path', { 'data-detail': tag('O', 'bill-tip-shadow'), d: 'M104 3.1L125 4.8C126.5 6.4 127 8 127.4 10C122 8 112 6 104 5Z', fill: Od, opacity: 0.7 }),
      // chrome nail: mirror gradient + hard white glint + a cyan environment reflection + tiny glow
      h('g', { 'data-detail': tag('O', 'chrome-nail-hook') },
        glowDisc(128, -1, 7, 'pb-rgCy', 0.35),
        h('path', { d: nail, fill: 'url(#pb-gChrome)', stroke: INK, 'stroke-width': 0.9 }),
        line('M119 -5.1C123.4 -5.5 127 -4 128.6 -1.2', HW.chromeHi, 1.1, { 'data-detail': tag('O', 'nail-highlight') }),
        line('M129.8 1Q130.2 4.6 128.6 8', NE.cy, 0.9, { 'data-detail': tag('O', 'nail-cyan-reflection') }),
        line('M117 2.6Q121 2.4 124.6 4.2', NE.mag, 0.8, { opacity: 0.9, 'data-detail': tag('O', 'nail-magenta-reflection') }),
        line('M126.2 5.6C127.6 7 128.2 8.6 128.6 10.8', INK, 0.9, { 'data-detail': tag('O', 'nail-under-hook') })));
  }

  // ================================================================ HEAD (head-local, skull r≈26)
  {
    const outline = [[-26, 12], [-30.5, -3], [-25, -19], [-11, -29], [5, -30.5], [19, -25.6], [29, -17], [37, -9.6], [47.5, -4.4], [36, -3.6], [26, -1], [21, 6], [12, 14], [0, 19], [-14, 18.5]];
    const o = smooth(outline);
    const skin = smooth([[-9, -5], [-5.5, -13], [3, -17], [13, -17.6], [22, -14], [28, -8.5], [31, -2.5], [25, 4.5], [13, 5], [4, 3.4], [-4, 1.6]]);
    let inner = h('path', { 'data-detail': tag('O', 'facial-skin'), d: skin, fill: Ks });
    {
      const edge = [[-9.5, -3], [-7.4, -9.4], [-3.4, -14.2], [2.6, -17.2]];
      let d = `M-14 -1L${pt(edge[0])}`, dl = '';
      for (let i = 0; i < edge.length - 1; i++) {
        const a = edge[i], c = edge[i + 1], m = lerp2(a, c, 0.5), n = perp(norm(sub(c, a))), q = add(m, mul(n, -3.2));
        d += `Q${pt(q)} ${pt(c)}`; dl += `M${pt(a)}Q${pt(q)} ${pt(c)}`;
      }
      d += 'L0 -24L-14 -24Z';
      inner += h('g', { 'data-detail': tag('O', 'cheek-feather-edge') }, h('path', { d, fill: P }), line(dl, Bk, 1));
      const chin = [[-8, 3.4], [-1, 5.4], [6, 7], [12, 8.6]];
      let dcl = '';
      const dc = `M-12 3L${pt(chin[0])}` + chin.slice(1).map((c, i) => { const a = chin[i], m = lerp2(a, c, 0.5), n = perp(norm(sub(c, a))), q = add(m, mul(n, 3.4)); dcl += `M${pt(a)}Q${pt(q)} ${pt(c)}`; return `Q${pt(q)} ${pt(c)}`; }).join('') + 'L12 24L-12 24Z';
      inner += h('g', { 'data-detail': tag('O', 'chin-feathers') }, h('path', { d: dc, fill: P }), line(dcl, Bk, 1));
    }
    inner += line('M6 -26.4l-3.6 1.8M12 -24.6l-3.8 1.6M18 -21.6l-3.6 1.4M9 -20.4l-3.4 1.2M15 -18.6l-3 1', Bk, 0.9, { 'data-detail': tag('T', 'forehead-feather-flecks') });
    inner += line('M-27 8Q-22 12 -16 13M-22 14Q-17 16 -12 16.4', Bk, 1, { 'data-detail': tag('O', 'nape-edge') });
    inner += h('g', { 'data-detail': tag('O', 'head-neon-rim') }, rimIn(o, 0.8));
    const keyPts = resample([[21, 6], [12, 14], [0, 19], [-14, 18.5], [-26, 12], [-30.5, -3], [-25, -19], [-11, -29], [5, -30.5], [19, -25.6], [29, -17], [37, -9.6], [47.5, -4.4]], 2);
    s.head = h('g', { 'data-detail': tag('O', 'head') },
      spill(o, 0.8, 0.2),
      h('path', { d: o, fill: P }),
      h('clipPath', { id: 'pb-headclip' }, h('path', { d: o })),
      h('g', { 'clip-path': 'url(#pb-headclip)' }, inner),
      key(splitQ(keyPts)),
      // feathered forehead point pressing onto the culmen base (P. onocrotalus field mark)
      h('g', { 'data-detail': tag('O', 'forehead-feather-point') },
        h('path', { d: 'M24 -18C32 -12 40 -7 48 -4.4C40 -3.2 33 -3.4 26 -4.6C24 -8 23 -13 24 -18Z', fill: P }),
        line('M26 -4.6C33 -3.4 40 -3.2 48 -4.4', INK, 1.2), line('M30 -9.6Q36 -7 41 -5.4', Bk, 0.8),
        line('M25 -17.4C32 -12 39 -7.4 47 -4.8', NE.mag, 0.9, { opacity: 0.85 })),
      // gape: the mouth line runs back under the eye and turns up at the corner (a cool little smirk)
      line(splitQ(resample([[40, 9.2], [26, 6.4], [14, 3.8], [5, 1.8], [0.4, 0.6]], 2)), Re, 1.8, { 'data-detail': tag('O', 'gape-smile-line') }),
      h('g', { 'data-ref': 'pb-smile' }, line('M0.4 0.6Q-1.6 -0.4 -1.8 -2.8', Re, 1.3, { 'data-detail': tag('O', 'smile-crease') })),
      // closed-eye line (blink / happy squint); the eye slot itself squashes to nothing
      line('M-1.4 -7.6Q6 -12.2 13.6 -8', N, 2, { 'data-ref': 'pb-lidClosed', style: 'display:none' }));
  }

  // ================================================================ EYE (eye-local; sy = blink)
  s.eye = h('g', {},
    h('circle', { r: 6.6, fill: Ks, 'data-detail': tag('O', 'orbital-ring') }),
    h('g', { 'data-detail': tag('O', 'iris') }, h('circle', { r: 5.6, fill: v('iris') }),
      h('g', { 'data-ref': 'pb-pupil' },
        h('circle', { 'data-detail': tag('O', 'pupil'), r: 3.6, fill: v('pupil') }),
        h('circle', { 'data-detail': tag('O', 'eye-highlight'), cx: 1.5, cy: -1.7, r: 1.4, fill: NE.hot }),
        h('circle', { 'data-detail': tag('O', 'eye-glint-secondary'), cx: -1.7, cy: 1.5, r: 0.65, fill: NE.cyCore }))),
    // nictitating membrane: sweeps front -> back across the eye (most of the pelican's blinks)
    h('clipPath', { id: 'pb-eyeclip' }, h('circle', { r: 5.7 })),
    h('g', { 'clip-path': 'url(#pb-eyeclip)', 'data-ref': 'pb-nictG', style: 'display:none' },
      h('g', { 'data-ref': 'pb-nict', 'data-detail': tag('O', 'nictitating-membrane') }, h('path', { d: 'M-6.4 -6.5Q-8.4 0 -6.4 6.5L9 6.5L9 -6.5Z', fill: P, opacity: 0.92 }), line('M-6.4 -6.5Q-8.4 0 -6.4 6.5', Bk, 0.9))),
    // expression lids: the upper lid skin slides down over the eye (clipped to the orbit), the lower lid rises
    // (cheek push: delight / focus). update() drives both from pose.face (lid, brow, mood).
    h('clipPath', { id: 'pb-orbitclip' }, h('circle', { r: 6.3 })),
    h('g', { 'clip-path': 'url(#pb-orbitclip)' },
      h('g', { 'data-ref': 'pb-lidSkin' }, h('path', { 'data-detail': tag('O', 'upper-lid-skin'), d: 'M-8 -2.4Q0 -7.6 8 -3L8 -20L-8 -20Z', fill: Ks })),
      h('g', { 'data-ref': 'pb-lowLid' }, h('path', { 'data-detail': tag('O', 'lower-lid-skin'), d: 'M-7 6.4Q0 4.2 7 5.4L7 14L-7 14Z', fill: Ks }),
        line('M-5.4 6.2Q0 4.2 5.6 5.4', Re, 1.1, { 'data-detail': tag('O', 'lower-eyelid') }))),
    h('g', { 'data-ref': 'pb-lid' },
      h('path', { 'data-detail': tag('O', 'upper-eyelid'), d: 'M-7.2 -1.8Q-1 -8.8 7.6 -3.6Q8.6 -2.6 8.2 -1.6Q0.4 -6.4 -7.2 -1.8Z', fill: N }),
      line('M7.6 -3.4Q9.4 -3.2 10.2 -1.6', N, 1, { 'data-detail': tag('O', 'lid-corner-crinkle') })),
    // happy closed eye (swallow / delight): an upturned lid arc with a cheek crinkle, drawn in eye space
    h('g', { 'data-ref': 'pb-happy', style: 'display:none' }, line('M-6.6 2Q0 -5.4 7 1.4', N, 2, { 'data-detail': tag('O', 'happy-closed-lid') }),
      line('M-4.4 5.6Q0 7.4 4.6 5.4M8 1.2l2.4 -1.4', Re, 1, { 'data-detail': tag('O', 'happy-cheek-crinkle') })),
    // brow ridge: the feathered supraorbital edge; lowers + tilts for focus, lifts for surprise (reads above the visor)
    h('g', { 'data-ref': 'pb-brow' }, line('M-6.8 -9.4Q0.6 -13.4 9.8 -9.8', N, 1.5, { 'data-detail': tag('O', 'brow-ridge') }),
      line('M-3.4 -11.4l-1.2 -2M1 -12.2l-0.7 -2.2M5.4 -11.8l-0.2 -2.2', N, 0.9, { 'data-detail': tag('T', 'brow-feather-tips') })));

  // ================================================================ VISOR + EARPIECE (head space; lives in the crest slot)
  // update() writes inverse(crest)·head on pb-visorG each frame, so this group is drawn in exact head coordinates but
  // ABOVE the eye slot: the eye reads through the translucent lens.
  let visor;
  {
    const lensP = [[-5.6, -13.2], [5, -16.4], [15.4, -15.4], [22, -11.4], [23.4, -7.4], [20.2, -3], [9, -0.4], [-1.8, -0.9], [-6.6, -5.4]];
    const lens = smooth(lensP);
    let scan = ''; for (let y = -15.6; y < 0; y += 1.3) scan += `M-8 ${f(y)}H25`;
    const eye = EYE;
    const dg = (n, x) => h('path', { 'data-ref': 'pb-hudD' + n, d: GLYPH.DIG[2 + n], fill: NE.cyCore, transform: `translate(${f(x)} -3.6) scale(0.042)` });
    visor = h('g', { 'data-ref': 'pb-visorG' },
      // earpiece: chrome pod on the side of the skull, magenta status ring, mic stub
      h('g', { 'data-detail': tag('O', 'earpiece') },
        h('path', { d: 'M-8 -7.4L-17 -6.4', fill: 'none', stroke: INK, 'stroke-width': 3.2, 'stroke-linecap': 'round' }),
        h('path', { d: 'M-8 -7.4L-17 -6.4', fill: 'none', stroke: HW.chromeMid, 'stroke-width': 1.6, 'stroke-linecap': 'round', 'data-detail': tag('O', 'visor-arm') }),
        h('circle', { cx: -19, cy: -5.4, r: 5.2, fill: 'url(#pb-gChrome)', stroke: INK, 'stroke-width': 1 }),
        h('circle', { cx: -19, cy: -5.4, r: 2.8, fill: HW.seam }),
        h('g', { 'data-detail': tag('O', 'earpiece-led-ring') }, neon('M-19 -8.2A2.8 2.8 0 1 1 -19 -2.6A2.8 2.8 0 1 1 -19 -8.2', NE.mag, NE.magCore, 0.55)),
        h('path', { d: 'M-15.4 -1.6Q-10 4 -2 5.4', fill: 'none', stroke: INK, 'stroke-width': 1.7, 'stroke-linecap': 'round', 'data-detail': tag('O', 'mic-boom') }),
        h('path', { d: 'M-15.4 -1.6Q-10 4 -2 5.4', fill: 'none', stroke: HW.chromeMid, 'stroke-width': 0.7, 'stroke-linecap': 'round' }),
        h('circle', { cx: -1.6, cy: 5.4, r: 1.3, fill: HW.chromeDk, stroke: INK, 'stroke-width': 0.5 })),
      // antenna: sways with the crest (follow-through), tip LED
      h('g', { 'data-ref': 'pb-antenna', 'data-detail': tag('O', 'earpiece-antenna'), transform: 'rotate(0 -19 -8)' },
        h('path', { d: 'M-19.4 -9.6Q-21 -22 -25 -35', fill: 'none', stroke: INK, 'stroke-width': 2, 'stroke-linecap': 'round' }),
        h('path', { d: 'M-19.4 -9.6Q-21 -22 -25 -35', fill: 'none', stroke: HW.chromeMid, 'stroke-width': 0.9, 'stroke-linecap': 'round' }),
        h('g', { 'data-ref': 'pb-antTip', 'data-detail': tag('O', 'antenna-tip-led') }, glowDisc(-25, -35.4, 6, 'pb-rgMg'), h('circle', { cx: -25, cy: -35.4, r: 1.5, fill: NE.mag }), h('circle', { cx: -25.3, cy: -35.7, r: 0.6, fill: NE.magCore }))),
      // lens: flat translucent cyan + gradient sheen, dark top frame, stacked cyan edge light, glints
      h('g', { 'data-detail': tag('O', 'visor-lens') },
        h('path', { d: lens, fill: 'none', stroke: NE.cy, 'stroke-width': 5, opacity: 0.16 }),
        h('path', { d: lens, fill: HW.lens, 'fill-opacity': 0.2 }),
        h('path', { d: lens, fill: 'url(#pb-gLens)' }),
        h('clipPath', { id: 'pb-lensclip' }, h('path', { d: lens })),
        h('g', { 'clip-path': 'url(#pb-lensclip)', 'data-detail': tag('T', 'visor-scanlines') }, line(scan, NE.cyCore, 0.28, { opacity: 0.4, 'stroke-linecap': 'butt' }),
          line('M-8 -9.2H25', NE.cy, 1.4, { opacity: 0.25 })),
        h('path', { d: lens, fill: 'none', stroke: NE.cy, 'stroke-width': 0.9 })),
      line('M-6 -13Q5 -16.8 15.4 -15.6Q20.6 -14.2 22.6 -11', INK, 2.2, { 'data-detail': tag('O', 'visor-frame') }),
      line('M-4.4 -13.4Q5 -16.6 15 -15.6', HW.chromeMid, 0.7),
      line('M-1.8 -12.2Q6 -14.6 14.4 -13.8', NE.hot, 0.9, { opacity: 0.85, 'data-detail': tag('O', 'visor-glint') }),
      line('M16.6 -4Q19.8 -5.2 21.2 -7.4', NE.hot, 0.6, { opacity: 0.7 }),
      // HUD glyphs on the lens: live speed readout, a delta arrow, signal bars, and the target reticle on the pupil
      h('g', { 'data-detail': tag('O', 'visor-hud-speed'), opacity: 0.95 }, dg(0, 12.2), dg(1, 14.8),
        h('path', { d: 'M17.8 -4.2l1.2 -1.9l1.2 1.9Z', fill: NE.acid })),
      line('M-3.6 -4.2h3.2M-3.6 -6.2h2.2M-3.6 -8.2h1.2', NE.cyCore, 0.5, { opacity: 0.9, 'data-detail': tag('O', 'visor-hud-bars') }),
      h('g', { 'data-ref': 'pb-reticle', 'data-detail': tag('O', 'hud-target-reticle'), transform: `translate(${f(eye[0])} ${f(eye[1])})`, opacity: 0.85 },
        h('circle', { r: 4.2, fill: 'none', stroke: NE.cyCore, 'stroke-width': 0.4, 'stroke-dasharray': '2.2 1.1' }),
        line('M-5.8 0h-1.4M5.8 0h1.4M0 -5.8v-1.4M0 5.8v1.4', NE.cyCore, 0.45)));
  }

  // ================================================================ CREST (crest-local: +x back along the nape, +y up)
  {
    const strand = (by, L, droop, curl, w) => {
      const c = [[0, by], [L * 0.35, by + curl], [L * 0.7, by + curl * 0.4 - droop * 0.45], [L, by - droop]];
      const P2 = [], Q2 = [];
      for (let i = 0; i < c.length; i++) {
        const d = norm(sub(c[Math.min(c.length - 1, i + 1)], c[Math.max(0, i - 1)])), n = perp(d), ww = w * (1 - i / (c.length - 1)) ** 0.8 / 2;
        P2.push(add(c[i], mul(n, ww))); Q2.push(add(c[i], mul(n, -ww)));
      }
      const tip = add(c[c.length - 1], mul(norm(sub(c[3], c[2])), 2.5));
      return { d: smooth([...P2.slice(0, -1), tip, ...Q2.slice(0, -1).reverse()]), tip, shaft: splitQ(resample([c[0], c[1], c[2], lerp2(c[2], c[3], 0.6)].map((p, i) => i ? p : lerp2(c[0], c[1], 0.4)), 2)) };
    };
    const longS = [[-6, 34, 24, -2, 9], [-2, 43, 23, 1.5, 10], [2, 47, 19, -1, 10.5], [6, 39, 12, 3, 9.5], [10, 30, 5, 2.5, 8.5]];
    const shortS = [[12, 20, 2, 2, 6.5], [14, 14, -2, 1.5, 6], [7, 26, 9, 2, 7]];
    let longD = '', shaftD = '', shortD = '', tips = '', tipDots = '';
    longS.forEach((a, i) => {
      const st = strand(...a);
      longD += h('path', { d: st.d, fill: P, stroke: INK, 'stroke-width': 1.1, 'stroke-linejoin': 'round' }); shaftD += st.shaft;
      tips += glowDisc(st.tip[0], st.tip[1], 3.2, i % 2 ? 'pb-rgMg' : 'pb-rgCy'); tipDots += `M${pt(st.tip)}h0`;
    });
    for (const a of shortS) shortD += h('path', { d: strand(...a).d, fill: P, stroke: INK, 'stroke-width': 1.1, 'stroke-linejoin': 'round' });
    s.crest = h('g', {},
      h('path', { 'data-detail': tag('O', 'crest-shadow'), d: smooth([[-4, -12], [14, -14], [34, -26], [26, -12], [6, -4]]), fill: Bd, opacity: 0.8 }),
      h('g', { 'data-detail': tag('O', 'nape-tuft') },
        h('path', { d: smooth([[-5, -4], [6, -12], [15, -19], [12, -22], [20, -26], [7, -23], [-2, -14]]), fill: P, stroke: INK, 'stroke-width': 1.1, 'stroke-linejoin': 'round' }),
        line('M3 -11Q8 -15 11 -19', Bk, 0.8)),
      h('g', { 'data-ref': 'pb-crestLong' }, h('g', { 'data-detail': tag('O', 'crest-long-strands') }, longD, line(shaftD, Bk, 0.75, { 'data-detail': tag('T', 'crest-shaft-lines') }),
        line('M2 13Q20 15 38 11', NE.mag, 0.9, { opacity: 0.8, 'data-detail': tag('O', 'crest-magenta-rim') }),
        h('g', { 'data-detail': tag('O', 'crest-fibre-optic-tips') }, tips, line(tipDots, NE.hot, 1.1)))),
      h('g', { 'data-ref': 'pb-crestShort', 'data-detail': tag('O', 'crest-short-spikes') }, shortD),
      visor);
  }
  return { defs, slots: s };
}

// ---------------------------------------------------------------- scarf ribbon (body-local, animated)
// centreline: inextensible chain from the wrap, trailing behind; flutter = travelling wave; lift from speed & hop.
function scarfCentre(p0, L, n, t, spd, hopA, seed) {
  const pts = [p0]; let p = p0;
  const s1 = Math.min(spd, 1.2);
  const base = Math.PI + 0.05 + 0.1 * s1 - 1.15 * (1 - Math.min(1, spd * 1.4));
  const A = 0.05 + 0.12 * s1, fw = 0.8 + 1.0 * s1;          // calm: small, slow travelling wave
  for (let i = 0; i < n; i++) {
    const sN = (i + 0.5) / n;
    const droop = -(0.55 * (1 - s1) + 0.12) * sN;
    const wave = A * (0.3 + sN) * Math.sin(2 * Math.PI * (1.25 * sN - fw * t) + seed);
    const th = base + droop + wave + hopA(sN);
    p = add(p, [Math.cos(th) * L / n, Math.sin(th) * L / n]); pts.push(p);
  }
  return pts;
}
function ribbon(cl, w0, w1, t, seed) {
  const n = cl.length, L = [], Rr = [];
  for (let i = 0; i < n; i++) {
    const d = norm(sub(cl[Math.min(n - 1, i + 1)], cl[Math.max(0, i - 1)])), nr = perp(d), s = i / (n - 1);
    const tw = 0.7 + 0.3 * Math.abs(Math.cos(Math.PI * (1.1 * s - 0.25 * t) + seed));
    const w = lerp(w0, w1, s) * tw / 2;
    L.push(add(cl[i], mul(nr, w))); Rr.push(add(cl[i], mul(nr, -w)));
  }
  const mid = (a, i) => lerp2(a[i], a[i + 1], 0.5);
  // outline: midpoint-quadratic smoothing along both edges
  let d = `M${pt(L[0])}`;
  for (let i = 1; i < n - 1; i++) d += `Q${pt(L[i])} ${pt(mid(L, i))}`;
  d += `L${pt(L[n - 1])}L${pt(Rr[n - 1])}`;
  for (let i = n - 2; i >= 1; i--) d += `Q${pt(Rr[i])} ${pt(mid(Rr, i - 1))}`;
  d += `L${pt(Rr[0])}Z`;
  // centreline (LED track) and the weave line just off it
  const c = cl.map((q, i) => lerp2(L[i], Rr[i], 0.5));
  const knit = qline(cl.map((q, i) => lerp2(L[i], Rr[i], 0.78)));
  // fibre-optic fringe at the free end (5 fibres; the tips wave slowly)
  let fr = ''; const e0 = L[n - 1], e1 = Rr[n - 1], dn = norm(sub(cl[n - 1], cl[n - 2]));
  for (let k = 0; k <= 4; k++) { const p = lerp2(e0, e1, 0.1 + 0.8 * k / 4); fr += `M${pt(p)}l${f(dn[0] * 9 + (k - 2) * 0.6)} ${f(dn[1] * 9 + Math.sin(t * 2.2 + k) * 1.4)}`; }
  return { d, cl: qline(c), knit, fr };
}

export const detailItems = [
  ['neck', 'O', 'S-neck deformer outline in cool-white plume with an ink key line (fixed command count)'],
  ['neck-neon-spill', 'O', 'outside halo of the neck: cyan on the nape side fading to magenta on the throat side (gradient stroke)'],
  ['neck-nape-shade', 'O', 'soft plumeShade band down the back of the neck'],
  ['neck-feather-flow', 'T', 'contour-feather scallops that ride on and stretch with the neck deformer'],
  ['neck-feather-flow-fine', 'T', 'second, finer staggered lane of neck flow scallops'],
  ['neck-throat-crease', 'O', 'fore-neck crease line continuing the pouch skin down the throat'],
  ['neck-rim-cyan', 'O', 'stacked-stroke cyan rim light on the nape side of the neck'],
  ['neck-rim-magenta', 'O', 'stacked-stroke magenta rim light on the throat side of the neck'],
  ['nape-barcode-tattoo', 'O', 'courier barcode tattoo with a cyan status dot on the nape, riding the deformer'],
  ['tail-rectrices', 'O', '5 short, square-ended rectrices rooted under the jacket back, angled slightly down'],
  ['tail-grey-tips', 'O', 'plumeShade edge band on each blunt tail tip'],
  ['tail-rachis-lines', 'T', 'feather shafts on each rectrix'],
  ['tail-upper-coverts', 'O', '2 rounded coverts overlapping the tail base'],
  ['undertail-coverts', 'O', 'fluffy undertail lobe with fold lines'],
  ['tail-neon-rim', 'O', 'magenta rim on the upper and lower tail edges'],
  ['scarf-far-tail', 'O', 'far scarf end in dim fabric behind the body, its LEDs and fringe dimmed'],
  ['body', 'O', 'deep-chested teardrop body mass in cool-white plume'],
  ['belly-shade-band', 'T', 'soft shade band along the belly edge (volume under the jacket hem)'],
  ['belly-scallops', 'T', 'belly contour-feather rows below the hem, overlapping toward the tail'],
  ['rump-scallops', 'T', 'rump feather rows by the tail'],
  ['breast-buff-wash', 'O', 'yellowish breeding breast patch of P. onocrotalus on the open chest'],
  ['breast-buff-feathers', 'T', 'pouch-yellow breast feather rows on the chest bib'],
  ['breast-scallops', 'T', 'small breast feather rows on the chest bib'],
  ['feather-shaft-ticks', 'T', 'shaft ticks in the lowest belly feathers'],
  ['saddle-compression-crease', 'O', 'feathers compressed where the belly sits on the saddle'],
  ['vent-fluff', 'O', 'vent fluff lines under the tail'],
  ['plumage-neon-rim', 'O', 'dual rim on the plumage (cyan behind, magenta on the chest)'],
  ['belly-saddle-bulge', 'O', 'underbelly contour flattened and spread onto the saddle top (weight on the seat)'],
  ['belly-splay-tufts', 'O', 'feather tufts splaying where the belly spreads over the saddle edges'],
  ['jacket-shell', 'O', 'short techwear bomber shell (satin gradient, puffed 2 u off the body), open at the chest'],
  ['jacket-quilt-stitching', 'T', 'diamond quilt stitching (seam + dashed thread) on the back panel'],
  ['jacket-satin-sheen', 'O', 'broad satin sheen on the upper back with a cyan sign reflection and a hot glint'],
  ['jacket-yoke-seam', 'O', 'yoke seam with a top-stitch line'],
  ['jacket-magenta-piping', 'O', 'magenta neon piping along the yoke seam (stacked strokes)'],
  ['jacket-taped-side-seam', 'O', 'taped side seam with a hairline highlight'],
  ['jacket-compression-folds', 'O', 'fabric folds bunching above the saddle'],
  ['patch-pelican', 'O', 'woven PELICAN label with a cyan neon thread border (lettering as paths)'],
  ['courier-number', 'O', 'acid reflective courier number #0719'],
  ['patch-hanzi', 'O', 'magenta embroidered 鹈鹕 tab with a dashed stitch border (glyph paths)'],
  ['clip-on-rear-light', 'O', 'clip-on red rear light on the back hem that blinks'],
  ['jacket-neon-rim', 'O', 'dual neon rim on the jacket (cyan along the back, magenta along the shoulders)'],
  ['hem-cast-shadow', 'O', 'shadow the jacket hem casts on the belly feathers'],
  ['jacket-hem-band', 'O', 'ribbed hem band'],
  ['jacket-hem-rib', 'T', 'knit ribbing on the hem band'],
  ['hem-reflective-strip', 'O', 'acid reflective strip on the hem'],
  ['jacket-zipper', 'O', 'open front zipper tape with a cyan edge light'],
  ['zipper-teeth', 'T', 'chrome zipper teeth'],
  ['zipper-pull', 'O', 'chrome zipper pull with an acid LED bead'],
  ['jacket-rib-collar', 'O', 'ribbed knit collar hugging the neck base, magenta piped'],
  ['collar-ruff', 'O', 'neck-base feather tips poking out below the scarf'],
  ['scarf-trailing-end', 'O', 'long LED scarf end streaming back on the rig scarf pose (follow-through and hop lift)'],
  ['scarf-weave', 'T', 'dashed weave line along the fabric'],
  ['scarf-neon-stripe', 'O', 'cyan neon stripe down the centre of the scarf'],
  ['scarf-led-chase', 'O', 'chasing cyan and magenta LEDs along the scarf (dash offset tied to speed)'],
  ['scarf-fibre-fringe', 'O', 'fibre-optic fringe at the scarf end'],
  ['scarf-wrap', 'O', 'fabric wrap around the neck'],
  ['scarf-shade-hatching', 'T', 'hatching on the wrap underside'],
  ['scarf-wrap-neon-bands', 'O', 'cyan and magenta neon bands across the wrap'],
  ['scarf-wrap-leds', 'O', 'acid LED studs on the wrap'],
  ['scarf-hanging-end', 'O', 'short front end hanging from the knot with an acid LED line'],
  ['scarf-fringe-magenta', 'O', 'magenta fibre fringe on the hanging end'],
  ['scarf-knot', 'O', 'fabric knot'],
  ['scarf-power-hub', 'O', 'round LED power hub in the knot (slow pulse)'],
  ['pouch', 'O', 'yellow gular pouch reaching behind the gape to the throat'],
  ['pouch-lower-shade', 'O', 'pouchDeep gradient on the lower pouch (volume)'],
  ['pouch-stretch-lines', 'T', 'billEdge texture lines that stretch with the pouch sy'],
  ['pouch-circuit-tattoo', 'O', 'glowing cyan circuit tattoo on the pouch, pulsing slowly, brighter while it "scans" a fish'],
  ['circuit-via-pads', 'O', 'bright via pads at the trace ends'],
  ['circuit-chip', 'O', 'tiny chip outline with pins'],
  ['pouch-throat-wrinkles', 'T', 'fine wrinkles where the pouch folds into the throat'],
  ['pouch-sag-folds', 'T', 'small sag folds along the pouch belly'],
  ['pouch-neon-rim', 'O', 'cyan rim under the pouch and at its back edge'],
  ['pouch-edge-line', 'O', 'billEdge edge line on the pouch'],
  ['pouch-highlight', 'O', 'hot highlight under the ramus'],
  ['pouch-rim-folds', 'O', 'scalloped attachment folds under the lower mandible'],
  ['bill-lower', 'O', 'thin lower mandible'],
  ['mandible-ramus-line', 'O', 'ramus edge framing the pouch'],
  ['ramus-sheen', 'O', 'sheen dashes on the ramus'],
  ['ramus-cyan-rim', 'O', 'cyan rim under the lower mandible'],
  ['bill-upper', 'O', 'long flat upper mandible (128 u)'],
  ['bill-sheen', 'O', 'top sheen and under-shade gradient on the upper mandible'],
  ['culmen-neon-rim', 'O', 'magenta neon rim along the culmen'],
  ['tomium-line', 'O', 'cutting-edge line'],
  ['maxillary-groove', 'O', 'lateral groove line along the upper mandible'],
  ['bill-growth-ridges', 'T', 'fine growth ridges near the bill base'],
  ['culmen-ridge', 'O', 'ridge line of the culmen'],
  ['culmen-highlight', 'O', 'hot highlight along the culmen'],
  ['nostril-slit', 'O', 'slit nostril near the culmen base'],
  ['bill-serial-etching', 'O', 'laser-etched serial PB-0719 on the mandible (glyph paths)'],
  ['bill-tip-shadow', 'O', 'shadow under the nail'],
  ['chrome-nail-hook', 'O', 'chrome hooked nail (mirror gradient) with a soft cyan glow'],
  ['nail-highlight', 'O', 'white glint on the chrome nail'],
  ['nail-cyan-reflection', 'O', 'cyan sign reflection on the nail tip'],
  ['nail-magenta-reflection', 'O', 'magenta reflection on the nail underside'],
  ['nail-under-hook', 'O', 'under-hook line'],
  ['head', 'O', 'skull with a sloping forehead'],
  ['facial-skin', 'O', 'bare peach facial skin around the eye, running into the bill'],
  ['cheek-feather-edge', 'O', 'scalloped feather edge over the bare skin'],
  ['chin-feathers', 'O', 'scalloped chin feathers over the gape'],
  ['forehead-feather-flecks', 'T', 'short flecks following the forehead feather flow'],
  ['nape-edge', 'O', 'nape edge lines where the head meets the neck'],
  ['head-neon-rim', 'O', 'dual rim on the skull (cyan nape, magenta crown)'],
  ['forehead-feather-point', 'O', 'feathered forehead point pressing onto the culmen base (P. onocrotalus field mark), magenta edge'],
  ['gape-smile-line', 'O', 'gape line running back under the eye, turning up (cool smirk)'],
  ['smile-crease', 'O', 'small upturn at the mouth corner'],
  ['orbital-ring', 'O', 'bare peach orbital ring around the eye'],
  ['iris', 'O', 'dark red iris'],
  ['pupil', 'O', 'pupil with saccades'],
  ['eye-highlight', 'O', 'hot catch-light'],
  ['eye-glint-secondary', 'O', 'second, cyan catch-light (visor reflection)'],
  ['nictitating-membrane', 'O', 'pale membrane sweeping front-to-back across the eye (most blinks; not in the still count)'],
  ['upper-lid-skin', 'O', 'relaxed upper lid skin (half-lidded, confident)'],
  ['upper-eyelid', 'O', 'thick upper eyelid line'],
  ['lid-corner-crinkle', 'O', 'crinkle at the outer eye corner'],
  ['lower-lid-skin', 'O', 'cheek skin pushing the lower lid up'],
  ['lower-eyelid', 'O', 'lower lid line (rises with the cheek: delight / focus)'],
  ['happy-closed-lid', 'O', 'upturned closed-lid arc for the swallow / delight beat (not in the still count)'],
  ['happy-cheek-crinkle', 'O', 'cheek crinkles under the happy closed eye (not in the still count)'],
  ['brow-ridge', 'O', 'feathered supraorbital brow edge: lowers for sprint focus, lifts for hop surprise'],
  ['brow-feather-tips', 'T', 'three feather tips along the brow ridge'],
  ['earpiece', 'O', 'chrome earpiece pod on the side of the skull'],
  ['visor-arm', 'O', 'visor arm from the lens to the earpiece'],
  ['earpiece-led-ring', 'O', 'magenta LED status ring on the earpiece'],
  ['mic-boom', 'O', 'thin chrome mic boom curving toward the gape'],
  ['earpiece-antenna', 'O', 'earpiece antenna that sways with the crest follow-through'],
  ['antenna-tip-led', 'O', 'magenta LED on the antenna tip (glow disc, blinks slowly)'],
  ['visor-lens', 'O', 'translucent cyan HUD visor across the eye (the eye reads through it)'],
  ['visor-scanlines', 'T', 'static HUD scanlines and a brighter scan band inside the lens'],
  ['visor-frame', 'O', 'dark visor top frame with a chrome hairline'],
  ['visor-glint', 'O', 'hot glints on the lens'],
  ['visor-hud-speed', 'O', 'live km/h readout (mono glyph paths) with an acid delta arrow on the lens'],
  ['visor-hud-bars', 'O', 'three HUD signal bars on the lens'],
  ['hud-target-reticle', 'O', 'dashed HUD reticle that tracks the pupil (gaze)'],
  ['crest-shadow', 'O', 'shadow under the crest'],
  ['nape-tuft', 'O', 'fluffy tuft under the crest'],
  ['crest-short-spikes', 'O', '3 short spiky crest feathers (second design)'],
  ['crest-long-strands', 'O', '5 long shaggy crest strands'],
  ['crest-shaft-lines', 'T', 'shaft lines in the long crest strands'],
  ['crest-magenta-rim', 'O', 'magenta rim along the crest'],
  ['crest-fibre-optic-tips', 'O', 'fibre-optic glowing tips on the long crest strands (cyan / magenta)'],
].map(([name, kind, what]) => ({ id: 'pelican:' + kind + ':' + name, layer: 'pelican', kind, what }));

// ---------------------------------------------------------------- runtime
export function attach(svg) {
  const r = refs(svg, 'pb-');
  const st = new WeakMap();   // per element, per attribute: last written value (no getAttribute / key strings per call)
  const set = (el, k, val) => { if (!el) return; let m = st.get(el); if (!m) st.set(el, m = {}); if (m[k] !== val) { m[k] = val; if (k === 'd') el.setAttribute('d', val); else if (k === 'op') el.style.opacity = val; else if (k === 'show') el.style.display = val ? '' : 'none'; else el.setAttribute(k, val); } };
  const DIG = GLYPH.DIG;
  let lastNeck = '';
  return {
    update(fr) {
      const pose = fr.pose, t = fr.t, n = pose.neck, J = pose.joints || {};
      const bj = J.body || { x: SKEL.pelvis[0], y: SKEL.pelvis[1], rot: 0 }, bsx = bj.sx ?? 1, bsy = bj.sy ?? 1;
      const toBody = p => { const q = rot([p[0] - bj.x, p[1] - bj.y], -(bj.rot || 0)); return [q[0] / bsx, q[1] / bsy]; };
      const tt = fr.reduced ? 0 : t;
      // ---- events (fallbacks when the rig does not provide the richer fields)
      let gulpTau = -1, hopTau = -1;
      for (const e of fr.events || []) { const k = t - e.t0; if (k < 0) continue; if (e.type === 'gulp' && k < 2.6) gulpTau = k; if (e.type === 'hop' && k < 2.5) hopTau = k; }
      // ---- neck: outline + riding detail (bulge from the rig's neck fields, or a local fallback)
      let bulge = null;
      if (!(n.bulgeT !== undefined) && gulpTau > 0.85 && gulpTau < 1.6) { const u = (gulpTau - 0.85) / 0.75; bulge = { at: 0.95 - 0.85 * u, amp: 5 * Math.sin(Math.PI * u) }; }
      const nk = [n.p0, n.p1, n.p2, n.p3].map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(';') + (n.w0 ?? 0).toFixed(2) + (n.bulgeA ?? 0).toFixed(3) + (n.bulgeT ?? 0).toFixed(3) + (bulge ? bulge.at.toFixed(3) : '');
      if (nk !== lastNeck) {
        lastNeck = nk;
        set(r.neck, 'd', neckD(n, bulge));
        const nd = neckDetail(n, bulge);
        set(r.neckFlow, 'd', nd.flow); set(r.neckFlow2, 'd', nd.flowSmall); set(r.neckCrease, 'd', nd.crease);
        set(r.neckRimF, 'd', nd.rimF); set(r.neckRimB, 'd', nd.rimB); set(r.neckShade, 'd', nd.shade);
        set(r.neckJack, 'transform', nd.jack);
      }
      // ---- seat contact anchor on the exact belly ellipse
      const lo = bellyLowLocal(bj.rot || 0, bsx, bsy);
      set(r.seat, 'transform', `translate(${f(lo[0] / bsx)} ${f(lo[1] / bsy)})`);
      // ---- scarf
      const spd = clamp((fr.speed ?? 1885) / 1885, 0, 1.8);
      const sc = pose.scarf;
      let cL = WRAP_DEFAULT, dAng = 0;
      if (sc && Number.isFinite(sc.x)) { cL = toBody([sc.x, sc.y]); dAng = (sc.neckAng ?? NU_ANG) - (bj.rot || 0) - NU_ANG; }
      const xfS = scarfXf(cL, dAng);
      set(r.scarfA, 'transform', xfS); set(r.scarfB, 'transform', xfS); set(r.scarfC, 'transform', xfS);
      const place = q => add(cL, rot(q, dAng));
      let nearCL, farCL, hangCL;
      if (sc && sc.tails && sc.tails[0] && sc.tails[0].a) {
        // rig tails: rider-space segment angles (deg) -> body-local chains, resampled smooth
        const chain = (p0, angs, len, k, dA = 0, dL = 1) => { const Pp = [p0]; let p = p0; angs.forEach((a, i) => { const aa = (a + dA * (i + 1) / angs.length - (bj.rot || 0)) * D2R; p = add(p, [Math.cos(aa) * len * dL, Math.sin(aa) * len * dL]); Pp.push(p); }); return resample(Pp, k); };
        const A = sc.tails[0], B = sc.tails[1] || sc.tails[0];
        nearCL = chain(place(TAIL0.near), A.a, A.len * 1.25, 3);
        farCL = chain(place(TAIL0.far), A.a.map((a, i) => a + 12 + 2 * Math.sin(tt * 2.6 + i)), A.len * 1.0, 3, 10);
        hangCL = chain(place(KNOT), B.a, B.len * 0.95, 3);
      } else {
        const hopA = sN => {
          if (hopTau < 0) return 0;
          const u0 = hopTau - 0.1 * sN; let a = 0;
          if (u0 > 0.15 && u0 < 0.75) { const u = (u0 - 0.15) / 0.6; a = -0.0026 * (58 * Math.PI / 0.6) * Math.cos(Math.PI * u); }
          else if (u0 >= 0.75) { const k = u0 - 0.75; a = -0.55 * Math.exp(-4 * k) * Math.sin(12 * k); }
          return -a * (0.4 + sN);
        };
        nearCL = scarfCentre(place(TAIL0.near), 150, 14, tt, spd, hopA, 0);
        farCL = scarfCentre(place(TAIL0.far), 124, 12, tt + 0.23, spd, hopA, 1.7);
        const k0 = place(KNOT), sw = (fr.reduced ? 0 : 6 * Math.sin(t * 2 * Math.PI * 0.9) * Math.min(1, spd)) - 14 * Math.min(1, spd);
        hangCL = [0, 1, 2, 3, 4].map(i => add(k0, rot([2 * i, 11.5 * i], sw * i / 4)));
        hangCL = resample(hangCL, 2);
      }
      const near = ribbon(nearCL, 17, 12, tt, 0.4);
      set(r.snFill, 'd', near.d); set(r.snCL, 'd', near.cl); set(r.snKnit, 'd', near.knit); set(r.snFringe, 'd', near.fr);
      const far = ribbon(farCL, 15, 11, tt + 0.4, 1.3);
      set(r.sfFill, 'd', far.d); set(r.sfCL, 'd', far.cl); set(r.sfFringe, 'd', far.fr);
      const hang = ribbon(hangCL, 15, 12, tt * 0.5, 2.2);
      set(r.shFill, 'd', hang.d); set(r.shCL, 'd', hang.cl); set(r.shFringe, 'd', hang.fr);
      // LED chase: the dot pattern runs down the scarf (toward the free end) at a rate that follows the road speed
      {
        const ph = fr.reduced ? 0 : -((t * (3 + 5 * Math.min(spd, 1.4))) % 12);
        set(r.snLedA, 'stroke-dashoffset', f(ph)); set(r.snLedB, 'stroke-dashoffset', f(ph - 6));
        set(r.sfLed, 'stroke-dashoffset', f(ph * 0.8 - 3)); set(r.shLed, 'stroke-dashoffset', f(-((t * 4) % 16) * (fr.reduced ? 0 : 1)));
      }
      // ---- slow emissive pulses (opacity only, quantised so most frames write nothing)
      const q = x => (Math.round(x * 20) / 20).toFixed(2);
      set(r.hubGlow, 'op', q(fr.reduced ? 0.8 : 0.55 + 0.4 * (0.5 + 0.5 * Math.sin(t * 2.4))));
      set(r.rearLed, 'op', fr.reduced ? '1' : ((t * 1.6) % 1 < 0.55 ? '1' : '0.15'));
      set(r.antTip, 'op', fr.reduced ? '1' : ((t * 0.9 + 0.3) % 1 < 0.8 ? '1' : '0.35'));
      // ---- face: closed-lid line when the eye is (nearly) shut; nictitating membrane; smile; lid pose; gaze
      const face = pose.face || {};
      const eyeSy = J.eye?.sy ?? pose.blink ?? 1;
      const squintFB = gulpTau > 0.55 && gulpTau < 1.25 && !pose.face;
      // expression: cool cruise = a relaxed half-lid (confident), focus = flat low lid + brow down, surprise = wide eye
      // + brow up + pupil pop, delight = closed happy arc (cheek pushes the lower lid up)
      const md = face.mood || {}, mC = md.content ?? (pose.face ? 0 : 1), mF = md.focus ?? 0, mS = md.surprise ?? 0, mD = md.delight ?? (squintFB ? 1 : 0);
      let lidA = clamp((face.lid ?? 0.14) + 0.3 * mC + 0.14 * mF - 0.34 * mS, 0, 1);
      const swallow = gulpTau > 0.95 && gulpTau < 2.3;   // the swallow + savour: eyes screw shut, happy
      const happy = lidA > 0.8 || mD > 0.6 || swallow;
      if (happy) lidA = 1;
      set(r.lid, 'show', !happy);
      set(r.lidClosed, 'show', (eyeSy < 0.4 || squintFB) && !happy); set(r.happy, 'show', happy);
      if (happy) set(r.happy, 'transform', `scale(1 ${(1 / Math.max(0.3, eyeSy)).toFixed(2)})`);   // keep the arc's curve when the slot squashes
      const lidY = lerp(-0.6, 10.5, lidA) - 1.6 * mS;
      const lidR = 6 * mF - 4 * mS + 3 * mC;   // cruise: the lid's front end drops a touch (a knowing look)
      const lidXf = `translate(0 ${lidY.toFixed(2)}) rotate(${lidR.toFixed(1)})`;
      set(r.lidSkin, 'transform', lidXf); set(r.lid, 'transform', lidXf);
      set(r.lowLid, 'transform', `translate(0 ${(-(2.6 * (happy ? 1 : mD) + 1.4 * mF + 0.9 * mC) + 0.8 * mS).toFixed(2)})`);
      const nict = face.nict ?? 0;
      set(r.nictG, 'show', nict > 0.02);
      if (nict > 0.02) set(r.nict, 'transform', `translate(${(12 * (1 - nict)).toFixed(2)} 0)`);
      const smile = face.smile ?? 0.4, brow = face.brow ?? 0.1;
      set(r.smile, 'transform', `rotate(${(-16 * (smile - 0.4) - 6).toFixed(1)} 2.6 -1.4)`);
      set(r.brow, 'transform', `translate(0 ${(-2.6 * brow + 1.2 * mF + 0.6 * mC).toFixed(2)}) rotate(${(-7 * brow + 5 * mF + 3 * mC).toFixed(1)} 1 -12)`);
      let px, py;
      if (pose.gaze && Number.isFinite(pose.gaze.x)) { px = -0.6 + 2.2 * pose.gaze.x; py = 1.5 * pose.gaze.y; }
      else {
        const slot = Math.floor(t / 2.1), fracS = t / 2.1 - slot;
        const targ = qq => { const a = Math.sin(qq * 12.9898) * 43758.5453; const u = a - Math.floor(a); return [[0.9, -0.4], [1.2, -1], [-0.8, -0.5], [0.4, 0.5]][Math.floor(u * 4)]; };
        const A0 = targ(slot - 1), A1 = targ(slot), k = sstep(0, 0.07, fracS);
        px = lerp(A0[0], A1[0], k); py = lerp(A0[1], A1[1], k);
      }
      const ps = face.pupil ?? 1;
      px = clamp(px, -1.6, 1.6); py = clamp(py, -1.5, 1.5);
      set(r.pupil, 'transform', `translate(${px.toFixed(2)} ${py.toFixed(2)})${Math.abs(ps - 1) > 0.01 ? ` scale(${ps.toFixed(2)})` : ''}`);
      // ---- visor: inverse(crest)·head, so the HUD sits in head space above the eye slot
      const hj = J.head, cj = J.crest;
      if (hj && cj) {
        const csx = cj.sx ?? 1, csy = cj.sy ?? 1;
        set(r.visorG, 'transform', `scale(${f(1 / csx)} ${f(1 / csy)}) rotate(${f(-(cj.rot || 0))}) translate(${f(hj.x - cj.x)} ${f(hj.y - cj.y)}) rotate(${f(hj.rot || 0)})${(hj.sx ?? 1) !== 1 || (hj.sy ?? 1) !== 1 ? ` scale(${f(hj.sx ?? 1)} ${f(hj.sy ?? 1)})` : ''}`);
      }
      // HUD reticle locks onto the pupil (gaze), hides while the eye is shut
      set(r.reticle, 'transform', `translate(${f(EYE[0] + px * 0.9)} ${f(EYE[1] + py * 0.9)})`);
      set(r.reticle, 'show', eyeSy > 0.45 && !happy);
      // live speed on the lens (km/h: 1 u = 3.4 mm)
      const kmh = clamp(Math.round((fr.speed ?? 0) * 0.01224), 0, 99);
      set(r.hudD0, 'd', DIG[Math.floor(kmh / 10)]); set(r.hudD1, 'd', DIG[kmh % 10]);
      // ---- crest: two strand groups lag differently (rig crestBend = [mid, tip] degrees); the antenna follows
      const cb = pose.crestBend || [0, 0];
      set(r.crestShort, 'transform', `rotate(${(0.7 * cb[0]).toFixed(2)})`);
      set(r.crestLong, 'transform', `rotate(${(0.6 * cb[0] + 0.6 * cb[1]).toFixed(2)})`);
      set(r.antenna, 'transform', `rotate(${(-0.45 * cb[1]).toFixed(2)} -19.4 -9.6)`);
      // ---- gulp: fish silhouette in the pouch (head to the throat), drips off the bill; backlit pouch glow; the
      // circuit tattoo lights up while the fish is in the pouch ("scan")
      const fish = pose.fish;
      let fishOp, fishRot, drip;
      if (fish) { fishOp = fish.inPouch ?? 0; fishRot = fish.pouchRot ?? 180; drip = fish.drip ?? 0; }
      else { fishOp = gulpTau > 0.3 && gulpTau < 1.0 ? 1 - sstep(0.8, 1.0, gulpTau) : 0; fishRot = 20 + 160 * sstep(0.3, 0.9, gulpTau); drip = gulpTau > 0.25 && gulpTau < 1.0 ? 1 : 0; }
      set(r.pouchFish, 'show', fishOp > 0.5);
      if (fishOp > 0.5) { const u = clamp((fishRot - 20) / 160, 0, 1); set(r.pouchFish, 'transform', `translate(${(lerp(52, 8, u)).toFixed(1)} ${(lerp(13, 16, u)).toFixed(1)}) rotate(${fishRot.toFixed(1)})`); }
      set(r.drips, 'show', drip > 0.5);
      if (drip > 0.5) for (let i = 0; i < 3; i++) { const u = ((t * 2.6 + i * 0.37) % 1); set(r['drip' + i], 'transform', `translate(0 ${(u * u * 24).toFixed(1)})`); }
      const sunE = fr.sun?.elev ?? 0.3;
      const backlit = (fr.night || 0) < 0.5 && sunE < 0.24 && sunE > -0.06;     // low sun behind the rider: glowing pouch
      set(r.pouchGlow, 'show', backlit || fishOp > 0.5);
      set(r.circGlow, 'op', fishOp > 0.5 ? '1' : q(fr.reduced ? 0.7 : 0.5 + 0.35 * Math.sin(t * 1.3)));
    },
  };
}
