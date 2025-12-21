import React from 'react';

export function SimulationObject({ data, selected, dragging }) {
    const { shape, w, h } = data;

    const isCircle = shape === 'circle';
    const width = w;
    const height = isCircle ? w : h;
    const borderRadius = isCircle ? '50%' : '4px';

    return (
        <div style={{
            width: `${width}px`,
            height: `${height}px`,
            backgroundColor: '#f472b6',
            borderRadius: borderRadius,
            transform: 'translate(-50%, -50%)',
            cursor: dragging ? 'grabbing' : 'grab',
            position: 'relative',
            opacity: 0.9,
            boxShadow: selected ? '0 0 0 2px var(--accent-color), 0 0 15px rgba(244, 114, 182, 0.4)' : '0 4px 6px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(0,0,0,0.5)',
            fontWeight: 'bold',
            fontSize: '0.75rem',
            userSelect: 'none'
        }}>
            {/* Weight indicator or Center point */}
            <div style={{ width: '4px', height: '4px', background: 'rgba(0,0,0,0.3)', borderRadius: '50%' }} />
        </div>
    );
}
