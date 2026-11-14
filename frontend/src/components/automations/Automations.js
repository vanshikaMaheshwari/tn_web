'use client';
import { useCallback, useEffect, useState } from 'react';
import { formatDateTime, getAutomations, startAutomation } from '@/lib/api';
import { ErrorBox, Loading } from '@/components/ui/Brand';
import Icon from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import WeeklyReport from './WeeklyReport';

const TASKS = [
  {
    key: 'deadlineDigest', title: 'Daily deadline digest', icon: 'clock', bg: 'var(--tn-yellow)', when: 'Every day · 8:00 AM IST',
    what: 'Finds missions due in the next 48 hours (and overdue ones) for every mentee and posts them as “Today’s reminders” on their Launchpad.',
    retry: '2 retries · 10s, 20s',
  },
  {
    key: 'weeklyCohortReport', title: 'Weekly cohort report', icon: 'grid', bg: 'var(--tn-sky)', when: 'Every Monday · 8:30 AM IST',
    what: 'Computes each cohort’s week (active mentees, points, hardest mission, who went quiet), then chains a Gemini subtask per cohort to write the summary mentors see.',
    retry: 'Summary subtask: 4 retries · 5s → 40s',
  },
  {
    key: 'refreshAllCards', title: 'Refresh all AI cards', icon: 'spark', bg: '#ece6ff', when: 'On demand',
    what: 'Fans out one “generateAiCard” run per out-of-date learner, 5 at a time, so Gemini’s rate limits are respected.',
    retry: 'Each card: 4 retries · 5s → 40s',
  },
];
const ST_BG = { pending: '#fff', running: 'var(--tn-sky)', succeeded: '#C9F5DF', failed: '#FFD1DC', canceled: '#e8f0ff' };
const LIVE = ['pending', 'running'];

function resultLine(r) {
  const x = r.result;
  if (!x) return r.error || '';
  if (r.task === 'deadlineDigest') return `${x.withReminders}/${x.mentees} mentees reminded · ${x.dueSoon} due soon · ${x.overdue} overdue`;
  if (r.task === 'weeklyCohortReport') return `${x.cohorts} cohort report${x.cohorts === 1 ? '' : 's'} · ${x.aiSummaries} Gemini summaries`;
  if (r.task === 'refreshAllCards') return `${x.succeeded}/${x.checked} cards updated${x.failed ? ` · ${x.failed} failed` : ''}`;
  return '';
}

