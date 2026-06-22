/**
 * formations.js — drone-swarm formation generators.
 *
 * Every exported function takes a LOCAL shape descriptor for the target and a
 * drone `count`, and returns an array of OFFSETS relative to the target's
 * CENTRE (the caller adds the target's world position). All functions are
 * pure and fully deterministic (no Math.random); calling with identical
 * arguments always yields identical results, and the returned array length is
 * ALWAYS exactly `count`.
 *
 * Target descriptor:
 *   { shape:'rectangle'|'circle'|'polygon',
 *     w, h, radius, polygon:[{x,y}] (local, centred on origin) }
 *
 * Options (all optional):
 *   { standoff=30, altitude=70, spacing=40, padding=10 }
 *     standoff — gap OUTSIDE the perimeter for ground/caging rings
 *     altitude — z for air formations (hover altitude)
 *     spacing  — drone separation for line/grid formations
 *     padding  — inset used when sampling the air footprint
 */

import {
  TAU,
  scalePolygon,
  polygonBounds,
  pointInPolygon,
} from './geometry.js';

const DEFAULTS = { standoff: 30, altitude: 70, spacing: 40, padding: 10 };

// ---------------------------------------------------------------------------
// internal helpers
// ---------------------------------------------------------------------------

/** Small seeded LCG (deterministic pseudo-random in [0,1)). */
function makeLcg(seed) {
  let s = (seed >>> 0) || 1;
  return function next() {
    // Numerical Recipes LCG constants.
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function centroidOf(points) {
  let sx = 0;
  let sy = 0;
  const n = points.length || 1;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / n, y: sy / n };
}

/**
 * Build the LOCAL footprint polygon (centred on origin) for any shape.
 * Circles are approximated by a regular polygon whose resolution scales with
 * the requested point count for smoother sampling.
 */
function footprintPolygon(target, segments) {
  if (!target) return [];
  const shape = target.shape;

  if (shape === 'circle') {
    const r = target.radius || (target.w ? target.w / 2 : 50);
    const m = Math.max(24, segments || 0);
    const poly = [];
    for (let i = 0; i < m; i++) {
      const a = (i / m) * TAU;
      poly.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
    }
    return poly;
  }

  if (shape === 'polygon' && target.polygon && target.polygon.length >= 3) {
    const w = target.w || polygonBounds(target.polygon).width || 100;
    const h = target.h || polygonBounds(target.polygon).height || 100;
    return scalePolygon(target.polygon, w, h);
  }

  // rectangle (and fallback)
  const w = target.w || (target.radius ? target.radius * 2 : 100);
  const h = target.h || (target.radius ? target.radius * 2 : 100);
  return [
    { x: -w / 2, y: -h / 2 },
    { x: w / 2, y: -h / 2 },
    { x: w / 2, y: h / 2 },
    { x: -w / 2, y: h / 2 },
  ];
}

/** Signed area; positive for counter-clockwise winding (in +y-down space). */
function signedArea(poly) {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += poly[j].x * poly[i].y - poly[i].x * poly[j].y;
  }
  return a / 2;
}

/**
 * Inflate (offset outward) a simple polygon by `amount` by pushing each vertex
 * along the average of its two adjacent edge outward normals. Robust enough for
 * the convex/mildly-concave footprints used here; falls back to the original
 * vertex when an edge is degenerate.
 */
function inflatePolygon(poly, amount) {
  if (amount === 0 || poly.length < 3) return poly.map((p) => ({ ...p }));
  // Outward direction depends on winding. For CCW polygons the outward normal
  // of edge (a->b) is (dy, -dx) normalised; flip for CW.
  const ccw = signedArea(poly) > 0;
  const out = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const prev = poly[(i - 1 + n) % n];
    const cur = poly[i];
    const next = poly[(i + 1) % n];

    const n1 = edgeNormal(prev, cur, ccw);
    const n2 = edgeNormal(cur, next, ccw);
    let nx = n1.x + n2.x;
    let ny = n1.y + n2.y;
    const len = Math.hypot(nx, ny);
    if (len < 1e-9) {
      out.push({ x: cur.x, y: cur.y });
      continue;
    }
    nx /= len;
    ny /= len;
    // Miter scaling so offset distance stays ~constant at corners.
    const cosHalf = nx * n1.x + ny * n1.y;
    const scale = cosHalf > 1e-3 ? amount / cosHalf : amount;
    out.push({ x: cur.x + nx * scale, y: cur.y + ny * scale });
  }
  return out;
}

