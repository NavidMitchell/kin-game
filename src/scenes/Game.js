// One level: builds the world from its Tiled map, runs combat, pickups, checkpoints and the exit gate.
import Phaser from 'phaser';
import { W, H, DEPTH, JUMP_V, MAX_HP, INVULN, SHOT_SPEED, LASER_SPEED, HUD_FONT } from '../config.js';
import { LEVELS } from '../levels/index.js';
import { findPits } from '../levels/parse.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Fx } from '../gfx/fx.js';
import { groundTop, floatPlat, pitShaft, exitGate, beacon, setAnchoredFrame, GTOP_H, GTOP_PAD, FLOAT_H, FLOAT_PAD } from '../gfx/textures.js';
import { hexNum } from '../gfx/draw.js';
import { SFX, sfxTick, thruster } from '../audio/sfx.js';
import { musicMode, musicSetLevel } from '../audio/music.js';
import { onPress, isJump, isShoot, isBack } from '../controls.js';
import { save } from '../save.js';

const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const BOOST_RESPAWN = 5;

export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  // data: { level: index, checkpoint: index or -1, snapshot: stats at that checkpoint }
  init(data) {
    this.levelIndex = data.level ?? 0;
    this.cpIndex = data.checkpoint ?? -1;
    this.snapshot = data.snapshot || null;
    this.cpSnapshot = this.snapshot;
  }

  create() {
    const L = this.level = { ...LEVELS[this.levelIndex], ceiling: 80 };
    this.color = L.color;
    this.mode = 'play';
    this.hp = MAX_HP; this.lifeLostT = 0;
    this.stats = this.snapshot ? { ...this.snapshot } : { score: 0, chips: 0, kills: 0, time: 0, hits: 0 };
    this.chipsTotal = L.chips.length; this.dronesTotal = L.enemies.length;
    this.fx = new Fx(this);
    musicSetLevel(L.bpm, L.transpose); musicMode('play');

    this.physics.world.setBounds(0, -2000, L.width, L.height + 4000, true, true, false, false);
    this.cameras.main.setBounds(0, 0, L.width, L.height);
    this.buildBackground();
    this.buildTerrain();
    this.buildPits();
    this.buildProps();

    const cp = this.cpIndex >= 0 ? L.checkpoints[this.cpIndex] : null;
    const spawn = cp || L.start;
    this.player = new Player(this, spawn.x, spawn.y);
    this.lastSafe = { x: spawn.x, y: spawn.y };
    this.physics.add.collider(this.player.zone, this.solidGroup, (pz, z) => { if (pz.body.touching.down) this.player.standingOn = z.plat; });
    this.physics.add.collider(this.player.zone, this.floatGroup, (pz, z) => { if (pz.body.touching.down) this.player.standingOn = z.plat; });
    this.physics.add.collider(this.player.zone, this.moverGroup, (pz, m) => { if (pz.body.touching.down) this.player.standingOn = m.plat; });
    if (cp) this.skipToCheckpoint(cp);

    const cam = this.cameras.main;
    this.camX = Phaser.Math.Clamp(spawn.x - W * .38, 0, L.width - W);
    this.camY = Phaser.Math.Clamp(spawn.y - H * .68, 0, L.height - H);
    cam.setScroll(this.camX, this.camY);

    onPress(this, code => {
      if (this.mode !== 'play') return;
      if (isJump(code)) this.player.pressJump();
      if (isShoot(code)) this.player.pressShoot();
      if (isBack(code)) this.pause();
    });
    this.events.once('shutdown', () => { thruster(0); this.player.destroy(); });

    if (this.scene.isActive('HUD')) this.scene.stop('HUD');
    this.scene.launch('HUD');
    this.time.delayedCall(250, () => this.events.emit('banner', cp ? 'CHECKPOINT' : `LEVEL ${L.id}`, cp ? L.name.toUpperCase() : L.name.toUpperCase()));
  }

  // ---------------------------------------------------------------- world building
  buildBackground() {
    const city = this.textures.get('city').getSourceImage(), s = H / city.height;
    const tint = hexNum(this.level.bgTint);
    this.bgFar = this.add.tileSprite(0, -40, W, H, 'city').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.bg).setAlpha(.55).setTint(tint);
    this.bgNear = this.add.tileSprite(0, 0, W, H, 'city').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.bg).setTint(tint);
    for (const t of [this.bgFar, this.bgNear]) {
      t.setTileScale(s, s);
      if (this.level.bgHue) {   // shift the red city towards the level's colour
        const cm = t.enableFilters().filters.internal.addColorMatrix();
        cm.colorMatrix.hue(this.level.bgHue);
      }
    }
    this.bgScale = s;
    this.add.image(0, 0, 'fog').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.fog);
  }

  buildTerrain() {
    const L = this.level, c = this.color;
    this.solidGroup = this.physics.add.staticGroup();
    this.floatGroup = this.physics.add.staticGroup();
    this.moverGroup = this.physics.add.group({ allowGravity: false, immovable: true, frictionX: 1 });   // frictionX 1: riders move with the lift
    this.solids = L.solids; this.movers = [];

    for (const s of L.solids) {
      const z = this.add.zone(s.x + s.w / 2, s.y + s.h / 2, s.w, s.h);
      z.plat = { solid: s };
      this.solidGroup.add(z);
      const topH = Math.min(GTOP_H, s.h);
      this.add.tileSprite(s.x, s.y - GTOP_PAD, s.w, topH + GTOP_PAD, groundTop(this, c)).setOrigin(0).setDepth(DEPTH.plat).setTilePosition(s.x % 120, 0);
      if (s.h > GTOP_H) this.add.rectangle(s.x, s.y + GTOP_H, s.w, s.h - GTOP_H, 0x0b0a10).setOrigin(0).setDepth(DEPTH.plat);
      if (s.y + s.h < L.height - 1) {   // floating block: outline its sides and underside
        this.add.rectangle(s.x, s.y, s.w, s.h).setOrigin(0).setStrokeStyle(1.5, hexNum(c), .35).setDepth(DEPTH.plat);
        this.add.rectangle(s.x + 6, s.y + s.h - 4, s.w - 12, 2, hexNum(c), .3).setOrigin(0).setDepth(DEPTH.plat);
      }
    }
    for (const f of L.floats) {
      const z = this.add.zone(f.x + f.w / 2, f.y + FLOAT_H / 2, f.w, FLOAT_H);
      z.plat = { float: f };
      this.floatGroup.add(z);
      oneWay(z.body);
      this.add.image(f.x - FLOAT_PAD, f.y - FLOAT_PAD, floatPlat(this, f.w, c)).setOrigin(0).setDepth(DEPTH.plat);
    }
    for (const m of L.movers) {
      const img = this.add.image(m.x - FLOAT_PAD, m.y - FLOAT_PAD, floatPlat(this, m.w, c, true)).setOrigin(0).setDepth(DEPTH.plat);
      this.moverGroup.add(img);
      img.body.setSize(m.w, FLOAT_H).setOffset(FLOAT_PAD, FLOAT_PAD);
      oneWay(img.body);
      img.plat = { mover: img };
      img.def = m;
      this.movers.push(img);
    }
    this.moverT = 0;
    this.placeMovers(0, true);
  }

  // movers ease back and forth between their start and start + (dx, dy)
  moverPos(m, t) {
    const k = .5 - .5 * Math.cos((t / m.period + m.phase) * Math.PI * 2);
    return [m.x + m.dx * k, m.y + m.dy * k];
  }
  placeMovers(dt, snap = false) {
    this.moverT += dt;
    for (const img of this.movers) {
      const [tx, ty] = this.moverPos(img.def, this.moverT + (snap ? 0 : dt));
      if (snap || dt <= 0) { img.body.reset(tx - FLOAT_PAD, ty - FLOAT_PAD); img.body.setVelocity(0, 0); continue; }
      img.body.setVelocity((tx - img.body.x) / dt, (ty - img.body.y) / dt);
    }
  }

  buildPits() {
    const L = this.level;
    this.pits = findPits(L);
    for (const p of this.pits) {
      // in tall levels the rim can be far above the bottom: keep the glow near the bottom of the pit
      const rim = Math.max(p.top, L.height - 250);
      const top = Math.max(p.top - 170, L.height - 420), h = L.height - top + 2, w = p.x1 - p.x0;
      const img = this.add.image(p.x0 - 12, top, pitShaft(this, w, h, Math.round(rim - top), this.color)).setOrigin(0).setDepth(DEPTH.shaft).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: img, alpha: { from: 1, to: .7 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: Math.random() * 1000 });
      this.fx.steam(p.x0, p.x1, rim, L.height);
    }
  }

  buildProps() {
    const L = this.level, c = this.color;
    // exit gate
    const ex = L.exit;
    this.add.image(ex.x, ex.y, exitGate(this, c)).setOrigin(.5, 210 / 230).setDepth(DEPTH.deco);
    const field = this.add.image(ex.x, ex.y, 'gate-field' + c).setOrigin(.5, 1).setDepth(DEPTH.deco).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: field, alpha: { from: .55, to: 1 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.add.particles(ex.x, ex.y, 'px', {
      x: { min: -50, max: 50 }, speedY: { min: -120, max: -60 }, lifespan: 1600, frequency: 60, scale: { min: .5, max: 1 },
      tint: [hexNum(c), 0xffffff], alpha: { start: .9, end: 0 },
    }).setDepth(DEPTH.deco);
    this.exitZone = { x: ex.x - 46, y: ex.y - 190, w: 92, h: 200 };

    // checkpoints
    this.beacons = L.checkpoints.map((cp, i) => {
      const on = i <= this.cpIndex;
      const img = this.add.image(cp.x, cp.y, beacon(this, on)).setOrigin(.5, 136 / 150).setDepth(DEPTH.deco);
      return { ...cp, i, on, img };
    });
    beacon(this, true);

    // hints
    for (const h of L.hints) {
      this.add.text(h.x, h.y, h.text, {
        fontFamily: HUD_FONT, fontSize: '17px', fontStyle: '600', color: '#e9fdff', align: 'center',
        backgroundColor: 'rgba(6,9,20,.62)', padding: { x: 12, y: 6 },
      }).setOrigin(.5, 1).setDepth(DEPTH.deco).setLetterSpacing(1.5).setShadow(0, 0, c, 8, false, true);
    }

    // enemies and pickups
    this.enemies = L.enemies.map(e => new Enemy(this, e));
    this.chips = L.chips.map(ch => ({ ...ch, t: Math.random() * 6, img: this.add.image(ch.x, ch.y, 'chip').setDepth(DEPTH.pickup) }));
    this.boosts = L.boosts.map(b => {
      const img = this.add.image(b.x, b.y, b.type).setOrigin(.5, 80 / 102).setDepth(DEPTH.pickup);
      const core = b.type === 'egg' ? this.add.image(b.x, b.y - 30, 'egg-core').setDepth(DEPTH.pickup) : null;
      return { ...b, t: Math.random() * 6, img, core, respawn: 0 };
    });
    this.repairs = L.repairs.map(r => {
      const img = this.add.image(r.x, r.y - 40, 'repair').setDepth(DEPTH.pickup);
      return { ...r, t: Math.random() * 6, img, got: false };
    });
    this.shots = []; this.lasers = [];
  }

  // restarting at a checkpoint: everything behind it counts as already passed
  skipToCheckpoint(cp) {
    const behind = x => x < cp.x - 40;
    for (const e of this.enemies) if (behind(e.x)) e.destroy();
    this.enemies = this.enemies.filter(e => !e.gone);
    for (const c of this.chips) if (behind(c.x)) { c.img.destroy(); c.got = true; }
    this.chips = this.chips.filter(c => !c.got);
  }

  // ---------------------------------------------------------------- actions
  fireShot(x, y, face) {
    const img = this.add.image(x, y, 'orb', 'proj0').setDepth(DEPTH.shot).setScale(face, 1);
    setAnchoredFrame(img, 'orb', 'proj0');
    this.shots.push({ x, y, vx: face * SHOT_SPEED, life: 1.2, img });
    SFX.shoot(); this.fx.puff(x, y, 6, '#ff7ad9', 120);
  }

  fireLaser(x, y, face) {
    this.lasers.push({ x, y, vx: face * LASER_SPEED, life: 1.6, img: this.add.image(x, y, 'laser').setDepth(DEPTH.shot) });
    SFX.laser();
  }

  addScore(n, x, y, text, color, size) {
    this.stats.score += n;
    if (text) this.fx.pop(x, y, text, color, size);
  }

  killEnemy(e) {
    e.kill();
    this.stats.kills++;
    const top = e.top();
    this.addScore(100, e.x, top - 10, '+100', '#ff6a8a', 15);
    SFX.hitE(); this.shake(.35);
    this.fx.puff(e.x, top + e.h / 2, 16, '#ff2d55', 300); this.fx.puff(e.x, top + e.h / 2, 8, '#ffd1dc', 200);
  }

  shake(s) { this.cameras.main.shake(s * 600, s * 18 / W * .7); }

  hurt(fell, dir = 0) {
    const p = this.player;
    this.hp--; this.stats.hits++; this.lifeLostT = .8;
    SFX.hurt(); this.shake(.6); this.events.emit('flash');
    p.loseJet();
    if (this.hp <= 0) { this.gameOver(); return; }
    if (fell) {
      p.teleport(this.lastSafe.x, this.lastSafe.y);
      this.camX = Phaser.Math.Clamp(this.lastSafe.x - W * .38, 0, this.level.width - W);
    } else {
      p.body.setVelocity(dir * 420, -500);
    }
    p.inv = INVULN; p.state = 'jump';
  }

  gameOver() {
    this.mode = 'over';
    const p = this.player; p.frozen = true; p.hidden = true; p.exhaust.emitting = false;
    p.body.setVelocity(0, 0); p.body.setAllowGravity(false); thruster(0);
    this.fx.puff(p.x, p.y - 50, 30, '#ff2d55', 340); this.fx.puff(p.x, p.y - 50, 14, '#ffffff', 220);
    musicMode('duck');
    this.time.delayedCall(700, () => this.scene.launch('Result', { kind: 'over', level: this.levelIndex, checkpoint: this.cpIndex, snapshot: this.cpSnapshot || null, stats: { ...this.stats } }));
  }

  reachExit() {
    this.mode = 'clear';
    const p = this.player, L = this.level;
    p.frozen = true; p.loseJet(); thruster(0);
    SFX.warp();
    this.tweens.add({ targets: [p.sprite, p.pack], alpha: 0, scaleY: 1.6, duration: 650, ease: 'Cubic.in', onComplete: () => { p.hidden = true; } });
    this.fx.puff(L.exit.x, L.exit.y - 60, 30, this.color, 320); this.fx.puff(L.exit.x, L.exit.y - 60, 14, '#ffffff', 200);
    const st = this.stats;
    const bonus = {
      time: Math.max(0, Math.round(L.par - st.time)) * 10,
      chips: st.chips >= this.chipsTotal && this.chipsTotal > 0 ? 500 : 0,
      perfect: st.hits === 0 ? 500 : 0,
    };
    const total = st.score + bonus.time + bonus.chips + bonus.perfect;
    const prevBest = save.best(L.id);
    const isBest = save.complete(L.id, total, LEVELS.length);
    musicMode('duck');
    this.time.delayedCall(900, () => {
      SFX.clear();
      this.scene.launch('Result', {
        kind: this.levelIndex === LEVELS.length - 1 ? 'victory' : 'clear', level: this.levelIndex,
        stats: { ...st }, bonus, total, isBest, prevBest, chipsTotal: this.chipsTotal, dronesTotal: this.dronesTotal,
      });
    });
  }

  pause() {
    if (this.mode !== 'play') return;
    this.mode = 'paused'; this.physics.pause(); this.tweens.pauseAll(); thruster(0);
    musicMode('duck');
    this.scene.launch('Result', { kind: 'pause', level: this.levelIndex });
  }

  resume() {
    this.mode = 'play'; this.physics.resume(); this.tweens.resumeAll(); musicMode('play');
  }

  // ---------------------------------------------------------------- loop
  update(time, delta) {
    const dt = Math.min(.05, delta / 1000);
    sfxTick(dt);
    if (this.mode === 'paused') return;
    this.lifeLostT -= dt;
    const L = this.level, p = this.player, cam = this.cameras.main;
    this.placeMovers(dt);
    p.update(dt);
    if (this.mode === 'play') this.stats.time += dt;

    // camera: look ahead in the facing direction, follow vertically in tall levels
    if (this.mode !== 'over') {
      this.camX += ((p.x + p.face * 120 - W * .38) - this.camX) * Math.min(1, dt * 4);
      this.camY += ((p.y - H * .68) - this.camY) * Math.min(1, dt * (p.ground ? 4 : 2.5));
      this.camX = Phaser.Math.Clamp(this.camX, 0, L.width - W);
      this.camY = Phaser.Math.Clamp(this.camY, 0, L.height - H);
      cam.setScroll(this.camX, this.camY);
    }
    this.bgNear.tilePositionX = cam.scrollX * .4 / this.bgScale;
    this.bgFar.tilePositionX = cam.scrollX * .15 / this.bgScale;

    // last safe spot on solid ground (respawn point after a fall)
    const on = p.standingOn?.solid;
    if (p.ground && on && p.x > on.x + 50 && p.x < on.x + on.w - 50) this.lastSafe = { x: p.x, y: on.y };

    this.updateShots(dt, cam);
    for (const e of this.enemies) e.update(dt, p, cam);
    if (this.mode === 'play') this.enemyContacts();
    this.enemies = this.enemies.filter(e => !e.gone);
    this.updateLasers(dt, cam);
    this.updatePickups(dt);
    if (this.mode !== 'play') return;

    // checkpoints
    for (const b of this.beacons) {
      if (!b.on && p.x >= b.x && Math.abs(p.y - b.y) < 220) {
        b.on = true; b.img.setTexture('beacon-on'); this.cpIndex = Math.max(this.cpIndex, b.i);
        this.cpSnapshot = { ...this.stats };
        this.lastSafe = { x: b.x, y: b.y };
        SFX.checkpoint(); this.fx.puff(b.x, b.y - 112, 18, '#35e9ff', 220);
        this.events.emit('banner', 'CHECKPOINT', 'PROGRESS SAVED');
      }
    }
    // exit
    const hb = p.hurtbox();
    if (overlap(hb, this.exitZone)) { this.reachExit(); return; }
    // fell into a pit
    if (p.y > L.height + 120) this.hurt(true);
  }

  updateShots(dt, cam) {
    for (const s of this.shots) {
      s.life -= dt; s.x += s.vx * dt;
      if (this.solids.some(r => s.x > r.x && s.x < r.x + r.w && s.y > r.y && s.y < r.y + r.h)) { s.life = 0; this.fx.puff(s.x, s.y, 8, '#ff7ad9', 160); }
      s.img.setPosition(s.x, s.y).setAlpha(Math.min(1, s.life * 3));
    }
    for (const s of this.shots) if (s.life <= 0 || s.x < cam.scrollX - 120 || s.x > cam.scrollX + W + 120) { s.img.destroy(); s.dead = true; }
    this.shots = this.shots.filter(s => !s.dead);
  }

  enemyContacts() {
    const p = this.player, pb = p.hurtbox();
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const box = e.box();
      const shot = this.shots.find(s => s.life > 0 && overlap({ x: s.x - 24, y: s.y - 14, w: 48, h: 28 }, box));
      if (shot) { shot.life = 0; this.killEnemy(e); continue; }
      if (overlap(pb, box)) {
        if (p.vy > 200 && p.y - 20 < box.y + box.h * .6) { this.killEnemy(e); p.body.setVelocityY(JUMP_V * .6); SFX.stomp(); }
        else if (p.inv <= 0) { this.hurt(false, e.x < p.x ? 1 : -1); if (this.mode !== 'play') return; }
      }
    }
  }

  updateLasers(dt, cam) {
    const p = this.player, pb = p.hurtbox();
    for (const l of this.lasers) {
      l.life -= dt; l.x += l.vx * dt;
      if (this.solids.some(r => l.x > r.x && l.x < r.x + r.w && l.y > r.y && l.y < r.y + r.h)) { l.life = 0; this.fx.puff(l.x, l.y, 6, '#ff2d55', 140); }
      if (l.life > 0 && this.mode === 'play' && overlap(pb, { x: l.x - 22, y: l.y - 3, w: 44, h: 6 })) {
        l.life = 0; this.fx.puff(l.x, l.y, 10, '#ff2d55', 200);
        if (p.inv <= 0) this.hurt(false, l.vx < 0 ? -1 : 1);
      }
      // shots knock enemy lasers out of the air
      for (const s of this.shots) if (s.life > 0 && l.life > 0 && Math.abs(l.x - s.x) < 40 && Math.abs(l.y - s.y) < 30) { l.life = 0; s.life = 0; this.fx.puff(s.x, s.y, 10, '#ff7ad9', 220); }
      l.img.setPosition(l.x, l.y);
    }
    for (const l of this.lasers) if (l.life <= 0 || l.x < cam.scrollX - 100 || l.x > cam.scrollX + W + 100) { l.img.destroy(); l.dead = true; }
    this.lasers = this.lasers.filter(l => !l.dead);
  }

  updatePickups(dt) {
    const p = this.player, playing = this.mode === 'play';
    for (const c of this.chips) {
      c.t += dt;
      c.img.setPosition(c.x, c.y + Math.sin(c.t * 3) * 4).setScale(Math.abs(Math.cos(c.t * 2.2)) * .9 + .1, 1);
      if (playing && Math.hypot(c.x - p.x, c.y - (p.y - 50)) < 11 + 34) {
        c.got = true; c.img.destroy(); this.stats.chips++;
        this.addScore(10, c.x, c.y - 10, '+10', '#35e9ff', 12);
        SFX.chip(); this.fx.puff(c.x, c.y, 8, '#35e9ff', 160);
      }
    }
    this.chips = this.chips.filter(c => !c.got);

    for (const b of this.boosts) {
      b.t += dt;
      if (b.respawn > 0) {
        b.respawn -= dt;
        if (b.respawn <= 0) { b.img.setVisible(true); b.core?.setVisible(true); this.fx.puff(b.x, b.y - 30, 12, '#35e9ff', 160); }
        continue;
      }
      const y = b.y + Math.sin(b.t * 2.5) * 3;
      b.img.setY(y);
      if (b.core) b.core.setY(y - 30).setAlpha(.6 + Math.sin(b.t * 4) * .4);
      if (playing && !p.jet && Math.abs(b.x - p.x) < 40 && Math.abs((b.y - 30) - (p.y - 50)) < 70) {
        p.jet = true; b.respawn = BOOST_RESPAWN; b.img.setVisible(false); b.core?.setVisible(false);
        this.addScore(50, b.x, b.y - 60, '+50  JET', '#35e9ff', 14);
        SFX.jet(); this.shake(.25);
        this.fx.puff(b.x, b.y - 30, 26, '#35e9ff', 300); this.fx.puff(b.x, b.y - 30, 10, '#ffffff', 180);
        this.events.emit('banner', 'JET ONLINE', 'HOLD JUMP TO FLY');
      }
    }

    for (const r of this.repairs) {
      if (r.got) continue;
      r.t += dt;
      r.img.setY(r.y - 40 + Math.sin(r.t * 2.5) * 4).setAngle(Math.sin(r.t * 1.5) * 8);
      if (playing && this.hp < MAX_HP && Math.abs(r.x - p.x) < 40 && Math.abs((r.y - 40) - (p.y - 50)) < 70) {
        r.got = true; r.img.destroy(); this.hp++;
        this.fx.pop(r.x, r.y - 60, '+1 CORE', '#35e9ff', 14);
        SFX.repair(); this.fx.puff(r.x, r.y - 40, 18, '#35e9ff', 220);
      }
    }
  }

  // HUD helpers
  progress() {
    const L = this.level;
    return Phaser.Math.Clamp((this.player.x - L.start.x) / (L.exit.x - L.start.x), 0, 1);
  }
}

function oneWay(body) {
  body.checkCollision.down = false; body.checkCollision.left = false; body.checkCollision.right = false;
}

