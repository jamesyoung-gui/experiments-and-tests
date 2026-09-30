// OWNER: bike. The retro city bike of "Pelican Bay" in style C (WPA / art-deco screen-print travel poster).
// Inks (STYLE-C §1): T teal frame + fork + guard, N tyres / saddle / darks, P cream "chrome" + fenders + lugs,
// R vermilion pinstripes + lug lining, O brass/copper/wicker, K peach cork grips, B periwinkle steel shading.
// Far-side parts use the -far variants (flat dark ink, never dots). No halftone on anything that rotates.
//
// Every slot is drawn in its joint-local frame (CONTRACT.md "Slots"):
//   wheelRear/wheelFront  hub-local, rotate by pose wheel angle        cog        rear-hub-local, rotates 3·crank
//   chainring             BB-local, rotates with the crank (spider+ring body; the 48 teeth live UNDER the chain)
//   crankNear/crankFar    BB-local, arm along +x                        pedal*     spindle-local, top face at y≈0
//   frame / fork / chain  rider space, identity transform               bars       rider space, steer about steererTop
// Z-order trick: the phase-0 SLOTS put 'chain' under 'chainring', which would paint the teeth over the chain. The
// 48 teeth are therefore drawn inside the (static) chain slot in their own group, rotated by update() about the
// BB, so the order is: teeth < chain < guard < spider/ring body < near crank < pedal (rig-spec C2.2).
//
// Anti-aliasing (rig-spec §3): spokes / nipples / eyelets / tread / tooth rows are periodic, so they fade with
// pose.spokeBlur (or crank rate) and are drawn as 3 motion ghosts spread over the 180° shutter arc; the valve,
// the spoke reflector and the tyre lettering are the asymmetric markers that always show true rotation; six
// static two-ink motion swooshes per wheel fade in at speed (static, so they can never wagon-wheel).
// Hit-testing honesty: large curved shapes are filled bands (not stroked arcs) and long curved strokes are split
// into short quadratic pieces, so the detail inventory's elementFromPoint sampling sees what the eye sees.
import { BIKE, CHAIN_D } from '../contract.js';
import { h, refs } from '../core/svg.js';

export const id = 'bike';
// Style-C inks as graded materials (so time-of-day grading and the -far variants apply like core materials).
export const materials = {
  bikeP: '#F4E7CD', bikeK: '#F2AE86', bikeO: '#EB8A33', bikeR: '#D4513A', bikeB: '#56679E', bikeT: '#1D8882', bikeN: '#1A1F35',
};

// Glyph outlines (em = 10 units, baseline y = 0): DejaVu Sans Bold (Latin) and WenQuanYi Zen Hei (CJK), extracted
// with drafts/C-poster/ttf.mjs. Both licences allow embedding outlines (credited in the README).
const GLYPHS = {
  '0': [6.96, 'M4.6 -3.65Q4.6 -5.02 4.34 -5.58Q4.09 -6.14 3.48 -6.14Q2.88 -6.14 2.62 -5.58Q2.36 -5.02 2.36 -3.65Q2.36 -2.27 2.62 -1.7Q2.88 -1.14 3.48 -1.14Q4.08 -1.14 4.34 -1.7Q4.6 -2.27 4.6 -3.65ZM6.48 -3.64Q6.48 -1.83 5.7 -0.84Q4.92 0.14 3.48 0.14Q2.04 0.14 1.26 -0.84Q0.48 -1.83 0.48 -3.64Q0.48 -5.45 1.26 -6.44Q2.04 -7.42 3.48 -7.42Q4.92 -7.42 5.7 -6.44Q6.48 -5.45 6.48 -3.64Z'],
  '1': [6.96, 'M1.17 -1.3L2.83 -1.3L2.83 -6.01L1.13 -5.66L1.13 -6.94L2.82 -7.29L4.61 -7.29L4.61 -1.3L6.27 -1.3L6.27 0L1.17 0Z'],
  '2': [6.96, 'M2.88 -1.38L6.09 -1.38L6.09 0L0.79 0L0.79 -1.38L3.45 -3.73Q3.81 -4.05 3.98 -4.36Q4.15 -4.67 4.15 -5Q4.15 -5.51 3.81 -5.83Q3.46 -6.14 2.89 -6.14Q2.45 -6.14 1.93 -5.95Q1.41 -5.76 0.81 -5.39L0.81 -6.99Q1.45 -7.2 2.07 -7.31Q2.69 -7.42 3.28 -7.42Q4.59 -7.42 5.31 -6.85Q6.04 -6.27 6.04 -5.24Q6.04 -4.64 5.73 -4.13Q5.42 -3.61 4.44 -2.75Z'],
  '3': [6.96, 'M4.66 -3.93Q5.4 -3.74 5.78 -3.27Q6.16 -2.8 6.16 -2.07Q6.16 -0.99 5.33 -0.42Q4.5 0.14 2.91 0.14Q2.35 0.14 1.78 0.05Q1.22 -0.04 0.67 -0.22L0.67 -1.67Q1.2 -1.41 1.72 -1.27Q2.24 -1.14 2.74 -1.14Q3.49 -1.14 3.88 -1.4Q4.28 -1.66 4.28 -2.14Q4.28 -2.64 3.87 -2.89Q3.47 -3.15 2.67 -3.15L1.92 -3.15L1.92 -4.36L2.71 -4.36Q3.42 -4.36 3.76 -4.58Q4.11 -4.8 4.11 -5.26Q4.11 -5.68 3.77 -5.91Q3.44 -6.14 2.82 -6.14Q2.37 -6.14 1.9 -6.04Q1.44 -5.93 0.98 -5.73L0.98 -7.11Q1.54 -7.27 2.08 -7.34Q2.63 -7.42 3.16 -7.42Q4.58 -7.42 5.29 -6.96Q5.99 -6.49 5.99 -5.55Q5.99 -4.91 5.65 -4.5Q5.32 -4.1 4.66 -3.93Z'],
  '7': [6.96, 'M0.67 -7.29L6.16 -7.29L6.16 -6.23L3.32 0L1.49 0L4.18 -5.91L0.67 -5.91Z'],
  'P': [7.33, 'M0.92 -7.29L4.04 -7.29Q5.43 -7.29 6.17 -6.67Q6.92 -6.05 6.92 -4.91Q6.92 -3.76 6.17 -3.15Q5.43 -2.53 4.04 -2.53L2.8 -2.53L2.8 0L0.92 0ZM2.8 -5.93L2.8 -3.89L3.84 -3.89Q4.38 -3.89 4.68 -4.16Q4.98 -4.42 4.98 -4.91Q4.98 -5.4 4.68 -5.66Q4.38 -5.93 3.84 -5.93Z'],
  'E': [6.83, 'M0.92 -7.29L5.99 -7.29L5.99 -5.87L2.8 -5.87L2.8 -4.51L5.8 -4.51L5.8 -3.09L2.8 -3.09L2.8 -1.42L6.1 -1.42L6.1 0L0.92 0Z'],
  'L': [6.37, 'M0.92 -7.29L2.8 -7.29L2.8 -1.42L6.1 -1.42L6.1 0L0.92 0Z'],
  'I': [3.72, 'M0.92 -7.29L2.8 -7.29L2.8 0L0.92 0Z'],
  'C': [7.34, 'M6.7 -0.4Q6.18 -0.13 5.62 0Q5.06 0.14 4.45 0.14Q2.63 0.14 1.56 -0.88Q0.5 -1.89 0.5 -3.64Q0.5 -5.39 1.56 -6.4Q2.63 -7.42 4.45 -7.42Q5.06 -7.42 5.62 -7.29Q6.18 -7.15 6.7 -6.88L6.7 -5.37Q6.18 -5.73 5.67 -5.89Q5.16 -6.06 4.6 -6.06Q3.59 -6.06 3.02 -5.42Q2.44 -4.77 2.44 -3.64Q2.44 -2.51 3.02 -1.87Q3.59 -1.22 4.6 -1.22Q5.16 -1.22 5.67 -1.39Q6.18 -1.55 6.7 -1.91Z'],
  'A': [7.74, 'M5.34 -1.33L2.4 -1.33L1.94 0L0.05 0L2.75 -7.29L4.99 -7.29L7.69 0L5.8 0ZM2.87 -2.68L4.87 -2.68L3.87 -5.58Z'],
  'N': [8.37, 'M0.92 -7.29L3.02 -7.29L5.67 -2.29L5.67 -7.29L7.45 -7.29L7.45 0L5.35 0L2.7 -5L2.7 0L0.92 0Z'],
  'B': [7.62, 'M3.84 -4.47Q4.28 -4.47 4.51 -4.66Q4.74 -4.86 4.74 -5.24Q4.74 -5.62 4.51 -5.81Q4.28 -6.01 3.84 -6.01L2.8 -6.01L2.8 -4.47ZM3.9 -1.28Q4.47 -1.28 4.75 -1.52Q5.04 -1.76 5.04 -2.24Q5.04 -2.71 4.76 -2.95Q4.47 -3.19 3.9 -3.19L2.8 -3.19L2.8 -1.28ZM5.65 -3.9Q6.25 -3.73 6.59 -3.25Q6.92 -2.78 6.92 -2.09Q6.92 -1.04 6.21 -0.52Q5.49 0 4.04 0L0.92 0L0.92 -7.29L3.74 -7.29Q5.26 -7.29 5.94 -6.83Q6.62 -6.37 6.62 -5.36Q6.62 -4.83 6.37 -4.46Q6.12 -4.08 5.65 -3.9Z'],
  'Y': [7.24, 'M-0.1 -7.29L1.96 -7.29L3.62 -4.69L5.28 -7.29L7.34 -7.29L4.56 -3.07L4.56 0L2.68 0L2.68 -3.07Z'],
  '×': [8.38, 'M7.13 -5.25L5.01 -3.13L7.13 -1.02L6.31 -0.2L4.19 -2.31L2.07 -0.2L1.25 -1.02L3.37 -3.13L1.25 -5.25L2.07 -6.07L4.19 -3.95L6.31 -6.07Z'],
  '·': [3.8, 'M1.02 -4.42L2.78 -4.42L2.78 -2.53L1.02 -2.53Z'],
  '-': [4.15, 'M0.54 -3.59L3.61 -3.59L3.61 -2.17L0.54 -2.17Z'],
  'F': [6.83, 'M0.92 -7.29L5.99 -7.29L5.99 -5.87L2.8 -5.87L2.8 -4.51L5.8 -4.51L5.8 -3.09L2.8 -3.09L2.8 0L0.92 0Z'],
  'R': [7.7, 'M3.59 -4.06Q4.18 -4.06 4.44 -4.28Q4.69 -4.5 4.69 -5Q4.69 -5.5 4.44 -5.71Q4.18 -5.93 3.59 -5.93L2.8 -5.93L2.8 -4.06ZM2.8 -2.76L2.8 0L0.92 0L0.92 -7.29L3.79 -7.29Q5.23 -7.29 5.9 -6.81Q6.57 -6.32 6.57 -5.28Q6.57 -4.56 6.22 -4.09Q5.87 -3.63 5.17 -3.41Q5.56 -3.32 5.86 -3.01Q6.17 -2.7 6.48 -2.07L7.5 0L5.5 0L4.61 -1.81Q4.34 -2.36 4.06 -2.56Q3.79 -2.76 3.33 -2.76Z'],
  'S': [7.2, 'M5.99 -7.06L5.99 -5.52Q5.39 -5.79 4.82 -5.92Q4.25 -6.06 3.74 -6.06Q3.07 -6.06 2.74 -5.87Q2.42 -5.69 2.42 -5.3Q2.42 -5 2.64 -4.84Q2.86 -4.68 3.43 -4.56L4.23 -4.4Q5.44 -4.16 5.96 -3.66Q6.47 -3.16 6.47 -2.24Q6.47 -1.04 5.75 -0.45Q5.04 0.14 3.57 0.14Q2.88 0.14 2.18 0.01Q1.48 -0.12 0.78 -0.38L0.78 -1.97Q1.48 -1.6 2.13 -1.41Q2.78 -1.22 3.39 -1.22Q4 -1.22 4.33 -1.43Q4.66 -1.63 4.66 -2.01Q4.66 -2.35 4.44 -2.54Q4.21 -2.72 3.55 -2.87L2.82 -3.03Q1.73 -3.27 1.22 -3.78Q0.72 -4.29 0.72 -5.16Q0.72 -6.25 1.42 -6.84Q2.12 -7.42 3.44 -7.42Q4.04 -7.42 4.68 -7.33Q5.31 -7.24 5.99 -7.06Z'],
  'H': [8.37, 'M0.92 -7.29L2.8 -7.29L2.8 -4.51L5.57 -4.51L5.57 -7.29L7.45 -7.29L7.45 0L5.57 0L5.57 -3.09L2.8 -3.09L2.8 0L0.92 0Z'],
  '鹈': [10, 'M3.16 1.2Q2.8 1.16 2.45 1.2Q2.48 0.54 2.48 -0.13L2.48 -1.73Q1.86 -0.6 0.62 0.55Q0.42 0.26 0.1 0.14Q0.65 -0.35 1.13 -0.97Q1.6 -1.58 2.16 -2.65L0.9 -2.65L0.89 -4.73L2.48 -4.73L2.48 -5.77L1.77 -5.77Q1.31 -5.77 0.86 -5.74Q0.88 -6 0.86 -6.24Q1.31 -6.22 1.77 -6.22L2.77 -6.22Q3.27 -7.01 3.64 -8.04Q3.97 -7.88 4.33 -7.8Q4.09 -7.09 3.54 -6.22L4.76 -6.22L4.76 -4.27L3.13 -4.27L3.13 -3.11L4.84 -3.11L4.84 -1.33Q4.84 -0.98 4.45 -0.73Q4.05 -0.49 3.57 -0.5Q3.65 -0.96 3.38 -1.35Q3.54 -1.3 3.74 -1.26Q4.08 -1.25 4.14 -1.27Q4.19 -1.29 4.19 -1.42L4.19 -2.65L3.13 -2.65L3.13 -0.13Q3.13 0.54 3.16 1.2ZM2.58 -6.64L1.96 -6.27L1.04 -7.81L1.65 -8.18ZM2.48 -3.11L2.48 -4.27L1.54 -4.27Q1.54 -3.71 1.55 -3.11ZM3.13 -4.73L4.1 -4.73L4.1 -5.77L3.25 -5.77L3.22 -5.73Q3.2 -5.77 3.13 -5.77ZM8.55 -1.27Q8.54 -1.01 8.55 -0.74Q8.14 -0.76 7.73 -0.76L6.4 -0.76Q5.99 -0.76 5.59 -0.74Q5.61 -1.01 5.59 -1.27Q5.99 -1.24 6.4 -1.24L7.73 -1.24Q8.14 -1.24 8.55 -1.27ZM7.99 -5.1L7.5 -4.65L6.85 -5.66L7.33 -6.11ZM7.82 -3.32Q7.88 -3.83 7.66 -4.14Q7.87 -4.1 8.18 -4.1Q8.5 -4.09 8.54 -4.14Q8.57 -4.19 8.57 -4.34L8.57 -6.33L7.23 -6.33L7.12 -6.2Q7.08 -6.27 7.04 -6.33Q6.88 -6.33 6.62 -6.33L6.62 -2.93L9.64 -2.93L9.64 0.44Q9.64 0.79 9.39 1.05Q9.02 1.39 8.19 1.38Q8.26 0.86 8.01 0.56Q8.26 0.6 8.62 0.6Q8.97 0.61 9.03 0.55Q9.08 0.49 9.08 0.27L9.08 -2.45L6.05 -2.45L6.05 -6.81Q6.46 -6.81 6.85 -6.81Q7.17 -7.21 7.33 -7.81Q7.61 -7.66 7.92 -7.58Q7.8 -7.12 7.59 -6.81L9.13 -6.81L9.13 -4.22Q9.13 -3.92 8.9 -3.65Q8.55 -3.33 7.82 -3.32Z'],
  '鹕': [10, 'M4.91 -2.61L3.95 -2.61Q4 -1.14 3.52 -0.21Q3.04 0.72 2.25 1.2Q2.07 0.85 1.69 0.72Q3.27 0.03 3.3 -2.24L3.29 -7.44L5.56 -7.44L5.56 0.12Q5.57 0.76 5.2 1Q4.77 1.26 4.07 1.24Q4.16 0.81 3.89 0.46Q4.12 0.5 4.43 0.5Q4.75 0.51 4.82 0.42Q4.91 0.28 4.91 -0.26ZM1.15 -0.21L0.51 -0.21L0.51 -3.8Q0.92 -3.8 1.31 -3.8L1.31 -5.36L0.17 -5.34Q0.2 -5.58 0.17 -5.81L1.31 -5.79L1.31 -6.94Q1.31 -7.6 1.28 -8.24Q1.63 -8.21 1.98 -8.24Q1.94 -7.6 1.94 -6.94L1.94 -5.79L3.22 -5.81Q3.2 -5.58 3.22 -5.34L1.94 -5.36L1.94 -3.8L2.76 -3.8L2.76 -0.21L2.13 -0.21L2.13 -1.03L1.15 -1.03ZM4.91 -5.24L4.91 -7.02L3.93 -7.02L3.94 -5.24ZM4.91 -3L4.91 -4.86L3.94 -4.86L3.95 -3ZM2.13 -3.37L1.15 -3.37L1.15 -1.42L2.13 -1.42ZM8.65 -1.27Q8.63 -1.01 8.65 -0.74Q8.27 -0.76 7.89 -0.76L6.64 -0.76Q6.26 -0.76 5.88 -0.74Q5.9 -1.01 5.88 -1.27Q6.26 -1.24 6.64 -1.24L7.89 -1.24Q8.27 -1.24 8.65 -1.27ZM8.13 -5.1L7.67 -4.65L7.06 -5.66L7.51 -6.11ZM7.97 -3.32Q8.03 -3.83 7.82 -4.14Q8.02 -4.1 8.31 -4.1Q8.59 -4.09 8.63 -4.14Q8.67 -4.19 8.67 -4.34L8.67 -6.33L7.41 -6.33L7.31 -6.2Q7.28 -6.27 7.25 -6.33Q7.08 -6.33 6.85 -6.33L6.85 -2.93L9.67 -2.93L9.67 0.44Q9.67 0.79 9.43 1.05Q9.09 1.39 8.31 1.38Q8.38 0.86 8.14 0.56Q8.38 0.6 8.71 0.6Q9.04 0.61 9.09 0.55Q9.14 0.49 9.14 0.27L9.14 -2.45L6.33 -2.45L6.33 -6.81Q6.69 -6.81 7.06 -6.81Q7.35 -7.21 7.51 -7.81Q7.76 -7.66 8.06 -7.58Q7.95 -7.12 7.75 -6.81L9.19 -6.81L9.19 -4.22Q9.19 -3.92 8.96 -3.65Q8.65 -3.33 7.97 -3.32Z'],
  '湾': [10, 'M7.73 -3.55L4.64 -3.55Q4.19 -3.55 3.73 -3.54Q3.75 -3.78 3.73 -4.03Q4.19 -4 4.64 -4L8.39 -4L8.39 -2.35L4.57 -2.33L4.31 -1.55L8.87 -1.55L8.38 0.48Q8.16 1.27 6.31 1.25Q6.37 1.02 6.29 0.81Q6.22 0.61 6.06 0.47Q6.44 0.51 7.03 0.47Q7.62 0.43 7.68 0.38Q7.74 0.33 7.76 0.23L8.09 -1.1L3.46 -1.1L3.97 -2.6L3.97 -2.74L4.02 -2.74L4.06 -2.85L4.38 -2.74L7.73 -2.76ZM9.12 -4.29Q8.43 -5.3 7.4 -5.99L7.8 -6.58Q8.95 -5.82 9.72 -4.69ZM3.92 -6.15Q4.24 -6.01 4.59 -5.92Q4.33 -5.06 3.7 -4.04L3.3 -3.41Q3.05 -3.65 2.71 -3.69Q3.21 -4.39 3.59 -5.34ZM7.3 -4.28Q6.94 -4.32 6.58 -4.28Q6.61 -4.94 6.61 -5.61L6.61 -6.79L5.73 -6.79L5.73 -5.65Q5.73 -4.99 5.76 -4.33Q5.4 -4.36 5.05 -4.33Q5.08 -4.99 5.08 -5.65L5.08 -6.79L3.86 -6.79Q3.41 -6.79 2.95 -6.77Q2.97 -7.01 2.95 -7.27Q3.41 -7.25 3.86 -7.25L6.11 -7.25L5.11 -7.9L5.5 -8.5L6.79 -7.66L6.51 -7.25L8.72 -7.25Q9.18 -7.25 9.64 -7.27Q9.61 -7.01 9.64 -6.77Q9.18 -6.79 8.72 -6.79L7.27 -6.79L7.27 -5.61Q7.27 -4.94 7.3 -4.28ZM1.11 1.15Q0.8 0.92 0.35 0.9Q0.67 0.11 1.02 -0.91Q1.36 -1.92 2.02 -4.43L2.31 -4.23L1.46 -0.53ZM1.69 -4.46L1.22 -3.98L0.13 -5.31L0.6 -5.8ZM1.83 -6.11Q1.32 -6.86 0.71 -7.5L1.16 -8.01Q1.8 -7.32 2.33 -6.54Z'],
  '鲜': [10, 'M7.69 1.2Q7.33 1.16 6.98 1.2Q7.01 0.55 7.01 -0.1L7.01 -1.38L6.18 -1.38Q5.75 -1.38 5.31 -1.36Q5.34 -1.59 5.31 -1.83Q5.75 -1.8 6.18 -1.8L7.01 -1.8L7.01 -3.32L6.39 -3.32Q5.96 -3.32 5.52 -3.3Q5.55 -3.54 5.52 -3.77Q5.96 -3.75 6.39 -3.75L7.01 -3.75L7.01 -5.29L6.18 -5.29Q5.75 -5.29 5.31 -5.27Q5.34 -5.51 5.31 -5.74Q5.75 -5.72 6.18 -5.72L7 -5.72L7.91 -7.32L8.38 -8.1Q8.66 -7.88 8.97 -7.73L8.52 -6.96L7.94 -6.07L7.73 -5.72L8.8 -5.72Q9.23 -5.72 9.67 -5.74Q9.64 -5.51 9.67 -5.27Q9.23 -5.29 8.8 -5.29L7.65 -5.29L7.65 -3.75L8.44 -3.75Q8.87 -3.75 9.3 -3.77Q9.27 -3.54 9.3 -3.3Q8.87 -3.32 8.44 -3.32L7.65 -3.32L7.65 -1.8L8.82 -1.8Q9.26 -1.8 9.69 -1.83Q9.66 -1.59 9.69 -1.36Q9.26 -1.38 8.82 -1.38L7.65 -1.38L7.65 -0.1Q7.65 0.55 7.69 1.2ZM6.39 -5.88Q5.88 -6.83 5.24 -7.7L5.82 -8.11Q6.47 -7.2 7.01 -6.21ZM0.66 0.91Q0.66 0.43 0.45 0.11Q1.17 0.07 2.07 -0.06Q2.97 -0.19 5.07 -0.69L5.07 -0.28Q3.04 0.21 2.19 0.45Q1.35 0.69 0.66 0.91ZM2.23 -7.89Q2.56 -7.76 2.95 -7.71Q2.77 -7.05 2.5 -6.43L4.17 -6.43L4.27 -5.87Q4.13 -5.85 4.06 -5.75L3.49 -4.76L4.85 -4.76Q4.72 -2.91 4.83 -1.04L1.27 -1.04Q1.38 -2.73 1.3 -4.36Q1 -3.96 0.67 -3.57Q0.45 -3.83 0.08 -3.92Q1.52 -5.51 2.23 -7.89ZM3.33 -3.22L4.16 -3.22L4.17 -4.31L3.33 -4.31ZM2.65 -3.22L2.65 -4.31L1.95 -4.31L1.95 -3.22ZM3.33 -2.8L3.33 -1.49L4.15 -1.49L4.16 -2.8ZM2.65 -2.8L1.95 -2.8L1.95 -1.49L2.65 -1.49ZM3.41 -5.98L2.29 -5.98Q1.99 -5.37 1.57 -4.76L2.86 -4.76L2.74 -4.82Z'],
  '鱼': [10, 'M9.58 0.05Q9.55 0.33 9.58 0.62Q9.06 0.59 8.54 0.59L1.57 0.59Q1.04 0.59 0.53 0.62Q0.56 0.33 0.53 0.05Q1.04 0.07 1.57 0.07L8.54 0.07Q9.06 0.07 9.58 0.05ZM3.76 -7.05L6.7 -7.05L6.78 -6.46Q6.55 -6.41 6.41 -6.28L5.56 -5.41L8.02 -5.41Q7.89 -3.19 8.02 -0.99L1.89 -0.99Q1.95 -2.09 1.95 -3.04Q1.95 -3.99 1.92 -4.79Q1.34 -4.19 0.72 -3.73Q0.51 -4.1 0.12 -4.28Q1.76 -5.44 2.53 -6.54Q3.07 -7.3 3.49 -8.13Q3.83 -7.89 4.21 -7.72ZM5.28 -3.49L7.33 -3.49L7.33 -4.89L5.28 -4.89ZM4.59 -3.49L4.59 -4.89L2.58 -4.89L2.58 -3.49ZM5.28 -2.97L5.28 -1.5L7.33 -1.5L7.33 -2.97ZM4.59 -2.97L2.58 -2.97L2.58 -1.5L4.59 -1.5ZM4.75 -5.41L4.68 -5.48L5.7 -6.54L3.39 -6.54Q2.94 -5.92 2.49 -5.41Z'],
};

