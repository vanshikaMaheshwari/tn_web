'use client';
import { useEffect, useState } from 'react';
import { getDashboard, getLeaderboard, getPublicPrograms, initials, session } from '@/lib/api';
import { ErrorBox, Loading } from '@/components/ui/Brand';

export default function LeaderboardPage() {
  const [programs, setPrograms] = useState([]);
  const [program, setProgram] = useState('');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [meId, setMeId] = useState(null);
  const [updated, setUpdated] = useState(null);

  useEffect(() => {
    getPublicPrograms().then(setPrograms).catch(() => {});
    const s = session.get();
    if (s.role === 'mentee' && s.token) {
      getDashboard().then((d) => { setMeId(String(d.id)); if (d.programs?.[0]) setProgram(d.programs[0]._id); }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    setRows(null);
    setError('');
    const fetchRows = () => getLeaderboard(program || undefined).then((r) => { setRows(r); setUpdated(new Date()); }).catch((e) => setError(e.message));
    fetchRows();
    const t = setInterval(fetchRows, 30000); // live refresh
    return () => clearInterval(t);
  }, [program]);

  const podium = rows ? [rows[1], rows[0], rows[2]] : [];
  const rest = rows ? rows.slice(3) : [];
  const me = rows?.find((r) => String(r.id) === meId);
  const third = rows?.[2];

  return (
    <main className="tn-wrap">
      <section className="tn-between" style={{ alignItems: 'flex-end' }}>
        <div className="tn-stack" style={{ gap: 6 }}>
          <span className="tn-eyebrow">~/leaderboard --live{updated ? ` · updated ${updated.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` : ''}</span>
          <h1 className="tn-title">Who’s in orbit</h1>
        </div>
        <div>
          <label htmlFor="coh" className="sr-only">Cohort</label>
          <select id="coh" className="tn-select" style={{ minWidth: 240 }} value={program} onChange={(e) => setProgram(e.target.value)}>
            <option value="">All cohorts</option>
            {programs.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </div>
      </section>

      {error && <ErrorBox message={error} />}
      {!rows && !error && <Loading rows={4} />}

      {rows && (
        <section className="tn-row" style={{ gap: 28 }}>
          <div className="tn-main-col" style={{ gap: 22 }}>
            {rows.length === 0 ? <div className="tn-empty">No scores on the board yet.</div> : (
              <div className="tn-card" style={{ padding: '28px 28px 20px', display: 'flex', gap: 20, alignItems: 'flex-end' }}>
                {podium.map((r, i) => r && (
                  <div key={r.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span className="tn-avatar" style={{ width: 72, height: 72, fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 800, background: String(r.id) === meId ? 'var(--tn-yellow)' : '#bfd6ff' }}>{initials(r.name)}</span>
                    <span style={{ fontWeight: 700, fontSize: 16, textAlign: 'center' }}>{String(r.id) === meId ? 'You' : r.name}</span>
                    <span className="tn-mono tn-muted" style={{ fontSize: 14 }}>{r.totalScore.toLocaleString('en-IN')} pts</span>
                    <div style={{ width: '100%', height: [150, 200, 110][i], background: ['var(--tn-tint)', 'var(--tn-yellow)', '#fff'][i], border: 'var(--border)', borderRadius: '18px 18px 6px 6px', boxShadow: 'var(--shadow)', display: 'flex', justifyContent: 'center', paddingTop: 14, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 44 }}>{r.rank}</div>
                    <span className="tn-label" style={{ fontWeight: 700 }}>{r.streak} day streak</span>
                  </div>
                ))}
              </div>
            )}
            <div className="tn-scroll-x">
              <div className="tn-stack" style={{ minWidth: 620, gap: 10 }}>
                {rest.map((r) => {
                  const mine = String(r.id) === meId;
                  return (
                    <div key={r.id} className={`tn-rowcard ${mine ? 'me' : ''}`} style={{ gridTemplateColumns: '64px minmax(0, 1fr) 130px 120px 110px' }}>
                      <span className="tn-mono" style={{ fontWeight: 700, fontSize: 18 }}>{String(r.rank).padStart(2, '0')}</span>
                      <span style={{ fontWeight: 700 }}>{mine ? `You · ${r.name}` : r.name}</span>
                      <span style={{ fontSize: 14, opacity: 0.85 }}>{r.streak} day streak</span>
                      <span style={{ fontSize: 14, opacity: 0.85 }}>{r.completed} missions</span>
                      <span className="tn-mono" style={{ fontWeight: 700, fontSize: 18, textAlign: 'right' }}>{r.totalScore.toLocaleString('en-IN')}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <aside className="tn-side-col" style={{ flexBasis: 300 }}>
            {me && (
              <div className="tn-navy">
                <span className="tn-mono" style={{ fontSize: 12, color: '#8ec5ff' }}>your_position</span>
                <div className="tn-big" style={{ fontSize: 56, margin: '8px 0' }}>#{me.rank}</div>
                <p style={{ color: '#cfe0ff' }}>{me.rank <= 3 ? 'You’re on the podium!' : third ? `${third.totalScore - me.totalScore} pts behind the podium` : ''}</p>
                {me.rank > 3 && <span className="tn-hand" style={{ fontSize: 24, color: 'var(--tn-yellow)' }}>one strong mission could do it!</span>}
              </div>
            )}
            <div className="tn-card tn-stack">
              <h2 style={{ fontSize: 22 }}>How scoring works</h2>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--tn-ink-2)' }}><b>Videos</b> · full points on time, −1 per late day</p>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--tn-ink-2)' }}><b>Quizzes</b> · marks per correct answer, one attempt</p>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--tn-ink-2)' }}><b>Projects</b> · scored by your mentor</p>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--tn-ink-2)' }}><b>Ties</b> · broken by streak, then recent activity</p>
            </div>
          </aside>
        </section>
      )}
    </main>
  );
}
