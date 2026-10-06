// Keyboard + on-screen touch buttons. Scenes poll the held state and subscribe to presses.
import { musicToggle, musicStart } from './audio/music.js';
import { padDirections, touchState } from './touch-state.js';
import { audioCtx } from './audio/sfx.js';

const keys = {};
const fingers = touchState();
const gestures = new Map();
let touchHelpShown = false;
const down = code => keys[code] || fingers.held(code);
export const touchJumping = () => fingers.held('Space');
export const touchMoving = () => fingers.held('ArrowLeft') || fingers.held('ArrowRight');
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
  gestures.clear();
  const nub = document.getElementById('pad-nub'); if (nub) nub.style.transform = '';
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
  let wasPortrait;
  const syncOrientation = () => {
    const portrait = mobile && innerHeight > innerWidth;
    document.body.classList.toggle('mobile-portrait', portrait);
    document.getElementById('rotate').hidden = !portrait;
    if (portrait !== wasPortrait) releaseAll();
    wasPortrait = portrait;
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
  const playing = () => mobile && !document.body.classList.contains('mobile-portrait')
    && window.kin?.scene.isActive('Game') && window.kin.scene.getScene('Game').mode === 'play';
  const pad = document.getElementById('move-pad');
  const nub = document.getElementById('pad-nub');
  const updatePad = (e, g) => {
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    const codes = padDirections(dx, dy, 14, g.codes);
    fingers.press(e.pointerId, codes);
    g.codes = codes;
    const scale = Math.min(1, 38 / (Math.hypot(dx, dy) || 1));
    nub.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
  };
  for (const el of [pad, ...document.querySelectorAll('[data-control]')]) {
    el.addEventListener('pointerdown', e => {
      if (!playing()) return;
      e.preventDefault();
      const left = el === pad;
      if (left && [...gestures.values()].some(g => g.left)) return;
      const rect = el.getBoundingClientRect();
      const codes = left ? [] : [el.dataset.control];
      const g = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, left, codes, el };
      gestures.set(e.pointerId, g);
      el.setPointerCapture(e.pointerId);
      el.classList.add('held');
      fingers.press(e.pointerId, codes);
      if (left) updatePad(e, g);
      else for (const code of codes) press(code);
    }, { passive: false });
  }
  document.addEventListener('pointermove', e => {
    const g = gestures.get(e.pointerId);
    if (!g || !playing()) return;
    e.preventDefault();
    if (g.left) updatePad(e, g);
  }, { passive: false });
  const off = e => {
    const g = gestures.get(e.pointerId);
    gestures.delete(e.pointerId); fingers.release(e.pointerId);
    if (g && ![...gestures.values()].some(other => other.el === g.el)) g.el.classList.remove('held');
    if (g?.left) nub.style.transform = '';
  };
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) document.addEventListener(ev, off);
  const view = document.getElementById('mobile-view');
  view.addEventListener('change', () => {
    releaseAll();
    document.body.dataset.mobileView = view.value;
    window.kin?.scale.refresh();
    window.dispatchEvent(new Event('mobileviewchange'));
  });
  document.body.dataset.mobileView = view.value;
  document.getElementById('bp').addEventListener('click', () => press('Escape'));
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

export function showTouchHelp(scene) {
  if (!document.body.classList.contains('mobile-controls') || touchHelpShown) return;
  releaseAll();
  scene.mode = 'touch-help'; scene.physics.pause();
  const help = document.getElementById('touch-help'), start = document.getElementById('touch-start');
  help.hidden = false;
  const finish = () => {
    if (document.body.classList.contains('mobile-portrait')) return;
    touchHelpShown = true; help.hidden = true; releaseAll();
    scene.mode = 'play'; scene.physics.resume();
    start.removeEventListener('click', finish);
  };
  start.addEventListener('click', finish);
  scene.events.once('shutdown', () => {
    help.hidden = true; start.removeEventListener('click', finish); releaseAll();
  });
}
