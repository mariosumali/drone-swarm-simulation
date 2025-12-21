// Path interpolation utilities for custom paths between states

/**
 * Calculate the total length of a path
 */
export function calculatePathLength(points) {
    if (!points || points.length < 2) return 0;

    let totalLength = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const dx = points[i + 1].x - points[i].x;
        const dy = points[i + 1].y - points[i].y;
        totalLength += Math.sqrt(dx * dx + dy * dy);
    }
    return totalLength;
}

/**
 * Get a point at a specific distance along the path
 */
export function getPointAtDistance(points, targetDistance) {
    if (!points || points.length === 0) return { x: 0, y: 0 };
    if (points.length === 1) return { ...points[0] };

    let currentDistance = 0;

    for (let i = 0; i < points.length - 1; i++) {
        const dx = points[i + 1].x - points[i].x;
        const dy = points[i + 1].y - points[i].y;
        const segmentLength = Math.sqrt(dx * dx + dy * dy);

        if (currentDistance + segmentLength >= targetDistance) {
            // Point is on this segment
            const t = (targetDistance - currentDistance) / segmentLength;
            return {
                x: points[i].x + dx * t,
                y: points[i].y + dy * t
            };
        }

        currentDistance += segmentLength;
    }

    // Return last point if we've gone past the end
    return { ...points[points.length - 1] };
}

/**
 * Interpolate along a custom path using progress (0-1)
 * Returns {x, y, rotation}
 */
export function interpolateAlongPath(points, progress) {
    if (!points || points.length === 0) {
        return { x: 0, y: 0, rotation: 0 };
    }

    if (points.length === 1) {
        return { ...points[0], rotation: 0 };
    }

    const totalLength = calculatePathLength(points);
    const targetDistance = totalLength * progress;
    const position = getPointAtDistance(points, targetDistance);

    // Calculate rotation based on path direction
    const rotation = calculateRotationAtDistance(points, targetDistance);

    return { ...position, rotation };
}

/**
 * Calculate rotation (tangent direction) at a specific distance along path
 */
function calculateRotationAtDistance(points, targetDistance) {
    if (!points || points.length < 2) return 0;

    let currentDistance = 0;

    for (let i = 0; i < points.length - 1; i++) {
        const dx = points[i + 1].x - points[i].x;
        const dy = points[i + 1].y - points[i].y;
        const segmentLength = Math.sqrt(dx * dx + dy * dy);

        if (currentDistance + segmentLength >= targetDistance || i === points.length - 2) {
            // Calculate angle for this segment
            return Math.atan2(dy, dx) * (180 / Math.PI);
        }

        currentDistance += segmentLength;
    }

    return 0;
}

/**
 * Create a smooth Catmull-Rom spline through the points
 * Returns an array of interpolated points for smooth rendering
 */
export function createSmoothPath(points, segmentsPerPoint = 10) {
    if (!points || points.length < 2) return points || [];
    if (points.length === 2) return points;

    const smoothPoints = [];

    // Add first point
    smoothPoints.push(points[0]);

    // Interpolate between each pair of points
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];

        for (let t = 0; t < 1; t += 1 / segmentsPerPoint) {
            const point = catmullRom(p0, p1, p2, p3, t);
            smoothPoints.push(point);
        }
    }

    // Add last point
    smoothPoints.push(points[points.length - 1]);

    return smoothPoints;
}

/**
 * Catmull-Rom spline interpolation
 */
function catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;

    const x = 0.5 * (
        (2 * p1.x) +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
    );

    const y = 0.5 * (
        (2 * p1.y) +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
    );

    return { x, y };
}
