# Ground and rooftop colors

Copy this folder into assets/world-assets/ground-rooftop-colors/.
Each color folder contains rooftop-strip.webp (2172x724, lossless WebP with alpha). Use the same strip for solid-ground fascia and rooftop edges, keeping a common scale and aligning the top landing line rather than the canvas edge. Transparent vertical padding is included. No end caps are present. Horizontal seamless repetition was requested but exact edge continuity remains unverified; check joins at actual game scale before using. The existing modular platform middles are an alternative where exact repeat-boundary matching is required.

Levels: Neon District cyan; Rooftop Run magenta; The Spire orange; Drone Foundry green; Core Breach red.

Audit of current src/gfx/textures.js and src/scenes/Game.js: platforms, ground tops, wall trim and pit beams use the level color. Platform pieces and gates already have their color sets. Ground/rooftop artwork was the missing set. Wall trim and pit beams can retain their procedural, dynamically colored rendering. Jet fuel, jetpack, egg core and repair pickups use fixed cyan; egg shell uses fixed red seams; checkpoints use fixed red inactive/cyan active. These do not require five level variants.

Generated using the built-in image tool, one edit per missing palette. Prompt: Change only cyan illumination, glow and reflections to hot pink #ff4fd8, amber #ffb03c, mint green #3dff9e or crimson #ff2d55. Preserve neutral charcoal metal, near-white light cores, vents, panel geometry, straight top landing line, transparency and aspect ratio. Full-width repeating strip, no end caps, no scenery or text, exact horizontal continuity requested.

No game code changed. Alpha and lossless WebP export verified.
