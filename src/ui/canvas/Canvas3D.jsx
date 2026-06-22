/**
 * Canvas3D — a true 3D view of the SAME unified scene (re-enabled from the old
 * disabled "WIP" view). Maps world (x,y)+altitude(z) → three (x, y-up, z) and
 * reads the same transforms as the 2D canvas (live engine or keyframes).
 */
import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { useStore, actions } from '../../app/store.js';
import { displayTransforms } from '../../model/selectors.js';
import { renderPolygon } from '../../model/entities.js';
import { ARENA } from '../../app/constants.js';

const css = (v, fallback) => {
  if (typeof window === 'undefined') return fallback;
  const c = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  return c || fallback;
};

export default function Canvas3D({ liveTransforms, isLive }) {
  const entities = useStore((s) => s.entities);
  const selectedIds = useStore((s) => s.selectedIds);
  const theme = useStore((s) => s.theme);
  const state = useStore((s) => s);
  const transforms = isLive ? liveTransforms : displayTransforms(state);
  const sel = new Set(selectedIds);
  const dark = theme === 'dark';

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--canvas-bg)' }}>
      <Canvas
        shadows
        camera={{ position: [0, 1500, 2100], fov: 45, near: 1, far: 12000 }}
        onPointerMissed={() => actions.clearSelection()}
        dpr={[1, 1.8]}
      >
        <color attach="background" args={[dark ? '#08080d' : '#eef1f7']} />
        <ambientLight intensity={dark ? 0.5 : 0.8} />
        <directionalLight position={[800, 1600, 600]} intensity={1.1} castShadow shadow-mapSize={[2048, 2048]}>
          <orthographicCamera attach="shadow-camera" args={[-2000, 2000, 2000, -2000, 1, 6000]} />
        </directionalLight>
        <hemisphereLight intensity={0.3} groundColor={dark ? '#101018' : '#cfd6e4'} />

        <Grid
          position={[0, 0, 0]}
          args={[ARENA.maxX - ARENA.minX, ARENA.maxY - ARENA.minY]}
          cellSize={48}
          cellThickness={0.6}
          sectionSize={240}
          sectionThickness={1.1}
          cellColor={dark ? '#23233a' : '#c4cbe0'}
          sectionColor={dark ? '#34345a' : '#9aa6c6'}
          fadeDistance={5000}
          infiniteGrid
        />
        {/* ground shadow catcher */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.5, 0]}>
          <planeGeometry args={[8000, 8000]} />
          <shadowMaterial opacity={0.18} />
        </mesh>

        {entities.map((e) => {
          const t = transforms[e.id];
          if (!t) return null;
          return e.kind === 'drone' ? (
            <DroneMesh key={e.id} e={e} t={t} selected={sel.has(e.id)} />
          ) : (
            <ObjectMesh key={e.id} e={e} t={t} selected={sel.has(e.id)} />
          );
        })}
      </Canvas>
      <OrbitHint />
    </div>
  );
}

function OrbitHint() {
  return (
    <div className="canvas-hud" style={{ bottom: 'var(--space-3)', left: 'var(--space-3)', padding: '4px 10px' }}>
      <span className="hud-zoom" style={{ minWidth: 0 }}>Drag to orbit · scroll to zoom</span>
    </div>
  );
}

function ObjectMesh({ e, t, selected }) {
  const height = e.height || 40;
  const color = e.obstacle ? css('--color-obstacle', '#f87171') : e.transport ? css('--color-target', '#a78bfa') : '#6b7280';
  const geom = useMemo(() => {
    if (e.shape === 'circle') return new THREE.CylinderGeometry(e.radius || 50, e.radius || 50, height, 40);
    if (e.shape === 'polygon') {
      const pts = renderPolygon(e) || [];
      const shape = new THREE.Shape();
      pts.forEach((p, i) => (i ? shape.lineTo(p.x, p.y) : shape.moveTo(p.x, p.y)));
      shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      g.translate(0, 0, 0);
      return g;
    }
    return new THREE.BoxGeometry(e.w || 100, height, e.h || 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e.shape, e.radius, e.w, e.h, height, e.polygon]);

  const isExtrude = e.shape === 'polygon';
  return (
    <mesh
      geometry={geom}
      position={[t.x, isExtrude ? (t.z || 0) : height / 2 + (t.z || 0), t.y]}
      rotation={[0, (-(t.rotation || 0) * Math.PI) / 180, 0]}
      castShadow
      receiveShadow
      onClick={(ev) => {
        ev.stopPropagation();
        actions.selectOne(e.id);
      }}
    >
      <meshStandardMaterial
        color={color}
        metalness={0.1}
        roughness={0.65}
        transparent
        opacity={0.92}
        emissive={selected ? css('--accent', '#6366f1') : '#000000'}
        emissiveIntensity={selected ? 0.5 : 0}
      />
    </mesh>
  );
}

function DroneMesh({ e, t, selected }) {
  const color = e.droneType === 'air' ? css('--color-air', '#22d3ee') : css('--color-ground', '#f59e0b');
  const r = e.radius || 12;
  const y = (t.z || 0) + r + 2;
  return (
    <group
      position={[t.x, y, t.y]}
      rotation={[0, (-(t.rotation || 0) * Math.PI) / 180, 0]}
      onClick={(ev) => {
        ev.stopPropagation();
        actions.selectOne(e.id);
      }}
    >
      <mesh castShadow>
        {e.droneType === 'air' ? <sphereGeometry args={[r, 16, 16]} /> : <boxGeometry args={[r * 2, r, r * 2]} />}
        <meshStandardMaterial
          color={color}
          metalness={0.4}
          roughness={0.4}
          emissive={selected ? css('--accent', '#6366f1') : color}
          emissiveIntensity={selected ? 0.8 : 0.25}
        />
      </mesh>
      {/* heading pointer */}
      <mesh position={[r * 1.3, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[r * 0.4, r * 0.9, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
      </mesh>
      {/* altitude tether for flying drones */}
      {(t.z || 0) > 4 && (
        <mesh position={[0, -y / 2, 0]}>
          <cylinderGeometry args={[0.6, 0.6, y, 6]} />
          <meshBasicMaterial color={color} transparent opacity={0.18} />
        </mesh>
      )}
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -r, 0]}>
          <ringGeometry args={[r * 1.6, r * 2.1, 24]} />
          <meshBasicMaterial color={css('--accent', '#6366f1')} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
