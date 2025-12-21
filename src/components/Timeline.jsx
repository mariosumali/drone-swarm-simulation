import React, { useState } from 'react';
import { Plus, Trash2, Play, Pause, Square, ChevronRight } from 'lucide-react';

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

    const currentIndex = states.findIndex(s => s.id === currentStateId);

    return (
        <div style={{
            height: '100px',
            borderTop: '1px solid var(--border-color)',
            background: 'linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 1.5rem',
            gap: '1.5rem',
            flexShrink: 0,
            position: 'relative',
            zIndex: 10
        }}>
            {/* Simulation Controls */}
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
                background: 'var(--bg-tertiary)',
                padding: '0.5rem',
                borderRadius: '12px',
                border: '1px solid var(--border-color)'
            }}>
                <button
                    onClick={onToggleSimulation}
                    disabled={states.length < 2}
                    style={{
                        padding: '0.75rem',
                        background: isSimulating
                            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                            : 'linear-gradient(135deg, var(--accent-color) 0%, #4f46e5 100%)',
                        border: 'none',
                        borderRadius: '10px',
                        color: 'white',
                        cursor: states.length < 2 ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: states.length < 2 ? 0.5 : 1,
                        boxShadow: states.length >= 2 ? '0 4px 12px rgba(99, 102, 241, 0.4)' : 'none',
                        transition: 'all 0.2s'
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
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        color: 'var(--text-primary)',
                        cursor: isSimulating ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: isSimulating ? 1 : 0.4,
                        transition: 'all 0.2s'
                    }}
                    title="Stop"
                >
                    <Square size={18} />
                </button>

                {/* Speed Control */}
                <div style={{
                    display: 'flex',
                    gap: '0.25rem',
                    marginLeft: '0.25rem',
                    background: 'var(--bg-primary)',
                    padding: '0.25rem',
                    borderRadius: '8px'
                }}>
                    {[0.5, 1, 2].map(speed => (
                        <button
                            key={speed}
                            onClick={() => onPlaybackSpeedChange(speed)}
                            style={{
                                padding: '0.375rem 0.625rem',
                                background: playbackSpeed === speed
                                    ? 'var(--accent-color)'
                                    : 'transparent',
                                border: 'none',
                                borderRadius: '6px',
                                color: playbackSpeed === speed ? 'white' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                transition: 'all 0.15s'
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
                gap: '0.5rem',
                overflowX: 'auto',
                alignItems: 'center',
                padding: '0.5rem 0'
            }}>
                {states.map((state, index) => (
                    <React.Fragment key={state.id}>
                        <div
                            onClick={() => onStateChange(state.id)}
                            style={{
                                minWidth: '140px',
                                padding: '0.875rem 1rem',
                                background: state.id === currentStateId
                                    ? 'linear-gradient(135deg, var(--accent-color) 0%, #4f46e5 100%)'
                                    : 'var(--bg-tertiary)',
                                border: state.id === currentStateId
                                    ? 'none'
                                    : '1px solid var(--border-color)',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                position: 'relative',
                                userSelect: 'none',
                                boxShadow: state.id === currentStateId
                                    ? '0 4px 16px rgba(99, 102, 241, 0.4)'
                                    : '0 2px 8px rgba(0,0,0,0.1)',
                                transform: state.id === currentStateId ? 'scale(1.02)' : 'scale(1)'
                            }}
                            onMouseEnter={(e) => {
                                if (state.id !== currentStateId) {
                                    e.currentTarget.style.borderColor = 'var(--accent-color)';
                                    e.currentTarget.style.transform = 'scale(1.02)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (state.id !== currentStateId) {
                                    e.currentTarget.style.borderColor = 'var(--border-color)';
                                    e.currentTarget.style.transform = 'scale(1)';
                                }
                            }}
                        >
                            {/* State number badge */}
                            <div style={{
                                position: 'absolute',
                                top: '-10px',
                                left: '12px',
                                background: state.id === currentStateId
                                    ? 'white'
                                    : 'var(--bg-primary)',
                                border: state.id === currentStateId
                                    ? 'none'
                                    : '1px solid var(--border-color)',
                                borderRadius: '10px',
                                padding: '0.125rem 0.625rem',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                color: state.id === currentStateId
                                    ? 'var(--accent-color)'
                                    : 'var(--text-secondary)',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
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
                                        background: 'rgba(255,255,255,0.1)',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        borderRadius: '6px',
                                        padding: '0.25rem 0.5rem',
                                        color: 'white',
                                        fontSize: '0.875rem',
                                        width: '100%',
                                        marginTop: '0.25rem',
                                        outline: 'none'
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
                                        fontWeight: 600,
                                        color: state.id === currentStateId ? 'white' : 'var(--text-primary)',
                                        marginTop: '0.25rem',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        letterSpacing: '-0.01em'
                                    }}
                                >
                                    {state.name}
                                </div>
                            )}

                            {/* Delete button (only show if more than 1 state and not initial state) */}
                            {states.length > 1 && index > 0 && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteState(state.id);
                                    }}
                                    style={{
                                        position: 'absolute',
                                        top: '6px',
                                        right: '6px',
                                        padding: '0.25rem',
                                        background: 'rgba(0,0,0,0.2)',
                                        border: 'none',
                                        borderRadius: '6px',
                                        color: state.id === currentStateId ? 'rgba(255,255,255,0.7)' : '#ef4444',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        opacity: 0,
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                    title="Delete State"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>

                        {/* Connector arrow between states */}
                        {index < states.length - 1 && (
                            <div style={{
                                color: 'var(--text-secondary)',
                                opacity: 0.4,
                                display: 'flex',
                                alignItems: 'center'
                            }}>
                                <ChevronRight size={20} />
                            </div>
                        )}
                    </React.Fragment>
                ))}
            </div>

            {/* Add State Button */}
            <button
                onClick={onAddState}
                style={{
                    padding: '0.75rem 1.25rem',
                    background: 'transparent',
                    border: '2px dashed var(--border-color)',
                    borderRadius: '12px',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    transition: 'all 0.2s',
                    flexShrink: 0
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent-color)';
                    e.currentTarget.style.color = 'var(--accent-color)';
                    e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                    e.currentTarget.style.background = 'transparent';
                }}
            >
                <Plus size={18} />
                Add State
            </button>
        </div>
    );
}
