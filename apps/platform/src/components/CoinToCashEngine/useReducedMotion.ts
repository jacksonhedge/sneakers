import { useEffect, useState } from 'react';

// Tracks prefers-reduced-motion. Defaults to true (static) until mounted so
// SSR and the first client paint always show the safe static frame; the
// animation only starts once we know the user hasn't opted out.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
