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
  return <html lang="en">{children}</html>;
}
