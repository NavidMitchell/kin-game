// Bakes every texture the game uses. Sprite-sheet frames are pre-scaled to world size (with their glow
// baked in), and the neon props are drawn once with the same canvas code the original build drew per frame.
import { SFR, DFR, DFR_FADE, SH_SCALE, DR_SCALE, DASH_NOSE } from '../config.js';
import { makeCanvas, rr, rgba } from './draw.js';

// normalized origin for every baked frame: ANCHORS[textureKey][frameName] = [ox, oy]
const ANCHORS = {};

export function setAnchoredFrame(sprite, key, frame) {
  if (sprite.texture.key !== key) sprite.setTexture(key, frame); else if (sprite.frame.name !== frame) sprite.setFrame(frame);
  const a = ANCHORS[key][frame]; sprite.setOrigin(a[0], a[1]);
  return sprite;
}

// Packs frames from source images into one canvas texture, scaled and optionally glowing.
// entry: { name, img, rect:[x,y,w,h], scale, anchor:(dw,dh)=>[ax,ay] in scaled px from the frame's top-left }
function bakeAtlas(scene, key, entries, { pad = 2, glow = null, blur = 0 } = {}) {
  const maxW = 2048, items = entries.map(e => {
    const dw = Math.ceil(e.rect[2] * e.scale), dh = Math.ceil(e.rect[3] * e.scale);
    return { ...e, dw, dh, w: dw + pad * 2, h: dh + pad * 2 };
  });
  let x = 0, y = 0, rowH = 0;
  for (const it of items) {
    if (x + it.w > maxW) { x = 0; y += rowH; rowH = 0; }
    it.x = x; it.y = y; x += it.w; rowH = Math.max(rowH, it.h);
  }
  const [cv, ctx] = makeCanvas(maxW, y + rowH);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ANCHORS[key] = {};
  for (const it of items) {
    ctx.save();
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = blur; }
    ctx.drawImage(cleanFrame(it.img, it.rect, it.fade), it.x + pad, it.y + pad, it.dw, it.dh);
    ctx.restore();
    const [ax, ay] = it.anchor(it.dw, it.dh);
    ANCHORS[key][it.name] = [(ax + pad) / it.w, (ay + pad) / it.h];
  }
  const tex = scene.textures.addCanvas(key, cv);
  for (const it of items) tex.add(it.name, 0, it.x, it.y, it.w, it.h);
}

// The sheets' frames sit close together, so a rectangle can pick up a piece of its neighbour (a nose, a laser
// beam) at an edge. Copy the frame out, keep its largest shape and erase separate pieces touching an edge.
function cleanFrame(img, [sx, sy, sw, sh], fade) {
  const [cv, ctx] = makeCanvas(sw, sh);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  if (fade) {
    const [fx, fy, fw, fh] = fade, g = ctx.createLinearGradient(fx, 0, fx + fw, 0);
    g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = g; ctx.fillRect(fx, fy, fw, fh); ctx.restore();
  }
  dropEdgeFragments(ctx, sw, sh, 96);   // solid pieces of a neighbour
  dropEdgeFragments(ctx, sw, sh, 24);   // faint glow from a neighbour
  return cv;
}

function dropEdgeFragments(ctx, sw, sh, threshold) {
  const im = ctx.getImageData(0, 0, sw, sh), a = im.data, n = sw * sh;
  const label = new Int32Array(n), comps = [];
  for (let i = 0; i < n; i++) {
    if (label[i] || a[i * 4 + 3] <= threshold) continue;
    const id = comps.length + 1, stack = [i], pixels = [];
    let edge = false; label[i] = id;
    while (stack.length) {
      const j = stack.pop(), x = j % sw, y = (j - x) / sw;
      pixels.push(j);
      if (x === 0 || y === 0 || x === sw - 1 || y === sh - 1) edge = true;
      for (const k of [j - 1, j + 1, j - sw, j + sw]) {
        if (k < 0 || k >= n || label[k] || a[k * 4 + 3] <= threshold) continue;
        if ((k === j - 1 && x === 0) || (k === j + 1 && x === sw - 1)) continue;
        label[k] = id; stack.push(k);
      }
    }
    comps.push({ pixels, edge });
  }
  if (comps.length < 2) return;
  const main = comps.reduce((m, c) => (c.pixels.length > m.pixels.length ? c : m));
  let changed = false;
  for (const c of comps) if (c !== main && c.edge) { for (const j of c.pixels) a[j * 4 + 3] = 0; changed = true; }
  if (changed) ctx.putImageData(im, 0, 0);
}

export function bakeSprites(scene) {
  const shoot = scene.textures.get('shoot-src').getSourceImage();
  const drone = scene.textures.get('drone-src').getSourceImage();
  const drones = [], shootBodyX = DFR.shoot[0][2] * DR_SCALE / 2;
  for (const [anim, rects] of Object.entries(DFR)) rects.forEach((rect, i) => drones.push({
    name: anim + i, img: drone, rect, scale: DR_SCALE, fade: DFR_FADE[anim + i],
    anchor: anim === 'shoot' ? (dw, dh) => [shootBodyX, dh / 2]
      : anim === 'dash' ? (dw, dh) => [dw - DASH_NOSE * DR_SCALE, dh / 2]
      : (dw, dh) => [dw / 2, dh / 2],
  }));
  bakeAtlas(scene, 'drone', drones, { pad: 20, glow: '#ff2d55', blur: 16 });

  // energy orb sits at the leading edge, trail behind
  bakeAtlas(scene, 'orb', [{ name: 'proj0', img: shoot, rect: SFR.proj[0], scale: SH_SCALE, anchor: (dw, dh) => [dw - 30, dh / 2] }], { pad: 22, glow: '#ff5ac8', blur: 18 });
}