function edgeNormal(a, b, ccw) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return { x: 0, y: 0 };
  // outward normal
  const nx = ccw ? dy / len : -dy / len;
  const ny = ccw ? -dx / len : dx / len;
  return { x: nx, y: ny };
}

/**
 * Sample `count` points evenly along a closed polygon's perimeter by
 * cumulative arc length. Returns exactly `count` points (count > 0).
 */
function samplePerimeter(poly, count) {
  if (count <= 0) return [];
  const n = poly.length;
  if (n === 0) return Array.from({ length: count }, () => ({ x: 0, y: 0 }));
  if (n === 1) return Array.from({ length: count }, () => ({ ...poly[0] }));

  const edgeLen = new Array(n);
  let perimeter = 0;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    edgeLen[i] = l;
    perimeter += l;
  }

  // Degenerate perimeter: all vertices coincide.
  if (perimeter < 1e-9) {
    return Array.from({ length: count }, () => ({ ...poly[0] }));
  }

  const step = perimeter / count;
  const result = [];
  let edge = 0;
  let edgeStart = 0; // cumulative length at start of current edge
  for (let k = 0; k < count; k++) {
    const target = k * step;
    while (edge < n - 1 && edgeStart + edgeLen[edge] < target - 1e-9) {
      edgeStart += edgeLen[edge];
      edge++;
    }
    const a = poly[edge];
    const b = poly[(edge + 1) % n];
    const len = edgeLen[edge] || 1;
    const t = Math.min(1, Math.max(0, (target - edgeStart) / len));
    result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return result;
}

/**
 * Shared perimeter-ring builder for ground/caging formations.
 * For circles we space points by exact angle at radius `radius + standoff`
 * (uniform magnitude); for everything else we walk the inflated footprint.
 */
function perimeterRing(target, count, standoff) {
  if (count <= 0) return [];
  if (!target) return Array.from({ length: count }, () => ({ x: 0, y: 0 }));

  if (target.shape === 'circle') {
    const r = (target.radius || (target.w ? target.w / 2 : 50)) + standoff;
    const result = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU;
      result.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
    }
    return result;
  }

  const poly = footprintPolygon(target);
  const inflated = inflatePolygon(poly, standoff);
  return samplePerimeter(inflated, count);
}

