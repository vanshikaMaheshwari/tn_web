'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { sendFeedback } from '@/lib/api';
import { Stars } from '@/components/events/EventBits';
import { useToast } from '@/components/ui/Toast';

// Site-wide "Feedback" tab (public pages + Launchpad + AI card). Answers land in the core-team Inbox.
export default function FeedbackTab() {
  const toast = useToast();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const dialog = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    dialog.current?.querySelector('button[role="radio"]')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  async function send(e) {
    e.preventDefault();
    if (!rating) { toast('Pick a rating first', 'error'); return; }
    setBusy(true);
    try {
      await sendFeedback({ source: 'site', rating, comment, page: pathname });
      toast('Thanks! The core team reads every message.');
      setOpen(false); setRating(0); setComment('');
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <>
      <button className="tn-feedback-tab" onClick={() => setOpen(true)} aria-haspopup="dialog">Feedback</button>
      {open && (
        <div className="tn-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <form ref={dialog} onSubmit={send} role="dialog" aria-modal="true" aria-labelledby="fb-title" className="tn-card" style={{ width: 'min(440px, 92vw)', display: 'flex', flexDirection: 'column', gap: 14, padding: 26 }}>
            <div className="tn-between"><h2 id="fb-title" style={{ fontSize: 26 }}>How’s TechNeeds?</h2><button type="button" className="tn-link-btn" onClick={() => setOpen(false)}>Close</button></div>
            <p className="tn-muted" style={{ fontSize: 14, margin: 0 }}>Tell us what to keep or fix on this page. It goes straight to the core team.</p>
            <Stars value={rating} onPick={setRating} size={30} />
            <label htmlFor="fb-c" className="sr-only">Your feedback</label>
            <textarea id="fb-c" className="tn-textarea" rows={4} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What should we improve?" />
            <button className="tn-btn primary" disabled={busy}>{busy ? 'Sending…' : 'Send feedback'}</button>
          </form>
        </div>
      )}
    </>
  );
}
