import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Scene3D } from './Scene3D';
import { Drone3D } from './Drone3D';
import { Object3D } from './Object3D';

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
    const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
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
        const currentPos = item.statePositions[states[currentStateIndex].id];
        const nextPos = item.statePositions[states[nextStateIndex].id];

        if (!currentPos || !nextPos) {
            const pos = currentPos || nextPos || { x: 0, y: 0, z: 0 };
            return [pos.x, pos.z || 0, pos.y];
        }

        const easing = EASING_FUNCTIONS[settings.easing] || EASING_FUNCTIONS.linear;
        const t = easing(animationProgress);

        return [
            interpolate(currentPos.x, nextPos.x, t),
            interpolate(currentPos.z || 0, nextPos.z || 0, t),
            interpolate(currentPos.y, nextPos.y, t)
        ];
    }, [isSimulating, currentStateId, states, animationProgress, settings.easing]);

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
        dragPlane.current.constant = -pos[1];

        raycaster.setFromCamera(pointer, camera);
        const intersection = new THREE.Vector3();
        raycaster.ray.intersectPlane(dragPlane.current, intersection);

        dragOffset.current.set(
            pos[0] - intersection.x,
            0,
            pos[2] - intersection.z
        );

        setDraggedItem(item.id);
        if (onDragStateChange) onDragStateChange(true);
    }, [isSimulating, selectedIds, onSelectionChange, getItemPosition, camera, raycaster, pointer]);

    // Handle pointer move for dragging
    useFrame(() => {
        if (!draggedItem) return;

        raycaster.setFromCamera(pointer, camera);
        const intersection = new THREE.Vector3();
        raycaster.ray.intersectPlane(dragPlane.current, intersection);

        if (intersection) {
            let newX = intersection.x + dragOffset.current.x;
            let newY = intersection.z + dragOffset.current.z; // 3D Z -> 2D Y (no negation now)

            // Apply snap to grid if enabled
            if (settings.snapToGrid && settings.gridSize) {
                newX = Math.round(newX / settings.gridSize) * settings.gridSize;
                newY = Math.round(newY / settings.gridSize) * settings.gridSize;
            }

            selectedIds.forEach(id => {
                onUpdateItem(id, { x: Math.round(newX), y: Math.round(newY) });
            });
        }
    });

    // Handle pointer up
    const handlePointerUp = useCallback(() => {
        setDraggedItem(null);
        if (onDragStateChange) onDragStateChange(false);
    }, [onDragStateChange]);

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

    // Generate path lines
    const pathLines = useMemo(() => {
        if (!showDronePaths) return [];

        return visibleItems
            .filter(item => item.type === 'drone')
            .map(item => {
                const activeStates = states.filter(s => item.activeStates?.includes(s.id));
                if (activeStates.length < 2) return null;

                const points = [];
                activeStates.forEach(state => {
                    const pos = item.statePositions?.[state.id];
                    if (pos) {
                        points.push(new THREE.Vector3(pos.x, pos.z || 0, pos.y)); // 2D Y -> 3D Z
                    }
                });

                return {
                    id: item.id,
                    points,
                    color: item.droneType === 'ground' ? '#8b5cf6' : '#60a5fa'
                };
            })
            .filter(Boolean);
    }, [visibleItems, states, showDronePaths]);

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
                    <div style={{
                        background: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(148, 163, 184, 0.3)',
                        borderRadius: '8px',
                        padding: '8px 0',
                        minWidth: '160px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                    }}>
                        <div style={{ padding: '4px 12px', fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Add Item
                        </div>
                        {[
                            { type: 'drone', label: '✈️ Air Drone', color: '#60a5fa' },
                            { type: 'groundDrone', label: '🚗 Ground Drone', color: '#8b5cf6' },
                            { type: 'rectangle', label: '⬜ Rectangle', color: '#10b981' },
                            { type: 'circle', label: '⭕ Circle', color: '#10b981' }
                        ].map(item => (
                            <div
                                key={item.type}
                                onClick={() => addItemAtPosition(item.type)}
                                style={{
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    color: '#e2e8f0',
                                    fontSize: '13px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    transition: 'background 0.15s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                {item.label}
                            </div>
                        ))}
                    </div>
                </Html>
            )}
        </group>
    );
}

export function Playground3D(props) {
    const [isDragging, setIsDragging] = useState(false);

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <Scene3D controlsEnabled={!isDragging} gridSize={props.settings?.gridSize || 20}>
                <SceneContent {...props} onDragStateChange={setIsDragging} />
            </Scene3D>

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
                <span style={{ color: '#94a3b8', fontWeight: 400 }}>• Right-click: Add • Delete key: Remove</span>
            </div>
        </div>
    );
}
