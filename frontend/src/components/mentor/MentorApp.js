'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AiCard from '@/components/card/AiCard';
import ModulesEditor from '@/components/mentor/ModulesEditor';
import ClassesManager from '@/components/mentor/ClassesManager';
import CommandDeck from '@/components/core/CommandDeck';
import EventsManager from '@/components/core/EventsManager';
import Inbox from '@/components/core/Inbox';
import Automations from '@/components/automations/Automations';
import WeeklyReport from '@/components/automations/WeeklyReport';
import logo from '@/assets/logo.png';
import {
  addMentee, createQuiz, createResource, deleteResource, formatDate, formatDateTime, getMentorMe, getMyPrograms, getAllPrograms, getModules, getAdminStats, getCohortReport,
  getProgramMentees, getProgramResources, getUnverifiedProjects, logout, resetMenteePassword, verifyProject,
  endorseMentee, getMenteeCard,
} from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { ErrorBox, Loading } from '@/components/ui/Brand';
import Icon from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';

const DAY = 86400000;
const TABS = [
  ['overview', 'Overview', '/mentor'],
  ['crew', 'Crew (mentees)', '/mentor/crew'],
  ['missions', 'Missions (resources)', '/mentor?tab=missions'],
  ['modules', 'Modules', '/mentor?tab=modules'],
  ['classes', 'Classes', '/mentor?tab=classes'],
  ['review', 'Review queue', '/mentor?tab=review'],
];
const CORE_TABS = [
  ['deck', 'Command deck', '/mentor?tab=deck'],
  ['events', 'Events', '/mentor?tab=events'],
  ['inbox', 'Inbox', '/mentor?tab=inbox'],
  ['automations', 'Automations', '/mentor?tab=automations'],
];
const CORE_ONLY = CORE_TABS.map((t) => t[0]);

export function menteeStatus(m) {
  if (!m.lastActiveDate) return 'inactive';
  const days = (Date.now() - new Date(m.lastActiveDate).getTime()) / DAY;
  if (days <= 2) return 'on_track';
  if (days <= 7) return 'nudge';
  return 'inactive';
}
const STATUS_UI = {
  on_track: ['On track', 'yellow'],
  nudge: ['Needs a nudge', 'orange'],
  inactive: ['Inactive', 'grey'],
};
function lastActive(d) {
  if (!d) return 'never';
  const days = Math.floor((Date.now() - new Date(d).getTime()) / DAY);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}

