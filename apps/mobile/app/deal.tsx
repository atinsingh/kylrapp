import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { Deal } from '@klyr/api-client';
import { money, TORONTO, torontoWhen } from '@klyr/core';
import { color } from '@klyr/tokens';
import { Back } from '../components/back';
import { Card, ErrorText, Screen, sora, t } from '../components/ui';
import { errorText, klyr } from '../lib/klyr';

const when = (iso: string) => torontoWhen(iso);
const longDate = (ymd: string) => new Date(ymd + 'T12:00:00Z').toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const LABEL: Record<Deal['conditions'][number]['kind'], string> = { financing: 'Financing', inspection: 'Inspection', status_certificate: 'Status certificate', sale_of_buyer_home: 'Sale of your home', other: 'Other' };

export default function DealScreen() {
  const [d, setD] = useState<Deal | null>(null);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => { void klyr.deal().then(r => (r.ok ? setD(r.data) : setError(errorText(r.error)))); }, []));
  if (!d) return <Screen><Back /><ErrorText>{error}</ErrorText></Screen>;
  return (
    <Screen>
      <Back />
      <View style={{ backgroundColor: color.brandInk, borderRadius: 20, padding: 18, gap: 6 }}>
        <Text style={{ ...t.label, color: '#8CC2B1' }}>{d.address.toUpperCase()} · {money(d.price)}</Text>
        <Text style={{ ...sora(800), fontSize: 28, color: '#fff' }}>{d.stage === 'firm' ? 'Firm' : 'Conditional'}</Text>
        <Text style={{ ...sora(), fontSize: 13, color: '#C9DDD6' }}>Closing {longDate(d.closingDate)} · cash back {money(d.cashBack)}</Text>
      </View>
      {d.deposit && (
        <Card style={d.deposit.receivedAt ? undefined : { borderWidth: 2, borderColor: '#A54B00' }}>
          <Text style={{ ...t.label, color: d.deposit.receivedAt ? color.textSecondary : '#A54B00' }}>{d.deposit.receivedAt ? 'DEPOSIT RECEIVED' : `DEPOSIT DUE BY ${when(d.deposit.dueAt).toUpperCase()}`}</Text>
          <Text style={{ ...sora(800), fontSize: 24 }}>{money(d.deposit.amount)}</Text>
          <Text style={t.body}>{d.deposit.receivedAt ? `${d.deposit.holder} has it in trust.` : `To ${d.deposit.holder} in trust, by bank draft or wire.`}</Text>
          {!d.deposit.receivedAt && <Text style={{ ...sora(600), fontSize: 13, color: '#A11B1B', backgroundColor: '#FDECEC', padding: 10, borderRadius: 10 }}>Before you send money, phone {d.deposit.holder} at a number you look up yourself to confirm the trust account. Klyr never changes payment details by email.</Text>}
        </Card>
      )}
      <Card>
        <Text style={t.label}>CONDITIONS</Text>
        {!d.conditions.length && <Text style={t.body}>None. Your deal is firm.</Text>}
        {d.conditions.map((c, i) => (
          <View key={c.id} style={{ paddingVertical: 8, borderTopWidth: i ? 0.5 : 0, borderTopColor: color.separator }}>
            <Text style={sora(700)}>{LABEL[c.kind]}</Text>
            <Text style={t.note}>Until {when(c.dueAt)}</Text>
          </View>
        ))}
        {d.conditions.length > 0 && <Text style={t.note}>Each ends at 11:59 pm on its last banking day. If it isn’t met or waived in writing by then, the deal ends and your deposit comes back.</Text>}
      </Card>
    </Screen>
  );
}
