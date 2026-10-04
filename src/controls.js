// Keyboard + on-screen touch buttons. Scenes poll the held state and subscribe to presses.
import { musicToggle, musicStart } from './audio/music.js';
import { audioCtx } from './audio/sfx.js';

const keys = {};
const listeners = new Set();

export const held = {
  left:  () => keys.ArrowLeft || keys.KeyA,
  right: () => keys.ArrowRight || keys.KeyD,
  jump:  () => keys.Space || keys.ArrowUp || keys.KeyW,
  down:  () => keys.ArrowDown || keys.KeyS,
  shoot: () => keys.KeyV || keys.KeyB || keys.KeyN,
};

export const isJump  = c => c === 'Space' || c === 'ArrowUp' || c === 'KeyW';
export const isShoot = c => c === 'KeyV' || c === 'KeyB' || c === 'KeyN';
export const isConfirm = c => c === 'Space' || c === 'Enter';
export const isBack = c => c === 'Escape' || c === 'KeyP' || c === 'Pause';

// Subscribe to key presses for the lifetime of a scene. Returns the unsubscribe function.
export function onPress(scene, fn) {
  listeners.add(fn);
  const off = () => listeners.delete(fn);
  scene.events.once('shutdown', off);
  return off;
}

function press(code) {
  // first gesture unlocks audio (browsers block it until then)
  musicStart(); const ac = audioCtx(); if (ac && ac.state === 'suspended') ac.resume();
  for (const fn of [...listeners]) fn(code);
}

export function releaseAll() { for (const k in keys) keys[k] = false; }

export function initControls() {
  addEventListener('keydown', e => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys[e.code] = true;
    if (e.code === 'KeyM') musicToggle();
    if (e.code === 'KeyF') {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.();
    }
    press(e.code);
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', releaseAll);

  const touchUI = document.getElementById('touch');
  if ('ontouchstart' in window && touchUI) touchUI.classList.add('on');
  const bind = (id, code) => {
    const el = document.getElementById(id); if (!el) return;
    const on = e => { e.preventDefault(); keys[code] = true; press(code); };
    const off = e => { e.preventDefault(); keys[code] = false; };
    el.addEventListener('pointerdown', on);
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(ev, off);
  };
  bind('bl', 'ArrowLeft'); bind('br', 'ArrowRight'); bind('bd', 'ArrowDown');
  bind('bj', 'Space'); bind('ba', 'KeyB'); bind('bp', 'Escape');
}
