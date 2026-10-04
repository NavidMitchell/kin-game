import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { animationFrame, kinFrame } from '../src/gfx/kin-frames.js';
import { ATK_FIRE, ATK_TIME } from '../src/config.js';
const map = JSON.parse(readFileSync(new URL('../assets/player/kin.json', import.meta.url)));
const pick = overrides => kinFrame(map, { state: 'idle', t: 0, jet: false, thrust: false, vy: 0, landT: 0, ...overrides });

test('idle holds open eyes and blinks briefly before looping', () => {
  const a = map.animations.idle;
  assert.equal(animationFrame(a, 2.19), a.frames[0]);
  assert.equal(animationFrame(a, 2.21), a.frames[1]);
  assert.equal(animationFrame(a, 2.32), a.frames[0]);
});
test('attack phases stay synchronized with projectile timing for all equipment states', () => {
  for (const [jet, thrust, prefix] of [[false, false, ''], [true, false, 'jet_'], [true, true, 'jet_thrust_']]) {
    for (let i = 0; i < 6; i++) {
      assert.equal(pick({ state: 'attack', jet, thrust, t: ATK_FIRE * (i + .5) / 6 }), map.animations[prefix + 'charge'].frames[i]);
    }
    for (let i = 0; i < 4; i++) {
      assert.equal(pick({ state: 'attack', jet, thrust, t: ATK_FIRE + (ATK_TIME - ATK_FIRE) * (i + .5) / 4 }), map.animations[prefix + 'fire'].frames[i]);
    }
  }
});
test('air poses follow velocity; thrust and equipped movement select their own artwork', () => {
  for (const jet of [false, true]) {
    const prefix = jet ? 'jet_' : '';
    for (const [vy, pose] of [[-700, 'riseFast'], [-300, 'riseSlow'], [0, 'apex'], [300, 'fallSlow'], [800, 'fallFast']]) {
      assert.equal(pick({ state: 'jump', jet, vy }), map.airPoses[prefix + 'air'][pose]);
    }
    assert.equal(pick({ state: 'duck', jet }), map.animations[prefix + 'duck'].frames[0]);
    assert.equal(pick({ state: 'run', jet, t: .1 }), map.animations[prefix + 'run'].frames[1]);
  }
  assert.equal(pick({ state: 'jump', jet: true, thrust: true, t: .1 }), map.animations.jet_thrust.frames[1]);
  assert.equal(pick({ landT: .11 }), map.animations.land.frames[0]);
  assert.equal(pick({ landT: .01 }), map.animations.land.frames[1]);
});
test('all manifest frames fit the uniform sheet', () => {
  assert.equal(map.width, map.columns * map.frameWidth);
  assert.equal(map.height, map.rows * map.frameHeight);
  for (const a of Object.values(map.animations)) for (const frame of a.frames) assert.ok(Number.isInteger(frame) && frame >= 0 && frame < map.frameCount);
});
