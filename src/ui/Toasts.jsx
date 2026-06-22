/** Transient toast notifications. */
import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import { useStore } from '../app/store.js';

const ICON = { success: CheckCircle2, warning: AlertTriangle, danger: XCircle, info: Info };
const TONE = { success: 'var(--success)', warning: 'var(--warning)', danger: 'var(--danger)', info: 'var(--accent)' };

export default function Toasts() {
  const toasts = useStore((s) => s.toasts);
  if (!toasts.length) return null;
  return (
    <div className="toast-stack">
      {toasts.map((t) => {
        const Icon = ICON[t.kind] || Info;
        return (
          <div key={t.id} className="toast" data-kind={t.kind} style={{ pointerEvents: 'auto' }}>
            <Icon size={15} style={{ color: TONE[t.kind] }} />
            {t.message}
          </div>
        );
      })}
    </div>
  );
}
