'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo } from '../ui/Brand';
import Icon from '../ui/Icon';
import { session, logout, initials } from '@/lib/api';

const PUBLIC_LINKS = [
  ['/', 'Home'],
  ['/events', 'Events'],
  ['/techboard', 'Techboard'],
  ['/team', 'Team'],
  ['/leaderboard', 'Leaderboard'],
  ['/faq', 'FAQs'],
];
const MENTEE_LINKS = [
  ['/dashboard', 'Launchpad'],
  ['/classes', 'Classes'],
  ['/profile', 'My AI card'],
  ['/leaderboard', 'Leaderboard'],
];

// Mentor and admin areas render their own chrome; the login page is full-bleed.
const HIDDEN = ['/mentor', '/admin', '/login'];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [s, setS] = useState({ token: null, role: null, name: null });

  useEffect(() => { setS(session.get()); }, [pathname]);

  if (HIDDEN.some((p) => pathname === p || pathname.startsWith(p + '/'))) return null;
  if (pathname.startsWith('/dashboard/quiz')) return null; // focused quiz mode

  const isMentee = s.role === 'mentee' && s.token;
  const links = isMentee ? MENTEE_LINKS : PUBLIC_LINKS;
  const home = isMentee ? '/dashboard' : '/';
  const dash = s.role === 'mentor' ? '/mentor' : '/dashboard';

  return (
    <header className="tn-header">
      <Logo href={home} />
      <nav className="tn-nav" aria-label="Primary">
        {links.map(([href, label]) => {
          const active = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
          return (
            <Link key={href} href={href} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
              {label}
            </Link>
          );
        })}
      </nav>
      {s.token ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!isMentee && <Link href={dash} className="tn-btn sm primary">My dashboard</Link>}
          <span className="tn-avatar" title={s.name || ''}>{initials(s.name || '')}</span>
          <button
            className="tn-btn sm"
            onClick={() => { logout(); router.push('/'); }}
            aria-label="Log out"
          >
            <Icon name="logout" size={18} />
          </button>
        </div>
      ) : (
        <Link href="/login" className="tn-btn primary">Log in</Link>
      )}
    </header>
  );
}
