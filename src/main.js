import Phaser from 'phaser';
import { W, H, GRAV } from './config.js';
import { initControls } from './controls.js';
import { PreloadScene } from './scenes/Preload.js';
import { TitleScene } from './scenes/Title.js';
import { SelectScene } from './scenes/Select.js';
import { GameScene } from './scenes/Game.js';
import { HUDScene } from './scenes/HUD.js';
import { ResultScene } from './scenes/Result.js';
import { musicStart } from './audio/music.js';

initControls();
// title music starts quietly now if the browser allows it, otherwise on the first key or tap
musicStart();
addEventListener('pointerdown', () => musicStart());

window.kin = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  width: W, height: H,
  backgroundColor: '#07050a',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: GRAV }, fps: 120, debug: false } },
  input: { keyboard: false },
  scene: [PreloadScene, TitleScene, SelectScene, GameScene, HUDScene, ResultScene],
});
