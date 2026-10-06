import test from 'node:test';
import assert from 'node:assert/strict';
import { touchState } from '../src/touch-state.js';
test('movement, jump and fire are independent', () => {
  const s = touchState(); s.press(1, ['ArrowRight']); s.press(2, ['Space']); s.press(3, ['KeyB']);
  assert.ok(s.held('ArrowRight') && s.held('Space') && s.held('KeyB'));
  s.release(1); assert.equal(s.held('ArrowRight'), false); assert.ok(s.held('Space'));
  s.release(2); assert.equal(s.held('Space'), false); assert.ok(s.held('KeyB'));
  s.release(3); assert.equal(s.held('KeyB'), false);
});
test('overlapping buttons retain input until every owning finger lifts; clear cancels all', () => {
  const s = touchState(); s.press(1, ['Space']); s.press(2, ['Space','KeyB']);
  s.release(2); assert.ok(s.held('Space')); assert.equal(s.held('KeyB'), false);
  s.clear(); assert.equal(s.held('Space'), false);
});

import { padDirections } from '../src/touch-state.js';
test('movement pad supports crouching but never triggers jump or fire', () => {
  assert.deepEqual(padDirections(0, 0), []);
  assert.deepEqual(padDirections(10, -10), []);
  assert.deepEqual(padDirections(30, -30), ['ArrowRight']);
  assert.deepEqual(padDirections(-30, 30), ['ArrowLeft', 'ArrowDown']);
  assert.deepEqual(padDirections(0, -30), []);
});
test('joystick hysteresis absorbs jitter and releases near center', () => {
  const right = padDirections(16, 0);
  assert.deepEqual(padDirections(12, 0, 14, right), ['ArrowRight']);
  assert.deepEqual(padDirections(6, 0, 14, right), []);
  assert.deepEqual(padDirections(-18, 0, 14, right), ['ArrowLeft']);
  assert.deepEqual(padDirections(0, -12, 14, []), []);
});