// ---------------------------------------------------------------- pure helpers
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const f = x => { const r = Math.round(x * 100) / 100; return (r === 0 ? 0 : r).toString(); };
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
const seg = (a, b) => `M${pt(a)}L${pt(b)}`;
const circ = (c, r) => `M${f(c[0] - r)} ${f(c[1])}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
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
// glyph text -> path (em 10); fn maps local glyph space (baseline y=0, x from 0) to output space
function mapPath(d, fn) {
  let out = '', nums = [];
  for (const t of d.match(/[MLQZ]|-?\d*\.?\d+/g)) {
    if (t.length === 1 && /[MLQZ]/.test(t)) { out += t; continue; }
    nums.push(+t); if (nums.length === 2) { out += pt(fn(nums)) + ' '; nums = []; }
  }
  return out;
}
function textD(str, size, fn = p => p, track = 0) {
  const k = size / 10; let pen = 0, d = '';
  for (const ch of str) {
    if (ch === ' ') { pen += 3.1 * k + track; continue; }
    const g = GLYPHS[ch]; if (!g) continue;
    const x0 = pen; d += mapPath(g[1], ([x, y]) => fn([x0 + x * k, y * k])); pen += g[0] * k + track;
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
const HT_LEN = len(sub(HBB, HTT)), DT_LEN = len(sub(HBB, BB)), SS_LEN = len(sub(STT, RH));
const onST = s => add(BB, mul(uST, s)), onHT = s => add(HTT, mul(uHT, s)), onDT = s => add(BB, mul(uDT, s));
const onSS = s => add(RH, mul(uSS, s)), onCS = s => add(RH, mul(uCS, s)), onTT = s => add(STT, mul(uTT, s));
const axis = t => add(HBB, mul(uHT, t));                    // steering axis below the head tube
const ST_ANG = angOf(uST), HT_ANG = angOf(uHT), DT_ANG = angOf(uDT), SS_ANG = angOf(uSS), CS_ANG = angOf(uCS), TT_ANG = angOf(uTT);
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
  ['O', 'tyre', 'N 700×32c tyre, 9 u section'], ['T', 'tyre-tread', 'block tread on the crown (fades into a blur ring at speed)'],
  ['T', 'tyre-sidewall-lettering', 'P raised lettering "PELICAN · 700×32C" on both sidewalls (glyph paths)'], ['T', 'tyre-bead-line', 'thin bead / casing line'],
  ['O', 'rim', 'P steel rim 88→91'], ['T', 'rim-brake-track', 'machined brake-track groove'], ['T', 'rim-eyelets', '32 spoke-hole eyelets every 11.25°'],
  ['O', 'spokes-near', '16 near-flange spokes, tangential 3-cross'], ['O', 'spokes-far', '16 far-flange spokes, -far ink, thinner'],
  ['O', 'spoke-nipples', '32 nipples at the rim'], ['O', 'hub-front', 'front hub flange with 16 spoke holes'], ['T', 'hub-spoke-heads', 'spoke heads on the flange'],
  ['O', 'valve', 'Schrader valve stem + lock nut + cap between two near-parallel spokes'], ['O', 'spoke-reflector-front', 'white spoke reflector'],
  ['O', 'spoke-reflector-rear', 'red spoke reflector'], ['T', 'wheel-motion-swooshes', 'six static two-ink motion swooshes, fade in with speed'],
  ['O', 'axle-nut-rear', 'rear axle nut (static)'], ['O', 'axle-nut-front', 'front axle nut (static)'], ['O', 'dropout-rear', 'rear dropout plate with axle slot'],
  ['O', 'fork-end', 'front fork end'],
  // drivetrain
  ['O', 'cog', '16T sprocket'], ['O', 'cog-lockring', 'freewheel lockring with index notch'], ['O', 'chainring-teeth', '48T chainring teeth (under the chain)'],
  ['O', 'chainring', 'chainring body with five deco windows'], ['T', 'chainring-pinstripe', 'R pinstripe ring'], ['O', 'spider', '5-arm spider'], ['O', 'chainring-bolts', 'five chainring bolts'],
  ['O', 'crank-near', 'near crank arm with bevel'], ['O', 'crank-far', 'far crank (-far ink)'], ['O', 'crank-dust-cap', 'dust cap with spanner holes'],
  ['O', 'pedal-near', 'platform pedal cage'], ['T', 'pedal-treads', 'rubber tread blocks'], ['O', 'pedal-reflector', 'amber pedal reflectors'], ['O', 'pedal-far', 'far pedal'],
  ['O', 'chain', 'chain on CHAIN_D (pathLength 100)'], ['T', 'chain-outer-plates', 'outer plates (2-link period)'], ['T', 'chain-inner-plates', 'inner plates'],
  ['T', 'chain-rollers', 'rollers / pin heads'], ['O', 'chain-master-link', 'master link with clip'], ['O', 'chainguard', 'teal half chainguard'],
  ['T', 'chainguard-lettering', '"PELICAN BAY" on the guard'], ['O', 'chainguard-stays', 'guard stays / clamp'],
  // frame
  ['O', 'top-tube', 'top tube 28.6 mm'], ['O', 'down-tube', 'down tube 31.8 mm'], ['O', 'seat-tube', 'seat tube'], ['O', 'chainstay', 'chainstay'], ['O', 'seat-stay', 'seat stay'],
  ['O', 'head-tube', 'head tube'], ['O', 'lug-seat', 'seat lug with spearpoints'], ['O', 'lug-head-top', 'top head lug'], ['O', 'lug-head-bottom', 'bottom head lug'],
  ['T', 'lug-lining', 'R lug lining'], ['O', 'seat-binder-bolt', 'seat binder bolt'], ['O', 'seat-stay-caps', 'wrap-over seat-stay caps'],
  ['T', 'frame-pinstripe-bands', 'R/P box-lining bands'], ['T', 'frame-highlight', 'P specular line'], ['T', 'frame-rim-light', 'warm back-light rim on sun-facing edges'],
  ['O', 'head-badge', 'riveted head badge'], ['O', 'head-badge-pelican', 'pelican emblem on the badge'], ['O', 'head-badge-rivets', 'badge rivets'],
  ['O', 'decal-cn', 'down-tube decal 鹈鹕 (glyph path)'], ['O', 'decal-latin', 'down-tube decal PELICAN'], ['T', 'decal-flourish', 'deco speed lines on the decal'],
  ['O', 'brake-bridge', 'seat-stay brake bridge'], ['O', 'bb-lug-points', 'BB lug spearpoints'],
  // steering
  ['O', 'fork-blade', 'raked fork blade'], ['O', 'fork-crown', 'P fork crown with deco cut'], ['O', 'headset-cups', 'headset cups'], ['T', 'headset-knurl', 'knurled locknut'],
  ['O', 'stem', 'quill stem'], ['O', 'stem-bolts', 'expander + clamp bolts'], ['O', 'handlebar', 'swept-back city bar'], ['O', 'grip-near', 'cork grip'], ['T', 'grip-ribs', 'grip ribs'],
  ['O', 'bar-end-plug', 'bar-end plug'], ['O', 'grip-far', 'far grip'], ['O', 'brake-lever-near', 'brake lever'], ['O', 'brake-lever-far', 'far brake lever'],
  ['O', 'brake-housing-front', 'front brake housing'], ['O', 'brake-housing-rear', 'rear brake housing along the top tube'], ['O', 'cable-clips', 'top-tube cable clips'],
  ['O', 'cable-ferrules', 'housing ferrules + bare cable'], ['O', 'calliper-front', 'front side-pull calliper'], ['O', 'calliper-rear', 'rear side-pull calliper'], ['O', 'brake-pads', 'brake pads on the brake track'],
  // saddle
  ['O', 'saddle', 'sprung leather saddle'], ['T', 'saddle-sheen', 'leather sheen'], ['O', 'saddle-rivets', 'copper rivets'], ['O', 'saddle-cantle-plate', 'cantle plate'],
  ['O', 'saddle-springs', 'coil springs'], ['O', 'saddle-rails', 'rails'], ['O', 'seat-clamp', 'seat clamp with nut'], ['O', 'seatpost', 'seatpost'], ['T', 'saddle-stitching', 'skirt stitching'],
  ['O', 'saddle-bag-loops', 'saddle-bag loops'],
  // fittings
  ['O', 'fender-rear', 'rear fender'], ['O', 'fender-front', 'front fender'], ['T', 'fender-pinstripe', 'R fender pinstripe'], ['O', 'fender-stays', 'fender stays'],
  ['O', 'fender-bolts', 'stay screws / eyelets'], ['O', 'mud-flap', 'front mud flap'], ['O', 'mud-flap-emblem', 'fish emblem on the flap'], ['O', 'kickstand', 'folded kickstand'],
  ['O', 'kickstand-plate', 'kickstand mount + spring'], ['O', 'dynamo', 'bottle dynamo'], ['O', 'dynamo-roller', 'knurled dynamo roller'], ['O', 'dynamo-bracket', 'dynamo clamp'],
  ['O', 'lamp-wire', 'lamp wire with clips'], ['O', 'headlamp', 'art-deco bullet headlamp'], ['O', 'headlamp-lens', 'lens + bezel'], ['O', 'headlamp-bracket', 'lamp bracket'],
  ['O', 'headlamp-glow', 'quantised night glow rings'], ['O', 'rear-light', 'rear lamp'], ['O', 'rear-reflector', 'fender reflector'], ['O', 'rack', 'rear rack'], ['O', 'rack-struts', 'rack struts'],
  ['O', 'towel', 'rolled beach towel'], ['T', 'towel-stripes', 'towel stripes'], ['T', 'towel-spiral', 'rolled end spiral'], ['O', 'towel-straps', 'leather straps + buckles'],
  ['O', 'license-plate', 'licence plate'], ['O', 'plate-text-cn', '鹈鹕湾 on the plate'], ['O', 'plate-number', '001'], ['O', 'plate-bolts', 'plate bolts'],
  ['O', 'bell', 'brass bell dome'], ['T', 'bell-rings', 'bell dome rings'], ['O', 'bell-lever', 'bell striker lever'], ['O', 'basket', 'wicker basket'], ['T', 'basket-weave', 'over-under weave'],
  ['T', 'basket-rim', 'braided rim'], ['T', 'basket-base', 'base band'], ['O', 'basket-stays', 'basket stays to the axle'], ['O', 'basket-straps', 'leather straps to the bar'],
  ['O', 'fish-mackerel', 'mackerel'], ['T', 'fish-mackerel-stripes', 'tiger stripes'], ['O', 'fish-snapper', 'red snapper'], ['T', 'fish-scales', 'scales'], ['O', 'fish-sardine', 'sardine'],
  ['T', 'fish-sardine-spots', 'flank spots'], ['O', 'fish-fins', 'fins with rays'], ['O', 'fish-gills', 'gill covers'], ['O', 'fish-eyes', 'eyes'], ['O', 'fish-tails', 'forked tails'],
  ['O', 'bottle', 'alloy bottle'], ['O', 'bottle-cage', 'wire cage'], ['O', 'bottle-cap', 'cap'], ['O', 'bottle-label', 'label'], ['O', 'pump', 'frame pump'], ['T', 'pump-grip', 'pump handle ribs'],
  ['O', 'pump-pegs', 'pump pegs'],
  ['O', 'fender-mascot', 'art-deco flying-fish mascot on the front fender'], ['O', 'fender-reflector-front', 'white front fender reflector'],
  ['O', 'fender-emblem-rear', 'winged roundel on the rear fender'], ['T', 'towel-fringe', 'towel fringe'], ['O', 'chain-tensioner', 'chain tensioner bolt in the dropout'],
  ['T', 'fish-lateral-line', 'lateral lines'], ['O', 'newspaper-liner', 'newspaper lining the basket'], ['T', 'newspaper-print', 'newsprint columns + headline bar'],
  ['O', 'basket-tag', 'hanging price tag 鲜鱼'], ['O', 'rack-spring-clip', 'spring-loaded rack clip'], ['O', 'pump-hose', 'pump hose + chuck'],
  ['O', 'rim-decal', 'rim label opposite the valve'], ['O', 'lamp-switch', 'headlamp switch lever'], ['T', 'fish-mouths', 'mouth lines'], ['O', 'basket-corner-posts', 'wrapped corner posts'], ['O', 'seaweed', 'kelp draped over the rim with float bladders'],
];
const DK = new Map(DETAILS.map(([k, n]) => [n, k]));
export const detailItems = DETAILS.map(([kind, name, what]) => ({ id: `bike:${kind}:${name}`, layer: 'bike', kind, what }));
const D = name => { const k = DK.get(name); if (!k) throw new Error('bike: undeclared detail ' + name); return `bike:${k}:${name}`; };

// ---------------------------------------------------------------- build
export function build({ v }) {
  const I = {}, F = {};
  for (const k of 'PKORBTN') { I[k] = v('bike' + k); F[k] = v('bike' + k, { far: true }); }
  const { P, K, O, R, B, T, N } = I;
  const RIM = v('rim'), LAMP = v('headlamp'), LAMPG = v('lampGlow');
  const S = (d, stroke, w, extra = {}) => h('path', { d, fill: 'none', stroke, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra });
  const Fp = (d, fill, extra = {}) => h('path', { d, fill, ...extra });
  const tag = name => ({ 'data-detail': D(name) });
  const G = (name, ...kids) => h('g', tag(name), ...kids);
  // one element per subpath / segment, all carrying the same detail tag (tight bounding boxes for hit-testing)
  const perSub = (name, d, attrs) => d.split(/(?=M)/).filter(Boolean).map(p => h('path', { ...tag(name), d: p, ...attrs })).join('');
  const pieces = (a, b, n, ov = 0.4) => Array.from({ length: n }, (_, i) => [lerp2(a, b, Math.max(0, i / n - ov / len(sub(b, a)))), lerp2(a, b, Math.min(1, (i + 1) / n + ov / len(sub(b, a))))]);
  const arcPieces = (c, r0, r1, a0, a1, n, ov = 0.5) => Array.from({ length: n }, (_, i) => band(c, r0, r1, a0 + (a1 - a0) * i / n - (i ? ov : 0), a0 + (a1 - a0) * (i + 1) / n + (i < n - 1 ? ov : 0)));
  const anchor = (name, p) => h('circle', { cx: f(p[0]), cy: f(p[1]), r: 0, 'data-anchor': 'bike-' + name });
  const slots = {};
  let defs = '';

  // ============================================================ WHEELS
  const spokeD = side => LACING.filter(s => s.side === side).map(s => seg(...spokeEnds(s))).join('');
  const nippleD = LACING.map(s => seg(pol([0, 0], 85.4, s.ar), pol([0, 0], 88.2, s.ar))).join('');
  const eyeletD = Array.from({ length: 32 }, (_, m) => circ(pol([0, 0], 89.0, m * 11.25), 0.5)).join('');
  defs += h('g', { id: 'bike-spk-near', fill: 'none', 'stroke-linecap': 'round' }, h('path', { d: spokeD('near'), stroke: N, 'stroke-width': 1.35 }), h('path', { d: spokeD('near'), stroke: P, 'stroke-width': 0.6 }));
  defs += h('path', { id: 'bike-spk-far', d: spokeD('far'), stroke: F.B, 'stroke-width': 0.85, fill: 'none', 'stroke-linecap': 'round' });
  defs += h('path', { id: 'bike-spk-nip', d: nippleD, stroke: P, 'stroke-width': 1.7, fill: 'none' });
  // tyre sidewall lettering: two arcs 180° apart, reading clockwise, "up" = outward
  const tyreText = (() => {
    const str = 'PELICAN · 700×32C', size = 4.6, rb = 93.1, w = textW(str, size, 0.35), w1 = textW('PELICAN · ', size, 0.35);
    const d = [];
    for (const a0 of [-90, 90]) {
      const start = a0 * D2R - (w / 2) / rb;
      const m = off => ([x, y]) => { const a = start + (x + off) / rb, r = rb - y; return [r * Math.cos(a), r * Math.sin(a)]; };
      d.push(textD('PELICAN ·', size, m(0), 0.35).d, textD('700×32C', size, m(w1), 0.35).d);
    }
    return d;
  })();
  const treadD = Array.from({ length: 96 }, (_, i) => band([0, 0], 98.6, 100.3, i * 3.75 - 1.05, i * 3.75 + 1.05)).join('');
  function wheel(which) {
    const rear = which === 'rear', W = 'bike-w' + (rear ? 'R' : 'F');
    const vg = VALVE_GAPS[rear ? 0 : 5].ang;              // different valve phase front / rear
    const refl = LACING.find(s => s.side === 'near' && Math.abs(((s.ah - (rear ? 200 : 40)) % 360 + 360) % 360) < 11.3) || LACING[3];
    const [r0, r1] = spokeEnds(refl), rp = lerp2(r0, r1, 0.62), ra = angOf(sub(r1, r0));
    const ghosts = side => [h('use', { href: `#bike-spk-${side}` })];   // one opaque copy: no alpha ghosts (no grey moire)
    return h('g', {},
      h('g', { 'data-ref': `${W}-spk`, ...tag('spokes-far') }, ...ghosts('far')),
      h('g', {}, ...arcPieces([0, 0], 91, 98.9, -90, 270, 6).map(d => G('tyre', Fp(d, N))),
        h('path', { ...tag('tyre-tread'), 'data-ref': `${W}-tread`, d: treadD, fill: N }),
        h('path', { ...tag('tyre-tread'), 'data-ref': `${W}-treadblur`, d: ringD([0, 0], 98.7, 99.9), fill: N, 'fill-rule': 'evenodd', opacity: 0 }),
        ...arcPieces([0, 0], 91.9, 92.4, -90, 270, 6).map(d => h('path', { ...tag('tyre-bead-line'), d, fill: B })),
        ...tyreText.map(d => h('path', { ...tag('tyre-sidewall-lettering'), d, fill: P }))),
      h('g', {}, ...arcPieces([0, 0], 88, 91, -90, 270, 8).map(d => G('rim', Fp(d, P))),
        ...arcPieces([0, 0], 89.55, 89.95, -90, 270, 8).map(d => h('path', { ...tag('rim-brake-track'), d, fill: B })),
        h('g', { 'data-ref': `${W}-fine` },
          h('path', { ...tag('rim-eyelets'), d: eyeletD, fill: N }),
          h('use', { href: '#bike-spk-nip', ...tag('spoke-nipples') }))),
      h('g', { 'data-ref': `${W}-spkN`, ...tag('spokes-near') }, ...ghosts('near')),
      // hub (front flange visible; the rear one sits under the 16T cog)
      rear ? '' : G('hub-front',
        Fp(circ([0, 0], 8.6), P), Fp(ringD([0, 0], 8.1, 8.9), N, { 'fill-rule': 'evenodd' }), Fp(ringD([0, 0], 3.9, 5.1), B, { 'fill-rule': 'evenodd' }),
        h('path', { ...tag('hub-spoke-heads'), 'data-ref': `${W}-heads`, d: LACING.filter(s => s.side === 'near').map(s => circ(pol([0, 0], FLANGE_R, s.ah), 0.75)).join(''), fill: N })),
      // valve (true rotation marker)
      G('valve', h('g', { transform: `rotate(${f(vg + 90)})` },
        Fp(rrect([0, 0], [0, 1], -88.4, -79.5, -1.15, 1.15, 0.5), P), Fp(rrect([0, 0], [0, 1], -87.6, -86, -2.1, 2.1, 0.5), N),
        Fp(rrect([0, 0], [0, 1], -81.6, -77.2, -1.6, 1.6, 0.8), N), S(`M-0.6 -80.8L-0.6 -78.2`, P, 0.5))),
      G('rim-decal', Fp(band([0, 0], 88.3, 90.8, vg + 180 - 3.2, vg + 180 + 3.2), R), Fp(band([0, 0], 89.2, 89.9, vg + 180 - 2.2, vg + 180 + 2.2), P)),
      // spoke reflector (true rotation marker), clipped on the spoke
      G(rear ? 'spoke-reflector-rear' : 'spoke-reflector-front', h('g', { transform: `translate(${pt(rp)}) rotate(${f(ra)})` },
        Fp(rrect([0, 0], [1, 0], -7.5, 7.5, -3.6, 3.6, 2.2), rear ? R : P), Fp(rrect([0, 0], [1, 0], -6.2, 6.2, -2.3, 2.3, 1.3), rear ? O : B, { opacity: 0.55 }),
        S('M-4.5 -2L-2 2M-1.2 -2L1.3 2M2.1 -2L4.6 2', rear ? K : P, 0.55), S('M-7.5 0L7.5 0', N, 0.5, { opacity: 0.6 }))),
    );
  }
  slots.wheelRear = wheel('rear');
  slots.wheelFront = wheel('front');

  // ============================================================ FRAME (rider space, static)
  let fr = '';
  // --- motion swooshes (static, two inks, fade in with speed)
  const swoosh = (c, r, a0, span, w, ink) => {
    const A = [], Bq = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12, a = a0 + span * t, ww = w * Math.pow(t, 0.85) * (t > 0.9 ? Math.sqrt((1 - t) / 0.1) * 0.6 + 0.4 : 1); A.push(pol(c, r + ww / 2, a)); Bq.push(pol(c, r - ww / 2, a)); }
    return Fp(poly([...A, ...Bq.reverse()]), ink);
  };
  const swooshes = c => h('g', {}, ...[0, 1, 2].map(k => swoosh(c, 76, k * 120 + 10, 44, 3.4, P)), ...[0, 1, 2].map(k => swoosh(c, 58, k * 120 + 70, 38, 2.8, B)));
  fr += h('g', { ...tag('wheel-motion-swooshes'), 'data-ref': 'bike-swoosh', opacity: 0 }, swooshes(RH), swooshes(FH));

  // --- fenders: filled bands (P) with R pinstripe and a B underside line
  const fender = (c, a0, a1, name) => { const n = Math.round((a1 - a0) / 32), A = arcPieces(c, 103.2, 108.2, a0, a1, n), U = arcPieces(c, 103.2, 104, a0, a1, n), Pn = arcPieces(c, 105.5, 106.3, a0 + 4, a1 - 4, n);
    return A.map((d, i) => G(name, Fp(d, P), Fp(U[i], B), h('path', { ...tag('fender-pinstripe'), d: Pn[i], fill: R }))).join(''); };
  fr += fender(RH, -200, -12, 'fender-rear') + fender(FH, -121, 27, 'fender-front');
  { // front fender mascot (deco flying fish), front reflector, rear winged roundel
    const mA = -52, mp = pol(FH, 107.6, mA);
    fr += G('fender-mascot', h('g', { transform: `translate(${pt(mp)}) rotate(${f(mA + 90)})` },
      Fp('M-5 0.8L5 0.8L4 -1L-4 -1Z', N), Fp('M-7.4 -0.6Q-6 -6.2 2.4 -6.8Q7.6 -7 10.4 -3.6L6.4 -2.6Q3 -0.8 -7.4 -0.6Z', P),
      Fp('M-1 -5.8L-7.8 -11.6L1.6 -6.6Z', P), S('M-4.8 -2.2Q1 -3.4 6.6 -3.2', R, 0.6), Fp(circ([6.6, -4.8], 0.6), N), Fp('M-6.6 -0.8L-11 -3.8L-10 0.2Z', R)));
    fr += G('fender-reflector-front', h('g', { transform: `translate(${pt(pol(FH, 105.7, -4))}) rotate(${f(-4 + 90)})` }, Fp(rrect([0, 0], [1, 0], -4.2, 4.2, -2.2, 2.2, 1), P), S('M-3 -1L-1.6 1M-0.6 -1L0.8 1M1.8 -1L3.2 1', B, 0.45)));
    fr += G('fender-emblem-rear', h('g', { transform: `translate(${pt(pol(RH, 105.7, -148))}) rotate(${f(-148 + 90)})` },
      Fp('M-2.6 0L-9 -1.4L-8 0L-9 1.4Z', R), Fp('M2.6 0L9 -1.4L8 0L9 1.4Z', R), Fp(circ([0, 0], 2.6), R), Fp(circ([0, 0], 1.6), P), Fp(circ([0, 0], 0.6), R)));
  }
  // fender stays + bolts
  const eyeR = add(RH, [-3.2, 4.4]), eyeF = add(FH, [3.2, 3.6]);
  const stayEnds = [[RH, eyeR, 163], [RH, eyeR, 197], [FH, eyeF, 8], [FH, eyeF, -17]];
  fr += h('path', { ...tag('fender-stays'), d: stayEnds.map(([c, e, a]) => seg(pol(c, 103.6, a), e)).join(''), stroke: P, 'stroke-width': 1.35, fill: 'none', 'stroke-linecap': 'round' });
  fr += perSub('fender-bolts', stayEnds.map(([c, , a]) => circ(pol(c, 105.7, a), 1.05)).join('') + circ(onSS(105.7), 1.2), { fill: N });
  // rear fender reflector
  fr += G('rear-reflector', h('g', { transform: `translate(${pt(pol(RH, 105.7, 176))}) rotate(${f(176 + 90)})` },
    Fp(rrect([0, 0], [1, 0], -6, 6, -2.3, 2.3, 1.2), R), S('M-4.5 0H4.5', K, 0.6), S('M-3 -1.2L-1.5 1.2M0 -1.2L1.5 1.2M3 -1.2L4.2 0.8', O, 0.45)));
  // front mud flap (N rubber) with a P fish emblem
  {
    const a = pol(FH, 103.4, 24), b = pol(FH, 108.4, 23), fp = [a, b, [b[0] + 2.6, b[1] + 17], [a[0] + 1.4, a[1] + 18.4]];
    const m = lerp2(lerp2(fp[0], fp[1], 0.5), lerp2(fp[2], fp[3], 0.5), 0.55);
    fr += G('mud-flap', Fp(poly(fp), N), S(seg(lerp2(fp[3], fp[2], 0.1), lerp2(fp[3], fp[2], 0.9)), B, 0.6));
    fr += G('mud-flap-emblem', Fp(`M${pt(add(m, [-2.3, 0]))}Q${pt(add(m, [0, -2.2]))} ${pt(add(m, [2.4, 0]))}Q${pt(add(m, [0, 2.2]))} ${pt(add(m, [-2.3, 0]))}ZM${pt(add(m, [-2.1, 0]))}L${pt(add(m, [-3.9, -1.5]))}L${pt(add(m, [-3.9, 1.5]))}Z`, P));
  }

  // --- kickstand (folded along the chainstay) + chainguard stays (both behind the chain)
  {
    const mp = onCS(len(sub(BB, RH)) - 36), leg0 = add(mp, [-2, 3.2]), leg1 = add(onCS(len(sub(BB, RH)) - 102), [0, 9.6]);
    fr += G('kickstand-plate', Fp(rrect(mp, uCS, -6, 6, -3.2, 4.4, 1), P), Fp(circ(add(mp, rot([-3.2, 0.6], CS_ANG)), 0.9) + circ(add(mp, rot([3.2, 0.6], CS_ANG)), 0.9), N),
      S(curve([add(mp, [-4, 3]), add(mp, [-8, 5.6]), add(mp, [-13, 4.2]), add(mp, [-17, 6])], 3), P, 0.9));
    fr += G('kickstand', Fp(taper([leg0, lerp2(leg0, leg1, 0.5), leg1], 3.6, 2.6), N), S(seg(add(leg0, [-2, -0.8]), add(leg1, [0, -1.1])), P, 0.6),
      Fp(rrect(leg1, norm(sub(leg1, leg0)), -1.5, 3.5, -2.6, 2.6, 1.2), N));
    fr += G('chainguard-stays', S(seg([-73, -113.4], onCS(len(sub(BB, RH)) - 72)), N, 1.6), Fp(rrect(onST(35), uST, -1.6, 1.6, -5, 5, 0.6), N), S(seg(onST(35), [-3, -115]), N, 1.6));
  }

  // --- rear rack, towel, plate, rear light (behind the frame tubes)
  {
    const yT = -216.5, x0 = -57, x1 = -194;
    const s1a = [-190, yT], s2a = [-151, yT], e1 = add(RH, [-4.5, -3]), e2 = add(RH, [-2.4, -4.6]);
    fr += G('rack-struts', S(seg(s1a, e1), P, 2.1), Fp(circ(e1, 1.5), N)) + G('rack-struts', S(seg(s2a, e2), P, 2.1), Fp(circ(e2, 1.3), N));
    let ties = ''; for (let x = x0 - 8; x > x1 + 4; x -= 11) ties += seg([x, yT], [x, yT - 3.6]);
    fr += G('rack', S(seg([x0, yT], [x1, yT]) + seg([x0 - 4, yT - 3.6], [x1 + 2, yT - 3.6]), P, 1.9),
      S(ties, P, 1.1), S(curve([[x1, yT], [x1 - 4.2, yT - 1.6], [x1 - 4.4, yT - 4.6], [x1 + 2, yT - 3.6]], 3), P, 1.9),
      S(seg([x0, yT], onSS(SS_LEN - 18.5)), P, 2.2), Fp(circ(onSS(SS_LEN - 18.5), 1.4), N));
    fr += G('rack-spring-clip', S(seg([x1 + 1, yT - 5.6], [-178, yT - 5.6]) + `M${x1 + 1} ${yT - 5.6}Q${x1 - 3} ${yT - 5} ${x1 - 1.6} ${yT - 2.4}`, P, 1.4), S(`M${x1 + 1.6} ${yT - 3.4}q1 -1.6 2 0q1 1.6 2 0q1 -1.6 2 0`, B, 0.6));
    // rolled beach towel (axis along the bike): R/P stripes, spiral end, two leather straps
    const tx0 = -176, tx1 = -94, ty0 = yT - 25, ty1 = yT - 2;
    const tw = `M${tx0 + 5} ${ty0}H${tx1 - 3}Q${tx1 + 2} ${(ty0 + ty1) / 2} ${tx1 - 3} ${ty1}H${tx0 + 5}Z`;
    let stripes = ''; for (let x = tx0 + 9, i = 0; x < tx1 - 6; x += 8.2, i++) if (i % 2 === 0) stripes += `M${x} ${ty0}h4.1v${ty1 - ty0}h-4.1Z`;
    fr += G('towel', Fp(tw, K), Fp(`M${tx0 + 5} ${ty0}Q${tx0 - 1.5} ${(ty0 + ty1) / 2} ${tx0 + 5} ${ty1}Z`, P));
    fr += h('path', { ...tag('towel-stripes'), d: stripes, fill: R });
    fr += h('path', { ...tag('towel-spiral'), d: `M${tx0 + 4.4} ${ty0 + 2}Q${tx0 + 0.6} ${(ty0 + ty1) / 2} ${tx0 + 4.4} ${ty1 - 2}M${tx0 + 3.2} ${ty0 + 5.5}Q${tx0 + 1} ${(ty0 + ty1) / 2} ${tx0 + 3.2} ${ty1 - 5.5}` + seg([tx0 + 3.8, ty1 - 0.6], [tx0 + 16, ty1 + 0.3]), fill: 'none', stroke: R, 'stroke-width': 0.9, 'stroke-linecap': 'round' });
    let straps = '', buckles = '';
    for (const x of [tx0 + 20, tx1 - 22]) { straps += `M${x} ${ty0 - 0.8}h3.4v${ty1 - ty0 + 3.4}h-3.4Z`; buckles += rrect([x - 0.9, ty0 + 7], [1, 0], 0, 5.2, 0, 4.4, 0.6); }
    let fringe = ''; for (let x = tx0 + 6; x < tx0 + 17; x += 1.8) fringe += `M${f(x)} ${ty1 - 0.2}l${f(-0.6)} 3.2`;
    fr += h('path', { ...tag('towel-fringe'), d: fringe, stroke: P, 'stroke-width': 0.7, fill: 'none', 'stroke-linecap': 'round' });
    fr += G('towel-straps', Fp(straps, N), Fp(buckles, O, { 'fill-rule': 'evenodd' }), Fp(Array.from({ length: 2 }, (_, i) => rrect([tx0 + 20.4 + i * (tx1 - tx0 - 42), ty0 + 8.2], [1, 0], 0, 2.6, 0, 2, 0.3)).join(''), N));
    // licence plate bolted to the struts: 鹈鹕湾 001
    const cnW = textW('鹈鹕湾', 5.7), nmW = textW('001', 6.2, 0.2), pw = cnW + nmW + 7.6, px0 = -169 - pw / 2, px1 = -169 + pw / 2, py0 = yT + 2.2, py1 = yT + 15;
    fr += G('license-plate', Fp(rrect([px0, py0], [1, 0], 0, px1 - px0, 0, py1 - py0, 1.6), N), Fp(rrect([px0 + 0.9, py0 + 0.9], [1, 0], 0, px1 - px0 - 1.8, 0, py1 - py0 - 1.8, 1), P),
      S(`M${px0 + 2} ${py0 + 2.1}H${px1 - 2}`, B, 0.4));
    const gx = px0 + 3, gy = py1 - 3.1;
    fr += h('path', { ...tag('plate-text-cn'), d: textD('鹈鹕湾', 5.7, ([x, y]) => [gx + x, gy + y * 0.98]).d, fill: R });
    fr += h('path', { ...tag('plate-number'), d: textD('001', 6.2, ([x, y]) => [gx + cnW + 1.8 + x, gy - 0.1 + y], 0.2).d, fill: N });
    fr += G('plate-bolts', Fp(circ([px0 + 3, py0 + 2.4], 0.95) + circ([px1 - 3, py0 + 2.4], 0.95), N), Fp(circ([px0 + 3, py0 + 2.4], 0.35) + circ([px1 - 3, py0 + 2.4], 0.35), P));
    // rear light on the rack tail
    const L0 = [x1 - 9.5, yT + 3.2];
    fr += G('rear-light', Fp(rrect(add(L0, [4, -3.6]), [1, 0], 0, 6.4, 0, 2.4, 0.6), P),
      Fp(`M${pt(add(L0, [5.4, -5]))}Q${pt(add(L0, [-7.4, -5.4]))} ${pt(add(L0, [-6, 2.8]))}Q${pt(add(L0, [-2.2, 9]))} ${pt(add(L0, [5.4, 6.4]))}Z`, P),
      Fp(`M${pt(add(L0, [3.4, -3.3]))}Q${pt(add(L0, [-5, -3.6]))} ${pt(add(L0, [-4, 2.4]))}Q${pt(add(L0, [-1.2, 6.8]))} ${pt(add(L0, [3.4, 4.8]))}Z`, R),
      S(`M${pt(add(L0, [-2.4, -1.4]))}Q${pt(add(L0, [-3.2, 1.4]))} ${pt(add(L0, [-1.2, 3.6]))}`, K, 0.7), S(seg(add(L0, [4.4, -4.6]), add(L0, [4.4, 5.8])), R, 0.6),
      h('g', { 'data-ref': 'bike-rglow', style: 'opacity:var(--pb-n-lampOn)' }, Fp(circ(add(L0, [-1.5, 0.8]), 12), R, { opacity: 0.2 }), Fp(circ(add(L0, [-1.5, 0.8]), 7.5), R, { opacity: 0.32 }), Fp(circ(add(L0, [-1.4, 0.8]), 3.2), LAMPG)));
  }

  // --- frame tubes (T), rear triangle first
  const tubeS = (a, b, w, ink = T) => S(seg(a, b), ink, w, { 'stroke-linecap': 'butt' });
  const ssTop = onST(SS_LEN > 0 ? 159 - 6 : 0);
  const stay = (a, b, w0, w1, n, name) => Array.from({ length: n }, (_, i) => { const t0 = Math.max(0, i / n - 0.004), t1 = Math.min(1, (i + 1) / n + 0.004); return G(name, Fp(taper([lerp2(a, b, t0), lerp2(a, b, t1)], lerp(w0, w1, t0), lerp(w0, w1, t1)), T)); }).join('');
  fr += stay(RH, BB, 4.4, 6, 3, 'chainstay');
  fr += stay(RH, ssTop, 4, 5.4, 3, 'seat-stay');
  // frame pump along the seat stay (outboard of it)
  {
    const nS = perp(uSS), o = add(RH, mul(nS, 5.4)), pa = s => add(o, mul(uSS, s));
    fr += G('pump', Fp(rrect(pa(22), uSS, 0, 60, -2.3, 2.3, 1), P), S(seg(add(pa(26), mul(nS, -1.1)), add(pa(78), mul(nS, -1.1))), B, 0.6),
      Fp(rrect(pa(20), uSS, 0, 4.4, -2.6, 2.6, 1.2), N));
    let ribs = ''; for (let s = 83.5; s < 94; s += 1.7) ribs += seg(add(pa(s), mul(nS, -2.6)), add(pa(s), mul(nS, 2.6)));
    fr += G('pump-grip', Fp(rrect(pa(82), uSS, 0, 12.5, -2.9, 2.9, 1.4), N), S(ribs, P, 0.45));
    fr += G('pump-hose', S(splitQ(resample([pa(20), add(pa(17), mul(nS, 1.5)), add(pa(19), mul(nS, 4.6)), add(pa(28), mul(nS, 3.6)), add(pa(34), mul(nS, 2.8))], 3)), N, 1.2), Fp(rrect(add(pa(34), mul(nS, 2.8)), uSS, 0, 3.6, -1.3, 1.3, 0.5), P));
    fr += G('pump-pegs', S(seg(pa(34), onSS(34)) + seg(pa(86), onSS(86)), N, 1.8));
  }
  // brake bridge + rear calliper (behind the seat tube, over the wheel)
  fr += G('brake-bridge', Fp(rrect(onSS(107.5), uSS, -2.2, 2.2, -3.4, 3.4, 1), T), Fp(circ(onSS(107.5), 1.2), N));
  const calliper = (bolt, pad, name, bow) => {
    const dir = norm(sub(pad, bolt)), nn = perp(dir), end = add(pad, mul(dir, -1.4));
    const C = quadPts(bolt, add(lerp2(bolt, end, 0.45), mul(nn, 3.6 * bow)), end, 8);
    const Cf = C.map(p => add(p, mul(nn, -1.7 * bow)));
    const anc = add(C[3], mul(nn, 3.2 * bow));
    return G(name, Fp(taper(Cf, 3.6, 2.2), F.P), S(`M${pt(add(bolt, mul(nn, -3 * bow)))}Q${pt(add(bolt, mul(dir, -3.4)))} ${pt(add(bolt, mul(nn, 3 * bow)))}`, P, 0.6),
      Fp(taper(C, 4.4, 2.8), P), S(splitQ(C.slice(1, 7).map(p => add(p, mul(nn, 0.9 * bow)))), B, 0.55),
      Fp(rrect(end, dir, -1, 1.6, -2.2, 2.2, 0.6), P), Fp(hex(bolt, 2.2, 30), N), Fp(circ(bolt, 0.85), P),
      S(seg(C[3], anc), P, 1.6), Fp(circ(anc, 1.25), N), Fp(circ(anc, 0.45), P));
  };
  const cAnchor = (bolt, pad, bow) => { const dir = norm(sub(pad, bolt)), nn = perp(dir), end = add(pad, mul(dir, -1.4)); return add(quadPts(bolt, add(lerp2(bolt, end, 0.45), mul(nn, 3.6 * bow)), end, 8)[3], mul(nn, 3.2 * bow)); };
  const padAt = (c, r, a) => G('brake-pads', h('g', { transform: `translate(${pt(pol(c, r, a))}) rotate(${f(a + 90)})` }, Fp(rrect([0, 0], [1, 0], -4.2, 4.2, -1.4, 1.4, 0.8), N), S('M-3.4 0H3.4', B, 0.4)));
  const padRear = angOf(uSS);
  fr += padAt(RH, 89.6, padRear) + calliper(onSS(106.5), pol(RH, 91.5, padRear), 'calliper-rear', -1);

  // main triangle
  fr += pieces(BB, STT, 3).map(([a, b]) => G('seat-tube', tubeS(a, b, 8.4))).join('');
  fr += pieces(BB, add(HBB, mul(uDT, 2)), 3).map(([a, b]) => G('down-tube', tubeS(a, b, 9.4))).join('');
  fr += pieces(STT, add(HTT, mul(uTT, 2)), 3).map(([a, b]) => G('top-tube', tubeS(a, b, 8.4))).join('');
  // highlight + rim light + pinstripe bands
  const hl = (a, b, off, n) => seg(add(a, mul(n, off)), add(b, mul(n, off)));
  fr += perSub('frame-highlight', hl(onDT(40), onDT(DT_LEN - 18), -2.6, perp(uDT)) + hl(onTT(16), onTT(146), 2.3, mul(perp(uTT), -1)) + hl(onST(38), onST(142), 2.3, nST) + hl(onCS(10), onCS(90), 1.3, mul(perp(uCS), -1)) + hl(onSS(14), onSS(138), 1.2, perp(uSS)), { fill: 'none', stroke: P, 'stroke-width': 0.85, 'stroke-linecap': 'round', opacity: 0.85 });
  fr += perSub('frame-rim-light', hl(onDT(44), onDT(DT_LEN - 20), 3.9, mul(perp(uDT), -1)) + hl(onTT(20), onTT(140), -3.6, perp(uTT)) + hl(onSS(16), onSS(136), -2.1, mul(perp(uSS), -1)), { fill: 'none', stroke: RIM, 'stroke-width': 0.9, 'stroke-linecap': 'round', style: 'opacity:var(--pb-n-rimAlpha)' });
  const bandsAt = (p, u, w) => rrect(p, u, -0.55, 0.55, -w / 2, w / 2) + rrect(add(p, mul(u, 1.9)), u, -0.3, 0.3, -w / 2, w / 2);
  fr += [[onTT(22), uTT, 8.4], [onTT(138), mul(uTT, -1), 8.4], [onDT(DT_LEN - 23), mul(uDT, -1), 9.4], [onST(137), mul(uST, -1), 8.4], [onDT(44), uDT, 9.4]].map(([p, u, w]) => h('path', { ...tag('frame-pinstripe-bands'), d: bandsAt(p, u, w), fill: R })).join('');

  // --- lugs (P with R lining) : sleeve + spearpoint along a tube
  const lug = (p, dir, s0, s1, w, tip) => {
    const nn = perp(dir), hw = w / 2, q = (s, o) => add(add(p, mul(dir, s)), mul(nn, o));
    const d = `M${pt(q(s0, hw))}L${pt(q(s1, hw))}Q${pt(q(s1 + tip * 0.55, hw * 0.78))} ${pt(q(s1 + tip, 0))}Q${pt(q(s1 + tip * 0.55, -hw * 0.78))} ${pt(q(s1, -hw))}L${pt(q(s0, -hw))}Z`;
    const line = `M${pt(q(s1 - 1.2, hw - 1.05))}Q${pt(q(s1 + tip * 0.45, hw * 0.5))} ${pt(q(s1 + tip - 2.4, 0))}Q${pt(q(s1 + tip * 0.45, -hw * 0.5))} ${pt(q(s1 - 1.2, -(hw - 1.05)))}`;
    return [d, tip > 1 ? line : ''];
  };
  const LUGS = {
    'lug-seat': [lug(STT, mul(uST, -1), -3.4, 9, 10.2, 8), lug(STT, uTT, 2, 10, 10.2, 8)],
    'lug-head-top': [lug(HTT, mul(uTT, -1), 1.5, 9, 10.2, 8.5), lug(HTT, uHT, -2.8, 10, 12.6, 0.01)],
    'lug-head-bottom': [lug(HBB, mul(uDT, -1), 1, 10, 11.2, 9), lug(HBB, mul(uHT, -1), -2.8, 9, 12.6, 0.01)],
    'bb-lug-points': [lug(BB, uDT, 0, 30, 11.2, 9), lug(BB, uST, 0, 30, 10.2, 8.5), lug(BB, mul(uCS, -1), 0, 29, 7.8, 7)],
  };
  // head tube (between its lugs)
  fr += G('head-tube', Fp(rrect(HTT, uHT, -1, HT_LEN + 1, -5.3, 5.3), T));
  for (const [name, parts] of Object.entries(LUGS)) { const ln = parts.map(p => p[1]).join(''); fr += G(name, Fp(parts.map(p => p[0]).join(''), P), ln ? h('path', { ...tag('lug-lining'), d: ln, fill: 'none', stroke: R, 'stroke-width': 0.6, 'stroke-linecap': 'round' }) : ''); }
  // seat-stay wrap-over caps + seat binder bolt
  fr += G('seat-stay-caps', Fp(`M${pt(add(ssTop, rot([-3.2, -3.4], SS_ANG)))}Q${pt(add(ssTop, rot([4.6, 0], SS_ANG)))} ${pt(add(ssTop, rot([-3.2, 3.4], SS_ANG)))}Z`, P), S(seg(add(ssTop, rot([-2.4, -2.2], SS_ANG)), add(ssTop, rot([-2.4, 2.2], SS_ANG))), R, 0.5));
  const binder = add(onST(152), mul(nST, -6.4));
  fr += G('seat-binder-bolt', Fp(rrect(add(onST(149), mul(nST, -4)), uST, 0, 7.6, -3.3, 0, 1), P), Fp(hex(binder, 1.9, 15), N), Fp(circ(binder, 0.7), P));
  // head badge (on the head tube) with a pelican emblem and two rivets
  {
    const c = onHT(HT_LEN * 0.47), a = HT_ANG - 90;
    const sh = 'M-4 -9L4 -9L4.6 -8.2L4.6 3.5Q4.6 7 0 10.2Q-4.6 7 -4.6 3.5L-4.6 -8.2Z';
    const inner = 'M-3 -7.5L3 -7.5L3.4 -7L3.4 3.1Q3.4 5.8 0 8.4Q-3.4 5.8 -3.4 3.1L-3.4 -7Z';
    // pelican emblem: head + long bill + pouch, facing forward
    const pel = 'M-2 -1.4Q-2.4 -4.4 -0.2 -4.9Q1.4 -5.1 1.8 -3.8L3.1 -3.2L1.7 -2.4Q0.4 -1.2 0.9 1.2Q1.2 3.2 -0.6 4.8Q-2.2 3.2 -2 -1.4Z';
    fr += h('g', { transform: `translate(${pt(c)}) rotate(${f(a)})` },
      G('head-badge', Fp(sh, N), Fp(inner, O), Fp('M-3 -7.5L3 -7.5L3.4 -7L3.4 -4.8L-3.4 -4.8L-3.4 -7Z', R), S('M-2.6 5.6Q0 7.8 2.6 5.6', R, 0.5)),
      G('head-badge-pelican', Fp(pel, P), Fp('M1.7 -2.4L3.1 -3.2Q1.6 -0.6 0.4 -1.3Z', K), Fp(circ([0.35, -3.7], 0.35), N)),
      G('head-badge-rivets', Fp(circ([0, -6.2], 0.75) + circ([0, 7.3], 0.75), P), Fp(circ([0, -6.2], 0.3) + circ([0, 7.3], 0.3), N)));
  }
  // down-tube decal: 鹈鹕 + PELICAN, P letters with an R drop line and deco speed lines
  {
    const s0 = 64, a = DT_ANG, o = onDT(s0);
    const map = (x, y) => add(o, rot([x, y], a));
    const cn = textD('鹈鹕', 6.4), lat = textD('PELICAN', 5.8, p => p, 0.25);
    const yb = 2.9, cnd = textD('鹈鹕', 6.4, ([x, y]) => map(x, yb + 0.1 + y * 0.92)).d;
    const ld = textD('PELICAN', 5.8, ([x, y]) => map(cn.w + 3.4 + x, yb - 0.25 + y), 0.25).d;
    const sh = textD('PELICAN', 5.8, ([x, y]) => map(cn.w + 3.4 + x + 0.45, yb + 0.2 + y), 0.25).d;
    const end = cn.w + 3.4 + lat.w;
    fr += G('decal-latin', Fp(sh, R), Fp(ld, P)) + h('path', { ...tag('decal-cn'), d: cnd, fill: P });
    fr += h('path', { ...tag('decal-flourish'), d: seg(map(-9, -1.6), map(-3, -1.6)) + seg(map(-12, 0.4), map(-3, 0.4)) + seg(map(-7.5, 2.4), map(-3, 2.4)) + seg(map(end + 2.4, -1.6), map(end + 12, -1.6)) + seg(map(end + 2.4, 0.4), map(end + 8, 0.4)), stroke: P, 'stroke-width': 0.9, fill: 'none', 'stroke-linecap': 'round' });
  }
  // bottle cage + bottle on the seat tube
  {
    const off = 15.4, o = add(BB, mul(nST, off)), q = (s, y) => add(add(o, mul(uST, s)), mul(nST, y));
    const bot = `M${pt(q(42, -9.2))}L${pt(q(88, -9.2))}Q${pt(q(95, -9.2))} ${pt(q(97, -4.4))}L${pt(q(97, 4.4))}Q${pt(q(95, 9.2))} ${pt(q(88, 9.2))}L${pt(q(42, 9.2))}Q${pt(q(38.6, 9.2))} ${pt(q(38.6, 5.4))}L${pt(q(38.6, -5.4))}Q${pt(q(38.6, -9.2))} ${pt(q(42, -9.2))}Z`;
    let bparts = '';
    bparts += G('bottle-label', Fp(`M${pt(q(56, -9.2))}L${pt(q(78, -9.2))}L${pt(q(78, 9.2))}L${pt(q(56, 9.2))}Z`, T),
      Fp(`M${pt(q(61, -3))}Q${pt(q(67, -5.4))} ${pt(q(72.5, 0))}Q${pt(q(67, 5.4))} ${pt(q(61, 3))}ZM${pt(q(61.5, 0))}L${pt(q(58.2, -3))}L${pt(q(58.2, 3))}Z`, P), Fp(circ(q(70.2, -0.8), 0.6), T));
    let rid = ''; for (let s = 99; s < 105.6; s += 1.6) rid += seg(q(s, -4.6), q(s, 4.6));
    bparts += G('bottle-cap', Fp(rrect(q(97, 0), uST, 0, 9.4, -4.6, 4.6, 1.2), R), S(rid, N, 0.45), Fp(rrect(q(106.2, 0), uST, 0, 2.6, -2.2, 2.2, 0.8), N));
    fr += G('bottle', Fp(bot, P), S(seg(q(44, -6.6), q(88, -6.6)), B, 1.1, { opacity: 0.8 }), S(seg(q(44, 6.7), q(86, 6.7)), P, 0.8), bparts);
    fr += G('bottle-cage', S(`M${pt(q(47, -10.2))}L${pt(q(84, -10.2))}Q${pt(q(89, -10.2))} ${pt(q(89, -6))}M${pt(q(47, 10.2))}L${pt(q(82, 10.2))}M${pt(q(41, -10.2))}Q${pt(q(36.8, -10.2))} ${pt(q(36.8, -4))}L${pt(q(36.8, 5))}Q${pt(q(36.8, 10.2))} ${pt(q(42, 10.2))}` + seg(q(52, -10.2), onST(52)) + seg(q(80, -10.2), onST(80)), N, 1.15),
      Fp(circ(onST(52), 1.3) + circ(onST(80), 1.3), P));
  }
  // rear dropout plate (under the cog) + BB shell
  fr += G('dropout-rear', Fp(`M${pt(onSS(15))}L${pt(add(onSS(15), mul(perp(uSS), -3)))}Q${pt(add(RH, [-10, -3]))} ${pt(add(RH, [-9.5, 3.2]))}Q${pt(add(RH, [-4, 9.4]))} ${pt(add(onCS(14), mul(perp(uCS), 2.6)))}L${pt(onCS(14))}Q${pt(add(RH, [5, -4]))} ${pt(onSS(15))}Z`, P),
    Fp(rrect(add(RH, [-7, 0]), [1, 0], 0, 7, -1.9, 1.9, 1.9), N), Fp(circ(eyeR, 1.7), P), Fp(circ(eyeR, 0.7), N));
  // rear brake housing along the top tube with clips, into the rear calliper
  {
    const top = (s, off) => add(onTT(s), mul(perp(uTT), -off));
    fr += G('brake-housing-rear', S(splitQ(resample([top(150, 5.2), top(110, 5.2), top(60, 5.2), top(14, 5.2), top(4, 6.6), add(STT, [-9, -3]), add(STT, [-16, 9]), onSS(116), onSS(112)], 3)), N, 1.7));
    fr += [128, 76, 26].map(s => G('cable-clips', Fp(rrect(onTT(s), uTT, -1.3, 1.3, -6.9, 4.4, 0.6), P), Fp(circ(add(onTT(s), mul(perp(uTT), 3.4)), 0.8), N))).join('');
    fr += G('cable-ferrules', Fp(rrect(onSS(112.8), mul(uSS, -1), 0, 2.4, -1.25, 1.25, 0.4), P), S(seg(onSS(110.4), add(onSS(106.5), mul(perp(uSS), 2.6))), P, 0.55));
  }
  // lamp wire from the dynamo, along the down tube and chainstay to the rear lamp (clipped)
  fr += G('lamp-wire', S(splitQ(resample([add(onDT(DT_LEN - 30), mul(perp(uDT), 5.1)), add(onDT(90), mul(perp(uDT), 5.1)), add(onDT(40), mul(perp(uDT), 5.1)), add(BB, [-2, 12]), add(onCS(60), mul(perp(uCS), -3.4)), add(onCS(16), mul(perp(uCS), -3.4)), add(RH, [-1, -7.5]), lerp2(add(RH, [0.8, -6.8]), [-147.6, -214.5], 0.5), [-147.6, -213.6], [-176, -213.8], [-196, -213.8]], 3)), N, 0.7),
    Fp([onDT(120), onDT(70)].map(p => circ(add(p, mul(perp(uDT), 5.1)), 1)).join(''), P));
  // seatpost, clamp, saddle
  fr += G('seatpost', tubeS(STT, SCL, 5.6, P), S(seg(add(STT, mul(nST, -1.4)), add(SCL, mul(nST, -1.4))), B, 0.7));
  {
    // sprung leather saddle (B67-style): rails loop under two big coil springs that carry the cantle
    const railPts = [[-28.5, -282.2], [-42, -277.8], [-60.5, -275], [-78, -270.8], [-90.5, -267], [-98.5, -266.5], [-102.8, -267.6], [-103.8, -270.6]];
    fr += G('saddle-rails', S(curve(railPts.map(p => add(p, [-2.6, -1.2])), 3), F.P, 1.4), S(curve(railPts, 3), P, 1.8), S(curve(railPts.slice(1, 5), 3), B, 0.5, { transform: 'translate(0 0.7)' }));
    const coil = (x, yb, yt, w, turns) => {
      const st = (yb - yt) / turns; let front = '', back = '';
      for (let i = 0; i < turns; i++) { const y = yt + st * i; front += seg([x - w, y + st * 0.05], [x + w, y + st * 0.55]); back += seg([x + w, y + st * 0.55], [x - w, y + st * 1.05]); }
      return [front, back];
    };
    const cf = coil(-98.6, -267, -279.4, 3, 5), cn = coil(-90.6, -266.8, -279.6, 3.4, 5);
    fr += G('saddle-springs', S(cf[0], F.B, 1.1), S(cn[1], F.P, 0.8), S(cn[0], P, 1.25), Fp(rrect([-94.6, -280.6], [1, 0], 0, 8, 0, 1.6, 0.6) + rrect([-94.6, -267.4], [1, 0], 0, 8, 0, 1.8, 0.6), P));
    fr += G('seat-clamp', Fp(rrect([-60.5, -276], [1, 0], -5.2, 5.2, -3, 3.8, 1.2), P), Fp(hex([-60.5, -275.4], 2, 0), N), Fp(circ([-60.5, -275.4], 0.75), P), S('M-65.4 -277.2H-55.6', B, 0.5));
    // leather (N): domed top, deep rolled skirt flaring at the cantle
    const top = 'M-22.2 -284.2Q-24 -286.4 -33 -287.1Q-50 -288 -64 -287.9Q-86 -287.8 -100.2 -288.8Q-104.4 -288.8 -104.2 -284.6Q-103.8 -279.8 -99.4 -278.8Q-92 -278.4 -84 -279.4Q-66 -281.6 -46 -281.9Q-31 -282 -24.2 -282.4Q-21.6 -283 -22.2 -284.2Z';
    fr += G('saddle', Fp(top, N), S('M-100 -280.6Q-92 -280.2 -84 -281.1Q-66 -283.1 -46 -283.4Q-32 -283.5 -25 -283.6', B, 0.6), Fp('M-34 -282.4L-25 -282.8L-25.6 -280.8L-33.4 -280.6Z', P), Fp(hex([-30.6, -280], 1.2, 0), N));
    fr += G('saddle-sheen', S('M-99.4 -287.4Q-84 -286.9 -64 -287Q-46 -286.9 -31 -286', K, 0.85, { opacity: 0.85 }));
    fr += G('saddle-stitching', S('M-101.4 -281.8Q-92 -281.3 -84 -282.2Q-66 -284.2 -46 -284.5Q-33 -284.6 -26 -284.6', P, 0.42, { 'stroke-dasharray': '0.9 1.2' }));
    fr += G('saddle-cantle-plate', Fp('M-104 -280.2Q-102.6 -277.2 -97.6 -277.4L-84 -278.2L-84.2 -276.8L-97.8 -276Q-103.4 -276.2 -104.6 -279.4Z', P), S('M-102 -277.6Q-99 -276.6 -95 -276.8', B, 0.4));
    const rv = [[-102.2, -284.2], [-99.6, -281.4], [-95.6, -280.4], [-91.4, -280.3], [-87.2, -280.7], [-27.4, -284.6]];
    fr += G('saddle-rivets', Fp(rv.map(p => circ(p, 1.12)).join(''), O), Fp(rv.map(p => circ(add(p, [-0.3, -0.35]), 0.4)).join(''), K));
    fr += G('saddle-bag-loops', S('M-96 -276.4q0.2 3 2.8 3M-86.4 -277.4q0.2 3 2.8 3', P, 0.95));
  }
  fr += anchor('rearHub', RH) + anchor('frontHub', FH) + anchor('bb', BB) + anchor('saddleTop', BIKE.saddleTop);
  slots.frame = fr;

  // ============================================================ FORK + front fittings (rider space, static)
  let fk = '';
  // headset: bottom cup, top cup, lock ring, knurled locknut
  fk += G('headset-cups', Fp(rrect(HBB, uHT, 0.2, 3.6, -6.4, 6.4, 0.8), P), Fp(rrect(HTT, uHT, -3.4, 0, -6.4, 6.4, 0.8), P), Fp(rrect(HTT, uHT, -4.4, -3.4, -5.6, 5.6), N));
  {
    let kn = ''; for (let y = -5; y <= 5; y += 1.25) kn += seg(add(onHT(-8.6), mul(perp(uHT), y)), add(onHT(-4.8), mul(perp(uHT), y)));
    fk += G('headset-knurl', Fp(rrect(HTT, uHT, -8.8, -4.4, -6, 6, 0.6), P), S(kn, B, 0.45));
  }
  // fork blade (T) along the raked centreline + P crown
  { const k = 9, n = FORK_C.length; fk += G('fork-blade', Fp(taper(FORK_C.slice(0, k + 1), 7.4, lerp(7.4, 4.6, k / (n - 1))), T)); fk += G('fork-blade', Fp(taper(FORK_C.slice(k), lerp(7.4, 4.6, k / (n - 1)), 4.6), T)); }
  fk += h('g', {}, S(splitQ(FORK_C.slice(1, -1).map((p, i, A) => add(p, mul(perp(norm(sub(A[Math.min(i + 1, A.length - 1)], A[Math.max(i - 1, 0)]))), -2)))), P, 0.8, { opacity: 0.8 }));
  fk += G('fork-crown', Fp(`M${pt(add(axis(3.6), mul(nHTf, -7.2)))}L${pt(add(axis(3.6), mul(nHTf, 7.2)))}Q${pt(add(axis(7.5), mul(nHTf, 7)))} ${pt(add(axis(11), mul(nHTf, 3.8)))}L${pt(add(axis(11), mul(nHTf, -3.8)))}Q${pt(add(axis(7.5), mul(nHTf, -7)))} ${pt(add(axis(3.6), mul(nHTf, -7.2)))}Z`, P),
    Fp(circ(axis(7), 1.25), N), S(`M${pt(add(axis(4.8), mul(nHTf, -5.4)))}Q${pt(axis(9.2))} ${pt(add(axis(4.8), mul(nHTf, 5.4)))}`, R, 0.5));
  fk += G('fork-end', Fp(`M${pt(add(FH, rot([-7.5, -2.8], angOf(sub(FH, FORK_C[FORK_C.length - 3])))))}L${pt(add(FH, rot([2.2, -3.4], angOf(sub(FH, FORK_C[FORK_C.length - 3])))))}Q${pt(add(FH, rot([5.8, 0], angOf(sub(FH, FORK_C[FORK_C.length - 3])))))} ${pt(add(FH, rot([2.2, 3.4], angOf(sub(FH, FORK_C[FORK_C.length - 3])))))}L${pt(add(FH, rot([-7.5, 2.4], angOf(sub(FH, FORK_C[FORK_C.length - 3])))))}Z`, P),
    Fp(circ(eyeF, 1.6), P), Fp(circ(eyeF, 0.65), N), G('axle-nut-front', Fp(hex(FH, 3.3, 0), N), Fp(hex(FH, 2.1, 30), B), Fp(circ(FH, 0.9), P)));
  // bottle dynamo on the blade, roller on the sidewall
  {
    const ad = -110, dv = [Math.cos(ad * D2R), Math.sin(ad * D2R)], q = (r, y) => add(add(FH, mul(dv, r)), mul(perp(dv), y));
    const body = `M${pt(q(68, -3.6))}L${pt(q(84, -2.7))}Q${pt(q(88.8, -2.3))} ${pt(q(89.2, 0))}Q${pt(q(88.8, 2.3))} ${pt(q(84, 2.7))}L${pt(q(68, 3.6))}Q${pt(q(66.8, 0))} ${pt(q(68, -3.6))}Z`;
    const bl = axis(len(sub(q(78, 0), HBB)) * 0.96);
    fk += G('dynamo-bracket', S(seg(q(77, 0), add(bl, mul(nHTf, 2.6))), N, 2.2), Fp(rrect(bl, uHT, -2.4, 2.4, -4.4, 4.4, 1), P), Fp(circ(add(bl, mul(nHTf, 1.2)), 0.8), N));
    fk += G('dynamo', Fp(body, P), Fp(`M${pt(q(71.5, -3.5))}L${pt(q(74.2, -3.3))}L${pt(q(74.2, 3.3))}L${pt(q(71.5, 3.5))}Z`, R), S(seg(q(76, -1.6), q(86, -1.3)), B, 0.6), Fp(rrect(q(65.6, 0), dv, 0, 2.6, -2.4, 2.4, 0.8), N));
    const rc = q(92.2, 0);
    let knurl = ''; for (let i = 0; i < 12; i++) knurl += seg(pol(rc, 1.2, i * 30), pol(rc, 2.3, i * 30));
    fk += G('dynamo-roller', Fp(circ(rc, 2.6), N), h('g', { 'data-ref': 'bike-roller', transform: `rotate(0 ${pt(rc)})` }, S(knurl, P, 0.45)));
    fk += S(splitQ(resample([q(65.8, 0), q(60, 3.5), add(axis(40), mul(nHTf, 6)), add(axis(20), mul(nHTf, 8.5)), [132, -209.5]], 3)), N, 0.7);
  }
  // front calliper at the crown, pads on the brake track where the blade crosses the rim
  {
    const padA = angOf(sub(axisAtR(89.5), FH));
    fk += padAt(FH, 89.6, padA) + calliper(add(axis(6.5), mul(nHTf, 5.5)), pol(FH, 91.6, padA), 'calliper-front', 1);
  }
  // ---- basket with fish (fish first, the wicker in front of them)
  {
    const { x0, x1, y0, y1 } = BIKE.basket, inset = 5;
    const xl = y => lerp(x0, x0 + inset, (y - y0) / (y1 - y0)), xr = y => lerp(x1, x1 - inset, (y - y0) / (y1 - y0));
    // stays to the axle + back bracket to the crown (carries the lamp too) + leather straps to the bar
    fk += G('basket-stays', S(seg([x0 + 9, y1 - 1], add(FH, [-1.6, -3])) + seg([x1 - 9, y1 - 1], add(FH, [2.6, -3])), P, 1.6), S(seg([x0 + 6, y1 - 2], add(axis(7), mul(nHTf, 3))), P, 2.2),
      Fp(circ([x0 + 9, y1 - 1], 1.2) + circ([x1 - 9, y1 - 1], 1.2), N));
    // fish
    const fishArt = kind => {
      const art = []; let spec = '';
      if (kind === 'mackerel') {
        const body = 'M27 0C22 -7 10 -9.4 -2 -8.4C-12 -7.4 -19 -4 -22 -1.2L-22 1.2C-19 4 -12 7.2 -2 8C10 8.8 22 6.4 27 0Z';
        spec = 'fish-mackerel'; art.push(h('g', {}, Fp(body, B), Fp('M27 0C22 5 10 8.4 -2 8C-12 7.4 -18 4.4 -22 1.2C-14 3.2 0 4.6 12 3.6C19 3 24 1.6 27 0Z', P)));
        art.push(G('fish-mackerel-stripes', S('M-16 -5Q-13 -2.6 -15 0M-11 -6.8Q-7.4 -3.4 -10 0.2M-6 -7.8Q-2 -4 -4.8 0.4M-0.6 -8.2Q3 -4.4 0.8 0.2M4.8 -8.3Q8 -4.6 6.2 -0.4M10 -7.9Q12.6 -4.6 11.4 -1.2', N, 1.05)));
        art.push(G('fish-fins', Fp('M-2 -8.2L1.6 -13.4L4 -12.2L6.4 -8.4Z', N), Fp('M6 7.6L3.2 12L0.2 8Z', F.B), Fp('M13 2.4Q8 5.2 6.4 7.4Q11.4 6 14.4 3.4Z', N), S('M1 -8.6L2.2 -12.2M3.4 -8.4L3.6 -11.8', P, 0.35)));
        art.push(G('fish-lateral-line', S('M-18 -0.6Q0 -3.4 16 -1.2', P, 0.5, { opacity: 0.8 })));
        art.push(G('fish-gills', S('M17.6 -5.4Q14.6 -1 17 4.4', N, 0.9), S('M24.4 1.4Q26 1.9 27 0.9', N, 0.6)));
        art.push(G('fish-mouths', S('M27 0.3L23.2 1.4', N, 0.6)));
        art.push(G('fish-eyes', Fp(circ([21.4, -2.4], 2.2), P), Fp(circ([21.8, -2.4], 1.25), N), Fp(circ([22.3, -2.9], 0.42), P)));
        art.push(h('g', { 'data-ref': 'bike-tailA', transform: 'rotate(0 -21 0)' }, G('fish-tails', Fp('M-20.5 0L-30.6 -9.6Q-28 -2 -30 0.2Q-28 2.4 -30.6 9.8Z', N), S('M-22 0L-28.4 -6.4M-22 0L-28.6 6.6M-22 0L-28.8 0', B, 0.4))));
      } else if (kind === 'snapper') {
        const body = 'M24 0C20 -8 8 -11.4 -4 -10.6C-12 -10 -17 -6 -19.6 -1.6L-19.6 1.6C-17 6 -12 9.6 -4 10C8 10.6 20 7 24 0Z';
        spec = 'fish-snapper'; art.push(h('g', {}, Fp(body, R), Fp('M24 0C20 6 8 9.6 -4 10C-12 9.6 -16 6.4 -19.6 1.6C-10 4.6 4 5.6 14 3.8C19 3 22 1.6 24 0Z', K)));
        let sc = ''; for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) { const x = -12 + c * 5 + (r % 2) * 2.5, y = -7 + r * 3.6; if (x < 17) sc += `M${f(x - 1.8)} ${f(y)}Q${f(x)} ${f(y + 2.2)} ${f(x + 1.8)} ${f(y)}`; }
        art.push(h('path', { ...tag('fish-scales'), d: sc, fill: 'none', stroke: K, 'stroke-width': 0.6, 'stroke-linecap': 'round' }));
        art.push(G('fish-fins', Fp('M-10 -10L-7 -15.6L-3 -14.4L1 -16L4 -13.8L8 -10.8Z', R), S('M-7 -10.8L-6.6 -14.6M-3 -11L-2.2 -14.2M1 -11L1.4 -14.8', K, 0.4), Fp('M6 9.4L3 13.6L0 9.8Z', R)));
        art.push(G('fish-lateral-line', S('M-16 -1.5Q0 -5.4 14 -2.4', K, 0.55)));
        art.push(G('fish-gills', S('M15.4 -6.6Q12.4 -1 15 5.6', N, 0.9, { opacity: 0.7 })));
        art.push(G('fish-mouths', S('M24 0.2L19.8 1.9', N, 0.65)));
        art.push(G('fish-eyes', Fp(circ([18.6, -3], 2.3), P), Fp(circ([19, -3], 1.3), N)));
        art.push(h('g', { 'data-ref': 'bike-tailB', transform: 'rotate(0 -19 0)' }, G('fish-tails', Fp('M-18.6 0L-29 -9.4Q-26.4 0 -29 9.4Z', R), S('M-20 0L-26.6 -6M-20 0L-26.6 6M-20 0L-27 0', K, 0.45))));
      } else {
        const body = 'M20 0C17 -4.6 7 -6.2 -3 -5.6C-10 -5.2 -14 -3 -16 -0.8L-16 0.8C-14 3 -10 5 -3 5.4C7 6 17 4.4 20 0Z';
        spec = 'fish-sardine'; art.push(h('g', {}, Fp(body, P), Fp('M20 0C17 -4.6 7 -6.2 -3 -5.6C-10 -5.2 -14 -3 -16 -0.8C-8 -2.4 4 -2.8 20 0Z', B)));
        art.push(G('fish-sardine-spots', Fp(circ([8.4, -1.8], 0.7) + circ([4.4, -1.4], 0.6) + circ([0.6, -1.2], 0.55) + circ([-3, -1], 0.5), N)));
        art.push(G('fish-lateral-line', S('M-12 0.6Q2 -0.2 13 0.4', B, 0.45)));
        art.push(G('fish-gills', S('M13.6 -3.6Q11.4 0 13.4 3.6', B, 0.8)));
        art.push(G('fish-mouths', S('M20 0.2L17.2 1.1', N, 0.5)));
        art.push(G('fish-eyes', Fp(circ([16.2, -1.2], 1.6), P), Fp(circ([16.5, -1.2], 0.9), N), Fp(circ([16.8, -1.5], 0.3), P)));
        art.push(G('fish-fins', Fp('M-1 -5.4L2 -9L5 -5.6Z', B)));
        art.push(h('g', { 'data-ref': 'bike-tailC', transform: 'rotate(0 -15.5 0)' }, G('fish-tails', Fp('M-15 0L-23 -6.6Q-21 0 -23 6.6Z', B), S('M-16 0L-21.4 -4M-16 0L-21.4 4', P, 0.4))));
      }
      return G(spec, art.join(''));
    };
    // newspaper lining the basket (behind the fish), torn edge above the rim
    {
      const top = [], nx = 14; for (let i = 0; i <= nx; i++) { const x = lerp(x0 + 3, x1 - 3, i / nx); top.push([x, y0 - 7 - (i % 2 ? 3.4 : 0) - 2.2 * Math.sin(i * 1.7)]); }
      const paper = poly([...top, [x1 - 3, y0 + 4], [x0 + 3, y0 + 4]]);
      let pr = ''; for (let c = 0; c < 6; c++) for (let r = 0; r < 2; r++) { const xa = x0 + 8 + c * 12.4, ya = y0 - 6.2 + r * 2.4; pr += `M${f(xa)} ${f(ya)}h${f(8.6 - (r + c) % 3 * 1.6)}`; }
      fk += G('newspaper-liner', Fp(paper, P), S(splitQ(top), B, 0.5), h('path', { ...tag('newspaper-print'), d: pr + `M${x0 + 20} ${y0 - 9.6}h12`, stroke: B, 'stroke-width': 0.8, fill: 'none', 'stroke-linecap': 'round' }));
    }
    fk += h('g', { 'data-ref': 'bike-fish' },
      h('g', { transform: `translate(${x0 + 20} ${y0 - 29}) rotate(-106) scale(1.3)` }, h('g', {}, fishArt('mackerel'))),
      h('g', { transform: `translate(${x1 - 21} ${y0 - 24}) rotate(126) scale(1.3)` }, fishArt('snapper')),
      h('g', { 'data-ref': 'bike-fishC', transform: `translate(${(x0 + x1) / 2 + 4} ${y0 - 8}) rotate(-10) scale(1.3)` }, h('g', { id: 'bike-fishC-art' }, fishArt('sardine'))));
    // the wicker: body, over-under weave, braided rim, base band
    const bodyD = `M${x0} ${y0}L${x1} ${y0}L${x1 - inset} ${y1}L${x0 + inset} ${y1}Z`;
    let bk = h('g', {}, Fp(bodyD, R), S(`M${x0 + 0.6} ${y0 + 1}L${x0 + inset + 0.4} ${y1 - 1}M${x1 - 0.6} ${y0 + 1}L${x1 - inset - 0.4} ${y1 - 1}`, R, 1.6));
    // over-under weave: each row, the weaver bulges over every other stake (O pill with a K light edge and an R
    // shadow edge); where it dives behind, the round stake shows (K rod with R shade); R gaps between everything
    const rows = 11, cols = 12, ry0 = y0 + 5.2, ry1 = y1 - 5.2, rh = (ry1 - ry0) / rows;
    let pills = '', rods = '', lit = '', shd = '';
    for (let i = 0; i < rows; i++) {
      const ya = ry0 + i * rh, yb = ya + rh, ym = (ya + yb) / 2, xa0 = xl(ym), xa1 = xr(ym), sp = (xa1 - xa0) / cols;
      for (let j = -1; j <= cols; j++) {
        const xc = xa0 + (j + 0.5) * sp;
        if ((i + j) % 2 === 0) {
          const L = Math.max(xa0 + 0.6, xc - sp * 0.62), Rr = Math.min(xa1 - 0.6, xc + sp * 0.62);
          if (Rr - L < 1.5) continue;
          pills += rrect([L, ya + 0.45], [1, 0], 0, Rr - L, 0, rh - 0.9, (rh - 0.9) / 2);
          lit += `M${f(L + 1.4)} ${f(ya + 1.25)}Q${f((L + Rr) / 2)} ${f(ya + 0.7)} ${f(Rr - 1.4)} ${f(ya + 1.25)}`;
          shd += `M${f(L + 1.6)} ${f(yb - 1.1)}Q${f((L + Rr) / 2)} ${f(yb - 0.6)} ${f(Rr - 1.6)} ${f(yb - 1.1)}`;
        } else if (j >= 0 && j < cols) rods += rrect([xc - 1.25, ya + 0.2], [1, 0], 0, 2.5, 0, rh - 0.4, 1.1);
      }
    }
    bk += G('basket-weave', Fp(rods, K), Fp(pills, O), S(lit, K, 0.65), S(shd, R, 0.6, { opacity: 0.9 }));
    { let wr = ''; for (let t = 0.08; t < 0.95; t += 0.09) for (const [a, b] of [[[x0 + 0.8, y0], [x0 + inset + 0.8, y1]], [[x1 - 0.8, y0], [x1 - inset - 0.8, y1]]]) { const p = lerp2(a, b, t); wr += `M${f(p[0] - 1.3)} ${f(p[1] - 0.6)}l2.6 1.2`; }
      bk += G('basket-corner-posts', S(seg([x0 + 0.8, y0], [x0 + inset + 0.8, y1]) + seg([x1 - 0.8, y0], [x1 - inset - 0.8, y1]), O, 2.6), S(wr, R, 0.55)); }
    let br = ''; for (let x = x0 + 1; x < x1 - 1; x += 3.2) br += `M${f(x)} ${f(y0 - 2.6)}L${f(x + 2.2)} ${f(y0 + 3.2)}`;
    bk += G('basket-rim', Fp(rrect([x0 - 2.4, y0 - 3.2], [1, 0], 0, x1 - x0 + 4.8, 0, 7, 3.2), O), S(br, R, 0.8), S(`M${x0} ${y0 - 2.2}H${x1}`, K, 0.6));
    let bt = ''; for (let x = x0 + inset + 2; x < x1 - inset - 1; x += 4.4) bt += `M${f(x)} ${y1 - 4.6}v4`;
    bk += G('basket-base', Fp(rrect([x0 + inset - 1, y1 - 5], [1, 0], 0, x1 - x0 - 2 * inset + 2, 0, 5.4, 1.2), R), S(bt, O, 0.8));
    fk += G('basket', bk);
    { // kelp draped over the rim (front), with O float bladders
      const C = resample([[x1 - 19, y0 - 7], [x1 - 13, y0 - 5.5], [x1 - 9.5, y0 + 2], [x1 - 11, y0 + 12], [x1 - 8.5, y0 + 22], [x1 - 10.5, y0 + 29]], 3);
      fk += G('seaweed', Fp(taper(C, 3.6, 1.2), T), S(splitQ(C.slice(1, -2).map(p => add(p, [0.6, 0]))), P, 0.4, { opacity: 0.6 }), Fp(circ(add(C[5], [2.2, 0]), 1.6) + circ(add(C[10], [-2.2, 0]), 1.3), O));
      // price tag on a string: 鲜鱼
      const tg = [x0 + 10, y0 + 12];
      fk += G('basket-tag', S(`M${x0 + 12} ${y0 + 2.4}Q${x0 + 9.5} ${y0 + 7} ${tg[0] + 2} ${tg[1]}`, N, 0.5), Fp(rrect(tg, [1, 0], 0, 15, 0, 8.4, 1.4), P), Fp(circ([tg[0] + 2, tg[1] + 1.8], 0.7), N),
        h('path', { d: textD('鲜鱼', 5.2, ([x, y]) => [tg[0] + 3.8 + x, tg[1] + 6.6 + y]).d, fill: R }));
    }
    fk += G('basket-straps', S(seg([x0 + 3, y0 + 2.6], [STEM[0] + 1.8, STEM[1] - 2]) + seg([x0 + 3, y0 + 10], [STEM[0] + 2.6, STEM[1] + 1.6]), N, 2.2), Fp(rrect([x0 - 1.6, y0 + 4.2], [1, 0], 0, 3.2, 0, 3.6, 0.5), O));
    // the fish the pelican takes (gulp): shown at the bill tip while inBill
    fk += h('g', { 'data-ref': 'bike-carry', style: 'display:none' }, h('use', { href: '#bike-fishC-art' }));
  }
  // headlamp (art-deco bullet) on a bracket from the crown bolt, in front of the basket stays; the lens glows at
  // night (emissive, quantised hard rings), brighter with dynamo speed
  {
    const L = BIKE.lamp, br0 = add(axis(7), mul(nHTf, 1)), q = (x, y) => add(L, [x, y]);
    fk += G('headlamp-bracket', S(`M${pt(br0)}Q${pt(q(-6, 10))} ${pt(q(-2.6, 6.2))}`, P, 2.3), Fp(circ(q(-2.6, 6.2), 1.3), N));
    const body = `M${pt(q(6.2, -6.6))}L${pt(q(-3, -6.6))}C${pt(q(-9, -6.6))} ${pt(q(-10.6, -3.2))} ${pt(q(-10.6, 0))}C${pt(q(-10.6, 3.2))} ${pt(q(-9, 6.6))} ${pt(q(-3, 6.6))}L${pt(q(6.2, 6.6))}Z`;
    fk += G('headlamp', Fp(body, P), S(`M${pt(q(-9.2, -2.2))}H${pt(q(2, -2.2)).split(' ')[0]}M${pt(q(-9.6, 0.4))}H${pt(q(2, 0.4)).split(' ')[0]}M${pt(q(-9.2, 3))}H${pt(q(2, 3)).split(' ')[0]}`, R, 0.6),
      Fp(rrect(q(2.4, -6.65), [1, 0], 0, 1.8, 0, 13.3), T), S(`M${pt(q(-8, -4.6))}Q${pt(q(-3, -5.8))} ${pt(q(5.6, -5.4))}`, B, 0.6),
      Fp(`M${pt(q(4.4, -6.4))}L${pt(q(12.2, -8.6))}L${pt(q(11.6, -6.6))}Z`, P), Fp(circ(q(-1.4, -6.9), 1.1), O));
    fk += G('lamp-switch', S(seg(q(-5.2, -6.4), q(-8.2, -9.8)), N, 1.1), Fp(circ(q(-8.4, -10), 1.1), P));
    const lc = q(6.2, 0), E = (rx, ry) => `M${pt(add(lc, [0, -ry]))}Q${pt(add(lc, [rx, -ry]))} ${pt(add(lc, [rx, 0]))}Q${pt(add(lc, [rx, ry]))} ${pt(add(lc, [0, ry]))}Z`;
    fk += G('headlamp-lens', Fp(E(5.8, 7.4), N), Fp(E(5, 6.6), P), Fp(E(4, 5.5), K),
      h('path', { 'data-ref': 'bike-lens-on', d: E(4, 5.5), fill: LAMP, style: 'opacity:var(--pb-n-lampOn)' }),
      S(`M${pt(add(lc, [1.6, -3.8]))}Q${pt(add(lc, [3.2, -2.6]))} ${pt(add(lc, [3.3, -0.8]))}`, P, 0.8), Fp(circ(add(lc, [2.2, 0.8]), 0.8), O));
    fk += h('g', { 'data-ref': 'bike-glow', ...tag('headlamp-glow') }, h('g', { style: 'opacity:var(--pb-n-lampOn)' },
      Fp(circ(add(lc, [4, 0]), 18), LAMPG, { opacity: 0.16 }), Fp(circ(add(lc, [4, 0]), 11.5), LAMPG, { opacity: 0.26 }), Fp(circ(add(lc, [3.4, 0]), 6.6), LAMP, { opacity: 0.55 })));
  }
  slots.fork = fk;

  // ============================================================ BARS (rider space, rotated by steer about the steerer top)
  let bs = '';
  const barC = [[STEM[0], STEM[1]], [STEM[0] + 5, STEM[1] - 2.4], [STEM[0] + 1, STEM[1] - 6.6], [STEM[0] - 8, STEM[1] - 7.2], [STEM[0] - 30, STEM[1] - 7.6]];
  const barFar = barC.map(p => add(p, [-3, -2]));
  const grip = (p0, p1, far) => { const u = norm(sub(p1, p0)); return Fp(rrect(p0, u, 0, len(sub(p1, p0)), -4.2, 4.2, 2.6), far ? F.N : K); };
  bs += G('grip-far', S(splitQ(resample(barFar, 3)), F.P, 4), grip(add(barFar[3], [-1.2, 0]), [barFar[4][0] - 2, barFar[4][1]], true));
  bs += G('brake-lever-far', Fp(taper([[STEM[0] - 8, STEM[1] - 4.6], [STEM[0] - 18, STEM[1] - 2.4], [STEM[0] - 29, STEM[1] - 2.8]], 2.6, 1.8), F.P));
  // quill stem
  bs += G('stem', Fp(rrect(onHT(-8.4), mul(uHT, -1), 0, 13, -3.3, 3.3, 0.8), P), S(seg(STR, STEM), P, 6.4, { 'stroke-linecap': 'round' }), S(seg(add(STR, [0.8, -2.2]), add(STEM, [-2, -2.4])), B, 0.6),
    Fp(circ(STEM, 4.9), P), Fp(ringD(STEM, 3.4, 4.2), B, { 'fill-rule': 'evenodd' }));
  bs += G('stem-bolts', Fp(hex(add(onHT(-8.4), mul(uHT, -13.6)), 2, 18), N), Fp(rrect(add(STEM, [0, 4.4]), [1, 0], -1.6, 1.6, 0, 2.6, 0.4), N));
  // handlebar (P) + grips + plug
  bs += G('handlebar', S(splitQ(resample(barC.slice(0, 4), 4)), P, 4.4), S(splitQ(resample(barC.slice(0, 4), 3)), B, 0.6, { transform: 'translate(0 1.4)' }));
  const g0 = add(barC[3], [-0.4, 0]), g1 = [barC[4][0] - 0.5, barC[4][1]];
  bs += G('grip-near', grip(g0, g1, false), Fp(rrect(add(g0, [1.4, 0]), norm(sub(g0, g1)), -1.2, 1.2, -4.9, 4.9, 0.6), N));
  { let rb = ''; const u = norm(sub(g1, g0)), nn = perp(u); for (let s = 3.4; s < len(sub(g1, g0)) - 1.6; s += 2.3) rb += seg(add(add(g0, mul(u, s)), mul(nn, -3.4)), add(add(g0, mul(u, s)), mul(nn, 3.4))); bs += G('grip-ribs', S(rb, R, 0.55)); }
  bs += G('bar-end-plug', Fp(rrect(add(g1, [0.4, 0]), [-1, 0], 0, 2.6, -3.6, 3.6, 1.4), P), S(seg(add(g1, [-1.4, -2]), add(g1, [-1.4, 2])), N, 0.5));
  // near brake lever: clamp band + blade under the grip
  bs += G('brake-lever-near', Fp(rrect([STEM[0] - 6.4, STEM[1] - 6.9], [1, 0], -2.4, 2.4, -3.4, 3.8, 1), P),
    Fp(taper([[STEM[0] - 6, STEM[1] - 3.2], [STEM[0] - 10, STEM[1] - 1.2], [STEM[0] - 19, STEM[1] - 0.4], [STEM[0] - 27, STEM[1] - 1.8]], 2.8, 1.8), P), S(`M${STEM[0] - 9} ${STEM[1] - 0.6}Q${STEM[0] - 18} ${STEM[1] + 0.3} ${STEM[0] - 26} ${STEM[1] - 0.8}`, B, 0.5),
    Fp(circ([STEM[0] - 6.4, STEM[1] - 4.4], 0.9), N));
  // front brake housing (lever -> down the head tube front -> calliper anchor)
  {
    const calBolt = add(axis(6.5), mul(nHTf, 5.5));
    const anc = cAnchor(calBolt, pol(FH, 91.6, angOf(sub(axisAtR(89.5), FH))), 1), hEnd = add(anc, [-1.2, -9]);
    bs += G('brake-housing-front', S(splitQ(resample([[STEM[0] - 4.6, STEM[1] - 2.2], [STEM[0] - 6.2, STEM[1] + 5], [126.2, -250], [126, -232], [127.4, -218], hEnd], 3)), N, 1.7));
    bs += G('cable-ferrules', Fp(rrect(hEnd, norm(sub(anc, hEnd)), -0.4, 2.2, -1.25, 1.25, 0.4), P), S(seg(add(hEnd, mul(norm(sub(anc, hEnd)), 2)), anc), P, 0.55));
  }
  // bell: brass dome (O) with rings, striker lever (rotates on flick), clamp
  {
    const bc = BIKE.bell;
    bs += G('bell', Fp(rrect([bc[0] - 1.2, bc[1] + 1.6], [1, 0], 0, 2.4, 0, 3.4, 0.4), P),
      h('g', { 'data-ref': 'bike-dome' }, Fp(`M${bc[0] - 5.6} ${bc[1] + 1.6}Q${bc[0] - 5.6} ${bc[1] - 5.2} ${bc[0]} ${bc[1] - 5.4}Q${bc[0] + 5.6} ${bc[1] - 5.2} ${bc[0] + 5.6} ${bc[1] + 1.6}Z`, O),
        Fp(rrect([bc[0] - 6.2, bc[1] + 1.2], [1, 0], 0, 12.4, 0, 1.4, 0.6), N), Fp(circ([bc[0], bc[1] - 5.6], 0.9), P),
        h('path', { ...tag('bell-rings'), d: `M${bc[0] - 4.4} ${bc[1] - 1}Q${bc[0]} ${bc[1] - 2.6} ${bc[0] + 4.4} ${bc[1] - 1}M${bc[0] - 3.2} ${bc[1] - 3.6}Q${bc[0]} ${bc[1] - 4.6} ${bc[0] + 3.2} ${bc[1] - 3.6}`, fill: 'none', stroke: R, 'stroke-width': 0.55, 'stroke-linecap': 'round' }),
        S(`M${bc[0] + 2.6} ${bc[1] - 3.6}Q${bc[0] + 4.2} ${bc[1] - 2} ${bc[0] + 4.3} ${bc[1]}`, P, 0.7)));
    bs += h('g', { 'data-ref': 'bike-bellLever', transform: `rotate(0 ${bc[0] - 4.8} ${bc[1] + 2})` }, G('bell-lever', S(`M${bc[0] - 4.8} ${bc[1] + 2}Q${bc[0] - 8} ${bc[1] + 1} ${bc[0] - 9.6} ${bc[1] - 1.6}`, N, 1.3), Fp(circ([bc[0] - 9.8, bc[1] - 1.9], 1.4), P)));
  }
  bs += anchor('gripNear', BIKE.gripNear) + anchor('gripFar', BIKE.gripFar);
  slots.bars = bs;

  // ============================================================ DRIVETRAIN
  // 16T cog (rear-hub local; rotates 3·crank). Teeth sit in the valleys of the chain rollers at φ=0.
  const tooth = (a, rs, ws) => poly([...rs.map((r, i) => pol([0, 0], r, a - ws[i])), ...rs.slice().reverse().map((r, i) => pol([0, 0], r, a + ws[rs.length - 1 - i]))]);
  {
    let teeth = '';
    for (let j = 0; j < 16; j++) teeth += h('path', { d: tooth(COG_VALLEY0 + 11.25 + 22.5 * j, [8.1, 9.6, 10.4, 10.8], [7.2, 4.6, 3, 1.7]), 'data-ref': `bike-cog-tooth-${j}` });
    slots.cog = G('cog', h('g', { fill: P, 'data-ref': 'bike-cogTeeth' }, teeth), Fp(circ([0, 0], 8.5), P), Fp(ringD([0, 0], 7.3, 7.8), B, { 'fill-rule': 'evenodd' })) +
      G('cog-lockring', Fp(circ([0, 0], 5.6), N), Fp(rrect([0, 0], [1, 0], 3.6, 5.8, -0.9, 0.9, 0.3), P), Fp(ringD([0, 0], 4.4, 4.8), F.B, { 'fill-rule': 'evenodd' }));
  }
  // chain slot: 48 ring teeth (rotated by update) < chain layers < guard; rear axle nut on top of the cog
  {
    let teeth = '';
    for (let j = 0; j < 48; j++) teeth += h('path', { d: tooth(RING_VALLEY0 + 3.75 + 7.5 * j, [27.1, 28.6, 29.7, 30.2], [2.7, 1.55, 0.95, 0.5]), 'data-ref': `bike-ring-tooth-${j}` });
    let ch = h('g', { 'data-ref': 'bike-teeth', transform: `translate(${pt(BB)})` },
      G('chainring-teeth', Fp(ringD([0, 0], 25.6, 27.4), P, { 'fill-rule': 'evenodd' }), h('g', { fill: P }, teeth)));
    const cp = (extra, w, stroke, da) => h('path', { d: CHAIN_D, pathLength: 100, fill: 'none', stroke, 'stroke-width': w, 'stroke-dasharray': da, ...extra });
    // hit-testing honesty: the closed CHAIN_D loop would claim everything inside it, so the chain group is clipped
    // to a band around its own runs and wraps (it never draws outside that band anyway)
    const bandSeg = (a, b, w) => { const u = norm(sub(b, a)), n = mul(perp(u), w); return poly([add(a, n), add(b, n), sub(b, n), sub(a, n)]); };
    defs += h('clipPath', { id: 'bike-chainclip', clipPathUnits: 'userSpaceOnUse' },
      h('path', { d: bandSeg([-126, -109.6], [1.5, -108.5], 2.5) + bandSeg([-7.5, -52.4], [-129, -91.3], 2.5) }),
      h('path', { d: ringNZ(BB, 26, 31.2) }), h('path', { d: ringNZ(RH, 7.1, 12.1) }));
    ch += h('g', { 'data-ref': 'bike-chainfx', 'stroke-dashoffset': 0, 'clip-path': 'url(#bike-chainclip)' },
      G('chain', h('path', { d: CHAIN_D, pathLength: 100, fill: 'none', stroke: N, 'stroke-width': 4.4, 'stroke-linejoin': 'round', 'data-ref': 'bike-chain' }),
        G('chain-inner-plates', cp({ 'data-ref': 'bike-plateI' }, 2.5, F.B, '0 1.08 0.92 0'),
          G('chain-outer-plates', cp({ 'data-ref': 'bike-plateO' }, 3.5, B, '1.1 0.9'),
            G('chain-rollers', cp({ 'data-ref': 'bike-pinR', 'stroke-linecap': 'round' }, 2.1, N, '0 1'), cp({ 'data-ref': 'bike-pinH', 'stroke-linecap': 'round' }, 0.95, P, '0 1'),
              G('chain-master-link', cp({}, 3.6, P, '0 20.95 1.1 77.95'), cp({ 'stroke-linecap': 'round' }, 1.2, R, '0 21.5 0 78.5')))))));
    // half chainguard over the top run and the upper ring
    const gd = `M-80 -116.6L${pt(pol(BB, 37.2, -104))}A37.2 37.2 0 0 1 ${pt(pol(BB, 37.2, -30))}Q${pt(pol(BB, 35, -26))} ${pt(pol(BB, 31.2, -29))}A31.2 31.2 0 0 0 ${pt(pol(BB, 31.2, -100))}L-80 -109.6Q-84.6 -109.8 -84.6 -113.1Q-84.6 -116.5 -80 -116.6Z`;
    ch += G('chainguard', Fp(gd, T), S(`M-81 -115.2L${pt(pol(BB, 35.8, -104))}A35.8 35.8 0 0 1 ${pt(pol(BB, 35.8, -34))}`, R, 0.55), Fp(circ([-76, -113.1], 1.1) + circ(pol(BB, 34.2, -52), 1.1), P));
    const gl = textD('PELICAN BAY', 4.4, ([x, y]) => [-70 + x, -111.2 + y * 0.95], 0.3);
    ch += h('path', { ...tag('chainguard-lettering'), d: gl.d, fill: P });
    ch += G('chain-tensioner', S(seg(add(RH, [-4, 0]), add(RH, [-15.6, 0])), P, 1.2), Fp(hex(add(RH, [-15.4, 0]), 1.8, 0), N), Fp(circ(add(RH, [-15.4, 0]), 0.55), P));
    ch += G('axle-nut-rear', Fp(hex(RH, 3.3, 0), N), Fp(hex(RH, 2.1, 30), B), Fp(circ(RH, 0.9), P));
    slots.chain = ch;
  }
  // chainring body + 5-arm spider (BB local; rotates with the crank; arm 0 along the near crank)
  {
    let win = ''; for (let k = 0; k < 5; k++) win += band([0, 0], 18.6, 23.8, 36 + 72 * k - 21, 36 + 72 * k + 21);
    let arms = '', bolts = '', boltC = '';
    for (let k = 0; k < 5; k++) {
      const a = 72 * k; arms += poly([pol([0, 0], 8.5, a - 26), pol([0, 0], 21.6, a - 8.6), pol([0, 0], 23.2, a), pol([0, 0], 21.6, a + 8.6), pol([0, 0], 8.5, a + 26)]);
      bolts += hex(pol([0, 0], 21, a), 2.1, a); boltC += circ(pol([0, 0], 21, a), 0.8);
    }
    slots.chainring = G('chainring', Fp(ringD([0, 0], 16.4, 26.4) + win, P, { 'fill-rule': 'evenodd' }), Fp(ringD([0, 0], 25.6, 26.4), B, { 'fill-rule': 'evenodd' }),
      h('path', { ...tag('chainring-pinstripe'), d: ringD([0, 0], 24.5, 25), fill: R, 'fill-rule': 'evenodd' })) +
      G('spider', Fp(arms + circ([0, 0], 10), N)) + G('chainring-bolts', Fp(bolts, P), Fp(boltC, N));
  }
  // cranks
  const arm = far => `M0 -8.4L50 -5.2A5.2 5.2 0 0 1 50 5.2L0 8.4A8.4 8.4 0 0 1 0 -8.4Z`;
  slots.crankNear = G('crank-near', Fp(arm(false), N), S('M6 -5.6L46 -3.3', P, 0.9), S('M8 5.8L45 3.8', B, 0.7), Fp(circ([50, 0], 3), P), Fp(circ([50, 0], 1.3), N)) +
    G('crank-dust-cap', Fp(circ([0, 0], 5.2), P), Fp(ringD([0, 0], 4.5, 5.2), B, { 'fill-rule': 'evenodd' }), Fp(circ([-1.9, 0], 0.75) + circ([1.9, 0], 0.75), N));
  slots.crankFar = G('crank-far', Fp(arm(true), F.N), Fp(circ([50, 0], 2.6), F.B));
  // platform pedals: pivot = spindle, top face at y≈0 (the ball of the foot sits on it)
  const pedal = far => {
    const ink = far ? F : I;
    let tread = ''; for (let x = -8.4; x <= 8.5; x += 2.1) tread += `M${f(x)} 1.1v1.1M${f(x)} 4.4v1.1`;
    return G(far ? 'pedal-far' : 'pedal-near', Fp(rrect([0, 0], [1, 0], -12, 12, -0.4, 6.9, 1.8), ink.N), Fp(rrect([0, 0], [1, 0], -10, 10, 0.5, 2.9, 0.8) + rrect([0, 0], [1, 0], -10, 10, 3.6, 6, 0.8), ink.B)) +
      (far ? '' : h('path', { ...tag('pedal-treads'), d: tread, stroke: N, 'stroke-width': 0.75, fill: 'none', 'stroke-linecap': 'round' }) +
        G('pedal-reflector', Fp(rrect([0, 0], [1, 0], -13, -10.4, 0.5, 5.9, 0.7) + rrect([0, 0], [1, 0], 10.4, 13, 0.5, 5.9, 0.7), O), S('M-11.7 1.5V4.9M11.7 1.5V4.9', R, 0.5)) +
        Fp(circ([0, 3.25], 1.9), P) + Fp(hex([0, 3.25], 1.05, 0), N)) +
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
        set(r[`${w}-fine`], 'opacity', (1 - 0.55 * blur).toFixed(2));
        set(r[`${w}-heads`], 'opacity', (1 - 0.6 * blur).toFixed(2));
        set(r[`${w}-tread`], 'opacity', (1 - blur).toFixed(2));
        set(r[`${w}-treadblur`], 'opacity', blur.toFixed(2));
      }
      set(r.swoosh, 'opacity', (0.9 * blur).toFixed(2));
      set(r.roller, 'opacity', (1 - blur).toFixed(2));
      // bell striker + dome shiver
      const bell = p.bell || {};
      set(r.bellLever, 'transform', `rotate(${(-28 * (bell.flick || 0)).toFixed(1)} ${BIKE.bell[0] - 4.8} ${BIKE.bell[1] + 2})`);
      set(r.dome, 'transform', bell.strike ? `translate(${BIKE.bell[0]} ${BIKE.bell[1]}) rotate(4) translate(${-BIKE.bell[0]} ${-BIKE.bell[1]})` : '');
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
