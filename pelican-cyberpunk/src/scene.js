// Builds the full <svg> markup from module build() outputs, and validates ownership / id uniqueness.
import { VIEW, LAYERS, SLOTS, SLOT_OWNER } from './contract.js';
import { h } from './core/svg.js';

// modules: [{ id, build(ctx) -> {defs?, slots?, overlay?, layers?} }]
// `overlay` = { slot: markup } lets a non-owner (the eggs' mech suit) hang dormant art INSIDE a rider slot, after the
// owner's own art, so it rides that joint exactly (joint-local coordinates) and keeps the slot's z-order.
export function buildSceneMarkup(modules, ctx) {
  const built = {};
  const problems = [];
  for (const m of modules) {
    try { built[m.id] = m.build ? m.build(ctx) || {} : {}; }
    catch (e) { problems.push(`${m.id}.build() threw: ${e.message}`); built[m.id] = {}; }
  }
  const defs = [], slotMarkup = {}, layerMarkup = {}, overMarkup = {};
  for (const [id, b] of Object.entries(built)) {
    if (b.defs) defs.push(`<!-- ${id} -->${b.defs}`);
    for (const [slot, mk] of Object.entries(b.slots || {})) {
      const owner = Object.entries(SLOT_OWNER).find(([, list]) => list.includes(slot));
      if (!SLOTS.includes(slot)) problems.push(`${id}: unknown slot "${slot}"`);
      else if (owner && owner[0] !== id) problems.push(`${id}: slot "${slot}" belongs to ${owner[0]}`);
      slotMarkup[slot] = (slotMarkup[slot] || '') + mk;
    }
    for (const [slot, mk] of Object.entries(b.overlay || {})) {
      if (!SLOTS.includes(slot)) problems.push(`${id}: unknown overlay slot "${slot}"`);
      else overMarkup[slot] = (overMarkup[slot] || '') + mk;
    }
    for (const [layer, mk] of Object.entries(b.layers || {})) {
      const L = LAYERS.find(l => l[0] === layer);
      if (!L) { problems.push(`${id}: unknown layer "${layer}"`); continue; }
      (layerMarkup[layer] ||= []).push([id, mk]);
    }
  }
  const layers = LAYERS.map(([lid, depth]) => {
    if (lid === 'L-rider') {
      const slots = SLOTS.map(s => h('g', { id: 'j-' + s, 'data-slot': s }, (slotMarkup[s] || '') + (overMarkup[s] || '')));
      return h('g', { id: lid, 'data-depth': depth }, h('g', { id: 'rider' }, slots));
    }
    const kids = (layerMarkup[lid] || []).map(([owner, mk]) => h('g', { id: `${lid}--${owner}` }, mk));
    return h('g', { id: lid, 'data-depth': depth ?? 'fixed' }, kids);
  });
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" id="scene" viewBox="0 0 ${VIEW.w} ${VIEW.h}" preserveAspectRatio="xMidYMid slice" role="img" aria-labelledby="scene-title scene-desc">`
    + `<title id="scene-title">Neon Pelican · 霓虹鹈鹕</title><desc id="scene-desc">A cyberpunk great white pelican in a visor and an LED scarf rides a glowing bicycle through a rain-slick neon harbour city at night, delivering fish for Pelican Express.</desc>`
    + `<defs>${defs.join('')}</defs>${layers.join('')}</svg>`;
  return { markup, problems };
}

// After mounting: check duplicate ids (a sign two modules collided).
export function checkIds(svg) {
  const seen = new Map(), dups = [];
  for (const el of svg.querySelectorAll('[id]')) { const id = el.id; if (seen.has(id)) dups.push(id); seen.set(id, 1); }
  return dups;
}
