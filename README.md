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

On touch devices, on-screen buttons appear automatically.

## Gameplay

- Endless procedurally generated level: ground runs, pits, stepping platforms, and towers.
- Two drone types: fast ground skimmers and high hover drones that fire lasers when you are level with them. Shoot or stomp either for 100 points. Your energy shots also knock enemy lasers out of the air. Duck under lasers.
- Cyan data chips are worth 10 points each.
- Fuel tanks and egg pods grant a jet booster (+50). Hold jump in the air to fly. You keep it until an enemy hits you or you fall.
- Three hit points. Falling into a pit costs one and respawns you on the last safe ground.
- Best score is saved in the browser.
- Synthesised sound effects for jumping (robot chirps), shooting, coins (pitch climbs on quick pickups), stomps, enemy approach warnings, laser charge, and explosions. All generated in code.
- Original procedural soundtrack, "Neon Grid": a chiptune-synthwave loop with driving octave bass, echoing arpeggios, detuned pads, and a square-wave lead. Press M to mute.

## Files

- `index.html` – the whole game (engine, level generator, rendering, synth sound effects).
- `assets/robot.png` – player sprite sheet (idle 4, run 6, jump 6, attack 6 frames). Frame rectangles were auto-detected from the alpha channel and are inlined in `index.html`.
- `assets/city.png` – parallax background, tiled horizontally in two layers.
- `assets/drone.png` – enemy sprite sheet (hover 4, dash 6, laser 4, death 4 frames).
- `assets/robot_shoot.png` – player energy-shot sheet (charge 7, fire 4, projectile 3 frames).
- `assets/title.jpg` – title screen poster.
- `assets/kinotic-logo.svg` – Kinotic logo shown in the "Powered by" credit on the title screen.
