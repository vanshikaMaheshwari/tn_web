'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import { getCard, getCardAiStatus, refreshCard, updateInterests, updatePrivacy } from '@/lib/api';
import { ErrorBox, Loading } from '@/components/ui/Brand';
import { useToast } from '@/components/ui/Toast';
import AiCard from '@/components/card/AiCard';

export default function ProfilePage() {
  const { ready } = useAuth('mentee');
  const toast = useToast();
  const [c, setC] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [tag, setTag] = useState('');
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try { setC(await getCard()); } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  // While a Render Workflows run is generating the card, poll its status every 3s
  // (up to ~4 min, covering Render's retries), then reload the card.
  const jobStatus = c?.aiJob?.status;
  const polls = useRef(0);
  useEffect(() => {
    if (!['pending', 'running'].includes(jobStatus)) { polls.current = 0; return undefined; }
    const t = setTimeout(async () => {
      polls.current += 1;
      try {
        const st = await getCardAiStatus();
        const s2 = st.job?.status;
        if (s2 === 'succeeded') {
          setC(await getCard());
          toast('Fresh insights from Gemini, generated on Render Workflows');
        } else if (s2 === 'failed' || s2 === 'canceled' || polls.current >= 80) {
          setC((x) => ({ ...x, aiJob: { ...(st.job || x.aiJob), status: s2 === 'failed' ? 'failed' : 'canceled' } }));
          toast('Gemini is busy right now, so the card is showing the rules-engine version. Try refresh later.', 'error');
        } else if (s2 && s2 !== jobStatus) {
          setC((x) => ({ ...x, aiJob: st.job }));
        } else {
          setC((x) => ({ ...x })); // re-arm the poll
        }
      } catch {
        setC((x) => ({ ...x }));
      }
    }, 3000);
    return () => clearTimeout(t);
  }, [c, jobStatus, toast]);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const r = await refreshCard();
      setC(r);
      if (r.cooldown) toast('Insights were refreshed a moment ago. Try again in a minute.');
      else if (['pending', 'running'].includes(r.aiJob?.status)) toast('Queued on Render Workflows. Your card updates in a few seconds.');
      else toast('Fresh insights generated');
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  }, [toast]);

  async function saveInterests(list) {
    try {
      await updateInterests(list);
      toast('Interests saved. Rebuilding your card…');
      await refresh();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function savePrivacy(patch) {
    const before = c.privacy;
    setC((x) => ({ ...x, privacy: { ...x.privacy, ...patch } }));
    try {
      const r = await updatePrivacy(patch);
      setC((x) => ({ ...x, privacy: r.privacy, openToOpportunities: !!r.privacy.recruiterVisible }));
    } catch (e) {
      setC((x) => ({ ...x, privacy: before }));
      toast(e.message, 'error');
    }
  }

  if (!ready) return null;
  if (error) return <main className="tn-wrap"><ErrorBox message={error} onRetry={load} /></main>;
  if (!c) {
    return (
      <main className="tn-wrap">
        <p className="tn-hand" style={{ fontSize: 26, color: 'var(--tn-blue-ink)' }}>Reading your journey and drawing your card…</p>
        <Loading rows={4} />
      </main>
    );
  }

  const interests = c.me.interests || [];
  const interestsSlot = (
    <div className="tn-stack" style={{ gap: 8 }}>
      <span className="tn-label">interests · shape your avatar, constellation and recommendations</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {interests.map((t) => (
          <span key={t} className="tn-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            #{t}
            {editing && <button aria-label={`Remove ${t}`} onClick={() => saveInterests(interests.filter((x) => x !== t))} style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700, color: 'var(--tn-muted)', minWidth: 24, minHeight: 24 }}>×</button>}
          </span>
        ))}
        {editing ? (
          <form onSubmit={(e) => { e.preventDefault(); if (tag.trim()) { saveInterests([...interests, tag.trim()]); setTag(''); } }} style={{ display: 'flex', gap: 6 }}>
            <label htmlFor="tag" className="sr-only">New interest</label>
            <input id="tag" className="tn-input mono" style={{ minHeight: 38, width: 160 }} placeholder="e.g. react" value={tag} onChange={(e) => setTag(e.target.value)} autoFocus />
            <button className="tn-btn sm">Add</button>
            <button type="button" className="tn-btn sm" onClick={() => setEditing(false)}>Done</button>
          </form>
        ) : (
          <button className="tn-tag" style={{ borderStyle: 'dashed', background: 'transparent', cursor: 'pointer', color: 'var(--tn-ink-2)' }} onClick={() => setEditing(true)}>+ edit</button>
        )}
      </div>
    </div>
  );

  return (
    <main className="tn-wrap" style={{ paddingTop: 16 }}>
      <AiCard c={c} mode="self" onRefresh={refresh} refreshing={busy} interestsSlot={interestsSlot} onPrivacy={savePrivacy} toast={toast} />
    </main>
  );
}
