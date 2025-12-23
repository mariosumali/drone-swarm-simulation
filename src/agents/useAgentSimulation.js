/**
 * useAgentSimulation - React hook for integrating the agent system
 * 
 * This hook provides a bridge between the React-based UI and the
 * agent simulation system. It handles:
 * - Initialization and cleanup of the AgentManager
 * - Syncing items/state with agents
 * - Providing agent state for rendering
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { AgentManager } from './AgentManager';

export function useAgentSimulation(items, states, currentStateId, settings = {}) {
    const managerRef = useRef(null);
    const [agentStates, setAgentStates] = useState({});
    const [isRunning, setIsRunning] = useState(false);
    const [collisions, setCollisions] = useState([]);

    // Initialize manager
    useEffect(() => {
        const manager = new AgentManager({
            worldBounds: {
                width: settings.worldWidth || 2000,
                height: settings.worldHeight || 2000
            }
        });

        manager.onUpdate = (states) => {
            setAgentStates(states);
        };

        manager.onCollision = (collision) => {
            setCollisions(prev => [...prev.slice(-9), collision]); // Keep last 10
        };

        managerRef.current = manager;

        return () => {
            manager.destroy();
        };
    }, []);

    // Sync items when they change
    useEffect(() => {
        if (managerRef.current && items && currentStateId) {
            managerRef.current.syncFromItems(items, currentStateId);
        }
    }, [items, currentStateId]);

    // Start agent simulation
    const startAgentMode = useCallback(() => {
        if (!managerRef.current) return;
        managerRef.current.start();
        setIsRunning(true);
    }, []);

    // Stop agent simulation
    const stopAgentMode = useCallback(() => {
        if (!managerRef.current) return;
        managerRef.current.stop();
        setIsRunning(false);
    }, []);

    // Set goals for agents to move toward
    const setAgentGoals = useCallback((goals) => {
        if (!managerRef.current) return;
        managerRef.current.setAllGoals(goals);
    }, []);

    // Set goal based on next state positions
    const setGoalsFromNextState = useCallback(() => {
        if (!managerRef.current || !items || !states) return;

        const currentIndex = states.findIndex(s => s.id === currentStateId);
        if (currentIndex < 0 || currentIndex >= states.length - 1) return;

        const nextStateId = states[currentIndex + 1].id;
        const goals = {};

        for (const item of items) {
            if (item.type === 'drone') {
                const nextPos = item.statePositions?.[nextStateId];
                if (nextPos) {
                    goals[item.id] = { x: nextPos.x, y: nextPos.y };
                }
            }
        }

        managerRef.current.setAllGoals(goals);
    }, [items, states, currentStateId]);

    // Step simulation (for debugging)
    const step = useCallback(() => {
        if (!managerRef.current) return;
        managerRef.current.step();
    }, []);

    // Get specific agent
    const getAgent = useCallback((id) => {
        if (!managerRef.current) return null;
        return managerRef.current.getAgent(id);
    }, []);

    // Check if all goals reached
    const allGoalsReached = useCallback(() => {
        if (!managerRef.current) return false;
        return managerRef.current.allGoalsReached();
    }, []);

    // Update agent config (e.g., sensing range)
    const updateAgentConfig = useCallback((id, config) => {
        const agent = managerRef.current?.getAgent(id);
        if (agent) {
            Object.assign(agent.config, config);
        }
    }, []);

    return {
        agentStates,
        isRunning,
        collisions,
        startAgentMode,
        stopAgentMode,
        setAgentGoals,
        setGoalsFromNextState,
        step,
        getAgent,
        allGoalsReached,
        updateAgentConfig,
        manager: managerRef.current
    };
}
