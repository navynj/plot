import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PLOT',
  description: 'Play, List, Organize your Time',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192x192.png"></link>
        <meta name="theme-color" content="#313338" />
      </head>
      {children}
    </html>
  );
}
