import { describe, it, expect } from 'vitest';
import { findPath2D, findPath3D } from './pathfinding.js';
import {
  segmentIntersectsObstacle,
  pointInObstacle,
  dist,
} from './geometry.js';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Assert that no leg of `path` crosses `ob` (using a slightly relaxed margin). */
function assertPathAvoids(path, ob, margin) {
  for (let i = 0; i < path.length - 1; i++) {
    const hit = segmentIntersectsObstacle(path[i], path[i + 1], ob, margin);
    expect(
      hit,
      `segment ${i} (${JSON.stringify(path[i])} -> ${JSON.stringify(path[i + 1])}) intersects obstacle`,
    ).toBe(false);
  }
}

/** Total polyline length (2D). */
function pathLength2D(path) {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) total += dist(path[i], path[i + 1]);
  return total;
}

// ---------------------------------------------------------------------------
// 2D
// ---------------------------------------------------------------------------

describe('findPath2D', () => {
  it('returns a straight 2-point line when there are no obstacles', () => {
    const start = { x: 0, y: 0 };
    const goal = { x: 200, y: 0 };
    const path = findPath2D(start, goal, []);
    expect(path).toHaveLength(2);
    expect(path[0]).toEqual(start);
    expect(path[path.length - 1]).toEqual(goal);
  });

  it('handles start == goal (still returns >= 2 points)', () => {
    const p = { x: 50, y: 50 };
    const path = findPath2D(p, { ...p }, []);
    expect(path.length).toBeGreaterThanOrEqual(2);
    expect(path[0]).toEqual(p);
    expect(path[path.length - 1]).toEqual(p);
  });

  it('routes AROUND a single rectangle blocking the direct line', () => {
    const start = { x: -200, y: 0 };
    const goal = { x: 200, y: 0 };
    // Rectangle centered on the origin, squarely on the straight path.
    const rect = { x: 0, y: 0, shape: 'rectangle', w: 120, h: 120 };
    const margin = 15;

    const path = findPath2D(start, goal, [rect], { margin });

    // endpoints preserved
    expect(path[0]).toEqual(start);
    expect(path[path.length - 1]).toEqual(goal);
    // it had to detour, so more than 2 points
    expect(path.length).toBeGreaterThan(2);
    // no segment cuts through the rectangle (check against a slightly smaller
    // margin to allow for grid snapping at the boundary)
    assertPathAvoids(path, rect, margin - 5);
    // the path actually reaches the goal
    expect(dist(path[path.length - 1], goal)).toBeLessThan(1e-6);
    // finite, sensible length (longer than the 400 straight-line distance, but
    // not absurdly so)
    const len = pathLength2D(path);
    expect(Number.isFinite(len)).toBe(true);
    expect(len).toBeGreaterThan(400);
    expect(len).toBeLessThan(1200);
  });

  it('routes AROUND a single circle blocking the direct line', () => {
    const start = { x: -200, y: 0 };
    const goal = { x: 200, y: 0 };
    const circle = { x: 0, y: 0, shape: 'circle', radius: 70 };
    const margin = 15;

    const path = findPath2D(start, goal, [circle], { margin });

    expect(path[0]).toEqual(start);
    expect(path[path.length - 1]).toEqual(goal);
    expect(path.length).toBeGreaterThan(2);
    assertPathAvoids(path, circle, margin - 5);
  });

  it('terminates promptly on a cluttered scene', () => {
    const start = { x: -300, y: -300 };
    const goal = { x: 300, y: 300 };
    const obstacles = [];
    // grid of circles, leaving lanes between them
    for (let gx = -200; gx <= 200; gx += 100) {
      for (let gy = -200; gy <= 200; gy += 100) {
        obstacles.push({ x: gx, y: gy, shape: 'circle', radius: 25 });
      }
    }

    const t0 = Date.now();
    const path = findPath2D(start, goal, obstacles, { gridSize: 20, margin: 10, maxIterations: 8000 });
    const elapsed = Date.now() - t0;

    expect(path.length).toBeGreaterThanOrEqual(2);
    expect(path[0]).toEqual(start);
    expect(path[path.length - 1]).toEqual(goal);
    // should not hang — generous ceiling for CI
    expect(elapsed).toBeLessThan(3000);
  });

  it('returns the direct fallback line when the goal is fully enclosed', () => {
    const start = { x: 0, y: 0 };
    const goal = { x: 500, y: 0 };
    // A wall far longer than maxIterations can route around with a tiny budget.
    const wall = { x: 250, y: 0, shape: 'rectangle', w: 40, h: 4000 };
    const path = findPath2D(start, goal, [wall], { maxIterations: 5 });
    // never null/empty; falls back to [start, goal]
    expect(path.length).toBeGreaterThanOrEqual(2);
    expect(path[0]).toEqual(start);
    expect(path[path.length - 1]).toEqual(goal);
  });
});

