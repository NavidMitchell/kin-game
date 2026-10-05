// Drones (hover high, fire lasers when you are level with them) and skimmers (fast, at ground level).
// Both patrol between minX and maxX. Same behaviour and hitboxes as the canvas build.
import { DEPTH, SHOOT_TIME, SHOOT_FIRE, W } from '../config.js';
import { setAnchoredFrame } from '../gfx/textures.js';
import { enemyHealth, takeEnemyHit } from './enemy-health.js';
import { SFX } from '../audio/sfx.js';

const rnd = (a, b) => a + Math.random() * (b - a);

export class Enemy {
  constructor(scene, { type, x, y, range }) {
    const d = Math.random() < .5 ? -1 : 1;
    Object.assign(this, {
      scene, type, x, y, hp: enemyHealth(type), hitT: 0, w: 70, h: 44, face: d, vx: d * (type === 'drone' ? 90 : 130),
      minX: x - range, maxX: x + range, alive: true, t: Math.random() * 6, dieT: 0, shootT: 0, cool: rnd(1, 3),
      warned: false, fired: false, gone: false, lookT: rnd(.5, 2),
    });
    this.sprite = scene.add.sprite(x, y, 'drone', 'hover0').setDepth(DEPTH.enemy);
    this.render();
  }

  top() { return this.type === 'drone' ? this.y - 118 + Math.sin(this.t * 2.5) * 12 : this.y - this.h - 12 + Math.sin(this.t * 4) * 5; }
  box() { return { x: this.x - this.w / 2, y: this.top(), w: this.w, h: this.h }; }

  update(dt, player, cam) {
    this.t += dt;
    this.hitT = Math.max(0, this.hitT - dt);
    if (!this.alive) { this.dieT += dt; if (this.dieT > .55) this.destroy(); else this.render(); return; }
    const onScreen = this.x > cam.scrollX - 100 && this.x < cam.scrollX + W + 100;
    if (!this.warned && Math.abs(this.x - player.x) < W * .62 && onScreen) { this.warned = true; (this.type === 'drone' ? SFX.droneNear : SFX.skimmerNear)(); }
    const ey = this.top();
    // laser attack (drones): face the player, charge, fire
    if (this.shootT > 0) {
      this.shootT += dt;
      if (!this.fired && this.shootT >= SHOOT_FIRE) { this.fired = true; this.scene.fireLaser(this.x + this.face * 34, ey + this.h * .55, this.face); }
      if (this.shootT >= SHOOT_TIME) this.shootT = 0;
    } else {
      if (this.maxX - this.minX < 2) {
        // stationary (range 0): hold position and scan back and forth, as if searching for the player.
        // (Patrolling a zero-width range would flip direction every frame instead.)
        this.lookT -= dt;
        if (this.lookT <= 0) { this.face = -this.face; this.lookT = rnd(1.2, 2.2); }
      } else {
        this.x += this.vx * dt;
        if (this.x < this.minX) { this.x = this.minX; this.vx = Math.abs(this.vx); }
        if (this.x > this.maxX) { this.x = this.maxX; this.vx = -Math.abs(this.vx); }
        this.face = this.vx < 0 ? -1 : 1;
      }
      this.cool -= dt;
      if (this.type === 'drone' && this.cool <= 0 && onScreen && !player.frozen) {
        const dx = player.x - this.x, dy = (player.y - 50) - (ey + this.h * .5);
        if (Math.abs(dx) < 560 && Math.abs(dx) > 60 && Math.abs(dy) < 90) {
          this.shootT = .001; this.fired = false; this.face = dx < 0 ? -1 : 1; this.cool = rnd(2.2, 3.6); SFX.laserCharge();
        }
      }
    }
    this.render();
  }

  render() {
    let f;
    if (!this.alive) f = 'death' + Math.min(3, Math.floor(this.dieT / .55 * 4));
    else if (this.shootT > 0) f = 'shoot' + Math.min(3, Math.floor(this.shootT / SHOOT_TIME * 4));
    else if (this.type === 'skimmer') f = 'dash' + Math.floor(this.t * 14) % 6;
    else f = 'hover' + Math.floor(this.t * 7) % 4;
    setAnchoredFrame(this.sprite, 'drone', f);
    this.sprite.setPosition(this.x, this.top() + this.h / 2).setScale(this.face, 1);
    if (this.hitT > 0) this.sprite.setTintFill(0xffb5c8); else this.sprite.clearTint();
    this.sprite.setAlpha(this.alive ? 1 : 1 - Math.max(0, (this.dieT - .4) / .15));
  }

  hit() {
    const destroyed = takeEnemyHit(this);
    if (!destroyed) this.hitT = .12;
    return destroyed;
  }

  kill() {
    this.alive = false; this.dieT = 0; this.shootT = 0;
  }

  destroy() { this.gone = true; this.sprite.destroy(); }
}
