'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  assignMentor, createMentor, createProgram, getAdminStats, getAiRun, refreshAllAiCards, getAllMentors, getAllPrograms, initials, removeMentor,
  setAnnouncement, setCoreTeam,
} from '@/lib/api';
import { ErrorBox, Loading } from '@/components/ui/Brand';
import Icon from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';

// Core-team Command deck (shown inside Mission Control for mentors with the admin permission).
export default function CommandDeck({ me }) {
  const ready = true;
  const toast = useToast();
  const [note, setNote] = useState('');
  const [stats, setStats] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [error, setError] = useState('');
  const [prog, setProg] = useState({ name: '', description: '' });
  const [ment, setMent] = useState({ name: '', email: '' });
  const [pick, setPick] = useState({});
  const [cred, setCred] = useState(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, p, m] = await Promise.all([getAdminStats(), getAllPrograms(), getAllMentors()]);
      setStats(s); setPrograms(p); setMentors(m); setError(''); setNote(s.announcement?.text || '');
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { if (ready) load(); }, [ready, load]);

  async function onProgram(e) {
    e.preventDefault(); setBusy('program');
    try { await createProgram(prog.name, prog.description); toast(`Cohort "${prog.name}" created`); setProg({ name: '', description: '' }); load(); }
    catch (err) { toast(err.message, 'error'); } finally { setBusy(''); }
  }
  async function onMentor(e) {
    e.preventDefault(); setBusy('mentor');
    try {
      const r = await createMentor(ment.name, ment.email);
      setCred({ name: r.mentor.name, email: r.mentor.email, password: r.tempPassword });
      setMent({ name: '', email: '' }); load();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(''); }
  }
  async function onAssign(p) {
    const mid = pick[p._id];
    if (!mid) { toast('Pick a mentor first', 'error'); return; }
    try { const r = await assignMentor(p._id, mid); toast(r.message); setPick({ ...pick, [p._id]: '' }); load(); }
    catch (err) { toast(err.message, 'error'); }
  }
  async function onRemove(p, m) {
    if (!window.confirm(`Remove ${m.name} from ${p.name}?`)) return;
    try { await removeMentor(p._id, m._id); toast('Mentor removed'); load(); } catch (err) { toast(err.message, 'error'); }
  }
  async function onCore(m) {
    try {
      const r = await setCoreTeam(m._id, !m.isCoreTeam);
      toast(r.isAdmin ? `${m.name} is now core team` : `${m.name} is no longer core team`);
      load();
    } catch (err) { toast(err.message, 'error'); }
  }
  async function onNote(e) {
    e.preventDefault(); setBusy('note');
    try { await setAnnouncement(note); toast(note.trim() ? 'Announcement pinned to the Techboard' : 'Announcement removed'); }
    catch (err) { toast(err.message, 'error'); } finally { setBusy(''); }
  }
  async function copyCred() {
    try { await navigator.clipboard.writeText(`TechNeeds mentor login\nEmail: ${cred.email}\nPassword: ${cred.password}\nLog in at ${window.location.origin}/login?role=mentor`); toast('Credentials copied'); }
    catch { toast('Copy failed', 'error'); }
  }

  // ---- AI pipeline (Render Workflows) ----
  const [aiRun, setAiRun] = useState(null);
  async function onRefreshAll() {
    try {
      const r = await refreshAllAiCards();
      setAiRun(r);
      toast('Queued on Render Workflows');
    } catch (e) { toast(e.message, 'error'); }
  }
  useEffect(() => {
    if (!aiRun?.runId || !['pending', 'running'].includes(aiRun.status)) return undefined;
    const t = setTimeout(async () => {
      try {
        const r = await getAiRun(aiRun.runId);
        setAiRun(r);
        if (r.status === 'succeeded') { toast(`AI cards refreshed: ${r.results?.succeeded ?? 0} updated`); load(); }
        if (r.status === 'failed') toast('The workflow run failed. Check the Render dashboard logs.', 'error');
      } catch { setAiRun((x) => ({ ...x })); }
    }, 4000);
    return () => clearTimeout(t);
  }, [aiRun, load, toast]);

  if (!ready) return null;

  return (
    <>
      <div className="tn-stack" style={{ gap: 6 }}>
          <span className="tn-eyebrow">core@techneeds:~# ls programs/</span>
          <h1 className="tn-title">Command deck</h1>
          <p className="tn-muted" style={{ fontSize: 15 }}>Core-team tools: cohorts, mentors, the AI pipeline and the Techboard announcement.</p>
        </div>
        {error && <ErrorBox message={error} onRetry={load} />}
        {!stats && !error && <Loading rows={3} />}
        {stats && (
          <>
            <section className="tn-grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
              {[['programs', stats.programs, '#fff'], ['mentors', stats.mentors, 'var(--tn-tint)'], ['mentees', stats.mentees, '#fff'], ['missions', stats.resources, '#fff'], ['no_mentor_yet', stats.unassignedPrograms, 'var(--tn-yellow)']].map(([l, v, bg]) => (
                <div key={l} className="tn-card" style={{ background: bg, padding: 18 }}>
                  <div className="tn-label" style={{ color: bg === 'var(--tn-yellow)' ? 'var(--tn-navy)' : undefined }}>{l}</div>
                  <div className="tn-big" style={{ fontSize: 38, marginTop: 6 }}>{v}</div>
                </div>
              ))}
            </section>

            <section className="tn-card navy" style={{ padding: 24, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', justifyContent: 'space-between', background: 'var(--tn-navy)', color: '#fff' }}>
              <div className="tn-stack" style={{ gap: 6, minWidth: 0, flex: '1 1 340px' }}>
                <span className="tn-mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--tn-yellow)' }}>AI PIPELINE · {stats.ai?.pipeline === 'render-workflows' ? 'RENDER WORKFLOWS' : 'INLINE (LOCAL)'}</span>
                <h2 style={{ fontSize: 24, color: '#fff' }}>Learner AI cards</h2>
                <p style={{ margin: 0, color: '#cfe0ff', fontSize: 15 }}>
                  {stats.ai?.geminiCards ?? 0} of {stats.mentees} cards written by Gemini · {stats.ai?.freshCards ?? 0} refreshed in the last 6h.
                  {stats.ai?.pipeline === 'render-workflows'
                    ? ' Runs on Render Workflows: each card is its own task with automatic retries when Gemini is busy.'
                    : ' Set RENDER_API_KEY and AI_WORKFLOW_SLUG on the API to run this on Render Workflows.'}
                </p>
                {aiRun && (
                  <span className="tn-mono" style={{ fontSize: 13, color: '#fff' }} role="status">
                    run {aiRun.runId} · <b>{aiRun.status}</b>
                    {aiRun.status === 'succeeded' && aiRun.results ? ` · ${aiRun.results.succeeded}/${aiRun.results.checked} updated` : ''}
                    {aiRun.retries ? ` · ${aiRun.retries} retries` : ''}
                  </span>
                )}
              </div>
              <button className="tn-btn primary" onClick={onRefreshAll} disabled={stats.ai?.pipeline !== 'render-workflows' || ['pending', 'running'].includes(aiRun?.status)}>
                <Icon name="refresh" size={16} color="#fff" /> {['pending', 'running'].includes(aiRun?.status) ? 'Refreshing…' : 'Refresh all AI cards'}
              </button>
            </section>

            <section className="tn-row" style={{ gap: 26 }}>
              <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 26 }}>
                <form onSubmit={onProgram} className="tn-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <h2 style={{ fontSize: 22 }}>Spin up a cohort</h2>
                  <div className="tn-field"><label htmlFor="pn">Program name</label><input id="pn" className="tn-input" value={prog.name} onChange={(e) => setProg({ ...prog, name: e.target.value })} placeholder="e.g. App Dev Cohort 2026" required /></div>
                  <div className="tn-field"><label htmlFor="pd">One-line description</label><input id="pd" className="tn-input" value={prog.description} onChange={(e) => setProg({ ...prog, description: e.target.value })} placeholder="React Native from zero" /></div>
                  <button className="tn-btn primary" disabled={busy === 'program'}>{busy === 'program' ? 'Creating…' : 'Create program'}</button>
                </form>
                <form onSubmit={onMentor} className="tn-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <h2 style={{ fontSize: 22 }}>Recruit a mentor</h2>
                  <div className="tn-field"><label htmlFor="mn">Name</label><input id="mn" className="tn-input" value={ment.name} onChange={(e) => setMent({ ...ment, name: e.target.value })} placeholder="Full name" required /></div>
                  <div className="tn-field"><label htmlFor="me">Email</label><input id="me" type="email" className="tn-input" value={ment.email} onChange={(e) => setMent({ ...ment, email: e.target.value })} placeholder="name@igdtuw.ac.in" required /></div>
                  <button className="tn-btn primary" disabled={busy === 'mentor'}>{busy === 'mentor' ? 'Creating…' : 'Create + generate password'}</button>
                  <span className="tn-hand" style={{ fontSize: 21, color: 'var(--tn-blue-ink)' }}>we make a secure password for you ✦</span>
                </form>
                <form onSubmit={onNote} className="tn-card yellow" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <h2 style={{ fontSize: 22 }}>Techboard announcement</h2>
                  <div className="tn-field"><label htmlFor="an">Pinned note (leave empty to remove)</label><textarea id="an" className="tn-textarea" rows={3} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Round 1 results out on Nov 22!" /></div>
                  <button className="tn-btn dark" disabled={busy === 'note'}>{busy === 'note' ? 'Saving…' : 'Pin to Techboard'}</button>
                </form>
                {cred && (
                  <div className="tn-navy" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="tn-between"><h2 style={{ fontSize: 20 }}>Mentor credentials</h2><button className="tn-link-btn" style={{ color: '#8ec5ff' }} onClick={() => setCred(null)}>Dismiss</button></div>
                    <div className="tn-pass">
                      <div><span className="tn-mono" style={{ fontSize: 11, color: '#8ec5ff' }}>MENTOR</span><span style={{ fontWeight: 700 }}>{cred.name}</span><span className="tn-mono" style={{ fontSize: 13 }}>{cred.email}</span></div>
                      <div><span className="tn-mono" style={{ fontSize: 11, color: '#8ec5ff' }}>PASSWORD</span><span className="tn-mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--tn-yellow)' }}>{cred.password}</span><span style={{ fontSize: 12, color: '#cfe0ff' }}>Shown once only</span></div>
                    </div>
                    <button className="tn-btn cyan sm" style={{ alignSelf: 'flex-start' }} onClick={copyCred}><Icon name="copy" size={16} /> Copy credentials</button>
                  </div>
                )}
              </div>

              <div style={{ flex: '999 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
                {programs.length === 0 && <div className="tn-empty">No cohorts yet. Spin up the first one.</div>}
                {programs.map((p) => {
                  const empty = !p.mentors?.length;
                  const available = mentors.filter((m) => !p.mentors?.some((x) => x._id === m._id));
                  return (
                    <div key={p._id} className="tn-card" style={{ position: 'relative', padding: 24, display: 'flex', flexDirection: 'column', gap: 14, borderStyle: empty ? 'dashed' : 'solid', boxShadow: empty ? 'none' : 'var(--shadow-blue)' }}>
                      {empty && <span className="tn-hand" style={{ position: 'absolute', top: -16, right: 24, background: 'var(--tn-yellow)', border: '2px solid var(--tn-navy)', borderRadius: 8, padding: '2px 10px', fontSize: 20 }}>needs a mentor!</span>}
                      <div className="tn-between">
                        <div><h2 style={{ fontSize: 24 }}>{p.name}</h2>{p.description && <p className="tn-muted" style={{ fontSize: 14, marginTop: 2 }}>{p.description}</p>}</div>
                        <span className="tn-pill" style={{ background: 'var(--tn-tint)' }}>{p.menteeCount} crew · {p.resourceCount} missions</span>
                      </div>
                      {!empty && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                          {p.mentors.map((m) => (
                            <span key={m._id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 8px 6px 6px', borderRadius: 999, background: 'var(--tn-paper)', border: '2px solid var(--tn-navy)', fontSize: 14, fontWeight: 700 }}>
                              <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--tn-yellow)', border: '2px solid var(--tn-navy)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>{initials(m.name)}</span>
                              {m.name}
                              <button onClick={() => onRemove(p, m)} aria-label={`Remove ${m.name}`} style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700, color: 'var(--tn-muted)', fontSize: 16 }}>×</button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <label htmlFor={`as-${p._id}`} className="sr-only">Assign mentor to {p.name}</label>
                        <select id={`as-${p._id}`} className="tn-select" style={{ flex: '1 1 220px', width: 'auto' }} value={pick[p._id] || ''} onChange={(e) => setPick({ ...pick, [p._id]: e.target.value })}>
                          <option value="">{available.length ? 'Pick a mentor to assign' : 'All mentors already assigned'}</option>
                          {available.map((m) => <option key={m._id} value={m._id}>{m.name} · {m.email}</option>)}
                        </select>
                        <button className={`tn-btn ${empty ? 'primary' : ''}`} onClick={() => onAssign(p)}>Assign</button>
                      </div>
                    </div>
                  );
                })}
                {mentors.length > 0 && (
                  <div className="tn-card" style={{ padding: 24 }}>
                    <h2 style={{ fontSize: 22, marginBottom: 4 }}>Mentor roster</h2>
                    <p className="tn-muted" style={{ fontSize: 13, marginBottom: 12 }}>Core team members see Command deck, Events and Inbox in their Mission Control.</p>
                    <div className="tn-stack">
                      {mentors.map((m) => (
                        <div key={m._id} className="tn-between" style={{ borderBottom: '1px dashed #bfd0ee', paddingBottom: 10, gap: 12, flexWrap: 'wrap' }}>
                          <span style={{ minWidth: 0 }}><b>{m.name}</b> <span className="tn-label">{m.email}</span><br /><span className="tn-label">{m.programs?.length ? m.programs.map((p) => p.name).join(', ') : 'unassigned'}</span></span>
                          <button type="button" role="switch" aria-checked={!!m.isCoreTeam} onClick={() => onCore(m)} disabled={me && String(me._id) === String(m._id)} className="tn-btn sm" style={{ background: m.isCoreTeam ? 'var(--tn-navy)' : '#fff', color: m.isCoreTeam ? '#fff' : 'var(--tn-navy)' }} title={me && String(me._id) === String(m._id) ? 'You can’t change your own access' : undefined}>
                            <Icon name="shield" size={14} color={m.isCoreTeam ? '#fff' : 'var(--tn-navy)'} /> {m.isCoreTeam ? 'Core team' : 'Make core team'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
    </>
  );
}
