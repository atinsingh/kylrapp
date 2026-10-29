import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Sora_400Regular, Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold } from '@expo-google-fonts/sora';
import { color } from '@klyr/tokens';
import { AuthProvider, useAuth } from '../lib/auth';
import { usePush } from '../lib/push';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Sora_400Regular, Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold });
  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Routes />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

/** Signed-out screens and app screens never mix; the router redirects when the status changes. */
function Routes() {
  const { status } = useAuth();
  usePush(status === 'signedIn');
  if (status === 'loading') return null;
  const signedIn = status === 'signedIn';
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.surfaceGrouped } }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="start" />
        <Stack.Screen name="signin" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="home" />
        <Stack.Screen name="listing/[id]" />
        <Stack.Screen name="estimate" />
        <Stack.Screen name="afford" />
        <Stack.Screen name="compare" />
        <Stack.Screen name="visit/[id]" />
        <Stack.Screen name="sign-300" />
        <Stack.Screen name="id-check" />
        <Stack.Screen name="visits" />
        <Stack.Screen name="offer/[id]" />
        <Stack.Screen name="offers" />
        <Stack.Screen name="deal" />
        <Stack.Screen name="security" />
      </Stack.Protected>
    </Stack>
  );
}
