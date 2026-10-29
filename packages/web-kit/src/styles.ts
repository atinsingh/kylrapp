import { color, font, layout } from '@klyr/tokens';

/** +14165550134 → +1 416-555-0134; other numbers as given. */
export const phone = (p: string) => p.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '+1 $1-$2-$3');

/** Tokens and the k-* components every Klyr web app uses. Apps append their own rules. */
export const baseCss = `
:root{--brand:${color.brand};--ink:${color.brandInk};--tint:${color.brandTint};--accent:${color.accent};--accent-tint:${color.accentTint};--text:${color.text};--muted:${color.textSecondary};--bg:#F6F6F6;--fill:${color.canvas};--line:${color.line};--sep:${color.separator};--serif:${font.display},${font.displayFallback};--shadow:0 1px 2px rgba(0,0,0,.06),0 2px 8px rgba(0,0,0,.04)}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--text);font:${font.body}px/1.5 ${font.family},${font.fallback};-webkit-font-smoothing:antialiased}
a{color:var(--text);text-underline-offset:3px}
:focus-visible{outline:${layout.focusRing.width}px solid ${color.focus};outline-offset:${layout.focusRing.offset}px}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
button,input,select{font:inherit;color:inherit}
button{cursor:pointer}
.k-page{max-width:600px;margin:0 auto;padding:28px 20px 64px;display:flex;flex-direction:column;gap:16px}
.k-h1{font-size:32px;font-weight:800;letter-spacing:-.03em;line-height:1.1;margin:0}
.k-h2{font-size:20px;font-weight:700;letter-spacing:-.02em;line-height:1.2;margin:0}
.k-display{font-weight:800;letter-spacing:-.04em;line-height:1}
.k-sub{font-size:15px;line-height:1.5;color:var(--muted);margin:0;max-width:70ch}
.k-card{background:#fff;border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:10px;min-width:0;box-shadow:var(--shadow)}
.k-label{font-size:13px;font-weight:700;letter-spacing:.01em;color:var(--muted)}
.k-note{font-size:13px;color:var(--muted)}
.k-btn{border:0;border-radius:12px;min-height:48px;padding:0 20px;background:var(--ink);color:#fff;font-weight:700;font-size:15px;width:100%;transition:opacity .15s}
.k-btn:hover{opacity:.85}
.k-btn[disabled]{opacity:.4;cursor:default}
.k-btn.k-alt{background:var(--fill);color:var(--text)}
.k-chip{border:0;border-radius:999px;min-height:${layout.touch}px;padding:0 16px;font-size:14px;font-weight:600;background:var(--fill);color:var(--text)}
.k-chip[aria-pressed=true]{background:var(--ink);color:#fff}
.k-chip[disabled]{opacity:.5;cursor:default}
.k-field{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600;color:var(--muted)}
.k-field input,.k-field select{height:50px;border-radius:12px;border:2px solid transparent;background:var(--fill);padding:0 14px;font-size:16px;color:var(--text)}
.k-field textarea{border-radius:12px;border:2px solid transparent;background:var(--fill);padding:12px 14px;font:inherit;font-size:16px;color:var(--text);resize:vertical}
.k-field input:focus,.k-field textarea:focus,.k-field select:focus{border-color:var(--ink);background:#fff;outline:none}
.k-select{height:44px;border-radius:12px;border:0;background:var(--fill);padding:0 12px;font:inherit;font-size:14px;color:var(--text)}
.k-field input[type=range]{height:auto;border:0;padding:0;background:none}
.k-check{border:0;background:none;padding:0;min-height:${layout.touch}px;display:flex;gap:10px;align-items:center;text-align:left;width:100%;font-size:14px}
.k-dot{width:24px;height:24px;border-radius:6px;border:2px solid #B5B5B5;background:#fff;color:#fff;display:grid;place-items:center;font-size:12px;font-weight:800;flex:none}
.k-check[aria-checked=true] .k-dot{background:var(--ink);border-color:var(--ink)}
.k-progress{display:flex;gap:6px}.k-progress span{flex:1;height:4px;border-radius:2px;background:var(--line)}.k-progress span.on{background:var(--ink)}
.k-error{background:var(--accent-tint);color:#9B1C12;border-radius:12px;padding:12px 14px;font-size:14px;font-weight:600}
.k-footer{font-size:12px;color:var(--muted);text-align:center}
.k-tabs{display:flex;gap:4px;overflow-x:auto}
.k-tabs a{padding:8px 14px;border-radius:999px;font-weight:600;font-size:14px;color:var(--text);text-decoration:none;white-space:nowrap}
.k-tabs a[aria-current=page]{background:var(--ink);color:#fff}
.k-avatar{width:36px;height:36px;border-radius:50%;background:var(--ink);color:#fff;display:grid;place-items:center;font-size:13px;font-weight:700;flex:none}
/* Sidebar shell for Klyr Pro and Klyr Admin: icon navigation on the left, content on grey. */
.k-side{position:fixed;inset:0 auto 0 0;width:248px;background:#fff;border-right:1px solid var(--line);display:flex;flex-direction:column;gap:4px;padding:20px 12px;z-index:10}
.k-side .k-brand{font-size:20px;font-weight:800;letter-spacing:-.03em;padding:4px 12px 16px;color:var(--text);text-decoration:none}
.k-side .k-brand span{color:var(--brand)}
.k-side nav{display:flex;flex-direction:column;gap:2px}
.k-side nav a{display:flex;align-items:center;gap:12px;min-height:44px;padding:0 12px;border-radius:10px;font-weight:600;font-size:15px;color:var(--text);text-decoration:none}
.k-side nav a:hover{background:var(--fill)}
.k-side nav a[aria-current=page]{background:var(--fill);font-weight:700}
.k-side nav a svg{flex:none}
.k-side .k-me{margin-top:auto;display:flex;align-items:center;gap:10px;padding:12px;border-top:1px solid var(--line)}
body:has(.k-side) main{margin-left:248px}
@media (max-width:900px){
  .k-side{position:static;width:auto;flex-direction:row;align-items:center;flex-wrap:wrap;padding:10px 12px;border-right:0;border-bottom:1px solid var(--line)}
  .k-side .k-brand{padding:4px 8px}
  .k-side nav{flex-direction:row;overflow-x:auto;gap:2px;order:3;width:100%}
  .k-side nav a{min-height:40px;white-space:nowrap}
  .k-side .k-me{margin:0 0 0 auto;border:0;padding:0}
  body:has(.k-side) main{margin-left:0}
}
`;

export const fontLinks = 'https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap';
