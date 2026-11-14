'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { sendQuery, trackQuery } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

const FAQ = [
  ['getting-started', 'Getting started', [
    ['What is TechNeeds?', 'TechNeeds is IGDTUW’s tech community. We run mentor-led cohorts (Web Dev, DSA, App Dev…), hackathons like InnoVortex, workshops and talks. Mentees learn through missions, earn points, and get an AI learner card that maps their growth.'],
    ['How do I become a mentee?', 'Watch the Events page for a cohort launch and register through its form. When you’re selected, your mentor shares an enrollment number (like TN-WEBD-0004) and a temporary password. Log in, change your password, and your Launchpad is ready.', [['/events', 'See upcoming cohorts'], ['/#how', 'How it works']]],
    ['Do I need to know coding before joining?', 'No. Beginner tracks like Web Dev start from the basics in week 1. Pick DSA or App Dev if you already know a little.'],
    ['Is it free?', 'Yes. Cohorts and most events are free for IGDTUW students.'],
    ['Which branches can join?', 'Every branch is welcome: CSE, IT, ECE, MAE, AI/ML, and more.'],
  ]],
  ['joining', 'Joining a cohort', [
    ['When do new cohorts start?', 'Cohort launches are announced on the Events page and the Techboard, usually at the start of each semester.'],
    ['What is an enrollment number?', 'Your TechNeeds login ID, e.g. TN-WEBD-0004. Your mentor creates it when you join and shares it with a first password.'],
    ['I didn’t get my enrollment number. What now?', 'Ask your cohort mentor, or send us a question below with the cohort name and we’ll sort it out.'],
    ['Can I join more than one cohort?', 'Yes, if you can keep up. Your Launchpad shows each cohort’s modules separately.'],
  ]],
  ['missions', 'Missions & points', [
    ['What are missions?', 'Your learning tasks. Each cohort is split into modules, each module into sub-topics, and each sub-topic has a few missions: videos, quizzes and projects.'],
    ['How do videos, quizzes and projects work?', 'Videos: watch, then tap “Mark as done” for points. Quizzes: timed, one attempt, open and close on set dates. Projects: build it, submit a GitHub link, and your mentor reviews and scores it.'],
    ['What happens if I miss a deadline?', 'Videos and projects can still be submitted, but you lose 1 point for each day late. Quizzes close at their deadline.'],
    ['What is a streak?', 'The number of days in a row you finished at least one mission. Miss a day and it restarts, so small daily steps count.'],
    ['Why is a mission locked?', 'Some sub-topics unlock only after you finish the one before it, so you learn things in order.'],
    ['How is the leaderboard ranked?', 'By total points; ties are broken by streak and then by who was active most recently.'],
  ]],
  ['ai-card', 'Your AI card', [
    ['What is the AI card?', 'A profile built from your real activity: a generated avatar, an AI-written summary, skill scores, badges, a rank forecast and suggested next missions.'],
    ['Can the AI make things up about me?', 'No. Every highlighted fact in the summary is checked by our server against your actual activity before it’s shown.'],
    ['Who can see my card?', 'Only you and your mentors, until you switch on the public link. You can also hide your rank or add an “open to opportunities” tag.'],
  ]],
  ['events', 'Events', [
    ['How do I register for an event?', 'Open the Events page and tap Register. It opens the event’s official form in a new tab.'],
    ['Do events give certificates?', 'Most do. Each event’s description mentions certificates and prizes.'],
    ['Can I suggest an event?', 'Yes! Send it as a question below with the topic “Events”.'],
  ]],
  ['account', 'For mentors', [
    ['How do I become a mentor?', 'Mentors are invited by the TechNeeds core team. Send us a question below if you’d like to mentor a cohort.'],
    ['I forgot my password.', 'Mentees: ask your mentor to reset it from Mission Control. Mentors: ask the core team.'],
  ]],
];

const TOPIC_OPTIONS = [['getting-started', 'Getting started'], ['joining', 'Joining a cohort'], ['missions', 'Missions & points'], ['ai-card', 'Your AI card'], ['events', 'Events'], ['account', 'Account / login'], ['other', 'Something else']];

