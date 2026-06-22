/**
 * engine.js — the live swarm engine. Builds a Matter world from the current
 * keyframe, gives every drone a DroneAgent, assigns a mission behavior, and
 * steps perception → comms → control → physics each tick. Emergent, local,
 * decentralized — exactly what the dormant agent layer was built for.
 */
import Matter from 'matter-js';
import { PhysicsWorld } from './physics.js';
import DroneAgent from './agents/DroneAgent.js';
import { messageBus } from './agents/MessageBus.js';
import { BEHAVIORS, MISSION_BEHAVIOR } from './behaviors.js';
import { airFormation, groundFormation, caging } from './formations.js';
import { toShape } from '../model/entities.js';

const SLOT_MISSIONS = new Set(['formation', 'caging', 'transport']);

export class SwarmEngine {
  constructor() {
    this.world = null;
    this.agents = new Map(); // entityId -> DroneAgent
    this.byBody = new Map(); // bodyId(string) -> DroneAgent
    this.zMap = new Map(); // entityId -> altitude
    this.time = 0;
    this.collisions = 0;
  }

  build(snapshot) {
    this.destroy();
    const { entities, frameId, settings, bounds } = snapshot;
    this.entities = entities;
    this.frameId = frameId;
    this.settings = settings;
    this.bounds = bounds;
    this.world = new PhysicsWorld(bounds);
    messageBus.clear();
    messageBus.setCommRange(settings.commRange ?? 300);

    for (const e of entities) {
      const t = e.frames[frameId];
      if (!t) continue;
      if (e.kind === 'object') {
        this.world.addObject({ ...e, isTarget: e.id === snapshot.focusId }, t);
      } else {
        const body = this.world.addDrone(e, t);
        const agent = new DroneAgent(body, this.world.engine, {
          entityId: e.id,
          sensorRadius: e.sensorRadius,
          maxSpeed: e.maxSpeed,
        });
        this.agents.set(e.id, agent);
        this.byBody.set(String(body.id), agent);
        this.zMap.set(e.id, t.z || 0);
      }
    }

    // count only drone↔object contacts (drone↔drone jostling is expected in a swarm)
    this.collisions = 0;
    Matter.Events.on(this.world.engine, 'collisionStart', (ev) => {
      for (const p of ev.pairs) {
        const labels = [p.bodyA.label, p.bodyB.label];
        const hasDrone = labels.includes('drone');
        const hitsObject = labels.some((l) => l === 'object' || l === 'obstacle' || l === 'target');
        if (hasDrone && hitsObject) this.collisions++;
      }
    });
    this._msgLog = [];

    this.configure(snapshot);
  }

  configure(snapshot) {
    this.mission = snapshot.mission || 'idle';
    this.goal = snapshot.goal || null;
    messageBus.setCommRange(this.settings.commRange ?? 300);
    this.focus =
      this.entities.find((e) => e.id === snapshot.focusId && e.kind === 'object') ||
      this.entities.find((e) => e.kind === 'object') ||
      null;
    this.focusId = this.focus?.id || null;
    this.focusRadius = this.focus
      ? this.focus.radius || Math.hypot(this.focus.w || 100, this.focus.h || 100) / 2
      : 0;

    const behavior = BEHAVIORS[MISSION_BEHAVIOR[this.mission] || 'idle'];
    for (const a of this.agents.values()) a.setBehavior(behavior);

    this.slotOffsets = new Map();
    if (SLOT_MISSIONS.has(this.mission) && this.focus) {
      const ids = this.focus.assignedDrones?.length
        ? this.focus.assignedDrones
        : [...this.agents.keys()];
      const participants = ids.map((id) => this.entities.find((e) => e.id === id)).filter(Boolean);
      this._assignSlots(participants);
    }
  }

  _assignSlots(participants) {
    const shape = toShape(this.focus);
    if (!participants.length) return;
    if (this.mission === 'caging' || this.mission === 'transport') {
      const offs = caging(shape, participants.length, { standoff: this.settings.standoff });
      participants.forEach((e, i) =>
        this.slotOffsets.set(e.id, { x: offs[i].x, y: offs[i].y, z: e.droneType === 'air' ? this.settings.altitude : 0 })
      );
    } else {
      const air = participants.filter((e) => e.droneType === 'air');
      const ground = participants.filter((e) => e.droneType !== 'air');
      if (air.length) {
        const offs = airFormation(shape, air.length, { altitude: this.settings.altitude, standoff: this.settings.standoff });
        air.forEach((e, i) => this.slotOffsets.set(e.id, offs[i]));
      }
      if (ground.length) {
        const offs = groundFormation(shape, ground.length, { standoff: this.settings.standoff });
        ground.forEach((e, i) => this.slotOffsets.set(e.id, { x: offs[i].x, y: offs[i].y, z: 0 }));
      }
    }
  }

