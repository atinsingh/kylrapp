/** Values lifted from the App Core prototype. Body text never goes lighter than `textSecondary` (WCAG AA). */
export const color = {
  brand: '#2F5E53',
  brandInk: '#1F2B27',
  brandTint: '#E4EEEA',
  brandOnDark: '#8CC2B1',
  text: '#1C1C1E',
  textStrong: '#3A3A3C',
  textSecondary: '#5E5E63',
  surface: '#FFFFFF',
  surfaceGrouped: '#F2F2F7',
  canvas: '#E5E5EA',
  separator: 'rgba(60,60,67,.16)',
  focus: '#2F5E53',
} as const;

export const font = {
  family: 'Sora',
  fallback: '-apple-system, system-ui, sans-serif',
  weights: [400, 500, 600, 700, 800] as const,
  /** No text smaller than 12 px (Launch Checklist, accessibility). */
  minSize: 12,
  body: 14,
  nav: 15,
} as const;

export const radius = { chip: 999, card: 12, row: 10, item: 8, logo: 8 } as const;

export const layout = {
  sidebarWidth: 276,
  /** Minimum touch target. */
  touch: 44,
  focusRing: { width: 3, offset: 2 },
} as const;

export type ColorToken = keyof typeof color;
