// Overlay shown over a level: game over, level clear (with bonus tally), final victory, and pause.
import Phaser from 'phaser';
import { W, H, HUD_FONT, CYAN, RED } from '../config.js';
import { panel, spaced, fmt, rgba } from '../gfx/draw.js';
import { LEVELS } from '../levels/index.js';
import { save } from '../save.js';
import { SFX } from '../audio/sfx.js';
import { musicMode } from '../audio/music.js';
import { onPress, isConfirm, isBack, isShoot, releaseAll } from '../controls.js';

const time = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class ResultScene extends Phaser.Scene {
  constructor() { super('Result'); }

  init(data) { this.data_ = data; }

  create() {
    const d = this.data_, L = LEVELS[d.level];
    this.L = L;
    this.tex = this.textures.exists('result') ? this.textures.get('result') : this.textures.createCanvas('result', W, H);
    this.add.image(0, 0, 'result').setOrigin(0);
    this.tally = 0; this.tallyDone = d.kind !== 'clear' && d.kind !== 'victory';
    this.ticks = 0;
    this.draw();

    const actions = {
      over: [['RETRY', () => this.retry()], ['LEVELS', () => this.toSelect()]],
      clear: [['NEXT LEVEL', () => this.next()], ['REPLAY', () => this.replay()], ['LEVELS', () => this.toSelect()]],
      victory: [['LEVELS', () => this.toSelect()], ['REPLAY', () => this.replay()]],
      pause: [['RESUME', () => this.resume()], ['RESTART', () => this.replay()], ['LEVELS', () => this.toSelect()]],
    }[d.kind];
    this.actions = actions; this.sel = 0;
    const y = d.kind === 'pause' ? 328 : 410, gap = actions.length > 2 ? 160 : 190, x0 = W / 2 - (actions.length - 1) * gap / 2;
    this.buttons = actions.map(([label, fn], i) => {
      const t = this.add.text(x0 + i * gap, y, label, { fontFamily: HUD_FONT, fontSize: '20px', fontStyle: '700', color: '#ffffff' })
        .setOrigin(.5).setLetterSpacing(4).setPadding(12, 8, 12, 8).setInteractive({ useHandCursor: true });
      t.on('pointerover', () => { this.sel = i; this.highlight(); });
      t.on('pointerdown', () => { if (this.tallyDone) { SFX.confirm(); fn(); } });
      return t;
    });
    this.highlight();
    this.add.text(W / 2, y + 38, '← →  choose     SPACE  select', { fontFamily: HUD_FONT, fontSize: '13px', fontStyle: '600', color: 'rgba(190,230,240,.6)' })
      .setOrigin(.5).setLetterSpacing(1.5);

    onPress(this, code => {
      if (!this.tallyDone) { this.tally = 99; return; }   // skip the count-up
      if (code === 'ArrowLeft' || code === 'KeyA') { this.sel = (this.sel + actions.length - 1) % actions.length; SFX.select(); this.highlight(); }
      if (code === 'ArrowRight' || code === 'KeyD') { this.sel = (this.sel + 1) % actions.length; SFX.select(); this.highlight(); }
      if (isConfirm(code) || isShoot(code)) { SFX.confirm(); actions[this.sel][1](); }
      if (isBack(code)) { SFX.confirm(); d.kind === 'pause' ? this.resume() : this.toSelect(); }
    });
  }

  highlight() {
    this.buttons.forEach((b, i) => {
      const on = i === this.sel;
      b.setColor(on ? '#ffffff' : 'rgba(190,230,240,.55)').setShadow(0, 0, on ? CYAN : 'transparent', on ? 12 : 0, false, true)
        .setBackgroundColor(on ? 'rgba(53,233,255,.14)' : 'rgba(0,0,0,0)');
    });
  }

  update(t, delta) {
    if (this.tallyDone) return;
    const prev = Math.floor(this.tally * 4);
    this.tally += delta / 1000;
    if (Math.floor(this.tally * 4) !== prev && this.tally < 1.6) SFX.tick();
    if (this.tally >= 1.6) { this.tallyDone = true; this.tally = 1.6; }
    this.draw();
  }

  draw() {
    const d = this.data_, L = this.L, ctx = this.tex.context;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(7,5,10,.72)'; ctx.fillRect(0, 0, W, H);
    if (d.kind === 'pause') {
      panel(ctx, W / 2 - 230, 140, 460, 260, L.color, 16);
      spaced(ctx, 'PAUSED', W / 2, 232, 56, 700, '#ffffff', 'center', 6, L.color);
      spaced(ctx, `LEVEL ${L.id}  ·  ${L.name.toUpperCase()}`, W / 2, 270, 14, 600, rgba(L.color, .9), 'center', 3);
      this.tex.refresh(); return;
    }
    if (d.kind === 'over') {
      const s = d.stats;
      panel(ctx, W / 2 - 260, 84, 520, 388, RED, 16);
      spaced(ctx, 'SIGNAL LOST', W / 2, 170, 64, 700, RED, 'center', 4, RED);
      const stats = [['SCORE', fmt(s.score)], ['TIME', time(s.time)], ['DRONES', String(s.kills)], ['CHIPS', String(s.chips)]];
      stats.forEach(([k, v], i) => { const x = W / 2 - 195 + i * 130; spaced(ctx, k, x, 222, 11, 600, 'rgba(190,230,240,.7)', 'center', 2.5); spaced(ctx, v, x, 252, 26, 700, '#ffffff', 'center', .5, CYAN); });
      const cp = d.checkpoint >= 0;
      spaced(ctx, cp ? 'RETRY RESUMES AT YOUR LAST CHECKPOINT' : 'RETRY RESTARTS THE LEVEL', W / 2, 300, 13, 600, cp ? 'rgba(53,233,255,.85)' : 'rgba(255,160,180,.9)', 'center', 2.5);
      spaced(ctx, '← →  move    SPACE  jump    ↓  duck    V / B / N  shoot    ESC  pause', W / 2, 350, 13, 600, 'rgba(255,160,180,.75)', 'center', 1.5);
      this.tex.refresh(); return;
    }
    // clear / victory: count up the bonuses
    const s = d.stats, b = d.bonus, victory = d.kind === 'victory', col = L.color;
    const k = Math.min(1, this.tally / 1.2);
    panel(ctx, W / 2 - 280, 40, 560, 432, col, 16);
    spaced(ctx, victory ? 'CITY RESTORED' : 'LEVEL CLEAR', W / 2, 118, 54, 700, '#ffffff', 'center', 5, col);
    spaced(ctx, `LEVEL ${L.id}  ·  ${L.name.toUpperCase()}`, W / 2, 146, 14, 600, rgba(col, .95), 'center', 3);
    const rows = [
      ['SCORE', `${s.kills} drones · ${s.chips} chips`, s.score],
      ['TIME BONUS', `${time(s.time)}  (par ${time(L.par)})`, b.time],
      ['ALL CHIPS', `${s.chips} / ${d.chipsTotal}`, b.chips],
      ['NO DAMAGE', s.hits ? `${s.hits} hit${s.hits > 1 ? 's' : ''} taken` : 'flawless', b.perfect],
    ];
    rows.forEach(([label, detail, v], i) => {
      const y = 190 + i * 34, show = this.tally > i * .25;
      if (!show) return;
      spaced(ctx, label, W / 2 - 230, y, 15, 700, 'rgba(190,230,240,.85)', 'left', 2.5);
      spaced(ctx, detail, W / 2 - 60, y, 14, 600, 'rgba(190,230,240,.55)', 'left', 1);
      spaced(ctx, (i && v ? '+' : '') + fmt(v * Math.min(1, (this.tally - i * .25) / .4)), W / 2 + 230, y, 20, 700, v ? '#ffffff' : 'rgba(255,255,255,.35)', 'right', 1, v ? CYAN : null);
    });
    ctx.fillStyle = rgba(col, .35); ctx.fillRect(W / 2 - 230, 326, 460, 1.5);
    spaced(ctx, 'TOTAL', W / 2 - 230, 362, 18, 700, '#ffffff', 'left', 3);
    spaced(ctx, fmt(d.total * k), W / 2 + 230, 364, 34, 700, '#ffffff', 'right', 1, col);
    if (this.tallyDone) {
      const msg = victory ? `ALL LEVEL BESTS  ${fmt(save.totalBest())}` : d.isBest ? 'NEW BEST!' : `BEST  ${fmt(d.prevBest)}`;
      spaced(ctx, msg, W / 2, 384, 13, 700, d.isBest || victory ? '#ffb03c' : 'rgba(53,233,255,.85)', 'center', 3, d.isBest ? '#ffb03c' : null);
    }
    this.tex.refresh();
  }

  // scene.start() shuts this overlay down and (re)starts the target scene
  retry() { const d = this.data_; releaseAll(); this.scene.start('Game', { level: d.level, checkpoint: d.checkpoint, snapshot: d.snapshot }); }
  replay() { releaseAll(); this.scene.start('Game', { level: this.data_.level }); }
  next() { releaseAll(); this.scene.start('Game', { level: Math.min(LEVELS.length - 1, this.data_.level + 1) }); }
  resume() { releaseAll(); this.scene.stop(); this.scene.get('Game').resume(); }
  toSelect() {
    releaseAll(); musicMode('title');
    this.scene.stop('Game'); this.scene.stop('HUD');
    this.scene.start('Select', { level: this.data_.level });
  }
}
