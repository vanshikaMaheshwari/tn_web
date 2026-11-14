'use client';
import Link from 'next/link';
import { useCallback, useMemo, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import Tour from '@/components/onboarding/Tour';
import AvatarBot from './AvatarBot';
import s from './card.module.css';

const SKILL_LABEL = { videos: 'Videos', quizzes: 'Quizzes', projects: 'Projects', consistency: 'Consistency', punctuality: 'On-time' };
const SKILL_KEYS = Object.keys(SKILL_LABEL);
const card = { background: '#fff', border: 'var(--border)', borderRadius: 20, boxShadow: 'var(--shadow)', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 };
const label = (t, color = 'var(--tn-blue-ink)') => <span className="tn-mono" style={{ fontSize: 12, fontWeight: 700, color, letterSpacing: '.02em' }}>{t}</span>;
const H2 = ({ children, light }) => <h2 style={{ fontSize: 26, color: light ? '#fff' : undefined }}>{children}</h2>;
const Chip = ({ children, bg = '#e8f0ff' }) => (
  <span className="tn-mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, background: bg, border: '2px solid var(--tn-navy)', borderRadius: 8, padding: '2px 8px', whiteSpace: 'nowrap' }}>{children}</span>
);

export function ago(date) {
  if (!date) return '';
  const m = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export const missionHref = (m) =>
  m.type === 'quiz' ? `/dashboard/quiz/${m.id}` : m.type === 'project' ? `/dashboard/project/${m.id}` : '/dashboard';

// ------------------------------------------------------------------ //
// Dev ID (flip card)
// ------------------------------------------------------------------ //

function Radar({ skills }) {
  const cx = 110, cy = 104, R = 74;
  const pt = (i, r) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const poly = (f) => SKILL_KEYS.map((_, i) => pt(i, R * f).map((n) => n.toFixed(1)).join(',')).join(' ');
  const vals = SKILL_KEYS.map((k) => (skills[k]?.value || 0) / 100);
  const shape = vals.map((v, i) => pt(i, R * Math.max(v, 0.04)));
  const short = { videos: 'Videos', quizzes: 'Quizzes', projects: 'Projects', consistency: 'Streak', punctuality: 'On-time' };
  return (
    <svg width="220" height="208" viewBox="0 0 220 208" role="img" aria-label={`Skill DNA: ${SKILL_KEYS.map((k) => `${SKILL_LABEL[k]} ${skills[k]?.value || 0}`).join(', ')}`}>
      {[1, 0.66, 0.33].map((f) => <polygon key={f} points={poly(f)} fill="none" stroke="#fff" strokeOpacity=".22" strokeWidth="1.5" />)}
      {SKILL_KEYS.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#fff" strokeOpacity=".22" />; })}
      <polygon points={shape.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ')} fill="#4fd1ff" fillOpacity=".45" stroke="#4fd1ff" strokeWidth="3" />
      {shape.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill="#ffe45c" stroke="#0b2a5b" strokeWidth="2" />)}
      {SKILL_KEYS.map((k, i) => { const [x, y] = pt(i, R + 16); return <text key={k} x={x} y={y + 4} textAnchor="middle" fontFamily="Space Mono, monospace" fontSize="10" fontWeight="700" fill="#cfe0ff">{short[k]}</text>; })}
    </svg>
  );
}

function QrMark({ seed }) {
  // Decorative verify mark derived from the enrollment number (the real link is printed beside it).
  const bits = useMemo(() => {
    let h = 2166136261;
    const finder = (x, y) => (x < 3 && y < 3) || (x > 3 && y < 3) || (x < 3 && y > 3);
    return Array.from({ length: 49 }, (_, i) => {
      const x = i % 7, y = Math.floor(i / 7);
      if (finder(x, y)) return x % 4 === 1 && y % 4 === 1 ? 0 : 1;
      h ^= seed.charCodeAt(i % seed.length) + i;
      h = Math.imul(h, 16777619) >>> 0;
      return (h >>> 7) & 1;
    });
  }, [seed]);
  return (
    <svg width="54" height="54" viewBox="0 0 7 7" style={{ background: '#fff', borderRadius: 6, padding: 4, flex: 'none' }} aria-hidden="true">
      {bits.map((b, i) => (b ? <rect key={i} x={i % 7} y={Math.floor(i / 7)} width="1" height="1" fill="#0b2a5b" /> : null))}
    </svg>
  );
}

function DevId({ c, frontRef }) {
  const [flipped, setFlipped] = useState(false);
  const built = (c.avatar?.builtFrom || []).join(' · ') || 'your interests';
  const top3 = (c.badges?.earned || []).slice(0, 3);
  const publicPath = `techneeds/u/${c.me.enrollmentNumber.toLowerCase()}`;
  return (
    <div className={s.cardCol}>
      <button
        type="button"
        className={`${s.flip} ${flipped ? s.flipped : ''}`}
        onClick={() => setFlipped((f) => !f)}
        aria-pressed={flipped}
        aria-label={`${c.me.name}'s Dev ID card. Press to flip to the ${flipped ? 'front' : 'skill DNA side'}.`}
      >
        <div className={s.inner}>
          <div className={s.face} ref={frontRef}>
            <div className={s.holo} />
            <div className="tn-between" style={{ position: 'relative' }}>
              <span className="tn-mono" style={{ fontSize: 11, color: '#8ec5ff' }}>TECHNEEDS · DEV ID</span>
              <span className={`${s.rarity} ${s[c.rarity] || s.common}`}>{c.rarity} · LVL {c.level.level}</span>
            </div>
            <div className={s.avatarBox}>
              <AvatarBot traits={c.avatar} label={`AI avatar built from ${built}`} />
              <span className="tn-mono" style={{ position: 'absolute', left: 10, bottom: 10, fontSize: 10, color: '#fff', background: 'rgba(11,42,91,.7)', padding: '2px 6px', borderRadius: 6 }}>built from: {built}</span>
            </div>
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, lineHeight: 1.05 }}>{c.me.name}</span>
              <span className="tn-hand" style={{ fontSize: 24, color: 'var(--tn-yellow)' }}>“{c.ai.archetype}”</span>
              <span style={{ fontSize: 13, color: '#cfe0ff' }}>{c.me.enrollmentNumber} · {c.me.program}</span>
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,.18)', overflow: 'hidden' }}><div style={{ width: `${c.level.progress}%`, height: '100%', background: 'var(--tn-yellow)' }} /></div>
              <span className="tn-mono" style={{ fontSize: 10, color: '#8ec5ff' }}>LVL {c.level.level + 1} at {c.level.nextAt.toLocaleString('en-IN')}</span>
            </div>
            <div className={s.statGrid}>
              {[[c.rank ? `#${c.rank}` : '—', c.rank ? `RANK / ${c.totalMentees}` : 'RANK HIDDEN'], [c.score.toLocaleString('en-IN'), 'POINTS'], [`${c.streak}`, 'DAY STREAK']].map(([v, l]) => (
                <div key={l}><span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20 }}>{v}</span><span className="tn-mono" style={{ fontSize: 10, color: '#8ec5ff' }}>{l}</span></div>
              ))}
            </div>
          </div>
          <div className={`${s.face} ${s.back}`}>
            <div className="tn-between">
              <span className="tn-mono" style={{ fontSize: 11, color: '#8ec5ff' }}>SKILL DNA · LIVE</span>
              <span className="tn-mono" style={{ fontSize: 11, color: 'var(--tn-yellow)' }}>{c.completed}/{c.totalResources} missions</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}><Radar skills={c.skills} /></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {top3.map((b, i) => (
                <span key={b.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: ['var(--tn-yellow)', 'var(--tn-sky)', '#ffd1dc'][i], color: 'var(--tn-navy)', border: '2px solid var(--tn-navy)', borderRadius: 8, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
                  <Icon name={b.icon} size={14} /> {b.name}
                </span>
              ))}
            </div>
            {c.openToOpportunities && <span className="tn-mono" style={{ alignSelf: 'center', fontSize: 11, color: 'var(--tn-navy)', background: '#3ddc97', border: '2px solid #fff', borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>OPEN TO OPPORTUNITIES</span>}
            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 12, borderTop: '2px dashed rgba(255,255,255,.3)', paddingTop: 12 }}>
              <QrMark seed={c.me.enrollmentNumber} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>Verified by TechNeeds</span>
                <span className="tn-mono" style={{ fontSize: 11, color: '#8ec5ff', overflowWrap: 'anywhere' }}>{publicPath}</span>
              </div>
            </div>
          </div>
        </div>
      </button>
      <span className="tn-hand" style={{ fontSize: 22, color: 'var(--tn-blue-ink)', textAlign: 'center' }}>
        ↻ tap to flip{c.avatar?.nextUnlock ? ` · ${c.avatar.nextUnlock.item} unlocks at Lvl ${c.avatar.nextUnlock.level}` : ''}
      </span>
    </div>
  );
}

