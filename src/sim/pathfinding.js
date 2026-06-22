/**
 * pathfinding.js — A* path planning for the drone swarm simulator.
 *
 * Two public entry points:
 *   findPath2D(start, goal, obstacles, opts) -> Array<{x,y}>      (ground / 2D drones)
 *   findPath3D(start, goal, obstacles, opts) -> Array<{x,y,z}>    (aerial drones)
 *
 * Coordinate convention (matches geometry.js): +x right, +y down, +z up (altitude).
 *
 * Design notes / fixes over the legacy utils/pathfinding.js:
 *   - The open set is a binary MIN-HEAP keyed on f-score (no O(n) sort/scan per pop).
 *   - g-cost is the ACTUAL Euclidean step length (orthogonal = gridSize,
 *     diagonal = gridSize*√2), never the heuristic.
 *   - Heuristic is the admissible octile distance to the goal.
 *   - Node bookkeeping (g / open / closed) lives in a Map keyed "col,row" for O(1).
 *   - All collision queries are delegated to geometry.js — no collision math here.
 *   - Fully deterministic: no Math.random anywhere.
 */

import {
  dist,
  dist3,
  pointInObstacle,
  segmentIntersectsObstacle,
} from './geometry.js';

const SQRT2 = Math.SQRT2;

// ---------------------------------------------------------------------------
// Binary min-heap priority queue.
// Items are { key, f, ... } objects; ordered by ascending `f`.
// ---------------------------------------------------------------------------
class MinHeap {
  constructor() {
    this._items = [];
  }

  get size() {
    return this._items.length;
  }

