'use client';
import { useCallback, useEffect, useState } from 'react';

// Lightweight guided tour: highlights elements marked data-tour="<id>" one by one.
// steps: [{ id, title, text }]
export default function Tour({ steps, open, onClose }) {
  const [i, setI] = useState(0);
  const step = steps[i];

  const focusStep = useCallback((k) => {
    document.querySelectorAll('.tn-tour-target').forEach((el) => el.classList.remove('tn-tour-target'));
    const el = document.querySelector(`[data-tour="${steps[k]?.id}"]`);
    if (el) {
      el.classList.add('tn-tour-target');
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    }
  }, [steps]);

  useEffect(() => {
    if (!open) { document.querySelectorAll('.tn-tour-target').forEach((el) => el.classList.remove('tn-tour-target')); return undefined; }
    focusStep(i);
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((x) => Math.min(x + 1, steps.length - 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(x - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, i, focusStep, onClose, steps.length]);

  useEffect(() => { if (open) setI(0); }, [open]);
  if (!open || !step) return null;
  const last = i === steps.length - 1;
  return (
    <div className="tn-tour-pop" role="dialog" aria-live="polite" aria-label={`Tour step ${i + 1} of ${steps.length}`}>
      <div className="tn-between" style={{ gap: 8 }}>
        <span className="tn-mono" style={{ fontSize: 12, color: 'var(--tn-yellow)' }}>step {i + 1} / {steps.length}</span>
        <button className="tn-link-btn" style={{ color: '#cfe0ff' }} onClick={onClose}>Skip tour</button>
      </div>
      <b style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#fff' }}>{step.title}</b>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: '#cfe0ff' }}>{step.text}</p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {i > 0 && <button className="tn-btn sm ghost-light" onClick={() => setI(i - 1)}>Back</button>}
        <button className="tn-btn sm yellow" autoFocus onClick={() => (last ? onClose() : setI(i + 1))}>{last ? 'Done' : 'Next'}</button>
      </div>
    </div>
  );
}
