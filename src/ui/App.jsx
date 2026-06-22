/** App — the unified shell: toolbar, panels, canvas (2D/3D), timeline, HUD. */
import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { useStore, actions, getState } from '../app/store.js';
import { useSimulation } from '../app/useSimulation.js';
import Toolbar from './Toolbar.jsx';
import LibraryPanel from './LibraryPanel.jsx';
import Inspector from './Inspector.jsx';
import Timeline from './Timeline.jsx';
import Canvas2D from './canvas/Canvas2D.jsx';
import Telemetry from './Telemetry.jsx';

// Three.js is heavy and only needed for the 3D view — load it on demand.
const Canvas3D = lazy(() => import('./canvas/Canvas3D.jsx'));
import ViewControls from './ViewControls.jsx';
import Toasts from './Toasts.jsx';
import { SettingsModal, HelpModal } from './modals.jsx';

const isTyping = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);

export default function App() {
  const theme = useStore((s) => s.theme);
  const dim = useStore((s) => s.view.dim);
  const showTelemetry = useStore((s) => s.ui.telemetry);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const { liveTransforms, telemetry, isLive } = useSimulation();

  /* theme */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  /* keyboard shortcuts */
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        if (!isTyping()) setHelpOpen(true);
        return;
      }
      if (isTyping()) return;

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? actions.redo() : actions.undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        actions.redo();
      } else if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        actions.selectAll();
      } else if (mod && e.key.toLowerCase() === 'c') {
        actions.copy();
      } else if (mod && e.key.toLowerCase() === 'v') {
        actions.paste();
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        actions.duplicateSelected();
      } else if (mod && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        e.shiftKey ? actions.ungroup() : actions.group();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        actions.deleteSelected();
      } else if (e.key === 'Escape') {
        const t = getState().tool;
        if (t.mode !== 'select') actions.setTool({ mode: 'select', draft: null });
        else actions.clearSelection();
      } else if (e.key === 'v' || e.key === 'V') {
        actions.setTool({ mode: 'select', draft: null });
      } else if (e.key === 'p' || e.key === 'P') {
        actions.setTool({ mode: 'draw-poly', draft: { type: 'poly', points: [] } });
      } else if (e.key === ' ') {
        // play/pause from anywhere except while panning canvas is handled separately
        const s = getState();
        if (!isTyping()) {
          e.preventDefault();
          s.sim.playing ? actions.setPlaying(false) : actions.play();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* screen recording */
  const [recording, setRecording] = useState(false);
  const recRef = useRef(null);
  const toggleRecord = async () => {
    if (recording) {
      recRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'browser' }, audio: false, preferCurrentTab: true });
      const rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks = [];
      rec.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `swarm-${new Date().toISOString().slice(0, 19)}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
      };
      stream.getVideoTracks()[0].onended = () => rec.state !== 'inactive' && rec.stop();
      recRef.current = rec;
      rec.start();
      setRecording(true);
      actions.toast('Recording — pick this tab', 'info');
    } catch {
      actions.toast('Recording cancelled', 'warning');
    }
  };

  return (
    <div className="app">
      <Toolbar
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
        recording={recording}
        onToggleRecord={toggleRecord}
      />

      <div className="app__body">
        <LibraryPanel />

        <div className="app__center">
          <div className="app__stage">
            {dim === '3d' ? (
              <Suspense fallback={<div className="empty" style={{ height: '100%' }}><div className="empty__title">Loading 3D…</div></div>}>
                <Canvas3D liveTransforms={liveTransforms} isLive={isLive} />
              </Suspense>
            ) : (
              <Canvas2D liveTransforms={liveTransforms} telemetry={telemetry} isLive={isLive} />
            )}
            {dim === '2d' && <ViewControls />}
            {showTelemetry && <Telemetry telemetry={telemetry} isLive={isLive} liveTransforms={liveTransforms} />}
          </div>
          <Timeline />
        </div>

        <Inspector />
      </div>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      <Toasts />
    </div>
  );
}
