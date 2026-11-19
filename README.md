# ☄️ Comet Courier · 혜성 택배

*Interplanetary parcel delivery. Gravity included, free of charge.*

You are a tiny comet with a mail bag. Slingshot your way past planets, dodge smug moons,
bounce off bumper stars, take shortcuts through wormholes, and please try not to become spaghetti.

**Play:** open `index.html` in any browser. It has no build step, no dependencies and no network calls, and it works offline.
If your browser blocks local files, run `python3 -m http.server` in this folder and go to <http://localhost:8000>.

## What's inside

| | |
|---|---|
| 📦 **32 deliveries** | 4 worlds: *The Backyard*, *Clockwork Lane* (everything moves), *Strange Places* (black holes and wormholes), *Deep Field* (everything at once, and the aim preview gets shy) |
| ⭐ **3 stars per level** | Deliver it · grab every stardust in one flight · finish within par |
| 📅 **Daily Route** | A new route every day from a date seed, so everyone gets the same one. A solver checks that it can be won before you see it. Keeps a streak. |
| 🪐 **Orrery Sandbox** | A real n-body toy. Throw planets, merge them into suns, feed black holes, spray comets. Auto-orbit puts things into tidy circles. |
| 🛠️ **Route editor** | Build your own level, test it, ask the solver whether it can be delivered, and share it as a link (`#route=…`). |
| 🏅 **20 badges** | *Kepler Would Approve*, *Al Dente*, *Close Shave*, *Night Owl*… |
| 🎵 **Generative music** | Every sound is synthesized live with WebAudio, with a different mood per world. There are no audio files. |
| 🌐 **English / 한국어** | Picks your browser language. Switch it any time. |

## Controls

- **Drag anywhere and let go.** The comet flies the opposite way, like a slingshot. Dots show the first part of the path.
- `← →` aim · `↑ ↓` power (hold `Shift` for fine steps) · `Space` launch · `R` retry · hold `F` or ⏩ to fast-forward
- Your last 3 flights stay on screen as ghost trails.
- Moving things freeze while you aim. The clock starts when you launch, so every shot is fully deterministic.

## How it's built

```
index.html          the shell
css/style.css       glassy UI, paper delivery notes
js/physics.js       fixed-step (240 Hz) gravity sim, collisions, wormholes, brute-force solver
js/levels.js        the 32 hand-built levels
js/play.js          aim / fly / deliver scene
js/sandbox.js       n-body orrery (also the title-screen background)
js/editor.js        route editor + link encoding
js/daily.js         seeded generator + solver check
js/render.js        canvas renderer: planets, suns, black holes with accretion disks, particles
js/audio.js         WebAudio synth: sound effects + generative ambient music
js/store.js         save data (localStorage) + badges
js/i18n.js          English / Korean strings
tools/check.js      level checker (node)
```

Same level + same launch gives the same flight every time. That makes it possible to check every level
offline:

```
node tools/check.js           # every level must be winnable, and winnable while collecting all stardust
node tools/check.js --write   # place stardust on real winning paths for levels marked autoDust
```

The checker fires 20,160 launches per level (720 angles × 28 power levels). For every level, at least one
of those launches delivers the parcel *and* collects every stardust in the same flight. The stardust sits
on real winning paths, so no star is impossible.

---
Made in two hours by Claude, as a surprise.
