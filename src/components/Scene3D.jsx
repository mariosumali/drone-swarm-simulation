import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Sky } from '@react-three/drei';

// Export OrbitControls as a separate component so it can be controlled from SceneContent
export function CameraControls({ enabled = true }) {
    return (
        <OrbitControls
            enabled={enabled}
            enableDamping
            dampingFactor={0.05}
            minDistance={50}
            maxDistance={1500}
            maxPolarAngle={Math.PI / 2.1}
            target={[0, 0, 0]}
        />
    );
}

// Camera looking straight down from above - zoomed out for full view
export function Scene3D({ children, cameraPosition = [0, 1200, 0.1], controlsEnabled = true, gridSize = 20 }) {
    return (
        <Canvas
            camera={{
                position: cameraPosition,
                fov: 60,
                near: 1,
                far: 10000
            }}
            shadows
            style={{ background: '#0f172a' }}
        >
            {/* Lighting */}
            <ambientLight intensity={0.5} />
            <directionalLight
                position={[500, 1000, 500]}
                intensity={1}
                castShadow
                shadow-mapSize={[4096, 4096]}
                shadow-camera-far={10000}
                shadow-camera-left={-5000}
                shadow-camera-right={5000}
                shadow-camera-top={5000}
                shadow-camera-bottom={-5000}
            />
            <pointLight position={[-500, 500, -500]} intensity={0.3} />

            {/* Sky */}
            <Sky sunPosition={[500, 1000, 500]} />

            {/* Ground Grid */}
            <Grid
                args={[5000, 5000]}
                cellSize={gridSize}
                cellThickness={0.5}
                cellColor="#334155"
                sectionSize={gridSize * 5}
                sectionThickness={1}
                sectionColor="#475569"
                fadeDistance={5000}
                fadeStrength={1}
                followCamera={false}
                infiniteGrid
                position={[0, 0, 0]}
            />

            {/* Ground Plane (for shadows and raycasting) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
                <planeGeometry args={[10000, 10000]} />
                <meshStandardMaterial color="#1e293b" transparent opacity={0.8} />
            </mesh>

            {/* Camera Controls - enabled prop passed through */}
            <CameraControls enabled={controlsEnabled} />

            {/* Scene Content */}
            {children}
        </Canvas>
    );
}
