/**
 * behaviors.js — decentralized mission behaviors. Each is (agent, ctx, dt) and
 * acts ONLY through the DroneAgent API (sense / neighbors / setDesiredVelocity),
 * so coordination is genuinely local + emergent. The engine picks a behavior
 * per mission and supplies ctx (focal target, goal, formation slots, bounds).
 */

/* ---- shared steering helpers ---- */
function avoidWalls(agent, ctx) {
  const b = ctx.bounds;
  if (!b) return { x: 0, y: 0 };
  const p = agent.position;
  const m = 70;
  let fx = 0, fy = 0;
  if (p.x - b.minX < m) fx += (m - (p.x - b.minX)) / m;
  if (b.maxX - p.x < m) fx -= (m - (b.maxX - p.x)) / m;
  if (p.y - b.minY < m) fy += (m - (p.y - b.minY)) / m;
  if (b.maxY - p.y < m) fy -= (m - (b.maxY - p.y)) / m;
  return { x: fx * agent.maxSpeed, y: fy * agent.maxSpeed };
}

function avoidObstacles(agent, sensed) {
  let fx = 0, fy = 0;
  for (const o of sensed.objects) {
    if (o.distance < 1) continue;
    const w = Math.max(0, 1 - o.distance / agent.sensorRadius);
    fx += ((agent.position.x - o.position.x) / o.distance) * w * w;
    fy += ((agent.position.y - o.position.y) / o.distance) * w * w;
  }
  for (const w of sensed.walls) {
    if (w.label !== 'wall') continue;
  }
  return { x: fx * agent.maxSpeed, y: fy * agent.maxSpeed };
}

/** Throttled status broadcast so the comm mesh carries real traffic. */
function gossip(agent, ctx, payload) {
  if ((ctx.time || 0) - (agent.memory.lastMsg || -999) > 220) {
    agent.memory.lastMsg = ctx.time || 0;
    agent.broadcast(payload);
  }
}

/* ---- behaviors ---- */
export function idle(agent) {
  agent.stop();
}

/** Boids: separation + alignment + cohesion + wander, sensed locally. */
export function flock(agent, ctx) {
  const s = agent.sense();
  const neighbors = s.drones;
  let sep = { x: 0, y: 0 };
  let ali = { x: 0, y: 0 };
  let coh = { x: 0, y: 0 };
  let count = 0;

  for (const n of neighbors) {
    if (n.distance < 36 && n.distance > 0.001) {
      sep.x += (agent.position.x - n.position.x) / n.distance;
      sep.y += (agent.position.y - n.position.y) / n.distance;
    }
    ali.x += n.velocity.x;
    ali.y += n.velocity.y;
    coh.x += n.position.x;
    coh.y += n.position.y;
    count++;
  }

  let vx = 0, vy = 0;
  if (count > 0) {
    ali.x /= count; ali.y /= count;
    coh.x = coh.x / count - agent.position.x;
    coh.y = coh.y / count - agent.position.y;
    vx += sep.x * 1.6 + ali.x * 0.5 + coh.x * 0.012;
    vy += sep.y * 1.6 + ali.y * 0.5 + coh.y * 0.012;
  }

  // gentle wander keeps the swarm alive when isolated
  const t = (ctx.time || 0) * 0.001 + (agent.id % 17);
  vx += Math.cos(t) * 0.6;
  vy += Math.sin(t * 1.3) * 0.6;

  const oa = avoidObstacles(agent, s);
  const wa = avoidWalls(agent, ctx);
  agent.setDesiredVelocity(vx + oa.x + wa.x, vy + oa.y + wa.y);
  gossip(agent, ctx, { kind: 'flock', vx, vy });
}

/** Converge on the focal target while spacing out and dodging obstacles. */
export function seek(agent, ctx) {
  const target = ctx.goal || ctx.target;
  if (!target) return idle(agent);
  const s = agent.sense();
  let vx = 0, vy = 0;
  const dx = target.x - agent.position.x;
  const dy = target.y - agent.position.y;
  const d = Math.hypot(dx, dy) || 1;
  const standoff = (ctx.target?.radius || 0) + 40;
  const drive = Math.min(agent.maxSpeed, Math.max(-agent.maxSpeed, (d - standoff) * 0.08));
  vx += (dx / d) * drive;
  vy += (dy / d) * drive;

  // separation from other drones
  for (const n of s.drones) {
    if (n.distance < 34 && n.distance > 0.001) {
      vx += ((agent.position.x - n.position.x) / n.distance) * 1.4;
      vy += ((agent.position.y - n.position.y) / n.distance) * 1.4;
    }
  }
  const oa = avoidObstacles(agent, { objects: s.objects.filter((o) => o.entityId !== ctx.targetId), walls: [] });
  agent.setDesiredVelocity(vx + oa.x, vy + oa.y);
  gossip(agent, ctx, { kind: 'seek', d });
}

/** Spread out to maximize coverage. */
export function disperse(agent, ctx) {
  const s = agent.sense();
  let vx = 0, vy = 0;
  for (const n of s.drones) {
    if (n.distance > 0.001) {
      const w = Math.max(0, 1 - n.distance / agent.sensorRadius);
      vx += ((agent.position.x - n.position.x) / n.distance) * w * 2;
      vy += ((agent.position.y - n.position.y) / n.distance) * w * 2;
    }
  }
  const wa = avoidWalls(agent, ctx);
  if (Math.hypot(vx, vy) < 0.05) {
    const t = (ctx.time || 0) * 0.0008 + agent.id;
    vx = Math.cos(t); vy = Math.sin(t);
  }
  agent.setDesiredVelocity(vx + wa.x * 2, vy + wa.y * 2);
}

/** Hold an assigned formation/cage slot (slot supplied by the engine). */
export function holdSlot(agent, ctx) {
  const slot = ctx.slots?.get(agent.entityId);
  if (!slot) return idle(agent);
  // light separation so converging drones don't collide into the same slot
  const s = agent.sense(50);
  let ax = 0, ay = 0;
  for (const n of s.drones) {
    if (n.distance < 26 && n.distance > 0.001) {
      ax += ((agent.position.x - n.position.x) / n.distance) * 0.8;
      ay += ((agent.position.y - n.position.y) / n.distance) * 0.8;
    }
  }
  const dx = slot.x - agent.position.x + ax;
  const dy = slot.y - agent.position.y + ay;
  const d = Math.hypot(dx, dy) || 1;
  const speed = Math.min(agent.maxSpeed, d * 0.14);
  agent.setDesiredVelocity((dx / d) * speed, (dy / d) * speed);
  gossip(agent, ctx, { kind: 'slot', arrived: d < 6 });
}

export const BEHAVIORS = { idle, flock, seek, disperse, holdSlot };

/** Maps a mission name to the behavior + how the engine should build ctx. */
export const MISSION_BEHAVIOR = {
  idle: 'idle',
  flock: 'flock',
  seek: 'seek',
  disperse: 'disperse',
  formation: 'holdSlot',
  caging: 'holdSlot',
  transport: 'holdSlot',
};
