import React from 'react';
import { ZoomIn, ZoomOut, Maximize2, Mouse } from 'lucide-react';

export function ZoomControls({ viewport, onViewportChange, scrollZoomEnabled, onToggleScrollZoom }) {
    const handleZoomIn = () => {
        onViewportChange(prev => ({
            ...prev,
            zoom: Math.min(prev.zoom * 1.2, 5)
        }));
    };

    const handleZoomOut = () => {
        onViewportChange(prev => ({
            ...prev,
            zoom: Math.max(prev.zoom / 1.2, 0.1)
        }));
    };

    const handleReset = () => {
        onViewportChange({ zoom: 1, offsetX: 0, offsetY: 0 });
    };

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            padding: '0.25rem',
            marginLeft: 'auto'
        }}>
            <button
                onClick={handleZoomOut}
                title="Zoom Out"
                style={controlButtonStyle}
            >
                <ZoomOut size={16} />
            </button>

            <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                minWidth: '3.5rem',
                textAlign: 'center',
                fontVariantNumeric: 'tabular-nums'
            }}>
                {Math.round(viewport.zoom * 100)}%
            </div>

            <button
                onClick={handleZoomIn}
                title="Zoom In"
                style={controlButtonStyle}
            >
                <ZoomIn size={16} />
            </button>

            <div style={{ width: '1px', height: '16px', background: 'var(--border-color)', margin: '0 0.25rem' }} />

            <button
                onClick={handleReset}
                title="Reset View"
                style={controlButtonStyle}
            >
                <Maximize2 size={16} />
            </button>

            <button
                onClick={onToggleScrollZoom}
                title={scrollZoomEnabled ? "Disable Scroll Zoom" : "Enable Scroll Zoom"}
                style={{
                    ...controlButtonStyle,
                    background: scrollZoomEnabled ? 'var(--accent-color)' : 'transparent',
                    color: scrollZoomEnabled ? 'white' : 'var(--text-secondary)'
                }}
            >
                <Mouse size={16} />
            </button>
        </div>
    );
}

const controlButtonStyle = {
    padding: '0.25rem',
    background: 'transparent',
    border: 'none',
    borderRadius: '4px',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s'
};
