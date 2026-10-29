import { color, font, layout } from '@klyr/tokens';

/** +14165550134 → +1 416-555-0134; other numbers as given. */
export const phone = (p: string) => p.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '+1 $1-$2-$3');

/** Tokens and the k-* components every Klyr web app uses. Apps append their own rules. */
export const baseCss = `
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
.k-field textarea{border-radius:12px;border:0;background:#fff;box-shadow:0 0 0 .5px var(--sep);padding:12px 14px;font:inherit;font-size:15px;color:var(--text);resize:vertical}
.k-select{height:44px;border-radius:12px;border:0;background:#fff;box-shadow:0 0 0 .5px var(--sep);padding:0 10px;font:inherit;font-size:14px;color:var(--text)}
.k-field input[type=range]{height:auto;box-shadow:none;padding:0}
.k-check{border:0;background:none;padding:0;min-height:${layout.touch}px;display:flex;gap:10px;align-items:center;text-align:left;width:100%;font-size:13px}
.k-dot{width:22px;height:22px;border-radius:50%;border:2px solid #C7C7CC;background:#fff;color:#fff;display:grid;place-items:center;font-size:12px;font-weight:800;flex:none}
.k-check[aria-checked=true] .k-dot{background:#2B7A4B;border-color:#2B7A4B}
.k-progress{display:flex;gap:4px}.k-progress span{flex:1;height:4px;border-radius:2px;background:rgba(118,118,128,.2)}.k-progress span.on{background:var(--brand)}
.k-error{background:#FDECEC;color:#A11B1B;border-radius:12px;padding:10px 12px;font-size:13px}
.k-footer{font-size:12px;color:var(--muted);text-align:center}
`;

export const fontLinks = 'https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap';
