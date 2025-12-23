/**
 * PhysicsWorld - Matter.js physics world for the simulation
 * 
 * Manages all physics bodies (drones and objects) and handles:
 * - Collision detection via hitboxes
 * - Force application for drone push/pull
 * - Path following for objects with physical constraints
 */

import Matter from 'matter-js';

// Collision categories
const CATEGORIES = {
    DRONE: 0x0001,
    OBJECT: 0x0002,
    OBSTACLE: 0x0004,
    BOUNDARY: 0x0008
};

export class PhysicsWorld {
    constructor(config = {}) {
        this.config = {
            width: config.width || 2000,
            height: config.height || 2000,
            gravity: config.gravity || { x: 0, y: 0 }, // Top-down view, no gravity
            ...config
        };

        // Create Matter.js engine and world
        this.engine = Matter.Engine.create({
            gravity: this.config.gravity
        });
        this.world = this.engine.world;

        // Body tracking
        this.droneBodies = new Map(); // id -> { body, config }
        this.objectBodies = new Map(); // id -> { body, config }

        // State
        this.running = false;
        this.showHitboxes = false;

        // Callbacks
        this.onUpdate = null;
        this.onCollision = null;

        // Create boundaries
        this._createBoundaries();

        // Set up collision events
        this._setupCollisionEvents();
    }

    /**
     * Create world boundaries
     */
    _createBoundaries() {
        const { width, height } = this.config;
        const t = 50; // thickness

        const walls = [
            Matter.Bodies.rectangle(width / 2, -t / 2, width + t * 2, t, { isStatic: true, label: 'boundary' }),
            Matter.Bodies.rectangle(width / 2, height + t / 2, width + t * 2, t, { isStatic: true, label: 'boundary' }),
            Matter.Bodies.rectangle(-t / 2, height / 2, t, height + t * 2, { isStatic: true, label: 'boundary' }),
            Matter.Bodies.rectangle(width + t / 2, height / 2, t, height + t * 2, { isStatic: true, label: 'boundary' })
        ];

        walls.forEach(w => {
            w.collisionFilter = {
                category: CATEGORIES.BOUNDARY,
                mask: CATEGORIES.DRONE | CATEGORIES.OBJECT
            };
        });

        Matter.Composite.add(this.world, walls);
    }

    /**
     * Set up collision event handlers
     */
    _setupCollisionEvents() {
        Matter.Events.on(this.engine, 'collisionStart', (event) => {
            if (!this.onCollision) return;

            for (const pair of event.pairs) {
                const { bodyA, bodyB } = pair;

                // Drone-Object collision (for pushing)
                if ((bodyA.label?.startsWith('drone_') && bodyB.label?.startsWith('object_')) ||
                    (bodyB.label?.startsWith('drone_') && bodyA.label?.startsWith('object_'))) {
                    const droneBody = bodyA.label?.startsWith('drone_') ? bodyA : bodyB;
                    const objectBody = bodyA.label?.startsWith('object_') ? bodyA : bodyB;

                    this.onCollision({
                        type: 'drone-object',
                        droneId: droneBody.entityId,
                        objectId: objectBody.entityId,
                        contactPoint: pair.collision.supports[0]
                    });
                }
            }
        });
    }

    /**
     * Add a drone body (circle hitbox)
     */
    addDrone(id, position, config = {}) {
        const radius = config.radius || 15;
        const strength = config.strength || 0.01; // Force magnitude

        const body = Matter.Bodies.circle(position.x, position.y, radius, {
            label: `drone_${id}`,
            frictionAir: 0.1,
            friction: 0.5,
            restitution: 0.2,
            density: 0.002,
            collisionFilter: {
                category: CATEGORIES.DRONE,
                mask: CATEGORIES.OBJECT | CATEGORIES.OBSTACLE | CATEGORIES.BOUNDARY | CATEGORIES.DRONE
            }
        });

        body.entityId = id;
        body.entityType = 'drone';

        Matter.Composite.add(this.world, body);

        this.droneBodies.set(id, {
            body,
            config: { radius, strength, ...config },
            targetPosition: null,
            isPushing: false
        });

        return body;
    }

