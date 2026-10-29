/**
 * Klyr's app look, in the spirit of DoorDash and Uber: white screens, black actions, grey filled controls,
 * bold sans type, Klyr green for money and status. Body text never goes lighter than `textSecondary` (WCAG AA).
 */
export const color = {
  brand: '#0B7A55',
  /** Primary actions and the selected state: near-black. */
  brandInk: '#111111',
  brandTint: '#E6F4EE',
  brandOnDark: '#7EDDB6',
  /** Alerts and overdue items. */
  accent: '#C8372A',
  accentTint: '#FDECEA',
  text: '#111111',
  textStrong: '#333333',
  textSecondary: '#5E5E5E',
  surface: '#FFFFFF',
  /** Screens are white; grey is for filled controls and grouped blocks. */
  surfaceGrouped: '#FFFFFF',
  canvas: '#F3F3F3',
  line: '#EAEAEA',
  separator: 'rgba(0,0,0,.08)',
  focus: '#111111',
} as const;

export const font = {
  family: 'Sora',
  /** Headlines and hero numbers: the same family, heavier and tighter. */
  display: 'Sora',
  fallback: '-apple-system, system-ui, sans-serif',
  displayFallback: '-apple-system, system-ui, sans-serif',
  weights: [400, 500, 600, 700, 800] as const,
  /** No text smaller than 12 px (Launch Checklist, accessibility). */
  minSize: 12,
  body: 15,
  nav: 15,
} as const;

export const radius = { chip: 999, button: 12, card: 16, row: 12, item: 10, logo: 8, photo: 14 } as const;

export const layout = {
  sidebarWidth: 276,
  /** Minimum touch target. */
  touch: 44,
  focusRing: { width: 3, offset: 2 },
} as const;

export type ColorToken = keyof typeof color;
