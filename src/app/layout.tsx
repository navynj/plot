import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';

import { auth, signOut } from '@/auth';

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
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="border-b border-neutral-200 dark:border-neutral-800">
          <nav className="mx-auto flex w-full max-w-2xl items-baseline gap-4 px-4 py-3">
            <span className="text-sm font-semibold tracking-wide">PLOT</span>
            <Link
              href="/"
              className="text-sm text-neutral-600 hover:underline dark:text-neutral-400"
            >
              Timeline
            </Link>
            <Link
              href="/inbox"
              className="text-sm text-neutral-600 hover:underline dark:text-neutral-400"
            >
              Inbox
            </Link>
            {session?.user && (
              <span className="ml-auto flex items-baseline gap-3">
                <span className="text-xs text-neutral-500">{session.user.email}</span>
                <form
                  action={async () => {
                    'use server';
                    await signOut({ redirectTo: '/signin' });
                  }}
                >
                  <button
                    type="submit"
                    className="text-xs text-neutral-600 hover:underline dark:text-neutral-400"
                  >
                    Sign out
                  </button>
                </form>
              </span>
            )}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
