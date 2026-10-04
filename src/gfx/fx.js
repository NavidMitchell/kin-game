// Particle bursts, floating score popups and per-pit steam, on top of Phaser's particle emitters.
import { DEPTH, HUD_FONT } from '../config.js';
import { hexNum } from './draw.js';

export class Fx {
  constructor(scene) {
    this.scene = scene;
    this.bursts = new Map();
    this.platformPlume = scene.add.particles(0, 0, 'puff', {
      emitting: false, lifespan: { min: 240, max: 430 },
      speedX: { min: -9, max: 9 }, speedY: { min: 65, max: 110 },
      scale: { start: .13, end: .48 },
      alpha: { onEmit: () => 0, onUpdate: (p, k, t) => Math.sin(t * Math.PI) * .32 },
      tint: hexNum(scene.color), blendMode: 'ADD', maxParticles: 160,
    }).setDepth(DEPTH.plat - .1);
    this.platformSparks = scene.add.particles(0, 0, 'glow', {
      emitting: false, lifespan: { min: 180, max: 350 },
      speedX: { min: -12, max: 12 }, speedY: { min: 100, max: 160 },
      scale: { start: .07, end: 0 }, alpha: { start: .6, end: 0 },
      tint: [hexNum(scene.color), 0xe9fdff], blendMode: 'ADD', maxParticles: 100,
    }).setDepth(DEPTH.plat - .1);
    this.ventSources = [];
    this.ventSteam = scene.add.particles(0, 0, 'puff', {
      emitting: false, lifespan: { min: 1000, max: 1700 },
      speedX: { min: -9, max: 9 }, speedY: { min: -38, max: -22 },
      scale: { start: .12, end: .6 }, tint: 0xb9d0d6,
      alpha: { onEmit: () => 0, onUpdate: (p, k, t) => Math.sin(t * Math.PI) * .18 },
      maxParticles: 100,
    }).setDepth(DEPTH.plat + .5);

  }

  createChipPlasma(x, y) {
    // Emitter-local particles inherit the chip's bob, including already-live wisps.
    return this.scene.add.particles(x, y, 'puff', {
      emitting: false, lifespan: { min: 600, max: 1000 },
      speedX: { min: -3, max: 3 }, speedY: { min: -4, max: 1 },
      scale: { start: .2, end: .55 },
      alpha: { onEmit: () => 0, onUpdate: (p, k, t) => Math.sin(t * Math.PI) * .34 },
      tint: [0x35e9ff, 0x8bf3ff], blendMode: 'ADD', maxParticles: 28,
    }).setDepth(DEPTH.pickup + .1);
  }

  updatePickupPlasma(pickup, dt, width, offsetY = 0) {
    const y = pickup.img.y + offsetY, emitter = pickup.plasma;
    // Move the emitter itself: every live particle follows the exact same bob.
    emitter.setPosition(pickup.img.x, y);
    pickup.plasmaT -= dt;
    const view = this.scene.cameras.main.worldView;
    if (pickup.plasmaT > 0 || pickup.img.x < view.x - 40 || pickup.img.x > view.right + 40
      || y < view.y - 40 || y > view.bottom + 40) return;
    pickup.plasmaT = .08;
    // Wisps emerge along the edges, not in an orbit or a detached background halo.
    for (const side of [-1, 1]) {
      emitter.emitParticleAt(side * width * (.3 + Math.random() * .2),
        (Math.random() - .5) * 20, 1);
    }
  }

  platformExhaust(x, y) {
    this.platformPlume.emitParticleAt(x + (Math.random() - .5) * 4, y, 1);
    if (Math.random() < .4) this.platformSparks.emitParticleAt(x, y + 3, 1);
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