// ------------------------------------------------------------------ //
// AI read-out + rank forecast
// ------------------------------------------------------------------ //

function Evidence({ text, facts }) {
  const allowed = new Set(facts || []);
  const parts = String(text || '').split(/\[\[(.+?)\]\]/g);
  return parts.map((p, i) => (i % 2 === 1 ? (allowed.has(p) ? <mark key={i} className={s.ev} title="Pulled from your real activity">{p}</mark> : <span key={i}>{p}</span>) : <span key={i}>{p}</span>));
}

function Forecast({ f, who }) {
  if (!f) return null;
  const steps = f.steps || [];
  const ranks = [f.rank, ...steps.map((x) => x.rank)].filter((r, i, a) => a.indexOf(r) === i);
  if (!ranks.includes(1)) ranks.push(1);
  const pos = (i) => 6 + (i * 88) / Math.max(1, ranks.length - 1);
  const finalIdx = ranks.indexOf(f.finalRank);
  const n = steps.length;
  const msg = f.rank === 1
    ? `${who === 'you' ? 'You’re' : `${who} is`} #1. Defend the crown!`
    : n && f.finalRank <= 3 && f.rank > 3
      ? `${n} mission${n > 1 ? 's' : ''} away from the podium!`
      : n && f.finalRank < f.rank
        ? `${n} mission${n > 1 ? 's' : ''} to climb to #${f.finalRank}`
        : f.nextName ? `${f.gapToNext} pts behind ${f.nextName}. New missions drop soon!` : 'Keep going!';
  return (
    <div style={{ background: 'var(--tn-paper)', border: '2px dashed var(--tn-blue)', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="tn-between" style={{ alignItems: 'baseline' }}>
        {label('RANK FORECAST')}
        <span className="tn-hand" style={{ fontSize: 22, color: 'var(--tn-blue-ink)' }}>{msg}</span>
      </div>
      {ranks.length > 1 && (
        <div className={s.track} role="img" aria-label={`Rank path: ${ranks.map((r) => `#${r}`).join(' to ')}`}>
          <div className={s.trackLine} />
          {finalIdx > 0 && <div className={s.trackPath} style={{ left: `${pos(0)}%`, width: `${pos(finalIdx) - pos(0)}%` }} />}
          {ranks.map((r, i) => (
            <span key={r} className={s.node} style={{ left: `${pos(i)}%`, background: r === 1 ? 'var(--tn-navy)' : i === finalIdx && i > 0 ? 'var(--tn-yellow)' : '#fff', color: r === 1 ? '#fff' : 'var(--tn-navy)' }}>#{r}</span>
          ))}
        </div>
      )}
      {n > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: 14 }}>
          {steps.map((x) => <Chip key={x.resourceId}>+{x.points} · {x.title}</Chip>)}
          <span style={{ color: 'var(--tn-muted)' }}>= {f.finalScore.toLocaleString('en-IN')} pts{f.passes ? ` → passes ${f.passes.name} (${f.passes.score.toLocaleString('en-IN')})` : ''}</span>
        </div>
      )}
    </div>
  );
}

