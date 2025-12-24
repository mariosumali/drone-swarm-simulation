/**
 * usePhysicsSimulation - React hook for physics-based simulation
 * 
 * Provides integration between React UI and PhysicsWorld
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { PhysicsWorld } from './PhysicsWorld';

export function usePhysicsSimulation(items, states, currentStateId, settings = {}) {
    const worldRef = useRef(null);
    const [physicsState, setPhysicsState] = useState({ drones: {}, objects: {} });
    const [isRunning, setIsRunning] = useState(false);
    const [showHitboxes, setShowHitboxes] = useState(false);
    const [hitboxes, setHitboxes] = useState([]);
    const [forceVectors, setForceVectors] = useState([]);
    const [showForces, setShowForces] = useState(false);

    // Initialize physics world
    useEffect(() => {
        const world = new PhysicsWorld({
            width: settings.worldWidth || 2000,
            height: settings.worldHeight || 2000
        });

        world.onUpdate = (state) => {
            setPhysicsState(state);
            if (world.showHitboxes) {
                setHitboxes(world.getHitboxes());
            }
            // Always update force vectors if we want them
            setForceVectors(world.getForceVectors());
        };

        worldRef.current = world;

        return () => {
            world.destroy();
        };
    }, []);

    // Sync items when they change (only when not running)
    useEffect(() => {
        if (worldRef.current && items && currentStateId && !isRunning) {
            worldRef.current.syncFromItems(items, currentStateId);
        }
    }, [items, currentStateId, isRunning]);

    // Start physics simulation
    const startPhysics = useCallback(() => {
        if (!worldRef.current) return;
        worldRef.current.start();
        setIsRunning(true);
    }, []);

    // Stop physics simulation
    const stopPhysics = useCallback(() => {
        if (!worldRef.current) return;
        worldRef.current.stop();
        setIsRunning(false);
    }, []);

    // Toggle physics
    const togglePhysics = useCallback(() => {
        if (isRunning) {
            stopPhysics();
        } else {
            startPhysics();
        }
    }, [isRunning, startPhysics, stopPhysics]);

    // Set drone paths based on their custom paths to next state
    const setDronePathsFromNextState = useCallback(() => {
        if (!worldRef.current || !items || !states) return;

        const currentIndex = states.findIndex(s => s.id === currentStateId);
        if (currentIndex < 0 || currentIndex >= states.length - 1) return;

        const nextStateId = states[currentIndex + 1].id;

        for (const item of items) {
            if (item.type === 'drone') {
                const currentPos = item.statePositions?.[currentStateId];
                const nextPos = item.statePositions?.[nextStateId];

                if (currentPos && nextPos) {
                    // Check for custom path to next state
                    const customPath = nextPos.customPath;

                    if (customPath && customPath.length > 0) {
                        // Use the custom path waypoints
                        worldRef.current.setDronePath(item.id, customPath);
                    } else {
                        // Direct path to next position
                        worldRef.current.setDronePath(item.id, [currentPos, nextPos]);
                    }
                }
            }

            // Set object targets (objects will be pushed by drones)
            if (item.type !== 'drone' && !item.isObstacle) {
                const nextPos = item.statePositions?.[nextStateId];
                if (nextPos) {
                    worldRef.current.setObjectTarget(item.id, { x: nextPos.x, y: nextPos.y });
                }
            }
        }
    }, [items, states, currentStateId]);

    // Legacy alias for compatibility
    const setDroneTargetsFromNextState = setDronePathsFromNextState;

    // Toggle hitbox visibility
    const toggleHitboxes = useCallback(() => {
        if (worldRef.current) {
            worldRef.current.showHitboxes = !worldRef.current.showHitboxes;
            setShowHitboxes(worldRef.current.showHitboxes);
            if (worldRef.current.showHitboxes) {
                setHitboxes(worldRef.current.getHitboxes());
            } else {
                setHitboxes([]);
            }
        }
    }, []);

    // Toggle force vector visibility
    const toggleForceVectors = useCallback(() => {
        setShowForces(prev => !prev);
    }, []);

    // Set drone power (1-100)
    const setDronePower = useCallback((id, power) => {
        if (worldRef.current) {
            worldRef.current.setDronePower(id, power);
        }
    }, []);

    // Set object mass (1-100)
    const setObjectMass = useCallback((id, mass) => {
        if (worldRef.current) {
            worldRef.current.setObjectMass(id, mass);
        }
    }, []);

    // Legacy: Set drone strength directly (deprecated, use setDronePower)
    const setDroneStrength = useCallback((id, strength) => {
        if (worldRef.current) {
            const drone = worldRef.current.droneBodies.get(id);
            if (drone) {
                drone.config.strength = strength;
            }
        }
    }, []);

    return {
        physicsState,
        isRunning,
        showHitboxes,
        hitboxes,
        forceVectors,
        showForces,
        startPhysics,
        stopPhysics,
        togglePhysics,
        setDroneTargetsFromNextState,
        setDronePathsFromNextState,
        toggleHitboxes,
        toggleForceVectors,
        setDronePower,
        setObjectMass,
        setDroneStrength,
        world: worldRef.current
    };
}
