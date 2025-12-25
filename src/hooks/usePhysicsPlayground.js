/**
 * usePhysicsPlayground - React hook for 2D physics playground
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import Matter from 'matter-js';
import decomp from 'poly-decomp';


Matter.Common.setDecomp(decomp);

export function usePhysicsPlayground(canvasRef, containerRef) {
    const engineRef = useRef(null);
    const renderRef = useRef(null);
    const runnerRef = useRef(null);
    const mouseConstraintRef = useRef(null);

    const [objects, setObjects] = useState([]);
    const [gravity, setGravity] = useState({ x: 0, y: 0 });
    const [isInitialized, setIsInitialized] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [selectedBodyId, setSelectedBodyId] = useState(null);
    const [selectedBodyIds, setSelectedBodyIds] = useState(new Set()); // Multi-select
    const [showGrid, setShowGrid] = useState(false); // Toggleable grid
    const [mouseStiffness, setMouseStiffnessState] = useState(0.05); // Mouse constraint stiffness

    // History state for undo/redo
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const historyRef = useRef([]);
    const historyIndexRef = useRef(-1);
    const MAX_HISTORY = 50;


    const [renderOptions, setRenderOptions] = useState({
        wireframes: true,
        showDebug: false,
        showPositions: false,
        showBroadphase: false,
        showBounds: false,
        showVelocity: false,
        showCollisions: false,
        showSeparations: false,
        showAxes: false,
        showAngleIndicator: true,
        showSleeping: false,
        showIds: false,
        showVertexNumbers: false,
        showConvexHulls: false,
        showInternalEdges: false
    });

    // Default body options (like Matter.js demo)
    const [bodyDefaults, setBodyDefaults] = useState({
        amount: 1,
        size: 40,
        sides: 4,
        density: 0.001,
        friction: 0.1,
        frictionStatic: 0.5,
        frictionAir: 0.01,
        restitution: 0,
        chamfer: 0,
        isStatic: false
    });

    // Drones with injectable behavior
    const [drones, setDrones] = useState([]);
    const dronesRef = useRef([]);

    // Keep dronesRef in sync with drones state
    useEffect(() => {
        dronesRef.current = drones;
    }, [drones]);

    // Built-in behavior templates
    const BEHAVIOR_TEMPLATES = {
        wander: `// Wander randomly
const angle = Math.random() * Math.PI * 2;
const force = 0.0005;
this.applyForce(Math.cos(angle) * force, Math.sin(angle) * force);`,

        seekNearest: `// Seek nearest object
if (this.nearbyBodies.length > 0) {
    const nearest = this.nearbyBodies[0];
    const dx = nearest.position.x - this.position.x;
    const dy = nearest.position.y - this.position.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > 10) {
        this.applyForce(dx/dist * 0.001, dy/dist * 0.001);
    }
}`,

        avoidAll: `// Avoid all nearby objects
this.nearbyBodies.forEach(body => {
    const dx = this.position.x - body.position.x;
    const dy = this.position.y - body.position.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 100 && dist > 0) {
        this.applyForce(dx/dist * 0.0005, dy/dist * 0.0005);
    }
});`,

        followMouse: `// Follow mouse position (if available)
if (this.mousePosition) {
    const dx = this.mousePosition.x - this.position.x;
    const dy = this.mousePosition.y - this.position.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > 20) {
        this.applyForce(dx/dist * 0.001, dy/dist * 0.001);
    }
}`,

        swarm: `// Swarm behavior (separation + cohesion)
let sepX = 0, sepY = 0, cohX = 0, cohY = 0, count = 0;
this.allDrones.forEach(other => {
    if (other.id !== this.id) {
        const dx = this.position.x - other.position.x;
        const dy = this.position.y - other.position.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 50 && dist > 0) {
            sepX += dx/dist; sepY += dy/dist;
        }
        cohX += other.position.x; cohY += other.position.y; count++;
    }
});
if (count > 0) {
    cohX = cohX/count - this.position.x;
    cohY = cohY/count - this.position.y;
}
this.applyForce(sepX * 0.0003 + cohX * 0.00005, sepY * 0.0003 + cohY * 0.00005);`
    };

    // Initialize physics engine
    useEffect(() => {
        const container = containerRef?.current;
        if (!container) return;

        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;

        if (width < 100 || height < 100) return;

        // Create engine
        const engine = Matter.Engine.create({
            gravity: { x: gravity.x, y: gravity.y }
        });

        // Create renderer with debug options
        const render = Matter.Render.create({
            element: container,
            engine: engine,
            options: {
                width: width,
                height: height,
                wireframes: renderOptions.wireframes,
                background: '#14151f',
                pixelRatio: 1,
                showDebug: renderOptions.showDebug,
                showPositions: renderOptions.showPositions,
                showBroadphase: renderOptions.showBroadphase,
                showBounds: renderOptions.showBounds,
                showVelocity: renderOptions.showVelocity,
                showCollisions: renderOptions.showCollisions,
                showSeparations: renderOptions.showSeparations,
                showAxes: renderOptions.showAxes,
                showAngleIndicator: renderOptions.showAngleIndicator,
                showSleeping: renderOptions.showSleeping,
                showIds: renderOptions.showIds,
                showVertexNumbers: renderOptions.showVertexNumbers,
                showConvexHulls: renderOptions.showConvexHulls,
                showInternalEdges: renderOptions.showInternalEdges
            }
        });

        // Create walls
        const wallThickness = 50;
        const wallOptions = {
            isStatic: true,
            render: {
                fillStyle: '#1a1b26',
                strokeStyle: '#3d3d5c',
                lineWidth: 1
            }
        };

        const walls = [
            Matter.Bodies.rectangle(width / 2, -wallThickness / 2, width + wallThickness * 2, wallThickness, wallOptions),
            Matter.Bodies.rectangle(width / 2, height + wallThickness / 2, width + wallThickness * 2, wallThickness, wallOptions),
            Matter.Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height + wallThickness * 2, wallOptions),
            Matter.Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height + wallThickness * 2, wallOptions)
        ];
        Matter.Composite.add(engine.world, walls);

        // Create mouse constraint for dragging
        // Lower stiffness allows torque-based rotation when grabbing objects at the edge
        const mouse = Matter.Mouse.create(render.canvas);
        const mouseConstraint = Matter.MouseConstraint.create(engine, {
            mouse: mouse,
            constraint: {
                stiffness: 0.05,  // Lower stiffness allows more natural movement and rotation
                damping: 0.1,    // Add some damping to prevent wild oscillations
                angularStiffness: 0,  // Allow free rotation based on grab point offset
                render: {
                    visible: true,
                    strokeStyle: '#22c55e',
                    lineWidth: 2
                }
            }
        });
        Matter.Composite.add(engine.world, mouseConstraint);
        render.mouse = mouse;

        // Listen for clicks on bodies to select them
        Matter.Events.on(mouseConstraint, 'mousedown', (event) => {
            const body = event.source.body;
            if (body && !body.isStatic) {
                // Will be handled by the selectBodyOnClick callback
                if (window._physicsPlaygroundSelectBody) {
                    window._physicsPlaygroundSelectBody(body.id);
                }
            }
        });

        // Keep body selected when drag starts
        Matter.Events.on(mouseConstraint, 'startdrag', (event) => {
            const body = event.body;
            if (body && !body.isStatic) {
                if (window._physicsPlaygroundSelectBody) {
                    window._physicsPlaygroundSelectBody(body.id);
                }
            }
        });

        // Keep body selected after drag ends (when thrown)
        Matter.Events.on(mouseConstraint, 'enddrag', (event) => {
            const body = event.body;
            if (body && !body.isStatic) {
                // Keep it selected after release
                if (window._physicsPlaygroundSelectBody) {
                    window._physicsPlaygroundSelectBody(body.id);
                }
            }
        });

        // Limit velocity to prevent objects from escaping
        const maxVelocity = 25;
        Matter.Events.on(engine, 'afterUpdate', () => {
            const bodies = Matter.Composite.allBodies(engine.world);
            bodies.forEach(body => {
                if (!body.isStatic) {
                    // Limit velocity
                    const velocity = body.velocity;
                    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
                    if (speed > maxVelocity) {
                        const scale = maxVelocity / speed;
                        Matter.Body.setVelocity(body, {
                            x: velocity.x * scale,
                            y: velocity.y * scale
                        });
                    }

                    // Keep bodies within bounds
                    const pos = body.position;
                    if (pos.x < 0) Matter.Body.setPosition(body, { x: 50, y: pos.y });
                    if (pos.x > width) Matter.Body.setPosition(body, { x: width - 50, y: pos.y });
                    if (pos.y < 0) Matter.Body.setPosition(body, { x: pos.x, y: 50 });
                    if (pos.y > height) Matter.Body.setPosition(body, { x: pos.x, y: height - 50 });
                }
            });
        });

        // Run drone behaviors each tick
        Matter.Events.on(engine, 'beforeUpdate', () => {
            const currentDrones = dronesRef.current;
            if (currentDrones.length === 0) return;

            const allBodies = Matter.Composite.allBodies(engine.world);
            const nonDroneBodies = allBodies.filter(b => !b.isStatic && !b.isDrone);
            const mousePos = render.mouse?.position;

            currentDrones.forEach(drone => {
                if (!drone.body || !drone.behaviorCode) return;

                // Create API context for behavior code
                const context = {
                    id: drone.body.id,
                    position: { x: drone.body.position.x, y: drone.body.position.y },
                    velocity: { x: drone.body.velocity.x, y: drone.body.velocity.y },
                    angle: drone.body.angle,
                    nearbyBodies: nonDroneBodies
                        .filter(b => {
                            const dx = b.position.x - drone.body.position.x;
                            const dy = b.position.y - drone.body.position.y;
                            return Math.sqrt(dx * dx + dy * dy) < 200;
                        })
                        .sort((a, b) => {
                            const da = Math.hypot(a.position.x - drone.body.position.x, a.position.y - drone.body.position.y);
                            const db = Math.hypot(b.position.x - drone.body.position.x, b.position.y - drone.body.position.y);
                            return da - db;
                        }),
                    allDrones: currentDrones.map(d => ({
                        id: d.body.id,
                        position: { x: d.body.position.x, y: d.body.position.y },
                        velocity: { x: d.body.velocity.x, y: d.body.velocity.y }
                    })),
                    mousePosition: mousePos ? { x: mousePos.x, y: mousePos.y } : null,

                    applyForce: (fx, fy) => {
                        Matter.Body.applyForce(drone.body, drone.body.position, { x: fx, y: fy });
                    },
                    setVelocity: (vx, vy) => {
                        Matter.Body.setVelocity(drone.body, { x: vx, y: vy });
                    },
                    distanceTo: (other) => {
                        if (!other?.position) return Infinity;
                        const dx = other.position.x - drone.body.position.x;
                        const dy = other.position.y - drone.body.position.y;
                        return Math.sqrt(dx * dx + dy * dy);
                    }
                };

                // Execute behavior code
                try {
                    const behaviorFn = new Function(drone.behaviorCode);
                    behaviorFn.call(context);
                } catch (e) {
                    // Silently ignore behavior errors to avoid spam
                }
            });
        });

        // Store refs
        engineRef.current = engine;
        renderRef.current = render;
        mouseConstraintRef.current = mouseConstraint;

        // Run engine and renderer
        const runner = Matter.Runner.create();
        Matter.Runner.run(runner, engine);
        Matter.Render.run(render);
        runnerRef.current = runner;

        setIsInitialized(true);

        // Cleanup
        return () => {
            Matter.Events.off(engine);
            Matter.Render.stop(render);
            Matter.Runner.stop(runner);
            Matter.World.clear(engine.world);
            Matter.Engine.clear(engine);
            render.canvas?.remove();
            render.textures = {};
            setIsInitialized(false);
        };
    }, []);

    // Update render options when they change
    useEffect(() => {
        if (renderRef.current) {
            Object.assign(renderRef.current.options, renderOptions);
        }
    }, [renderOptions]);

    // Update gravity
    useEffect(() => {
        if (engineRef.current) {
            engineRef.current.gravity.x = gravity.x;
            engineRef.current.gravity.y = gravity.y;
        }
    }, [gravity]);

    // Register selectBody callback for Matter.js mouse events
    useEffect(() => {
        window._physicsPlaygroundSelectBody = (id) => {
            setSelectedBodyId(prevId => prevId === id ? null : id);

            // Update body highlighting
            if (engineRef.current) {
                const bodies = Matter.Composite.allBodies(engineRef.current.world);
                bodies.forEach(body => {
                    if (!body.isStatic) {
                        if (body.id === id) {
                            body.render.lineWidth = 4;
                            body.render.strokeStyle = '#ff0';
                        } else {
                            body.render.lineWidth = 2;
                        }
                    }
                });
            }
        };

        return () => {
            delete window._physicsPlaygroundSelectBody;
        };
    }, []);

    // Update a single render option
    const setRenderOption = useCallback((key, value) => {
        setRenderOptions(prev => ({ ...prev, [key]: value }));
    }, []);

    // Update body defaults
    const setBodyDefault = useCallback((key, value) => {
        setBodyDefaults(prev => ({ ...prev, [key]: value }));
    }, []);

    // Add object function
    const addObject = useCallback((type, x, y, options = {}) => {
        if (!engineRef.current) return null;

        const colors = ['#e06c75', '#e5c07b', '#98c379', '#56b6c2', '#61afef', '#c678dd'];
        const color = options.color || colors[Math.floor(Math.random() * colors.length)];

        // Merge with body defaults
        const opts = { ...bodyDefaults, ...options };

        const bodyOptions = {
            density: opts.density,
            friction: opts.friction,
            frictionStatic: opts.frictionStatic,
            frictionAir: opts.frictionAir,
            restitution: opts.restitution,
            isStatic: opts.isStatic,
            chamfer: opts.chamfer > 0 ? { radius: opts.chamfer } : undefined,
            render: {
                fillStyle: renderOptions.wireframes ? 'transparent' : color,
                strokeStyle: color,
                lineWidth: 2
            }
        };

        let body;
        const size = opts.size;

        switch (type) {
            case 'circle':
                body = Matter.Bodies.circle(x, y, size, bodyOptions);
                break;
            case 'rectangle':
                body = Matter.Bodies.rectangle(x, y, size * 1.5, size, bodyOptions);
                break;
            case 'triangle':
                body = Matter.Bodies.polygon(x, y, 3, size, bodyOptions);
                break;
            case 'hexagon':
                body = Matter.Bodies.polygon(x, y, 6, size, bodyOptions);
                break;
            case 'pentagon':
                body = Matter.Bodies.polygon(x, y, 5, size, bodyOptions);
                break;
            case 'star':
                const outerR = size;
                const innerR = size * 0.4;
                const vertices = [];
                for (let i = 0; i < 10; i++) {
                    const angle = (Math.PI / 5) * i - Math.PI / 2;
                    const r = i % 2 === 0 ? outerR : innerR;
                    vertices.push({ x: r * Math.cos(angle), y: r * Math.sin(angle) });
                }
                body = Matter.Bodies.fromVertices(x, y, [vertices], bodyOptions);
                break;
            case 'polygon':
                body = Matter.Bodies.polygon(x, y, opts.sides, size, bodyOptions);
                break;
            default:
                body = Matter.Bodies.rectangle(x, y, size * 1.5, size, bodyOptions);
        }

        if (body) {
            Matter.Composite.add(engineRef.current.world, body);
            setObjects(prev => [...prev, { id: body.id, type, body }]);
        }

        return body;
    }, [bodyDefaults, renderOptions.wireframes]);

    // Add a drone with injectable behavior code
    const addDrone = useCallback((x, y, behaviorCode = null, options = {}) => {
        if (!engineRef.current) return null;

        // Default to wander behavior if no code provided
        const code = behaviorCode || BEHAVIOR_TEMPLATES.wander;

        // Drone-specific styling - circles with distinctive double-ring look
        const droneColor = options.color || '#00ff88';
        const droneSize = options.size || 12;

        // Create circle body for drone (with special visual styling)
        const body = Matter.Bodies.circle(x, y, droneSize, {
            density: 0.002,
            friction: 0.05,
            frictionAir: 0.02,
            restitution: 0.3,
            render: {
                fillStyle: '#001a0d',  // Dark green fill
                strokeStyle: droneColor,
                lineWidth: 4  // Thick bright green border
            },
            label: `drone_${Date.now()}`
        });

        // Mark as drone for filtering
        body.isDrone = true;

        if (body) {
            Matter.Composite.add(engineRef.current.world, body);

            const droneData = {
                id: body.id,
                type: 'drone',
                body,
                behaviorCode: code,
                color: droneColor
            };

            setDrones(prev => [...prev, droneData]);
            setObjects(prev => [...prev, { id: body.id, type: 'drone', body }]);
        }

        return body;
    }, [renderOptions.wireframes, BEHAVIOR_TEMPLATES]);

    // Update a drone's behavior code
    const updateDroneBehavior = useCallback((droneId, newBehaviorCode) => {
        setDrones(prev => prev.map(drone =>
            drone.id === droneId
                ? { ...drone, behaviorCode: newBehaviorCode }
                : drone
        ));
    }, []);

    // Get drone info including behavior code
    const getDroneInfo = useCallback((droneId) => {
        return drones.find(d => d.id === droneId) || null;
    }, [drones]);

    // Add multiple random objects
    const addRandomObjects = useCallback((count = 5) => {
        if (!containerRef?.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const types = ['circle', 'rectangle', 'triangle', 'hexagon', 'pentagon'];

        for (let i = 0; i < count; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            const x = 100 + Math.random() * (rect.width - 200);
            const y = 100 + Math.random() * (rect.height - 200);
            addObject(type, x, y);
        }
    }, [addObject]);

    // Remove object
    const removeObject = useCallback((id) => {
        if (!engineRef.current) return;
        const obj = objects.find(o => o.id === id);
        if (obj?.body) {
            Matter.Composite.remove(engineRef.current.world, obj.body);
            setObjects(prev => prev.filter(o => o.id !== id));
        }
    }, [objects]);

    // Clear all dynamic objects
    const clearObjects = useCallback(() => {
        if (!engineRef.current) return;
        const world = engineRef.current.world;
        const bodies = Matter.Composite.allBodies(world).filter(b => !b.isStatic);
        bodies.forEach(body => Matter.Composite.remove(world, body));
        setObjects([]);
    }, []);

    // Update gravity
    const updateGravity = useCallback((x, y) => {
        setGravity({ x, y });
    }, []);

    // Reset gravity
    const resetGravity = useCallback(() => {
        setGravity({ x: 0, y: 0 });
    }, []);

    // Toggle wireframes
    const toggleWireframes = useCallback(() => {
        setRenderOptions(prev => ({ ...prev, wireframes: !prev.wireframes }));
    }, []);

    // Get all bodies info for display
    const getBodiesInfo = useCallback(() => {
        if (!engineRef.current) return [];
        return Matter.Composite.allBodies(engineRef.current.world).map(body => ({
            id: body.id,
            label: body.label,
            isStatic: body.isStatic,
            position: body.position,
            angle: body.angle,
            velocity: body.velocity
        }));
    }, []);

    // Select a body and highlight it
    const selectBody = useCallback((id) => {
        setSelectedBodyId(id); // Always select, don't toggle

        // Highlight the body by temporarily changing its render style
        if (engineRef.current) {
            const bodies = Matter.Composite.allBodies(engineRef.current.world);
            bodies.forEach(body => {
                if (!body.isStatic) {
                    if (body.id === id) {
                        // Highlight selected body
                        body.render.lineWidth = 4;
                        body.render.strokeStyle = '#ff0';
                    } else {
                        // Reset other bodies
                        body.render.lineWidth = 2;
                    }
                }
            });
        }
    }, []);

    // Add custom shape from vertices (drawn by user)
    const addCustomObject = useCallback((vertices, options = {}) => {
        if (!engineRef.current || vertices.length < 3) return null;

        const colors = ['#e06c75', '#e5c07b', '#98c379', '#56b6c2', '#61afef', '#c678dd'];
        const color = options.color || colors[Math.floor(Math.random() * colors.length)];

        // Calculate centroid for body position
        let cx = 0, cy = 0;
        vertices.forEach(v => { cx += v.x; cy += v.y; });
        cx /= vertices.length;
        cy /= vertices.length;

        // Center vertices around origin
        const centeredVertices = vertices.map(v => ({
            x: v.x - cx,
            y: v.y - cy
        }));

        const bodyOptions = {
            density: bodyDefaults.density,
            friction: bodyDefaults.friction,
            frictionStatic: bodyDefaults.frictionStatic,
            frictionAir: bodyDefaults.frictionAir,
            restitution: bodyDefaults.restitution,
            isStatic: bodyDefaults.isStatic,
            render: {
                fillStyle: renderOptions.wireframes ? 'transparent' : color,
                strokeStyle: color,
                lineWidth: 2
            }
        };

        const body = Matter.Bodies.fromVertices(cx, cy, [centeredVertices], bodyOptions);

        if (body) {
            Matter.Composite.add(engineRef.current.world, body);
            setObjects(prev => [...prev, { id: body.id, type: 'custom', body }]);
        }

        return body;
    }, [bodyDefaults, renderOptions.wireframes]);

    // Get properties of a specific body
    const getBodyProperties = useCallback((id) => {
        if (!engineRef.current) return null;
        const bodies = Matter.Composite.allBodies(engineRef.current.world);
        const body = bodies.find(b => b.id === id);
        if (!body) return null;

        return {
            id: body.id,
            label: body.label,
            isStatic: body.isStatic,
            density: body.density,
            friction: body.friction,
            frictionStatic: body.frictionStatic,
            frictionAir: body.frictionAir,
            restitution: body.restitution,
            mass: body.mass,
            angle: body.angle,
            angularVelocity: body.angularVelocity,
            position: { x: body.position.x, y: body.position.y },
            velocity: { x: body.velocity.x, y: body.velocity.y }
        };
    }, []);

    // Update a property of a specific body
    const updateBodyProperty = useCallback((id, property, value) => {
        if (!engineRef.current) return;
        const bodies = Matter.Composite.allBodies(engineRef.current.world);
        const body = bodies.find(b => b.id === id);
        if (!body) return;

        switch (property) {
            case 'isStatic':
                Matter.Body.setStatic(body, value);
                break;
            case 'density':
                Matter.Body.setDensity(body, value);
                break;
            case 'friction':
                body.friction = value;
                break;
            case 'frictionStatic':
                body.frictionStatic = value;
                break;
            case 'frictionAir':
                body.frictionAir = value;
                break;
            case 'restitution':
                body.restitution = value;
                break;
            case 'position':
                Matter.Body.setPosition(body, { x: value.x, y: value.y });
                break;
            case 'angle':
                Matter.Body.setAngle(body, value);
                break;
            case 'angularVelocity':
                Matter.Body.setAngularVelocity(body, value);
                break;
            case 'velocityX':
                Matter.Body.setVelocity(body, { x: value, y: body.velocity.y });
                break;
            case 'velocityY':
                Matter.Body.setVelocity(body, { x: body.velocity.x, y: value });
                break;
            default:
                body[property] = value;
        }
    }, []);

    // Toggle grid visibility
    const toggleGrid = useCallback(() => {
        setShowGrid(prev => !prev);
    }, []);

    // Pause simulation
    const pauseSimulation = useCallback(() => {
        if (runnerRef.current && !isPaused) {
            runnerRef.current.enabled = false;
            setIsPaused(true);
        }
    }, [isPaused]);

    // Resume simulation
    const resumeSimulation = useCallback(() => {
        if (runnerRef.current && isPaused) {
            runnerRef.current.enabled = true;
            setIsPaused(false);
        }
    }, [isPaused]);

    // Toggle pause/resume
    const togglePause = useCallback(() => {
        if (isPaused) {
            resumeSimulation();
        } else {
            pauseSimulation();
        }
    }, [isPaused, pauseSimulation, resumeSimulation]);

    // Multi-select: toggle a body in the selection set
    const toggleBodySelection = useCallback((id, addToSelection = false) => {
        if (addToSelection) {
            setSelectedBodyIds(prev => {
                const newSet = new Set(prev);
                if (newSet.has(id)) {
                    newSet.delete(id);
                } else {
                    newSet.add(id);
                }
                return newSet;
            });
        } else {
            setSelectedBodyIds(new Set([id]));
        }
        setSelectedBodyId(id);

        // Update highlighting
        if (engineRef.current) {
            const bodies = Matter.Composite.allBodies(engineRef.current.world);
            const selected = addToSelection ? new Set([...selectedBodyIds, id]) : new Set([id]);
            bodies.forEach(body => {
                if (!body.isStatic) {
                    if (selected.has(body.id)) {
                        body.render.lineWidth = 4;
                        body.render.strokeStyle = '#ff0';
                    } else {
                        body.render.lineWidth = 2;
                    }
                }
            });
        }
    }, [selectedBodyIds]);

    // Clear all selections
    const clearSelection = useCallback(() => {
        setSelectedBodyId(null);
        setSelectedBodyIds(new Set());
        if (engineRef.current) {
            const bodies = Matter.Composite.allBodies(engineRef.current.world);
            bodies.forEach(body => {
                if (!body.isStatic) {
                    body.render.lineWidth = 2;
                }
            });
        }
    }, []);

    // Set mouse constraint stiffness
    const setMouseStiffness = useCallback((stiffness) => {
        setMouseStiffnessState(stiffness);
        if (mouseConstraintRef.current) {
            mouseConstraintRef.current.constraint.stiffness = stiffness;
        }
    }, []);

    // Keep refs in sync with state for use in callbacks
    useEffect(() => {
        historyRef.current = history;
        historyIndexRef.current = historyIndex;
    }, [history, historyIndex]);

    // Capture snapshot of current physics state
    const captureSnapshot = useCallback(() => {
        if (!engineRef.current) return null;
        const bodies = Matter.Composite.allBodies(engineRef.current.world);
        const snapshot = {
            bodies: bodies
                .filter(b => !b.isStatic && b.label !== 'wall')
                .map(body => ({
                    id: body.id,
                    label: body.label,
                    position: { x: body.position.x, y: body.position.y },
                    angle: body.angle,
                    velocity: { x: body.velocity.x, y: body.velocity.y },
                    angularVelocity: body.angularVelocity,
                    vertices: body.vertices.map(v => ({ x: v.x, y: v.y })),
                    isCircle: body.circleRadius !== undefined,
                    circleRadius: body.circleRadius,
                    density: body.density,
                    friction: body.friction,
                    frictionAir: body.frictionAir,
                    restitution: body.restitution,
                    render: {
                        fillStyle: body.render.fillStyle,
                        strokeStyle: body.render.strokeStyle,
                        lineWidth: body.render.lineWidth
                    }
                })),
            gravity: { x: gravity.x, y: gravity.y },
            timestamp: Date.now()
        };
        return snapshot;
    }, [gravity]);

    // Restore physics state from snapshot
    const restoreSnapshot = useCallback((snapshot) => {
        if (!engineRef.current || !snapshot) return;

        // Remove all non-static bodies
        const bodies = Matter.Composite.allBodies(engineRef.current.world);
        bodies.forEach(body => {
            if (!body.isStatic) {
                Matter.Composite.remove(engineRef.current.world, body);
            }
        });

        // Recreate bodies from snapshot
        const newObjects = [];
        snapshot.bodies.forEach(data => {
            let body;
            if (data.isCircle && data.circleRadius) {
                body = Matter.Bodies.circle(data.position.x, data.position.y, data.circleRadius, {
                    density: data.density,
                    friction: data.friction,
                    frictionAir: data.frictionAir,
                    restitution: data.restitution,
                    render: data.render
                });
            } else {
                // Recreate from vertices
                const centroid = data.position;
                const relativeVertices = data.vertices.map(v => ({
                    x: v.x - centroid.x,
                    y: v.y - centroid.y
                }));
                body = Matter.Bodies.fromVertices(centroid.x, centroid.y, [relativeVertices], {
                    density: data.density,
                    friction: data.friction,
                    frictionAir: data.frictionAir,
                    restitution: data.restitution,
                    render: data.render
                });
            }
            if (body) {
                Matter.Body.setAngle(body, data.angle);
                Matter.Body.setVelocity(body, data.velocity);
                Matter.Body.setAngularVelocity(body, data.angularVelocity);
                Matter.Composite.add(engineRef.current.world, body);
                newObjects.push({ id: body.id, type: data.label, body });
            }
        });

        setObjects(newObjects);
        setGravity(snapshot.gravity);
        if (engineRef.current) {
            engineRef.current.gravity.x = snapshot.gravity.x;
            engineRef.current.gravity.y = snapshot.gravity.y;
        }
    }, []);

    // Push current state to history
    const pushHistory = useCallback(() => {
        const snapshot = captureSnapshot();
        if (!snapshot) return;

        setHistory(prev => {
            // If we're not at the end, remove future states
            const newHistory = prev.slice(0, historyIndexRef.current + 1);
            newHistory.push(snapshot);
            // Limit history size
            if (newHistory.length > MAX_HISTORY) {
                newHistory.shift();
            }
            return newHistory;
        });
        setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY - 1));
    }, [captureSnapshot]);

    // Undo last action
    const undo = useCallback(() => {
        if (historyIndexRef.current <= 0) return;
        const newIndex = historyIndexRef.current - 1;
        const snapshot = historyRef.current[newIndex];
        if (snapshot) {
            restoreSnapshot(snapshot);
            setHistoryIndex(newIndex);
        }
    }, [restoreSnapshot]);

    // Redo last undone action
    const redo = useCallback(() => {
        if (historyIndexRef.current >= historyRef.current.length - 1) return;
        const newIndex = historyIndexRef.current + 1;
        const snapshot = historyRef.current[newIndex];
        if (snapshot) {
            restoreSnapshot(snapshot);
            setHistoryIndex(newIndex);
        }
    }, [restoreSnapshot]);

    // Save current state to file
    const saveState = useCallback(() => {
        const snapshot = captureSnapshot();
        if (!snapshot) return;

        const dataStr = JSON.stringify(snapshot, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `playground-state-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [captureSnapshot]);

    // Load state from file data
    const loadState = useCallback((jsonData) => {
        try {
            const snapshot = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            restoreSnapshot(snapshot);
            // Clear history after loading
            setHistory([snapshot]);
            setHistoryIndex(0);
        } catch (e) {
            console.error('Failed to load state:', e);
        }
    }, [restoreSnapshot]);

    // Computed values for UI
    const canUndo = historyIndex > 0;
    const canRedo = historyIndex < history.length - 1;

    return {
        objects,
        drones,
        gravity,
        renderOptions,
        bodyDefaults,
        isRunning: isInitialized,
        isPaused,
        mouseStiffness,
        selectedBodyId,
        selectedBodyIds,
        showGrid,
        canUndo,
        canRedo,
        addObject,
        addDrone,
        addCustomObject,
        addRandomObjects,
        removeObject,
        clearObjects,
        updateGravity,
        resetGravity,
        setRenderOption,
        setBodyDefault,
        toggleWireframes,
        toggleGrid,
        getBodiesInfo,
        getBodyProperties,
        updateBodyProperty,
        updateDroneBehavior,
        getDroneInfo,
        selectBody,
        toggleBodySelection,
        clearSelection,
        pauseSimulation,
        resumeSimulation,
        togglePause,
        setMouseStiffness,
        undo,
        redo,
        saveState,
        loadState,
        pushHistory,
        BEHAVIOR_TEMPLATES,
        engine: engineRef.current,
        render: renderRef.current
    };
}
