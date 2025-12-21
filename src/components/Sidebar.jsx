import React from 'react';
import { Plane, Box, Settings2, Trash2 } from 'lucide-react';

export function Sidebar({ items, selectedIds, onUpdateItem, onDelete }) {
    const handleDragStart = (e, type) => {
        e.dataTransfer.setData('application/react-dnd-type', type);
        e.dataTransfer.effectAllowed = 'copy';
    };

    const selectionCount = selectedIds.size;
    const singleSelectedItem = selectionCount === 1
        ? items.find(i => selectedIds.has(i.id))
        : null;

    return (
        <div style={{
            width: '300px',
            borderRight: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflowY: 'auto'
        }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <h2 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                    Library
                </h2>

                <div style={{ display: 'grid', gap: '0.75rem' }}>
                    <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, 'drone')}
                        style={draggableStyle}
                    >
                        <div style={{ padding: '0.5rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '6px', color: '#818cf8' }}>
                            <Plane size={20} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 500 }}>Drone</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Autonomous agent</div>
                        </div>
                    </div>

                    <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, 'object')}
                        style={draggableStyle}
                    >
                        <div style={{ padding: '0.5rem', background: 'rgba(236, 72, 153, 0.1)', borderRadius: '6px', color: '#f472b6' }}>
                            <Box size={20} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 500 }}>Object</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Physical entity</div>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ padding: '1.5rem', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Settings2 size={16} /> Properties
                    </h2>
                    {selectionCount > 0 && (
                        <button
                            onClick={onDelete}
                            title="Delete Selected"
                            style={{ padding: '0.4em', background: 'var(--bg-tertiary)', color: '#ef4444', border: '1px solid var(--border-color)' }}
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>

                {selectionCount === 0 ? (
                    <div style={emptyStateStyle}>
                        Select an item on the playground to edit its properties
                    </div>
                ) : selectionCount > 1 ? (
                    <div style={emptyStateStyle}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                            {selectionCount} items selected
                        </div>
                        <div style={{ fontSize: '0.875rem' }}>
                            Multi-edits not yet supported. Select a single item to edit properties.
                        </div>
                    </div>
                ) : singleSelectedItem ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={formGroupStyle}>
                            <label style={labelStyle}>ID</label>
                            <input type="text" value={singleSelectedItem.id.slice(0, 8)} disabled style={inputStyle} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div style={formGroupStyle}>
                                <label style={labelStyle}>X Position</label>
                                <input
                                    type="number"
                                    value={Math.round(singleSelectedItem.x)}
                                    onChange={(e) => onUpdateItem(singleSelectedItem.id, { x: parseInt(e.target.value) || 0 })}
                                    style={inputStyle}
                                />
                            </div>
                            <div style={formGroupStyle}>
                                <label style={labelStyle}>Y Position</label>
                                <input
                                    type="number"
                                    value={Math.round(singleSelectedItem.y)}
                                    onChange={(e) => onUpdateItem(singleSelectedItem.id, { y: parseInt(e.target.value) || 0 })}
                                    style={inputStyle}
                                />
                            </div>
                        </div>

                        {singleSelectedItem.type === 'object' && (
                            <>
                                <div style={formGroupStyle}>
                                    <label style={labelStyle}>Shape</label>
                                    <select
                                        value={singleSelectedItem.shape || 'rectangle'}
                                        onChange={(e) => onUpdateItem(singleSelectedItem.id, { shape: e.target.value })}
                                        style={selectStyle}
                                    >
                                        <option value="rectangle">Rectangle</option>
                                        <option value="circle">Circle</option>
                                    </select>
                                </div>

                                <div style={formGroupStyle}>
                                    <label style={labelStyle}>Width / Radius</label>
                                    <input
                                        type="number"
                                        value={singleSelectedItem.w || 50}
                                        onChange={(e) => onUpdateItem(singleSelectedItem.id, { w: parseInt(e.target.value) || 10 })}
                                        style={inputStyle}
                                    />
                                </div>

                                {singleSelectedItem.shape !== 'circle' && (
                                    <div style={formGroupStyle}>
                                        <label style={labelStyle}>Height</label>
                                        <input
                                            type="number"
                                            value={singleSelectedItem.h || 50}
                                            onChange={(e) => onUpdateItem(singleSelectedItem.id, { h: parseInt(e.target.value) || 10 })}
                                            style={inputStyle}
                                        />
                                    </div>
                                )}

                                <div style={formGroupStyle}>
                                    <label style={labelStyle}>Weight (kg)</label>
                                    <input
                                        type="number"
                                        value={singleSelectedItem.weight || 1.0}
                                        onChange={(e) => onUpdateItem(singleSelectedItem.id, { weight: parseFloat(e.target.value) || 0 })}
                                        step="0.1"
                                        style={inputStyle}
                                    />
                                </div>
                            </>
                        )}
                        {singleSelectedItem.type === 'drone' && (
                            <div style={{ padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '6px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                Drones are autonomous and have fixed physical properties in this simulation.
                            </div>
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

const emptyStateStyle = {
    padding: '2rem 1rem',
    textAlign: 'center',
    color: 'var(--text-secondary)',
    border: '1px dashed var(--border-color)',
    borderRadius: '8px'
};

const draggableStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    cursor: 'grab',
    transition: 'all 0.2s',
    userSelect: 'none'
};

const formGroupStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem'
};

const labelStyle = {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: 'var(--text-secondary)'
};

const inputStyle = {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    padding: '0.5rem',
    borderRadius: '6px',
    fontSize: '0.875rem',
    width: '100%'
};

const selectStyle = {
    ...inputStyle,
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23a1a1aa%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 0.7rem top 50%',
    backgroundSize: '0.65rem auto',
};
