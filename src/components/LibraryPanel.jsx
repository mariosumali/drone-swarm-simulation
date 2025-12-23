import React, { useState } from 'react';
import { Plane, Square, Circle, Pencil, Truck, Eye, Trash2, Edit3, ChevronDown, ChevronRight, Plus, Triangle, Hexagon, Star, Activity } from 'lucide-react';

export function LibraryPanel({
    items = [],
    selectedIds = new Set(),
    onSelect,
    onUpdateItem,
    onDelete,
    currentStateId,
    showPathTracking,
    onTogglePathTracking,
    showDronePaths,
    onToggleDronePaths,
    showForceVectors,
    onToggleForceVectors,
    show3DMode
}) {
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [hoveredId, setHoveredId] = useState(null);
    const [showDroneMenu, setShowDroneMenu] = useState(false);
    const [showObjectMenu, setShowObjectMenu] = useState(false);

    const handleDragStart = (e, type) => {
        if (show3DMode) {
            e.preventDefault();
            return;
        }
        e.dataTransfer.setData('application/react-dnd-type', type);
        e.dataTransfer.effectAllowed = 'copy';
    };

    const draggableStyle = {
        padding: '0.75rem',
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        cursor: show3DMode ? 'not-allowed' : 'grab',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        transition: 'all 0.2s',
        opacity: show3DMode ? 0.5 : 1
    };

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
        if (editingId && editName.trim() && onUpdateItem) {
            onUpdateItem(editingId, { customId: editName.trim() });
        }
        setEditingId(null);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleFinishEdit();
        else if (e.key === 'Escape') setEditingId(null);
    };

    const visibleItems = items.filter(item =>
        item.activeStates?.includes(currentStateId)
    );

    return (
        <div style={{
            width: '280px',
            borderRight: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflowY: 'auto',
            position: 'relative',
            zIndex: 10
        }}>
            {/* Library Section - Compact */}
            <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)', position: 'relative' }}>
                <h2 style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                    Library
                </h2>

                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    opacity: show3DMode ? 0.3 : 1,
                    pointerEvents: show3DMode ? 'none' : 'auto',
                    filter: show3DMode ? 'grayscale(100%)' : 'none'
                }}>
                    {/* Add Drone - Side Menu */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => { setShowDroneMenu(!showDroneMenu); setShowObjectMenu(false); }}
                            style={{
                                width: '100%',
                                padding: '0.5rem 0.75rem',
                                background: showDroneMenu ? 'var(--accent-color)' : 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                color: showDroneMenu ? 'white' : 'var(--text-primary)',
                                fontSize: '0.8rem',
                                fontWeight: 500
                            }}
                        >
                            <Plus size={14} style={{ color: showDroneMenu ? 'white' : '#60a5fa' }} />
                            <span style={{ flex: 1, textAlign: 'left' }}>Add Drone</span>
                            <ChevronRight size={14} />
                        </button>
                        {showDroneMenu && (
                            <div style={{
                                position: 'fixed',
                                left: '280px',
                                top: 'auto',
                                marginTop: '-32px',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                zIndex: 1000,
                                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                minWidth: '160px'
                            }}>
                                <div
                                    draggable={true}
                                    onDragStart={(e) => handleDragStart(e, 'drone-air')}
                                    onDragEnd={() => setShowDroneMenu(false)}
                                    style={{
                                        padding: '0.5rem 0.75rem',
                                        cursor: 'grab',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        borderBottom: '1px solid var(--border-color)',
                                        background: 'var(--bg-tertiary)'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-primary)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                >
                                    <Plane size={14} style={{ color: '#60a5fa' }} />
                                    <span style={{ fontSize: '0.75rem' }}>Air Drone</span>
                                    <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>Surface</span>
                                </div>
                                <div
                                    draggable={true}
                                    onDragStart={(e) => handleDragStart(e, 'drone-ground')}
                                    onDragEnd={() => setShowDroneMenu(false)}
                                    style={{
                                        padding: '0.5rem 0.75rem',
                                        cursor: 'grab',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        background: 'var(--bg-tertiary)'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-primary)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                >
                                    <Truck size={14} style={{ color: '#8b5cf6' }} />
                                    <span style={{ fontSize: '0.75rem' }}>Ground Drone</span>
                                    <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>Perimeter</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Add Object - Side Menu */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => { setShowObjectMenu(!showObjectMenu); setShowDroneMenu(false); }}
                            style={{
                                width: '100%',
                                padding: '0.5rem 0.75rem',
                                background: showObjectMenu ? 'var(--accent-color)' : 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                color: showObjectMenu ? 'white' : 'var(--text-primary)',
                                fontSize: '0.8rem',
                                fontWeight: 500
                            }}
                        >
                            <Plus size={14} style={{ color: showObjectMenu ? 'white' : '#f472b6' }} />
                            <span style={{ flex: 1, textAlign: 'left' }}>Add Object</span>
                            <ChevronRight size={14} />
                        </button>
                        {showObjectMenu && (
                            <div style={{
                                position: 'fixed',
                                left: '280px',
                                top: 'auto',
                                marginTop: '-32px',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                zIndex: 1000,
                                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                minWidth: '140px'
                            }}>
                                <div
                                    draggable={true}
                                    onDragStart={(e) => handleDragStart(e, 'rectangle')}
                                    onDragEnd={() => setShowObjectMenu(false)}
                                    style={{
                                        padding: '0.5rem 0.75rem',
                                        cursor: 'grab',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        borderBottom: '1px solid var(--border-color)',
                                        background: 'var(--bg-tertiary)'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-primary)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                >
                                    <Square size={14} style={{ color: '#f472b6' }} />
                                    <span style={{ fontSize: '0.75rem' }}>Rectangle</span>
                                </div>
                                <div
                                    draggable={true}
                                    onDragStart={(e) => handleDragStart(e, 'circle')}
                                    onDragEnd={() => setShowObjectMenu(false)}
                                    style={{
                                        padding: '0.5rem 0.75rem',
                                        cursor: 'grab',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        borderBottom: '1px solid var(--border-color)',
                                        background: 'var(--bg-tertiary)'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-primary)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                >
                                    <Circle size={14} style={{ color: '#f472b6' }} />
                                    <span style={{ fontSize: '0.75rem' }}>Circle</span>
                                </div>
                                <div
                                    draggable={true}
                                    onDragStart={(e) => handleDragStart(e, 'triangle')}
                                    onDragEnd={() => setShowObjectMenu(false)}
                                    style={{
                                        padding: '0.5rem 0.75rem',
                                        cursor: 'grab',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        borderBottom: '1px solid var(--border-color)',
                                        background: 'var(--bg-tertiary)'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-primary)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                >
                                    <Triangle size={14} style={{ color: '#f472b6' }} />
                                    <span style={{ fontSize: '0.75rem' }}>Triangle</span>
                                </div>
                                <div
                                    draggable={true}
                                    onDragStart={(e) => handleDragStart(e, 'hexagon')}
                                    onDragEnd={() => setShowObjectMenu(false)}
                                    style={{
                                        padding: '0.5rem 0.75rem',
                                        cursor: 'grab',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        borderBottom: '1px solid var(--border-color)',
                                        background: 'var(--bg-tertiary)'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-primary)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                >
                                    <Hexagon size={14} style={{ color: '#f472b6' }} />
                                    <span style={{ fontSize: '0.75rem' }}>Hexagon</span>
                                </div>
                                <div
                                    draggable={true}
                                    onDragStart={(e) => handleDragStart(e, 'star')}
                                    onDragEnd={() => setShowObjectMenu(false)}
                                    style={{
                                        padding: '0.5rem 0.75rem',
                                        cursor: 'grab',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        background: 'var(--bg-tertiary)'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-primary)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                >
                                    <Star size={14} style={{ color: '#f472b6' }} />
                                    <span style={{ fontSize: '0.75rem' }}>Star</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <button style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        color: 'var(--text-primary)',
                        fontSize: '0.8rem',
                        fontWeight: 500
                    }}>
                        <Pencil size={14} style={{ color: '#4ade80' }} />
                        <span style={{ flex: 1, textAlign: 'left' }}>Custom Object</span>
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>Draw</span>
                    </button>
                </div>

                {show3DMode && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(0,0,0,0.2)',
                        backdropFilter: 'blur(2px)',
                        zIndex: 10,
                        borderRadius: '8px',
                        padding: '1rem',
                        textAlign: 'center'
                    }}>
                        <div style={{
                            background: 'var(--bg-secondary)',
                            padding: '0.5rem 1rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)'
                        }}>
                            <div style={{ fontWeight: 600, color: 'var(--accent-color)', marginBottom: '0.25rem' }}>
                                Under Construction
                            </div>
                            <div>Right-click in 3D scene<br />to add objects</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Entities Section - Same style as original EntityList */}
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                <h2 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                    Entities ({visibleItems.length})
                </h2>

                {/* Objects Path Tracking */}
                <div style={{
                    padding: '0.5rem',
                    background: 'var(--bg-primary)',
                    borderRadius: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    marginBottom: '0.5rem'
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
                            {visibleItems.filter(item => item.type === 'drone').map((item) => {
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

                {/* Force Visualization */}
                <div style={{
                    marginTop: '0.5rem',
                    padding: '0.5rem',
                    background: 'var(--bg-primary)',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Force Vectors
                    </span>
                    <button
                        onClick={onToggleForceVectors}
                        style={{
                            padding: '0.25rem 0.5rem',
                            background: showForceVectors ? '#f59e0b' : 'var(--bg-tertiary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            color: showForceVectors ? 'white' : 'var(--text-secondary)',
                            fontSize: '0.65rem',
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                        }}
                    >
                        <Activity size={10} />
                        {showForceVectors ? 'Hide Forces' : 'Show Forces'}
                    </button>
                </div>
            </div>

            {/* Entity List - Hierarchical Structure */}
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
                        {/* Objects with nested drones */}
                        {visibleItems.filter(item => item.type !== 'drone').map(item => {
                            const isSelected = selectedIds.has(item.id);
                            const isHovered = hoveredId === item.id;
                            const color = getEntityColor(item.type);
                            const assignedDrones = visibleItems.filter(d => d.lockedToObject === item.id);
                            const hasChildren = assignedDrones.length > 0;

                            return (
                                <div key={item.id} style={{ marginBottom: '0.5rem' }}>
                                    {/* Object Card */}
                                    <div
                                        onClick={() => onSelect && onSelect(new Set([item.id]))}
                                        onMouseEnter={() => setHoveredId(item.id)}
                                        onMouseLeave={() => setHoveredId(null)}
                                        style={{
                                            padding: '0.75rem',
                                            background: isSelected ? 'var(--accent-color)' : (isHovered ? 'var(--bg-tertiary)' : 'transparent'),
                                            border: `1px solid ${isSelected ? 'var(--accent-color)' : 'var(--border-color)'}`,
                                            borderRadius: hasChildren ? '8px 8px 0 0' : '8px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem'
                                        }}
                                    >
                                        {/* Expand indicator */}
                                        <div style={{ color: isSelected ? 'white' : 'var(--text-secondary)', width: '16px' }}>
                                            {hasChildren ? <ChevronDown size={14} /> : <span style={{ width: '14px' }} />}
                                        </div>

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
                                                <>
                                                    <div style={{
                                                        fontSize: '0.875rem',
                                                        fontWeight: 500,
                                                        color: isSelected ? 'white' : 'var(--text-primary)',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {item.customId || `${item.type}_${item.id.slice(0, 4)}`}
                                                        {item.formationLocked && ' 🔒'}
                                                    </div>
                                                    <div style={{
                                                        fontSize: '0.7rem',
                                                        color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)'
                                                    }}>
                                                        {item.type} • {assignedDrones.length} drones
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* Rename button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleStartEdit(item);
                                            }}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)',
                                                cursor: 'pointer',
                                                padding: '0.25rem',
                                                display: 'flex'
                                            }}
                                            title="Rename"
                                        >
                                            <Edit3 size={14} />
                                        </button>

                                        {/* Delete button */}
                                        {isSelected && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (onDelete) onDelete(new Set([item.id]));
                                                }}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: 'rgba(255,255,255,0.7)',
                                                    cursor: 'pointer',
                                                    padding: '0.25rem',
                                                    display: 'flex'
                                                }}
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Nested Assigned Drones */}
                                    {assignedDrones.length > 0 && (
                                        <div style={{
                                            marginLeft: '1rem',
                                            borderLeft: '2px solid var(--border-color)',
                                            paddingLeft: '0.5rem',
                                            marginTop: '-1px'
                                        }}>
                                            {assignedDrones.map(drone => {
                                                const isDroneSelected = selectedIds.has(drone.id);
                                                const isDroneHovered = hoveredId === drone.id;
                                                const droneColor = drone.droneType === 'air' ? '#60a5fa' : '#8b5cf6';

                                                return (
                                                    <div
                                                        key={drone.id}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onSelect && onSelect(new Set([drone.id]));
                                                        }}
                                                        onMouseEnter={() => setHoveredId(drone.id)}
                                                        onMouseLeave={() => setHoveredId(null)}
                                                        style={{
                                                            padding: '0.5rem',
                                                            background: isDroneSelected ? droneColor : (isDroneHovered ? 'var(--bg-tertiary)' : 'transparent'),
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.5rem',
                                                            marginBottom: '0.25rem'
                                                        }}
                                                    >
                                                        <div style={{
                                                            padding: '0.25rem',
                                                            background: isDroneSelected ? 'rgba(255,255,255,0.2)' : `${droneColor}20`,
                                                            borderRadius: '4px',
                                                            color: isDroneSelected ? 'white' : droneColor,
                                                            display: 'flex'
                                                        }}>
                                                            {drone.droneType === 'air' ? <Plane size={12} /> : <Truck size={12} />}
                                                        </div>

                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            {editingId === drone.id ? (
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
                                                                        padding: '0.125rem 0.25rem',
                                                                        color: 'var(--text-primary)',
                                                                        fontSize: '0.75rem',
                                                                        width: '100%'
                                                                    }}
                                                                />
                                                            ) : (
                                                                <div style={{
                                                                    fontSize: '0.75rem',
                                                                    color: isDroneSelected ? 'white' : 'var(--text-primary)',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    whiteSpace: 'nowrap'
                                                                }}>
                                                                    {drone.customId || `${drone.droneType}_${drone.id.slice(0, 4)}`}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Rename button for drone */}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleStartEdit(drone);
                                                            }}
                                                            style={{
                                                                background: 'transparent',
                                                                border: 'none',
                                                                color: isDroneSelected ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)',
                                                                cursor: 'pointer',
                                                                padding: '0.125rem',
                                                                display: 'flex'
                                                            }}
                                                            title="Rename"
                                                        >
                                                            <Edit3 size={10} />
                                                        </button>

                                                        {isDroneSelected && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (onDelete) onDelete(new Set([drone.id]));
                                                                }}
                                                                style={{
                                                                    background: 'transparent',
                                                                    border: 'none',
                                                                    color: 'rgba(255,255,255,0.7)',
                                                                    cursor: 'pointer',
                                                                    padding: '0.125rem',
                                                                    display: 'flex'
                                                                }}
                                                                title="Delete"
                                                            >
                                                                <Trash2 size={10} />
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Unassigned Drones Section */}
                        {visibleItems.filter(d => d.type === 'drone' && !d.lockedToObject).length > 0 && (
                            <div style={{ marginTop: '1rem' }}>
                                <div style={{
                                    fontSize: '0.7rem',
                                    textTransform: 'uppercase',
                                    color: 'var(--text-secondary)',
                                    marginBottom: '0.5rem',
                                    paddingLeft: '0.5rem'
                                }}>
                                    Unassigned Drones
                                </div>
                                {visibleItems.filter(d => d.type === 'drone' && !d.lockedToObject).map(drone => {
                                    const isDroneSelected = selectedIds.has(drone.id);
                                    const isDroneHovered = hoveredId === drone.id;
                                    const droneColor = drone.droneType === 'air' ? '#60a5fa' : '#8b5cf6';

                                    return (
                                        <div
                                            key={drone.id}
                                            onClick={() => onSelect && onSelect(new Set([drone.id]))}
                                            onMouseEnter={() => setHoveredId(drone.id)}
                                            onMouseLeave={() => setHoveredId(null)}
                                            style={{
                                                padding: '0.75rem',
                                                background: isDroneSelected ? droneColor : (isDroneHovered ? 'var(--bg-tertiary)' : 'transparent'),
                                                border: `1px solid ${isDroneSelected ? droneColor : 'var(--border-color)'}`,
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                marginBottom: '0.5rem'
                                            }}
                                        >
                                            <div style={{
                                                padding: '0.5rem',
                                                background: isDroneSelected ? 'rgba(255,255,255,0.2)' : `${droneColor}20`,
                                                borderRadius: '6px',
                                                color: isDroneSelected ? 'white' : droneColor,
                                                display: 'flex'
                                            }}>
                                                {drone.droneType === 'air' ? <Plane size={16} /> : <Truck size={16} />}
                                            </div>

                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                {editingId === drone.id ? (
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
                                                    <>
                                                        <div style={{
                                                            fontSize: '0.875rem',
                                                            fontWeight: 500,
                                                            color: isDroneSelected ? 'white' : 'var(--text-primary)'
                                                        }}>
                                                            {drone.customId || `${drone.droneType}_${drone.id.slice(0, 4)}`}
                                                        </div>
                                                        <div style={{
                                                            fontSize: '0.7rem',
                                                            color: isDroneSelected ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)'
                                                        }}>
                                                            {drone.droneType} • unassigned
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            {/* Rename button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleStartEdit(drone);
                                                }}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: isDroneSelected ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)',
                                                    cursor: 'pointer',
                                                    padding: '0.25rem',
                                                    display: 'flex'
                                                }}
                                                title="Rename"
                                            >
                                                <Edit3 size={14} />
                                            </button>

                                            {isDroneSelected && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (onDelete) onDelete(new Set([drone.id]));
                                                    }}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: 'rgba(255,255,255,0.7)',
                                                        cursor: 'pointer',
                                                        padding: '0.25rem',
                                                        display: 'flex'
                                                    }}
                                                    title="Delete"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

