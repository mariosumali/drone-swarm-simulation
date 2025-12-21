import React, { useState } from 'react';
import { Plus, Trash2, Play, Pause, Square, Zap } from 'lucide-react';

export function Timeline({
    states, currentStateId, onStateChange, onAddState, onDeleteState, onUpdateStateName,
    isSimulating, onToggleSimulation, onStopSimulation, playbackSpeed, onPlaybackSpeedChange, animationProgress
}) {
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');

    const handleStartEdit = (state) => {
        setEditingId(state.id);
        setEditName(state.name);
    };

    const handleFinishEdit = () => {
        if (editingId && editName.trim()) {
            onUpdateStateName(editingId, editName.trim());
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

    return (
        <div style={{
            height: '80px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 1.5rem',
            gap: '1rem',
            flexShrink: 0
        }}>
            {/* Simulation Controls */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                    onClick={onToggleSimulation}
                    disabled={states.length < 2}
                    style={{
                        padding: '0.75rem',
                        background: isSimulating ? 'var(--accent-color)' : 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        color: isSimulating ? 'white' : 'var(--text-primary)',
                        cursor: states.length < 2 ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        opacity: states.length < 2 ? 0.5 : 1
                    }}
                    title={isSimulating ? 'Pause' : 'Play'}
                >
                    {isSimulating ? <Pause size={20} /> : <Play size={20} />}
                </button>
                <button
                    onClick={onStopSimulation}
                    disabled={!isSimulating}
                    style={{
                        padding: '0.75rem',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        cursor: isSimulating ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        opacity: isSimulating ? 1 : 0.5
                    }}
                    title="Stop"
                >
                    <Square size={20} />
                </button>

                {/* Speed Control */}
                <div style={{ display: 'flex', gap: '0.25rem', marginLeft: '0.5rem' }}>
                    {[0.5, 1, 2].map(speed => (
                        <button
                            key={speed}
                            onClick={() => onPlaybackSpeedChange(speed)}
                            style={{
                                padding: '0.5rem 0.75rem',
                                background: playbackSpeed === speed ? 'var(--accent-color)' : 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                color: playbackSpeed === speed ? 'white' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: 500
                            }}
                        >
                            {speed}x
                        </button>
                    ))}
                </div>
            </div>

            {/* Timeline States */}
            <div style={{
                flex: 1,
                display: 'flex',
                gap: '0.75rem',
                overflowX: 'auto',
                alignItems: 'center'
            }}>
                {states.map((state, index) => (
                    <div
                        key={state.id}
                        onClick={() => onStateChange(state.id)}
                        style={{
                            minWidth: '120px',
                            padding: '0.75rem 1rem',
                            background: state.id === currentStateId
                                ? 'var(--accent-color)'
                                : 'var(--bg-tertiary)',
                            border: `2px solid ${state.id === currentStateId ? 'var(--accent-color)' : 'var(--border-color)'}`,
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            position: 'relative',
                            userSelect: 'none'
                        }}
                        onMouseEnter={(e) => {
                            if (state.id !== currentStateId) {
                                e.currentTarget.style.borderColor = 'var(--accent-color)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (state.id !== currentStateId) {
                                e.currentTarget.style.borderColor = 'var(--border-color)';
                            }
                        }}
                    >
                        {/* State number badge */}
                        <div style={{
                            position: 'absolute',
                            top: '-8px',
                            left: '8px',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            padding: '0.125rem 0.5rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: 'var(--text-secondary)'
                        }}>
                            {index + 1}
                        </div>

                        {/* State name */}
                        {editingId === state.id ? (
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
                                    width: '100%',
                                    marginTop: '0.5rem'
                                }}
                            />
                        ) : (
                            <div
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    handleStartEdit(state);
                                }}
                                style={{
                                    fontSize: '0.875rem',
                                    fontWeight: 500,
                                    color: state.id === currentStateId ? 'white' : 'var(--text-primary)',
                                    marginTop: '0.5rem',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {state.name}
                            </div>
                        )}

                        {/* Delete button (only show if more than 1 state) */}
                        {states.length > 1 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteState(state.id);
                                }}
                                style={{
                                    position: 'absolute',
                                    top: '4px',
                                    right: '4px',
                                    padding: '0.25rem',
                                    background: 'rgba(0,0,0,0.3)',
                                    border: 'none',
                                    borderRadius: '4px',
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    opacity: 0.7,
                                    transition: 'opacity 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                                title="Delete State"
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* Add State Button */}
            <button
                onClick={onAddState}
                style={{
                    padding: '0.75rem 1.25rem',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--accent-color)',
                    borderRadius: '8px',
                    color: 'var(--accent-color)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontWeight: 500,
                    fontSize: '0.875rem',
                    transition: 'all 0.2s',
                    flexShrink: 0
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--accent-color)';
                    e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--bg-tertiary)';
                    e.currentTarget.style.color = 'var(--accent-color)';
                }}
            >
                <Plus size={18} />
                Add State
            </button>
        </div>
    );
}
