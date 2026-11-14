'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import { completeVideo, formatDate, getDashboard, getLeaderboard, getMySessions, getReminders, sendFeedback, timeLeft } from '@/lib/api';
import { ErrorBox, Loading } from '@/components/ui/Brand';
import Icon from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import Tour from '@/components/onboarding/Tour';
import InfoTip from '@/components/onboarding/InfoTip';
import VideoModal from '@/components/classes/VideoModal';
import VideoThumb from '@/components/classes/VideoThumb';
import { fmtDay, fmtTime } from '@/components/classes/media';

const TYPE = {
  video: { icon: 'play', bg: 'var(--tn-yellow)', color: 'var(--tn-navy)', label: 'Video', how: 'watch, then tap “Mark as done”' },
  quiz: { icon: 'quiz', bg: 'var(--tn-sky)', color: 'var(--tn-navy)', label: 'Quiz', how: 'timed · one attempt' },
  project: { icon: 'code', bg: '#C9F5DF', color: 'var(--tn-navy)', label: 'Project', how: 'submit a GitHub link · mentor scores it' },
};
const ORDER = { overdue: 0, available: 1, pending_review: 2, upcoming: 3, completed: 4, closed: 5, locked: 6 };
const GUIDE_KEY = 'tn_launchpad_guide_hidden';

const TOUR = [
  { id: 'guide', title: 'Welcome to your Launchpad', text: 'This is your home base. Everything you need to do for your cohort lives here.' },
  { id: 'stats', title: 'Your numbers, explained', text: 'Points, streak, rank and your next deadline. Tap any (i) for a plain-language explanation.' },
  { id: 'modules', title: 'Modules → sub-topics → missions', text: 'Your cohort is split into modules. Each module has sub-topics, and each sub-topic has a few missions. Work top to bottom; some sub-topics unlock only after the previous one.' },
  { id: 'next', title: 'Not sure what to do?', text: 'This card always shows the single best thing to do next.' },
  { id: 'legend', title: 'What the labels mean', text: 'Three kinds of missions and the status labels you’ll see on them.' },
];