// "gemini-3.5-flash" -> "3.5 Flash", "gemini-flash-latest" -> "Flash"
function modelLabel(model) {
  if (!model) return '3.5 Flash';
  return model.replace(/^gemini-/, '').replace(/-latest$/, '').split('-')
    .map((w) => (/^\d/.test(w) ? w : w[0].toUpperCase() + w.slice(1))).join(' ');
}

function Readout({ c, mode, onRefresh, refreshing, interestsSlot }) {
  const who = mode === 'self' ? 'you' : c.me.name.split(' ')[0];
  const pending = ['pending', 'running'].includes(c.aiJob?.status);
  return (
    <div style={{ ...card, padding: 26 }}>
      <div className="tn-between">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Icon name="spark" size={20} color="var(--tn-blue)" />{label('AI READ-OUT')}</span>
        <span className="tn-mono" style={{ fontSize: 12, color: 'var(--tn-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {pending ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--tn-blue-ink)', fontWeight: 700 }} role="status">
              <span className={s.dot} /> Render Workflows · generating with Gemini…
            </span>
          ) : (
            <>{c.aiSource === 'gemini' ? `Gemini ${modelLabel(c.aiModel)}` : 'Rules engine'} · {ago(c.aiGeneratedAt)}{c.aiPipeline === 'render-workflows' ? ' · via Render Workflows' : ''}</>
          )}
          {onRefresh && (
            <button onClick={onRefresh} disabled={refreshing || pending} className="tn-mono" style={{ border: 0, background: 'none', color: 'var(--tn-blue-ink)', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 32 }}>
              <Icon name="refresh" size={13} color="var(--tn-blue-ink)" /> {refreshing ? 'queuing…' : 'refresh'}
            </button>
          )}
        </span>
      </div>
      <h1 style={{ fontSize: 'clamp(30px, 3.4vw, 40px)', lineHeight: 1.08, letterSpacing: '-0.02em' }}>{c.ai.headline}</h1>
      <p style={{ margin: 0, fontSize: 17, lineHeight: 1.75, color: 'var(--tn-ink-2)' }}><Evidence text={c.ai.summary} facts={c.facts} /></p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--tn-muted)' }}>
        <mark className={s.ev} style={{ fontSize: 12 }}>like this</mark> = a fact checked against your real activity. Anything the AI can’t back up is not highlighted.
      </div>
      {interestsSlot}
      {mode !== 'public' && <Forecast f={c.forecast} who={who} />}
    </div>
  );
}

// ------------------------------------------------------------------ //
// Growth constellation
// ------------------------------------------------------------------ //

function layout(clusters) {
  // Each cluster gets a column sized by its number of stars; stars zigzag up/down
  // and labels sit on the outside of the zigzag so they never collide.
  const W = 760, H = 350, PAD = 20;
  const total = clusters.reduce((n, cl) => n + Math.max(cl.nodes.length, 1.5), 0) || 1;
  let x0 = PAD;
  return clusters.map((cl, ci) => {
    const colW = ((W - PAD * 2) * Math.max(cl.nodes.length, 1.5)) / total;
    const n = cl.nodes.length;
    const cy = ci % 2 ? 165 : 185;
    const nodes = cl.nodes.map((node, i) => {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const up = i % 2 === 1;
      return { ...node, x: x0 + 40 + t * Math.max(0, colW - 80), y: cy + (up ? -55 : 55) + Math.sin(i * 2.1 + ci) * 12, below: !up };
    });
    const out = { ...cl, nodes, lx: x0 + colW / 2, ly: ci % 2 ? H - 12 : 24 };
    x0 += colW;
    return out;
  });
}

