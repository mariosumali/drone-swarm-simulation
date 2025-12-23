// Pathfinding utility using A* algorithm for obstacle avoidance

/**
 * A* Pathfinding algorithm that finds the shortest path while avoiding obstacles
 */

/**
 * Check if a point is inside an obstacle
 */
export function isPointInObstacle(point, obstacle, margin = 10) {
    const pos = obstacle.statePositions?.[obstacle._checkStateId] || { x: 0, y: 0 };

    if (obstacle.type === 'circle') {
        const radius = obstacle.w ? obstacle.w / 2 : (obstacle.radius || 50);
        const radiusY = obstacle.h ? obstacle.h / 2 : radius;
        // Ellipse check with margin
        const dx = point.x - pos.x;
        const dy = point.y - pos.y;
        return (dx * dx) / ((radius + margin) * (radius + margin)) +
            (dy * dy) / ((radiusY + margin) * (radiusY + margin)) <= 1;
    }

    if (obstacle.type === 'rectangle') {
        const w = (obstacle.w || 100) / 2 + margin;
        const h = (obstacle.h || 100) / 2 + margin;
        return point.x >= pos.x - w && point.x <= pos.x + w &&
            point.y >= pos.y - h && point.y <= pos.y + h;
    }

    if (obstacle.type === 'custom' && obstacle.customPath) {
        // Use ray casting algorithm for point-in-polygon test
        const path = obstacle.customPath;

        // Calculate scale factors
        const xs = path.map(p => p.x);
        const ys = path.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const origW = maxX - minX || 1;
        const origH = maxY - minY || 1;
        const currentW = obstacle.w || origW;
        const currentH = obstacle.h || origH;
        const scaleX = currentW / origW;
        const scaleY = currentH / origH;

        // Transform point to local coordinates (relative to obstacle center)
        const localX = point.x - pos.x;
        const localY = point.y - pos.y;

        // Scale path points to match current size (with margin)
        const scaledPath = path.map(p => ({
            x: p.x * scaleX,
            y: p.y * scaleY
        }));

        // Expand polygon by margin using bounding box approximation for margin
        const expandedPath = scaledPath.map(p => ({
            x: p.x + (p.x > 0 ? margin : -margin) * 0.5,
            y: p.y + (p.y > 0 ? margin : -margin) * 0.5
        }));

        // Ray casting algorithm
        let inside = false;
        for (let i = 0, j = expandedPath.length - 1; i < expandedPath.length; j = i++) {
            const xi = expandedPath[i].x, yi = expandedPath[i].y;
            const xj = expandedPath[j].x, yj = expandedPath[j].y;
            const intersect = ((yi > localY) !== (yj > localY)) &&
                (localX < (xj - xi) * (localY - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    return false;
}

/**
 * Check if a line segment intersects with an obstacle
 */
export function lineIntersectsObstacle(p1, p2, obstacle, margin = 10) {
    // Sample points along the line and check each
    const steps = Math.max(10, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / 10));

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const point = {
            x: p1.x + (p2.x - p1.x) * t,
            y: p1.y + (p2.y - p1.y) * t
        };
        if (isPointInObstacle(point, obstacle, margin)) {
            return true;
        }
    }
    return false;
}

/**
 * Get neighbors for A* grid-based pathfinding
 */
function getNeighbors(node, gridSize) {
    const neighbors = [];
    const directions = [
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 },
        { dx: 1, dy: 1 },
        { dx: -1, dy: 1 },
        { dx: 1, dy: -1 },
        { dx: -1, dy: -1 }
    ];

    for (const dir of directions) {
        neighbors.push({
            x: node.x + dir.dx * gridSize,
            y: node.y + dir.dy * gridSize
        });
    }
    return neighbors;
}

/**
 * Heuristic function (Euclidean distance)
 */
function heuristic(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Simplify path by removing unnecessary waypoints
 */
function simplifyPath(path, obstacles, margin) {
    if (path.length <= 2) return path;

    const simplified = [path[0]];
    let current = 0;

    while (current < path.length - 1) {
        let farthest = current + 1;

        // Try to skip intermediate points if direct line is clear
        for (let i = path.length - 1; i > current + 1; i--) {
            let lineIsClear = true;
            for (const obstacle of obstacles) {
                if (lineIntersectsObstacle(path[current], path[i], obstacle, margin)) {
                    lineIsClear = false;
                    break;
                }
            }
            if (lineIsClear) {
                farthest = i;
                break;
            }
        }

        simplified.push(path[farthest]);
        current = farthest;
    }

    return simplified;
}

/**
 * Main A* pathfinding function
 * @param {Object} start - Starting point {x, y}
 * @param {Object} end - Ending point {x, y}
 * @param {Array} obstacles - Array of obstacle items (with isObstacle: true)
 * @param {string} stateId - Current state ID for position lookup
 * @param {Object} options - Options like gridSize, margin
 * @returns {Array} - Array of waypoints from start to end
 */
export function findPath(start, end, obstacles, stateId, options = {}) {
    const { gridSize = 20, margin = 15, maxIterations = 5000 } = options;

    console.log('AutoPath: Finding path from', start, 'to', end);
    console.log('AutoPath: Obstacles count:', obstacles.length);
    obstacles.forEach((o, i) => {
        const pos = o.statePositions?.[stateId];
        console.log(`  Obstacle ${i}: type=${o.type}, pos=${JSON.stringify(pos)}, w=${o.w}, h=${o.h}, radius=${o.radius}`);
    });

    // Prepare obstacles with state reference
    const preparedObstacles = obstacles.map(o => ({ ...o, _checkStateId: stateId }));

    // Check if direct path is clear
    let directPathClear = true;
    for (const obstacle of preparedObstacles) {
        if (lineIntersectsObstacle(start, end, obstacle, margin)) {
            console.log('AutoPath: Direct path blocked by obstacle:', obstacle.type);
            directPathClear = false;
            break;
        }
    }

    if (directPathClear) {
        console.log('AutoPath: Direct path is clear');
        return [start, end]; // No obstacles in the way
    }

    console.log('AutoPath: Running A* algorithm...');

    // A* algorithm
    const openSet = new Map();
    const closedSet = new Set();
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();

    const startKey = `${Math.round(start.x / gridSize)},${Math.round(start.y / gridSize)}`;
    const startNode = {
        x: Math.round(start.x / gridSize) * gridSize,
        y: Math.round(start.y / gridSize) * gridSize
    };

    openSet.set(startKey, startNode);
    gScore.set(startKey, 0);
    fScore.set(startKey, heuristic(startNode, end));

    let iterations = 0;

    while (openSet.size > 0 && iterations < maxIterations) {
        iterations++;

        // Find node with lowest fScore
        let currentKey = null;
        let lowestF = Infinity;
        for (const [key, node] of openSet) {
            const f = fScore.get(key) || Infinity;
            if (f < lowestF) {
                lowestF = f;
                currentKey = key;
            }
        }

        const current = openSet.get(currentKey);

        // Check if we've reached the goal
        if (heuristic(current, end) < gridSize * 1.5) {
            // Reconstruct path
            const path = [end];
            let key = currentKey;
            while (cameFrom.has(key)) {
                const node = openSet.get(key) || closedSet.has(key) ?
                    { x: parseInt(key.split(',')[0]) * gridSize, y: parseInt(key.split(',')[1]) * gridSize } : null;
                if (node) path.unshift(node);
                key = cameFrom.get(key);
            }
            path.unshift(start);

            console.log('AutoPath: Found path with', path.length, 'waypoints');
            // Simplify the path
            return simplifyPath(path, preparedObstacles, margin);
        }

        openSet.delete(currentKey);
        closedSet.add(currentKey);

        // Explore neighbors
        for (const neighbor of getNeighbors(current, gridSize)) {
            const neighborKey = `${Math.round(neighbor.x / gridSize)},${Math.round(neighbor.y / gridSize)}`;

            if (closedSet.has(neighborKey)) continue;

            // Check if neighbor is inside an obstacle
            let blocked = false;
            for (const obstacle of preparedObstacles) {
                if (isPointInObstacle(neighbor, obstacle, margin)) {
                    blocked = true;
                    break;
                }
            }
            if (blocked) continue;

            // Check if path to neighbor crosses an obstacle
            let pathBlocked = false;
            for (const obstacle of preparedObstacles) {
                if (lineIntersectsObstacle(current, neighbor, obstacle, margin)) {
                    pathBlocked = true;
                    break;
                }
            }
            if (pathBlocked) continue;

            const tentativeG = (gScore.get(currentKey) || 0) + heuristic(current, neighbor);

            if (!openSet.has(neighborKey)) {
                openSet.set(neighborKey, neighbor);
            } else if (tentativeG >= (gScore.get(neighborKey) || Infinity)) {
                continue;
            }

            cameFrom.set(neighborKey, currentKey);
            gScore.set(neighborKey, tentativeG);
            fScore.set(neighborKey, tentativeG + heuristic(neighbor, end));
        }
    }

    // No path found, return direct path as fallback
    console.warn('AutoPath: No clear path found after', iterations, 'iterations, using direct path');
    return [start, end];
}

export function generateAutoPath(object, fromStateId, toStateId, allItems) {
    const startPos = object.statePositions?.[fromStateId];
    const endPos = object.statePositions?.[toStateId];

    if (!startPos || !endPos) {
        console.warn('AutoPath: Missing start or end position');
        return null;
    }

    // Get all obstacles (all non-drone objects that aren't the moving object itself)
    const obstacles = allItems.filter(item =>
        item.type !== 'drone' &&
        item.id !== object.id &&
        item.activeStates?.includes(fromStateId)
    );

    if (obstacles.length === 0) {
        // No obstacles, direct path
        return [
            { x: startPos.x, y: startPos.y },
            { x: endPos.x, y: endPos.y }
        ];
    }

    // Consider the size of the moving object for margin
    let objectSize = 0;
    if (object.type === 'circle') {
        objectSize = object.w ? object.w / 2 : (object.radius || 50);
    } else if (object.type === 'rectangle') {
        objectSize = Math.max(object.w || 100, object.h || 100) / 2;
    } else if (object.type === 'custom') {
        objectSize = Math.max(object.w || 50, object.h || 50) / 2;
    }

    const path = findPath(
        { x: startPos.x, y: startPos.y },
        { x: endPos.x, y: endPos.y },
        obstacles,
        fromStateId,
        { margin: objectSize + 20, gridSize: 15 }
    );

    return path;
}

// ============================================
// 3D PATHFINDING FOR AERIAL DRONES
// ============================================

/**
 * 3D Heuristic function (Euclidean distance in 3D)
 */
function heuristic3D(a, b) {
    return Math.sqrt(
        Math.pow(b.x - a.x, 2) +
        Math.pow(b.y - a.y, 2) +
        Math.pow((b.z || 0) - (a.z || 0), 2)
    );
}

/**
 * Get 3D neighbors for A* (26 directions including vertical)
 */
function getNeighbors3D(node, gridSize, verticalGridSize = 20) {
    const neighbors = [];

    // XY directions (8)
    const xyDirs = [
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 },
        { dx: 1, dy: 1 },
        { dx: -1, dy: 1 },
        { dx: 1, dy: -1 },
        { dx: -1, dy: -1 }
    ];

    // Z directions
    const zDirs = [-1, 0, 1];

    for (const xyDir of xyDirs) {
        for (const dz of zDirs) {
            neighbors.push({
                x: node.x + xyDir.dx * gridSize,
                y: node.y + xyDir.dy * gridSize,
                z: (node.z || 0) + dz * verticalGridSize
            });
        }
    }

    // Pure vertical movement
    neighbors.push({ x: node.x, y: node.y, z: (node.z || 0) + verticalGridSize });
    neighbors.push({ x: node.x, y: node.y, z: (node.z || 0) - verticalGridSize });

    // Filter out negative Z (can't go underground)
    return neighbors.filter(n => n.z >= 0);
}

/**
 * Check if a point in 3D space collides with an obstacle
 * Air drones can fly OVER obstacles if their altitude is above the obstacle height
 */
function isPointBlocked3D(point, obstacle, margin = 10) {
    const pos = obstacle.statePositions?.[obstacle._checkStateId] || { x: 0, y: 0, z: 0 };
    const obstacleZ = pos.z || 0;
    const obstacleHeight = obstacle.height || 20;
    const obstacleTop = obstacleZ + obstacleHeight;

    // If drone is above obstacle top + margin, it's clear
    if ((point.z || 0) > obstacleTop + margin) {
        return false;
    }

    // If drone is below obstacle base - margin, it's clear (underground - shouldn't happen)
    if ((point.z || 0) < obstacleZ - margin) {
        return false;
    }

    // Check XY collision
    return isPointInObstacle(
        { x: point.x, y: point.y },
        obstacle,
        margin
    );
}

/**
 * Check if a 3D line segment is blocked by an obstacle
 */
function lineBlocked3D(p1, p2, obstacle, margin = 10) {
    const steps = Math.max(10, Math.ceil(heuristic3D(p1, p2) / 10));

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const point = {
            x: p1.x + (p2.x - p1.x) * t,
            y: p1.y + (p2.y - p1.y) * t,
            z: (p1.z || 0) + ((p2.z || 0) - (p1.z || 0)) * t
        };
        if (isPointBlocked3D(point, obstacle, margin)) {
            return true;
        }
    }
    return false;
}

