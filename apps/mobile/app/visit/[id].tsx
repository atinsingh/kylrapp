import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import type { BuyingStatus, ListingDetail } from '@klyr/api-client';
import { TORONTO, torontoTime, visitSlots } from '@klyr/core';
import { errorText, klyr } from '../../lib/klyr';
import { Back } from '../../components/back';
import { Button, Card, Chip, ErrorText, Field, Screen, sora, t, Title } from '../../components/ui';

const TIMES: [number, number][] = [[10, 0], [13, 0], [16, 0], [18, 30]];
/** Next five days, in Toronto time whatever the phone's zone. */
function slots() {
  return visitSlots(5, TIMES).map(at => ({
    at,
    day: at.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', timeZone: TORONTO }),
    time: torontoTime(at),
  }));
}

export default function Visit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [l, setL] = useState<ListingDetail | null>(null);
  const [b, setB] = useState<BuyingStatus | null>(null);
  const all = useMemo(slots, []);
  const days = [...new Set(all.map(s => s.day))];
  const [day, setDay] = useState(days[0]!);
  const [pick, setPick] = useState<Date | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  // Refresh when coming back from signing or the ID check.
  useFocusEffect(useCallback(() => {
    void Promise.all([klyr.listing(id), klyr.buying()]).then(([lr, br]) => {
      if (lr.ok) setL(lr.data); if (br.ok) setB(br.data);
      if (!lr.ok) setError(errorText(lr.error));
    });
  }, [id]));

  async function book() {
    if (!pick) return;
    const r = await klyr.bookShowing(id, pick.toISOString(), note || undefined);
    if (!r.ok) return setError(errorText(r.error));
    router.replace('/visits');
  }

  if (!l || !b) return <Screen><Back /><ErrorText>{error}</ErrorText></Screen>;
  const idDone = b.idCheck.status === 'verified', idReview = b.idCheck.status === 'needs_review';
  return (
    <Screen>
      <Back />
      <Title sub={`${l.address}, ${l.city} · Listing brokerage: ${l.listingBrokerage}`}>Book a visit</Title>
      <Step rule="● RULE · BEFORE YOUR FIRST VISIT" done={b.agreement.signed}
        title={b.agreement.signed ? 'Buyer agreement signed' : 'Sign your buyer agreement once'}
        sub={b.agreement.signed ? `Form 300 · until ${b.agreement.endsOn} · copy in Documents` : 'OREA Form 300 covers every visit and offer, not just this home.'}>
        {!b.agreement.signed && <Button title="Review and sign Form 300" onPress={() => router.push('/sign-300')} />}
      </Step>
      <Step rule="ALSO REQUIRED ONCE" done={idDone}
        title={idDone ? 'ID verified' : idReview ? 'ID check with our compliance officer' : 'Verify your ID'}
        sub={idDone ? 'Kept by Klyr Realty for 5 years' : idReview ? 'We’ll let you know when you can book.' : 'FINTRAC rules: photo ID, occupation and where your deposit comes from.'}>
        {!idDone && !idReview && <Button title="Verify my ID" alt onPress={() => router.push('/id-check')} />}
      </Step>
      <Card style={b.canBookVisits ? undefined : { opacity: 0.6 }}>
        <Text style={t.label}>PICK A TIME · YOUR AGENT CONFIRMS</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{days.map(d => <Chip key={d} label={d} on={d === day} onPress={() => { if (b.canBookVisits) { setDay(d); setPick(null); } }} />)}</View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {all.filter(s => s.day === day).map(s => <Chip key={s.at.toISOString()} label={s.time} on={pick?.getTime() === s.at.getTime()} onPress={() => b.canBookVisits && setPick(s.at)} />)}
        </View>
        <Field label="Anything the agent should know? (optional)" value={note} onChangeText={setNote} maxLength={500} editable={b.canBookVisits} />
        <Text style={t.note}>{b.agent ? `${b.agent.name}, ${b.agent.title}` : 'Your agent'} meets you there.{l.openHouse ? ` Or join the open house: ${l.openHouse}.` : ''}</Text>
        <ErrorText>{error}</ErrorText>
        <Button title={b.canBookVisits ? 'Book visit' : 'Finish the steps above to book'} disabled={!b.canBookVisits || !pick} onPress={book} />
      </Card>
    </Screen>
  );
}

function Step({ rule, done, title, sub, children }: { rule: string; done: boolean; title: string; sub: string; children?: ReactNode }) {
  return (
    <Card>
      <Text style={t.label}>{rule}</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: done ? 0 : 2, borderColor: '#C7C7CC', backgroundColor: done ? '#2B7A4B' : '#fff', alignItems: 'center', justifyContent: 'center' }}>
          {done && <Text style={{ ...sora(800), color: '#fff', fontSize: 12 }}>✓</Text>}
        </View>
        <View style={{ flex: 1 }}><Text style={sora(700)}>{title}</Text><Text style={t.note}>{sub}</Text></View>
      </View>
      {children}
    </Card>
  );
}