export default function Automations() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try { setData(await getAutomations()); setError(''); } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  // Poll while a run is in flight on Render.
  const live = data?.runs?.some((r) => LIVE.includes(r.status));
  useEffect(() => {
    if (!live) return undefined;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [live, load]);

  async function run(task) {
    setBusy(task);
    try {
      const r = await startAutomation(task);
      toast(r.via === 'inline' ? 'Ran inline (Render Workflows not configured)' : `Queued on Render Workflows · ${r.runId}`);
      await load();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(''); }
  }

  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!data) return <Loading rows={4} />;
  const onRender = data.pipeline === 'render-workflows';
  const lastOf = (k) => data.runs.find((r) => r.task === k);

  return (
    <div className="tn-stack" style={{ gap: 26 }}>
      <div className="tn-stack" style={{ gap: 6 }}>
        <span className="tn-eyebrow">core@techneeds:~$ render workflows ls</span>
        <h1 style={{ fontSize: 'clamp(32px, 4vw, 44px)' }}>Automations</h1>
        <span style={{ fontSize: 15, color: 'var(--tn-ink-2)', maxWidth: 780 }}>Background jobs that run on <b>Render Workflows</b>: each one is a task with its own retries, and Render spins up compute only while it runs.</span>
      </div>

      <section className="tn-navy" style={{ padding: '18px 22px', borderRadius: 20, boxShadow: '5px 5px 0 var(--tn-blue)', display: 'flex', alignItems: 'stretch', gap: 8, flexWrap: 'wrap' }} aria-label="How automations run">
        {[['Schedule', 'GitHub Actions · daily / weekly'], ['TechNeeds API', 'checks the secret, queues the run'], ['Render Workflows', 'runs the task, retries on failure'], ['MongoDB', 'reminders + reports saved'], ['Launchpad + Mission control', 'what students & mentors see']].map(([t, d], i, a) => (
          <span key={t} style={{ display: 'contents' }}>
            <span style={{ flex: '1 1 0', minWidth: 120, display: 'flex', flexDirection: 'column', gap: 2, background: i === 2 ? 'var(--tn-yellow)' : 'rgba(255,255,255,.08)', color: i === 2 ? 'var(--tn-navy)' : '#fff', border: `2px solid ${i === 2 ? '#fff' : 'rgba(255,255,255,.4)'}`, borderRadius: 12, padding: '8px 12px' }}>
              <b style={{ fontSize: 14 }}>{t}</b><span style={{ fontSize: 12, opacity: 0.85 }}>{d}</span>
            </span>
            {i < a.length - 1 && <span aria-hidden="true" style={{ color: '#8ec5ff', fontWeight: 800, alignSelf: 'center' }}>→</span>}
          </span>
        ))}
      </section>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <span className="tn-chipx" style={{ background: onRender ? '#C9F5DF' : 'var(--tn-orange-bg)' }}>{onRender ? '● pipeline: Render Workflows' : '○ pipeline: inline (set RENDER_API_KEY + AI_WORKFLOW_SLUG)'}</span>
        <span className="tn-chipx" style={{ background: data.scheduled ? '#C9F5DF' : 'var(--tn-orange-bg)' }}>{data.scheduled ? '● schedule: on (CRON_SECRET set)' : '○ schedule: off (set CRON_SECRET)'}</span>
        <span className="tn-chipx" style={{ background: '#fff' }}>{data.remindersToday} mentees have reminders today</span>
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        {TASKS.map((t) => {
          const last = lastOf(t.key);
          const running = last && LIVE.includes(last.status);
          const disabled = busy === t.key || running || (t.key === 'refreshAllCards' && !onRender);
          return (
            <article key={t.key} className="tn-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span className="tn-ico" style={{ background: t.bg, width: 44, height: 44, borderRadius: 12, flex: 'none' }}><Icon name={t.icon} size={22} /></span>
                <div className="tn-stack" style={{ gap: 2 }}><b style={{ fontSize: 17 }}>{t.title}</b><span className="tn-mono" style={{ fontSize: 12, color: 'var(--tn-blue-ink)' }}>{t.key}</span></div>
              </div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--tn-ink-2)' }}>{t.what}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="tn-chipx" style={{ background: 'var(--tn-paper)' }}>⏱ {t.when}</span>
                <span className="tn-chipx" style={{ background: 'var(--tn-paper)' }}>↻ {t.retry}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--tn-muted)', minHeight: 36 }}>
                {last ? <>Last run {formatDateTime(last.createdAt)} · <b style={{ color: 'var(--tn-navy)' }}>{last.status}</b>{last.retries ? ` · ${last.retries} retries` : ''}<br />{resultLine(last)}</> : 'Never run yet.'}
              </div>
              <button className="tn-btn primary sm" style={{ marginTop: 'auto', alignSelf: 'flex-start' }} disabled={disabled} onClick={() => run(t.key)}>
                <Icon name="play" size={16} color="#fff" /> {running ? 'Running…' : busy === t.key ? 'Starting…' : 'Run now'}
              </button>
            </article>
          );
        })}
      </section>

      <section className="tn-stack" style={{ gap: 12 }}>
        <h2 style={{ fontSize: 24 }}>Run history</h2>
        {data.runs.length === 0 ? <div className="tn-empty">No runs yet. Press “Run now” on any automation.</div> : (
          <div className="tn-card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="tn-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead><tr style={{ textAlign: 'left', background: 'var(--tn-paper)' }}>{['Task', 'Status', 'Trigger', 'Ran on', 'Started', 'Result'].map((h) => <th key={h} style={{ padding: '10px 14px', borderBottom: '2px solid var(--tn-navy)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{h}</th>)}</tr></thead>
              <tbody>
                {data.runs.map((r) => (
                  <tr key={r._id} style={{ borderBottom: '1px dashed #bfd0ee' }}>
                    <td style={{ padding: '10px 14px' }}><b className="tn-mono" style={{ fontSize: 13 }}>{r.task}</b>{r.runId && <div className="tn-mono tn-muted" style={{ fontSize: 11 }}>{r.runId}</div>}</td>
                    <td style={{ padding: '10px 14px' }}><span className="tn-chipx" style={{ background: ST_BG[r.status] }}>{r.status}{r.retries ? ` · ${r.retries}↻` : ''}</span></td>
                    <td style={{ padding: '10px 14px' }}>{r.trigger === 'schedule' ? '⏱ schedule' : `▶ ${r.by || 'manual'}`}</td>
                    <td style={{ padding: '10px 14px' }}>{r.via === 'inline' ? 'API (inline)' : 'Render Workflows'}</td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{formatDateTime(r.createdAt)}</td>
                    <td style={{ padding: '10px 14px', color: r.status === 'failed' ? '#B4232C' : 'var(--tn-ink-2)' }}>{resultLine(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="tn-stack" style={{ gap: 12 }}>
        <h2 style={{ fontSize: 24 }}>Latest weekly reports</h2>
        {data.reports.length === 0 ? <WeeklyReport report={null} /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20 }}>
            {data.reports.map((r) => <WeeklyReport key={r._id} report={r} compact />)}
          </div>
        )}
      </section>
    </div>
  );
}