function Constellation({ c, mode }) {
  const placed = useMemo(() => layout(c.constellation || []), [c.constellation]);
  const sparks = [[30, 40], [400, 34], [720, 140], [60, 320], [420, 330], [740, 300], [300, 300], [130, 70], [700, 24], [470, 150], [250, 30], [560, 320]];
  const linkable = mode === 'self';
  const total = placed.reduce((a, cl) => a + cl.nodes.length, 0);
  const doneN = placed.reduce((a, cl) => a + cl.nodes.filter((n) => n.state === 'done').length, 0);
  const star = (n) => {
    const { x, y } = n;
    let g;
    if (n.state === 'done') g = <><circle cx={x} cy={y} r="14" fill="#ffe45c" opacity=".18" /><path d={`M${x} ${y - 9}L${x + 2.6} ${y - 2.6}L${x + 9} ${y}L${x + 2.6} ${y + 2.6}L${x} ${y + 9}L${x - 2.6} ${y + 2.6}L${x - 9} ${y}L${x - 2.6} ${y - 2.6}Z`} fill="#ffe45c" /></>;
    else if (n.state === 'next') g = <><circle className={s.pulse} cx={x} cy={y} r="12" fill="none" stroke="#4fd1ff" strokeWidth="2.5" /><circle cx={x} cy={y} r="5.5" fill="#4fd1ff" /></>;
    else if (n.state === 'review') g = <><circle cx={x} cy={y} r="8" fill="none" stroke="#ffe45c" strokeWidth="2.5" strokeDasharray="3 2" /><circle cx={x} cy={y} r="3" fill="#ffe45c" /></>;
    else if (n.state === 'open') g = <circle cx={x} cy={y} r="6" fill="#8ec5ff" />;
    else g = <circle cx={x} cy={y} r="6" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="2" strokeDasharray="3 3" />;
    const color = { done: '#fff', next: '#4fd1ff', review: '#ffe45c', open: '#cfe0ff', missed: '#8ec5ff', lock: '#8ec5ff' }[n.state];
    const title = n.title.length > 16 ? `${n.title.slice(0, 15)}…` : n.title;
    const stateText = { done: 'done', next: 'AI suggests next', review: 'in review', open: 'open', missed: 'missed', lock: 'locked' }[n.state];
    const body = (
      <g>
        <title>{`${n.title} (${n.type}) · ${stateText}`}</title>
        {g}
        <circle cx={x} cy={y} r="16" fill="transparent" />
        <text x={x} y={n.below ? y + 28 : y - 20} textAnchor="middle" fontFamily="Space Mono, monospace" fontSize="11" fontWeight="700" fill={color}>{title}</text>
      </g>
    );
    return linkable && ['next', 'open'].includes(n.state)
      ? <a key={n.id} href={missionHref(n)} aria-label={`${n.title}: ${stateText}. Open mission.`}>{body}</a>
      : <g key={n.id}>{body}</g>;
  };
  const legend = [['#ffe45c', 'done', 'fill'], ['#4fd1ff', 'AI suggests next', 'ring'], ['#8ec5ff', 'open', 'fill'], ['#8ec5ff', 'locked', 'dash']];
  return (
    <div className="tn-navy" style={{ border: 'var(--border)', borderRadius: 20, boxShadow: '4px 4px 0 var(--tn-blue)', padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="tn-between" style={{ alignItems: 'flex-end' }}>
        <div className="tn-stack" style={{ gap: 4 }}>{label('GROWTH CONSTELLATION', 'var(--tn-yellow)')}<H2 light>{mode === 'self' ? 'Your' : `${c.me.name.split(' ')[0]}’s`} tech journey, star by star</H2></div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {legend.map(([col, t, kind]) => (
            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#cfe0ff' }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: kind === 'fill' ? col : 'transparent', border: kind === 'ring' ? `2.5px solid ${col}` : kind === 'dash' ? `2px dashed ${col}` : 'none' }} />{t}
            </span>
          ))}
        </div>
      </div>
      {total ? (
        <svg width="100%" viewBox="0 0 760 350" role="img" aria-label={`Growth constellation: ${doneN} of ${total} missions done across ${placed.map((cl) => cl.label).join(', ')}`} className={s.star}>
          {sparks.map(([x, y], i) => <circle key={i} className={s.twinkle} style={{ animationDelay: `${i * 0.3}s` }} cx={x} cy={y} r="1.3" fill="#fff" opacity=".5" />)}
          {placed.map((cl) => cl.nodes.slice(1).map((n, i) => {
            const a = cl.nodes[i];
            const lit = a.state === 'done' && n.state === 'done';
            return <line key={`${a.id}-${n.id}`} x1={a.x} y1={a.y} x2={n.x} y2={n.y} stroke={lit ? '#8ec5ff' : '#fff'} strokeOpacity={lit ? 1 : 0.35} strokeWidth={lit ? 2.5 : 1.5} strokeDasharray={lit ? undefined : '5 5'} />;
          }))}
          {placed.map((cl) => cl.nodes.map(star))}
          {placed.map((cl) => <text key={cl.key} x={cl.lx} y={cl.ly} textAnchor="middle" fontFamily="Space Mono, monospace" fontSize="12" fontWeight="700" fill="#ffe45c">{cl.label.toUpperCase()} · {cl.done}/{cl.total}</text>)}
        </svg>
      ) : <p style={{ color: '#cfe0ff' }}>Stars appear as your mentor adds missions.</p>}
      <span className="tn-mono" style={{ fontSize: 12, color: '#8ec5ff' }}>each star = a mission · clusters come from {mode === 'self' ? 'your' : 'their'} interest tags{linkable ? ' · tap a glowing star to start it' : ''}</span>
    </div>
  );
}

// ------------------------------------------------------------------ //
// Skill DNA bars, missions, badges, journey
// ------------------------------------------------------------------ //

function SkillBars({ c }) {
  const weakest = SKILL_KEYS.reduce((a, k) => ((c.skills[k]?.value ?? 0) < (c.skills[a]?.value ?? 0) ? k : a), SKILL_KEYS[0]);
  const hasCohort = SKILL_KEYS.some((k) => c.skills[k]?.cohort !== null && c.skills[k]?.cohort !== undefined);
  return (
    <div style={card}>
      <div className="tn-stack" style={{ gap: 4 }}>{label('SKILL DNA · THIS WEEK')}<H2>Where {c.mode === 'self' ? 'you stand' : 'they stand'}</H2></div>
      {SKILL_KEYS.map((k) => {
        const sk = c.skills[k] || { value: 0, delta: 0, cohort: null };
        return (
          <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="tn-between" style={{ fontSize: 14 }}>
              <span style={{ fontWeight: 700 }}>{SKILL_LABEL[k]}</span>
              <span className="tn-mono" style={{ fontSize: 12 }}>
                <b>{sk.value}</b>{' '}
                {sk.delta > 0 ? <span style={{ color: '#158a5b' }}>+{sk.delta}</span> : k === weakest ? <span style={{ color: '#b4232c' }}>focus</span> : <span style={{ color: 'var(--tn-muted)' }}>±{Math.abs(sk.delta)}</span>}
              </span>
            </div>
            <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={sk.value} aria-label={`${SKILL_LABEL[k]} ${sk.value} of 100${sk.cohort !== null ? `, cohort average ${sk.cohort}` : ''}`} style={{ height: 14, background: '#e8f0ff', border: '2px solid var(--tn-navy)', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
              <div style={{ width: `${sk.value}%`, height: '100%', background: k === weakest ? 'var(--tn-yellow)' : 'var(--tn-blue)', transition: 'width .8s' }} />
              {sk.cohort !== null && sk.cohort !== undefined && <div style={{ position: 'absolute', top: -2, bottom: -2, left: `${sk.cohort}%`, borderLeft: '2px dashed var(--tn-navy)' }} />}
            </div>
          </div>
        );
      })}
      {hasCohort && <span className="tn-mono" style={{ fontSize: 12, color: 'var(--tn-muted)' }}>┊ dashed line = cohort average · +n = change this week</span>}
    </div>
  );
}

function Missions({ c, mode }) {
  const list = c.nextMissions || [];
  return (
    <div style={{ ...card, gap: 14 }}>
      <div className="tn-stack" style={{ gap: 4 }}>{label('AI NEXT BEST MISSIONS')}<H2>What to do next, and why</H2></div>
      {list.length === 0 && <div className="tn-empty">All caught up! New missions will show here.</div>}
      {list.map((m, i) => (
        <div key={m.id} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: 14, background: i === 0 ? 'var(--tn-yellow)' : '#fff', border: 'var(--border)', borderRadius: 16 }}>
          <span className="tn-mono" style={{ fontWeight: 700, fontSize: 18, color: 'var(--tn-blue)', minWidth: 28 }}>0{i + 1}</span>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>{m.title}</span>
            <span style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--tn-ink-2)' }}>{m.why}</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Chip bg="#fff">{m.overdue ? 'late · ' : ''}up to +{m.points} pts</Chip>
              {m.impact > 0 && <Chip bg="#c9f5df">{SKILL_LABEL[m.skill]} ↑{m.impact}</Chip>}
              {m.daysLeft !== null && m.daysLeft >= 0 && m.daysLeft <= 7 && <Chip bg="#ffe2c2">{m.daysLeft === 0 ? 'due today' : `${m.daysLeft}d left`}</Chip>}
            </div>
          </div>
          {mode === 'self' && <Link href={missionHref(m)} className="tn-btn sm dark" style={{ alignSelf: 'center' }}>Start</Link>}
        </div>
      ))}
    </div>
  );
}

function Badges({ c }) {
  const { earned = [], locked = [] } = c.badges || {};
  const bgs = ['var(--tn-yellow)', 'var(--tn-sky)', '#ffd1dc', '#c9f5df', '#ece6ff'];
  return (
    <div style={card}>
      <div className="tn-between" style={{ alignItems: 'flex-end' }}>
        <div className="tn-stack" style={{ gap: 4 }}>{label('STICKER SHELF')}<H2>Badges</H2></div>
        <span className="tn-mono" style={{ fontSize: 12, color: 'var(--tn-muted)' }}>{earned.length} earned · {locked.length} to go</span>
      </div>
      {earned.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))', gap: 12 }}>
          {earned.map((b, i) => (
            <div key={b.name} className={s.sticker} style={{ background: bgs[i % bgs.length], transform: `rotate(${[-4, 3, -2, 4, -3][i % 5]}deg)` }} title={b.reason}>
              <Icon name={b.icon} size={30} />
              <span style={{ fontWeight: 700, fontSize: 13 }}>{b.name}</span>
              <span style={{ fontSize: 11, lineHeight: 1.35 }}>{b.reason}</span>
            </div>
          ))}
        </div>
      )}
      {locked.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))', gap: 12 }}>
          {locked.map((g) => (
            <div key={g.name} className={s.lockedBadge}>
              <Icon name={g.icon} size={26} color="#9fb4d8" />
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--tn-navy)' }}>{g.name}</span>
              <span className="tn-mono" style={{ fontSize: 10 }}>{g.goal}{g.note ? ` · ${g.note}` : ''}</span>
              <div style={{ width: '100%', height: 6, borderRadius: 3, background: '#e8f0ff', overflow: 'hidden' }}><div style={{ width: `${g.progress}%`, height: '100%', background: 'var(--tn-blue)' }} /></div>
            </div>
          ))}
        </div>
      )}
      <p className="tn-hand" style={{ margin: 0, fontSize: 20, color: 'var(--tn-blue-ink)' }}>The AI names each badge from what was actually done, so no two cards look alike.</p>
    </div>
  );
}

