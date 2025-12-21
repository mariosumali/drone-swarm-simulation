import React from 'react';

export function SimulationObject({ data, selected, dragging, onResizeMouseDown }) {
    const { type } = data;

    // Common handle styles
    const handleStyle = {
        position: 'absolute',
        width: '10px',
        height: '10px',
        backgroundColor: 'white',
        border: '1px solid var(--accent-color)',
        borderRadius: '50%',
        zIndex: 50,
        pointerEvents: 'auto' // Ensure handle captures events
    };

    const renderHandles = () => {
        if (!selected || data.isLocked) return null;

        // 8-point resize handles for ALL types
        const handles = [
            // Corners
            { pos: 'nw', top: '-5px', left: '-5px', cursor: 'nwse-resize' },
            { pos: 'ne', top: '-5px', right: '-5px', cursor: 'nesw-resize' },
            { pos: 'sw', bottom: '-5px', left: '-5px', cursor: 'nesw-resize' },
            { pos: 'se', bottom: '-5px', right: '-5px', cursor: 'nwse-resize' },
            // Sides
            { pos: 'n', top: '-5px', left: '50%', marginLeft: '-5px', cursor: 'ns-resize' },
            { pos: 's', bottom: '-5px', left: '50%', marginLeft: '-5px', cursor: 'ns-resize' },
            { pos: 'e', top: '50%', right: '-5px', marginTop: '-5px', cursor: 'ew-resize' },
            { pos: 'w', top: '50%', left: '-5px', marginTop: '-5px', cursor: 'ew-resize' }
        ];

        return (
            <>
                {handles.map((h, i) => (
                    <div
                        key={i}
                        style={{ ...handleStyle, ...h }}
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            onResizeMouseDown && onResizeMouseDown(e, data, h.pos);
                        }}
                    />
                ))}
            </>
        );
    };

    // Custom drawn path
    if (type === 'custom' && data.customPath) {
        // Calculate original bounds from points
        const xs = data.customPath.map(p => p.x);
        const ys = data.customPath.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const origW = maxX - minX || 1;
        const origH = maxY - minY || 1;

        const currentW = data.w || origW;
        const currentH = data.h || origH;

        const scaleX = currentW / origW;
        const scaleY = currentH / origH;

        const pathString = data.customPath.map((p, i) =>
            `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
        ).join(' ') + ' Z';

        const containerPadding = 20;

        return (
            <div style={{
                position: 'absolute',
                left: `${-currentW / 2}px`,
                top: `${-currentH / 2}px`,
                width: `${currentW}px`,
                height: `${currentH}px`,
                pointerEvents: 'none'
            }}>
                <svg
                    style={{
                        position: 'absolute',
                        top: -containerPadding / 2,
                        left: -containerPadding / 2,
                        width: currentW + containerPadding,
                        height: currentH + containerPadding,
                        cursor: dragging ? 'grabbing' : 'grab',
                        overflow: 'visible',
                        filter: selected ? 'drop-shadow(0 0 8px var(--accent-color))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                        pointerEvents: 'auto'
                    }}
                    viewBox={`${minX - containerPadding / 2} ${minY - containerPadding / 2} ${origW + containerPadding} ${origH + containerPadding}`}
                >
                    <g transform={`translate(${currentW / 2}, ${currentH / 2}) scale(${scaleX}, ${scaleY}) translate(${-minX - origW / 2}, ${-minY - origH / 2})`}>
                        <path
                            d={pathString}
                            fill={data.isObstacle ? '#6b7280' : '#4ade80'}
                            fillOpacity={data.isObstacle ? '0.8' : '0.8'}
                            stroke={data.isObstacle ? '#6b7280' : (selected ? 'var(--accent-color)' : '#22c55e')}
                            strokeWidth={(selected ? 3 : 2) / Math.max(scaleX, scaleY)} // Inverse scale stroke to keep constant width
                            vectorEffect="non-scaling-stroke"
                        />
                        <circle cx={minX + origW / 2} cy={minY + origH / 2} r={3 / Math.max(scaleX, scaleY)} fill="rgba(0,0,0,0.3)" />
                    </g>
                </svg>
                {/* Render handles on the bounding box */}
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    pointerEvents: 'none'
                }}>
                    {renderHandles()}
                </div>
            </div>
        );
    }

    // Circle (Ellipse)
    if (type === 'circle') {
        const radius = data.radius || 50;
        const width = data.w || (radius * 2);
        const height = data.h || (radius * 2);

        return (
            <div style={{
                position: 'absolute',
                left: `${-width / 2}px`,
                top: `${-height / 2}px`,
                width: `${width}px`,
                height: `${height}px`,
                backgroundColor: data.isObstacle ? '#6b7280' : '#f472b6',
                borderRadius: '50%',
                cursor: dragging ? 'grabbing' : 'grab',
                opacity: data.isObstacle ? 0.8 : 0.9,
                boxShadow: selected ? '0 0 0 2px var(--accent-color), 0 0 15px rgba(244, 114, 182, 0.4)' : '0 4px 6px rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                userSelect: 'none'
            }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'white', opacity: 0.8 }}>
                    {data.customId || data.id.slice(0, 4)}
                </div>
                {renderHandles()}
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
                opacity: data.isObstacle ? 0.8 : 0.9,
                boxShadow: selected ? '0 0 0 2px var(--accent-color), 0 0 15px rgba(244, 114, 182, 0.4)' : '0 4px 6px rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                userSelect: 'none'
            }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'white' }}>
                    {data.customId || data.id.slice(0, 4)}
                </div>
                {renderHandles()}
            </div>
        );
    }

    return null;
}
