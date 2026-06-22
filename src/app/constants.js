/** Shared app constants: arena bounds, library catalog, mission + easing lists. */
import { Plane, Car, Square, Circle, Triangle, Hexagon, Pentagon, Star } from 'lucide-react';

export const ARENA = { minX: -1400, minY: -900, maxX: 1400, maxY: 900 };

export const DRONE_LIBRARY = [
  { type: 'air', label: 'Air', icon: Plane, variant: 'air', desc: 'Aerial drone — flies, 3D coverage' },
  { type: 'ground', label: 'Ground', icon: Car, variant: 'ground', desc: 'Ground rover — perimeter work' },
];

export const SHAPE_LIBRARY = [
  { type: 'rectangle', label: 'Box', icon: Square },
  { type: 'circle', label: 'Circle', icon: Circle },
  { type: 'triangle', label: 'Triangle', icon: Triangle },
  { type: 'pentagon', label: 'Pentagon', icon: Pentagon },
  { type: 'hexagon', label: 'Hexagon', icon: Hexagon },
  { type: 'star', label: 'Star', icon: Star },
];

export const MISSIONS = [
  { value: 'idle', label: 'Hold', desc: 'Drones hover and hold position.' },
  { value: 'flock', label: 'Flock', desc: 'Boids — local separation, alignment, cohesion.' },
  { value: 'seek', label: 'Seek', desc: 'Converge on the focused object, spacing out.' },
  { value: 'disperse', label: 'Disperse', desc: 'Spread out for maximum coverage.' },
  { value: 'formation', label: 'Formation', desc: 'Surround the focused object (air = area, ground = perimeter).' },
  { value: 'caging', label: 'Caging', desc: 'Tight encircling ring around the object.' },
  { value: 'transport', label: 'Transport', desc: 'Cage the object and carry it to its final keyframe.' },
];

export const EASINGS = [
  { value: 'linear', label: 'Linear' },
  { value: 'easeInQuad', label: 'Ease In' },
  { value: 'easeOutQuad', label: 'Ease Out' },
  { value: 'easeInOutQuad', label: 'Smooth' },
  { value: 'easeInOutCubic', label: 'Smoother' },
  { value: 'easeOutBack', label: 'Overshoot' },
];
