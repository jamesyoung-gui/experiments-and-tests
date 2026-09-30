// OWNER: land. Layers L-shore (0.6), L-roadside (0.9), L-road (1.0), L-foreground (1.3).
// Style C (docs/STYLE-C.md): a screen-printed seafront. Every surface is one of the seven inks (raw inks via
// v('inkX'), big masses via the time-of-day env tokens so the night is a night poster); halftone only as static
// patterns on these slow, flat-sliding layers; night glows are radial gradients quantised into 3 hard rings.
//
// Design coordinates = the hero frame (t = 3.2 s at 60 rpm): every object is drawn where it sits on screen in that
// frame. Each layer is ONE static tile of width TILE.* (whole crank turns, so the baked loop is seamless) drawn once
// as real DOM plus two <use> copies at ±W; the tile is never mutated (so the <use> shadow trees are never rebuilt).
// The few moving parts (palm crowns, towels, flags, crab, cat tail, hanging fish, night glows) live in a small
// "anim" group that is real DOM in all three copies. Per frame we only write transforms (and a display flag at dusk).
// Tile offset u = wrap((D − D0)·depth + W/2, W) − W/2, so the three copies always cover x ∈ [−0.5W−800, 1.5W+800].
import { fmt1, fmt2 } from '../core/math.js';
import { GROUND_Y, TILE, DIST_PER_REV, RIDER_X } from '../contract.js';
import { h, refs, mount } from '../core/svg.js';
import { LAP, KM, STRETCHES, SIGNS, KM_STONES, stretchAt, relTo, hash, ROUTE_GLYPHS } from './route.js';

export const id = 'land';

// Glyph outlines extracted with drafts/C-poster/ttf.mjs (DejaVu Sans Bold: Bitstream Vera licence; WenQuanYi Zen Hei: GPL
// with font-embedding exception). [d at em 100, advance]
const GL = {"0":["M46 -36.5Q46 -50.2 43.4 -55.8Q40.9 -61.4 34.8 -61.4Q28.8 -61.4 26.2 -55.8Q23.6 -50.2 23.6 -36.5Q23.6 -22.7 26.2 -17Q28.8 -11.4 34.8 -11.4Q40.8 -11.4 43.4 -17Q46 -22.7 46 -36.5ZM64.8 -36.4Q64.8 -18.3 57 -8.4Q49.2 1.4 34.8 1.4Q20.4 1.4 12.6 -8.4Q4.8 -18.3 4.8 -36.4Q4.8 -54.5 12.6 -64.4Q20.4 -74.2 34.8 -74.2Q49.2 -74.2 57 -64.4Q64.8 -54.5 64.8 -36.4Z",70],"1":["M11.7 -13L28.3 -13L28.3 -60.1L11.3 -56.6L11.3 -69.4L28.2 -72.9L46.1 -72.9L46.1 -13L62.7 -13L62.7 0L11.7 0Z",70],"2":["M28.8 -13.8L60.9 -13.8L60.9 0L7.9 0L7.9 -13.8L34.5 -37.3Q38.1 -40.5 39.8 -43.6Q41.5 -46.7 41.5 -50Q41.5 -55.1 38.1 -58.2Q34.6 -61.4 28.9 -61.4Q24.5 -61.4 19.3 -59.5Q14.1 -57.6 8.1 -53.9L8.1 -69.9Q14.5 -72 20.7 -73.1Q26.9 -74.2 32.8 -74.2Q45.9 -74.2 53.2 -68.5Q60.4 -62.7 60.4 -52.4Q60.4 -46.4 57.3 -41.3Q54.3 -36.1 44.4 -27.5Z",70],"3":["M46.6 -39.3Q54 -37.4 57.8 -32.7Q61.6 -28 61.6 -20.7Q61.6 -9.9 53.3 -4.2Q45 1.4 29.1 1.4Q23.5 1.4 17.9 0.5Q12.2 -0.4 6.7 -2.2L6.7 -16.7Q12 -14.1 17.2 -12.7Q22.4 -11.4 27.4 -11.4Q34.9 -11.4 38.8 -14Q42.8 -16.5 42.8 -21.4Q42.8 -26.4 38.8 -28.9Q34.7 -31.5 26.7 -31.5L19.2 -31.5L19.2 -43.6L27.1 -43.6Q34.2 -43.6 37.7 -45.8Q41.1 -48 41.1 -52.6Q41.1 -56.8 37.7 -59.1Q34.4 -61.4 28.2 -61.4Q23.7 -61.4 19 -60.3Q14.4 -59.3 9.8 -57.3L9.8 -71.1Q15.4 -72.7 20.9 -73.4Q26.3 -74.2 31.6 -74.2Q45.8 -74.2 52.9 -69.6Q59.9 -64.9 59.9 -55.5Q59.9 -49.1 56.5 -45Q53.2 -41 46.6 -39.3Z",70],"4":["M36.8 -57.4L16.2 -26.9L36.8 -26.9ZM33.7 -72.9L54.6 -72.9L54.6 -26.9L65 -26.9L65 -13.3L54.6 -13.3L54.6 0L36.8 0L36.8 -13.3L4.5 -13.3L4.5 -29.4Z",70],"5":["M10.6 -72.9L57.3 -72.9L57.3 -59.1L25.6 -59.1L25.6 -47.8Q27.7 -48.4 29.9 -48.7Q32.1 -49 34.4 -49Q47.8 -49 55.2 -42.4Q62.6 -35.7 62.6 -23.8Q62.6 -12 54.5 -5.3Q46.4 1.4 32.1 1.4Q25.9 1.4 19.8 0.2Q13.7 -1 7.7 -3.4L7.7 -18.2Q13.7 -14.8 19 -13.1Q24.4 -11.4 29.1 -11.4Q35.9 -11.4 39.9 -14.7Q43.8 -18.1 43.8 -23.8Q43.8 -29.5 39.9 -32.9Q35.9 -36.2 29.1 -36.2Q25.1 -36.2 20.5 -35.1Q15.9 -34.1 10.6 -31.9Z",70],"6":["M36.2 -36Q31.3 -36 28.8 -32.8Q26.3 -29.6 26.3 -23.2Q26.3 -16.8 28.8 -13.6Q31.3 -10.4 36.2 -10.4Q41.2 -10.4 43.6 -13.6Q46.1 -16.8 46.1 -23.2Q46.1 -29.6 43.6 -32.8Q41.2 -36 36.2 -36ZM59.4 -71L59.4 -57.5Q54.8 -59.7 50.7 -60.8Q46.6 -61.8 42.7 -61.8Q34.3 -61.8 29.6 -57.1Q24.9 -52.5 24.1 -43.3Q27.3 -45.7 31.1 -46.9Q34.9 -48.1 39.3 -48.1Q50.5 -48.1 57.4 -41.5Q64.2 -35 64.2 -24.4Q64.2 -12.7 56.5 -5.6Q48.9 1.4 36 1.4Q21.8 1.4 14 -8.2Q6.2 -17.8 6.2 -35.4Q6.2 -53.5 15.3 -63.8Q24.4 -74.1 40.3 -74.1Q45.3 -74.1 50.1 -73.3Q54.8 -72.6 59.4 -71Z",70],"7":["M6.7 -72.9L61.6 -72.9L61.6 -62.3L33.2 0L14.9 0L41.8 -59.1L6.7 -59.1Z",70],"8":["M34.8 -32.6Q29.5 -32.6 26.7 -29.7Q23.9 -26.9 23.9 -21.5Q23.9 -16.1 26.7 -13.3Q29.5 -10.4 34.8 -10.4Q40 -10.4 42.8 -13.3Q45.6 -16.1 45.6 -21.5Q45.6 -26.9 42.8 -29.8Q40 -32.6 34.8 -32.6ZM21.1 -38.8Q14.5 -40.8 11.1 -45Q7.7 -49.1 7.7 -55.3Q7.7 -64.5 14.6 -69.4Q21.5 -74.2 34.8 -74.2Q48.1 -74.2 54.9 -69.4Q61.8 -64.6 61.8 -55.3Q61.8 -49.1 58.4 -45Q55 -40.8 48.4 -38.8Q55.8 -36.8 59.6 -32.1Q63.4 -27.5 63.4 -20.5Q63.4 -9.7 56.2 -4.1Q49 1.4 34.8 1.4Q20.6 1.4 13.4 -4.1Q6.1 -9.7 6.1 -20.5Q6.1 -27.5 9.9 -32.1Q13.7 -36.8 21.1 -38.8ZM25.5 -53.4Q25.5 -49.1 27.9 -46.7Q30.3 -44.4 34.8 -44.4Q39.2 -44.4 41.6 -46.7Q44 -49.1 44 -53.4Q44 -57.8 41.6 -60.1Q39.2 -62.4 34.8 -62.4Q30.3 -62.4 27.9 -60.1Q25.5 -57.7 25.5 -53.4Z",70],"9":["M10 -1.6L10 -15.1Q14.5 -13 18.6 -11.9Q22.7 -10.9 26.7 -10.9Q35.1 -10.9 39.8 -15.5Q44.5 -20.2 45.3 -29.4Q42 -26.9 38.2 -25.7Q34.5 -24.5 30.1 -24.5Q18.9 -24.5 12 -31Q5.2 -37.5 5.2 -48.2Q5.2 -60 12.8 -67Q20.5 -74.1 33.3 -74.1Q47.6 -74.1 55.4 -64.5Q63.2 -54.9 63.2 -37.3Q63.2 -19.2 54.1 -8.9Q44.9 1.4 29 1.4Q23.9 1.4 19.2 0.7Q14.5 -0.1 10 -1.6ZM33.2 -36.7Q38.1 -36.7 40.6 -39.9Q43.1 -43.1 43.1 -49.5Q43.1 -55.9 40.6 -59.1Q38.1 -62.3 33.2 -62.3Q28.3 -62.3 25.8 -59.1Q23.3 -55.9 23.3 -49.5Q23.3 -43.1 25.8 -39.9Q28.3 -36.7 33.2 -36.7Z",70],"鹈":["M31.6 12Q28 11.6 24.5 12Q24.8 5.4 24.8 -1.3L24.8 -17.3Q18.6 -6 6.2 5.5Q4.2 2.6 1 1.4Q6.5 -3.5 11.3 -9.7Q16 -15.8 21.6 -26.5L9 -26.5L8.9 -47.3L24.8 -47.3L24.8 -57.7L17.7 -57.7Q13.1 -57.7 8.6 -57.4Q8.8 -60 8.6 -62.4Q13.1 -62.2 17.7 -62.2L27.7 -62.2Q32.7 -70.1 36.4 -80.4Q39.8 -78.8 43.3 -78Q40.9 -70.9 35.5 -62.2L47.6 -62.2L47.6 -42.7L31.4 -42.7L31.4 -31L48.4 -31L48.4 -13.3Q48.4 -9.8 44.5 -7.3Q40.5 -4.9 35.7 -5Q36.5 -9.6 33.8 -13.5Q35.5 -13 37.4 -12.6Q40.8 -12.5 41.4 -12.7Q41.9 -12.9 41.9 -14.2L41.9 -26.5L31.4 -26.5L31.4 -1.3Q31.4 5.4 31.6 12ZM25.8 -66.4L19.6 -62.7L10.4 -78.1L16.5 -81.8ZM24.8 -31L24.8 -42.7L15.4 -42.7Q15.4 -37.1 15.5 -31ZM31.4 -47.3L41 -47.3L41 -57.7L32.5 -57.7L32.2 -57.3Q32 -57.7 31.4 -57.7ZM85.6 -12.7Q85.4 -10.1 85.6 -7.4Q81.5 -7.6 77.3 -7.6L64 -7.6Q59.9 -7.6 55.9 -7.4Q56.1 -10.1 55.9 -12.7Q59.9 -12.4 64 -12.4L77.3 -12.4Q81.5 -12.4 85.6 -12.7ZM79.9 -51L75 -46.5L68.5 -56.6L73.3 -61.1ZM78.2 -33.2Q78.8 -38.3 76.6 -41.4Q78.7 -41 81.8 -41Q85 -40.9 85.4 -41.4Q85.7 -41.9 85.7 -43.4L85.7 -63.3L72.3 -63.3L71.2 -62Q70.8 -62.7 70.4 -63.3Q68.8 -63.3 66.2 -63.3L66.2 -29.3L96.4 -29.3L96.4 4.4Q96.4 7.9 94 10.6Q90.2 13.9 81.9 13.8Q82.6 8.6 80.1 5.6Q82.6 6 86.2 6Q89.8 6.1 90.3 5.5Q90.8 4.9 90.8 2.7L90.8 -24.5L60.6 -24.5L60.6 -68.1Q64.6 -68.1 68.5 -68.1Q71.7 -72.1 73.3 -78.1Q76.1 -76.6 79.2 -75.8Q78 -71.2 75.9 -68.1L91.3 -68.1L91.3 -42.2Q91.3 -39.2 89 -36.5Q85.6 -33.3 78.2 -33.2Z",100],"鹕":["M49.1 -26.1L39.5 -26.1Q40 -11.4 35.2 -2.1Q30.4 7.2 22.5 12Q20.7 8.5 16.9 7.2Q32.7 0.3 33 -22.4L32.9 -74.4L55.6 -74.4L55.6 1.2Q55.7 7.6 52 10Q47.7 12.6 40.7 12.4Q41.6 8.1 38.9 4.6Q41.2 5 44.3 5Q47.5 5.1 48.2 4.2Q49.1 2.8 49.1 -2.6ZM11.5 -2.1L5.1 -2.1L5.1 -38Q9.2 -38 13.1 -38L13.1 -53.6L1.7 -53.4Q2 -55.8 1.7 -58.1L13.1 -57.9L13.1 -69.4Q13.1 -76 12.8 -82.4Q16.3 -82.1 19.8 -82.4Q19.4 -76 19.4 -69.4L19.4 -57.9L32.2 -58.1Q32 -55.8 32.2 -53.4L19.4 -53.6L19.4 -38L27.6 -38L27.6 -2.1L21.3 -2.1L21.3 -10.2L11.5 -10.2ZM49.1 -52.4L49.1 -70.2L39.3 -70.2L39.4 -52.4ZM49.1 -30L49.1 -48.6L39.4 -48.6L39.5 -30ZM21.3 -33.7L11.5 -33.7L11.5 -14.2L21.3 -14.2ZM86.5 -12.7Q86.3 -10.1 86.5 -7.4Q82.7 -7.6 78.9 -7.6L66.4 -7.6Q62.6 -7.6 58.8 -7.4Q59 -10.1 58.8 -12.7Q62.6 -12.4 66.4 -12.4L78.9 -12.4Q82.7 -12.4 86.5 -12.7ZM81.3 -51L76.7 -46.5L70.6 -56.6L75.1 -61.1ZM79.7 -33.2Q80.3 -38.3 78.2 -41.4Q80.2 -41 83.1 -41Q85.9 -40.9 86.3 -41.4Q86.7 -41.9 86.7 -43.4L86.7 -63.3L74.1 -63.3L73.1 -62Q72.8 -62.7 72.5 -63.3Q70.8 -63.3 68.5 -63.3L68.5 -29.3L96.7 -29.3L96.7 4.4Q96.7 7.9 94.3 10.6Q90.9 13.9 83.1 13.8Q83.8 8.6 81.5 5.6Q83.8 6 87.1 6Q90.4 6.1 90.9 5.5Q91.4 4.9 91.4 2.7L91.4 -24.5L63.3 -24.5L63.3 -68.1Q66.9 -68.1 70.6 -68.1Q73.5 -72.1 75.1 -78.1Q77.6 -76.6 80.6 -75.8Q79.5 -71.2 77.5 -68.1L91.9 -68.1L91.9 -42.2Q91.9 -39.2 89.7 -36.5Q86.5 -33.3 79.7 -33.2Z",100],"湾":["M77.3 -35.5L46.4 -35.5Q41.9 -35.5 37.3 -35.3Q37.5 -37.8 37.3 -40.3Q41.9 -40 46.4 -40L83.9 -40L83.9 -23.5L45.7 -23.3L43.1 -15.5L88.7 -15.5L83.8 4.8Q81.6 12.7 63.1 12.5Q63.7 10.2 62.9 8.1Q62.2 6.1 60.6 4.7Q64.4 5.1 70.3 4.7Q76.2 4.3 76.8 3.8Q77.4 3.3 77.6 2.3L80.9 -11L34.6 -11L39.8 -26L39.8 -27.4L40.2 -27.4L40.6 -28.5L43.9 -27.4L77.3 -27.6ZM91.2 -42.9Q84.3 -53 74 -59.9L78 -65.8Q89.5 -58.2 97.2 -46.9ZM39.2 -61.5Q42.4 -60.1 45.9 -59.2Q43.3 -50.6 37 -40.4L33 -34.1Q30.5 -36.5 27.1 -36.9Q32.1 -43.9 35.9 -53.4ZM73.1 -42.8Q69.4 -43.2 65.8 -42.8Q66.1 -49.4 66.1 -56L66.1 -67.9L57.3 -67.9L57.3 -56.5Q57.3 -49.9 57.6 -43.3Q54 -43.5 50.5 -43.3Q50.8 -49.9 50.8 -56.5L50.8 -67.9L38.6 -67.9Q34.1 -67.9 29.5 -67.7Q29.7 -70.1 29.5 -72.7Q34.1 -72.5 38.6 -72.5L61.1 -72.5L51.1 -79L55 -85L67.9 -76.6L65.1 -72.5L87.2 -72.5Q91.8 -72.5 96.4 -72.7Q96.1 -70.1 96.4 -67.7Q91.8 -67.9 87.2 -67.9L72.7 -67.9L72.7 -56Q72.7 -49.4 73.1 -42.8ZM11.1 11.5Q8 9.2 3.5 9Q6.7 1.1 10.2 -9.1Q13.6 -19.2 20.2 -44.3L23.1 -42.3L14.7 -5.3ZM16.9 -44.6L12.2 -39.8L1.3 -53.1L6 -58ZM18.3 -61.1Q13.2 -68.5 7.1 -75L11.6 -80.1Q18 -73.2 23.3 -65.4Z",100],"鲜":["M76.9 12Q73.3 11.6 69.8 12Q70.1 5.5 70.1 -1L70.1 -13.8L61.8 -13.8Q57.5 -13.8 53.1 -13.6Q53.4 -15.9 53.1 -18.3Q57.5 -18 61.8 -18L70.1 -18L70.1 -33.2L63.9 -33.2Q59.6 -33.2 55.2 -33Q55.5 -35.3 55.2 -37.7Q59.6 -37.5 63.9 -37.5L70.1 -37.5L70.1 -52.9L61.8 -52.9Q57.5 -52.9 53.1 -52.7Q53.4 -55.1 53.1 -57.4Q57.5 -57.2 61.8 -57.2L70 -57.2L79.1 -73.2L83.8 -81Q86.6 -78.8 89.8 -77.3L85.2 -69.6L79.4 -60.7L77.3 -57.2L88 -57.2Q92.3 -57.2 96.7 -57.4Q96.4 -55.1 96.7 -52.7Q92.3 -52.9 88 -52.9L76.5 -52.9L76.5 -37.5L84.4 -37.5Q88.7 -37.5 93 -37.7Q92.7 -35.3 93 -33Q88.7 -33.2 84.4 -33.2L76.5 -33.2L76.5 -18L88.2 -18Q92.6 -18 96.9 -18.3Q96.6 -15.9 96.9 -13.6Q92.6 -13.8 88.2 -13.8L76.5 -13.8L76.5 -1Q76.5 5.5 76.9 12ZM63.9 -58.8Q58.8 -68.3 52.4 -76.9L58.2 -81Q64.8 -72 70.1 -62.1ZM6.6 9.1Q6.6 4.3 4.5 1.1Q11.7 0.7 20.7 -0.6Q29.7 -1.9 50.7 -6.9L50.7 -2.8Q30.4 2.2 21.9 4.5Q13.5 6.9 6.6 9.1ZM22.3 -78.9Q25.6 -77.6 29.5 -77Q27.7 -70.5 25 -64.3L41.7 -64.3L42.7 -58.7Q41.3 -58.5 40.6 -57.5L34.9 -47.6L48.5 -47.6Q47.2 -29.1 48.3 -10.4L12.7 -10.4Q13.8 -27.3 13 -43.5Q10 -39.5 6.7 -35.7Q4.5 -38.3 0.8 -39.2Q15.2 -55.1 22.3 -78.9ZM33.3 -32.2L41.6 -32.2L41.7 -43.1L33.3 -43.1ZM26.5 -32.2L26.5 -43.1L19.5 -43.1L19.5 -32.2ZM33.3 -28L33.3 -14.9L41.5 -14.9L41.6 -28ZM26.5 -28L19.5 -28L19.5 -14.9L26.5 -14.9ZM34.1 -59.8L23 -59.8Q19.9 -53.7 15.7 -47.6L28.6 -47.6L27.4 -48.2Z",100],"鱼":["M95.8 0.5Q95.5 3.3 95.8 6.2Q90.6 5.9 85.4 5.9L15.7 5.9Q10.5 5.9 5.3 6.2Q5.6 3.3 5.3 0.5Q10.5 0.7 15.7 0.7L85.4 0.7Q90.6 0.7 95.8 0.5ZM37.6 -70.5L67 -70.5L67.8 -64.5Q65.5 -64.1 64.1 -62.8L55.6 -54.1L80.2 -54.1Q78.9 -31.9 80.2 -9.9L19 -9.9Q19.5 -20.9 19.5 -30.4Q19.5 -39.9 19.2 -47.8Q13.4 -41.9 7.2 -37.3Q5.1 -41 1.2 -42.8Q17.6 -54.4 25.3 -65.4Q30.7 -73 34.9 -81.3Q38.3 -78.9 42.1 -77.2ZM52.8 -34.9L73.3 -34.9L73.3 -48.9L52.8 -48.9ZM45.9 -34.9L45.9 -48.9L25.8 -48.9L25.8 -34.9ZM52.8 -29.7L52.8 -15L73.3 -15L73.3 -29.7ZM45.9 -29.7L25.8 -29.7L25.8 -15L45.9 -15ZM47.5 -54.1L46.8 -54.8L57 -65.4L33.9 -65.4Q29.4 -59.2 24.9 -54.1Z",100],"巴":["M19.9 5.9Q15.3 5.9 12.4 2.8Q9.4 -0.2 9.4 -5.3L9.4 -74L84.1 -74.2L84.1 -34.6L76.9 -34.6L76.9 -38.1L16.5 -38.1L16.5 -5.3Q16.5 -3.4 17.5 -2Q18.5 -0.7 20 -0.7L76.8 -0.7Q79.5 -0.7 81.5 -2.4Q83.6 -4.2 84 -6.8L85.9 -21.4Q89.1 -19.1 92.9 -19.1L90 -1.4Q89.7 1.8 87.4 3.8Q85.2 5.9 82.1 5.9ZM16.5 -44L43.1 -44L43.1 -68.2L16.5 -68.2ZM50.3 -44L76.9 -44L76.9 -68.3L50.3 -68.3Z",100],"士":["M89.3 -1Q88.9 2.6 89.3 6.2Q82.7 5.9 76.1 5.9L21.6 5.9Q14.9 5.9 8.4 6.2Q8.8 2.6 8.4 -1Q14.9 -0.7 21.6 -0.7L45.1 -0.7L45.1 -41.1L14.9 -41.1Q8.3 -41.1 1.8 -40.7Q2.2 -44.3 1.8 -47.8Q8.3 -47.6 14.9 -47.6L45.1 -47.6L45.1 -67.3Q45.1 -74.8 44.7 -82.3Q48.8 -81.8 52.9 -82.3Q52.5 -74.8 52.5 -67.3L52.5 -47.6L82.7 -47.6Q89.4 -47.6 95.9 -47.8Q95.5 -44.3 95.9 -40.7Q89.4 -41.1 82.7 -41.1L52.5 -41.1L52.5 -0.7L76.1 -0.7Q82.7 -0.7 89.3 -1Z",100],"站":["M56 12Q52.3 11.6 48.6 12Q48.9 5.2 48.9 -1.7L49 -31.3L63.3 -31.3L63.3 -68.5Q63.3 -75.4 63 -82.1Q66.6 -81.7 70.3 -82.1Q70 -75.4 70 -68.5L70 -57.2L87 -57.2Q91.9 -57.2 96.8 -57.4Q96.5 -54.8 96.8 -52.1Q91.9 -52.3 87 -52.3L70 -52.3L70 -31.3L88.2 -31.3L88.2 11.8L81.5 11.8L81.5 4.8L55.8 4.8Q55.9 8.4 56 12ZM81.5 -26.5L55.7 -26.5L55.7 0L81.5 0ZM3.2 0.3Q2.9 -4.4 0.1 -7.6Q7 -7.8 15.4 -8.8Q23.8 -9.9 43.2 -14.3L43.3 -10.2Q24.8 -5.9 17.1 -3.8Q9.4 -1.7 3.2 0.3ZM31.9 -48.4Q36.1 -47.4 41 -46.9Q39.2 -39.8 36.1 -30.2Q33.1 -20.5 32.5 -18.3Q31.9 -16.1 31.1 -12.3Q26.9 -13.5 22.5 -12.5L27.8 -34.5Q29.8 -41.5 31.9 -48.4ZM22.8 -18.4L13.7 -16.7Q11.5 -24.1 8.8 -31.4Q6.2 -38.7 3 -45.9L11.9 -48.1Q15 -40.8 17.8 -33.3Q20.5 -25.9 22.8 -18.4ZM46.4 -58.5Q46.1 -56 46.4 -53.5Q40.5 -53.7 34.6 -53.7L12.7 -53.7Q6.7 -53.7 0.9 -53.5Q1.2 -56 0.9 -58.5Q6.7 -58.3 12.7 -58.3L34.6 -58.3Q40.5 -58.3 46.4 -58.5ZM23.1 -59Q18.5 -67.9 12.4 -75.8L20.4 -79.5Q26.9 -71.1 31.8 -61.7Z",100],"邮":["M14.1 12Q10.3 11.6 6.5 12Q6.7 4.9 6.7 -2.1L6.8 -65.3L25.4 -65.3L25.4 -68.1Q25.4 -75.1 25.1 -82.1Q28.9 -81.7 32.7 -82.1Q32.4 -75.1 32.4 -68.1L32.4 -65.3L51.6 -65.3L51.6 11.8L44.5 11.8L44.5 -2.9L13.8 -2.9ZM32.7 -8.3L44.5 -8.4L44.5 -32L32.4 -32L32.4 -21.5Q32.4 -14.9 32.7 -8.3ZM25.4 -21.5L25.4 -32L13.8 -32L13.8 -8.4L25.1 -8.3Q25.4 -14.9 25.4 -21.5ZM32.4 -37.4L44.5 -37.4L44.5 -60L32.4 -60ZM25.4 -37.4L25.4 -60L13.8 -60L13.8 -37.4ZM70.2 13.4Q67.1 13 64 13.4Q64.3 6.2 64.3 -1.2L64.3 -75.3L91.7 -75.3L91.7 -69.3Q90.3 -67.4 89.6 -64.9L82.4 -43.1Q87.9 -38.3 91 -30.8Q94.1 -23.3 94.1 -14.8Q94.1 -6.2 83.7 -0.9L80.1 0.9Q78.7 -2.9 76.9 -6L82.8 -8.3Q88.7 -10.4 88.7 -14.8Q88.7 -23.3 85.3 -30.8Q81.9 -38.2 76.1 -42.5L84.9 -69.3L69.9 -69.3L69.9 -1.2Q69.9 6.1 70.2 13.4Z",100],"A":["M53.4 -13.3L24 -13.3L19.4 0L0.5 0L27.5 -72.9L49.9 -72.9L76.9 0L58 0ZM28.7 -26.8L48.7 -26.8L38.7 -55.8Z",77],"B":["M38.4 -44.7Q42.8 -44.7 45.1 -46.6Q47.4 -48.6 47.4 -52.4Q47.4 -56.1 45.1 -58.1Q42.8 -60.1 38.4 -60.1L28 -60.1L28 -44.7ZM39 -12.8Q44.7 -12.8 47.5 -15.2Q50.4 -17.6 50.4 -22.4Q50.4 -27.1 47.6 -29.5Q44.7 -31.9 39 -31.9L28 -31.9L28 -12.8ZM56.5 -39Q62.6 -37.3 65.9 -32.5Q69.2 -27.8 69.2 -20.9Q69.2 -10.3 62.1 -5.2Q54.9 0 40.4 0L9.2 0L9.2 -72.9L37.4 -72.9Q52.6 -72.9 59.4 -68.3Q66.2 -63.7 66.2 -53.6Q66.2 -48.3 63.7 -44.6Q61.2 -40.8 56.5 -39Z",76],"C":["M67 -4Q61.8 -1.3 56.2 0.1Q50.6 1.4 44.5 1.4Q26.3 1.4 15.6 -8.8Q5 -18.9 5 -36.4Q5 -53.9 15.6 -64Q26.3 -74.2 44.5 -74.2Q50.6 -74.2 56.2 -72.8Q61.8 -71.5 67 -68.8L67 -53.7Q61.8 -57.3 56.7 -58.9Q51.6 -60.6 46 -60.6Q35.9 -60.6 30.2 -54.1Q24.4 -47.7 24.4 -36.4Q24.4 -25.1 30.2 -18.6Q35.9 -12.2 46 -12.2Q51.6 -12.2 56.7 -13.9Q61.8 -15.5 67 -19.1Z",73],"D":["M28 -58.7L28 -14.2L34.7 -14.2Q46.2 -14.2 52.3 -19.9Q58.4 -25.6 58.4 -36.5Q58.4 -47.4 52.3 -53Q46.3 -58.7 34.7 -58.7ZM9.2 -72.9L29 -72.9Q45.6 -72.9 53.7 -70.5Q61.9 -68.2 67.7 -62.5Q72.8 -57.6 75.3 -51.1Q77.8 -44.7 77.8 -36.5Q77.8 -28.3 75.3 -21.8Q72.8 -15.3 67.7 -10.4Q61.8 -4.7 53.6 -2.4Q45.4 0 29 0L9.2 0Z",83],"E":["M9.2 -72.9L59.9 -72.9L59.9 -58.7L28 -58.7L28 -45.1L58 -45.1L58 -30.9L28 -30.9L28 -14.2L61 -14.2L61 0L9.2 0Z",68],"F":["M9.2 -72.9L59.9 -72.9L59.9 -58.7L28 -58.7L28 -45.1L58 -45.1L58 -30.9L28 -30.9L28 0L9.2 0Z",68],"G":["M74.7 -5.4Q67.7 -2 60.1 -0.3Q52.5 1.4 44.5 1.4Q26.3 1.4 15.6 -8.8Q5 -18.9 5 -36.4Q5 -54 15.8 -64.1Q26.7 -74.2 45.5 -74.2Q52.8 -74.2 59.5 -72.8Q66.1 -71.5 72 -68.8L72 -53.7Q65.9 -57.2 59.9 -58.9Q53.9 -60.6 47.8 -60.6Q36.6 -60.6 30.5 -54.3Q24.4 -48 24.4 -36.4Q24.4 -24.8 30.3 -18.5Q36.1 -12.2 46.9 -12.2Q49.9 -12.2 52.4 -12.6Q54.9 -12.9 56.9 -13.7L56.9 -27.9L45.4 -27.9L45.4 -40.5L74.7 -40.5Z",82],"H":["M9.2 -72.9L28 -72.9L28 -45.1L55.7 -45.1L55.7 -72.9L74.5 -72.9L74.5 0L55.7 0L55.7 -30.9L28 -30.9L28 0L9.2 0Z",84],"I":["M9.2 -72.9L28 -72.9L28 0L9.2 0Z",37],"K":["M9.2 -72.9L28 -72.9L28 -46.3L55.1 -72.9L76.9 -72.9L41.8 -38.4L80.5 0L57 0L28 -28.7L28 0L9.2 0Z",77],"L":["M9.2 -72.9L28 -72.9L28 -14.2L61 -14.2L61 0L9.2 0Z",64],"M":["M9.2 -72.9L33.1 -72.9L49.7 -33.9L66.4 -72.9L90.3 -72.9L90.3 0L72.5 0L72.5 -53.3L55.7 -14L43.8 -14L27 -53.3L27 0L9.2 0Z",100],"N":["M9.2 -72.9L30.2 -72.9L56.7 -22.9L56.7 -72.9L74.5 -72.9L74.5 0L53.5 0L27 -50L27 0L9.2 0Z",84],"O":["M42.5 -60.6Q33.9 -60.6 29.2 -54.2Q24.4 -47.9 24.4 -36.4Q24.4 -24.9 29.2 -18.5Q33.9 -12.2 42.5 -12.2Q51.1 -12.2 55.9 -18.5Q60.6 -24.9 60.6 -36.4Q60.6 -47.9 55.9 -54.2Q51.1 -60.6 42.5 -60.6ZM42.5 -74.2Q60.1 -74.2 70 -64.2Q80 -54.1 80 -36.4Q80 -18.7 70 -8.6Q60.1 1.4 42.5 1.4Q25 1.4 15 -8.6Q5 -18.7 5 -36.4Q5 -54.1 15 -64.2Q25 -74.2 42.5 -74.2Z",85],"P":["M9.2 -72.9L40.4 -72.9Q54.3 -72.9 61.7 -66.7Q69.2 -60.5 69.2 -49.1Q69.2 -37.6 61.7 -31.5Q54.3 -25.3 40.4 -25.3L28 -25.3L28 0L9.2 0ZM28 -59.3L28 -38.9L38.4 -38.9Q43.9 -38.9 46.8 -41.6Q49.8 -44.2 49.8 -49.1Q49.8 -54 46.8 -56.6Q43.9 -59.3 38.4 -59.3Z",73],"R":["M35.9 -40.6Q41.8 -40.6 44.4 -42.8Q46.9 -45 46.9 -50Q46.9 -55 44.4 -57.1Q41.8 -59.3 35.9 -59.3L28 -59.3L28 -40.6ZM28 -27.6L28 0L9.2 0L9.2 -72.9L37.9 -72.9Q52.3 -72.9 59 -68.1Q65.7 -63.2 65.7 -52.8Q65.7 -45.6 62.2 -40.9Q58.7 -36.3 51.7 -34.1Q55.6 -33.2 58.6 -30.1Q61.7 -27 64.8 -20.7L75 0L55 0L46.1 -18.1Q43.4 -23.6 40.7 -25.6Q37.9 -27.6 33.3 -27.6Z",77],"S":["M59.9 -70.6L59.9 -55.2Q53.9 -57.9 48.2 -59.2Q42.5 -60.6 37.4 -60.6Q30.7 -60.6 27.4 -58.7Q24.2 -56.9 24.2 -53Q24.2 -50 26.4 -48.4Q28.6 -46.8 34.3 -45.6L42.3 -44Q54.4 -41.5 59.6 -36.6Q64.7 -31.6 64.7 -22.4Q64.7 -10.3 57.5 -4.5Q50.4 1.4 35.7 1.4Q28.8 1.4 21.8 0.1Q14.8 -1.2 7.8 -3.8L7.8 -19.7Q14.8 -16 21.3 -14.1Q27.8 -12.2 33.9 -12.2Q40 -12.2 43.3 -14.3Q46.6 -16.3 46.6 -20.1Q46.6 -23.5 44.4 -25.4Q42.1 -27.2 35.5 -28.7L28.2 -30.3Q17.3 -32.7 12.2 -37.8Q7.2 -42.9 7.2 -51.6Q7.2 -62.5 14.2 -68.4Q21.2 -74.2 34.4 -74.2Q40.4 -74.2 46.8 -73.3Q53.1 -72.4 59.9 -70.6Z",72],"T":["M0.5 -72.9L67.7 -72.9L67.7 -58.7L43.5 -58.7L43.5 0L24.7 0L24.7 -58.7L0.5 -58.7Z",68],"U":["M9.2 -72.9L28 -72.9L28 -29.2Q28 -20.2 30.9 -16.3Q33.9 -12.4 40.6 -12.4Q47.3 -12.4 50.3 -16.3Q53.2 -20.2 53.2 -29.2L53.2 -72.9L72 -72.9L72 -29.2Q72 -13.7 64.3 -6.1Q56.5 1.4 40.6 1.4Q24.7 1.4 16.9 -6.1Q9.2 -13.7 9.2 -29.2Z",81],"V":["M0.5 -72.9L19.4 -72.9L38.7 -19.1L58 -72.9L76.9 -72.9L49.9 0L27.5 0Z",77],"W":["M3 -72.9L21 -72.9L33.6 -19.9L46.1 -72.9L64.2 -72.9L76.7 -19.9L89.3 -72.9L107.2 -72.9L90 0L68.3 0L55.1 -55.4L42 0L20.3 0Z",110],"X":["M49.8 -37.2L75.1 0L55.5 0L38.5 -24.9L21.6 0L1.9 0L27.2 -37.2L2.9 -72.9L22.5 -72.9L38.5 -49.4L54.4 -72.9L74.1 -72.9Z",77],"Y":["M-1 -72.9L19.6 -72.9L36.2 -46.9L52.8 -72.9L73.4 -72.9L45.6 -30.7L45.6 0L26.8 0L26.8 -30.7Z",72],":":["M11.2 -54.7L28.8 -54.7L28.8 -35.8L11.2 -35.8ZM11.2 -18.9L28.8 -18.9L28.8 0L11.2 0Z",40]};

