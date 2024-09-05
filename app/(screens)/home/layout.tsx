import EmojiOverlay from '@/components/emoji/EmojiOverlay';
import { Suspense } from 'react';
import AlbumEditOverlay from './_components/overlays/profile/AlbumEditOverlay';
import AlbumSelectOverlay from './_components/overlays/profile/AlbumSelectOverlay';
import CategoryEditOverlay from './_components/overlays/profile/CategoryEditOverlay';
import ProfileEditOverlay from './_components/overlays/profile/ProfileEditOverlay';
import ProfileListEditOverlay from './_components/overlays/profile/ProfileListEditOverlay';
import ProfileSelectOverlay from './_components/overlays/profile/ProfileSelectOverlay';
import TrackInputOverlay from './_components/overlays/track/TrackInputOverlay';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {children}
      {/* overlays */}
      <ProfileSelectOverlay />
      <ProfileListEditOverlay />
      <Suspense>
        <ProfileEditOverlay />
        <AlbumSelectOverlay />
        <AlbumEditOverlay />
        <CategoryEditOverlay />
        <TrackInputOverlay />
      </Suspense>
      <EmojiOverlay />
    </>
  );
}