// Draws into a fresh canvas texture once. draw(ctx) runs with the origin translated by (ox, oy).
function bake(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return key;
  const [cv, ctx] = makeCanvas(w, h);
  draw(ctx, cv);
  scene.textures.addCanvas(key, cv);
  return key;
}

export function bakeProps(scene) {
  bake(scene, 'px', 4, 4, ctx => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 4, 4); });
  // soft white glow, tinted where it's used
  bake(scene, 'glow', 64, 64, ctx => {
    const r = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.45, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = r; ctx.fillRect(0, 0, 64, 64);
  });
  portalLight(scene);
  // soft puff sprite for steam
  bake(scene, 'puff', 64, 64, ctx => {
    const r = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    r.addColorStop(0, 'rgba(220,250,255,1)'); r.addColorStop(.4, 'rgba(140,235,255,.4)'); r.addColorStop(1, 'rgba(53,233,255,0)');
    ctx.fillStyle = r; ctx.fillRect(0, 0, 64, 64);
  });
  // enemy laser bolt, centered
  bake(scene, 'laser', 76, 38, ctx => {
    ctx.translate(38, 19); ctx.shadowColor = '#ff2d55'; ctx.shadowBlur = 14;
    ctx.fillStyle = '#ff2d55'; ctx.fillRect(-22, -3, 44, 6); ctx.fillStyle = '#fff'; ctx.fillRect(-16, -1, 32, 2);
  });

}

// ---------------------------------------------------------------- level-themed textures

// Neon trim for an exposed side of solid ground (repeats vertically). 16px wide, the line sits at x=7..9.
export function wallTrim(scene, color) {
  return bake(scene, 'trim' + color, 16, 64, ctx => {
    ctx.shadowColor = color; ctx.shadowBlur = 8; ctx.fillStyle = rgba(color, .85); ctx.fillRect(7, -20, 2, 104);
  });
}

// Light shaft rising out of a pit (beam + hot core + lit walls). top/bottom are world y.
export function pitShaft(scene, gw, height, floorOffset, color) {
  gw = Math.round(gw); height = Math.round(height);
  return bake(scene, `shaft${gw}x${height}x${floorOffset}${color}`, gw + 24, height, ctx => {
    ctx.translate(12, 0);
    let g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, rgba(color, 0)); g.addColorStop(.55, rgba(color, .22)); g.addColorStop(1, rgba(color, .6));
    ctx.fillStyle = g; ctx.fillRect(0, 0, gw, height);
    g = ctx.createLinearGradient(0, floorOffset, 0, height); g.addColorStop(0, 'rgba(220,250,255,0)'); g.addColorStop(1, 'rgba(220,250,255,.45)');
    ctx.fillStyle = g; ctx.fillRect(gw * .15, floorOffset, gw * .7, height - floorOffset);
    ctx.shadowColor = color; ctx.shadowBlur = 18; ctx.fillStyle = rgba(color, .9);
    ctx.fillRect(-1, floorOffset, 3, height - floorOffset); ctx.fillRect(gw - 2, floorOffset, 3, height - floorOffset);
  });
}

// Light for the exit gate's open middle (the gate itself is an image in assets/exit-gates/). All white, tinted to
// the level colour and drawn additively behind the frame, which hides their edges.
function portalLight(scene) {
  // energy sheet: bright at the rims and a softer core, strongest towards the floor
  bake(scene, 'portal-field', 64, 256, ctx => {
    const g = ctx.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, 'rgba(255,255,255,.75)'); g.addColorStop(.18, 'rgba(255,255,255,.16)'); g.addColorStop(.5, 'rgba(255,255,255,.3)');
    g.addColorStop(.82, 'rgba(255,255,255,.16)'); g.addColorStop(1, 'rgba(255,255,255,.75)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 256);
    ctx.globalCompositeOperation = 'destination-in';
    const v = ctx.createLinearGradient(0, 0, 0, 256);
    v.addColorStop(0, 'rgba(0,0,0,.5)'); v.addColorStop(.6, 'rgba(0,0,0,.75)'); v.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, 64, 256);
  });
  // scan lines, tiled and scrolled upwards
  bake(scene, 'portal-scan', 16, 24, ctx => {
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(0, 0, 16, 2);
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(0, 12, 16, 1);
  });
  // ripple ring, stretched to the doorway's shape
  bake(scene, 'portal-ring', 128, 128, ctx => {
    ctx.shadowColor = '#fff'; ctx.shadowBlur = 10; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(64, 64, 52, 0, Math.PI * 2); ctx.stroke();
  });
  // soft horizontal band that sweeps down the doorway
  bake(scene, 'portal-band', 32, 32, ctx => {
    const g = ctx.createLinearGradient(0, 0, 0, 32);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32);
  });
}

// Full-screen overlays
export function bakeScreens(scene, W, H) {
  bake(scene, 'fog', W, H, ctx => {
    const g = ctx.createLinearGradient(0, H * .55, 0, H); g.addColorStop(0, 'rgba(7,5,10,0)'); g.addColorStop(1, 'rgba(7,5,10,.85)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  });
  bake(scene, 'vignette', W, H, ctx => {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, H * .85);
    g.addColorStop(0, 'rgba(255,45,85,0)'); g.addColorStop(1, 'rgba(255,45,85,1)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  });
}
