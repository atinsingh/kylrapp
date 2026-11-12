'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ImportResult, PartnerKey, QuoteKind } from '@klyr/api-client';
import { torontoWhen } from '@klyr/core';
import { errorText, klyr } from '@/lib/client';

/** Columns a CSV needs, per kind. Same names the API takes. */
const COLUMNS: Record<QuoteKind, string> = {
  lender: 'requestId,kind,rate,fees,prepaymentPct,approvalDays,referralFee,validDays',
  lawyer: 'requestId,kind,fee,disbursements,titleInsurance,referralFee,validDays',
  inspector: 'requestId,kind,price,reportHours,referralFee,validDays',
  insurer: 'requestId,kind,annualPremium,deductible,referralFee,validDays',
};

/** A CSV row to an object: numbers stay numbers; rate is in percent in the sheet. */
function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const head = lines[0]!.split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const cells = line.split(',').map(c => c.trim());
    const o: Record<string, unknown> = {};
    head.forEach((h, i) => { const v = cells[i] ?? ''; if (v === '') return; o[h] = h === 'requestId' || h === 'kind' ? v : h === 'rate' ? Number(v) / 100 : Number(v); });
    return o as { requestId: string } & Record<string, unknown>;
  });
}

/** Connect the firm's own system: API keys, or a CSV of quotes. */
export function Connect({ keys: initial, kind }: { keys: PartnerKey[]; kind: QuoteKind }) {
  const router = useRouter();
  const [keys, setKeys] = useState(initial);
  const [name, setName] = useState('');
  const [fresh, setFresh] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function make() {
    setBusy(true); setError('');
    const r = await klyr.partner.createKey(name);
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    setFresh(r.data.key); setKeys(r.data.keys); setName('');
  }
  async function revoke(id: string) {
    const r = await klyr.partner.revokeKey(id);
    if (r.ok) setKeys(r.data); else setError(errorText(r.error));
  }
  async function upload(file: File) {
    setBusy(true); setError(''); setResult(null);
    try {
      const rows = parseCsv(await file.text());
      const r = await klyr.partner.importQuotes(rows);
      if (!r.ok) return setError(errorText(r.error));
      setResult(r.data); router.refresh();
    } catch { setError('That file isn’t a CSV with a header row.'); } finally { setBusy(false); }
  }

  return (
    <section className="k-card" aria-label="Connect your system">
      <div className="k-label">Connect your system</div>
      <span className="k-note">Send quotes from your own system instead of typing them here. They follow the same rules: ranked by what the client pays, and any referral fee is shown to the client.</span>

      <strong>Upload a CSV</strong>
      <span className="k-note">One quote per row, with a header row. For {kind === 'lender' ? 'mortgages' : `${kind}s`}: <code>{COLUMNS[kind]}</code>. Rate is in percent (4.15). Each row is checked on its own; bad rows are listed and skipped.</span>
      <input type="file" accept=".csv,text/csv" aria-label="CSV of quotes" disabled={busy} onChange={e => e.target.files?.[0] && void upload(e.target.files[0])} />
      {result && (
        <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <strong style={{ color: result.failed ? 'var(--warn)' : 'var(--money)' }}>{result.saved} saved · {result.failed} skipped</strong>
          {result.results.filter(x => !x.ok).map(x => <span key={x.row} className="k-note">Row {x.row}: {x.error}</span>)}
        </div>
      )}

      <strong style={{ marginTop: 8 }}>API keys</strong>
      <span className="k-note">Your system calls <code>GET /partner/api/requests</code> for open requests and <code>POST /partner/api/quotes</code> with up to 50 quotes, sending the key as a Bearer token. Clients’ names and emails never go to the API.</span>
      {fresh && (
        <div className="p-fence" role="status">
          <strong>Copy this key now. It won’t be shown again.</strong>
          <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13, wordBreak: 'break-all', marginTop: 4 }}>{fresh}</div>
        </div>
      )}
      {keys.map(k => (
        <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid var(--line)' }}>
          <div style={{ flex: 1 }}><strong>{k.name}</strong> <span className="k-note">· {k.prefix}… · made {torontoWhen(k.createdAt)}{k.lastUsedAt ? ` · last used ${torontoWhen(k.lastUsedAt)}` : ' · not used yet'}{k.revokedAt ? ' · revoked' : ''}</span></div>
          {!k.revokedAt && <button className="k-btn k-alt" style={{ width: 'auto', minHeight: 36, padding: '0 12px' }} onClick={() => void revoke(k.id)}>Revoke</button>}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label className="k-field" style={{ flex: 1, minWidth: 200 }}>New key name<input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Loan origination system" /></label>
        <button className="k-btn" style={{ width: 'auto', padding: '0 18px' }} disabled={busy || name.trim().length < 2} onClick={make}>Create key</button>
      </div>
      {error && <div className="k-error" role="alert">{error}</div>}
    </section>
  );
}
