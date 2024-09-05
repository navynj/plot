'use client';

import IconHolder from '@/components/holder/IconHolder';
import Loader from '@/components/loader/Loader';
import Overlay from '@/components/overlay/Overlay';
import { albumsAtom } from '@/store/album';
import { AlbumType } from '@/types/album';
import { useAtom } from 'jotai';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { FaPlus } from 'react-icons/fa6';

const AlbumSelectOverlay = () => {
  const params = useSearchParams();
  const currentProfileId = params.get('profileId') || '';
  const [{ data: albums, isPending, isFetching, isError }] = useAtom(albumsAtom);

  const filteredAlbums = useMemo(() => {
    return albums?.filter(({ profileId }) => profileId === currentProfileId);
  }, [albums, currentProfileId]);

  return (
    <Overlay
      id="album-select"
      title="Select Album"
      isRight={true}
      className="flex flex-col items-center"
      backLink="/home/list?profile-select=show"
    >
      <ul
        className={`w-full ${
          filteredAlbums?.length === 0 ? '' : 'grid grid-cols-3 gap-1'
        } max-h-[50vh] lg:max-h-[40vh] overflow-scroll scrollbar-hide`}
      >
        {isPending || isFetching ? (
          <>
            <div />
            <Loader />
          </>
        ) : (
          filteredAlbums?.map((album) => <AlbumSelectItem key={album.id} album={album} />)
        )}
        {filteredAlbums?.length === 0 && (
          <div className="w-full flex flex-col items-center py-10 bg-gray-50 rounded-xl">
            <p className="text-gray-300 text-lg font-extrabold">⚠︎ No albums.</p>
          </div>
        )}
      </ul>
      <div className="flex justify-center">
        <Link
          href={`/home/list?album-edit=show&profileId=${currentProfileId}`}
          className="w-full p-4 flex gap-1 justify-center items-center text-xs text-center font-extrabold"
        >
          <FaPlus />
          Add album
        </Link>
      </div>
    </Overlay>
  );
};

const AlbumSelectItem = ({ album }: { album: AlbumType }) => {
  const router = useRouter();
  const { id, title, icon, profile, profileId } = album;

  const selectAlbumHandler = () => {
    router.replace(`/home/list?track-input=show&profileId=${profileId}&albumId=${id}`);
  };

  return (
    <li className="w-full mb-2" onClick={selectAlbumHandler}>
      <div>
        <IconHolder className="w-full h-auto aspect-square text-5xl">{icon}</IconHolder>
        <div className="p-1">
          <p className="text-xs font-semibold leading-tight">{profile.title}</p>
          <p className="font-extrabold leading-tight">{title}</p>
        </div>
      </div>
    </li>
  );
};

export default AlbumSelectOverlay;
