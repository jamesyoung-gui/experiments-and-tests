// OWNER: bike. The storybook bicycle of "Pelican Bay", STORYBOOK EDITION (docs/STYLE-B.md, warm gouache 绘本水粉):
// a teal-green lugged city bike with cream fenders, cream lugs and cream cable housings, a brown sprung leather saddle,
// cream gum-wall tyres and a wicker basket full of painted fish. Every part is outlined in the warm brown `line` ink
// (never black), with the hand-drawn look BAKED INTO THE GEOMETRY (STYLE-B §2.2, no filters anywhere in this module):
//   · wobbly outlines: every tube edge, fender edge, basket side and towel edge is displaced by seeded smooth noise;
//   · double "pencil" lines: a second, offset, thinner, lighter stroke on the big static shapes;
//   · dry-brush edges: short tapered strokes along the underside of the tubes and fenders;
//   · gouache texture: static <pattern> tiles of painted blotches (userSpaceOnUse, so they live in each part's own
//     local frame and move with it), laid over the frame, fenders, saddle and towel.
// Far-side parts (far crank / pedal / spokes / far grip) use the -far glazes: the same shapes in cooler, darker paint.
//
// Every slot is drawn in its joint-local frame (CONTRACT.md "Slots"):
//   wheelRear/wheelFront  hub-local, rotate by pose wheel angle        cog        rear-hub-local, rotates 3·crank
//   chainring             BB-local, rotates with the crank (spider+ring body; the 48 teeth live UNDER the chain)
//   crankNear/crankFar    BB-local, arm along +x                        pedal*     spindle-local, top face at y≈0
//   frame / fork / chain  rider space, identity transform               bars       rider space
// Z-order trick (kept from edition C): the SLOTS put 'chain' under 'chainring', which would paint the teeth over the
// chain, so the 48 teeth are drawn inside the (static) chain slot in their own group, rotated by update() about the
// BB: teeth < chain < guard < spider/ring body < near crank < pedal (rig-spec C2.2).
//
// Anti-aliasing (rig-spec §3): spokes / nipples / eyelets / tread / tooth rows are periodic, so they fade with
// pose.spokeBlur (or crank rate); the valve, the spoke reflector, the rim label and the tyre lettering are the
// asymmetric markers that always show true rotation; soft painted motion swooshes (static, so they can never
// wagon-wheel) fade in at speed. The tyre's warm specular highlight lives in the static frame slot, so the light stays
// put while the tyre turns under it.
// Hit-testing honesty: large curved shapes are filled bands split into arc pieces, and every outline stroke lives
// inside the group of the part it outlines, so the detail inventory's elementFromPoint sampling sees what the eye sees.
import { fmt2 } from '../core/math.js';
import { BIKE, CHAIN_D } from '../contract.js';
import { h, refs } from '../core/svg.js';

export const id = 'bike';
// STYLE-B §1 gouache paints as graded materials (time-of-day grading and the -far glazes apply like core materials).
export const materials = {
  bkLine: '#4A2C20', bkLineSoft: '#6B4632',
  bkFrame: '#1F8A8A', bkFrameHi: '#5CC0B2', bkFrameLo: '#146466',
  bkCream: '#F6EAD0', bkCreamLo: '#D8C3A0', bkPaper: '#FFF6EC',
  bkSaddle: '#7A4A2A', bkSaddleHi: '#A86C40',
  bkWicker: '#C89B5E', bkWickerLo: '#9A6E3C', bkWickerHi: '#E4BE80',
  bkTyre: '#3B2C2A', bkTyreHi: '#6A5450',
  bkSteel: '#D9D2C8', bkSteelLo: '#9C918C',
  bkRed: '#D8443A', bkRedLo: '#A82E2E', bkBrass: '#D9A441', bkBrassHi: '#F6D58A', bkAmber: '#F08A3C',
  bkTowel: '#4F86C0', bkFishBlue: '#4F7FA8', bkFishDeep: '#2F4F78', bkFishBelly: '#F4F1E6',
  bkCoral: '#E8735A', bkCoralHi: '#F7B49A', bkSilver: '#C4D2DA', bkKelp: '#5E8A4A', bkKelpLo: '#3F6436', bkNews: '#E9DFCB',
};

