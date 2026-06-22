/**
 * store.js — the single application store.
 *
 * A tiny dependency-free external store (subscribe / getState / setState) read
 * through `useStore(selector)` (useSyncExternalStore). All document mutations
 * live in `actions`. The "document" (entities, frames, groups) is the part that
 * undo/redo and autosave care about; view/selection/sim are ephemeral.
 */
import { useRef, useSyncExternalStore } from 'react';
import { v4 as uuid } from 'uuid';
import {
  makeObject,
  makePolygonObject,
  makeDrone,
  newFrame,
  resetNameCounters,
} from '../model/entities.js';

const STORAGE_KEY = 'swarm-studio.v1';
const PREFS_KEY = 'swarm-studio.prefs.v1';

const DEFAULT_SETTINGS = {
  gridSize: 24,
  snapToGrid: false,
  showGrid: true,
  transitionDuration: 2,
  easing: 'easeInOutCubic',
  defaultDrone: 'air',
  commRange: 300,
  standoff: 34,
  altitude: 70,
  panSensitivity: 1,
  zoomSensitivity: 1,
  autoSave: true,
};

const DEFAULT_UI = {
  showPaths: true,
  showSensors: false,
  showComms: false,
  showLabels: true,
  telemetry: true,
  leftPanel: true,
  rightPanel: true,
};

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
  } catch {
    return {};
  }
}

function loadDoc() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (raw?.frames?.length && raw?.entities) {
      resetNameCounters(raw.entities);
      return raw;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function freshDoc() {
  const f = newFrame('Initial');
  return { entities: [], frames: [f], currentFrameId: f.id, groups: [] };
}

function initialState() {
  const prefs = loadPrefs();
  const doc = (prefs.autoSave !== false && loadDoc()) || freshDoc();
  return {
    ...doc,
    selectedIds: [],
    clipboard: [],
    tool: { mode: 'select', draft: null },
    view: { dim: '2d', zoom: 1, x: 0, y: 0 },
    sim: { engine: 'keyframe', playing: false, progress: 0, speed: 1, mission: 'idle' },
    ui: { ...DEFAULT_UI, ...(prefs.ui || {}) },
    settings: { ...DEFAULT_SETTINGS, ...(prefs.settings || {}) },
    theme: prefs.theme || 'dark',
    history: { past: [], future: [] },
    toasts: [],
  };
}

/* ------------------------------------------------------------ store core */
let state = initialState();
const listeners = new Set();

function emit() {
  for (const l of listeners) l();
}
const store = {
  getState: () => state,
  subscribe: (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  set: (patch) => {
    state = typeof patch === 'function' ? { ...state, ...patch(state) } : { ...state, ...patch };
    emit();
    schedulePersist();
  },
};

/* ------------------------------------------------------------ persistence */
let persistTimer = null;
function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const prefs = {
      theme: state.theme,
      settings: state.settings,
      ui: state.ui,
      autoSave: state.settings.autoSave,
    };
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
      if (state.settings.autoSave) {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            entities: state.entities,
            frames: state.frames,
            currentFrameId: state.currentFrameId,
            groups: state.groups,
          })
        );
      }
    } catch {
      /* quota / private mode */
    }
  }, 400);
}

/* ------------------------------------------------------------ React hook */
export function useStore(selector = (s) => s) {
  const cache = useRef({ state: null, sel: null, value: undefined });
  const get = () => {
    const c = cache.current;
    if (c.state !== state || c.sel !== selector) {
      c.state = state;
      c.sel = selector;
      c.value = selector(state);
    }
    return c.value;
  };
  return useSyncExternalStore(store.subscribe, get, get);
}

export const getState = store.getState;

/* ------------------------------------------------------------ history */
const DOC_KEYS = ['entities', 'frames', 'currentFrameId', 'groups'];
function docSnapshot(s) {
  const d = {};
  for (const k of DOC_KEYS) d[k] = s[k];
  return d;
}
function pushHistory() {
  const past = [...state.history.past, docSnapshot(state)];
  if (past.length > 80) past.shift();
  store.set({ history: { past, future: [] } });
}

