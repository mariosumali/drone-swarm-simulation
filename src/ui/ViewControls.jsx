/** Floating zoom / recenter controls for the 2D canvas. */
import React from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useStore, actions } from '../app/store.js';
import { IconButton } from './primitives.jsx';

export default function ViewControls() {
  const zoom = useStore((s) => s.view.zoom);
  return (
    <div className="canvas-hud" style={{ bottom: 'var(--space-3)', left: 'var(--space-3)' }}>
      <IconButton size="sm" icon={ZoomOut} label="Zoom out" onClick={() => actions.zoomBy(1 / 1.2)} />
      <span className="hud-zoom">{Math.round(zoom * 100)}%</span>
      <IconButton size="sm" icon={ZoomIn} label="Zoom in" onClick={() => actions.zoomBy(1.2)} />
      <IconButton size="sm" icon={Maximize2} label="Reset view" onClick={actions.resetView} />
    </div>
  );
}
