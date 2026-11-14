'use client';
import { formatDate } from '@/lib/api';
import Icon from '@/components/ui/Icon';

// Weekly cohort report card (written by the "weeklyCohortReport" job: Render Workflows or inline).
export default function WeeklyReport({ report, compact }) {
  if (!report) {
    return (
      <div className="tn-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 6, borderStyle: 'dashed', boxShadow: 'none' }}>
        <span className="tn-mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--tn-blue-ink)' }}>WEEKLY_REPORT</span>
        <b style={{ fontSize: 16 }}>No report yet</b>
        <span className="tn-muted" style={{ fontSize: 14 }}>A report is generated every Monday morning. The core team can also run it now from Automations.</span>
      </div>
    );
  }
  const s = report.stats || {};
  const cells = [['active this week', `${s.active}/${s.mentees}`], ['points earned', s.pointsWeek], ['missions done', s.completionsWeek], ['overall completion', `${s.completionPct}%`]];
  return (
    <div className="tn-card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="tn-between" style={{ gap: 10, alignItems: 'flex-start' }}>
        <div className="tn-stack" style={{ gap: 2 }}>
          <span className="tn-mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--tn-blue-ink)' }}>WEEKLY_REPORT · {report.programName}</span>
          <b style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>{formatDate(report.periodStart)} – {formatDate(report.periodEnd)}</b>
        </div>
        <span className="tn-mono" title="How this report was made" style={{ fontSize: 11, fontWeight: 700, border: '2px solid var(--tn-navy)', borderRadius: 999, padding: '2px 9px', background: report.summarySource === 'gemini' ? '#ece6ff' : 'var(--tn-sky)', whiteSpace: 'nowrap' }}>
          {report.summarySource === 'gemini' ? '✦ Gemini summary' : '▦ Rules summary'}{report.via === 'render-workflows' ? ' · Render Workflows' : ''}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
        {cells.map(([l, v]) => (
          <div key={l} style={{ border: '2px solid var(--tn-navy)', borderRadius: 12, padding: '8px 12px', background: 'var(--tn-paper)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22 }}>{v ?? '—'}</div>
            <div className="tn-muted" style={{ fontSize: 12 }}>{l}</div>
          </div>
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>{report.summary}</p>
      {report.highlights?.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {report.highlights.map((h) => <li key={h} style={{ display: 'flex', gap: 8, fontSize: 14 }}><Icon name="arrow" size={16} /> {h}</li>)}
        </ul>
      )}
      {!compact && (s.topMovers?.length > 0 || s.inactive?.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, fontSize: 14 }}>
          {s.topMovers?.length > 0 && <div><b>Top movers</b><ol style={{ margin: '6px 0 0', paddingLeft: 20 }}>{s.topMovers.map((m) => <li key={m.name}>{m.name}: +{m.points} pts</li>)}</ol></div>}
          {s.inactive?.length > 0 && <div><b>Quiet this week ({s.inactiveCount})</b><div className="tn-muted" style={{ marginTop: 6 }}>{s.inactive.map((m) => m.name).join(', ')}</div></div>}
          {s.hardest?.length > 0 && <div><b>Lowest completion</b><div className="tn-muted" style={{ marginTop: 6 }}>{s.hardest.map((m) => `${m.title} (${m.pct}%)`).join(' · ')}</div></div>}
        </div>
      )}
    </div>
  );
}
