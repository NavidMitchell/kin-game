// Opening story: six illustrated slides shown after the title screen, before level select.
// Space / Enter / click advances, Esc or the SKIP button skips straight to level select.
// The captions are part of the art (assets/story/1-6.webp), so slides can be redrawn independently.
import Phaser from 'phaser';
import { W, H, HUD_FONT, CYAN } from '../config.js';
import { SFX } from '../audio/sfx.js';
import { musicMode } from '../audio/music.js';
import { onPress, isConfirm, isBack, isShoot, releaseAll } from '../controls.js';
import s1 from '../../assets/story/1.webp';
import s2 from '../../assets/story/2.webp';
import s3 from '../../assets/story/3.webp';
import s4 from '../../assets/story/4.webp';
import s5 from '../../assets/story/5.webp';
import s6 from '../../assets/story/6.webp';

const SLIDES = [s1, s2, s3, s4, s5, s6];
const AUTO_ADVANCE = 7000;   // ms per slide; the last one waits for the player
const FADE = 600;

export class StoryScene extends Phaser.Scene {
  constructor() { super('Story'); }

  // story art is only needed here, so it loads with this scene rather than delaying the title screen
  preload() {
    const todo = SLIDES.map((url, i) => ['story' + (i + 1), url]).filter(([k]) => !this.textures.exists(k));
    if (!todo.length) return;
    const bar = this.add.rectangle(W / 2 - 150, H / 2, 0, 4, 0x35e9ff).setOrigin(0, .5);
    this.add.rectangle(W / 2, H / 2, 300, 4, 0x35e9ff, .15);
    this.load.on('progress', v => { bar.width = 300 * v; });
    for (const [k, url] of todo) this.load.image(k, url);
  }

  create() {
    musicMode('title');
    this.children.removeAll(true);   // loading bar
    this.index = -1; this.lockUntil = 0; this.leaving = false;
    this.layers = [0, 1].map(() => this.add.image(W / 2, H / 2, 'story1').setAlpha(0));

    // progress dots and skip control, top right (the slide captions sit at the bottom)
    this.dots = SLIDES.map((_, i) => this.add.circle(W - 150 + i * 14, 22, 4, 0xffffff, .3).setDepth(10));
    const skip = this.add.text(W - 16, 22, 'SKIP  ›', { fontFamily: HUD_FONT, fontSize: '15px', fontStyle: '700', color: '#ffffff' })
      .setOrigin(1, .5).setLetterSpacing(3).setPadding(10, 6, 10, 6).setBackgroundColor('rgba(6,9,20,.6)').setDepth(10).setInteractive({ useHandCursor: true });
    skip.on('pointerover', () => skip.setColor(CYAN));
    skip.on('pointerout', () => skip.setColor('#ffffff'));
    skip.on('pointerdown', (p, x, y, e) => { e.stopPropagation(); this.finish(); });
    for (const d of this.dots) d.x -= 70;
    this.hint = this.add.text(16, 22, 'SPACE  next     ESC  skip', { fontFamily: HUD_FONT, fontSize: '13px', fontStyle: '600', color: 'rgba(230,240,250,.75)' })
      .setOrigin(0, .5).setLetterSpacing(1.5).setPadding(10, 6, 10, 6).setBackgroundColor('rgba(6,9,20,.5)').setDepth(10);

    this.input.on('pointerdown', () => this.next());
    onPress(this, code => {
      if (isBack(code) || code === 'KeyS') this.finish();
      else if (isConfirm(code) || isShoot(code) || code === 'ArrowRight' || code === 'KeyD') this.next();
    });
    this.cameras.main.fadeIn(FADE, 0, 0, 0);
    this.show(0);
  }

  show(i) {
    this.index = i;
    this.lockUntil = this.time.now + 350;   // ignore a double press
    const img = this.layers[i % 2], prev = this.layers[(i + 1) % 2];
    const src = this.textures.get('story' + (i + 1)).getSourceImage();
    const cover = Math.max(W / src.width, H / src.height);
    this.tweens.killTweensOf([img, prev]);
    img.setTexture('story' + (i + 1)).setDepth(1).setAlpha(0).setScale(cover).setPosition(W / 2, H / 2);
    prev.setDepth(0);
    this.tweens.add({ targets: img, alpha: 1, duration: FADE });
    if (i > 0) this.tweens.add({ targets: prev, alpha: 0, duration: FADE, delay: FADE / 2 });
    // slow push-in, anchored a little towards the top so the caption stays on screen
    this.tweens.add({ targets: img, scale: cover * 1.05, y: H / 2 + 8, duration: AUTO_ADVANCE + FADE, ease: 'Sine.out' });
    this.dots.forEach((d, k) => d.setFillStyle(k === i ? 0x35e9ff : 0xffffff, k === i ? 1 : k < i ? .6 : .3));
    this.auto?.remove();
    const last = i === SLIDES.length - 1;
    this.hint.setText(last ? 'SPACE  play' : 'SPACE  next     ESC  skip');
    if (!last) this.auto = this.time.delayedCall(AUTO_ADVANCE, () => this.next(true));
  }

  next(auto = false) {
    if (this.leaving || (!auto && this.time.now < this.lockUntil)) return;
    if (!auto) SFX.select();
    if (this.index < SLIDES.length - 1) this.show(this.index + 1); else this.finish();
  }

  finish() {
    if (this.leaving) return;
    this.leaving = true; this.auto?.remove();
    SFX.confirm(); releaseAll();
    this.cameras.main.fadeOut(FADE / 2, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Select'));
  }
}
