import React from 'react';
import { RotateCcw } from 'lucide-react';

export function GravityControls({ gravity, onGravityChange, onReset }) {
    const handleXChange = (e) => {
        onGravityChange(parseFloat(e.target.value), gravity.y);
    };

    const handleYChange = (e) => {
        onGravityChange(gravity.x, parseFloat(e.target.value));
    };

    return (
        <div style={{
            padding: '1rem',
            background: 'var(--bg-secondary)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <h3 style={{
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    margin: 0
                }}>
                    Gravity Control
                </h3>
                <button
                    onClick={onReset}
                    style={{
                        padding: '0.35rem 0.6rem',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        fontSize: '0.7rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                    }}
                    title="Reset gravity to (0, 0)"
                >
                    <RotateCcw size={12} />
                    Reset
                </button>
            </div>

            {/* X-Axis Gravity */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <label style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        fontWeight: 500
                    }}>
                        X-Axis (Horizontal)
                    </label>
                    <span style={{
                        fontSize: '0.75rem',
                        color: 'var(--accent-color)',
                        fontWeight: 600,
                        fontFamily: 'monospace'
                    }}>
                        {gravity.x.toFixed(2)}
                    </span>
                </div>
                <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.05"
                    value={gravity.x}
                    onChange={handleXChange}
                    style={{
                        width: '100%',
                        height: '6px',
                        borderRadius: '3px',
                        appearance: 'none',
                        background: `linear-gradient(to right, 
                            var(--bg-tertiary) 0%, 
                            var(--bg-tertiary) ${(gravity.x + 1) * 50}%, 
                            var(--accent-color) ${(gravity.x + 1) * 50}%, 
                            var(--accent-color) 50%, 
                            var(--bg-tertiary) 50%
                        )`,
                        cursor: 'pointer'
                    }}
                />
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.6rem',
                    color: 'var(--text-secondary)'
                }}>
                    <span>← Left</span>
                    <span>Right →</span>
                </div>
            </div>

            {/* Y-Axis Gravity */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <label style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        fontWeight: 500
                    }}>
                        Y-Axis (Vertical)
                    </label>
                    <span style={{
                        fontSize: '0.75rem',
                        color: 'var(--accent-color)',
                        fontWeight: 600,
                        fontFamily: 'monospace'
                    }}>
                        {gravity.y.toFixed(2)}
                    </span>
                </div>
                <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.05"
                    value={gravity.y}
                    onChange={handleYChange}
                    style={{
                        width: '100%',
                        height: '6px',
                        borderRadius: '3px',
                        appearance: 'none',
                        background: `linear-gradient(to right, 
                            var(--bg-tertiary) 0%, 
                            var(--bg-tertiary) ${(gravity.y + 1) * 50}%, 
                            var(--accent-color) ${(gravity.y + 1) * 50}%, 
                            var(--accent-color) 50%, 
                            var(--bg-tertiary) 50%
                        )`,
                        cursor: 'pointer'
                    }}
                />
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.6rem',
                    color: 'var(--text-secondary)'
                }}>
                    <span>↑ Up</span>
                    <span>Down ↓</span>
                </div>
            </div>

            {/* Visual Indicator */}
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '1rem',
                background: 'var(--bg-primary)',
                borderRadius: '8px',
                position: 'relative'
            }}>
                <div style={{
                    width: '60px',
                    height: '60px',
                    border: '2px solid var(--border-color)',
                    borderRadius: '50%',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    {/* Arrow indicating gravity direction */}
                    {(gravity.x !== 0 || gravity.y !== 0) && (
                        <div style={{
                            position: 'absolute',
                            width: '4px',
                            height: `${Math.min(Math.hypot(gravity.x, gravity.y) * 25, 25)}px`,
                            background: 'var(--accent-color)',
                            borderRadius: '2px',
                            transform: `rotate(${Math.atan2(gravity.y, gravity.x) * 180 / Math.PI + 90}deg)`,
                            transformOrigin: 'top center',
                            boxShadow: '0 0 8px var(--accent-color)'
                        }} />
                    )}
                    {/* Center dot */}
                    <div style={{
                        width: '8px',
                        height: '8px',
                        background: gravity.x === 0 && gravity.y === 0 ? 'var(--text-secondary)' : 'var(--accent-color)',
                        borderRadius: '50%'
                    }} />
                </div>
            </div>
        </div>
    );
}
