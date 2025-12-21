import React, { useState } from 'react';
import { Layout, Undo, Redo } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Sidebar } from './components/Sidebar';
import { Playground } from './components/Playground';
import { Timeline } from './components/Timeline';
import { EntityList } from './components/EntityList';

function App() {
    const [items, setItems] = useState([]);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [viewport, setViewport] = useState({ zoom: 1, offsetX: 0, offsetY: 0 });
    const [drawingMode, setDrawingMode] = useState(null);

    // History for undo/redo
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // State management
    const [states, setStates] = useState([
        { id: uuidv4(), name: 'Initial State', timestamp: 0 }
    ]);
    const [currentStateId, setCurrentStateId] = useState(states[0].id);

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

    const updateItem = (id, updates) => {
        setItems(prev => prev.map(item => {
            if (item.id !== id) return item;

            // If updating x, y, or rotation, update state position
            if ('x' in updates || 'y' in updates || 'rotation' in updates) {
                const currentPos = item.statePositions[currentStateId] || { x: 0, y: 0, rotation: 0 };
                return {
                    ...item,
                    statePositions: {
                        ...item.statePositions,
                        [currentStateId]: {
                            x: updates.x !== undefined ? updates.x : currentPos.x,
                            y: updates.y !== undefined ? updates.y : currentPos.y,
                            rotation: updates.rotation !== undefined ? updates.rotation : currentPos.rotation
                        }
                    }
                };
            }

            // Other property updates
            return { ...item, ...updates };
        }));
    };

    const deleteSelected = () => {
        if (selectedIds.size === 0) return;
        setItems(prev => prev.filter(item => !selectedIds.has(item.id)));
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
                    states={states}
                    currentStateId={currentStateId}
                    onToggleItemInState={toggleItemInState}
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
                        />
                    </div>
                    <Timeline
                        states={states}
                        currentStateId={currentStateId}
                        onStateChange={setCurrentStateId}
                        onAddState={addState}
                        onDeleteState={deleteState}
                        onUpdateStateName={updateStateName}
                    />
                </div>
            </div>
        </div>
    );
}

export default App;
