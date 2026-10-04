# Kin Runner

A Phaser 4 + Vite side-scrolling platformer with five hand-built levels. See README.md for controls, level editing and project layout.

## Commands

- `npm run dev`: dev server at http://localhost:8765
- `npm run check-levels`: simulates Kin's jumps and fails if any level can't be finished. Run it after touching level files or physics constants.
- `npm run build`: multi-file site in `dist/web` (what GitHub Pages deploys from `main`)
- `npm run build:standalone`: single-file `dist/kin-runner.html`. Rebuild and commit it whenever the game changes.

## Art belongs in asset files, not drawing code

If something is a picture, it should be an image file in `assets/` that the game loads, not canvas or Graphics code that paints it at runtime. This covers backgrounds, wall and building textures, props, pickups, enemies, icons, decorative UI art and title art. As separate files, each piece can be refined, regenerated or replaced on its own (painted, AI-generated or drawn) without touching game code, and swapped one at a time.

When adding or changing art:

- Make it an asset. Load it in `src/scenes/Preload.js` under a stable key, and keep the file path stable so a better version can be dropped in later.
- Author it so the game can adapt it rather than baking variants. For example, draw it in neutral greys or white so `setTint()` can apply each level's colour, make textures seamless so `TileSprite` can repeat them, and keep sprite frames on clean, non-overlapping rectangles with transparent margins.
- If you can't produce final art (no image generator available), still create a real asset file: a placeholder or a procedurally rendered texture saved to `assets/`. Say plainly that it's a stand-in. If you used a generator page or script to make it, put it in `tools/art/`, but the game must load the file, never run the generator.
- Don't add new drawing code for things that are pictures. If you touch existing hand-drawn art (see below), prefer moving it to an asset.

Code-drawn visuals are still right for things that are genuinely procedural or data-driven:

- HUD values, bars and counters
- particles, glow, light shafts and screen flashes
- neon edge lines whose length or colour comes from level data
- debug overlays

Existing hand-drawn art that would be better as assets, to convert when it's next worked on: platform tops and ledges, the jet tank, the egg pod, the repair kit, the exit gate, the checkpoint beacon and the data chip (all in `src/gfx/textures.js`).

Sound effects and music are synthesised in code on purpose (`src/audio/`). Ask before replacing them with audio files.

## Levels

Levels are Tiled maps (`src/levels/level*.json`, object layers only). Edit them in Tiled or by hand, then run `npm run check-levels`.
