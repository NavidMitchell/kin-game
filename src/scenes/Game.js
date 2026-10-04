// One level: builds the world from its Tiled map, runs combat, pickups, checkpoints and the exit gate.
import Phaser from 'phaser';
import chipMap from '../../assets/world/data-chip.json';
import { W, H, DEPTH, JUMP_V, MAX_HP, INVULN, SHOT_SPEED, LASER_SPEED, HUD_FONT } from '../config.js';
import { LEVELS } from '../levels/index.js';
import { findPits } from '../levels/parse.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Fx } from '../gfx/fx.js';
import { pitShaft, wallTrim, setAnchoredFrame } from '../gfx/textures.js';
import { deckTexture, edgeMetrics, propOrigin, FLOAT_H, PLAT_PAD_X, PLAT_PAD_TOP, EGG_CORE_Y, GATE_H, EDGE_LIGHT } from '../gfx/art.js';
import { hexNum } from '../gfx/draw.js';
import { SFX, sfxTick, thruster } from '../audio/sfx.js';
import { musicMode, musicSetLevel } from '../audio/music.js';
import { onPress, isJump, isShoot, isBack } from '../controls.js';
import { save } from '../save.js';

const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const BOOST_RESPAWN = 5;
const CHIP_SCALE = 22 / chipMap.diamondSize;
// assets/towers/*.webp: seamless 1254px facades, 8 storeys per tile, drawn at this scale.
// Measured in the art (texture px): a storey repeats every 156.75px, and each one begins with a lit
// ledge about 25px tall whose top edge first appears at y = 141.
const WALL_SCALE = 0.5;
const TOWER = { storey: 1254 / 4, ledge: 0, firstLedge: 0 };
const ROOF_H = 10;   // neon roof edge above the first ledge
// assets/exit-gates/*.webp: the exit gate, drawn GATE.h world px tall (art.js resamples it to that height). Measured in the art as fractions of the image,
// so a replacement at any resolution still fits: where the base meets the ground, and the open middle
// (including the frame's inner glow) where the portal light goes.
const GATE = { h: GATE_H, ground: .942, open: { x0: .305, x1: .705, y0: .155, y1: .905 } };

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
    const L = this.level, c = this.color, pal = L.palette;
    this.solidGroup = this.physics.add.staticGroup();
    this.floatGroup = this.physics.add.staticGroup();
    this.moverGroup = this.physics.add.group({ allowGravity: false, immovable: true, frictionX: 1 });   // frictionX 1: riders move with the lift
    this.solids = L.solids; this.movers = [];

    // no `wall` map property means no facade: every block gets the plain ground look
    const wallKey = L.wall ? 'cooling-tower' : null;
    // industrial edge strip along the top of solid ground, its walking surface on the collider's top
    const edge = (s, kind) => {
      const key = `edge-${pal}-${kind}`, m = edgeMetrics(this, pal, kind), th = this.textures.get(key).getSourceImage().height;
      this.add.tileSprite(s.x, s.y - m.land, s.w, th, key).setOrigin(0).setDepth(DEPTH.plat).setTilePosition(s.x % m.tileW, 0);   // world-aligned repeats
      // A thin foreground wash lets the surface light catch Kin's feet.
      this.add.tileSprite(s.x, s.y + EDGE_LIGHT.belowSurface - EDGE_LIGHT.height, s.w, EDGE_LIGHT.height, `edge-light-${pal}-${kind}`)
        .setOrigin(0).setDepth(DEPTH.player + .1).setBlendMode(Phaser.BlendModes.ADD)
        .setTilePosition(s.x % m.tileW, 0);
    };
    for (const s of L.solids) {
      const z = this.add.zone(s.x + s.w / 2, s.y + s.h / 2, s.w, s.h);
      z.plat = { solid: s };
      this.solidGroup.add(z);
      // cooling facade: whole machinery rows only, starting on a ledge under the roof edge and ending on one,
      // with a plain base below. Blocks too short for a storey, or levels without a wall, keep the plain ground look.
      const storeys = !wallKey ? 0 : Math.floor((s.h - ROOF_H - TOWER.ledge * WALL_SCALE - 8) / (TOWER.storey * WALL_SCALE));
      if (storeys >= 1) {
        const fy = s.y + ROOF_H, fh = (storeys * TOWER.storey + TOWER.ledge) * WALL_SCALE;
        this.add.rectangle(s.x, s.y, s.w, s.h, 0x0b0a10).setOrigin(0).setDepth(DEPTH.plat);
        // x stays world-aligned so neighbouring blocks line up; y starts the texture at a ledge
        this.add.tileSprite(s.x, fy, s.w, fh, wallKey).setOrigin(0).setDepth(DEPTH.plat)
          .setTileScale(WALL_SCALE, WALL_SCALE).setTilePosition(s.x / WALL_SCALE, TOWER.firstLedge).setTint(hexNum(c));
        if (fy + fh < s.y + s.h - 1) this.add.rectangle(s.x, fy + fh, s.w, 2, hexNum(c), .35).setOrigin(0).setDepth(DEPTH.plat);
        // Pipes are independent of the wall repeat: mostly straight runs, with
        // occasional fittings. Every module returns to the same centreline.
        const pipeXs = [], centres = [190.5, 175, 199, 161.5];
        const runs = Math.max(1, Math.floor(s.w / 260)), scale = .24, segmentH = 998 * scale;
        for (let run = 0; run < runs; run++) {
          const px = s.x + s.w * (run + .4) / runs;
          pipeXs.push(px);
          let py = fy, index = 0;
          while (py + segmentH <= fy + fh) {
            const seed = Math.abs(Math.floor(s.x * 13 + s.y * 7 + run * 31 + index * 17));
            const frame = seed % 5 < 3 ? 0 : 1 + seed % 3;
            this.add.image(px, py, 'pipe-modules', frame).setOrigin(centres[frame] / 384, 0)
              .setScale(scale).setDepth(DEPTH.plat + .1);
            py += segmentH; index++;
          }
          // Only a plain straight section is shortened to fit the remaining height.
          if (py < fy + fh) this.add.image(px, py, 'pipe-modules', 'straight-fill')
            .setOrigin(centres[0] / 384, 0).setDisplaySize(384 * scale, fy + fh - py).setDepth(DEPTH.plat + .1);
        }
        // Vent outlets follow the world-aligned panel grid, never clipped block edges.
        const panel = TOWER.storey * WALL_SCALE;
        for (let row = 0; row < storeys; row++) {
          for (let col = Math.floor(s.x / panel); col * panel < s.x + s.w; col++) {
            const vx = (col + .55) * panel;
            if (vx > s.x + 20 && vx < s.x + s.w - 20 && pipeXs.every(px => Math.abs(px - vx) > 40)) {
              this.fx.addCoolingVent(vx, fy + (row + .3) * panel);
            }
          }
        }
        edge(s, 'roof');   // thin strip over the roof edge and first machinery row
      } else {
        this.add.rectangle(s.x, s.y, s.w, s.h, 0x0b0a10).setOrigin(0).setDepth(DEPTH.plat);
        edge(s, 'ground');
      }
      // neon trim down any side that faces open air
      for (const side of [-1, 1]) {
        const edge = side < 0 ? s.x : s.x + s.w;
        if (edge <= 0 || edge >= L.width) continue;
        const touching = L.solids.filter(o => o !== s && Math.abs((side < 0 ? o.x + o.w : o.x) - edge) < 2 && o.y < s.y + s.h && o.y + o.h > s.y);
        const bottom = Math.min(s.y + s.h, ...touching.map(o => o.y));
        if (bottom - s.y > 8) this.add.tileSprite(edge - 8, s.y + 3, 16, bottom - s.y - 3, wallTrim(this, c)).setOrigin(0).setDepth(DEPTH.plat);
      }
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
      this.add.image(f.x - PLAT_PAD_X, f.y - PLAT_PAD_TOP, deckTexture(this, f.w, pal)).setOrigin(0).setDepth(DEPTH.plat);
    }
    for (const m of L.movers) {
      // the deck and its thruster pods are one image, so the whole lift moves with its body
      const img = this.add.image(m.x - PLAT_PAD_X, m.y - PLAT_PAD_TOP, deckTexture(this, m.w, pal, true)).setOrigin(0).setDepth(DEPTH.plat);
      this.moverGroup.add(img);
      img.body.setSize(m.w, FLOAT_H).setOffset(PLAT_PAD_X, PLAT_PAD_TOP);
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
      if (snap || dt <= 0) { img.body.reset(tx - PLAT_PAD_X, ty - PLAT_PAD_TOP); img.body.setVelocity(0, 0); continue; }
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

  // Exit gate: the frame is an image; its open middle gets a portal of light behind it, which the frame masks.
  buildExit() {
    const L = this.level, ex = L.exit, col = hexNum(this.color), ADD = Phaser.BlendModes.ADD, d = DEPTH.deco;
    const key = this.textures.exists('gate-' + L.gate) ? 'gate-' + L.gate : 'gate-cyan';
    const img = this.textures.get(key).getSourceImage(), sc = GATE.h / img.height, gw = img.width * sc, op = GATE.open;
    const o = { x: ex.x + (op.x0 - .5) * gw, y: ex.y + (op.y0 - GATE.ground) * GATE.h, w: (op.x1 - op.x0) * gw, h: (op.y1 - op.y0) * GATE.h };
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    const field = this.add.image(cx, cy, 'portal-field').setDisplaySize(o.w, o.h).setTint(col).setBlendMode(ADD).setDepth(d);
    const scan = this.add.tileSprite(o.x, o.y, o.w, o.h, 'portal-scan').setOrigin(0).setTint(col).setBlendMode(ADD).setDepth(d).setAlpha(.45);
    const core = this.add.image(cx, cy + o.h * .1, 'glow').setDisplaySize(o.w * 1.3, o.h).setBlendMode(ADD).setDepth(d).setAlpha(.15);
    this.add.image(cx, o.y + o.h, 'glow').setDisplaySize(o.w * 1.8, 34).setTint(col).setBlendMode(ADD).setDepth(d).setAlpha(.9);
    // ripples open out from the middle, one after another
    const rx = o.w * 1.15 / 128, ry = o.h * .8 / 128;
    const rings = [0, 1, 2].map(i => {
      const r = this.add.image(cx, cy, 'portal-ring').setTint(col).setBlendMode(ADD).setDepth(d).setAlpha(0);
      this.tweens.add({ targets: r, scaleX: { from: rx * .08, to: rx }, scaleY: { from: ry * .08, to: ry }, alpha: { from: .9, to: 0 },
        duration: 2100, delay: i * 700, repeat: -1, ease: 'Cubic.out' });
      return r;
    });
    // a bright band sweeps down every few seconds
    const band = this.add.image(cx, o.y, 'portal-band').setDisplaySize(o.w, 36).setTint(col).setBlendMode(ADD).setDepth(d).setAlpha(0);
    this.tweens.add({ targets: band, y: { from: o.y, to: o.y + o.h }, duration: 1300, repeat: -1, repeatDelay: 1700,
      ease: 'Sine.inOut', onUpdate: tw => band.setAlpha(Math.sin(tw.progress * Math.PI) * .8) });
    // motes drifting up, and quick data streaks
    const zone = { type: 'random', source: new Phaser.Geom.Rectangle(4, 10, o.w - 8, o.h - 14) };
    this.add.particles(o.x, o.y, 'px', {
      emitZone: zone, speedY: { min: -90, max: -25 }, speedX: { min: -8, max: 8 }, lifespan: 1600, frequency: 55,
      scale: { min: .35, max: .9 }, tint: [col, 0xffffff], alpha: { start: .9, end: 0 }, blendMode: 'ADD',
    }).setDepth(d);
    this.add.particles(o.x, o.y, 'px', {
      emitZone: zone, speedY: { min: -280, max: -160 }, lifespan: 700, frequency: 180,
      scaleX: .3, scaleY: { min: 3, max: 7 }, tint: [col, 0xffffff], alpha: { start: .7, end: 0 }, blendMode: 'ADD',
    }).setDepth(d);
    // the frame goes on top so it hides the light's edges
    this.add.image(ex.x, ex.y, key).setOrigin(.5, GATE.ground).setScale(sc).setDepth(d);
    this.exitZone = { x: o.x + 4, y: o.y, w: o.w - 8, h: ex.y + 10 - o.y };
    this.gate = { field, scan, core, rings, x: cx, y: cy, surge: 0 };
  }

  // the portal brightens as Kin gets close, and surges when he steps through
  updateGate(dt, time) {
    const g = this.gate, p = this.player;
    const k = Phaser.Math.Clamp(1 - (Phaser.Math.Distance.Between(p.x, p.y - 50, g.x, g.y) - 80) / 420, 0, 1);
    const pulse = .5 + .5 * Math.sin(time / 260);
    g.scan.tilePositionY += dt * (30 + 60 * k + 200 * g.surge);
    g.field.setAlpha(Math.min(1, .6 + .15 * pulse + .25 * k + g.surge));
    g.core.setAlpha(Math.min(1, .1 + .06 * pulse + .35 * k + .9 * g.surge));
  }

  buildProps() {
    const L = this.level, c = this.color;
    this.buildExit();

    // checkpoints
    this.beacons = L.checkpoints.map((cp, i) => {
      const on = i <= this.cpIndex, key = on ? 'beacon-on' : 'beacon-off';
      const img = this.add.image(cp.x, cp.y, key).setOrigin(...propOrigin(key)).setDepth(DEPTH.deco);
      return { ...cp, i, on, img };
    });

    // hints
    for (const h of L.hints) {
      this.add.text(h.x, h.y, h.text, {
        fontFamily: HUD_FONT, fontSize: '17px', fontStyle: '600', color: '#e9fdff', align: 'center',
        backgroundColor: 'rgba(6,9,20,.62)', padding: { x: 12, y: 6 },
      }).setOrigin(.5, 1).setDepth(DEPTH.deco).setLetterSpacing(1.5).setShadow(0, 0, c, 8, false, true);
    }

    // enemies and pickups
    this.enemies = L.enemies.map(e => new Enemy(this, e));
    this.chips = L.chips.map(ch => ({ ...ch, t: Math.random() * 6, plasmaT: Math.random() * .1, img: this.add.image(ch.x, ch.y, 'chip', 0).setOrigin(...chipMap.origin).setScale(CHIP_SCALE).setDepth(DEPTH.pickup) }));
    this.boosts = L.boosts.map(b => {
      // the egg's core goes in first so the shell frames it; it glows in the shell's opening
      const core = b.type === 'egg' ? this.add.image(b.x, b.y + EGG_CORE_Y, 'egg-core').setOrigin(...propOrigin('egg-core')).setDepth(DEPTH.pickup) : null;
      const img = this.add.image(b.x, b.y, b.type).setOrigin(...propOrigin(b.type)).setDepth(DEPTH.pickup);
      return { ...b, t: Math.random() * 6, img, core, respawn: 0 };
    });
    this.repairs = L.repairs.map(r => {
      const img = this.add.image(r.x, r.y - 40, 'repair').setOrigin(...propOrigin('repair')).setDepth(DEPTH.pickup);
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
    this.tweens.add({ targets: this.gate, surge: 1, duration: 450, ease: 'Cubic.out' });
    this.fx.puff(L.exit.x, L.exit.y - 60, 30, this.color, 320); this.fx.puff(this.gate.x, this.gate.y, 14, '#ffffff', 200);
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

    this.updateGate(dt, time);
    this.updateShots(dt, cam);
    for (const e of this.enemies) e.update(dt, p, cam);
    if (this.mode === 'play') this.enemyContacts();
    this.enemies = this.enemies.filter(e => !e.gone);
    this.updateLasers(dt, cam);
    this.updatePickups(dt);
    this.fx.updateCoolingVents(dt, this.cameras.main.worldView);
    if (this.mode !== 'play') return;

    // checkpoints
    for (const b of this.beacons) {
      if (!b.on && p.x >= b.x && Math.abs(p.y - b.y) < 220) {
        b.on = true; b.img.setTexture('beacon-on').setOrigin(...propOrigin('beacon-on')); this.cpIndex = Math.max(this.cpIndex, b.i);
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
      c.img.setPosition(c.x, c.y + Math.sin(c.t * 3) * 4)
        .setScale(CHIP_SCALE)
        .setFrame(chipMap.animations.idle.start + Math.floor(c.t * chipMap.animations.idle.frameRate) % chipMap.frameCount);
      if (playing && Math.hypot(c.x - p.x, c.y - (p.y - 50)) < 11 + 34) {
        c.got = true; c.img.destroy(); this.stats.chips++;
        this.addScore(10, c.x, c.y - 10, '+10', '#35e9ff', 12);
        SFX.chip(); this.fx.puff(c.x, c.y, 8, '#35e9ff', 160);
      }
      // Emit only near the camera, and stop immediately when the chip is collected.
      const view = this.cameras.main.worldView;
      c.plasmaT -= dt;
      if (!c.got && c.plasmaT <= 0 && c.x >= view.x - 30 && c.x <= view.right + 30
        && c.img.y >= view.y - 30 && c.img.y <= view.bottom + 30) {
        this.fx.chipPlasma(c.x, c.img.y);
        c.plasmaT = .1;
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
      if (b.core) b.core.setY(y + EGG_CORE_Y).setAlpha(.75 + Math.sin(b.t * 4) * .25).setScale(1 + Math.sin(b.t * 4) * .05);
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

