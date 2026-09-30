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
import { GROUND_Y, TILE, DIST_PER_REV } from '../contract.js';
import { h, refs } from '../core/svg.js';

export const id = 'land';

// Glyph outlines extracted with drafts/C-poster/ttf.mjs (DejaVu Sans Bold: Bitstream Vera licence; WenQuanYi Zen Hei: GPL
// with font-embedding exception). [d at em 100, advance]
const GL = {"0":["M46 -36.5Q46 -50.2 43.4 -55.8Q40.9 -61.4 34.8 -61.4Q28.8 -61.4 26.2 -55.8Q23.6 -50.2 23.6 -36.5Q23.6 -22.7 26.2 -17Q28.8 -11.4 34.8 -11.4Q40.8 -11.4 43.4 -17Q46 -22.7 46 -36.5ZM64.8 -36.4Q64.8 -18.3 57 -8.4Q49.2 1.4 34.8 1.4Q20.4 1.4 12.6 -8.4Q4.8 -18.3 4.8 -36.4Q4.8 -54.5 12.6 -64.4Q20.4 -74.2 34.8 -74.2Q49.2 -74.2 57 -64.4Q64.8 -54.5 64.8 -36.4Z",70],"1":["M11.7 -13L28.3 -13L28.3 -60.1L11.3 -56.6L11.3 -69.4L28.2 -72.9L46.1 -72.9L46.1 -13L62.7 -13L62.7 0L11.7 0Z",70],"2":["M28.8 -13.8L60.9 -13.8L60.9 0L7.9 0L7.9 -13.8L34.5 -37.3Q38.1 -40.5 39.8 -43.6Q41.5 -46.7 41.5 -50Q41.5 -55.1 38.1 -58.2Q34.6 -61.4 28.9 -61.4Q24.5 -61.4 19.3 -59.5Q14.1 -57.6 8.1 -53.9L8.1 -69.9Q14.5 -72 20.7 -73.1Q26.9 -74.2 32.8 -74.2Q45.9 -74.2 53.2 -68.5Q60.4 -62.7 60.4 -52.4Q60.4 -46.4 57.3 -41.3Q54.3 -36.1 44.4 -27.5Z",70],"3":["M46.6 -39.3Q54 -37.4 57.8 -32.7Q61.6 -28 61.6 -20.7Q61.6 -9.9 53.3 -4.2Q45 1.4 29.1 1.4Q23.5 1.4 17.9 0.5Q12.2 -0.4 6.7 -2.2L6.7 -16.7Q12 -14.1 17.2 -12.7Q22.4 -11.4 27.4 -11.4Q34.9 -11.4 38.8 -14Q42.8 -16.5 42.8 -21.4Q42.8 -26.4 38.8 -28.9Q34.7 -31.5 26.7 -31.5L19.2 -31.5L19.2 -43.6L27.1 -43.6Q34.2 -43.6 37.7 -45.8Q41.1 -48 41.1 -52.6Q41.1 -56.8 37.7 -59.1Q34.4 -61.4 28.2 -61.4Q23.7 -61.4 19 -60.3Q14.4 -59.3 9.8 -57.3L9.8 -71.1Q15.4 -72.7 20.9 -73.4Q26.3 -74.2 31.6 -74.2Q45.8 -74.2 52.9 -69.6Q59.9 -64.9 59.9 -55.5Q59.9 -49.1 56.5 -45Q53.2 -41 46.6 -39.3Z",70],"4":["M36.8 -57.4L16.2 -26.9L36.8 -26.9ZM33.7 -72.9L54.6 -72.9L54.6 -26.9L65 -26.9L65 -13.3L54.6 -13.3L54.6 0L36.8 0L36.8 -13.3L4.5 -13.3L4.5 -29.4Z",70],"5":["M10.6 -72.9L57.3 -72.9L57.3 -59.1L25.6 -59.1L25.6 -47.8Q27.7 -48.4 29.9 -48.7Q32.1 -49 34.4 -49Q47.8 -49 55.2 -42.4Q62.6 -35.7 62.6 -23.8Q62.6 -12 54.5 -5.3Q46.4 1.4 32.1 1.4Q25.9 1.4 19.8 0.2Q13.7 -1 7.7 -3.4L7.7 -18.2Q13.7 -14.8 19 -13.1Q24.4 -11.4 29.1 -11.4Q35.9 -11.4 39.9 -14.7Q43.8 -18.1 43.8 -23.8Q43.8 -29.5 39.9 -32.9Q35.9 -36.2 29.1 -36.2Q25.1 -36.2 20.5 -35.1Q15.9 -34.1 10.6 -31.9Z",70],"6":["M36.2 -36Q31.3 -36 28.8 -32.8Q26.3 -29.6 26.3 -23.2Q26.3 -16.8 28.8 -13.6Q31.3 -10.4 36.2 -10.4Q41.2 -10.4 43.6 -13.6Q46.1 -16.8 46.1 -23.2Q46.1 -29.6 43.6 -32.8Q41.2 -36 36.2 -36ZM59.4 -71L59.4 -57.5Q54.8 -59.7 50.7 -60.8Q46.6 -61.8 42.7 -61.8Q34.3 -61.8 29.6 -57.1Q24.9 -52.5 24.1 -43.3Q27.3 -45.7 31.1 -46.9Q34.9 -48.1 39.3 -48.1Q50.5 -48.1 57.4 -41.5Q64.2 -35 64.2 -24.4Q64.2 -12.7 56.5 -5.6Q48.9 1.4 36 1.4Q21.8 1.4 14 -8.2Q6.2 -17.8 6.2 -35.4Q6.2 -53.5 15.3 -63.8Q24.4 -74.1 40.3 -74.1Q45.3 -74.1 50.1 -73.3Q54.8 -72.6 59.4 -71Z",70],"7":["M6.7 -72.9L61.6 -72.9L61.6 -62.3L33.2 0L14.9 0L41.8 -59.1L6.7 -59.1Z",70],"8":["M34.8 -32.6Q29.5 -32.6 26.7 -29.7Q23.9 -26.9 23.9 -21.5Q23.9 -16.1 26.7 -13.3Q29.5 -10.4 34.8 -10.4Q40 -10.4 42.8 -13.3Q45.6 -16.1 45.6 -21.5Q45.6 -26.9 42.8 -29.8Q40 -32.6 34.8 -32.6ZM21.1 -38.8Q14.5 -40.8 11.1 -45Q7.7 -49.1 7.7 -55.3Q7.7 -64.5 14.6 -69.4Q21.5 -74.2 34.8 -74.2Q48.1 -74.2 54.9 -69.4Q61.8 -64.6 61.8 -55.3Q61.8 -49.1 58.4 -45Q55 -40.8 48.4 -38.8Q55.8 -36.8 59.6 -32.1Q63.4 -27.5 63.4 -20.5Q63.4 -9.7 56.2 -4.1Q49 1.4 34.8 1.4Q20.6 1.4 13.4 -4.1Q6.1 -9.7 6.1 -20.5Q6.1 -27.5 9.9 -32.1Q13.7 -36.8 21.1 -38.8ZM25.5 -53.4Q25.5 -49.1 27.9 -46.7Q30.3 -44.4 34.8 -44.4Q39.2 -44.4 41.6 -46.7Q44 -49.1 44 -53.4Q44 -57.8 41.6 -60.1Q39.2 -62.4 34.8 -62.4Q30.3 -62.4 27.9 -60.1Q25.5 -57.7 25.5 -53.4Z",70],"9":["M10 -1.6L10 -15.1Q14.5 -13 18.6 -11.9Q22.7 -10.9 26.7 -10.9Q35.1 -10.9 39.8 -15.5Q44.5 -20.2 45.3 -29.4Q42 -26.9 38.2 -25.7Q34.5 -24.5 30.1 -24.5Q18.9 -24.5 12 -31Q5.2 -37.5 5.2 -48.2Q5.2 -60 12.8 -67Q20.5 -74.1 33.3 -74.1Q47.6 -74.1 55.4 -64.5Q63.2 -54.9 63.2 -37.3Q63.2 -19.2 54.1 -8.9Q44.9 1.4 29 1.4Q23.9 1.4 19.2 0.7Q14.5 -0.1 10 -1.6ZM33.2 -36.7Q38.1 -36.7 40.6 -39.9Q43.1 -43.1 43.1 -49.5Q43.1 -55.9 40.6 -59.1Q38.1 -62.3 33.2 -62.3Q28.3 -62.3 25.8 -59.1Q23.3 -55.9 23.3 -49.5Q23.3 -43.1 25.8 -39.9Q28.3 -36.7 33.2 -36.7Z",70],"鹈":["M31.6 12Q28 11.6 24.5 12Q24.8 5.4 24.8 -1.3L24.8 -17.3Q18.6 -6 6.2 5.5Q4.2 2.6 1 1.4Q6.5 -3.5 11.3 -9.7Q16 -15.8 21.6 -26.5L9 -26.5L8.9 -47.3L24.8 -47.3L24.8 -57.7L17.7 -57.7Q13.1 -57.7 8.6 -57.4Q8.8 -60 8.6 -62.4Q13.1 -62.2 17.7 -62.2L27.7 -62.2Q32.7 -70.1 36.4 -80.4Q39.8 -78.8 43.3 -78Q40.9 -70.9 35.5 -62.2L47.6 -62.2L47.6 -42.7L31.4 -42.7L31.4 -31L48.4 -31L48.4 -13.3Q48.4 -9.8 44.5 -7.3Q40.5 -4.9 35.7 -5Q36.5 -9.6 33.8 -13.5Q35.5 -13 37.4 -12.6Q40.8 -12.5 41.4 -12.7Q41.9 -12.9 41.9 -14.2L41.9 -26.5L31.4 -26.5L31.4 -1.3Q31.4 5.4 31.6 12ZM25.8 -66.4L19.6 -62.7L10.4 -78.1L16.5 -81.8ZM24.8 -31L24.8 -42.7L15.4 -42.7Q15.4 -37.1 15.5 -31ZM31.4 -47.3L41 -47.3L41 -57.7L32.5 -57.7L32.2 -57.3Q32 -57.7 31.4 -57.7ZM85.6 -12.7Q85.4 -10.1 85.6 -7.4Q81.5 -7.6 77.3 -7.6L64 -7.6Q59.9 -7.6 55.9 -7.4Q56.1 -10.1 55.9 -12.7Q59.9 -12.4 64 -12.4L77.3 -12.4Q81.5 -12.4 85.6 -12.7ZM79.9 -51L75 -46.5L68.5 -56.6L73.3 -61.1ZM78.2 -33.2Q78.8 -38.3 76.6 -41.4Q78.7 -41 81.8 -41Q85 -40.9 85.4 -41.4Q85.7 -41.9 85.7 -43.4L85.7 -63.3L72.3 -63.3L71.2 -62Q70.8 -62.7 70.4 -63.3Q68.8 -63.3 66.2 -63.3L66.2 -29.3L96.4 -29.3L96.4 4.4Q96.4 7.9 94 10.6Q90.2 13.9 81.9 13.8Q82.6 8.6 80.1 5.6Q82.6 6 86.2 6Q89.8 6.1 90.3 5.5Q90.8 4.9 90.8 2.7L90.8 -24.5L60.6 -24.5L60.6 -68.1Q64.6 -68.1 68.5 -68.1Q71.7 -72.1 73.3 -78.1Q76.1 -76.6 79.2 -75.8Q78 -71.2 75.9 -68.1L91.3 -68.1L91.3 -42.2Q91.3 -39.2 89 -36.5Q85.6 -33.3 78.2 -33.2Z",100],"鹕":["M49.1 -26.1L39.5 -26.1Q40 -11.4 35.2 -2.1Q30.4 7.2 22.5 12Q20.7 8.5 16.9 7.2Q32.7 0.3 33 -22.4L32.9 -74.4L55.6 -74.4L55.6 1.2Q55.7 7.6 52 10Q47.7 12.6 40.7 12.4Q41.6 8.1 38.9 4.6Q41.2 5 44.3 5Q47.5 5.1 48.2 4.2Q49.1 2.8 49.1 -2.6ZM11.5 -2.1L5.1 -2.1L5.1 -38Q9.2 -38 13.1 -38L13.1 -53.6L1.7 -53.4Q2 -55.8 1.7 -58.1L13.1 -57.9L13.1 -69.4Q13.1 -76 12.8 -82.4Q16.3 -82.1 19.8 -82.4Q19.4 -76 19.4 -69.4L19.4 -57.9L32.2 -58.1Q32 -55.8 32.2 -53.4L19.4 -53.6L19.4 -38L27.6 -38L27.6 -2.1L21.3 -2.1L21.3 -10.2L11.5 -10.2ZM49.1 -52.4L49.1 -70.2L39.3 -70.2L39.4 -52.4ZM49.1 -30L49.1 -48.6L39.4 -48.6L39.5 -30ZM21.3 -33.7L11.5 -33.7L11.5 -14.2L21.3 -14.2ZM86.5 -12.7Q86.3 -10.1 86.5 -7.4Q82.7 -7.6 78.9 -7.6L66.4 -7.6Q62.6 -7.6 58.8 -7.4Q59 -10.1 58.8 -12.7Q62.6 -12.4 66.4 -12.4L78.9 -12.4Q82.7 -12.4 86.5 -12.7ZM81.3 -51L76.7 -46.5L70.6 -56.6L75.1 -61.1ZM79.7 -33.2Q80.3 -38.3 78.2 -41.4Q80.2 -41 83.1 -41Q85.9 -40.9 86.3 -41.4Q86.7 -41.9 86.7 -43.4L86.7 -63.3L74.1 -63.3L73.1 -62Q72.8 -62.7 72.5 -63.3Q70.8 -63.3 68.5 -63.3L68.5 -29.3L96.7 -29.3L96.7 4.4Q96.7 7.9 94.3 10.6Q90.9 13.9 83.1 13.8Q83.8 8.6 81.5 5.6Q83.8 6 87.1 6Q90.4 6.1 90.9 5.5Q91.4 4.9 91.4 2.7L91.4 -24.5L63.3 -24.5L63.3 -68.1Q66.9 -68.1 70.6 -68.1Q73.5 -72.1 75.1 -78.1Q77.6 -76.6 80.6 -75.8Q79.5 -71.2 77.5 -68.1L91.9 -68.1L91.9 -42.2Q91.9 -39.2 89.7 -36.5Q86.5 -33.3 79.7 -33.2Z",100],"湾":["M77.3 -35.5L46.4 -35.5Q41.9 -35.5 37.3 -35.3Q37.5 -37.8 37.3 -40.3Q41.9 -40 46.4 -40L83.9 -40L83.9 -23.5L45.7 -23.3L43.1 -15.5L88.7 -15.5L83.8 4.8Q81.6 12.7 63.1 12.5Q63.7 10.2 62.9 8.1Q62.2 6.1 60.6 4.7Q64.4 5.1 70.3 4.7Q76.2 4.3 76.8 3.8Q77.4 3.3 77.6 2.3L80.9 -11L34.6 -11L39.8 -26L39.8 -27.4L40.2 -27.4L40.6 -28.5L43.9 -27.4L77.3 -27.6ZM91.2 -42.9Q84.3 -53 74 -59.9L78 -65.8Q89.5 -58.2 97.2 -46.9ZM39.2 -61.5Q42.4 -60.1 45.9 -59.2Q43.3 -50.6 37 -40.4L33 -34.1Q30.5 -36.5 27.1 -36.9Q32.1 -43.9 35.9 -53.4ZM73.1 -42.8Q69.4 -43.2 65.8 -42.8Q66.1 -49.4 66.1 -56L66.1 -67.9L57.3 -67.9L57.3 -56.5Q57.3 -49.9 57.6 -43.3Q54 -43.5 50.5 -43.3Q50.8 -49.9 50.8 -56.5L50.8 -67.9L38.6 -67.9Q34.1 -67.9 29.5 -67.7Q29.7 -70.1 29.5 -72.7Q34.1 -72.5 38.6 -72.5L61.1 -72.5L51.1 -79L55 -85L67.9 -76.6L65.1 -72.5L87.2 -72.5Q91.8 -72.5 96.4 -72.7Q96.1 -70.1 96.4 -67.7Q91.8 -67.9 87.2 -67.9L72.7 -67.9L72.7 -56Q72.7 -49.4 73.1 -42.8ZM11.1 11.5Q8 9.2 3.5 9Q6.7 1.1 10.2 -9.1Q13.6 -19.2 20.2 -44.3L23.1 -42.3L14.7 -5.3ZM16.9 -44.6L12.2 -39.8L1.3 -53.1L6 -58ZM18.3 -61.1Q13.2 -68.5 7.1 -75L11.6 -80.1Q18 -73.2 23.3 -65.4Z",100],"鲜":["M76.9 12Q73.3 11.6 69.8 12Q70.1 5.5 70.1 -1L70.1 -13.8L61.8 -13.8Q57.5 -13.8 53.1 -13.6Q53.4 -15.9 53.1 -18.3Q57.5 -18 61.8 -18L70.1 -18L70.1 -33.2L63.9 -33.2Q59.6 -33.2 55.2 -33Q55.5 -35.3 55.2 -37.7Q59.6 -37.5 63.9 -37.5L70.1 -37.5L70.1 -52.9L61.8 -52.9Q57.5 -52.9 53.1 -52.7Q53.4 -55.1 53.1 -57.4Q57.5 -57.2 61.8 -57.2L70 -57.2L79.1 -73.2L83.8 -81Q86.6 -78.8 89.8 -77.3L85.2 -69.6L79.4 -60.7L77.3 -57.2L88 -57.2Q92.3 -57.2 96.7 -57.4Q96.4 -55.1 96.7 -52.7Q92.3 -52.9 88 -52.9L76.5 -52.9L76.5 -37.5L84.4 -37.5Q88.7 -37.5 93 -37.7Q92.7 -35.3 93 -33Q88.7 -33.2 84.4 -33.2L76.5 -33.2L76.5 -18L88.2 -18Q92.6 -18 96.9 -18.3Q96.6 -15.9 96.9 -13.6Q92.6 -13.8 88.2 -13.8L76.5 -13.8L76.5 -1Q76.5 5.5 76.9 12ZM63.9 -58.8Q58.8 -68.3 52.4 -76.9L58.2 -81Q64.8 -72 70.1 -62.1ZM6.6 9.1Q6.6 4.3 4.5 1.1Q11.7 0.7 20.7 -0.6Q29.7 -1.9 50.7 -6.9L50.7 -2.8Q30.4 2.2 21.9 4.5Q13.5 6.9 6.6 9.1ZM22.3 -78.9Q25.6 -77.6 29.5 -77Q27.7 -70.5 25 -64.3L41.7 -64.3L42.7 -58.7Q41.3 -58.5 40.6 -57.5L34.9 -47.6L48.5 -47.6Q47.2 -29.1 48.3 -10.4L12.7 -10.4Q13.8 -27.3 13 -43.5Q10 -39.5 6.7 -35.7Q4.5 -38.3 0.8 -39.2Q15.2 -55.1 22.3 -78.9ZM33.3 -32.2L41.6 -32.2L41.7 -43.1L33.3 -43.1ZM26.5 -32.2L26.5 -43.1L19.5 -43.1L19.5 -32.2ZM33.3 -28L33.3 -14.9L41.5 -14.9L41.6 -28ZM26.5 -28L19.5 -28L19.5 -14.9L26.5 -14.9ZM34.1 -59.8L23 -59.8Q19.9 -53.7 15.7 -47.6L28.6 -47.6L27.4 -48.2Z",100],"鱼":["M95.8 0.5Q95.5 3.3 95.8 6.2Q90.6 5.9 85.4 5.9L15.7 5.9Q10.5 5.9 5.3 6.2Q5.6 3.3 5.3 0.5Q10.5 0.7 15.7 0.7L85.4 0.7Q90.6 0.7 95.8 0.5ZM37.6 -70.5L67 -70.5L67.8 -64.5Q65.5 -64.1 64.1 -62.8L55.6 -54.1L80.2 -54.1Q78.9 -31.9 80.2 -9.9L19 -9.9Q19.5 -20.9 19.5 -30.4Q19.5 -39.9 19.2 -47.8Q13.4 -41.9 7.2 -37.3Q5.1 -41 1.2 -42.8Q17.6 -54.4 25.3 -65.4Q30.7 -73 34.9 -81.3Q38.3 -78.9 42.1 -77.2ZM52.8 -34.9L73.3 -34.9L73.3 -48.9L52.8 -48.9ZM45.9 -34.9L45.9 -48.9L25.8 -48.9L25.8 -34.9ZM52.8 -29.7L52.8 -15L73.3 -15L73.3 -29.7ZM45.9 -29.7L25.8 -29.7L25.8 -15L45.9 -15ZM47.5 -54.1L46.8 -54.8L57 -65.4L33.9 -65.4Q29.4 -59.2 24.9 -54.1Z",100],"巴":["M19.9 5.9Q15.3 5.9 12.4 2.8Q9.4 -0.2 9.4 -5.3L9.4 -74L84.1 -74.2L84.1 -34.6L76.9 -34.6L76.9 -38.1L16.5 -38.1L16.5 -5.3Q16.5 -3.4 17.5 -2Q18.5 -0.7 20 -0.7L76.8 -0.7Q79.5 -0.7 81.5 -2.4Q83.6 -4.2 84 -6.8L85.9 -21.4Q89.1 -19.1 92.9 -19.1L90 -1.4Q89.7 1.8 87.4 3.8Q85.2 5.9 82.1 5.9ZM16.5 -44L43.1 -44L43.1 -68.2L16.5 -68.2ZM50.3 -44L76.9 -44L76.9 -68.3L50.3 -68.3Z",100],"士":["M89.3 -1Q88.9 2.6 89.3 6.2Q82.7 5.9 76.1 5.9L21.6 5.9Q14.9 5.9 8.4 6.2Q8.8 2.6 8.4 -1Q14.9 -0.7 21.6 -0.7L45.1 -0.7L45.1 -41.1L14.9 -41.1Q8.3 -41.1 1.8 -40.7Q2.2 -44.3 1.8 -47.8Q8.3 -47.6 14.9 -47.6L45.1 -47.6L45.1 -67.3Q45.1 -74.8 44.7 -82.3Q48.8 -81.8 52.9 -82.3Q52.5 -74.8 52.5 -67.3L52.5 -47.6L82.7 -47.6Q89.4 -47.6 95.9 -47.8Q95.5 -44.3 95.9 -40.7Q89.4 -41.1 82.7 -41.1L52.5 -41.1L52.5 -0.7L76.1 -0.7Q82.7 -0.7 89.3 -1Z",100],"站":["M56 12Q52.3 11.6 48.6 12Q48.9 5.2 48.9 -1.7L49 -31.3L63.3 -31.3L63.3 -68.5Q63.3 -75.4 63 -82.1Q66.6 -81.7 70.3 -82.1Q70 -75.4 70 -68.5L70 -57.2L87 -57.2Q91.9 -57.2 96.8 -57.4Q96.5 -54.8 96.8 -52.1Q91.9 -52.3 87 -52.3L70 -52.3L70 -31.3L88.2 -31.3L88.2 11.8L81.5 11.8L81.5 4.8L55.8 4.8Q55.9 8.4 56 12ZM81.5 -26.5L55.7 -26.5L55.7 0L81.5 0ZM3.2 0.3Q2.9 -4.4 0.1 -7.6Q7 -7.8 15.4 -8.8Q23.8 -9.9 43.2 -14.3L43.3 -10.2Q24.8 -5.9 17.1 -3.8Q9.4 -1.7 3.2 0.3ZM31.9 -48.4Q36.1 -47.4 41 -46.9Q39.2 -39.8 36.1 -30.2Q33.1 -20.5 32.5 -18.3Q31.9 -16.1 31.1 -12.3Q26.9 -13.5 22.5 -12.5L27.8 -34.5Q29.8 -41.5 31.9 -48.4ZM22.8 -18.4L13.7 -16.7Q11.5 -24.1 8.8 -31.4Q6.2 -38.7 3 -45.9L11.9 -48.1Q15 -40.8 17.8 -33.3Q20.5 -25.9 22.8 -18.4ZM46.4 -58.5Q46.1 -56 46.4 -53.5Q40.5 -53.7 34.6 -53.7L12.7 -53.7Q6.7 -53.7 0.9 -53.5Q1.2 -56 0.9 -58.5Q6.7 -58.3 12.7 -58.3L34.6 -58.3Q40.5 -58.3 46.4 -58.5ZM23.1 -59Q18.5 -67.9 12.4 -75.8L20.4 -79.5Q26.9 -71.1 31.8 -61.7Z",100],"邮":["M14.1 12Q10.3 11.6 6.5 12Q6.7 4.9 6.7 -2.1L6.8 -65.3L25.4 -65.3L25.4 -68.1Q25.4 -75.1 25.1 -82.1Q28.9 -81.7 32.7 -82.1Q32.4 -75.1 32.4 -68.1L32.4 -65.3L51.6 -65.3L51.6 11.8L44.5 11.8L44.5 -2.9L13.8 -2.9ZM32.7 -8.3L44.5 -8.4L44.5 -32L32.4 -32L32.4 -21.5Q32.4 -14.9 32.7 -8.3ZM25.4 -21.5L25.4 -32L13.8 -32L13.8 -8.4L25.1 -8.3Q25.4 -14.9 25.4 -21.5ZM32.4 -37.4L44.5 -37.4L44.5 -60L32.4 -60ZM25.4 -37.4L25.4 -60L13.8 -60L13.8 -37.4ZM70.2 13.4Q67.1 13 64 13.4Q64.3 6.2 64.3 -1.2L64.3 -75.3L91.7 -75.3L91.7 -69.3Q90.3 -67.4 89.6 -64.9L82.4 -43.1Q87.9 -38.3 91 -30.8Q94.1 -23.3 94.1 -14.8Q94.1 -6.2 83.7 -0.9L80.1 0.9Q78.7 -2.9 76.9 -6L82.8 -8.3Q88.7 -10.4 88.7 -14.8Q88.7 -23.3 85.3 -30.8Q81.9 -38.2 76.1 -42.5L84.9 -69.3L69.9 -69.3L69.9 -1.2Q69.9 6.1 70.2 13.4Z",100],"A":["M53.4 -13.3L24 -13.3L19.4 0L0.5 0L27.5 -72.9L49.9 -72.9L76.9 0L58 0ZM28.7 -26.8L48.7 -26.8L38.7 -55.8Z",77],"B":["M38.4 -44.7Q42.8 -44.7 45.1 -46.6Q47.4 -48.6 47.4 -52.4Q47.4 -56.1 45.1 -58.1Q42.8 -60.1 38.4 -60.1L28 -60.1L28 -44.7ZM39 -12.8Q44.7 -12.8 47.5 -15.2Q50.4 -17.6 50.4 -22.4Q50.4 -27.1 47.6 -29.5Q44.7 -31.9 39 -31.9L28 -31.9L28 -12.8ZM56.5 -39Q62.6 -37.3 65.9 -32.5Q69.2 -27.8 69.2 -20.9Q69.2 -10.3 62.1 -5.2Q54.9 0 40.4 0L9.2 0L9.2 -72.9L37.4 -72.9Q52.6 -72.9 59.4 -68.3Q66.2 -63.7 66.2 -53.6Q66.2 -48.3 63.7 -44.6Q61.2 -40.8 56.5 -39Z",76],"C":["M67 -4Q61.8 -1.3 56.2 0.1Q50.6 1.4 44.5 1.4Q26.3 1.4 15.6 -8.8Q5 -18.9 5 -36.4Q5 -53.9 15.6 -64Q26.3 -74.2 44.5 -74.2Q50.6 -74.2 56.2 -72.8Q61.8 -71.5 67 -68.8L67 -53.7Q61.8 -57.3 56.7 -58.9Q51.6 -60.6 46 -60.6Q35.9 -60.6 30.2 -54.1Q24.4 -47.7 24.4 -36.4Q24.4 -25.1 30.2 -18.6Q35.9 -12.2 46 -12.2Q51.6 -12.2 56.7 -13.9Q61.8 -15.5 67 -19.1Z",73],"D":["M28 -58.7L28 -14.2L34.7 -14.2Q46.2 -14.2 52.3 -19.9Q58.4 -25.6 58.4 -36.5Q58.4 -47.4 52.3 -53Q46.3 -58.7 34.7 -58.7ZM9.2 -72.9L29 -72.9Q45.6 -72.9 53.7 -70.5Q61.9 -68.2 67.7 -62.5Q72.8 -57.6 75.3 -51.1Q77.8 -44.7 77.8 -36.5Q77.8 -28.3 75.3 -21.8Q72.8 -15.3 67.7 -10.4Q61.8 -4.7 53.6 -2.4Q45.4 0 29 0L9.2 0Z",83],"E":["M9.2 -72.9L59.9 -72.9L59.9 -58.7L28 -58.7L28 -45.1L58 -45.1L58 -30.9L28 -30.9L28 -14.2L61 -14.2L61 0L9.2 0Z",68],"F":["M9.2 -72.9L59.9 -72.9L59.9 -58.7L28 -58.7L28 -45.1L58 -45.1L58 -30.9L28 -30.9L28 0L9.2 0Z",68],"G":["M74.7 -5.4Q67.7 -2 60.1 -0.3Q52.5 1.4 44.5 1.4Q26.3 1.4 15.6 -8.8Q5 -18.9 5 -36.4Q5 -54 15.8 -64.1Q26.7 -74.2 45.5 -74.2Q52.8 -74.2 59.5 -72.8Q66.1 -71.5 72 -68.8L72 -53.7Q65.9 -57.2 59.9 -58.9Q53.9 -60.6 47.8 -60.6Q36.6 -60.6 30.5 -54.3Q24.4 -48 24.4 -36.4Q24.4 -24.8 30.3 -18.5Q36.1 -12.2 46.9 -12.2Q49.9 -12.2 52.4 -12.6Q54.9 -12.9 56.9 -13.7L56.9 -27.9L45.4 -27.9L45.4 -40.5L74.7 -40.5Z",82],"H":["M9.2 -72.9L28 -72.9L28 -45.1L55.7 -45.1L55.7 -72.9L74.5 -72.9L74.5 0L55.7 0L55.7 -30.9L28 -30.9L28 0L9.2 0Z",84],"I":["M9.2 -72.9L28 -72.9L28 0L9.2 0Z",37],"K":["M9.2 -72.9L28 -72.9L28 -46.3L55.1 -72.9L76.9 -72.9L41.8 -38.4L80.5 0L57 0L28 -28.7L28 0L9.2 0Z",77],"L":["M9.2 -72.9L28 -72.9L28 -14.2L61 -14.2L61 0L9.2 0Z",64],"M":["M9.2 -72.9L33.1 -72.9L49.7 -33.9L66.4 -72.9L90.3 -72.9L90.3 0L72.5 0L72.5 -53.3L55.7 -14L43.8 -14L27 -53.3L27 0L9.2 0Z",100],"N":["M9.2 -72.9L30.2 -72.9L56.7 -22.9L56.7 -72.9L74.5 -72.9L74.5 0L53.5 0L27 -50L27 0L9.2 0Z",84],"O":["M42.5 -60.6Q33.9 -60.6 29.2 -54.2Q24.4 -47.9 24.4 -36.4Q24.4 -24.9 29.2 -18.5Q33.9 -12.2 42.5 -12.2Q51.1 -12.2 55.9 -18.5Q60.6 -24.9 60.6 -36.4Q60.6 -47.9 55.9 -54.2Q51.1 -60.6 42.5 -60.6ZM42.5 -74.2Q60.1 -74.2 70 -64.2Q80 -54.1 80 -36.4Q80 -18.7 70 -8.6Q60.1 1.4 42.5 1.4Q25 1.4 15 -8.6Q5 -18.7 5 -36.4Q5 -54.1 15 -64.2Q25 -74.2 42.5 -74.2Z",85],"P":["M9.2 -72.9L40.4 -72.9Q54.3 -72.9 61.7 -66.7Q69.2 -60.5 69.2 -49.1Q69.2 -37.6 61.7 -31.5Q54.3 -25.3 40.4 -25.3L28 -25.3L28 0L9.2 0ZM28 -59.3L28 -38.9L38.4 -38.9Q43.9 -38.9 46.8 -41.6Q49.8 -44.2 49.8 -49.1Q49.8 -54 46.8 -56.6Q43.9 -59.3 38.4 -59.3Z",73],"R":["M35.9 -40.6Q41.8 -40.6 44.4 -42.8Q46.9 -45 46.9 -50Q46.9 -55 44.4 -57.1Q41.8 -59.3 35.9 -59.3L28 -59.3L28 -40.6ZM28 -27.6L28 0L9.2 0L9.2 -72.9L37.9 -72.9Q52.3 -72.9 59 -68.1Q65.7 -63.2 65.7 -52.8Q65.7 -45.6 62.2 -40.9Q58.7 -36.3 51.7 -34.1Q55.6 -33.2 58.6 -30.1Q61.7 -27 64.8 -20.7L75 0L55 0L46.1 -18.1Q43.4 -23.6 40.7 -25.6Q37.9 -27.6 33.3 -27.6Z",77],"S":["M59.9 -70.6L59.9 -55.2Q53.9 -57.9 48.2 -59.2Q42.5 -60.6 37.4 -60.6Q30.7 -60.6 27.4 -58.7Q24.2 -56.9 24.2 -53Q24.2 -50 26.4 -48.4Q28.6 -46.8 34.3 -45.6L42.3 -44Q54.4 -41.5 59.6 -36.6Q64.7 -31.6 64.7 -22.4Q64.7 -10.3 57.5 -4.5Q50.4 1.4 35.7 1.4Q28.8 1.4 21.8 0.1Q14.8 -1.2 7.8 -3.8L7.8 -19.7Q14.8 -16 21.3 -14.1Q27.8 -12.2 33.9 -12.2Q40 -12.2 43.3 -14.3Q46.6 -16.3 46.6 -20.1Q46.6 -23.5 44.4 -25.4Q42.1 -27.2 35.5 -28.7L28.2 -30.3Q17.3 -32.7 12.2 -37.8Q7.2 -42.9 7.2 -51.6Q7.2 -62.5 14.2 -68.4Q21.2 -74.2 34.4 -74.2Q40.4 -74.2 46.8 -73.3Q53.1 -72.4 59.9 -70.6Z",72],"T":["M0.5 -72.9L67.7 -72.9L67.7 -58.7L43.5 -58.7L43.5 0L24.7 0L24.7 -58.7L0.5 -58.7Z",68],"U":["M9.2 -72.9L28 -72.9L28 -29.2Q28 -20.2 30.9 -16.3Q33.9 -12.4 40.6 -12.4Q47.3 -12.4 50.3 -16.3Q53.2 -20.2 53.2 -29.2L53.2 -72.9L72 -72.9L72 -29.2Q72 -13.7 64.3 -6.1Q56.5 1.4 40.6 1.4Q24.7 1.4 16.9 -6.1Q9.2 -13.7 9.2 -29.2Z",81],"V":["M0.5 -72.9L19.4 -72.9L38.7 -19.1L58 -72.9L76.9 -72.9L49.9 0L27.5 0Z",77],"W":["M3 -72.9L21 -72.9L33.6 -19.9L46.1 -72.9L64.2 -72.9L76.7 -19.9L89.3 -72.9L107.2 -72.9L90 0L68.3 0L55.1 -55.4L42 0L20.3 0Z",110],"X":["M49.8 -37.2L75.1 0L55.5 0L38.5 -24.9L21.6 0L1.9 0L27.2 -37.2L2.9 -72.9L22.5 -72.9L38.5 -49.4L54.4 -72.9L74.1 -72.9Z",77],"Y":["M-1 -72.9L19.6 -72.9L36.2 -46.9L52.8 -72.9L73.4 -72.9L45.6 -30.7L45.6 0L26.8 0L26.8 -30.7Z",72],":":["M11.2 -54.7L28.8 -54.7L28.8 -35.8L11.2 -35.8ZM11.2 -18.9L28.8 -18.9L28.8 0L11.2 0Z",40]};

