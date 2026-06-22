import { smoothPath } from '../../sim/interpolation.js';
export { clamp } from '../../sim/geometry.js';

/** Smooth a drawn path for display, or return the raw 2-point line as-is. */
export function smoothOrRaw(points) {
  return points && points.length > 2 ? smoothPath(points, 10) : points;
}
