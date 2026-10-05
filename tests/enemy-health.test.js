import test from 'node:test';
import assert from 'node:assert/strict';
import { enemyHealth, takeEnemyHit } from '../src/entities/enemy-health.js';
test('heavy drone survives two impacts and is defeated by the third', () => {
  const e = { alive: true, hp: enemyHealth('drone') };
  assert.equal(takeEnemyHit(e), false);
  assert.equal(takeEnemyHit(e), false);
  assert.equal(e.hp, 1);
  assert.equal(takeEnemyHit(e), true);
  assert.equal(e.hp, 0);
  e.alive = false;
  assert.equal(takeEnemyHit(e), false);
});
test('small skimmer still needs one impact', () => {
  const e = { alive: true, hp: enemyHealth('skimmer') };
  assert.equal(takeEnemyHit(e), true);
});
