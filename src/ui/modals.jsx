/** Settings + Help modals. */
import React from 'react';
import { useStore, actions } from '../app/store.js';
import { EASINGS } from '../app/constants.js';
import { Modal, Button, Slider, ToggleRow, NumberField, Section } from './primitives.jsx';

export function SettingsModal({ onClose }) {
  const s = useStore((st) => st.settings);
  const set = actions.setSetting;
  return (
    <Modal
      title="Settings"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={() => actions.resetSettings()}>Reset defaults</Button>
          <Button variant="primary" onClick={onClose}>Done</Button>
        </>
      }
    >
      <Section title="Canvas">
        <ToggleRow label="Show grid" checked={s.showGrid} onChange={(v) => set('showGrid', v)} />
        <ToggleRow label="Snap to grid" checked={s.snapToGrid} onChange={(v) => set('snapToGrid', v)} />
        <NumberField label="Grid size" value={s.gridSize} onChange={(v) => set('gridSize', Math.max(4, v))} suffix="px" />
        <Slider label="Pan sensitivity" min={0.2} max={2} step={0.1} value={s.panSensitivity} onChange={(v) => set('panSensitivity', v)} format={(v) => `${v}×`} />
        <Slider label="Zoom sensitivity" min={0.4} max={2} step={0.1} value={s.zoomSensitivity} onChange={(v) => set('zoomSensitivity', v)} format={(v) => `${v}×`} />
      </Section>

      <Section title="Keyframe animation">
        <Slider label="Transition duration" min={0.3} max={8} step={0.1} value={s.transitionDuration} onChange={(v) => set('transitionDuration', v)} format={(v) => `${v}s`} />
        <label className="field">
          <span className="field__label">Easing</span>
          <select className="select" value={s.easing} onChange={(e) => set('easing', e.target.value)}>
            {EASINGS.map((e) => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
        </label>
      </Section>

      <Section title="Swarm">
        <Slider label="Comm range" min={80} max={900} step={10} value={s.commRange} onChange={(v) => set('commRange', v)} format={(v) => `${v}`} />
        <Slider label="Formation standoff" min={10} max={140} step={2} value={s.standoff} onChange={(v) => set('standoff', v)} format={(v) => `${v}`} />
        <Slider label="Hover altitude" min={0} max={240} step={5} value={s.altitude} onChange={(v) => set('altitude', v)} format={(v) => `${v}m`} />
      </Section>

      <Section title="System">
        <ToggleRow label="Auto-save to browser" checked={s.autoSave} onChange={(v) => set('autoSave', v)} hint="Persists the scene locally so it survives a refresh" />
      </Section>

      <p className="faint text-xs" style={{ textAlign: 'center' }}>Swarm Studio · unified drone simulator</p>
    </Modal>
  );
}

const SHORTCUTS = [
  ['V', 'Select tool'],
  ['P', 'Draw polygon'],
  ['Space + drag', 'Pan canvas'],
  ['Scroll', 'Zoom'],
  ['Shift + click', 'Add to selection'],
  ['Shift + drag', 'Pan (select tool)'],
  ['⌘/Ctrl + A', 'Select all'],
  ['⌘/Ctrl + C / V', 'Copy / paste'],
  ['⌘/Ctrl + D', 'Duplicate'],
  ['⌘/Ctrl + G', 'Group selection'],
  ['⌘/Ctrl + Z', 'Undo'],
  ['⌘/Ctrl + ⇧ + Z', 'Redo'],
  ['Delete / ⌫', 'Delete selection'],
  ['Esc', 'Deselect / cancel tool'],
  ['Space (timeline)', 'Play / pause'],
  ['?', 'This help'],
];

export function HelpModal({ onClose }) {
  return (
    <Modal title="Quick start & shortcuts" onClose={onClose} footer={<Button variant="primary" onClick={onClose}>Got it</Button>}>
      <Section title="Workflow">
        <ol style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          <li>Drag <b>objects</b> and <b>drones</b> from the left panel onto the canvas.</li>
          <li>Select an object → <b>Form up</b> / <b>Cage</b> to surround it with drones.</li>
          <li><b>Keyframe</b> mode: add keyframes, reposition things, press Play to animate. Use <b>Auto-route</b> / <b>Draw</b> for paths around obstacles.</li>
          <li><b>Live swarm</b> mode: pick a mission (Flock, Seek, Formation, Caging, Transport…) and Run — drones sense neighbours, talk over the comm mesh, and move on their own.</li>
          <li>Toggle <b>2D / 3D</b> any time — it’s the same scene.</li>
        </ol>
      </Section>
      <Section title="Keyboard">
        <div className="list">
          {SHORTCUTS.map(([k, d]) => (
            <div key={k} className="field-row">
              <span className="field-row__label">{d}</span>
              <kbd>{k}</kbd>
            </div>
          ))}
        </div>
      </Section>
    </Modal>
  );
}
