import { color, font, layout } from '@klyr/tokens';

/** +14165550134 → +1 416-555-0134; other numbers as given. */
export const phone = (p: string) => p.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '+1 $1-$2-$3');

/** Tokens and the k-* components every Klyr web app uses. Apps append their own rules. */
export const baseCss = `
:root{--brand:${color.brand};--ink:${color.panel};--tint:${color.brandTint};--money:${color.money};--money-tint:${color.moneyTint};--accent:${color.accent};--accent-tint:${color.accentTint};--warn:${color.warning};--warn-tint:${color.warningTint};--text:${color.text};--muted:${color.textSecondary};--faint:${color.textTertiary};--bg:${color.surfaceGrouped};--fill:rgba(118,118,128,.12);--line:${color.line};--sep:${color.separator};--serif:${font.display},${font.displayFallback}}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--text);font:15px/1.47 ${font.family},${font.fallback};-webkit-font-smoothing:antialiased;letter-spacing:-.006em}
a{color:var(--brand);text-decoration:none}
a:hover{text-decoration:underline}
:focus-visible{outline:none;box-shadow:0 0 0 4px rgba(0,122,255,.35);border-radius:8px}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
button,input,select{font:inherit;color:inherit;letter-spacing:inherit}
button{cursor:pointer}
.k-page{max-width:600px;margin:0 auto;padding:28px 20px 64px;display:flex;flex-direction:column;gap:20px}
.k-h1{font-family:${font.display},${font.displayFallback};font-size:34px;font-weight:700;letter-spacing:-.022em;line-height:1.12;margin:0}
.k-h2{font-size:20px;font-weight:600;letter-spacing:-.017em;line-height:1.25;margin:0}
.k-display{font-family:${font.display},${font.displayFallback};font-weight:700;letter-spacing:-.025em;line-height:1.05}
.k-sub{font-size:17px;line-height:1.47;color:var(--muted);margin:0;max-width:68ch}
.k-card{background:#fff;border-radius:12px;padding:18px 20px;display:flex;flex-direction:column;gap:10px;min-width:0}
.k-label{font-size:12px;font-weight:500;letter-spacing:.02em;text-transform:uppercase;color:var(--muted)}
.k-note{font-size:13px;color:var(--muted)}
.k-btn{border:0;border-radius:10px;min-height:44px;padding:0 18px;background:var(--brand);color:#fff;font-weight:600;font-size:15px;width:100%;transition:filter .15s}
.k-btn:hover{filter:brightness(1.08)}
.k-btn:active{filter:brightness(.92)}
.k-btn[disabled]{opacity:.35;cursor:default;filter:none}
.k-btn.k-alt{background:var(--tint);color:var(--brand)}
.k-chip{border:1px solid var(--line);border-radius:999px;min-height:34px;padding:0 14px;font-size:14px;font-weight:500;background:#fff;color:var(--text)}
.k-chip[aria-pressed=true]{background:var(--brand);border-color:var(--brand);color:#fff}
.k-chip[disabled]{opacity:.45;cursor:default}
.k-field{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:500;color:var(--muted)}
.k-field input,.k-field select{height:44px;border-radius:10px;border:1px solid #D1D1D6;background:#fff;padding:0 12px;font-size:15px;color:var(--text)}
.k-field textarea{border-radius:10px;border:1px solid #D1D1D6;background:#fff;padding:10px 12px;font:inherit;font-size:15px;color:var(--text);resize:vertical}
.k-field input:focus,.k-field textarea:focus,.k-field select:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(0,122,255,.25);outline:none}
.k-select{height:36px;border-radius:8px;border:1px solid #D1D1D6;background:#fff;padding:0 10px;font:inherit;font-size:14px;color:var(--text)}
.k-field input[type=range]{height:auto;border:0;padding:0;background:none;box-shadow:none;accent-color:var(--brand)}
input[type=checkbox]{accent-color:var(--brand);width:18px;height:18px}
.k-check{border:0;background:none;padding:0;min-height:${layout.touch}px;display:flex;gap:10px;align-items:center;text-align:left;width:100%;font-size:15px}
.k-dot{width:22px;height:22px;border-radius:50%;border:1.5px solid #C7C7CC;background:#fff;color:#fff;display:grid;place-items:center;font-size:12px;font-weight:700;flex:none}
.k-check[aria-checked=true] .k-dot{background:var(--brand);border-color:var(--brand)}
.k-progress{display:flex;gap:6px}.k-progress span{flex:1;height:4px;border-radius:2px;background:var(--line)}.k-progress span.on{background:var(--brand)}
.k-error{background:var(--accent-tint);color:var(--accent);border-radius:10px;padding:10px 14px;font-size:14px;font-weight:500}
.k-footer{font-size:12px;color:var(--muted);text-align:center}
/* Segmented control. */
.k-tabs{display:inline-flex;gap:2px;padding:2px;border-radius:9px;background:var(--fill);overflow-x:auto;max-width:100%}
.k-tabs a{padding:6px 14px;border-radius:7px;font-weight:500;font-size:13px;color:var(--text);text-decoration:none;white-space:nowrap}
.k-tabs a[aria-current=page]{background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.12)}
.k-avatar{width:32px;height:32px;border-radius:50%;background:linear-gradient(180deg,#A1A1A6,#7C7C80);color:#fff;display:grid;place-items:center;font-size:13px;font-weight:600;flex:none}
/* macOS-style sidebar for Klyr Pro and Klyr Admin. */
body:has(.k-side){position:relative}
.k-side{position:absolute;inset:0 auto 0 0;width:240px;background:#F6F6F8;border-right:1px solid var(--line);z-index:10}
.k-side-in{position:sticky;top:0;height:100vh;display:flex;flex-direction:column;gap:2px;padding:18px 10px}
.k-side .k-brand{font-size:17px;font-weight:700;letter-spacing:-.02em;padding:4px 10px 16px;color:var(--text);text-decoration:none;display:flex;align-items:center;gap:8px}
.k-side .k-brand span{color:var(--muted);font-weight:500}
.k-side nav{display:flex;flex-direction:column;gap:1px}
.k-side nav a{display:flex;align-items:center;gap:10px;min-height:34px;padding:0 10px;border-radius:7px;font-weight:500;font-size:14px;color:var(--text);text-decoration:none}
.k-side nav a:hover{background:rgba(0,0,0,.05)}
.k-side nav a svg{flex:none;color:var(--brand)}
.k-side nav a[aria-current=page]{background:var(--brand);color:#fff}
.k-side nav a[aria-current=page] svg{color:#fff}
.k-side .k-me{margin-top:auto;display:flex;align-items:center;gap:10px;padding:12px 10px 4px;border-top:1px solid var(--line)}
body:has(.k-side) main{margin-left:240px!important;padding-left:40px!important;padding-right:40px!important}
.k-side-group{display:flex;flex-direction:column;gap:1px;margin-bottom:14px}
.k-side-title{font-size:12px;font-weight:600;color:var(--faint);padding:0 10px 4px}
@media (max-width:900px){
  .k-side{position:static;width:auto;border-right:0;border-bottom:1px solid var(--line)}
  .k-side-in{position:static;height:auto;flex-direction:row;align-items:center;flex-wrap:wrap;padding:8px 12px}
  .k-side .k-brand{padding:4px 6px}
  .k-side nav{flex-direction:row;overflow-x:auto;gap:2px;order:3;width:100%}
  .k-side nav a{white-space:nowrap}
  .k-side .k-me{margin:0 0 0 auto;border:0;padding:0}
  body:has(.k-side) main{margin-left:0!important;padding-left:16px!important;padding-right:16px!important}
  .k-side-group{flex-direction:row;margin:0;gap:2px}
  .k-side-title{display:none}
}
`;

export const fontLinks = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
