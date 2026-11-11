'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import MentorApp from '@/components/mentor/MentorApp';

function Inner() {
  const tab = useSearchParams().get('tab');
  return <MentorApp tab={['missions', 'review'].includes(tab) ? tab : 'overview'} />;
}

export default function MentorPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
