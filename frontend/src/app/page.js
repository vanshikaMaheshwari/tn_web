'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { getPublicPrograms } from '@/lib/api';
import { useReveal } from '@/lib/useReveal';
import LogoCube from '@/components/animation/LogoCube';

const STATS = [
  ['1200+', 'trained mentees', '#fff'],
  ['50+', 'professional mentors', 'var(--tn-tint)'],
  ['10+', 'mentorship cohorts', 'var(--tn-yellow)'],
  ['100+', 'events hosted', '#fff'],
];
const STEPS = [
  ['01', 'Join a cohort', 'Pick a track, get your enrollment number and a mentor.', 'var(--tn-blue)', '#fff', 'users'],
  ['02', 'Complete missions', 'Videos, timed quizzes and real projects with deadlines.', 'var(--tn-yellow)', 'var(--tn-navy)', 'target'],
  ['03', 'Climb + get your AI card', 'Earn points and streaks; Gemini maps your strengths.', 'var(--tn-navy)', '#fff', 'spark'],
];
const FAQS = [
  ['Who can join a TechNeeds cohort?', 'Any IGDTUW student. Cohorts open through TechNeeds announcements; mentors then add you to the platform.'],
  ['How do I get my login?', 'Your mentor creates your account and shares an enrollment number (like TN-WEBD-0004) plus a one-time password.'],
  ['How is the leaderboard scored?', 'Videos give full points on time (−1 per late day), quizzes score per correct answer, projects are scored by your mentor. Ties break on streak.'],
];

export default function Home() {
  const [programs, setPrograms] = useState([]);
  const [open, setOpen] = useState(0);
  useReveal([]);
  useEffect(() => { getPublicPrograms().then(setPrograms).catch(() => setPrograms([])); }, []);

  return (
    <main className="home">
      <section className="home-hero">
        <div className="tn-reveal" style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          <span className="tn-pill yellow" style={{ alignSelf: 'flex-start' }}>IGDTUW’s tech community</span>
          <h1>Upgrade <span className="tn-hl" style={{ padding: '0 16px', borderRadius: 16, transform: 'rotate(-2deg)' }}>Yourself!</span></h1>
          <p className="lede">
            Mentor-led cohorts, real projects, a live leaderboard and an AI co-pilot that maps your growth. Everything you need to know about tech, in one place.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            <Link href="/login" className="tn-btn primary" style={{ minHeight: 54, padding: '0 28px', fontSize: 16 }}>Get started</Link>
            <a href="#how" className="tn-btn" style={{ minHeight: 54, padding: '0 26px', fontSize: 16 }}>Know more</a>
          </div>
          <div className="home-proof" aria-label="Community numbers">
            {STATS.map(([n, l]) => (
              <div key={l}><b>{n}</b><span>{l}</span></div>
            ))}
          </div>
        </div>
        <div className="home-visual tn-reveal">
          <LogoCube />
        </div>
      </section>

      <section id="how" className="tn-reveal" style={{ scrollMarginTop: 24 }}>
        <div className="sec-head">
          <span className="tn-eyebrow">01 · how_it_works</span>
          <div className="row">
            <h2>Three steps to liftoff</h2>
            <span className="tn-hand" style={{ fontSize: 26, color: 'var(--tn-blue-ink)' }}>no fluff, just missions</span>
          </div>
        </div>
        <div className="home-grid-3">
          {STEPS.map(([n, t, d, bg, fg, icon]) => (
            <div key={n} className="tn-card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="tn-between">
                <span style={{ width: 52, height: 52, borderRadius: 14, background: bg, border: '2px solid var(--tn-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={icon} color={fg} size={26} />
                </span>
                <span className="tn-mono" style={{ fontSize: 28, fontWeight: 700, color: '#bfd0ee' }}>{n}</span>
              </div>
              <h3 style={{ fontSize: 24 }}>{t}</h3>
              <p style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--tn-ink-2)' }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="sec-head">
          <span className="tn-eyebrow">02 · cohorts</span>
          <h2>Pick your track</h2>
        </div>
        {programs.length === 0 ? (
          <div className="tn-empty">Cohorts appear here as admins create them.</div>
        ) : (
          <div className="home-grid-3">
            {programs.slice(0, 6).map((p, i) => (
              <div key={p._id} className="tn-card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span className={`tn-pill ${i === 0 ? 'yellow' : i === 1 ? 'blue' : ''}`} style={{ alignSelf: 'flex-start' }}>{i === 0 ? 'Enrolling' : 'Live'}</span>
                <h3 style={{ fontSize: 24 }}>{p.name}</h3>
                <Link href="/leaderboard" style={{ fontWeight: 700, fontSize: 14 }}>See the leaderboard →</Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="home-cta">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="sec-head" style={{ marginBottom: 14 }}>
            <span className="tn-eyebrow">03 · faqs</span>
            <h2>Questions, answered</h2>
          </div>
          {FAQS.map(([q, a], i) => (
            <div key={q} className="tn-card flat" style={{ padding: 0, overflow: 'hidden' }}>
              <button
                onClick={() => setOpen(open === i ? -1 : i)}
                aria-expanded={open === i}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', minHeight: 64, padding: '0 22px', background: 'none', border: 'none', font: '700 17px var(--font-body)', color: 'var(--tn-navy)', textAlign: 'left', cursor: 'pointer' }}
              >
                {q}
                <span style={{ transform: open === i ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><Icon name="chevron" size={22} /></span>
              </button>
              {open === i && <p style={{ padding: '0 22px 20px', fontSize: 15, lineHeight: 1.55, color: 'var(--tn-ink-2)' }}>{a}</p>}
            </div>
          ))}
        </div>
        <div className="tn-card yellow" style={{ padding: 34, display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 24 }}>
          <span className="tn-mono" style={{ fontSize: 13, fontWeight: 700 }}>already_enrolled?</span>
          <h2 style={{ fontSize: 34 }}>Your launchpad is waiting.</h2>
          <p style={{ fontSize: 16, lineHeight: 1.5 }}>Log in with the enrollment number your mentor shared.</p>
          <Link href="/login" className="tn-btn dark" style={{ alignSelf: 'flex-start' }}>Log in</Link>
        </div>
      </section>
    </main>
  );
}