export default function MentorApp({ tab, menteeId }) {
  const { ready } = useAuth('mentor');
  const router = useRouter();
  const toast = useToast();
  const [mentor, setMentor] = useState(null);
  const [programs, setPrograms] = useState(null);
  const [pid, setPid] = useState('');
  const [mentees, setMentees] = useState([]);
  const [resources, setResources] = useState([]);
  const [queue, setQueue] = useState([]);
  const [error, setError] = useState('');
  const [pass, setPass] = useState(null);
  const [openQs, setOpenQs] = useState(0);
  const [report, setReport] = useState(undefined);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      try {
        const me = await getMentorMe();
        // Core team can manage every cohort; regular mentors see their own.
        const progs = me.isCoreTeam ? await getAllPrograms() : await getMyPrograms();
        setMentor(me);
        if (me.isCoreTeam) getAdminStats().then((st) => setOpenQs(st.inbox?.openQueries || 0)).catch(() => {});
        setPrograms(progs);
        let saved = '';
        try { saved = localStorage.getItem('tn_mentor_program') || ''; } catch { /* ignore */ }
        setPid(progs.find((p) => p._id === saved) ? saved : progs[0]?._id || '');
      } catch (e) { setError(e.message); }
    })();
  }, [ready]);

  const loadProgram = useCallback(async () => {
    if (!pid) return;
    try {
      const [m, r, q] = await Promise.all([getProgramMentees(pid), getProgramResources(pid), getUnverifiedProjects()]);
      setMentees(m);
      setResources(r);
      setQueue(q.unverifiedProjects || []);
    } catch (e) { toast(e.message, 'error'); }
    getCohortReport(pid).then(setReport).catch(() => setReport(null));
  }, [pid, toast]);

  useEffect(() => { loadProgram(); }, [loadProgram]);

  const program = programs?.find((p) => p._id === pid);
  const stats = useMemo(() => {
    const avg = mentees.length ? Math.round(mentees.reduce((s, m) => s + (m.progress || 0), 0) / mentees.length) : 0;
    const nudge = mentees.filter((m) => menteeStatus(m) !== 'on_track').length;
    const myQueue = queue.filter((q) => resources.some((r) => String(r._id) === String(q.resourceId)));
    return { avg, nudge, myQueue };
  }, [mentees, queue, resources]);

  if (!ready) return null;
  if (error) return <main className="tn-wrap"><ErrorBox message={error} /></main>;
  if (!programs) return <main className="tn-wrap"><Loading rows={4} /></main>;

  const pickProgram = (id) => { setPid(id); try { localStorage.setItem('tn_mentor_program', id); } catch { /* ignore */ } };
  const first = (mentor?.name || 'Mentor').split(' ')[0];
  const slug = (program?.name || 'cohort').toLowerCase().replace(/\s+/g, '_');

  return (
    <div className="tn-shell">
      <aside className="tn-navy tn-sidebar" aria-label="Mentor navigation">
        <Link href="/mentor" className="tn-logo" style={{ color: '#fff' }}>
          <span className="tn-logo-mark" style={{ borderColor: '#fff', width: 52, height: 52, borderRadius: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo.src} alt="" style={{ width: 42, height: 42 }} />
          </span>
          <span className="tn-logo-text"><b>TechNeeds</b><small style={{ color: '#8ec5ff' }}>mission_control</small></span>
        </Link>
        <div className="tn-field">
          <label htmlFor="cohort" className="tn-mono" style={{ color: '#8ec5ff', fontWeight: 400, fontSize: 12 }}>cohort</label>
          {programs.length ? (
            <select id="cohort" className="tn-select" value={pid} onChange={(e) => pickProgram(e.target.value)}>
              {programs.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          ) : <p style={{ color: '#cfe0ff', fontSize: 14 }}>No cohort assigned yet. Ask the admin to assign you.</p>}
        </div>
        <nav>
          {TABS.map(([key, label, href]) => (
            <button key={key} className={tab === key || (tab === 'card' && key === 'crew') ? 'active' : ''} aria-current={tab === key ? 'page' : undefined} onClick={() => router.push(href)}>
              {label}
              {key === 'review' && stats.myQueue.length > 0 && <span style={{ background: 'var(--tn-yellow)', color: 'var(--tn-navy)', borderRadius: 999, padding: '0 9px', fontWeight: 800, fontSize: 12, lineHeight: '22px' }}>{stats.myQueue.length}</span>}
            </button>
          ))}
        </nav>
        {mentor?.isCoreTeam && (
          <nav aria-label="Core team">
            <span className="tn-mono" style={{ color: 'var(--tn-yellow)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 4px 2px' }}><Icon name="shield" size={14} color="var(--tn-yellow)" /> core team only</span>
            {CORE_TABS.map(([key, label, href]) => (
              <button key={key} className={tab === key ? 'active' : ''} aria-current={tab === key ? 'page' : undefined} onClick={() => router.push(href)}>
                {label}
                {key === 'inbox' && openQs > 0 && <span style={{ background: 'var(--tn-yellow)', color: 'var(--tn-navy)', borderRadius: 999, padding: '0 9px', fontWeight: 800, fontSize: 12, lineHeight: '22px' }}>{openQs}</span>}
              </button>
            ))}
          </nav>
        )}
        <p className="tn-hand" style={{ fontSize: 22, color: '#8ec5ff', lineHeight: 1.2, marginTop: 'auto' }}>“Teach to learn twice.”</p>
        <button className="tn-btn sm ghost-light" onClick={() => { logout(); router.push('/login?role=mentor'); }}><Icon name="logout" size={16} color="#fff" /> Log out</button>
      </aside>

      <main className="tn-shell-main">
        {CORE_ONLY.includes(tab) ? (
          !mentor ? <Loading rows={3} />
            : !mentor.isCoreTeam ? <div className="tn-empty">This section is for the TechNeeds core team. Ask a core-team member if you need access.</div>
              : tab === 'deck' ? <CommandDeck me={mentor} />
                : tab === 'events' ? <EventsManager />
                  : tab === 'automations' ? <Automations />
                    : <Inbox onCount={setOpenQs} />
        ) : !program ? <div className="tn-empty">Once the core team assigns you a cohort, it shows up here.</div> : (
          <>
            {tab === 'overview' && (
              <>
                <div className="tn-between" style={{ alignItems: 'flex-end' }}>
                  <div className="tn-stack" style={{ gap: 6 }}>
                    <span className="tn-eyebrow">mentor@{slug}:~$</span>
                    <h1 style={{ fontSize: 'clamp(32px, 4vw, 44px)' }}>Hi {first}, your crew is <span className="tn-hl">{stats.avg}%</span> through</h1>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button className="tn-btn" onClick={() => router.push('/mentor/crew?add=1')}><Icon name="plus" size={18} /> Add mentee</button>
                    <button className="tn-btn primary" onClick={() => router.push('/mentor?tab=missions')}><Icon name="plus" size={18} color="#fff" /> New mission</button>
                  </div>
                </div>
                <section className="tn-grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
                  <Stat label="crew" value={mentees.length} />
                  <Stat label="missions" value={resources.length} bg="var(--tn-tint)" />
                  <Stat label="need_a_nudge" value={stats.nudge} />
                  <Stat label="to_review" value={stats.myQueue.length} bg="var(--tn-yellow)" />
                </section>
                {report !== undefined && <WeeklyReport report={report} />}
                <section className="tn-row" style={{ gap: 26 }}>
                  <div style={{ flex: '1 1 420px', minWidth: 0 }}><MissionBuilder key={pid} programId={pid} onCreated={loadProgram} /></div>
                  <div style={{ flex: '1 1 420px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 26 }}>
                    <ReviewQueue items={stats.myQueue.slice(0, 3)} onDone={loadProgram} compact />
                    <ResourceHealth resources={resources} />
                  </div>
                </section>
              </>
            )}
            {tab === 'card' && <MenteeCard id={menteeId} />}
            {tab === 'crew' && <Crew program={program} mentees={mentees} resources={resources} onChange={loadProgram} pass={pass} setPass={setPass} />}
            {tab === 'missions' && (
              <>
                <div className="tn-stack" style={{ gap: 6 }}>
                  <span className="tn-eyebrow">mentor@{slug}:~$ ls missions/</span>
                  <h1 style={{ fontSize: 'clamp(32px, 4vw, 44px)' }}>Missions</h1>
                </div>
                <section className="tn-row" style={{ gap: 26 }}>
                  <div style={{ flex: '1 1 420px', minWidth: 0 }}><MissionBuilder key={pid} programId={pid} onCreated={loadProgram} /></div>
                  <div style={{ flex: '1 1 420px', minWidth: 0 }}><MissionList resources={resources} onChange={loadProgram} /></div>
                </section>
              </>
            )}
            {tab === 'modules' && <ModulesEditor program={program} onChange={loadProgram} />}
            {tab === 'classes' && <ClassesManager key={pid} program={program} />}
            {tab === 'review' && (
              <>
                <div className="tn-stack" style={{ gap: 6 }}>
                  <span className="tn-eyebrow">mentor@{slug}:~$ review --pending</span>
                  <h1 style={{ fontSize: 'clamp(32px, 4vw, 44px)' }}>Review queue</h1>
                </div>
                <ReviewQueue items={stats.myQueue} onDone={loadProgram} />
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, bg = '#fff' }) {
  return (
    <div className="tn-card" style={{ background: bg, padding: 18 }}>
      <div className="tn-label" style={{ color: bg === 'var(--tn-yellow)' ? 'var(--tn-navy)' : undefined }}>{label}</div>
      <div className="tn-big" style={{ fontSize: 38, marginTop: 6 }}>{value}</div>
    </div>
  );
}

// ---------------- mission builder ----------------
const emptyQ = () => ({ questionText: '', options: ['', '', '', ''], correctOptionIndex: 0, marks: 2 });

function MissionBuilder({ programId, onCreated }) {
  const toast = useToast();
  const [type, setType] = useState('quiz');
  const [f, setF] = useState({ title: '', url: '', description: '', deadline: '', startTime: '', maxScore: '' });
  const [qs, setQs] = useState([emptyQ()]);
  const [busy, setBusy] = useState(false);
  const [mods, setMods] = useState([]);
  const [place, setPlace] = useState('');
  useEffect(() => { getModules(programId).then((d) => setMods(d.modules || [])).catch(() => setMods([])); }, [programId]);
  const total = qs.reduce((s, q) => s + (Number(q.marks) || 0), 0);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setQ = (i, patch) => setQs(qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const toIso = (v) => (v ? new Date(v).toISOString() : undefined);
      const [module, subtopic] = place ? place.split(':') : [];
      const where = module ? { module, subtopic: subtopic || undefined } : {};
      if (type === 'quiz') {
        const clean = qs.filter((q) => q.questionText.trim() && q.options.filter((o) => o.trim()).length >= 2);
        if (!clean.length) throw new Error('Add at least one question with two options.');
        await createQuiz({ title: f.title, description: f.description, program: programId, startTime: toIso(f.startTime), endTime: toIso(f.deadline), questions: clean, ...where });
      } else {
        await createResource({ title: f.title, type, url: f.url || undefined, description: f.description, deadline: toIso(f.deadline), maxScore: Number(f.maxScore) || (type === 'video' ? 20 : 100), program: programId, ...where });
      }
      toast(`${type === 'quiz' ? 'Quiz' : type === 'video' ? 'Video' : 'Project'} mission launched`);
      setF({ title: '', url: '', description: '', deadline: '', startTime: '', maxScore: '' });
      setQs([emptyQ()]);
      onCreated();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="tn-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontSize: 24 }}>Build a new mission</h2>
      <div role="radiogroup" aria-label="Mission type" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        {[['video', 'Video', 'play'], ['quiz', 'Quiz', 'quiz'], ['project', 'Project', 'code']].map(([k, l, ic]) => (
          <button key={k} type="button" role="radio" aria-checked={type === k} onClick={() => setType(k)}
            style={{ minHeight: 76, borderRadius: 16, border: 'var(--border)', cursor: 'pointer', background: type === k ? 'var(--tn-blue)' : '#fff', color: type === k ? '#fff' : 'var(--tn-navy)', boxShadow: type === k ? '3px 3px 0 var(--tn-navy)' : 'none', font: '700 14px var(--font-body)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <Icon name={ic} size={22} color={type === k ? '#fff' : 'var(--tn-navy)'} />{l}
          </button>
        ))}
      </div>
      <div className="tn-field"><label htmlFor="mt">Title</label><input id="mt" className="tn-input" value={f.title} onChange={set('title')} required placeholder={type === 'quiz' ? 'React Hooks checkpoint' : type === 'video' ? 'State management with Context API' : 'Build a portfolio with Next.js'} /></div>
      {type === 'video' && <div className="tn-field"><label htmlFor="mu">Video link</label><input id="mu" className="tn-input mono" value={f.url} onChange={set('url')} placeholder="https://youtube.com/…" /></div>}
      {type !== 'video' && <div className="tn-field"><label htmlFor="md">{type === 'project' ? 'Brief / checklist (one item per line)' : 'Description'}</label><textarea id="md" className="tn-textarea" style={{ minHeight: 80 }} value={f.description} onChange={set('description')} /></div>}
      <div className="tn-form-grid">
        {type === 'quiz'
          ? <div className="tn-field"><label htmlFor="ms">Unlocks</label><input id="ms" type="datetime-local" className="tn-input" value={f.startTime} onChange={set('startTime')} /></div>
          : <div className="tn-field"><label htmlFor="mx">Max score</label><input id="mx" type="number" min="1" className="tn-input" value={f.maxScore} onChange={set('maxScore')} placeholder={type === 'video' ? '20' : '300'} /></div>}
        <div className="tn-field"><label htmlFor="mdl">Deadline</label><input id="mdl" type="datetime-local" className="tn-input" value={f.deadline} onChange={set('deadline')} required={type === 'quiz'} /></div>
      </div>
      {type === 'quiz' && (
        <div className="tn-stack">
          {qs.map((q, i) => (
            <div key={i} style={{ border: '2px dashed #6f8fbf', borderRadius: 16, padding: 16, background: '#f7faff', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="tn-between">
                <label htmlFor={`q${i}`} style={{ fontWeight: 700, fontSize: 14 }}>Q{i + 1}</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <label htmlFor={`qm${i}`} className="tn-label">pts</label>
                  <input id={`qm${i}`} type="number" min="1" className="tn-input" style={{ width: 70, minHeight: 36 }} value={q.marks} onChange={(e) => setQ(i, { marks: e.target.value })} />
                  {qs.length > 1 && <button type="button" className="tn-btn sm" aria-label={`Remove question ${i + 1}`} onClick={() => setQs(qs.filter((_, j) => j !== i))}><Icon name="trash" size={16} /></button>}
                </div>
              </div>
              <input id={`q${i}`} className="tn-input" placeholder="Question text" value={q.questionText} onChange={(e) => setQ(i, { questionText: e.target.value })} />
              {q.options.map((o, k) => (
                <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="radio" name={`correct${i}`} checked={q.correctOptionIndex === k} onChange={() => setQ(i, { correctOptionIndex: k })} aria-label={`Mark option ${k + 1} correct`} style={{ width: 20, height: 20 }} />
                  <input className="tn-input" style={{ minHeight: 40, background: q.correctOptionIndex === k ? 'var(--tn-tint)' : '#fff' }} placeholder={`Option ${k + 1}`} value={o} onChange={(e) => setQ(i, { options: q.options.map((x, z) => (z === k ? e.target.value : x)) })} />
                </div>
              ))}
            </div>
          ))}
          <button type="button" className="tn-btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setQs([...qs, emptyQ()])}><Icon name="plus" size={16} /> Add question</button>
        </div>
      )}
      <div className="tn-field">
        <label htmlFor="mpl">Where does it go?</label>
        <select id="mpl" className="tn-select" value={place} onChange={(e) => setPlace(e.target.value)}>
          <option value="">Not in a module (shows under “More missions”)</option>
          {mods.map((m, mi) => (
            <optgroup key={m._id} label={`${mi + 1}. ${m.title}`}>
              <option value={`${m._id}:`}>{m.title}, no sub-topic</option>
              {m.subtopics.map((st, si) => <option key={st._id} value={`${m._id}:${st._id}`}>{mi + 1}.{si + 1} {st.title}</option>)}
            </optgroup>
          ))}
        </select>
        {mods.length === 0 && <span className="tn-muted" style={{ fontSize: 12 }}>Tip: create modules in the Modules tab to organise missions.</span>}
      </div>
      <div className="tn-between">
        <span className="tn-mono" style={{ fontSize: 13, color: 'var(--tn-ink-2)' }}>max_score = {type === 'quiz' ? total : f.maxScore || (type === 'video' ? 20 : 100)}</span>
        <button className="tn-btn primary" disabled={busy}>{busy ? 'Launching…' : 'Launch mission'}</button>
      </div>
    </form>
  );
}

// ---------------- mission list ----------------
function MissionList({ resources, onChange }) {
  const toast = useToast();
  async function remove(r) {
    if (!window.confirm(`Delete "${r.title}"? Scores earned on it will be removed.`)) return;
    try { await deleteResource(r._id); toast('Mission deleted'); onChange(); } catch (e) { toast(e.message, 'error'); }
  }
  return (
    <div className="tn-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ fontSize: 24 }}>Published missions</h2>
      {resources.length === 0 && <div className="tn-empty">No missions yet. Launch the first one.</div>}
      {resources.map((r) => (
        <div key={r._id} style={{ border: '2px solid var(--tn-navy)', borderRadius: 14, padding: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`tn-pill ${r.type === 'quiz' ? 'blue' : r.type === 'project' ? 'yellow' : 'cyan'}`}>{r.type}</span>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>{r.title}</div>
            <div className="tn-label">{r.maxScore ?? '–'} pts · {r.deadline ? `due ${formatDateTime(r.deadline)}` : 'no deadline'}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
              <div className="tn-bar thin" style={{ flex: 1 }}><span style={{ width: `${r.completionRate}%` }} /></div>
              <span className="tn-mono" style={{ fontSize: 12 }}>{r.completionRate}% done</span>
            </div>
          </div>
          <button className="tn-btn sm" onClick={() => remove(r)} aria-label={`Delete ${r.title}`}><Icon name="trash" size={16} /></button>
        </div>
      ))}
    </div>
  );
}

function ResourceHealth({ resources }) {
  const low = [...resources].filter((r) => r.deadline && new Date(r.deadline) > Date.now()).sort((a, b) => a.completionRate - b.completionRate).slice(0, 3);
  return (
    <div className="tn-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ fontSize: 22 }}>Open missions</h2>
      {low.length === 0 && <p className="tn-muted" style={{ fontSize: 14 }}>No open missions with deadlines.</p>}
      {low.map((r) => (
        <div key={r._id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="tn-between"><span style={{ fontWeight: 700, fontSize: 15 }}>{r.title}</span><span className="tn-label">due {formatDate(r.deadline)}</span></div>
          <div className="tn-bar thin"><span style={{ width: `${r.completionRate}%` }} /></div>
          <span className="tn-label">{r.completions} done · {r.completionRate}%</span>
        </div>
      ))}
    </div>
  );
}

// ---------------- review queue ----------------
function ReviewQueue({ items, onDone, compact }) {
  const toast = useToast();
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState({});
  async function stamp(it) {
    const key = `${it.menteeId}-${it.resourceId}`;
    const score = Number(scores[key]);
    if (Number.isNaN(score) || scores[key] === undefined || scores[key] === '') { toast('Enter a score first', 'error'); return; }
    try {
      const r = await verifyProject(it.menteeId, it.resourceId, score, notes[key]);
      toast(`Stamped: ${r.finalScore} pts${r.latePenalty ? ` (−${r.latePenalty} late)` : ''}`);
      onDone();
    } catch (e) { toast(e.message, 'error'); }
  }
  return (
    <div className="tn-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="tn-between"><h2 style={{ fontSize: 24 }}>Review queue</h2>{compact && <Link href="/mentor?tab=review" style={{ fontWeight: 700, fontSize: 13 }}>All</Link>}</div>
      {items.length === 0 && <div className="tn-empty">Nothing to review. Nice!</div>}
      {items.map((it) => {
        const key = `${it.menteeId}-${it.resourceId}`;
        return (
          <div key={key} style={{ border: '2px solid var(--tn-navy)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, background: '#f7faff' }}>
            <div className="tn-between"><span style={{ fontWeight: 700 }}>{it.menteeName} · {it.resourceTitle}</span><span className="tn-label">{formatDateTime(it.submittedOn)}</span></div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontWeight: 700, fontSize: 14 }}>
              <a href={it.githubLink} target="_blank" rel="noreferrer">GitHub repo ↗</a>
              <a href={it.deployedLink} target="_blank" rel="noreferrer">Live site ↗</a>
            </div>
            {!compact && it.description && <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--tn-ink-2)' }}>{it.description}</p>}
            {!compact && (
              <div className="tn-field"><label htmlFor={`fb-${key}`}>Feedback (optional)</label><input id={`fb-${key}`} className="tn-input" value={notes[key] || ''} onChange={(e) => setNotes({ ...notes, [key]: e.target.value })} placeholder="What went well, what to improve" /></div>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <label htmlFor={`sc-${key}`} style={{ fontSize: 13, fontWeight: 700 }}>Score</label>
              <input id={`sc-${key}`} type="number" min="0" max={it.maxScore} className="tn-input" style={{ width: 90, minHeight: 42 }} value={scores[key] ?? ''} onChange={(e) => setScores({ ...scores, [key]: e.target.value })} />
              <span className="tn-label">/ {it.maxScore}</span>
              <button className="tn-btn sm yellow" style={{ marginLeft: 'auto', fontWeight: 800 }} onClick={() => stamp(it)}>Stamp it ✓</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------- crew ----------------
function BoardingPass({ pass, onClose }) {
  const toast = useToast();
  if (!pass) return null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(`TechNeeds login\nEnrollment: ${pass.enrollmentNumber}\nPassword: ${pass.tempPassword}\nLog in at ${window.location.origin}/login`); toast('Boarding pass copied'); } catch { toast('Copy failed', 'error'); }
  };
  return (
    <div className="tn-navy" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="tn-between"><h2 style={{ fontSize: 22 }}>Boarding pass generated</h2><button className="tn-link-btn" style={{ color: '#8ec5ff' }} onClick={onClose}>Dismiss</button></div>
      <div className="tn-pass">
        <div>
          <span className="tn-mono" style={{ fontSize: 11, color: '#8ec5ff' }}>PASSENGER</span>
          <span style={{ fontWeight: 700 }}>{pass.name}</span>
          <span className="tn-mono" style={{ fontSize: 11, color: '#8ec5ff', marginTop: 6 }}>ENROLLMENT</span>
          <span className="tn-mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--tn-yellow)' }}>{pass.enrollmentNumber}</span>
        </div>
        <div>
          <span className="tn-mono" style={{ fontSize: 11, color: '#8ec5ff' }}>TEMP PASSWORD</span>
          <span className="tn-mono" style={{ fontSize: 18, fontWeight: 700 }}>{pass.tempPassword}</span>
          <span style={{ fontSize: 12, color: '#cfe0ff' }}>Shown once only. It is stored hashed.</span>
        </div>
      </div>
      <button className="tn-btn cyan sm" style={{ alignSelf: 'flex-start' }} onClick={copy}><Icon name="copy" size={16} /> Copy boarding pass</button>
    </div>
  );
}

function Crew({ program, mentees, onChange, pass, setPass }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', email: '', enrollmentNumber: '', interests: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('add')) setAdding(true);
  }, []);

  const withStatus = mentees.map((m) => ({ ...m, status: menteeStatus(m) }));
  const counts = { all: withStatus.length, on_track: 0, nudge: 0, inactive: 0 };
  withStatus.forEach((m) => { counts[m.status] += 1; });
  const shown = withStatus
    .filter((m) => filter === 'all' || m.status === filter)
    .filter((m) => !q || `${m.name} ${m.enrollmentNumber} ${m.email}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.programScore || 0) - (a.programScore || 0));
  const needy = withStatus.filter((m) => m.status !== 'on_track');

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await addMentee({
        name: f.name, email: f.email, enrollmentNumber: f.enrollmentNumber || undefined, programId: program._id,
        interests: f.interests.split(',').map((s) => s.trim()).filter(Boolean),
      });
      setPass({ name: r.mentee.name, enrollmentNumber: r.enrollmentNumber, tempPassword: r.tempPassword });
      setF({ name: '', email: '', enrollmentNumber: '', interests: '' });
      setAdding(false);
      toast(`${r.mentee.name} added to ${program.name}`);
      onChange();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function reset(m) {
    if (!window.confirm(`Reset ${m.name}'s password? Their old password stops working.`)) return;
    try {
      const r = await resetMenteePassword(m._id);
      setPass({ name: m.name, enrollmentNumber: r.enrollmentNumber, tempPassword: r.tempPassword });
      toast('New password generated');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function copyNeedy() {
    try { await navigator.clipboard.writeText(needy.map((m) => m.email).join(', ')); toast(`${needy.length} emails copied`); } catch { toast('Copy failed', 'error'); }
  }

  const cols = 'minmax(0, 2fr) minmax(0, 1.4fr) 90px 80px 120px 150px 200px';
  return (
    <>
      <div className="tn-between" style={{ alignItems: 'flex-end' }}>
        <div className="tn-stack" style={{ gap: 6 }}>
          <span className="tn-eyebrow">mentor@{program.name.toLowerCase().replace(/\s+/g, '_')}:~$ ls crew/</span>
          <h1 style={{ fontSize: 'clamp(32px, 4vw, 44px)' }}>Your crew <span className="tn-mono tn-muted" style={{ fontSize: 20 }}>{mentees.length} mentees</span></h1>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <label htmlFor="crew-q" className="sr-only">Search mentees</label>
          <input id="crew-q" className="tn-input" style={{ width: 260, minHeight: 48, borderWidth: 2.5 }} placeholder="Search name or TN-…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="tn-btn primary" onClick={() => setAdding((a) => !a)}><Icon name="plus" size={18} color="#fff" /> Add mentee</button>
        </div>
      </div>

      {adding && (
        <form onSubmit={add} className="tn-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 style={{ fontSize: 22 }}>Add a mentee to {program.name}</h2>
          <div className="tn-form-grid">
            <div className="tn-field"><label htmlFor="an">Full name</label><input id="an" className="tn-input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></div>
            <div className="tn-field"><label htmlFor="ae">Email</label><input id="ae" type="email" className="tn-input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></div>
            <div className="tn-field"><label htmlFor="aen">Enrollment number (optional)</label><input id="aen" className="tn-input mono" value={f.enrollmentNumber} onChange={(e) => setF({ ...f, enrollmentNumber: e.target.value })} placeholder="auto-generated if blank" /></div>
            <div className="tn-field"><label htmlFor="ai">Interests (comma separated)</label><input id="ai" className="tn-input" value={f.interests} onChange={(e) => setF({ ...f, interests: e.target.value })} placeholder="react, ui_design" /></div>
          </div>
          <div className="tn-between">
            <span className="tn-hand" style={{ fontSize: 21, color: 'var(--tn-blue-ink)' }}>we generate a secure password ✦</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="tn-btn" onClick={() => setAdding(false)}>Cancel</button>
              <button className="tn-btn primary" disabled={busy}>{busy ? 'Adding…' : 'Add + generate pass'}</button>
            </div>
          </div>
        </form>
      )}

      <BoardingPass pass={pass} onClose={() => setPass(null)} />

      <div className="tn-row" style={{ gap: 20, alignItems: 'stretch' }}>
        <div style={{ flex: '2 1 520px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }} role="group" aria-label="Filter crew">
          {[['all', 'All'], ['on_track', 'On track'], ['nudge', 'Needs a nudge'], ['inactive', 'Inactive']].map(([k, l]) => (
            <button key={k} className={`tn-chip ${filter === k ? 'active' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l} · {counts[k]}</button>
          ))}
        </div>
        {needy.length > 0 && (
          <div className="tn-card yellow" style={{ flex: '1 1 340px', padding: '16px 18px', display: 'flex', gap: 12, alignItems: 'center' }}>
            <Icon name="spark" size={30} />
            <p style={{ flex: 1, fontSize: 14, lineHeight: 1.45 }}><b>AI nudge:</b> {needy.length} mentee{needy.length === 1 ? ' hasn’t' : 's haven’t'} been active in 3+ days.</p>
            <button className="tn-btn sm dark" onClick={copyNeedy}>Copy emails</button>
          </div>
        )}
      </div>

      <div className="tn-scroll-x">
        <div className="tn-stack" style={{ minWidth: 980, gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 14, padding: '0 18px' }} className="tn-label">
            <span>mentee</span><span>progress</span><span>score</span><span>streak</span><span>last_active</span><span>status</span><span />
          </div>
          {shown.length === 0 && <div className="tn-empty">{mentees.length ? 'No mentees match this filter.' : 'No mentees yet. Add your crew to get started.'}</div>}
          {shown.map((m) => {
            const [label, tone] = STATUS_UI[m.status];
            return (
              <div key={m._id} className="tn-rowcard" style={{ gridTemplateColumns: cols, gap: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}><span style={{ fontWeight: 700, fontSize: 15 }}>{m.name}</span><span className="tn-label">{m.enrollmentNumber}</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div className="tn-bar thin" style={{ flex: 1 }}><span style={{ width: `${m.progress}%` }} /></div><span className="tn-mono" style={{ fontSize: 12 }}>{m.progress}%</span></div>
                <span className="tn-mono" style={{ fontWeight: 700, fontSize: 14 }}>{(m.programScore || 0).toLocaleString('en-IN')}</span>
                <span style={{ fontSize: 14 }}>{m.streak || 0}d</span>
                <span className="tn-muted" style={{ fontSize: 13 }}>{lastActive(m.lastActiveDate)}</span>
                <span className={`tn-pill ${tone}`} style={{ justifySelf: 'start', fontFamily: 'var(--font-body)', borderRadius: 999 }}>{label}</span>
                <div style={{ display: 'flex', gap: 8, justifySelf: 'end' }}>
                  <Link href={`/mentor/mentee/${m._id}`} className="tn-btn sm primary"><Icon name="spark" size={16} color="#fff" /> AI card</Link>
                  <button className="tn-btn sm" onClick={() => reset(m)} aria-label={`Reset password for ${m.name}`}><Icon name="key" size={16} /> Reset</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// Mentor view of a mentee's AI card: same card, plus the endorsement editor.
function MenteeCard({ id }) {
  const toast = useToast();
  const [c, setC] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try { setC(await getMenteeCard(id)); } catch (e) { setError(e.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function endorse(text) {
    try {
      const r = await endorseMentee(id, text);
      setC((x) => ({ ...x, endorsement: r.endorsement }));
      toast(r.endorsement ? 'Endorsement saved' : 'Endorsement removed');
    } catch (e) { toast(e.message, 'error'); throw e; }
  }

  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!c) return <Loading rows={4} />;
  return (
    <>
      <div className="tn-between" style={{ alignItems: 'flex-end' }}>
        <div className="tn-stack" style={{ gap: 6 }}>
          <Link href="/mentor/crew" className="tn-mono" style={{ fontSize: 13 }}>← back to crew</Link>
          <h1 style={{ fontSize: 'clamp(28px, 3.4vw, 40px)' }}>{c.me.name}’s AI card</h1>
        </div>
        <span className="tn-pill cyan">mentor view · read only</span>
      </div>
      <AiCard c={c} mode="mentor" onEndorse={endorse} toast={toast} />
    </>
  );
}
