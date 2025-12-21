import React, { useRef, useState } from 'react';
import { Drone } from './Drone';
import { SimulationObject } from './SimulationObject';
import { ZoomControls } from './ZoomControls';

export function Playground({
    items, onAddItem, onUpdateItem, selectedIds, onSelectionChange,
    viewport, onViewportChange,
    drawingMode, onDrawingModeChange, onFinishDrawing
}) {
    const playgroundRef = useRef(null);
    const contentRef = useRef(null);
    const [activeDrag, setActiveDrag] = useState(null);
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState(null);

    // Convert screen coords to world coords
    const screenToWorld = (screenX, screenY) => {
        const rect = playgroundRef.current.getBoundingClientRect();
        const screenRelX = screenX - rect.left;
        const screenRelY = screenY - rect.top;

        // Account for viewport transformation
        const worldX = (screenRelX - viewport.offsetX) / viewport.zoom;
        const worldY = (screenRelY - viewport.offsetY) / viewport.zoom;

        return { x: worldX, y: worldY };
    };

    // Zoom handler
    const handleWheel = (e) => {
        e.preventDefault();

        const rect = playgroundRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Zoom centered on mouse
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.1, Math.min(5, viewport.zoom * delta));

        // Adjust offset so zoom is centered on mouse
        const zoomChange = newZoom / viewport.zoom;
        const newOffsetX = mouseX - (mouseX - viewport.offsetX) * zoomChange;
        const newOffsetY = mouseY - (mouseY - viewport.offsetY) * zoomChange;

        onViewportChange({
            zoom: newZoom,
            offsetX: newOffsetX,
            offsetY: newOffsetY
        });
    };

    // Drop from Sidebar
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

    // Item drag
    const handleItemMouseDown = (e, item) => {
        e.stopPropagation();

        // Don't drag if in drawing mode
        if (drawingMode) return;

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
            items: items.filter(i => newSelection.has(i.id)).map(i => ({
                id: i.id,
                startX: i.x,
                startY: i.y
            })),
            mouseStartWorld: screenToWorld(e.clientX, e.clientY)
        });
    };

    // Background interaction
    const handleBackgroundMouseDown = (e) => {
        if (e.target !== playgroundRef.current && e.target !== contentRef.current) return;

        // Drawing mode - add point
        if (drawingMode) {
            const world = screenToWorld(e.clientX, e.clientY);
            onDrawingModeChange({
                ...drawingMode,
                points: [...drawingMode.points, world]
            });
            return;
        }

        // Pan mode (Space key or middle mouse)
        if (e.button === 1 || e.spaceKey) {
            setIsPanning(true);
            setPanStart({ x: e.clientX, y: e.clientY });
            return;
        }

        // Selection box
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
        if (drawingMode && e.target === playgroundRef.current || e.target === contentRef.current) {
            onFinishDrawing();
        }
    };

    const handleMouseMove = (e) => {
        // Pan
        if (isPanning && panStart) {
            const dx = e.clientX - panStart.x;
            const dy = e.clientY - panStart.y;
            onViewportChange({
                ...viewport,
                offsetX: viewport.offsetX + dx,
                offsetY: viewport.offsetY + dy
            });
            setPanStart({ x: e.clientX, y: e.clientY });
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

            const boxLeft = Math.min(activeDrag.startWorld.x, currentWorld.x);
            const boxTop = Math.min(activeDrag.startWorld.y, currentWorld.y);
            const boxRight = Math.max(activeDrag.startWorld.x, currentWorld.x);
            const boxBottom = Math.max(activeDrag.startWorld.y, currentWorld.y);

            const newSelection = new Set(activeDrag.initialSelection);

            items.forEach(item => {
                if (
                    item.x >= boxLeft && item.x <= boxRight &&
                    item.y >= boxTop && item.y <= boxBottom
                ) {
                    newSelection.add(item.id);
                }
            });
            onSelectionChange(newSelection);
        }
    };

    const handleMouseUp = () => {
        setActiveDrag(null);
        setIsPanning(false);
        setPanStart(null);
    };

    // Track space key for panning
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

    return (
        <div
            ref={playgroundRef}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onMouseDown={handleBackgroundMouseDown}
            onDoubleClick={handleDoubleClick}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
                background: 'var(--bg-primary)',
                cursor: isPanning ? 'grabbing' : (drawingMode ? 'crosshair' : 'default'),
                userSelect: 'none'
            }}
        >
            {/* Transformed content layer */}
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
                {/* Items */}
                {items.map(item => (
                    <div
                        key={item.id}
                        style={{
                            position: 'absolute',
                            left: item.x,
                            top: item.y,
                            zIndex: selectedIds.has(item.id) ? 10 : 1
                        }}
                        onMouseDown={(e) => handleItemMouseDown(e, item)}
                    >
                        {item.type === 'drone' ? (
                            <Drone
                                selected={selectedIds.has(item.id)}
                                dragging={activeDrag?.type === 'item' && selectedIds.has(item.id)}
                            />
                        ) : (
                            <SimulationObject
                                data={item}
                                selected={selectedIds.has(item.id)}
                                dragging={activeDrag?.type === 'item' && selectedIds.has(item.id)}
                            />
                        )}
                    </div>
                ))}

                {/* Selection Box */}
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

                {/* Drawing preview */}
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
            </div>

            {/* Empty state */}
            {items.length === 0 && !drawingMode && (
                <div style={{
                    position: 'absolute',
                    top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: 'var(--text-secondary)',
                    pointerEvents: 'none',
                    textAlign: 'center'
                }}>
                    <p>Drag items from the sidebar to start</p>
                    <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Mouse wheel to zoom • Space+Drag to pan</p>
                </div>
            )}

            <ZoomControls viewport={viewport} onViewportChange={onViewportChange} />
        </div>
    );
}