    /**
     * Add an object body (rectangle or circle based on type)
     */
    addObject(id, type, position, size, config = {}) {
        let body;
        const mass = config.mass || 5;

        if (type === 'circle') {
            const radius = size.radius || Math.max(size.width, size.height) / 2 || 50;
            body = Matter.Bodies.circle(position.x, position.y, radius, {
                label: `object_${id}`,
                frictionAir: 0.05,
                friction: 0.8,
                restitution: 0.1,
                density: mass / (Math.PI * radius * radius)
            });
        } else {
            // Rectangle or custom shape - use rectangle hitbox
            const w = size.width || 100;
            const h = size.height || 100;
            body = Matter.Bodies.rectangle(position.x, position.y, w, h, {
                label: `object_${id}`,
                frictionAir: 0.05,
                friction: 0.8,
                restitution: 0.1,
                density: mass / (w * h),
                angle: (position.rotation || 0) * Math.PI / 180
            });
        }

        body.entityId = id;
        body.entityType = 'object';
        body.collisionFilter = {
            category: CATEGORIES.OBJECT,
            mask: CATEGORIES.DRONE | CATEGORIES.OBSTACLE | CATEGORIES.BOUNDARY | CATEGORIES.OBJECT
        };

        Matter.Composite.add(this.world, body);

        this.objectBodies.set(id, {
            body,
            config: { type, size, mass, ...config },
            targetPosition: null,
            pathProgress: 0
        });

        return body;
    }

    /**
     * Add a static obstacle
     */
    addObstacle(id, type, position, size) {
        let body;

        if (type === 'circle') {
            const radius = size.radius || 50;
            body = Matter.Bodies.circle(position.x, position.y, radius, {
                isStatic: true,
                label: `obstacle_${id}`
            });
        } else {
            const w = size.width || 100;
            const h = size.height || 100;
            body = Matter.Bodies.rectangle(position.x, position.y, w, h, {
                isStatic: true,
                label: `obstacle_${id}`,
                angle: (position.rotation || 0) * Math.PI / 180
            });
        }

        body.entityId = id;
        body.entityType = 'obstacle';
        body.collisionFilter = {
            category: CATEGORIES.OBSTACLE,
            mask: CATEGORIES.DRONE | CATEGORIES.OBJECT
        };

        Matter.Composite.add(this.world, body);
        return body;
    }

    /**
     * Remove a body by id
     */
    removeBody(id) {
        if (this.droneBodies.has(id)) {
            Matter.Composite.remove(this.world, this.droneBodies.get(id).body);
            this.droneBodies.delete(id);
        }
        if (this.objectBodies.has(id)) {
            Matter.Composite.remove(this.world, this.objectBodies.get(id).body);
            this.objectBodies.delete(id);
        }
    }

    /**
     * Set target position for a drone
     */
    setDroneTarget(id, target) {
        const drone = this.droneBodies.get(id);
        if (drone) {
            drone.targetPosition = target;
        }
    }

    /**
     * Set target position for an object (path following)
     */
    setObjectTarget(id, target) {
        const obj = this.objectBodies.get(id);
        if (obj) {
            obj.targetPosition = target;
        }
    }

    /**
     * Main simulation tick
     */
    tick(deltaTime) {
        // Update drone forces - move toward targets or push objects
        for (const [id, drone] of this.droneBodies) {
            this._updateDrone(drone, deltaTime);
        }

        // Step physics
        Matter.Engine.update(this.engine, deltaTime);

        // Emit update
        if (this.onUpdate) {
            this.onUpdate(this.getState());
        }
    }

    /**
     * Update a single drone - move toward target and push objects
     */
    _updateDrone(drone, deltaTime) {
        const { body, config, targetPosition } = drone;

        if (!targetPosition) return;

        const pos = body.position;
        const dx = targetPosition.x - pos.x;
        const dy = targetPosition.y - pos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 5) {
            // Close enough, stop
            Matter.Body.setVelocity(body, { x: 0, y: 0 });
            return;
        }

