import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { Deal, DealTaskInput, DealTaskKey } from '@klyr/api-client';
import { calendarDate, money, nextBankingDate, torontoInputValue, torontoWhen } from '@klyr/core';
import { color } from '@klyr/tokens';
import { Back } from '../components/back';
import { StepUp } from '../components/step-up';
import { display, Button, Card, ErrorText, Field, Screen, sf, t } from '../components/ui';
import { useAuth } from '../lib/auth';
import { errorText, klyr } from '../lib/klyr';

const when = torontoWhen;
const longDate = (ymd: string) => new Date(ymd + 'T12:00:00Z').toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const LABEL: Record<Deal['conditions'][number]['kind'], string> = { financing: 'Financing', inspection: 'Inspection', status_certificate: 'Status certificate', sale_of_buyer_home: 'Sale of your home', other: 'Other' };

const STEPS: Record<DealTaskKey, [string, [string, string][]]> = {
  lawyer: ['Choose your lawyer', [['name', 'Lawyer’s name'], ['firm', 'Firm'], ['email', 'Email']]],
  mortgage: ['Mortgage instructions', [['lender', 'Lender']]],
  insurance: ['Home insurance binder', [['insurer', 'Insurer']]],
  adjustments: ['Review the statement of adjustments', []],
  walkthrough: ['Final walk-through (your agent)', []],
};

type Signing = { kind: 'notice'; id: string; action: 'waive' | 'fulfil'; title: string } | { kind: 'release' }
  | { kind: 'amend'; closingDate?: string; extend: { conditionId: string; until: string }[]; summary: string };
/** A Toronto calendar date plus some days, moved to a banking day. */
const plusDays = (ymd: string, n: number) => nextBankingDate(new Date(Date.parse(ymd + 'T12:00:00Z') + n * 86_400_000).toISOString().slice(0, 10));
const STATUS = { signed: 'Waiting for the seller', accepted: 'Agreed by the seller', rejected: 'Not agreed', withdrawn: 'Withdrawn' } as const;

