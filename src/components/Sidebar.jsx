import React from 'react';
import { Plane, Square, Circle, Settings2, Trash2, Pencil, Edit3, Truck } from 'lucide-react';

export function Sidebar({ items, selectedIds, onUpdateItem, onDelete, states, currentStateId, onToggleItemInState, isSimulating, animationProgress, onGenerateGroundFormation, onGenerateAirFormation }) {
    const handleDragStart = (e, type) => {
        e.dataTransfer.setData('application/react-dnd-type', type);
        e.dataTransfer.effectAllowed = 'copy';
    };

    const selectionCount = selectedIds.size;
    const singleSelectedItem = selectionCount === 1
        ? items.find(i => selectedIds.has(i.id))
        : null;

    // Helper for interpolating during simulation
    const interpolate = (start, end, progress) => start + (end - start) * progress;

    // Get display position (interpolated if simulating)
    const getDisplayPosition = (item) => {
        const currentPos = item.statePositions?.[currentStateId] || { x: 0, y: 0, rotation: 0 };
        if (!isSimulating || !states || states.length < 2) return currentPos;

        const currentIndex = states.findIndex(s => s.id === currentStateId);
        const nextIndex = (currentIndex + 1) % states.length;
        const nextPos = item.statePositions?.[states[nextIndex].id] || currentPos;

        return {
            x: interpolate(currentPos.x, nextPos.x, animationProgress),
            y: interpolate(currentPos.y, nextPos.y, animationProgress),
            rotation: interpolate(currentPos.rotation || 0, nextPos.rotation || 0, animationProgress)
        };
    };

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
                    {/* Air Drone */}
                    <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, 'drone-air')}
                        style={draggableStyle}
                    >
                        <div style={{ padding: '0.5rem', background: 'rgba(96, 165, 250, 0.1)', borderRadius: '6px', color: '#60a5fa' }}>
                            <Plane size={20} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 500 }}>Air Drone</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Surface coverage</div>
                        </div>
                    </div>

                    {/* Ground Drone */}
                    <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, 'drone-ground')}
                        style={draggableStyle}
                    >
                        <div style={{ padding: '0.5rem', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '6px', color: '#8b5cf6' }}>
                            <Truck size={20} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 500 }}>Ground Drone</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Perimeter surround</div>
                        </div>
                    </div>

                    <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, 'rectangle')}
                        style={draggableStyle}
                    >
                        <div style={{ padding: '0.5rem', background: 'rgba(236, 72, 153, 0.1)', borderRadius: '6px', color: '#f472b6' }}>
                            <Square size={20} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 500 }}>Rectangle</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Rectangular object</div>
                        </div>
                    </div>

                    <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, 'circle')}
                        style={draggableStyle}
                    >
                        <div style={{ padding: '0.5rem', background: 'rgba(236, 72, 153, 0.1)', borderRadius: '6px', color: '#f472b6' }}>
                            <Circle size={20} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 500 }}>Circle</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Circular object</div>
                        </div>
                    </div>

                    <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, 'custom')}
                        style={draggableStyle}
                    >
                        <div style={{ padding: '0.5rem', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '6px', color: '#4ade80' }}>
                            <Pencil size={20} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 500 }}>Custom Object</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Draw your shape</div>
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

                        {singleSelectedItem && (() => {
                            const displayPos = getDisplayPosition(singleSelectedItem);
                            return (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div style={formGroupStyle}>
                                            <label style={labelStyle}>X Position</label>
                                            <input
                                                type="number"
                                                value={Math.round(displayPos.x)}
                                                onChange={(e) => onUpdateItem(singleSelectedItem.id, { x: parseInt(e.target.value) || 0 })}
                                                style={inputStyle}
                                                disabled={isSimulating}
                                            />
                                        </div>
                                        <div style={formGroupStyle}>
                                            <label style={labelStyle}>Y Position</label>
                                            <input
                                                type="number"
                                                value={Math.round(displayPos.y)}
                                                onChange={(e) => onUpdateItem(singleSelectedItem.id, { y: parseInt(e.target.value) || 0 })}
                                                style={inputStyle}
                                                disabled={isSimulating}
                                            />
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                        {/* Active States */}
                        <div style={formGroupStyle}>
                            <label style={labelStyle}>Active in States</label>
                            <div style={{
                                padding: '0.75rem',
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem'
                            }}>
                                {states.map(state => (
                                    <label
                                        key={state.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            cursor: 'pointer',
                                            fontSize: '0.875rem',
                                            color: 'var(--text-primary)'
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={singleSelectedItem.activeStates?.includes(state.id) || false}
                                            onChange={() => onToggleItemInState(singleSelectedItem.id, state.id)}
                                            style={{ cursor: 'pointer' }}
                                        />
                                        <span style={{
                                            flex: 1,
                                            color: state.id === currentStateId ? 'var(--accent-color)' : 'var(--text-primary)',
                                            fontWeight: state.id === currentStateId ? 600 : 400
                                        }}>
                                            {state.name}
                                        </span>
                                        {state.id === currentStateId && (
                                            <span style={{
                                                fontSize: '0.75rem',
                                                color: 'var(--accent-color)',
                                                background: 'rgba(99, 102, 241, 0.1)',
                                                padding: '0.125rem 0.5rem',
                                                borderRadius: '4px'
                                            }}>
                                                Current
                                            </span>
                                        )}
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Rectangle properties */}
                        {singleSelectedItem.type === 'rectangle' && (
                            <>
                                <div style={formGroupStyle}>
                                    <label style={labelStyle}>Width</label>
                                    <input
                                        type="number"
                                        value={singleSelectedItem.w || 100}
                                        onChange={(e) => onUpdateItem(singleSelectedItem.id, { w: parseInt(e.target.value) || 10 })}
                                        style={inputStyle}
                                    />
                                </div>

                                <div style={formGroupStyle}>
                                    <label style={labelStyle}>Height</label>
                                    <input
                                        type="number"
                                        value={singleSelectedItem.h || 100}
                                        onChange={(e) => onUpdateItem(singleSelectedItem.id, { h: parseInt(e.target.value) || 10 })}
                                        style={inputStyle}
                                    />
                                </div>

                                <div style={formGroupStyle}>
                                    <label style={labelStyle}>Weight (kg)</label>
                                    <input
                                        type="number"
                                        value={singleSelectedItem.weight || 10}
                                        onChange={(e) => onUpdateItem(singleSelectedItem.id, { weight: parseFloat(e.target.value) || 0 })}
                                        step="0.1"
                                        style={inputStyle}
                                    />
                                </div>

                                <div style={formGroupStyle}>
                                    <label style={labelStyle}>Rotation (°)</label>
                                    <input
                                        type="number"
                                        value={Math.round(singleSelectedItem.statePositions?.[currentStateId]?.rotation || 0)}
                                        onChange={(e) => onUpdateItem(singleSelectedItem.id, { rotation: parseInt(e.target.value) || 0 })}
                                        style={inputStyle}
                                    />
                                </div>
                            </>
                        )}

                        {/* Transport Mode (for non-drone objects) */}
                        {singleSelectedItem && singleSelectedItem.type !== 'drone' && (
                            <div style={{ ...formGroupStyle, borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem' }}>
                                <label style={labelStyle}>Drone Transport</label>

                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {/* Ground Formation Button */}
                                    <button
                                        onClick={() => onGenerateGroundFormation(singleSelectedItem.id)}
                                        disabled={isSimulating}
                                        style={{
                                            ...inputStyle,
                                            flex: 1,
                                            cursor: isSimulating ? 'not-allowed' : 'pointer',
                                            background: 'var(--bg-tertiary)',
                                            color: '#8b5cf6',
                                            border: '1px solid #8b5cf6',
                                            fontWeight: 500,
                                            opacity: isSimulating ? 0.6 : 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.25rem'
                                        }}
                                    >
                                        🚗 Ground
                                    </button>

                                    {/* Air Formation Button */}
                                    <button
                                        onClick={() => onGenerateAirFormation(singleSelectedItem.id)}
                                        disabled={isSimulating}
                                        style={{
                                            ...inputStyle,
                                            flex: 1,
                                            cursor: isSimulating ? 'not-allowed' : 'pointer',
                                            background: 'var(--bg-tertiary)',
                                            color: '#60a5fa',
                                            border: '1px solid #60a5fa',
                                            fontWeight: 500,
                                            opacity: isSimulating ? 0.6 : 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.25rem'
                                        }}
                                    >
                                        ✈️ Air
                                    </button>
                                </div>

                                {singleSelectedItem.assignedDrones?.length > 0 && (
                                    <div style={{
                                        marginTop: '0.5rem',
                                        fontSize: '0.75rem',
                                        color: 'var(--text-secondary)',
                                        padding: '0.5rem',
                                        background: 'var(--bg-primary)',
                                        borderRadius: '4px'
                                    }}>
                                        <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                                            {singleSelectedItem.assignedDrones.length} drones in current state
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: '0.25rem',
                                            marginTop: '0.5rem'
                                        }}>
                                            {singleSelectedItem.assignedDrones.map(droneId => {
                                                const drone = items.find(i => i.id === droneId);
                                                const droneColor = drone?.droneType === 'ground' ? '#8b5cf6' : '#60a5fa';
                                                const droneIcon = drone?.droneType === 'ground' ? '🚗' : '✈️';
                                                return (
                                                    <div
                                                        key={droneId}
                                                        style={{
                                                            padding: '2px 6px',
                                                            background: 'var(--bg-tertiary)',
                                                            border: `1px solid ${droneColor}`,
                                                            borderRadius: '3px',
                                                            fontSize: '0.7rem',
                                                            color: droneColor,
                                                            fontFamily: 'monospace'
                                                        }}
                                                    >
                                                        {droneIcon} {droneId.substring(0, 8)}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Circle properties */}
                        {singleSelectedItem.type === 'circle' && (
                            <>
                                <div style={formGroupStyle}>
                                    <label style={labelStyle}>Radius</label>
                                    <input
                                        type="number"
                                        value={singleSelectedItem.radius || 50}
                                        onChange={(e) => onUpdateItem(singleSelectedItem.id, { radius: parseInt(e.target.value) || 10 })}
                                        style={inputStyle}
                                    />
                                </div>

                                <div style={formGroupStyle}>
                                    <label style={labelStyle}>Weight (kg)</label>
                                    <input
                                        type="number"
                                        value={singleSelectedItem.weight || 10}
                                        onChange={(e) => onUpdateItem(singleSelectedItem.id, { weight: parseFloat(e.target.value) || 0 })}
                                        step="0.1"
                                        style={inputStyle}
                                    />
                                </div>

                                <div style={formGroupStyle}>
                                    <label style={labelStyle}>Rotation (°)</label>
                                    <input
                                        type="number"
                                        value={Math.round(singleSelectedItem.statePositions?.[currentStateId]?.rotation || 0)}
                                        onChange={(e) => onUpdateItem(singleSelectedItem.id, { rotation: parseInt(e.target.value) || 0 })}
                                        style={inputStyle}
                                    />
                                </div>
                            </>
                        )}

                        {/* Custom object properties */}
                        {singleSelectedItem.type === 'custom' && (
                            <>
                                <div style={formGroupStyle}>
                                    <label style={labelStyle}>Points</label>
                                    <div style={{
                                        padding: '0.5rem',
                                        background: 'var(--bg-primary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '6px',
                                        fontSize: '0.875rem',
                                        color: 'var(--text-secondary)'
                                    }}>
                                        {singleSelectedItem.customPath?.length || 0} vertices
                                    </div>
                                </div>

                                <button
                                    style={{
                                        ...inputStyle,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem',
                                        background: 'var(--bg-tertiary)',
                                        border: '1px solid var(--accent-color)',
                                        color: 'var(--accent-color)',
                                        fontWeight: 500
                                    }}
                                    onClick={() => alert('Edit points feature coming soon!')}
                                >
                                    <Edit3 size={16} /> Edit Points
                                </button>

                                <div style={formGroupStyle}>
                                    <label style={labelStyle}>Weight (kg)</label>
                                    <input
                                        type="number"
                                        value={singleSelectedItem.weight || 10}
                                        onChange={(e) => onUpdateItem(singleSelectedItem.id, { weight: parseFloat(e.target.value) || 0 })}
                                        step="0.1"
                                        style={inputStyle}
                                    />
                                </div>

                                <div style={formGroupStyle}>
                                    <label style={labelStyle}>Rotation (°)</label>
                                    <input
                                        type="number"
                                        value={Math.round(singleSelectedItem.statePositions?.[currentStateId]?.rotation || 0)}
                                        onChange={(e) => onUpdateItem(singleSelectedItem.id, { rotation: parseInt(e.target.value) || 0 })}
                                        style={inputStyle}
                                    />
                                </div>
                            </>
                        )}

                        {/* Drone info */}
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
