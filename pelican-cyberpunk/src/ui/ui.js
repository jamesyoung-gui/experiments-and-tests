// OWNER: ui. The HTML overlay (#ui), style X "Neon Pelican": the courier's translucent HUD terminal (the control card),
// rolling neon telemetry counters + a cadence spectrum, a neon-keyboard help dialog, the idle callout, the egg chip and
// the screen-reader announcer.
//
// Single sources of truth (exported so tools / README can import them):
//   STRINGS  — every user-visible string, zh + en, keys 100 % aligned (bilingual mode shows 中文 first, English second)
//   KEYMAP   — every shortcut: the key handler, the help keyboard, the legend and aria-keyshortcuts are derived from it
// Progressive disclosure: the collapsed panel shows the telemetry + 4 entries (play/pause · ring · feed · controls);
// the card opens into Ride / Time / Camera / More sections (tabs on phones, where the card is a bottom sheet).
// The card docks to whichever corner is free of the rider's live screen box, so it never covers the pelican.
// Colours: neon is emissive, so the HUD keeps FIXED colours at every city mood (styles.js), which keeps the contrast
// constant. Sound: 'sound' opens the ambience; 'music' is its own switch (off by default even with sound on) and is sent
// to the audio module as ui:toggle { key:'music' } (state.toggles.music); turning music on also opens the sound.
import { DIST_PER_REV, CADENCE, CAMERAS, BIKE } from '../contract.js';
import * as PG from '../world/print-glyphs.js';
import { injectStyles } from './styles.js';
import { TIMING } from '../rig/solve.js';

export const id = 'ui';
export const detailItems = [];   // no scene detail quota: the UI lives outside #scene

// ------------------------------------------------------------------ i18n
export const STRINGS = {
  zh: {
    docTitle: '霓虹鹈鹕 · 鹈鹕湾', card: '控制面板', sub: '外卖终端', serial: '骑手编号',
    play: '播放', pause: '暂停', bell: '响铃', feed: '喂鱼', controls: '控制', hide: '收起',
    ride: '骑行', time: '时光', view: '镜头', more: '更多',
    cadence: '踏频', coast: '滑行', wave: '挥手', hop: '蹦跳',
    stroll: '散步', cruise: '巡航', sprint: '冲刺',
    tod: '时刻', auto: '自动昼夜',
    wide: '远景', close: '特写', cinematic: '电影',
    sound: '声音', music: '音乐', dlSvg: '动画 SVG', dlFrame: '当前帧', keys: '快捷键', lang: '语言',
    langBi: '中 / EN', langZh: '中文', langEn: 'EN',
    dist: '里程', speed: '时速', rpm: '踏频', km: '公里', kmh: '公里/时', rpmU: '转/分',
    riding: '骑行中', paused: '已暂停', coasting: '滑行中',
    todNames: ['深夜', '拂晓', '黎明', '上午', '正午', '午后', '黄金时刻', '日落', '黄昏', '夜晚'],
    aBell: '叮铃叮铃！', aWave: '鹈鹕挥了挥翅膀', aHop: '蹦！', aNotYet: '还没落地呢，稍等', aFeed: '喂了一条鱼，咕嘟！',
    aPaused: '已暂停', aPlaying: '继续骑行', aCoastOn: '滑行中', aCoastOff: '继续踩踏',
    aCam: '镜头：{x}', aTod: '时刻：{x}', aAutoOn: '自动昼夜已开启', aAutoOff: '自动昼夜已关闭',
    aSoundOn: '声音已开启', aSoundOff: '声音已关闭', aMusicOn: '合成器音乐已开启', aMusicOff: '音乐已关闭', aCadence: '{rpm} 转/分 · {kmh} 公里/时',
    aBeat: '按你的节拍骑：{rpm} 转/分', aPrinting: '正在导出……', aSaved: '已下载 {x}', aLang: '语言：中文与英文',
    aLangZh: '语言：中文', aLangEn: '语言：英文', aKeysOff: '单键快捷键已关闭', aKeysOn: '单键快捷键已开启',
    hintFine: '点一下鹈鹕，喂它一条鱼', hintCoarse: '轻触鹈鹕，喂它一条鱼',
    helpTitle: '快捷键', helpTry: '按下任意快捷键，键盘上对应的键会亮起。', helpEnable: '启用单键快捷键',
    helpClose: '关闭', helpTouch: '触屏手势',
    gTap: '轻触鹈鹕：喂一条鱼', gSheet: '上滑或轻触底部面板：展开控制', gSlide: '拖动滑块：调节踏频与时刻',
    reduced: '已开启减少动态：画面静止，按播放开始骑行', reducedToast: '已切换为减少动态效果',
    region: '鹈鹕湾控制面板', odo: '骑行遥测', telemetry: '遥测',
    kbBell: '响铃', kbWave: '挥手', kbHop: '蹦跳', kbFeed: '喂鱼', kbCam: '换镜头', kbTod: '换时刻', kbAuto: '自动昼夜',
    kbSlower: '慢一点', kbFaster: '快一点', kbCoast: '滑行', kbSound: '声音', kbMusic: '音乐', kbPause: '暂停', kbHelp: '帮助', kbLang: '语言',
    aEgg: '发现彩蛋：{x}', beatTip: '交替敲 ← → 可以踩出你的节拍', printed: '霓虹网在线', plate: '信号满格',
  },
  en: {
    docTitle: 'Neon Pelican · a pelican on a bicycle', card: 'Control panel', sub: 'Courier HUD', serial: 'Courier',
    play: 'Play', pause: 'Pause', bell: 'Ring', feed: 'Feed fish', controls: 'Controls', hide: 'Hide',
    ride: 'Ride', time: 'Time', view: 'Camera', more: 'More',
    cadence: 'Cadence', coast: 'Coast', wave: 'Wave', hop: 'Hop',
    stroll: 'Stroll', cruise: 'Cruise', sprint: 'Sprint',
    tod: 'Time of day', auto: 'Auto day cycle',
    wide: 'Wide', close: 'Close-up', cinematic: 'Cinematic',
    sound: 'Sound', music: 'Music', dlSvg: 'Animated SVG', dlFrame: 'This frame', keys: 'Shortcuts', lang: 'Language',
    langBi: '中 / EN', langZh: '中文', langEn: 'EN',
    dist: 'Distance', speed: 'Speed', rpm: 'Cadence', km: 'km', kmh: 'km/h', rpmU: 'rpm',
    riding: 'Riding', paused: 'Paused', coasting: 'Coasting',
    todNames: ['Midnight', 'Small hours', 'Dawn', 'Morning', 'Noon', 'Afternoon', 'Golden hour', 'Sunset', 'Dusk', 'Night'],
    aBell: 'Ring ring!', aWave: 'The pelican waves a wing', aHop: 'Hop!', aNotYet: 'Not landed yet, one moment', aFeed: 'Fed a fish. Gulp!',
    aPaused: 'Paused', aPlaying: 'Riding on', aCoastOn: 'Coasting', aCoastOff: 'Pedalling again',
    aCam: 'Camera: {x}', aTod: 'Time of day: {x}', aAutoOn: 'Auto day cycle on', aAutoOff: 'Auto day cycle off',
    aSoundOn: 'Sound on', aSoundOff: 'Sound off', aMusicOn: 'Synthwave music on', aMusicOff: 'Music off', aCadence: '{rpm} rpm · {kmh} km/h',
    aBeat: 'Pedalling to your beat: {rpm} rpm', aPrinting: 'Exporting…', aSaved: 'Downloaded {x}', aLang: 'Language: Chinese and English',
    aLangZh: 'Language: Chinese', aLangEn: 'Language: English', aKeysOff: 'Single-key shortcuts off', aKeysOn: 'Single-key shortcuts on',
    hintFine: 'Click the pelican to feed it a fish', hintCoarse: 'Tap the pelican to feed it a fish',
    helpTitle: 'Keyboard shortcuts', helpTry: 'Press any shortcut and its key lights up on the keyboard.', helpEnable: 'Single-key shortcuts',
    helpClose: 'Close', helpTouch: 'Touch gestures',
    gTap: 'Tap the pelican: feed it a fish', gSheet: 'Swipe up or tap the panel: open the controls', gSlide: 'Drag the sliders: cadence and time of day',
    reduced: 'Reduced motion on: the poster holds still, press Play to ride', reducedToast: 'Reduced motion on',
    region: 'Pelican Bay control panel', odo: 'Ride telemetry', telemetry: 'Telemetry',
    kbBell: 'Ring', kbWave: 'Wave', kbHop: 'Hop', kbFeed: 'Feed', kbCam: 'Camera', kbTod: 'Time', kbAuto: 'Auto day',
    kbSlower: 'Slower', kbFaster: 'Faster', kbCoast: 'Coast', kbSound: 'Sound', kbMusic: 'Music', kbPause: 'Pause', kbHelp: 'Help', kbLang: 'Language',
    aEgg: 'Easter egg found: {x}', beatTip: 'Tap ← → alternately to pedal to your own beat', printed: 'Neon-Net online', plate: 'Signal 5/5',
  },
};

