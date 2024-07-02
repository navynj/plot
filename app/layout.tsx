import type { Metadata } from 'next';
import './globals.css';
import JotaiProvider from '@/components/provider/JotaiProvider';
import Head from 'next/head';

export const metadata: Metadata = {
  title: 'PLOT',
  description: 'Play, List, Organize your Time',
  manifest: '/manifest.json',
  icons: [{ rel: 'icon', url: '/logo-192x192.png', sizes: '192x192' }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />
      </Head>
      <JotaiProvider>{children}</JotaiProvider>
    </html>
  );
}
