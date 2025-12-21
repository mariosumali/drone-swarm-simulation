// Pathfinding utility using A* algorithm for obstacle avoidance

/**
 * A* Pathfinding algorithm that finds the shortest path while avoiding obstacles
 */

/**
 * Check if a point is inside an obstacle
 */
function isPointInObstacle(point, obstacle, margin = 10) {
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
        // Simplified bounding box check for custom shapes
        const w = (obstacle.w || 100) / 2 + margin;
        const h = (obstacle.h || 100) / 2 + margin;
        return point.x >= pos.x - w && point.x <= pos.x + w &&
            point.y >= pos.y - h && point.y <= pos.y + h;
    }

    return false;
}

/**
 * Check if a line segment intersects with an obstacle
 */
function lineIntersectsObstacle(p1, p2, obstacle, margin = 10) {
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

/**
 * Generate an auto path for an object between two states, avoiding obstacles
 * @param {Object} object - The object to create path for
 * @param {string} fromStateId - Starting state ID
 * @param {string} toStateId - Ending state ID
 * @param {Array} allItems - All items in the simulation
 * @returns {Array} - Array of path points
 */
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
