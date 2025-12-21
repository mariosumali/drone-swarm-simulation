import React from 'react';

export function SimulationObject({ data, selected, dragging }) {
    const { type } = data;

    // Custom drawn path
    if (type === 'custom' && data.customPath) {
        const pathString = data.customPath.map((p, i) =>
            `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
        ).join(' ') + ' Z';

        return (
            <svg
                style={{
                    position: 'absolute',
                    transform: 'translate(-50%, -50%)',
                    cursor: dragging ? 'grabbing' : 'grab',
                    overflow: 'visible',
                    filter: selected ? 'drop-shadow(0 0 8px var(--accent-color))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
                }}
                width={data.w + 20}
                height={data.h + 20}
            >
                <path
                    d={pathString}
                    fill="#4ade80"
                    fillOpacity="0.8"
                    stroke={selected ? 'var(--accent-color)' : '#22c55e'}
                    strokeWidth={selected ? 3 : 2}
                    transform={`translate(${(data.w + 20) / 2}, ${(data.h + 20) / 2})`}
                />
                <circle cx={(data.w + 20) / 2} cy={(data.h + 20) / 2} r="3" fill="rgba(0,0,0,0.3)" />
            </svg>
        );
    }

    // Circle
    if (type === 'circle') {
        const radius = data.radius || 50;
        return (
            <div style={{
                width: `${radius * 2}px`,
                height: `${radius * 2}px`,
                backgroundColor: '#f472b6',
                borderRadius: '50%',
                transform: 'translate(-50%, -50%)',
                cursor: dragging ? 'grabbing' : 'grab',
                position: 'relative',
                opacity: 0.9,
                boxShadow: selected ? '0 0 0 2px var(--accent-color), 0 0 15px rgba(244, 114, 182, 0.4)' : '0 4px 6px rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                userSelect: 'none'
            }}>
                <div style={{ width: '4px', height: '4px', background: 'rgba(0,0,0,0.3)', borderRadius: '50%' }} />
            </div>
        );
    }

    // Rectangle
    if (type === 'rectangle') {
        const width = data.w || 100;
        const height = data.h || 100;
        return (
            <div style={{
                width: `${width}px`,
                height: `${height}px`,
                backgroundColor: '#f472b6',
                borderRadius: '4px',
                transform: 'translate(-50%, -50%)',
                cursor: dragging ? 'grabbing' : 'grab',
                position: 'relative',
                opacity: 0.9,
                boxShadow: selected ? '0 0 0 2px var(--accent-color), 0 0 15px rgba(244, 114, 182, 0.4)' : '0 4px 6px rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                userSelect: 'none'
            }}>
                <div style={{ width: '4px', height: '4px', background: 'rgba(0,0,0,0.3)', borderRadius: '50%' }} />
            </div>
        );
    }

    // Fallback for any other type
    return null;
}