// ---------------------------------------------------------------------------
// 3D
// ---------------------------------------------------------------------------

describe('findPath3D', () => {
  it('returns a straight 2-point line in clear airspace', () => {
    const start = { x: 0, y: 0, z: 50 };
    const goal = { x: 200, y: 0, z: 50 };
    const path = findPath3D(start, goal, []);
    expect(path).toHaveLength(2);
    expect(path[0]).toEqual(start);
    expect(path[path.length - 1]).toEqual(goal);
  });

  it('handles start == goal in 3D', () => {
    const p = { x: 10, y: 20, z: 30 };
    const path = findPath3D(p, { ...p }, []);
    expect(path.length).toBeGreaterThanOrEqual(2);
    expect(path[0]).toEqual(p);
    expect(path[path.length - 1]).toEqual(p);
  });

  it('flies OVER a low overflyable obstacle (some waypoint above its height)', () => {
    const start = { x: -200, y: 0, z: 0 };
    const goal = { x: 200, y: 0, z: 0 };
    const building = {
      x: 0, y: 0, shape: 'rectangle', w: 120, h: 120, height: 40, noFly: false,
    };
    const clearance = 20;

    const path = findPath3D(start, goal, [building], { clearance, margin: 15 });

    expect(path.length).toBeGreaterThanOrEqual(2);
    expect(path[0]).toEqual(start);
    expect(path[path.length - 1]).toEqual(goal);
    // at least one waypoint cruises above the building top + clearance
    const cruised = path.some((p) => p.z > building.height + clearance);
    expect(cruised).toBe(true);
    // it flew OVER (not around): some leg of the path passes above the building
    // footprint center while above the building height. Sample each leg.
    let flewOver = false;
    for (let i = 0; i < path.length - 1 && !flewOver; i++) {
      const a = path[i];
      const b = path[i + 1];
      for (let s = 0; s <= 10; s++) {
        const t = s / 10;
        const pt = {
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
          z: a.z + (b.z - a.z) * t,
        };
        if (pointInObstacle({ x: pt.x, y: pt.y }, building, 0) && pt.z > building.height) {
          flewOver = true;
          break;
        }
      }
    }
    expect(flewOver).toBe(true);
  });

  it('routes AROUND a no-fly zone (never enters its airspace column)', () => {
    const start = { x: -200, y: 0, z: 0 };
    const goal = { x: 200, y: 0, z: 0 };
    const noFlyZone = {
      x: 0, y: 0, shape: 'rectangle', w: 120, h: 120, height: 10, noFly: true,
    };
    const margin = 15;

    const path = findPath3D(start, goal, [noFlyZone], { margin, clearance: 20 });

    expect(path.length).toBeGreaterThanOrEqual(2);
    expect(path[0]).toEqual(start);
    expect(path[path.length - 1]).toEqual(goal);
    // No waypoint may sit inside the no-fly footprint at ANY altitude.
    for (const p of path) {
      expect(
        pointInObstacle({ x: p.x, y: p.y }, noFlyZone, 0),
        `waypoint ${JSON.stringify(p)} sits inside the no-fly footprint`,
      ).toBe(false);
    }
    // it must have detoured horizontally -> more than just up/over/down
    expect(path.length).toBeGreaterThan(2);
  });

  it('g-cost sanity: the around-obstacle path is finite and reaches the goal', () => {
    const start = { x: -150, y: -150 };
    const goal = { x: 150, y: 150 };
    const rect = { x: 0, y: 0, shape: 'rectangle', w: 100, h: 100 };
    const path = findPath2D(start, goal, [rect], { margin: 15 });

    const len = pathLength2D(path);
    expect(Number.isFinite(len)).toBe(true);
    expect(len).toBeGreaterThan(0);
    // straight-line lower bound
    expect(len).toBeGreaterThanOrEqual(dist(start, goal) - 1e-6);
    // reaches the goal exactly
    expect(dist(path[path.length - 1], goal)).toBeLessThan(1e-6);
  });
});
