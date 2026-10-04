// Loads the images, waits for the HUD font, then bakes every texture the game uses.
import Phaser from 'phaser';
import { W, H } from '../config.js';
import { bakeSprites, bakeProps, bakeScreens } from '../gfx/textures.js';
import robotUrl from '../../assets/robot.webp';
import shootUrl from '../../assets/robot_shoot.webp';
import droneUrl from '../../assets/drone.webp';
import cityUrl from '../../assets/city.webp';
import towerRed from '../../assets/towers/red.webp';
import towerMagenta from '../../assets/towers/magenta.webp';
import towerOrange from '../../assets/towers/orange.webp';
import towerGreen from '../../assets/towers/green.webp';
import gateCyan from '../../assets/gates/cyan.webp';
import gateMagenta from '../../assets/gates/magenta.webp';
import gateOrange from '../../assets/gates/orange.webp';
import gateGreen from '../../assets/gates/green.webp';
import gateRedBlue from '../../assets/gates/red-blue.webp';
import titleUrl from '../../assets/title.jpg';
import logoSvg from '../../assets/kinotic-logo.svg?raw';

export class PreloadScene extends Phaser.Scene {
  constructor() { super('Preload'); }

  preload() {
    const bar = this.add.rectangle(W / 2 - 150, H / 2, 0, 4, 0x35e9ff).setOrigin(0, .5);
    this.add.rectangle(W / 2, H / 2, 300, 4, 0x35e9ff, .15);
    this.load.on('progress', v => { bar.width = 300 * v; });
    this.load.image('robot-src', robotUrl);
    this.load.image('shoot-src', shootUrl);
    this.load.image('drone-src', droneUrl);
    this.load.image('city', cityUrl);
    // tower facades for solid ground; each level picks one with its `wall` map property
    this.load.image('tower-red', towerRed);
    this.load.image('tower-magenta', towerMagenta);
    this.load.image('tower-orange', towerOrange);
    this.load.image('tower-green', towerGreen);
    // exit gates; each level picks one with its `gate` map property
    this.load.image('gate-cyan', gateCyan);
    this.load.image('gate-magenta', gateMagenta);
    this.load.image('gate-orange', gateOrange);
    this.load.image('gate-green', gateGreen);
    this.load.image('gate-red-blue', gateRedBlue);
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
    bakeSprites(this);
    bakeProps(this);
    bakeScreens(this, W, H);
    this.scene.start('Title');
  }
}
