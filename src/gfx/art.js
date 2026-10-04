// Artwork loaded from assets/: where each picture sits in its file (measured from the art), how big it is
// drawn, and where it is anchored. Preload loads the full-size files; fitArt() then resamples each one once to
// the size it is drawn at, under the same texture key. The game renders at 960x540 and WebGL1 has no mipmaps
// for textures this size, so drawing a 1500px picture at 50px would sparkle as the camera moves.
// Nothing here paints a picture: the only drawing is resampling, cropping and joining the supplied pieces.
import { makeCanvas } from './draw.js';

// Platform and ground-edge colours (a level picks one with its `palette` map property) and exit gates.
export const PALETTES = ['cyan', 'magenta', 'orange', 'green', 'red'];
export const GATES = ['cyan', 'magenta', 'orange', 'green', 'red-blue'];
export const GATE_H = 340;   // exit gate height in world px (the whole image; Game.js places the frame)

// Compact modular platform pieces (assets/platform/<palette>/). One scale for every piece keeps the deck
// thickness the same: the ~230px solid deck is drawn 26px thick, matching the collider (FLOAT_H).
export const DECK = {
  scale: 26 / 230,
  land: 62,                     // source row of the walking surface: the top edge of the deck rail
  h: 310, capW: 400, midW: 972,
  capIn: 23,                    // the caps' opaque edge starts 23px in from their outer side
  thrusterW: 400, thrusterH: 305, thrusterX: 200,   // pod centre column
  thrusterTop: 23,              // world px below the walking surface: tucked 2px under the deck's underside
};
export const FLOAT_H = 26;      // collider thickness of ledges and lifts (unchanged)
// Platform textures are drawn at 1 texture px = 1 world px so the physics offsets below stay exact.
export const PLAT_PAD_X = 4, PLAT_PAD_TOP = 8;   // room for the caps' padding and the glow above the rail

// Ground and rooftop edge strip (assets/world/ground-rooftop/<palette>/ground-edge.webp). The whole 2172px
// strip tiles seamlessly as supplied (checked at game scale). Per palette: the walking-surface row (the rail's
// first opaque row), and the rows where its glow starts and its metal ends.
export const EDGE = {
  w: 2172,
  rows: { cyan: [289, 283, 554], magenta: [306, 285, 554], orange: [310, 280, 554], green: [277, 271, 528], red: [307, 288, 550] },
  ground: 30,   // world px from the walking surface to the bottom of the strip on plain ground
  roof: 20,     // thinner on tower roofs, so it covers the roof edge and first ledge but no windows
};

// Single pictures: crop (source px, the art's opaque bounds plus a little glow), drawn scale (world px per
// source px) and the anchor point in source px. Keys are the ones the game already used for these props.
// Both checkpoint states share a scale and a base line so activating one doesn't jump; the active pylon is
// a little taller in the art.
const BEACON = 128 / 1534;
export const PROPS = {
  'beacon-off': { file: 'checkpoint-inactive', crop: [144, 88, 600, 1542], scale: BEACON, anchor: [444, 1630] },
  'beacon-on': { file: 'checkpoint-active', crop: [142, 77, 604, 1609], scale: BEACON, anchor: [444, 1686] },
  'tank': { file: 'jet-fuel', crop: [182, 101, 701, 1343], scale: 56 / 1335, anchor: [532, 1444] },
  'egg': { file: 'egg-shell', crop: [1, 26, 1022, 1459], scale: 58 / 1451, anchor: [512, 1485] },
  // the core fills about 90% of the shell's opening (348x722 source px, centred 30 world px above the base)
  'egg-core': { file: 'egg-core', crop: [169, 104, 654, 1374], scale: 26 / 1301, anchor: [496, 790] },
  'repair': { file: 'repair-module', crop: [142, 186, 971, 881], scale: 42 / 955, anchor: [627, 626] },
};
export const EGG_CORE_Y = -30;   // core centre above the egg's base (world px): the middle of the shell's opening

// origin for an image drawn with a PROPS texture, so (x, y) lands on the prop's anchor point
export function propOrigin(key) {
  const p = PROPS[key];
  return [(p.anchor[0] - p.crop[0]) / p.crop[2], (p.anchor[1] - p.crop[1]) / p.crop[3]];
}

// Resample a source picture (or a crop of it) to w x h. Halves in steps first, then one final high-quality
// scale, which keeps fine detail clean when shrinking by 10-30x.
function resample(img, [sx, sy, sw, sh], w, h) {
  let src = img, cx = sx, cy = sy, cw = sw, ch = sh;
  while (cw / 2 >= w * 1.5 && ch / 2 >= h * 1.5) {
    const [cv, ctx] = makeCanvas(cw / 2, ch / 2);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, cx, cy, cw, ch, 0, 0, cv.width, cv.height);
    src = cv; cx = 0; cy = 0; cw = cv.width; ch = cv.height;
  }
  const [cv, ctx] = makeCanvas(w, h);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, cx, cy, cw, ch, 0, 0, cv.width, cv.height);
  return cv;
}

// replace texture `key` with `canvas` (or add it under a new key)
function put(scene, key, canvas) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}
const source = (scene, key) => scene.textures.get(key).getSourceImage();

// Platform pieces are kept at twice their drawn size; deckTexture() joins them per platform width.
const PIECE_RES = 2 * DECK.scale;

