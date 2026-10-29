/**
 * Klyr's editorial look: warm paper, deep ink-green, a serif for headlines and big numbers, Sora for everything else.
 * Body text never goes lighter than `textSecondary` (WCAG AA on both paper and white).
 */
export const color = {
  brand: '#1E5444',
  brandInk: '#13201C',
  brandTint: '#E2ECE7',
  brandOnDark: '#9FD0BE',
  /** Warm clay, for the one thing on a screen that needs attention. */
  accent: '#B4502B',
  accentTint: '#F6E6DD',
  text: '#16201D',
  textStrong: '#2E3532',
  textSecondary: '#575D5A',
  surface: '#FFFFFF',
  /** Page background: warm paper. */
  surfaceGrouped: '#F5F1EA',
  canvas: '#ECE6DC',
  line: '#E4DCCF',
  separator: 'rgba(22,32,29,.12)',
  focus: '#1E5444',
} as const;

export const font = {
  family: 'Sora',
  /** Headlines and hero numbers. */
  display: 'Fraunces',
  fallback: '-apple-system, system-ui, sans-serif',
  displayFallback: 'Georgia, "Times New Roman", serif',
  weights: [400, 500, 600, 700, 800] as const,
  /** No text smaller than 12 px (Launch Checklist, accessibility). */
  minSize: 12,
  body: 15,
  nav: 15,
} as const;

export const radius = { chip: 999, button: 999, card: 20, row: 12, item: 10, logo: 8 } as const;

export const layout = {
  sidebarWidth: 276,
  /** Minimum touch target. */
  touch: 44,
  focusRing: { width: 3, offset: 2 },
} as const;

export type ColorToken = keyof typeof color;
