/**
 * AgentManager - Manages all drone agents and the physics simulation
 * 
 * Responsibilities:
 * - Creates and manages Matter.js physics world
 * - Runs the simulation loop (sense → think → act)
 * - Handles collision detection
 * - Routes inter-agent communication
 */

import Matter from 'matter-js';
import { DroneAgent } from './DroneAgent';

export class AgentManager {
    constructor(config = {}) {
        this.config = {
            tickRate: 60,           // Updates per second
            gravity: { x: 0, y: 0 }, // No gravity for top-down view
            worldBounds: { width: 2000, height: 2000 },
            ...config
        };

        // Matter.js engine and world
        this.engine = Matter.Engine.create({
            gravity: this.config.gravity
        });
        this.world = this.engine.world;

        // Create world boundaries
        this._createBoundaries();

        // Agent management
        this.agents = new Map(); // id -> DroneAgent
        this.obstacles = [];     // Physics bodies for obstacles

        // Simulation state
        this.running = false;
        this.tickInterval = null;
        this.lastTickTime = 0;

        // Callbacks
        this.onUpdate = null;     // Called after each tick with agent states
        this.onCollision = null;  // Called on collision events

        // Set up collision events
        this._setupCollisionEvents();
    }

    /**
     * Create world boundaries
     */
    _createBoundaries() {
        const { width, height } = this.config.worldBounds;
        const thickness = 50;

        const walls = [
            // Top
            Matter.Bodies.rectangle(width / 2, -thickness / 2, width + thickness * 2, thickness, { isStatic: true }),
            // Bottom
            Matter.Bodies.rectangle(width / 2, height + thickness / 2, width + thickness * 2, thickness, { isStatic: true }),
            // Left
            Matter.Bodies.rectangle(-thickness / 2, height / 2, thickness, height + thickness * 2, { isStatic: true }),
            // Right
            Matter.Bodies.rectangle(width + thickness / 2, height / 2, thickness, height + thickness * 2, { isStatic: true })
        ];

        walls.forEach(wall => {
            wall.label = 'boundary';
            wall.collisionFilter = {
                category: 0x0001,
                mask: 0x0002
            };
        });

        Matter.Composite.add(this.world, walls);
    }

    /**
     * Set up collision event handlers
     */
    _setupCollisionEvents() {
        Matter.Events.on(this.engine, 'collisionStart', (event) => {
            for (const pair of event.pairs) {
                const { bodyA, bodyB } = pair;

                // Drone-Drone collision
                if (bodyA.agentId && bodyB.agentId) {
                    if (this.onCollision) {
                        this.onCollision({
                            type: 'drone-drone',
                            agentA: bodyA.agentId,
                            agentB: bodyB.agentId
                        });
                    }
                }

                // Drone-Obstacle collision
                if ((bodyA.agentId && bodyB.label?.startsWith('obstacle')) ||
                    (bodyB.agentId && bodyA.label?.startsWith('obstacle'))) {
                    const agentId = bodyA.agentId || bodyB.agentId;
                    const obstacle = bodyA.agentId ? bodyB : bodyA;
                    if (this.onCollision) {
                        this.onCollision({
                            type: 'drone-obstacle',
                            agentId,
                            obstacleId: obstacle.obstacleId
                        });
                    }
                }
            }
        });
    }

    /**
     * Add a drone agent
     */
    addAgent(id, position, config = {}) {
        const agent = new DroneAgent(id, position, config);
        const body = agent.createBody(position.x, position.y);
        Matter.Composite.add(this.world, body);
        this.agents.set(id, agent);
        return agent;
    }

    /**
     * Remove a drone agent
     */
    removeAgent(id) {
        const agent = this.agents.get(id);
        if (agent && agent.body) {
            Matter.Composite.remove(this.world, agent.body);
        }
        this.agents.delete(id);
    }

    /**
     * Add an obstacle to the physics world
     */
    addObstacle(id, type, position, size) {
        let body;

        if (type === 'circle') {
            body = Matter.Bodies.circle(position.x, position.y, size.radius || 50, {
                isStatic: true,
                label: `obstacle_${id}`,
                collisionFilter: {
                    category: 0x0001,
                    mask: 0x0002
                }
            });
        } else {
            // Rectangle or custom - use rectangle
            body = Matter.Bodies.rectangle(
                position.x, position.y,
                size.width || 100, size.height || 100,
                {
                    isStatic: true,
                    label: `obstacle_${id}`,
                    collisionFilter: {
                        category: 0x0001,
                        mask: 0x0002
                    }
                }
            );
        }

        body.obstacleId = id;
        Matter.Composite.add(this.world, body);

        this.obstacles.push({
            id,
            body,
            position: { ...position },
            radius: size.radius || Math.max(size.width || 100, size.height || 100) / 2
        });

        return body;
    }

