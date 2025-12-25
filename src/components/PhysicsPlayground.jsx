import React, { useRef, useState, useEffect } from 'react';
import { usePhysicsPlayground } from '../hooks/usePhysicsPlayground';
import { Square, Circle, Triangle, Hexagon, Star, Pentagon, Trash2, Plus, Pencil, Settings, ChevronDown, ChevronRight, X, Bot, Code2, Pause, Play } from 'lucide-react';

// Collapsible section component
function Section({ title, defaultOpen = true, children }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div style={{ borderBottom: '1px solid #2d2d3d' }}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: '0.5rem 0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    color: '#7aa2f7',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                }}
            >
                {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {title}
            </div>
            {isOpen && <div style={{ padding: '0 0.75rem 0.75rem' }}>{children}</div>}
        </div>
    );
}

// Slider with label
function SliderControl({ label, value, min, max, step = 0.01, onChange }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.65rem', color: '#a9b1d6' }}>{label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    style={{ width: '80px', accentColor: '#7aa2f7' }}
                />
                <span style={{ fontSize: '0.6rem', color: '#565f89', width: '40px', textAlign: 'right' }}>
                    {typeof value === 'number' ? value.toFixed(step < 0.01 ? 3 : 2) : value}
                </span>
            </div>
        </div>
    );
}

// Toggle switch
function ToggleControl({ label, value, onChange }) {
    return (
        <div
            onClick={() => onChange(!value)}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.3rem',
                cursor: 'pointer',
                padding: '0.2rem 0'
            }}
        >
            <span style={{ fontSize: '0.65rem', color: '#a9b1d6' }}>{label}</span>
            <div style={{
                width: '28px',
                height: '14px',
                borderRadius: '7px',
                background: value ? '#7aa2f7' : '#2d2d3d',
                position: 'relative',
                transition: 'background 0.2s'
            }}>
                <div style={{
                    position: 'absolute',
                    top: '2px',
                    left: value ? '14px' : '2px',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.2s'
                }} />
            </div>
        </div>
    );
}

