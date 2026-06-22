/**
 * DroneAgent — the per-drone API: perception (sense/raycast), communication
 * (broadcast/send), and motor control (force / PID velocity / moveToward).
 * The engine assigns each agent a behavior and calls update() every tick — this
 * is the wiring the original codebase was missing.
 */
import Matter from 'matter-js';
import { messageBus } from './MessageBus.js';
import SensorSystem from './SensorSystem.js';

export default class DroneAgent {
  constructor(body, engine, options = {}) {
    this.body = body;
    this.engine = engine;
    this.id = body.id;
    this.entityId = options.entityId;
    this.sensors = new SensorSystem(engine);

    this.role = options.role || 'worker';
    this.sensorRadius = options.sensorRadius || 200;
    this.maxForce = options.maxForce || 0.006;
    this.maxSpeed = options.maxSpeed || 5;

    this.pid = { ix: 0, iy: 0, ex: 0, ey: 0, kP: 0.012, kI: 0.0002, kD: 0.006 };
    this.handlers = [];
    this.behavior = null;
    this.memory = {}; // scratch space for behaviors
    this.inbox = [];

    messageBus.subscribe(String(this.id), (m) => this._onMessage(m), () => this.position);
  }

  /* ---- perception ---- */
  get position() {
    return { x: this.body.position.x, y: this.body.position.y };
  }
  get velocity() {
    return { x: this.body.velocity.x, y: this.body.velocity.y };
  }
  get heading() {
    const v = this.velocity;
    return Math.atan2(v.y, v.x);
  }
  sense(radius = null) {
    return this.sensors.sense(this.position, radius || this.sensorRadius, this.id);
  }
  raycast(angle, maxDistance = 400) {
    return this.sensors.raycast(this.position, { x: Math.cos(angle), y: Math.sin(angle) }, maxDistance, this.id);
  }
  canSee(target) {
    return this.sensors.isPathClear(this.position, target, this.id);
  }

  /* ---- communication ---- */
  broadcast(message) {
    messageBus.broadcast(String(this.id), message, this.position);
  }
  send(droneId, message) {
    return messageBus.send(String(this.id), String(droneId), message, this.position);
  }
  neighbors() {
    return messageBus.getDronesInRange(this.position).filter((id) => id !== String(this.id));
  }
  onMessage(cb) {
    this.handlers.push(cb);
  }

  /* ---- actuation ---- */
  applyForce(fx, fy) {
    const mag = Math.hypot(fx, fy);
    if (mag > this.maxForce) {
      fx = (fx / mag) * this.maxForce;
      fy = (fy / mag) * this.maxForce;
    }
    Matter.Body.applyForce(this.body, this.body.position, { x: fx, y: fy });
  }

  setDesiredVelocity(vx, vy) {
    const mag = Math.hypot(vx, vy);
    if (mag > this.maxSpeed) {
      vx = (vx / mag) * this.maxSpeed;
      vy = (vy / mag) * this.maxSpeed;
    }
    const v = this.velocity;
    const ex = vx - v.x;
    const ey = vy - v.y;
    const { kP, kI, kD } = this.pid;
    this.pid.ix = (this.pid.ix + ex) * 0.96;
    this.pid.iy = (this.pid.iy + ey) * 0.96;
    const fx = kP * ex + kI * this.pid.ix + kD * (ex - this.pid.ex);
    const fy = kP * ey + kI * this.pid.iy + kD * (ey - this.pid.ey);
    this.pid.ex = ex;
    this.pid.ey = ey;
    this.applyForce(fx, fy);
  }

  moveToward(target, speed = 1) {
    const dx = target.x - this.position.x;
    const dy = target.y - this.position.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1.5) {
      this.stop();
      return;
    }
    // ease into the target so drones settle instead of orbiting
    const desired = Math.min(this.maxSpeed * speed, dist * 0.12);
    this.setDesiredVelocity((dx / dist) * desired, (dy / dist) * desired);
  }

  stop() {
    this.setDesiredVelocity(0, 0);
  }

  /* ---- behavior ---- */
  setBehavior(fn) {
    this.behavior = fn;
  }
  update(dt, ctx) {
    // drain inbox into handlers
    if (this.inbox.length) {
      for (const m of this.inbox) for (const h of this.handlers) h(m);
      this.inbox.length = 0;
    }
    if (this.behavior) {
      try {
        this.behavior(this, ctx, dt);
      } catch (e) {
        // surface once, then disable to avoid console spam
        if (!this._errored) console.error('behavior error', e);
        this._errored = true;
      }
    }
  }

  _onMessage(m) {
    this.inbox.push(m);
  }

  destroy() {
    messageBus.unsubscribe(String(this.id));
  }
}