/* Helper for document mutations that should be undoable + clear future. */
function commit(recipe) {
  pushHistory();
  store.set(recipe(state));
}
/* Live mutation without a new history entry (during drags). */
function mutate(recipe) {
  store.set(recipe(state));
}

/* ------------------------------------------------------------ helpers */
const arr = (set) => Array.from(set);
const idSet = (ids) => new Set(ids);

function withTransform(entity, frameId, patch) {
  const cur = entity.frames[frameId] || { x: 0, y: 0, z: 0, rotation: 0 };
  return {
    ...entity,
    frames: { ...entity.frames, [frameId]: { ...cur, ...patch } },
    frameIds: entity.frameIds.includes(frameId)
      ? entity.frameIds
      : [...entity.frameIds, frameId],
  };
}

/* ============================================================ ACTIONS */
export const actions = {
  /* ---- preferences / view / ui ---- */
  setTheme: (theme) => store.set({ theme }),
  toggleTheme: () => store.set({ theme: state.theme === 'dark' ? 'light' : 'dark' }),
  setSetting: (key, value) => store.set({ settings: { ...state.settings, [key]: value } }),
  resetSettings: () => store.set({ settings: { ...DEFAULT_SETTINGS } }),
  setView: (patch) => store.set({ view: { ...state.view, ...patch } }),
  setDim: (dim) => store.set({ view: { ...state.view, dim } }),
  resetView: () => store.set({ view: { ...state.view, zoom: 1, x: 0, y: 0 } }),
  zoomBy: (factor, _center) => {
    const v = state.view;
    const zoom = Math.min(6, Math.max(0.1, v.zoom * factor));
    store.set({ view: { ...v, zoom } });
  },
  setUI: (key, value) => store.set({ ui: { ...state.ui, [key]: value } }),
  toggleUI: (key) => store.set({ ui: { ...state.ui, [key]: !state.ui[key] } }),
  setTool: (patch) => store.set({ tool: { ...state.tool, ...patch } }),

  /* ---- selection ---- */
  select: (ids, additive = false) => {
    const next = additive ? idSet([...state.selectedIds, ...ids]) : idSet(ids);
    store.set({ selectedIds: arr(next) });
  },
  toggleSelect: (id) => {
    const s = idSet(state.selectedIds);
    s.has(id) ? s.delete(id) : s.add(id);
    store.set({ selectedIds: arr(s) });
  },
  selectOne: (id) => store.set({ selectedIds: id ? [id] : [] }),
  selectAll: () => store.set({ selectedIds: state.entities.map((e) => e.id) }),
  clearSelection: () => store.set({ selectedIds: [] }),

  /* ---- entity creation ---- */
  addObject: (type, x, y) => {
    const e = makeObject(type, state.currentFrameId, x, y);
    commit((s) => ({ entities: [...s.entities, e], selectedIds: [e.id] }));
    return e.id;
  },
  addPolygon: (points) => {
    const e = makePolygonObject(points, state.currentFrameId);
    commit((s) => ({ entities: [...s.entities, e], selectedIds: [e.id] }));
    return e.id;
  },
  addDrone: (droneType, x, y) => {
    const e = makeDrone(droneType, state.currentFrameId, x, y);
    commit((s) => ({ entities: [...s.entities, e], selectedIds: [e.id] }));
    return e.id;
  },
  addEntities: (entities) =>
    commit((s) => ({
      entities: [...s.entities, ...entities],
      selectedIds: entities.map((e) => e.id),
    })),

  /* ---- entity edits ---- */
  /** Patch arbitrary (non-transform) entity props. */
  patchEntity: (id, patch, { history = true } = {}) => {
    const recipe = (s) => ({
      entities: s.entities.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });
    history ? commit(recipe) : mutate(recipe);
  },
  /** Update the transform at the current frame; moves locked formation drones too. */
  moveEntity: (id, patch, { history = true } = {}) => {
    const fid = state.currentFrameId;
    const recipe = (s) => {
      const target = s.entities.find((e) => e.id === id);
      const moved = withTransform(target, fid, patch);
      let entities = s.entities.map((e) => (e.id === id ? moved : e));
      // carry assigned drones if a transport object moves
      if (target.kind === 'object' && target.transport && target.assignedDrones?.length) {
        const base = moved.frames[fid];
        entities = entities.map((e) => {
          if (target.assignedDrones.includes(e.id) && e.offset) {
            return withTransform(e, fid, {
              x: base.x + e.offset.x,
              y: base.y + e.offset.y,
              z: (base.z || 0) + (e.offset.z || 0),
            });
          }
          return e;
        });
      }
      return { entities };
    };
    history ? commit(recipe) : mutate(recipe);
  },
  beginGesture: () => pushHistory(),

  deleteSelected: () => {
    if (!state.selectedIds.length) return;
    const del = idSet(state.selectedIds);
    commit((s) => ({
      entities: s.entities
        .filter((e) => !del.has(e.id))
        .map((e) => {
          // break formations that lost a member
          if (e.assignedDrones?.some((d) => del.has(d))) {
            return { ...e, transport: false, assignedDrones: [] };
          }
          if (e.assignedTo && del.has(e.assignedTo)) {
            return { ...e, assignedTo: null, offset: null };
          }
          return e;
        }),
      selectedIds: [],
    }));
  },
  duplicateSelected: (dx = 30, dy = 30) => {
    const sel = state.entities.filter((e) => state.selectedIds.includes(e.id));
    if (!sel.length) return;
    const clones = sel.map((e) => cloneEntity(e, dx, dy));
    commit((s) => ({ entities: [...s.entities, ...clones], selectedIds: clones.map((c) => c.id) }));
  },
  copy: () => {
    const sel = state.entities.filter((e) => state.selectedIds.includes(e.id));
    store.set({ clipboard: sel.map((e) => JSON.parse(JSON.stringify(e))) });
  },
  paste: () => {
    if (!state.clipboard.length) return;
    const clones = state.clipboard.map((e) => cloneEntity(e, 40, 40));
    commit((s) => ({ entities: [...s.entities, ...clones], selectedIds: clones.map((c) => c.id) }));
  },

  /* ---- groups ---- */
  group: () => {
    if (state.selectedIds.length < 2) return;
    const gid = uuid();
    const members = [...state.selectedIds];
    commit((s) => ({
      groups: [...s.groups, { id: gid, name: `Group ${s.groups.length + 1}`, members }],
      entities: s.entities.map((e) => (members.includes(e.id) ? { ...e, groupId: gid } : e)),
    }));
  },
  ungroup: () => {
    const gids = new Set(
      state.entities.filter((e) => state.selectedIds.includes(e.id) && e.groupId).map((e) => e.groupId)
    );
    if (!gids.size) return;
    commit((s) => ({
      groups: s.groups.filter((g) => !gids.has(g.id)),
      entities: s.entities.map((e) => (gids.has(e.groupId) ? { ...e, groupId: null } : e)),
    }));
  },

  /* ---- frames ---- */
  addFrame: () => {
    const f = newFrame(`Keyframe ${state.frames.length + 1}`);
    commit((s) => ({
      frames: [...s.frames, f],
      currentFrameId: f.id,
      entities: s.entities.map((e) => {
        const cur = e.frames[s.currentFrameId] || { x: 0, y: 0, z: 0, rotation: 0 };
        return {
          ...e,
          frames: { ...e.frames, [f.id]: { ...cur } },
          frameIds: [...e.frameIds, f.id],
        };
      }),
    }));
    return f.id;
  },
  duplicateFrame: (id) => {
    const idx = state.frames.findIndex((f) => f.id === id);
    if (idx < 0) return;
    const f = newFrame(`${state.frames[idx].name} copy`);
    commit((s) => ({
      frames: [...s.frames.slice(0, idx + 1), f, ...s.frames.slice(idx + 1)],
      currentFrameId: f.id,
      entities: s.entities.map((e) => {
        const cur = e.frames[id];
        if (!cur) return e;
        return { ...e, frames: { ...e.frames, [f.id]: { ...cur } }, frameIds: [...e.frameIds, f.id] };
      }),
    }));
  },
  deleteFrame: (id) => {
    if (state.frames.length <= 1) return;
    commit((s) => {
      const frames = s.frames.filter((f) => f.id !== id);
      const entities = s.entities.map((e) => {
        const nf = { ...e.frames };
        delete nf[id];
        return { ...e, frames: nf, frameIds: e.frameIds.filter((x) => x !== id) };
      });
      const currentFrameId = s.currentFrameId === id ? frames[0].id : s.currentFrameId;
      return { frames, entities, currentFrameId };
    });
  },
  renameFrame: (id, name) =>
    commit((s) => ({ frames: s.frames.map((f) => (f.id === id ? { ...f, name } : f)) })),
  setCurrentFrame: (id) => store.set({ currentFrameId: id, sim: { ...state.sim, progress: 0 } }),
  reorderFrame: (id, dir) => {
    const idx = state.frames.findIndex((f) => f.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= state.frames.length) return;
    commit((s) => {
      const frames = [...s.frames];
      [frames[idx], frames[j]] = [frames[j], frames[idx]];
      return { frames };
    });
  },

  /* ---- simulation ---- */
  setEngine: (engine) => store.set({ sim: { ...state.sim, engine, playing: false, progress: 0 } }),
  setMission: (mission) => store.set({ sim: { ...state.sim, mission } }),
  setSpeed: (speed) => store.set({ sim: { ...state.sim, speed } }),
  setProgress: (progress) => store.set({ sim: { ...state.sim, progress } }),
  setPlaying: (playing) => store.set({ sim: { ...state.sim, playing } }),
  play: () => {
    // restart from beginning if we're parked on the last frame (keyframe mode)
    const s = state;
    if (s.sim.engine === 'keyframe') {
      const idx = s.frames.findIndex((f) => f.id === s.currentFrameId);
      const patch = idx >= s.frames.length - 1 ? { currentFrameId: s.frames[0].id } : {};
      store.set({ ...patch, sim: { ...s.sim, playing: true, progress: 0 } });
    } else {
      store.set({ sim: { ...s.sim, playing: true } });
    }
  },
  stop: () =>
    store.set({
      sim: { ...state.sim, playing: false, progress: 0 },
      currentFrameId: state.sim.engine === 'keyframe' ? state.frames[0].id : state.currentFrameId,
    }),

  /* ---- generic transaction (used by missions/pathing) ---- */
  apply: (recipe, { history = true } = {}) => (history ? commit(recipe) : mutate(recipe)),

  /* ---- history ---- */
  pushHistory,
  undo: () => {
    if (!state.history.past.length) return;
    const past = [...state.history.past];
    const prev = past.pop();
    const future = [docSnapshot(state), ...state.history.future];
    store.set({ ...prev, history: { past, future }, selectedIds: [] });
  },
  redo: () => {
    if (!state.history.future.length) return;
    const future = [...state.history.future];
    const next = future.shift();
    const past = [...state.history.past, docSnapshot(state)];
    store.set({ ...next, history: { past, future }, selectedIds: [] });
  },

  /* ---- io ---- */
  loadDocument: (doc) => {
    resetNameCounters(doc.entities || []);
    store.set({
      entities: doc.entities || [],
      frames: doc.frames?.length ? doc.frames : freshDoc().frames,
      currentFrameId: doc.currentFrameId || (doc.frames?.[0]?.id ?? freshDoc().currentFrameId),
      groups: doc.groups || [],
      selectedIds: [],
      history: { past: [], future: [] },
      sim: { ...state.sim, playing: false, progress: 0 },
    });
  },
  newDocument: () => {
    pushHistory();
    store.set({ ...freshDoc(), selectedIds: [], sim: { ...state.sim, playing: false, progress: 0 } });
  },

  /* ---- toasts ---- */
  toast: (message, kind = 'info') => {
    const id = uuid();
    store.set({ toasts: [...state.toasts, { id, message, kind }] });
    setTimeout(() => actions.dismissToast(id), 2600);
  },
  dismissToast: (id) => store.set({ toasts: state.toasts.filter((t) => t.id !== id) }),
};

function cloneEntity(e, dx, dy) {
  const frames = {};
  for (const [fid, t] of Object.entries(e.frames)) {
    frames[fid] = { ...t, x: t.x + dx, y: t.y + dy };
  }
  return {
    ...JSON.parse(JSON.stringify(e)),
    id: uuid(),
    name: `${e.name} copy`,
    frames,
    groupId: null,
    assignedTo: null,
    offset: null,
    assignedDrones: [],
    transport: false,
  };
}
