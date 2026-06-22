/** LibraryPanel (left) — tools, draggable add palette, scene tree, view toggles. */
import React, { useState } from 'react';
import {
  MousePointer2, PenTool, Spline, Eye, EyeOff, Trash2, Plane, Car,
  Grid3x3, Tag, Radar, Wifi, Route, Gauge, ChevronRight, CornerDownRight,
} from 'lucide-react';
import { useStore, actions } from '../app/store.js';
import { DRONE_LIBRARY, SHAPE_LIBRARY, ARENA } from '../app/constants.js';
import { IconButton, Section, EmptyState, ToggleRow } from './primitives.jsx';

export default function LibraryPanel() {
  const tool = useStore((s) => s.tool.mode);
  const ui = useStore((s) => s.ui);
  const selectedObj = useStore((s) =>
    s.entities.find((e) => s.selectedIds.includes(e.id) && e.kind === 'object')
  );
  const frameCount = useStore((s) => s.frames.length);
  const canPath = !!selectedObj && frameCount >= 2;

  return (
    <aside className="panel panel--left" style={{ width: 248 }}>
      <div className="panel__header">
        <span className="panel__title">Build</span>
      </div>
      <div className="panel__body">
        {/* tools */}
        <div className="section">
          <div className="section__head">Tools</div>
          <div className="row">
            <IconButton
              icon={MousePointer2}
              label="Select / move (V)"
              active={tool === 'select'}
              onClick={() => actions.setTool({ mode: 'select', draft: null })}
            />
            <IconButton
              icon={PenTool}
              label="Draw polygon (P)"
              active={tool === 'draw-poly'}
              onClick={() => actions.setTool({ mode: 'draw-poly', draft: { type: 'poly', points: [] } })}
            />
            <IconButton
              icon={Spline}
              label={canPath ? 'Draw path for selected object' : 'Select an object with ≥2 keyframes'}
              active={tool === 'draw-path'}
              disabled={!canPath}
              onClick={() => actions.setTool({ mode: 'draw-path', draft: null })}
            />
            {tool !== 'select' && (
              <span className="badge badge--accent" style={{ marginLeft: 'auto' }}>
                {tool === 'draw-poly' ? 'Click • dbl-click ✓' : 'Drag on object'}
              </span>
            )}
          </div>
        </div>

        {/* drones */}
        <div className="section">
          <div className="section__head">Drones</div>
          <div className="tile-grid">
            {DRONE_LIBRARY.map((d) => (
              <Tile key={d.type} kind="drone" type={d.type} icon={d.icon} label={d.label} variant={d.variant} />
            ))}
          </div>
        </div>

        {/* objects */}
        <div className="section">
          <div className="section__head">Objects</div>
          <div className="tile-grid">
            {SHAPE_LIBRARY.map((s) => (
              <Tile key={s.type} kind="object" type={s.type} icon={s.icon} label={s.label} />
            ))}
          </div>
        </div>

        <SceneTree />

        {/* view toggles */}
        <Section title="View" defaultOpen>
          <ToggleRow label="Grid" checked={useStore((s) => s.settings.showGrid)} onChange={(v) => actions.setSetting('showGrid', v)} />
          <ToggleRow label="Labels" checked={ui.showLabels} onChange={() => actions.toggleUI('showLabels')} />
          <ToggleRow label="Paths" checked={ui.showPaths} onChange={() => actions.toggleUI('showPaths')} />
          <ToggleRow label="Sensor range" checked={ui.showSensors} onChange={() => actions.toggleUI('showSensors')} />
          <ToggleRow label="Comm range" checked={ui.showComms} onChange={() => actions.toggleUI('showComms')} />
          <ToggleRow label="Telemetry HUD" checked={ui.telemetry} onChange={() => actions.toggleUI('telemetry')} />
        </Section>
      </div>
    </aside>
  );
}

