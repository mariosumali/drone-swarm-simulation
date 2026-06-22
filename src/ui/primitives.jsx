/**
 * primitives.jsx — small, reusable UI building blocks built on the design
 * system (styles/ui.css). Components here own no app logic; they just render
 * tokens-driven markup. Import these everywhere instead of writing inline styles.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/* ------------------------------------------------------------------ Button */
export function Button({
  variant = 'default',
  size,
  active,
  block,
  icon: Icon,
  children,
  className = '',
  ...rest
}) {
  const cls = [
    'btn',
    variant !== 'default' && `btn--${variant}`,
    size && `btn--${size}`,
    block && 'btn--block',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={cls} data-active={active ? 'true' : undefined} {...rest}>
      {Icon && <Icon size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  );
}

/* -------------------------------------------------------------- IconButton */
export function IconButton({ icon: Icon, size, active, danger, label, className = '', ...rest }) {
  const cls = [
    'icon-btn',
    size && `icon-btn--${size}`,
    danger && 'icon-btn--danger',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <Tooltip label={label}>
      <button
        className={cls}
        data-active={active ? 'true' : undefined}
        aria-label={label}
        {...rest}
      >
        <Icon size={size === 'sm' ? 15 : 17} />
      </button>
    </Tooltip>
  );
}

/* ------------------------------------------------------------------ Switch */
export function Switch({ checked, onChange, disabled, label, id }) {
  const toggle = () => !disabled && onChange?.(!checked);
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="switch"
      data-on={checked ? 'true' : 'false'}
      onClick={toggle}
      disabled={disabled}
      type="button"
    />
  );
}

/* --------------------------------------------------------------- ToggleRow */
export function ToggleRow({ label, checked, onChange, disabled, hint }) {
  return (
    <div className="field-row">
      <span className="field-row__label" title={hint}>{label}</span>
      <Switch checked={checked} onChange={onChange} disabled={disabled} label={label} />
    </div>
  );
}

/* -------------------------------------------------------------- Segmented */
export function Segmented({ value, onChange, options }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((opt) => (
        <button
          key={opt.value}
          role="tab"
          type="button"
          className="segmented__item"
          data-active={value === opt.value ? 'true' : 'false'}
          aria-selected={value === opt.value}
          onClick={() => !opt.disabled && onChange(opt.value)}
          disabled={opt.disabled}
          title={opt.title || opt.label}
        >
          {opt.icon && <opt.icon size={14} />}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- NumberField */
export function NumberField({ label, value, onChange, step = 1, min, max, suffix, disabled }) {
  return (
    <label className="field">
      {label && <span className="field__label">{label}</span>}
      <div className="input-affix">
        <input
          className="input input--mono"
          type="number"
          value={Number.isFinite(value) ? Math.round(value * 100) / 100 : ''}
          step={step}
          min={min}
          max={max}
          disabled={disabled}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            onChange(Number.isFinite(v) ? v : 0);
          }}
        />
        {suffix && <span className="input-affix__key" style={{ paddingRight: 8 }}>{suffix}</span>}
      </div>
    </label>
  );
}

/* ------------------------------------------------------------------ Slider */
export function Slider({ label, value, onChange, min = 0, max = 1, step = 0.01, format }) {
  return (
    <label className="field">
      {label && (
        <span className="field__label" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{label}</span>
          <span className="mono faint">{format ? format(value) : value}</span>
        </span>
      )}
      <input
        className="range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

/* ------------------------------------------------------------------- Badge */
export function Badge({ tone, children, icon: Icon }) {
  return (
    <span className={`badge${tone ? ` badge--${tone}` : ''}`}>
      {Icon && <Icon size={11} />}
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------- Tooltip */
export function Tooltip({ label, children, side = 'bottom' }) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const ref = useRef(null);
  if (!label) return children;

  const onEnter = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords({ x: r.left + r.width / 2, y: side === 'top' ? r.top - 8 : r.bottom + 8 });
    setShow(true);
  };
  const onLeave = () => setShow(false);

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onMouseDown={onLeave}
        style={{ display: 'inline-flex' }}
      >
        {children}
      </span>
      {show &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: coords.x,
              top: coords.y,
              transform: `translate(-50%, ${side === 'top' ? '-100%' : '0'})`,
              padding: '4px 8px',
              background: 'var(--surface-3)',
              color: 'var(--text)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--text-2xs)',
              fontWeight: 500,
              boxShadow: 'var(--shadow-md)',
              pointerEvents: 'none',
              zIndex: 1000,
              whiteSpace: 'nowrap',
              animation: 'ss-fade-in 120ms ease',
            }}
          >
            {label}
          </div>,
          document.body
        )}
    </>
  );
}

/* ------------------------------------------------------------------- Modal */
export function Modal({ title, onClose, children, footer, width }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="modal-scrim" onMouseDown={onClose}>
      <div
        className="modal"
        style={width ? { width } : undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <h2 className="modal__title">{title}</h2>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

/* -------------------------------------------------------------- useMenu */
/** Hook that closes a popover when clicking outside or pressing Escape. */
export function useDismiss(open, onClose) {
  const ref = useRef(null);
  const stable = useCallback(onClose, [onClose]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) stable();
    };
    const onKey = (e) => e.key === 'Escape' && stable();
    // defer so the opening click doesn't immediately close it
    const t = setTimeout(() => {
      window.addEventListener('mousedown', onDown);
      window.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, stable]);
  return ref;
}

/* ------------------------------------------------------------- EmptyState */
export function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="empty">
      {Icon && <Icon className="empty__icon" size={28} />}
      <div className="empty__title">{title}</div>
      {hint && <div className="empty__hint">{hint}</div>}
    </div>
  );
}

/* ----------------------------------------------------------------- Section */
export function Section({ title, count, defaultOpen = true, right, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="section">
      <button
        type="button"
        className="section__head"
        data-open={open ? 'true' : 'false'}
        onClick={() => setOpen((o) => !o)}
      >
        <Chevron className="chevron" />
        {title}
        {right}
        {count != null && <span className="section__count">{count}</span>}
      </button>
      {open && <div className="col">{children}</div>}
    </div>
  );
}

function Chevron({ className }) {
  return (
    <svg className={className} width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M2 3l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
