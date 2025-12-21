# Drone Swarm Simulation

A multi-state drone swarm simulation system for planning and visualizing coordinated drone operations, including object transport with formation control and custom path planning.

**Created by Mario Sumali**

## Features

### Core Simulation
- **Multi-State Management**: Create unlimited simulation states with smooth interpolation between them
- **Real-time Playback**: Animate between states with adjustable playback speed
- **Interactive Canvas**: Drag, drop, resize, and rotate objects with visual feedback

### Object Types
- **Rectangles**: Customizable dimensions and properties
- **Circles**: Adjustable radius
- **Custom Shapes**: Free-draw custom polygons
- **Obstacles**: Mark objects as static obstacles (cannot be transported)
- **Position Locking**: Lock objects to prevent accidental movement

### Drone System
- **Two Drone Types**:
  - 🚗 **Ground Drones**: Form perimeter formations around objects
  - ✈️ **Air Drones**: Cover surface area above objects
- **Formation Generation**: Automatic positioning based on object geometry
- **Formation Locking**: Lock drones to maintain relative positions during movement/rotation
- **Visual Indicators**: Distinct appearances for drone types and formation status

### Advanced Features
- **Custom Transition Paths**: Draw curved paths for objects to follow between states
  - Drag-to-draw interface
  - Snap-to-endpoints with visual guides
  - Catmull-Rom spline smoothing
- **Path Tracking**: Visualize object movement paths with color-coded dotted lines
- **Entity Management**: Hierarchical entity list with collapsible drone groups
- **Undo/Redo**: Full history support for all actions

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd drone-swarm-simulation

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will open at `http://localhost:5173`

## Usage Guide

### Basic Workflow

1. **Create Objects**
   - Drag shapes from the sidebar library onto the canvas
   - Adjust properties (size, position, rotation) in the properties panel
   - Use custom shape tool to draw free-form polygons

2. **Add Drones**
   - Drag Air Drones (✈️) or Ground Drones (🚗) from the library
   - Position drones manually or use formation generation

3. **Create Multiple States**
   - Click "New State" to add simulation states
   - Reposition objects in each state
   - Mark objects as active/inactive per state

4. **Generate Formations**
   - Select an object and enable "Transport Mode"
   - Click "🚗 Ground" or "✈️ Air" to generate formations
   - Formations automatically lock to maintain relative positions

5. **Draw Custom Paths**
   - Select an object with multiple states
   - In "Transition Paths", click "Draw Path"
   - Click near green start point and drag to draw
   - Release near red endpoint to auto-snap

6. **Run Simulation**
   - Press Play to animate between states
   - Adjust playback speed as needed
   - Watch drones follow formations and objects follow custom paths

### Controls

#### Canvas
- **Left Click + Drag**: Move selected objects
- **Middle Click / Space + Drag**: Pan viewport
- **Mouse Wheel**: Zoom in/out
- **Shift + Click**: Multi-select
- **Click + Drag** (background): Box selection

#### Keyboard Shortcuts
- `Delete/Backspace`: Delete selected items
- `Ctrl/Cmd + Z`: Undo
- `Ctrl/Cmd + Shift + Z`: Redo
- `Enter`: Finish drawing (custom shapes or paths)
- `Escape`: Cancel drawing

### Object Properties

#### Lock & Obstacle Settings
- **🔒 Lock Position**: Prevent object from being moved
- **🚧 Mark as Obstacle**: 
  - Object turns gray
  - Cannot be transported by drones
  - Useful for static environment objects

#### Transport Mode
Available for non-obstacle objects only:
- Enable to allow drone formations
- Generate ground or air formations
- Lock formations to maintain relative positions
- Unlock to release drones

#### Custom Paths
- Draw curved paths between states
- Objects follow paths during simulation
- Clear paths to return to linear interpolation
- Paths shown in path tracking visualization

### Tips & Best Practices

1. **Formation Planning**
   - Create at least 2 states before drawing paths
   - Position objects in final locations first
   - Generate formations in the initial state

2. **Path Drawing**
   - Must start drag from green circle (start point)
   - Must end near red circle (endpoint)
   - Draw smoothly for better interpolation
   - Press Esc to cancel and redraw

3. **Performance**
   - Use obstacles for static objects (no formation calculations)
   - Lock positions when layout is finalized
   - Limit active objects per state for complex simulations

4. **Visual Organization**
   - Use path tracking to verify movement routes
   - Entity list shows hierarchy (objects with their drones)
   - Icons indicate: 🔒 locked, 🚧 obstacle, formation status

## Architecture

### Key Components
- **App.jsx**: Main application state and coordination
- **Playground.jsx**: Interactive canvas with zoom/pan/selection
- **Sidebar.jsx**: Property editor and object library
- **EntityList.jsx**: Hierarchical entity management
- **SimulationObject.jsx**: Renderers for shapes
- **Drone.jsx**: Drone visualization (air/ground variants)

### Utilities
- **formationCalculator.js**: Ground and air formation algorithms
- **pathInterpolation.js**: Catmull-Rom spline path smoothing

## Technology Stack

- **React** - UI framework
- **Vite** - Build tool and dev server
- **Lucide React** - Icon library
- **UUID** - Unique identifiers

## License

MIT License

---

**Created by Mario Sumali** | 2024
