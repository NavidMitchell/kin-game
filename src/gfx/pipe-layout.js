// Seeded layouts stay stable across restarts without repeating arithmetic patterns.
export function pipeLayout({ x, y, w, h }) {
  if (h < 116 || w < 81) return [];
  let seed = (Math.imul(Math.round(x), 73856093) ^ Math.imul(Math.round(y), 19349663)
    ^ Math.imul(Math.round(w), 83492791) ^ Math.round(h)) >>> 0;
  const random = () => {
    seed += 0x6D2B79F5;
    let t = seed;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  const count = Math.max(1, Math.floor(w / 260)), runs = [];
  let previous = -1;
  for (let i = 0; i < count; i++) {
    const px = x + w / count * (i + .3 + random() * .4);
    const slack = Math.min(65, (h - 116) * .2);
    const top = y + random() * slack, bottom = y + h - random() * slack;
    const flip = random() < .5, pieces = [];
    let py = top + 57;
    const end = bottom - 57;
    // Different lead-in lengths stagger fittings on neighboring pipes.
    const lead = Math.min(end - py, random() * 100);
    if (lead > 0) pieces.push({ y: py, h: lead, frame: null });
    py += lead;
    while (py + 240 <= end) {
      const choices = [0, 1, 2, 3].filter(f => f !== previous);
      const frame = choices[Math.floor(random() * choices.length)];
      previous = frame;
      pieces.push({ y: py, h: 240, frame, flip: random() < .5 });
      py += 240;
      const gap = Math.min(end - py, 20 + random() * 110);
      if (gap > 0) pieces.push({ y: py, h: gap, frame: null });
      py += gap;
    }
    if (py < end) pieces.push({ y: py, h: end - py, frame: null });
    runs.push({ x: px, top, bottom, flip, pieces });
  }
  return runs;
}
