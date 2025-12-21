import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Layers, Plane, Square, Circle, Pencil, Eye, EyeOff, Trash2 } from 'lucide-react';

export function EntityList({ items, selectedIds, onSelect, onUpdateItem, onDelete, currentStateId }) {
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
                    <ChevronLeft size={20} />
                </button>
                <div style={{
                    background: 'var(--bg-tertiary)',
                    borderRadius: '6px',
                    padding: '0.5rem',
                    color: 'var(--text-secondary)'
                }}>
                    <Layers size={20} />
                </div>
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
            right: 0,
            top: '60px',
            bottom: '80px',
            width: '300px',
            background: 'var(--bg-secondary)',
            borderLeft: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 100
        }}>
            {/* Header */}
            <div style={{
                padding: '1rem',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Layers size={18} color="var(--accent-color)" />
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
                    visibleItems.map(item => {
                        const isSelected = selectedIds.has(item.id);
                        const isHovered = hoveredId === item.id;
                        const color = getEntityColor(item.type);

                        return (
                            <div
                                key={item.id}
                                onClick={() => onSelect(new Set([item.id]))}
                                onMouseEnter={() => setHoveredId(item.id)}
                                onMouseLeave={() => setHoveredId(null)}
                                style={{
                                    padding: '0.75rem',
                                    marginBottom: '0.5rem',
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
                                        </div>
                                    )}
                                    <div style={{
                                        fontSize: '0.75rem',
                                        color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)',
                                        marginTop: '0.125rem'
                                    }}>
                                        {item.type} • {item.activeStates?.length || 0} states
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
                        );
                    })
                )}
            </div>
        </div>
    );
}
