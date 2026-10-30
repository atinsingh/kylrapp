/**
 * Klyr follows Apple's Human Interface Guidelines: system colours, grouped backgrounds, inset grouped
 * sections, San Francisco type (Inter where SF isn't available). Text colours meet WCAG AA on white and on
 * the grouped background.
 */
export const color = {
  /** The tint: buttons, links, selected tabs (iOS systemBlue). */
  brand: '#007AFF',
  /** Filled primary actions: the same tint. */
  brandInk: '#007AFF',
  /** Tinted buttons and highlights. */
  brandTint: '#E5F1FF',
  brandOnDark: '#64D2FF',
  /** Money you keep or save (iOS systemGreen, accessible variant for text). */
  money: '#248A3D',
  moneyTint: '#E8F6EC',
  /** Destructive and overdue (iOS systemRed). */
  accent: '#D70015',
  accentTint: '#FFEBEC',
  /** Waiting on someone (iOS systemOrange, accessible variant for text). */
  warning: '#C93400',
  warningTint: '#FFF2E5',
  /** label, secondaryLabel (solid for AA), tertiaryLabel. */
  text: '#000000',
  textStrong: '#1C1C1E',
  textSecondary: '#6C6C70',
  textTertiary: '#8E8E93',
  /** secondarySystemGroupedBackground: sections and cards. */
  surface: '#FFFFFF',
  /** systemGroupedBackground: every screen. */
  surfaceGrouped: '#F2F2F7',
  /** tertiarySystemFill: text fields, chips, icon wells. */
  canvas: '#EEEEF0',
  line: '#E5E5EA',
  separator: '#C6C6C8',
  /** A dark panel for the one big number on a screen. */
  panel: '#1C1C1E',
  focus: '#007AFF',
} as const;

export const font = {
  /** San Francisco on Apple devices; Inter elsewhere. */
  family: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter',
  display: '-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter',
  fallback: 'system-ui, "Helvetica Neue", Arial, sans-serif',
  displayFallback: 'system-ui, "Helvetica Neue", Arial, sans-serif',
  weights: [400, 500, 600, 700, 800] as const,
  /** No text smaller than 12 px (Launch Checklist, accessibility). */
  minSize: 12,
  body: 17,
  nav: 17,
} as const;

/** iOS corner radii: inset grouped sections 10–12, large buttons 12–14, capsules. */
export const radius = { chip: 999, button: 12, card: 12, row: 10, item: 8, logo: 8, photo: 12 } as const;

export const layout = {
  sidebarWidth: 260,
  /** Minimum touch target. */
  touch: 44,
  focusRing: { width: 3, offset: 2 },
} as const;

export type ColorToken = keyof typeof color;
