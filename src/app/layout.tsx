import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';

import { auth, signOut } from '@/auth';
import { PwaRegister } from '@/components/PwaRegister';
import { TimezoneSync } from '@/components/TimezoneSync';
import { SubmitButton } from '@/components/ui/submit-button';

import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'PLOT',
  description: 'Rapid capture, later organization.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PLOT',
  },
  icons: {
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  // standalone title bar follows the user's theme
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#252525' },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex h-dvh flex-col">
        <PwaRegister />
        <TimezoneSync />
        <header className="border-border border-b">
          <nav className="mx-auto flex w-full max-w-2xl items-center gap-4 px-4 py-2">
            <span className="text-sm font-semibold tracking-wide">PLOT</span>
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Stream
            </Link>
            <Link
              href="/grid"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Grid
            </Link>
            <Link
              href="/inbox"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Inbox
            </Link>
            <Link
              href="/triage"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Triage
            </Link>
            <Link
              href="/triage/fields"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Fields
            </Link>
            {session?.user && (
              <span className="ml-auto flex items-center gap-2">
                <span className="text-muted-foreground text-xs">{session.user.email}</span>
                <form
                  action={async () => {
                    'use server';
                    await signOut({ redirectTo: '/signin' });
                  }}
                >
                  <SubmitButton variant="ghost" size="sm">
                    Sign out
                  </SubmitButton>
                </form>
              </span>
            )}
          </nav>
        </header>
        <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col px-4">
          {children}
        </main>
      </body>
    </html>
  );
}
