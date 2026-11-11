'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { getPublicCard } from '@/lib/api';
import { Loading } from '@/components/ui/Brand';
import AiCard from '@/components/card/AiCard';

// Opt-in public learner card: /u/TN-WEBD-0004
export default function PublicCardPage() {
  const { id } = useParams();
  const [c, setC] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setC(await getPublicCard(id)); } catch (e) { setError(e.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (error) {
    return (
      <main className="tn-wrap" style={{ alignItems: 'center', textAlign: 'center', paddingTop: 60 }}>
        <span className="tn-pill yellow">private_card</span>
        <h1 style={{ fontSize: 40 }}>This card isn’t public</h1>
        <p style={{ color: 'var(--tn-ink-2)', maxWidth: 480 }}>{error}. Learners choose whether to share their AI card.</p>
        <Link href="/" className="tn-btn primary">Back to TechNeeds</Link>
      </main>
    );
  }
  if (!c) return <main className="tn-wrap"><Loading rows={4} /></main>;
  return (
    <main className="tn-wrap" style={{ paddingTop: 16 }}>
      <div className="tn-between">
        <span className="tn-eyebrow">techneeds@igdtuw:~$ cat learner_card --public</span>
        <span className="tn-pill green">✓ verified TechNeeds learner</span>
      </div>
      <AiCard c={c} mode="public" />
    </main>
  );
}
