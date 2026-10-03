# Kin Runner

A 2D side-scrolling platformer built from the Kin robot sprite sheet and the neon city backdrop.
Pure HTML5 canvas and vanilla JavaScript, no build step and no dependencies.

## Play

Run the bundled server:

```bash
./serve.sh
```

Then open http://localhost:8765. Any other static file server works too.

## Controls

| Action | Keys |
|---|---|
| Move | ← → or A D |
| Jump (hold for height) | Space, W, or ↑ |
| Duck | ↓ or S |
| Shoot | V, B, or N |
| Start | Space, Enter, or tap |
| Retry | Space, Enter, or a shoot key |
| Toggle music | M |
| Fullscreen | F |

On touch devices, on-screen buttons appear automatically.

## Gameplay

- Endless procedurally generated level: ground runs, pits, stepping platforms, and towers.
- Two drone types: fast ground skimmers and high hover drones that fire lasers when you are level with them. Shoot or stomp either for 100 points. Your energy shots also knock enemy lasers out of the air. Duck under lasers.
- Cyan data chips are worth 10 points each.
- Fuel tanks and egg pods grant a jet booster (+50). Hold jump in the air to fly. You keep it until an enemy hits you or you fall.
- Three hit points. Falling into a pit costs one and respawns you on the last safe ground.
- Best score is saved in the browser.
- HUD: player portrait with three hex life cores, chip counter, distance panel with a bar to the next 500 m milestone (+250 bonus), rolling score counter with best and drone kills, jet status pill, floating score popups, and a red low-health vignette.
- Synthesised sound effects for jumping (robot chirps), shooting, coins (pitch climbs on quick pickups), stomps, enemy approach warnings, laser charge, and explosions. All generated in code.
- Original procedural soundtrack, "Neon Grid": a chiptune-synthwave loop with driving octave bass, echoing arpeggios, detuned pads, and a square-wave lead. Press M to mute.

## Files

- `index.html` – the whole game (engine, level generator, rendering, synth sound effects).
- `assets/robot.webp` – player sprite sheet (idle 4, run 6, jump 6, attack 6 frames). Frame rectangles were auto-detected from the alpha channel and are inlined in `index.html`.
- `assets/city.webp` – parallax background, tiled horizontally in two layers.
- `assets/drone.webp` – enemy sprite sheet (hover 4, dash 6, laser 4, death 4 frames).
- `assets/robot_shoot.webp` – player energy-shot sheet (charge 7, fire 4, projectile 3 frames).
- `assets/title.jpg` – title screen poster.
- `assets/kinotic-logo.svg` – Kinotic logo shown in the "Powered by" credit on the title screen.

## Standalone file

`dist/kin-runner.html` is the whole game in one file with every asset embedded, so it can be opened directly from disk or emailed. Rebuild it after any change with:

```bash
python3 build-standalone.py
```
