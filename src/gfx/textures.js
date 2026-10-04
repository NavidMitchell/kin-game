// Bakes every texture the game uses. Sprite-sheet frames are pre-scaled to world size (with their glow
// baked in), and the neon props are drawn once with the same canvas code the original build drew per frame.
import { FRAMES, SFR, DFR, DFR_FADE, SPR_SCALE, SH_SCALE, DR_SCALE, DASH_NOSE } from '../config.js';
import { makeCanvas, rr, rgba, hexPath } from './draw.js';

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
  const robot = scene.textures.get('robot-src').getSourceImage();
  const shoot = scene.textures.get('shoot-src').getSourceImage();
  const drone = scene.textures.get('drone-src').getSourceImage();
  const feet = (dw, dh) => [dw / 2, dh];
  const kin = [];
  for (const [anim, rects] of Object.entries(FRAMES)) rects.forEach((rect, i) => kin.push({ name: anim + i, img: robot, rect, scale: SPR_SCALE, anchor: feet }));
  // shoot frames keep the body 41px left of the feet so the charge glow extends forward
  for (const anim of ['charge', 'fire']) SFR[anim].forEach(([x, y, w, h, bodyX], i) => kin.push({ name: anim + i, img: shoot, rect: [x, y, w, h], scale: SH_SCALE, anchor: (dw, dh) => [(bodyX - x) * SH_SCALE, dh] }));
  bakeAtlas(scene, 'kin', kin, { pad: 2 });

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
  // soft puff sprite for steam
  bake(scene, 'puff', 64, 64, ctx => {
    const r = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    r.addColorStop(0, 'rgba(220,250,255,1)'); r.addColorStop(.4, 'rgba(140,235,255,.4)'); r.addColorStop(1, 'rgba(53,233,255,0)');
    ctx.fillStyle = r; ctx.fillRect(0, 0, 64, 64);
  });
  // data chip (r=11) with glow, centered
  bake(scene, 'chip', 58, 58, ctx => {
    const c = 29, r = 11; ctx.translate(c, c);
    ctx.shadowColor = '#35e9ff'; ctx.shadowBlur = 16; ctx.fillStyle = '#35e9ff';
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e9fdff'; ctx.beginPath(); ctx.moveTo(0, -r * .45); ctx.lineTo(r * .45, 0); ctx.lineTo(0, r * .45); ctx.lineTo(-r * .45, 0); ctx.closePath(); ctx.fill();
  });
  // jet fuel tank, anchored at its base (70x102, base at y=80)
  bake(scene, 'tank', 70, 102, ctx => {
    ctx.translate(35, 80); ctx.shadowColor = '#35e9ff'; ctx.shadowBlur = 18;
    ctx.fillStyle = '#0e1a1f'; rr(ctx, -13, -52, 26, 52, 7); ctx.fill();
    ctx.fillStyle = '#35e9ff'; ctx.fillRect(-13, -40, 26, 4); ctx.fillRect(-13, -22, 26, 4); rr(ctx, -5, -58, 10, 8, 3); ctx.fill();
    ctx.fillStyle = 'rgba(53,233,255,.35)'; ctx.fillRect(-9, -48, 5, 42);
    ctx.shadowBlur = 0; ctx.fillStyle = '#e9fdff'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('JET', 0, -31);
  });
  // egg pod shell (glowing core is a separate image so it can pulse), base at y=80
  bake(scene, 'egg', 80, 102, ctx => {
    ctx.translate(40, 80);
    ctx.shadowColor = '#35e9ff'; ctx.shadowBlur = 18;
    ctx.fillStyle = '#1a0c14'; ctx.beginPath(); ctx.ellipse(0, -30, 18, 28, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = '#ff2d55'; ctx.shadowBlur = 18; ctx.strokeStyle = '#ff2d55'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-14, -40); ctx.lineTo(-4, -28); ctx.lineTo(-10, -14); ctx.moveTo(6, -50); ctx.lineTo(12, -34); ctx.lineTo(4, -20); ctx.stroke();
  });
  bake(scene, 'egg-core', 48, 54, ctx => {
    ctx.translate(24, 27); ctx.shadowColor = '#35e9ff'; ctx.shadowBlur = 16; ctx.fillStyle = '#35e9ff';
    ctx.beginPath(); ctx.ellipse(0, 0, 6, 9, 0, 0, Math.PI * 2); ctx.fill();
  });
  // repair kit: a spare life core, centered
  bake(scene, 'repair', 64, 64, ctx => {
    ctx.translate(32, 32);
    hexPath(ctx, 0, 0, 15); ctx.fillStyle = '#0b1420'; ctx.shadowColor = '#35e9ff'; ctx.shadowBlur = 16; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#35e9ff'; ctx.stroke();
    ctx.shadowBlur = 8; ctx.fillStyle = '#e9fdff'; ctx.fillRect(-2.5, -8, 5, 16); ctx.fillRect(-8, -2.5, 16, 5);
  });
  // enemy laser bolt, centered
  bake(scene, 'laser', 76, 38, ctx => {
    ctx.translate(38, 19); ctx.shadowColor = '#ff2d55'; ctx.shadowBlur = 14;
    ctx.fillStyle = '#ff2d55'; ctx.fillRect(-22, -3, 44, 6); ctx.fillStyle = '#fff'; ctx.fillRect(-16, -1, 32, 2);
  });
  // jet pack worn on the back, centered (drawn at -26,-58 from the feet)
  bake(scene, 'jetpack', 48, 72, ctx => {
    ctx.translate(24, 36); ctx.shadowColor = '#35e9ff'; ctx.shadowBlur = 14;
    ctx.fillStyle = '#0e1a1f'; rr(ctx, -8, -20, 16, 40, 5); ctx.fill();
    ctx.fillStyle = '#35e9ff'; ctx.fillRect(-8, -8, 16, 3); ctx.fillRect(-8, 6, 16, 3);
  });
  // thruster flame, anchored at its top centre (length 40, scaled at runtime)
  bake(scene, 'flame', 40, 72, ctx => {
    ctx.translate(20, 14); ctx.shadowColor = '#35e9ff'; ctx.shadowBlur = 14;
    ctx.fillStyle = '#35e9ff'; ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.lineTo(0, 40); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.lineTo(0, 20); ctx.closePath(); ctx.fill();
  });
}

