// Tiny event bus.
export function createBus() {
  const map = new Map();
  const on = (type, fn) => { if (!map.has(type)) map.set(type, new Set()); map.get(type).add(fn); return () => map.get(type).delete(fn); };
  const emit = (type, payload) => { for (const fn of map.get(type) || []) try { fn(payload); } catch (e) { console.error(e); } for (const fn of map.get('*') || []) fn(type, payload); };
  const once = (type, fn) => { const off = on(type, p => { off(); fn(p); }); return off; };
  return { on, emit, once };
}
