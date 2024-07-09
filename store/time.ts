import { TimeType } from '@/types/time';
import { getDashDate } from '@/util/date';
import { atomWithQuery } from 'jotai-tanstack-query';
import { LexoRank } from 'lexorank';
import { todayAtom } from './todo';

export const timesAtom = atomWithQuery<TimeType[]>((get) => {
  return {
    queryKey: ['times', get(todayAtom)],
    queryFn: async ({ queryKey: [, today] }) => {
      const res = await fetch(
        process.env.NEXT_PUBLIC_BASE_URL + `/api/time?date=${getDashDate(today as Date)}`
      );
      const times = await res.json();

      return times.map((time: any) => ({
        ...time,
        time: time.time && new Date(time.time),
        rank: LexoRank.parse(time.rank),
      }));
    },
  };
});
