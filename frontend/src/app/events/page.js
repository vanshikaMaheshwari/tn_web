'use client';
import { useEffect, useMemo, useState } from 'react';
import { getEvents } from '@/lib/api';
import { ErrorBox, Loading } from '@/components/ui/Brand';
import { useToast } from '@/components/ui/Toast';
import { FeaturedEvent, PastCard, UpcomingCard } from '@/components/events/EventBits';

const FILTERS = [['all', 'All events'], ['live', 'Live now'], ['upcoming', 'Upcoming'], ['past', 'Past']];

export default function EventsPage() {
  const toast = useToast();
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');

  const load = () => getEvents().then(setEvents).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const list = useMemo(() => {
    if (!events) return [];
    const term = q.trim().toLowerCase();
    return events.filter((e) => (filter === 'all' || e.status === filter) && (!term || `${e.title} ${e.type} ${e.description || ''}`.toLowerCase().includes(term)));
  }, [events, filter, q]);
  const count = (s) => (events || []).filter((e) => e.status === s).length;

  // The featured event (live or featured upcoming) leads; the rest follow by status.
  const featured = list.find((e) => e.status === 'live') || list.find((e) => e.status === 'upcoming' && e.featured);
  const upcoming = list.filter((e) => e.status === 'upcoming' && e !== featured);
  const live = list.filter((e) => e.status === 'live' && e !== featured);
  const past = list.filter((e) => e.status === 'past');
  const moments = (events || []).filter((e) => e.status === 'past').flatMap((e) => (e.gallery || []).map((g) => ({ src: g, title: e.title }))).slice(0, 5);

  return (
    <main className="tn-wrap" style={{ paddingTop: 20, gap: 36 }}>
      <section className="tn-between" style={{ alignItems: 'flex-end', gap: 24 }}>
        <div className="tn-stack" style={{ maxWidth: 760, gap: 12 }}>
          <span className="tn-eyebrow">cat events.log --all</span>
          <h1 style={{ fontSize: 'clamp(40px, 6vw, 60px)', lineHeight: 1, letterSpacing: '-0.03em' }}>What’s happening <span className="tn-hl" style={{ transform: 'rotate(-1.5deg)' }}>at TechNeeds</span></h1>
          <p style={{ fontSize: 19, lineHeight: 1.6, color: 'var(--tn-ink-2)', margin: 0 }}>Hackathons, bootcamps, talks and orientations by IGDTUW’s tech community. Register in one click and relive the past ones.</p>
        </div>
        <div className="tn-stack" style={{ alignItems: 'flex-end', gap: 12 }}>
          <label htmlFor="evq" className="sr-only">Search events</label>
          <input id="evq" className="tn-input" style={{ width: 320, maxWidth: '100%' }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events…" />
          <div role="tablist" aria-label="Filter events" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, background: '#fff', border: '2px solid var(--tn-navy)', borderRadius: 999, padding: 5 }}>
            {FILTERS.map(([k, l]) => (
              <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
                style={{ padding: '9px 16px', borderRadius: 999, border: 0, cursor: 'pointer', font: `${filter === k ? 700 : 500} 14px var(--font-body)`, background: filter === k ? 'var(--tn-navy)' : 'transparent', color: filter === k ? '#fff' : 'var(--tn-navy)' }}>
                {l}{k !== 'all' && events ? ` · ${count(k)}` : ''}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error && <ErrorBox message={error} onRetry={load} />}
      {!events && !error && <Loading rows={3} />}
      {events && list.length === 0 && <div className="tn-empty">No events match that. Try another filter.</div>}

      {featured && <FeaturedEvent e={featured} />}

      {(live.length > 0 || upcoming.length > 0) && (
        <section className="tn-stack" style={{ gap: 18 }}>
          <div className="tn-stack" style={{ gap: 6 }}><span className="tn-eyebrow">01 · upcoming</span><h2 style={{ fontSize: 34 }}>Coming up next</h2></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 520px), 1fr))', gap: 22 }}>
            {[...live, ...upcoming].map((e) => <UpcomingCard key={e._id} e={e} />)}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="tn-stack" style={{ gap: 18 }}>
          <div className="tn-between" style={{ alignItems: 'baseline' }}>
            <div className="tn-stack" style={{ gap: 6 }}><span className="tn-eyebrow">02 · past_events</span><h2 style={{ fontSize: 34 }}>Past events</h2></div>
            <span className="tn-hand" style={{ fontSize: 24, color: 'var(--tn-blue-ink)' }}>attended one? leave a rating ★</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 330px), 1fr))', gap: 22, alignItems: 'start' }}>
            {past.map((e) => <PastCard key={e._id} e={e} toast={toast} />)}
          </div>
        </section>
      )}

      {filter === 'all' && !q && moments.length > 0 && (
        <section className="tn-stack" style={{ gap: 20 }}>
          <div className="tn-stack" style={{ gap: 6 }}><span className="tn-eyebrow">03 · moments</span><h2 style={{ fontSize: 34 }}>Moments from the community</h2></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 22, padding: '6px 4px 14px' }}>
            {moments.map((m, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={m.src} src={m.src} alt={`${m.title} photo`} loading="lazy" style={{ width: '100%', height: 220, objectFit: 'cover', border: '3px solid #fff', outline: '2.5px solid var(--tn-navy)', borderRadius: 6, boxShadow: '4px 4px 0 var(--tn-navy)', transform: `rotate(${[-2, 2, -1.5, 1.5, -2][i % 5]}deg)` }} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
