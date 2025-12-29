/**
 * SensorSystem - Environment perception for drones
 * Provides raycasting, proximity detection, and object classification
 */

import Matter from 'matter-js';

class SensorSystem {
    constructor(engine) {
        this.engine = engine;
    }

    /**
     * Sense the environment around a position
     * @param {Object} position - {x, y} center position
     * @param {number} radius - Sensing radius in pixels
     * @param {number} selfId - ID of the sensing body (to exclude from results)
     * @returns {Object} Sensed environment data
     */
    sense(position, radius, selfId = null) {
        if (!this.engine) return { objects: [], drones: [], walls: [], target: null };

        const bodies = Matter.Composite.allBodies(this.engine.world);
        const result = {
            objects: [],
            drones: [],
            walls: [],
            target: null,
            allBodies: []
        };

        bodies.forEach(body => {
            if (body.id === selfId) return;

            const distance = this._distance(position, body.position);
            if (distance > radius) return;

            const bodyInfo = {
                id: body.id,
                position: { x: body.position.x, y: body.position.y },
                velocity: body.velocity ? { x: body.velocity.x, y: body.velocity.y } : { x: 0, y: 0 },
                angle: body.angle,
                distance: distance,
                label: body.label,
                isStatic: body.isStatic,
                bounds: body.bounds
            };

            // Classify the body
            if (body.isStatic) {
                result.walls.push(bodyInfo);
            } else if (body.label === 'drone') {
                result.drones.push(bodyInfo);
            } else if (body.label === 'target' || body.isTarget) {
                result.target = bodyInfo;
                result.objects.push(bodyInfo);
            } else {
                result.objects.push(bodyInfo);
            }

            result.allBodies.push(bodyInfo);
        });

        // Sort by distance
        result.objects.sort((a, b) => a.distance - b.distance);
        result.drones.sort((a, b) => a.distance - b.distance);
        result.walls.sort((a, b) => a.distance - b.distance);

        return result;
    }

    /**
     * Cast a ray and find intersections
     * @param {Object} origin - {x, y} ray origin
     * @param {Object} direction - {x, y} normalized direction
     * @param {number} maxDistance - Maximum ray length
     * @param {number} selfId - ID of the casting body (to exclude)
     * @returns {Object|null} First intersection or null
     */
    raycast(origin, direction, maxDistance = 500, selfId = null) {
        if (!this.engine) return null;

        const bodies = Matter.Composite.allBodies(this.engine.world);
        let closest = null;
        let closestDist = maxDistance;

        // Normalize direction
        const len = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
        const dir = { x: direction.x / len, y: direction.y / len };

        // End point of ray
        const end = {
            x: origin.x + dir.x * maxDistance,
            y: origin.y + dir.y * maxDistance
        };

        bodies.forEach(body => {
            if (body.id === selfId) return;

            // Simple AABB check first
            const bounds = body.bounds;
            if (!this._lineIntersectsAABB(origin, end, bounds)) return;

            // Check each edge of the body
            const vertices = body.vertices;
            for (let i = 0; i < vertices.length; i++) {
                const v1 = vertices[i];
                const v2 = vertices[(i + 1) % vertices.length];

                const intersection = this._lineIntersection(origin, end, v1, v2);
                if (intersection) {
                    const dist = this._distance(origin, intersection);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closest = {
                            point: intersection,
                            distance: dist,
                            body: {
                                id: body.id,
                                label: body.label,
                                isStatic: body.isStatic
                            },
                            normal: this._getNormal(v1, v2)
                        };
                    }
                }
            }
        });

        return closest;
    }

    /**
     * Cast multiple rays in a fan pattern
     * @param {Object} origin - {x, y} ray origin
     * @param {number} startAngle - Starting angle in radians
     * @param {number} endAngle - Ending angle in radians
     * @param {number} rayCount - Number of rays to cast
     * @param {number} maxDistance - Maximum ray length
     * @param {number} selfId - ID of the casting body
     * @returns {Array} Array of ray results
     */
    raycastFan(origin, startAngle, endAngle, rayCount, maxDistance = 500, selfId = null) {
        const results = [];
        const angleStep = (endAngle - startAngle) / Math.max(1, rayCount - 1);

        for (let i = 0; i < rayCount; i++) {
            const angle = startAngle + angleStep * i;
            const direction = { x: Math.cos(angle), y: Math.sin(angle) };
            results.push({
                angle,
                result: this.raycast(origin, direction, maxDistance, selfId)
            });
        }

        return results;
    }

    /**
     * Check if there's a clear path between two points
     * @param {Object} from - Start position
     * @param {Object} to - End position
     * @param {number} selfId - ID to exclude
     * @returns {boolean} True if path is clear
     */
    isPathClear(from, to, selfId = null) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const direction = { x: dx / distance, y: dy / distance };

        const hit = this.raycast(from, direction, distance, selfId);
        return hit === null;
    }

    // Helper: Calculate distance between two points
    _distance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Helper: Check if line intersects AABB
    _lineIntersectsAABB(p1, p2, bounds) {
        const minX = Math.min(p1.x, p2.x);
        const maxX = Math.max(p1.x, p2.x);
        const minY = Math.min(p1.y, p2.y);
        const maxY = Math.max(p1.y, p2.y);

        return !(maxX < bounds.min.x || minX > bounds.max.x ||
            maxY < bounds.min.y || minY > bounds.max.y);
    }

    // Helper: Line-line intersection
    _lineIntersection(p1, p2, p3, p4) {
        const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
        if (Math.abs(denom) < 0.0001) return null;

        const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
        const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;

        if (ua < 0 || ua > 1 || ub < 0 || ub > 1) return null;

        return {
            x: p1.x + ua * (p2.x - p1.x),
            y: p1.y + ua * (p2.y - p1.y)
        };
    }

    // Helper: Get normal vector of an edge
    _getNormal(v1, v2) {
        const dx = v2.x - v1.x;
        const dy = v2.y - v1.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        return { x: -dy / len, y: dx / len };
    }
}

export default SensorSystem;
