import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Scene3D } from './Scene3D';
import { Drone3D } from './Drone3D';
import { Object3D } from './Object3D';
import { interpolateAlongPath, EASING_FUNCTIONS as PATH_EASING } from '../utils/pathInterpolation';

// Helper to interpolate values
const interpolate = (start, end, progress) => start + (end - start) * progress;

// Easing functions
const EASING_FUNCTIONS = {
    linear: t => t,
    easeInQuad: t => t * t,
    easeOutQuad: t => t * (2 - t),
    easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1
};

function SceneContent({
    items,
    selectedIds,
    onSelectionChange,
    currentStateId,
    isSimulating,
    animationProgress,
    states,
    showPathTracking,
    showDronePaths,
    settings,
    onUpdateItem,
    onAddItem,
    onDeleteItem,
    drawingMode,
    onDrawingModeChange,
    onFinishDrawing,
    onDragStateChange
}) {
    const { camera, raycaster, pointer, gl } = useThree();
    const groundRef = useRef();
    const [draggedItem, setDraggedItem] = useState(null);
    const [contextMenu, setContextMenu] = useState(null); // { x, y, worldPos }
    const [showObjectSubmenu, setShowObjectSubmenu] = useState(false);
    const [showDroneSubmenu, setShowDroneSubmenu] = useState(false);
    const [zDragMode, setZDragMode] = useState(false); // Shift+Drag for Z-axis
    const [rotationMode, setRotationMode] = useState(false); // R+Drag for rotation
    const [rotationStart, setRotationStart] = useState(null); // Initial pointer position for rotation
    const [scaleMode, setScaleMode] = useState(false); // S+Drag for scaling
    const [scaleStart, setScaleStart] = useState(null); // Initial pointer position and scale for scaling
    const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
    const verticalPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)); // For Z-axis dragging
    const dragOffset = useRef(new THREE.Vector3());

    // Get item position with interpolation during simulation
    const getItemPosition = useCallback((item) => {
        if (!isSimulating || !item.statePositions) {
            const pos = item.statePositions?.[currentStateId] || { x: 0, y: 0, z: 0 };
            // 2D X -> 3D X, 2D Z (altitude) -> 3D Y (up), 2D Y -> 3D Z (forward/down when viewed from above)
            return [pos.x, pos.z || 0, pos.y];
        }

        const currentStateIndex = states.findIndex(s => s.id === currentStateId);
        const nextStateIndex = (currentStateIndex + 1) % states.length;
        const currentState = states[currentStateIndex];
        const nextState = states[nextStateIndex];
        const currentPos = item.statePositions[currentState?.id];
        const nextPos = item.statePositions[nextState?.id];

        if (!currentPos || !nextPos) {
            const pos = currentPos || nextPos || { x: 0, y: 0, z: 0 };
            return [pos.x, pos.z || 0, pos.y];
        }

        // Drone locked to object - follow parent position (same as 2D)
        if (item.type === 'drone' && item.lockedToObject) {
            const parentObj = items.find(i => i.id === item.lockedToObject);
            if (parentObj) {
                // Check if the drone is actually "in formation" in the current state
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
                    // Get parent's interpolated position (recursive call for parent)
                    const parentPos3D = getItemPosition(parentObj);
                    const offset = item.relativeOffset || { x: 0, y: 0, z: 0 };

                    // Need rotation from parent's interpolated state
                    const parentCurrentRot = parentObj.statePositions?.[currentState?.id]?.rotation || 0;
                    const parentNextRot = parentObj.statePositions?.[nextState?.id]?.rotation || 0;
                    const easing = EASING_FUNCTIONS[settings.easing] || EASING_FUNCTIONS.linear;
                    const t = easing(animationProgress);
                    const parentRot = interpolate(parentCurrentRot, parentNextRot, t);

                    const angleRad = parentRot * (Math.PI / 180);
                    const rotatedX = offset.x * Math.cos(angleRad) - offset.y * Math.sin(angleRad);
                    const rotatedY = offset.x * Math.sin(angleRad) + offset.y * Math.cos(angleRad);

                    // Drone Z is from its own state (object top + small offset)
                    const droneZ = interpolate(currentPos.z || 0, nextPos.z || 0, t);

                    // parentPos3D is [x, z, y] in 3D coords
                    return [
                        parentPos3D[0] + rotatedX,
                        droneZ,
                        parentPos3D[2] + rotatedY
                    ];
                }
            }
        }

        // Check for custom path in nextPos (new format) - may have 3D coordinates
        if (nextPos.customPath && nextPos.customPath.length > 1) {
            const result = interpolateAlongPath(nextPos.customPath, animationProgress, settings.easing);
            // Use Z from path if available (3D path), otherwise interpolate between state Z values
            const z = result.z !== undefined
                ? result.z
                : interpolate(currentPos.z || 0, nextPos.z || 0, animationProgress);
            return [result.x, z, result.y];
        }

        // Check for custom transition path (old format)
        if (currentState && nextState) {
            const pathKey = `${currentState.id}_to_${nextState.id}`;
            const customPath = item.customTransitionPaths?.[pathKey];

            if (customPath && customPath.length > 1) {
                const result = interpolateAlongPath(customPath, animationProgress, settings.easing);
                // Use Z from path if available (3D path), otherwise interpolate between state Z values
                const z = result.z !== undefined
                    ? result.z
                    : interpolate(currentPos.z || 0, nextPos.z || 0, animationProgress);
                return [result.x, z, result.y];
            }
        }

        // Standard linear interpolation
        const easing = EASING_FUNCTIONS[settings.easing] || EASING_FUNCTIONS.linear;
        const t = easing(animationProgress);

        return [
            interpolate(currentPos.x, nextPos.x, t),
            interpolate(currentPos.z || 0, nextPos.z || 0, t),
            interpolate(currentPos.y, nextPos.y, t)
        ];
    }, [isSimulating, currentStateId, states, animationProgress, settings.easing, items]);

    // Handle item click
    const handleItemClick = useCallback((e, item) => {
        e.stopPropagation();
        setContextMenu(null);
        if (e.shiftKey) {
            const newSelection = new Set(selectedIds);
            if (newSelection.has(item.id)) {
                newSelection.delete(item.id);
            } else {
                newSelection.add(item.id);
            }
            onSelectionChange(newSelection);
        } else {
            onSelectionChange(new Set([item.id]));
        }
    }, [selectedIds, onSelectionChange]);

    // Handle pointer down for dragging
    const handlePointerDown = useCallback((e, item) => {
        e.stopPropagation();
        if (isSimulating) return;

        if (!selectedIds.has(item.id)) {
            onSelectionChange(new Set([item.id]));
        }

        const pos = getItemPosition(item);

        // Check for scale mode (S key)
        if (window._sKeyPressed) {
            setScaleMode(true);
            const currentScale = item.statePositions?.[currentStateId]?.scale || 1;
            setScaleStart({ x: e.clientX, y: e.clientY, initialScale: currentScale });
            setDraggedItem(item.id);
            if (onDragStateChange) onDragStateChange(true);
            return;
        }

        // Check for rotation mode (R key)
        if (e.nativeEvent?.rKey || window._rKeyPressed) {
            setRotationMode(true);
            setRotationStart({ x: e.clientX, y: e.clientY, initialRotation: item.statePositions?.[currentStateId]?.rotation || 0 });
            setDraggedItem(item.id);
            if (onDragStateChange) onDragStateChange(true);
            return;
        }

        // Check for Z-drag mode (Shift key)
        if (e.shiftKey) {
            setZDragMode(true);
            // Set up vertical plane facing camera for Y-axis dragging (3D Y = altitude = 2D Z)
            const cameraDir = camera.getWorldDirection(new THREE.Vector3());
            // Use horizontal plane normal (we want to drag up/down)
            verticalPlane.current.setFromNormalAndCoplanarPoint(
                new THREE.Vector3(cameraDir.x, 0, cameraDir.z).normalize(),
                new THREE.Vector3(pos[0], pos[1], pos[2])
            );

            raycaster.setFromCamera(pointer, camera);
            const intersection = new THREE.Vector3();
            raycaster.ray.intersectPlane(verticalPlane.current, intersection);

            if (intersection) {
                dragOffset.current.set(0, pos[1] - intersection.y, 0);
            }
        } else {
            setZDragMode(false);
            // Normal horizontal drag
            dragPlane.current.constant = -pos[1];

            raycaster.setFromCamera(pointer, camera);
            const intersection = new THREE.Vector3();
            raycaster.ray.intersectPlane(dragPlane.current, intersection);

            dragOffset.current.set(
                pos[0] - intersection.x,
                0,
                pos[2] - intersection.z
            );
        }

        setDraggedItem(item.id);
        if (onDragStateChange) onDragStateChange(true);
    }, [isSimulating, selectedIds, onSelectionChange, getItemPosition, camera, raycaster, pointer, currentStateId]);

    // Handle pointer move for dragging
    useFrame(() => {
        if (!draggedItem) return;

        // Handle rotation mode
        if (rotationMode && rotationStart) {
            // Rotation is handled via global mouse move listener
            return;
        }

        // Handle scale mode
        if (scaleMode && scaleStart) {
            // Scaling is handled via global mouse move listener
            return;
        }

        raycaster.setFromCamera(pointer, camera);
        const intersection = new THREE.Vector3();

        if (zDragMode) {
            // Z-axis dragging (altitude)
            raycaster.ray.intersectPlane(verticalPlane.current, intersection);
            if (intersection) {
                let newZ = intersection.y + dragOffset.current.y;

                // Clamp to non-negative altitude
                newZ = Math.max(0, newZ);

                // Apply snap to grid if enabled
                if (settings.snapToGrid && settings.gridSize) {
                    newZ = Math.round(newZ / settings.gridSize) * settings.gridSize;
                }

                selectedIds.forEach(id => {
                    onUpdateItem(id, { z: Math.round(newZ) });
                });
            }
        } else {
            // Normal XY dragging
            raycaster.ray.intersectPlane(dragPlane.current, intersection);

            if (intersection) {
                let newX = intersection.x + dragOffset.current.x;
                let newY = intersection.z + dragOffset.current.z; // 3D Z -> 2D Y

                // Apply snap to grid if enabled
                if (settings.snapToGrid && settings.gridSize) {
                    newX = Math.round(newX / settings.gridSize) * settings.gridSize;
                    newY = Math.round(newY / settings.gridSize) * settings.gridSize;
                }

                selectedIds.forEach(id => {
                    onUpdateItem(id, { x: Math.round(newX), y: Math.round(newY) });
                });
            }
        }
    });

    // Handle pointer up
    const handlePointerUp = useCallback(() => {
        setDraggedItem(null);
        setZDragMode(false);
        setRotationMode(false);
        setRotationStart(null);
        setScaleMode(false);
        setScaleStart(null);
        if (onDragStateChange) onDragStateChange(false);
    }, [onDragStateChange]);

    // Handle mouse move for rotation
    useEffect(() => {
        if (!rotationMode || !rotationStart || !draggedItem) return;

        const handleMouseMove = (e) => {
            const deltaX = e.clientX - rotationStart.x;
            // 1 pixel = 1 degree of rotation
            const newRotation = rotationStart.initialRotation + deltaX;

            selectedIds.forEach(id => {
                onUpdateItem(id, { rotation: Math.round(newRotation) % 360 });
            });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [rotationMode, rotationStart, draggedItem, selectedIds, onUpdateItem]);

    // Handle mouse move for scaling
    useEffect(() => {
        if (!scaleMode || !scaleStart || !draggedItem) return;

        const handleMouseMove = (e) => {
            const deltaX = e.clientX - scaleStart.x;
            // 2 pixels = 0.01 scale change, so 200 pixels = 1.0 scale change
            const scaleDelta = deltaX / 200;
            const newScale = Math.max(0.1, Math.min(5, scaleStart.initialScale + scaleDelta));

            selectedIds.forEach(id => {
                onUpdateItem(id, { scale: Math.round(newScale * 100) / 100 });
            });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [scaleMode, scaleStart, draggedItem, selectedIds, onUpdateItem]);

    // Track R key for rotation mode and S key for scale mode
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'r' || e.key === 'R') {
                window._rKeyPressed = true;
            }
            if (e.key === 's' || e.key === 'S') {
                window._sKeyPressed = true;
            }
        };
        const handleKeyUp = (e) => {
            if (e.key === 'r' || e.key === 'R') {
                window._rKeyPressed = false;
            }
            if (e.key === 's' || e.key === 'S') {
                window._sKeyPressed = false;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // Global pointer up listener
    useEffect(() => {
        window.addEventListener('pointerup', handlePointerUp);
        return () => window.removeEventListener('pointerup', handlePointerUp);
    }, [handlePointerUp]);

    // Right-click context menu
    const handleContextMenu = useCallback((e) => {
        e.stopPropagation();
        if (isSimulating) return;

        // Get world position from raycast
        raycaster.setFromCamera(pointer, camera);
        const intersection = new THREE.Vector3();
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        raycaster.ray.intersectPlane(plane, intersection);

        setContextMenu({
            screenX: e.clientX || (gl.domElement.offsetLeft + gl.domElement.width / 2),
            screenY: e.clientY || (gl.domElement.offsetTop + gl.domElement.height / 2),
            worldX: intersection.x,
            worldY: intersection.z // 3D Z -> 2D Y (no negation)
        });
    }, [isSimulating, camera, raycaster, pointer, gl.domElement]);

    // Add item from context menu
    const addItemAtPosition = useCallback((type) => {
        if (!contextMenu || !onAddItem) return;
        onAddItem(type, contextMenu.worldX, contextMenu.worldY);
        setContextMenu(null);
    }, [contextMenu, onAddItem]);

    // Click on background to deselect
    const handleBackgroundClick = useCallback((e) => {
        onSelectionChange(new Set());
        setContextMenu(null);
    }, [onSelectionChange]);

    // Close context menu on escape
    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') setContextMenu(null);
            if (e.key === 'Delete' && selectedIds.size > 0 && onDeleteItem) {
                selectedIds.forEach(id => onDeleteItem(id));
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [selectedIds, onDeleteItem]);

    // Filter visible items
    const visibleItems = useMemo(() =>
        items.filter(item => item.activeStates?.includes(currentStateId)),
        [items, currentStateId]
    );

    // Generate path lines - use customPath waypoints for 3D visualization
    const pathLines = useMemo(() => {
        if (!showDronePaths) return [];

        return visibleItems
            .filter(item => item.type === 'drone')
            .flatMap(item => {
                const activeStates = states.filter(s => item.activeStates?.includes(s.id));
                if (activeStates.length < 2) return [];

                // Check if drone is locked to an object
                const parentObject = item.lockedToObject ? items.find(i => i.id === item.lockedToObject) : null;
                const offset = item.relativeOffset || { x: 0, y: 0, z: 0 };

                const lines = [];

                // Generate path for each state transition
                for (let i = 0; i < activeStates.length - 1; i++) {
                    const fromState = activeStates[i];
                    const toState = activeStates[i + 1];

                    // First check if drone has its own customPath for this transition
                    const toPos = item.statePositions?.[toState.id];
                    const droneCustomPath = toPos?.customPath;

                    // Use drone's own path if it has one (e.g., initial lock-on path)
                    if (droneCustomPath && droneCustomPath.length > 1) {
                        const points = droneCustomPath.map(p =>
                            new THREE.Vector3(p.x, p.z || 0, p.y)
                        );
                        lines.push({
                            id: `${item.id}-${fromState.id}-${toState.id}`,
                            points,
                            color: item.droneType === 'ground' ? '#8b5cf6' : '#60a5fa'
                        });
                    } else if (parentObject) {
                        // If locked to object and no drone path, use object's path with offset
                        const pathKey = `${fromState.id}_to_${toState.id}`;
                        const objectPath = parentObject.customTransitionPaths?.[pathKey];

                        if (objectPath && objectPath.length > 1) {
                            // Apply drone offset to each point on object's path
                            const parentRot = parentObject.statePositions?.[fromState.id]?.rotation || 0;
                            const angleRad = parentRot * (Math.PI / 180);
                            const rotatedX = offset.x * Math.cos(angleRad) - offset.y * Math.sin(angleRad);
                            const rotatedY = offset.x * Math.sin(angleRad) + offset.y * Math.cos(angleRad);

                            // Get drone's Z from its own state
                            const droneFromZ = item.statePositions?.[fromState.id]?.z || 0;
                            const droneToZ = item.statePositions?.[toState.id]?.z || 0;

                            const points = objectPath.map((p, idx) => {
                                // Interpolate drone Z along the path
                                const t = idx / (objectPath.length - 1);
                                const z = droneFromZ + (droneToZ - droneFromZ) * t;
                                return new THREE.Vector3(p.x + rotatedX, z, p.y + rotatedY);
                            });

                            lines.push({
                                id: `${item.id}-${fromState.id}-${toState.id}`,
                                points,
                                color: item.droneType === 'ground' ? '#8b5cf6' : '#60a5fa'
                            });
                        } else {
                            // Object has no custom path, use straight line with offset
                            const fromObjPos = parentObject.statePositions?.[fromState.id];
                            const toObjPos = parentObject.statePositions?.[toState.id];
                            if (fromObjPos && toObjPos) {
                                const fromAngle = (fromObjPos.rotation || 0) * (Math.PI / 180);
                                const toAngle = (toObjPos.rotation || 0) * (Math.PI / 180);
                                const droneFromZ = item.statePositions?.[fromState.id]?.z || 0;
                                const droneToZ = item.statePositions?.[toState.id]?.z || 0;

                                lines.push({
                                    id: `${item.id}-${fromState.id}-${toState.id}`,
                                    points: [
                                        new THREE.Vector3(
                                            fromObjPos.x + offset.x * Math.cos(fromAngle) - offset.y * Math.sin(fromAngle),
                                            droneFromZ,
                                            fromObjPos.y + offset.x * Math.sin(fromAngle) + offset.y * Math.cos(fromAngle)
                                        ),
                                        new THREE.Vector3(
                                            toObjPos.x + offset.x * Math.cos(toAngle) - offset.y * Math.sin(toAngle),
                                            droneToZ,
                                            toObjPos.y + offset.x * Math.sin(toAngle) + offset.y * Math.cos(toAngle)
                                        )
                                    ],
                                    color: item.droneType === 'ground' ? '#8b5cf6' : '#60a5fa'
                                });
                            }
                        }
                    } else {
                        // Not locked and no customPath - use straight line
                        const fromPos = item.statePositions?.[fromState.id];
                        if (fromPos && toPos) {
                            lines.push({
                                id: `${item.id}-${fromState.id}-${toState.id}`,
                                points: [
                                    new THREE.Vector3(fromPos.x, fromPos.z || 0, fromPos.y),
                                    new THREE.Vector3(toPos.x, toPos.z || 0, toPos.y)
                                ],
                                color: item.droneType === 'ground' ? '#8b5cf6' : '#60a5fa'
                            });
                        }
                    }
                }

                return lines;
            })
            .filter(Boolean);
    }, [visibleItems, states, showDronePaths, items]);

    return (
        <group>
            {/* Invisible ground for click/context menu detection */}
            <mesh
                ref={groundRef}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, -1, 0]}
                onClick={handleBackgroundClick}
                onContextMenu={handleContextMenu}
            >
                <planeGeometry args={[5000, 5000]} />
                <meshBasicMaterial visible={false} />
            </mesh>

            {/* Path Lines */}
            {pathLines.map(path => (
                <Line
                    key={path.id}
                    points={path.points}
                    color={path.color}
                    lineWidth={2}
                    dashed
                    dashScale={10}
                    dashSize={3}
                    gapSize={2}
                />
            ))}

            {/* Render Items */}
            {visibleItems.map(item => {
                const pos = getItemPosition(item);
                const rotation = [0, ((item.statePositions?.[currentStateId]?.rotation || 0) * Math.PI) / 180, 0];

                if (item.type === 'drone') {
                    return (
                        <Drone3D
                            key={item.id}
                            position={pos}
                            rotation={rotation}
                            selected={selectedIds.has(item.id)}
                            droneType={item.droneType}
                            isInFormation={!!item.assignedObject}
                            onClick={(e) => handleItemClick(e, item)}
                            onPointerDown={(e) => handlePointerDown(e, item)}
                        />
                    );
                }

                return (
                    <Object3D
                        key={item.id}
                        data={item}
                        position={pos}
                        rotation={rotation}
                        currentStateId={currentStateId}
                        selected={selectedIds.has(item.id)}
                        onClick={(e) => handleItemClick(e, item)}
                        onPointerDown={(e) => handlePointerDown(e, item)}
                        showLabels={settings.showObjectLabels !== false}
                    />
                );
            })}

            {/* Context Menu as Html overlay */}
            {contextMenu && (
                <Html
                    position={[contextMenu.worldX, 5, contextMenu.worldY]}
                    center
                    style={{ pointerEvents: 'auto' }}
                >
                    <div
                        style={{
                            background: 'rgba(15, 23, 42, 0.95)',
                            border: '1px solid rgba(148, 163, 184, 0.3)',
                            borderRadius: '8px',
                            padding: '8px 0',
                            minWidth: '160px',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                            fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ padding: '4px 12px', fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Add at ({Math.round(contextMenu.worldX)}, {Math.round(contextMenu.worldY)})
                        </div>
                        <div style={{ height: '1px', background: 'rgba(148, 163, 184, 0.2)', margin: '4px 0' }} />

                        {/* Add Drone with Submenu */}
                        <div
                            style={{ position: 'relative' }}
                            onMouseEnter={() => setShowDroneSubmenu(true)}
                            onMouseLeave={() => setShowDroneSubmenu(false)}
                        >
                            <div
                                style={{
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    color: '#e2e8f0',
                                    fontSize: '0.85rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    background: showDroneSubmenu ? 'rgba(99, 102, 241, 0.2)' : 'transparent'
                                }}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: '#60a5fa' }}>+</span> Add Drone
                                </span>
                                <span style={{ color: '#94a3b8' }}>▶</span>
                            </div>

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
                                    <div
                                        onClick={() => addItemAtPosition('drone')}
                                        style={{
                                            padding: '8px 12px',
                                            cursor: 'pointer',
                                            color: '#e2e8f0',
                                            fontSize: '0.85rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
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
                                    </div>
                                    <div
                                        onClick={() => addItemAtPosition('groundDrone')}
                                        style={{
                                            padding: '8px 12px',
                                            cursor: 'pointer',
                                            color: '#e2e8f0',
                                            fontSize: '0.85rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
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
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Add Object with Submenu */}
                        <div
                            style={{ position: 'relative' }}
                            onMouseEnter={() => setShowObjectSubmenu(true)}
                            onMouseLeave={() => setShowObjectSubmenu(false)}
                        >
                            <div
                                style={{
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    color: '#e2e8f0',
                                    fontSize: '0.85rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    background: showObjectSubmenu ? 'rgba(244, 114, 182, 0.2)' : 'transparent'
                                }}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: '#f472b6' }}>+</span> Add Object
                                </span>
                                <span style={{ color: '#94a3b8' }}>▶</span>
                            </div>

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
                                    {[
                                        { type: 'rectangle', label: 'Rectangle', icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#f472b6" strokeWidth="1.5"><rect x="1" y="1" width="12" height="12" rx="1" /></svg> },
                                        { type: 'circle', label: 'Circle', icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#f472b6" strokeWidth="1.5"><circle cx="7" cy="7" r="6" /></svg> },
                                        { type: 'triangle', label: 'Triangle', icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#f472b6" strokeWidth="1.5"><path d="M7 1L13 13H1L7 1Z" /></svg> },
                                        { type: 'hexagon', label: 'Hexagon', icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#f472b6" strokeWidth="1.5"><path d="M7 1L12.5 4V10L7 13L1.5 10V4L7 1Z" /></svg> },
                                        { type: 'star', label: 'Star', icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#f472b6" strokeWidth="1.5"><path d="M7 1L8.5 5.5H13L9.5 8.5L11 13L7 10L3 13L4.5 8.5L1 5.5H5.5L7 1Z" /></svg> }
                                    ].map(item => (
                                        <div
                                            key={item.type}
                                            onClick={() => addItemAtPosition(item.type)}
                                            style={{
                                                padding: '8px 12px',
                                                cursor: 'pointer',
                                                color: '#e2e8f0',
                                                fontSize: '0.85rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                textAlign: 'left'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(244, 114, 182, 0.2)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                            {item.icon}
                                            {item.label}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </Html>
            )}
        </group>
    );
}

export function Playground3D(props) {
    const [isDragging, setIsDragging] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const containerRef = useRef(null);

    // Handle drop from library
    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragOver(false);

        const itemType = e.dataTransfer.getData('itemType');
        if (!itemType || !props.onAddItem) return;

        // Get the container's bounding rect
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        // Calculate relative position within the container (center as origin)
        const relX = e.clientX - rect.left - rect.width / 2;
        const relY = e.clientY - rect.top - rect.height / 2;

        // Scale based on approximate 3D view scale (rough estimate)
        // This maps the screen position to world coordinates
        const scale = 0.5; // Adjust based on default zoom
        const worldX = relX * scale;
        const worldY = relY * scale;

        props.onAddItem(itemType, worldX, worldY);
    }, [props.onAddItem]);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setIsDragOver(false);
    }, []);

    return (
        <div
            ref={containerRef}
            style={{ width: '100%', height: '100%', position: 'relative' }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
        >
            <Scene3D controlsEnabled={!isDragging} gridSize={props.settings?.gridSize || 20}>
                <SceneContent {...props} onDragStateChange={setIsDragging} />
            </Scene3D>

            {/* Drop zone indicator */}
            {isDragOver && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    border: '3px dashed #60a5fa',
                    background: 'rgba(96, 165, 250, 0.1)',
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 100
                }}>
                    <div style={{
                        padding: '16px 32px',
                        background: 'rgba(15, 23, 42, 0.95)',
                        borderRadius: '12px',
                        color: '#60a5fa',
                        fontSize: '16px',
                        fontWeight: 600
                    }}>
                        Drop to add item
                    </div>
                </div>
            )}

            {/* 3D Mode indicator */}
            <div style={{
                position: 'absolute',
                bottom: '20px',
                left: '20px',
                padding: '8px 16px',
                background: 'rgba(15, 23, 42, 0.9)',
                borderRadius: '8px',
                color: '#60a5fa',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                border: '1px solid rgba(96, 165, 250, 0.3)'
            }}>
                <span>🎮</span>
                <span>3D Mode</span>
                <span style={{ color: '#94a3b8', fontWeight: 400 }}>• Shift+Drag: Altitude • R+Drag: Rotate • S+Drag: Scale</span>
            </div>
        </div>
    );
}
