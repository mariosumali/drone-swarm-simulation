import React, { useRef, useState } from 'react';
import { Drone } from './Drone';
import { SimulationObject } from './SimulationObject';

export function Playground({ items, onAddItem, onUpdateItem, selectedIds, onSelectionChange }) {
    const playgroundRef = useRef(null);
    const [activeDrag, setActiveDrag] = useState(null);

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

    const handleItemMouseDown = (e, item) => {
        e.stopPropagation();

        let newSelection = new Set(selectedIds);
        if (!newSelection.has(item.id)) {
            if (!e.shiftKey) {
                newSelection = new Set([item.id]);
            } else {
                newSelection.add(item.id);
            }
            onSelectionChange(newSelection);
        }

        const rect = playgroundRef.current.getBoundingClientRect();
        setActiveDrag({
            type: 'item',
            items: items.filter(i => newSelection.has(i.id)).map(i => ({
                id: i.id,
                startX: i.x,
                startY: i.y
            })),
            mouseStartX: e.clientX - rect.left,
            mouseStartY: e.clientY - rect.top
        });
    };

    const handleBackgroundMouseDown = (e) => {
        if (e.target !== playgroundRef.current) return;

        if (!e.shiftKey) {
            onSelectionChange(new Set());
        }

        const rect = playgroundRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        setActiveDrag({
            type: 'box',
            startX: x,
            startY: y,
            currentX: x,
            currentY: y,
            initialSelection: e.shiftKey ? new Set(selectedIds) : new Set()
        });
    };

    const handleMouseMove = (e) => {
        if (!activeDrag) return;

        const rect = playgroundRef.current.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        if (activeDrag.type === 'item') {
            const dx = currentX - activeDrag.mouseStartX;
            const dy = currentY - activeDrag.mouseStartY;

            activeDrag.items.forEach(dragItem => {
                onUpdateItem(dragItem.id, {
                    x: dragItem.startX + dx,
                    y: dragItem.startY + dy
                });
            });
        } else if (activeDrag.type === 'box') {
            setActiveDrag(prev => ({ ...prev, currentX, currentY }));

            const boxLeft = Math.min(activeDrag.startX, currentX);
            const boxTop = Math.min(activeDrag.startY, currentY);
            const boxRight = Math.max(activeDrag.startX, currentX);
            const boxBottom = Math.max(activeDrag.startY, currentY);

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
    };

    return (
        <div
            ref={playgroundRef}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onMouseDown={handleBackgroundMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
                background: 'var(--bg-primary)',
                backgroundImage: 'radial-gradient(var(--bg-tertiary) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
                userSelect: 'none'
            }}
        >
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

            {activeDrag?.type === 'box' && (
                <div style={{
                    position: 'absolute',
                    left: Math.min(activeDrag.startX, activeDrag.currentX),
                    top: Math.min(activeDrag.startY, activeDrag.currentY),
                    width: Math.abs(activeDrag.currentX - activeDrag.startX),
                    height: Math.abs(activeDrag.currentY - activeDrag.startY),
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    border: '1px solid var(--accent-color)',
                    pointerEvents: 'none',
                    zIndex: 100
                }} />
            )}

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
