import { TrackType } from '@/types/track';
import { getDashDate } from '@/util/date';
import { atom } from 'jotai';
import { atomWithQuery } from 'jotai-tanstack-query';
import { LexoRank } from 'lexorank';

export const todayAtom = atom(new Date());

export const tracksAtom = atomWithQuery<TrackType[]>((get) => {
  return {
    queryKey: ['tracks', get(todayAtom)],
    queryFn: async ({ queryKey: [, today] }) => {
      const res = await fetch(
        process.env.NEXT_PUBLIC_BASE_URL + `/api/track?date=${getDashDate(today as Date)}`
      );
      const tracks = await res.json();

      return tracks.map((track: any) => ({
        ...track,
        scheduleStart: track.scheduleStart && {
          ...track.scheduleStart,
          time: track.scheduleStart && new Date(track.scheduleStart.time),
          rank: LexoRank.parse(track.scheduleStart.rank),
        },
        scheduleEnd: track.scheduleEnd && {
          ...track.scheduleEnd,
          time: track.scheduleEnd && new Date(track.scheduleEnd.time),
          rank: LexoRank.parse(track.scheduleEnd.rank),
        },
      }));
    },
  };
});
