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

export function Scene3D({ children, cameraPosition = [0, 200, 300], controlsEnabled = true, gridSize = 20 }) {
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
            <ambientLight intensity={0.4} />
            <directionalLight
                position={[100, 200, 100]}
                intensity={1}
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-camera-far={1000}
                shadow-camera-left={-500}
                shadow-camera-right={500}
                shadow-camera-top={500}
                shadow-camera-bottom={-500}
            />
            <pointLight position={[-100, 100, -100]} intensity={0.3} />

            {/* Sky */}
            <Sky sunPosition={[100, 200, 100]} />

            {/* Ground Grid */}
            <Grid
                args={[1000, 1000]}
                cellSize={gridSize}
                cellThickness={0.5}
                cellColor="#334155"
                sectionSize={gridSize * 5}
                sectionThickness={1}
                sectionColor="#475569"
                fadeDistance={1500}
                fadeStrength={1}
                followCamera={false}
                infiniteGrid
                position={[0, 0, 0]}
            />

            {/* Ground Plane (for shadows and raycasting) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
                <planeGeometry args={[2000, 2000]} />
                <meshStandardMaterial color="#1e293b" transparent opacity={0.8} />
            </mesh>

            {/* Camera Controls - enabled prop passed through */}
            <CameraControls enabled={controlsEnabled} />

            {/* Scene Content */}
            {children}
        </Canvas>
    );
}
