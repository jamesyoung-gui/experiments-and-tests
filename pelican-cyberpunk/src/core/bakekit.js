// Helpers for modules to describe their animation for the zero-JS SMIL bake (see src/bake/bake.js).
// BakeDescriptor: {el|selector, kind:'transform'|'attr', type?, attr?, values:[...], keyTimes?, dur, calcMode?, additive?}
export const linearLoop = (selector, typeOrAttr, from, to, dur, kind = 'transform') =>
  kind === 'transform'
    ? { selector, kind, type: typeOrAttr, values: [from, to], dur }
    : { selector, kind: 'attr', attr: typeOrAttr, values: [from, to], dur };
// Sample fn(phase∈[0,1)) n times (plus the closing sample) into a looping animation.
export function sampled(selector, typeOrAttr, fn, dur, n = 60, kind = 'attr') {
  const values = [], keyTimes = [];
  for (let i = 0; i <= n; i++) { values.push(fn(i / n)); keyTimes.push(+(i / n).toFixed(4)); }
  return kind === 'transform'
    ? { selector, kind, type: typeOrAttr, values, keyTimes, dur }
    : { selector, kind: 'attr', attr: typeOrAttr, values, keyTimes, dur };
}
