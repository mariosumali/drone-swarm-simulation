/**
 * selectors.js — derived reads over the unified model. Pure functions of state.
 * The canvas asks these "where is everything right now?" for keyframe/edit mode.
 * (Live physics mode supplies its own transforms from the engine.)
 */
import { interpAlongPath, lerpTransform } from '../sim/interpolation.js';
import { toObstacle } from './entities.js';

export const pathKey = (fromId, toId) => `${fromId}->${toId}`;

export function frameIndex(state, id = state.currentFrameId) {
  return state.frames.findIndex((f) => f.id === id);
}

/** The from/to frames for the currently-playing transition. */
export function transitionFrames(state) {
  const i = frameIndex(state);
  const from = state.frames[i];
  const to = state.frames[Math.min(i + 1, state.frames.length - 1)];
  return { from, to, isLast: i >= state.frames.length - 1 };
}

/** Custom path (array of points) for an entity across a transition, if any. */
export function transitionPath(entity, fromId, toId) {
  if (entity.kind === 'object') {
    return entity.paths?.[pathKey(fromId, toId)] || null;
  }
  // drones store their travel path on the destination frame
  return entity.frames[toId]?.path || null;
}

const fallback = (t) => t || { x: 0, y: 0, z: 0, rotation: 0 };

/** The transform to render an entity at, given current edit/playback state. */
export function entityTransformAt(entity, state) {
  const { sim } = state;
  // editing (not playing) or live engine handled elsewhere → static current frame
  if (!sim.playing || sim.engine !== 'keyframe') {
    return fallback(entity.frames[state.currentFrameId] || firstFrame(entity, state));
  }
  const { from, to, isLast } = transitionFrames(state);
  if (isLast || from.id === to.id) {
    return fallback(entity.frames[from.id]);
  }
  const a = entity.frames[from.id];
  const b = entity.frames[to.id];
  if (!a && !b) return { x: 0, y: 0, z: 0, rotation: 0 };
  if (!a) return fallback(b);
  if (!b) return fallback(a);

  const path = transitionPath(entity, from.id, to.id);
  if (path && path.length >= 2) {
    const p = interpAlongPath(path, sim.progress, state.settings.easing);
    // keep a stable facing for drones; objects can rotate to path tangent
    return { ...p, rotation: entity.kind === 'drone' ? (b.rotation || 0) : p.rotation };
  }
  return lerpTransform(a, b, sim.progress, state.settings.easing);
}

function firstFrame(entity, state) {
  for (const f of state.frames) if (entity.frames[f.id]) return entity.frames[f.id];
  return null;
}

/** Map of id -> transform for keyframe/edit display. */
export function displayTransforms(state) {
  const map = {};
  for (const e of state.entities) map[e.id] = entityTransformAt(e, state);
  return map;
}

/** Obstacles (world-positioned) active at a frame, optionally excluding ids. */
export function obstaclesAt(state, frameId, { exclude = [], onlyFlagged = true } = {}) {
  const ex = new Set(exclude);
  return state.entities
    .filter(
      (e) =>
        e.kind === 'object' &&
        !ex.has(e.id) &&
        e.frames[frameId] &&
        (!onlyFlagged || e.obstacle)
    )
    .map((e) => toObstacle(e, frameId));
}

export const selectedEntities = (state) =>
  state.entities.filter((e) => state.selectedIds.includes(e.id));

export const entityById = (state, id) => state.entities.find((e) => e.id === id);

/** Group selection expansion: clicking one grouped entity selects its group. */
export function expandSelection(state, id, additive) {
  const e = entityById(state, id);
  const ids = e?.groupId
    ? state.entities.filter((x) => x.groupId === e.groupId).map((x) => x.id)
    : [id];
  if (!additive) return ids;
  const set = new Set(state.selectedIds);
  ids.forEach((x) => set.add(x));
  return Array.from(set);
}