// ---------------------------------------------------------------------------------------------- helpers
const GLM = Object.assign({}, ROUTE_GLYPHS, GL);
const f = fmt2;   // = String(Math.round(x * 100) / 100), fast (core/math.js)
const f1 = fmt1;   // = String(Math.round(x * 10) / 10), fast (core/math.js)
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrap = (x, m) => ((x % m) + m) % m;
const D2R = Math.PI / 180;
const rot = ([x, y], a) => { const c = Math.cos(a * D2R), s = Math.sin(a * D2R); return [x * c - y * s, x * s + y * c]; };
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const circ = (x, y, r) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
const ell = (x, y, rx, ry) => `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
const rect = (x, y, w, hh) => `M${f(x)} ${f(y)}h${f(w)}v${f(hh)}h${f(-w)}Z`;
const poly = pts => 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + 'Z';
const line = pts => 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L');
function smooth(pts, closed = true, k = 1 / 6) {
  const n = pts.length, g = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    d += `C${f(p1[0] + (p2[0] - p0[0]) * k)} ${f(p1[1] + (p2[1] - p0[1]) * k)} ${f(p2[0] - (p3[0] - p1[0]) * k)} ${f(p2[1] - (p3[1] - p1[1]) * k)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + (closed ? 'Z' : '');
}
const F = (d, fill, o = {}) => h('path', { d, fill, ...o });
const S = (d, stroke, w, o = {}) => h('path', { d, fill: 'none', stroke, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...o });
const G = (o, ...k) => h('g', o, ...k);
const smooth01 = x => { const u = clamp(x, 0, 1); return u * u * (3 - 2 * u); };

// ---- glyph outlines (DejaVu Sans Bold / WenQuanYi Zen Hei, em 100, baseline y = 0) -> path d
function xfD(d, s, dx, dy) { let i = 0; return d.replace(/-?\d+(?:\.\d+)?/g, m => f1(i++ % 2 === 0 ? +m * s + dx : +m * s + dy)); }
function gtext(str, x, y, size, { track = 0, anchor = 'start', sx = 1 } = {}) {
  const GL = GLM;
  const k = size / 100; let w = 0;
  for (const ch of str) w += ch === ' ' ? 30 * k * sx + track : (GL[ch] ? GL[ch][1] * k * sx + track : 0);
  w -= track;
  let pen = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x, d = '';
  for (const ch of str) {
    if (ch === ' ') { pen += 30 * k * sx + track; continue; }
    const g = GL[ch]; if (!g) continue;
    d += sx === 1 ? xfD(g[0], k, pen, y) : xfD2(g[0], k * sx, k, pen, y);
    pen += g[1] * k * sx + track;
  }
  return { d, w };
}
function xfD2(d, kx, ky, dx, dy) { let i = 0; return d.replace(/-?\d+(?:\.\d+)?/g, m => f1(i++ % 2 === 0 ? +m * kx + dx : +m * ky + dy)); }

// ---- stroke-built art-deco capitals (from the draft's title lettering; monoline strokes in a 100-high box,
// clipped flush to cap and base lines). Extended with K, M, 2 and lowercase k, m for the road sign.
const LET = {
  P: { w: 76, s: [['M12 112V12H40A24 23 0 0 1 40 58H12', 24]] },
  E: { w: 64, s: [['M64 12H12V88H64', 24], ['M12 50H56', 22]] },
  L: { w: 60, s: [['M12 -10V88H60', 24]] },
  I: { w: 24, s: [['M12 -10V110', 24]] },
  C: { w: 76, s: [['M76 12H46A34 38 0 0 0 12 50A34 38 0 0 0 46 88H76', 24]] },
  A: { w: 90, s: [['M10 118L45 -14L80 118', 24], ['M20 76H70', 18]] },
  N: { w: 82, s: [['M12 112V-2L70 102V-12', 24]] },
  B: { w: 78, s: [['M12 -10V110', 24], ['M12 12H42A20 19 0 0 1 42 50H12', 24], ['M12 50H44A22 19 0 0 1 44 88H12', 24]] },
  Y: { w: 84, s: [['M2 -14L42 54L82 -14', 24], ['M42 50V112', 24]] },
  2: { w: 70, s: [['M8 34A29 27 0 1 1 56 56L14 90H74', 22]] },
  k: { w: 64, s: [['M12 -10V110', 22], ['M62 32L20 70', 20], ['M34 58L66 110', 22]] },
  m: { w: 96, s: [['M12 110V32', 20], ['M12 58A18 20 0 0 1 48 58V110', 20], ['M48 58A18 20 0 0 1 84 58V110', 20]] },
};
let clipN = 0;
function deco(str, x, y, hgt, color, { gap = 13, shadow, sd = 6, anchor = 'start' } = {}) {
  let pen = 0; const parts = [];
  for (const ch of str) { if (ch === ' ') { pen += 40; continue; } const L = LET[ch]; if (!L) continue; parts.push({ L, x: pen }); pen += L.w + gap; }
  const w = pen - gap, s = hgt / 100, cid = 'land-dclip' + (clipN++);
  const x0 = anchor === 'middle' ? x - w * s / 2 : anchor === 'end' ? x - w * s : x;
  const glyphs = parts.map(({ L, x: px }) => L.s.map(([d, sw]) => `<path transform="translate(${px} 0)" d="${d}" stroke-width="${sw}"/>`).join('')).join('');
  const lay = (dx, c) => `<g transform="translate(${dx} ${dx})"><g clip-path="url(#${cid})" fill="none" stroke="${c}" stroke-miterlimit="12">${glyphs}</g></g>`;
  const g = `<clipPath id="${cid}"><rect x="-20" y="0" width="${f(w + 40)}" height="100"/></clipPath>` + (shadow ? lay(sd, shadow) : '') + lay(0, color);
  return { svg: `<g transform="translate(${f(x0)} ${f(y - hgt)}) scale(${f(s)})">${g}</g>`, w: w * s };
}

// ---- halftone: a static hex-grid dot <pattern> whose width divides the tile width (seamless across copies).
// rOf(y) gives the dot radius for the row at y (quantised to quarter units).
function htPattern(pid, W, pitch, y0, y1, rOf, ink, bg) {
  // tile = k columns wide (≈48 u) and exactly the band tall (rows start at y0), optional background ink baked in
  const m = Math.max(1, Math.round(W / 48)), tw = W / m, k = Math.max(1, Math.round(tw / pitch)), sp = tw / k, dy = sp * 0.866;
  const rows = Math.floor((y1 - y0) / dy + 0.01) + 1, th = rows * dy;
  let d = '';
  for (let j = 0; j < rows; j++) {
    const y = j * dy, r = Math.round(rOf(y0 + y) * 4) / 4; if (r < 0.3) continue;
    for (let c = -1; c <= k; c++) { const x = c * sp + (j % 2 ? sp / 2 : 0); if (x + r < 0 || x - r > tw) continue; d += circ(x, y + dy / 2, r); }
  }
  return h('pattern', { id: pid, x: 0, y: f(y0 - dy / 2), width: tw.toFixed(5), height: f(th), patternUnits: 'userSpaceOnUse' }, bg ? F(rect(0, 0, tw, th), bg) : '', F(d, ink));
}

// ---------------------------------------------------------------------------------------------- detail inventory
// [kind, name, what]. Repeated identical instances are tagged ONCE (one compact specimen in the hero frame, left or
// right of the rider); continuous bands tag one clear specimen segment; textures are nested inside their object.
const ITEMS = [
  // shore (L-shore, depth 0.6)
  ['O', 'surf-foam', 'scalloped P foam edge where the last sea band breaks on the sand'],
  ['T', 'tideline-hatch', 'B water-edge wave line + wet-sand dash hatching'],
  ['T', 'sand-halftone', 'K halftone on the P sand, dots growing toward the promenade'],
  ['O', 'hut-open-door', 'R/P striped beach hut, door swung open onto a dark interior with a towel on a hook'],
  ['O', 'hut-plain', 'T/P striped hut with a closed arched door, handle and plank lines'],
  ['O', 'hut-towel-line', 'O/P hut with a washing line to a post: three towels flapping in the breeze'],
  ['O', 'hut-roof-finials', 'N gable roofs with P barge boards, scalloped eaves, ball finials and a pennant'],
  ['O', 'hut-number-plates', 'P roundels with N numerals 3·4·5 on the gables'],
  ['O', 'surfboard', 'T surfboard with R stringer leaning between two huts'],
  ['O', 'bunting', 'R/O/T/P pennant bunting strung between the hut gables'],
  ['O', 'parasol-orange', 'O/P scalloped parasol: ribs, tassels, finial, cast shadow'],
  ['O', 'parasol-teal', 'T/P parasol tilted into the wind (second variant)'],
  ['O', 'deckchair-red', 'R/P striped sling deck chair on a N frame'],
  ['O', 'deckchair-blue', 'pair of B/P deck chairs facing the sea (second variant)'],
  ['O', 'sandcastle', 'K/O sandcastle: towers, crenellations, arched gate, windows, moat, R pennant'],
  ['O', 'bucket-spade', 'R pail with P rim and handle; T spade stuck in the sand'],
  ['O', 'beach-ball', 'R/P/T/O segmented beach ball with its shadow'],
  ['O', 'crab', 'R crab with raised pincers and stalk eyes, scuttling sideways'],
  ['T', 'footprints', 'a trail of three-toed webbed pelican footprints on the wet sand'],
  ['O', 'starfish', 'O starfish with an R centre'],
  ['O', 'shells', 'K scallop shells with O rib lines'],
  ['O', 'lifeguard-tower', 'stilted lifeguard tower: N legs + cross bracing, ladder, deck rail, P cabin with window, R roof'],
  ['O', 'lifeguard-cross-flag', 'R/P cross panel and a fluttering R flag on the tower'],
  ['O', 'life-ring', 'O/P life ring hung on the tower'],
  ['O', 'rocks', 'N/B tideline rocks with P rim highlights'],
  ['T', 'rock-halftone', 'N halftone shading in the rock hollows'],
  ['O', 'seaweed', 'T bladderwrack fronds draped over the rocks'],
  ['O', 'sandpipers', 'three N sandpipers on stick legs working the tideline'],
  ['O', 'driftwood', 'B driftwood log with knots and P grain'],
  ['O', 'kite', 'R/P diamond kite with a bow tail, its string running down to a peg on the beach'],
  // roadside (L-roadside, depth 0.9)
  ['O', 'balustrade', 'deco seafront balustrade: P cap rail, N shadow line, bottle balusters (beach seen between)'],
  ['O', 'balustrade-piers', 'square piers every 212 u: stepped P caps, ball finials, recessed panels'],
  ['T', 'plinth-halftone', 'N halftone on the balustrade plinth'],
  ['O', 'pavement', 'promenade pavement with a N edge and slab joints'],
  ['O', 'lamp-post', 'art-deco lamp post: stepped plinth, fluted shaft, collars, scroll bracket, globe lantern'],
  ['O', 'lamp-flower-basket', 'hanging flower basket on the first lamp'],
  ['O', 'lamp-banner', 'R/P sun banner on the second lamp'],
  ['O', 'palm-tall', 'tall leaning palm: tapered trunk, notched crescent fronds'],
  ['O', 'palm-medium', 'shorter palm leaning over the sign'],
  ['T', 'palm-trunk-rings', 'T crescent ring scars up the palm trunk'],
  ['O', 'coconuts', 'O coconut clusters under the crowns'],
  ['O', 'signpost', 'deco arrow sign on twin N posts with a P inline border and drop shadow'],
  ['O', 'sign-lettering-cn', '鹈鹕湾 on the sign (glyph paths)'],
  ['O', 'sign-lettering-latin', 'PELICAN BAY in stroke-built deco capitals'],
  ['O', 'sign-distance', '"2 km" roundel in deco numerals on the arrow'],
  ['O', 'fish-stand', 'timber fish stand: counter with plank lines, posts, top rail'],
  ['O', 'fish-awning', 'R/P striped awning with scalloped valance and bulb sockets'],
  ['O', 'hanging-fish', 'row of B/P fish hung on hooks under the awning, swaying'],
  ['O', 'fish-counter', 'P ice tray with B fish heads and O lemons'],
  ['O', 'fish-sign', '鲜鱼 FRESH FISH sign board on the awning (glyph paths)'],
  ['O', 'fish-crates', 'stacked O crates with slats, the top one full of fish'],
  ['O', 'fish-scale', 'hanging balance scale with K pans'],
  ['O', 'price-board', 'T chalk price board with P price lines on the counter'],
  ['O', 'bus-shelter', 'open streamline-moderne bus shelter: T rounded canopy with speed lines, posts, bench'],
  ['O', 'bus-stop-sign', 'R/P roundel BUS · 巴士 · 站 on a pole'],
  ['O', 'bus-timetable', 'P timetable panel with header and rows'],
  ['O', 'litter-bin', 'T litter bin with bands and lid'],
  ['O', 'poster-wall', 'P plaster end wall of the shelter with R tiled coping'],
  ['O', 'vintage-poster', 'a tiny travel poster on the wall: sun rays, sea, pelican, PELICAN BAY 鹈鹕湾'],
  ['O', 'mailbox', 'R pillar box with dome cap, N slot and rim light'],
  ['O', 'mailbox-lettering', '邮 POST on the pillar-box plate'],
  ['O', 'bench', 'T slatted bench with N cast-iron scroll ends'],
  ['O', 'cat', 'ginger O cat with N stripes sitting on the bench, tail flicking (looks up at the bell)'],
  ['O', 'flower-bed', 'raised stone planter with T foliage and R/O flowers'],
  ['O', 'flower-bed-tulips', 'second planter: clipped T cushion with P/R tulips'],
  ['O', 'milestone', 'P milestone: 鹈鹕湾 2 KM'],
  ['O', 'hedge', 'clipped T hedge block with N base shadow'],
  ['T', 'hedge-texture', 'N leaf-scallop texture on the hedge'],
  ['O', 'telescope', 'coin-op seafront telescope on a pedestal'],
  ['O', 'lamp-glow', 'night: lamp globes glow in 3 hard rings (quantised radial gradient)'],
  ['O', 'pavement-pool', 'night: quantised light pools on the pavement under the lamps'],
  // road (L-road, depth 1)
  ['O', 'kerbstones', 'P kerbstones with N shadow lip and joints'],
  ['O', 'gutter-drain', 'N gully grate in the gutter'],
  ['O', 'edge-line', 'solid P road edge line'],
  ['O', 'centre-dashes', 'P centre dashes every 157.08 u (12 per road tile)'],
  ['O', 'cats-eyes', 'road studs between the dashes'],
  ['T', 'asphalt-halftone', 'O halftone asphalt grading (+ seeded aggregate speckle)'],
  ['O', 'manhole', 'N manhole cover with P rim'],
  ['T', 'manhole-pattern', 'deco sunburst relief on the manhole cover'],
  ['O', 'bike-lane-symbol', 'painted P bicycle pictogram in the lane'],
  ['O', 'bike-lane-arrow', 'painted P arrow ahead of the bicycle symbol'],
  ['O', 'tar-patch', 'patched asphalt: dense O halftone with N tar seams'],
  ['O', 'road-crack', 'N crack in the asphalt'],
  ['O', 'road-pool', 'night: quantised lamp pools on the road, tracking the lamps'],
  // foreground (L-foreground, depth 1.3)
  ['O', 'fg-bushes', 'low T coastal shrub mounds'],
  ['T', 'bush-halftone', 'N halftone on the bush undersides'],
  ['O', 'fg-grass-navy', 'N dune-grass fans'],
  ['O', 'fg-grass-teal', 'T grass tufts'],
  ['O', 'fg-poppies', 'R poppies with N centres on N stems'],
  ['O', 'fg-marigolds', 'O marigolds with R centres'],
  ['O', 'fg-rocks', 'B rocks with P rims in the verge'],
  ['O', 'fg-dandelions', 'P dandelion clocks'],
  ['O', 'fg-agave', 'T agave rosette'],
];
export const detailItems = ITEMS.map(([kind, name, what]) => ({ id: 'land:' + kind + ':' + name, layer: 'land', kind, what }));
const KIND = Object.fromEntries(ITEMS.map(([k, n]) => [n, k]));
// Intended real-world size (metres; height unless noted) of the props. The seafront is poster-compressed: props on the
// 0.9 roadside are drawn at ~150 u/m, the 0.6 beach at ~75 u/m, the road markings at ~90 u/m (see report).
const SIZE_M = {
  'lamp-post': 4.5, 'palm-tall': 9, 'palm-medium': 6, 'bench': 0.9, 'bus-shelter': 2.6, 'bus-stop-sign': 2.5, 'mailbox': 1.6,
  'signpost': 2.6, 'fish-stand': 2.7, 'milestone': 0.8, 'telescope': 1.5, 'litter-bin': 0.9, 'flower-bed': 0.5, 'hedge': 0.9,
  'balustrade': 1.0, 'hut-open-door': 2.4, 'hut-plain': 2.4, 'hut-towel-line': 2.4, 'parasol-orange': 2.2, 'parasol-teal': 2.2,
  'deckchair-red': 0.9, 'deckchair-blue': 0.9, 'lifeguard-tower': 4.2, 'sandcastle': 0.4, 'centre-dashes': 3, 'kerbstones': 0.9,
  'bike-lane-symbol': 1.6, 'manhole': 0.7,
};
const DD = name => { if (!KIND[name]) throw new Error('land: untagged detail ' + name); return { 'data-detail': `land:${KIND[name]}:${name}`, 'data-size-m': SIZE_M[name] }; };

// ---------------------------------------------------------------------------------------------- geometry
const T0 = 3.2, D0 = T0 * DIST_PER_REV;           // hero frame = design coordinates
const LAY = {
  shore: { layer: 'L-shore', d: 0.6, W: TILE.shore },
  roadside: { layer: 'L-roadside', d: 0.9, W: TILE.roadside },
  road: { layer: 'L-road', d: 1, W: TILE.road },
  fg: { layer: 'L-foreground', d: 1.3, W: TILE.foreground },
};
for (const L of Object.values(LAY)) { L.x0 = 800 - L.W / 2; L.x1 = 800 + L.W / 2; }
const tileU = (D, L) => wrap((D - D0) * L.d + L.W / 2, L.W) - L.W / 2;
const LAMP_X = [300, 300 + TILE.roadside / 2];      // lamp posts every 848.23 u (TILE.roadside / 2)
const BASE = 752;                                    // roadside objects stand on the pavement here
const SPEC = [18, 432];                              // clear specimen span left of the rider in the hero frame
// Lamp x positions in the roadside layer's coordinates for a given distance (for fx rim-light / other modules).
export function lampPositions(distance, x0 = -500, x1 = 2100) {
  const u = tileU(distance, LAY.roadside), sp = TILE.roadside / 2, out = [];
  for (let x = x0 + wrap(LAMP_X[0] - u - x0, sp); x < x1; x += sp) out.push(x);
  return out;
}
// continuous band drawn as [X0,a] + tagged specimen [a,b] + [b,X1]
const band = (X0, X1, tag, fn, [a, b] = SPEC) => fn(X0, a) + G(tag, fn(a, b)) + fn(b, X1);

// Merge consecutive sibling <path>s that share exactly the same paint attributes (same z-order, same pixels): keeps
// the static tiles to a few hundred nodes.
function mergePaths(m) {
  const re = /<path d="([^"]*)"((?: [a-z-]+="[^"]*")*)\/><path d="([^"]*)"\2\/>/g;
  let prev;
  do { prev = m; m = m.replace(re, (all, a, attrs, b) => (/data-|class=|transform=|clip-path=/.test(attrs) ? all : `<path d="${a}${b}"${attrs}/>`)); } while (m !== prev);
  return m;
}

// Split long multi-subpath <path>s into ~220 u x-buckets: the rasteriser works per 256 px tile and culls by bounds,
// so compact pieces are far cheaper to paint than one path spanning the whole tile.
function chunkPaths(m, size = 220) {
  return m.replace(/<path d="([^"]*)"((?: [a-z-]+="[^"]*")*)\/>/g, (all, d, attrs) => {
    if (d.length < 400 || /transform=/.test(attrs)) return all;
    const subs = d.split(/(?=M)/); if (subs.length < 2) return all;
    const b = new Map();
    for (const sp of subs) { const x = parseFloat(sp.slice(1)); const k = Math.floor(x / size); b.set(k, (b.get(k) || '') + sp); }
    if (b.size < 2) return all;
    return [...b.values()].map(dd => `<path d="${dd}"${attrs}/>`).join('');
  });
}

// ---------------------------------------------------------------------------------------------- JOURNEY (route.js)
// The near layers are no longer one repeating tile. Each layer = (a) a BASE tile (continuous surfaces only: sand and
// tideline, balustrade + pavement + lamps, carriageway markings) tiled by 3 <use> copies; (b) the hand-composed hero
// village tile, shown once per lap at its design position; (c) a pooled STREAM of <use> props keyed by absolute prop
// index (seeded choice / flip / scale / ink swap per stretch of the route); (d) unique SET PIECES (the long pier, the
// harbour, the pleasure pier, the railway and its racing train, the lighthouse headland, the cliffs, the bridge, the
// fort and lido ...) that come round once per lap. Per frame: transforms only, plus href swaps when a slot recycles.
const GY = { shore: 696, roadside: 752, road: 0, fg: 900 };            // ground line of each layer's props (design y)
const STEP = { shore: 94, roadside: 178, road: 560, fg: 430 };      // stream pitch (layer units)
const POOL = { shore: 33, roadside: 19, road: 7, fg: 9 };            // pool slots (> max visible items)
const PARTS = { shore: 2, roadside: 4, road: 2, fg: 1 };             // <use> per slot
// ink-swap variants (CSS custom properties inherit into <use> shadow trees): the same prop printed in another ink
const SWAP = {
  RT: '--pb-inkR:var(--pb-inkT)', RB: '--pb-inkR:var(--pb-inkB)', RO: '--pb-inkR:var(--pb-inkO)',
  TR: '--pb-inkT:var(--pb-inkR)', TB: '--pb-inkT:var(--pb-inkB)', OT: '--pb-inkO:var(--pb-inkT)', OR: '--pb-inkO:var(--pb-inkR)',
  BR: '--pb-inkB:var(--pb-inkR)', BT: '--pb-inkB:var(--pb-inkT)',
};
// hero village elements reused by the stream (by id; they stay real DOM in the hero tile)
const REUSE = new Set(['sandcastle', 'bucket-spade', 'beach-ball', 'lifeguard-tower', 'lifeguard-cross-flag', 'life-ring', 'driftwood', 'starfish',
  'sandpipers', 'surfboard', 'fish-stand', 'fish-awning', 'fish-sign', 'fish-counter', 'fish-crates', 'fish-scale', 'price-board', 'bus-shelter',
  'bus-stop-sign', 'bus-timetable', 'litter-bin', 'poster-wall', 'mailbox', 'bench', 'cat', 'flower-bed', 'flower-bed-tulips', 'telescope',
  'manhole', 'bike-lane-symbol', 'bike-lane-arrow', 'tar-patch', 'road-crack', 'gutter-drain']);
const RID = o => { const n = o && o['data-detail'] && o['data-detail'].split(':')[2]; return n && REUSE.has(n) ? { ...o, id: 'land-v-' + n } : o; };

