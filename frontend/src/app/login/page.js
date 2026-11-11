'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Logo } from '@/components/ui/Brand';
import Icon from '@/components/ui/Icon';
import { login, session } from '@/lib/api';

const ROLES = {
  mentee: { label: 'Mentee', idLabel: 'Enrollment number', placeholder: 'TN-WEBD-0004', mono: true, dest: '/dashboard' },
  mentor: { label: 'Mentor', idLabel: 'Email', placeholder: 'you@igdtuw.ac.in', mono: false, dest: '/mentor' },
  admin: { label: 'Admin', idLabel: 'Admin email', placeholder: 'admin@techneeds.dev', mono: false, dest: '/admin' },
};

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = ROLES[params.get('role')] ? params.get('role') : 'mentee';
  const [role, setRole] = useState(initial);
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = session.get();
    if (s.token && ROLES[s.role]) router.replace(ROLES[s.role].dest);
  }, [router]);

  const cfg = ROLES[role];

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(role, { id: id.trim(), password });
      router.push(cfg.dest);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', padding: 32, gap: 32 }}>
      <section className="tn-navy" style={{ flex: '1 1 520px', borderRadius: 32, boxShadow: '8px 8px 0 var(--tn-blue)', padding: 48, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 32 }}>
        <Logo light />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h1 style={{ fontSize: 'clamp(44px, 6vw, 64px)', lineHeight: 1 }}>Ready for<br /><span style={{ color: 'var(--tn-yellow)' }}>liftoff?</span></h1>
          <p style={{ fontSize: 18, lineHeight: 1.55, color: '#cfe0ff', maxWidth: 440 }}>
            One login screen for the whole crew. Pick your role and we’ll open the right dashboard.
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {Object.entries({ admin: 'command deck', mentor: 'mission control', mentee: 'launchpad' }).map(([r, d]) => (
            <span key={r} className="tn-mono" style={{ fontSize: 13, padding: '6px 12px', border: `2px solid ${r === role ? 'var(--tn-yellow)' : '#8ec5ff'}`, borderRadius: 999, color: r === role ? 'var(--tn-yellow)' : '#cfe0ff' }}>
              {r} → {d}
            </span>
          ))}
        </div>
      </section>

      <section style={{ flex: '1 1 480px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <form onSubmit={onSubmit} className="tn-card" style={{ width: '100%', maxWidth: 520, padding: 40, display: 'flex', flexDirection: 'column', gap: 20, boxShadow: '6px 6px 0 var(--tn-navy)' }}>
          <div>
            <h2 style={{ fontSize: 34 }}>Log in</h2>
            <span className="tn-hand" style={{ fontSize: 22, color: 'var(--tn-blue-ink)' }}>pick your role first ↓</span>
          </div>
          <div role="tablist" aria-label="Role" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, background: 'var(--tn-paper)', border: '2px solid var(--tn-navy)', borderRadius: 14, padding: 5 }}>
            {Object.entries(ROLES).map(([key, r]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={role === key}
                onClick={() => { setRole(key); setError(''); setId(''); }}
                style={{ minHeight: 44, borderRadius: 10, border: 'none', cursor: 'pointer', background: role === key ? 'var(--tn-navy)' : 'transparent', color: role === key ? '#fff' : 'var(--tn-navy)', font: `${role === key ? 700 : 600} 15px var(--font-body)` }}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="tn-field">
            <label htmlFor="login-id">{cfg.idLabel}</label>
            <input id="login-id" className={`tn-input ${cfg.mono ? 'mono' : ''}`} style={{ minHeight: 50 }} value={id} onChange={(e) => setId(e.target.value)} placeholder={cfg.placeholder} autoComplete="username" required />
          </div>
          <div className="tn-field">
            <label htmlFor="login-pw">Password</label>
            <input id="login-pw" type="password" className="tn-input" style={{ minHeight: 50 }} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          {error && <p role="alert" className="tn-pill orange" style={{ fontSize: 14, padding: '8px 12px', fontFamily: 'var(--font-body)' }}>{error}</p>}
          <button type="submit" className="tn-btn primary" style={{ minHeight: 54, fontSize: 16 }} disabled={busy}>
            <Icon name="rocket" color="#fff" size={20} /> {busy ? 'Launching…' : 'Launch my session'}
          </button>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--tn-ink-2)' }}>
            {role === 'mentee'
              ? 'Your mentor shares your enrollment number and first password. Forgot it? Ask them to reset it from Mission control.'
              : role === 'mentor'
                ? 'Mentor accounts are created by the TechNeeds admin, who shares your password once.'
                : 'Admin credentials are set on the server (ADMIN_EMAIL / ADMIN_PASSWORD).'}
          </p>
        </form>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
