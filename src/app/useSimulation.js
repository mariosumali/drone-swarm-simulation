/**
 * useSimulation — drives both run modes off the same store:
 *  • keyframe: a RAF animates sim.progress and advances frames (scripted choreography)
 *  • live:     builds the SwarmEngine and steps physics+agents each frame (emergent swarm)
 * Returns live transforms + telemetry for the canvas/HUD (null while editing).
 */
import { useEffect, useRef, useState } from 'react';
import { useStore, actions, getState } from './store.js';
import { SwarmEngine } from '../sim/engine.js';
import { ARENA } from './constants.js';

function focusObjectId(s) {
  for (const id of s.selectedIds) {
    const e = s.entities.find((x) => x.id === id);
    if (e && e.kind === 'object') return id;
  }
  return null;
}

/** Build the engine config snapshot (focus + goal for the chosen mission). */
function missionSnapshot(s, focusId) {
  let goal = null;
  if (focusId) {
    const focus = s.entities.find((e) => e.id === focusId);
    const lastFrame = s.frames[s.frames.length - 1];
    const lt = focus?.frames[lastFrame.id];
    if (lt) goal = { x: lt.x, y: lt.y };
  }
  return { mission: s.sim.mission, focusId, goal };
}

export function useSimulation() {
  const engine = useStore((s) => s.sim.engine);
  const playing = useStore((s) => s.sim.playing);
  const mission = useStore((s) => s.sim.mission);
  const currentFrameId = useStore((s) => s.currentFrameId);
  const focusId = useStore(focusObjectId);
  const commRange = useStore((s) => s.settings.commRange);
  const standoff = useStore((s) => s.settings.standoff);
  const altitude = useStore((s) => s.settings.altitude);

  const [live, setLive] = useState(null);
  const engineRef = useRef(null);

  /* ---------------- keyframe playback ---------------- */
  useEffect(() => {
    if (engine !== 'keyframe' || !playing) return;
    const s0 = getState();
    const idx = s0.frames.findIndex((f) => f.id === s0.currentFrameId);
    if (idx >= s0.frames.length - 1) {
      actions.setPlaying(false);
      return;
    }
    const duration = Math.max(150, (s0.settings.transitionDuration * 1000) / s0.sim.speed);
    let start = null;
    let raf = 0;
    const tick = (ts) => {
      if (start == null) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      actions.setProgress(p);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        const s = getState();
        const i = s.frames.findIndex((f) => f.id === s.currentFrameId);
        if (i < s.frames.length - 1) actions.setCurrentFrame(s.frames[i + 1].id);
        else actions.setPlaying(false);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine, playing, currentFrameId]);

  /* ---------------- live swarm engine (build/run) ---------------- */
  useEffect(() => {
    if (engine !== 'live' || !playing) {
      setLive(null);
      engineRef.current = null;
      return;
    }
    const s = getState();
    const eng = new SwarmEngine();
    eng.build({
      entities: s.entities,
      frameId: s.currentFrameId,
      settings: s.settings,
      bounds: ARENA,
      ...missionSnapshot(s, focusId),
    });
    engineRef.current = eng;

    let last = performance.now();
    let raf = 0;
    const loop = (ts) => {
      const speed = getState().sim.speed;
      const dt = Math.min(40, ts - last);
      last = ts;
      eng.step(dt * speed);
      setLive({ transforms: eng.getTransforms(), telemetry: eng.getTelemetry() });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      eng.destroy();
      engineRef.current = null;
    };
    // focusId/settings changes are handled by the reconfigure effect below (no rebuild)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, playing, currentFrameId]);

  /* reconfigure mission/focus/comms in place (no jarring rebuild) */
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.settings = getState().settings;
    eng.configure(missionSnapshot(getState(), focusId));
  }, [mission, focusId, commRange, standoff, altitude]);

  return {
    liveTransforms: live?.transforms || null,
    telemetry: live?.telemetry || null,
    isLive: engine === 'live' && playing && !!live,
  };
}
