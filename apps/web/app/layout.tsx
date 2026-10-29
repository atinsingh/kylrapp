import type { ReactNode } from 'react';
import { color, font, layout } from '@klyr/tokens';

const css = `
:root{--brand:${color.brand};--ink:${color.brandInk};--tint:${color.brandTint};--text:${color.text};--muted:${color.textSecondary};--bg:${color.surfaceGrouped};--sep:${color.separator}}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--text);font:${font.body}px/1.45 ${font.family},${font.fallback};-webkit-font-smoothing:antialiased}
a{color:var(--brand)}
:focus-visible{outline:${layout.focusRing.width}px solid ${color.focus};outline-offset:${layout.focusRing.offset}px}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
button,input{font:inherit;color:inherit}
button{cursor:pointer}
.k-page{max-width:560px;margin:0 auto;padding:24px 16px 48px;display:flex;flex-direction:column;gap:12px}
.k-h1{font-size:24px;font-weight:800;letter-spacing:-.02em;line-height:1.15;margin:0}
.k-sub{font-size:14px;color:var(--muted);margin:0}
.k-card{background:#fff;border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:8px;min-width:0}
.k-label{font-size:12px;font-weight:700;letter-spacing:.05em;color:var(--muted)}
.k-note{font-size:12px;color:var(--muted)}
.k-btn{border:0;border-radius:14px;min-height:50px;padding:0 18px;background:var(--brand);color:#fff;font-weight:700;font-size:15px;width:100%}
.k-btn[disabled]{opacity:.55;cursor:default}
.k-btn.k-alt{background:var(--tint);color:var(--brand)}
.k-chip{border:0;border-radius:999px;min-height:${layout.touch}px;padding:0 14px;font-size:13px;font-weight:600;background:#fff;color:var(--text);box-shadow:0 0 0 .5px var(--sep)}
.k-chip[aria-pressed=true]{background:var(--brand);color:#fff}
.k-field{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600;color:var(--muted)}
.k-field input{height:50px;border-radius:12px;border:0;background:#fff;box-shadow:0 0 0 .5px var(--sep);padding:0 14px;font-size:15px;color:var(--text)}
.k-check{border:0;background:none;padding:0;min-height:${layout.touch}px;display:flex;gap:10px;align-items:center;text-align:left;width:100%;font-size:13px}
.k-dot{width:22px;height:22px;border-radius:50%;border:2px solid #C7C7CC;background:#fff;color:#fff;display:grid;place-items:center;font-size:12px;font-weight:800;flex:none}
.k-check[aria-checked=true] .k-dot{background:#2B7A4B;border-color:#2B7A4B}
.k-progress{display:flex;gap:4px}.k-progress span{flex:1;height:4px;border-radius:2px;background:rgba(118,118,128,.2)}.k-progress span.on{background:var(--brand)}
.k-error{background:#FDECEC;color:#A11B1B;border-radius:12px;padding:10px 12px;font-size:13px}
.k-footer{font-size:12px;color:var(--muted);text-align:center}
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
