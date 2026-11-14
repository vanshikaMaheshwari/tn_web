'use client';
import { useCallback, useEffect, useState } from 'react';
import { formatDate, getAdminFeedback, getAdminQueries, updateQuery } from '@/lib/api';
import { Chip, Stars } from '@/components/events/EventBits';
import { ErrorBox, Loading } from '@/components/ui/Brand';
import Icon from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';

const ST_BG = { open: 'var(--tn-yellow)', answered: 'var(--tn-sky)', resolved: '#C9F5DF' };
const SRC_BG = { event: '#FFD8A8', mission: 'var(--tn-sky)', site: '#e8f0ff' };

export default function Inbox({ onCount }) {
  const [tab, setTab] = useState('queries');
  return (
    <div className="tn-stack" style={{ gap: 22 }}>
      <div className="tn-stack" style={{ gap: 6 }}>
        <span className="tn-eyebrow">core@techneeds:~$ inbox</span>
        <h1 style={{ fontSize: 'clamp(32px, 4vw, 44px)' }}>Inbox</h1>
        <span style={{ fontSize: 15, color: 'var(--tn-ink-2)' }}>Questions from the FAQ page and feedback from events, missions and the site’s Feedback tab. Only the core team sees this.</span>
      </div>
      <div role="tablist" aria-label="Inbox" style={{ display: 'flex', gap: 10 }}>
        {[['queries', 'Questions'], ['feedback', 'Feedback']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`tn-btn sm ${tab === k ? 'primary' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'queries' ? <Queries onCount={onCount} /> : <FeedbackList />}
    </div>
  );
}

function Queries({ onCount }) {
  const toast = useToast();
  const [filter, setFilter] = useState('open');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try { const d = await getAdminQueries(filter === 'all' ? '' : filter); setData(d); onCount?.(d.open); } catch (e) { setError(e.message); }
  }, [filter, onCount]);
  useEffect(() => { load(); }, [load]);

  async function save(q, patch, msg) {
    setBusy(q._id);
    try { await updateQuery(q._id, patch); toast(msg); setDrafts({ ...drafts, [q._id]: undefined }); load(); } catch (e) { toast(e.message, 'error'); } finally { setBusy(null); }
  }
  const mailto = (q, text) => `mailto:${q.email}?subject=${encodeURIComponent(`Re: your TechNeeds question (${q.ticket})`)}&body=${encodeURIComponent(`Hi ${q.name.split(' ')[0]},\n\n${text || ''}\n\n— TechNeeds core team`)}`;

  return (
    <div className="tn-stack" style={{ gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="tn-label">show</span>
        {['open', 'answered', 'resolved', 'all'].map((s) => <button key={s} className={`tn-btn sm ${filter === s ? 'dark' : ''}`} onClick={() => setFilter(s)}>{s}{s === 'open' && data ? ` (${data.open})` : ''}</button>)}
      </div>
      {error && <ErrorBox message={error} onRetry={load} />}
      {!data && !error && <Loading rows={3} />}
      {data?.items.length === 0 && <div className="tn-empty">{filter === 'open' ? 'No open questions. Inbox zero 🎉' : 'Nothing here.'}</div>}
      {data?.items.map((q) => {
        const draft = drafts[q._id] ?? q.reply ?? '';
        return (
          <article key={q._id} className="tn-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="tn-between" style={{ gap: 10, alignItems: 'flex-start' }}>
              <div className="tn-stack" style={{ gap: 2 }}>
                <b style={{ fontSize: 16 }}>{q.name} <span className="tn-muted" style={{ fontWeight: 400, fontSize: 13 }}>· {q.email}</span></b>
                <span className="tn-mono" style={{ fontSize: 12, color: 'var(--tn-muted)' }}>{q.ticket} · {q.topic} · {formatDate(q.createdAt)}</span>
              </div>
              <Chip bg={ST_BG[q.status]}>{q.status}</Chip>
            </div>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{q.message}</p>
            <label htmlFor={`rp-${q._id}`} className="tn-label">reply (shown when they track their ticket)</label>
            <textarea id={`rp-${q._id}`} className="tn-textarea" style={{ minHeight: 80 }} value={draft} onChange={(e) => setDrafts({ ...drafts, [q._id]: e.target.value })} placeholder="Write a short, friendly answer…" />
            {q.repliedBy && <span className="tn-muted" style={{ fontSize: 12 }}>Last replied by {q.repliedBy} · {formatDate(q.repliedAt)}</span>}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="tn-btn sm primary" disabled={busy === q._id || !draft.trim()} onClick={() => save(q, { reply: draft }, 'Reply saved')}>Save reply</button>
              <a className="tn-btn sm" href={mailto(q, draft)}><Icon name="message" size={16} /> Open in email</a>
              {q.status !== 'resolved'
                ? <button className="tn-btn sm" disabled={busy === q._id} onClick={() => save(q, { status: 'resolved' }, 'Marked resolved')}><Icon name="check" size={16} /> Resolve</button>
                : <button className="tn-btn sm" disabled={busy === q._id} onClick={() => save(q, { status: 'open' }, 'Re-opened')}>Re-open</button>}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function FeedbackList() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [src, setSrc] = useState('all');
  const load = useCallback(async () => { setError(''); try { setData(await getAdminFeedback()); } catch (e) { setError(e.message); } }, []);
  useEffect(() => { load(); }, [load]);
  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!data) return <Loading rows={3} />;
  const items = data.items.filter((f) => src === 'all' || f.source === src);
  return (
    <div className="tn-stack" style={{ gap: 14 }}>
      <div className="tn-row" style={{ gap: 14 }}>
        <div className="tn-card yellow" style={{ padding: '14px 18px' }}>
          <div className="tn-label" style={{ color: 'var(--tn-navy)' }}>LAST 30 DAYS</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span className="tn-big" style={{ fontSize: 36 }}>{data.month.avg ?? '—'}</span><Stars value={Math.round(data.month.avg || 0)} size={18} /></div>
          <span style={{ fontSize: 13 }}>{data.month.count} rating{data.month.count === 1 ? '' : 's'}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {['all', 'event', 'mission', 'site'].map((s) => <button key={s} className={`tn-btn sm ${src === s ? 'dark' : ''}`} onClick={() => setSrc(s)}>{s}</button>)}
        </div>
      </div>
      {items.length === 0 && <div className="tn-empty">No feedback yet.</div>}
      {items.map((f) => (
        <div key={f._id} className="tn-card" style={{ padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Chip bg={SRC_BG[f.source]}>{f.source}</Chip>
          <div className="tn-stack" style={{ gap: 4, flex: 1, minWidth: 200 }}>
            <b style={{ fontSize: 15 }}>{f.about}</b>
            {f.comment ? <span style={{ fontSize: 14, lineHeight: 1.5 }}>“{f.comment}”</span> : <span className="tn-muted" style={{ fontSize: 13 }}>No comment</span>}
            <span className="tn-muted" style={{ fontSize: 12 }}>{f.who} · {formatDate(f.createdAt)}</span>
          </div>
          <Stars value={f.rating} size={18} />
        </div>
      ))}
    </div>
  );
}