export default function Launchpad() {
  const { ready } = useAuth('mentee');
  const toast = useToast();
  const [data, setData] = useState(null);
  const [board, setBoard] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [guide, setGuide] = useState(false);
  const [tour, setTour] = useState(false);
  const [openMods, setOpenMods] = useState({});
  const [reminders, setReminders] = useState(null);
  const [classes, setClasses] = useState(null);
  const [video, setVideo] = useState(null);
  const closeVideo = useCallback(() => setVideo(null), []);

  const load = useCallback(async () => {
    setError('');
    try {
      const d = await getDashboard();
      setData(d);
      getLeaderboard(d.programs?.[0]?._id).then(setBoard).catch(() => setBoard([]));
      getReminders().then(setReminders).catch(() => setReminders(null));
      getMySessions().then(setClasses).catch(() => setClasses(null));
    } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => { if (ready) load(); }, [ready, load]);
  useEffect(() => { try { setGuide(localStorage.getItem(GUIDE_KEY) !== '1'); } catch { setGuide(true); } }, []);
  const closeTour = useCallback(() => setTour(false), []);
  const hideGuide = () => { setGuide(false); try { localStorage.setItem(GUIDE_KEY, '1'); } catch { /* ignore */ } };

  const view = useMemo(() => {
    if (!data) return null;
    const all = data.programs.flatMap((p) => p.resources.map((r) => ({ ...r, programName: p.name })));
    const byId = new Map(all.map((r) => [String(r._id), r]));
    const sorted = [...all].sort((a, b) => (ORDER[a.status] - ORDER[b.status]) || (new Date(a.closesAt || a.deadline || 8.64e15) - new Date(b.closesAt || b.deadline || 8.64e15)));
    const actionable = sorted.filter((r) => r.status === 'available' || r.status === 'overdue');
    // Prefer the first open mission in the current sub-topic, then the most urgent.
    let next = null;
    for (const p of data.programs) {
      for (const m of p.modules || []) {
        const cur = m.subtopics.find((s) => s.state === 'current');
        if (cur) { next = cur.resourceIds.map((id) => byId.get(id)).find((r) => r && (r.status === 'available' || r.status === 'overdue')); if (next) break; }
      }
      if (next) break;
    }
    next = next || actionable.find((r) => r.closesAt || r.deadline) || actionable[0] || null;
    const done = all.filter((r) => r.completed);
    return { all: sorted, byId, next, done, nextLeft: next ? timeLeft(next.closesAt || next.deadline) : null };
  }, [data]);

  async function onVideo(r) {
    if (r.url) window.open(r.url, '_blank', 'noopener');
    setBusyId(r._id);
    try {
      const res = await completeVideo(r._id);
      toast(`+${res.score} pts${res.latePenalty ? ` (−${res.latePenalty} late)` : ''} · streak ${res.streak} days`);
      load();
    } catch (e) { toast(e.message, 'error'); } finally { setBusyId(null); }
  }

  if (!ready) return null;
  if (error) return <main className="tn-wrap"><ErrorBox message={error} onRetry={load} /></main>;
  if (!data || !view) return <main className="tn-wrap"><Loading rows={4} /></main>;

  const first = data.name.split(' ')[0];
  const program = data.programs[0];
  const top = board.slice(0, 3);
  const me = board.find((b) => String(b.id) === String(data.id));
  const nl = view.nextLeft;
  const isModOpen = (m) => (openMods[m._id] !== undefined ? openMods[m._id] : m.subtopics.some((s) => s.state === 'current'));

  return (
    <main className="tn-wrap" style={{ gap: 26 }}>
      {guide ? (
        <section className="tn-navy" data-tour="guide" style={{ padding: '24px 26px', borderRadius: 22, boxShadow: '5px 5px 0 var(--tn-blue)', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="tn-between" style={{ alignItems: 'flex-start' }}>
            <div className="tn-stack" style={{ gap: 6 }}>
              <span className="tn-mono" style={{ fontSize: 12, color: 'var(--tn-yellow)' }}>first_time_here.md</span>
              <h1 style={{ fontSize: 'clamp(24px, 3vw, 32px)', color: '#fff' }}>Welcome to your Launchpad, {first}! Here’s how it works.</h1>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="tn-btn yellow" onClick={() => setTour(true)}>Take the 1-min tour</button>
              <button className="tn-btn ghost-light" onClick={hideGuide}>Got it, hide this</button>
            </div>
          </div>
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[['Open a mission', 'Missions live inside modules → sub-topics, in order.'], ['Finish before the deadline', 'Videos, quizzes and projects each work a bit differently.'], ['Earn points, climb the board', 'Points and streaks also build your AI card.']].map(([t, d], i) => (
              <li key={t} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flex: '1 1 220px' }}>
                <span style={{ width: 32, height: 32, flex: 'none', borderRadius: '50%', background: 'var(--tn-yellow)', color: 'var(--tn-navy)', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{i + 1}</span>
                <span className="tn-stack" style={{ gap: 2 }}><b style={{ color: '#fff', fontSize: 15 }}>{t}</b><span style={{ color: '#cfe0ff', fontSize: 13, lineHeight: 1.4 }}>{d}</span></span>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <section className="tn-between" data-tour="guide">
          <div className="tn-stack" style={{ gap: 6 }}>
            <span className="tn-eyebrow">~/{(program?.name || 'techneeds').toLowerCase().replace(/\s+/g, '_')} $ whoami</span>
            <h1 style={{ fontSize: 'clamp(28px, 4vw, 40px)' }}>Hey {first}, ready to <span className="tn-hl">upgrade</span> today?</h1>
          </div>
          <button className="tn-btn sm" onClick={() => setTour(true)}><Icon name="info" size={16} /> How this page works</button>
        </section>
      )}

      <section aria-label="Your stats" className="tn-grid-auto" data-tour="stats">
        <Stat label="POINTS" value={data.totalScore.toLocaleString('en-IN')} explain="Earned from missions. More points = higher rank."
          tip="are what you earn for finishing missions. Videos and projects lose 1 point per day if submitted late." />
        <Stat label="STREAK" value={`${data.streak || 0} day${data.streak === 1 ? '' : 's'}`} explain="Days in a row you finished something." bg="var(--tn-yellow)"
          tip="= days in a row you finished at least one mission. Miss a day and it restarts, so small daily steps count!" />
        <Stat label="RANK" value={`#${data.rank} of ${data.totalMentees}`} explain="Your place on the leaderboard."
          tip="is your position by total points. Ties go to the longer streak." />
        <Stat label="NEXT DEADLINE" value={nl && !nl.past ? nl.txt : '—'} explain={view.next ? `${view.next.title} · ${TYPE[view.next.type]?.label.toLowerCase()}` : 'Nothing due right now'} bg="var(--tn-orange-bg)"
          tip="is the closest due date among your open missions." />
      </section>

      <section className="tn-launch-grid">
        <div className="tn-stack" style={{ gap: 16 }} data-tour="modules">
          {data.programs.map((p) => (
            <div key={p._id} className="tn-stack" style={{ gap: 16 }}>
              <div className="tn-between" style={{ alignItems: 'flex-end' }}>
                <div className="tn-stack" style={{ gap: 6 }}>
                  <span className="tn-eyebrow">your_path · {p.name}</span>
                  <h2 style={{ fontSize: 32 }}>Modules</h2>
                  <span style={{ fontSize: 15, color: 'var(--tn-ink-2)' }}>Each module has sub-topics; each sub-topic has a few missions. Work top to bottom.</span>
                </div>
                <span className="tn-mono" style={{ fontSize: 13 }}>overall · <b>{p.resources.filter((r) => r.completed).length} / {p.resources.length} missions</b></span>
              </div>
              {(p.modules || []).length === 0 && <div className="tn-empty">Your mentor hasn’t organised missions into modules yet. They’re listed below.</div>}
              {(p.modules || []).map((m, mi) => {
                const open = isModOpen(m);
                const upcoming = m.startsAt && new Date(m.startsAt) > new Date() && m.done === 0;
                return (
                  <div key={m._id} className="tn-card" style={{ padding: 0, overflow: 'hidden', borderStyle: upcoming ? 'dashed' : 'solid', boxShadow: upcoming ? 'none' : undefined }}>
                    <button className="tn-module-head" aria-expanded={open} onClick={() => setOpenMods({ ...openMods, [m._id]: !open })} style={{ borderBottom: open ? 'var(--border)' : 0 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: 'var(--tn-blue)', width: 44 }}>{String(mi + 1).padStart(2, '0')}</span>
                      <span className="tn-stack" style={{ gap: 4, flex: 1, minWidth: 0, textAlign: 'left' }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22 }}>{m.title}</span>
                        <span className="tn-muted" style={{ fontSize: 13 }}>{m.subtopics.length} sub-topics · {m.total} missions{m.description ? ` · ${m.description}` : ''}</span>
                      </span>
                      <span className="tn-modbar" aria-hidden="true"><span style={{ width: `${m.pct}%`, background: m.pct === 100 ? '#3DDC97' : 'var(--tn-blue)' }} /></span>
                      <span className="tn-mono" style={{ fontSize: 13, fontWeight: 700, width: 44, textAlign: 'right' }}>{m.pct}%</span>
                      <Icon name={open ? 'up' : 'down'} size={22} />
                    </button>
                    {open && (
                      <ol style={{ listStyle: 'none', margin: 0, padding: '20px 22px 4px' }}>
                        {m.subtopics.map((st, si) => (
                          <Subtopic key={st._id} num={`${mi + 1}.${si + 1}`} st={st} resources={st.resourceIds.map((id) => view.byId.get(id)).filter(Boolean)} onVideo={onVideo} busyId={busyId} nextId={view.next?._id} toast={toast} onPlay={setVideo} recordings={(classes?.recordings || []).filter((r) => String(r.subtopic || '') === String(st._id))} />
                        ))}
                        {m.looseResourceIds?.length > 0 && (
                          <li className="tn-stack" style={{ gap: 10, paddingBottom: 18 }}>
                            <b style={{ fontSize: 15 }}>Other missions in this module</b>
                            {m.looseResourceIds.map((id) => view.byId.get(id)).filter(Boolean).map((r) => <MissionRow key={r._id} r={r} onVideo={onVideo} busy={busyId === r._id} urgent={view.next?._id === r._id} toast={toast} />)}
                          </li>
                        )}
                      </ol>
                    )}
                  </div>
                );
              })}
              {p.unplacedResourceIds?.length > 0 && (
                <div className="tn-stack" style={{ gap: 10 }}>
                  <h3 style={{ fontSize: 20 }}>{(p.modules || []).length ? 'More missions' : 'Missions'}</h3>
                  {p.unplacedResourceIds.map((id) => view.byId.get(id)).filter(Boolean).sort((a, b) => ORDER[a.status] - ORDER[b.status]).map((r) => <MissionRow key={r._id} r={r} onVideo={onVideo} busy={busyId === r._id} urgent={view.next?._id === r._id} toast={toast} />)}
                </div>
              )}
            </div>
          ))}
        </div>

        <aside className="tn-stack" style={{ gap: 20 }}>
          {classes?.next && (
            <div className="tn-card" style={{ background: 'var(--tn-sky)', display: 'flex', flexDirection: 'column', gap: 8 }} aria-label="Next live class">
              <div className="tn-between" style={{ gap: 8 }}>
                <span className="tn-mono" style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>{classes.next.status === 'live' ? <><span className="tn-live-dot" /> live_now</> : 'next_live_class'}</span>
                <Link href="/classes" style={{ fontSize: 13, fontWeight: 700 }}>Calendar</Link>
              </div>
              <b style={{ fontSize: 18 }}>{classes.next.title}</b>
              <span style={{ fontSize: 14 }}>{fmtDay(classes.next.startsAt)} · {fmtTime(classes.next.startsAt)}{classes.next.status === 'upcoming' && timeLeft(classes.next.startsAt) ? ` · in ${timeLeft(classes.next.startsAt).txt}` : ''}</span>
              {classes.next.meetUrl && <a className="tn-btn sm primary" style={{ alignSelf: 'flex-start' }} href={classes.next.meetUrl} target="_blank" rel="noopener noreferrer"><Icon name="video" size={16} color="#fff" /> Join Google Meet</a>}
            </div>
          )}
          {reminders?.items?.length > 0 && (
            <div className="tn-card" style={{ background: 'var(--tn-orange-bg)', display: 'flex', flexDirection: 'column', gap: 10 }} aria-label="Today's reminders">
              <div className="tn-between" style={{ gap: 8 }}>
                <span className="tn-mono" style={{ fontSize: 12, fontWeight: 700 }}>todays_reminders</span>
                <span className="tn-mono" style={{ fontSize: 11, color: 'var(--tn-ink-2)' }} title="Generated each morning by the daily digest job">⚙ daily digest{reminders.via === 'render-workflows' ? ' · Render Workflows' : ''}</span>
              </div>
              {reminders.items.slice(0, 4).map((it) => {
                const l = timeLeft(it.dueAt);
                return (
                  <div key={String(it.resource)} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14 }}>
                    <span className="tn-ico sm" style={{ background: TYPE[it.type]?.bg || '#fff' }}><Icon name={TYPE[it.type]?.icon || 'play'} size={16} /></span>
                    <span style={{ flex: 1, minWidth: 0 }}><b>{it.title}</b><br /><span style={{ fontSize: 12, color: it.overdue ? '#B4232C' : 'var(--tn-ink-2)', fontWeight: 700 }}>{it.overdue ? `Overdue${l ? ` by ${l.txt}` : ''} · −1 pt per day` : l && !l.past ? `Due in ${l.txt}` : 'Due soon'}</span></span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="tn-card yellow" data-tour="next" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="tn-mono" style={{ fontSize: 12, fontWeight: 700 }}>your_next_step</span>
            {view.next ? (
              <>
                <h3 style={{ fontSize: 24 }}>{view.next.type === 'video' ? 'Watch' : view.next.type === 'quiz' ? 'Take' : 'Build'} “{view.next.title}”</h3>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>Worth up to {view.next.maxScore} pts{nl && !nl.past ? `, due in ${nl.txt}` : nl?.past ? ', overdue: submit soon to keep most of the points' : ''}. {TYPE[view.next.type]?.how}.</p>
                <MissionAction r={view.next} onVideo={onVideo} busy={busyId === view.next._id} dark />
              </>
            ) : <><h3 style={{ fontSize: 22 }}>You’re all caught up 🎉</h3><p style={{ margin: 0, fontSize: 15 }}>New missions appear here as your mentor adds them.</p></>}
          </div>
          <div className="tn-card" data-tour="legend" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ fontSize: 20 }}>Three kinds of missions</h3>
            {[['video', 'Watch it, then tap Mark as done. Points right away.'], ['quiz', 'Timed, one attempt. Opens and closes on set dates.'], ['project', 'Build it, submit a GitHub link, your mentor scores it.']].map(([k, d]) => (
              <div key={k} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span className="tn-ico sm" style={{ background: TYPE[k].bg }}><Icon name={TYPE[k].icon} size={18} /></span>
                <span className="tn-stack" style={{ gap: 2 }}><b style={{ fontSize: 14 }}>{TYPE[k].label}</b><span style={{ fontSize: 13, color: 'var(--tn-ink-2)', lineHeight: 1.4 }}>{d}</span></span>
              </div>
            ))}
            <h3 style={{ fontSize: 20, marginTop: 6 }}>What the labels mean</h3>
            {[['open', '#fff', 'Ready to start now'], ['due soon', 'var(--tn-orange-bg)', 'Deadline within 2 days'], ['overdue', '#FFD1DC', 'Still allowed, −1 point per day late'], ['in review', 'var(--tn-sky)', 'Submitted, mentor is checking'], ['locked', '#e8f0ff', 'Finish the earlier sub-topic first']].map(([l, bg, d]) => (
              <div key={l} className="tn-between" style={{ gap: 10 }}><span className="tn-chipx" style={{ background: bg }}>{l}</span><span style={{ fontSize: 13, color: 'var(--tn-ink-2)', textAlign: 'right' }}>{d}</span></div>
            ))}
          </div>
          <div className="tn-card">
            <div className="tn-between" style={{ marginBottom: 12 }}><h3 style={{ fontSize: 20 }}>Top of the board</h3><Link href="/leaderboard" style={{ fontSize: 13, fontWeight: 700 }}>All</Link></div>
            <div className="tn-stack">
              {top.map((b) => <BoardRow key={b.id} b={b} me={String(b.id) === String(data.id)} />)}
              {me && me.rank > 3 && <BoardRow b={me} me />}
              {board.length === 0 && <p className="tn-muted" style={{ fontSize: 14 }}>No scores yet.</p>}
            </div>
          </div>
          <Link href="/faq" style={{ fontWeight: 700, fontSize: 14 }}>Still confused? Read the FAQ or ask your mentor →</Link>
        </aside>
      </section>

      <Tour steps={TOUR} open={tour} onClose={closeTour} />
      <VideoModal video={video} onClose={closeVideo} />
    </main>
  );
}

function Stat({ label, value, explain, tip, bg = '#fff' }) {
  return (
    <div className="tn-card" style={{ background: bg, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div className="tn-between" style={{ gap: 6 }}><span className="tn-label" style={{ color: 'var(--tn-navy)' }}>{label}</span><InfoTip label={label.charAt(0) + label.slice(1).toLowerCase()}>{tip}</InfoTip></div>
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 30, lineHeight: 1.1 }}>{value}</span>
      <span style={{ fontSize: 13, color: 'var(--tn-ink-2)' }}>{explain}</span>
    </div>
  );
}

function Subtopic({ num, st, resources, onVideo, busyId, nextId, toast, onPlay, recordings = [] }) {
  const [showRefs, setShowRefs] = useState(false);
  const mark = st.state === 'done'
    ? <span className="tn-stmark" style={{ background: 'var(--tn-blue)' }}><Icon name="check" size={16} color="#fff" stroke={3} /></span>
    : st.state === 'current'
      ? <span className="tn-stmark" style={{ background: 'var(--tn-yellow)', borderWidth: 2.5 }}>●</span>
      : st.state === 'locked'
        ? <span className="tn-stmark" style={{ background: '#fff', borderStyle: 'dashed', borderColor: '#9fb4d8' }}><Icon name="lock" size={14} color="#9fb4d8" /></span>
        : <span className="tn-stmark" style={{ background: '#fff' }} />;
  const tag = { done: ['done', '#C9F5DF'], current: ['you are here', 'var(--tn-yellow)'], locked: ['finish the previous one first', '#fff'], open: [`${st.done}/${st.total} done`, '#fff'] }[st.state];
  const expanded = st.state === 'current' || st.state === 'open';
  return (
    <li style={{ display: 'flex', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>{mark}<span className="tn-stline" /></div>
      <div className="tn-stack" style={{ flex: 1, minWidth: 0, gap: 10, paddingBottom: 18 }}>
        <div className="tn-between" style={{ gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}><span className="tn-mono" style={{ color: 'var(--tn-blue)' }}>{num}</span>&nbsp; {st.title}</span>
          <span className="tn-chipx" style={{ background: tag[1] }}>{tag[0]}</span>
        </div>
        {st.description && expanded && <span style={{ fontSize: 14, color: 'var(--tn-ink-2)' }}>{st.description}</span>}
        {expanded
          ? resources.map((r) => <MissionRow key={r._id} r={r} onVideo={onVideo} busy={busyId === r._id} urgent={nextId === r._id} toast={toast} />)
          : <span className="tn-muted" style={{ fontSize: 13 }}>{st.total} mission{st.total === 1 ? '' : 's'}{st.state === 'done' ? ` · ${resources.reduce((s, r) => s + (r.score || 0), 0)} pts earned` : ''}</span>}
        {(st.references?.length > 0 || recordings.length > 0) && (expanded || showRefs ? (
          <div className="tn-stack" style={{ gap: 8, background: 'var(--tn-paper)', border: '2px dashed #9fb4d8', borderRadius: 14, padding: '12px 12px 4px' }}>
            <div className="tn-between" style={{ gap: 8 }}>
              <span className="tn-mono" style={{ fontSize: 12, fontWeight: 700 }}>📺 learn_more · {[st.references?.length ? `${st.references.length} reference video${st.references.length === 1 ? '' : 's'}` : '', recordings.length ? `${recordings.length} class recording${recordings.length > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ')}</span>
              {!expanded && <button className="tn-mini" style={{ padding: '0 8px' }} onClick={() => setShowRefs(false)}>hide</button>}
            </div>
            <span className="tn-muted" style={{ fontSize: 12 }}>Hand-picked by your mentors. Optional, no points: watch them if a mission feels hard.</span>
            <div className="tn-refstrip">
              {recordings.map((r) => <VideoThumb key={r._id} tag="CLASS" width={200} video={{ title: r.title, url: r.recording.url, channel: `Recorded class · ${fmtDay(r.startsAt)}`, notes: r.recordingNotes }} onPlay={onPlay} />)}
              {(st.references || []).map((v) => <VideoThumb key={v._id} width={200} video={v} onPlay={onPlay} />)}
            </div>
          </div>
        ) : (
          <button className="tn-mini" style={{ alignSelf: 'flex-start', padding: '2px 10px' }} onClick={() => setShowRefs(true)}>📺 {(st.references?.length || 0) + recordings.length} videos to learn more</button>
        ))}
      </div>
    </li>
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

function MissionAction({ r, onVideo, busy, dark }) {
  const cls = dark ? 'tn-btn dark' : 'tn-btn sm primary';
  const style = dark ? { alignSelf: 'flex-start' } : undefined;
  if (r.type === 'video') return <button className={cls} style={style} onClick={() => onVideo(r)} disabled={busy}>{busy ? 'Saving…' : <><Icon name="play" size={16} color="#fff" /> Watch + mark done</>}</button>;
  if (r.type === 'quiz') return <Link href={`/dashboard/quiz/${r._id}`} className={cls} style={style}>Start quiz</Link>;
  return <Link href={`/dashboard/project/${r._id}`} className={cls} style={style}>Submit project</Link>;
}

function RateMission({ r, toast }) {
  const [done, setDone] = useState(false);
  if (done) return <span className="tn-mono" style={{ fontSize: 11, color: 'var(--tn-green)' }}>thanks!</span>;
  const rate = async (rating) => {
    try { await sendFeedback({ source: 'mission', resource: r._id, rating }); setDone(true); } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} aria-label={`Rate ${r.title}`}>
      <span className="tn-label" style={{ marginRight: 2 }}>helpful?</span>
      <button className="tn-mini" aria-label="Yes, helpful" onClick={() => rate(5)}>👍</button>
      <button className="tn-mini" aria-label="Not really" onClick={() => rate(2)}>👎</button>
    </span>
  );
}

function MissionRow({ r, urgent, onVideo, busy, toast }) {
  const t = TYPE[r.type] || TYPE.video;
  const left = timeLeft(r.closesAt || r.deadline);
  const meta = [t.label, r.questionCount ? `${r.questionCount} questions` : null, r.maxScore !== undefined ? `up to ${r.maxScore} pts` : null, t.how].filter(Boolean).join(' · ');
  let chip = ['open', '#fff'];
  let sub = null;
  let action = null;
  let locked = false;

  if (r.status === 'completed') {
    chip = ['done', '#C9F5DF'];
    sub = <span style={{ fontSize: 13, color: 'var(--tn-green)' }}>Done {formatDate(r.completedOn)}{r.feedback ? ` · mentor: “${r.feedback}”` : ''}</span>;
    action = <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}><b style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--tn-green)' }}>+{r.score}</b>{toast && <RateMission r={r} toast={toast} />}</span>;
  } else if (r.status === 'pending_review') {
    chip = ['in review', 'var(--tn-sky)'];
    sub = <span style={{ fontSize: 13, color: 'var(--tn-muted)' }}>Submitted · waiting for your mentor’s score</span>;
  } else if (r.status === 'upcoming') {
    locked = true; chip = [`opens ${formatDate(r.opensAt)}`, 'var(--tn-sky)'];
    sub = <span style={{ fontSize: 13, color: 'var(--tn-muted)' }}>Opens {formatDate(r.opensAt)}</span>;
  } else if (r.status === 'closed' || r.status === 'locked') {
    locked = true; chip = [r.status === 'closed' ? 'closed' : 'locked', '#e8f0ff'];
    sub = <span style={{ fontSize: 13, color: 'var(--tn-muted)' }}>{r.status === 'closed' ? 'This quiz has closed' : r.lockedReason === 'previous_subtopic' ? 'Finish the previous sub-topic to unlock' : 'Locked by your mentor'}</span>;
  } else {
    const late = r.status === 'overdue';
    const soon = left && !left.past && left.ms < 2 * 86400000;
    chip = late ? ['overdue', '#FFD1DC'] : soon ? ['due soon', 'var(--tn-orange-bg)'] : ['open', '#fff'];
    sub = left && <span style={{ fontSize: 13, fontWeight: 700, color: late || soon ? 'var(--tn-orange)' : 'var(--tn-muted)' }}>{late ? `Overdue by ${left.txt} · −1 pt per day late` : `Due in ${left.txt}`}</span>;
    action = <MissionAction r={r} onVideo={onVideo} busy={busy} />;
  }

  return (
    <div className={`tn-mrow ${urgent ? 'urgent' : ''} ${locked ? 'locked' : ''}`}>
      <span className="tn-ico" style={{ background: locked ? '#e6ecf7' : t.bg, borderStyle: locked ? 'dashed' : 'solid' }}>
        <Icon name={locked ? 'lock' : r.status === 'completed' ? 'check' : t.icon} color={locked ? 'var(--tn-muted)' : 'var(--tn-navy)'} size={22} />
      </span>
      <div className="tn-stack" style={{ gap: 3, flex: 1, minWidth: 0 }}>
        {urgent && <span className="tn-mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--tn-blue-ink)' }}>▶ DO THIS ONE FIRST</span>}
        <span style={{ fontWeight: 700, fontSize: 15, color: locked ? 'var(--tn-muted)' : undefined }}>{r.title}</span>
        <span style={{ fontSize: 13, color: 'var(--tn-muted)' }}>{meta}</span>
        {sub}
      </div>
      <span className="tn-chipx" style={{ background: chip[1] }}>{chip[0]}</span>
      {action}
    </div>
  );
}
