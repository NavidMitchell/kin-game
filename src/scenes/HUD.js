import kinMap from '../../assets/player/kin.json';
import { animationFrame } from '../gfx/kin-frames.js';
// Heads-up display, running on top of the Game scene. The panels are drawn with the same canvas code as
// the original build into small canvas textures; the vignette, flash and banner are Phaser objects.
import Phaser from 'phaser';
import { W, H, MAX_HP, CYAN } from '../config.js';
import { panel, spaced, hexPath, chamfer, fmt, rgba } from '../gfx/draw.js';
import { save } from '../save.js';

const K = 0.6, M = 10;   // panels are designed at full size and drawn at 60%

function canvasTexture(scene, key, w, h) {
  return scene.textures.exists(key) ? scene.textures.get(key) : scene.textures.createCanvas(key, w, h);
}

export class HUDScene extends Phaser.Scene {
  constructor() { super('HUD'); }

  create() {
    this.game_ = this.scene.get('Game');
    this.strip = canvasTexture(this, 'hud-strip', W, 52);
    this.pill = canvasTexture(this, 'hud-pill', 140, 30);
    this.ban = canvasTexture(this, 'hud-banner', 360, 110);
    this.add.image(0, 0, 'hud-strip').setOrigin(0);
    this.pillImg = this.add.image(M, H - M - 34 * K, 'hud-pill').setOrigin(0);
    this.banImg = this.add.image(W / 2, 120, 'hud-banner').setVisible(false);
    this.vignette = this.add.image(0, 0, 'vignette').setOrigin(0).setAlpha(0);
    this.flash = this.add.rectangle(0, 0, W, H, 0xff2d55).setOrigin(0).setAlpha(0);
    this.portrait = this.textures.get('kin').getSourceImage();
    this.dispScore = this.game_.stats.score; this.lastScore = this.dispScore; this.scorePopT = 0;
    this.banner = null; this.lastPill = '';
    this.game_.events.on('banner', this.onBanner, this);
    this.game_.events.on('flash', this.onFlash, this);
    this.events.once('shutdown', () => {
      this.game_.events.off('banner', this.onBanner, this);
      this.game_.events.off('flash', this.onFlash, this);
    });
  }

  onBanner(text, sub) { this.banner = { text, sub, t: 0 }; }
  onFlash() { this.flash.setAlpha(.25); this.tweens.add({ targets: this.flash, alpha: 0, duration: 250 }); }

  update(time, delta) {
    const g = this.game_;
    if (!g.player || !g.sys.isActive() && !g.sys.isPaused()) return;
    const dt = Math.min(.05, delta / 1000), t = time / 1000;
    const score = g.stats.score;
    if (score !== this.dispScore) {
      const d = score - this.dispScore;
      this.dispScore = Math.abs(d) < 1 ? score : this.dispScore + d * Math.min(1, dt * 7);
      if (d > 0) this.scorePopT = .25;
    }
    this.scorePopT -= dt;
    this.drawStrip(g, t);
    this.drawPill(g, t);
    this.drawBanner(dt);
    this.vignette.setAlpha(g.hp === 1 && g.mode === 'play' ? .18 + Math.sin(t * 5) * .12 : 0);
  }