// Glyph outlines (em = 10 units, baseline y = 0): DejaVu Serif Bold (Latin, STYLE-B §4) and WenQuanYi Zen Hei (CJK),
// extracted with tools/ttf.mjs. Both licences allow embedding outlines (credited in the README).
const GLYPHS = {
  'P': [7.52, 'M0.47 0L0.47 -0.59L1.4 -0.59L1.4 -6.7L0.47 -6.7L0.47 -7.29L4.62 -7.29Q5.83 -7.29 6.55 -6.71Q7.27 -6.13 7.27 -5.16Q7.27 -4.18 6.55 -3.6Q5.83 -3.02 4.62 -3.02L3.28 -3.02L3.28 -0.59L4.46 -0.59L4.46 0ZM3.28 -3.61L3.83 -3.61Q4.46 -3.61 4.84 -4.03Q5.22 -4.45 5.22 -5.16Q5.22 -5.86 4.84 -6.28Q4.47 -6.7 3.83 -6.7L3.28 -6.7Z'],
  'E': [7.62, 'M0.47 0L0.47 -0.59L1.4 -0.59L1.4 -6.7L0.47 -6.7L0.47 -7.29L7.02 -7.29L7.02 -5.57L6.35 -5.57L6.35 -6.62L3.28 -6.62L3.28 -4.28L5.19 -4.28L5.19 -5.21L5.86 -5.21L5.86 -2.69L5.19 -2.69L5.19 -3.62L3.28 -3.62L3.28 -0.67L6.44 -0.67L6.44 -1.72L7.11 -1.72L7.11 0Z'],
  'L': [7.03, 'M0.47 0L0.47 -0.59L1.4 -0.59L1.4 -6.7L0.47 -6.7L0.47 -7.29L4.22 -7.29L4.22 -6.7L3.28 -6.7L3.28 -0.67L6.15 -0.67L6.15 -1.82L6.81 -1.82L6.81 0Z'],
  'I': [4.68, 'M0.47 0L0.47 -0.59L1.4 -0.59L1.4 -6.7L0.47 -6.7L0.47 -7.29L4.22 -7.29L4.22 -6.7L3.28 -6.7L3.28 -0.59L4.22 -0.59L4.22 0Z'],
  'C': [7.96, 'M7.45 -2.08Q7.16 -0.95 6.42 -0.41Q5.67 0.14 4.41 0.14Q2.56 0.14 1.49 -0.88Q0.42 -1.89 0.42 -3.64Q0.42 -5.39 1.49 -6.4Q2.56 -7.42 4.41 -7.42Q5.06 -7.42 5.76 -7.27Q6.46 -7.11 7.25 -6.79L7.25 -5L6.63 -5Q6.44 -5.92 5.94 -6.37Q5.43 -6.83 4.61 -6.83Q3.54 -6.83 3.03 -6.05Q2.51 -5.26 2.51 -3.64Q2.51 -2.01 3.03 -1.23Q3.54 -0.45 4.62 -0.45Q5.35 -0.45 5.81 -0.85Q6.27 -1.26 6.48 -2.08Z'],
  'A': [7.76, 'M-0.08 0L-0.08 -0.59L0.52 -0.59L3.26 -7.29L4.43 -7.29L7.18 -0.59L7.87 -0.59L7.87 0L4.46 0L4.46 -0.59L5.17 -0.59L4.57 -2.08L1.83 -2.08L1.22 -0.59L2.09 -0.59L2.09 0ZM2.07 -2.67L4.33 -2.67L3.21 -5.46Z'],
  'N': [9.14, 'M0.44 0L0.44 -0.59L1.37 -0.59L1.37 -6.7L0.44 -6.7L0.44 -7.29L2.72 -7.29L7.12 -2.13L7.12 -6.7L6.19 -6.7L6.19 -7.29L8.74 -7.29L8.74 -6.7L7.81 -6.7L7.81 0L6.53 0L2.06 -5.27L2.06 -0.59L2.99 -0.59L2.99 0Z'],
  'B': [8.45, 'M0.47 0L0.47 -0.59L1.4 -0.59L1.4 -6.7L0.47 -6.7L0.47 -7.29L4.79 -7.29Q6.12 -7.29 6.79 -6.84Q7.46 -6.39 7.46 -5.49Q7.46 -4.84 7 -4.46Q6.54 -4.08 5.63 -3.98Q6.73 -3.88 7.31 -3.39Q7.9 -2.91 7.9 -2.11Q7.9 -1.03 7.08 -0.51Q6.26 0 4.52 0ZM3.28 -4.25L3.92 -4.25Q4.76 -4.25 5.17 -4.55Q5.57 -4.86 5.57 -5.49Q5.57 -6.12 5.18 -6.41Q4.79 -6.7 3.92 -6.7L3.28 -6.7ZM3.28 -0.59L3.98 -0.59Q4.91 -0.59 5.36 -0.96Q5.81 -1.33 5.81 -2.11Q5.81 -2.89 5.36 -3.28Q4.9 -3.66 3.98 -3.66L3.28 -3.66Z'],
  'Y': [7.14, 'M1.72 0L1.72 -0.59L2.7 -0.59L2.7 -3.02L0.53 -6.7L-0.09 -6.7L-0.09 -7.29L3.41 -7.29L3.41 -6.7L2.6 -6.7L4.24 -3.92L5.87 -6.7L5.14 -6.7L5.14 -7.29L7.23 -7.29L7.23 -6.7L6.61 -6.7L4.59 -3.27L4.59 -0.59L5.57 -0.59L5.57 0Z'],
  'S': [7.22, 'M0.77 -0.35L0.77 -2.08L1.39 -2.08Q1.53 -1.26 2.06 -0.85Q2.59 -0.45 3.52 -0.45Q4.28 -0.45 4.67 -0.74Q5.07 -1.03 5.07 -1.58Q5.07 -2.02 4.8 -2.27Q4.53 -2.51 3.69 -2.72L2.6 -2.99Q1.53 -3.26 1.09 -3.75Q0.66 -4.23 0.66 -5.13Q0.66 -6.22 1.38 -6.82Q2.1 -7.42 3.4 -7.42Q4.04 -7.42 4.73 -7.31Q5.42 -7.21 6.16 -6.99L6.16 -5.38L5.54 -5.38Q5.4 -6.13 4.92 -6.48Q4.44 -6.83 3.56 -6.83Q2.84 -6.83 2.47 -6.58Q2.1 -6.33 2.1 -5.83Q2.1 -5.38 2.35 -5.14Q2.61 -4.9 3.6 -4.65L4.69 -4.38Q5.71 -4.13 6.16 -3.59Q6.62 -3.05 6.62 -2.11Q6.62 -1.01 5.86 -0.43Q5.1 0.14 3.62 0.14Q2.91 0.14 2.2 0.02Q1.5 -0.1 0.77 -0.35Z'],
  'T': [7.44, 'M1.81 0L1.81 -0.59L2.78 -0.59L2.78 -6.62L0.78 -6.62L0.78 -5.47L0.11 -5.47L0.11 -7.29L7.34 -7.29L7.34 -5.47L6.68 -5.47L6.68 -6.62L4.67 -6.62L4.67 -0.59L5.64 -0.59L5.64 0Z'],
  'R': [8.31, 'M5.31 -3.56Q5.74 -3.5 6.04 -3.27Q6.34 -3.05 6.56 -2.62L7.62 -0.59L8.37 -0.59L8.37 0L5.97 0L4.81 -2.2Q4.47 -2.89 4.24 -3.07Q4 -3.26 3.58 -3.26L3.28 -3.26L3.28 -0.59L4.22 -0.59L4.22 0L0.47 0L0.47 -0.59L1.4 -0.59L1.4 -6.7L0.47 -6.7L0.47 -7.29L4.63 -7.29Q5.9 -7.29 6.59 -6.78Q7.28 -6.27 7.28 -5.33Q7.28 -4.57 6.79 -4.13Q6.3 -3.69 5.31 -3.56ZM3.28 -3.85L3.92 -3.85Q4.6 -3.85 4.97 -4.22Q5.34 -4.59 5.34 -5.28Q5.34 -5.97 4.97 -6.33Q4.6 -6.7 3.92 -6.7L3.28 -6.7Z'],
  '0': [6.96, 'M3.48 -0.43Q4.07 -0.43 4.28 -0.96Q4.5 -1.49 4.5 -3.64Q4.5 -5.77 4.28 -6.31Q4.07 -6.85 3.48 -6.85Q2.9 -6.85 2.68 -6.32Q2.46 -5.79 2.46 -3.64Q2.46 -1.49 2.68 -0.96Q2.9 -0.43 3.48 -0.43ZM3.48 0.14Q2.02 0.14 1.25 -0.83Q0.47 -1.81 0.47 -3.64Q0.47 -5.47 1.25 -6.45Q2.02 -7.42 3.48 -7.42Q4.94 -7.42 5.71 -6.45Q6.49 -5.47 6.49 -3.64Q6.49 -1.81 5.71 -0.83Q4.94 0.14 3.48 0.14Z'],
  '1': [6.96, 'M1.37 0L1.37 -0.59L2.74 -0.59L2.74 -6.49L1.22 -5.59L1.22 -6.32L3.05 -7.42L4.59 -7.42L4.59 -0.59L5.96 -0.59L5.96 0Z'],
  '2': [6.96, 'M1.32 -5.49L0.73 -5.49L0.73 -7.06Q1.33 -7.24 1.91 -7.33Q2.5 -7.42 3.09 -7.42Q4.48 -7.42 5.26 -6.85Q6.04 -6.28 6.04 -5.27Q6.04 -4.55 5.61 -3.97Q5.18 -3.4 3.97 -2.61L1.94 -1.28L5.39 -1.28L5.39 -2.14L6.06 -2.14L6.06 0L0.67 0L0.67 -1.19L1.75 -1.94Q3.13 -2.89 3.59 -3.56Q4.05 -4.23 4.05 -5.12Q4.05 -5.97 3.7 -6.41Q3.35 -6.85 2.68 -6.85Q2.1 -6.85 1.76 -6.5Q1.41 -6.15 1.32 -5.49Z'],
  '3': [6.96, 'M0.86 -7.08Q1.5 -7.25 2.11 -7.34Q2.71 -7.42 3.29 -7.42Q4.61 -7.42 5.31 -6.95Q6.02 -6.48 6.02 -5.6Q6.02 -4.94 5.62 -4.53Q5.21 -4.12 4.43 -3.98Q5.38 -3.83 5.85 -3.33Q6.32 -2.83 6.32 -1.97Q6.32 -0.95 5.51 -0.4Q4.7 0.14 3.17 0.14Q2.59 0.14 1.98 0.04Q1.37 -0.05 0.7 -0.25L0.7 -1.85L1.29 -1.85Q1.34 -1.16 1.72 -0.79Q2.1 -0.43 2.78 -0.43Q3.52 -0.43 3.93 -0.84Q4.33 -1.25 4.33 -2.01Q4.33 -2.8 3.91 -3.23Q3.49 -3.66 2.71 -3.66L2.39 -3.66L2.39 -4.25L2.64 -4.25Q3.36 -4.25 3.72 -4.58Q4.08 -4.91 4.08 -5.57Q4.08 -6.19 3.74 -6.52Q3.4 -6.85 2.77 -6.85Q2.19 -6.85 1.86 -6.54Q1.52 -6.22 1.45 -5.62L0.86 -5.62Z'],
  '7': [6.96, 'M6.13 -6.05L3.12 0L2.13 0L5.06 -5.91L1.46 -5.91L1.46 -4.92L0.79 -4.92L0.79 -7.29L6.13 -7.29Z'],
  '8': [6.96, 'M4.65 -3.88Q5.52 -3.74 5.97 -3.24Q6.42 -2.74 6.42 -1.94Q6.42 -0.93 5.66 -0.4Q4.9 0.14 3.47 0.14Q2.04 0.14 1.28 -0.4Q0.52 -0.93 0.52 -1.94Q0.52 -2.74 0.97 -3.24Q1.43 -3.74 2.29 -3.88Q1.52 -4.06 1.14 -4.47Q0.76 -4.88 0.76 -5.52Q0.76 -6.45 1.46 -6.93Q2.15 -7.42 3.47 -7.42Q4.79 -7.42 5.49 -6.93Q6.18 -6.45 6.18 -5.52Q6.18 -4.88 5.8 -4.47Q5.42 -4.06 4.65 -3.88ZM4.29 -5.5Q4.29 -6.27 4.11 -6.56Q3.92 -6.85 3.47 -6.85Q3.02 -6.85 2.83 -6.56Q2.65 -6.27 2.65 -5.5Q2.65 -4.73 2.83 -4.45Q3.02 -4.16 3.47 -4.16Q3.93 -4.16 4.11 -4.45Q4.29 -4.73 4.29 -5.5ZM4.48 -2.02Q4.48 -2.92 4.26 -3.25Q4.03 -3.59 3.47 -3.59Q2.91 -3.59 2.69 -3.25Q2.46 -2.92 2.46 -2.02Q2.46 -1.12 2.69 -0.77Q2.92 -0.43 3.47 -0.43Q4.02 -0.43 4.25 -0.77Q4.48 -1.12 4.48 -2.02Z'],
  '9': [6.96, 'M3.41 -6.85Q2.91 -6.85 2.69 -6.42Q2.48 -6 2.48 -4.94Q2.48 -3.89 2.69 -3.46Q2.91 -3.03 3.41 -3.03Q3.91 -3.03 4.13 -3.46Q4.34 -3.89 4.34 -4.94Q4.34 -6 4.13 -6.42Q3.91 -6.85 3.41 -6.85ZM4.5 -2.97Q4.17 -2.71 3.78 -2.58Q3.39 -2.45 2.93 -2.45Q1.82 -2.45 1.18 -3.1Q0.54 -3.75 0.54 -4.9Q0.54 -6.11 1.25 -6.77Q1.97 -7.42 3.29 -7.42Q4.79 -7.42 5.56 -6.52Q6.33 -5.62 6.33 -3.87Q6.33 -1.88 5.47 -0.87Q4.62 0.14 2.94 0.14Q2.5 0.14 2 0.07Q1.49 0 0.92 -0.15L0.92 -1.44L1.51 -1.44Q1.63 -0.94 1.97 -0.69Q2.31 -0.43 2.85 -0.43Q3.71 -0.43 4.1 -1.03Q4.49 -1.63 4.5 -2.97Z'],
  '×': [8.38, 'M7.09 -5.28L4.94 -3.13L7.09 -0.98L6.34 -0.23L4.19 -2.38L2.04 -0.23L1.29 -0.98L3.44 -3.13L1.29 -5.28L2.04 -6.04L4.19 -3.89L6.34 -6.04Z'],
  '·': [3.48, 'M0.81 -3.47Q0.81 -3.85 1.08 -4.13Q1.36 -4.4 1.74 -4.4Q2.12 -4.4 2.4 -4.13Q2.67 -3.85 2.67 -3.47Q2.67 -3.09 2.4 -2.82Q2.12 -2.55 1.74 -2.55Q1.36 -2.55 1.08 -2.82Q0.81 -3.09 0.81 -3.47Z'],
  '-': [4.15, 'M0.54 -3.34L3.61 -3.34L3.61 -2.02L0.54 -2.02Z'],
  'a': [6.48, 'M5.51 -3.19L5.51 -0.59L6.25 -0.59L6.25 0L3.78 0L3.78 -0.66Q3.44 -0.25 3.02 -0.05Q2.6 0.14 2.06 0.14Q1.26 0.14 0.84 -0.29Q0.41 -0.71 0.41 -1.51Q0.41 -2.38 1.02 -2.82Q1.64 -3.25 2.87 -3.25L3.78 -3.25L3.78 -3.56Q3.78 -4.19 3.48 -4.49Q3.18 -4.79 2.56 -4.79Q2.04 -4.79 1.76 -4.58Q1.48 -4.37 1.36 -3.88L0.81 -3.88L0.81 -5Q1.27 -5.17 1.77 -5.25Q2.27 -5.33 2.82 -5.33Q4.21 -5.33 4.86 -4.81Q5.51 -4.3 5.51 -3.19ZM3.78 -1.63L3.78 -2.67L3.13 -2.67Q2.65 -2.67 2.39 -2.41Q2.13 -2.14 2.13 -1.65Q2.13 -1.16 2.32 -0.91Q2.5 -0.67 2.89 -0.67Q3.29 -0.67 3.54 -0.93Q3.78 -1.2 3.78 -1.63Z'],
  'b': [6.99, 'M0.97 -0.59L0.97 -7.01L0.23 -7.01L0.23 -7.6L2.7 -7.6L2.7 -4.53Q2.92 -4.94 3.29 -5.13Q3.66 -5.33 4.21 -5.33Q5.32 -5.33 5.95 -4.6Q6.59 -3.87 6.59 -2.6Q6.59 -1.32 5.95 -0.59Q5.32 0.14 4.21 0.14Q3.66 0.14 3.29 -0.06Q2.92 -0.25 2.7 -0.66L2.7 0L0.23 0L0.23 -0.59ZM2.7 -2.34Q2.7 -1.43 2.93 -1.03Q3.16 -0.62 3.68 -0.62Q4.21 -0.62 4.43 -1.05Q4.65 -1.48 4.65 -2.6Q4.65 -3.72 4.43 -4.14Q4.21 -4.57 3.68 -4.57Q3.16 -4.57 2.93 -4.17Q2.7 -3.76 2.7 -2.85Z'],
  'c': [6.09, 'M5.64 -1.62Q5.45 -0.73 4.88 -0.3Q4.31 0.14 3.32 0.14Q1.93 0.14 1.17 -0.58Q0.41 -1.29 0.41 -2.6Q0.41 -3.89 1.16 -4.61Q1.91 -5.33 3.25 -5.33Q3.79 -5.33 4.35 -5.23Q4.9 -5.13 5.47 -4.92L5.47 -3.48L4.92 -3.48Q4.84 -4.14 4.54 -4.46Q4.23 -4.78 3.67 -4.78Q2.95 -4.78 2.64 -4.29Q2.34 -3.8 2.34 -2.6Q2.34 -1.42 2.64 -0.92Q2.93 -0.41 3.61 -0.41Q4.13 -0.41 4.45 -0.72Q4.76 -1.04 4.83 -1.62Z'],
  'd': [6.99, 'M4.29 -2.34L4.29 -2.85Q4.29 -3.76 4.06 -4.17Q3.82 -4.57 3.31 -4.57Q2.77 -4.57 2.56 -4.14Q2.34 -3.72 2.34 -2.6Q2.34 -1.48 2.56 -1.05Q2.78 -0.62 3.31 -0.62Q3.82 -0.62 4.06 -1.03Q4.29 -1.43 4.29 -2.34ZM6.02 -0.59L6.76 -0.59L6.76 0L4.29 0L4.29 -0.66Q4.07 -0.25 3.7 -0.06Q3.33 0.14 2.78 0.14Q1.67 0.14 1.04 -0.59Q0.41 -1.32 0.41 -2.6Q0.41 -3.88 1.04 -4.6Q1.67 -5.33 2.78 -5.33Q3.33 -5.33 3.7 -5.13Q4.07 -4.94 4.29 -4.53L4.29 -7.01L3.55 -7.01L3.55 -7.6L6.02 -7.6Z'],
  'e': [6.36, 'M4.01 -2.93Q4.01 -3.96 3.82 -4.37Q3.63 -4.78 3.17 -4.78Q2.72 -4.78 2.53 -4.37Q2.34 -3.97 2.34 -3.02L2.34 -2.93ZM5.91 -2.35L2.34 -2.35L2.34 -2.31Q2.34 -1.3 2.64 -0.86Q2.94 -0.41 3.62 -0.41Q4.18 -0.41 4.53 -0.71Q4.87 -1.01 4.97 -1.57L5.78 -1.57Q5.57 -0.69 4.95 -0.27Q4.32 0.14 3.2 0.14Q1.85 0.14 1.13 -0.57Q0.41 -1.28 0.41 -2.6Q0.41 -3.89 1.15 -4.61Q1.88 -5.33 3.2 -5.33Q4.49 -5.33 5.18 -4.57Q5.86 -3.81 5.91 -2.35Z'],
  'g': [6.99, 'M6.02 -4.6L6.02 -0.07Q6.02 1.03 5.24 1.62Q4.46 2.22 3.04 2.22Q2.52 2.22 1.99 2.14Q1.46 2.06 0.9 1.9L0.9 0.66L1.45 0.66Q1.52 1.17 1.86 1.42Q2.2 1.67 2.83 1.67Q3.63 1.67 3.96 1.29Q4.29 0.9 4.29 -0.07L4.29 -0.66Q4.07 -0.25 3.7 -0.06Q3.33 0.14 2.78 0.14Q1.67 0.14 1.04 -0.59Q0.41 -1.32 0.41 -2.6Q0.41 -3.88 1.04 -4.6Q1.67 -5.33 2.78 -5.33Q3.33 -5.33 3.7 -5.13Q4.07 -4.94 4.29 -4.53L4.29 -5.19L6.76 -5.19L6.76 -4.6ZM4.29 -2.85Q4.29 -3.76 4.06 -4.17Q3.82 -4.57 3.31 -4.57Q2.77 -4.57 2.56 -4.14Q2.34 -3.72 2.34 -2.6Q2.34 -1.48 2.56 -1.05Q2.78 -0.62 3.31 -0.62Q3.82 -0.62 4.06 -1.03Q4.29 -1.43 4.29 -2.34Z'],
  'h': [7.27, 'M0.34 0L0.34 -0.59L1.08 -0.59L1.08 -7.01L0.31 -7.01L0.31 -7.6L2.81 -7.6L2.81 -4.46Q3.12 -4.92 3.52 -5.13Q3.92 -5.33 4.53 -5.33Q5.41 -5.33 5.85 -4.82Q6.3 -4.3 6.3 -3.3L6.3 -0.59L7.04 -0.59L7.04 0L3.94 0L3.94 -0.59L4.57 -0.59L4.57 -3.35Q4.57 -4.01 4.4 -4.27Q4.23 -4.52 3.82 -4.52Q3.3 -4.52 3.05 -4.14Q2.81 -3.75 2.81 -2.92L2.81 -0.59L3.44 -0.59L3.44 0Z'],
  'i': [3.8, 'M0.92 -6.66Q0.92 -7.06 1.19 -7.33Q1.46 -7.6 1.86 -7.6Q2.25 -7.6 2.52 -7.33Q2.79 -7.06 2.79 -6.66Q2.79 -6.27 2.52 -6Q2.25 -5.73 1.86 -5.73Q1.46 -5.73 1.19 -6Q0.92 -6.27 0.92 -6.66ZM2.81 -0.59L3.55 -0.59L3.55 0L0.34 0L0.34 -0.59L1.08 -0.59L1.08 -4.6L0.34 -4.6L0.34 -5.19L2.81 -5.19Z'],
  'k': [6.93, 'M3.46 0L0.34 0L0.34 -0.59L1.08 -0.59L1.08 -7.01L0.34 -7.01L0.34 -7.6L2.81 -7.6L2.81 -2.72L4.9 -4.6L4.28 -4.6L4.28 -5.19L6.65 -5.19L6.65 -4.6L5.69 -4.6L4.35 -3.4L6.54 -0.59L7.1 -0.59L7.1 0L4.12 0L4.12 -0.59L4.73 -0.59L3.29 -2.44L2.81 -2.01L2.81 -0.59L3.46 -0.59Z'],
  'l': [3.8, 'M2.81 -0.59L3.55 -0.59L3.55 0L0.34 0L0.34 -0.59L1.08 -0.59L1.08 -7.01L0.34 -7.01L0.34 -7.6L2.81 -7.6Z'],
  'm': [10.58, 'M6.07 -4.34Q6.43 -4.86 6.85 -5.1Q7.27 -5.33 7.83 -5.33Q8.73 -5.33 9.17 -4.83Q9.61 -4.32 9.61 -3.3L9.61 -0.59L10.35 -0.59L10.35 0L7.26 0L7.26 -0.59L7.88 -0.59L7.88 -3.04Q7.88 -4.01 7.73 -4.27Q7.58 -4.52 7.18 -4.52Q6.72 -4.52 6.46 -4.17Q6.21 -3.81 6.21 -3.16L6.21 -0.59L6.83 -0.59L6.83 0L3.86 0L3.86 -0.59L4.48 -0.59L4.48 -3.04Q4.48 -4.01 4.33 -4.27Q4.18 -4.52 3.78 -4.52Q3.32 -4.52 3.06 -4.17Q2.81 -3.81 2.81 -3.16L2.81 -0.59L3.43 -0.59L3.43 0L0.34 0L0.34 -0.59L1.08 -0.59L1.08 -4.6L0.34 -4.6L0.34 -5.19L2.81 -5.19L2.81 -4.46Q3.11 -4.91 3.5 -5.12Q3.89 -5.33 4.43 -5.33Q5.06 -5.33 5.46 -5.09Q5.85 -4.85 6.07 -4.34Z'],
  'n': [7.27, 'M0.34 0L0.34 -0.59L1.08 -0.59L1.08 -4.6L0.34 -4.6L0.34 -5.19L2.81 -5.19L2.81 -4.46Q3.12 -4.92 3.52 -5.13Q3.92 -5.33 4.53 -5.33Q5.41 -5.33 5.85 -4.82Q6.3 -4.3 6.3 -3.3L6.3 -0.59L7.04 -0.59L7.04 0L3.94 0L3.94 -0.59L4.57 -0.59L4.57 -3.35Q4.57 -4.01 4.4 -4.27Q4.23 -4.52 3.82 -4.52Q3.3 -4.52 3.05 -4.14Q2.81 -3.75 2.81 -2.92L2.81 -0.59L3.44 -0.59L3.44 0Z'],
  'o': [6.67, 'M3.34 -0.41Q3.89 -0.41 4.11 -0.88Q4.33 -1.35 4.33 -2.6Q4.33 -3.85 4.11 -4.31Q3.89 -4.78 3.34 -4.78Q2.79 -4.78 2.56 -4.31Q2.34 -3.84 2.34 -2.6Q2.34 -1.36 2.56 -0.88Q2.79 -0.41 3.34 -0.41ZM3.34 0.14Q1.97 0.14 1.19 -0.59Q0.41 -1.32 0.41 -2.6Q0.41 -3.88 1.19 -4.61Q1.97 -5.33 3.34 -5.33Q4.72 -5.33 5.49 -4.61Q6.27 -3.88 6.27 -2.6Q6.27 -1.32 5.49 -0.59Q4.71 0.14 3.34 0.14Z'],
  'p': [6.99, 'M2.7 -2.85L2.7 -2.34Q2.7 -1.43 2.93 -1.03Q3.16 -0.62 3.68 -0.62Q4.21 -0.62 4.43 -1.05Q4.65 -1.48 4.65 -2.6Q4.65 -3.72 4.43 -4.14Q4.21 -4.57 3.68 -4.57Q3.16 -4.57 2.93 -4.17Q2.7 -3.76 2.7 -2.85ZM0.97 -4.6L0.23 -4.6L0.23 -5.19L2.7 -5.19L2.7 -4.53Q2.92 -4.94 3.29 -5.13Q3.66 -5.33 4.21 -5.33Q5.32 -5.33 5.95 -4.6Q6.59 -3.87 6.59 -2.6Q6.59 -1.32 5.95 -0.59Q5.32 0.14 4.21 0.14Q3.66 0.14 3.29 -0.06Q2.92 -0.25 2.7 -0.66L2.7 1.49L3.5 1.49L3.5 2.08L0.23 2.08L0.23 1.49L0.97 1.49Z'],
  'r': [5.27, 'M5.37 -5.25L5.37 -3.7L4.82 -3.7Q4.79 -4.12 4.59 -4.32Q4.4 -4.52 4.03 -4.52Q3.46 -4.52 3.13 -4.02Q2.81 -3.53 2.81 -2.64L2.81 -0.59L3.75 -0.59L3.75 0L0.34 0L0.34 -0.59L1.08 -0.59L1.08 -4.6L0.29 -4.6L0.29 -5.19L2.81 -5.19L2.81 -4.27Q3.06 -4.81 3.48 -5.07Q3.9 -5.33 4.5 -5.33Q4.65 -5.33 4.87 -5.31Q5.09 -5.29 5.37 -5.25Z'],
  's': [5.63, 'M0.47 -0.15L0.47 -1.6L1.02 -1.6Q1.09 -1.02 1.46 -0.72Q1.82 -0.41 2.45 -0.41Q2.98 -0.41 3.26 -0.59Q3.54 -0.78 3.54 -1.12Q3.54 -1.43 3.36 -1.6Q3.18 -1.77 2.67 -1.9L1.96 -2.08Q1.15 -2.28 0.79 -2.65Q0.43 -3.03 0.43 -3.66Q0.43 -4.51 1.02 -4.92Q1.6 -5.33 2.82 -5.33Q3.28 -5.33 3.8 -5.26Q4.32 -5.18 4.95 -5.02L4.95 -3.71L4.4 -3.71Q4.36 -4.24 4.02 -4.51Q3.69 -4.78 3.06 -4.78Q2.53 -4.78 2.26 -4.61Q1.99 -4.44 1.99 -4.12Q1.99 -3.86 2.15 -3.71Q2.3 -3.55 2.71 -3.45L3.42 -3.27Q4.44 -3.01 4.83 -2.63Q5.22 -2.25 5.22 -1.57Q5.22 -0.69 4.59 -0.28Q3.96 0.14 2.64 0.14Q2.16 0.14 1.62 0.07Q1.07 0 0.47 -0.15Z'],
  't': [4.62, 'M0.99 -4.6L0.24 -4.6L0.24 -5.19L0.99 -5.19L0.99 -6.8L2.72 -6.8L2.72 -5.19L4.16 -5.19L4.16 -4.6L2.72 -4.6L2.72 -1.42Q2.72 -0.74 2.83 -0.58Q2.93 -0.41 3.22 -0.41Q3.53 -0.41 3.68 -0.62Q3.83 -0.83 3.84 -1.27L4.57 -1.27Q4.53 -0.49 4.14 -0.17Q3.76 0.14 2.82 0.14Q1.75 0.14 1.37 -0.19Q0.99 -0.53 0.99 -1.42Z'],
  'u': [7.27, 'M6.19 -5.19L6.19 -0.59L6.93 -0.59L6.93 0L4.46 0L4.46 -0.73Q4.15 -0.27 3.75 -0.06Q3.35 0.14 2.74 0.14Q1.87 0.14 1.42 -0.37Q0.97 -0.89 0.97 -1.89L0.97 -4.6L0.23 -4.6L0.23 -5.19L2.7 -5.19L2.7 -2.16Q2.7 -1.19 2.86 -0.93Q3.02 -0.67 3.45 -0.67Q3.97 -0.67 4.22 -1.05Q4.46 -1.44 4.46 -2.28L4.46 -4.6L3.83 -4.6L3.83 -5.19Z'],
  'w': [8.61, 'M5.39 -5.19L6.57 -1.73L7.55 -4.6L6.87 -4.6L6.87 -5.19L8.81 -5.19L8.81 -4.6L8.2 -4.6L6.63 0L5.44 0L4.34 -3.25L3.23 0L2.05 0L0.48 -4.6L-0.09 -4.6L-0.09 -5.19L2.85 -5.19L2.85 -4.6L2.24 -4.6L3.2 -1.79L4.36 -5.19Z'],
  'y': [5.81, 'M3.12 1.17Q2.89 1.74 2.55 1.98Q2.22 2.22 1.66 2.22Q1.42 2.22 1.13 2.17Q0.83 2.11 0.49 2.01L0.49 0.93L1.04 0.93Q1.05 1.31 1.22 1.49Q1.38 1.67 1.71 1.67Q2.03 1.67 2.22 1.5Q2.42 1.32 2.61 0.84L2.69 0.66L0.43 -4.6L-0.13 -4.6L-0.13 -5.19L2.86 -5.19L2.86 -4.6L2.24 -4.6L3.56 -1.53L4.79 -4.6L4.1 -4.6L4.1 -5.19L6.05 -5.19L6.05 -4.6L5.42 -4.6Z'],
  '鹈': [10, 'M3.16 1.2Q2.8 1.16 2.45 1.2Q2.48 0.54 2.48 -0.13L2.48 -1.73Q1.86 -0.6 0.62 0.55Q0.42 0.26 0.1 0.14Q0.65 -0.35 1.13 -0.97Q1.6 -1.58 2.16 -2.65L0.9 -2.65L0.89 -4.73L2.48 -4.73L2.48 -5.77L1.77 -5.77Q1.31 -5.77 0.86 -5.74Q0.88 -6 0.86 -6.24Q1.31 -6.22 1.77 -6.22L2.77 -6.22Q3.27 -7.01 3.64 -8.04Q3.97 -7.88 4.33 -7.8Q4.09 -7.09 3.54 -6.22L4.76 -6.22L4.76 -4.27L3.13 -4.27L3.13 -3.11L4.84 -3.11L4.84 -1.33Q4.84 -0.98 4.45 -0.73Q4.05 -0.49 3.57 -0.5Q3.65 -0.96 3.38 -1.35Q3.54 -1.3 3.74 -1.26Q4.08 -1.25 4.14 -1.27Q4.19 -1.29 4.19 -1.42L4.19 -2.65L3.13 -2.65L3.13 -0.13Q3.13 0.54 3.16 1.2ZM2.58 -6.64L1.96 -6.27L1.04 -7.81L1.65 -8.18ZM2.48 -3.11L2.48 -4.27L1.54 -4.27Q1.54 -3.71 1.55 -3.11ZM3.13 -4.73L4.1 -4.73L4.1 -5.77L3.25 -5.77L3.22 -5.73Q3.2 -5.77 3.13 -5.77ZM8.55 -1.27Q8.54 -1.01 8.55 -0.74Q8.14 -0.76 7.73 -0.76L6.4 -0.76Q5.99 -0.76 5.59 -0.74Q5.61 -1.01 5.59 -1.27Q5.99 -1.24 6.4 -1.24L7.73 -1.24Q8.14 -1.24 8.55 -1.27ZM7.99 -5.1L7.5 -4.65L6.85 -5.66L7.33 -6.11ZM7.82 -3.32Q7.88 -3.83 7.66 -4.14Q7.87 -4.1 8.18 -4.1Q8.5 -4.09 8.54 -4.14Q8.57 -4.19 8.57 -4.34L8.57 -6.33L7.23 -6.33L7.12 -6.2Q7.08 -6.27 7.04 -6.33Q6.88 -6.33 6.62 -6.33L6.62 -2.93L9.64 -2.93L9.64 0.44Q9.64 0.79 9.39 1.05Q9.02 1.39 8.19 1.38Q8.26 0.86 8.01 0.56Q8.26 0.6 8.62 0.6Q8.97 0.61 9.03 0.55Q9.08 0.49 9.08 0.27L9.08 -2.45L6.05 -2.45L6.05 -6.81Q6.46 -6.81 6.85 -6.81Q7.17 -7.21 7.33 -7.81Q7.61 -7.66 7.92 -7.58Q7.8 -7.12 7.59 -6.81L9.13 -6.81L9.13 -4.22Q9.13 -3.92 8.9 -3.65Q8.55 -3.33 7.82 -3.32Z'],
  '鹕': [10, 'M4.91 -2.61L3.95 -2.61Q4 -1.14 3.52 -0.21Q3.04 0.72 2.25 1.2Q2.07 0.85 1.69 0.72Q3.27 0.03 3.3 -2.24L3.29 -7.44L5.56 -7.44L5.56 0.12Q5.57 0.76 5.2 1Q4.77 1.26 4.07 1.24Q4.16 0.81 3.89 0.46Q4.12 0.5 4.43 0.5Q4.75 0.51 4.82 0.42Q4.91 0.28 4.91 -0.26ZM1.15 -0.21L0.51 -0.21L0.51 -3.8Q0.92 -3.8 1.31 -3.8L1.31 -5.36L0.17 -5.34Q0.2 -5.58 0.17 -5.81L1.31 -5.79L1.31 -6.94Q1.31 -7.6 1.28 -8.24Q1.63 -8.21 1.98 -8.24Q1.94 -7.6 1.94 -6.94L1.94 -5.79L3.22 -5.81Q3.2 -5.58 3.22 -5.34L1.94 -5.36L1.94 -3.8L2.76 -3.8L2.76 -0.21L2.13 -0.21L2.13 -1.03L1.15 -1.03ZM4.91 -5.24L4.91 -7.02L3.93 -7.02L3.94 -5.24ZM4.91 -3L4.91 -4.86L3.94 -4.86L3.95 -3ZM2.13 -3.37L1.15 -3.37L1.15 -1.42L2.13 -1.42ZM8.65 -1.27Q8.63 -1.01 8.65 -0.74Q8.27 -0.76 7.89 -0.76L6.64 -0.76Q6.26 -0.76 5.88 -0.74Q5.9 -1.01 5.88 -1.27Q6.26 -1.24 6.64 -1.24L7.89 -1.24Q8.27 -1.24 8.65 -1.27ZM8.13 -5.1L7.67 -4.65L7.06 -5.66L7.51 -6.11ZM7.97 -3.32Q8.03 -3.83 7.82 -4.14Q8.02 -4.1 8.31 -4.1Q8.59 -4.09 8.63 -4.14Q8.67 -4.19 8.67 -4.34L8.67 -6.33L7.41 -6.33L7.31 -6.2Q7.28 -6.27 7.25 -6.33Q7.08 -6.33 6.85 -6.33L6.85 -2.93L9.67 -2.93L9.67 0.44Q9.67 0.79 9.43 1.05Q9.09 1.39 8.31 1.38Q8.38 0.86 8.14 0.56Q8.38 0.6 8.71 0.6Q9.04 0.61 9.09 0.55Q9.14 0.49 9.14 0.27L9.14 -2.45L6.33 -2.45L6.33 -6.81Q6.69 -6.81 7.06 -6.81Q7.35 -7.21 7.51 -7.81Q7.76 -7.66 8.06 -7.58Q7.95 -7.12 7.75 -6.81L9.19 -6.81L9.19 -4.22Q9.19 -3.92 8.96 -3.65Q8.65 -3.33 7.97 -3.32Z'],
  '湾': [10, 'M7.73 -3.55L4.64 -3.55Q4.19 -3.55 3.73 -3.54Q3.75 -3.78 3.73 -4.03Q4.19 -4 4.64 -4L8.39 -4L8.39 -2.35L4.57 -2.33L4.31 -1.55L8.87 -1.55L8.38 0.48Q8.16 1.27 6.31 1.25Q6.37 1.02 6.29 0.81Q6.22 0.61 6.06 0.47Q6.44 0.51 7.03 0.47Q7.62 0.43 7.68 0.38Q7.74 0.33 7.76 0.23L8.09 -1.1L3.46 -1.1L3.97 -2.6L3.97 -2.74L4.02 -2.74L4.06 -2.85L4.38 -2.74L7.73 -2.76ZM9.12 -4.29Q8.43 -5.3 7.4 -5.99L7.8 -6.58Q8.95 -5.82 9.72 -4.69ZM3.92 -6.15Q4.24 -6.01 4.59 -5.92Q4.33 -5.06 3.7 -4.04L3.3 -3.41Q3.05 -3.65 2.71 -3.69Q3.21 -4.39 3.59 -5.34ZM7.3 -4.28Q6.94 -4.32 6.58 -4.28Q6.61 -4.94 6.61 -5.61L6.61 -6.79L5.73 -6.79L5.73 -5.65Q5.73 -4.99 5.76 -4.33Q5.4 -4.36 5.05 -4.33Q5.08 -4.99 5.08 -5.65L5.08 -6.79L3.86 -6.79Q3.41 -6.79 2.95 -6.77Q2.97 -7.01 2.95 -7.27Q3.41 -7.25 3.86 -7.25L6.11 -7.25L5.11 -7.9L5.5 -8.5L6.79 -7.66L6.51 -7.25L8.72 -7.25Q9.18 -7.25 9.64 -7.27Q9.61 -7.01 9.64 -6.77Q9.18 -6.79 8.72 -6.79L7.27 -6.79L7.27 -5.61Q7.27 -4.94 7.3 -4.28ZM1.11 1.15Q0.8 0.92 0.35 0.9Q0.67 0.11 1.02 -0.91Q1.36 -1.92 2.02 -4.43L2.31 -4.23L1.46 -0.53ZM1.69 -4.46L1.22 -3.98L0.13 -5.31L0.6 -5.8ZM1.83 -6.11Q1.32 -6.86 0.71 -7.5L1.16 -8.01Q1.8 -7.32 2.33 -6.54Z'],
  '鲜': [10, 'M7.69 1.2Q7.33 1.16 6.98 1.2Q7.01 0.55 7.01 -0.1L7.01 -1.38L6.18 -1.38Q5.75 -1.38 5.31 -1.36Q5.34 -1.59 5.31 -1.83Q5.75 -1.8 6.18 -1.8L7.01 -1.8L7.01 -3.32L6.39 -3.32Q5.96 -3.32 5.52 -3.3Q5.55 -3.54 5.52 -3.77Q5.96 -3.75 6.39 -3.75L7.01 -3.75L7.01 -5.29L6.18 -5.29Q5.75 -5.29 5.31 -5.27Q5.34 -5.51 5.31 -5.74Q5.75 -5.72 6.18 -5.72L7 -5.72L7.91 -7.32L8.38 -8.1Q8.66 -7.88 8.97 -7.73L8.52 -6.96L7.94 -6.07L7.73 -5.72L8.8 -5.72Q9.23 -5.72 9.67 -5.74Q9.64 -5.51 9.67 -5.27Q9.23 -5.29 8.8 -5.29L7.65 -5.29L7.65 -3.75L8.44 -3.75Q8.87 -3.75 9.3 -3.77Q9.27 -3.54 9.3 -3.3Q8.87 -3.32 8.44 -3.32L7.65 -3.32L7.65 -1.8L8.82 -1.8Q9.26 -1.8 9.69 -1.83Q9.66 -1.59 9.69 -1.36Q9.26 -1.38 8.82 -1.38L7.65 -1.38L7.65 -0.1Q7.65 0.55 7.69 1.2ZM6.39 -5.88Q5.88 -6.83 5.24 -7.7L5.82 -8.11Q6.47 -7.2 7.01 -6.21ZM0.66 0.91Q0.66 0.43 0.45 0.11Q1.17 0.07 2.07 -0.06Q2.97 -0.19 5.07 -0.69L5.07 -0.28Q3.04 0.21 2.19 0.45Q1.35 0.69 0.66 0.91ZM2.23 -7.89Q2.56 -7.76 2.95 -7.71Q2.77 -7.05 2.5 -6.43L4.17 -6.43L4.27 -5.87Q4.13 -5.85 4.06 -5.75L3.49 -4.76L4.85 -4.76Q4.72 -2.91 4.83 -1.04L1.27 -1.04Q1.38 -2.73 1.3 -4.36Q1 -3.96 0.67 -3.57Q0.45 -3.83 0.08 -3.92Q1.52 -5.51 2.23 -7.89ZM3.33 -3.22L4.16 -3.22L4.17 -4.31L3.33 -4.31ZM2.65 -3.22L2.65 -4.31L1.95 -4.31L1.95 -3.22ZM3.33 -2.8L3.33 -1.49L4.15 -1.49L4.16 -2.8ZM2.65 -2.8L1.95 -2.8L1.95 -1.49L2.65 -1.49ZM3.41 -5.98L2.29 -5.98Q1.99 -5.37 1.57 -4.76L2.86 -4.76L2.74 -4.82Z'],
  '鱼': [10, 'M9.58 0.05Q9.55 0.33 9.58 0.62Q9.06 0.59 8.54 0.59L1.57 0.59Q1.04 0.59 0.53 0.62Q0.56 0.33 0.53 0.05Q1.04 0.07 1.57 0.07L8.54 0.07Q9.06 0.07 9.58 0.05ZM3.76 -7.05L6.7 -7.05L6.78 -6.46Q6.55 -6.41 6.41 -6.28L5.56 -5.41L8.02 -5.41Q7.89 -3.19 8.02 -0.99L1.89 -0.99Q1.95 -2.09 1.95 -3.04Q1.95 -3.99 1.92 -4.79Q1.34 -4.19 0.72 -3.73Q0.51 -4.1 0.12 -4.28Q1.76 -5.44 2.53 -6.54Q3.07 -7.3 3.49 -8.13Q3.83 -7.89 4.21 -7.72ZM5.28 -3.49L7.33 -3.49L7.33 -4.89L5.28 -4.89ZM4.59 -3.49L4.59 -4.89L2.58 -4.89L2.58 -3.49ZM5.28 -2.97L5.28 -1.5L7.33 -1.5L7.33 -2.97ZM4.59 -2.97L2.58 -2.97L2.58 -1.5L4.59 -1.5ZM4.75 -5.41L4.68 -5.48L5.7 -6.54L3.39 -6.54Q2.94 -5.92 2.49 -5.41Z'],
};

