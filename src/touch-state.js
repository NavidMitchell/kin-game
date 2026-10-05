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

// Relative to the finger's landing point; diagonals combine movement and flight.
export function padDirections(dx, dy, deadzone = 14) {
  const codes = [];
  if (dx < -deadzone) codes.push('ArrowLeft');
  if (dx > deadzone) codes.push('ArrowRight');
  if (dy < -deadzone) codes.push('Space');
  if (dy > deadzone) codes.push('ArrowDown');
  return codes;
}
