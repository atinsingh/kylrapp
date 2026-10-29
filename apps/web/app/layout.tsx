import type { ReactNode } from 'react';
import { font } from '@klyr/tokens';
import { baseCss } from '@klyr/web-kit/styles';

const css = `${baseCss}
.k-strip{position:relative;background:var(--bg)}
.k-strip-track{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;overscroll-behavior-x:contain;aspect-ratio:3/2}
.k-strip-track::-webkit-scrollbar{display:none}
.k-strip-slide{flex:0 0 100%;width:100%;height:100%;scroll-snap-align:start;display:block}
.k-strip-slide img{width:100%;height:100%;object-fit:cover;user-select:none;display:block}
.k-strip-nav{position:absolute;top:50%;transform:translateY(-50%);width:36px;height:36px;border-radius:50%;border:0;background:rgba(255,255,255,.92);color:var(--ink);font-size:22px;line-height:1;box-shadow:0 1px 4px rgba(0,0,0,.2);opacity:0;transition:opacity .15s}
.k-strip:hover .k-strip-nav:not([disabled]),.k-strip-nav:focus-visible{opacity:1}
@media (hover:none){.k-strip-nav{display:none}}
.k-strip-dots{position:absolute;bottom:10px;left:0;right:0;display:flex;justify-content:center;gap:5px;pointer-events:none}
.k-strip-dots span{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.55)}.k-strip-dots span.on{background:#fff}
.k-strip-count,.k-strip-tag{position:absolute;top:10px;border-radius:999px;padding:3px 9px;font-size:12px;font-weight:600;color:#fff;background:rgba(0,0,0,.55)}
.k-strip-count{right:10px}.k-strip-tag{left:10px}
.k-pin{background:none;border:0}
.k-pin span{display:inline-block;transform:translate(-50%,-100%);white-space:nowrap;border-radius:999px;padding:5px 10px;color:#fff;background:var(--brand);font:800 12px ${font.family},${font.fallback};box-shadow:0 4px 10px rgba(0,0,0,.25);cursor:pointer}
.k-view{display:inline-flex;background:rgba(118,118,128,.12);border-radius:10px;padding:2px}
.k-view a{padding:8px 16px;border-radius:8px;font-weight:600;font-size:13px;color:var(--text);text-decoration:none;min-height:36px;display:grid;place-items:center}
.k-view a[aria-current=page]{background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.1)}
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
