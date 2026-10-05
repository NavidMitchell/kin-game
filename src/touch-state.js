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
