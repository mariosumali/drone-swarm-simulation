import React from 'react';

export function SimulationObject({ data, selected, dragging }) {
    const { type } = data;

    // Custom drawn path
    if (type === 'custom' && data.customPath) {
        const pathString = data.customPath.map((p, i) =>
            `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
        ).join(' ') + ' Z';

        const svgWidth = data.w + 20;
        const svgHeight = data.h + 20;

        return (
            <svg
                style={{
                    position: 'absolute',
                    left: `${-svgWidth / 2}px`,
                    top: `${-svgHeight / 2}px`,
                    cursor: dragging ? 'grabbing' : 'grab',
                    overflow: 'visible',
                    filter: selected ? 'drop-shadow(0 0 8px var(--accent-color))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
                }}
                width={svgWidth}
                height={svgHeight}
            >
                <path
                    d={pathString}
                    fill={data.isObstacle ? '#6b7280' : '#4ade80'}
                    fillOpacity={data.isObstacle ? '0.8' : '0.8'}
                    stroke={data.isObstacle ? '#6b7280' : (selected ? 'var(--accent-color)' : '#22c55e')}
                    strokeWidth={selected ? 3 : 2}
                    transform={`translate(${svgWidth / 2}, ${svgHeight / 2})`}
                />
                <circle cx={svgWidth / 2} cy={svgHeight / 2} r="3" fill="rgba(0,0,0,0.3)" />
            </svg>
        );
    }

    // Circle
    if (type === 'circle') {
        const radius = data.radius || 50;
        return (
            <div style={{
                position: 'absolute',
                left: `${-radius}px`,
                top: `${-radius}px`,
                width: `${radius * 2}px`,
                height: `${radius * 2}px`,
                backgroundColor: data.isObstacle ? '#6b7280' : '#f472b6',
                borderRadius: '50%',
                cursor: dragging ? 'grabbing' : 'grab',
                opacity: data.isObstacle ? 0.5 : 0.9,
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
                position: 'absolute',
                left: `${-width / 2}px`,
                top: `${-height / 2}px`,
                width: `${width}px`,
                height: `${height}px`,
                backgroundColor: data.isObstacle ? '#6b7280' : '#f472b6',
                borderRadius: '4px',
                cursor: dragging ? 'grabbing' : 'grab',
                opacity: data.isObstacle ? 0.5 : 0.9,
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

    return null;
}
