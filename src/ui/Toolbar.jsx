/** Toolbar — top bar: brand, history, file ops, multi-select tools, view + theme. */
import React, { useRef } from 'react';
import {
  Undo2, Redo2, Save, FolderOpen, FilePlus2, Settings, Sun, Moon, HelpCircle,
  Group, Ungroup, Trash2, Box, Orbit, Video, Github,
  AlignHorizontalJustifyStart, AlignHorizontalJustifyEnd, AlignVerticalJustifyStart, AlignVerticalJustifyEnd,
} from 'lucide-react';
import { useStore, actions, getState } from '../app/store.js';
import { Button, IconButton, Segmented } from './primitives.jsx';

export default function Toolbar({ onOpenSettings, onOpenHelp, recording, onToggleRecord }) {
  const theme = useStore((s) => s.theme);
  const dim = useStore((s) => s.view.dim);
  const canUndo = useStore((s) => s.history.past.length > 0);
  const canRedo = useStore((s) => s.history.future.length > 0);
  const selCount = useStore((s) => s.selectedIds.length);
  const hasGroup = useStore((s) => s.entities.some((e) => s.selectedIds.includes(e.id) && e.groupId));
  const fileRef = useRef(null);

  const save = () => {
    const st = getState();
    const doc = {
      version: 3,
      savedAt: new Date().toISOString(),
      entities: st.entities,
      frames: st.frames,
      currentFrameId: st.currentFrameId,
      groups: st.groups,
    };
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `swarm-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    actions.toast('Scene saved', 'success');
  };
  const load = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        actions.loadDocument(JSON.parse(ev.target.result));
        actions.toast('Scene loaded', 'success');
      } catch {
        actions.toast('Invalid file', 'danger');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="topbar__logo">
          <Box size={16} />
        </span>
        Swarm&nbsp;Studio
      </div>

      <div className="topbar__divider" />
      <div className="topbar__group">
        <IconButton icon={Undo2} label="Undo (⌘Z)" onClick={actions.undo} disabled={!canUndo} />
        <IconButton icon={Redo2} label="Redo (⌘⇧Z)" onClick={actions.redo} disabled={!canRedo} />
      </div>

      <div className="topbar__divider" />
      <div className="topbar__group">
        <IconButton icon={FilePlus2} label="New scene" onClick={() => actions.newDocument()} />
        <IconButton icon={Save} label="Save scene" onClick={save} />
        <IconButton icon={FolderOpen} label="Open scene" onClick={() => fileRef.current.click()} />
        <input ref={fileRef} type="file" accept=".json" hidden onChange={load} />
      </div>

      {selCount >= 2 && (
        <>
          <div className="topbar__divider" />
          <div className="topbar__group">
            <Button size="sm" variant="primary" icon={Group} onClick={actions.group}>
              Group
            </Button>
            {hasGroup && <IconButton icon={Ungroup} label="Ungroup (⌘⇧G)" onClick={actions.ungroup} />}
            <IconButton icon={AlignHorizontalJustifyStart} label="Align left" onClick={() => align('left')} />
            <IconButton icon={AlignHorizontalJustifyEnd} label="Align right" onClick={() => align('right')} />
            <IconButton icon={AlignVerticalJustifyStart} label="Align top" onClick={() => align('top')} />
            <IconButton icon={AlignVerticalJustifyEnd} label="Align bottom" onClick={() => align('bottom')} />
            <IconButton icon={Trash2} danger label="Delete (⌫)" onClick={actions.deleteSelected} />
          </div>
        </>
      )}

      <div className="topbar__spacer" />

      <Segmented
        value={dim}
        onChange={actions.setDim}
        options={[
          { value: '2d', label: '2D' },
          { value: '3d', label: '3D', icon: Orbit },
        ]}
      />
      <div className="topbar__divider" />
      <div className="topbar__group">
        <IconButton
          icon={recording ? Video : Video}
          label={recording ? 'Stop recording' : 'Record canvas'}
          active={recording}
          onClick={onToggleRecord}
        />
        <IconButton icon={theme === 'dark' ? Sun : Moon} label="Toggle theme" onClick={actions.toggleTheme} />
        <IconButton icon={Settings} label="Settings" onClick={onOpenSettings} />
        <IconButton icon={HelpCircle} label="Help (?)" onClick={onOpenHelp} />
      </div>
    </header>
  );
}

/* alignment over the current frame */
function align(kind) {
  const s = getState();
  const fid = s.currentFrameId;
  const sel = s.entities.filter((e) => s.selectedIds.includes(e.id));
  if (sel.length < 2) return;
  const pos = (e) => e.frames[fid] || { x: 0, y: 0 };
  let target;
  if (kind === 'left') target = Math.min(...sel.map((e) => pos(e).x));
  if (kind === 'right') target = Math.max(...sel.map((e) => pos(e).x));
  if (kind === 'top') target = Math.min(...sel.map((e) => pos(e).y));
  if (kind === 'bottom') target = Math.max(...sel.map((e) => pos(e).y));
  actions.apply((st) => ({
    entities: st.entities.map((e) => {
      if (!s.selectedIds.includes(e.id)) return e;
      const cur = e.frames[fid] || { x: 0, y: 0, z: 0, rotation: 0 };
      const axis = kind === 'left' || kind === 'right' ? 'x' : 'y';
      return { ...e, frames: { ...e.frames, [fid]: { ...cur, [axis]: target } } };
    }),
  }));
}
