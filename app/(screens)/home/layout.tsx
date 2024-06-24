import EmojiOverlay from '@/components/emoji/EmojiOverlay';
import { Suspense } from 'react';
import CategoryEditOverlay from './_components/overlays/subject/CategoryEditOverlay';
import SubjectEditOverlay from './_components/overlays/subject/SubjectEditOverlay';
import SubjectListEditOverlay from './_components/overlays/subject/SubjectListEditOverlay';
import SubjectSelectOverlay from './_components/overlays/subject/SubjectSelectOverlay';
import TodoInputOverlay from './_components/overlays/todo/TodoInputOverlay';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {children}
      {/* overlays */}
      <SubjectSelectOverlay />
      <SubjectListEditOverlay />
      <Suspense>
        <SubjectEditOverlay />
        <CategoryEditOverlay />
        <TodoInputOverlay />
      </Suspense>
      <EmojiOverlay />
    </>
  );
}
