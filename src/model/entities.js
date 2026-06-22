/**
 * entities.js — the single unified entity model.
 *
 * One schema describes both physical OBJECTS (targets / obstacles) and DRONES.
 * Every entity stores a transform per keyframe (`frames[frameId]`); the keyframe
 * layer interpolates between them, while the live-physics layer reads/writes the
 * same transforms. This is the shared model that lets keyframes + physics +
 * the agent swarm operate on one source of truth.
 */
import { v4 as uuid } from 'uuid';
import { polygonBounds, scalePolygon } from '../sim/geometry.js';

export const DRONE_DEFAULTS = {
  air: { sensorRadius: 200, maxSpeed: 6, color: 'var(--color-air)', altitude: 70 },
  ground: { sensorRadius: 160, maxSpeed: 5, color: 'var(--color-ground)', altitude: 0 },
};

/** Regular-polygon / preset shapes available in the library. */
function presetPolygon(type) {
  switch (type) {
    case 'triangle':
      return [
        { x: 0, y: -50 },
        { x: 50, y: 43 },
        { x: -50, y: 43 },
      ];
    case 'hexagon':
      return Array.from({ length: 6 }, (_, i) => {
        const a = (i * 60 - 90) * (Math.PI / 180);
        return { x: 50 * Math.cos(a), y: 50 * Math.sin(a) };
      });
    case 'pentagon':
      return Array.from({ length: 5 }, (_, i) => {
        const a = (i * 72 - 90) * (Math.PI / 180);
        return { x: 50 * Math.cos(a), y: 50 * Math.sin(a) };
      });
    case 'star':
      return Array.from({ length: 10 }, (_, i) => {
        const a = (i * 36 - 90) * (Math.PI / 180);
        const r = i % 2 === 0 ? 50 : 22;
        return { x: r * Math.cos(a), y: r * Math.sin(a) };
      });
    default:
      return null;
  }
}

let nameCounters = {};
function nextName(prefix) {
  nameCounters[prefix] = (nameCounters[prefix] || 0) + 1;
  return `${prefix} ${nameCounters[prefix]}`;
}
export function resetNameCounters(entities = []) {
  nameCounters = {};
  for (const e of entities) {
    const m = /^(.*?)\s+(\d+)$/.exec(e.name || '');
    if (m) nameCounters[m[1]] = Math.max(nameCounters[m[1]] || 0, parseInt(m[2], 10));
  }
}

/** Create a physical object entity. */
export function makeObject(type, frameId, x, y) {
  const base = {
    id: uuid(),
    kind: 'object',
    frames: { [frameId]: { x, y, z: 0, rotation: 0 } },
    frameIds: [frameId],
    weight: 10,
    height: 40,
    locked: false,
    obstacle: false,
    noFly: false,
    groupId: null,
    transport: false,
    assignedDrones: [],
    paths: {},
  };

  if (type === 'circle') {
    return { ...base, name: nextName('Circle'), shape: 'circle', radius: 50 };
  }
  if (type === 'rectangle' || type === 'square') {
    return { ...base, name: nextName('Box'), shape: 'rectangle', w: 100, h: 100 };
  }
  const poly = presetPolygon(type);
  if (poly) {
    const b = polygonBounds(poly);
    return {
      ...base,
      name: nextName(type[0].toUpperCase() + type.slice(1)),
      shape: 'polygon',
      polygon: poly,
      w: b.width,
      h: b.height,
    };
  }
  // fallback
  return { ...base, name: nextName('Box'), shape: 'rectangle', w: 100, h: 100 };
}

/** Create a custom polygon object from absolute drawn points. */
export function makePolygonObject(points, frameId) {
  const b = polygonBounds(points);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  return {
    id: uuid(),
    kind: 'object',
    name: nextName('Shape'),
    shape: 'polygon',
    polygon: points.map((p) => ({ x: p.x - cx, y: p.y - cy })),
    w: b.width || 1,
    h: b.height || 1,
    frames: { [frameId]: { x: cx, y: cy, z: 0, rotation: 0 } },
    frameIds: [frameId],
    weight: 10,
    height: 40,
    locked: false,
    obstacle: false,
    noFly: false,
    groupId: null,
    transport: false,
    assignedDrones: [],
    paths: {},
  };
}

/** Create a drone entity. */
export function makeDrone(droneType, frameId, x, y) {
  const d = DRONE_DEFAULTS[droneType] || DRONE_DEFAULTS.air;
  return {
    id: uuid(),
    kind: 'drone',
    name: nextName(droneType === 'air' ? 'Air' : 'Ground'),
    droneType,
    radius: 12,
    frames: { [frameId]: { x, y, z: 0, rotation: 0 } },
    frameIds: [frameId],
    sensorRadius: d.sensorRadius,
    maxSpeed: d.maxSpeed,
    locked: false,
    groupId: null,
    // formation assignment (drone -> object)
    assignedTo: null,
    offset: null,
  };
}

/** Convert an entity at a frame into a world-positioned Obstacle descriptor. */
export function toObstacle(entity, frameId) {
  const f = entity.frames[frameId] || { x: 0, y: 0, rotation: 0, z: 0 };
  return {
    id: entity.id,
    x: f.x,
    y: f.y,
    z: f.z || 0,
    rotation: f.rotation || 0,
    shape: entity.shape,
    w: entity.w,
    h: entity.h,
    radius: entity.radius,
    polygon: entity.polygon,
    height: entity.height || 40,
    noFly: !!entity.noFly,
  };
}

/** A LOCAL shape descriptor (for formation calculation). */
export function toShape(entity) {
  return {
    shape: entity.shape,
    w: entity.w,
    h: entity.h,
    radius: entity.radius,
    polygon: entity.polygon,
  };
}

/** Absolute polygon vertices for rendering a polygon entity at a frame. */
export function renderPolygon(entity) {
  if (entity.shape !== 'polygon' || !entity.polygon) return null;
  return scalePolygon(entity.polygon, entity.w, entity.h);
}

export const newFrame = (name) => ({ id: uuid(), name: name || 'Keyframe' });
