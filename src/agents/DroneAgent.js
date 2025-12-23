/**
 * DroneAgent - Autonomous drone agent with sensing, communication, and physics
 * 
 * Each drone is a self-contained agent that:
 * - Senses nearby obstacles and other drones within its vision range
 * - Communicates with neighboring drones within comm range
 * - Makes local pathfinding decisions in real-time
 * - Has a physics body managed by Matter.js
 */

import Matter from 'matter-js';

// Default configuration
const DEFAULT_CONFIG = {
    senseRange: 150,      // How far the drone can see (pixels)
    commRange: 200,       // Communication range (pixels)
    fov: 120,             // Field of view (degrees)
    maxSpeed: 5,          // Maximum velocity
    maxForce: 0.3,        // Maximum steering force
    mass: 1,              // Physics mass
    radius: 10,           // Collision radius
    separationWeight: 1.5,
    cohesionWeight: 1.0,
    alignmentWeight: 1.0,
    goalWeight: 2.0,
    obstacleWeight: 3.0
};

export class DroneAgent {
    constructor(id, initialPosition, config = {}) {
        this.id = id;
        this.config = { ...DEFAULT_CONFIG, ...config };

        // Position & velocity (will be synced with physics body)
        this.position = { x: initialPosition.x || 0, y: initialPosition.y || 0 };
        this.velocity = { x: 0, y: 0 };
        this.heading = 0; // radians

        // Goal/target position
        this.goal = null;
        this.goalReached = false;

        // Sensing state
        this.sensedObstacles = [];
        this.sensedDrones = [];
        this.neighbors = []; // Drones within comm range

        // Communication
        this.inbox = [];
        this.outbox = [];

        // Physics body (created by AgentManager)
        this.body = null;

        // Behavior state
        this.state = 'idle'; // idle, seeking, avoiding, formation
        this.stateData = {};

        // Debug/visualization
        this.lastForces = {
            separation: { x: 0, y: 0 },
            cohesion: { x: 0, y: 0 },
            alignment: { x: 0, y: 0 },
            goal: { x: 0, y: 0 },
            obstacle: { x: 0, y: 0 }
        };
    }

    /**
     * Create physics body for this agent
     */
    createBody(x, y) {
        this.body = Matter.Bodies.circle(x, y, this.config.radius, {
            label: `drone_${this.id}`,
            frictionAir: 0.05,
            restitution: 0.3,
            mass: this.config.mass,
            collisionFilter: {
                category: 0x0002, // Drone category
                mask: 0x0001 | 0x0002 // Collide with obstacles and other drones
            }
        });
        this.body.agentId = this.id;
        return this.body;
    }

    /**
     * Sense phase - detect obstacles and other drones in range
     */
    sense(allDrones, obstacles) {
        this.sensedObstacles = [];
        this.sensedDrones = [];
        this.neighbors = [];

        const pos = this.getPosition();

        // Sense obstacles
        for (const obstacle of obstacles) {
            const dist = this._distance(pos, obstacle.position);
            if (dist < this.config.senseRange) {
                this.sensedObstacles.push({
                    ...obstacle,
                    distance: dist,
                    angle: Math.atan2(obstacle.position.y - pos.y, obstacle.position.x - pos.x)
                });
            }
        }

        // Sense other drones
        for (const drone of allDrones) {
            if (drone.id === this.id) continue;

            const dronePos = drone.getPosition();
            const dist = this._distance(pos, dronePos);

            // Check if within FOV
            const angleToDrone = Math.atan2(dronePos.y - pos.y, dronePos.x - pos.x);
            const angleOffset = Math.abs(this._normalizeAngle(angleToDrone - this.heading));
            const halfFov = (this.config.fov / 2) * (Math.PI / 180);

            if (dist < this.config.senseRange && angleOffset < halfFov) {
                this.sensedDrones.push({
                    id: drone.id,
                    position: dronePos,
                    velocity: drone.velocity,
                    distance: dist,
                    angle: angleToDrone
                });
            }

            // Communication range (full 360°)
            if (dist < this.config.commRange) {
                this.neighbors.push(drone);
            }
        }
    }

