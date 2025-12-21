import React from 'react';

export function Drone({ selected, dragging, droneType = 'air' }) {
    const isGround = droneType === 'ground';
    const bodyColor = isGround ? '#8b5cf6' : '#60a5fa';
    const rotorColor = isGround ? '#a78bfa' : '#93c5fd';

    return (
        <div style={{
            position: 'absolute',
            left: '-10px',
            top: '-10px',
            width: '20px',
            height: '20px',
            transition: dragging ? 'none' : 'box-shadow 0.2s',
            cursor: dragging ? 'grabbing' : 'grab',
        }}>
            {/* Selection Ring */}
            {selected && (
                <div style={{
                    position: 'absolute',
                    top: -5, left: -5, right: -5, bottom: -5,
                    border: '2px solid var(--accent-color)',
                    borderRadius: '50%',
                    animation: 'pulse 2s infinite'
                }} />
            )}

            {isGround ? (
                // Ground Drone - Tank/Vehicle style
                <>
                    {/* Body */}
                    <div style={{
                        position: 'absolute',
                        top: '4px',
                        left: '2px',
                        width: '16px',
                        height: '12px',
                        background: bodyColor,
                        borderRadius: '2px',
                        zIndex: 2,
                        boxShadow: `0 0 8px ${bodyColor}80`
                    }} />
                    {/* Treads/Wheels */}
                    <div style={{ position: 'absolute', top: 2, left: 0, width: '5px', height: '16px', background: rotorColor, borderRadius: '2px', border: '1px solid #6b21a8' }} />
                    <div style={{ position: 'absolute', top: 2, right: 0, width: '5px', height: '16px', background: rotorColor, borderRadius: '2px', border: '1px solid #6b21a8' }} />
                    {/* Antenna */}
                    <div style={{ position: 'absolute', top: 0, left: '8px', width: '2px', height: '4px', background: '#6b21a8' }} />
                </>
            ) : (
                // Air Drone - Quadcopter style
                <>
                    {/* Body */}
                    <div style={{
                        position: 'absolute',
                        top: '6px',
                        left: '6px',
                        width: '8px',
                        height: '8px',
                        background: bodyColor,
                        borderRadius: '50%',
                        zIndex: 2,
                        boxShadow: `0 0 6px ${bodyColor}80`
                    }} />
                    {/* Arms */}
                    <div style={{
                        position: 'absolute',
                        top: '9px',
                        left: '0',
                        width: '20px',
                        height: '2px',
                        background: '#4b5563',
                        transform: 'rotate(45deg)',
                        borderRadius: '1px'
                    }} />
                    <div style={{
                        position: 'absolute',
                        top: '9px',
                        left: '0',
                        width: '20px',
                        height: '2px',
                        background: '#4b5563',
                        transform: 'rotate(-45deg)',
                        borderRadius: '1px'
                    }} />
                    {/* Propellers */}
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '6px', height: '6px', borderRadius: '50%', background: rotorColor, opacity: 0.9 }} />
                    <div style={{ position: 'absolute', top: 0, right: 0, width: '6px', height: '6px', borderRadius: '50%', background: rotorColor, opacity: 0.9 }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, width: '6px', height: '6px', borderRadius: '50%', background: rotorColor, opacity: 0.9 }} />
                    <div style={{ position: 'absolute', bottom: 0, right: 0, width: '6px', height: '6px', borderRadius: '50%', background: rotorColor, opacity: 0.9 }} />
                </>
            )}
        </div>
    );
}
