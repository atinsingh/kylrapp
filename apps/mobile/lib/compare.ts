import { useEffect, useState } from 'react';

/** Homes picked for Compare: up to 3, for this app session. */
export const COMPARE_MAX = 3;
let ids: string[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export function useCompare() {
  const [, render] = useState(0);
  useEffect(() => { const l = () => render(n => n + 1); listeners.add(l); return () => { listeners.delete(l); }; }, []);
  return {
    ids,
    has: (id: string) => ids.includes(id),
    toggle: (id: string) => { ids = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id].slice(-COMPARE_MAX); emit(); },
    remove: (id: string) => { ids = ids.filter(x => x !== id); emit(); },
  };
}