// ---------------------------------------------------------------------------------------------- helpers
const f = x => { const r = Math.round(x * 100) / 100; return (r === 0 ? 0 : r).toString(); };
const f1 = x => { const r = Math.round(x * 10) / 10; return (r === 0 ? 0 : r).toString(); };
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

// ---------------------------------------------------------------------------------------------- build
export function build(ctx) {
  const { v } = ctx;
  const I = k => v('ink' + k);
  const P = I('P'), K = I('K'), O = I('O'), R = I('R'), B = I('B'), T = I('T'), N = I('N');
  let defs = '';
  const anim = { shore: [], roadside: [] };   // tg => markup; emitted in all three copies (tg = hero copy)

  // ========================================================================= SHORE (depth 0.6)
  const shore = (() => {
    const L = LAY.shore, W = L.W, X0 = L.x0 - 3, X1 = L.x1 + 3, Rn = ctx.rng('land-shore');
    let s = '';
    const put = (o, g) => { s += G(o, g); };
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
    return s;
  })();

  // ========================================================================= ROADSIDE (depth 0.9)
  const roadside = (() => {
    const L = LAY.roadside, W = L.W, X0 = L.x0 - 3, X1 = L.x1 + 3;
    let s = '';
    const put = (o, g) => { s += G(o, g); };
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
    // --- hedges
    const hedge = (x, w, hh, tagged) => {
      const y = BASE; let tx = '';
      for (let r = 0; r < 3; r++) for (let c = 0; c < w / 8 - 1; c++) { const xx = x + 6 + c * 8 + (r % 2 ? 4 : 0), yy = y - hh + 8 + r * (hh - 12) / 3; if (xx < x + w - 6) tx += `M${f(xx - 3.4)} ${f(yy)}a3.4 3 0 0 0 6.8 0z`; }
      return G(tagged ? DD('hedge') : {}, F(`M${x} ${y}V${y - hh + 5}q0 -5 5 -5H${x + w - 5}q5 0 5 5V${y}Z`, v('foliage')) + F(rect(x, y - 6, w, 6), v('trunk')) +
        G(tagged ? DD('hedge-texture') : {}, F(tx, v('trunk'))));
    };
    s += hedge(1214, 100, 32, true) + hedge(452, 96, 26) + hedge(690, 92, 24) + hedge(860, 96, 26);
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
    const put = (o, g) => { s += G(o, g); };
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
    const put = (o, g) => { s += G(o, g); };
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
  const tile = (key, content0, animList) => {
    const content = chunkPaths(mergePaths(content0));
    const W = LAY[key].W;
    const animM = animList ? [-1, 0, 1].map(k => G({ transform: k ? `translate(${f(k * W)} 0)` : undefined }, chunkPaths(animList.map(fn => fn(k === 0)).join(''), 120))).join('') : '';
    return G({ 'data-ref': 'land-' + key },
      G({ id: 'land-tile-' + key }, content),
      h('use', { href: '#land-tile-' + key, x: f(-W) }), h('use', { href: '#land-tile-' + key, x: f(W) }),
      animM);
  };
  // lamp light pools on the road (positioned per frame under the roadside lamps, in screen space)
  const pools = G({ 'data-ref': 'land-roadpools', class: 'land-glow', display: 'none' },
    [0, 1, 2, 3].map(i => G({ 'data-ref': 'land-pool' + i, ...(i === 1 ? DD('road-pool') : {}) }, F(ell(0, 806, 120, 26), 'url(#land-poolG)'))).join(''));
  return {
    defs,
    layers: {
      'L-shore': tile('shore', shore, anim.shore),
      'L-roadside': tile('roadside', roadside, anim.roadside),
      'L-road': tile('road', road) + pools,
      'L-foreground': tile('fg', fg),
    },
  };
}

// ---------------------------------------------------------------------------------------------- attach
export function attach(svg, ctx) {
  const r = refs(svg, 'land-');
  const glows = [...svg.querySelectorAll('.land-glow')];
  const A = {};   // animated hooks: every class 'land-a-<name>' element (one per tile copy)
  for (const el of svg.querySelectorAll('[class^="land-a-"]')) (A[el.getAttribute('class').slice(7)] ||= []).push(el);
  const set = (el, a, val) => { if (el && el.__lv !== val) { el.setAttribute(a, val); el.__lv = val; } };
  const setA = (name, val) => { const l = A[name]; if (l) for (const el of l) set(el, 'transform', val); };
  const since = (fr, type) => { let best = Infinity; for (const e of fr.events || []) if (e.type === type && fr.t >= e.t0) best = Math.min(best, fr.t - e.t0); return best; };
  let glowOn = null;
  return {
    update(fr) {
      const D = fr.distance || 0, t = fr.t || 0, red = fr.reduced || ctx.reduced;
      for (const k of Object.keys(LAY)) set(r[k], 'transform', `translate(${f(-tileU(D, LAY[k]))} 0)`);
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
    bake(kit) {
      // at 60 rpm every near tile advances exactly one tile width per 1 s (shore: 2 s)
      return Object.entries(LAY).map(([k, L]) => ({ selector: `[data-ref="land-${k}"]`, kind: 'transform', type: 'translate', values: [`${f(L.W / 2)} 0`, `${f(-L.W / 2)} 0`], dur: L.W / (L.d * DIST_PER_REV) }))
        .map(d => (kit && kit.normalize ? kit.normalize(d) : d));
    },
  };
}