// ---------------------------------------------------------------- pure helpers
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const f = fmt2;   // = String(Math.round(x * 100) / 100), fast (core/math.js)
const pt = p => `${f(p[0])} ${f(p[1])}`;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const len = a => Math.hypot(a[0], a[1]);
const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
const perp = a => [-a[1], a[0]];
const lerp = (a, b, t) => a + (b - a) * t;
const lerp2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rot = ([x, y], a) => { const c = Math.cos(a * D2R), s = Math.sin(a * D2R); return [x * c - y * s, x * s + y * c]; };
const pol = (c, r, a) => [c[0] + r * Math.cos(a * D2R), c[1] + r * Math.sin(a * D2R)];
const angOf = v => Math.atan2(v[1], v[0]) * R2D;
const poly = (P, close = true) => 'M' + P.map(pt).join('L') + (close ? 'Z' : '');
const openD = P => 'M' + P.map(pt).join('L');
const seg = (a, b) => `M${pt(a)}L${pt(b)}`;
const circ = (c, r) => `M${f(c[0] - r)} ${f(c[1])}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
const arcD = (c, r, a0, a1) => `M${pt(pol(c, r, a0))}A${f(r)} ${f(r)} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} ${a1 > a0 ? 1 : 0} ${pt(pol(c, r, a1))}`;
// annular sector between radii r0<r1, from angle a0 to a1 (degrees, clockwise when a1>a0)
const band = (c, r0, r1, a0, a1) => {
  const lg = Math.abs(a1 - a0) > 180 ? 1 : 0, sw = a1 > a0 ? 1 : 0;
  return `M${pt(pol(c, r1, a0))}A${f(r1)} ${f(r1)} 0 ${lg} ${sw} ${pt(pol(c, r1, a1))}L${pt(pol(c, r0, a1))}A${f(r0)} ${f(r0)} 0 ${lg} ${1 - sw} ${pt(pol(c, r0, a0))}Z`;
};
const ringD = (c, r0, r1) => circ(c, r1) + circ(c, r0);          // use with fill-rule evenodd
const circR = (c, r) => `M${f(c[0] - r)} ${f(c[1])}a${f(r)} ${f(r)} 0 1 1 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 1 ${f(-2 * r)} 0Z`;
const ringNZ = (c, r0, r1) => circ(c, r1) + circR(c, r0);         // annulus under any fill / clip rule
const hex = (c, r, a0 = 0) => poly(Array.from({ length: 6 }, (_, i) => pol(c, r, a0 + i * 60)));
// rounded rectangle in a local frame (origin o, x axis u): x0..x1 along u, y0..y1 along perp(u)
function rrect(o, u, x0, x1, y0, y1, rr = 0) {
  const n = perp(u), P = (x, y) => add(o, add(mul(u, x), mul(n, y)));
  if (!rr) return poly([P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)]);
  rr = Math.min(rr, (x1 - x0) / 2, (y1 - y0) / 2);
  return `M${pt(P(x0 + rr, y0))}L${pt(P(x1 - rr, y0))}Q${pt(P(x1, y0))} ${pt(P(x1, y0 + rr))}L${pt(P(x1, y1 - rr))}Q${pt(P(x1, y1))} ${pt(P(x1 - rr, y1))}L${pt(P(x0 + rr, y1))}Q${pt(P(x0, y1))} ${pt(P(x0, y1 - rr))}L${pt(P(x0, y0 + rr))}Q${pt(P(x0, y0))} ${pt(P(x0 + rr, y0))}Z`;
}
// Catmull-Rom resample (open)
function resample(P, k) {
  const out = [], n = P.length, g = i => P[Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < k; j++) {
    const t = j / k, t2 = t * t, t3 = t2 * t, p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    out.push([0, 1].map(c => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
  }
  out.push(P[n - 1]); return out;
}
// closed Catmull-Rom -> cubic path (the draft's cr())
function crD(P, k = 1 / 6) {
  const n = P.length, g = i => P[(i + n) % n]; let d = `M${pt(P[0])}`;
  for (let i = 0; i < n; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    d += `C${pt([p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k])} ${pt([p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k])} ${pt(p2)}`;
  }
  return d + 'Z';
}
// a smooth curve as short C1 quadratic pieces (looks like one stroke; encloses no big area for hit-testing)
function splitQ(S) {
  const m = i => lerp2(S[i], S[i + 1], 0.5);
  let d = `M${pt(S[0])}L${pt(m(0))}`;
  for (let i = 1; i < S.length - 1; i++) d += `M${pt(m(i - 1))}Q${pt(S[i])} ${pt(m(i))}`;
  return d + `M${pt(m(S.length - 2))}L${pt(S[S.length - 1])}`;
}
const curve = (P, k = 3) => splitQ(resample(P, k));
// tapered ribbon along a centreline, widths w0 -> w1
function taper(C, w0, w1) {
  const L = [], R = [], n = C.length;
  for (let i = 0; i < n; i++) {
    const t = norm(sub(C[Math.min(i + 1, n - 1)], C[Math.max(i - 1, 0)])), nn = perp(t), w = lerp(w0, w1, i / (n - 1)) / 2;
    L.push(add(C[i], mul(nn, w))); R.push(add(C[i], mul(nn, -w)));
  }
  return poly([...L, ...R.reverse()]);
}
const quadPts = (a, q, b, n) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * q[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * q[1] + t * t * b[1]]; });

// ---- hand-made wobble, baked into geometry (deterministic: the same every frame, every build)
function hash(n) { n = Math.imul(n ^ 0x9E3779B9, 0x85EBCA6B); n ^= n >>> 13; n = Math.imul(n, 0xC2B2AE35); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
const wobF = (seed, lam = 16) => {
  const p = [1, 2, 3].map(k => hash(seed * 31 + k) * 6.2832);
  return s => 0.55 * Math.sin(s / lam * 6.2832 + p[0]) + 0.3 * Math.sin(s / (lam * 0.47) * 6.2832 + p[1]) + 0.15 * Math.sin(s / (lam * 0.21) * 6.2832 + p[2]);
};
// resample a polyline so no edge is longer than `step`
function densify(P, step, closed = false) {
  const out = [], n = P.length, m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const a = P[i], b = P[(i + 1) % n], k = Math.max(1, Math.ceil(len(sub(b, a)) / step));
    for (let j = 0; j < k; j++) out.push(lerp2(a, b, j / k));
  }
  if (!closed) out.push(P[n - 1]);
  return out;
}
// displace a polyline along its normals by smooth seeded noise
function wobble(P, amp, seed, lam = 16, closed = false) {
  const n = P.length, w = wobF(seed, lam); let s = 0;
  return P.map((p, i) => {
    if (i) s += len(sub(p, P[i - 1]));
    const a = closed ? P[(i - 1 + n) % n] : P[Math.max(0, i - 1)], b = closed ? P[(i + 1) % n] : P[Math.min(n - 1, i + 1)];
    return add(p, mul(perp(norm(sub(b, a))), amp * w(s)));
  });
}
const handPoly = (P, amp, seed, step = 3, lam = 14) => poly(wobble(densify(P, step, true), amp, seed, lam, true));
// ribbon edges along a centreline, each edge wobbling independently
function ribbon(C, w0, w1, amp, seed, lam = 18) {
  const n = C.length, L = [], R = [], wl = wobF(seed, lam), wr = wobF(seed + 101, lam); let s = 0;
  for (let i = 0; i < n; i++) {
    if (i) s += len(sub(C[i], C[i - 1]));
    const t = norm(sub(C[Math.min(i + 1, n - 1)], C[Math.max(i - 1, 0)])), nn = perp(t), w = lerp(w0, w1, i / (n - 1)) / 2;
    L.push(add(C[i], mul(nn, w + amp * wl(s)))); R.push(add(C[i], mul(nn, -w + amp * wr(s))));
  }
  return { L, R };
}
// glyph text -> path (em 10); fn maps local glyph space (baseline y=0, x from 0) to output space
function mapPath(d, fn) {
  let out = '', nums = [];
  for (const t of d.match(/[MLQZ]|-?\d*\.?\d+/g)) {
    if (t.length === 1 && /[MLQZ]/.test(t)) { out += t; continue; }
    nums.push(+t); if (nums.length === 2) { out += pt(fn(nums)) + ' '; nums = []; }
  }
  return out;
}
// hand-lettered feel: a gentle baseline wobble (per glyph) and an optional italic slant
function textD(str, size, fn = p => p, track = 0, o = {}) {
  const k = size / 10, slant = o.slant || 0, bob = o.bob || 0; let pen = 0, d = '', gi = 0;
  for (const ch of str) {
    if (ch === ' ') { pen += 3.1 * k + track; continue; }
    const g = GLYPHS[ch]; if (!g) continue;
    const x0 = pen, dy = bob * Math.sin(gi * 2.3 + 0.7) * k; gi++;
    d += mapPath(g[1], ([x, y]) => fn([x0 + x * k - y * k * slant, y * k + dy])); pen += g[0] * k + track;
  }
  return { d, w: pen - track };
}
const textW = (str, size, track = 0) => textD(str, size, p => p, track).w;

// ---------------------------------------------------------------- geometry (rider space, contract BIKE)
const BB = BIKE.bb, RH = BIKE.rearHub, FH = BIKE.frontHub, STT = BIKE.seatTubeTop, SCL = BIKE.seatClamp;
const HTT = BIKE.headTop, HBB = BIKE.headBottom, STR = BIKE.steererTop, STEM = BIKE.stem;
const uST = norm(sub(STT, BB)), nST = perp(uST);             // seat tube up; nST points forward-up
const uHT = norm(sub(HBB, HTT)), nHTf = mul(perp(uHT), -1);  // head tube down; nHTf points forward
const uDT = norm(sub(HBB, BB)), uTT = norm(sub(HTT, STT)), uSS = norm(sub(STT, RH)), uCS = norm(sub(BB, RH));
const HT_LEN = len(sub(HBB, HTT)), DT_LEN = len(sub(HBB, BB)), SS_LEN = len(sub(STT, RH)), CS_LEN = len(sub(BB, RH));
const onST = s => add(BB, mul(uST, s)), onHT = s => add(HTT, mul(uHT, s)), onDT = s => add(BB, mul(uDT, s));
const onSS = s => add(RH, mul(uSS, s)), onCS = s => add(RH, mul(uCS, s)), onTT = s => add(STT, mul(uTT, s));
const axis = t => add(HBB, mul(uHT, t));                    // steering axis below the head tube
const HT_ANG = angOf(uHT), DT_ANG = angOf(uDT), SS_ANG = angOf(uSS), CS_ANG = angOf(uCS);
// fork centreline: straight along the steering axis, bending forward only near the dropout (rake 13.2)
const FORK_C = [...Array.from({ length: 8 }, (_, i) => axis(4 + (58 * i) / 7)), ...quadPts(axis(62), axis(96), FH, 10).slice(1)];
// where the steering axis crosses a radius r of the front wheel (for pads / dynamo)
const axisAtR = r => { const d = sub(HBB, FH), b = d[0] * uHT[0] + d[1] * uHT[1], c = d[0] ** 2 + d[1] ** 2 - r * r; return axis(-b - Math.sqrt(b * b - c)); };

// ---------------------------------------------------------------- wheel lacing (32h, 3-cross, alternating flanges)
const FLANGE_R = 7.2, SPOKE_RIM_R = 87.7;
const LACING = (() => {
  const out = [];
  for (let k = 0; k < 16; k++) {                      // near flange holes at 22.5k -> even rim holes
    const ah = 22.5 * k, dir = k % 2 === 0 ? 1 : -1;  // alternate leading / trailing (16 pull, 16 push)
    out.push({ side: 'near', ah, ar: ah + dir * 67.5, dir });
  }
  for (let k = 0; k < 16; k++) {                      // far flange holes offset 11.25 -> odd rim holes
    const ah = 11.25 + 22.5 * k, dir = k % 2 === 0 ? -1 : 1;
    out.push({ side: 'far', ah, ar: ah + dir * 67.5, dir });
  }
  return out;
})();
const spokeEnds = s => [pol([0, 0], FLANGE_R, s.ah), pol([0, 0], SPOKE_RIM_R, s.ar)];
// valve gaps: between two rim holes whose spokes run nearly parallel (standard lacing rule)
const VALVE_GAPS = (() => {
  const byHole = {}; for (const s of LACING) byHole[((Math.round(s.ar / 11.25) % 32) + 32) % 32] = s;
  const gaps = [];
  for (let m = 0; m < 32; m++) {
    const a = byHole[m], b = byHole[(m + 1) % 32]; const [a0, a1] = spokeEnds(a), [b0, b1] = spokeEnds(b);
    const da = norm(sub(a1, a0)), db = norm(sub(b1, b0));
    gaps.push({ ang: 11.25 * m + 5.625, par: Math.abs(da[0] * db[0] + da[1] * db[1]) });
  }
  return gaps.sort((p, q) => q.par - p.par);
})();

// ---------------------------------------------------------------- chain / sprocket phasing (rollers seat in valleys)
// At φ=0 the chain dash pattern puts roller k at path unit k. First roller on the ring arc -> valley angle.
const CH_L = 375.82 / 100;                                          // path units -> length
const TOP_RUN = len(sub([0.23, -108.55], [-124.92, -109.57]));
const RING_A0 = angOf(sub([0.23, -108.55], BB));
const RING_VALLEY0 = RING_A0 + (((Math.ceil(TOP_RUN / CH_L) - TOP_RUN / CH_L) * CH_L) / BIKE.ringR) * R2D;
const COG_VALLEY0 = angOf(sub([-124.92, -109.57], RH));             // path start = roller 0 on the cog top

// ---------------------------------------------------------------- detail inventory (documentation for judges)
const DETAILS = [
  // wheels
  ['O', 'tyre', 'warm-dark 700×32c tyre with a cream gum wall and bead line (radial gradient stops), brown-ink outline'], ['T', 'tyre-tread', 'block tread on the crown (fades into a blur ring at speed)'],
  ['T', 'tyre-sidewall-lettering', 'serif "PELICAN · 700×32C" painted on both gum walls (glyph paths)'],
  ['T', 'tyre-highlight', 'static warm specular on the sun side of each tyre (does not turn with it)'],
  ['O', 'rim', 'steel rim 88→91 with ink edges, shaded inner wall and machined brake track (gradient stops)'], ['T', 'rim-eyelets', '32 spoke-hole eyelets every 11.25°'],
  ['O', 'spokes-near', '16 near-flange spokes, tangential 3-cross, ink-lined steel'], ['O', 'spokes-far', '16 far-flange spokes, -far glaze, thinner'],
  ['O', 'spoke-nipples', '32 brass nipples at the rim'], ['O', 'hub-front', 'front hub flange with 16 spoke holes'], ['T', 'hub-spoke-heads', 'spoke heads on the flange'],
  ['O', 'valve', 'Schrader valve stem + lock nut + red cap between two near-parallel spokes'], ['O', 'spoke-reflector-front', 'white spoke reflector'],
  ['O', 'spoke-reflector-rear', 'amber spoke reflector'], ['T', 'wheel-motion-swooshes', 'soft painted motion swooshes, static, fade in with speed'],
  ['O', 'axle-nut-rear', 'rear axle nut (static)'], ['O', 'axle-nut-front', 'front axle nut (static)'], ['O', 'dropout-rear', 'rear dropout plate with axle slot'],
  ['O', 'fork-end', 'front fork end'], ['O', 'rim-decal', 'red rim label opposite the valve'],
  // drivetrain
  ['O', 'cog', '16T sprocket'], ['O', 'cog-lockring', 'freewheel lockring with index notch'], ['O', 'chainring-teeth', '48T chainring teeth (under the chain)'],
  ['O', 'chainring', 'chainring body with five heart-shaped windows'], ['T', 'chainring-pinstripe', 'teal pinstripe ring'], ['O', 'spider', '5-arm spider'], ['O', 'chainring-bolts', 'five chainring bolts'],
  ['O', 'crank-near', 'near crank arm with bevel highlight'], ['O', 'crank-far', 'far crank (-far glaze)'], ['O', 'crank-dust-cap', 'dust cap with spanner holes'],
  ['O', 'pedal-near', 'platform pedal cage'], ['T', 'pedal-treads', 'rubber tread blocks'], ['O', 'pedal-reflector', 'amber pedal reflectors'], ['O', 'pedal-far', 'far pedal'],
  ['O', 'chain', 'chain on CHAIN_D (pathLength 100)'], ['T', 'chain-outer-plates', 'outer plates (2-link period)'], ['T', 'chain-inner-plates', 'inner plates'],
  ['T', 'chain-rollers', 'rollers / pin heads'], ['O', 'chain-master-link', 'brass master link with clip'], ['O', 'chainguard', 'teal half chainguard'],
  ['T', 'chainguard-lettering', 'serif "Pelican Bay" on the guard'], ['O', 'chainguard-stays', 'guard stays / clamp'], ['O', 'chain-tensioner', 'chain tensioner bolt in the dropout'],
  // frame
  ['O', 'top-tube', 'top tube 28.6 mm'], ['O', 'down-tube', 'down tube 31.8 mm'], ['O', 'seat-tube', 'seat tube'], ['O', 'chainstay', 'chainstay'], ['O', 'seat-stay', 'seat stay'],
  ['O', 'head-tube', 'head tube'], ['O', 'lug-seat', 'cream seat lug with spearpoints'], ['O', 'lug-head-top', 'top head lug'], ['O', 'lug-head-bottom', 'bottom head lug'],
  ['T', 'lug-lining', 'red lug lining'], ['O', 'seat-binder-bolt', 'seat binder bolt'], ['O', 'seat-stay-caps', 'wrap-over seat-stay caps'],
  ['T', 'frame-pinstripe-bands', 'cream/red box-lining bands'], ['T', 'frame-highlight', 'broken dry-brush highlight along the lit edge'], ['T', 'frame-rim-light', 'warm back-light rim on sun-facing edges'],
  ['T', 'frame-shade-glaze', 'dark teal glaze along the underside of every tube'], ['T', 'frame-gouache-texture', 'painted gouache blotches (static pattern in the frame\'s own frame)'],
  ['O', 'head-badge', 'brass head badge'], ['O', 'head-badge-pelican', 'pelican emblem on the badge'], ['O', 'head-badge-rivets', 'badge rivets'],
  ['O', 'decal-cn', 'down-tube decal 鹈鹕 (glyph path), on the tube'], ['O', 'decal-latin', 'down-tube decal "Pelican" in slanted serif, on the tube'], ['T', 'decal-flourish', 'painted swash under the decal'],
  ['O', 'brake-bridge', 'seat-stay brake bridge'], ['O', 'bb-lug-points', 'BB lug spearpoints'], ['O', 'bb-shell', 'bottom-bracket shell'],
  // steering
  ['O', 'fork-blade', 'raked fork blade'], ['O', 'fork-crown', 'cream fork crown with a heart cut'], ['O', 'headset-cups', 'headset cups'], ['T', 'headset-knurl', 'knurled locknut'],
  ['O', 'stem', 'quill stem'], ['O', 'stem-bolts', 'expander + clamp bolts'], ['O', 'handlebar', 'swept-back city bar'], ['O', 'grip-near', 'cork grip'], ['T', 'grip-ribs', 'grip ribs'],
  ['O', 'bar-end-plug', 'bar-end plug'], ['O', 'grip-far', 'far grip'], ['O', 'brake-lever-near', 'brake lever'], ['O', 'brake-lever-far', 'far brake lever'],
  ['O', 'brake-housing-front', 'cream front brake housing'], ['O', 'brake-housing-rear', 'cream rear brake housing along the top tube'], ['O', 'cable-clips', 'top-tube cable clips'],
  ['O', 'cable-ferrules', 'housing ferrules + bare cable'], ['O', 'calliper-front', 'front side-pull calliper'], ['O', 'calliper-rear', 'rear side-pull calliper'], ['O', 'brake-pads', 'brake pads on the brake track'],
  // saddle
  ['O', 'saddle', 'sprung brown leather saddle'], ['T', 'saddle-sheen', 'leather sheen'], ['O', 'saddle-rivets', 'brass rivets'], ['O', 'saddle-cantle-plate', 'cantle plate'],
  ['O', 'saddle-springs', 'coil springs'], ['O', 'saddle-rails', 'rails'], ['O', 'seat-clamp', 'seat clamp with nut'], ['O', 'seatpost', 'seatpost'], ['T', 'saddle-stitching', 'cream skirt stitching'],
  ['O', 'saddle-bag-loops', 'saddle-bag loops'], ['O', 'saddlebag', 'little leather saddlebag with a brass buckle'],
  // fittings
  ['O', 'fender-rear', 'cream rear fender'], ['O', 'fender-front', 'cream front fender'], ['T', 'fender-pinstripe', 'teal fender pinstripe'], ['T', 'fender-brush-texture', 'painted brush texture on the fenders'],
  ['O', 'fender-stays', 'fender stays'], ['O', 'fender-bolts', 'stay screws / eyelets'], ['O', 'mud-flap', 'front mud flap'], ['O', 'mud-flap-emblem', 'fish emblem on the flap'], ['O', 'kickstand', 'folded kickstand'],
  ['O', 'kickstand-plate', 'kickstand mount + spring'], ['O', 'dynamo', 'bottle dynamo'], ['O', 'dynamo-roller', 'knurled dynamo roller'], ['O', 'dynamo-bracket', 'dynamo clamp'],
  ['O', 'lamp-wire', 'lamp wire with clips'], ['O', 'headlamp', 'bullet headlamp'], ['O', 'headlamp-lens', 'lens + bezel'], ['O', 'headlamp-bracket', 'lamp bracket'],
  ['O', 'headlamp-glow', 'soft night glow (radial gradient, no filter)'], ['O', 'rear-light', 'rear lamp'], ['O', 'rear-reflector', 'fender reflector'], ['O', 'rack', 'rear rack'], ['O', 'rack-struts', 'rack struts'],
  ['O', 'towel', 'rolled blue beach towel'], ['T', 'towel-stripes', 'cream towel stripes'], ['T', 'towel-spiral', 'rolled end spiral'], ['O', 'towel-straps', 'leather straps + buckles'], ['T', 'towel-fringe', 'towel fringe'],
  ['O', 'license-plate', 'cream licence plate'], ['O', 'plate-text-cn', '鹈鹕湾 on the plate'], ['O', 'plate-number', '001'], ['O', 'plate-bolts', 'plate bolts'],
  ['O', 'bell', 'brass bell dome'], ['T', 'bell-rings', 'bell dome rings'], ['O', 'bell-lever', 'bell striker lever'], ['O', 'basket', 'wicker basket'], ['T', 'basket-weave', 'over-under weave'],
  ['T', 'basket-rim', 'braided rim'], ['T', 'basket-base', 'base band'], ['O', 'basket-stays', 'basket stays to the axle'], ['O', 'basket-straps', 'leather straps to the bar'], ['O', 'basket-corner-posts', 'wrapped corner posts'],
  ['O', 'fish-mackerel', 'blue mackerel'], ['T', 'fish-mackerel-stripes', 'wavy tiger stripes'], ['O', 'fish-snapper', 'coral snapper'], ['T', 'fish-scales', 'painted scallop scales'], ['O', 'fish-sardine', 'silver sardine'],
  ['T', 'fish-sardine-spots', 'flank spots'], ['O', 'fish-fins', 'fins with rays'], ['O', 'fish-gills', 'gill covers'], ['O', 'fish-eyes', 'big round storybook eyes with a highlight'], ['O', 'fish-tails', 'forked tails'],
  ['T', 'fish-lateral-line', 'lateral lines'], ['T', 'fish-mouths', 'mouth lines'], ['T', 'fish-belly-sheen', 'pale painted belly'],
  ['O', 'newspaper-liner', 'newspaper lining the basket'], ['T', 'newspaper-print', 'newsprint columns + headline bar'], ['O', 'basket-tag', 'hanging price tag 鲜鱼'],
  ['O', 'gingham-cloth', 'red-and-cream gingham napkin tucked into the basket'], ['T', 'gingham-check', 'woven gingham checks'],
  ['O', 'seaweed', 'kelp draped over the rim with float bladders'],
  ['O', 'bottle', 'cream enamel bottle'], ['O', 'bottle-cage', 'wire cage'], ['O', 'bottle-cap', 'red cap'], ['O', 'bottle-label', 'teal fish label'], ['O', 'pump', 'frame pump'], ['T', 'pump-grip', 'pump handle ribs'],
  ['O', 'pump-pegs', 'pump pegs'], ['O', 'pump-hose', 'pump hose + chuck'],
  ['O', 'fender-mascot', 'brass flying-fish mascot on the front fender'], ['O', 'fender-reflector-front', 'white front fender reflector'],
  ['O', 'fender-emblem-rear', 'winged roundel on the rear fender'], ['O', 'rack-spring-clip', 'spring-loaded rack clip'],
  ['O', 'lamp-switch', 'headlamp switch lever'], ['O', 'pennant', 'little fish pennant on a whip behind the rack'], ['O', 'pennant-pole', 'pennant whip with a brass ball'],
];
const DK = new Map(DETAILS.map(([k, n]) => [n, k]));
export const detailItems = DETAILS.map(([kind, name, what]) => ({ id: `bike:${kind}:${name}`, layer: 'bike', kind, what }));
const D = name => { const k = DK.get(name); if (!k) throw new Error('bike: undeclared detail ' + name); return `bike:${k}:${name}`; };

// ---------------------------------------------------------------- build
export function build({ v }) {
  const c = k => v('bk' + k), cf = k => v('bk' + k, { far: true });
  const LN = c('Line'), LS = c('LineSoft'), FR = c('Frame'), FRH = c('FrameHi'), FRL = c('FrameLo');
  const CR = c('Cream'), CRL = c('CreamLo'), PA = c('Paper'), SA = c('Saddle'), SAH = c('SaddleHi');
  const WK = c('Wicker'), WKL = c('WickerLo'), WKH = c('WickerHi'), TY = c('Tyre'), TYH = c('TyreHi');
  const ST = c('Steel'), STL = c('SteelLo'), RD = c('Red'), RDL = c('RedLo'), BR = c('Brass'), BRH = c('BrassHi'), AM = c('Amber');
  const RIM = v('rim'), LAMP = v('headlamp'), LAMPG = v('lampGlow');
  const LW = 1.8, LWs = 1.15, LWt = 0.75;      // outline weights: main parts / small parts / tiny parts
  const S = (d, stroke, w, extra = {}) => h('path', { d, fill: 'none', stroke, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra });
  const Fp = (d, fill, extra = {}) => h('path', { d, fill, ...extra });
  // a filled shape with the warm-brown ink outline
  const Fi = (d, fill, w = LWs, extra = {}) => h('path', { d, fill, stroke: LN, 'stroke-width': w, 'stroke-linejoin': 'round', ...extra });
  // an outlined rod: ink under, paint over (all outlines of one group first, so joints read as one piece of metal)
  const rod = (d, w, ink, lw = 1.3, extra = {}) => S(d, LN, w + 2 * lw, extra) + S(d, ink, w, extra);
  const tag = name => ({ 'data-detail': D(name) });
  const G = (name, ...kids) => h('g', tag(name), ...kids);
  // one element per subpath / segment, all carrying the same detail tag (tight bounding boxes for hit-testing)
  const perSub = (name, d, attrs) => d.split(/(?=M)/).filter(Boolean).map(p => h('path', { ...tag(name), d: p, ...attrs })).join('');
  const arcPieces = (cc, r0, r1, a0, a1, n, ov = 0.5) => Array.from({ length: n }, (_, i) => band(cc, r0, r1, a0 + (a1 - a0) * i / n - (i ? ov : 0), a0 + (a1 - a0) * (i + 1) / n + (i < n - 1 ? ov : 0)));
  const arcSpans = (a0, a1, n) => Array.from({ length: n }, (_, i) => [a0 + (a1 - a0) * i / n, a0 + (a1 - a0) * (i + 1) / n]);
  const anchor = (name, p) => h('circle', { cx: f(p[0]), cy: f(p[1]), r: 0, 'data-anchor': 'bike-' + name });
  // dry-brush flicks: short tapered ink strokes that sit along an edge polyline
  const dryBrush = (E, seed, n, lenMin = 3, lenMax = 7, w = 1.1, off = 0.3) => {
    let d = '', total = 0; const cum = [0];
    for (let i = 1; i < E.length; i++) { total += len(sub(E[i], E[i - 1])); cum.push(total); }
    for (let k = 0; k < n; k++) {
      const s0 = total * (0.08 + 0.84 * ((k + 0.5 * hash(seed + k * 7)) / n)), L0 = lerp(lenMin, lenMax, hash(seed + k * 13));
      let i = 1; while (i < E.length - 1 && cum[i] < s0) i++;
      const u = norm(sub(E[i], E[i - 1])), nn = perp(u), p = lerp2(E[i - 1], E[i], clamp((s0 - cum[i - 1]) / (cum[i] - cum[i - 1] || 1), 0, 1));
      const q = add(p, mul(nn, off)), a = add(q, mul(u, -L0 / 2)), b = add(q, mul(u, L0 / 2)), m = add(lerp2(a, b, 0.5), mul(nn, w * 0.5));
      d += `M${pt(a)}Q${pt(m)} ${pt(b)}Q${pt(add(lerp2(a, b, 0.45), mul(nn, -w * 0.1)))} ${pt(a)}Z`;
    }
    return d;
  };
  const slots = {};
  let defs = '';

  // ============================================================ TEXTURES (static patterns, userSpaceOnUse = part-local)
  // gouache blotches: soft irregular dabs, darker and lighter than the base paint, inside the tile (no seams)
  const blot = (cx, cy, r, seed, n = 7) => crD(Array.from({ length: n }, (_, i) => pol([cx, cy], r * (0.7 + 0.5 * hash(seed + i)), i * 360 / n + 20 * hash(seed + 50 + i))));
  const texTile = (id, size, base, dabs) => h('pattern', { id, patternUnits: 'userSpaceOnUse', width: size, height: size }, h('rect', { width: size, height: size, fill: base }), ...dabs.map(([x, y, r, ink, op, sd]) => Fp(blot(x, y, r, sd), ink, { opacity: op })));
  defs += texTile('bike-texFrame', 26, FR, [[6, 5, 3.2, FRL, 0.42, 11], [18, 9, 2.2, FRH, 0.45, 23], [11, 18, 3.6, FRL, 0.32, 37], [21, 21, 2.4, FRH, 0.38, 41], [4, 20, 1.6, FRH, 0.4, 53], [15, 2, 1.4, FRL, 0.35, 59]]);
  defs += texTile('bike-texCream', 22, CR, [[5, 6, 3, CRL, 0.5, 61], [15, 4, 2, PA, 0.7, 67], [16, 15, 3.4, CRL, 0.4, 71], [6, 17, 2, PA, 0.6, 79]]);
  defs += texTile('bike-texLeather', 14, SA, [[4, 4, 2.2, SAH, 0.35, 83], [10, 9, 1.8, LN, 0.18, 89], [3, 11, 1.4, SAH, 0.3, 97]]);
  defs += texTile('bike-texTowel', 16, c('Towel'), [[4, 4, 2.4, PA, 0.18, 101], [12, 10, 2.8, LN, 0.12, 107]]);
  const stops = S0 => S0.map(([o, col]) => h('stop', { offset: o, 'stop-color': col })).join('');
  defs += h('radialGradient', { id: 'bike-tyreG', gradientUnits: 'userSpaceOnUse', cx: 0, cy: 0, r: 100 },
    stops([[0.905, CR], [0.943, CR], [0.943, LS], [0.95, LS], [0.95, TY], [1, TY]]));
  defs += h('radialGradient', { id: 'bike-rimG', gradientUnits: 'userSpaceOnUse', cx: 0, cy: 0, r: 91.2 },
    stops([[0.96, STL], [0.975, STL], [0.975, ST], [0.984, ST], [0.984, STL], [0.99, STL], [0.99, ST], [1, ST]]));
  // headlamp glow: a soft radial gradient (emissive), never a filter
  defs += h('radialGradient', { id: 'bike-glowG' }, h('stop', { offset: 0, 'stop-color': LAMP, 'stop-opacity': 0.9 }), h('stop', { offset: 0.35, 'stop-color': LAMPG, 'stop-opacity': 0.45 }), h('stop', { offset: 1, 'stop-color': LAMPG, 'stop-opacity': 0 }));
  defs += h('radialGradient', { id: 'bike-rglowG' }, h('stop', { offset: 0, 'stop-color': RD, 'stop-opacity': 0.55 }), h('stop', { offset: 1, 'stop-color': RD, 'stop-opacity': 0 }));

  // ============================================================ WHEELS
  const spokeD = side => LACING.filter(s => s.side === side).map(s => seg(...spokeEnds(s))).join('');
  defs += h('g', { id: 'bike-spk-near', fill: 'none', 'stroke-linecap': 'round' }, h('path', { d: spokeD('near'), stroke: LN, 'stroke-width': 1.5 }), h('path', { d: spokeD('near'), stroke: ST, 'stroke-width': 0.7 }));
  defs += h('path', { id: 'bike-spk-far', d: spokeD('far'), stroke: cf('SteelLo'), 'stroke-width': 0.9, fill: 'none', 'stroke-linecap': 'round' });
  // tyre gum-wall lettering: two arcs 180° apart, reading clockwise, "up" = outward
  const tyreText = (() => {
    const str = 'PELICAN · 700×32C', size = 3.5, rb = 91.95, w = textW(str, size, 0.3);
    const d = [];
    for (const a0 of [-90, 90]) {
      const start = a0 * D2R - (w / 2) / rb;
      const m = ([x, y]) => { const a = start + x / rb, r = rb - y; return [r * Math.cos(a), r * Math.sin(a)]; };
      d.push(textD(str, size, m, 0.3).d);
    }
    return d;
  })();
  // tread blocks, eyelets and nipples are split per arc piece (so each piece owns what is painted on it); their
  // speed fades are CSS variables on the wheel root (--bkTr tread, --bkFine eyelets+nipples, --bkHd spoke heads)
  const angIn = (a, a0, a1) => { const x = ((a - a0) % 360 + 360) % 360; return x < a1 - a0; };
  const treadIn = (a0, a1) => Array.from({ length: 96 }, (_, i) => i * 3.75).filter(a => angIn(a, a0, a1)).map(a => band([0, 0], 97.4, 99.2, a - 1, a + 1)).join('');
  const TXT_A = [-90, 90];
  function wheel(which) {
    const rear = which === 'rear', W = 'bike-w' + (rear ? 'R' : 'F');
    const vg = VALVE_GAPS[rear ? 0 : 5].ang;              // different valve phase front / rear
    const refl = LACING.find(s => s.side === 'near' && Math.abs(((s.ah - (rear ? 200 : 40)) % 360 + 360) % 360) < 11.3) || LACING[3];
    const [r0, r1] = spokeEnds(refl), rp = lerp2(r0, r1, 0.62), ra = angOf(sub(r1, r0));
    const sp12 = arcSpans(-67.5, 292.5, 8), sp8 = arcSpans(-90, 270, 8);
    const tyre = sp12.map(([a0, a1], i) => {
      const txt = TXT_A.map((ta, k) => (angIn(ta, a0, a1) ? tyreText[k] : '')).join('');
      return G('tyre', Fp(band([0, 0], 91, 100, a0 - (i ? 0.4 : 0), a1 + 0.4), 'url(#bike-tyreG)'), S(arcD([0, 0], 99.9, a0 - 0.3, a1 + 0.3), LN, 1.9),
        h('path', { ...tag('tyre-tread'), d: treadIn(a0, a1), fill: TYH, style: 'opacity:var(--bkTr,1)' }),
        h('path', { ...tag('tyre-tread'), d: band([0, 0], 97.6, 99, a0, a1 + 0.2), fill: TYH, style: 'opacity:calc(1 - var(--bkTr,1))' }),
        txt ? h('path', { ...tag('tyre-sidewall-lettering'), d: txt, fill: LS }) : '');
    });
    const rim = sp8.map(([a0, a1], i) => {
      const nip = LACING.filter(s => angIn(s.ar, a0, a1)).map(s => seg(pol([0, 0], 85.2, s.ar), pol([0, 0], 88.2, s.ar))).join('');
      const eye = Array.from({ length: 32 }, (_, m) => m * 11.25).filter(a => angIn(a, a0, a1)).map(a => circ(pol([0, 0], 89.4, a), 0.55)).join('');
      return G('rim', Fp(band([0, 0], 87.8, 91.2, a0 - (i ? 0.5 : 0), a1 + 0.5), 'url(#bike-rimG)'),
        S(arcD([0, 0], 91.1, a0, a1) + arcD([0, 0], 87.8, a0, a1), LN, 1),
        eye ? h('path', { ...tag('rim-eyelets'), d: eye, fill: LN, style: 'opacity:var(--bkFine,1)' }) : '',
        nip ? h('path', { ...tag('spoke-nipples'), d: nip, fill: 'none', stroke: BR, 'stroke-width': 1.5, style: 'opacity:var(--bkFine,1)' }) : '');
    });
    return h('g', { 'data-ref': `${W}-root` },
      h('g', { 'data-ref': `${W}-spk`, ...tag('spokes-far') }, h('use', { href: '#bike-spk-far' })),
      ...tyre, ...rim,
      h('g', { 'data-ref': `${W}-spkN`, ...tag('spokes-near') }, h('use', { href: '#bike-spk-near' })),
      // hub (front flange visible; the rear one sits under the 16T cog)
      rear ? '' : G('hub-front',
        Fi(circ([0, 0], 8.8), ST, 1.2), Fp(ringD([0, 0], 3.9, 5.2), STL, { 'fill-rule': 'evenodd' }), S(arcD([0, 0], 7.6, -150, -40), PA, 0.7),
        h('path', { ...tag('hub-spoke-heads'), style: 'opacity:var(--bkHd,1)', d: LACING.filter(s => s.side === 'near').map(s => circ(pol([0, 0], FLANGE_R, s.ah), 0.8)).join(''), fill: LN })),
      // valve (true rotation marker)
      h('g', { ...tag('valve'), 'data-ref': rear ? 'bike-valve' : 'bike-valveF' }, h('g', { transform: `rotate(${f(vg + 90)})` },
        Fi(rrect([0, 0], [0, 1], -88.4, -79.5, -1.2, 1.2, 0.5), ST, 0.7), Fi(rrect([0, 0], [0, 1], -87.6, -86, -2.2, 2.2, 0.5), BR, 0.6),
        Fi(rrect([0, 0], [0, 1], -81.8, -77, -1.7, 1.7, 0.8), RD, 0.7), S(`M-0.6 -80.8L-0.6 -78.2`, PA, 0.5))),
      G('rim-decal', Fp(band([0, 0], 88.2, 90.8, vg + 180 - 3.4, vg + 180 + 3.4), RD), Fp(band([0, 0], 89.2, 89.8, vg + 180 - 2.3, vg + 180 + 2.3), CR)),
      // spoke reflector (true rotation marker), clipped on the spoke
      G(rear ? 'spoke-reflector-rear' : 'spoke-reflector-front', h('g', { transform: `translate(${pt(rp)}) rotate(${f(ra)})` },
        Fi(rrect([0, 0], [1, 0], -7.5, 7.5, -3.7, 3.7, 2.4), rear ? AM : PA, 1), Fp(rrect([0, 0], [1, 0], -5.8, 5.8, -2.1, 2.1, 1.2), rear ? RD : CRL, { opacity: 0.55 }),
        S('M-4.5 -2L-2 2M-1.2 -2L1.3 2M2.1 -2L4.6 2', rear ? BRH : PA, 0.55))),
    );
  }
  slots.wheelRear = wheel('rear');
  slots.wheelFront = wheel('front');

  // ============================================================ FRAME (rider space, static)
  let fr = '';
  // --- soft painted motion swooshes (static, fade in with speed; never more than a hint)
  const swoosh = (cc, r, a0, span, w) => {
    const A = [], Bq = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14, a = a0 + span * t, ww = w * Math.sin(Math.PI * Math.pow(t, 0.8)); A.push(pol(cc, r + ww / 2, a)); Bq.push(pol(cc, r - ww / 2, a)); }
    return poly([...A, ...Bq.reverse()]);
  };
  const swD = (r, a0, span, w) => [RH, FH].map(cc => [0, 1, 2].map(k => swoosh(cc, r, k * 120 + a0, span, w)).join('')).join('');
  fr += h('g', { ...tag('wheel-motion-swooshes'), 'data-ref': 'bike-swoosh', opacity: 0 }, Fp(swD(74, 16, 40, 3.2), CR, { opacity: 0.8 }), Fp(swD(56, 76, 32, 2.4), CRL, { opacity: 0.8 }));
  // --- the tyres' static warm highlight (the light stays put while the tyre turns under it)
  for (const cc of [RH, FH]) fr += h('path', { ...tag('tyre-highlight'), d: band(cc, 97.3, 98.6, 30, 68), fill: TYH, opacity: 0.9 }) + h('path', { ...tag('tyre-highlight'), d: band(cc, 97.6, 98.3, 40, 58), fill: CRL, opacity: 0.7 });

  // --- fenders: wobbly cream bands with ink edges, teal pinstripe, brush texture, dry-brush underside
  const fender = (cc, a0, a1, name, seed) => {
    const n = Math.round((a1 - a0) / 38), step = 2.5, K = Math.ceil((a1 - a0) / step);
    const wo = wobF(seed, 30), wi = wobF(seed + 5, 30);
    const O = [], I = [];
    for (let i = 0; i <= K; i++) { const a = a0 + (a1 - a0) * i / K, s = a * 1.85; O.push(pol(cc, 108.4 + 0.35 * wo(s), a)); I.push(pol(cc, 103.2 + 0.3 * wi(s), a)); }
    let out = '';
    for (let k = 0; k < n; k++) {
      const i0 = Math.floor(k * K / n), i1 = Math.min(K, Math.floor((k + 1) * K / n) + (k < n - 1 ? 1 : 0));
      const Os = O.slice(i0, i1 + 1), Is = I.slice(i0, i1 + 1), P = poly([...Os, ...Is.slice().reverse()]);
      const caps = (k === 0 ? seg(O[0], I[0]) : '') + (k === n - 1 ? seg(O[K], I[K]) : '');
      out += G(name, h('path', { ...tag('fender-brush-texture'), d: P, fill: 'url(#bike-texCream)' }),
        S(openD(Os) + openD(Is) + caps, LN, LW));
      out += h('path', { ...tag('fender-pinstripe'), d: band(cc, 106, 106.7, Math.max(a0 + 5, a0 + (a1 - a0) * i0 / K), Math.min(a1 - 5, a0 + (a1 - a0) * i1 / K)), fill: FR });
    }
    out += S(openD(O.map(p => add(p, mul(norm(sub(p, cc)), 1.2)))), LS, 0.5, { opacity: 0.5, 'stroke-dasharray': '9 4 15 3 22 6' });
    out += h('path', { d: dryBrush(I, seed + 9, Math.round((a1 - a0) / 26), 3, 6, 1.1, 0.2), fill: LN, opacity: 0.6 });
    return out;
  };
  fr += h('g', { 'data-ref': 'bike-fender-rear' }, fender(RH, -200, -12, 'fender-rear', 301)) + h('g', { 'data-ref': 'bike-fender-front' }, fender(FH, -121, 27, 'fender-front', 307));
  { // front fender mascot (brass flying fish), front reflector, rear winged roundel
    const mA = -52, mp = pol(FH, 107.8, mA);
    fr += G('fender-mascot', h('g', { transform: `translate(${pt(mp)}) rotate(${f(mA + 90)})` },
      Fi('M-5 0.8L5 0.8L4 -1L-4 -1Z', STL, 0.7), Fi('M-7.4 -0.6Q-6 -6.2 2.4 -6.8Q7.6 -7 10.4 -3.6L6.4 -2.6Q3 -0.8 -7.4 -0.6Z', BR, 0.9),
      Fi('M-1 -5.8L-7.8 -11.6L1.6 -6.6Z', BRH, 0.8), S('M-4.8 -2.2Q1 -3.4 6.6 -3.2', BRH, 0.7), Fp(circ([6.6, -4.8], 0.75), LN), Fi('M-6.6 -0.8L-11 -3.8L-10 0.2Z', BR, 0.7)));
    fr += G('fender-reflector-front', h('g', { transform: `translate(${pt(pol(FH, 105.8, -4))}) rotate(${f(-4 + 90)})` }, Fi(rrect([0, 0], [1, 0], -4.2, 4.2, -2.2, 2.2, 1), PA, 0.8), S('M-3 -1L-1.6 1M-0.6 -1L0.8 1M1.8 -1L3.2 1', CRL, 0.5)));
    fr += G('fender-emblem-rear', h('g', { transform: `translate(${pt(pol(RH, 105.8, -148))}) rotate(${f(-148 + 90)})` },
      Fi('M-2.6 0L-9 -1.6L-8 0L-9 1.6Z', FR, 0.6), Fi('M2.6 0L9 -1.6L8 0L9 1.6Z', FR, 0.6), Fi(circ([0, 0], 2.8), RD, 0.7), Fp(circ([0, 0], 1.5), CR), Fp(circ([0, 0], 0.6), RD)));
  }
  // fender stays + bolts
  const eyeR = add(RH, [-3.2, 4.4]), eyeF = add(FH, [3.2, 3.6]);
  const stayEnds = [[RH, eyeR, 163], [RH, eyeR, 197], [FH, eyeF, 8], [FH, eyeF, -17]];
  fr += G('fender-stays', rod(stayEnds.map(([cc, e, a]) => seg(pol(cc, 103.6, a), e)).join(''), 1.2, ST, 0.55));
  fr += perSub('fender-bolts', stayEnds.map(([cc, , a]) => circ(pol(cc, 105.8, a), 1.15)).join('') + circ(onSS(105.7), 1.25), { fill: BR, stroke: LN, 'stroke-width': 0.5 });
  // rear fender reflector
  fr += G('rear-reflector', h('g', { transform: `translate(${pt(pol(RH, 105.8, 176))}) rotate(${f(176 + 90)})` },
    Fi(rrect([0, 0], [1, 0], -6, 6, -2.4, 2.4, 1.2), RD, 0.8), S('M-4.5 -0.2H4.5', c('CoralHi'), 0.6), S('M-3 -1.2L-1.5 1.2M0 -1.2L1.5 1.2M3 -1.2L4.2 0.8', RDL, 0.45)));
  // front mud flap (dark rubber) with a cream fish emblem
  {
    const a = pol(FH, 103.4, 24), b = pol(FH, 108.4, 23), fp = [a, b, [b[0] + 2.6, b[1] + 17], [a[0] + 1.4, a[1] + 18.4]];
    const m = lerp2(lerp2(fp[0], fp[1], 0.5), lerp2(fp[2], fp[3], 0.5), 0.55);
    fr += G('mud-flap', Fi(handPoly(fp, 0.25, 311, 2), TY, 1.2), S(seg(lerp2(fp[3], fp[2], 0.15), lerp2(fp[3], fp[2], 0.85)), TYH, 0.7));
    fr += G('mud-flap-emblem', Fp(`M${pt(add(m, [-2.3, 0]))}Q${pt(add(m, [0, -2.2]))} ${pt(add(m, [2.4, 0]))}Q${pt(add(m, [0, 2.2]))} ${pt(add(m, [-2.3, 0]))}ZM${pt(add(m, [-2.1, 0]))}L${pt(add(m, [-3.9, -1.5]))}L${pt(add(m, [-3.9, 1.5]))}Z`, CR));
  }

  // --- kickstand (folded along the chainstay) + chainguard stays (both behind the chain)
  {
    const mp = onCS(CS_LEN - 36), leg0 = add(mp, [-2, 3.2]), leg1 = add(onCS(CS_LEN - 102), [0, 9.6]);
    fr += G('kickstand-plate', Fi(rrect(mp, uCS, -6, 6, -3.2, 4.4, 1), ST, 0.9), Fp(circ(add(mp, rot([-3.2, 0.6], CS_ANG)), 0.9) + circ(add(mp, rot([3.2, 0.6], CS_ANG)), 0.9), LN),
      S(curve([add(mp, [-4, 3]), add(mp, [-8, 5.6]), add(mp, [-13, 4.2]), add(mp, [-17, 6])], 3), LS, 0.9));
    fr += G('kickstand', Fi(taper([leg0, lerp2(leg0, leg1, 0.5), leg1], 3.8, 2.8), ST, 1), S(seg(add(leg0, [-2, -0.6]), add(leg1, [0, -0.9])), PA, 0.6),
      Fi(rrect(leg1, norm(sub(leg1, leg0)), -1.5, 3.5, -2.7, 2.7, 1.2), TY, 0.8));
    fr += G('chainguard-stays', rod(seg([-73, -113.4], onCS(CS_LEN - 72)) + seg(onST(35), [-3, -115]), 1.1, ST, 0.5), Fi(rrect(onST(35), uST, -1.6, 1.6, -5, 5, 0.6), ST, 0.6));
  }

  // --- rear rack, towel, plate, rear light, pennant, saddlebag (behind the frame tubes)
  {
    const yT = -216.5, x0 = -57, x1 = -194;
    const s1a = [-190, yT], s2a = [-151, yT], e1 = add(RH, [-4.5, -3]), e2 = add(RH, [-2.4, -4.6]);
    // the fish pennant on a whip, clamped to the rack tail (sways with the ride in update())
    {
      const base = [x1 + 6, yT - 3], top = [x1 + 2, yT - 104];
      fr += h('g', { 'data-ref': 'bike-pennant', transform: `rotate(0 ${pt(base)})` },
        G('pennant-pole', rod(`M${pt(base)}Q${pt([x1 + 5.2, yT - 60])} ${pt(top)}`, 1, BR, 0.55), Fi(circ(top, 1.8), BRH, 0.7)),
        G('pennant', Fi(`M${pt(add(top, [0.4, 3]))}Q${pt(add(top, [-14, 3]))} ${pt(add(top, [-29, 9]))}Q${pt(add(top, [-15, 13]))} ${pt(add(top, [0.4, 17]))}Z`, RD, 1.1),
          Fp(`M${pt(add(top, [-3, 5.6]))}Q${pt(add(top, [-10, 5.2]))} ${pt(add(top, [-18, 9.4]))}Q${pt(add(top, [-10, 12.2]))} ${pt(add(top, [-3, 12]))}Z`, RDL, { opacity: 0.45 }),
          Fp(`M${pt(add(top, [-6, 9.8]))}Q${pt(add(top, [-10, 6.8]))} ${pt(add(top, [-14, 9.6]))}Q${pt(add(top, [-10, 12.4]))} ${pt(add(top, [-6, 9.8]))}ZM${pt(add(top, [-5.6, 9.8]))}L${pt(add(top, [-3.2, 8]))}L${pt(add(top, [-3.2, 11.6]))}Z`, CR),
          Fp(circ(add(top, [-12.2, 9.2]), 0.5), LN)));
    }
    fr += G('rack-struts', rod(seg(s1a, e1), 1.5, ST, 0.6), Fi(circ(e1, 1.6), BR, 0.6)) + G('rack-struts', rod(seg(s2a, e2), 1.5, ST, 0.6), Fi(circ(e2, 1.4), BR, 0.6));
    let ties = ''; for (let x = x0 - 8; x > x1 + 4; x -= 11) ties += seg([x, yT], [x, yT - 3.6]);
    fr += G('rack', rod(seg([x0, yT], [x1, yT]) + seg([x0 - 4, yT - 3.6], [x1 + 2, yT - 3.6]) + ties + curve([[x1, yT], [x1 - 4.2, yT - 1.6], [x1 - 4.4, yT - 4.6], [x1 + 2, yT - 3.6]], 3) + seg([x0, yT], onSS(SS_LEN - 18.5)), 1.3, ST, 0.55),
      Fi(circ(onSS(SS_LEN - 18.5), 1.4), BR, 0.5),
      G('rack-spring-clip', rod(seg([x1 + 1, yT - 5.6], [-178, yT - 5.6]) + `M${x1 + 1} ${yT - 5.6}Q${x1 - 3} ${yT - 5} ${x1 - 1.6} ${yT - 2.4}`, 1, ST, 0.45), S(`M${x1 + 1.6} ${yT - 3.4}q1 -1.6 2 0q1 1.6 2 0q1 -1.6 2 0`, LS, 0.6)));
    // rolled beach towel (axis along the bike): blue with cream stripes, spiral end, two leather straps
    const tx0 = -176, tx1 = -94, ty0 = yT - 25, ty1 = yT - 2;
    const tw = handPoly([[tx0 + 5, ty0], [tx1 - 3, ty0], [tx1 + 1.5, ty0 + 5], [tx1 + 2, (ty0 + ty1) / 2], [tx1 + 1.5, ty1 - 5], [tx1 - 3, ty1], [tx0 + 5, ty1]], 0.35, 313, 3);
    let stripes = ''; for (let x = tx0 + 9, i = 0; x < tx1 - 6; x += 8.2, i++) if (i % 2 === 0) stripes += poly(wobble([[x, ty0 + 1], [x + 0.6, ty0 + 8], [x + 0.2, ty1 - 8], [x + 0.5, ty1 - 1], [x + 4.4, ty1 - 1], [x + 4.9, ty1 - 8], [x + 4.3, ty0 + 8], [x + 4.3, ty0 + 1]], 0.25, 330 + i));
    let straps = '', buckles = '';
    for (const x of [tx0 + 20, tx1 - 22]) { straps += `M${x} ${ty0 - 0.8}h3.4v${ty1 - ty0 + 3.4}h-3.4Z`; buckles += rrect([x - 0.9, ty0 + 7], [1, 0], 0, 5.2, 0, 4.4, 0.6); }
    let fringe = ''; for (let x = tx0 + 6; x < tx0 + 17; x += 1.8) fringe += `M${f(x)} ${ty1 - 0.2}l${f(-0.6)} 3.4`;
    fr += G('towel', Fi(tw, 'url(#bike-texTowel)', 1.9), h('path', { ...tag('towel-stripes'), d: stripes, fill: CR }),
      S(`M${tx0 + 7} ${ty1 - 4}H${tx1 - 3}`, c('FishDeep'), 1.4, { opacity: 0.45 }),
      Fi(`M${tx0 + 5} ${ty0}Q${tx0 - 1.5} ${(ty0 + ty1) / 2} ${tx0 + 5} ${ty1}Z`, CR, 1.1),
      h('path', { ...tag('towel-spiral'), d: `M${tx0 + 4.4} ${ty0 + 2}Q${tx0 + 0.6} ${(ty0 + ty1) / 2} ${tx0 + 4.4} ${ty1 - 2}M${tx0 + 3.2} ${ty0 + 5.5}Q${tx0 + 1} ${(ty0 + ty1) / 2} ${tx0 + 3.2} ${ty1 - 5.5}` + seg([tx0 + 3.8, ty1 - 0.6], [tx0 + 16, ty1 + 0.3]), fill: 'none', stroke: c('Towel'), 'stroke-width': 1, 'stroke-linecap': 'round' }),
      h('path', { ...tag('towel-fringe'), d: fringe, stroke: CR, 'stroke-width': 0.8, fill: 'none', 'stroke-linecap': 'round' }),
      G('towel-straps', Fi(straps, SA, 0.7), Fi(buckles, BR, 0.5, { 'fill-rule': 'evenodd' }), Fp(Array.from({ length: 2 }, (_, i) => rrect([tx0 + 20.4 + i * (tx1 - tx0 - 42), ty0 + 8.2], [1, 0], 0, 2.6, 0, 2, 0.3)).join(''), LN)));
    // licence plate bolted to the struts: 鹈鹕湾 001
    const cnW = textW('鹈鹕湾', 5.7), nmW = textW('001', 6.2, 0.2), pw = cnW + nmW + 7.6, px0 = -169 - pw / 2, px1 = -169 + pw / 2, py0 = yT + 2.2, py1 = yT + 15;
    fr += G('license-plate', Fi(rrect([px0, py0], [1, 0], 0, px1 - px0, 0, py1 - py0, 1.8), CR, 1.1), S(rrect([px0 + 1.4, py0 + 1.4], [1, 0], 0, px1 - px0 - 2.8, 0, py1 - py0 - 2.8, 1), RD, 0.45));
    const gx = px0 + 3, gy = py1 - 3.1;
    fr += h('path', { ...tag('plate-text-cn'), d: textD('鹈鹕湾', 5.7, ([x, y]) => [gx + x, gy + y * 0.98]).d, fill: RD });
    fr += h('path', { ...tag('plate-number'), d: textD('001', 6.2, ([x, y]) => [gx + cnW + 1.8 + x, gy - 0.1 + y], 0.2, { bob: 0.25 }).d, fill: LN });
    fr += G('plate-bolts', Fi(circ([px0 + 3, py0 + 2.6], 0.95) + circ([px1 - 3, py0 + 2.6], 0.95), BR, 0.4));
    // rear light on the rack tail
    const L0 = [x1 - 9.5, yT + 3.2];
    fr += G('rear-light', Fi(rrect(add(L0, [4, -3.6]), [1, 0], 0, 6.4, 0, 2.4, 0.6), ST, 0.6),
      Fi(`M${pt(add(L0, [5.4, -5]))}Q${pt(add(L0, [-7.4, -5.4]))} ${pt(add(L0, [-6, 2.8]))}Q${pt(add(L0, [-2.2, 9]))} ${pt(add(L0, [5.4, 6.4]))}Z`, CR, 1),
      Fi(`M${pt(add(L0, [3.4, -3.3]))}Q${pt(add(L0, [-5, -3.6]))} ${pt(add(L0, [-4, 2.4]))}Q${pt(add(L0, [-1.2, 6.8]))} ${pt(add(L0, [3.4, 4.8]))}Z`, RD, 0.6),
      S(`M${pt(add(L0, [-2.4, -1.4]))}Q${pt(add(L0, [-3.2, 1.4]))} ${pt(add(L0, [-1.2, 3.6]))}`, c('CoralHi'), 0.8),
      h('g', { 'data-ref': 'bike-rglow', style: 'opacity:var(--pb-n-lampOn)' }, Fp(circ(add(L0, [-1.5, 0.8]), 14), 'url(#bike-rglowG)'), Fp(circ(add(L0, [-1.4, 0.8]), 3), LAMPG)));
  }

  // --- frame tubes: wobbly ink-edged teal ribbons with gouache texture, dry-brush underside, glaze and highlight
  const litSide = u => { const n = perp(u); return (n[0] * 0.45 - n[1]) > 0 ? 1 : -1; };  // +1: the perp(u) edge faces the light
  const ssTop = onST(153);
  // o.extras: [[s along the tube, markup]] nested into the piece that holds s (pinstripe bands, decal), so each piece
  // owns everything painted on it
  function tubeMarkup(A, B, w0, w1, name, np, seed, o = {}) {
    const u = norm(sub(B, A)), Lt = len(sub(B, A)), N = Math.max(6, Math.ceil(Lt / 4));
    const C = Array.from({ length: N + 1 }, (_, i) => lerp2(A, B, i / N));
    const { L, R } = ribbon(C, w0, w1, o.amp ?? 0.28, seed);
    const up = litSide(u), E = up > 0 ? L : R, Dn = up > 0 ? R : L, nUp = mul(perp(u), up), w = (w0 + w1) / 2;
    const SH = Dn.map(p => add(p, mul(nUp, 0.85))), SH2 = Dn.map(p => add(p, mul(nUp, 0.85 + w * 0.27)));
    const H = E.map(p => add(p, mul(nUp, -(w * 0.24 + 0.9)))), RL = E.map(p => add(p, mul(nUp, -1.15)));
    const spans = (o.spans ?? [[0.1, 0.34], [0.4, 0.72], [0.78, 0.9]]).map(([a, b]) => [Math.round(a * N), Math.round(b * N)]);
    const rim = [Math.round(0.14 * N), Math.round(0.86 * N)];
    const cut = (P, a, b) => (b - a >= 1 ? P.slice(a, b + 1) : null);
    let out = '';
    for (let k = 0; k < np; k++) {
      const i0 = Math.floor(k * N / np), i1 = Math.min(N, Math.floor((k + 1) * N / np) + (k < np - 1 ? 1 : 0)), e1 = Math.min(N, Math.floor((k + 1) * N / np));
      const Ls = L.slice(i0, i1 + 1), Rs = R.slice(i0, i1 + 1), P = poly([...Ls, ...Rs.slice().reverse()]);
      const Ds = Dn.slice(i0, i1 + 1);
      const sh = poly([...SH.slice(i0, e1 + 1), ...SH2.slice(i0, e1 + 1).reverse()]);
      const hs = spans.map(([a, b]) => cut(H, Math.max(a, i0), Math.min(b, e1))).filter(Boolean).map(openD).join('');
      const rl = cut(RL, Math.max(rim[0], i0), Math.min(rim[1], e1));
      const ex = (o.extras || []).filter(([sx]) => sx / Lt * N >= i0 && (sx / Lt * N < e1 || k === np - 1)).map(x => x[1]).join('');
      const pl = Q => Q.slice(1).reduce((acc, q, j) => acc + len(sub(q, Q[j])), 0);
      const dash = `${f(pl(Ls))} ${f(len(sub(Rs[Rs.length - 1], Ls[Ls.length - 1])))} ${f(pl(Rs))} ${f(len(sub(Ls[0], Rs[0])) + 1)}`;
      out += G(name, h('path', { ...tag('frame-gouache-texture'), d: P, fill: 'url(#bike-texFrame)', stroke: LN, 'stroke-width': o.lw ?? LW, 'stroke-dasharray': dash, 'stroke-linejoin': 'round' }),
        h('path', { ...tag('frame-shade-glaze'), d: sh, fill: FRL, opacity: 0.8 }),
        k === np - 1 ? Fp(dryBrush(Dn, seed + 17, Math.max(1, Math.round(Lt / 16)), 3, 6, 1, 0.1), LN, { opacity: 0.55 }) : '',
        ex,
        hs ? perSub('frame-highlight', hs, { fill: 'none', stroke: FRH, 'stroke-width': o.hw ?? 1.7, 'stroke-linecap': 'round' }) : '',
        rl && o.rim !== false ? h('path', { ...tag('frame-rim-light'), d: openD(rl), fill: 'none', stroke: RIM, 'stroke-width': 0.8, 'stroke-linecap': 'round', style: 'opacity:var(--pb-n-rimAlpha)' }) : '');
    }
    return { out, L, R, C };
  }
  const paintTubes = list => list.map(t => t.out).join('');
  // rear triangle first
  fr += paintTubes([tubeMarkup(RH, BB, 4.6, 6.2, 'chainstay', 2, 401, { lw: 1.5, hw: 1.2, spans: [[0.12, 0.45], [0.55, 0.85]] }), tubeMarkup(RH, ssTop, 4.2, 5.6, 'seat-stay', 2, 409, { lw: 1.5, hw: 1.2, spans: [[0.1, 0.4], [0.5, 0.86]] })]);
  // frame pump along the seat stay (outboard of it)
  {
    const nS = perp(uSS), o = add(RH, mul(nS, 5.6)), pa = s => add(o, mul(uSS, s));
    fr += G('pump', Fi(rrect(pa(22), uSS, 0, 60, -2.3, 2.3, 1), CR, 1), S(seg(add(pa(26), mul(nS, -1.1)), add(pa(78), mul(nS, -1.1))), CRL, 0.8),
      Fi(rrect(pa(20), uSS, 0, 4.4, -2.6, 2.6, 1.2), ST, 0.7));
    let ribs = ''; for (let s = 83.5; s < 94; s += 1.7) ribs += seg(add(pa(s), mul(nS, -2.6)), add(pa(s), mul(nS, 2.6)));
    fr += G('pump-grip', Fi(rrect(pa(82), uSS, 0, 12.5, -2.9, 2.9, 1.4), SA, 0.9), S(ribs, SAH, 0.5));
    fr += G('pump-hose', rod(splitQ(resample([pa(20), add(pa(17), mul(nS, 1.5)), add(pa(19), mul(nS, 4.6)), add(pa(28), mul(nS, 3.6)), add(pa(34), mul(nS, 2.8))], 3)), 0.9, TY, 0.4), Fi(rrect(add(pa(34), mul(nS, 2.8)), uSS, 0, 3.6, -1.3, 1.3, 0.5), BR, 0.5));
    fr += G('pump-pegs', rod(seg(pa(34), onSS(34)) + seg(pa(86), onSS(86)), 1.2, ST, 0.45));
  }
  // brake bridge + rear calliper (behind the seat tube, over the wheel)
  fr += G('brake-bridge', Fi(rrect(onSS(107.5), uSS, -2.2, 2.2, -3.4, 3.4, 1), FR, 0.8), Fp(circ(onSS(107.5), 1.2), LN));
  const calliper = (bolt, pad, name, bow, ref) => {
    const dir = norm(sub(pad, bolt)), nn = perp(dir), end = add(pad, mul(dir, -1.4));
    const C = quadPts(bolt, add(lerp2(bolt, end, 0.45), mul(nn, 3.6 * bow)), end, 8);
    const Cf = C.map(p => add(p, mul(nn, -1.7 * bow)));
    const anc = add(C[3], mul(nn, 3.2 * bow));
    return h('g', { ...tag(name), 'data-ref': ref }, Fi(taper(Cf, 3.6, 2.2), cf('Steel'), 0.7), S(`M${pt(add(bolt, mul(nn, -3 * bow)))}Q${pt(add(bolt, mul(dir, -3.4)))} ${pt(add(bolt, mul(nn, 3 * bow)))}`, ST, 0.7),
      Fi(taper(C, 4.4, 2.8), ST, 0.8), S(splitQ(C.slice(1, 7).map(p => add(p, mul(nn, 0.9 * bow)))), PA, 0.55),
      Fi(rrect(end, dir, -1, 1.6, -2.2, 2.2, 0.6), ST, 0.5), Fi(hex(bolt, 2.2, 30), BR, 0.5), Fp(circ(bolt, 0.8), LN),
      rod(seg(C[3], anc), 1, ST, 0.4), Fi(circ(anc, 1.3), BR, 0.45));
  };
  const cAnchor = (bolt, pad, bow) => { const dir = norm(sub(pad, bolt)), nn = perp(dir), end = add(pad, mul(dir, -1.4)); return add(quadPts(bolt, add(lerp2(bolt, end, 0.45), mul(nn, 3.6 * bow)), end, 8)[3], mul(nn, 3.2 * bow)); };
  const padAt = (cc, r, a) => G('brake-pads', h('g', { transform: `translate(${pt(pol(cc, r, a))}) rotate(${f(a + 90)})` }, Fi(rrect([0, 0], [1, 0], -4.2, 4.2, -1.4, 1.4, 0.8), TY, 0.5), S('M-3.4 0H3.4', TYH, 0.4)));
  const padRear = angOf(uSS);
  fr += padAt(RH, 89.6, padRear) + calliper(onSS(106.5), pol(RH, 91.5, padRear), 'calliper-rear', -1, 'bike-brake-rear');

  // main triangle
  let decalMk = '';
  // down-tube decal: 鹈鹕 + "Pelican" in slanted serif, painted ON the tube (centred on its axis), cream with a
  // teal-shadow drop, and a painted swash
  {
    const s0 = 58, a = DT_ANG, o = onDT(s0);
    const map = (x, y) => add(o, rot([x, y], a));
    const cn = textD('鹈鹕', 6.2);
    const yb = 2.6, cnd = textD('鹈鹕', 6.2, ([x, y]) => map(x, yb + 0.35 + y * 0.84)).d;
    const lat = textD('Pelican', 6.6, p => p, 0.15, { slant: 0.18 });
    const ld = textD('Pelican', 6.6, ([x, y]) => map(cn.w + 3.4 + x, yb + y), 0.15, { slant: 0.18, bob: 0.25 }).d;
    const sd = textD('Pelican', 6.6, ([x, y]) => map(cn.w + 3.4 + x + 0.5, yb + 0.45 + y), 0.15, { slant: 0.18, bob: 0.25 }).d;
    const end = cn.w + 3.4 + lat.w;
    decalMk = G('decal-latin', Fp(sd, FRL), Fp(ld, CR)) + h('path', { ...tag('decal-cn'), d: cnd, fill: CR });
    decalMk += h('path', { ...tag('decal-flourish'), d: taper([map(cn.w + 3, 3.3), map(cn.w + 3 + lat.w * 0.4, 3.9), map(end + 4, 3.4), map(end + 11, 1.6)], 0.9, 0.2) + taper([map(-2, -2.6), map(-8, -2.2), map(-14, -2.8)], 0.8, 0.1), fill: CR });
  }
  const bandMk = (p, u, w) => h('path', { ...tag('frame-pinstripe-bands'), d: rrect(p, u, -0.6, 0.6, -w / 2, w / 2), fill: CR }) + h('path', { ...tag('frame-pinstripe-bands'), d: rrect(add(p, mul(u, 2)), u, -0.32, 0.32, -w / 2, w / 2), fill: RD });
  const tST = tubeMarkup(BB, STT, 8.4, 8.4, 'seat-tube', 3, 419, { extras: [[137, bandMk(onST(137), mul(uST, -1), 8.4)]] });
  const tDT = tubeMarkup(BB, add(HBB, mul(uDT, 2)), 9.8, 9.8, 'down-tube', 3, 421, { extras: [[44, bandMk(onDT(44), uDT, 9.8)], [70, decalMk], [DT_LEN - 23, bandMk(onDT(DT_LEN - 23), mul(uDT, -1), 9.8)]] });
  const tTT = tubeMarkup(STT, add(HTT, mul(uTT, 2)), 8.4, 8.4, 'top-tube', 3, 431, { extras: [[22, bandMk(onTT(22), uTT, 8.4)], [138, bandMk(onTT(138), mul(uTT, -1), 8.4)]] });
  fr += paintTubes([tST, tDT, tTT]);

  // --- lugs (cream, ink-outlined, red lining): sleeve + spearpoint along a tube
  const lug = (p, dir, s0, s1, w, tip) => {
    const nn = perp(dir), hw = w / 2, q = (s, o) => add(add(p, mul(dir, s)), mul(nn, o));
    const d = `M${pt(q(s0, hw))}L${pt(q(s1, hw))}Q${pt(q(s1 + tip * 0.55, hw * 0.78))} ${pt(q(s1 + tip, 0))}Q${pt(q(s1 + tip * 0.55, -hw * 0.78))} ${pt(q(s1, -hw))}L${pt(q(s0, -hw))}Z`;
    const line = `M${pt(q(s1 - 1.2, hw - 1.1))}Q${pt(q(s1 + tip * 0.45, hw * 0.5))} ${pt(q(s1 + tip - 2.4, 0))}Q${pt(q(s1 + tip * 0.45, -hw * 0.5))} ${pt(q(s1 - 1.2, -(hw - 1.1)))}`;
    return [d, tip > 1 ? line : ''];
  };
  const LUGS = {
    'lug-seat': [lug(STT, mul(uST, -1), -3.4, 9, 11, 8), lug(STT, uTT, 2, 10, 11, 8)],
    'lug-head-top': [lug(HTT, mul(uTT, -1), 1.5, 9, 11, 8.5), lug(HTT, uHT, -2.8, 10, 13.2, 0.01)],
    'lug-head-bottom': [lug(HBB, mul(uDT, -1), 1, 10, 12.2, 9), lug(HBB, mul(uHT, -1), -2.8, 9, 13.2, 0.01)],
    'bb-lug-points': [lug(BB, uDT, 0, 30, 12.2, 9), lug(BB, uST, 0, 30, 11, 8.5), lug(BB, mul(uCS, -1), 0, 29, 8.6, 7)],
  };
  // head tube (between its lugs): a short teal ribbon
  { const t = tubeMarkup(add(HTT, mul(uHT, -1)), add(HBB, mul(uHT, 1)), 10.6, 10.6, 'head-tube', 1, 437, { spans: [[0.15, 0.85]], rim: false }); fr += paintTubes([t]); }
  for (const [name, parts] of Object.entries(LUGS)) {
    const ln = parts.map(p => p[1]).join('');
    fr += G(name, Fi(parts.map(p => p[0]).join(''), 'url(#bike-texCream)', 1.3),
      ln ? h('path', { ...tag('lug-lining'), d: ln, fill: 'none', stroke: RD, 'stroke-width': 0.7, 'stroke-linecap': 'round' }) : '');
  }
  fr += G('bb-shell', Fi(circ(BB, 7.4), CR, 1.3), Fp(ringD(BB, 4.6, 5.6), CRL, { 'fill-rule': 'evenodd' }));
  // seat-stay wrap-over caps + seat binder bolt
  fr += G('seat-stay-caps', Fi(`M${pt(add(ssTop, rot([-3.4, -3.6], SS_ANG)))}Q${pt(add(ssTop, rot([4.8, 0], SS_ANG)))} ${pt(add(ssTop, rot([-3.4, 3.6], SS_ANG)))}Z`, CR, 0.9), S(seg(add(ssTop, rot([-2.4, -2.2], SS_ANG)), add(ssTop, rot([-2.4, 2.2], SS_ANG))), RD, 0.55));
  const binder = add(onST(152), mul(nST, -6.6));
  fr += G('seat-binder-bolt', Fi(rrect(add(onST(149), mul(nST, -4.2)), uST, 0, 7.6, -3.3, 0, 1), CR, 0.8), Fi(hex(binder, 2, 15), BR, 0.6), Fp(circ(binder, 0.7), LN));
  // head badge (on the head tube): brass shield with a pelican emblem and two rivets
  {
    const cc = onHT(HT_LEN * 0.47), a = HT_ANG - 90;
    const sh = 'M-4 -9L4 -9L4.6 -8.2L4.6 3.5Q4.6 7 0 10.2Q-4.6 7 -4.6 3.5L-4.6 -8.2Z';
    const inner = 'M-3 -7.5L3 -7.5L3.4 -7L3.4 3.1Q3.4 5.8 0 8.4Q-3.4 5.8 -3.4 3.1L-3.4 -7Z';
    const pel = 'M-2 -1.4Q-2.4 -4.4 -0.2 -4.9Q1.4 -5.1 1.8 -3.8L3.1 -3.2L1.7 -2.4Q0.4 -1.2 0.9 1.2Q1.2 3.2 -0.6 4.8Q-2.2 3.2 -2 -1.4Z';
    fr += h('g', { transform: `translate(${pt(cc)}) rotate(${f(a)})` },
      G('head-badge', Fi(sh, BR, 1), Fp(inner, FRL), Fp('M-3 -7.5L3 -7.5L3.4 -7L3.4 -4.8L-3.4 -4.8L-3.4 -7Z', RD), S('M-2.6 5.6Q0 7.8 2.6 5.6', BRH, 0.6)),
      G('head-badge-pelican', Fp(pel, PA), Fp('M1.7 -2.4L3.1 -3.2Q1.6 -0.6 0.4 -1.3Z', c('Coral')), Fp(circ([0.35, -3.7], 0.38), LN)),
      G('head-badge-rivets', Fi(circ([0, -6.2], 0.8) + circ([0, 7.3], 0.8), BRH, 0.35)));
  }
  // bottle cage + cream enamel bottle on the seat tube
  {
    const off = 15.6, o = add(BB, mul(nST, off)), q = (s, y) => add(add(o, mul(uST, s)), mul(nST, y));
    const bot = `M${pt(q(42, -9.2))}L${pt(q(88, -9.2))}Q${pt(q(95, -9.2))} ${pt(q(97, -4.4))}L${pt(q(97, 4.4))}Q${pt(q(95, 9.2))} ${pt(q(88, 9.2))}L${pt(q(42, 9.2))}Q${pt(q(38.6, 9.2))} ${pt(q(38.6, 5.4))}L${pt(q(38.6, -5.4))}Q${pt(q(38.6, -9.2))} ${pt(q(42, -9.2))}Z`;
    let bparts = '';
    bparts += G('bottle-label', Fp(`M${pt(q(56, -9.2))}L${pt(q(78, -9.2))}L${pt(q(78, 9.2))}L${pt(q(56, 9.2))}Z`, FR), S(seg(q(56, -9.2), q(56, 9.2)) + seg(q(78, -9.2), q(78, 9.2)), LN, 0.7),
      Fp(`M${pt(q(61, -3))}Q${pt(q(67, -5.4))} ${pt(q(72.5, 0))}Q${pt(q(67, 5.4))} ${pt(q(61, 3))}ZM${pt(q(61.5, 0))}L${pt(q(58.2, -3))}L${pt(q(58.2, 3))}Z`, CR), Fp(circ(q(70.2, -0.8), 0.65), LN));
    let rid = ''; for (let s = 99; s < 105.6; s += 1.6) rid += seg(q(s, -4.6), q(s, 4.6));
    bparts += G('bottle-cap', Fi(rrect(q(97, 0), uST, 0, 9.4, -4.6, 4.6, 1.2), RD, 0.9), S(rid, RDL, 0.5), Fi(rrect(q(106.2, 0), uST, 0, 2.6, -2.2, 2.2, 0.8), CR, 0.6));
    fr += G('bottle', Fi(bot, 'url(#bike-texCream)', 1.4), S(seg(q(44, -6.4), q(88, -6.4)), CRL, 1.4), S(seg(q(44, 6.4), q(86, 6.4)), PA, 1), bparts,
      G('bottle-cage', rod(`M${pt(q(47, -10.2))}L${pt(q(84, -10.2))}Q${pt(q(89, -10.2))} ${pt(q(89, -6))}M${pt(q(47, 10.2))}L${pt(q(82, 10.2))}M${pt(q(41, -10.2))}Q${pt(q(36.8, -10.2))} ${pt(q(36.8, -4))}L${pt(q(36.8, 5))}Q${pt(q(36.8, 10.2))} ${pt(q(42, 10.2))}` + seg(q(52, -10.2), onST(52)) + seg(q(80, -10.2), onST(80)), 1, ST, 0.5),
      Fi(circ(onST(52), 1.3) + circ(onST(80), 1.3), BR, 0.5)));
  }
  // rear dropout plate (under the cog)
  fr += G('dropout-rear', Fi(`M${pt(onSS(15))}L${pt(add(onSS(15), mul(perp(uSS), -3)))}Q${pt(add(RH, [-10, -3]))} ${pt(add(RH, [-9.5, 3.2]))}Q${pt(add(RH, [-4, 9.4]))} ${pt(add(onCS(14), mul(perp(uCS), 2.6)))}L${pt(onCS(14))}Q${pt(add(RH, [5, -4]))} ${pt(onSS(15))}Z`, CR, 1.1),
    Fp(rrect(add(RH, [-7, 0]), [1, 0], 0, 7, -1.9, 1.9, 1.9), LS), Fi(circ(eyeR, 1.7), CR, 0.6), Fp(circ(eyeR, 0.7), LN));
  // rear brake housing along the top tube with clips, into the rear calliper (cream housing, ink-lined)
  {
    const top = (s, off) => add(onTT(s), mul(perp(uTT), -off));
    fr += G('brake-housing-rear', rod(splitQ(resample([top(150, 5.8), top(110, 5.8), top(60, 5.8), top(14, 5.8), top(4, 7.2), add(STT, [-9, -3]), add(STT, [-16, 9]), onSS(116), onSS(112)], 3)), 1.3, CR, 0.55));
    fr += [128, 76, 26].map(s => G('cable-clips', Fi(rrect(onTT(s), uTT, -1.3, 1.3, -7.6, 4.8, 0.6), ST, 0.55), Fp(circ(add(onTT(s), mul(perp(uTT), 3.7)), 0.8), LN))).join('');
    fr += G('cable-ferrules', Fi(rrect(onSS(112.8), mul(uSS, -1), 0, 2.4, -1.3, 1.3, 0.4), ST, 0.4), S(seg(onSS(110.4), add(onSS(106.5), mul(perp(uSS), 2.6))), STL, 0.6));
  }
  // lamp wire from the dynamo, along the down tube and chainstay to the rear lamp (clipped)
  fr += G('lamp-wire', S(splitQ(resample([add(onDT(DT_LEN - 30), mul(perp(uDT), 5.6)), add(onDT(90), mul(perp(uDT), 5.6)), add(onDT(40), mul(perp(uDT), 5.6)), add(BB, [-2, 12.6]), add(onCS(60), mul(perp(uCS), -3.8)), add(onCS(16), mul(perp(uCS), -3.8)), add(RH, [-1, -7.5]), lerp2(add(RH, [0.8, -6.8]), [-147.6, -214.5], 0.5), [-147.6, -213.6], [-176, -213.8], [-196, -213.8]], 3)), LS, 0.8),
    Fi([onDT(120), onDT(70)].map(p => circ(add(p, mul(perp(uDT), 5.6)), 1)).join(''), CR, 0.4));
  // seatpost, clamp, saddle
  fr += G('seatpost', rod(seg(STT, SCL), 4.4, ST, 0.9), S(seg(add(STT, mul(nST, 1)), add(SCL, mul(nST, 1))), PA, 0.8));
  {
    // little leather saddlebag hanging from the loops (behind the springs)
    fr += G('saddlebag', Fi(handPoly([[-101, -272], [-80, -273.4], [-79, -262], [-81, -256], [-99, -255.4], [-102, -261]], 0.3, 337, 2.5), 'url(#bike-texLeather)', 1.3),
      Fi('M-101.6 -272.2L-79.6 -273.6L-80 -266.4Q-90 -264.6 -101.4 -266Z', SAH, 0.9), S('M-99.6 -257.6Q-90 -257 -81.4 -258', CR, 0.5, { 'stroke-dasharray': '1 1.2' }),
      Fi(rrect([-92.6, -268.2], [1, 0], 0, 3.6, 0, 7.4, 0.5), SA, 0.6), Fi(rrect([-93.4, -263.4], [1, 0], 0, 5.2, 0, 3.6, 0.6), BR, 0.5), Fp(rrect([-92.2, -262.6], [1, 0], 0, 2.6, 0, 2, 0.3), SA));
    // sprung leather saddle (B67-style): rails loop under two big coil springs that carry the cantle
    const railPts = [[-28.5, -282.2], [-42, -277.8], [-60.5, -275], [-78, -270.8], [-90.5, -267], [-98.5, -266.5], [-102.8, -267.6], [-103.8, -270.6]];
    fr += G('saddle-rails', S(curve(railPts.map(p => add(p, [-2.6, -1.2])), 3), cf('Steel'), 1.4), rod(curve(railPts, 3), 1.4, ST, 0.5));
    const coil = (x, yb, yt, w, turns) => {
      const st = (yb - yt) / turns; let front = '', back = '';
      for (let i = 0; i < turns; i++) { const y = yt + st * i; front += seg([x - w, y + st * 0.05], [x + w, y + st * 0.55]); back += seg([x + w, y + st * 0.55], [x - w, y + st * 1.05]); }
      return [front, back];
    };
    const cfar = coil(-98.6, -267, -279.4, 3, 5), cn = coil(-90.6, -266.8, -279.6, 3.4, 5);
    fr += G('saddle-springs', S(cfar[0], cf('SteelLo'), 1.1), S(cn[1], STL, 0.9), rod(cn[0], 1.1, ST, 0.45), Fi(rrect([-94.6, -280.6], [1, 0], 0, 8, 0, 1.6, 0.6) + rrect([-94.6, -267.4], [1, 0], 0, 8, 0, 1.8, 0.6), ST, 0.5));
    fr += G('seat-clamp', Fi(rrect([-60.5, -276], [1, 0], -5.2, 5.2, -3, 3.8, 1.2), ST, 0.8), Fi(hex([-60.5, -275.4], 2, 0), BR, 0.5), Fp(circ([-60.5, -275.4], 0.7), LN));
    // leather: domed top, rolled skirt flaring at the cantle, painted grain, sheen, stitching
    const top = 'M-22.2 -284.2Q-24 -286.4 -33 -287.1Q-50 -288 -64 -287.9Q-86 -287.8 -100.2 -288.8Q-104.4 -288.8 -104.2 -284.6Q-103.8 -279.8 -99.4 -278.8Q-92 -278.4 -84 -279.4Q-66 -281.6 -46 -281.9Q-31 -282 -24.2 -282.4Q-21.6 -283 -22.2 -284.2Z';
    fr += G('saddle', Fi(top, 'url(#bike-texLeather)', LW), Fp('M-34 -282.4L-25 -282.8L-25.6 -280.8L-33.4 -280.6Z', BR), Fp(hex([-30.6, -280], 1.2, 0), LN),
      S('M-100 -280.6Q-92 -280.2 -84 -281.1Q-66 -283.1 -46 -283.4Q-32 -283.5 -25 -283.6', LN, 0.7, { opacity: 0.6 }));
    fr += G('saddle-sheen', S('M-98.4 -286.6Q-84 -286.3 -64 -286.4Q-46 -286.3 -32 -285.5', SAH, 1.5), S('M-92 -286.8Q-80 -286.7 -70 -286.8', c('WickerHi'), 0.8, { opacity: 0.8 }));
    fr += G('saddle-stitching', S('M-101.4 -281.8Q-92 -281.3 -84 -282.2Q-66 -284.2 -46 -284.5Q-33 -284.6 -26 -284.6', CR, 0.5, { 'stroke-dasharray': '0.9 1.2' }));
    fr += G('saddle-cantle-plate', Fi('M-104 -280.2Q-102.6 -277.2 -97.6 -277.4L-84 -278.2L-84.2 -276.8L-97.8 -276Q-103.4 -276.2 -104.6 -279.4Z', ST, 0.6));
    const rv = [[-102.2, -284.2], [-99.6, -281.4], [-95.6, -280.4], [-91.4, -280.3], [-87.2, -280.7], [-27.4, -284.6]];
    fr += G('saddle-rivets', Fi(rv.map(p => circ(p, 1.15)).join(''), BR, 0.4), Fp(rv.map(p => circ(add(p, [-0.3, -0.35]), 0.42)).join(''), BRH));
    fr += G('saddle-bag-loops', S('M-96 -276.4q0.2 3 2.8 3M-86.4 -277.4q0.2 3 2.8 3', SAH, 1.1));
  }
  fr += anchor('rearHub', RH) + anchor('frontHub', FH) + anchor('bb', BB) + anchor('saddleTop', BIKE.saddleTop);
  slots.frame = fr;

  // ============================================================ FORK + front fittings (rider space, static)
  let fk = '';
  // headset: bottom cup, top cup, lock ring, knurled locknut
  fk += G('headset-cups', Fi(rrect(HBB, uHT, 0.2, 3.6, -6.6, 6.6, 0.8), ST, 0.8), Fi(rrect(HTT, uHT, -3.4, 0, -6.6, 6.6, 0.8), ST, 0.8), Fi(rrect(HTT, uHT, -4.4, -3.4, -5.6, 5.6), STL, 0.5));
  {
    let kn = ''; for (let y = -5; y <= 5; y += 1.25) kn += seg(add(onHT(-8.6), mul(perp(uHT), y)), add(onHT(-4.8), mul(perp(uHT), y)));
    fk += G('headset-knurl', Fi(rrect(HTT, uHT, -8.8, -4.4, -6, 6, 0.6), ST, 0.7), S(kn, STL, 0.5));
  }
  // fork blade (teal, ink-outlined, wobbly) along the raked centreline + cream crown
  {
    const n = FORK_C.length, { L, R } = ribbon(FORK_C, 7.6, 4.8, 0.25, 443, 20), k = 9;
    const pl = Q => Q.slice(1).reduce((acc, q, j) => acc + len(sub(q, Q[j])), 0);
    const nrm = (A, i) => perp(norm(sub(A[Math.min(i + 1, A.length - 1)], A[Math.max(i - 1, 0)])));
    const Hl = FORK_C.map((p, i) => add(p, mul(nrm(FORK_C, i), -lerp(1.7, 1, i / (n - 1)))));
    const Sg = FORK_C.map((p, i) => add(p, mul(nrm(FORK_C, i), lerp(2, 1.3, i / (n - 1)))));
    for (const [i0, i1] of [[0, k + 1], [k, n - 1]]) {
      const Ls = L.slice(i0, i1 + 1), Rs = R.slice(i0, i1 + 1), P = poly([...Ls, ...Rs.slice().reverse()]);
      const a0 = Math.max(1, i0), a1 = Math.min(n - 3, i1);
      fk += h('g', { ...tag('fork-blade'), 'data-ref': i0 ? 'bike-forkLo' : 'bike-forkHi' }, h('path', { ...tag('frame-gouache-texture'), d: P, fill: 'url(#bike-texFrame)', stroke: LN, 'stroke-width': 1.6, 'stroke-dasharray': `${f(pl(Ls))} ${f(len(sub(Rs[Rs.length - 1], Ls[Ls.length - 1])))} ${f(pl(Rs))} ${f(len(sub(Ls[0], Rs[0])) + 1)}` }),
        h('path', { ...tag('frame-shade-glaze'), d: taper(Sg.slice(a0, a1 + 1), lerp(1.8, 1.1, a0 / n), lerp(1.8, 1.1, a1 / n)), fill: FRL, opacity: 0.8 }),
        h('path', { ...tag('frame-highlight'), d: splitQ(Hl.slice(a0, a1)), fill: 'none', stroke: FRH, 'stroke-width': 1.3, 'stroke-linecap': 'round' }));
    }
  }
  fk += G('fork-crown', Fi(`M${pt(add(axis(3.6), mul(nHTf, -7.4)))}L${pt(add(axis(3.6), mul(nHTf, 7.4)))}Q${pt(add(axis(7.5), mul(nHTf, 7.2)))} ${pt(add(axis(11), mul(nHTf, 3.9)))}L${pt(add(axis(11), mul(nHTf, -3.9)))}Q${pt(add(axis(7.5), mul(nHTf, -7.2)))} ${pt(add(axis(3.6), mul(nHTf, -7.4)))}Z`, CR, 1.2),
    Fp(`M${pt(axis(8.6))}q-1.2 -1.6 -2.2 -0.4q-0.8 1 2.2 2.8q3 -1.8 2.2 -2.8q-1 -1.2 -2.2 0.4Z`, RD), S(`M${pt(add(axis(4.8), mul(nHTf, -5.4)))}Q${pt(axis(9.8))} ${pt(add(axis(4.8), mul(nHTf, 5.4)))}`, RD, 0.55));
  {
    const fa = angOf(sub(FH, FORK_C[FORK_C.length - 3])), q = p => add(FH, rot(p, fa));
    fk += G('fork-end', Fi(`M${pt(q([-7.5, -2.8]))}L${pt(q([2.2, -3.4]))}Q${pt(q([5.8, 0]))} ${pt(q([2.2, 3.4]))}L${pt(q([-7.5, 2.4]))}Z`, CR, 1),
      Fi(circ(eyeF, 1.6), CR, 0.5), Fp(circ(eyeF, 0.65), LN), G('axle-nut-front', Fi(hex(FH, 3.4, 0), ST, 0.7), Fp(hex(FH, 2, 30), STL), Fp(circ(FH, 0.9), LN)));
  }
  // bottle dynamo on the blade, roller on the sidewall
  {
    const ad = -110, dv = [Math.cos(ad * D2R), Math.sin(ad * D2R)], q = (r, y) => add(add(FH, mul(dv, r)), mul(perp(dv), y));
    const body = `M${pt(q(68, -3.6))}L${pt(q(84, -2.7))}Q${pt(q(88.8, -2.3))} ${pt(q(89.2, 0))}Q${pt(q(88.8, 2.3))} ${pt(q(84, 2.7))}L${pt(q(68, 3.6))}Q${pt(q(66.8, 0))} ${pt(q(68, -3.6))}Z`;
    const bl = axis(len(sub(q(78, 0), HBB)) * 0.96);
    fk += G('dynamo-bracket', rod(seg(q(77, 0), add(bl, mul(nHTf, 2.6))), 1.6, ST, 0.5), Fi(rrect(bl, uHT, -2.4, 2.4, -4.4, 4.4, 1), ST, 0.6), Fp(circ(add(bl, mul(nHTf, 1.2)), 0.8), LN));
    fk += G('dynamo', Fi(body, ST, 1), Fp(`M${pt(q(71.5, -3.5))}L${pt(q(74.2, -3.3))}L${pt(q(74.2, 3.3))}L${pt(q(71.5, 3.5))}Z`, RD), S(seg(q(76, -1.5), q(86, -1.2)), PA, 0.7), Fi(rrect(q(65.6, 0), dv, 0, 2.6, -2.4, 2.4, 0.8), TY, 0.5));
    const rc = q(92.2, 0);
    let knurl = ''; for (let i = 0; i < 12; i++) knurl += seg(pol(rc, 1.2, i * 30), pol(rc, 2.3, i * 30));
    fk += G('dynamo-roller', Fi(circ(rc, 2.6), STL, 0.5), h('g', { 'data-ref': 'bike-roller', transform: `rotate(0 ${pt(rc)})` }, S(knurl, PA, 0.45)));
    fk += S(splitQ(resample([q(65.8, 0), q(60, 3.5), add(axis(40), mul(nHTf, 6)), add(axis(20), mul(nHTf, 8.5)), [132, -209.5]], 3)), LS, 0.8);
  }
  // front calliper at the crown, pads on the brake track where the blade crosses the rim
  {
    const padA = angOf(sub(axisAtR(89.5), FH));
    fk += padAt(FH, 89.6, padA) + calliper(add(axis(6.5), mul(nHTf, 5.5)), pol(FH, 91.6, padA), 'calliper-front', 1, 'bike-brake-front');
  }
  // ---- basket with fish (fish first, the wicker in front of them)
  {
    const { x0, x1, y0, y1 } = BIKE.basket, inset = 5;
    const xl = y => lerp(x0, x0 + inset, (y - y0) / (y1 - y0)), xr = y => lerp(x1, x1 - inset, (y - y0) / (y1 - y0));
    // stays to the axle + back bracket to the crown (carries the lamp too) + leather straps to the bar
    fk += G('basket-stays', rod(seg([x0 + 9, y1 - 1], add(FH, [-1.6, -3])) + seg([x1 - 9, y1 - 1], add(FH, [2.6, -3])) + seg([x0 + 6, y1 - 2], add(axis(7), mul(nHTf, 3))), 1.3, ST, 0.55),
      Fi(circ([x0 + 9, y1 - 1], 1.3) + circ([x1 - 9, y1 - 1], 1.3), BR, 0.5));
    // fish: storybook fish, ink-outlined, with painted scales, pale bellies and big kind eyes
    const eye = (x, y, r) => G('fish-eyes', Fi(circ([x, y], r), PA, 0.7), Fp(circ([x + r * 0.18, y + r * 0.05], r * 0.58), LN), Fp(circ([x + r * 0.42, y - r * 0.3], r * 0.22), PA));
    const scales = (x0s, x1s, yA, yB, rr, cols, rows, lim, ink) => {
      let sc = '';
      for (let r = 0; r < rows; r++) for (let cI = 0; cI < cols; cI++) {
        const x = lerp(x0s, x1s, (cI + (r % 2) * 0.5) / cols), y = lerp(yA, yB, rows > 1 ? r / (rows - 1) : 0.5);
        if (lim(x, y)) sc += `M${f(x - rr)} ${f(y)}Q${f(x)} ${f(y + rr * 1.25)} ${f(x + rr)} ${f(y)}`;
      }
      return h('path', { ...tag('fish-scales'), d: sc, fill: 'none', stroke: ink, 'stroke-width': 0.6, 'stroke-linecap': 'round' });
    };
    const inBody = (L, H) => (x, y) => Math.abs(y) < H * Math.sqrt(Math.max(0, 1 - (x / L) ** 2)) - 1.4;
    const fishArt = kind => {
      const art = []; let spec = '';
      if (kind === 'mackerel') {
        const body = 'M27 0C22 -7 10 -9.4 -2 -8.4C-12 -7.4 -19 -4 -22 -1.2L-22 1.2C-19 4 -12 7.2 -2 8C10 8.8 22 6.4 27 0Z';
        spec = 'fish-mackerel';
        art.push(G('fish-fins', Fi('M-2 -8.2L1.6 -13.4L4 -12.2L6.4 -8.4Z', c('FishBlue'), 0.8), Fi('M6 7.6L3.2 12L0.2 8Z', c('FishBlue'), 0.8), S('M1 -8.6L2.2 -12.2M3.4 -8.4L3.6 -11.8', c('FishDeep'), 0.4)));
        art.push(h('g', {}, Fi(body, c('FishBlue'), 1.2)));
        art.push(h('path', { ...tag('fish-belly-sheen'), transform: 'scale(0.93)', d: 'M27 0C22 5 10 8.4 -2 8C-12 7.4 -18 4.4 -22 1.2C-14 3.2 0 4.6 12 3.6C19 3 24 1.6 27 0Z', fill: c('FishBelly') }));
        art.push(G('fish-mackerel-stripes', S('M-16 -5Q-13 -2.6 -15 0M-11 -6.8Q-7.4 -3.4 -10 0.2M-6 -7.8Q-2 -4 -4.8 0.4M-0.6 -8.2Q3 -4.4 0.8 0.2M4.8 -8.3Q8 -4.6 6.2 -0.4M10 -7.9Q12.6 -4.6 11.4 -1.2', c('FishDeep'), 1.1)));
        art.push(scales(-14, 14, 1.6, 4.6, 1.2, 9, 2, inBody(24, 8.4), c('Silver')));
        art.push(G('fish-lateral-line', S('M-18 -0.6Q0 -3.4 16 -1.2', c('FishBelly'), 0.55, { opacity: 0.8 })));
        art.push(G('fish-gills', S('M17.6 -5.4Q14.6 -1 17 4.4', LN, 0.9), S('M24.4 1.4Q26 1.9 27 0.9', LN, 0.6)));
        art.push(eye(21.2, -2.4, 2.6));
        art.push(G('fish-mouths', S('M27 0.3L23.2 1.4', LN, 0.7)));
        art.push(h('g', { 'data-ref': 'bike-tailA', transform: 'rotate(0 -21 0)' }, G('fish-tails', Fi('M-20.5 0L-30.6 -9.6Q-28 -2 -30 0.2Q-28 2.4 -30.6 9.8Z', c('FishBlue'), 1), S('M-22 0L-28.4 -6.4M-22 0L-28.6 6.6M-22 0L-28.8 0', c('FishDeep'), 0.5))));
      } else if (kind === 'snapper') {
        const body = 'M24 0C20 -8 8 -11.4 -4 -10.6C-12 -10 -17 -6 -19.6 -1.6L-19.6 1.6C-17 6 -12 9.6 -4 10C8 10.6 20 7 24 0Z';
        spec = 'fish-snapper';
        art.push(G('fish-fins', Fi('M-10 -10L-7 -15.6L-3 -14.4L1 -16L4 -13.8L8 -10.8Z', c('Coral'), 0.8), S('M-7 -10.8L-6.6 -14.6M-3 -11L-2.2 -14.2M1 -11L1.4 -14.8', RDL, 0.45), Fi('M6 9.4L3 13.6L0 9.8Z', c('Coral'), 0.8)));
        art.push(h('g', {}, Fi(body, c('Coral'), 1.2)));
        art.push(h('path', { ...tag('fish-belly-sheen'), transform: 'scale(0.93)', d: 'M24 0C20 6 8 9.6 -4 10C-12 9.6 -16 6.4 -19.6 1.6C-10 4.6 4 5.6 14 3.8C19 3 22 1.6 24 0Z', fill: c('CoralHi') }));
        art.push(scales(-13, 13, -7, 2, 1.8, 7, 4, inBody(22, 10.4), RDL));
        art.push(G('fish-lateral-line', S('M-16 -1.5Q0 -5.4 14 -2.4', c('CoralHi'), 0.6)));
        art.push(G('fish-gills', S('M15.4 -6.6Q12.4 -1 15 5.6', LN, 0.9)));
        art.push(eye(18.4, -3, 2.7));
        art.push(G('fish-mouths', S('M24 0.2L19.8 1.9', LN, 0.7)));
        art.push(h('g', { 'data-ref': 'bike-tailB', transform: 'rotate(0 -19 0)' }, G('fish-tails', Fi('M-18.6 0L-29 -9.4Q-26.4 0 -29 9.4Z', c('Coral'), 1), S('M-20 0L-26.6 -6M-20 0L-26.6 6M-20 0L-27 0', RDL, 0.5))));
      } else {
        const body = 'M20 0C17 -4.6 7 -6.2 -3 -5.6C-10 -5.2 -14 -3 -16 -0.8L-16 0.8C-14 3 -10 5 -3 5.4C7 6 17 4.4 20 0Z';
        spec = 'fish-sardine';
        art.push(G('fish-fins', Fi('M-1 -5.4L2 -9L5 -5.6Z', c('FishBlue'), 0.7)));
        art.push(h('g', {}, Fi(body, c('Silver'), 1), Fp('M20 0C17 -4.6 7 -6.2 -3 -5.6C-10 -5.2 -14 -3 -16 -0.8C-8 -2.4 4 -2.8 20 0Z', c('FishBlue'))));
        art.push(scales(-10, 11, 0.8, 2.6, 1, 8, 2, inBody(18, 5.6), c('FishBlue')));
        art.push(G('fish-sardine-spots', Fp(circ([8.4, -1.8], 0.75) + circ([4.4, -1.4], 0.65) + circ([0.6, -1.2], 0.6) + circ([-3, -1], 0.55), c('FishDeep'))));
        art.push(G('fish-lateral-line', S('M-12 0.6Q2 -0.2 13 0.4', c('FishBlue'), 0.5)));
        art.push(G('fish-gills', S('M13.6 -3.6Q11.4 0 13.4 3.6', LN, 0.8)));
        art.push(eye(15.8, -1.2, 2));
        art.push(G('fish-mouths', S('M20 0.2L17.2 1.1', LN, 0.6)));
        art.push(h('g', { 'data-ref': 'bike-tailC', transform: 'rotate(0 -15.5 0)' }, G('fish-tails', Fi('M-15 0L-23 -6.6Q-21 0 -23 6.6Z', c('Silver'), 0.9), S('M-16 0L-21.4 -4M-16 0L-21.4 4', c('FishBlue'), 0.45))));
      }
      return G(spec, art.join(''));
    };
    // newspaper lining the basket (behind the fish), torn edge above the rim
    {
      const top = [], nx = 14; for (let i = 0; i <= nx; i++) { const x = lerp(x0 + 3, x1 - 3, i / nx); top.push([x, y0 - 7 - (i % 2 ? 3.4 : 0) - 2.2 * Math.sin(i * 1.7)]); }
      const paper = poly([...top, [x1 - 3, y0 + 4], [x0 + 3, y0 + 4]]);
      let pr = ''; for (let cI = 0; cI < 6; cI++) for (let r = 0; r < 2; r++) { const xa = x0 + 8 + cI * 12.4, ya = y0 - 6.2 + r * 2.4; pr += `M${f(xa)} ${f(ya)}h${f(8.6 - (r + cI) % 3 * 1.6)}`; }
      fk += G('newspaper-liner', Fp(paper, c('News')), S(openD(top), LS, 0.8), h('path', { ...tag('newspaper-print'), d: pr + `M${x0 + 20} ${y0 - 9.6}h12`, stroke: STL, 'stroke-width': 0.8, fill: 'none', 'stroke-linecap': 'round' }));
    }
    fk += h('g', { 'data-ref': 'bike-fish' },
      h('g', { transform: `translate(${x0 + 20} ${y0 - 29}) rotate(-106) scale(1.3)` }, h('g', {}, fishArt('mackerel'))),
      h('g', { transform: `translate(${x1 - 21} ${y0 - 24}) rotate(126) scale(1.3)` }, fishArt('snapper')),
      h('g', { 'data-ref': 'bike-fishC', transform: `translate(${(x0 + x1) / 2 + 4} ${y0 - 8}) rotate(-10) scale(1.3)` }, h('g', { id: 'bike-fishC-art' }, fishArt('sardine'))));
    // the wicker: body, over-under weave, braided rim, base band, all with wobbly brown-ink edges
    const bodyP = [[x0, y0], [x1, y0], [x1 - inset, y1], [x0 + inset, y1]], bodyD = handPoly(bodyP, 0.35, 353, 3);
    const bodySides = bodyP.map((a, i) => openD(wobble(densify([a, bodyP[(i + 1) % 4]], 3), 0.35, 353 + i, 14))).join('');
    let bk = h('g', { 'data-ref': 'bike-basket' }, Fp(bodyD, WKL));
    const rows = 11, cols = 12, ry0 = y0 + 5.2, ry1 = y1 - 5.2, rh = (ry1 - ry0) / rows;
    let pills = '', rods = '', lit = '', shd = '';
    for (let i = 0; i < rows; i++) {
      const ya = ry0 + i * rh, yb = ya + rh, ym = (ya + yb) / 2, xa0 = xl(ym), xa1 = xr(ym), sp = (xa1 - xa0) / cols;
      for (let j = -1; j <= cols; j++) {
        const xc = xa0 + (j + 0.5) * sp, jig = 0.25 * (hash(i * 31 + j) - 0.5);
        if ((i + j) % 2 === 0) {
          const L = Math.max(xa0 + 0.6, xc - sp * 0.62), Rr = Math.min(xa1 - 0.6, xc + sp * 0.62);
          if (Rr - L < 1.5) continue;
          pills += rrect([L, ya + 0.45 + jig], [1, 0], 0, Rr - L, 0, rh - 0.9, (rh - 0.9) / 2);
          lit += `M${f(L + 1.4)} ${f(ya + 1.3 + jig)}Q${f((L + Rr) / 2)} ${f(ya + 0.75 + jig)} ${f(Rr - 1.4)} ${f(ya + 1.3 + jig)}`;
          shd += `M${f(L + 1.6)} ${f(yb - 1.1 + jig)}Q${f((L + Rr) / 2)} ${f(yb - 0.6 + jig)} ${f(Rr - 1.6)} ${f(yb - 1.1 + jig)}`;
        } else if (j >= 0 && j < cols) rods += rrect([xc - 1.25, ya + 0.2], [1, 0], 0, 2.5, 0, rh - 0.4, 1.1);
      }
    }
    bk += G('basket-weave', Fp(rods, WKH), Fp(pills, WK, { stroke: WKL, 'stroke-width': 0.4 }), S(lit, WKH, 0.7), S(shd, c('WickerLo'), 0.7));
    { let wr = ''; for (let t = 0.08; t < 0.95; t += 0.09) for (const [a, b] of [[[x0 + 0.8, y0], [x0 + inset + 0.8, y1]], [[x1 - 0.8, y0], [x1 - inset - 0.8, y1]]]) { const p = lerp2(a, b, t); wr += `M${f(p[0] - 1.3)} ${f(p[1] - 0.6)}l2.6 1.2`; }
      bk += G('basket-corner-posts', rod(seg([x0 + 0.8, y0], [x0 + inset + 0.8, y1]) + seg([x1 - 0.8, y0], [x1 - inset - 0.8, y1]), 2.4, WK, 0.5), S(wr, WKL, 0.6)); }
    bk += G('basket', S(bodySides, LN, LW), S(`M${x0 + 2} ${y0 + 1.6}L${x0 + inset + 1.6} ${y1 - 1.2}`, LN, 0.5, { opacity: 0.45 }));
    let br = ''; for (let x = x0 + 1; x < x1 - 1; x += 3.2) br += `M${f(x)} ${f(y0 - 2.6)}L${f(x + 2.2)} ${f(y0 + 3.2)}`;
    bk += G('basket-rim', Fi(rrect([x0 - 2.6, y0 - 3.4], [1, 0], 0, x1 - x0 + 5.2, 0, 7.2, 3.4), WK, 1.4), S(br, WKL, 0.8), S(`M${x0} ${y0 - 2}H${x1}`, WKH, 0.7));
    let bt = ''; for (let x = x0 + inset + 2; x < x1 - inset - 1; x += 4.4) bt += `M${f(x)} ${y1 - 4.6}v4`;
    bk += G('basket-base', Fi(rrect([x0 + inset - 1, y1 - 5.2], [1, 0], 0, x1 - x0 - 2 * inset + 2, 0, 5.6, 1.2), WKL, 1.2), S(bt, WK, 0.8));
    // gingham napkin tucked under the fish, its corner flopped over the front of the rim
    {
      const P = [[x0 + 30, y0 - 4.5], [x0 + 43, y0 - 6], [x0 + 49, y0 - 3], [x0 + 47, y0 + 6], [x0 + 42, y0 + 14.5], [x0 + 37, y0 + 9], [x0 + 31, y0 + 4]];
      const cl = handPoly(P, 0.3, 347, 2.5);
      let chk = ''; for (let i = 0; i < 7; i++) { const x = x0 + 29 + i * 3.2; chk += `M${f(x)} ${f(y0 - 8)}l2.2 24l1.5 0l-2.2 -24Z`; } for (let j = 0; j < 8; j++) { const y = y0 - 7 + j * 3.2; chk += `M${f(x0 + 28)} ${f(y)}l23 -1.4l0 1.5l-23 1.4Z`; }
      defs += h('clipPath', { id: 'bike-ginghamClip' }, h('path', { d: cl }));
      bk += G('gingham-cloth', Fi(cl, CR, 1.7), h('g', { 'clip-path': 'url(#bike-ginghamClip)', ...tag('gingham-check') }, Fp(chk, RD, { opacity: 0.5 })),
        S(`M${x0 + 32} ${y0 + 0.5}Q${x0 + 40} ${y0 + 2} ${x0 + 46.5} ${y0 + 0.5}`, LS, 0.6, { opacity: 0.7 }));
    }
    fk += bk;
    { // kelp draped over the rim (front), with float bladders
      const C = resample([[x1 - 19, y0 - 7], [x1 - 13, y0 - 5.5], [x1 - 9.5, y0 + 2], [x1 - 11, y0 + 12], [x1 - 8.5, y0 + 22], [x1 - 10.5, y0 + 29]], 3);
      fk += G('seaweed', Fi(taper(C, 3.8, 1.3), c('Kelp'), 0.8), S(splitQ(C.slice(1, -2).map(p => add(p, [0.6, 0]))), c('KelpLo'), 0.5), Fi(circ(add(C[5], [2.2, 0]), 1.7) + circ(add(C[10], [-2.2, 0]), 1.4), BR, 0.5));
      // price tag on a string: 鲜鱼
      const tg = [x0 + 10, y0 + 12];
      fk += G('basket-tag', S(`M${x0 + 12} ${y0 + 2.4}Q${x0 + 9.5} ${y0 + 7} ${tg[0] + 2} ${tg[1]}`, LS, 0.6), Fi(rrect(tg, [1, 0], 0, 15, 0, 8.4, 1.4), PA, 0.8), Fp(circ([tg[0] + 2, tg[1] + 1.8], 0.7), LN),
        h('path', { d: textD('鲜鱼', 5.2, ([x, y]) => [tg[0] + 3.8 + x, tg[1] + 6.6 + y]).d, fill: RD }));
    }
    fk += G('basket-straps', rod(seg([x0 + 3, y0 + 2.6], [STEM[0] + 1.8, STEM[1] - 2]) + seg([x0 + 3, y0 + 10], [STEM[0] + 2.6, STEM[1] + 1.6]), 1.6, SA, 0.5), Fi(rrect([x0 - 1.6, y0 + 4.2], [1, 0], 0, 3.2, 0, 3.6, 0.5), BR, 0.5));
    // the fish the pelican takes (gulp): shown at the bill tip while inBill
    fk += h('g', { 'data-ref': 'bike-carry', style: 'display:none' }, h('use', { href: '#bike-fishC-art' }));
  }
  // headlamp (bullet lamp) on a bracket from the crown bolt, in front of the basket stays; the lens glows at night
  // (emissive, soft radial gradient), brighter with dynamo speed
  {
    const L = BIKE.lamp, br0 = add(axis(7), mul(nHTf, 1)), q = (x, y) => add(L, [x, y]);
    fk += G('headlamp-bracket', rod(`M${pt(br0)}Q${pt(q(-6, 10))} ${pt(q(-2.6, 6.2))}`, 1.7, ST, 0.55), Fi(circ(q(-2.6, 6.2), 1.3), BR, 0.5));
    const body = `M${pt(q(6.2, -6.6))}L${pt(q(-3, -6.6))}C${pt(q(-9, -6.6))} ${pt(q(-10.6, -3.2))} ${pt(q(-10.6, 0))}C${pt(q(-10.6, 3.2))} ${pt(q(-9, 6.6))} ${pt(q(-3, 6.6))}L${pt(q(6.2, 6.6))}Z`;
    fk += h('g', { ...tag('headlamp'), 'data-ref': 'bike-lamp' }, Fi(body, 'url(#bike-texCream)', 1.3), S(`M${pt(q(-8, -4.4))}Q${pt(q(-3, -5.6))} ${pt(q(5.6, -5.2))}`, PA, 0.9),
      S(`M${pt(q(-8.6, 3.6))}Q${pt(q(-3, 5.2))} ${pt(q(5.6, 5))}`, CRL, 1.1),
      Fi(rrect(q(2.4, -6.65), [1, 0], 0, 1.8, 0, 13.3), BR, 0.5),
      Fi(`M${pt(q(4.4, -6.4))}L${pt(q(12.2, -8.6))}L${pt(q(11.6, -6.6))}Z`, CR, 0.6), Fi(circ(q(-1.4, -6.9), 1.1), RD, 0.4));
    fk += G('lamp-switch', rod(seg(q(-5.2, -6.4), q(-8.2, -9.8)), 0.8, ST, 0.4), Fi(circ(q(-8.4, -10), 1.1), RD, 0.4));
    const lc = q(6.2, 0), E = (rx, ry) => `M${pt(add(lc, [0, -ry]))}Q${pt(add(lc, [rx, -ry]))} ${pt(add(lc, [rx, 0]))}Q${pt(add(lc, [rx, ry]))} ${pt(add(lc, [0, ry]))}Z`;
    fk += G('headlamp-lens', Fi(E(5.8, 7.4), BR, 0.9), Fp(E(4.9, 6.5), c('BrassHi')), Fp(E(4, 5.5), c('Paper')),
      h('path', { 'data-ref': 'bike-lens-on', d: E(4, 5.5), fill: LAMP, style: 'opacity:var(--pb-n-lampOn)' }),
      S(`M${pt(add(lc, [1.6, -3.8]))}Q${pt(add(lc, [3.2, -2.6]))} ${pt(add(lc, [3.3, -0.8]))}`, PA, 0.9), Fp(circ(add(lc, [2.2, 0.8]), 0.8), c('CreamLo')));
    fk += h('g', { 'data-ref': 'bike-glow', ...tag('headlamp-glow') }, h('g', { style: 'opacity:var(--pb-n-lampOn)' },
      Fp(circ(add(lc, [5, 0]), 22), 'url(#bike-glowG)'), Fp(circ(add(lc, [3.4, 0]), 5.4), LAMP, { opacity: 0.7 })));
  }
  slots.fork = fk;

  // ============================================================ BARS (rider space)
  let bs = '';
  const barC = [[STEM[0], STEM[1]], [STEM[0] + 5, STEM[1] - 2.4], [STEM[0] + 1, STEM[1] - 6.6], [STEM[0] - 8, STEM[1] - 7.2], [STEM[0] - 30, STEM[1] - 7.6]];
  const barFar = barC.map(p => add(p, [-3, -2]));
  const grip = (p0, p1, far) => { const u = norm(sub(p1, p0)); return Fi(rrect(p0, u, 0, len(sub(p1, p0)), -4.3, 4.3, 2.8), far ? cf('WickerHi') : WKH, 1.1); };
  bs += G('grip-far', S(splitQ(resample(barFar, 3)), cf('Steel'), 4), grip(add(barFar[3], [-1.2, 0]), [barFar[4][0] - 2, barFar[4][1]], true));
  bs += G('brake-lever-far', Fi(taper([[STEM[0] - 8, STEM[1] - 4.6], [STEM[0] - 18, STEM[1] - 2.4], [STEM[0] - 29, STEM[1] - 2.8]], 2.6, 1.8), cf('Steel'), 0.7));
  // quill stem
  bs += G('stem', Fi(rrect(onHT(-8.4), mul(uHT, -1), 0, 13, -3.3, 3.3, 0.8), ST, 0.8), rod(seg(STR, STEM), 5, ST, 0.8), S(seg(add(STR, [0.8, -2.2]), add(STEM, [-2, -2.4])), PA, 0.7),
    Fi(circ(STEM, 4.9), ST, 0.9), Fp(ringD(STEM, 3.4, 4.2), STL, { 'fill-rule': 'evenodd' }));
  bs += G('stem-bolts', Fi(hex(add(onHT(-8.4), mul(uHT, -13.6)), 2, 18), BR, 0.5), Fi(rrect(add(STEM, [0, 4.4]), [1, 0], -1.6, 1.6, 0, 2.6, 0.4), BR, 0.4));
  // handlebar (steel, ink-outlined) + grips + plug
  bs += G('handlebar', rod(splitQ(resample(barC.slice(0, 4), 4)), 3.6, ST, 0.8), S(splitQ(resample(barC.slice(0, 4), 3)), PA, 0.7, { transform: 'translate(0 -0.8)' }));
  const g0 = add(barC[3], [-0.4, 0]), g1 = [barC[4][0] - 0.5, barC[4][1]];
  bs += G('grip-near', grip(g0, g1, false), Fi(rrect(add(g0, [1.4, 0]), norm(sub(g0, g1)), -1.2, 1.2, -4.9, 4.9, 0.6), SA, 0.6));
  { let rb = ''; const u = norm(sub(g1, g0)), nn = perp(u); for (let s = 3.4; s < len(sub(g1, g0)) - 1.6; s += 2.3) rb += seg(add(add(g0, mul(u, s)), mul(nn, -3.4)), add(add(g0, mul(u, s)), mul(nn, 3.4))); bs += G('grip-ribs', S(rb, WKL, 0.6)); }
  bs += G('bar-end-plug', Fi(rrect(add(g1, [0.4, 0]), [-1, 0], 0, 2.6, -3.6, 3.6, 1.4), RD, 0.6));
  // near brake lever: clamp band + blade under the grip
  bs += G('brake-lever-near', Fi(rrect([STEM[0] - 6.4, STEM[1] - 6.9], [1, 0], -2.4, 2.4, -3.4, 3.8, 1), ST, 0.6),
    Fi(taper([[STEM[0] - 6, STEM[1] - 3.2], [STEM[0] - 10, STEM[1] - 1.2], [STEM[0] - 19, STEM[1] - 0.4], [STEM[0] - 27, STEM[1] - 1.8]], 2.8, 1.8), ST, 0.8), S(`M${STEM[0] - 9} ${STEM[1] - 1}Q${STEM[0] - 18} ${STEM[1] - 0.2} ${STEM[0] - 26} ${STEM[1] - 1.2}`, PA, 0.5),
    Fp(circ([STEM[0] - 6.4, STEM[1] - 4.4], 0.9), LN));
  // front brake housing (lever -> down the head tube front -> calliper anchor), cream, ink-lined
  {
    const calBolt = add(axis(6.5), mul(nHTf, 5.5));
    const anc = cAnchor(calBolt, pol(FH, 91.6, angOf(sub(axisAtR(89.5), FH))), 1), hEnd = add(anc, [-1.2, -9]);
    bs += G('brake-housing-front', rod(splitQ(resample([[STEM[0] - 4.6, STEM[1] - 2.2], [STEM[0] - 6.2, STEM[1] + 5], [126.6, -250], [126.4, -232], [127.8, -218], hEnd], 3)), 1.3, CR, 0.55));
    bs += G('cable-ferrules', Fi(rrect(hEnd, norm(sub(anc, hEnd)), -0.4, 2.2, -1.3, 1.3, 0.4), ST, 0.4), S(seg(add(hEnd, mul(norm(sub(anc, hEnd)), 2)), anc), STL, 0.6));
  }
  // bell: brass dome with rings, striker lever (rotates on flick), clamp
  {
    const bc = BIKE.bell;
    bs += h('g', { ...tag('bell'), 'data-ref': 'bike-bell' }, Fi(rrect([bc[0] - 1.2, bc[1] + 1.6], [1, 0], 0, 2.4, 0, 3.4, 0.4), ST, 0.5),
      h('g', { 'data-ref': 'bike-dome' }, Fi(`M${bc[0] - 5.8} ${bc[1] + 1.6}Q${bc[0] - 5.8} ${bc[1] - 5.4} ${bc[0]} ${bc[1] - 5.6}Q${bc[0] + 5.8} ${bc[1] - 5.4} ${bc[0] + 5.8} ${bc[1] + 1.6}Z`, BR, 1),
        Fi(rrect([bc[0] - 6.4, bc[1] + 1.2], [1, 0], 0, 12.8, 0, 1.5, 0.6), BR, 0.6), Fi(circ([bc[0], bc[1] - 5.8], 0.95), BRH, 0.4),
        h('path', { ...tag('bell-rings'), d: `M${bc[0] - 4.4} ${bc[1] - 1}Q${bc[0]} ${bc[1] - 2.6} ${bc[0] + 4.4} ${bc[1] - 1}M${bc[0] - 3.2} ${bc[1] - 3.6}Q${bc[0]} ${bc[1] - 4.6} ${bc[0] + 3.2} ${bc[1] - 3.6}`, fill: 'none', stroke: LS, 'stroke-width': 0.55, 'stroke-linecap': 'round' }),
        S(`M${bc[0] + 2.4} ${bc[1] - 3.8}Q${bc[0] + 4.2} ${bc[1] - 2} ${bc[0] + 4.3} ${bc[1]}`, BRH, 0.9)));
    bs += h('g', { 'data-ref': 'bike-bellLever', transform: `rotate(0 ${bc[0] - 4.8} ${bc[1] + 2})` }, G('bell-lever', rod(`M${bc[0] - 4.8} ${bc[1] + 2}Q${bc[0] - 8} ${bc[1] + 1} ${bc[0] - 9.6} ${bc[1] - 1.6}`, 0.9, ST, 0.4), Fi(circ([bc[0] - 9.8, bc[1] - 1.9], 1.5), RD, 0.5)));
  }
  bs += anchor('gripNear', BIKE.gripNear) + anchor('gripFar', BIKE.gripFar);
  slots.bars = bs;

  // ============================================================ DRIVETRAIN
  // 16T cog (rear-hub local; rotates 3·crank). Teeth sit in the valleys of the chain rollers at φ=0.
  const tooth = (a, rs, ws) => poly([...rs.map((r, i) => pol([0, 0], r, a - ws[i])), ...rs.slice().reverse().map((r, i) => pol([0, 0], r, a + ws[rs.length - 1 - i]))]);
  {
    let teeth = '';
    for (let j = 0; j < 16; j++) teeth += h('path', { d: tooth(COG_VALLEY0 + 11.25 + 22.5 * j, [8.1, 9.6, 10.4, 10.8], [7.2, 4.6, 3, 1.7]), 'data-ref': `bike-cog-tooth-${j}` });
    slots.cog = G('cog', h('g', { fill: ST, stroke: LN, 'stroke-width': 0.45, 'data-ref': 'bike-cogTeeth' }, teeth), Fi(circ([0, 0], 8.5), ST, 0.6), Fp(ringD([0, 0], 7.2, 7.8), STL, { 'fill-rule': 'evenodd' })) +
      G('cog-lockring', Fi(circ([0, 0], 5.6), STL, 0.6), Fp(rrect([0, 0], [1, 0], 3.4, 5.8, -0.9, 0.9, 0.3), LN), Fp(ringD([0, 0], 4.3, 4.8), ST, { 'fill-rule': 'evenodd' }));
  }
  // chain slot: 48 ring teeth (rotated by update) < chain layers < guard; rear axle nut on top of the cog
  {
    let teeth = '';
    for (let j = 0; j < 48; j++) teeth += h('path', { d: tooth(RING_VALLEY0 + 3.75 + 7.5 * j, [27.1, 28.6, 29.7, 30.2], [2.7, 1.55, 0.95, 0.5]), 'data-ref': `bike-ring-tooth-${j}` });
    let ch = h('g', { 'data-ref': 'bike-teeth', transform: `translate(${pt(BB)})` },
      G('chainring-teeth', Fp(ringD([0, 0], 25.6, 27.4), ST, { 'fill-rule': 'evenodd' }), h('g', { fill: ST, stroke: LN, 'stroke-width': 0.4 }, teeth)));
    const cp = (extra, w, stroke, da) => h('path', { d: CHAIN_D, pathLength: 100, fill: 'none', stroke, 'stroke-width': w, 'stroke-dasharray': da, ...extra });
    // hit-testing honesty: the closed CHAIN_D loop would claim everything inside it, so the chain group is clipped
    // to a band around its own runs and wraps (it never draws outside that band anyway)
    const bandSeg = (a, b, w) => { const u = norm(sub(b, a)), n = mul(perp(u), w); return poly([add(a, n), add(b, n), sub(b, n), sub(a, n)]); };
    defs += h('clipPath', { id: 'bike-chainclip', clipPathUnits: 'userSpaceOnUse' },
      h('path', { d: bandSeg([-126, -109.6], [1.5, -108.5], 2.6) + bandSeg([-7.5, -52.4], [-129, -91.3], 2.6) }),
      h('path', { d: ringNZ(BB, 26, 31.4) }), h('path', { d: ringNZ(RH, 7.1, 12.3) }));
    ch += h('g', { 'data-ref': 'bike-chainfx', 'stroke-dashoffset': 0, 'clip-path': 'url(#bike-chainclip)' },
      G('chain', h('path', { d: CHAIN_D, pathLength: 100, fill: 'none', stroke: LN, 'stroke-width': 4.6, 'stroke-linejoin': 'round', 'data-ref': 'bike-chain' }),
        G('chain-inner-plates', cp({ 'data-ref': 'bike-plateI' }, 2.4, cf('SteelLo'), '0 1.08 0.92 0'),
          G('chain-outer-plates', cp({ 'data-ref': 'bike-plateO' }, 3.4, STL, '1.1 0.9'),
            G('chain-rollers', cp({ 'data-ref': 'bike-pinR', 'stroke-linecap': 'round' }, 2, LN, '0 1'), cp({ 'data-ref': 'bike-pinH', 'stroke-linecap': 'round' }, 0.95, ST, '0 1'),
              G('chain-master-link', cp({}, 3.6, BR, '0 20.95 1.1 77.95'), cp({ 'stroke-linecap': 'round' }, 1.2, RD, '0 21.5 0 78.5')))))));
    // half chainguard over the top run and the upper ring: teal, ink-outlined, cream serif lettering
    const gd = `M-80 -116.6L${pt(pol(BB, 37.2, -104))}A37.2 37.2 0 0 1 ${pt(pol(BB, 37.2, -30))}Q${pt(pol(BB, 35, -26))} ${pt(pol(BB, 31.2, -29))}A31.2 31.2 0 0 0 ${pt(pol(BB, 31.2, -100))}L-80 -109.6Q-84.6 -109.8 -84.6 -113.1Q-84.6 -116.5 -80 -116.6Z`;
    ch += G('chainguard', Fi(gd, 'url(#bike-texFrame)', 1.3), S(`M-81 -115.2L${pt(pol(BB, 35.8, -104))}A35.8 35.8 0 0 1 ${pt(pol(BB, 35.8, -34))}`, FRH, 0.7), Fi(circ([-76, -113.1], 1.1) + circ(pol(BB, 34.2, -52), 1.1), BR, 0.4));
    const gl = textD('Pelican Bay', 4.6, ([x, y]) => [-71 + x, -111 + y * 0.95], 0.2, { slant: 0.15, bob: 0.2 });
    ch += h('path', { ...tag('chainguard-lettering'), d: gl.d, fill: CR });
    ch += G('chain-tensioner', rod(seg(add(RH, [-4, 0]), add(RH, [-15.6, 0])), 0.8, ST, 0.4), Fi(hex(add(RH, [-15.4, 0]), 1.8, 0), BR, 0.4));
    ch += G('axle-nut-rear', Fi(hex(RH, 3.4, 0), ST, 0.7), Fp(hex(RH, 2, 30), STL), Fp(circ(RH, 0.9), LN));
    slots.chain = ch;
  }
  // chainring body + 5-arm spider (BB local; rotates with the crank; arm 0 along the near crank)
  {
    // five heart-shaped windows (storybook), each pointing out along its spider gap
    let win = '';
    for (let k = 0; k < 5; k++) {
      const a = 36 + 72 * k, P = (r, da) => pol([0, 0], r, a + da);
      win += `M${pt(P(18.4, 0))}Q${pt(P(21, -17))} ${pt(P(23.8, -11))}Q${pt(P(24.8, -4))} ${pt(P(22.4, 0))}Q${pt(P(24.8, 4))} ${pt(P(23.8, 11))}Q${pt(P(21, 17))} ${pt(P(18.4, 0))}Z`;
    }
    let arms = '', bolts = '', boltC = '';
    for (let k = 0; k < 5; k++) {
      const a = 72 * k; arms += poly([pol([0, 0], 8.5, a - 26), pol([0, 0], 21.6, a - 8.6), pol([0, 0], 23.2, a), pol([0, 0], 21.6, a + 8.6), pol([0, 0], 8.5, a + 26)]);
      bolts += hex(pol([0, 0], 21, a), 2.1, a); boltC += circ(pol([0, 0], 21, a), 0.8);
    }
    slots.chainring = G('chainring', Fp(ringD([0, 0], 16.4, 26.4) + win, ST, { 'fill-rule': 'evenodd', stroke: LN, 'stroke-width': 1 }), Fp(ringD([0, 0], 25, 26.4), STL, { 'fill-rule': 'evenodd' }),
      h('path', { ...tag('chainring-pinstripe'), d: ringD([0, 0], 23.9, 24.5), fill: FR, 'fill-rule': 'evenodd' })) +
      G('spider', Fi(arms + circ([0, 0], 10), STL, 0.8)) + G('chainring-bolts', Fi(bolts, BR, 0.4), Fp(boltC, LN));
  }
  // cranks
  const arm = 'M0 -8.4L50 -5.2A5.2 5.2 0 0 1 50 5.2L0 8.4A8.4 8.4 0 0 1 0 -8.4Z';
  slots.crankNear = G('crank-near', Fi(arm, ST, 1.3), S('M6 -5.2L46 -3.1', PA, 1.1), S('M8 5.6L45 3.6', STL, 1), Fi(circ([50, 0], 3), ST, 0.6), Fp(circ([50, 0], 1.3), LN)) +
    G('crank-dust-cap', Fi(circ([0, 0], 5.2), ST, 0.8), Fp(ringD([0, 0], 4.2, 4.8), STL, { 'fill-rule': 'evenodd' }), Fp(circ([-1.9, 0], 0.75) + circ([1.9, 0], 0.75), LN));
  slots.crankFar = G('crank-far', Fp(arm, cf('Steel'), { stroke: cf('Line'), 'stroke-width': 1 }), Fp(circ([50, 0], 2.6), cf('SteelLo')));
  // platform pedals: pivot = spindle, top face at y≈0 (the ball of the foot sits on it)
  const pedal = far => {
    const k = far ? cf : c;
    let tread = ''; for (let x = -8.4; x <= 8.5; x += 2.1) tread += `M${f(x)} 1.1v1.1M${f(x)} 4.4v1.1`;
    return G(far ? 'pedal-far' : 'pedal-near', Fp(rrect([0, 0], [1, 0], -12, 12, -0.4, 6.9, 1.8), k('Steel'), { stroke: k('Line'), 'stroke-width': 1 }), Fp(rrect([0, 0], [1, 0], -10, 10, 0.5, 2.9, 0.8) + rrect([0, 0], [1, 0], -10, 10, 3.6, 6, 0.8), k('Tyre'))) +
      (far ? '' : h('path', { ...tag('pedal-treads'), d: tread, stroke: TYH, 'stroke-width': 0.8, fill: 'none', 'stroke-linecap': 'round' }) +
        G('pedal-reflector', Fi(rrect([0, 0], [1, 0], -13.2, -10.4, 0.5, 5.9, 0.7) + rrect([0, 0], [1, 0], 10.4, 13.2, 0.5, 5.9, 0.7), AM, 0.5), S('M-11.8 1.6V4.8M11.8 1.6V4.8', BRH, 0.5)) +
        Fi(circ([0, 3.25], 1.9), ST, 0.5) + Fp(hex([0, 3.25], 1.05, 0), LN)) +
      anchor(far ? 'pedalFar' : 'pedalNear', [0, 0]);
  };
  slots.pedalNear = pedal(false);
  slots.pedalFar = pedal(true);
  return { defs, slots };
}

// ---------------------------------------------------------------- per-frame
export function attach(svg) {
  const r = refs(svg, 'bike-');
  const last = new Map();
  const set = (el, k, val) => { if (!el) return; const key = el; let m = last.get(key); if (!m) last.set(key, m = {}); if (m[k] === val) return; m[k] = val; if (k === 'display') el.style.display = val; else el.setAttribute(k, val); };
  const W = ['wR', 'wF'];
  const setVar = (el, k, val) => { if (!el) return; let m = last.get(el); if (!m) last.set(el, m = {}); if (m[k] === val) return; m[k] = val; el.style.setProperty(k, val); };
  const PEN = [-188, -219.5];   // pennant whip base (rack tail), see build()
  return {
    update(fr) {
      const p = fr.pose || {}, t = fr.t || 0;
      const cad = fr.coasting ? 0 : (fr.cadence ?? 60);
      // chain: dash phase on the group (inherited by every layer); periodic features fade by rate
      set(r.chainfx, 'stroke-dashoffset', (p.chainOffset ?? 0).toFixed(2));
      const plOp = (1 - 0.65 * sstep(62, 90, cad)).toFixed(2), pnOp = (1 - 0.62 * sstep(34, 58, cad)).toFixed(2);
      set(r.plateI, 'opacity', plOp); set(r.plateO, 'opacity', plOp); set(r.pinR, 'opacity', pnOp); set(r.pinH, 'opacity', pnOp);
      set(r.teeth, 'transform', `translate(0 -80) rotate(${((p.crank ?? 0) % 360).toFixed(2)})`);
      const toothOp = (1 - 0.55 * sstep(34, 58, cad)).toFixed(2);
      set(r.teeth, 'opacity', toothOp); set(r.cogTeeth, 'opacity', toothOp);
      // wheels: spokes stay opaque single-ink (no alpha haze); fine periodic detail fades, tread -> blur ring
      const blur = p.spokeBlur ?? 0;
      for (const w of W) {
        const el = r[`${w}-root`];
        setVar(el, '--bkFine', (1 - 0.55 * blur).toFixed(2));
        setVar(el, '--bkHd', (1 - 0.6 * blur).toFixed(2));
        setVar(el, '--bkTr', (1 - blur).toFixed(2));
      }
      set(r.swoosh, 'opacity', (0.7 * blur).toFixed(2));
      set(r.roller, 'opacity', (1 - blur).toFixed(2));
      // bell striker + dome shiver
      const bell = p.bell || {};
      set(r.bellLever, 'transform', `rotate(${(-28 * (bell.flick || 0)).toFixed(1)} ${BIKE.bell[0] - 4.8} ${BIKE.bell[1] + 2})`);
      set(r.dome, 'transform', bell.strike ? `translate(${BIKE.bell[0]} ${BIKE.bell[1]}) rotate(4) translate(${-BIKE.bell[0]} ${-BIKE.bell[1]})` : '');
      // pennant: a slow, calm sway (STYLE-B §6), leaning back a little more with airspeed; skipped when reduced
      if (!fr.reduced) {
        const wind = typeof p.wind === 'number' ? p.wind : 0.5;
        const sway = -3 * wind + 2.2 * Math.sin(t * 1.3) + 0.9 * Math.sin(t * 2.9 + 1.1) + 4 * (typeof p.basket === 'number' ? p.basket : 0);
        set(r.pennant, 'transform', `rotate(${sway.toFixed(1)} ${PEN[0]} ${PEN[1]})`);
      }
      // fish: occasional tail flops (closed-form, deterministic), bounce after a landing, the gulped sardine
      const flop = (per, off, amp) => { const u = ((t + off) % per + per) % per; return u < 0.5 ? amp * Math.sin(u * Math.PI * 6) * (1 - u / 0.5) : 0; };
      set(r.tailA, 'transform', `rotate(${flop(4.3, 0.7, 16).toFixed(1)} -21 0)`);
      set(r.tailB, 'transform', `rotate(${flop(2.3, 1.6, 22).toFixed(1)} -19 0)`);
      set(r.tailC, 'transform', `rotate(${flop(3.1, 0.2, 18).toFixed(1)} -15.5 0)`);
      const bounce = typeof p.basket === 'number' ? p.basket : 0;
      set(r.fish, 'transform', bounce ? `translate(0 ${(-2.2 * bounce).toFixed(2)})` : '');
      const fish = p.fish || {};
      set(r.fishC, 'opacity', (1 - clamp(fish.taken || 0, 0, 1)).toFixed(2));
      if ((fish.inBill || 0) > 0.5 && fish.x !== undefined) {
        set(r.carry, 'display', '');
        set(r.carry, 'transform', `translate(${fish.x.toFixed(1)} ${fish.y.toFixed(1)}) rotate(${(fish.rot ?? 90).toFixed(1)}) translate(-16 0)`);
      } else set(r.carry, 'display', 'none');
      // headlamp: the dynamo output rises with speed (standlight keeps a little glow when slow)
      const dyn = 0.35 + 0.65 * sstep(200, 1400, fr.speed ?? 0);
      set(r.glow, 'opacity', dyn.toFixed(2));
      const lampOn = fr.pal && fr.pal.num ? fr.pal.num.lampOn : 1, lit = lampOn > 0.02 ? '' : 'none';
      set(r.glow, 'display', lit); set(r['lens-on'], 'display', lit); set(r.rglow, 'display', lit);
    },
    bake(kit) {
      const T = 1;   // baked at 60 rpm: one crank turn per second
      return [
        { selector: '[data-ref="bike-chainfx"]', kind: 'attr', attr: 'stroke-dashoffset', values: [0, -48], dur: T },
        { selector: '[data-ref="bike-teeth"]', kind: 'transform', type: 'rotate', values: ['0 0 -80', '360 0 -80'], dur: T, additive: 'sum' },
      ].map(d => (kit && kit.normalize ? kit.normalize(d) : d));
    },
  };
}
