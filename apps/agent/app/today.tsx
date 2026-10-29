import { useCallback, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Decision, ProShowing } from '@klyr/api-client';
import { GEOFENCE } from '@klyr/contracts';
import { TORONTO, visitSlots } from '@klyr/core';
import { color } from '@klyr/tokens';
import { Nav } from '../components/nav';
import { Button, Card, Chip, ErrorText, Field, sora, t } from '../components/ui';
import { errorText, klyr } from '../lib/klyr';
import { metres, metresBetween, readLocation, useLivePosition } from '../lib/location';
import { usePushState } from '../lib/push-context';

const MIN = 60_000;
const time = (iso: string | number) => new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: TORONTO });
const day = (iso: string | number) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TORONTO });
const dayLabel = (iso: string) => {
  const d = day(iso);
  if (d === day(Date.now())) return 'TODAY';
  if (d === day(Date.now() + 86_400_000)) return 'TOMORROW';
  return new Date(iso).toLocaleDateString('en-CA', { weekday: 'long', month: 'short', day: 'numeric', timeZone: TORONTO }).toUpperCase();
};
const phone = (p: string) => p.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '+1 $1-$2-$3');

const STATUS: Record<ProShowing['status'], [string, string, string]> = {
  requested: ['Requested', '#FBEBDD', '#A54B00'],
  confirmed: ['Confirmed', '#E3F2E8', '#2B7A4B'],
  declined: ['Declined', '#F2F2F7', '#5E5E63'],
  cancelled: ['Cancelled by client', '#F2F2F7', '#5E5E63'],
  completed: ['Visited', '#E8EEF9', '#2A4D8F'],
};

