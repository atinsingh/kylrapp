import { useEffect, useState } from 'react';
import { Share, Text, View } from 'react-native';
import type { PrivacyRequest } from '@klyr/api-client';
import { torontoWhen } from '@klyr/core';
import { color } from '@klyr/tokens';
import { errorText, klyr } from '../lib/klyr';
import { Button, Card, Chip, ErrorText, Field, sf, t } from './ui';

const KIND = { access: 'A copy of my information', correction: 'Correct my information', deletion: 'Delete my account' } as const;
const STATUS = { open: 'Open', completed: 'Done', denied: 'Answered' } as const;

/** PIPEDA rights on the phone: a copy, a correction, or deletion; answered within 30 days. */
export function PrivacyRequests() {
  const [list, setList] = useState<PrivacyRequest[]>([]);
  const [kind, setKind] = useState<PrivacyRequest['kind'] | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { void klyr.privacyRequests().then(r => r.ok && setList(r.data)); }, []);

  async function send() {
    if (!kind) return;
    setBusy(true); setError('');
    const r = await klyr.requestPrivacy(kind, details.trim() || undefined);
    setBusy(false);
    if (!r.ok) return setError(errorText(r.error));
    setList(r.data); setKind(null); setDetails('');
  }
  async function share(id: string) {
    const r = await klyr.privacyExport(id);
    if (!r.ok) return setError(errorText(r.error));
    // The share sheet lets them save the file or send it to themselves.
    await Share.share({ title: 'My Klyr information', message: JSON.stringify(r.data, null, 2) });
  }

  return (
    <Card>
      <Text style={{ ...sf(600), fontSize: 17, color: color.text }}>Your privacy</Text>
      <Text style={t.note}>Ask for a copy of what Klyr holds about you, a correction, or deletion. We answer within 30 days. Deleting keeps only what the law requires: identity records for 5 years and trade records for 6.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(Object.keys(KIND) as PrivacyRequest['kind'][]).map(k => <Chip key={k} label={KIND[k]} on={kind === k} onPress={() => setKind(kind === k ? null : k)} />)}
      </View>
      {kind && (
        <>
          <Field label={kind === 'correction' ? 'What should we correct?' : 'Anything we should know (optional)'} value={details} onChangeText={setDetails} />
          <ErrorText>{error}</ErrorText>
          <Button title="Send request" busy={busy} disabled={kind === 'correction' && details.trim().length < 5} onPress={send} />
        </>
      )}
      {list.map(r => (
        <View key={r.id} style={{ gap: 4, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: color.separator }}>
          <Text style={{ ...sf(600), fontSize: 15, color: color.text }}>{KIND[r.kind]}</Text>
          <Text style={t.note}>{STATUS[r.status]} · sent {torontoWhen(r.createdAt)}{r.status === 'open' ? ` · answer by ${torontoWhen(r.dueAt)}` : ''}</Text>
          {r.response && <Text style={t.note}>“{r.response}”</Text>}
          {r.kind === 'access' && r.status === 'completed' && <Button title="Share my information" alt icon="share-outline" onPress={() => void share(r.id)} />}
        </View>
      ))}
    </Card>
  );
}
