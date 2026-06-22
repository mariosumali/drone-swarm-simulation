import { describe, it, expect } from 'vitest';
import {
  groundFormation,
  airFormation,
  caging,
  lineFormation,
  gridFormation,
} from './formations.js';
import { scalePolygon, pointInPolygon, polygonBounds } from './geometry.js';

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

const circle = { shape: 'circle', radius: 50 };
const rect = { shape: 'rectangle', w: 120, h: 80 };
const triangle = {
  shape: 'polygon',
  w: 100,
  h: 100,
  polygon: [
    { x: 0, y: -50 },
    { x: 50, y: 50 },
    { x: -50, y: 50 },
  ],
};

const COUNTS = [0, 1, 5, 12];

function mag(p) {
  return Math.hypot(p.x, p.y);
}

function avgMag(points) {
  if (points.length === 0) return 0;
  return points.reduce((s, p) => s + mag(p), 0) / points.length;
}

const ALL = {
  groundFormation,
  airFormation,
  caging,
  lineFormation,
  gridFormation,
};

// ---------------------------------------------------------------------------
// exact count
// ---------------------------------------------------------------------------

describe('output length always equals count', () => {
  for (const [name, fn] of Object.entries(ALL)) {
    for (const count of COUNTS) {
      it(`${name} returns ${count} offsets for count=${count}`, () => {
        const out = fn(circle, count);
        expect(Array.isArray(out)).toBe(true);
        expect(out).toHaveLength(count);
      });
    }
  }

  it('handles large counts gracefully', () => {
    for (const [name, fn] of Object.entries(ALL)) {
      expect(fn(rect, 200), name).toHaveLength(200);
    }
  });

  it('respects count for every shape', () => {
    for (const target of [circle, rect, triangle]) {
      for (const [name, fn] of Object.entries(ALL)) {
        expect(fn(target, 7), `${name}/${target.shape}`).toHaveLength(7);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// ground / caging geometry
// ---------------------------------------------------------------------------

describe('groundFormation / caging perimeter placement', () => {
  it('circle ground points sit at radius + standoff (uniform magnitude)', () => {
    const standoff = 30;
    const out = groundFormation(circle, 12, { standoff });
    const expected = circle.radius + standoff;
    for (const p of out) {
      expect(mag(p)).toBeCloseTo(expected, 6);
    }
  });

  it('circle caging points sit at radius + small standoff', () => {
    const out = caging(circle, 12, { standoff: 30 });
    // cage standoff is min(standoff*0.25, 8) = 7.5
    const expected = circle.radius + Math.min(30 * 0.25, 8);
    for (const p of out) {
      expect(mag(p)).toBeCloseTo(expected, 6);
    }
  });

  it('caging ring is tighter than groundFormation (smaller avg magnitude)', () => {
    for (const target of [circle, rect, triangle]) {
      const ground = groundFormation(target, 12, { standoff: 40 });
      const cage = caging(target, 12, { standoff: 40 });
      expect(avgMag(cage), target.shape).toBeLessThan(avgMag(ground));
    }
  });

  it('rectangle ground points lie outside or on the footprint', () => {
    const standoff = 25;
    const out = groundFormation(rect, 24, { standoff });
    // A point is "outside or on" the footprint if it is not strictly inside the
    // (un-inflated) rectangle.
    const halfW = rect.w / 2;
    const halfH = rect.h / 2;
    for (const p of out) {
      const strictlyInside =
        Math.abs(p.x) < halfW - 1e-6 && Math.abs(p.y) < halfH - 1e-6;
      expect(strictlyInside).toBe(false);
    }
  });

  it('polygon ground points lie outside the local footprint', () => {
    const out = groundFormation(triangle, 18, { standoff: 20 });
    const localPoly = scalePolygon(triangle.polygon, triangle.w, triangle.h);
    for (const p of out) {
      // Inflated perimeter samples must not be strictly inside the footprint.
      expect(pointInPolygon(p, localPoly)).toBe(false);
    }
  });

  it('all circle ground magnitudes exceed the radius for several counts', () => {
    for (const count of [1, 3, 5, 12, 30]) {
      const out = groundFormation(circle, count, { standoff: 15 });
      for (const p of out) {
        expect(mag(p)).toBeGreaterThan(circle.radius);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// air coverage
// ---------------------------------------------------------------------------

describe('airFormation area coverage', () => {
  it('z equals altitude for count > 1', () => {
    const altitude = 70;
    for (const target of [circle, rect, triangle]) {
      const out = airFormation(target, 8, { altitude });
      for (const p of out) {
        expect(p.z).toBe(altitude);
      }
    }
  });

  it('count=1 returns the footprint centroid at altitude', () => {
    const out = airFormation(rect, 1, { altitude: 55 });
    expect(out).toHaveLength(1);
    expect(out[0].z).toBe(55);
    expect(mag(out[0])).toBeLessThan(5); // centroid ≈ origin
  });

  it('points are spread out (not all identical) and inside-ish the footprint', () => {
    const out = airFormation(rect, 12, { altitude: 70 });
    const unique = new Set(out.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`));
    expect(unique.size).toBeGreaterThan(1);

    // Reasonable spread: the bounding box of the sites should be a meaningful
    // fraction of the footprint, not a single clustered point.
    const b = polygonBounds(out);
    expect(b.width).toBeGreaterThan(rect.w * 0.3);
    expect(b.height).toBeGreaterThan(rect.h * 0.3);
  });

  it('coverage sites stay within the footprint bounds (with small margin)', () => {
    const out = airFormation(rect, 12);
    const halfW = rect.w / 2 + 1e-6;
    const halfH = rect.h / 2 + 1e-6;
    for (const p of out) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(halfW);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(halfH);
    }
  });
});

// ---------------------------------------------------------------------------
// line / grid
// ---------------------------------------------------------------------------

describe('line and grid formations', () => {
  it('line is centred and evenly spaced', () => {
    const out = lineFormation(circle, 5, { spacing: 40 });
    expect(out).toHaveLength(5);
    // symmetric about origin
    expect(avgMag(out.map((p) => ({ x: p.x, y: 0 })))).toBeGreaterThan(0);
    const xs = out.map((p) => p.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i] - xs[i - 1]).toBeCloseTo(40, 6);
    }
    const sumX = out.reduce((s, p) => s + p.x, 0);
    expect(sumX).toBeCloseTo(0, 6);
  });

  it('grid is roughly square and centred', () => {
    const out = gridFormation(circle, 9, { spacing: 30 });
    expect(out).toHaveLength(9);
    const sumX = out.reduce((s, p) => s + p.x, 0);
    const sumY = out.reduce((s, p) => s + p.y, 0);
    expect(sumX).toBeCloseTo(0, 6);
    expect(sumY).toBeCloseTo(0, 6);
  });
});

// ---------------------------------------------------------------------------
// determinism
// ---------------------------------------------------------------------------

describe('determinism', () => {
  for (const [name, fn] of Object.entries(ALL)) {
    it(`${name} yields identical results across calls`, () => {
      for (const target of [circle, rect, triangle]) {
        const a = fn(target, 12, { standoff: 30, altitude: 70, spacing: 40 });
        const b = fn(target, 12, { standoff: 30, altitude: 70, spacing: 40 });
        expect(a).toEqual(b);
      }
    });
  }
});
