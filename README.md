# Drone Swarm Simulation

A multi-state drone swarm simulator for coordinated drone operations with formation control, 3D pathfinding, and obstacle avoidance.

**Created by Mario Sumali**

## Features

### Simulation Engine
- **Multi-State Management** - Create unlimited states with smooth interpolation
- **Real-time Playback** - Animate transitions with adjustable speed and easing
- **2D & 3D Views** - Interactive canvas with synchronized dual-view rendering

### Drone System
- **Ground Drones** - Perimeter formations around object boundaries
- **Air Drones** - Surface coverage using Voronoi-based placement
- **Formation Locking** - Drones maintain relative positions during object movement
- **Visual Indicators** - Altitude badges, flying glow effects, formation status

### Pathfinding
- **2D A\* Algorithm** - Grid-based obstacle avoidance for ground navigation
- **3D A\* Algorithm** - Volumetric pathfinding with rise-fly-descend patterns
- **No-Fly Zones** - Block entire airspace above obstacles
- **Auto Path Recalculation** - Paths update when objects or obstacles move

### Object System
- **Shape Types** - Rectangles, circles, custom polygons
- **Custom Drawing** - Free-draw polygons with resize/scale support
- **Obstacles** - Static objects that block drone paths
- **Position Locking** - Prevent accidental movement

## Technical Implementation

### 3D Rendering (Three.js + React Three Fiber)
Objects are rendered using extruded geometries from 2D paths. Custom shapes use `THREE.Shape` with `ExtrudeGeometry` for volumetric representation. The coordinate mapping converts 2D canvas (X,Y) to 3D space (X→X, Y→Z, altitude→Y).

### Formation Algorithms

**Ground Formations** - Drones distributed along object perimeter:
- Circle: Equal angular spacing
- Rectangle: Perimeter walking with uniform distribution
- Custom: Path sampling with edge-length weighting

**Air Formations** - Centroidal Voronoi Tessellation (CCVT):
1. Sample uniform points within object polygon
2. Initialize sites using farthest-point strategy
3. Balanced assignment with capacity constraints
4. Iterative centroid refinement for optimal coverage

### Pathfinding System

**2D Pathfinding** (`findPath`)
- A\* search with 8-directional neighbor expansion
- Collision detection for circles, rectangles, and custom polygons
- Path simplification via line-of-sight pruning

**3D Pathfinding** (`findPath3D`)
- 26-directional neighbor expansion (includes vertical movement)
- Height-aware collision: drones can fly over obstacles if altitude > obstacle height + margin
- No-fly zones block entire airspace regardless of altitude
- Fallback: rise-fly-descend trajectory if A\* exhausts iterations

### Path Interpolation
- Catmull-Rom spline smoothing for drawn paths
- 3D coordinate interpolation along path segments
- Easing functions: linear, quadratic, cubic

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`

## Controls

| Action | Control |
|--------|---------|
| Move objects | Left click + drag |
| Pan | Middle click / Space + drag |
| Zoom | Mouse wheel |
| Multi-select | Shift + click |
| Delete | Delete / Backspace |
| Undo/Redo | Ctrl+Z / Ctrl+Y |
| Copy/Paste | Ctrl+C / Ctrl+V |

## Usage

1. **Add Objects** - Drag shapes from sidebar onto canvas
2. **Add Drones** - Drag Air (✈️) or Ground (🚗) drones
3. **Create States** - Click "New State", reposition objects
4. **Generate Formations** - Select object → Enable Transport → Generate
5. **Set Obstacles** - Mark objects as obstacles, optionally enable No-Fly Zone
6. **Configure Paths** - Use "Auto" for pathfinding or "Draw" for custom routes
7. **Simulate** - Press Play to animate between states

## Object Options

- 🔒 **Lock Position** - Prevent movement
- 🚧 **Mark as Obstacle** - Static, blocks drone paths
- 🚫 **No-Fly Zone** - Block drone flyover at any altitude

## Architecture

```
src/
├── App.jsx                 # State management, simulation control
├── components/
│   ├── Playground.jsx      # 2D canvas with zoom/pan/selection
│   ├── Playground3D.jsx    # 3D scene with Three.js
│   ├── Object3D.jsx        # 3D shape rendering
│   ├── Drone3D.jsx         # 3D drone visualization
│   └── Sidebar.jsx         # Properties panel, entity list
└── utils/
    ├── formationCalculator.js  # CCVT, perimeter algorithms
    ├── pathfinding.js          # 2D & 3D A* implementation
    └── pathInterpolation.js    # Spline smoothing, 3D interpolation
```

## Tech Stack

- **React** - UI framework
- **Vite** - Build tool
- **Three.js / React Three Fiber** - 3D rendering
- **@react-three/drei** - 3D helpers and abstractions

## License

MIT License

---
**Mario Sumali** | 2025
