import type { ReactNode } from 'react';
import { color, font, layout } from '@klyr/tokens';

const css = `
:root{--brand:${color.brand};--ink:${color.brandInk};--tint:${color.brandTint};--text:${color.text};--muted:${color.textSecondary};--bg:${color.surfaceGrouped};--sep:${color.separator}}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--text);font:${font.body}px/1.45 ${font.family},${font.fallback};-webkit-font-smoothing:antialiased}
a{color:var(--brand)}
:focus-visible{outline:${layout.focusRing.width}px solid ${color.focus};outline-offset:${layout.focusRing.offset}px}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-CA">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <style>{css}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
