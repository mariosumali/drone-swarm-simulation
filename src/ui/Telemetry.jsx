/** Telemetry HUD — live swarm metrics overlay (bottom-right of the canvas). */
import React from 'react';
import { Activity, Plane, Car, Box, Wifi, MessageSquare, TriangleAlert, ArrowUpFromLine, X } from 'lucide-react';
import { useStore, actions } from '../app/store.js';

export default function Telemetry({ telemetry, isLive, liveTransforms }) {
  const entities = useStore((s) => s.entities);
  const sim = useStore((s) => s.sim);
  const fid = useStore((s) => s.currentFrameId);

  const drones = entities.filter((e) => e.kind === 'drone');
  const air = drones.filter((d) => d.droneType === 'air').length;
  const ground = drones.length - air;
  const objects = entities.filter((e) => e.kind === 'object').length;

  const alts = drones
    .map((d) => (isLive ? liveTransforms?.[d.id]?.z : d.frames[fid]?.z) || 0)
    .filter((z) => z > 0);
  const avgAlt = alts.length ? Math.round(alts.reduce((a, b) => a + b, 0) / alts.length) : 0;

  const status = sim.playing ? (isLive ? 'live' : 'paused') : 'idle';
  const statusLabel = sim.playing ? (isLive ? 'Swarm live' : 'Playing') : 'Idle';

  return (
    <div className="telemetry ss-anim-pop">
      <div className="telemetry__head">
        <Activity size={12} />
        Telemetry
        <span className="spacer" />
        <span className={`dot dot--${status === 'live' ? 'live' : status === 'paused' ? 'paused' : 'idle'}`} />
        <span style={{ fontWeight: 500, textTransform: 'none' }}>{statusLabel}</span>
        <button className="icon-btn icon-btn--sm" onClick={() => actions.toggleUI('telemetry')} title="Hide telemetry">
          <X size={13} />
        </button>
      </div>

      <div className="stat-grid">
        <Stat icon={Plane} label="Air" value={air} color="var(--color-air)" />
        <Stat icon={Car} label="Ground" value={ground} color="var(--color-ground)" />
        <Stat icon={Box} label="Objects" value={objects} />
        <Stat icon={ArrowUpFromLine} label="Avg alt" value={`${avgAlt}m`} />
      </div>

      {isLive && telemetry && (
        <div className="stat-grid">
          <Stat icon={Wifi} label="Links" value={telemetry.links.length} color="var(--info)" />
          <Stat icon={MessageSquare} label="Msgs/s" value={telemetry.messages} color="var(--accent)" />
          <Stat
            icon={TriangleAlert}
            label="Contacts"
            value={telemetry.collisions}
            color={telemetry.collisions ? 'var(--warning)' : undefined}
          />
          <Stat icon={Wifi} label="Comm" value={`${telemetry.commRange}`} />
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, color }) {
  return (
    <div className="stat">
      <span className="stat__label">
        <Icon size={11} style={color ? { color } : undefined} /> {label}
      </span>
      <span className="stat__value" style={color ? { color } : undefined}>{value}</span>
    </div>
  );
}
