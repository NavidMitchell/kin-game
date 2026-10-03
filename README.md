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
| Punch | V, B, or N |
| Start / retry | Space or Enter |

On touch devices, on-screen buttons appear automatically.

## Gameplay

- Endless procedurally generated level: ground runs, pits, stepping platforms, and towers.
- Two enemy types: ground crawlers and hovering drones. Punch them or stomp them for 100 points.
- Cyan data chips are worth 10 points each.
- Fuel tanks and egg pods grant a jet booster (+50). Hold jump in the air to fly. You keep it until an enemy hits you or you fall.
- Three hit points. Falling into a pit costs one and respawns you on the last safe ground.
- Best score is saved in the browser.

## Files

- `index.html` – the whole game (engine, level generator, rendering, synth sound effects).
- `assets/robot.png` – player sprite sheet (idle 4, run 6, jump 6, attack 6 frames). Frame rectangles were auto-detected from the alpha channel and are inlined in `index.html`.
- `assets/city.png` – parallax background, tiled horizontally in two layers.
