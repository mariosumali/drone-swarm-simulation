/**
 * Canvas2D — the unified top-down viewport. Renders entities, paths, formation
 * slots and the live comm mesh; handles select / drag / marquee / pan / zoom and
 * the polygon + path drawing tools. Reads everything from the store; positions
 * come from live engine transforms (live mode) or interpolated keyframes.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useStore, actions } from '../../app/store.js';
import { setPath } from '../../app/missions.js';
import { displayTransforms, transitionFrames, transitionPath, expandSelection } from '../../model/selectors.js';
import { renderPolygon } from '../../model/entities.js';
import { ARENA } from '../../app/constants.js';
import { clamp, smoothOrRaw } from './canvasUtils.js';

const ROLE_COLOR = (e) =>
  e.obstacle ? 'var(--color-obstacle)' : e.transport ? 'var(--color-target)' : 'var(--text-muted)';

export default function Canvas2D({ liveTransforms, telemetry, isLive }) {
  const ref = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const entities = useStore((s) => s.entities);
  const selectedIds = useStore((s) => s.selectedIds);
  const view = useStore((s) => s.view);
  const tool = useStore((s) => s.tool);
  const settings = useStore((s) => s.settings);
  const ui = useStore((s) => s.ui);
  const state = useStore((s) => s);

  const transforms = isLive ? liveTransforms : displayTransforms(state);
  const selSet = new Set(selectedIds);

  /* ---- container size ---- */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cx = size.w / 2;
  const cy = size.h / 2;
  const toWorld = useCallback(
    (sx, sy) => ({ x: (sx - cx - view.x) / view.zoom, y: (sy - cy - view.y) / view.zoom }),
    [cx, cy, view]
  );
  const localPoint = (e) => {
    const r = ref.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  /* ---- wheel zoom (native, non-passive) ---- */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      const st = stateRef.current;
      const before = { x: (mx - r.width / 2 - st.view.x) / st.view.zoom, y: (my - r.height / 2 - st.view.y) / st.view.zoom };
      const factor = Math.pow(1.0015, -e.deltaY * (st.settings.zoomSensitivity || 1));
      const zoom = clamp(st.view.zoom * factor, 0.1, 6);
      actions.setView({
        zoom,
        x: mx - r.width / 2 - before.x * zoom,
        y: my - r.height / 2 - before.y * zoom,
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);
  const stateRef = useRef(state);
  stateRef.current = state;

  /* ---- spacebar pan mode ---- */
  const [spaceDown, setSpaceDown] = useState(false);
  useEffect(() => {
    const down = (e) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        setSpaceDown(true);
      }
    };
    const up = (e) => e.code === 'Space' && setSpaceDown(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  /* ---- interaction state ---- */
  const inter = useRef(null);
  const [marquee, setMarquee] = useState(null);

  const beginPan = (e) => {
    const start = localPoint(e);
    inter.current = { type: 'pan', start, view0: { ...view } };
  };

  const onBackgroundDown = (e) => {
    if (e.button === 1 || spaceDown || (e.button === 0 && e.shiftKey && tool.mode === 'select')) {
      beginPan(e);
      return;
    }
    if (tool.mode === 'draw-poly') {
      const w = toWorld(...Object.values(localPoint(e)));
      const pts = [...(tool.draft?.points || []), w];
      actions.setTool({ draft: { type: 'poly', points: pts } });
      return;
    }
    if (tool.mode === 'draw-path') return; // handled on pointerdown below
    if (e.button === 0) {
      const p = localPoint(e);
      inter.current = { type: 'marquee', start: p };
      setMarquee({ x: p.x, y: p.y, w: 0, h: 0 });
      if (!e.shiftKey) actions.clearSelection();
    }
  };

  const onEntityDown = (e, entity) => {
    if (tool.mode === 'draw-poly') return;
    e.stopPropagation();
    if (e.button === 1 || spaceDown) return beginPan(e);

    if (tool.mode === 'draw-path') {
      // start drawing a path for this entity across the current transition
      const { from, to } = transitionFrames(stateRef.current);
      const w = toWorld(...Object.values(localPoint(e)));
      inter.current = { type: 'path', entityId: entity.id, fromId: from.id, toId: to.id, points: [w] };
      actions.setTool({ draft: { type: 'path', points: [w] } });
      return;
    }

    // selection
    let ids;
    if (e.shiftKey) {
      actions.toggleSelect(entity.id);
      ids = selSet.has(entity.id) ? selectedIds.filter((i) => i !== entity.id) : [...selectedIds, entity.id];
    } else if (!selSet.has(entity.id)) {
      ids = expandSelection(stateRef.current, entity.id, false);
      actions.select(ids);
    } else {
      ids = selectedIds;
    }

    if (isLive) return; // no dragging during live sim
    const fid = stateRef.current.currentFrameId;
    const start = toWorld(...Object.values(localPoint(e)));
    const starts = {};
    ids.forEach((id) => {
      const ent = entities.find((x) => x.id === id);
      if (ent && !ent.locked) starts[id] = { ...(ent.frames[fid] || { x: 0, y: 0 }) };
    });
    actions.beginGesture();
    inter.current = { type: 'drag', ids: Object.keys(starts), start, starts };
  };

  /* ---- global move/up while interacting ---- */
  useEffect(() => {
    const move = (e) => {
      const it = inter.current;
      if (!it) return;
      const p = localPoint(e);
      if (it.type === 'pan') {
        actions.setView({ x: it.view0.x + (p.x - it.start.x), y: it.view0.y + (p.y - it.start.y) });
      } else if (it.type === 'marquee') {
        const x = Math.min(it.start.x, p.x);
        const y = Math.min(it.start.y, p.y);
        const w = Math.abs(p.x - it.start.x);
        const h = Math.abs(p.y - it.start.y);
        setMarquee({ x, y, w, h });
      } else if (it.type === 'drag') {
        const now = toWorld(p.x, p.y);
        const dx = now.x - it.start.x;
        const dy = now.y - it.start.y;
        const snap = stateRef.current.settings.snapToGrid ? stateRef.current.settings.gridSize : 0;
        it.ids.forEach((id) => {
          let nx = it.starts[id].x + dx;
          let ny = it.starts[id].y + dy;
          if (snap) {
            nx = Math.round(nx / snap) * snap;
            ny = Math.round(ny / snap) * snap;
          }
          actions.moveEntity(id, { x: nx, y: ny }, { history: false });
        });
      } else if (it.type === 'path') {
        const w = toWorld(p.x, p.y);
        const last = it.points[it.points.length - 1];
        if (!last || Math.hypot(w.x - last.x, w.y - last.y) > 6) {
          it.points.push(w);
          actions.setTool({ draft: { type: 'path', points: [...it.points] } });
        }
      }
    };
    const up = () => {
      const it = inter.current;
      if (it?.type === 'marquee') {
        finishMarquee();
      } else if (it?.type === 'path' && it.points.length > 1) {
        setPath(it.entityId, it.fromId, it.toId, it.points);
        actions.setTool({ mode: 'select', draft: null });
      }
      inter.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entities, view, toWorld]);

  const finishMarquee = () => {
    const m = marqueeRef.current;
    setMarquee(null);
    if (!m || (m.w < 4 && m.h < 4)) return;
    const a = toWorld(m.x, m.y);
    const b = toWorld(m.x + m.w, m.y + m.h);
    const hit = entities
      .filter((e) => {
        const t = transforms[e.id];
        return t && t.x >= a.x && t.x <= b.x && t.y >= a.y && t.y <= b.y;
      })
      .map((e) => e.id);
    actions.select(hit, true);
  };
  const marqueeRef = useRef(null);
  marqueeRef.current = marquee;

  /* ---- drop from library ---- */
  const onDrop = (e) => {
    e.preventDefault();
    let data;
    try {
      data = JSON.parse(e.dataTransfer.getData('application/swarm'));
    } catch {
      return;
    }
    const p = localPoint(e);
    const w = toWorld(p.x, p.y);
    if (data.kind === 'drone') actions.addDrone(data.type, w.x, w.y);
    else actions.addObject(data.type, w.x, w.y);
  };

  /* ---- double click to finish polygon ---- */
  const onDoubleClick = () => {
    if (tool.mode === 'draw-poly' && tool.draft?.points?.length >= 3) {
      actions.addPolygon(tool.draft.points);
      actions.setTool({ mode: 'select', draft: null });
    }
  };

  const cursor =
    spaceDown || inter.current?.type === 'pan'
      ? 'grabbing'
      : tool.mode === 'draw-poly' || tool.mode === 'draw-path'
      ? 'crosshair'
      : 'default';

  const worldTransform = `translate(${cx + view.x}px, ${cy + view.y}px) scale(${view.zoom})`;

  return (
    <div
      ref={ref}
      className="canvas2d"
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', cursor, background: 'var(--canvas-bg)' }}
      onPointerDown={onBackgroundDown}
      onDoubleClick={onDoubleClick}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      {/* grid */}
      {settings.showGrid && <Grid view={view} size={size} />}

      <div style={{ position: 'absolute', left: 0, top: 0, transform: worldTransform, transformOrigin: '0 0' }}>
        {/* arena boundary */}
        <ArenaBoundary />

        {/* transition paths (keyframe) */}
        {ui.showPaths && !isLive && <PathsLayer entities={entities} state={state} />}

        {/* live comm mesh */}
        {isLive && telemetry?.links && <CommMesh links={telemetry.links} />}

        {/* entities */}
        {entities.map((e) => {
          const t = transforms[e.id];
          if (!t) return null;
          return (
            <EntityNode
              key={e.id}
              entity={e}
              t={t}
              selected={selSet.has(e.id)}
              zoom={view.zoom}
              ui={ui}
              showLabel={settings.showObjectLabels ?? settings.showLabels}
              onPointerDown={onEntityDown}
            />
          );
        })}

        {/* draft polygon */}
        {tool.mode === 'draw-poly' && tool.draft?.points?.length > 0 && (
          <DraftPoly points={tool.draft.points} />
        )}
        {tool.draft?.type === 'path' && tool.draft.points?.length > 1 && (
          <DraftPath points={tool.draft.points} />
        )}
      </div>

      {/* marquee */}
      {marquee && (
        <div
          style={{
            position: 'absolute',
            left: marquee.x,
            top: marquee.y,
            width: marquee.w,
            height: marquee.h,
            border: '1px solid var(--accent)',
            background: 'var(--accent-soft)',
            borderRadius: 2,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}

/* =============================================================== sub-views */
function Grid({ view, size }) {
  const g = 24 * view.zoom;
  if (g < 4) return null;
  const ox = ((size.w / 2 + view.x) % g + g) % g;
  const oy = ((size.h / 2 + view.y) % g + g) % g;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage:
          'linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)',
        backgroundSize: `${g}px ${g}px`,
        backgroundPosition: `${ox}px ${oy}px`,
        pointerEvents: 'none',
      }}
    />
  );
}

function ArenaBoundary() {
  const w = ARENA.maxX - ARENA.minX;
  const h = ARENA.maxY - ARENA.minY;
  return (
    <div
      style={{
        position: 'absolute',
        left: ARENA.minX,
        top: ARENA.minY,
        width: w,
        height: h,
        border: '1.5px dashed var(--grid-line-strong)',
        borderRadius: 8,
        pointerEvents: 'none',
      }}
    />
  );
}

function svgOverlay(children, key) {
  return (
    <svg
      key={key}
      width="1"
      height="1"
      style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}
    >
      {children}
    </svg>
  );
}

function PathsLayer({ entities, state }) {
  const { from, to } = transitionFrames(state);
  const lines = [];
  entities.forEach((e, idx) => {
    const a = e.frames[from.id];
    const b = e.frames[to.id];
    if (!a || !b || from.id === to.id) return;
    const path = transitionPath(e, from.id, to.id);
    const pts = smoothOrRaw(path || [a, b]);
    const hue = (idx * 47) % 360;
    const color = e.kind === 'drone' ? 'var(--color-air)' : `hsl(${hue} 70% 60%)`;
    lines.push(
      <polyline
        key={e.id}
        points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray="6 6"
        opacity={0.7}
      />
    );
  });
  return svgOverlay(lines, 'paths');
}

function CommMesh({ links }) {
  return svgOverlay(
    links.map((l, i) => (
      <line
        key={i}
        x1={l.a.x}
        y1={l.a.y}
        x2={l.b.x}
        y2={l.b.y}
        stroke="var(--color-air)"
        strokeWidth={0.8}
        opacity={0.28}
      />
    )),
    'mesh'
  );
}

function DraftPoly({ points }) {
  return svgOverlay(
    <>
      <polyline points={points.map((p) => `${p.x},${p.y}`).join(' ')} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth={1.5} />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} fill="var(--accent)" />
      ))}
    </>,
    'draft-poly'
  );
}

