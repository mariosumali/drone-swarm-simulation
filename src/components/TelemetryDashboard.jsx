import React, { useState, useRef, useEffect } from 'react';
import { Zap, AlertTriangle, ArrowUp, GripHorizontal, Box, Gauge, Mountain } from 'lucide-react';

export function TelemetryDashboard({
    items,
    currentStateId,
    isSimulating,
    collisions = []
}) {
    // Draggable state
    const [position, setPosition] = useState({ x: null, y: 20 });
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef(null);
    const offsetRef = useRef({ x: 0, y: 0 });

    // Filter active entities
    const activeDrones = items.filter(i =>
        i.type === 'drone' &&
        i.activeStates?.includes(currentStateId)
    );

    const activeObjects = items.filter(i =>
        i.type !== 'drone' &&
        i.activeStates?.includes(currentStateId)
    );

    // Calculate metrics
    const totalDrones = activeDrones.length;
    const totalObjects = activeObjects.length;

    // Air vs Ground drones
    const airDrones = activeDrones.filter(d => d.droneType !== 'ground').length;
    const groundDrones = activeDrones.filter(d => d.droneType === 'ground').length;

    // Altitude metrics (only for air drones)
    const airDronesList = activeDrones.filter(d => d.droneType !== 'ground');
    const avgAltitude = airDronesList.length > 0
        ? (airDronesList.reduce((sum, d) => sum + (d.statePositions?.[currentStateId]?.z || 0), 0) / airDronesList.length).toFixed(0)
        : 0;

    const maxAltitude = airDronesList.length > 0
        ? Math.max(...airDronesList.map(d => d.statePositions?.[currentStateId]?.z || 0))
        : 0;

    // Collision count (from path intersections in the scene)
    const collisionCount = collisions.length;

    const swarmActivity = isSimulating ? "Active" : "Idle";

    // Drag handlers
    const handleMouseDown = (e) => {
        if (dragRef.current) {
            const rect = dragRef.current.getBoundingClientRect();
            offsetRef.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            setIsDragging(true);
        }
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isDragging) {
                setPosition({
                    x: e.clientX - offsetRef.current.x,
                    y: e.clientY - offsetRef.current.y
                });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    const statBoxStyle = {
        background: 'rgba(255,255,255,0.05)',
        padding: '8px',
        borderRadius: '8px'
    };

    const labelStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginBottom: '4px',
        color: '#94a3b8',
        fontSize: '10px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
    };

    const valueStyle = {
        fontSize: '18px',
        fontWeight: 700
    };

    return (
        <div
            ref={dragRef}
            style={{
                position: 'absolute',
                top: `${position.y}px`,
                ...(position.x !== null ? { left: `${position.x}px` } : { right: '20px' }),
                width: '280px',
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                backdropFilter: 'blur(8px)',
                borderRadius: '12px',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                zIndex: 1000,
                color: 'white',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                cursor: isDragging ? 'grabbing' : 'default',
                userSelect: 'none'
            }}
        >
            {/* Drag Handle Header */}
            <div
                onMouseDown={handleMouseDown}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'grab',
                    padding: '2px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    paddingBottom: '8px',
                    marginBottom: '4px'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <GripHorizontal size={14} style={{ color: '#64748b' }} />
                    <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: '#e2e8f0' }}>Telemetry</h3>
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}>
                    <span style={{ fontSize: '10px', color: isSimulating ? '#4ade80' : '#fbbf24' }}>{swarmActivity}</span>
                    <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: isSimulating ? '#22c55e' : '#fbbf24',
                        boxShadow: isSimulating ? '0 0 8px #22c55e' : 'none'
                    }} />
                </div>
            </div>

            {/* Grid of stats - 3 columns */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>

                {/* Air Drones */}
                <div style={statBoxStyle}>
                    <div style={labelStyle}>
                        <Zap size={10} />
                        <span>Air</span>
                    </div>
                    <div style={{ ...valueStyle, color: '#60a5fa' }}>{airDrones}</div>
                </div>

                {/* Ground Drones */}
                <div style={statBoxStyle}>
                    <div style={labelStyle}>
                        <Gauge size={10} />
                        <span>Ground</span>
                    </div>
                    <div style={{ ...valueStyle, color: '#a78bfa' }}>{groundDrones}</div>
                </div>

                {/* Objects */}
                <div style={statBoxStyle}>
                    <div style={labelStyle}>
                        <Box size={10} />
                        <span>Objects</span>
                    </div>
                    <div style={valueStyle}>{totalObjects}</div>
                </div>
            </div>

            {/* Altitude Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {/* Avg Altitude */}
                <div style={statBoxStyle}>
                    <div style={labelStyle}>
                        <ArrowUp size={10} />
                        <span>Avg Alt</span>
                    </div>
                    <div style={valueStyle}>{avgAltitude}<span style={{ fontSize: '12px', color: '#94a3b8' }}>m</span></div>
                </div>

                {/* Max Altitude */}
                <div style={statBoxStyle}>
                    <div style={labelStyle}>
                        <Mountain size={10} />
                        <span>Max Alt</span>
                    </div>
                    <div style={valueStyle}>{maxAltitude}<span style={{ fontSize: '12px', color: '#94a3b8' }}>m</span></div>
                </div>
            </div>

            {/* Collision Warning Banner */}
            {collisionCount > 0 && (
                <div style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.5)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <AlertTriangle size={16} color="#ef4444" />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#fca5a5' }}>
                            {collisionCount} Collision{collisionCount > 1 ? 's' : ''} Detected
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