/** Today's showings first; check in and complete with the phone's GPS at the property. */
export default function Today() {
  const [visits, setVisits] = useState<ProShowing[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const push = usePushState();

  const load = useCallback(async () => {
    const r = await klyr.pro.showings();
    if (r.ok) { setVisits(r.data); setError(''); } else setError(errorText(r.error));
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  // Follow the phone only while a confirmed visit is open for check-in or completion today.
  const live = (visits ?? []).some(v => v.status === 'confirmed' && Math.abs(Date.parse(v.at) - Date.now()) < 3 * 60 * MIN);
  const { pos, error: posError } = useLivePosition(live);

  const waiting = (visits ?? []).filter(v => v.status === 'requested');
  const scheduled = (visits ?? []).filter(v => v.status !== 'requested');
  const days = [...new Set(scheduled.map(v => dayLabel(v.at)))];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.surfaceGrouped }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <Nav current="today" />
        {push.state === 'off' && (
          <Card style={{ backgroundColor: '#FBEBDD' }}>
            <Text style={{ ...sora(700), color: '#A54B00' }}>Notifications are off</Text>
            <Text style={{ ...t.note, color: '#A54B00' }}>Turn them on to hear about new visit requests and get a reminder before each visit.</Text>
            <Button title="Open Settings" alt onPress={push.openSettings} />
          </Card>
        )}
        <ErrorText>{error}</ErrorText>
        {live && posError ? <ErrorText>{posError}</ErrorText> : null}
        {visits?.length === 0 && <Card><Text style={sora(700)}>No visits yet</Text><Text style={t.note}>When your clients book a visit, it shows up here for you to confirm.</Text></Card>}
        {waiting.length > 0 && <Text style={t.label}>NEEDS YOUR ANSWER · {waiting.length}</Text>}
        {waiting.map(v => <VisitCard key={v.id} v={v} pos={pos} onChange={load} />)}
        {days.map(d => (
          <View key={d} style={{ gap: 8 }}>
            <Text style={t.label}>{d}</Text>
            {scheduled.filter(v => dayLabel(v.at) === d).map(v => <VisitCard key={v.id} v={v} pos={pos} onChange={load} />)}
          </View>
        ))}
        <Text style={t.note}>
          Check in within {GEOFENCE.radiusM} m of the home, from {GEOFENCE.earlyMinutes} minutes before the visit. Complete it after at least {GEOFENCE.minOnSiteMinutes} minutes,
          still at the property. Klyr Pro reads your location only when you open this screen or tap a button, never in the background.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

type Mode = null | 'confirm' | 'move' | 'decline';

function VisitCard({ v, pos, onChange }: { v: ProShowing; pos: { lat: number; lng: number; accuracyM: number } | null; onChange: () => Promise<void> }) {
  const [mode, setMode] = useState<Mode>(null);
  const [note, setNote] = useState('');
  const [at, setAt] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const [label, bg, fg] = STATUS[v.status];
  const start = Date.parse(v.at);
  const opensAt = start - GEOFENCE.earlyMinutes * MIN;
  const completeFrom = v.checkInAt ? Date.parse(v.checkInAt) + GEOFENCE.minOnSiteMinutes * MIN : 0;
  const away = pos ? metresBetween(pos, { lat: v.lat, lng: v.lng }) : null;
  const canChange = v.status === 'requested' || (v.status === 'confirmed' && !v.checkInAt);

  async function decide() {
    if (!mode) return;
    setBusy(true); setError('');
    const d: Decision = mode === 'move' ? { action: 'move', at: at!.toISOString(), note } : mode === 'decline' ? { action: 'decline', note } : { action: 'confirm', note: note || undefined };
    const r = await klyr.pro.decide(v.id, d);
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    setMode(null); setNote('');
    await onChange();
  }

  async function geo(step: 'checkIn' | 'complete') {
    setBusy(true); setError(''); setStatus('Finding your location…');
    try {
      const reading = await readLocation();
      setStatus(`Location found (±${Math.round(reading.accuracyM)} m). Checking…`);
      const r = await klyr.pro[step](v.id, reading);
      if (!r.ok) throw new Error(errorText(r.error));
      setStatus('');
      await onChange();
    } catch (e) {
      setStatus('');
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ ...sora(800), fontSize: 20 }}>{time(v.at)}</Text>
        {v.status === 'requested' && <Text style={t.note}>{dayLabel(v.at).toLowerCase()}</Text>}
        <Text style={{ ...sora(700), fontSize: 12, marginLeft: 'auto', backgroundColor: bg, color: fg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2, overflow: 'hidden' }}>{label}</Text>
      </View>
      <View>
        <Text style={sora(700)}>{v.address}, {v.city}</Text>
        <Text style={t.note}>Listed by {v.listingBrokerage}</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
        <Text style={t.body}>{v.clientName ?? 'Client'}</Text>
        {v.clientPhone && (
          <Pressable accessibilityRole="link" accessibilityLabel={`Call ${v.clientName ?? 'client'}`} onPress={() => Linking.openURL(`tel:${v.clientPhone}`)} style={{ minHeight: 32, justifyContent: 'center' }}>
            <Text style={{ ...sora(600), color: color.brand }}> · {phone(v.clientPhone)}</Text>
          </Pressable>
        )}
      </View>
      {v.note && <Text style={t.note}>Client: “{v.note}”</Text>}
      {v.agentNote && <Text style={t.note}>You: “{v.agentNote}”</Text>}

      {v.status === 'confirmed' && !v.checkInAt && (
        <>
          <View style={{ backgroundColor: color.brandTint, borderRadius: 12, padding: 10, gap: 2 }}>
            <Text style={{ ...sora(600), fontSize: 13, color: color.brandInk }}>
              {away === null ? `Check in opens at ${time(opensAt)}, within ${GEOFENCE.radiusM} m of the home.`
                : away <= GEOFENCE.radiusM ? `You’re at the home (${metres(away)}).` : `You’re ${metres(away)} away. Check in within ${GEOFENCE.radiusM} m.`}
            </Text>
            {away !== null && <Text style={{ ...sora(), fontSize: 12, color: color.brandInk }}>Opens at {time(opensAt)}{pos ? ` · GPS ±${Math.round(pos.accuracyM)} m` : ''}</Text>}
          </View>
          <Button title="Check in at the property" busy={busy} onPress={() => geo('checkIn')} />
          <Button title="Directions" alt onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lng}`)} />
        </>
      )}
      {v.status === 'confirmed' && v.checkInAt && (
        <>
          <View style={{ backgroundColor: color.brandTint, borderRadius: 12, padding: 10 }}>
            <Text accessibilityRole="text" style={{ ...sora(600), fontSize: 13, color: color.brandInk }}>
              Checked in at {time(v.checkInAt)}, {metres(v.checkInDistanceM ?? 0)} from the home. Complete from {time(completeFrom)}, still at the property.
            </Text>
          </View>
          <Button title="Complete visit" busy={busy} onPress={() => geo('complete')} />
        </>
      )}
      {v.status === 'completed' && v.checkInAt && v.checkOutAt && (
        <Text style={t.note}>
          Checked in {time(v.checkInAt)} ({metres(v.checkInDistanceM ?? 0)}) · completed {time(v.checkOutAt)} ({metres(v.checkOutDistanceM ?? 0)}) · {Math.round((Date.parse(v.checkOutAt) - Date.parse(v.checkInAt)) / MIN)} min on site
        </Text>
      )}

      {status ? <Text style={t.note} accessibilityLiveRegion="polite">{status}</Text> : null}
      <ErrorText>{error}</ErrorText>

      {canChange && !mode && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {v.status === 'requested' && <View style={{ flex: 1 }}><Button title="Confirm" onPress={() => setMode('confirm')} /></View>}
          <View style={{ flex: 1 }}><Button title="New time" alt onPress={() => setMode('move')} /></View>
          <View style={{ flex: 1 }}><Button title={v.status === 'requested' ? 'Decline' : 'Cancel'} alt onPress={() => setMode('decline')} /></View>
        </View>
      )}
      {mode && (
        <View style={{ gap: 8 }}>
          {mode === 'move' && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} accessibilityLabel="New time">
              {visitSlots(3, [[10, 0], [13, 0], [16, 0], [18, 30]]).map(s => (
                <Chip key={s.toISOString()} on={at?.getTime() === s.getTime()} onPress={() => setAt(s)}
                  label={s.toLocaleString('en-CA', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: TORONTO })} />
              ))}
            </View>
          )}
          <Field label={mode === 'confirm' ? 'Note for your client (optional)' : 'Tell your client why'} value={note} onChangeText={setNote} maxLength={500}
            placeholder={mode === 'confirm' ? 'e.g. Meet at the side door' : mode === 'move' ? 'e.g. The seller asked for later' : 'e.g. The home sold firm this morning'} />
          <Button busy={busy} disabled={(mode !== 'confirm' && note.trim().length < 3) || (mode === 'move' && !at)} onPress={decide}
            title={mode === 'confirm' ? 'Confirm visit' : mode === 'move' ? 'Send new time' : v.status === 'requested' ? 'Decline visit' : 'Cancel visit'} />
          <Button title="Back" alt onPress={() => { setMode(null); setError(''); }} />
          <Text style={t.note}>Your client gets an email.</Text>
        </View>
      )}
    </Card>
  );
}
