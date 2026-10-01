// OWNER: fx. Layers: L-gulls-far (depth .15), L-shadow, L-fx-back, L-fx-front (depth 1).
// Style X (docs/STYLE-X.md, "Neon Pelican"): every effect is EMISSIVE neon on the wet night street. Glow is faked with
// stacked strokes (a wide low-opacity stroke under a thin bright core) and radial / linear gradients: there is NO SVG
// filter anywhere in this module (everything here moves or is recycled every frame).
//
// Everything is a PURE function of (t, distance, speed, cadence, events, pose, tod, weather): particles live in fixed
// pools whose slots are re-used by a deterministic spawn schedule (slot k of a stream is born at k·dt, its look and
// path come from a hash of k), so renderAt(t) is exact, the loop can be scrubbed backwards, and there is zero DOM
// churn after build. Per frame we only write transforms / opacities / a few dash offsets, and only when they change.
//
//   L-gulls-far  far delivery-drone traffic over the harbour (two liveries, blinking strobes)
//   L-shadow     the wet road under the rider: magenta underglow pool, void contact shadows, tyre wakes, the laser's
//                road pool, and a mirrored WET REFLECTION of bike + rider (neon rim rings, LED frame, pelican
//                silhouettes that follow the live joints) broken into ripple bands, with vertical neon smears
//   L-fx-back    laser headlight (cone, core beam, LiDAR pulses, road scan), cyber-moths, escort drones (a camera
//                drone films the courier at every cadence; cargo / racer / patrol drones join above 86 rpm), neon
//                light trails (> 86 rpm, sparse), ONE slow holographic data-stream (the calm wind: rare)
//   L-fx-front   tyre spray (rooster tail, mist, front bow wave), landing splash + HUD shock ring + sparks, rain
//                splashing on the rider, feathers, a tumbling takeaway flyer, a holographic butterfly, a bug-bot fly
//                round the delivery box, bell glint, lamp flare, glitch HUD pops (DING! 叮 / HOP! 跳 / GULP! 咕嘟)
//                with scanlines, RGB split and slice glitches, bell sound-rings + neon notes, glowing drips, pixel
//                hearts, a holographic fish bone that derezzes into pixels, HUD wave arcs
import { fmt1, fmt2 } from '../core/math.js';
import { GROUND_Y, RIDER_X, BIKE } from '../contract.js';
import { h, refs, xf } from '../core/svg.js';
import { TIMING } from '../rig/solve.js';
import { KM } from '../world/route.js';
import * as light from './light.js';

export const id = 'fx';

