// Progress saved in the browser: highest unlocked level and best score per level.
const KEY = 'kin_save_v2';

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function write(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage blocked */ }
}

export const save = {
  unlocked() { return read().unlocked || 1; },
  best(level) { return (read().best || {})[level] || 0; },
  totalBest() { return Object.values(read().best || {}).reduce((a, b) => a + b, 0); },
  // records a finished level; returns true when it is a new best
  complete(level, score, levelCount) {
    const d = read(); d.best = d.best || {};
    const isBest = score > (d.best[level] || 0);
    if (isBest) d.best[level] = score;
    d.unlocked = Math.min(levelCount, Math.max(d.unlocked || 1, level + 1));
    write(d);
    return isBest;
  },
};
