// Pelican Bay — shared contract. FROZEN after phase 0: change requests go to the lead.
// Pure data only (importable from node). Geometry source: docs/rig-spec.md §1–§2.

export const VIEW = { w: 1600, h: 900, cx: 800, cy: 450 };
export const GROUND_Y = 790;          // world y of the road contact line
export const RIDER_X = 680;           // world x of the rider origin (ground under the bottom bracket)
export const HORIZON_Y = 470;         // sea horizon

// ---- Bicycle (rider-local units, y negative = up, origin = ground under BB) ----
export const BIKE = {
  R: 100, tyre: 9, rimOuter: 91, rimInner: 88, hubR: 6, spokes: 32,
  rearHub: [-125, -100], frontHub: [173, -100], bb: [0, -80],
  seatTubeTop: [-46.5, -232], seatClamp: [-60.5, -278], saddleTop: [-63, -287], saddleX: [-101, -23],
  headTop: [112, -245], headBottom: [125.6, -203.2], forkLen: 112.8, forkRake: 13.2,
  steererTop: [106.4, -262.1], stem: [132, -269],
  gripNear: [114, -275], gripFar: [111, -277],
  bell: [124, -281], lamp: [140, -218], basket: { x0: 140, x1: 222, y0: -292, y1: -226 },
  crank: 50, ringT: 48, ringR: 28.556, ringTip: 30.2, cogT: 16, cogR: 9.573, cogTip: 10.8,
  rearContact: [-125, 0],
};
export const GEAR = BIKE.ringT / BIKE.cogT;                 // 3.0 wheel turns per crank turn
export const DIST_PER_REV = 2 * Math.PI * BIKE.R * GEAR;   // 1884.956 units of road per crank turn

// Chain path, drawn in the direction the chain travels (clockwise on both sprockets). Use pathLength="100" (1 unit = 1 link).
export const CHAIN_D = 'M-124.92,-109.57 L0.23,-108.55 A28.556,28.556 0 1 1 -8.69,-52.80 L-127.91,-90.88 A9.573,9.573 0 0 1 -124.92,-109.57 Z';
export const CHAIN_LINKS = 100;

// ---- Pelican skeleton (rest offsets are in the parent's local frame; bones point along +x) ----
export const SKEL = {
  pelvis: [-45, -300],                 // parent: rider
  tail: [-62, -38], tailRot: 8,        // parent: pelvis
  hipNear: [8, 0], hipFar: [4, -3],    // parent: pelvis
  thigh: 142, shank: 134,              // bone lengths
  footBall: [17, 9],                   // in foot-local: point that sits on the pedal spindle
  shoulderNear: [80, -78], shoulderFar: [75, -83], // parent: pelvis
  wingUpper: 78, wingLower: 74, handRot: 15,
  neckBase: [112, -92],                // parent: pelvis  (rider ≈ (67,-392))
  head: [125, -520],                   // parent: RIDER (head is stabilised)
  eye: [6, -7], crest: [-20, -16], crestRot: 200,   // parent: head
  billUpper: [16, 2], billLower: [16, 6], billLen: 128, billRot: 14,  // parent: head
  pouch: [6, 5],                       // parent: billLower
  headR: 26,
};

// Composed (rider-space) joint transforms are written into these flat, z-ordered slots, back → front.
export const SLOTS = [
  'wingFarUpper', 'wingFarLower', 'wingFarHand',
  'pedalFar', 'footFar', 'shankFar', 'thighFar', 'crankFar',
  'wheelRear', 'wheelFront', 'frame', 'fork', 'bars', 'cog', 'chain', 'chainring', 'crankNear',
  'neck', 'tail', 'body',
  'pedalNear', 'shankNear', 'footNear', 'thighNear',
  'pouch', 'billLower', 'billUpper', 'head', 'eye', 'crest',
  'wingNearUpper', 'wingNearLower', 'wingNearHand',
];
export const SLOT_OWNER = {
  bike: ['pedalFar', 'crankFar', 'wheelRear', 'wheelFront', 'frame', 'fork', 'bars', 'cog', 'chain', 'chainring', 'crankNear', 'pedalNear'],
  'pelican-body': ['neck', 'tail', 'body', 'pouch', 'billLower', 'billUpper', 'head', 'eye', 'crest'],
  'pelican-limbs': ['wingFarUpper', 'wingFarLower', 'wingFarHand', 'footFar', 'shankFar', 'thighFar', 'shankNear', 'footNear', 'thighNear', 'wingNearUpper', 'wingNearLower', 'wingNearHand'],
};

// Layers, back → front: [id, parallax depth (null = screen-fixed), owner]. Each owner draws into #<id>--<owner>.
export const LAYERS = [
  ['L-sky', 0, 'sky'], ['L-stars', 0, 'sky'], ['L-sunmoon', 0, 'sky'], ['L-clouds', 0.03, 'sky'],
  ['L-hills-far', 0.05, 'sea'], ['L-lighthouse', 0.07, 'sea'], ['L-sea', 0.1, 'sea'], ['L-boats', 0.12, 'sea'],
  ['L-gulls-far', 0.15, 'fx'], ['L-atmo', 0.2, 'lead'],
  ['L-shore', 0.6, 'land'], ['L-roadside', 0.9, 'land'], ['L-road', 1, 'land'],
  ['L-shadow', 1, 'fx'], ['L-fx-back', 1, 'fx'], ['L-rider', 1, 'rider'], ['L-fx-front', 1, 'fx'],
  ['L-foreground', 1.3, 'land'], ['L-letterbox', null, 'lead'],
];
// Near-layer tile widths that loop seamlessly in whole crank turns (see spec §3): width = depth·DIST_PER_REV·k
export const TILE = { road: 1884.96, roadside: 1696.46, foreground: 2450.44, shore: 2261.95 };

// Time of day: 0/1 = midnight, .25 sunrise-ish, .5 noon, .70 golden hour (default), .76 sunset, .86 night
export const TOD_DEFAULT = 0.70;
export const CADENCE = { min: 20, stroll: 40, cruise: 60, sprint: 90, max: 110 };

export const CAMERAS = {
  wide: { zoom: 1, fx: 800, fy: 450 },
  close: { zoom: 1.55, fx: RIDER_X + 30, fy: GROUND_Y - 285 },
  cinematic: { zoom: 1.25, fx: 800, fy: 470, letterbox: 115.3 },
};
