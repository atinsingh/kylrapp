import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, layout, radius } from '@klyr/tokens';

/** Sora by weight; React Native picks a font file per weight. */
export const sora = (w: 400 | 600 | 700 | 800 = 400): TextStyle => ({
  fontFamily: { 400: 'Sora_400Regular', 600: 'Sora_600SemiBold', 700: 'Sora_700Bold', 800: 'Sora_800ExtraBold' }[w],
});

export const t = {
  h1: { ...sora(800), fontSize: 24, letterSpacing: -0.5, color: color.text } as TextStyle,
  body: { ...sora(), fontSize: 14, color: color.text } as TextStyle,
  sub: { ...sora(), fontSize: 14, color: color.textSecondary } as TextStyle,
  note: { ...sora(), fontSize: 12, color: color.textSecondary } as TextStyle,
  label: { ...sora(700), fontSize: 12, letterSpacing: 0.6, color: color.textSecondary } as TextStyle,
};

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const inner = <View style={{ padding: 16, gap: 12, paddingBottom: 48 }}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.surfaceGrouped }} edges={['top', 'bottom']}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled">{inner}</ScrollView> : inner}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ backgroundColor: color.surface, borderRadius: 16, padding: 14, gap: 8 }, style]}>{children}</View>;
}

export function Button({ title, onPress, alt, disabled, busy }: { title: string; onPress: () => void; alt?: boolean; disabled?: boolean; busy?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled || !!busy }} disabled={disabled || busy} onPress={onPress}
      style={({ pressed }) => ({ minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18,
        backgroundColor: alt ? color.brandTint : color.brand, opacity: disabled ? 0.55 : pressed ? 0.85 : 1 })}>
      {busy ? <ActivityIndicator color={alt ? color.brand : '#fff'} /> : <Text style={{ ...sora(700), fontSize: 15, color: alt ? color.brand : '#fff' }}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, ...rest }: { label: string } & TextInputProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ ...sora(600), fontSize: 13, color: color.textSecondary }}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor="#8E8E93"
        style={{ ...sora(), height: 50, borderRadius: 12, backgroundColor: color.surface, borderWidth: 0.5, borderColor: color.separator, paddingHorizontal: 14, fontSize: 15, color: color.text }}
        {...rest} />
    </View>
  );
}

export function Chip({ label, on, onPress, flex }: { label: string; on: boolean; onPress: () => void; flex?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress}
      style={{ minHeight: layout.touch, paddingHorizontal: 14, borderRadius: radius.chip, justifyContent: 'center', alignItems: 'center',
        backgroundColor: on ? color.brand : color.surface, borderWidth: 0.5, borderColor: color.separator, ...(flex ? { flex: 1 } : {}) }}>
      <Text style={{ ...sora(600), fontSize: 13, color: on ? '#fff' : color.text }}>{label}</Text>
    </Pressable>
  );
}

export function Check({ on, onPress, children }: { on: boolean; onPress: () => void; children: string }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={onPress} style={{ minHeight: layout.touch, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: on ? 0 : 2, borderColor: '#C7C7CC', backgroundColor: on ? '#2B7A4B' : '#fff', alignItems: 'center', justifyContent: 'center' }}>
        {on && <Text style={{ ...sora(800), color: '#fff', fontSize: 12 }}>✓</Text>}
      </View>
      <Text style={{ ...t.body, fontSize: 13, flex: 1 }}>{children}</Text>
    </Pressable>
  );
}

export function Progress({ step }: { step: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }} accessibilityLabel={`Step ${step} of 4`}>
      {[1, 2, 3, 4].map(i => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? color.brand : 'rgba(118,118,128,.2)' }} />)}
    </View>
  );
}

export function ErrorText({ children }: { children: string }) {
  if (!children) return null;
  return <Text accessibilityRole="alert" style={{ ...sora(), backgroundColor: '#FDECEC', color: '#A11B1B', borderRadius: 12, padding: 12, fontSize: 13 }}>{children}</Text>;
}

export function Title({ children, sub }: { children: string; sub?: string }) {
  return <View style={{ gap: 4 }}><Text accessibilityRole="header" style={t.h1}>{children}</Text>{sub ? <Text style={t.sub}>{sub}</Text> : null}</View>;
}
