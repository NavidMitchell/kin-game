import { ATK_ANIM_TIME } from '../config.js';

// Read sequence indices and timing from the artwork manifest; repeated indices are intentional.
export function animationFrame(animation, seconds, duration) {
  const { frames, frameRate, repeat, durationsMs } = animation;
  const times = durationsMs ?? frames.map(() => 1000 / frameRate);
  const total = times.reduce((a, b) => a + b, 0);
  let elapsed = Math.max(0, seconds) * 1000;
  if (duration !== undefined) elapsed = Math.min(elapsed / (duration * 1000), 1) * total;
  else if (repeat === -1) elapsed %= total;
  for (let i = 0; i < frames.length; i++) {
    if (elapsed < times[i]) return frames[i];
    elapsed -= times[i];
  }
  return frames.at(-1);
}

export function kinFrame(map, { state, t, jet, thrust, vy, landT }) {
  const prefix = jet ? 'jet_' : '';
  const active = jet && thrust;
  if (state === 'attack') {
    const attackPrefix = active ? 'jet_thrust_' : prefix;
    return animationFrame(map.animations[attackPrefix + 'fire'], t, ATK_ANIM_TIME);
  }
  if (active) return animationFrame(map.animations.jet_thrust, t);
  if (state === 'jump') {
    const pose = vy < -500 ? 'riseFast' : vy < -150 ? 'riseSlow' : vy < 150 ? 'apex' : vy < 600 ? 'fallSlow' : 'fallFast';
    return map.airPoses[prefix + 'air'][pose];
  }
  if (state === 'duck') return map.animations[prefix + 'duck'].frames[0];
  if (landT > 0) return animationFrame(map.animations[prefix + 'land'], .12 - landT, .12);
  return animationFrame(map.animations[prefix + (state === 'run' ? 'run' : 'idle')], t);
}
