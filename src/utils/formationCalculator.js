// Formation Calculator for Drone Swarm Object Transport

/**
 * Calculate how many drones are needed (no minimum)
 */
export function calculateRequiredDrones(object, droneType = 'air', maxDroneCapacity = 50) {
    const weight = object.weight || 10;

    // Calculate surface area
    let area = 0;
    if (object.type === 'circle') {
        const radius = object.radius || 50;
        area = Math.PI * radius * radius;
    } else if (object.type === 'rectangle') {
        area = (object.w || 100) * (object.h || 100);
    } else if (object.type === 'custom' && object.customPath) {
        const path = object.customPath;
        let sum = 0;
        for (let i = 0; i < path.length; i++) {
            const j = (i + 1) % path.length;
            sum += path[i].x * path[j].y - path[j].x * path[i].y;
        }
        area = Math.abs(sum / 2);
    }

    const dronesForWeight = Math.ceil(weight / maxDroneCapacity);
    const dronesForArea = Math.ceil(area / 10000);

    // No minimum requirement
    return Math.max(dronesForWeight, dronesForArea, 1);
}

/**
 * GROUND DRONE FORMATIONS - Perimeter positioning
 */

export function calculateGroundCircleFormation(object, droneCount) {
    const radius = object.radius || 50;
    const positions = [];
    const angleStep = (2 * Math.PI) / droneCount;

    for (let i = 0; i < droneCount; i++) {
        const angle = i * angleStep;
        positions.push({
            x: radius * Math.cos(angle),
            y: radius * Math.sin(angle)
        });
    }

    return positions;
}

export function calculateGroundRectangleFormation(object, droneCount) {
    const width = object.w || 100;
    const height = object.h || 100;
    const perimeter = 2 * (width + height);
    const spacing = perimeter / droneCount;
    const positions = [];

    for (let i = 0; i < droneCount; i++) {
        const distance = i * spacing;
        let x, y;

        if (distance < width) {
            x = -width / 2 + distance;
            y = -height / 2;
        } else if (distance < width + height) {
            x = width / 2;
            y = -height / 2 + (distance - width);
        } else if (distance < 2 * width + height) {
            x = width / 2 - (distance - width - height);
            y = height / 2;
        } else {
            x = -width / 2;
            y = height / 2 - (distance - 2 * width - height);
        }

        positions.push({ x, y });
    }

    return positions;
}

export function calculateGroundCustomFormation(object, droneCount) {
    if (!object.customPath || object.customPath.length < 3) {
        return calculateGroundCircleFormation(object, droneCount);
    }

    const path = object.customPath;

    // Calculate original bounding box
    const xs = path.map(p => p.x);
    const ys = path.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const origW = maxX - minX || 1;
    const origH = maxY - minY || 1;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Calculate scale factors based on current w/h vs original
    const currentW = object.w || origW;
    const currentH = object.h || origH;
    const scaleX = currentW / origW;
    const scaleY = currentH / origH;

    let totalPerimeter = 0;

    for (let i = 0; i < path.length; i++) {
        const p1 = path[i];
        const p2 = path[(i + 1) % path.length];
        // Apply scaling to calculate correct perimeter
        const dx = (p2.x - p1.x) * scaleX;
        const dy = (p2.y - p1.y) * scaleY;
        totalPerimeter += Math.sqrt(dx * dx + dy * dy);
    }

    const spacing = totalPerimeter / droneCount;
    const positions = [];

    for (let i = 0; i < droneCount; i++) {
        const targetDistance = i * spacing;
        let accumulatedDistance = 0;

        for (let j = 0; j < path.length; j++) {
            const p1 = path[j];
            const p2 = path[(j + 1) % path.length];
            // Apply scaling
            const dx = (p2.x - p1.x) * scaleX;
            const dy = (p2.y - p1.y) * scaleY;
            const edgeLength = Math.sqrt(dx * dx + dy * dy);

            if (accumulatedDistance + edgeLength >= targetDistance) {
                const distanceOnEdge = targetDistance - accumulatedDistance;
                const t = distanceOnEdge / edgeLength;
                // Position relative to center (0,0), with scaling applied
                positions.push({
                    x: (p1.x - centerX) * scaleX + dx * t,
                    y: (p1.y - centerY) * scaleY + dy * t
                });
                break;
            }

            accumulatedDistance += edgeLength;
        }
    }

    return positions;
}

/**
 * AIR DRONE FORMATIONS - Surface area distribution
 */

export function calculateAirCircleFormation(object, droneCount) {
    const radius = object.radius || 50;
    const positions = [];

    // Use CCVT for uniform distribution
    return calculateAirFormationCCVT(object, droneCount);
}

export function calculateAirRectangleFormation(object, droneCount) {
    const width = object.w || 100;
    const height = object.h || 100;
    // Use CCVT for uniform distribution (will fill the rectangle evenly)
    return calculateAirFormationCCVT(object, droneCount);
}

