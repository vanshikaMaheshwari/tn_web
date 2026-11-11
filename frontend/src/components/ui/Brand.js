import Link from 'next/link';
import logo from '../../assets/logo.png';

export function Logo({ href = '/', light = false, tagline = 'all_you_need_to_know_about_tech' }) {
  return (
    <Link href={href} className="tn-logo" aria-label="TechNeeds home" style={light ? { color: '#fff' } : undefined}>
      <span className="tn-logo-mark">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo.src} alt="" width={50} height={50} />
      </span>
      <span className="tn-logo-text">
        <b>TechNeeds</b>
        <small style={light ? { color: '#8ec5ff' } : undefined}>{tagline}</small>
      </span>
    </Link>
  );
}

// Rank orbit: the rocket sits on the outer ring; "#1" is the sun in the middle.
export function Orbit({ rank, total, gap }) {
  return (
    <svg width="340" height="250" viewBox="0 0 340 250" role="img" aria-label={rank ? `Your rank: ${rank} of ${total}` : 'Rank orbit'} style={{ maxWidth: '100%' }}>
      <ellipse cx="170" cy="150" rx="150" ry="70" fill="none" stroke="#3e6fb8" strokeWidth="2" strokeDasharray="6 8" />
      <ellipse cx="170" cy="150" rx="95" ry="42" fill="none" stroke="#3e6fb8" strokeWidth="2" strokeDasharray="6 8" />
      <circle cx="170" cy="150" r="30" fill="#ffe45c" stroke="#fff" strokeWidth="2.5" />
      <text x="170" y="157" textAnchor="middle" fontFamily="Bricolage Grotesque, sans-serif" fontWeight="800" fontSize="20" fill="#0b2a5b">#1</text>
      <circle cx="58" cy="108" r="7" fill="#8ec5ff" />
      <circle cx="288" cy="190" r="7" fill="#8ec5ff" />
      <g style={{ transformOrigin: '250px 72px', animation: 'tn-float 3s ease-in-out infinite' }} transform="translate(250 72) rotate(35)">
        <path d="M0 -26 C10 -16 12 0 8 14 L-8 14 C-12 0 -10 -16 0 -26 Z" fill="#fff" stroke="#0b2a5b" strokeWidth="2" />
        <circle cx="0" cy="-6" r="4" fill="#2f6bff" />
        <path d="M-8 6 L-15 16 L-8 14 Z M8 6 L15 16 L8 14 Z" fill="#4fd1ff" />
        <path d="M-4 16 L0 28 L4 16 Z" fill="#ff9f43" />
      </g>
      {rank && <text x="204" y="34" fontFamily="Caveat, cursive" fontWeight="700" fontSize="26" fill="#ffe45c">you · #{rank} of {total}</text>}
      {gap && <text x="20" y="238" fontFamily="Caveat, cursive" fontWeight="700" fontSize="22" fill="#8ec5ff">{gap}</text>}
    </svg>
  );
}

export function Loading({ rows = 3 }) {
  return (
    <div className="tn-stack" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="tn-skeleton" />)}
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div className="tn-empty" role="alert">
      <p style={{ fontWeight: 700, color: '#0b2a5b', marginBottom: 8 }}>{message}</p>
      {onRetry && <button className="tn-btn sm" onClick={onRetry}>Try again</button>}
    </div>
  );
}
