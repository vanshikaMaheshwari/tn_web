'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OldEvents() {
  const router = useRouter();
  useEffect(() => { router.replace('/events'); }, [router]);
  return null;
}
