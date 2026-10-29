'use client';

import { useEffect, useState } from 'react';

/** Homes picked for Compare: up to 3, kept in this browser only. */
const KEY = 'klyr.compare';
const EVENT = 'klyr-compare';
export const COMPARE_MAX = 3;

function read(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]; } catch { return []; }
}
function write(ids: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* private mode: selection lasts this page only */ }
  window.dispatchEvent(new Event(EVENT));
}

export function useCompare() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setIds(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  return {
    ids,
    has: (id: string) => ids.includes(id),
    toggle: (id: string) => {
      const cur = read();
      write(cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id].slice(-COMPARE_MAX));
    },
    remove: (id: string) => write(read().filter(x => x !== id)),
  };
}
