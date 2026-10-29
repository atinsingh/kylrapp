import type { ReactNode } from 'react';
import { baseCss, fontLinks } from '@klyr/web-kit/styles';

export const metadata = { title: 'Klyr Admin' };

const css = `${baseCss}
.a-wrap{max-width:1040px;margin:0 auto;padding:28px 24px 64px;display:flex;flex-direction:column;gap:16px}
.a-tile{transition:border-color .15s,transform .15s}.a-tile:hover{border-color:var(--ink);transform:translateY(-2px)}
.a-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px 16px;font-size:14px}
.a-grid>span{min-width:0;overflow-wrap:anywhere}
.a-flag{display:inline-block;border-radius:999px;padding:2px 9px;font-size:12px;font-weight:700;background:#FBEBDD;color:#A54B00}
.a-table{width:100%;border-collapse:collapse;font-size:14px}
.a-table th{text-align:left;font-size:12px;color:var(--muted);font-weight:700;padding:6px 8px}
.a-table td{padding:10px 8px;border-top:1px solid var(--line);vertical-align:top}
.a-field textarea{border-radius:14px;border:1px solid var(--line);background:#fff;padding:10px 14px;font:inherit;min-height:72px;color:var(--text)}
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
