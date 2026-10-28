import { PROVIDER_ROLES } from '@klyr/contracts';

/**
 * Klyr Pro: one web app, a workspace per role (design/prototype/Klyr Agent.dc.html, Klyr Pro.dc.html,
 * Law/Lend/Inspect/Cover). Agents also get the phone app for geofenced showing check-in.
 */
const WORKSPACES = [
  { role: 'agent', title: 'Agent', jobs: 'Today’s showings and route · buyer agreements to sign · pipeline by step · offers and counters · AI conversations to confirm' },
  ...PROVIDER_ROLES.map(role => ({
    role,
    title: role[0]!.toUpperCase() + role.slice(1),
    jobs: 'Quote requests · quote builder (typed values or import from your system) · client messages · documents',
  })),
];

export default function ProHome() {
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Klyr Pro</h1>
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 12 }}>
        {WORKSPACES.map(w => (
          <li key={w.role} style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
            <strong>{w.title}</strong>
            <div style={{ color: 'var(--muted)' }}>{w.jobs}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}
