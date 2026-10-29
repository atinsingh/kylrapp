import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Sora_400Regular, Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold } from '@expo-google-fonts/sora';
import { color } from '@klyr/tokens';
import { AuthProvider, useAuth } from '../lib/auth';

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

/** Nothing with client data opens until the agent is signed in with their authenticator. */
function Routes() {
  const { status } = useAuth();
  if (status === 'loading') return null;
  const ready = status === 'ready';
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: color.surfaceGrouped } }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!ready}>
        <Stack.Screen name="signin" />
      </Stack.Protected>
      <Stack.Protected guard={ready}>
        <Stack.Screen name="today" />
        <Stack.Screen name="activity" />
        <Stack.Screen name="clients" />
      </Stack.Protected>
    </Stack>
  );
}
