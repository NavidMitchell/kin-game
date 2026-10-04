# Cyberpunk world artwork

14 lossless WebP files with alpha transparency. Generated with the built-in image tool, matching the existing exit gate's dark painted metal and cyan lighting. No game code changed.

## Modular platforms

Use platform-left.webp + repeated platform-middle.webp + platform-right.webp. All three share a 310px canvas height and vertical alignment. Keep one common scale; crop the last middle repeat rather than stretching it. End caps are mirrored for matching connections. For widths shorter than both end caps combined, crop inward-facing portions of the caps. Physics should follow the flat top surface, excluding glow padding.

platform-thruster.webp is a separate under-deck pod for moving platforms. Place one near each end; it includes an attachment collar and cyan exhaust. Full platform-static.webp and platform-moving.webp are also included as reference/fixed-width artwork.

rooftop-strip.webp is intended for horizontal repetition; exact opposite-edge matching has not been numerically verified. It has transparent vertical padding. The modular platform deck can also serve as rooftop trim when exact repeat behavior is needed.

## Props

- checkpoint-inactive.webp: red checkpoint; checkpoint-active.webp: cyan checkpoint. These are separately illustrated states with different silhouettes; align by their bases.
- jet-fuel.webp: canister pickup. jetpack.webp: side-view backpack attachment; mirror when the player turns.
- egg-shell.webp and egg-core.webp: separate layers. Center and scale the core to fit the shell's opening; animate the core independently.
- repair-module.webp: repair pickup with a clear plus symbol.

Pickups use cyan as in the current game. Assets retain native generation resolutions and transparent padding. asset-manifest.json lists canvas dimensions. Choose display sizes in the coding session; do not infer collision sizes from the full image bounds.

WebP exports were decoded and compared pixel-for-pixel with their sources to confirm lossless export and alpha preservation. Rooftop repetition and prop placement still need an in-game visual check.
