// Level sanity checker: simulates Kin's jumps (same physics constants as the game) between every pair of
// surfaces and reports whether the exit, checkpoints and pickups can be reached from the start.
//   npm run check-levels
import { readFileSync, readdirSync } from 'node:fs';
import { parseLevel } from '../src/levels/parse.js';
import { GRAV, RUN, JUMP_V, JET_THRUST, JET_SPEED, MAX_FALL, ACC_AIR, PLAYER_W, PLAYER_H } from '../src/config.js';

const DT = 1 / 240, HALF = PLAYER_W / 2, CEIL_FEET = 80 + PLAYER_H;
const files = readdirSync('src/levels').filter(f => /^level\d+\.json$/.test(f)).sort((a, b) => parseInt(a.slice(5)) - parseInt(b.slice(5)));
let failed = false;

for (const [i, f] of files.entries()) {
  const L = parseLevel(JSON.parse(readFileSync('src/levels/' + f, 'utf8')), i);
  const res = check(L);
  const ok = res.exit;
  failed ||= !ok;
  console.log(`${ok ? '✓' : '✗'} Level ${L.id} ${L.name}: exit ${ok ? 'reachable' : 'NOT reachable'}` +
    `, ${res.surfaces} surfaces, ${res.reached} reached` +
    (res.cps.length ? `, unreachable checkpoints at x=${res.cps.join(', ')}` : '') +
    (res.chips.length ? `, ${res.chips.length}/${L.chips.length} chips out of reach (x=${res.chips.map(c => c.x).join(', ')})` : `, all ${L.chips.length} chips reachable`) +
    (res.items.length ? `, unreachable pickups at x=${res.items.join(', ')}` : ''));
}
process.exit(failed ? 1 : 0);

function check(L) {
  // standable surfaces: solid tops, ledges, and sampled positions of each mover
  const S = [];
  for (const s of L.solids) S.push({ x0: s.x, x1: s.x + s.w, y: s.y, solid: true });
  for (const f of L.floats) S.push({ x0: f.x, x1: f.x + f.w, y: f.y });
  L.movers.forEach((m, mi) => {
    for (const k of [0, .25, .5, .75, 1]) S.push({ x0: m.x + m.dx * k, x1: m.x + m.dx * k + m.w, y: m.y + m.dy * k, mover: mi });
  });
  const solids = L.solids;
  const hitsSolid = (x, feet) => solids.some(r => x + HALF > r.x && x - HALF < r.x + r.w && feet > r.y + .5 && feet - PLAYER_H < r.y + r.h);
  const under = p => S.findIndex(s => p.x >= s.x0 - HALF && p.x <= s.x1 + HALF && Math.abs(s.y - p.y) < 2);
  const touched = [];   // sampled body-centre points, for pickups

  // one trajectory: ctrl(t, x, feet, vy) -> { dir, thrust, hold }
  function fly(x, feet, vx, vy, ctrl, jet = false, maxT = 3.2) {
    for (let t = 0; t < maxT; t += DT) {
      const c = ctrl(t, x, feet, vy);
      const target = c.dir * RUN;
      vx = vx < target ? Math.min(target, vx + ACC_AIR * DT) : Math.max(target, vx - ACC_AIR * DT);
      if (jet && c.thrust) vy = Math.max(-JET_SPEED, vy - JET_THRUST * DT);
      else { if (!c.hold && vy < -300 && !jet) vy = -300; vy = Math.min(vy + GRAV * DT, MAX_FALL); }
      const nx = x + vx * DT;
      if (!hitsSolid(nx, feet)) x = nx; else vx = 0;
      const nf = feet + vy * DT;
      if (vy >= 0) {
        const land = S.findIndex(s => x + HALF > s.x0 && x - HALF < s.x1 && feet <= s.y + .5 && nf >= s.y);
        if (land >= 0) return land;
      }
      if (hitsSolid(x, nf)) { vy = 0; } else feet = nf;
      if (jet && feet < CEIL_FEET) { feet = CEIL_FEET; vy = Math.max(0, vy); }
      if (Math.round(t / DT) % 6 === 0) touched.push([x, feet - 50]);
      if (feet > L.height + 120) return -1;
    }
    return -1;
  }

  const edges = S.map(() => new Set());
  const reachable = new Set();
  const start = under(L.start);
  const queue = [start]; reachable.add(start);
  const boosts = L.boosts.map(b => ({ ...b, s: under(b) }));

  while (queue.length) {
    const si = queue.shift(), s = S[si];
    const add = j => { if (j >= 0 && !reachable.has(j)) { reachable.add(j); queue.push(j); } };
    for (let x = s.x0; x <= s.x1; x += 12) touched.push([x, s.y - 50]);
    if (s.mover !== undefined) S.forEach((o, j) => { if (o.mover === s.mover) add(j); });
    // jumps and walk-offs from points along the surface
    const xs = []; for (let x = s.x0 + 2; x <= s.x1 - 2; x += 16) xs.push(x); xs.push(s.x1 - 2, s.x1 + HALF - 1, s.x0 - HALF + 1);
    for (const x0 of xs) for (const d of [1, -1]) {
      if (hitsSolid(x0, s.y)) continue;
      for (const v0 of [0, RUN * .5, RUN]) for (const holdT of [.06, .16, 99]) add(fly(x0, s.y, v0 * d, JUMP_V, t => ({ dir: d, hold: t < holdT })));
      add(fly(x0 + d * HALF, s.y, RUN * d, 0, () => ({ dir: d, hold: false })));
    }
    // jet flights from any surface holding a booster
    if (boosts.some(b => b.s === si)) {
      for (const d of [1, -1]) for (let alt = CEIL_FEET; alt < L.height; alt += 60) for (let rel = 100; rel <= 2000; rel += 100) {
        const bx = boosts.find(b => b.s === si).x;
        add(fly(bx, s.y, RUN * d, JUMP_V, (t, x, feet) => ({ dir: d, thrust: Math.abs(x - bx) < rel && feet > alt, hold: true }), true, 7));
      }
    }
  }

  const exitS = under(L.exit);
  const near = (p, r) => touched.some(([x, y]) => Math.abs(x - p.x) < r && Math.abs(y - p.y) < r);
  return {
    surfaces: S.length, reached: reachable.size,
    exit: exitS >= 0 && reachable.has(exitS),
    cps: L.checkpoints.filter(c => !reachable.has(under(c))).map(c => c.x),
    chips: L.chips.filter(c => !near(c, 44)),
    items: [...L.boosts, ...L.repairs].filter(b => !reachable.has(under(b))).map(b => b.x),
  };
}