function Journey({ c }) {
  const { weeks = [], milestones = [], thisWeek = 0 } = c.journey || {};
  const W = 560, H = 190, mx = Math.max(10, ...weeks.map((w) => w.points)) * 1.08;
  const pts = weeks.map((w, i) => [20 + (i * (W - 40)) / Math.max(1, weeks.length - 1), H - 20 - (w.points / mx) * (H - 80)]);
  const path = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(0)} ${y.toFixed(0)}`).join(' ');
  const area = pts.length ? `${path} L${pts[pts.length - 1][0].toFixed(0)} ${H - 20} L${pts[0][0].toFixed(0)} ${H - 20} Z` : '';
  const seen = new Set();
  const pins = milestones.filter((m) => !seen.has(m.week) && seen.add(m.week));
  return (
    <div style={{ ...card, gap: 10 }}>
      <div className="tn-between" style={{ alignItems: 'flex-end' }}>
        <div className="tn-stack" style={{ gap: 4 }}>{label('JOURNEY')}<H2>10 weeks of growth</H2></div>
        <span className="tn-mono" style={{ fontSize: 13, fontWeight: 700, color: thisWeek > 0 ? '#158a5b' : 'var(--tn-muted)' }}>{thisWeek > 0 ? `↑ +${thisWeek} this week` : 'no points yet this week'}</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Points by week: ${weeks.map((w) => `${w.label} ${w.points}`).join(', ')}`}>
        <path d={area} fill="#2f6bff" fillOpacity=".14" />
        <path d={path} fill="none" stroke="#2f6bff" strokeWidth="3.5" strokeLinejoin="round" />
        {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill="#fff" stroke="#0b2a5b" strokeWidth="2"><title>{`${weeks[i].label}: ${weeks[i].points} pts`}</title></circle>)}
        {pins.map((m) => {
          const [x, y] = pts[m.week] || [0, 0];
          return (
            <g key={m.label}>
              <line x1={x} y1={y} x2={x} y2={y - 26} stroke="#0b2a5b" strokeWidth="2" />
              <rect x={x - 38} y={y - 46} width="76" height="22" rx="6" fill="#ffe45c" stroke="#0b2a5b" strokeWidth="2" />
              <text x={x} y={y - 31} textAnchor="middle" fontFamily="Space Mono, monospace" fontSize="10" fontWeight="700" fill="#0b2a5b">{m.label}</text>
            </g>
          );
        })}
        <line x1="20" y1={H - 20} x2={W - 20} y2={H - 20} stroke="#0b2a5b" strokeWidth="2" />
        {pts.map(([x], i) => <text key={i} x={x} y={H - 4} textAnchor="middle" fontFamily="Space Mono, monospace" fontSize="10" fill="#3a5a8c">{weeks[i].label}</text>)}
      </svg>
    </div>
  );
}

