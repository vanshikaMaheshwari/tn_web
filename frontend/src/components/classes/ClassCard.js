'use client';
import { timeLeft } from '@/lib/api';
import Icon from '@/components/ui/Icon';
import { fmtDay, fmtTime, googleCalendarUrl } from './media';

const ST = { upcoming: ['upcoming', 'var(--tn-sky)'], live: ['live now', '#FFD1DC'], ended: ['ended', '#e8f0ff'], cancelled: ['cancelled', '#fff'] };

// One class row: when, what, Join Google Meet, add to calendar, recording. `actions` = mentor buttons.
export default function ClassCard({ s, onPlay, actions, compact }) {
  const [label, bg] = ST[s.status] || ST.upcoming;
  const left = timeLeft(s.startsAt);
  const joinable = s.meetUrl && (s.status === 'live' || (s.status === 'upcoming' && left && left.ms < 15 * 60000));
  return (
    <article className="tn-card" style={{ padding: compact ? 14 : 18, display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', opacity: s.status === 'cancelled' ? 0.6 : 1 }}>
      <div style={{ width: 64, flex: 'none', textAlign: 'center', border: '2px solid var(--tn-navy)', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
        <div style={{ background: s.status === 'live' ? '#E5484D' : 'var(--tn-navy)', color: '#fff', font: '700 11px var(--font-mono)', padding: '3px 0' }}>{new Date(s.startsAt).toLocaleDateString('en-IN', { month: 'short' }).toUpperCase()}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, lineHeight: 1.2 }}>{new Date(s.startsAt).getDate()}</div>
        <div className="tn-mono" style={{ fontSize: 11, paddingBottom: 4 }}>{new Date(s.startsAt).toLocaleDateString('en-IN', { weekday: 'short' })}</div>
      </div>
      <div className="tn-stack" style={{ flex: '1 1 260px', minWidth: 0, gap: 6 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <b style={{ fontSize: 17, textDecoration: s.status === 'cancelled' ? 'line-through' : 'none' }}>{s.title}</b>
          <span className="tn-chipx" style={{ background: bg }}>{s.status === 'live' && <span className="tn-live-dot" style={{ marginRight: 6 }} />}{label}</span>
          {s.recording && <span className="tn-chipx" style={{ background: 'var(--tn-yellow)' }}>● recording</span>}
        </div>
        <span style={{ fontSize: 14, color: 'var(--tn-ink-2)' }}>
          <Icon name="clock" size={14} /> {fmtDay(s.startsAt)} · {fmtTime(s.startsAt)}–{fmtTime(s.endsAt)} · {s.durationMin} min{s.host ? ` · with ${s.host}` : ''}
        </span>
        {(s.moduleTitle || s.programName) && <span className="tn-mono" style={{ fontSize: 12, color: 'var(--tn-blue-ink)' }}>{[s.programName, s.moduleTitle, s.subtopicTitle].filter(Boolean).join(' › ')}</span>}
        {s.agenda && !compact && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{s.agenda}</p>}
        {s.status === 'upcoming' && left && <span style={{ fontSize: 13, fontWeight: 700, color: left.ms < 86400000 ? 'var(--tn-orange)' : 'var(--tn-muted)' }}>Starts in {left.txt}</span>}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {s.meetUrl && s.status !== 'ended' && s.status !== 'cancelled' && (
          <a className={`tn-btn sm ${joinable ? 'primary' : ''}`} href={s.meetUrl} target="_blank" rel="noopener noreferrer" title={joinable ? 'Join now' : 'You can join early; the mentor opens the room a few minutes before'}>
            <Icon name="video" size={16} color={joinable ? '#fff' : undefined} /> Join Google Meet
          </a>
        )}
        {s.status === 'upcoming' && <a className="tn-btn sm" href={googleCalendarUrl(s)} target="_blank" rel="noopener noreferrer"><Icon name="calendar" size={16} /> Add to calendar</a>}
        {s.recording && onPlay && <button className="tn-btn sm dark" onClick={() => onPlay({ title: s.title, url: s.recording.url, channel: s.host ? `Recorded class · ${s.host}` : 'Recorded class', notes: s.recordingNotes })}><Icon name="play" size={16} color="#fff" /> Watch recording</button>}
        {s.status === 'ended' && !s.recording && <span className="tn-muted" style={{ fontSize: 13 }}>Recording coming soon</span>}
        {actions}
      </div>
    </article>
  );
}
