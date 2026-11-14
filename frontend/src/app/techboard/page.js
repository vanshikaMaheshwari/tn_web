'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getTechboard } from '@/lib/api';
import { ErrorBox, Loading } from '@/components/ui/Brand';
import Icon from '@/components/ui/Icon';
import AvatarBot from '@/components/card/AvatarBot';
import { RegisterButton, eventWhen } from '@/components/events/EventBits';

// One public board that pulls from Events, Leaderboard, cohorts, AI cards and activity.
function Note({ title, eyebrow, pin = 'var(--tn-yellow)', rot = 0, bg = '#fff', link, children, span }) {
  return (
    <div className="tn-note" style={{ background: bg, transform: `rotate(${rot}deg)`, gridColumn: span ? `span ${span}` : undefined }}>
      <span className="tn-pin" style={{ background: pin }} aria-hidden="true" />
      {eyebrow && <span className="tn-eyebrow">{eyebrow}</span>}
      <h2 style={{ fontSize: 22, lineHeight: 1.15 }}>{title}</h2>
      {children}
      {link && <Link href={link[0]} style={{ fontWeight: 700, fontSize: 14, marginTop: 'auto' }}>{link[1]} →</Link>}
    </div>
  );
}

const ago = (d) => {
  const h = Math.round((Date.now() - new Date(d).getTime()) / 3600000);
  return h < 1 ? 'just now' : h < 24 ? `${h}h` : `${Math.round(h / 24)}d`;
};

