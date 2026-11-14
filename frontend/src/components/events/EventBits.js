'use client';
import { useState } from 'react';
import Icon from '@/components/ui/Icon';
import { sendEventFeedback } from '@/lib/api';

export const TYPE_BG = {
  hackathon: '#FFE45C', workshop: '#BFE9FF', talk: '#FFD1DC', bootcamp: '#BFE9FF', contest: '#C9F5DF',
  'cohort-launch': '#E6DEFF', orientation: '#E6DEFF', pitch: '#C9F5DF', challenge: '#FFD1DC', other: '#FFFFFF',
};
export const TYPE_LABEL = (t) => String(t || 'other').replace('-', ' ');

export function Chip({ children, bg = '#e8f0ff', color = 'var(--tn-navy)' }) {
  return <span className="tn-mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, background: bg, color, border: '2px solid var(--tn-navy)', borderRadius: 8, padding: '2px 8px', whiteSpace: 'nowrap' }}>{children}</span>;
}

const fmt = (d, o) => new Date(d).toLocaleDateString('en-IN', o);
export function eventWhen(e) {
  if (e.dateLabel) return e.dateLabel;
  const s = new Date(e.startsAt);
  if (!e.endsAt) return fmt(s, { day: 'numeric', month: 'short', year: 'numeric' });
  const en = new Date(e.endsAt);
  const same = s.toDateString() === en.toDateString();
  return same
    ? `${fmt(s, { day: 'numeric', month: 'short', year: 'numeric' })} · ${s.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`
    : `${fmt(s, { day: 'numeric', month: 'short' })} – ${fmt(en, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

// Google Calendar "add event" link (no account data involved).
export function calendarUrl(e) {
  const z = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const end = e.endsAt || new Date(new Date(e.startsAt).getTime() + 2 * 3600 * 1000);
  const p = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${z(e.startsAt)}/${z(end)}`, details: e.description || '', location: e.venue || '' });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function RegisterButton({ e, big }) {
  if (e.status === 'past') return null;
  if (!e.registerUrl) return <span className="tn-btn sm" style={{ cursor: 'default', opacity: 0.8 }}>Registrations open soon</span>;
  if (!e.registrationOpen) return <span className="tn-btn sm" style={{ cursor: 'default', opacity: 0.8 }}>Registrations closed</span>;
  return (
    <a href={e.registerUrl} target="_blank" rel="noopener noreferrer" className={`tn-btn ${big ? 'yellow' : 'primary'}`} style={big ? { minHeight: 58, fontSize: 17, boxShadow: '4px 4px 0 #fff' } : { flex: 1 }}>
      Register{big ? ' now' : ''} <Icon name="external" size={16} color={big ? 'var(--tn-navy)' : '#fff'} />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export function Stars({ value, onPick, size = 24 }) {
  return (
    <div role={onPick ? 'radiogroup' : 'img'} aria-label={onPick ? 'Rating' : `${value} out of 5`} style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        onPick ? (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => onPick(n)}
            style={{ background: 'none', border: 0, padding: 2, cursor: 'pointer', minWidth: 32, minHeight: 32 }}>
            <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill={n <= value ? '#FFE45C' : 'none'} stroke="#0b2a5b" strokeWidth="1.8" strokeLinejoin="round" /></svg>
          </button>
        ) : (
          <svg key={n} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill={n <= value ? '#FFE45C' : 'none'} stroke="#0b2a5b" strokeWidth="1.8" strokeLinejoin="round" /></svg>
        )
      ))}
    </div>
  );
}

