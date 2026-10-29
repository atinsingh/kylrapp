import Link from 'next/link';
import type { ProMe } from '@klyr/api-client';
import { SignOut } from './sign-out';

export function ProHeader({ me, current }: { me: ProMe; current: 'visits' | 'clients' }) {
  return (
    <header className="p-top">
      <div>
        <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--brand)' }}>Klyr Pro</div>
        <div className="k-note">{me.name}, {me.title} · {me.brokerage}</div>
      </div>
      <nav className="p-tabs" aria-label="Klyr Pro">
        <Link href="/" aria-current={current === 'visits' ? 'page' : undefined}>Visits</Link>
        <Link href="/clients" aria-current={current === 'clients' ? 'page' : undefined}>Clients</Link>
        <SignOut />
      </nav>
    </header>
  );
}