// ---------- geometry helpers ----------

function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
        t += 0x6D2B79F5;
        let x = Math.imul(t ^ (t >>> 15), 1 | t);
        x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
}

function pointInPolygon(x, y, poly) {
    // Ray casting, poly: [{x,y}, ...]
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x, yi = poly[i].y;
        const xj = poly[j].x, yj = poly[j].y;
        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi + 0.0) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function polygonBBox(poly) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of poly) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function centroidOfPoints(pts) {
    let sx = 0, sy = 0;
    const n = pts.length || 1;
    for (const p of pts) { sx += p.x; sy += p.y; }
    return { x: sx / n, y: sy / n };
}

function dist2(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return dx * dx + dy * dy;
}

// ---------- sampling ----------

function sampleUniformInPolygon(poly, sampleCount, rng) {
    const bb = polygonBBox(poly);
    const samples = [];
    // rejection sampling in bbox
    // if polygon is skinny, may need more tries; cap for safety
    let tries = 0;
    const maxTries = sampleCount * 50;

    while (samples.length < sampleCount && tries < maxTries) {
        tries++;
        const x = bb.minX + rng() * bb.w;
        const y = bb.minY + rng() * bb.h;
        if (pointInPolygon(x, y, poly)) samples.push({ x, y });
    }

    // Fallback: if rejection struggles, at least return what we got
    return samples;
}

// ---------- deterministic farthest-point initialization ----------

function farthestPointInit(samples, k) {
    // deterministic: first = centroid-nearest sample
    const c = centroidOfPoints(samples);
    let bestIdx = 0;
    let bestD = Infinity;
    for (let i = 0; i < samples.length; i++) {
        const d = dist2(samples[i], c);
        if (d < bestD) { bestD = d; bestIdx = i; }
    }

    const sites = [samples[bestIdx]];
    const minD2 = new Array(samples.length).fill(Infinity);

    for (let s = 0; s < samples.length; s++) {
        minD2[s] = dist2(samples[s], sites[0]);
    }

    while (sites.length < k) {
        let farIdx = 0;
        let farD = -1;
        for (let i = 0; i < samples.length; i++) {
            if (minD2[i] > farD) { farD = minD2[i]; farIdx = i; }
        }
        sites.push(samples[farIdx]);

        // update nearest distance
        const newSite = samples[farIdx];
        for (let i = 0; i < samples.length; i++) {
            const d = dist2(samples[i], newSite);
            if (d < minD2[i]) minD2[i] = d;
        }
    }

    // copy so we don't alias sample objects
    return sites.map(p => ({ x: p.x, y: p.y }));
}

// ---------- balanced assignment (equal mass / equal sample counts) ----------

function balancedAssign(samples, sites) {
    const k = sites.length;
    const n = samples.length;

    // capacities differ by at most 1
    const base = Math.floor(n / k);
    const rem = n % k;
    const cap = new Array(k).fill(base);
    for (let i = 0; i < rem; i++) cap[i]++;

    // Deterministic order: by x then y (no RNG)
    const order = samples
        .map((p, idx) => ({ p, idx }))
        .sort((a, b) => (a.p.x - b.p.x) || (a.p.y - b.p.y) || (a.idx - b.idx));

    const assigned = Array.from({ length: k }, () => []);
    const remaining = cap.slice();

    // Greedy: each sample goes to nearest site that still has capacity
    // (This is an approximation of true CCVT/OT, but works well in practice.)
    for (const item of order) {
        const p = item.p;

        // find nearest available site
        let bestJ = -1;
        let bestD = Infinity;

        for (let j = 0; j < k; j++) {
            if (remaining[j] <= 0) continue;
            const d = dist2(p, sites[j]);
            if (d < bestD || (d === bestD && j < bestJ)) {
                bestD = d;
                bestJ = j;
            }
        }

        // If all full (shouldn't happen), dump to nearest anyway
        if (bestJ === -1) {
            bestJ = 0;
            bestD = dist2(p, sites[0]);
            for (let j = 1; j < k; j++) {
                const d = dist2(p, sites[j]);
                if (d < bestD) { bestD = d; bestJ = j; }
            }
        } else {
            remaining[bestJ]--;
        }

        assigned[bestJ].push(p);
    }

    return assigned;
}

// ---------- main solver ----------

