import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BROKERAGE_LINE } from '@/lib/brand';
import { sessionToken } from '@/lib/session';

export const metadata = { title: 'Klyr · Buy, sell or rent in Ontario' };

const linkBtn = { display: 'grid', placeItems: 'center', textDecoration: 'none' } as const;

export default async function Welcome() {
  if (await sessionToken()) redirect('/');
  return (
    <main className="k-page" style={{ gap: 22, paddingTop: 48 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src="/klyr-mark.png" alt="" width={40} height={40} style={{ borderRadius: 10 }} />
        <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.02em' }}>klyr</span>
      </div>
      <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.08, margin: 0, textWrap: 'balance' }}>
        Buy, sell or rent in Ontario and see every dollar first.
      </h1>
      <p style={{ fontSize: 16, color: 'var(--muted)', margin: 0 }}>
        A licensed Klyr agent on your side. The total cost to close, or what you keep, on every home before you commit.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="k-card"><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand)' }}>60–80%</div><div className="k-note">of the buyer commission back to you</div></div>
        <div className="k-card"><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand)' }}>$999</div><div className="k-note">or 1% + HST to sell, full representation</div></div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Link href="/start" className="k-btn" style={linkBtn}>Get started</Link>
        <Link href="/signin" className="k-btn k-alt" style={linkBtn}>I already have an account</Link>
      </div>
      <div className="k-footer">{BROKERAGE_LINE}</div>
    </main>
  );
}
