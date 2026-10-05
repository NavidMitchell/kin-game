// Keyboard + on-screen touch buttons. Scenes poll the held state and subscribe to presses.
import { musicToggle, musicStart } from './audio/music.js';
import { touchState } from './touch-state.js';
import { audioCtx } from './audio/sfx.js';

const keys = {};
const fingers = touchState();
const down = code => keys[code] || fingers.held(code);
export const touchShooting = () => fingers.held('KeyB');
const listeners = new Set();

export const held = {
  left:  () => down('ArrowLeft') || down('KeyA'),
  right: () => down('ArrowRight') || down('KeyD'),
  jump:  () => down('Space') || down('ArrowUp') || down('KeyW'),
  down:  () => down('ArrowDown') || down('KeyS'),
  shoot: () => down('KeyV') || down('KeyB') || down('KeyN') || down('ShiftLeft'),
};

export const isJump  = c => c === 'Space' || c === 'ArrowUp' || c === 'KeyW';
export const isShoot = c => c === 'KeyV' || c === 'KeyB' || c === 'KeyN' || c === 'ShiftLeft';
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

export function releaseAll() {
  for (const k in keys) keys[k] = false;
  fingers.clear();
  document.querySelectorAll('.btn.held').forEach(el => el.classList.remove('held'));
}
async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else {
      await document.documentElement.requestFullscreen?.();
      await screen.orientation?.lock?.('landscape').catch(() => {});
    }
  } catch { /* Rotation guidance remains available when fullscreen is unsupported. */ }
}

export function initControls() {
  addEventListener('keydown', e => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys[e.code] = true;
    if (e.code === 'KeyM') musicToggle();
    if (e.code === 'KeyF') fullscreen();
    press(e.code);
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', releaseAll);

  const touchUI = document.getElementById('touch');
  const mobile = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  if (mobile && touchUI) touchUI.classList.add('on');
  document.body.classList.toggle('mobile-controls', mobile);
  const syncOrientation = () => {
    const portrait = mobile && innerHeight > innerWidth;
    document.body.classList.toggle('mobile-portrait', portrait);
    document.getElementById('rotate').hidden = !portrait;
    releaseAll();
    const game = window.kin?.scene.getScene('Game');
    if (portrait && game?.mode === 'play') game.pause();
  };
  addEventListener('resize', syncOrientation);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      releaseAll();
      const game = window.kin?.scene.getScene('Game');
      if (game?.mode === 'play') game.pause();
    }
  });
  syncOrientation();
  const bind = (id, codes) => {
    const el = document.getElementById(id); if (!el) return;
    const active = new Set();
    el.addEventListener('pointerdown', e => {
      if (document.body.classList.contains('mobile-portrait')) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      active.add(e.pointerId); fingers.press(e.pointerId, codes);
      el.classList.add('held');
      const playing = window.kin?.scene.getScene('Game')?.mode === 'play';
      for (const code of playing ? codes : codes.slice(0, 1)) press(code);
    });
    const off = e => {
      fingers.release(e.pointerId); active.delete(e.pointerId);
      if (!active.size) el.classList.remove('held');
    };
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, off);
  };
  bind('bl', ['ArrowLeft']); bind('br', ['ArrowRight']); bind('bd', ['ArrowDown']);
  bind('bj', ['Space']); bind('ba', ['KeyB']); bind('bc', ['Space', 'KeyB']);
  bind('bp', ['Escape']);
  document.getElementById('bm').addEventListener('click', e => {
    musicToggle();
    const muted = e.currentTarget.getAttribute('aria-pressed') !== 'true';
    e.currentTarget.setAttribute('aria-pressed', String(muted));
    e.currentTarget.textContent = muted ? 'Music off' : 'Music on';
  });
  const fs = document.getElementById('bf');
  fs.hidden = !document.documentElement.requestFullscreen;
  fs.addEventListener('click', fullscreen);
}