export function fitArt(scene) {
  for (const [key, p] of Object.entries(PROPS)) {
    put(scene, key, resample(source(scene, key), p.crop, Math.round(p.crop[2] * p.scale), Math.round(p.crop[3] * p.scale)));
  }
  for (const g of GATES) {
    const img = source(scene, 'gate-' + g);
    put(scene, 'gate-' + g, resample(img, [0, 0, img.width, img.height], Math.round(img.width * GATE_H / img.height), GATE_H));
  }
  for (const p of PALETTES) {
    for (const part of ['left', 'middle', 'right', 'thruster']) {
      const key = `plat-${p}-${part}`, img = source(scene, key);
      put(scene, key, resample(img, [0, 0, img.width, img.height], Math.round(img.width * PIECE_RES), Math.round(img.height * PIECE_RES)));
    }
    // ground edge: one texture for plain ground and a thinner one for tower roofs, both cut from the glow's
    // top to the strip's bottom so the walking surface sits at a known row
    const [land, top, bottom] = EDGE.rows[p], img = source(scene, `edge-${p}`);
    for (const kind of ['ground', 'roof']) {
      const k = EDGE[kind] / (bottom - land);
      put(scene, `edge-${p}-${kind}`, resample(img, [0, top, EDGE.w, bottom - top], Math.round(EDGE.w * k), Math.round((bottom - top) * k)));
    }
    scene.textures.remove(`edge-${p}`);
  }
}

// where the walking surface sits in an edge texture (texture px from its top), and its tile width
export function edgeMetrics(scene, palette, kind) {
  const [land, top, bottom] = EDGE.rows[palette], k = EDGE[kind] / (bottom - land);
  return { land: (land - top) * k, tileW: scene.textures.get(`edge-${palette}-${kind}`).getSourceImage().width };
}

// Texture for one ledge or lift w world px wide: left cap, complete middles, a split partial middle in the
// centre, right cap; lifts also get a thruster pod under each end. The collider's top-left corner sits at
// (PLAT_PAD_X, PLAT_PAD_TOP) in the texture.
export function deckTexture(scene, w, palette, mover = false) {
  w = Math.round(w);
  const key = `deck-${palette}-${w}${mover ? '-lift' : ''}`;
  if (scene.textures.exists(key)) return key;
  const k = DECK.scale, r = PIECE_RES;
  const piece = part => source(scene, `plat-${palette}-${part}`);
  const thrusterH = DECK.thrusterTop + DECK.thrusterH * k;
  const [cv, ctx] = makeCanvas(w + PLAT_PAD_X * 2, PLAT_PAD_TOP + (mover ? thrusterH : (DECK.h - DECK.land) * k) + 1);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const x0 = PLAT_PAD_X, x1 = PLAT_PAD_X + w, y = PLAT_PAD_TOP - DECK.land * k, h = DECK.h * k;
  // draw source columns [a, b) of a piece into world columns [dx0, dx1)
  const cols = (img, a, b, dx0, dx1) => ctx.drawImage(img, a * r, 0, (b - a) * r, img.height, dx0, y, dx1 - dx0, h);

  if (mover) {   // pods first, so the deck covers their mounting plates; smaller on very short lifts
    const pk = Math.min(k, (w / 2 - 4) / DECK.thrusterW), pw = DECK.thrusterW * pk, ph = DECK.thrusterH * pk;
    const img = piece('thruster'), py = PLAT_PAD_TOP + DECK.thrusterTop;
    for (const side of [-1, 1]) {
      const cx = side < 0 ? x0 + pw / 2 + 2 : x1 - pw / 2 - 2;
      ctx.save(); ctx.translate(cx, py); ctx.scale(side, 1);   // mirror the right pod
      ctx.drawImage(img, 0, 0, img.width, img.height, -DECK.thrusterX * pk, 0, pw, ph);
      ctx.restore();
    }
  }
  // caps: their opaque outer edges line up with the collider's ends, and their joins land on whole pixels.
  // (Below ~86px there isn't room for two whole caps; their inner ends are cropped. No level has one.)
  const capVis = Math.min(Math.round((DECK.capW - DECK.capIn) * k), Math.floor(w / 2)), inner = DECK.capIn + capVis / k;
  cols(piece('left'), 0, Math.min(DECK.capW, inner), x0 - DECK.capIn * k, x0 + capVis);
  cols(piece('right'), Math.max(0, DECK.capW - inner), DECK.capW, x1 - capVis, x1 + DECK.capIn * k);
  // middle: complete repeats either side of a split partial piece
  const mid = piece('middle'), midPx = Math.round(DECK.midW * k), span = w - capVis * 2;
  const n = Math.floor(span / midPx), rest = span - n * midPx, left = Math.floor(n / 2);
  let x = x0 + capVis;
  const full = () => { cols(mid, 0, DECK.midW, x, x + midPx); x += midPx; };
  for (let i = 0; i < left; i++) full();
  if (rest > 0) {   // half the width from each end of the middle, joined at the centre: both cap joins survive
    const a = Math.floor(rest / 2), b = rest - a, s = DECK.midW / midPx;
    if (a > 0) cols(mid, 0, a * s, x, x + a);
    cols(mid, DECK.midW - b * s, DECK.midW, x + a, x + rest);
    x += rest;
  }
  for (let i = left; i < n; i++) full();
  put(scene, key, cv);
  return key;
}