// Stream tables per layer and stretch: [kind, weight]; '' = gap. W:<kind> marks wide props (take a whole 3-slot block).
const TABLE = {
  roadside: {
    village: [['v-fish', 1.2, 'W'], ['v-bus', 1, 'W'], ['v-bench', 2], ['mailbox', 1], ['flowers', 1.4], ['tulips', 1.2], ['telescope', 1], ['hedge', 1.4], ['icecart', 1.3], ['palm', 1.2], ['', 1.35]],
    pier: [['bench', 1.5], ['telescope', 1.4], ['hedge', 1], ['palm', 1.2], ['icecart', 0.8], ['flowers', 0.6], ['', 1.8]],
    harbour: [['bollards', 2], ['pots', 1.6], ['anchor', 0.9], ['crates', 1.4], ['v-fish', 0.7, 'W'], ['mailbox', 0.5], ['', 1.35]],
    funfair: [['icecart', 2], ['palm', 1.6], ['v-bench', 1], ['flowers', 1], ['tulips', 0.8], ['telescope', 0.6], ['', 1.35]],
    railway: [['crossbuck', 0.5], ['cypress', 1.3], ['outcrop', 1], ['hedge', 1], ['bench', 0.4], ['', 1.8]],
    lighthouse: [['outcrop', 2], ['cypress', 1], ['telescope', 0.8], ['bench', 0.6], ['', 1.8]],
    cliffs: [['outcrop', 2.4], ['pine', 1], ['cypress', 0.6], ['', 1.8]],
    dunes: [['palm', 2.4], ['outcrop', 0.8], ['icecart', 0.5], ['', 1.57]],
    bridge: [['bollards', 0.6], ['hedge', 0.6], ['', 2.7]],
    fort: [['cypress', 2], ['palm', 0.8], ['bench', 1], ['flowers', 0.8], ['telescope', 0.8], ['', 1.35]],
    pines: [['pine', 2.4], ['cypress', 2.2], ['bench', 0.6], ['outcrop', 0.5], ['', 0.9]],
    return: [['palm', 1.4], ['v-bench', 1.4], ['flowers', 1.4], ['tulips', 1], ['mailbox', 0.8], ['icecart', 1], ['hedge', 1], ['v-bus', 0.6, 'W'], ['', 1.35]],
  },
  shore: {
    village: [['hut', 3], ['parasol', 2.4], ['deck', 1.6], ['castle', 0.7], ['bucket', 0.6], ['ball', 0.6], ['lifeguard', 0.5], ['rocks', 0.8], ['drift', 0.4], ['', 0.9]],
    pier: [['parasol', 1.2], ['deck', 0.8], ['rocks', 1], ['boat', 1], ['sandpipers', 0.6], ['', 1.35]],
    harbour: [['boat', 1], ['', 1.35]],
    funfair: [['parasol', 1], ['hut', 0.8], ['', 1.35]],
    railway: [['', 0.6]],
    lighthouse: [['rocks', 2.2], ['stack', 0.8], ['', 0.9]],
    cliffs: [['stack', 1.6], ['rocks', 2], ['', 0.9]],
    dunes: [['dune', 3], ['fence', 1.6], ['spalm', 1.4], ['drift', 0.5], ['parasol', 0.5], ['sandpipers', 0.6], ['', 0.68]],
    bridge: [['dune', 1], ['rocks', 1], ['', 1.35]],
    fort: [['rocks', 1.5], ['parasol', 1], ['deck', 0.8], ['', 1.35]],
    pines: [['scypress', 2], ['dune', 1.4], ['rocks', 1], ['boat', 0.6], ['', 0.9]],
    return: [['hut', 3], ['parasol', 2], ['deck', 1.4], ['lifeguard', 0.5], ['castle', 0.5], ['ball', 0.5], ['', 0.9]],
  },
  road: {
    village: [['manhole', 1], ['bikelane', 1], ['tarpatch', 0.8], ['crack', 0.6], ['drain', 0.8], ['', 0.68]],
    _: [['manhole', 0.6], ['tarpatch', 0.8], ['crack', 1], ['drain', 0.6], ['slow', 0.35], ['', 1.08]],
    dunes: [['sand', 2], ['crack', 0.5], ['', 0.68]],
    bridge: [['joint', 3], ['', 0.6]],
    cliffs: [['slow', 0.8], ['crack', 1.2], ['tarpatch', 0.8], ['', 0.68]],
  },
  fg: {
    _: [['tuft', 1], ['', 1.12]],
    dunes: [['tuft', 2.4], ['post', 1], ['', 0.6]],
    bridge: [['reeds', 3], ['', 0.6]],
    cliffs: [['post', 1.6], ['tuft', 1], ['', 0.68]],
    lighthouse: [['post', 1.2], ['', 0.9]],
    pines: [['tuft', 1.2], ['', 0.68]],
  },
};
// where each set piece stands: lap position (road u) at which its local x = 0 passes the rider
const SP_AT = {
  statue: 0.62 * KM, crossing: 1.05 * KM, pier: 1.95 * KM, harbour: 4.1 * KM, funfair: 6.15 * KM, railway: 7.5 * KM,
  lighthouse: 11.8 * KM, arch: 13.9 * KM, cliffs: 14.5 * KM, bottle: 16.6 * KM, bridge: 18.7 * KM, fort: 20.3 * KM, welcome: 24.35 * KM,
};

function journeyArt(ctx) {
  const { v } = ctx;
  const I = k => v('ink' + k);
  const P = I('P'), K = I('K'), O = I('O'), R = I('R'), B = I('B'), T = I('T'), N = I('N');
  const R0 = ctx.rng('land-journey');
  let defs = '';
  const sym = (id, gy, m) => { defs += G({ id: 'land-y-' + id, transform: gy ? `translate(0 ${gy})` : undefined }, m); };
  const txt = (s, x, y, size, o) => gtext(s, x, y, size, o).d;
  // ---------------------------------------------------------------- roadside symbols (ground y = 0)
  // km stone: dome-topped P stone, R band, 鹈鹕湾 engraved; the number is two digit <use>s written per stone
  sym('kmstone', GY.roadside, F(rect(-24, -6, 48, 6), N) + F('M-20 -6V-50a20 20 0 0 1 40 0V-6Z', P) + F('M11 -6V-66.5a20 20 0 0 1 9 16.5V-6Z', K) +
    F(rect(-20, -53, 40, 5), R) + S('M-20 -6V-50a20 20 0 0 1 40 0V-6', N, 1.1) + F(txt('鹈鹕湾', 0, -56.5, 9.6, { anchor: 'middle' }), N) +
    F(txt('KM', 0, -9.5, 6.6, { anchor: 'middle', track: 0.6 }), R) + S('M-15 -29h30', K, 0.8));
  for (let dgt = 0; dgt <= 9; dgt++) sym('dg' + dgt, 0, F(txt(String(dgt), 0, 0, 21), N));
  // direction signs: one face per stretch (T arrow board, P inline, 中文 + deco English + R roundel with the km)
  const LANDMARK_KM = { village: 0, pier: 2, harbour: 4, funfair: 6, railway: 8, lighthouse: 12, cliffs: 14, dunes: 16, bridge: 19, fort: 20, pines: 22, return: 26 };
  const board = (dx, dy) => poly([[-106 + dx, -222 + dy], [76 + dx, -222 + dy], [108 + dx, -187 + dy], [76 + dx, -152 + dy], [-106 + dx, -152 + dy]]);
  const signBase = F(rect(-88, -156, 7, 156) + rect(62, -156, 7, 156), N) + F(board(5, 5), N) + F(board(0, 0), T) +
    S(poly([[-100, -216], [73, -216], [100, -187], [73, -158], [-100, -158]]), P, 1.5) + F(circ(-84.5, -160, 2) + circ(65.5, -160, 2), P);
  sym('signpost', GY.roadside, signBase);
  STRETCHES.forEach(st => {
    const km = LANDMARK_KM[st.key];
    const en = st.en.length > 15 ? 7.2 : 8.6;
    sym('sign' + st.i, GY.roadside, F(txt(st.en, -94, -166, en, { track: 0.5 }), K) + F(circ(55, -187, 17.5), R) + S(ell(55, -187, 14.6, 14.6), P, 0.8) +
      F(txt(st.cn, -94, -185, st.cn.length > 3 ? 23 : 26, { track: 1 }) + txt(String(km), 55, -186, km > 9 ? 12.5 : 15, { anchor: 'middle' }) + txt('KM', 55, -176.5, 5.4, { anchor: 'middle', track: 0.4 }), P));
  });
  // cypress: a flame of foliage with scallop texture and a paper rim light
  {
    const H = 236, body = `M0 0C-19 -${H * 0.22} -17 -${H * 0.72} 0 -${H}C17 -${H * 0.72} 19 -${H * 0.22} 0 0Z`;
    let sc = ''; for (let r = 0; r < 15; r++) { const y = -18 - r * 14.4, w = 15.5 * Math.sin(Math.PI * Math.min(0.97, (-y) / H * 1.05)) * (1 - (-y) / H * 0.45); for (let x = -w + 4 + (r % 2) * 3.5; x < w - 3; x += 7) sc += `M${f(x - 3)} ${f(y)}q3 3.4 6 0`; }
    sym('cypress', GY.roadside, F(rect(-2.4, -12, 4.8, 12), N) + F(body, T) + F(`M0 0C12 -${H * 0.2} 15 -${H * 0.7} 0 -${H}C8 -${H * 0.7} 6 -${H * 0.25} 0 0Z`, N) + S(sc, N, 1.1) +
      S(`M-9 -${H * 0.3}C-13 -${H * 0.55} -9 -${H * 0.8} -2 -${H * 0.94}`, P, 1.6));
  }
  // umbrella pine: leaning trunk, flat two-tier canopy with a N underside, P rim and dark halftone
  {
    let g = F('M-6 0C-8 -70 2 -140 22 -196L31 -193C14 -138 6 -70 7 0Z', N) + S('M8 -120q-22 -24 -40 -34M16 -160q18 -16 34 -18', N, 3.2);
    const lobes = [[-40, -206, 44, 15], [4, -214, 50, 17], [52, -206, 48, 15], [94, -198, 30, 11], [-72, -196, 26, 10], [20, -232, 34, 12], [-18, -226, 26, 10]];
    g += F(lobes.map(([x, y, rx, ry]) => ell(x, y, rx, ry)).join(''), T);
    g += F(lobes.map(([x, y, rx, ry]) => `M${f(x - rx * 0.92)} ${f(y + ry * 0.2)}q${f(rx * 0.92)} ${f(ry * 0.95)} ${f(rx * 1.84)} 0q${f(-rx * 0.92)} ${f(ry * 0.4)} ${f(-rx * 1.84)} 0z`).join(''), N);
    g += S(lobes.map(([x, y, rx, ry]) => `M${f(x - rx * 0.5)} ${f(y - ry * 0.75)}q${f(rx * 0.45)} ${f(-ry * 0.4)} ${f(rx * 0.9)} 0`).join(''), P, 1.4);
    let dt = ''; for (const [x, y, rx] of lobes) for (let k = -2; k <= 2; k++) dt += circ(x + k * rx * 0.3, y + 4, 1.1);
    sym('pine', GY.roadside, g + F(dt, N));
  }
  // palm (static): tapered curved trunk with ring scars, notched crescent fronds, coconuts
  {
    const top = [34, -262]; let trunk = '', rings = '';
    const pt = u => [34 * u * u, -262 * u], wd = u => 7.5 - 3.8 * u;
    const L = [], Rr = [];
    for (let i = 0; i <= 20; i++) { const u = i / 20, [x, y] = pt(u); L.push([x - wd(u), y]); Rr.push([x + wd(u), y]); if (i % 1 === 0 && i > 0 && i < 20) rings += `M${f(x - wd(u))} ${f(y)}q${f(wd(u))} 3.2 ${f(wd(u) * 2)} 0`; }
    trunk = poly([...L, ...Rr.reverse()]);
    const frond = (ang, len, droop, ink) => {
      const a = ang * D2R, tip = [top[0] + Math.cos(a) * len, top[1] + Math.sin(a) * len + droop], mid = [top[0] + Math.cos(a) * len * 0.5, top[1] + Math.sin(a) * len * 0.5 - len * 0.18];
      const nx = -Math.sin(a), ny = Math.cos(a), w = len * 0.13;
      let d = `M${f(top[0])} ${f(top[1])}Q${f(mid[0] - nx * w)} ${f(mid[1] - ny * w - w)} ${f(tip[0])} ${f(tip[1])}Q${f(mid[0] + nx * w * 0.3)} ${f(mid[1] + ny * w * 0.3 + w * 0.4)} ${f(top[0])} ${f(top[1])}Z`;
      let notch = ''; for (let k = 1; k < 6; k++) { const u = k / 6, q = [lerp(top[0], tip[0], u) + (mid[0] - (top[0] + tip[0]) / 2) * 2 * u * (1 - u) * 2, lerp(top[1], tip[1], u) + (mid[1] - (top[1] + tip[1]) / 2) * 2 * u * (1 - u) * 2]; notch += `M${f(q[0])} ${f(q[1])}l${f(nx * w * 0.9 + Math.cos(a) * 5)} ${f(ny * w * 0.9 + 5)}`; }
      return [d, notch, ink];
    };
    const fr = [[-170, 96, 26, N], [-20, 100, 30, N], [-140, 108, 40, T], [-95, 86, -4, T], [-60, 104, 16, T], [-5, 112, 44, T], [160, 70, 50, T], [30, 90, 58, T]].map(([a, l, d, ink]) => frond(a, l, d, ink));
    let g = F(trunk, N) + S(rings, T, 1.2);
    g += F(fr.filter(e => e[2] === N).map(e => e[0]).join(''), N) + F(fr.filter(e => e[2] === T).map(e => e[0]).join(''), T) + S(fr.map(e => e[1]).join(''), N, 1.3);
    g += F(circ(top[0] - 5, top[1] + 8, 5) + circ(top[0] + 4, top[1] + 10, 5) + circ(top[0] - 1, top[1] + 15, 4.6), O) + S(`M${top[0] - 8} ${top[1] + 5}a4 4 0 0 1 4 -3`, P, 1);
    sym('palm', GY.roadside, g);
    sym('spalm', GY.shore, G({ transform: 'scale(0.42)' }, g));
    sym('scypress', GY.shore, G({ transform: 'scale(0.42)' }, `<use href="#land-y-cypress" transform="translate(0 -${GY.roadside})"/>`));
  }
  // ice-cream cart with a scalloped parasol
  {
    let g = S('M0 -54V-122', N, 2) + F(rect(-36, -54, 72, 40), P) + F(rect(-28, -54, 8, 40) + rect(-8, -54, 8, 40) + rect(12, -54, 8, 40), R) + F(rect(-38, -58, 76, 5), N);
    g += F(rect(-18, -46, 36, 13), P) + F(txt('ICES', 0, -35.5, 10.5, { anchor: 'middle', track: 0.6 }), R) + S('M36 -40L56 -28M53 -31l4 -5', N, 2.2);
    g += F(circ(-22, -11, 11) + circ(22, -11, 11), N) + S(ell(-22, -11, 7, 7) + ell(22, -11, 7, 7), P, 1.1) + F(circ(-22, -11, 2) + circ(22, -11, 2), O);
    let can = ''; for (let i = 0; i < 6; i++) { const a0 = -180 + i * 30, p0 = rot([46, 0], a0), p1 = rot([46, 0], a0 + 30); can += F(`M0 -134L${f(p0[0])} ${f(-104 + p0[1] * 0.12)}Q${f((p0[0] + p1[0]) / 2)} ${f(-96 + (p0[1] + p1[1]) * 0.06)} ${f(p1[0])} ${f(-104 + p1[1] * 0.12)}Z`, i % 2 ? P : O); }
    g += can + F(circ(0, -136, 3), N) + F('M-5 -60l5 -14l5 14z', K) + F(circ(0, -76, 5.5), P) + F(circ(-2.2, -78, 1.4), R);
    sym('icecart', GY.roadside, g);
  }
  // harbour furniture: twin bollards with a chain, lobster-pot stack, anchor, fish crates
  sym('bollards', GY.roadside, F('M-40 0V-20q0 -5 5 -6h10q5 1 5 6V0ZM24 0V-20q0 -5 5 -6h10q5 1 5 6V0Z', N) + F(ell(-30, -27, 12, 4.2) + ell(34, -27, 12, 4.2), N) +
    S('M-36 -22v18M28 -22v18', P, 1.2) + S('M-22 -18Q2 -2 26 -18', N, 2.2) + S('M-22 -18Q2 -2 26 -18', O, 0.8, { 'stroke-dasharray': '2 3' }));
  {
    let g = '', w = '';
    for (const [x, y, s] of [[-26, 0, 1], [8, 0, 1], [-10, -24, 0.95]]) { g += F(`M${x - 16 * s} ${y}V${y - 10 * s}a${16 * s} ${14 * s} 0 0 1 ${32 * s} 0V${y}Z`, B); w += `M${x - 16 * s} ${y - 3}h${32 * s}M${x - 9 * s} ${y}V${y - 20 * s}M${x} ${y}V${y - 24 * s}M${x + 9 * s} ${y}V${y - 20 * s}M${x - 15 * s} ${y - 12 * s}h${30 * s}`; }
    sym('pots', GY.roadside, g + S(w, N, 1.1) + F(circ(34, -8, 7), O) + F(rect(33, -22, 2, 8), N) + F(rect(27, -9, 14, 2.6), P));
  }
  sym('anchor', GY.roadside, G({ transform: 'rotate(-14)' }, F(rect(-3, -76, 6, 70) + rect(-18, -70, 36, 5), N) + S('M-30 -24Q-30 -2 0 -2Q30 -2 30 -24', N, 6) +
    F('M-36 -28l12 -2l-6 10zM36 -28l-12 -2l6 10z', N) + S(ell(0, -84, 7, 7), N, 3.4) + S('M0 -76q16 20 4 50', O, 1.4)));
  sym('crates', GY.roadside, F(rect(-34, -26, 34, 26) + rect(2, -26, 34, 26) + rect(-16, -50, 34, 24), O) + S('M-34 -13h34M2 -13h34M-16 -38h34M-17 -26v26M19 -26v26M1 -50v24', N, 1.1) +
    F(`M-12 -50q6 -8 12 0zM2 -50q6 -9 12 0z`, B) + F(circ(-8, -51, 1.1) + circ(6, -52, 1.1), P));
  // railway crossbuck + a signal
  sym('crossbuck', GY.roadside, F(rect(-3, -168, 6, 168), N) + G({ transform: 'translate(0 -150)' },
    `<g transform="rotate(34)">${F(rect(-52, -7, 104, 14), P)}${S(rect(-50, -5, 100, 10), R, 1.6)}</g><g transform="rotate(-34)">${F(rect(-52, -7, 104, 14), P)}${S(rect(-50, -5, 100, 10), R, 1.6)}</g>` + F(circ(0, 0, 3.4), N)) +
    F(rect(-22, -108, 44, 20), N) + F(circ(-11, -98, 6.4), R) + F(circ(11, -98, 6.4), B) + S(ell(-11, -98, 8.4, 8.4) + ell(11, -98, 8.4, 8.4), P, 0.8));
  // rocky outcrop with an agave
  {
    let ag = ''; for (let i = 0; i < 9; i++) { const a = -160 + i * 17.5, len = 30 + (i % 2) * 9 - Math.abs(i - 4) * 2, tip = rot([len, 0], a), l = rot([7, 0], a - 90), r2 = rot([7, 0], a + 90); ag += `M${f(28 + l[0])} ${f(-26 + l[1])}L${f(28 + tip[0])} ${f(-26 + tip[1])}L${f(28 + r2[0])} ${f(-26 + r2[1])}Z`; }
    sym('outcrop', GY.roadside, F('M-58 0L-50 -30Q-40 -52 -14 -50Q6 -64 26 -40Q46 -36 50 -12L56 0Z', B) + F('M10 -44Q30 -40 46 -26Q50 -14 56 0H16Q24 -22 10 -44Z', N) +
      S('M-44 -34q14 -12 28 -12M-6 -54q12 -2 22 8', P, 1.4) + S('M-36 -18h18M-10 -26h14M-30 -8h24', N, 1) + F(ag, T) + S('M-60 0H60', N, 2));
  }
  // ---------------------------------------------------------------- shore symbols (ground y = 0 = 696)
  {
    let gr = ''; for (let i = 0; i < 26; i++) { const x = -70 + i * 5.6 + R0() * 3, y = -34 + Math.abs(x) * 0.28 + R0() * 4, h2 = 9 + R0() * 9; gr += `M${f(x)} ${f(y + 3)}q${f(-2 - R0() * 3)} ${f(-h2 * 0.6)} ${f(-4 - R0() * 5)} ${f(-h2)}M${f(x)} ${f(y + 3)}q${f(1 + R0() * 2)} ${f(-h2 * 0.7)} ${f(3 + R0() * 4)} ${f(-h2 * 1.1)}`; }
    sym('dune', GY.shore, F('M-120 4Q-72 -30 -14 -38Q46 -44 120 4Z', v('sand')) + F('M-120 4Q-72 -30 -14 -38Q46 -44 120 4Z', 'url(#land-htSand)') + F('M10 -40Q60 -36 120 4H40Q48 -18 10 -40Z', K) +
      S(gr, T, 1.3) + S('M-96 -6q30 -14 60 -16M-20 -24q30 -6 64 2', O, 0.9));
  }
  { let p = '', w = ''; for (let i = 0; i < 12; i++) { const x = -54 + i * 9.8; p += `M${f(x)} 2L${f(x + 1.6)} -18`; } w = 'M-56 -6Q0 -2 58 -8M-55 -13Q0 -9 58 -15';
    sym('fence', GY.shore, S(p, N, 1.8) + S(w, N, 0.6) + F('M-60 3Q0 -6 62 3Z', v('sand'))); }
  sym('boat', GY.shore, F('M-30 -2Q-28 -16 0 -17Q28 -16 30 -2Z', R) + F('M-28.5 -7Q0 -10 28.5 -7L29.4 -4Q0 -7 -29.4 -4Z', P) + S('M-24 -14Q0 -18 24 -14', N, 0.8) +
    F(ell(0, 0, 32, 2.4), v('seaFar')) + S('M-10 -17L-38 -5M8 -17L36 -3', v('trunk'), 1.6) + F(ell(-38, -5, 4, 1.6) + ell(36, -3, 4, 1.6), O));
  sym('stack', GY.shore, F('M-26 -34L-22 -104Q-18 -122 -4 -126Q14 -124 18 -106L24 -34Z', B) + F('M4 -125Q14 -124 18 -106L24 -34H6Q12 -80 4 -125Z', N) +
    S('M-22 -92q18 4 38 -2M-24 -70q20 5 42 -1M-25 -52q22 3 46 0', P, 0.8) + S('M-18 -112q8 -10 18 -12', P, 1.4) + F('M-30 -34q4 -6 10 -2q6 -6 12 0q6 -5 12 0q6 -6 12 0q5 -3 8 2z', P) +
    S('M-10 -116l3 -2l3 2M6 -98l3 -2l3 2', N, 0.8) + F('M-6 -128l6 -4l6 4l-3 1l-3 -1.6l-3 1.6z', P));
  // ---------------------------------------------------------------- road + foreground symbols (absolute design y)
  sym('slow', 0, G({ transform: 'translate(0 818) scale(1.7 0.44)' }, F(txt('慢', -58, 0, 46), v('roadLine')) + F(txt('SLOW', 2, -6, 30), v('roadLine'))));
  sym('sand', 0, F('M-150 776q30 -12 70 -8q30 -14 60 -4q40 -10 80 2q30 -4 90 6q-60 8 -140 6q-80 4 -160 -2z', v('sand')) + S('M-110 772q26 -6 50 -2M-10 770q40 -6 70 2', K, 1.4) + F('M-150 776q30 -12 70 -8q30 -14 60 -4q40 -10 80 2q30 -4 90 6q-60 8 -140 6q-80 4 -160 -2z', 'url(#land-htSand)', { opacity: 0.5 }));
  sym('joint', 0, F('M-3 761L3 761L-21 866L-27 866Z', v('trunk')) + S('M4 761L-20 866', v('roadLine'), 1.4) + S('M-5 775h7M-10 797h7M-15 819h7M-20 841h7', v('roadLine'), 1));
  {
    let st = '', ct = '';
    for (let i = 0; i < 9; i++) { const x = -60 + i * 15 + (i % 3) * 3, top = 770 + (i % 4) * 10; st += `M${x} 900Q${x - 4} ${(900 + top) / 2} ${x + (i % 2 ? 6 : -6)} ${top}`; if (i % 2 === 0) ct += `M${x + (i % 2 ? 6 : -6) - 3} ${top + 4}h6v18h-6z`; }
    let lv = ''; for (let i = 0; i < 6; i++) { const x = -52 + i * 22; lv += `M${x} 900q-18 -40 -30 -70q20 30 34 70z`; }
    sym('reeds', 0, F(lv, T) + S(st, N, 1.8) + F(ct, O));
  }
  { let t = ''; for (let i = 0; i < 13; i++) { const a = -150 + i * 10, tip = rot([56 + (i % 3) * 16, 0], a); t += `M0 902Q${f(tip[0] * 0.3)} ${f(902 + tip[1] * 0.6)} ${f(tip[0])} ${f(902 + tip[1])}`; }
    sym('tuft', 0, S(t, T, 3.2) + S(t.split('M').slice(1, 7).map(e => 'M' + e).join(''), N, 1.6) + F(circ(-28, 848, 4.6) + circ(30, 856, 4), P) + F(circ(-28, 848, 1.6) + circ(30, 856, 1.4), O)); }
  sym('post', 0, F('M-9 900V812q0 -6 9 -7q9 1 9 7V900Z', N) + S('M-5 816v80', B, 1.4) + S('M9 826Q90 852 170 826M-9 826Q-90 852 -170 826', v('rim'), 2.6) + S('M9 826Q90 852 170 826M-9 826Q-90 852 -170 826', N, 0.8, { 'stroke-dasharray': '3 4' }));
  return { defs };
}

