/**
 * PathPlanner - Multiple pathfinding algorithms
 * Supports A*, RRT, and formation-aware pathfinding
 */

class PathPlanner {
    constructor(options = {}) {
        this.gridSize = options.gridSize || 20; // Grid cell size for A*
        this.rrtStepSize = options.rrtStepSize || 30; // RRT step size
        this.rrtMaxIterations = options.rrtMaxIterations || 1000;
        this.formationSpacing = options.formationSpacing || 60;
    }

    /**
     * Find a path using the specified algorithm
     * @param {Object} start - {x, y} start position
     * @param {Object} goal - {x, y} goal position
     * @param {Object} bounds - {width, height} world bounds
     * @param {Array} obstacles - Array of obstacle bounds
     * @param {string} algorithm - 'astar', 'rrt', or 'formation'
     * @param {Object} options - Algorithm-specific options
     * @returns {Array} Array of {x, y} waypoints
     */
    findPath(start, goal, bounds, obstacles, algorithm = 'astar', options = {}) {
        switch (algorithm) {
            case 'rrt':
                return this._rrt(start, goal, bounds, obstacles, options);
            case 'formation':
                return this._formationAware(start, goal, bounds, obstacles, options);
            case 'astar':
            default:
                return this._astar(start, goal, bounds, obstacles);
        }
    }

    // ==================== A* PATHFINDING ====================

    /**
     * A* pathfinding on a grid
     */
    _astar(start, goal, bounds, obstacles) {
        const cols = Math.ceil(bounds.width / this.gridSize);
        const rows = Math.ceil(bounds.height / this.gridSize);

        // Create grid
        const grid = this._createGrid(cols, rows, obstacles);

        // Convert world coords to grid coords
        const startNode = {
            col: Math.floor(start.x / this.gridSize),
            row: Math.floor(start.y / this.gridSize)
        };
        const goalNode = {
            col: Math.floor(goal.x / this.gridSize),
            row: Math.floor(goal.y / this.gridSize)
        };

        // Clamp to grid bounds
        startNode.col = Math.max(0, Math.min(cols - 1, startNode.col));
        startNode.row = Math.max(0, Math.min(rows - 1, startNode.row));
        goalNode.col = Math.max(0, Math.min(cols - 1, goalNode.col));
        goalNode.row = Math.max(0, Math.min(rows - 1, goalNode.row));

        // A* algorithm
        const openSet = [{ ...startNode, g: 0, f: 0, parent: null }];
        const closedSet = new Set();

        while (openSet.length > 0) {
            // Get node with lowest f
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();

            // Check if reached goal
            if (current.col === goalNode.col && current.row === goalNode.row) {
                return this._reconstructPath(current, this.gridSize);
            }

            closedSet.add(`${current.col},${current.row}`);

            // Check neighbors (8-directional)
            const neighbors = [
                { col: current.col - 1, row: current.row },
                { col: current.col + 1, row: current.row },
                { col: current.col, row: current.row - 1 },
                { col: current.col, row: current.row + 1 },
                { col: current.col - 1, row: current.row - 1 },
                { col: current.col + 1, row: current.row - 1 },
                { col: current.col - 1, row: current.row + 1 },
                { col: current.col + 1, row: current.row + 1 }
            ];

            for (const neighbor of neighbors) {
                // Skip if out of bounds
                if (neighbor.col < 0 || neighbor.col >= cols ||
                    neighbor.row < 0 || neighbor.row >= rows) continue;

                // Skip if in closed set
                if (closedSet.has(`${neighbor.col},${neighbor.row}`)) continue;

                // Skip if obstacle
                if (grid[neighbor.row][neighbor.col] === 1) continue;

                // Calculate costs
                const isDiagonal = neighbor.col !== current.col && neighbor.row !== current.row;
                const moveCost = isDiagonal ? 1.414 : 1;
                const g = current.g + moveCost;
                const h = this._heuristic(neighbor, goalNode);
                const f = g + h;

                // Check if better path
                const existing = openSet.find(n => n.col === neighbor.col && n.row === neighbor.row);
                if (existing) {
                    if (g < existing.g) {
                        existing.g = g;
                        existing.f = f;
                        existing.parent = current;
                    }
                } else {
                    openSet.push({ ...neighbor, g, f, parent: current });
                }
            }
        }

        // No path found - return direct path
        return [start, goal];
    }

    _createGrid(cols, rows, obstacles) {
        const grid = Array(rows).fill(null).map(() => Array(cols).fill(0));

        obstacles.forEach(obs => {
            const minCol = Math.floor(obs.min.x / this.gridSize);
            const maxCol = Math.ceil(obs.max.x / this.gridSize);
            const minRow = Math.floor(obs.min.y / this.gridSize);
            const maxRow = Math.ceil(obs.max.y / this.gridSize);

            for (let r = minRow; r <= maxRow; r++) {
                for (let c = minCol; c <= maxCol; c++) {
                    if (r >= 0 && r < rows && c >= 0 && c < cols) {
                        grid[r][c] = 1;
                    }
                }
            }
        });

        return grid;
    }

    _heuristic(a, b) {
        // Euclidean distance
        const dx = a.col - b.col;
        const dy = a.row - b.row;
        return Math.sqrt(dx * dx + dy * dy);
    }

    _reconstructPath(node, gridSize) {
        const path = [];
        let current = node;

        while (current) {
            path.unshift({
                x: current.col * gridSize + gridSize / 2,
                y: current.row * gridSize + gridSize / 2
            });
            current = current.parent;
        }

        return this._smoothPath(path);
    }