function DraftPath({ points }) {
  return svgOverlay(
    <polyline points={points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="var(--warning)" strokeWidth={2} />,
    'draft-path'
  );
}

/* ---- entity node ---- */
function EntityNode({ entity: e, t, selected, zoom, ui, showLabel, onPointerDown }) {
  const isDrone = e.kind === 'drone';
  const common = {
    position: 'absolute',
    left: t.x,
    top: t.y,
    transform: `translate(-50%,-50%) rotate(${t.rotation || 0}deg)`,
    cursor: 'pointer',
  };

  return (
    <div onPointerDown={(ev) => onPointerDown(ev, e)} style={{ ...common, willChange: 'transform' }}>
      {isDrone ? (
        <DroneMarker e={e} t={t} selected={selected} ui={ui} />
      ) : (
        <ObjectShape e={e} selected={selected} />
      )}
      {showLabel && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: '50%',
            transform: `translateX(-50%) rotate(${-(t.rotation || 0)}deg) scale(${1 / Math.max(zoom, 0.4)})`,
            transformOrigin: 'top center',
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--text-muted)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            textShadow: '0 1px 2px var(--bg)',
          }}
        >
          {e.name}
          {t.z > 1 && <span style={{ color: 'var(--color-air)' }}> · {Math.round(t.z)}m</span>}
        </div>
      )}
    </div>
  );
}