    /**
     * Remove an obstacle
     */
    removeObstacle(id) {
        const index = this.obstacles.findIndex(o => o.id === id);
        if (index >= 0) {
            Matter.Composite.remove(this.world, this.obstacles[index].body);
            this.obstacles.splice(index, 1);
        }
    }

    /**
     * Update obstacle position
     */
    updateObstacle(id, position) {
        const obstacle = this.obstacles.find(o => o.id === id);
        if (obstacle) {
            Matter.Body.setPosition(obstacle.body, position);
            obstacle.position = { ...position };
        }
    }

    /**
     * Set goal for a specific agent
     */
    setAgentGoal(id, goal) {
        const agent = this.agents.get(id);
        if (agent) {
            agent.setGoal(goal.x, goal.y);
        }
    }

    /**
     * Set goals for all agents
     */
    setAllGoals(goals) {
        for (const [id, goal] of Object.entries(goals)) {
            this.setAgentGoal(id, goal);
        }
    }

    /**
     * Main simulation tick
     */
    tick(deltaTime) {
        const allDrones = Array.from(this.agents.values());

        // Phase 1: Sense
        for (const agent of allDrones) {
            agent.sense(allDrones, this.obstacles);
        }

        // Phase 2: Communicate
        for (const agent of allDrones) {
            agent.communicate();
        }

        // Phase 3: Think
        const forces = new Map();
        for (const agent of allDrones) {
            forces.set(agent.id, agent.think());
        }

        // Phase 4: Act
        for (const agent of allDrones) {
            agent.act(forces.get(agent.id));
        }

        // Phase 5: Physics update
        Matter.Engine.update(this.engine, deltaTime);

        // Emit update event
        if (this.onUpdate) {
            this.onUpdate(this.getAgentStates());
        }
    }

    /**
     * Start the simulation loop
     */
    start() {
        if (this.running) return;

        this.running = true;
        this.lastTickTime = performance.now();

        const loop = () => {
            if (!this.running) return;

            const now = performance.now();
            const deltaTime = now - this.lastTickTime;
            this.lastTickTime = now;

            this.tick(deltaTime);

            requestAnimationFrame(loop);
        };

        requestAnimationFrame(loop);
    }

    /**
     * Stop the simulation loop
     */
    stop() {
        this.running = false;
    }

    /**
     * Step the simulation by one tick (for debugging)
     */
    step() {
        this.tick(1000 / this.config.tickRate);
    }

    /**
     * Get all agent states for rendering
     */
    getAgentStates() {
        const states = {};
        for (const [id, agent] of this.agents) {
            states[id] = agent.getState();
        }
        return states;
    }

    /**
     * Get a specific agent
     */
    getAgent(id) {
        return this.agents.get(id);
    }

    /**
     * Check if all agents have reached their goals
     */
    allGoalsReached() {
        for (const agent of this.agents.values()) {
            if (agent.goal && !agent.goalReached) {
                return false;
            }
        }
        return true;
    }

    /**
     * Sync agents from existing items (for integration with current system)
     */
    syncFromItems(items, currentStateId) {
        // Clear existing agents
        for (const id of this.agents.keys()) {
            this.removeAgent(id);
        }
        this.obstacles = [];

        // Add drones as agents
        const drones = items.filter(item => item.type === 'drone');
        for (const drone of drones) {
            const pos = drone.statePositions?.[currentStateId] || { x: 0, y: 0 };
            this.addAgent(drone.id, pos, {
                senseRange: drone.senseRange || 150,
                commRange: drone.commRange || 200
            });
        }

        // Add obstacles
        const obstacleItems = items.filter(item =>
            item.type !== 'drone' && item.isObstacle
        );
        for (const obs of obstacleItems) {
            const pos = obs.statePositions?.[currentStateId] || { x: 0, y: 0 };
            this.addObstacle(obs.id, obs.type, pos, {
                radius: obs.radius || (obs.w ? obs.w / 2 : 50),
                width: obs.w || 100,
                height: obs.h || 100
            });
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
