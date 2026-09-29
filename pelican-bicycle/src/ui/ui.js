// OWNER: ui. PLACEHOLDER: keyboard only.
export function createUI(host, bus, init) {
  const keys = { ' ': 'ui:bell', b: 'ui:bell', w: 'ui:wave', h: 'ui:hop', j: 'ui:hop', ArrowUp: 'ui:hop' };
  addEventListener('keydown', e => {
    if (keys[e.key]) { e.preventDefault(); bus.emit(keys[e.key], {}); }
    if (e.key === 'ArrowRight') bus.emit('ui:speed', { cadence: init.state.cadenceTarget + 10 });
    if (e.key === 'ArrowLeft') bus.emit('ui:speed', { cadence: init.state.cadenceTarget - 10 });
    if (e.key === 'c') { const m = ['wide', 'close', 'cinematic']; bus.emit('ui:camera', { mode: m[(m.indexOf(init.state.cam) + 1) % 3] }); }
    if (e.key === 'p') bus.emit('ui:play', {});
  });
  return { update() {} };
}
