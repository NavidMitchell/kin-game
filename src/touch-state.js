// Track each finger independently; releasing one must not cancel another button.
export function touchState() {
  const pointers = new Map();
  return {
    press(id, codes) { pointers.set(id, codes); },
    release(id) { pointers.delete(id); },
    held(code) { return [...pointers.values()].some(codes => codes.includes(code)); },
    clear() { pointers.clear(); },
  };
}

// Separate engage/release thresholds prevent finger jitter toggling movement.
export function padDirections(dx, dy, deadzone = 14, previous = []) {
  const codes = [];
  const threshold = code => previous.includes(code) ? deadzone * .55 : deadzone;
  if (dx < -threshold('ArrowLeft')) codes.push('ArrowLeft');
  if (dx > threshold('ArrowRight')) codes.push('ArrowRight');
  if (dy < -threshold('Space')) codes.push('Space');
  if (dy > threshold('ArrowDown')) codes.push('ArrowDown');
  return codes;
}
