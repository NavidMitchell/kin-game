import test from 'node:test';
import assert from 'node:assert/strict';
import { pipeLayout } from '../src/gfx/pipe-layout.js';
test('pipe runs are reproducible, varied and connected within the wall', () => {
  const wall = {x: 2800, y: 250, w: 1600, h: 1000};
  const runs = pipeLayout(wall);
  assert.deepEqual(runs, pipeLayout(wall));
  assert.ok(new Set(runs.map(r => r.top)).size > 1);
  assert.ok(new Set(runs.flatMap(r => r.pieces.filter(p => p.frame !== null).map(p => p.frame))).size >= 3);
  for (const r of runs) {
    assert.ok(r.top >= wall.y && r.bottom <= wall.y + wall.h);
    let next = r.top + 57;
    for (const p of r.pieces) {
      assert.ok(Math.abs(p.y - next) < 1e-8);
      assert.ok(p.h > 0); next = p.y + p.h;
    }
    assert.ok(Math.abs(next - (r.bottom - 57)) < 1e-8);
  }
});
test('short walls omit pipes and minimum-height walls fit end caps', () => {
  assert.deepEqual(pipeLayout({x:0,y:0,w:500,h:100}), []);
  assert.equal(pipeLayout({x:0,y:0,w:100,h:116}).length, 1);
});