// ---------------------------------------------------------------- set pieces (local x: 0 passes the rider at SP_AT; design y)
// Each returns { layer, key, x0, x1, m } and may carry data-ref hooks (land-sp-*) animated in attach.
function setPieces(ctx) {
  const { v } = ctx;
  const I = k => v('ink' + k);
  const P = I('P'), K = I('K'), O = I('O'), R = I('R'), B = I('B'), T = I('T'), N = I('N');
  const txt = (s, x, y, size, o) => gtext(s, x, y, size, o).d;
  const Rn = ctx.rng('land-setpieces');
  const out = [];
  const add = (layer, key, x0, x1, m, extra = {}) => out.push({ layer, key, x0, x1, m, ...extra });
  const ref = (name, m, o = {}) => G({ 'data-ref': 'land-sp-' + name, ...o }, m);
  const at = (x, y, m) => G({ transform: `translate(${f(x)} ${f(y)})` }, m);
  // a small standing / sitting figure (shore scale ≈ 16 u/m), feet at (0,0)
  const person = (coat, hat, sit) => (sit
    ? S('M-3 -2l-1 -8h7M3 -2l1 -6', N, 1.8) + F('M-5 -9q0 -12 5 -13q5 1 5 13z', coat) + F(circ(0, -25, 3.6), K) + F('M-5 -27h10l-2 -4h-6z', hat)
    : S('M-2 0l0.6 -12M2 0l-0.4 -12', N, 1.9) + F('M-4.6 -11q-0.8 -12 4.6 -13q5.4 1 4.6 13z', coat) + F(circ(0, -28, 3.6), K) + F('M-6 -29.6h12l-2.6 -1.6l-1 -3.4h-4.8l-1 3.4z', hat));
  const railing = (a, b, y, sp = 22) => { let p = ''; for (let x = a; x <= b; x += sp) p += `M${f(x)} ${y}v-14`; return S(p, N, 1.2) + S(`M${a} ${y - 14}H${b}`, P, 1.8) + S(`M${a} ${y - 7}H${b}`, N, 0.6); };
  const piles = (a, b, y0, y1, sp = 46) => { let p = '', br = ''; for (let x = a; x <= b; x += sp) { p += rect(x - 2.4, y0, 4.8, y1 - y0); if (x + sp <= b) br += `M${f(x)} ${y0 + 2}L${f(x + sp)} ${y1 - 3}M${f(x + sp)} ${y0 + 2}L${f(x)} ${y1 - 3}`; } return S(br, N, 0.8) + F(p, N); };
  const glowC = (x, y, r) => G({ class: 'land-glow', display: 'none' }, F(circ(x, y, r), 'url(#land-glowG)'));
  // ================================================================= THE LONG PIER (shore): piles, deck, lamps, fishermen, pavilion
  {
    const A = -160, Bx = 2700, y = 598;
    let pl = '', br = '';
    for (let x = A + 20; x <= Bx - 10; x += 44) { pl += rect(x - 3.2, y + 10, 6.4, 44); if (x + 44 <= Bx - 10) br += `M${x} ${y + 14}L${x + 44} ${y + 50}M${x + 44} ${y + 14}L${x} ${y + 50}`; }
    let m = S(br, B, 1.4) + F(pl, K) + F(pl.replace(/M(-?[\d.]+) /g, (a, x) => `M${f(+x + 4)} `).replace(/h6\.4/g, 'h2.4'), O) + F(rect(A, y, Bx - A, 11), P) + F(rect(A, y + 7, Bx - A, 4), K) + F(rect(A, y + 11, Bx - A, 3), N);
    let posts = ''; for (let x = A; x <= Bx - 190; x += 20) posts += `M${x} ${y}v-18`;
    m += S(posts, P, 1.6) + S(`M${A} ${y - 18}H${Bx - 190}`, P, 2.6) + S(`M${A} ${y - 9}H${Bx - 190}`, P, 1);
    // entrance: two P pillars with R domes, a banner 长堤 THE LONG PIER
    m += F(rect(A - 8, 530, 22, 68) + rect(A + 112, 530, 22, 68), P) + F(rect(A + 6, 530, 8, 68) + rect(A + 126, 530, 8, 68), K) + F(`M${A - 11} 530a14 14 0 0 1 28 0zM${A + 109} 530a14 14 0 0 1 28 0z`, R) +
      F(rect(A + 14, 540, 98, 28), R) + S(rect(A + 17, 543, 92, 22), P, 1) + F(txt('长堤', A + 20, 562, 17, { track: 1 }), P) + F(txt('PIER', A + 66, 559.5, 9, { track: 0.6 }), K) +
      S(`M${A + 3} 516v-12M${A + 123} 516v-12`, N, 1) + F(`M${A + 3} 504l9 3l-9 3zM${A + 123} 504l9 3l-9 3z`, O);
    // lamps every 460
    for (let x = A + 300; x < Bx - 260; x += 460) m += S(`M${x} ${y}V546`, P, 2.6) + S(`M${x} ${y}V546`, N, 1) + F(circ(x, 540, 6), P) + F(`M${x - 6} 536q6 -6 12 0z`, N) + glowC(x, 540, 24);
    // life ring + bench + perched gulls
    m += F(circ(A + 420, y - 9, 7), O) + F(circ(A + 420, y - 9, 3.4), N) + S(`M${A + 413} ${y - 9}h14M${A + 420} ${y - 16}v14`, P, 1.6);
    m += F(rect(A + 560, y - 10, 40, 4) + rect(A + 562, y - 6, 3, 6) + rect(A + 595, y - 6, 3, 6) + rect(A + 560, y - 20, 40, 3), T);
    for (const x of [A + 700, A + 1500, A + 2200]) m += F(`M${x - 7} ${y - 22}q7 -9 14 -1.4l6 -1.4l-6 3q-6 4 -14 0z`, P) + S(`M${x - 1} ${y - 19}v3`, O, 1.2) + F(circ(x + 4, y - 26, 1), N);
    // pavilion at the end
    const px = Bx - 220;
    m += F(rect(px, 528, 210, 70), P) + F(rect(px + 176, 528, 34, 70), K) + F(`M${px - 10} 528h230l-16 -16h-198z`, N) + F(`M${px + 70} 512q35 -48 70 0z`, R) + F(`M${px + 70} 512q35 -48 70 0z`, 'none', { stroke: N, 'stroke-width': 1.2 }) +
      S(`M${px + 105} 466v-10`, N, 1.2) + F(`M${px + 105} 456l12 4l-12 4z`, R) + F([0, 1, 2, 3, 4].map(i => `M${px + 18 + i * 38} 588v-28a9 9 0 0 1 18 0v28z`).join(''), N) +
      S(`M${px} 568H${px + 210}`, R, 3) + F(txt('PAVILION', px + 105, 524, 8, { anchor: 'middle', track: 0.8 }), P);
    // fishermen (×1.5; the second one lands a fish when the rider passes: the rod bends, a fish flies up)
    const fish = (x, coat, hat, sit, k) => {
      const rod = S('M4 -16L34 -44', N, 1.2) + S('M34 -44Q40 -10 37 26', P, 0.5);
      return at(x, y, G({ transform: 'scale(1.5)' }, person(coat, hat, sit) + (k === 1 ? ref('rod', rod) : rod) + F('M-12 0v-6h8v6z', O) + S('M-12 -6q4 -3 8 0', N, 0.5)));
    };
    m += fish(560, O, N, false, 0) + fish(1120, R, K, false, 1) + fish(1780, B, O, true, 2) + fish(2280, T, R, false, 3);
    m += ref('catch', at(1176, 628, G({ 'data-ref': 'land-sp-catchfish' }, F('M-4 -12q-7 7 0 16q7 -9 0 -16z', O) + F('M-3 3l3 4l3 -4z', O) + S('M-3 -5q3 1 6 0', R, 1) + F(circ(-1, -7, 1), N))) +
      at(1176, 634, S('M-12 0q12 -5 24 0M-7 4q7 -3 14 0', P, 1.4)), { visibility: 'hidden' });
    add('shore', 'pier', A - 20, Bx + 20, m);
  }
  // ================================================================= FISHING HARBOUR (shore): basin, quay, moored boats, cranes
  {
    const A = -500, Bx = 3000;
    let m = F(rect(A, 626, Bx - A, 30), v('seaNear'));
    let rip = ''; for (let i = 0; i < 90; i++) { const x = A + Rn() * (Bx - A), yy = 632 + Rn() * 18; rip += `M${f(x)} ${f(yy)}q5 -2 10 0t10 0`; }
    m += S(rip, P, 0.9);
    // moored boats (bobbing), behind the quay coping
    const boat = (x, hull, cab, k) => ref('boat' + k, (F('M-48 -6Q-46 -20 -40 -22H44Q50 -18 52 -6Q0 4 -48 -6Z', hull) + F('M-45 -14H48L49 -11H-46Z', P) + F(rect(-16, -44, 30, 22), cab) +
      F(rect(-12, -40, 7, 7) + rect(-2, -40, 7, 7) + rect(8, -40, 3, 7), N) + F('M-20 -44h38l-4 -5h-30z', N) + S('M30 -22V-86M-36 -22V-66M30 -80L-36 -60', N, 1.4) +
      F('M30 -86l14 4l-14 4z', R) + S('M44 -12Q70 2 98 -2', v('trunk'), 0.8) + F(txt(String(k + 7), -34, -8, 7), P)), { transform: `translate(${x} 648)` });
    m += boat(260, R, P, 0) + boat(760, T, P, 1) + boat(1480, O, P, 2) + boat(2200, B, K, 3);
    // quay wall + coping + courses
    m += F(rect(A, 654, Bx - A, 50), B) + F(rect(A, 650, Bx - A, 6), P) + F(rect(A, 656, Bx - A, 3), N);
    let crs = ''; for (let r = 0; r < 4; r++) { const yy = 665 + r * 11; crs += `M${A} ${yy}H${Bx}`; for (let x = A + (r % 2) * 20; x < Bx; x += 40) crs += `M${x} ${yy - 11 + (r ? 0 : 5)}v${r ? 11 : 6}`; }
    m += S(crs, N, 0.9);
    let bol = ''; for (let x = A + 100; x < Bx; x += 260) bol += `M${x - 4} 650v-6q0 -3 4 -3q4 0 4 3v6z`; m += F(bol, N);
    // cranes: portal legs, machine house, lattice jib, cable + swaying crate
    const crane = (x, k) => {
      let g = S(`M${x - 40} 650L${x - 8} 470M${x + 40} 650L${x + 8} 470M${x - 30} 600H${x + 30}M${x - 22} 550H${x + 22}M${x - 30} 600L${x + 22} 550M${x + 30} 600L${x - 22} 550`, N, 3.4);
      g += F(rect(x - 24, 444, 48, 28), O) + F(rect(x + 8, 444, 16, 28), R) + F(rect(x - 18, 450, 10, 8), N) + F(`M${x - 28} 444h56l-4 -6h-48z`, N);
      let lat = ''; const L = 270; for (let i = 0; i < 12; i++) { const u0 = i / 12, u1 = (i + 1) / 12; lat += `M${f(x + 20 + u0 * L)} ${f(452 - u0 * 60)}L${f(x + 20 + u1 * L)} ${f(440 - u1 * 60 - 0)}`; }
      g += S(`M${x + 20} 452L${x + 20 + L} ${452 - 60}M${x + 20} 440L${x + 20 + L} ${440 - 60}` + lat + `M${x - 24} 448L${x - 90} 460`, N, 2.2) + F(rect(x - 104, 456, 22, 18), B);
      g += S(`M${x} 438L${x + 20 + L} 380`, N, 0.8);
      g += ref('hook' + k, (S('M0 0V120', N, 0.8) + S('M0 120q-4 8 2 10', N, 1.4) + F(rect(-16, 128, 32, 22), k ? T : O) + S('M-16 139h32M-5 128v22M5 128v22', N, 0.8) + S('M0 120L-15 128M0 120L15 128', N, 0.6)), { transform: `translate(${f(x + 20 + L * 0.8)} 404)` });
      return g;
    };
    m += crane(980, 0) + crane(1900, 1);
    // harbour master's office with a clock, sign 渔港, nets, crates, pots, beacon at the quay end
    const hx = 420;
    m += F(rect(hx, 598, 120, 52), P) + F(rect(hx + 92, 598, 28, 52), K) + F(`M${hx - 8} 598L${hx + 60} 566L${hx + 128} 598Z`, R) + F(rect(hx + 16, 612, 16, 20) + rect(hx + 44, 612, 16, 20) + rect(hx + 72, 618, 14, 32), N) +
      F(circ(hx + 60, 586, 8), P) + S(`M${hx + 60} 586v-5M${hx + 60} 586l4 2`, N, 1) + S(ell(hx + 60, 586, 8, 8), N, 1) + F(rect(hx + 10, 636, 64, 12), N) + F(txt('渔港', hx + 14, 646.5, 10, { track: 1 }), P) + F(txt('HARBOUR', hx + 40, 645.4, 4.6, { track: 0.3 }), K);
    m += S('M1260 650V600M1300 650V604M1340 650V600', N, 1.6) + S('M1260 604L1300 608L1340 604M1260 614L1340 614M1260 624L1340 624M1260 634L1340 634M1270 604V650M1284 606V650M1300 608V650M1316 606V650M1330 604V650', B, 0.8) + F(circ(1276, 612, 2.2) + circ(1312, 612, 2.2), O);
    m += F(rect(1620, 634, 26, 16) + rect(1650, 634, 26, 16) + rect(1634, 618, 26, 16), O) + S('M1620 642h56M1634 626h26M1647 634v16M1647 618v16', N, 0.8);
    m += F(rect(Bx - 60, 580, 22, 70), P) + F(rect(Bx - 60, 592, 22, 10) + rect(Bx - 60, 614, 22, 10), R) + F(rect(Bx - 64, 574, 30, 6), N) + F(rect(Bx - 56, 562, 14, 12), v('lamp')) + F(`M${Bx - 60} 562l11 -8l11 8z`, N) + glowC(Bx - 49, 568, 22);
    add('shore', 'harbour', A, Bx, m);
  }
  // ================================================================= PLEASURE PIER (shore): Ferris wheel, carousel, helter-skelter, bunting
  {
    const A = -260, Bx = 1900, y = 636;
    let m = piles(A + 20, Bx - 20, y + 8, 656, 40) + F(rect(A, y, Bx - A, 8), B) + F(rect(A, y, Bx - A, 2), P) + railing(A, Bx, y, 20);
    // entrance arch
    m += F(rect(A + 10, 560, 22, 76) + rect(A + 150, 560, 22, 76), P) + F(rect(A + 10, 574, 22, 8) + rect(A + 10, 596, 22, 8) + rect(A + 150, 574, 22, 8) + rect(A + 150, 596, 22, 8), R) +
      F(`M${A + 6} 560a15 15 0 0 1 30 0zM${A + 146} 560a15 15 0 0 1 30 0z`, R) + F(`M${A + 30} 572Q${A + 91} 540 ${A + 152} 572V590Q${A + 91} 560 ${A + 30} 590Z`, N) +
      F(txt('游乐栈桥', A + 50, 584, 12.5, { track: 0.5 }), P) + S(`M${A + 21} 545v-10M${A + 161} 545v-10`, N, 0.8) + F(`M${A + 21} 535l7 2.4l-7 2.4zM${A + 161} 535l7 2.4l-7 2.4z`, O);
    // Ferris wheel (rotating rim + counter-rotating gondolas)
    const cx = 560, cy = 470, Rw = 142;
    m += S(`M${cx - 70} ${y}L${cx} ${cy}L${cx + 70} ${y}M${cx - 52} ${y - 40}H${cx + 52}`, N, 5) + F(rect(cx - 80, y - 8, 160, 8), N);
    let sp = ''; for (let i = 0; i < 24; i++) { const a = i * 15 * D2R; sp += `M${cx} ${cy}L${f(cx + Math.cos(a) * Rw)} ${f(cy + Math.sin(a) * Rw)}`; }
    let bulbs = ''; for (let i = 0; i < 48; i++) { const a = i * 7.5 * D2R; bulbs += circ(cx + Math.cos(a) * (Rw + 4), cy + Math.sin(a) * (Rw + 4), 1.6); }
    const wheel = S(sp, T, 1.1) + S(ell(cx, cy, Rw, Rw), N, 4.2) + S(ell(cx, cy, Rw - 12, Rw - 12), T, 2) + S(ell(cx, cy, 40, 40), T, 2.4) + F(bulbs, P) + F(circ(cx, cy, 11), O) + F(circ(cx, cy, 4), N);
    m += G({ transform: `translate(${cx} ${cy})` }, ref('wheel', G({ transform: `translate(${-cx} ${-cy})` }, wheel)));
    const cols = [R, O, T, P, B, R, O, T, K, B, R, T];
    for (let i = 0; i < 12; i++) m += ref('gond' + i, F('M-9 3h18v10q0 5 -5 5h-8q-5 0 -5 -5z', cols[i]) + F('M-10 3h20l-3 -4h-14z', N) + F(rect(-6, 6, 12, 5), N) + S('M0 -1V-4', N, 1.4) + F(circ(-2.4, 8.6, 1.5) + circ(2.6, 8.6, 1.5), K));
    // carousel
    const kx = 1080, top = 548;
    let can = ''; for (let i = 0; i < 10; i++) can += F(`M${kx} ${top}L${kx - 100 + i * 20} 590L${kx - 80 + i * 20} 590Z`, i % 2 ? P : R);
    let val = ''; for (let i = 0; i < 10; i++) val += `M${kx - 100 + i * 20} 590a10 7 0 0 0 20 0z`;
    m += can + F(val, R) + F(rect(kx - 102, 588, 204, 4), N) + S(`M${kx} ${top}V${top - 16}`, N, 1) + F(`M${kx} ${top - 16}l10 3l-10 3z`, O) +
      S([0, 1, 2, 3, 4, 5].map(i => `M${kx - 90 + i * 36} 592V630`).join(''), P, 2.4) + F(rect(kx - 108, 628, 216, 8), N) + F(rect(kx - 108, 628, 216, 2), O) + F(rect(kx - 12, 592, 24, 36), N);
    const horse = (x) => S(`M${x} 592V626`, O, 1.2) + F(`M${x - 11} 612q2 -6 10 -6q8 -4 10 -9l3 1q-1 5 -3 7q2 5 -1 9l-2 8l-2 0l0 -6q-6 2 -12 0l-1 6h-2z`, P) + S(`M${x + 9} 598q2 -2 5 -1`, R, 1.2);
    m += ref('horsesA', horse(kx - 72) + horse(kx + 0 + 36)) + ref('horsesB', horse(kx - 36) + horse(kx + 72));
    // helter-skelter
    const hx = 1480;
    m += F(`M${hx - 30} ${y}L${hx - 18} 470H${hx + 18}L${hx + 30} ${y}Z`, P);
    let spi = ''; for (let i = 0; i < 7; i++) { const y0 = 480 + i * 23; spi += `M${f(hx - 18 - i * 1.7)} ${y0}L${f(hx + 19 + i * 1.7)} ${y0 + 12}L${f(hx + 20 + i * 1.7)} ${y0 + 20}L${f(hx - 19 - i * 1.7)} ${y0 + 8}Z`; }
    m += F(spi, T) + S(spi.replace(/Z/g, ''), N, 0.6) + F(`M${hx - 26} 470L${hx} 422L${hx + 26} 470Z`, O) + F(`M${hx - 26} 470L${hx} 422L${hx - 8} 470Z`, K) + F(rect(hx - 26, 468, 52, 4), N) + F(txt('HELTER SKELTER', hx, 492, 4.4, { anchor: 'middle' }), N) + S(`M${hx} 428v-12`, N, 1) + F(`M${hx} 416l10 3l-10 3z`, T) + F(rect(hx - 8, 450, 16, 12), N);
    // bunting
    let bun = '', k = 0; const bc = [R, O, T, P];
    for (const [a, b, yy] of [[A + 172, cx - 70, 560], [cx + 70, kx - 100, 580], [kx + 100, hx - 24, 520]]) {
      bun += S(`M${a} ${yy}Q${(a + b) / 2} ${yy + 26} ${b} ${yy}`, N, 0.6);
      for (let i = 1; i < 10; i++) { const u = i / 10, x = lerp(a, b, u), yb = yy + 2 * u * (1 - u) * 26; bun += F(`M${f(x - 3.4)} ${f(yb)}h6.8l-3.4 7z`, bc[k++ % 4]); }
    }
    m += bun;
    add('shore', 'funfair', A - 10, Bx + 10, m, { spin: [cx, cy, Rw] });
  }
  // ================================================================= COAST RAILWAY (shore): embankment, track, poles, halt; + the train
  {
    const Lr = 3 * KM * 0.6 + 400, y = 652;
    let m = F(rect(-200, 654, Lr + 400, 50), v('grassFar')) + F(rect(-200, 654, Lr + 400, 50), 'url(#land-htEmb)') + F(rect(-200, y - 4, Lr + 400, 8), B) +
      F(rect(-200, y - 4, Lr + 400, 6), 'url(#land-sleepers)') + S(`M-200 ${y - 5}H${Lr + 200}`, N, 2.2) + S(`M-200 ${y - 6}H${Lr + 200}`, P, 0.7) +
      F(rect(-200, 560, Lr + 400, 94), 'url(#land-poles)') + S(`M-200 568H${Lr + 200}M-200 575H${Lr + 200}`, N, 0.5);
    // the halt: platform, canopy, sign 海滨铁路, clock, bench, luggage
    m += F(rect(0, 628, 340, 22), P) + F(rect(0, 626, 340, 3), N) + F(rect(270, 628, 70, 22), K) + S('M20 628V586M170 628V586M320 628V586', N, 2) +
      F('M6 586h328l-12 -14h-304z', T) + F(Array.from({ length: 21 }, (_, i) => `M${6 + i * 15.6} 586a7.8 5 0 0 0 15.6 0z`).join(''), T) +
      F(rect(120, 600, 100, 16), N) + F(txt('海滨铁路', 126, 612.5, 11, { track: 1 }), P) + F(txt('COAST RLY', 196, 611, 4.4), K) +
      F(circ(60, 598, 7), P) + S(ell(60, 598, 7, 7) + 'M60 598v-4.6M60 598l3 1.6', N, 1) + F(rect(240, 616, 26, 3) + rect(242, 619, 2, 9) + rect(262, 619, 2, 9), T) +
      F(rect(290, 612, 16, 14) + rect(296, 604, 12, 8), O) + S('M290 619h16M302 604v8', N, 0.6) + at(250, 628, person(R, N, true));
    add('shore', 'railway', -220, Lr + 220, m, { rail: true });
  }
  // the train (screen-positioned by the race logic; local x = 0 is the loco buffer beam, rails at y 648)
  {
    const y = 648;
    const wheel = (x, r, k) => at(x, y - r, ref('tw' + k, S(ell(0, 0, r, r), N, 2.4) + S(`M${-r} 0H${r}M0 ${-r}V${r}M${-r * 0.7} ${-r * 0.7}L${r * 0.7} ${r * 0.7}M${r * 0.7} ${-r * 0.7}L${-r * 0.7} ${r * 0.7}`, P, 0.9) + F(circ(0, 0, 2.2), O) + F(circ(r * 0.55, 0, 1.6), P)));
    let loco = F(`M-104 ${y - 36}H-12Q-2 ${y - 36} -2 ${y - 26}V${y - 14}H-104Z`, N) + F(rect(-104, y - 30, 92, 3) + rect(-104, y - 20, 92, 2), B) + F(rect(-40, y - 60, 10, 24), N) +
      F(`M-44 ${y - 62}h18l-2 4h-14z`, N) + F(`M-74 ${y - 36}q0 -12 9 -12q9 0 9 12z`, O) + F(rect(-138, y - 66, 36, 52), T) + F(`M-142 ${y - 66}h44l-3 -5h-38z`, N) + F(rect(-132, y - 58, 14, 14), P) +
      F(rect(-2, y - 14, 8, 10), R) + F(rect(-110, y - 14, 112, 4), N) + F(txt('7', -126, y - 24, 11), P) + S(`M-12 ${y - 44}q10 -6 18 -2`, P, 0);
    loco += at(-122, y - 50, F(circ(0, 0, 4), K) + F('M-5 -2h10l-1.6 -4h-6.8z', N)) + ref('driverArm', S('M0 0l8 -10', K, 2.6), { transform: `translate(-118 ${y - 46})` });
    loco += wheel(-88, 12, 0) + wheel(-60, 12, 1) + wheel(-24, 7, 2) + wheel(-128, 7, 3) + ref('crod', S('M-88 0H-60', P, 2.2), { transform: `translate(0 ${y - 12})` });
    let tender = F(rect(-200, y - 44, 56, 32), N) + F(`M-198 ${y - 44}q10 -8 20 -3q12 -6 22 1q8 -3 12 2z`, v('trunk')) + F(rect(-200, y - 32, 56, 4), O) + wheel(-188, 7, 4) + wheel(-156, 7, 5);
    let cars = '';
    [[R, 'A'], [T, 'B'], [R, 'C']].forEach(([ink], i) => {
      const x0 = -306 - i * 104;
      let win = ''; for (let w = 0; w < 6; w++) win += rect(x0 + 8 + w * 15, y - 46, 10, 11);
      let heads = ''; for (let w = 0; w < 6; w++) if (hash(w + i * 7, 91) < 0.55) heads += circ(x0 + 13 + w * 15, y - 38.5, 2.8);
      cars += F(rect(x0, y - 54, 98, 42), ink) + F(rect(x0, y - 48, 98, 15), P) + F(win, N) + F(heads, K) + F(`M${x0 - 2} ${y - 54}Q${x0 + 49} ${y - 64} ${x0 + 100} ${y - 54}Z`, N) +
        S(`M${x0} ${y - 26}H${x0 + 98}`, P, 0.8) + F(rect(x0 + 2, y - 14, 94, 3), N) + wheel(x0 + 16, 6.5, 6 + i * 2) + wheel(x0 + 82, 6.5, 7 + i * 2) + (i === 1 ? F(txt('鹈鹕湾', x0 + 34, y - 17, 8), P) : '') +
        S(`M${x0 + 98} ${y - 20}h6`, N, 1.6);
    });
    let smoke = ''; for (let i = 0; i < 7; i++) smoke += ref('puff' + i, F(circ(0, 0, 9) + circ(7, -4, 6) + circ(-6, -3, 5.5), P) + S('M-6 3q6 3 12 0', K, 1.2));
    const toot = ref('toot', F(txt('TOOT!', 2, 2, 22, { anchor: 'middle', track: 1 }), N) + F(txt('TOOT!', 0, 0, 22, { anchor: 'middle', track: 1 }), R) +
      S('M-40 -30l-8 -8M40 -30l8 -8M0 -34v-10', O, 2.6), { visibility: 'hidden', transform: `translate(-30 ${y - 110})` });
    add('shore', 'train', -620, 20, ref('train', cars + tender + loco) + ref('smoke', smoke) + toot, { train: true });
  }
  // ================================================================= LIGHTHOUSE POINT (shore): headland, tower, cottage, sheep
  {
    const hl = [[-560, 700], [-470, 640], [-360, 600], [-240, 572], [-120, 560], [60, 552], [220, 556], [340, 578], [460, 616], [560, 652], [640, 700]];
    const top = smooth(hl, false) + 'Z';
    let m = F(top, B) + F('M220 556Q300 560 340 578Q400 596 460 616Q520 630 560 652L640 700H300Q330 640 220 556Z', N) + F(top, 'url(#land-htHead)');
    m += F('M-240 572Q-120 556 60 548Q180 548 220 556L224 566Q120 558 -118 568Q-200 574 -250 584Z', T) + S('M-360 604q60 -20 120 -30M-430 640q80 -30 150 -40M300 600q40 10 80 30', P, 1.3) +
      S('M-300 620l30 -6M-200 600l40 -4M100 600l50 6M-120 620h60M260 640l40 8', N, 1);
    // tower
    const tx = 120, yb = 552, yt = 262, wb = 26, wt = 17;
    const xL = y => tx - lerp(wb, wt, (yb - y) / (yb - yt)), xR = y => tx + lerp(wb, wt, (yb - y) / (yb - yt));
    let st = ''; for (let i = 0; i < 6; i++) { const y0 = yb - i * 48, y1 = y0 - 24; if (i % 2 === 0) st += poly([[xL(y0), y0], [xR(y0), y0], [xR(y1), y1], [xL(y1), y1]]); }
    m += F(poly([[xL(yb), yb], [xR(yb), yb], [xR(yt), yt], [xL(yt), yt]]), P) + F(st, R) + F(poly([[tx + 8, yb], [xR(yb), yb], [xR(yt), yt], [tx + 6, yt]]), N, { opacity: 0.22 }) +
      F(`M${tx - 7} ${yb}v-16a7 7 0 0 1 14 0v16z` + rect(tx - 4, 470, 8, 10) + rect(tx - 3.6, 380, 7.2, 10) + rect(tx - 3.4, 300, 6.8, 9), N) +
      F(rect(tx - 27, yt - 6, 54, 6), N) + S(`M${tx - 26} ${yt - 6}v-9h52v9M${tx - 16} ${yt - 6}v-9M${tx - 6} ${yt - 6}v-9M${tx + 6} ${yt - 6}v-9M${tx + 16} ${yt - 6}v-9`, N, 1) +
      F(rect(tx - 14, yt - 34, 28, 28), v('lamp')) + S(`M${tx - 14} ${yt - 34}h28v28h-28zM${tx - 4.6} ${yt - 34}v28M${tx + 4.6} ${yt - 34}v28`, N, 1.4) +
      F(`M${tx - 17} ${yt - 34}Q${tx} ${yt - 58} ${tx + 17} ${yt - 34}Z`, R) + S(`M${tx} ${yt - 52}v-14M${tx - 8} ${yt - 62}h16`, N, 1.2) + F(`M${tx} ${yt - 66}l10 2l-10 2z`, N);
    m += G({ class: 'land-glow', display: 'none' }, F(circ(tx, yt - 20, 110), 'url(#land-glowG)') + F(circ(tx, yt - 20, 16), v('lamp')));
    // keeper's cottage, path, fence, flag, sheep
    const cx = -150;
    m += F(rect(cx, 530, 90, 34), P) + F(rect(cx + 64, 530, 26, 34), K) + F(`M${cx - 8} 530L${cx + 30} 506H${cx + 60}L${cx + 98} 530Z`, R) + F(rect(cx + 66, 496, 9, 18), N) +
      F(rect(cx + 12, 540, 12, 12) + rect(cx + 40, 538, 12, 26), N) + F(rect(cx + 14, 542, 8, 8), v('lamp'), { class: 'land-glow', display: 'none' }) + S(`M${cx - 70} 566l20 -4l20 3l20 -4`, P, 1.4);
    let fn = ''; for (let x = -420; x < -200; x += 14) fn += `M${x} ${f(612 - (x + 420) * 0.17)}v-9`; m += S(fn, N, 1.2) + S('M-420 606L-200 568', N, 0.6);
    m += S('M280 556V500', N, 1.2) + ref('lhflag', F('M280 500q10 -3 20 1q-10 3 -20 7z', R), { transform: '' });
    for (const [x, y, fl] of [[-330, 598, 1], [-280, 588, -1], [-40, 552, 1]]) m += at(x, y, G({ transform: fl < 0 ? 'scale(-1 1)' : undefined }, F(ell(0, -6, 9, 5.5), P) + F(ell(9, -8, 3.4, 2.6), N) + S('M-5 -1v3M4 -1v3', N, 1.4) + S('M-6 -9q3 -2 6 0t6 0', K, 0.8)));
    m += F('M-560 700q10 -8 22 -3q10 -9 22 -1q12 -8 22 0q12 -6 20 2q12 -6 22 1z', P) + F('M560 660q12 -6 22 0q10 -7 22 0q10 -5 20 2q6 4 18 38h-90z', P);
    add('shore', 'lighthouse', -580, 660, m);
  }
  // ================================================================= THE CLIFFS (shore): sea arch + stacks + the sea serpent
  {
    const outer = 'M-360 700L-350 560Q-330 480 -260 462L-140 452Q0 430 150 444L270 456Q360 470 380 560L400 700Z';
    const hole = 'M-150 700L-146 612Q-128 548 -40 540Q60 536 100 580Q124 610 126 660L128 700Z';
    let m = F(outer + hole, K, { 'fill-rule': 'evenodd' }) + F(outer + hole, 'url(#land-htArch)', { 'fill-rule': 'evenodd' }) + F('M270 456Q360 470 380 560L400 700H300Q320 600 270 456Z', O) + S('M120 650Q116 590 60 550', N, 6);
    let str = ''; for (let i = 0; i < 9; i++) { const yy = 480 + i * 22; str += `M${-340 + i * 2} ${yy}q120 ${-6 + (i % 3) * 3} 240 -2q140 4 250 -6`; }
    m += G({ 'clip-path': 'url(#land-archClip)' }, S(str, R, 0.9)) + F('M-260 462L-140 452Q0 430 150 444L270 456Q200 452 150 454Q0 442 -140 462Z', T) +
      S('M-250 466q60 -10 110 -12M20 440q60 0 110 8', P, 1.6) + F('M-150 700q10 -10 24 -4q14 -8 28 0q14 -6 26 2q12 -6 26 0q14 -6 28 2q14 -4 24 0l2 0z', P) +
      S('M-200 520l3 -2l3 2M-60 470l3 -2l3 2M200 490l3 -2l3 2M40 480l3 -2l3 2', N, 0.9) + F('M-60 440l6 -4l6 4l-3 1l-3 -1.6l-3 1.6zM90 434l6 -4l6 4l-3 1l-3 -1.6l-3 1.6z', P);
    // the serpent: humps loop through the water under the arch (easter egg)
    const hump = (w, h2, ink) => F(`M${-w} 0Q${-w} ${-h2} 0 ${-h2}Q${w} ${-h2} ${w} 0H${w * 0.6}Q${w * 0.6} ${-h2 * 0.6} 0 ${-h2 * 0.6}Q${-w * 0.6} ${-h2 * 0.6} ${-w * 0.6} 0Z`, ink) +
      S(`M${-w * 0.8} ${-h2 * 0.55}l3 -3M0 ${-h2 * 0.8}l0 -3M${w * 0.8} ${-h2 * 0.55}l-3 -3`, P, 1.2);
    let serp = at(-100, 652, hump(14, 16, T)) + at(-50, 652, hump(16, 20, T)) + at(10, 652, hump(13, 14, T));
    serp += at(56, 652, F('M-8 0Q-10 -24 4 -30Q16 -32 18 -24Q12 -22 8 -20Q4 -12 6 0Z', T) + F(circ(8, -26, 1.6), P) + F(circ(8.4, -26, 0.8), N) + F('M-4 -26l-6 -6l2 7l-6 -2l6 6z', R) + S('M16 -22q2 1 4 0', N, 0.8));
    serp += S('M-124 652q60 -4 200 0', P, 1.4);
    m += ref('serpent', serp);
    add('shore', 'cliffs', -380, 420, m);
  }
  // ================================================================= ROCK ARCH over the road (roadside, depth 0.9)
  {
    const outer = 'M-470 760L-460 330Q-450 140 -320 84Q0 20 320 84Q450 140 460 330L470 760Z';
    const hole = 'M-270 760L-270 400Q-262 196 0 176Q262 196 270 400L270 760Z';
    let m = F(outer + hole, K, { 'fill-rule': 'evenodd' }) + F(outer + hole, 'url(#land-htArch)', { 'fill-rule': 'evenodd' }) + F('M340 100Q450 140 460 330L470 760H372L366 330Q362 180 340 100Z', O) +
      S('M262 360Q256 214 70 180', N, 9) + F('M-470 760L-460 330Q-456 250 -430 200L-420 760Z', O);
    let str = ''; for (let i = 0; i < 12; i++) { const yy = 150 + i * 50; str += `M-470 ${yy}q120 -14 200 -4M270 ${yy + 8}q100 -10 200 4`; }
    m += S(str, R, 1.2) + S('M-440 300q-10 -120 110 -200M-10 44q180 -14 300 44', P, 2.4) + S('M-250 420Q-250 230 -40 196', P, 1.6);
    let vine = ''; for (let i = 0; i < 9; i++) { const x = -200 + i * 50 + (i % 2) * 12, l = 40 + (i * 37) % 60; vine += `M${x} ${f(190 + Math.abs(x) * 0.18)}q${i % 2 ? 6 : -6} ${l / 2} 0 ${l}`; }
    m += S(vine, T, 2.2) + F('M-470 90q60 -40 120 -30q70 -44 140 -30q80 -30 160 -10q90 -20 150 20q50 0 70 30l0 -10q-240 -60 -640 30z', T);
    m += F(rect(-30, 172, 60, 30), P) + S(rect(-30, 172, 60, 30), N, 1.2) + F(txt('断崖', -24, 194, 16, { track: 2 }), N);
    add('roadside', 'arch', -480, 480, m);
  }
  // ================================================================= RIVER MOUTH (shore) + truss BRIDGE (roadside)
  {
    let m = F('M-980 700L-920 640H920L980 700Z', v('seaNear')) + F('M-1000 700L-980 640Q-960 636 -920 640L-960 700Z', v('sand')) + F('M1000 700L980 640Q960 636 920 640L960 700Z', v('sand'));
    let rip = ''; for (let i = 0; i < 70; i++) { const x = -900 + Rn() * 1800, yy = 646 + Rn() * 50; rip += `M${f(x)} ${f(yy)}q6 -2 12 0t12 0`; }
    m += S(rip, P, 0.9) + S('M-900 660q300 -8 600 0t600 0', v('seaFar'), 2.4);
    for (const x of [-600, -200, 200, 600]) m += F(`M${x - 26} 700V644L${x - 16} 630H${x + 16}L${x + 26} 644V700Z`, P) + F(`M${x + 8} 700V630H${x + 16}L${x + 26} 644V700Z`, K) + S(`M${x - 26} 660h52M${x - 26} 678h52`, B, 0.9);
    m += ref('rowboat', at(-380, 668, F('M-26 0Q-24 10 0 10Q24 10 26 0Z', O) + F('M-26 0H26L24 3H-24Z', P) + person(T, K, true).replace(/^/, '') + S('M6 -14L30 -40', N, 0.9) + S('M30 -40Q34 -10 32 8', N, 0.3) + S('M-20 2l-18 10', v('trunk'), 1.6)));
    m += at(420, 668, S('M0 0l-2 -18M0 0l3 -18', N, 1.2) + F('M-8 -18q2 -12 10 -14q10 0 10 6l10 -1l-10 4q-4 6 -12 6z', P) + S('M8 -32q-2 -8 4 -12', P, 2.6) + F('M14 -44l14 3l-14 1z', O) + F(circ(12, -42, 0.9), N));
    let rd = ''; for (let i = 0; i < 16; i++) { const x = (i < 8 ? -960 : 900) + (i % 8) * 8; rd += `M${x} 700q${i % 2 ? 3 : -3} -30 ${i % 2 ? -2 : 2} -60`; }
    m += S(rd, T, 1.6) + F(Array.from({ length: 8 }, (_, i) => rect((i < 4 ? -958 : 902) + (i % 4) * 16, 640 + (i % 3) * 6, 3, 12)).join(''), O);
    add('shore', 'river', -1010, 1010, m);
    // roadside truss (depth 0.9): portal frames, Warren truss, rivets, name plate
    const A = -880, Bx = 880, y0 = 700, y1 = 560, n = 16, sw = (Bx - A) / n;
    let tr = `M${A} ${y0}H${Bx}M${A + sw} ${y1}H${Bx - sw}M${A} ${y0}L${A + sw} ${y1}M${Bx} ${y0}L${Bx - sw} ${y1}`;
    for (let i = 1; i < n - 1; i++) { const x = A + i * sw; tr += `M${x} ${y0}L${x + sw} ${y1}M${x + sw} ${y0}V${y1}`; }
    let rv = ''; for (let i = 0; i <= n; i++) rv += circ(A + i * sw, y0 - 3, 2) + (i && i < n ? circ(A + i * sw, y1 + 3, 2) : '');
    let mR = S(tr, N, 9) + S(tr, R, 5.4) + F(rv, P);
    for (const x of [A, Bx]) mR += F(rect(x - 16, y1 - 20, 32, 232), N) + F(rect(x - 20, y1 - 26, 40, 8), N) + F(rect(x - 11, y1 - 12, 22, 190), R) + F(rect(x - 11, y1 - 12, 6, 190), O);
    mR += F(rect(-70, y1 - 44, 140, 30), N) + F(rect(-66, y1 - 40, 132, 22), P) + F(txt('河口桥', -60, y1 - 22.5, 16, { track: 1 }), N) + F(txt('1931', 34, y1 - 23, 9), R);
    add('roadside', 'bridge', A - 30, Bx + 30, mR);
  }
  // ================================================================= OLD FORT & LIDO (shore)
  {
    let m = F('M-290 700L-270 560H-130L-110 700Z', P) + F('M-170 560H-130L-110 700H-150Z', K) + F('M-290 700L-270 560H-130L-110 700Z', 'url(#land-htHead)', { opacity: 0.35 });
    let crs = ''; for (let i = 1; i < 7; i++) { const yy = 560 + i * 20, dx = i * 2.9; crs += `M${f(-270 - dx)} ${yy}H${f(-130 + dx)}`; for (let x = -266 - dx + (i % 2) * 12; x < -130 + dx; x += 24) crs += `M${f(x)} ${yy}v-20`; }
    m += S(crs, B, 0.8) + F(rect(-276, 548, 152, 12) + [0, 1, 2, 3, 4, 5].map(i => rect(-276 + i * 28, 538, 16, 10)).join(''), P) + S('M-276 560H-124', N, 1.4) +
      F('M-206 700v-30a10 10 0 0 1 20 0v30z' + rect(-240, 600, 10, 16) + rect(-168, 600, 10, 16), N) + S('M-120 552l30 -8', N, 5) + F(circ(-122, 553, 5), N) +
      S('M-200 538V476', N, 1.4) + ref('fortflag', F('M-200 476q14 -4 28 2q-14 4 -28 10z', R));
    // the lido: deco bathhouse with a tower, speed lines, pool with lanes, diving tower + diver
    m += F(rect(40, 610, 330, 90), P) + F(rect(300, 610, 70, 90), K) + F(rect(170, 540, 70, 70), P) + F(`M166 540h78v-8h-78z` + rect(36, 604, 338, 6), N) +
      S('M40 628H370M40 636H370M40 644H370', R, 2.2) + F([0, 1, 2, 3, 4, 5].map(i => circ(70 + i * 44 + (i > 2 ? 44 : 0), 668, 9)).join(''), N) + F(rect(190, 650, 30, 50), N) +
      F(txt('浴场', 184, 574, 20, { track: 1 }), R) + F(txt('LIDO', 205, 597, 9, { anchor: 'middle', track: 1 }), N) + S('M205 532V500', N, 1.2) + F('M205 500l14 4l-14 4z', T);
    m += F(rect(380, 664, 260, 36), T) + S('M380 674H640M380 684H640M380 694H640', P, 0.8, { 'stroke-dasharray': '4 5' }) + F(rect(376, 660, 268, 5), P);
    m += S('M620 700V560M650 700V560M620 600H650M620 640H650M620 560L650 600M650 560L620 600', N, 1.8) + F(rect(600, 556, 56, 5), N) + S('M600 556l-22 2', P, 2.4);
    m += ref('diver', F('M-3 -8q3 -4 6 0v8h-6z', R) + F(circ(0, -11, 2.8), K) + S('M-2 0l-1 7M2 0l1 7M-3 -7l-5 -6M3 -7l5 -6', K, 1.4), { transform: 'translate(586 548)' });
    m += ref('splash', F('M-10 0q2 -12 5 -2q2 -16 5 0q3 -14 5 1q3 -10 5 1z', P), { transform: 'translate(560 664)', visibility: 'hidden' });
    add('shore', 'fort', -300, 660, m);
  }
  // ================================================================= MESSAGE IN A BOTTLE (shore, dunes) — easter egg
  add('shore', 'bottle', -40, 40, at(0, 690, G({ transform: 'rotate(-18)' }, F('M-14 -4h20q4 0 6 2h6v4h-6q-2 2 -6 2h-20q-3 0 -3 -4q0 -4 3 -4z', T) + F(rect(-10, -2, 14, 4), P) + S('M-6 0h7', R, 0.6) + F(rect(26, -2.4, 4, 4.8), K) + S('M-12 -3h16', P, 0.8)) +
    F('M24 6q4 -6 8 -2l2 -3l1 3q4 -2 5 2q-2 4 -8 4q-6 0 -8 -4z', R) + F(circ(30, 1, 0.8) + circ(34, 1, 0.8), N)));
  // ================================================================= roadside: the pelican-on-a-bicycle statue (village)
  {
    let m = F(rect(-40, -12, 80, 12) + rect(-34, -84, 68, 72) + rect(-38, -92, 76, 8), P) + F(rect(16, -84, 18, 72), K) + F(rect(-22, -70, 44, 34), N) +
      F(txt('鹈鹕', -17, -52, 15, { track: 2 }), P) + F(txt('1926', 0, -41, 8, { anchor: 'middle', track: 1 }), K);
    const st = G({ transform: 'translate(0 -92)' },
      S('M-28 -18m-17 0a17 17 0 1 0 34 0a17 17 0 1 0 -34 0M30 -18m-17 0a17 17 0 1 0 34 0a17 17 0 1 0 -34 0', T, 3.6) + S('M-28 -18L-4 -20L22 -46M-4 -20L-12 -46H18L30 -18M-16 -50h10M20 -50l-2 6', T, 3) +
      F('M-44 -58Q-40 -84 -10 -86Q14 -84 18 -66Q10 -52 -18 -52Q-36 -52 -44 -58Z', T) + S('M8 -76Q22 -96 12 -114Q6 -126 18 -130', T, 7) + F(circ(20, -130, 7.5), T) +
      F('M24 -132L62 -122L26 -124Z', T) + F('M26 -125Q44 -116 60 -122Q44 -110 28 -120Z', T) + S('M-8 -54L-6 -30L-4 -20M0 -56L10 -34', T, 3) +
      S('M-36 -70q16 -10 40 -8M-40 -60q22 4 50 -4M14 -128a6 6 0 0 1 8 -3M-28 -30a14 14 0 0 1 8 -10M30 -34a14 14 0 0 1 10 2', P, 1.4) + F(circ(22, -132, 1.4), N));
    add('roadside', 'statue', -60, 70, at(0, GY.roadside, m + st));
  }
  // ================================================================= PELICAN CROSSING: zebra (road) + beacons & sign (roadside)
  {
    let z = ''; for (let i = 0; i < 7; i++) { const x = -150 + i * 46; z += `M${x} 776L${x + 26} 776L${x + 10} 858L${x - 16} 858Z`; }
    add('road', 'crossing', -200, 200, F(z, v('roadLine')) + S('M-176 776H176M-196 858H160', v('roadLine'), 2, { 'stroke-dasharray': '10 8' }));
    const bea = x => F(rect(x - 3, -176, 6, 176), P) + F([0, 1, 2, 3, 4, 5, 6].map(i => rect(x - 3, -168 + i * 24, 6, 12)).join(''), N) + F(circ(x, -186, 11), O) + S(`M${x - 7} -192a8 8 0 0 1 8 -4`, P, 1.6) + F(rect(x - 5, -176, 10, 3), N);
    const signX = -120;
    const sign = F(rect(signX - 50, -150, 100, 46), P) + S(rect(signX - 47, -147, 94, 40), N, 1.4) + F(txt('鹈鹕过街', signX - 40, -126, 19, { track: 0.6 }), N) + F(txt('PELICAN CROSSING', signX, -113, 6.6, { anchor: 'middle', track: 0.4 }), R) +
      F(rect(signX - 2, -104, 4, 104), N);
    add('roadside', 'crossing', -240, 240, at(0, GY.roadside, bea(-180) + bea(170) + sign +
      G({ class: 'land-glow', display: 'none' }, F(circ(-180, -186, 34) + circ(170, -186, 34), 'url(#land-glowG)'))));
  }
  // ================================================================= WELCOME BACK banner (roadside, on the way home)
  {
    let m = S('M-250 0V-270M250 0V-270', N, 5) + F(circ(-250, -276, 6) + circ(250, -276, 6), O) + S('M-250 -262Q0 -230 250 -262', N, 1);
    m += F('M-210 -248H210V-196H-210L-196 -222Z', R) + F('M210 -248H224L212 -222L224 -196H210Z', R) + S('M-204 -244H206V-200H-204', P, 1.2) +
      F(txt('欢迎回来', -150, -212, 30, { track: 3 }), P) + F(txt('WELCOME BACK', 110, -226, 9, { anchor: 'middle', track: 0.8 }), K) + F(txt('鹈鹕湾', 110, -208, 11, { anchor: 'middle', track: 1 }), P);
    let bun = '', k = 0; const bc = [O, T, P, R];
    bun += S('M-250 -180Q0 -140 250 -180', N, 0.8); for (let i = 1; i < 20; i++) { const u = i / 20, x = lerp(-250, 250, u), yb = -180 + 2 * u * (1 - u) * 40; bun += F(`M${f(x - 5)} ${f(yb)}h10l-5 11z`, bc[k++ % 4]); }
    add('roadside', 'welcome', -280, 280, at(0, GY.roadside, m + bun));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------- build
export function build(ctx) {
  const { v } = ctx;
  const I = k => v('ink' + k);
  const P = I('P'), K = I('K'), O = I('O'), R = I('R'), B = I('B'), T = I('T'), N = I('N');
  let defs = '';
  const anim = { shore: [], roadside: [] };   // tg => markup; hero-copy animation hooks
  const base = {}, baseAnim = {};              // continuous base tiles (streamed stretches)
  let SYM = '';                                // stream prop variants drawn by the tile generators

  // ========================================================================= SHORE (depth 0.6)
  const shore = (() => {
    const L = LAY.shore, W = L.W, X0 = L.x0 - 3, X1 = L.x1 + 3, Rn = ctx.rng('land-shore');
    let s = '';
    const put = (o, g) => { s += G(RID(o), g); };
    s += F(rect(X0, 638, X1 - X0, 15), v('sand'));
    defs += htPattern('land-htSand', W, 6.5, 650, 760, y => lerp(0.35, 2.5, smooth01((y - 652) / 56)), v('sunHalo'), v('sand'));
    s += band(X0, X1, DD('sand-halftone'), (a, b) => F(rect(a, 652, b - a, 52), 'url(#land-htSand)'), [66, 132]);
    s += F(rect(X0, 703.5, X1 - X0, 29), v('sand'));
    // tideline: foam scallops over the sea's last band, water-edge wave line, wet-sand dashes
    {
      const n = 120, sw = W / n, fo = [], wl = [], wet = [];
      for (let i = -1; i <= n; i++) {
        const x = L.x0 + i * sw;
        fo.push([x, `M${f(x)} 641q${f(sw * 0.25)} -7 ${f(sw * 0.5)} -4.5q${f(sw * 0.25)} -5 ${f(sw * 0.5)} 0.5v4h${f(-sw)}Z`]);
        wl.push([x, `M${f(x)} 645.5q${f(sw / 4)} 2.6 ${f(sw / 2)} 0t${f(sw / 2)} 0`]);
      }
      for (let i = 0; i < 80; i++) { const x = L.x0 + (i + Rn() * 0.6) * (W / 80), y = 650 + Rn() * 6, w = 6 + Rn() * 16; wet.push([x, `M${f(x)} ${f(y)}h${f(w)}`]); }
      const pick = (arr, a, b) => arr.filter(([x]) => x >= a && x < b).map(e => e[1]).join('');
      const bandArr = (arr, tag, draw) => draw(pick(arr, -1e9, SPEC[0])) + G(tag, draw(pick(arr, SPEC[0], SPEC[1]))) + draw(pick(arr, SPEC[1], 1e9));
      s += bandArr(fo, DD('surf-foam'), d => F(d, v('foam')));
      s += bandArr(wl.map((e, i) => [e[0], e[1] + (wet[i] ? '' : '')]), DD('tideline-hatch'), d => S(d, v('seaFar'), 1.5)) + S(wet.map(e => e[1]).join(''), v('seaFar'), 1);
    }
    base.shore = s;
    // --- back row (tideline) -------------------------------------------------------------------------------
    // footprints: three-toed webbed prints wandering along the wet sand (seen through the open bus shelter)
    const print = (x, y) => `M${f(x)} ${f(y)}l3.6 -2.2l0.5 1.4l1.1 0.1l0 1.4l-1.1 0.3l-0.5 1.3z`;
    {
      let d = ''; for (let i = 0; i < 10; i++) d += print(66 + i * 9, 656 + (i % 2 ? 3 : 0) + Math.sin(i * 0.6) * 1.2);
      put(DD('footprints'), F(d, v('seaFar')));
      let d2 = ''; for (let i = 0; i < 14; i++) d2 += print(1180 + i * 9.5, 657 + (i % 2 ? 3 : 0)); s += F(d2, v('seaFar'));
    }
    // crab (anim: scuttle)
    const crab = tg => G({ transform: 'translate(122 668)' }, G({ class: 'land-a-crab', ...(tg ? DD('crab') : {}) },
      S('M-5 1l-4 3M-5 2.5l-3.5 4M5 1l4 3M5 2.5l3.5 4M-4.5 -0.5l-4 1M4.5 -0.5l4 1', R, 0.9) + F(ell(0, 0, 6, 3.8), R) + S('M-3 -1.2q3 1.4 6 0', O, 0.6) +
      S('M-2 -3.4v-2.4M2 -3.4v-2.4', N, 0.6) + F(circ(-2, -6, 0.9) + circ(2, -6, 0.9), N) +
      G({ class: 'land-a-claws' }, S('M-5 -1.5q-4 -2 -3.5 -6.5M5 -1.5q4 -2 3.5 -6.5', R, 1.2) + F('M-9.6 -8.8q1.8 -2.6 3.2 0.2l-1.2 1.2l-0.7 -1.2zM9.6 -8.8q-1.8 -2.6 -3.2 0.2l1.2 1.2l0.7 -1.2z', R))));
    anim.shore.push(crab);
    const star = (x, y, r) => { const p = []; for (let i = 0; i < 10; i++) { const a = -90 + i * 36, rr = i % 2 ? r * 0.42 : r; p.push([x + Math.cos(a * D2R) * rr, y + Math.sin(a * D2R) * rr * 0.62]); } return poly(p); };
    put(DD('starfish'), F(star(86, 672, 5.5), O) + F(circ(86, 672, 1), R));
    s += F(star(1296, 664, 4.4), O) + F(circ(1296, 664, 0.8), R);
    const shell = (x, y, sc) => [`M${f(x)} ${f(y)}l${f(-3.6 * sc)} ${f(-3.2 * sc)}a${f(3.8 * sc)} ${f(3.4 * sc)} 0 0 1 ${f(7.2 * sc)} 0z`,
      `M${f(x)} ${f(y)}l${f(-2.4 * sc)} ${f(-5 * sc)}M${f(x)} ${f(y)}V${f(y - 5.6 * sc)}M${f(x)} ${f(y)}l${f(2.4 * sc)} ${f(-5 * sc)}`];
    {
      const a = [shell(146, 672, 1.2), shell(156, 676, 0.9)], b = [shell(1276, 668, 0.9), shell(1310, 672, 1), shell(-80, 668, 1)];
      put(DD('shells'), F(a.map(e => e[0]).join(''), K) + S(a.map(e => e[1]).join(''), O, 0.5));
      s += F(b.map(e => e[0]).join(''), K) + S(b.map(e => e[1]).join(''), O, 0.5);
    }
    // rocks + seaweed + halftone (specimen at right; a second group further along the tile)
    const R2 = ctx.rng('land-rocks');
    const rockD = (x, y, w, hh) => { const pts = []; for (let i = 0; i <= 8; i++) { const a = Math.PI * i / 8; pts.push([x + w / 2 - Math.cos(a) * w / 2 * (0.9 + R2() * 0.2), y - Math.sin(a) * hh * (0.75 + R2() * 0.35)]); } pts.push([x + w, y + 2], [x, y + 2]); return smooth(pts); };
    defs += htPattern('land-htRock', 7, 3.5, 600, 700, () => 0.75, v('seaNear'));
    const rockGroup = (grp, tagged) => {
      let dN = '', dB = '', rim = '', ht = '', wd = '', sw = '';
      grp.forEach(([x, y, w, hh], i) => {
        const d = rockD(x, y, w, hh); if (i % 2) dB += d; else dN += d;
        rim += `M${f(x + w * 0.2)} ${f(y - hh * 0.55)}Q${f(x + w * 0.4)} ${f(y - hh * 0.92)} ${f(x + w * 0.62)} ${f(y - hh * 0.8)}`;
        if (i % 2) ht += ell(x + w * 0.7, y - hh * 0.3, w * 0.24, hh * 0.3);
        wd += `M${f(x + w * 0.1)} ${f(y - hh * 0.3)}q${f(w * 0.2)} ${f(-hh * 0.5)} ${f(w * 0.45)} ${f(-hh * 0.35)}t${f(w * 0.4)} ${f(hh * 0.5)}`;
        sw += `M${f(x + 4)} ${y + 1}q2 -8 -1 -13q5 3 4 13zM${f(x + 8)} ${y + 1}q3 -6 7 -8q-1 5 -5 8z`;
      });
      const rocks = F(dN, N) + F(dB, B) + S(rim, v('rim'), 1.1);
      const weed = F(sw, T) + S(wd, T, 1.5);
      return G(tagged ? DD('rocks') : {}, rocks) + G(tagged ? DD('seaweed') : {}, weed) + G(tagged ? DD('rock-halftone') : {}, F(ht, 'url(#land-htRock)'));
    };
    s += rockGroup([[1332, 666, 30, 16], [1356, 668, 40, 22], [1392, 667, 20, 11]], true);
    s += rockGroup([[-250, 664, 50, 24], [-206, 666, 26, 13], [560, 664, 44, 20], [1580, 666, 36, 18], [1612, 667, 22, 11]], false);
    // sandpipers
    {
      let sp = '', lg = '';
      for (const [x, y, fl] of [[1446, 652, 1], [1460, 654, -1], [1472, 651, 1]]) {
        sp += `M${x - 4 * fl} ${y - 6}q${3 * fl} -3.6 ${7 * fl} -1.2q${2 * fl} 1 ${4 * fl} 0.4l${-2.4 * fl} 1.4q${-2.6 * fl} 2.4 ${-7 * fl} 1.4zM${x + 3 * fl} ${y - 6.4}l${3.4 * fl} 0.8l${-3.4 * fl} 0.6z`;
        lg += `M${x - 1} ${y - 3.6}l-1 3.6M${x + 1} ${y - 3.6}l1.4 3.6`;
      }
      put(DD('sandpipers'), F(sp, N) + S(lg, N, 0.5));
    }
    put(DD('driftwood'), F('M1470 678q-4 -4 2 -6l40 -3q7 0 5 5l-4 2l-40 3z', B) + S('M1478 674q12 -2 26 -2M1484 677q10 -1 20 -2', v('rim'), 0.7) + F(ell(1492, 675.4, 2, 1.1), N) + S('M1516 672l6 -5', B, 1.6));
    // kite string to a peg (kite anim: bob)
    s += S('M1456 690Q1400 600 1290 514', N, 0.35) + F(rect(1454.5, 688, 3, 4), N);
    anim.shore.push(tg => G({ transform: 'translate(1290 500)' }, G({ class: 'land-a-kite', ...(tg ? DD('kite') : {}) },
      F('M0 -14L9 -2L0 4L-8 -2Z', R) + F('M0 -14L9 -2L0 -2Z', P) + F('M0 4L-8 -2L0 -2Z', P) + S('M0 -14V4M-8 -2H9', N, 0.6) +
      S('M0 4q-3 6 1 11t-1 11', N, 0.5) + F('M-2.4 8.2l2.4 1.2l2.2 -1.4l-2.2 -0.6zM-1.2 15.6l2.2 1l2 -1.2l-2 -0.6zM-2.8 22.6l2.2 1l2 -1.2l-2 -0.6z', O))));
    // --- front row (base 696) -----------------------------------------------------------------------------
    const HY = 696;
    const hut = (x, inkA, variant) => {
      const y = HY, w = 38, hh = 30, n = 5, sw = w / n; let g = '';
      g += F(rect(x - 2, y - 3, w + 4, 5), N);
      for (let i = 0; i < n; i++) g += F(rect(x + i * sw, y - hh, sw + 0.3, hh), i % 2 ? P : inkA);
      g += S(Array.from({ length: n + 1 }, (_, i) => `M${f(x + i * sw)} ${y - hh}v${hh}`).join(''), N, 0.5);
      if (variant === 'open') {
        g += F(`M${x + 13} ${y}v-17a6 6 0 0 1 12 0v17z`, N);
        g += F(`M${x + 13} ${y}v-17l-6 -3.5v23z`, P) + S(`M${x + 8.5} ${y - 9}h2`, N, 0.8);
        g += F(rect(x + 16.5, y - 16, 2.4, 11), R) + F(rect(x + 16.5, y - 13, 2.4, 1.6) + rect(x + 16.5, y - 9.5, 2.4, 1.6), P);
        g += S(`M${x + 20} ${y - 5}h3`, O, 1.2);
      } else g += F(`M${x + 13} ${y}v-17a6 6 0 0 1 12 0v17z`, N) + S(`M${x + 19} ${y - 22}v22`, P, 0.5) + F(circ(x + 22.3, y - 9, 0.9), O);
      g += F(`M${x - 5} ${y - hh}L${x + w / 2} ${y - hh - 17}L${x + w + 5} ${y - hh}Z`, N);
      g += S(`M${x - 4} ${y - hh + 0.5}L${x + w / 2} ${y - hh - 15.6}L${x + w + 4} ${y - hh + 0.5}`, P, 1.1);
      g += F(rect(x - 4, y - hh, w + 8, 2.6), N);
      let sc = ''; for (let i = 0; i < 8; i++) sc += `M${f(x - 3 + i * 5.5)} ${y - hh + 2.6}a2.75 2.4 0 0 0 5.5 0z`;
      return g + F(sc, N);
    };
    const hx = [176, 222, 268];
    put(DD('hut-open-door'), hut(hx[0], R, 'open'));
    put(DD('hut-plain'), hut(hx[1], T, 'plain'));
    put(DD('hut-towel-line'), hut(hx[2], O, 'plain') + S(`M${hx[2] + 38} ${HY - 21}Q${hx[2] + 50} ${HY - 16} ${hx[2] + 62} ${HY - 21}`, N, 0.6) + F(rect(hx[2] + 61, HY - 25, 1.8, 27), N));
    // more huts further along the beach (untagged, other colourways)
    s += hut(1560, R, 'plain') + hut(1606, T, 'open') + hut(-150, O, 'open') + hut(-104, R, 'plain');
    anim.shore.push(tg => G({}, [[hx[2] + 43, HY - 19.8, R, P], [hx[2] + 50.5, HY - 18.8, T, P], [hx[2] + 58, HY - 19.6, K, O]].map(([x, y, a, b], i) =>
      G({ transform: `translate(${f(x)} ${f(y)})` }, G({ class: 'land-a-towel' + i }, F(rect(-3.2, 0, 6.4, 11.5), a) + F(rect(-3.2, 3, 6.4, 1.5) + rect(-3.2, 6.8, 6.4, 1.5), b) + S('M-3.2 0.3h6.4', N, 0.7)))).join('')));
    {
      let bun = '', k = 0; const cols = [R, O, T, P];
      for (const [a, b] of [[hx[0] + 19, hx[1] + 19], [hx[1] + 19, hx[2] + 19]]) {
        const y0 = HY - 47; bun += S(`M${a} ${y0}Q${(a + b) / 2} ${y0 + 18} ${b} ${y0}`, N, 0.5);
        for (let i = 1; i <= 5; i++) { const u = i / 6, x = lerp(a, b, u), y = y0 + 2 * u * (1 - u) * 18; bun += F(`M${f(x - 2.2)} ${f(y)}h4.4l-2.2 5z`, cols[k++ % 4]); }
      }
      put(DD('bunting'), bun);
    }
    const plate = (x, y, num) => F(circ(x, y, 4.2), P) + F(gtext(String(num), x, y + 2.6, 7.4, { anchor: 'middle' }).d, N);
    put(DD('hut-number-plates'), hx.map((x, i) => plate(x + 19, HY - 38.5, 3 + i)).join(''));
    put(DD('hut-roof-finials'), F(hx.map(x => circ(x + 19, HY - 48.6, 1.8)).join(''), N) + S(`M${hx[1] + 19} ${HY - 49}v-9`, N, 0.8) + F(`M${hx[1] + 19.4} ${HY - 58}l7 2l-7 2.4z`, R));
    put(DD('surfboard'), F(`M${hx[1] + 38.6} ${HY}C${hx[1] + 36.4} ${HY - 14} ${hx[1] + 38} ${HY - 32} ${hx[1] + 41.8} ${HY - 38}C${hx[1] + 45} ${HY - 30} ${hx[1] + 45.2} ${HY - 12} ${hx[1] + 43.6} ${HY}Z`, T) +
      S(`M${hx[1] + 41.6} ${HY - 35}L${hx[1] + 41.2} ${HY - 2}`, R, 1.1));
    const parasol = (x, y, sc, inkA, tilt) => {
      const top = [x + Math.sin(tilt * D2R) * 40 * sc, y - Math.cos(tilt * D2R) * 40 * sc];
      let g = F(ell(x + 10 * sc, y + 1.5, 20 * sc, 2.6), v('seaFar')) + S(`M${x} ${y}L${f(top[0])} ${f(top[1])}`, N, 1.6 * sc), cn = '', tas = ['', ''];
      for (let i = 0; i < 6; i++) {
        const a0 = 180 + i * 30 + tilt, p0 = add(top, rot([28 * sc, 0], a0)), p1 = add(top, rot([28 * sc, 0], a0 + 30)), mid = add(top, rot([24 * sc, 0], a0 + 15));
        g += F(`M${f(top[0])} ${f(top[1])}L${f(p0[0])} ${f(p0[1])}Q${f(mid[0])} ${f(mid[1] + 6 * sc)} ${f(p1[0])} ${f(p1[1])}Z`, i % 2 ? P : inkA);
        cn += `M${f(top[0])} ${f(top[1])}L${f(p0[0])} ${f(p0[1])}`;
        const pm = add(top, rot([27 * sc, 0], a0 + 15)); tas[i % 2] += circ(pm[0], pm[1] + 1.6 * sc, 1.3 * sc);
      }
      return g + F(tas[0], P) + F(tas[1], inkA) + S(cn, N, 0.45) + F(circ(top[0], top[1] - 2 * sc, 1.8 * sc), N);
    };
    put(DD('parasol-orange'), parasol(356, 692, 0.95, O, -8));
    put(DD('parasol-teal'), parasol(1172, 693, 0.9, T, 14));
    s += parasol(-40, 692, 0.9, R, 6) + parasol(1650, 692, 0.85, O, -10);
    const deckchair = (x, y, stripeA, flip) => {
      const m = flip ? -1 : 1, X = dx => x + m * dx;
      let g = S(`M${X(0)} ${y}L${X(14)} ${y - 22}M${X(4)} ${y}L${X(-4)} ${y - 12}L${X(16)} ${y - 12}M${X(14)} ${y}L${X(9)} ${y - 13}`, N, 1.3);
      const a = [X(13), y - 21], b = [X(-2), y - 11], p = u => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
      for (let i = 0; i < 5; i++) { const q0 = p(i / 5), q1 = p((i + 1) / 5); g += F(`M${f(q0[0])} ${f(q0[1])}L${f(q1[0])} ${f(q1[1])}L${f(q1[0] + m * 5)} ${f(q1[1] + 4.5)}L${f(q0[0] + m * 5)} ${f(q0[1] + 4.5)}Z`, i % 2 ? P : stripeA); }
      return g;
    };
    put(DD('deckchair-red'), deckchair(364, 694, R, false));
    put(DD('deckchair-blue'), deckchair(1222, 694, B, true) + deckchair(1250, 695, B, true));
    {
      const x = 390, y = 694; let g = F(ell(x + 16, y + 1.2, 23, 3), v('seaFar'));
      g += F(`M${x} ${y}V${y - 12}h4v-3h3v3h4v-3h3v3h4v-3h3v3h4V${y}Z`, K);
      g += F(`M${x + 6} ${y - 12}V${y - 22}h3v-2.5h2.5v2.5h2.5v-2.5h2.5v2.5h2.5v-2.5h2.5v2.5h1V${y - 12}Z`, K);
      g += F(`M${x + 25} ${y}V${y - 17}h2.5v-2.5h2.2v2.5h2.2v-2.5h2.2v2.5H${x + 36}V${y}Z`, K);
      g += S(`M${x + 1} ${y - 5}h24M${x + 7} ${y - 16}h13M${x + 26} ${y - 9}h9`, O, 0.8);
      g += F(`M${x + 11} ${y}v-5a3 3 0 0 1 6 0v5z`, N) + F(rect(x + 11.6, y - 19, 1.8, 2.6) + rect(x + 29.6, y - 14, 1.6, 2.4), N);
      g += S(`M${x + 13} ${y - 24}v-8`, N, 0.6) + F(`M${x + 13.3} ${y - 32}l5 1.6l-5 1.6z`, R);
      put(DD('sandcastle'), g);
      put(DD('bucket-spade'), F(`M${x + 40} ${y - 11}h9l-1.3 11h-6.4z`, R) + S(`M${x + 40.3} ${y - 11}q4.2 -6 8.4 0`, N, 0.7) + F(rect(x + 40, y - 11, 9, 1.4), P) +
        S(`M${x + 38} ${y - 20}L${x + 36} ${y - 4}`, O, 1.2) + F(`M${x + 34.6} ${y - 5}l3.4 0.5l-0.4 5.8l-3.6 -0.6z`, T));
    }
    put(DD('beach-ball'), (() => { const x = 162, y = 690, r = 5.2; return F(ell(x + 1, y + r + 0.8, 5, 1.1), v('seaFar')) + F(circ(x, y, r), P) + F(`M${x} ${y - r}A${r} ${r} 0 0 1 ${x + r} ${y}L${x} ${y}Z`, R) + F(`M${x} ${y + r}A${r} ${r} 0 0 1 ${x - r} ${y}L${x} ${y}Z`, T) + F(`M${x + r} ${y}A${r} ${r} 0 0 1 ${x} ${y + r}L${x} ${y}Z`, O) + F(circ(x, y, 1.1), N); })());
    // windbreak + towel + hat (behind the rider in the hero frame; seen as the beach scrolls)
    { let g = ''; const xs = [600, 612, 624, 636]; for (let i = 0; i < 3; i++) g += F(`M${xs[i]} ${680 + i * 0.6}L${xs[i + 1]} ${681 + i * 0.6}V${693.6 + i * 0.3}L${xs[i]} ${693 + i * 0.3}Z`, i % 2 ? P : T); s += g + S(xs.map((x, i) => `M${x} ${678.5 + i * 0.6}V${695.5 + i * 0.3}`).join(''), N, 1.2); }
    s += F('M646 697l26 -3l3 4l-26 3z', R) + S('M652 696.3l3.2 4M659 695.5l3.2 4M666 694.7l3.2 4', P, 1.2) + F(ell(656, 694.5, 5, 1.7) + ell(656, 692.4, 2.8, 2.4), K) + S('M653.4 693.4h5.2', R, 0.8);
    // lifeguard tower
    {
      const x = 1100, y = 698; let g = '';
      g += S(`M${x} ${y}L${x + 4} ${y - 40}M${x + 26} ${y}L${x + 22} ${y - 40}M${x + 1.5} ${y - 10}L${x + 23} ${y - 36}M${x + 24.5} ${y - 10}L${x + 3} ${y - 36}M${x + 1} ${y - 22}h24`, N, 1.5);
      g += S(`M${x + 30} ${y}L${x + 24} ${y - 40}M${x + 35} ${y}L${x + 29} ${y - 40}` + [0, 1, 2, 3, 4, 5].map(i => `M${f(x + 30 - i * 1.2)} ${y - 5 - i * 6.4}h5`).join(''), N, 0.9);
      g += F(rect(x - 2, y - 43, 30, 4), N) + S(`M${x - 2} ${y - 43}v-7h30v7M${x + 5} ${y - 50}v7M${x + 12} ${y - 50}v7M${x + 19} ${y - 50}v7`, N, 0.9);
      g += F(rect(x + 1, y - 64, 24, 15), P) + F(rect(x + 5, y - 61, 9, 7), N) + F(rect(x + 16, y - 61, 6, 12), B) + S(`M${x + 9.5} ${y - 61}v7M${x + 5} ${y - 57.5}h9`, P, 0.5);
      g += F(`M${x - 4} ${y - 63}L${x + 13} ${y - 72}L${x + 30} ${y - 63}Z`, R) + S(`M${x - 4} ${y - 63}H${x + 30}M${x + 13} ${y - 72}v-12`, N, 0.9);
      put(DD('lifeguard-tower'), g);
      put(DD('lifeguard-cross-flag'), F(rect(x + 2.5, y - 48.5, 7, 7), P) + F(rect(x + 5.2, y - 47.7, 1.6, 5.4) + rect(x + 3.3, y - 45.8, 5.4, 1.6), R));
      anim.shore.push(tg => G({ transform: `translate(${x + 13} ${y - 84})` }, G({ class: 'land-a-towerflag' }, F('M0.4 0Q5 -1.4 10 0.6Q7 2.5 10 5Q5 3.4 0.4 5Z', R) + F('M0.4 2Q5 0.8 8.6 2.6L8.6 3.2Q5 1.6 0.4 2.9Z', P))));
      put(DD('life-ring'), F(circ(x + 22, y - 32, 4.6), O) + F(circ(x + 22, y - 32, 2.3), v('sand')) + F(`M${x + 21.2} ${y - 36.6}h1.6v2.3h-1.6zM${x + 21.2} ${y - 29.7}h1.6v2.3h-1.6zM${x + 17.4} ${y - 32.8}v1.6h2.3v-1.6zM${x + 24.3} ${y - 32.8}v1.6h2.3v-1.6z`, P));
    }
    // stream variants (drawn by the same generators, centred on x = 0)
    SYM += [[R, 'open'], [T, 'plain'], [O, 'open'], [B, 'plain']].map(([ink, vr], k) => G({ id: 'land-y-hut' + k }, hut(-19, ink, vr))).join('');
    SYM += [[O, -8], [T, 14]].map(([ink, tl], k) => G({ id: 'land-y-par' + k }, parasol(0, 692, 0.92, ink, tl))).join('');
    SYM += [[R, false], [B, true]].map(([ink, fl], k) => G({ id: 'land-y-deck' + k }, deckchair(fl ? 7 : -7, 694, ink, fl))).join('');
    SYM += [[[-30, 666, 30, 16], [-6, 668, 40, 22], [30, 667, 20, 11]], [[-40, 664, 50, 24], [4, 666, 26, 13], [24, 667, 18, 9]], [[-18, 665, 36, 18], [14, 667, 22, 11]]]
      .map((grp, k) => G({ id: 'land-y-rock' + k }, rockGroup(grp, false))).join('');
    return s;
  })();

  // ========================================================================= ROADSIDE (depth 0.9)
  const roadside = (() => {
    const L = LAY.roadside, W = L.W, X0 = L.x0 - 3, X1 = L.x1 + 3;
    let s = '';
    const put = (o, g) => { s += G(RID(o), g); };
    // --- balustrade + plinth + pavement (continuous, periodic over W)
    {
      const pierSp = W / 8, balSp = pierSp / 12;
            defs += htPattern('land-htPlinth', W, 5, 731, 742, y => lerp(0.4, 1.8, (y - 731) / 10), v('seaNear'), v('hillFar'));
      s += band(X0, X1, DD('plinth-halftone'), (a, b) => F(rect(a, 729.5, b - a, 12), 'url(#land-htPlinth)'));
      const bal = [], piers = [];
      for (let i = -1; i <= 8 * 12; i++) {
        if (((i % 12) + 12) % 12 === 0) continue;
        const x = L.x0 + i * balSp + balSp / 2;
        bal.push([x, `M${f(x - 3.4)} 730v-2.2h6.8v2.2zM${f(x - 2.8)} 727.8c-2.6 -3 -2 -8.2 1.4 -11.6q1.4 -1.4 1.4 -3.2q0 1.8 1.4 3.2c3.4 3.4 4 8.6 1.4 11.6zM${f(x - 1.6)} 713v-2.2h3.2v2.2zM${f(x - 3.4)} 710.8v-2.2h6.8v2.2z`]);
      }
      for (let i = -1; i <= 8; i++) piers.push(L.x0 + i * pierSp);
      const balIn = (a, b) => bal.filter(([x]) => x >= a && x < b).map(e => e[1]).join('');
      s += band(X0, X1, DD('balustrade'), (a, b) => F(balIn(a, b), v('hillFar')) + F(rect(a, 706, b - a, 2.6), v('seaNear')) + F(rect(a, 701.8, b - a, 4.6), v('foam')));
      const pierD = x => ({ body: rect(x - 7, 707, 14, 23), shade: rect(x + 3.5, 707, 3.5, 23), cap: rect(x - 9, 703, 18, 3.5) + rect(x - 6.5, 700, 13, 3) + circ(x, 696.2, 3.8) + rect(x - 1.4, 699, 2.8, 1.5), panel: `M${f(x - 4)} 712v14M${f(x)} 712v14` });
      const pierM = xs => { const d = xs.map(pierD); return F(d.map(e => e.body).join(''), v('hillFar')) + F(d.map(e => e.shade).join(''), v('seaNear')) + F(d.map(e => e.cap).join(''), v('foam')) + S(d.map(e => e.panel).join(''), v('seaNear'), 0.8); };
      const pSpec = piers.filter(x => x >= 300 && x < SPEC[1]);
      s += pierM(piers.filter(x => !pSpec.includes(x))) + G(DD('balustrade-piers'), pierM(pSpec));
      // pavement (road-toned slabs; the P kerb of the road layer separates it from the carriageway)
      const joints = (a, b) => { let d = ''; for (let i = -2; i < 36; i++) { const x = L.x0 + i * W / 32; if (x >= a && x < b) d += `M${f(x)} 743.5l-2.6 8.5`; } return d; };
            s += band(X0, X1, DD('pavement'), (a, b) => F(rect(a, 741, b - a, 12.5), v('road')) + F(rect(a, 741, b - a, 1.8), v('seaNear')) + S(joints(a, b), v('hillFar'), 0.9) + S(`M${f(a)} 747.2H${f(b)}`, v('hillFar'), 0.5));
    }
    base.roadside = s;
    // --- hedges
    const hedge = (x, w, hh, tagged) => {
      const y = BASE; let tx = '';
      for (let r = 0; r < 3; r++) for (let c = 0; c < w / 8 - 1; c++) { const xx = x + 6 + c * 8 + (r % 2 ? 4 : 0), yy = y - hh + 8 + r * (hh - 12) / 3; if (xx < x + w - 6) tx += `M${f(xx - 3.4)} ${f(yy)}a3.4 3 0 0 0 6.8 0z`; }
      return G(tagged ? DD('hedge') : {}, F(`M${x} ${y}V${y - hh + 5}q0 -5 5 -5H${x + w - 5}q5 0 5 5V${y}Z`, v('foliage')) + F(rect(x, y - 6, w, 6), v('trunk')) +
        G(tagged ? DD('hedge-texture') : {}, F(tx, v('trunk'))));
    };
    s += hedge(1214, 100, 32, true) + hedge(452, 96, 26) + hedge(690, 92, 24) + hedge(860, 96, 26);
    SYM += G({ id: 'land-y-hedge0' }, hedge(-48, 96, 26)) + G({ id: 'land-y-hedge1' }, hedge(-62, 124, 34));
    // --- palms (trunk static, crown in the anim group)
    const palm = (x0, y0, x1, y1, sc, bend, key) => {
      const c = [(x0 + x1) / 2 + bend * sc, (y0 + y1) / 2], pts = [];
      for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push([(1 - t) ** 2 * x0 + 2 * t * (1 - t) * c[0] + t * t * x1, (1 - t) ** 2 * y0 + 2 * t * (1 - t) * c[1] + t * t * y1]); }
      const left = [], right = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], Ln = Math.hypot(dx, dy);
        const w = lerp(14, 8, i / 24) * sc; left.push([pts[i][0] - dy / Ln * w, pts[i][1] + dx / Ln * w]); right.push([pts[i][0] + dy / Ln * w, pts[i][1] - dx / Ln * w]);
      }
      // ring scars: filled crescents
      let rings = '';
      for (let i = 1; i < 24; i++) for (const hf of [0, 0.5]) {
        if (i + hf > 23.6) continue;
        const lp = (arr) => [lerp(arr[i][0], arr[Math.min(24, i + 1)][0], hf), lerp(arr[i][1], arr[Math.min(24, i + 1)][1], hf)];
        const a = lp(left), b = lp(right), m = [lerp(a[0], b[0], 0.5), lerp(a[1], b[1], 0.5) + 3.4 * sc];
        rings += `M${f(a[0])} ${f(a[1])}Q${f(m[0])} ${f(m[1])} ${f(b[0])} ${f(b[1])}Q${f(m[0])} ${f(m[1] + 4.4 * sc)} ${f(a[0])} ${f(a[1])}Z`;
      }
      put(DD(key), F(poly([...left, ...right.slice().reverse()]) + ell(x0, y0, 20 * sc, 3), v('trunk')) + G(key === 'palm-tall' ? DD('palm-trunk-rings') : {}, F(rings, v('foliage'))));
      const fr = [[-178, 150, .55], [-150, 165, .42], [-118, 120, .25], [-72, 120, .25], [-35, 160, .42], [-6, 150, .6], [160, 110, .5], [25, 105, .55]];
      let dN = '', dT = '';
      fr.forEach(([a, Lf, droop], k) => {
        const len = Lf * sc, dir = rot([1, 0], a), tip = [dir[0] * len, dir[1] * len + len * droop], ctrl = [dir[0] * len * 0.55, dir[1] * len * 0.55 - len * 0.18];
        const Q = t => [2 * t * (1 - t) * ctrl[0] + t * t * tip[0], 2 * t * (1 - t) * ctrl[1] + t * t * tip[1]];
        const up = [], dn = [];
        for (let i = 0; i <= 16; i++) {
          const t = i / 16, q = Q(t), q2 = Q(Math.min(1, t + .02)), q1 = Q(Math.max(0, t - .02));
          const tx = q2[0] - q1[0], ty = q2[1] - q1[1], tl = Math.hypot(tx, ty) || 1; let nx = -ty / tl, ny = tx / tl; if (ny < 0) { nx = -nx; ny = -ny; }
          const w = 16 * sc * Math.sin(Math.PI * Math.min(1, t * 1.05)) ** 0.8, notch = i % 2 ? 0.45 : 1.15, ex = i % 2 ? 0 : 6 * sc;
          up.push([q[0] - nx * w * 0.35, q[1] - ny * w * 0.35]); dn.push([q[0] + nx * w * notch + tx / tl * ex, q[1] + ny * w * notch + ty / tl * ex]);
        }
        const d = poly([...up, ...dn.reverse()]); if (k % 3 === 1) dT += d; else dN += d;
      });
      const nuts = circ(-6 * sc, 8 * sc, 6 * sc) + circ(6 * sc, 10 * sc, 6 * sc) + circ(0, 16 * sc, 5.5 * sc);
      anim.roadside.push(tg => G({ transform: `translate(${f(x1)} ${f(y1)})` }, G({ class: 'land-a-crown-' + key },
        F(dT, v('foliage')) + F(dN, v('trunk')) + G(tg && key === 'palm-tall' ? DD('coconuts') : {}, F(nuts, O), S(`M${f(-8 * sc)} ${f(5 * sc)}a3 3 0 0 1 3 -2M${f(4 * sc)} ${f(7 * sc)}a3 3 0 0 1 3 -2`, P, 0.9)))));
    };
    palm(1545, BASE - 2, 1470, 128, 1.1, 70, 'palm-tall');
    palm(1418, BASE - 2, 1364, 212, 0.86, 34, 'palm-medium');
    // --- flower beds
    {
      const x = 1436, y = BASE, w = 78; let g = F(`M${x} ${y}V${y - 13}h${w}V${y}Z`, P) + S(`M${x} ${y - 13}h${w}M${x + 26} ${y - 13}v13M${x + 52} ${y - 13}v13M${x} ${y - 6.5}h${w}`, v('seaNear'), 0.8);
      g += F(`M${x + 2} ${y - 13}q4 -14 16 -11q6 -9 16 -3q8 -8 18 -1q10 -6 16 2q8 -2 8 13z`, v('foliage'));
      const Rf = ctx.rng('land-flowers'); let fa = '', fb = '';
      for (let i = 0; i < 13; i++) { const c = circ(x + 8 + i * 5 + Rf() * 2, y - 19 - Rf() * 7, 1.7 + Rf() * 0.8); if (i % 2) fa += c; else fb += c; }
      put(DD('flower-bed'), g + F(fa, R) + F(fb, O) + S(`M${x + 20} ${y - 18}l1 2M${x + 44} ${y - 22}l1 2`, v('trunk'), 0.8));
      s += F(`M${x - 860} ${y}V${y - 12}h70V${y}Z`, P) + F(`M${x - 858} ${y - 12}q4 -12 14 -10q6 -8 14 -2q8 -7 16 0q10 -5 14 2q8 -1 10 10z`, v('foliage'));
      const x2 = 170 - 150 + 1520, y2 = BASE; // tulips at the right edge (x 1540)
      let g2 = F(`M${x2} ${y2}V${y2 - 12}h56V${y2}Z`, K) + S(`M${x2} ${y2 - 12}h56M${x2 + 28} ${y2 - 12}v12`, O, 0.8) + F(`M${x2 + 3} ${y2 - 12}q0 -10 10 -10h30q10 0 10 10z`, v('foliage'));
      let tu = '', tu2 = '', st = '';
      for (let i = 0; i < 8; i++) { const tx = x2 + 8 + i * 6, ty = y2 - 29 - (i % 3) * 2; st += `M${tx} ${ty + 3}v${8 - (i % 3)}`; const tp = `M${tx - 2.2} ${ty}v2.5a2.2 2.2 0 0 0 4.4 0v-2.5l-1.1 1.2l-1.1 -1.4l-1.1 1.4z`; if (i % 2) tu += tp; else tu2 += tp; }
      put(DD('flower-bed-tulips'), g2 + S(st, v('trunk'), 0.8) + F(tu, R) + F(tu2, P));
    }
    // --- open bus shelter with the poster end wall, timetable, sign, bin
    {
      const x = 14, y = BASE, w = 162; let g = '';
      g += F(rect(x + 12, y - 150, 5, 150) + rect(x + w - 12, y - 150, 5, 150), N);
      g += F(`M${x} ${y - 150}q0 -16 20 -16h${w - 40}q20 0 20 16v4h-${w}z`, v('foliage'));
      g += S(`M${x + 8} ${y - 158}h${w - 18}M${x + 12} ${y - 153}h${w - 10}`, v('foam'), 1) + F(rect(x, y - 146, w, 3), N);
      g += F(rect(x + 40, y - 34, 110, 4), O) + F(rect(x + 46, y - 30, 3, 30) + rect(x + 141, y - 30, 3, 30), N) + S(`M${x + 44} ${y - 32}h102`, v('trunk'), 0.6);
      const shelter = g;
      // end wall with a vintage poster
      const wx = x + 3, ww = 48;
      let wall = F(rect(wx, y - 143, ww, 143), P) + F(rect(wx + ww - 6, y - 143, 6, 143), K) + F(rect(wx - 2, y - 146, ww + 4, 5), R);
      let tl = ''; for (let i = 0; i < 6; i++) tl += `M${wx + 2 + i * 9} ${y - 146}v5`;
      wall += S(tl, v('foam'), 0.6) + S(`M${wx} ${y - 22}h${ww}`, K, 1.2);
      const px = wx + 5, py = y - 128, pw = 36, ph = 52;
      let p = F(rect(px - 1.5, py - 1.5, pw + 3, ph + 3), N) + F(rect(px, py, pw, ph), B);
      let rays = ''; const c0 = [px + pw * 0.62, py + 30];
      for (let i = 0; i < 7; i++) { const a0 = 190 + i * 24, p0 = add(c0, rot([48, 0], a0)), p1 = add(c0, rot([48, 0], a0 + 11)); rays += `M${f(c0[0])} ${f(c0[1])}L${f(p0[0])} ${f(p0[1])}L${f(p1[0])} ${f(p1[1])}Z`; }
      defs += h('clipPath', { id: 'land-posterClip' }, h('rect', { x: px, y: py, width: pw, height: ph }));
      p += G({ 'clip-path': 'url(#land-posterClip)' }, F(rays, R) + F(rect(px, py + 23, pw, 7), O) + F(circ(c0[0], c0[1], 7), P) + F(rect(px, py + 30, pw, 10), T) + S(`M${px + 3} ${py + 34}h9M${px + 18} ${py + 37}h14`, P, 0.7));
      p += F(`M${px + 7} ${py + 28}c0 -6 4 -7 7 -6c1.4 -4 4 -4 5.6 -2l4.4 0.7l-4.4 0.7c-0.7 2 -2 3 -3.6 3c1.4 2 0.7 4 -2.8 4.8c-3.6 0.7 -6.2 0 -6.2 -1.2z`, P);
      p += F(rect(px, py + 40, pw, 12), P) + F(gtext('PELICAN BAY', px + pw / 2, py + 46.2, 4.6, { anchor: 'middle', sx: 0.86 }).d, N) + F(gtext('鹈鹕湾', px + pw / 2, py + 50.8, 3.6, { anchor: 'middle' }).d, R);
      p += F(`M${px + pw} ${py + ph}h-5l5 -5z`, K) + F(rect(px + 1, py + 1, 2.4, 2.4) + rect(px + pw - 3.4, py + 1, 2.4, 2.4), P);
      put(DD('poster-wall'), wall + G(DD('vintage-poster'), p));
      put(DD('bus-shelter'), shelter);
      const tx = x + w - 42; let rows = ''; for (let i = 0; i < 7; i++) rows += `M${tx + 3} ${y - 104 + i * 5}h7M${tx + 13} ${y - 104 + i * 5}h${5 + (i * 7) % 9}`;
      put(DD('bus-timetable'), F(rect(tx, y - 118, 28, 50), P) + F(rect(tx, y - 118, 28, 8), N) + F(gtext('BUS 7', tx + 14, y - 111.8, 5.2, { anchor: 'middle' }).d, P) + S(rows, N, 1.3) + S(`M${tx + 11.5} ${y - 106}v34`, B, 0.5));
      const bx = x + w + 4;
      put(DD('litter-bin'), F(`M${bx + 1.4} ${y}l-1.4 -26h15l-1.4 26z`, v('foliage')) + F(rect(bx - 1.4, y - 29, 17.8, 3), N) + S(`M${bx + 0.6} ${y - 18}h13.8M${bx + 1} ${y - 8}h13`, v('foam'), 1));
      const px2 = bx + 26;
      put(DD('bus-stop-sign'), F(rect(px2 - 2, y - 190, 4, 190), N) + F(circ(px2, y - 200, 18), R) + F(circ(px2, y - 200, 14.5), P) + F(rect(px2 - 18, y - 204, 36, 9), R) +
        F(gtext('BUS', px2, y - 196.4, 8, { anchor: 'middle', track: 0.6 }).d, P) + F(gtext('巴士', px2, y - 206.4, 7.6, { anchor: 'middle' }).d + gtext('站', px2, y - 184, 6.4, { anchor: 'middle' }).d, N));
    }
    // --- bench + cat
    {
      const x = 212, y = BASE; let g = '';
      g += S(`M${x + 4} ${y}q-2 -6 2 -12q-3 -6 0 -18M${x + 76} ${y}q2 -6 -2 -12q3 -6 0 -18`, N, 2.2);
      g += F(rect(x, y - 15, 80, 3) + rect(x + 1, y - 19, 78, 3) + rect(x + 2, y - 30, 76, 2.6) + rect(x + 2, y - 35, 76, 2.6) + rect(x + 2, y - 40, 76, 2.6), v('foliage'));
      g += S(`M${x + 4} ${y - 30}a2.5 2.5 0 1 1 3 -3M${x + 76} ${y - 30}a2.5 2.5 0 1 0 -3 -3M${x + 40} ${y - 12}v12`, N, 1.2);
      put(DD('bench'), g);
      const cx = x + 56, cy = y - 19;
      let c = F(`M${cx - 9} ${cy}c-2 -8 0 -15 5 -18c-1 -3 0 -5 1 -7l2 3h4l2 -3c1 2 2 4 1 7c3 2 4 5 3 8c3 3 4 7 2 10z`, O);
      c += S(`M${cx - 6} ${cy - 5}q3 -1 5 1M${cx - 7} ${cy - 9}q3 -1 5 1M${cx + 3} ${cy - 20}q-1 2 0 3M${cx + 5.5} ${cy - 19.4}v2.6`, N, 0.9);
      c += F(circ(cx + 1.6, cy - 17.4, 0.9) + circ(cx + 6.4, cy - 17.4, 0.9), N) + F(`M${cx + 3.4} ${cy - 15.6}h1.4l-0.7 0.9z`, R) + S(`M${cx + 7.5} ${cy - 15.4}h4M${cx + 7.5} ${cy - 14.3}l3.6 1`, P, 0.4);
      c += F(ell(cx - 1, cy - 1, 4, 1.8), O) + S(`M${cx - 3} ${cy}v-4M${cx + 1} ${cy}v-4`, N, 0.6);
      put(DD('cat'), c);
      anim.roadside.push(() => G({ transform: `translate(${cx - 8} ${cy - 2})` }, G({ class: 'land-a-cattail' }, S('M0 0q-8 2 -10 -5q-2 -6 2 -11', O, 2.6) + S('M-8.6 -3.2l2 -1M-9.6 -9l2.2 0.4', N, 0.9))));
    }
    // --- lamp posts (identical) + accessory variants
    const lamp = x => {
      const y = BASE; let g = '';
      g += F(`M${x - 13} ${y}v-6h26v6zM${x - 10} ${y - 6}v-7h20v7zM${x - 7} ${y - 13}v-6h14v6z`, N);
      g += F(`M${x - 4} ${y - 19}L${x - 3} ${y - 262}h6L${x + 4} ${y - 19}z`, N);
      g += F(rect(x - 6.5, y - 120, 13, 5) + rect(x - 5.5, y - 114, 11, 2.4) + rect(x - 5.5, y - 205, 11, 4) + rect(x - 7, y - 268, 14, 6), N);
      g += S(`M${x - 1.2} ${y - 24}L${x - 0.9} ${y - 112}M${x + 1.2} ${y - 24}L${x + 0.9} ${y - 112}M${x - 1} ${y - 124}L${x - 0.8} ${y - 200}M${x + 1} ${y - 124}L${x + 0.8} ${y - 200}`, B, 0.6);  // fluting
      g += S(`M${x} ${y - 250}c-14 -2 -22 8 -16 16c4 5 10 1 7 -3M${x} ${y - 250}c14 -2 22 8 16 16c-4 5 -10 1 -7 -3`, N, 2.2);
      g += F(`M${x - 8} ${y - 268}l3 -4h10l3 4z`, N);
      g += F(circ(x, y - 286, 13), P) + S(`M${x - 13} ${y - 286}h26M${x} ${y - 299}v26`, v('lampGlow'), 0.7) + S(`M${x - 8} ${y - 288}a8 8 0 0 1 6 -7`, v('lampGlow'), 1.4);
      g += F(`M${x - 9} ${y - 297}q9 -6 18 0l-2 -5h-14zM${x - 5} ${y - 302}l2 -5h6l2 5zM${x - 1.2} ${y - 307}v-6h2.4v6z`, N) + F(circ(x, y - 314.5, 2.2), N);
      return g;
    };
    put(DD('lamp-post'), lamp(LAMP_X[0]));
    s += lamp(LAMP_X[1]);
    base.roadside += lamp(LAMP_X[0]) + lamp(LAMP_X[1]);
    {
      const x = LAMP_X[0] + 16, y = BASE - 214;
      let g = S(`M${LAMP_X[0] + 3} ${y - 22}h14M${x} ${y - 22}l-6 14M${x} ${y - 22}l6 14`, N, 0.8) + F(`M${x - 8} ${y - 8}h16l-2.5 8h-11z`, O) + S(`M${x - 7} ${y - 5}h14M${x - 6} ${y - 2}h12`, R, 0.6);
      g += F(`M${x - 10} ${y - 8}q0 -7 5 -7q2 -4 5 -2q3 -3 6 1q4 0 4 8z`, v('foliage')) + F(circ(x - 6, y - 11, 1.6) + circ(x + 1, y - 13, 1.6) + circ(x + 6, y - 9.5, 1.5), R) + F(circ(x - 2, y - 9, 1.4) + circ(x + 3.4, y - 12.5, 1.2), P);
      g += S(`M${x - 7} ${y}q-2 6 0 10M${x + 6} ${y}q2 5 -1 9M${x} ${y}v7`, v('foliage'), 1.4);
      put(DD('lamp-flower-basket'), g);
      const bx = LAMP_X[1] + 3.5, by = BASE - 196;
      let b = S(`M${bx} ${by}h18M${bx} ${by + 52}h14`, N, 1.4) + F(`M${bx + 1} ${by + 1}h16v46l-8 -6l-8 6z`, R) + S(`M${bx + 3} ${by + 3}h12v38.5l-6 -4.5l-6 4.5z`, P, 0.7) + F(circ(bx + 9, by + 16, 4.2), P);
      let rays = ''; for (let i = 0; i < 8; i++) { const p0 = add([bx + 9, by + 16], rot([5.6, 0], i * 45)), p1 = add([bx + 9, by + 16], rot([7.6, 0], i * 45)); rays += `M${f(p0[0])} ${f(p0[1])}L${f(p1[0])} ${f(p1[1])}`; }
      b += S(rays, P, 1) + S(`M${bx + 4} ${by + 30}q2.5 -2 5 0t5 0M${bx + 4} ${by + 34}q2.5 -2 5 0t5 0`, P, 0.9);
      put(DD('lamp-banner'), b);
    }
    defs += h('radialGradient', { id: 'land-glowG', cx: 0.5, cy: 0.5, r: 0.5 },
      ...[[0, 'lamp', 0.95], [0.26, 'lamp', 0.95], [0.26, 'lampGlow', 0.62], [0.55, 'lampGlow', 0.62], [0.55, 'lampGlow', 0.26], [1, 'lampGlow', 0.26]]
        .map(([o, tk, op]) => h('stop', { offset: o, style: `stop-color:${v(tk)};stop-opacity:${op}` })));
    defs += h('radialGradient', { id: 'land-poolG', cx: 0.5, cy: 0.5, r: 0.5 },
      ...[[0, 'lamp', 0.55], [0.4, 'lamp', 0.55], [0.4, 'lampGlow', 0.34], [0.72, 'lampGlow', 0.34], [0.72, 'lampGlow', 0.14], [1, 'lampGlow', 0.14]]
        .map(([o, tk, op]) => h('stop', { offset: o, style: `stop-color:${v(tk)};stop-opacity:${op}` })));
    anim.roadside.push(tg => G({ class: 'land-glow', display: 'none', ...(tg ? DD('lamp-glow') : {}) },
      LAMP_X.map(x => F(circ(x, BASE - 286, 64), 'url(#land-glowG)') + F(circ(x, BASE - 286, 12.2), v('lamp'))).join('')) +
      G({ class: 'land-glow', display: 'none', ...(tg ? DD('pavement-pool') : {}) }, LAMP_X.map(x => F(ell(x, BASE - 4, 70, 9), 'url(#land-poolG)')).join('')));
    baseAnim.roadside = anim.roadside[anim.roadside.length - 1];
    // --- mailbox
    {
      const x = 349, y = BASE;
      let g = F(rect(x - 11, y - 4, 22, 4), N) + F(`M${x - 9} ${y - 4}V${y - 54}h18V${y - 4}z`, R) + F(`M${x - 11} ${y - 54}h22v-4h-22zM${x - 9.5} ${y - 58}a9.5 7 0 0 1 19 0z`, R);
      g += S(`M${x - 11} ${y - 54}h22M${x - 9} ${y - 12}h18`, N, 0.8) + F(rect(x - 6, y - 50, 12, 2.2), N) + F(circ(x, y - 66, 1.8), R) + S(`M${x + 6.5} ${y - 46}v30`, v('rim'), 1);
      put(DD('mailbox'), g + G(DD('mailbox-lettering'), F(rect(x - 6.5, y - 42, 13, 17), P) + F(gtext('邮', x, y - 32.2, 9, { anchor: 'middle' }).d + gtext('POST', x, y - 27, 4.6, { anchor: 'middle' }).d, R)));
    }
    // --- telescope
    {
      const x = 406, y = BASE;
      put(DD('telescope'), F(`M${x - 8} ${y}l3 -5h10l3 5z`, N) + F(rect(x - 1.6, y - 36, 3.2, 31), N) + F(`M${x - 5} ${y - 36}l5 -5l5 5z`, N) +
        F(`M${x - 12} ${y - 48}l20 -7l3 7l-20 7z`, v('foliage')) + F(`M${x + 8} ${y - 55}l4 -1.4l3 8l-4 1.4z`, N) + F(`M${x - 13} ${y - 48}l-2 0.6l2.4 6.6l2 -0.6z`, N) +
        F(circ(x - 1, y - 45, 2.3), P) + S(`M${x - 8} ${y - 47}l14 -5`, v('rim'), 0.8));
    }
    // --- fish stand
    {
      const x = 970, y = BASE, w = 120; let g = '';
      g += F(rect(x + 4, y - 128, 5, 128) + rect(x + w - 9, y - 128, 5, 128), N) + F(rect(x, y - 52, w, 52), O);
      g += S(Array.from({ length: 6 }, (_, i) => `M${x} ${y - 44 + i * 8}h${w}`).join('') + `M${x + 40} ${y - 52}v52M${x + 80} ${y - 52}v52`, N, 0.7) + F(rect(x - 4, y - 56, w + 8, 5), N);
      put(DD('fish-stand'), g + G(DD('price-board'), F(rect(x + 50, y - 44, 22, 26), N) + F(rect(x + 52, y - 42, 18, 22), v('foliage')) + S(`M${x + 55} ${y - 37}h8M${x + 55} ${y - 33}h11M${x + 55} ${y - 29}h6M${x + 55} ${y - 25}h10`, P, 0.8)));
      let aw = ''; const n = 10, sw = (w + 16) / n;
      for (let i = 0; i < n; i++) aw += F(`M${f(x - 8 + i * sw)} ${y - 128}L${f(x - 8 + (i + 1) * sw)} ${y - 128}L${f(x - 8 + (i + 1) * sw + 1)} ${y - 112}L${f(x - 8 + i * sw + 1)} ${y - 112}Z`, i % 2 ? P : R);
      let va = '', vb = ''; for (let i = 0; i < n; i++) { const d = `M${f(x - 7 + i * sw)} ${y - 112}h${f(sw)}v2a${f(sw / 2)} ${f(sw / 2.2)} 0 0 1 ${f(-sw)} 0z`; if (i % 2) va += d; else vb += d; }
      aw += F(va, P) + F(vb, R) + S(`M${x - 8} ${y - 128}h${w + 16}`, N, 1.6) + S(Array.from({ length: n }, (_, i) => `M${f(x - 7 + (i + 0.5) * sw)} ${y - 106}v1`).join(''), N, 1.6);
      put(DD('fish-awning'), aw);
      put(DD('fish-sign'), F(rect(x + 6, y - 150, w - 12, 22), N) + F(gtext('鲜鱼', x + 12, y - 132.5, 15).d, P) + F(gtext('FRESH FISH', x + 78, y - 136, 6.4, { anchor: 'middle', track: 0.4 }).d, K) + S(`M${x + 52} ${y - 146}h52M${x + 52} ${y - 132}h52`, O, 0.6));
      let ct = F(`M${x + 6} ${y - 56}l6 -9h${w - 24}l6 9z`, P), fh = '';
      for (let i = 0; i < 6; i++) { const fx = x + 18 + i * 15; fh += `M${fx} ${y - 62}q7 -6 14 -1l3 -3v8l-3 -3q-7 5 -14 -1z`; }
      ct += F(fh, B) + F(Array.from({ length: 6 }, (_, i) => circ(x + 21 + i * 15, y - 62.4, 0.9)).join(''), P) + F(ell(x + 108, y - 60, 3.6, 2.6) + ell(x + 12, y - 60, 3, 2.3), O);
      put(DD('fish-counter'), ct);
      let cr = F(rect(x + w + 4, y - 20, 34, 20) + rect(x + w + 8, y - 38, 28, 17), O) + S(`M${x + w + 4} ${y - 10}h34M${x + w + 8} ${y - 30}h28M${x + w + 21} ${y - 20}v20`, N, 0.8);
      cr += F(`M${x + w + 10} ${y - 38}q5 -5 10 0q5 -5 10 0q4 -4 5 0z`, B) + F(`M${x + w + 13} ${y - 39}l-4 -3v5z`, B);
      put(DD('fish-crates'), cr);
      const scx = x + 100;
      put(DD('fish-scale'), S(`M${scx} ${y - 110}v10M${scx - 9} ${y - 100}h18M${scx - 9} ${y - 100}l-4 10M${scx - 9} ${y - 100}l4 10M${scx + 9} ${y - 100}l-4 10M${scx + 9} ${y - 100}l4 10`, N, 0.6) +
        F(`M${scx - 15} ${y - 90}h12a6 3 0 0 1 -12 0zM${scx + 3} ${y - 90}h12a6 3 0 0 1 -12 0z`, K) + F(circ(scx, y - 101, 1.6), O));
      anim.roadside.push(tg => G(tg ? DD('hanging-fish') : {}, S(`M${x + 8} ${y - 108}h${w - 40}`, N, 1.2) +
        [0, 1, 2, 3].map(i => G({ transform: `translate(${x + 18 + i * 18} ${y - 108})` }, G({ class: 'land-a-hfish' + i },
          S('M0 0v5', N, 0.7) + F('M0 5c-4 4 -4 14 0 20c4 -6 4 -16 0 -20zM0 24l-4 5h8z', i % 2 ? P : B) + F(circ(-0.8, 9, 0.8), N) + S('M-2 14q2 1 4 0M-2 17q2 1 4 0', i % 2 ? B : P, 0.5)))).join('')));
      anim.roadside.push(() => G({ class: 'land-glow', display: 'none' }, F(Array.from({ length: n }, (_, i) => circ(x - 7 + (i + 0.5) * sw, y - 104, 4.5)).join(''), 'url(#land-glowG)') + F(Array.from({ length: n }, (_, i) => circ(x - 7 + (i + 0.5) * sw, y - 104, 1.3)).join(''), v('lamp'))));
    }
    // --- signpost 鹈鹕湾 PELICAN BAY 2 km
    {
      const x = 1172, y = BASE, bw = 206, top = y - 196, bh = 62; let g = '';
      g += F(rect(x + 30, top + bh - 4, 6, y - top - bh + 4) + rect(x + 146, top + bh - 4, 6, y - top - bh + 4) + rect(x + 26, y - 8, 14, 8) + rect(x + 142, y - 8, 14, 8), N);
      const board = poly([[x, top], [x + bw - 26, top], [x + bw, top + bh / 2], [x + bw - 26, top + bh], [x, top + bh]]);
      g += F(board, N, { transform: 'translate(3 3)' }) + F(board, v('foliage'));
      g += S(poly([[x + 4, top + 4], [x + bw - 28, top + 4], [x + bw - 5, top + bh / 2], [x + bw - 28, top + bh - 4], [x + 4, top + bh - 4]]), v('foam'), 1.3);
      g += F(circ(x + 33, top + bh + 6, 1.5) + circ(x + 149, top + bh + 6, 1.5), v('foam'));
      put(DD('signpost'), g + G(DD('sign-lettering-cn'), F(gtext('鹈鹕湾', x + 14, top + 28, 20, { track: 2 }).d, v('foam'))) +
        G(DD('sign-lettering-latin'), deco('PELICAN BAY', x + 14, top + 52, 15, v('foam'), { gap: 16 }).svg));
      const rx = x + bw - 42, ry = top + 20;
      put(DD('sign-distance'), F(circ(rx, ry + 2, 15.5), R) + F(circ(rx, ry + 2, 12.8), 'none', { stroke: v('foam'), 'stroke-width': 0.8 }) +
        deco('2', rx - 3.5, ry + 1, 10, v('foam'), { anchor: 'middle' }).svg + deco('km', rx, ry + 12, 7.4, v('foam'), { gap: 10, anchor: 'middle' }).svg);
    }
    // --- milestone
    {
      const x = 1394, y = BASE;
      put(DD('milestone'), F(`M${x - 13} ${y}V${y - 30}a13 13 0 0 1 26 0V${y}z`, P) + F(`M${x + 7} ${y}V${y - 38}a13 13 0 0 1 6 8V${y}z`, K) + S(`M${x - 13} ${y - 8}h26`, v('seaNear'), 0.9) +
        F(gtext('鹈鹕湾', x, y - 32, 6, { anchor: 'middle' }).d + gtext('2', x, y - 14, 12, { anchor: 'middle' }).d + gtext('KM', x, y - 9.4, 4.4, { anchor: 'middle' }).d, v('seaNear')));
    }
    return s;
  })();

  // ========================================================================= ROAD (depth 1)
  const road = (() => {
    const L = LAY.road, W = L.W, X0 = L.x0 - 3, X1 = L.x1 + 3, Rn = ctx.rng('land-road');
    let s = '';
    const put = (o, g) => { s += G(RID(o), g); };
    s += F(rect(X0, 752, X1 - X0, 23), v('road'));
    defs += htPattern('land-htRoad', W, 6, 774, 890, y => (y < 806 ? lerp(0.3, 1.3, (y - 774) / 32) : lerp(1.3, 2.6, (y - 806) / 56)), v('sunGlow'), v('road'));
    s += band(X0, X1, DD('asphalt-halftone'), (a, b) => F(rect(a, 774, b - a, 44), 'url(#land-htRoad)'));
    s += F(rect(X0, 818, X1 - X0, 50), 'url(#land-htRoad)');
    { let a = '', b = ''; for (let i = 0; i < 300; i++) { const x = L.x0 + Rn() * W, y = 776 + Rn() * 80, r = 0.5 + Rn() * 0.7; if (i % 3) a += `M${f1(x)} ${f1(y)}h${f1(r)}`; else b += `M${f1(x)} ${f1(y)}h${f1(r)}`; } s += S(a, v('trunk'), 1.1) + S(b, v('roadLine'), 1.1); }
    const kj = (a, b) => { let d = ''; for (let i = -1; i <= 25; i++) { const x = L.x0 + i * W / 24; if (x >= a && x < b) d += `M${f(x)} 752.5v8.5`; } return d; };
    s += band(X0, X1, DD('kerbstones'), (a, b) => F(rect(a, 752, b - a, 9), v('roadLine')) + F(rect(a, 761, b - a, 2.6), v('trunk')) + F(rect(a, 763.6, b - a, 1.4), v('hillFar')) + S(kj(a, b), v('trunk'), 1.1));
    const drain = x => F(rect(x, 764.8, 34, 6), v('trunk')) + S(Array.from({ length: 7 }, (_, i) => `M${x + 4 + i * 4} 765.6v4.4`).join(''), v('road'), 1);
    put(DD('gutter-drain'), drain(360)); s += drain(1440);
    s += band(X0, X1, DD('edge-line'), (a, b) => F(rect(a, 771, b - a, 3.2), v('roadLine')));
    {
      const dx = i => L.x0 + 40 + i * 157.08;
      let d = ''; for (let i = 0; i < 12; i++) if (i !== 2) d += rect(dx(i), 824, 78.54, 5.5);
      s += F(d, v('roadLine')); put(DD('centre-dashes'), F(rect(dx(2), 824, 78.54, 5.5), v('roadLine')));
      const eye = x => [rect(x - 3.4, 824.6, 6.8, 4), rect(x - 1.8, 825.4, 3.6, 2.2)];
      let e0 = '', e1 = ''; for (let i = 0; i < 12; i++) if (i !== 2) { const e = eye(dx(i) + 117.8); e0 += e[0]; e1 += e[1]; }
      s += F(e0, v('trunk')) + F(e1, v('lamp')); const e = eye(dx(2) + 117.8); put(DD('cats-eyes'), F(e[0], v('trunk')) + F(e[1], v('lamp')));
    }
    s += F(rect(X0, 858, X1 - X0, 5), v('roadLine')) + F(rect(X0, 863, X1 - X0, 3), v('trunk'));   // near edge (mostly under the verge)
    base.road = s;
    {
      const x = 1470, y = 812; let rl = '';
      for (let i = 0; i < 12; i++) { const a = i * 30 * D2R; rl += `M${f(x + Math.cos(a) * 7)} ${f(y + Math.sin(a) * 1.5)}L${f(x + Math.cos(a) * 23)} ${f(y + Math.sin(a) * 4.8)}`; }
      put(DD('manhole'), F(ell(x, y, 30, 7), v('roadLine')) + F(ell(x, y, 27, 5.8), v('trunk')) + G(DD('manhole-pattern'), S(rl + ell(x, y, 6.5, 1.4) + ell(x, y, 23.5, 4.9), v('hillFar'), 1)));
    }
    {
      const x = 1210, y = 802, sy = 0.36, Y = dy => f(y + dy * sy); let g = '';
      g += S(ell(x - 24, y, 15, 15 * sy) + ell(x + 24, y, 15, 15 * sy), v('roadLine'), 2.6);
      g += S(`M${x - 24} ${Y(0)}L${x - 5} ${Y(-28)}L${x + 16} ${Y(-28)}L${x + 24} ${Y(0)}M${x - 5} ${Y(-28)}L${x} ${Y(0)}L${x + 16} ${Y(-28)}M${x - 10} ${Y(-36)}h10M${x + 14} ${Y(-36)}l5 0`, v('roadLine'), 2.6);
      put(DD('bike-lane-symbol'), g);
      put(DD('bike-lane-arrow'), F(`M${x + 52} ${Y(-4)}h28v${f(-7 * sy)}l16 ${f(14 * sy)}l-16 ${f(14 * sy)}v${f(-7 * sy)}h-28z`, v('roadLine')));
    }
    defs += htPattern('land-htPatch', W, 4, 780, 820, () => 1.5, v('sunGlow'));
    put(DD('tar-patch'), F('M44 791q30 -3 62 -2q8 1 9 7q0 6 -8 8q-34 3 -66 2q-6 -1 -5 -7q1 -7 8 -8z', 'url(#land-htPatch)') + S('M44 791q30 -3 62 -2q8 1 9 7q0 6 -8 8q-34 3 -66 2q-6 -1 -5 -7q1 -7 8 -8zM70 790.4l-3 16', v('trunk'), 1.2));
    put(DD('road-crack'), S('M192 846l14 -3l6 4l18 -6l9 3l12 -5M212 847l4 5', v('trunk'), 1.6));
    return s;
  })();

  // ========================================================================= FOREGROUND (depth 1.3)
  const fg = (() => {
    const L = LAY.fg, X0 = L.x0 - 3, X1 = L.x1 + 3, Rn = ctx.rng('land-fg');
    let s = '';
    const put = (o, g) => { s += G(RID(o), g); };
    s += F(rect(X0, 866, X1 - X0, 460), v('trunk'));
    defs += htPattern('land-htBush', L.W, 5, 846, 900, y => lerp(0.3, 2.2, (y - 846) / 40), v('trunk'));
    const bush = (x, hh, w) => {
      const lobes = 3 + Math.floor(Rn() * 2); let d = '';
      for (let i = 0; i < lobes; i++) { const u = (i + 0.5) / lobes, lx = x - w / 2 + u * w, lr = w / lobes * 0.75, ly = 876 - hh * (1 - Math.abs(u - 0.5) * 1.1) + lr * 0.6; d += circ(lx, ly, lr); }
      return d + `M${f(x - w / 2)} 900V876H${f(x + w / 2)}V900Z`;
    };
    // specimens (drawn last, tagged) sit at these hero-frame x positions; the bulk avoids them
    const SPX = { bush: 1050, navy: 330, teal: 560, poppy: 140, mari: 1280, dand: 720, rock: 880, agave: 1440 };
    const near = x => Object.values(SPX).some(sx => Math.abs(sx - x) < 40);
    let dT = '';
    for (let x = L.x0 + 20; x < L.x1 - 60; x += 64 + Rn() * 50) { const hh = 20 + Rn() * 22, w = 70 + Rn() * 50; if (Math.abs(x - SPX.bush) > 60) dT += bush(x, hh, w); }
    s += F(dT, v('grassNear')) + F(dT, 'url(#land-htBush)');
    const fan = (cx, base, H, n, spread) => {
      let d = '';
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1) - 0.5, hh = H * (0.7 + Rn() * 0.35) * (1 - Math.abs(u) * 0.6), ang = u * spread;
        const tip = [cx + Math.sin(ang * D2R) * hh, base - Math.cos(ang * D2R) * hh], w = 3.2, bend = u * 18 + 6;
        d += `M${f(cx - w)} ${base}Q${f((cx + tip[0]) / 2 + bend)} ${f((base + tip[1]) / 2)} ${f(tip[0] + bend * 0.6)} ${f(tip[1])}Q${f((cx + tip[0]) / 2 + bend + w)} ${f((base + tip[1]) / 2 + 4)} ${f(cx + w)} ${base}Z`;
      }
      return d;
    };
    let gN = '', gT = '';
    for (let x = L.x0 + 60; x < L.x1 - 40; x += 150 + Rn() * 140) { if (near(x)) continue; gN += fan(x, 898, 56 + Rn() * 30, 7, 64); if (Rn() < 0.6) gT += fan(x + 40, 898, 32 + Rn() * 14, 5, 50); }
    s += F(gN, v('trunk')) + F(gT, v('grassNear'));
    const poppy = (x, y, sc) => `M${f(x)} ${f(y + 2 * sc)}C${f(x - 16 * sc)} ${f(y + 2 * sc)} ${f(x - 16 * sc)} ${f(y - 14 * sc)} ${f(x - 8 * sc)} ${f(y - 16 * sc)}C${f(x - 4 * sc)} ${f(y - 10 * sc)} ${f(x - 2 * sc)} ${f(y - 10 * sc)} ${f(x)} ${f(y - 16 * sc)}C${f(x + 2 * sc)} ${f(y - 10 * sc)} ${f(x + 4 * sc)} ${f(y - 10 * sc)} ${f(x + 8 * sc)} ${f(y - 16 * sc)}C${f(x + 16 * sc)} ${f(y - 14 * sc)} ${f(x + 16 * sc)} ${f(y + 2 * sc)} ${f(x)} ${f(y + 2 * sc)}Z`;
    const poppyEye = (x, y, sc) => `M${f(x - 3 * sc)} ${f(y + 1 * sc)}h${f(6 * sc)}l${f(-3 * sc)} ${f(-6 * sc)}z`;
    const mari = (x, y, sc) => { let p = ''; for (let i = 0; i < 10; i++) { const c = add([x, y], rot([6.5 * sc, 0], i * 36)); p += circ(c[0], c[1], 3.2 * sc); } return [p, circ(x, y, 3.4 * sc)]; };
    const dand = (x, y, sc) => { let r = ''; for (let i = 0; i < 12; i++) { const p1 = add([x, y], rot([7 * sc, 0], i * 30)); r += `M${f(x)} ${f(y)}L${f(p1[0])} ${f(p1[1])}`; } return [circ(x, y, 7 * sc), r, circ(x + 5.5 * sc, y, 1.8 * sc)]; };
    let pop = '', pe = '', stem = '', ma = '', mc = '', da = '', ds = '';
    for (let x = L.x0 + 90; x < L.x1 - 40; x += 110 + Rn() * 120) {
      if (near(x)) continue;
      const y = 834 + Rn() * 20, sc = 0.7 + Rn() * 0.4, k = Rn();
      if (k < 0.45) { pop += poppy(x, y, sc); pe += poppyEye(x, y, sc); stem += `M${f(x)} ${f(y + 36)}q-4 -18 0 -36`; }
      else if (k < 0.8) { const m = mari(x, y - 6 * sc, sc); ma += m[0]; mc += m[1]; stem += `M${f(x)} ${f(y + 36)}q3 -18 0 -30`; }
      else { const d = dand(x, y - 8, sc); da += d[0]; ds += d[1]; stem += `M${f(x)} ${f(y + 36)}q-2 -16 0 -28`; }
    }
    s += S(stem, v('trunk'), 2) + F(pop, R) + F(pe, v('trunk')) + F(ma, O) + F(mc, R) + F(da, P) + S(ds, v('grassNear'), 0.7);
    const rockD = (x, w, hh) => `M${f(x)} 882q${f(w * 0.1)} ${f(-hh)} ${f(w * 0.45)} ${f(-hh)}q${f(w * 0.45)} 0 ${f(w * 0.55)} ${f(hh)}z`;
    const rimD = (x, w, hh) => `M${f(x + w * 0.2)} ${f(882 - hh * 0.7)}q${f(w * 0.2)} ${f(-hh * 0.3)} ${f(w * 0.4)} ${f(-hh * 0.1)}`;
    { let rk = '', rm = ''; for (let x = L.x0 + 140; x < L.x1 - 60; x += 260 + Rn() * 260) { if (near(x)) continue; const w = 40 + Rn() * 30, hh = 14 + Rn() * 8; rk += rockD(x, w, hh); rm += rimD(x, w, hh); } s += F(rk, v('hillFar')) + S(rm, v('rim'), 1.4); }
    const agave = x => { let ag = ''; for (let i = 0; i < 9; i++) { const a = -160 + i * 17.5, len = 26 + (i % 2) * 8 - Math.abs(i - 4) * 2; const tip = add([x, 886], rot([len, 0], a)), l = add([x, 886], rot([6, 0], a - 90)), r = add([x, 886], rot([6, 0], a + 90)); ag += `M${f(l[0])} ${f(l[1])}Q${f((l[0] + tip[0]) / 2)} ${f((l[1] + tip[1]) / 2 - 3)} ${f(tip[0])} ${f(tip[1])}Q${f((r[0] + tip[0]) / 2)} ${f((r[1] + tip[1]) / 2 + 3)} ${f(r[0])} ${f(r[1])}Z`; } return ag; };
    s += F(agave(L.x0 + 300) + agave(L.x0 + 2200), v('grassNear'));
    // a nearer row below the frame (seen on tall phone screens, where the camera shows down to y ≈ 1050)
    { let d = '', dh = ''; for (let x = L.x0; x < L.x1; x += 90 + Rn() * 50) { const w = 110 + Rn() * 60, hh = 40 + Rn() * 30; d += `M${f(x - w / 2)} 1010Q${f(x - w / 2)} ${f(1010 - hh)} ${f(x)} ${f(1010 - hh)}Q${f(x + w / 2)} ${f(1010 - hh)} ${f(x + w / 2)} 1010Z`; dh += `M${f(x - w * 0.3)} ${f(1010 - hh * 0.7)}q${f(w * 0.2)} ${f(-hh * 0.2)} ${f(w * 0.4)} ${f(-hh * 0.12)}`; }
      s += F(d, v('foliage')) + S(dh, v('grassNear'), 2); }
    // ---- specimens
    { const d = bush(SPX.bush, 40, 120); put(DD('fg-bushes'), F(d, v('grassNear')) + G(DD('bush-halftone'), F(d, 'url(#land-htBush)'))); }
    put(DD('fg-grass-navy'), F(fan(SPX.navy, 898, 74, 8, 66), v('trunk')));
    put(DD('fg-grass-teal'), F(fan(SPX.teal, 898, 44, 6, 54), v('grassNear')));
    put(DD('fg-poppies'), S(`M${SPX.poppy} 884q-4 -20 0 -40M${SPX.poppy + 22} 890q3 -16 0 -32`, v('trunk'), 2) + F(poppy(SPX.poppy, 842, 1.1) + poppy(SPX.poppy + 22, 856, 0.8), R) + F(poppyEye(SPX.poppy, 842, 1.1) + poppyEye(SPX.poppy + 22, 856, 0.8), v('trunk')));
    { const m = mari(SPX.mari, 842, 1), m2 = mari(SPX.mari + 24, 856, 0.75); put(DD('fg-marigolds'), S(`M${SPX.mari} 886q3 -20 0 -40M${SPX.mari + 24} 890q-2 -16 0 -30`, v('trunk'), 2) + F(m[0] + m2[0], O) + F(m[1] + m2[1], R)); }
    { const d = dand(SPX.dand, 846, 1.1); put(DD('fg-dandelions'), S(`M${SPX.dand} 888q-2 -20 0 -40`, v('trunk'), 1.8) + F(d[0], P) + S(d[1], v('grassNear'), 0.7) + F(d[2], v('grassNear'))); }
    put(DD('fg-rocks'), F(rockD(SPX.rock, 62, 22), v('hillFar')) + S(rimD(SPX.rock, 62, 22), v('rim'), 1.6));
    put(DD('fg-agave'), F(agave(SPX.agave), v('grassNear')));
    return s;
  })();

  // ========================================================================= assemble
  const J = journeyArt(ctx), SPS = setPieces(ctx);
  // patterns for the set pieces (static, userSpaceOnUse: they slide with their set piece)
  defs += htPattern('land-htEmb', 480, 6, 660, 704, y => lerp(0.4, 2.2, (y - 660) / 44), v('trunk'));
  defs += htPattern('land-htHead', 480, 6, 440, 704, y => lerp(0.3, 2.3, clamp((y - 520) / 180, 0, 1)), N);
  defs += htPattern('land-htArch', 480, 7, 60, 760, y => lerp(0.4, 2.4, clamp((y - 200) / 500, 0, 1)), O);
  defs += h('pattern', { id: 'land-sleepers', x: 0, y: 646, width: 13, height: 8, patternUnits: 'userSpaceOnUse' }, F(rect(2, 2, 7, 6), N) + F(rect(2, 2, 7, 1.2), v('rim')));
  defs += h('pattern', { id: 'land-poles', x: 0, y: 560, width: 520, height: 94, patternUnits: 'userSpaceOnUse' },
    F(rect(258, 6, 4, 88) + rect(246, 6, 28, 3), N) + F(circ(248, 5, 1.8) + circ(260, 5, 1.8) + circ(272, 5, 1.8), P));
  defs += h('clipPath', { id: 'land-archClip' }, h('path', { d: 'M-360 700L-350 560Q-330 480 -260 462L-140 452Q0 430 150 444L270 456Q360 470 380 560L400 700ZM-150 700L-146 612Q-128 548 -40 540Q60 536 100 580Q124 610 126 660L128 700Z', 'clip-rule': 'evenodd' }));
  defs += mergePaths(J.defs + SYM);
  const strip = m => m.replace(/ data-detail="[^"]*"| data-size-m="[^"]*"| id="land-v-[^"]*"/g, '');
  const tile = (key, content0, animList) => {
    const content = chunkPaths(mergePaths(content0));
    const W = LAY[key].W;
    const anim0 = animList ? chunkPaths(animList.map(fn => fn(true)).join(''), 120) : '';
    if (!base[key]) {   // foreground: one generic verge tile everywhere (classic 3-copy wrap)
      return G({ 'data-ref': 'land-' + key }, G({ 'data-ref': 'land-t-' + key },
        G({ id: 'land-tile-' + key }, content), h('use', { href: '#land-tile-' + key, x: f(-W) }), h('use', { href: '#land-tile-' + key, x: f(W) })), streamMarkup(key), spMarkup(key));
    }
    defs += G({ id: 'land-base-' + key }, strip(chunkPaths(mergePaths(base[key]))) + (baseAnim[key] ? strip(baseAnim[key](false)) : ''));
    return G({ 'data-ref': 'land-' + key },
      [0, 1, 2].map(k => h('use', { 'data-ref': `land-b${key}${k}`, href: '#land-base-' + key })).join(''),
      G({ id: 'land-tile-' + key, 'data-ref': 'land-full' + key }, content, anim0),
      spMarkup(key), streamMarkup(key), key === 'roadside' ? fixedMarkup() : '');
  };
  // set pieces are mounted lazily by attach (one or two at a time: they are kilometres apart) to keep the DOM small
  SP_CACHE = SPS.map(sp => ({ layer: sp.layer, key: sp.key, m: mergePaths(sp.m) }));
  const spMarkup = key => G({ 'data-ref': 'land-sphost-' + key });
  const streamMarkup = key => G({ 'data-ref': 'land-pool-' + key }, Array.from({ length: POOL[key] }, (_, i) =>
    G({ 'data-ref': `land-sl-${key}-${i}`, display: 'none' }, Array.from({ length: PARTS[key] }, () => h('use', { href: '#land-y-none' })).join(''))).join(''));
  const fixedMarkup = () => G({ 'data-ref': 'land-fixed' }, [0, 1, 2].map(i => G({ 'data-ref': 'land-fx' + i, display: 'none' },
    h('use', { href: '#land-y-none' }), h('use', { href: '#land-y-none' }), h('use', { href: '#land-y-none' }), h('use', { href: '#land-y-none' }))).join(''));
  // lamp light pools on the road (positioned per frame under the roadside lamps, in screen space)
  const pools = G({ 'data-ref': 'land-roadpools', class: 'land-glow', display: 'none' },
    [0, 1, 2, 3].map(i => G({ 'data-ref': 'land-pool' + i, ...(i === 1 ? DD('road-pool') : {}) }, F(ell(0, 806, 120, 26), 'url(#land-poolG)'))).join(''));
  const layers = {
    'L-shore': tile('shore', shore, anim.shore),
    'L-roadside': tile('roadside', roadside, anim.roadside),
    'L-road': tile('road', road) + pools,
    'L-foreground': tile('fg', fg),
  };
  defs += G({ id: 'land-y-none' });
  return { defs, layers };
}