  step(dtMs) {
    if (!this.world) return;
    this.time += dtMs;
    messageBus.resetTick();

    const focusBody = this.focusId ? this.world.getBody(this.focusId) : null;
    const focusPos = focusBody ? focusBody.position : null;

    if (this.mission === 'transport' && focusBody && this.goal) {
      const dx = this.goal.x - focusBody.position.x;
      const dy = this.goal.y - focusBody.position.y;
      const d = Math.hypot(dx, dy);
      if (d > 4) {
        const sp = Math.min(3.5, d * 0.04) * (dtMs / 16);
        Matter.Body.setPosition(focusBody, {
          x: focusBody.position.x + (dx / d) * sp,
          y: focusBody.position.y + (dy / d) * sp,
        });
      }
    }

    const slots = new Map();
    if (this.slotOffsets.size && focusPos) {
      for (const [id, off] of this.slotOffsets) {
        slots.set(id, { x: focusPos.x + off.x, y: focusPos.y + off.y, z: off.z || 0 });
      }
    }

    const ctx = {
      mission: this.mission,
      settings: this.settings,
      bounds: this.bounds,
      time: this.time,
      goal: this.goal,
      targetId: this.focusId,
      target: focusPos ? { x: focusPos.x, y: focusPos.y, radius: this.focusRadius } : null,
      slots,
    };

    for (const a of this.agents.values()) a.update(dtMs, ctx);
    this.world.step(dtMs);

    // rolling 1s message-delivery rate
    this._msgLog.push({ t: this.time, n: messageBus.deliveredThisTick });
    while (this._msgLog.length && this.time - this._msgLog[0].t > 1000) this._msgLog.shift();

    // kinematic altitude: ease toward slot z, cruise, or ground
    for (const [id] of this.agents) {
      const e = this.entities.find((x) => x.id === id);
      const isAir = e?.droneType === 'air';
      let targetZ = 0;
      if (slots.has(id)) targetZ = slots.get(id).z || 0;
      else if (isAir) targetZ = this.settings.altitude || 0;
      const z = this.zMap.get(id) || 0;
      this.zMap.set(id, z + (targetZ - z) * 0.08);
    }
  }

  /** Current transforms for every entity (id -> {x,y,z,rotation}). */
  getTransforms() {
    const out = {};
    for (const e of this.entities) {
      const t = this.world.transformOf(e.id);
      if (!t) continue;
      if (e.kind === 'drone') {
        const agent = this.agents.get(e.id);
        const v = agent ? agent.velocity : { x: 0, y: 0 };
        const moving = Math.hypot(v.x, v.y) > 0.4;
        out[e.id] = {
          x: t.x,
          y: t.y,
          z: this.zMap.get(e.id) || 0,
          rotation: moving ? (Math.atan2(v.y, v.x) * 180) / Math.PI : (out[e.id]?.rotation || 0),
        };
      } else {
        out[e.id] = { x: t.x, y: t.y, z: e.frames[this.frameId]?.z || 0, rotation: t.rotation };
      }
    }
    return out;
  }

  getTelemetry() {
    const links = [];
    for (const [a, b] of messageBus.links()) {
      const A = this.byBody.get(a);
      const B = this.byBody.get(b);
      if (A && B) links.push({ a: A.position, b: B.position });
    }
    const msgRate = (this._msgLog || []).reduce((s, e) => s + e.n, 0);
    return {
      messages: msgRate, // deliveries over the last ~1s
      links,
      collisions: this.collisions,
      commRange: messageBus.commRange,
    };
  }

  destroy() {
    for (const a of this.agents.values()) a.destroy();
    this.agents.clear();
    this.byBody.clear();
    this.zMap.clear();
    if (this.world) {
      Matter.Events.off(this.world.engine);
      this.world.destroy();
      this.world = null;
    }
    messageBus.clear();
  }
}
