import test from 'node:test';
import assert from 'node:assert/strict';
import { touchState } from '../src/touch-state.js';
test('movement and combined flight/fire can be held together', () => {
  const s = touchState(); s.press(1, ['ArrowRight']); s.press(2, ['Space','KeyB']);
  assert.ok(s.held('ArrowRight') && s.held('Space') && s.held('KeyB'));
  s.release(1); assert.equal(s.held('ArrowRight'), false); assert.ok(s.held('Space'));
  s.release(2); assert.equal(s.held('KeyB'), false);
});
test('overlapping buttons retain input until every owning finger lifts; clear cancels all', () => {
  const s = touchState(); s.press(1, ['Space']); s.press(2, ['Space','KeyB']);
  s.release(2); assert.ok(s.held('Space')); assert.equal(s.held('KeyB'), false);
  s.clear(); assert.equal(s.held('Space'), false);
});
