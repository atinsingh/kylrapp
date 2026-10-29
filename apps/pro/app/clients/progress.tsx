import type { ClientProgress } from '@klyr/api-client';

const ID: Record<ClientProgress['idStatus'], [string, boolean]> = {
  not_started: ['ID check not started', false],
  verified: ['ID verified', true],
  needs_review: ['ID with compliance', false],
  rejected: ['ID check failed', false],
};

/** The first-visit steps: Form 300, FINTRAC ID, open visits. */
export function Progress({ p }: { p: ClientProgress }) {
  const steps: [string, boolean][] = [
    [p.agreementSignedAt ? 'Form 300 signed' : 'Form 300 not signed', !!p.agreementSignedAt],
    ID[p.idStatus],
    [`${p.openVisits} open visit${p.openVisits === 1 ? '' : 's'}`, p.openVisits > 0],
  ];
  return (
    <div className="p-row" style={{ gap: 6 }}>
      {steps.map(([t, on]) => (
        <span key={t} className="p-pill" style={{ background: on ? '#E3F2E8' : '#F2F2F7', color: on ? '#2B7A4B' : '#5E5E63', fontWeight: 600 }}>{on ? '✓ ' : ''}{t}</span>
      ))}
    </div>
  );
}
