import React, { useState } from 'react';
import { Layout } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Sidebar } from './components/Sidebar';
import { Playground } from './components/Playground';

function App() {
    const [items, setItems] = useState([]);
    const [selectedId, setSelectedId] = useState(null);

    const addItem = (type, x, y) => {
        const newItem = {
            id: uuidv4(),
            type,
            x,
            y,
            // Default properties based on type
            ...(type === 'object' ? {
                shape: 'rectangle',
                w: 100,
                h: 100,
                weight: 10
            } : {
                // Drone specific defaults if any
            })
        };
        setItems(prev => [...prev, newItem]);
        setSelectedId(newItem.id);
    };

    const updateItem = (id, updates) => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, ...updates } : item
        ));
    };

    const selectedItem = items.find(i => i.id === selectedId);

    return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
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
            </header>

            {/* Main Content */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <Sidebar
                    selectedItem={selectedItem}
                    onUpdateItem={updateItem}
                />
                <div style={{ flex: 1, position: 'relative' }}>
                    <Playground
                        items={items}
                        onAddItem={addItem}
                        onUpdateItem={updateItem}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                    />
                </div>
            </div>
        </div>
    );
}

export default App;
