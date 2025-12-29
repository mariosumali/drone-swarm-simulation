/**
 * CagingFormation - Calculate caging positions around an object
 * Supports circle and polygon formations
 */

class CagingFormation {
    constructor(options = {}) {
        this.minDistance = options.minDistance || 50; // Min distance from object
        this.maxDistance = options.maxDistance || 100; // Max distance from object
        this.spacing = options.spacing || 60; // Min spacing between drones
    }

    /**
     * Calculate caging positions around an object
     * @param {Object} objectBounds - { min: {x, y}, max: {x, y} } bounds of object
     * @param {Object} objectCenter - { x, y } center of object
     * @param {number} droneCount - Number of drones to position
     * @param {string} formationType - 'circle' or 'polygon'
     * @returns {Array} Array of { x, y, angle } positions
     */
    calculatePositions(objectBounds, objectCenter, droneCount, formationType = 'circle') {
        if (droneCount <= 0) return [];

        // Calculate object radius (approximation)
        const width = objectBounds.max.x - objectBounds.min.x;
        const height = objectBounds.max.y - objectBounds.min.y;
        const objectRadius = Math.max(width, height) / 2;

        // Caging radius
        const cageRadius = objectRadius + this.minDistance +
            (this.maxDistance - this.minDistance) / 2;

        switch (formationType) {
            case 'polygon':
                return this._polygonFormation(objectCenter, cageRadius, droneCount);
            case 'circle':
            default:
                return this._circleFormation(objectCenter, cageRadius, droneCount);
        }
    }

    /**
     * Circle formation - drones evenly spaced around a circle
     */
    _circleFormation(center, radius, droneCount) {
        const positions = [];
        const angleStep = (2 * Math.PI) / droneCount;

        for (let i = 0; i < droneCount; i++) {
            const angle = angleStep * i - Math.PI / 2; // Start from top
            positions.push({
                x: center.x + radius * Math.cos(angle),
                y: center.y + radius * Math.sin(angle),
                angle: angle + Math.PI, // Face inward
                index: i
            });
        }

        return positions;
    }

    /**
     * Polygon formation - drones at vertices of a regular polygon
     */
    _polygonFormation(center, radius, droneCount) {
        // For polygon, sides = drone count (each drone at a vertex)
        return this._circleFormation(center, radius, droneCount);
    }

    /**
     * Assign drones to positions using greedy algorithm
     * Minimizes total distance traveled
     * @param {Array} drones - Array of { id, position: {x, y} }
     * @param {Array} positions - Array of { x, y } target positions
     * @returns {Map} Map of droneId -> position
     */
    assignPositions(drones, positions) {
        const assignments = new Map();
        const availablePositions = [...positions];
        const assignedDrones = new Set();

        // Greedy assignment - assign closest pairs first
        while (availablePositions.length > 0 && assignedDrones.size < drones.length) {
            let bestDrone = null;
            let bestPos = null;
            let bestDist = Infinity;

            drones.forEach(drone => {
                if (assignedDrones.has(drone.id)) return;

                availablePositions.forEach((pos, idx) => {
                    const dist = this._distance(drone.position, pos);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestDrone = drone;
                        bestPos = { pos, idx };
                    }
                });
            });

            if (bestDrone && bestPos) {
                assignments.set(bestDrone.id, bestPos.pos);
                assignedDrones.add(bestDrone.id);
                availablePositions.splice(bestPos.idx, 1);
            } else {
                break;
            }
        }

        return assignments;
    }

    /**
     * Check if formation is complete (all drones in position)
     * @param {Array} drones - Array of { id, position: {x, y} }
     * @param {Map} assignments - Map of droneId -> target position
     * @param {number} tolerance - Distance tolerance
     * @returns {boolean}
     */
    isFormationComplete(drones, assignments, tolerance = 10) {
        for (const drone of drones) {
            const target = assignments.get(drone.id);
            if (!target) continue;

            const dist = this._distance(drone.position, target);
            if (dist > tolerance) {
                return false;
            }
        }
        return true;
    }

    /**
     * Calculate formation centroid
     * @param {Array} positions - Array of { x, y }
     * @returns {Object} { x, y }
     */
    getCentroid(positions) {
        if (positions.length === 0) return { x: 0, y: 0 };

        let sumX = 0, sumY = 0;
        positions.forEach(p => {
            sumX += p.x;
            sumY += p.y;
        });

        return {
            x: sumX / positions.length,
            y: sumY / positions.length
        };
    }

    _distance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
}

export default CagingFormation;
