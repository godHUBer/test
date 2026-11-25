import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './foundation.css';
import {absoluteOrigin} from '@/lib/inventory/model';

export const metadata: Metadata = {
  metadataBase: absoluteOrigin(process.env.SITE_URL) ? new URL(absoluteOrigin(process.env.SITE_URL)!) : undefined,
  icons: {
    icon: [{ url: '/assets/img/favicon-32.png', sizes: '32x32' }, { url: '/assets/img/favicon-48.png', sizes: '48x48' }],
    apple: '/assets/img/apple-touch-icon.png',
  },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#070B09' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>{/* Shared legacy stylesheet intentionally stays external during the parity bridge. */}
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/site.css" /></head>
      <body>{children}</body>
    </html>
  );
}
