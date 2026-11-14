'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';

// Small (i) button with a plain-language explanation.
export default function InfoTip({ label, children, light }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button type="button" aria-expanded={open} aria-controls={id} aria-label={`What is ${label}?`} onClick={() => setOpen((v) => !v)}
        style={{ background: 'none', border: 0, padding: 4, cursor: 'pointer', minWidth: 32, minHeight: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="info" size={18} color={open ? 'var(--tn-blue)' : light ? '#cfe0ff' : 'var(--tn-muted)'} />
      </button>
      {open && (
        <span id={id} role="note" className="tn-infotip">
          <b style={{ color: 'var(--tn-yellow)' }}>{label}</b> {children}
        </span>
      )}
    </span>
  );
}
