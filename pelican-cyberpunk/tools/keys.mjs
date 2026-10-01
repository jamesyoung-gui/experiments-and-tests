// Keyboard map (driven from KEYMAP in src/ui/ui.js): every key fires its action and every action has a focusable
// control carrying aria-keyshortcuts. Each key is pressed on a fresh live page and the observable effect is checked.
// usage: node tools/keys.mjs [--dist]
import { openScene, reporter } from './lib/page.mjs';
import { KEYMAP } from '../src/ui/ui.js';
const R = reporter('keys');
const { page, errors, close } = await openScene({ query: 'nohud' });
await page.evaluate(() => window.__pb.play());
await page.waitForTimeout(300);
const snap = () => page.evaluate(() => {
  const s = window.__pb.state, ev = s.events.map(e => e.type);
  return { cam: s.cam, tod: +s.tod.toFixed(4), auto: s.todAuto, cad: s.cadenceTarget, coast: s.coasting, sound: s.toggles.sound, music: s.toggles.music, playing: s.playing, lang: document.documentElement.lang + '|' + (document.querySelector('#ui')?.innerText || '').slice(0, 40), help: !!document.querySelector('[role="dialog"]:not([hidden]), dialog[open]'), ev: ev.join(','), n: ev.length };
});
const EXPECT = {
  bell: (a, b) => b.ev.includes('bell') && b.n > a.n, wave: (a, b) => b.ev.includes('wave'), hop: (a, b) => b.ev.includes('hop'), feed: (a, b) => b.ev.includes('gulp'),
  camera: (a, b) => a.cam !== b.cam, tod: (a, b) => a.tod !== b.tod, auto: (a, b) => a.auto !== b.auto, slower: (a, b) => b.cad < a.cad, faster: (a, b) => b.cad > a.cad,
  coast: (a, b) => a.coast !== b.coast, sound: (a, b) => a.sound !== b.sound, music: (a, b) => a.music !== b.music || a.sound !== b.sound, pause: (a, b) => a.playing !== b.playing,
  lang: (a, b) => a.lang !== b.lang, help: (a, b) => b.help && !a.help,
};
for (const k of KEYMAP) {
  for (const key of k.keys) {
    await page.reload(); await page.waitForFunction(() => window.__pb && window.__pb.ready); await page.evaluate(() => window.__pb.play()); await page.waitForTimeout(200);
    await page.mouse.click(5, 5);
    const a = await snap();
    await page.keyboard.press(key === ' ' ? 'Space' : key === '?' ? 'Shift+Slash' : key.length === 1 ? key.toUpperCase() === key ? key : key : key);
    await page.waitForTimeout(150);
    const b = await snap();
    const chk = EXPECT[k.act];
    if (!chk) R.ok(`${key} → ${k.act} (no observable check)`);
    else chk(a, b) ? R.ok(`${JSON.stringify(key)} → ${k.act}`) : R.fail(`${JSON.stringify(key)} → ${k.act}: no effect`);
  }
  const ctl = await page.evaluate(aria => [...document.querySelectorAll('[aria-keyshortcuts]')].some(e => e.getAttribute('aria-keyshortcuts').split(/\s+/).some(x => aria.split(/\s+/).includes(x))), k.aria);
  if (!ctl && !k.always) R.fail(`${k.act}: no control with aria-keyshortcuts="${k.aria}"`);
}
for (const e of errors) R.fail(e);
const r = R.done();
await close();
process.exit(r.fails.length ? 1 : 0);
