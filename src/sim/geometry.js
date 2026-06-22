/**
 * geometry.js — shared geometric primitives used across pathfinding, formations,
 * collision, hit-testing and rendering. Pure functions, no dependencies.
 *
 * Coordinate convention: world space with +x right, +y down (screen-like),
 * +z up (altitude). Polygons are arrays of {x,y} in LOCAL space centred on the
 * entity origin. An "Obstacle" is a world-positioned shape descriptor:
 *
 *   { x, y, shape:'rectangle'|'circle'|'polygon',
 *     w, h, radius, polygon:[{x,y}], rotation (deg), height, noFly }
 */

export const TAU = Math.PI * 2;
export const toRad = (deg) => (deg * Math.PI) / 180;
export const toDeg = (rad) => (rad * 180) / Math.PI;
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/** Normalise an angle in degrees to [0, 360). */
export const normalizeDeg = (deg) => ((deg % 360) + 360) % 360;

export function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function dist3(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function lerpPoint(a, b, t) {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z || 0, b.z || 0, t),
  };
}

/** Rotate a point around an origin by `deg` degrees. */
export function rotatePoint(pt, deg, origin = { x: 0, y: 0 }) {
  if (!deg) return { x: pt.x, y: pt.y };
  const r = toRad(deg);
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const dx = pt.x - origin.x;
  const dy = pt.y - origin.y;
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

/** Axis-aligned bounding box of a list of points. */
export function polygonBounds(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * Scale a local polygon so its bounding box matches w×h, keeping it centred.
 * Mirrors the scaling used by the 3D/2D renderers so collisions match visuals.
 */
export function scalePolygon(polygon, w, h) {
  if (!polygon || polygon.length === 0) return [];
  const b = polygonBounds(polygon);
  const sx = b.width ? w / b.width : 1;
  const sy = b.height ? h / b.height : 1;
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  return polygon.map((p) => ({ x: (p.x - cx) * sx, y: (p.y - cy) * sy }));
}

/** Ray-casting point-in-polygon test (polygon = absolute world vertices). */
export function pointInPolygon(pt, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Distance from a point to a line segment. */
export function pointToSegment(pt, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq ? ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / lenSq : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(pt.x - (a.x + t * dx), pt.y - (a.y + t * dy));
}

/** Segment-segment intersection test. */
export function segmentsIntersect(p1, p2, p3, p4) {
  const d = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
  if (Math.abs(d) < 1e-9) return false;
  const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / d;
  const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / d;
  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}

/**
 * Absolute world vertices for an obstacle's footprint (rectangle/polygon).
 * Circles return null (handled analytically).
 */
export function worldPolygon(ob) {
  if (ob.shape === 'circle') return null;
  let local;
  if (ob.shape === 'polygon' && ob.polygon?.length) {
    local = scalePolygon(ob.polygon, ob.w, ob.h);
  } else {
    const w = ob.w || (ob.radius ? ob.radius * 2 : 100);
    const h = ob.h || (ob.radius ? ob.radius * 2 : 100);
    local = [
      { x: -w / 2, y: -h / 2 },
      { x: w / 2, y: -h / 2 },
      { x: w / 2, y: h / 2 },
      { x: -w / 2, y: h / 2 },
    ];
  }
  return local.map((p) => {
    const r = rotatePoint(p, ob.rotation || 0);
    return { x: r.x + ob.x, y: r.y + ob.y };
  });
}

/** Is a point inside an obstacle (with optional inflation margin)? */
export function pointInObstacle(pt, ob, margin = 0) {
  if (ob.shape === 'circle') {
    return dist(pt, ob) <= (ob.radius || 0) + margin;
  }
  const poly = worldPolygon(ob);
  if (!poly) return false;
  if (pointInPolygon(pt, poly)) return true;
  if (margin > 0) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      if (pointToSegment(pt, poly[j], poly[i]) <= margin) return true;
    }
  }
  return false;
}

/** Does a segment cross an obstacle (with margin)? Exact for polygons/circles. */
export function segmentIntersectsObstacle(p1, p2, ob, margin = 0) {
  if (pointInObstacle(p1, ob, margin) || pointInObstacle(p2, ob, margin)) return true;
  if (ob.shape === 'circle') {
    return pointToSegment(ob, p1, p2) <= (ob.radius || 0) + margin;
  }
  const poly = worldPolygon(ob);
  if (!poly) return false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if (segmentsIntersect(p1, p2, poly[j], poly[i])) return true;
    if (margin > 0 && pointToSegment(poly[i], p1, p2) <= margin) return true;
  }
  return false;
}

/** Inflated axis-aligned bounds of an obstacle. */
export function obstacleBounds(ob, margin = 0) {
  if (ob.shape === 'circle') {
    const r = (ob.radius || 0) + margin;
    return { minX: ob.x - r, minY: ob.y - r, maxX: ob.x + r, maxY: ob.y + r };
  }
  const poly = worldPolygon(ob);
  const b = polygonBounds(poly);
  return {
    minX: b.minX - margin,
    minY: b.minY - margin,
    maxX: b.maxX + margin,
    maxY: b.maxY + margin,
  };
}

/** Approximate "radius" of an obstacle from its centre — handy for spacing. */
export function obstacleRadius(ob) {
  if (ob.shape === 'circle') return ob.radius || 0;
  const w = ob.w || (ob.radius ? ob.radius * 2 : 100);
  const h = ob.h || (ob.radius ? ob.radius * 2 : 100);
  return Math.hypot(w, h) / 2;
}