export function calculateAirFormationCCVT(object, droneCount, opts = {}) {
    const {
        seed = 12345,
        samplesPerDrone = 150, // Increased for better resolution
        iters = 100,           // Increased for better convergence to symmetric centroidal Voronoi
    } = opts;

    if (droneCount <= 0) return [];

    // Build polygon
    let poly;

    if (object.customPath && object.customPath.length >= 3 && object.type === 'custom') {
        // We need to respect the scaling logic if w/h are different from original path
        // But calculateGroundCustomFormation logic handled scaling explicitly.
        // The user's code snippet assumes poly is just the customPath.
        // If the object has been resized, customPath might not reflect that unless customPath is relative?
        // Looking at calculateGroundCustomFormation, it calculates scaling.
        // Let's just use customPath as is for the shape, then center/scale result? 
        // Actually the snippet had 'optional: clamp output to object scaling like your customPath code'.
        // Let's assume customPath is absolute coordinates of the drawn shape.
        poly = object.customPath.map(p => ({ x: p.x, y: p.y }));
    } else if (object.radius != null || object.type === 'circle') {
        const r = object.radius || 50;
        const m = Math.max(24, Math.ceil(6 * Math.sqrt(droneCount))); // more drones -> more sides
        poly = [];
        for (let i = 0; i < m; i++) {
            const a = (i / m) * Math.PI * 2;
            poly.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
        }
    } else {
        // rectangle fallback
        const w = object.w || 100;
        const h = object.h || 100;
        poly = [
            { x: -w / 2, y: -h / 2 },
            { x: w / 2, y: -h / 2 },
            { x: w / 2, y: h / 2 },
            { x: -w / 2, y: h / 2 },
        ];
    }

    const rng = mulberry32(seed);
    const sampleCount = Math.max(200, droneCount * samplesPerDrone);
    const samples = sampleUniformInPolygon(poly, sampleCount, rng);

    if (samples.length < droneCount) {
        const c = centroidOfPoints(poly);
        return Array.from({ length: droneCount }, () => ({ x: c.x, y: c.y }));
    }

    let sites = farthestPointInit(samples, droneCount);

    for (let iter = 0; iter < iters; iter++) {
        const clusters = balancedAssign(samples, sites);

        for (let j = 0; j < droneCount; j++) {
            const pts = clusters[j];
            if (!pts || pts.length === 0) continue;

            const c = centroidOfPoints(pts);
            // We want to keep sites inside validity if possible, but centroid of convex set is inside.
            // Not always true for non-convex, but pointInPolygon check handles it.
            if (!pointInPolygon(c.x, c.y, poly)) {
                let best = pts[0];
                let bestD = dist2(best, c);
                for (let i = 1; i < pts.length; i++) {
                    const d = dist2(pts[i], c);
                    if (d < bestD) { bestD = d; best = pts[i]; }
                }
                sites[j] = { x: best.x, y: best.y };
            } else {
                sites[j] = c;
            }
        }
    }

    // Determine current center to offset return values if needed
    // The 'customPath' points are usually relative to the canvas or a large coordinate space.
    // The original calculateAirCustomFormation returns points relative to the object center (0,0) in the visual component?
    // Let's look at calculateAirCustomFormation implementation again. 
    // It calculates 'centerX' and 'centerY' of the path, and subtracts them.
    // Then it applies 'scaleX'/'scaleY'.

    // To avoid complexity, let's just do what `calculateAirCustomFormation` did:
    // 1. Calculate bounding box of the POLY
    const bb = polygonBBox(poly);
    const centerX = (bb.minX + bb.maxX) / 2;
    const centerY = (bb.minY + bb.maxY) / 2;

    // 2. Return points relative to that center.
    // Note: we aren't handling explicit 'w'/'h' resizing here if 'customPath' is the source of truth for shape.
    // If the user resizes the object, usually 'w' and 'h' change but 'customPath' might stay SAME?
    // If so, we SHOULD scale.

    // Let's replicate the scaling logic from the original function briefly just in case.
    const path = object.customPath;
    // minX/maxX from path... bb handles that.
    const origW = bb.w || 1;
    const origH = bb.h || 1;

    // The object stores w and h.
    const currentW = object.w || origW;
    const currentH = object.h || origH;
    const scaleX = currentW / origW;
    const scaleY = currentH / origH;

    return sites.map(p => ({
        x: (p.x - centerX) * scaleX,
        y: (p.y - centerY) * scaleY
    }));
}

export function calculateAirCustomFormation(object, droneCount) {
    // Just delegate to CCVT
    return calculateAirFormationCCVT(object, droneCount);
}

/**
 * Main formation calculator
 */
export function calculateFormation(object, droneCount, droneType = 'air') {
    if (droneType === 'ground') {
        switch (object.type) {
            case 'circle':
                return calculateGroundCircleFormation(object, droneCount);
            case 'rectangle':
                return calculateGroundRectangleFormation(object, droneCount);
            case 'custom':
                return calculateGroundCustomFormation(object, droneCount);
            default:
                return calculateGroundCircleFormation(object, droneCount);
        }
    } else {
        switch (object.type) {
            case 'circle':
                return calculateAirCircleFormation(object, droneCount);
            case 'rectangle':
                return calculateAirRectangleFormation(object, droneCount);
            case 'custom':
                return calculateAirCustomFormation(object, droneCount);
            default:
                return calculateAirCircleFormation(object, droneCount);
        }
    }
}