export function RateEvent({ e, toast }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  if (sent) return <span className="tn-mono" style={{ fontSize: 13, color: 'var(--tn-green)' }}>✓ thanks for the feedback!</span>;
  if (!open) return <button className="tn-link-btn" style={{ color: 'var(--tn-navy)', display: 'inline-flex', gap: 6, alignItems: 'center' }} onClick={() => setOpen(true)}><Icon name="star" size={16} /> Rate this event</button>;
  async function send(ev) {
    ev.preventDefault();
    if (!rating) { toast('Pick a rating first', 'error'); return; }
    setBusy(true);
    try { await sendEventFeedback(e._id, { rating, comment }); setSent(true); }
    catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={send} style={{ borderTop: '2px dashed var(--tn-grid)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      <span style={{ fontWeight: 700, fontSize: 14 }}>Were you there? Rate it</span>
      <Stars value={rating} onPick={setRating} />
      <label htmlFor={`fb-${e._id}`} className="sr-only">Comment</label>
      <input id={`fb-${e._id}`} className="tn-input" style={{ minHeight: 42 }} maxLength={500} value={comment} onChange={(x) => setComment(x.target.value)} placeholder="What should we do again next time?" />
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="tn-btn sm dark" disabled={busy}>{busy ? 'Sending…' : 'Send feedback'}</button>
        <button type="button" className="tn-btn sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

export function PastCard({ e, toast, compact }) {
  const [shown, setShown] = useState(false);
  return (
    <article className="tn-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {e.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={e.imageUrl} alt={`${e.title} poster`} loading="lazy" style={{ width: '100%', height: compact ? 160 : 210, objectFit: 'cover', objectPosition: 'center 30%', borderBottom: 'var(--border)', display: 'block' }} />
      )}
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Chip bg={TYPE_BG[e.type]}>{TYPE_LABEL(e.type)}</Chip><Chip bg="#fff">{eventWhen(e)}</Chip></div>
        <h3 style={{ fontSize: 20, lineHeight: 1.15 }}>{e.title}</h3>
        {e.description && <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--tn-ink-2)', margin: 0 }}>{e.description}</p>}
        {e.highlight && <span className="tn-mono" style={{ fontSize: 12, color: 'var(--tn-blue-ink)', fontWeight: 700 }}>{e.highlight}</span>}
        {e.rating && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}><Stars value={Math.round(e.rating.avg)} size={16} /> {e.rating.avg} · {e.rating.count} rating{e.rating.count > 1 ? 's' : ''}</span>}
        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 4 }}>
          {(e.gallery?.length || e.recapUrl) ? (
            e.recapUrl
              ? <a href={e.recapUrl} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, fontSize: 14 }}>Photos &amp; recap →</a>
              : <button className="tn-link-btn" onClick={() => setShown((v) => !v)} aria-expanded={shown}>{shown ? 'Hide photos' : `Photos (${e.gallery.length})`}</button>
          ) : <span />}
          {toast && <RateEvent e={e} toast={toast} />}
        </div>
        {shown && e.gallery?.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 6 }}>
            {e.gallery.map((g) => (
              // eslint-disable-next-line @next/next/no-img-element
              <a key={g} href={g} target="_blank" rel="noopener noreferrer"><img src={g} alt={`${e.title} photo`} loading="lazy" style={{ width: '100%', height: 110, objectFit: 'cover', border: '2px solid var(--tn-navy)', borderRadius: 8, display: 'block' }} /></a>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export function UpcomingCard({ e }) {
  return (
    <article className="tn-card" style={{ padding: 0, overflow: 'hidden', display: 'grid', gridTemplateColumns: e.imageUrl ? 'minmax(140px, 220px) minmax(0, 1fr)' : '1fr' }}>
      {e.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={e.imageUrl} alt={`${e.title} poster`} loading="lazy" style={{ width: '100%', height: '100%', minHeight: 220, objectFit: 'cover', objectPosition: 'top', borderRight: 'var(--border)', display: 'block' }} />
      )}
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Chip bg={TYPE_BG[e.type]}>{TYPE_LABEL(e.type)}</Chip><Chip bg="#fff">{e.mode}</Chip></div>
        <h3 style={{ fontSize: 24, lineHeight: 1.1 }}>{e.title}</h3>
        {e.description && <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--tn-ink-2)', margin: 0 }}>{e.description}</p>}
        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 14, color: 'var(--tn-muted)' }}><Icon name="calendar" size={16} color="var(--tn-muted)" /> {eventWhen(e)}</span>
        {e.venue && <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 14, color: 'var(--tn-muted)' }}><Icon name="pin" size={16} color="var(--tn-muted)" /> {e.venue}</span>}
        {e.registrationClosesAt && e.registrationOpen && <span style={{ fontSize: 14, fontWeight: 700, color: '#B4232C' }}>Registrations close {new Date(e.registrationClosesAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
        <div style={{ display: 'flex', gap: 10, marginTop: 'auto', flexWrap: 'wrap' }}>
          <RegisterButton e={e} />
          <a href={calendarUrl(e)} target="_blank" rel="noopener noreferrer" className="tn-btn sm" aria-label={`Add ${e.title} to Google Calendar`}><Icon name="calendar" size={16} /></a>
        </div>
      </div>
    </article>
  );
}

export function FeaturedEvent({ e }) {
  return (
    <section style={{ background: 'var(--tn-navy)', border: 'var(--border)', borderRadius: 26, boxShadow: '7px 7px 0 var(--tn-blue)', overflow: 'hidden', color: '#fff' }}>
      {e.imageUrl && (
        <div style={{ position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={e.imageUrl} alt={`${e.title} banner`} style={{ width: '100%', maxHeight: 340, objectFit: 'cover', display: 'block', borderBottom: 'var(--border)' }} />
          {e.status === 'live' && <span className="tn-mono" style={{ position: 'absolute', left: 20, top: 18, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, background: '#E5383B', color: '#fff', border: '2px solid #fff', borderRadius: 8, padding: '4px 12px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />LIVE NOW</span>}
        </div>
      )}
      <div className="tn-navy" style={{ border: 0, borderRadius: 0, boxShadow: 'none', padding: '26px 30px', display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: '1 1 420px', minWidth: 0 }}>
          {e.tracks?.length > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{e.tracks.map((t) => <span key={t} className="tn-mono" style={{ fontSize: 13, fontWeight: 700, background: 'rgba(255,255,255,.12)', border: '2px solid rgba(255,255,255,.5)', borderRadius: 8, padding: '4px 10px' }}>{t}</span>)}</div>}
          <h2 style={{ fontSize: 'clamp(30px, 4vw, 42px)', color: '#fff' }}>{e.title}</h2>
          {e.description && <p style={{ margin: 0, fontSize: 17, lineHeight: 1.6, color: '#cfe0ff', maxWidth: 680 }}>{e.description}</p>}
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 15, color: '#cfe0ff' }}>
            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Icon name="calendar" size={18} color="#8ec5ff" /> {eventWhen(e)}</span>
            {e.venue && <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Icon name="pin" size={18} color="#8ec5ff" /> {e.venue}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 220 }}>
          <RegisterButton e={e} big />
          <a href={calendarUrl(e)} target="_blank" rel="noopener noreferrer" className="tn-btn ghost-light"><Icon name="calendar" size={18} color="#fff" /> Add to calendar</a>
        </div>
      </div>
    </section>
  );
}