  drawStrip(g, t) {
    const ctx = this.strip.context, L = g.level, col = L.color;
    ctx.clearRect(0, 0, W, 52);
    // ---- left: portrait + lives + chips (local 262x64)
    ctx.save(); ctx.translate(M, M); ctx.scale(K, K);
    panel(ctx, 0, 0, 262, 64);
    ctx.save(); ctx.beginPath(); ctx.arc(34, 32, 24, 0, Math.PI * 2); ctx.fillStyle = '#0b1420'; ctx.fill(); ctx.clip();
    const frame = animationFrame(kinMap.animations.idle, t);
    const sx = (frame % kinMap.columns) * kinMap.frameWidth;
    const sy = Math.floor(frame / kinMap.columns) * kinMap.frameHeight;
    // Fixed portrait window within the uniform idle cell, including the raised crown.
    ctx.drawImage(this.portrait, sx + 70, sy + 55, 180, 135, 4, 8, 60, 45);
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.arc(34, 32, 24, 0, Math.PI * 2); ctx.strokeStyle = CYAN; ctx.lineWidth = 2; ctx.shadowColor = CYAN; ctx.shadowBlur = 12; ctx.stroke(); ctx.restore();
    spaced(ctx, 'LIVES', 72, 18, 12, 600, 'rgba(190,230,240,.75)', 'left', 2);
    for (let i = 0; i < MAX_HP; i++) {
      const alive = i < g.hp, cx = 82 + i * 30, cy = 40; let r = 10;
      if (alive && i === g.hp - 1 && g.lifeLostT > 0) r += Math.sin(g.lifeLostT * 12) * 2;
      if (!alive && i === g.hp && g.lifeLostT > 0) r += g.lifeLostT * 10;
      ctx.save(); hexPath(ctx, cx, cy, r);
      if (alive) {
        const pulse = .85 + Math.sin(t * 4 + i) * .15;
        ctx.fillStyle = `rgba(53,233,255,${.9 * pulse})`; ctx.shadowColor = CYAN; ctx.shadowBlur = 14; ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.55)'; hexPath(ctx, cx, cy, r * .45); ctx.fill();
      } else { ctx.fillStyle = 'rgba(255,45,85,.12)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,45,85,.55)'; ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.restore();
    }
    const cx0 = 184;
    ctx.save(); ctx.translate(cx0, 40); ctx.rotate(Math.PI / 4); ctx.fillStyle = CYAN; ctx.shadowColor = CYAN; ctx.shadowBlur = 10; ctx.fillRect(-6, -6, 12, 12); ctx.fillStyle = '#e9fdff'; ctx.fillRect(-2.5, -2.5, 5, 5); ctx.restore();
    spaced(ctx, 'CHIPS', cx0 + 16, 18, 12, 600, 'rgba(190,230,240,.75)', 'left', 2);
    const cw = spaced(ctx, String(g.stats.chips), cx0 + 16, 48, 24, 700, '#e9fdff', 'left', .5);
    spaced(ctx, '/' + g.chipsTotal, cx0 + 18 + cw, 48, 14, 600, 'rgba(190,230,240,.6)', 'left', .5);
    ctx.restore();

    // ---- centre: level name + progress to the exit (local 300x64, centred)
    ctx.save(); ctx.translate(W / 2, M); ctx.scale(K, K);
    panel(ctx, -150, 0, 300, 64, col);
    spaced(ctx, `LEVEL ${L.id}`, 0, 18, 12, 600, rgba(col, .85), 'center', 2.5);
    spaced(ctx, L.name.toUpperCase(), 0, 44, 26, 700, '#ffffff', 'center', 2, col);
    const prog = g.progress(), bx = -125, by = 53, bw = 250;
    ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(bx, by, bw, 4);
    const bg = ctx.createLinearGradient(bx, 0, bx + bw, 0); bg.addColorStop(0, col); bg.addColorStop(1, '#ffffff');
    ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 8; ctx.fillStyle = bg; ctx.fillRect(bx, by, bw * prog, 4); ctx.restore();
    for (const cp of L.checkpoints) {   // checkpoint ticks on the bar
      const k = Phaser.Math.Clamp((cp.x - L.start.x) / (L.exit.x - L.start.x), 0, 1);
      ctx.fillStyle = k <= prog ? '#ffffff' : 'rgba(255,255,255,.35)'; ctx.fillRect(bx + bw * k - 1, by - 3, 2, 10);
    }
    ctx.restore();

    // ---- right: score + best (local 262x64, right-aligned)
    ctx.save(); ctx.translate(W - M, M); ctx.scale(K, K);
    panel(ctx, -262, 0, 262, 64);
    spaced(ctx, 'SCORE', -16, 18, 12, 600, 'rgba(190,230,240,.75)', 'right', 2.5);
    const sPop = this.scorePopT > 0 ? 1 + this.scorePopT * .6 : 1;
    ctx.save(); ctx.translate(-16, 50); ctx.scale(sPop, sPop); spaced(ctx, fmt(this.dispScore), 0, 0, 34, 700, '#ffffff', 'right', 1, CYAN); ctx.restore();
    const best = save.best(L.id);
    spaced(ctx, 'BEST', -248, 18, 12, 600, 'rgba(190,230,240,.5)', 'left', 2.5);
    spaced(ctx, fmt(Math.max(best, g.stats.score)), -248, 48, 22, 600, 'rgba(53,233,255,.85)', 'left', .5);
    if (g.stats.kills) spaced(ctx, '✕ ' + g.stats.kills, -248 + 76, 48, 15, 600, 'rgba(255,120,150,.9)', 'left', 1);
    ctx.restore();
    this.strip.refresh();
  }