/**
 * 3D A* Pathfinding for aerial drones
 * Routes drones up, over obstacles, and down to the target
 * 
 * @param {Object} start - Starting point {x, y, z}
 * @param {Object} end - Ending point {x, y, z}
 * @param {Array} obstacles - Array of obstacle items
 * @param {string} stateId - Current state ID
 * @param {Object} options - Options like gridSize, margin
 * @returns {Array} - Array of 3D waypoints
 */
export function findPath3D(start, end, obstacles, stateId, options = {}) {
    const {
        gridSize = 20,
        verticalGridSize = 20,
        margin = 15,
        maxIterations = 8000
    } = options;

    // Ensure start and end have z
    const start3D = { x: start.x, y: start.y, z: start.z || 0 };
    const end3D = { x: end.x, y: end.y, z: end.z || 0 };

    console.log('3D AutoPath: Finding path from', start3D, 'to', end3D);

    // Prepare obstacles with state reference
    const preparedObstacles = obstacles.map(o => ({ ...o, _checkStateId: stateId }));

    // Check if direct path is clear
    let directPathClear = true;
    for (const obstacle of preparedObstacles) {
        if (lineBlocked3D(start3D, end3D, obstacle, margin)) {
            directPathClear = false;
            break;
        }
    }

    if (directPathClear) {
        console.log('3D AutoPath: Direct path is clear');
        return [start3D, end3D];
    }

    console.log('3D AutoPath: Running 3D A* algorithm...');

    // A* algorithm
    const openSet = new Map();
    const closedSet = new Set();
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();

    const nodeKey = (n) => `${Math.round(n.x / gridSize)},${Math.round(n.y / gridSize)},${Math.round((n.z || 0) / verticalGridSize)}`;

    const startKey = nodeKey(start3D);
    const startNode = {
        x: Math.round(start3D.x / gridSize) * gridSize,
        y: Math.round(start3D.y / gridSize) * gridSize,
        z: Math.round(start3D.z / verticalGridSize) * verticalGridSize
    };

    openSet.set(startKey, startNode);
    gScore.set(startKey, 0);
    fScore.set(startKey, heuristic3D(startNode, end3D));

    let iterations = 0;

    while (openSet.size > 0 && iterations < maxIterations) {
        iterations++;

        // Find node with lowest fScore
        let currentKey = null;
        let lowestF = Infinity;
        for (const [key, node] of openSet) {
            const f = fScore.get(key) || Infinity;
            if (f < lowestF) {
                lowestF = f;
                currentKey = key;
            }
        }

        const current = openSet.get(currentKey);

        // Check if we've reached the goal
        if (heuristic3D(current, end3D) < gridSize * 2) {
            // Reconstruct path
            const path = [end3D];
            let key = currentKey;
            while (cameFrom.has(key)) {
                const keyParts = key.split(',').map(Number);
                const node = {
                    x: keyParts[0] * gridSize,
                    y: keyParts[1] * gridSize,
                    z: keyParts[2] * verticalGridSize
                };
                path.unshift(node);
                key = cameFrom.get(key);
            }
            path.unshift(start3D);

            console.log('3D AutoPath: Found path with', path.length, 'waypoints');
            return simplifyPath3D(path, preparedObstacles, margin);
        }

        openSet.delete(currentKey);
        closedSet.add(currentKey);

        // Explore neighbors
        for (const neighbor of getNeighbors3D(current, gridSize, verticalGridSize)) {
            const neighborKey = nodeKey(neighbor);

            if (closedSet.has(neighborKey)) continue;

            // Check if neighbor is blocked
            let blocked = false;
            for (const obstacle of preparedObstacles) {
                if (isPointBlocked3D(neighbor, obstacle, margin)) {
                    blocked = true;
                    break;
                }
            }
            if (blocked) continue;

            // Check if path to neighbor is blocked
            let pathBlocked = false;
            for (const obstacle of preparedObstacles) {
                if (lineBlocked3D(current, neighbor, obstacle, margin)) {
                    pathBlocked = true;
                    break;
                }
            }
            if (pathBlocked) continue;

            const tentativeG = (gScore.get(currentKey) || 0) + heuristic3D(current, neighbor);

            if (!openSet.has(neighborKey)) {
                openSet.set(neighborKey, neighbor);
            } else if (tentativeG >= (gScore.get(neighborKey) || Infinity)) {
                continue;
            }

            cameFrom.set(neighborKey, currentKey);
            gScore.set(neighborKey, tentativeG);
            fScore.set(neighborKey, tentativeG + heuristic3D(neighbor, end3D));
        }
    }

    // No path found - try a simple "rise, fly, descend" approach
    console.warn('3D AutoPath: A* failed, using rise-fly-descend approach');
    return generateRiseFlyDescendPath(start3D, end3D, preparedObstacles, margin);
}

