# Kin Runner

A 2D side-scrolling platformer built from the Kin robot sprite sheet and the neon city backdrop.
Built with [Phaser 4](https://phaser.io) (Arcade Physics) and Vite. It has five hand-built levels, each with a start and an exit gate.

## Play

```bash
./serve.sh          # installs dependencies on first run, then serves http://localhost:8765
```

Or run `npm install` and then `npm run dev`.

## Controls

| Action | Keys |
|---|---|
| Move | ← → or A D |
| Jump (hold for height) | Space, W, or ↑ |
| Duck | ↓ or S |
| Shoot | Left Shift, V, B, or N |
| Pause | Esc or P |
| Menus | ← → to choose, Space or Enter to select |
| Toggle music | M |
| Fullscreen | F |

On touch devices, on-screen buttons appear automatically, including duck and pause.

## Story

The first time you start from the title screen, a six-slide opening story plays before level select. After that it's skipped; press S on level select to watch it again. Space, Enter or a click advances; Esc or SKIP jumps straight to level select. Slides advance on their own after a few seconds, except the last, which waits for Space. The slides are `assets/story/1.webp` to `6.webp`.

## Levels

| # | Level | What's new |
|---|---|---|
| 1 | Neon District | Tutorial with in-world hints: running, jumping, ducking, shooting, stomping, checkpoints |
| 2 | Rooftop Run | Rooftops at different heights, ledge hopping, a jet-only gap across the skyline |
| 3 | The Spire | Vertical level: zig-zag climb, a lift up and a conveyor across, then a sky bridge |
| 4 | Drone Foundry | Drone-heavy; pillars block lasers, timed lifts over a pit |
| 5 | Core Breach | The final gauntlet, mixing everything above |

- Clearing a level unlocks the next one. The level select screen shows each level's best score, saved in the browser.
- Each level ends at an exit gate. The clear screen adds bonuses to your score: time under par (+10 per second), all chips collected (+500) and no damage taken (+500).
- Three life cores per level. Falling into a pit costs one and respawns you on the last solid ground you stood on. Repair kits restore a core.
- Checkpoint beacons: if you run out of lives, Retry resumes at the last checkpoint you reached, with the score you had there.
- Two drone types: fast ground skimmers and hover drones that fire lasers when you are level with them. Shoot or stomp either for 100 points. Your shots also knock lasers out of the air. Duck under lasers, or hide behind pillars.
- Cyan data chips are worth 10 points each.
- Fuel tanks and egg pods give a jet booster (+50). Hold jump in the air to fly. You keep it until something hits you. Boosters respawn a few seconds after pickup, so a failed flight can always be retried.
- Each level has its own colour palette, music key and tempo.
- All sound effects and the "Neon Grid" soundtrack are synthesised in code with WebAudio.

## Editing levels

Levels are [Tiled](https://www.mapeditor.org) maps in `src/levels/level1.json` to `level5.json`. Open them in Tiled to edit. They use object layers only, no tilesets:

- **Platforms** layer, rectangles with a class:
  - `ground`: solid. You can stand on it and it blocks you from the sides.
  - `float`: a one-way ledge you can jump up through.
  - `mover`: a one-way ledge that travels. Properties: `dx`, `dy`, `period` (seconds), `phase` (0–1).
- **Entities** layer, points; `y` is the surface the object stands on:
  - `start`, `exit`, `checkpoint`
  - `drone` and `skimmer`, with property `range`
  - `chips`, with properties `count`, `spacing`, `arc`
  - `tank`, `egg`, `repair`
  - `hint`, with property `text`
- **Map properties**: `name`, `subtitle`, `color`, `bgHue`, `bgTint`, `wall` (optional tower art for solid ground: `red`, `magenta`, `orange` or `green`, from `assets/towers/`; leave it out for plain ground, as every level but The Spire does), `bpm`, `transpose`, `par`.

Gaps between pieces of `ground` that reach the bottom of the map become glowing pits automatically. After editing, run:

```bash
npm run check-levels
```

It simulates Kin's jumps, using the game's own physics numbers, between every surface. It reports whether the exit, the checkpoints and every chip can be reached from the start, and it fails if a level can't be finished.

## Project layout

```
index.html              page shell + touch buttons
src/main.js             Phaser game config
src/config.js           physics constants, sprite-sheet frame rectangles
src/controls.js         keyboard + touch input
src/save.js             unlocked levels and best scores (localStorage)
src/scenes/             Preload, Title, Story, Select, Game, HUD, Result (clear / game over / pause)
src/entities/           Player (Arcade body + visuals), Enemy (drones and skimmers)
src/gfx/                texture baking (neon props, glowing sprite atlases), particles, canvas drawing helpers
src/audio/              synthesised sound effects and music
src/levels/             Tiled maps + parser
tools/                  level checker, single-file build step
assets/                 sprite sheets, background, tower facades (towers/), story slides, title poster, logo
```

## Building

```bash
npm run build              # multi-file site in dist/web, ready for any static host
npm run build:standalone   # dist/kin-runner.html: the whole game in one file, every asset embedded
```

`dist/kin-runner.html` can be opened straight from disk or emailed. Rebuild it after making changes.

## GitHub Pages

`.github/workflows/pages.yml` runs on every push to `main` (or by hand from the Actions tab). It checks the levels, builds the site and publishes it to GitHub Pages at `https://<owner>.github.io/<repo>/`. The single-file version is published alongside it as `kin-runner.html`.

One-time setup: in the repository's **Settings → Pages**, set **Source** to **GitHub Actions**.