export default function DealScreen() {
  const { me } = useAuth();
  const [d, setD] = useState<Deal | null>(null);
  const [error, setError] = useState('');
  const [signing, setSigning] = useState<Signing | null>(null);
  const [name, setName] = useState('');
  const [stepUp, setStepUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [task, setTask] = useState<DealTaskKey | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const load = useCallback(async () => { const r = await klyr.deal(); if (r.ok) setD(r.data); else setError(errorText(r.error)); }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function sign() {
    if (!signing) return;
    setBusy(true); setError('');
    const r = signing.kind === 'release' ? await klyr.signRelease(name)
      : signing.kind === 'amend' ? await klyr.proposeAmendment({ closingDate: signing.closingDate, extend: signing.extend }, name)
        : await klyr.conditionNotice(signing.id, signing.action, name);
    setBusy(false);
    if (r.status === 403 && r.error?.code === 'step_up_required') return setStepUp(true);
    if (!r.ok) return setError(errorText(r.error));
    setSigning(null); setName(''); setD(r.data);
  }

  async function saveTask(key: DealTaskKey) {
    setBusy(true); setError('');
    const r = await klyr.dealTask({ key, ...form } as DealTaskInput);
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    setTask(null); setForm({}); setD(r.data);
  }

  if (!d) return <Screen><Back /><ErrorText>{error}</ErrorText></Screen>;
  const isVoid = d.status === 'void', closed = !!d.closedAt;
  const signPanel = signing && (stepUp
    ? <StepUp reason="Signing needs a fresh check." onCancel={() => setStepUp(false)} onDone={() => { setStepUp(false); void sign(); }} />
    : (
      <Card style={{ borderWidth: 2, borderColor: color.brand }}>
        <Text style={sf(700)}>{signing.kind === 'release' ? 'Mutual release · Form 122' : signing.kind === 'amend' ? `Amendment · Form 120: ${signing.summary}` : `${signing.action === 'waive' ? 'Waive' : 'Confirm fulfilled'}: ${signing.title} · Form 123`}</Text>
        <Text style={t.note}>{signing.kind === 'release' ? 'You and the seller release each other; your deposit comes back in full.' : signing.kind === 'amend' ? 'It changes the agreement only if the seller agrees.' : 'Once your agent delivers it, you can’t take it back.'}</Text>
        <Field label={`Type your full name to sign (${me?.legalName ?? ''})`} value={name} onChangeText={setName} autoComplete="name" />
        <ErrorText>{error}</ErrorText>
        <Button title="Sign" busy={busy} disabled={name.trim().length < 2} onPress={sign} />
        <Button title="Back" alt onPress={() => { setSigning(null); setError(''); }} />
      </Card>
    ));

  return (
    <Screen>
      <Back />
      <View style={{ backgroundColor: isVoid ? '#5E5E63' : color.brandInk, borderRadius: 20, padding: 18, gap: 6 }}>
        <Text style={{ ...t.label, color: isVoid ? '#E5E5EA' : '#98989D' }}>{d.address.toUpperCase()} · {money(d.price)}</Text>
        <Text style={{ ...display(600), fontSize: 32, letterSpacing: -0.6, color: '#fff' }}>{isVoid ? 'Ended' : closed ? 'Welcome home' : d.stage === 'firm' ? 'Firm' : 'Conditional'}</Text>
        <Text style={{ ...sf(), fontSize: 13, color: isVoid ? '#E5E5EA' : '#AEAEB2' }}>
          {isVoid ? 'A condition wasn’t met in time, so the agreement is void. Your deposit comes back in full.' : closed ? `Closed ${when(d.closedAt!)}. The keys are yours.` : `Closing ${longDate(d.closingDate)} · cash back ${money(d.cashBack)}`}
        </Text>
      </View>
      {isVoid && (d.release
        ? <Card><Text style={t.label}>MUTUAL RELEASE · FORM 122</Text><Text style={t.body}>✓ Signed {when(d.release.signedAt)}. {d.deposit?.returnedAt ? 'Your deposit is on its way back.' : 'Your agent gets the seller’s signature, then your deposit comes back.'}</Text></Card>
        : signing?.kind === 'release' ? signPanel
          : <Card><Text style={sf(700)}>Sign the release to get your deposit back</Text><Button title="Sign the release" onPress={() => setSigning({ kind: 'release' })} /></Card>)}
      {d.payout && (
        <Card style={{ borderWidth: 2, borderColor: color.brand }}>
          <Text style={t.label}>YOUR CASH BACK · {d.payout.pct}% OF THE COMMISSION</Text>
          <Text style={{ ...display(600), fontSize: 28, letterSpacing: -0.6 }}>{money(d.payout.amount)}</Text>
          <Text style={t.body}>{d.payout.status === 'sent' ? `Sent by EFT ${when(d.payout.paidAt!)} · reference ${d.payout.reference}.` : 'Paid by EFT after Klyr receives its commission, usually within a few business days of closing.'}</Text>
        </Card>
      )}
      {!isVoid && !closed && (
        <Card>
          <Text style={t.label}>CLOSING · {d.tasks.filter(x => x.doneAt).length} OF {d.tasks.length} DONE</Text>
          {d.tasks.map(x => (
            <View key={x.key} style={{ gap: 6, paddingVertical: 6 }}>
              <Text style={sf(700)}>{x.doneAt ? '✓ ' : ''}{STEPS[x.key][0]}</Text>
              {x.doneAt && <Text style={t.note}>{x.details.name ? `${x.details.name}, ${x.details.firm}` : x.details.lender ?? x.details.insurer ?? 'Done'}</Text>}
              {!x.doneAt && x.key !== 'walkthrough' && (task === x.key ? (
                <View style={{ gap: 6 }}>
                  {STEPS[x.key][1].map(([f, label]) => <Field key={f} label={label} value={form[f] ?? ''} onChangeText={v => setForm(y => ({ ...y, [f]: v }))} autoCapitalize={f === 'email' ? 'none' : 'words'} keyboardType={f === 'email' ? 'email-address' : 'default'} />)}
                  <Button title={x.key === 'adjustments' ? 'Confirm' : 'Save'} busy={busy} onPress={() => saveTask(x.key)} />
                  <Button title="Back" alt onPress={() => setTask(null)} />
                </View>
              ) : <Button title={x.key === 'adjustments' ? 'I’ve reviewed it' : 'Add details'} alt onPress={() => { setTask(x.key); setForm({}); }} />)}
            </View>
          ))}
        </Card>
      )}
      {d.deposit && (
        <Card style={d.deposit.receivedAt || isVoid ? undefined : { borderWidth: 2, borderColor: '#C93400' }}>
          <Text style={{ ...t.label, color: d.deposit.receivedAt || isVoid ? color.textSecondary : '#C93400' }}>
            {d.deposit.returnedAt ? 'DEPOSIT RETURNED' : d.deposit.receivedAt ? 'DEPOSIT RECEIVED' : isVoid ? 'DEPOSIT' : `DEPOSIT DUE BY ${when(d.deposit.dueAt).toUpperCase()}`}
          </Text>
          <Text style={{ ...display(600), fontSize: 28, letterSpacing: -0.6 }}>{money(d.deposit.amount)}</Text>
          <Text style={t.body}>{d.deposit.receivedAt ? `${d.deposit.holder} has it in trust.` : isVoid ? 'Nothing to send now. If you already sent it, it comes back after the release.' : `To ${d.deposit.holder} in trust, by bank draft or wire.`}</Text>
          {d.deposit.trustVerifiedAt && <Text style={{ ...sf(600), fontSize: 12, color: '#248A3D' }}>✓ Trust account confirmed by phone · {when(d.deposit.trustVerifiedAt)}</Text>}
          {!d.deposit.receivedAt && !isVoid && <Text style={{ ...sf(600), fontSize: 13, color: '#D70015', backgroundColor: '#FFEBEC', padding: 10, borderRadius: 10 }}>Before you send money, phone {d.deposit.holder} at a number you look up yourself to confirm the trust account. Klyr never changes payment details by email.</Text>}
        </Card>
      )}
      <Card>
        <Text style={t.label}>CONDITIONS</Text>
        {!d.conditions.length && <Text style={t.body}>None. Your deal is firm.</Text>}
        {d.conditions.map((c, i) => {
          const signed = c.waivedAt ?? c.fulfilledAt;
          const state = c.deliveredAt ? `✓ ${c.waivedAt ? 'Waived' : 'Fulfilled'} · delivered ${when(c.deliveredAt)}`
            : c.lapsedAt ? '× Not met in time' : isVoid ? 'Ended with the agreement' : signed ? `Signed ${when(signed)} · your agent delivers it` : `Until ${when(c.dueAt)}`;
          return (
            <View key={c.id} style={{ paddingVertical: 8, borderTopWidth: i ? 0.5 : 0, borderTopColor: color.separator, gap: 6 }}>
              <Text style={sf(700)}>{LABEL[c.kind]}</Text>
              <Text style={t.note}>{state}</Text>
              {!isVoid && !signed && !c.lapsedAt && (signing?.kind === 'notice' && signing.id === c.id ? signPanel : (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}><Button title="It’s fulfilled" onPress={() => setSigning({ kind: 'notice', id: c.id, action: 'fulfil', title: LABEL[c.kind] })} /></View>
                  <View style={{ flex: 1 }}><Button title="Waive it" alt onPress={() => setSigning({ kind: 'notice', id: c.id, action: 'waive', title: LABEL[c.kind] })} /></View>
                </View>
              ))}
            </View>
          );
        })}
        {d.conditions.length > 0 && !isVoid && <Text style={t.note}>Each ends at 11:59 pm on its last banking day. Your notice counts once your agent delivers it before then.</Text>}
      </Card>
      {!isVoid && !closed && (
        <Card>
          <Text style={t.label}>CHANGES TO THE AGREEMENT · FORM 120</Text>
          {d.amendments.map(a => (
            <View key={a.id} style={{ gap: 4 }}>
              <Text style={sf(600)}>{[...(a.changes.closingDate ? [`Closing to ${calendarDate(a.changes.closingDate)}`] : []), ...(a.changes.extend ?? []).map(e => `${LABEL[e.kind]} to ${when(e.until)}`)].join(' · ')}</Text>
              <Text style={t.note}>{STATUS[a.status]}{a.agentNote ? ` · “${a.agentNote}”` : ''}</Text>
              {a.status === 'signed' && <Button title="Withdraw" alt busy={busy} onPress={async () => { const r = await klyr.withdrawAmendment(a.id); if (r.ok) setD(r.data); else setError(errorText(r.error)); }} />}
            </View>
          ))}
          {signing?.kind === 'amend' ? signPanel : !d.amendments.some(a => a.status === 'signed') && (
            <View style={{ gap: 6 }}>
              <Text style={t.note}>Propose a change; it takes effect only if the seller agrees.</Text>
              {[7, 14].map(n => {
                const closingDate = plusDays(d.closingDate, n);
                return <Button key={n} title={`Move closing to ${calendarDate(closingDate)}`} alt onPress={() => setSigning({ kind: 'amend', closingDate, extend: [], summary: `closing to ${calendarDate(closingDate)}` })} />;
              })}
              {d.conditions.filter(c => !c.deliveredAt && !c.lapsedAt).map(c => {
                const until = plusDays(torontoInputValue(c.dueAt).slice(0, 10), 3);
                return <Button key={c.id} title={`More time for ${LABEL[c.kind].toLowerCase()} (to ${calendarDate(until)})`} alt onPress={() => setSigning({ kind: 'amend', extend: [{ conditionId: c.id, until }], summary: `${LABEL[c.kind].toLowerCase()} to ${calendarDate(until)}` })} />;
              })}
            </View>
          )}
        </Card>
      )}
    </Screen>
  );
}