    /**
     * Communicate phase - exchange messages with neighbors
     */
    communicate() {
        // Send messages to neighbors
        for (const msg of this.outbox) {
            for (const neighbor of this.neighbors) {
                neighbor.receiveMessage({
                    from: this.id,
                    ...msg
                });
            }
        }
        this.outbox = [];

        // Process received messages
        const messages = [...this.inbox];
        this.inbox = [];
        return messages;
    }

    /**
     * Receive a message from another drone
     */
    receiveMessage(message) {
        this.inbox.push(message);
    }

    /**
     * Send a message to neighbors
     */
    sendMessage(type, data) {
        this.outbox.push({ type, data, timestamp: Date.now() });
    }

    /**
     * Think phase - compute steering forces based on behaviors
     */
    think() {
        const forces = { x: 0, y: 0 };

        // 1. Separation - avoid crowding neighbors
        const separation = this._computeSeparation();
        forces.x += separation.x * this.config.separationWeight;
        forces.y += separation.y * this.config.separationWeight;
        this.lastForces.separation = separation;

        // 2. Cohesion - steer toward average position of neighbors
        const cohesion = this._computeCohesion();
        forces.x += cohesion.x * this.config.cohesionWeight;
        forces.y += cohesion.y * this.config.cohesionWeight;
        this.lastForces.cohesion = cohesion;

        // 3. Alignment - match velocity with neighbors
        const alignment = this._computeAlignment();
        forces.x += alignment.x * this.config.alignmentWeight;
        forces.y += alignment.y * this.config.alignmentWeight;
        this.lastForces.alignment = alignment;

        // 4. Goal seeking
        if (this.goal) {
            const goalForce = this._computeGoalForce();
            forces.x += goalForce.x * this.config.goalWeight;
            forces.y += goalForce.y * this.config.goalWeight;
            this.lastForces.goal = goalForce;
        }

        // 5. Obstacle avoidance
        const obstacleForce = this._computeObstacleAvoidance();
        forces.x += obstacleForce.x * this.config.obstacleWeight;
        forces.y += obstacleForce.y * this.config.obstacleWeight;
        this.lastForces.obstacle = obstacleForce;

        // Limit total force
        const mag = Math.sqrt(forces.x * forces.x + forces.y * forces.y);
        if (mag > this.config.maxForce) {
            forces.x = (forces.x / mag) * this.config.maxForce;
            forces.y = (forces.y / mag) * this.config.maxForce;
        }

        return forces;
    }

    /**
     * Act phase - apply forces to physics body
     */
    act(forces) {
        if (!this.body) return;

        // Apply force to physics body
        Matter.Body.applyForce(this.body, this.body.position, {
            x: forces.x * 0.001, // Scale for Matter.js
            y: forces.y * 0.001
        });

        // Limit velocity
        const vel = this.body.velocity;
        const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
        if (speed > this.config.maxSpeed) {
            Matter.Body.setVelocity(this.body, {
                x: (vel.x / speed) * this.config.maxSpeed,
                y: (vel.y / speed) * this.config.maxSpeed
            });
        }

        // Update heading based on velocity
        if (speed > 0.1) {
            this.heading = Math.atan2(vel.y, vel.x);
        }

        // Sync position from physics
        this.position = { ...this.body.position };
        this.velocity = { ...this.body.velocity };

        // Check if goal reached
        if (this.goal) {
            const distToGoal = this._distance(this.position, this.goal);
            this.goalReached = distToGoal < 20;
        }
    }

    /**
     * Set goal position
     */
    setGoal(x, y) {
        this.goal = { x, y };
        this.goalReached = false;
        this.state = 'seeking';
    }

    /**
     * Get current position (from physics body if available)
     */
    getPosition() {
        if (this.body) {
            return { ...this.body.position };
        }
        return { ...this.position };
    }

