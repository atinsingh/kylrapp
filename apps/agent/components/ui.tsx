import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { color, layout, radius } from '@klyr/tokens';

/** San Francisco on iPhone (the system font), Inter on Android and the web, by weight. */
export const sf = (w: 400 | 500 | 600 | 700 | 800 = 400): TextStyle => Platform.OS === 'ios'
  ? { fontWeight: String(w) as TextStyle['fontWeight'] }
  : { fontFamily: { 400: 'Inter_400Regular', 500: 'Inter_500Medium', 600: 'Inter_600SemiBold', 700: 'Inter_700Bold', 800: 'Inter_800ExtraBold' }[w] };
/** Large titles and big numbers. */
export const display = (w: 400 | 600 | 700 = 700): TextStyle => ({ ...sf(w === 700 ? 800 : 700), letterSpacing: -0.4 });

/** iOS text styles: Large Title, Title 2, Body, Subheadline, Footnote, section header. */
export const t = {
  h1: { ...sf(800), fontSize: 34, lineHeight: 41, letterSpacing: -0.4, color: color.text } as TextStyle,
  h2: { ...sf(700), fontSize: 22, lineHeight: 28, letterSpacing: -0.3, color: color.text } as TextStyle,
  body: { ...sf(), fontSize: 17, lineHeight: 22, color: color.text } as TextStyle,
  sub: { ...sf(), fontSize: 15, lineHeight: 20, color: color.textSecondary } as TextStyle,
  note: { ...sf(), fontSize: 13, lineHeight: 18, color: color.textSecondary } as TextStyle,
  label: { ...sf(500), fontSize: 13, lineHeight: 18, color: color.textSecondary, textTransform: 'uppercase' } as TextStyle,
};

export type IconName = ComponentProps<typeof Ionicons>['name'];
export function Icon({ name, size = 22, tint = color.text }: { name: IconName; size?: number; tint?: string }) {
  return <Ionicons name={name} size={size} color={tint} accessibilityElementsHidden importantForAccessibility="no" />;
}
/** A Settings-style icon: white glyph on a coloured rounded square. */
export function IconTile({ name, bg, size = 30 }: { name: IconName; bg: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size * 0.23, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Icon name={name} size={size * 0.6} tint="#fff" /></View>;
}
/** Apple system colours for icon tiles. */
export const tile = { blue: '#007AFF', green: '#34C759', orange: '#FF9500', red: '#FF3B30', indigo: '#5856D6', purple: '#AF52DE', pink: '#FF2D55', teal: '#30B0C7', gray: '#8E8E93' } as const;

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const inner = <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 20, paddingBottom: 40 }}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.surfaceGrouped }} edges={['top']}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled">{inner}</ScrollView> : inner}
    </SafeAreaView>
  );
}

/** An inset grouped section: white, rounded, on the grey grouped background. */
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ backgroundColor: color.surface, borderRadius: radius.card, padding: 16, gap: 10 }, style]}>{children}</View>;
}

/** Filled (tint) by default; tinted when `alt`. iOS large button: 50 tall, 12 corners. */
export function Button({ title, onPress, alt, disabled, busy, icon }: { title: string; onPress: () => void; alt?: boolean; disabled?: boolean; busy?: boolean; icon?: IconName }) {
  const fg = alt ? color.brand : '#fff';
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled || !!busy }} disabled={disabled || busy} onPress={onPress}
      style={({ pressed }) => ({ minHeight: 50, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 20,
        backgroundColor: alt ? color.brandTint : color.brand, opacity: disabled ? 0.35 : pressed ? 0.7 : 1 })}>
      {busy ? <ActivityIndicator color={fg} /> : <>{icon && <Icon name={icon} size={20} tint={fg} />}<Text style={{ ...sf(600), fontSize: 17, color: fg }}>{title}</Text></>}
    </Pressable>
  );
}

export function Field({ label, ...rest }: { label: string } & TextInputProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ ...sf(500), fontSize: 13, color: color.textSecondary }}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={color.textTertiary}
        style={{ ...sf(), minHeight: 46, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D1D6', paddingHorizontal: 12, fontSize: 17, color: color.text }}
        {...rest} />
    </View>
  );
}

