/**
 * interpolation.js — keyframe interpolation: easing, path traversal,
 * Catmull-Rom smoothing. All 3D-aware ({x,y,z}). Used for keyframe playback
 * and for rendering smooth path previews.
 */
import { clamp, normalizeDeg } from './geometry.js';

export const EASING = {
  linear: (t) => t,
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => t * (2 - t),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
  easeOutBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

export function ease(progress, type = 'linear') {
  const fn = EASING[type] || EASING.linear;
  return fn(clamp(progress, 0, 1));
}

export function pathLength(points) {
  if (!points || points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    total += Math.sqrt(
      (b.x - a.x) ** 2 + (b.y - a.y) ** 2 + ((b.z || 0) - (a.z || 0)) ** 2
    );
  }
  return total;
}

/** Point + heading at a target arc-length distance along the path. */
export function pointAtDistance(points, target) {
  if (!points || points.length === 0) return { x: 0, y: 0, z: 0, rotation: 0 };
  if (points.length === 1) {
    const p = points[0];
    return { x: p.x, y: p.y, z: p.z || 0, rotation: 0 };
  }
  let acc = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const seg = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + ((b.z || 0) - (a.z || 0)) ** 2);
    if (acc + seg >= target || i === points.length - 2) {
      const t = seg > 0 ? clamp((target - acc) / seg, 0, 1) : 0;
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: (a.z || 0) + ((b.z || 0) - (a.z || 0)) * t,
        rotation: normalizeDeg((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI),
      };
    }
    acc += seg;
  }
  const last = points[points.length - 1];
  return { x: last.x, y: last.y, z: last.z || 0, rotation: 0 };
}

/** Interpolate along a polyline using eased progress (0..1). */
export function interpAlongPath(points, progress, easing = 'linear') {
  if (!points || points.length === 0) return { x: 0, y: 0, z: 0, rotation: 0 };
  if (points.length === 1) return { ...points[0], z: points[0].z || 0, rotation: 0 };
  const eased = ease(progress, easing);
  return pointAtDistance(points, pathLength(points) * eased);
}

/** Linear blend between two transforms with eased progress. */
export function lerpTransform(a, b, progress, easing = 'linear') {
  const t = ease(progress, easing);
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: (a.z || 0) + ((b.z || 0) - (a.z || 0)) * t,
    rotation: (a.rotation || 0) + (((b.rotation || 0) - (a.rotation || 0)) * t),
  };
}

/** Catmull-Rom smoothing of a polyline for nicer path previews (2D + z carried). */
export function smoothPath(points, segments = 12) {
  if (!points || points.length < 3) return points || [];
  const out = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 1; s <= segments; s++) {
      const t = s / segments;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
        z: p1.z != null ? p1.z + ((p2.z || 0) - (p1.z || 0)) * t : undefined,
      });
    }
  }
  return out;
}