// ---------------------------------------------------------------------------------------------- stream kinds
// kind -> { p: [[href ids…] per variant], flip, sc: [min,max], sw: [ink swaps] }
const KINDS = {
  roadside: {
    'v-fish': { p: [['v-fish-stand', 'v-fish-awning', 'v-fish-sign', 'v-fish-counter']], sw: ['', 'RT', 'RB'] },
    'v-bus': { p: [['v-poster-wall', 'v-bus-shelter', 'v-bus-timetable', 'v-bus-stop-sign']], sw: ['', 'TB', 'TR'] },
    'v-bench': { p: [['v-bench', 'v-cat']], flip: 1 }, bench: { p: [['v-bench']], flip: 1, sw: ['', 'TB', 'TR'] },
    mailbox: { p: [['v-mailbox']] }, flowers: { p: [['v-flower-bed']], flip: 1, sw: ['', 'RO', 'OR'] }, tulips: { p: [['v-flower-bed-tulips']], flip: 1, sw: ['', 'RB'] },
    telescope: { p: [['v-telescope']], flip: 1 }, hedge: { p: [['y-hedge0'], ['y-hedge1']], sc: [0.9, 1.1] },
    icecart: { p: [['y-icecart']], sw: ['', 'OT', 'RB', 'OR'] }, palm: { p: [['y-palm']], flip: 1, sc: [0.78, 1.12] }, cypress: { p: [['y-cypress']], sc: [0.7, 1.15] },
    pine: { p: [['y-pine']], flip: 1, sc: [0.8, 1.2] }, bollards: { p: [['y-bollards']], flip: 1 }, pots: { p: [['y-pots']], flip: 1, sw: ['', 'BT', 'OR'] }, anchor: { p: [['y-anchor']], flip: 1 },
    crates: { p: [['y-crates']], flip: 1 }, crossbuck: { p: [['y-crossbuck']] }, outcrop: { p: [['y-outcrop']], flip: 1, sc: [0.8, 1.3] },
  },
  shore: {
    hut: { p: [0, 1, 2, 3].map(k => ['y-hut' + k]), flip: 1, sw: ['', '', 'RB', 'TR', 'OR', 'BT'] }, parasol: { p: [0, 1].map(k => ['y-par' + k]), flip: 1, sc: [0.85, 1.1], sw: ['', 'OR', 'TB', 'OT'] },
    deck: { p: [0, 1].map(k => ['y-deck' + k]), sw: ['', 'RT', 'BR', 'RO'] }, castle: { p: [['v-sandcastle', 'v-bucket-spade']] }, bucket: { p: [['v-bucket-spade']], flip: 1 }, ball: { p: [['v-beach-ball']], sw: ['', 'RT'] },
    lifeguard: { p: [['v-lifeguard-tower', 'v-lifeguard-cross-flag']] }, rocks: { p: [0, 1, 2].map(k => ['y-rock' + k]), flip: 1, sc: [0.8, 1.25] },
    drift: { p: [['v-driftwood']], flip: 1 }, sandpipers: { p: [['v-sandpipers']], flip: 1 }, boat: { p: [['y-boat']], flip: 1, sw: ['', 'RT', 'RB', 'RO'] },
    stack: { p: [['y-stack']], flip: 1, sc: [0.7, 1.3] }, dune: { p: [['y-dune']], flip: 1, sc: [0.7, 1.3] }, fence: { p: [['y-fence']], flip: 1 },
    spalm: { p: [['y-spalm']], flip: 1, sc: [0.8, 1.2] }, scypress: { p: [['y-scypress']], sc: [0.75, 1.2] },
  },
  road: {
    manhole: { p: [['v-manhole']] }, bikelane: { p: [['v-bike-lane-symbol', 'v-bike-lane-arrow']] }, tarpatch: { p: [['v-tar-patch']], flip: 1 }, crack: { p: [['v-road-crack']], flip: 1 },
    drain: { p: [['v-gutter-drain']] }, slow: { p: [['y-slow']] }, sand: { p: [['y-sand']], flip: 1 }, joint: { p: [['y-joint']] },
  },
  fg: { tuft: { p: [['y-tuft']], flip: 1, sc: [0.8, 1.2] }, post: { p: [['y-post']] }, reeds: { p: [['y-reeds']], flip: 1, sc: [0.85, 1.2] } },
};
let SP_CACHE = [];   // set-piece markup from build(), mounted on approach by attach()
const SPK = { river: 'bridge', bridge: 'bridge' };   // set-piece key -> SP_AT key
const spAt = sp => SP_AT[SPK[sp.key] || sp.key];

