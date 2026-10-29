import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { Deal } from '@klyr/api-client';
import { money, torontoWhen } from '@klyr/core';
import { color } from '@klyr/tokens';
import { Back } from '../components/back';
import { StepUp } from '../components/step-up';
import { Button, Card, ErrorText, Field, Screen, sora, t } from '../components/ui';
import { useAuth } from '../lib/auth';
import { errorText, klyr } from '../lib/klyr';

const when = torontoWhen;
const longDate = (ymd: string) => new Date(ymd + 'T12:00:00Z').toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const LABEL: Record<Deal['conditions'][number]['kind'], string> = { financing: 'Financing', inspection: 'Inspection', status_certificate: 'Status certificate', sale_of_buyer_home: 'Sale of your home', other: 'Other' };

type Signing = { kind: 'notice'; id: string; action: 'waive' | 'fulfil'; title: string } | { kind: 'release' };

export default function DealScreen() {
  const { me } = useAuth();
  const [d, setD] = useState<Deal | null>(null);
  const [error, setError] = useState('');
  const [signing, setSigning] = useState<Signing | null>(null);
  const [name, setName] = useState('');
  const [stepUp, setStepUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const r = await klyr.deal(); if (r.ok) setD(r.data); else setError(errorText(r.error)); }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function sign() {
    if (!signing) return;
    setBusy(true); setError('');
    const r = signing.kind === 'release' ? await klyr.signRelease(name) : await klyr.conditionNotice(signing.id, signing.action, name);
    setBusy(false);
    if (r.status === 403 && r.error?.code === 'step_up_required') return setStepUp(true);
    if (!r.ok) return setError(errorText(r.error));
    setSigning(null); setName(''); setD(r.data);
  }

  if (!d) return <Screen><Back /><ErrorText>{error}</ErrorText></Screen>;
  const isVoid = d.status === 'void';
  const signPanel = signing && (stepUp
    ? <StepUp reason="Signing needs a fresh check." onCancel={() => setStepUp(false)} onDone={() => { setStepUp(false); void sign(); }} />
    : (
      <Card style={{ borderWidth: 2, borderColor: color.brand }}>
        <Text style={sora(700)}>{signing.kind === 'release' ? 'Mutual release · Form 122' : `${signing.action === 'waive' ? 'Waive' : 'Confirm fulfilled'}: ${signing.title} · Form 123`}</Text>
        <Text style={t.note}>{signing.kind === 'release' ? 'You and the seller release each other; your deposit comes back in full.' : 'Once your agent delivers it, you can’t take it back.'}</Text>
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
        <Text style={{ ...t.label, color: isVoid ? '#E5E5EA' : '#8CC2B1' }}>{d.address.toUpperCase()} · {money(d.price)}</Text>
        <Text style={{ ...sora(800), fontSize: 28, color: '#fff' }}>{isVoid ? 'Ended' : d.stage === 'firm' ? 'Firm' : 'Conditional'}</Text>
        <Text style={{ ...sora(), fontSize: 13, color: isVoid ? '#E5E5EA' : '#C9DDD6' }}>
          {isVoid ? 'A condition wasn’t met in time, so the agreement is void. Your deposit comes back in full.' : `Closing ${longDate(d.closingDate)} · cash back ${money(d.cashBack)}`}
        </Text>
      </View>
      {isVoid && (d.release
        ? <Card><Text style={t.label}>MUTUAL RELEASE · FORM 122</Text><Text style={t.body}>✓ Signed {when(d.release.signedAt)}. {d.deposit?.returnedAt ? 'Your deposit is on its way back.' : 'Your agent gets the seller’s signature, then your deposit comes back.'}</Text></Card>
        : signing?.kind === 'release' ? signPanel
          : <Card><Text style={sora(700)}>Sign the release to get your deposit back</Text><Button title="Sign the release" onPress={() => setSigning({ kind: 'release' })} /></Card>)}
      {d.deposit && (
        <Card style={d.deposit.receivedAt || isVoid ? undefined : { borderWidth: 2, borderColor: '#A54B00' }}>
          <Text style={{ ...t.label, color: d.deposit.receivedAt || isVoid ? color.textSecondary : '#A54B00' }}>
            {d.deposit.returnedAt ? 'DEPOSIT RETURNED' : d.deposit.receivedAt ? 'DEPOSIT RECEIVED' : isVoid ? 'DEPOSIT' : `DEPOSIT DUE BY ${when(d.deposit.dueAt).toUpperCase()}`}
          </Text>
          <Text style={{ ...sora(800), fontSize: 24 }}>{money(d.deposit.amount)}</Text>
          <Text style={t.body}>{d.deposit.receivedAt ? `${d.deposit.holder} has it in trust.` : isVoid ? 'Nothing to send now. If you already sent it, it comes back after the release.' : `To ${d.deposit.holder} in trust, by bank draft or wire.`}</Text>
          {d.deposit.trustVerifiedAt && <Text style={{ ...sora(600), fontSize: 12, color: '#2B7A4B' }}>✓ Trust account confirmed by phone · {when(d.deposit.trustVerifiedAt)}</Text>}
          {!d.deposit.receivedAt && !isVoid && <Text style={{ ...sora(600), fontSize: 13, color: '#A11B1B', backgroundColor: '#FDECEC', padding: 10, borderRadius: 10 }}>Before you send money, phone {d.deposit.holder} at a number you look up yourself to confirm the trust account. Klyr never changes payment details by email.</Text>}
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
              <Text style={sora(700)}>{LABEL[c.kind]}</Text>
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
    </Screen>
  );
}
