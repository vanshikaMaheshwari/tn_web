'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { session } from './api';

// Guards a page for one role. Redirects to /login?role=<role> when the
// session is missing or belongs to another role.
export function useAuth(role) {
  const router = useRouter();
  const [state, setState] = useState({ ready: false, name: null });

  useEffect(() => {
    const s = session.get();
    if (!s.token || s.role !== role) {
      router.replace(`/login?role=${role}`);
      return;
    }
    setState({ ready: true, name: s.name });
  }, [role, router]);

  return state;
}