// ------------------------------------------------------------------ //
// Mentor's take + share/privacy
// ------------------------------------------------------------------ //

function MentorTake({ c, mode, onEndorse }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(c.endorsement?.text || '');
  const [busy, setBusy] = useState(false);
  const e = c.endorsement;
  if (!e && mode === 'public') return null;
  async function save(ev) {
    ev.preventDefault();
    setBusy(true);
    try { await onEndorse(text); setEditing(false); } finally { setBusy(false); }
  }
  return (
    <div className="tn-card yellow" style={{ borderRadius: 20, padding: 22, display: 'flex', flexDirection: 'column', gap: 10, transform: 'rotate(1deg)' }}>
      {label('MENTOR’S TAKE', 'var(--tn-navy)')}
      {editing ? (
        <form onSubmit={save} className="tn-stack" style={{ gap: 8 }}>
          <label htmlFor="endorse" className="sr-only">Endorsement</label>
          <textarea id="endorse" className="tn-textarea" maxLength={220} rows={3} value={text} onChange={(x) => setText(x.target.value)} placeholder="One line on what they do best…" />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="tn-btn sm dark" disabled={busy}>{busy ? 'Saving…' : 'Save note'}</button>
            <button type="button" className="tn-btn sm" onClick={() => setEditing(false)}>Cancel</button>
            <span className="tn-mono" style={{ fontSize: 11, marginLeft: 'auto' }}>{text.length}/220</span>
          </div>
        </form>
      ) : e ? (
        <>
          <p className="tn-hand" style={{ margin: 0, fontSize: 25, lineHeight: 1.2 }}>“{e.text}”</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="tn-avatar" style={{ width: 34, height: 34, background: 'var(--tn-blue)', color: '#fff', fontSize: 13 }}>{(e.mentorName || 'M').split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
            <span style={{ fontSize: 14 }}><b>{e.mentorName}</b> · mentor endorsement</span>
          </div>
        </>
      ) : (
        <p style={{ margin: 0, fontSize: 15 }}>{mode === 'mentor' ? 'Add a one-line endorsement. It shows on their card and public profile.' : 'Your mentor’s note shows up here once they endorse your work.'}</p>
      )}
      {mode === 'mentor' && !editing && <button className="tn-btn sm dark" style={{ alignSelf: 'flex-start' }} onClick={() => { setText(e?.text || ''); setEditing(true); }}>{e ? 'Edit note' : 'Write a note'}</button>}
    </div>
  );
}

function Toggle({ on, onClick, children, hint }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={`${s.toggle} ${on ? s.on : ''}`} onClick={onClick}>
      <span style={{ display: 'flex', flexDirection: 'column' }}><span>{children}</span>{hint && <span style={{ fontSize: 12, color: 'var(--tn-muted)' }}>{hint}</span>}</span>
      <span className={s.switch} />
    </button>
  );
}

