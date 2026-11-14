'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// The admin console now lives inside Mission Control for core-team mentors.
export default function AdminRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/mentor?tab=deck'); }, [router]);
  return null;
}
