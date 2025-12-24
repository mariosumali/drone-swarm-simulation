/**
 * usePhysicsPlayground - React hook for 2D physics playground
 * Full-featured implementation with Matter.js inspector options
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import Matter from 'matter-js';

export function usePhysicsPlayground(canvasRef, containerRef) {
    const engineRef = useRef(null);
    const renderRef = useRef(null);
    const runnerRef = useRef(null);
    const mouseConstraintRef = useRef(null);

    const [objects, setObjects] = useState([]);
    const [gravity, setGravity] = useState({ x: 0, y: 1 });
    const [isInitialized, setIsInitialized] = useState(false);
    const [selectedBodyId, setSelectedBodyId] = useState(null);

    // Render options (like Matter.js demo)
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
        const mouse = Matter.Mouse.create(render.canvas);
        const mouseConstraint = Matter.MouseConstraint.create(engine, {
            mouse: mouse,
            constraint: {
                stiffness: 0.2,
                render: { visible: true }
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
        setGravity({ x: 0, y: 1 });
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
        setSelectedBodyId(prevId => prevId === id ? null : id);

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

    return {
        objects,
        gravity,
        renderOptions,
        bodyDefaults,
        isRunning: isInitialized,
        selectedBodyId,
        addObject,
        addCustomObject,
        addRandomObjects,
        removeObject,
        clearObjects,
        updateGravity,
        resetGravity,
        setRenderOption,
        setBodyDefault,
        toggleWireframes,
        getBodiesInfo,
        getBodyProperties,
        updateBodyProperty,
        selectBody,
        engine: engineRef.current,
        render: renderRef.current
    };
}