// ------------------------------------------------------------------ keymap (single source of truth)
// keys: KeyboardEvent.key values (layout-independent: AZERTY / Dvorak letters work). once: ignore auto-repeat.
export const KEYMAP = [
  { act: 'bell', keys: [' '], cap: 'Space', aria: 'Space', label: 'kbBell', once: true },
  { act: 'wave', keys: ['w'], cap: 'W', aria: 'W', label: 'kbWave', once: true },
  { act: 'hop', keys: ['h', 'ArrowUp'], cap: 'H', aria: 'H ArrowUp', label: 'kbHop', once: true },
  { act: 'feed', keys: ['f'], cap: 'F', aria: 'F', label: 'kbFeed', once: true },
  { act: 'camera', keys: ['c'], cap: 'C', aria: 'C', label: 'kbCam', once: true },
  { act: 'tod', keys: ['t'], cap: 'T', aria: 'T', label: 'kbTod', once: true },
  { act: 'auto', keys: ['a'], cap: 'A', aria: 'A', label: 'kbAuto', once: true },
  { act: 'slower', keys: ['ArrowLeft'], cap: '←', aria: 'ArrowLeft', label: 'kbSlower', once: false },
  { act: 'faster', keys: ['ArrowRight'], cap: '→', aria: 'ArrowRight', label: 'kbFaster', once: false },
  { act: 'coast', keys: ['s'], cap: 'S', aria: 'S', label: 'kbCoast', once: true },
  { act: 'sound', keys: ['m'], cap: 'M', aria: 'M', label: 'kbSound', once: true },
  { act: 'music', keys: ['u'], cap: 'U', aria: 'U', label: 'kbMusic', once: true },
  { act: 'pause', keys: ['p'], cap: 'P', aria: 'P', label: 'kbPause', once: true },
  { act: 'lang', keys: ['l'], cap: 'L', aria: 'L', label: 'kbLang', once: true },
  { act: 'help', keys: ['?'], cap: '?', aria: 'Shift+?', label: 'kbHelp', once: true, always: true },
];
const KEY_TO = new Map(KEYMAP.flatMap(k => k.keys.map(key => [key, k])));
const ariaKeys = act => KEYMAP.find(k => k.act === act)?.aria || '';
const capOf = act => KEYMAP.find(k => k.act === act)?.cap || '';
// short keycap labels (the legend keeps the full words): a 3.7rem cap fits ~5 caps letters
const CAPSHORT = { en: { kbAuto: 'Auto', kbLang: 'Lang', kbCam: 'Cam', kbSlower: 'Slow', kbFaster: 'Fast', kbSound: 'Sound', kbMusic: 'Music' }, zh: { kbAuto: '自动', kbTod: '时刻', kbCam: '镜头', kbSlower: '慢', kbFaster: '快' } };
const capLab = (lang, k) => CAPSHORT[lang][k] || STRINGS[lang][k];

