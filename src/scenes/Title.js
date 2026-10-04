// Title poster. Space, Enter or a tap goes to level select.
import Phaser from 'phaser';
import { W, H, CYAN } from '../config.js';
import { rr, makeCanvas, fmt } from '../gfx/draw.js';
import { save } from '../save.js';
import { musicMode } from '../audio/music.js';
import { SFX } from '../audio/sfx.js';
import { onPress, isConfirm } from '../controls.js';

export class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    musicMode('title');
    const src = this.textures.get('title').getSourceImage();
    const s = Math.max(W / src.width, H / src.height), x0 = (W - src.width * s) / 2, y0 = (H - src.height * s) / 2;
    this.add.image(x0, y0, 'title').setOrigin(0).setScale(s);   // cover: fills the whole canvas

    // pulsing glow on the PRESS SPACEBAR prompt printed on the poster
    const pw = 428 * s, ph = 60 * s;
    if (!this.textures.exists('title-glow')) {
      const [cv, ctx] = makeCanvas(pw + 80, ph + 80);
      ctx.shadowColor = CYAN; ctx.shadowBlur = 30; ctx.fillStyle = CYAN; rr(ctx, 40, 40, pw, ph, 10); ctx.fill();
      this.textures.addCanvas('title-glow', cv);
    }
    const glow = this.add.image(x0 + 622 * s - 40, y0 + 812 * s - 40, 'title-glow').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.tweens.add({ targets: glow, alpha: .3, duration: 980, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    const total = save.totalBest();
    if (total) this.add.text(16, 14, 'BEST ' + fmt(total), { fontFamily: 'system-ui', fontSize: '14px', fontStyle: 'bold', color: CYAN }).setShadow(0, 0, CYAN, 10, false, true);
    this.add.text(W - 16, 14, 'M  music    F  fullscreen', { fontFamily: 'system-ui', fontSize: '12px', color: 'rgba(223,233,239,.75)' }).setOrigin(1, 0);

    // powered by Kinotic
    const logo = this.textures.get('logo').getSourceImage(), lw = 120, lh = lw * logo.height / logo.width;
    const label = this.add.text(0, 0, 'POWERED BY', { fontFamily: 'system-ui', fontSize: '11px', fontStyle: '600', color: 'rgba(223,233,239,.85)' }).setOrigin(0, .5);
    const tw = label.width, gap = 12, totalW = tw + gap + lw, bx = (W - totalW) / 2, by = H - 20;
    this.add.rectangle(bx - 18, by - 15, totalW + 36, 30, 0x07050a, .7).setOrigin(0).setRounded(15);
    label.setPosition(bx, by + 1).setDepth(1);
    this.add.image(bx + tw + gap, by, 'logo').setOrigin(0, .5).setDisplaySize(lw, lh).setDepth(1);

    const go = () => { SFX.confirm(); this.scene.start('Story'); };
    onPress(this, code => { if (isConfirm(code)) go(); });
    this.input.once('pointerdown', go);
  }
}