function ObjectShape({ e, selected }) {
  const color = ROLE_COLOR(e);
  const ring = selected ? 'var(--accent)' : color;
  const glow = selected ? '0 0 0 2px var(--accent), 0 0 18px var(--accent-soft)' : 'none';
  const baseStyle = {
    border: `2px ${e.noFly ? 'dashed' : 'solid'} ${ring}`,
    background: e.obstacle ? 'var(--danger-soft)' : e.transport ? 'rgba(167,139,250,0.12)' : 'var(--surface-3)',
    boxShadow: glow,
    boxSizing: 'border-box',
  };
  if (e.shape === 'circle') {
    const d = (e.radius || 50) * 2;
    return <div style={{ ...baseStyle, width: d, height: d, borderRadius: '50%' }} />;
  }
  if (e.shape === 'polygon') {
    const pts = renderPolygon(e) || [];
    const w = e.w || 100;
    const h = e.h || 100;
    return (
      <svg width={w} height={h} viewBox={`${-w / 2} ${-h / 2} ${w} ${h}`} style={{ overflow: 'visible', display: 'block' }}>
        <polygon
          points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
          fill={e.obstacle ? 'var(--danger-soft)' : e.transport ? 'rgba(167,139,250,0.14)' : 'var(--surface-3)'}
          stroke={ring}
          strokeWidth={2}
          strokeDasharray={e.noFly ? '6 5' : undefined}
          style={{ filter: selected ? 'drop-shadow(0 0 6px var(--accent))' : 'none' }}
        />
      </svg>
    );
  }
  return <div style={{ ...baseStyle, width: e.w || 100, height: e.h || 100, borderRadius: 4 }} />;
}

