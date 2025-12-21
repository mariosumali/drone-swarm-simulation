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
            position: 'absolute',
            bottom: '1.5rem',
            right: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            padding: '0.5rem',
            backdropFilter: 'blur(10px)',
            zIndex: 1000
        }}>
            <button
                onClick={handleZoomIn}
                title="Zoom In"
                style={controlButtonStyle}
            >
                <ZoomIn size={18} />
            </button>

            <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                textAlign: 'center',
                padding: '0.25rem'
            }}>
                {Math.round(viewport.zoom * 100)}%
            </div>

            <button
                onClick={handleZoomOut}
                title="Zoom Out"
                style={controlButtonStyle}
            >
                <ZoomOut size={18} />
            </button>

            <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.25rem 0' }} />

            <button
                onClick={handleReset}
                title="Reset View"
                style={controlButtonStyle}
            >
                <Maximize2 size={18} />
            </button>

            <button
                onClick={onToggleScrollZoom}
                title={scrollZoomEnabled ? "Disable Scroll Zoom" : "Enable Scroll Zoom"}
                style={{
                    ...controlButtonStyle,
                    background: scrollZoomEnabled ? 'var(--accent-color)' : 'var(--bg-tertiary)',
                    color: scrollZoomEnabled ? 'white' : 'var(--text-primary)'
                }}
            >
                <Mouse size={18} />
            </button>
        </div>
    );
}

const controlButtonStyle = {
    padding: '0.5rem',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s'
};
