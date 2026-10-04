// Level select: five cards, locked until the previous level is cleared.
import Phaser from 'phaser';
import { W, H, CYAN } from '../config.js';
import { panel, spaced, fmt, rgba, rr } from '../gfx/draw.js';
import { LEVELS } from '../levels/index.js';
import { save } from '../save.js';
import { SFX } from '../audio/sfx.js';
import { musicMode } from '../audio/music.js';
import { onPress, isConfirm, isBack, isShoot, releaseAll } from '../controls.js';

const CW = 164, CH = 262, GAP = 16, CY = 126;

export class SelectScene extends Phaser.Scene {
  constructor() { super('Select'); }

  init(data) { this.startAt = data?.level; }

  create() {
    musicMode('title');
    const city = this.textures.get('city').getSourceImage(), s = H / city.height;
    this.bg = this.add.tileSprite(0, 0, W, H, 'city').setOrigin(0).setTileScale(s, s).setAlpha(.6);
    this.bgScale = s;
    this.add.rectangle(0, 0, W, H, 0x07050a, .55).setOrigin(0);
    this.tex = this.textures.exists('select') ? this.textures.get('select') : this.textures.createCanvas('select', W, H);
    this.add.image(0, 0, 'select').setOrigin(0);

    this.unlocked = save.unlocked();
    this.sel = Phaser.Math.Clamp(this.startAt ?? this.unlocked - 1, 0, LEVELS.length - 1);
    const x0 = (W - (LEVELS.length * CW + (LEVELS.length - 1) * GAP)) / 2;
    this.cardX = i => x0 + i * (CW + GAP);
    LEVELS.forEach((L, i) => {
      const z = this.add.zone(this.cardX(i), CY, CW, CH).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerover', () => { if (this.sel !== i) { this.sel = i; SFX.select(); this.draw(); } });
      z.on('pointerdown', () => { this.sel = i; this.play(); });
    });
    this.t = 0;
    this.draw();

    onPress(this, code => {
      if (code === 'ArrowLeft' || code === 'KeyA') { this.sel = (this.sel + LEVELS.length - 1) % LEVELS.length; SFX.select(); this.draw(); }
      if (code === 'ArrowRight' || code === 'KeyD') { this.sel = (this.sel + 1) % LEVELS.length; SFX.select(); this.draw(); }
      if (isConfirm(code) || isShoot(code)) this.play();
      if (isBack(code)) { SFX.confirm(); this.scene.start('Title'); }
      if (code === 'KeyS') { SFX.confirm(); releaseAll(); this.scene.start('Story'); }
    });
  }

  play() {
    if (this.sel + 1 > this.unlocked) { SFX.hurt(); this.shakeT = .3; return; }
    SFX.confirm(); releaseAll();
    this.scene.start('Game', { level: this.sel });
  }

  update(time, delta) {
    this.t += delta / 1000;
    this.bg.tilePositionX = this.t * 20 / this.bgScale;
    this.shakeT = Math.max(0, (this.shakeT || 0) - delta / 1000);
    if (Math.floor(this.t * 10) !== this.lastTick) { this.lastTick = Math.floor(this.t * 10); this.draw(); }
  }

  draw() {
    const ctx = this.tex.context, t = this.t;
    ctx.clearRect(0, 0, W, H);
    spaced(ctx, 'SELECT LEVEL', W / 2, 76, 40, 700, '#ffffff', 'center', 6, CYAN);
    spaced(ctx, `TOTAL BEST  ${fmt(save.totalBest())}`, W / 2, 104, 14, 600, 'rgba(53,233,255,.85)', 'center', 3);
    LEVELS.forEach((L, i) => {
      const locked = i + 1 > this.unlocked, on = i === this.sel, col = locked ? '#5a5f6e' : L.color;
      const shake = on && this.shakeT > 0 ? Math.sin(this.shakeT * 60) * 5 : 0;
      const x = this.cardX(i) + shake, y = CY - (on ? 10 : 0);
      ctx.save();
      if (on) { ctx.shadowColor = col; ctx.shadowBlur = 24 + Math.sin(t * 4) * 8; }
      panel(ctx, x, y, CW, CH, col, 12);
      ctx.restore();
      ctx.fillStyle = rgba(col, on ? .18 : .08); ctx.fillRect(x + 10, y + 12, CW - 20, 92);
      spaced(ctx, String(L.id).padStart(2, '0'), x + CW / 2, y + 82, 64, 700, locked ? '#5a5f6e' : '#ffffff', 'center', 2, locked ? null : col);
      let ns = 17; ctx.font = `700 ${ns}px Rajdhani, system-ui`;
      while (ns > 11 && ctx.measureText(L.name.toUpperCase()).width + L.name.length * 1.5 > CW - 16) { ns--; ctx.font = `700 ${ns}px Rajdhani, system-ui`; }
      spaced(ctx, L.name.toUpperCase(), x + CW / 2, y + 132, ns, 700, locked ? '#6b7080' : '#ffffff', 'center', 1.5);
      wrap(ctx, L.subtitle, x + CW / 2, y + 156, CW - 24, locked ? 'rgba(120,125,140,.7)' : 'rgba(190,230,240,.7)');
      if (locked) {
        ctx.save(); ctx.translate(x + CW / 2, y + 226);
        ctx.strokeStyle = '#6b7080'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -10, 9, Math.PI, 0); ctx.stroke();
        ctx.fillStyle = '#6b7080'; rr(ctx, -13, -10, 26, 20, 3); ctx.fill(); ctx.restore();
      } else {
        const best = save.best(L.id);
        spaced(ctx, 'BEST', x + CW / 2, y + 218, 11, 600, 'rgba(190,230,240,.55)', 'center', 2.5);
        spaced(ctx, best ? fmt(best) : '—', x + CW / 2, y + 242, 20, 700, best ? col : 'rgba(255,255,255,.4)', 'center', 1);
      }
    });
    const L = LEVELS[this.sel], locked = this.sel + 1 > this.unlocked;
    spaced(ctx, locked ? `CLEAR LEVEL ${this.sel} TO UNLOCK` : `PAR TIME  ${Math.floor(L.par / 60)}:${String(L.par % 60).padStart(2, '0')}`, W / 2, 432, 14, 700, locked ? 'rgba(255,120,150,.9)' : rgba(L.color, .9), 'center', 3);
    spaced(ctx, '← →  choose     SPACE  play     S  story     ESC  back     M  music', W / 2, 490, 13, 600, 'rgba(190,230,240,.6)', 'center', 1.5);
    this.tex.refresh();
  }
}

function wrap(ctx, text, cx, y, maxW, color) {
  ctx.font = '500 13px Rajdhani, system-ui'; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  let line = '', yy = y;
  for (const word of text.split(' ')) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, cx, yy); line = word; yy += 15; } else line = test;
  }
  if (line) ctx.fillText(line, cx, yy);
}
