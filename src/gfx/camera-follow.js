// Exponential smoothing has the same response at different refresh rates.
export const easeCamera = (current, target, rate, dt) => current + (target - current) * -Math.expm1(-rate * Math.max(0, dt));
export function cameraLead(current, velocity, runSpeed, dt) {
  const target = Math.max(-1, Math.min(1, velocity / runSpeed)) * 120;
  return easeCamera(current, target, 3, dt);
}