    _smoothPath(path) {
        if (path.length <= 2) return path;

        // Simple path smoothing - remove redundant waypoints
        const smoothed = [path[0]];

        for (let i = 1; i < path.length - 1; i++) {
            const prev = smoothed[smoothed.length - 1];
            const curr = path[i];
            const next = path[i + 1];

            // Check if direction changes significantly
            const dir1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
            const dir2 = Math.atan2(next.y - curr.y, next.x - curr.x);
            const angleDiff = Math.abs(dir1 - dir2);

            if (angleDiff > 0.1) {
                smoothed.push(curr);
            }
        }

        smoothed.push(path[path.length - 1]);
        return smoothed;
    }

    // ==================== RRT PATHFINDING ====================

    /**
     * Rapidly-exploring Random Tree (RRT) pathfinding
     */
    _rrt(start, goal, bounds, obstacles, options = {}) {
        const stepSize = options.stepSize || this.rrtStepSize;
        const maxIterations = options.maxIterations || this.rrtMaxIterations;
        const goalBias = options.goalBias || 0.1; // Probability of sampling goal

        const tree = [{ pos: start, parent: null }];

        for (let i = 0; i < maxIterations; i++) {
            // Sample random point (with goal bias)
            let sample;
            if (Math.random() < goalBias) {
                sample = goal;
            } else {
                sample = {
                    x: Math.random() * bounds.width,
                    y: Math.random() * bounds.height
                };
            }

            // Find nearest node in tree
            let nearest = tree[0];
            let nearestDist = this._distance(sample, nearest.pos);

            for (const node of tree) {
                const dist = this._distance(sample, node.pos);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearest = node;
                }
            }

            // Extend toward sample
            const direction = {
                x: sample.x - nearest.pos.x,
                y: sample.y - nearest.pos.y
            };
            const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y);

            const newPos = {
                x: nearest.pos.x + (direction.x / length) * Math.min(stepSize, length),
                y: nearest.pos.y + (direction.y / length) * Math.min(stepSize, length)
            };

            // Check for collision
            if (!this._collides(nearest.pos, newPos, obstacles)) {
                const newNode = { pos: newPos, parent: nearest };
                tree.push(newNode);

                // Check if reached goal
                if (this._distance(newPos, goal) < stepSize) {
                    const goalNode = { pos: goal, parent: newNode };
                    return this._reconstructRRTPath(goalNode);
                }
            }
        }

        // No path found - return direct path
        return [start, goal];
    }

    _reconstructRRTPath(node) {
        const path = [];
        let current = node;

        while (current) {
            path.unshift(current.pos);
            current = current.parent;
        }

        return this._smoothPath(path);
    }

    _collides(from, to, obstacles) {
        for (const obs of obstacles) {
            if (this._lineIntersectsRect(from, to, obs)) {
                return true;
            }
        }
        return false;
    }

    _lineIntersectsRect(p1, p2, rect) {
        // Check if line segment intersects rectangle
        const left = rect.min.x;
        const right = rect.max.x;
        const top = rect.min.y;
        const bottom = rect.max.y;

        // Check each edge
        return this._lineIntersectsLine(p1, p2, { x: left, y: top }, { x: right, y: top }) ||
            this._lineIntersectsLine(p1, p2, { x: right, y: top }, { x: right, y: bottom }) ||
            this._lineIntersectsLine(p1, p2, { x: right, y: bottom }, { x: left, y: bottom }) ||
            this._lineIntersectsLine(p1, p2, { x: left, y: bottom }, { x: left, y: top }) ||
            (p1.x > left && p1.x < right && p1.y > top && p1.y < bottom);
    }

    _lineIntersectsLine(p1, p2, p3, p4) {
        const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
        if (Math.abs(denom) < 0.0001) return false;

        const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
        const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;

        return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
    }

    // ==================== FORMATION-AWARE PATHFINDING ====================

    /**
     * Formation-aware pathfinding - maintains spacing between drones
     */
    _formationAware(start, goal, bounds, obstacles, options = {}) {
        const spacing = options.spacing || this.formationSpacing;
        const formationCenter = options.formationCenter || start;
        const offset = options.offset || { x: 0, y: 0 };

        // Calculate formation goal (offset from formation center's goal)
        const formationGoal = {
            x: goal.x + offset.x,
            y: goal.y + offset.y
        };

        // Use A* for base path
        const basePath = this._astar(start, formationGoal, bounds, obstacles);

        // Adjust path to maintain formation offset
        return basePath.map((point, i) => {
            if (i === 0) return point; // Keep start position

            // Interpolate offset maintenance
            const t = i / (basePath.length - 1);
            const currentOffset = {
                x: offset.x,
                y: offset.y
            };

            return {
                x: point.x,
                y: point.y,
                formationOffset: currentOffset
            };
        });
    }

    // ==================== UTILITIES ====================

    _distance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Get obstacles from physics engine
     * @param {Object} engine - Matter.js engine
     * @returns {Array} Array of obstacle bounds
     */
    static getObstaclesFromEngine(engine) {
        if (!engine) return [];

        const Matter = require('matter-js');
        const bodies = Matter.Composite.allBodies(engine.world);

        return bodies
            .filter(b => b.isStatic && b.label !== 'wall')
            .map(b => b.bounds);
    }
}

export default PathPlanner;
