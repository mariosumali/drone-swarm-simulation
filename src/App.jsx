import React, { useState, useEffect } from 'react';
import { Layout, Undo, Redo, Sun, Moon } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Sidebar } from './components/Sidebar';
import { Playground } from './components/Playground';
import { Timeline } from './components/Timeline';
import { EntityList } from './components/EntityList';
import { generateAutoPath } from './utils/pathfinding';

function App() {
    const [items, setItems] = useState([]);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [viewport, setViewport] = useState({ zoom: 1, offsetX: 0, offsetY: 0 });
    const [drawingMode, setDrawingMode] = useState(null);
    const [pathDrawingMode, setPathDrawingMode] = useState(null); // { objectId, fromStateId, toStateId, points }

    // History for undo/redo
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // State management
    const [states, setStates] = useState([
        { id: uuidv4(), name: 'Initial State', timestamp: 0 }
    ]);
    const [currentStateId, setCurrentStateId] = useState(states[0].id);

    // Simulation mode
    const [isSimulating, setIsSimulating] = useState(false);
    const [animationProgress, setAnimationProgress] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [showPathTracking, setShowPathTracking] = useState(true);
    const [clipboard, setClipboard] = useState([]);
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('theme');
        return saved || 'dark';
    });

    // Apply theme to document
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);


    const addItem = (type, x, y) => {
        if (type === 'custom') {
            setDrawingMode({ type: 'custom', points: [{ x, y }], startX: x, startY: y });
            return;
        }

        const newItem = {
            id: uuidv4(),
            type,
            // Store positions per state
            statePositions: {
                [currentStateId]: { x, y, rotation: 0 }
            },
            activeStates: [currentStateId],
            // Transport properties
            transportMode: false,
            assignedDrones: [],
            // Default properties based on type
            ...(type === 'rectangle' ? {
                w: 100,
                h: 100,
                weight: 10
            } : type === 'circle' ? {
                radius: 50,
                weight: 10
            } : type === 'drone-air' || type === 'drone-ground' ? {
                type: 'drone',
                assignedObject: null,
                formationOffset: null,
                droneType: type === 'drone-air' ? 'air' : 'ground'
            } : {})
        };
        setItems(prev => [...prev, newItem]);
        setSelectedIds(new Set([newItem.id]));
    };

    const finishDrawing = () => {
        if (!drawingMode || drawingMode.points.length < 2) {
            setDrawingMode(null);
            return;
        }

        const xs = drawingMode.points.map(p => p.x);
        const ys = drawingMode.points.map(p => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        const relativePoints = drawingMode.points.map(p => ({
            x: p.x - centerX,
            y: p.y - centerY
        }));

        const newItem = {
            id: uuidv4(),
            type: 'custom',
            statePositions: {
                [currentStateId]: { x: centerX, y: centerY }
            },
            activeStates: [currentStateId],
            customPath: relativePoints,
            w: maxX - minX,
            h: maxY - minY,
            weight: 10
        };

        setItems(prev => [...prev, newItem]);
        setSelectedIds(new Set([newItem.id]));
        setDrawingMode(null);
    };

    // Path drawing functions
    const startPathDrawing = (objectId, fromStateId, toStateId) => {
        const object = items.find(i => i.id === objectId);
        if (!object) return;

        const fromPos = object.statePositions[fromStateId];
        const toPos = object.statePositions[toStateId];

        if (!fromPos || !toPos) return;

        // Check if path already exists
        const pathKey = `${fromStateId}_to_${toStateId}`;
        const existingPath = object.customTransitionPaths?.[pathKey];

        setPathDrawingMode({
            objectId,
            fromStateId,
            toStateId,
            points: existingPath ? [...existingPath] : [fromPos],
            endPoint: toPos,
            isActive: false,
            isComplete: !!existingPath
        });
    };

    const finishPathDrawing = () => {
        if (!pathDrawingMode) return;

        const { objectId, fromStateId, toStateId, points } = pathDrawingMode;
        const pathKey = `${fromStateId}_to_${toStateId}`;

        setItems(prev => prev.map(item => {
            if (item.id === objectId) {
                return {
                    ...item,
                    customTransitionPaths: {
                        ...(item.customTransitionPaths || {}),
                        [pathKey]: points
                    }
                };
            }
            return item;
        }));

        setPathDrawingMode(null);
    };

    const clearTransitionPath = (objectId, fromStateId, toStateId) => {
        const pathKey = `${fromStateId}_to_${toStateId}`;

        setItems(prev => prev.map(item => {
            if (item.id === objectId) {
                const newPaths = { ...(item.customTransitionPaths || {}) };
                delete newPaths[pathKey];
                return {
                    ...item,
                    customTransitionPaths: newPaths
                };
            }
            return item;
        }));
    };

    const autoDrawPath = (objectId, fromStateId, toStateId) => {
        const object = items.find(i => i.id === objectId);
        if (!object) return;

        const path = generateAutoPath(object, fromStateId, toStateId, items);
        if (!path || path.length < 2) {
            console.warn('AutoPath: Could not generate path');
            return;
        }

        const pathKey = `${fromStateId}_to_${toStateId}`;

        setItems(prev => prev.map(item => {
            if (item.id === objectId) {
                return {
                    ...item,
                    customTransitionPaths: {
                        ...(item.customTransitionPaths || {}),
                        [pathKey]: path
                    }
                };
            }
            return item;
        }));
    };

    const updateItem = (id, updates) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                // Check if this is an object with locked drones
                const isObjectWithLockedDrones = item.formationLocked && item.assignedDrones?.length > 0;

                if (isObjectWithLockedDrones) {
                    // Get the changes being made
                    const positionChanged = 'x' in updates || 'y' in updates;
                    const rotationChanged = 'rotation' in updates;
                    const sizeChanged = 'w' in updates || 'h' in updates || 'radius' in updates;

                    // Store updatedObject for drone calculations INCLUDING state positions
                    const currentPos = item.statePositions[currentStateId] || { x: 0, y: 0, rotation: 0 };
                    const updatedObject = {
                        ...item,
                        ...updates,
                        statePositions: {
                            ...item.statePositions,
                            [currentStateId]: {
                                x: updates.x !== undefined ? updates.x : currentPos.x,
                                y: updates.y !== undefined ? updates.y : currentPos.y,
                                rotation: updates.rotation !== undefined ? updates.rotation : currentPos.rotation
                            }
                        }
                    };

                    // Update positions if shape has changed
                    if (positionChanged || rotationChanged || sizeChanged) {
                        // Mark that we need to update locked drones
                        updates._updateLockedDrones = true;
                        updates._updatedObjectRef = updatedObject;
                    }
                }

                // Position/rotation updates (including from interpolation)
                if ('x' in updates || 'y' in updates || 'rotation' in updates) {
                    if (item.statePositions) {
                        return {
                            ...item,
                            ...updates,
                            statePositions: {
                                ...item.statePositions,
                                [currentStateId]: {
                                    ...(item.statePositions[currentStateId] || {}),
                                    x: updates.x !== undefined ? updates.x : item.statePositions[currentStateId]?.x || 0,
                                    y: updates.y !== undefined ? updates.y : item.statePositions[currentStateId]?.y || 0,
                                    rotation: updates.rotation !== undefined ? updates.rotation : (item.statePositions[currentStateId]?.rotation || 0)
                                }
                            }
                        };
                    }
                }

                // Other property updates
                return { ...item, ...updates };
            }

            // Update locked drones when their object moves
            if (item.lockedToObject && updates._updateLockedDrones) {
                const isLockedToThisObject = item.lockedToObject === id;

                if (isLockedToThisObject && item.relativeOffset && updates._updatedObjectRef) {
                    const obj = updates._updatedObjectRef;
                    const objPos = obj.statePositions?.[currentStateId];
                    const objRotation = objPos?.rotation || 0;

                    if (objPos) {
                        // Apply rotation to offset
                        const rad = (objRotation * Math.PI) / 180;
                        const cos = Math.cos(rad);
                        const sin = Math.sin(rad);

                        const rotatedX = item.relativeOffset.x * cos - item.relativeOffset.y * sin;
                        const rotatedY = item.relativeOffset.x * sin + item.relativeOffset.y * cos;

                        return {
                            ...item,
                            statePositions: {
                                ...item.statePositions,
                                [currentStateId]: {
                                    x: objPos.x + rotatedX,
                                    y: objPos.y + rotatedY,
                                    rotation: 0
                                }
                            }
                        };
                    }
                }
            }

            return item;
        }));
    };

    const deleteSelected = () => {
        if (selectedIds.size === 0) return;

        const deletedIds = Array.from(selectedIds);

        setItems(prev => prev
            .filter(item => !selectedIds.has(item.id))
            .map(item => {
                // If this object has assigned drones, check if any were deleted
                if (item.assignedDrones && item.assignedDrones.length > 0) {
                    const anyDroneDeleted = item.assignedDrones.some(droneId => deletedIds.includes(droneId));

                    // If ANY drone was deleted, break the formation
                    if (anyDroneDeleted) {
                        return {
                            ...item,
                            transportMode: false,
                            assignedDrones: []
                        };
                    }
                }

                // If this is a drone that was assigned to an object, we already filtered it out
                return item;
            })
        );

        setSelectedIds(new Set());
    };

    // History management
    const saveHistory = () => {
        const snapshot = JSON.parse(JSON.stringify(items));
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(snapshot);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    const undo = () => {
        if (historyIndex > 0) {
            setHistoryIndex(historyIndex - 1);
            setItems(JSON.parse(JSON.stringify(history[historyIndex - 1])));
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(historyIndex + 1);
            setItems(JSON.parse(JSON.stringify(history[historyIndex + 1])));
        }
    };

    // Save history when items change
    React.useEffect(() => {
        if (items.length > 0 || history.length === 0) {
            saveHistory();
        }
    }, [items.length, items.map(i => i.id).join(',')]);

    // State management functions
    const addState = () => {
        const newState = {
            id: uuidv4(),
            name: `State ${states.length + 1}`,
            timestamp: states.length
        };
        setStates(prev => [...prev, newState]);

        // Copy positions from current state to new state for all items
        setItems(prev => prev.map(item => ({
            ...item,
            statePositions: {
                ...item.statePositions,
                [newState.id]: item.statePositions[currentStateId] || { x: 0, y: 0 }
            },
            activeStates: [...item.activeStates, newState.id]
        })));

        setCurrentStateId(newState.id);
    };

    const deleteState = (stateId) => {
        if (states.length <= 1) return; // Keep at least one state

        setStates(prev => prev.filter(s => s.id !== stateId));

        // Remove state from all items
        setItems(prev => prev.map(item => {
            const newStatePositions = { ...item.statePositions };
            delete newStatePositions[stateId];
            return {
                ...item,
                statePositions: newStatePositions,
                activeStates: item.activeStates.filter(id => id !== stateId)
            };
        }));

        // Switch to another state if current was deleted
        if (currentStateId === stateId) {
            setCurrentStateId(states.find(s => s.id !== stateId).id);
        }
    };

    const updateStateName = (stateId, name) => {
        setStates(prev => prev.map(s =>
            s.id === stateId ? { ...s, name } : s
        ));
    };

    const toggleItemInState = (itemId, stateId) => {
        setItems(prev => prev.map(item => {
            if (item.id !== itemId) return item;

            const isActive = item.activeStates.includes(stateId);
            if (isActive) {
                // Remove from state
                const newStatePositions = { ...item.statePositions };
                delete newStatePositions[stateId];
                return {
                    ...item,
                    statePositions: newStatePositions,
                    activeStates: item.activeStates.filter(id => id !== stateId)
                };
            } else {
                // Add to state (copy position from current state)
                return {
                    ...item,
                    statePositions: {
                        ...item.statePositions,
                        [stateId]: item.statePositions[currentStateId] || { x: 0, y: 0 }
                    },
                    activeStates: [...item.activeStates, stateId]
                };
            }
        }));
    };

    // Simulation functions
    const startSimulation = () => {
        // If we're at the last state, restart from the beginning
        const currentIndex = states.findIndex(s => s.id === currentStateId);
        if (currentIndex === states.length - 1) {
            setCurrentStateId(states[0].id);
        }

        setIsSimulating(true);
        setAnimationProgress(0);
    };

    const stopSimulation = () => {
        setIsSimulating(false);
        setAnimationProgress(0);
        setCurrentStateId(states[0].id);
    };

    const toggleSimulation = () => {
        if (isSimulating) {
            setIsSimulating(false);
        } else {
            startSimulation();
        }
    };

    // Ground Formation generation
    const generateGroundFormation = async (objectId) => {
        const { calculateFormation, calculateRequiredDrones } = await import('./utils/formationCalculator');

        const object = items.find(i => i.id === objectId);
        if (!object || object.type === 'drone') return;

        const drones = items.filter(i => i.type === 'drone' && !i.assignedObject && i.droneType === 'ground');

        if (drones.length === 0) {
            alert('No available ground drones');
            return;
        }

        // Get closest ground drones
        const objectPos = object.statePositions[currentStateId];
        const sortedDrones = drones
            .map(d => ({
                drone: d,
                pos: d.statePositions[currentStateId],
                distance: Math.sqrt(
                    Math.pow(d.statePositions[currentStateId].x - objectPos.x, 2) +
                    Math.pow(d.statePositions[currentStateId].y - objectPos.y, 2)
                )
            }))
            .sort((a, b) => a.distance - b.distance);

        // Calculate formation for ground drones
        const formationOffsets = calculateFormation(object, sortedDrones.length, 'ground');

        // Update object and drones
        setItems(prev => prev.map(item => {
            if (item.id === objectId) {
                return {
                    ...item,
                    transportMode: true,
                    formationLocked: true,
                    assignedDrones: sortedDrones.map(d => d.drone.id)
                };
            }

            const droneIndex = sortedDrones.findIndex(d => d.drone.id === item.id);
            if (droneIndex !== -1) {
                const newStatePositions = { ...item.statePositions };

                const objPos = object.statePositions[currentStateId];
                if (objPos) {
                    newStatePositions[currentStateId] = {
                        x: objPos.x + formationOffsets[droneIndex].x,
                        y: objPos.y + formationOffsets[droneIndex].y,
                        rotation: 0
                    };
                }

                const activeStates = item.activeStates.includes(currentStateId)
                    ? item.activeStates
                    : [...item.activeStates, currentStateId];

                return {
                    ...item,
                    assignedObject: objectId,
                    lockedToObject: objectId,
                    formationOffset: formationOffsets[droneIndex],
                    relativeOffset: formationOffsets[droneIndex],
                    statePositions: newStatePositions,
                    activeStates
                };
            }

            return item;
        }));
    };

    // Air Formation generation
    const generateAirFormation = async (objectId) => {
        const { calculateFormation, calculateRequiredDrones } = await import('./utils/formationCalculator');

        const object = items.find(i => i.id === objectId);
        if (!object || object.type === 'drone') return;

        const drones = items.filter(i => i.type === 'drone' && !i.assignedObject && i.droneType === 'air');

        if (drones.length === 0) {
            alert('No available air drones');
            return;
        }

        // Get closest air drones
        const objectPos = object.statePositions[currentStateId];
        const sortedDrones = drones
            .map(d => ({
                drone: d,
                pos: d.statePositions[currentStateId],
                distance: Math.sqrt(
                    Math.pow(d.statePositions[currentStateId].x - objectPos.x, 2) +
                    Math.pow(d.statePositions[currentStateId].y - objectPos.y, 2)
                )
            }))
            .sort((a, b) => a.distance - b.distance);

        // Calculate formation for air drones
        const formationOffsets = calculateFormation(object, sortedDrones.length, 'air');

        // Update object and drones
        setItems(prev => prev.map(item => {
            if (item.id === objectId) {
                return {
                    ...item,
                    transportMode: true,
                    formationLocked: true,
                    assignedDrones: sortedDrones.map(d => d.drone.id)
                };
            }

            const droneIndex = sortedDrones.findIndex(d => d.drone.id === item.id);
            if (droneIndex !== -1) {
                const newStatePositions = { ...item.statePositions };

                const objPos = object.statePositions[currentStateId];
                if (objPos) {
                    newStatePositions[currentStateId] = {
                        x: objPos.x + formationOffsets[droneIndex].x,
                        y: objPos.y + formationOffsets[droneIndex].y,
                        rotation: 0
                    };
                }

                const activeStates = item.activeStates.includes(currentStateId)
                    ? item.activeStates
                    : [...item.activeStates, currentStateId];

                return {
                    ...item,
                    assignedObject: objectId,
                    lockedToObject: objectId,
                    formationOffset: formationOffsets[droneIndex],
                    relativeOffset: formationOffsets[droneIndex],
                    statePositions: newStatePositions,
                    activeStates
                };
            }

            return item;
        }));
    };

    // Unlock formation
    const unlockFormation = (objectId) => {
        setItems(prev => prev.map(item => {
            // Unlock the object
            if (item.id === objectId) {
                return {
                    ...item,
                    formationLocked: false
                };
            }

            // Unlock all drones assigned to this object
            if (item.lockedToObject === objectId) {
                return {
                    ...item,
                    lockedToObject: null
                };
            }

            return item;
        }));
    };

    //Animation loop
    React.useEffect(() => {
        if (!isSimulating || states.length < 2) return;

        const currentIndex = states.findIndex(s => s.id === currentStateId);

        // Stop at the last state instead of looping
        if (currentIndex >= states.length - 1) {
            setIsSimulating(false);
            return;
        }

        const nextIndex = currentIndex + 1;

        const duration = 2000 / playbackSpeed; // 2 seconds per transition
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            setAnimationProgress(progress);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Move to next state
                setCurrentStateId(states[nextIndex].id);
                setAnimationProgress(0);
            }
        };

        const animationId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationId);
    }, [isSimulating, currentStateId, playbackSpeed, states]);

    // Keyboard listeners
    React.useEffect(() => {
        const handleKeyDown = (e) => {
            const activeTag = document.activeElement.tagName;

            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
                deleteSelected();
            }

            // Undo/Redo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                redo();
            }

            if (e.key === 'Escape' && drawingMode) {
                setDrawingMode(null);
            }

            if (e.key === 'Enter' && drawingMode) {
                finishDrawing();
            }

            // Path drawing shortcuts
            if (e.key === 'Escape' && pathDrawingMode) {
                setPathDrawingMode(null);
            }

            if (e.key === 'Enter' && pathDrawingMode) {
                finishPathDrawing();
            }

            // Copy (Ctrl+C / Cmd+C)
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
                if (selectedIds.size > 0) {
                    const selectedItems = items.filter(item => selectedIds.has(item.id));
                    setClipboard(selectedItems.map(item => ({ ...item })));
                    console.log('Copied', selectedItems.length, 'items to clipboard');
                }
            }

            // Paste (Ctrl+V / Cmd+V)
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
                if (clipboard.length > 0) {
                    e.preventDefault();
                    const offset = 50; // Offset pasted items so they don't overlap
                    const newItems = clipboard.map(item => {
                        const newId = uuidv4();
                        // Clone state positions with offset
                        const newStatePositions = {};
                        if (item.statePositions) {
                            for (const [stateId, pos] of Object.entries(item.statePositions)) {
                                newStatePositions[stateId] = {
                                    ...pos,
                                    x: pos.x + offset,
                                    y: pos.y + offset
                                };
                            }
                        }
                        return {
                            ...item,
                            id: newId,
                            statePositions: newStatePositions,
                            // Clear formation-related properties
                            assignedDrones: undefined,
                            formationLocked: undefined,
                            lockedToObject: undefined,
                            assignedObject: undefined,
                            relativeOffset: undefined
                        };
                    });
                    setItems(prev => [...prev, ...newItems]);
                    // Select the pasted items
                    setSelectedIds(new Set(newItems.map(item => item.id)));
                    console.log('Pasted', newItems.length, 'items');
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedIds, drawingMode, pathDrawingMode, items, clipboard]);

    return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <header style={{
                padding: '0 1.5rem',
                height: '60px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                flexShrink: 0
            }}>
                <div style={{ padding: '0.4rem', background: 'var(--accent-color)', borderRadius: '6px', display: 'flex' }}>
                    <Layout size={20} color="white" />
                </div>
                <h1 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                    Drone Swarm Simulation
                </h1>

                {/* Undo/Redo buttons */}
                <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                    <button
                        onClick={undo}
                        disabled={historyIndex <= 0}
                        style={{
                            padding: '0.5rem',
                            background: historyIndex <= 0 ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            color: historyIndex <= 0 ? 'var(--text-secondary)' : 'var(--text-primary)',
                            cursor: historyIndex <= 0 ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            opacity: historyIndex <= 0 ? 0.5 : 1
                        }}
                        title="Undo (Ctrl+Z)"
                    >
                        <Undo size={16} />
                    </button>
                    <button
                        onClick={redo}
                        disabled={historyIndex >= history.length - 1}
                        style={{
                            padding: '0.5rem',
                            background: historyIndex >= history.length - 1 ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            color: historyIndex >= history.length - 1 ? 'var(--text-secondary)' : 'var(--text-primary)',
                            cursor: historyIndex >= history.length - 1 ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            opacity: historyIndex >= history.length - 1 ? 0.5 : 1
                        }}
                        title="Redo (Ctrl+Y)"
                    >
                        <Redo size={16} />
                    </button>
                </div>

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        {items.length} Entities
                    </span>
                    <button
                        onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
                        style={{
                            padding: '0.5rem',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                        }}
                        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    >
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                </div>
                {drawingMode && (
                    <div style={{
                        padding: '0.5rem 1rem',
                        background: 'rgba(34, 197, 94, 0.1)',
                        border: '1px solid #4ade80',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        color: '#4ade80'
                    }}>
                        Drawing Mode - Click to add points, Enter to finish, Esc to cancel
                    </div>
                )}
                {pathDrawingMode && (
                    <div style={{
                        padding: '0.5rem 1rem',
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid #f59e0b',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        color: '#f59e0b'
                    }}>
                        ✏️ Drawing Custom Path — Click on green dot to start, drag to draw, release to finish
                    </div>
                )}
            </header>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <Sidebar
                    items={items}
                    selectedIds={selectedIds}
                    onUpdateItem={updateItem}
                    onDelete={deleteSelected}
                    states={states}
                    currentStateId={currentStateId}
                    onToggleItemInState={toggleItemInState}
                    isSimulating={isSimulating}
                    animationProgress={animationProgress}
                    onGenerateGroundFormation={generateGroundFormation}
                    onGenerateAirFormation={generateAirFormation}
                    onUnlockFormation={unlockFormation}
                    onStartPathDrawing={startPathDrawing}
                    onClearPath={clearTransitionPath}
                    onAutoDrawPath={autoDrawPath}
                    pathDrawingMode={pathDrawingMode}
                />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <Playground
                            items={items}
                            onAddItem={addItem}
                            onUpdateItem={updateItem}
                            selectedIds={selectedIds}
                            onSelectionChange={setSelectedIds}
                            viewport={viewport}
                            onViewportChange={setViewport}
                            drawingMode={drawingMode}
                            onDrawingModeChange={setDrawingMode}
                            onFinishDrawing={finishDrawing}
                            currentStateId={currentStateId}
                            isSimulating={isSimulating}
                            animationProgress={animationProgress}
                            states={states}
                            showPathTracking={showPathTracking}
                            pathDrawingMode={pathDrawingMode}
                            onPathDrawingModeChange={setPathDrawingMode}
                            onFinishPathDrawing={finishPathDrawing}
                        />
                        <EntityList
                            items={items}
                            selectedIds={selectedIds}
                            onSelect={setSelectedIds}
                            onUpdateItem={updateItem}
                            onDelete={(ids) => {
                                setItems(prev => prev.filter(item => !ids.has(item.id)));
                                setSelectedIds(new Set());
                            }}
                            currentStateId={currentStateId}
                            showPathTracking={showPathTracking}
                            onTogglePathTracking={() => setShowPathTracking(!showPathTracking)}
                        />
                    </div>
                    <Timeline
                        states={states}
                        currentStateId={currentStateId}
                        onStateChange={setCurrentStateId}
                        onAddState={addState}
                        onDeleteState={deleteState}
                        onUpdateStateName={updateStateName}
                        isSimulating={isSimulating}
                        onToggleSimulation={toggleSimulation}
                        onStopSimulation={stopSimulation}
                        playbackSpeed={playbackSpeed}
                        onPlaybackSpeedChange={setPlaybackSpeed}
                        animationProgress={animationProgress}
                    />
                </div>
            </div>
        </div>
    );
}

export default App;
