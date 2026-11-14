'use client';
import { useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { dayKey, fmtTime } from './media';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DOT = { upcoming: 'var(--tn-blue)', live: '#E5484D', ended: '#9fb4d8', cancelled: '#d0d7e5' };

// Month grid with classes on their days. onPick(date) is called when a day is chosen.
export default function MonthCalendar({ sessions = [], selected, onPick, compact }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(selected || Date.now()); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const byDay = useMemo(() => {
    const m = new Map();
    sessions.forEach((s) => { const k = dayKey(s.startsAt); m.set(k, [...(m.get(k) || []), s]); });
    return m;
  }, [sessions]);
  const first = new Date(cursor);
  const offset = (first.getDay() + 6) % 7; // Monday first
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1))];
  while (cells.length % 7) cells.push(null);
  const today = dayKey(new Date());
  const sel = selected ? dayKey(selected) : null;
  const move = (n) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));

  return (
    <div className="tn-card tn-cal" style={{ padding: compact ? 14 : 18 }}>
      <div className="tn-between" style={{ marginBottom: 10 }}>
        <b style={{ fontFamily: 'var(--font-display)', fontSize: compact ? 18 : 22 }}>{cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</b>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="tn-btn sm" aria-label="Previous month" onClick={() => move(-1)}>‹</button>
          <button className="tn-btn sm" onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); onPick?.(d); }}>Today</button>
          <button className="tn-btn sm" aria-label="Next month" onClick={() => move(1)}>›</button>
        </div>
      </div>
      <div className="tn-cal-grid" role="grid">
        {DOW.map((d) => <span key={d} className="tn-cal-dow">{compact ? d[0] : d}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const k = dayKey(d);
          const list = byDay.get(k) || [];
          return (
            <button key={k} type="button" className={`tn-cal-day ${k === today ? 'today' : ''} ${k === sel ? 'sel' : ''}`} onClick={() => onPick?.(d)} aria-label={`${d.toDateString()}${list.length ? `, ${list.length} class${list.length > 1 ? 'es' : ''}` : ''}`}>
              <span className="tn-cal-num">{d.getDate()}</span>
              {!compact && list.slice(0, 2).map((s) => (
                <span key={s._id} className="tn-cal-ev" style={{ borderLeftColor: DOT[s.status], textDecoration: s.status === 'cancelled' ? 'line-through' : 'none' }}>{fmtTime(s.startsAt)} {s.title}</span>
              ))}
              {compact && list.length > 0 && <span className="tn-cal-dots">{list.slice(0, 3).map((s) => <i key={s._id} style={{ background: DOT[s.status] }} />)}</span>}
              {!compact && list.length > 2 && <span className="tn-muted" style={{ fontSize: 11 }}>+{list.length - 2} more</span>}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 12, flexWrap: 'wrap' }} className="tn-muted">
        {[['upcoming', 'Upcoming'], ['live', 'Live now'], ['ended', 'Ended']].map(([k, l]) => <span key={k} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><i style={{ width: 10, height: 10, borderRadius: '50%', background: DOT[k], display: 'inline-block' }} />{l}</span>)}
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name="calendar" size={14} /> times in your timezone</span>
      </div>
    </div>
  );
}
