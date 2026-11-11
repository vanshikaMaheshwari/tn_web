'use client';
import { useEffect } from 'react';

// GSAP entrance motion for elements marked with .tn-reveal (respects reduced motion).
export function useReveal(deps = []) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let ctx;
    import('gsap').then(({ gsap }) => {
      ctx = gsap.context(() => {
        gsap.from('.tn-reveal', { y: 24, opacity: 0, duration: 0.5, stagger: 0.07, ease: 'power2.out', clearProps: 'all' });
      });
    });
    return () => ctx && ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
