import { color, font, layout } from '@klyr/tokens';

/** +14165550134 → +1 416-555-0134; other numbers as given. */
export const phone = (p: string) => p.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '+1 $1-$2-$3');

/** Tokens and the k-* components every Klyr web app uses. Apps append their own rules. */
export const baseCss = `
:root{--brand:${color.brand};--ink:${color.brandInk};--tint:${color.brandTint};--accent:${color.accent};--accent-tint:${color.accentTint};--text:${color.text};--muted:${color.textSecondary};--bg:${color.surfaceGrouped};--line:${color.line};--sep:${color.separator};--serif:${font.display},${font.displayFallback}}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--text);font:${font.body}px/1.5 ${font.family},${font.fallback};-webkit-font-smoothing:antialiased}
a{color:var(--brand);text-underline-offset:3px}
:focus-visible{outline:${layout.focusRing.width}px solid ${color.focus};outline-offset:${layout.focusRing.offset}px}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
button,input,select{font:inherit;color:inherit}
button{cursor:pointer}
.k-page{max-width:600px;margin:0 auto;padding:32px 20px 64px;display:flex;flex-direction:column;gap:16px}
.k-h1{font-family:var(--serif);font-size:40px;font-weight:600;letter-spacing:-.025em;line-height:1.05;margin:0}
.k-h2{font-family:var(--serif);font-size:24px;font-weight:600;letter-spacing:-.015em;line-height:1.15;margin:0}
.k-display{font-family:var(--serif);font-weight:600;letter-spacing:-.03em;line-height:1}
.k-sub{font-size:16px;line-height:1.5;color:var(--muted);margin:0;max-width:62ch}
.k-card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:20px;display:flex;flex-direction:column;gap:10px;min-width:0}
.k-label{font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.k-note{font-size:13px;color:var(--muted)}
.k-btn{border:1.5px solid var(--ink);border-radius:999px;min-height:50px;padding:0 22px;background:var(--ink);color:#fff;font-weight:600;font-size:15px;width:100%;transition:opacity .15s}
.k-btn:hover{opacity:.88}
.k-btn[disabled]{opacity:.4;cursor:default}
.k-btn.k-alt{background:transparent;color:var(--ink)}
.k-chip{border:1px solid var(--line);border-radius:999px;min-height:${layout.touch}px;padding:0 16px;font-size:14px;font-weight:600;background:#fff;color:var(--text)}
.k-chip[aria-pressed=true]{background:var(--ink);border-color:var(--ink);color:#fff}
.k-chip[disabled]{opacity:.5;cursor:default}
.k-field{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600;color:var(--muted)}
.k-field input,.k-field select{height:52px;border-radius:14px;border:1px solid var(--line);background:#fff;padding:0 16px;font-size:16px;color:var(--text)}
.k-field textarea{border-radius:14px;border:1px solid var(--line);background:#fff;padding:12px 16px;font:inherit;font-size:16px;color:var(--text);resize:vertical}
.k-field input:focus,.k-field textarea:focus,.k-field select:focus{border-color:var(--ink);outline:none}
.k-select{height:44px;border-radius:12px;border:1px solid var(--line);background:#fff;padding:0 12px;font:inherit;font-size:14px;color:var(--text)}
.k-field input[type=range]{height:auto;border:0;padding:0}
.k-check{border:0;background:none;padding:0;min-height:${layout.touch}px;display:flex;gap:10px;align-items:center;text-align:left;width:100%;font-size:14px}
.k-dot{width:24px;height:24px;border-radius:50%;border:1.5px solid var(--muted);background:#fff;color:#fff;display:grid;place-items:center;font-size:12px;font-weight:800;flex:none}
.k-check[aria-checked=true] .k-dot{background:var(--brand);border-color:var(--brand)}
.k-progress{display:flex;gap:6px}.k-progress span{flex:1;height:3px;border-radius:2px;background:var(--line)}.k-progress span.on{background:var(--ink)}
.k-error{background:#FBE9E7;color:#9B1C12;border-radius:14px;padding:12px 14px;font-size:14px}
.k-footer{font-size:12px;color:var(--muted);text-align:center}
.k-tabs{display:flex;gap:22px;border-bottom:1px solid var(--line);overflow-x:auto}
.k-tabs a{padding:12px 0;font-weight:600;font-size:14px;color:var(--muted);text-decoration:none;border-bottom:2px solid transparent;margin-bottom:-1px;white-space:nowrap}
.k-tabs a[aria-current=page]{color:var(--text);border-bottom-color:var(--ink)}
.k-avatar{width:36px;height:36px;border-radius:50%;background:var(--ink);color:#fff;display:grid;place-items:center;font-size:13px;font-weight:700;flex:none}
`;

export const fontLinks = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Sora:wght@400;500;600;700;800&display=swap';