    /**
     * Get state for serialization/display
     */
    getState() {
        return {
            id: this.id,
            position: this.getPosition(),
            velocity: this.velocity,
            heading: this.heading,
            goal: this.goal,
            goalReached: this.goalReached,
            state: this.state,
            sensedDrones: this.sensedDrones.length,
            sensedObstacles: this.sensedObstacles.length,
            neighbors: this.neighbors.length
        };
    }

    // ==================== Private helper methods ====================

    _computeSeparation() {
        const steer = { x: 0, y: 0 };
        let count = 0;
        const pos = this.getPosition();
        const desiredSeparation = this.config.radius * 4;

        for (const drone of this.sensedDrones) {
            if (drone.distance < desiredSeparation && drone.distance > 0) {
                const diff = {
                    x: pos.x - drone.position.x,
                    y: pos.y - drone.position.y
                };
                // Weight by distance (closer = stronger)
                const weight = 1 / drone.distance;
                steer.x += diff.x * weight;
                steer.y += diff.y * weight;
                count++;
            }
        }

        if (count > 0) {
            steer.x /= count;
            steer.y /= count;
        }

        return this._normalize(steer);
    }

    _computeCohesion() {
        const center = { x: 0, y: 0 };
        let count = 0;

        for (const drone of this.sensedDrones) {
            center.x += drone.position.x;
            center.y += drone.position.y;
            count++;
        }

        if (count > 0) {
            center.x /= count;
            center.y /= count;
            return this._steerToward(center);
        }

        return { x: 0, y: 0 };
    }

    _computeAlignment() {
        const avgVel = { x: 0, y: 0 };
        let count = 0;

        for (const drone of this.sensedDrones) {
            avgVel.x += drone.velocity.x;
            avgVel.y += drone.velocity.y;
            count++;
        }

        if (count > 0) {
            avgVel.x /= count;
            avgVel.y /= count;
            return this._normalize(avgVel);
        }

        return { x: 0, y: 0 };
    }

    _computeGoalForce() {
        if (!this.goal) return { x: 0, y: 0 };
        return this._steerToward(this.goal);
    }

    _computeObstacleAvoidance() {
        const steer = { x: 0, y: 0 };
        const pos = this.getPosition();

        for (const obs of this.sensedObstacles) {
            if (obs.distance > 0) {
                const diff = {
                    x: pos.x - obs.position.x,
                    y: pos.y - obs.position.y
                };
                // Stronger repulsion when closer
                const weight = Math.pow(1 - (obs.distance / this.config.senseRange), 2);
                const obsRadius = obs.radius || 50;
                const urgency = Math.max(0, 1 - (obs.distance - obsRadius) / this.config.senseRange);

                steer.x += diff.x * weight * urgency;
                steer.y += diff.y * weight * urgency;
            }
        }

        return this._normalize(steer);
    }

    _steerToward(target) {
        const pos = this.getPosition();
        const desired = {
            x: target.x - pos.x,
            y: target.y - pos.y
        };
        const dist = Math.sqrt(desired.x * desired.x + desired.y * desired.y);

        if (dist > 0) {
            // Arrive behavior - slow down when close
            let speed = this.config.maxSpeed;
            const slowRadius = 100;
            if (dist < slowRadius) {
                speed = this.config.maxSpeed * (dist / slowRadius);
            }

            desired.x = (desired.x / dist) * speed;
            desired.y = (desired.y / dist) * speed;

            return {
                x: desired.x - this.velocity.x,
                y: desired.y - this.velocity.y
            };
        }

        return { x: 0, y: 0 };
    }

    _normalize(vec) {
        const mag = Math.sqrt(vec.x * vec.x + vec.y * vec.y);
        if (mag > 0) {
            return { x: vec.x / mag, y: vec.y / mag };
        }
        return { x: 0, y: 0 };
    }

    _distance(a, b) {
        return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
    }

    _normalizeAngle(angle) {
        while (angle > Math.PI) angle -= 2 * Math.PI;
        while (angle < -Math.PI) angle += 2 * Math.PI;
        return angle;
    }
}
