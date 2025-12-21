import React, { useRef, useState } from 'react';
import { Drone } from './Drone';
import { SimulationObject } from './SimulationObject';
import { ZoomControls } from './ZoomControls';
import { interpolateAlongPath } from '../utils/pathInterpolation';

export function Playground({
    items, onAddItem, onUpdateItem, selectedIds, onSelectionChange,
    viewport, onViewportChange,
    drawingMode, onDrawingModeChange, onFinishDrawing,
    currentStateId, isSimulating, animationProgress, states, showPathTracking,
    pathDrawingMode, onPathDrawingModeChange, onFinishPathDrawing
}) {
    const playgroundRef = useRef(null);
    const contentRef = useRef(null);
    const [activeDrag, setActiveDrag] = useState(null);
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState(null);
    const [rotatingItem, setRotatingItem] = useState(null);
    const [scrollZoomEnabled, setScrollZoomEnabled] = useState(true);

    // Helper to interpolate values
    const interpolate = (start, end, progress) => {
        return start + (end - start) * progress;
    };

    // Get item position (with interpolation during simulation)
    const getItemPosition = (item) => {
        // Drone locked to object - dynamic position
        if (item.type === 'drone' && item.lockedToObject && isSimulating) {
            const parentObj = items.find(i => i.id === item.lockedToObject);
            if (parentObj) {
                // Recursively get parent's current position (handling custom paths)
                const parentPos = getItemPosition(parentObj);
                const offset = item.relativeOffset || { x: 0, y: 0 };

                // Rotate offset based on parent's rotation
                const angleRad = (parentPos.rotation || 0) * (Math.PI / 180);
                const rotatedX = offset.x * Math.cos(angleRad) - offset.y * Math.sin(angleRad);
                const rotatedY = offset.x * Math.sin(angleRad) + offset.y * Math.cos(angleRad);

                return {
                    x: parentPos.x + rotatedX,
                    y: parentPos.y + rotatedY,
                    rotation: 0
                };
            }
        }

        // Regular item positioning
        if (!isSimulating || !item.statePositions) {
            return item.statePositions?.[currentStateId] || { x: 0, y: 0, rotation: 0 };
        }

        const currentStateIndex = states.findIndex(s => s.id === currentStateId);
        const nextStateIndex = (currentStateIndex + 1) % states.length;

        const currentPos = item.statePositions[states[currentStateIndex].id];
        const nextPos = item.statePositions[states[nextStateIndex].id];

        if (!currentPos || !nextPos) {
            return currentPos || nextPos || { x: 0, y: 0, rotation: 0 };
        }

        // Check for custom transition path
        const pathKey = `${states[currentStateIndex].id}_to_${states[nextStateIndex].id}`;
        const customPath = item.customTransitionPaths?.[pathKey];

        if (customPath && customPath.length > 1) {
            // Use custom path interpolation
            return interpolateAlongPath(customPath, animationProgress);
        }

        return {
            x: interpolate(currentPos.x, nextPos.x, animationProgress),
            y: interpolate(currentPos.y, nextPos.y, animationProgress),
            rotation: interpolate(currentPos.rotation || 0, nextPos.rotation || 0, animationProgress)
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
                newSelection = new Set([item.id]);
            } else {
                newSelection.add(item.id);
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

        if (!e.shiftKey) {
            onSelectionChange(new Set());
        }

        const world = screenToWorld(e.clientX, e.clientY);
        setActiveDrag({
            type: 'box',
            startWorld: world,
            currentWorld: world,
            initialSelection: e.shiftKey ? new Set(selectedIds) : new Set()
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
                onUpdateItem(dragItem.id, {
                    x: dragItem.startX + dx,
                    y: dragItem.startY + dy
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
            ref={playgroundRef}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onMouseDown={handleBackgroundMouseDown}
            onDoubleClick={handleDoubleClick}
            onWheel={handleWheel}
            className="w-full h-full relative bg-gray-900 border border-gray-700 rounded-lg overflow-hidden select-none"
            tabIndex={0}
            style={{ outline: 'none' }}
        >
            <div
                ref={contentRef}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    transform: `translate(${viewport.offsetX}px, ${viewport.offsetY}px) scale(${viewport.zoom})`,
                    transformOrigin: '0 0',
                    backgroundImage: 'radial-gradient(var(--bg-tertiary) 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                    backgroundPosition: '0 0'
                }}
            >
                {/* Path Tracking Lines */}
                {showPathTracking && states && states.length > 1 && (
                    <svg style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'none',
                        overflow: 'visible'
                    }}>
                        {visibleItems.filter(item => item.type !== 'drone').map((item, idx) => {
                            // Generate color for this object
                            const hue = (idx * 137.5) % 360; // Golden angle for color distribution
                            const pathColor = `hsl(${hue}, 70%, 60%)`;

                            // Get all state positions for this item
                            const pathPoints = states
                                .filter(state => item.activeStates?.includes(state.id))
                                .map(state => item.statePositions?.[state.id])
                                .filter(pos => pos);

                            if (pathPoints.length < 2) return null;

                            // Create SVG path
                            const pathData = pathPoints.map((pos, i) =>
                                `${i === 0 ? 'M' : 'L'} ${pos.x} ${pos.y}`
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
                                    transform: `translate(-50%, -50%) rotate(${pos.rotation || 0}deg)`,
                                    zIndex: selectedIds.has(item.id) ? 10 : 1
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
                                    />
                                )}

                                {/* Rotation Handle */}
                                {selectedIds.has(item.id) && selectedIds.size === 1 && (
                                    <div
                                        onMouseDown={(e) => {
                                            e.stopPropagation();
                                            setRotatingItem(item.id);
                                        }}
                                        style={{
                                            position: 'absolute',
                                            top: '-30px',
                                            right: '-30px',
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
                                )}
                            </div>
                        );
                    })}

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
                    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 200 }}>
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
                    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 200 }}>
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

            {visibleItems.length === 0 && !drawingMode && (
                <div style={{
                    position: 'absolute',
                    top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: 'var(--text-secondary)',
                    pointerEvents: 'none',
                    textAlign: 'center'
                }}>
                    <p>Drag items from the sidebar to start</p>
                    <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Scroll to zoom • Drag to pan • Shift+Drag to select</p>
                </div>
            )}

            <ZoomControls
                viewport={viewport}
                onViewportChange={onViewportChange}
                scrollZoomEnabled={scrollZoomEnabled}
                onToggleScrollZoom={() => setScrollZoomEnabled(prev => !prev)}
            />
        </div>
    );
}