  push(item) {
    const items = this._items;
    items.push(item);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent].f <= items[i].f) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }

  pop() {
    const items = this._items;
    const n = items.length;
    if (n === 0) return undefined;
    const top = items[0];
    const last = items.pop();
    if (n > 1) {
      items[0] = last;
      // sift down
      let i = 0;
      const len = items.length;
      for (;;) {
        const left = 2 * i + 1;
        const right = 2 * i + 2;
        let smallest = i;
        if (left < len && items[left].f < items[smallest].f) smallest = left;
        if (right < len && items[right].f < items[smallest].f) smallest = right;
        if (smallest === i) break;
        [items[smallest], items[i]] = [items[i], items[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Octile distance — admissible & consistent for 8-connected grids. */
function octile(a, b, _gridSize) {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  // cost = straight moves + the extra cost of the diagonal portion
  return (dx + dy) + (SQRT2 - 2) * Math.min(dx, dy);
  // (the gridSize factor cancels since distances are already in world units)
}

/** Is a world point clear of every (2D) obstacle, inflated by margin? */
function pointClear2D(pt, obstacles, margin) {
  for (const ob of obstacles) {
    if (pointInObstacle(pt, ob, margin)) return false;
  }
  return true;
}

/** Is the segment p1→p2 clear of every (2D) obstacle, inflated by margin? */
function segmentClear2D(p1, p2, obstacles, margin) {
  for (const ob of obstacles) {
    if (segmentIntersectsObstacle(p1, p2, ob, margin)) return false;
  }
  return true;
}

/**
 * String-pulling / line-of-sight simplification.
 * Greedily extends each kept waypoint to the farthest later waypoint that is
 * still directly visible (segment clear). Start and goal are always preserved.
 */
function simplifyPath(path, obstacles, margin) {
  if (path.length <= 2) return path;
  const out = [path[0]];
  let anchor = 0;
  while (anchor < path.length - 1) {
    let farthest = anchor + 1;
    for (let i = path.length - 1; i > anchor + 1; i--) {
      if (segmentClear2D(path[anchor], path[i], obstacles, margin)) {
        farthest = i;
        break;
      }
    }
    out.push(path[farthest]);
    anchor = farthest;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2D A*
// ---------------------------------------------------------------------------

const DIRS_8 = [
  { dx: 1, dy: 0, cost: 1 },
  { dx: -1, dy: 0, cost: 1 },
  { dx: 0, dy: 1, cost: 1 },
  { dx: 0, dy: -1, cost: 1 },
  { dx: 1, dy: 1, cost: SQRT2 },
  { dx: 1, dy: -1, cost: SQRT2 },
  { dx: -1, dy: 1, cost: SQRT2 },
  { dx: -1, dy: -1, cost: SQRT2 },
];

/**
 * findPath2D — A* on a uniform 8-connected grid with line-of-sight smoothing.
 *
 * @param {{x:number,y:number}} start
 * @param {{x:number,y:number}} goal
 * @param {Array} obstacles  geometry.js obstacle descriptors
 * @param {Object} [opts]    { gridSize, margin, maxIterations, clearance, bounds }
 * @returns {Array<{x:number,y:number}>}  always length >= 2
 */
export function findPath2D(start, goal, obstacles = [], opts = {}) {
  const {
    gridSize = 20,
    margin = 15,
    maxIterations = 8000,
    bounds,
  } = opts;

  const s = { x: start.x, y: start.y };
  const g = { x: goal.x, y: goal.y };
  const obs = Array.isArray(obstacles) ? obstacles : [];

  // start == goal (or effectively so): degenerate but must still be length >= 2.
  if (dist(s, g) < 1e-6) {
    return [s, { x: g.x, y: g.y }];
  }

  // Fast path: direct line of sight.
  if (segmentClear2D(s, g, obs, margin)) {
    return [s, g];
  }

  // Grid helpers. Snap to grid cells; world coord of a cell = col*gridSize.
  const colOf = (x) => Math.round(x / gridSize);
  const rowOf = (y) => Math.round(y / gridSize);
  const worldOf = (col, row) => ({ x: col * gridSize, y: row * gridSize });
  const keyOf = (col, row) => `${col},${row}`;

  // Optional world bounds (in grid cells) so we don't wander infinitely.
  let minCol = -Infinity, maxCol = Infinity, minRow = -Infinity, maxRow = Infinity;
  if (bounds) {
    minCol = Math.floor(bounds.minX / gridSize) - 1;
    maxCol = Math.ceil(bounds.maxX / gridSize) + 1;
    minRow = Math.floor(bounds.minY / gridSize) - 1;
    maxRow = Math.ceil(bounds.maxY / gridSize) + 1;
  }

  const startCol = colOf(s.x), startRow = rowOf(s.y);
  const goalCol = colOf(g.x), goalRow = rowOf(g.y);

  // gScore / parent / closed all keyed by "col,row".
  const gScore = new Map();
  const cameFrom = new Map();
  const closed = new Set();
  const open = new MinHeap();

  const startNode = worldOf(startCol, startRow);
  const goalNode = worldOf(goalCol, goalRow);
  const startKey = keyOf(startCol, startRow);

  gScore.set(startKey, 0);
  open.push({ key: startKey, col: startCol, row: startRow, f: octile(startNode, goalNode, gridSize) });

  let reachedKey = null;
  let iterations = 0;

  while (open.size > 0 && iterations < maxIterations) {
    iterations++;
    const currentEntry = open.pop();
    const curKey = currentEntry.key;

    // Stale heap entry (a better one was processed already).
    if (closed.has(curKey)) continue;
    closed.add(curKey);

    const curCol = currentEntry.col;
    const curRow = currentEntry.row;
    const curWorld = worldOf(curCol, curRow);
    const curG = gScore.get(curKey) ?? Infinity;

    // Goal test: same cell, or close enough that goal is directly visible.
    if (curCol === goalCol && curRow === goalRow) {
      reachedKey = curKey;
      break;
    }
    if (
      dist(curWorld, g) <= gridSize * 1.5 &&
      segmentClear2D(curWorld, g, obs, margin)
    ) {
      reachedKey = curKey;
      break;
    }

    for (const dir of DIRS_8) {
      const nCol = curCol + dir.dx;
      const nRow = curRow + dir.dy;
      if (nCol < minCol || nCol > maxCol || nRow < minRow || nRow > maxRow) continue;

      const nKey = keyOf(nCol, nRow);
      if (closed.has(nKey)) continue;

      const nWorld = worldOf(nCol, nRow);

      // Neighbor cell must not sit inside an obstacle...
      if (!pointClear2D(nWorld, obs, margin)) continue;
      // ...and the step into it must not clip an obstacle (also blocks diagonal
      // corner-cutting through a wall).
      if (!segmentClear2D(curWorld, nWorld, obs, margin)) continue;

      // ACTUAL Euclidean step cost (the critical fix vs. the legacy code).
      const tentativeG = curG + dir.cost * gridSize;
      if (tentativeG >= (gScore.get(nKey) ?? Infinity)) continue;

      cameFrom.set(nKey, curKey);
      gScore.set(nKey, tentativeG);
      const f = tentativeG + octile(nWorld, goalNode, gridSize);
      open.push({ key: nKey, col: nCol, row: nRow, f });
    }
  }

  // No path within budget — fall back to the direct line so the sim still animates.
  if (reachedKey === null) {
    return [s, g];
  }

  // Reconstruct from the reached cell back to start.
  const cells = [];
  let k = reachedKey;
  while (k !== undefined) {
    const [c, r] = k.split(',').map(Number);
    cells.push(worldOf(c, r));
    k = cameFrom.get(k);
  }
  cells.reverse();

  // Stitch real start/goal onto the grid-snapped interior.
  const raw = [s, ...cells, g];

  // De-dup consecutive identical points.
  const dedup = [raw[0]];
  for (let i = 1; i < raw.length; i++) {
    const prev = dedup[dedup.length - 1];
    if (Math.abs(prev.x - raw[i].x) > 1e-6 || Math.abs(prev.y - raw[i].y) > 1e-6) {
      dedup.push(raw[i]);
    }
  }

  const simplified = simplifyPath(dedup, obs, margin);
  return simplified.length >= 2 ? simplified : [s, g];
}

// ---------------------------------------------------------------------------
// 3D path planning for aerial drones
// ---------------------------------------------------------------------------

/**
 * A 3D point at altitude z clears `ob` if it flies above the obstacle's top
 * (height + clearance) — UNLESS the obstacle is a no-fly zone, which blocks the
 * full airspace column above its footprint at every altitude.
 *
 * Returns true if the point is BLOCKED by this obstacle.
 */
function pointBlocked3D(pt, ob, margin, clearance) {
  // Outside the (inflated) footprint? Never blocked, regardless of altitude.
  if (!pointInObstacle({ x: pt.x, y: pt.y }, ob, margin)) return false;
  if (ob.noFly) return true; // no-fly column blocks all altitudes
  const top = (ob.height || 0) + clearance;
  return (pt.z || 0) <= top; // inside footprint and not high enough to clear
}

/** Is a 3D segment clear of all obstacles? Sampled along its length. */
function segmentClear3D(p1, p2, obstacles, margin, clearance) {
  const len = dist3(p1, p2);
  const steps = Math.max(2, Math.ceil(len / 8));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const pt = {
      x: p1.x + (p2.x - p1.x) * t,
      y: p1.y + (p2.y - p1.y) * t,
      z: (p1.z || 0) + ((p2.z || 0) - (p1.z || 0)) * t,
    };
    for (const ob of obstacles) {
      if (pointBlocked3D(pt, ob, margin, clearance)) return false;
    }
  }
  return true;
}

/**
 * findPath3D — air-drone planner.
 *
 * Strategy:
 *   1. If start→goal is directly clear in 3D, return [start, goal].
 *   2. Try a horizontal A* (findPath2D) that only routes around obstacles the
 *      drone cannot overfly at goal altitude (no-fly zones + anything taller
 *      than the drone's altitude). This keeps the natural "fly around the
 *      no-fly zone, straight over the short building" behavior, layered at a
 *      single cruise altitude.
 *   3. Compute a safe cruise altitude above the tallest *overflyable* blocker
 *      and emit a rise → (horizontal route) → descend path. No-fly zones are
 *      always routed around horizontally (you can't climb over them).
 *   4. Verify; if anything is still blocked, raise the cruise altitude once
 *      more. Final fallback is the classic rise-fly-descend straight line.
 *
 * @param {{x:number,y:number,z?:number}} start
 * @param {{x:number,y:number,z?:number}} goal
 * @param {Array} obstacles
 * @param {Object} [opts] { gridSize, margin, maxIterations, clearance, bounds }
 * @returns {Array<{x:number,y:number,z:number}>}  always length >= 2
 */
export function findPath3D(start, goal, obstacles = [], opts = {}) {
  const {
    margin = 15,
    clearance = 20,
  } = opts;

  const obs = Array.isArray(obstacles) ? obstacles : [];
  const s = { x: start.x, y: start.y, z: start.z || 0 };
  const g = { x: goal.x, y: goal.y, z: goal.z || 0 };

  // start == goal.
  if (dist3(s, g) < 1e-6) {
    return [s, { x: g.x, y: g.y, z: g.z }];
  }

  // Direct 3D shot?
  if (segmentClear3D(s, g, obs, margin, clearance)) {
    return [s, g];
  }

  const noFly = obs.filter((o) => o.noFly);

  // Choose a cruise altitude that clears every overflyable obstacle. No-fly
  // zones are excluded — we route around them horizontally instead.
  let tallest = 0;
  for (const ob of obs) {
    if (ob.noFly) continue;
    const top = (ob.height || 0) + clearance;
    if (top > tallest) tallest = top;
  }
  const baseCruise = Math.max(s.z, g.z, tallest) + clearance;

  // Horizontal route only needs to avoid the things we can't simply fly over:
  // the no-fly zones. (Overflyable buildings are cleared by altitude.)
  // We plan that route in 2D, then lift it to the cruise altitude.
  const horizontalRoute = findPath2D(
    { x: s.x, y: s.y },
    { x: g.x, y: g.y },
    noFly,
    opts,
  );

  // Attempt: rise to cruise, follow the horizontal route at cruise, descend.
  // Bump the cruise altitude up to a few times if verification fails.
  for (let attempt = 0; attempt < 4; attempt++) {
    const cruise = baseCruise + attempt * (clearance + margin) * 2;

    const wps = [];
    wps.push({ x: s.x, y: s.y, z: s.z });           // current position
    wps.push({ x: s.x, y: s.y, z: cruise });        // rise straight up
    for (let i = 0; i < horizontalRoute.length; i++) {
      wps.push({ x: horizontalRoute[i].x, y: horizontalRoute[i].y, z: cruise });
    }
    wps.push({ x: g.x, y: g.y, z: cruise });        // arrive above goal
    wps.push({ x: g.x, y: g.y, z: g.z });           // descend

    // De-dup consecutive identical waypoints.
    const path = [wps[0]];
    for (let i = 1; i < wps.length; i++) {
      const p = path[path.length - 1];
      if (
        Math.abs(p.x - wps[i].x) > 1e-6 ||
        Math.abs(p.y - wps[i].y) > 1e-6 ||
        Math.abs(p.z - wps[i].z) > 1e-6
      ) {
        path.push(wps[i]);
      }
    }

    // Verify every leg is clear.
    let ok = true;
    for (let i = 0; i < path.length - 1; i++) {
      if (!segmentClear3D(path[i], path[i + 1], obs, margin, clearance)) {
        ok = false;
        break;
      }
    }
    if (ok && path.length >= 2) return path;
  }

  // Last-resort deterministic fallback: classic rise-fly-descend straight over
  // everything (including no-fly footprints — at least the sim animates).
  let absoluteTop = 0;
  for (const ob of obs) {
    const top = (ob.height || 0) + clearance;
    if (top > absoluteTop) absoluteTop = top;
  }
  const cruise = Math.max(s.z, g.z, absoluteTop) + clearance + margin;
  return [
    { x: s.x, y: s.y, z: s.z },
    { x: s.x, y: s.y, z: cruise },
    { x: g.x, y: g.y, z: cruise },
    { x: g.x, y: g.y, z: g.z },
  ];
}
