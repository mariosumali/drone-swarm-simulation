/**
 * SensorSystem — environment perception for a drone: proximity sensing,
 * raycasting, and clear-path checks against the live Matter world.
 */
import Matter from 'matter-js';

export default class SensorSystem {
  constructor(engine) {
    this.engine = engine;
  }

  sense(position, radius, selfId = null) {
    const empty = { objects: [], drones: [], walls: [], target: null, all: [] };
    if (!this.engine) return empty;
    const bodies = Matter.Composite.allBodies(this.engine.world);
    const result = { ...empty, objects: [], drones: [], walls: [], all: [] };

    for (const body of bodies) {
      if (body.id === selfId) continue;
      const distance = Math.hypot(position.x - body.position.x, position.y - body.position.y);
      if (distance > radius) continue;
      const info = {
        id: body.id,
        entityId: body.plugin?.entityId,
        position: { x: body.position.x, y: body.position.y },
        velocity: body.velocity ? { x: body.velocity.x, y: body.velocity.y } : { x: 0, y: 0 },
        angle: body.angle,
        distance,
        label: body.label,
        isStatic: body.isStatic,
      };
      if (body.label === 'wall') result.walls.push(info);
      else if (body.label === 'drone') result.drones.push(info);
      else if (body.label === 'target') {
        result.target = info;
        result.objects.push(info);
      } else result.objects.push(info);
      result.all.push(info);
    }
    result.objects.sort((a, b) => a.distance - b.distance);
    result.drones.sort((a, b) => a.distance - b.distance);
    result.walls.sort((a, b) => a.distance - b.distance);
    return result;
  }

  raycast(origin, direction, maxDistance = 500, selfId = null) {
    if (!this.engine) return null;
    const len = Math.hypot(direction.x, direction.y) || 1;
    const dir = { x: direction.x / len, y: direction.y / len };
    const end = { x: origin.x + dir.x * maxDistance, y: origin.y + dir.y * maxDistance };
    let closest = null;
    let closestDist = maxDistance;

    for (const body of Matter.Composite.allBodies(this.engine.world)) {
      if (body.id === selfId) continue;
      if (!this._lineHitsAABB(origin, end, body.bounds)) continue;
      const verts = body.vertices;
      for (let i = 0; i < verts.length; i++) {
        const hit = this._segHit(origin, end, verts[i], verts[(i + 1) % verts.length]);
        if (hit) {
          const d = Math.hypot(origin.x - hit.x, origin.y - hit.y);
          if (d < closestDist) {
            closestDist = d;
            closest = { point: hit, distance: d, label: body.label, entityId: body.plugin?.entityId };
          }
        }
      }
    }
    return closest;
  }

  isPathClear(from, to, selfId = null) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.hypot(dx, dy) || 1;
    const hit = this.raycast(from, { x: dx / distance, y: dy / distance }, distance, selfId);
    return hit === null;
  }

  _lineHitsAABB(p1, p2, b) {
    return !(
      Math.max(p1.x, p2.x) < b.min.x ||
      Math.min(p1.x, p2.x) > b.max.x ||
      Math.max(p1.y, p2.y) < b.min.y ||
      Math.min(p1.y, p2.y) > b.max.y
    );
  }

  _segHit(p1, p2, p3, p4) {
    const d = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
    if (Math.abs(d) < 1e-6) return null;
    const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / d;
    const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / d;
    if (ua < 0 || ua > 1 || ub < 0 || ub > 1) return null;
    return { x: p1.x + ua * (p2.x - p1.x), y: p1.y + ua * (p2.y - p1.y) };
  }
}
