import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';

export function Drone3D({
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    selected = false,
    droneType = 'air',
    isInFormation = false,
    onClick,
    onPointerDown
}) {
    const meshRef = useRef();
    const [hovered, setHovered] = useState(false);

    // Rotor animation for air drones
    const rotorRef1 = useRef();
    const rotorRef2 = useRef();
    const rotorRef3 = useRef();
    const rotorRef4 = useRef();

    useFrame((state, delta) => {
        if (droneType === 'air') {
            // Spin rotors
            [rotorRef1, rotorRef2, rotorRef3, rotorRef4].forEach(ref => {
                if (ref.current) {
                    ref.current.rotation.y += delta * 30;
                }
            });

            // Subtle hover animation
            if (meshRef.current) {
                meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 3) * 2;
            }
        }
    });

    const baseColor = droneType === 'ground' ? '#8b5cf6' : '#60a5fa';
    const emissiveColor = selected ? '#ffffff' : (hovered ? baseColor : '#000000');
    const emissiveIntensity = selected ? 0.3 : (hovered ? 0.2 : 0);

    if (droneType === 'ground') {
        // Ground drone - wheeled robot style
        return (
            <group
                position={position}
                rotation={rotation}
                onClick={onClick}
                onPointerDown={onPointerDown}
                onPointerOver={() => setHovered(true)}
                onPointerOut={() => setHovered(false)}
            >
                {/* Body */}
                <mesh castShadow receiveShadow position={[0, 8, 0]}>
                    <boxGeometry args={[20, 10, 30]} />
                    <meshStandardMaterial
                        color={baseColor}
                        emissive={emissiveColor}
                        emissiveIntensity={emissiveIntensity}
                        metalness={0.6}
                        roughness={0.3}
                    />
                </mesh>

                {/* Wheels */}
                {[[-12, 5, 10], [12, 5, 10], [-12, 5, -10], [12, 5, -10]].map((pos, i) => (
                    <mesh key={i} position={pos} rotation={[0, 0, Math.PI / 2]} castShadow>
                        <cylinderGeometry args={[5, 5, 4, 16]} />
                        <meshStandardMaterial color="#1f2937" metalness={0.8} roughness={0.2} />
                    </mesh>
                ))}

                {/* Selection ring */}
                {selected && (
                    <mesh position={[0, 1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                        <ringGeometry args={[22, 25, 32]} />
                        <meshBasicMaterial color="#22c55e" transparent opacity={0.8} />
                    </mesh>
                )}
            </group>
        );
    }

    // Air drone - quadcopter style
    return (
        <group
            ref={meshRef}
            position={position}
            rotation={rotation}
            onClick={onClick}
            onPointerDown={onPointerDown}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
        >
            {/* Central body */}
            <mesh castShadow receiveShadow>
                <sphereGeometry args={[8, 16, 16]} />
                <meshStandardMaterial
                    color={baseColor}
                    emissive={emissiveColor}
                    emissiveIntensity={emissiveIntensity}
                    metalness={0.7}
                    roughness={0.2}
                />
            </mesh>

            {/* Arms */}
            {[0, 90, 180, 270].map((angle, i) => {
                const rad = (angle * Math.PI) / 180;
                const armLength = 18;
                return (
                    <group key={i} rotation={[0, rad, 0]}>
                        {/* Arm */}
                        <mesh position={[armLength / 2, 0, 0]} castShadow>
                            <boxGeometry args={[armLength, 2, 3]} />
                            <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.5} />
                        </mesh>

                        {/* Motor housing */}
                        <mesh position={[armLength, 0, 0]} castShadow>
                            <cylinderGeometry args={[4, 4, 5, 12]} />
                            <meshStandardMaterial color="#1f2937" metalness={0.8} roughness={0.2} />
                        </mesh>

                        {/* Rotor */}
                        <mesh
                            ref={i === 0 ? rotorRef1 : i === 1 ? rotorRef2 : i === 2 ? rotorRef3 : rotorRef4}
                            position={[armLength, 3, 0]}
                        >
                            <boxGeometry args={[2, 0.5, 14]} />
                            <meshStandardMaterial color="#94a3b8" transparent opacity={0.7} />
                        </mesh>
                    </group>
                );
            })}

            {/* Selection ring */}
            {selected && (
                <mesh position={[0, -5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[28, 32, 32]} />
                    <meshBasicMaterial color="#22c55e" transparent opacity={0.8} />
                </mesh>
            )}

            {/* Formation indicator */}
            {isInFormation && (
                <mesh position={[0, 12, 0]}>
                    <sphereGeometry args={[3, 8, 8]} />
                    <meshBasicMaterial color="#f59e0b" />
                </mesh>
            )}
        </group>
    );
}
