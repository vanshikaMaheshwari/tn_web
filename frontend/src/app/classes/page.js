'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import { getMySessions, timeLeft } from '@/lib/api';
import { ErrorBox, Loading } from '@/components/ui/Brand';
import Icon from '@/components/ui/Icon';
import ClassCard from '@/components/classes/ClassCard';
import MonthCalendar from '@/components/classes/MonthCalendar';
import VideoModal from '@/components/classes/VideoModal';
import VideoThumb from '@/components/classes/VideoThumb';
import { dayKey, fmtDay, fmtTime, googleCalendarUrl } from '@/components/classes/media';

export default function ClassesPage() {
  const { ready } = useAuth('mentee');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [day, setDay] = useState(() => new Date());
  const [video, setVideo] = useState(null);
  const [mod, setMod] = useState('all');
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    setError('');
    try { setData(await getMySessions()); } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { if (ready) load(); }, [ready, load]);
  // Refresh countdowns every 30s and data every 5 minutes.
  useEffect(() => { const a = setInterval(() => tick((n) => n + 1), 30000); const b = setInterval(load, 300000); return () => { clearInterval(a); clearInterval(b); }; }, [load]);

  const dayList = useMemo(() => (data?.sessions || []).filter((s) => dayKey(s.startsAt) === dayKey(day)), [data, day]);
  const upcoming = useMemo(() => (data?.sessions || []).filter((s) => s.status === 'upcoming' || s.status === 'live'), [data]);
  const modules = useMemo(() => [...new Set((data?.recordings || []).map((r) => r.moduleTitle || 'General'))], [data]);
  const recs = (data?.recordings || []).filter((r) => mod === 'all' || (r.moduleTitle || 'General') === mod);

  if (!ready) return null;
  if (error) return <main className="tn-wrap"><ErrorBox message={error} onRetry={load} /></main>;
  if (!data) return <main className="tn-wrap"><Loading rows={4} /></main>;
  const n = data.next;
  const left = n ? timeLeft(n.startsAt) : null;

  return (
    <main className="tn-wrap" style={{ gap: 28 }}>
      <section className="tn-stack" style={{ gap: 6 }}>
        <span className="tn-eyebrow">~/classes $ ls --live --recorded</span>
        <h1 style={{ fontSize: 'clamp(30px, 4vw, 44px)' }}>Live classes &amp; <span className="tn-hl">recordings</span></h1>
        <span style={{ fontSize: 15, color: 'var(--tn-ink-2)', maxWidth: 720 }}>Your mentors schedule Google Meet classes here. Join from this page, add them to your calendar, and catch up on anything you missed in the recordings below.</span>
      </section>

      {n ? (
        <section className="tn-navy" style={{ padding: '24px 26px', borderRadius: 22, boxShadow: '5px 5px 0 var(--tn-blue)', display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center' }} aria-label="Next class">
          <div className="tn-stack" style={{ flex: '1 1 360px', gap: 8 }}>
            <span className="tn-mono" style={{ fontSize: 12, color: 'var(--tn-yellow)', display: 'flex', alignItems: 'center', gap: 8 }}>{n.status === 'live' ? <><span className="tn-live-dot" /> LIVE NOW</> : 'NEXT_CLASS'}</span>
            <h2 style={{ fontSize: 'clamp(24px, 3vw, 32px)', color: '#fff' }}>{n.title}</h2>
            <span style={{ color: '#cfe0ff', fontSize: 15 }}>{fmtDay(n.startsAt)} · {fmtTime(n.startsAt)}–{fmtTime(n.endsAt)}{n.host ? ` · with ${n.host}` : ''}{n.moduleTitle ? ` · ${n.moduleTitle}` : ''}</span>
            {n.agenda && <span style={{ color: '#e6eeff', fontSize: 14, lineHeight: 1.5 }}>{n.agenda}</span>}
          </div>
          <div className="tn-stack" style={{ gap: 10, alignItems: 'flex-start' }}>
            {n.status !== 'live' && left && <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 34, color: '#fff' }}>in {left.txt}</span>}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {n.meetUrl && <a className="tn-btn yellow" href={n.meetUrl} target="_blank" rel="noopener noreferrer"><Icon name="video" size={18} /> Join Google Meet</a>}
              {n.status === 'upcoming' && <a className="tn-btn ghost-light" href={googleCalendarUrl(n)} target="_blank" rel="noopener noreferrer"><Icon name="calendar" size={18} color="#fff" /> Add to Google Calendar</a>}
            </div>
          </div>
        </section>
      ) : (
        <div className="tn-empty">No classes scheduled yet. Your mentor will add them here, and they’ll show on your Launchpad too.</div>
      )}

      <section className="tn-classes-grid">
        <MonthCalendar sessions={data.sessions} selected={day} onPick={setDay} />
        <div className="tn-stack" style={{ gap: 14 }}>
          <h2 style={{ fontSize: 22 }}>{dayKey(day) === dayKey(new Date()) ? 'Today' : fmtDay(day)}</h2>
          {dayList.length === 0 ? <div className="tn-empty" style={{ padding: 18 }}>No classes on this day.</div> : dayList.map((s) => <ClassCard key={s._id} s={s} onPlay={setVideo} compact />)}
          <h2 style={{ fontSize: 22, marginTop: 8 }}>Coming up</h2>
          {upcoming.length === 0 ? <span className="tn-muted" style={{ fontSize: 14 }}>Nothing scheduled.</span> : upcoming.slice(0, 4).map((s) => <ClassCard key={s._id} s={s} compact />)}
        </div>
      </section>

      <section className="tn-stack" style={{ gap: 14 }} id="recordings">
        <div className="tn-between" style={{ alignItems: 'flex-end', gap: 12 }}>
          <div className="tn-stack" style={{ gap: 4 }}>
            <span className="tn-eyebrow">recorded_lectures/</span>
            <h2 style={{ fontSize: 28 }}>Recorded lectures</h2>
            <span className="tn-muted" style={{ fontSize: 14 }}>Missed a class? Every recording your mentors upload lands here, grouped by module.</span>
          </div>
          {modules.length > 1 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="group" aria-label="Filter recordings by module">
              {['all', ...modules].map((m) => <button key={m} className={`tn-btn sm ${mod === m ? 'dark' : ''}`} onClick={() => setMod(m)}>{m === 'all' ? 'All' : m}</button>)}
            </div>
          )}
        </div>
        {recs.length === 0 ? <div className="tn-empty">No recordings yet.</div> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 22 }}>
            {recs.map((r) => (
              <div key={r._id} className="tn-stack" style={{ gap: 4 }}>
                <VideoThumb width="100%" tag="RECORDING" video={{ title: r.title, url: r.recording.url, channel: `${fmtDay(r.startsAt)}${r.host ? ` · ${r.host}` : ''}`, notes: r.recordingNotes }} onPlay={setVideo} />
                {r.moduleTitle && <span className="tn-mono" style={{ fontSize: 11, color: 'var(--tn-blue-ink)' }}>{r.moduleTitle}{r.subtopicTitle ? ` › ${r.subtopicTitle}` : ''}</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      <Link href="/dashboard" style={{ fontWeight: 700, fontSize: 14 }}>← Back to your Launchpad</Link>
      <VideoModal video={video} onClose={() => setVideo(null)} />
    </main>
  );
}
