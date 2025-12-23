import React, { useRef, useState } from 'react';
import { Drone } from './Drone';
import { SimulationObject } from './SimulationObject';
import { interpolateAlongPath, EASING_FUNCTIONS } from '../utils/pathInterpolation';
import { lineIntersectsObstacle, isPointInObstacle } from '../utils/pathfinding';
import { AlertTriangle } from 'lucide-react';


export function Playground({
    items, onAddItem, onUpdateItem, onDeleteItem, selectedIds, onSelectionChange,
    viewport, onViewportChange,
    drawingMode, onDrawingModeChange, onFinishDrawing,
    currentStateId, isSimulating, animationProgress, states, showPathTracking, showDronePaths, showForceVectors,
    pathDrawingMode, onPathDrawingModeChange, onFinishPathDrawing,
    scrollZoomEnabled = true, // Default to true if not passed
    containerRef, // For recording/region capture
    show3DMode = false,
    settings = {},
    physicsMode = false,
    physicsState = { drones: {}, objects: {} },
    showHitboxes = false,
    hitboxes = []
}) {

    const playgroundRef = useRef(null);
    const contentRef = useRef(null);
    const [activeDrag, setActiveDrag] = useState(null);
    const [isPanning, setIsPanning] = useState(false);
    const [contextMenu, setContextMenu] = useState(null); // { x, y }
    const [showObjectSubmenu, setShowObjectSubmenu] = useState(false);
    const [showDroneSubmenu, setShowDroneSubmenu] = useState(false);
    const [panStart, setPanStart] = useState(null);
    const [rotatingItem, setRotatingItem] = useState(null);


    // Helper to interpolate values
    const interpolate = (start, end, progress) => {
        return start + (end - start) * progress;
    };

    // Get item position (with interpolation during simulation)
    const getItemPosition = (item) => {
        // Regular item positioning (not simulating)
        if (!isSimulating || !item.statePositions) {
            return item.statePositions?.[currentStateId] || { x: 0, y: 0, z: 0, rotation: 0 };
        }

        const currentStateIndex = states.findIndex(s => s.id === currentStateId);
        const nextStateIndex = (currentStateIndex + 1) % states.length;

        const currentPos = item.statePositions[states[currentStateIndex].id];
        const nextPos = item.statePositions[states[nextStateIndex].id];

        if (!currentPos || !nextPos) {
            return currentPos || nextPos || { x: 0, y: 0, z: 0, rotation: 0 };
        }

        if (nextPos.customPath && nextPos.customPath.length > 1) {
            const result = interpolateAlongPath(nextPos.customPath, animationProgress, settings.easing);
            return {
                ...result,
                z: interpolate(currentPos.z || 0, nextPos.z || 0, animationProgress),
                rotation: interpolate(currentPos.rotation || 0, nextPos.rotation || 0, animationProgress)
            };
        }

        // Check for custom transition path (old format)
        const nextState = states[nextStateIndex];
        // Safety check if nextState is undefined (e.g. if states array changed)
        if (!nextState) return currentPos || { x: 0, y: 0, z: 0, rotation: 0 };

        const pathKey = `${states[currentStateIndex].id}_to_${nextState.id}`;
        const customPath = item.customTransitionPaths?.[pathKey];

        if (customPath && customPath.length > 1) {
            const interpolated = interpolateAlongPath(customPath, animationProgress, settings.easing);

            // Basic Z-axis interpolation for custom paths (linear approach since paths are 2D)
            const zStart = currentPos.z || 0;
            const zEnd = nextState.statePositions?.[nextState.id]?.z || 0; // Look ahead to target Z
            // Actually, we should interpolate Z based on start/end states for the whole path duration
            const z = interpolate(currentPos.z || 0, nextPos.z || 0, animationProgress);

            return { ...interpolated, z };
        }

        // Drone locked to object - follow parent position
        if (item.type === 'drone' && item.lockedToObject) {
            const parentObj = items.find(i => i.id === item.lockedToObject);
            if (parentObj) {
                // Check if the drone is actually "in formation" in the current state
                // If the stored position is significantly different from the formation position,
                // it implies an "Entry" or "Exit" state where the drone should move independently.
                const droneStoredPos = item.statePositions?.[currentStateId];
                const parentStoredPos = parentObj.statePositions?.[currentStateId];

                let isInFormation = true;

                if (droneStoredPos && parentStoredPos) {
                    const offset = item.relativeOffset || { x: 0, y: 0 };
                    const angleRad = (parentStoredPos.rotation || 0) * (Math.PI / 180);
                    const expectedX = parentStoredPos.x + (offset.x * Math.cos(angleRad) - offset.y * Math.sin(angleRad));
                    const expectedY = parentStoredPos.y + (offset.x * Math.sin(angleRad) + offset.y * Math.cos(angleRad));

                    const dist = Math.hypot(droneStoredPos.x - expectedX, droneStoredPos.y - expectedY);
                    // Allow 5px tolerance
                    if (dist > 5) {
                        isInFormation = false;
                    }
                }

                if (isInFormation) {
                    const parentPos = getItemPosition(parentObj);
                    const offset = item.relativeOffset || { x: 0, y: 0 };

                    const angleRad = (parentPos.rotation || 0) * (Math.PI / 180);
                    const rotatedX = offset.x * Math.cos(angleRad) - offset.y * Math.sin(angleRad);
                    const rotatedY = offset.x * Math.sin(angleRad) + offset.y * Math.cos(angleRad);

                    // Inherit z from drone's own state position, not parent
                    const droneZ = item.statePositions?.[currentStateId]?.z || 0;

                    return {
                        x: parentPos.x + rotatedX,
                        y: parentPos.y + rotatedY,
                        z: droneZ,
                        rotation: 0
                    };
                }
            }
        }


        const easeFunc = EASING_FUNCTIONS[settings.easing] || EASING_FUNCTIONS.linear;
        const navProgress = easeFunc(animationProgress);

        return {
            x: interpolate(currentPos.x, nextPos.x, navProgress),
            y: interpolate(currentPos.y, nextPos.y, navProgress),
            z: interpolate(currentPos.z || 0, nextPos.z || 0, navProgress),
            rotation: interpolate(currentPos.rotation || 0, nextPos.rotation || 0, navProgress)
        };
    };

    // Filter items that exist in current state
    const visibleItems = items.filter(item =>
        item.activeStates?.includes(currentStateId)
    );

    const screenToWorld = (screenX, screenY) => {
        const rect = playgroundRef.current.getBoundingClientRect();
        const screenRelX = screenX - rect.left;
        const screenRelY = screenY - rect.top;

        const worldX = (screenRelX - viewport.offsetX) / viewport.zoom;
        const worldY = (screenRelY - viewport.offsetY) / viewport.zoom;

        return { x: worldX, y: worldY };
    };

    const handleWheel = (e) => {
        if (!scrollZoomEnabled) return;
        e.preventDefault();

        const rect = playgroundRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.1, Math.min(5, viewport.zoom * delta));

        const zoomChange = newZoom / viewport.zoom;
        const newOffsetX = mouseX - (mouseX - viewport.offsetX) * zoomChange;
        const newOffsetY = mouseY - (mouseY - viewport.offsetY) * zoomChange;

        onViewportChange({
            zoom: newZoom,
            offsetX: newOffsetX,
            offsetY: newOffsetY
        });
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const type = e.dataTransfer.getData('application/react-dnd-type');
        if (!type) return;

        const world = screenToWorld(e.clientX, e.clientY);
        onAddItem(type, world.x, world.y);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleItemMouseDown = (e, item) => {
        e.stopPropagation();

        if (drawingMode) return;

        // Prevent dragging locked items
        if (item.isLocked) {
            // Still allow selection
            if (!selectedIds.has(item.id)) {
                const newSelection = e.shiftKey ? new Set([...selectedIds, item.id]) : new Set([item.id]);
                onSelectionChange(newSelection);
            }
            return;
        }

        let newSelection = new Set(selectedIds);
        if (!newSelection.has(item.id)) {
            if (!e.shiftKey) {
                // If item is in a group, select all group members
                if (item.groupId) {
                    const groupMembers = items.filter(i => i.groupId === item.groupId).map(i => i.id);
                    newSelection = new Set(groupMembers);
                } else {
                    newSelection = new Set([item.id]);
                }
            } else {
                // Shift+click: add to selection (including group members if applicable)
                if (item.groupId) {
                    const groupMembers = items.filter(i => i.groupId === item.groupId).map(i => i.id);
                    groupMembers.forEach(id => newSelection.add(id));
                } else {
                    newSelection.add(item.id);
                }
            }
            onSelectionChange(newSelection);
        }

        setActiveDrag({
            type: 'item',
            items: visibleItems.filter(i => newSelection.has(i.id)).map(i => {
                const pos = getItemPosition(i);
                return {
                    id: i.id,
                    startX: pos.x,
                    startY: pos.y
                };
            }),
            mouseStartWorld: screenToWorld(e.clientX, e.clientY)
        });
    };

    const handleBackgroundMouseDown = (e) => {
        if (e.target !== playgroundRef.current && e.target !== contentRef.current) return;

        if (drawingMode) {
            const world = screenToWorld(e.clientX, e.clientY);
            onDrawingModeChange({
                ...drawingMode,
                points: [...drawingMode.points, world]
            });
            return;
        }

        if (pathDrawingMode) {
            const world = screenToWorld(e.clientX, e.clientY);
            const startPoint = pathDrawingMode.points[0];
            const snapDistance = 50; // Increased leeway

            const distToStart = Math.hypot(world.x - startPoint.x, world.y - startPoint.y);

            if (distToStart <= snapDistance) {
                setActiveDrag({
                    type: 'path',
                    isDrawing: true
                });
                onPathDrawingModeChange({
                    ...pathDrawingMode,
                    points: [startPoint],
                    isActive: true
                });
            }
            return;
        }

        if (e.button === 1 || e.spaceKey) {
            setIsPanning(true);
            setPanStart({ x: e.clientX, y: e.clientY });
            return;
        }

        // Shift+drag = pan
        if (e.shiftKey) {
            setIsPanning(true);
            setPanStart({ x: e.clientX, y: e.clientY });
            return;
        }

        // Regular drag = selection box
        onSelectionChange(new Set());
        const world = screenToWorld(e.clientX, e.clientY);
        setActiveDrag({
            type: 'box',
            startWorld: world,
            currentWorld: world,
            initialSelection: new Set()
        });
    };

    const handleDoubleClick = (e) => {
        if (drawingMode && (e.target === playgroundRef.current || e.target === contentRef.current)) {
            onFinishDrawing();
        }
    };

    const handleResizeMouseDown = (e, item, direction) => {
        e.stopPropagation();
        const pos = getItemPosition(item);

        // Default width/height if not present (e.g. circles with radius)
        const currentW = item.w || (item.radius ? item.radius * 2 : 100);
        const currentH = item.h || (item.radius ? item.radius * 2 : 100);

        setActiveDrag({
            type: 'resize',
            itemId: item.id,
            startX: pos.x,
            startY: pos.y,
            startW: currentW,
            startH: currentH,
            startRotation: pos.rotation || 0,
            mouseStartX: e.clientX,
            mouseStartY: e.clientY,
            direction
        });
    };

    const handleMouseMove = (e) => {
        if (isPanning && panStart) {
            const sensitivity = 0.5; // Lower = slower pan
            const dx = (e.clientX - panStart.x) * sensitivity;
            const dy = (e.clientY - panStart.y) * sensitivity;
            onViewportChange({
                ...viewport,
                offsetX: viewport.offsetX + dx,
                offsetY: viewport.offsetY + dy
            });
            setPanStart({ x: e.clientX, y: e.clientY });
            return;
        }

        // Resizing Logic
        if (activeDrag?.type === 'resize') {
            const item = items.find(i => i.id === activeDrag.itemId);
            if (!item) return;

            // Calculate mouse delta in screen space
            let dx_screen = (e.clientX - activeDrag.mouseStartX) / viewport.zoom;
            let dy_screen = (e.clientY - activeDrag.mouseStartY) / viewport.zoom;

            // Rotate delta to object's local coordinate space
            const angleRad = -(activeDrag.startRotation * Math.PI / 180);
            const dx_local = dx_screen * Math.cos(angleRad) - dy_screen * Math.sin(angleRad);
            const dy_local = dx_screen * Math.sin(angleRad) + dy_screen * Math.cos(angleRad);

            let newW = activeDrag.startW;
            let newH = activeDrag.startH;
            let newX_local = 0;
            let newY_local = 0;
            const dir = activeDrag.direction;

            // Apply resize based on direction
            const minSize = 20;

            // Width changes
            if (dir.includes('e')) {
                newW = Math.max(minSize, activeDrag.startW + dx_local);
                newX_local = (newW - activeDrag.startW) / 2;
            } else if (dir.includes('w')) {
                newW = Math.max(minSize, activeDrag.startW - dx_local);
                newX_local = -(newW - activeDrag.startW) / 2;
            }

            // Height changes
            if (dir.includes('s')) {
                newH = Math.max(minSize, activeDrag.startH + dy_local);
                newY_local = (newH - activeDrag.startH) / 2;
            } else if (dir.includes('n')) {
                newH = Math.max(minSize, activeDrag.startH - dy_local);
                newY_local = -(newH - activeDrag.startH) / 2;
            }

            // Apply snap to grid for resizing if enabled
            if (settings.snapToGrid && settings.gridSize) {
                newW = Math.round(newW / settings.gridSize) * settings.gridSize;
                newH = Math.round(newH / settings.gridSize) * settings.gridSize;
                newW = Math.max(minSize, newW);
                newH = Math.max(minSize, newH);
                // Recalculate position shifts after snapping
                if (dir.includes('e')) {
                    newX_local = (newW - activeDrag.startW) / 2;
                } else if (dir.includes('w')) {
                    newX_local = -(newW - activeDrag.startW) / 2;
                }
                if (dir.includes('s')) {
                    newY_local = (newH - activeDrag.startH) / 2;
                } else if (dir.includes('n')) {
                    newY_local = -(newH - activeDrag.startH) / 2;
                }
            }

            // Convert local shift back to world space for the center position update
            const finalAngle = (activeDrag.startRotation * Math.PI / 180);
            const shiftX = newX_local * Math.cos(finalAngle) - newY_local * Math.sin(finalAngle);
            const shiftY = newX_local * Math.sin(finalAngle) + newY_local * Math.cos(finalAngle);

            const updates = {
                w: Math.round(newW),
                h: Math.round(newH),
                x: activeDrag.startX + shiftX,
                y: activeDrag.startY + shiftY
            };

            // For circles, we also update radius property for backward compatibility (max dim / 2)
            // But w/h will be primary for rendering now
            if (item.type === 'circle') {
                updates.radius = Math.round(Math.max(newW, newH) / 2);
            }

            onUpdateItem(item.id, updates);
            return;
        }

        // Rotation
        if (rotatingItem) {

            const item = visibleItems.find(i => i.id === rotatingItem);
            if (!item) return;

            const pos = getItemPosition(item);
            const rect = playgroundRef.current.getBoundingClientRect();

            // Convert to world coordinates
            const centerScreenX = (pos.x * viewport.zoom) + viewport.offsetX + rect.left;
            const centerScreenY = (pos.y * viewport.zoom) + viewport.offsetY + rect.top;

            // Calculate angle from center to mouse
            const dx = e.clientX - centerScreenX;
            const dy = e.clientY - centerScreenY;
            const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;

            onUpdateItem(rotatingItem, { rotation: Math.round(angle) });
            return;
        }

        // Path drawing - record points as mouse moves
        if (activeDrag?.type === 'path' && pathDrawingMode && pathDrawingMode.isActive) {
            const world = screenToWorld(e.clientX, e.clientY);
            const lastPoint = pathDrawingMode.points[pathDrawingMode.points.length - 1];
            const endPoint = pathDrawingMode.endPoint;

            // Check for snap to end
            if (endPoint) {
                const distToEnd = Math.hypot(world.x - endPoint.x, world.y - endPoint.y);
                if (distToEnd < 30) {
                    onPathDrawingModeChange({
                        ...pathDrawingMode,
                        points: [...pathDrawingMode.points, endPoint],
                        isActive: false,
                        isComplete: true
                    });
                    setActiveDrag(null);
                    return;
                }
            }

            // Only add point if moved enough distance (smoothing)
            if (!lastPoint || Math.hypot(world.x - lastPoint.x, world.y - lastPoint.y) > 5) {
                onPathDrawingModeChange({
                    ...pathDrawingMode,
                    points: [...pathDrawingMode.points, world]
                });
            }
            return;
        }

        if (!activeDrag) return;

        const currentWorld = screenToWorld(e.clientX, e.clientY);

        if (activeDrag.type === 'item') {
            const dx = currentWorld.x - activeDrag.mouseStartWorld.x;
            const dy = currentWorld.y - activeDrag.mouseStartWorld.y;

            activeDrag.items.forEach(dragItem => {
                let newX = dragItem.startX + dx;
                let newY = dragItem.startY + dy;

                // Apply snap to grid if enabled
                if (settings.snapToGrid && settings.gridSize) {
                    newX = Math.round(newX / settings.gridSize) * settings.gridSize;
                    newY = Math.round(newY / settings.gridSize) * settings.gridSize;
                }

                onUpdateItem(dragItem.id, {
                    x: newX,
                    y: newY
                });
            });
        } else if (activeDrag.type === 'box') {
            setActiveDrag(prev => ({ ...prev, currentWorld }));

            const x1 = Math.min(activeDrag.startWorld.x, currentWorld.x);
            const x2 = Math.max(activeDrag.startWorld.x, currentWorld.x);
            const y1 = Math.min(activeDrag.startWorld.y, currentWorld.y);
            const y2 = Math.max(activeDrag.startWorld.y, currentWorld.y);

            const newSelection = new Set(activeDrag.initialSelection);

            visibleItems.forEach(item => {
                const pos = getItemPosition(item);
                if (
                    pos.x >= x1 && pos.x <= x2 &&
                    pos.y >= y1 && pos.y <= y2
                ) {
                    newSelection.add(item.id);
                }
            });
            onSelectionChange(newSelection);
        }
    };

    const handleMouseUp = () => {
        setIsPanning(false);
        setActiveDrag(null);
        setRotatingItem(null);
    };

    // Right-click context menu handler
    const handleContextMenu = (e) => {
        e.preventDefault();
        if (drawingMode || pathDrawingMode) return;

        const world = screenToWorld(e.clientX, e.clientY);
        setContextMenu({
            screenX: e.clientX,
            screenY: e.clientY,
            worldX: world.x,
            worldY: world.y
        });
    };

    // Add item from context menu
    const addItemFromContextMenu = (type) => {
        if (!contextMenu) return;
        onAddItem(type, contextMenu.worldX, contextMenu.worldY);
        setContextMenu(null);
    };

    // Close context menu on click elsewhere
    React.useEffect(() => {
        const handleClick = () => {
            setContextMenu(null);
            setShowObjectSubmenu(false);
            setShowDroneSubmenu(false);
        };
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                setContextMenu(null);
                setShowObjectSubmenu(false);
                setShowDroneSubmenu(false);
            }
        };
        if (contextMenu) {
            window.addEventListener('click', handleClick);
            window.addEventListener('keydown', handleEscape);
        }
        return () => {
            window.removeEventListener('click', handleClick);
            window.removeEventListener('keydown', handleEscape);
        };
    }, [contextMenu]);

    React.useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code === 'Space' && !drawingMode) {
                e.preventDefault();
                e.spaceKey = true;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [drawingMode]);

    // Global drag handlers
    React.useEffect(() => {
        if (!activeDrag && !isPanning && !rotatingItem) return;

        const onMouseMove = (e) => handleMouseMove(e);
        const onMouseUp = (e) => handleMouseUp(e);

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [activeDrag, viewport, items, drawingMode, pathDrawingMode, rotatingItem, isPanning, panStart]); // Add dependencies needed by handlers

    return (
        <div
            ref={(el) => {
                playgroundRef.current = el;
                if (containerRef) containerRef.current = el;
            }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onMouseDown={handleBackgroundMouseDown}
            onDoubleClick={handleDoubleClick}
            onWheel={handleWheel}
            onContextMenu={handleContextMenu}
            className="w-full h-full relative bg-gray-900 border border-gray-700 rounded-lg overflow-hidden select-none"
            tabIndex={0}
            style={{ outline: 'none', backgroundColor: 'var(--bg-primary)' }}
        >
            <div
                ref={contentRef}
                style={{
                    position: 'absolute',
                    // Large size to cover all visible areas including negative coordinates
                    top: -5000,
                    left: -5000,
                    width: 10000,
                    height: 10000,
                    transform: `translate(${viewport.offsetX}px, ${viewport.offsetY}px) scale(${viewport.zoom})`,
                    transformOrigin: '5000px 5000px',
                    backgroundImage: settings.showGrid !== false ? 'radial-gradient(var(--grid-color, rgba(255, 255, 255, 0.15)) 1px, transparent 1px)' : 'none',
                    backgroundSize: `${settings.gridSize || 20}px ${settings.gridSize || 20}px`,
                    // Grid dots appear at world coordinates 0, gridSize, gridSize*2, etc.
                    backgroundPosition: '5000px 5000px'
                }}
            >
                {/* World origin wrapper - positioned at center of 10000x10000 grid */}
                <div style={{
                    position: 'absolute',
                    left: 5000,
                    top: 5000,
                    width: 0,
                    height: 0
                }}>
                    {/* Hitbox Visualization */}
                    {showHitboxes && hitboxes.length > 0 && (
                        <svg style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: 1,
                            height: 1,
                            pointerEvents: 'none',
                            overflow: 'visible',
                            zIndex: 50
                        }}>
                            {hitboxes.map(hb => {
                                const color = hb.entityType === 'drone' ? '#ef4444' : '#3b82f6';
                                if (hb.type === 'circle') {
                                    return (
                                        <circle
                                            key={hb.id}
                                            cx={hb.x}
                                            cy={hb.y}
                                            r={hb.radius}
                                            fill="none"
                                            stroke={color}
                                            strokeWidth={2}
                                            strokeDasharray="4 2"
                                            opacity={0.8}
                                        />
                                    );
                                } else {
                                    // Rectangle hitbox
                                    return (
                                        <rect
                                            key={hb.id}
                                            x={hb.x - hb.width / 2}
                                            y={hb.y - hb.height / 2}
                                            width={hb.width}
                                            height={hb.height}
                                            fill="none"
                                            stroke={color}
                                            strokeWidth={2}
                                            strokeDasharray="4 2"
                                            opacity={0.8}
                                            transform={`rotate(${hb.rotation || 0} ${hb.x} ${hb.y})`}
                                        />
                                    );
                                }
                            })}
                        </svg>
                    )}

                    {/* Force Vectors Visualization */}
                    {showForceVectors && (
                        <svg style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: 1,
                            height: 1,
                            pointerEvents: 'none',
                            overflow: 'visible',
                            opacity: 0.7,
                            zIndex: 10
                        }}>
                            {visibleItems.filter(item => item.type === 'drone').map(drone => {
                                const pos = getItemPosition(drone);

                                // 1. Attraction Force (Green) - towards target
                                let attrVector = { x: 0, y: 0 };
                                let targetPos = null;

                                if (isSimulating && states.length > 1) {
                                    const currentIndex = states.findIndex(s => s.id === currentStateId);
                                    const nextIndex = (currentIndex + 1) % states.length; // Loop or clamp handled in loop
                                    const nextStateId = states[nextIndex]?.id;
                                    if (nextStateId && drone.statePositions?.[nextStateId]) {
                                        targetPos = drone.statePositions[nextStateId];
                                    }
                                } else if (drone.lockedToObject) {
                                    // If locked to object, target is the formation slot
                                    const parent = items.find(i => i.id === drone.lockedToObject);
                                    if (parent) {
                                        const parentPos = getItemPosition(parent);
                                        if (drone.relativeOffset) {
                                            const angle = (parentPos.rotation || 0) * Math.PI / 180;
                                            const off = drone.relativeOffset;
                                            targetPos = {
                                                x: parentPos.x + (off.x * Math.cos(angle) - off.y * Math.sin(angle)),
                                                y: parentPos.y + (off.x * Math.sin(angle) + off.y * Math.cos(angle))
                                            };
                                        }
                                    }
                                }

                                if (targetPos) {
                                    const dx = targetPos.x - pos.x;
                                    const dy = targetPos.y - pos.y;
                                    const dist = Math.hypot(dx, dy);
                                    if (dist > 1) {
                                        // Normalize and scale for visualization (max 50px length)
                                        const len = Math.min(dist, 50);
                                        attrVector = { x: (dx / dist) * len, y: (dy / dist) * len };
                                    }
                                }

                                // 2. Repulsion Force (Red) - away from obstacles
                                let repVector = { x: 0, y: 0 };
                                items.filter(i => i.type !== 'drone' && i.id !== drone.lockedToObject).forEach(obs => {
                                    const obsPos = getItemPosition(obs);
                                    const dx = pos.x - obsPos.x;
                                    const dy = pos.y - obsPos.y;
                                    const dist = Math.hypot(dx, dy);
                                    const safeDist = (obs.radius || Math.max(obs.w || 0, obs.h || 0) / 2) + 30; // approx radius + buffer

                                    if (dist < safeDist && dist > 0) {
                                        const strength = (safeDist - dist) / safeDist; // 0 to 1
                                        const len = strength * 50;
                                        repVector.x += (dx / dist) * len;
                                        repVector.y += (dy / dist) * len;
                                    }
                                });

                                // 3. Resultant (Blue)
                                const resVector = {
                                    x: attrVector.x + repVector.x,
                                    y: attrVector.y + repVector.y
                                };

                                return (
                                    <g key={drone.id}>
                                        {/* Attraction */}
                                        {Math.hypot(attrVector.x, attrVector.y) > 1 && (
                                            <line
                                                x1={pos.x} y1={pos.y}
                                                x2={pos.x + attrVector.x} y2={pos.y + attrVector.y}
                                                stroke="#10b981" strokeWidth={2} strokeOpacity={0.8}
                                            />
                                        )}
                                        {/* Repulsion */}
                                        {Math.hypot(repVector.x, repVector.y) > 1 && (
                                            <line
                                                x1={pos.x} y1={pos.y}
                                                x2={pos.x + repVector.x} y2={pos.y + repVector.y}
                                                stroke="#ef4444" strokeWidth={2} strokeOpacity={0.8}
                                            />
                                        )}
                                        {/* Resultant */}
                                        {Math.hypot(resVector.x, resVector.y) > 1 && (
                                            <line
                                                x1={pos.x} y1={pos.y}
                                                x2={pos.x + resVector.x} y2={pos.y + resVector.y}
                                                stroke="#3b82f6" strokeWidth={1} strokeDasharray="4 2"
                                            />
                                        )}
                                    </g>
                                );
                            })}
                        </svg>
                    )}

                    {/* Path Tracking Lines */}
                    {showPathTracking && states && states.length > 1 && (
                        <svg style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: 1,
                            height: 1,
                            pointerEvents: 'none',
                            overflow: 'visible'
                        }}>
                            {visibleItems.filter(item => item.type !== 'drone').map((item, idx) => {
                                // Generate color for this object
                                const hue = (idx * 137.5) % 360; // Golden angle for color distribution
                                const pathColor = `hsl(${hue}, 70%, 60%)`;

                                // Get active states for this item in order
                                const activeStates = states.filter(state => item.activeStates?.includes(state.id));

                                if (activeStates.length < 2) return null;

                                // Build path segments, using custom paths when available
                                const pathSegments = [];
                                for (let i = 0; i < activeStates.length - 1; i++) {
                                    const fromState = activeStates[i];
                                    const toState = activeStates[i + 1];
                                    const pathKey = `${fromState.id}_to_${toState.id}`;
                                    const customPath = item.customTransitionPaths?.[pathKey];

                                    if (customPath && customPath.length > 1) {
                                        // Use custom path points
                                        pathSegments.push(...customPath.map((p, j) => ({
                                            x: p.x,
                                            y: p.y,
                                            isFirst: i === 0 && j === 0
                                        })));
                                    } else {
                                        // Use straight line between states
                                        const fromPos = item.statePositions?.[fromState.id];
                                        const toPos = item.statePositions?.[toState.id];
                                        if (fromPos && toPos) {
                                            if (i === 0) {
                                                pathSegments.push({ x: fromPos.x, y: fromPos.y, isFirst: true });
                                            }
                                            pathSegments.push({ x: toPos.x, y: toPos.y, isFirst: false });
                                        }
                                    }
                                }

                                if (pathSegments.length < 2) return null;

                                // Create SVG path
                                const pathData = pathSegments.map((p, i) =>
                                    `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
                                ).join(' ');

                                return (
                                    <path
                                        key={item.id}
                                        d={pathData}
                                        stroke={pathColor}
                                        strokeWidth="2"
                                        strokeDasharray="5,5"
                                        fill="none"
                                        opacity="0.6"
                                    />
                                );
                            })}
                        </svg>
                    )}

                    {/* Drone Path Tracking Lines */}
                    {showDronePaths && states && states.length > 1 && (
                        <svg style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: 1,
                            height: 1,
                            pointerEvents: 'none',
                            overflow: 'visible'
                        }}>
                            {visibleItems.filter(item => item.type === 'drone').map((item) => {
                                const droneColor = item.droneType === 'air' ? '#60a5fa' : '#8b5cf6';

                                // Get active states for this drone in order
                                const activeStates = states.filter(state => item.activeStates?.includes(state.id));

                                if (activeStates.length < 2) return null;

                                // Check if drone is locked to an object
                                const parentObject = item.lockedToObject ? items.find(i => i.id === item.lockedToObject) : null;
                                const offset = item.relativeOffset || { x: 0, y: 0 };

                                // Build path segments
                                const pathSegments = [];
                                for (let i = 0; i < activeStates.length - 1; i++) {
                                    const fromState = activeStates[i];
                                    const toState = activeStates[i + 1];

                                    // First check if drone has its own customPath for this transition
                                    const toStatePos = item.statePositions?.[toState.id];
                                    const droneCustomPath = toStatePos?.customPath;

                                    // Use drone's own path if it has one (e.g., initial lock-on path)
                                    if (droneCustomPath && droneCustomPath.length > 1) {
                                        pathSegments.push(...droneCustomPath.map((p, j) => ({
                                            x: p.x,
                                            y: p.y,
                                            isFirst: i === 0 && j === 0
                                        })));
                                    } else if (parentObject) {
                                        // If locked to object and no drone path, use object's path with offset
                                        const pathKey = `${fromState.id}_to_${toState.id}`;
                                        const objectPath = parentObject.customTransitionPaths?.[pathKey];

                                        if (objectPath && objectPath.length > 1) {
                                            // Apply drone offset to each point on object's path
                                            pathSegments.push(...objectPath.map((p, j) => {
                                                const parentRot = parentObject.statePositions?.[fromState.id]?.rotation || 0;
                                                const angleRad = parentRot * (Math.PI / 180);
                                                const rotatedX = offset.x * Math.cos(angleRad) - offset.y * Math.sin(angleRad);
                                                const rotatedY = offset.x * Math.sin(angleRad) + offset.y * Math.cos(angleRad);
                                                return {
                                                    x: p.x + rotatedX,
                                                    y: p.y + rotatedY,
                                                    isFirst: i === 0 && j === 0
                                                };
                                            }));
                                        } else {
                                            // Object has no custom path, use straight line with offset
                                            const fromObjPos = parentObject.statePositions?.[fromState.id];
                                            const toObjPos = parentObject.statePositions?.[toState.id];
                                            if (fromObjPos && toObjPos) {
                                                const fromAngle = (fromObjPos.rotation || 0) * (Math.PI / 180);
                                                const toAngle = (toObjPos.rotation || 0) * (Math.PI / 180);
                                                if (i === 0) {
                                                    pathSegments.push({
                                                        x: fromObjPos.x + offset.x * Math.cos(fromAngle) - offset.y * Math.sin(fromAngle),
                                                        y: fromObjPos.y + offset.x * Math.sin(fromAngle) + offset.y * Math.cos(fromAngle),
                                                        isFirst: true
                                                    });
                                                }
                                                pathSegments.push({
                                                    x: toObjPos.x + offset.x * Math.cos(toAngle) - offset.y * Math.sin(toAngle),
                                                    y: toObjPos.y + offset.x * Math.sin(toAngle) + offset.y * Math.cos(toAngle),
                                                    isFirst: false
                                                });
                                            }
                                        }
                                    } else {
                                        // Not locked - use drone's own customPath
                                        const toStatePos = item.statePositions?.[toState.id];
                                        const customPath = toStatePos?.customPath;

                                        if (customPath && customPath.length > 1) {
                                            pathSegments.push(...customPath.map((p, j) => ({
                                                x: p.x,
                                                y: p.y,
                                                isFirst: i === 0 && j === 0
                                            })));
                                        } else {
                                            const fromPos = item.statePositions?.[fromState.id];
                                            const toPos = item.statePositions?.[toState.id];
                                            if (fromPos && toPos) {
                                                if (i === 0) {
                                                    pathSegments.push({ x: fromPos.x, y: fromPos.y, isFirst: true });
                                                }
                                                pathSegments.push({ x: toPos.x, y: toPos.y, isFirst: false });
                                            }
                                        }
                                    }
                                }

                                if (pathSegments.length < 2) return null;

                                // Create SVG path
                                const pathData = pathSegments.map((p, i) =>
                                    `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
                                ).join(' ');

                                // Check for collisions
                                const collisions = [];

                                // Prepare obstacles (objects that are not drones and not the locked object)
                                const obstacles = visibleItems.filter(obj =>
                                    obj.type !== 'drone' &&
                                    obj.id !== item.lockedToObject
                                ).map(o => {
                                    // Find state ID for position check - use current state or next state from segments
                                    // For simplicity, we check against the obstacles' position in the states traversed
                                    // Here we just check against obstacle position in the 'from' states of the segments
                                    return {
                                        ...o,
                                        // Hack: passing the full object allows isPointInObstacle to look up statePositions
                                        // But we need to know WHICH state. We'll simplify: check against obstacle pos in the FROM state of segment
                                    };
                                });

                                // Check each segment against obstacles
                                let segmentIndex = 0;
                                for (let i = 0; i < activeStates.length - 1; i++) {
                                    const fromState = activeStates[i];
                                    // We only check collisions if we have a valid segment
                                    // pathSegments is flattened, so we need to track where we are
                                    // Simplified approach: Check every segment in the flattened list
                                    // This assumes obstacles don't move drastically between states or we check against a "representative" state

                                    const obsInState = obstacles.map(o => ({ ...o, _checkStateId: fromState.id }));

                                    // How many points in this transition?
                                    const toState = activeStates[i + 1];
                                    const customPath = item.statePositions?.[toState.id]?.customPath;
                                    const count = (customPath && customPath.length > 1) ? customPath.length : 2; // 2 for straight line

                                    for (let k = 0; k < count - 1; k++) {
                                        const p1 = pathSegments[segmentIndex + k];
                                        const p2 = pathSegments[segmentIndex + k + 1];
                                        if (!p1 || !p2) continue;

                                        obsInState.forEach(obs => {
                                            // Get drone's altitude at this segment (interpolate between states)
                                            const fromStatePos = item.statePositions?.[fromState.id];
                                            const toStatePos = item.statePositions?.[toState.id];
                                            const droneZ = Math.min(fromStatePos?.z || 0, toStatePos?.z || 0);

                                            // Get obstacle height (default 100 if not specified)
                                            const obstacleHeight = obs.height || 100;

                                            // Only check collision if drone altitude is below obstacle height
                                            // Air drones flying above obstacles won't collide
                                            if (droneZ < obstacleHeight) {
                                                if (lineIntersectsObstacle(p1, p2, obs, 5)) {
                                                    collisions.push({
                                                        x: (p1.x + p2.x) / 2,
                                                        y: (p1.y + p2.y) / 2
                                                    });
                                                }
                                            }
                                        });
                                    }
                                    segmentIndex += count; // This offset might be slightly off if we push isFirst logic, but close enough for viz
                                }

                                return (
                                    <g key={item.id}>
                                        <path
                                            d={pathData}
                                            stroke={droneColor}
                                            strokeWidth="2"
                                            strokeDasharray="3,3"
                                            fill="none"
                                            opacity="0.7"
                                        />
                                        {collisions.map((col, idx) => (
                                            <g key={`col-${idx}`} transform={`translate(${col.x}, ${col.y})`}>
                                                <circle r="8" fill="#ef4444" stroke="white" strokeWidth="1" />
                                                <text
                                                    textAnchor="middle"
                                                    dy="3"
                                                    fill="white"
                                                    fontSize="10"
                                                    fontWeight="bold"
                                                    style={{ pointerEvents: 'none' }}
                                                >!</text>
                                            </g>
                                        ))}
                                    </g>
                                );
                            })}
                        </svg>
                    )}

                    {visibleItems
                        .filter(item => !(pathDrawingMode && item.id === pathDrawingMode.objectId)) // Hide object being drawn
                        .map(item => {
                            const pos = getItemPosition(item);
                            return (
                                <div
                                    key={item.id}
                                    style={{
                                        position: 'absolute',
                                        left: pos.x,
                                        top: pos.y,
                                        transform: `translate(-50%, -50%) rotate(${pos.rotation || 0}deg) ${show3DMode ? `scale(${1 + (pos.z || 0) / 500})` : ''}`,
                                        zIndex: (selectedIds.has(item.id) ? 10 : 1) + Math.floor(pos.z || 0),
                                        transition: isSimulating ? 'none' : 'transform 0.1s'
                                    }}
                                    onMouseDown={(e) => handleItemMouseDown(e, item)}
                                >
                                    {item.type === 'drone' ? (
                                        <Drone
                                            selected={selectedIds.has(item.id)}
                                            dragging={activeDrag?.type === 'item' && selectedIds.has(item.id)}
                                            droneType={item.droneType}
                                            isInFormation={!!item.assignedObject}
                                        />
                                    ) : (
                                        <SimulationObject
                                            data={item}
                                            selected={selectedIds.has(item.id)}
                                            dragging={activeDrag?.type === 'item' && selectedIds.has(item.id)}
                                            onResizeMouseDown={handleResizeMouseDown}
                                            showLabels={settings.showObjectLabels !== false}
                                        />
                                    )}

                                    {/* Flying Indicator - 2D mode (show glow and altitude when drone is flying) */}
                                    {!show3DMode && item.type === 'drone' && (pos.z || 0) > 0 && (
                                        <>
                                            {/* Glow effect for flying drones */}
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    top: '50%',
                                                    left: '50%',
                                                    width: '30px',
                                                    height: '30px',
                                                    background: item.droneType === 'air' ? 'rgba(96, 165, 250, 0.4)' : 'rgba(139, 92, 246, 0.4)',
                                                    borderRadius: '50%',
                                                    transform: 'translate(-50%, -50%)',
                                                    filter: 'blur(8px)',
                                                    zIndex: -1,
                                                    pointerEvents: 'none',
                                                    animation: 'pulse 1.5s infinite'
                                                }}
                                            />
                                            {/* Altitude badge */}
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    bottom: '-20px',
                                                    left: '50%',
                                                    transform: 'translateX(-50%)',
                                                    background: item.droneType === 'air' ? '#60a5fa' : '#8b5cf6',
                                                    color: 'white',
                                                    fontSize: '9px',
                                                    fontWeight: 700,
                                                    padding: '1px 4px',
                                                    borderRadius: '3px',
                                                    whiteSpace: 'nowrap',
                                                    zIndex: 100,
                                                    pointerEvents: 'none'
                                                }}
                                            >
                                                Z:{Math.round(pos.z)}
                                            </div>
                                        </>
                                    )}

                                    {/* Shadow for 3D Mode */}
                                    {show3DMode && (pos.z > 0) && (
                                        <div
                                            style={{
                                                position: 'absolute',
                                                top: '50%',
                                                left: '50%',
                                                width: '100%',
                                                height: '100%',
                                                background: 'rgba(0,0,0,0.5)',
                                                borderRadius: item.type === 'circle' || item.type === 'drone' ? '50%' : '4px',
                                                transform: `translate(-50%, -50%) scale(${1 - Math.min(pos.z / 1000, 0.5)})`,
                                                filter: `blur(${Math.min(pos.z / 5, 20)}px)`,
                                                zIndex: -1,
                                                pointerEvents: 'none'
                                            }}
                                        />
                                    )}


                                    {/* Delete Button - Top Left of shape */}
                                    {
                                        selectedIds.has(item.id) && selectedIds.size === 1 && (() => {
                                            const w = item.w || (item.radius ? item.radius * 2 : 100);
                                            const h = item.h || (item.radius ? item.radius * 2 : 100);
                                            return (
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (onDeleteItem) onDeleteItem(item.id);
                                                    }}
                                                    style={{
                                                        position: 'absolute',
                                                        top: `${-h / 2 - 12}px`,
                                                        left: `${-w / 2 - 12}px`,
                                                        width: '24px',
                                                        height: '24px',
                                                        borderRadius: '50%',
                                                        background: '#ef4444',
                                                        border: '2px solid white',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                                                        fontSize: '14px',
                                                        color: 'white',
                                                        fontWeight: 'bold',
                                                        transform: `rotate(-${pos.rotation || 0}deg)`,
                                                        zIndex: 100
                                                    }}
                                                    title="Delete"
                                                >
                                                    ✕
                                                </div>
                                            );
                                        })()
                                    }

                                    {/* Rotation Handle - Top Right of shape */}
                                    {
                                        selectedIds.has(item.id) && selectedIds.size === 1 && (() => {
                                            const w = item.w || (item.radius ? item.radius * 2 : 100);
                                            const h = item.h || (item.radius ? item.radius * 2 : 100);
                                            return (
                                                <div
                                                    onMouseDown={(e) => {
                                                        e.stopPropagation();
                                                        setRotatingItem(item.id);
                                                    }}
                                                    style={{
                                                        position: 'absolute',
                                                        top: `${-h / 2 - 12}px`,
                                                        right: `${-w / 2 - 12}px`,
                                                        width: '24px',
                                                        height: '24px',
                                                        borderRadius: '50%',
                                                        background: 'var(--accent-color)',
                                                        border: '2px solid white',
                                                        cursor: 'grab',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                                                        fontSize: '12px',
                                                        color: 'white',
                                                        fontWeight: 'bold',
                                                        transform: `rotate(-${pos.rotation || 0}deg)`,
                                                        zIndex: 100
                                                    }}
                                                    title="Drag to rotate"
                                                >
                                                    ↻
                                                </div>
                                            );
                                        })()
                                    }
                                </div>
                            );
                        })}

                    {/* Multi-Selection Bounding Box */}
                    {selectedIds.size > 1 && (() => {
                        const selectedItems = visibleItems.filter(item => selectedIds.has(item.id));
                        if (selectedItems.length < 2) return null;

                        // Calculate bounding box
                        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                        selectedItems.forEach(item => {
                            const pos = getItemPosition(item);
                            const w = item.w || (item.radius ? item.radius * 2 : 100);
                            const h = item.h || (item.radius ? item.radius * 2 : 100);
                            minX = Math.min(minX, pos.x - w / 2);
                            minY = Math.min(minY, pos.y - h / 2);
                            maxX = Math.max(maxX, pos.x + w / 2);
                            maxY = Math.max(maxY, pos.y + h / 2);
                        });

                        const boxWidth = maxX - minX;
                        const boxHeight = maxY - minY;
                        const centerX = (minX + maxX) / 2;
                        const centerY = (minY + maxY) / 2;

                        return (
                            <div style={{
                                position: 'absolute',
                                left: minX,
                                top: minY,
                                width: boxWidth,
                                height: boxHeight,
                                border: '2px dashed var(--accent-color)',
                                backgroundColor: 'rgba(99, 102, 241, 0.05)',
                                pointerEvents: 'none',
                                zIndex: 99
                            }}>
                                {/* Delete all selected */}
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        selectedIds.forEach(id => {
                                            if (onDeleteItem) onDeleteItem(id);
                                        });
                                    }}
                                    style={{
                                        position: 'absolute',
                                        top: '-12px',
                                        left: '-12px',
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        background: '#ef4444',
                                        border: '2px solid white',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                                        fontSize: '14px',
                                        color: 'white',
                                        fontWeight: 'bold',
                                        pointerEvents: 'auto',
                                        zIndex: 101
                                    }}
                                    title={`Delete ${selectedIds.size} items`}
                                >
                                    ✕
                                </div>
                                {/* Selection count badge */}
                                <div style={{
                                    position: 'absolute',
                                    top: '-12px',
                                    right: '-12px',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    background: 'var(--accent-color)',
                                    color: 'white',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    pointerEvents: 'none'
                                }}>
                                    {selectedIds.size} selected
                                </div>
                            </div>
                        );
                    })()}

                    {activeDrag?.type === 'box' && (
                        <div style={{
                            position: 'absolute',
                            left: Math.min(activeDrag.startWorld.x, activeDrag.currentWorld.x),
                            top: Math.min(activeDrag.startWorld.y, activeDrag.currentWorld.y),
                            width: Math.abs(activeDrag.currentWorld.x - activeDrag.startWorld.x),
                            height: Math.abs(activeDrag.currentWorld.y - activeDrag.startWorld.y),
                            backgroundColor: 'rgba(99, 102, 241, 0.2)',
                            border: '1px solid var(--accent-color)',
                            pointerEvents: 'none',
                            zIndex: 100
                        }} />
                    )}

                    {drawingMode && drawingMode.points.length > 0 && (
                        <svg style={{ position: 'absolute', top: 0, left: 0, width: 1, height: 1, overflow: 'visible', pointerEvents: 'none', zIndex: 200 }}>
                            <polyline
                                points={drawingMode.points.map(p => `${p.x},${p.y}`).join(' ')}
                                fill="none"
                                stroke="#4ade80"
                                strokeWidth="2"
                                strokeDasharray="5,5"
                            />
                            {drawingMode.points.map((p, i) => (
                                <circle key={i} cx={p.x} cy={p.y} r="4" fill="#4ade80" />
                            ))}
                        </svg>
                    )}

                    {/* Path Drawing Preview */}
                    {/* Path Drawing Preview */}
                    {pathDrawingMode && (
                        <svg style={{ position: 'absolute', top: 0, left: 0, width: 1, height: 1, overflow: 'visible', pointerEvents: 'none', zIndex: 200 }}>
                            {/* Start Point (Green) */}
                            <circle
                                cx={pathDrawingMode.points[0].x}
                                cy={pathDrawingMode.points[0].y}
                                r="15"
                                fill="#10b981"
                                opacity="0.3"
                            />
                            <circle
                                cx={pathDrawingMode.points[0].x}
                                cy={pathDrawingMode.points[0].y}
                                r="6"
                                fill="#10b981"
                                stroke="white"
                                strokeWidth="2"
                            />

                            {/* End Point (Red) */}
                            {pathDrawingMode.endPoint && (
                                <>
                                    <circle
                                        cx={pathDrawingMode.endPoint.x}
                                        cy={pathDrawingMode.endPoint.y}
                                        r="15"
                                        fill="#ef4444"
                                        opacity="0.3"
                                    />
                                    <circle
                                        cx={pathDrawingMode.endPoint.x}
                                        cy={pathDrawingMode.endPoint.y}
                                        r="6"
                                        fill="#ef4444"
                                        stroke="white"
                                        strokeWidth="2"
                                    />
                                </>
                            )}

                            {/* Drawn Path */}
                            {pathDrawingMode.points.length > 1 && (
                                <>
                                    <path
                                        d={pathDrawingMode.points.map((p, i) =>
                                            `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
                                        ).join(' ')}
                                        fill="none"
                                        stroke="#f59e0b"
                                        strokeWidth="3"
                                        opacity="0.9"
                                    />
                                    {pathDrawingMode.points.slice(1).map((p, i) => (
                                        <circle
                                            key={i}
                                            cx={p.x}
                                            cy={p.y}
                                            r="2"
                                            fill="#f59e0b"
                                        />
                                    ))}
                                </>
                            )}
                        </svg>
                    )}
                </div>
                {/* End of world origin wrapper */}

                {
                    visibleItems.length === 0 && !drawingMode && (
                        <div style={{
                            position: 'absolute',
                            top: '50%', left: '50%',
                            transform: 'translate(-50%, -50%)',
                            color: 'var(--text-secondary)',
                            pointerEvents: 'none',
                            textAlign: 'center'
                        }}>
                            <p>Drag items from the sidebar to start</p>
                            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Scroll to zoom • Drag to select • Shift+Drag to pan</p>
                        </div>
                    )
                }

            </div>

            {/* Right-click Context Menu */}
            {contextMenu && (
                <div
                    style={{
                        position: 'fixed',
                        left: contextMenu.screenX,
                        top: contextMenu.screenY,
                        background: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(148, 163, 184, 0.3)',
                        borderRadius: '8px',
                        padding: '8px 0',
                        minWidth: '160px',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
                        zIndex: 1000
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div style={{ padding: '4px 12px', fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Add at ({Math.round(contextMenu.worldX)}, {Math.round(contextMenu.worldY)})
                    </div>
                    <div style={{ height: '1px', background: 'rgba(148, 163, 184, 0.2)', margin: '4px 0' }} />

                    {/* Add Drone - with sidebar submenu */}
                    <div
                        style={{ position: 'relative' }}
                        onMouseEnter={() => setShowDroneSubmenu(true)}
                        onMouseLeave={() => setShowDroneSubmenu(false)}
                    >
                        <button
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                background: showDroneSubmenu ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                                border: 'none',
                                color: '#e2e8f0',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '0.85rem'
                            }}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: '#60a5fa' }}>+</span> Add Drone
                            </span>
                            <span style={{ color: '#94a3b8' }}>▶</span>
                        </button>

                        {/* Drone Submenu */}
                        {showDroneSubmenu && (
                            <div style={{
                                position: 'absolute',
                                left: '100%',
                                top: 0,
                                marginLeft: '4px',
                                background: 'rgba(15, 23, 42, 0.95)',
                                border: '1px solid rgba(148, 163, 184, 0.3)',
                                borderRadius: '8px',
                                padding: '4px 0',
                                minWidth: '150px',
                                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
                            }}>
                                <button
                                    onClick={() => addItemFromContextMenu('drone-air')}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#e2e8f0',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        fontSize: '0.85rem',
                                        textAlign: 'left'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
                                        <path d="M12 2L4 8v12h16V8l-8-6z" />
                                        <path d="M12 22V12" />
                                        <path d="M4 8l8 4 8-4" />
                                    </svg>
                                    Air Drone
                                </button>
                                <button
                                    onClick={() => addItemFromContextMenu('drone-ground')}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#e2e8f0',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        fontSize: '0.85rem',
                                        textAlign: 'left'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                                        <rect x="2" y="6" width="20" height="12" rx="2" />
                                        <circle cx="6" cy="18" r="2" />
                                        <circle cx="18" cy="18" r="2" />
                                    </svg>
                                    Ground Drone
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Add Object - with sidebar submenu */}
                    <div
                        style={{ position: 'relative' }}
                        onMouseEnter={() => setShowObjectSubmenu(true)}
                        onMouseLeave={() => setShowObjectSubmenu(false)}
                    >
                        <button
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                background: showObjectSubmenu ? 'rgba(244, 114, 182, 0.2)' : 'transparent',
                                border: 'none',
                                color: '#e2e8f0',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '0.85rem'
                            }}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: '#f472b6' }}>+</span> Add Object
                            </span>
                            <span style={{ color: '#94a3b8' }}>▶</span>
                        </button>

                        {/* Object Submenu */}
                        {showObjectSubmenu && (
                            <div style={{
                                position: 'absolute',
                                left: '100%',
                                top: 0,
                                marginLeft: '4px',
                                background: 'rgba(15, 23, 42, 0.95)',
                                border: '1px solid rgba(148, 163, 184, 0.3)',
                                borderRadius: '8px',
                                padding: '4px 0',
                                minWidth: '140px',
                                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
                            }}>
                                <button
                                    onClick={() => addItemFromContextMenu('rectangle')}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#e2e8f0',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        fontSize: '0.85rem',
                                        textAlign: 'left'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(244, 114, 182, 0.2)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#f472b6" strokeWidth="1.5">
                                        <rect x="1" y="1" width="12" height="12" rx="1" />
                                    </svg>
                                    Rectangle
                                </button>
                                <button
                                    onClick={() => addItemFromContextMenu('circle')}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#e2e8f0',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        fontSize: '0.85rem',
                                        textAlign: 'left'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(244, 114, 182, 0.2)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#f472b6" strokeWidth="1.5">
                                        <circle cx="7" cy="7" r="6" />
                                    </svg>
                                    Circle
                                </button>
                                <button
                                    onClick={() => addItemFromContextMenu('triangle')}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#e2e8f0',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        fontSize: '0.85rem',
                                        textAlign: 'left'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(244, 114, 182, 0.2)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#f472b6" strokeWidth="1.5">
                                        <path d="M7 1L13 13H1L7 1Z" />
                                    </svg>
                                    Triangle
                                </button>
                                <button
                                    onClick={() => addItemFromContextMenu('hexagon')}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#e2e8f0',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        fontSize: '0.85rem',
                                        textAlign: 'left'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(244, 114, 182, 0.2)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#f472b6" strokeWidth="1.5">
                                        <path d="M7 1L12.5 4V10L7 13L1.5 10V4L7 1Z" />
                                    </svg>
                                    Hexagon
                                </button>
                                <button
                                    onClick={() => addItemFromContextMenu('star')}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#e2e8f0',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        fontSize: '0.85rem',
                                        textAlign: 'left'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(244, 114, 182, 0.2)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#f472b6" strokeWidth="1.5">
                                        <path d="M7 1L8.5 5.5H13L9.5 8.5L11 13L7 10L3 13L4.5 8.5L1 5.5H5.5L7 1Z" />
                                    </svg>
                                    Star
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