function SharePanel({ c, onPrivacy, frontRef, toast }) {
  const p = c.privacy || {};
  const [png, setPng] = useState(false);
  const link = typeof window !== 'undefined' ? `${window.location.origin}/u/${c.me.enrollmentNumber}` : '';
  async function copy() {
    try { await navigator.clipboard.writeText(link); toast('Public link copied'); } catch { toast('Copy failed', 'error'); }
  }
  async function download() {
    if (!frontRef.current) return;
    setPng(true);
    try {
      const { toPng } = await import('html-to-image');
      const url = await toPng(frontRef.current, {
        pixelRatio: 2, width: 360, height: 540, cacheBust: true,
        style: { transform: 'none', position: 'static', inset: 'auto', margin: '0', boxShadow: 'none' },
      });
      const a = document.createElement('a');
      a.href = url;
      a.download = `techneeds-${c.me.enrollmentNumber.toLowerCase()}.png`;
      a.click();
    } catch { toast('Could not export the card. Try again.', 'error'); } finally { setPng(false); }
  }
  return (
    <div style={{ ...card, padding: 22, gap: 6 }}>
      {label('SHARE · PRIVACY FIRST')}
      <Toggle on={p.publicProfile} onClick={() => onPrivacy({ publicProfile: !p.publicProfile })} hint="Anyone with the link can view your card">Public profile link</Toggle>
      <Toggle on={p.showRank} onClick={() => onPrivacy({ showRank: !p.showRank })}>Show my rank publicly</Toggle>
      <Toggle on={p.recruiterVisible} onClick={() => onPrivacy({ recruiterVisible: !p.recruiterVisible })} hint="Adds an “open to opportunities” tag">Visible to recruiters</Toggle>
      <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
        <button className="tn-btn sm primary" style={{ flex: 1 }} onClick={copy} disabled={!p.publicProfile} title={p.publicProfile ? link : 'Turn on the public profile link first'}><Icon name="link" size={16} color="#fff" /> Copy link</button>
        <button className="tn-btn sm" style={{ flex: 1 }} onClick={download} disabled={png}><Icon name="arrow" size={16} /> {png ? 'Exporting…' : 'Card as PNG'}</button>
      </div>
      {p.publicProfile && <Link href={`/u/${c.me.enrollmentNumber}`} className="tn-mono" style={{ fontSize: 12, marginTop: 4 }}>preview public card →</Link>}
    </div>
  );
}

// ------------------------------------------------------------------ //
// Explanations: where each part comes from + what it means
// ------------------------------------------------------------------ //

const SOURCES = {
  ai: { icon: '✦', text: 'AI writes this', bg: '#ece6ff' },
  data: { icon: '▦', text: 'Calculated from your data', bg: 'var(--tn-sky)' },
  mentor: { icon: '✍', text: 'Written by your mentor', bg: 'var(--tn-yellow)' },
  you: { icon: '🔒', text: 'You control this', bg: '#C9F5DF' },
};
const SrcTag = ({ k }) => (
  <span className="tn-mono" title={SOURCES[k].text} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, background: SOURCES[k].bg, border: '2px solid var(--tn-navy)', borderRadius: 999, padding: '1px 9px', whiteSpace: 'nowrap', color: 'var(--tn-navy)' }}>
    <span aria-hidden="true">{SOURCES[k].icon}</span>{SOURCES[k].text}
  </span>
);

// Section meta, keyed by id. "means" is written for the mentee (self mode).
const SECTION = {
  devid: { title: 'Dev ID card', src: ['data', 'ai'], means: 'Your shareable ID. Level, points and badges are counted from your missions; the robot avatar is drawn from the interests you picked. Tap it to flip.' },
  readout: { title: 'AI read-out & rank forecast', src: ['ai', 'data'], means: 'Gemini writes a short summary of your progress. Every yellow-marked phrase is a real fact from your activity. The forecast shows the missions that would move you up the board.' },
  constellation: { title: 'Growth constellation', src: ['data'], means: 'Each star is a mission. Yellow = done, glowing blue = do next, dashed = missed or locked.' },
  skills: { title: 'Skill DNA', src: ['data'], means: 'Five scores out of 100, based on what you finished this week. The grey tick is the cohort average, so you can see where you’re ahead.' },
  missions: { title: 'Next best missions', src: ['ai', 'data'], means: 'The missions that help you most right now, with the reason why. The top one is highlighted.' },
  badges: { title: 'Badges', src: ['data'], means: 'Stickers unlock automatically when you hit milestones. Locked ones show what to do next.' },
  journey: { title: 'Weekly journey', src: ['data'], means: 'Points you earned each week. Flags mark milestones like your first project.' },
  mentor: { title: 'Mentor’s take', src: ['mentor'], means: 'A one-line note from your mentor. It’s the only part written by a person, and recruiters see it too.' },
  share: { title: 'Share & privacy', src: ['you'], means: 'Nothing is public until you switch it on. You choose whether your rank shows, and can turn it off any time.' },
};

function Sec({ id, n, mode, children, style }) {
  const m = SECTION[id];
  return (
    <div data-tour={`card-${id}`} style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--tn-navy)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, flex: 'none' }}>{n}</span>
        <b style={{ fontSize: 14 }}>{m.title}</b>
        {m.src.map((k) => <SrcTag key={k} k={k} />)}
      </div>
      {children}
      {mode !== 'public' && <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--tn-ink-2)' }}><b>What it means:</b> {m.means}</p>}
    </div>
  );
}

