// Turns a Tiled map (JSON, object layers only) into the plain level description the game builds from.
// Pure JS with no Phaser imports, so tools/check-levels.mjs can use it too.
//
// Layers
//   Platforms (object layer, rectangles)
//     ground  solid block: you can stand on it and it stops you from the sides
//     float   one-way ledge you can jump up through (only its width matters)
//     mover   one-way ledge that travels: dx, dy (px), period (s), phase (0..1)
//   Entities (object layer, mostly points; y is the surface the thing stands on)
//     start, exit, checkpoint
//     drone | skimmer   range (px each side of x it patrols)
//     chips             count, spacing (px, default 48), arc (bool, default true)
//     tank | egg        jet booster (respawns a few seconds after pickup)
//     repair            restores one life core
//     hint              text (shown in the world)
// Map properties: name, subtitle, color, bgTint, bgHue (degrees), wall (optional tower art: red | magenta | orange | green; none = plain ground),
//                 bpm, transpose, par (seconds)

const props = o => Object.fromEntries((o.properties || []).map(p => [p.name, p.value]));
// Tiled stores colours as #AARRGGBB
const color = (c, d) => !c ? d : c.length === 9 ? '#' + c.slice(3) : c;
const kind = o => (o.type || o.class || o.name || '').toLowerCase();

export function parseLevel(map, index) {
  const mp = props(map);
  const L = {
    index, id: index + 1,
    name: mp.name || `Level ${index + 1}`, subtitle: mp.subtitle || '',
    color: color(mp.color, '#35e9ff'), bgTint: color(mp.bgTint, '#ffffff'),
    bgHue: mp.bgHue || 0, wall: mp.wall || null, bpm: mp.bpm || 144, transpose: mp.transpose || 0, par: mp.par || 120,
    width: map.width * map.tilewidth, height: map.height * map.tileheight,
    solids: [], floats: [], movers: [],
    start: null, exit: null, checkpoints: [],
    enemies: [], chips: [], boosts: [], repairs: [], hints: [],
  };
  for (const layer of map.layers) {
    if (layer.type !== 'objectgroup') continue;
    for (const o of layer.objects) {
      const k = kind(o), p = props(o);
      const x = Math.round(o.x), y = Math.round(o.y), w = Math.round(o.width || 0), h = Math.round(o.height || 0);
      switch (k) {
        case 'ground': L.solids.push({ x, y, w, h }); break;
        case 'float': L.floats.push({ x, y, w }); break;
        case 'mover': L.movers.push({ x, y, w, dx: p.dx || 0, dy: p.dy || 0, period: p.period || 4, phase: p.phase || 0 }); break;
        case 'start': L.start = { x, y }; break;
        case 'exit': L.exit = { x, y }; break;
        case 'checkpoint': L.checkpoints.push({ x, y }); break;
        case 'drone': case 'skimmer': L.enemies.push({ type: k, x, y, range: p.range ?? 120 }); break;
        case 'chips': {
          const n = p.count || 3, sp = p.spacing || 48, arc = p.arc !== false;
          for (let i = 0; i < n; i++) L.chips.push({ x: x + i * sp, y: y - (arc ? Math.sin(i / (n - 1 || 1) * Math.PI) * 30 : 0) });
          break;
        }
        case 'tank': case 'egg': L.boosts.push({ type: k, x, y }); break;
        case 'repair': L.repairs.push({ x, y }); break;
        case 'hint': L.hints.push({ x, y, text: p.text || o.name || '' }); break;
        default: console.warn(`Level ${index + 1}: unknown object type "${k}"`);
      }
    }
  }
  if (!L.start) throw new Error(`Level ${index + 1} has no start`);
  if (!L.exit) throw new Error(`Level ${index + 1} has no exit`);
  L.checkpoints.sort((a, b) => a.x - b.x);
  return L;
}

// Gaps between solid ground that reaches the bottom of the map: these are the pits.
export function findPits(L) {
  const floor = L.solids.filter(s => s.y + s.h >= L.height - 1).sort((a, b) => a.x - b.x);
  const pits = [];
  let edge = 0, edgeTop = floor.length ? floor[0].y : L.height;
  for (const s of floor) {
    if (s.x - edge > 30) pits.push({ x0: edge, x1: s.x, top: Math.min(edgeTop, s.y) });
    if (s.x + s.w > edge) { edge = s.x + s.w; edgeTop = s.y; }
  }
  if (L.width - edge > 30) pits.push({ x0: edge, x1: L.width, top: edgeTop });
  return pits;
}
