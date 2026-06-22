# Swarm Studio

A unified drone-swarm simulator. One scene, two ways to drive it:

- **Keyframe choreography** — pose objects and drones across keyframes and play smooth, eased, obstacle-aware transitions.
- **Live decentralized swarm** — a real-time Matter.js physics world where each drone is an autonomous agent that *senses* its neighbours, *talks* over a range-limited comm mesh, and acts on local rules. Flocking, seeking, formation, caging and transport all emerge from those local behaviours.

Everything runs on a **single entity model** and renders in both **2D** and **3D**.

**Created by Mario Sumali.**

```bash
npm install
npm run dev      # http://localhost:5173
```

---

## Highlights

- **One model, two engines.** Keyframe interpolation and live physics operate on the same entities — set up a formation, then either script it with keyframes or let the swarm run it live.
- **Decentralized agents (for real).** Each drone has perception (proximity + raycast via `SensorSystem`), communication (`MessageBus`, range-limited broadcast/direct), and PID motor control (`DroneAgent`). The engine assigns a mission behaviour and steps perceive → communicate → control → physics every tick.
- **Missions:** Hold · Flock (boids) · Seek · Disperse · Formation · Caging · Transport.
- **Formations:** perimeter (circle/rect/polygon) for ground drones, area-covering CCVT (centroidal Voronoi) for air drones.
- **Pathfinding:** binary-heap A\* (2D) with line-of-sight smoothing, and a layered 3D planner with rise-fly-descend + no-fly zones.
- **Polished UI/UX:** a real token-based design system, light + dark themes, dense telemetry HUD, scene tree, inspector, drag-and-drop library, keyframe timeline with scrubber, marquee select, grouping, undo/redo, copy/paste, save/load, screen recording, and a full keyboard map.
- **3D view** of the same scene (orbit/zoom), drones at altitude with comm tethers.

---

## Architecture

```
src/
├── main.jsx                  # entry
├── styles/                   # design system
│   ├── tokens.css            #   color/space/type/shadow tokens (light + dark)
│   ├── base.css              #   reset + base elements
│   └── ui.css                #   reusable component classes
├── app/                      # application layer
│   ├── store.js              #   single external store (undo/redo, autosave)
│   ├── useSimulation.js      #   keyframe RAF + live engine driver
│   ├── missions.js           #   formation / pathing orchestration
│   └── constants.js          #   arena, library catalog, mission list
├── model/                    # the unified data model
│   ├── entities.js           #   entity factory, obstacle/shape conversion
│   └── selectors.js          #   derived reads (transform-at-time, obstacles)
├── sim/                      # simulation core (framework-free, unit-tested)
│   ├── geometry.js           #   shared geometric primitives
│   ├── pathfinding.js        #   A* 2D + layered 3D            (+ .test.js)
│   ├── formations.js         #   perimeter + CCVT formations   (+ .test.js)
│   ├── interpolation.js      #   easing, path traversal, splines
│   ├── physics.js            #   Matter.js world wrapper
│   ├── behaviors.js          #   mission behaviours (boids, seek, slot-hold…)
│   ├── engine.js             #   SwarmEngine orchestrator
│   └── agents/               #   DroneAgent · MessageBus · SensorSystem
└── ui/                       # React components (all on the design system)
    ├── App.jsx · Toolbar · LibraryPanel · Inspector · Timeline · Telemetry …
    └── canvas/Canvas2D.jsx · Canvas3D.jsx
```

### Coordinate model
World space is `+x` right, `+y` down, `+z` up (altitude). Matter.js is planar; altitude is tracked kinematically by the engine. The 3D view maps world `(x, y)` + altitude `z` → three.js `(x, y-up, z)`.

---

## Usage

1. **Drag** objects and drones from the left **Build** panel onto the canvas (or click a tile).
2. Select an object → **Form up** / **Cage** to surround it with available drones.
3. **Keyframe mode:** add keyframes, reposition things, press **Play**. Use **Auto-route** / **Draw** in the inspector for obstacle-aware paths.
4. **Live swarm mode:** choose a **Mission** and press **Run** — drones sense, talk and move on their own. Watch the comm mesh and telemetry update live.
5. Toggle **2D / 3D** and **light / dark** any time.

### Keyboard

| Action | Key |
| --- | --- |
| Select / Polygon tool | `V` / `P` |
| Pan / Zoom | `Space`+drag / Scroll |
| Add to selection | `Shift`+click |
| Select all · Copy/Paste · Duplicate | `⌘/Ctrl`+`A` · `C`/`V` · `D` |
| Group / Ungroup | `⌘/Ctrl`+`G` / `⌘/Ctrl`+`Shift`+`G` |
| Undo / Redo | `⌘/Ctrl`+`Z` / `⌘/Ctrl`+`Shift`+`Z` |
| Delete · Deselect/Cancel | `Delete` / `Esc` |
| Play / Pause · Help | `Space` · `?` |

---

## Scripts

```bash
npm run dev          # dev server
npm run build        # production build (vendor-split chunks)
npm run preview      # preview the build
npm test             # run the unit test suite (vitest)
npm run lint         # eslint
```

## Tech stack

React 19 · Vite · Three.js / React Three Fiber · Matter.js · Vitest · lucide-react.

## License

MIT — Mario Sumali, 2025–2026.