export function PhysicsPlayground({ theme = 'dark' }) {
    const containerRef = useRef(null);
    const [contextMenu, setContextMenu] = useState(null);
    const [drawingMode, setDrawingMode] = useState(false);
    const [drawingPoints, setDrawingPoints] = useState([]);
    const [bodyProps, setBodyProps] = useState(null);
    const [showCodeEditor, setShowCodeEditor] = useState(false);
    const [editingCode, setEditingCode] = useState('');

    const {
        objects,
        drones,
        gravity,
        renderOptions,
        bodyDefaults,
        isRunning,
        isPaused,
        selectedBodyId,
        selectedBodyIds,
        showGrid,
        addObject,
        addDrone,
        addCustomObject,
        addRandomObjects,
        removeObject,
        clearObjects,
        updateGravity,
        resetGravity,
        setRenderOption,
        setBodyDefault,
        selectBody,
        toggleBodySelection,
        clearSelection,
        toggleGrid,
        togglePause,
        getBodyProperties,
        updateBodyProperty,
        updateDroneBehavior,
        getDroneInfo,
        BEHAVIOR_TEMPLATES
    } = usePhysicsPlayground(null, containerRef);

    // Update properties panel when selection changes
    useEffect(() => {
        if (selectedBodyId) {
            const props = getBodyProperties(selectedBodyId);
            setBodyProps(props);
        } else {
            setBodyProps(null);
        }
    }, [selectedBodyId, getBodyProperties]);

    // Refresh body properties periodically when selected
    useEffect(() => {
        if (!selectedBodyId) return;
        const interval = setInterval(() => {
            const props = getBodyProperties(selectedBodyId);
            setBodyProps(props);
        }, 100);
        return () => clearInterval(interval);
    }, [selectedBodyId, getBodyProperties]);

    const shapeButtons = [
        { type: 'rectangle', icon: Square, label: 'Rect' },
        { type: 'circle', icon: Circle, label: 'Circle' },
        { type: 'triangle', icon: Triangle, label: 'Tri' },
        { type: 'hexagon', icon: Hexagon, label: 'Hex' },
        { type: 'pentagon', icon: Pentagon, label: 'Pent' },
        { type: 'star', icon: Star, label: 'Star' }
    ];

    const handleContextMenu = (e) => {
        e.preventDefault();
        if (drawingMode) return;
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    const handleCanvasClick = (e) => {
        if (contextMenu) {
            setContextMenu(null);
            return;
        }

        if (drawingMode && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            setDrawingPoints(prev => [...prev, { x, y }]);
        }
    };

    const handleFinishDrawing = () => {
        if (drawingPoints.length >= 3) {
            addCustomObject(drawingPoints);
        }
        setDrawingPoints([]);
        setDrawingMode(false);
    };

    const handleCancelDrawing = () => {
        setDrawingPoints([]);
        setDrawingMode(false);
    };

    const handleAddFromMenu = (type) => {
        if (contextMenu) {
            addObject(type, contextMenu.x, contextMenu.y);
            setContextMenu(null);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const type = e.dataTransfer.getData('shapeType');
        if (!type || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        addObject(type, e.clientX - rect.left, e.clientY - rect.top);
    };

    const handlePropertyChange = (property, value) => {
        if (selectedBodyId) {
            updateBodyProperty(selectedBodyId, property, value);
        }
    };


    return (
        <div style={{ display: 'flex', height: '100%', width: '100%', background: '#1a1b26' }}>

            {/* Left Panel */}
            <div style={{
                width: '180px',
                borderRight: '1px solid #2d2d3d',
                background: '#16161e',
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto'
            }}>
                {/* Mode Indicator Header */}
                <div style={{
                    padding: '0.75rem',
                    background: 'linear-gradient(135deg, #22c55e20, #16a34a20)',
                    borderBottom: '1px solid #22c55e40',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <span style={{ fontSize: '1rem' }}>🎱</span>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: '#22c55e', fontWeight: 600 }}>Playground Mode</div>
                        <div style={{ fontSize: '0.6rem', color: '#565f89' }}>Physics Sandbox</div>
                    </div>
                </div>
                <div style={{ padding: '0.75rem', borderBottom: '1px solid #2d2d3d' }}>
                    <div style={{ fontSize: '0.7rem', color: '#7aa2f7', marginBottom: '0.5rem' }}>World</div>
                    <div style={{ fontSize: '0.65rem', color: '#565f89' }}>Bodies: {objects.length}</div>
                </div>

                {/* Shape buttons */}
                <Section title="Add Body">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.3rem' }}>
                        {shapeButtons.map(({ type, icon: Icon, label }) => (
                            <div
                                key={type}
                                draggable
                                onDragStart={(e) => e.dataTransfer.setData('shapeType', type)}
                                onClick={() => {
                                    if (containerRef.current) {
                                        const rect = containerRef.current.getBoundingClientRect();
                                        addObject(type, rect.width / 2, rect.height / 2);
                                    }
                                }}
                                style={{
                                    padding: '0.4rem',
                                    background: '#1a1b26',
                                    border: '1px solid #2d2d3d',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '0.2rem',
                                    fontSize: '0.55rem',
                                    color: '#a9b1d6'
                                }}
                            >
                                <Icon size={14} />
                                {label}
                            </div>
                        ))}
                    </div>

                    {/* Custom drawing button */}
                    <button
                        onClick={() => setDrawingMode(true)}
                        style={{
                            width: '100%',
                            marginTop: '0.5rem',
                            padding: '0.5rem',
                            background: drawingMode ? '#7aa2f7' : '#2d2d3d',
                            border: 'none',
                            borderRadius: '4px',
                            color: drawingMode ? '#fff' : '#a9b1d6',
                            fontSize: '0.65rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.3rem'
                        }}
                    >
                        <Pencil size={12} /> Draw Custom
                    </button>

                    {/* Add Drone button */}
                    <button
                        onClick={() => {
                            if (containerRef.current) {
                                const rect = containerRef.current.getBoundingClientRect();
                                addDrone(rect.width / 2, rect.height / 2);
                            }
                        }}
                        style={{
                            width: '100%',
                            marginTop: '0.3rem',
                            padding: '0.5rem',
                            background: 'linear-gradient(135deg, #00ff88, #00cc66)',
                            border: 'none',
                            borderRadius: '4px',
                            color: '#000',
                            fontSize: '0.65rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.3rem',
                            fontWeight: 600
                        }}
                    >
                        <Bot size={12} /> Add Drone
                    </button>

                    <button
                        onClick={() => addRandomObjects(5)}
                        style={{
                            width: '100%',
                            marginTop: '0.3rem',
                            padding: '0.4rem',
                            background: '#2d2d3d',
                            border: 'none',
                            borderRadius: '4px',
                            color: '#a9b1d6',
                            fontSize: '0.65rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.3rem'
                        }}
                    >
                        <Plus size={12} /> Add 5 Random
                    </button>
                    <button
                        onClick={clearObjects}
                        style={{
                            width: '100%',
                            marginTop: '0.3rem',
                            padding: '0.4rem',
                            background: 'transparent',
                            border: '1px solid #f7768e',
                            borderRadius: '4px',
                            color: '#f7768e',
                            fontSize: '0.65rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.3rem'
                        }}
                    >
                        <Trash2 size={12} /> Clear All
                    </button>
                </Section >

                {/* Gravity */}
                < Section title="Gravity" >
                    <SliderControl label="x" value={gravity.x} min={-1} max={1} step={0.1} onChange={(v) => updateGravity(v, gravity.y)} />
                    <SliderControl label="y" value={gravity.y} min={-1} max={1} step={0.1} onChange={(v) => updateGravity(gravity.x, v)} />
                    <button
                        onClick={resetGravity}
                        style={{
                            width: '100%',
                            marginTop: '0.3rem',
                            padding: '0.3rem',
                            background: '#2d2d3d',
                            border: 'none',
                            borderRadius: '4px',
                            color: '#a9b1d6',
                            fontSize: '0.6rem',
                            cursor: 'pointer'
                        }}
                    >
                        Reset (0, 0)
                    </button>
                </Section >

                {/* Entities List */}
                < Section title={`Entities (${objects.length})`} defaultOpen={true} >
                    {
                        objects.length === 0 ? (
                            <div style={{ fontSize: '0.6rem', color: '#565f89', textAlign: 'center', padding: '0.5rem' }}>
                                No entities yet
                            </div>
                        ) : (
                            <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                                {objects.map((obj, idx) => (
                                    <div
                                        key={obj.id}
                                        onClick={() => selectBody(obj.id)}
                                        style={{
                                            padding: '0.4rem 0.5rem',
                                            marginBottom: '0.2rem',
                                            background: selectedBodyId === obj.id ? '#3d3d5c' : '#1a1b26',
                                            border: selectedBodyId === obj.id ? '1px solid #ff0' : '1px solid #2d2d3d',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            fontSize: '0.6rem',
                                            color: selectedBodyId === obj.id ? '#ff0' : '#a9b1d6'
                                        }}
                                    >
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                            {obj.type === 'circle' && <Circle size={10} />}
                                            {obj.type === 'rectangle' && <Square size={10} />}
                                            {obj.type === 'triangle' && <Triangle size={10} />}
                                            {obj.type === 'hexagon' && <Hexagon size={10} />}
                                            {obj.type === 'pentagon' && <Pentagon size={10} />}
                                            {obj.type === 'star' && <Star size={10} />}
                                            {obj.type === 'custom' && <Pencil size={10} />}
                                            {obj.type.charAt(0).toUpperCase() + obj.type.slice(1)} {idx + 1}
                                        </span>
                                        <span style={{ color: '#565f89' }}>#{obj.id}</span>
                                    </div>
                                ))}
                            </div>
                        )
                    }
                </Section >

                {/* Render Options */}
                < Section title="Render" defaultOpen={false} >
                    <ToggleControl label="showGrid" value={showGrid} onChange={toggleGrid} />
                    <ToggleControl label="wireframes" value={renderOptions.wireframes} onChange={(v) => setRenderOption('wireframes', v)} />
                    <ToggleControl label="showBounds" value={renderOptions.showBounds} onChange={(v) => setRenderOption('showBounds', v)} />
                    <ToggleControl label="showVelocity" value={renderOptions.showVelocity} onChange={(v) => setRenderOption('showVelocity', v)} />
                    <ToggleControl label="showCollisions" value={renderOptions.showCollisions} onChange={(v) => setRenderOption('showCollisions', v)} />
                    <ToggleControl label="showAxes" value={renderOptions.showAxes} onChange={(v) => setRenderOption('showAxes', v)} />
                    <ToggleControl label="showAngleIndicator" value={renderOptions.showAngleIndicator} onChange={(v) => setRenderOption('showAngleIndicator', v)} />
                    <ToggleControl label="showIds" value={renderOptions.showIds} onChange={(v) => setRenderOption('showIds', v)} />
                </Section >
            </div >

            {/* Canvas Area */}
            < div
                ref={containerRef}
                onContextMenu={handleContextMenu}
                onClick={handleCanvasClick}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                style={{
                    flex: 1,
                    position: 'relative',
                    overflow: 'hidden',
                    cursor: drawingMode ? 'crosshair' : 'default'
                }}
            >
                {/* Status and Pause Button */}
                < div style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    zIndex: 20
                }}>
                    <div style={{
                        padding: '0.25rem 0.5rem',
                        background: 'rgba(0,0,0,0.5)',
                        borderRadius: '4px',
                        fontSize: '0.6rem',
                        color: isPaused ? '#f7a825' : (isRunning ? '#9ece6a' : '#f7768e'),
                        fontFamily: 'monospace'
                    }}>
                        {isPaused ? '⏸ Paused' : (isRunning ? '● Running' : '○ Stopped')}
                    </div>
                    <button
                        onClick={togglePause}
                        style={{
                            padding: '0.35rem 0.5rem',
                            background: isPaused ? '#9ece6a' : '#f7a825',
                            border: 'none',
                            borderRadius: '4px',
                            color: '#000',
                            fontSize: '0.6rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontWeight: 600
                        }}
                        title={isPaused ? 'Resume Simulation' : 'Pause Simulation'}
                    >
                        {isPaused ? <Play size={12} /> : <Pause size={12} />}
                        {isPaused ? 'Play' : 'Pause'}
                    </button>
                </div >

                {/* Grid Overlay */}
                {
                    showGrid && (
                        <svg
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                pointerEvents: 'none',
                                zIndex: 5
                            }}
                        >
                            <defs>
                                <pattern id="smallGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                                </pattern>
                                <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
                                    <rect width="100" height="100" fill="url(#smallGrid)" />
                                    <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                                </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#grid)" />
                        </svg>
                    )
                }

                {/* Drawing mode indicator */}
                {
                    drawingMode && (
                        <div style={{
                            position: 'absolute',
                            top: 8,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            padding: '0.5rem 1rem',
                            background: '#7aa2f7',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '0.7rem',
                            zIndex: 20,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem'
                        }}>
                            <span>Drawing Mode: Click to add points ({drawingPoints.length} points)</span>
                            <button onClick={handleFinishDrawing} style={{
                                padding: '0.25rem 0.5rem',
                                background: '#9ece6a',
                                border: 'none',
                                borderRadius: '4px',
                                color: '#fff',
                                fontSize: '0.6rem',
                                cursor: 'pointer'
                            }}>
                                Finish
                            </button>
                            <button onClick={handleCancelDrawing} style={{
                                padding: '0.25rem 0.5rem',
                                background: '#f7768e',
                                border: 'none',
                                borderRadius: '4px',
                                color: '#fff',
                                fontSize: '0.6rem',
                                cursor: 'pointer'
                            }}>
                                Cancel
                            </button>
                        </div>
                    )
                }

                {/* Drawing preview */}
                {
                    drawingMode && drawingPoints.length > 0 && (
                        <svg style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            pointerEvents: 'none',
                            zIndex: 15
                        }}>
                            <polyline
                                points={drawingPoints.map(p => `${p.x},${p.y}`).join(' ')}
                                fill="none"
                                stroke="#7aa2f7"
                                strokeWidth="2"
                                strokeDasharray="5,5"
                            />
                            {drawingPoints.map((p, i) => (
                                <circle key={i} cx={p.x} cy={p.y} r="5" fill="#7aa2f7" />
                            ))}
                        </svg>
                    )
                }

                {/* Context Menu */}
                {
                    contextMenu && (
                        <div style={{
                            position: 'absolute',
                            left: contextMenu.x,
                            top: contextMenu.y,
                            background: '#1a1b26',
                            border: '1px solid #2d2d3d',
                            borderRadius: '6px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                            zIndex: 100,
                            minWidth: '100px'
                        }}>
                            <div style={{ padding: '0.3rem 0.5rem', fontSize: '0.55rem', color: '#565f89', borderBottom: '1px solid #2d2d3d' }}>
                                ADD SHAPE
                            </div>
                            {shapeButtons.map(({ type, icon: Icon, label }) => (
                                <div
                                    key={type}
                                    onClick={() => handleAddFromMenu(type)}
                                    style={{
                                        padding: '0.4rem 0.5rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.4rem',
                                        cursor: 'pointer',
                                        fontSize: '0.7rem',
                                        color: '#a9b1d6'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#2d2d3d'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <Icon size={12} />
                                    {label}
                                </div>
                            ))}
                        </div>
                    )
                }
            </div >

            {/* Right Panel - Properties */}
            < div style={{
                width: '200px',
                borderLeft: '1px solid #2d2d3d',
                background: '#16161e',
                overflowY: 'auto'
            }}>
                <Section title="⚙ Properties" defaultOpen={true}>
                    {bodyProps ? (
                        <div>
                            <div style={{ fontSize: '0.6rem', color: '#565f89', marginBottom: '0.5rem' }}>
                                ID: {bodyProps.id} | Mass: {bodyProps.mass?.toFixed(2)}
                            </div>

                            <ToggleControl
                                label="isStatic"
                                value={bodyProps.isStatic}
                                onChange={(v) => handlePropertyChange('isStatic', v)}
                            />

                            <SliderControl
                                label="density"
                                value={bodyProps.density || 0.001}
                                min={0.0001}
                                max={0.01}
                                step={0.0001}
                                onChange={(v) => handlePropertyChange('density', v)}
                            />

                            <SliderControl
                                label="friction"
                                value={bodyProps.friction || 0}
                                min={0}
                                max={1}
                                step={0.01}
                                onChange={(v) => handlePropertyChange('friction', v)}
                            />

                            <SliderControl
                                label="frictionAir"
                                value={bodyProps.frictionAir || 0}
                                min={0}
                                max={0.1}
                                step={0.001}
                                onChange={(v) => handlePropertyChange('frictionAir', v)}
                            />

                            <SliderControl
                                label="restitution"
                                value={bodyProps.restitution || 0}
                                min={0}
                                max={1}
                                step={0.01}
                                onChange={(v) => handlePropertyChange('restitution', v)}
                            />

                            <div style={{ marginTop: '0.5rem', borderTop: '1px solid #2d2d3d', paddingTop: '0.5rem' }}>
                                <div style={{ fontSize: '0.6rem', color: '#565f89', marginBottom: '0.3rem' }}>Position</div>
                                <div style={{ fontSize: '0.6rem', color: '#a9b1d6' }}>
                                    x: {bodyProps.position?.x?.toFixed(1)} | y: {bodyProps.position?.y?.toFixed(1)}
                                </div>
                            </div>

                            <div style={{ marginTop: '0.5rem' }}>
                                <div style={{ fontSize: '0.6rem', color: '#565f89', marginBottom: '0.3rem' }}>Velocity</div>
                                <div style={{ fontSize: '0.6rem', color: '#a9b1d6' }}>
                                    x: {bodyProps.velocity?.x?.toFixed(2)} | y: {bodyProps.velocity?.y?.toFixed(2)}
                                </div>
                            </div>

                            <div style={{ marginTop: '0.5rem' }}>
                                <div style={{ fontSize: '0.6rem', color: '#565f89', marginBottom: '0.3rem' }}>Rotation</div>
                                <div style={{ fontSize: '0.6rem', color: '#a9b1d6' }}>
                                    {((bodyProps.angle || 0) * 180 / Math.PI).toFixed(1)}°
                                </div>
                            </div>

                            {/* Drone Behavior Editor */}
                            {(() => {
                                const droneInfo = getDroneInfo(selectedBodyId);
                                if (!droneInfo) return null;
                                return (
                                    <div style={{ marginTop: '0.75rem', borderTop: '1px solid #2d2d3d', paddingTop: '0.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.3rem' }}>
                                            <Bot size={12} style={{ color: '#00ff88' }} />
                                            <span style={{ fontSize: '0.6rem', color: '#00ff88', fontWeight: 600 }}>Drone Behavior</span>
                                        </div>

                                        {/* Template Selector */}
                                        <select
                                            onChange={(e) => {
                                                const template = BEHAVIOR_TEMPLATES[e.target.value];
                                                if (template) {
                                                    updateDroneBehavior(selectedBodyId, template);
                                                    setEditingCode(template);
                                                }
                                            }}
                                            style={{
                                                width: '100%',
                                                padding: '0.3rem',
                                                marginBottom: '0.3rem',
                                                background: '#1a1b26',
                                                border: '1px solid #2d2d3d',
                                                borderRadius: '4px',
                                                color: '#a9b1d6',
                                                fontSize: '0.6rem'
                                            }}
                                        >
                                            <option value="">-- Select Template --</option>
                                            <option value="wander">🔀 Wander</option>
                                            <option value="seekNearest">🎯 Seek Nearest</option>
                                            <option value="avoidAll">↩️ Avoid All</option>
                                            <option value="followMouse">🖱️ Follow Mouse</option>
                                            <option value="swarm">🐝 Swarm</option>
                                        </select>

                                        {/* Code Editor */}
                                        <textarea
                                            value={editingCode || droneInfo.behaviorCode}
                                            onChange={(e) => setEditingCode(e.target.value)}
                                            onBlur={() => {
                                                if (editingCode) {
                                                    updateDroneBehavior(selectedBodyId, editingCode);
                                                }
                                            }}
                                            style={{
                                                width: '100%',
                                                height: '120px',
                                                padding: '0.4rem',
                                                background: '#0d0d14',
                                                border: '1px solid #2d2d3d',
                                                borderRadius: '4px',
                                                color: '#9ece6a',
                                                fontSize: '0.55rem',
                                                fontFamily: 'monospace',
                                                resize: 'vertical',
                                                lineHeight: 1.4
                                            }}
                                            placeholder="// Write behavior code here..."
                                        />

                                        <div style={{ fontSize: '0.5rem', color: '#565f89', marginTop: '0.3rem' }}>
                                            API: this.position, this.velocity, this.nearbyBodies, this.allDrones, this.applyForce(x,y)
                                        </div>
                                    </div>
                                );
                            })()}

                            <button
                                onClick={() => {
                                    removeObject(selectedBodyId);
                                    selectBody(null);
                                }}
                                style={{
                                    width: '100%',
                                    marginTop: '0.75rem',
                                    padding: '0.4rem',
                                    background: 'transparent',
                                    border: '1px solid #f7768e',
                                    borderRadius: '4px',
                                    color: '#f7768e',
                                    fontSize: '0.65rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.3rem'
                                }}
                            >
                                <Trash2 size={12} /> Delete Object
                            </button>
                        </div>
                    ) : (
                        <div style={{
                            padding: '1rem',
                            textAlign: 'center',
                            fontSize: '0.65rem',
                            color: '#565f89',
                            border: '1px dashed #2d2d3d',
                            borderRadius: '6px'
                        }}>
                            Select an item on the playground to edit its properties
                        </div>
                    )}
                </Section>

                {/* Body Defaults */}
                <Section title="Add Body Defaults" defaultOpen={false}>
                    <SliderControl label="size" value={bodyDefaults.size} min={10} max={80} step={1} onChange={(v) => setBodyDefault('size', v)} />
                    <SliderControl label="density" value={bodyDefaults.density} min={0.0001} max={0.01} step={0.0001} onChange={(v) => setBodyDefault('density', v)} />
                    <SliderControl label="friction" value={bodyDefaults.friction} min={0} max={1} step={0.01} onChange={(v) => setBodyDefault('friction', v)} />
                    <SliderControl label="restitution" value={bodyDefaults.restitution} min={0} max={1} step={0.01} onChange={(v) => setBodyDefault('restitution', v)} />
                    <ToggleControl label="isStatic" value={bodyDefaults.isStatic} onChange={(v) => setBodyDefault('isStatic', v)} />
                </Section>
            </div >
        </div >
    );
}
