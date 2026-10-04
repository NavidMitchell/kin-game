// Loads the images, waits for the HUD font, then sizes the artwork and bakes every texture the game uses.
import Phaser from 'phaser';
import { W, H } from '../config.js';
import { bakeSprites, bakeProps, bakeScreens } from '../gfx/textures.js';
import { fitArt, PROPS } from '../gfx/art.js';
import kinUrl from '../../assets/player/kin.webp';
import kinMap from '../../assets/player/kin.json';
import chipUrl from '../../assets/world/data-chip.webp';
import chipMap from '../../assets/world/data-chip.json';
import shootUrl from '../../assets/robot_shoot.webp';
import droneUrl from '../../assets/drone.webp';
import cityUrl from '../../assets/city.webp';
import coolingPipesUrl from '../../assets/towers/cooling-pipes.webp';
import coolingUrl from '../../assets/towers/cooling.webp';
import titleUrl from '../../assets/title.jpg';
import logoSvg from '../../assets/kinotic-logo.svg?raw';

// world artwork, found by path: { '../../assets/platform/cyan/left.webp': url, ... }
const GATE_URLS = import.meta.glob('../../assets/exit-gates/exit-gate-*.webp', { eager: true, import: 'default' });
const PLATFORM_URLS = import.meta.glob('../../assets/platform/*/*.webp', { eager: true, import: 'default' });
const EDGE_URLS = import.meta.glob('../../assets/world/ground-rooftop/*/ground-edge.webp', { eager: true, import: 'default' });
// Worn jetpacks are included in the unified Kin sheet.
const WORLD_URLS = import.meta.glob(['../../assets/world/*.webp', '!**/jetpack.webp'], { eager: true, import: 'default' });

export class PreloadScene extends Phaser.Scene {
  constructor() { super('Preload'); }

  preload() {
    const bar = this.add.rectangle(W / 2 - 150, H / 2, 0, 4, 0x35e9ff).setOrigin(0, .5);
    this.add.rectangle(W / 2, H / 2, 300, 4, 0x35e9ff, .15);
    this.load.on('progress', v => { bar.width = 300 * v; });
    this.load.spritesheet('kin', kinUrl, { frameWidth: kinMap.frameWidth, frameHeight: kinMap.frameHeight, endFrame: kinMap.frameCount - 1 });
    this.load.spritesheet('chip', chipUrl, { frameWidth: chipMap.frameWidth, frameHeight: chipMap.frameHeight, endFrame: chipMap.frameCount - 1 });
    this.load.image('shoot-src', shootUrl);
    this.load.image('drone-src', droneUrl);
    this.load.image('city', cityUrl);
    // Neutral cooling machinery picks up each level's accent colour.
    this.load.image('cooling-tower', coolingUrl);
    this.load.image('cooling-pipes', coolingPipesUrl);
    // exit gates (gate-cyan ... gate-red-blue); each level picks one with its `gate` map property
    for (const [path, url] of Object.entries(GATE_URLS)) this.load.image('gate-' + path.match(/exit-gate-([\w-]+)\.webp$/)[1], url);
    // platform pieces (plat-cyan-left ...) and ground edges (edge-cyan ...); a level picks a set with `palette`
    for (const [path, url] of Object.entries(PLATFORM_URLS)) {
      const [, palette, part] = path.match(/platform\/(\w+)\/(\w+)\.webp$/);
      this.load.image(`plat-${palette}-${part}`, url);
    }
    for (const [path, url] of Object.entries(EDGE_URLS)) this.load.image('edge-' + path.match(/ground-rooftop\/(\w+)\//)[1], url);
    // checkpoints and pickups, under the keys the game uses (see PROPS)
    for (const [key, p] of Object.entries(PROPS)) this.load.image(key, WORLD_URLS[`../../assets/world/${p.file}.webp`]);
    this.load.image('title', titleUrl);
    // Phaser decodes data: URIs as base64, so hand it the SVG that way (works in the single-file build too)
    this.load.svg('logo', 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(logoSvg))), { width: 480 });
  }

  async create() {
    // the HUD and menus are drawn into canvases, so the web font has to be ready first (offline it falls back)
    try {
      await Promise.race([
        Promise.all(['500', '600', '700'].map(w => document.fonts.load(`${w} 20px Rajdhani`))),
        new Promise(r => setTimeout(r, 2500)),
      ]);
    } catch { /* font unavailable */ }
    fitArt(this);
    bakeSprites(this);
    bakeProps(this);
    bakeScreens(this, W, H);
    this.scene.start('Title');
  }
}
