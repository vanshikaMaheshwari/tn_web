'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { getEvents, getPublicPrograms } from '@/lib/api';
import { useReveal } from '@/lib/useReveal';
import LogoCube from '@/components/animation/LogoCube';

const STATS = [
  ['1200+', 'trained mentees', '#fff'],
  ['50+', 'professional mentors', 'var(--tn-tint)'],
  ['10+', 'mentorship cohorts', 'var(--tn-yellow)'],
  ['100+', 'events hosted', '#fff'],
];
// The newcomer's path: from curious visitor to mentee.
const PATH = [
  ['1', 'Find a cohort', 'Browse tracks like Web Dev or DSA below. No experience needed for beginner tracks.', ['#tracks', 'Pick your track ↓'], 'var(--tn-yellow)'],
  ['2', 'Register when it opens', 'Cohort launches are posted on the Events page with a registration form.', ['/events', 'See events →'], 'var(--tn-sky)'],
  ['3', 'Get your enrollment number', 'Once selected, your mentor emails you an ID like TN-WEBD-0004 and a temporary password.', ['/faq', 'What’s that? →'], '#FFD1DC'],
  ['4', 'Log in and launch', 'Set your password, open your Launchpad, and start your first mission.', ['/login', 'Log in →'], '#C9F5DF'],
];
const WHO = [
  ['Never coded before?', 'Start with the Web Dev track. Week 1 is HTML basics.', 'var(--tn-yellow)'],
  ['Know a little already?', 'Pick DSA or App Dev and level up with real projects.', 'var(--tn-sky)'],
  ['Already a mentee?', 'Use your enrollment number to log in to your Launchpad.', '#FFD1DC'],
];
const CHAPTERS = [[0, 'What TechNeeds is'], [9, 'Find a cohort + register'], [21, 'Your enrollment number'], [31, 'Missions, points & your AI card'], [45, 'Where it leads']];
const FAQS = [
  ['Who can join a TechNeeds cohort?', 'Any IGDTUW student. Cohorts open through TechNeeds announcements; mentors then add you to the platform.'],
  ['How do I get my login?', 'Your mentor creates your account and shares an enrollment number (like TN-WEBD-0004) plus a one-time password.'],
  ['How is the leaderboard scored?', 'By total points from missions: videos, quizzes (per correct answer) and projects (scored by your mentor). Ties break on streak.'],
];

