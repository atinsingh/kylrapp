import { Image, Text, View } from 'react-native';
import { router } from 'expo-router';
import { color } from '@klyr/tokens';
import { display, Button, Card, Screen, sora, t } from '../components/ui';

export default function Welcome() {
  return (
    <Screen>
      <View style={{ gap: 22, paddingTop: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Image source={require('../assets/klyr-mark.png')} style={{ width: 40, height: 40, borderRadius: 10 }} accessibilityIgnoresInvertColors />
          <Text style={{ ...display(600), fontSize: 28, letterSpacing: -0.6 }}>klyr</Text>
        </View>
        <Text accessibilityRole="header" style={{ ...display(600), fontSize: 40, letterSpacing: -0.6, lineHeight: 39 }}>Buy, sell or rent in Ontario and see every dollar first.</Text>
        <Text style={{ ...t.sub, fontSize: 16 }}>A licensed Klyr agent on your side. The total cost to close, or what you keep, on every home before you commit.</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Card style={{ flex: 1 }}><Text style={{ ...display(600), fontSize: 26, letterSpacing: -0.6, color: color.brand }}>60–80%</Text><Text style={t.note}>of the buyer commission back to you</Text></Card>
          <Card style={{ flex: 1 }}><Text style={{ ...display(600), fontSize: 26, letterSpacing: -0.6, color: color.brand }}>$999</Text><Text style={t.note}>or 1% + HST to sell, full representation</Text></Card>
        </View>
        <View style={{ gap: 8 }}>
          <Button title="Get started" onPress={() => router.push('/start')} />
          <Button title="I already have an account" alt onPress={() => router.push('/signin')} />
        </View>
        <Text style={{ ...t.note, textAlign: 'center' }}>Klyr Realty Inc., Brokerage · Registered with RECO</Text>
      </View>
    </Screen>
  );
}
