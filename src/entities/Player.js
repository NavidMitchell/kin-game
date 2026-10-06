// Kin. The physics body is an invisible Arcade zone (fixed hitbox); the visuals follow its feet.
// Movement rules are the ones from the canvas build: acceleration, coyote time, jump buffering,
// variable jump height, ducking, the charge-and-fire shot and the jet booster.
import {
  RUN, JUMP_V, JET_THRUST, JET_SPEED, MAX_FALL, ACC_GROUND, ACC_AIR, COYOTE, JUMP_BUFFER, ATK_BUFFER,
  PLAYER_W, PLAYER_H, PLAYER_DUCK_H, ATK_TIME, ATK_FIRE, DEPTH,
} from '../config.js';
import { held } from '../controls.js';
import kinMap from '../../assets/player/kin.json';
import { kinFrame } from '../gfx/kin-frames.js';
import { SFX, thruster } from '../audio/sfx.js';

const rnd = (a, b) => a + Math.random() * (b - a);

export class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    this.zone = scene.add.zone(x, y - PLAYER_H / 2, PLAYER_W, PLAYER_H);
    scene.physics.add.existing(this.zone);
    this.body = this.zone.body;
    this.body.setCollideWorldBounds(true).setMaxVelocity(2000, MAX_FALL);

    this.shadow = scene.add.ellipse(x, y + 2, 56, 12, 0x000000, .45).setDepth(DEPTH.player).setVisible(false);
    this.view = scene.add.container(x, y).setDepth(DEPTH.player);
    this.sprite = scene.add.sprite(0, 0, 'kin', kinMap.animations.idle.frames[0])
      .setOrigin(...kinMap.origin).setScale(kinMap.worldScale);
    this.view.add(this.sprite);
    this.exhaust = scene.add.particles(0, 0, 'px', {
      emitting: false, lifespan: { min: 150, max: 350 }, speedY: { min: 220, max: 420 },
      x: { onEmit: () => rnd(-6, 6) }, speedX: { onEmit: () => -this.face * rnd(40, 120) + this.vx * .3 },
      scale: { min: .75, max: 2 }, tint: [0x35e9ff, 0xe9fdff], frequency: 16,
      alpha: { onEmit: () => 1, onUpdate: (p, k, t) => Math.min(1, (1 - t) * 2) },
    }).setDepth(DEPTH.fx);

    Object.assign(this, {
      face: 1, state: 'idle', t: 0, runT: 0, atkHit: false, inv: 0, coyote: 0, landT: 0, airT: 0,
      jet: false, thrust: false, ground: false, jumpBuffer: 0, atkBuffer: 0, standingOn: null, frozen: false, hidden: false,
    });
  }

  get x() { return this.body.center.x; }
  get y() { return this.body.bottom; }   // feet
  get vx() { return this.body.velocity.x; }
  get vy() { return this.body.velocity.y; }
  get ducking() { return this.state === 'duck'; }

  // hitbox used against enemies and lasers (shrinks while ducking)
  hurtbox() {
    const h = this.ducking ? PLAYER_DUCK_H : PLAYER_H;
    return { x: this.body.x, y: this.body.bottom - h, w: PLAYER_W, h };
  }

  pressJump() { this.jumpBuffer = JUMP_BUFFER; }
  pressShoot() { this.atkBuffer = ATK_BUFFER; }

  teleport(x, y) {
    this.body.reset(x, y - PLAYER_H / 2);
    this.body.setVelocity(0, 0);
  }

  update(dt) {
    const b = this.body, scene = this.scene;
    const previousState = this.state, previousFace = this.face;
    this.jumpBuffer -= dt; this.atkBuffer -= dt;
    const wasGround = this.ground;
    this.ground = b.blocked.down || b.touching.down;
    if (!this.ground) this.standingOn = null;
    if (this.frozen) { b.setVelocityX(0); this.ground && b.setVelocityY(0); this.render(dt); return; }

    // --- attack
    if ((this.atkBuffer > 0 || held.shoot()) && this.state !== 'attack') {
      this.atkBuffer = 0;
      this.state = 'attack'; this.t = 0; this.atkHit = false;
    }
    const attacking = this.state === 'attack';

    // --- horizontal movement
    const dir = (held.right() ? 1 : 0) - (held.left() ? 1 : 0);
    const ducking = this.ground && held.down() && !attacking;
    const target = ducking && this.ground ? 0 : dir * RUN;
    const acc = this.ground ? ACC_GROUND : ACC_AIR;
    let vx = b.velocity.x;
    if (vx < target) vx = Math.min(target, vx + acc * dt); else if (vx > target) vx = Math.max(target, vx - acc * dt);
    b.setVelocityX(vx);
    if (dir && !ducking) this.face = dir;

    // --- ride vertical movers down instead of bouncing off them
    if (this.ground && this.standingOn?.mover) {
      const mv = this.standingOn.mover.body.velocity.y;
      if (mv > 0 && b.velocity.y >= 0) b.setVelocityY(mv);
    }

    // --- jump
    this.coyote = this.ground ? COYOTE : this.coyote - dt;
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.jumpBuffer = 0; this.coyote = 0; b.setVelocityY(JUMP_V); this.ground = false; this.standingOn = null;
      SFX.jump(); scene.fx.puff(this.x, this.y, 6, '#35e9ff', 120);
    }
    const wasThrust = this.thrust; this.thrust = false;
    if (this.jet && !this.ground && held.jump()) {   // jet booster: hold jump to fly
      this.thrust = true; if (!wasThrust) SFX.ignite();
      b.setAllowGravity(false);
      b.setVelocityY(Math.max(-JET_SPEED, b.velocity.y - JET_THRUST * dt));
    } else {
      b.setAllowGravity(true);
      if (!held.jump() && b.velocity.y < -300 && !this.jet) b.setVelocityY(-300);   // variable jump height
    }
    if (this.jet && b.top < scene.level.ceiling) { b.y = scene.level.ceiling; b.setVelocityY(Math.max(0, b.velocity.y)); }
    thruster(this.jet ? (this.thrust ? 2 : 1) : 0);

    // --- landing
    if (this.ground && !wasGround) {
      if (this.airT > .12) { this.landT = .12; SFX.land(); }
      this.airT = 0;
    }
    if (!this.ground) this.airT += dt;
    this.landT -= dt; this.inv -= dt; this.t += dt;

    // --- state machine
    if (attacking) {
      if (!this.atkHit && this.t >= ATK_FIRE) { this.atkHit = true; scene.fireShot(this.x + this.face * 46, this.y - 52, this.face); }
      if (this.t > ATK_TIME) this.state = 'idle';
    }
    if (this.state !== 'attack') this.state = !this.ground ? 'jump' : ducking ? 'duck' : Math.abs(b.velocity.x) > 20 ? 'run' : 'idle';
    if (this.state === 'run') {
      if (previousState !== 'run' || previousFace !== this.face) this.runT = 0;
      else this.runT += dt * Math.min(1, Math.abs(this.vx) / RUN);
    }
    this.render(dt);
  }

  frameIndex() {
    return kinFrame(kinMap, { state: this.state, t: this.state === 'run' ? this.runT : this.t, jet: this.jet,
      thrust: this.thrust, vy: this.vy, landT: this.landT });
  }

  // visuals follow the body (called after movement each frame)
  render() {
    const x = this.x, y = this.y;
    this.view.setPosition(x, y).setScale(this.face, 1);
    this.shadow.setPosition(x, y + 2);
    this.sprite.setFrame(this.frameIndex());
    this.view.setVisible(!this.hidden && !(this.inv > 0 && Math.floor(this.inv * 14) % 2 === 0));   // blink while invulnerable
    this.shadow.setVisible(!this.hidden && this.ground);
    this.exhaust.emitting = this.thrust;
    if (this.thrust) this.exhaust.setPosition(x - this.face * 14, y - 8);
  }

  loseJet() {
    if (!this.jet) return;
    this.jet = false; this.thrust = false; this.body.setAllowGravity(true);
    this.scene.fx.puff(this.x, this.y - 50, 30, '#35e9ff', 380); this.scene.fx.puff(this.x, this.y - 50, 12, '#ff2d55', 250);
  }

  destroy() {
    thruster(0);
    this.zone.destroy(); this.view.destroy(); this.shadow.destroy(); this.exhaust.destroy();
  }
}
