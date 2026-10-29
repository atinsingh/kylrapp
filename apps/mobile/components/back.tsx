import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { color } from '@klyr/tokens';
import { sora } from './ui';

export function Back() {
  return (
    <Pressable accessibilityRole="button" onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))} style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={{ ...sora(700), fontSize: 13, color: color.brand }}>‹ Back</Text>
    </Pressable>
  );
}
