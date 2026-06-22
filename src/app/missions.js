/**
 * missions.js — orchestrates formations + pathing on the shared model.
 * These are the "verbs" the Inspector/Toolbar invoke; they translate algorithm
 * output (formations.js / pathfinding.js) into model mutations on the store.
 */
import { getState, actions } from './store.js';
import { airFormation, groundFormation, caging } from '../sim/formations.js';
import { findPath2D } from '../sim/pathfinding.js';
import { dist } from '../sim/geometry.js';
import { toShape } from '../model/entities.js';
import { obstaclesAt, pathKey } from '../model/selectors.js';

/** Assign available drones into a formation around an object, in the current frame. */
export function generateFormation(objectId, kind = 'auto') {
  const s = getState();
  const obj = s.entities.find((e) => e.id === objectId && e.kind === 'object');
  if (!obj) return;
  const fid = s.currentFrameId;
  const center = obj.frames[fid];
  if (!center) return;

  let pool = s.entities.filter((e) => e.kind === 'drone' && !e.assignedTo);
  if (kind === 'air') pool = pool.filter((d) => d.droneType === 'air');
  else if (kind === 'ground') pool = pool.filter((d) => d.droneType !== 'air');
  if (!pool.length) {
    actions.toast(`No available ${kind === 'auto' ? '' : kind + ' '}drones`, 'warning');
    return;
  }
  pool = [...pool].sort((a, b) => dist(a.frames[fid], center) - dist(b.frames[fid], center));

  const shape = toShape(obj);
  const slots = new Map(); // droneId -> {x,y,z} offset
  const air = pool.filter((d) => d.droneType === 'air');
  const ground = pool.filter((d) => d.droneType !== 'air');
  if (kind === 'ground') {
    groundFormation(shape, pool.length, { standoff: s.settings.standoff }).forEach((o, i) =>
      slots.set(pool[i].id, { x: o.x, y: o.y, z: 0 })
    );
  } else if (kind === 'air') {
    airFormation(shape, pool.length, { altitude: s.settings.altitude, standoff: s.settings.standoff }).forEach((o, i) =>
      slots.set(pool[i].id, o)
    );
  } else {
    if (air.length)
      airFormation(shape, air.length, { altitude: s.settings.altitude, standoff: s.settings.standoff }).forEach((o, i) =>
        slots.set(air[i].id, o)
      );
    if (ground.length)
      groundFormation(shape, ground.length, { standoff: s.settings.standoff }).forEach((o, i) =>
        slots.set(ground[i].id, { x: o.x, y: o.y, z: 0 })
      );
  }

  const assigned = pool.map((d) => d.id);
  actions.apply((st) => ({
    entities: st.entities.map((e) => {
      if (e.id === objectId) {
        return { ...e, transport: true, assignedDrones: assigned };
      }
      if (slots.has(e.id)) {
        const off = slots.get(e.id);
        return {
          ...e,
          assignedTo: objectId,
          offset: off,
          frames: {
            ...e.frames,
            [fid]: { x: center.x + off.x, y: center.y + off.y, z: off.z || 0, rotation: 0 },
          },
          frameIds: e.frameIds.includes(fid) ? e.frameIds : [...e.frameIds, fid],
        };
      }
      return e;
    }),
  }));
  actions.toast(`${assigned.length} drones in formation`, 'success');
}

/** Encircle (caging) variant — tighter ring. */
export function generateCaging(objectId) {
  const s = getState();
  const obj = s.entities.find((e) => e.id === objectId && e.kind === 'object');
  if (!obj) return;
  const fid = s.currentFrameId;
  const center = obj.frames[fid];
  let pool = s.entities.filter((e) => e.kind === 'drone' && !e.assignedTo);
  if (!pool.length) {
    actions.toast('No available drones', 'warning');
    return;
  }
  pool = [...pool].sort((a, b) => dist(a.frames[fid], center) - dist(b.frames[fid], center));
  const offs = caging(toShape(obj), pool.length, { standoff: s.settings.standoff });
  const assigned = pool.map((d) => d.id);
  actions.apply((st) => ({
    entities: st.entities.map((e) => {
      if (e.id === objectId) return { ...e, transport: true, assignedDrones: assigned };
      const idx = pool.findIndex((d) => d.id === e.id);
      if (idx >= 0) {
        const off = { x: offs[idx].x, y: offs[idx].y, z: e.droneType === 'air' ? s.settings.altitude : 0 };
        return {
          ...e,
          assignedTo: objectId,
          offset: off,
          frames: { ...e.frames, [fid]: { x: center.x + off.x, y: center.y + off.y, z: off.z, rotation: 0 } },
          frameIds: e.frameIds.includes(fid) ? e.frameIds : [...e.frameIds, fid],
        };
      }
      return e;
    }),
  }));
  actions.toast(`${assigned.length} drones caging`, 'success');
}

export function clearFormation(objectId) {
  actions.apply((st) => ({
    entities: st.entities.map((e) => {
      if (e.id === objectId) return { ...e, transport: false, assignedDrones: [] };
      if (e.assignedTo === objectId) return { ...e, assignedTo: null, offset: null };
      return e;
    }),
  }));
}

/** Auto-route an object's path across a transition, avoiding obstacles. */
export function autoPathObject(objectId, fromId, toId) {
  const s = getState();
  const obj = s.entities.find((e) => e.id === objectId);
  const from = obj?.frames[fromId];
  const to = obj?.frames[toId];
  if (!from || !to) return;
  const obstacles = obstaclesAt(s, fromId, { exclude: [objectId] });
  const path = findPath2D(from, to, obstacles, { margin: 18 });
  actions.apply((st) => ({
    entities: st.entities.map((e) =>
      e.id === objectId ? { ...e, paths: { ...e.paths, [pathKey(fromId, toId)]: path } } : e
    ),
  }));
  actions.toast('Path routed', 'success');
}

/** Store a hand-drawn path for an object transition or a drone destination. */
export function setPath(entityId, fromId, toId, points) {
  actions.apply((st) => ({
    entities: st.entities.map((e) => {
      if (e.id !== entityId) return e;
      if (e.kind === 'object') {
        return { ...e, paths: { ...e.paths, [pathKey(fromId, toId)]: points } };
      }
      return {
        ...e,
        frames: { ...e.frames, [toId]: { ...e.frames[toId], path: points } },
      };
    }),
  }));
}

export function clearPath(entityId, fromId, toId) {
  actions.apply((st) => ({
    entities: st.entities.map((e) => {
      if (e.id !== entityId) return e;
      if (e.kind === 'object') {
        const paths = { ...e.paths };
        delete paths[pathKey(fromId, toId)];
        return { ...e, paths };
      }
      const f = { ...e.frames[toId] };
      delete f.path;
      return { ...e, frames: { ...e.frames, [toId]: f } };
    }),
  }));
}
