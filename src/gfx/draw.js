// 2D-canvas drawing helpers shared by the HUD, menus and baked textures (same look as the canvas build).
import { HUD_FONT } from '../config.js';

export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function chamfer(ctx, x, y, w, h, c) {
  ctx.beginPath(); ctx.moveTo(x + c, y); ctx.lineTo(x + w - c, y); ctx.lineTo(x + w, y + c); ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h); ctx.lineTo(x + c, y + h); ctx.lineTo(x, y + h - c); ctx.lineTo(x, y + c); ctx.closePath();
}

export function panel(ctx, x, y, w, h, glow = '#35e9ff', c = 10) {
  ctx.save();
  chamfer(ctx, x, y, w, h, c); ctx.fillStyle = 'rgba(6,9,20,.62)'; ctx.fill();
  const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, 'rgba(255,255,255,.07)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fill();
  ctx.shadowColor = glow; ctx.shadowBlur = 10; ctx.strokeStyle = glow; ctx.globalAlpha = .55; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  // accent corner ticks
  ctx.strokeStyle = glow; ctx.lineWidth = 2; ctx.beginPath();
  ctx.moveTo(x + c, y); ctx.lineTo(x + c + 22, y); ctx.moveTo(x + w - c - 22, y + h); ctx.lineTo(x + w - c, y + h); ctx.stroke();
  ctx.restore();
}

// letter-spaced text with optional glow; returns the drawn width
export function spaced(ctx, text, x, y, size, weight, color, align = 'left', sp = 1.5, glow = null) {
  ctx.font = `${weight} ${size}px ${HUD_FONT}`; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  let w = 0; for (const ch of text) w += ctx.measureText(ch).width + sp; w -= sp;
  let tx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.save(); ctx.fillStyle = color; if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 10; }
  for (const ch of text) { ctx.fillText(ch, tx, y); tx += ctx.measureText(ch).width + sp; }
  ctx.restore(); return w;
}

export function hexPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i - Math.PI / 6, px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.closePath();
}

export const fmt = n => Math.round(n).toLocaleString('en-US');

export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
export const hexNum = hex => parseInt(hex.slice(1), 16);

export function makeCanvas(w, h) {
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return [c, c.getContext('2d')];
}
