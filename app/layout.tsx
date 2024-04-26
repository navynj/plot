import AuthSession from '@/components/provider/AuthSession';
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
      <body>
        {/* TODO: useSession 훅 사용 검토 후 provider 유지 결정 */}
        <AuthSession>{children}</AuthSession>
      </body>
    </html>
  );
}
