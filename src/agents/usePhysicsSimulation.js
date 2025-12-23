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

    // Set drone targets based on next state
    const setDroneTargetsFromNextState = useCallback(() => {
        if (!worldRef.current || !items || !states) return;

        const currentIndex = states.findIndex(s => s.id === currentStateId);
        if (currentIndex < 0 || currentIndex >= states.length - 1) return;

        const nextStateId = states[currentIndex + 1].id;

        // For now, set drone targets to their next state positions
        // In the full implementation, drones should target positions 
        // that allow them to push objects toward their goals
        for (const item of items) {
            if (item.type === 'drone') {
                const nextPos = item.statePositions?.[nextStateId];
                if (nextPos) {
                    worldRef.current.setDroneTarget(item.id, { x: nextPos.x, y: nextPos.y });
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

    // Set drone strength
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
        startPhysics,
        stopPhysics,
        togglePhysics,
        setDroneTargetsFromNextState,
        toggleHitboxes,
        setDroneStrength,
        world: worldRef.current
    };
}