// ------------------------------------------------------------------------------------------------ helpers
const f = fmt2;   // = String(Math.round(x * 100) / 100), fast (core/math.js)
const f1 = fmt1;
const TAU = Math.PI * 2, D2R = Math.PI / 180, R2D = 180 / Math.PI;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
const wrap = (x, m) => ((x % m) + m) % m;
const circ = (x, y, r) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
const rect = (x, y, w, hh) => `M${f(x)} ${f(y)}h${f(w)}v${f(hh)}h${f(-w)}Z`;
const poly = (pts, close = true) => 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + (close ? 'Z' : '');
const star4 = (r, w) => `M0 ${f(-r)}L${f(w)} ${f(-w)}L${f(r)} 0L${f(w)} ${f(w)}L0 ${f(r)}L${f(-w)} ${f(w)}L${f(-r)} 0L${f(-w)} ${f(-w)}Z`;
// integer hash -> [0,1): deterministic per particle id (no Math.random)
const hash = (a, b = 0) => {
  let x = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35);
  x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12; x = Math.imul(x, 0x297a2d39); x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
};
const easeOutBack = u => { const c = 1.70158, v = u - 1; return 1 + (c + 1) * v * v * v + c * v * v; };
const DD = key => ({ 'data-detail': key });
// Pure light (cones, pools, glows, reflections, smears) never hides what is under it: it is additive and translucent,
// so it is excluded from hit-testing (the detail inventory's occlusion test forces pointer-events on every element).
const NH = 'pointer-events:none !important';
// build-time pass: every descendant of an NH element gets NH too (an inline !important is needed on each element)
function propagateNH(mk) {
  const stack = [];
  return mk.replace(/<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g, (m, close, tag, attrs, self) => {
    if (close) { stack.pop(); return m; }
    const own = attrs.includes(NH), inNH = own || (stack.length && stack[stack.length - 1]);
    let a = attrs;
    if (inNH && !own) a = /style="/.test(a) ? a.replace(/style="([^"]*)"/, (q, st) => `style="${st};${NH}"`) : a + ` style="${NH}"`;
    if (!self) stack.push(inNH);
    return `<${tag}${a}${self}>`;
  });
}

// ------------------------------------------------------------------------------------------------ lettering
// Glyph outlines as paths (no runtime fonts), em = 200, y down, baseline 0, absolute M/L/Q/Z only.
// GB: DejaVu Sans Bold · GM: DejaVu Sans Mono Bold (Bitstream Vera / DejaVu licence) · GZ: WenQuanYi Zen Hei
// (GPL v2 + font embedding exception). Extracted with tools/ttf.mjs.
const GB = {"D":[166,"M56-117L56-28L69-28Q92-28 105-40Q117-51 117-73Q117-95 105-106Q93-117 69-117ZM18-146L58-146Q91-146 107-141Q124-136 135-125Q146-115 151-102Q156-89 156-73Q156-57 151-44Q146-31 135-21Q124-9 107-5Q91 0 58 0L18 0Z"],"I":[74,"M18-146L56-146L56 0L18 0Z"],"N":[167,"M18-146L60-146L113-46L113-146L149-146L149 0L107 0L54-100L54 0L18 0Z"],"G":[164,"M149-11Q135-4 120-1Q105 3 89 3Q53 3 31-18Q10-38 10-73Q10-108 32-128Q53-148 91-148Q106-148 119-146Q132-143 144-138L144-107Q132-114 120-118Q108-121 96-121Q73-121 61-109Q49-96 49-73Q49-50 61-37Q72-24 94-24Q100-24 105-25Q110-26 114-27L114-56L91-56L91-81L149-81Z"],"H":[167,"M18-146L56-146L56-90L111-90L111-146L149-146L149 0L111 0L111-62L56-62L56 0L18 0Z"],"O":[170,"M85-121Q68-121 58-108Q49-96 49-73Q49-50 58-37Q68-24 85-24Q102-24 112-37Q121-50 121-73Q121-96 112-108Q102-121 85-121ZM85-148Q120-148 140-128Q160-108 160-73Q160-37 140-17Q120 3 85 3Q50 3 30-17Q10-37 10-73Q10-108 30-128Q50-148 85-148Z"],"P":[147,"M18-146L81-146Q109-146 123-133Q138-121 138-98Q138-75 123-63Q109-51 81-51L56-51L56 0L18 0ZM56-119L56-78L77-78Q88-78 94-83Q100-88 100-98Q100-108 94-113Q88-119 77-119Z"],"U":[162,"M18-146L56-146L56-58Q56-40 62-33Q68-25 81-25Q95-25 101-33Q106-40 106-58L106-146L144-146L144-58Q144-27 129-12Q113 3 81 3Q49 3 34-12Q18-27 18-58Z"],"L":[127,"M18-146L56-146L56-28L122-28L122 0L18 0Z"],"!":[91,"M28-146L63-146L63-90L58-49L33-49L28-90ZM28-35L63-35L63 0L28 0Z"]};
const GM = {"0":[120,"M48-73Q48-78 52-81Q55-85 60-85Q65-85 69-81Q72-78 72-73Q72-68 69-64Q65-61 60-61Q55-61 52-64Q48-68 48-73ZM60-124Q50-124 46-112Q41-100 41-73Q41-46 46-34Q50-22 60-22Q70-22 75-34Q79-46 79-73Q79-100 75-112Q70-124 60-124ZM12-73Q12-111 24-130Q36-148 60-148Q84-148 96-130Q108-111 108-73Q108-35 96-16Q84 3 60 3Q36 3 24-16Q12-35 12-73Z"],"1":[120,"M18-25L51-25L51-120L21-113L21-139L51-146L79-146L79-25L111-25L111 0L18 0Z"],"2":[120,"M42-25L104-25L104 0L11 0L11-25L27-41Q55-71 61-78Q68-86 71-93Q74-99 74-105Q74-115 69-120Q63-126 52-126Q44-126 34-123Q25-120 14-114L14-141Q25-144 35-146Q45-148 54-148Q77-148 90-138Q104-127 104-108Q104-100 101-92Q98-85 91-75Q86-69 62-46Q50-33 42-25Z"],"3":[120,"M54-65L38-65L38-91L54-91Q64-91 70-95Q76-99 76-107Q76-115 70-119Q64-124 54-124Q45-124 36-122Q27-120 17-116L17-142Q27-145 36-147Q46-148 55-148Q78-148 91-138Q104-128 104-111Q104-98 97-89Q89-81 75-79Q91-76 99-66Q107-56 107-41Q107-19 94-8Q80 3 54 3Q43 3 33 1Q22-1 12-4L12-31Q21-27 32-24Q43-22 54-22Q66-22 73-27Q80-33 80-42Q80-53 73-59Q66-65 54-65Z"],"4":[120,"M68-114L31-56L68-56ZM65-146L95-146L95-56L111-56L111-31L95-31L95 0L68 0L68-31L10-31L10-59Z"],"5":[120,"M19-146L98-146L98-120L42-120L42-93Q46-95 50-95Q54-96 58-96Q80-96 93-82Q107-69 107-47Q107-24 92-10Q78 3 52 3Q43 3 34 1Q24 0 14-3L14-29Q22-25 31-23Q39-21 48-21Q63-21 71-28Q79-34 79-47Q79-58 71-65Q63-72 50-72Q42-72 35-70Q27-68 19-64Z"],"6":[120,"M63-73Q53-73 48-66Q44-59 44-47Q44-34 48-27Q53-20 63-20Q72-20 77-27Q82-34 82-47Q82-59 77-66Q72-73 63-73ZM101-142L101-116Q93-121 86-123Q79-125 72-125Q57-125 48-114Q40-104 40-83Q44-90 52-93Q59-96 68-96Q88-96 99-84Q110-71 110-48Q110-24 98-10Q85 3 64 3Q37 3 25-15Q13-33 13-73Q13-110 28-129Q42-148 72-148Q79-148 86-147Q93-145 101-142Z"],"7":[120,"M13-146L105-146L105-125L56 0L27 0L74-120L13-120Z"],"8":[120,"M60-65Q50-65 45-59Q39-53 39-43Q39-33 45-27Q50-20 60-20Q70-20 76-27Q82-33 82-43Q82-53 76-59Q70-65 60-65ZM39-77Q28-81 22-89Q16-97 16-109Q16-127 28-138Q40-148 60-148Q81-148 92-138Q104-127 104-109Q104-97 99-89Q93-81 82-77Q94-74 101-64Q108-54 108-41Q108-20 95-9Q83 3 60 3Q37 3 25-9Q13-20 13-41Q13-54 20-64Q26-74 39-77ZM42-107Q42-98 47-93Q52-88 60-88Q69-88 74-93Q79-98 79-107Q79-115 74-120Q69-125 60-125Q52-125 47-120Q42-115 42-107Z"],"9":[120,"M20-2L20-28Q28-24 35-22Q42-19 48-19Q64-19 72-30Q80-40 81-61Q76-55 69-51Q62-48 52-48Q32-48 22-61Q11-73 11-96Q11-120 23-134Q35-147 57-147Q84-147 96-129Q108-112 108-72Q108-34 93-15Q78 4 49 4Q42 4 35 2Q27 1 20-2ZM58-72Q67-72 72-79Q77-86 77-99Q77-112 72-118Q67-125 58-125Q48-125 43-118Q38-112 38-99Q38-86 43-79Q48-72 58-72Z"],"A":[120,"M60-119L47-60L74-60ZM43-146L78-146L117 0L88 0L79-36L41-36L32 0L3 0Z"],"B":[120,"M40-66L40-23L59-23Q73-23 78-28Q84-32 84-44Q84-56 78-61Q72-66 59-66ZM40-123L40-89L59-89Q70-89 75-93Q79-97 79-106Q79-115 75-119Q70-123 59-123ZM12-146L59-146Q84-146 96-137Q108-128 108-109Q108-95 101-87Q94-79 80-78Q96-76 105-67Q113-57 113-40Q113-19 100-9Q88 0 59 0L12 0Z"],"C":[120,"M106-4Q99-1 91 1Q84 3 75 3Q46 3 30-17Q15-36 15-73Q15-110 30-129Q46-148 75-148Q84-148 91-147Q99-145 106-141L106-109Q98-116 91-119Q84-123 77-123Q61-123 53-110Q45-97 45-73Q45-48 53-36Q61-23 77-23Q84-23 91-26Q98-29 106-36Z"],"D":[120,"M42-120L42-26L50-26Q67-26 74-37Q81-47 81-73Q81-99 74-109Q67-120 50-120ZM13-146L44-146Q80-146 96-129Q111-112 111-73Q111-34 96-17Q80 0 44 0L13 0Z"],"E":[120,"M107 0L16 0L16-146L107-146L107-120L45-120L45-89L101-89L101-64L45-64L45-25L107-25Z"],"F":[120,"M109-120L47-120L47-89L103-89L103-64L47-64L47 0L18 0L18-146L109-146Z"],"G":[120,"M85-26L85-54L65-54L65-78L110-78L110-12Q102-4 92-1Q82 3 71 3Q42 3 27-17Q11-37 11-73Q11-110 27-129Q43-148 72-148Q81-148 89-146Q98-143 105-139L105-107Q99-115 91-119Q83-123 74-123Q58-123 50-110Q41-98 41-73Q41-48 49-36Q57-23 72-23Q76-23 80-24Q83-25 85-26Z"],"H":[120,"M13-146L42-146L42-90L78-90L78-146L107-146L107 0L78 0L78-65L42-65L42 0L13 0Z"],"I":[120,"M17-120L17-146L104-146L104-120L75-120L75-25L104-25L104 0L17 0L17-25L46-25L46-120Z"],"J":[120,"M11-7L11-41Q19-32 29-28Q38-23 48-23Q59-23 64-29Q70-34 70-47L70-120L34-120L34-146L98-146L98-47Q98-20 87-9Q76 3 50 3Q41 3 31 0Q21-2 11-7Z"],"K":[120,"M11-146L40-146L40-88L85-146L118-146L72-88L120 0L88 0L53-66L40-49L40 0L11 0Z"],"L":[120,"M22 0L22-146L51-146L51-25L112-25L112 0Z"],"M":[120,"M8-146L43-146L60-82L77-146L112-146L112 0L87 0L87-117L72-53L49-53L33-117L33 0L8 0Z"],"N":[120,"M12-146L43-146L83-40L83-146L109-146L109 0L78 0L37-106L37 0L12 0Z"],"O":[120,"M60-123Q49-123 44-111Q39-99 39-73Q39-47 44-35Q49-23 60-23Q71-23 76-35Q81-47 81-73Q81-99 76-111Q71-123 60-123ZM9-73Q9-110 22-129Q35-148 60-148Q86-148 98-129Q111-110 111-73Q111-35 98-16Q86 3 60 3Q35 3 22-16Q9-35 9-73Z"],"P":[120,"M45-122L45-79L56-79Q71-79 76-84Q82-88 82-100Q82-112 76-117Q71-122 56-122ZM16-146L55-146Q86-146 99-135Q112-124 112-100Q112-76 99-65Q86-55 55-55L45-55L45 0L16 0Z"],"Q":[120,"M64 2Q63 3 62 3Q61 3 60 3Q35 3 22-16Q9-35 9-73Q9-110 22-129Q35-148 60-148Q86-148 98-129Q111-110 111-73Q111-47 105-30Q99-12 87-5L106 13L86 27ZM60-123Q49-123 44-111Q39-99 39-73Q39-47 44-35Q49-23 60-23Q71-23 76-35Q81-47 81-73Q81-99 76-111Q71-123 60-123Z"],"R":[120,"M79-69Q83-68 86-65Q89-62 94-52L120 0L89 0L71-37Q70-38 69-41Q61-58 51-58L42-58L42 0L13 0L13-146L55-146Q83-146 95-136Q107-126 107-103Q107-88 100-79Q93-71 79-69ZM42-122L42-82L55-82Q67-82 72-86Q77-91 77-102Q77-112 72-117Q67-122 55-122Z"],"S":[120,"M50-64Q28-72 20-81Q13-91 13-106Q13-126 25-137Q38-148 60-148Q70-148 80-146Q90-144 100-139L100-111Q91-118 81-121Q72-125 62-125Q52-125 46-120Q41-116 41-108Q41-102 45-98Q49-94 62-90L74-85Q92-79 100-68Q108-57 108-41Q108-19 95-8Q82 3 56 3Q45 3 34 0Q23-2 13-7L13-37Q25-29 36-25Q46-21 57-21Q67-21 73-26Q79-31 79-39Q79-46 75-51Q71-56 64-59Z"],"T":[120,"M75 0L46 0L46-121L9-121L9-146L112-146L112-121L75-121Z"],"U":[120,"M10-54L10-146L39-146L39-47Q39-36 45-29Q50-23 60-23Q70-23 76-29Q81-36 81-47L81-146L110-146L110-54Q110-24 98-11Q86 3 60 3Q34 3 22-11Q10-24 10-54Z"],"V":[120,"M60-24L86-146L115-146L80 0L40 0L6-146L35-146Z"],"W":[120,"M0-146L25-146L36-39L48-108L72-108L87-39L95-146L120-146L104 0L77 0L60-77L45 0L18 0Z"],"X":[120,"M118 0L88 0L60-48L32 0L3 0L45-74L4-146L34-146L60-99L87-146L117-146L75-74Z"],"Y":[120,"M1-146L32-146L60-87L89-146L120-146L75-57L75 0L46 0L46-57Z"],"Z":[120,"M13-146L112-146L112-122L44-25L113-25L113 0L11 0L11-24L77-120L13-120Z"],".":[120,"M44-36L76-36L76 0L44 0Z"],"+":[120,"M72-116L72-74L114-74L114-51L72-51L72-9L49-9L49-51L6-51L6-74L49-74L49-116Z"],"-":[120,"M29-72L91-72L91-43L29-43Z"],"!":[120,"M47-28L73-28L73 0L47 0ZM47-146L73-146L73-82L70-47L51-47L47-82Z"],"/":[120,"M88-146L109-146L33 19L11 19Z"],":":[120,"M44-104L76-104L76-68L44-68ZM44-36L76-36L76 0L44 0Z"]," ":[120,""]};
const GZ = {"叮":[200,"M133-4L133-142L112-142Q100-142 88-141Q88-148 88-154Q100-154 112-154L170-154Q182-154 194-154Q193-148 194-141Q182-142 170-142L147-142L147 2Q147 16 139 21Q129 26 110 26Q112 16 105 9Q112 9 120 9Q128 10 131 8Q133 6 133-4ZM30-1L17-1L17-142L75-142L75-1L61-1L61-20L30-20ZM61-131L30-131L30-31L61-31Z"],"跳":[200,"M151-1Q151 3 153 7Q154 10 158 10L177 10Q179 10 179 8L183-20Q189-16 196-16L190 16Q189 18 188 20Q187 21 186 21L158 21Q150 21 144 16Q138 11 138-1L138-137Q138-150 138-163Q145-162 152-163Q151-150 151-137L151-102Q163-108 173-125Q179-121 186-119Q176-98 151-88L151-73Q169-59 185-43L175-33Q164-44 151-54ZM108-50L108-61Q92-46 82-35Q78-43 71-48Q86-54 97-62L108-71L108-91L98-85L78-116L90-123L108-96L108-136Q108-149 107-162Q114-162 121-162Q121-149 121-136L121-50Q121-24 108-4Q94 15 74 24Q71 16 63 13Q83 8 95-9Q108-26 108-50ZM9 23Q8 13 4 7Q10 7 15 6L15-45Q15-57 14-71Q21-70 27-71Q27-57 27-45L27 4Q32 3 38 1L38-95L13-95Q15-123 13-152L72-152Q70-124 71-95L50-95L50-59Q67-59 74-59Q74-54 74-50Q70-50 50-50L50-3Q60-6 73-10L73-2Q44 8 31 13Q19 18 9 23ZM25-144L25-103L60-103L60-144Z"],"咕":[200,"M106 24Q99 23 91 24Q92 10 92-4L92-62L129-62L129-107L101-107Q91-107 80-107Q81-112 80-118Q91-118 101-118L129-118L129-137Q129-150 129-164Q136-163 144-164Q143-150 143-137L143-118L172-118Q183-118 193-118Q193-112 193-107Q183-107 172-107L143-107L143-62L180-62L180 24L166 24L166 6L106 6Q106 15 106 24ZM166-52L106-52L106-4L166-4ZM25-8L9-8L9-148L67-148L67-8L52-8L52-26L25-26ZM52-140L25-140L25-34L52-34Z"],"嘟":[200,"M157 24Q150 23 143 24Q144 11 144-2L144-146L189-146L189-137Q187-133 185-129L171-89Q180-81 186-71Q191-60 191-48L191-31Q192-15 185-8Q180-4 174-2Q168 0 163 1Q161-6 157-11L157-2Q157 11 157 24ZM89 24Q82 23 75 24Q75 11 75-2L75-53Q66-45 57-38Q54-45 46-49Q74-67 95-91L72-91Q64-91 55-91Q55-96 55-100Q64-100 72-100L87-100L87-128L64-128Q64-133 64-137L87-137L86-164Q93-163 100-164L100-137L122-137Q121-134 121-131Q124-137 127-143Q134-138 141-135Q130-117 118-100L138-100Q137-96 138-91L111-91Q103-80 94-71L130-71L130 24L117 24L117 5L88 5Q88 14 89 24ZM157-137L157-12Q165-13 170-14Q175-15 177-17Q179-20 179-24Q180-28 180-31L179-48Q179-60 174-71Q168-82 158-89L174-137ZM117-37L117-62L88-62L88-37ZM117-29L88-29L88-3L117-3ZM120-128L100-128L100-100L102-100Q112-113 120-128ZM18-8L7-8L7-148L49-148L49-8L38-8L38-26L18-26ZM38-140L18-140L18-34L38-34Z"],"外":[200,"M141-5Q141 10 142 24Q134 23 126 24Q127 10 127-5L127-130Q127-145 126-159Q134-158 142-159Q141-145 141-130L141-102L168-82L196-59L186-46L158-70L141-82ZM51-160Q60-157 68-157Q63-137 57-120L110-120Q105-75 81-38Q57-1 19 21Q13 15 5 11Q49-12 74-54L65-47Q53-64 38-80Q28-62 16-48Q10-55 1-57Q31-90 41-119Q47-139 51-160ZM77-59Q89-82 94-108L52-108Q49-101 46-95Q62-78 77-59Z"],"卖":[200,"M179 14L171 27L138 6L104-12L111-26L145-7ZM103-97Q111-97 118-97Q118-84 118-70L118-53Q118-46 116-39L171-39Q181-39 192-40Q191-34 192-29Q181-29 171-29L112-29Q102-12 81 2Q53 21 20 26Q18 16 9 13Q44 10 74-9Q88-18 96-29L27-29Q16-29 6-29Q6-34 6-40Q16-39 27-39L101-39Q104-46 104-53L104-70Q104-84 103-97ZM73-54L63-43L37-66L47-77ZM39-108Q28-108 18-107Q18-113 18-119Q28-118 39-118L92-118L92-139L56-139Q45-139 35-139Q35-145 35-150Q45-150 56-150L91-150Q91-157 91-164Q98-163 106-164Q106-157 105-150L145-150Q155-150 166-150Q165-145 166-139Q155-139 145-139L105-139L105-118L183-118L185-106Q181-106 180-104L164-79L153-87L166-108L65-108Q79-93 90-76L78-67Q66-84 53-99L63-108Z"],"鹈":[200,"M63 24Q56 23 49 24Q50 11 50-3L50-35Q37-12 12 11Q8 5 2 3Q13-7 23-19Q32-32 43-53L18-53L18-95L50-95L50-115L35-115Q26-115 17-115Q18-120 17-125Q26-124 35-124L55-124Q65-140 73-161Q79-158 87-156Q82-142 71-124L95-124L95-85L63-85L63-62L97-62L97-27Q97-20 89-15Q81-10 71-10Q73-19 68-27Q71-26 75-25Q82-25 83-25Q84-26 84-28L84-53L63-53L63-3Q63 11 63 24ZM52-133L39-125L21-156L33-164ZM50-62L50-85L31-85Q31-74 31-62ZM63-95L82-95L82-115L65-115L64-115Q64-115 63-115ZM171-25Q171-20 171-15Q163-15 155-15L128-15Q120-15 112-15Q112-20 112-25Q120-25 128-25L155-25Q163-25 171-25ZM160-102L150-93L137-113L147-122ZM156-66Q158-77 153-83Q157-82 164-82Q170-82 171-83Q171-84 171-87L171-127L145-127L142-124Q142-125 141-127Q138-127 132-127L132-59L193-59L193 9Q193 16 188 21Q180 28 164 28Q165 17 160 11Q165 12 172 12Q179 12 181 11Q182 10 182 5L182-49L121-49L121-136Q129-136 137-136Q143-144 147-156Q152-153 158-152Q156-142 152-136L183-136L183-84Q183-78 178-73Q171-67 156-66Z"],"鹕":[200,"M98-52L79-52Q80-23 70-4Q61 14 45 24Q41 17 34 14Q65 1 66-45L66-149L111-149L111 2Q111 15 104 20Q95 25 81 25Q83 16 78 9Q82 10 89 10Q95 10 96 8Q98 6 98-5ZM23-4L10-4L10-76Q18-76 26-76L26-107L3-107Q4-112 3-116L26-116L26-139Q26-152 26-165Q33-164 40-165Q39-152 39-139L39-116L64-116Q64-112 64-107L39-107L39-76L55-76L55-4L43-4L43-21L23-21ZM98-105L98-140L79-140L79-105ZM98-60L98-97L79-97L79-60ZM43-67L23-67L23-28L43-28ZM173-25Q173-20 173-15Q165-15 158-15L133-15Q125-15 118-15Q118-20 118-25Q125-25 133-25L158-25Q165-25 173-25ZM163-102L153-93L141-113L150-122ZM159-66Q161-77 156-83Q160-82 166-82Q172-82 173-83Q173-84 173-87L173-127L148-127L146-124Q146-125 145-127Q142-127 137-127L137-59L193-59L193 9Q193 16 189 21Q182 28 166 28Q168 17 163 11Q168 12 174 12Q181 12 182 11Q183 10 183 5L183-49L127-49L127-136Q134-136 141-136Q147-144 150-156Q155-153 161-152Q159-142 155-136L184-136L184-84Q184-78 179-73Q173-67 159-66Z"],"好":[200,"M193-71Q193-65 193-59Q182-59 171-59L148-59L148 4Q148 17 139 21Q129 26 111 26Q113 16 107 9Q113 10 121 10Q130 10 132 8Q134 7 134-1L134-59L111-59Q99-59 88-59Q89-65 88-71Q99-71 111-71L134-71L134-103L160-129L119-129Q108-129 97-128Q97-134 97-141Q108-140 119-140L181-140L183-127Q178-126 174-122L148-97L148-71L171-71Q182-71 193-71ZM40-157Q48-155 58-155Q54-134 50-113L64-113Q75-113 85-113Q84-108 85-104Q83-104 82-104Q75-65 63-30Q79-18 89-1Q81 2 74 6Q67-7 57-17Q42 14 13 29Q9 22 1 18Q30 3 45-26Q31-35 13-38Q26-70 33-104L7-104Q8-108 7-113L35-113Q39-135 40-157ZM66-104L48-104L47-101Q40-73 31-46Q41-42 50-37Q60-65 66-104Z"],"帅":[200,"M140 24Q132 23 124 24Q125 10 125-5L125-108L99-108L99-42Q99-28 100-13Q92-14 84-13Q85-28 85-42L85-120L125-120L125-135Q125-150 124-164Q132-163 140-164Q139-150 139-135L139-120L183-120L183-32Q182-19 172-15Q164-11 152-11Q154-21 148-29Q153-28 159-28Q166-28 167-29Q169-30 169-36L169-108L139-108L139-5Q139 10 140 24ZM52-43L52-134Q52-148 51-163Q59-162 67-163Q66-148 66-134L66-43Q66-19 53 0Q40 19 18 26Q15 17 8 13Q26 10 39-6Q52-21 52-43ZM37-27Q29-28 21-27Q21-42 21-56L21-104Q21-119 21-134Q29-133 37-134Q36-119 36-104L36-56Q36-42 37-27Z"],"到":[200,"M49-45L29-45Q18-45 8-45Q9-50 8-56Q18-55 29-55L49-55L49-87L9-83L8-94Q12-94 14-96Q20-102 30-117Q40-131 45-143L26-143Q16-143 5-142Q6-148 5-154Q16-153 26-153L88-153Q99-153 109-154Q109-148 109-142Q99-143 88-143L63-143Q58-134 45-117Q33-101 29-96L79-99L67-114L79-124Q95-104 109-83L96-75Q91-83 86-90L79-90L63-88L63-55L85-55Q96-55 106-56Q106-50 106-45Q96-45 85-45L63-45L63-10Q79-13 110-21L110-12Q42 5 5 16Q6 7 1 0Q24-2 49-7ZM149 28Q151 17 145 11Q151 12 159 12Q166 12 169 10Q171 8 171-1L171-131Q171-145 171-159Q178-158 186-159Q185-145 185-131L185 3Q185 21 172 25Q162 29 149 28ZM145-24Q138-24 130-24Q130-37 130-52L130-102Q130-116 130-130Q138-129 145-130Q144-116 144-102L144-52Q144-37 145-24Z"],"了":[200,"M90-5L90-98L140-133L44-133Q31-133 18-132Q18-139 18-146Q31-146 44-146L168-146L169-132Q161-129 153-124L105-90L105-1Q105 8 99 14Q90 21 67 21Q69 11 62 3Q68 4 77 4Q87 4 88 3Q90 1 90-5Z"],"吗":[200,"M163-36Q163-29 163-23Q152-24 141-24L92-24Q80-24 69-23Q70-29 69-36Q80-35 92-35L141-35Q152-35 163-36ZM177 2L177-60L95-60L99-103Q101-117 101-132Q109-130 117-130Q115-116 113-102L110-71L153-71L160-145L109-145Q97-145 86-144Q87-151 86-157Q97-156 109-156L176-156L167-71L191-71L191 6Q191 13 185 19Q177 26 155 26Q157 16 150 9Q156 9 165 9Q174 10 176 8Q177 7 177 2ZM24-8L9-8L9-148L66-148L66-8L51-8L51-26L24-26ZM51-140L24-140L24-34L51-34Z"],"冲":[200,"M139 24Q131 23 123 24Q124 10 124-5L124-53L86-53Q86-43 87-33Q79-34 71-33Q72-47 72-62L72-121L124-121L124-136Q124-150 123-164Q131-163 139-164Q138-150 138-136L138-121L185-121L185-38L171-38L171-53L138-53L138-5Q138 10 139 24ZM138-65L171-65L171-110L138-110ZM124-65L124-110L86-110L86-65ZM26 14Q19 9 8 8Q15-6 23-26Q30-45 44-93L52-87Q39-41 33-18ZM36-105Q22-122 7-136L17-148Q33-133 47-115Z"],"鸭":[200,"M56 24Q48 23 41 24Q42 11 42-3L42-44L10-44Q11-70 11-96Q11-123 10-149L88-149Q85-96 88-44L55-44L55-3Q55 11 56 24ZM55-101L74-101L74-139L55-139ZM42-101L42-139L23-139L23-101ZM55-91L55-53L74-53L74-91ZM42-91L23-91L23-53L42-53ZM164-25Q163-20 164-15Q154-15 144-15L110-15Q100-15 90-15Q90-20 90-25Q100-25 110-25L144-25Q154-25 164-25ZM150-102L138-93L121-113L133-122ZM146-66Q147-77 142-83Q147-82 155-82Q162-82 163-83Q164-84 164-87L164-127L131-127L128-124Q127-125 126-127Q122-127 116-127L116-59L191-59L191 9Q191 16 185 21Q176 28 155 28Q156 17 150 11Q156 12 165 12Q174 12 176 11Q177 10 177 5L177-49L102-49L102-136Q112-136 121-136Q129-144 133-156Q140-153 148-152Q145-142 140-136L178-136L178-84Q178-78 172-73Q164-67 146-66Z"],"！":[200,"M111-137L103-34L94-34L87-137ZM109 0L88 0L88-21L109-21Z"],"？":[200,"M146-101Q146-78 120-65Q110-59 107-56Q103-52 104-38L104-34L90-34L90-43Q90-57 93-63Q96-68 102-71Q116-79 119-82Q128-89 128-100Q128-116 114-122Q108-125 100-125Q80-125 72-107L70-99Q69-97 69-96L54-99Q58-127 81-136Q90-139 101-139Q123-139 136-126L140-121Q146-112 146-101ZM108 0L87 0L87-20L108-20Z"]};
// text -> one path d, laid out from (x, y) = (left, baseline) at the given em size; returns { d, w }
function tpath(G, str, size, x = 0, y = 0, track = 0) {
  const k = size / 200; let pen = 0, d = '';
  for (const ch of str) {
    const g = G[ch];
    if (!g) { pen += 70 + track / k; continue; }
    let i = 0;
    d += g[1].replace(/-?\d+(\.\d+)?/g, m => ' ' + f(i++ % 2 ? y + +m * k : x + (pen + +m) * k));
    pen += g[0] + track / k;
  }
  return { d, w: pen * k - track };
}

// fly loop around the delivery box (rider-local): centre + half extents
const FLY_C = [196, -318], FLY_A = [56, 26];
// neon light-trail anchors (rider-local, on the trailing silhouette): rear rim top / back, front rim top, scarf, back, tail
const TRAILS = [[-140, -204, 'M'], [-222, -100, 'M'], [-104, -470, 'C'], [-152, -406, 'M'], [-188, -366, 'C']];
const LP = [BIKE.lamp[0] + 7, BIKE.lamp[1]];                     // laser emitter (rider-local)
const FC = [BIKE.frontHub[0], 0], RCON = BIKE.rearContact;       // tyre contacts (rider-local)
// escort drones (world): idle parking spot (off-screen for the flock) → escort station
const ESC = [
  { kind: 'cam', idle: [448, 228], st: [466, 256], s: 1.45, col: 'cyan' },
  { kind: 'cargo', idle: [-300, 200], st: [1165, 196], s: 1.15, col: 'magenta' },
  { kind: 'racer', idle: [-300, 430], st: [300, 424], s: 1.0, col: 'magenta' },
  { kind: 'patrol', idle: [-300, 130], st: [640, 140], s: 0.95, col: 'acid' },
];
const PSLOTS = ['tail', 'wingFarUpper', 'thighFar', 'shankFar', 'body', 'head', 'pouch', 'billLower', 'billUpper', 'thighNear', 'shankNear', 'footNear', 'wingNearUpper', 'wingNearLower'];
const REFL_K = 0.82;
// live-stream comments (danmaku) scrolling right to left: [text, font, colour]
const DM = [['666', 'M', '#FFFFFF'], ['鹈鹕好帅！', 'Z', 'magC'], ['GG', 'M', '#FFFFFF'], ['外卖到了吗？', 'Z', '#FFFFFF'], ['冲鸭！', 'Z', 'cyC'], ['+1 FISH', 'M', 'acidC']];   // wet-asphalt reflection squash (perspective foreshortening of the mirror image)

// ------------------------------------------------------------------------------------------------ detail inventory
export const detailItems = [
  ['fx:O:drone-far', 'O', 'far delivery-drone traffic over the harbour: two liveries (plain / parcel-carrying), rotor discs, red + acid nav lights, drifting with parallax'],
  ['fx:O:drone-far-parcel', 'O', 'far parcel drones: magenta livery with a 外卖 box swinging under them'],
  ['fx:O:drone-far-strobe', 'O', 'white anti-collision strobes blinking out of phase on the far drones'],
  ['fx:O:underglow-pool', 'O', 'the bike\'s magenta underglow pooled on the wet asphalt (stacked radial gradients, fades in a hop)'],
  ['fx:O:shadow-contact', 'O', 'void contact shadow + soft penumbra under each tyre (shrinks / fades in a hop)'],
  ['fx:T:tyre-wake', 'T', 'thin cyan wake lines trailing from each tyre contact through the water film, flowing with the road'],
  ['fx:O:headlight-road-pool', 'O', 'the laser headlight\'s cyan pool on the road ahead'],
  ['fx:O:reflection-wheels', 'O', 'wet reflection of both glowing rims (magenta rear, cyan front) and the dark tyres, mirrored and foreshortened'],
  ['fx:O:reflection-bike', 'O', 'reflected frame: void tubes with the cyan top-tube LED strip, the magenta down-tube underglow and the lamp'],
  ['fx:O:reflection-pelican', 'O', 'reflected pelican silhouette (jacket, neck, head, bill, pouch, pedalling legs, wings) following the live pose'],
  ['fx:T:reflection-ripples', 'T', 'the reflection broken into ripple bands that widen with depth, plus shimmering cyan ripple glints'],
  ['fx:O:neon-smears', 'O', 'vertical neon smears on the wet road under the rims and the headlamp (broken, gradient-faded streaks)'],
  ['fx:O:laser-cone', 'O', 'laser headlight: two-stage cyan light cone fading into the rain'],
  ['fx:O:laser-core', 'O', 'the laser core beam: wide faint cyan under a hairline white-cyan core'],
  ['fx:T:lidar-pulses', 'T', 'LiDAR pulses racing along the core beam'],
  ['fx:O:lidar-scan', 'O', 'LiDAR scan line of dots sweeping the road ahead of the front wheel'],
  ['fx:O:lamp-flare', 'O', 'laser-emitter flare: white-cyan glow with a slowly turning four-point star and cross hairs'],
  ['fx:O:cyber-moths', 'O', 'cyber-moths with LED eyespot wings circling the headlamp'],
  ['fx:O:drone-camera', 'O', 'camera drone escorting the courier: hex shell with cyan / magenta rim light, arms, motor pods, skids, "07" decal'],
  ['fx:T:drone-rotor-blur', 'T', 'rotor blur discs with spinning blade flicker on every drone'],
  ['fx:O:drone-nav-lights', 'O', 'drone nav lights (red port, acid starboard) and a blinking white strobe'],
  ['fx:O:drone-gimbal', 'O', 'the camera drone\'s gimbal ball with its cyan lens ring and glint'],
  ['fx:O:drone-scan-cone', 'O', 'the camera drone\'s scan cone tracking the pelican\'s head (dashed edges)'],
  ['fx:O:drone-rec', 'O', 'blinking REC light and "REC · CAM-07" micro label: the courier is live-streamed'],
  ['fx:O:danmaku', 'O', 'live-stream danmaku comments (666 · 鹈鹕好帅！ · GG · 外卖到了吗？ · 冲鸭！ · +1 FISH) scrolling behind the rider in outlined type'],
  ['fx:O:live-hud', 'O', 'floating AR stream panel by the camera drone: LIVE tag, 2.3K viewers, audience sparkline'],
  ['fx:O:ar-waypoint', 'O', 'AR courier waypoint ahead of the front wheel: neon pin, dashed stalk to a landing ring, pulsing chevrons, DROP-OFF + live distance to the next holo-marker'],
  ['fx:O:drone-cargo', 'O', 'cargo drone (joins above 86 rpm) swinging a 外卖 takeaway box on its cable'],
  ['fx:O:drone-racer', 'O', 'magenta racer drone (sprint escort) with its own light trail'],
  ['fx:O:drone-patrol', 'O', 'acid patrol drone with an alternating red / cyan light bar'],
  ['fx:O:light-trails', 'O', 'neon light trails off the rims, scarf and tail, only above 86 rpm and sparse (toggle "speedlines")'],
  ['fx:O:data-stream', 'O', 'the calm wind: ONE slow holographic data-stream of 0/1 bits drawn on and wiped off, rarely'],
  ['fx:O:spray-droplets', 'O', 'rooster-tail spray of lit droplets flung off the rear tyre on ballistic arcs (scales with speed and wetness)'],
  ['fx:O:spray-mist', 'O', 'soft spray mist rolling off the rear tyre'],
  ['fx:O:spray-bow', 'O', 'bow-wave droplets thrown ahead of the front tyre'],
  ['fx:O:land-splash', 'O', 'landing splash crowns from both tyres'],
  ['fx:O:land-shock-ring', 'O', 'HUD shock rings with tick marks at both contacts on landing'],
  ['fx:O:sparks', 'O', 'amber / magenta sparks scraped off the rims on landing'],
  ['fx:O:rain-splash-rider', 'O', 'rain splash crowns bursting on the head, bill, jacket shoulders and delivery box (in the rain)'],
  ['fx:O:feather-contour', 'O', 'drifting contour feather: white vane rim-lit magenta, cyan rachis, barbs, split notch'],
  ['fx:O:feather-down', 'O', 'drifting down plume, wisps rim-lit cyan'],
  ['fx:O:flyer-tumble', 'O', 'a 外卖 takeaway flyer tumbling past: magenta header, menu lines, QR block, "0719"'],
  ['fx:O:holo-butterfly', 'O', 'holographic butterfly fluttering ahead of the bill (blown away when sprinting)'],
  ['fx:T:holo-butterfly-scan', 'T', 'the hologram\'s wireframe veins, scanline fill and glitch flicker'],
  ['fx:O:bot-fly', 'O', 'a bug-bot fly with red LED eyes and cyan wings buzzing figure-eights round the delivery box'],
  ['fx:T:fly-dotted-trail', 'T', 'acid dotted flight trail behind the bug-bot'],
  ['fx:O:cryo-mist', 'O', 'cold cryo mist spilling over the lip of the refrigerated fish box and sinking down its front, with ice glints'],
  ['fx:O:glint-bell', 'O', 'cyan four-point glint twinkling on the chrome bell'],
  ['fx:O:pop-ding', 'O', 'glitch HUD pop DING! + 叮 with "SYS//BELL.EXE" and "ACK 200" labels'],
  ['fx:O:pop-hop', 'O', 'glitch HUD pop HOP! + 跳 with "SYS//JUMP.EXE" and "AIR OK"'],
  ['fx:O:pop-gulp', 'O', 'glitch HUD pop GULP! + 咕嘟 with "SYS//FEED.EXE" and "+1 FISH"'],
  ['fx:T:pop-scanlines', 'T', 'CRT scanlines, RGB split (cyan / magenta ghosts) and corner brackets on the pops'],
  ['fx:T:pop-glitch', 'T', 'slice-offset glitches and glitch bars as the pops switch on and off (CRT collapse)'],
  ['fx:O:bell-rings', 'O', 'sound rings rippling off the bell'],
  ['fx:O:bell-notes', 'O', 'neon eighth note and beamed pair rising from the bell'],
  ['fx:O:gulp-drips', 'O', 'glowing drips falling from the bill during the scoop'],
  ['fx:O:pixel-hearts', 'O', 'pixel hearts rising after the gulp, blinking out'],
  ['fx:O:holo-fish-bone', 'O', 'holographic fish bone (wireframe, RGB ghost, X eye) spat over the shoulder, tumbling back and hovering with drag'],
  ['fx:T:derez-pixels', 'T', 'the fish bone derezzing into rising pixels'],
  ['fx:O:wave-arcs', 'O', 'HUD wave arcs and a "HI!" tag beside the waving wing'],
].map(([key, kind, what]) => ({ id: key.split(':')[2], layer: 'fx', kind, what, key }))
  .concat(light.detailItems.map(d => ({ ...d, id: d.id.split(':')[2], key: d.id })));
// lighting pass (light.js): the haze-pool strip is a composited sheet that only translates
// the wet-road rider reflection repaints on its own small sheet (it updates at 30 Hz; the big road pools under it stay put)
export const isolate = ['[data-ref="fx-refl"]'];
export const sheets = [...light.sheets, ...Array.from({ length: 7 }, (_, i) => `[data-ref="fx-gfar${i}"]`)];

// ------------------------------------------------------------------------------------------------ build
export function build(ctx) {
  const { v, rng } = ctx;
  const I = k => v('ink' + k);
  const C = { mag: v('magenta'), magC: v('magentaCore'), cy: v('cyan'), cyC: v('cyanCore'), acid: v('acid'), acidC: v('acidCore'), amb: v('amber'), ambC: v('amberCore'), red: v('red'), redC: v('redCore'), vio: v('violet'), void: v('void') };
  let defs = '';
  const L = { far: '', shadow: '', back: '', front: '' };
  const B = BIKE;

  // ---------------------------------------------- gradients (the only "glow": no filters)
  const stops = list => list.map(([o, c, a]) => h('stop', { offset: o, 'stop-color': c, 'stop-opacity': a })).join('');
  const rg = (idn, list) => { defs += h('radialGradient', { id: idn }, stops(list)); };
  const lgr = (idn, a, list) => { defs += h('linearGradient', { id: idn, ...a }, stops(list)); };
  rg('fx-gUnder', [[0, C.mag, 0.62], [0.45, C.mag, 0.24], [1, C.mag, 0]]);
  rg('fx-gPool', [[0, C.cyC, 0.55], [0.4, C.cy, 0.2], [1, C.cy, 0]]);
  rg('fx-gFlare', [[0, '#FFFFFF', 1], [0.18, C.cyC, 0.8], [0.45, C.cy, 0.28], [1, C.cy, 0]]);
  for (const [n, c] of [['C', C.cy], ['M', C.mag], ['A', C.acid], ['R', C.red], ['W', C.cyC], ['K', C.amb]]) rg('fx-gG' + n, [[0, c, 0.75], [0.35, c, 0.3], [1, c, 0]]);
  rg('fx-gRotor', [[0, '#C4CBE6', 0.08], [0.72, '#C4CBE6', 0.32], [0.9, '#E9E6F2', 0.5], [1, '#E9E6F2', 0]]);
  rg('fx-gMist', [[0, '#E9E6F2', 0.4], [0.5, C.cyC, 0.16], [1, C.cyC, 0]]);
  lgr('fx-gBeam', { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, C.cyC, 0.5], [0.35, C.cy, 0.17], [1, C.cy, 0]]);
  lgr('fx-gCone', { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, C.cyC, 0.34], [1, C.cy, 0]]);
  for (const [n, c, core] of [['M', C.mag, C.magC], ['C', C.cy, C.cyC], ['W', C.cyC, '#FFFFFF']]) {
    lgr('fx-gSmear' + n, { gradientUnits: 'userSpaceOnUse', x1: 0, y1: GROUND_Y + 2, x2: 0, y2: GROUND_Y + 96 }, [[0, core, 0.7], [0.25, c, 0.4], [1, c, 0]]);
    lgr('fx-gTrail' + n, { gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: -100, y2: 0 }, [[0, core, 0.95], [0.3, c, 0.55], [1, c, 0]]);
  }
  const glow = (x, y, r, g, op = 1) => h('path', { d: circ(x, y, r), fill: `url(#fx-gG${g})`, opacity: op });
  // stacked-stroke neon: wide faint halo, mid, thin bright core
  const neon = (d, col, core, w = 1.2, extra = {}) => h('g', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra },
    h('path', { d, stroke: col, 'stroke-width': w * 5, opacity: 0.16 }),
    h('path', { d, stroke: col, 'stroke-width': w * 2.2, opacity: 0.45 }),
    h('path', { d, stroke: core, 'stroke-width': w }));
  const mono = (str, size, x, y, fill, anchor = 'start', extra = {}) => {
    const w = tpath(GM, str, size).w, x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
    return h('path', { d: tpath(GM, str, size, x0, y).d, fill, ...extra });
  };

  // ============================================== drones
  const droneArt = (i, kind, col, withRefs, key) => {
    const c = C[col === 'cyan' ? 'cy' : col === 'magenta' ? 'mag' : 'acid'], gN = col === 'cyan' ? 'C' : col === 'magenta' ? 'M' : 'A';
    const R = s => withRefs ? { 'data-ref': `fx-esc${s}${i}` } : {};
    const rotor = (x, s) => h('g', { transform: `translate(${x} -10)` },
      h('ellipse', { rx: 16, ry: 2.6, fill: 'url(#fx-gRotor)' }),
      h('path', { d: 'M-15 -0.2A15 2.4 0 0 0 -4 2.2M15 0.2A15 2.4 0 0 1 4 -2.2', fill: 'none', stroke: '#E9E6F2', 'stroke-width': 0.5, opacity: 0.55 }),
      h('g', R(s), h('path', { d: 'M-14 0H14', stroke: '#C4CBE6', 'stroke-width': 1.3, 'stroke-linecap': 'round', opacity: 0.8 })),
      h('path', { d: 'M0 -1.4V1.6', stroke: v('steel'), 'stroke-width': 2 }));
    let g = '', extra = '';
    // belly glow + far arms (behind) + arms + pods
    g += h('ellipse', { cy: 8, rx: 16, ry: 5, fill: `url(#fx-gG${gN})`, opacity: 0.8 });
    g += h('path', { d: 'M-20 -7H20', stroke: v('ink'), 'stroke-width': 2.2, opacity: 0.9 });
    g += h('path', { d: 'M-27 -4H27', stroke: v('steel'), 'stroke-width': 3, 'stroke-linecap': 'round' });
    g += h('path', { d: rect(-30, -9, 6, 6) + rect(24, -9, 6, 6), fill: v('steel') });
    g += h('path', { d: 'M-30 -9h6M24 -9h6', stroke: c, 'stroke-width': 0.8 });
    g += rotor(-27, 'Ra') + h('g', { ...(i === 0 && withRefs ? DD('fx:T:drone-rotor-blur') : {}) }, rotor(27, 'Rb'));
    // shell
    g += h('path', { d: 'M-14 -6L12 -6Q17 -6 18.4 -1.2L14 6L-12 6L-17 -1Q-16.4 -6 -14 -6Z', fill: v('ink'), stroke: v('steel'), 'stroke-width': 0.7 });
    g += h('path', { d: 'M-13 -5.2L12.4 -5.2Q15.6 -5 17 -1.6', fill: 'none', stroke: c, 'stroke-width': 1.1, 'stroke-linecap': 'round' });
    g += h('path', { d: 'M-11 5.3H13', stroke: C.mag, 'stroke-width': 0.9, opacity: 0.85 });
    g += h('path', { d: 'M-4 -5V5M-10 -1.4h4.4M-10 1.2h4.4', stroke: v('steel'), 'stroke-width': 0.6, fill: 'none' });
    g += h('path', { d: circ(14.6, -0.8, 1.9), fill: C.cyC }) + glow(14.6, -0.8, 5, 'W', 0.7);
    g += h('path', { d: 'M-8 6L-11 12M8 6L11 12M-15 12H-7M7 12H15', stroke: v('steel'), 'stroke-width': 1.1, fill: 'none', 'stroke-linecap': 'round' });
    g += mono(kind === 'cam' ? '07' : kind === 'cargo' ? '12' : kind === 'racer' ? '99' : 'P1', 4.6, 0.6, 3.4, c);
    // nav lights (+ glow) and the strobe
    g += h('g', { ...(i === 0 && withRefs ? DD('fx:O:drone-nav-lights') : {}) },
      glow(-30, -6, 6, 'R'), h('path', { d: circ(-30, -6, 1.5), fill: C.redC }), glow(30, -6, 6, 'A'), h('path', { d: circ(30, -6, 1.5), fill: C.acidC }),
      h('g', R('S'), glow(0, -8.5, 7, 'W'), h('path', { d: circ(0, -8.5, 1.4), fill: '#FFFFFF' })));
    if (kind === 'cam') {
      g += h('g', { ...(withRefs ? DD('fx:O:drone-gimbal') : {}) },
        h('path', { d: 'M3 6V8', stroke: v('steel'), 'stroke-width': 2 }),
        h('path', { d: circ(4.5, 11.5, 5.2), fill: v('steel'), stroke: v('ink'), 'stroke-width': 0.8 }),
        h('path', { d: circ(6.4, 11.8, 2.8), fill: C.void, stroke: C.cy, 'stroke-width': 1 }),
        h('path', { d: circ(7.2, 11, 0.7), fill: '#FFFFFF' }));
      g += h('g', { ...(withRefs ? DD('fx:O:drone-rec') : {}) },
        h('g', R('Rec'), glow(-10, -15, 5, 'R'), h('path', { d: circ(-10, -15, 1.6), fill: C.red })),
        mono('REC', 5, -7, -13.2, C.cyC), mono('CAM-07', 3.8, -12, 20, C.cy, 'start', { opacity: 0.8 }));
      // floating AR stream panel: LIVE + viewer count + an audience sparkline
      extra += h('g', { transform: 'translate(-64 22)', ...(withRefs ? DD('fx:O:live-hud') : {}) },
        h('path', { d: 'M0 0H40V17H4L0 13Z', fill: C.void, 'fill-opacity': 0.72, stroke: C.cy, 'stroke-width': 0.6 }),
        h('path', { d: 'M40 0L46 -6', stroke: C.cy, 'stroke-width': 0.5, fill: 'none' }),
        h('path', { d: rect(2.4, 2.4, 13.6, 5.6), fill: C.red }), mono('LIVE', 4.4, 3.6, 7, '#FFFFFF'), mono('2.3K', 4.4, 18.6, 7, C.acid),
        h('path', { d: 'M3 14L7 12.4L10 13.2L14 10.6L17 11.8L21 9.6L25 10.4L29 8.8L33 10L37 9', fill: 'none', stroke: C.mag, 'stroke-width': 0.7, 'stroke-linejoin': 'round' }));
    }
    if (kind === 'cargo') {
      g += h('path', { d: 'M0 6V19', stroke: v('steel'), 'stroke-width': 0.8 });
      g += h('g', { ...R('Box'), transform: 'translate(0 19)' },
        h('path', { d: rect(-12, 0, 24, 18), fill: v('basket'), stroke: C.mag, 'stroke-width': 1 }),
        h('path', { d: rect(-12, 0, 24, 18), fill: 'none', stroke: C.mag, 'stroke-width': 3.4, opacity: 0.2 }),
        h('path', { d: tpath(GZ, '外卖', 9.4, -9.4, 11).d, fill: '#FFFFFF' }),
        h('path', { d: 'M-9 15H9', stroke: C.acid, 'stroke-width': 1.2 }), h('path', { d: 'M-2 -1V1M2 -1V1', stroke: v('steel'), 'stroke-width': 1 }));
    }
    if (kind === 'patrol') {
      g += h('path', { d: rect(-7, -9.6, 14, 2.4), fill: v('ink') });
      g += h('g', R('La'), glow(-4, -8.4, 6, 'R'), h('path', { d: rect(-6.4, -9.4, 5.6, 2), fill: C.red }));
      g += h('g', R('Lb'), glow(4, -8.4, 6, 'C'), h('path', { d: rect(0.8, -9.4, 5.6, 2), fill: C.cy }));
    }
    return (key ? h('g', DD(key), g) : g) + extra;
  };
  // far drone defs (L-gulls-far): the same drone, simplified, in two liveries
  defs += h('g', { id: 'fx-fd' }, droneArt(9, 'far', 'cyan', false));
  defs += h('g', { id: 'fx-fdb' }, droneArt(9, 'cargo', 'magenta', false));
  const Rd = rng('fx-drones');
  const FAR = [];
  for (let i = 0; i < 7; i++) FAR.push({ x0: Rd() * 2800, y: 110 + i * 34 + Rd() * 20, s: 0.36 + Rd() * 0.16, vx: [210, -60, 320, 150, -120, 260, 90][i], ph: Rd() * 10, box: i % 3 === 1 });
  // each far drone is a composited strip (core/sheets.js): the outer group only translates (a compositor move); its
  // fixed bank angle and scale sit on the inner group
  L.far += h('g', {}, FAR.map((g, i) => h('g', { 'data-ref': 'fx-gfar' + i, ...DD(g.box ? 'fx:O:drone-far-parcel' : 'fx:O:drone-far'), transform: `translate(${f(g.x0)} ${f(g.y)})` },
    h('g', { transform: `rotate(${f1(clamp(g.vx / 60, -4, 5))}) scale(${f(g.s)})` },
      h('use', { href: g.box ? '#fx-fdb' : '#fx-fd' }),
      h('g', { 'data-ref': 'fx-gfs' + i, ...DD('fx:O:drone-far-strobe') }, glow(0, -8.5, 12, 'W'), h('path', { d: circ(0, -8.5, 2.2), fill: '#FFFFFF' }))))));
  // escort drones (L-fx-back)
  const escKeys = ['fx:O:drone-camera', 'fx:O:drone-cargo', 'fx:O:drone-racer', 'fx:O:drone-patrol'];
  let esc = '';
  ESC.forEach((g, i) => {
    let inner = '';
    if (g.kind === 'cam') {
      // scan cone from the gimbal lens toward the rider's head (rotated per frame)
      inner += h('g', { 'data-ref': 'fx-escCone', transform: 'translate(6.4 11.8)', style: NH },
        h('path', { d: 'M0 0L190 -30L190 30Z', fill: 'url(#fx-gCone)' }),
        h('path', { d: 'M0 0L150 -23.7M0 0L150 23.7', stroke: C.cy, 'stroke-width': 0.6, 'stroke-dasharray': '3 4', opacity: 0.55, fill: 'none' }),
        h('path', { d: 'M150 -23.7A150 150 0 0 1 150 23.7', stroke: C.cyC, 'stroke-width': 0.8, fill: 'none', opacity: 0.45 }));
    }
    if (g.kind === 'racer') inner += h('path', { 'data-ref': 'fx-escTrail', d: 'M-16 -3L-110 -0.6L-110 0.6L-16 3Z', fill: 'url(#fx-gTrailM)', opacity: 0.8 });
    inner += droneArt(i, g.kind, g.col, true, escKeys[i]);
    esc += h('g', { 'data-ref': 'fx-esc' + i, transform: `translate(${g.idle[0]} ${g.idle[1]}) scale(${g.s})` }, inner);
  });

  // ============================================== the wet road (L-shadow)
  // underglow pool + contact shadows + tyre wakes + the laser's road pool, all in world x around the rider
  const contact = (ref, x) => h('g', { 'data-ref': ref, transform: `translate(${RIDER_X + x} ${GROUND_Y + 1})` },
    h('ellipse', { cy: 1.2, rx: 58, ry: 6.5, fill: C.void, opacity: 0.35 }),
    h('ellipse', { rx: 32, ry: 3.8, fill: C.void, opacity: 0.85 }));
  const wake = x => h('path', { d: `M${x - 6} 0.6C${x - 40} 2.4 ${x - 80} 5 ${x - 130} 9M${x - 6} -0.4C${x - 44} -1 ${x - 90} -1.6 ${x - 140} -2.4M${x + 4} 0.8C${x + 16} 2 ${x + 26} 3.6 ${x + 36} 6`, fill: 'none', stroke: C.cyC, 'stroke-width': 0.9, 'stroke-linecap': 'round', 'stroke-dasharray': '12 6 5 9', opacity: 0.55 });
  L.shadow += h('g', { 'data-ref': 'fx-road', transform: `translate(${RIDER_X} ${GROUND_Y})` },
    h('g', { 'data-ref': 'fx-under', style: NH },
      h('ellipse', { cx: 24, cy: 3, rx: 300, ry: 30, fill: 'url(#fx-gUnder)' }),
      h('ellipse', { cx: 24, cy: 2, rx: 150, ry: 11, fill: 'url(#fx-gUnder)' }),
      h('ellipse', { cx: -125, cy: 2, rx: 84, ry: 8, fill: 'url(#fx-gGM)', opacity: 0.8 }),
      h('ellipse', { cx: 173, cy: 2, rx: 84, ry: 8, fill: 'url(#fx-gGC)', opacity: 0.7 })),
    h('g', { 'data-ref': 'fx-pool', style: 'opacity:var(--pb-n-lampOn);' + NH },
      h('ellipse', { cx: 560, cy: 3, rx: 240, ry: 17, fill: 'url(#fx-gPool)' }),
      h('ellipse', { cx: 470, cy: 2, rx: 110, ry: 7, fill: 'url(#fx-gPool)' })),
    h('g', { 'data-ref': 'fx-wake', ...DD('fx:T:tyre-wake') }, wake(RCON[0]), wake(FC[0])));
  L.shadow += contact('fx-cR', RCON[0]) + contact('fx-cF', FC[0]);

  // mirrored wet reflection of bike + rider (rider-local art under a mirror transform), broken into ripple bands
  const tube = (a, b) => `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`;
  const frameD = [tube(B.rearHub, B.bb), tube(B.rearHub, B.seatTubeTop), tube(B.bb, B.seatClamp), tube(B.bb, B.headBottom),
    tube(B.headTop, B.frontHub), tube(B.steererTop, B.stem), tube(B.stem, B.gripNear), tube(B.seatClamp, [-60.5, -287])].join('');
  let bands = '', y = 2;
  for (let i = 0; y > -360; i++) { const depth = -y / 360, hh = lerp(16, 3, depth) * (0.7 + 0.6 * hash(i, 5)), gap = lerp(2, 11, depth) * (0.6 + 0.8 * hash(i, 6)); bands += rect(-400, y - hh, 1000, hh); y -= hh + gap; }
  defs += h('clipPath', { id: 'fx-rclip' }, h('path', { d: bands }));
  const wheelRefl = (x, col, core) => h('path', { d: circ(x, -100, 96), fill: 'none', stroke: C.void, 'stroke-width': 9, opacity: 0.55 }) +
    h('path', { d: circ(x, -100, 91), fill: 'none', stroke: col, 'stroke-width': 13, opacity: 0.2 }) +
    h('path', { d: circ(x, -100, 91), fill: 'none', stroke: core, 'stroke-width': 3.2, opacity: 0.8 }) +
    h('path', { d: circ(x, -100, 7), fill: col, opacity: 0.6 });
  const reflPel = h('g', { ...DD('fx:O:reflection-pelican') },
    h('path', { 'data-ref': 'fx-rfNeck', d: 'M0 0L0 0', fill: 'none', stroke: v('plume'), 'stroke-width': 26, 'stroke-linecap': 'round', opacity: 0.4 }),
    PSLOTS.map(s => h('g', { 'data-ref': 'fx-rf-' + s }, h('rect', { 'data-ref': 'fx-rfr-' + s, x: 0, y: 0, width: 0, height: 0, fill: s === 'body' ? I('B') : v('plume'), opacity: s === 'body' ? 0.75 : 0.36 }))),
    h('path', { 'data-ref': 'fx-rfPipe', d: 'M-40 -40Q30 -110 110 -80', fill: 'none', stroke: C.mag, 'stroke-width': 2, opacity: 0.6 }));
  L.shadow += h('g', { 'data-ref': 'fx-refl', style: 'opacity:calc(0.45 + 0.4 * var(--pb-n-neon));' + NH },
    h('g', { 'clip-path': 'url(#fx-rclip)' },
      h('g', { 'data-ref': 'fx-reflP' },
        h('g', { ...DD('fx:O:reflection-wheels') }, wheelRefl(B.rearHub[0], C.mag, C.magC), wheelRefl(B.frontHub[0], C.cy, C.cyC)),
        h('g', { ...DD('fx:O:reflection-bike') },
          h('path', { d: frameD, fill: 'none', stroke: C.void, 'stroke-width': 6, 'stroke-linecap': 'round', opacity: 0.7 }),
          h('path', { d: tube(B.seatTubeTop, B.headTop), fill: 'none', stroke: C.cy, 'stroke-width': 7, opacity: 0.2 }),
          h('path', { d: tube(B.seatTubeTop, B.headTop), fill: 'none', stroke: C.cyC, 'stroke-width': 2, opacity: 0.8 }),
          h('path', { d: tube(B.bb, B.headBottom), fill: 'none', stroke: C.mag, 'stroke-width': 2.4, opacity: 0.75 }),
          h('path', { d: circ(0, -80, 28), fill: 'none', stroke: C.magC, 'stroke-width': 1.4, opacity: 0.6 }),
          h('path', { d: rect(B.basket.x0, B.basket.y0, B.basket.x1 - B.basket.x0, B.basket.y1 - B.basket.y0), fill: v('basket'), stroke: C.mag, 'stroke-width': 1.6, opacity: 0.7 }),
          glow(LP[0], LP[1], 16, 'W'), h('path', { d: circ(LP[0], LP[1], 3), fill: '#FFFFFF', opacity: 0.8 })),
        reflPel)));
  // vertical neon smears (world y, x around the rider) + ripple glints
  const smear = (x, n, w, dash) => h('path', { d: `M${x} ${GROUND_Y + 3}V${GROUND_Y + 96}`, stroke: `url(#fx-gSmear${n})`, 'stroke-width': w, 'stroke-dasharray': dash, fill: 'none' });
  L.shadow += h('g', { 'data-ref': 'fx-smear', transform: `translate(${RIDER_X} 0)`, style: NH },
    smear(24, 'M', 44, '14 3 9 4 6 5 4 7 3 9'), smear(RCON[0], 'M', 14, '10 3 7 3 5 5 3 6'), smear(RCON[0], 'W', 3.4, '10 3 7 3 5 5 3 6'),
    smear(FC[0], 'C', 14, '11 2 6 4 6 5 3 7'), smear(FC[0], 'W', 3.4, '11 2 6 4 6 5 3 7'), smear(LP[0], 'W', 7, '6 4 8 3 4 6 2 8'));
  const Rr = rng('fx-ripple');
  let rip = '';
  for (let i = 0; i < 16; i++) { const x = -260 + Rr() * 560, yy = GROUND_Y + 6 + Math.pow(Rr(), 1.3) * 80, w = 8 + Rr() * 26; rip += `M${f(x)} ${f(yy)}h${f(w)}`; }
  L.shadow += h('g', { transform: `translate(${RIDER_X} 0)`, style: NH }, h('path', { 'data-ref': 'fx-rip', d: rip, stroke: C.cyC, 'stroke-width': 0.9, 'stroke-linecap': 'round', opacity: 0.4, fill: 'none', ...DD('fx:T:reflection-ripples') }));

  // ============================================== laser headlight + moths (L-fx-back, rider-local)
  const beamEnd = [980, -170];
  const moth = i => h('g', { 'data-ref': 'fx-moth' + i },
    h('g', { 'data-ref': 'fx-mothW' + i },
      h('path', { d: 'M1 -0.6L-3.4 -7L-7 -5L-4.8 -0.4Z', fill: I('B'), stroke: C.cy, 'stroke-width': 0.7, 'stroke-linejoin': 'round' }),
      h('path', { d: circ(-4.4, -4.4, 1.2), fill: C.mag })),
    h('path', { d: 'M-4.2 0.4C-3 -1 2 -1.2 3 0C2 1.1 -3 1.3 -4.2 0.4Z', fill: v('steel') }),
    h('path', { d: circ(3.1, -0.3, 0.8), fill: C.acid }));
  let dots = '';
  for (let i = 0; i < 18; i++) dots += circ(i * 14, -2 - 2.2 * Math.sin(i * 0.5), 1.25);
  L.back += h('g', { 'data-ref': 'fx-riderB' },
    h('g', { 'data-ref': 'fx-beam', style: 'opacity:var(--pb-n-lampOn);' + NH },
      h('path', { ...DD('fx:O:laser-cone'), d: poly([[LP[0], LP[1] - 4], [800, -150], [800, -6], [LP[0], LP[1] + 4]]), fill: 'url(#fx-gBeam)' }),
      h('path', { d: poly([[LP[0], LP[1] - 2], [620, -168], [620, -100], [LP[0], LP[1] + 2]]), fill: 'url(#fx-gBeam)', opacity: 0.7 }),
      h('g', { ...DD('fx:O:laser-core') },
        h('path', { d: `M${LP[0]} ${LP[1]}L${beamEnd[0]} ${beamEnd[1]}`, stroke: C.cy, 'stroke-width': 4, opacity: 0.25 }),
        h('path', { d: `M${LP[0]} ${LP[1]}L${beamEnd[0]} ${beamEnd[1]}`, stroke: C.cyC, 'stroke-width': 1, opacity: 0.95 })),
      h('path', { 'data-ref': 'fx-lidar', ...DD('fx:T:lidar-pulses'), d: `M${LP[0]} ${LP[1]}L${beamEnd[0]} ${beamEnd[1]}`, stroke: '#FFFFFF', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-dasharray': '3 52' }),
      h('g', { 'data-ref': 'fx-scan', transform: 'translate(400 0)', ...DD('fx:O:lidar-scan') },
        h('path', { d: 'M0 -2L238 -1', stroke: C.cy, 'stroke-width': 0.6, opacity: 0.5, fill: 'none' }),
        h('path', { d: dots, fill: C.cyC }))));
  L.back += h('g', { 'data-ref': 'fx-escort' }, esc);
  // AR courier waypoint floating ahead of the front wheel: pin, stalk to the road, landing ring, chevrons, live distance
  L.back += h('g', { 'data-ref': 'fx-wpR' }, h('g', { 'data-ref': 'fx-wp', transform: 'translate(470 -120)', ...DD('fx:O:ar-waypoint') },
    h('path', { d: 'M0 16V118', stroke: C.acid, 'stroke-width': 0.8, 'stroke-dasharray': '2 3', opacity: 0.8 }),
    h('ellipse', { cy: 120, rx: 18, ry: 3.4, fill: 'none', stroke: C.acid, 'stroke-width': 3.4, opacity: 0.18 }),
    h('ellipse', { cy: 120, rx: 18, ry: 3.4, fill: 'none', stroke: C.acidC, 'stroke-width': 0.9 }),
    neon('M0 -15L10 0L0 15L-10 0Z', C.acid, C.acidC, 1.1),
    h('path', { d: 'M0 -7L5 0L0 7L-5 0Z', fill: C.acid }),
    h('path', { d: 'M-4 -1H1.6L-0.6 -3.4M1.6 -1L-0.6 1.4', stroke: C.void, 'stroke-width': 1, fill: 'none' }),
    [0, 1, 2].map(i => h('path', { 'data-ref': 'fx-wpC' + i, d: `M${16 + i * 7} -5L${21 + i * 7} 0L${16 + i * 7} 5`, stroke: C.acidC, 'stroke-width': 1.6, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })),
    mono('DROP-OFF', 5, -20, -22, C.acid),
    h('path', { 'data-ref': 'fx-wpT', d: '', fill: C.acidC })));
  // danmaku: the camera drone live-streams the courier, and the viewers' comments scroll across behind the rider
  L.back += h('g', {}, DM.map(([str, font, col], i) => h('path', {
    'data-ref': 'fx-dm' + i, ...DD('fx:O:danmaku'), display: 'none', d: tpath(font === 'Z' ? GZ : GM, str, font === 'Z' ? 16 : 15).d,
    fill: C[col] || col, stroke: C.void, 'stroke-width': 2.8, 'paint-order': 'stroke', 'stroke-linejoin': 'round',
  })));

  // ============================================== light trails (> 86 rpm) + the data-stream (L-fx-back, world)
  L.back += h('g', { 'data-ref': 'fx-slG', display: 'none', ...DD('fx:O:light-trails') }, TRAILS.map(([, , c], i) => h('g', { 'data-ref': 'fx-sl' + i, display: 'none' },
    h('path', { d: 'M0 -6L-100 -1L-100 1L0 6Z', fill: `url(#fx-gTrail${c})`, opacity: 0.35 }),
    h('path', { d: 'M0 -1.8L-100 -0.3L-100 0.3L0 1.8Z', fill: `url(#fx-gTrail${c === 'M' ? 'M' : 'W'})` }))));
  const DSD = 'M0 0C40 -16 80 12 124 0S206 -14 250 -2S330 10 372 -4';
  let bits = '';
  const Rb = rng('fx-bits');
  for (let i = 0; i < 13; i++) { const u = (i + 0.5) / 13, x = u * 372, yy = 12 * Math.sin(u * 7.2 + 0.6) - 10 - Rb() * 8; bits += tpath(GM, Rb() < 0.5 ? '0' : '1', 7 + Rb() * 3, x, yy).d; }
  L.back += h('g', { 'data-ref': 'fx-ds', display: 'none', ...DD('fx:O:data-stream') },
    h('g', { fill: 'none', 'stroke-linecap': 'round' },
      h('path', { 'data-ref': 'fx-dsA', d: DSD, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, stroke: C.cy, 'stroke-width': 5, opacity: 0.16 }),
      h('path', { 'data-ref': 'fx-dsB', d: DSD, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, stroke: C.cyC, 'stroke-width': 1 })),
    h('path', { 'data-ref': 'fx-dsBits', d: bits, fill: C.cy, opacity: 0 }));

  // ============================================== tyre spray, landing splash / shock ring / sparks (L-fx-front, world)
  const NSP = 18, NMIST = 6, NBOW = 8, NBURST = 10, NSPK = 8, NRS = 6;
  const sprayCol = j => [C.cyC, C.magC, '#E9E6F2'][j % 3];
  L.front += h('g', {}, Array.from({ length: NMIST }, (_, j) => h('ellipse', { 'data-ref': 'fx-mist' + j, ...DD('fx:O:spray-mist'), display: 'none', rx: 22, ry: 11, fill: 'url(#fx-gMist)' })));
  L.front += h('g', {}, Array.from({ length: NSP }, (_, j) => h('path', { 'data-ref': 'fx-sp' + j, ...DD('fx:O:spray-droplets'), display: 'none', d: 'M5.5 0C5.5 -1.2 4.4 -1.3 3.6 -1.2L-6 -0.3L-6 0.3L3.6 1.2C4.4 1.3 5.5 1.2 5.5 0Z', fill: sprayCol(j) })));
  L.front += h('g', {}, Array.from({ length: NBOW }, (_, j) => h('path', { 'data-ref': 'fx-bow' + j, ...DD('fx:O:spray-bow'), display: 'none', d: 'M3.8 0C3.8 -1 3 -1.1 2.4 -1L-4 -0.25L-4 0.25L2.4 1C3 1.1 3.8 1 3.8 0Z', fill: j % 2 ? C.cyC : '#E9E6F2' })));
  L.front += h('g', { 'data-ref': 'fx-burstG', display: 'none' }, Array.from({ length: NBURST }, (_, j) => h('path', { 'data-ref': 'fx-bp' + j, ...DD('fx:O:land-splash'), d: 'M-6 0H6', stroke: j % 2 ? C.cyC : C.magC, 'stroke-width': 2, 'stroke-linecap': 'round' })));
  L.front += h('g', { 'data-ref': 'fx-spkG', display: 'none' }, Array.from({ length: NSPK }, (_, j) => h('path', { 'data-ref': 'fx-spk' + j, ...DD('fx:O:sparks'), d: 'M-7 0H7', stroke: j % 2 ? C.ambC : C.magC, 'stroke-width': 1.5, 'stroke-linecap': 'round' })));
  const ticks = [0, 45, 90, 135, 180, 225, 270, 315].map(a => { const c = Math.cos(a * D2R), s = Math.sin(a * D2R); return `M${f(c * 40)} ${f(s * 6)}L${f(c * 48)} ${f(s * 7.4)}`; }).join('');
  const shock = ref => h('g', { 'data-ref': ref },
    h('ellipse', { rx: 40, ry: 6, fill: 'none', stroke: C.cy, 'stroke-width': 5, opacity: 0.2 }),
    h('ellipse', { rx: 40, ry: 6, fill: 'none', stroke: C.cyC, 'stroke-width': 1.1 }),
    h('ellipse', { rx: 26, ry: 3.8, fill: 'none', stroke: C.mag, 'stroke-width': 0.9, 'stroke-dasharray': '4 3' }),
    h('path', { d: ticks, stroke: C.acid, 'stroke-width': 1, fill: 'none' }));
  L.front += h('g', { 'data-ref': 'fx-impG', display: 'none', ...DD('fx:O:land-shock-ring') }, shock('fx-impR'), shock('fx-impF'));
  // rain splashing on the rider
  const crown = h('path', { d: 'M-5 0Q-4.6 -3.4 -3.2 -6M0 0V-7.4M5 0Q4.6 -3.4 3.2 -6M-8 0.5Q-7 -1.5 -6.4 -2.4M8 0.5Q7 -1.5 6.4 -2.4', fill: 'none', stroke: C.cyC, 'stroke-width': 0.9, 'stroke-linecap': 'round' }) +
    h('path', { d: circ(-3.6, -8.2, 0.9) + circ(0, -9.8, 1) + circ(3.6, -8.2, 0.9), fill: '#FFFFFF' });
  L.front += h('g', {}, Array.from({ length: NRS }, (_, j) => h('g', { 'data-ref': 'fx-rs' + j, ...DD('fx:O:rain-splash-rider'), display: 'none' }, crown)));

  // ============================================== feathers, flyer (L-fx-front)
  const contourFeather = h('g', { ...DD('fx:O:feather-contour') },
    h('path', { d: 'M0 0C3 -4 10 -7 18 -6.4C23 -6 26 -3.6 27 -1C24 1.6 19 3.2 12 3.2L10.6 1.2L9 3.2C5 3 2 2 0 0Z', fill: v('plume'), stroke: C.mag, 'stroke-width': 0.9, 'stroke-linejoin': 'round' }),
    h('path', { d: 'M3 1.8C8 3.2 14 3.4 20 2.2', fill: 'none', stroke: C.cy, 'stroke-width': 0.9, 'stroke-linecap': 'round', opacity: 0.8 }),
    h('path', { d: 'M-4 1.2C4 0 14 -0.8 26.4 -1.2', fill: 'none', stroke: C.cy, 'stroke-width': 0.9, 'stroke-linecap': 'round' }),
    h('path', { d: 'M8 -0.4L12 -5M13 -0.7L17 -5.6M18 -0.9L21.4 -5M14 -0.6L17 2.8M20 -1L22.6 1.8', fill: 'none', stroke: v('plumeShade'), 'stroke-width': 0.55, 'stroke-linecap': 'round' }));
  const downD = [[-8, -9], [0, -12], [8, -9], [11, -2], [-11, -2], [-5, -11], [5, -11]]
    .map(([x1, y1]) => `M0 0Q${f(x1 * 0.3 + y1 * 0.25)} ${f(y1 * 0.55 - x1 * 0.2)} ${x1} ${y1}`).join('');
  const downFeather = h('g', { ...DD('fx:O:feather-down') },
    h('path', { d: downD + 'M0 0L0.6 5', fill: 'none', stroke: C.cy, 'stroke-width': 3.2, 'stroke-linecap': 'round', opacity: 0.45 }),
    h('path', { d: downD + 'M0 0L0.6 5', fill: 'none', stroke: v('plume'), 'stroke-width': 1.6, 'stroke-linecap': 'round' }));
  L.front += h('g', {}, [contourFeather, downFeather, contourFeather].map((fe, i) => h('g', { 'data-ref': 'fx-fea' + i, display: 'none' }, i === 2 ? fe.replace(/ data-detail="[^"]*"/, '') : fe)));
  L.front += h('g', { 'data-ref': 'fx-leaf', display: 'none', ...DD('fx:O:flyer-tumble') }, h('g', { 'data-ref': 'fx-leafS' },
    h('path', { d: 'M-13 -17L13 -16L12.4 17L-12.6 16.4Z', fill: '#E9E6F2', stroke: v('plumeShade'), 'stroke-width': 0.6 }),
    h('path', { d: 'M-12.9 -16.6L12.9 -15.8L12.8 -7L-12.8 -7.6Z', fill: C.mag }),
    h('path', { d: tpath(GZ, '外卖', 9, -9, -8.6).d, fill: '#FFFFFF' }),
    h('path', { d: 'M-10 -3.4H6M-10 -0.4H9M-10 2.6H3M-10 5.6H7', stroke: v('ink'), 'stroke-width': 1, opacity: 0.7 }),
    h('path', { d: rect(3.4, 8, 7, 7), fill: v('ink') }), h('path', { d: rect(4.6, 9.2, 2, 2) + rect(7.6, 12, 1.6, 1.6) + rect(4.6, 12.4, 1.4, 1.4), fill: '#E9E6F2' }),
    mono('0719', 4.6, -10.6, 14.6, C.mag)));

  // ============================================== holo butterfly, bug-bot fly, glint, flare, wave arcs (L-fx-front)
  const FW = 'M0.5 -1C2 -6 5 -13 7.5 -17C4 -18.8 -2 -17.8 -5 -14C-4.5 -9 -2.5 -4 0.5 -1Z';
  const HW = 'M-0.5 -0.8C-3 -3 -6 -6 -8.5 -10.4C-10.4 -7 -10.2 -3.4 -7.5 -1.4C-5 -0.4 -2.5 -0.4 -0.5 -0.8Z';
  defs += h('pattern', { id: 'fx-pScan', width: 4, height: 1.6, patternUnits: 'userSpaceOnUse' }, h('rect', { width: 4, height: 0.55, fill: C.cy, opacity: 0.75 }));
  L.front += h('g', { 'data-ref': 'fx-bf0', ...DD('fx:O:holo-butterfly') },
    h('g', { 'data-ref': 'fx-bfw0' },
      h('path', { d: FW + HW, fill: C.cy, opacity: 0.16 }),
      neon(FW + HW, C.cy, C.cyC, 0.6),
      h('path', { d: FW + HW, fill: 'url(#fx-pScan)', ...DD('fx:T:holo-butterfly-scan') }),
      h('path', { d: 'M0.5 -1.4L6 -15.4M0 -1.6L1.6 -16.8M-0.6 -1.6L-3.6 -14M-0.5 -1L-7.6 -9.2M-0.8 -0.9L-9 -4.6', fill: 'none', stroke: C.mag, 'stroke-width': 0.5, opacity: 0.85 }),
      h('path', { d: circ(4.4, -14.6, 0.9) + circ(-7.6, -6, 0.8), fill: C.magC })),
    h('path', { d: 'M-5 0.4C-3 -0.9 3 -1.1 5 -0.2C3 1.1 -3 1.4 -5 0.4Z' + circ(5.9, -0.4, 1.35), fill: C.cyC }),
    h('path', { d: 'M6 -1.2Q8.4 -5.4 10.6 -7.2M6.3 -0.8Q9.6 -4.4 12.2 -5.2', fill: 'none', stroke: C.cy, 'stroke-width': 0.5, 'stroke-linecap': 'round' }));
  const flyPt = u => [FLY_C[0] + FLY_A[0] * Math.sin(TAU * u), FLY_C[1] + FLY_A[1] * Math.sin(2 * TAU * u) - 10 * Math.cos(TAU * u)];
  const FLYN = 120, flyPts = Array.from({ length: FLYN }, (_, i) => flyPt(i / FLYN));
  const flyLen = [0]; for (let i = 1; i <= FLYN; i++) { const a = flyPts[i - 1], b = flyPts[i % FLYN]; flyLen.push(flyLen[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const flyG = h('g', { 'data-ref': 'fx-flyG' },
    h('g', {}, Array.from({ length: 7 }, (_, i) => h('path', { 'data-ref': 'fx-ftd' + i, ...DD('fx:T:fly-dotted-trail'), d: circ(0, 0, 1.05 - 0.07 * i), fill: C.acid, opacity: f(1 - 0.1 * i) }))),
    h('g', { 'data-ref': 'fx-fly', ...DD('fx:O:bot-fly') },
      h('g', { 'data-ref': 'fx-flyW' }, h('path', { d: 'M-0.5 -1.2C-3 -6 -7 -6.4 -6.4 -3.6C-6 -2 -3 -1.2 -0.5 -1.2ZM0.4 -1.2C0 -6.4 3.2 -7.6 3.6 -4.8C3.8 -3 2 -1.6 0.4 -1.2Z', fill: C.cy, 'fill-opacity': 0.35, stroke: C.cyC, 'stroke-width': 0.5 })),
      h('path', { d: 'M-3.4 0C-3.4 -1.6 1.6 -2 2.6 -0.4C2 1.6 -3 1.6 -3.4 0Z' + circ(3.6, -0.6, 1.5), fill: v('steel'), stroke: v('chain'), 'stroke-width': 0.3 }),
      h('path', { d: 'M-3 -0.2H1.6M4 -1.8L5.6 -4.4', stroke: C.mag, 'stroke-width': 0.4, fill: 'none' }),
      glow(4.3, -1, 3, 'R'), h('path', { d: circ(4.3, -1.1, 0.7), fill: C.red })));
  const flare = h('g', { 'data-ref': 'fx-flare', transform: `translate(${LP[0]} ${LP[1]})`, style: 'opacity:var(--pb-n-lampOn);' + NH },
    h('path', { d: circ(0, 0, 30), fill: 'url(#fx-gFlare)' }),
    h('path', { d: 'M-22 0H22M0 -9V9', stroke: '#FFFFFF', 'stroke-width': 0.7, opacity: 0.85 }),
    h('path', { 'data-ref': 'fx-flareStar', d: star4(18, 1), fill: C.cyC, opacity: 0.9 }));
  const glintBell = h('g', { 'data-ref': 'fx-glB', ...DD('fx:O:glint-bell') }, glow(0, 0, 9, 'C', 0.8), h('path', { d: star4(11, 1.2) + circ(0, 0, 1.6), fill: C.cyC }));
  const waveArcs = h('g', { 'data-ref': 'fx-waveArcs', display: 'none', ...DD('fx:O:wave-arcs') },
    neon('M-8 -40A42 42 0 0 1 30 -44M-2 -52A54 54 0 0 1 36 -58M14 -30A30 30 0 0 1 34 -32', C.cy, C.cyC, 1.1, { 'stroke-dasharray': '14 5 40' }),
    h('g', { transform: 'translate(42 -70)' },
      h('path', { d: 'M0 0H26V12H8L3 16V12H0Z', fill: C.void, 'fill-opacity': 0.7, stroke: C.mag, 'stroke-width': 0.9 }),
      mono('HI!', 9, 13, 9.6, C.magC, 'middle')));
  const cryo = h('g', {}, [0, 1, 2, 3].map(i => h('g', { 'data-ref': 'fx-cry' + i, ...DD('fx:O:cryo-mist'), display: 'none' },
    h('ellipse', { rx: 9, ry: 5, fill: 'url(#fx-gMist)' }), h('path', { d: circ(-2, -1, 0.7) + circ(3, 1.4, 0.55), fill: '#FFFFFF', opacity: 0.8 }))));
  L.front += h('g', { 'data-ref': 'fx-riderF' }, cryo, flyG, glintBell, waveArcs, h('g', { 'data-ref': 'fx-mothG', ...DD('fx:O:cyber-moths') }, [0, 1, 2].map(moth)));
  L.back += h('g', { 'data-ref': 'fx-riderB2' }, flare);

  // ============================================== glitch HUD pops (L-fx-front, world)
  const pop = (word, zh, sys, tag, ref, key) => {
    const size = 50, t0 = tpath(GB, word, size), ww = t0.w, cap = 0.73 * size;
    const x0 = -ww / 2, yb = cap / 2;
    const wd = tpath(GB, word, size, x0, yb, 0).d;
    const W2 = ww / 2 + 24, H2 = cap / 2 + 16;
    const panel = poly([[-W2 + 8, -H2], [W2, -H2], [W2, H2 - 8], [W2 - 8, H2], [-W2, H2], [-W2, -H2 + 8]]);
    let sl = ''; for (let yy = -H2 + 2; yy < H2; yy += 3) sl += `M${f(-W2)} ${f(yy)}H${f(W2)}`;
    const br = (sx, sy) => `M${f(sx * (W2 + 6))} ${f(sy * (H2 - 6))}V${f(sy * (H2 + 6))}H${f(sx * (W2 - 6))}`;
    const cuts = [[-H2 - 10, -cap * 0.18], [-cap * 0.18, cap * 0.16], [cap * 0.16, H2 + 10]];
    cuts.forEach(([a, b], i) => { defs += h('clipPath', { id: `fx-pc-${ref}${i}` }, h('path', { d: rect(-W2 - 20, a, 2 * W2 + 40, b - a) })); });
    const letters = h('path', { d: wd, fill: 'none', stroke: C.mag, 'stroke-width': 7, opacity: 0.22, 'stroke-linejoin': 'round' }) +
      h('path', { d: wd, fill: C.cy, transform: 'translate(-3.2 0)', opacity: 0.85 }) +
      h('path', { d: wd, fill: C.mag, transform: 'translate(3.2 0)', opacity: 0.85 }) +
      h('path', { d: wd, fill: '#FFFFFF' });
    const zw = tpath(GZ, zh, 22).w;
    return h('g', { 'data-ref': 'fx-' + ref, display: 'none', ...DD(key) },
      h('path', { d: panel, fill: C.void, 'fill-opacity': 0.72 }),
      h('path', { d: panel, fill: 'none', stroke: C.cy, 'stroke-width': 4, opacity: 0.2 }),
      h('path', { d: panel, fill: 'none', stroke: C.cy, 'stroke-width': 1.1 }),
      h('path', { d: br(-1, -1) + br(1, -1) + br(-1, 1) + br(1, 1), fill: 'none', stroke: C.acid, 'stroke-width': 1.6, ...(ref === 'popDing' ? DD('fx:T:pop-scanlines') : {}) }),
      cuts.map((_, i) => h('g', { 'clip-path': `url(#fx-pc-${ref}${i})` }, h('g', { 'data-ref': `fx-${ref}S${i}` }, letters))),
      h('path', { d: sl, stroke: C.void, 'stroke-width': 1, opacity: 0.45 }),
      h('g', { transform: `translate(${f(W2 + 10)} ${f(-H2)})` },
        h('path', { d: rect(0, 0, zw + 10, 30), fill: C.mag }), h('path', { d: rect(0, 0, zw + 10, 30), fill: 'none', stroke: C.mag, 'stroke-width': 5, opacity: 0.25 }),
        h('path', { d: tpath(GZ, zh, 22, 5, 23).d, fill: '#FFFFFF' })),
      mono(sys, 7.5, -W2 + 10, -H2 - 4, C.cy),
      h('path', { d: rect(W2 - 34, -H2 - 9.5, 5, 5) + rect(W2 - 27, -H2 - 9.5, 5, 5) + rect(W2 - 20, -H2 - 9.5, 5, 5), fill: C.acid }),
      h('path', { d: rect(W2 - 13, -H2 - 9.5, 5, 5), fill: 'none', stroke: C.acid, 'stroke-width': 0.8 }),
      mono(tag, 7.5, W2 - 8, H2 + 11, C.acid, 'end'),
      h('path', { d: `M${f(-W2 + 8)} ${f(H2 + 7)}H${f(-W2 + 44)}`, stroke: C.mag, 'stroke-width': 2 }),
      h('g', { 'data-ref': `fx-${ref}G`, display: 'none', ...(ref === 'popDing' ? DD('fx:T:pop-glitch') : {}) },
        h('path', { 'data-ref': `fx-${ref}B0`, d: rect(-W2, -2, 2 * W2, 3.4), fill: C.mag, opacity: 0.8 }),
        h('path', { 'data-ref': `fx-${ref}B1`, d: rect(-W2 * 0.6, -1, W2 * 1.1, 2), fill: C.cy, opacity: 0.8 })));
  };
  L.front += pop('DING!', '叮', 'SYS//BELL.EXE', 'ACK 200', 'popDing', 'fx:O:pop-ding') +
    pop('HOP!', '跳', 'SYS//JUMP.EXE', 'AIR OK', 'popHop', 'fx:O:pop-hop') +
    pop('GULP!', '咕嘟', 'SYS//FEED.EXE', '+1 FISH', 'popGulp', 'fx:O:pop-gulp');
  // bell sound rings + neon notes
  L.front += h('g', {}, [0, 1, 2].map(i => h('g', { 'data-ref': 'fx-bw' + i, display: 'none', ...DD('fx:O:bell-rings') }, neon('M0 -10A14 14 0 0 1 0 10', C.cy, C.cyC, 1))));
  const note1 = 'M0 0A5.6 4 -20 1 1 -0.1 0.1ZM4.6 -2.4V-24C8 -21 12 -19 12.4 -13C11 -16 8.4 -17.4 6.8 -17.6V-2.4Z';
  const note2 = 'M0 0A5.4 3.9 -20 1 1 -0.1 0.1ZM16 -4A5.4 3.9 -20 1 1 15.9 -3.9ZM4.4 -2.2V-24L20.4 -28V-6.2H18.2V-22.4L6.6 -19.4V-2.2Z';
  const noteArt = d => h('path', { d, fill: 'none', stroke: C.mag, 'stroke-width': 5, opacity: 0.25, 'stroke-linejoin': 'round' }) + h('path', { d, fill: C.magC, stroke: C.mag, 'stroke-width': 1.2, 'stroke-linejoin': 'round' });
  L.front += h('g', {}, h('g', { 'data-ref': 'fx-note0', display: 'none', ...DD('fx:O:bell-notes') }, noteArt(note1)), h('g', { 'data-ref': 'fx-note1', display: 'none', ...DD('fx:O:bell-notes') }, noteArt(note2)));
  // glowing drips, pixel hearts, holo fish bone + derez pixels
  L.front += h('g', {}, [0, 1, 2, 3].map(i => h('g', { 'data-ref': 'fx-drip' + i, ...DD('fx:O:gulp-drips'), display: 'none' },
    glow(0, 0, 6, 'C', 0.8), h('path', { d: 'M0 -4.6C1.6 -1.8 2.8 -0.2 2.8 1.4A2.8 2.8 0 0 1 -2.8 1.4C-2.8 -0.2 -1.6 -1.8 0 -4.6Z', fill: C.cyC }))));
  const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
  let hd = ''; HEART.forEach((row, yy) => [...row].forEach((c, xx) => { if (c === 'X') hd += rect((xx - 3.5) * 2.6, (yy - 3) * 2.6, 2.7, 2.7); }));
  const heart = h('path', { d: hd, fill: C.mag, stroke: C.mag, 'stroke-width': 4, 'stroke-opacity': 0.25, 'stroke-linejoin': 'round' }) + h('path', { d: rect(-6.5, -5.2, 2.6, 2.6), fill: '#FFFFFF' }) + h('path', { d: rect(3.9, -2.6, 2.6, 2.6), fill: C.magC, opacity: 0.8 });
  L.front += h('g', {}, [0, 1, 2].map(i => h('g', { 'data-ref': 'fx-heart' + i, display: 'none', ...DD('fx:O:pixel-hearts') }, heart)));
  const boneD = 'M-16 0H13M-10 0L-13 -5M-10 0L-13 5M-4 0L-7 -6M-4 0L-7 6M2 0L-1 -6.4M2 0L-1 6.4M8 0L5 -5.6M8 0L5 5.6M-16 0L-22 -5M-16 0L-22 5';
  const skull = 'M12 -5.6C17 -6 21 -3 21.6 0C21 3 17 6 12 5.6Z';
  L.front += h('g', { 'data-ref': 'fx-bone', display: 'none', ...DD('fx:O:holo-fish-bone') },
    h('g', { 'data-ref': 'fx-boneG' },
      h('path', { d: boneD + skull, fill: 'none', stroke: C.mag, 'stroke-width': 1.2, transform: 'translate(1.6 0.8)', opacity: 0.6 }),
      neon(boneD + skull, C.cy, C.cyC, 1.1),
      h('path', { d: 'M15 -2.4L17.4 0M17.4 -2.4L15 0', stroke: C.magC, 'stroke-width': 0.8, fill: 'none' })));
  L.front += h('g', { 'data-ref': 'fx-pxG', display: 'none', ...DD('fx:T:derez-pixels') }, Array.from({ length: 12 }, (_, j) => h('path', { 'data-ref': 'fx-px' + j, d: rect(-1.6, -1.6, 3.2, 3.2), fill: j % 3 ? C.cyC : C.magC })));
  // holographic butterfly is drawn above; escort drones live in L-fx-back
  const LB = light.build(ctx);   // lighting pass: haze bands, street glow, grade
  return { defs: defs + LB.defs, layers: { 'L-gulls-far': L.far, 'L-atmo': LB.layers['L-atmo'], 'L-shore': LB.layers['L-shore'], 'L-shadow': propagateNH(L.shadow), 'L-fx-back': propagateNH(L.back), 'L-fx-front': L.front, 'L-letterbox': LB.layers['L-letterbox'] } };
}

// ------------------------------------------------------------------------------------------------ attach
export function attach(svg, ctx) {
  if (typeof location !== 'undefined' && /[?&]fxoff\b/.test(location.search)) { for (const idn of ['L-gulls-far--fx', 'L-shadow--fx', 'L-fx-back--fx', 'L-fx-front--fx']) { const g = svg.querySelector('#' + idn); if (g) g.setAttribute('display', 'none'); } return {}; }
  const r = refs(svg, 'fx-');
  const cache = new Map();
  const set = (el, k, val) => { if (!el) return; let c = cache.get(el); if (!c) cache.set(el, c = {}); if (c[k] !== val) { c[k] = val; el.setAttribute(k, val); } };
  const vis = (el, on) => set(el, 'display', on ? 'inline' : 'none');
  const nofx = typeof location !== 'undefined' && /[?&]nofx\b/.test(location.search);

  const Rd = ctx.rng('fx-drones');
  const FAR = [];
  for (let i = 0; i < 7; i++) FAR.push({ x0: Rd() * 2800, y: 110 + i * 34 + Rd() * 20, s: 0.36 + Rd() * 0.16, vx: [210, -60, 320, 150, -120, 260, 90][i], ph: Rd() * 10, box: i % 3 === 1 });
  const flyPt = u => [FLY_C[0] + FLY_A[0] * Math.sin(TAU * u), FLY_C[1] + FLY_A[1] * Math.sin(2 * TAU * u) - 10 * Math.cos(TAU * u)];
  const FLYN = 120, flyPts = Array.from({ length: FLYN }, (_, i) => flyPt(i / FLYN));
  const flyLen = [0]; for (let i = 1; i <= FLYN; i++) { const a = flyPts[i - 1], b = flyPts[i % FLYN]; flyLen.push(flyLen[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const flyTotal = flyLen[FLYN];

  // reflection capsules sized from each pelican slot's own art (bbox in joint-local space)
  const shOK = {};
  for (const s of PSLOTS) {
    const el = svg.querySelector('#j-' + s), rc = r['rfr-' + s];
    let bb = null;
    try { bb = el && el.getBBox(); } catch (e) { bb = null; }
    if (!bb || !(bb.width > 1 && bb.height > 1) || !rc) { shOK[s] = false; if (r['rf-' + s]) r['rf-' + s].setAttribute('display', 'none'); continue; }
    const k = s === 'body' ? 0.9 : 0.92, w = bb.width * k, hh = bb.height * k;
    rc.setAttribute('x', f1(bb.x + (bb.width - w) / 2)); rc.setAttribute('y', f1(bb.y + (bb.height - hh) / 2));
    rc.setAttribute('width', f1(w)); rc.setAttribute('height', f1(hh)); rc.setAttribute('rx', f1(Math.min(w, hh) / 2));
    shOK[s] = true;
  }
  const NSP = 18, NMIST = 6, NBOW = 8, NBURST = 10, NSPK = 8, NRS = 6;
  const pool = (p, n) => Array.from({ length: n }, (_, i) => r[p + i]);
  const sp_ = pool('sp', NSP), mist = pool('mist', NMIST), bow = pool('bow', NBOW), bps = pool('bp', NBURST), spk = pool('spk', NSPK), rs = pool('rs', NRS), px = pool('px', 12);
  const DMW = DM.map(([str, font]) => tpath(font === 'Z' ? GZ : GM, str, font === 'Z' ? 16 : 15).w);
  let wpTxt = '';
  const latest = (evs, type, t, win) => { let best = null; for (const e of evs || []) if (e.type === type) { const tau = t - e.t0; if (tau >= 0 && tau < win && (!best || e.t0 > best.t0)) best = e; } return best ? t - best.t0 : -1; };
  const ballistic = (el, x, y, vx, vy, lenK) => {
    const a = Math.atan2(vy, vx) * R2D, sp = Math.hypot(vx, vy);
    set(el, 'transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1(a)}) scale(${f(clamp(0.5 + sp / lenK, 0.5, 2.6))} 1)`);
  };

  const LA = light.attach(svg, ctx);
  let lastQ30 = -1;
  return {
    update(fr) {
      LA.update(fr);
      const t = fr.t, pose = fr.pose || {}, J = pose.joints || {};
      const reduced = !!(fr.reduced || ctx.reduced);
      const sp = fr.speed || 0, cad = fr.cadence || 0, D = fr.distance || 0;
      const night = fr.night || 0;
      const tg = fr.toggles || {};
      const wx = fr.weather || {};
      const wet = clamp(0.45 + 0.55 * Math.max(wx.wet || 0, wx.rain || 0), 0, 1);   // the neon city is always damp
      const ry = pose.riderY || 0, pitch = pose.bikePitch || 0, pr = pitch * D2R, pc = Math.cos(pr), ps = Math.sin(pr);
      const RC = RCON;
      const W = (x, y) => { const dx = x - RC[0], dy = y - RC[1]; return [RIDER_X + RC[0] + dx * pc - dy * ps, GROUND_Y + ry + RC[1] + dx * ps + dy * pc]; };
      const riderXf = `translate(${RIDER_X} ${f(GROUND_Y + ry)}) rotate(${f(pitch)} ${RC[0]} ${RC[1]})`;
      set(r.riderB, 'transform', riderXf); set(r.riderB2, 'transform', riderXf); set(r.riderF, 'transform', riderXf);
      const lift = clamp(-ry / 48, 0, 1.2);
      const hF = clamp(-(ry + 298 * ps) / 48, 0, 1.4);
      const lampOn = sstep(0.1, 0.4, night + 0.25);

      // ================= wet road: pools, contacts, wakes, reflection, smears, ripple glints
      set(r.under, 'opacity', f(1 - 0.55 * Math.min(1, lift)));
      set(r.pool, 'transform', `translate(${f1(-60 * lift)} 0)`);
      const cShadow = (el, x, hh) => {
        const s = 1 - 0.55 * Math.min(1, hh);
        set(el, 'transform', `translate(${f(RIDER_X + x)} ${GROUND_Y + 1}) scale(${f(s)} ${f(s)})`);
        set(el, 'opacity', f(1 - 0.7 * Math.min(1, hh)));
      };
      cShadow(r.cR, RC[0], lift); cShadow(r.cF, FC[0], hF);
      // perf: in live play the wet-road reflection, its smears / wakes and the LiDAR advance at 30 Hz (every other
      // frame): they are translucent, ripple-broken light, and each update repaints the big shadow / back sheets
      const q30 = Math.floor(t * 30), half = !(fr.dt > 0) || q30 !== lastQ30; lastQ30 = q30;
      if (half) {
      set(r.wake, 'opacity', f(wet * (1 - Math.min(1, Math.max(lift, hF)))));
      if (r.wake) for (const p of r.wake.children) set(p, 'stroke-dashoffset', f1(wrap(D * 0.35, 32)));
      set(r.refl, 'transform', `translate(0 ${GROUND_Y}) scale(1 ${-REFL_K}) translate(0 ${-GROUND_Y}) ${riderXf}`);
      set(r.reflP, 'opacity', f(0.55 + 0.45 * wet));
      for (const s of PSLOTS) if (shOK[s] && J[s]) set(r['rf-' + s], 'transform', xf(J[s]));
      if (J.body && J.head) {
        const b = J.body, br = (b.rot || 0) * D2R, nb = [b.x + 112 * Math.cos(br) + 92 * Math.sin(br), b.y + 112 * Math.sin(br) - 92 * Math.cos(br)];
        const hd = J.head, mid = [(nb[0] + hd.x) / 2 + 22, (nb[1] + hd.y) / 2];
        set(r.rfNeck, 'd', `M${f1(nb[0])} ${f1(nb[1])}Q${f1(mid[0])} ${f1(mid[1])} ${f1(hd.x)} ${f1(hd.y + 10)}`);
        set(r.rfPipe, 'transform', `translate(${f1(b.x)} ${f1(b.y)}) rotate(${f1(b.rot || 0)})`);
      }
      set(r.smear, 'opacity', f((0.45 + 0.55 * wet) * (1 - 0.6 * Math.min(1, lift))));
      if (!reduced && r.smear) { const o = f1(wrap(Math.floor(t * 12) / 12 * 9, 40)); for (const p of r.smear.children) set(p, 'stroke-dashoffset', o); }
      }
      set(r.rip, 'transform', `translate(${f1(reduced ? 0 : 6 * Math.sin(t * 0.9))} 0)`);
      set(r.rip, 'opacity', f(0.2 + 0.25 * wet + (reduced ? 0 : 0.12 * Math.sin(t * 2.3))));

      // ================= laser headlight, LiDAR, moths
      vis(r.beam, lampOn > 0.01); vis(r.flare, lampOn > 0.01);
      if (lampOn > 0.01 && half) {
        set(r.flareStar, 'transform', `rotate(${reduced ? 0 : f1(t * 12 % 90)}) scale(${f(0.85 + 0.15 * Math.sin(t * 3.1))})`);
        set(r.lidar, 'stroke-dashoffset', f1(reduced ? 0 : wrap(-t * 420, 55)));
        const u = wrap(t / 1.7, 1);
        set(r.scan, 'transform', `translate(${f1(390 + 90 * u)} ${f1(-1 - 2 * u)}) scale(${f(0.7 + 0.5 * u)} 1)`);
        set(r.scan, 'opacity', f(sstep(0, 0.15, u) * (1 - sstep(0.7, 1, u))));
      }
      vis(r.mothG, lampOn > 0.05);
      if (lampOn > 0.05) for (let i = 0; i < 3; i++) {
        const a = t * (2.2 + i * 0.7) + i * 2.1, rr = 22 + 12 * Math.sin(t * 1.3 + i * 4);
        const x = LP[0] + 4 + rr * Math.cos(a) + 6 * Math.sin(t * 7.1 + i), y = LP[1] - 6 + rr * 0.7 * Math.sin(a * 1.3);
        set(r['moth' + i], 'transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1(Math.cos(a) * 25)}) scale(1.25)`);
        set(r['mothW' + i], 'transform', `scale(1 ${f(0.25 + 0.75 * Math.abs(Math.cos(t * 26 + i * 2)))})`);
      }

      // ================= drones: far traffic + escorts
      const dronesOn = tg.gulls !== false;
      for (let i = 0; i < FAR.length; i++) {
        const g = FAR[i], el = r['gfar' + i];
        if (!dronesOn) { vis(el, false); continue; }
        vis(el, true);
        const x = wrap(g.x0 + g.vx * t - 0.15 * D, 2800) - 600, y = g.y + 5 * Math.sin(0.7 * t + g.ph);
        set(el, 'transform', `translate(${f1(x)} ${f1(y)})`);
        const ph = wrap(t * 0.8 + g.ph, 1);
        set(r['gfs' + i], 'opacity', ph < 0.08 || (ph > 0.16 && ph < 0.22) ? 1 : 0);
      }
      const escW = dronesOn ? sstep(84, 92, cad) : 0;
      let head = J.head ? W(J.head.x, J.head.y) : [RIDER_X + 125, GROUND_Y - 520];
      // (perf) the slow world-space movers (escort drones, danmaku, feathers, flyer, butterfly) advance at 30 Hz in
      // live play: each step repaints a patch of the big fx sheets
      if (half) for (let i = 0; i < ESC.length; i++) {
        const g = ESC[i], el = r['esc' + i];
        if (!dronesOn) { vis(el, false); continue; }
        const w = i === 0 ? escW : sstep(0, 1, (escW - (i - 1) * 0.12) / 0.64);
        if (i > 0 && w <= 0.001) { vis(el, false); continue; }
        vis(el, true);
        const ew = w * w * (3 - 2 * w);
        let x = lerp(g.idle[0], g.st[0], ew) + (reduced ? 0 : 18 * Math.sin(0.5 * t + i * 1.7));
        const y = lerp(g.idle[1], g.st[1], ew) + (reduced ? 0 : 7 * Math.sin(1.1 * t + i * 2.3)) - 50 * Math.sin(Math.PI * ew) * (i ? 1 : 0.3);
        if (i === 0) x += 24 * Math.sin(0.21 * t);
        const vx = 18 * 0.5 * Math.cos(0.5 * t + i * 1.7) + (i ? 0 : 5 * Math.cos(0.21 * t)) + 400 * (i ? Math.max(0, 1 - ew) * Math.sin(Math.PI * ew) : 0);
        const tilt = clamp(vx * 0.4, -12, 12);
        set(el, 'transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1(tilt)}) scale(${f(g.s)})`);
        // rotors: side-view blade flicker (scaleX = |cos| of the blade angle), per-drone rate
        const ra = t * (54 + 7 * i);
        set(r['escRa' + i], 'transform', `scale(${f(reduced ? 1 : Math.cos(ra))} 1)`);
        set(r['escRb' + i], 'transform', `scale(${f(reduced ? 1 : Math.cos(ra + 1.1))} 1)`);
        const st = wrap(t * 1.1 + i * 0.37, 1);
        set(r['escS' + i], 'opacity', st < 0.07 ? 1 : 0.12);
        if (g.kind === 'cam') {
          set(r.escRec0, 'opacity', wrap(t, 1) < 0.6 ? 1 : 0.15);
          const lx = x + 6.4 * g.s, ly = y + 11.8 * g.s;
          const a = Math.atan2(head[1] - ly, head[0] - lx) * R2D - tilt;
          const d = Math.hypot(head[0] - lx, head[1] - ly) / g.s / 190;
          set(r.escCone, 'transform', `translate(6.4 11.8) rotate(${f1(a)}) scale(${f(clamp(d, 0.6, 1.6))} ${f(0.8 + 0.2 * Math.sin(t * 1.7))})`);
        }
        if (g.kind === 'cargo') set(r.escBox1, 'transform', `translate(0 19) rotate(${f1(reduced ? 0 : -tilt * 0.8 + 5 * Math.sin(t * 1.9))} 0 -13)`);
        if (g.kind === 'racer') set(r.escTrail, 'opacity', f(0.3 + 0.6 * ew));
        if (g.kind === 'patrol') { const on = wrap(t * 2.2, 1) < 0.5; set(r.escLa3, 'opacity', on ? 1 : 0.2); set(r.escLb3, 'opacity', on ? 0.2 : 1); }
      }

      // ================= AR waypoint (bobs, chevrons chase, distance counts down to the next km holo-marker)
      set(r.wpR, 'transform', riderXf);
      if (r.wp) {
        set(r.wp, 'transform', `translate(470 ${f1(-120 + (reduced ? 0 : 4 * Math.sin(t * 1.6)))})`);
        for (let i = 0; i < 3; i++) set(r['wpC' + i], 'opacity', f(reduced ? 0.8 : 0.25 + 0.75 * sstep(0, 0.3, wrap(t * 1.4 - i * 0.22, 1)) * (1 - sstep(0.5, 0.9, wrap(t * 1.4 - i * 0.22, 1)))));
        const txt = (Math.max(0.05, 1 - wrap((D + 0.5 * KM) / KM, 1))).toFixed(2) + ' KM';
        if (txt !== wpTxt) { wpTxt = txt; r.wpT.setAttribute('d', tpath(GM, txt, 6.4, -20, 28).d); }
      }
      // ================= danmaku (one comment every 3.2 s, 300 u/s, two lanes)
      if (half) {
        const P = 3.2, SPD = 300, LIFE = 2100 / SPD, act = new Array(DM.length).fill(null);
        if (dronesOn) for (let k = Math.floor((t - LIFE) / P) + 1; k <= Math.floor(t / P); k++) { const age = t - k * P; if (age >= 0 && age < LIFE) act[wrap(k, DM.length)] = [k, age]; }
        for (let i = 0; i < DM.length; i++) {
          const el = r['dm' + i], a = act[i];
          vis(el, !!a);
          if (a) {
            // anti-occlusion danmaku (弹幕防挡): comments fade where they pass behind the pelican's head
            const x = 1660 - SPD * a[1], mid = x + DMW[i] / 2;
            set(el, 'transform', `translate(${f1(x)} ${a[0] % 2 ? 318 : 346})`);
            set(el, 'opacity', f(0.12 + 0.88 * sstep(120, 300, Math.abs(mid - head[0] - 40))));
          }
        }
      }
      // ================= tyre spray (rear rooster tail, mist, front bow wave)
      const sN = clamp(sp / 1885, 0, 1.8);     // 1 at 60 rpm
      const airborne = lift > 0.05;
      const dens = clamp((0.2 + 0.55 * sN) * wet, 0, 1) * (reduced ? 0.4 : 1) * (airborne ? 0 : 1);
      const SDT = 0.035;
      for (let j = 0; j < NSP; j++) {
        const k = Math.floor((t - j * SDT) / (NSP * SDT)) * NSP + j, age = t - k * SDT, el = sp_[j];
        const hk = hash(k, 3), vy0 = (190 + 250 * hash(k, 4)) * (0.6 + 0.4 * Math.min(1.5, sN)), g = 2300, tl = (2 * vy0) / g;
        const on = age >= 0 && age < tl && hash(k, 7) < dens;
        if (!on) { vis(el, false); continue; }
        vis(el, true);
        const vx = -(0.16 + 0.22 * hk) * sp - 70;
        const x = RIDER_X + RC[0] - 22 - 10 * hash(k, 8) + vx * age, y = GROUND_Y - 5 - (vy0 * age - 0.5 * g * age * age);
        ballistic(el, x, y, vx, -(vy0 - g * age), 420);
        set(el, 'opacity', f(1 - sstep(0.7, 1, age / tl)));
      }
      const MDT = 0.11, MLIFE = 0.66;
      for (let j = 0; j < NMIST; j++) {
        const k = Math.floor((t - j * MDT) / (NMIST * MDT)) * NMIST + j, age = t - k * MDT, el = mist[j];
        const on = age >= 0 && age < MLIFE && hash(k, 17) < dens * 1.2;
        if (!on) { vis(el, false); continue; }
        vis(el, true);
        const u = age / MLIFE, hk = hash(k, 18);
        const x = RIDER_X + RC[0] - 40 - (0.1 + 0.06 * hk) * sp * age - 40 * age, y = GROUND_Y - 10 - 26 * u - 8 * hk;
        set(el, 'transform', `translate(${f1(x)} ${f1(y)}) scale(${f((0.6 + 1.5 * u) * (0.7 + 0.5 * Math.min(1.4, sN)))})`);
        set(el, 'opacity', f((1 - u) * (0.6 + 0.4 * wet)));
      }
      const BDT = 0.05;
      const bdens = clamp((0.1 + 0.5 * sN) * wet, 0, 1) * (reduced ? 0.4 : 1) * (hF > 0.05 ? 0 : 1);
      for (let j = 0; j < NBOW; j++) {
        const k = Math.floor((t - j * BDT) / (NBOW * BDT)) * NBOW + j, age = t - k * BDT, el = bow[j];
        const vy0 = 110 + 130 * hash(k, 24), g = 2300, tl = (2 * vy0) / g;
        const on = age >= 0 && age < tl && hash(k, 23) < bdens;
        if (!on) { vis(el, false); continue; }
        vis(el, true);
        const vx = 60 + 150 * hash(k, 25) - 0.05 * sp;
        const x = RIDER_X + FC[0] + 12 + vx * age, y = GROUND_Y - 3 - (vy0 * age - 0.5 * g * age * age);
        ballistic(el, x, y, vx, -(vy0 - g * age), 300);
      }

      // ================= landing: splash crowns, HUD shock rings, sparks
      const tLand = latest(fr.events, 'hop', t, TIMING.hop.land + 1.2);
      const tl = tLand < 0 ? -1 : tLand - TIMING.hop.land;
      const splashOn = tl >= 0 && tl < 0.5;
      vis(r.burstG, splashOn);
      if (splashOn) for (let i = 0; i < NBURST; i++) {
        const side = i % 2 ? 1 : -1, wheelX = i < NBURST / 2 ? RC[0] : FC[0];
        const hk = hash(i, 21), vx = side * (90 + 200 * hk) - 0.2 * sp, vy0 = 260 + 260 * hash(i, 22), g = 2300;
        const x = RIDER_X + wheelX + side * 14 + vx * tl, y = GROUND_Y - 2 - (vy0 * tl - 0.5 * g * tl * tl);
        const on = y < GROUND_Y + 2;
        vis(bps[i], on);
        if (on) ballistic(bps[i], x, y, vx, -(vy0 - g * tl), 300);
      }
      const spkOn = !reduced && tl >= 0 && tl < 0.34;
      vis(r.spkG, spkOn);
      if (spkOn) for (let i = 0; i < NSPK; i++) {
        const hk = hash(i, 31), wheelX = i < 4 ? RC[0] : FC[0], vx = -(260 + 520 * hk) - 0.3 * sp, vy0 = 200 + 380 * hash(i, 32), g = 2600;
        const x = RIDER_X + wheelX - 10 + vx * tl, y = GROUND_Y - 2 - (vy0 * tl - 0.5 * g * tl * tl);
        ballistic(spk[i], x, y, vx, -(vy0 - g * tl), 260);
        set(spk[i], 'opacity', f(1 - tl / 0.34));
      }
      const ti = tl >= 0 && tl < 0.4 && !nofx;
      vis(r.impG, ti);
      if (ti) {
        const u = tl / 0.4, s = reduced ? 1 : 0.5 + 1.1 * Math.sqrt(u);
        set(r.impR, 'transform', `translate(${RIDER_X + RC[0]} ${GROUND_Y + 1}) scale(${f(s)})`);
        set(r.impF, 'transform', `translate(${RIDER_X + FC[0]} ${GROUND_Y + 1}) scale(${f(s)})`);
        set(r.impG, 'opacity', f(1 - u * u));
      }

      // ================= rain splashing on the rider
      const rain = wx.rain || 0;
      if (rain > 0.1 && !reduced) {
        const pts = [];
        if (J.head) pts.push([J.head.x - 4, J.head.y - 27]);
        if (J.billUpper) { const b = J.billUpper, a = (b.rot || 0) * D2R; pts.push([b.x + 60 * Math.cos(a) + 6 * Math.sin(a), b.y + 60 * Math.sin(a) - 6 * Math.cos(a)]); }
        if (J.body) { const b = J.body, a = (b.rot || 0) * D2R, lx = 60, ly = -100; pts.push([b.x + lx * Math.cos(a) - ly * Math.sin(a), b.y + lx * Math.sin(a) + ly * Math.cos(a)]); }
        pts.push([BIKE.basket.x0 + 30, BIKE.basket.y0], [BIKE.basket.x1 - 18, BIKE.basket.y0], [BIKE.gripNear[0] - 20, BIKE.gripNear[1] + 4]);
        for (let j = 0; j < NRS; j++) {
          const P = 0.42 + 0.07 * j, k = Math.floor((t + j * 0.19) / P), age = t + j * 0.19 - k * P, el = rs[j];
          const on = age < 0.2 && hash(k, 300 + j) < rain * 1.1;
          if (!on) { vis(el, false); continue; }
          const p = pts[Math.floor(hash(k, 310 + j) * pts.length)], w = W(p[0], p[1]), u = age / 0.2;
          vis(el, true);
          set(el, 'transform', `translate(${f1(w[0])} ${f1(w[1])}) scale(${f(0.5 + 0.8 * u)} ${f(0.4 + 0.9 * Math.sin(Math.PI * Math.min(1, u * 1.3)))})`);
          set(el, 'opacity', f(1 - u * u));
        }
      } else for (const el of rs) vis(el, false);

      // ================= neon light trails (> 86 rpm, sparse)
      const slW = (tg.speedlines !== false && !reduced) ? sstep(86, 98, cad) : 0;
      vis(r.slG, slW > 0.01);
      if (slW > 0.01) for (let i = 0; i < TRAILS.length; i++) {
        const [ax, ay] = TRAILS[i], [xe, yy] = W(ax, ay);
        const P = 1.1, k = Math.floor((t + i * 0.37) / P), age = t + i * 0.37 - k * P, el = r['sl' + i];
        const on = hash(k, 50 + i) < 0.22 + 0.3 * slW;
        if (!on) { vis(el, false); continue; }
        vis(el, true);
        const u = age / P, hk = hash(k, 60 + i);
        const grow = sstep(0, 0.35, u), go = sstep(0.5, 1, u);
        const len = (160 + 220 * hk) * (0.2 + 0.8 * grow) * (1 - 0.5 * go);
        set(el, 'transform', `translate(${f1(xe - 4 - 300 * go * go)} ${f1(yy)}) scale(${f(len / 100)} ${f(0.8 + 0.4 * hk)})`);
        set(el, 'opacity', f(slW * (1 - sstep(0.7, 1, u))));
      }

      // ================= the calm wind: ONE slow data-stream, rarely (never while the weather's wind band shows)
      {
        const P = 8, k = Math.floor(t / P), age = t - k * P, LIFE = 4.2;
        const act = !reduced && cad > 75 && !(wx.wind > 0.3) && age < LIFE && hash(k, 30) < 0.35;
        vis(r.ds, act);
        if (act) {
          const u = age / LIFE, hk = hash(k, 40);
          set(r.ds, 'transform', `translate(${f1(RIDER_X - 560 - 30 * hk - 22 * age)} ${f1(GROUND_Y - 470 + 50 * hk)})`);
          const draw = sstep(0, 0.45, u), wipe = sstep(0.65, 1, u);
          set(r.dsA, 'stroke-dashoffset', f(1 - draw - wipe)); set(r.dsB, 'stroke-dashoffset', f(1 - draw - wipe));
          set(r.dsBits, 'opacity', f(0.8 * sstep(0.2, 0.5, u) * (1 - sstep(0.6, 0.9, u))));
        }
      }

      // ================= feathers (now and then) + the takeaway flyer
      if (half) for (let i = 0; i < 3; i++) {
        const P = 7.4, off = 0.6 + i * 2.5, k = Math.floor((t - off) / P), age = t - off - k * P, el = r['fea' + i];
        const LIFE_F = 5.2;
        const on = age >= 0 && age < LIFE_F && (k === 0 || hash(k, 70 + i) < 0.7) && !(reduced && i === 2);
        if (!on) { vis(el, false); continue; }
        vis(el, true);
        const u = age / LIFE_F, hk = hash(k, 80 + i);
        const vx = 70 + 0.05 * sp + 40 * hk;
        const x = RIDER_X - 40 - vx * age - 14 * Math.sin(age * 2.2 + hk * 5);
        const y = GROUND_Y - 350 + (i === 1 ? -30 : 20) - 30 * Math.sin(Math.min(1, age * 0.9) * Math.PI / 2) + 60 * age * age / LIFE_F + 10 * Math.sin(age * 3.1 + hk * 4);
        const rot = (i === 1 ? 0 : -15) + 35 * Math.sin(age * 2.2 + hk * 5);
        set(el, 'transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1(rot)}) scale(${i === 1 ? 1.7 : 1.35})`);
        set(el, 'opacity', f(sstep(0, 0.25, age) * (1 - sstep(0.8, 1, u))));
      }
      if (half) {
        const P = 9.3, off = 0.7, k = Math.floor((t - off) / P), age = t - off - k * P, LIFE_L = 4.4;
        const on = age >= 0 && age < LIFE_L && (k === 0 || hash(k, 210) < 0.75);
        vis(r.leaf, on);
        if (on) {
          const hk = hash(k, 211);
          const x = 1500 - (260 + 0.12 * sp) * age, y = 380 + 120 * hk + 140 * (age / LIFE_L) ** 1.4 + 18 * Math.sin(age * 2.6);
          set(r.leaf, 'transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1(age * 110 + hk * 90)}) scale(1.35)`);
          set(r.leafS, 'transform', `scale(${f(reduced ? 1 : Math.cos(age * 4.6))} 1)`);
        }
      }

      // ================= holographic butterfly (blown off when sprinting; glitches now and then)
      if (half) {
        const el = r.bf0, blow = sstep(70, 90, cad);
        if (blow > 0.98) vis(el, false);
        else {
          vis(el, true);
          const x = 1012 + 34 * Math.sin(0.9 * t) + 12 * Math.sin(2.3 * t) - blow * blow * 1400;
          const y = 392 + 22 * Math.sin(1.4 * t) + 8 * Math.sin(3.7 * t) - 40 * blow;
          const glide = reduced ? 1 : sstep(0.6, 0.9, Math.sin(0.7 * t));
          const flap = 0.2 + 0.8 * (0.5 + 0.5 * Math.cos(TAU * 7.5 * t));
          const cell = Math.floor(t * 12), gl = !reduced && hash(cell, 91) < 0.06;
          set(el, 'transform', `translate(${f1(x + (gl ? 5 * (hash(cell, 92) - 0.5) * 2 : 0))} ${f1(y)}) rotate(${f1(-8 + 10 * Math.sin(1.4 * t))}) scale(1.6)`);
          set(r.bfw0, 'transform', `translate(0 -1) scale(1 ${f(lerp(flap, 0.42, glide))}) translate(0 1)`);
          set(el, 'opacity', f((gl ? 0.45 : 0.92) * (0.75 + 0.25 * night)));
        }
      }

      // ================= bug-bot fly round the delivery box (with a dotted trail)
      {
        const uu = wrap(t * 0.52, 1), p = flyPt(uu);
        const jit = reduced ? 0 : 1.6;
        set(r.fly, 'transform', `translate(${f1(p[0] + jit * Math.sin(t * 41))} ${f1(p[1] + jit * Math.cos(t * 37))}) scale(2)`);
        set(r.flyW, 'transform', `rotate(${f1(reduced ? 0 : 22 * Math.sin(t * 90))} 0 -1.2)`);
        const idx = uu * FLYN, i0 = Math.floor(idx), cur = lerp(flyLen[i0], flyLen[i0 + 1], idx - i0);
        let seg = i0;
        for (let i = 0; i < 7; i++) {   // dotted trail: dots every 5.5 units of arc length behind the bot
          const s = wrap(cur - 9 - 5.5 * i, flyTotal);
          while (flyLen[seg] > s) seg = (seg + FLYN - 1) % FLYN;
          while (flyLen[seg + 1] < s) seg = (seg + 1) % FLYN;
          const a = flyPts[seg], b = flyPts[(seg + 1) % FLYN], u = (s - flyLen[seg]) / Math.max(1e-6, flyLen[seg + 1] - flyLen[seg]);
          set(r['ftd' + i], 'transform', `translate(${f1(lerp(a[0], b[0], u))} ${f1(lerp(a[1], b[1], u))})`);
        }
      }

      // ================= cryo mist: cold air SINKS off the box lip (not wind: it falls, spreads, fades)
      for (let i = 0; i < 4; i++) {
        const P = 2.4, LIFE_C = 1.9, off = i * 0.6, k = Math.floor((t - off) / P), age = t - off - k * P, el = r['cry' + i];
        const on = age >= 0 && age < LIFE_C && !(reduced && i > 1);
        vis(el, on);
        if (!on) continue;
        const u = age / LIFE_C, hk = hash(k * 4 + i, 120);
        const x = BIKE.basket.x1 + 3 + 10 * u + 4 * hk - 8 * Math.min(1, sN) * u, y = BIKE.basket.y0 + 4 + 46 * u * u + 3 * Math.sin(age * 2 + hk * 6);
        set(el, 'transform', `translate(${f1(x)} ${f1(y)}) scale(${f(0.55 + 0.9 * u)} ${f(0.6 + 0.5 * u)})`);
        set(el, 'opacity', f(sstep(0, 0.15, u) * (1 - sstep(0.55, 1, u)) * 0.9));
      }
      // ================= bell glint
      {
        const tw = reduced ? 0.85 : 0.5 + 0.5 * Math.max(0, Math.sin(TAU * 0.55 * t)) ** 2;
        set(r.glB, 'transform', `translate(${BIKE.bell[0] + 3} ${BIKE.bell[1] - 8}) rotate(${f1(12 * Math.sin(t * 0.8))}) scale(${f(0.45 + 0.55 * tw)})`);
      }

      // ================= glitch HUD pops
      const popAnim = (el, ref, salt, tau, dur, x, y, rot) => {
        const on = !nofx && tau >= 0 && tau < dur;
        vis(el, on);
        if (!on) return;
        const uin = clamp(tau / 0.14, 0, 1), uout = sstep(dur - 0.2, dur, tau);
        // CRT switch-on: a bright line opens to the panel; switch-off collapses back to a line
        let sy = reduced ? 1 : Math.max(0.05, easeOutBack(uin)) * (1 - 0.95 * uout);
        let sx = reduced ? 1 : (1 + 0.18 * (1 - uin)) * (1 + 0.25 * uout);
        const cell = Math.floor(tau * 24), gl = !reduced && (tau < 0.2 || uout > 0.02 || hash(cell, salt) < 0.1);
        const jx = gl ? 4 * (hash(cell, salt + 1) - 0.5) : 0;
        set(el, 'transform', `translate(${f1(x + jx)} ${f1(y - 10 * uout)}) rotate(${rot}) scale(${f(sx)} ${f(Math.max(0.02, sy))})`);
        set(el, 'opacity', f(reduced ? Math.min(1, tau / 0.12) * (1 - uout) : 1 - sstep(dur - 0.05, dur, tau)));
        for (let i = 0; i < 3; i++) set(r[`${ref}S${i}`], 'transform', gl ? `translate(${f1(22 * (hash(cell, salt + 10 + i) - 0.5))} 0)` : 'translate(0 0)');
        vis(r[ref + 'G'], gl);
        if (gl) {
          set(r[ref + 'B0'], 'transform', `translate(${f1(18 * (hash(cell, salt + 20) - 0.5))} ${f1(44 * (hash(cell, salt + 21) - 0.5))})`);
          set(r[ref + 'B1'], 'transform', `translate(${f1(30 * (hash(cell, salt + 22) - 0.5))} ${f1(44 * (hash(cell, salt + 23) - 0.5))})`);
        }
      };
      const tb = latest(fr.events, 'bell', t, 3);
      popAnim(r.popDing, 'popDing', 400, tb - TIMING.bell.strike, 1.05, RIDER_X + 330, GROUND_Y - 360, -4);
      const th = latest(fr.events, 'hop', t, 3);
      popAnim(r.popHop, 'popHop', 500, th - TIMING.hop.takeoff + 0.04, 1.0, RIDER_X - 300, GROUND_Y - 335, -5);
      const tgp = latest(fr.events, 'gulp', t, 8);
      popAnim(r.popGulp, 'popGulp', 600, tgp - TIMING.gulp.swallow[0], 1.1, RIDER_X + 395, GROUND_Y - 545, 4);
      // bell rings + neon notes
      const bw = W(BIKE.bell[0], BIKE.bell[1]);
      for (let i = 0; i < 3; i++) {
        const tau = tb - TIMING.bell.strike - i * 0.09, el = r['bw' + i];
        const on = !nofx && tau >= 0 && tau < 0.7;
        vis(el, on);
        if (!on) continue;
        const u = tau / 0.7;
        set(el, 'transform', `translate(${f1(bw[0] + 8 + 40 * u)} ${f1(bw[1])}) scale(${f(0.8 + 2.2 * u)})`);
        set(el, 'opacity', f(1 - u));
      }
      for (let i = 0; i < 2; i++) {
        const tau = tb - TIMING.bell.strike - i * 0.18, el = r['note' + i];
        const on = !nofx && tau >= 0 && tau < 1.6;
        vis(el, on);
        if (!on) continue;
        const u = tau / 1.6;
        const x = bw[0] + 18 + i * 10 - (60 + 0.02 * sp) * tau + 8 * Math.sin(tau * 6 + i);
        const y = bw[1] - 22 - 95 * tau + 18 * tau * tau;
        set(el, 'transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1(-10 + 14 * Math.sin(tau * 5 + i))}) scale(${f((reduced ? 1 : Math.min(1, easeOutBack(clamp(tau / 0.18, 0, 1)))) * 1.05)})`);
        set(el, 'opacity', f(1 - sstep(0.65, 1, u)));
      }
      // glowing drips (during scoop / lift) from the lower bill tip
      for (let i = 0; i < 4; i++) {
        const tau = tgp - 0.62 - i * 0.13, el = r['drip' + i];
        const on = tau >= 0 && tau < 0.42 && pose.fish;
        vis(el, !!on);
        if (!on) continue;
        const p = W(pose.fish.x, pose.fish.y);
        set(el, 'transform', `translate(${f1(p[0] - 6 + 5 * i - (0.25 * sp + 40) * tau)} ${f1(p[1] + 4 + 0.5 * 1800 * tau * tau)}) scale(${f(0.9 + 0.2 * (i % 2))} ${f(1 + 0.4 * Math.min(1, tau * 5))})`);
        set(el, 'opacity', f(1 - sstep(0.3, 0.42, tau)));
      }
      // pixel hearts after the gulp (they blink out, 8-bit style)
      for (let i = 0; i < 3; i++) {
        const tau = tgp - 1.9 - i * 0.28, el = r['heart' + i];
        const on = !nofx && tau >= 0 && tau < 1.9 && !(tau > 1.4 && Math.floor(tau * 12) % 2);
        vis(el, on);
        if (!on) continue;
        const hx = head;
        const x = hx[0] + 20 + i * 22 + 12 * Math.sin(tau * 3.4 + i * 2), y = hx[1] - 50 - 70 * tau - i * 6;
        const s = (reduced ? 1 : easeOutBack(clamp(tau / 0.22, 0, 1))) * (1.05 - 0.2 * i);
        set(el, 'transform', `translate(${f1(x)} ${f1(y)}) scale(${f(Math.max(0.01, s))})`);
      }
      // holographic fish bone: spat back over the shoulder; a hologram ignores gravity, so it tumbles back through the
      // air with drag, settles into a slow hover-drift behind the rider, flickers, then derezzes into rising pixels
      {
        const tau = tgp - 2.35, el = r.bone;
        const x0 = RIDER_X + 250, y0 = GROUND_Y - 490, TDZ = 1.6;
        const pos = tt => {
          const e = 1 - Math.exp(-2.2 * tt);
          return [x0 - 330 * e - 30 * tt, y0 - 70 * (1 - Math.exp(-3.5 * tt)) + 60 * e + 6 * Math.sin(tt * 3.4), -560 * e + 8 * Math.sin(tt * 2.6)];
        };
        const on = !nofx && tau >= 0 && tau < TDZ + 0.25;
        vis(el, on);
        if (on) {
          const [x, y, rot] = pos(tau);
          const flick = !reduced && hash(Math.floor(tau * 20), 77) < 0.12;
          set(el, 'transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1(rot)}) scale(1.45)`);
          set(el, 'opacity', f((flick ? 0.5 : 1) * (1 - sstep(TDZ, TDZ + 0.25, tau))));
          set(r.boneG, 'transform', flick ? `translate(${f1(3 * (hash(Math.floor(tau * 20), 78) - 0.5))} 0)` : 'translate(0 0)');
        }
        const dz = tau - TDZ, pxOn = !nofx && dz >= 0 && dz < 0.8;
        vis(r.pxG, pxOn);
        if (pxOn) {
          const [bx, by] = pos(TDZ);
          for (let j = 0; j < 12; j++) {
            const hx = hash(j, 81), hy = hash(j, 82);
            const x = bx + (hx - 0.5) * 50 - 30 * dz, yy = by + (hy - 0.5) * 14 - (40 + 90 * hy) * dz;
            const q = 3.2;   // pixels snap to a coarse grid, then blink out one by one
            set(px[j], 'transform', `translate(${f1(Math.round(x / q) * q)} ${f1(Math.round(yy / q) * q)})`);
            vis(px[j], dz < 0.3 + 0.5 * hash(j, 83));
          }
        }
      }
      // HUD wave arcs beside the waving wing
      {
        const tw = latest(fr.events, 'wave', t, 3);
        const on = !nofx && tw >= TIMING.wave.wave[0] && tw < TIMING.wave.wave[1] && J.wingNearHand;
        vis(r.waveArcs, !!on);
        if (on) {
          const j = J.wingNearHand, u = (tw - TIMING.wave.wave[0]) / (TIMING.wave.wave[1] - TIMING.wave.wave[0]);
          set(r.waveArcs, 'transform', `translate(${f1(j.x + 10)} ${f1(j.y - 20)}) rotate(${f1((j.rot || 0) * 0.3 - 10)})`);
          set(r.waveArcs, 'opacity', f(sstep(0, 0.12, u) * (1 - sstep(0.85, 1, u))));
        }
      }
    },
  };
}