export default function FaqPage() {
  const toast = useToast();
  const [cat, setCat] = useState('getting-started');
  const [open, setOpen] = useState('How do I become a mentee?');
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ name: '', email: '', topic: 'getting-started', message: '' });
  const [sent, setSent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [track, setTrack] = useState({ ticket: '', email: '' });
  const [tracked, setTracked] = useState(null);

  const term = q.trim().toLowerCase();
  const visible = useMemo(() => {
    if (term) return FAQ.flatMap(([, , items]) => items).filter(([qq, a]) => `${qq} ${a}`.toLowerCase().includes(term));
    return (FAQ.find(([k]) => k === cat) || FAQ[0])[2];
  }, [cat, term]);
  const catLabel = term ? `results for “${q}”` : (FAQ.find(([k]) => k === cat) || FAQ[0])[1];

  async function ask(e) {
    e.preventDefault();
    setBusy(true);
    try { const r = await sendQuery(form); setSent(r.ticket); setForm({ ...form, message: '' }); }
    catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }
  async function onTrack(e) {
    e.preventDefault();
    try { setTracked(await trackQuery(track.ticket, track.email)); } catch (err) { setTracked(null); toast(err.message, 'error'); }
  }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <section className="tn-navy" style={{ position: 'relative', margin: '8px 32px 0', padding: 'clamp(32px, 5vw, 56px) clamp(22px, 4vw, 48px)', borderRadius: 28, boxShadow: '6px 6px 0 var(--tn-blue)', overflow: 'hidden' }}>
        <div aria-hidden="true" className="tn-faq-sticky" style={{ right: 70, top: 46, background: 'var(--tn-yellow)', transform: 'rotate(-5deg)' }}>no question is too basic!</div>
        <div aria-hidden="true" className="tn-faq-sticky" style={{ right: 260, bottom: 30, background: '#FFD1DC', transform: 'rotate(4deg)' }}>psst… the core team replies within a day</div>
        <div className="tn-stack" style={{ gap: 16, maxWidth: 760, position: 'relative' }}>
          <span className="tn-mono" style={{ fontSize: 13, color: 'var(--tn-yellow)' }}>man techneeds --help</span>
          <h1 style={{ fontSize: 'clamp(40px, 6vw, 64px)', lineHeight: 1, letterSpacing: '-0.03em', color: '#fff' }}>Questions, answered.</h1>
          <p style={{ margin: 0, fontSize: 19, lineHeight: 1.6, color: '#cfe0ff' }}>Everything about joining a cohort, missions, points and events, in plain words.</p>
          <label htmlFor="faqq" className="sr-only">Search the FAQ</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 58, padding: '0 18px', background: '#fff', borderRadius: 16, boxShadow: '4px 4px 0 var(--tn-yellow)', maxWidth: 620 }}>
            <Icon name="search" size={22} color="var(--tn-muted)" />
            <input id="faqq" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search, e.g. “enrollment number”" style={{ flex: 1, border: 0, outline: 'none', font: '500 17px var(--font-body)', color: 'var(--tn-navy)', background: 'transparent', minHeight: 54 }} />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 14, color: '#cfe0ff' }}>
            popular: {['become a mentee', 'deadline', 'streak', 'AI card'].map((t) => <button key={t} className="tn-link-btn" style={{ color: '#fff', textDecoration: 'underline', fontWeight: 500 }} onClick={() => setQ(t)}>{t}</button>)}
          </div>
        </div>
      </section>

      <main className="tn-wrap" style={{ paddingTop: 40 }}>
        <section className="tn-faq-grid">
          <nav aria-label="FAQ categories" className="tn-card" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 4, position: 'sticky', top: 20 }}>
            {FAQ.map(([k, label, items]) => {
              const on = !term && k === cat;
              return (
                <button key={k} onClick={() => { setCat(k); setQ(''); }} aria-current={on ? 'true' : undefined}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: 12, border: 0, cursor: 'pointer', textAlign: 'left', font: `${on ? 700 : 500} 15px var(--font-body)`, background: on ? 'var(--tn-navy)' : 'transparent', color: on ? '#fff' : 'var(--tn-navy)' }}>
                  {label}<span className="tn-mono" style={{ fontSize: 12, color: on ? 'var(--tn-yellow)' : 'var(--tn-muted)' }}>{items.length}</span>
                </button>
              );
            })}
          </nav>
          <div className="tn-stack" style={{ gap: 14 }}>
            <div className="tn-between"><span className="tn-eyebrow">{catLabel}</span><span className="tn-label">{visible.length} question{visible.length === 1 ? '' : 's'}</span></div>
            {visible.length === 0 && <div className="tn-empty">No answer yet. Ask it below and we’ll add it.</div>}
            {visible.map(([question, answer, links]) => {
              const isOpen = open === question || !!term;
              return (
                <div key={question} style={{ background: '#fff', border: 'var(--border)', borderRadius: 18, boxShadow: isOpen ? '4px 4px 0 var(--tn-blue)' : 'none', overflow: 'hidden' }}>
                  <button onClick={() => setOpen(isOpen && !term ? '' : question)} aria-expanded={isOpen}
                    style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '18px 22px', border: 0, cursor: 'pointer', textAlign: 'left', background: isOpen ? 'var(--tn-yellow)' : '#fff', borderBottom: isOpen ? '2px solid var(--tn-navy)' : 0, font: `800 ${isOpen ? 20 : 18}px var(--font-display)`, color: 'var(--tn-navy)' }}>
                    {question}<Icon name={isOpen ? 'up' : 'down'} size={22} />
                  </button>
                  {isOpen && (
                    <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: 'var(--tn-ink-2)' }}>{answer}</p>
                      {links && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{links.map(([href, l], i) => <Link key={href} href={href} className={`tn-btn sm ${i === 0 ? 'dark' : ''}`}>{l}</Link>)}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 24, alignItems: 'start' }}>
          <form onSubmit={ask} className="tn-card yellow" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 28 }}>
            <span className="tn-mono" style={{ fontSize: 13 }}>still_stuck?</span>
            <h2 style={{ fontSize: 28 }}>Ask your question</h2>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>The core team replies within a day. Keep your ticket number to check the answer here.</p>
            {sent ? (
              <div className="tn-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 6 }} role="status">
                <b style={{ fontSize: 18 }}>Sent! Your ticket is <span className="tn-mono">{sent}</span></b>
                <span style={{ fontSize: 14 }}>Use it with your email in “Check your answer” to see our reply.</span>
                <button type="button" className="tn-link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => { setTrack({ ticket: sent, email: form.email }); setSent(null); }}>Ask another question</button>
              </div>
            ) : (
              <>
                <div className="tn-form-grid">
                  <div className="tn-field"><label htmlFor="qn">Your name</label><input id="qn" className="tn-input" required maxLength={60} value={form.name} onChange={set('name')} /></div>
                  <div className="tn-field"><label htmlFor="qe">Email</label><input id="qe" type="email" className="tn-input" required maxLength={120} value={form.email} onChange={set('email')} /></div>
                </div>
                <div className="tn-field"><label htmlFor="qt">Topic</label><select id="qt" className="tn-select" value={form.topic} onChange={set('topic')}>{TOPIC_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
                <div className="tn-field"><label htmlFor="qm">Your question</label><textarea id="qm" className="tn-textarea" rows={4} required maxLength={1000} value={form.message} onChange={set('message')} placeholder="e.g. Can I join the DSA bootcamp if I’m in ECE?" /></div>
                <button className="tn-btn dark" style={{ alignSelf: 'flex-start' }} disabled={busy}>{busy ? 'Sending…' : 'Send question'}</button>
              </>
            )}
          </form>
          <div className="tn-stack" style={{ gap: 24 }}>
            <form onSubmit={onTrack} className="tn-card" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 28 }}>
              <span className="tn-eyebrow">check_your_answer</span>
              <h2 style={{ fontSize: 26 }}>Already asked?</h2>
              <div className="tn-form-grid">
                <div className="tn-field"><label htmlFor="tt">Ticket</label><input id="tt" className="tn-input mono" required placeholder="TN-Q-0042" value={track.ticket} onChange={(e) => setTrack({ ...track, ticket: e.target.value })} /></div>
                <div className="tn-field"><label htmlFor="te">Email</label><input id="te" type="email" className="tn-input" required value={track.email} onChange={(e) => setTrack({ ...track, email: e.target.value })} /></div>
              </div>
              <button className="tn-btn" style={{ alignSelf: 'flex-start' }}>Check</button>
              {tracked && (
                <div style={{ border: '2px dashed var(--tn-blue)', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }} role="status">
                  <span className="tn-mono" style={{ fontSize: 12 }}>{tracked.ticket} · {tracked.status}</span>
                  <span style={{ fontSize: 14, color: 'var(--tn-muted)' }}>“{tracked.message}”</span>
                  <span style={{ fontSize: 15, lineHeight: 1.6 }}>{tracked.reply || 'No reply yet. We usually answer within a day.'}</span>
                </div>
              )}
            </form>
            <div className="tn-card" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 28 }}>
              <span className="tn-eyebrow">new_here?</span>
              <h2 style={{ fontSize: 26 }}>See the 4-step path to joining</h2>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--tn-ink-2)' }}>From finding a cohort to your first mission, explained on the home page with a 1-minute video.</p>
              <Link href="/#how" className="tn-btn primary" style={{ alignSelf: 'flex-start' }}>Show me how</Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