/** Force an offsets array to be exactly `count` long (deterministic). */
function fitCount(points, count, fill) {
  if (points.length === count) return points;
  if (points.length > count) return points.slice(0, count);
  const out = points.slice();
  while (out.length < count) {
    out.push({ ...(out.length ? out[out.length % (points.length || 1)] : fill) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// CCVT (Centroidal Voronoi Tessellation via Lloyd relaxation)
// ---------------------------------------------------------------------------

/**
 * Deterministically sample points inside a polygon footprint. Uses a regular
 * grid over the bounding box plus a tiny seeded jitter (NOT Math.random) so
 * that relaxation has a smooth density field to work against.
 */
function sampleInsidePolygon(poly, approxCount) {
  const b = polygonBounds(poly);
  const w = b.width || 1;
  const h = b.height || 1;
  // Grid resolution chosen to comfortably exceed approxCount after rejection.
  const aspect = w / h;
  let cols = Math.max(4, Math.ceil(Math.sqrt(approxCount * aspect)));
  let rows = Math.max(4, Math.ceil(approxCount / cols));
  // Oversample because rejection discards points outside the polygon.
  const over = 2;
  cols *= over;
  rows *= over;

  const rng = makeLcg(0x9e3779b9);
  const samples = [];
  const cellW = w / cols;
  const cellH = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const jx = (rng() - 0.5) * cellW * 0.5;
      const jy = (rng() - 0.5) * cellH * 0.5;
      const x = b.minX + (c + 0.5) * cellW + jx;
      const y = b.minY + (r + 0.5) * cellH + jy;
      if (pointInPolygon({ x, y }, poly)) samples.push({ x, y });
    }
  }

  // Fallback for skinny / tiny polygons: ensure we have at least some samples.
  if (samples.length === 0) {
    const c = centroidOf(poly.length ? poly : [{ x: 0, y: 0 }]);
    samples.push({ x: c.x, y: c.y });
  }
  return samples;
}

/** Deterministic farthest-point seeding of `k` sites from sample set. */
function farthestPointInit(samples, k) {
  // First seed: sample nearest to the centroid (deterministic, not RNG).
  const c = centroidOf(samples);
  let firstIdx = 0;
  let bestD = Infinity;
  for (let i = 0; i < samples.length; i++) {
    const d = dist2(samples[i], c);
    if (d < bestD) {
      bestD = d;
      firstIdx = i;
    }
  }

  const sites = [{ x: samples[firstIdx].x, y: samples[firstIdx].y }];
  const minD2 = new Array(samples.length);
  for (let i = 0; i < samples.length; i++) minD2[i] = dist2(samples[i], sites[0]);

  while (sites.length < k) {
    let farIdx = 0;
    let farD = -1;
    for (let i = 0; i < samples.length; i++) {
      if (minD2[i] > farD) {
        farD = minD2[i];
        farIdx = i;
      }
    }
    const ns = { x: samples[farIdx].x, y: samples[farIdx].y };
    sites.push(ns);
    for (let i = 0; i < samples.length; i++) {
      const d = dist2(samples[i], ns);
      if (d < minD2[i]) minD2[i] = d;
    }
  }
  return sites;
}

/**
 * Balanced (≈equal-mass) assignment of samples to sites: each site gets a
 * capacity differing by at most 1, samples processed in a deterministic order
 * go to their nearest site that still has capacity. Approximates a capacitated
 * Voronoi partition, which keeps Lloyd relaxation evenly spread.
 */
function balancedAssign(samples, sites) {
  const k = sites.length;
  const n = samples.length;
  const base = Math.floor(n / k);
  const rem = n % k;
  const remaining = new Array(k);
  for (let j = 0; j < k; j++) remaining[j] = base + (j < rem ? 1 : 0);

  // Deterministic order (x then y then index).
  const order = samples
    .map((p, idx) => ({ p, idx }))
    .sort((a, b) => a.p.x - b.p.x || a.p.y - b.p.y || a.idx - b.idx);

  const clusters = Array.from({ length: k }, () => []);
  for (const { p } of order) {
    let bestJ = -1;
    let bestD = Infinity;
    for (let j = 0; j < k; j++) {
      if (remaining[j] <= 0) continue;
      const d = dist2(p, sites[j]);
      if (d < bestD) {
        bestD = d;
        bestJ = j;
      }
    }
    if (bestJ === -1) {
      // All full (rounding): drop into globally nearest.
      bestJ = 0;
      bestD = dist2(p, sites[0]);
      for (let j = 1; j < k; j++) {
        const d = dist2(p, sites[j]);
        if (d < bestD) {
          bestD = d;
          bestJ = j;
        }
      }
    } else {
      remaining[bestJ]--;
    }
    clusters[bestJ].push(p);
  }
  return clusters;
}

/**
 * Compute `count` 2D coverage sites inside the footprint via balanced CCVT.
 * Returns exactly `count` {x,y} offsets relative to the footprint centre.
 */
function coverageSites(target, count, _opts) {
  const poly = footprintPolygon(target, Math.max(24, Math.ceil(6 * Math.sqrt(Math.max(1, count)))));
  const center = centroidOf(poly.length ? poly : [{ x: 0, y: 0 }]);

  if (count <= 0) return [];
  if (count === 1) return [{ x: center.x, y: center.y }];

  // Samples-per-drone tapers for large swarms so the O(iters*samples*count)
  // relaxation stays responsive while keeping good resolution for small counts.
  const perDrone = count <= 50 ? 80 : count <= 150 ? 40 : 20;
  const approx = Math.max(200, count * perDrone);
  const samples = sampleInsidePolygon(poly, approx);

  if (samples.length < count) {
    // Not enough interior samples: fall back to perimeter-style spread.
    const ring = samplePerimeter(poly, count);
    return ring.length ? ring : Array.from({ length: count }, () => ({ ...center }));
  }

  let sites = farthestPointInit(samples, count);
  // Fewer iterations needed for large swarms (they converge per-cell quickly).
  const iters = count <= 64 ? 80 : 40;
  for (let it = 0; it < iters; it++) {
    const clusters = balancedAssign(samples, sites);
    for (let j = 0; j < count; j++) {
      const pts = clusters[j];
      if (!pts || pts.length === 0) continue;
      const c = centroidOf(pts);
      if (pointInPolygon(c, poly)) {
        sites[j] = c;
      } else {
        // Snap to the cluster member nearest the (out-of-polygon) centroid.
        let best = pts[0];
        let bestD = dist2(best, c);
        for (let i = 1; i < pts.length; i++) {
          const d = dist2(pts[i], c);
          if (d < bestD) {
            bestD = d;
            best = pts[i];
          }
        }
        sites[j] = { x: best.x, y: best.y };
      }
    }
  }

  // Express relative to footprint centre.
  return sites.map((p) => ({ x: p.x - center.x, y: p.y - center.y }));
}

// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------

/**
 * Perimeter encirclement on the ground: `count` points spaced evenly around the
 * target's footprint at `standoff` distance OUTSIDE it.
 * @returns {Array<{x:number,y:number}>}
 */
export function groundFormation(target, count, opts = {}) {
  const { standoff } = { ...DEFAULTS, ...opts };
  const n = Math.max(0, Math.floor(count || 0));
  if (n === 0) return [];
  const ring = perimeterRing(target, n, standoff);
  return fitCount(ring, n, { x: 0, y: 0 });
}

/**
 * Tight encirclement ring for "caging / transport": like groundFormation but
 * hugging the footprint with a much smaller standoff.
 * @returns {Array<{x:number,y:number}>}
 */
export function caging(target, count, opts = {}) {
  const merged = { ...DEFAULTS, ...opts };
  const n = Math.max(0, Math.floor(count || 0));
  if (n === 0) return [];
  // Caging standoff: a small fraction of the requested standoff, capped tight.
  const cageStandoff =
    opts.cageStandoff != null
      ? opts.cageStandoff
      : Math.min(merged.standoff * 0.25, 8);
  const ring = perimeterRing(target, n, cageStandoff);
  return fitCount(ring, n, { x: 0, y: 0 });
}

/**
 * Area coverage above the footprint: a Centroidal Voronoi Tessellation
 * (balanced Lloyd relaxation) of `count` sites over the footprint AREA, each
 * lifted to z = altitude.
 * @returns {Array<{x:number,y:number,z:number}>}
 */
export function airFormation(target, count, opts = {}) {
  const merged = { ...DEFAULTS, ...opts };
  const n = Math.max(0, Math.floor(count || 0));
  if (n === 0) return [];
  const sites = coverageSites(target, n, merged);
  const fitted = fitCount(sites, n, { x: 0, y: 0 });
  return fitted.map((p) => ({ x: p.x, y: p.y, z: merged.altitude }));
}

/**
 * Simple horizontal line centred on the target, drones `spacing` apart.
 * @returns {Array<{x:number,y:number}>}
 */
export function lineFormation(target, count, opts = {}) {
  const { spacing } = { ...DEFAULTS, ...opts };
  const n = Math.max(0, Math.floor(count || 0));
  if (n === 0) return [];
  if (n === 1) return [{ x: 0, y: 0 }];
  const result = [];
  const offset = ((n - 1) * spacing) / 2;
  for (let i = 0; i < n; i++) {
    result.push({ x: i * spacing - offset, y: 0 });
  }
  return result;
}

/**
 * Simple near-square grid centred on the target, drones `spacing` apart.
 * @returns {Array<{x:number,y:number}>}
 */
export function gridFormation(target, count, opts = {}) {
  const { spacing } = { ...DEFAULTS, ...opts };
  const n = Math.max(0, Math.floor(count || 0));
  if (n === 0) return [];
  if (n === 1) return [{ x: 0, y: 0 }];
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const xOffset = ((cols - 1) * spacing) / 2;
  const yOffset = ((rows - 1) * spacing) / 2;
  const result = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    result.push({ x: c * spacing - xOffset, y: r * spacing - yOffset });
  }
  return result;
}
