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
    let totalPerimeter = 0;

    for (let i = 0; i < path.length; i++) {
        const p1 = path[i];
        const p2 = path[(i + 1) % path.length];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        totalPerimeter += Math.sqrt(dx * dx + dy * dy);
    }

    const spacing = totalPerimeter / droneCount;
    const positions = [];
    let currentDistance = 0;
    let edgeIndex = 0;

    for (let i = 0; i < droneCount; i++) {
        const targetDistance = i * spacing;
        let accumulatedDistance = 0;

        edgeIndex = 0;
        for (let j = 0; j < path.length; j++) {
            const p1 = path[j];
            const p2 = path[(j + 1) % path.length];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const edgeLength = Math.sqrt(dx * dx + dy * dy);

            if (accumulatedDistance + edgeLength >= targetDistance) {
                const distanceOnEdge = targetDistance - accumulatedDistance;
                const t = distanceOnEdge / edgeLength;
                positions.push({
                    x: p1.x + dx * t,
                    y: p1.y + dy * t
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

    if (droneCount === 1) {
        positions.push({ x: 0, y: 0 });
    } else if (droneCount <= 3) {
        const angleStep = (2 * Math.PI) / droneCount;
        for (let i = 0; i < droneCount; i++) {
            const angle = i * angleStep;
            const r = radius * 0.6;
            positions.push({
                x: r * Math.cos(angle),
                y: r * Math.sin(angle)
            });
        }
    } else {
        const rings = Math.ceil(Math.sqrt(droneCount));
        let droneIndex = 0;

        for (let ring = 0; ring < rings && droneIndex < droneCount; ring++) {
            const ringRadius = (radius * (ring + 0.5)) / rings;
            const dronesInRing = ring === 0 ? 1 : Math.ceil((droneCount - 1) * (ring + 1) / (rings * (rings + 1) / 2));
            const remaining = droneCount - droneIndex;
            const actualDrones = Math.min(dronesInRing, remaining);

            if (ring === 0) {
                positions.push({ x: 0, y: 0 });
                droneIndex++;
            } else {
                const angleStep = (2 * Math.PI) / actualDrones;
                for (let i = 0; i < actualDrones && droneIndex < droneCount; i++) {
                    const angle = i * angleStep;
                    positions.push({
                        x: ringRadius * Math.cos(angle),
                        y: ringRadius * Math.sin(angle)
                    });
                    droneIndex++;
                }
            }
        }
    }

    return positions.slice(0, droneCount);
}

export function calculateAirRectangleFormation(object, droneCount) {
    const width = object.w || 100;
    const height = object.h || 100;
    const aspectRatio = width / height;
    let cols = Math.ceil(Math.sqrt(droneCount * aspectRatio));
    let rows = Math.ceil(droneCount / cols);

    const positions = [];
    const spacingX = width / (cols + 1);
    const spacingY = height / (rows + 1);

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (positions.length >= droneCount) break;
            positions.push({
                x: -width / 2 + spacingX * (col + 1),
                y: -height / 2 + spacingY * (row + 1)
            });
        }
    }

    return positions.slice(0, droneCount);
}

export function calculateAirCustomFormation(object, droneCount) {
    if (!object.customPath || object.customPath.length < 3) {
        return calculateAirCircleFormation(object, droneCount);
    }

    const path = object.customPath;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    path.forEach(p => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
    });

    const width = maxX - minX;
    const height = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const positions = [];
    const cols = Math.ceil(Math.sqrt(droneCount * (width / height)));
    const rows = Math.ceil(droneCount / cols);
    const spacingX = width / (cols + 1);
    const spacingY = height / (rows + 1);

    const isInside = (x, y) => {
        let inside = false;
        for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
            const xi = path[i].x, yi = path[i].y;
            const xj = path[j].x, yj = path[j].y;
            const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    };

    for (let row = 0; row < rows * 2; row++) {
        for (let col = 0; col < cols * 2; col++) {
            if (positions.length >= droneCount) break;
            const x = minX + spacingX * (col + 0.5);
            const y = minY + spacingY * (row + 0.5);

            if (isInside(x, y)) {
                positions.push({ x: x - centerX, y: y - centerY });
            }
        }
        if (positions.length >= droneCount) break;
    }

    return positions.slice(0, droneCount);
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
