'use client';

import { useState } from 'react';
import { klyr } from '@/lib/client';

/** Heart toggle; updates at once and rolls back if the request fails. */
export function SaveButton({ id, saved: initial, address, large }: { id: string; saved: boolean; address: string; large?: boolean }) {
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  async function toggle(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (busy) return;
    const next = !saved;
    setSaved(next); setBusy(true);
    const r = next ? await klyr.save(id) : await klyr.unsave(id);
    if (!r.ok) setSaved(!next);
    setBusy(false);
  }
  return (
    <button onClick={toggle} aria-pressed={saved} aria-label={`${saved ? 'Saved' : 'Save'} ${address}`}
      style={large
        ? { border: 0, borderRadius: 14, minHeight: 50, padding: '0 18px', background: saved ? 'var(--brand)' : 'var(--tint)', color: saved ? '#fff' : 'var(--brand)', fontWeight: 700, fontSize: 15 }
        : { border: 0, background: 'none', color: saved ? 'var(--brand)' : 'var(--muted)', fontWeight: 700, fontSize: 13, minHeight: 44, minWidth: 44 }}>
      {saved ? '♥ Saved' : '♡ Save'}
    </button>
  );
}
