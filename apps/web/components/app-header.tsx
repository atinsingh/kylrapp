import Link from 'next/link';
import type { Me } from '@klyr/contracts';
import { SignOut } from './sign-out';

/** Signed-in header: logo, main sections, account. */
export function AppHeader({ me, current }: { me: Me | null; current?: 'search' | 'saved' | 'afford' | 'estimate' | 'visits' | 'offers' | 'documents' }) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link href={href} aria-current={on ? 'page' : undefined}
      style={{ fontWeight: on ? 800 : 600, fontSize: 14, color: on ? 'var(--brand)' : 'var(--text)', textDecoration: 'none', minHeight: 44, display: 'grid', placeItems: 'center' }}>
      {label}
    </Link>
  );
  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text)', textDecoration: 'none' }}>
          <img src="/klyr-mark.png" alt="" width={30} height={30} style={{ borderRadius: 8 }} />
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.02em' }}>klyr</span>
        </Link>
        <nav style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }} aria-label="Main">
          {tab('/', 'Search', current === 'search')}
          {tab('/saved', 'Saved', current === 'saved')}
          {tab('/afford', 'Afford', current === 'afford')}
          {tab('/visits', 'Visits', current === 'visits')}
          {tab('/offers', 'Offers', current === 'offers')}
          {tab('/documents', 'Docs', current === 'documents')}
        </nav>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--muted)' }}>
        <span>{me?.legalName ?? me?.email}</span>
        <Link href="/security" style={{ fontWeight: 700, fontSize: 13 }}>Security</Link>
        <SignOut />
      </div>
    </header>
  );
}
