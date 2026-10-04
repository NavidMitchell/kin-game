// Particle bursts, floating score popups and per-pit steam, on top of Phaser's particle emitters.
import { DEPTH, HUD_FONT } from '../config.js';
import { hexNum } from './draw.js';

export class Fx {
  constructor(scene) {
    this.scene = scene;
    this.bursts = new Map();
    this.ventSources = [];
    this.ventSteam = scene.add.particles(0, 0, 'puff', {
      emitting: false, lifespan: { min: 1000, max: 1700 },
      speedX: { min: -9, max: 9 }, speedY: { min: -38, max: -22 },
      scale: { start: .12, end: .6 }, tint: 0xb9d0d6,
      alpha: { onEmit: () => 0, onUpdate: (p, k, t) => Math.sin(t * Math.PI) * .18 },
      maxParticles: 100,
    }).setDepth(DEPTH.plat + .5);
    // Overlapping soft wisps swell and fade into a luminous cloud behind each chip.
    this.chipCloud = scene.add.particles(0, 0, 'puff', {
      emitting: false, lifespan: { min: 900, max: 1400 },
      speedX: { min: -3, max: 3 }, speedY: { min: -5, max: 2 },
      scale: { start: .3, end: .75 },
      alpha: { onEmit: () => 0, onUpdate: (p, k, t) => Math.sin(t * Math.PI) * .24 },
      tint: [0x35e9ff, 0x72eaff, 0xaff6ff], blendMode: 'ADD',
      maxParticles: 300,
    }).setDepth(DEPTH.pickup - .1);
  }

  addCoolingVent(x, y) {
    this.ventSources.push({ x, y, timer: Math.random() * 2 });
  }

  updateCoolingVents(dt, view) {
    for (const vent of this.ventSources) {
      vent.timer -= dt;
      if (vent.timer > 0) continue;
      vent.timer = 1.4 + Math.random() * 2;
      if (vent.x < view.x - 40 || vent.x > view.right + 40
        || vent.y < view.y - 20 || vent.y > view.bottom + 80) continue;
      this.ventSteam.emitParticleAt(vent.x, vent.y, 4);
    }
  }

  chipPlasma(x, y) {
    // Small random offsets fill the centre instead of tracing a ring or orbit.
    for (let i = 0; i < 2; i++) {
      this.chipCloud.emitParticleAt(x + (Math.random() - .5) * 14, y + (Math.random() - .5) * 12, 1);
    }
  }

  // Square debris burst, like the original puff(): random directions, slight upward kick, gravity.
  puff(x, y, n, color, spd = 260) {
    const key = color + '|' + spd;
    let em = this.bursts.get(key);
    if (!em) {
      em = this.scene.add.particles(0, 0, 'px', {
        emitting: false, lifespan: { min: 300, max: 800 }, speed: { min: 0, max: spd }, angle: { min: 0, max: 360 },
        gravityY: 900, accelerationY: 0, scale: { min: .5, max: 1.5 }, tint: hexNum(color),
        alpha: { onEmit: () => 1, onUpdate: (p, k, t) => Math.min(1, (1 - t) * 2) },
      }).setDepth(DEPTH.fx);
      this.bursts.set(key, em);
    }
    em.explode(n, x, y - 10);
  }

  pop(x, y, text, color, size) {
    const t = this.scene.add.text(x, y, text, {
      fontFamily: HUD_FONT, fontSize: size + 'px', fontStyle: '700', color,
    }).setOrigin(.5, 1).setDepth(DEPTH.pop).setLetterSpacing(1).setShadow(0, 0, color, 10, false, true);
    t.setScale(1.45);
    this.scene.tweens.add({ targets: t, scale: 1, duration: 150 });
    this.scene.tweens.add({ targets: t, y: y - 40, duration: 1000 });
    this.scene.tweens.add({ targets: t, alpha: 0, delay: 500, duration: 500, onComplete: () => t.destroy() });
  }

  // rising steam over a pit (x0..x1), emitted from below the rim
  steam(x0, x1, rimY, depthY) {
    const w = x1 - x0;
    const em = this.scene.add.particles(0, 0, 'puff', {
      x: { min: x0 + 8, max: x1 - 8 }, y: { min: rimY + 70, max: Math.min(depthY, rimY + 150) },
      lifespan: { min: 1800, max: 3000 }, speedX: { min: -10, max: 10 }, speedY: { min: -100, max: -60 },
      scale: { start: .35, end: .9 }, frequency: 1000 / Math.max(170, Math.min(w, 420)) / .045,
      alpha: { onEmit: () => 0, onUpdate: (p, k, t) => Math.sin(t * Math.PI) * .11 },
    }).setDepth(DEPTH.steam);
    return em;
  }
}