export default function Home() {
  const [programs, setPrograms] = useState([]);
  const [nextLaunch, setNextLaunch] = useState(null);
  const [open, setOpen] = useState(0);
  useReveal([]);
  useEffect(() => {
    getPublicPrograms().then(setPrograms).catch(() => setPrograms([]));
    getEvents().then((evs) => {
      const up = evs.filter((e) => e.status !== 'past');
      setNextLaunch(up.find((e) => e.type === 'cohort-launch') || up.find((e) => e.type === 'bootcamp') || up[0] || null);
    }).catch(() => {});
  }, []);
  const seek = (t) => {
    const v = document.getElementById('explainer');
    if (v) { v.currentTime = t; v.play().catch(() => {}); }
  };

  return (
    <main className="home">
      <section className="home-hero">
        <div className="tn-reveal home-hero-copy">
          <span className="tn-pill yellow" style={{ alignSelf: 'flex-start' }}>IGDTUW’s tech community</span>
          <h1>Upgrade <span className="tn-hl" style={{ padding: '0 16px', borderRadius: 16, transform: 'rotate(-2deg)' }}>Yourself!</span></h1>
          <p className="lede">
            Mentor-led cohorts, real projects, a live leaderboard and an AI co-pilot that maps your growth. Everything you need to know about tech, in one place.
          </p>
          <div className="home-hero-ctas">
            <a href="#how" className="tn-btn primary" style={{ minHeight: 54, padding: '0 28px', fontSize: 16 }}>I’m new: show me how</a>
            <Link href="/login" className="tn-btn" style={{ minHeight: 54, padding: '0 26px', fontSize: 16 }}>I have an enrollment number</Link>
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

      <section className="home-video tn-reveal">
        <div className="home-video-frame">
          <video id="explainer" controls preload="metadata" poster="/video/techneeds-explainer-poster.jpg" playsInline>
            <source src="/video/techneeds-explainer.mp4" type="video/mp4" />
            <track kind="captions" src="/video/techneeds-explainer.vtt" srcLang="en" label="English" default />
            Your browser can’t play this video. <a href="/video/techneeds-explainer.mp4">Download it</a>.
          </video>
        </div>
        <div className="tn-stack" style={{ gap: 12 }}>
          <span className="tn-eyebrow">00 · watch_first</span>
          <h2 style={{ fontSize: 'clamp(28px, 3vw, 34px)', lineHeight: 1.1 }}>New to TechNeeds? Start with this 1-minute video</h2>
          <div className="tn-stack" style={{ gap: 8 }}>
            {CHAPTERS.map(([t, c]) => (
              <button key={t} onClick={() => seek(t)} className="home-chapter">
                <span className="tn-mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--tn-blue)' }}>{`0:${String(t).padStart(2, '0')}`}</span>
                <span>{c}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="tn-reveal" style={{ scrollMarginTop: 24 }}>
        <div className="sec-head">
          <span className="tn-eyebrow">01 · start_here</span>
          <div className="row">
            <h2>New here? Your path to becoming a mentee</h2>
            <span className="tn-hand" style={{ fontSize: 26, color: 'var(--tn-blue-ink)' }}>4 steps, about a week</span>
          </div>
        </div>
        <ol className="home-path">
          {PATH.map(([n, t, d, [href, cta], bg]) => (
            <li key={n} className="tn-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span className="home-path-num" style={{ background: bg }} aria-hidden="true">{n}</span>
              <h3 style={{ fontSize: 22 }}><span className="sr-only">Step {n}: </span>{t}</h3>
              <p style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--tn-ink-2)', margin: 0 }}>{d}</p>
              <Link href={href} style={{ fontWeight: 700, fontSize: 14, marginTop: 'auto' }}>{cta}</Link>
            </li>
          ))}
        </ol>
        <div className="home-grid-3" style={{ marginTop: 22 }}>
          {WHO.map(([t, d, bg]) => (
            <div key={t} style={{ background: bg, border: 'var(--border)', borderRadius: 18, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <b style={{ fontSize: 17 }}>{t}</b><span style={{ fontSize: 14, lineHeight: 1.5 }}>{d}</span>
            </div>
          ))}
        </div>
      </section>

      {nextLaunch && (
        <section className="tn-navy tn-reveal" style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', padding: '24px 28px', borderRadius: 22, boxShadow: '5px 5px 0 var(--tn-blue)' }}>
          <div style={{ flex: 'none', width: 76, border: '2.5px solid #fff', borderRadius: 14, overflow: 'hidden', textAlign: 'center' }}>
            <div className="tn-mono" style={{ background: 'var(--tn-yellow)', color: 'var(--tn-navy)', fontSize: 12, fontWeight: 700, padding: '3px 0' }}>{new Date(nextLaunch.startsAt).toLocaleDateString('en-IN', { month: 'short' }).toUpperCase()}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 30, padding: '4px 0' }}>{new Date(nextLaunch.startsAt).getDate()}</div>
          </div>
          <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="tn-mono" style={{ fontSize: 12, color: 'var(--tn-yellow)' }}>{nextLaunch.status === 'live' ? 'happening_now' : 'next_up'}</span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26 }}>{nextLaunch.title}</span>
            <span style={{ fontSize: 15, color: '#cfe0ff' }}>This is where step 2 happens: register on the Events page to join.</span>
          </div>
          <Link href="/events" className="tn-btn yellow">View all events →</Link>
        </section>
      )}

      <section id="tracks" style={{ scrollMarginTop: 24 }}>
        <div className="sec-head">
          <span className="tn-eyebrow">02 · cohorts</span>
          <div className="row"><h2>Pick your track</h2><span className="tn-hand" style={{ fontSize: 26, color: 'var(--tn-blue-ink)' }}>step 1 starts here</span></div>
        </div>
        {programs.length === 0 ? (
          <div className="tn-empty">Cohorts appear here as the core team creates them.</div>
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
          <Link href="/faq" style={{ fontWeight: 700, fontSize: 14, order: 9 }}>More questions? Read the FAQ →</Link>
          <span className="tn-mono" style={{ fontSize: 13, fontWeight: 700 }}>already_enrolled?</span>
          <h2 style={{ fontSize: 34 }}>Your launchpad is waiting.</h2>
          <p style={{ fontSize: 16, lineHeight: 1.5 }}>Log in with the enrollment number your mentor shared.</p>
          <Link href="/login" className="tn-btn dark" style={{ alignSelf: 'flex-start' }}>Log in</Link>
        </div>
      </section>
    </main>
  );
}
