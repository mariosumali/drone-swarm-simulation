import React from 'react';
import { Plane, Square, Circle, Settings2, Trash2, Pencil, Edit3, Truck, ChevronLeft, ChevronRight } from 'lucide-react';

export function Sidebar({ items, selectedIds, onUpdateItem, onDelete, states, currentStateId, onToggleItemInState, isSimulating, animationProgress, onGenerateGroundFormation, onGenerateAirFormation, onUnlockFormation, onStartPathDrawing, onClearPath, onAutoDrawPath, pathDrawingMode, isExpanded = true, onToggleExpand }) {
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
        const currentPos = item.statePositions?.[currentStateId] || { x: 0, y: 0, z: 0, rotation: 0 };
        if (!isSimulating || !states || states.length < 2) return currentPos;

        const currentIndex = states.findIndex(s => s.id === currentStateId);
        const nextIndex = (currentIndex + 1) % states.length;
        const nextPos = item.statePositions?.[states[nextIndex].id] || currentPos;

        return {
            x: interpolate(currentPos.x, nextPos.x, animationProgress),
            y: interpolate(currentPos.y, nextPos.y, animationProgress),
            z: interpolate(currentPos.z || 0, nextPos.z || 0, animationProgress),
            rotation: interpolate(currentPos.rotation || 0, nextPos.rotation || 0, animationProgress)
        };
    };

    // Collapsed view
    if (!isExpanded) {
        return (
            <div style={{
                position: 'absolute',
                right: 0,
                top: '60px',
                bottom: '80px',
                width: '50px',
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(10px)',
                borderLeft: '1px solid var(--glass-border)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '1rem 0',
                gap: '0.5rem',
                zIndex: 100
            }}>
                <button
                    onClick={onToggleExpand}
                    style={{
                        background: 'var(--accent-color)',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.5rem',
                        cursor: 'pointer',
                        color: 'white',
                        display: 'flex'
                    }}
                    title="Expand Properties"
                >
                    <ChevronLeft size={20} />
                </button>
                {singleSelectedItem && (
                    <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--accent-color)',
                        fontWeight: 600,
                        writingMode: 'vertical-rl',
                        textOrientation: 'mixed'
                    }}>
                        {singleSelectedItem.type}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div style={{
            position: 'absolute',
            right: 0,
            top: '60px',
            bottom: '80px',
            width: '300px',
            borderLeft: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            zIndex: 100
        }}>
            {/* Collapse Button */}
            <div style={{ padding: '0.5rem', display: 'flex', justifyContent: 'flex-start', borderBottom: '1px solid var(--border-color)' }}>
                <button
                    onClick={onToggleExpand}
                    style={{
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        padding: '0.25rem',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        display: 'flex'
                    }}
                    title="Collapse"
                >
                    <ChevronRight size={16} />
                </button>
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
                        {/* Lock and Obstacle Toggles */}
                        {(singleSelectedItem.type === 'rectangle' || singleSelectedItem.type === 'circle' || singleSelectedItem.type === 'custom') && (
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', flex: '1 1 auto', fontSize: '0.875rem' }}>
                                    <input
                                        type="checkbox"
                                        checked={singleSelectedItem.isLocked || false}
                                        onChange={(e) => onUpdateItem(singleSelectedItem.id, {
                                            isLocked: e.target.checked
                                        })}
                                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                    />
                                    <span>🔒 Lock Position</span>
                                </label>

                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', flex: '1 1 auto', fontSize: '0.875rem' }}>
                                    <input
                                        type="checkbox"
                                        checked={singleSelectedItem.isObstacle || false}
                                        onChange={(e) => onUpdateItem(singleSelectedItem.id, {
                                            isObstacle: e.target.checked,
                                            ...(e.target.checked && {
                                                transportMode: false,
                                                assignedDrones: [],
                                                formationLocked: false
                                            })
                                        })}
                                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                    />
                                    <span>🚧 Mark as Obstacle</span>
                                </label>
                            </div>
                        )}

                        <div style={formGroupStyle}>
                            <label style={labelStyle}>Name</label>
                            <input
                                type="text"
                                value={singleSelectedItem.customName || ''}
                                onChange={(e) => onUpdateItem(singleSelectedItem.id, { customName: e.target.value })}
                                placeholder={singleSelectedItem.type.charAt(0).toUpperCase() + singleSelectedItem.type.slice(1) + ' ' + singleSelectedItem.id.slice(0, 4)}
                                style={inputStyle}
                            />
                        </div>

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
                                    {/* Z Position - for air drones (Altitude) and non-drone objects (Elevation) */}
                                    {(singleSelectedItem.type !== 'drone' || singleSelectedItem.droneType !== 'ground') && (
                                        <div style={formGroupStyle}>
                                            <label style={labelStyle}>{singleSelectedItem.type === 'drone' ? 'Altitude (Z)' : 'Z Position'}</label>
                                            <input
                                                type="number"
                                                value={Math.round(displayPos.z || 0)}
                                                onChange={(e) => onUpdateItem(singleSelectedItem.id, { z: parseInt(e.target.value) || 0 })}
                                                style={inputStyle}
                                                disabled={isSimulating}
                                            />
                                        </div>
                                    )}

                                    {/* Height for non-drone objects (even if not marked as obstacle) */}
                                    {singleSelectedItem.type !== 'drone' && (
                                        <div style={formGroupStyle}>
                                            <label style={labelStyle}>Height</label>
                                            <input
                                                type="number"
                                                value={singleSelectedItem.height || 100}
                                                onChange={(e) => onUpdateItem(singleSelectedItem.id, { height: parseInt(e.target.value) || 100 })}
                                                style={inputStyle}
                                                min="0"
                                            />
                                        </div>
                                    )}

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
                                        value={singleSelectedItem.w ?? ''}
                                        onChange={(e) => onUpdateItem(singleSelectedItem.id, { w: e.target.value === '' ? '' : parseInt(e.target.value) })}
                                        onBlur={(e) => { if (e.target.value === '' || isNaN(parseInt(e.target.value))) onUpdateItem(singleSelectedItem.id, { w: 100 }); }}
                                        style={inputStyle}
                                    />
                                </div>

                                <div style={formGroupStyle}>
                                    <label style={labelStyle}>Height</label>
                                    <input
                                        type="number"
                                        value={singleSelectedItem.h ?? ''}
                                        onChange={(e) => onUpdateItem(singleSelectedItem.id, { h: e.target.value === '' ? '' : parseInt(e.target.value) })}
                                        onBlur={(e) => { if (e.target.value === '' || isNaN(parseInt(e.target.value))) onUpdateItem(singleSelectedItem.id, { h: 100 }); }}
                                        style={inputStyle}
                                    />
                                </div>

                                <div style={formGroupStyle}>
                                    <label style={labelStyle}>Weight (kg)</label>
                                    <input
                                        type="number"
                                        value={singleSelectedItem.weight ?? ''}
                                        onChange={(e) => onUpdateItem(singleSelectedItem.id, { weight: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                                        onBlur={(e) => { if (e.target.value === '' || isNaN(parseFloat(e.target.value))) onUpdateItem(singleSelectedItem.id, { weight: 10 }); }}
                                        step="0.1"
                                        style={inputStyle}
                                    />
                                </div>

                                <div style={formGroupStyle}>
                                    <label style={labelStyle}>Rotation (°)</label>
                                    <input
                                        type="number"
                                        value={Math.round(singleSelectedItem.statePositions?.[currentStateId]?.rotation ?? 0)}
                                        onChange={(e) => onUpdateItem(singleSelectedItem.id, { rotation: e.target.value === '' ? 0 : parseInt(e.target.value) })}
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

                                {/* Lock Status and Unlock Button */}
                                {singleSelectedItem.formationLocked && (
                                    <div style={{
                                        marginTop: '0.5rem',
                                        padding: '0.5rem',
                                        background: 'var(--bg-primary)',
                                        borderRadius: '4px',
                                        border: '1px solid var(--accent-color)'
                                    }}>
                                        <div style={{
                                            fontSize: '0.75rem',
                                            color: 'var(--accent-color)',
                                            fontWeight: 500,
                                            marginBottom: '0.5rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.25rem'
                                        }}>
                                            🔒 Formation Locked
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                            Drones will follow object movements
                                        </div>
                                        <button
                                            onClick={() => onUnlockFormation(singleSelectedItem.id)}
                                            disabled={isSimulating}
                                            style={{
                                                ...inputStyle,
                                                width: '100%',
                                                cursor: isSimulating ? 'not-allowed' : 'pointer',
                                                background: 'var(--bg-tertiary)',
                                                color: 'var(--text-secondary)',
                                                border: '1px solid var(--border-color)',
                                                fontSize: '0.75rem',
                                                padding: '0.375rem',
                                                opacity: isSimulating ? 0.6 : 1
                                            }}
                                        >
                                            🔓 Unlock Formation
                                        </button>
                                    </div>
                                )}

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

                        {/* Path Drawing Controls */}
                        {(singleSelectedItem.type === 'rectangle' || singleSelectedItem.type === 'circle' || singleSelectedItem.type === 'custom') && states.length > 1 && (
                            <div style={formGroupStyle}>
                                <label style={{ ...labelStyle, marginBottom: '0.5rem' }}>Transition Paths</label>

                                {states.map((state, idx) => {
                                    if (idx === states.length - 1) return null; // No path from last state

                                    const nextState = states[idx + 1];
                                    const pathKey = `${state.id}_to_${nextState.id}`;
                                    const hasCustomPath = singleSelectedItem.customTransitionPaths?.[pathKey];
                                    const isDrawing = pathDrawingMode?.objectId === singleSelectedItem.id &&
                                        pathDrawingMode?.fromStateId === state.id;

                                    return (
                                        <div key={pathKey} style={{
                                            marginBottom: '0.5rem',
                                            padding: '0.5rem',
                                            background: 'var(--bg-primary)',
                                            borderRadius: '4px'
                                        }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                                {state.name} → {nextState.name}
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button
                                                    onClick={() => onStartPathDrawing(singleSelectedItem.id, state.id, nextState.id)}
                                                    disabled={isSimulating || isDrawing}
                                                    style={{
                                                        ...inputStyle,
                                                        flex: 1,
                                                        cursor: (isSimulating || isDrawing) ? 'not-allowed' : 'pointer',
                                                        background: isDrawing ? 'var(--accent-color)' : 'var(--bg-tertiary)',
                                                        color: isDrawing ? 'white' : 'var(--text-primary)',
                                                        border: '1px solid var(--border-color)',
                                                        fontSize: '0.75rem',
                                                        padding: '0.375rem',
                                                        opacity: (isSimulating && !isDrawing) ? 0.6 : 1
                                                    }}
                                                >
                                                    {hasCustomPath ? '✏️ Edit' : '➕ Draw'} Path
                                                </button>

                                                <button
                                                    onClick={() => onAutoDrawPath(singleSelectedItem.id, state.id, nextState.id)}
                                                    disabled={isSimulating || isDrawing}
                                                    title="Auto-generate obstacle-avoiding path"
                                                    style={{
                                                        ...inputStyle,
                                                        cursor: (isSimulating || isDrawing) ? 'not-allowed' : 'pointer',
                                                        background: 'var(--bg-tertiary)',
                                                        color: '#10b981',
                                                        border: '1px solid var(--border-color)',
                                                        fontSize: '0.75rem',
                                                        padding: '0.375rem',
                                                        opacity: isSimulating ? 0.6 : 1
                                                    }}
                                                >
                                                    🤖 Auto
                                                </button>

                                                {hasCustomPath && (
                                                    <button
                                                        onClick={() => onClearPath(singleSelectedItem.id, state.id, nextState.id)}
                                                        disabled={isSimulating}
                                                        style={{
                                                            ...inputStyle,
                                                            cursor: isSimulating ? 'not-allowed' : 'pointer',
                                                            background: 'var(--bg-tertiary)',
                                                            color: '#ef4444',
                                                            border: '1px solid var(--border-color)',
                                                            fontSize: '0.75rem',
                                                            padding: '0.375rem',
                                                            opacity: isSimulating ? 0.6 : 1
                                                        }}
                                                    >
                                                        Clear
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Circle properties */}
                        {singleSelectedItem.type === 'circle' && (
                            <>
                                <div style={formGroupStyle}>
                                    <label style={labelStyle}>Radius</label>
                                    <input
                                        type="number"
                                        value={singleSelectedItem.radius ?? ''}
                                        onChange={(e) => onUpdateItem(singleSelectedItem.id, { radius: e.target.value === '' ? '' : parseInt(e.target.value) })}
                                        onBlur={(e) => { if (e.target.value === '' || isNaN(parseInt(e.target.value))) onUpdateItem(singleSelectedItem.id, { radius: 50 }); }}
                                        style={inputStyle}
                                    />
                                </div>

                                <div style={formGroupStyle}>
                                    <label style={labelStyle}>Weight (kg)</label>
                                    <input
                                        type="number"
                                        value={singleSelectedItem.weight ?? ''}
                                        onChange={(e) => onUpdateItem(singleSelectedItem.id, { weight: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                                        onBlur={(e) => { if (e.target.value === '' || isNaN(parseFloat(e.target.value))) onUpdateItem(singleSelectedItem.id, { weight: 10 }); }}
                                        step="0.1"
                                        style={inputStyle}
                                    />
                                </div>

                                <div style={formGroupStyle}>
                                    <label style={labelStyle}>Rotation (°)</label>
                                    <input
                                        type="number"
                                        value={Math.round(singleSelectedItem.statePositions?.[currentStateId]?.rotation ?? 0)}
                                        onChange={(e) => onUpdateItem(singleSelectedItem.id, { rotation: e.target.value === '' ? 0 : parseInt(e.target.value) })}
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

                        {/* Drone info and path controls */}
                        {singleSelectedItem.type === 'drone' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: '6px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                    {singleSelectedItem.droneType === 'air' ? '✈️ Air Drone' : '🚛 Ground Drone'}
                                    {singleSelectedItem.assignedObject && (
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--accent-color)' }}>
                                            🔗 Assigned to object
                                        </div>
                                    )}
                                </div>

                                {/* Path controls for drones with paths */}
                                {states.map((state, idx) => {
                                    if (idx === states.length - 1) return null;
                                    const nextState = states[idx + 1];
                                    const nextStatePos = singleSelectedItem.statePositions?.[nextState.id];
                                    const hasAutoPath = nextStatePos?.customPath && nextStatePos.customPath.length > 1;
                                    const pathType = nextStatePos?.pathType || 'auto';

                                    if (!nextStatePos) return null;

                                    let isLocked = false;
                                    if (singleSelectedItem.assignedObject) {
                                        const obj = items.find(i => i.id === singleSelectedItem.assignedObject);
                                        const dronePos = singleSelectedItem.statePositions?.[state.id];
                                        const objPos = obj?.statePositions?.[state.id];
                                        const offset = singleSelectedItem.relativeOffset;

                                        if (obj && dronePos && objPos && offset) {
                                            const rotRad = (objPos.rotation || 0) * Math.PI / 180;
                                            const expX = objPos.x + (offset.x * Math.cos(rotRad) - offset.y * Math.sin(rotRad));
                                            const expY = objPos.y + (offset.x * Math.sin(rotRad) + offset.y * Math.cos(rotRad));
                                            const dist = Math.hypot(dronePos.x - expX, dronePos.y - expY);
                                            // If drone is already at the formation position in the FROM state, 
                                            // then the movement to NEXT state should be locked (following object)
                                            isLocked = dist < 2;
                                        }
                                    }

                                    return (

                                        <div key={`${state.id}_${nextState.id}`} style={{
                                            padding: '0.5rem',
                                            background: 'var(--bg-primary)',
                                            borderRadius: '4px'
                                        }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                                {state.name} → {nextState.name}
                                            </div>

                                            {isLocked ? (
                                                <div style={{
                                                    fontSize: '0.75rem',
                                                    color: 'var(--text-secondary)',
                                                    fontStyle: 'italic',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.25rem'
                                                }}>
                                                    🔒 Path locked (Formation)
                                                </div>
                                            ) : (
                                                <>
                                                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                                        <select
                                                            value={pathType}
                                                            onChange={(e) => {
                                                                const newPathType = e.target.value;
                                                                const updatedPos = { ...nextStatePos, pathType: newPathType };
                                                                if (newPathType === 'direct') {
                                                                    delete updatedPos.customPath;
                                                                }
                                                                onUpdateItem(singleSelectedItem.id, {
                                                                    statePositions: {
                                                                        ...singleSelectedItem.statePositions,
                                                                        [nextState.id]: updatedPos
                                                                    }
                                                                });
                                                            }}
                                                            style={{
                                                                ...inputStyle,
                                                                fontSize: '0.7rem',
                                                                padding: '0.25rem 0.5rem',
                                                                flex: 1
                                                            }}
                                                        >
                                                            <option value="direct">Direct</option>
                                                            <option value="auto">Auto (avoid obstacles)</option>
                                                            <option value="draw">Custom</option>
                                                        </select>
                                                        {pathType === 'auto' && (
                                                            <button
                                                                onClick={() => onAutoDrawPath(singleSelectedItem.id, state.id, nextState.id)}
                                                                disabled={isSimulating}
                                                                style={{
                                                                    ...inputStyle,
                                                                    fontSize: '0.7rem',
                                                                    padding: '0.25rem 0.5rem',
                                                                    cursor: isSimulating ? 'not-allowed' : 'pointer',
                                                                    background: 'var(--bg-tertiary)',
                                                                    color: '#10b981',
                                                                    width: 'auto'
                                                                }}
                                                            >
                                                                Recalc
                                                            </button>
                                                        )}
                                                        {pathType === 'draw' && (
                                                            <button
                                                                onClick={() => onStartPathDrawing(singleSelectedItem.id, state.id, nextState.id)}
                                                                disabled={isSimulating}
                                                                style={{
                                                                    ...inputStyle,
                                                                    fontSize: '0.7rem',
                                                                    padding: '0.25rem 0.5rem',
                                                                    cursor: isSimulating ? 'not-allowed' : 'pointer',
                                                                    background: 'var(--bg-tertiary)',
                                                                    color: 'var(--accent-color)',
                                                                    width: 'auto'
                                                                }}
                                                            >
                                                                ✏️ Draw
                                                            </button>
                                                        )}
                                                    </div>
                                                    {hasAutoPath && (
                                                        <div style={{ fontSize: '0.65rem', color: '#10b981', marginTop: '0.25rem' }}>
                                                            ✓ {nextStatePos.customPath.length} waypoints
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    );

                                })}
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
