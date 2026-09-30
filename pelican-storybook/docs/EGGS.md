# Pelican Bay · easter eggs (彩蛋) — SPOILERS

Sixteen small surprises, painted as picture-book moments in the warm storybook gouache of this edition (STYLE-B).
Every piece is hand-drawn in geometry: seeded wobbly brown-ink outlines with a second "pencil" pass, gouache blotch
and paper-fibre `<pattern>` fills in the object's own coordinates, washi tape, deckled paper slips, scalloped speech
bubbles and hand-lettered glyph-outline text (DejaVu Serif Bold + WenQuanYi Zen Hei, per-glyph baseline wander).
No filters: eggs move, so nothing in them is filtered (STYLE-B §2).

The counter in the top-right corner ("彩蛋 EGGS x/16") stays hidden until you find the first one (or after a minute
of riding, as a clue). Finds are remembered in this browser (`localStorage`, key `pb-eggs`).

| # | id | 中文 | English | How to find it | What happens |
|---|----|------|---------|----------------|--------------|
| 1 | `brown` | 褐鹈鹕 | Brown pelican | Konami code ↑↑↓↓←→←→BA | The rider becomes Simon Willison's stricter benchmark: a California brown pelican in breeding plumage (grey-brown body, chestnut hindneck, white head with a yellow crown, dark pouch with a red base, dark feet). A taped note says so. The code again turns it back. Done as a paint override on the rider's slots, so it follows every time of day. |
| 2 | `velo` | 维洛西佩迪亚 | Velocipedia | Type `GIMINI` | A Gianluca Gimini "Velocipedia" chain is bolted to the front hub. The drivetrain jams (the cranks lock while the bike rolls on), the chain rattles, "?!", then SNAP! 啪！ the links fly off and pedalling resumes. A taped note (with a doodle of a wrong bike) credits Gimini's bikes drawn from memory. |
| 3 | `cat` | 偷鱼猫 | The fish thief | Ring the bell while the ginger tabby's bench is on screen (about every 20 s at cruise) | The cat leaps onto the fish basket, MEOW! 喵！, and escapes down the road with a fish. |
| 4 | `km` | 一公里 | First kilometre | Ride 1 km on the odometer (then every whole km) | A little picture-book plate: bunting, a Chinese road kilometre stone with its red cap, a tiny inked cyclist, "N km!", in a flutter of petals and paper stars. |
| 5 | `fortytwo` | 四十二 | Forty-two | Ride 4.2 km | "42! 别慌 · Don't panic", with a surprised whale and a bowl of petunias falling through the night ("Oh no, not again.") and "So long, and thanks for all the fish". |
| 6 | `sunwink` | 太阳眨眼 | Winking sun | Click the sun | The sun gets rosy cheeks, smiles and winks, with a sparkle. |
| 7 | `moonwink` | 月亮眨眼 | Winking moon | Click the moon at night | The moon winks back. During `bedtime` it wears a nightcap too (combo). |
| 8 | `ufo` | 夜空来客 | Close encounter | Feed the pelican (F / tap) at night | Once the GULP! is over, a cream saucer with a little green pilot arrives, a lamplight beam lifts a second fish out of the basket, BLEEP? 哔哔？, and it zips away. |
| 9 | `chorus` | 海鸥合唱 | Gull chorus | Ring the bell 7 times within 3.5 s | Five gulls fly in and sing KAW! / 嘎！ in turn, with painted music notes. |
| 10 | `splash` | 水花 | Splash | Land a hop (H / ↑) in one of the road puddles (they reflect the sky and have a floating leaf) | Water crowns at both tyres, flying drops, SPLASH! 哗啦！ |
| 11 | `bottle` | 漂流瓶 | Message in a bottle | Click the green bottle bobbing in the bay (it glints every 22 s) | A taped letter on ruled paper unfolds: "你好，海边的朋友！来鹈鹕湾，一起骑车吧！ Hello, friend by the sea! Come ride with us at Pelican Bay. — P.", with a pelican doodle and a fish stamp. |
| 12 | `wish` | 流星许愿 | Wish upon a star | Click a shooting star while it is still glowing (night) | A smiling star in a lamp-glow: 许个愿 · Make a wish! |
| 13 | `flight` | 鹈鹕雁阵 | Pelican squadron | Type `BIRD` | A V of great white pelicans flies over the bay. |
| 14 | `pageturn` | 翻页 | Turn the page | Click (or tap) the dog-eared page corner at the bottom right of the book. It lifts every 12 s, which is the visible clue. | The page turns: a paper curl sweeps across the spread (the back of the page, with the story on its other side showing through, a rounded fold and a cast shadow), and the new page's light comes in behind it: the time of day moves on to the next picture (dawn → noon → golden hour → sunset → dusk → night → dawn). |
| 15 | `theend` | 全剧终？ | The End? | Ride a whole marathon: 42.195 km on the odometer | The page irises shut on the rider like the last page of a picture book: "The End · 全剧终", "马拉松 · 42.195 km · a whole marathon!" Then a "?" pops up, "…or is it? 未完待续", and the page opens again. |
| 16 | `bedtime` | 晚安 | Bedtime | At night, coast (no pedalling) for 30 s | The pelican yawns ("哈欠… Yaaawn…"), a red-and-cream striped nightcap with a pompom drops onto its head with a squashy bounce, and Z z z float up slowly. Pedal again and the cap flies off. If you click the moon now, it wears a nightcap too. |

The typed words and the Konami code never block the ride shortcuts. Any side effect of the keys on the way (the `A`
in the Konami code toggles the auto day cycle, the `M` in GIMINI toggles sound) is undone when the code completes.
The page-corner click is ignored when it lands on a UI control.

## For developers and tests
- Code: `src/fx/eggs.js` (art, X-sheets, detectors), glyph outlines `src/fx/egg-glyphs.js` (generated by
  `src/fx/egg-glyphs.gen.mjs` from DejaVu Serif Bold and WenQuanYi Zen Hei with `tools/ttf.mjs`), counter in `src/ui/ui.js`.
- Paints: the eggs export their own gouache `materials` (`egg*`, graded by the hour), plus the core paints and `line`.
- Every egg is a start time plus a pure function of sim time, distance and pose, so `window.__pb.renderAt(t)` is exact.
  The only live side effects are the Velocipedia coast (2.3 s) and the page turn's time-of-day ramp (1.3 s, live play
  only).
- Idle eggs are `display:none` groups (no style, layout or paint cost). The chorus gulls and the squadron pelicans are
  `<use>`s of shared symbols. The page-turn curl rewrites four small polygons and one gradient per frame for 1.3 s.
- Clicks on the sun, moon, stars and bottle are hit-tested in each layer's own coordinates through an egg element's
  parent. The sun and moon are composited strips whose sheet carries a CSS translate, so their own CTM can't be used.
- `window.__pb.eggs` = `{ list, trigger(id), found(), stopAll(), reset(), setBrown(on) }`. The UI listens to the bus
  event `egg:found { id, zh, en, count, total }`.
- `node tools/check-eggs.mjs --sheet` triggers each egg, shoots it into `shots/eggs/egg-*.png` (plus `eggs-sheet.png`),
  then drives the live detectors: keys, clicks on the sun / moon / bottle / page corner, bell spam, a gulp at night and
  30 s of coasting at night. It checks there are no leftover side effects and no console errors.
