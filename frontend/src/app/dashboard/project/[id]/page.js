'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import { formatDateTime, getDashboard, submitProject, timeLeft } from '@/lib/api';
import { ErrorBox, Loading } from '@/components/ui/Brand';
import Icon from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';

const MAX = 600;
const isUrl = (u) => { try { return ['http:', 'https:'].includes(new URL(u).protocol); } catch { return false; } };

export default function ProjectPage() {
  const { ready } = useAuth('mentee');
  const { id } = useParams();
  const toast = useToast();
  const [res, setRes] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ githubLink: '', deployedLink: '', description: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await getDashboard();
      const r = d.programs.flatMap((p) => p.resources).find((x) => x._id === id);
      if (!r || r.type !== 'project') throw new Error('Project mission not found.');
      setRes(r);
    } catch (e) { setError(e.message); }
  }, [id]);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!isUrl(form.githubLink) || !isUrl(form.deployedLink)) { toast('Both links must start with http:// or https://', 'error'); return; }
    setBusy(true);
    try {
      const r = await submitProject(id, form);
      toast(r.message);
      load();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  if (!ready) return null;
  if (error) return <main className="tn-wrap"><ErrorBox message={error} /><Link href="/dashboard" className="tn-btn" style={{ alignSelf: 'flex-start' }}>Back to Launchpad</Link></main>;
  if (!res) return <main className="tn-wrap"><Loading rows={3} /></main>;

  const left = timeLeft(res.deadline);
  const stage = res.status === 'completed' ? 3 : res.status === 'pending_review' ? 2 : 1;
  const locked = res.status === 'completed';
  const steps = [['Submitted', 'by you'], ['Under review', 'your mentor'], ['Scored', res.status === 'completed' ? `${res.score} / ${res.maxScore} pts` : 'points added']];
  const reqs = (res.description || '').split(/\n|•|;/).map((s) => s.trim()).filter(Boolean);

  return (
    <main className="tn-wrap" style={{ gap: 24 }}>
      <div className="tn-stack" style={{ gap: 6 }}>
        <Link href="/dashboard" style={{ fontWeight: 700, fontSize: 14 }}>← Mission board</Link>
        <h1 className="tn-title">{locked ? 'Your build is scored' : stage === 2 ? 'Build submitted' : 'Submit your build'}</h1>
      </div>
      <section className="tn-row" style={{ gap: 28 }}>
        <aside className="tn-side-col" style={{ flexBasis: 380 }}>
          <div className="tn-navy">
            <span className="tn-pill yellow">PROJECT · {res.maxScore} pts</span>
            <h2 style={{ fontSize: 30, lineHeight: 1.1, margin: '14px 0 10px' }}>{res.title}</h2>
            <p style={{ fontSize: 15, lineHeight: 1.5, color: '#cfe0ff' }}>
              {left ? (left.past ? `Deadline passed ${left.txt} ago · late days reduce the score` : `Due in ${left.txt} · ${formatDateTime(res.deadline)}`) : 'No deadline'}
            </p>
          </div>
          <div className="tn-card">
            <h3 style={{ fontSize: 20, marginBottom: 14 }}>Mission checklist</h3>
            <div className="tn-stack">
              {(reqs.length ? reqs : ['Push your code to a public GitHub repo', 'Deploy it and share the live link', 'Explain what you built and why']).map((r) => (
                <div key={r} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ flex: '0 0 auto', width: 26, height: 26, borderRadius: 8, background: 'var(--tn-yellow)', border: '2px solid var(--tn-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={16} stroke={3} /></span>
                  <span style={{ fontSize: 16, lineHeight: 1.45 }}>{r}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
        <div className="tn-main-col" style={{ gap: 22 }}>
          {locked ? (
            <div className="tn-card yellow" style={{ padding: 32 }}>
              <span className="tn-label" style={{ color: 'var(--tn-navy)' }}>mentor_score</span>
              <div className="tn-big" style={{ fontSize: 64, margin: '8px 0' }}>{res.score}<span style={{ fontSize: 28 }}> / {res.maxScore}</span></div>
              {res.feedback && <p style={{ fontSize: 17, lineHeight: 1.5 }}>“{res.feedback}”</p>}
            </div>
          ) : (
            <form onSubmit={onSubmit} className="tn-card" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 18, boxShadow: '6px 6px 0 var(--tn-navy)' }}>
              {stage === 2 && <p className="tn-pill cyan" style={{ fontFamily: 'var(--font-body)', fontSize: 14, padding: '8px 12px' }}>Already submitted. You can resubmit until your mentor scores it.</p>}
              <div className="tn-field"><label htmlFor="gh">GitHub repository</label><input id="gh" className="tn-input mono" placeholder="https://github.com/you/project" value={form.githubLink} onChange={(e) => setForm({ ...form, githubLink: e.target.value })} required /></div>
              <div className="tn-field"><label htmlFor="live">Live link</label><input id="live" className="tn-input mono" placeholder="https://your-site.vercel.app" value={form.deployedLink} onChange={(e) => setForm({ ...form, deployedLink: e.target.value })} required /></div>
              <div className="tn-field">
                <label htmlFor="desc">What did you build?</label>
                <textarea id="desc" className="tn-textarea" rows={5} maxLength={MAX} placeholder="Stack, key decisions, what you’d improve next…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
                <span className="tn-label" style={{ alignSelf: 'flex-end' }}>{form.description.length} / {MAX}</span>
              </div>
              <div className="tn-between">
                <span className="tn-hand" style={{ fontSize: 22, color: 'var(--tn-blue-ink)' }}>mentors love a good build log ✎</span>
                <button className="tn-btn primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit for review'}</button>
              </div>
            </form>
          )}
          <div className="tn-card">
            <h3 style={{ fontSize: 20, marginBottom: 16 }}>After you submit</h3>
            <div style={{ display: 'flex', gap: 16 }}>
              {steps.map(([t, d], i) => {
                const n = i + 1;
                const state = n < stage || (n === 3 && locked) ? 'done' : n === stage ? 'now' : '';
                return (
                  <div key={t} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ width: 36, height: 36, borderRadius: '50%', border: 'var(--border)', background: state === 'done' ? 'var(--tn-yellow)' : state === 'now' ? 'var(--tn-blue)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {state === 'done' && <Icon name="check" size={18} stroke={3} />}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{t}</span>
                    <span className="tn-muted" style={{ fontSize: 13 }}>{d}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
