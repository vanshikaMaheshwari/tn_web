'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import { completeVideo, formatDate, getDashboard, getLeaderboard, timeLeft } from '@/lib/api';
import { ErrorBox, Loading, Orbit } from '@/components/ui/Brand';
import Icon from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { useReveal } from '@/lib/useReveal';

const TYPE = {
  video: { icon: 'play', bg: 'var(--tn-sky)', color: 'var(--tn-navy)', label: 'Video' },
  quiz: { icon: 'quiz', bg: 'var(--tn-blue)', color: '#fff', label: 'Quiz' },
  project: { icon: 'code', bg: 'var(--tn-yellow)', color: 'var(--tn-navy)', label: 'Project' },
};
const ORDER = { overdue: 0, available: 1, pending_review: 2, upcoming: 3, completed: 4, closed: 5, locked: 6 };

export default function Launchpad() {
  const { ready } = useAuth('mentee');
  const toast = useToast();
  const [data, setData] = useState(null);
  const [board, setBoard] = useState([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);
  useReveal([Boolean(data)]);

  const load = useCallback(async () => {
    setError('');
    try {
      const d = await getDashboard();
      setData(d);
      const pid = d.programs?.[0]?._id;
      getLeaderboard(pid).then(setBoard).catch(() => setBoard([]));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  const view = useMemo(() => {
    if (!data) return null;
    const all = data.programs.flatMap((p) => p.resources.map((r) => ({ ...r, programName: p.name })));
    const sorted = [...all].sort((a, b) => {
      const o = ORDER[a.status] - ORDER[b.status];
      if (o) return o;
      return new Date(a.closesAt || a.deadline || 8.64e15) - new Date(b.closesAt || b.deadline || 8.64e15);
    });
    const actionable = sorted.filter((r) => r.status === 'available' || r.status === 'overdue');
    const next = actionable.find((r) => r.closesAt || r.deadline) || actionable[0];
    const possible = all.reduce((s, r) => s + (r.maxScore || 0), 0);
    const done = all.filter((r) => r.completed);
    const count = (t) => done.filter((r) => r.type === t).length;
    const thisWeek = actionable.filter((r) => { const t = timeLeft(r.closesAt || r.deadline); return t && !t.past && t.ms < 7 * 86400000; }).length;
    return { all: sorted, next, possible, done, count, thisWeek };
  }, [data]);

  async function onVideo(r) {
    if (r.url) window.open(r.url, '_blank', 'noopener');
    setBusyId(r._id);
    try {
      const res = await completeVideo(r._id);
      toast(`+${res.score} pts${res.latePenalty ? ` (−${res.latePenalty} late)` : ''} · streak ${res.streak} days`);
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  if (!ready) return null;
  if (error) return <main className="tn-wrap"><ErrorBox message={error} onRetry={load} /></main>;
  if (!data || !view) return <main className="tn-wrap"><Loading rows={4} /></main>;

  const first = data.name.split(' ')[0];
  const pct = view.possible ? Math.round((data.totalScore / view.possible) * 100) : 0;
  const nextLeft = view.next ? timeLeft(view.next.closesAt || view.next.deadline) : null;
  const above = board.find((b) => b.rank === data.rank - 1);
  const gap = data.rank > 3 && board[2] ? `${board[2].totalScore - data.totalScore} pts to the podium →` : data.rank <= 3 ? 'you’re on the podium!' : null;
  const top = board.slice(0, 3);
  const me = board.find((b) => String(b.id) === String(data.id));
  const shown = view.all.filter((r) => filter === 'all' || r.type === filter);

  return (
    <main className="tn-wrap">
      <section className="tn-navy tn-hero tn-reveal">
        <div style={{ flex: '1 1 460px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span className="tn-mono" style={{ fontSize: 13, color: '#8ec5ff' }}>~/{(data.programs[0]?.name || 'techneeds').toLowerCase().replace(/\s+/g, '_')} $ whoami</span>
          <h1>Hey {first},<br />ready to <span className="tn-hl">upgrade</span> today?</h1>
          <p style={{ fontSize: 17, color: '#cfe0ff', maxWidth: 520 }}>
            {view.thisWeek} mission{view.thisWeek === 1 ? '' : 's'} this week.
            {view.next && nextLeft && !nextLeft.past ? ` ${view.next.title} closes in ${nextLeft.txt}.` : ' You’re all caught up.'}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 6 }}>
            {view.next && <MissionAction r={view.next} onVideo={onVideo} busy={busyId === view.next._id} hero />}
            <Link href="/profile" className="tn-btn ghost-light">See my AI card</Link>
          </div>
        </div>
        <div style={{ flex: '1 1 320px', display: 'flex', justifyContent: 'center' }}>
          <Orbit rank={data.rank} total={data.totalMentees} gap={gap} />
        </div>
      </section>

      <section aria-label="Your stats" className="tn-grid-auto tn-reveal">
        <div className="tn-card">
          <span className="tn-label">total_score</span>
          <div className="tn-big" style={{ margin: '6px 0' }}>{data.totalScore.toLocaleString('en-IN')}</div>
          <div className="tn-bar"><span style={{ width: `${Math.min(pct, 100)}%` }} /></div>
          <p className="tn-muted" style={{ fontSize: 13, marginTop: 6 }}>{pct}% of points so far</p>
        </div>
        <div className="tn-card yellow">
          <span className="tn-label" style={{ color: 'var(--tn-navy)' }}>streak</span>
          <div className="tn-big" style={{ margin: '6px 0' }}>{data.streak || 0} day{data.streak === 1 ? '' : 's'}</div>
          <span className="tn-hand" style={{ fontSize: 22 }}>{data.streak >= 3 ? 'keep the flame alive!' : 'complete a mission to start one'}</span>
        </div>
        <div className="tn-card tint">
          <span className="tn-label">missions_done</span>
          <div className="tn-big" style={{ margin: '6px 0' }}>{view.done.length}<span style={{ fontSize: 22, color: 'var(--tn-muted)' }}> / {view.all.length}</span></div>
          <p className="tn-muted" style={{ fontSize: 13 }}>{view.count('video')} videos · {view.count('quiz')} quizzes · {view.count('project')} projects</p>
        </div>
        <div className="tn-card">
          <span className="tn-label">next_deadline</span>
          <div className="tn-big" style={{ margin: '6px 0' }}>{nextLeft && !nextLeft.past ? nextLeft.txt : '—'}</div>
          <p className="tn-muted" style={{ fontSize: 13 }}>{view.next ? view.next.title : 'Nothing due'}</p>
        </div>
      </section>

      <section className="tn-row" style={{ gap: 28 }}>
        <div className="tn-main-col">
          <div className="tn-between">
            <h2 style={{ fontSize: 30 }}>Mission board</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="group" aria-label="Filter missions">
              {[['all', 'All'], ['video', 'Videos'], ['quiz', 'Quizzes'], ['project', 'Projects']].map(([k, l]) => (
                <button key={k} className={`tn-chip ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)} aria-pressed={filter === k}>{l}</button>
              ))}
            </div>
          </div>
          {shown.length === 0 && <div className="tn-empty">No missions here yet. Your mentor will post them soon.</div>}
          {shown.map((r) => (
            <MissionRow key={r._id} r={r} urgent={view.next && r._id === view.next._id} onVideo={onVideo} busy={busyId === r._id} />
          ))}
        </div>

        <aside className="tn-side-col">
          <div className="tn-card" style={{ position: 'relative', paddingTop: 28 }}>
            <span className="tn-tab-label">ai_tip.txt</span>
            <p style={{ fontSize: 15, lineHeight: 1.55 }}>
              {view.next
                ? <>Finishing <b>{view.next.title}</b> early is worth <b>{view.next.maxScore} pts</b>{above ? <> and could move you past <b>{above.name.split(' ')[0]}</b></> : null}.</>
                : <>You’ve cleared every open mission. Add interests on your AI card to get tailored next steps.</>}
            </p>
            <Link href="/profile" style={{ fontWeight: 700, fontSize: 14, display: 'inline-block', marginTop: 10 }}>Open my AI card →</Link>
          </div>
          <div className="tn-card">
            <div className="tn-between" style={{ marginBottom: 12 }}>
              <h2 style={{ fontSize: 22 }}>Top of the board</h2>
              <Link href="/leaderboard" style={{ fontSize: 13, fontWeight: 700 }}>All</Link>
            </div>
            <div className="tn-stack">
              {top.map((b) => <BoardRow key={b.id} b={b} me={String(b.id) === String(data.id)} />)}
              {me && me.rank > 3 && <BoardRow b={me} me />}
              {board.length === 0 && <p className="tn-muted" style={{ fontSize: 14 }}>No scores yet.</p>}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function BoardRow({ b, me }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 15, padding: me ? 10 : 0, margin: me ? '0 -10px' : 0, borderRadius: 14, background: me ? 'var(--tn-blue)' : 'transparent', color: me ? '#fff' : 'inherit' }}>
      <span style={{ width: 32, height: 32, borderRadius: '50%', background: me ? '#fff' : b.rank === 1 ? 'var(--tn-yellow)' : 'var(--tn-tint)', color: 'var(--tn-navy)', border: '2px solid var(--tn-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>{b.rank}</span>
      <span style={{ flex: 1, fontWeight: me ? 700 : 400 }}>{me ? 'You' : b.name}</span>
      <span className="tn-mono" style={{ fontWeight: 700 }}>{b.totalScore.toLocaleString('en-IN')}</span>
    </div>
  );
}

function MissionAction({ r, onVideo, busy, hero }) {
  const cls = hero ? 'tn-btn cyan' : 'tn-btn primary';
  if (r.type === 'video') return <button className={cls} onClick={() => onVideo(r)} disabled={busy}>{busy ? 'Saving…' : 'Watch + mark done'}</button>;
  if (r.type === 'quiz') return <Link href={`/dashboard/quiz/${r._id}`} className={cls}>Launch quiz</Link>;
  return <Link href={`/dashboard/project/${r._id}`} className={cls}>Submit build</Link>;
}

function MissionRow({ r, urgent, onVideo, busy }) {
  const t = TYPE[r.type] || TYPE.video;
  const left = timeLeft(r.closesAt || r.deadline);
  const meta = [t.label, r.questionCount ? `${r.questionCount} questions` : null, r.maxScore !== undefined ? `${r.maxScore} pts` : null].filter(Boolean).join(' · ');
  let cls = 'tn-mission';
  let sub = null;
  let action = null;

  if (r.status === 'completed') {
    cls += ' done';
    sub = <span style={{ fontSize: 13, color: 'var(--tn-green)' }}>Done {formatDate(r.completedOn)}{r.feedback ? ` · “${r.feedback}”` : ''}</span>;
    action = <span className="tn-big" style={{ fontSize: 20, color: 'var(--tn-green)' }}>+{r.score}</span>;
  } else if (r.status === 'pending_review') {
    sub = <span style={{ fontSize: 13, color: 'var(--tn-muted)' }}>Submitted · waiting for your mentor’s score</span>;
    action = <span className="tn-pill cyan">Under review</span>;
  } else if (r.status === 'upcoming') {
    cls += ' locked';
    sub = <span style={{ fontSize: 13, color: 'var(--tn-muted)' }}>Unlocks {formatDate(r.opensAt)}</span>;
  } else if (r.status === 'closed' || r.status === 'locked') {
    cls += ' locked';
    sub = <span style={{ fontSize: 13, color: 'var(--tn-muted)' }}>{r.status === 'closed' ? 'Closed' : 'Locked by your mentor'}</span>;
  } else {
    if (urgent) cls += ' urgent';
    const late = r.status === 'overdue';
    sub = left && <span style={{ fontSize: 13, fontWeight: 700, color: late || left.ms < 2 * 86400000 ? 'var(--tn-orange)' : 'var(--tn-muted)' }}>{late ? `Overdue by ${left.txt} · late penalty applies` : `Due in ${left.txt}`}</span>;
    action = <MissionAction r={r} onVideo={onVideo} busy={busy} />;
  }

  const locked = cls.includes('locked');
  return (
    <div className={cls}>
      <span className="tn-ico" style={{ background: locked ? '#e6ecf7' : r.status === 'completed' ? '#fff' : t.bg, borderStyle: locked ? 'dashed' : 'solid' }}>
        <Icon name={locked ? 'lock' : r.status === 'completed' ? 'check' : t.icon} color={locked ? 'var(--tn-muted)' : r.status === 'completed' ? 'var(--tn-green)' : t.color} size={26} />
      </span>
      <div className="body">
        <span className="meta">{meta}</span>
        <span className="name" style={locked ? { color: 'var(--tn-muted)' } : undefined}>{r.title}</span>
        {sub}
      </div>
      {action}
      {urgent && <span className="note">do this one first ↓</span>}
    </div>
  );
}
