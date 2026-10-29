import type { ReactNode } from 'react';
import { baseCss, fontLinks } from '@klyr/web-kit/styles';

export const metadata = { title: 'Klyr Pro' };

const css = `${baseCss}
.p-wrap{max-width:640px;margin:0 auto;padding:16px 16px 48px;display:flex;flex-direction:column;gap:12px}
.p-top{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.p-tabs{display:flex;gap:4px;margin-left:auto}
.p-tabs a{padding:8px 12px;border-radius:10px;font-weight:600;font-size:14px;color:var(--text);text-decoration:none;min-height:44px;display:grid;place-items:center}
.p-tabs a[aria-current=page]{background:#fff;color:var(--brand);box-shadow:0 0 0 .5px var(--sep)}
.p-pill{display:inline-block;border-radius:999px;padding:2px 9px;font-size:12px;font-weight:700}
.p-row{display:flex;gap:8px;flex-wrap:wrap}
.p-row .k-btn{width:auto;flex:1;min-width:120px}
.p-link{border:0;background:none;padding:0;min-height:44px;font-weight:700;font-size:14px;color:var(--brand)}
.p-fence{border-radius:12px;padding:10px 12px;font-size:13px;background:var(--tint);color:var(--ink)}
.p-table{width:100%;border-collapse:collapse;font-size:14px}
.p-table th{text-align:left;font-size:12px;color:var(--muted);font-weight:700;padding:6px 8px}
.p-table td{padding:10px 8px;border-top:.5px solid var(--sep);vertical-align:top}
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-CA">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href={fontLinks} rel="stylesheet" />
        <style>{css}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