        // Calculate force direction
        const fx = (dx / distance) * config.strength;
        const fy = (dy / distance) * config.strength;

        // Apply force to move toward target
        Matter.Body.applyForce(body, pos, { x: fx, y: fy });

        // Limit velocity
        const maxSpeed = 3;
        const vel = body.velocity;
        const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
        if (speed > maxSpeed) {
            Matter.Body.setVelocity(body, {
                x: (vel.x / speed) * maxSpeed,
                y: (vel.y / speed) * maxSpeed
            });
        }
    }

    /**
     * Start simulation loop
     */
    start() {
        if (this.running) return;
        this.running = true;

        let lastTime = performance.now();

        const loop = () => {
            if (!this.running) return;

            const now = performance.now();
            const delta = now - lastTime;
            lastTime = now;

            this.tick(delta);

            requestAnimationFrame(loop);
        };

        requestAnimationFrame(loop);
    }

    /**
     * Stop simulation
     */
    stop() {
        this.running = false;
    }

    /**
     * Get current state of all bodies for rendering
     */
    getState() {
        const state = {
            drones: {},
            objects: {}
        };

        for (const [id, drone] of this.droneBodies) {
            const { body, config } = drone;
            state.drones[id] = {
                x: body.position.x,
                y: body.position.y,
                rotation: body.angle * 180 / Math.PI,
                radius: config.radius,
                velocity: body.velocity
            };
        }

        for (const [id, obj] of this.objectBodies) {
            const { body, config } = obj;
            state.objects[id] = {
                x: body.position.x,
                y: body.position.y,
                rotation: body.angle * 180 / Math.PI,
                width: config.size?.width,
                height: config.size?.height,
                radius: config.size?.radius,
                velocity: body.velocity
            };
        }

        return state;
    }

    /**
     * Get hitbox data for visualization
     */
    getHitboxes() {
        const hitboxes = [];

        for (const [id, drone] of this.droneBodies) {
            const { body, config } = drone;
            hitboxes.push({
                id,
                type: 'circle',
                x: body.position.x,
                y: body.position.y,
                radius: config.radius,
                entityType: 'drone'
            });
        }

        for (const [id, obj] of this.objectBodies) {
            const { body, config } = obj;
            if (config.type === 'circle') {
                hitboxes.push({
                    id,
                    type: 'circle',
                    x: body.position.x,
                    y: body.position.y,
                    radius: config.size?.radius || 50,
                    rotation: body.angle * 180 / Math.PI,
                    entityType: 'object'
                });
            } else {
                hitboxes.push({
                    id,
                    type: 'rectangle',
                    x: body.position.x,
                    y: body.position.y,
                    width: config.size?.width || 100,
                    height: config.size?.height || 100,
                    rotation: body.angle * 180 / Math.PI,
                    entityType: 'object'
                });
            }
        }

        return hitboxes;
    }

    /**
     * Sync from items array
     */
    syncFromItems(items, currentStateId) {
        // Clear existing bodies
        for (const id of this.droneBodies.keys()) {
            this.removeBody(id);
        }
        for (const id of this.objectBodies.keys()) {
            this.removeBody(id);
        }

        // Add bodies from items
        for (const item of items) {
            const pos = item.statePositions?.[currentStateId];
            if (!pos) continue;

            if (item.type === 'drone') {
                this.addDrone(item.id, pos, {
                    radius: 15,
                    strength: item.strength || 0.01
                });
            } else if (item.isObstacle) {
                this.addObstacle(item.id, item.type, pos, {
                    width: item.w,
                    height: item.h,
                    radius: item.radius || (item.w ? item.w / 2 : 50)
                });
            } else {
                // Regular object that can be pushed
                this.addObject(item.id, item.type, pos, {
                    width: item.w,
                    height: item.h,
                    radius: item.radius || (item.w ? item.w / 2 : 50)
                }, {
                    mass: item.mass || 5
                });
            }
        }
    }

    /**
     * Clean up
     */
    destroy() {
        this.stop();
        Matter.World.clear(this.world);
        Matter.Engine.clear(this.engine);
    }
}
