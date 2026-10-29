'use client';

import { useRouter } from 'next/navigation';
import { useCompare } from '@/lib/compare';

export function RemoveFromCompare({ id, ids, address }: { id: string; ids: string[]; address: string }) {
  const router = useRouter();
  const c = useCompare();
  return (
    <button onClick={() => { c.remove(id); const rest = ids.filter(x => x !== id); router.replace(rest.length ? `/compare?ids=${rest.join(',')}` : '/compare'); }}
      aria-label={`Remove ${address} from compare`}
      style={{ border: 0, background: 'none', padding: 0, color: 'var(--brand)', fontWeight: 700, fontSize: 13, minHeight: 44 }}>
      Remove
    </button>
  );
}
