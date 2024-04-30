import Nav from '@/components/layout/Nav';
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
      <body className="max-w-[1280px] mx-auto lg:flex lg:mt-48">
        {/* TODO: useSession 훅 사용 시 AuthSession으로 감싸기 */}
        <main className="w-full h-[calc(100vh-6rem)] lg:h-screen overflow-scroll p-4 lg:flex lg:space-x-16">
          {children}
        </main>
        <Nav className="h-[6rem] lg:h-auto lg:p-8 lg:flex lg:flex-col lg:justify-start lg:items-center" />
      </body>
    </html>
  );
}