function CardGuide({ onTour, mode }) {
  const ideas = [
    ['✦', 'AI writes the words', 'Gemini writes the summary and tips. It never invents your numbers.'],
    ['▦', 'Numbers come from your data', 'Points, skills and badges are counted from missions you finished.'],
    ['▮', 'Yellow = checked fact', <>Every <mark className={s.ev}>yellow phrase</mark> is pulled from your real activity.</>],
    ['🔒', 'You control sharing', 'The card is private until you switch on the public link.'],
  ];
  return (
    <section className="tn-card" style={{ background: 'var(--tn-paper)', borderStyle: 'dashed', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="tn-between" style={{ gap: 12 }}>
        <div className="tn-stack" style={{ gap: 2 }}>
          {label('HOW_TO_READ_THIS.md')}
          <h2 style={{ fontSize: 24 }}>{mode === 'mentor' ? 'This AI card in 4 ideas' : 'Your AI card in 4 ideas'}</h2>
        </div>
        <button className="tn-btn sm primary" onClick={onTour}><Icon name="info" size={16} color="#fff" /> Show me around</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        {ideas.map(([ic, t, d], i) => (
          <div key={t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span aria-hidden="true" style={{ width: 32, height: 32, flex: 'none', borderRadius: 10, border: '2px solid var(--tn-navy)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{ic}</span>
            <span className="tn-stack" style={{ gap: 2 }}><b style={{ fontSize: 14 }}>{i + 1}. {t}</b><span style={{ fontSize: 13, color: 'var(--tn-ink-2)', lineHeight: 1.45 }}>{d}</span></span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
        <span className="tn-label">labels on each section:</span>
        {Object.keys(SOURCES).map((k) => <SrcTag key={k} k={k} />)}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ //
// Page composition
// ------------------------------------------------------------------ //

export default function AiCard({ c, mode = 'self', onRefresh, refreshing, interestsSlot, onPrivacy, onEndorse, toast }) {
  const frontRef = useRef(null);
  const [tour, setTour] = useState(false);
  // Numbering follows what's actually shown in this mode.
  const order = ['devid', 'readout', 'constellation', 'skills', ...(mode === 'public' ? [] : ['missions']), 'badges', 'journey', 'mentor', ...(mode === 'self' ? ['share'] : [])];
  const num = (id) => order.indexOf(id) + 1;
  const showMentor = !!c.endorsement || mode !== 'public';
  const tourKey = order.join(',') + showMentor;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tourSteps = useMemo(() => order.filter((id) => id !== 'mentor' || showMentor).map((id) => ({ id: `card-${id}`, title: `${num(id)}. ${SECTION[id].title}`, text: SECTION[id].means })), [tourKey]);
  const closeTour = useCallback(() => setTour(false), []);
  const side = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {showMentor && <Sec id="mentor" n={num('mentor')} mode={mode}><MentorTake c={c} mode={mode} onEndorse={onEndorse} /></Sec>}
      {mode === 'self' && <Sec id="share" n={num('share')} mode={mode}><SharePanel c={c} onPrivacy={onPrivacy} frontRef={frontRef} toast={toast} /></Sec>}
      {mode === 'public' && (
        <div style={{ ...card, padding: 22, gap: 8 }}>
          {label('ABOUT THIS CARD')}
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--tn-ink-2)' }}>
            Generated by TechNeeds IGDTUW from real mentorship activity: missions, quizzes, projects and streaks. The learner chose to make it public.
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{Object.keys(SOURCES).filter((k) => k !== 'you').map((k) => <SrcTag key={k} k={k} />)}</div>
          <Link href="/" className="tn-btn sm" style={{ alignSelf: 'flex-start' }}>Explore TechNeeds</Link>
        </div>
      )}
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
      {mode !== 'public' && <CardGuide mode={mode} onTour={() => setTour(true)} />}
      <section className={s.hero}>
        <Sec id="devid" n={num('devid')} mode={mode}><DevId c={c} frontRef={frontRef} /></Sec>
        <Sec id="readout" n={num('readout')} mode={mode}><Readout c={c} mode={mode} onRefresh={onRefresh} refreshing={refreshing} interestsSlot={interestsSlot} /></Sec>
      </section>
      <section className={s.rowWide}>
        <Sec id="constellation" n={num('constellation')} mode={mode}><Constellation c={c} mode={mode} /></Sec>
        <Sec id="skills" n={num('skills')} mode={mode}><SkillBars c={c} /></Sec>
      </section>
      {mode === 'public' ? (
        <>
          <section className={s.rowHalf}><Sec id="badges" n={num('badges')} mode={mode}><Badges c={c} /></Sec>{side}</section>
          <section><Sec id="journey" n={num('journey')} mode={mode}><Journey c={c} /></Sec></section>
        </>
      ) : (
        <>
          <section className={s.rowHalf}><Sec id="missions" n={num('missions')} mode={mode}><Missions c={c} mode={mode} /></Sec><Sec id="badges" n={num('badges')} mode={mode}><Badges c={c} /></Sec></section>
          <section className={s.rowWide}><Sec id="journey" n={num('journey')} mode={mode}><Journey c={c} /></Sec>{side}</section>
        </>
      )}
      <Tour steps={tourSteps} open={tour} onClose={closeTour} />
    </div>
  );
}
