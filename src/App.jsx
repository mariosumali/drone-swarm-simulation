import React, { useState } from 'react';
import { Layout } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Sidebar } from './components/Sidebar';
import { Playground } from './components/Playground';

function App() {
    const [items, setItems] = useState([]);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [viewport, setViewport] = useState({ zoom: 1, offsetX: 0, offsetY: 0 });
    const [drawingMode, setDrawingMode] = useState(null);

    const addItem = (type, x, y) => {
        if (type === 'custom') {
            // Start drawing mode
            setDrawingMode({ type: 'custom', points: [{ x, y }], startX: x, startY: y });
            return;
        }

        const newItem = {
            id: uuidv4(),
            type,
            x,
            y,
            // Default properties based on type
            ...(type === 'rectangle' ? {
                w: 100,
                h: 100,
                weight: 10
            } : type === 'circle' ? {
                radius: 50,
                weight: 10
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

        // Calculate bounding box
        const xs = drawingMode.points.map(p => p.x);
        const ys = drawingMode.points.map(p => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        // Convert to relative coordinates
        const relativePoints = drawingMode.points.map(p => ({
            x: p.x - centerX,
            y: p.y - centerY
        }));

        const newItem = {
            id: uuidv4(),
            type: 'custom',
            x: centerX,
            y: centerY,
            customPath: relativePoints,
            w: maxX - minX,
            h: maxY - minY,
            weight: 10
        };

        setItems(prev => [...prev, newItem]);
        setSelectedIds(new Set([newItem.id]));
        setDrawingMode(null);
    };

    const updateItem = (id, updates) => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, ...updates } : item
        ));
    };

    const deleteSelected = () => {
        if (selectedIds.size === 0) return;
        setItems(prev => prev.filter(item => !selectedIds.has(item.id)));
        setSelectedIds(new Set());
    };

    // Keyboard listeners
    React.useEffect(() => {
        const handleKeyDown = (e) => {
            const activeTag = document.activeElement.tagName;

            // Delete
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
                deleteSelected();
            }

            // Escape - cancel drawing
            if (e.key === 'Escape' && drawingMode) {
                setDrawingMode(null);
            }

            // Enter - finish drawing
            if (e.key === 'Enter' && drawingMode) {
                finishDrawing();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedIds, drawingMode]);

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
                <div style={{ marginLeft: 'auto', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {items.length} Entities
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
            </header>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <Sidebar
                    items={items}
                    selectedIds={selectedIds}
                    onUpdateItem={updateItem}
                    onDelete={deleteSelected}
                />
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
                    />
                </div>
            </div>
        </div>
    );
}

export default App;
