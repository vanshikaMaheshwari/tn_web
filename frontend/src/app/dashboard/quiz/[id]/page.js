'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import { getQuiz, submitQuiz } from '@/lib/api';
import { ErrorBox, Loading } from '@/components/ui/Brand';
import Icon from '@/components/ui/Icon';

const KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

function fmt(ms) {
  if (ms <= 0) return '00:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function QuizPage() {
  const { ready } = useAuth('mentee');
  const { id } = useParams();
  const router = useRouter();
  const [quiz, setQuiz] = useState(null);
  const [error, setError] = useState('');
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const submitted = useRef(false);
  const storeKey = `tn_quiz_${id}`;

  useEffect(() => {
    if (!ready) return;
    getQuiz(id)
      .then((q) => {
        setQuiz(q);
        try { setAnswers(JSON.parse(sessionStorage.getItem(storeKey) || '{}')); } catch { /* ignore */ }
      })
      .catch((e) => setError(e.message));
  }, [ready, id, storeKey]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const choose = (qid, i) => {
    const next = { ...answers, [qid]: i };
    setAnswers(next);
    try { sessionStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const submit = useCallback(async () => {
    if (!quiz || submitted.current) return;
    submitted.current = true;
    setBusy(true);
    try {
      const payload = quiz.questions.map((q) => ({ questionId: q.id, selectedOptionIndex: answers[q.id] ?? -1 }));
      const r = await submitQuiz(id, payload);
      try { sessionStorage.removeItem(storeKey); } catch { /* ignore */ }
      setResult(r);
    } catch (e) {
      submitted.current = false;
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [quiz, answers, id, storeKey]);

  const remaining = quiz?.endTime ? new Date(quiz.endTime).getTime() - now : null;
  useEffect(() => {
    if (remaining !== null && remaining <= 0 && quiz && !result) submit();
  }, [remaining, quiz, result, submit]);

  if (!ready) return null;

  const header = (
    <header className="tn-header">
      <Link href="/dashboard" className="tn-btn sm"><Icon name="back" size={18} /> Exit to Launchpad</Link>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <span className="tn-eyebrow">QUIZ · {quiz?.maxScore ?? '–'} pts</span>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22 }}>{quiz?.title || 'Loading…'}</span>
      </div>
      <span className="tn-mono" style={{ fontSize: 18, fontWeight: 700, background: remaining !== null && remaining < 120000 ? 'var(--tn-orange-bg)' : 'var(--tn-yellow)', border: 'var(--border)', borderRadius: 12, padding: '8px 16px' }} aria-live="off">
        {remaining !== null ? `${fmt(remaining)} left` : 'No time limit'}
      </span>
    </header>
  );

  if (result) {
    const pct = result.maxScore ? Math.round((result.score / result.maxScore) * 100) : 0;
    return (
      <>
        {header}
        <main className="tn-wrap" style={{ alignItems: 'center' }}>
          <div className="tn-navy" style={{ maxWidth: 640, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', padding: 48 }}>
            <span className="tn-pill yellow">MISSION COMPLETE</span>
            <div className="tn-big" style={{ fontSize: 88, color: '#fff' }}>{result.score}<span style={{ fontSize: 36, color: '#8ec5ff' }}> / {result.maxScore}</span></div>
            <p style={{ fontSize: 18, color: '#cfe0ff' }}>{result.correct} of {result.total} correct · {pct}%</p>
            <span className="tn-hand" style={{ fontSize: 28, color: 'var(--tn-yellow)' }}>{pct >= 80 ? 'quiz ace energy!' : pct >= 50 ? 'solid run, keep going' : 'every attempt teaches something'}</span>
            <p style={{ color: '#cfe0ff' }}>Streak: {result.streak} day{result.streak === 1 ? '' : 's'}</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="tn-btn cyan" onClick={() => router.push('/dashboard')}>Back to Launchpad</button>
              <Link href="/leaderboard" className="tn-btn ghost-light">See leaderboard</Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (error) return <>{header}<main className="tn-wrap"><ErrorBox message={error} /><Link href="/dashboard" className="tn-btn" style={{ alignSelf: 'flex-start' }}>Back to Launchpad</Link></main></>;
  if (!quiz) return <>{header}<main className="tn-wrap"><Loading rows={3} /></main></>;

  const q = quiz.questions[idx];
  const answered = Object.keys(answers).filter((k) => quiz.questions.some((x) => x.id === k)).length;
  const last = idx === quiz.questions.length - 1;

  return (
    <>
      {header}
      <main className="tn-wrap" style={{ gap: 24 }}>
        <div className="tn-bar" style={{ height: 14 }} role="progressbar" aria-valuenow={answered} aria-valuemin={0} aria-valuemax={quiz.questions.length} aria-label="Questions answered">
          <span style={{ width: `${(answered / quiz.questions.length) * 100}%` }} />
        </div>
        <section className="tn-row" style={{ gap: 28 }}>
          <div className="tn-card tn-main-col" style={{ padding: 36, gap: 22, boxShadow: '6px 6px 0 var(--tn-navy)' }}>
            <div className="tn-between">
              <span className="tn-eyebrow" style={{ fontSize: 14, fontWeight: 700 }}>QUESTION {idx + 1} OF {quiz.questions.length}</span>
              <span className="tn-label" style={{ fontSize: 14 }}>{q.marks} pt{q.marks === 1 ? '' : 's'}</span>
            </div>
            <h1 style={{ fontSize: 'clamp(26px, 3vw, 36px)', lineHeight: 1.15 }}>{q.questionText}</h1>
            <div role="radiogroup" aria-label="Answer options" className="tn-stack">
              {q.options.map((opt, i) => (
                <button key={i} role="radio" aria-checked={answers[q.id] === i} className={`tn-option ${answers[q.id] === i ? 'selected' : ''}`} onClick={() => choose(q.id, i)}>
                  <span className="key">{KEYS[i]}</span>{opt}
                </button>
              ))}
            </div>
            <div className="tn-between" style={{ marginTop: 4 }}>
              <button className="tn-btn" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>← Previous</button>
              {last
                ? <button className="tn-btn yellow" onClick={submit} disabled={busy}>{busy ? 'Submitting…' : 'Submit quiz'}</button>
                : <button className="tn-btn primary" onClick={() => setIdx((i) => i + 1)}>Next question →</button>}
            </div>
          </div>
          <aside className="tn-side-col" style={{ flexBasis: 280 }}>
            <div className="tn-card">
              <h2 style={{ fontSize: 20, marginBottom: 14 }}>Questions</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {quiz.questions.map((x, i) => (
                  <button key={x.id} className={`tn-qnav ${i === idx ? 'current' : answers[x.id] !== undefined ? 'answered' : ''}`} onClick={() => setIdx(i)} aria-label={`Question ${i + 1}${answers[x.id] !== undefined ? ', answered' : ''}`}>{i + 1}</button>
                ))}
              </div>
              <p className="tn-muted" style={{ fontSize: 13, marginTop: 12 }}>Yellow = answered · Blue = current</p>
            </div>
            <div className="tn-navy" style={{ padding: 24 }}>
              <span className="tn-mono" style={{ fontSize: 12, color: '#8ec5ff' }}>heads_up</span>
              <p style={{ fontSize: 15, lineHeight: 1.5, color: '#cfe0ff', marginTop: 6 }}>One attempt only. Answers save as you go{quiz.endTime ? ' and the quiz auto-submits when the timer ends' : ''}.</p>
            </div>
            <button className="tn-btn yellow" onClick={submit} disabled={busy}>{busy ? 'Submitting…' : `Submit quiz (${answered}/${quiz.questions.length})`}</button>
          </aside>
        </section>
      </main>
    </>
  );
}