// ---------------------------------------------------------------------------------------------- attach
// composited strips (see core/sheets.js): the tile copies scroll by a pure translate every frame, so the runtime moves
// each one as its own compositor layer instead of repainting it instead of repainting it. The stream / set-piece / sign hosts are strips too: they scroll with their
// layer (translate −(D·d mod 16384)) and their props sit in layer coordinates, so a prop is only rewritten when it is
// re-seated (and every ~8 s when the offset wraps), not every frame.
export const sheets = ['shore', 'roadside', 'road'].flatMap(k => [0, 1, 2].map(c => `[data-ref="land-b${k}${c}"]`).concat(`[data-ref="land-full${k}"]`))
  .concat('[data-ref="land-t-fg"]', ...['shore', 'roadside', 'road', 'fg'].flatMap(k => [`[data-ref="land-sphost-${k}"]`, `[data-ref="land-pool-${k}"]`]), '[data-ref="land-fixed"]');
const HOST_WRAP = 16384;   // host scroll offset wraps here (layer units): bounded coordinates, a rare full re-seat
export function attach(svg, ctx) {
  const r = refs(svg, 'land-');
  const glows = [...svg.querySelectorAll('.land-glow')];
  let glowOn = null;
  const A = {};   // animated hooks: every class 'land-a-<name>' element
  for (const el of svg.querySelectorAll('[class^="land-a-"]')) (A[el.getAttribute('class').slice(7)] ||= []).push(el);
  // last written value per element AND attribute (one shared slot made display + transform rewrite each other every frame)
  const set = (el, a, val) => { if (!el) return; const m = el.__lv || (el.__lv = {}); if (m[a] !== val) { m[a] = val; el.setAttribute(a, val); } };
  const setA = (name, val) => { const l = A[name]; if (l) for (const el of l) set(el, 'transform', val); };
  const since = (fr, type) => { let best = Infinity; for (const e of fr.events || []) if (e.type === type && fr.t >= e.t0) best = Math.min(best, fr.t - e.t0); return best; };
  const disp = (el, on) => set(el, 'display', on ? 'inline' : 'none');
  const HREF = el => el.getAttribute('href');
  // ---- hero-element anchors for reused props (bbox centre in design coords)
  const cxOf = {};
  const bb = id => { if (cxOf[id] !== undefined) return cxOf[id]; const el = svg.getElementById ? svg.getElementById('land-' + id) : svg.querySelector('#land-' + id); let c = [0, 0];
    if (el && id.startsWith('v-')) { try { const b = el.getBBox(); c = [b.x, b.x + b.width]; } catch (e) { c = [0, 0]; } } return (cxOf[id] = c); };
  const variantBox = ids => { let a = Infinity, b = -Infinity; for (const id of ids) { const [x0, x1] = bb(id); if (x1 > x0) { a = Math.min(a, x0); b = Math.max(b, x1); } } return a < b ? [a, b] : [0, 0]; };
  for (const L of Object.keys(KINDS)) for (const k of Object.values(KINDS[L])) k.box = k.p.map(variantBox);
  // ---- set pieces
  const DEP = { shore: 0.6, roadside: 0.9, road: 1, fg: 1.3 };
  const SPS = SP_CACHE.map(c => ({ ...c, el: null, host: r['sphost-' + c.layer] }));
  const NSVG = 'http://www.w3.org/2000/svg';
  const mountSP = sp => {
    const g = document.createElementNS(NSVG, 'g'); mount(g, sp.m); sp.host.appendChild(g); sp.el = g;
    for (const el of g.querySelectorAll('[data-ref^="land-"]')) r[el.getAttribute('data-ref').slice(5)] = el;
    for (const el of g.querySelectorAll('.land-glow')) { glows.push(el); el.setAttribute('display', glowOn ? 'inline' : 'none'); }
  };
  const unmountSP = sp => {
    for (const el of sp.el.querySelectorAll('.land-glow')) { const i = glows.indexOf(el); if (i >= 0) glows.splice(i, 1); }
    sp.el.remove(); sp.el = null;
  };
  const spInfo = { pier: [-180, 2720], harbour: [-500, 3000], funfair: [-270, 1910], railway: [-220, 3 * KM * 0.6 + 620], lighthouse: [-580, 660], cliffs: [-380, 420],
    arch: [-480, 480], river: [-1010, 1010], bridge: [-910, 910], fort: [-300, 660], bottle: [-40, 40], statue: [-60, 70], crossing: [-240, 240], welcome: [-280, 280], train: [-620, 20] };
  for (const sp of SPS) { sp.x = spInfo[sp.key] || [-500, 500]; sp.at = spAt(sp); }
  // exclusion zones for the stream, in road units (lap position centre, half width)
  const EXC = { shore: [], roadside: [], road: [], fg: [] };
  for (const sp of SPS) if (sp.key !== 'train' && sp.key !== 'railway') { const d = DEP[sp.layer]; EXC[sp.layer].push([sp.at + (sp.x[0] + sp.x[1]) / 2 / d, (sp.x[1] - sp.x[0]) / 2 / d + 60 / d]); }
  for (const k of ['shore', 'roadside', 'road']) { const L = LAY[k]; EXC[k].push([(800 + D0 * L.d - RIDER_X) / L.d, L.W / 2 / L.d + 40]); }
  const FIXED = [...SIGNS.map(s => ({ at: s.at, sign: s.stretch.i })), ...KM_STONES.map(s => ({ at: s.at, km: s.km }))];
  for (const fx of FIXED) EXC.roadside.push([fx.at, 150 / 0.9]);
  EXC.shore.push([STRETCHES[4].a + (STRETCHES[4].b - STRETCHES[4].a) / 2, (STRETCHES[4].b - STRETCHES[4].a) / 2 + 400]);
  const excluded = (L, Dp) => { for (const [c, hw] of EXC[L]) if (Math.abs(relTo(Dp, c)) < hw) return true; return false; };
  // ---- stream: deterministic item for absolute index j of layer L
  const SALT = { shore: 11, roadside: 23, road: 37, fg: 41 };
  const pickW = (tab, u) => { let tot = 0; for (const e of tab) tot += e[1]; let x = u * tot; for (const e of tab) { x -= e[1]; if (x <= 0) return e[0]; } return tab[tab.length - 1][0]; };
  function item(L, j) {
    const d = DEP[L], s0 = SALT[L], blk = Math.floor(j / 3), sub = j - blk * 3, step = STEP[L];
    const Dc = ((blk * 3 + 1.5) * step - RIDER_X) / d;
    const st = stretchAt(Dc), tab = TABLE[L][st.key] || TABLE[L]._;
    const wide = tab.filter(e => e[2] === 'W'), wW = wide.reduce((a, e) => a + e[1], 0), tW = tab.reduce((a, e) => a + e[1], 0);
    let kind, A;
    if (wide.length && hash(blk, s0 + 1) < wW / tW) { if (sub !== 1) return null; kind = pickW(wide, hash(blk, s0 + 2)); A = (blk * 3 + 1.5) * step; }
    else { kind = pickW(tab.filter(e => e[2] !== 'W'), hash(j, s0 + 3)); A = (j + 0.5 + (hash(j, s0 + 4) - 0.5) * 0.55) * step; }
    if (!kind) return null;
    const Dp = (A - RIDER_X) / d;
    if (excluded(L, Dp)) return null;
    const K = KINDS[L][kind]; if (!K) return null;
    const vi = Math.floor(hash(j, s0 + 5) * K.p.length), box = K.box[vi];
    const cx = (box[0] + box[1]) / 2;
    const fl = K.flip && hash(j, s0 + 6) < 0.5 ? -1 : 1, sc = K.sc ? lerp(K.sc[0], K.sc[1], hash(j, s0 + 7)) : 1;
    const sw = K.sw ? SWAP[K.sw[Math.floor(hash(j, s0 + 8) * K.sw.length)]] || '' : '';
    return { A, ids: K.p[vi], cx, fl, sc, sw };
  }
  const pools = {};
  for (const L of Object.keys(KINDS)) {
    pools[L] = Array.from({ length: POOL[L] }, (_, i) => { const el = r[`sl-${L}-${i}`]; return { el, uses: el ? [...el.children] : [], j: null, it: null }; });
  }
  const fixedSlots = [0, 1, 2].map(i => { const el = r['fx' + i]; return { el, uses: el ? [...el.children] : [], key: null }; });
  const DGW = 14.6;   // digit advance at size 21
  let bakeMode = null;
  const legacy = on => {   // bake: the classic seamless loop (the hero tile + two copies), no stream / set pieces
    for (const k of ['shore', 'roadside', 'road']) for (let c = 0; c < 3; c++) { const u = r[`b${k}${c}`]; if (u) { u.setAttribute('href', on ? '#land-tile-' + k : '#land-base-' + k); u.__lv = undefined; } }
    for (const L of Object.keys(pools)) for (const s of pools[L]) { disp(s.el, false); s.j = null; }
    // hosts: no scroll offset in the baked file (their props are hidden there); live writes start afresh
    for (const L of Object.keys(DEP)) for (const el of [r['pool-' + L], r['sphost-' + L]]) if (el) { el.removeAttribute('transform'); el.__lv = undefined; }
    if (r.fixed) { r.fixed.removeAttribute('transform'); r.fixed.__lv = undefined; }
    for (const s of fixedSlots) { disp(s.el, false); s.key = null; }
    for (const sp of SPS) if (sp.el) unmountSP(sp);
  };
  return {
    update(fr) {
      const D = fr.distance || 0, t = fr.t || 0, red = fr.reduced || ctx.reduced;
      const baking = !!(fr.bake || (typeof globalThis !== 'undefined' && globalThis.__pbBake));
      if (baking !== bakeMode) { bakeMode = baking; legacy(baking); }
      // ---- tiles
      set(r['t-fg'], 'transform', `translate(${f(-tileU(D, LAY.fg))} 0)`);
      for (const k of ['shore', 'roadside', 'road']) {
        const L = LAY[k], W = L.W, full = r['full' + k];
        if (baking) {
          const u = tileU(D, L);
          set(full, 'transform', `translate(${f(-u)} 0)`); disp(full, true);
          set(r[`b${k}0`], 'transform', `translate(${f(-W)} 0)`); set(r[`b${k}1`], 'transform', 'translate(0 0)'); disp(r[`b${k}1`], false); set(r[`b${k}2`], 'transform', `translate(${f(W)} 0)`);
          disp(r[`b${k}0`], true); disp(r[`b${k}2`], true);
          continue;
        }
        const q = (D - D0) * L.d / W, nc = Math.round(q), HL = Math.round(LAP * L.d / W);
        let heroOn = false;
        for (let c = 0; c < 3; c++) {
          const n = nc + c - 1, el = r[`b${k}${c}`];
          const isHero = ((n % HL) + HL) % HL === 0;
          if (isHero) { heroOn = true; set(full, 'transform', `translate(${f((n - q) * W)} 0)`); }
          disp(el, !isHero);
          if (!isHero) set(el, 'transform', `translate(${f((n - q) * W)} 0)`);
        }
        disp(full, heroOn);
      }
      // host scroll offsets per layer (layer units): props below are placed at x + off[L]
      const off = {};
      if (!baking) for (const L of Object.keys(DEP)) {
        const base = D * DEP[L], o = base - Math.floor(base / HOST_WRAP) * HOST_WRAP, xf0 = `translate(${f(-o)} 0)`;
        off[L] = o; set(r['pool-' + L], 'transform', xf0); set(r['sphost-' + L], 'transform', xf0);
        if (L === 'roadside') set(r.fixed, 'transform', xf0);
      }
      if (!baking) {
        // ---- stream pools
        for (const L of Object.keys(pools)) {
          const d = DEP[L], step = STEP[L], M = POOL[L], pool = pools[L], base = D * d, gy = GY[L];
          const j0 = Math.floor((base - 700) / step), j1 = Math.ceil((base + 2300) / step);
          for (let s = 0; s < M; s++) {
            const sl = pool[s]; if (!sl.el) continue;
            // the unique j in [j0, j1] with j ≡ s (mod M)
            const j = j0 + ((s - j0) % M + M) % M;
            if (j > j1) { if (sl.j !== null) { disp(sl.el, false); sl.j = null; } continue; }
            if (sl.j !== j) {
              sl.j = j; sl.it = item(L, j);
              const it = sl.it;
              if (!it) { disp(sl.el, false); continue; }
              for (let u = 0; u < sl.uses.length; u++) set(sl.uses[u], 'href', it.ids[u] ? '#land-' + it.ids[u] : '#land-y-none');
              set(sl.el, 'style', it.sw);
              disp(sl.el, true);
            }
            const it = sl.it; if (!it) continue;
            const sx = it.A - base + off[L];
            set(sl.el, 'transform', `translate(${f(sx)} ${gy}) scale(${f(it.fl * it.sc)} ${f(it.sc)}) translate(${f(-it.cx)} ${-gy})`);
          }
        }
        // ---- signs and km stones (roadside)
        const vis = [];
        for (const fx of FIXED) { const sx = RIDER_X - relTo(D, fx.at) * 0.9; if (sx > -300 && sx < 1950) vis.push([fx, sx]); }
        for (let s = 0; s < fixedSlots.length; s++) {
          const sl = fixedSlots[s], e = vis[s];
          if (!e) { if (sl.key !== null) { disp(sl.el, false); sl.key = null; } continue; }
          const [fx, sx] = e, key = fx.sign !== undefined ? 's' + fx.sign : 'k' + fx.km;
          if (sl.key !== key) {
            sl.key = key; const u = sl.uses;
            if (fx.sign !== undefined) { set(u[0], 'href', '#land-y-signpost'); set(u[1], 'href', '#land-y-sign' + fx.sign); set(u[2], 'href', '#land-y-none'); set(u[3], 'href', '#land-y-none'); set(u[2], 'transform', ''); }
            else {
              const ds = String(fx.km), x0 = -ds.length * DGW / 2;
              set(u[0], 'href', '#land-y-kmstone'); set(u[1], 'href', '#land-y-none');
              for (let q = 0; q < 2; q++) { set(u[2 + q], 'href', ds[q] ? '#land-y-dg' + ds[q] : '#land-y-none'); set(u[2 + q], 'transform', `translate(${f(x0 + q * DGW)} ${GY.roadside - 20})`); }
            }
            disp(sl.el, true);
          }
          set(sl.el, 'transform', `translate(${f(sx + off.roadside)} 0)`);
        }
        // ---- set pieces
        for (const sp of SPS) {
          const d = DEP[sp.layer];
          if (!sp.host) continue;
          let sx, on, near;
          if (sp.key === 'train') { const st = STRETCHES[4], u = relTo(D, st.a) / (st.b - st.a); on = near = u > -0.012 && u < 1.03; }
          else { sx = RIDER_X - relTo(D, sp.at) * d; on = sx + sp.x[1] > -650 && sx + sp.x[0] < 2250; near = sx + sp.x[1] > -1400 && sx + sp.x[0] < 3000; }
          if (near && !sp.el) mountSP(sp);
          else if (!near && sp.el) { unmountSP(sp); continue; }
          if (!sp.el) continue;
          if (sp.key === 'train') { this.train(sp, fr, D, t, red, off[sp.layer]); continue; }
          disp(sp.el, on);
          if (!on) continue;
          set(sp.el, 'transform', `translate(${f(sx + off[sp.layer])} 0)`);
          this.animSP(sp.key, sx, t, red, fr);
        }
      }
      if (!red) {
        // palms sway in the sea breeze
        setA('crown-palm-tall', `rotate(${f(Math.sin(t * 1.1) * 2.2 + Math.sin(t * 2.7 + 1) * 0.7)})`);
        setA('crown-palm-medium', `rotate(${f(Math.sin(t * 1.3 + 2) * 2.6 + Math.sin(t * 3.1) * 0.8)})`);
        // towels flap, flag flutters, kite bobs, crab scuttles, cat tail flicks, hanging fish sway
        for (let i = 0; i < 3; i++) { const a = Math.sin(t * (5 + i) + i * 1.7) * 9 - 6; setA('towel' + i, `skewX(${f(a)})`); }
        setA('towerflag', `scale(${f(1 + Math.sin(t * 9) * 0.08)} ${f(1 + Math.sin(t * 7 + 1) * 0.1)})`);
        setA('kite', `translate(${f(Math.sin(t * 0.8) * 5)} ${f(Math.sin(t * 1.3) * 4)}) rotate(${f(Math.sin(t * 1.1) * 8)})`);
        const cp = wrap(t, 6), walking = cp < 2 || (cp > 3 && cp < 5);
        const cx = cp < 2 ? smooth01(cp / 2) * 14 : cp < 3 ? 14 : cp < 5 ? 14 * (1 - smooth01((cp - 3) / 2)) : 0;
        setA('crab', `translate(${f(cx)} ${f(walking ? -Math.abs(Math.sin(t * 14)) * 0.8 : 0)})`);
        setA('claws', `translate(0 ${f(Math.sin(t * 4) * 0.8)})`);
        const tp = wrap(t, 4.2), be = since(fr, 'bell');
        const tail = be < 1.2 ? -18 * Math.exp(-be * 3) * Math.cos(be * 16) : tp < 0.8 ? Math.sin(tp / 0.8 * Math.PI * 2) * 14 : Math.sin(t * 1.2) * 3;
        setA('cattail', `rotate(${f(tail)})`);
        for (let i = 0; i < 5; i++) setA('hfish' + i, `rotate(${f(Math.sin(t * 2.1 + i * 0.9) * 5)})`);
      }
      // night: glows on/off; road pools track the roadside lamps in screen space
      const lampOn = fr.pal && fr.pal.num ? fr.pal.num.lampOn : (fr.night || 0);
      const on = lampOn > 0.02;
      if (on !== glowOn) { glowOn = on; for (const el of glows) el.setAttribute('display', on ? 'inline' : 'none'); }
      if (on) {
        const op = f(clamp(lampOn, 0, 1)); for (const el of glows) set(el, 'opacity', op);
        const cam = fr.cam || { zoom: 1, fx: 800 };
        const z = d => 1 + ((cam.zoom || 1) - 1) * clamp(d, 0.15, 1), tx = d => 800 + ((cam.fx ?? 800) - 800) * Math.min(d, 1);
        const lx = lampPositions(D, -900, 2600);
        for (let i = 0; i < 4; i++) {
          const X9 = lx[i] ?? -5000, X1 = tx(1) + (z(0.9) / z(1)) * (X9 - tx(0.9));
          set(r['pool' + i], 'transform', `translate(${f(X1)} 0)`);
        }
      }
    },
    // per-set-piece animation (only while on screen)
    animSP(key, sx, t, red, fr) {
      if (red) return;
      if (key === 'pier') {
        const xs = sx + 1176, ph = clamp((RIDER_X + 260 - xs) / 420, 0, 1), up = ph > 0.28;
        const bend = ph < 0.28 ? -16 * Math.sin(ph / 0.28 * Math.PI) * (0.6 + 0.4 * Math.sin(t * 20)) : -6 + Math.sin(t * 3) * 3;
        set(r['sp-rod'], 'transform', `rotate(${f(bend)} 4 -16)`);
        set(r['sp-catch'], 'visibility', up && ph < 1 ? 'visible' : 'hidden');
        if (up) { const u = clamp((ph - 0.28) / 0.4, 0, 1); set(r['sp-catchfish'], 'transform', `translate(${f(-6 * u)} ${f(-80 * Math.sin(u * Math.PI / 2))}) rotate(${f(Math.sin(t * 9) * 20)})`); }
      } else if (key === 'harbour') {
        for (let k = 0; k < 4; k++) set(r['sp-boat' + k], 'transform', `translate(${[260, 760, 1480, 2200][k]} ${f(648 + Math.sin(t * 1.3 + k * 1.7) * 1.4)}) rotate(${f(Math.sin(t * 0.9 + k) * 1.6)})`);
        for (let k = 0; k < 2; k++) set(r['sp-hook' + k], 'transform', `translate(${f([980, 1900][k] + 20 + 270 * 0.8)} 404) rotate(${f(Math.sin(t * 0.8 + k * 2) * 3)})`);
      } else if (key === 'funfair') {
        const cx = 560, cy = 470, Rw = 142, a = t * 7;
        set(r['sp-wheel'], 'transform', `rotate(${f(a)})`);
        for (let i = 0; i < 12; i++) { const th = (a + i * 30) * D2R; set(r['sp-gond' + i], 'transform', `translate(${f(cx + Math.cos(th) * Rw)} ${f(cy + Math.sin(th) * Rw)}) rotate(${f(Math.sin(t * 1.6 + i) * 3)})`); }
        const b = Math.sin(t * 3.4) * 3.2;
        set(r['sp-horsesA'], 'transform', `translate(0 ${f(b)})`); set(r['sp-horsesB'], 'transform', `translate(0 ${f(-b)})`);
      } else if (key === 'lighthouse') {
        set(r['sp-lhflag'], 'transform', `translate(280 500) skewY(${f(Math.sin(t * 6) * 6)}) translate(-280 -500)`);
      } else if (key === 'cliffs') {
        set(r['sp-serpent'], 'transform', `translate(${f(Math.sin(t * 0.5) * 40)} ${f(Math.sin(t * 1.8) * 2.4 + Math.max(0, Math.sin(t * 0.37)) * 6)})`);
      } else if (key === 'river') {
        set(r['sp-rowboat'], 'transform', `translate(0 ${f(Math.sin(t * 1.4) * 1.5)}) rotate(${f(Math.sin(t * 1.1) * 2)} -380 668)`);
      } else if (key === 'fort') {
        set(r['sp-fortflag'], 'transform', `translate(-200 476) skewY(${f(Math.sin(t * 6 + 1) * 6)}) translate(200 -476)`);
        const P = 4.6, ph = wrap(t, P);
        if (ph < 1.1) { const u = ph / 1.1; set(r['sp-diver'], 'transform', `translate(${f(586 - 30 * u)} ${f(548 + 116 * u * u - 34 * Math.sin(Math.PI * u) * (1 - u * 0.4))}) rotate(${f(200 * u)})`); set(r['sp-diver'], 'visibility', 'visible'); }
        else if (ph < 3.2) set(r['sp-diver'], 'visibility', 'hidden');
        else { set(r['sp-diver'], 'visibility', 'visible'); set(r['sp-diver'], 'transform', 'translate(586 548)'); }
        set(r['sp-splash'], 'visibility', ph > 1.05 && ph < 1.7 ? 'visible' : 'hidden');
        if (ph > 1.05 && ph < 1.7) set(r['sp-splash'], 'transform', `translate(560 664) scale(${f(0.6 + (ph - 1.05) * 1.4)} ${f(1.2 - (ph - 1.05) * 1.2)})`);
      }
    },
    // the coast-railway train races the pelican through the railway stretch
    train(sp, fr, D, t, red, o = 0) {
      const st = STRETCHES[4], p = relTo(D, st.a), u = p / (st.b - st.a);
      const on = u > -0.01 && u < 1.03;
      disp(sp.el, on);
      if (!on) return;
      const K = [[0, -760], [0.1, 560], [0.2, 1240], [0.45, 1360], [0.6, 1120], [0.72, 560], [0.85, 1300], [0.93, 1800], [1.03, 2800]];
      let i = 1; while (i < K.length - 1 && u > K[i][0]) i++;
      const [u0, x0] = K[i - 1], [u1, x1] = K[i], w = smooth01((u - u0) / (u1 - u0));
      const sx = lerp(x0, x1, w) + (u > 0.3 && u < 0.7 ? Math.sin(u * 40) * 26 : 0);
      const Aw = sx + D * 0.6;                    // train position along the layer: drives the wheels
      set(sp.el, 'transform', `translate(${f(sx + o)} ${red ? 0 : f(Math.sin(Aw * 0.09) * 0.5)})`);
      const radii = [12, 12, 7, 7, 7, 7, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5];
      for (let k = 0; k < 12; k++) set(r['sp-tw' + k], 'transform', `rotate(${f(wrap(Aw / radii[k] / D2R, 360))})`);
      const th = Aw / 12;
      set(r['sp-crod'], 'transform', `translate(${f(Math.cos(th) * 6.6)} ${f(636 + Math.sin(th) * 6.6)})`);
      for (let k = 0; k < 7; k++) {
        const a = wrap(t / 1.7 + k / 7, 1), el = r['sp-puff' + k];
        set(el, 'transform', `translate(${f(-35 - a * 190)} ${f(584 - a * 52 - Math.sin(a * 6) * 3)}) scale(${f(0.45 + a * 1.5)})`);
        set(el, 'opacity', f(a < 0.7 ? 1 : (1 - a) / 0.3));
      }
      const tootOn = (u > 0.2 && u < 0.27) || (u > 0.84 && u < 0.89);
      set(r['sp-toot'], 'visibility', tootOn ? 'visible' : 'hidden');
      if (tootOn) { const k = (u > 0.5 ? (u - 0.84) / 0.05 : (u - 0.2) / 0.07); set(r['sp-toot'], 'transform', `translate(-30 538) scale(${f(0.7 + 0.5 * Math.min(1, k * 4))})`); }
      const wv = since(fr, 'wave'), waving = tootOn || wv < 2.2;
      set(r['sp-driverArm'], 'transform', `translate(-118 602) rotate(${f(waving && !red ? Math.sin(t * 12) * 28 - 20 : 30)})`);
    },
    bake(kit) {
      // bake: legacy mode (frame.bake / globalThis.__pbBake): the hero tile loops seamlessly, 1 tile per crank turn
      return Object.entries(LAY).map(([k, L]) => ({ selector: k === 'fg' ? '[data-ref="land-t-fg"]' : `[data-ref="land-full${k}"]`, kind: 'transform', type: 'translate', values: [`${f(L.W / 2)} 0`, `${f(-L.W / 2)} 0`], dur: L.W / (L.d * DIST_PER_REV) }))
        .map(d => (kit && kit.normalize ? kit.normalize(d) : d));
    },
  };
}