/**
 * Simplify 3D path by removing unnecessary waypoints
 */
function simplifyPath3D(path, obstacles, margin) {
    if (path.length <= 2) return path;

    const simplified = [path[0]];
    let current = 0;

    while (current < path.length - 1) {
        let farthest = current + 1;

        for (let i = path.length - 1; i > current + 1; i--) {
            let lineIsClear = true;
            for (const obstacle of obstacles) {
                if (lineBlocked3D(path[current], path[i], obstacle, margin)) {
                    lineIsClear = false;
                    break;
                }
            }
            if (lineIsClear) {
                farthest = i;
                break;
            }
        }

        simplified.push(path[farthest]);
        current = farthest;
    }

    return simplified;
}

/**
 * Fallback path: Rise above all obstacles, fly horizontally, then descend
 */
function generateRiseFlyDescendPath(start, end, obstacles, margin) {
    // Find maximum obstacle height
    let maxHeight = 0;
    for (const obs of obstacles) {
        const pos = obs.statePositions?.[obs._checkStateId] || { z: 0 };
        const obsTop = (pos.z || 0) + (obs.height || 20);
        if (obsTop > maxHeight) maxHeight = obsTop;
    }

    const cruiseAltitude = maxHeight + 50; // Fly well above obstacles

    const path = [
        { x: start.x, y: start.y, z: start.z || 0 },
        { x: start.x, y: start.y, z: cruiseAltitude }, // Rise
        { x: end.x, y: end.y, z: cruiseAltitude },     // Fly horizontally
        { x: end.x, y: end.y, z: end.z || 0 }          // Descend
    ];

    return path;
}

/**
 * Generate 3D auto path for an aerial drone
 * @param {Object} drone - The drone object
 * @param {Object} targetPos - Target position {x, y, z}
 * @param {Array} obstacles - Obstacles to avoid
 * @param {string} stateId - Current state ID
 * @returns {Array} - Array of 3D path points
 */
export function generateAutoPath3D(drone, targetPos, obstacles, stateId) {
    const startPos = drone.statePositions?.[stateId];

    if (!startPos) {
        console.warn('3D AutoPath: Missing start position');
        return null;
    }

    return findPath3D(
        { x: startPos.x, y: startPos.y, z: startPos.z || 0 },
        { x: targetPos.x, y: targetPos.y, z: targetPos.z || 0 },
        obstacles,
        stateId,
        { margin: 25, gridSize: 20, verticalGridSize: 20 }
    );
}

