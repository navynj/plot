import { convertTrackData, TrackType } from '@/types/track';
import { getDashDate } from '@/util/date';
import { atom } from 'jotai';
import { atomWithQuery } from 'jotai-tanstack-query';

export const todayAtom = atom(new Date());

export const tracksAtom = atomWithQuery<TrackType[]>((get) => {
  return {
    queryKey: ['tracks', get(todayAtom)],
    queryFn: async ({ queryKey: [, today] }) => {
      const res = await fetch(
        process.env.NEXT_PUBLIC_BASE_URL + `/api/track?date=${getDashDate(today as Date)}`
      );
      const tracks = await res.json();

      return convertTrackData(tracks);
    },
  };
});
