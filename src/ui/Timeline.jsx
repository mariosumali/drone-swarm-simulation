/** Timeline (bottom) — transport, engine toggle, mission/scrubber, keyframe track. */
import React, { useState } from 'react';
import { Play, Pause, Square, Plus, Trash2, Film, Radio, Copy } from 'lucide-react';
import { useStore, actions } from '../app/store.js';
import { MISSIONS } from '../app/constants.js';
import { Button, IconButton, Segmented } from './primitives.jsx';

const SPEEDS = [0.5, 1, 2, 4];

export default function Timeline() {
  const frames = useStore((s) => s.frames);
  const currentFrameId = useStore((s) => s.currentFrameId);
  const sim = useStore((s) => s.sim);
  const idx = frames.findIndex((f) => f.id === currentFrameId);
  const live = sim.engine === 'live';
  const canPlay = live || frames.length >= 2;

  return (
    <div className="timeline">
      {/* row 1: transport + engine + mission / scrubber */}
      <div className="timeline__top">
        <div className="row" style={{ gap: 6 }}>
          <Button
            variant="primary"
            size="sm"
            icon={sim.playing ? Pause : Play}
            disabled={!canPlay}
            onClick={() => (sim.playing ? actions.setPlaying(false) : actions.play())}
          >
            {sim.playing ? 'Pause' : live ? 'Run' : 'Play'}
          </Button>
          <IconButton size="sm" icon={Square} label="Stop" onClick={actions.stop} />
          <div className="segmented" style={{ marginLeft: 4 }}>
            {SPEEDS.map((s) => (
              <button
                key={s}
                className="segmented__item"
                data-active={sim.speed === s ? 'true' : 'false'}
                onClick={() => actions.setSpeed(s)}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        <Segmented
          value={sim.engine}
          onChange={actions.setEngine}
          options={[
            { value: 'keyframe', label: 'Keyframe', icon: Film },
            { value: 'live', label: 'Live swarm', icon: Radio },
          ]}
        />

        {live ? (
          <div className="row" style={{ gap: 8, flex: 1, justifyContent: 'flex-end' }}>
            <span className="field__label">Mission</span>
            <select
              className="select"
              style={{ width: 150 }}
              value={sim.mission}
              onChange={(e) => actions.setMission(e.target.value)}
              title={MISSIONS.find((m) => m.value === sim.mission)?.desc}
            >
              {MISSIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        ) : (
          <Scrubber frames={frames} idx={idx} progress={sim.progress} />
        )}
      </div>

      {/* row 2: keyframe track */}
      <div className="timeline__track">
        {frames.map((f, i) => (
          <FrameChip key={f.id} frame={f} index={i} active={f.id === currentFrameId} canDelete={frames.length > 1 && i > 0} />
        ))}
        <button className="frame-chip frame-chip--add" onClick={actions.addFrame} title="Add keyframe">
          <Plus size={15} /> Keyframe
        </button>
      </div>
    </div>
  );
}

function Scrubber({ frames, idx, progress }) {
  if (frames.length < 2) {
    return (
      <div className="row" style={{ flex: 1, justifyContent: 'flex-end' }}>
        <span className="faint text-xs">Add a keyframe to choreograph motion →</span>
      </div>
    );
  }
  const pct = ((idx + progress) / (frames.length - 1)) * 100;
  return (
    <div className="scrubber" title="Click a keyframe marker to jump">
      <div className="scrubber__fill" style={{ width: `${pct}%` }} />
      <div className="scrubber__head" style={{ left: `${pct}%` }} />
      {frames.map((f, i) => (
        <button
          key={f.id}
          className="scrubber__tick"
          style={{ left: `${(i / (frames.length - 1)) * 100}%` }}
          data-active={i === idx ? 'true' : 'false'}
          onClick={() => actions.setCurrentFrame(f.id)}
          title={f.name}
        />
      ))}
    </div>
  );
}

function FrameChip({ frame, index, active, canDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(frame.name);
  const commit = () => {
    setEditing(false);
    if (name.trim()) actions.renameFrame(frame.id, name.trim());
  };
  return (
    <div
      className="frame-chip"
      data-active={active ? 'true' : 'false'}
      onClick={() => actions.setCurrentFrame(frame.id)}
    >
      <span className="frame-chip__num">{index + 1}</span>
      {editing ? (
        <input
          className="input"
          style={{ height: 22, width: 90 }}
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="frame-chip__name" onDoubleClick={(e) => { e.stopPropagation(); setName(frame.name); setEditing(true); }}>
          {frame.name}
        </span>
      )}
      <span className="frame-chip__actions">
        <IconButton size="sm" icon={Copy} label="Duplicate keyframe" onClick={(e) => { e.stopPropagation(); actions.duplicateFrame(frame.id); }} />
        {canDelete && (
          <IconButton size="sm" icon={Trash2} danger label="Delete keyframe" onClick={(e) => { e.stopPropagation(); actions.deleteFrame(frame.id); }} />
        )}
      </span>
    </div>
  );
}
