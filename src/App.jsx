import React, { useState, useEffect, useRef } from 'react';
import { Undo, Redo, Sun, Moon, Save, FolderOpen, Settings, X, Video, Group, HelpCircle, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
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

    // Settings
    const [showSettings, setShowSettings] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [settings, setSettings] = useState(() => {
        const saved = localStorage.getItem('simulationSettings');
        return saved ? JSON.parse(saved) : {
            gridSize: 20,
            snapToGrid: false,
            showGrid: true,
            animationDuration: 2,
            defaultDroneType: 'air',
            autoSave: false,
            panSensitivity: 0.5,
            zoomSensitivity: 1,
            showObjectLabels: true,
            pathSmoothness: 10
        };
    });

    // Save settings to localStorage
    useEffect(() => {
        localStorage.setItem('simulationSettings', JSON.stringify(settings));
    }, [settings]);

    // Groups state
    const [groups, setGroups] = useState([]);

    // Group selected items
    const groupSelected = () => {
        if (selectedIds.size < 2) return;
        const groupId = uuidv4();
        const memberIds = Array.from(selectedIds);
        setGroups(prev => [...prev, { id: groupId, members: memberIds, name: `Group ${prev.length + 1}` }]);
        setItems(prev => prev.map(item =>
            memberIds.includes(item.id) ? { ...item, groupId } : item
        ));
    };

    // Ungroup selected items
    const ungroupSelected = () => {
        const selectedItem = items.find(item => selectedIds.has(item.id));
        if (!selectedItem?.groupId) return;
        const groupId = selectedItem.groupId;
        setGroups(prev => prev.filter(g => g.id !== groupId));
        setItems(prev => prev.map(item =>
            item.groupId === groupId ? { ...item, groupId: undefined } : item
        ));
    };

    // Check if selection contains grouped items
    const hasGroupedItems = () => {
        return items.some(item => selectedIds.has(item.id) && item.groupId);
    };

    // Alignment functions
    const alignItems = (alignment) => {
        if (selectedIds.size < 2) return;
        const selectedItems = items.filter(item => selectedIds.has(item.id));

        // Get positions in current state
        const getPos = (item) => item.statePositions?.[currentStateId] || { x: 0, y: 0 };
        const getSize = (item) => ({
            w: item.w || (item.radius ? item.radius * 2 : 100),
            h: item.h || (item.radius ? item.radius * 2 : 100)
        });

        let targetValue;
        switch (alignment) {
            case 'left':
                targetValue = Math.min(...selectedItems.map(i => getPos(i).x - getSize(i).w / 2));
                setItems(prev => prev.map(item => {
                    if (!selectedIds.has(item.id)) return item;
                    const size = getSize(item);
                    return { ...item, statePositions: { ...item.statePositions, [currentStateId]: { ...item.statePositions?.[currentStateId], x: targetValue + size.w / 2 } } };
                }));
                break;
            case 'centerH':
                targetValue = selectedItems.reduce((sum, i) => sum + getPos(i).x, 0) / selectedItems.length;
                setItems(prev => prev.map(item => {
                    if (!selectedIds.has(item.id)) return item;
                    return { ...item, statePositions: { ...item.statePositions, [currentStateId]: { ...item.statePositions?.[currentStateId], x: targetValue } } };
                }));
                break;
            case 'right':
                targetValue = Math.max(...selectedItems.map(i => getPos(i).x + getSize(i).w / 2));
                setItems(prev => prev.map(item => {
                    if (!selectedIds.has(item.id)) return item;
                    const size = getSize(item);
                    return { ...item, statePositions: { ...item.statePositions, [currentStateId]: { ...item.statePositions?.[currentStateId], x: targetValue - size.w / 2 } } };
                }));
                break;
            case 'top':
                targetValue = Math.min(...selectedItems.map(i => getPos(i).y - getSize(i).h / 2));
                setItems(prev => prev.map(item => {
                    if (!selectedIds.has(item.id)) return item;
                    const size = getSize(item);
                    return { ...item, statePositions: { ...item.statePositions, [currentStateId]: { ...item.statePositions?.[currentStateId], y: targetValue + size.h / 2 } } };
                }));
                break;
            case 'centerV':
                targetValue = selectedItems.reduce((sum, i) => sum + getPos(i).y, 0) / selectedItems.length;
                setItems(prev => prev.map(item => {
                    if (!selectedIds.has(item.id)) return item;
                    return { ...item, statePositions: { ...item.statePositions, [currentStateId]: { ...item.statePositions?.[currentStateId], y: targetValue } } };
                }));
                break;
            case 'bottom':
                targetValue = Math.max(...selectedItems.map(i => getPos(i).y + getSize(i).h / 2));
                setItems(prev => prev.map(item => {
                    if (!selectedIds.has(item.id)) return item;
                    const size = getSize(item);
                    return { ...item, statePositions: { ...item.statePositions, [currentStateId]: { ...item.statePositions?.[currentStateId], y: targetValue - size.h / 2 } } };
                }));
                break;
        }
    };

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

    // History management - save complete snapshots
    const isUndoingRef = React.useRef(false);

    const saveHistory = React.useCallback(() => {
        if (isUndoingRef.current) return;
        const snapshot = {
            items: JSON.parse(JSON.stringify(items)),
            states: JSON.parse(JSON.stringify(states)),
            currentStateId
        };
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(snapshot);
        // Limit history to 50 entries
        if (newHistory.length > 50) newHistory.shift();
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    }, [items, states, currentStateId, history, historyIndex]);

    const undo = () => {
        if (historyIndex > 0) {
            isUndoingRef.current = true;
            const snapshot = history[historyIndex - 1];
            setItems(JSON.parse(JSON.stringify(snapshot.items)));
            setStates(JSON.parse(JSON.stringify(snapshot.states)));
            setCurrentStateId(snapshot.currentStateId);
            setHistoryIndex(historyIndex - 1);
            setTimeout(() => { isUndoingRef.current = false; }, 0);
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            isUndoingRef.current = true;
            const snapshot = history[historyIndex + 1];
            setItems(JSON.parse(JSON.stringify(snapshot.items)));
            setStates(JSON.parse(JSON.stringify(snapshot.states)));
            setCurrentStateId(snapshot.currentStateId);
            setHistoryIndex(historyIndex + 1);
            setTimeout(() => { isUndoingRef.current = false; }, 0);
        }
    };

    // Save history when meaningful changes happen (debounced)
    const lastSnapshotRef = React.useRef('');
    React.useEffect(() => {
        if (isUndoingRef.current) return;
        const currentSnapshot = JSON.stringify({ items, states, currentStateId });
        if (currentSnapshot !== lastSnapshotRef.current && items.length >= 0) {
            const timer = setTimeout(() => {
                if (currentSnapshot !== lastSnapshotRef.current) {
                    lastSnapshotRef.current = currentSnapshot;
                    saveHistory();
                }
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [items, states, currentStateId]);

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
        if (stateId === states[0].id) return; // Cannot delete initial state

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

            // Escape to deselect
            if (e.key === 'Escape') {
                setSelectedIds(new Set());
                if (drawingMode) onSetDrawingMode(null);
                if (pathDrawingMode) onSetPathDrawingMode(null);
            }

            // Select All (Ctrl+A / Cmd+A)
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
                e.preventDefault();
                setSelectedIds(new Set(items.map(item => item.id)));
            }

            // Duplicate (Ctrl+D / Cmd+D)
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
                if (selectedIds.size > 0) {
                    e.preventDefault();
                    const selectedItems = items.filter(item => selectedIds.has(item.id));
                    const offset = 30;
                    const newItems = selectedItems.map(item => {
                        const newId = uuidv4();
                        const newStatePositions = {};
                        if (item.statePositions) {
                            for (const [stateId, pos] of Object.entries(item.statePositions)) {
                                newStatePositions[stateId] = { ...pos, x: pos.x + offset, y: pos.y + offset };
                            }
                        }
                        return { ...item, id: newId, statePositions: newStatePositions };
                    });
                    setItems(prev => [...prev, ...newItems]);
                    setSelectedIds(new Set(newItems.map(item => item.id)));
                }
            }

            // Group (Ctrl+G / Cmd+G)
            if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
                e.preventDefault();
                if (selectedIds.size >= 2) groupSelected();
            }

            // Show help (?)
            if (e.key === '?' || (e.shiftKey && e.key === '/')) {
                if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
                setShowHelp(true);
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
                <img src="/logo.png" alt="Logo" style={{ width: '32px', height: '32px', borderRadius: '6px' }} />
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

                {/* Save/Load buttons */}
                <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '0.5rem' }}>
                    <button
                        onClick={() => {
                            const data = {
                                version: 1,
                                items,
                                states,
                                currentStateId,
                                viewport
                            };
                            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `simulation-${new Date().toISOString().slice(0, 10)}.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                        }}
                        style={{
                            padding: '0.5rem',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            display: 'flex'
                        }}
                        title="Save Simulation"
                    >
                        <Save size={16} />
                    </button>
                    <button
                        onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = '.json';
                            input.onchange = (e) => {
                                const file = e.target.files[0];
                                if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                        try {
                                            const data = JSON.parse(event.target.result);
                                            if (data.items) setItems(data.items);
                                            if (data.states) setStates(data.states);
                                            if (data.currentStateId) setCurrentStateId(data.currentStateId);
                                            if (data.viewport) setViewport(data.viewport);
                                            setSelectedIds(new Set());
                                            setHistory([]);
                                            setHistoryIndex(-1);
                                            console.log('Simulation loaded successfully');
                                        } catch (err) {
                                            console.error('Failed to load simulation:', err);
                                            alert('Failed to load simulation file');
                                        }
                                    };
                                    reader.readAsText(file);
                                }
                            };
                            input.click();
                        }}
                        style={{
                            padding: '0.5rem',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            display: 'flex'
                        }}
                        title="Load Simulation"
                    >
                        <FolderOpen size={16} />
                    </button>
                </div>

                {/* Group/Ungroup buttons */}
                {selectedIds.size >= 2 && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            onClick={groupSelected}
                            style={{
                                padding: '0.5rem 0.75rem',
                                background: 'var(--accent-color)',
                                border: 'none',
                                borderRadius: '6px',
                                color: 'white',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                fontSize: '0.75rem',
                                fontWeight: 500
                            }}
                            title="Group Selected Items"
                        >
                            <Group size={14} /> Group
                        </button>
                    </div>
                )}
                {hasGroupedItems() && (
                    <button
                        onClick={ungroupSelected}
                        style={{
                            padding: '0.5rem 0.75rem',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.75rem',
                            fontWeight: 500
                        }}
                        title="Ungroup Selected Items"
                    >
                        Ungroup
                    </button>
                )}

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
                    <button
                        onClick={() => setShowSettings(true)}
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
                        title="Settings"
                    >
                        <Settings size={18} />
                    </button>
                    <button
                        onClick={() => setShowHelp(true)}
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
                        title="Keyboard Shortcuts (Press ?)"
                    >
                        <HelpCircle size={18} />
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
                            settings={settings}
                            onDeleteItem={(id) => {
                                setItems(prev => prev.filter(item => item.id !== id));
                                setSelectedIds(new Set());
                            }}
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

            {/* Settings Modal */}
            {showSettings && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }} onClick={() => setShowSettings(false)}>
                    <div style={{
                        background: 'var(--bg-secondary)',
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)',
                        width: '500px',
                        maxHeight: '80vh',
                        overflow: 'auto',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
                    }} onClick={(e) => e.stopPropagation()}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '1rem 1.5rem',
                            borderBottom: '1px solid var(--border-color)'
                        }}>
                            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>Settings</h2>
                            <button
                                onClick={() => setShowSettings(false)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    padding: '0.25rem'
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {/* Canvas Settings */}
                            <div>
                                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--accent-color)', marginBottom: '0.75rem' }}>Canvas</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>Show Grid</span>
                                        <input
                                            type="checkbox"
                                            checked={settings.showGrid}
                                            onChange={(e) => setSettings(prev => ({ ...prev, showGrid: e.target.checked }))}
                                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                        />
                                    </label>
                                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>Grid Size</span>
                                        <input
                                            type="number"
                                            value={settings.gridSize}
                                            onChange={(e) => setSettings(prev => ({ ...prev, gridSize: parseInt(e.target.value) || 20 }))}
                                            style={{ width: '80px', padding: '0.375rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)' }}
                                        />
                                    </label>
                                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>Snap to Grid</span>
                                        <input
                                            type="checkbox"
                                            checked={settings.snapToGrid}
                                            onChange={(e) => setSettings(prev => ({ ...prev, snapToGrid: e.target.checked }))}
                                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                        />
                                    </label>
                                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>Pan Sensitivity</span>
                                        <input
                                            type="range"
                                            min="0.1"
                                            max="2"
                                            step="0.1"
                                            value={settings.panSensitivity}
                                            onChange={(e) => setSettings(prev => ({ ...prev, panSensitivity: parseFloat(e.target.value) }))}
                                            style={{ width: '100px', cursor: 'pointer' }}
                                        />
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', width: '30px' }}>{settings.panSensitivity}x</span>
                                    </label>
                                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>Zoom Sensitivity</span>
                                        <input
                                            type="range"
                                            min="0.5"
                                            max="2"
                                            step="0.1"
                                            value={settings.zoomSensitivity}
                                            onChange={(e) => setSettings(prev => ({ ...prev, zoomSensitivity: parseFloat(e.target.value) }))}
                                            style={{ width: '100px', cursor: 'pointer' }}
                                        />
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', width: '30px' }}>{settings.zoomSensitivity}x</span>
                                    </label>
                                </div>
                            </div>

                            {/* Animation Settings */}
                            <div>
                                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--accent-color)', marginBottom: '0.75rem' }}>Animation</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>Animation Duration (seconds)</span>
                                        <input
                                            type="number"
                                            min="0.5"
                                            max="10"
                                            step="0.5"
                                            value={settings.animationDuration}
                                            onChange={(e) => setSettings(prev => ({ ...prev, animationDuration: parseFloat(e.target.value) || 2 }))}
                                            style={{ width: '80px', padding: '0.375rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)' }}
                                        />
                                    </label>
                                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>Path Smoothness</span>
                                        <input
                                            type="range"
                                            min="1"
                                            max="20"
                                            step="1"
                                            value={settings.pathSmoothness}
                                            onChange={(e) => setSettings(prev => ({ ...prev, pathSmoothness: parseInt(e.target.value) }))}
                                            style={{ width: '100px', cursor: 'pointer' }}
                                        />
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', width: '30px' }}>{settings.pathSmoothness}</span>
                                    </label>
                                </div>
                            </div>

                            {/* Objects Settings */}
                            <div>
                                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--accent-color)', marginBottom: '0.75rem' }}>Objects</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>Default Drone Type</span>
                                        <select
                                            value={settings.defaultDroneType}
                                            onChange={(e) => setSettings(prev => ({ ...prev, defaultDroneType: e.target.value }))}
                                            style={{ padding: '0.375rem 0.75rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', cursor: 'pointer' }}
                                        >
                                            <option value="air">Air Drone</option>
                                            <option value="ground">Ground Drone</option>
                                        </select>
                                    </label>
                                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>Show Object Labels</span>
                                        <input
                                            type="checkbox"
                                            checked={settings.showObjectLabels}
                                            onChange={(e) => setSettings(prev => ({ ...prev, showObjectLabels: e.target.checked }))}
                                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                        />
                                    </label>
                                </div>
                            </div>

                            {/* System Settings */}
                            <div>
                                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--accent-color)', marginBottom: '0.75rem' }}>System</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>Auto-Save to Browser</span>
                                        <input
                                            type="checkbox"
                                            checked={settings.autoSave}
                                            onChange={(e) => setSettings(prev => ({ ...prev, autoSave: e.target.checked }))}
                                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                        />
                                    </label>
                                </div>
                            </div>

                            {/* Reset Button */}
                            <button
                                onClick={() => setSettings({
                                    gridSize: 20,
                                    snapToGrid: false,
                                    showGrid: true,
                                    animationDuration: 2,
                                    defaultDroneType: 'air',
                                    autoSave: false,
                                    panSensitivity: 0.5,
                                    zoomSensitivity: 1,
                                    showObjectLabels: true,
                                    pathSmoothness: 10
                                })}
                                style={{
                                    padding: '0.75rem',
                                    background: 'var(--bg-tertiary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                    fontWeight: 500,
                                    marginTop: '0.5rem'
                                }}
                            >
                                Reset to Defaults
                            </button>
                            <button
                                onClick={() => setShowSettings(false)}
                                style={{
                                    padding: '0.75rem',
                                    background: 'var(--accent-color)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                    fontWeight: 500,
                                    marginTop: '0.5rem'
                                }}
                            >
                                Save & Close
                            </button>

                            <div style={{
                                marginTop: '1.5rem',
                                paddingTop: '1rem',
                                borderTop: '1px solid var(--border-color)',
                                textAlign: 'center',
                                fontSize: '0.75rem',
                                color: 'var(--text-secondary)'
                            }}>
                                Created by Mario Sumali
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Keyboard Shortcuts Help Modal */}
            {showHelp && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: 'var(--bg-secondary)',
                        borderRadius: '16px',
                        padding: '1.5rem',
                        width: '500px',
                        maxHeight: '80vh',
                        overflow: 'auto',
                        border: '1px solid var(--border-color)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>Keyboard Shortcuts</h2>
                            <button onClick={() => setShowHelp(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                            {[
                                ['Escape', 'Deselect / Cancel'],
                                ['Delete', 'Delete selected'],
                                ['Ctrl + A', 'Select all'],
                                ['Ctrl + C', 'Copy selected'],
                                ['Ctrl + V', 'Paste'],
                                ['Ctrl + D', 'Duplicate selected'],
                                ['Ctrl + Z', 'Undo'],
                                ['Ctrl + Y', 'Redo'],
                                ['Ctrl + G', 'Group selected'],
                                ['Enter', 'Finish drawing'],
                                ['Shift + Drag', 'Pan canvas'],
                                ['Scroll', 'Zoom in/out'],
                                ['?', 'Show this help']
                            ].map(([key, desc]) => (
                                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', borderRadius: '6px', background: 'var(--bg-tertiary)' }}>
                                    <kbd style={{
                                        padding: '0.25rem 0.5rem',
                                        background: 'var(--bg-primary)',
                                        borderRadius: '4px',
                                        fontSize: '0.75rem',
                                        fontFamily: 'monospace',
                                        border: '1px solid var(--border-color)'
                                    }}>{key}</kbd>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{desc}</span>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => setShowHelp(false)}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                background: 'var(--accent-color)',
                                border: 'none',
                                borderRadius: '8px',
                                color: 'white',
                                cursor: 'pointer',
                                marginTop: '1rem',
                                fontWeight: 500
                            }}
                        >
                            Got it!
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