  drawPill(g, t) {
    const p = g.player, show = p.jet && g.mode === 'play';
    this.pillImg.setVisible(show);
    if (!show) return;
    const ctx = this.pill.context, on = p.thrust;
    ctx.clearRect(0, 0, 140, 30);
    ctx.save(); ctx.translate(1, 1); ctx.scale(K, K);
    const pw = 206, ph = 34;
    panel(ctx, 0, 0, pw, ph, on ? '#bff6ff' : CYAN, 8);
    const fl = on ? 14 + Math.random() * 8 : 8;
    ctx.save(); ctx.shadowColor = CYAN; ctx.shadowBlur = 12; ctx.fillStyle = CYAN;
    ctx.beginPath(); ctx.moveTo(22, 8); ctx.lineTo(32, 8); ctx.lineTo(27, 8 + fl); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(25, 8); ctx.lineTo(29, 8); ctx.lineTo(27, 8 + fl * .5); ctx.closePath(); ctx.fill(); ctx.restore();
    spaced(ctx, on ? 'THRUSTING' : 'JET ONLINE', 44, 16, 13, 700, '#e9fdff', 'left', 2, CYAN);
    spaced(ctx, 'hold jump to fly', 44, 28, 11, 500, 'rgba(190,230,240,.7)', 'left', 1);
    for (let i = 0; i < 8; i++) {
      const lit = on || Math.sin(t * 5 - i * .6) > 0;
      ctx.fillStyle = lit ? 'rgba(53,233,255,.95)' : 'rgba(53,233,255,.18)'; ctx.fillRect(pw - 14 - (8 - i) * 9, 11, 6, 12);
    }
    ctx.restore();
    this.pill.refresh();
  }

  drawBanner(dt) {
    const b = this.banner;
    if (!b) { this.banImg.setVisible(false); return; }
    b.t += dt;
    if (b.t > 2.4) { this.banner = null; this.banImg.setVisible(false); return; }
    const t = b.t, kk = t < .25 ? t / .25 : t > 2 ? (2.4 - t) / .4 : 1;
    if (!b.drawn) {   // draw once, animate with scale/alpha
      const ctx = this.ban.context, col = this.game_.level.color;
      ctx.clearRect(0, 0, 360, 110);
      ctx.save(); ctx.translate(180, 52);
      ctx.fillStyle = 'rgba(6,9,20,.55)'; chamfer(ctx, -170, -34, 340, 74, 12); ctx.fill(); ctx.strokeStyle = rgba(col, .7); ctx.lineWidth = 1.5; ctx.stroke();
      const gr = ctx.createLinearGradient(-90, 0, 90, 0); gr.addColorStop(0, col); gr.addColorStop(1, '#ffffff');
      spaced(ctx, b.text, 0, 8, 38, 700, gr, 'center', 3, col);
      spaced(ctx, b.sub, 0, 30, 12, 600, 'rgba(230,240,250,.9)', 'center', 2.5);
      ctx.restore();
      this.ban.refresh(); b.drawn = true;
    }
    this.banImg.setVisible(true).setAlpha(Phaser.Math.Clamp(kk, 0, 1)).setScale((.8 + .2 * Math.min(1, kk)) * .7);
  }
}
