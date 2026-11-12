import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import { color } from '@klyr/tokens';
import { View } from 'react-native';
import { AgentTabs } from '../components/nav';
import { AuthProvider, useAuth } from '../lib/auth';
import { PushContext } from '../lib/push-context';
import { usePush } from '../lib/push';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
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
  const push = usePush(status === 'ready');
  if (status === 'loading') return null;
  const ready = status === 'ready';
  return (
    <PushContext.Provider value={push}>
      <View style={{ flex: 1, backgroundColor: color.surface }}>
      <Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: color.surfaceGrouped } }}>
        <Stack.Screen name="index" />
        <Stack.Protected guard={!ready}>
          <Stack.Screen name="signin" />
        </Stack.Protected>
        <Stack.Protected guard={ready}>
          <Stack.Screen name="today" />
          <Stack.Screen name="offers" />
          <Stack.Screen name="deals" />
          <Stack.Screen name="activity" />
          <Stack.Screen name="clients" />
        </Stack.Protected>
      </Stack>
      {ready && <AgentTabs />}
      </View>
    </PushContext.Provider>
  );
}
