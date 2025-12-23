import React, { useState, useMemo } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

export function Object3D({
    data,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
    currentStateId,
    selected = false,
    onClick,
    onPointerDown,
    showLabels = true
}) {
    const [hovered, setHovered] = useState(false);

    const { type, w = 100, h = 100, radius = 50, height = 20, customPath, isObstacle } = data;

    // Get scale from current state if available, fallback to first state or prop
    const objectScale = currentStateId
        ? (data.statePositions?.[currentStateId]?.scale || scale)
        : (data.statePositions?.[Object.keys(data.statePositions || {})[0]]?.scale || scale);

    // Colors
    const baseColor = isObstacle ? '#ef4444' : '#10b981';
    const emissiveColor = selected ? '#ffffff' : (hovered ? baseColor : '#000000');
    const emissiveIntensity = selected ? 0.2 : (hovered ? 0.1 : 0);

    // Custom shape geometry - center around origin and apply w/h scaling
    const customShape = useMemo(() => {
        if (type === 'custom' && customPath && customPath.length > 2) {
            // Calculate original bounding box
            const xs = customPath.map(p => p.x);
            const ys = customPath.map(p => p.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            const origW = maxX - minX || 1;
            const origH = maxY - minY || 1;
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;

            // Calculate scale factors (same as 2D SimulationObject)
            const currentW = w || origW;
            const currentH = h || origH;
            const scaleX = currentW / origW;
            const scaleY = currentH / origH;

            const shape = new THREE.Shape();
            // Center and scale the shape
            const scaledX0 = (customPath[0].x - centerX) * scaleX;
            const scaledY0 = -(customPath[0].y - centerY) * scaleY;
            shape.moveTo(scaledX0, scaledY0);
            for (let i = 1; i < customPath.length; i++) {
                const scaledX = (customPath[i].x - centerX) * scaleX;
                const scaledY = -(customPath[i].y - centerY) * scaleY;
                shape.lineTo(scaledX, scaledY);
            }
            shape.closePath();
            return shape;
        }
        return null;
    }, [type, customPath, w, h]);

    const renderShape = () => {
        switch (type) {
            case 'circle':
                return (
                    <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
                        <cylinderGeometry args={[radius, radius, height, 32]} />
                        <meshStandardMaterial
                            color={baseColor}
                            emissive={emissiveColor}
                            emissiveIntensity={emissiveIntensity}
                            metalness={0.3}
                            roughness={0.7}
                            transparent
                            opacity={0.9}
                        />
                    </mesh>
                );

            case 'rectangle':
                return (
                    <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
                        <boxGeometry args={[w, height, h]} />
                        <meshStandardMaterial
                            color={baseColor}
                            emissive={emissiveColor}
                            emissiveIntensity={emissiveIntensity}
                            metalness={0.3}
                            roughness={0.7}
                            transparent
                            opacity={0.9}
                        />
                    </mesh>
                );

            case 'custom':
                if (customShape) {
                    return (
                        <mesh castShadow receiveShadow position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                            <extrudeGeometry args={[customShape, { depth: height, bevelEnabled: false }]} />
                            <meshStandardMaterial
                                color={baseColor}
                                emissive={emissiveColor}
                                emissiveIntensity={emissiveIntensity}
                                metalness={0.3}
                                roughness={0.7}
                                transparent
                                opacity={0.9}
                            />
                        </mesh>
                    );
                }
                // Fallback for custom without valid path
                return (
                    <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
                        <boxGeometry args={[w || 100, height, h || 100]} />
                        <meshStandardMaterial
                            color={baseColor}
                            emissive={emissiveColor}
                            emissiveIntensity={emissiveIntensity}
                            metalness={0.3}
                            roughness={0.7}
                            transparent
                            opacity={0.9}
                        />
                    </mesh>
                );

            default:
                return (
                    <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
                        <boxGeometry args={[50, height, 50]} />
                        <meshStandardMaterial color={baseColor} />
                    </mesh>
                );
        }
    };

    return (
        <group
            position={position}
            rotation={rotation}
            scale={[objectScale, objectScale, objectScale]}
            onClick={onClick}
            onPointerDown={onPointerDown}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
        >
            {renderShape()}

            {/* Selection outline */}
            {selected && (
                <mesh position={[0, 1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[
                        Math.max(w, h, radius * 2) / 2 + 5,
                        Math.max(w, h, radius * 2) / 2 + 10,
                        32
                    ]} />
                    <meshBasicMaterial color="#22c55e" transparent opacity={0.8} />
                </mesh>
            )}

            {/* Label */}
            {showLabels && data.customName && (
                <Text
                    position={[0, height + 15, 0]}
                    fontSize={12}
                    color="white"
                    anchorX="center"
                    anchorY="middle"
                >
                    {data.customName}
                </Text>
            )}

            {/* Obstacle indicator */}
            {isObstacle && (
                <Text
                    position={[0, height + 5, 0]}
                    fontSize={8}
                    color="#fca5a5"
                    anchorX="center"
                    anchorY="middle"
                >
                    ⚠ OBSTACLE
                </Text>
            )}
        </group>
    );
}
