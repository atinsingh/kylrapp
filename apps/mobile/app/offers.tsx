import { useCallback, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { Offer } from '@klyr/api-client';
import { money, TORONTO, torontoWhen } from '@klyr/core';
import { color } from '@klyr/tokens';
import { Back } from '../components/back';
import { StepUp } from '../components/step-up';
import { Button, Card, ErrorText, Field, Screen, sora, t, Title } from '../components/ui';
import { useAuth } from '../lib/auth';
import { errorText, klyr } from '../lib/klyr';

const when = (iso: string) => torontoWhen(iso);
const STATUS: Record<Offer['status'], [string, string, string]> = {
  draft: ['Draft · not sent', '#F2F2F7', '#5E5E63'], sent: ['With your agent', '#FBEBDD', '#A54B00'], returned: ['Sent back for changes', '#FBEBDD', '#A54B00'],
  registered: ['With the seller', '#FBEBDD', '#A54B00'], signed_back: ['Seller signed back', '#E8EEF9', '#2A4D8F'], accepted: ['Accepted', '#E3F2E8', '#2B7A4B'],
  rejected: ['Not accepted', '#F2F2F7', '#5E5E63'], expired: ['Expired', '#F2F2F7', '#5E5E63'], withdrawn: ['Withdrawn', '#F2F2F7', '#5E5E63'],
};

export default function Offers() {
  const [list, setList] = useState<Offer[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const r = await klyr.offers();
    if (r.ok) { setList(r.data); setError(''); } else setError(errorText(r.error));
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const hasDeal = list?.some(o => o.status === 'accepted' || o.signBack?.status === 'accepted');

  return (
    <Screen>
      <Back />
      <Title>Your offers</Title>
      <ErrorText>{error}</ErrorText>
      {hasDeal && <Button title="Open your deal" onPress={() => router.push('/deal')} />}
      {list?.length === 0 && <Card><Text style={sora(700)}>No offers yet</Text><Text style={t.note}>Open a home you’ve visited and tap “Offer”.</Text></Card>}
      {list?.map(o => <OfferCard key={o.id} o={o} onChange={load} />)}
      <Text style={{ ...sora(700), fontSize: 12, color: color.brand }}>● Rule · multiple offers: the listing brokerage must tell every buyer agent how many offers it has. Other buyers’ terms stay private.</Text>
    </Screen>
  );
}

function OfferCard({ o, onChange }: { o: Offer; onChange: () => Promise<void> }) {
  const { me } = useAuth();
  const [mode, setMode] = useState<null | 'withdraw' | 'accept'>(null);
  const [name, setName] = useState('');
  const [stepUp, setStepUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [label, bg, fg] = STATUS[o.signBack?.status === 'accepted' ? 'accepted' : o.status];
  const sb = o.signBack?.status === 'signed_back' ? o.signBack : null;

  const run = async (fn: () => Promise<{ ok: boolean; status: number; error?: { code?: string; message?: unknown } }>) => {
    setBusy(true); setError('');
    const r = await fn();
    setBusy(false);
    if (r.status === 403 && r.error?.code === 'step_up_required') return setStepUp(true);
    if (!r.ok) return setError(errorText(r.error));
    setMode(null);
    await onChange();
  };
  const accept = () => run(() => klyr.acceptSignBack(sb!.id, name));

  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        {o.photo && <Image source={{ uri: o.photo.url }} accessibilityLabel={o.photo.alt} style={{ width: 64, height: 48, borderRadius: 8 }} />}
        <View style={{ flex: 1 }}>
          <Pressable accessibilityRole="link" onPress={() => router.push(`/listing/${o.listingId}`)}><Text style={sora(700)}>{o.address}, {o.city}</Text></Pressable>
          <Text style={t.note}>{money(o.price)} · deposit {money(o.deposit)} · all-in {money(o.allIn)}</Text>
        </View>
      </View>
      <Text style={{ ...sora(700), fontSize: 12, alignSelf: 'flex-start', backgroundColor: bg, color: fg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2, overflow: 'hidden' }}>{label}</Text>
      {o.registeredAt && <Text style={t.note}>Registered with {o.listingBrokerage} {when(o.registeredAt)} · seller decides by {when(o.irrevocableAt)}</Text>}
      {o.agentNote && <Text style={[t.note, { color: color.text }]}>Your agent: “{o.agentNote}”</Text>}
      {sb && (
        <View style={{ backgroundColor: '#E8EEF9', borderRadius: 12, padding: 12, gap: 6 }}>
          <Text style={{ ...t.label, color: '#2A4D8F' }}>SIGNED BACK</Text>
          <Text style={{ ...sora(800), fontSize: 22 }}>{money(sb.price)}</Text>
          <Text style={t.body}>You offered {money(o.price)}. Other terms unchanged. Open until {when(sb.irrevocableAt)}.</Text>
          {stepUp ? (
            <StepUp reason="Accepting a sign-back is a signature and needs a fresh check." onCancel={() => setStepUp(false)} onDone={() => { setStepUp(false); void accept(); }} />
          ) : mode === 'accept' ? (
            <>
              <Field label={`Type your full name to accept (${me?.legalName ?? ''})`} value={name} onChangeText={setName} autoComplete="name" />
              <Button title={`Accept at ${money(sb.price)}`} busy={busy} disabled={name.trim().length < 2} onPress={accept} />
              <Button title="Back" alt onPress={() => setMode(null)} />
            </>
          ) : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Button title="Accept" onPress={() => setMode('accept')} /></View>
              <View style={{ flex: 1 }}><Button title="Decline" alt busy={busy} onPress={() => run(() => klyr.declineSignBack(sb.id))} /></View>
            </View>
          )}
        </View>
      )}
      {(o.status === 'draft' || o.status === 'returned') && <Button title={o.status === 'returned' ? 'Change and sign again' : 'Finish your offer'} onPress={() => router.push(`/offer/${o.listingId}`)} />}
      {(o.status === 'sent' || o.status === 'registered') && (mode === 'withdraw'
        ? <><Button title="Withdraw this offer" busy={busy} onPress={() => run(() => klyr.withdrawOffer(o.id))} /><Button title="Keep it" alt onPress={() => setMode(null)} /></>
        : <Button title="Withdraw" alt onPress={() => setMode('withdraw')} />)}
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}
