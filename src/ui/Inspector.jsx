/** Inspector (right) — context properties for the current selection. */
import React from 'react';
import {
  SlidersHorizontal, Trash2, Lock, Unlock, Ban, Construction, Users, Spline,
  Route, Eraser, Crosshair, Plane, Car, Layers, MousePointerClick,
} from 'lucide-react';
import { useStore, actions } from '../app/store.js';
import { selectedEntities, transitionFrames, transitionPath } from '../model/selectors.js';
import { generateFormation, generateCaging, clearFormation, autoPathObject, clearPath } from '../app/missions.js';
import { Button, IconButton, NumberField, ToggleRow, Section, EmptyState, Badge } from './primitives.jsx';

export default function Inspector() {
  const sel = useStore(selectedEntities);
  const fid = useStore((s) => s.currentFrameId);
  const trans = useStore(transitionFrames);

  return (
    <aside className="panel panel--right" style={{ width: 264 }}>
      <div className="panel__header">
        <span className="panel__title">Inspector</span>
        <span className="spacer" />
        {sel.length > 0 && (
          <IconButton icon={Trash2} danger label="Delete (⌫)" onClick={actions.deleteSelected} />
        )}
      </div>
      <div className="panel__body">
        {sel.length === 0 && (
          <EmptyState icon={SlidersHorizontal} title="Nothing selected" hint="Select an entity on the canvas or in the scene tree." />
        )}
        {sel.length === 1 && <Single e={sel[0]} fid={fid} trans={trans} />}
        {sel.length > 1 && <Multi count={sel.length} />}
      </div>
    </aside>
  );
}

function Multi({ count }) {
  return (
    <>
      <div className="stat">
        <span className="stat__label">Selection</span>
        <span className="stat__value">{count}</span>
        <span className="stat__sub">entities selected</span>
      </div>
      <div className="col">
        <Button block icon={Users} variant="primary" onClick={actions.group}>Group selection</Button>
        <Button block icon={Trash2} variant="danger" onClick={actions.deleteSelected}>Delete all</Button>
      </div>
      <p className="faint text-xs">Tip: use the align buttons in the toolbar to tidy multiple objects.</p>
    </>
  );
}

function Single({ e, fid, trans }) {
  const t = e.frames[fid] || { x: 0, y: 0, z: 0, rotation: 0 };
  const isObj = e.kind === 'object';
  const move = (patch) => actions.moveEntity(e.id, patch);
  const patch = (p) => actions.patchEntity(e.id, p);

  return (
    <>
      {/* identity */}
      <div className="row" style={{ gap: 8 }}>
        <Badge tone={isObj ? (e.obstacle ? 'danger' : e.transport ? 'accent' : undefined) : e.droneType === 'air' ? 'info' : 'warning'} icon={isObj ? Layers : e.droneType === 'air' ? Plane : Car}>
          {isObj ? e.shape : `${e.droneType} drone`}
        </Badge>
        <input
          className="input"
          value={e.name}
          onChange={(ev) => patch({ name: ev.target.value })}
          style={{ flex: 1 }}
        />
      </div>

      {/* transform */}
      <Section title="Transform" defaultOpen>
        <div className="field-grid">
          <NumberField label="X" value={t.x} onChange={(v) => move({ x: v })} />
          <NumberField label="Y" value={t.y} onChange={(v) => move({ y: v })} />
          <NumberField label={isObj ? 'Elev (Z)' : 'Altitude'} value={t.z || 0} onChange={(v) => move({ z: v })} suffix="m" />
          <NumberField label="Rotation" value={t.rotation || 0} onChange={(v) => move({ rotation: v })} suffix="°" />
        </div>
        {isObj && e.shape === 'circle' && (
          <NumberField label="Radius" value={e.radius} onChange={(v) => patch({ radius: Math.max(5, v) })} />
        )}
        {isObj && e.shape !== 'circle' && (
          <div className="field-grid">
            <NumberField label="Width" value={e.w} onChange={(v) => patch({ w: Math.max(10, v) })} />
            <NumberField label="Height" value={e.h} onChange={(v) => patch({ h: Math.max(10, v) })} />
          </div>
        )}
      </Section>

      {/* object flags */}
      {isObj && (
        <Section title="Behavior" defaultOpen>
          <ToggleRow label="Lock position" checked={e.locked} onChange={(v) => patch({ locked: v })} />
          <ToggleRow label="Obstacle (blocks paths)" checked={e.obstacle} onChange={(v) => patch({ obstacle: v })} />
          <ToggleRow label="No-fly zone" checked={e.noFly} onChange={(v) => patch({ noFly: v })} hint="Blocks drones from flying over at any altitude" />
          <NumberField label="Height (3D / flyover)" value={e.height} onChange={(v) => patch({ height: Math.max(0, v) })} suffix="m" />
          <NumberField label="Weight" value={e.weight} onChange={(v) => patch({ weight: Math.max(1, v) })} />
        </Section>
      )}

      {/* drone props */}
      {!isObj && (
        <Section title="Drone" defaultOpen>
          <NumberField label="Sensor radius" value={e.sensorRadius} onChange={(v) => patch({ sensorRadius: Math.max(20, v) })} />
          <NumberField label="Max speed" value={e.maxSpeed} onChange={(v) => patch({ maxSpeed: Math.max(0.5, v) })} />
          {e.assignedTo && (
            <p className="faint text-xs">
              Assigned to a formation. Free it from the object’s panel to control it directly.
            </p>
          )}
        </Section>
      )}

      {/* formation */}
      {isObj && (
        <Section title="Swarm formation" defaultOpen>
          {e.assignedDrones?.length ? (
            <>
              <div className="stat">
                <span className="stat__label"><Users size={11} /> In formation</span>
                <span className="stat__value">{e.assignedDrones.length}</span>
              </div>
              <Button block icon={Eraser} onClick={() => clearFormation(e.id)}>Disband formation</Button>
            </>
          ) : (
            <>
              <Button block variant="primary" icon={Plane} onClick={() => generateFormation(e.id, 'auto')}>
                Form up around object
              </Button>
              <div className="field-grid">
                <Button icon={Plane} onClick={() => generateFormation(e.id, 'air')}>Air</Button>
                <Button icon={Car} onClick={() => generateFormation(e.id, 'ground')}>Ground</Button>
              </div>
              <Button block icon={Crosshair} onClick={() => generateCaging(e.id)}>Cage / encircle</Button>
            </>
          )}
        </Section>
      )}

      {/* path for current transition */}
      {isObj && !trans.isLast && (
        <Section title={`Path · ${trans.from.name} → ${trans.to.name}`} defaultOpen>
          {transitionPath(e, trans.from.id, trans.to.id) ? (
            <Button block icon={Eraser} onClick={() => clearPath(e.id, trans.from.id, trans.to.id)}>Clear path</Button>
          ) : (
            <p className="faint text-xs">Straight line. Route it around obstacles or draw your own.</p>
          )}
          <div className="field-grid">
            <Button icon={Route} onClick={() => autoPathObject(e.id, trans.from.id, trans.to.id)}>Auto-route</Button>
            <Button icon={Spline} onClick={() => actions.setTool({ mode: 'draw-path' })}>Draw</Button>
          </div>
        </Section>
      )}
    </>
  );
}
