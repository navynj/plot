import { AlbumType } from '@/types/album';
import { atomWithQuery } from 'jotai-tanstack-query';
import { LexoRank } from 'lexorank';

export const albumsAtom = atomWithQuery<AlbumType[]>(() => {
  return {
    queryKey: ['albums'],
    queryFn: async () => {
      const res = await fetch(process.env.NEXT_PUBLIC_BASE_URL + '/api/album');
      const albums = await res.json();

      return albums.map((album: any) => ({
        ...album,
        rank: LexoRank.parse(album.rank),
      }));
    },
  };
});
