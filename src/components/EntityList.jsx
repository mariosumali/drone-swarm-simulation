import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Plane, Square, Circle, Pencil, Eye, EyeOff, Trash2, Truck } from 'lucide-react';

export function EntityList({ items, selectedIds, onSelect, onUpdateItem, onDelete, currentStateId, showPathTracking, onTogglePathTracking, showDronePaths, onToggleDronePaths }) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [hoveredId, setHoveredId] = useState(null);

    const getEntityIcon = (type) => {
        switch (type) {
            case 'drone': return <Plane size={16} />;
            case 'rectangle': return <Square size={16} />;
            case 'circle': return <Circle size={16} />;
            case 'custom': return <Pencil size={16} />;
            default: return <Square size={16} />;
        }
    };

    const getEntityColor = (type) => {
        switch (type) {
            case 'drone': return '#818cf8';
            case 'rectangle':
            case 'circle': return '#f472b6';
            case 'custom': return '#4ade80';
            default: return '#a1a1aa';
        }
    };

    const handleStartEdit = (item) => {
        setEditingId(item.id);
        setEditName(item.customId || item.id.slice(0, 8));
    };

    const handleFinishEdit = () => {
        if (editingId && editName.trim()) {
            onUpdateItem(editingId, { customId: editName.trim() });
        }
        setEditingId(null);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleFinishEdit();
        } else if (e.key === 'Escape') {
            setEditingId(null);
        }
    };

    const visibleItems = items.filter(item =>
        item.activeStates?.includes(currentStateId)
    );

    if (!isExpanded) {
        return (
            <div style={{
                position: 'absolute',
                left: 0,
                top: '60px',
                bottom: '80px',
                width: '50px',
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(10px)',
                borderRight: '1px solid var(--glass-border)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '1rem 0',
                gap: '0.5rem',
                zIndex: 100
            }}>
                <button
                    onClick={() => setIsExpanded(true)}
                    style={{
                        background: 'var(--accent-color)',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.5rem',
                        cursor: 'pointer',
                        color: 'white',
                        display: 'flex'
                    }}
                    title="Expand Entity List"
                >
                    <ChevronRight size={20} />
                </button>
                <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    writingMode: 'vertical-rl',
                    textOrientation: 'mixed'
                }}>
                    {visibleItems.length}
                </div>
            </div>
        );
    }

    return (
        <div style={{
            position: 'absolute',
            left: 0,
            top: '60px',
            bottom: '80px',
            width: '300px',
            background: 'var(--bg-secondary)',
            borderRight: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 100
        }}>
            {/* Header */}
            <div style={{
                padding: '1rem',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Entities ({visibleItems.length})
                        </h3>
                    </div>
                    <button
                        onClick={() => setIsExpanded(false)}
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

                {/* Objects Path Tracking */}
                <div style={{
                    padding: '0.5rem',
                    background: 'var(--bg-primary)',
                    borderRadius: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Objects ({visibleItems.filter(i => i.type !== 'drone').length})
                        </span>
                        <button
                            onClick={onTogglePathTracking}
                            style={{
                                padding: '0.25rem 0.5rem',
                                background: showPathTracking ? 'var(--accent-color)' : 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                color: showPathTracking ? 'white' : 'var(--text-secondary)',
                                fontSize: '0.65rem',
                                fontWeight: 500,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                            }}
                        >
                            <Eye size={10} />
                            {showPathTracking ? 'Hide Paths' : 'Show Paths'}
                        </button>
                    </div>
                    {/* Object Path Legend */}
                    {showPathTracking && visibleItems.filter(item => item.type !== 'drone').length > 0 && (
                        <div style={{ fontSize: '0.65rem' }}>
                            {visibleItems.filter(item => item.type !== 'drone').map((item, idx) => {
                                const hue = (idx * 137.5) % 360;
                                const pathColor = `hsl(${hue}, 70%, 60%)`;
                                return (
                                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                        <div style={{
                                            width: '16px',
                                            height: '2px',
                                            background: pathColor,
                                            borderRadius: '1px'
                                        }} />
                                        <span style={{ color: 'var(--text-primary)' }}>
                                            {item.customId || `${item.type}_${item.id.slice(0, 4)}`}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Drones Path Tracking */}
                <div style={{
                    padding: '0.5rem',
                    background: 'var(--bg-primary)',
                    borderRadius: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Drones ({visibleItems.filter(i => i.type === 'drone').length})
                        </span>
                        <button
                            onClick={onToggleDronePaths}
                            style={{
                                padding: '0.25rem 0.5rem',
                                background: showDronePaths ? '#60a5fa' : 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                color: showDronePaths ? 'white' : 'var(--text-secondary)',
                                fontSize: '0.65rem',
                                fontWeight: 500,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                            }}
                        >
                            <Eye size={10} />
                            {showDronePaths ? 'Hide Paths' : 'Show Paths'}
                        </button>
                    </div>
                    {/* Drone Path Legend */}
                    {showDronePaths && visibleItems.filter(item => item.type === 'drone').length > 0 && (
                        <div style={{ fontSize: '0.65rem' }}>
                            {visibleItems.filter(item => item.type === 'drone').map((item, idx) => {
                                const droneColor = item.droneType === 'air' ? '#60a5fa' : '#8b5cf6';
                                return (
                                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                        <div style={{
                                            width: '16px',
                                            height: '2px',
                                            background: droneColor,
                                            borderRadius: '1px'
                                        }} />
                                        <span style={{ color: 'var(--text-primary)' }}>
                                            {item.droneType === 'air' ? '✈️' : '🚛'} {item.customId || `drone_${item.id.slice(0, 4)}`}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Entity List */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '0.5rem'
            }}>
                {visibleItems.length === 0 ? (
                    <div style={{
                        padding: '2rem 1rem',
                        textAlign: 'center',
                        color: 'var(--text-secondary)',
                        fontSize: '0.875rem'
                    }}>
                        No entities in current state
                    </div>
                ) : (
                    <>
                        {/* Objects with locked drones */}
                        {visibleItems.filter(item => item.type !== 'drone').map(item => {
                            const isSelected = selectedIds.has(item.id);
                            const isHovered = hoveredId === item.id;
                            const color = getEntityColor(item.type);
                            const lockedDrones = visibleItems.filter(d => d.lockedToObject === item.id);

                            return (
                                <div key={item.id} style={{ marginBottom: '0.75rem' }}>
                                    {/* Object */}
                                    <div
                                        onClick={() => onSelect(new Set([item.id]))}
                                        onMouseEnter={() => setHoveredId(item.id)}
                                        onMouseLeave={() => setHoveredId(null)}
                                        style={{
                                            padding: '0.75rem',
                                            background: isSelected ? 'var(--accent-color)' : (isHovered ? 'var(--bg-tertiary)' : 'transparent'),
                                            border: `1px solid ${isSelected ? 'var(--accent-color)' : 'var(--border-color)'}`,
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem'
                                        }}
                                    >
                                        {/* Icon */}
                                        <div style={{
                                            padding: '0.5rem',
                                            background: isSelected ? 'rgba(255,255,255,0.2)' : `${color}20`,
                                            borderRadius: '6px',
                                            color: isSelected ? 'white' : color,
                                            display: 'flex',
                                            flexShrink: 0
                                        }}>
                                            {getEntityIcon(item.type)}
                                        </div>

                                        {/* Info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            {editingId === item.id ? (
                                                <input
                                                    type="text"
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    onBlur={handleFinishEdit}
                                                    onKeyDown={handleKeyDown}
                                                    autoFocus
                                                    onClick={(e) => e.stopPropagation()}
                                                    style={{
                                                        background: 'var(--bg-primary)',
                                                        border: '1px solid var(--border-color)',
                                                        borderRadius: '4px',
                                                        padding: '0.25rem 0.5rem',
                                                        color: 'var(--text-primary)',
                                                        fontSize: '0.875rem',
                                                        width: '100%'
                                                    }}
                                                />
                                            ) : (
                                                <div
                                                    onDoubleClick={(e) => {
                                                        e.stopPropagation();
                                                        handleStartEdit(item);
                                                    }}
                                                    style={{
                                                        fontSize: '0.875rem',
                                                        fontWeight: 500,
                                                        color: isSelected ? 'white' : 'var(--text-primary)',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    {item.customId || `${item.type}_${item.id.slice(0, 4)}`}
                                                    {item.formationLocked && ' 🔒'}
                                                </div>
                                            )}
                                            <div style={{
                                                fontSize: '0.75rem',
                                                color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)',
                                                marginTop: '0.125rem'
                                            }}>
                                                {item.type} • {lockedDrones.length > 0 ? `${lockedDrones.length} drones` : `${item.activeStates?.length || 0} states`}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDelete(new Set([item.id]));
                                            }}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                padding: '0.25rem',
                                                cursor: 'pointer',
                                                color: isSelected ? 'white' : '#ef4444',
                                                display: 'flex',
                                                opacity: isHovered || isSelected ? 1 : 0,
                                                transition: 'opacity 0.2s'
                                            }}
                                            title="Delete"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>

                                    {/* Locked Drones */}
                                    {lockedDrones.length > 0 && (
                                        <div style={{ marginLeft: '1.5rem', marginTop: '0.25rem' }}>
                                            {lockedDrones.map(drone => {
                                                const isDroneSelected = selectedIds.has(drone.id);
                                                const isDroneHovered = hoveredId === drone.id;
                                                const droneColor = drone.droneType === 'ground' ? '#8b5cf6' : '#60a5fa';

                                                return (
                                                    <div
                                                        key={drone.id}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onSelect(new Set([drone.id]));
                                                        }}
                                                        onMouseEnter={() => setHoveredId(drone.id)}
                                                        onMouseLeave={() => setHoveredId(null)}
                                                        style={{
                                                            padding: '0.5rem',
                                                            marginBottom: '0.25rem',
                                                            background: isDroneSelected ? droneColor : (isDroneHovered ? 'var(--bg-tertiary)' : 'transparent'),
                                                            border: `1px solid ${isDroneSelected ? droneColor : 'var(--border-color)'}`,
                                                            borderLeft: `3px solid ${droneColor}`,
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.5rem',
                                                            fontSize: '0.8rem'
                                                        }}
                                                    >
                                                        <div style={{ color: isDroneSelected ? 'white' : droneColor }}>
                                                            {drone.droneType === 'ground' ? '🚗' : '✈️'}
                                                        </div>
                                                        <div style={{
                                                            flex: 1,
                                                            color: isDroneSelected ? 'white' : 'var(--text-primary)',
                                                            fontSize: '0.75rem',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis'
                                                        }}>
                                                            {drone.customId || `drone_${drone.id.slice(0, 4)}`}
                                                        </div>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onDelete(new Set([drone.id]));
                                                            }}
                                                            style={{
                                                                background: 'transparent',
                                                                border: 'none',
                                                                padding: '0.25rem',
                                                                cursor: 'pointer',
                                                                color: isDroneSelected ? 'white' : '#ef4444',
                                                                display: 'flex',
                                                                opacity: isDroneHovered || isDroneSelected ? 1 : 0,
                                                                transition: 'opacity 0.2s'
                                                            }}
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Free drones (not locked to any object) */}
                        {visibleItems.filter(item => item.type === 'drone' && !item.lockedToObject).map(item => {
                            const isSelected = selectedIds.has(item.id);
                            const isHovered = hoveredId === item.id;
                            const color = item.droneType === 'ground' ? '#8b5cf6' : '#60a5fa';

                            return (
                                <div
                                    key={item.id}
                                    onClick={() => onSelect(new Set([item.id]))}
                                    onMouseEnter={() => setHoveredId(item.id)}
                                    onMouseLeave={() => setHoveredId(null)}
                                    style={{
                                        padding: '0.75rem',
                                        marginBottom: '0.5rem',
                                        background: isSelected ? color : (isHovered ? 'var(--bg-tertiary)' : 'transparent'),
                                        border: `1px solid ${isSelected ? color : 'var(--border-color)'}`,
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem'
                                    }}
                                >
                                    <div style={{
                                        padding: '0.5rem',
                                        background: isSelected ? 'rgba(255,255,255,0.2)' : `${color}20`,
                                        borderRadius: '6px',
                                        color: isSelected ? 'white' : color,
                                        display: 'flex',
                                        flexShrink: 0
                                    }}>
                                        {item.droneType === 'ground' ? '🚗' : '✈️'}
                                    </div>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontSize: '0.875rem',
                                            fontWeight: 500,
                                            color: isSelected ? 'white' : 'var(--text-primary)',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {item.customId || `drone_${item.id.slice(0, 4)}`}
                                        </div>
                                        <div style={{
                                            fontSize: '0.75rem',
                                            color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)',
                                            marginTop: '0.125rem'
                                        }}>
                                            {item.droneType} • free
                                        </div>
                                    </div>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete(new Set([item.id]));
                                        }}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            padding: '0.25rem',
                                            cursor: 'pointer',
                                            color: isSelected ? 'white' : '#ef4444',
                                            display: 'flex',
                                            opacity: isHovered || isSelected ? 1 : 0,
                                            transition: 'opacity 0.2s'
                                        }}
                                        title="Delete"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            );
                        })}
                    </>
                )}
            </div>
        </div>
    );
}
