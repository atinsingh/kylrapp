import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { color } from '@klyr/tokens';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerTintColor: color.brand, contentStyle: { backgroundColor: color.surfaceGrouped } }} />
    </>
  );
}
