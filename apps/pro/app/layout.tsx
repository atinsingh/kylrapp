import type { ReactNode } from 'react';
import { baseCss, fontLinks } from '@klyr/web-kit/styles';

export const metadata = { title: 'Klyr Pro' };
export const viewport = { themeColor: '#F2F2F7' };

const css = `${baseCss}
.p-wrap{max-width:1100px;padding:32px 40px 64px;display:flex;flex-direction:column;gap:16px}
@media (max-width:900px){.p-wrap{padding:20px 16px 48px}}
.p-top{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.p-tabs{display:flex;gap:4px;margin-left:auto}
.p-tabs a{padding:8px 12px;border-radius:10px;font-weight:600;font-size:14px;color:var(--text);text-decoration:none;min-height:44px;display:grid;place-items:center}
.p-tabs a[aria-current=page]{color:var(--text)}
.p-pill{display:inline-block;border-radius:999px;padding:2px 9px;font-size:12px;font-weight:700}
.p-row{display:flex;gap:8px;flex-wrap:wrap}
.p-row .k-btn{width:auto;flex:1;min-width:120px}
.p-link{border:0;background:none;padding:0;min-height:44px;font-weight:700;font-size:14px;color:var(--brand)}
.p-fence{border-radius:12px;padding:12px 14px;font-size:14px;background:var(--fill);color:var(--text)}
.p-table{width:100%;border-collapse:collapse;font-size:14px}
.p-table th{text-align:left;font-size:12px;color:var(--muted);font-weight:700;padding:6px 8px}
.p-table td{padding:12px 8px;border-top:1px solid var(--line);vertical-align:top}
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
