import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './foundation.css';
import { siteBase, basePath } from '@/lib/deploy';

export const metadata: Metadata = {
  metadataBase: siteBase() ? new URL(siteBase()!) : undefined,
  icons: {
    icon: [{ url: '/assets/img/favicon-32.png', sizes: '32x32' }, { url: '/assets/img/favicon-48.png', sizes: '48x48' }],
    apple: '/assets/img/apple-touch-icon.png',
  },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#070B09' };

export default function RootLayout({ children }: { children: ReactNode }) {
  const cssHref = basePath ? `/${basePath}/site.css` : '/site.css';
  return (
    <html lang="en">
      <head>{/* Shared legacy stylesheet intentionally stays external during the parity bridge. */}
        { }
        <link rel="stylesheet" href={cssHref} /></head>
      <body>{children}</body>
    </html>
  );
}
