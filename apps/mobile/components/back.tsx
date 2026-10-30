import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { color } from '@klyr/tokens';
import { Icon } from './ui';

/** A round back button, top left, as in most modern apps. */
export function Back() {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: color.canvas, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
      <Icon name="arrow-back" size={22} />
    </Pressable>
  );
}