// ---------------------------------------------------------------- level-themed textures

export const GTOP_H = 60, GTOP_PAD = 20;
// Repeating 120px strip for the top of solid ground: bevel, neon edge and diagonal panel seams.
export function groundTop(scene, color) {
  return bake(scene, 'gtop' + color, 120, GTOP_PAD + GTOP_H, ctx => {
    const y = GTOP_PAD;
    ctx.fillStyle = '#0b0a10'; ctx.fillRect(0, y, 120, GTOP_H);
    ctx.fillStyle = '#16121c'; ctx.fillRect(0, y, 120, 10);
    ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 14; ctx.fillRect(-20, y, 160, 3); ctx.shadowBlur = 0;
    ctx.fillStyle = rgba(color, .25); ctx.fillRect(0, y + 3, 120, 6);
    ctx.strokeStyle = rgba(color, .16); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(120, y + 10); ctx.lineTo(106, y + 60); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, y + 10); ctx.lineTo(-14, y + 60); ctx.stroke();
  });
}

// Neon trim for an exposed side of solid ground (repeats vertically). 16px wide, the line sits at x=7..9.
export function wallTrim(scene, color) {
  return bake(scene, 'trim' + color, 16, 64, ctx => {
    ctx.shadowColor = color; ctx.shadowBlur = 8; ctx.fillStyle = rgba(color, .85); ctx.fillRect(7, -20, 2, 104);
  });
}

export const FLOAT_H = 26, FLOAT_PAD = 16;
export function floatPlat(scene, w, color, mover = false) {
  w = Math.round(w);
  return bake(scene, `float${w}${color}${mover ? 'm' : ''}`, w + FLOAT_PAD * 2, FLOAT_H + FLOAT_PAD * 2, ctx => {
    ctx.translate(FLOAT_PAD, FLOAT_PAD);
    ctx.fillStyle = '#0f0c15'; ctx.fillRect(0, 0, w, FLOAT_H);
    ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 12; ctx.fillRect(0, 0, w, 3); ctx.shadowBlur = 0;
    ctx.fillStyle = rgba(color, .25); ctx.fillRect(6, FLOAT_H - 5, w - 12, 2);
    ctx.fillStyle = rgba(color, .08); ctx.fillRect(0, 3, w, 8);
    if (mover) { // thruster pods under each end
      ctx.shadowColor = color; ctx.shadowBlur = 10; ctx.fillStyle = color;
      for (const x of [14, w - 14]) { ctx.beginPath(); ctx.moveTo(x - 6, FLOAT_H); ctx.lineTo(x + 6, FLOAT_H); ctx.lineTo(x, FLOAT_H + 7); ctx.closePath(); ctx.fill(); }
    }
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

// Exit gate: two pylons and a lintel (energy field is a separate additive image). Base at bottom centre.
export function exitGate(scene, color) {
  bake(scene, 'gate-field' + color, 120, 170, ctx => {
    const g = ctx.createLinearGradient(0, 0, 120, 0);
    g.addColorStop(0, rgba(color, 0)); g.addColorStop(.25, rgba(color, .35)); g.addColorStop(.5, 'rgba(255,255,255,.55)'); g.addColorStop(.75, rgba(color, .35)); g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, 120, 170);
    for (let y = 4; y < 170; y += 12) { ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(10, y, 100, 2); }
  });
  return bake(scene, 'gate' + color, 200, 230, ctx => {
    ctx.translate(100, 210);
    ctx.shadowColor = color; ctx.shadowBlur = 18;
    ctx.fillStyle = '#0f0c15';
    ctx.fillRect(-78, -190, 18, 190); ctx.fillRect(60, -190, 18, 190); ctx.fillRect(-84, -204, 168, 20);
    ctx.fillStyle = color;
    ctx.fillRect(-62, -186, 3, 186); ctx.fillRect(59, -186, 3, 186); ctx.fillRect(-84, -186, 168, 3);
    for (let y = -170; y < -10; y += 26) { ctx.fillRect(-74, y, 10, 3); ctx.fillRect(64, y, 10, 3); }
    ctx.shadowBlur = 0; ctx.fillStyle = '#e9fdff'; ctx.font = '700 13px Rajdhani, system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('E X I T', 0, -194);
  });
}

// Checkpoint beacon (inactive red / active cyan), base at bottom centre.
export function beacon(scene, on) {
  const color = on ? '#35e9ff' : '#ff2d55';
  return bake(scene, on ? 'beacon-on' : 'beacon-off', 60, 150, ctx => {
    ctx.translate(30, 136);
    ctx.fillStyle = '#0f0c15'; ctx.fillRect(-4, -110, 8, 110); ctx.fillRect(-14, -6, 28, 6);
    ctx.shadowColor = color; ctx.shadowBlur = on ? 22 : 10; ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(0, -126); ctx.lineTo(10, -112); ctx.lineTo(0, -98); ctx.lineTo(-10, -112); ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgba(color, on ? .9 : .5); ctx.fillRect(-1, -96, 2, 90);
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
