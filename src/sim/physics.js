/**
 * physics.js — a thin, clean Matter.js wrapper for the live swarm engine.
 *
 * Top-down plane: gravity is OFF; drones move under agent forces and push
 * objects through real collisions. Altitude (z) is kinematic (Matter is 2D),
 * tracked separately by the engine. Replaces the old dead agents/PhysicsWorld.js.
 */
import Matter from 'matter-js';
import { scalePolygon } from './geometry.js';

const { Engine, Bodies, Body, Composite } = Matter;

export class PhysicsWorld {
  constructor(bounds) {
    this.engine = Engine.create();
    this.engine.gravity.scale = 0; // top-down: no global gravity
    this.world = this.engine.world;
    this.bodies = new Map(); // entityId -> Matter body
    this.byBodyId = new Map(); // Matter body.id -> entityId
    this.walls = [];
    this.setBounds(bounds);
  }

  setBounds(b) {
    for (const w of this.walls) Composite.remove(this.world, w);
    this.walls = [];
    if (!b) return;
    const t = 200;
    const opts = { isStatic: true, label: 'wall', restitution: 0.3 };
    const w = b.maxX - b.minX;
    const h = b.maxY - b.minY;
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    this.walls = [
      Bodies.rectangle(cx, b.minY - t / 2, w + t * 2, t, opts),
      Bodies.rectangle(cx, b.maxY + t / 2, w + t * 2, t, opts),
      Bodies.rectangle(b.minX - t / 2, cy, t, h + t * 2, opts),
      Bodies.rectangle(b.maxX + t / 2, cy, t, h + t * 2, opts),
    ];
    Composite.add(this.world, this.walls);
  }

  addObject(entity, t) {
    // Objects are fixed anchors the swarm orbits/avoids. Transport targets are
    // still static bodies but moved kinematically by the engine toward a goal,
    // so escort drones can't fling them across the arena.
    const label = entity.obstacle ? 'obstacle' : entity.isTarget ? 'target' : 'object';
    const opts = {
      isStatic: true,
      label,
      frictionAir: 0.12,
      friction: 0.4,
      restitution: 0.1,
      density: 0.002 * (entity.weight ? entity.weight / 10 : 1),
      angle: ((t.rotation || 0) * Math.PI) / 180,
    };
    let body;
    if (entity.shape === 'circle') {
      body = Bodies.circle(t.x, t.y, entity.radius || 50, opts);
    } else if (entity.shape === 'polygon' && entity.polygon?.length) {
      const verts = scalePolygon(entity.polygon, entity.w, entity.h);
      body = Bodies.fromVertices(t.x, t.y, [verts], opts) ||
        Bodies.rectangle(t.x, t.y, entity.w || 100, entity.h || 100, opts);
    } else {
      body = Bodies.rectangle(t.x, t.y, entity.w || 100, entity.h || 100, opts);
    }
    this._register(entity.id, body);
    return body;
  }

  addDrone(entity, t) {
    const body = Bodies.circle(t.x, t.y, entity.radius || 12, {
      label: 'drone',
      frictionAir: 0.18,
      restitution: 0.2,
      density: 0.001,
    });
    this._register(entity.id, body);
    return body;
  }

  _register(entityId, body) {
    body.plugin = { entityId };
    this.bodies.set(entityId, body);
    this.byBodyId.set(body.id, entityId);
    Composite.add(this.world, body);
  }

  remove(entityId) {
    const body = this.bodies.get(entityId);
    if (!body) return;
    Composite.remove(this.world, body);
    this.bodies.delete(entityId);
    this.byBodyId.delete(body.id);
  }

  getBody(entityId) {
    return this.bodies.get(entityId);
  }

  transformOf(entityId) {
    const b = this.bodies.get(entityId);
    if (!b) return null;
    return {
      x: b.position.x,
      y: b.position.y,
      rotation: (b.angle * 180) / Math.PI,
    };
  }

  step(dtMs) {
    Engine.update(this.engine, Math.min(dtMs, 32));
  }

  setPosition(entityId, x, y) {
    const b = this.bodies.get(entityId);
    if (b) Body.setPosition(b, { x, y });
  }

  clear() {
    for (const b of this.bodies.values()) Composite.remove(this.world, b);
    this.bodies.clear();
    this.byBodyId.clear();
  }

  destroy() {
    this.clear();
    Engine.clear(this.engine);
  }
}
