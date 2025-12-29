/**
 * DroneAgent - Main agent class for programmable drones
 * Provides sensors, communication, and motor control APIs
 */

import Matter from 'matter-js';
import { messageBus } from './MessageBus.js';
import SensorSystem from './SensorSystem.js';

class DroneAgent {
    constructor(body, engine, options = {}) {
        this.body = body;
        this.engine = engine;
        this.id = body.id;
        this.sensorSystem = new SensorSystem(engine);

        // Agent properties
        this.team = options.team || 'default';
        this.role = options.role || 'worker';
        this.sensorRadius = options.sensorRadius || 200;
        this.maxForce = options.maxForce || 0.005;
        this.maxSpeed = options.maxSpeed || 5;

        // PID controller state for velocity control
        this.pidState = {
            integralX: 0,
            integralY: 0,
            lastErrorX: 0,
            lastErrorY: 0
        };
        this.pidGains = {
            kP: 0.01,
            kI: 0.0001,
            kD: 0.005
        };

        // Message handlers
        this.messageHandlers = [];

        // Custom behavior function
        this.behaviorFunction = null;

        // State for behavior
        this.state = {};

        // Register with message bus
        messageBus.subscribe(
            this.id.toString(),
            (msg) => this._handleMessage(msg),
            () => this.getPosition()
        );
    }

    // ==================== PERCEPTION API ====================

    /**
     * Sense the environment around the drone
     * @param {number} radius - Optional override for sensor radius
     * @returns {Object} { objects, drones, walls, target }
     */
    sense(radius = null) {
        return this.sensorSystem.sense(
            this.getPosition(),
            radius || this.sensorRadius,
            this.id
        );
    }

    /**
     * Get current position
     * @returns {Object} {x, y}
     */
    getPosition() {
        return { x: this.body.position.x, y: this.body.position.y };
    }

    /**
     * Get current velocity
     * @returns {Object} {x, y}
     */
    getVelocity() {
        return { x: this.body.velocity.x, y: this.body.velocity.y };
    }

    /**
     * Get current angle in radians
     * @returns {number}
     */
    getAngle() {
        return this.body.angle;
    }

    /**
     * Cast a ray from the drone
     * @param {number} angle - Direction in radians
     * @param {number} maxDistance - Maximum ray length
     * @returns {Object|null} Hit information or null
     */
    raycast(angle, maxDistance = 500) {
        const direction = { x: Math.cos(angle), y: Math.sin(angle) };
        return this.sensorSystem.raycast(
            this.getPosition(),
            direction,
            maxDistance,
            this.id
        );
    }

    /**
     * Check if there's a clear path to a target position
     * @param {Object} target - {x, y} target position
     * @returns {boolean}
     */
    canSee(target) {
        return this.sensorSystem.isPathClear(this.getPosition(), target, this.id);
    }

    // ==================== COMMUNICATION API ====================

    /**
     * Broadcast a message to all drones within range
     * @param {Object} message - Message payload
     */
    broadcast(message) {
        messageBus.broadcast(this.id.toString(), message, this.getPosition());
    }

    /**
     * Send a direct message to a specific drone
     * @param {string|number} droneId - Target drone ID
     * @param {Object} message - Message payload
     * @returns {boolean} True if message was delivered
     */
    send(droneId, message) {
        return messageBus.send(
            this.id.toString(),
            droneId.toString(),
            message,
            this.getPosition()
        );
    }

    /**
     * Register a message handler
     * @param {Function} callback - Function to call when message received
     */
    onMessage(callback) {
        this.messageHandlers.push(callback);
    }

    /**
     * Get list of drones within communication range
     * @returns {Array} List of drone IDs
     */
    getDronesInRange() {
        return messageBus.getDronesInRange(this.getPosition())
            .filter(id => id !== this.id.toString());
    }

    // ==================== ACTION API ====================

    /**
     * Apply a force to the drone
     * @param {number} fx - Force X component
     * @param {number} fy - Force Y component
     */
    applyForce(fx, fy) {
        // Clamp force magnitude
        const mag = Math.sqrt(fx * fx + fy * fy);
        if (mag > this.maxForce) {
            const scale = this.maxForce / mag;
            fx *= scale;
            fy *= scale;
        }

        Matter.Body.applyForce(this.body, this.body.position, { x: fx, y: fy });
    }

    /**
     * Set a target velocity using PID control
     * @param {number} vx - Desired velocity X
     * @param {number} vy - Desired velocity Y
     */
    setDesiredVelocity(vx, vy) {
        // Clamp desired velocity
        const mag = Math.sqrt(vx * vx + vy * vy);
        if (mag > this.maxSpeed) {
            const scale = this.maxSpeed / mag;
            vx *= scale;
            vy *= scale;
        }

        const currentVel = this.getVelocity();
        const errorX = vx - currentVel.x;
        const errorY = vy - currentVel.y;

        // PID control
        const { kP, kI, kD } = this.pidGains;

        this.pidState.integralX += errorX;
        this.pidState.integralY += errorY;

        const derivativeX = errorX - this.pidState.lastErrorX;
        const derivativeY = errorY - this.pidState.lastErrorY;

        const fx = kP * errorX + kI * this.pidState.integralX + kD * derivativeX;
        const fy = kP * errorY + kI * this.pidState.integralY + kD * derivativeY;

        this.pidState.lastErrorX = errorX;
        this.pidState.lastErrorY = errorY;

        this.applyForce(fx, fy);
    }

    /**
     * Move toward a target position
     * @param {Object} target - {x, y} target position
     * @param {number} speed - Movement speed multiplier
     */
    moveToward(target, speed = 1) {
        const pos = this.getPosition();
        const dx = target.x - pos.x;
        const dy = target.y - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 1) return; // Close enough

        const vx = (dx / dist) * speed * this.maxSpeed;
        const vy = (dy / dist) * speed * this.maxSpeed;

        this.setDesiredVelocity(vx, vy);
    }

    /**
     * Stop the drone (set desired velocity to zero)
     */
    stop() {
        this.setDesiredVelocity(0, 0);
    }

    // ==================== BEHAVIOR API ====================

    /**
     * Set the behavior function for this drone
     * @param {Function} fn - Behavior function (drone, deltaTime) => void
     */
    setBehavior(fn) {
        this.behaviorFunction = fn;
    }

    /**
     * Execute the behavior function (called each tick)
     * @param {number} deltaTime - Time since last tick in ms
     */
    update(deltaTime) {
        if (this.behaviorFunction) {
            try {
                this.behaviorFunction(this, deltaTime);
            } catch (e) {
                console.error(`Drone ${this.id} behavior error:`, e);
            }
        }
    }

    // ==================== INTERNAL ====================

    _handleMessage(message) {
        this.messageHandlers.forEach(handler => {
            try {
                handler(message);
            } catch (e) {
                console.error(`Drone ${this.id} message handler error:`, e);
            }
        });
    }

    /**
     * Clean up when drone is destroyed
     */
    destroy() {
        messageBus.unsubscribe(this.id.toString());
    }
}

export default DroneAgent;
