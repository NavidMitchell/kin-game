import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraLead, easeCamera } from '../src/gfx/camera-follow.js';
test('reversing movement eases look-ahead instead of switching sides instantly', () => {
  const next = cameraLead(120, -400, 400, 1/60);
  assert.ok(next > 100 && next < 120);
  assert.equal(cameraLead(0, 0, 400, 1/60), 0);
  assert.ok(cameraLead(0, 40, 400, 1/60) < 1);
});
test('camera smoothing is consistent across refresh rates and cannot overshoot', () => {
  const sample = fps => { let x=0; for(let i=0;i<fps;i++) x=easeCamera(x,120,4,1/fps); return x; };
  assert.ok(Math.abs(sample(30)-sample(120)) < 1e-8);
  assert.ok(easeCamera(0,120,4,1) <= 120);
});
