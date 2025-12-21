import React, { useRef, useState } from 'react';
import { Drone } from './Drone';
import { SimulationObject } from './SimulationObject';

export function Playground({ items, onAddItem, onUpdateItem, selectedId, onSelect }) {
    const playgroundRef = useRef(null);
    const [dragState, setDragState] = useState(null); // { id, startX, startY, originalX, originalY }

    // Handle drop from Sidebar
    const handleDrop = (e) => {
        e.preventDefault();
        const type = e.dataTransfer.getData('application/react-dnd-type');
        if (!type) return;

        const rect = playgroundRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        onAddItem(type, x, y);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    // Handle internal dragging
    const handleMouseDown = (e, item) => {
        e.stopPropagation(); // Prevent deselecting
        onSelect(item.id);
        setDragState({
            id: item.id,
            startX: e.clientX,
            startY: e.clientY,
            originalX: item.x,
            originalY: item.y
        });
    };

    const handleMouseMove = (e) => {
        if (!dragState) return;

        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;

        onUpdateItem(dragState.id, {
            x: dragState.originalX + dx,
            y: dragState.originalY + dy
        });
    };

    const handleMouseUp = () => {
        setDragState(null);
    };

    // Click on background to deselect
    const handleBackgroundClick = (e) => {
        if (e.target === playgroundRef.current) {
            onSelect(null);
        }
    };

    return (
        <div
            ref={playgroundRef}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={handleBackgroundClick}
            style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
                background: 'var(--bg-primary)',
                backgroundImage: 'radial-gradient(var(--bg-tertiary) 1px, transparent 1px)',
                backgroundSize: '20px 20px'
            }}
        >
            {items.map(item => (
                <div
                    key={item.id}
                    style={{
                        position: 'absolute',
                        left: item.x,
                        top: item.y,
                        zIndex: item.id === selectedId ? 10 : 1 // Bring selected to front
                    }}
                    onMouseDown={(e) => handleMouseDown(e, item)}
                >
                    {item.type === 'drone' ? (
                        <Drone
                            selected={item.id === selectedId}
                            dragging={dragState?.id === item.id}
                        />
                    ) : (
                        <SimulationObject
                            data={item}
                            selected={item.id === selectedId}
                            dragging={dragState?.id === item.id}
                        />
                    )}
                </div>
            ))}

            {/* Instruction Overlay if empty */}
            {items.length === 0 && (
                <div style={{
                    position: 'absolute',
                    top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: 'var(--text-secondary)',
                    pointerEvents: 'none',
                    textAlign: 'center'
                }}>
                    <p>Drag items from the sidebar to start</p>
                </div>
            )}
        </div>
    );
}
