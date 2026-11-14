'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createSession, deleteSession, getModules, getSessions, updateSession } from '@/lib/api';
import { ErrorBox, Loading } from '@/components/ui/Brand';
import Icon from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import ClassCard from '@/components/classes/ClassCard';
import MonthCalendar from '@/components/classes/MonthCalendar';
import VideoModal from '@/components/classes/VideoModal';
import { dayKey, fmtDay } from '@/components/classes/media';

const pad = (n) => String(n).padStart(2, '0');
const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const blank = (day = new Date()) => ({ kind: 'live', title: '', date: toDateInput(day), time: '19:00', durationMin: 60, meetUrl: '', recordingUrl: '', recordingNotes: '', place: '', agenda: '' });

export default function ClassesManager({ program }) {
  const toast = useToast();
  const [sessions, setSessions] = useState(null);
  const [mods, setMods] = useState([]);
  const [error, setError] = useState('');
  const [day, setDay] = useState(() => new Date());
  const [f, setF] = useState(() => blank());
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [recDraft, setRecDraft] = useState({});
  const [video, setVideo] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const [s, m] = await Promise.all([getSessions(program._id), getModules(program._id)]);
      setSessions(s); setMods(m.modules || []);
    } catch (e) { setError(e.message); }
  }, [program._id]);
  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const pick = (d) => { setDay(d); if (!editing) setF((x) => ({ ...x, date: toDateInput(d) })); };
  const reset = () => { setEditing(null); setF(blank(day)); };

  function edit(s) {
    const d = new Date(s.startsAt);
    setEditing(s._id);
    setF({ kind: s.meetUrl ? 'live' : 'recording', title: s.title, date: toDateInput(d), time: toTimeInput(d), durationMin: s.durationMin, meetUrl: s.meetUrl || '', recordingUrl: s.recordingUrl || '', recordingNotes: s.recordingNotes || '', place: s.module ? `${s.module}:${s.subtopic || ''}` : '', agenda: s.agenda || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const [module, subtopic] = f.place ? f.place.split(':') : ['', ''];
      const body = {
        title: f.title, agenda: f.agenda, startsAt: new Date(`${f.date}T${f.time}`).toISOString(), durationMin: Number(f.durationMin),
        meetUrl: f.kind === 'live' ? f.meetUrl : '', recordingUrl: f.recordingUrl, recordingNotes: f.recordingNotes,
        module: module || null, subtopic: subtopic || null,
      };
      if (editing) { await updateSession(editing, body); toast('Class updated'); } else { await createSession(program._id, body); toast(f.kind === 'live' ? 'Class scheduled: mentees can see it now' : 'Recorded lecture added'); }
      reset();
      load();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  const act = async (fn, msg) => { try { await fn(); toast(msg); load(); } catch (err) { toast(err.message, 'error'); } };
  const upcoming = useMemo(() => (sessions || []).filter((s) => s.status === 'upcoming' || s.status === 'live'), [sessions]);
  const past = useMemo(() => (sessions || []).filter((s) => s.status === 'ended' || s.status === 'cancelled').reverse(), [sessions]);
  const dayList = (sessions || []).filter((s) => dayKey(s.startsAt) === dayKey(day));

  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!sessions) return <Loading rows={4} />;

  const actions = (s) => (
    <>
      <button className="tn-btn sm" aria-label={`Edit ${s.title}`} onClick={() => edit(s)}><Icon name="edit" size={16} /></button>
      {s.status === 'upcoming' && <button className="tn-btn sm" onClick={() => act(() => updateSession(s._id, { cancelled: true }), 'Class cancelled')}>Cancel</button>}
      {s.status === 'cancelled' && <button className="tn-btn sm" onClick={() => act(() => updateSession(s._id, { cancelled: false }), 'Class restored')}>Restore</button>}
      <button className="tn-btn sm" aria-label={`Delete ${s.title}`} onClick={() => { if (window.confirm(`Delete "${s.title}"?`)) act(() => deleteSession(s._id), 'Deleted'); }}><Icon name="trash" size={16} /></button>
    </>
  );

  return (
    <div className="tn-stack" style={{ gap: 26 }}>
      <div className="tn-stack" style={{ gap: 6 }}>
        <span className="tn-eyebrow">mentor@{program.name.toLowerCase().replace(/\s+/g, '_')}:~$ classes --schedule</span>
        <h1 style={{ fontSize: 'clamp(32px, 4vw, 44px)' }}>Classes</h1>
        <span style={{ fontSize: 15, color: 'var(--tn-ink-2)', maxWidth: 780 }}>Plan Google Meet classes on the calendar. Mentees see them right away on their <b>Classes</b> page and Launchpad, with a Join button and “Add to Google Calendar”. After a class, paste the recording link and it lands in their <b>Recorded lectures</b>.</span>
      </div>

      <section className="tn-classes-grid">
        <div className="tn-stack" style={{ gap: 14 }}>
          <MonthCalendar sessions={sessions} selected={day} onPick={pick} />
          <span className="tn-muted" style={{ fontSize: 13 }}>Tip: click a day to plan a class on it.</span>
          {dayList.length > 0 && <><h3 style={{ fontSize: 18 }}>{fmtDay(day)}</h3>{dayList.map((s) => <ClassCard key={s._id} s={s} onPlay={setVideo} actions={actions(s)} compact />)}</>}
        </div>

        <form onSubmit={submit} className="tn-card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="tn-between"><h2 style={{ fontSize: 22 }}>{editing ? 'Edit class' : 'Plan a class'}</h2>{editing && <button type="button" className="tn-btn sm" onClick={reset}>Cancel edit</button>}</div>
          <div role="radiogroup" aria-label="Type" style={{ display: 'flex', gap: 8 }}>
            {[['live', 'Live class (Google Meet)'], ['recording', 'Recorded lecture only']].map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={f.kind === k} className={`tn-btn sm ${f.kind === k ? 'primary' : ''}`} onClick={() => setF({ ...f, kind: k })}>{l}</button>
            ))}
          </div>
          <div className="tn-field"><label htmlFor="cl-t">Title *</label><input id="cl-t" className="tn-input" required value={f.title} onChange={set('title')} placeholder="Doubt clinic: closures & scope" /></div>
          <div className="tn-form-grid">
            <div className="tn-field"><label htmlFor="cl-d">{f.kind === 'live' ? 'Date *' : 'Recorded on *'}</label><input id="cl-d" type="date" className="tn-input" required value={f.date} onChange={set('date')} /></div>
            <div className="tn-field"><label htmlFor="cl-h">Time *</label><input id="cl-h" type="time" className="tn-input" required value={f.time} onChange={set('time')} /></div>
          </div>
          {f.kind === 'live' && (
            <>
              <div className="tn-field"><label htmlFor="cl-du">Duration</label>
                <select id="cl-du" className="tn-select" value={f.durationMin} onChange={set('durationMin')}>{[30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} minutes</option>)}</select>
              </div>
              <div className="tn-field">
                <label htmlFor="cl-m">Google Meet link *</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input id="cl-m" className="tn-input mono" required value={f.meetUrl} onChange={set('meetUrl')} placeholder="https://meet.google.com/abc-defg-hij" />
                  <a className="tn-btn sm" href="https://meet.google.com/new" target="_blank" rel="noopener noreferrer" title="Opens Google Meet: copy the link it gives you and paste it here" style={{ whiteSpace: 'nowrap' }}>Create a Meet ↗</a>
                </div>
                <span className="tn-muted" style={{ fontSize: 12 }}>Click “Create a Meet”, copy the meeting link from Google Meet, paste it here. A code like abc-defg-hij also works.</span>
              </div>
            </>
          )}
          <div className="tn-field"><label htmlFor="cl-p">Topic (shows the class inside that sub-topic)</label>
            <select id="cl-p" className="tn-select" value={f.place} onChange={set('place')}>
              <option value="">General (not tied to a topic)</option>
              {mods.map((m, mi) => (
                <optgroup key={m._id} label={`${mi + 1}. ${m.title}`}>
                  <option value={`${m._id}:`}>{m.title}</option>
                  {m.subtopics.map((st, si) => <option key={st._id} value={`${m._id}:${st._id}`}>{mi + 1}.{si + 1} {st.title}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="tn-field"><label htmlFor="cl-a">Agenda</label><textarea id="cl-a" className="tn-textarea" style={{ minHeight: 70 }} maxLength={1000} value={f.agenda} onChange={set('agenda')} placeholder="What you’ll cover, what to bring" /></div>
          <div className="tn-field"><label htmlFor="cl-r">{f.kind === 'live' ? 'Recording link (add after the class)' : 'Recording link *'}</label>
            <input id="cl-r" className="tn-input mono" required={f.kind === 'recording'} value={f.recordingUrl} onChange={set('recordingUrl')} placeholder="YouTube (unlisted) or Google Drive share link" />
          </div>
          <button className="tn-btn primary" disabled={busy} style={{ alignSelf: 'flex-start' }}>{busy ? 'Saving…' : editing ? 'Save changes' : f.kind === 'live' ? 'Schedule class' : 'Add recorded lecture'}</button>
        </form>
      </section>

      <section className="tn-stack" style={{ gap: 12 }}>
        <h2 style={{ fontSize: 24 }}>Upcoming ({upcoming.length})</h2>
        {upcoming.length === 0 ? <div className="tn-empty">No classes planned. Pick a day on the calendar to schedule one.</div> : upcoming.map((s) => <ClassCard key={s._id} s={s} actions={actions(s)} />)}
      </section>

      <section className="tn-stack" style={{ gap: 12 }}>
        <h2 style={{ fontSize: 24 }}>Past classes &amp; recordings</h2>
        {past.length === 0 && <div className="tn-empty">Nothing yet.</div>}
        {past.map((s) => (
          <div key={s._id} className="tn-stack" style={{ gap: 8 }}>
            <ClassCard s={s} onPlay={setVideo} actions={actions(s)} compact />
            {!s.recording && s.status === 'ended' && (
              <form className="tn-card" style={{ padding: 12, display: 'flex', gap: 8, flexWrap: 'wrap', boxShadow: 'none', borderStyle: 'dashed' }} onSubmit={(e) => { e.preventDefault(); act(() => updateSession(s._id, { recordingUrl: recDraft[s._id] }), 'Recording added: mentees can watch it now'); }}>
                <input className="tn-input mono" style={{ flex: '1 1 320px', minHeight: 38 }} required aria-label={`Recording link for ${s.title}`} placeholder="Paste the recording link (Meet recording on Drive, or YouTube)" value={recDraft[s._id] || ''} onChange={(e) => setRecDraft({ ...recDraft, [s._id]: e.target.value })} />
                <button className="tn-btn sm primary">Add recording</button>
              </form>
            )}
          </div>
        ))}
      </section>
      <VideoModal video={video} onClose={() => setVideo(null)} />
    </div>
  );
}