/** A capsule toggle, tinted when on. */
export function Chip({ label, on, onPress, flex, icon }: { label: string; on: boolean; onPress: () => void; flex?: boolean; icon?: IconName }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress}
      style={{ minHeight: 36, paddingHorizontal: 14, borderRadius: radius.chip, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 5,
        backgroundColor: on ? color.brand : color.surface, borderWidth: on ? 0 : 1, borderColor: color.line, ...(flex ? { flex: 1 } : {}) }}>
      {icon && <Icon name={icon} size={15} tint={on ? '#fff' : color.text} />}
      <Text style={{ ...sf(600), fontSize: 15, color: on ? '#fff' : color.text }}>{label}</Text>
    </Pressable>
  );
}

export function Check({ on, onPress, children }: { on: boolean; onPress: () => void; children: string }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={onPress} style={{ minHeight: layout.touch, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Icon name={on ? 'checkmark-circle' : 'ellipse-outline'} size={26} tint={on ? color.brand : '#C7C7CC'} />
      <Text style={{ ...t.body, fontSize: 15, lineHeight: 20, flex: 1 }}>{children}</Text>
    </Pressable>
  );
}

export function Progress({ step }: { step: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`Step ${step} of 4`}>
      {[1, 2, 3, 4].map(i => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? color.brand : color.line }} />)}
    </View>
  );
}

export function ErrorText({ children }: { children: string }) {
  if (!children) return null;
  return <Text accessibilityRole="alert" style={{ ...sf(500), backgroundColor: color.accentTint, color: color.accent, borderRadius: 10, padding: 12, fontSize: 15 }}>{children}</Text>;
}

/** iOS large title, with a subheadline under it. */
export function Title({ children, sub }: { children: string; sub?: string }) {
  return <View style={{ gap: 4, marginTop: 4 }}><Text accessibilityRole="header" style={t.h1}>{children}</Text>{sub ? <Text style={t.sub}>{sub}</Text> : null}</View>;
}

/** The one number that matters on a screen (all-in, net, rent after fees), on a dark panel. */
export function Hero({ label, value, sub, tone = 'ink' }: { label: string; value: string; sub?: string; tone?: 'ink' | 'grey' }) {
  return (
    <View accessibilityLabel={`${label}: ${value}`} style={{ backgroundColor: tone === 'ink' ? color.panel : '#48484A', borderRadius: 16, paddingHorizontal: 20, paddingVertical: 20, gap: 4 }}>
      <Text style={{ ...sf(600), fontSize: 13, color: '#98989D', textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ ...sf(800), fontSize: 40, lineHeight: 48, letterSpacing: -0.6, color: '#fff' }}>{value}</Text>
      {sub ? <Text style={{ ...sf(), fontSize: 15, lineHeight: 20, color: '#AEAEB2' }}>{sub}</Text> : null}
    </View>
  );
}

/** A Settings-style row: coloured icon tile, title, optional subtitle, chevron. Put several in a `List`. */
export function Row({ icon, tint = tile.blue, title, sub, onPress, last }: { icon: IconName; tint?: string; title: string; sub?: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, backgroundColor: pressed ? '#E5E5EA' : color.surface })}>
      <IconTile name={icon} bg={tint} />
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingRight: 14, borderBottomWidth: last ? 0 : 0.5, borderBottomColor: color.separator }}>
        <View style={{ flex: 1, gap: 1, paddingVertical: 8 }}><Text style={{ ...sf(), fontSize: 17, color: color.text }}>{title}</Text>{sub ? <Text style={t.note}>{sub}</Text> : null}</View>
        <Icon name="chevron-forward" size={18} tint="#C4C4C7" />
      </View>
    </Pressable>
  );
}
/** An inset grouped list for `Row`s, with an optional uppercase header. */
export function List({ header, children }: { header?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      {header ? <Text style={{ ...t.label, paddingHorizontal: 16 }}>{header}</Text> : null}
      <View style={{ borderRadius: radius.card, overflow: 'hidden', backgroundColor: color.surface }}>{children}</View>
    </View>
  );
}
