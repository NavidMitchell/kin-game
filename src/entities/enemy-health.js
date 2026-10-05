// Heavy hovering drones survive three impacts; small skimmers remain fragile.
export const enemyHealth = type => type === 'drone' ? 3 : 1;
export function takeEnemyHit(enemy) {
  if (!enemy.alive) return false;
  enemy.hp = Math.max(0, enemy.hp - 1);
  return enemy.hp === 0;
}