function Tile({ kind, type, icon: Icon, label, variant }) {
  const onDragStart = (e) => {
    e.dataTransfer.setData('application/swarm', JSON.stringify({ kind, type }));
    e.dataTransfer.effectAllowed = 'copy';
  };
  const add = () => {
    const cx = (ARENA.minX + ARENA.maxX) / 2 + (Math.random() - 0.5) * 120;
    const cy = (ARENA.minY + ARENA.maxY) / 2 + (Math.random() - 0.5) * 120;
    if (kind === 'drone') actions.addDrone(type, cx, cy);
    else actions.addObject(type, cx, cy);
  };
  return (
    <button className="tile" draggable onDragStart={onDragStart} onClick={add} data-variant={variant} title={`Drag to canvas or click to add ${label}`}>
      <Icon size={20} />
      <span className="tile__label">{label}</span>
    </button>
  );
}

function SceneTree() {
  const entities = useStore((s) => s.entities);
  const selectedIds = useStore((s) => s.selectedIds);
  const sel = new Set(selectedIds);
  const objects = entities.filter((e) => e.kind === 'object');
  const freeDrones = entities.filter((e) => e.kind === 'drone' && !e.assignedTo);

  if (!entities.length) {
    return (
      <div className="section">
        <div className="section__head">Scene</div>
        <EmptyState icon={Plane} title="Empty scene" hint="Drag a drone or object onto the canvas to begin." />
      </div>
    );
  }

  return (
    <Section title="Scene" count={entities.length} defaultOpen>
      {objects.map((o) => {
        const kids = entities.filter((e) => e.assignedTo === o.id);
        return (
          <React.Fragment key={o.id}>
            <Row e={o} selected={sel.has(o.id)} />
            {kids.map((k) => (
              <Row key={k.id} e={k} selected={sel.has(k.id)} child />
            ))}
          </React.Fragment>
        );
      })}
      {freeDrones.map((d) => (
        <Row key={d.id} e={d} selected={sel.has(d.id)} />
      ))}
    </Section>
  );
}

function Row({ e, selected, child }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(e.name);
  const Icon = e.kind === 'drone' ? (e.droneType === 'air' ? Plane : Car) : null;
  const commit = () => {
    setEditing(false);
    if (name.trim() && name !== e.name) actions.patchEntity(e.id, { name: name.trim() });
  };
  return (
    <div
      className={`list-item${child ? ' list-item--child' : ''}`}
      data-selected={selected ? 'true' : 'false'}
      onClick={(ev) => (ev.shiftKey ? actions.toggleSelect(e.id) : actions.selectOne(e.id))}
    >
      <span
        className="list-item__icon"
        style={{ color: e.kind === 'drone' ? (e.droneType === 'air' ? 'var(--color-air)' : 'var(--color-ground)') : e.obstacle ? 'var(--color-obstacle)' : 'var(--text-muted)' }}
      >
        {Icon ? <Icon size={14} /> : child ? <CornerDownRight size={13} /> : <ShapeGlyph e={e} />}
      </span>
      <div className="list-item__text">
        {editing ? (
          <input
            className="input"
            style={{ height: 22 }}
            autoFocus
            value={name}
            onChange={(ev) => setName(ev.target.value)}
            onBlur={commit}
            onKeyDown={(ev) => ev.key === 'Enter' && commit()}
            onClick={(ev) => ev.stopPropagation()}
          />
        ) : (
          <div className="list-item__name" onDoubleClick={() => { setName(e.name); setEditing(true); }}>
            {e.name}
          </div>
        )}
        <div className="list-item__meta">
          {e.kind === 'drone'
            ? e.assignedTo ? 'in formation' : 'free'
            : `${e.obstacle ? 'obstacle · ' : ''}${e.assignedDrones?.length ? e.assignedDrones.length + ' drones' : e.shape}`}
        </div>
      </div>
      <div className="list-item__actions">
        <IconButton
          size="sm"
          icon={Trash2}
          danger
          label="Delete"
          onClick={(ev) => {
            ev.stopPropagation();
            actions.selectOne(e.id);
            actions.deleteSelected();
          }}
        />
      </div>
    </div>
  );
}

function ShapeGlyph({ e }) {
  if (e.shape === 'circle') return <span style={{ width: 12, height: 12, border: '2px solid currentColor', borderRadius: '50%' }} />;
  return <span style={{ width: 12, height: 12, border: '2px solid currentColor', borderRadius: 2 }} />;
}
