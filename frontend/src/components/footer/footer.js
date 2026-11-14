'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import FeedbackTab from '@/components/community/FeedbackTab';

const SHOW_ON = ['/', '/techboard', '/team', '/faq', '/events', '/leaderboard'];

export default function Footer() {
  const pathname = usePathname();
  const onPublic = SHOW_ON.includes(pathname);
  const onApp = ['/dashboard', '/profile', '/classes'].includes(pathname);
  if (!onPublic) return onApp ? <FeedbackTab /> : null;
  return (
    <>
    <FeedbackTab />
    <footer className="tn-footer">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 520 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: '#fff' }}>TechNeeds IGDTUW</span>
        <span>
          A community built on <span className="tn-mono" style={{ color: '#ffe45c' }}>all_you_need_to_know_about_tech</span>:
          intro sessions, mentorship cohorts, hackathons and a place to grow together.
        </span>
      </div>
      <nav aria-label="Footer" style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <Link href="/events">Events</Link>
        <Link href="/leaderboard">Leaderboard</Link>
        <Link href="/team">Team</Link>
        <Link href="/faq">FAQs</Link>
        <Link href="/login">Log in</Link>
      </nav>
    </footer>
    </>
  );
}