// ------------------------------------------------------------------ units
const M_PER_UNIT = 0.34 / BIKE.R;                                  // wheel R = 100 units ≈ a 0.34 m 700c wheel
export const kmh = cadence => (cadence / 60) * DIST_PER_REV * M_PER_UNIT * 3.6;
const km = distance => distance * M_PER_UNIT / 1000;
const TOD_PRESETS = [0.27, 0.5, 0.70, 0.765, 0.81, 0.93];
const todName = (tod, L) => {
  const i = tod < 0.19 ? 0 : tod < 0.25 ? 1 : tod < 0.31 ? 2 : tod < 0.45 ? 3 : tod < 0.56 ? 4 : tod < 0.67 ? 5 : tod < 0.745 ? 6 : tod < 0.79 ? 7 : tod < 0.85 ? 8 : 9;
  return STRINGS[L].todNames[i];
};
const clock = tod => { const m = Math.round(tod * 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

// ------------------------------------------------------------------ glyph lettering (the poster's own outlines)
const LAT = PG.LAT || {}, ZH = PG.ZH || {}, MONO = PG.MONO && PG.MONO['0'] ? PG.MONO : (PG.LAT || {});
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function glyphRun(text, set, track = 60) {
  let x = 0, d = '';
  for (const ch of text) {
    if (ch === ' ') { x += 320; continue; }
    const g = set[ch]; if (!g) continue;
    d += `<path transform="translate(${x} 0)" d="${g[1]}"/>`;
    x += g[0] + track;
  }
  return { d, w: x - track };
}
function wordmark(text, set, track, h = 1000, top = -780, split = 0) {
  const r = glyphRun(text, set, track);
  // split: a chromatic cyan echo offset behind the face (the scene title's glitch split, as static geometry)
  const echo = split ? `<g class="ui-wm-c" transform="translate(${-split} ${split * 0.4})">${r.d}</g>` : '';
  return `<svg viewBox="${split ? -split : 0} ${top} ${r.w + split} ${h}" aria-hidden="true" focusable="false" preserveAspectRatio="xMinYMid meet">${echo}<g>${r.d}</g></svg>`;
}

// ------------------------------------------------------------------ icons (24×24, stroke = currentColor)
const IC = {
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  pause: '<path d="M8 5.5v13M16 5.5v13" stroke-width="3.4"/>',
  bell: '<path d="M5 16.5h14M7 16.5c0-5.2 2.2-8.6 5-8.6s5 3.4 5 8.6M12 7.9V5.5M10.5 4.6h3M10 19.2a2 2 0 0 0 4 0"/>',
  fish: '<path d="M1.8 12c3.4-5.4 10-6.4 14.6-1.8L21.6 6v12l-5.2-4.2C11.8 18.4 5.2 17.4 1.8 12z"/><circle cx="6.8" cy="11" r="1.2" fill="currentColor"/><path d="M10.6 8.8c1 2 1 4.4 0 6.4M13.4 12h.1"/>',
  chev: '<path d="M6 14.5l6-6 6 6"/>',
  coast: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><path d="M2 7h4M1 12h3M2 17h4"/>',
  wave: '<path d="M5 18c2-6 5.5-10 11-12.5M8 18.5c1.8-4.4 4.4-7.5 8.5-9.6M11 19c1.4-3 3.3-5.3 6.3-6.8M3.5 19.5h17"/>',
  hop: '<circle cx="12" cy="17.5" r="3.6"/><path d="M12 11V3.5M8.6 6.8 12 3.4l3.4 3.4M4 21.5h16"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  moon: '<path d="M15.8 3.8a8.4 8.4 0 1 0 4.4 12.4A7 7 0 0 1 15.8 3.8z"/><path d="M18 4.5l.6 1.3 1.4.3-1.1.9.3 1.4-1.2-.8-1.2.8.3-1.4-1-.9 1.3-.3z" fill="currentColor" stroke-width="1"/>',
  auto: '<path d="M19.5 9A8 8 0 0 0 5 7.5M4.5 15A8 8 0 0 0 19 16.5"/><path d="M19.8 4.5V9h-4.5M4.2 19.5V15h4.5"/>',
  wide: '<rect x="2.5" y="7" width="19" height="10" rx="1"/><path d="M5.5 14l3.5-3 3 2.5 2.5-2 3.5 2.5"/>',
  close: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5M8 10.5h5M10.5 8v5"/>',
  cinematic: '<rect x="2.5" y="5" width="19" height="14" rx="1"/><path d="M2.5 8.5h19M2.5 15.5h19" stroke-width="3"/>',
  soundOn: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>',
  soundOff: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5"/>',
  // music: a synth keyboard under a sawtooth (the darksynth arpeggio); off = the same with the wave cut
  music: '<rect x="3" y="12.5" width="18" height="8" rx="1"/><path d="M7.5 12.5v4.5M12 12.5v4.5M16.5 12.5v4.5"/><path d="M3 8.5l4-5v5l4-5v5l4-5v5l4-5v5" stroke-width="1.6"/>',
  musicOff: '<rect x="3" y="12.5" width="18" height="8" rx="1"/><path d="M7.5 12.5v4.5M12 12.5v4.5M16.5 12.5v4.5"/><path d="M3 8.5l4-5v5l4-5" stroke-width="1.6"/><path d="M14 4l6 6M20 4l-6 6" stroke-width="1.6"/>',
  dl: '<path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M4 17v3.5h16V17"/>',
  frame: '<rect x="3.5" y="4.5" width="17" height="15" rx="1"/><rect x="6.5" y="7.5" width="11" height="9"/><circle cx="14.5" cy="10" r="1.3" fill="currentColor"/>',
  keys: '<rect x="2.5" y="6" width="19" height="12" rx="1.5"/><path d="M6 9.5h1M9.5 9.5h1M13 9.5h1M16.5 9.5h1M6 12.5h1M17 12.5h1M8.5 15h7"/>',
  lang: '<path d="M3 5.5h9M7.5 4v1.5M5 5.5c.8 3 3 5.5 6 6.5M10.2 5.5C9.5 9 7 11.5 3.5 12.8"/><path d="M12.5 20l3.8-9 3.8 9M13.9 17h4.8"/>',
  tap: '<path d="M10 11V5.5a1.6 1.6 0 0 1 3.2 0V12l3.6.8a2 2 0 0 1 1.6 2.3l-.8 4.4H10.3L7 15.2a1.5 1.5 0 0 1 2.2-2L10 14"/><path d="M6.5 5.5a5 5 0 0 1 10 0" stroke-dasharray="1.5 2"/>',
  swipe: '<path d="M12 20V6M8 9.5 12 5.5l4 4"/><rect x="4" y="16.5" width="16" height="5" rx="1"/>',
  slide: '<path d="M3 12h18"/><rect x="10" y="7.5" width="5" height="9" rx="1" fill="currentColor"/>',
};
const icon = (name, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${IC[name]}</svg>`;

// header data strip (static): a seeded barcode on the left, a tick ruler across, a magenta progress block on the right
const DATASTRIP = (() => {
  let seed = 719, bars = '', x = 0;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  while (x < 96) { const w = 1 + Math.floor(rnd() * 3); if (rnd() > 0.35) bars += `M${x} 0h${w}v7h${-w}z`; x += w + 1; }
  let ticks = '';
  for (let t = 104; t <= 236; t += 4) ticks += `M${t} ${t % 20 === 0 ? 0 : 3}v${t % 20 === 0 ? 7 : 4}`;
  return `<path d="${bars}" fill="#E9E6F2" opacity=".55"/><path d="${ticks}" stroke="#19E6FF" stroke-width="1" opacity=".75"/>` +
    `<path d="M244 2h56v3h-56z" fill="#3A3F5C"/><path d="M244 2h36v3h-36z" fill="#FF2E88"/><path d="M296 0h4v7h-4z" fill="#C6FF3D"/>`;
})();

// cadence spectrum: 32 bars of fixed, seeded heights (the lit copy is clipped to cadence / max)
const EQBARS = (() => { let s = 23, o = ''; for (let i = 0; i < 32; i++) { s = (s * 16807) % 2147483647; const h = 35 + Math.round(((s / 2147483647) * 0.5 + 0.5 * Math.abs(Math.sin(i * 0.55))) * 65); o += `<i style="height:${h}%"></i>`; } return o; })();

// ------------------------------------------------------------------ odometer drum (a reel of path-glyph numerals)
// Cells top→bottom: 9 0 1 2 3 4 5 6 7 8 9 0 1  (index = digit + 1); a forward wrap rolls on into the spare "0 1".
const CELL = 1000, DIG = '9012345678901';
function drumMarkup(red) {
  let cells = '';
  for (let i = 0; i < DIG.length; i++) {
    const g = MONO[DIG[i]] || LAT[DIG[i]];
    cells += `<path transform="translate(${(760 - g[0]) / 2} ${i * CELL + 872})" d="${g[1]}"/>`;
  }
  return `<span class="ui-drum${red ? ' red' : ''}"><svg viewBox="0 0 760 ${CELL}" preserveAspectRatio="xMidYMin slice" aria-hidden="true" focusable="false"><g class="ui-reel">${cells}</g></svg></span>`;
}
function makeDrum(el) {
  const reel = el.querySelector('.ui-reel');
  let cur = -1, off = 0;
  const put = idx => { reel.style.transform = `translateY(${(-idx * CELL).toFixed(1)}px)`; };
  return {
    set(p) {   // p in [0,10)
      if (Math.abs(p - cur) < 0.004) return;
      if (off) { reel.style.transition = 'none'; put(cur + 1); void reel.getBoundingClientRect(); reel.style.transition = ''; off = 0; }
      if (cur >= 0 && p < cur - 5) { off = 10; put(p + 1 + off); }             // 9 → 0: roll forward, re-seat next time
      else if (cur < 0 || Math.abs(p - cur) > 2.5) { reel.style.transition = 'none'; put(p + 1); void reel.getBoundingClientRect(); reel.style.transition = ''; }
      else put(p + 1);
      cur = p;
    },
  };
}
// mechanical odometer: each drum turns only while the drum to its right passes 9 → 0 (carry)
function odoDigits(value, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const v = value / 10 ** i;
    let p = Math.floor(v) % 10;
    if (i === 0) p = v % 10;
    else { const lower = (value / 10 ** (i - 1)) % 10; if (lower > 9) p += lower - 9; }
    out.push(p % 10);
  }
  return out.reverse();
}

// ------------------------------------------------------------------ storage (per-viewer conveniences only)
const store = {
  get(k) { try { return localStorage.getItem('pb-ui-' + k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('pb-ui-' + k, v); } catch { /* private mode */ } },
};

// ================================================================== createUI
export function createUI(host, bus, init) {
  const S = init.state;
  const doc = host.ownerDocument;
  const win = doc.defaultView;
  const params = new URLSearchParams(win.location.search);
  const shooting = params.has('freeze');     // deterministic screenshot mode: no timed hints / toasts
  injectStyles(doc);

  // ---------- language ----------
  const detectLang = () => {
    const q = params.get('lang'); if (q === 'zh' || q === 'en' || q === 'bi') return q;
    const s = store.get('lang'); if (s === 'zh' || s === 'en' || s === 'bi') return s;
    return 'bi';   // default: bilingual, 中文 first (the brief); navigator.languages only picks the reading order of aria
  };
  let lang = detectLang();
  const navZh = (win.navigator.languages || [win.navigator.language || '']).some(l => /^zh/i.test(l));
  const L1 = () => (lang === 'en' ? 'en' : 'zh');                      // primary language for names / announcements
  const t = (k, vars) => {
    const one = L => { let s = STRINGS[L][k]; if (vars) for (const [a, b] of Object.entries(vars)) s = s.replace('{' + a + '}', typeof b === 'object' ? b[L] : b); return s; };
    return lang === 'bi' ? `${one('zh')} · ${one('en')}` : one(L1());
  };
  const bi = (k, cls = '') => `<span class="zh ${cls}" lang="zh-CN" data-s="${k}">${esc(STRINGS.zh[k])}</span><span class="en ${cls}" lang="en" data-s="${k}">${esc(STRINGS.en[k])}</span>`;
  const unit = k => `<span class="zh unit-zh" lang="zh-CN">${esc(STRINGS.zh[k])}</span><span class="en" lang="en">${esc(STRINGS.en[k])}</span>`;
  const nf = { zh: new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }), en: new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }) };

  // ---------- markup ----------
  const btn = (act, ico, key, extra = '') => {
    const kb = ariaKeys(act === 'play' ? 'pause' : act);
    return `<button type="button" class="ui-btn" data-act="${act}" ${kb ? `aria-keyshortcuts="${kb}"` : ''} ${extra}>${icon(ico)}<span class="lab">${bi(key)}</span>${kb ? `<span class="kbd" aria-hidden="true">${esc(capOf(act === 'play' ? 'pause' : act))}</span>` : ''}</button>`;
  };
  const rowb = html => html.replace('class="ui-btn"', 'class="ui-btn row"');
  const seal = wordmark('鹈鹕外卖', ZH, 40, 1000, -860);
  const word = wordmark('PELICAN EXPRESS', LAT, 70, 760, -740, 55);
  const serialNo = '0719';
  const drumsKm = drumMarkup() + drumMarkup() + drumMarkup() + '<span class="ui-dot"></span>' + drumMarkup(true) + drumMarkup(true);
  host.innerHTML = `
<section class="ui-card" id="ui-card" role="region" aria-labelledby="ui-card-h" data-dock="left" data-open="false">
  <div class="ui-shadow" aria-hidden="true"></div>
  <div class="ui-plate">
   <div class="ui-frame">
    <div class="ui-grip" aria-hidden="true"></div>
    <header class="ui-head">
      <span class="ui-seal" aria-hidden="true">${seal}</span>
      <span class="ui-wordmark"><h2 id="ui-card-h" class="ui-sr" data-name="region"></h2>${word}<span class="ui-sub">${bi('sub')}</span></span>
      <span class="ui-serial" aria-hidden="true">ID<b>#${serialNo}</b></span>
    </header>
    <svg class="ui-guil" viewBox="0 0 300 7" preserveAspectRatio="none" aria-hidden="true" focusable="false">${DATASTRIP}</svg>
    <div class="ui-odo" role="group" aria-labelledby="ui-odo-h">
      <span id="ui-odo-h" class="ui-sr" data-name="odo"></span>
      <span class="ui-odo-t" aria-hidden="true"><i></i>${bi('telemetry')}</span>
      <div class="ui-state" aria-hidden="true"><span class="ui-lamp run"></span><span data-state></span></div>
      <div class="ui-meter"><span class="ui-meter-lab" aria-hidden="true">${bi('speed')}</span><span class="ui-drums big" data-drums="kmh">${drumMarkup() + drumMarkup()}</span><span class="ui-unit" aria-hidden="true">${unit('kmh')}</span><span class="ui-sr" data-live="kmh"></span></div>
      <div class="ui-meter"><span class="ui-meter-lab" aria-hidden="true">${bi('rpm')}</span><span class="ui-drums" data-drums="rpm">${drumMarkup() + drumMarkup() + drumMarkup()}</span><span class="ui-unit" aria-hidden="true">${unit('rpmU')}</span><span class="ui-sr" data-live="rpm"></span></div>
      <div class="ui-meter">
        <span class="ui-meter-lab" aria-hidden="true">${bi('dist')}</span>
        <span class="ui-drums" data-drums="km">${drumsKm}</span>
        <span class="ui-unit" aria-hidden="true">${unit('km')}</span>
        <span class="ui-sr" data-live="km"></span>
      </div>
      <div class="ui-eq" aria-hidden="true"><span>${EQBARS}</span><span class="lit">${EQBARS}</span></div>
    </div>
    <div class="ui-quick">
      ${btn('play', 'pause', 'pause')}
      ${btn('bell', 'bell', 'bell')}
      ${btn('feed', 'fish', 'feed')}
      <button type="button" class="ui-btn ui-toggle" data-act="toggle" aria-expanded="false" aria-controls="ui-body">${icon('chev')}<span class="lab">${bi('controls')}</span></button>
    </div>
    <p class="ui-note" data-reduced-note hidden>${bi('reduced')}</p>
    <div class="ui-perf" aria-hidden="true"></div>
    <div class="ui-body" id="ui-body">
      <div class="ui-tabs" role="tablist" aria-label="${esc(STRINGS.zh.controls)} ${esc(STRINGS.en.controls)}">
        ${['ride', 'time', 'view', 'more'].map((s, i) => `<button type="button" class="ui-btn" role="tab" id="ui-tab-${s}" aria-controls="ui-sec-${s}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-tab="${s}"><span class="lab">${bi(s)}</span></button>`).join('')}
      </div>
      <section class="ui-sec active" id="ui-sec-ride" data-sec="ride" role="tabpanel" aria-labelledby="ui-tab-ride">
        <h3 class="ui-sec-h" id="ui-sec-ride-h"><i></i>${bi('ride')}</h3>
        <div class="ui-field">
          <label for="ui-cadence">${bi('cadence')}</label><output class="ui-readout" for="ui-cadence" data-out="cadence"></output>
          <input class="ui-range" id="ui-cadence" type="range" min="${CADENCE.min}" max="${CADENCE.max}" step="1" aria-keyshortcuts="ArrowLeft ArrowRight">
          <div class="ui-ticks" aria-hidden="true">${[['stroll', CADENCE.stroll], ['cruise', CADENCE.cruise], ['sprint', CADENCE.sprint]].map(([k, c]) => `<span style="position:absolute;left:${((c - CADENCE.min) / (CADENCE.max - CADENCE.min) * 100).toFixed(1)}%;translate:-50% 0">${bi(k)}</span>`).join('')}&nbsp;</div>
        </div>
        <div class="ui-row">
          ${rowb(btn('coast', 'coast', 'coast', 'aria-pressed="false"').replace('</button>', '<span class="pip" aria-hidden="true"></span></button>'))}
          ${rowb(btn('wave', 'wave', 'wave'))}
          ${rowb(btn('hop', 'hop', 'hop').replace('</button>', '<span class="cool" aria-hidden="true"></span></button>'))}
        </div>
      </section>
      <section class="ui-sec" id="ui-sec-time" data-sec="time" role="tabpanel" aria-labelledby="ui-tab-time">
        <h3 class="ui-sec-h" id="ui-sec-time-h"><i></i>${bi('time')}</h3>
        <div class="ui-field">
          <label for="ui-tod"><span class="ui-todico" aria-hidden="true"></span>${bi('tod')}</label><output class="ui-readout" for="ui-tod" data-out="tod"></output>
          <input class="ui-range tod" id="ui-tod" type="range" min="0" max="1000" step="5" aria-keyshortcuts="T">
        </div>
        <div class="ui-row two">
          ${btn('auto', 'auto', 'auto', 'aria-pressed="false"').replace('</button>', '<span class="pip" aria-hidden="true"></span></button>').replace('ui-btn"', 'ui-btn row"')}
          ${btn('tod', 'sun', 'tod').replace('ui-btn"', 'ui-btn row" data-todbtn')}
        </div>
      </section>
      <section class="ui-sec" id="ui-sec-view" data-sec="view" role="tabpanel" aria-labelledby="ui-tab-view">
        <h3 class="ui-sec-h" id="ui-sec-view-h"><i></i>${bi('view')}</h3>
        <div class="ui-row" role="radiogroup" aria-labelledby="ui-sec-view-h" aria-keyshortcuts="C">
          ${Object.keys(CAMERAS).map(m => `<button type="button" class="ui-btn" role="radio" data-cam="${m}" aria-checked="false" tabindex="-1">${icon(m)}<span class="lab">${bi(m)}</span><span class="pip" aria-hidden="true"></span></button>`).join('')}
        </div>
      </section>
      <section class="ui-sec" id="ui-sec-more" data-sec="more" role="tabpanel" aria-labelledby="ui-tab-more">
        <h3 class="ui-sec-h" id="ui-sec-more-h"><i></i>${bi('more')}</h3>
        <div class="ui-row two">
          ${rowb(btn('sound', 'soundOff', 'sound', 'aria-pressed="false"').replace('</button>', '<span class="pip" aria-hidden="true"></span></button>'))}
          ${rowb(btn('music', 'musicOff', 'music', 'aria-pressed="false"').replace('</button>', '<span class="pip" aria-hidden="true"></span></button>'))}
        </div>
        <div class="ui-row two">
          ${rowb(btn('dlSvg', 'dl', 'dlSvg'))}
          ${rowb(btn('dlFrame', 'frame', 'dlFrame'))}
        </div>
        <div class="ui-row two">
          ${rowb(btn('help', 'keys', 'keys', 'aria-haspopup="dialog"'))}
          ${rowb(btn('lang', 'lang', 'lang'))}
        </div>
        <div class="ui-foot" aria-hidden="true"><span>${bi('printed')}</span><span>${bi('plate')} · #${serialNo}</span></div>
      </section>
    </div>
   </div>
  </div>
</section>
<div class="ui-hint" aria-hidden="true"><span data-hint></span><svg viewBox="0 0 40 34"><path d="M34 0v10L10 30"/><circle cx="8" cy="31.5" r="2.6"/></svg></div>
<div class="ui-toast" aria-hidden="true"></div>
<div class="ui-sr" role="status" aria-live="polite" aria-atomic="true" data-announcer></div>`;

  // help dialog lives outside the card (top layer)
  const dlg = doc.createElement('dialog');
  dlg.className = 'ui-help';
  dlg.setAttribute('aria-labelledby', 'ui-help-h');
  const ROWS = [['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'], ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', '?'], ['z', 'x', 'c', 'v', 'b', 'n', 'm']];
  const capHTML = key => {
    const k = KEY_TO.get(key);
    const face = key === '?' ? '?' : key.toUpperCase();
    return `<span class="ui-cap${k ? '' : ' dim'}${key === '?' ? ' q' : ''}" data-cap="${esc(key)}"><span class="face">${esc(face)}</span>${k ? `<small class="zh" lang="zh-CN">${esc(capLab('zh', k.label))}</small><small class="en" lang="en">${esc(capLab('en', k.label))}</small>` : ''}</span>`;
  };
  dlg.innerHTML = `
<h2 id="ui-help-h">${bi('helpTitle')}</h2>
<p class="try">${bi('helpTry')}</p>
<div class="ui-kb" aria-hidden="true">
  ${ROWS.map(r => `<div class="ui-kb-row">${r.map(capHTML).join('')}</div>`).join('')}
  <div class="ui-kb-row"><span class="ui-cap wide" data-cap=" ">Space<small class="zh" lang="zh-CN">${esc(STRINGS.zh.kbBell)}</small><small class="en" lang="en">${esc(STRINGS.en.kbBell)}</small></span></div>
  <div class="ui-kb-row arrows">${capHTML('ArrowLeft').replace('>ARROWLEFT', '>←')}${capHTML('ArrowUp').replace('>ARROWUP', '>↑')}${capHTML('ArrowRight').replace('>ARROWRIGHT', '>→')}</div>
</div>
<ul class="ui-legend">${KEYMAP.map(k => `<li><kbd>${esc(k.cap)}${k.keys.includes('ArrowUp') ? ' / ↑' : ''}</kbd>${bi(k.label)}</li>`).join('')}<li class="beat"><kbd>← →</kbd><span class="zh" lang="zh-CN">${esc(STRINGS.zh.beatTip)}</span><span class="en" lang="en">${esc(STRINGS.en.beatTip)}</span></li></ul>
<ul class="ui-gestures">
  <li>${icon('tap', '')}${bi('gTap')}</li><li>${icon('swipe', '')}${bi('gSheet')}</li><li>${icon('slide', '')}${bi('gSlide')}</li>
</ul>
<div class="ui-help-foot">
  <label class="ui-check"><input type="checkbox" data-keys-enabled checked><span class="box" aria-hidden="true"></span><span>${bi('helpEnable')}</span></label>
  <button type="button" class="ui-btn" data-close>${bi('helpClose')} <kbd aria-hidden="true">Esc</kbd></button>
</div>`;
  host.appendChild(dlg);

  // ---------- refs ----------
  const $ = s => host.querySelector(s);
  const card = $('.ui-card'), plate = $('.ui-plate'), perf = $('.ui-perf');
  const B = {}; for (const el of host.querySelectorAll('[data-act]')) B[el.dataset.act] = el;
  const camBtns = [...host.querySelectorAll('[data-cam]')];
  const tabs = [...host.querySelectorAll('[data-tab]')];
  const secs = [...host.querySelectorAll('.ui-sec')];
  const cad = $('#ui-cadence'), tod = $('#ui-tod');
  const outCad = $('[data-out="cadence"]'), outTod = $('[data-out="tod"]');
  const todIco = $('.ui-todico');
  const stateEl = $('[data-state]');
  const announcer = $('[data-announcer]');
  const hint = $('.ui-hint'), hintText = $('[data-hint]'), toast = $('.ui-toast');
  const keysBox = dlg.querySelector('[data-keys-enabled]');
  const drums = {
    km: [...host.querySelectorAll('[data-drums="km"] .ui-drum')].map(makeDrum),
    kmh: [...host.querySelectorAll('[data-drums="kmh"] .ui-drum')].map(makeDrum),
    rpm: [...host.querySelectorAll('[data-drums="rpm"] .ui-drum')].map(makeDrum),
  };
  const srKm = $('[data-live="km"]'), srKmh = $('[data-live="kmh"]'), srRpm = $('[data-live="rpm"]');
  // the rider's screen box = union of its slot groups (the scene is split into <svg> sheets, so #rider itself only holds
  // the first group of slots; its children are exactly the j-* slots)
  const rider = () => {
    const slots = doc.querySelectorAll('#scene [id^="j-"]');
    if (!slots.length) return null;
    return { getBoundingClientRect() {
      let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
      for (const e of slots) { const q = e.getBoundingClientRect(); if (!q.width && !q.height) continue; l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); }
      return l < r ? { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t, x: l, y: t } : { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 };
    } };
  };

  const eqLit = $('.ui-eq .lit');

  // ---------- announcer: exactly one polite message per user action ----------
  let annTimer = 0, annFlip = false;
  function announce(k, vars) {
    clearTimeout(annTimer);
    const msg = t(k, vars);
    annTimer = setTimeout(() => { annFlip = !annFlip; announcer.textContent = msg + (annFlip ? '​' : ''); }, 60);
  }

  // ---------- language application ----------
  function applyLang() {
    host.dataset.lang = lang; dlg.dataset.lang = lang;
    doc.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
    doc.title = lang === 'en' ? 'Neon Pelican · Pelican Bay' : lang === 'zh' ? '霓虹鹈鹕 · 鹈鹕湾' : '霓虹鹈鹕 · 鹈鹕湾 · Neon Pelican';
    for (const el of host.querySelectorAll('[data-name]')) el.textContent = t(el.dataset.name);
    card.setAttribute('aria-label', t('region'));
    card.removeAttribute('aria-labelledby');
    hintText.innerHTML = bi(coarse() ? 'hintCoarse' : 'hintFine');
    const lk = lang === 'bi' ? 'langBi' : lang === 'zh' ? 'langZh' : 'langEn';
    const lab = B.lang.querySelector('.lab');
    lab.innerHTML = `<span class="zh" lang="zh-CN">${esc(STRINGS.zh.lang)}</span><span class="en" lang="en">${esc(STRINGS.en[lk])}</span>`;
    if (lang === 'en') lab.innerHTML = `<span class="en" lang="en">${esc(STRINGS.en.lang)} · ${esc(STRINGS.en[lk])}</span>`;
    last = {};           // force every readout to re-render in the new language
    sync(true);
    measure();
  }
  const coarse = () => win.matchMedia('(pointer: coarse)').matches;

  // ---------- state → view (called on every action and at ≤10 Hz) ----------
  let last = {};
  const setIf = (key, val, fn) => { if (last[key] !== val) { last[key] = val; fn(val); } };
  function sync(force) {
    const playing = !!S.playing;
    setIf('playing', playing, p => {
      host.dataset.playing = p;
      B.play.querySelector('.ico').innerHTML = IC[p ? 'pause' : 'play'];
      B.play.querySelector('.lab').innerHTML = bi(p ? 'pause' : 'play');
    });
    setIf('coast', !!S.coasting, c => { host.dataset.coasting = c; B.coast.setAttribute('aria-pressed', c); });
    setIf('stateTxt', `${playing}${S.coasting}${lang}`, () => { stateEl.innerHTML = bi(!playing ? 'paused' : S.coasting ? 'coasting' : 'riding'); });
    setIf('auto', !!S.todAuto, a => B.auto.setAttribute('aria-pressed', a));
    setIf('sound', !!S.toggles.sound, s => { B.sound.setAttribute('aria-pressed', s); B.sound.querySelector('.ico').innerHTML = IC[s ? 'soundOn' : 'soundOff']; });
    setIf('music', S.toggles.music === true, m => { B.music.setAttribute('aria-pressed', m); B.music.querySelector('.ico').innerHTML = IC[m ? 'music' : 'musicOff']; });
    setIf('cam', S.cam, m => camBtns.forEach(b => { const on = b.dataset.cam === m; b.setAttribute('aria-checked', on); b.tabIndex = on ? 0 : -1; }));
    setIf('hud', S.toggles.hud !== false, on => { host.dataset.hud = on ? 'on' : 'off'; });
    // cadence slider shows the target; its value text speaks the unit in the current language
    const ct = Math.round(S.cadenceTarget);
    setIf('cadT', ct + lang, () => {
      if (doc.activeElement !== cad || force) cad.value = ct;
      const p = ((ct - CADENCE.min) / (CADENCE.max - CADENCE.min) * 100).toFixed(1) + '%';
      cad.style.setProperty('--p', p);
      const vt = t('aCadence', { rpm: ct, kmh: Math.round(kmh(ct)) });
      cad.setAttribute('aria-valuetext', vt);
      outCad.textContent = lang === 'en' ? `${ct} rpm · ${Math.round(kmh(ct))} km/h` : `${ct} 转/分 · ${Math.round(kmh(ct))} 公里/时`;
    });
    const tv = Math.round(S.tod * 200) / 200;
    setIf('tod', tv + lang, () => {
      if (doc.activeElement !== tod || force) tod.value = Math.round(S.tod * 1000);
      const name = { zh: todName(S.tod, 'zh'), en: todName(S.tod, 'en') };
      const txt = `${clock(S.tod)} · ${lang === 'en' ? name.en : name.zh}`;
      outTod.textContent = txt;
      tod.setAttribute('aria-valuetext', lang === 'bi' ? `${clock(S.tod)} · ${name.zh} · ${name.en}` : txt);
      const night = S.tod < 0.235 || S.tod > 0.81;
      setIf('todIco', night, n => { todIco.innerHTML = icon(n ? 'moon' : 'sun'); B.tod.querySelector('.ico').innerHTML = IC[n ? 'moon' : 'sun']; });
    });
  }

  // ---------- HUD (≤10 Hz) ----------
  function hud(frame) {
    const k = km(frame.distance);
    const dk = odoDigits(Math.floor(Math.min(k, 999.99) * 100), 5);   // digital counter: whole digits that roll on change
    dk.forEach((p, i) => drums.km[i].set(p));
    const sp = Math.round(kmh(frame.cadence));
    const rp = Math.round(frame.coasting ? frame.cadence : frame.cadence);
    const d2 = String(Math.min(99, sp)).padStart(2, '0'), d3 = String(Math.min(999, rp)).padStart(3, '0');
    [...d2].forEach((c, i) => drums.kmh[i].set(+c));
    [...d3].forEach((c, i) => drums.rpm[i].set(+c));
    setIf('srKm', k.toFixed(2) + lang, () => { srKm.textContent = lang === 'en' ? `${k.toFixed(2)} km` : `${k.toFixed(2)} 公里`; });
    setIf('srKmh', sp + lang, () => { srKmh.textContent = lang === 'en' ? `${nf.en.format(sp)} km/h` : `${nf.zh.format(sp)} 公里/时`; });
    // spectrum: lit bars = cadence / max, quantised to whole bars (one style write per change)
    setIf('eq', Math.round(Math.min(1, frame.cadence / CADENCE.max) * 32), n => eqLit.style.setProperty('--eq', `${((32 - n) / 32 * 100).toFixed(2)}%`));
    setIf('srRpm', rp + lang, () => { srRpm.textContent = lang === 'en' ? `${rp} rpm` : `${rp} 转/分`; });
  }

  // ---------- feedback flourishes ----------
  const flash = (el, cls = 'fired', ms = 450) => { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), ms); };

  // ---------- actions ----------
  let lastHopT = -9;
  const HOP_CD = TIMING.hop.gap;   // same guard as main.js / the rig
  const simNow = () => S.t;
  const ACT = {
    play() { bus.emit('ui:play', { on: !S.playing }); announce(S.playing ? 'aPlaying' : 'aPaused'); },
    pause() { ACT.play(); },
    bell() { bus.emit('ui:bell', {}); announce('aBell'); },
    wave() { bus.emit('ui:wave', {}); announce('aWave'); },
    hop() {
      if (simNow() - lastHopT <= HOP_CD && S.playing) { flash(B.hop, 'nope', 400); announce('aNotYet'); return; }
      lastHopT = simNow(); bus.emit('ui:hop', {}); announce('aHop');
      B.hop.classList.remove('cooling'); void B.hop.offsetWidth; B.hop.classList.add('cooling');
    },
    feed() { bus.emit('ui:gulp', {}); announce('aFeed'); },
    camera(mode) {
      const ms = Object.keys(CAMERAS);
      const m = typeof mode === 'string' ? mode : ms[(ms.indexOf(S.cam) + 1) % ms.length];
      bus.emit('ui:camera', { mode: m });
      announce('aCam', { x: { zh: STRINGS.zh[m], en: STRINGS.en[m] } });
    },
    tod(v) {
      let next = v;
      if (typeof v !== 'number') { next = TOD_PRESETS.find(p => p > S.tod + 0.004) ?? TOD_PRESETS[0]; }
      bus.emit('ui:tod', { tod: next, auto: false });
      if (typeof v !== 'number') announce('aTod', { x: { zh: `${clock(next)} ${todName(next, 'zh')}`, en: `${clock(next)} ${todName(next, 'en')}` } });
    },
    auto() { const on = !S.todAuto; bus.emit('ui:tod', { auto: on }); announce(on ? 'aAutoOn' : 'aAutoOff'); },
    coast() { const on = !S.coasting; bus.emit('ui:coast', { on }); announce(on ? 'aCoastOn' : 'aCoastOff'); },
    sound() { const on = !S.toggles.sound; bus.emit('ui:sound', { on }); announce(on ? 'aSoundOn' : 'aSoundOff'); },
    // music is its own switch (off by default, even after sound is enabled); turning it on also opens the sound
    music() {
      const on = S.toggles.music !== true;
      bus.emit('ui:toggle', { key: 'music', value: on });
      if (on && !S.toggles.sound) bus.emit('ui:sound', { on: true });
      announce(on ? 'aMusicOn' : 'aMusicOff');
    },
    speed(c, say) {
      const v = Math.max(CADENCE.min, Math.min(CADENCE.max, Math.round(c)));
      if (S.coasting) bus.emit('ui:coast', { on: false });
      bus.emit('ui:speed', { cadence: v });
      if (say) announce(say, { rpm: v, kmh: Math.round(kmh(v)) });
    },
    slower() { beat('l'); if (!beatHit) ACT.speed(S.cadenceTarget - 5, 'aCadence'); },
    faster() { beat('r'); if (!beatHit) ACT.speed(S.cadenceTarget + 5, 'aCadence'); },
    dlSvg() { download('svg'); },
    dlFrame() { download('frame'); },
    help() { openHelp(); },
    lang() { lang = lang === 'bi' ? 'zh' : lang === 'zh' ? 'en' : 'bi'; store.set('lang', lang); applyLang(); announce(lang === 'bi' ? 'aLang' : lang === 'zh' ? 'aLangZh' : 'aLangEn'); },
    toggle() { setOpen(card.dataset.open !== 'true'); },
  };
  function download(kind) {
    const b = kind === 'svg' ? B.dlSvg : B.dlFrame;
    announce('aPrinting');
    b.setAttribute('aria-busy', 'true');
    setTimeout(() => {   // let the "printing" state paint before the (synchronous) bake
      try { bus.emit('ui:download', { kind }); announce('aSaved', { x: kind === 'svg' ? 'pelican-bicycle.svg' : 'pelican-bay-frame.svg' }); }
      finally { b.removeAttribute('aria-busy'); flash(b); }
    }, 30);
  }

  // rhythm egg: tap ← → alternately and the pelican pedals to your beat (one tap = one pedal stroke = half a turn)
  const taps = [];
  let beatHit = false;
  function beat(side) {
    const now = win.performance.now();
    taps.push([side, now]);
    while (taps.length > 6) taps.shift();
    beatHit = false;
    if (taps.length < 5) return;
    const iv = [];
    for (let i = 1; i < taps.length; i++) { if (taps[i][0] === taps[i - 1][0]) return; iv.push(taps[i][1] - taps[i - 1][1]); }
    const mean = iv.reduce((a, b) => a + b, 0) / iv.length;
    const sd = Math.sqrt(iv.reduce((a, b) => a + (b - mean) ** 2, 0) / iv.length);
    if (mean < 150 || mean > 1600 || sd / mean > 0.22) return;
    beatHit = true;
    ACT.speed(30000 / mean, 'aBeat');
  }

  // ---------- event wiring: buttons ----------
  host.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (b && host.contains(b)) {
      dismissHint();
      const a = b.dataset.act;
      if (a === 'help' || a === 'toggle') { ACT[a](); return; }
      ACT[a === 'play' ? 'play' : a]();
      if (a === 'bell') flash(b, 'ring', 760);
      else if (a === 'feed') flash(b, 'gulp', 520);
      if (a !== 'hop') flash(b);
      queueMicrotask(() => sync());
      return;
    }
    const c = e.target.closest('[data-cam]');
    if (c) { ACT.camera(c.dataset.cam); flash(c); queueMicrotask(() => sync()); return; }
    const tb = e.target.closest('[data-tab]');
    if (tb) selectTab(tb.dataset.tab, true);
  });
  cad.addEventListener('input', () => { ACT.speed(+cad.value); queueMicrotask(() => sync()); });
  tod.addEventListener('input', () => { ACT.tod(+tod.value / 1000); queueMicrotask(() => sync()); });

  // radiogroup: roving tabindex + arrows; tablist the same
  const roving = (list, pick, e) => {
    const i = list.indexOf(e.target.closest('[role]'));
    if (i < 0) return false;
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, Home: -99, End: 99 }[e.key];
    if (!d) return false;
    e.preventDefault(); e.stopPropagation();
    const j = d === -99 ? 0 : d === 99 ? list.length - 1 : (i + d + list.length) % list.length;
    list[j].focus(); pick(list[j]);
    return true;
  };
  host.addEventListener('keydown', e => {
    if (e.target.closest('[role="radiogroup"]')) roving(camBtns, b => { ACT.camera(b.dataset.cam); queueMicrotask(() => sync()); }, e);
    else if (e.target.closest('[role="tablist"]')) roving(tabs, b => selectTab(b.dataset.tab), e);
  });
  function selectTab(name, focus) {
    for (const tb of tabs) { const on = tb.dataset.tab === name; tb.setAttribute('aria-selected', on); tb.tabIndex = on ? 0 : -1; if (on && focus) tb.focus(); }
    for (const s of secs) s.classList.toggle('active', s.dataset.sec === name);
    store.set('tab', name);
    measure();
  }
  const savedTab = store.get('tab'); if (savedTab && tabs.some(x => x.dataset.tab === savedTab)) selectTab(savedTab);

  // ---------- open / collapse (+ drag on phones) ----------
  function setOpen(open, quiet) {
    card.dataset.open = open;
    B.toggle.setAttribute('aria-expanded', open);
    B.toggle.querySelector('.lab').innerHTML = bi(open ? 'hide' : 'controls');
    if (!quiet) store.set('open', open ? '1' : '0');
    measure(); dock(true);
  }
  const grip = $('.ui-grip');
  let drag = null;
  const startDrag = e => { if (e.button > 0) return; drag = { y: e.clientY, id: e.pointerId, moved: false }; };
  grip.addEventListener('pointerdown', e => { startDrag(e); grip.setPointerCapture?.(e.pointerId); e.preventDefault(); });
  $('.ui-head').addEventListener('pointerdown', startDrag);
  win.addEventListener('pointermove', e => { if (drag && e.pointerId === drag.id && Math.abs(e.clientY - drag.y) > 6) drag.moved = true; });
  win.addEventListener('pointerup', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.y, onGrip = e.target === grip;
    if (dy < -24) setOpen(true); else if (dy > 24) setOpen(false); else if (onGrip && !drag.moved) setOpen(card.dataset.open !== 'true');
    drag = null;
  });

  // ---------- help dialog ----------
  let helpOpener = null;
  function openHelp() {
    if (dlg.open) return;
    helpOpener = doc.activeElement;
    try { dlg.showModal(); } catch { dlg.setAttribute('open', ''); }
    dlg.querySelector('[data-close]').focus();
  }
  dlg.addEventListener('close', () => { for (const c of dlg.querySelectorAll('.lit')) c.classList.remove('lit'); (helpOpener && helpOpener.isConnected ? helpOpener : B.help).focus?.(); });
  dlg.addEventListener('click', e => { if (e.target.closest('[data-close]') || e.target === dlg) dlg.close(); });
  let keysOn = store.get('keys') !== '0';
  keysBox.checked = keysOn;
  keysBox.addEventListener('change', () => { keysOn = keysBox.checked; store.set('keys', keysOn ? '1' : '0'); announce(keysOn ? 'aKeysOn' : 'aKeysOff'); });
  const capEl = key => dlg.querySelector(`[data-cap="${key === ' ' ? ' ' : CSS.escape(key)}"]`);

  // ---------- global keyboard ----------
  const isField = el => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  const isButtonish = el => el && (el.tagName === 'BUTTON' || el.tagName === 'SUMMARY' || /^(button|radio|tab|checkbox|link)$/.test(el.getAttribute?.('role') || '') || el.tagName === 'A');
  win.addEventListener('keydown', e => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const k = KEY_TO.get(key);
    if (dlg.open) {                                  // the help keyboard lights up; actions wait until it closes
      const c = capEl(key); if (c) { c.classList.add('lit'); e.key === ' ' && e.target === dlg && e.preventDefault(); }
      if (k?.act === 'help') { e.preventDefault(); dlg.close(); }
      return;
    }
    if (!k) return;
    if (!keysOn && !k.always) return;
    if (e.shiftKey && key !== '?' && k.act !== 'faster' && k.act !== 'slower') { /* Shift+letter still maps (caps) */ }
    const tgt = e.target;
    if (isField(tgt)) {
      if (tgt.type === 'range' && /^Arrow|^ $/.test(key)) return;       // the focused slider owns its arrows
      if (tgt.type !== 'range' && tgt.type !== 'checkbox') return;       // typing
    }
    if (key === ' ' && isButtonish(tgt)) return;                          // Space activates the focused button only
    if (/^Arrow/.test(key) && tgt?.closest?.('[role="radiogroup"],[role="tablist"]')) return;
    if (k.once && e.repeat) { e.preventDefault(); return; }
    e.preventDefault();
    dismissHint();
    const a = k.act;
    ACT[a]();
    const target = { pause: B.play, camera: camBtns.find(b => b.dataset.cam === S.cam), slower: null, faster: null }[a] ?? B[a];
    if (target) { if (a === 'bell') flash(target, 'ring', 760); else if (a === 'feed') flash(target, 'gulp', 520); if (a !== 'hop') flash(target); }
    queueMicrotask(() => sync());
  });
  win.addEventListener('keyup', e => { if (!dlg.open) return; const key = e.key.length === 1 ? e.key.toLowerCase() : e.key; const c = capEl(key); if (c) setTimeout(() => c.classList.remove('lit'), 90); });

  // anything that reaches the bus from elsewhere (clicking the pelican → ui:gulp) also answers on the card
  bus.on('ui:gulp', () => { if (!B.feed.classList.contains('gulp')) flash(B.feed, 'gulp', 520); dismissHint(); });

  // ---------- docking: keep clear of the rider's live screen box ----------
  let dockSide = 'left', dockT = 0;
  function measure() {
    // notch the plate at the perforation
    const y = perf.offsetParent ? perf.getBoundingClientRect().top - plate.getBoundingClientRect().top + plate.scrollTop : -40;
    plate.style.setProperty('--ui-notch', `${Math.round(y)}px`);
    card.querySelector('.ui-shadow').style.setProperty('--ui-notch', `${Math.round(y)}px`);
  }
  // bottom docks (and the phone sheet) open upward: the body goes between the odometer and the quick row, so the
  // quick row and the toggle never move under the cursor; top docks open downward below the quick row.
  const sheetMQ = win.matchMedia('(max-width: 600px), (max-aspect-ratio: 4/5)');
  function placeBody() {
    const up = sheetMQ.matches || !/top/.test(dockSide);
    card.dataset.up = up;          // CSS flex order: DOM (= Tab) order stays head → odo → quick → body
    measure();
  }
  function dock(force) {
    const r = rider();
    if (!r) return;
    const R = r.getBoundingClientRect();
    const W = win.innerWidth, H = win.innerHeight;
    if (sheetMQ.matches) {   // bottom sheet: give the open sheet only the room under the bike
      const room = Math.max(0, H - Math.min(H, R.bottom + 6));
      setIf('room', Math.round(room / 8), () => host.style.setProperty('--ui-room', `${Math.round(room)}px`));
      // tell the runtime how much of the bottom the sheet occupies (contract request: portrait camera lifts the rider)
      setIf('inset', Math.round(card.offsetHeight + 8), v => bus.emit('ui:inset', { bottom: v, open: card.dataset.open === 'true' }));
      return;
    }
    // levels: 0 full ticket · 1 compact (no header band, one-line odometer) · 2 mini (quick row only)
    const inset = W < 900 || H < 560 ? 12 : 28;
    const overlap = b => Math.max(0, Math.min(b[2], R.right) - Math.max(b[0], R.left)) * Math.max(0, Math.min(b[3], R.bottom) - Math.max(b[1], R.top));
    const order = [dockSide, 'left', 'right', 'right-top', 'left-top'];
    const prevLevel = card.dataset.level;
    let pick = null;
    for (let lv = H < 560 ? 1 : 0; lv <= 2 && !(pick && pick.o === 0); lv++) {
      card.dataset.level = lv;
      const cw = card.offsetWidth, ch = card.offsetHeight;
      const boxes = {
        left: [inset, H - inset - ch, inset + cw, H - inset], right: [W - inset - cw, H - inset - ch, W - inset, H - inset],
        'right-top': [W - inset - cw, inset, W - inset, inset + ch], 'left-top': [inset, inset, inset + cw, inset + ch],
      };
      for (const sd of order) { const o = overlap(boxes[sd]); if (!pick || o < pick.o) pick = { sd, lv, o }; if (o === 0) break; }
    }
    card.dataset.level = pick.lv;
    host.style.setProperty('--ui-inset', inset + 'px');
    if (String(pick.lv) !== prevLevel) measure();
    if (pick.sd !== dockSide) { dockSide = pick.sd; card.dataset.dock = pick.sd; placeBody(); }
  }
  win.addEventListener('resize', () => { measure(); dock(true); });

  // ---------- idle hint (once per browser, bilingual, pointer-adapted) ----------
  let hintTimer = 0, hintShown = false;
  function placeHint() {
    const r = rider(); if (!r) return;
    const R = r.getBoundingClientRect();
    const x = Math.min(win.innerWidth - 250, Math.max(16, R.left + R.width * 0.66));
    const y = Math.max(16, R.top - 64);
    hint.style.left = `${Math.round(x)}px`; hint.style.top = `${Math.round(y)}px`;
  }
  function dismissHint() {
    clearTimeout(hintTimer);
    if (hintShown) { hint.classList.remove('on'); store.set('hinted', '1'); }
    hintShown = false;
  }
  if (!shooting && store.get('hinted') !== '1') {
    hintTimer = setTimeout(() => {
      placeHint(); hint.classList.add('on'); hintShown = true;
      hintTimer = setTimeout(dismissHint, 7000);
    }, 4200);
    const first = () => { dismissHint(); win.removeEventListener('pointerdown', first, true); win.removeEventListener('keydown', first, true); };
    win.addEventListener('pointerdown', first, true); win.addEventListener('keydown', first, true);
  }

  // ---------- reduced motion ----------
  const rmq = win.matchMedia('(prefers-reduced-motion: reduce)');
  const reducedNote = $('[data-reduced-note]');
  const applyReduced = on => { host.dataset.reduced = on; reducedNote.hidden = !on; };
  applyReduced(!!init.reduced);
  rmq.addEventListener?.('change', ev => {
    applyReduced(ev.matches);
    if (ev.matches && !shooting) { toast.innerHTML = bi('reducedToast'); toast.classList.add('on'); setTimeout(() => toast.classList.remove('on'), 2600); }
    announce(ev.matches ? 'reducedToast' : 'aPlaying');
    measure();
  });

  // ---------- first paint ----------
  applyLang();
  const openQ = params.get('ui');
  setOpen(openQ === 'open' ? true : openQ === 'closed' ? false : store.get('open') === '1', true);
  sync(true);
  hud({ distance: S.distance, cadence: S.cadence, coasting: S.coasting });
  placeBody();
  requestAnimationFrame(() => { measure(); dock(true); });

  // ---------- easter-egg counter (feature of src/fx/eggs.js): a small HUD chip, hidden until the first find ----------
  {
    // (its stylesheet lives in styles.js with the rest of the HUD)
    const box = doc.createElement('div');
    box.className = 'ui-eggs'; box.hidden = true;
    box.innerHTML = '<div class="ui-eggs-stub" role="status" aria-live="polite"><i aria-hidden="true"></i><span data-egg-lab></span><b data-egg-n></b></div><div class="ui-eggs-toast" aria-hidden="true"></div>';
    host.appendChild(box);
    const stub = box.firstChild, lab = box.querySelector('[data-egg-lab]'), num = box.querySelector('[data-egg-n]'), eToast = box.lastChild;
    let eTimer = 0;
    bus.on('egg:found', ({ id, zh, en, count, total }) => {
      box.hidden = false;
      lab.textContent = lang === 'en' ? 'EGGS' : lang === 'zh' ? '彩蛋' : '彩蛋 EGGS';
      num.textContent = `${count}/${total}`;
      if (!id) return;
      stub.classList.remove('pop'); void stub.offsetWidth; stub.classList.add('pop');
      eToast.textContent = lang === 'en' ? `Egg found: ${en}` : lang === 'zh' ? `发现彩蛋：${zh}` : `发现彩蛋：${zh} · ${en}`;
      eToast.classList.add('on'); clearTimeout(eTimer); eTimer = setTimeout(() => eToast.classList.remove('on'), 3200);
      announce('aEgg', { x: { zh, en } });
    });
  }

  // ---------- per-frame hook: all DOM work throttled to ≤10 Hz ----------
  let acc = 1, dockDue = false;
  const early = () => { if (dockDue) { dockDue = false; dock(false); } win.requestAnimationFrame(early); };
  win.requestAnimationFrame(early);
  return {
    update(frame) {
      acc += frame.dt || 0;
      if (frame.dt !== 0 && acc < 0.1) return;
      acc = 0;
      setIf('still', shooting || frame.dt === 0, v => host.toggleAttribute('data-still', v));   // deterministic renders: no mid-roll digits
      sync();
      hud(frame);
      dockT += 1;
      // deterministic renders dock at once; live, the rider box is read at the start of the next frame (early rAF,
      // clean layout) instead of forcing a synchronous style + layout of this frame's scene writes
      if (frame.dt === 0) dock(true); else if (dockT % 3 === 0) dockDue = true;
    },
    setOpen, openHelp, KEYMAP, STRINGS,
  };
}