function DroneMarker({ e, t, selected, ui }) {
  const color = e.droneType === 'air' ? 'var(--color-air)' : 'var(--color-ground)';
  const r = e.radius || 12;
  const flying = (t.z || 0) > 2;
  return (
    <div style={{ position: 'relative' }}>
      {ui.showSensors && (
        <span
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: e.sensorRadius * 2,
            height: e.sensorRadius * 2,
            transform: 'translate(-50%,-50%)',
            border: '1px solid var(--grid-line-strong)',
            borderRadius: '50%',
            pointerEvents: 'none',
          }}
        />
      )}
      {ui.showComms && (
        <span
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 300 * 2,
            height: 300 * 2,
            transform: 'translate(-50%,-50%)',
            border: '1px dashed rgba(56,189,248,0.25)',
            borderRadius: '50%',
            pointerEvents: 'none',
          }}
        />
      )}
      <div
        style={{
          width: r * 2,
          height: r * 2,
          borderRadius: e.droneType === 'air' ? '50%' : 3,
          background: color,
          border: selected ? '2px solid var(--accent)' : `2px solid color-mix(in srgb, ${color} 60%, black)`,
          boxShadow: selected
            ? '0 0 0 2px var(--accent), 0 0 14px var(--accent-soft)'
            : flying
            ? `0 6px 10px rgba(0,0,0,0.45), 0 0 10px ${color}`
            : '0 1px 3px rgba(0,0,0,0.4)',
          display: 'grid',
          placeItems: 'center',
          transition: 'box-shadow 120ms',
        }}
      >
        <span style={{ width: r * 0.5, height: 2, background: 'rgba(255,255,255,0.85)', borderRadius: 2, marginLeft: r * 0.5 }} />
      </div>
      {e.assignedTo && (
        <span
          style={{
            position: 'absolute',
            top: -3,
            right: -3,
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--color-target)',
            boxShadow: '0 0 4px var(--color-target)',
          }}
        />
      )}
    </div>
  );
}
