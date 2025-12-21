import React from 'react';

export function Drone({ selected, dragging }) {
    // Styles for a "quadcopter" look
    return (
        <div style={{
            position: 'absolute',
            left: '-20px',
            top: '-20px',
            width: '40px',
            height: '40px',
            transition: dragging ? 'none' : 'box-shadow 0.2s',
            cursor: dragging ? 'grabbing' : 'grab',
        }}>
            {/* Selection Ring */}
            {selected && (
                <div style={{
                    position: 'absolute',
                    top: -10, left: -10, right: -10, bottom: -10,
                    border: '2px solid var(--accent-color)',
                    borderRadius: '50%',
                    animation: 'pulse 2s infinite'
                }} />
            )}

            {/* Body */}
            <div style={{
                position: 'absolute',
                top: '12px', left: '12px',
                width: '16px', height: '16px',
                background: 'var(--text-primary)',
                borderRadius: '50%',
                zIndex: 2,
                boxShadow: '0 0 10px rgba(0,0,0,0.5)'
            }} />

            {/* Arms */}
            <div style={{
                position: 'absolute',
                top: '18px', left: '0',
                width: '40px', height: '4px',
                background: '#4b5563',
                transform: 'rotate(45deg)',
                borderRadius: '2px'
            }} />
            <div style={{
                position: 'absolute',
                top: '18px', left: '0',
                width: '40px', height: '4px',
                background: '#4b5563',
                transform: 'rotate(-45deg)',
                borderRadius: '2px'
            }} />

            {/* Rotors - Spinning animation could be added here */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '12px', height: '12px', borderRadius: '50%', background: '#6366f1', opacity: 0.8 }} />
            <div style={{ position: 'absolute', top: 0, right: 0, width: '12px', height: '12px', borderRadius: '50%', background: '#6366f1', opacity: 0.8 }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, width: '12px', height: '12px', borderRadius: '50%', background: '#6366f1', opacity: 0.8 }} />
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: '12px', height: '12px', borderRadius: '50%', background: '#6366f1', opacity: 0.8 }} />
        </div>
    );
}
