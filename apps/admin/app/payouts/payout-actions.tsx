'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Payout } from '@klyr/api-client';
import { errorText, klyr } from '@/lib/client';

export function PayoutActions({ p }: { p: Payout }) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (p.status === 'sent') return null;
  const commission = p.status === 'pending_commission';
  async function save() {
    setBusy(true); setError('');
    const r = commission ? await klyr.admin.commissionReceived(p.id, Number(value.replace(/\D/g, ''))) : await klyr.admin.payoutSent(p.id, value);
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    setValue('');
    router.refresh();
  }
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <label className="k-field" style={{ flex: 1, minWidth: 220 }}>{commission ? 'Commission received from the listing brokerage ($)' : 'EFT reference from the bank'}
        <input value={value} onChange={e => setValue(e.target.value)} inputMode={commission ? 'numeric' : 'text'} />
      </label>
      <button className="k-btn" style={{ width: 'auto', padding: '0 20px' }} disabled={busy || !value.trim()} onClick={save}>{commission ? 'Record commission' : 'Record payment'}</button>
      {error && <div className="k-error" role="alert" style={{ width: '100%' }}>{error}</div>}
    </div>
  );
}