export default function TechboardPage() {
  const [b, setB] = useState(null);
  const [error, setError] = useState('');
  const load = () => getTechboard().then(setB).catch((e) => setError(e.message));
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);

  const stats = b ? [
    [b.stats.mentees, 'mentees on the platform'], [b.stats.mentors, 'mentors'], [b.stats.cohorts, 'cohorts'], [b.stats.events, 'events'],
    ...(b.stats.registrations ? [[`${b.stats.registrations.toLocaleString('en-IN')}+`, 'event registrations']] : []),
  ] : [];
  const live = b?.live?.[0];

  return (
    <main className="tn-wrap" style={{ paddingTop: 20, gap: 30 }}>
      <section className="tn-between" style={{ alignItems: 'flex-end', gap: 24 }}>
        <div className="tn-stack" style={{ maxWidth: 720, gap: 12 }}>
          <span className="tn-eyebrow">tail -f techneeds.board</span>
          <h1 style={{ fontSize: 'clamp(40px, 6vw, 60px)', lineHeight: 1, letterSpacing: '-0.03em' }}>The <span className="tn-hl" style={{ transform: 'rotate(-1.5deg)' }}>Techboard</span></h1>
          <p style={{ margin: 0, fontSize: 19, lineHeight: 1.6, color: 'var(--tn-ink-2)' }}>Everything happening at TechNeeds on one board: what’s live, who’s leading, what’s next, and the community’s latest wins. Refreshes every minute.</p>
        </div>
        {b && (
          <div className="tn-card" style={{ padding: 0, display: 'flex', flexWrap: 'wrap', overflow: 'hidden' }}>
            {stats.map(([n, l], i) => (
              <div key={l} style={{ padding: '14px 22px', display: 'flex', flexDirection: 'column', borderLeft: i ? '2px dashed #bfd0ee' : 0 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 30 }}>{n}</span><span className="tn-muted" style={{ fontSize: 13 }}>{l}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {error && <ErrorBox message={error} onRetry={load} />}
      {!b && !error && <Loading rows={4} />}

      {b && (
        <section className="tn-board">
          {live ? (
            <div className="tn-note" style={{ padding: 0, overflow: 'hidden', background: 'var(--tn-navy)', color: '#fff', gridColumn: 'span 2', transform: 'rotate(-0.6deg)', boxShadow: '5px 5px 0 var(--tn-blue)' }}>
              <span className="tn-pin" style={{ background: '#E5383B' }} aria-hidden="true" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {live.imageUrl && <img src={live.imageUrl} alt={`${live.title} banner`} style={{ width: '100%', height: 230, objectFit: 'cover', display: 'block' }} />}
              <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div className="tn-stack" style={{ gap: 4 }}><span className="tn-mono" style={{ fontSize: 12, color: 'var(--tn-yellow)' }}>● LIVE NOW · {eventWhen(live)}</span><b style={{ fontFamily: 'var(--font-display)', fontSize: 24 }}>{live.title}</b></div>
                <div style={{ minWidth: 200 }}><RegisterButton e={live} big /></div>
              </div>
            </div>
          ) : (
            <Note title="Nothing live right now" eyebrow="events" span={2} link={['/events', 'See all events']}><p className="tn-muted" style={{ margin: 0 }}>The next event shows up here the moment it starts.</p></Note>
          )}

          <Note title="Top of the leaderboard" eyebrow="all cohorts · live" rot={1.2} link={['/leaderboard', 'Full leaderboard']}>
            <ol className="tn-stack" style={{ gap: 6, listStyle: 'none', padding: 0, margin: 0 }}>
              {b.leaderboard.map((m) => (
                <li key={m.rank} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '2px solid var(--tn-navy)', borderRadius: 10, background: ['var(--tn-yellow)', 'var(--tn-tint)', 'var(--tn-orange-bg)'][m.rank - 1] || '#fff' }}>
                  <span className="tn-mono" style={{ fontWeight: 700, width: 26 }}>#{m.rank}</span><b style={{ flex: 1, fontSize: 14 }}>{m.name}</b><span className="tn-mono" style={{ fontSize: 13 }}>{m.totalScore.toLocaleString('en-IN')}</span>
                </li>
              ))}
            </ol>
          </Note>

          <Note title="Coming up" eyebrow="events" pin="var(--tn-sky)" rot={-1} link={['/events', 'All events']}>
            {b.upcoming.length === 0 && <p className="tn-muted" style={{ margin: 0 }}>New events are announced soon.</p>}
            {b.upcoming.map((e) => (
              <div key={e._id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {e.imageUrl && <img src={e.imageUrl} alt="" style={{ width: 84, height: 90, objectFit: 'cover', objectPosition: 'top', border: '2px solid var(--tn-navy)', borderRadius: 10, flex: 'none' }} />}
                <div className="tn-stack" style={{ gap: 4 }}><b style={{ fontSize: 15 }}>{e.title}</b><span className="tn-muted" style={{ fontSize: 13 }}>{eventWhen(e)} · {e.mode}</span></div>
              </div>
            ))}
          </Note>

          <Note title="Hall of fame" eyebrow="public AI cards" pin="#FFD1DC" rot={0.8}>
            {b.hallOfFame.length === 0 && <p className="tn-muted" style={{ margin: 0 }}>Learners who make their AI card public appear here.</p>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              {b.hallOfFame.map((m) => (
                <Link key={m.enrollmentNumber} href={`/u/${m.enrollmentNumber}`} className="tn-navy" style={{ padding: 10, borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 4, textDecoration: 'none', boxShadow: '3px 3px 0 var(--tn-blue)' }}>
                  <span className="tn-mono" style={{ fontSize: 10, color: '#8ec5ff' }}>LVL {m.level}</span>
                  <AvatarBot traits={m.avatar} size={56} label={`${m.name}'s avatar`} />
                  <b style={{ fontSize: 13, color: '#fff' }}>{m.name.split(' ')[0]}</b>
                  <span className="tn-hand" style={{ fontSize: 16, color: 'var(--tn-yellow)', lineHeight: 1 }}>“{m.archetype}”</span>
                </Link>
              ))}
            </div>
          </Note>

          {b.announcement ? (
            <Note title="Pinned by the core team" eyebrow="announcement" pin="#E5383B" rot={-2} bg="var(--tn-yellow)">
              <p className="tn-hand" style={{ margin: 0, fontSize: 25, lineHeight: 1.15 }}>{b.announcement.text}</p>
              <span className="tn-mono" style={{ fontSize: 11 }}>— {b.announcement.by}</span>
            </Note>
          ) : (
            <Note title="Pinned by the core team" eyebrow="announcement" pin="#E5383B" rot={-2} bg="var(--tn-yellow)"><p className="tn-hand" style={{ margin: 0, fontSize: 24 }}>No announcements right now.</p></Note>
          )}

          <Note title="Cohorts running now" eyebrow="progress" pin="#C9F5DF" rot={-0.8} link={['/#how', 'How to join a cohort']}>
            {b.cohorts.map((c) => (
              <div key={c.name} className="tn-stack" style={{ gap: 6 }}>
                <div className="tn-between" style={{ fontSize: 14 }}><b>{c.name}</b><span className="tn-mono" style={{ fontSize: 12 }}>{c.progress}%</span></div>
                <div role="meter" aria-label={`${c.name} average progress`} aria-valuenow={c.progress} aria-valuemin={0} aria-valuemax={100} style={{ height: 12, background: '#e8f0ff', border: '2px solid var(--tn-navy)', borderRadius: 7, overflow: 'hidden' }}><div style={{ width: `${c.progress}%`, height: '100%', background: 'var(--tn-blue)' }} /></div>
                <span className="tn-muted" style={{ fontSize: 12 }}>{c.mentees} mentees · {c.missions} missions</span>
              </div>
            ))}
          </Note>

          <Note title="Recent wins" eyebrow="activity" pin="#E6DEFF" rot={1.5}>
            {b.recentWins.length === 0 && <p className="tn-muted" style={{ margin: 0 }}>Finished missions show up here.</p>}
            <ul className="tn-stack" style={{ gap: 10, listStyle: 'none', padding: 0, margin: 0 }}>
              {b.recentWins.slice(0, 5).map((w, i) => (
                <li key={i} style={{ display: 'flex', gap: 10, fontSize: 14, lineHeight: 1.4 }}><span style={{ width: 10, height: 10, marginTop: 5, borderRadius: '50%', background: 'var(--tn-blue)', flex: 'none' }} /><span><b>{w.name}</b> {w.text} <span className="tn-mono" style={{ fontSize: 11, color: 'var(--tn-muted)' }}>· {ago(w.at)}</span></span></li>
              ))}
            </ul>
          </Note>

          <Note title="Last few events" eyebrow="photo_wall" rot={-1} link={['/events', 'See all moments']}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {b.photos.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p.imageUrl} src={(p.gallery && p.gallery[0]) || p.imageUrl} alt={`${p.title}`} loading="lazy" style={{ width: '100%', height: 96, objectFit: 'cover', border: '2px solid var(--tn-navy)', borderRadius: 8 }} />
              ))}
            </div>
          </Note>

          <Note title="Got a question or idea?" eyebrow="talk_to_us" bg="var(--tn-sky)" span={3}>
            <div className="tn-between">
              <span style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--tn-ink-2)' }}>Ask us anything or tell us what to improve. The core team reads every message.</span>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link href="/faq" className="tn-btn sm dark"><Icon name="message" size={16} color="#fff" /> Ask a question</Link>
                <button className="tn-btn sm" onClick={() => document.querySelector('.tn-feedback-tab')?.click()}>Give feedback</button>
              </div>
            </div>
          </Note>
        </section>
      )}
    </main>
  );
}
