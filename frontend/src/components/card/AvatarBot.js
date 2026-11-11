import s from './card.module.css';

// Generative learner avatar. Traits come from the API (interests, strongest
// skill, level, streak), so every learner's robot is different and it
// evolves as they level up.
const NAVY = '#0b2a5b';
const BODY = { white: '#ffffff', sky: '#ddf3ff', mint: '#ddf8ec', lilac: '#ece6ff' };
const VISOR = { cyan: '#4fd1ff', yellow: '#ffe45c', green: '#3ddc97', pink: '#ff9fb5' };
const CHEST = { web: '</>', dsa: 'O(n)', design: 'UI', ai: 'AI', backend: 'API', app: 'APP', cloud: 'OPS', spark: '★' };
export const CAT_LABEL = { web: 'web dev', dsa: 'DSA', design: 'design', ai: 'AI/ML', backend: 'backend', app: 'app dev', cloud: 'cloud', spark: 'tech' };

function Antenna({ kind }) {
  const st = { fill: 'none', stroke: '#4fd1ff', strokeWidth: 3 };
  switch (kind) {
    case 'web':
      return (
        <g className={s.spin}>
          <ellipse cx="75" cy="14" rx="14" ry="5" {...st} />
          <ellipse cx="75" cy="14" rx="14" ry="5" {...st} transform="rotate(60 75 14)" />
          <ellipse cx="75" cy="14" rx="14" ry="5" {...st} transform="rotate(-60 75 14)" />
          <circle cx="75" cy="14" r="2.5" fill="#4fd1ff" />
        </g>
      );
    case 'dsa':
      return (
        <g stroke="#ffe45c" strokeWidth="2.5">
          <line x1="75" y1="8" x2="65" y2="20" /><line x1="75" y1="8" x2="85" y2="20" />
          <circle cx="75" cy="7" r="5" fill="#ffe45c" stroke={NAVY} strokeWidth="2" />
          <circle cx="65" cy="21" r="4.5" fill="#4fd1ff" stroke={NAVY} strokeWidth="2" />
          <circle cx="85" cy="21" r="4.5" fill="#4fd1ff" stroke={NAVY} strokeWidth="2" />
        </g>
      );
    case 'design':
      return (
        <g>
          <path d="M75 2c9 0 15 6 15 12s-4 7-8 7c-3 0-3 3-6 3-8 0-15-5-15-11S66 2 75 2z" fill="#ffffff" stroke={NAVY} strokeWidth="2.5" />
          <circle cx="69" cy="10" r="2.6" fill="#ff9fb5" /><circle cx="76" cy="7" r="2.6" fill="#4fd1ff" /><circle cx="83" cy="11" r="2.6" fill="#ffe45c" />
        </g>
      );
    case 'ai':
      return (
        <g stroke="#ff9fb5" strokeWidth="2.2">
          <line x1="66" y1="16" x2="75" y2="7" /><line x1="75" y1="7" x2="84" y2="16" /><line x1="66" y1="16" x2="84" y2="16" />
          {[[75, 7], [66, 16], [84, 16]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="4.5" fill="#ff9fb5" stroke={NAVY} strokeWidth="2" />)}
        </g>
      );
    case 'backend':
      return (
        <g className={s.spin}>
          <circle cx="75" cy="14" r="9" fill="none" stroke="#3ddc97" strokeWidth="5" strokeDasharray="4 3" />
          <circle cx="75" cy="14" r="4" fill="#3ddc97" stroke={NAVY} strokeWidth="2" />
        </g>
      );
    case 'app':
      return <rect x="67" y="2" width="16" height="24" rx="4" fill="#ffe45c" stroke={NAVY} strokeWidth="2.5" />;
    case 'cloud':
      return <path d="M64 20a6 6 0 0 1 2-11 8 8 0 0 1 15-1 6 6 0 0 1 4 12z" fill="#ffffff" stroke={NAVY} strokeWidth="2.5" />;
    default:
      return <path d="M75 2l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" fill="#ffe45c" stroke={NAVY} strokeWidth="2" />;
  }
}

export default function AvatarBot({ traits, size = 170, label }) {
  const t = traits || {};
  const acc = new Set(t.accessories || []);
  const body = BODY[t.body] || '#ffffff';
  const visor = VISOR[t.visor] || '#4fd1ff';
  const chest = CHEST[t.chest] || '★';
  return (
    <svg width={size} height={size} viewBox="0 0 150 150" role="img" aria-label={label || 'AI-generated learner avatar'}>
      <circle cx="75" cy="78" r="64" fill="none" stroke="#ffffff" strokeOpacity=".35" strokeWidth="2" strokeDasharray="4 6" />
      <g className={s.bob}>
        {acc.has('jetpack') && (
          <g>
            <rect x="14" y="62" width="16" height="44" rx="7" fill="#ffe45c" stroke={NAVY} strokeWidth="3" />
            <rect x="120" y="62" width="16" height="44" rx="7" fill="#ffe45c" stroke={NAVY} strokeWidth="3" />
            <path d="M17 108l5 14 5-14zM123 108l5 14 5-14z" fill="#ff9f43" />
          </g>
        )}
        <line x1="75" y1="24" x2="75" y2="40" stroke="#ffffff" strokeWidth="4" />
        <Antenna kind={t.antenna} />
        <rect x="30" y="40" width="90" height="70" rx="22" fill={body} stroke={NAVY} strokeWidth="4" />
        {acc.has('headset') && (
          <g>
            <path d="M28 70a47 47 0 0 1 94 0" fill="none" stroke={NAVY} strokeWidth="4" />
            <rect x="20" y="62" width="14" height="24" rx="6" fill="#ff9fb5" stroke={NAVY} strokeWidth="3" />
            <rect x="116" y="62" width="14" height="24" rx="6" fill="#ff9fb5" stroke={NAVY} strokeWidth="3" />
          </g>
        )}
        <rect x="40" y="58" width="70" height="26" rx="13" fill={NAVY} />
        <circle cx="60" cy="71" r="6" fill={visor} /><circle cx="90" cy="71" r="6" fill={visor} />
        <path d="M64 95 Q75 103 86 95" fill="none" stroke={NAVY} strokeWidth="4" strokeLinecap="round" />
        <circle cx="42" cy="96" r="5" fill="#ff9fb5" opacity=".8" /><circle cx="108" cy="96" r="5" fill="#ff9fb5" opacity=".8" />
        <rect x="46" y="112" width="58" height="26" rx="8" fill="#ffe45c" stroke={NAVY} strokeWidth="4" />
        <text x="75" y="130" textAnchor="middle" fontFamily="Space Mono, monospace" fontWeight="700" fontSize={chest.length > 3 ? 10 : 12} fill={NAVY}>{chest}</text>
        {acc.has('flame') && (
          <path d="M118 134c2-6 9-8 7-16 5 3 8 9 6 15a7 7 0 0 1-13 1z" fill="#ff9f43" stroke={NAVY} strokeWidth="2.5" />
        )}
      </g>
    </svg>
  );
}
